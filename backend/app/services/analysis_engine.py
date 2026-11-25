"""
AI Medical Document Understanding and Patient Guidance Engine
Generates 10 clinical-grade, patient-friendly sections with grounded evidence tracking,
emergency red-flag warnings, multilingual explanations, and document-grounded Q&A.
"""

from typing import List, Dict, Any, Optional, Tuple
import re
from backend.app.schemas.document import (
    DocumentAnalysisSchema,
    ParameterExplanation,
    MedicalTermGlossary,
    ReportObservation,
    LaboratoryResultSchema,
    PrescriptionItemSchema
)

# Standard medical reference knowledge base for deterministic, high-quality fallback & validation
PARAMETER_KNOWLEDGE_BASE = {
    "hemoglobin": {
        "measures": "The iron-rich protein in red blood cells that transports oxygen from your lungs throughout your entire body.",
        "context": "Optimal levels support oxygenation, physical energy, and tissue vitality. Lower levels may indicate anemia or blood loss, while elevated levels can be linked to dehydration, high altitude, or bone marrow conditions.",
        "limitations": "Hemoglobin level alone cannot determine the root cause of an abnormality (e.g., iron deficiency vs. vitamin B12 deficiency vs. chronic disease) without additional iron studies and clinical evaluation."
    },
    "rbc": {
        "measures": "The total number of red blood cells (erythrocytes) circulating per volume of blood.",
        "context": "Red blood cells carry oxygen. High counts may indicate compensatory responses or dehydration; low counts suggest decreased marrow production or accelerated cell breakdown.",
        "limitations": "Does not reflect red cell quality, size, or hemoglobin saturation by itself."
    },
    "wbc": {
        "measures": "The total white blood cell count, representing the body's primary immune defense cells against pathogens and tissue injury.",
        "context": "Counts rise naturally during bacterial or viral infections, systemic inflammation, or physical stress. Lower counts may indicate immune suppression, viral suppression of bone marrow, or medication effects.",
        "limitations": "A single WBC count does not pinpoint the specific pathogen or location of infection without a differential leukocyte breakdown and physical symptoms."
    },
    "platelets": {
        "measures": "Cell fragments essential for normal blood clotting and vessel repair.",
        "context": "Adequate levels prevent spontaneous bleeding and promote wound healing. Low levels (thrombocytopenia) increase bruising or bleeding tendencies; high levels may reflect reactive thrombocytosis or bone marrow disorders.",
        "limitations": "Platelet counts measure quantity, not whether platelet function or aggregation kinetics are intact."
    },
    "fasting blood sugar": {
        "measures": "Concentration of glucose in the bloodstream after an overnight fast (minimum 8-10 hours).",
        "context": "A foundational assessment of carbohydrate metabolism and insulin regulation. Normal fasting glucose reflects balanced insulin production and tissue sensitivity.",
        "limitations": "A single elevated reading can be influenced by recent illness, acute emotional stress, poor sleep, or incomplete fasting, requiring confirmatory testing (like HbA1c)."
    },
    "glucose": {
        "measures": "The immediate level of sugar in your bloodstream serving as primary cellular fuel.",
        "context": "Fluctuates after meals and activity. Persistently elevated values warrant formal glycemic evaluation.",
        "limitations": "Random glucose depends heavily on recent food intake and does not replace standardized fasting or HbA1c assessments."
    },
    "hba1c": {
        "measures": "The percentage of hemoglobin bound to glucose, reflecting your average blood sugar levels over the past 2 to 3 months.",
        "context": "Standard biomarker for diagnosing and monitoring prediabetes and diabetes. Because red blood cells live roughly 120 days, this provides a durable historical picture without day-to-day fluctuations.",
        "limitations": "Can be skewed by variant hemoglobins, severe anemia, recent blood transfusions, or shortened red cell lifespans."
    },
    "total cholesterol": {
        "measures": "The composite estimate of all cholesterol carried across various lipoprotein particles (HDL, LDL, and VLDL) in the bloodstream.",
        "context": "A general marker used in cardiovascular risk estimation. While total cholesterol provides an overview, the specific distribution between protective HDL and atherogenic particles is clinically more informative.",
        "limitations": "Total cholesterol alone does not calculate specific cardiovascular event probability without evaluating LDL-C, HDL-C, blood pressure, and age."
    },
    "ldl cholesterol": {
        "measures": "Low-Density Lipoprotein cholesterol, often referred to as 'bad' cholesterol because it deposits in arterial walls to form plaques.",
        "context": "Lower targets are recommended, particularly for individuals with preexisting cardiovascular risks, diabetes, or hypertension.",
        "limitations": "Calculated LDL (Friedewald formula) can lose accuracy if triglycerides are markedly elevated (>400 mg/dL)."
    },
    "hdl cholesterol": {
        "measures": "High-Density Lipoprotein cholesterol, often referred to as 'protective' or 'good' cholesterol because it scavenges excess vascular cholesterol and delivers it back to the liver.",
        "context": "Higher levels are generally associated with favorable cardiovascular resilience, though extremely high levels may not confer additional protection.",
        "limitations": "HDL quality and reverse-cholesterol-transport functionality are not measured by quantity alone."
    },
    "triglycerides": {
        "measures": "The most common type of circulating fat (lipid) derived from consumed calories and stored in adipose tissue for future energy release.",
        "context": "Elevated triglycerides correlate with metabolic syndrome, insulin resistance, physical inactivity, or excessive alcohol/refined carbohydrate intake.",
        "limitations": "Sensitive to recent diet, fasting compliance, and alcohol consumption within 24 hours prior to blood draw."
    },
    "tsh": {
        "measures": "Thyroid Stimulating Hormone, secreted by the pituitary gland to regulate thyroid hormone (T3 and T4) production.",
        "context": "Very sensitive indicator of thyroid axis function. Elevated TSH usually signals an underactive thyroid (hypothyroidism); low TSH signals an overactive thyroid (hyperthyroidism).",
        "limitations": "Pituitary disease, severe non-thyroidal systemic illness, and biotin supplementation can alter TSH readings independently of true thyroid disease."
    },
    "creatinine": {
        "measures": "A metabolic waste byproduct of normal muscle breakdown filtered and eliminated from the blood exclusively by the kidneys.",
        "context": "Serum creatinine serves as a primary marker of renal filtration capacity. Stable, low levels reflect healthy renal clearance.",
        "limitations": "Influenced by muscle mass, extreme dietary protein intake, dehydration, and certain medications without reflecting acute cellular injury instantly."
    },
    "blood urea nitrogen": {
        "measures": "The amount of nitrogen in the blood derived from urea, a waste product of dietary and cellular protein metabolism.",
        "context": "Evaluates kidney function and hydration status. Often evaluated in conjunction with serum creatinine (BUN/Creatinine ratio).",
        "limitations": "Can rise substantially with gastrointestinal bleeding, high-protein diets, or severe dehydration even with intact kidneys."
    },
    "alt": {
        "measures": "Alanine Aminotransferase, an intracellular enzyme found predominantly in liver cells (hepatocytes).",
        "context": "When liver cells suffer stress or inflammation, ALT leaks into the circulation, making it a sensitive detector of hepatic injury.",
        "limitations": "ALT elevation indicates hepatocellular irritation but does not specify whether causes are viral, metabolic, fatty liver, or medication-induced."
    },
    "ast": {
        "measures": "Aspartate Aminotransferase, an enzyme present in the liver, heart, skeletal muscle, and kidneys.",
        "context": "Elevations accompany liver stress, strenuous muscle exertion, or cardiac events. Compared alongside ALT to assess tissue origin.",
        "limitations": "Less liver-specific than ALT; heavy resistance exercise within 48 hours can elevate AST temporarily."
    },
    "bilirubin": {
        "measures": "A yellowish breakdown product of normal hemoglobin degradation processed by the liver and excreted in bile.",
        "context": "Elevated levels can cause jaundice (yellowing of skin/eyes) and indicate liver processing impairment or biliary tract obstruction.",
        "limitations": "Does not identify whether elevation is pre-hepatic (hemolysis), intra-hepatic, or post-hepatic (gallstones) without fractionation (direct vs. indirect)."
    },
    "vitamin d": {
        "measures": "25-Hydroxyvitamin D, the major circulating form reflecting total body stores of this fat-soluble hormone precursor.",
        "context": "Essential for calcium absorption, bone mineralization, neuromuscular transmission, and balanced immune regulation.",
        "limitations": "Levels vary seasonally with solar exposure and require sustained dietary or supplemental intervention to adjust."
    },
    "vitamin b12": {
        "measures": "Serum concentration of cobalamin, essential for red blood cell synthesis, DNA replication, and peripheral nerve myelin integrity.",
        "context": "Deficiencies can lead to macrocytic anemia and progressive neurological symptoms (numbness, tingling).",
        "limitations": "Serum B12 can appear normal in some functional deficiencies; methylmalonic acid (MMA) is occasionally needed for borderline cases."
    }
}

MEDICAL_GLOSSARY_TERMS = {
    "normocytic": "Red blood cells that have a typical, normal average size.",
    "microcytic": "Red blood cells that are smaller in volume than standard, frequently seen in iron deficiency.",
    "macrocytic": "Red blood cells that are larger in volume than standard, commonly related to vitamin B12 or folate insufficiency.",
    "hypochromic": "Red blood cells displaying pale color under microscopy due to reduced hemoglobin content.",
    "erythrocyte": "The medical term for a mature red blood cell carrying oxygen.",
    "leukocyte": "The medical term for a white blood cell protecting the body from infections.",
    "thrombocyte": "Another medical name for a platelet, aiding normal blood clotting.",
    "hba1c": "Glycated hemoglobin, indicating your 3-month average blood glucose control.",
    "dyslipidemia": "An imbalance of circulating blood lipids, such as elevated LDL cholesterol or triglycerides.",
    "hypothyroidism": "A clinical state where the thyroid gland is producing less thyroid hormone than your body requires.",
    "hyperthyroidism": "A condition where the thyroid gland produces an excessive amount of thyroid hormones.",
    "creatinine": "A natural waste product from muscle metabolism filtered out of your blood by the kidneys.",
    "bilirubin": "A natural yellowish compound formed when red blood cells break down, cleared by the liver into bile.",
    "prothrombin": "A plasma protein produced by the liver that converts to thrombin during blood coagulation.",
    "hemostasis": "The physiological process by which the body stops blood flow and seals vascular injuries.",
    "statins": "A class of prescription medications specifically designed to reduce cholesterol synthesis in the liver."
}

MULTILINGUAL_TRANSLATIONS = {
    "te": {
        "header": "ఈ నివేదిక రోగి అవగాహన కోసం రూపొందించబడింది.",
        "disclaimer": "వైద్య గమనిక: ఈ AI విశ్లేషణ కేవలం రోగి సమాచారం కోసం మాత్రమే. ఇది వైద్య నిర్ధారణ లేదా చికిత్స సలహా కాదు.",
        "normal": "సాధారణ పరిధిలో ఉంది",
        "attention": "వైద్యుల సమీక్ష అవసరం"
    },
    "hi": {
        "header": "यह रिपोर्ट मरीज की समझ के लिए तैयार की गई है।",
        "disclaimer": "चिकित्सा अस्वीकरण: यह एआई विश्लेषण केवल रोगी की शिक्षा के लिए है। यह पेशेवर चिकित्सा सलाह नहीं है।",
        "normal": "सामान्य सीमा में",
        "attention": "डॉक्टर के परामर्श की आवश्यकता है"
    },
    "ta": {
        "header": "இந்த அறிக்கை நோயாளியின் புரிதலுக்காக உருவாக்கப்பட்டது.",
        "disclaimer": "மருத்துவ மறுப்புரை: இந்த AI பகுப்பாய்வு நோயாளியின் தகவலுக்காக மட்டுமே.",
        "normal": "சாதாரண வரம்பில் உள்ளது",
        "attention": "மருத்துவர் ஆய்வு தேவை"
    },
    "kn": {
        "header": "ಈ ವರದಿಯನ್ನು ರೋಗಿಯ ತಿಳುವಳಿಕೆಗಾಗಿ ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ.",
        "disclaimer": "ವೈದ್ಯಕೀಯ ಹಕ್ಕುತ್ಯಾಗ: ಈ AI ವಿಶ್ಲೇಷಣೆಯು ರೋಗಿಯ ಶಿಕ್ಷಣಕ್ಕಾಗಿ ಮಾತ್ರ.",
        "normal": "ಸಾಮಾನ್ಯ ಮಿತಿಯಲ್ಲಿದೆ",
        "attention": "ವೈದ್ಯರ ಸಮಾಲೋಚನೆ ಅಗತ್ಯವಿದೆ"
    },
    "ml": {
        "header": "ഈ റിപ്പോർട്ട് രോഗിയുടെ മനസ്സിലാക്കലിനായി തയ്യാറാക്കിയതാണ്.",
        "disclaimer": "മെഡിക്കൽ നിരാകരണം: ഈ AI വിശകലനം വിവരങ്ങൾക്ക് മാത്രമുള്ളതാണ്.",
        "normal": "സാധാരണ പരിധിയിൽ",
        "attention": "ഡോക്ടറുടെ ശ്രദ്ധ ആവശ്യമാണ്"
    }
}


class MedicalAnalysisEngine:
    """
    Analyzes medical laboratory reports, prescriptions, radiology, and diagnostics
    to produce empathetic, accurate, grounded explanations for patients across 10 sections.
    """

    @classmethod
    def generate_analysis(
        cls,
        document_id: str,
        category: str,
        sub_category: Optional[str],
        lab_results: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema],
        raw_text: str,
        facility: Optional[str] = None,
        report_date: Optional[str] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Generates full patient-friendly structured analysis across all 10 clinical sections.
        """
        abnormal_labs = [r for r in lab_results if r.flag in ["low", "high", "abnormal"]]
        normal_labs = [r for r in lab_results if r.flag == "normal"]

        emergency_warning = cls._detect_emergency_red_flags(lab_results, raw_text)

        # Section 1: What is this document?
        what_is_this = cls._build_what_is_this_document(category, sub_category, facility, report_date)

        # Section 2: Simple summary
        simple_summary = cls._build_simple_summary(
            category=category,
            sub_category=sub_category,
            total_labs=len(lab_results),
            abnormal_labs=abnormal_labs,
            normal_labs=normal_labs,
            prescriptions=prescriptions,
            facility=facility,
            report_date=report_date
        )

        # Section 3: Parameter-by-parameter explanations
        param_explanations = []
        for lab in lab_results:
            explanation = cls._explain_parameter(lab)
            param_explanations.append(explanation.model_dump())

        # Section 4: Important findings / observations
        important_findings = cls._build_important_findings(
            abnormal_labs=abnormal_labs,
            normal_labs=normal_labs,
            prescriptions=prescriptions,
            raw_text=raw_text
        )
        observations = cls._build_report_observations(lab_results, abnormal_labs, prescriptions, raw_text)

        # Section 5: Medical terminology glossary
        glossary_items = cls._extract_glossary_terms(raw_text, lab_results)

        # Section 6: What should the patient understand?
        what_patient_should_understand = cls._build_patient_understanding(
            category=category,
            abnormal_labs=abnormal_labs,
            prescriptions=prescriptions
        )

        # Section 7: Precautions and general guidance
        precautions_guidance = cls._build_precautions_guidance(
            category=category,
            abnormal_labs=abnormal_labs,
            prescriptions=prescriptions
        )

        # Section 8: When to seek medical help
        when_to_seek_help = cls._build_when_to_seek_help(abnormal_labs, emergency_warning)

        # Section 9: Questions for the doctor
        doctor_questions = cls._build_doctor_questions(
            category=category,
            abnormal_labs=abnormal_labs,
            prescriptions=prescriptions
        )

        # Section 10: Suggested next steps
        next_steps = cls._build_next_steps(
            abnormal_labs=abnormal_labs,
            prescriptions=prescriptions,
            category=category
        )

        # Disclaimer
        disclaimer = (
            "Medical Disclaimer: This report analysis is generated by an artificial intelligence "
            "system for patient educational awareness and organization purposes only. It is not a clinical "
            "diagnosis, treatment prescription, or substitute for the evaluation and counsel of a licensed "
            "physician or certified healthcare professional. Do not modify, start, or discontinue any medical "
            "treatment or drug regimen based solely on this automated overview. Always review your laboratory "
            "and medical records in direct consultation with your healthcare provider."
        )

        # Build 10 normalized sections list for relational persistence
        sections = [
            {
                "section_index": 1,
                "section_type": "what_is_this",
                "title": "Section 1: What is this Document?",
                "content_text": what_is_this,
                "structured_items": {"category": category, "sub_category": sub_category, "facility": facility},
                "source_citations": [{"page": 1, "note": "Classified from document header"}]
            },
            {
                "section_index": 2,
                "section_type": "simple_summary",
                "title": "Section 2: Plain Language Overview",
                "content_text": simple_summary,
                "structured_items": {"total_labs": len(lab_results), "abnormal_count": len(abnormal_labs)},
                "source_citations": [{"page": 1, "note": "Synthesized from extracted values"}]
            },
            {
                "section_index": 3,
                "section_type": "detailed_explanation",
                "title": "Section 3: Detailed Parameter Explanations",
                "content_text": f"Evaluated {len(param_explanations)} clinical parameters against laboratory reference intervals.",
                "structured_items": param_explanations,
                "source_citations": [{"page": p.get("page_number", 1), "parameter": p.get("parameter")} for p in param_explanations]
            },
            {
                "section_index": 4,
                "section_type": "observations",
                "title": "Section 4: Important Observations",
                "content_text": "\n".join([f"• {f}" for f in important_findings]),
                "structured_items": [o.model_dump() for o in observations],
                "source_citations": [{"page": 1, "note": "Derived from abnormal markers"}]
            },
            {
                "section_index": 5,
                "section_type": "terminology",
                "title": "Section 5: Medical Terminology in Everyday Language",
                "content_text": "Definitions of technical medical terminology present in your report:",
                "structured_items": [g.model_dump() for g in glossary_items],
                "source_citations": []
            },
            {
                "section_index": 6,
                "section_type": "patient_understanding",
                "title": "Section 6: What Should You Understand?",
                "content_text": what_patient_should_understand,
                "structured_items": None,
                "source_citations": []
            },
            {
                "section_index": 7,
                "section_type": "precautions",
                "title": "Section 7: Precautions & General Health Guidance",
                "content_text": precautions_guidance["summary"],
                "structured_items": precautions_guidance,
                "source_citations": []
            },
            {
                "section_index": 8,
                "section_type": "when_to_seek_help",
                "title": "Section 8: When to Seek Medical Attention",
                "content_text": when_to_seek_help,
                "structured_items": {"is_urgent": bool(emergency_warning)},
                "source_citations": []
            },
            {
                "section_index": 9,
                "section_type": "doctor_questions",
                "title": "Section 9: Questions to Discuss With Your Doctor",
                "content_text": "\n".join([f"{i+1}. {q}" for i, q in enumerate(doctor_questions)]),
                "structured_items": doctor_questions,
                "source_citations": []
            },
            {
                "section_index": 10,
                "section_type": "next_steps",
                "title": "Section 10: Recommended Next Steps",
                "content_text": "\n".join([f"• {s}" for s in next_steps]),
                "structured_items": next_steps,
                "source_citations": []
            }
        ]

        # Apply multilingual header/footer if requested
        if language in MULTILINGUAL_TRANSLATIONS:
            lang_dict = MULTILINGUAL_TRANSLATIONS[language]
            disclaimer = f"{lang_dict['disclaimer']}\n\n{disclaimer}"
            simple_summary = f"{lang_dict['header']}\n{simple_summary}"

        return {
            "document_id": document_id,
            "simple_summary": simple_summary,
            "important_findings": important_findings,
            "parameter_explanations": param_explanations,
            "medical_terminology": [g.model_dump() for g in glossary_items],
            "report_observations": [o.model_dump() for o in observations],
            "what_patient_should_understand": what_patient_should_understand,
            "questions_for_doctor": doctor_questions,
            "suggested_next_steps": next_steps,
            "emergency_warning": emergency_warning,
            "disclaimer": disclaimer,
            "sections": sections,
            "model_used": "AI Medical Intelligence Engine v2.0 (10-Section Grounded)"
        }

    # -------------------------------------------------------------------------
    # Document-Grounded Interactive Q&A Engine
    # -------------------------------------------------------------------------
    @classmethod
    def answer_question(
        cls,
        question: str,
        raw_text: str,
        lab_results: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema],
        pages: List[Dict[str, Any]],
        category: str
    ) -> Dict[str, Any]:
        """
        Answers patient questions strictly grounded in the extracted document text.
        Returns the answer along with exact page numbers and supporting text citations.
        If the question cannot be answered from the document, explicitly states so.
        """
        q_clean = question.strip().lower()
        citations = []
        answer = ""
        found = False

        # 1. Querying about a specific lab parameter (e.g. "What is my hemoglobin?")
        for lab in lab_results:
            if lab.parameter_name.lower() in q_clean or lab.normalized_name in q_clean:
                found = True
                flag_str = f" This value is flagged as {lab.flag} compared to reference interval ({lab.reference_range or 'N/A'})." if lab.flag in ["low", "high"] else f" This value is within the standard reference interval ({lab.reference_range or 'N/A'})."
                answer = (
                    f"According to your report on Page {lab.page_number}, your {lab.parameter_name} is measured at "
                    f"{lab.result_value} {lab.unit or ''}.{flag_str}"
                )
                citations.append({
                    "page": lab.page_number,
                    "section": f"Laboratory Parameter: {lab.parameter_name}",
                    "text_snippet": lab.original_text_snippet or f"{lab.parameter_name}: {lab.result_value} {lab.unit or ''}"
                })
                break

        # 2. Querying about abnormal values
        if not found and ("abnormal" in q_clean or "outside" in q_clean or "high" in q_clean or "low" in q_clean):
            abnormals = [l for l in lab_results if l.flag in ["low", "high", "abnormal"]]
            if abnormals:
                found = True
                items = [f"{l.parameter_name} ({l.result_value} {l.unit or ''}, flagged {l.flag}, ref: {l.reference_range or 'N/A'})" for l in abnormals]
                answer = f"The following {len(abnormals)} parameter(s) are recorded outside reference intervals: " + "; ".join(items) + ". Please discuss these with your doctor."
                for l in abnormals:
                    citations.append({
                        "page": l.page_number,
                        "section": "Laboratory Results",
                        "text_snippet": l.original_text_snippet or f"{l.parameter_name}: {l.result_value}"
                    })
            else:
                found = True
                answer = "All extracted laboratory parameters in this document fall within their stated normal reference ranges."
                citations.append({"page": 1, "section": "Laboratory Results", "text_snippet": "All extracted parameters normal."})

        # 3. Querying about medications / prescriptions
        if not found and ("prescription" in q_clean or "medicine" in q_clean or "medication" in q_clean or "tablet" in q_clean or "dosage" in q_clean):
            if prescriptions:
                found = True
                rx_strs = [f"{p.medication_name}: {p.dosage or '1 dose'}, {p.frequency or ''} for {p.duration or 'prescribed duration'}" for p in prescriptions]
                answer = "The prescribed medications documented in your record are:\n• " + "\n• ".join(rx_strs)
                for p in prescriptions:
                    citations.append({
                        "page": p.page_number,
                        "section": "Prescription Order",
                        "text_snippet": f"{p.medication_name} ({p.frequency or ''})"
                    })
            else:
                found = True
                answer = "No active prescription medications or drug regimens were identified in this specific uploaded document."

        # 4. Search raw text blocks across pages
        if not found:
            # Token matching
            tokens = [w for w in re.findall(r"\w+", q_clean) if len(w) > 3 and w not in {"what", "where", "which", "does", "this", "mean", "tell", "about", "your", "have"}]
            best_match_page = 1
            best_match_line = ""
            best_score = 0

            for p in pages:
                p_num = p.get("page_number", 1)
                p_text = p.get("text_content") or p.get("text") or ""
                lines = p_text.split("\n")
                for line in lines:
                    match_count = sum(1 for t in tokens if t in line.lower())
                    if match_count > best_score:
                        best_score = match_count
                        best_match_page = p_num
                        best_match_line = line.strip()

            if best_score >= 1 and len(best_match_line) > 10:
                found = True
                answer = f"From Page {best_match_page} of your document:\n\"{best_match_line}\""
                citations.append({
                    "page": best_match_page,
                    "section": f"Document Text Page {best_match_page}",
                    "text_snippet": best_match_line
                })
            else:
                found = False
                answer = (
                    "This specific information is not stated in your uploaded report. "
                    "The medical document does not contain details answering this question directly. "
                    "Please consult your treating physician or diagnostic center for clinical clarification."
                )

        return {
            "question": question,
            "answer": answer,
            "source_citations": citations,
            "confidence": 0.95 if found else 0.40,
            "found_in_document": found
        }

    # -------------------------------------------------------------------------
    # Helper Section Builders
    # -------------------------------------------------------------------------
    @classmethod
    def _build_what_is_this_document(cls, category: str, sub_category: Optional[str], facility: Optional[str], report_date: Optional[str]) -> str:
        fac = f" issued by {facility}" if facility else ""
        dt = f" on {report_date}" if report_date else ""
        kind = sub_category if sub_category else category

        if "blood" in category.lower():
            return (
                f"This document is a {kind}{fac}{dt}. Blood test panels evaluate circulating cell populations, "
                "biochemical enzymes, metabolic electrolytes, and organ function markers from venous or capillary blood samples."
            )
        elif "prescription" in category.lower():
            return (
                f"This document is a medical prescription{fac}{dt}. Prescriptions specify licensed medication regimens, "
                "dosages, routes of administration, and physician instructions for targeted treatment."
            )
        elif "radiology" in category.lower() or "mri" in category.lower() or "ct" in category.lower():
            return (
                f"This document is a diagnostic radiology imaging report{fac}{dt}. Radiological evaluations provide structural "
                "and anatomical visualization of internal organ systems, bones, and soft tissues."
            )
        elif "discharge" in category.lower():
            return (
                f"This document is a hospital discharge summary{fac}{dt}. It summarizes an inpatient hospital admission, "
                "documenting clinical course, diagnoses, therapeutic procedures, and transition care instructions."
            )
        return (
            f"This is a digitized health record categorized under {kind}{fac}{dt}, indexed into your personal medical vault."
        )

    @classmethod
    def _detect_emergency_red_flags(cls, lab_results: List[LaboratoryResultSchema], raw_text: str) -> Optional[str]:
        flags = []
        for lab in lab_results:
            norm = lab.normalized_name.lower()
            val = lab.numeric_value
            if val is not None:
                if "hemoglobin" in norm and val < 7.0:
                    flags.append(f"Severely low Hemoglobin ({val} {lab.unit or 'g/dL'}) indicating severe anemia.")
                elif "platelet" in norm and val < 25000:
                    flags.append(f"Critical thrombocytopenia (Platelets: {val} {lab.unit or '/uL'}), elevated bleeding risk.")
                elif ("glucose" in norm or "blood sugar" in norm) and (val > 350 or val < 50):
                    flags.append(f"Critical blood glucose level ({val} {lab.unit or 'mg/dL'}).")
                elif "potassium" in norm and (val < 2.8 or val > 6.2):
                    flags.append(f"Critical serum potassium level ({val} {lab.unit or 'mEq/L'}).")
                elif "creatinine" in norm and val > 5.0:
                    flags.append(f"Significantly elevated serum creatinine ({val} {lab.unit or 'mg/dL'}), acute renal strain.")

        if flags:
            return (
                "⚠️ URGENT MEDICAL ATTENTION ADVISORY: One or more parameters in this document reflect critical clinical thresholds: "
                + " ".join(flags)
                + " Please contact your physician immediately or visit the nearest urgent care facility."
            )
        return None

    @classmethod
    def _build_simple_summary(
        cls,
        category: str,
        sub_category: Optional[str],
        total_labs: int,
        abnormal_labs: List[LaboratoryResultSchema],
        normal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema],
        facility: Optional[str],
        report_date: Optional[str]
    ) -> str:
        date_str = f" dated {report_date}" if report_date else ""
        fac_str = f" issued by {facility}" if facility else ""
        kind = sub_category if sub_category else category

        if total_labs > 0:
            if len(abnormal_labs) == 0:
                return (
                    f"This is a {kind}{fac_str}{date_str}. All {total_labs} extracted diagnostic test parameters "
                    f"fall within their expected reference intervals. This indicates that the values assessed are currently in balanced, healthy ranges."
                )
            else:
                abnormal_names = [a.parameter_name for a in abnormal_labs[:4]]
                remaining = len(abnormal_labs) - len(abnormal_names)
                rem_str = f" and {remaining} other parameter(s)" if remaining > 0 else ""
                return (
                    f"This is a {kind}{fac_str}{date_str}. Out of {total_labs} extracted diagnostic parameters, "
                    f"{len(normal_labs)} are within normal reference ranges, while {len(abnormal_labs)} parameter(s) "
                    f"({', '.join(abnormal_names)}{rem_str}) fall outside standard reference limits and warrant review with your physician."
                )

        if len(prescriptions) > 0:
            med_names = [p.medication_name for p in prescriptions[:3]]
            return (
                f"This document is a {kind}{fac_str}{date_str} listing {len(prescriptions)} prescribed medication(s), "
                f"including {', '.join(med_names)}. Review dosing instructions and schedules carefully with your doctor or pharmacist."
            )

        return (
            f"This is a medical document categorized under {kind}{fac_str}{date_str}. "
            f"The document details have been indexed into your personal health record for longitudinal tracking and clinician review."
        )

    @classmethod
    def _build_important_findings(
        cls,
        abnormal_labs: List[LaboratoryResultSchema],
        normal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema],
        raw_text: str
    ) -> List[str]:
        findings = []

        for lab in abnormal_labs:
            direction = "above" if lab.flag == "high" else "below" if lab.flag == "low" else "outside"
            ref_str = f" (standard reference range: {lab.reference_range})" if lab.reference_range else ""
            findings.append(
                f"{lab.parameter_name} is measured at {lab.result_value} {lab.unit or ''}, which is {direction} the expected reference limit{ref_str}."
            )

        if len(normal_labs) > 0:
            sample_normals = [n.parameter_name for n in normal_labs[:5]]
            findings.append(
                f"Normal biomarkers ({len(normal_labs)} total): {', '.join(sample_normals)} are confirmed within healthy reference boundaries."
            )

        if len(prescriptions) > 0:
            for p in prescriptions[:4]:
                dosage_info = f" ({p.strength or ''} {p.frequency or ''})".strip()
                findings.append(f"Prescribed: {p.medication_name}{dosage_info}.")

        if not findings:
            findings.append("No critical numerical anomalies or specific active prescriptions were flagged in this document.")

        return findings

    @classmethod
    def _explain_parameter(cls, lab: LaboratoryResultSchema) -> ParameterExplanation:
        norm = lab.normalized_name.lower()
        kb_entry = None
        for k, v in PARAMETER_KNOWLEDGE_BASE.items():
            if k in norm:
                kb_entry = v
                break

        if not kb_entry:
            kb_entry = {
                "measures": f"A biological indicator ({lab.parameter_name}) evaluated in laboratory diagnostics.",
                "context": "Assessed by healthcare providers to monitor organ systems, cellular metabolism, and systemic homeostasis.",
                "limitations": "Individual values must be interpreted in the context of personal medical history and symptom presentation."
            }

        status_text = "Within Normal Range"
        if lab.flag == "high":
            status_text = "Above Reference Range"
        elif lab.flag == "low":
            status_text = "Below Reference Range"
        elif lab.flag == "abnormal":
            status_text = "Attention Required"

        return ParameterExplanation(
            parameter=lab.parameter_name,
            value=lab.result_value,
            unit=lab.unit,
            reference_range=lab.reference_range,
            status=status_text,
            what_it_measures=kb_entry["measures"],
            clinical_context=kb_entry["context"],
            what_it_cannot_establish=kb_entry["limitations"]
        )

    @classmethod
    def _extract_glossary_terms(cls, raw_text: str, lab_results: List[LaboratoryResultSchema]) -> List[MedicalTermGlossary]:
        glossary = []
        text_lower = raw_text.lower()

        for term, explanation in MEDICAL_GLOSSARY_TERMS.items():
            if re.search(r'\b' + re.escape(term) + r'\b', text_lower):
                glossary.append(MedicalTermGlossary(
                    term=term.capitalize(),
                    simple_explanation=explanation
                ))

        for lab in lab_results[:6]:
            norm = lab.normalized_name.lower()
            if norm in PARAMETER_KNOWLEDGE_BASE and not any(g.term.lower() == lab.parameter_name.lower() for g in glossary):
                glossary.append(MedicalTermGlossary(
                    term=lab.parameter_name,
                    simple_explanation=PARAMETER_KNOWLEDGE_BASE[norm]["measures"]
                ))

        return glossary[:8]

    @classmethod
    def _build_report_observations(
        cls,
        lab_results: List[LaboratoryResultSchema],
        abnormal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema],
        raw_text: str
    ) -> List[ReportObservation]:
        observations = []

        if abnormal_labs:
            observations.append(ReportObservation(
                type="abnormal_value",
                observation=f"{len(abnormal_labs)} parameter(s) fall outside target reference intervals, which warrants clinician correlation.",
                severity="attention"
            ))

        if any(r.requires_verification for r in lab_results) or any(p.requires_verification for p in prescriptions):
            observations.append(ReportObservation(
                type="information_gap",
                observation="Certain text fields had lower automated character recognition certainty; please review and verify against your physical paper report.",
                severity="info"
            ))

        if len(lab_results) > 0 and len(abnormal_labs) == 0:
            observations.append(ReportObservation(
                type="positive_indicator",
                observation="Comprehensive laboratory screening reflects healthy biological parameters without out-of-range deviations.",
                severity="info"
            ))

        return observations

    @classmethod
    def _build_patient_understanding(
        cls,
        category: str,
        abnormal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema]
    ) -> str:
        if abnormal_labs:
            params = [a.parameter_name for a in abnormal_labs]
            return (
                f"While seeing values outside the reference boundary ({', '.join(params)}) can feel concerning, "
                f"laboratory variations occur frequently for temporary physiological reasons (hydration, stress, recent meals) "
                f"as well as chronic health conditions. Do not panic or begin self-treating. The most productive action is to share "
                f"these specific findings with your doctor so they can evaluate them together with your lifestyle, symptoms, and previous medical history."
            )
        elif prescriptions:
            return (
                "Take prescribed medications exactly as directed by your physician. Complete the full course unless your doctor advises otherwise, "
                "and report any unexpected side effects promptly."
            )
        else:
            return (
                "Your test metrics are reassuring and consistent with standard baseline values. Maintaining a balanced diet, regular exercise, "
                "restful sleep, and scheduled periodic health check-ups remains the best long-term wellness strategy."
            )

    @classmethod
    def _build_precautions_guidance(
        cls,
        category: str,
        abnormal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema]
    ) -> Dict[str, Any]:
        """Builds structured 6-part precautions and guidance."""
        what_report_states = f"{len(abnormal_labs)} out-of-range value(s)" if abnormal_labs else "All extracted parameters within reference boundaries"
        what_findings_indicate = "Further correlation with physical symptoms and medical history recommended." if abnormal_labs else "Reassuring baseline parameters."
        what_is_missing = "Historical prior reports for trajectory comparison and clinical symptom correlation."

        doctor_points = [
            "Review findings in relation to current physical symptoms.",
            "Discuss whether repeat testing is required in 4 to 8 weeks."
        ]
        if abnormal_labs:
            doctor_points.insert(0, f"Focus discussion on out-of-range parameter(s): {', '.join([l.parameter_name for l in abnormal_labs[:3]])}.")

        general_precautions = [
            "Do not start, stop, or adjust prescription medications based solely on automated reports.",
            "Bring physical or digital copies of previous test reports to doctor consultations.",
            "Avoid unverified health supplements that could interact with liver or kidney clearance."
        ]

        summary_text = (
            "General Health Guidance: Review your test results directly with your physician. "
            "Maintain standard hydration and lifestyle habits. Do not alter existing therapies without professional medical advice."
        )

        return {
            "summary": summary_text,
            "what_report_states": what_report_states,
            "what_findings_indicate": what_findings_indicate,
            "what_is_missing": what_is_missing,
            "doctor_discussion_points": doctor_points,
            "general_precautions": general_precautions,
            "when_to_seek_attention": "Seek immediate medical care if you experience severe chest pain, shortness of breath, acute dizziness, or sudden neurological symptoms."
        }

    @classmethod
    def _build_when_to_seek_help(cls, abnormal_labs: List[LaboratoryResultSchema], emergency_warning: Optional[str]) -> str:
        if emergency_warning:
            return emergency_warning
        if abnormal_labs:
            return (
                "Routine Consultation Guidance: Schedule an appointment with your doctor within 1 to 2 weeks to discuss your results. "
                "However, if you experience sudden worsening symptoms (severe pain, high fever, shortness of breath, or bleeding), seek prompt medical care immediately."
            )
        return (
            "Preventative Care: Routine screening can continue on your normal annual schedule, unless new physical symptoms emerge."
        )

    @classmethod
    def _build_doctor_questions(
        cls,
        category: str,
        abnormal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema]
    ) -> List[str]:
        questions = []
        if abnormal_labs:
            for lab in abnormal_labs[:3]:
                questions.append(
                    f"My {lab.parameter_name} is {lab.result_value} {lab.unit or ''} (reference range: {lab.reference_range or 'N/A'}). Do you recommend confirmatory testing or lifestyle adjustments?"
                )
            questions.append("Could any of my current medications, diet, or recent activities have influenced these laboratory results?")
            questions.append("When would you like me to repeat this panel to assess trajectory over time?")
        elif prescriptions:
            questions.append("Are there any food interactions or specific times of day I should take these medications?")
            questions.append("What are the most common side effects I should watch out for?")
            questions.append("For how long should I continue taking this medication before we schedule a follow-up review?")
        else:
            questions.append("Based on these normal results, what preventative screening timeline do you suggest for my age and health profile?")
            questions.append("Are there lifestyle or nutrition optimizations you recommend for maintaining these markers?")

        return questions[:5]

    @classmethod
    def _build_next_steps(
        cls,
        abnormal_labs: List[LaboratoryResultSchema],
        prescriptions: List[PrescriptionItemSchema],
        category: str
    ) -> List[str]:
        steps = [
            "Download or print this report summary to share directly during your next physician consultation.",
            "Schedule a routine follow-up consultation with your doctor to review findings in clinical context."
        ]

        if abnormal_labs:
            steps.append("Note any recent physical symptoms, changes in sleep, stress, or diet that might correlate with these values.")
            steps.append("Avoid starting unverified dietary supplements or abrupt medication changes without physician sign-off.")

        if prescriptions:
            steps.append("Set daily mobile reminders or a pill organizer to ensure consistent adherence to dosing schedules.")

        steps.append("Keep this digitized report safely stored in your health record for future longitudinal comparison.")
        return steps
