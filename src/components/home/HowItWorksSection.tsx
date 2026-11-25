"use client";

import React from "react";
import Link from "next/link";
import { UserPlus, Compass, CalendarCheck, FileText, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      stepNumber: "01",
      title: "Create Your Account",
      description:
        "Register your secure patient profile in seconds to access encrypted medical records, consultation history, and personalized health tracking.",
      icon: UserPlus,
      href: "/register",
      actionText: "Sign Up Free",
    },
    {
      stepNumber: "02",
      title: "Explore Healthcare Services",
      description:
        "Navigate our 24/7 AI health assistant for preliminary triage, upload diagnostic lab reports for automated extraction, or browse certified medical specialists.",
      icon: Compass,
      href: "/ai-assistant",
      actionText: "Try AI Assistant",
    },
    {
      stepNumber: "03",
      title: "Connect with Doctors",
      description:
        "Select your preferred specialist by clinical discipline, city, and verified real-time slot. Choose between an in-clinic visit or encrypted HD video consultation.",
      icon: CalendarCheck,
      href: "/doctors",
      actionText: "Find Specialists",
    },
    {
      stepNumber: "04",
      title: "Manage Your Health Journey",
      description:
        "Receive digitally signed prescriptions, track diagnostic lab biomarker trends over time, and consult follow-up records securely in your personal sanctuary.",
      icon: FileText,
      href: "/patient/dashboard",
      actionText: "Patient Sanctuary",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-24 bg-[#EDF5FA] border-t border-[#D5E4EF] text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#20B8AD]/40 text-xs font-serif font-semibold text-[#163B63] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
            <span className="tracking-widest uppercase text-[10px] sm:text-xs">
              Simple 4-Step Continuum
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-[#163B63] tracking-tight leading-tight">
            How It Works: Seamless, Coordinated Care
          </h2>

          <p className="text-base sm:text-lg font-serif text-[#526A82] leading-relaxed font-light">
            Every phase of your healthcare experience is intentionally streamlined to remove delays, ensure data privacy, and keep you in total control.
          </p>
        </div>

        {/* 4 Connected Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.stepNumber}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="relative rounded-3xl bg-white p-7 sm:p-8 border border-[#D5E4EF] shadow-subtle hover:border-[#258FE5] hover:shadow-editorial transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#DCECF8] text-[#258FE5] flex items-center justify-center shadow-xs border border-[#D5E4EF]">
                      <Icon className="w-6 h-6 stroke-[1.75] text-[#20B8AD]" />
                    </div>
                    <span className="font-serif text-3xl font-bold text-[#D5E4EF] select-none">
                      {item.stepNumber}
                    </span>
                  </div>

                  <h3 className="text-xl font-serif font-normal text-[#163B63] mb-3 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-serif text-[#526A82] leading-relaxed font-light">
                    {item.description}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-[#D5E4EF]">
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 text-xs font-serif font-semibold text-[#258FE5] hover:text-[#1D78C4] group"
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
