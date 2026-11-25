"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ParameterDataPoint {
  date: string;
  document_id: string;
  document_title: string;
  value: string;
  numeric_value?: number;
  unit?: string;
  reference_range?: string;
  status: string;
}

interface ParameterTrend {
  parameter_name: string;
  normalized_name: string;
  unit?: string;
  trend_direction: string;
  datapoints: ParameterDataPoint[];
  clinical_note: string;
}

interface ComparisonResult {
  compared_document_ids: string[];
  document_summaries: any[];
  matching_parameters: ParameterTrend[];
  summary_of_trends: string;
  clinical_disclaimer: string;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const idsQuery = searchParams.get("ids") || "doc-cbc-001,doc-lipid-002";

  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsQuery]);

  const fetchComparison = async () => {
    try {
      setLoading(true);
      const docIds = idsQuery.split(",").filter(Boolean);
      const res = await fetch("/api/medical-documents/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: docIds })
      });
      if (res.ok) {
        const data = await res.json();
        setComparison(data);
      }
    } catch (err) {
      console.error("Comparison failed", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#64748B]">Calculating longitudinal biomarkers across dates...</p>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-serif text-[#163B63]">No comparison data available</h2>
        <Link href="/patient/medical-records">
          <Button variant="primary" size="sm">
            Back to Medical Records
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
        <span className="text-[#163B63] font-semibold">Longitudinal Trend Analysis</span>
      </div>

      {/* Hero Header */}
      <div className="bg-white rounded-[32px] p-8 border border-[#DCE6EF] shadow-subtle space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF5FC] border border-[#20B8AD]/30 text-[#258FE5] text-xs font-semibold uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5" />
          Longitudinal Health Tracking
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#163B63]">
          Multi-Report Trend Intelligence
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] font-light max-w-3xl leading-relaxed">
          Comparing {comparison.document_summaries.length} medical document(s) to track trajectories in your key biomarkers over time.
        </p>
      </div>

      {/* Trajectory Summary Highlight Card */}
      <div className="bg-[#163B63] text-white rounded-3xl p-8 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#20B8AD] flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Trajectory Analysis Summary
        </div>
        <p className="text-sm sm:text-base font-light leading-relaxed text-[#F5F9FC]">
          {comparison.summary_of_trends}
        </p>
      </div>

      {/* Compared Documents Overview Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#163B63]">
          Compared Reports ({comparison.document_summaries.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {comparison.document_summaries.map((doc, idx) => (
            <div
              key={doc.id || idx}
              className="p-5 rounded-2xl bg-white border border-[#DCE6EF] shadow-subtle space-y-2 text-xs"
            >
              <div className="font-semibold text-[#163B63] line-clamp-1">{doc.title}</div>
              <div className="text-[#64748B] truncate">{doc.issuing_facility || "Diagnostic Lab"}</div>
              <div className="text-[11px] text-[#258FE5] font-medium flex items-center gap-1.5 pt-1 border-t border-[#DCE6EF]">
                <Calendar className="w-3.5 h-3.5" />
                Date: {doc.report_date || "Recent"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matching Parameters Grid */}
      <div className="bg-white rounded-3xl border border-[#DCE6EF] shadow-subtle overflow-hidden">
        <div className="p-6 border-b border-[#DCE6EF]">
          <h3 className="text-base font-serif font-normal text-[#163B63]">
            Longitudinal Biomarker Comparison
          </h3>
          <p className="text-xs text-[#64748B]">
            Track changes across diagnostic panels with clinical context
          </p>
        </div>

        {comparison.matching_parameters.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            No shared numerical biomarkers found across the selected reports.
          </div>
        ) : (
          <div className="divide-y divide-[#DCE6EF]">
            {comparison.matching_parameters.map((param, idx) => {
              const isIncreasing = param.trend_direction === "increasing";
              const isDecreasing = param.trend_direction === "decreasing";
              const isStable = param.trend_direction === "stable";

              return (
                <div key={idx} className="p-6 space-y-4 hover:bg-[#F5F9FC]/40 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-[#163B63]">
                        {param.parameter_name}
                      </div>
                      <div className="text-xs text-[#64748B]">
                        Unit: {param.unit || "N/A"} • Tracked across {param.datapoints.length} panel(s)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isIncreasing && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
                          Increasing
                        </span>
                      )}
                      {isDecreasing && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF]">
                          <TrendingDown className="w-3.5 h-3.5 text-[#163B63]" />
                          Decreasing
                        </span>
                      )}
                      {isStable && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          <Minus className="w-3.5 h-3.5 text-blue-700" />
                          Stable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Datapoints Across Dates Timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {param.datapoints.map((pt, pIdx) => (
                      <div
                        key={pIdx}
                        className="p-3.5 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] text-xs space-y-1"
                      >
                        <div className="text-[11px] text-[#64748B] font-medium flex items-center justify-between">
                          <span>{pt.date}</span>
                          <span
                            className={`font-semibold text-[10px] uppercase px-1.5 py-0.2 rounded ${
                              pt.status === "normal"
                                ? "bg-[#EAF5FC] text-[#163B63]"
                                : pt.status === "high"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {pt.status}
                          </span>
                        </div>
                        <div className="text-base font-semibold text-[#163B63]">
                          {pt.value} <span className="text-xs font-normal text-[#64748B]">{pt.unit || ""}</span>
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate">
                          Ref: {pt.reference_range || "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Clinical Trajectory Note */}
                  <div className="text-xs text-[#258FE5] bg-[#EAF5FC] p-3 rounded-xl border border-[#20B8AD]/30 leading-relaxed font-medium">
                    Clinical Trajectory: {param.clinical_note}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="p-6 rounded-3xl bg-white border border-[#DCE6EF] text-xs text-[#64748B] space-y-1">
        <h4 className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#258FE5]" />
          Longitudinal Comparative Notice
        </h4>
        <p className="leading-relaxed">
          {comparison.clinical_disclaimer}
        </p>
      </div>
    </div>
  );
}

export default function CompareReportsPage() {
  return (
    <div className="min-h-screen bg-[#F5F9FC] py-10 lg:py-14 text-left">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="text-center py-20 text-xs text-[#64748B]">Loading trajectory intelligence...</div>}>
          <CompareContent />
        </Suspense>
      </div>
    </div>
  );
}
