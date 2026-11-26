"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Button } from "@/components/ui/Button";
import {
  User,
  Shield,
  KeyRound,
  Stethoscope,
  Calendar,
  LayoutDashboard,
  CheckCircle2,
  Mail,
  ChevronRight,
  ShieldCheck,
  ArrowLeft
} from "lucide-react";

interface UserSessionData {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  full_name?: string;
  name?: string;
  phone?: string;
  specialization?: string;
  doctor_id?: string;
  patient_id?: string;
}

function AccountSettingsContent() {
  const router = useRouter();
  const [user, setUser] = useState<UserSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
          } else {
            // Not authenticated, redirect to login
            router.push("/auth/login?redirect=/account/settings");
          }
        } else {
          router.push("/auth/login?redirect=/account/settings");
        }
      } catch (err) {
        console.error("Failed to load user session", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EDF5FA] flex flex-col items-center justify-center p-6 font-serif">
        <div className="w-10 h-10 border-3 border-[#258FE5] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-[#526A82]">Loading account settings...</p>
      </div>
    );
  }

  const role = user?.role || "patient";
  const displayName = user?.full_name || user?.name || (role === "doctor" ? "Doctor" : "Patient");
  const dashboardHref =
    role === "doctor"
      ? "/doctor/dashboard"
      : role === "admin"
      ? "/admin/dashboard"
      : "/patient/dashboard";

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-8 sm:py-12 font-serif text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-1.5 text-xs text-[#526A82] hover:text-[#258FE5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to {role === "doctor" ? "Doctor Workspace" : role === "admin" ? "Admin Portal" : "Dashboard"}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-[#526A82]">Active Session</span>
          </div>
        </div>

        {/* Top Header Card */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D5E4EF] shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-[#D5E4EF] bg-[#F5F9FC] flex items-center justify-center">
              <Image
                src={BRAND.logo}
                alt={BRAND.displayName}
                fill
                className="object-contain p-2"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#258FE5]">
                  {BRAND.name} Security
                </span>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    role === "doctor"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : role === "admin"
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-[#258FE5]/10 text-[#258FE5] border border-[#258FE5]/30"
                  }`}
                >
                  {role} Account
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
                Account Settings &amp; Security
              </h1>
              <p className="text-xs sm:text-sm text-[#526A82]">
                Manage your credentials, password security, and account preferences.
              </p>
            </div>
          </div>

          <Link href={dashboardHref}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<LayoutDashboard className="w-3.5 h-3.5" />}
              className="text-xs shrink-0"
            >
              Open Dashboard
            </Button>
          </Link>
        </div>

        {/* Two Column Layout: User Details & Shortcuts on left, Change Password on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Account Profile Summary & Shortcuts */}
          <div className="space-y-6 lg:col-span-1">
            {/* Account Card */}
            <div className="bg-white rounded-3xl p-6 border border-[#D5E4EF] shadow-subtle space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#EAF5FC] text-[#258FE5] flex items-center justify-center font-bold text-lg">
                  {role === "doctor" ? <Stethoscope className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div>
                  <div className="font-semibold text-sm text-[#163B63]">{displayName}</div>
                  <div className="text-xs text-[#526A82] flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#94A3B8]" />
                    <span className="truncate max-w-[170px]">{user?.email}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#D5E4EF] space-y-2 text-xs">
                <div className="flex justify-between items-center text-[#526A82]">
                  <span>Account Type</span>
                  <span className="font-semibold text-[#163B63] capitalize">{role}</span>
                </div>
                {user?.specialization && (
                  <div className="flex justify-between items-center text-[#526A82]">
                    <span>Specialization</span>
                    <span className="font-semibold text-[#163B63]">{user.specialization}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[#526A82]">
                  <span>Security Status</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Active
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Navigation Links */}
            <div className="bg-white rounded-3xl p-6 border border-[#D5E4EF] shadow-subtle space-y-3">
              <div className="text-xs font-semibold text-[#163B63] uppercase tracking-wider mb-2">
                Quick Shortcuts
              </div>

              {role === "patient" && (
                <>
                  <Link
                    href="/patient/profile"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F9FC] text-xs text-[#163B63] font-medium transition-colors border border-transparent hover:border-[#D5E4EF]"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#258FE5]" />
                      Edit Health Profile
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                  </Link>
                  <Link
                    href="/patient/dashboard"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F9FC] text-xs text-[#163B63] font-medium transition-colors border border-transparent hover:border-[#D5E4EF]"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#20B8AD]" />
                      My Appointments
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                  </Link>
                </>
              )}

              {role === "doctor" && (
                <>
                  <Link
                    href="/doctor/dashboard"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F9FC] text-xs text-[#163B63] font-medium transition-colors border border-transparent hover:border-[#D5E4EF]"
                  >
                    <span className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-[#258FE5]" />
                      Physician Workspace
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                  </Link>
                  <Link
                    href="/doctor/dashboard"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F9FC] text-xs text-[#163B63] font-medium transition-colors border border-transparent hover:border-[#D5E4EF]"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#20B8AD]" />
                      Appointment Schedule
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                  </Link>
                </>
              )}

              {role === "admin" && (
                <Link
                  href="/admin/dashboard"
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F5F9FC] text-xs text-[#163B63] font-medium transition-colors border border-transparent hover:border-[#D5E4EF]"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#258FE5]" />
                    Admin Approvals Portal
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </Link>
              )}
            </div>

            {/* Security Tip Card */}
            <div className="bg-[#EAF5FC] rounded-3xl p-5 border border-[#258FE5]/20 space-y-2 text-xs text-[#163B63]">
              <div className="font-semibold flex items-center gap-1.5 text-[#258FE5]">
                <ShieldCheck className="w-4 h-4" />
                Healvia Security Tip
              </div>
              <p className="text-[11px] text-[#526A82] leading-relaxed">
                Use a password with a combination of uppercase letters, numbers, and symbols. We notify you via email whenever password changes occur.
              </p>
            </div>
          </div>

          {/* Right Column: Change Password Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[32px] p-7 sm:p-9 border border-[#D5E4EF] shadow-subtle">
              <ChangePasswordForm userRole={role} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#EDF5FA] flex items-center justify-center p-6 font-serif">
          <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AccountSettingsContent />
    </Suspense>
  );
}
