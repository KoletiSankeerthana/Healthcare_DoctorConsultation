"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ShieldCheck,
  Users,
  Stethoscope,
  CalendarCheck,
  TrendingUp,
  FileCheck2,
  AlertCircle,
  Activity,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  BarChart3,
  Building,
  Eye,
  FileText,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCw,
  ChevronRight,
  Download,
  X,
  Mail,
  Send,
  Loader2
} from "lucide-react";

interface ApplicationSummary {
  id: string;
  doctor_id: string;
  application_reference: string;
  doctor_name: string;
  doctor_email: string;
  specialty: string;
  registration_number: string;
  issuing_council: string;
  highest_qualification: string;
  experience_years: number;
  status: string;
  submitted_at?: string;
  created_at: string;
  documents_count: number;
  mandatory_documents_verified: boolean;
}

interface ApplicationDetail {
  id: string;
  doctor_id: string;
  application_reference: string;
  status: string;
  personal_info: any;
  professional_info: any;
  registration_info: any;
  eligibility_checklist?: any;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  documents: Array<{
    id: string;
    document_type: string;
    document_name: string;
    original_filename: string;
    file_size: number;
    is_mandatory: boolean;
    review_status: string;
    reviewer_comments?: string;
  }>;
  reviews: Array<{
    id: string;
    action: string;
    reason_category?: string;
    justification?: string;
    created_at: string;
  }>;
  history: Array<{
    id: string;
    previous_status: string;
    new_status: string;
    reason?: string;
    timestamp: string;
  }>;
}

interface VerificationStats {
  total_applications: number;
  pending_review: number;
  under_review: number;
  additional_documents_required: number;
  resubmission_required: number;
  approved: number;
  rejected: number;
  suspended: number;
}

const REJECTION_CATEGORIES = [
  { id: "invalid_registration", label: "Invalid Medical Registration / Council Record" },
  { id: "unrecognized_qualification", label: "Unrecognized or Insufficient Qualification" },
  { id: "missing_document", label: "Missing Mandatory Statutory Document" },
  { id: "inconsistent_information", label: "Incorrect or Inconsistent Profile Information" },
  { id: "unverifiable_credentials", label: "Unverifiable Credentials or Unreadable Scans" },
  { id: "specialization_not_established", label: "Specialization Qualification Not Established" },
  { id: "duplicate_application", label: "Duplicate or Unauthorized Application" },
  { id: "other", label: "Other Non-Compliance with Clinical Regulations" }
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<VerificationStats>({
    total_applications: 3,
    pending_review: 1,
    under_review: 0,
    additional_documents_required: 1,
    resubmission_required: 0,
    approved: 1,
    rejected: 0,
    suspended: 0
  });

  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState<ApplicationDetail | null>(null);
  const [loadingAppDetail, setLoadingAppDetail] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Decision Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState(REJECTION_CATEGORIES[0].id);
  const [rejectionJustification, setRejectionJustification] = useState("");

  const [isRequestDocsModalOpen, setIsRequestDocsModalOpen] = useState(false);
  const [requestedDocsText, setRequestedDocsText] = useState("");

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Gmail OAuth 2.0 & Live Email Test State
  const [testEmailRecipient, setTestEmailRecipient] = useState("adminhealthcare4@gmail.com");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    messageId?: string;
    error?: string;
    timestamp?: string;
    recipient?: string;
  } | null>(null);
  const [oauthStatus, setOauthStatus] = useState<{
    isConfigured: boolean;
    isAuthorized: boolean;
    accountEmail: string | null;
  } | null>(null);

  useEffect(() => {
    fetchStats();
    fetchApplications();
    fetchOauthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchOauthStatus = async () => {
    try {
      const res = await fetch("/api/admin/test-email");
      if (res.ok) {
        const data = await res.json();
        setOauthStatus(data);
        if (data.accountEmail) {
          setTestEmailRecipient(data.accountEmail);
        }
      }
    } catch (e) {
      console.warn("Could not fetch OAuth status", e);
    }
  };

  const handleSendTestEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testEmailRecipient.trim() || isSendingTestEmail) return;

    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: testEmailRecipient.trim() })
      });

      const data = await res.json();
      if (data.success) {
        setTestEmailResult({
          success: true,
          messageId: data.messageId,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
          recipient: data.recipient
        });
      } else {
        setTestEmailResult({
          success: false,
          error: data.error || "Gmail API rejected email transmission.",
          recipient: data.recipient
        });
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        error: err.message || "Failed to contact local test email endpoint."
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/doctor-verification/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const url = `/api/doctor-verification/admin/applications?status_filter=${statusFilter}&search=${encodeURIComponent(
        searchQuery
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const apiData: ApplicationSummary[] = await res.json();
        setApplications(apiData);
      }
    } catch (err) {
      console.error("Failed to load applications", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplications();
  };

  const openApplicationReview = async (appId: string) => {
    try {
      setLoadingAppDetail(true);
      const res = await fetch(`/api/doctor-verification/${appId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedApp(data);
        return;
      }
    } catch (err) {
      console.error("Failed to load application detail from API", err);
    } finally {
      setLoadingAppDetail(false);
    }
  };

  const syncLocalAppStatus = (appId: string, newStatus: string, reason?: string) => {
    try {
      const localApps = JSON.parse(localStorage.getItem("doctor_verification_applications") || "[]");
      const updated = localApps.map((a: any) => {
        if (a.id === appId || a.application_reference === appId) {
          return {
            ...a,
            status: newStatus,
            rejection_reason: reason,
            documents: newStatus === "approved"
              ? a.documents?.map((d: any) => ({ ...d, review_status: "verified" }))
              : a.documents
          };
        }
        return a;
      });
      localStorage.setItem("doctor_verification_applications", JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDocumentReview = async (
    docId: string,
    reviewStatus: string,
    comments?: string
  ) => {
    if (!selectedApp) return;
    try {
      const res = await fetch(`/api/doctor-verification/admin/documents/${docId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_status: reviewStatus,
          reviewer_comments: comments || `Marked as ${reviewStatus} by admin.`
        })
      });
      if (res.ok) {
        // Update local state
        setSelectedApp((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            documents: prev.documents.map((d) =>
              d.id === docId ? { ...d, review_status: reviewStatus, reviewer_comments: comments } : d
            )
          };
        });
      }
    } catch (err) {
      console.error("Document review update failed", err);
    }
  };

  const handleApproveDoctor = async () => {
    if (!selectedApp || isProcessingAction) return;
    setIsProcessingAction(true);

    try {
      syncLocalAppStatus(selectedApp.id, "approved");
      await fetch(`/api/doctor-verification/admin/applications/${selectedApp.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          admin_id: "admin-gov-1"
        })
      });

      setActionFeedback(`Doctor ${selectedApp.personal_info?.full_name || "Doctor"} approved successfully!`);
      setSelectedApp(null);
      fetchStats();
      fetchApplications();
    } catch (err) {
      console.error("Approve failed", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedApp || !rejectionJustification.trim() || isProcessingAction) return;
    setIsProcessingAction(true);

    try {
      syncLocalAppStatus(selectedApp.id, "rejected", rejectionJustification);
      await fetch(`/api/doctor-verification/admin/applications/${selectedApp.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason_category: rejectionCategory,
          justification: rejectionJustification,
          admin_id: "admin-gov-1"
        })
      });

      setActionFeedback(`Application rejected with justification logged.`);
      setIsRejectModalOpen(false);
      setSelectedApp(null);
      setRejectionJustification("");
      fetchStats();
      fetchApplications();
    } catch (err) {
      console.error("Rejection failed", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRequestDocsSubmit = async () => {
    if (!selectedApp || !requestedDocsText.trim() || isProcessingAction) return;
    setIsProcessingAction(true);

    try {
      syncLocalAppStatus(selectedApp.id, "additional_documents_required", requestedDocsText);
      await fetch(`/api/doctor-verification/admin/applications/${selectedApp.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_additional_documents",
          justification: requestedDocsText,
          admin_id: "admin-gov-1"
        })
      });

      setActionFeedback(`Requested additional documents from physician.`);
      setIsRequestDocsModalOpen(false);
      setSelectedApp(null);
      setRequestedDocsText("");
      fetchStats();
      fetchApplications();
    } catch (err) {
      console.error("Request docs failed", err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "approved":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5FC] text-[#163B63] border border-[#D5E4EF]">Approved</span>;
      case "pending_review":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">Pending Review</span>;
      case "under_review":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">Under Review</span>;
      case "additional_documents_required":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5FC] text-[#163B63] border border-[#D5E4EF]">Docs Required</span>;
      case "rejected":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200">Rejected</span>;
      case "suspended":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800 border border-gray-300">Suspended</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F9FC] text-[#526A82]">{statusStr}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-[#D5E4EF] shadow-subtle">
          <div className="flex items-start gap-4">
            <div className="relative w-14 h-14 rounded-full overflow-hidden border border-[#D5E4EF] shadow-xs flex-shrink-0 bg-white">
              <Image
                src={BRAND.logo}
                alt={BRAND.displayName}
                fill
                className="object-contain p-0.5"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
                  {BRAND.displayName} Clinical Governance & Platform Operations
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#123D68] text-white font-semibold">
                  Super Admin Access
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#163B63]">
                Doctor Verification & Approvals
              </h1>
              <p className="text-xs sm:text-sm text-[#526A82] font-light">
                Independent audit of physician council credentials, state registries, degree authenticity, and practice licenses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#163B63] bg-[#EAF5FC] border border-[#20B8AD]/40 px-3.5 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#258FE5] animate-pulse" />
              Accreditation Engine Live
            </span>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="p-4 rounded-2xl bg-[#EAF5FC] border border-[#20B8AD]/40 text-xs text-[#258FE5] font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#258FE5]" />
              <span>{actionFeedback}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-xs underline text-[#258FE5]">
              Dismiss
            </button>
          </div>
        )}

        {/* Gmail OAuth 2.0 Live Email Testing Console */}
        <div className="bg-white rounded-[24px] border border-[#D5E4EF] p-6 shadow-subtle space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EDF5FA] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF5FC] border border-[#258FE5]/20 flex items-center justify-center text-[#258FE5]">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[#163B63]">Gmail OAuth 2.0 Live Email Testing</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live REST API
                  </span>
                </div>
                <p className="text-xs text-[#526A82]">
                  Send live verification emails via Google Cloud Gmail API with real delivery audit logs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {oauthStatus?.isAuthorized ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected: <strong>{oauthStatus.accountEmail || "adminhealthcare4@gmail.com"}</strong></span>
                </div>
              ) : (
                <a
                  href="/api/auth/google"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 hover:bg-amber-100 transition"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>OAuth Pending &bull; Click to Authorize</span>
                </a>
              )}
            </div>
          </div>

          <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="adminhealthcare4@gmail.com"
                disabled={isSendingTestEmail}
                required
                className="w-full text-xs font-sans text-[#163B63] bg-[#F8FAFC] border border-[#D5E4EF] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#258FE5]/30 focus:border-[#258FE5]"
              />
            </div>
            <button
              type="submit"
              disabled={isSendingTestEmail}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#258FE5] hover:bg-[#1C72BA] text-white text-xs font-semibold shadow-xs disabled:opacity-60 transition"
            >
              {isSendingTestEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching to Gmail API...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Live Test Email</span>
                </>
              )}
            </button>
          </form>

          {/* Test Email Delivery Result Feedback */}
          {testEmailResult && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                testEmailResult.success
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                  : "bg-red-50/80 border-red-200 text-red-900"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold text-sm">
                    {testEmailResult.success ? "Live Test Email Successfully Sent!" : "Gmail API Transmission Failed"}
                  </div>
                  {testEmailResult.success ? (
                    <div className="space-y-0.5 text-xs text-emerald-800">
                      <div>Delivered to: <strong>{testEmailResult.recipient || testEmailRecipient}</strong></div>
                      <div>Gmail Message ID: <code className="bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">{testEmailResult.messageId}</code></div>
                      <div>Audit status: <span className="font-semibold text-emerald-700">Persisted in SQLite database audit log</span> ({testEmailResult.timestamp})</div>
                    </div>
                  ) : (
                    <div className="text-xs text-red-700 font-mono bg-red-100/60 p-2 rounded-lg break-all">
                      {testEmailResult.error}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestEmailResult(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Verification Overview Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-[#526A82]">Total Applications</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">{stats.total_applications}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-amber-800">Pending Review</span>
            <div className="text-2xl font-serif font-normal text-amber-800">{stats.pending_review}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-blue-800">Under Review</span>
            <div className="text-2xl font-serif font-normal text-blue-800">{stats.under_review}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-[#163B63]">Docs Required</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">{stats.additional_documents_required}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-[#163B63]">Approved Doctors</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">{stats.approved}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs space-y-1">
            <span className="text-[11px] font-medium text-red-800">Rejected</span>
            <div className="text-2xl font-serif font-normal text-red-800">{stats.rejected}</div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white rounded-2xl p-4 border border-[#D5E4EF] shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin text-xs">
              {[
                { id: "all", label: "All Applications" },
                { id: "pending_review", label: "Pending Review" },
                { id: "under_review", label: "Under Review" },
                { id: "additional_documents_required", label: "Docs Required" },
                { id: "approved", label: "Approved" },
                { id: "rejected", label: "Rejected" },
                { id: "suspended", label: "Suspended" }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                    statusFilter === f.id
                      ? "bg-[#258FE5] text-white shadow-xs"
                      : "bg-[#F5F9FC] text-[#526A82] hover:text-[#163B63] hover:bg-[#EAF5FC]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input & Refresh */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-[#20B8AD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Doctor name, ID, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5] text-[#163B63] placeholder-[#20B8AD]"
                />
              </form>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchApplications}
                className="h-8 px-3 rounded-full text-xs text-[#258FE5] border-[#D5E4EF] hover:bg-[#F5F9FC] shrink-0"
                title="Refresh application roster"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Doctor Application List Table */}
        <div className="bg-white rounded-3xl border border-[#D5E4EF] shadow-subtle overflow-hidden">
          <div className="p-6 border-b border-[#D5E4EF] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif text-[#163B63]">Physician Credential Verification Roster</h2>
              <p className="text-xs text-[#526A82]">
                Applications require manual council registry lookup and document integrity review before practice activation.
              </p>
            </div>
            <span className="text-xs text-[#526A82]">{applications.length} Records</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-[#526A82] space-y-2">
              <div className="w-6 h-6 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
              <span>Loading applications...</span>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#526A82] space-y-1">
              <CheckCircle2 className="w-8 h-8 text-[#20B8AD] mx-auto" />
              <h4 className="font-serif text-sm text-[#163B63]">No applications in this category</h4>
              <p>Try clearing filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F5F9FC] text-[#526A82] font-medium border-b border-[#D5E4EF]">
                    <th className="py-3 px-4">Application ID</th>
                    <th className="py-3 px-4">Doctor Name</th>
                    <th className="py-3 px-4">Specialty</th>
                    <th className="py-3 px-4">Registration No. & Council</th>
                    <th className="py-3 px-4">Qualification</th>
                    <th className="py-3 px-4">Docs</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE6EF]">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#F5F9FC]/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-[#163B63]">
                        {app.application_reference}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#163B63]">{app.doctor_name}</div>
                        <div className="text-[11px] text-[#526A82]">{app.doctor_email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#EAF5FC] text-[#258FE5] text-[11px] font-medium">
                          {app.specialty}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[#163B63]">{app.registration_number}</div>
                        <div className="text-[10px] text-[#526A82] truncate max-w-xs">{app.issuing_council}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#163B63]">
                        {app.highest_qualification} ({app.experience_years} yrs)
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold">{app.documents_count}</span> files
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(app.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openApplicationReview(app.id)}
                          className="text-xs h-7"
                        >
                          Review Credentials
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =========================================================================
            COMPREHENSIVE APPLICATION REVIEW MODAL (Sections 6, 7 & 8)
           ========================================================================= */}
        {selectedApp && (
          <Modal
            isOpen={!!selectedApp}
            onClose={() => setSelectedApp(null)}
            title={`Credential Audit: ${selectedApp.personal_info?.full_name || "Doctor"}`}
            description={`Ref: ${selectedApp.application_reference} • Registration: ${selectedApp.registration_info?.registration_number}`}
            size="xl"
            className="max-w-4xl bg-white"
          >
            <div className="space-y-6 pt-2 text-left text-xs">
              {/* Doctor Header Strip */}
              <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#D5E4EF] flex items-center justify-center shrink-0 text-[#258FE5]">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif text-[#163B63]">{selectedApp.personal_info?.full_name}</h3>
                    <p className="text-[11px] text-[#526A82]">
                      {selectedApp.professional_info?.specialty} • {selectedApp.professional_info?.highest_qualification} • {selectedApp.registration_info?.issuing_council}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#526A82]">Current Status:</span>
                  {getStatusBadge(selectedApp.status)}
                </div>
              </div>

              {/* Section 1: Detailed Profile & Medical Registration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-[#D5E4EF] space-y-2">
                  <h4 className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px]">
                    Personal & Contact Profile
                  </h4>
                  <div className="space-y-1 text-[#526A82]">
                    <div>Email: <strong className="text-[#163B63]">{selectedApp.personal_info?.email}</strong></div>
                    <div>Phone: <strong className="text-[#163B63]">{selectedApp.personal_info?.phone}</strong></div>
                    <div>DOB: <strong className="text-[#163B63]">{selectedApp.personal_info?.date_of_birth || "N/A"}</strong></div>
                    <div>Address: <strong className="text-[#163B63]">{selectedApp.personal_info?.residential_address || "N/A"}</strong></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#D5E4EF] space-y-2">
                  <h4 className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px]">
                    Statutory Medical Registration
                  </h4>
                  <div className="space-y-1 text-[#526A82]">
                    <div>Registration ID: <strong className="text-[#163B63] font-mono">{selectedApp.registration_info?.registration_number}</strong></div>
                    <div>Council: <strong className="text-[#163B63]">{selectedApp.registration_info?.issuing_council}</strong></div>
                    <div>Primary Degree: <strong className="text-[#163B63]">{selectedApp.registration_info?.primary_qualification}</strong></div>
                    <div>Validity: <strong className="text-[#163B63]">{selectedApp.registration_info?.validity_details || "Active"}</strong></div>
                  </div>
                </div>
              </div>

              {/* Section 2: Uploaded Documents Review List (Section 7) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-[#258FE5]" />
                    Document-by-Document Credential Audit ({selectedApp.documents?.length || 0})
                  </h4>
                  <span className="text-[11px] text-[#526A82]">
                    Every document must be audited individually before approval.
                  </span>
                </div>

                <div className="space-y-2.5">
                  {selectedApp.documents?.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl bg-[#F5F9FC] border border-[#D5E4EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-[#D5E4EF] flex items-center justify-center shrink-0 text-[#258FE5]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-[#163B63] truncate">{doc.document_name}</div>
                          <div className="text-[10px] text-[#526A82] flex items-center gap-2">
                            <span>{doc.original_filename}</span>
                            {doc.is_mandatory && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase font-mono text-[9px]">
                                Mandatory
                              </span>
                            )}
                            {doc.reviewer_comments && (
                              <span className="text-[#258FE5] italic">• Note: {doc.reviewer_comments}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions: View preview & review status toggle */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#D5E4EF] text-[11px] text-[#163B63] hover:bg-[#EAF5FC]"
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDocumentReview(doc.id, "verified")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            doc.review_status === "verified"
                              ? "bg-[#258FE5] text-white shadow-xs"
                              : "bg-white border border-[#D5E4EF] text-[#163B63] hover:bg-[#EAF5FC]"
                          }`}
                        >
                          ✓ Verified
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDocumentReview(doc.id, "invalid", "Scan unreadable or signature absent")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            doc.review_status === "invalid"
                              ? "bg-red-700 text-white shadow-xs"
                              : "bg-white border border-[#D5E4EF] text-red-800 hover:bg-red-50"
                          }`}
                        >
                          ✕ Invalid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Prior Reviews & Audit History */}
              {selectedApp.history && selectedApp.history.length > 0 && (
                <div className="p-3.5 rounded-xl bg-white border border-[#D5E4EF] space-y-1.5">
                  <h4 className="font-semibold text-[#163B63] uppercase tracking-wider text-[10px]">
                    Audit Trail & Lifecycle History
                  </h4>
                  <div className="space-y-1 text-[11px] text-[#526A82]">
                    {selectedApp.history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between">
                        <span>
                          {h.previous_status} → <strong className="text-[#163B63]">{h.new_status}</strong>: {h.reason || "Status updated"}
                        </span>
                        <span className="text-[10px] text-[#20B8AD] font-mono">
                          {new Date(h.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Decision Buttons */}
              <div className="pt-4 border-t border-[#D5E4EF] flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRequestDocsModalOpen(true)}
                  className="text-xs"
                >
                  Request Additional Documents
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRejectModalOpen(true)}
                    className="text-xs text-red-700 border-red-300 hover:bg-red-50"
                  >
                    Reject Application
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isProcessingAction}
                    onClick={handleApproveDoctor}
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                    className="text-xs bg-[#258FE5] hover:bg-[#163B63]"
                  >
                    {isProcessingAction ? "Processing..." : "Approve & Activate Doctor"}
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* =========================================================================
            MANDATORY REJECTION MODAL (Section 8B)
           ========================================================================= */}
        {isRejectModalOpen && selectedApp && (
          <Modal
            isOpen={isRejectModalOpen}
            onClose={() => setIsRejectModalOpen(false)}
            title="Reject Physician Accreditation Application"
            description="Rejection strictly requires a statutory category and detailed written justification for audit records."
            size="md"
            className="bg-white"
          >
            <div className="space-y-4 pt-1 text-left text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#163B63]">Mandatory Rejection Category *</label>
                <select
                  value={rejectionCategory}
                  onChange={(e) => setRejectionCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-red-600"
                >
                  {REJECTION_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#163B63]">Written Justification (Mandatory) *</label>
                <textarea
                  rows={4}
                  placeholder="Provide clear clinical governance grounds for rejection to be provided to the physician..."
                  value={rejectionJustification}
                  onChange={(e) => setRejectionJustification(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5E4EF]">
                <Button variant="outline" size="sm" onClick={() => setIsRejectModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!rejectionJustification.trim() || rejectionJustification.length < 5 || isProcessingAction}
                  onClick={handleRejectSubmit}
                  className="bg-red-700 hover:bg-red-800 text-white"
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =========================================================================
            REQUEST ADDITIONAL DOCUMENTS MODAL (Section 8C)
           ========================================================================= */}
        {isRequestDocsModalOpen && selectedApp && (
          <Modal
            isOpen={isRequestDocsModalOpen}
            onClose={() => setIsRequestDocsModalOpen(false)}
            title="Request Additional Credential Documents"
            description="Specify the missing or unreadable documents required before credential review can proceed."
            size="md"
            className="bg-white"
          >
            <div className="space-y-4 pt-1 text-left text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#163B63]">Required Documents & Instructions *</label>
                <textarea
                  rows={4}
                  placeholder="e.g. Please upload your Postgraduate Specialization Degree Certificate (MD/MS) and valid State Medical Council standing renewal..."
                  value={requestedDocsText}
                  onChange={(e) => setRequestedDocsText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5E4EF]">
                <Button variant="outline" size="sm" onClick={() => setIsRequestDocsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!requestedDocsText.trim() || isProcessingAction}
                  onClick={handleRequestDocsSubmit}
                  className="bg-[#258FE5] hover:bg-[#163B63]"
                >
                  Send Document Request
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* =========================================================================
            DOCUMENT PREVIEW MODAL
           ========================================================================= */}
        {previewDoc && (
          <Modal
            isOpen={!!previewDoc}
            onClose={() => setPreviewDoc(null)}
            title={previewDoc.document_name}
            description={`File: ${previewDoc.original_filename} • Status: ${previewDoc.review_status.toUpperCase()}`}
            size="lg"
            className="bg-white"
          >
            <div className="space-y-4 pt-2 text-left text-xs">
              <div className="p-8 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] min-h-[300px] flex flex-col items-center justify-center text-center space-y-3">
                <FileText className="w-16 h-16 text-[#258FE5]" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-[#163B63]">{previewDoc.document_name}</h4>
                  <p className="text-[11px] text-[#526A82]">
                    Official Credential Document • Verified Storage
                  </p>
                </div>
                <div className="pt-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF5FC] text-[#163B63] border border-[#D5E4EF]">
                    File Signature Intact & Valid
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#D5E4EF]">
                <div className="text-[11px] text-[#526A82]">
                  Access protected by Super Admin credentials.
                </div>
                <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
                  Close Preview
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
