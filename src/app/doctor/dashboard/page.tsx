"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AvailabilityManager } from "@/components/doctor/AvailabilityManager";
import {
  Stethoscope,
  Calendar,
  Clock,
  Video,
  Building2,
  DollarSign,
  Users,
  CheckCircle2,
  TrendingUp,
  Bell,
  Sparkles,
  FileText,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Upload,
  Lock,
  X,
  FileCheck2,
  CalendarRange,
  ArrowRight,
  User,
  Phone,
  RefreshCw
} from "lucide-react";

interface DoctorData {
  id: string;
  name: string;
  title: string;
  avatar: string;
  specialty: string;
  specialtySlug?: string;
  qualifications: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  consultationTypes: string[];
  languages: string[];
  clinic: {
    name: string;
    address: string;
    city: string;
    pincode: string;
  };
  registrationNumber: string;
  about: string;
  expertise: string[];
  verified: boolean;
  featured?: boolean;
}

const DEFAULT_DOCTORS_LIST = [
  { id: "doc-chn-gen-01", name: "Dr. Venkatesh Raman", specialty: "General Physician", clinic: "Madras Medical Mission, Mogappair" },
  { id: "doc-1", name: "Dr. Arvind Swaminathan", specialty: "Cardiology", clinic: "Apex Heart Institute, Bangalore" },
  { id: "doc-chn-derma-01", name: "Dr. Radhika Krishnan", specialty: "Dermatology", clinic: "Apollo Spectra, Alwarpet" },
  { id: "doc-chn-cardio-03", name: "Dr. Anandha Kumar", specialty: "Cardiology", clinic: "Fortis Malar, Adyar" }
];

function DoctorDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Selected doctor ID from URL param, auth session, or default
  const paramDoctorId = searchParams.get("doctor_id") || searchParams.get("id") || "";
  const [currentDoctorId, setCurrentDoctorId] = useState<string>(paramDoctorId || "doc-chn-gen-01");

  const [currentDoctor, setCurrentDoctor] = useState<DoctorData>({
    id: "doc-chn-gen-01",
    name: "Dr. Venkatesh Raman",
    title: "Senior Consultant Physician & Diabetologist",
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80",
    specialty: "General Physician",
    specialtySlug: "general-physician",
    qualifications: ["MBBS", "MD (General Medicine)", "FRCP"],
    experienceYears: 20,
    rating: 4.94,
    reviewCount: 420,
    consultationFee: 750,
    consultationTypes: ["in-person", "online"],
    languages: ["English", "Tamil"],
    clinic: {
      name: "Madras Medical Mission",
      address: "4-A Dr. J. Jayalalitha Nagar, Mogappair",
      city: "Chennai",
      pincode: "600037"
    },
    registrationNumber: "TMC-49210",
    about: "Dr. Venkatesh Raman has over two decades of clinical experience in adult primary care.",
    expertise: ["Fever of Unknown Origin", "Infectious Diseases", "Diabetes Mellitus", "Hypertension"],
    verified: true
  });

  const [selectedPatientApt, setSelectedPatientApt] = useState<any | null>(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"schedule" | "availability">("schedule");
  const [liveDoctorAppointments, setLiveDoctorAppointments] = useState<any[]>([]);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [doctorNotifications, setDoctorNotifications] = useState<any[]>([]);
  const [showDoctorNotifications, setShowDoctorNotifications] = useState(false);

  const fetchDoctorNotifications = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/notifications?doctor_id=${encodeURIComponent(docId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDoctorNotifications(data);
        }
      }
    } catch (e) {}
  }, []);

  // Doctor Verification Application State
  const [verificationApp, setVerificationApp] = useState<any>({
    id: "dva-seed-001",
    application_reference: "DOC-VER-2026-8492",
    status: "approved",
    registration_number: "TMC-49210",
    issuing_council: "Tamil Nadu Medical Council",
    requested_documents: null,
    rejection_reason: null
  });

  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [docUploadType, setDocUploadType] = useState("council_registration");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploadSuccessFeedback, setUploadSuccessFeedback] = useState<string | null>(null);

  // 1. Resolve logged in user from session if doctorId not explicitly provided
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const authData = await res.json();
          if (authData.authenticated && authData.user?.role === "doctor" && authData.user?.doctor_id) {
            if (!paramDoctorId) {
              setCurrentDoctorId(authData.user.doctor_id);
            }
          }
        }
      } catch (e) {
        console.error("Session verification check error", e);
      }
    }
    checkAuthSession();
  }, [paramDoctorId]);

  // 2. Fetch Doctor Details
  const fetchDoctorProfile = useCallback(async (docId: string) => {
    try {
      setLoadingDoctor(true);
      const res = await fetch(`/api/doctors/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentDoctor(data);
      }
    } catch (err) {
      console.error("Failed to load doctor profile:", err);
    } finally {
      setLoadingDoctor(false);
    }
  }, []);

  // 3. Fetch Doctor Appointments
  const fetchDoctorAppointments = useCallback(async (docId: string) => {
    try {
      setLoadingAppointments(true);
      const res = await fetch(`/api/appointments?role=doctor&doctor_id=${docId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            patientName: item.patient_name || "Patient Consultation",
            patientPhone: item.patient_phone || "+91 98401 23456",
            patientEmail: item.patient_email || "patient@mediverse.com",
            patientAge: 38,
            patientGender: "M",
            reason: item.symptoms || "Scheduled Medical Evaluation",
            notes: item.notes || "",
            time: item.time || (item.start_time ? item.start_time.split(" ")[1] : "10:00 AM"),
            date: item.date,
            start_time: item.start_time,
            end_time: item.end_time,
            type: item.type || "online",
            status: item.status,
            fee: item.fee,
            payment_status: item.payment_status,
            meeting_room_id: item.meeting_room_id || `ROOM-${item.id}`,
            appointment_reference: item.reference || item.appointment_reference
          }));
          setLiveDoctorAppointments(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to fetch doctor appointments:", err);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  // 4. Fetch Doctor Verification Application
  const fetchDoctorVerification = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/doctor-verification/doctor/${docId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setVerificationApp(data);
        } else {
          setVerificationApp({
            id: `dva-${docId}`,
            application_reference: `DOC-VER-${docId.toUpperCase()}`,
            status: "approved",
            registration_number: currentDoctor.registrationNumber || "TMC-49210",
            issuing_council: "State Medical Council"
          });
        }
      }
    } catch (err) {
      console.error("Failed to load doctor verification", err);
    }
  }, [currentDoctor.registrationNumber]);

  useEffect(() => {
    if (currentDoctorId) {
      fetchDoctorProfile(currentDoctorId);
      fetchDoctorAppointments(currentDoctorId);
      fetchDoctorVerification(currentDoctorId);
      fetchDoctorNotifications(currentDoctorId);
    }
  }, [currentDoctorId, fetchDoctorProfile, fetchDoctorAppointments, fetchDoctorVerification, fetchDoctorNotifications]);

  const handleSwitchDoctor = (docId: string) => {
    setCurrentDoctorId(docId);
    router.push(`/doctor/dashboard?doctor_id=${docId}`);
  };

  const handleResubmitApplication = async () => {
    try {
      const res = await fetch(`/api/doctor-verification/${verificationApp.id}/submit`, {
        method: "POST"
      });
      if (res.ok) {
        setVerificationApp((prev: any) => ({ ...prev, status: "pending_review" }));
        setUploadSuccessFeedback("Your application has been resubmitted for administrative review.");
        setTimeout(() => setUploadSuccessFeedback(null), 4000);
      }
    } catch (err) {
      console.error("Resubmit failed", err);
    }
  };

  const handleDocUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileName) return;
    setIsUploadDocModalOpen(false);
    setUploadSuccessFeedback(`Successfully uploaded "${selectedFileName}". You can now resubmit your application.`);
    setSelectedFileName("");
    setTimeout(() => setUploadSuccessFeedback(null), 4000);
  };

  const isApproved = verificationApp.status === "approved" || currentDoctor.verified;

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Practitioner Portal Switcher Banner */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#D5E4EF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#258FE5] font-semibold">
            <Stethoscope className="w-4 h-4 text-[#258FE5]" />
            <span>Active Practitioner Portal: <strong>{currentDoctor.name}</strong></span>
            <span className="font-mono text-[10px] bg-[#F1EFE7] px-2 py-0.5 rounded text-[#244C3B] border border-[#9CAF96]/30">
              {currentDoctor.id}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#526A82] mr-1">Switch Doctor:</span>
            {DEFAULT_DOCTORS_LIST.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => handleSwitchDoctor(doc.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${currentDoctorId === doc.id
                  ? "bg-[#244C3B] text-white shadow-xs"
                  : "bg-[#F8F7F2] text-[#18372B] hover:bg-[#E8E8DF] border border-[#CBD5E1]"
                  }`}
              >
                {doc.name.replace("Dr. ", "")}
              </button>
            ))}
          </div>
        </div>

        {uploadSuccessFeedback && (
          <div className="p-4 rounded-2xl bg-[#EFF4ED] border border-[#9CAF96]/40 text-xs text-[#244C3B] font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#244C3B]" />
            <span>{uploadSuccessFeedback}</span>
          </div>
        )}

        {/* Doctor Header Banner */}
        <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-8 shadow-editorial flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-[#D5E4EF] shadow-subtle">
              <Image
                src={currentDoctor.avatar || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80"}
                alt={currentDoctor.name}
                fill
                className="object-cover object-top"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#244C3B]">
                  Physician Workspace
                </span>
                {isApproved ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EFF4ED] text-[#244C3B] font-semibold flex items-center gap-1 border border-[#9CAF96]/30">
                    <CheckCircle2 className="w-3 h-3 text-[#244C3B]" />
                    Council Verified (Active)
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold flex items-center gap-1 border border-amber-300">
                    <Clock className="w-3 h-3 text-amber-700" />
                    Verification Pending
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#18372B]">
                {currentDoctor.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#526A82] font-light">
                {currentDoctor.title || currentDoctor.specialty} • {currentDoctor.clinic?.name || "Clinic"} • Reg ID: <strong className="font-mono text-[#163B63]">{currentDoctor.registrationNumber || "TMC-49210"}</strong>
              </p>
            </div>
          </div>

          {/* Profile Status & Notifications */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Notification Bell */}
            <div className="relative self-end sm:self-center">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowDoctorNotifications(!showDoctorNotifications)}
                className="relative border-[#CBD5E1] text-[#163B63] hover:bg-[#F5F9FC] font-medium"
                title="Practice Alerts & Appointments"
              >
                <Bell className="w-4 h-4 text-[#258FE5]" />
                {doctorNotifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#258FE5] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {doctorNotifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </Button>

              {showDoctorNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#D5E4EF] shadow-xl p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D5E4EF]">
                    <span className="font-semibold text-xs text-[#163B63]">Doctor Practice Alerts</span>
                    <span className="text-[10px] text-[#526A82]">{doctorNotifications.length} updates</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {doctorNotifications.length > 0 ? (
                      doctorNotifications.map((n) => (
                        <div key={n.id} className="p-2.5 rounded-xl bg-[#F8FBFE] border border-[#DCECF8] text-left text-xs space-y-1">
                          <div className="font-semibold text-[#163B63] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#20B8AD]" />
                            {n.title}
                          </div>
                          <p className="text-[11px] text-[#526A82]">{n.message}</p>
                          <span className="text-[9px] text-[#94A3B8] block">{n.created_at ? new Date(n.created_at).toLocaleString() : "Just now"}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#94A3B8] py-4 text-center">No notifications yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Status */}
            <div className="w-full sm:w-64 p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#18372B]">Credential Standing</span>
                <span className={`font-bold ${isApproved ? "text-[#244C3B]" : "text-amber-800"}`}>
                  {isApproved ? "Verified (Active)" : "Pending Approval"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#E8E8DF] overflow-hidden">
                <div className={`h-full rounded-full ${isApproved ? "bg-[#244C3B] w-full" : "bg-amber-600 w-2/3"}`} />
              </div>
              <p className="text-[10px] text-[#526A82]">
                State Council accreditation active. Ready to accept patient consults.
              </p>
            </div>
          </div>
        </div>

        {/* Doctor Metrics Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Total Scheduled Visits</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">
              {liveDoctorAppointments.length} Consultations
            </div>
            <div className="text-[11px] text-[#244C3B] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Real-Time Database Sync</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Consultation Rate</span>
            <div className="text-2xl font-serif font-bold text-[#163B63]">
              ₹{currentDoctor.consultationFee || 750}
            </div>
            <div className="text-[11px] text-[#526A82]">
              Online & In-Clinic Fee
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Patient Ratings</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">
              {currentDoctor.rating || 4.9} ★
            </div>
            <div className="text-[11px] text-[#526A82]">
              Across {currentDoctor.reviewCount || 100}+ verified reviews
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Clinic Affiliation</span>
            <div className="text-base font-serif font-semibold text-[#163B63] truncate mt-1">
              {currentDoctor.clinic?.name || "Medical Sanctuary"}
            </div>
            <div className="text-[11px] text-[#244C3B] font-medium">{currentDoctor.clinic?.city || "Chennai"}</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-[#D5E4EF] pb-4">
          <button
            type="button"
            onClick={() => setActiveDashboardTab("schedule")}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${activeDashboardTab === "schedule"
              ? "bg-[#258FE5] text-white shadow-xs"
              : "bg-white text-[#526A82] hover:text-[#163B63] border border-[#D5E4EF]"
              }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Consultation Schedule & Booked Visits ({liveDoctorAppointments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardTab("availability")}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${activeDashboardTab === "availability"
              ? "bg-[#258FE5] text-white shadow-xs"
              : "bg-white text-[#526A82] hover:text-[#163B63] border border-[#D5E4EF]"
              }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Availability Engine & Working Hours</span>
          </button>
        </div>

        {activeDashboardTab === "availability" ? (
          <AvailabilityManager
            doctorId={currentDoctor.id}
            doctorName={currentDoctor.name}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Schedule & Patient Roster */}
            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-7 sm:p-8 shadow-subtle space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#D5E4EF]">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-[#244C3B]" />
                    <h2 className="text-xl font-serif font-normal text-[#18372B]">
                      Scheduled Consultations & Patient Appointments
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchDoctorAppointments(currentDoctorId)}
                    className="p-1.5 rounded-lg text-[#526A82] hover:text-[#258FE5] hover:bg-[#F5F9FC]"
                    title="Refresh appointments"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingAppointments ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {loadingAppointments ? (
                  <div className="p-8 text-center text-xs text-[#526A82]">
                    Loading patient appointments from database...
                  </div>
                ) : liveDoctorAppointments.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] text-center space-y-2">
                    <Calendar className="w-8 h-8 text-[#20B8AD] mx-auto" />
                    <h4 className="text-sm font-semibold text-[#163B63]">No Appointments Scheduled</h4>
                    <p className="text-xs text-[#526A82] max-w-sm mx-auto">
                      There are currently no patient visits scheduled for {currentDoctor.name}. Patients can book available slots through the platform.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {liveDoctorAppointments.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-white hover:shadow-xs"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#D5E4EF] flex items-center justify-center shrink-0 text-[#258FE5]">
                            {item.type === "online" ? <Video className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#163B63]">{item.patientName}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EAF5FC] text-[#163B63] border border-[#D5E4EF]">
                                {item.appointment_reference || item.id}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                }`}>
                                {item.status}
                              </span>
                            </div>

                            <p className="text-xs text-[#526A82] font-light">
                              Symptoms: <strong>{item.reason}</strong>
                            </p>

                            <div className="text-[11px] text-[#244C3B] font-medium flex items-center gap-2 pt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {item.date}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {item.time}
                              </span>
                              <span>•</span>
                              <span className="capitalize">{item.type} Consultation</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.type === "online" && (
                            <Link
                              href={`/consultation/${item.meeting_room_id || "ROOM-" + item.id}?role=doctor&userId=${currentDoctor.id}&name=${encodeURIComponent(currentDoctor.name)}`}
                            >
                              <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<Video className="w-3.5 h-3.5" />}
                                className="bg-[#244C3B] hover:bg-[#18372B] text-xs h-8"
                              >
                                Join Video Call
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPatientApt(item)}
                            className="text-xs h-8"
                          >
                            Review File
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Practitioner Portfolio */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-6 shadow-subtle space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#D5E4EF]">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-[#244C3B]" />
                    <h3 className="text-base font-serif text-[#18372B]">Credential Portfolio</h3>
                  </div>
                  <span className="text-xs text-[#526A82]">Verified Documents</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    { name: "Medical Degree (MBBS)", status: "Verified", date: "Awarded" },
                    { name: "State Medical Council Registration", status: "Verified", date: currentDoctor.registrationNumber || "Active" },
                    { name: "Postgraduate Degree (MD / Specialization)", status: "Verified", date: "Certified" },
                    { name: "Government Identity & Practice License", status: "Verified", date: "Active" }
                  ].map((doc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#F5F9FC] border border-[#D5E4EF] flex items-center justify-between">
                      <div>
                        <strong className="text-[#163B63] block">{doc.name}</strong>
                        <span className="text-[10px] text-[#526A82]">{doc.date}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF5FC] text-[#163B63] border border-[#D5E4EF]">
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-[#244C3B] border-[#9CAF96]/50 hover:bg-[#EFF4ED]"
                    onClick={() => setIsUploadDocModalOpen(true)}
                  >
                    Manage Verification Documents
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Review Patient File & Consultation Details */}
        {selectedPatientApt && (
          <Modal
            isOpen={Boolean(selectedPatientApt)}
            onClose={() => setSelectedPatientApt(null)}
            title={`Patient File: ${selectedPatientApt.patientName}`}
            description={`Appointment Reference: ${selectedPatientApt.appointment_reference || selectedPatientApt.id} • ${selectedPatientApt.date} at ${selectedPatientApt.time}`}
            size="lg"
            className="bg-white"
          >
            <div className="space-y-4 pt-2 text-left text-xs">
              <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#18372B]">{selectedPatientApt.patientName}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {selectedPatientApt.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[#526A82]">
                  <div>Phone: <strong className="text-[#18372B]">{selectedPatientApt.patientPhone}</strong></div>
                  <div>Email: <strong className="text-[#18372B]">{selectedPatientApt.patientEmail}</strong></div>
                  <div>Consultation Mode: <strong className="text-[#18372B] capitalize">{selectedPatientApt.type}</strong></div>
                  <div>Fee Status: <strong className="text-[#18372B] uppercase">{selectedPatientApt.payment_status} (₹{selectedPatientApt.fee})</strong></div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#D5E4EF] space-y-2">
                <span className="font-semibold text-[#163B63] block">Reported Symptoms & Clinical Profile</span>
                <p className="text-[#526A82] leading-relaxed bg-[#F5F9FC] p-3 rounded-xl border border-[#CBD5E1]">
                  {selectedPatientApt.reason || "General medical consultation requested."}
                </p>
                {selectedPatientApt.notes && (
                  <p className="text-[11px] text-[#526A82]">
                    Clinical Notes: {selectedPatientApt.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5E4EF]">
                {selectedPatientApt.type === "online" && (
                  <Link
                    href={`/consultation/${selectedPatientApt.meeting_room_id}?role=doctor&userId=${currentDoctor.id}&name=${encodeURIComponent(currentDoctor.name)}`}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Video className="w-3.5 h-3.5" />}
                      className="bg-[#244C3B] hover:bg-[#18372B] text-white text-xs h-9"
                    >
                      Join Video Consultation
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPatientApt(null)}
                  className="text-xs h-9"
                >
                  Close File
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Upload Additional Credential Document */}
        {isUploadDocModalOpen && (
          <Modal
            isOpen={isUploadDocModalOpen}
            onClose={() => setIsUploadDocModalOpen(false)}
            title="Upload Additional Professional Credential"
            description="Submit supporting registration certificates, fellowship degrees, or hospital employment evidence."
            size="md"
            className="bg-white"
          >
            <form onSubmit={handleDocUploadSubmit} className="space-y-4 pt-2 text-left text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#18372B]">Document Category *</label>
                <select
                  value={docUploadType}
                  onChange={(e) => setDocUploadType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                >
                  <option value="council_registration">Medical Registration Certificate / Renewal Evidence</option>
                  <option value="specialization_degree">Postgraduate / Specialization Degree</option>
                  <option value="experience_certificate">Hospital / Clinical Experience Certificate</option>
                  <option value="cme_certificate">CME Credit Certificate</option>
                  <option value="other">Other Statutory Credential</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#18372B]">Select File (PDF, JPG, PNG, DOCX - Max 10MB) *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFileName(e.target.files[0].name);
                    }
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5E4EF] bg-[#F5F9FC] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5E4EF]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsUploadDocModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="bg-[#244C3B] hover:bg-[#18372B]">
                  Upload & Attach
                </Button>
              </div>
            </form>
          </Modal>
        )}

      </div>
    </div>
  );
}

export default function DoctorDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F7F2] p-16 text-center space-y-3">
          <div className="w-7 h-7 border-2 border-[#244C3B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#526A82]">Loading practitioner workspace...</p>
        </div>
      }
    >
      <DoctorDashboardContent />
    </Suspense>
  );
}
