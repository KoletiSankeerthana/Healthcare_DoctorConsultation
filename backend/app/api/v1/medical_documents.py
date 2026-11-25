"""
Medical Documents Intelligence API Router
Handles file upload, async processing pipeline, extraction review,
analysis retrieval, audit corrections, secure download, Q&A, and comparison.
"""

import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
    BackgroundTasks,
    status
)
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from backend.app.db.database import get_db, SessionLocal
from backend.app.db.models import (
    MedicalDocument,
    DocumentProcessingJob,
    ExtractedMedicalData,
    LaboratoryResult,
    PrescriptionItem,
    DocumentAnalysis,
    DocumentCorrection,
    DocumentAccessLog,
    DocumentPage,
    ExtractedTextBlock,
    ExtractedTable,
    ExtractedMedicalField,
    AnalysisSection,
    ExtractionVerification,
    DocumentQAMessage,
    DoctorProfile
)
from backend.app.schemas.document import (
    DocumentSummarySchema,
    DocumentDetailSchema,
    ExtractedDataSchema,
    DocumentAnalysisSchema,
    DocumentCorrectionRequest,
    DocumentCorrectionResponse,
    ReportComparisonRequest,
    ReportComparisonResponse,
    LaboratoryResultSchema,
    PrescriptionItemSchema,
    DocumentPageSchema,
    ExtractedTextBlockSchema,
    ExtractedTableSchema,
    ExtractionVerificationSchema,
    DocumentQARequest,
    DocumentQAResponse,
    RadiologyReportSchema,
    DischargeSummarySchema,
    RecommendedDoctorSchema,
    DoctorRecommendationResponse
)
from backend.app.services.storage import StorageService
from backend.app.services.extractor import DocumentExtractor
from backend.app.services.classifier import DocumentClassifier
from backend.app.services.structurer import MedicalStructurer
from backend.app.services.analysis_engine import MedicalAnalysisEngine
from backend.app.services.comparator import ReportComparator
from backend.app.services.demographic_extractor import DemographicExtractor
from backend.app.services.qa_engine import ConversationalQAEngine
from backend.app.services.doctor_recommender import DoctorRecommender

router = APIRouter(prefix="/medical-documents", tags=["Medical Documents Intelligence"])

DEFAULT_PATIENT_ID = "demo-patient-001"


def process_document_pipeline(document_id: str):
    """
    Background worker pipeline executing 4 sequential stages:
    1. Extraction (Multi-page, tables, OCR) -> 2. Classification -> 3. Structuring -> 4. Analysis
    """
    db: Session = SessionLocal()
    try:
        doc: Optional[MedicalDocument] = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
        if not doc:
            return

        job: Optional[DocumentProcessingJob] = (
            db.query(DocumentProcessingJob)
            .filter(DocumentProcessingJob.document_id == document_id)
            .order_by(DocumentProcessingJob.started_at.desc())
            .first()
        )
        if not job:
            job = DocumentProcessingJob(document_id=document_id)
            db.add(job)
            db.commit()

        # --- STAGE 1: EXTRACTION ---
        job.current_stage = "extraction"
        job.progress_percentage = 20
        doc.status = "extracting"
        db.commit()

        ext_result = DocumentExtractor.extract_content(doc.storage_path, doc.mime_type)
        if not ext_result["success"]:
            doc.status = "failed"
            doc.error_message = ext_result.get("error", "Extraction failed")
            job.status = "failed"
            job.error_details = doc.error_message
            db.commit()
            return

        doc.page_count = ext_result.get("page_count", 1)
        doc.is_encrypted = ext_result.get("is_encrypted", False)

        extracted_data = db.query(ExtractedMedicalData).filter(ExtractedMedicalData.document_id == doc.id).first()
        if not extracted_data:
            extracted_data = ExtractedMedicalData(
                document_id=doc.id,
                raw_text=ext_result["raw_text"],
                pages_text=ext_result.get("pages_text", []),
                tables=ext_result.get("tables", []),
                metadata_extracted=ext_result.get("metadata", {}),
                extraction_method=ext_result.get("method", "standard"),
                extraction_confidence=ext_result.get("confidence", 1.0),
                uncertain_fields_count=ext_result.get("uncertain_fields_count", 0)
            )
            db.add(extracted_data)
        else:
            extracted_data.raw_text = ext_result["raw_text"]
            extracted_data.pages_text = ext_result.get("pages_text", [])
            extracted_data.tables = ext_result.get("tables", [])
            extracted_data.metadata_extracted = ext_result.get("metadata", {})
            extracted_data.extraction_method = ext_result.get("method", "standard")
            extracted_data.extraction_confidence = ext_result.get("confidence", 1.0)
            extracted_data.uncertain_fields_count = ext_result.get("uncertain_fields_count", 0)
        db.commit()

        # Clear old relational pages, blocks, tables
        db.query(ExtractedTextBlock).filter(ExtractedTextBlock.document_id == doc.id).delete()
        db.query(ExtractedTable).filter(ExtractedTable.document_id == doc.id).delete()
        # Clear any existing pages, blocks, and tables for idempotency
        db.query(ExtractedTextBlock).filter(ExtractedTextBlock.document_id == doc.id).delete()
        db.query(ExtractedTable).filter(ExtractedTable.document_id == doc.id).delete()
        db.query(DocumentPage).filter(DocumentPage.document_id == doc.id).delete()
        db.commit()

        # Save relational DocumentPage, TextBlock, and Table rows
        for p_data in ext_result.get("pages", []):
            page_m = DocumentPage(
                id=str(uuid.uuid4()),
                document_id=doc.id,
                page_number=p_data.get("page_number", 1),
                width=p_data.get("width"),
                height=p_data.get("height"),
                is_scanned=p_data.get("is_scanned", False),
                ocr_applied=p_data.get("ocr_applied", False),
                text_content=p_data.get("text_content") or p_data.get("text") or "",
                char_count=p_data.get("char_count", 0),
                page_status=p_data.get("page_status", "processed"),
                confidence=p_data.get("confidence", 1.0)
            )
            db.add(page_m)
            db.commit()

            for b_data in p_data.get("blocks", []):
                block_m = ExtractedTextBlock(
                    id=str(uuid.uuid4()),
                    document_id=doc.id,
                    page_id=page_m.id,
                    page_number=page_m.page_number,
                    block_index=b_data.get("block_index", 1),
                    bbox_x0=b_data.get("bbox_x0", 0.0),
                    bbox_y0=b_data.get("bbox_y0", 0.0),
                    bbox_x1=b_data.get("bbox_x1", 0.0),
                    bbox_y1=b_data.get("bbox_y1", 0.0),
                    text=b_data.get("text", ""),
                    block_type=b_data.get("block_type", "paragraph"),
                    confidence=b_data.get("confidence", 1.0)
                )
                db.add(block_m)

            for t_data in p_data.get("tables", []):
                tab_m = ExtractedTable(
                    id=str(uuid.uuid4()),
                    document_id=doc.id,
                    page_id=page_m.id,
                    page_number=page_m.page_number,
                    table_index=t_data.get("table_index", 1),
                    headers=t_data.get("headers"),
                    row_count=t_data.get("row_count", 0),
                    col_count=t_data.get("col_count", 0),
                    table_data=t_data.get("data"),
                    bbox=t_data.get("bbox")
                )
                db.add(tab_m)
        db.commit()

        # --- STAGE 2: CLASSIFICATION ---
        job.current_stage = "classification"
        job.progress_percentage = 45
        doc.status = "classifying"
        db.commit()

        cls_result = DocumentClassifier.classify(
            raw_text=ext_result["raw_text"],
            filename=doc.original_filename,
            metadata=ext_result.get("metadata", {})
        )

        if doc.document_category == "Other medical documents" or not doc.document_category:
            doc.document_category = cls_result["category"]

        doc.sub_classification = cls_result.get("sub_classification")
        doc.classification_confidence = cls_result.get("confidence", 0.8)
        doc.classification_reasoning = cls_result.get("reasoning")

        # Extract comprehensive patient demographics & clinical metadata
        demo = DemographicExtractor.extract_demographics(
            raw_text=ext_result["raw_text"],
            pages=ext_result.get("pages", [])
        )
        if demo.get("patient_name"):
            doc.patient_name_in_doc = demo["patient_name"]
        elif cls_result.get("patient_name") and not doc.patient_name_in_doc:
            doc.patient_name_in_doc = cls_result["patient_name"]

        if demo.get("patient_age_value"):
            doc.patient_age_value = demo["patient_age_value"]
        if demo.get("patient_age_unit"):
            doc.patient_age_unit = demo["patient_age_unit"]
        if demo.get("patient_dob"):
            doc.patient_dob = demo["patient_dob"]
        if demo.get("patient_gender"):
            doc.patient_gender = demo["patient_gender"]
        if demo.get("patient_uhid"):
            doc.patient_uhid = demo["patient_uhid"]
        if demo.get("referring_doctor"):
            doc.referring_doctor = demo["referring_doctor"]
        if demo.get("sample_collection_date"):
            doc.sample_collection_date = demo["sample_collection_date"]
        if demo.get("specimen_type"):
            doc.specimen_type = demo["specimen_type"]
        if demo.get("issuing_facility") and not doc.issuing_facility:
            doc.issuing_facility = demo["issuing_facility"]
        elif cls_result.get("issuing_facility") and not doc.issuing_facility:
            doc.issuing_facility = cls_result["issuing_facility"]

        if demo.get("report_date") and not doc.report_date:
            doc.report_date = demo["report_date"]
        elif cls_result.get("report_date") and not doc.report_date:
            doc.report_date = cls_result["report_date"]

        doc.demographics_json = demo
        db.commit()

        # --- STAGE 3: STRUCTURING ---
        job.current_stage = "structuring"
        job.progress_percentage = 70
        doc.status = "structuring"
        db.commit()

        structured = MedicalStructurer.structure_document(
            extracted_result=ext_result,
            category=doc.document_category
        )

        # Clear previous lab results, prescriptions, and medical fields
        db.query(LaboratoryResult).filter(LaboratoryResult.document_id == doc.id).delete()
        db.query(PrescriptionItem).filter(PrescriptionItem.document_id == doc.id).delete()
        db.query(ExtractedMedicalField).filter(ExtractedMedicalField.document_id == doc.id).delete()
        db.query(ExtractionVerification).filter(ExtractionVerification.document_id == doc.id).delete()
        db.commit()

        lab_schemas: List[LaboratoryResultSchema] = []
        for l in structured["laboratory_results"]:
            lab_model = LaboratoryResult(
                id=l["id"],
                document_id=doc.id,
                parameter_name=l["parameter_name"],
                normalized_name=l["normalized_name"],
                result_value=l["result_value"],
                numeric_value=l["numeric_value"],
                unit=l["unit"],
                reference_range=l["reference_range"],
                ref_low=l["ref_low"],
                ref_high=l["ref_high"],
                flag=l["flag"],
                specimen=l.get("specimen"),
                page_number=l.get("page_number", 1),
                original_text_snippet=l.get("original_text_snippet"),
                confidence=l.get("confidence", 1.0),
                requires_verification=l.get("requires_verification", False),
                user_corrected=False
            )
            db.add(lab_model)
            lab_schemas.append(LaboratoryResultSchema.model_validate(lab_model))

        rx_schemas: List[PrescriptionItemSchema] = []
        for p in structured["prescription_items"]:
            rx_model = PrescriptionItem(
                id=p["id"],
                document_id=doc.id,
                medication_name=p["medication_name"],
                generic_name=p.get("generic_name"),
                strength=p.get("strength"),
                dosage=p.get("dosage"),
                frequency=p.get("frequency"),
                duration=p.get("duration"),
                route=p.get("route", "Oral"),
                special_instructions=p.get("special_instructions"),
                prescribing_doctor=p.get("prescribing_doctor"),
                page_number=p.get("page_number", 1),
                confidence=p.get("confidence", 1.0),
                requires_verification=p.get("requires_verification", False),
                user_corrected=False
            )
            db.add(rx_model)
            rx_schemas.append(PrescriptionItemSchema.model_validate(rx_model))

        for mf in structured.get("medical_fields", []):
            f_model = ExtractedMedicalField(
                id=mf["id"],
                document_id=doc.id,
                page_number=mf.get("page_number", 1),
                field_category=mf["field_category"],
                field_name=mf["field_name"],
                raw_value=mf["raw_value"],
                normalized_value=mf.get("normalized_value"),
                unit=mf.get("unit"),
                reference_range=mf.get("reference_range"),
                source_text=mf.get("source_text"),
                confidence=mf.get("confidence", 1.0),
                requires_verification=mf.get("requires_verification", False)
            )
            db.add(f_model)

        # Record Verification metrics
        v_info = ext_result.get("verification", {})
        ver_m = ExtractionVerification(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            total_pages=v_info.get("total_pages", doc.page_count),
            processed_pages=v_info.get("processed_pages", doc.page_count),
            failed_pages=v_info.get("failed_pages", []),
            uncertain_fields_count=structured.get("uncertain_fields_count", 0),
            verification_status=v_info.get("verification_status", "verified"),
            accuracy_score=v_info.get("accuracy_score", 1.0),
            notes=v_info.get("notes")
        )
        db.add(ver_m)
        db.commit()

        # --- STAGE 4: ANALYSIS ---
        job.current_stage = "analyzing"
        job.progress_percentage = 90
        doc.status = "analyzing"
        db.commit()

        analysis_dict = MedicalAnalysisEngine.generate_analysis(
            document_id=doc.id,
            category=doc.document_category,
            sub_category=doc.sub_classification,
            lab_results=lab_schemas,
            prescriptions=rx_schemas,
            raw_text=ext_result["raw_text"],
            facility=doc.issuing_facility,
            report_date=doc.report_date
        )

        # Clear existing analysis & sections
        existing_analysis = db.query(DocumentAnalysis).filter(DocumentAnalysis.document_id == doc.id).first()
        if existing_analysis:
            db.query(AnalysisSection).filter(AnalysisSection.analysis_id == existing_analysis.id).delete()
            db.delete(existing_analysis)
            db.commit()

        analysis_model = DocumentAnalysis(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            simple_summary=analysis_dict["simple_summary"],
            important_findings=analysis_dict["important_findings"],
            parameter_explanations=analysis_dict["parameter_explanations"],
            medical_terminology=analysis_dict["medical_terminology"],
            report_observations=analysis_dict["report_observations"],
            what_patient_should_understand=analysis_dict["what_patient_should_understand"],
            questions_for_doctor=analysis_dict["questions_for_doctor"],
            suggested_next_steps=analysis_dict["suggested_next_steps"],
            emergency_warning=analysis_dict["emergency_warning"],
            disclaimer=analysis_dict["disclaimer"],
            model_used=analysis_dict["model_used"]
        )
        db.add(analysis_model)
        db.commit()

        for sec in analysis_dict.get("sections", []):
            sec_m = AnalysisSection(
                id=str(uuid.uuid4()),
                analysis_id=analysis_model.id,
                section_index=sec["section_index"],
                section_type=sec["section_type"],
                title=sec["title"],
                content_text=sec["content_text"],
                structured_items=sec.get("structured_items"),
                source_citations=sec.get("source_citations")
            )
            db.add(sec_m)

        # Check if verification required
        requires_verification = (
            ext_result.get("uncertain_fields_count", 0) > 0 or
            any(l.requires_verification for l in lab_schemas) or
            any(p.requires_verification for p in rx_schemas) or
            len(v_info.get("failed_pages", [])) > 0
        )

        doc.status = "verification_required" if requires_verification else "completed"
        job.status = "completed"
        job.progress_percentage = 100
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        db.rollback()
        try:
            doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
            if doc:
                doc.status = "failed"
                doc.error_message = f"Pipeline error: {str(exc)}"
            job = db.query(DocumentProcessingJob).filter(DocumentProcessingJob.document_id == document_id).first()
            if job:
                job.status = "failed"
                job.error_details = str(exc)
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/upload", response_model=List[DocumentSummarySchema])
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form(None),
    patient_id: Optional[str] = Form(DEFAULT_PATIENT_ID),
    db: Session = Depends(get_db)
):
    """
    Upload one or multiple medical documents with secure validation and background processing.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for upload.")

    uploaded_docs: List[MedicalDocument] = []

    for file in files:
        file_bytes = await file.read()
        storage_meta = StorageService.save_uploaded_file(
            file_bytes=file_bytes,
            original_filename=file.filename or "uploaded_document",
            patient_id=patient_id or DEFAULT_PATIENT_ID
        )

        doc_category = category if category and category != "Auto-Detect" else "Other medical documents"
        doc = MedicalDocument(
            id=str(uuid.uuid4()),
            patient_id=patient_id or DEFAULT_PATIENT_ID,
            title=file.filename.rsplit(".", 1)[0] if file.filename else "Medical Document",
            original_filename=file.filename or "unknown",
            storage_path=storage_meta["stored_path"],
            file_size_bytes=storage_meta["file_size_bytes"],
            mime_type=storage_meta["mime_type"],
            file_hash=storage_meta["file_hash"],
            document_category=doc_category,
            status="queued"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        job = DocumentProcessingJob(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            current_stage="queued",
            status="in_progress",
            progress_percentage=5
        )
        db.add(job)
        db.commit()

        background_tasks.add_task(process_document_pipeline, doc.id)
        uploaded_docs.append(doc)

    return uploaded_docs


@router.get("", response_model=List[DocumentSummarySchema])
def list_documents(
    patient_id: str = Query(DEFAULT_PATIENT_ID),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List medical documents for a patient with filtering and search.
    """
    query = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id)

    if category and category != "All":
        query = query.filter(MedicalDocument.document_category == category)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (MedicalDocument.title.ilike(search_filter)) |
            (MedicalDocument.original_filename.ilike(search_filter)) |
            (MedicalDocument.issuing_facility.ilike(search_filter)) |
            (MedicalDocument.sub_classification.ilike(search_filter))
        )

    docs = query.order_by(MedicalDocument.created_at.desc()).all()
    return docs


@router.get("/{document_id}", response_model=DocumentDetailSchema)
def get_document_details(
    document_id: str,
    patient_id: str = Query(DEFAULT_PATIENT_ID),
    db: Session = Depends(get_db)
):
    """
    Get full document details, parameters, prescriptions, pages, and analysis.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    log = DocumentAccessLog(
        document_id=doc.id,
        patient_id=patient_id,
        accessor_id=patient_id,
        action="view"
    )
    db.add(log)
    db.commit()

    return doc


@router.get("/{document_id}/status")
def get_processing_status(document_id: str, db: Session = Depends(get_db)):
    """
    Get live processing status for polling UI during upload/analysis.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    job = (
        db.query(DocumentProcessingJob)
        .filter(DocumentProcessingJob.document_id == document_id)
        .order_by(DocumentProcessingJob.started_at.desc())
        .first()
    )

    return {
        "document_id": doc.id,
        "status": doc.status,
        "current_stage": job.current_stage if job else "queued",
        "progress_percentage": job.progress_percentage if job else 100,
        "error_message": doc.error_message
    }


@router.get("/{document_id}/extraction", response_model=ExtractedDataSchema)
def get_extracted_content(document_id: str, db: Session = Depends(get_db)):
    """
    Retrieve raw extracted text, tables, and structured entities.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    extracted = db.query(ExtractedMedicalData).filter(ExtractedMedicalData.document_id == document_id).first()
    if not extracted:
        raise HTTPException(status_code=404, detail="Extraction data not available yet.")

    pages_list = []
    for p in doc.pages:
        blocks_list = [ExtractedTextBlockSchema.model_validate(b) for b in p.blocks]
        tables_list = [ExtractedTableSchema.model_validate(t) for t in p.tables]
        pages_list.append(DocumentPageSchema(
            id=p.id,
            page_number=p.page_number,
            is_scanned=p.is_scanned,
            ocr_applied=p.ocr_applied,
            text_content=p.text_content,
            char_count=p.char_count,
            page_status=p.page_status,
            confidence=p.confidence,
            error_message=p.error_message,
            blocks=blocks_list,
            tables=tables_list
        ))

    tables_all = [ExtractedTableSchema.model_validate(t) for t in doc.tables]
    verification_schema = ExtractionVerificationSchema.model_validate(doc.verification) if doc.verification else None

    # Derive radiology or discharge summary schemas if applicable
    rad_schema = None
    if "radiology" in doc.document_category.lower() or "mri" in doc.document_category.lower() or "ct" in doc.document_category.lower():
        structured = MedicalStructurer.structure_document({"raw_text": extracted.raw_text}, doc.document_category)
        if structured.get("radiology_data"):
            rad_schema = RadiologyReportSchema.model_validate(structured["radiology_data"])

    dis_schema = None
    if "discharge" in doc.document_category.lower():
        structured = MedicalStructurer.structure_document({"raw_text": extracted.raw_text}, doc.document_category)
        if structured.get("discharge_summary_data"):
            dis_schema = DischargeSummarySchema.model_validate(structured["discharge_summary_data"])

    return ExtractedDataSchema(
        document_id=doc.id,
        raw_text=extracted.raw_text,
        page_count=doc.page_count,
        extraction_method=extracted.extraction_method,
        extraction_confidence=extracted.extraction_confidence,
        uncertain_fields_count=extracted.uncertain_fields_count,
        laboratory_results=[LaboratoryResultSchema.model_validate(r) for r in doc.laboratory_results],
        prescription_items=[PrescriptionItemSchema.model_validate(p) for p in doc.prescription_items],
        pages=pages_list,
        tables=tables_all,
        verification=verification_schema,
        radiology=rad_schema,
        discharge_summary=dis_schema
    )


@router.get("/{document_id}/pages", response_model=List[DocumentPageSchema])
def get_document_pages(document_id: str, db: Session = Depends(get_db)):
    """
    Get detailed page-by-page breakdown with text blocks and bounding box coordinates.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    pages_list = []
    for p in doc.pages:
        blocks_list = [ExtractedTextBlockSchema.model_validate(b) for b in p.blocks]
        tables_list = [ExtractedTableSchema.model_validate(t) for t in p.tables]
        pages_list.append(DocumentPageSchema(
            id=p.id,
            page_number=p.page_number,
            is_scanned=p.is_scanned,
            ocr_applied=p.ocr_applied,
            text_content=p.text_content,
            char_count=p.char_count,
            page_status=p.page_status,
            confidence=p.confidence,
            error_message=p.error_message,
            blocks=blocks_list,
            tables=tables_list
        ))
    return pages_list


@router.get("/{document_id}/text")
def get_document_full_text(document_id: str, db: Session = Depends(get_db)):
    """
    Download complete un-truncated raw extracted text.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    extracted = db.query(ExtractedMedicalData).filter(ExtractedMedicalData.document_id == document_id).first()
    raw_text = extracted.raw_text if extracted else "No extracted text available."

    return PlainTextResponse(
        content=raw_text,
        headers={"Content-Disposition": f"attachment; filename={doc.title}_extracted_text.txt"}
    )


@router.get("/{document_id}/analysis", response_model=DocumentAnalysisSchema)
def get_document_analysis(
    document_id: str,
    language: str = Query("en", description="Language code: en, te, hi, ta, kn, ml"),
    db: Session = Depends(get_db)
):
    """
    Retrieve patient-friendly AI analysis and clinical explanations across 10 sections.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    analysis = db.query(DocumentAnalysis).filter(DocumentAnalysis.document_id == document_id).first()
    if not analysis or language != "en":
        # Compute analysis
        lab_schemas = [LaboratoryResultSchema.model_validate(r) for r in doc.laboratory_results]
        rx_schemas = [PrescriptionItemSchema.model_validate(p) for p in doc.prescription_items]
        ext = db.query(ExtractedMedicalData).filter(ExtractedMedicalData.document_id == document_id).first()
        raw_text = ext.raw_text if ext else ""

        analysis_dict = MedicalAnalysisEngine.generate_analysis(
            document_id=doc.id,
            category=doc.document_category,
            sub_category=doc.sub_classification,
            lab_results=lab_schemas,
            prescriptions=rx_schemas,
            raw_text=raw_text,
            facility=doc.issuing_facility,
            report_date=doc.report_date,
            language=language
        )
        return DocumentAnalysisSchema(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            simple_summary=analysis_dict["simple_summary"],
            important_findings=analysis_dict["important_findings"],
            parameter_explanations=analysis_dict["parameter_explanations"],
            medical_terminology=analysis_dict["medical_terminology"],
            report_observations=analysis_dict["report_observations"],
            what_patient_should_understand=analysis_dict["what_patient_should_understand"],
            questions_for_doctor=analysis_dict["questions_for_doctor"],
            suggested_next_steps=analysis_dict["suggested_next_steps"],
            emergency_warning=analysis_dict["emergency_warning"],
            disclaimer=analysis_dict["disclaimer"],
            language=language,
            model_used=analysis_dict["model_used"],
            created_at=datetime.utcnow()
        )

    return analysis


@router.post("/{document_id}/qa", response_model=DocumentQAResponse)
def ask_question_about_document(
    document_id: str,
    request: DocumentQARequest,
    db: Session = Depends(get_db)
):
    """
    Interactive Document-Grounded Q&A:
    Answers patient questions strictly grounded in the extracted text with page citations.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    extracted = db.query(ExtractedMedicalData).filter(ExtractedMedicalData.document_id == document_id).first()
    raw_text = extracted.raw_text if extracted else ""

    lab_schemas = [LaboratoryResultSchema.model_validate(r) for r in doc.laboratory_results]
    rx_schemas = [PrescriptionItemSchema.model_validate(p) for p in doc.prescription_items]

    pages_data = []
    for p in doc.pages:
        pages_data.append({
            "page_number": p.page_number,
            "text": p.text_content,
            "text_content": p.text_content
        })

    qa_result = ConversationalQAEngine.answer_question(
        question=request.question,
        raw_text=raw_text,
        lab_results=lab_schemas,
        prescriptions=rx_schemas,
        pages=pages_data,
        category=doc.document_category,
        demographics=doc.demographics_json or {
            "patient_name": doc.patient_name_in_doc,
            "patient_age_value": doc.patient_age_value,
            "patient_age_unit": doc.patient_age_unit,
            "patient_gender": doc.patient_gender,
            "patient_dob": doc.patient_dob,
            "patient_uhid": doc.patient_uhid,
            "issuing_facility": doc.issuing_facility,
            "report_date": doc.report_date
        },
        conversation_history=request.conversation_history or [],
        facility=doc.issuing_facility,
        report_date=doc.report_date
    )

    # Persist conversation turn in database
    try:
        user_msg = DocumentQAMessage(
            document_id=doc.id,
            patient_id=doc.patient_id,
            sender="user",
            message_text=request.question,
            intent=qa_result.get("intent"),
            confidence=1.0
        )
        ai_msg = DocumentQAMessage(
            document_id=doc.id,
            patient_id=doc.patient_id,
            sender="assistant",
            message_text=qa_result["answer"],
            intent=qa_result.get("intent"),
            citations=qa_result.get("source_citations"),
            confidence=qa_result.get("confidence", 1.0)
        )
        db.add(user_msg)
        db.add(ai_msg)
        db.commit()
    except Exception:
        pass

    return DocumentQAResponse(
        question=qa_result["question"],
        answer=qa_result["answer"],
        intent=qa_result.get("intent"),
        source_citations=qa_result["source_citations"],
        confidence=qa_result["confidence"],
        found_in_document=qa_result["found_in_document"],
        suggested_followups=qa_result.get("suggested_followups", []),
        recommended_specialties=qa_result.get("recommended_specialties", [])
    )


@router.get("/{document_id}/qa/history")
def get_qa_history(document_id: str, db: Session = Depends(get_db)):
    """
    Retrieve conversation history for a specific document and patient.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    messages = (
        db.query(DocumentQAMessage)
        .filter(DocumentQAMessage.document_id == document_id)
        .order_by(DocumentQAMessage.created_at.asc())
        .all()
    )

    return [
        {
            "id": m.id,
            "sender": m.sender,
            "message_text": m.message_text,
            "intent": m.intent,
            "citations": m.citations,
            "created_at": m.created_at.isoformat() if m.created_at else None
        }
        for m in messages
    ]


@router.get("/{document_id}/recommended-doctors", response_model=DoctorRecommendationResponse)
def get_recommended_doctors(document_id: str, db: Session = Depends(get_db)):
    """
    Intelligent Doctor Recommendation:
    Maps report abnormalities, biomarkers, and findings to suitable medical specialties
    and retrieves matching verified doctors from the platform database with clear clinical rationales.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    lab_schemas = [LaboratoryResultSchema.model_validate(r) for r in doc.laboratory_results]
    rx_schemas = [PrescriptionItemSchema.model_validate(p) for p in doc.prescription_items]

    rec = DoctorRecommender.recommend_for_document(
        document_id=doc.id,
        category=doc.document_category,
        lab_results=lab_schemas,
        prescriptions=rx_schemas,
        db_session=db
    )

    return DoctorRecommendationResponse(
        document_id=rec["document_id"],
        findings_summary=rec["findings_summary"],
        primary_specialty=rec["primary_specialty"],
        secondary_specialties=rec["secondary_specialties"],
        clinical_rationale=rec["clinical_rationale"],
        recommended_doctors=[RecommendedDoctorSchema.model_validate(d) for d in rec["recommended_doctors"]],
        urgent_care_needed=rec["urgent_care_needed"],
        urgent_warning=rec["urgent_warning"]
    )


@router.post("/{document_id}/analyze", response_model=DocumentAnalysisSchema)
def trigger_analysis(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Manually trigger or refresh analysis for a document.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    process_document_pipeline(document_id)
    return get_document_analysis(document_id, "en", db)


@router.post("/{document_id}/corrections", response_model=DocumentCorrectionResponse)
def submit_correction(
    document_id: str,
    correction: DocumentCorrectionRequest,
    patient_id: str = Query(DEFAULT_PATIENT_ID),
    db: Session = Depends(get_db)
):
    """
    Audit-logged correction by patient or doctor for an extracted parameter or metadata.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    orig_value = None

    if correction.field_type == "lab_result" and correction.target_id:
        lab = db.query(LaboratoryResult).filter(LaboratoryResult.id == correction.target_id).first()
        if lab:
            orig_value = getattr(lab, correction.field_name, None)
            setattr(lab, correction.field_name, correction.corrected_value)
            lab.user_corrected = True
            lab.requires_verification = False
            if correction.field_name == "result_value":
                try:
                    num_val = float(correction.corrected_value)
                    lab.numeric_value = num_val
                    if lab.ref_low is not None and num_val < lab.ref_low:
                        lab.flag = "low"
                    elif lab.ref_high is not None and num_val > lab.ref_high:
                        lab.flag = "high"
                    elif lab.ref_low is not None and lab.ref_high is not None:
                        lab.flag = "normal"
                except ValueError:
                    pass

    elif correction.field_type == "prescription" and correction.target_id:
        rx = db.query(PrescriptionItem).filter(PrescriptionItem.id == correction.target_id).first()
        if rx:
            orig_value = getattr(rx, correction.field_name, None)
            setattr(rx, correction.field_name, correction.corrected_value)
            rx.user_corrected = True
            rx.requires_verification = False

    elif correction.field_type == "category":
        orig_value = doc.document_category
        doc.document_category = correction.corrected_value

    elif correction.field_type == "metadata":
        orig_value = getattr(doc, correction.field_name, None)
        setattr(doc, correction.field_name, correction.corrected_value)

    audit_rec = DocumentCorrection(
        document_id=doc.id,
        patient_id=patient_id,
        field_type=correction.field_type,
        target_id=correction.target_id,
        field_name=correction.field_name,
        original_value=str(orig_value) if orig_value is not None else None,
        corrected_value=correction.corrected_value,
        reason=correction.reason
    )
    db.add(audit_rec)
    db.commit()
    db.refresh(audit_rec)

    return DocumentCorrectionResponse(
        id=audit_rec.id,
        document_id=doc.id,
        field_name=audit_rec.field_name,
        original_value=audit_rec.original_value,
        corrected_value=audit_rec.corrected_value,
        created_at=audit_rec.created_at
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    patient_id: str = Query(DEFAULT_PATIENT_ID),
    db: Session = Depends(get_db)
):
    """
    Securely download original uploaded medical document.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    if not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="Stored document file not found on disk.")

    log = DocumentAccessLog(
        document_id=doc.id,
        patient_id=patient_id,
        accessor_id=patient_id,
        action="download"
    )
    db.add(log)
    db.commit()

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.original_filename
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    patient_id: str = Query(DEFAULT_PATIENT_ID),
    db: Session = Depends(get_db)
):
    """
    Delete document, associated extracted data, analyses, and storage file.
    """
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found.")

    StorageService.delete_file(doc.storage_path)

    db.delete(doc)
    db.commit()

    return {"message": "Document and associated health records deleted successfully."}


@router.post("/compare", response_model=ReportComparisonResponse)
def compare_reports(
    request: ReportComparisonRequest,
    db: Session = Depends(get_db)
):
    """
    Multi-report comparison comparing laboratory parameters across multiple dates.
    """
    if len(request.document_ids) < 1:
        raise HTTPException(status_code=400, detail="At least one document ID required for comparison.")

    docs = db.query(MedicalDocument).filter(MedicalDocument.id.in_(request.document_ids)).all()
    if not docs:
        raise HTTPException(status_code=404, detail="None of the specified documents were found.")

    return ReportComparator.compare_documents(docs)
