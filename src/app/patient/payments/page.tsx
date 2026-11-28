"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { formatINR } from "@/lib/utils";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Receipt,
  RotateCcw,
  Stethoscope
} from "lucide-react";

interface PaymentRecord {
  payment_id: string;
  order_id: string;
  order_reference: string;
  cf_order_id?: string;
  cf_payment_id?: string;
  cf_refund_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: "CREATED" | "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED";
  signature_verified: boolean;
  service_name: string;
  doctor_name?: string;
  date: string;
  created_at: string;
  booking_id?: string;
  refund_amount?: number;
  refund_status?: string;
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/history");
      if (res.ok) {
        const data = await res.json();
        setPayments(data || []);
      }
    } catch (err) {
      console.error("Failed to load payment history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleRefund = async (paymentId: string) => {
    if (!confirm("Are you sure you wish to initiate a cancellation and refund for this payment?")) return;
    setRefundLoading(true);
    setRefundMsg(null);
    try {
      const res = await fetch("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          reason: "Patient requested cancellation"
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRefundMsg("Refund successfully processed via Cashfree.");
        fetchPayments();
        if (selectedPayment?.payment_id === paymentId) {
          setSelectedPayment({
            ...selectedPayment,
            payment_status: "REFUNDED",
            refund_status: "processed",
            refund_amount: selectedPayment.amount
          });
        }
      } else {
        alert(data.error || "Failed to process refund.");
      }
    } catch (e: any) {
      alert("Error initiating refund: " + e.message);
    } finally {
      setRefundLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.order_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.cf_payment_id || p.razorpay_payment_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.cf_order_id || p.razorpay_order_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.doctor_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.service_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      p.payment_status.toLowerCase() === statusFilter.toLowerCase() ||
      (statusFilter === "SUCCESS" && p.payment_status.toLowerCase() === "test_success");

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF]">
            <CheckCircle2 className="w-3 h-3 text-[#20B8AD]" />
            Verified Paid
          </span>
        );
      case "test_success":
      case "TEST_SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            Test Success (Mock)
          </span>
        );
      case "PENDING":
      case "PROCESSING":
      case "CREATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            {status}
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF5FC] text-[#163B63] border border-[#DCE6EF]">
            <RotateCcw className="w-3 h-3 text-[#258FE5]" />
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/patient/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#163B63] font-medium mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Patient Sanctuary Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
              Payment History & Receipts
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Verified Cashfree transactions, GST receipts, and consultation billing records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchPayments}
              className="px-3 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs text-[#475569] hover:bg-[#F5F9FC] flex items-center gap-1.5 font-medium shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <div className="px-3 py-2 rounded-xl bg-[#EAF5FC] border border-[#DCE6EF] text-xs text-[#163B63] flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#258FE5]" />
              Cashfree Secured
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl bg-white border border-[#DCE6EF] p-4 shadow-subtle flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, doctor, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-[#CBD5E1] focus:ring-1 focus:ring-[#258FE5] outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-[#CBD5E1] outline-none bg-white font-medium text-[#475569]"
            >
              <option value="all">All Statuses</option>
              <option value="SUCCESS">Verified Paid</option>
              <option value="test_success">Test Mode Paid (Mock)</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>

        {refundMsg && (
          <div className="p-3.5 rounded-2xl bg-[#EAF5FC] border border-[#DCE6EF] text-xs text-[#163B63] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
            {refundMsg}
          </div>
        )}

        {/* Payments Table Card */}
        <div className="rounded-3xl bg-white border border-[#DCE6EF] shadow-editorial overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#258FE5] mx-auto" />
              <p className="text-xs text-[#64748B]">Loading verified transactions from database...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto text-[#64748B]">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-sm font-serif text-[#163B63]">No payment transactions found</p>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Any appointments booked with online payments will appear here with instant receipt generation.
              </p>
              <Link
                href="/ai-assistant"
                className="inline-flex items-center gap-1.5 text-xs text-[#258FE5] font-semibold hover:underline"
              >
                Book a Consultation →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F9FC] border-b border-[#F1F5F9] text-[#64748B] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Order Reference</th>
                    <th className="py-3.5 px-4">Service / Doctor</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Method</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-[#163B63]">
                  {filteredPayments.map((p) => (
                    <tr key={p.payment_id} className="hover:bg-[#F5F9FC]/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-[#163B63] block">
                          {p.order_reference}
                        </span>
                        <span className="font-mono text-[10px] text-[#64748B]">
                          {p.cf_payment_id || p.razorpay_payment_id || p.payment_id}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-[#163B63] block">
                          {p.service_name}
                        </span>
                        {p.doctor_name && (
                          <span className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                            <Stethoscope className="w-3 h-3 text-[#258FE5]" />
                            {p.doctor_name}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#64748B] whitespace-nowrap">
                        {p.date}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[10px] uppercase tracking-wider bg-[#F1F5F9] px-2 py-0.5 rounded text-[#475569]">
                          {p.payment_method || "UPI"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-sm">
                        {formatINR(p.amount)}
                        {p.refund_amount ? (
                          <span className="block text-[10px] text-[#258FE5] font-normal">
                            Refunded: {formatINR(p.refund_amount)}
                          </span>
                        ) : null}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(p.payment_status)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPayment(p)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] text-[11px] font-medium text-[#334155] hover:bg-white shadow-2xs"
                        >
                          View Details
                        </button>
                        {p.payment_status === "SUCCESS" && (
                          <button
                            type="button"
                            onClick={() => handleRefund(p.payment_id)}
                            disabled={refundLoading}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-rose-600 hover:bg-rose-50"
                            title="Request Refund"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction Detail Slide-Over Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white border border-[#DCE6EF] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#258FE5]" />
                  <h3 className="text-base font-serif text-[#163B63]">
                    Transaction Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="text-xs text-[#64748B] hover:text-[#163B63] font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#EAF5FC]/60 border border-[#DCE6EF] flex justify-between items-center">
                <div>
                  <span className="text-[11px] text-[#163B63] uppercase font-semibold tracking-wider">
                    Amount Paid
                  </span>
                  <div className="text-2xl font-serif font-bold text-[#163B63]">
                    {formatINR(selectedPayment.amount)}
                  </div>
                </div>
                <div>{getStatusBadge(selectedPayment.payment_status)}</div>
              </div>

              <div className="space-y-2 text-xs divide-y divide-[#F1F5F9]">
                <div className="pt-1.5 flex justify-between">
                  <span className="text-[#64748B]">Order Reference:</span>
                  <span className="font-mono font-medium text-[#163B63]">{selectedPayment.order_reference}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#64748B]">Cashfree Payment ID:</span>
                  <span className="font-mono text-[#163B63]">{selectedPayment.cf_payment_id || selectedPayment.razorpay_payment_id || "N/A"}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#64748B]">Cashfree Order ID:</span>
                  <span className="font-mono text-[#163B63]">{selectedPayment.cf_order_id || selectedPayment.razorpay_order_id || "N/A"}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#64748B]">Service:</span>
                  <span className="font-medium text-[#163B63]">{selectedPayment.service_name}</span>
                </div>
                {selectedPayment.doctor_name && (
                  <div className="pt-2 flex justify-between">
                    <span className="text-[#64748B]">Practitioner:</span>
                    <span className="font-semibold text-[#163B63]">{selectedPayment.doctor_name}</span>
                  </div>
                )}
                <div className="pt-2 flex justify-between">
                  <span className="text-[#64748B]">Payment Timestamp:</span>
                  <span className="text-[#163B63]">{selectedPayment.date}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#64748B]">Digital Signature Verified:</span>
                  <span className="font-semibold text-[#20B8AD]">
                    {selectedPayment.signature_verified ? "HMAC SHA-256 Validated" : "Pending"}
                  </span>
                </div>
                {selectedPayment.refund_status && selectedPayment.refund_status !== "none" && (
                  <div className="pt-2 flex justify-between text-[#163B63]">
                    <span>Refund Status:</span>
                    <span className="font-semibold uppercase">{selectedPayment.refund_status} ({formatINR(selectedPayment.refund_amount || selectedPayment.amount)})</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#475569] hover:bg-[#F5F9FC]"
                >
                  Close
                </button>
                {selectedPayment.booking_id && (
                  <Link
                    href="/patient/appointments"
                    className="flex-1 py-2.5 rounded-xl bg-[#258FE5] text-white text-xs font-semibold text-center hover:bg-[#163B63]"
                  >
                    View Appointment
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
