"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Doctor } from "@/types";
import { DOCTORS, CITIES } from "@/data/doctors";
import { SPECIALTIES } from "@/data/specialties";
import { DoctorCard } from "@/components/doctors/DoctorCard";
import { Button } from "@/components/ui/Button";
import {
  Search,
  MapPin,
  Filter,
  X,
  SlidersHorizontal,
  RotateCcw,
  Stethoscope,
  Sparkles,
  Loader2,
} from "lucide-react";

export const DoctorDiscovery: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get("q") || "";
  const initialSpecialty = searchParams.get("specialty") || "all";
  const initialCity = searchParams.get("city") || "all";
  const initialType = searchParams.get("type") || "all";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [consultType, setConsultType] = useState<"all" | "online" | "in-person">(initialType as any);
  const [experienceFilter, setExperienceFilter] = useState<number>(0);
  const [maxFeeFilter, setMaxFeeFilter] = useState<number>(2000);
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "experience" | "fee-asc" | "fee-desc">("relevance");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Real Database-loaded Doctors (Strictly Approved & Verified)
  const [dbDoctors, setDbDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApprovedDoctors = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/doctors");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDbDoctors(data);
          return;
        }
      }
      // Fallback only if endpoint returned empty and no error
      setDbDoctors([]);
    } catch (err) {
      console.error("Failed to load approved doctors:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovedDoctors();

    // Re-fetch when user refocuses tab to catch newly approved doctors immediately
    const handleFocus = () => fetchApprovedDoctors();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchApprovedDoctors]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedSpecialty !== "all") count++;
    if (selectedCity !== "all") count++;
    if (consultType !== "all") count++;
    if (experienceFilter > 0) count++;
    if (maxFeeFilter < 2000) count++;
    if (minRatingFilter > 0) count++;
    return count;
  }, [searchQuery, selectedSpecialty, selectedCity, consultType, experienceFilter, maxFeeFilter, minRatingFilter]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedSpecialty("all");
    setSelectedCity("all");
    setConsultType("all");
    setExperienceFilter(0);
    setMaxFeeFilter(2000);
    setMinRatingFilter(0);
    setSortBy("relevance");
    router.replace("/doctors");
  };

  const filteredDoctors = useMemo(() => {
    const listToFilter = dbDoctors;
    return listToFilter.filter((doc) => {
      // SECTION 10 GUARDRAIL: Only verified and approved doctors appear in public discovery
      if (!doc.verified) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.name.toLowerCase().includes(q);
        const matchesSpecialty = doc.specialty.toLowerCase().includes(q);
        const matchesCity = doc.clinic?.city ? doc.clinic.city.toLowerCase().includes(q) : false;
        const matchesExpertise = doc.expertise ? doc.expertise.some((e) => e.toLowerCase().includes(q)) : false;
        if (!matchesName && !matchesSpecialty && !matchesCity && !matchesExpertise) {
          return false;
        }
      }

      if (selectedSpecialty !== "all") {
        if (
          doc.specialty.toLowerCase() !== selectedSpecialty.toLowerCase() &&
          doc.specialtySlug.toLowerCase() !== selectedSpecialty.toLowerCase()
        ) {
          return false;
        }
      }

      if (selectedCity !== "all" && selectedCity !== "All Locations") {
        if (!doc.clinic?.city || doc.clinic.city.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
      }

      if (consultType !== "all") {
        if (!doc.consultationTypes.includes(consultType)) {
          return false;
        }
      }

      if (experienceFilter > 0 && doc.experienceYears < experienceFilter) {
        return false;
      }

      if (doc.consultationFee > maxFeeFilter) {
        return false;
      }

      if (minRatingFilter > 0 && doc.rating < minRatingFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "experience") return b.experienceYears - a.experienceYears;
      if (sortBy === "fee-asc") return a.consultationFee - b.consultationFee;
      if (sortBy === "fee-desc") return b.consultationFee - a.consultationFee;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }, [
    dbDoctors,
    searchQuery,
    selectedSpecialty,
    selectedCity,
    consultType,
    experienceFilter,
    maxFeeFilter,
    minRatingFilter,
    sortBy,
  ]);

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Directory Title Header */}
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-serif font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
            <Stethoscope className="w-4 h-4" />
            <span>Physician Directory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal text-[#163B63] tracking-tight">
            Discover Verified Medical Specialists
          </h1>
          <p className="text-sm sm:text-base font-serif text-[#526A82] max-w-2xl font-light">
            Search vetted practitioners across 10 core clinical disciplines. Filter by location, consultation fee, experience, and format.
          </p>
        </div>

        {/* Global Search & Location Bar */}
        <div className="mb-10 p-3 bg-white rounded-3xl border border-[#D5E4EF] shadow-subtle flex flex-col md:flex-row gap-3 items-center">
          {/* City selector */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b md:border-b-0 md:border-r border-[#D5E4EF] w-full md:w-60 shrink-0">
            <MapPin className="w-4 h-4 text-[#258FE5] shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-transparent text-sm text-[#0F172A] focus:outline-none cursor-pointer"
            >
              <option value="all">All Locations</option>
              {CITIES.filter((c) => c !== "All Locations").map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Search */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 flex-1 w-full">
            <Search className="w-4 h-4 text-[#526A82] shrink-0" />
            <input
              type="text"
              placeholder="Search by doctor name, specialty, symptom or clinic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 rounded-full text-[#526A82] hover:bg-[#F1F5F9]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle & Clear */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-between md:justify-end px-2">
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#D5E4EF] bg-[#FFFFFF] text-xs font-semibold text-[#163B63]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#258FE5]" />
              <span>Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}</span>
            </button>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-[#526A82] hover:text-rose-700"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* 2-Column Layout: Sidebar Filters + Doctor Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Filter Sidebar */}
          <aside
            className={`lg:col-span-4 xl:col-span-3 rounded-3xl bg-white border border-[#D5E4EF] p-6 shadow-subtle space-y-6 ${
              mobileFilterOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-[#D5E4EF]">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#258FE5]" />
                <h3 className="text-xs font-bold text-[#163B63] uppercase tracking-wider">
                  Filter Criteria
                </h3>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-[#258FE5] hover:underline font-semibold"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Filter 1: Consultation Mode */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#163B63] uppercase tracking-wider block">
                Consultation Format
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "All", value: "all" },
                  { label: "Online", value: "online" },
                  { label: "In-Clinic", value: "in-person" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setConsultType(item.value as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                      consultType === item.value
                        ? "bg-[#258FE5] text-white border-[#258FE5] font-semibold"
                        : "bg-white text-[#526A82] border-[#D5E4EF] hover:border-[#D5E4EF]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 2: Specialty */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#163B63] uppercase tracking-wider block">
                Specialty
              </label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full h-10 rounded-xl border border-[#D5E4EF] bg-[#FFFFFF] px-3 text-xs text-[#0F172A] focus:outline-none focus:border-[#258FE5]"
              >
                <option value="all">All Specialties</option>
                {SPECIALTIES.map((spec) => (
                  <option key={spec.id} value={spec.name}>
                    {spec.name} ({spec.doctorCount})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Experience */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px]">
                  Clinical Experience
                </label>
                <span className="font-semibold text-[#258FE5]">
                  {experienceFilter > 0 ? `${experienceFilter}+ Years` : "Any"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[0, 10, 15, 20].map((exp) => (
                  <button
                    key={exp}
                    type="button"
                    onClick={() => setExperienceFilter(exp)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                      experienceFilter === exp
                        ? "bg-[#258FE5] text-white border-[#258FE5]"
                        : "bg-white text-[#526A82] border-[#D5E4EF] hover:border-[#D5E4EF]"
                    }`}
                  >
                    {exp === 0 ? "All" : `${exp}+y`}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter 4: Max Consultation Fee Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-[#163B63] uppercase tracking-wider text-[11px]">
                  Max Fee
                </label>
                <span className="font-semibold text-[#258FE5]">
                  ₹{maxFeeFilter}
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="2000"
                step="100"
                value={maxFeeFilter}
                onChange={(e) => setMaxFeeFilter(Number(e.target.value))}
                className="w-full accent-[#258FE5] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#94A3B8]">
                <span>₹500</span>
                <span>₹1,200</span>
                <span>₹2,000</span>
              </div>
            </div>

            {/* Filter 5: Patient Rating */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[#163B63] uppercase tracking-wider block">
                Minimum Rating
              </label>
              <div className="flex gap-1.5">
                {[
                  { label: "All", val: 0 },
                  { label: "★ 4.8+", val: 4.8 },
                  { label: "★ 4.9+", val: 4.9 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setMinRatingFilter(item.val)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                      minRatingFilter === item.val
                        ? "bg-[#258FE5] text-white border-[#258FE5]"
                        : "bg-white text-[#526A82] border-[#D5E4EF] hover:border-[#D5E4EF]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile close button */}
            <div className="pt-2 lg:hidden">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setMobileFilterOpen(false)}
              >
                Apply Criteria
              </Button>
            </div>
          </aside>

          {/* Results Main Area */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Results top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-[#D5E4EF] shadow-subtle">
              <div className="text-xs sm:text-sm font-medium text-[#0F172A]">
                Showing <strong className="text-[#258FE5] font-semibold">{filteredDoctors.length}</strong> available physicians
                {selectedSpecialty !== "all" && <span> for <em>{selectedSpecialty}</em></span>}
                {selectedCity !== "all" && selectedCity !== "All Locations" && <span> in <em>{selectedCity}</em></span>}
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#526A82] font-medium shrink-0">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#FFFFFF] border border-[#D5E4EF] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#163B63] focus:outline-none focus:border-[#258FE5] cursor-pointer"
                >
                  <option value="relevance">Relevance & Distinction</option>
                  <option value="rating">Highest Rated</option>
                  <option value="experience">Years of Experience</option>
                  <option value="fee-asc">Consultation Fee (Low to High)</option>
                  <option value="fee-desc">Consultation Fee (High to Low)</option>
                </select>
              </div>
            </div>

            {/* Doctor Cards Grid */}
            {isLoading ? (
              <div className="bg-white rounded-3xl border border-[#D5E4EF] p-16 text-center space-y-4">
                <Loader2 className="w-8 h-8 text-[#258FE5] animate-spin mx-auto" />
                <p className="text-xs sm:text-sm text-[#526A82]">Loading verified physicians from database...</p>
              </div>
            ) : filteredDoctors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-[#D5E4EF] p-14 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center mx-auto">
                  <Search className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-serif font-normal text-[#163B63]">
                    No matching physicians found
                  </h3>
                  <p className="text-xs sm:text-sm text-[#526A82] max-w-md mx-auto mt-1.5 font-light">
                    Adjust your location selector, expand the fee range, or reset your search criteria.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleClearFilters}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
