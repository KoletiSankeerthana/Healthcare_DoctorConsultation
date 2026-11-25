"use client";

import React from "react";
import { ShieldCheck, Lock, FileText, UserCheck, CheckCircle2 } from "lucide-react";

export const TrustSafetySection: React.FC = () => {
  const trustPillars = [
    {
      title: "Verified Medical Practitioners",
      description:
        "Every physician's credentials, active State Medical Council licenses, and postgraduate certifications are audited prior to platform access.",
      icon: ShieldCheck,
      badge: "Council Audited",
    },
    {
      title: "Secure Medical Records",
      description:
        "Your clinical consultations, test histories, and prescriptions are stored in encrypted vaults, accessible exclusively to you and your authorized physicians.",
      icon: Lock,
      badge: "Encrypted Storage",
    },
    {
      title: "Privacy-Conscious Care",
      description:
        "We uphold stringent data dignity standards. Your health records and diagnostic discussions are never monetized or exposed to third parties.",
      icon: FileText,
      badge: "Data Dignity",
    },
    {
      title: "Transparent Consultation Fees",
      description:
        "Clear pricing published upfront in INR with zero surprise hospital charges or booking markups. What you see is what you pay.",
      icon: UserCheck,
      badge: "Clear Pricing",
    },
  ];

  return (
    <section id="trust" className="py-24 bg-gradient-to-b from-[#EDF5FA] via-[#DCECF8]/30 to-[#EDF5FA] border-t border-[#D5E4EF] text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-serif font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
            <span>Integrity & Governance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-[#163B63] tracking-tight">
            Trust built on rigorous standards and clinical transparency.
          </h2>
          <p className="text-base font-serif text-[#526A82] leading-relaxed font-light">
            Healthcare decisions require unwavering confidence. We maintain exacting criteria for medical verification, patient privacy, and clinical quality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-3xl bg-white p-7 border border-[#D5E4EF] shadow-subtle hover:border-[#258FE5] hover:shadow-editorial transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-[#DCECF8] text-[#258FE5] flex items-center justify-center">
                      <Icon className="w-6 h-6 stroke-[1.75]" />
                    </div>
                    <span className="text-[10px] font-serif font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#EDF5FA] text-[#258FE5] border border-[#D5E4EF]">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-serif font-normal text-[#163B63] mb-2.5 leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-serif text-[#526A82] leading-relaxed font-light">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#D5E4EF] flex items-center gap-2 text-xs font-serif font-semibold text-[#258FE5]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Clinical Standard</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
