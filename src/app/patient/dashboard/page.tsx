"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { DOCTORS } from "@/data/doctors";
import { formatINR, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  Calendar,
  Clock,
  Video,
  FileText,
  Activity,
  AlertCircle,
  Bell,
  Sparkles,
  User,
  Plus,
  ExternalLink,
  Download,
  Building2,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Heart,
  RefreshCw,
  MapPin,
  Edit3
} from "lucide-react";

export default function PatientDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [liveAppointments, setLiveAppointments] = useState<any[]>([]);
  const [liveDocuments, setLiveDocuments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchAppointments();
    fetchPatientProfile();
    fetchDocuments();
    fetchNotifications();
  }, []);

  const fetchPatientProfile = async () => {
    try {
      const res = await fetch("/api/patient/profile");
      if (res.ok) {
        const data = await res.json();
        setPatientProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch live patient profile:", err);
    }
  };

  const fetchAppointments = async () => {
    setIsLoadingAppointments(true);
    try {
      const res = await fetch("/api/appointments");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((item: any) => {
            const matchedDoc = DOCTORS.find((d) => d.id === item.doctor_id);
            return {
              id: item.id,
              appointment_reference: item.appointment_reference,
              doctorId: item.doctor_id,
              doctorName: item.doctor_name || matchedDoc?.name || "Consulting Physician",
              doctorSpecialty: item.doctor_specialty || matchedDoc?.specialty || "General Medicine",
              doctorAvatar: matchedDoc?.avatar || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80",
              date: item.date,
              time: item.time,
              type: item.type || "online",
              status: item.status === "confirmed" ? "upcoming" : item.status,
              fee: item.fee || matchedDoc?.consultationFee || 1500,
              meeting_room_id: item.meeting_room_id || `ROOM-${item.id}`,
              symptoms: item.symptoms,
              notes: item.notes
            };
          });

          setLiveAppointments(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to fetch live patient appointments:", err);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/medical-documents");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLiveDocuments(data);
        }
      }
    } catch (err) {
      console.error("Failed to load patient documents:", err);
    }
  };

  const upcomingApts = liveAppointments.filter((a) => a.status === "upcoming" || a.status === "confirmed");
  const pastApts = liveAppointments.filter((a) => a.status === "completed");

  const displayName = patientProfile?.full_name || user?.full_name || "Valued Patient";
  const displayEmail = patientProfile?.email || user?.email || "";
  const displayPhone = patientProfile?.phone || user?.phone || "";
  const displayBloodGroup = patientProfile?.blood_group || "Not Recorded";
  const displayAge = patientProfile?.age ? `${patientProfile.age}y` : (patientProfile?.age_formatted || "Not Recorded");
  const displayCity = patientProfile?.city || patientProfile?.registered_city || "Not Recorded";

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-[#D5E4EF] shadow-subtle">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
                Patient Sanctuary
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#DCECF8] text-[#258FE5] font-semibold border border-[#20B8AD]/30">
                Active Member
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#163B63]">
              Welcome back, {displayName}
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-light">
              Email: <strong className="text-[#163B63] font-medium">{displayEmail}</strong> • Blood Group: <strong className="text-[#163B63] font-medium">{displayBloodGroup}</strong> • Age: {displayAge} • City: <strong className="text-[#163B63] font-medium">{displayCity}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Center */}
            <div className="relative">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative border-[#CBD5E1] text-[#163B63] hover:bg-[#F5F9FC] font-medium"
              >
                <Bell className="w-4 h-4 text-[#258FE5]" />
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#258FE5] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#D5E4EF] shadow-xl p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D5E4EF]">
                    <span className="font-semibold text-xs text-[#163B63]">Patient Notifications</span>
                    <span className="text-[10px] text-[#526A82]">{notifications.length} updates</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
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

            <Link href="/patient/profile">
              <Button
                variant="outline"
                size="md"
                leftIcon={<Edit3 className="w-4 h-4 text-[#258FE5]" />}
                className="border-[#CBD5E1] text-[#163B63] hover:bg-[#F5F9FC] font-medium"
              >
                Edit Health Profile
              </Button>
            </Link>
            <Link href="/ai-assistant">
              <Button
                variant="sage"
                size="md"
                leftIcon={<Activity className="w-4 h-4 text-[#258FE5]" />}
                className="bg-[#F5F9FC] text-[#258FE5] hover:bg-[#20B8AD]/20 border border-[#20B8AD]/40 font-semibold"
              >
                Check Your Symptoms
              </Button>
            </Link>
            <Link href="/patient/payments">
              <Button
                variant="outline"
                size="md"
                leftIcon={<CreditCard className="w-4 h-4 text-[#258FE5]" />}
                className="border-[#CBD5E1] text-[#163B63] hover:bg-[#F5F9FC] font-medium"
              >
                Payment History
              </Button>
            </Link>
            <Link href="/doctors">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Find a Doctor
              </Button>
            </Link>
          </div>
        </div>

        {/* Dynamic Patient Health Profile Card */}
        {patientProfile && (
          <div className="bg-white rounded-[32px] border border-[#D5E4EF] p-7 sm:p-8 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D5E4EF]">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#F5F9FC] flex items-center justify-center text-[#258FE5] border border-[#20B8AD]/40">
                  <User className="w-6 h-6 text-[#258FE5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-serif font-normal text-[#163B63]">
                      {patientProfile.full_name || "Patient Profile"}
                    </h2>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EAF5FC] text-[#163B63] font-semibold border border-[#D5E4EF]">
                      {patientProfile.profile_completed ? "Profile Completed" : "Needs Completion"}
                    </span>
                  </div>
                  <p className="text-xs text-[#526A82]">
                    Age: <strong className="text-[#163B63]">{patientProfile.age_formatted || "Age calculated from DOB"}</strong> • Gender: {patientProfile.gender} • Blood Group: <strong className="text-[#163B63]">{patientProfile.blood_group}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-[#163B63]">{patientProfile.completion_percentage || 90}% Profile Strength</div>
                  <div className="w-28 h-2 bg-[#DCE6EF] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-[#258FE5] rounded-full transition-all duration-500"
                      style={{ width: `${patientProfile.completion_percentage || 90}%` }}
                    />
                  </div>
                </div>

                <Link href="/patient/profile">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    className="bg-[#258FE5] hover:bg-[#163B63] text-xs"
                  >
                    Manage Profile
                  </Button>
                </Link>
              </div>
            </div>

            {/* Profile Grid Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
              {/* Location & Geospatial Center */}
              <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[#258FE5]">
                  <MapPin className="w-4 h-4" />
                  <span>Geocoded Home Area</span>
                </div>
                <div className="font-medium text-[#163B63] text-sm">
                  {patientProfile.locality || patientProfile.city || "Chennai"}, {patientProfile.state || "Tamil Nadu"}
                </div>
                <div className="text-[11px] text-[#526A82]">
                  {patientProfile.address || `${patientProfile.locality || 'Central'}, ${patientProfile.city || 'Chennai'}`}
                </div>
                <div className="font-mono text-[10px] text-[#258FE5] bg-white p-1 rounded border border-[#D5E4EF] inline-block">
                  Lat: {patientProfile.home_latitude?.toFixed(4) || "12.9815"} • Lng: {patientProfile.home_longitude?.toFixed(4) || "80.2180"}
                </div>
              </div>

              {/* Documented Allergies */}
              <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                <div className="flex items-center gap-2 font-semibold text-rose-700">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>Documented Allergies</span>
                </div>
                {patientProfile.allergies && patientProfile.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {patientProfile.allergies.map((alg: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[11px] font-medium border border-rose-200">
                        {alg}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#94A3B8]">No known drug or food allergies recorded.</p>
                )}
                <div className="text-[10px] text-[#526A82] pt-1">Flagged automatically in AI triage & doctor bookings.</div>
              </div>

              {/* Pre-Existing Conditions */}
              <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[#258FE5]">
                  <Activity className="w-4 h-4 text-[#258FE5]" />
                  <span>Medical History & Chronic Conditions</span>
                </div>
                {patientProfile.medical_history && patientProfile.medical_history.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {patientProfile.medical_history.map((cond: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full bg-[#F5F9FC] text-[#258FE5] text-[11px] font-medium border border-[#20B8AD]/40">
                        {cond}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#94A3B8]">No chronic conditions documented.</p>
                )}
                {patientProfile.emergency_contact && (
                  <div className="text-[11px] text-[#526A82] pt-1">
                    Emergency: <strong>{patientProfile.emergency_contact}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calm High-Level Health Profile Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Scheduled Consultations</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">{upcomingApts.length} Visits</div>
            <div className="text-[11px] text-[#258FE5] font-medium">
              {upcomingApts.length > 0 ? `Next: ${upcomingApts[0].date}` : "No upcoming visits"}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Uploaded Medical Records</span>
            <div className="text-2xl font-serif font-normal text-[#163B63]">{liveDocuments.length} Documents</div>
            <div className="text-[11px] text-[#163B63] font-medium">Secured in Encrypted Vault</div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Documented Allergies</span>
            <div className="text-xs font-semibold text-rose-700 truncate mt-1">
              {patientProfile?.allergies && patientProfile.allergies.length > 0
                ? patientProfile.allergies.join(", ")
                : "No known allergies recorded"}
            </div>
            <div className="text-[11px] text-[#94A3B8]">Flagged for all physicians</div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-subtle space-y-1">
            <span className="text-xs font-medium text-[#526A82]">Emergency Contact</span>
            <div className="text-xs font-semibold text-[#163B63] truncate mt-1">
              {patientProfile?.emergency_contact || patientProfile?.emergency_contact_phone || "None on file"}
            </div>
            <div className="text-[11px] text-[#94A3B8]">Emergency contact protocol</div>
          </div>
        </div>

        {/* 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column (8 cols): Upcoming Consultations & Prescriptions */}
          <div className="lg:col-span-8 space-y-8">
            {/* Upcoming Consultations */}
            <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-7 sm:p-8 shadow-subtle space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#D5E4EF]">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-[#258FE5]" />
                  <h2 className="text-xl font-serif font-normal text-[#163B63]">
                    Upcoming Consultations
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/patient/appointments" className="text-xs font-semibold text-[#258FE5] hover:underline">
                    View All & Manage &rarr;
                  </Link>
                  <Link href="/doctors" className="text-xs font-semibold text-[#258FE5] hover:underline">
                    + New Booking
                  </Link>
                </div>
              </div>

              {upcomingApts.length > 0 ? (
                <div className="space-y-4">
                  {upcomingApts.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:border-[#D5E4EF] transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[#D5E4EF]">
                          <Image
                            src={apt.doctorAvatar}
                            alt={apt.doctorName}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-normal text-base text-[#163B63]">{apt.doctorName}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5]">
                              {apt.type === "online" ? "Ultra-HD Video" : "Clinic Visit"}
                            </span>
                          </div>
                          <div className="text-xs text-[#526A82]">
                            {apt.doctorSpecialty}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#526A82] pt-0.5">
                            <span className="flex items-center gap-1 font-medium text-[#163B63]">
                              <Calendar className="w-3.5 h-3.5 text-[#258FE5]" />
                              {formatDate(apt.date)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#258FE5]" />
                              {apt.time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                        <span className="text-xs font-bold text-[#163B63] font-serif">{formatINR(apt.fee)} (Paid)</span>
                        {apt.appointment_reference && (
                          <span className="text-[10px] font-mono text-[#526A82]">Ref: {apt.appointment_reference}</span>
                        )}
                        {apt.type === "online" ? (
                          <Link
                            href={`/consultation/${apt.meeting_room_id || "ROOM-" + apt.id}?role=patient&name=${encodeURIComponent(displayName)}&userId=${user?.patient_id || user?.id || "pat"}`}
                          >
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Video className="w-3.5 h-3.5" />}
                            >
                              Join Video Consultation
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="outline" size="sm">
                            Clinic Directions
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#526A82] py-4">No upcoming appointments scheduled.</p>
              )}
            </div>

            {/* Prescriptions */}
            <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-7 sm:p-8 shadow-subtle space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#D5E4EF]">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-[#258FE5]" />
                  <h2 className="text-xl font-serif font-normal text-[#163B63]">
                    Active Digital Prescriptions
                  </h2>
                </div>
                <span className="text-xs text-[#94A3B8]">Authenticated e-Prescriptions</span>
              </div>

              {patientProfile?.prescriptions && patientProfile.prescriptions.length > 0 ? (
                patientProfile.prescriptions.map((rx: any) => (
                  <div
                    key={rx.id}
                    className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-serif font-normal text-[#163B63]">{rx.diagnosis || "Clinical Diagnosis"}</div>
                        <div className="text-xs text-[#526A82]">
                          Prescribed by {rx.doctorName || "Consulting Physician"} on {rx.date || "Recent Consultation"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPrescription(rx)}
                      >
                        View Details
                      </Button>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      {rx.medications?.map((med: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white border border-[#D5E4EF] flex items-center justify-between"
                        >
                          <div>
                            <strong className="text-[#163B63]">{med.name}</strong>
                            <span className="text-[#526A82] ml-2">({med.dosage})</span>
                          </div>
                          <span className="text-[#258FE5] font-semibold text-[11px]">
                            {med.frequency} • {med.duration}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#526A82] py-4">No active digital prescriptions on file.</p>
              )}
            </div>

            {/* Previous Consultations */}
            <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-7 sm:p-8 shadow-subtle space-y-5">
              <h2 className="text-xl font-serif font-normal text-[#163B63] pb-3 border-b border-[#D5E4EF]">
                Consultation Archive
              </h2>
              <div className="space-y-3">
                {pastApts.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#163B63]">{apt.doctorName}</div>
                      <div className="text-xs text-[#526A82]">
                        {apt.doctorSpecialty} • {formatDate(apt.date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#163B63] bg-[#EAF5FC] px-2.5 py-0.5 rounded-full border border-[#20B8AD]/40">
                        Completed
                      </span>
                      <Link href={`/doctor/${apt.doctorId}`}>
                        <Button variant="ghost" size="sm">
                          Re-consult
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Diagnostics & Recommended Specialists */}
          <div className="lg:col-span-4 space-y-6">
            {/* AI Assistant Banner */}
            <div className="rounded-[32px] bg-[#258FE5] text-white p-7 shadow-editorial space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#F5F9FC] border border-white/20">
                <Sparkles className="w-5 h-5 text-[#20B8AD]" />
              </div>
              <h3 className="text-xl font-serif font-normal text-white">
                Check Your Symptoms
              </h3>
              <p className="text-xs text-[#F5F9FC]/80 leading-relaxed font-light">
                Analyze health concerns with AI clinical understanding, dynamic follow-up screening, and verified doctor recommendations.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Link href="/ai-assistant" className="flex-1">
                  <Button variant="champagne" size="sm" className="w-full justify-center text-xs bg-white text-[#123D68] hover:bg-[#EDF5FA] font-semibold border border-white shadow-xs">
                    Check Symptoms
                  </Button>
                </Link>
                <Link href="/ai-assistant?tab=history" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full justify-center text-xs bg-white text-[#123D68] hover:bg-[#EDF5FA] font-semibold border border-white shadow-xs">
                    Past History
                  </Button>
                </Link>
              </div>
            </div>

            {/* Diagnostic Records */}
            <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-7 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5E4EF]">
                <h3 className="text-lg font-serif font-normal text-[#163B63]">Medical Records</h3>
                <Link href="/patient/medical-records" className="text-xs text-[#258FE5] font-semibold hover:underline flex items-center gap-1">
                  View Vault <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-4 rounded-2xl bg-[#EAF5FC] border border-[#20B8AD]/40 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#258FE5]">
                  <Sparkles className="w-4 h-4" />
                  AI Document Intelligence
                </div>
                <p className="text-[11px] text-[#526A82] leading-relaxed">
                  Upload reports for automated parameter extraction, plain-language summaries, and longitudinal comparison.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Link href="/patient/medical-records/upload" className="flex-1">
                    <Button variant="primary" size="sm" className="w-full text-xs h-7 bg-[#258FE5] hover:bg-[#1D78C4]">
                      Upload Report
                    </Button>
                  </Link>
                  <Link href="/patient/medical-records" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs h-7">
                      Browse Vault
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                {liveDocuments.length > 0 ? (
                  liveDocuments.slice(0, 5).map((rec: any) => (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] hover:border-[#258FE5] transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5]">
                          {rec.document_category || "Medical Record"}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">{rec.report_date || rec.created_at?.slice(0, 10)}</span>
                      </div>
                      <div className="text-xs font-semibold text-[#163B63] line-clamp-1">
                        {rec.title || rec.original_filename}
                      </div>
                      <div className="text-[11px] text-[#526A82] flex items-center justify-between pt-1">
                        <span>{rec.issuing_facility || "Clinical Laboratory"}</span>
                        <span className="text-[#258FE5] font-medium flex items-center gap-1">
                          View <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl border border-dashed border-[#D5E4EF] text-center text-xs text-[#526A82] space-y-2">
                    <p>No medical documents uploaded yet.</p>
                    <Link href="/patient/medical-records/upload">
                      <Button variant="outline" size="sm" className="text-xs">
                        Upload Your First Report
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Practitioners */}
            <div className="rounded-[32px] bg-white border border-[#D5E4EF] p-7 shadow-subtle space-y-4">
              <h3 className="text-lg font-serif font-normal text-[#163B63] pb-3 border-b border-[#D5E4EF]">
                Recommended Specialists
              </h3>
              <div className="space-y-3.5">
                {DOCTORS.slice(1, 3).map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3.5">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#D5E4EF]">
                      <Image src={doc.avatar} alt={doc.name} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#163B63] truncate">{doc.name}</div>
                      <div className="text-[11px] text-[#526A82] truncate">{doc.specialty}</div>
                    </div>
                    <Link href={`/doctor/${doc.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-3">
                        Book
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Details Modal */}
      {selectedPrescription && (
        <Modal
          isOpen={!!selectedPrescription}
          onClose={() => setSelectedPrescription(null)}
          title="Digital Prescription Record"
          description={`Issued by ${selectedPrescription.doctorName || "Consulting Physician"} (${selectedPrescription.doctorRegistration || "Verified Practitioner"})`}
          size="lg"
        >
          <div className="space-y-5 text-left text-xs">
            <div className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#D5E4EF] space-y-1">
              <div><strong className="text-[#163B63]">Patient:</strong> {selectedPrescription.patientName || displayName}</div>
              <div><strong className="text-[#163B63]">Date of Issue:</strong> {selectedPrescription.date || "Consultation Date"}</div>
              <div><strong className="text-[#163B63]">Clinical Diagnosis:</strong> {selectedPrescription.diagnosis || "Standard Diagnosis"}</div>
            </div>

            <div>
              <h4 className="font-semibold text-[#163B63] uppercase tracking-wider mb-2 text-[11px]">
                Medication Protocol
              </h4>
              <div className="space-y-2">
                {selectedPrescription.medications?.map((m: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-[#D5E4EF] space-y-1 bg-white">
                    <div className="flex justify-between font-semibold text-[#163B63]">
                      <span>{m.name}</span>
                      <span className="text-[#258FE5]">{m.frequency} ({m.duration})</span>
                    </div>
                    <div className="text-[#526A82]">{m.dosage} — {m.instructions}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-[#163B63] uppercase tracking-wider mb-1 text-[11px]">
                Physician Guidance
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-[#526A82]">
                {selectedPrescription.advice?.map((adv: any, idx: number) => (
                  <li key={idx}>{adv}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-[#D5E4EF]">
              <span className="text-[#258FE5] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Digitally Authenticated
              </span>
              <Button variant="primary" size="sm" onClick={() => setSelectedPrescription(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Summary Modal */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={selectedRecord.title}
          description={`${selectedRecord.type} • ${selectedRecord.doctorOrLab}`}
          size="md"
        >
          <div className="space-y-4 text-left text-xs">
            <div className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#D5E4EF] space-y-2">
              <div className="flex justify-between text-[#526A82]">
                <span>Date of Report:</span>
                <span className="font-semibold text-[#163B63]">{selectedRecord.date}</span>
              </div>
              <div className="flex justify-between text-[#526A82]">
                <span>Status:</span>
                <span className="text-[#258FE5] font-semibold">{selectedRecord.status}</span>
              </div>
              <div className="flex justify-between text-[#526A82]">
                <span>File Format:</span>
                <span className="font-mono text-[#163B63]">{selectedRecord.fileSize}</span>
              </div>
            </div>

            {selectedRecord.summary && (
              <div className="space-y-1.5">
                <h4 className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px]">
                  Clinical Summary
                </h4>
                <p className="p-3.5 rounded-xl bg-white border border-[#D5E4EF] text-[#526A82] leading-relaxed">
                  {selectedRecord.summary}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
