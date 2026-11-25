"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Video,
  Mic,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export const OnlineConsultationSection: React.FC = () => {
  return (
    <section id="online-consultation" className="py-24 bg-[#EDF5FA] border-t border-[#D5E4EF] text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          {/* Left Column: Visual Telehealth Call UI Preview */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="relative rounded-[32px] bg-[#123D68] p-5 sm:p-7 shadow-luxury border border-[#258FE5]/40 overflow-hidden text-left">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 text-xs text-[#20B8AD]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#20B8AD] animate-pulse" />
                  <span className="font-serif font-medium text-white">Private Video Sanctuary</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-serif bg-[#258FE5] px-3 py-1 rounded-full text-white">
                  <Lock className="w-3.5 h-3.5" />
                  <span>256-bit Encrypted</span>
                </div>
              </div>

              {/* Main Doctor Screen Preview */}
              <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden bg-[#0E2742] border border-white/10">
                <Image
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80"
                  alt="Senior Dermatologist on Video Consultation"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#123D68]/90 via-transparent to-transparent" />

                {/* Patient Inset */}
                <div className="absolute top-4 right-4 w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden border-2 border-white/30 shadow-editorial bg-[#123D68]">
                  <Image
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
                    alt="Patient in Consultation"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute bottom-1 left-2 text-[9px] text-white font-serif font-medium bg-black/60 px-1.5 py-0.5 rounded">
                    You
                  </div>
                </div>

                {/* Doctor Overlay Info */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="text-base font-serif font-normal">
                    Dr. Priyamvada Rao
                  </div>
                  <div className="text-xs font-serif text-[#20B8AD] font-light">
                    Consultant Dermatologist • Clinical Session
                  </div>
                </div>
              </div>

              {/* In-Call Action Toolbar Preview */}
              <div className="mt-5 pt-4 flex items-center justify-between border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-serif text-[#DCECF8]">
                  <ShieldCheck className="w-4 h-4 text-[#20B8AD]" />
                  <span>Encrypted Peer Connection</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative */}
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#20B8AD]/40 text-xs font-serif font-semibold text-[#163B63] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span className="tracking-widest uppercase text-[10px] sm:text-xs">
                Encrypted Telemedicine
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-[#163B63] tracking-tight leading-tight">
              Clinical Consultations from the Comfort of Home
            </h2>

            <p className="text-base sm:text-lg font-serif text-[#526A82] leading-relaxed font-light">
              Connect with leading medical specialists via private, browser-native HD video. Receive comprehensive evaluations, prescription issuances, and coordinated next steps.
            </p>

            <ul className="space-y-3 pt-2 text-sm font-serif text-[#526A82]">
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#20B8AD]" />
                Zero downloads or software installations required
              </li>
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#20B8AD]" />
                Interactive clinical charting &amp; digital prescriptions
              </li>
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#20B8AD]" />
                Secure archival of consultation notes in your patient vault
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
