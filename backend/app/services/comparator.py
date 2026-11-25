"""
Multi-Report Comparison Service
Compares laboratory results across multiple medical documents, calculates
parameter trajectories (increasing, decreasing, stable, fluctuating),
detects reference range changes, and generates longitudinal health insights.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.app.schemas.document import (
    ReportComparisonResponse,
    DocumentSummarySchema,
    ParameterTrend,
    ParameterDataPoint
)
from backend.app.db.models import MedicalDocument


class ReportComparator:
    """
    Compares two or more medical documents, analyzing shared laboratory markers over time.
    """

    @classmethod
    def compare_documents(cls, documents: List[MedicalDocument]) -> ReportComparisonResponse:
        doc_summaries = []
        doc_map = {}
        for d in documents:
            now_dt = datetime.utcnow()
            summary = DocumentSummarySchema(
                id=d.id,
                patient_id=d.patient_id,
                title=d.title,
                original_filename=d.original_filename,
                document_category=d.document_category,
                sub_classification=d.sub_classification,
                classification_confidence=d.classification_confidence or 0.0,
                issuing_facility=d.issuing_facility,
                report_date=d.report_date,
                page_count=d.page_count or 1,
                file_size_bytes=d.file_size_bytes,
                mime_type=d.mime_type,
                status=d.status,
                error_message=d.error_message,
                created_at=d.created_at or now_dt,
                updated_at=d.updated_at or d.created_at or now_dt
            )
            doc_summaries.append(summary)
            doc_map[d.id] = d

        # Sort documents by report_date or created_at
        sorted_docs = sorted(
            documents,
            key=lambda x: str(x.report_date or x.created_at.strftime("%Y-%m-%d"))
        )

        # Group laboratory results by normalized_name across all documents
        param_groups: Dict[str, Dict[str, Any]] = {}

        for doc in sorted_docs:
            date_str = str(doc.report_date or doc.created_at.strftime("%Y-%m-%d"))
            for lab in doc.laboratory_results:
                norm = lab.normalized_name.lower().strip()
                if not norm:
                    continue

                if norm not in param_groups:
                    param_groups[norm] = {
                        "name": lab.parameter_name,
                        "normalized": norm,
                        "unit": lab.unit,
                        "datapoints": []
                    }

                status = lab.flag if lab.flag in ["normal", "low", "high"] else "unspecified"
                datapoint = ParameterDataPoint(
                    date=date_str,
                    document_id=doc.id,
                    document_title=doc.title,
                    value=lab.result_value,
                    numeric_value=lab.numeric_value,
                    unit=lab.unit,
                    reference_range=lab.reference_range,
                    status=status
                )
                param_groups[norm]["datapoints"].append(datapoint)

        matching_parameters: List[ParameterTrend] = []
        notable_trends = []

        for norm, data in param_groups.items():
            pts = data["datapoints"]
            # Deduplicate by document if multiple appeared in same document
            seen_docs = set()
            unique_pts = []
            for p in pts:
                if p.document_id not in seen_docs:
                    seen_docs.add(p.document_id)
                    unique_pts.append(p)

            trend_dir, note = cls._evaluate_trend(data["name"], unique_pts)
            trend_obj = ParameterTrend(
                parameter_name=data["name"],
                normalized_name=norm,
                unit=data["unit"],
                trend_direction=trend_dir,
                datapoints=unique_pts,
                clinical_note=note
            )
            matching_parameters.append(trend_obj)
            if trend_dir in ["increasing", "decreasing", "fluctuating"] and len(unique_pts) >= 2:
                notable_trends.append(f"{data['name']} has been {trend_dir} ({note})")

        # Prioritize parameters with multiple data points, then alphabetical
        matching_parameters.sort(key=lambda x: (-len(x.datapoints), x.parameter_name))

        if notable_trends:
            summary_of_trends = (
                f"Longitudinal comparison across {len(documents)} reports identifies key trajectories: "
                + "; ".join(notable_trends[:4]) + ". "
                + "Consult with your healthcare provider to discuss how these trajectories align with clinical objectives."
            )
        elif len(documents) < 2:
            summary_of_trends = "At least two distinct documents are recommended for meaningful longitudinal trajectory comparison."
        else:
            summary_of_trends = (
                f"Evaluated {len(matching_parameters)} biomarkers across {len(documents)} documents. "
                "Parameters appear generally consistent across the recorded intervals."
            )

        clinical_disclaimer = (
            "Longitudinal Trend Notice: Laboratory reference intervals and measurement assays can differ "
            "between diagnostic laboratories and testing platforms. Trend calculations are informational "
            "and should be verified by a clinician evaluating full assay conditions."
        )

        return ReportComparisonResponse(
            compared_document_ids=[d.id for d in documents],
            document_summaries=doc_summaries,
            matching_parameters=matching_parameters,
            summary_of_trends=summary_of_trends,
            clinical_disclaimer=clinical_disclaimer
        )

    @classmethod
    def _evaluate_trend(cls, param_name: str, datapoints: List[ParameterDataPoint]) -> tuple[str, str]:
        if len(datapoints) < 2:
            return "insufficient_data", "Only one data point available; upload additional reports to establish historical trend."

        numeric_pts = [p for p in datapoints if p.numeric_value is not None]
        if len(numeric_pts) < 2:
            return "stable", f"Qualitative value tracked across {len(datapoints)} reports."

        values = [p.numeric_value for p in numeric_pts]
        first_val = values[0]
        last_val = values[-1]
        delta = last_val - first_val
        percent_change = (delta / first_val * 100) if first_val != 0 else 0

        # Check for range variation across labs
        ref_ranges = {p.reference_range for p in datapoints if p.reference_range}
        range_note = ""
        if len(ref_ranges) > 1:
            range_note = " (Note: reference ranges varied between testing laboratories)."

        if abs(percent_change) < 4.0:
            return "stable", f"Remained stable with minor variance ({first_val} → {last_val} {datapoints[-1].unit or ''}){range_note}."
        elif delta > 0:
            # Check if strictly increasing or fluctuating
            is_monotonic = all(values[i] <= values[i+1] for i in range(len(values)-1))
            dir_str = "increasing" if is_monotonic else "fluctuating"
            return dir_str, f"Increased by {percent_change:+.1f}% from {first_val} to {last_val} {datapoints[-1].unit or ''}{range_note}."
        else:
            is_monotonic = all(values[i] >= values[i+1] for i in range(len(values)-1))
            dir_str = "decreasing" if is_monotonic else "fluctuating"
            return dir_str, f"Decreased by {percent_change:+.1f}% from {first_val} to {last_val} {datapoints[-1].unit or ''}{range_note}."
