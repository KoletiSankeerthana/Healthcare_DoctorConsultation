"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
  HelpCircle,
  FileQuestion,
  Loader2
} from "lucide-react";

function PaymentFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id") || "";
  const paymentId = searchParams.get("payment_id") || "";
  const rawReason = searchParams.get("reason") || "Payment could not be authorized by the issuing bank.";
  const reason = decodeURIComponent(rawReason);

  const handleRetry = () => {
    // Navigate back to checkout with preserved parameters
    if (orderId) {
      router.push(`/checkout?order_id=${orderId}`);
    } else {
      router.back();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#163B63] flex items-center justify-center text-[#DCE6EF]">
              <span className="font-serif text-xl italic font-normal">H</span>
            </div>
            <span className="text-2xl font-serif text-[#163B63]">{BRAND.name}</span>
          </Link>
        </div>

        {/* Failure Card */}
        <div className="rounded-3xl bg-white border border-rose-200 p-8 shadow-editorial space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
            <AlertTriangle className="w-9 h-9" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              Transaction Declined / Incomplete
            </div>
            <h1 className="text-2xl font-serif text-[#163B63]">
              Payment Failed
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              We were unable to complete your payment with Razorpay.
            </p>
          </div>

          {/* Failure Reason */}
          <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-left space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Gateway Response
            </span>
            <p className="text-xs text-rose-900 font-medium">
              {reason}
            </p>
            <p className="text-[10px] text-rose-600 mt-1">
              No funds were deducted from your account. If an amount was debited, it will be automatically refunded by your bank within 24-48 hours.
            </p>
          </div>

          {orderId && (
            <div className="p-3 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] text-left text-xs text-[#64748B] flex justify-between">
              <span>Order Reference:</span>
              <span className="font-mono text-[#163B63]">{orderId}</span>
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full py-3.5 rounded-2xl bg-[#258FE5] hover:bg-[#163B63] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-editorial"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Payment Now
            </button>

            <Link
              href="/ai-assistant"
              className="w-full py-2.5 rounded-2xl border border-[#CBD5E1] text-[#475569] hover:bg-[#F5F9FC] font-medium text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Choose Another Slot or Doctor
            </Link>
          </div>

          {/* Help notice */}
          <div className="pt-2 text-[11px] text-[#94A3B8] flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need assistance? Contact care@healvia.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F9FC]">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}
