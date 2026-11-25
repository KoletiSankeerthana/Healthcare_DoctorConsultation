import React from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ShieldCheck, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#163B63] text-[#F5F9FC] pt-20 pb-12 border-t border-[#258FE5]/30 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Clinical Transparency Notice */}
        <div className="mb-14 rounded-2xl bg-[#0E2742] border border-[#258FE5]/30 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs text-[#EAF5FC]/90">
          <div className="w-10 h-10 rounded-full bg-[#258FE5]/20 text-[#20B8AD] flex items-center justify-center shrink-0 border border-[#20B8AD]/30">
            <ShieldCheck className="w-5 h-5 text-[#20B8AD]" />
          </div>
          <div className="leading-relaxed">
            <span className="font-semibold text-white">Demonstration Platform Governance: </span>
            {BRAND.demoDisclaimer} {BRAND.emergencyNote}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-14 border-b border-[#258FE5]/20">
          {/* Brand Info */}
          <div className="lg:col-span-5 space-y-5">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#258FE5] flex items-center justify-center text-white border border-white/20">
                <span className="font-serif text-xl font-normal italic">H</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-serif font-normal tracking-tight text-white">
                  {BRAND.name}
                </span>
                <span className="text-[10px] tracking-[0.2em] font-sans font-semibold text-[#20B8AD] uppercase">
                  Digital Sanctuary
                </span>
              </div>
            </Link>
            <p className="text-sm text-[#EAF5FC]/80 leading-relaxed max-w-md font-light">
              Care that feels personal. Healthcare that moves forward. An intelligent ecosystem uniting discerning patients, distinguished physicians, and clinical safety.
            </p>
            <div className="pt-2 space-y-2.5 text-xs text-[#EAF5FC]/80">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#20B8AD]" />
                <span>{BRAND.supportEmail}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#20B8AD]" />
                <span>{BRAND.supportPhone} (Concierge Support)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#20B8AD]" />
                <span>Bangalore • Mumbai • New Delhi • Hyderabad</span>
              </div>
            </div>
          </div>

          {/* Column 1: For Patients */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold text-[#20B8AD] uppercase tracking-[0.15em]">
              For Patients
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#EAF5FC]/80 font-normal">
              <li>
                <Link href="/doctors" className="hover:text-white transition-colors">
                  Find a Doctor
                </Link>
              </li>
              <li>
                <Link href="/#specialties" className="hover:text-white transition-colors">
                  Clinical Specialties
                </Link>
              </li>
              <li>
                <Link href="/ai-assistant" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>AI Health Navigator</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-[#258FE5] text-white rounded-full font-bold">New</span>
                </Link>
              </li>
              <li>
                <Link href="/patient/dashboard" className="hover:text-white transition-colors">
                  Patient Sanctuary
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  Create Membership
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: For Practitioners */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold text-[#20B8AD] uppercase tracking-[0.15em]">
              For Practitioners
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#EAF5FC]/80 font-normal">
              <li>
                <Link href="/register/doctor" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>Join as Medical Doctor</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#20B8AD]" />
                </Link>
              </li>
              <li>
                <Link href="/doctor/dashboard" className="hover:text-white transition-colors">
                  Physician Workspace
                </Link>
              </li>
              <li>
                <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                  Governance Console
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Practitioner Login
                </Link>
              </li>
              <li>
                <Link href="/#trust" className="hover:text-white transition-colors">
                  Credential Verification
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Governance */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold text-[#20B8AD] uppercase tracking-[0.15em]">
              Governance
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#EAF5FC]/80 font-normal">
              <li>
                <Link href="/#about" className="hover:text-white transition-colors">
                  Our Philosophy
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-white transition-colors">
                  Care Continuum
                </Link>
              </li>
              <li>
                <Link href="/#trust" className="hover:text-white transition-colors">
                  Data Dignity & Privacy
                </Link>
              </li>
              <li>
                <span className="text-[#EAF5FC]/60 cursor-not-allowed">
                  Terms of Service (Demo)
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#EAF5FC]/70 gap-4">
          <p>© {new Date().getFullYear()} {BRAND.name} Platform Inc. All rights reserved. Designed for Modern Luxury Digital Healthcare.</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20B8AD]" />
            <span>Encrypted • Verified Practitioners • Human-Centered Care</span>
          </div>
        </div>
      </div>
    </footer>
  );
};