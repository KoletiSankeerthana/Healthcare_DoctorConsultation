"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Doctor } from "@/types";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppointmentBookingModal } from "@/components/booking/AppointmentBookingModal";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  Star,
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  Building2,
  MapPin,
  ShieldCheck,
  Languages,
  Award,
  FileText,
  ChevronLeft,
  ArrowRight,
  Check,
  Share2,
  CreditCard,
  Lock,
  Loader2,
  AlertCircle,
  UserX,
} from "lucide-react";

export default function DoctorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const doctorId = params?.id as string;
  const { isAuthenticated, loading: authLoading } = useAuthUser();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Restore booking intent after login
  useEffect(() => {
    if (!authLoading && isAuthenticated && doctor) {
      const autoBook = searchParams?.get("autoBook") === "true";
      if (autoBook) {
        setBookingModalOpen(true);
        return;
      }
      try {
        const pendingStr = sessionStorage.getItem("mediverse_pending_booking");
        if (pendingStr) {
          const pending = JSON.parse(pendingStr);
          if (pending && pending.doctorId === doctor.id) {
            sessionStorage.removeItem("mediverse_pending_booking");
            setBookingModalOpen(true);
          }
        }
      } catch (e) {}
    }
  }, [authLoading, isAuthenticated, doctor, searchParams]);

  useEffect(() => {
    let isMounted = true;
    async function loadDoctor() {
      if (!doctorId) return;
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/doctors/${doctorId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDoctor(data);
          }
        } else {
          if (isMounted) setNotFound(true);
        }
      } catch (err) {
        console.error("Failed to load doctor profile:", err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDoctor();
    return () => { isMounted = false; };
  }, [doctorId]);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openBooking = () => {
    if (authLoading) return;

    // Always open booking modal directly so patient can select slots seamlessly
    setBookingModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-[#258FE5] animate-spin" />
        <p className="text-sm text-[#526A82]">Verifying physician credentials and loading clinical profile...</p>
      </div>
    );
  }

  if (notFound || !doctor) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] py-20 px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center justify-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
          <UserX className="w-10 h-10 stroke-[2]" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
            Physician Profile Unavailable
          </h2>
          <p className="text-xs sm:text-sm text-[#526A82] leading-relaxed">
            This doctor profile is currently undergoing credential verification, is temporarily deactivated, or does not exist. Healvia strictly restricts public consultation access to verified, council-registered medical practitioners.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/doctors">
            <Button variant="primary" size="md" leftIcon={<ChevronLeft className="w-4 h-4" />}>
              Return to Physician Directory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/doctors"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#526A82] hover:text-[#163B63] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to Directory</span>
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#258FE5] hover:text-[#163B63] bg-[#EAF5FC] px-3.5 py-1.5 rounded-full border border-[#20B8AD]/30 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? "Link Copied" : "Share Profile"}</span>
          </button>
        </div>

        {/* Demo Record Notice */}
        <div className="p-4 rounded-2xl bg-[#EAF5FC] border border-[#20B8AD]/30 text-xs text-[#163B63] flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-[#258FE5] shrink-0" />
          <span className="font-light">
            <strong className="font-semibold text-[#163B63]">Verified Demonstration Profile:</strong> This page presents an authentic clinical physician overview with council licensing and scheduling interactions.
          </span>
        </div>

        {/* Large Editorial Profile Header Card */}
        <div className="rounded-[36px] bg-white border border-[#D5E4EF] p-7 sm:p-10 shadow-editorial">
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
            {/* Portrait */}
            <div className="relative w-32 h-32 sm:w-44 sm:h-44 rounded-3xl overflow-hidden shrink-0 border border-[#D5E4EF] shadow-luxury">
              <Image
                src={doctor.avatar}
                alt={doctor.name}
                fill
                className="object-cover object-top"
                priority
              />
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-semibold tracking-wider uppercase px-3 py-1 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                  {doctor.specialty}
                </span>
                <div className="flex items-center gap-1 text-xs font-bold text-[#163B63] bg-[#EAF5FC] px-3 py-1 rounded-full border border-[#D5E4EF]/50">
                  <Star className="w-3.5 h-3.5 fill-[#DCE6EF] text-[#DCE6EF]" />
                  <span>{doctor.rating}</span>
                  <span className="text-[#526A82] font-normal">({doctor.reviewCount} verified consults)</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#163B63]">
                  {doctor.name}
                </h1>
                {doctor.verified && (
                  <CheckCircle2 className="w-6 h-6 text-[#258FE5] shrink-0" />
                )}
              </div>

              <p className="text-sm text-[#526A82] font-light">
                {doctor.title} • {doctor.qualifications.join(", ")}
              </p>

              <div className="flex flex-wrap gap-5 pt-1 text-xs text-[#526A82]">
                <div className="flex items-center gap-1.5 font-medium text-[#163B63]">
                  <Award className="w-4 h-4 text-[#258FE5]" />
                  <span>{doctor.experienceYears} Years Clinical Practice</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#258FE5]" />
                  <span>{doctor.clinic.city}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-[#258FE5]" />
                  <span>{doctor.languages.join(", ")}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs text-[#526A82]">
                <FileText className="w-4 h-4 text-[#258FE5]" />
                <span>
                  Medical Council Registration: <strong className="text-[#163B63] font-mono">{doctor.registrationNumber}</strong> (Verified)
                </span>
              </div>
            </div>

            {/* Quick Consultation Fee & Booking Panel */}
            <div className="w-full sm:w-72 p-5 rounded-3xl bg-[#FFFFFF] border border-[#D5E4EF] space-y-4 shrink-0 text-left">
              <div>
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider block">
                  Consultation Fee
                </span>
                <div className="text-3xl font-serif font-bold text-[#163B63]">
                  {formatINR(doctor.consultationFee)}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-[#526A82]">
                <div className="flex items-center gap-2 text-[#258FE5] font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Next Slot: {doctor.availability.nextAvailable}</span>
                </div>
                <div className="text-[11px] text-[#526A82]">
                  Modes: {doctor.consultationTypes.map((t) => (t === "online" ? "Ultra-HD Video" : "In-Person Clinic")).join(" / ")}
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full justify-center h-11"
                onClick={openBooking}
                rightIcon={<Calendar className="w-4 h-4" />}
              >
                Book Appointment
              </Button>
            </div>
          </div>
        </div>

        {/* Detailed Sections Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column (8 cols): Clinical Biography, Expertise, Facility & Reviews */}
          <div className="lg:col-span-8 space-y-6">
            {/* Biography */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-8 shadow-subtle space-y-3">
              <h2 className="text-xl font-serif font-normal text-[#163B63]">
                About Dr. {doctor.name.split(" ").slice(-1)}
              </h2>
              <p className="text-sm text-[#526A82] leading-relaxed font-light">
                {doctor.about}
              </p>
            </div>

            {/* Clinical Expertise */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-8 shadow-subtle space-y-4">
              <h2 className="text-xl font-serif font-normal text-[#163B63]">
                Areas of Clinical Expertise
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {doctor.expertise.map((exp) => (
                  <span
                    key={exp}
                    className="px-3.5 py-1.5 rounded-full bg-[#FFFFFF] text-[#163B63] font-medium text-xs border border-[#D5E4EF] flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#258FE5]" />
                    <span>{exp}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Facility Details */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-8 shadow-subtle space-y-4">
              <h2 className="text-xl font-serif font-normal text-[#163B63]">
                Clinic & Tertiary Appointment
              </h2>
              <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] flex items-start gap-4">
                <Building2 className="w-6 h-6 text-[#258FE5] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-base font-serif font-semibold text-[#163B63]">{doctor.clinic.name}</div>
                  <div className="text-xs text-[#526A82]">{doctor.clinic.address}</div>
                  <div className="text-xs text-[#258FE5] font-medium">
                    {doctor.clinic.city} - {doctor.clinic.pincode}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Feedback */}
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-8 shadow-subtle space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5E4EF]">
                <h2 className="text-xl font-serif font-normal text-[#163B63]">Verified Patient Reviews</h2>
                <span className="text-xs text-[#526A82]">Based on {doctor.reviewCount} consultations</span>
              </div>

              <div className="space-y-3.5">
                <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#163B63]">S. Vardhan • Bangalore</div>
                    <div className="flex text-[#DCE6EF]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#DCE6EF]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#526A82] leading-relaxed font-serif italic">
                    &ldquo;Remarkably attentive and empathetic. Explained my diagnosis with total clarity without rushing through medications. The digital prescription and follow-up regimen were delivered seamlessly.&rdquo;
                  </p>
                  <div className="text-[10px] text-[#258FE5] font-medium">Consulted via Ultra-HD Telehealth</div>
                </div>

                <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D5E4EF] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#163B63]">Meera N. • Hyderabad</div>
                    <div className="flex text-[#DCE6EF]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#DCE6EF]" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#526A82] leading-relaxed font-serif italic">
                    &ldquo;Outstanding diagnostic acumen. Addressed all my questions regarding medication side effects with warm professionalism.&rdquo;
                  </p>
                  <div className="text-[10px] text-[#258FE5] font-medium">In-Clinic Consultation</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Schedule & Immediate Booking */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl bg-white border border-[#D5E4EF] p-7 shadow-subtle space-y-5">
              <h3 className="text-lg font-serif font-normal text-[#163B63]">Practice Schedule</h3>
              <div className="space-y-2.5 text-xs">
                {doctor.availability.days.map((day) => (
                  <div key={day} className="flex justify-between py-2 border-b border-[#D5E4EF]">
                    <span className="font-semibold text-[#163B63]">{day}</span>
                    <span className="text-[#526A82]">09:30 AM - 07:30 PM</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-center h-11"
                  onClick={openBooking}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Schedule for {doctor.availability.nextAvailable}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Gate Modal for Unauthenticated Visitors */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        featureName="Doctor Consultation Booking"
        title="Your Health Information Deserves a Secure Space"
        description={`Sign in or create an account to book your consultation with ${doctor?.name || "your physician"}, select real-time appointment slots, and access encrypted clinical records.`}
        redirectPath={`/doctor/${doctorId}?autoBook=true`}
        onAuthenticated={() => setBookingModalOpen(true)}
      />

      {/* Real-time Dynamic Appointment Booking Modal */}
      {bookingModalOpen && doctor && (
        <AppointmentBookingModal
          doctor={doctor}
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
        />
      )}
    </div>
  );
}
