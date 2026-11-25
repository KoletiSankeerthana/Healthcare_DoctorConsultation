"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  User,
  Stethoscope,
  Sparkles,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = (searchParams.get("role") as "patient" | "doctor" | "admin") || "patient";
  const redirectTarget = searchParams.get("redirect") || "";

  const [role, setRole] = useState<"patient" | "doctor" | "admin">(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleDemoSelect = (selectedRole: "patient" | "doctor" | "admin", doctorType?: "venkatesh" | "arvind") => {
    setRole(selectedRole);
    setError("");
    if (selectedRole === "patient") {
      setIdentifier("aditya.vardhan@gmail.com");
      setPassword("PatientPassword@123");
    } else if (selectedRole === "doctor") {
      if (doctorType === "arvind") {
        setIdentifier("dr.arvind@apexheart.in");
        setPassword("DoctorPassword@123");
      } else {
        setIdentifier("dr.venkatesh@mediverse.in");
        setPassword("DoctorPassword@123");
      }
    } else {
      setIdentifier("admin@mediverse.org");
      setPassword("AdminPassword@123");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!identifier.trim()) {
      setError("Please provide your email address or mobile number.");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          expected_role: role
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Authentication failed. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg(data.message || "Authentication successful. Directing to your workspace...");

      // Determine target destination
      const destination = redirectTarget || data.redirect_url || (
        data.user.role === "doctor" ? "/doctor/dashboard" :
        data.user.role === "admin" ? "/admin/dashboard" : "/patient/dashboard"
      );

      setTimeout(() => {
        router.push(destination);
        router.refresh();
      }, 400);
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-14 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-left font-serif">
      <div className="max-w-md w-full space-y-7">
        {/* Minimal Luxury Logo & Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#163B63] flex items-center justify-center text-[#DCE6EF] shadow-subtle">
              <span className="font-serif text-xl italic font-normal">H</span>
            </div>
            <span className="text-2xl font-serif font-normal text-[#163B63]">
              {BRAND.name}
            </span>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
            Sign in to your sanctuary
          </h2>
          <p className="text-xs text-[#526A82] font-light">
            Secure multi-role healthcare portal access
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-[36px] bg-white border border-[#D5E4EF] p-8 sm:p-9 shadow-editorial space-y-6">
          {/* Role Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF]">
            <button
              type="button"
              onClick={() => {
                setRole("patient");
                setError("");
              }}
              className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                role === "patient"
                  ? "bg-[#258FE5] text-white shadow-xs font-bold"
                  : "text-[#526A82] hover:text-[#163B63]"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Patient</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("doctor");
                setError("");
              }}
              className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                role === "doctor"
                  ? "bg-[#258FE5] text-white shadow-xs font-bold"
                  : "text-[#526A82] hover:text-[#163B63]"
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("admin");
                setError("");
              }}
              className={`py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                role === "admin"
                  ? "bg-[#258FE5] text-white shadow-xs font-bold"
                  : "text-[#526A82] hover:text-[#163B63]"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          {/* Quick Demo Pre-fill helper */}
          <div className="p-3.5 rounded-2xl bg-[#EAF5FC]/70 border border-[#20B8AD]/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#163B63]">
              <span className="font-medium flex items-center gap-1.5 text-[#163B63]">
                <Sparkles className="w-3.5 h-3.5 text-[#258FE5]" />
                Quick Test Credentials
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDemoSelect("patient")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                  role === "patient" && identifier === "aditya.vardhan@gmail.com"
                    ? "bg-[#258FE5] text-white border-[#258FE5]"
                    : "bg-white text-[#163B63] border-[#D5E4EF] hover:bg-[#EAF5FC]"
                }`}
              >
                Patient (Aditya)
              </button>
              <button
                type="button"
                onClick={() => handleDemoSelect("doctor", "venkatesh")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                  role === "doctor" && identifier === "dr.venkatesh@mediverse.in"
                    ? "bg-[#258FE5] text-white border-[#258FE5]"
                    : "bg-white text-[#163B63] border-[#D5E4EF] hover:bg-[#EAF5FC]"
                }`}
              >
                Dr. Venkatesh (Chennai)
              </button>
              <button
                type="button"
                onClick={() => handleDemoSelect("doctor", "arvind")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                  role === "doctor" && identifier === "dr.arvind@apexheart.in"
                    ? "bg-[#258FE5] text-white border-[#258FE5]"
                    : "bg-white text-[#163B63] border-[#D5E4EF] hover:bg-[#EAF5FC]"
                }`}
              >
                Dr. Arvind (Cardiology)
              </button>
              <button
                type="button"
                onClick={() => handleDemoSelect("admin")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                  role === "admin" && identifier === "admin@mediverse.org"
                    ? "bg-[#258FE5] text-white border-[#258FE5]"
                    : "bg-white text-[#163B63] border-[#D5E4EF] hover:bg-[#EAF5FC]"
                }`}
              >
                Admin Demo
              </button>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address or Mobile Number"
              type="text"
              placeholder={
                role === "doctor"
                  ? "dr.arvind@apexheart.in"
                  : role === "admin"
                  ? "admin@mediverse.org"
                  : "aditya.vardhan@gmail.com"
              }
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<Mail className="w-4 h-4 text-[#526A82]" />}
              required
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4 text-[#526A82]" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#526A82] hover:text-[#163B63]"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
              required
            />

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-[#EAF5FC] border border-[#D5E4EF] text-xs text-[#163B63] font-medium">
                {successMsg}
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#526A82]">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-[#D5E4EF] text-[#258FE5] focus:ring-[#258FE5]"
                />
                <span>Keep me signed in</span>
              </label>
              <Link href="/forgot-password" className="text-[#258FE5] hover:underline cursor-pointer">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center h-12"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In as {role.charAt(0).toUpperCase() + role.slice(1)}
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-[#526A82] border-t border-[#D5E4EF]">
            Don&apos;t have an account?{" "}
            {role === "doctor" ? (
              <Link
                href={redirectTarget ? `/register/doctor?redirect=${encodeURIComponent(redirectTarget)}` : "/register/doctor"}
                className="text-[#258FE5] font-semibold hover:underline"
              >
                Apply as Doctor
              </Link>
            ) : (
              <Link
                href={redirectTarget ? `/register?redirect=${encodeURIComponent(redirectTarget)}` : "/register"}
                className="text-[#258FE5] font-semibold hover:underline"
              >
                Register as Patient
              </Link>
            )}
          </div>
        </div>

        <div className="text-center text-[11px] text-[#94A3B8] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
          <span>Bcrypt-encrypted credentials & HIPAA-compliant multi-role session protection.</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
