"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { formatINR } from "@/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay";
import {
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  Video,
  Building2,
  Sparkles,
  Tag,
  Stethoscope,
  RefreshCw,
  XCircle,
  Info
} from "lucide-react";

export type PaymentState =
  | "IDLE"
  | "CREATING_ORDER"
  | "LOADING_RAZORPAY"
  | "OPENING_CHECKOUT"
  | "PAYMENT_PENDING"
  | "VERIFYING_PAYMENT"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_CANCELLED";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Booking query parameters
  const existingOrderId = searchParams.get("order_id") || "";
  const initialDoctorId = searchParams.get("doctor_id") || "doc-1";
  const initialDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const initialTime = searchParams.get("time") || searchParams.get("slot") || "09:00 AM - 09:30 AM";
  const initialStartTime = searchParams.get("start_time") || "09:00";
  const initialEndTime = searchParams.get("end_time") || "09:30";
  const initialType = searchParams.get("type") || "online";
  const initialHoldId = searchParams.get("hold_id") || "";
  const initialSymptoms = searchParams.get("symptoms") || "Clinical general consultation";
  const initialNotes = searchParams.get("notes") || "";

  // Dynamic booking state
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [consultDate, setConsultDate] = useState(initialDate);
  const [consultTime, setConsultTime] = useState(initialTime);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [consultType, setConsultType] = useState(initialType);
  const [holdId, setHoldId] = useState(initialHoldId);
  const [symptoms, setSymptoms] = useState(initialSymptoms);
  const [notes, setNotes] = useState(initialNotes);

  // Doctor state
  const [doctor, setDoctor] = useState<any>({
    id: initialDoctorId,
    name: "Dr. Arvind Swaminathan",
    title: "Senior Consultant Cardiologist",
    specialty: "Cardiology",
    consultationFee: 1200,
    clinic: {
      name: "Apex Heart & Vascular Institute",
      address: "14 Cathedral Road, Gopalapuram",
      city: "Chennai"
    }
  });
  const [loadingDoc, setLoadingDoc] = useState(true);

  // Patient Info
  const [patientName, setPatientName] = useState("Aditya Vardhan");
  const [patientEmail, setPatientEmail] = useState("patient@mediverse.org");
  const [patientPhone, setPatientPhone] = useState("+91 98401 23456");

  // Pricing & Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment states
  const [selectedMethod, setSelectedMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [paymentState, setPaymentState] = useState<PaymentState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Order Ref for idempotency & retries
  const currentOrderDataRef = useRef<any>(null);

  // Test Simulator State (for sandbox / developer testing)
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simulatedOrderData, setSimulatedOrderData] = useState<any>(null);

  // Payment mode configuration (mock vs razorpay)
  const [paymentMode, setPaymentMode] = useState<string>("mock");

  useEffect(() => {
    fetch("/api/payments/mode")
      .then((r) => r.json())
      .then((data) => {
        if (data?.payment_mode) setPaymentMode(data.payment_mode);
      })
      .catch((e) => console.warn("[Checkout] Failed to load payment mode:", e));
  }, []);

  // 1. If order_id query param is present (e.g. from failed payment retry), restore order details
  useEffect(() => {
    async function restoreExistingOrder() {
      if (!existingOrderId) return;
      try {
        const res = await fetch(`/api/payments/${existingOrderId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data?.order) {
            const ord = data.order;
            const meta = ord.metadata_json || {};
            if (meta.doctor_id) setDoctorId(meta.doctor_id);
            if (meta.date) setConsultDate(meta.date);
            if (meta.time) setConsultTime(meta.time);
            if (meta.start_time) setStartTime(meta.start_time);
            if (meta.end_time) setEndTime(meta.end_time);
            if (meta.type) setConsultType(meta.type);
            if (meta.hold_id) setHoldId(meta.hold_id);
            if (meta.symptoms) setSymptoms(meta.symptoms);
            if (meta.notes) setNotes(meta.notes);
            if (ord.discount_amount > 0) setDiscountAmount(ord.discount_amount);
            console.info(`[Checkout] Restored existing order details for ${existingOrderId}`);
          }
        }
      } catch (e) {
        console.warn("[Checkout] Could not restore order:", e);
      }
    }
    restoreExistingOrder();
  }, [existingOrderId]);

  // 2. Fetch verified doctor details to calculate verified price
  useEffect(() => {
    async function fetchDoc() {
      try {
        setLoadingDoc(true);
        const res = await fetch(`/api/doctors/${doctorId}`);
        if (res.ok) {
          const data = await res.json();
          setDoctor(data);
        }
      } catch (err) {
        console.error("Failed to load doctor profile:", err);
      } finally {
        setLoadingDoc(false);
      }
    }
    fetchDoc();
  }, [doctorId]);

  // Financial calculations
  const unitPrice = doctor?.consultationFee || 1200;
  const subtotal = unitPrice;
  const taxRate = 0.18; // 18% GST
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const totalAmount = Math.max(Math.round((subtotal + taxAmount - discountAmount) * 100) / 100, 1);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError("");
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === "WELCOME10" || code === "MEDIVERSE10") {
      const disc = Math.round(subtotal * 0.1);
      setDiscountAmount(disc);
      setAppliedCoupon(code);
    } else if (code === "HEALTHFIRST") {
      const disc = Math.min(subtotal, 100);
      setDiscountAmount(disc);
      setAppliedCoupon(code);
    } else {
      setCouponError("Invalid promo code. Try WELCOME10 for 10% off.");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setDiscountAmount(0);
    setCouponError("");
  };

  // Main Pay Now Flow
  const handlePayNow = async () => {
    // Prevent duplicate clicks if already processing
    if (
      paymentState === "CREATING_ORDER" ||
      paymentState === "LOADING_RAZORPAY" ||
      paymentState === "OPENING_CHECKOUT" ||
      paymentState === "PAYMENT_PENDING" ||
      paymentState === "VERIFYING_PAYMENT"
    ) {
      return;
    }

    setErrorMessage(null);
    setPaymentState("CREATING_ORDER");

    let createdOrderData: any = null;

    try {
      // Step 1: Create order on backend with server-side pricing validation
      const createOrderPayload = {
        service_type: "doctor_consultation",
        doctor_id: doctor.id,
        coupon_code: appliedCoupon,
        patient_name: patientName.trim(),
        patient_email: patientEmail.trim(),
        patient_phone: patientPhone.trim(),
        metadata: {
          doctor_name: doctor.name,
          date: consultDate,
          time: consultTime,
          start_time: startTime,
          end_time: endTime,
          type: consultType,
          symptoms: symptoms,
          notes: notes,
          hold_id: holdId,
          booking_payload: {
            doctor_id: doctor.id,
            date: consultDate,
            time: consultTime,
            start_time: startTime,
            end_time: endTime,
            type: consultType,
            patient_name: patientName.trim(),
            patient_email: patientEmail.trim(),
            patient_phone: patientPhone.trim(),
            symptoms: symptoms,
            notes: notes,
            hold_id: holdId
          }
        }
      };

      console.info("[Checkout] Creating payment order on backend...");
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createOrderPayload)
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to create secure payment order on gateway.");
      }

      createdOrderData = orderData;
      currentOrderDataRef.current = orderData;

      // Step 1.5: If in Dummy / Mock Payment Mode, bypass Razorpay modal and confirm payment directly
      if (orderData.payment_mode === "mock" || orderData.is_mock || paymentMode === "mock") {
        console.info("[Checkout] Dummy Payment Mode (PAYMENT_MODE=mock) detected. Completing dummy payment directly...");
        setPaymentState("VERIFYING_PAYMENT");
        const dummyTxnId = `TEST-PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await verifyPaymentOnServer(orderData, {
          razorpay_order_id: orderData.razorpay_order_id || `order_mock_${Date.now()}`,
          razorpay_payment_id: dummyTxnId,
          razorpay_signature: "mock_test_signature"
        });
        return;
      }

      // Step 2: Prepare Gateway Initialization
      setPaymentState("LOADING_RAZORPAY");

      const isDefaultTestPlaceholder =
        !orderData.key_id ||
        orderData.key_id.startsWith("rzp_test_mediverse") ||
        orderData.key_id === "test";

      // If developer test placeholder or sandbox mode, we can launch the gateway simulator directly
      // or attempt official checkout.js if live test key is present
      if (isDefaultTestPlaceholder) {
        console.info("[Checkout] Default Test Mode detected. Opening MediVerse Gateway Simulator.");
        setSimulatedOrderData(orderData);
        setShowSimulatorModal(true);
        setPaymentState("PAYMENT_PENDING");
        return;
      }

      // Step 3: Open Official Razorpay Checkout Modal
      setPaymentState("OPENING_CHECKOUT");

      const checkoutResult = await openRazorpayCheckout({
        keyId: orderData.key_id,
        orderId: orderData.razorpay_order_id,
        amountPaise: orderData.amount_paise,
        currency: orderData.currency || "INR",
        name: "MediVerse Healthcare",
        description: `Consultation with ${doctor.name}`,
        prefill: {
          name: patientName,
          email: patientEmail,
          contact: patientPhone
        },
        notes: {
          order_id: orderData.order_id,
          order_reference: orderData.order_reference
        },
        onOpening: () => {
          setPaymentState("OPENING_CHECKOUT");
        },
        onOpened: () => {
          setPaymentState("PAYMENT_PENDING");
        },
        onSuccess: async (rzpResponse) => {
          await verifyPaymentOnServer(orderData, rzpResponse);
        },
        onFailure: (err) => {
          setPaymentState("PAYMENT_FAILED");
          const reason = err?.description || err?.reason || "Payment was declined by issuing bank.";
          setErrorMessage(reason);
        },
        onDismiss: () => {
          setPaymentState("PAYMENT_CANCELLED");
          setErrorMessage("Payment was dismissed. Your slot reservation remains valid — click Pay to retry.");
        },
        onInitError: (err) => {
          console.warn("[Checkout] Official Razorpay modal init failed:", err.message);
          // Fallback to Test Gateway Simulator so developer or user is never blocked
          setSimulatedOrderData(orderData);
          setShowSimulatorModal(true);
          setPaymentState("PAYMENT_PENDING");
        }
      });

      if (!checkoutResult.success && checkoutResult.reason === "SDK_NOT_LOADED") {
        // Fallback gracefully to Test Simulator
        setSimulatedOrderData(orderData);
        setShowSimulatorModal(true);
        setPaymentState("PAYMENT_PENDING");
      }
    } catch (err: any) {
      console.error("[Checkout] Payment initiation error:", err);
      setPaymentState("PAYMENT_FAILED");
      setErrorMessage(err.message || "An unexpected error occurred during payment initiation. Please retry.");
    } finally {
      // Safety guard: Ensure the UI is never stuck in an intermediate loading state
      setPaymentState((current) => {
        if (
          current === "CREATING_ORDER" ||
          current === "LOADING_RAZORPAY" ||
          current === "OPENING_CHECKOUT"
        ) {
          return "PAYMENT_FAILED";
        }
        return current;
      });
    }
  };

  // Server-side cryptographic signature verification
  const verifyPaymentOnServer = async (orderData: any, rzpResponse: any) => {
    setPaymentState("VERIFYING_PAYMENT");
    setErrorMessage(null);

    try {
      console.info("[Checkout] Verifying payment cryptographic signature with server...");
      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderData.order_id,
          razorpay_order_id: rzpResponse.razorpay_order_id,
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_signature: rzpResponse.razorpay_signature,
          payment_method: selectedMethod,
          booking_payload: orderData.metadata?.booking_payload
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        setPaymentState("PAYMENT_FAILED");
        const failureReason = verifyData.error || "Cryptographic digital signature mismatch.";
        setErrorMessage(failureReason);
        router.push(
          `/payment/failed?order_id=${orderData.order_id}&payment_id=${orderData.payment_id}&reason=${encodeURIComponent(failureReason)}`
        );
        return;
      }

      // Success: redirect to verified payment success page
      setPaymentState("PAYMENT_SUCCESS");
      const targetAptId = verifyData.appointment?.id || verifyData.payment?.booking_id || "";
      router.push(
        `/payment/success?payment_id=${verifyData.payment?.id || orderData.payment_id}&order_id=${orderData.order_id}&reference=${orderData.order_reference}&apt_id=${targetAptId}`
      );
    } catch (err: any) {
      console.error("[Checkout] Verification network error:", err);
      setPaymentState("PAYMENT_FAILED");
      setErrorMessage(err.message || "Network error verifying payment signature.");
      router.push(
        `/payment/failed?order_id=${orderData.order_id}&reason=${encodeURIComponent(err.message || "Network error verifying payment")}`
      );
    }
  };

  // Simulate test mode payment response (for sandbox / developer testing)
  const handleSimulatePayment = async (action: "success" | "fail") => {
    if (!simulatedOrderData) return;
    setShowSimulatorModal(false);

    if (action === "fail") {
      setPaymentState("PAYMENT_FAILED");
      setErrorMessage("Test mode payment simulated failure: Card declined by issuing bank.");
      return;
    }

    // Success simulation
    setPaymentState("VERIFYING_PAYMENT");

    const fakePaymentId = `pay_test_${Math.random().toString(36).substring(2, 12)}`;
    // Compute valid test signature using test mode token format
    const testSignature = `sig_test_${Array(55).fill("0").join("")}`;

    await verifyPaymentOnServer(simulatedOrderData, {
      razorpay_order_id: simulatedOrderData.razorpay_order_id,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: testSignature
    });
  };

  // Button text & state helpers
  const isButtonDisabled =
    paymentState === "CREATING_ORDER" ||
    paymentState === "LOADING_RAZORPAY" ||
    paymentState === "OPENING_CHECKOUT" ||
    paymentState === "VERIFYING_PAYMENT" ||
    paymentState === "PAYMENT_SUCCESS";

  const getButtonContent = () => {
    switch (paymentState) {
      case "CREATING_ORDER":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating Secure Payment...</span>
          </>
        );
      case "LOADING_RAZORPAY":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading Payment Gateway...</span>
          </>
        );
      case "OPENING_CHECKOUT":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Opening Razorpay...</span>
          </>
        );
      case "PAYMENT_PENDING":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Payment in Progress...</span>
          </>
        );
      case "VERIFYING_PAYMENT":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying Payment...</span>
          </>
        );
      case "PAYMENT_SUCCESS":
        return (
          <>
            <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
            <span>Payment Successful</span>
          </>
        );
      case "PAYMENT_FAILED":
        return (
          <>
            <RefreshCw className="w-4 h-4" />
            <span>Payment Failed – Retry</span>
          </>
        );
      case "PAYMENT_CANCELLED":
        return (
          <>
            <RefreshCw className="w-4 h-4" />
            <span>Payment Cancelled – Try Again</span>
          </>
        );
      case "IDLE":
      default:
        if (paymentMode === "mock") {
          return (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
              <span>Complete Dummy Payment ({formatINR(totalAmount)})</span>
            </>
          );
        }
        return (
          <>
            <Lock className="w-4 h-4" />
            <span>Pay {formatINR(totalAmount)} with Razorpay</span>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 px-4 sm:px-6 lg:px-8 font-serif">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-2 text-sm text-[#526A82] hover:text-[#163B63] font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Consultations
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#D5E4EF]">
            <ShieldCheck className="w-4 h-4 text-[#258FE5]" />
            256-bit Encrypted Checkout
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
            Consultation Checkout
          </h1>
          <p className="text-sm text-[#526A82] mt-1">
            Review service breakdown and complete payment securely
          </p>
        </div>

        {paymentMode === "mock" && (
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold">Test Mode Active:</span>
              <span className="text-amber-800 text-xs">No real payment will be processed. Dummy transactions are recorded safely.</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
              PAYMENT_MODE=mock
            </span>
          </div>
        )}

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Payment Attention Required</p>
                <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setPaymentState("IDLE");
              }}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {paymentState === "PAYMENT_CANCELLED" && !errorMessage && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Checkout was closed. Your slot reservation is preserved. Click below to retry.</span>
            </div>
            <button
              type="button"
              onClick={handlePayNow}
              className="text-xs font-bold text-amber-900 underline"
            >
              Retry Now
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Service Details & Patient Info */}
          <div className="lg:col-span-7 space-y-6">
            {/* Service Card */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-editorial space-y-5">
              <div className="flex items-start justify-between border-b border-[#F1F5F9] pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#258FE5] bg-[#EAF5FC] px-2.5 py-1 rounded-full">
                    {consultType === "online" ? "Telehealth Video Consultation" : "In-Clinic Visit"}
                  </span>
                  <h3 className="text-lg font-serif text-[#163B63] mt-2">
                    {doctor.name}
                  </h3>
                  <p className="text-xs text-[#526A82]">
                    {doctor.specialty} • {doctor.clinic?.name || "MediVerse Health"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#EAF5FC] flex items-center justify-center text-[#258FE5]">
                  <Stethoscope className="w-6 h-6" />
                </div>
              </div>

              {/* Appointment Time Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-1">
                  <span className="text-[#526A82] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#258FE5]" />
                    Date
                  </span>
                  <p className="font-semibold text-[#163B63]">
                    {new Date(consultDate).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-1">
                  <span className="text-[#526A82] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#258FE5]" />
                    Scheduled Slot
                  </span>
                  <p className="font-semibold text-[#163B63]">{consultTime}</p>
                </div>
              </div>

              {/* Mode Specific Note */}
              <div className="p-3.5 rounded-2xl bg-[#EAF5FC]/60 border border-[#D5E4EF] text-xs text-[#163B63] flex items-start gap-2.5">
                {consultType === "online" ? (
                  <>
                    <Video className="w-4 h-4 text-[#258FE5] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Instant HD Video Consultation Room</span>
                      <p className="text-[11px] text-[#163B63] mt-0.5">
                        A dedicated WebRTC consultation room link will be generated instantly upon verified payment.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 text-[#258FE5] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Direct Clinic Access</span>
                      <p className="text-[11px] text-[#163B63] mt-0.5">
                        {doctor.clinic?.address}, {doctor.clinic?.city}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Patient Info Card */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-editorial space-y-4">
              <h3 className="text-sm font-semibold text-[#163B63] uppercase tracking-wider text-xs">
                Patient Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">Full Name</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] focus:ring-2 focus:ring-[#258FE5] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] focus:ring-2 focus:ring-[#258FE5] outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Email Address (for receipt & video room link)
                  </label>
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] focus:ring-2 focus:ring-[#258FE5] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-editorial space-y-4">
              <h3 className="text-sm font-semibold text-[#163B63] uppercase tracking-wider text-xs">
                Preferred Payment Method
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMethod("upi")}
                  className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    selectedMethod === "upi"
                      ? "bg-[#EAF5FC] border-[#258FE5] text-[#258FE5] font-semibold ring-2 ring-[#258FE5]/20"
                      : "bg-[#F5F9FC] border-[#D5E4EF] text-[#526A82] hover:border-[#CBD5E1]"
                  }`}
                >
                  <span className="text-xs font-bold">UPI / QR</span>
                  <span className="text-[10px] text-[#526A82]">GPay, PhonePe, Paytm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMethod("card")}
                  className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    selectedMethod === "card"
                      ? "bg-[#EAF5FC] border-[#258FE5] text-[#258FE5] font-semibold ring-2 ring-[#258FE5]/20"
                      : "bg-[#F5F9FC] border-[#D5E4EF] text-[#526A82] hover:border-[#CBD5E1]"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-[#258FE5]" />
                  <span className="text-xs font-bold">Cards</span>
                  <span className="text-[10px] text-[#526A82]">Debit / Credit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMethod("netbanking")}
                  className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    selectedMethod === "netbanking"
                      ? "bg-[#EAF5FC] border-[#258FE5] text-[#258FE5] font-semibold ring-2 ring-[#258FE5]/20"
                      : "bg-[#F5F9FC] border-[#D5E4EF] text-[#526A82] hover:border-[#CBD5E1]"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-[#258FE5]" />
                  <span className="text-xs font-bold">Net Banking</span>
                  <span className="text-[10px] text-[#526A82]">All Major Banks</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Complete Payment Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-editorial space-y-5 sticky top-6">
              <h3 className="text-base font-serif text-[#163B63]">
                Payment Summary
              </h3>

              {/* Itemized breakdown */}
              <div className="space-y-3 text-xs border-b border-[#F1F5F9] pb-4">
                <div className="flex justify-between items-center text-[#475569]">
                  <span>Consultation Fee (Unit Price)</span>
                  <span className="font-semibold text-[#163B63]">{formatINR(unitPrice)}</span>
                </div>
                <div className="flex justify-between items-center text-[#475569]">
                  <span>Quantity</span>
                  <span className="font-semibold text-[#163B63]">1</span>
                </div>
                <div className="flex justify-between items-center text-[#475569]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#163B63]">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-[#475569]">
                  <span className="flex items-center gap-1">
                    Applicable GST (18%)
                    <Info className="w-3 h-3 text-[#94A3B8]" />
                  </span>
                  <span className="font-semibold text-[#163B63]">{formatINR(taxAmount)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-[#20B8AD] font-medium">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      Promo Discount ({appliedCoupon})
                    </span>
                    <span>-{formatINR(discountAmount)}</span>
                  </div>
                )}
              </div>

              {/* Coupon Code Section */}
              <div className="space-y-2">
                {appliedCoupon ? (
                  <div className="p-2.5 rounded-xl bg-[#EAF5FC] border border-[#D5E4EF] flex items-center justify-between text-xs text-[#163B63]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Tag className="w-3.5 h-3.5" />
                      Coupon <strong>{appliedCoupon}</strong> applied!
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-[#163B63] hover:text-[#163B63] underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Promo (WELCOME10)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#CBD5E1] uppercase tracking-wider outline-none focus:ring-1 focus:ring-[#258FE5]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-[#163B63] text-white text-xs font-medium hover:bg-[#163B63] transition-all"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponError && (
                  <p className="text-[11px] text-rose-600">{couponError}</p>
                )}
              </div>

              {/* Final Payable Amount */}
              <div className="pt-2 border-t border-[#F1F5F9] flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-[#526A82]">Final Payable Amount</span>
                  <p className="text-[11px] text-[#94A3B8]">Inclusive of all applicable taxes</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-serif text-[#163B63] font-bold">
                    {formatINR(totalAmount)}
                  </span>
                </div>
              </div>

              {paymentMode === "mock" && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>Test Mode:</strong> No real payment will be processed.</span>
                </div>
              )}

              {/* Pay Now Button with Explicit State Reflection */}
              <button
                type="button"
                onClick={handlePayNow}
                disabled={isButtonDisabled}
                className={`w-full py-4 rounded-2xl font-semibold text-sm shadow-editorial transition-all flex items-center justify-center gap-2 ${
                  paymentState === "PAYMENT_FAILED"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : paymentState === "PAYMENT_CANCELLED"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : paymentState === "PAYMENT_SUCCESS"
                    ? "bg-[#258FE5] text-white"
                    : "bg-[#258FE5] hover:bg-[#163B63] text-white disabled:opacity-60"
                }`}
              >
                {getButtonContent()}
              </button>

              {/* Trust Badges */}
              <div className="space-y-2 pt-2 text-[11px] text-[#526A82]">
                <div className="flex items-center gap-2 justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#20B8AD]" />
                  <span>Razorpay PCI-DSS Level 1 Compliant</span>
                </div>
                <p className="text-center text-[10px] text-[#94A3B8]">
                  By proceeding, you authorize MediVerse to process this payment for the scheduled consultation. Full refund available up to 24 hours prior to appointment time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Test Mode Gateway Modal (Fallback for Sandbox / Developer testing) */}
        {showSimulatorModal && simulatedOrderData && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#258FE5]" />
                  <h3 className="text-base font-semibold text-[#163B63]">Razorpay Test Mode Gateway</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EAF5FC] text-[#163B63] px-2.5 py-0.5 rounded-full">
                  Test Mode Active
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Doctor:</span>
                  <span className="font-medium text-[#163B63]">{doctor.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Date & Slot:</span>
                  <span className="font-medium text-[#163B63]">{consultDate} • {consultTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Order Reference:</span>
                  <span className="font-mono font-medium text-[#163B63]">{simulatedOrderData.order_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Razorpay Order ID:</span>
                  <span className="font-mono font-medium text-[#163B63]">{simulatedOrderData.razorpay_order_id}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#D5E4EF]">
                  <span className="text-[#526A82]">Total Amount:</span>
                  <span className="font-bold text-[#258FE5] text-sm">{formatINR(simulatedOrderData.amount)}</span>
                </div>
              </div>

              <p className="text-xs text-[#526A82]">
                This environment is running in Test Mode. Select a payment outcome to test the cryptographic signature and appointment confirmation workflow:
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleSimulatePayment("success")}
                  className="w-full py-3 rounded-xl bg-[#258FE5] text-white font-medium text-xs hover:bg-[#258FE5] transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Authorize & Confirm Payment (Verify HMAC Signature)
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulatePayment("fail")}
                  className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-medium text-xs hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Simulate Card Declined (Test Failure Handler)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSimulatorModal(false);
                    setPaymentState("PAYMENT_CANCELLED");
                    setErrorMessage("Payment was dismissed. You can retry when ready.");
                  }}
                  className="w-full py-2 rounded-xl text-xs text-[#526A82] hover:text-[#163B63] flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancel and Dismiss Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F9FC]">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#258FE5] mx-auto" />
            <p className="text-xs text-[#526A82]">Loading secure checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
