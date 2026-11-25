"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SPECIALTIES } from "@/data/specialties";
import { useAuthUser } from "@/hooks/useAuthUser";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import {
  Stethoscope,
  Sparkles,
  HeartPulse,
  Brain,
  Activity,
  Flower2,
  Baby,
  Smile,
  Eye,
  BrainCircuit,
  ArrowRight,
  Search,
  ShieldCheck,
  CheckCircle2,
  Users
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Stethoscope,
  Sparkles,
  HeartPulse,
  Brain,
  Activity,
  Flower2,
  Baby,
  Smile,
  Eye,
  BrainCircuit,
};

export default function SpecialtiesPage() {
  const { isAuthenticated, loading } = useAuthUser();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [query, setQuery] = useState("");

  const filtered = SPECIALTIES.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase()) ||
    s.commonSymptoms.some((sym) => sym.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-12 px-4 sm:px-6 lg:px-8 text-left font-serif">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCECF8] border border-[#D5E4EF] text-xs font-semibold text-[#163B63]">
            <Sparkles className="w-3.5 h-3.5 text-[#258FE5]" />
            Medical Disciplines & Departments
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#163B63] tracking-tight">
            Specialized clinical care across every domain of health.
          </h1>
          <p className="text-sm sm:text-base text-[#526A82] font-light leading-relaxed">
            Discover verified senior medical consultants across 10 specialized clinical disciplines. Explore common symptoms, typical diagnostic procedures, and schedule a consultation.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search specialty or symptom (e.g. Migraine, Heart, Skin)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#CBD5E1] bg-white text-xs sm:text-sm focus:ring-2 focus:ring-[#258FE5] outline-none shadow-xs"
          />
        </div>

        {/* Specialties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((spec) => {
            const IconComponent = iconMap[spec.iconName] || Stethoscope;
            return (
              <div
                key={spec.id}
                className="rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-editorial hover:shadow-luxury hover:border-[#D5E4EF] transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center shadow-xs">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#526A82] bg-[#F1F5F9] px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#258FE5]" />
                      {spec.doctorCount} Doctors
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-serif text-[#163B63] font-medium">{spec.name}</h3>
                    <p className="text-xs text-[#526A82] leading-relaxed mt-1.5">{spec.description}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-[#F1F5F9]">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] block">
                      Common Symptoms Handled:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {spec.commonSymptoms.map((sym) => (
                        <span
                          key={sym}
                          className="px-2 py-0.5 rounded-lg bg-[#F5F9FC] border border-[#D5E4EF] text-[10px] text-[#475569] font-medium"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[11px] text-[#163B63] font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
                    Verified Specialists
                  </span>
                  <Link
                    href={`/doctors?specialty=${encodeURIComponent(spec.name)}`}
                    onClick={(e) => {
                      if (!loading && !isAuthenticated) {
                        e.preventDefault();
                        setSelectedSpecialty(spec.name);
                        setAuthGateOpen(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#258FE5] hover:text-[#163B63] group"
                  >
                    <span>View Doctors</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Auth Gate Modal for Protected Doctor Discovery */}
        <AuthGateModal
          isOpen={authGateOpen}
          onClose={() => setAuthGateOpen(false)}
          featureName="Verified Doctor Discovery"
          redirectPath={
            selectedSpecialty
              ? `/doctors?specialty=${encodeURIComponent(selectedSpecialty)}`
              : "/doctors"
          }
        />
      </div>
    </div>
  );
}
