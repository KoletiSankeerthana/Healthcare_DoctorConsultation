import re
from typing import Dict, Any, Tuple, Optional

class DocumentClassifier:
    """
    Automated medical document classifier that inspects clinical vocabulary,
    laboratory headers, and document structural evidence.
    """

    CATEGORIES = {
        "Blood test reports": [
            (r"(complete blood count|cbc|hemogram|differential count|leukocyte|erythrocyte|platelet count)", "Complete blood count", 0.96),
            (r"(lipid profile|cholesterol|triglycerides|hdl cholesterol|ldl cholesterol|vldl)", "Lipid profile", 0.96),
            (r"(thyroid profile|tsh|free t3|free t4|triiodothyronine|thyroxine)", "Thyroid profile", 0.96),
            (r"(hba1c|glycated hemoglobin|fasting blood sugar|fbs|postprandial blood sugar|ppbs|glucose tolerance)", "Diabetes report", 0.96),
            (r"(liver function test|lft|bilirubin|sgot|sgpt|alkaline phosphatase|alt|ast)", "Biochemistry - Liver panel", 0.94),
            (r"(kidney function test|kft|renal function|serum creatinine|blood urea nitrogen|bun|uric acid)", "Biochemistry - Renal panel", 0.94),
            (r"(biochemistry|electrolytes|serum sodium|potassium|chloride|calcium)", "Biochemistry report", 0.90),
            (r"(blood report|laboratory report|pathology report|test report)", "Blood test report", 0.85),
        ],
        "Prescriptions": [
            (r"(prescription|rx|tablet|capsule|syrup|dosage|od|bd|tds|sos|hs|before food|after food|m\.d\.|mbbs|reg\. no|dr\.)", "Prescription", 0.95),
            (r"(medication order|take 1 tablet|dispense|refill)", "Prescription", 0.92),
        ],
        "Radiology reports": [
            (r"(magnetic resonance imaging|mri brain|mri spine|mri knee|t1 weighted|t2 weighted|flair sequence)", "MRI report", 0.96),
            (r"(computed tomography|ct scan|ct abdomen|ct chest|hounsfield units|axial cuts)", "CT scan report", 0.96),
            (r"(x-ray|radiograph|chest x-ray|pa view|ap view|skeletal survey)", "X-ray report", 0.95),
            (r"(ultrasonography|ultrasound|usg abdomen|sonogram|acoustic shadowing)", "Ultrasound report", 0.95),
            (r"(electrocardiogram|ecg|ekg|sinus rhythm|pr interval|qrs complex|st segment)", "ECG report", 0.94),
            (r"(radiology report|imaging impression|findings:|impression:)", "Radiology report", 0.90),
        ],
        "Discharge summaries": [
            (r"(discharge summary|date of admission|date of discharge|hospital discharge|discharge advice|course in hospital|final diagnosis)", "Discharge summary", 0.96),
            (r"(inpatient record|admitted on|discharged on|operative notes)", "Discharge summary", 0.92),
        ],
        "Diagnostic reports": [
            (r"(pathology report|histopathology|biopsy report|cytology|microscopic examination)", "Pathology report", 0.94),
            (r"(urine routine|urine analysis|specific gravity|pus cells|epithelial cells)", "Urine examination", 0.94),
            (r"(vaccination card|immunization record|vaccine given|batch no)", "Vaccination record", 0.92),
            (r"(medical fitness certificate|sick leave certificate|to whomsoever it may concern)", "Medical certificate", 0.90),
        ]
    }

    @classmethod
    def classify(cls, text: str = "", filename: str = "", raw_text: str = None, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Classifies medical document based on content, keywords, and structural patterns
        using multi-evidence scoring to select the best category.
        """
        target_text = raw_text if raw_text is not None else text
        combined = f"{filename.lower()} {target_text.lower()}"
        matched_category = "Other medical documents"
        matched_sub = "Medical Document"
        confidence = 0.50
        reasoning = []

        category_scores: Dict[str, float] = {}
        category_best_sub: Dict[str, Tuple[str, float, str]] = {}

        for category, sub_list in cls.CATEGORIES.items():
            cat_score = 0.0
            for pattern, sub_class, conf in sub_list:
                matches = list(re.finditer(pattern, combined, re.IGNORECASE))
                if matches:
                    cat_score += len(matches) * conf
                    if category not in category_best_sub or conf > category_best_sub[category][1]:
                        category_best_sub[category] = (sub_class, conf, matches[0].group(0))
            if cat_score > 0:
                category_scores[category] = cat_score

        if category_scores:
            best_cat = max(category_scores.items(), key=lambda x: x[1])[0]
            matched_category = best_cat
            sub_class, conf, matched_text = category_best_sub[best_cat]
            matched_sub = sub_class
            confidence = min(0.98, conf)
            reasoning.append(f"Identified diagnostic markers: '{matched_text}' (score: {category_scores[best_cat]:.1f})")
        else:
            if len(text.strip()) < 50:
                matched_category = "Other medical documents"
                matched_sub = "Unrecognized document format"
                confidence = 0.40
                reasoning.append("Text content is minimal or OCR confidence was low.")
            else:
                matched_category = "Other medical documents"
                matched_sub = "General Health Record"
                confidence = 0.60
                reasoning.append("General clinical terminology observed without specific laboratory classification.")

        # Extract identifiable laboratory / facility name using DemographicExtractor
        from backend.app.services.demographic_extractor import DemographicExtractor
        demo = DemographicExtractor.extract_demographics(target_text)

        facility = demo.get("issuing_facility") or cls._extract_issuing_facility(text)
        patient_name = demo.get("patient_name")
        report_date = demo.get("report_date")

        return {
            "category": matched_category,
            "sub_classification": matched_sub,
            "confidence": confidence,
            "reasoning": "; ".join(reasoning) if reasoning else "Classified by document terminology matching.",
            "issuing_facility": facility,
            "patient_name": patient_name,
            "report_date": report_date
        }

    @staticmethod
    def _extract_issuing_facility(text: str) -> Optional[str]:
        """Find hospital or laboratory name in top header."""
        lines = [l.strip() for l in text.split("\n")[:10] if l.strip()]
        for line in lines:
            if re.search(r"(hospital|diagnostics?|laborator(?:y|ies)|clinic|institute|pathlabs?|care center|health)", line, re.IGNORECASE):
                clean = re.sub(r"[#*_]", "", line).strip()
                if len(clean) < 80:
                    return clean
        return None

    @staticmethod
    def _extract_patient_name(text: str) -> Optional[str]:
        """Find patient name pattern if explicitly stated in text; never fabricate."""
        patterns = [
            r"patient\s*name\s*[:\-]\s*([A-Za-z\.\s]{3,35})",
            r"name\s*[:\-]\s*(mr\.|mrs\.|ms\.|master)?\s*([A-Za-z\s]{3,30})",
            r"pt\s*name\s*[:\-]\s*([A-Za-z\s]{3,30})"
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                name = m.group(m.lastindex).strip()
                if name.lower() not in {"age", "sex", "gender", "date", "dr", "doctor"}:
                    return name
        return None

    @staticmethod
    def _extract_report_date(text: str) -> Optional[str]:
        """Find date of test or report."""
        patterns = [
            r"(?:date of report|collected on|reported on|sample date|report date|date)\s*[:\-]\s*(\d{1,2}[\/\-\.][\w]{3,9}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
            r"(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})"
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return None
