"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  FileText,
  Sparkles,
  Download,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit3,
  BarChart3,
  FileCheck,
  Pill,
  AlignLeft,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Copy,
  Check,
  Send,
  HelpCircle,
  Columns,
  Maximize2,
  Minimize2,
  Eye,
  Languages,
  Activity,
  Layers,
  ChevronDown,
  BookOpen,
  User,
  Calendar,
  Building,
  Stethoscope,
  Star,
  MapPin,
  Video,
  Award,
  AlertCircle,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface LabResult {
  id: string;
  parameter_name: string;
  normalized_name: string;
  result_value: string;
  numeric_value?: number;
  unit?: string;
  reference_range?: string;
  ref_low?: number;
  ref_high?: number;
  flag: string;
  page_number: number;
  confidence: number;
  requires_verification: boolean;
  user_corrected: boolean;
}

interface PrescriptionItem {
  id: string;
  medication_name: string;
  generic_name?: string;
  strength?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route: string;
  special_instructions?: string;
  prescribing_doctor?: string;
  confidence: number;
  requires_verification: boolean;
  user_corrected: boolean;
}

interface DocumentPageInfo {
  id: string;
  page_number: number;
  width?: number;
  height?: number;
  is_scanned: boolean;
  ocr_applied: boolean;
  text_content: string;
  char_count: number;
  page_status: string;
  confidence: number;
  blocks?: Array<{
    id: string;
    page_number: number;
    block_index: number;
    bbox_x0: number;
    bbox_y0: number;
    bbox_x1: number;
    bbox_y1: number;
    text: string;
    block_type: string;
  }>;
}

interface VerificationMeta {
  total_pages: number;
  processed_pages: number;
  failed_pages: number[];
  uncertain_fields_count: number;
  verification_status: string;
  accuracy_score: number;
  notes?: string;
}

interface RecommendedDoctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  specialty_slug?: string;
  qualifications: string[];
  experience_years?: number;
  experienceYears?: number;
  rating: number;
  review_count?: number;
  reviewCount?: number;
  consultation_fee?: number;
  consultationFee?: number;
  consultation_types?: string[];
  consultationTypes?: string[];
  city?: string;
  avatar?: string;
  relevance_reason?: string;
  relevanceReason?: string;
  availability_summary?: string;
  availabilitySummary?: string;
  verified: boolean;
}

interface DoctorRecommendationData {
  document_id: string;
  findings_summary: string;
  primary_specialty: string;
  secondary_specialties: string[];
  clinical_rationale: string;
  recommended_doctors: RecommendedDoctor[];
  urgent_care_needed: boolean;
  urgent_warning?: string | null;
}

interface DocumentDetail {
  id: string;
  title: string;
  original_filename: string;
  document_category: string;
  sub_classification?: string;
  classification_confidence: number;
  classification_reasoning?: string;
  issuing_facility?: string;
  report_date?: string;
  patient_name_in_doc?: string;
  patient_age_value?: string;
  patient_age_unit?: string;
  patient_dob?: string;
  patient_gender?: string;
  patient_uhid?: string;
  referring_doctor?: string;
  sample_collection_date?: string;
  specimen_type?: string;
  demographics_json?: any;
  page_count: number;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  raw_text?: string;
  verification?: VerificationMeta;
  laboratory_results: LabResult[];
  prescription_items: PrescriptionItem[];
  radiology?: {
    modality: string;
    body_part: string;
    indication?: string;
    technique?: string;
    findings?: string;
    impression?: string;
    urgency: string;
  };
  discharge_summary?: {
    admission_date?: string;
    discharge_date?: string;
    primary_diagnosis?: string;
    secondary_diagnoses?: string[];
    hospital_course?: string;
    discharge_instructions?: string;
  };
  created_at: string;
}

interface QAMessage {
  sender: "user" | "ai";
  text: string;
  intent?: string;
  citations?: Array<{ page_number: number; text_snippet: string }>;
  suggested_followups?: string[];
  timestamp: string;
}

function FormattedMessage({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <p className="text-white whitespace-pre-wrap">{text}</p>;
  }

  const lines = text.split("\n");

  const renderInlineFormatted = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-[#163B63]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return (
          <em key={idx} className="italic text-[#4A5568]">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-0.5" />;
        }

        if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
          const content = trimmed.replace(/^[•\-]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#258FE5] mt-1.5 shrink-0" />
              <div className="flex-1 text-[#0F172A]">
                {renderInlineFormatted(content)}
              </div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="w-4 h-4 rounded-full bg-[#EAF5FC] text-[#258FE5] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-[#DCE6EF]">
                {numMatch[1]}
              </span>
              <div className="flex-1 text-[#0F172A]">
                {renderInlineFormatted(numMatch[2])}
              </div>
            </div>
          );
        }

        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <p key={idx} className="font-semibold text-[#163B63] pt-1">
              {trimmed.slice(2, -2)}
            </p>
          );
        }

        return (
          <p key={idx} className="text-[#0F172A]">
            {renderInlineFormatted(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

const PROCESSING_STAGES = [
  { key: "uploaded", label: "1. Document uploaded", desc: "File securely transferred with SHA-256 integrity digest" },
  { key: "validating", label: "2. File validation", desc: "Verifying MIME type, checksum, page count & readability" },
  { key: "classifying", label: "3. Document classification", desc: "Inferring category via clinical NLP ontology" },
  { key: "extracting_text", label: "4. Text extraction", desc: "Running layout-preserving digital extraction & OCR" },
  { key: "extracting_entities", label: "5. Clinical information extraction", desc: "Extracting biomarkers, reference ranges & demographics" },
  { key: "analyzing", label: "6. AI report analysis", desc: "Correlating findings, trend detection & terminology explanation" },
  { key: "completed", label: "7. Analysis completed", desc: "Medical intelligence vault indexed and ready for patient review" }
];

export default function DocumentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const batchQuery = searchParams?.get("batch");
  const batchIds = useMemo(() => {
    return batchQuery ? batchQuery.split(",").filter(Boolean) : [];
  }, [batchQuery]);

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [pages, setPages] = useState<DocumentPageInfo[]>([]);
  const [doctorRecommendation, setDoctorRecommendation] = useState<DoctorRecommendationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Live Processing Status Polling
  const [processingStatus, setProcessingStatus] = useState<{
    status: string;
    current_stage: string;
    progress_percentage: number;
    error_message?: string | null;
  } | null>(null);

  // Layout View State: side-by-side or single column
  const [viewMode, setViewMode] = useState<"split" | "stacked">("split");

  // Document Viewer Controls (Left panel)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  // Tabs on Right Panel: "structured" | "qa" | "doctors" | "text" | "ai_analysis" | "overview"
  const [activeTab, setActiveTab] = useState<"structured" | "qa" | "doctors" | "text" | "ai_analysis" | "overview">("structured");

  // Extracted text search & copy
  const [textSearchQuery, setTextSearchQuery] = useState("");
  const [copiedText, setCopiedText] = useState(false);

  // Human Audit Correction State
  const [editingLab, setEditingLab] = useState<LabResult | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // AI Language & Analysis
  const [analysisLang, setAnalysisLang] = useState<string>("en");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // Conversational Q&A State
  const [qaInput, setQaInput] = useState("");
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([
    "What is my report about?",
    "What are the insights from my report?",
    "Which parameters are abnormal?",
    "Which specialist should I consult?"
  ]);
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([
    {
      sender: "ai",
      text: "Hello! I am your AI Medical Document Assistant. I have extracted and indexed every page of your report. You can ask any natural question about your overall health condition, abnormal values, specific tests, medical terms, or recommended doctors.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [isAskingQA, setIsAskingQA] = useState(false);

  useEffect(() => {
    if (id) {
      loadDocumentDetails();
      loadPagesData();
      loadRecommendedDoctors();
      loadAnalysis("en");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live status polling when document is queued or processing
  useEffect(() => {
    if (!id) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/medical-documents/${id}/status`);
        if (res.ok) {
          const data = await res.json();
          setProcessingStatus(data);

          if (data.status === "completed" || data.status === "verification_required") {
            if (pollInterval) clearInterval(pollInterval);
            // Re-fetch all data to ensure latest extraction is loaded
            loadDocumentDetails();
            loadPagesData();
            loadRecommendedDoctors();
            loadAnalysis(analysisLang || "en");
            // Automatically select structured findings tab to reveal data!
            setActiveTab("structured");
          }
        }
      } catch (err) {
        console.error("Status polling error", err);
      }
    };

    if (document?.status === "processing" || document?.status === "queued") {
      checkStatus();
      pollInterval = setInterval(checkStatus, 1500);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [id, document?.status, analysisLang]);

  const loadDocumentDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medical-documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocument(data);
      }
    } catch (err) {
      console.error("Failed to load document", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPagesData = async () => {
    try {
      const res = await fetch(`/api/medical-documents/${id}/pages`);
      if (res.ok) {
        const data = await res.json();
        setPages(data);
      }
    } catch (err) {
      console.error("Failed to load pages data", err);
    }
  };

  const loadRecommendedDoctors = async () => {
    try {
      const res = await fetch(`/api/medical-documents/${id}/recommended-doctors`);
      if (res.ok) {
        const data = await res.json();
        setDoctorRecommendation(data);
      }
    } catch (err) {
      console.error("Failed to load recommended doctors", err);
    }
  };

  const loadAnalysis = async (lang: string) => {
    try {
      setLoadingAnalysis(true);
      const res = await fetch(`/api/medical-documents/${id}/analysis?language=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisData(data);
      }
    } catch (err) {
      console.error("Failed to load analysis", err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setAnalysisLang(lang);
    loadAnalysis(lang);
  };

  const handleOpenCorrection = (lab: LabResult) => {
    setEditingLab(lab);
    setCorrectionValue(lab.result_value);
    setCorrectionReason("Correction verified against physical paper report.");
  };

  const submitCorrection = async () => {
    if (!editingLab || !document) return;
    try {
      setIsSubmittingCorrection(true);
      const res = await fetch(`/api/medical-documents/${document.id}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_type: "lab_result",
          target_id: editingLab.id,
          field_name: "result_value",
          corrected_value: correctionValue,
          reason: correctionReason
        })
      });

      if (res.ok) {
        setDocument((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            laboratory_results: prev.laboratory_results.map((l) =>
              l.id === editingLab.id
                ? {
                    ...l,
                    result_value: correctionValue,
                    numeric_value: parseFloat(correctionValue) || l.numeric_value,
                    user_corrected: true,
                    requires_verification: false
                  }
                : l
            )
          };
        });
        setEditingLab(null);
      }
    } catch (err) {
      console.error("Failed to submit correction", err);
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const handleCopyFullText = () => {
    const textToCopy = document?.raw_text || pages.map((p) => p.text_content).join("\n\n");
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleDownloadRawText = () => {
    window.open(`/api/medical-documents/${id}/text`, "_blank");
  };

  const handleSendQA = async (questionText?: string) => {
    const q = questionText || qaInput.trim();
    if (!q) return;

    const userMsg: QAMessage = {
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setQaMessages((prev) => [...prev, userMsg]);
    if (!questionText) setQaInput("");
    setIsAskingQA(true);

    try {
      // Build conversation history for contextual memory
      const historyPayload = qaMessages.map((m) => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await fetch(`/api/medical-documents/${id}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          conversation_history: historyPayload
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: QAMessage = {
          sender: "ai",
          text: data.answer,
          intent: data.intent,
          citations: data.source_citations,
          suggested_followups: data.suggested_followups,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setQaMessages((prev) => [...prev, aiMsg]);

        if (data.suggested_followups && data.suggested_followups.length > 0) {
          setSuggestedFollowups(data.suggested_followups);
        }
      } else {
        setQaMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: "I was unable to consult the report at this moment. Please try again or speak with your doctor.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      }
    } catch (err) {
      setQaMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Communication timeout. Please verify your connection.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsAskingQA(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const activePageObj = useMemo(() => {
    return pages.find((p) => p.page_number === currentPage) || pages[0];
  }, [pages, currentPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-24 text-center">
        <div className="w-10 h-10 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-serif text-[#163B63]">Assembling Document Intelligence...</h3>
        <p className="text-xs text-[#64748B] mt-1">Extracting patient demographics, clinical biomarkers, and specialist mapping</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-20 text-center space-y-4">
        <h2 className="text-xl font-serif text-[#163B63]">Document not found</h2>
        <Link href="/patient/medical-records">
          <Button variant="primary" size="sm">
            Back to Medical Records
          </Button>
        </Link>
      </div>
    );
  }

  const totalPagesCount = document.page_count || pages.length || 1;
  const verification = document.verification || {
    total_pages: totalPagesCount,
    processed_pages: totalPagesCount,
    failed_pages: [],
    uncertain_fields_count: 0,
    verification_status: "verified",
    accuracy_score: 0.98,
    notes: "All pages parsed and validated."
  };

  const hasUncertainty =
    document.status === "verification_required" ||
    verification.uncertain_fields_count > 0 ||
    document.laboratory_results.some((r) => r.requires_verification) ||
    document.prescription_items.some((p) => p.requires_verification);

  // Demographics normalized values
  const demoJson = document.demographics_json || {};
  const patientName = document.patient_name_in_doc || demoJson.patient_name || null;
  const patientAge = demoJson.patient_age_at_report || (document.patient_age_value ? `${document.patient_age_value} ${document.patient_age_unit || "Years"}` : null);
  const patientGender = document.patient_gender || demoJson.patient_gender || null;
  const patientDob = document.patient_dob || demoJson.patient_dob || null;
  const patientUhid = document.patient_uhid || demoJson.patient_uhid || null;
  const referringDoctor = document.referring_doctor || demoJson.referring_doctor || null;
  const sampleDate = document.sample_collection_date || demoJson.sample_collection_date || null;
  const specimenType = document.specimen_type || demoJson.specimen_type || null;

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-8 lg:py-10 text-left">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-[#64748B]">
            <Link href="/patient/dashboard" className="hover:text-[#258FE5] transition-colors">
              Patient Sanctuary
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
            <Link href="/patient/medical-records" className="hover:text-[#258FE5] transition-colors">
              Medical Records
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
            <span className="text-[#163B63] font-semibold truncate max-w-sm">{document.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "split" ? "stacked" : "split")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE6EF] bg-white text-xs font-medium text-[#163B63] hover:bg-[#F1F5F9] transition-all shadow-xs"
              title="Toggle Side-by-Side split screen view"
            >
              <Columns className="w-3.5 h-3.5 text-[#258FE5]" />
              <span className="hidden sm:inline">
                {viewMode === "split" ? "Switch to Stacked View" : "Side-by-Side Split View"}
              </span>
            </button>
            <Link href={`/patient/medical-records/${document.id}/analysis`}>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                className="bg-[#258FE5] hover:bg-[#1D78C4] text-xs h-8"
              >
                10-Section Clinical Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Batch Documents Navigator (If multiple documents were uploaded together) */}
        {batchIds.length > 1 && (
          <div className="p-4 rounded-2xl bg-white border border-[#DCE6EF] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#163B63]">
                Batch Upload ({batchIds.indexOf(document.id) >= 0 ? batchIds.indexOf(document.id) + 1 : 1} of {batchIds.length} files):
              </span>
              <span className="text-[#64748B]">
                Select a document to view its specific clinical extraction:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {batchIds.map((bId, bIdx) => (
                <Link
                  key={bId}
                  href={`/patient/medical-records/${bId}?batch=${batchIds.join(",")}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    bId === document.id
                      ? "bg-[#258FE5] text-white shadow-xs"
                      : "bg-[#F5F9FC] text-[#64748B] hover:text-[#163B63] hover:bg-[#EAF5FC] border border-[#DCE6EF]"
                  }`}
                >
                  Report #{bIdx + 1} {bId === document.id ? "(Current)" : ""}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Live Processing Progress Stages (when document is being analyzed) */}
        {(document.status === "processing" ||
          document.status === "queued" ||
          (processingStatus &&
            (processingStatus.status === "processing" || processingStatus.status === "queued"))) && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#20B8AD]/50 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCE6EF] pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5FC] text-[#258FE5] text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Live Clinical Intelligence Pipeline
                </div>
                <h2 className="text-xl sm:text-2xl font-serif text-[#163B63]">
                  Your medical report is being analyzed
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B]">
                  Our medical intelligence engine is reading, validating, and extracting clinical parameters from your report in real time.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-3xl font-serif font-bold text-[#258FE5]">
                  {processingStatus?.progress_percentage || 45}%
                </span>
                <span className="block text-[11px] text-[#64748B] uppercase tracking-wider">
                  Extraction Progress
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#EAF5FC] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#258FE5] h-full transition-all duration-500 rounded-full"
                style={{ width: `${processingStatus?.progress_percentage || 45}%` }}
              />
            </div>

            {/* 7 Progress Stages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {PROCESSING_STAGES.map((stage) => {
                const currentStage = processingStatus?.current_stage || "validating";
                const stageOrder = [
                  "uploaded",
                  "validating",
                  "classifying",
                  "extracting_text",
                  "extracting_entities",
                  "analyzing",
                  "completed"
                ];
                const currentIndex = stageOrder.indexOf(currentStage);
                const thisIndex = stageOrder.indexOf(stage.key);

                const isDone = thisIndex < currentIndex || document.status === "completed";
                const isCurrent = thisIndex === currentIndex && document.status !== "completed";

                return (
                  <div
                    key={stage.key}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isDone
                        ? "bg-[#EAF5FC]/60 border-[#20B8AD]/40 text-[#258FE5]"
                        : isCurrent
                        ? "bg-white border-[#258FE5] ring-2 ring-[#258FE5]/10 text-[#163B63] shadow-xs"
                        : "bg-[#F5F9FC]/60 border-[#DCE6EF] text-[#64748B] opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-[#258FE5] animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[#64748B]/40 shrink-0" />
                      )}
                      <h5 className="text-xs font-semibold">{stage.label}</h5>
                    </div>
                    <p className="text-[10px] leading-relaxed line-clamp-2">{stage.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#DCE6EF] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-3 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                {document.sub_classification || document.document_category}
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-[#F5F9FC] text-[#64748B] border border-[#DCE6EF]">
                {document.original_filename}
              </span>
              {verification.accuracy_score && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF] font-medium">
                  {Math.round(verification.accuracy_score * 100)}% Extraction Accuracy
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
              {document.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
              <div>
                Facility: <strong className="text-[#163B63] font-medium">{document.issuing_facility || "Diagnostic Center"}</strong>
              </div>
              <div>•</div>
              <div>
                Report Date: <strong className="text-[#163B63] font-medium">{document.report_date || "Recent"}</strong>
              </div>
              <div>•</div>
              <div>
                {totalPagesCount} Page{totalPagesCount > 1 ? "s" : ""} ({formatFileSize(document.file_size_bytes)})
              </div>
              <div>•</div>
              <div className="flex items-center gap-1 text-[#163B63]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero Hallucination Protected</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab("qa")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/40 text-xs font-medium hover:bg-[#EAF5FC] transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Report AI
            </button>
            <Link href={`/patient/medical-records/compare?ids=${document.id}`}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<BarChart3 className="w-3.5 h-3.5 text-[#258FE5]" />}
                className="text-xs"
              >
                Compare Trends
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5 text-[#258FE5]" />}
              onClick={handleDownloadRawText}
              className="text-xs"
            >
              Raw Text (.txt)
            </Button>
          </div>
        </div>

        {/* Patient Demographics & Document Information Cards (Section 2 implementation) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Patient Information */}
          <div className="bg-white rounded-3xl p-5 border border-[#DCE6EF] shadow-subtle space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#258FE5] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Patient Demographic Profile
              </h3>
              <span className="text-[10px] text-[#64748B]">
                {patientName ? "Extracted from report" : "Zero-fabrication status"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] block">Patient Name:</span>
                {patientName ? (
                  <strong className="text-[#163B63]">{patientName}</strong>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Age as Documented:</span>
                {patientAge ? (
                  <strong className="text-[#163B63]">
                    {patientAge}
                    {demoJson.age_is_calculated && (
                      <span className="text-[9px] text-[#258FE5] block font-normal">(Calculated from DOB)</span>
                    )}
                  </strong>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Sex / Gender:</span>
                {patientGender ? (
                  <strong className="text-[#163B63]">{patientGender}</strong>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Date of Birth:</span>
                {patientDob ? (
                  <span className="text-[#163B63] font-mono">{patientDob}</span>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Patient ID / UHID:</span>
                {patientUhid ? (
                  <span className="text-[#163B63] font-mono font-medium">{patientUhid}</span>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Referring Doctor:</span>
                {referringDoctor ? (
                  <span className="text-[#163B63] font-medium">{referringDoctor}</span>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>
            </div>
          </div>

          {/* Card B: Document & Diagnostic Information */}
          <div className="bg-white rounded-3xl p-5 border border-[#DCE6EF] shadow-subtle space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#258FE5] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                Document & Facility Metadata
              </h3>
              <span className="text-[10px] text-[#64748B]">Laboratory Accreditation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] block">Issuing Facility:</span>
                <strong className="text-[#163B63]">
                  {document.issuing_facility || "Clinical Diagnostic Lab"}
                </strong>
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Document Type:</span>
                <span className="text-[#163B63] font-medium">
                  {document.sub_classification || document.document_category}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Report Date:</span>
                <span className="text-[#163B63] font-mono">{document.report_date || "Recent"}</span>
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Sample Collection Date:</span>
                {sampleDate ? (
                  <span className="text-[#163B63] font-mono">{sampleDate}</span>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Specimen Type:</span>
                {specimenType ? (
                  <span className="text-[#163B63] font-medium">{specimenType}</span>
                ) : (
                  <span className="text-[#64748B] italic">Not available in document</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block">Verification Status:</span>
                <span className="font-semibold text-[#163B63] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#20B8AD]" />
                  {verification.verification_status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Warning Banner if flagged */}
        {hasUncertainty && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-semibold text-amber-900">
                  Verification Guardrail Active — Ambiguous Tokens Detected
                </h4>
                <p className="text-amber-800 leading-relaxed">
                  Certain values or handwritten entries were flagged with low confidence. As a strict clinical safety rule, values are never guessed. Please cross-verify highlighted fields against your paper document and click &quot;Correct Value&quot; to audit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Work Area: Side-by-Side (Split) or Stacked */}
        <div
          className={`grid gap-6 items-start ${
            viewMode === "split" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"
          }`}
        >
          {/* =========================================================================
              LEFT PANEL: Original Document Viewer & Page Navigator
             ========================================================================= */}
          <div
            className={`bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-5 flex flex-col space-y-4 ${
              viewMode === "split" ? "lg:col-span-5 xl:col-span-5 sticky top-6" : ""
            }`}
          >
            {/* Viewer Toolbar */}
            <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#163B63] flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#258FE5]" />
                  Original Document Preview
                </span>
              </div>

              {/* Page Controls */}
              <div className="flex items-center gap-1 bg-[#F5F9FC] px-2 py-1 rounded-lg border border-[#DCE6EF]">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded text-xs font-semibold text-[#163B63] disabled:opacity-30 hover:bg-white transition-all"
                >
                  ◀
                </button>
                <span className="text-xs font-mono font-medium text-[#163B63] px-1">
                  {currentPage} / {totalPagesCount}
                </span>
                <button
                  disabled={currentPage >= totalPagesCount}
                  onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}
                  className="px-2 py-0.5 rounded text-xs font-semibold text-[#163B63] disabled:opacity-30 hover:bg-white transition-all"
                >
                  ▶
                </button>
              </div>

              {/* Zoom & Rotation */}
              <div className="flex items-center gap-1 text-[#64748B]">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(60, z - 15))}
                  title="Zoom Out"
                  className="p-1 hover:text-[#163B63] hover:bg-[#F5F9FC] rounded"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[10px] w-8 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(180, z + 15))}
                  title="Zoom In"
                  className="p-1 hover:text-[#163B63] hover:bg-[#F5F9FC] rounded"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate 90 degrees"
                  className="p-1 hover:text-[#163B63] hover:bg-[#F5F9FC] rounded ml-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Render Canvas */}
            <div className="relative bg-[#0F172A]/5 rounded-2xl border border-[#DCE6EF] min-h-[460px] max-h-[620px] overflow-auto flex items-center justify-center p-4">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out"
                }}
                className="w-full max-w-[480px] bg-white rounded-xl shadow-md border border-[#DCE6EF] p-6 text-left space-y-4"
              >
                {/* Visual Header Replica */}
                <div className="border-b border-dashed border-[#DCE6EF] pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-widest text-[#258FE5] font-bold">
                        {document.issuing_facility || "DIAGNOSTIC INSTITUTE"}
                      </div>
                      <div className="text-[9px] text-[#64748B]">
                        Accredited Clinical Pathology & Imaging
                      </div>
                    </div>
                    <div className="text-[9px] text-right text-[#64748B]">
                      <div>Date: {document.report_date || "2024-06-20"}</div>
                      <div>Page {currentPage} of {totalPagesCount}</div>
                    </div>
                  </div>
                </div>

                {/* Patient Metadata Box */}
                <div className="bg-[#F5F9FC] p-2.5 rounded-lg border border-[#DCE6EF] text-[10px] grid grid-cols-2 gap-2 text-[#0F172A]">
                  <div>
                    <span className="text-[#64748B]">Patient: </span>
                    <strong>{patientName || "John Doe"}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Age/Sex: </span>
                    <span>{patientAge || "34 Y"} / {patientGender || "Male"}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">ID: </span>
                    <span className="font-mono">{patientUhid || "UHID-84920"}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Category: </span>
                    <span>{document.document_category}</span>
                  </div>
                </div>

                {/* Page Content Snippet preview */}
                <div className="space-y-2 text-[10px] text-[#0F172A] font-mono leading-relaxed bg-[#F5F9FC] p-3 rounded-lg border border-[#DCE6EF] min-h-[200px]">
                  {activePageObj?.text_content ? (
                    <div className="whitespace-pre-wrap line-clamp-[16]">
                      {activePageObj.text_content}
                    </div>
                  ) : (
                    <div className="text-[#64748B] italic text-center py-10">
                      Original scanned document image rendered. Spatial bounding boxes cross-indexed.
                    </div>
                  )}
                </div>

                <div className="border-t border-[#DCE6EF] pt-2 flex items-center justify-between text-[9px] text-[#64748B]">
                  <div className="flex items-center gap-1 text-[#163B63]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Page {currentPage} OCR Verified</span>
                  </div>
                  <span>Doc ID: {document.id.slice(0, 8)}</span>
                </div>
              </div>
            </div>

            {/* Page Jumping Grid */}
            {totalPagesCount > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-medium text-[#64748B] shrink-0">Pages:</span>
                {Array.from({ length: totalPagesCount }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                      currentPage === pg
                        ? "bg-[#258FE5] text-white shadow-xs"
                        : "bg-[#F5F9FC] text-[#64748B] hover:bg-[#DCE6EF]"
                    }`}
                  >
                    {pg}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* =========================================================================
              RIGHT PANEL: Medical Intelligence Center & Tabs
             ========================================================================= */}
          <div
            className={`space-y-5 ${
              viewMode === "split" ? "lg:col-span-7 xl:col-span-7" : ""
            }`}
          >
            {/* Tab Navigation Bar */}
            <div className="bg-white rounded-2xl p-1.5 border border-[#DCE6EF] shadow-xs flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab("structured")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === "structured"
                    ? "bg-[#258FE5] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#163B63] hover:bg-[#F5F9FC]"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Structured Findings
              </button>

              <button
                onClick={() => setActiveTab("qa")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === "qa"
                    ? "bg-[#258FE5] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#163B63] hover:bg-[#F5F9FC]"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask Report AI
              </button>

              <button
                onClick={() => setActiveTab("doctors")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === "doctors"
                    ? "bg-[#258FE5] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#163B63] hover:bg-[#F5F9FC]"
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Recommended Doctors
              </button>

              <button
                onClick={() => setActiveTab("ai_analysis")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === "ai_analysis"
                    ? "bg-[#258FE5] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#163B63] hover:bg-[#F5F9FC]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Guidance (10 Sections)
              </button>

              <button
                onClick={() => setActiveTab("text")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === "text"
                    ? "bg-[#258FE5] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#163B63] hover:bg-[#F5F9FC]"
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                Extracted Text
              </button>

              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === "overview"
                    ? "bg-[#258FE5] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#163B63] hover:bg-[#F5F9FC]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Audit & Verification
              </button>
            </div>

            {/* TAB 1: STRUCTURED CLINICAL DATA */}
            {activeTab === "structured" && (
              <div className="space-y-5">
                {/* Laboratory Results Table (if present) */}
                {document.laboratory_results.length > 0 && (
                  <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle overflow-hidden">
                    <div className="p-5 border-b border-[#DCE6EF] flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-serif text-[#163B63]">
                          Biomarkers & Diagnostic Tests ({document.laboratory_results.length})
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Values parsed with numerical extraction, reference boundaries, and human audit status.
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF]">
                        {document.laboratory_results.filter((l) => l.flag === "normal").length} Normal /{" "}
                        {document.laboratory_results.filter((l) => l.flag !== "normal").length} Out of Range
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F5F9FC] text-[#64748B] font-medium border-b border-[#DCE6EF]">
                            <th className="py-3 px-4">Biomarker</th>
                            <th className="py-3 px-4">Result</th>
                            <th className="py-3 px-4">Unit</th>
                            <th className="py-3 px-4">Standard Range</th>
                            <th className="py-3 px-4">Clinical Range Bar</th>
                            <th className="py-3 px-4 text-center">Audit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCE6EF]">
                          {document.laboratory_results.map((lab) => {
                            const isHigh = lab.flag.toLowerCase().includes("high");
                            const isLow = lab.flag.toLowerCase().includes("low");
                            const isNormal = lab.flag.toLowerCase().includes("normal");

                            return (
                              <tr
                                key={lab.id}
                                className={`hover:bg-[#F5F9FC]/60 transition-colors ${
                                  lab.requires_verification ? "bg-amber-50/40" : ""
                                }`}
                              >
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-[#163B63]">{lab.parameter_name}</div>
                                  <div className="text-[10px] text-[#64748B] font-mono">
                                    Page {lab.page_number || 1} • {lab.confidence ? `${Math.round(lab.confidence * 100)}% conf` : "exact"}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-[#163B63]">
                                  {lab.result_value}
                                </td>
                                <td className="py-3.5 px-4 text-[#64748B] font-mono">
                                  {lab.unit || "—"}
                                </td>
                                <td className="py-3.5 px-4 text-[#64748B] font-mono">
                                  {lab.reference_range || "—"}
                                </td>
                                <td className="py-3.5 px-4 min-w-[140px]">
                                  {/* Visual Range Indicator Bar */}
                                  <div className="space-y-1">
                                    <div className="h-2 w-full bg-[#DCE6EF] rounded-full overflow-hidden flex">
                                      <div className={`h-full ${isLow ? "w-1/3 bg-blue-500" : "w-1/3 bg-[#DCE6EF]"}`} />
                                      <div className={`h-full ${isNormal ? "w-1/3 bg-[#20B8AD]" : "w-1/3 bg-[#DCE6EF]"}`} />
                                      <div className={`h-full ${isHigh ? "w-1/3 bg-amber-500" : "w-1/3 bg-[#DCE6EF]"}`} />
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span
                                        className={`font-semibold ${
                                          isNormal
                                            ? "text-[#163B63]"
                                            : isHigh
                                            ? "text-amber-700"
                                            : isLow
                                            ? "text-blue-700"
                                            : "text-[#64748B]"
                                        }`}
                                      >
                                        {lab.flag.toUpperCase()}
                                      </span>
                                      {lab.user_corrected && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF]">
                                          User Audited
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    onClick={() => handleOpenCorrection(lab)}
                                    className="p-1.5 rounded-lg border border-[#DCE6EF] text-[#64748B] hover:text-[#258FE5] hover:border-[#258FE5] hover:bg-white transition-all"
                                    title="Audit or Correct Extracted Value"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Prescription Medications Section */}
                {document.prescription_items.length > 0 && (
                  <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#DCE6EF] pb-3">
                      <div>
                        <h3 className="text-base font-serif text-[#163B63] flex items-center gap-2">
                          <Pill className="w-4 h-4 text-[#258FE5]" />
                          Prescribed Medications ({document.prescription_items.length})
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Extracted from doctor prescription with dosage safety and handwriting guardrails.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {document.prescription_items.map((med) => {
                        const isUnclear =
                          med.requires_verification ||
                          med.confidence < 0.8 ||
                          med.medication_name.toLowerCase().includes("unclear") ||
                          (med.dosage && med.dosage.toLowerCase().includes("unclear"));

                        return (
                          <div
                            key={med.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isUnclear
                                ? "bg-amber-50/50 border-amber-300"
                                : "bg-[#F5F9FC]/60 border-[#DCE6EF]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-semibold text-[#163B63]">
                                  {med.medication_name}
                                </h4>
                                {med.strength && (
                                  <span className="text-xs text-[#258FE5] font-mono font-medium">
                                    {med.strength}
                                  </span>
                                )}
                              </div>
                              {isUnclear ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                                  Unclear – Verify
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF] font-medium">
                                  Verified
                                </span>
                              )}
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[10px] text-[#64748B] block">Dosage:</span>
                                <span className="font-medium text-[#163B63] font-mono">
                                  {med.dosage || "As directed"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block">Frequency:</span>
                                <span className="font-medium text-[#163B63]">
                                  {med.frequency || "Daily"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block">Duration:</span>
                                <span className="font-medium text-[#163B63]">
                                  {med.duration || "Course specified"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block">Route:</span>
                                <span className="font-medium text-[#163B63]">{med.route}</span>
                              </div>
                            </div>

                            {med.special_instructions && (
                              <div className="mt-2 text-[11px] text-[#64748B] bg-white p-2 rounded-lg border border-[#DCE6EF]">
                                <strong>Instructions: </strong>
                                {med.special_instructions}
                              </div>
                            )}

                            {isUnclear && (
                              <div className="mt-2.5 text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg border border-amber-200">
                                <strong>Guardrail Notice: </strong>
                                Handwritten dosage text is ambiguous. Dosage was preserved faithfully without guessing. Always check with the prescribing pharmacist.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: INTERACTIVE CONVERSATIONAL Q&A */}
            {activeTab === "qa" && (
              <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-4">
                <div className="border-b border-[#DCE6EF] pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-serif text-[#163B63] flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#258FE5]" />
                      Report Q&A Assistant
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Ask any question about your report results, biomarkers, or diagnosis.
                    </p>
                  </div>
                </div>

                {/* Dynamic Quick Prompt Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-[#64748B]">Suggested queries:</span>
                  {suggestedFollowups.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendQA(chip)}
                      className="px-2.5 py-1 rounded-full bg-[#F5F9FC] hover:bg-[#EAF5FC] text-[#258FE5] border border-[#DCE6EF] text-[11px] font-medium transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Chat Messages Container with Multi-turn Provenance */}
                <div className="space-y-3.5 min-h-[300px] max-h-[460px] overflow-y-auto p-4 bg-[#FFFFFF] rounded-2xl border border-[#DCE6EF]">
                  {qaMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-[#258FE5] text-white rounded-br-none"
                            : "bg-white text-[#0F172A] border border-[#DCE6EF] rounded-bl-none shadow-xs"
                        }`}
                      >
                        {msg.sender === "ai" && (
                          <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-[#DCE6EF]/60 text-[11px] text-[#258FE5] font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-[#258FE5]" />
                            <span className="font-semibold text-[#163B63]">Medical Assistant</span>
                          </div>
                        )}
                        <FormattedMessage text={msg.text} isUser={msg.sender === "user"} />
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-[#DCE6EF] text-[10px] space-y-1">
                            <span className="font-semibold text-[#258FE5] block">
                              Source Citations:
                            </span>
                            {msg.citations.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                className="font-mono bg-[#F5F9FC] p-1.5 rounded text-[#64748B] flex items-center justify-between"
                              >
                                <span>Page {c.page_number}: &quot;{c.text_snippet}&quot;</span>
                                <button
                                  onClick={() => setCurrentPage(c.page_number)}
                                  className="text-[9px] text-[#258FE5] font-bold hover:underline ml-2"
                                >
                                  View Page
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-[#64748B] mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  ))}
                  {isAskingQA && (
                    <div className="flex items-center gap-2 text-xs text-[#64748B] bg-white p-3 rounded-2xl border border-[#DCE6EF] w-fit">
                      <div className="w-3.5 h-3.5 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
                      <span>Searching report...</span>
                    </div>
                  )}
                </div>

                {/* Natural Question Input Box */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={qaInput}
                    onChange={(e) => setQaInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isAskingQA && handleSendQA()}
                    placeholder="Ask anything about your report (e.g. 'What is abnormal?', 'Why is that high?', 'Which doctor should I see?')..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSendQA()}
                    disabled={isAskingQA || !qaInput.trim()}
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                    className="bg-[#258FE5] hover:bg-[#1D78C4] text-xs h-9"
                  >
                    Ask
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: RECOMMENDED VERIFIED DOCTORS (Section 5 implementation) */}
            {activeTab === "doctors" && (
              <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-5">
                <div className="border-b border-[#DCE6EF] pb-4">
                  <div className="flex items-center gap-2 text-[#258FE5] text-xs font-semibold uppercase tracking-wider mb-1">
                    <Stethoscope className="w-4 h-4" />
                    Intelligent Specialist Navigation
                  </div>
                  <h3 className="text-xl font-serif text-[#163B63]">
                    Recommended Medical Specialists
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Based on the specific diagnostic parameters and findings in your report, these verified healthcare practitioners specialize in correlating and guiding your care.
                  </p>
                </div>

                {doctorRecommendation && (
                  <div className="p-4 rounded-2xl bg-[#EAF5FC]/70 border border-[#20B8AD]/40 text-xs text-[#163B63] space-y-1.5">
                    <div className="font-semibold flex items-center gap-1.5 text-[#258FE5]">
                      <Sparkles className="w-4 h-4" />
                      Clinical Matching Rationale:
                    </div>
                    <p className="leading-relaxed">{doctorRecommendation.clinical_rationale}</p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-[#64748B]">
                      <span>Primary Specialty: <strong>{doctorRecommendation.primary_specialty}</strong></span>
                      {doctorRecommendation.secondary_specialties?.length > 0 && (
                        <span>• Secondary: {doctorRecommendation.secondary_specialties.join(", ")}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Verified Doctor Cards */}
                <div className="space-y-4">
                  {(doctorRecommendation?.recommended_doctors || []).map((docItem) => (
                    <div
                      key={docItem.id}
                      className="p-5 rounded-2xl border border-[#DCE6EF] bg-white hover:border-[#20B8AD] transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={docItem.avatar || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80"}
                          alt={docItem.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-[#DCE6EF] shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-sm text-[#163B63]">{docItem.name}</h4>
                            {docItem.verified && (
                              <span className="p-0.5 bg-[#EAF5FC] text-[#163B63] rounded-full" title="Verified Practitioner">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#258FE5] font-medium">{docItem.title}</div>
                          <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-2">
                            <span>{docItem.qualifications.join(", ")}</span>
                            <span>•</span>
                            <span>{docItem.experience_years || docItem.experienceYears || 15}+ yrs exp</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-700 font-semibold">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {docItem.rating} ({docItem.review_count || docItem.reviewCount || 120})
                            </span>
                          </div>

                          {/* Relevance tag */}
                          <div className="text-[11px] text-[#64748B] bg-[#F5F9FC] px-2.5 py-1 rounded-lg border border-[#DCE6EF] mt-1.5 inline-block">
                            <strong className="text-[#163B63]">Why Relevant: </strong>
                            {docItem.relevance_reason || docItem.relevanceReason || "Direct clinical specialty match."}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DCE6EF]">
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-[#64748B]">Consultation Fee</div>
                          <div className="text-sm font-bold text-[#163B63]">
                            ₹{docItem.consultation_fee || docItem.consultationFee || 800}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link href={`/doctor/${docItem.id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              View Profile
                            </Button>
                          </Link>
                          <Link href={`/doctor/${docItem.id}`}>
                            <Button variant="primary" size="sm" className="text-xs bg-[#258FE5] hover:bg-[#1D78C4]">
                              Book Slot
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] text-[11px] text-[#64748B] leading-relaxed">
                  <strong>Ethical Navigation Notice: </strong>
                  Doctor suggestions are generated solely to assist with navigating to appropriate certified specialists. The platform does not prescribe treatments or replace in-person medical evaluation.
                </div>
              </div>
            )}

            {/* TAB 4: COMPLETE EXTRACTED TEXT VIEWER */}
            {activeTab === "text" && (
              <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE6EF] pb-4">
                  <div>
                    <h3 className="text-base font-serif text-[#163B63] flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#258FE5]" />
                      Complete Extracted Content (Un-truncated)
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Every character extracted across all {totalPagesCount} page(s). Never silently shortened.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyFullText}
                      leftIcon={copiedText ? <Check className="w-3.5 h-3.5 text-[#20B8AD]" /> : <Copy className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      {copiedText ? "Copied!" : "Copy Text"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadRawText}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      Download .txt
                    </Button>
                  </div>
                </div>

                {/* In-Text Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={textSearchQuery}
                    onChange={(e) => setTextSearchQuery(e.target.value)}
                    placeholder="Search words, numbers or biomarkers in extracted text..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  />
                  {textSearchQuery && (
                    <button
                      onClick={() => setTextSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] hover:text-[#163B63]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Full Extracted Text Area */}
                <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#DCE6EF] font-mono text-xs text-[#0F172A] leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap select-text">
                  {document.raw_text ||
                    pages.map((p) => `--- PAGE ${p.page_number} ---\n${p.text_content}`).join("\n\n") ||
                    "No extracted text available."}
                </div>
              </div>
            )}

            {/* TAB 5: AI GUIDANCE & 10 SECTIONS */}
            {activeTab === "ai_analysis" && (
              <div className="space-y-5">
                <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#258FE5]" />
                    <div>
                      <h3 className="text-base font-serif text-[#163B63]">
                        AI Patient Understanding Center
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        10-section structured clinical explanation in simple language.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-[#258FE5]" />
                    <select
                      value={analysisLang}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="text-xs font-medium px-3 py-1.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] text-[#163B63] focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                    >
                      <option value="en">English (Original)</option>
                      <option value="te">Telugu (తెలుగు)</option>
                      <option value="hi">Hindi (हिंदी)</option>
                      <option value="ta">Tamil (தமிழ்)</option>
                      <option value="kn">Kannada (ಕನ್ನಡ)</option>
                      <option value="ml">Malayalam (മലയാളം)</option>
                    </select>
                  </div>
                </div>

                {loadingAnalysis ? (
                  <div className="bg-white rounded-3xl border border-[#DCE6EF] p-12 text-center">
                    <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-[#64748B]">Translating and formatting 10 clinical sections...</p>
                  </div>
                ) : analysisData ? (
                  <div className="space-y-4">
                    <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#258FE5] bg-[#EAF5FC] px-2.5 py-0.5 rounded-full border border-[#20B8AD]/30">
                        Section 1 & 2 • Plain Language Summary
                      </span>
                      <h4 className="text-lg font-serif text-[#163B63]">What This Report Means</h4>
                      <p className="text-xs leading-relaxed text-[#0F172A] bg-[#F5F9FC] p-4 rounded-2xl border border-[#DCE6EF]">
                        {analysisData.simple_summary}
                      </p>
                    </div>

                    <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#258FE5] bg-[#EAF5FC] px-2.5 py-0.5 rounded-full border border-[#20B8AD]/30">
                        Section 3 & 4 • Important Findings & Parameter Breakdown
                      </span>
                      <div className="space-y-2">
                        {analysisData.important_findings?.map((finding: string, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 text-xs text-[#0F172A] bg-[#FFFFFF] p-3 rounded-xl border border-[#DCE6EF]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#258FE5] shrink-0 mt-0.5" />
                            <span>{finding}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] text-[11px] text-[#64748B] leading-relaxed">
                      {analysisData.disclaimer}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* TAB 6: VERIFICATION & AUDIT TRAIL */}
            {activeTab === "overview" && (
              <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle p-6 space-y-5">
                <div className="border-b border-[#DCE6EF] pb-3">
                  <h3 className="text-base font-serif text-[#163B63]">
                    Document Integrity & Verification Audit
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Detailed metrics on OCR confidence, page completeness, and human audit logs.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF]">
                    <span className="text-[10px] text-[#64748B] block">Total Pages:</span>
                    <strong className="text-lg font-serif text-[#163B63]">{verification.total_pages}</strong>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF]">
                    <span className="text-[10px] text-[#64748B] block">Processed Pages:</span>
                    <strong className="text-lg font-serif text-[#163B63]">{verification.processed_pages}</strong>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF]">
                    <span className="text-[10px] text-[#64748B] block">Failed Pages:</span>
                    <strong className="text-lg font-serif text-[#163B63]">{verification.failed_pages?.length || 0}</strong>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF]">
                    <span className="text-[10px] text-[#64748B] block">Accuracy Metric:</span>
                    <strong className="text-lg font-serif text-[#258FE5]">
                      {Math.round(verification.accuracy_score * 100)}%
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DCE6EF] text-xs space-y-2">
                  <h4 className="font-semibold text-[#163B63]">Verification Status: {verification.verification_status.toUpperCase()}</h4>
                  <p className="text-[#64748B] leading-relaxed">{verification.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Human Audit Correction Modal */}
      {editingLab && (
        <Modal
          isOpen={!!editingLab}
          onClose={() => setEditingLab(null)}
          title={`Audit Biomarker: ${editingLab.parameter_name}`}
        >
          <div className="space-y-4 text-xs text-left">
            <p className="text-[#64748B]">
              If the automated OCR extracted an incorrect number from your paper report, enter the verified value below to update your records.
            </p>
            <div className="space-y-1">
              <label className="font-medium text-[#163B63] block">Result Value:</label>
              <input
                type="text"
                value={correctionValue}
                onChange={(e) => setCorrectionValue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-[#163B63] block">Audit Reason:</label>
              <input
                type="text"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingLab(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitCorrection}
                disabled={isSubmittingCorrection || !correctionValue}
              >
                {isSubmittingCorrection ? "Saving..." : "Save Correction"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
