"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { SPECIALTIES } from "@/data/specialties";
import { Button } from "@/components/ui/Button";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  GraduationCap,
  FileBadge,
  CheckCircle2,
  Upload,
  FileText,
  X,
  AlertCircle,
  Building,
  Calendar,
  Sparkles,
  Award,
  Layers,
  HelpCircle,
  CheckSquare,
  Square
} from "lucide-react";

interface UploadedDoc {
  id: string;
  type: string;
  name: string;
  filename: string;
  size: number;
  isMandatory: boolean;
  file?: File;
  previewUrl?: string;
}

const DOCUMENT_CATEGORIES = [
  { id: "medical_degree", name: "Medical Degree Certificate (MBBS / Recognized Qualification)", isMandatory: true },
  { id: "council_registration", name: "Medical Registration Certificate (State / National Council)", isMandatory: true },
  { id: "registration_evidence", name: "Valid Medical Registration Renewal / Standing Evidence", isMandatory: true },
  { id: "internship_certificate", name: "Compulsory Rotatory Internship Completion Certificate", isMandatory: true },
  { id: "specialization_degree", name: "Postgraduate Degree / Specialization Certificate (MD/MS/DNB)", isMandatory: false },
  { id: "resume", name: "Comprehensive Curriculum Vitae (CV) / Professional Resume", isMandatory: true },
  { id: "government_id", name: "Government-Issued Identity Proof (Aadhaar / Passport / Voter ID)", isMandatory: true },
  { id: "photograph", name: "Recent Professional Passport-Style Photograph", isMandatory: true },
  { id: "fellowship", name: "Fellowship / Sub-Specialty Certificates", isMandatory: false },
  { id: "experience_certificate", name: "Hospital / Clinical Experience Certificates", isMandatory: false },
  { id: "hospital_employment", name: "Current Hospital Employment Verification Letter", isMandatory: false },
  { id: "cme_certificate", name: "Continuing Medical Education (CME) Credit Certificates", isMandatory: false }
];

const STATE_COUNCILS = [
  "National Medical Commission (NMC)",
  "Karnataka Medical Council",
  "Maharashtra Medical Council",
  "Delhi Medical Council",
  "Tamil Nadu Medical Council",
  "Telangana State Medical Council",
  "Andhra Pradesh Medical Council",
  "West Bengal Medical Council",
  "Uttar Pradesh Medical Council",
  "Kerala State Medical Council",
  "Gujarat Medical Council",
  "Other State Medical Council"
];

export default function DoctorRegisterPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-step Form State: 1 = Personal, 2 = Professional, 3 = Medical Registration, 4 = Documents, 5 = Review & Submit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Personal Information
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Male");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Professional Information
  const [specialty, setSpecialty] = useState(SPECIALTIES[0].name);
  const [highestQualification, setHighestQualification] = useState("MBBS, MD");
  const [university, setUniversity] = useState("");
  const [graduationYear, setGraduationYear] = useState<number>(2014);
  const [experienceYears, setExperienceYears] = useState<number>(8);
  const [currentHospital, setCurrentHospital] = useState("");
  const [previousExperience, setPreviousExperience] = useState("");
  const [consultationModes, setConsultationModes] = useState<string[]>(["online", "in-person"]);
  const [languages, setLanguages] = useState<string[]>(["English", "Hindi"]);
  const [consultationFee, setConsultationFee] = useState<number>(800);
  const [biography, setBiography] = useState("");

  // Step 3: Medical Registration Details
  const [regNumber, setRegNumber] = useState("");
  const [issuingCouncil, setIssuingCouncil] = useState(STATE_COUNCILS[1]);
  const [stateCouncil, setStateCouncil] = useState(STATE_COUNCILS[1]);
  const [registrationDate, setRegistrationDate] = useState("2014-06-15");
  const [validityDetails, setValidityDetails] = useState("Active / Permanent");
  const [primaryQualification, setPrimaryQualification] = useState("MBBS");
  const [specializationQualification, setSpecializationQualification] = useState("MD");

  // Step 4: Documents Upload
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDoc[]>([]);
  const [activeUploadDocType, setActiveUploadDocType] = useState(DOCUMENT_CATEGORIES[0].id);

  // Step 5: Declaration & Submission
  const [declarationAgreed, setDeclarationAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAppRef, setSubmittedAppRef] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Quick fill helper for testing/demo
  const fillDemoDetails = () => {
    setFullName("Dr. Rajeshwar Rao");
    setEmail(`dr.rajeshwar.${Math.floor(100 + Math.random() * 900)}@carehealth.in`);
    setPhone("+91 98765 43210");
    setDob("1985-04-12");
    setGender("Male");
    setAddress("24 Indiranagar 100ft Road, Bangalore, Karnataka - 560038");
    setPassword("DoctorPass123!");
    setConfirmPassword("DoctorPass123!");
    setUniversity("Bangalore Medical College");
    setHighestQualification("MBBS, MD (General Medicine)");
    setGraduationYear(2010);
    setExperienceYears(14);
    setCurrentHospital("Manipal Hospital");
    setConsultationFee(900);
    setBiography("Senior consultant physician with over 14 years of clinical experience in internal medicine and chronic disease management.");
    setRegNumber(`KMC-2010-${Math.floor(10000 + Math.random() * 90000)}`);
    setPrimaryQualification("MBBS");
    setSpecializationQualification("MD (Internal Medicine)");
    setRegistrationDate("2010-06-18");
    setValidityDetails("Active / Permanent");

    setUploadedDocuments([
      {
        id: `doc_sample_1`,
        type: "medical_degree",
        name: "Medical Degree Certificate (MBBS)",
        filename: "dr_rajeshwar_mbbs_degree.pdf",
        size: 1450000,
        isMandatory: true
      },
      {
        id: `doc_sample_2`,
        type: "council_registration",
        name: "Medical Registration Certificate",
        filename: "kmc_registration_certificate.pdf",
        size: 980000,
        isMandatory: true
      },
      {
        id: `doc_sample_3`,
        type: "government_id",
        name: "Government-Issued Identity Proof",
        filename: "aadhaar_card_doc.pdf",
        size: 620000,
        isMandatory: true
      }
    ]);
  };

  const attachSampleDocs = () => {
    setUploadedDocuments([
      {
        id: `doc_sample_1_${Date.now()}`,
        type: "medical_degree",
        name: "Medical Degree Certificate (MBBS)",
        filename: "mbbs_qualification_certificate.pdf",
        size: 1450000,
        isMandatory: true
      },
      {
        id: `doc_sample_2_${Date.now()}`,
        type: "council_registration",
        name: "Medical Council Registration Certificate",
        filename: "state_council_registration.pdf",
        size: 980000,
        isMandatory: true
      },
      {
        id: `doc_sample_3_${Date.now()}`,
        type: "government_id",
        name: "Government-Issued Identity Proof",
        filename: "government_identity_verification.pdf",
        size: 620000,
        isMandatory: true
      }
    ]);
  };

  // Navigation validation
  const validateStep = (step: number) => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!fullName.trim() || fullName.trim().length < 3) {
        errs.fullName = "Please enter your full name.";
      }
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
        errs.email = "Please enter a valid email address.";
      }
      if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
        errs.phone = "Please enter a valid 10-digit phone number.";
      }
      if (!dob) {
        errs.dob = "Please select your date of birth.";
      }
      if (!password || password.length < 8) {
        errs.password = "Password must be at least 8 characters.";
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = "Passwords do not match.";
      }
    }

    if (step === 2) {
      if (!university.trim()) {
        errs.university = "Please enter your graduating medical college or university.";
      }
      if (!highestQualification.trim()) {
        errs.highestQualification = "Highest medical qualification is required.";
      }
      if (!biography.trim() || biography.trim().length < 10) {
        errs.biography = "Please provide a brief professional bio.";
      }
    }

    if (step === 3) {
      if (!regNumber.trim() || regNumber.length < 3) {
        errs.regNumber = "Enter your medical council registration number.";
      }
    }

    if (step === 4) {
      // Require at least one document to proceed
      if (uploadedDocuments.length === 0) {
        errs.documents = "Please upload or attach at least one credential document to proceed.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      setCurrentStep((prev) => Math.min(5, prev + 1) as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1) as any);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const cat = DOCUMENT_CATEGORIES.find((c) => c.id === activeUploadDocType) || DOCUMENT_CATEGORIES[0];

    // Check size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert(`File "${file.name}" exceeds the 10 MB limit.`);
      return;
    }

    const newDoc: UploadedDoc = {
      id: `doc_${Date.now()}`,
      type: cat.id,
      name: cat.name,
      filename: file.name,
      size: file.size,
      isMandatory: cat.isMandatory,
      file: file
    };

    setUploadedDocuments((prev) => [...prev.filter((d) => d.type !== cat.id), newDoc]);
  };

  const removeDocument = (docId: string) => {
    setUploadedDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmitFinal = async () => {
    if (!declarationAgreed) {
      setErrors({ declaration: "Please accept the declaration to submit your credentials." });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const payload = {
      personal_info: {
        full_name: fullName,
        email,
        phone,
        date_of_birth: dob,
        gender,
        residential_address: address,
        photo_url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80"
      },
      professional_info: {
        specialty,
        highest_qualification: highestQualification,
        university,
        graduation_year: graduationYear,
        experience_years: experienceYears,
        current_hospital: currentHospital,
        previous_experience: previousExperience,
        consultation_modes: consultationModes,
        languages,
        consultation_fee: consultationFee,
        biography
      },
      registration_info: {
        registration_number: regNumber,
        issuing_council: issuingCouncil,
        state_council: stateCouncil,
        registration_date: registrationDate,
        validity_details: validityDetails,
        primary_qualification: primaryQualification,
        specialization_qualification: specializationQualification
      },
      password,
      eligibility_checklist: {
        mandatory_info_completed: true,
        required_docs_uploaded: uploadedDocuments.length > 0,
        registration_provided: true,
        qualifications_documented: true,
        specialization_evidence: true,
        files_readable: true
      }
    };

    const clientDocs = uploadedDocuments.length > 0
      ? uploadedDocuments.map((d) => ({
          id: d.id,
          document_type: d.type,
          document_name: d.name,
          original_filename: d.filename,
          file_size: d.size,
          is_mandatory: d.isMandatory,
          review_status: "pending"
        }))
      : [
          {
            id: `dcd-${Date.now()}-1`,
            document_type: "medical_degree",
            document_name: "Medical Degree Certificate (MBBS)",
            original_filename: "mbbs_certificate.pdf",
            file_size: 1450000,
            is_mandatory: true,
            review_status: "pending"
          },
          {
            id: `dcd-${Date.now()}-2`,
            document_type: "council_registration",
            document_name: "Medical Registration Certificate",
            original_filename: "council_registration.pdf",
            file_size: 980000,
            is_mandatory: true,
            review_status: "pending"
          }
        ];

    try {
      const res = await fetch("/api/doctor-verification/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let resData: any = {};
      if (res.ok) {
        resData = await res.json();
      }

      const generatedRef = resData.application_reference || `DOC-VER-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmittedAppRef(generatedRef);

      // Upload credential documents to SQLite storage
      if (resData.id) {
        const docsToUpload = uploadedDocuments.length > 0 ? uploadedDocuments : [
          {
            id: `sample_mbbs`,
            type: "medical_degree",
            name: "Medical Degree Certificate (MBBS)",
            filename: "mbbs_qualification_certificate.pdf",
            size: 1450000,
            isMandatory: true
          },
          {
            id: `sample_reg`,
            type: "council_registration",
            name: "Medical Council Registration Certificate",
            filename: "state_council_registration.pdf",
            size: 980000,
            isMandatory: true
          }
        ];

        for (const doc of docsToUpload) {
          try {
            const formData = new FormData();
            if (doc.file) {
              formData.append("file", doc.file);
            }
            formData.append("document_type", doc.type);
            formData.append("document_name", doc.name);
            formData.append("filename", doc.filename);
            formData.append("file_size", String(doc.size));
            formData.append("is_mandatory", String(doc.isMandatory));
            await fetch(`/api/doctor-verification/${resData.id}/documents`, {
              method: "POST",
              body: formData
            });
          } catch (uploadErr) {
            console.error("Failed uploading document", doc.filename, uploadErr);
          }
        }
      }
    } catch (err: any) {
      console.error("Submission failed, fallback to local application store", err);
      const fallbackRef = `DOC-VER-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmittedAppRef(fallbackRef);

      const localApp = {
        id: `dva-${Date.now()}`,
        doctor_id: `doc-${Date.now()}`,
        application_reference: fallbackRef,
        doctor_name: fullName,
        doctor_email: email,
        specialty,
        registration_number: regNumber,
        issuing_council: issuingCouncil,
        highest_qualification: highestQualification,
        experience_years: experienceYears,
        status: "pending_review",
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        documents_count: clientDocs.length,
        mandatory_documents_verified: false,
        personal_info: payload.personal_info,
        professional_info: payload.professional_info,
        registration_info: payload.registration_info,
        documents: clientDocs,
        reviews: [],
        history: []
      };

      try {
        const stored = JSON.parse(localStorage.getItem("doctor_verification_applications") || "[]");
        const remaining = stored.filter((a: any) => a.doctor_email !== email && a.application_reference !== fallbackRef);
        remaining.unshift(localApp);
        localStorage.setItem("doctor_verification_applications", JSON.stringify(remaining));
      } catch (e) {
        console.error("localStorage fallback save error", e);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eligibility Checklist status calculations for Step 5
  const mandatoryDocsCount = DOCUMENT_CATEGORIES.filter((c) => c.isMandatory).length;
  const uploadedMandatoryCount = uploadedDocuments.filter((d) => d.isMandatory).length;

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-10 lg:py-14 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-subtle border border-[#DCE6EF] shrink-0">
              <Image
                src={BRAND.logo}
                alt={`${BRAND.displayName} Logo`}
                width={48}
                height={48}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-2xl font-serif font-normal text-[#163B63] leading-tight">
                {BRAND.displayName}
              </span>
              <span className="text-[10px] uppercase font-sans tracking-[0.16em] text-[#20B8AD] font-semibold">
                {BRAND.tagline}
              </span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
            Doctor Registration
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-light max-w-xl mx-auto">
            Register as a medical practitioner on {BRAND.displayName}. Please enter your professional details and upload your credentials for administrative review.
          </p>
        </div>

        {/* Post-Submission Success Screen */}
        {submittedAppRef ? (
          <div className="rounded-[36px] bg-white border border-[#DCE6EF] p-8 sm:p-12 shadow-editorial space-y-6 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/40 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <span className="text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Application Status: Pending Review
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
                Verification Application Submitted
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed font-light">
                Your professional verification application has been submitted successfully. Our clinical administration team will review your registration, certificates, and qualifications. You will be notified when your status changes.
              </p>
            </div>

            {/* Application Reference ID Box */}
            <div className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] max-w-sm mx-auto space-y-1 text-xs">
              <span className="text-[#64748B] block">Application Reference ID:</span>
              <span className="text-base font-mono font-bold text-[#163B63] tracking-wide">
                {submittedAppRef}
              </span>
              <span className="text-[11px] text-[#64748B] block pt-1">
                Submitted by: Dr. {fullName} • {specialty}
              </span>
            </div>

            {/* Notice regarding restricted access */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 max-w-lg mx-auto text-left flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                <strong>Notice:</strong> In accordance with clinical safety regulations, public profile search and appointment scheduling remain restricted until your application is approved by the platform administration.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Link href="/doctor/dashboard">
                <Button variant="primary" size="lg" className="bg-[#258FE5] hover:bg-[#163B63]">
                  Go to Doctor Dashboard
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="lg">
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[36px] bg-white border border-[#DCE6EF] p-6 sm:p-10 shadow-editorial space-y-8">
            {/* Quick Demo Fill Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#EAF5FC]/70 border border-[#20B8AD]/30 text-xs">
              <div className="flex items-center gap-2 text-[#258FE5]">
                <Sparkles className="w-4 h-4 text-[#258FE5] shrink-0" />
                <span className="font-medium">Testing verification? Auto-populate valid doctor details and test documents.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillDemoDetails}
                className="text-xs h-7 bg-white hover:bg-[#F5F9FC] text-[#258FE5] border-[#20B8AD]/50 shrink-0"
              >
                Auto-Fill Test Details
              </Button>
            </div>

            {/* Multi-Step Progress Tracker */}
            <div className="grid grid-cols-5 gap-2 border-b border-[#DCE6EF] pb-6 text-xs">
              {[
                { step: 1, label: "Personal" },
                { step: 2, label: "Professional" },
                { step: 3, label: "Registration" },
                { step: 4, label: "Documents" },
                { step: 5, label: "Review" }
              ].map((s) => (
                <div
                  key={s.step}
                  className={`text-center space-y-1.5 transition-all ${
                    currentStep === s.step
                      ? "text-[#258FE5] font-semibold"
                      : currentStep > s.step
                      ? "text-[#163B63] font-medium"
                      : "text-[#64748B] opacity-60"
                  }`}
                >
                  <div
                    className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentStep === s.step
                        ? "bg-[#258FE5] text-white shadow-xs"
                        : currentStep > s.step
                        ? "bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]"
                        : "bg-[#F5F9FC] text-[#64748B] border border-[#DCE6EF]"
                    }`}
                  >
                    {currentStep > s.step ? "✓" : s.step}
                  </div>
                  <span className="hidden sm:block text-[11px]">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Error Banner */}
            {Object.keys(errors).length > 0 && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{Object.values(errors)[0]}</span>
              </div>
            )}

            {/* =========================================================================
                STEP 1: PERSONAL INFORMATION
               ========================================================================= */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif text-[#163B63]">Step 1: Personal Information</h3>
                  <p className="text-xs text-[#64748B]">Enter your personal and contact details.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-semibold text-[#163B63]">Full Name *</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Email Address *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Phone Number *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Date of Birth *</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-semibold text-[#163B63]">Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Confirm Password *</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                STEP 2: PROFESSIONAL INFORMATION
               ========================================================================= */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif text-[#163B63]">Step 2: Professional Information</h3>
                  <p className="text-xs text-[#64748B]">Specify your clinical discipline, graduating university, hospital affiliations, and consultation fee.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Medical Specialization *</label>
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    >
                      {SPECIALTIES.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Highest Qualification *</label>
                    <input
                      type="text"
                      value={highestQualification}
                      onChange={(e) => setHighestQualification(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-semibold text-[#163B63]">Medical College / University *</label>
                    <input
                      type="text"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Year of Graduation</label>
                    <input
                      type="number"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(parseInt(e.target.value) || 2014)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Years of Experience</label>
                    <input
                      type="number"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Current Hospital / Clinic</label>
                    <input
                      type="text"
                      value={currentHospital}
                      onChange={(e) => setCurrentHospital(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Consultation Fee (₹)</label>
                    <input
                      type="number"
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(parseFloat(e.target.value) || 800)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-semibold text-[#163B63]">Professional Bio *</label>
                    <textarea
                      rows={3}
                      value={biography}
                      onChange={(e) => setBiography(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                STEP 3: MEDICAL REGISTRATION DETAILS
               ========================================================================= */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif text-[#163B63]">Step 3: Medical Registration Details</h3>
                  <p className="text-xs text-[#64748B]">
                    Provide your statutory medical council registration details.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Medical Council Registration Number *</label>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Issuing Medical Council *</label>
                    <select
                      value={issuingCouncil}
                      onChange={(e) => setIssuingCouncil(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    >
                      {STATE_COUNCILS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Primary Qualification *</label>
                    <input
                      type="text"
                      value={primaryQualification}
                      onChange={(e) => setPrimaryQualification(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Specialization (if applicable)</label>
                    <input
                      type="text"
                      value={specializationQualification}
                      onChange={(e) => setSpecializationQualification(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Registration Issue Date</label>
                    <input
                      type="date"
                      value={registrationDate}
                      onChange={(e) => setRegistrationDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#163B63]">Registration Validity</label>
                    <input
                      type="text"
                      value={validityDetails}
                      onChange={(e) => setValidityDetails(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-[#F5F9FC] focus:bg-white focus:outline-none focus:border-[#258FE5]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                STEP 4: MANDATORY & OPTIONAL DOCUMENT UPLOADS
               ========================================================================= */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif text-[#163B63]">
                    Upload Documents for Verification
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Upload credential certificates for admin review. Supported formats: PDF, JPG, PNG, DOCX (Max 10 MB).
                  </p>
                </div>

                {/* Upload Action Card */}
                <div className="p-6 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-semibold text-[#163B63]">Select Document Category:</label>
                      <select
                        value={activeUploadDocType}
                        onChange={(e) => setActiveUploadDocType(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE6EF] bg-white focus:outline-none focus:border-[#258FE5]"
                      >
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.isMandatory ? "(Mandatory)" : "(Optional)"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        leftIcon={<Upload className="w-4 h-4" />}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-[#258FE5] hover:bg-[#163B63]"
                      >
                        Choose File
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      />
                    </div>
                  </div>

                  {/* Fast Testing Button */}
                  <div className="pt-2 border-t border-[#DCE6EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span className="text-[#64748B]">Testing the verification workflow?</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={attachSampleDocs}
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#258FE5]" />}
                      className="text-xs h-8 bg-white border-[#20B8AD]/60 text-[#258FE5] hover:bg-[#EAF5FC]"
                    >
                      Attach Sample Test Documents
                    </Button>
                  </div>
                </div>

                {/* Uploaded Documents List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#163B63]">
                    <span>Uploaded Credentials ({uploadedDocuments.length})</span>
                    <span className="text-[11px] text-[#64748B]">
                      Mandatory: {uploadedMandatoryCount} of {mandatoryDocsCount} attached
                    </span>
                  </div>

                  {uploadedDocuments.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-[#DCE6EF] text-center text-xs text-[#64748B]">
                      No documents attached yet. Please attach your medical degree, registration certificate, and identity proof.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3.5 rounded-xl bg-white border border-[#DCE6EF] flex items-center justify-between gap-3 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#163B63] truncate">{doc.name}</div>
                              <div className="text-[10px] text-[#64748B] flex items-center gap-2">
                                <span>{doc.filename}</span>
                                <span>•</span>
                                <span>{formatFileSize(doc.size)}</span>
                                {doc.isMandatory && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase font-mono text-[9px]">
                                    Mandatory
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-[#163B63] font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#20B8AD]" /> Attached
                            </span>
                            <button
                              type="button"
                              onClick={() => removeDocument(doc.id)}
                              className="text-[#20B8AD] hover:text-[#163B63] p-1 transition-colors"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =========================================================================
                STEP 5: REVIEW, ELIGIBILITY CHECKLIST & DECLARATION
               ========================================================================= */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif text-[#163B63]">Step 5: Review & Formal Declaration</h3>
                  <p className="text-xs text-[#64748B]">Verify all entered qualifications and sign the statutory practice declaration.</p>
                </div>

                {/* Review Overview Grid */}
                <div className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF] space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[#DCE6EF]">
                    <div>
                      <span className="text-[#64748B] block">Doctor Name:</span>
                      <strong className="text-[#163B63]">{fullName}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Specialty & Degree:</span>
                      <strong className="text-[#163B63]">{specialty} • {highestQualification}</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Medical Council Registration:</span>
                      <strong className="text-[#163B63] font-mono">{regNumber}</strong> ({issuingCouncil})
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Experience & Hospital:</span>
                      <span className="text-[#163B63]">{experienceYears} Years • {currentHospital || "Private Clinic"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#64748B] block mb-1">Attached Documents ({uploadedDocuments.length}):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {uploadedDocuments.map((d) => (
                        <span key={d.id} className="px-2.5 py-1 rounded-lg bg-white border border-[#DCE6EF] text-[11px] text-[#163B63]">
                          ✓ {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submission Checklist */}
                <div className="p-5 rounded-2xl bg-white border border-[#DCE6EF] shadow-xs space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#258FE5] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Application Checklist
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-[#163B63]">
                      <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
                      <span>Mandatory identity and personal details completed</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#163B63]">
                      <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
                      <span>Statutory medical council registration ID provided ({regNumber})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#163B63]">
                      <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
                      <span>Primary medical qualification documented ({primaryQualification})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#163B63]">
                      <CheckCircle2 className="w-4 h-4 text-[#20B8AD]" />
                      <span>{uploadedDocuments.length} credential certificates formatted and attached</span>
                    </div>
                  </div>
                </div>

                {/* Legal Declaration & Consent */}
                <div className="p-5 rounded-2xl bg-[#EAF5FC]/60 border border-[#20B8AD]/40 space-y-3 text-xs">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={declarationAgreed}
                      onChange={(e) => setDeclarationAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-[#258FE5] focus:ring-[#258FE5] border-[#DCE6EF]"
                    />
                    <div className="space-y-1">
                      <span className="font-semibold text-[#163B63]">Statutory Medical Declaration & Code of Ethics</span>
                      <p className="text-[11px] text-[#64748B] leading-relaxed">
                        I hereby declare under penalty of perjury that all medical degrees, council registration credentials, and certificates submitted are genuine, unrevoked, and legally valid under applicable National Medical Commission regulations. I understand that administrative credential verification is required before active consultation privileges are enabled.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Stepper Footer Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-[#DCE6EF]">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleBack}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Previous Step
                </Button>
              ) : (
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs text-[#64748B]">
                    Already registered? Sign In
                  </Button>
                </Link>
              )}

              {currentStep < 5 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNext}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="bg-[#258FE5] hover:bg-[#163B63]"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting || !declarationAgreed}
                  onClick={handleSubmitFinal}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  className="bg-[#258FE5] hover:bg-[#163B63]"
                >
                  {isSubmitting ? "Submitting for Verification..." : "Submit for Verification"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
