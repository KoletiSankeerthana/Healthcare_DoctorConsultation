"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Doctor } from "@/types";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AppointmentBookingModal } from "@/components/booking/AppointmentBookingModal";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useSearchParams } from "next/navigation";
import {
  Star,
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  Building2,
  MapPin,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface DoctorCardProps {
  doctor: Doctor;
  featured?: boolean;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor }) => {
  const { isAuthenticated, loading } = useAuthUser();
  const searchParams = useSearchParams();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Restore booking intent after login
  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      const autoBookId = searchParams.get("autoBookDoctor") || searchParams.get("bookDoctor");
      if (autoBookId === doctor.id) {
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
      } catch (e) { }
    }
  }, [loading, isAuthenticated, doctor.id, searchParams]);

  const handleBookClick = () => {
    if (loading) {
      return;
    }
    if (!isAuthenticated) {
      setAuthGateOpen(true);
      return;
    }
    setBookingModalOpen(true);
  };

  return (
    <>
      <div className="rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-subtle hover:shadow-editorial hover:border-[#258FE5] transition-all duration-300 flex flex-col justify-between text-left relative group">
        <div>
          {/* Top Specialty Badge & Rating */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[11px] font-serif font-semibold tracking-wider uppercase px-3 py-1 rounded-full bg-[#DCECF8] text-[#258FE5] border border-[#258FE5]/30">
              {doctor.specialty}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-serif font-semibold text-[#163B63] bg-[#EDF5FA] px-2.5 py-1 rounded-full border border-[#D5E4EF]">
              <Star className="w-3.5 h-3.5 fill-[#20B8AD] text-[#20B8AD]" />
              <span>{doctor.rating}</span>
              <span className="text-[#526A82] font-normal">({doctor.reviewCount})</span>
            </div>
          </div>

          {/* Doctor Portrait & Details Row */}
          <div className="flex gap-4 items-start mb-5">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-[#D5E4EF] shadow-subtle bg-[#EDF5FA]">
              <Image
                src={doctor.avatar}
                alt={doctor.name}
                fill
                className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-serif font-normal text-lg sm:text-xl text-[#163B63] truncate">
                  {doctor.name}
                </h3>
                {doctor.verified && (
                  <CheckCircle2
                    className="w-4 h-4 text-[#258FE5] shrink-0"
                    aria-label="Verified Doctor"
                  />
                )}
              </div>

              <p className="text-xs font-serif text-[#526A82] font-light truncate">
                {doctor.qualifications.join(", ")}
              </p>

              <div className="flex items-center gap-1.5 text-xs font-serif text-[#163B63] font-medium pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#258FE5]" />
                <span>{doctor.experienceYears} Years Practice</span>
              </div>
            </div>
          </div>

          {/* Clinic & Location */}
          <div className="space-y-2 py-3 border-y border-[#D5E4EF] text-xs font-serif text-[#526A82]">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#258FE5] shrink-0" />
              <span className="truncate">{doctor.clinic.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#20B8AD] shrink-0" />
              <span className="truncate">{(doctor.clinic as any).locality || doctor.clinic.address}, {doctor.clinic.city}</span>
            </div>
          </div>

          {/* Consultation Modes */}
          <div className="flex items-center gap-2 my-4">
            {doctor.consultationTypes.includes("online") && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-serif font-medium bg-[#DCECF8] text-[#258FE5] border border-[#258FE5]/25">
                <Video className="w-3 h-3" />
                <span>Video Call</span>
              </span>
            )}
            {doctor.consultationTypes.includes("in-person") && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-serif font-medium bg-[#EDF5FA] text-[#163B63] border border-[#D5E4EF]">
                <Building2 className="w-3 h-3 text-[#20B8AD]" />
                <span>In-Clinic</span>
              </span>
            )}
          </div>

          {/* Next Available Pill */}
          <div className="flex items-center gap-2 text-xs font-serif text-[#526A82] mb-2 bg-[#EDF5FA] p-2.5 rounded-2xl border border-[#D5E4EF]">
            <Clock className="w-3.5 h-3.5 text-[#258FE5]" />
            <span>Next Available: <strong className="text-[#163B63] font-medium">{doctor.availability.nextAvailable}</strong></span>
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="pt-4 flex items-center justify-between gap-3 mt-4 border-t border-[#D5E4EF]">
          <div>
            <div className="text-[10px] font-serif text-[#8FA3B8] uppercase tracking-wider font-semibold">
              Consultation Fee
            </div>
            <div className="text-xl font-serif font-bold text-[#163B63]">
              {formatINR(doctor.consultationFee)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/doctor/${doctor.id}`}>
              <Button variant="secondary" size="sm" className="text-xs px-3.5 py-1.5 h-8">
                Profile
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              disabled={loading}
              onClick={handleBookClick}
              className="text-xs px-4 py-1.5 h-8 shadow-sm"
              rightIcon={loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
            >
              {loading ? "Checking..." : "Book"}
            </Button>
          </div>
        </div>
      </div>

      {/* Appointment Booking Modal */}
      {bookingModalOpen && (
        <AppointmentBookingModal
          doctor={doctor}
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
        />
      )}

      {/* Authentication Gate Modal for Unauthenticated Visitors */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        redirectPath={`/doctors?autoBookDoctor=${doctor.id}`}
        onAuthenticated={() => {
          setAuthGateOpen(false);
          setBookingModalOpen(true);
        }}
      />
    </>
  );
};
