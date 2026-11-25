"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Lock,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface UploadDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (firstDocId: string, allDocIds: string[]) => void;
}

export interface FileUploadItem {
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

export function UploadDocumentDialog({
  isOpen,
  onClose,
  onSuccess
}: UploadDocumentDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileList, setFileList] = useState<FileUploadItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setUploadError(null);

    const newItems: FileUploadItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop()?.toUpperCase() || "UNKNOWN";

      // Max size check: 50MB
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds the 50 MB limit.`);
        continue;
      }

      newItems.push({
        file,
        id: `file_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
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

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
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

  const clearAllFiles = () => {
    setFileList([]);
    setUploadError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartUpload = async () => {
    if (fileList.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      fileList.forEach((item) => {
        formData.append("files", item.file);
      });

      const catValue = selectedCategory.startsWith("Auto-Detect")
        ? "Auto-Detect"
        : selectedCategory;
      formData.append("category", catValue);

      // Update local item status to uploading
      setFileList((prev) =>
        prev.map((f) => ({ ...f, status: "uploading", progress: 65 }))
      );

      const res = await fetch("/api/medical-documents/upload", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Upload failed with server status ${res.status}`);
      }

      const uploadedDocs = await res.json();
      const allDocIds: string[] = Array.isArray(uploadedDocs)
        ? uploadedDocs.map((d: any) => d.id)
        : [uploadedDocs?.id || "doc-cbc-001"];

      const firstDocId = allDocIds[0] || "doc-cbc-001";

      setFileList((prev) =>
        prev.map((f) => ({ ...f, status: "success", progress: 100 }))
      );

      // Close modal
      onClose();

      // Trigger callback or immediately auto-navigate to the newly uploaded document!
      if (onSuccess) {
        onSuccess(firstDocId, allDocIds);
      } else {
        const batchQuery =
          allDocIds.length > 1 ? `?batch=${allDocIds.join(",")}` : "";
        router.push(`/patient/medical-records/${firstDocId}${batchQuery}`);
      }
    } catch (err: any) {
      console.error("Upload error", err);
      setUploadError(
        err?.message || "Failed to upload document. Please try again."
      );
      setFileList((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error",
          errorMessage: "Upload interrupted"
        }))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Upload Medical Documents"
      description="Upload blood tests, prescriptions, radiology scans, or discharge summaries for AI clinical extraction."
      size="lg"
      className="max-w-2xl bg-white"
    >
      <div className="space-y-6 pt-1 text-left">
        {/* Error Alert if any */}
        {uploadError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* SECTION 1: Document Category Dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#163B63] uppercase tracking-wider">
            Document Category
          </label>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] text-[#0F172A] focus:outline-none focus:border-[#258FE5] focus:ring-1 focus:ring-[#258FE5] appearance-none transition-all disabled:opacity-60 cursor-pointer"
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

        {/* SECTION 2: File Upload Area (Drag & Drop Zone) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isSubmitting && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-[#258FE5] bg-[#EAF5FC]/60"
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
          <div className="w-12 h-12 rounded-xl bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center mx-auto mb-3 border border-[#20B8AD]/30 shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <h4 className="text-sm sm:text-base font-serif font-normal text-[#163B63]">
            Drop your medical documents here, or{" "}
            <span className="text-[#258FE5] underline font-medium">browse files</span>
          </h4>
          <p className="text-xs text-[#64748B] mt-1">
            Supports multiple files up to 50 MB each
          </p>

          {/* Format Badges */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 max-w-md mx-auto">
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

        {/* SECTION 3: Selected Documents List */}
        {fileList.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#163B63]">
              <span>Selected Documents ({fileList.length})</span>
              <button
                type="button"
                onClick={clearAllFiles}
                disabled={isSubmitting}
                className="text-[#64748B] hover:text-red-700 underline text-[11px] disabled:opacity-50"
              >
                Clear all
              </button>
            </div>

            {/* Scrollable container with independent scroll */}
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {fileList.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#DCE6EF] flex items-center justify-center shrink-0 text-[#258FE5]">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#163B63] truncate max-w-[200px] sm:max-w-xs">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                        <span>{formatFileSize(item.size)}</span>
                        <span>•</span>
                        <span className="font-mono uppercase text-[9px] px-1 rounded bg-white border border-[#DCE6EF]">
                          {item.format}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "uploading" && (
                      <span className="text-[11px] text-[#258FE5] font-medium flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Uploading...
                      </span>
                    )}
                    {item.status === "success" && (
                      <span className="text-[11px] text-[#163B63] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#20B8AD]" /> Ready
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
                        className="text-[#20B8AD] hover:text-[#163B63] p-1 transition-colors rounded"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: Sticky Footer Actions */}
        <div className="pt-4 border-t border-[#DCE6EF] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
            <Lock className="w-3.5 h-3.5 text-[#258FE5] shrink-0" />
            <span>SHA-256 Verified • AES-256 Storage • Access Controlled</span>
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={fileList.length === 0 || isSubmitting}
            onClick={handleStartUpload}
            leftIcon={
              isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )
            }
            className="w-full sm:w-auto bg-[#258FE5] hover:bg-[#1D78C4] px-6 text-xs h-10 font-medium"
          >
            {isSubmitting
              ? "Uploading & Analyzing..."
              : "Upload & Analyze with AI"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
