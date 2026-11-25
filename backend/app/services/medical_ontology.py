"""
Medical Ontology, Synonyms, and Abbreviation Normalization Engine
Maps clinical test abbreviations, synonyms, and variations to canonical medical entities,
associated organ systems, standard units, and clinical explanations.
"""

from typing import Dict, Any, Optional, List, Tuple
import re

MEDICAL_ONTOLOGY: Dict[str, Dict[str, Any]] = {
    "hemoglobin": {
        "canonical": "Hemoglobin",
        "synonyms": ["hb", "hgb", "hemoglobin", "haemoglobin", "blood level", "blood count hb"],
        "organ_system": "Hematology / Oxygenation",
        "unit": "g/dL",
        "standard_ref": "13.0 - 17.0 g/dL (Males), 12.0 - 15.5 g/dL (Females)",
        "clinical_significance": "Transports oxygen from lungs to body tissues. Low values indicate anemia; high values suggest polycythemia or dehydration.",
        "specialty": "General Physician / Hematologist"
    },
    "wbc": {
        "canonical": "Total Leukocyte Count (WBC)",
        "synonyms": ["wbc", "tlc", "total leukocyte count", "total leukocytes", "white blood cells", "white blood cell count", "leukocytes"],
        "organ_system": "Immune & Hematology",
        "unit": "thou/uL",
        "standard_ref": "4.0 - 10.5 thou/uL (or 4,000 - 11,000 /cumm)",
        "clinical_significance": "Core immune surveillance cells. Elevations (leukocytosis) reflect infection, acute inflammation, or physical stress. Reductions (leukopenia) reflect viral suppression or bone marrow issues.",
        "specialty": "General Physician / Internal Medicine"
    },
    "rbc": {
        "canonical": "Red Blood Cell Count (RBC)",
        "synonyms": ["rbc", "red blood cells", "erythrocytes", "total rbc count", "red cell count"],
        "organ_system": "Hematology / Oxygenation",
        "unit": "mil/uL",
        "standard_ref": "4.50 - 5.90 mil/uL",
        "clinical_significance": "Quantifies circulating oxygen-carrying erythrocytes.",
        "specialty": "General Physician / Hematologist"
    },
    "platelets": {
        "canonical": "Platelet Count",
        "synonyms": ["platelet", "platelets", "plt", "platelet count", "thrombocytes", "thrombocyte count"],
        "organ_system": "Hematology & Hemostasis",
        "unit": "thou/uL",
        "standard_ref": "150 - 450 thou/uL (or 1.5 - 4.5 lakhs/cumm)",
        "clinical_significance": "Cell fragments responsible for blood clotting. Low counts (thrombocytopenia) elevate bleeding risks; high counts (thrombocytosis) can accompany reactive inflammation or myeloproliferative states.",
        "specialty": "General Physician / Hematologist"
    },
    "fasting blood sugar": {
        "canonical": "Fasting Blood Sugar (FBS)",
        "synonyms": ["fbs", "fasting glucose", "fasting blood glucose", "fasting blood sugar", "fpg", "fasting plasma glucose"],
        "organ_system": "Endocrine & Glycemic Control",
        "unit": "mg/dL",
        "standard_ref": "70 - 99 mg/dL",
        "clinical_significance": "Assesses overnight basal carbohydrate metabolism and insulin sensitivity. 100-125 indicates impaired fasting glucose (prediabetes); >= 126 suggests diabetes upon repeated testing.",
        "specialty": "Diabetologist / Endocrinologist"
    },
    "postprandial blood sugar": {
        "canonical": "Postprandial Blood Sugar (PPBS)",
        "synonyms": ["ppbs", "postprandial glucose", "pp blood sugar", "2hr post glucose"],
        "organ_system": "Endocrine & Glycemic Control",
        "unit": "mg/dL",
        "standard_ref": "< 140 mg/dL",
        "clinical_significance": "Evaluates insulin surge and glucose disposal after meals.",
        "specialty": "Diabetologist / Endocrinologist"
    },
    "hba1c": {
        "canonical": "HbA1c (Glycated Hemoglobin)",
        "synonyms": ["hba1c", "a1c", "glycated hemoglobin", "glycosylated hemoglobin", "hemoglobin a1c"],
        "organ_system": "Endocrine & Glycemic Control",
        "unit": "%",
        "standard_ref": "< 5.7% (Normal), 5.7 - 6.4% (Prediabetes), >= 6.5% (Diabetes)",
        "clinical_significance": "Golden-standard metric reflecting average 3-month blood glucose control without short-term day-to-day fluctuations.",
        "specialty": "Diabetologist / Endocrinologist"
    },
    "total cholesterol": {
        "canonical": "Total Cholesterol",
        "synonyms": ["cholesterol", "total cholesterol", "tc", "serum cholesterol"],
        "organ_system": "Lipid & Cardiovascular",
        "unit": "mg/dL",
        "standard_ref": "< 200 mg/dL",
        "clinical_significance": "Composite circulating cholesterol measure; elevations associate with atherosclerotic plaque risk.",
        "specialty": "Cardiologist / General Physician"
    },
    "ldl cholesterol": {
        "canonical": "LDL Cholesterol (Bad)",
        "synonyms": ["ldl", "ldl cholesterol", "ldl-c", "low density lipoprotein"],
        "organ_system": "Lipid & Cardiovascular",
        "unit": "mg/dL",
        "standard_ref": "< 100 mg/dL",
        "clinical_significance": "Direct atherogenic cholesterol that deposits in arterial walls. Lower targets recommended for individuals with vascular risk factors.",
        "specialty": "Cardiologist / General Physician"
    },
    "hdl cholesterol": {
        "canonical": "HDL Cholesterol (Good)",
        "synonyms": ["hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein"],
        "organ_system": "Lipid & Cardiovascular",
        "unit": "mg/dL",
        "standard_ref": "> 40 mg/dL (Males), > 50 mg/dL (Females)",
        "clinical_significance": "Protective lipoprotein facilitating reverse cholesterol transport to the liver.",
        "specialty": "Cardiologist / General Physician"
    },
    "triglycerides": {
        "canonical": "Triglycerides",
        "synonyms": ["triglycerides", "tg", "serum triglycerides", "triglyceride"],
        "organ_system": "Lipid & Cardiovascular",
        "unit": "mg/dL",
        "standard_ref": "< 150 mg/dL",
        "clinical_significance": "Primary storage form of body fat. Elevations accompany metabolic syndrome, refined sugar diets, or pancreatitis risk when severe.",
        "specialty": "Cardiologist / General Physician"
    },
    "tsh": {
        "canonical": "Thyroid Stimulating Hormone (TSH)",
        "synonyms": ["tsh", "thyroid stimulating hormone", "thyrotropin", "serum tsh"],
        "organ_system": "Thyroid & Endocrine",
        "unit": "uIU/mL",
        "standard_ref": "0.40 - 4.50 uIU/mL",
        "clinical_significance": "Master pituitary regulator of thyroid hormone production. High TSH signals primary hypothyroidism; low TSH signals hyperthyroidism.",
        "specialty": "Endocrinologist"
    },
    "serum creatinine": {
        "canonical": "Serum Creatinine",
        "synonyms": ["creatinine", "serum creatinine", "cr", "s. creatinine", "creat"],
        "organ_system": "Renal / Kidney",
        "unit": "mg/dL",
        "standard_ref": "0.7 - 1.3 mg/dL",
        "clinical_significance": "Metabolic muscle byproduct cleared exclusively by glomerular filtration. Elevated levels indicate reduced kidney filtration capacity.",
        "specialty": "Nephrologist"
    },
    "blood urea nitrogen": {
        "canonical": "Blood Urea Nitrogen (BUN)",
        "synonyms": ["bun", "blood urea nitrogen", "urea", "blood urea"],
        "organ_system": "Renal / Kidney",
        "unit": "mg/dL",
        "standard_ref": "7 - 20 mg/dL",
        "clinical_significance": "Protein metabolism byproduct cleared by kidneys. Evaluates renal filtration and dehydration status.",
        "specialty": "Nephrologist"
    },
    "alt": {
        "canonical": "ALT / SGPT (Liver)",
        "synonyms": ["alt", "sgpt", "alanine aminotransferase", "alanine transaminase", "serum alt"],
        "organ_system": "Hepatic / Liver",
        "unit": "U/L",
        "standard_ref": "< 40 U/L",
        "clinical_significance": "Enzyme concentrated in liver cells. Elevated levels indicate acute or chronic hepatocellular stress/inflammation.",
        "specialty": "Gastroenterologist / Hepatologist"
    },
    "ast": {
        "canonical": "AST / SGOT (Liver)",
        "synonyms": ["ast", "sgot", "aspartate aminotransferase", "aspartate transaminase", "serum ast"],
        "organ_system": "Hepatic / Liver",
        "unit": "U/L",
        "standard_ref": "< 40 U/L",
        "clinical_significance": "Enzyme present in liver and muscle cells. Evaluated with ALT to detect liver inflammation.",
        "specialty": "Gastroenterologist / Hepatologist"
    },
    "bilirubin": {
        "canonical": "Total Bilirubin",
        "synonyms": ["bilirubin", "total bilirubin", "serum bilirubin", "t. bilirubin"],
        "organ_system": "Hepatic / Biliary",
        "unit": "mg/dL",
        "standard_ref": "0.2 - 1.2 mg/dL",
        "clinical_significance": "Hemoglobin breakdown byproduct processed by liver. Elevations cause jaundice and signal liver or biliary flow issues.",
        "specialty": "Gastroenterologist / Hepatologist"
    },
    "uric acid": {
        "canonical": "Serum Uric Acid",
        "synonyms": ["uric acid", "serum uric acid", "urate"],
        "organ_system": "Renal & Metabolic",
        "unit": "mg/dL",
        "standard_ref": "3.5 - 7.2 mg/dL",
        "clinical_significance": "Purine breakdown product. Elevations associate with gouty arthritis and kidney stone risks.",
        "specialty": "Rheumatologist / General Physician"
    }
}


class MedicalOntology:
    """Provides semantic query resolution, synonym mapping, and organ-system clustering."""

    @classmethod
    def resolve_term(cls, query: str) -> Optional[Dict[str, Any]]:
        """
        Resolves query tokens against medical synonym ontology.
        Tolerates abbreviations, partial tokens, and case variations.
        """
        q_clean = query.lower().strip()
        words = re.findall(r"\b[a-zA-Z0-9\-\.]+\b", q_clean)

        # 1. Exact or substring matching across synonyms
        for key, entry in MEDICAL_ONTOLOGY.items():
            for syn in entry["synonyms"]:
                # Check exact phrase or word boundary match
                pattern = r"\b" + re.escape(syn) + r"\b"
                if re.search(pattern, q_clean):
                    res = dict(entry)
                    res["canonical_name"] = entry["canonical"]
                    return res

        # 2. Check individual words if no phrase matched
        for word in words:
            if len(word) >= 2:
                for key, entry in MEDICAL_ONTOLOGY.items():
                    if word in entry["synonyms"]:
                        res = dict(entry)
                        res["canonical_name"] = entry["canonical"]
                        return res

        return None

    @classmethod
    def detect_organ_system(cls, query: str) -> Optional[str]:
        """Detects whether user is querying about a broader organ system."""
        q_lower = query.lower()
        if any(w in q_lower for w in ["kidney", "renal", "nephro", "creatinine", "bun", "urea"]):
            return "Renal / Kidney"
        if any(w in q_lower for w in ["liver", "hepatic", "lft", "sgot", "sgpt", "alt", "ast", "bilirubin"]):
            return "Hepatic / Liver"
        if any(w in q_lower for w in ["thyroid", "tsh", "t3", "t4", "hypothyroid", "hyperthyroid"]):
            return "Thyroid & Endocrine"
        if any(w in q_lower for w in ["cholesterol", "lipid", "heart", "cardio", "triglycerides", "ldl", "hdl"]):
            return "Lipid & Cardiovascular"
        if any(w in q_lower for w in ["sugar", "diabetes", "diabetic", "glucose", "fbs", "ppbs", "hba1c"]):
            return "Endocrine & Glycemic Control"
        if any(w in q_lower for w in ["blood", "hemoglobin", "hb", "wbc", "rbc", "platelet", "anemia", "infection"]):
            return "Hematology / Oxygenation"
        return None
