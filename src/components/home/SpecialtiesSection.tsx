"use client";

import React from "react";
import Link from "next/link";
import { SPECIALTIES } from "@/data/specialties";
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
} from "lucide-react";
import { motion } from "framer-motion";

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

export const SpecialtiesSection: React.FC = () => {
  const featured = SPECIALTIES.slice(0, 2);
  const remaining = SPECIALTIES.slice(2);

  return (
    <section id="specialties" className="py-24 bg-gradient-to-b from-[#EDF5FA] via-[#DCECF8]/40 to-[#EDF5FA] border-t border-[#D5E4EF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-serif font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
              <span>Clinical Disciplines</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-[#163B63] tracking-tight">
              Specialized care tailored to every dimension of your health.
            </h2>
            <p className="text-base font-serif text-[#526A82] leading-relaxed font-light">
              Connect with vetted medical specialists holding senior clinical appointments across 10 distinct medical domains.
            </p>
          </div>
          <Link
            href="/doctors"
            className="inline-flex items-center gap-2 text-sm font-serif font-semibold text-[#258FE5] hover:text-[#123D68] group"
          >
            <span>Explore all practitioners</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Visual Composition */}
        <div className="space-y-6">
          {/* Top Row: 2 Major Featured Specialty Showcases */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featured.map((spec, i) => {
              const Icon = iconMap[spec.iconName] || Stethoscope;
              return (
                <motion.div
                  key={spec.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <Link
                    href={`/doctors?specialty=${encodeURIComponent(spec.name)}`}
                    className="group block rounded-3xl bg-white p-8 border border-[#D5E4EF] shadow-subtle hover:shadow-editorial hover:border-[#258FE5] transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-[#DCECF8] text-[#258FE5] flex items-center justify-center group-hover:bg-[#258FE5] group-hover:text-white transition-colors duration-300">
                        <Icon className="w-7 h-7 stroke-[1.75]" />
                      </div>
                      <span className="text-xs font-serif font-semibold px-3 py-1 rounded-full bg-[#EDF5FA] text-[#258FE5] border border-[#D5E4EF]">
                        {spec.doctorCount} Doctors
                      </span>
                    </div>

                    <h3 className="text-2xl font-serif font-normal text-[#163B63] group-hover:text-[#258FE5] transition-colors mb-2">
                      {spec.name}
                    </h3>

                    <p className="text-sm font-serif text-[#526A82] leading-relaxed mb-6 font-light">
                      {spec.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[#D5E4EF]">
                      <span className="text-[11px] font-serif font-semibold text-[#8FA3B8] uppercase tracking-wider">
                        Common Symptoms:
                      </span>
                      {(spec.commonSymptoms || []).map((cond: string) => (
                        <span
                          key={cond}
                          className="text-xs font-serif px-2.5 py-0.5 rounded-full bg-[#EDF5FA] text-[#526A82]"
                        >
                          {cond}
                        </span>
                      ))}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Grid: Remaining 8 Specialties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {remaining.map((spec, i) => {
              const Icon = iconMap[spec.iconName] || Stethoscope;
              return (
                <motion.div
                  key={spec.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Link
                    href={`/doctors?specialty=${encodeURIComponent(spec.name)}`}
                    className="group block rounded-3xl bg-white p-6 border border-[#D5E4EF] shadow-subtle hover:border-[#258FE5] hover:shadow-editorial transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-2xl bg-[#DCECF8] text-[#258FE5] flex items-center justify-center group-hover:bg-[#258FE5] group-hover:text-white transition-colors duration-300">
                        <Icon className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <span className="text-[11px] font-serif font-medium text-[#8FA3B8]">
                        {spec.doctorCount} Doctors
                      </span>
                    </div>

                    <h4 className="text-lg font-serif font-normal text-[#163B63] group-hover:text-[#258FE5] transition-colors mb-1.5">
                      {spec.name}
                    </h4>

                    <p className="text-xs font-serif text-[#526A82] line-clamp-2 font-light">
                      {spec.description}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
