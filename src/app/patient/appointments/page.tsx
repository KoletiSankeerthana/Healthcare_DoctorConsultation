"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  Video,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Search,
  ExternalLink,
  Phone,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatINR, formatDate } from "@/lib/utils";

interface AppointmentItem {
  id: string;
  appointment_reference?: string;
  doctorId?: string;
  doctor_id?: string;
  doctorName?: string;
  doctor_name?: string;
  doctorSpecialty?: string;
  doctor_specialty?: string;
  doctorAvatar?: string;
  date: string;
  time: string;
  type: "online" | "in-person";
  status: "upcoming" | "confirmed" | "completed" | "cancelled";
  fee: number;
  meeting_room_id?: string;
  symptoms?: string;
  notes?: string;
  cancellation_reason?: string;
}

interface PolicyState {
  eligible: boolean;
  hours_remaining: number;
  deadline_hours: number;
  cancellation_policy: string;
  reason?: string;
}

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed" | "cancelled" | "all">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");

  // Cancellation Modal State
  const [cancellingApt, setCancellingApt] = useState<AppointmentItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyData, setPolicyData] = useState<PolicyState | null>(null);
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/appointments?role=patient&patient_id=pt-101");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAppointments(data);
        }
      }
    } catch (err) {
      console.error("Failed to load patient appointments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const openCancelModal = async (apt: AppointmentItem) => {
    setCancellingApt(apt);
    setCancelReason("");
    setPolicyAccepted(false);
    setCancelError(null);
    setIsCheckingPolicy(true);

    try {
      const res = await fetch(`/api/appointments/${apt.id}`);
      if (res.ok) {
        const data = await res.json();
        setPolicyData(data);
      } else {
        setPolicyData({
          eligible: true,
          hours_remaining: 48,
          deadline_hours: 24,
          cancellation_policy: "Free cancellation permitted up to 24 hours before consultation. Non-refundable policy applies."
        });
      }
    } catch (err) {
      setPolicyData({
        eligible: true,
        hours_remaining: 48,
        deadline_hours: 24,
        cancellation_policy: "Free cancellation permitted up to 24 hours before consultation. Non-refundable policy applies."
      });
    } finally {
      setIsCheckingPolicy(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingApt) return;
    if (!cancelReason.trim()) {
      setCancelError("Please provide a reason for cancellation.");
      return;
    }
    if (policyData?.eligible && !policyAccepted) {
      setCancelError("Please acknowledge and accept the 24-hour non-refundable policy.");
      return;
    }

    setIsSubmittingCancel(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/appointments/${cancellingApt.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason.trim(),
          cancelled_by: "patient"
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCancellingApt(null);
        fetchAppointments();
      } else {
        setCancelError(data.error || "Unable to cancel appointment.");
      }
    } catch (err: any) {
      setCancelError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Filtered lists
  const filteredAppointments = appointments.filter((apt) => {
    const status = apt.status?.toLowerCase();
    const docName = (apt.doctorName || apt.doctor_name || "").toLowerCase();
    const spec = (apt.doctorSpecialty || apt.doctor_specialty || "").toLowerCase();
    const matchesSearch = docName.includes(searchQuery.toLowerCase()) || spec.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "upcoming") {
      return status === "upcoming" || status === "confirmed";
    }
    if (activeTab === "completed") {
      return status === "completed";
    }
    if (activeTab === "cancelled") {
      return status === "cancelled";
    }
    return true;
  });

  const upcomingCount = appointments.filter((a) => a.status === "upcoming" || a.status === "confirmed").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-8 rounded-[32px] border border-[#D5E4EF] shadow-subtle">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Link href="/patient/dashboard" className="text-xs font-semibold text-[#258FE5] hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sanctuary Dashboard
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#163B63]">
              My Clinical Consultations
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82]">
              Review upcoming visits, enter encrypted video rooms, check appointment policies, or request cancellations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={fetchAppointments} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Link href="/doctors">
              <Button variant="primary" size="md">
                Book New Consultation
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: "upcoming", label: `Upcoming (${upcomingCount})` },
              { id: "completed", label: `Completed (${completedCount})` },
              { id: "cancelled", label: `Cancelled (${cancelledCount})` },
              { id: "all", label: `All Consultations (${appointments.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold shrink-0 transition-all ${
                  activeTab === tab.id
                    ? "bg-[#258FE5] text-white shadow-xs"
                    : "bg-white text-[#526A82] border border-[#D5E4EF] hover:border-[#D5E4EF] hover:text-[#163B63]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by doctor or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-[#D5E4EF] bg-white text-xs focus:outline-none focus:border-[#258FE5]"
            />
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
          </div>
        </div>

        {/* Appointments List */}
        {isLoading ? (
          <div className="bg-white p-16 rounded-[32px] border border-[#D5E4EF] text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#258FE5] animate-spin mx-auto" />
            <p className="text-sm font-semibold text-[#163B63]">Loading appointment schedule...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white p-16 rounded-[32px] border border-[#D5E4EF] text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#163B63]">
                No {activeTab} consultations found
              </h3>
              <p className="text-xs text-[#526A82] max-w-sm mx-auto mt-1">
                {activeTab === "upcoming"
                  ? "You do not have any pending or upcoming doctor appointments."
                  : `No appointments matching '${activeTab}' criteria.`}
              </p>
            </div>
            <Link href="/doctors">
              <Button variant="primary" size="md">
                Find a Verified Doctor
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAppointments.map((apt) => {
              const docName = apt.doctorName || apt.doctor_name || "Consulting Physician";
              const spec = apt.doctorSpecialty || apt.doctor_specialty || "Specialist";
              const isUpcoming = apt.status === "upcoming" || apt.status === "confirmed";
              const isCancelled = apt.status === "cancelled";
              const isCompleted = apt.status === "completed";

              return (
                <div
                  key={apt.id}
                  className="bg-white p-6 rounded-[28px] border border-[#D5E4EF] hover:border-[#D5E4EF] transition-all space-y-4 shadow-subtle flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Top row: Doctor info & Status badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#EAF5FC] text-[#258FE5] font-bold flex items-center justify-center shrink-0 border border-[#20B8AD]/30">
                          {docName.replace("Dr. ", "").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-[#163B63] text-base">{docName}</h3>
                          <p className="text-xs text-[#258FE5] font-semibold">{spec}</p>
                          {apt.appointment_reference && (
                            <span className="text-[10px] text-[#94A3B8] font-mono">
                              Ref: {apt.appointment_reference}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] capitalize px-2.5 py-1 rounded-full font-semibold border ${
                          isCancelled
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : isCompleted
                            ? "bg-[#EAF5FC] text-[#163B63] border-[#D5E4EF]"
                            : "bg-[#EAF5FC] text-[#163B63] border-[#D5E4EF]"
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>

                    {/* Schedule info block */}
                    <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-[#163B63]">
                        <Calendar className="w-4 h-4 text-[#258FE5] shrink-0" />
                        <span className="font-semibold">{formatDate(apt.date)}</span>
                        <span className="text-[#526A82]">•</span>
                        <Clock className="w-4 h-4 text-[#258FE5] shrink-0" />
                        <span className="font-semibold">{apt.time}</span>
                      </div>

                      <div className="flex items-center justify-between text-[#526A82] pt-1 border-t border-[#D5E4EF]">
                        <span className="flex items-center gap-1.5">
                          {apt.type === "online" ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-[#258FE5]" /> Ultra-HD Video Telehealth
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-[#163B63]" /> In-Person Clinic Visit
                            </>
                          )}
                        </span>
                        <span className="font-semibold text-[#163B63]">
                          {formatINR(apt.fee || 1500)}
                        </span>
                      </div>
                    </div>

                    {/* Symptoms preview */}
                    {apt.symptoms && (
                      <div className="text-xs text-[#526A82] bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <strong className="text-[#163B63]">Chief Concern:</strong> {apt.symptoms}
                      </div>
                    )}

                    {/* Cancellation reason if cancelled */}
                    {isCancelled && apt.cancellation_reason && (
                      <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                        <strong>Reason:</strong> {apt.cancellation_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="pt-2 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3">
                    {isUpcoming ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                          onClick={() => openCancelModal(apt)}
                        >
                          Cancel Appointment
                        </Button>

                        {apt.type === "online" && apt.meeting_room_id ? (
                          <Link href={`/consultation/${apt.meeting_room_id}?role=patient`}>
                            <Button variant="primary" size="sm" leftIcon={<Video className="w-3.5 h-3.5" />}>
                              Join Video Call
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-[#526A82]">Confirmed Visit</span>
                        )}
                      </>
                    ) : isCompleted ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-[#163B63] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Consultation Concluded
                        </span>
                        <Link href="/patient/medical-records">
                          <Button variant="outline" size="sm">
                            View Records
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <span className="text-xs text-rose-600 font-medium">Slot Released</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CANCELLATION MODAL */}
        <Modal
          isOpen={!!cancellingApt}
          onClose={() => setCancellingApt(null)}
          title="Cancel Consultation Appointment"
          size="md"
        >
          {cancellingApt && (
            <div className="space-y-5 text-left text-xs">
              {/* Error banner */}
              {cancelError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              {/* Consultation summary card */}
              <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Physician:</span>
                  <span className="font-semibold text-[#163B63]">
                    {cancellingApt.doctorName || cancellingApt.doctor_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Scheduled Date & Time:</span>
                  <span className="font-semibold text-[#163B63]">
                    {formatDate(cancellingApt.date)} at {cancellingApt.time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526A82]">Consultation Fee:</span>
                  <span className="font-semibold text-[#163B63]">
                    {formatINR(cancellingApt.fee || 1500)}
                  </span>
                </div>
              </div>

              {/* Policy verification state */}
              {isCheckingPolicy ? (
                <div className="p-4 text-center text-[#526A82] space-y-1">
                  <RefreshCw className="w-5 h-5 text-[#258FE5] animate-spin mx-auto" />
                  <p>Verifying cancellation deadline with MediVerse clinic policy...</p>
                </div>
              ) : policyData?.eligible ? (
                /* Eligible for cancellation (>= 24 hours prior) */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-[#EAF5FC] border border-[#D5E4EF] text-[#163B63] space-y-1">
                    <div className="flex items-center gap-2 font-bold text-[#163B63]">
                      <CheckCircle2 className="w-4 h-4 text-[#163B63]" />
                      <span>Eligible for Cancellation ({policyData.hours_remaining} hrs until consultation)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#163B63]">
                      Your consultation is more than 24 hours away. You are within the allowable cancellation period.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                      <span>Non-Refundable Policy Notice</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      In accordance with clinic appointment regulations, patient-initiated cancellations do not receive a monetary refund. The physician's reserved clinical slot will be released back to the community.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-[#163B63] block">Reason for Cancellation *</label>
                    <textarea
                      rows={3}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Schedule conflict, symptoms resolved, consulting another specialist..."
                      className="w-full p-3 rounded-xl border border-[#D5E4EF] bg-white text-xs focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#D5E4EF] bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(e) => setPolicyAccepted(e.target.checked)}
                      className="mt-0.5 rounded border-[#CBD5E1] text-[#258FE5] focus:ring-[#258FE5]"
                    />
                    <span className="text-[11px] text-[#475569]">
                      I understand that this cancellation is subject to the <strong>24-hour non-refundable policy</strong> and confirm release of my reserved slot.
                    </span>
                  </label>
                </div>
              ) : (
                /* Locked (< 24 hours prior) */
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Cancellation Deadline Passed ({policyData?.hours_remaining ?? 0} hrs remaining)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-700">
                    Online cancellation is strictly restricted within <strong>24 hours</strong> of the consultation to prevent doctor schedule disruption.
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-700">
                    If you have an urgent medical emergency or need immediate assistance, please contact the MediVerse Patient Concierge team directly:
                  </p>
                  <div className="p-2.5 bg-white rounded-xl border border-rose-200 text-[#163B63] font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#258FE5]" /> +91 800-456-7890
                    </span>
                    <span className="text-[10px] text-[#526A82]">24x7 Emergency Concierge</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D5E4EF]">
                <Button variant="ghost" size="md" onClick={() => setCancellingApt(null)}>
                  Close
                </Button>
                {policyData?.eligible && (
                  <Button
                    variant="primary"
                    size="md"
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    disabled={isSubmittingCancel || !policyAccepted || !cancelReason.trim()}
                    onClick={handleConfirmCancel}
                  >
                    {isSubmittingCancel ? "Cancelling..." : "Confirm Cancellation"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
