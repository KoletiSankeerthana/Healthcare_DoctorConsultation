"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import {
  Search,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Heart,
  BrainCircuit,
} from "lucide-react";

export const HeroSection: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [imgError, setImgError] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    router.push(`/doctors?${params.toString()}`);
  };

  return (
    <section className="relative px-3 sm:px-4 lg:px-6 pt-2 sm:pt-3 pb-6 sm:pb-10 bg-gradient-to-b from-[#123D68] via-[#164E78]/15 to-[#EDF5FA]">
      {/* Immersive Hero Container Sized Dynamically to Fit Desktop Viewport Without Clipping */}
      <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] lg:rounded-[38px] shadow-luxury border border-[#D5E4EF] min-h-[600px] lg:min-h-[calc(100svh-4.75rem)] lg:max-h-[820px] xl:max-h-[860px] flex items-center">

        {/* Background Photograph: Professional Doctor Team (Photorealistic 3-Doctor Consultation Team) */}
        <div className="absolute inset-0 z-0">
          <Image
            src={
              imgError
                ? "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=2400&q=85"
                : "/images/hero-doctor-consult.jpg"
            }
            alt="Professional healthcare team of verified medical doctors with stethoscopes in modern clinical hospital environment"
            fill
            priority
            sizes="100vw"
            onError={() => setImgError(true)}
            className="object-cover object-center lg:object-[70%_center] transform scale-[1.01]"
          />

          {/* Ocean Blue & Turquoise Directional Gradient: High Text Contrast on Left, Clear Doctor Visibility on Center/Right */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(18, 59, 99, 0.94) 0%, rgba(22, 59, 99, 0.82) 34%, rgba(37, 143, 229, 0.28) 55%, rgba(32, 184, 173, 0.05) 75%, transparent 100%)",
            }}
          />

          {/* Ambient Lighting Accents */}
          <div className="absolute top-0 left-1/4 w-[450px] h-[450px] rounded-full bg-[#258FE5]/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-[450px] h-[450px] rounded-full bg-[#163B63]/30 blur-3xl pointer-events-none" />
        </div>

        {/* Hero Content Layer */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-6 xl:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 items-center">

            {/* Left Column: Hero Content, Typography, CTAs, Search & Feature Strip */}
            <div className="lg:col-span-8 xl:col-span-7 space-y-3.5 sm:space-y-4 lg:space-y-3.5 xl:space-y-4 text-left">

              {/* Category Eyebrow Pill */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-white shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-[#20B8AD] animate-pulse" />
                <span className="tracking-widest uppercase text-[10px] sm:text-[11px] font-serif font-semibold">
                  Intelligent Healthcare Platform
                </span>
              </motion.div>

              {/* Main Heading - Responsive, Times New Roman, Pure White with Turquoise Accent */}
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[38px] xl:text-[44px] 2xl:text-[48px] font-serif font-normal text-white leading-[1.15] tracking-tight drop-shadow-sm"
              >
                Your Health Journey Deserves{" "}
                <span className="italic font-serif text-[#20B8AD] font-semibold">Care,</span>{" "}
                <span className="italic font-serif text-[#EAF5FC]">Clarity</span> &amp;{" "}
                <span className="italic font-serif text-white">Confidence.</span>
              </motion.h1>

              {/* Description - High Contrast Soft White */}
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.16 }}
                className="text-xs sm:text-sm lg:text-[14px] xl:text-base font-serif text-[#F1F7FC] leading-relaxed max-w-xl font-light"
              >
                Experience smarter healthcare with AI-powered health assistance, intelligent medical document analysis, and easy access to healthcare services — all in one place.
              </motion.p>

              {/* Philosophy Quote Card - Translucent Glass with White Text */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.22 }}
                className="p-3 sm:p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-md max-w-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-white text-[#258FE5] flex items-center justify-center shrink-0 shadow-xs border border-white/40 mt-0.5">
                    <Heart className="w-3.5 h-3.5 text-[#20B8AD] fill-[#20B8AD]/20" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-serif italic text-xs sm:text-sm text-white leading-snug">
                      &ldquo;Every step towards understanding your health is a step towards a healthier tomorrow.&rdquo;
                    </p>
                    <p className="text-[10px] font-serif font-bold uppercase tracking-wider text-[#20B8AD]">
                      HEALVIA CARE PHILOSOPHY
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.26 }}
                className="flex flex-wrap items-center gap-3 pt-0.5"
              >
                <Link href="/doctors">
                  <Button
                    variant="primary"
                    size="md"
                    className="bg-[#20B8AD] hover:bg-[#1A9E94] text-white shadow-lg shadow-teal-950/20 text-xs sm:text-sm font-serif font-semibold px-6 py-2.5 sm:py-3 rounded-full border border-teal-300/30"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Explore Healthcare Services
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    variant="outline"
                    size="md"
                    className="border-white/40 bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs text-xs sm:text-sm font-serif font-semibold px-6 py-2.5 sm:py-3 rounded-full"
                  >
                    Get Started
                  </Button>
                </Link>
              </motion.div>

              {/* Fast Doctor Search Bar */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.3 }}
                className="p-1.5 sm:p-2 rounded-2xl bg-white/95 backdrop-blur-md border border-white/50 shadow-xl max-w-xl"
              >
                <form onSubmit={handleSearch} className="flex items-center gap-2 p-0.5">
                  <div className="flex-1 flex items-center gap-2.5 px-3 py-1.5 w-full">
                    <Search className="w-4 h-4 text-[#64748B] shrink-0" />
                    <input
                      type="text"
                      placeholder="Find specialty, doctor or symptom..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs sm:text-sm font-serif text-[#163B63] placeholder:text-[#94A3B8] focus:outline-none bg-transparent"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="bg-[#258FE5] hover:bg-[#1D78C4] text-white text-xs sm:text-sm font-serif px-6 py-2 shrink-0 rounded-full shadow-2xs font-semibold"
                  >
                    Search
                  </Button>
                </form>
              </motion.div>

              {/* Replaced & Optimized Bottom Feature Strip (Fully visible inside viewport) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.36 }}
                className="pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-xl text-left"
              >
                {/* Feature 1: Verified Doctor Profiles */}
                <div className="flex items-start gap-2.5 bg-white/10 backdrop-blur-xs p-2 sm:p-2.5 rounded-xl border border-white/15">
                  <div className="w-7 h-7 rounded-lg bg-white/20 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/20 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-[#20B8AD]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-serif font-bold text-white truncate leading-tight">
                      Verified Doctor Profiles
                    </div>
                    <div className="text-[11px] font-serif text-[#EAF5FC] leading-tight mt-0.5 line-clamp-1">
                      Council-registered specialists
                    </div>
                  </div>
                </div>

                {/* Feature 2: Smart Appointment Booking (Replaced Encrypted Records) */}
                <div className="flex items-start gap-2.5 bg-white/10 backdrop-blur-xs p-2 sm:p-2.5 rounded-xl border border-white/15">
                  <div className="w-7 h-7 rounded-lg bg-white/20 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/20 mt-0.5">
                    <Calendar className="w-4 h-4 text-[#20B8AD]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-serif font-bold text-white truncate leading-tight">
                      Smart Appointment Booking
                    </div>
                    <div className="text-[11px] font-serif text-[#EAF5FC] leading-tight mt-0.5 line-clamp-1">
                      Convenient doctor scheduling
                    </div>
                  </div>
                </div>

                {/* Feature 3: AI Health Assistance */}
                <div className="flex items-start gap-2.5 bg-white/10 backdrop-blur-xs p-2 sm:p-2.5 rounded-xl border border-white/15">
                  <div className="w-7 h-7 rounded-lg bg-white/20 text-[#20B8AD] flex items-center justify-center shrink-0 border border-white/20 mt-0.5">
                    <BrainCircuit className="w-4 h-4 text-[#20B8AD]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-serif font-bold text-white truncate leading-tight">
                      AI Health Assistance
                    </div>
                    <div className="text-[11px] font-serif text-[#EAF5FC] leading-tight mt-0.5 line-clamp-1">
                      24/7 intelligent health guidance
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
