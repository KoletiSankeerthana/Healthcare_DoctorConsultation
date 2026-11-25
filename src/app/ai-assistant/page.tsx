"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Stethoscope,
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Send,
  Trash2,
  ChevronRight,
  ShieldAlert,
  User,
  PhoneCall,
  Calendar,
  FileText,
  RotateCcw,
  Info,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  MapPin,
  Crosshair,
  ShieldCheck,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuthUser } from "@/hooks/useAuthUser";

interface DoctorRecommendation {
  id: string;
  name: string;
  title: string;
  specialty: string;
  specialty_slug?: string;
  qualifications: string[];
  experience_years: number;
  rating: number;
  review_count: number;
  consultation_fee: number;
  consultation_types?: string[];
  clinic_name: string;
  clinic_address?: string;
  clinic_locality?: string;
  clinic_city: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  distance_label?: string;
  is_nearby?: boolean;
  available_today?: boolean;
  next_available_slot?: string;
  today_hours?: string;
  avatar: string;
  verified: boolean;
  recommendation_reason?: string;
}

interface AssessmentItem {
  id: string;
  patient_id: string;
  original_description: string;
  selected_symptoms: string[];
  symptom_duration: string;
  severity: string;
  progression?: string;
  started_at?: string;
  assessment_status: string;
  urgency_level: string;
  emergency_flag: boolean;
  emergency_details?: any;
  ai_assessment_result?: any;
  recommended_specialties: string[];
  created_at: string;
  messages?: Array<{ id: string; sender: string; message: string; created_at: string }>;
  answers?: Array<{ id: string; question: string; answer: string; created_at: string }>;
  recommended_doctors?: DoctorRecommendation[];
}

interface DynamicSymptom {
  id: string;
  label: string;
  category: string;
  preselected?: boolean;
}

function AIAssistantContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("tab") || "check";
  const { isAuthenticated, loading: authLoading } = useAuthUser();
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Tab State: "check" (Assessment workflow) or "history" (Past Assessments)
  const [activeTab, setActiveTab] = useState<"check" | "history">(
    initialMode === "history" ? "history" : "check"
  );

  // 5-Step Guided Progress Workflow:
  // 1: Health Concern
  // 2: Dynamic Symptoms & Parameters
  // 3: Clarifying Follow-ups (with fixed container scrolling)
  // 4: Clinical Assessment & Precautions
  // 5: Nearby Verified Doctors & Real Booking
  const [guidedStep, setGuidedStep] = useState<number>(1);

  // Form Inputs
  const [description, setDescription] = useState("");
  const [dynamicSuggestions, setDynamicSuggestions] = useState<DynamicSymptom[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptomInput, setCustomSymptomInput] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [duration, setDuration] = useState("2-3 days");
  const [severity, setSeverity] = useState<"Mild" | "Moderate" | "Severe">("Moderate");
  const [progression, setProgression] = useState<"improving" | "worsening" | "unchanged">("unchanged");
  const [startedAt, setStartedAt] = useState("Gradual onset");

  // Geolocation & Locality State
  const [patientCity, setPatientCity] = useState("Chennai");
  const [patientLocality, setPatientLocality] = useState("Velachery");
  const [patientLatitude, setPatientLatitude] = useState<number>(12.9815);
  const [patientLongitude, setPatientLongitude] = useState<number>(80.2180);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);

  const [includeDocs, setIncludeDocs] = useState(false);

  // Profile Context (Auto-loaded strictly from authenticated session / patient profile)
  const [patientProfile, setPatientProfile] = useState<{
    id?: string;
    name: string;
    age: string;
    gender: string;
    locality?: string;
    city?: string;
    allergies: string[];
    conditions: string[];
    medications: string[];
  }>({
    name: "",
    age: "",
    gender: "",
    locality: "Velachery",
    city: "Chennai",
    allergies: [],
    conditions: [],
    medications: []
  });

  // Active Assessment State
  const [activeAssessment, setActiveAssessment] = useState<AssessmentItem | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [answerInput, setAnswerInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Nearby Doctors State with Radius Expansion Info
  const [nearbyDoctors, setNearbyDoctors] = useState<DoctorRecommendation[]>([]);
  const [radiusUsed, setRadiusUsed] = useState<number>(5.0);
  const [isRadiusExpanded, setIsRadiusExpanded] = useState<boolean>(false);
  const [expansionMessage, setExpansionMessage] = useState<string>("");
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

  // Instant Booking Modal State
  const [bookingDoctor, setBookingDoctor] = useState<DoctorRecommendation | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [bookingTime, setBookingTime] = useState<string>("10:00 AM");
  const [bookingType, setBookingType] = useState<"online" | "in-person">("online");
  const [bookingNotes, setBookingNotes] = useState<string>("");
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingSuccessResult, setBookingSuccessResult] = useState<any | null>(null);

  // Dynamic slot engine state for booking modal
  const [dynamicSlots, setDynamicSlots] = useState<any[]>([]);
  const [groupedDynamicSlots, setGroupedDynamicSlots] = useState<{
    morning: any[];
    afternoon: any[];
    evening: any[];
  }>({ morning: [], afternoon: [], evening: [] });
  const [selectedDynamicSlot, setSelectedDynamicSlot] = useState<any | null>(null);
  const [loadingDynamicSlots, setLoadingDynamicSlots] = useState<boolean>(false);
  const [dynamicSlotsReason, setDynamicSlotsReason] = useState<string | null>(null);
  const [slotHoldId, setSlotHoldId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingDoctor?.id || !bookingDate) return;
    const targetDocId = bookingDoctor.id;
    let isMounted = true;
    async function fetchDynamicSlots() {
      setLoadingDynamicSlots(true);
      setDynamicSlotsReason(null);
      try {
        const res = await fetch(`/api/doctors/${targetDocId}/availability?date=${bookingDate}&mode=${bookingType}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            const slots = data.slots || [];
            setDynamicSlots(slots);
            setGroupedDynamicSlots(data.grouped_slots || {
              morning: slots.filter((s: any) => s.time_period === "morning"),
              afternoon: slots.filter((s: any) => s.time_period === "afternoon"),
              evening: slots.filter((s: any) => s.time_period === "evening")
            });
            if (!data.available && data.reason) {
              setDynamicSlotsReason(data.reason);
            }
            if (slots.length > 0) {
              setSelectedDynamicSlot(slots[0]);
              setBookingTime(slots[0].display_time || slots[0].start_time_12h);
            } else {
              setSelectedDynamicSlot(null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load doctor slots", err);
      } finally {
        if (isMounted) setLoadingDynamicSlots(false);
      }
    }
    fetchDynamicSlots();
    return () => { isMounted = false; };
  }, [bookingDoctor?.id, bookingDate, bookingType]);

  // Follow-up Chat State & Isolated Container Scroll Fix
  const [chatInput, setChatInput] = useState("");
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  // Historical Assessments State
  const [historyList, setHistoryList] = useState<AssessmentItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AssessmentItem | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfileContext();
      fetchHistory();
    }
  }, [isAuthenticated]);

  // Isolated Container Scrolling: ONLY scrolls the chat inner container, NEVER the document!
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        setShowScrollBottomPill(false);
      } else {
        setShowScrollBottomPill(true);
      }
    }
  }, [activeAssessment?.messages, isChatTyping]);

  const handleScrollChatToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
      setShowScrollBottomPill(false);
    }
  };

  const handleChatContainerScroll = () => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      setShowScrollBottomPill(!isNearBottom);
    }
  };

  const fetchProfileContext = async () => {
    try {
      const res = await fetch("/api/patient/profile");
      if (res.ok) {
        const data = await res.json();
        setPatientProfile({
          id: data.id,
          name: data.full_name || "Patient User",
          age: data.age_formatted || "36 Years",
          gender: data.gender || "Male",
          locality: data.locality || "Velachery",
          city: data.city || "Chennai",
          allergies: data.allergies || ["Penicillin"],
          conditions: data.medical_history || [],
          medications: data.current_medications || []
        });
        if (data.city) setPatientCity(data.city);
        if (data.locality) setPatientLocality(data.locality);
        if (data.home_latitude && data.home_longitude) {
          setPatientLatitude(data.home_latitude);
          setPatientLongitude(data.home_longitude);
        }
      }
    } catch (e) {
      console.error("Failed to fetch patient profile for AI context:", e);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/symptom-assessments");
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (e) {
      console.error("Failed to load assessments history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Browser Geolocation Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setGpsDetecting(true);
    setGpsStatusMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPatientLatitude(lat);
        setPatientLongitude(lng);
        setGpsDetecting(false);
        setGpsStatusMessage(`GPS Coordinates Detected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        // Refresh nearby doctors if in Step 5
        if (guidedStep === 5) {
          fetchNearbyDoctors(lat, lng, activeAssessment?.recommended_specialties || []);
        }
      },
      () => {
        setGpsDetecting(false);
        setPatientLatitude(12.9815);
        setPatientLongitude(80.2180);
        setGpsStatusMessage("Using locality default: Velachery, Chennai (12.9815, 80.2180)");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Generate Dynamic Symptoms from User's Natural Language Description
  const handleGenerateSymptoms = async () => {
    
  if (!isAuthenticated) {
      setAuthGateOpen(true);
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Please write a few words about what health issues you are experiencing.");
      return;
    }

    setIsSuggesting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/symptom-assessments/suggest-symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          patient_context: {
            locality: patientLocality,
            city: patientCity,
            age: patientProfile.age,
            allergies: patientProfile.allergies
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate dynamic symptoms.");

      // If immediate emergency caught at Step 1, trigger assessment creation
      if (data.emergency) {
        await initiateFullAssessment(true);
        return;
      }

      setDynamicSuggestions(data.suggestions || []);
      // Pre-select any symptoms identified by AI
      const preselected = (data.suggestions || [])
        .filter((s: DynamicSymptom) => s.preselected)
        .map((s: DynamicSymptom) => s.label);
      if (preselected.length > 0) {
        setSelectedSymptoms((prev) => Array.from(new Set([...prev, ...preselected])));
      }

      setGuidedStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate symptom suggestions.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const toggleSymptomTag = (label: string) => {
    if (selectedSymptoms.includes(label)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== label));
    } else {
      setSelectedSymptoms([...selectedSymptoms, label]);
    }
  };

  const handleAddCustomSymptom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSymptomInput.trim();
    if (!trimmed) return;
    if (!selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms([...selectedSymptoms, trimmed]);
    }
    setCustomSymptomInput("");
  };

  // Start / Submit Full Clinical Assessment
  const initiateFullAssessment = async (isUrgentEmergency = false) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/symptom-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          selected_symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : [description.slice(0, 30)],
          duration,
          severity,
          progression,
          started_at: startedAt,
          include_medical_documents: includeDocs,
          patient_context: {
            city: patientCity.trim(),
            locality: patientLocality.trim(),
            latitude: patientLatitude,
            longitude: patientLongitude,
            age: patientProfile.age,
            gender: patientProfile.gender,
            allergies: patientProfile.allergies,
            conditions: patientProfile.conditions,
            medications: patientProfile.medications
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate clinical assessment.");

      // Check emergency
      if (data.emergency_flag || isUrgentEmergency) {
        const fullDetailRes = await fetch(`/api/symptom-assessments/${data.id}`);
        const fullData = await fullDetailRes.json();
        setActiveAssessment(fullData);
        setGuidedStep(4);
        fetchNearbyDoctors(patientLatitude, patientLongitude, fullData.recommended_specialties || []);
        fetchHistory();
        return;
      }

      // Check follow-up questions
      if (data.follow_up_questions && data.follow_up_questions.length > 0) {
        setCurrentQuestion(data.follow_up_questions[0]);
        const fullRes = await fetch(`/api/symptom-assessments/${data.id}`);
        setActiveAssessment(await fullRes.json());
        setGuidedStep(3);
      } else {
        const fullRes = await fetch(`/api/symptom-assessments/${data.id}`);
        const fullData = await fullRes.json();
        setActiveAssessment(fullData);
        setGuidedStep(4);
        fetchNearbyDoctors(patientLatitude, patientLongitude, fullData.recommended_specialties || []);
      }

      fetchHistory();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Answer to Follow-up Question
  const handleAnswerQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || !activeAssessment) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/symptom-assessments/${activeAssessment.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          answer: answerInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit answer.");

      setAnswerInput("");

      if (data.next_question && !data.completed) {
        setCurrentQuestion(data.next_question);
        const fullRes = await fetch(`/api/symptom-assessments/${activeAssessment.id}`);
        setActiveAssessment(await fullRes.json());
      } else {
        // Assessment completed -> advance to Step 4
        const fullRes = await fetch(`/api/symptom-assessments/${activeAssessment.id}`);
        const fullData = await fullRes.json();
        setActiveAssessment(fullData);
        setGuidedStep(4);
        fetchNearbyDoctors(patientLatitude, patientLongitude, fullData.recommended_specialties || []);
        fetchHistory();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process follow-up answer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Skip questions and complete immediately
  const handleForceComplete = async () => {
    if (!activeAssessment) return;
    setAssessmentLoading(true);

    try {
      const res = await fetch(`/api/symptom-assessments/${activeAssessment.id}/complete`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to complete assessment.");

      const fullRes = await fetch(`/api/symptom-assessments/${activeAssessment.id}`);
      const fullData = await fullRes.json();
      setActiveAssessment(fullData);
      setGuidedStep(4);
      fetchNearbyDoctors(patientLatitude, patientLongitude, fullData.recommended_specialties || []);
      fetchHistory();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Fetch Nearby Doctors via Haversine Geospatial API
  const fetchNearbyDoctors = async (lat: number, lng: number, specialties: string[] = []) => {
    setIsLoadingDoctors(true);
    try {
      const res = await fetch("/api/doctors/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          specialties,
          radius_km: 5.0,
          city: patientCity
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNearbyDoctors(data.doctors || []);
        setRadiusUsed(data.radius_used_km || 5.0);
        setIsRadiusExpanded(data.is_expanded || false);
        setExpansionMessage(data.expansion_message || "");
      }
    } catch (e) {
      console.error("Failed to load nearby doctors:", e);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  // Switch locality preset for testing/demonstration
  const handleSelectLocalityPreset = (localityName: string, lat: number, lng: number) => {
    setPatientLocality(localityName);
    setPatientLatitude(lat);
    setPatientLongitude(lng);
    setGpsStatusMessage(`Selected Locality: ${localityName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    fetchNearbyDoctors(lat, lng, activeAssessment?.recommended_specialties || []);
  };

  // Follow-up chat question within assessment (ISOLATED CONTAINER SCROLL)
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeAssessment) return;

    const query = chatInput.trim();
    setChatInput("");

    // Optimistic message append
    setActiveAssessment((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [
          ...(prev.messages || []),
          { id: `temp-${Date.now()}`, sender: "patient", message: query, created_at: new Date().toISOString() }
        ]
      };
    });

    setIsChatTyping(true);

    try {
      const res = await fetch(`/api/symptom-assessments/${activeAssessment.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query })
      });

      const data = await res.json();
      if (res.ok && data.message) {
        setActiveAssessment((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [
              ...(prev.messages || []),
              { id: data.message_id || `asst-${Date.now()}`, sender: "assistant", message: data.message, created_at: data.created_at }
            ]
          };
        });
      }
    } catch (e) {
      console.error("Chat error", e);
    } finally {
      setIsChatTyping(false);
    }
  };

  // Slot selection with temporary 5-min hold
  const handleSelectDynamicSlot = async (slot: any) => {
    setSelectedDynamicSlot(slot);
    setBookingTime(slot.display_time || slot.start_time_12h);
    try {
      const res = await fetch("/api/appointments/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: bookingDoctor?.id,
          date: bookingDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          patient_id: patientProfile?.id || "pat-101",
          hold_seconds: 300
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSlotHoldId(data.hold_id);
      }
    } catch (e) {
      console.error("Hold failed", e);
    }
  };

  // Instant Appointment Booking Handler (Direct to Secure Razorpay Checkout)
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor) return;

    const timeVal = selectedDynamicSlot?.display_time || bookingTime;
    const startVal = selectedDynamicSlot?.start_time || bookingTime.split(" ")[0];
    const endVal = selectedDynamicSlot?.end_time || "";
    const symptomsVal = activeAssessment?.selected_symptoms?.join(", ") || description;
    const notesVal = bookingNotes || `AI Assessment Reference: ${activeAssessment?.id || 'Direct'}`;

    router.push(
      `/checkout?doctor_id=${bookingDoctor.id}&date=${bookingDate}&slot=${encodeURIComponent(timeVal)}&start_time=${startVal}&end_time=${endVal}&type=${bookingType}&hold_id=${slotHoldId || ""}&symptoms=${encodeURIComponent(symptomsVal)}&notes=${encodeURIComponent(notesVal)}`
    );
  };

  // Open Historical Assessment
  const handleOpenHistorical = async (item: AssessmentItem) => {
    setAssessmentLoading(true);
    try {
      const res = await fetch(`/api/symptom-assessments/${item.id}`);
      if (res.ok) {
        const full = await res.json();
        setActiveAssessment(full);
        setActiveTab("check");
        setGuidedStep(4);
        fetchNearbyDoctors(patientLatitude, patientLongitude, full.recommended_specialties || []);
      }
    } catch (e) {
      console.error("Failed to load historical record", e);
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Delete Historical Assessment
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/symptom-assessments/${itemToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setHistoryList((prev) => prev.filter((i) => i.id !== itemToDelete.id));
        if (activeAssessment?.id === itemToDelete.id) {
          setActiveAssessment(null);
          setGuidedStep(1);
        }
      }
    } catch (e) {
      console.error("Failed to delete", e);
    } finally {
      setItemToDelete(null);
    }
  };

  const handleStartFresh = () => {
    setActiveAssessment(null);
    setDescription("");
    setSelectedSymptoms([]);
    setDynamicSuggestions([]);
    setGuidedStep(1);
    setErrorMsg(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] bg-[#EDF5FA] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D5E4EF] p-8 sm:p-10 shadow-luxury text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#258FE5]/10 to-[#20B8AD]/20 border border-[#20B8AD]/40 flex items-center justify-center mx-auto text-[#258FE5] shadow-xs">
            <Sparkles className="w-8 h-8 text-[#20B8AD]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] text-[#123D68] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63] font-normal tracking-tight">
              Sign in to continue with your healthcare journey.
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-serif leading-relaxed font-light">
              AI Health Assistant &amp; Clinical Triage requires an authenticated patient account to provide personalized medical evaluations, safeguard your health history, and connect with verified specialists.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] text-left space-y-2 text-xs text-[#526A82] font-serif">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Personalized symptom evaluation &amp; triage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Protected medical history &amp; encrypted consultations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Direct access to verified doctor appointment booking</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white font-serif font-semibold text-sm shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>
            </Link>

            <Link
              href="/register?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] font-serif font-semibold text-sm"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F9FC] py-8 lg:py-12 text-left">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-[#258FE5]/70">
            <Link href="/patient/dashboard" className="hover:text-[#163B63] transition-colors">
              Patient Sanctuary
            </Link>
            <span>/</span>
            <span className="text-[#163B63] font-semibold">AI Symptom Assessment & Nearby Doctors</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/patient/profile">
              <Button variant="outline" size="sm" className="text-xs h-8 border-[#20B8AD]/40 text-[#258FE5]">
                Edit Health Profile
              </Button>
            </Link>
            <div className="flex items-center bg-[#F5F9FC] p-1 rounded-full border border-[#20B8AD]/30 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("check")}
                className={`px-3.5 py-1 rounded-full transition-all font-medium ${
                  activeTab === "check"
                    ? "bg-[#258FE5] text-white shadow-xs"
                    : "text-[#163B63] hover:text-[#258FE5]"
                }`}
              >
                Assessment
              </button>
              <button
                type="button"
                onClick={() => {
                  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
                    setAuthGateOpen(true);
                    return;
                  }
                  setActiveTab("history");
                }}
                className={`px-3.5 py-1 rounded-full transition-all font-medium ${
                  activeTab === "history"
                    ? "bg-[#258FE5] text-white shadow-xs"
                    : "text-[#163B63] hover:text-[#258FE5]"
                }`}
              >
                History ({historyList.length})
              </button>
            </div>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="bg-[#258FE5] rounded-[32px] p-8 sm:p-10 text-white relative overflow-hidden shadow-editorial">
          <div className="relative z-10 max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-[#F5F9FC] border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
              MediVerse Clinical Health Guidance v3.0
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-white tracking-tight">
              AI Symptom Assessment, Health Guidance & Nearby Specialists
            </h1>
            <p className="text-xs sm:text-sm text-[#F5F9FC]/80 leading-relaxed font-light">
              Describe your health concerns in your own words. Receive instant precautions, contextual clarification, and real-time appointment booking with verified nearby doctors.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-10 w-64 h-64 rounded-full bg-[#163B63]/50 blur-2xl pointer-events-none" />
        </div>

        {/* 5-Step Guided Progress Workflow Bar */}
        {activeTab === "check" && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#20B8AD]/30 shadow-subtle">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-3 text-center">
              {[
                { num: 1, title: "1. Concern", desc: "Natural Language" },
                { num: 2, title: "2. Symptoms", desc: "Dynamic Tags" },
                { num: 3, title: "3. Clarify", desc: "Follow-ups" },
                { num: 4, title: "4. Guidance", desc: "Precautions" },
                { num: 5, title: "5. Doctors", desc: "Nearby Booking" }
              ].map((st) => {
                const isActive = guidedStep === st.num;
                const isPast = guidedStep > st.num;
                
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] bg-[#EDF5FA] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D5E4EF] p-8 sm:p-10 shadow-luxury text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#258FE5]/10 to-[#20B8AD]/20 border border-[#20B8AD]/40 flex items-center justify-center mx-auto text-[#258FE5] shadow-xs">
            <Sparkles className="w-8 h-8 text-[#20B8AD]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] text-[#123D68] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63] font-normal tracking-tight">
              Sign in to continue with your healthcare journey.
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-serif leading-relaxed font-light">
              AI Health Assistant &amp; Clinical Triage requires an authenticated patient account to provide personalized medical evaluations, safeguard your health history, and connect with verified specialists.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] text-left space-y-2 text-xs text-[#526A82] font-serif">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Personalized symptom evaluation &amp; triage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Protected medical history &amp; encrypted consultations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Direct access to verified doctor appointment booking</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white font-serif font-semibold text-sm shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>
            </Link>

            <Link
              href="/register?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] font-serif font-semibold text-sm"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
                  <button
                    key={st.num}
                    type="button"
                    onClick={() => {
                      // Allow navigating between completed steps
                      if (isPast || activeAssessment) {
                        setGuidedStep(st.num);
                      }
                    }}
                    className={`p-2 sm:p-2.5 rounded-2xl transition-all text-left sm:text-center ${
                      isActive
                        ? "bg-[#258FE5] text-white shadow-xs"
                        : isPast
                        ? "bg-[#F5F9FC] text-[#258FE5] border border-[#20B8AD]/40"
                        : "bg-[#F5F9FC] text-[#94A3B8] border border-transparent"
                    }`}
                  >
                    <div className="text-[11px] font-bold truncate">{st.title}</div>
                    <div className="hidden sm:block text-[9px] opacity-75 truncate">{st.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 1: Check Symptoms Workflow */}
        {activeTab === "check" && (
          <div className="space-y-6">
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: Describe Health Issue (Natural Language) */}
            {guidedStep === 1 && (
              <div className="bg-white rounded-[32px] p-7 sm:p-9 border border-[#20B8AD]/30 shadow-subtle space-y-6">
                <div className="space-y-1 pb-4 border-b border-[#F5F9FC]">
                  <h2 className="text-xl font-serif font-normal text-[#163B63]">
                    Step 1: Describe Your Current Health Concerns
                  </h2>
                  <p className="text-xs text-[#258FE5]/70 font-light">
                    Explain what symptoms you are experiencing in everyday words. Our AI clinical engine will identify relevant symptoms, screen for emergency red flags, and guide you.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#163B63] uppercase tracking-wider">
                      Main Health Concern *
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. I have been having a severe fever since yesterday with chills and sore throat, plus mild body aches..."
                      className="w-full p-4 rounded-2xl border border-[#20B8AD]/40 bg-[#F5F9FC]/60 focus:bg-white focus:outline-none focus:border-[#258FE5] text-sm text-[#163B63] placeholder-[#258FE5]/40 leading-relaxed transition-all"
                      required
                    />
                    <span className="text-[11px] text-[#258FE5]/60 font-light">
                      Natural language enabled: include how long it has lasted, where you feel discomfort, and whether it worsens with activity.
                    </span>
                  </div>

                  {/* Patient Profile Context Ribbon */}
                  <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-[#163B63] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#258FE5]" />
                        <span>Clinical Profile: <strong>{patientProfile.name}</strong> ({patientProfile.age}, {patientProfile.gender})</span>
                      </div>
                      <div className="text-[#258FE5]/70 text-[11px]">
                        Location: <strong>{patientLocality}, {patientCity}</strong> • Allergies: {patientProfile.allergies.join(", ") || "None reported"}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#258FE5]">
                      <input
                        type="checkbox"
                        checked={includeDocs}
                        onChange={(e) => setIncludeDocs(e.target.checked)}
                        className="rounded text-[#258FE5] focus:ring-[#258FE5]"
                      />
                      <span>Include uploaded medical reports</span>
                    </label>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    isLoading={isSuggesting}
                    onClick={handleGenerateSymptoms}
                    className="w-full justify-center h-12 bg-[#258FE5] hover:bg-[#163B63] text-white"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Next: Dynamic Symptom Suggestions
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Dynamic Symptom Suggestions & Parameters */}
            {guidedStep === 2 && (
              <div className="bg-white rounded-[32px] p-7 sm:p-9 border border-[#20B8AD]/30 shadow-subtle space-y-6">
                <div className="space-y-1 pb-4 border-b border-[#F5F9FC]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#258FE5]">Step 2</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5F9FC] text-[#258FE5] font-semibold">
                      AI Generated Suggestions
                    </span>
                  </div>
                  <h2 className="text-xl font-serif font-normal text-[#163B63]">
                    Select Contextual Symptoms & Timeline
                  </h2>
                  <p className="text-xs text-[#258FE5]/70 font-light">
                    Based on your description, we identified the following related symptoms. Click to add or remove tags to refine clinical accuracy.
                  </p>
                </div>

                {/* Initial Reported Concern Summary */}
                <div className="p-3.5 rounded-xl bg-[#F5F9FC] border border-[#20B8AD]/20 text-xs text-[#258FE5]">
                  <strong>Your description:</strong> <span className="italic font-light">&quot;{description}&quot;</span>
                </div>

                {/* Dynamic Symptoms Grid */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#163B63] uppercase tracking-wider">
                    Select All Applicable Symptoms ({selectedSymptoms.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dynamicSuggestions.map((sug) => {
                      const isSelected = selectedSymptoms.includes(sug.label);
                      
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] bg-[#EDF5FA] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D5E4EF] p-8 sm:p-10 shadow-luxury text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#258FE5]/10 to-[#20B8AD]/20 border border-[#20B8AD]/40 flex items-center justify-center mx-auto text-[#258FE5] shadow-xs">
            <Sparkles className="w-8 h-8 text-[#20B8AD]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] text-[#123D68] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63] font-normal tracking-tight">
              Sign in to continue with your healthcare journey.
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-serif leading-relaxed font-light">
              AI Health Assistant &amp; Clinical Triage requires an authenticated patient account to provide personalized medical evaluations, safeguard your health history, and connect with verified specialists.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] text-left space-y-2 text-xs text-[#526A82] font-serif">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Personalized symptom evaluation &amp; triage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Protected medical history &amp; encrypted consultations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Direct access to verified doctor appointment booking</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white font-serif font-semibold text-sm shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>
            </Link>

            <Link
              href="/register?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] font-serif font-semibold text-sm"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => toggleSymptomTag(sug.label)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-[#258FE5] text-white shadow-xs"
                              : "bg-[#F5F9FC] text-[#163B63] hover:bg-[#20B8AD]/20 border border-[#20B8AD]/30"
                          }`}
                        >
                          <span>{isSelected ? "✓" : "+"}</span>
                          <span>{sug.label}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-black/5 text-[#64748B]"}`}>
                            {sug.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Symptom Tag */}
                  <form onSubmit={handleAddCustomSymptom} className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={customSymptomInput}
                      onChange={(e) => setCustomSymptomInput(e.target.value)}
                      placeholder="Add another symptom (e.g. Earache, Dry Mouth, Dizziness)"
                      className="flex-1 px-4 py-2 rounded-xl border border-[#20B8AD]/40 text-xs text-[#163B63] focus:outline-none focus:border-[#258FE5]"
                    />
                    <Button type="submit" variant="outline" size="sm" className="text-xs">
                      + Add
                    </Button>
                  </form>
                </div>

                {/* Duration, Severity & Progression */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#163B63]">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[#20B8AD]/40 bg-white text-xs text-[#163B63] focus:outline-none focus:border-[#258FE5]"
                    >
                      <option value="Started today">Started today</option>
                      <option value="2-3 days">2 - 3 days</option>
                      <option value="About 1 week">About 1 week</option>
                      <option value="More than 2 weeks">More than 2 weeks</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#163B63]">Severity Level</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-[#20B8AD]/40 bg-white text-xs text-[#163B63] focus:outline-none focus:border-[#258FE5]"
                    >
                      <option value="Mild">Mild (Noticeable, manageable)</option>
                      <option value="Moderate">Moderate (Disrupting daily tasks)</option>
                      <option value="Severe">Severe (Intense, debilitating)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#163B63]">Progression</label>
                    <select
                      value={progression}
                      onChange={(e) => setProgression(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl border border-[#20B8AD]/40 bg-white text-xs text-[#163B63] focus:outline-none focus:border-[#258FE5]"
                    >
                      <option value="unchanged">Unchanged (Steady)</option>
                      <option value="worsening">Worsening progressively</option>
                      <option value="improving">Gradually improving</option>
                    </select>
                  </div>
                </div>

                {/* Locality & Geospatial Discovery Settings */}
                <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#163B63]">
                      <MapPin className="w-4 h-4 text-[#258FE5]" />
                      <span>Doctor Discovery Location: <strong>{patientLocality}, {patientCity}</strong></span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      disabled={gpsDetecting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#258FE5] text-white text-[11px] font-semibold hover:bg-[#163B63] transition-colors"
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${gpsDetecting ? "animate-spin" : ""}`} />
                      {gpsDetecting ? "Detecting GPS..." : "Detect Current GPS"}
                    </button>
                  </div>

                  {gpsStatusMessage && (
                    <div className="text-[11px] text-[#163B63] bg-[#EAF5FC] p-2 rounded-lg border border-[#DCE6EF]">
                      {gpsStatusMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[#64748B]">Quick Locality Presets:</span>
                    {[
                      { name: "Velachery", lat: 12.9815, lng: 80.2180 },
                      { name: "Greams Road", lat: 13.0604, lng: 80.2505 },
                      { name: "Adyar", lat: 13.0067, lng: 80.2570 },
                      { name: "Alwarpet", lat: 13.0336, lng: 80.2520 },
                      { name: "Anna Nagar", lat: 13.0850, lng: 80.2101 }
                    ].map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => handleSelectLocalityPreset(loc.name, loc.lat, loc.lng)}
                        className={`px-2.5 py-0.5 rounded-full border transition-all ${
                          patientLocality.toLowerCase() === loc.name.toLowerCase()
                            ? "bg-[#258FE5] text-white border-[#258FE5]"
                            : "bg-white text-[#163B63] border-[#20B8AD]/30 hover:bg-[#F5F9FC]"
                        }`}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Button variant="ghost" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => setGuidedStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    isLoading={isSubmitting}
                    onClick={() => initiateFullAssessment(false)}
                    className="bg-[#258FE5] hover:bg-[#163B63] text-white"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Proceed to Clinical Evaluation
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Clarifying Follow-ups with FIXED CONTAINER SCROLL */}
            {guidedStep === 3 && activeAssessment && (
              <div className="bg-white rounded-[32px] p-7 sm:p-9 border border-[#20B8AD]/30 shadow-subtle space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#F5F9FC]">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#20B8AD]">
                      Step 3: Clinical Clarification
                    </span>
                    <h2 className="text-xl font-serif font-normal text-[#163B63]">
                      Follow-up Questions & Chat
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleForceComplete}
                    isLoading={assessmentLoading}
                    className="text-xs text-[#258FE5] hover:bg-[#F5F9FC]"
                  >
                    Skip to Health Guidance
                  </Button>
                </div>

                {/* Reported Symptoms Summary Banner */}
                <div className="p-3.5 rounded-xl bg-[#F5F9FC] border border-[#20B8AD]/20 text-xs text-[#258FE5] flex items-center justify-between">
                  <div>
                    <strong>Reported Symptoms: </strong>
                    <span>{activeAssessment.selected_symptoms?.join(", ") || description}</span>
                  </div>
                  <span className="text-[11px] text-[#64748B] font-mono">
                    Severity: {activeAssessment.severity}
                  </span>
                </div>

                {/* ISOLATED CHAT STREAM WITH FIXED CONTAINER SCROLL (ZERO DOCUMENT SCROLL) */}
                <div className="relative">
                  <div
                    ref={chatContainerRef}
                    onScroll={handleChatContainerScroll}
                    className="space-y-3 max-h-[380px] overflow-y-auto p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/20"
                  >
                    {activeAssessment.messages?.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-2xl text-xs max-w-lg leading-relaxed ${
                          m.sender === "assistant"
                            ? "bg-white border border-[#20B8AD]/20 text-[#163B63] ml-0 shadow-xs"
                            : "bg-[#258FE5] text-white ml-auto"
                        }`}
                      >
                        {m.message}
                      </div>
                    ))}
                    {isChatTyping && (
                      <div className="p-3 rounded-xl bg-white border border-[#20B8AD]/20 text-xs text-[#258FE5]/60 italic flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>AI Assistant is analyzing...</span>
                      </div>
                    )}
                  </div>

                  {/* Floating "New Message" pill when user has scrolled up */}
                  {showScrollBottomPill && (
                    <button
                      type="button"
                      onClick={handleScrollChatToBottom}
                      className="absolute bottom-4 right-4 bg-[#258FE5] text-white text-xs px-3 py-1 rounded-full shadow-md hover:bg-[#163B63] flex items-center gap-1 transition-all"
                    >
                      <span>New messages</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Current Question Input Card (Sticky at bottom of step 3) */}
                {currentQuestion && (
                  <form onSubmit={handleAnswerQuestion} className="space-y-3 pt-2 border-t border-[#F5F9FC]">
                    <div className="p-3.5 rounded-2xl bg-[#258FE5]/5 border border-[#258FE5]/20 text-xs font-medium text-[#163B63]">
                      {currentQuestion}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        placeholder="Type your response naturally..."
                        className="flex-1 p-3 rounded-xl border border-[#20B8AD]/40 bg-white text-xs text-[#163B63] focus:outline-none focus:border-[#258FE5]"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={isSubmitting}
                        className="bg-[#258FE5] hover:bg-[#163B63] text-white shrink-0 text-xs"
                        rightIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Submit Answer
                      </Button>
                    </div>
                  </form>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleForceComplete}
                    className="text-xs"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    View Precautions & Health Guidance
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: AI Assessment, Health Guidance & Precautions */}
            {guidedStep === 4 && activeAssessment && (
              <div className="space-y-6">
                {/* Emergency Red-Flag Warning Banner */}
                {activeAssessment.emergency_flag && (
                  <div className="p-6 rounded-[28px] bg-rose-50 border-2 border-rose-600 text-rose-950 shadow-md space-y-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-serif font-bold text-rose-900">
                          CRITICAL WARNING: SEEK EMERGENCY MEDICAL ATTENTION NOW
                        </h3>
                        <p className="text-xs text-rose-800 font-medium">
                          Your reported symptoms indicate potentially critical warning signs requiring immediate emergency evaluation.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-rose-300 text-xs text-rose-900 space-y-2">
                      <div>
                        <strong>Identified Emergency Concern:</strong>{" "}
                        {activeAssessment.emergency_details?.category || "Acute Clinical Emergency"}
                      </div>
                      <div>
                        <strong>Recommended Immediate Action:</strong>{" "}
                        {activeAssessment.emergency_details?.action_required || "Immediately dial emergency services or visit the nearest emergency trauma department."}
                      </div>
                      <div className="pt-2 flex items-center gap-4 text-sm font-bold text-rose-700">
                        <span className="flex items-center gap-1.5">
                          <PhoneCall className="w-4 h-4 text-rose-600" />
                          Emergency Helpline (India): 112
                        </span>
                        <span>•</span>
                        <span>Ambulance: 108</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Header Summary Card */}
                <div className="bg-white rounded-[32px] p-7 sm:p-8 border border-[#20B8AD]/30 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#20B8AD]">
                        Step 4: AI Health Assessment
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          activeAssessment.urgency_level === "emergency"
                            ? "bg-rose-100 text-rose-800"
                            : activeAssessment.urgency_level === "urgent"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-[#F5F9FC] text-[#258FE5]"
                        }`}
                      >
                        Urgency: {activeAssessment.urgency_level?.toUpperCase() || "MODERATE"}
                      </span>
                    </div>
                    <h2 className="text-2xl font-serif font-normal text-[#163B63]">
                      Health Guidance & Clinical Breakdown
                    </h2>
                    <p className="text-xs text-[#258FE5]/70 font-light">
                      Symptoms: {activeAssessment.selected_symptoms?.join(", ")} • Duration: {activeAssessment.symptom_duration} • Severity: {activeAssessment.severity}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setGuidedStep(5)}
                      className="bg-[#258FE5] hover:bg-[#163B63] text-white text-xs h-9"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Find Nearby Doctors
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartFresh}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5 text-[#258FE5]" />}
                      className="text-xs h-9 border-[#20B8AD]/40"
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Section A & B: Understanding & Possible Explanations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Understanding Your Symptoms */}
                  <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#20B8AD]/30 shadow-subtle space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#F5F9FC]">
                      <Activity className="w-4 h-4 text-[#258FE5]" />
                      <h3 className="text-base font-serif font-normal text-[#163B63]">
                        A. Understanding Your Symptoms
                      </h3>
                    </div>
                    <p className="text-xs text-[#258FE5]/80 leading-relaxed font-light">
                      {activeAssessment.ai_assessment_result?.understanding ||
                        `You reported experiencing ${activeAssessment.selected_symptoms?.join(", ")} with ${activeAssessment.severity?.toLowerCase() || 'moderate'} intensity.`}
                    </p>
                    <div className="p-3.5 rounded-xl bg-[#F5F9FC] border border-[#20B8AD]/20 text-[11px] text-[#258FE5]/70 space-y-1">
                      <div>Reported duration: <strong>{activeAssessment.symptom_duration}</strong></div>
                      <div>Progression: <strong>{activeAssessment.progression || 'Unchanged'}</strong></div>
                      <div>Timeline onset: <strong>{activeAssessment.started_at || "Recent"}</strong></div>
                    </div>
                  </div>

                  {/* Possible Explanations */}
                  <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#20B8AD]/30 shadow-subtle space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#F5F9FC]">
                      <HelpCircle className="w-4 h-4 text-[#258FE5]" />
                      <h3 className="text-base font-serif font-normal text-[#163B63]">
                        B. Possible Explanations (Not a Diagnosis)
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {activeAssessment.ai_assessment_result?.possible_explanations?.map((exp: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#F5F9FC]/60 border border-[#20B8AD]/30 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#163B63]">{exp.condition}</span>
                            <span className="text-[10px] font-bold text-[#258FE5] uppercase">{exp.likelihood}</span>
                          </div>
                          <p className="text-[11px] text-[#258FE5]/70 font-light leading-relaxed">
                            {exp.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#258FE5]/60 italic font-light">
                      * Explanations are clinical possibilities to discuss with a doctor, never confirmed diagnoses.
                    </p>
                  </div>
                </div>

                {/* Section C & D: Precautions & Warning Signs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Precautions and Self-Care */}
                  <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#20B8AD]/30 shadow-subtle space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#F5F9FC]">
                      <CheckCircle2 className="w-4 h-4 text-[#258FE5]" />
                      <h3 className="text-base font-serif font-normal text-[#163B63]">
                        C. Recommended Supportive Precautions
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {activeAssessment.ai_assessment_result?.precautions?.map((prec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-[#258FE5]/80 font-light">
                          <span className="w-4 h-4 rounded-full bg-[#258FE5] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{prec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* When to Seek Immediate Medical Help */}
                  <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#20B8AD]/30 shadow-subtle space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#F5F9FC]">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <h3 className="text-base font-serif font-normal text-[#163B63]">
                        D. When to Seek Medical Help / Red Flags
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {activeAssessment.ai_assessment_result?.warning_signs?.map((ws: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-amber-900 font-light">
                          <span className="text-amber-600 font-bold shrink-0">•</span>
                          <span>{ws}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="p-3 rounded-xl bg-[#F5F9FC] text-[11px] text-[#258FE5]/80 font-light">
                      Medical helpline in India: <strong>112</strong> (National Unified Emergency Services).
                    </div>
                  </div>
                </div>

                {/* CTA to Step 5 */}
                <div className="p-6 rounded-[28px] bg-[#258FE5] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-serif font-normal">Ready to Consult a Verified Doctor?</h3>
                    <p className="text-xs text-[#F5F9FC]/80 font-light">
                      Discover specialists located near {patientLocality}, {patientCity} with real-time slot availability.
                    </p>
                  </div>
                  <Button
                    variant="champagne"
                    size="md"
                    onClick={() => setGuidedStep(5)}
                    className="bg-[#F5F9FC] text-[#163B63] hover:bg-white text-xs shrink-0 font-semibold"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    View Nearby Doctors & Book Appointment
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 5: Location-Based Verified Doctor Discovery & Real Appointment Booking */}
            {guidedStep === 5 && activeAssessment && (
              <div className="bg-white rounded-[32px] p-7 sm:p-9 border border-[#20B8AD]/30 shadow-subtle space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#F5F9FC] gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-[#258FE5]" />
                      <h2 className="text-xl font-serif font-normal text-[#163B63]">
                        Step 5: Nearby Verified Doctors & Real-Time Booking
                      </h2>
                    </div>
                    <p className="text-xs text-[#258FE5]/70 font-light">
                      Geospatially matched using Haversine great-circle distance based on your location and recommended specialties ({activeAssessment.recommended_specialties?.join(", ")}).
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGuidedStep(4)}
                    leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    Back to Guidance
                  </Button>
                </div>

                {/* Geospatial Distance & Expansion Badge */}
                <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-[#258FE5] font-semibold">
                      <MapPin className="w-4 h-4" />
                      <span>Search Center: <strong>{patientLocality}, {patientCity}</strong></span>
                      <span className="font-mono text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#DCE6EF]">
                        {patientLatitude.toFixed(4)}, {patientLongitude.toFixed(4)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      disabled={gpsDetecting}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#258FE5] text-white text-[11px] font-semibold hover:bg-[#163B63] transition-colors self-start sm:self-auto"
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${gpsDetecting ? "animate-spin" : ""}`} />
                      {gpsDetecting ? "Detecting GPS..." : "Update Current Location"}
                    </button>
                  </div>

                  {expansionMessage && (
                    <div className="text-xs text-[#258FE5] bg-white p-2.5 rounded-xl border border-[#20B8AD]/30 flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#258FE5] shrink-0" />
                      <span>{expansionMessage}</span>
                    </div>
                  )}

                  {/* Locality Quick Filters */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                    <span className="text-[#64748B] mr-1">Switch Locality:</span>
                    {[
                      { name: "Velachery", lat: 12.9815, lng: 80.2180 },
                      { name: "Greams Road", lat: 13.0604, lng: 80.2505 },
                      { name: "Adyar", lat: 13.0067, lng: 80.2570 },
                      { name: "Alwarpet", lat: 13.0336, lng: 80.2520 },
                      { name: "Anna Nagar", lat: 13.0850, lng: 80.2101 }
                    ].map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => handleSelectLocalityPreset(loc.name, loc.lat, loc.lng)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          patientLocality.toLowerCase() === loc.name.toLowerCase()
                            ? "bg-[#258FE5] text-white shadow-xs"
                            : "bg-white text-[#163B63]/80 hover:bg-[#20B8AD]/20 border border-[#20B8AD]/30"
                        }`}
                      >
                        📍 {loc.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Doctor Cards Grid */}
                {isLoadingDoctors ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-7 h-7 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-[#258FE5]/70">Discovering verified doctors near your coordinates...</p>
                  </div>
                ) : nearbyDoctors.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {nearbyDoctors.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 hover:border-[#258FE5] transition-all space-y-3 flex flex-col justify-between shadow-subtle"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[#20B8AD]/40">
                              <Image
                                src={doc.avatar || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80"}
                                alt={doc.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-[#163B63] truncate">{doc.name}</span>
                                {doc.verified && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#258FE5] text-white shrink-0">
                                    VERIFIED
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#258FE5] font-medium truncate">{doc.specialty}</div>
                              <div className="text-[11px] text-[#258FE5]/70 truncate font-light">
                                {doc.clinic_name}
                              </div>
                            </div>
                          </div>

                          {/* Distance Label Badge */}
                          <div className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-[#20B8AD]/20">
                            <span className="font-semibold text-[#163B63] flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#258FE5]" />
                              {doc.distance_label || `${doc.distance_km || 0} km away`}
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              {doc.clinic_locality || doc.clinic_city}
                            </span>
                          </div>

                          {/* Real-Time Availability Badge */}
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#163B63] bg-[#EAF5FC] px-2.5 py-1 rounded-xl border border-[#DCE6EF]">
                            <span className="w-2 h-2 rounded-full bg-[#258FE5] animate-pulse shrink-0" />
                            <span className="truncate">{doc.next_available_slot || "Available Today"}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-[#20B8AD]/20">
                            <span className="text-[#258FE5]/70">Experience</span>
                            <span className="font-semibold text-[#163B63]">★ {doc.rating} ({doc.experience_years} yrs)</span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#258FE5]/70">Consultation Fee</span>
                            <span className="font-bold text-[#163B63] font-serif text-sm">₹{doc.consultation_fee}</span>
                          </div>
                        </div>

                        {/* Booking & Profile Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <Link href={`/doctor/${doc.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-[#20B8AD]/40 text-[#258FE5]">
                              Profile
                            </Button>
                          </Link>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setBookingDoctor(doc);
                              setBookingSuccessResult(null);
                            }}
                            className="w-full text-xs h-8 bg-[#258FE5] hover:bg-[#163B63] text-white"
                          >
                            Book Slot
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-[#F5F9FC] text-center text-xs text-[#258FE5]/70 space-y-3">
                    <p>No verified doctor found within {radiusUsed} km. Try choosing another locality or expanding to city-wide.</p>
                    <Link href="/doctors">
                      <Button variant="outline" size="sm" className="text-xs">
                        Browse All MediVerse Doctors
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Historical Assessments */}
        {activeTab === "history" && (
          <div className="bg-white rounded-[32px] p-8 sm:p-10 border border-[#20B8AD]/30 shadow-subtle space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F9FC]">
              <div>
                <h2 className="text-2xl font-serif font-normal text-[#163B63]">
                  Previous Symptom Assessments
                </h2>
                <p className="text-xs text-[#258FE5]/70 font-light">
                  Review earlier clinical summaries, precautions, and recommended doctors.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveTab("check");
                  handleStartFresh();
                }}
                className="bg-[#258FE5] hover:bg-[#163B63] text-white text-xs"
              >
                New Assessment
              </Button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-7 h-7 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-[#258FE5]/70">Loading your assessments vault...</p>
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center space-y-3 max-w-sm mx-auto">
                <Activity className="w-10 h-10 text-[#20B8AD] mx-auto stroke-[1.5]" />
                <h3 className="text-base font-serif font-normal text-[#163B63]">No assessments found</h3>
                <p className="text-xs text-[#258FE5]/70 leading-relaxed font-light">
                  You haven&apos;t conducted any symptom assessments yet. Start a new assessment to evaluate your current symptoms.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setActiveTab("check");
                    handleStartFresh();
                  }}
                  className="bg-[#258FE5] text-white text-xs mt-2"
                >
                  Start Assessment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {historyList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 hover:border-[#258FE5] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            item.urgency_level === "emergency"
                              ? "bg-rose-100 text-rose-800"
                              : item.urgency_level === "urgent"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#F5F9FC] text-[#258FE5]"
                          }`}
                        >
                          {item.urgency_level}
                        </span>
                        <span className="text-xs text-[#258FE5]/60 font-light">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-[#163B63] line-clamp-1">
                        {item.original_description}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#258FE5]/70">
                        <span>Symptoms: <strong>{item.selected_symptoms?.join(", ")}</strong></span>
                        <span>•</span>
                        <span>Severity: <strong>{item.severity}</strong></span>
                        <span>•</span>
                        <span>Specialty: <strong>{item.recommended_specialties?.join(", ")}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenHistorical(item)}
                        className="bg-[#258FE5] hover:bg-[#163B63] text-white text-xs h-8 px-4"
                      >
                        Open Assessment
                      </Button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-2 rounded-lg text-[#258FE5]/50 hover:text-rose-600 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Direct In-Page Appointment Booking Modal */}
      <Modal
        isOpen={Boolean(bookingDoctor)}
        onClose={() => {
          setBookingDoctor(null);
          setBookingSuccessResult(null);
        }}
        title={`Book Appointment with ${bookingDoctor?.name || 'Doctor'}`}
        description={`${bookingDoctor?.title || 'Specialist'} • Fee: ₹${bookingDoctor?.consultation_fee || 800}`}
        size="md"
        className="max-w-lg bg-white"
      >
        <div className="space-y-4 pt-1 text-left">
          {bookingSuccessResult ? (
            <div className="p-5 rounded-2xl bg-[#EAF5FC] border border-[#DCE6EF] text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-[#20B8AD] mx-auto" />
              <h3 className="text-base font-semibold text-[#163B63]">Appointment Confirmed!</h3>
              <p className="text-xs text-[#163B63] leading-relaxed font-light">
                Your consultation reference is <strong>{bookingSuccessResult.appointment_reference}</strong>.
                The appointment has been scheduled and added to your patient calendar.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Link href="/patient/dashboard">
                  <Button variant="primary" size="sm" className="bg-[#258FE5] text-white text-xs">
                    View in Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBookingDoctor(null);
                    setBookingSuccessResult(null);
                  }}
                  className="text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#F5F9FC] border border-[#DCE6EF] text-xs text-[#258FE5] space-y-1">
                <div>Clinic: <strong>{bookingDoctor?.clinic_name}</strong></div>
                <div>Location: <strong>{bookingDoctor?.clinic_locality || bookingDoctor?.clinic_city} ({bookingDoctor?.distance_label})</strong></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#163B63] mb-1">Consultation Date *</label>
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#163B63] mb-1">Consultation Mode *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBookingType("online")}
                      className={`p-2 rounded-xl border text-[11px] font-semibold transition-all ${
                        bookingType === "online"
                          ? "bg-[#258FE5] text-white border-[#258FE5]"
                          : "bg-white text-[#163B63] border-[#CBD5E1] hover:bg-[#F5F9FC]"
                      }`}
                    >
                      📹 Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingType("in-person")}
                      className={`p-2 rounded-xl border text-[11px] font-semibold transition-all ${
                        bookingType === "in-person"
                          ? "bg-[#258FE5] text-white border-[#258FE5]"
                          : "bg-white text-[#163B63] border-[#CBD5E1] hover:bg-[#F5F9FC]"
                      }`}
                    >
                      🏥 In-Person
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Doctor-Generated Slots */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#163B63]">
                    Available Dynamic Time Slots *
                  </label>
                  <span className="text-[10px] text-[#64748B]">
                    {loadingDynamicSlots
                      ? "Querying schedule..."
                      : `${dynamicSlots.length} available slot(s)`}
                  </span>
                </div>

                {loadingDynamicSlots ? (
                  <div className="p-6 rounded-2xl bg-[#F5F9FC] border border-dashed border-[#20B8AD]/40 text-center space-y-2">
                    <div className="w-5 h-5 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] text-[#64748B]">
                      Fetching real-time practitioner availability & breaks...
                    </p>
                  </div>
                ) : dynamicSlots.length > 0 ? (
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {/* Morning */}
                    {groupedDynamicSlots.morning.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                          Morning ({groupedDynamicSlots.morning.length})
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {groupedDynamicSlots.morning.map((slot, idx) => {
                            const isSel = selectedDynamicSlot?.start_time === slot.start_time;
                            
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] bg-[#EDF5FA] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D5E4EF] p-8 sm:p-10 shadow-luxury text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#258FE5]/10 to-[#20B8AD]/20 border border-[#20B8AD]/40 flex items-center justify-center mx-auto text-[#258FE5] shadow-xs">
            <Sparkles className="w-8 h-8 text-[#20B8AD]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] text-[#123D68] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63] font-normal tracking-tight">
              Sign in to continue with your healthcare journey.
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-serif leading-relaxed font-light">
              AI Health Assistant &amp; Clinical Triage requires an authenticated patient account to provide personalized medical evaluations, safeguard your health history, and connect with verified specialists.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] text-left space-y-2 text-xs text-[#526A82] font-serif">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Personalized symptom evaluation &amp; triage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Protected medical history &amp; encrypted consultations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Direct access to verified doctor appointment booking</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white font-serif font-semibold text-sm shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>
            </Link>

            <Link
              href="/register?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] font-serif font-semibold text-sm"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
                              <button
                                key={`morn-${idx}`}
                                type="button"
                                onClick={() => handleSelectDynamicSlot(slot)}
                                className={`p-2 rounded-xl border text-center transition-all ${
                                  isSel
                                    ? "bg-[#258FE5] text-white border-[#258FE5] font-semibold shadow-xs"
                                    : "bg-white text-[#163B63] border-[#CBD5E1] hover:border-[#258FE5]"
                                }`}
                              >
                                <div className="text-xs">{slot.start_time_12h}</div>
                                <span className={`text-[9px] block ${isSel ? "text-white/80" : "text-[#64748B]"}`}>
                                  {slot.duration_minutes}m (+{slot.buffer_minutes}m)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Afternoon */}
                    {groupedDynamicSlots.afternoon.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                          Afternoon ({groupedDynamicSlots.afternoon.length})
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {groupedDynamicSlots.afternoon.map((slot, idx) => {
                            const isSel = selectedDynamicSlot?.start_time === slot.start_time;
                            
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] bg-[#EDF5FA] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D5E4EF] p-8 sm:p-10 shadow-luxury text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#258FE5]/10 to-[#20B8AD]/20 border border-[#20B8AD]/40 flex items-center justify-center mx-auto text-[#258FE5] shadow-xs">
            <Sparkles className="w-8 h-8 text-[#20B8AD]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] text-[#123D68] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63] font-normal tracking-tight">
              Sign in to continue with your healthcare journey.
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-serif leading-relaxed font-light">
              AI Health Assistant &amp; Clinical Triage requires an authenticated patient account to provide personalized medical evaluations, safeguard your health history, and connect with verified specialists.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] text-left space-y-2 text-xs text-[#526A82] font-serif">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Personalized symptom evaluation &amp; triage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Protected medical history &amp; encrypted consultations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Direct access to verified doctor appointment booking</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white font-serif font-semibold text-sm shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>
            </Link>

            <Link
              href="/register?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] font-serif font-semibold text-sm"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
                              <button
                                key={`aft-${idx}`}
                                type="button"
                                onClick={() => handleSelectDynamicSlot(slot)}
                                className={`p-2 rounded-xl border text-center transition-all ${
                                  isSel
                                    ? "bg-[#258FE5] text-white border-[#258FE5] font-semibold shadow-xs"
                                    : "bg-white text-[#163B63] border-[#CBD5E1] hover:border-[#258FE5]"
                                }`}
                              >
                                <div className="text-xs">{slot.start_time_12h}</div>
                                <span className={`text-[9px] block ${isSel ? "text-white/80" : "text-[#64748B]"}`}>
                                  {slot.duration_minutes}m (+{slot.buffer_minutes}m)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Evening */}
                    {groupedDynamicSlots.evening.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                          Evening ({groupedDynamicSlots.evening.length})
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {groupedDynamicSlots.evening.map((slot, idx) => {
                            const isSel = selectedDynamicSlot?.start_time === slot.start_time;
                            
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-serif text-[#526A82]">Verifying secure patient session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] bg-[#EDF5FA] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D5E4EF] p-8 sm:p-10 shadow-luxury text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#258FE5]/10 to-[#20B8AD]/20 border border-[#20B8AD]/40 flex items-center justify-center mx-auto text-[#258FE5] shadow-xs">
            <Sparkles className="w-8 h-8 text-[#20B8AD]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] text-[#123D68] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
              <span>Authentication Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63] font-normal tracking-tight">
              Sign in to continue with your healthcare journey.
            </h1>
            <p className="text-xs sm:text-sm text-[#526A82] font-serif leading-relaxed font-light">
              AI Health Assistant &amp; Clinical Triage requires an authenticated patient account to provide personalized medical evaluations, safeguard your health history, and connect with verified specialists.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] text-left space-y-2 text-xs text-[#526A82] font-serif">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Personalized symptom evaluation &amp; triage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Protected medical history &amp; encrypted consultations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0" />
              <span>Direct access to verified doctor appointment booking</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white font-serif font-semibold text-sm shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>
            </Link>

            <Link
              href="/register?redirect=/ai-assistant"
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] font-serif font-semibold text-sm"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
                              <button
                                key={`eve-${idx}`}
                                type="button"
                                onClick={() => handleSelectDynamicSlot(slot)}
                                className={`p-2 rounded-xl border text-center transition-all ${
                                  isSel
                                    ? "bg-[#258FE5] text-white border-[#258FE5] font-semibold shadow-xs"
                                    : "bg-white text-[#163B63] border-[#CBD5E1] hover:border-[#258FE5]"
                                }`}
                              >
                                <div className="text-xs">{slot.start_time_12h}</div>
                                <span className={`text-[9px] block ${isSel ? "text-white/80" : "text-[#64748B]"}`}>
                                  {slot.duration_minutes}m (+{slot.buffer_minutes}m)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-1">
                    <AlertCircle className="w-4 h-4 text-amber-600 mx-auto" />
                    <p className="text-xs font-semibold text-amber-900">No Slots Available</p>
                    <p className="text-[11px] text-amber-800">
                      {dynamicSlotsReason || "Doctor is not consulting on this date or mode. Please choose another date."}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#163B63] mb-1">Additional Notes for Doctor (Optional)</label>
                <textarea
                  rows={2}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Share any special concerns or medical questions..."
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#258FE5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F5F9FC]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBookingDoctor(null)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!selectedDynamicSlot || isBookingSubmitting}
                  isLoading={isBookingSubmitting}
                  className="text-xs h-9 bg-[#258FE5] hover:bg-[#163B63] text-white"
                >
                  Confirm & Reserve (₹{bookingDoctor?.consultation_fee || 800})
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="Delete Symptom Assessment"
        description="Permanently delete this symptom assessment record from your history."
        size="md"
        className="max-w-md bg-white"
      >
        <div className="space-y-4 pt-1 text-left">
          <p className="text-xs sm:text-sm text-[#258FE5]/80 leading-relaxed font-light">
            Are you sure you want to delete the assessment for <strong className="text-[#163B63]">&quot;{itemToDelete?.original_description.slice(0, 50)}...&quot;</strong>?
            This will permanently remove the record from your patient vault.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F5F9FC]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItemToDelete(null)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Authentication Gate Modal for Unauthenticated Visitors */}
      <AuthGateModal
        isOpen={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        featureName="AI Symptom Assessment"
        title="Your Health Information Deserves a Secure Space"
        description="Sign in or create an account to receive personalized AI health assessments, dynamic symptom triage, and medical guidance tailored to your health profile."
        redirectPath="/ai-assistant"
      />
    </div>
  );
}

export default function AIAssistantPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AIAssistantContent />
    </React.Suspense>
  );
}
