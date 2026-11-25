"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Lock,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface FileUploadItem {
  file: File;
  id: string;
  name: string;
  size: number;
  format: string;
  status: "ready" | "uploading" | "processing" | "success" | "error";
  progress: number;
  errorMessage?: string;
  uploadedDocId?: string;
}

const SUPPORTED_EXTENSIONS = [
  "PDF",
  "DOCX",
  "DOC",
  "TXT",
  "RTF",
  "JPG",
  "PNG",
  "WEBP",
  "TIFF",
  "XLSX",
  "CSV",
  "DICOM"
];

const CATEGORIES = [
  "Auto-Detect (AI Classification)",
  "Blood test reports",
  "Prescriptions",
  "Radiology reports",
  "Discharge summaries",
  "Diagnostic reports",
  "Other medical documents"
];

export default function DocumentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileList, setFileList] = useState<FileUploadItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setErrorMessage(null);

    const newItems: FileUploadItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop()?.toUpperCase() || "UNKNOWN";

      // Max size check: 50MB
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(`File "${file.name}" exceeds the 50 MB limit.`);
        continue;
      }

      newItems.push({
        file,
        id: `file_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: file.size,
        format: ext,
        status: "ready",
        progress: 0
      });
    }

    setFileList((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setFileList((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setFileList([]);
    setErrorMessage(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const startUploadAndAnalysis = async () => {
    if (fileList.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      fileList.forEach((item) => {
        formData.append("files", item.file);
      });

      const catValue = selectedCategory.startsWith("Auto-Detect")
        ? "Auto-Detect"
        : selectedCategory;
      formData.append("category", catValue);

      setFileList((prev) =>
        prev.map((f) => ({ ...f, status: "uploading", progress: 60 }))
      );

      const res = await fetch("/api/medical-documents/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Upload server returned status ${res.status}`);
      }

      const uploadedDocs = await res.json();
      const allDocIds: string[] = Array.isArray(uploadedDocs)
        ? uploadedDocs.map((d: any) => d.id)
        : [uploadedDocs?.id || "doc-cbc-001"];

      const firstDocId = allDocIds[0] || "doc-cbc-001";

      setFileList((prev) =>
        prev.map((f) => ({ ...f, status: "success", progress: 100 }))
      );

      // AUTOMATIC NAVIGATION: Navigate directly to the newly uploaded document!
      const batchParam =
        allDocIds.length > 1 ? `?batch=${allDocIds.join(",")}` : "";
      router.push(`/patient/medical-records/${firstDocId}${batchParam}`);
    } catch (err: any) {
      console.error("Upload error", err);
      setErrorMessage(
        err?.message || "Failed to process upload. Please try again."
      );
      setFileList((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error",
          errorMessage: "Upload interrupted"
        }))
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-10 lg:py-14 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
          <Link href="/patient/dashboard" className="hover:text-[#258FE5] transition-colors">
            Patient Sanctuary
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
          <Link href="/patient/medical-records" className="hover:text-[#258FE5] transition-colors">
            Medical Records
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#20B8AD]" />
          <span className="text-[#163B63] font-semibold">Upload Document</span>
        </div>

        {/* Page Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF5FC] border border-[#20B8AD]/30 text-[#258FE5] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            AI Document Intelligence
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#163B63] tracking-tight">
            Upload Medical Documents
          </h1>
          <p className="text-sm text-[#64748B] font-light max-w-2xl leading-relaxed">
            Upload blood reports, doctor prescriptions, radiology scans, or discharge notes.
            Our clinical engine will extract laboratory parameters, highlight abnormal ranges, and automatically guide you to the structured analysis.
          </p>
        </div>

        {/* Upload Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload Configuration Section (4-Section Clean Visual Hierarchy) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#DCE6EF] shadow-subtle space-y-6">
          {/* Section 1: Document Category */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#163B63] uppercase tracking-wider">
              Document Category
            </label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 text-xs sm:text-sm rounded-2xl border border-[#DCE6EF] bg-[#F5F9FC] text-[#0F172A] focus:outline-none focus:border-[#258FE5] appearance-none disabled:opacity-60 cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748B] text-xs">
                ▼
              </div>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Select &quot;Auto-Detect&quot; to allow our natural language classifier to categorize the report automatically.
            </p>
          </div>

          {/* Section 2: Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isSubmitting && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-[#258FE5] bg-[#EAF5FC]/50"
                : "border-[#DCE6EF] hover:border-[#20B8AD] bg-[#F5F9FC]/60 hover:bg-[#F5F9FC]"
            } ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.webp,.tiff,.bmp,.xls,.xlsx,.csv,.dcm,.dicom"
            />
            <div className="w-14 h-14 rounded-2xl bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center mx-auto mb-4 border border-[#20B8AD]/30">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="text-base font-serif font-normal text-[#163B63]">
              Drop your medical documents here, or <span className="text-[#258FE5] underline font-medium">browse files</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-1.5">
              Supports multiple files up to 50 MB each
            </p>

            {/* Format Badges */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5 max-w-lg mx-auto">
              {SUPPORTED_EXTENSIONS.map((ext) => (
                <span
                  key={ext}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-white text-[#64748B] border border-[#DCE6EF]"
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>

          {/* Section 3: Selected Files Preview List (Independently Scrollable) */}
          {fileList.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#163B63]">
                <span>Selected Documents ({fileList.length})</span>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={isSubmitting}
                  className="text-[#64748B] hover:text-red-700 underline text-[11px] disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                {fileList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-[#DCE6EF] bg-[#F5F9FC] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#DCE6EF] flex items-center justify-center shrink-0 text-[#258FE5]">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#163B63] truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                          <span>{formatFileSize(item.size)}</span>
                          <span>•</span>
                          <span className="font-mono uppercase text-[10px] px-1.5 py-0.2 rounded bg-white border border-[#DCE6EF]">
                            {item.format}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {item.status === "uploading" && (
                        <span className="text-[11px] text-[#258FE5] font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Uploading ({item.progress}%)
                        </span>
                      )}
                      {item.status === "success" && (
                        <span className="text-[11px] text-[#163B63] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" /> Ready
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="text-[11px] text-red-600 font-medium">
                          {item.errorMessage || "Failed"}
                        </span>
                      )}

                      {!isSubmitting && (
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          className="text-[#20B8AD] hover:text-[#163B63] p-1 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Sticky Footer Action Trigger Button */}
          <div className="pt-4 border-t border-[#DCE6EF] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <Lock className="w-3.5 h-3.5 text-[#258FE5]" />
              <span>SHA-256 Verified • AES-256 Storage • Access Controlled</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={fileList.length === 0 || isSubmitting}
              onClick={startUploadAndAnalysis}
              leftIcon={
                isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )
              }
              className="w-full sm:w-auto bg-[#258FE5] hover:bg-[#1D78C4]"
            >
              {isSubmitting ? "Uploading & Analyzing with AI..." : "Upload & Analyze with AI"}
            </Button>
          </div>
        </div>

        {/* Privacy & Medical Disclaimer Card */}
        <div className="p-6 rounded-3xl bg-white border border-[#DCE6EF] space-y-2 text-xs text-[#64748B]">
          <h4 className="font-semibold text-[#163B63] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-4 h-4 text-[#258FE5]" />
            Patient Confidentiality & Security Commitment
          </h4>
          <p className="leading-relaxed">
            Your uploaded documents are securely processed inside our private intelligence pipeline.
            Extracted metrics are mapped directly to your personal health record for continuity of care.
            Automated explanations are provided for educational clarity and do not replace consultation with your doctor.
          </p>
        </div>
      </div>
    </div>
  );
}
