"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  MapPin,
  Heart,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Crosshair,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Activity,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PatientProfileData {
  id?: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  age?: number | null;
  age_formatted?: string | null;
  gender: string;
  preferred_language: string;
  country: string;
  state: string;
  city: string;
  locality: string;
  street_address: string;
  house_flat: string;
  landmark: string;
  postal_code: string;
  address: string;
  home_latitude?: number | null;
  home_longitude?: number | null;
  blood_group: string;
  allergies: string[];
  medical_history: string[];
  current_medications: string[];
  previous_surgeries: string[];
  emergency_contact_name: string;
  emergency_contact_phone: string;
  profile_completed?: boolean;
  completion_percentage?: number;
}

const COMMON_ALLERGIES = [
  "Penicillin",
  "Sulfa Drugs",
  "Aspirin / NSAIDs",
  "Peanuts",
  "Shellfish",
  "Latex",
  "Dust Mites",
  "Pollen"
];

const COMMON_CONDITIONS = [
  "Hypertension (High BP)",
  "Type 2 Diabetes",
  "Asthma / Bronchitis",
  "Hypothyroidism",
  "High Cholesterol",
  "Migraine",
  "Acid Reflux / GERD",
  "Heart Disease"
];

export default function PatientProfilePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [gpsDetecting, setGpsDetecting] = useState<boolean>(false);
  const [gpsSuccess, setGpsSuccess] = useState<string | null>(null);

  const [localityQuery, setLocalityQuery] = useState<string>("");
  const [localitySuggestions, setLocalitySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Custom tag inputs
  const [customAllergy, setCustomAllergy] = useState<string>("");
  const [customCondition, setCustomCondition] = useState<string>("");
  const [customMedication, setCustomMedication] = useState<string>("");
  const [customSurgery, setCustomSurgery] = useState<string>("");

  const [profile, setProfile] = useState<PatientProfileData>({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "Male",
    preferred_language: "English",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    locality: "Velachery",
    street_address: "",
    house_flat: "",
    landmark: "",
    postal_code: "600042",
    address: "",
    home_latitude: 12.9815,
    home_longitude: 80.2180,
    blood_group: "O+",
    allergies: [],
    medical_history: [],
    current_medications: [],
    previous_surgeries: [],
    emergency_contact_name: "",
    emergency_contact_phone: ""
  });

  // Calculate age helper
  const calculateAge = (dobString: string): string => {
    if (!dobString) return "";
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return "";
    const today = new Date();
    let ageYears = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      ageYears--;
    }
    if (ageYears >= 1) {
      return `${ageYears} Years`;
    }
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
    return `${Math.max(1, months)} Months`;
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/patient/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => ({
          ...prev,
          ...data,
          allergies: Array.isArray(data.allergies) ? data.allergies : [],
          medical_history: Array.isArray(data.medical_history) ? data.medical_history : [],
          current_medications: Array.isArray(data.current_medications) ? data.current_medications : [],
          previous_surgeries: Array.isArray(data.previous_surgeries) ? data.previous_surgeries : []
        }));
        if (data.locality) {
          setLocalityQuery(data.locality);
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Autocomplete locality search
  const handleLocalityChange = async (val: string) => {
    setLocalityQuery(val);
    setProfile((p) => ({ ...p, locality: val }));
    if (val.length >= 2) {
      try {
        const res = await fetch(`/api/location/geocode?q=${encodeURIComponent(val)}&city=${encodeURIComponent(profile.city || "Chennai")}`);
        if (res.ok) {
          const data = await res.json();
          setLocalitySuggestions(data.results || []);
          setShowSuggestions(true);
        }
      } catch (e) {}
    } else {
      setLocalitySuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectLocality = (item: any) => {
    setProfile((p) => ({
      ...p,
      locality: item.name,
      city: item.city,
      state: item.state,
      home_latitude: item.lat,
      home_longitude: item.lng
    }));
    setLocalityQuery(item.name);
    setShowSuggestions(false);
    setGpsSuccess(`Selected: ${item.formatted} (${item.lat.toFixed(4)}, ${item.lng.toFixed(4)})`);
  };

  // Browser Geolocation Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setGpsDetecting(true);
    setGpsSuccess(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setProfile((p) => ({
          ...p,
          home_latitude: lat,
          home_longitude: lng
        }));
        setGpsDetecting(false);
        setGpsSuccess(`GPS Location Acquired: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      (err) => {
        setGpsDetecting(false);
        // Fallback gracefully to default coordinates
        setProfile((p) => ({
          ...p,
          home_latitude: 12.9815,
          home_longitude: 80.2180,
          locality: p.locality || "Velachery"
        }));
        setGpsSuccess("Using locality coordinates: Velachery, Chennai (12.9815, 80.2180)");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Tag Helpers
  const toggleArrayItem = (field: "allergies" | "medical_history", item: string) => {
    setProfile((p) => {
      const current = p[field];
      if (current.includes(item)) {
        return { ...p, [field]: current.filter((x) => x !== item) };
      } else {
        return { ...p, [field]: [...current, item] };
      }
    });
  };

  const addCustomItem = (field: "allergies" | "medical_history" | "current_medications" | "previous_surgeries", val: string, clearFn: () => void) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setProfile((p) => {
      if (p[field].includes(trimmed)) return p;
      return { ...p, [field]: [...p[field], trimmed] };
    });
    clearFn();
  };

  const removeItem = (field: "allergies" | "medical_history" | "current_medications" | "previous_surgeries", idx: number) => {
    setProfile((p) => ({
      ...p,
      [field]: p[field].filter((_, i) => i !== idx)
    }));
  };

  // Submit profile to API
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/patient/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          router.push("/patient/dashboard");
        }, 1500);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to save profile. Please check the fields.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const ageCalculated = calculateAge(profile.date_of_birth);

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-10 lg:py-14 text-left font-serif">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-7 sm:p-8 rounded-[32px] border border-[#D5E4EF] shadow-subtle">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
                Patient Health Profile
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#20B8AD]/20 text-[#258FE5] font-semibold border border-[#20B8AD]/40">
                Encrypted & HIPAA Compliant
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63] mt-1">
              {profile.full_name ? `${profile.full_name}'s Medical Profile` : "Complete Your Health Profile"}
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-light">
              Your comprehensive demographic, geographic, and clinical profile ensures accurate AI assessments and nearby doctor matches.
            </p>
          </div>

          <Link href="/patient/dashboard">
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Progress Stepper */}
        <div className="bg-white p-6 rounded-3xl border border-[#D5E4EF] shadow-subtle">
          <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
            {[
              { num: 1, title: "Personal Info", desc: "Demographics & DOB" },
              { num: 2, title: "Address & GPS", desc: "Locality & Coordinates" },
              { num: 3, title: "Clinical History", desc: "Allergies & Conditions" },
              { num: 4, title: "Review & Save", desc: "Confirmation" }
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={`p-3 rounded-2xl transition-all text-left sm:text-center ${
                    isActive
                      ? "bg-[#258FE5] text-white shadow-md"
                      : isPast
                      ? "bg-[#F5F9FC] text-[#258FE5] border border-[#20B8AD]/40"
                      : "bg-[#F5F9FC] text-[#94A3B8] border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive ? "bg-white text-[#258FE5]" : isPast ? "bg-[#258FE5] text-white" : "bg-[#DCE6EF] text-[#526A82]"
                    }`}>
                      {isPast ? "✓" : step.num}
                    </span>
                  </div>
                  <div className="text-xs font-semibold truncate">{step.title}</div>
                  <div className="hidden sm:block text-[10px] opacity-80 truncate">{step.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white p-7 sm:p-9 rounded-[32px] border border-[#D5E4EF] shadow-subtle">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#526A82]">Loading your health profile...</p>
            </div>
          ) : (
            <div>
              {/* STEP 1: PERSONAL & DEMOGRAPHIC INFO */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="border-b border-[#D5E4EF] pb-4">
                    <h2 className="text-lg font-serif font-normal text-[#163B63]">Personal & Demographic Information</h2>
                    <p className="text-xs text-[#526A82]">Accurate date of birth automatically calculates exact age for clinical dosing and pediatric checks.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Full Name *</label>
                      <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="e.g. Ramesh Krishnan"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        placeholder="patient@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Phone Number *</label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="+91 98401 23456"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Date of Birth *</label>
                      <input
                        type="date"
                        value={profile.date_of_birth}
                        onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                      {ageCalculated && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#258FE5] bg-[#F5F9FC] px-2.5 py-1 rounded-lg">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Calculated Age: <strong>{ageCalculated}</strong></span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Gender *</label>
                      <select
                        value={profile.gender}
                        onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Blood Group *</label>
                      <select
                        value={profile.blood_group}
                        onChange={(e) => setProfile({ ...profile, blood_group: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      >
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Preferred Language</label>
                      <select
                        value={profile.preferred_language}
                        onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      >
                        <option value="English">English</option>
                        <option value="Tamil">Tamil</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Malayalam">Malayalam</option>
                        <option value="Kannada">Kannada</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      variant="primary"
                      size="md"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      className="bg-[#258FE5] hover:bg-[#163B63]"
                      onClick={() => setCurrentStep(2)}
                    >
                      Continue to Address & GPS
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: ADDRESS & GEOLOCATION */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="border-b border-[#D5E4EF] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-serif font-normal text-[#163B63]">Address & Geolocation Discovery</h2>
                      <p className="text-xs text-[#526A82]">Coordinates are used to discover nearest verified doctors via Haversine distance.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      disabled={gpsDetecting}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#258FE5] text-white text-xs font-semibold hover:bg-[#163B63] transition-colors shadow-sm shrink-0"
                    >
                      <Crosshair className={`w-4 h-4 ${gpsDetecting ? "animate-spin" : ""}`} />
                      {gpsDetecting ? "Detecting GPS..." : "Use Current Location"}
                    </button>
                  </div>

                  {gpsSuccess && (
                    <div className="p-3 rounded-xl bg-[#EAF5FC] border border-[#D5E4EF] text-xs text-[#163B63] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
                      <span>{gpsSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Locality with Autocomplete */}
                    <div className="relative sm:col-span-2">
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Locality / Area Name * (e.g. Velachery, Adyar, Greams Road)</label>
                      <input
                        type="text"
                        value={localityQuery}
                        onChange={(e) => handleLocalityChange(e.target.value)}
                        onFocus={() => { if (localitySuggestions.length > 0) setShowSuggestions(true); }}
                        placeholder="Search locality (e.g. Velachery, Anna Nagar, Adyar, T. Nagar...)"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />

                      {showSuggestions && localitySuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-[#CBD5E1] shadow-lg max-h-56 overflow-y-auto">
                          {localitySuggestions.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => selectLocality(item)}
                              className="w-full px-4 py-2 text-left text-xs hover:bg-[#F5F9FC] flex items-center justify-between border-b last:border-0 border-[#F5F9FC]"
                            >
                              <div className="font-medium text-[#163B63] flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#258FE5]" />
                                {item.formatted}
                              </div>
                              <span className="text-[10px] text-[#526A82]">
                                {item.lat.toFixed(2)}, {item.lng.toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">House / Flat / Block No.</label>
                      <input
                        type="text"
                        value={profile.house_flat}
                        onChange={(e) => setProfile({ ...profile, house_flat: e.target.value })}
                        placeholder="e.g. Flat 302, Green Meadows"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Street Address / Road</label>
                      <input
                        type="text"
                        value={profile.street_address}
                        onChange={(e) => setProfile({ ...profile, street_address: e.target.value })}
                        placeholder="e.g. 45 Bypass Road"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Landmark</label>
                      <input
                        type="text"
                        value={profile.landmark}
                        onChange={(e) => setProfile({ ...profile, landmark: e.target.value })}
                        placeholder="e.g. Opposite Phoenix Marketcity"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">City *</label>
                      <input
                        type="text"
                        value={profile.city}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                        placeholder="Chennai"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">State *</label>
                      <input
                        type="text"
                        value={profile.state}
                        onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                        placeholder="Tamil Nadu"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#163B63] mb-1.5">Postal Code (PIN)</label>
                      <input
                        type="text"
                        value={profile.postal_code}
                        onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
                        placeholder="600042"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                      />
                    </div>

                    {/* Coordinates Readout */}
                    <div className="sm:col-span-2 p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#258FE5] font-medium">
                        <MapPin className="w-4 h-4" />
                        <span>Active Search Center: <strong>{profile.locality || profile.city}</strong></span>
                      </div>
                      <span className="text-[#526A82] font-mono text-[11px]">
                        Lat: {profile.home_latitude?.toFixed(4) || "12.9815"} • Lng: {profile.home_longitude?.toFixed(4) || "80.2180"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <Button variant="ghost" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      className="bg-[#258FE5] hover:bg-[#163B63]"
                      onClick={() => setCurrentStep(3)}
                    >
                      Continue to Clinical History
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: CLINICAL HEALTH & EMERGENCY INFORMATION */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="border-b border-[#D5E4EF] pb-4">
                    <h2 className="text-lg font-serif font-normal text-[#163B63]">Clinical Health & Emergency Information</h2>
                    <p className="text-xs text-[#526A82]">Pre-existing conditions, drug allergies, and emergency contacts are shared safely with consulting physicians.</p>
                  </div>

                  {/* Documented Allergies */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[#163B63]">Documented Drug / Food Allergies</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COMMON_ALLERGIES.map((alg) => {
                        const isSelected = profile.allergies.includes(alg);
                        return (
                          <button
                            key={alg}
                            type="button"
                            onClick={() => toggleArrayItem("allergies", alg)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-[#F5F9FC] text-[#526A82] border border-[#D5E4EF] hover:border-[#CBD5E1]"
                            }`}
                          >
                            {isSelected ? "✕ " : "+ "} {alg}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Allergy input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customAllergy}
                        onChange={(e) => setCustomAllergy(e.target.value)}
                        placeholder="Add other allergy (e.g. Amoxicillin, Ibuprofen)"
                        className="flex-1 px-4 py-2 rounded-xl border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomItem("allergies", customAllergy, () => setCustomAllergy(""));
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addCustomItem("allergies", customAllergy, () => setCustomAllergy(""))}
                        className="text-xs"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Medical History */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-medium text-[#163B63]">Pre-Existing Conditions / Chronic History</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COMMON_CONDITIONS.map((cond) => {
                        const isSelected = profile.medical_history.includes(cond);
                        return (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => toggleArrayItem("medical_history", cond)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-[#258FE5] text-white border border-[#163B63]"
                                : "bg-[#F5F9FC] text-[#526A82] border border-[#D5E4EF] hover:border-[#CBD5E1]"
                            }`}
                          >
                            {isSelected ? "✓ " : "+ "} {cond}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customCondition}
                        onChange={(e) => setCustomCondition(e.target.value)}
                        placeholder="Add other condition (e.g. Fatty Liver, PCOD)"
                        className="flex-1 px-4 py-2 rounded-xl border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomItem("medical_history", customCondition, () => setCustomCondition(""));
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addCustomItem("medical_history", customCondition, () => setCustomCondition(""))}
                        className="text-xs"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Current Medications */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-medium text-[#163B63]">Current Medications (Dosage & Name)</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {profile.current_medications.map((med, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200">
                          {med}
                          <button type="button" onClick={() => removeItem("current_medications", i)} className="hover:text-blue-900">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customMedication}
                        onChange={(e) => setCustomMedication(e.target.value)}
                        placeholder="e.g. Metformin 500mg twice daily, Telmisartan 40mg"
                        className="flex-1 px-4 py-2 rounded-xl border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomItem("current_medications", customMedication, () => setCustomMedication(""));
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addCustomItem("current_medications", customMedication, () => setCustomMedication(""))}
                        className="text-xs"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="pt-4 border-t border-[#D5E4EF] space-y-4">
                    <h3 className="text-sm font-semibold text-[#163B63]">Emergency Contact Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#163B63] mb-1.5">Contact Person Name</label>
                        <input
                          type="text"
                          value={profile.emergency_contact_name}
                          onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                          placeholder="e.g. Priya Krishnan (Spouse)"
                          className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#163B63] mb-1.5">Emergency Contact Phone Number</label>
                        <input
                          type="tel"
                          value={profile.emergency_contact_phone}
                          onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                          placeholder="+91 98401 99999"
                          className="w-full px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <Button variant="ghost" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(2)}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      className="bg-[#258FE5] hover:bg-[#163B63]"
                      onClick={() => setCurrentStep(4)}
                    >
                      Review Health Profile
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & SAVE */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="border-b border-[#D5E4EF] pb-4">
                    <h2 className="text-lg font-serif font-normal text-[#163B63]">Review & Save Your Profile</h2>
                    <p className="text-xs text-[#526A82]">Please verify your health information before saving. You can edit this anytime from your dashboard.</p>
                  </div>

                  {errorMessage && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="p-4 rounded-2xl bg-[#EAF5FC] border border-[#D5E4EF] text-xs text-[#163B63] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
                      <span>Health profile successfully saved! Redirecting to dashboard...</span>
                    </div>
                  )}

                  {/* Summary Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Personal Summary */}
                    <div className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#258FE5]">
                        <User className="w-4 h-4" /> Personal Demographics
                      </div>
                      <div className="text-sm font-semibold text-[#163B63]">{profile.full_name || "Not specified"}</div>
                      <div className="text-xs text-[#526A82] space-y-1">
                        <div>DOB: {profile.date_of_birth} ({ageCalculated || "Age not set"})</div>
                        <div>Gender: {profile.gender} • Blood Group: <strong className="text-[#163B63]">{profile.blood_group}</strong></div>
                        <div>Phone: {profile.phone}</div>
                        <div>Email: {profile.email}</div>
                      </div>
                    </div>

                    {/* Location Summary */}
                    <div className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#258FE5]">
                        <MapPin className="w-4 h-4" /> Locality & Geocoded Coordinates
                      </div>
                      <div className="text-sm font-semibold text-[#163B63]">{profile.locality || profile.city}, {profile.state}</div>
                      <div className="text-xs text-[#526A82] space-y-1">
                        <div>Address: {[profile.house_flat, profile.street_address, profile.landmark].filter(Boolean).join(", ") || "Standard locality address"}</div>
                        <div>PIN: {profile.postal_code || "600042"}</div>
                        <div className="font-mono text-[11px] text-[#258FE5] bg-white p-1.5 rounded-lg border border-[#D5E4EF] inline-block">
                          GPS: {profile.home_latitude?.toFixed(4) || "12.9815"}, {profile.home_longitude?.toFixed(4) || "80.2180"}
                        </div>
                      </div>
                    </div>

                    {/* Clinical Summary */}
                    <div className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#258FE5]">
                        <Heart className="w-4 h-4" /> Clinical Background
                      </div>
                      <div className="text-xs text-[#526A82] space-y-2">
                        <div>
                          <strong className="text-[#163B63]">Allergies: </strong>
                          {profile.allergies.length > 0 ? (
                            <span className="text-rose-700 font-semibold">{profile.allergies.join(", ")}</span>
                          ) : (
                            "None reported"
                          )}
                        </div>
                        <div>
                          <strong className="text-[#163B63]">Chronic Conditions: </strong>
                          {profile.medical_history.length > 0 ? profile.medical_history.join(", ") : "None reported"}
                        </div>
                        <div>
                          <strong className="text-[#163B63]">Current Medications: </strong>
                          {profile.current_medications.length > 0 ? profile.current_medications.join(", ") : "None reported"}
                        </div>
                      </div>
                    </div>

                    {/* Emergency Summary */}
                    <div className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#258FE5]">
                        <ShieldCheck className="w-4 h-4" /> Emergency Contact
                      </div>
                      <div className="text-sm font-semibold text-[#163B63]">
                        {profile.emergency_contact_name || "Emergency contact not specified"}
                      </div>
                      <div className="text-xs text-[#526A82]">
                        Phone: {profile.emergency_contact_phone || "Not specified"}
                      </div>
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                        Emergency Helpline: <strong>112 (India)</strong> is available 24/7 for critical medical emergencies.
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <Button variant="ghost" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => setCurrentStep(3)}>
                      Back to Edit
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      leftIcon={<Save className="w-4 h-4" />}
                      className="bg-[#258FE5] hover:bg-[#163B63]"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving Profile..." : "Save Patient Health Profile"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
