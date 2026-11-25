"use client";

import React from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import {
  ShieldCheck,
  Heart,
  Stethoscope,
  Activity,
  BrainCircuit,
  FileText,
  Lock,
  Users,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Building2,
  Video
} from "lucide-react";

export default function AboutPage() {
  const problems = [
    {
      title: "Opaque & Stressful Lab Reports",
      description:
        "Patients frequently receive complex blood test and pathology results with incomprehensible medical terminology, leading to anxiety, delayed follow-up, or misleading internet searches.",
      impact: "74% of patients feel anxious when reading clinical reports without guidance.",
      icon: FileText,
      accent: "from-rose-50 to-orange-50",
      border: "border-rose-100",
      iconColor: "text-rose-600"
    },
    {
      title: "Fragmented Medical History",
      description:
        "Diagnostic documents, prescriptions, and past medical charts remain scattered across physical binders, email inboxes, and hospital silos, leaving clinicians blind during critical consultations.",
      impact: "Lack of immediate records causes duplicate tests and misaligned treatments.",
      icon: Clock,
      accent: "from-amber-50 to-yellow-50",
      border: "border-amber-100",
      iconColor: "text-amber-600"
    },
    {
      title: "Delayed Access to Trusted Doctors",
      description:
        "Finding an available, council-verified specialist often requires days of phone calls, long clinic waiting queues, and uncertainty regarding the doctor's credentials or clinical expertise.",
      impact: "Average in-person consultation delay in metropolitan areas exceeds 4 days.",
      icon: Building2,
      accent: "from-sky-50 to-blue-50",
      border: "border-sky-100",
      iconColor: "text-sky-600"
    },
    {
      title: "Absence of Safe Emergency Guidance",
      description:
        "Generic search engines lack clinical guardrails and cannot identify acute red-flag symptoms such as stroke (F.A.S.T.) or cardiac distress, presenting identical advice for severe and mild complaints.",
      impact: "Crucial golden hours are lost when patients misjudge critical symptoms.",
      icon: AlertTriangle,
      accent: "from-[#EAF5FC] to-[#F5F9FC]",
      border: "border-teal-100",
      iconColor: "text-teal-600"
    }
  ];

  const pillars = [
    {
      name: "AI Medical Document Intelligence",
      tag: "Clinical Synthesis Engine",
      description:
        "Proprietary OCR and medical entity recognition parses complex multi-page laboratory reports (Complete Blood Counts, Lipid Panels, Metabolic Profiles) and prescriptions into readable, structured summaries with normal reference ranges.",
      icon: FileText
    },
    {
      name: "Council-Verified Doctor Registry",
      tag: "100% Medical Council Audited",
      description:
        "Every physician practicing on MediVerse undergoes automated registration number verification against State Medical Councils and the National Medical Commission (NMC) before consultations are enabled.",
      icon: ShieldCheck
    },
    {
      name: "Ultra-HD WebRTC Telemedicine",
      tag: "Encrypted Clinical Video",
      description:
        "Browser-native, low-latency video consultations featuring simultaneous clinical charting, digital prescription pads, and secure patient report screen-sharing with zero software installation.",
      icon: Video
    },
    {
      name: "Symptom Assessment with Red-Flag Safety",
      tag: "Clinical Decision Support",
      description:
        "Intelligent multi-step intake triage that identifies emergency cardiovascular or neurological warning signs immediately, directing high-risk individuals to verified emergency care while guiding routine concerns to nearby specialists.",
      icon: BrainCircuit
    }
  ];

  const patientBenefits = [
    {
      title: "Clarity in Minutes",
      detail: "Understand your blood tests, pathology metrics, and physician notes in plain, supportive language without clinical jargon."
    },
    {
      title: "Zero Lost Records",
      detail: "All uploaded reports, diagnostic histories, and digital prescriptions remain encrypted and permanently accessible in your health sanctuary."
    },
    {
      title: "Nearby Verified Specialists",
      detail: "Discover licensed physicians within your locality (such as Chennai, Bangalore, Mumbai) with real-time slot availability and transparent pricing."
    },
    {
      title: "Strict Privacy & Data Ownership",
      detail: "Your medical files are protected by AES-256 encryption. Only you and the practitioner you consult with have authorized access."
    }
  ];

  return (
    <div className="min-h-screen bg-[#EDF5FA] text-left font-serif">
      {/* Editorial Header Section */}
      <section className="relative overflow-hidden bg-white border-b border-[#D5E4EF] py-16 sm:py-24">
        {/* Soft background ambient glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-[#EAF5FC]/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 rounded-full bg-[#DCE6EF]/40 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF5FC] border border-[#20B8AD] text-xs font-semibold text-[#163B63] mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
            About MediVerse • Healthcare Digital Sanctuary
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-normal text-[#163B63] tracking-tight leading-[1.15] max-w-4xl">
            Where medical intelligence meets human empathy.
          </h1>

          <p className="text-base sm:text-lg text-[#526A82] font-light leading-relaxed max-w-3xl mt-6">
            Healthcare Digital Sanctuary was founded to transform the healthcare experience from a fragmented, stressful maze into a clear, supportive, and accessible sanctuary for patients and practitioners alike.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 border-t border-[#F1F5F9] mt-12 max-w-4xl">
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#163B63] font-bold">100%</div>
              <div className="text-xs text-[#526A82] mt-1">Council-Verified Doctors</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#258FE5] font-bold">256-Bit</div>
              <div className="text-xs text-[#526A82] mt-1">End-to-End Encryption</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#163B63] font-bold">&lt; 3 Mins</div>
              <div className="text-xs text-[#526A82] mt-1">Lab Report AI Synthesis</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#20B8AD] font-bold">Zero</div>
              <div className="text-xs text-[#526A82] mt-1">Third-Party Data Sharing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why We Built MediVerse: The Core Problems We Solve */}
      <section className="py-20 bg-[#F5F9FC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#20B8AD]">
              The Healthcare Challenge
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif text-[#163B63] mt-2">
              The Realities of Modern Healthcare
            </h2>
            <p className="text-sm text-[#526A82] mt-2 leading-relaxed">
              Every day, millions of individuals struggle with clinical complexity, long waitlists, and fragmented records. MediVerse was built specifically to dismantle these hurdles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {problems.map((prob, idx) => {
              const Icon = prob.icon;
              return (
                <div
                  key={idx}
                  className={`p-7 rounded-3xl bg-white border ${prob.border} shadow-editorial space-y-4 hover:shadow-luxury transition-all`}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${prob.accent} flex items-center justify-center ${prob.iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-[#163B63] font-medium">{prob.title}</h3>
                    <p className="text-xs text-[#526A82] leading-relaxed mt-2">{prob.description}</p>
                  </div>
                  <div className="pt-3 border-t border-[#F1F5F9] text-[11px] font-semibold text-[#163B63] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{prob.impact}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Approach Section */}
      <section className="py-20 bg-white border-y border-[#D5E4EF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#258FE5]">
              Engineered for Clinical Safety
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif text-[#163B63] mt-2">
              Our Healthcare Technology Architecture
            </h2>
            <p className="text-sm text-[#526A82] mt-2 leading-relaxed">
              We combine strict regulatory guardrails, encrypted WebRTC communication, and artificial intelligence into a unified, patient-centric ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-3xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-4 hover:border-[#20B8AD] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-[#D5E4EF] text-[#20B8AD] flex items-center justify-center shadow-xs">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#DCE6EF] text-[#163B63] px-2.5 py-1 rounded-full">
                      {pillar.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-[#163B63]">{pillar.name}</h3>
                    <p className="text-xs text-[#526A82] leading-relaxed mt-2">{pillar.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Patient Benefits */}
      <section className="py-20 bg-[#EAF5FC]/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#163B63]">
              Patient-First Experience
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif text-[#163B63]">
              How You Benefit From MediVerse
            </h2>
            <p className="text-xs sm:text-sm text-[#526A82]">
              Designed to support you at every milestone of your health journey.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {patientBenefits.map((b, idx) => (
              <div key={idx} className="p-6 rounded-3xl bg-white border border-[#D5E4EF] shadow-editorial space-y-3">
                <div className="w-8 h-8 rounded-xl bg-[#DCE6EF] text-[#163B63] flex items-center justify-center font-bold text-xs">
                  0{idx + 1}
                </div>
                <h4 className="font-serif text-base text-[#163B63]">{b.title}</h4>
                <p className="text-xs text-[#526A82] leading-relaxed">{b.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <div className="p-8 sm:p-10 rounded-3xl bg-[#163B63] text-white space-y-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#20B8AD]">
                  Our Mission
                </span>
                <h3 className="text-2xl font-serif mt-3 text-white">
                  Democratizing clinical clarity and compassionate care.
                </h3>
                <p className="text-xs text-[#CBD5E1] font-light leading-relaxed mt-4">
                  To ensure that no patient ever feels left in the dark about their health. By fusing clinical-grade AI document parsing with council-verified practitioners, we ensure every individual receives timely, safe, and transparent medical assistance.
                </p>
              </div>
              <div className="pt-6 border-t border-white/10 text-xs text-[#20B8AD] flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span>Patient Empowerment First</span>
              </div>
            </div>

            <div className="p-8 sm:p-10 rounded-3xl bg-[#163B63] text-white space-y-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#EAF5FC]">
                  Our Vision
                </span>
                <h3 className="text-2xl font-serif mt-3 text-white">
                  The trusted digital sanctuary for proactive healthcare.
                </h3>
                <p className="text-xs text-[#E6FFFA] font-light leading-relaxed mt-4">
                  A future where preventative health, diagnostic interpretation, doctor consultations, and health records live harmoniously in one secure sanctuary, empowering millions to live healthier, longer, and more confident lives.
                </p>
              </div>
              <div className="pt-6 border-t border-white/10 text-xs text-[#EAF5FC] flex items-center gap-2">
                <Heart className="w-4 h-4" />
                <span>Compassionate Telemedicine</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Bar */}
      <section className="py-16 bg-[#F5F9FC] border-t border-[#D5E4EF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
            Ready to experience a more confident health journey?
          </h2>
          <p className="text-xs sm:text-sm text-[#526A82] max-w-lg mx-auto">
            Create your free patient sanctuary account today or consult with our verified medical practitioners.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="px-6 py-3.5 rounded-2xl bg-[#20B8AD] hover:bg-[#163B63] text-white font-semibold text-xs transition-all shadow-editorial flex items-center gap-2"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/doctors"
              className="px-6 py-3.5 rounded-2xl bg-white border border-[#CBD5E1] text-[#163B63] hover:bg-[#F5F9FC] font-semibold text-xs transition-all shadow-xs"
            >
              Find a Doctor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
