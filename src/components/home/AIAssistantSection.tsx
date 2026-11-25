"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  Sparkles,
  Activity,
  FileText,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  Bot,
  BrainCircuit,
} from "lucide-react";
import { motion } from "framer-motion";

export const AIAssistantSection: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 bg-gradient-to-br from-[#123D68] via-[#163B63] to-[#123D68] text-[#EDF5FA] border-t border-[#258FE5]/30 relative overflow-hidden text-left">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 right-0 w-[550px] h-[550px] rounded-full bg-[#258FE5]/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[450px] h-[450px] rounded-full bg-[#20B8AD]/20 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Text Column: AI Capabilities */}
          <div className="lg:col-span-6 space-y-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-serif font-semibold text-[#DCECF8]">
              <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span className="tracking-wider uppercase text-[10px] sm:text-xs">
                Intelligent Healthcare Guidance
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-white tracking-tight leading-[1.18]">
              Empowering Better Health Decisions Through AI Guidance
            </h2>

            <p className="text-base sm:text-lg font-serif text-[#DCECF8] leading-relaxed font-light">
              Clarify confusing symptoms, interpret medical laboratory metrics into understandable terms, and discover tailored specialist referrals before your clinical consultation.
            </p>

            {/* 4 Core AI Pillars */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/15 shadow-sm">
                  <Activity className="w-5 h-5 text-[#20B8AD]" />
                </div>
                <div>
                  <h4 className="text-base font-serif font-normal text-white">
                    Structured Symptom Assistance
                  </h4>
                  <p className="text-xs sm:text-sm font-serif text-[#DCECF8]/80 leading-relaxed font-light">
                    Guided interactive triage recording duration, severity patterns, and red flags to determine care urgency.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/15 shadow-sm">
                  <FileText className="w-5 h-5 text-[#20B8AD]" />
                </div>
                <div>
                  <h4 className="text-base font-serif font-normal text-white">
                    Medical Document Analysis &amp; OCR
                  </h4>
                  <p className="text-xs sm:text-sm font-serif text-[#DCECF8]/80 leading-relaxed font-light">
                    Automated parsing of lab reports, lipid panels, and metabolic values into organized summaries with normal ranges.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/15 shadow-sm">
                  <BrainCircuit className="w-5 h-5 text-[#20B8AD]" />
                </div>
                <div>
                  <h4 className="text-base font-serif font-normal text-white">
                    Health Report Interpretation
                  </h4>
                  <p className="text-xs sm:text-sm font-serif text-[#DCECF8]/80 leading-relaxed font-light">
                    Plain-language breakdowns of clinical biomarkers so you can walk into appointments informed and prepared.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/15 shadow-sm">
                  <UserCheck className="w-5 h-5 text-[#20B8AD]" />
                </div>
                <div>
                  <h4 className="text-base font-serif font-normal text-white">
                    Physician &amp; Specialty Navigation
                  </h4>
                  <p className="text-xs sm:text-sm font-serif text-[#DCECF8]/80 leading-relaxed font-light">
                    Direct department routing matching symptom patterns to verified neurologists, cardiologists, or internists.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive CTAs */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link href="/ai-assistant">
                <Button
                  variant="accent"
                  size="lg"
                  className="bg-[#20B8AD] hover:bg-[#1A9E94] text-white font-serif font-semibold text-xs sm:text-sm px-7 py-3 rounded-full shadow-lg border border-teal-300/30"
                  leftIcon={<Bot className="w-4 h-4 text-white" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Start Health Assessment
                </Button>
              </Link>
              <Link href="/patient/medical-records">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white font-serif font-semibold text-xs sm:text-sm px-6 py-3 rounded-full backdrop-blur-sm"
                  leftIcon={<FileText className="w-4 h-4 text-[#DCECF8]" />}
                >
                  Upload Lab Document
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Chat & Diagnostic Interface Preview */}
          <div className="lg:col-span-6">
            <div className="rounded-[32px] bg-white/10 backdrop-blur-md border border-white/20 p-6 sm:p-8 shadow-2xl relative space-y-5">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/15">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#20B8AD] text-white flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif font-normal text-base text-white">
                      AI Health Navigator
                    </h3>
                    <p className="text-xs font-serif text-[#20B8AD]">Active Assessment Session</p>
                  </div>
                </div>
                <span className="text-[10px] font-serif font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20">
                  Version 2.4 Clinical
                </span>
              </div>

              {/* Chat Dialogue Snippets */}
              <div className="space-y-3.5">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-[#258FE5] text-white p-3.5 text-xs sm:text-sm font-serif shadow-sm">
                    I have had a throbbing tension headache around my temples for 2 days, accompanied by slight sensitivity to bright computer light.
                  </div>
                </div>

                {/* Assistant Message */}
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-xs bg-white text-[#163B63] p-4 text-xs sm:text-sm font-serif shadow-md space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#258FE5] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
                      <span>Preliminary Assessment</span>
                    </div>
                    <p className="text-[#526A82] leading-relaxed">
                      Your symptoms reflect patterns consistent with tension headache or early migraine episodes. No immediate emergency red flags (such as sudden thunderclap onset, fever, or vision loss) are reported.
                    </p>
                    <div className="pt-2 border-t border-[#D5E4EF] flex items-center justify-between text-xs font-semibold text-[#163B63]">
                      <span>Suggested Specialist:</span>
                      <span className="text-[#20B8AD] font-bold">Neurology / General Medicine</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transparent Safety Notice Inside the Card */}
              <div className="rounded-2xl bg-[#123D68]/80 border border-[#258FE5]/30 p-3.5 flex items-start gap-3 text-xs text-[#DCECF8]">
                <ShieldAlert className="w-4 h-4 text-[#20B8AD] shrink-0 mt-0.5" />
                <p className="leading-relaxed font-serif">
                  <span className="font-semibold text-white">Clinical Safety Reminder:</span> AI guidance provides preliminary educational context and does not replace certified physician evaluation.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
