"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRight, UserPlus, Compass, Sparkles } from "lucide-react";

export const CTASection: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 bg-[#EDF5FA] border-t border-[#D5E4EF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-[36px] sm:rounded-[44px] bg-gradient-to-br from-[#123D68] via-[#163B63] to-[#258FE5] text-white p-10 sm:p-14 lg:p-20 relative overflow-hidden shadow-luxury border border-[#258FE5]/30 text-center">
          
          {/* Subtle atmospheric ambient glow */}
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#20B8AD]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-[#123D68]/50 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-xs font-serif font-semibold text-white shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#DCECF8]" />
              <span className="tracking-widest uppercase text-[10px] sm:text-xs">
                Your Health Journey Begins Today
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-serif font-normal tracking-tight text-white leading-tight">
              A Connected, Dignified Way to Experience Healthcare
            </h2>

            <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed font-serif font-light">
              Join patients and certified physicians discovering transparent doctor discovery, verified appointment scheduling, and automated diagnostic report intelligence.
            </p>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full sm:w-auto justify-center bg-[#20B8AD] hover:bg-[#1A9E94] text-white font-serif font-semibold text-xs sm:text-sm px-8 py-3.5 rounded-full shadow-xl border border-teal-300/30"
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Patient Account
                </Button>
              </Link>

              <Link href="/doctors" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto justify-center bg-white/10 hover:bg-white/20 border-white/40 text-white font-serif font-semibold text-xs sm:text-sm px-8 py-3.5 rounded-full backdrop-blur-sm"
                  leftIcon={<Compass className="w-4 h-4 text-white" />}
                >
                  Explore Healthcare Services
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
