"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  ChevronRight,
  Download,
  Trash2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { UploadDocumentDialog } from "@/components/medical-records/UploadDocumentDialog";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuthUser } from "@/hooks/useAuthUser";

interface DocumentSummary {
  id: string;
  patient_id: string;
  title: string;
  original_filename: string;
  document_category: string;
  sub_classification?: string;
  classification_confidence: number;
  issuing_facility?: string;
  report_date?: string;
  page_count: number;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  error_message?: string;
  created_at: string;
}

const CATEGORIES = [
  "All",
  "Blood test reports",
  "Prescriptions",
  "Radiology reports",
  "Discharge summaries",
  "Diagnostic reports",
  "Other medical documents"
];

export default function MedicalRecordsOverviewPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const { isAuthenticated } = useAuthUser();

  const handleUploadClick = () => {
    if (!isAuthenticated) {
      setAuthGateOpen(true);
    } else {
      setIsUploadModalOpen(true);
    }
  };

  // Deletion modal state
  const [docToDelete, setDocToDelete] = useState<DocumentSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/medical-documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesCat =
      selectedCategory === "All" || doc.document_category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.issuing_facility &&
        doc.issuing_facility.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.sub_classification &&
        doc.sub_classification.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const toggleSelectForCompare = (id: string) => {
    if (selectedForCompare.includes(id)) {
      setSelectedForCompare(selectedForCompare.filter((item) => item !== id));
    } else {
      if (selectedForCompare.length >= 4) {
        alert("You can compare up to 4 medical reports concurrently.");
        return;
      }
      setSelectedForCompare([...selectedForCompare, id]);
    }
  };

  const launchComparison = () => {
    if (selectedForCompare.length < 2) {
      alert("Please select at least 2 reports to compare longitudinal trends.");
      return;
    }
    router.push(`/patient/medical-records/compare?ids=${selectedForCompare.join(",")}`);
  };

  const handleDownload = (docId: string, filename: string) => {
    const downloadUrl = `/api/medical-documents/${docId}/download`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "medical_report.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/medical-documents/${docToDelete.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete medical document.");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setSelectedForCompare((prev) => prev.filter((id) => id !== docToDelete.id));
      setNotification(`"${docToDelete.title}" has been successfully removed.`);
      setDocToDelete(null);

      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-[#526A82]">
          <Link href="/patient/dashboard" className="hover:text-[#258FE5] transition-colors">
            Patient Sanctuary
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
          <span className="text-[#163B63] font-semibold">Medical Documents & Health Records</span>
        </div>

        {/* Success notification banner */}
        {notification && (
          <div className="p-4 rounded-2xl bg-[#DCECF8] border border-[#D5E4EF] text-[#163B63] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
              <span>{notification}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-[#163B63] hover:text-[#163B63] font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-white rounded-[32px] p-8 lg:p-10 border border-[#D5E4EF] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF5FC] border border-[#20B8AD]/30 text-[#258FE5] text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              INTELLIGENT CLINICAL VAULT
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#163B63] tracking-tight">
              Medical Documents & Health Records
            </h1>
            <p className="text-sm sm:text-base text-[#526A82] font-light leading-relaxed">
              Securely store and understand your diagnostic reports, blood tests, and prescriptions.
              Our medical intelligence engine extracts laboratory parameters, explains terminology in plain language, and preserves records permanently.
            </p>
          </div>

          {/* Primary Action Controls on Right */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link href="/patient/medical-records/compare">
              <Button
                variant="outline"
                size="md"
                leftIcon={<BarChart3 className="w-4 h-4 text-[#258FE5]" />}
                className="w-full sm:w-auto"
              >
                Compare Reports
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={handleUploadClick}
              className="w-full sm:w-auto bg-[#258FE5] hover:bg-[#1D78C4]"
            >
              Upload Medical Report
            </Button>
          </div>
        </div>

        {/* Document Filters and Search Toolbar */}
        <div className="bg-white rounded-2xl p-3 border border-[#D5E4EF] shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Horizontal Category Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-[#258FE5] text-white shadow-xs"
                      : "bg-[#F5F9FC] text-[#526A82] hover:text-[#163B63] hover:bg-[#EAF5FC]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-4 h-4 text-[#20B8AD] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reports or facilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5] text-[#0F172A] placeholder-[#20B8AD]"
              />
            </div>
          </div>
        </div>

        {/* Floating Multi-Compare Sticky Bar */}
        {selectedForCompare.length > 0 && (
          <div className="sticky top-4 z-30 bg-[#163B63] text-white px-6 py-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-4 border border-[#20B8AD]/30 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#20B8AD] text-[#163B63] font-bold text-xs flex items-center justify-center">
                {selectedForCompare.length}
              </span>
              <span className="text-xs sm:text-sm font-medium">
                {selectedForCompare.length === 1
                  ? "Select at least 1 more document to compare trajectories"
                  : `${selectedForCompare.length} reports selected for comparative trajectory analysis`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedForCompare([])}
                className="text-xs text-[#20B8AD] hover:text-white underline px-2 py-1"
              >
                Clear
              </button>
              <Button
                size="sm"
                variant="sage"
                disabled={selectedForCompare.length < 2}
                onClick={launchComparison}
                className="text-xs"
              >
                Compare Trajectories
              </Button>
            </div>
          </div>
        )}

        {/* Document Cards List / Empty State */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#D5E4EF] space-y-3">
            <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#526A82]">Loading medical records vault...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#D5E4EF] space-y-3 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-serif font-normal text-[#163B63]">No documents found</h3>
              <p className="text-xs text-[#526A82] leading-relaxed">
                {searchQuery
                  ? "Try adjusting your search query or selected category filter."
                  : "You haven't uploaded any medical documents yet. Upload a report to securely store and access your records anytime."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => {
              const isSelected = selectedForCompare.includes(doc.id);
              const isVerified = doc.status === "completed";
              const needsReview = doc.status === "verification_required";

              return (
                <div
                  key={doc.id}
                  className={`bg-white rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between space-y-5 hover:shadow-md ${
                    isSelected ? "border-[#258FE5] ring-2 ring-[#258FE5]/10" : "border-[#D5E4EF]"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header: Category Badge & Compare Checkbox */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                        {doc.sub_classification || doc.document_category}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#526A82] hover:text-[#163B63]">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectForCompare(doc.id)}
                            className="w-3.5 h-3.5 rounded text-[#258FE5] focus:ring-[#258FE5] border-[#D5E4EF]"
                          />
                          <span>Compare</span>
                        </label>
                        <button
                          onClick={() => setDocToDelete(doc)}
                          className="text-[#94A3B8] hover:text-rose-600 transition-colors p-1"
                          title="Delete record"
                          aria-label="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Document Title & Issuing Facility */}
                    <div className="space-y-1">
                      <h3 className="text-base font-medium text-[#163B63] line-clamp-1 hover:text-[#258FE5] transition-colors">
                        <Link href={`/patient/medical-records/${doc.id}`}>{doc.title}</Link>
                      </h3>
                      <p className="text-xs text-[#526A82] truncate">
                        {doc.issuing_facility || "Clinical Laboratory / Diagnostic Center"}
                      </p>
                    </div>

                    {/* Report Date & File Size Metadata */}
                    <div className="flex items-center gap-3 text-[11px] text-[#526A82] pt-1 border-t border-[#D5E4EF]/60">
                      <span>Date: <strong className="text-[#163B63] font-medium">{doc.report_date || "Recent"}</strong></span>
                      <span>•</span>
                      <span>{doc.page_count} page{doc.page_count > 1 ? "s" : ""}</span>
                      <span>•</span>
                      <span className="font-mono">{formatFileSize(doc.file_size_bytes)}</span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      {isVerified ? (
                        <div className="inline-flex items-center gap-1 text-[11px] text-[#258FE5] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#258FE5]" />
                          <span>AI Analysis Ready</span>
                        </div>
                      ) : needsReview ? (
                        <div className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Requires User Verification</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[11px] text-[#526A82] font-medium">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing Document ({doc.status})...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action CTAs */}
                  <div className="pt-3 border-t border-[#D5E4EF] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/patient/medical-records/${doc.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">
                          View Data
                        </Button>
                      </Link>
                      <Link href={`/patient/medical-records/${doc.id}/analysis`} className="flex-1">
                        <Button
                          variant="sage"
                          size="sm"
                          leftIcon={<Sparkles className="w-3 h-3 text-[#258FE5]" />}
                          className="w-full text-xs h-8"
                        >
                          AI Insights
                        </Button>
                      </Link>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.original_filename)}
                      leftIcon={<Download className="w-3.5 h-3.5 text-[#526A82]" />}
                      className="w-full text-xs h-7 text-[#526A82] hover:text-[#163B63] hover:bg-[#F1F5F9]"
                    >
                      Download Original
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Document Modal Dialog */}
      <UploadDocumentDialog
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchDocuments();
        }}
      />

      {/* Confirmation Modal for Document Deletion */}
      <Modal
        isOpen={Boolean(docToDelete)}
        onClose={() => !isDeleting && setDocToDelete(null)}
        title="Delete Medical Document"
        description="Permanently remove this medical report from your health vault."
        size="md"
        className="max-w-md bg-white"
      >
        <div className="space-y-4 pt-1">
          {deleteError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
            Are you sure you want to delete <strong className="text-[#163B63]">{docToDelete?.title}</strong>?
            This report and its extracted parameters will be removed from your active records list.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5E4EF]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDocToDelete(null)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={confirmDelete}
              className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Auth Gate Modal for visitors needing account */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        featureName="Medical Document Intelligence Vault"
        title="Your Health Information Deserves a Secure Space"
        description="Sign in or register to securely upload diagnostic tests, analyze clinical parameters, and store your health records encrypted under ISO 27001 standards."
        redirectPath="/patient/medical-records"
      />
    </div>
  );
}
