"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Sparkles,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Printer,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Clock,
  Heart,
  FileText,
  Activity,
  AlertCircle,
  ExternalLink,
  Info,
  Languages,
  Check,
  Stethoscope,
  ListFilter
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ParameterExplanation {
  parameter: string;
  value: string;
  unit?: string;
  reference_range?: string;
  status: string;
  what_it_measures: string;
  clinical_context: string;
  what_it_cannot_establish: string;
}

interface MedicalTermGlossary {
  term: string;
  simple_explanation: string;
}

interface ReportObservation {
  type: string;
  observation: string;
  severity: string;
}

interface DocumentAnalysis {
  id: string;
  document_id: string;
  language?: string;
  simple_summary: string;
  important_findings: string[];
  parameter_explanations: ParameterExplanation[];
  medical_terminology: MedicalTermGlossary[];
  report_observations: ReportObservation[];
  what_patient_should_understand: string;
  questions_for_doctor: string[];
  suggested_next_steps: string[];
  emergency_warning?: string | null;
  disclaimer: string;
  model_used: string;
  created_at: string;
}

export default function DocumentAnalysisPage() {
  const params = useParams();
  const id = params?.id as string;

  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Medical Document");
  const [docCategory, setDocCategory] = useState<string>("Diagnostic Report");
  const [docDate, setDocDate] = useState<string>("Recent");
  const [docFacility, setDocFacility] = useState<string>("Diagnostic Lab");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [loading, setLoading] = useState(true);
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadAnalysisData("en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAnalysisData = async (lang: string = "en") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medical-documents/${id}/analysis?language=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }

      // Fetch document basic metadata
      const docRes = await fetch(`/api/medical-documents/${id}`);
      if (docRes.ok) {
        const docData = await docRes.json();
        setDocTitle(docData.title);
        setDocCategory(docData.sub_classification || docData.document_category);
        setDocDate(docData.report_date || "Recent");
        setDocFacility(docData.issuing_facility || "Diagnostic Clinic");
      }
    } catch (err) {
      console.error("Failed to fetch analysis", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    loadAnalysisData(lang);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-24 text-center">
        <div className="w-10 h-10 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-serif text-[#163B63]">Generating 10-Section Clinical Interpretation...</h3>
        <p className="text-xs text-[#64748B] mt-1">Grounded strictly in verified extracted document boundaries</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-20 text-center space-y-4">
        <h2 className="text-xl font-serif text-[#163B63]">Analysis not ready or document unavailable</h2>
        <Link href={`/patient/medical-records/${id}`}>
          <Button variant="primary" size="sm">
            View Extracted Data
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-10 lg:py-14 text-left print:bg-white print:py-4">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb (hidden in print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
            <Link href="/patient/dashboard" className="hover:text-[#258FE5] transition-colors">
              Patient Sanctuary
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
            <Link href="/patient/medical-records" className="hover:text-[#258FE5] transition-colors">
              Medical Records
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
            <Link href={`/patient/medical-records/${id}`} className="hover:text-[#258FE5] transition-colors truncate max-w-xs">
              {docTitle}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
            <span className="text-[#163B63] font-semibold">AI Clinical Understanding</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Multilingual Switcher */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-[#DCE6EF] shadow-xs">
              <Languages className="w-3.5 h-3.5 text-[#258FE5]" />
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="text-xs font-medium bg-transparent text-[#163B63] focus:outline-none"
              >
                <option value="en">English (EN)</option>
                <option value="te">Telugu (తెలుగు)</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="kn">Kannada (ಕನ್ನಡ)</option>
                <option value="ml">Malayalam (മലയാളം)</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Printer className="w-3.5 h-3.5 text-[#258FE5]" />}
              onClick={handlePrint}
              className="text-xs"
            >
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Clinical Document Header Card */}
        <div className="bg-white rounded-3xl p-7 border border-[#DCE6EF] shadow-subtle space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE6EF] pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                {docCategory}
              </span>
              <span className="text-xs text-[#64748B]">
                Facility: <strong className="text-[#163B63]">{docFacility}</strong>
              </span>
              <span className="text-xs text-[#64748B]">
                Date: <strong className="text-[#163B63]">{docDate}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#163B63] bg-[#EAF5FC] px-3 py-1 rounded-full border border-[#DCE6EF]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Grounded in Extracted Source Data</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
              Comprehensive Clinical Report Understanding
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              Document Reference: {docTitle} • Model: {analysis.model_used}
            </p>
          </div>
        </div>

        {/* Emergency Alert Banner if populated */}
        {analysis.emergency_warning && (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-rose-900 uppercase tracking-wide">
                Urgent Medical Notice
              </h4>
              <p className="text-rose-800 leading-relaxed">
                {analysis.emergency_warning}
              </p>
            </div>
          </div>
        )}

        {/* 10 STRUCTURED CLINICAL SECTIONS */}
        <div className="space-y-6">
          {/* SECTION 1: WHAT IS THIS DOCUMENT? */}
          <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                1
              </span>
              <h3 className="text-base font-serif text-[#163B63]">What Is This Document?</h3>
            </div>
            <p className="text-xs leading-relaxed text-[#0F172A] bg-[#F5F9FC] p-4 rounded-2xl border border-[#DCE6EF]">
              This document is an official <strong>{docCategory}</strong> issued by <strong>{docFacility}</strong>. It contains diagnostic measurements and clinical observations intended to help healthcare professionals evaluate biological status, organ function, or therapeutic progress.
            </p>
          </div>

          {/* SECTION 2: SIMPLE PATIENT-FRIENDLY SUMMARY */}
          <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                2
              </span>
              <h3 className="text-base font-serif text-[#163B63]">Simple Summary</h3>
            </div>
            <p className="text-xs leading-relaxed text-[#0F172A] bg-[#EAF5FC]/60 p-4 rounded-2xl border border-[#20B8AD]/40 font-medium">
              {analysis.simple_summary}
            </p>
          </div>

          {/* SECTION 3: DETAILED PARAMETER EXPLANATIONS */}
          {analysis.parameter_explanations?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                  3
                </span>
                <h3 className="text-base font-serif text-[#163B63]">
                  Detailed Parameter & Biomarker Explanations
                </h3>
              </div>
              <p className="text-xs text-[#64748B]">
                Clear explanations of each measured indicator, what it evaluates, and clinical interpretation limits.
              </p>

              <div className="space-y-3">
                {analysis.parameter_explanations.map((param, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-[#DCE6EF] bg-white hover:border-[#20B8AD] transition-all space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE6EF] pb-2">
                      <div className="font-semibold text-sm text-[#163B63]">
                        {param.parameter}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#258FE5] bg-[#F5F9FC] px-2 py-0.5 rounded border border-[#DCE6EF]">
                          {param.value} {param.unit}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            param.status.toLowerCase().includes("normal")
                              ? "bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF]"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {param.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <strong className="text-[#64748B] block text-[11px]">What it measures:</strong>
                        <span className="text-[#0F172A]">{param.what_it_measures}</span>
                      </div>
                      <div>
                        <strong className="text-[#64748B] block text-[11px]">Clinical Context:</strong>
                        <span className="text-[#0F172A]">{param.clinical_context}</span>
                      </div>
                    </div>

                    {param.what_it_cannot_establish && (
                      <div className="text-[11px] text-amber-900 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
                        <strong>Clinical Limitation: </strong>
                        {param.what_it_cannot_establish}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: IMPORTANT OBSERVATIONS */}
          {analysis.important_findings?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                  4
                </span>
                <h3 className="text-base font-serif text-[#163B63]">Important Observations</h3>
              </div>
              <div className="space-y-2 text-xs">
                {analysis.important_findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFFFFF] border border-[#DCE6EF] text-[#0F172A]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#258FE5] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5: MEDICAL TERMS IN SIMPLE LANGUAGE (GLOSSARY) */}
          {analysis.medical_terminology?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                  5
                </span>
                <h3 className="text-base font-serif text-[#163B63]">
                  Medical Terminology Glossary
                </h3>
              </div>
              <p className="text-xs text-[#64748B]">
                Clinical jargon translated into everyday vocabulary for easy comprehension.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {analysis.medical_terminology.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1"
                  >
                    <div className="font-semibold text-[#163B63]">{t.term}</div>
                    <div className="text-[#64748B] leading-relaxed">{t.simple_explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: WHAT SHOULD THE PATIENT UNDERSTAND? */}
          <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                6
              </span>
              <h3 className="text-base font-serif text-[#163B63]">
                What Should the Patient Understand?
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-[#0F172A] bg-[#F5F9FC] p-4 rounded-2xl border border-[#DCE6EF]">
              {analysis.what_patient_should_understand}
            </p>
          </div>

          {/* SECTION 7: PRECAUTIONS & HEALTH GUIDANCE (6-PART STRUCTURED ADVICE) */}
          <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                7
              </span>
              <h3 className="text-base font-serif text-[#163B63]">
                Precautions and General Health Guidance
              </h3>
            </div>
            <p className="text-xs text-[#64748B]">
              Safe wellness practices to follow while waiting for your clinical consultation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1">
                <strong className="text-[#163B63] block">1. Routine Hydration</strong>
                <span className="text-[#64748B]">
                  Drink adequate water throughout the day to support optimal cellular metabolism.
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1">
                <strong className="text-[#163B63] block">2. Dietary Consistency</strong>
                <span className="text-[#64748B]">
                  Emphasize whole foods, fresh vegetables, and lean proteins; avoid excess refined sugar.
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1">
                <strong className="text-[#163B63] block">3. Medication Adherence</strong>
                <span className="text-[#64748B]">
                  Never start, adjust, or discontinue prescription drugs without direct physician direction.
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1">
                <strong className="text-[#163B63] block">4. Physical Activity</strong>
                <span className="text-[#64748B]">
                  Engage in moderate daily walking and prioritize restorative nightly sleep (7-8 hours).
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1">
                <strong className="text-[#163B63] block">5. Regular Monitoring</strong>
                <span className="text-[#64748B]">
                  Track vital parameters like blood pressure or resting heart rate if advised by your clinic.
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-1">
                <strong className="text-[#163B63] block">6. Symptom Awareness</strong>
                <span className="text-[#64748B]">
                  Note any new headaches, unusual fatigue, or dizziness to share during your doctor visit.
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 8: WHEN TO SEEK MEDICAL HELP */}
          <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                8
              </span>
              <h3 className="text-base font-serif text-[#163B63]">When to Seek Medical Help</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <h4 className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700" />
                  Routine Follow-up (Next 2-4 Weeks)
                </h4>
                <p className="text-amber-800 leading-relaxed">
                  Review mildly elevated or borderline biomarkers with your primary care physician during your regular appointment to discuss trends and lifestyle adjustments.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2">
                <h4 className="font-semibold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                  Urgent Evaluation (Immediate Care)
                </h4>
                <p className="text-rose-800 leading-relaxed">
                  Seek immediate emergency medical attention if you experience severe chest discomfort, sudden shortness of breath, unexplained fainting, or high persistent fever.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 9: QUESTIONS TO ASK YOUR DOCTOR */}
          {analysis.questions_for_doctor?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                  9
                </span>
                <h3 className="text-base font-serif text-[#163B63]">
                  Recommended Questions to Discuss With Your Doctor
                </h3>
              </div>
              <p className="text-xs text-[#64748B]">
                Bring this curated question list to your appointment to make the most of your consultation.
              </p>

              <div className="space-y-2 text-xs">
                {analysis.questions_for_doctor.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3.5 bg-[#EAF5FC]/60 rounded-xl border border-[#DCE6EF] text-[#163B63]"
                  >
                    <span className="font-bold text-[#258FE5] font-mono">{idx + 1}.</span>
                    <span className="font-medium">{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 10: RECOMMENDED NEXT STEPS & CLINICAL DISCLAIMER */}
          <div className="bg-white rounded-3xl p-6 border border-[#DCE6EF] shadow-subtle space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#258FE5] text-white flex items-center justify-center text-xs font-bold font-mono">
                10
              </span>
              <h3 className="text-base font-serif text-[#163B63]">Recommended Next Steps</h3>
            </div>

            <div className="space-y-2 text-xs">
              {analysis.suggested_next_steps?.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-[#FFFFFF] border border-[#DCE6EF] text-[#0F172A]"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-[#258FE5] shrink-0" />
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {/* Official Medical Disclaimer */}
            <div className="mt-4 p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] text-[11px] text-[#64748B] leading-relaxed">
              <strong>Official Medical Disclaimer: </strong>
              {analysis.disclaimer}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 print:hidden">
          <Link href={`/patient/medical-records/${id}`}>
            <Button variant="outline" size="md">
              ← Return to Document Workspace
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/patient/medical-records/compare?ids=${id}`}>
              <Button variant="outline" size="md">
                Compare Biomarker Trends
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
              className="bg-[#258FE5] hover:bg-[#1D78C4]"
            >
              Print / Save Clinical Summary
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
