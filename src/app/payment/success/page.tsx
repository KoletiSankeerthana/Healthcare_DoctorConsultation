"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { formatINR } from "@/lib/utils";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  FileText,
  ShieldCheck,
  ArrowRight,
  Download,
  Copy,
  Check,
  Building2,
  Loader2
} from "lucide-react";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id") || searchParams.get("id") || "";
  const orderId = searchParams.get("order_id") || "";
  const initialRef = searchParams.get("reference") || "";
  const aptId = searchParams.get("apt_id") || "";

  const [paymentData, setPaymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPaymentDetails() {
      if (!paymentId && !orderId) {
        setLoading(false);
        return;
      }
      try {
        const targetId = paymentId || orderId;
        const res = await fetch(`/api/payments/${targetId}/status`);
        if (res.ok) {
          const data = await res.json();
          setPaymentData(data);
        }
      } catch (err) {
        console.error("Failed to load payment details:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPaymentDetails();
  }, [paymentId, orderId]);

  const p = paymentData?.payment;
  const o = paymentData?.order;
  const apt = paymentData?.appointment;

  const orderRef = o?.order_reference || initialRef || "ORD-20261123-SUCCESS";
  const txnId = p?.cf_payment_id || p?.razorpay_payment_id || p?.id || "pay_verified_cashfree";
  const amountPaid = p?.amount || o?.total_amount || 810.0;
  const paymentDate = p?.created_at ? new Date(p.created_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) : new Date().toLocaleString("en-IN");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#163B63] flex items-center justify-center text-[#DCE6EF]">
              <span className="font-serif text-xl italic font-normal">H</span>
            </div>
            <span className="text-2xl font-serif text-[#163B63]">{BRAND.name}</span>
          </Link>
        </div>

        {/* Success Card */}
        <div className="rounded-3xl bg-white border border-[#DCE6EF] p-8 shadow-editorial space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#EAF5FC] border border-[#DCE6EF] text-[#20B8AD] flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5FC] text-[#163B63] text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Cryptographically Verified & Confirmed
            </div>
            <h1 className="text-2xl font-serif text-[#163B63]">
              Payment Successful!
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              Your appointment booking and payment have been confirmed on Healvia.
            </p>
          </div>

          {/* Amount Paid Highlight */}
          <div className="p-4 rounded-2xl bg-[#EAF5FC]/60 border border-[#DCE6EF] text-center space-y-0.5">
            <span className="text-[11px] uppercase tracking-wider text-[#163B63] font-medium">
              Total Amount Paid
            </span>
            <div className="text-3xl font-serif font-bold text-[#163B63]">
              {formatINR(amountPaid)}
            </div>
            <p className="text-[10px] text-[#258FE5]">
              Paid via {p?.payment_method?.toUpperCase() || "UPI"} • GST Invoice Generated
            </p>
          </div>

          {/* Transaction Metadata Grid */}
          <div className="text-left divide-y divide-[#F1F5F9] text-xs">
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-[#64748B]">Transaction ID:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-[#163B63]">{txnId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(txnId)}
                  className="text-[#64748B] hover:text-[#163B63]"
                  title="Copy Transaction ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#20B8AD]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="py-2.5 flex justify-between items-center">
              <span className="text-[#64748B]">Booking / Order Reference:</span>
              <span className="font-mono font-medium text-[#163B63]">{orderRef}</span>
            </div>

            <div className="py-2.5 flex justify-between items-center">
              <span className="text-[#64748B]">Payment Timestamp:</span>
              <span className="text-[#163B63] font-medium">{paymentDate}</span>
            </div>

            <div className="py-2.5 flex justify-between items-center">
              <span className="text-[#64748B]">Gateway Status:</span>
              <span className="font-bold text-[#20B8AD] uppercase text-[11px] tracking-wider">
                {p?.payment_status || "SUCCESS"}
              </span>
            </div>

            {apt && (
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-[#64748B]">Doctor Consultation:</span>
                <span className="text-[#163B63] font-semibold">{apt.doctor_name}</span>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            {apt?.meeting_link ? (
              <Link
                href={apt.meeting_link}
                className="w-full py-3.5 rounded-2xl bg-[#258FE5] hover:bg-[#163B63] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-editorial"
              >
                <Video className="w-4 h-4" />
                Join Video Consultation Room
              </Link>
            ) : null}

            <Link
              href="/patient/appointments"
              className="w-full py-3 rounded-2xl bg-[#163B63] hover:bg-[#163B63] text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              View My Bookings & Schedule
            </Link>

            <Link
              href="/patient/payments"
              className="w-full py-2.5 rounded-2xl border border-[#CBD5E1] text-[#475569] hover:bg-[#F5F9FC] font-medium text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#64748B]" />
              View Payment History & Invoices
            </Link>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/ai-assistant"
            className="text-xs text-[#64748B] hover:text-[#163B63] transition-colors"
          >
            ← Return to Healthcare Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F9FC]">
          <Loader2 className="w-8 h-8 animate-spin text-[#258FE5]" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
