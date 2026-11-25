import React, { Suspense } from "react";
import { DoctorDiscovery } from "@/components/doctors/DoctorDiscovery";

export const metadata = {
  title: "Find Doctors & Specialists — Healthcare",
  description:
    "Discover verified doctors across 10+ specialties. Filter by location, consultation fee, experience, and book online or in-clinic appointments.",
};

export default function DoctorsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-brand-offwhite">
          <div className="text-sm font-semibold text-brand-teal animate-pulse">
            Loading verified doctors...
          </div>
        </div>
      }
    >
      <DoctorDiscovery />
    </Suspense>
  );
}
