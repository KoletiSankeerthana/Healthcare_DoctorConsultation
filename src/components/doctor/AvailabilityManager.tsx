"use client";

import React, { useState, useEffect } from "react";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  Coffee,
  CalendarX,
  Sliders,
  Sparkles,
  Loader2,
  Video,
  Building2,
  CalendarCheck,
  ShieldAlert,
  Info,
  CalendarRange,
  Settings2,
  Eye,
  Check,
  ChevronRight
} from "lucide-react";

interface BreakItem {
  id?: string;
  start_time: string;
  end_time: string;
  title: string;
}

interface SessionItem {
  id?: string;
  session_name: string;
  start_time: string;
  end_time: string;
  consultation_duration: number;
  buffer_duration: number;
  consultation_modes: string[];
  clinic_location_id?: string | null;
  is_active: boolean;
}

interface DaySchedule {
  id?: string;
  weekday: number;
  weekday_name: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
  consultation_duration: number;
  buffer_duration: number;
  consultation_modes: string[];
  max_appointments: number;
  sessions: SessionItem[];
  breaks: BreakItem[];
}

interface ScheduleOverride {
  id: string;
  date: string;
  override_type: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
  is_all_day: boolean;
  consultation_modes?: string[];
  clinic_location_id?: string | null;
}

interface DoctorLeaveItem {
  id: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  start_time?: string;
  end_time?: string;
  leave_type: string;
  reason?: string;
  status: string;
  affected_appointments_count: number;
  created_at?: string;
}

interface ScheduleSettingsData {
  timezone: string;
  default_duration_minutes: number;
  buffer_minutes: number;
  minimum_notice_minutes: number;
  maximum_advance_days: number;
  maximum_appointments_per_day: number;
  same_day_booking_enabled: boolean;
  cancellation_policy: string;
  rescheduling_policy: string;
}

interface AvailabilityManagerProps {
  doctorId: string;
  doctorName?: string;
}

export const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  doctorId,
  doctorName = "Doctor"
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [activeTab, setActiveTab] = useState<"weekly" | "overrides" | "leaves" | "settings" | "preview">("weekly");
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeaveItem[]>([]);
  const [settings, setSettings] = useState<ScheduleSettingsData>({
    timezone: "Asia/Kolkata",
    default_duration_minutes: 30,
    buffer_minutes: 5,
    minimum_notice_minutes: 120,
    maximum_advance_days: 30,
    maximum_appointments_per_day: 20,
    same_day_booking_enabled: true,
    cancellation_policy: "Free cancellation up to 4 hours before consultation.",
    rescheduling_policy: "Rescheduling allowed up to 2 hours before consultation."
  });

  // Date Override Form
  const [newOverrideDate, setNewOverrideDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newOverrideType, setNewOverrideType] = useState<string>("leave");
  const [newOverrideReason, setNewOverrideReason] = useState("");
  const [newOverrideAllDay, setNewOverrideAllDay] = useState(true);
  const [newOverrideStart, setNewOverrideStart] = useState("11:00");
  const [newOverrideEnd, setNewOverrideEnd] = useState("13:00");

  // Leave Form
  const [leaveStartDate, setLeaveStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveType, setLeaveType] = useState("personal");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveIsAllDay, setLeaveIsAllDay] = useState(true);
  const [leaveStart, setLeaveStart] = useState("09:00");
  const [leaveEnd, setLeaveEnd] = useState("17:00");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveConflictWarning, setLeaveConflictWarning] = useState<any[] | null>(null);

  // Live Slot Preview
  const [previewDate, setPreviewDate] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return tmrw.toISOString().split("T")[0];
  });
  const [previewMode, setPreviewMode] = useState<"all" | "online" | "in-person">("all");
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchSchedule = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/doctors/${doctorId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        setWeeklySchedule(data.weekly_schedule || []);
        setOverrides(data.schedule_overrides || []);
        setLeaves(data.leaves || []);
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error("Failed to load doctor schedule", err);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // --- WEEKLY SCHEDULE HELPERS ---
  const handleToggleDay = (weekday: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, is_active: !d.is_active } : d))
    );
  };

  const handleAddSession = (weekday: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const newSession: SessionItem = {
          session_name: `Session ${d.sessions.length + 1}`,
          start_time: d.sessions.length === 0 ? "09:00" : "14:00",
          end_time: d.sessions.length === 0 ? "13:00" : "18:00",
          consultation_duration: settings.default_duration_minutes || 30,
          buffer_duration: settings.buffer_minutes || 5,
          consultation_modes: ["online", "in-person"],
          is_active: true
        };
        return { ...d, sessions: [...d.sessions, newSession] };
      })
    );
  };

  const handleRemoveSession = (weekday: number, sessionIdx: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        if (d.sessions.length <= 1) {
          return d; // keep at least 1 session
        }
        return { ...d, sessions: d.sessions.filter((_, idx) => idx !== sessionIdx) };
      })
    );
  };

  const handleUpdateSession = (weekday: number, sessionIdx: number, field: keyof SessionItem, value: any) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const updated = d.sessions.map((s, idx) => (idx === sessionIdx ? { ...s, [field]: value } : s));
        return { ...d, sessions: updated };
      })
    );
  };

  const handleAddBreak = (weekday: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const newBreak: BreakItem = {
          start_time: "13:00",
          end_time: "14:00",
          title: "Lunch / Clinical Break"
        };
        return { ...d, breaks: [...d.breaks, newBreak] };
      })
    );
  };

  const handleRemoveBreak = (weekday: number, breakIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        return { ...d, breaks: d.breaks.filter((_, idx) => idx !== breakIndex) };
      })
    );
  };

  const handleUpdateBreak = (weekday: number, breakIndex: number, field: keyof BreakItem, val: string) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const updatedBreaks = d.breaks.map((b, idx) => (idx === breakIndex ? { ...b, [field]: val } : b));
        return { ...d, breaks: updatedBreaks };
      })
    );
  };

  const handleSaveWeeklySchedule = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/doctors/${doctorId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekly_schedule: weeklySchedule })
      });
      if (res.ok) {
        fetchSchedule();
        setFeedback({ type: "success", text: "Weekly schedule, sessions, and breaks saved successfully." });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: "Failed to update weekly schedule in database." });
      }
    } catch (err) {
      setFeedback({ type: "error", text: "Network connection error occurred." });
    } finally {
      setSaving(false);
    }
  };

  // --- DATE OVERRIDES HELPERS ---
  const handleAddOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        action: "add_override",
        date: newOverrideDate,
        override_type: newOverrideType,
        reason: newOverrideReason || (newOverrideType === "holiday" ? "Clinic Holiday" : "Date Exception"),
        is_all_day: newOverrideAllDay,
        start_time: newOverrideAllDay ? null : newOverrideStart,
        end_time: newOverrideAllDay ? null : newOverrideEnd
      };

      const res = await fetch(`/api/doctors/${doctorId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchSchedule();
        setNewOverrideReason("");
        setFeedback({ type: "success", text: `Date override for ${newOverrideDate} added.` });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error("Failed to add override", err);
    }
  };

  const handleRemoveOverride = async (overrideId: string) => {
    try {
      const res = await fetch(`/api/doctors/${doctorId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_override", override_id: overrideId })
      });
      if (res.ok) {
        fetchSchedule();
        setFeedback({ type: "success", text: "Date override removed." });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Failed to remove override", err);
    }
  };

  // --- LEAVE MANAGEMENT HELPERS ---
  const handleAddLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveSubmitting(true);
    setLeaveConflictWarning(null);
    try {
      const payload = {
        action: "add_leave",
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        is_all_day: leaveIsAllDay,
        start_time: leaveIsAllDay ? null : leaveStart,
        end_time: leaveIsAllDay ? null : leaveEnd,
        leave_type: leaveType,
        reason: leaveReason || "Personal Leave"
      };

      const res = await fetch(`/api/doctors/${doctorId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchSchedule();
        setLeaveReason("");
        if (data.affected_count > 0) {
          setLeaveConflictWarning(data.affected_appointments);
          setFeedback({
            type: "success",
            text: `Leave saved. Notice: ${data.affected_count} existing appointment(s) conflict with this leave.`
          });
        } else {
          setFeedback({ type: "success", text: "Leave registered with zero appointment conflicts." });
          setTimeout(() => setFeedback(null), 4000);
        }
      }
    } catch (err) {
      console.error("Failed to save leave", err);
      setFeedback({ type: "error", text: "Failed to register leave." });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    try {
      const res = await fetch(`/api/doctors/${doctorId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_leave", leave_id: leaveId })
      });
      if (res.ok) {
        fetchSchedule();
        setFeedback({ type: "success", text: "Leave schedule cancelled." });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Failed to cancel leave", err);
    }
  };

  // --- SETTINGS HELPERS ---
  const handleSaveSettings = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/doctors/${doctorId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", ...settings })
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Practitioner schedule configuration updated." });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: "Failed to update settings in database." });
      }
    } catch (err) {
      setFeedback({ type: "error", text: "Network error occurred." });
    } finally {
      setSaving(false);
    }
  };

  // --- LIVE PREVIEW HELPERS ---
  const handleLoadPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/doctors/${doctorId}/availability?date=${previewDate}&mode=${previewMode}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      }
    } catch (err) {
      console.error("Preview load failed", err);
    } finally {
      setLoadingPreview(false);
    }
  };

  if (loading) {
    return (
      <div className="p-14 text-center space-y-3 bg-white rounded-3xl border border-[#DCE6EF]">
        <Loader2 className="w-8 h-8 text-[#258FE5] animate-spin mx-auto" />
        <p className="text-xs text-[#64748B]">Loading your clinical availability schedule...</p>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] bg-white border border-[#DCE6EF] p-6 sm:p-8 shadow-subtle space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE6EF]">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#258FE5]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#258FE5]">
              Practitioner Availability Engine
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-serif text-[#163B63] mt-1">
            Availability & Schedule Management
          </h3>
          <p className="text-xs text-[#64748B]">
            Configure multi-session daily hours, buffer intervals, leaves, and notice windows for Dr. {doctorName}.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-[#F5F9FC] border border-[#DCE6EF]">
          <button
            type="button"
            onClick={() => setActiveTab("weekly")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "weekly" ? "bg-[#258FE5] text-white shadow-xs" : "text-[#64748B] hover:text-[#163B63]"
            }`}
          >
            Weekly Schedule
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overrides")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "overrides" ? "bg-[#258FE5] text-white shadow-xs" : "text-[#64748B] hover:text-[#163B63]"
            }`}
          >
            Date Overrides ({overrides.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leaves")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "leaves" ? "bg-[#258FE5] text-white shadow-xs" : "text-[#64748B] hover:text-[#163B63]"
            }`}
          >
            Leaves ({leaves.filter((l) => l.status === "active").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "settings" ? "bg-[#258FE5] text-white shadow-xs" : "text-[#64748B] hover:text-[#163B63]"
            }`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("preview");
              handleLoadPreview();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "preview" ? "bg-[#258FE5] text-white shadow-xs" : "text-[#64748B] hover:text-[#163B63]"
            }`}
          >
            Live Slot Preview
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-[#EAF5FC] border border-[#DCE6EF] text-[#163B63]"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#20B8AD]" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: WEEKLY RECURRING SCHEDULE & MULTIPLE WORKING SESSIONS
         ========================================================================= */}
      {activeTab === "weekly" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">
              Define weekly recurring availability with multiple working sessions per day (e.g. morning OPD & evening telehealth).
            </p>
            <Button
              variant="primary"
              size="sm"
              isLoading={saving}
              onClick={handleSaveWeeklySchedule}
              leftIcon={<Save className="w-3.5 h-3.5" />}
              className="bg-[#258FE5] hover:bg-[#163B63] text-white text-xs"
            >
              Save Weekly Schedule
            </Button>
          </div>

          <div className="space-y-4">
            {weeklySchedule.map((day) => (
              <div
                key={day.weekday}
                className={`p-4 rounded-2xl border transition-all ${
                  day.is_active
                    ? "bg-white border-[#DCE6EF] shadow-xs"
                    : "bg-[#F5F9FC]/80 border-dashed border-[#CBD5E1] opacity-75"
                }`}
              >
                {/* Day Header & Toggle */}
                <div className="flex items-center justify-between pb-3 border-b border-[#F5F9FC]">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.is_active}
                        onChange={() => handleToggleDay(day.weekday)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#258FE5]"></div>
                    </label>
                    <div>
                      <span className="font-semibold text-sm text-[#163B63]">{day.weekday_name}</span>
                      <span className="ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#F5F9FC] text-[#258FE5]">
                        {day.is_active ? `${day.sessions?.length || 1} Session(s)` : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {day.is_active && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddSession(day.weekday)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#258FE5] hover:underline px-2 py-1 rounded bg-[#F5F9FC]"
                      >
                        <Plus className="w-3 h-3" /> Add Session
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBreak(day.weekday)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:underline px-2 py-1 rounded bg-[#F5F9FC]"
                      >
                        <Coffee className="w-3 h-3" /> Add Break
                      </button>
                    </div>
                  )}
                </div>

                {/* Day Active Configuration */}
                {day.is_active && (
                  <div className="pt-3 space-y-3">
                    {/* Multiple Sessions */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Working Sessions
                      </span>

                      {day.sessions && day.sessions.length > 0 ? (
                        day.sessions.map((sess, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-3 rounded-xl bg-[#F5F9FC] border border-[#20B8AD]/30 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                          >
                            <div className="sm:col-span-3">
                              <label className="text-[10px] text-[#64748B] block mb-0.5">Session Name</label>
                              <input
                                type="text"
                                value={sess.session_name}
                                onChange={(e) => handleUpdateSession(day.weekday, sIdx, "session_name", e.target.value)}
                                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-[#64748B] block mb-0.5">Start Time</label>
                              <input
                                type="time"
                                value={sess.start_time}
                                onChange={(e) => handleUpdateSession(day.weekday, sIdx, "start_time", e.target.value)}
                                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-[#64748B] block mb-0.5">End Time</label>
                              <input
                                type="time"
                                value={sess.end_time}
                                onChange={(e) => handleUpdateSession(day.weekday, sIdx, "end_time", e.target.value)}
                                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-[#64748B] block mb-0.5">Duration (mins)</label>
                              <select
                                value={sess.consultation_duration}
                                onChange={(e) => handleUpdateSession(day.weekday, sIdx, "consultation_duration", Number(e.target.value))}
                                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                              >
                                <option value={15}>15 mins</option>
                                <option value={20}>20 mins</option>
                                <option value={30}>30 mins</option>
                                <option value={45}>45 mins</option>
                                <option value={60}>60 mins</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-[#64748B] block mb-0.5">Buffer (mins)</label>
                              <select
                                value={sess.buffer_duration}
                                onChange={(e) => handleUpdateSession(day.weekday, sIdx, "buffer_duration", Number(e.target.value))}
                                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                              >
                                <option value={0}>0 min</option>
                                <option value={5}>5 mins</option>
                                <option value={10}>10 mins</option>
                                <option value={15}>15 mins</option>
                              </select>
                            </div>

                            <div className="sm:col-span-1 flex justify-end">
                              {day.sessions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSession(day.weekday, sIdx)}
                                  className="text-rose-500 hover:text-rose-700 p-1"
                                  title="Remove Session"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[#64748B] italic">No active sessions. Click &quot;Add Session&quot; to configure hours.</div>
                      )}
                    </div>

                    {/* Breaks */}
                    {day.breaks && day.breaks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                          Breaks & Blocked Periods
                        </span>
                        {day.breaks.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2 text-xs bg-[#F5F9FC] p-2 rounded-xl border border-[#DCE6EF]">
                            <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <input
                              type="text"
                              value={b.title}
                              onChange={(e) => handleUpdateBreak(day.weekday, bIdx, "title", e.target.value)}
                              className="px-2 py-0.5 rounded border border-[#CBD5E1] text-xs bg-white w-40"
                              placeholder="Break Name"
                            />
                            <span>from</span>
                            <input
                              type="time"
                              value={b.start_time}
                              onChange={(e) => handleUpdateBreak(day.weekday, bIdx, "start_time", e.target.value)}
                              className="px-2 py-0.5 rounded border border-[#CBD5E1] text-xs bg-white"
                            />
                            <span>to</span>
                            <input
                              type="time"
                              value={b.end_time}
                              onChange={(e) => handleUpdateBreak(day.weekday, bIdx, "end_time", e.target.value)}
                              className="px-2 py-0.5 rounded border border-[#CBD5E1] text-xs bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveBreak(day.weekday, bIdx)}
                              className="text-rose-500 hover:text-rose-700 ml-auto p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CALENDAR & DATE-SPECIFIC OVERRIDES
         ========================================================================= */}
      {activeTab === "overrides" && (
        <div className="space-y-6">
          <p className="text-xs text-[#64748B]">
            Configure date-specific schedule modifications, extra consultation hours, or mark full days unavailable.
          </p>

          <form onSubmit={handleAddOverrideSubmit} className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 space-y-3">
            <span className="text-xs font-semibold text-[#163B63]">Add Date Override</span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Target Date *</label>
                <input
                  type="date"
                  value={newOverrideDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setNewOverrideDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Override Type *</label>
                <select
                  value={newOverrideType}
                  onChange={(e) => setNewOverrideType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                >
                  <option value="leave">Scheduled Leave</option>
                  <option value="holiday">Official Holiday</option>
                  <option value="blocked_time">Blocked Hours</option>
                  <option value="extra_hours">Extra Working Hours</option>
                  <option value="change_hours">Modified Working Hours</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] text-[#64748B] block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={newOverrideReason}
                  onChange={(e) => setNewOverrideReason(e.target.value)}
                  placeholder="e.g. Medical Conference / Personal Leave"
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newOverrideAllDay}
                  onChange={(e) => setNewOverrideAllDay(e.target.checked)}
                  className="rounded text-[#258FE5] focus:ring-[#258FE5]"
                />
                <span>Entire Day Unavailable / Active</span>
              </label>

              {!newOverrideAllDay && (
                <div className="flex items-center gap-2">
                  <span>From:</span>
                  <input
                    type="time"
                    value={newOverrideStart}
                    onChange={(e) => setNewOverrideStart(e.target.value)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] text-xs bg-white"
                  />
                  <span>To:</span>
                  <input
                    type="time"
                    value={newOverrideEnd}
                    onChange={(e) => setNewOverrideEnd(e.target.value)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] text-xs bg-white"
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="ml-auto bg-[#258FE5] hover:bg-[#163B63] text-white text-xs h-8"
              >
                Save Override
              </Button>
            </div>
          </form>

          {/* Overrides Table */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#163B63]">Configured Overrides ({overrides.length})</span>
            {overrides.length === 0 ? (
              <p className="text-xs text-[#64748B] italic">No upcoming date overrides. The weekly recurring schedule will apply.</p>
            ) : (
              <div className="space-y-2">
                {overrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="p-3 rounded-xl bg-white border border-[#DCE6EF] flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#163B63]">{ov.date}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#F5F9FC] text-[#258FE5]">
                          {ov.override_type}
                        </span>
                        {ov.is_all_day ? (
                          <span className="text-[#64748B] text-[11px]">All Day</span>
                        ) : (
                          <span className="text-[#64748B] text-[11px]">{ov.start_time} - {ov.end_time}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B]">{ov.reason || "No notes provided"}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveOverride(ov.id)}
                      className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50"
                      title="Remove Override"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: LEAVE MANAGEMENT & CONFLICT DETECTION
         ========================================================================= */}
      {activeTab === "leaves" && (
        <div className="space-y-6">
          <p className="text-xs text-[#64748B]">
            Register personal, medical, or conference leaves. mediVerse automatically checks for conflicting confirmed appointments and warns you immediately.
          </p>

          <form onSubmit={handleAddLeaveSubmit} className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30 space-y-3">
            <span className="text-xs font-semibold text-[#163B63]">Register Doctor Leave</span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Start Date *</label>
                <input
                  type="date"
                  value={leaveStartDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    setLeaveStartDate(e.target.value);
                    if (e.target.value > leaveEndDate) setLeaveEndDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">End Date *</label>
                <input
                  type="date"
                  value={leaveEndDate}
                  min={leaveStartDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Leave Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                >
                  <option value="personal">Personal Leave</option>
                  <option value="medical">Medical Emergency</option>
                  <option value="vacation">Annual Vacation</option>
                  <option value="conference">Medical Conference / CME</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Reason / Description</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Attending Cardiology Summit"
                  className="w-full px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leaveIsAllDay}
                  onChange={(e) => setLeaveIsAllDay(e.target.checked)}
                  className="rounded text-[#258FE5] focus:ring-[#258FE5]"
                />
                <span>Full Day Leave</span>
              </label>

              {!leaveIsAllDay && (
                <div className="flex items-center gap-2">
                  <span>Between:</span>
                  <input
                    type="time"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] text-xs bg-white"
                  />
                  <span>and:</span>
                  <input
                    type="time"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] text-xs bg-white"
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={leaveSubmitting}
                className="ml-auto bg-[#258FE5] hover:bg-[#163B63] text-white text-xs h-8"
              >
                Register Leave
              </Button>
            </div>
          </form>

          {/* Conflict Alert Warning */}
          {leaveConflictWarning && leaveConflictWarning.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Conflict Notice: {leaveConflictWarning.length} booked consultation(s) require attention:</span>
              </div>
              <div className="space-y-1 pl-6">
                {leaveConflictWarning.map((c: any) => (
                  <div key={c.id} className="text-amber-800">
                    • <strong>{c.date} ({c.time})</strong> - {c.patient_name} ({c.patient_phone}) [Ref: {c.reference}]
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaves List */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#163B63]">Registered Leaves ({leaves.length})</span>
            {leaves.length === 0 ? (
              <p className="text-xs text-[#64748B] italic">No active or scheduled leaves found.</p>
            ) : (
              <div className="space-y-2">
                {leaves.map((lv) => (
                  <div
                    key={lv.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      lv.status === "cancelled" ? "bg-gray-50 border-gray-200 opacity-60" : "bg-white border-[#DCE6EF]"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#163B63]">
                          {lv.start_date === lv.end_date ? lv.start_date : `${lv.start_date} to ${lv.end_date}`}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#F5F9FC] text-[#258FE5]">
                          {lv.leave_type}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          lv.status === "active" ? "bg-[#EAF5FC] text-[#163B63]" : "bg-gray-200 text-gray-700"
                        }`}>
                          {lv.status}
                        </span>
                        {lv.affected_appointments_count > 0 && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {lv.affected_appointments_count} conflicting appointment(s)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B]">{lv.reason || "Personal Leave"}</p>
                    </div>

                    {lv.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleCancelLeave(lv.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded bg-rose-50 self-start sm:self-auto"
                      >
                        Cancel Leave
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: SCHEDULE CONFIGURATION SETTINGS
         ========================================================================= */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748B]">
              Configure booking advance windows, minimum notice cutoffs, daily caps, and cancellation policies.
            </p>
            <Button
              variant="primary"
              size="sm"
              isLoading={saving}
              onClick={handleSaveSettings}
              leftIcon={<Save className="w-3.5 h-3.5" />}
              className="bg-[#258FE5] hover:bg-[#163B63] text-white text-xs"
            >
              Save Settings
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-[#DCE6EF] space-y-3">
              <span className="font-semibold text-sm text-[#163B63] block">Booking Windows & Cutoffs</span>

              <div>
                <label className="text-[11px] text-[#64748B] block mb-1">Minimum Booking Notice</label>
                <select
                  value={settings.minimum_notice_minutes}
                  onChange={(e) => setSettings({ ...settings, minimum_notice_minutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                >
                  <option value={30}>30 minutes before appointment</option>
                  <option value={60}>1 hour before appointment</option>
                  <option value={120}>2 hours before appointment (Recommended)</option>
                  <option value={240}>4 hours before appointment</option>
                  <option value={1440}>24 hours before appointment</option>
                </select>
                <p className="text-[10px] text-[#64748B] mt-1">Prevents unexpected last-minute patient reservations.</p>
              </div>

              <div>
                <label className="text-[11px] text-[#64748B] block mb-1">Maximum Advance Booking Window</label>
                <select
                  value={settings.maximum_advance_days}
                  onChange={(e) => setSettings({ ...settings, maximum_advance_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                >
                  <option value={7}>7 days in advance</option>
                  <option value={14}>14 days in advance</option>
                  <option value={30}>30 days in advance (Standard)</option>
                  <option value={60}>60 days in advance</option>
                  <option value={90}>90 days in advance</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.same_day_booking_enabled}
                    onChange={(e) => setSettings({ ...settings, same_day_booking_enabled: e.target.checked })}
                    className="rounded text-[#258FE5] focus:ring-[#258FE5]"
                  />
                  <span className="font-medium text-[#163B63]">Allow Same-Day Bookings</span>
                </label>
                <p className="text-[10px] text-[#64748B] mt-0.5 ml-6">
                  When enabled, patients can book available slots on the current day subject to notice cutoff.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#DCE6EF] space-y-3">
              <span className="font-semibold text-sm text-[#163B63] block">Capacities & Slot Sizing</span>

              <div>
                <label className="text-[11px] text-[#64748B] block mb-1">Maximum Consultations Per Day</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.maximum_appointments_per_day}
                  onChange={(e) => setSettings({ ...settings, maximum_appointments_per_day: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">Daily cap protecting against physician fatigue.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#64748B] block mb-1">Default Duration</label>
                  <select
                    value={settings.default_duration_minutes}
                    onChange={(e) => setSettings({ ...settings, default_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  >
                    <option value={15}>15 mins</option>
                    <option value={20}>20 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#64748B] block mb-1">Buffer Spacing</label>
                  <select
                    value={settings.buffer_minutes}
                    onChange={(e) => setSettings({ ...settings, buffer_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  >
                    <option value={0}>0 min</option>
                    <option value={5}>5 mins</option>
                    <option value={10}>10 mins</option>
                    <option value={15}>15 mins</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#64748B] block mb-1">Timezone</label>
                <input
                  type="text"
                  disabled
                  value={settings.timezone}
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE6EF] text-xs bg-[#F5F9FC] text-[#64748B]"
                />
              </div>
            </div>

            <div className="sm:col-span-2 p-4 rounded-2xl bg-white border border-[#DCE6EF] space-y-3">
              <span className="font-semibold text-sm text-[#163B63] block">Practitioner Policies</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-[#64748B] block mb-1">Cancellation Policy</label>
                  <textarea
                    rows={2}
                    value={settings.cancellation_policy}
                    onChange={(e) => setSettings({ ...settings, cancellation_policy: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#64748B] block mb-1">Rescheduling Policy</label>
                  <textarea
                    rows={2}
                    value={settings.rescheduling_policy}
                    onChange={(e) => setSettings({ ...settings, rescheduling_policy: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#258FE5]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: REAL-TIME DYNAMIC SLOT PREVIEW
         ========================================================================= */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F5F9FC] border border-[#20B8AD]/30">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Preview Date</label>
                <input
                  type="date"
                  value={previewDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setPreviewDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Consultation Mode</label>
                <select
                  value={previewMode}
                  onChange={(e) => setPreviewMode(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs bg-white"
                >
                  <option value="all">All Modes</option>
                  <option value="online">Online Video Only</option>
                  <option value="in-person">In-Person Clinic Only</option>
                </select>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={loadingPreview}
              onClick={handleLoadPreview}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              className="bg-[#258FE5] hover:bg-[#163B63] text-white text-xs h-8 self-start sm:self-auto"
            >
              Simulate Live Engine
            </Button>
          </div>

          {/* Results */}
          {loadingPreview ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-[#258FE5] animate-spin mx-auto" />
              <p className="text-xs text-[#64748B]">Calculating dynamic available slots...</p>
            </div>
          ) : previewData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#DCE6EF]">
                <div>
                  <span className="font-semibold text-[#163B63]">
                    Status for {previewData.date}: {previewData.available ? "Available" : "Unavailable"}
                  </span>
                  {!previewData.available && previewData.reason && (
                    <span className="ml-2 text-rose-600 font-medium">({previewData.reason})</span>
                  )}
                </div>
                <span className="font-bold text-[#258FE5]">
                  {previewData.total_available_slots || 0} Bookable Slot(s)
                </span>
              </div>

              {previewData.available ? (
                <div className="space-y-4">
                  {/* Morning */}
                  {previewData.grouped_slots?.morning?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Morning Slots ({previewData.grouped_slots.morning.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {previewData.grouped_slots.morning.map((s: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl border border-[#20B8AD]/40 bg-[#F5F9FC] text-center space-y-0.5"
                          >
                            <div className="font-semibold text-xs text-[#163B63]">{s.start_time_12h}</div>
                            <div className="text-[10px] text-[#64748B]">{s.duration_minutes}m (+{s.buffer_minutes}m buf)</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Afternoon */}
                  {previewData.grouped_slots?.afternoon?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Afternoon Slots ({previewData.grouped_slots.afternoon.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {previewData.grouped_slots.afternoon.map((s: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl border border-[#20B8AD]/40 bg-[#F5F9FC] text-center space-y-0.5"
                          >
                            <div className="font-semibold text-xs text-[#163B63]">{s.start_time_12h}</div>
                            <div className="text-[10px] text-[#64748B]">{s.duration_minutes}m (+{s.buffer_minutes}m buf)</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evening */}
                  {previewData.grouped_slots?.evening?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Evening Slots ({previewData.grouped_slots.evening.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {previewData.grouped_slots.evening.map((s: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl border border-[#20B8AD]/40 bg-[#F5F9FC] text-center space-y-0.5"
                          >
                            <div className="font-semibold text-xs text-[#163B63]">{s.start_time_12h}</div>
                            <div className="text-[10px] text-[#64748B]">{s.duration_minutes}m (+{s.buffer_minutes}m buf)</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#F5F9FC] text-center text-xs text-[#64748B]">
                  No bookable slots on this date: {previewData.reason || "Doctor unavailable."}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
export default AvailabilityManager;
