import React, { Suspense } from "react";
import { HeroSection } from "@/components/home/HeroSection";
import { HealthcareServicesSection } from "@/components/home/HealthcareServicesSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { FeaturedDoctorsSection } from "@/components/home/FeaturedDoctorsSection";
import { SpecialtiesSection } from "@/components/home/SpecialtiesSection";
import { AIAssistantSection } from "@/components/home/AIAssistantSection";
import { OnlineConsultationSection } from "@/components/home/OnlineConsultationSection";
import { TrustSafetySection } from "@/components/home/TrustSafetySection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { CTASection } from "@/components/home/CTASection";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#EDF5FA]" />}>
      <div className="flex flex-col min-h-screen">
        {/* 1. Immersive Photographic Hero Section */}
        <HeroSection />

        {/* 2. SECTION A: Complete Healthcare Services (6 Core Pillars) */}
        <HealthcareServicesSection />

        {/* 3. SECTION B: How It Works (4-Step Process) */}
        <HowItWorksSection />

        {/* 4. SECTION C: Doctor Discovery (Specialties, Locations & Verified Faculty) */}
        <FeaturedDoctorsSection />

        {/* 5. Clinical Disciplines & Specialties */}
        <SpecialtiesSection />

        {/* 6. SECTION D: AI Healthcare Features (Triage, Guidance & Safety Notice) */}
        <AIAssistantSection />

        {/* 7. Encrypted Telemedicine & Digital Care */}
        <OnlineConsultationSection />

        {/* 8. Clinical Integrity & Governance */}
        <TrustSafetySection />

        {/* 9. Patient Perspectives & Testimonials */}
        <TestimonialsSection />

        {/* 10. SECTION E: Final Healthcare Journey CTA */}
        <CTASection />
      </div>
    </Suspense>
  );
}
