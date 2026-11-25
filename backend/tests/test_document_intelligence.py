"""
Automated Test Suite for Medical Document Intelligence System
Tests:
1. Document upload and MIME / magic bytes verification
2. Hybrid extraction on synthetic medical documents
3. Medical classification into diagnostic categories
4. Structured parameter and prescription parsing
5. Patient-friendly clinical explanations and safety guardrails
6. Multi-report comparison & longitudinal trend calculation
7. Audit correction flow
"""

import os
import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.extractor import DocumentExtractor
from backend.app.services.classifier import DocumentClassifier
from backend.app.services.structurer import MedicalStructurer
from backend.app.services.analysis_engine import MedicalAnalysisEngine
from backend.app.services.comparator import ReportComparator
from backend.app.db.models import MedicalDocument, LaboratoryResult
from datetime import datetime

client = TestClient(app)

SAMPLE_CBC_REPORT = """
METROPOLITAN DIAGNOSTIC LABORATORIES
Patient Name: John Doe
Date: 2024-03-15
Specimen: Whole Blood EDTA

COMPLETE BLOOD COUNT (CBC)
Parameter                  Result     Unit       Reference Range
Hemoglobin                 14.2       g/dL       13.0 - 17.0      Normal
RBC Count                  4.85       mil/uL     4.50 - 5.90      Normal
WBC Count                  11.8       thou/uL    4.0 - 10.5       High
Platelets                  245        thou/uL    150 - 450        Normal
Hematocrit                 42.5       %          40.0 - 52.0      Normal
MCV                        88.0       fL         80.0 - 100.0     Normal
MCH                        29.3       pg         27.0 - 33.0      Normal
"""

SAMPLE_LIPID_REPORT = """
APEX HEART & HEALTH INSTITUTE
Patient Name: John Doe
Report Date: 2024-06-20
Specimen: Fasting Serum

LIPID PANEL
Parameter                  Result     Unit       Reference Range
Total Cholesterol          228        mg/dL      < 200            High
HDL Cholesterol            42         mg/dL      > 40             Normal
LDL Cholesterol            154        mg/dL      < 100            High
Triglycerides              160        mg/dL      < 150            High
Fasting Blood Sugar        104        mg/dL      70 - 99          High
"""

SAMPLE_PRESCRIPTION = """
ST. JUDE WELLNESS CLINIC
Dr. Sarah Jenkins, MD (Cardiology)
Rx for: John Doe
Date: 2024-06-22

1. Atorvastatin 20 mg - 1 tablet once daily at bedtime for 90 days.
2. Metformin 500 mg - 1 tablet twice daily with meals for 30 days.
3. Vitamin D3 60,000 IU - 1 capsule once weekly for 8 weeks.
"""


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_classifier():
    # Test CBC
    cbc_res = DocumentClassifier.classify(SAMPLE_CBC_REPORT, "cbc_report.txt")
    assert cbc_res["category"] == "Blood test reports"
    assert "complete blood count" in cbc_res["sub_classification"].lower()
    assert cbc_res["issuing_facility"] == "METROPOLITAN DIAGNOSTIC LABORATORIES"

    # Test Lipid
    lipid_res = DocumentClassifier.classify(SAMPLE_LIPID_REPORT, "lipid_panel.txt")
    assert lipid_res["category"] == "Blood test reports"
    assert "lipid profile" in lipid_res["sub_classification"].lower()

    # Test Prescription
    rx_res = DocumentClassifier.classify(SAMPLE_PRESCRIPTION, "rx_june.txt")
    assert rx_res["category"] == "Prescriptions"


def test_structurer_cbc():
    res = MedicalStructurer.structure_medical_text(SAMPLE_CBC_REPORT, [], "Blood test reports")
    labs = res["laboratory_results"]
    assert len(labs) >= 5

    hgb = next((l for l in labs if "hemoglobin" in l["normalized_name"]), None)
    assert hgb is not None
    assert hgb["numeric_value"] == 14.2
    assert hgb["flag"] == "normal"

    wbc = next((l for l in labs if "wbc" in l["normalized_name"]), None)
    assert wbc is not None
    assert wbc["numeric_value"] == 11.8
    assert wbc["flag"] == "high"


def test_structurer_prescriptions():
    res = MedicalStructurer.structure_medical_text(SAMPLE_PRESCRIPTION, [], "Prescriptions")
    rxs = res["prescription_items"]
    assert len(rxs) >= 2
    med_names = [m["medication_name"].lower() for m in rxs]
    assert any("atorvastatin" in m for m in med_names)
    assert any("metformin" in m for m in med_names)


def test_analysis_engine():
    structured = MedicalStructurer.structure_medical_text(SAMPLE_LIPID_REPORT, [], "Blood test reports")
    from backend.app.schemas.document import LaboratoryResultSchema
    labs = [LaboratoryResultSchema.model_validate(l) for l in structured["laboratory_results"]]
    
    analysis = MedicalAnalysisEngine.generate_analysis(
        document_id="test-doc-1",
        category="Blood test reports",
        sub_category="Lipid Profile",
        lab_results=labs,
        prescriptions=[],
        raw_text=SAMPLE_LIPID_REPORT,
        facility="APEX HEART & HEALTH INSTITUTE",
        report_date="2024-06-20"
    )

    assert analysis["simple_summary"] is not None
    assert len(analysis["important_findings"]) > 0
    assert len(analysis["parameter_explanations"]) > 0
    assert len(analysis["questions_for_doctor"]) > 0
    assert "Medical Disclaimer:" in analysis["disclaimer"]


def test_multi_report_comparison():
    doc1 = MedicalDocument(
        id="doc-1",
        patient_id="p1",
        title="Lipid Baseline Jan",
        original_filename="lipid_jan.txt",
        storage_path="/tmp/fake1",
        file_size_bytes=100,
        mime_type="text/plain",
        file_hash="hash1",
        document_category="Blood test reports",
        report_date="2024-01-10",
        created_at=datetime(2024, 1, 10),
        status="completed"
    )
    doc1.laboratory_results = [
        LaboratoryResult(
            id="l1",
            document_id="doc-1",
            parameter_name="Total Cholesterol",
            normalized_name="total cholesterol",
            result_value="240",
            numeric_value=240.0,
            unit="mg/dL",
            reference_range="< 200",
            flag="high"
        ),
        LaboratoryResult(
            id="l2",
            document_id="doc-1",
            parameter_name="LDL Cholesterol",
            normalized_name="ldl cholesterol",
            result_value="165",
            numeric_value=165.0,
            unit="mg/dL",
            reference_range="< 100",
            flag="high"
        )
    ]

    doc2 = MedicalDocument(
        id="doc-2",
        patient_id="p1",
        title="Lipid Followup Jun",
        original_filename="lipid_jun.txt",
        storage_path="/tmp/fake2",
        file_size_bytes=100,
        mime_type="text/plain",
        file_hash="hash2",
        document_category="Blood test reports",
        report_date="2024-06-20",
        created_at=datetime(2024, 6, 20),
        status="completed"
    )
    doc2.laboratory_results = [
        LaboratoryResult(
            id="l3",
            document_id="doc-2",
            parameter_name="Total Cholesterol",
            normalized_name="total cholesterol",
            result_value="210",
            numeric_value=210.0,
            unit="mg/dL",
            reference_range="< 200",
            flag="high"
        ),
        LaboratoryResult(
            id="l4",
            document_id="doc-2",
            parameter_name="LDL Cholesterol",
            normalized_name="ldl cholesterol",
            result_value="135",
            numeric_value=135.0,
            unit="mg/dL",
            reference_range="< 100",
            flag="high"
        )
    ]

    comparison = ReportComparator.compare_documents([doc1, doc2])
    assert len(comparison.matching_parameters) >= 2
    chol_trend = next(p for p in comparison.matching_parameters if p.normalized_name == "total cholesterol")
    assert chol_trend.trend_direction == "decreasing"
    assert "Decreased" in chol_trend.clinical_note


def test_api_upload_and_pipeline_lifecycle():
    # Test uploading a synthetic CBC report via FastAPI endpoint
    file_content = SAMPLE_CBC_REPORT.encode("utf-8")
    response = client.post(
        "/api/v1/medical-documents/upload",
        files=[("files", ("cbc_sample.txt", io.BytesIO(file_content), "text/plain"))],
        data={"category": "Auto-Detect"}
    )
    assert response.status_code == 200
    docs = response.json()
    assert len(docs) == 1
    doc_id = docs[0]["id"]

    # Verify pipeline execution
    from backend.app.api.v1.medical_documents import process_document_pipeline
    process_document_pipeline(doc_id)

    # Check status endpoint
    status_resp = client.get(f"/api/v1/medical-documents/{doc_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] in ["completed", "verification_required"]

    # Check document details
    detail_resp = client.get(f"/api/v1/medical-documents/{doc_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert len(data["laboratory_results"]) >= 4

    # Check analysis endpoint
    analysis_resp = client.get(f"/api/v1/medical-documents/{doc_id}/analysis")
    assert analysis_resp.status_code == 200
    analysis = analysis_resp.json()
    assert "Discharge" not in analysis["simple_summary"]
    assert len(analysis["important_findings"]) > 0

    # Test audit correction endpoint
    first_lab_id = data["laboratory_results"][0]["id"]
    corr_resp = client.post(
        f"/api/v1/medical-documents/{doc_id}/corrections",
        json={
            "field_type": "lab_result",
            "target_id": first_lab_id,
            "field_name": "result_value",
            "corrected_value": "14.5",
            "reason": "Corrected by patient"
        }
    )
    assert corr_resp.status_code == 200
    assert corr_resp.json()["corrected_value"] == "14.5"

    # Test pages endpoint
    pages_resp = client.get(f"/api/v1/medical-documents/{doc_id}/pages")
    assert pages_resp.status_code == 200
    pages_data = pages_resp.json()
    assert len(pages_data) >= 1
    assert "blocks" in pages_data[0]

    # Test full text download endpoint
    text_resp = client.get(f"/api/v1/medical-documents/{doc_id}/text")
    assert text_resp.status_code == 200
    assert "COMPLETE BLOOD COUNT" in text_resp.text

    # Test Document Q&A endpoint
    qa_resp = client.post(
        f"/api/v1/medical-documents/{doc_id}/qa",
        json={"question": "What is my Hemoglobin level and is it normal?"}
    )
    assert qa_resp.status_code == 200
    qa_data = qa_resp.json()
    assert "answer" in qa_data
    assert "14.2" in qa_data["answer"] or "Hemoglobin" in qa_data["answer"]
    assert "source_citations" in qa_data

    # Test Multilingual analysis endpoint (Telugu translation)
    te_analysis_resp = client.get(f"/api/v1/medical-documents/{doc_id}/analysis?language=te")
    assert te_analysis_resp.status_code == 200
    te_analysis = te_analysis_resp.json()
    assert te_analysis["language"] == "te"


def test_handwriting_uncertainty_guardrails():
    # Prescriptions with ambiguous/messy dosage or unreadable tokens
    messy_prescription = """
    CITY HEALTH DISPENSARY
    Dr. Rao, MBBS
    Patient: Jane Smith   Date: 2024-05-10
    
    1. Metoprolol 25mg 1 tab daily
    2. ~~~ illegible ~~~ 10mg ??? once daily
    3. Amoxicillin dosage unclear [scratched out]
    """
    structured = MedicalStructurer.structure_medical_text(messy_prescription, [], "Prescriptions")
    items = structured["prescription_items"]
    # Verify that an item with unclear/scratched dosage is flagged for verification
    unclear_items = [it for it in items if it.get("requires_verification") or "unclear" in it.get("dosage", "").lower() or "unclear" in it.get("medication_name", "").lower()]
    assert len(unclear_items) >= 1
    # Check that it never hallucinates a real dose when marked unclear
    for it in unclear_items:
        if it.get("requires_verification"):
            assert it["confidence"] < 0.8


# =====================================================================
# UPGRADED TEST SUITE: DYNAMIC Q&A, DEMOGRAPHICS & DOCTOR RECOMMENDATIONS
# =====================================================================

from backend.app.services.demographic_extractor import DemographicExtractor
from backend.app.services.qa_engine import ConversationalQAEngine
from backend.app.services.doctor_recommender import DoctorRecommender
from backend.app.services.medical_ontology import MedicalOntology
from backend.app.schemas.document import LaboratoryResultSchema, PrescriptionItemSchema
from backend.app.db.database import SessionLocal
from backend.app.db.models import DoctorProfile


def test_dynamic_question_answering():
    """
    Test that the conversational AI engine answers natural questions dynamically
    grounded in the document, avoiding static/hardcoded responses.
    """
    labs = [
        LaboratoryResultSchema(
            id="lab-1",
            document_id="doc-test",
            parameter_name="Hemoglobin",
            normalized_name="hemoglobin",
            result_value="14.2",
            numeric_value=14.2,
            unit="g/dL",
            reference_range="13.0 - 17.0",
            flag="normal",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Blood / Hematology"
        ),
        LaboratoryResultSchema(
            id="lab-2",
            document_id="doc-test",
            parameter_name="WBC Count",
            normalized_name="wbc count",
            result_value="11.8",
            numeric_value=11.8,
            unit="thou/uL",
            reference_range="4.0 - 10.5",
            flag="high",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Immune / Hematology"
        ),
        LaboratoryResultSchema(
            id="lab-3",
            document_id="doc-test",
            parameter_name="Platelet Count",
            normalized_name="platelet count",
            result_value="245",
            numeric_value=245.0,
            unit="thou/uL",
            reference_range="150 - 450",
            flag="normal",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Blood / Hematology"
        )
    ]
    raw_text = SAMPLE_CBC_REPORT
    pages = [{"page_number": 1, "text": raw_text}]
    category = "Blood test reports"
    demographics = {
        "patient_name": "John Doe",
        "age_display": "35 Years",
        "gender": "Male"
    }

    # 1. "What is my report about?"
    resp1 = ConversationalQAEngine.answer_question(
        question="What is my report about?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category=category,
        demographics=demographics
    )
    assert resp1["intent"].lower() == "report_overview"
    assert "routine parameters were evaluated. If a specific biomarker" not in resp1["answer"]
    assert "blood" in resp1["answer"].lower() or "cbc" in resp1["answer"].lower()
    assert len(resp1["source_citations"]) > 0

    # 2. "What are the insights from my report?"
    resp2 = ConversationalQAEngine.answer_question(
        question="What are the insights from my report?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category=category,
        demographics=demographics
    )
    assert resp2["intent"].lower() in ["key_insights", "insights_summary"]
    assert "11.8" in resp2["answer"] or "wbc" in resp2["answer"].lower()

    # 3. "Which parameters are abnormal?"
    resp3 = ConversationalQAEngine.answer_question(
        question="Which parameters are abnormal?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category=category,
        demographics=demographics
    )
    assert resp3["intent"].lower() in ["abnormalities_check", "abnormal_findings"]
    assert "wbc" in resp3["answer"].lower()
    assert "11.8" in resp3["answer"]

    # 4. "Why is my WBC high?"
    resp4 = ConversationalQAEngine.answer_question(
        question="Why is my WBC high?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category=category,
        demographics=demographics
    )
    assert resp4["intent"].lower() == "parameter_inquiry"
    assert "wbc" in resp4["answer"].lower() or "white blood" in resp4["answer"].lower()
    assert "infection" in resp4["answer"].lower() or "inflammation" in resp4["answer"].lower() or "immune" in resp4["answer"].lower()

    # 5. "Which specialist should I consult?"
    resp5 = ConversationalQAEngine.answer_question(
        question="Which specialist should I consult?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category=category,
        demographics=demographics
    )
    assert resp5["intent"].lower() == "specialist_recommendation"
    assert "physician" in resp5["answer"].lower() or "hematologist" in resp5["answer"].lower()
    assert len(resp5["recommended_specialties"]) > 0


def test_synonym_and_abbreviation_resolution():
    """
    Test that clinical synonyms and abbreviations resolve to the right entities.
    """
    labs = [
        LaboratoryResultSchema(
            id="lab-1",
            document_id="doc-test",
            parameter_name="Hemoglobin",
            normalized_name="hemoglobin",
            result_value="14.2",
            numeric_value=14.2,
            unit="g/dL",
            reference_range="13.0 - 17.0",
            flag="normal",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Blood / Hematology"
        )
    ]
    raw_text = SAMPLE_CBC_REPORT
    pages = [{"page_number": 1, "text": raw_text}]

    # Query with abbreviation "Hb"
    resp_hb = ConversationalQAEngine.answer_question(
        question="What is my Hb level?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports"
    )
    assert "14.2" in resp_hb["answer"]
    assert "hemoglobin" in resp_hb["answer"].lower()

    # Query with alternative phrase "hemoglobin value"
    resp_hgb = ConversationalQAEngine.answer_question(
        question="Tell me my hemoglobin value",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports"
    )
    assert "14.2" in resp_hgb["answer"]
    assert "normal" in resp_hgb["answer"].lower() or "within" in resp_hgb["answer"].lower() or "reference interval" in resp_hgb["answer"].lower()

    # Test ontology direct synonym check
    assert MedicalOntology.resolve_term("hb")["canonical_name"] == "Hemoglobin"
    assert "leukocyte" in MedicalOntology.resolve_term("tlc")["canonical_name"].lower() or "white blood" in MedicalOntology.resolve_term("tlc")["canonical_name"].lower()
    assert "alt" in MedicalOntology.resolve_term("sgpt")["canonical_name"].lower() or "sgpt" in MedicalOntology.resolve_term("sgpt")["canonical_name"].lower()
    assert "fasting blood sugar" in MedicalOntology.resolve_term("fbs")["canonical_name"].lower()


def test_conversational_follow_up():
    """
    Test multi-turn context awareness and anaphoric reference resolution.
    Turn 1: "What is abnormal?"
    Turn 2: "Why could that happen?"
    Turn 3: "Is it serious?"
    Turn 4: "Should I see a doctor?"
    Turn 5: "Which specialist?"
    """
    labs = [
        LaboratoryResultSchema(
            id="lab-2",
            document_id="doc-test",
            parameter_name="WBC Count",
            normalized_name="wbc count",
            result_value="11.8",
            numeric_value=11.8,
            unit="thou/uL",
            reference_range="4.0 - 10.5",
            flag="high",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Immune / Hematology"
        )
    ]
    raw_text = SAMPLE_CBC_REPORT
    pages = [{"page_number": 1, "text": raw_text}]
    history = []

    # Turn 1
    t1 = ConversationalQAEngine.answer_question(
        question="What is abnormal?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports",
        conversation_history=history
    )
    assert "wbc" in t1["answer"].lower()
    history.append({"sender": "patient", "text": "What is abnormal?"})
    history.append({"sender": "ai", "text": t1["answer"]})

    # Turn 2: "Why could that happen?" (refers to high WBC from Turn 1)
    t2 = ConversationalQAEngine.answer_question(
        question="Why could that happen?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports",
        conversation_history=history
    )
    assert "wbc" in t2["answer"].lower() or "white blood" in t2["answer"].lower()
    assert "infection" in t2["answer"].lower() or "inflammation" in t2["answer"].lower()
    history.append({"sender": "patient", "text": "Why could that happen?"})
    history.append({"sender": "ai", "text": t2["answer"]})

    # Turn 3: "Is it serious?"
    t3 = ConversationalQAEngine.answer_question(
        question="Is it serious?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports",
        conversation_history=history
    )
    assert "11.8" in t3["answer"] or "wbc" in t3["answer"].lower()
    history.append({"sender": "patient", "text": "Is it serious?"})
    history.append({"sender": "ai", "text": t3["answer"]})

    # Turn 4: "Should I see a doctor?"
    t4 = ConversationalQAEngine.answer_question(
        question="Should I see a doctor?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports",
        conversation_history=history
    )
    assert "doctor" in t4["answer"].lower() or "physician" in t4["answer"].lower() or "consult" in t4["answer"].lower()
    history.append({"sender": "patient", "text": "Should I see a doctor?"})
    history.append({"sender": "ai", "text": t4["answer"]})

    # Turn 5: "Which specialist?"
    t5 = ConversationalQAEngine.answer_question(
        question="Which specialist?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports",
        conversation_history=history
    )
    assert "physician" in t5["answer"].lower() or "hematologist" in t5["answer"].lower()


def test_semantic_demographic_extraction():
    """
    Test semantic demographic extraction across diverse hospital layouts:
    - Document A: Standard label format
    - Document B: Combined Age/Sex format (22 Y / F)
    - Document C: DOB with report date
    - Document D: Pediatric age in months (8 Months)
    """
    # Document A
    doc_a = """
    CITY CARE PATHOLOGY LABORATORY
    Patient Name: Ananya Rao
    Age: 22 Years
    Sex: Female
    UHID: UHID-99214
    Ref By: Dr. K. Sharma
    Sample Collection: 10/05/2026
    Specimen: Whole Blood EDTA
    """
    demo_a = DemographicExtractor.extract_demographics(doc_a)
    assert demo_a["patient_name"] == "Ananya Rao"
    assert demo_a["age_value"] == 22
    assert demo_a["age_unit"] == "Years"
    assert demo_a["gender"] == "Female"
    assert demo_a["uhid"] == "UHID-99214"
    assert demo_a["referring_doctor"] == "Dr. K. Sharma"
    assert demo_a["specimen_type"] == "Whole Blood EDTA"

    # Document B
    doc_b = """
    METROPOLIS DIAGNOSTIC SERVICES
    Name of Patient: Ananya Rao
    Age/Sex: 22 Y / F
    Collection Date: 12/05/2026
    """
    demo_b = DemographicExtractor.extract_demographics(doc_b)
    assert demo_b["patient_name"] == "Ananya Rao"
    assert demo_b["age_value"] == 22
    assert demo_b["age_unit"] == "Years"
    assert demo_b["gender"] == "Female"

    # Document C (DOB provided, age calculated)
    doc_c = """
    APEX SUPER SPECIALTY HOSPITAL
    Patient: Ananya Rao
    DOB: 15-06-2004
    Report Date: 20-11-2026
    Gender: Female
    """
    demo_c = DemographicExtractor.extract_demographics(doc_c)
    assert demo_c["patient_name"] == "Ananya Rao"
    assert demo_c["dob"] == "15-06-2004"
    assert demo_c["age_value"] == 22

    # Document D (Pediatric age in months)
    doc_d = """
    LITTLE ANGELS PEDIATRIC CLINIC
    Patient Details
    Name: Ananya Rao
    Age: 8 Months
    Sex: Female
    """
    demo_d = DemographicExtractor.extract_demographics(doc_d)
    assert demo_d["patient_name"] == "Ananya Rao"
    assert demo_d["age_value"] == 8
    assert demo_d["age_unit"] == "Months"
    assert demo_d["gender"] == "Female"


def test_doctor_recommendations():
    """
    Test clinical specialty mapping and doctor profile querying for findings.
    """
    # 1. High TSH -> Endocrinologist
    thyroid_labs = [
        LaboratoryResultSchema(
            id="t1",
            document_id="doc-t",
            parameter_name="TSH",
            normalized_name="tsh",
            result_value="7.8",
            numeric_value=7.8,
            unit="uIU/mL",
            reference_range="0.4 - 4.5",
            flag="high",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Endocrine / Thyroid"
        )
    ]
    specialties = DoctorRecommender.get_recommended_specialties_for_labs(thyroid_labs)
    assert "Endocrinologist" in specialties

    # 2. High Total Cholesterol & LDL -> Cardiologist
    lipid_labs = [
        LaboratoryResultSchema(
            id="l1",
            document_id="doc-l",
            parameter_name="Total Cholesterol",
            normalized_name="total cholesterol",
            result_value="240",
            numeric_value=240.0,
            unit="mg/dL",
            reference_range="< 200",
            flag="high",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Cardiovascular / Lipid"
        )
    ]
    specialties_lipid = DoctorRecommender.get_recommended_specialties_for_labs(lipid_labs)
    assert "Cardiologist" in specialties_lipid

    # 3. High Creatinine -> Nephrologist
    renal_labs = [
        LaboratoryResultSchema(
            id="r1",
            document_id="doc-r",
            parameter_name="Serum Creatinine",
            normalized_name="serum creatinine",
            result_value="2.2",
            numeric_value=2.2,
            unit="mg/dL",
            reference_range="0.6 - 1.2",
            flag="high",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Renal / Kidney"
        )
    ]
    specialties_renal = DoctorRecommender.get_recommended_specialties_for_labs(renal_labs)
    assert "Nephrologist" in specialties_renal

    # 4. Verified doctors query with DB session
    db = SessionLocal()
    try:
        rec_data = DoctorRecommender.recommend_specialties_for_document(
            db=db,
            document_id="doc-test-1",
            lab_results=thyroid_labs,
            prescriptions=[],
            category="Blood test reports"
        )
        assert len(rec_data["recommended_specialties"]) > 0
        assert "Endocrinologist" in rec_data["recommended_specialties"]
        assert len(rec_data["doctors"]) > 0
        assert any(d["specialty"] == "Endocrinologist" for d in rec_data["doctors"])
        assert any(d["is_verified"] for d in rec_data["doctors"])
    finally:
        db.close()


def test_missing_demographics_guardrail():
    """
    Test zero-fabrication safety guarantee: when no patient name or age is present,
    the system must return None / 'Not available in document' and NEVER invent
    names like 'Aditya Vardhan'.
    """
    anonymous_report = """
    BIOCHEMISTRY LABORATORY REPORT
    Sample ID: #883921
    Date: 2024-05-12

    Parameter           Result     Unit    Reference
    Blood Glucose       95         mg/dL   70 - 100
    Serum Urea          24         mg/dL   15 - 40
    """
    demographics = DemographicExtractor.extract_demographics(anonymous_report)
    assert demographics["patient_name"] is None
    assert demographics["age_value"] is None
    assert demographics["gender"] is None
    assert demographics["patient_name"] != "Aditya Vardhan"

    # Also test classifier doesn't invent a name
    cls_res = DocumentClassifier.classify(anonymous_report, "lab.txt")
    assert cls_res["patient_name"] is None
    assert cls_res["patient_name"] != "Aditya Vardhan"


def test_unsupported_questions():
    """
    Test that when a user asks about a parameter NOT in the document (e.g. Vitamin B12 in a CBC report),
    the system explicitly states that it is not found in the uploaded document rather than
    hallucinating or inventing values.
    """
    labs = [
        LaboratoryResultSchema(
            id="lab-1",
            document_id="doc-test",
            parameter_name="Hemoglobin",
            normalized_name="hemoglobin",
            result_value="14.2",
            numeric_value=14.2,
            unit="g/dL",
            reference_range="13.0 - 17.0",
            flag="normal",
            confidence=0.98,
            requires_verification=False,
            is_critical=False,
            organ_system="Blood / Hematology"
        )
    ]
    raw_text = SAMPLE_CBC_REPORT
    pages = [{"page_number": 1, "text": raw_text}]

    resp = ConversationalQAEngine.answer_question(
        question="What is my Vitamin B12 level in this report?",
        raw_text=raw_text,
        lab_results=labs,
        prescriptions=[],
        pages=pages,
        category="Blood test reports"
    )
    # Must explicitly state that Vitamin B12 is not present / evaluated in this document
    ans_lower = resp["answer"].lower()
    assert "not" in ans_lower and ("found" in ans_lower or "present" in ans_lower or "listed" in ans_lower or "evaluated" in ans_lower or "available" in ans_lower)
    assert "vitamin b12" in ans_lower or "vitamin b-12" in ans_lower or "b12" in ans_lower



