"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DOCTORS } from "@/data/doctors";
import { DoctorCard } from "@/components/doctors/DoctorCard";
import { ArrowRight, Stethoscope } from "lucide-react";
import { motion } from "framer-motion";

export const FeaturedDoctorsSection: React.FC = () => {
  const [selectedSpecialty, setSelectedSpecialty] = useState("All Specialties");

  const specialties = [
    "All Specialties",
    "Cardiology",
    "Dermatology",
    "Pediatrics",
    "Orthopedics",
    "Neurology",
    "General Medicine",
  ];

  const filteredDoctors = DOCTORS.filter((doc) => {
    const matchesSpecialty =
      selectedSpecialty === "All Specialties" ||
      doc.specialty.toLowerCase() === selectedSpecialty.toLowerCase();
    return matchesSpecialty;
  }).slice(0, 4);

  return (
    <section id="doctor-discovery" className="py-20 sm:py-24 bg-gradient-to-br from-[#123D68] via-[#163B63] to-[#123D68] text-white border-t border-[#258FE5]/30 relative overflow-hidden">
      {/* Ambient Lighting Accents */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#258FE5]/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[450px] h-[450px] rounded-full bg-[#20B8AD]/15 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left relative z-10">

        {/* Editorial Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-serif font-semibold text-[#DCECF8] shadow-xs">
              <Stethoscope className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span className="tracking-widest uppercase text-[10px] sm:text-xs">
                Clinical Faculty Discovery
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-white tracking-tight leading-tight">
              Connect with Verified Medical Practitioners
            </h2>

            <p className="text-base sm:text-lg font-serif text-[#DCECF8] leading-relaxed font-light">
              Filter vetted physicians by medical domain. Every doctor profile displays genuine qualifications, clinic premises, and verified appointment slots.
            </p>
          </div>

          <Link
            href="/doctors"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-[#EDF5FA] text-sm font-serif font-semibold text-[#123D68] shadow-lg hover:shadow-xl transition-all group shrink-0"
          >
            <span>Explore All {DOCTORS.length} Specialists</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#258FE5]" />
          </Link>
        </div>

        {/* Interactive Filter Strip: Specialty Pills */}
        <div className="mb-10 p-3 sm:p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-editorial flex items-center justify-between gap-4">
          {/* Specialty Filter Scrollable Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none w-full">
            {specialties.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-4 py-2 rounded-full text-xs font-serif font-medium whitespace-nowrap transition-all ${selectedSpecialty === spec
                  ? "bg-[#258FE5] text-white shadow-md font-semibold"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/15"
                  }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Curated Doctor Profiles Grid */}
        {filteredDoctors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredDoctors.map((doc, idx) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
              >
                <DoctorCard doctor={doc} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center rounded-3xl bg-white/10 border border-white/20 space-y-3">
            <p className="font-serif text-lg text-white">
              No doctors found matching the selected specialty.
            </p>
            <button
              onClick={() => {
                setSelectedSpecialty("All Specialties");
              }}
              className="px-5 py-2 rounded-full bg-[#258FE5] text-white text-xs font-serif font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}

      </div>
    </section>
  );
};
