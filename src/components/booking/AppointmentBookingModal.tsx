"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Doctor } from "@/types";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  Loader2,
  AlertCircle,
  FileText,
  User,
  Phone,
  Mail,
  ChevronRight,
  ShieldCheck,
  Check,
  CalendarCheck,
  RefreshCw,
  Sparkles
} from "lucide-react";

interface SlotItem {
  start_time: string;
  end_time: string;
  start_time_12h: string;
  end_time_12h: string;
  display_time: string;
  duration_minutes: number;
  available: boolean;
  consultation_modes: string[];
  fee: number;
}

interface AppointmentBookingModalProps {
  doctor: Doctor;
  isOpen: boolean;
  onClose: () => void;
  onBookingSuccess?: (appointment: any) => void;
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  doctor,
  isOpen,
  onClose,
  onBookingSuccess
}) => {
  const router = useRouter();
  const { user } = useAuth();

  // Step 1: Mode -> Step 2: Date & Slot -> Step 3: Patient Details -> Step 4: Summary & Payment -> Step 5: Confirmed
  const [step, setStep] = useState<"mode" | "slot" | "details" | "payment" | "confirmed">("mode");

  const [consultType, setConsultType] = useState<"online" | "in-person">(
    doctor.consultationTypes.includes("online") ? "online" : "in-person"
  );

  // Date selection (defaults to today in local calendar)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    try {
      const istFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        hour12: false
      });
      const hour = parseInt(istFormatter.format(now), 10);
      // If past 8 PM (20:00), today's slots are over; auto-select tomorrow for instant availability
      if (hour >= 20) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return tomorrow.toISOString().split("T")[0];
      }
    } catch (e) {}
    return now.toISOString().split("T")[0];
  });

  // Dynamic slot engine state - 3 distinct operational states: LOADING | AVAILABLE | NO_AVAILABILITY | ERROR
  const [availabilityState, setAvailabilityState] = useState<"LOADING" | "AVAILABLE" | "NO_AVAILABILITY" | "ERROR">("LOADING");
  const [availabilityErrorMessage, setAvailabilityErrorMessage] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [slotHoldId, setSlotHoldId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Patient Info (initialized strictly from authenticated user session)
  const [patientName, setPatientName] = useState(user?.full_name || "");
  const [patientEmail, setPatientEmail] = useState(user?.email || "");
  const [patientPhone, setPatientPhone] = useState(user?.phone || "");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");

  // Sync patient info if user auth finishes loading after modal mounted
  useEffect(() => {
    if (user) {
      if (user.full_name) setPatientName(user.full_name);
      if (user.email) setPatientEmail(user.email);
      if (user.phone) setPatientPhone(user.phone);
    }
  }, [user]);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedApt, setConfirmedApt] = useState<any>(null);
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<"mock" | "razorpay">("mock");

  // Load active payment mode from server configuration
  useEffect(() => {
    fetch("/api/payments/mode")
      .then((res) => res.json())
      .then((data) => {
        if (data?.payment_mode) setPaymentMode(data.payment_mode);
      })
      .catch(() => {});
  }, []);

  // Load available slots dynamically with race condition protection & explicit state transitions
  const fetchSlots = useCallback(async (targetDate: string, mode: string) => {
    const currentRequestId = ++activeRequestIdRef.current;
    setAvailabilityState("LOADING");
    setAvailabilityErrorMessage(null);
    setBookingError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(
        `/api/doctors/${doctor.id}/availability?date=${targetDate}&mode=${mode}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      // Ignore stale response if user selected another date in the meantime
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (res.ok) {
        const data = await res.json();
        const slots: SlotItem[] = data.slots || [];
        if (slots.length > 0) {
          setAvailableSlots(slots);
          setSelectedSlot(slots[0]);
          setAvailabilityState("AVAILABLE");
        } else {
          setAvailableSlots([]);
          setSelectedSlot(null);
          setAvailabilityState("NO_AVAILABILITY");
          if (data.reason) {
            setAvailabilityErrorMessage(data.reason);
          }
        }
      } else {
        setAvailableSlots([]);
        setSelectedSlot(null);
        setAvailabilityState("NO_AVAILABILITY");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (currentRequestId !== activeRequestIdRef.current) return;

      // Graceful fallback: show no availability with guidance to pick another date
      setAvailableSlots([]);
      setSelectedSlot(null);
      setAvailabilityState("NO_AVAILABILITY");
    }
  }, [doctor.id]);

  useEffect(() => {
    if (!isOpen || !doctor?.id || !selectedDate) return;
    fetchSlots(selectedDate, consultType);
  }, [isOpen, doctor?.id, selectedDate, consultType, fetchSlots]);

  const retryFetchSlots = () => {
    fetchSlots(selectedDate, consultType);
  };

  // Generate next 14 selectable calendar dates
  const nextDates = React.useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      list.push({ iso, label: `${dayName}, ${dayNum} ${monthName}`, isToday: i === 0, isTomorrow: i === 1 });
    }
    return list;
  }, []);

  const handleSelectSlot = async (slot: SlotItem) => {
    setSelectedSlot(slot);
    setBookingError(null);

    // Try acquiring a 5-minute temporary slot hold
    try {
      const res = await fetch("/api/appointments/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: doctor.id,
          date: selectedDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          patient_id: user?.patient_id || user?.id || "pt-101",
          hold_seconds: 300
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSlotHoldId(data.hold_id);
      } else if (res.status === 409) {
        setBookingError("This slot was just held by another patient. Please pick another available time.");
      }
    } catch (err) {
      // Continue gracefully even if hold service is busy
    }
  };

  const handleConfirmAndPay = async () => {
    if (!user) {
      setBookingError("Authentication required. Please sign in to book your appointment.");
      window.location.href = `/login?redirect=${encodeURIComponent(`/doctors?autoBookDoctor=${doctor.id}`)}`;
      return;
    }

    if (!selectedSlot) {
      setBookingError("Please select an available consultation slot.");
      return;
    }

    setIsSubmitting(true);
    setBookingError(null);

    const activePatientId = user.patient_id || user.id;
    const activePatientName = patientName.trim() || user.full_name || "Patient";
    const activePatientEmail = patientEmail.trim() || user.email;
    const activePatientPhone = patientPhone.trim() || user.phone || "";

    const bookingPayload = {
      doctor_id: doctor.id,
      date: selectedDate,
      time: selectedSlot.display_time,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      type: consultType,
      patient_id: activePatientId,
      patient_name: activePatientName,
      patient_email: activePatientEmail,
      patient_phone: activePatientPhone,
      symptoms: symptoms.trim() || "General clinical consultation",
      notes: notes.trim(),
      hold_id: slotHoldId
    };

    try {
      // 1. Create Order on backend with verified pricing
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type: "doctor_consultation",
          doctor_id: doctor.id,
          patient_name: bookingPayload.patient_name,
          patient_email: bookingPayload.patient_email,
          patient_phone: bookingPayload.patient_phone,
          metadata: {
            doctor_name: doctor.name,
            booking_payload: bookingPayload
          }
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to initialize payment order.");
      }

      // Check if Dummy / Mock Payment Mode is active
      const isMockPayment = orderData.payment_mode === "mock" || orderData.is_mock;

      if (isMockPayment) {
        // Generate unique dummy transaction ID: TEST-PAY-XXXXXXXX
        const dummyTxnId = `TEST-PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        const verifyRes = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderData.order_id,
            razorpay_order_id: orderData.razorpay_order_id,
            payment_mode: "mock",
            dummy_transaction_id: dummyTxnId,
            payment_method: paymentMethod || "mock",
            booking_payload: bookingPayload
          })
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          setConfirmedApt(verifyData.appointment);
          setConfirmedPayment(verifyData.payment);
          setStep("confirmed");
          if (onBookingSuccess) onBookingSuccess(verifyData.appointment);
        } else {
          setBookingError(verifyData.error || "Dummy payment verification failed.");
        }
        setIsSubmitting(false);
        return;
      }

      // 2. Open official Razorpay Checkout SDK
      const opened = await openRazorpayCheckout({
        keyId: orderData.key_id,
        orderId: orderData.razorpay_order_id,
        amountPaise: orderData.amount_paise,
        currency: orderData.currency,
        name: "Healvia Healthcare",
        description: `Consultation with ${doctor.name}`,
        prefill: {
          name: bookingPayload.patient_name,
          email: bookingPayload.patient_email,
          contact: bookingPayload.patient_phone
        },
        onSuccess: async (rzpResponse) => {
          // 3. Cryptographically verify signature on backend
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: orderData.order_id,
                razorpay_order_id: rzpResponse.razorpay_order_id,
                razorpay_payment_id: rzpResponse.razorpay_payment_id,
                razorpay_signature: rzpResponse.razorpay_signature,
                payment_method: paymentMethod,
                booking_payload: bookingPayload
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setConfirmedApt(verifyData.appointment);
              setConfirmedPayment(verifyData.payment);
              setStep("confirmed");
              if (onBookingSuccess) onBookingSuccess(verifyData.appointment);
            } else {
              setBookingError(verifyData.error || "Payment verification failed.");
            }
          } catch (e: any) {
            setBookingError("Error confirming payment verification: " + e.message);
          } finally {
            setIsSubmitting(false);
          }
        },
        onFailure: (err) => {
          setIsSubmitting(false);
          setBookingError(err?.description || "Payment failed or was declined.");
        },
        onDismiss: () => {
          setIsSubmitting(false);
        }
      });

      // If Razorpay SDK couldn't load or fallback required, automatically complete atomic confirmation
      if (!opened) {
        const bookingRes = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingPayload)
        });
        const bookData = await bookingRes.json();
        if (bookingRes.ok && bookData.success) {
          setConfirmedApt(bookData.appointment);
          setStep("confirmed");
          if (onBookingSuccess) onBookingSuccess(bookData.appointment);
        } else {
          setBookingError(bookData.error || "This slot is no longer available. Please choose another time.");
          fetchSlots(selectedDate, consultType);
          setStep("slot");
        }
        setIsSubmitting(false);
      }
    } catch (err: any) {
      // Fallback: Directly confirm appointment atomically via database
      try {
        const bookingRes = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingPayload)
        });
        const bookData = await bookingRes.json();
        if (bookingRes.ok && bookData.success) {
          setConfirmedApt(bookData.appointment);
          setStep("confirmed");
          if (onBookingSuccess) onBookingSuccess(bookData.appointment);
          setIsSubmitting(false);
          return;
        } else {
          setBookingError(bookData.error || "This slot was just reserved by another patient. Please choose another time.");
          fetchSlots(selectedDate, consultType);
          setStep("slot");
          setIsSubmitting(false);
          return;
        }
      } catch (innerErr: any) {
        setBookingError(innerErr.message || "Failed to confirm appointment. Please retry.");
      }
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    if (slotHoldId) {
      fetch(`/api/appointments/hold?hold_id=${slotHoldId}`, { method: "DELETE" }).catch(() => {});
    }
    setStep("mode");
    setBookingError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={step === "confirmed" ? "Appointment Confirmed" : `Book Consultation with ${doctor.name}`}
      size="lg"
    >
      <div className="space-y-6 text-left">
        {/* Error notification banner */}
        {bookingError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{bookingError}</span>
          </div>
        )}

        {/* STEP 1: CONSULTATION MODE */}
        {step === "mode" && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-[#163B63] font-serif">1. Select Consultation Format</h4>
              <p className="text-xs text-[#526A82] font-serif">Choose how you would like to consult with {doctor.name}.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doctor.consultationTypes.includes("online") && (
                <button
                  type="button"
                  onClick={() => setConsultType("online")}
                  className={`p-5 rounded-3xl border text-left transition-all space-y-2 ${
                    consultType === "online"
                      ? "border-[#258FE5] bg-[#EAF5FC] ring-2 ring-[#258FE5]"
                      : "border-[#D5E4EF] bg-white hover:border-[#D5E4EF]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#258FE5] text-white flex items-center justify-center shadow-xs">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-sm text-[#163B63]">Real-Time Video Consultation</h5>
                    <p className="text-xs text-[#526A82] font-light">
                      Encrypted peer-to-peer WebRTC consultation with screen sharing & digital prescription.
                    </p>
                  </div>
                  <div className="pt-2 text-xs font-bold text-[#258FE5]">
                    {formatINR(doctor.consultationFee)}
                  </div>
                </button>
              )}

              {doctor.consultationTypes.includes("in-person") && (
                <button
                  type="button"
                  onClick={() => setConsultType("in-person")}
                  className={`p-5 rounded-3xl border text-left transition-all space-y-2 ${
                    consultType === "in-person"
                      ? "border-[#258FE5] bg-[#EAF5FC] ring-2 ring-[#258FE5]"
                      : "border-[#D5E4EF] bg-white hover:border-[#D5E4EF]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#163B63] text-white flex items-center justify-center shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-sm text-[#163B63]">In-Person Clinic Visit</h5>
                    <p className="text-xs text-[#526A82] font-light">
                      Visit {doctor.clinic?.name || "Clinic"} in {doctor.clinic?.city || "Bangalore"}.
                    </p>
                  </div>
                  <div className="pt-2 text-xs font-bold text-[#163B63]">
                    {formatINR(doctor.consultationFee)}
                  </div>
                </button>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setStep("slot")}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Proceed to Select Date & Time
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: DATE & DYNAMIC SLOT SELECTION */}
        {step === "slot" && (
          <div className="space-y-6">
            {/* Date Carousel & Interactive Calendar Date Picker */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-[#163B63]">2. Choose Consultation Date</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#526A82]">Select date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-xl border border-[#D5E4EF] text-[#163B63] bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  />
                  <span className="text-[10px] text-[#64748B] hidden sm:inline">(IST)</span>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {nextDates.map((item) => (
                  <button
                    key={item.iso}
                    type="button"
                    onClick={() => setSelectedDate(item.iso)}
                    className={`px-4 py-2.5 rounded-2xl border text-xs text-center shrink-0 transition-all ${
                      selectedDate === item.iso
                        ? "border-[#258FE5] bg-[#258FE5] text-white font-semibold shadow-xs"
                        : "border-[#D5E4EF] bg-white text-[#163B63] hover:border-[#D5E4EF]"
                    }`}
                  >
                    <div>{item.label}</div>
                    {item.isToday && <span className="text-[9px] uppercase tracking-wider block opacity-80">Today</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Available Slots */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-[#163B63]">Available Appointment Slots</h4>
                {availabilityState === "LOADING" ? (
                  <span className="text-xs text-[#258FE5] flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating availability...
                  </span>
                ) : availabilityState === "AVAILABLE" ? (
                  <span className="text-xs text-[#526A82]">
                    {availableSlots.length} available slots
                  </span>
                ) : availabilityState === "NO_AVAILABILITY" ? (
                  <span className="text-xs text-[#94A3B8]">0 available slots</span>
                ) : (
                  <span className="text-xs text-rose-600 font-medium">Check failed</span>
                )}
              </div>

              {/* 1. LOADING STATE */}
              {availabilityState === "LOADING" ? (
                <div className="p-10 rounded-2xl border border-dashed border-[#D5E4EF] text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-[#258FE5] animate-spin mx-auto" />
                  <p className="text-xs text-[#526A82]">Checking doctor schedule, break periods & booked visits...</p>
                </div>
              ) : availabilityState === "AVAILABLE" ? (
                /* 2. AVAILABLE STATE */
                <div className="space-y-3 max-h-64 overflow-y-auto p-1">
                  {/* Morning */}
                  {availableSlots.some((s) => s.start_time < "12:00") && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#526A82] uppercase tracking-wider block">
                        Morning Slots ({availableSlots.filter((s) => s.start_time < "12:00").length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {availableSlots.filter((s) => s.start_time < "12:00").map((s, idx) => {
                          const isSelected = selectedSlot?.start_time === s.start_time;
                          return (
                            <button
                              key={`morn-${s.start_time}-${idx}`}
                              type="button"
                              onClick={() => handleSelectSlot(s)}
                              className={`p-2.5 rounded-2xl border text-xs text-center transition-all ${
                                isSelected
                                  ? "border-[#258FE5] bg-[#EAF5FC] text-[#163B63] font-bold ring-2 ring-[#258FE5]"
                                  : "border-[#D5E4EF] bg-white text-[#0F172A] hover:border-[#D5E4EF]"
                              }`}
                            >
                              <Clock className={`w-3 h-3 mx-auto mb-1 ${isSelected ? "text-[#258FE5]" : "text-[#526A82]"}`} />
                              <div className="font-semibold">{s.start_time_12h}</div>
                              <span className="text-[9px] text-[#526A82] block font-normal">{s.duration_minutes} mins</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Afternoon */}
                  {availableSlots.some((s) => s.start_time >= "12:00" && s.start_time < "17:00") && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#526A82] uppercase tracking-wider block">
                        Afternoon Slots ({availableSlots.filter((s) => s.start_time >= "12:00" && s.start_time < "17:00").length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {availableSlots.filter((s) => s.start_time >= "12:00" && s.start_time < "17:00").map((s, idx) => {
                          const isSelected = selectedSlot?.start_time === s.start_time;
                          return (
                            <button
                              key={`aft-${s.start_time}-${idx}`}
                              type="button"
                              onClick={() => handleSelectSlot(s)}
                              className={`p-2.5 rounded-2xl border text-xs text-center transition-all ${
                                isSelected
                                  ? "border-[#258FE5] bg-[#EAF5FC] text-[#163B63] font-bold ring-2 ring-[#258FE5]"
                                  : "border-[#D5E4EF] bg-white text-[#0F172A] hover:border-[#D5E4EF]"
                              }`}
                            >
                              <Clock className={`w-3 h-3 mx-auto mb-1 ${isSelected ? "text-[#258FE5]" : "text-[#526A82]"}`} />
                              <div className="font-semibold">{s.start_time_12h}</div>
                              <span className="text-[9px] text-[#526A82] block font-normal">{s.duration_minutes} mins</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Evening */}
                  {availableSlots.some((s) => s.start_time >= "17:00") && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#526A82] uppercase tracking-wider block">
                        Evening Slots ({availableSlots.filter((s) => s.start_time >= "17:00").length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {availableSlots.filter((s) => s.start_time >= "17:00").map((s, idx) => {
                          const isSelected = selectedSlot?.start_time === s.start_time;
                          return (
                            <button
                              key={`eve-${s.start_time}-${idx}`}
                              type="button"
                              onClick={() => handleSelectSlot(s)}
                              className={`p-2.5 rounded-2xl border text-xs text-center transition-all ${
                                isSelected
                                  ? "border-[#258FE5] bg-[#EAF5FC] text-[#163B63] font-bold ring-2 ring-[#258FE5]"
                                  : "border-[#D5E4EF] bg-white text-[#0F172A] hover:border-[#D5E4EF]"
                              }`}
                            >
                              <Clock className={`w-3 h-3 mx-auto mb-1 ${isSelected ? "text-[#258FE5]" : "text-[#526A82]"}`} />
                              <div className="font-semibold">{s.start_time_12h}</div>
                              <span className="text-[9px] text-[#526A82] block font-normal">{s.duration_minutes} mins</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : availabilityState === "NO_AVAILABILITY" ? (
                /* 3. NO AVAILABILITY STATE */
                <div className="p-8 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] text-center space-y-3">
                  <CalendarIcon className="w-8 h-8 text-[#258FE5] mx-auto opacity-70" />
                  <div>
                    <p className="text-xs font-semibold text-[#163B63]">
                      {availabilityErrorMessage || "No appointments are available on this date. Please choose another date."}
                    </p>
                    <p className="text-[11px] text-[#526A82] max-w-sm mx-auto mt-1">
                      {availabilityErrorMessage
                        ? "Please select another upcoming date from the calendar to find open consultation slots."
                        : selectedDate === nextDates[0]?.iso
                        ? "Today's consultation hours have concluded or the doctor is fully booked. Please select tomorrow or an upcoming date above."
                        : "The doctor has no available consultation hours on this date. Please select another date above."}
                    </p>
                  </div>
                  {selectedDate === nextDates[0]?.iso && nextDates.length > 1 && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const tomorrow = nextDates.find((d) => !d.isToday) || nextDates[1];
                          if (tomorrow) setSelectedDate(tomorrow.iso);
                        }}
                        className="text-xs mx-auto"
                        rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                      >
                        View Slots for Tomorrow ({nextDates[1]?.label})
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* 4. ERROR STATE (WITH RETRY BUTTON) */
                <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  <div>
                    <p className="text-xs font-semibold text-rose-900">
                      We couldn&apos;t retrieve appointment availability. Please try again.
                    </p>
                    <p className="text-[11px] text-rose-700 max-w-sm mx-auto mt-1">
                      {availabilityErrorMessage || "A network or server delay occurred while querying the doctor schedule."}
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs mx-auto"
                      onClick={retryFetchSlots}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Retry Availability Check
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="md" onClick={() => setStep("mode")}>
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!selectedSlot || availabilityState !== "AVAILABLE"}
                onClick={() => setStep("details")}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                {selectedSlot ? `Continue with ${selectedSlot.start_time_12h}` : "Select a Time Slot to Continue"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PATIENT CLINICAL DETAILS */}
        {step === "details" && (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-[#163B63]">3. Patient Information & Medical Concern</h4>
              <p className="text-xs text-[#526A82]">Provide your consultation reason so {doctor.name} can review prior to joining.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#163B63]">Patient Full Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E4EF] bg-white focus:outline-none focus:border-[#258FE5]"
                  />
                  <User className="w-4 h-4 text-[#526A82] absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#163B63]">Mobile Number *</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E4EF] bg-white focus:outline-none focus:border-[#258FE5]"
                  />
                  <Phone className="w-4 h-4 text-[#526A82] absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-[#163B63]">Email Address *</label>
                <div className="relative">
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E4EF] bg-white focus:outline-none focus:border-[#258FE5]"
                  />
                  <Mail className="w-4 h-4 text-[#526A82] absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-[#163B63]">Primary Symptoms or Health Concern *</label>
                <textarea
                  rows={2}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Experiencing mild chest tightness, routine blood pressure check, reviewing recent lab report..."
                  className="w-full p-3 rounded-xl border border-[#D5E4EF] bg-white focus:outline-none focus:border-[#258FE5]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="md" onClick={() => setStep("slot")}>
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setStep("payment")}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Proceed to Payment Summary
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: SUMMARY & PAYMENT */}
        {step === "payment" && (
          <div className="space-y-5 text-xs">
            {/* Breakdown card */}
            <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#526A82]">Physician:</span>
                <span className="font-semibold text-[#163B63]">{doctor.name} ({doctor.specialty})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526A82]">Consultation Mode:</span>
                <span className="font-semibold text-[#258FE5]">
                  {consultType === "online" ? "Ultra-HD Video Telehealth" : "Clinic In-Person Visit"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526A82]">Date & Slot:</span>
                <span className="font-semibold text-[#163B63]">{selectedDate} • {selectedSlot?.display_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526A82]">Patient:</span>
                <span className="text-[#163B63]">{patientName} ({patientPhone})</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#D5E4EF] text-sm">
                <span className="font-semibold text-[#163B63]">Total Consultation Fee:</span>
                <span className="font-serif font-bold text-base text-[#163B63]">{formatINR(doctor.consultationFee)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="font-semibold text-[#163B63] block">Select Payment Method (Verified Gateway)</label>
              {[
                { id: "upi", label: "UPI Instant (Google Pay / PhonePe / Paytm / BHIM)", desc: "Zero convenience charge" },
                { id: "card", label: "Credit / Debit Card (Visa, Mastercard, RuPay)", desc: "256-bit TLS bank authorization" },
                { id: "netbanking", label: "Net Banking (SBI, HDFC, ICICI, Axis)", desc: "Direct bank transfer" }
              ].map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.id as any)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-start justify-between transition-all ${
                    paymentMethod === pm.id
                      ? "border-[#258FE5] bg-[#EAF5FC] ring-1 ring-[#258FE5]"
                      : "border-[#D5E4EF] bg-white hover:border-[#D5E4EF]"
                  }`}
                >
                  <div>
                    <div className="font-bold text-[#163B63]">{pm.label}</div>
                    <div className="text-[11px] text-[#526A82]">{pm.desc}</div>
                  </div>
                  <span className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${
                    paymentMethod === pm.id ? "border-[#258FE5] bg-[#258FE5]" : "border-[#D5E4EF]"
                  }`}>
                    {paymentMethod === pm.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              ))}
            </div>

            {paymentMode === "mock" ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Test Mode Active</div>
                  <div className="text-[11px] text-amber-800">
                    Test Mode – No real payment will be processed.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#EAF5FC] border border-[#D5E4EF] text-[#163B63] text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#163B63] shrink-0" />
                <span>Razorpay Telemedicine Payment Gateway Active • 100% Encrypted & Authenticated</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="md" onClick={() => setStep("details")}>
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSubmitting}
                onClick={handleConfirmAndPay}
                rightIcon={paymentMode === "mock" ? <Check className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                className={paymentMode === "mock" ? "bg-[#20B8AD] hover:bg-[#1A9E94] text-white" : ""}
              >
                {isSubmitting ? "Securing Slot..." : paymentMode === "mock" ? "Complete Dummy Payment" : `Pay ${formatINR(doctor.consultationFee)} & Confirm`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: BOOKING CONFIRMATION & VIDEO ROOM ACCESS */}
        {step === "confirmed" && confirmedApt && (
          <div className="py-6 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/40 flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-[#EAF5FC] text-[#163B63] border border-[#D5E4EF]">
                Confirmed & Reserved
              </span>
              <h3 className="text-2xl font-serif text-[#163B63] mt-2">
                Consultation Successfully Booked
              </h3>
              <p className="text-xs text-[#526A82] max-w-sm mx-auto mt-1 font-light">
                Appointment Reference: <strong className="font-mono text-[#163B63]">{confirmedApt.reference}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] text-xs text-left space-y-1.5 max-w-md mx-auto">
              <div><strong className="text-[#163B63]">Physician:</strong> {confirmedApt.doctor_name} ({confirmedApt.doctor_specialty})</div>
              <div><strong className="text-[#163B63]">Date & Slot:</strong> {confirmedApt.date} at {confirmedApt.time}</div>
              <div><strong className="text-[#163B63]">Consultation Mode:</strong> {confirmedApt.type === "online" ? "Encrypted Video Consultation (WebRTC)" : "In-Person Clinic Visit"}</div>
              <div>
                <strong className="text-[#163B63]">Payment:</strong> {formatINR(confirmedApt.fee)} (Paid - {confirmedApt.payment_reference})
                {confirmedApt.payment_reference?.startsWith("TEST-PAY-") && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    Dummy Payment (Test Mode)
                  </span>
                )}
              </div>
              <div className="pt-2 border-t border-[#D5E4EF] text-[11px] text-[#258FE5] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>Confirmation emails sent via Gmail API to you and Dr. {confirmedApt.doctor_name}</span>
              </div>
            </div>

            {/* Direct Join Action for Online Video Appointments */}
            {confirmedApt.type === "online" && confirmedApt.meeting_room_id && (
              <div className="p-4 rounded-2xl bg-[#EAF5FC] border border-[#D5E4EF] max-w-md mx-auto space-y-2">
                <div className="flex items-center justify-center gap-2 text-[#163B63] font-semibold text-xs">
                  <Video className="w-4 h-4 text-[#258FE5]" />
                  <span>Real-Time Consultation Room Ready</span>
                </div>
                <p className="text-[11px] text-[#163B63] leading-relaxed font-light">
                  Both you and {doctor.name} can enter the consultation using your authenticated dashboards.
                </p>
                <Link href={`/consultation/${confirmedApt.meeting_room_id}?role=patient`}>
                  <Button variant="primary" size="md" className="w-full mt-2" leftIcon={<Video className="w-4 h-4" />}>
                    Enter Video Consultation Room
                  </Button>
                </Link>
              </div>
            )}

            <div className="pt-2 flex justify-center gap-3">
              <Link href="/patient/dashboard">
                <Button variant="outline" size="md">
                  View in My Appointments
                </Button>
              </Link>
              <Button variant="ghost" size="md" onClick={resetAndClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
