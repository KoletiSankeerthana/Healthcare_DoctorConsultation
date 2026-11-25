"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  FileText,
  Activity,
  UserCheck,
  CalendarCheck,
  Video,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const HealthcareServicesSection: React.FC = () => {
  const services = [
    {
      id: "ai-assistant",
      title: "AI Health Assistant",
      description:
        "Conversational health navigation available 24/7. Preliminary assessment, educational health explanations, and department recommendations.",
      icon: BrainCircuit,
      badge: "Intelligent Guidance",
      href: "/ai-assistant",
    },
    {
      id: "document-intelligence",
      title: "Medical Document Intelligence",
      description:
        "Automated extraction of diagnostic lab reports, biometric ranges, and prescription details into structured clinical summaries.",
      icon: FileText,
      badge: "Automated OCR",
      href: "/patient/medical-records",
    },
    {
      id: "symptom-checker",
      title: "AI Symptom Checker",
      description:
        "Structured clinical symptom assessment evaluating duration, severity, and critical red flags to recommend timely medical care.",
      icon: Activity,
      badge: "Clinical Triage",
      href: "/ai-assistant",
    },
    {
      id: "find-doctors",
      title: "Find Doctors",
      description:
        "Comprehensive directory of verified physicians across 10+ clinical disciplines, multiple metropolitan cities, and spoken languages.",
      icon: UserCheck,
      badge: "Verified Profiles",
      href: "/doctors",
    },
    {
      id: "appointment-booking",
      title: "Appointment Booking",
      description:
        "Seamless calendar scheduling with verified doctor availability, morning and afternoon slots, and instant automated confirmations.",
      icon: CalendarCheck,
      badge: "Real-Time Slots",
      href: "/doctors",
    },
    {
      id: "telemedicine",
      title: "Telemedicine",
      description:
        "Encrypted, private browser-native HD video consultations with interactive clinical charting and digital prescriptions.",
      icon: Video,
      badge: "Encrypted Video",
      href: "/patient/dashboard",
    },
  ];

  return (
    <section className="py-20 sm:py-24 bg-gradient-to-b from-[#DCECF8] via-[#EDF5FA] to-[#DCECF8]/60 border-t border-[#D5E4EF] text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#258FE5]/30 text-xs font-serif font-semibold text-[#258FE5] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
            <span className="tracking-widest uppercase text-[10px] sm:text-xs">
              Complete Clinical Capabilities
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-[#163B63] tracking-tight leading-tight">
            Everything You Need for a Smarter Healthcare Journey
          </h2>

          <p className="text-base sm:text-lg font-serif text-[#526A82] leading-relaxed font-light">
            An integrated healthcare technology sanctuary combining certified practitioners, automated diagnostic document analysis, and responsive health guidance.
          </p>
        </div>

        {/* 6 Responsive Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {services.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                className="h-full"
              >
                <Link
                  href={item.href}
                  className="group flex flex-col justify-between h-full rounded-3xl bg-white p-7 sm:p-8 border border-[#D5E4EF] shadow-subtle hover:shadow-editorial hover:border-[#258FE5] transition-all duration-300 relative overflow-hidden"
                >
                  {/* Subtle hover gradient glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#DCECF8] opacity-0 group-hover:opacity-70 transition-opacity blur-2xl pointer-events-none" />

                  <div>
                    {/* Icon and Category Badge Row */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-13 h-13 rounded-2xl bg-[#DCECF8] text-[#258FE5] flex items-center justify-center group-hover:bg-[#258FE5] group-hover:text-white transition-colors duration-300 shadow-xs">
                        <Icon className="w-6 h-6 stroke-[1.75]" />
                      </div>
                      <span className="text-[10px] font-serif font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#EDF5FA] text-[#163B63] border border-[#D5E4EF]">
                        {item.badge}
                      </span>
                    </div>

                    {/* Card Title */}
                    <h3 className="text-xl sm:text-2xl font-serif font-normal text-[#163B63] group-hover:text-[#258FE5] transition-colors mb-3 leading-snug">
                      {item.title}
                    </h3>

                    {/* Short Description */}
                    <p className="text-xs sm:text-sm font-serif text-[#526A82] leading-relaxed font-light">
                      {item.description}
                    </p>
                  </div>

                  {/* Card Bottom CTA Link */}
                  <div className="mt-8 pt-4 border-t border-[#D5E4EF] flex items-center justify-between text-xs font-serif font-semibold text-[#258FE5] group-hover:text-[#1D78C4]">
                    <span>Explore Capability</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
