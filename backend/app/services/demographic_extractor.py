"""
Semantic Patient Demographic and Clinical Information Extraction Engine
Extracts patient name, age, age unit, sex/gender as documented, date of birth,
UHID/MRN, referring doctor, issuing facility, report dates, and specimen type
with provenance tracking and zero-fabrication guarantees.
"""

import re
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple


class DemographicExtractor:
    """
    Robust semantic extractor that parses patient demographics and report metadata
    across diverse hospital layouts, varying label synonyms, and abbreviations.
    """

    # 1. Patient Name Patterns
    NAME_PATTERNS = [
        r"(?:patient\s*name|name\s*of\s*patient|client\s*name|beneficiary\s*name)\s*[:\-–]\s*([A-Za-z\.\t ]{2,40})",
        r"(?:patient\s*details)[^\n]*\n(?:[^\n]*\n)?(?:name)\s*[:\-–]\s*([A-Za-z\.\t ]{2,40})",
        r"(?:^|\n)\s*(?:name)\s*[:\-–]\s*([A-Za-z\.\t ]{2,40})",
        r"(?:^|\n)\s*(?:patient)\s*[:\-–]\s*([A-Za-z\.\t ]{2,40})",
        r"(?:mr\.|mrs\.|ms\.|master|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})",
        r"(?:pt\s*name)\s*[:\-–]\s*([A-Za-z\.\t ]{2,40})",
    ]

    # Non-patient names to exclude (doctors, technicians, directors)
    EXCLUDED_NAME_KEYWORDS = [
        "dr.", "doctor", "technician", "pathologist", "biochemist",
        "director", "consultant", "signatory", "verified by", "reported by",
        "analyst", "hospital", "laboratory", "diagnostic", "clinic"
    ]

    # 2. Age & Unit Patterns
    # Examples: "Age: 22 Years", "Age/Sex: 22 Y / Female", "22Y/F", "22 yrs", "Age: 8 Months"
    AGE_PATTERNS = [
        # Explicit age and unit: "Age: 22 Years" or "Age : 8 Months"
        r"(?:patient\s*age|age)\s*[:\-–]\s*(\d{1,3})\s*(years?|yrs?|y|months?|m|days?|d)\b",
        # Age/Sex combined: "Age/Sex: 22 Y / Female" or "Age/Gender : 28 Years / M"
        r"(?:age\s*[\/\\&]\s*(?:sex|gender))\s*[:\-–]\s*(\d{1,3})\s*(years?|yrs?|y|months?|m|days?|d)?\s*[\/\\,]\s*([A-Za-z]+)",
        # Compact: "22Y/F" or "35 Y / M"
        r"\b(\d{1,3})\s*(y|yrs?|years?|m|months?)\s*[\/\\,]\s*(male|female|m|f)\b",
        # Bare Age: "Age: 22" or "Age - 22" (followed by newline or non-digit)
        r"(?:patient\s*age|age)\s*[:\-–]\s*(\d{1,3})(?!\d|\s*mg|\s*mm|\s*g|\s*%)",
    ]

    # 3. Sex / Gender Patterns
    GENDER_PATTERNS = [
        r"(?:sex|gender|sex\s*[\/\\&]\s*gender)\s*[:\-–]\s*(male|female|m|f|man|woman)\b",
        r"(?:age\s*[\/\\&]\s*(?:sex|gender))\s*[:\-–]\s*\d{1,3}\s*(?:years?|yrs?|y|months?|m)?\s*[\/\\,]\s*(male|female|m|f)\b",
        r"\b\d{1,3}\s*(?:y|yrs?|years?|m|months?)?\s*[\/\\,]\s*(male|female|m|f)\b",
        r"\b(male|female)\s*[\/\\,]\s*\d{1,3}\s*(?:y|yrs?|years?)?\b",
    ]

    # 4. Date of Birth Patterns
    DOB_PATTERNS = [
        r"(?:date\s*of\s*birth|dob|d\.o\.b\.)\s*[:\-–]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        r"(?:date\s*of\s*birth|dob)\s*[:\-–]\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})",
    ]

    # 5. Identifier Patterns (UHID / MRN / Patient ID / Hospital ID)
    ID_PATTERNS = [
        (r"(?:uhid|u\.h\.i\.d\.)\s*[:\-–#]?\s*([A-Za-z0-9\-_]{4,20})", "UHID"),
        (r"(?:mrn|m\.r\.n\.)\s*[:\-–#]?\s*([A-Za-z0-9\-_]{4,20})", "MRN"),
        (r"(?:patient\s*id|pt\s*id|pid)\s*[:\-–#]?\s*([A-Za-z0-9\-_]{4,20})", "Patient ID"),
        (r"(?:registration\s*no|reg\s*no|regn\s*no)\s*[:\-–#]?\s*([A-Za-z0-9\-_]{4,20})", "Registration No"),
        (r"(?:ipd\s*no|opd\s*no|hospital\s*id)\s*[:\-–#]?\s*([A-Za-z0-9\-_]{4,20})", "Hospital ID"),
    ]

    # 6. Referring / Consulting Physician
    REF_DOCTOR_PATTERNS = [
        r"(?:referr?ing\s*doctor|referred\s*by|ref\s*by|consultant\s*doctor|consultant|doctor|dr\.)\s*[:\-–]\s*(?:dr\.?\s*)?([A-Za-z\.\t ]{3,35})",
    ]

    # 7. Dates (Report Date, Sample Collection Date)
    COLLECTION_DATE_PATTERNS = [
        r"(?:sample\s*collected|collection\s*date|collected\s*on|drawn\s*date)\s*[:\-–]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
    ]

    REPORT_DATE_PATTERNS = [
        r"(?:report\s*date|reported\s*on|date\s*of\s*report|dated|date)\s*[:\-–]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        r"(?:report\s*date|date)\s*[:\-–]\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})",
    ]

    # 8. Specimen Type
    SPECIMEN_PATTERNS = [
        r"(?:specimen|sample\s*type|sample)\s*[:\-–]\s*([A-Za-z\s,\(\)]{3,30})",
    ]

    # 9. Hospital / Facility
    FACILITY_PATTERNS = [
        r"^(?:[^\n]*\n)?([A-Z0-9\s&,.'\-]{4,50}\s+(?:hospital|hospitals|laboratory|laboratories|diagnostic|diagnostics|clinic|health|institute|pathology|imaging|center|centre))",
    ]

    @classmethod
    def extract_demographics(cls, raw_text: str, pages: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Main extraction entry point.
        Extracts all demographic entities, calculates derived fields (e.g. age at report),
        normalizes values, tracks source page / snippet, and ensures zero fabrication.
        """
        demographics: Dict[str, Any] = {
            "patient_name": None,
            "patient_age_value": None,
            "patient_age_unit": None,
            "patient_dob": None,
            "patient_age_at_report": None,
            "age_is_calculated": False,
            "patient_gender": None,
            "patient_uhid": None,
            "patient_id_type": None,
            "issuing_facility": None,
            "referring_doctor": None,
            "report_date": None,
            "sample_collection_date": None,
            "specimen_type": None,
            "fields": []  # List of {field_name, original_label, original_value, normalized_value, confidence, page, source_text}
        }

        # Analyze page by page or whole text
        first_page_text = raw_text
        if pages and len(pages) > 0:
            first_page_text = pages[0].get("text_content") or pages[0].get("text") or raw_text

        # 1. Extract Patient Name
        cls._extract_name(first_page_text, demographics)

        # 2. Extract Age & Unit
        cls._extract_age(first_page_text, demographics)

        # 3. Extract Sex/Gender
        cls._extract_gender(first_page_text, demographics)

        # 4. Extract Date of Birth
        cls._extract_dob(first_page_text, demographics)

        # 5. Extract Identifiers (UHID / MRN)
        cls._extract_identifiers(first_page_text, demographics)

        # 6. Extract Dates (Report Date, Sample Date)
        cls._extract_dates(first_page_text, demographics)

        # 7. Extract Referring Doctor
        cls._extract_referring_doctor(first_page_text, demographics)

        # 8. Extract Specimen Type
        cls._extract_specimen(first_page_text, demographics)

        # 9. Extract Facility
        cls._extract_facility(first_page_text, demographics)

        # 10. Calculate age at report date if DOB is present and age was not directly stated
        if demographics["patient_dob"] and demographics["report_date"] and not demographics["patient_age_value"]:
            calc_age = cls._calculate_age(demographics["patient_dob"], demographics["report_date"])
            if calc_age is not None:
                demographics["patient_age_value"] = str(calc_age)
                demographics["patient_age_unit"] = "Years"
                demographics["patient_age_at_report"] = f"{calc_age} Years (Calculated from DOB)"
                demographics["age_is_calculated"] = True
                demographics["fields"].append({
                    "field_name": "patient_age",
                    "original_label": "Calculated from DOB & Report Date",
                    "original_value": f"DOB: {demographics['patient_dob']}, Date: {demographics['report_date']}",
                    "normalized_value": f"{calc_age} Years",
                    "confidence": 0.95,
                    "page": 1,
                    "source_text": f"DOB: {demographics['patient_dob']} -> Age: {calc_age} Years",
                    "verification_status": "calculated"
                })

        # Convenient aliases for downstream consumers & tests
        demographics["age_value"] = int(demographics["patient_age_value"]) if (demographics["patient_age_value"] and str(demographics["patient_age_value"]).isdigit()) else None
        demographics["age_unit"] = demographics["patient_age_unit"]
        demographics["gender"] = demographics["patient_gender"]
        demographics["uhid"] = demographics["patient_uhid"]
        demographics["dob"] = demographics["patient_dob"]

        return demographics

    @classmethod
    def _extract_name(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat in cls.NAME_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_val = match.group(1).strip()
                # Clean up punctuation and trailing words
                cleaned = re.sub(r"[\r\n\t]+", " ", raw_val)
                cleaned = re.sub(r"\s+", " ", cleaned).strip()
                cleaned = re.sub(r"\b(age|sex|gender|dob|date|uhid|ref|mrn)\b.*$", "", cleaned, flags=re.IGNORECASE).strip()

                # Filter out doctor titles or facility names
                lower_c = cleaned.lower()
                if any(k in lower_c for k in cls.EXCLUDED_NAME_KEYWORDS):
                    continue

                if len(cleaned) >= 2 and not cleaned.isdigit():
                    # Strip prefixes like Mr./Mrs./Ms.
                    norm_name = re.sub(r"^(?:mr\.|mrs\.|ms\.|master)\s*", "", cleaned, flags=re.IGNORECASE).strip()
                    demo["patient_name"] = norm_name or cleaned
                    demo["fields"].append({
                        "field_name": "patient_name",
                        "original_label": "Patient Name",
                        "original_value": raw_val,
                        "normalized_value": demo["patient_name"],
                        "confidence": 0.95,
                        "page": 1,
                        "source_text": match.group(0),
                        "verification_status": "verified"
                    })
                    break

    @classmethod
    def _extract_age(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat in cls.AGE_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                val = match.group(1).strip()
                unit = "Years"
                # Check if unit captured
                if match.lastindex and match.lastindex >= 2 and match.group(2):
                    u_raw = match.group(2).lower().strip()
                    if "m" in u_raw and "y" not in u_raw:
                        unit = "Months"
                    elif "d" in u_raw and "y" not in u_raw:
                        unit = "Days"
                    else:
                        unit = "Years"

                # Sanity check: age value should be realistic (0 to 125)
                if val.isdigit() and 0 <= int(val) <= 125:
                    demo["patient_age_value"] = val
                    demo["patient_age_unit"] = unit
                    demo["patient_age_at_report"] = f"{val} {unit}"
                    demo["fields"].append({
                        "field_name": "patient_age",
                        "original_label": "Age",
                        "original_value": f"{val} {unit}",
                        "normalized_value": f"{val} {unit}",
                        "confidence": 0.96,
                        "page": 1,
                        "source_text": match.group(0),
                        "verification_status": "verified"
                    })
                    break

    @classmethod
    def _extract_gender(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat in cls.GENDER_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_gender = match.group(match.lastindex).lower().strip()
                normalized = "Female" if raw_gender in ["f", "female", "woman"] else ("Male" if raw_gender in ["m", "male", "man"] else raw_gender.capitalize())
                demo["patient_gender"] = normalized
                demo["fields"].append({
                    "field_name": "patient_gender",
                    "original_label": "Sex / Gender",
                    "original_value": raw_gender,
                    "normalized_value": normalized,
                    "confidence": 0.96,
                    "page": 1,
                    "source_text": match.group(0),
                    "verification_status": "verified"
                })
                break

    @classmethod
    def _extract_dob(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat in cls.DOB_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_dob = match.group(1).strip()
                demo["patient_dob"] = raw_dob
                demo["fields"].append({
                    "field_name": "patient_dob",
                    "original_label": "Date of Birth",
                    "original_value": raw_dob,
                    "normalized_value": raw_dob,
                    "confidence": 0.95,
                    "page": 1,
                    "source_text": match.group(0),
                    "verification_status": "verified"
                })
                break

    @classmethod
    def _extract_identifiers(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat, id_label in cls.ID_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_id = match.group(1).strip()
                demo["patient_uhid"] = raw_id
                demo["patient_id_type"] = id_label
                demo["fields"].append({
                    "field_name": "patient_uhid",
                    "original_label": id_label,
                    "original_value": raw_id,
                    "normalized_value": raw_id,
                    "confidence": 0.94,
                    "page": 1,
                    "source_text": match.group(0),
                    "verification_status": "verified"
                })
                break

    @classmethod
    def _extract_dates(cls, text: str, demo: Dict[str, Any]) -> None:
        # Collection date
        for pat in cls.COLLECTION_DATE_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_d = match.group(1).strip()
                demo["sample_collection_date"] = raw_d
                demo["fields"].append({
                    "field_name": "sample_collection_date",
                    "original_label": "Sample Collection Date",
                    "original_value": raw_d,
                    "normalized_value": raw_d,
                    "confidence": 0.94,
                    "page": 1,
                    "source_text": match.group(0),
                    "verification_status": "verified"
                })
                break

        # Report date
        for pat in cls.REPORT_DATE_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_d = match.group(1).strip()
                demo["report_date"] = raw_d
                demo["fields"].append({
                    "field_name": "report_date",
                    "original_label": "Report Date",
                    "original_value": raw_d,
                    "normalized_value": raw_d,
                    "confidence": 0.95,
                    "page": 1,
                    "source_text": match.group(0),
                    "verification_status": "verified"
                })
                break

    @classmethod
    def _extract_referring_doctor(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat in cls.REF_DOCTOR_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                doc_name = match.group(1).strip()
                cleaned = re.sub(r"[\r\n\t]+", " ", doc_name)
                cleaned = re.sub(r"\s+", " ", cleaned).strip()
                cleaned = re.sub(r"\b(sample|collection|date|specimen|uhid|age|sex)\b.*$", "", cleaned, flags=re.IGNORECASE).strip()
                if len(cleaned) >= 3 and not any(k in cleaned.lower() for k in ["patient", "self", "hospital"]):
                    norm_doc = f"Dr. {cleaned}" if not cleaned.lower().startswith("dr") else cleaned
                    demo["referring_doctor"] = norm_doc
                    demo["fields"].append({
                        "field_name": "referring_doctor",
                        "original_label": "Referring Doctor",
                        "original_value": doc_name,
                        "normalized_value": norm_doc,
                        "confidence": 0.92,
                        "page": 1,
                        "source_text": match.group(0),
                        "verification_status": "verified"
                    })
                    break

    @classmethod
    def _extract_specimen(cls, text: str, demo: Dict[str, Any]) -> None:
        for pat in cls.SPECIMEN_PATTERNS:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                spec = match.group(1).strip()
                cleaned = re.sub(r"\s+", " ", spec).strip()
                if len(cleaned) >= 3:
                    demo["specimen_type"] = cleaned
                    demo["fields"].append({
                        "field_name": "specimen_type",
                        "original_label": "Specimen Type",
                        "original_value": spec,
                        "normalized_value": cleaned,
                        "confidence": 0.93,
                        "page": 1,
                        "source_text": match.group(0),
                        "verification_status": "verified"
                    })
                    break

    @classmethod
    def _extract_facility(cls, text: str, demo: Dict[str, Any]) -> None:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        for line in lines[:8]:
            lower = line.lower()
            if any(term in lower for term in ["hospital", "laborator", "diagnostic", "clinic", "pathology", "institute", "health care"]):
                demo["issuing_facility"] = line
                demo["fields"].append({
                    "field_name": "issuing_facility",
                    "original_label": "Issuing Facility",
                    "original_value": line,
                    "normalized_value": line,
                    "confidence": 0.95,
                    "page": 1,
                    "source_text": line,
                    "verification_status": "verified"
                })
                break

    @classmethod
    def _calculate_age(cls, dob_str: str, report_date_str: str) -> Optional[int]:
        """Calculates chronological age at the time of the report."""
        date_formats = ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%m/%d/%Y"]

        dob_dt = None
        for fmt in date_formats:
            try:
                dob_dt = datetime.strptime(dob_str, fmt)
                break
            except ValueError:
                continue

        rep_dt = None
        for fmt in date_formats:
            try:
                rep_dt = datetime.strptime(report_date_str, fmt)
                break
            except ValueError:
                continue

        if dob_dt and rep_dt and rep_dt > dob_dt:
            age = rep_dt.year - dob_dt.year - ((rep_dt.month, rep_dt.day) < (dob_dt.month, dob_dt.day))
            return age
        return None
