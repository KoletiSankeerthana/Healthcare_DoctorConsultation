"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Stethoscope,
  User,
  KeyRound,
  RotateCw
} from "lucide-react";

type RecoveryStep = "REQUEST_CODE" | "VERIFY_CODE" | "SET_NEW_PASSWORD" | "SUCCESS";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Role: "patient" or "doctor" (preselect from query param ?role=...)
  const initialRole = searchParams.get("role") === "doctor" ? "doctor" : "patient";
  const [role, setRole] = useState<"patient" | "doctor">(initialRole);

  // Workflow state
  const [step, setStep] = useState<RecoveryStep>("REQUEST_CODE");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Synchronize role if search param changes
  useEffect(() => {
    const urlRole = searchParams.get("role");
    if (urlRole === "doctor" || urlRole === "patient") {
      setRole(urlRole);
    }
  }, [searchParams]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle switching account role
  const handleRoleChange = (newRole: "patient" | "doctor") => {
    setRole(newRole);
    setError("");
    setSuccessMsg("");
  };

  // STEP 1: Request OTP
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, role })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to send verification code. Please check your credentials.");
        return;
      }

      setSuccessMsg(data.message || `A verification code has been sent to ${cleanEmail}.`);
      setResendCooldown(60);
      setStep("VERIFY_CODE");
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role, otp: cleanOtp })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Invalid or expired verification code.");
        return;
      }

      setResetToken(data.reset_token);
      setSuccessMsg("Code verified! Please create your new password.");
      setStep("SET_NEW_PASSWORD");
    } catch (err: any) {
      setError(err.message || "Verification failed. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setError("");
    setSuccessMsg("");

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to resend code.");
        return;
      }

      setSuccessMsg("A new verification code has been sent to your email.");
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters in length.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify your entries.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to reset password. Please start over.");
        return;
      }

      setSuccessMsg(data.message || "Your password has been successfully reset.");
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message || "Password update failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center font-serif text-left">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex flex-col items-center gap-2 group">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-[#D5E4EF] shadow-subtle group-hover:scale-105 transition-transform bg-white">
              <Image
                src={BRAND.logo}
                alt={BRAND.displayName}
                fill
                className="object-contain p-0.5"
                priority
              />
            </div>
            <span className="text-2xl font-serif font-bold text-[#163B63] tracking-tight">
              {BRAND.displayName}
            </span>
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-[#258FE5] font-semibold">
            {BRAND.tagline}
          </p>
        </div>

        {/* Recovery Card */}
        <div className="bg-white p-8 rounded-[32px] border border-[#D5E4EF] shadow-editorial space-y-6">
          {/* Account Role Selector Tabs (Only active in initial request step) */}
          {step === "REQUEST_CODE" && (
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF]">
              <button
                type="button"
                onClick={() => handleRoleChange("patient")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  role === "patient"
                    ? "bg-[#258FE5] text-white shadow-xs"
                    : "text-[#526A82] hover:text-[#163B63]"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Patient Account</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("doctor")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  role === "doctor"
                    ? "bg-[#258FE5] text-white shadow-xs"
                    : "text-[#526A82] hover:text-[#163B63]"
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Doctor Account</span>
              </button>
            </div>
          )}

          {/* Feedback Alerts */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && step !== "SUCCESS" && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* =========================================================================
              STAGE 1: REQUEST VERIFICATION CODE
             ========================================================================= */}
          {step === "REQUEST_CODE" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                    {role === "doctor" ? "Doctor Recovery" : "Patient Recovery"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
                  Forgot Your Password?
                </h1>
                <p className="text-xs sm:text-sm text-[#526A82] font-light leading-relaxed">
                  Enter your registered email address. We will send you a verification code to reset your password.
                </p>
              </div>

              <form onSubmit={handleRequestCode} className="space-y-4 pt-1">
                <Input
                  label="Registered Email Address"
                  type="email"
                  placeholder={role === "doctor" ? "doctor@hospital.in" : "patient@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4 text-[#526A82]" />}
                  required
                  autoFocus
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center h-12"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Send Verification Code
                </Button>
              </form>

              <div className="pt-2 text-center text-xs text-[#526A82] border-t border-[#D5E4EF]">
                <Link
                  href={`/login?role=${role}`}
                  className="inline-flex items-center gap-1.5 text-[#258FE5] font-semibold hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </div>
          )}

          {/* =========================================================================
              STAGE 2: ENTER OTP VERIFICATION CODE
             ========================================================================= */}
          {step === "VERIFY_CODE" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                    Step 2 of 3 • Verification
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("REQUEST_CODE");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="text-[11px] text-[#526A82] hover:text-[#258FE5] underline"
                  >
                    Change Email
                  </button>
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
                  Enter Verification Code
                </h1>
                <p className="text-xs sm:text-sm text-[#526A82] font-light leading-relaxed">
                  We have sent a 6-digit verification code to <strong className="text-[#163B63] font-medium">{email}</strong>. Please enter it below.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-[#163B63] mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full text-center text-2xl font-mono tracking-[0.5em] h-14 rounded-2xl border border-[#D5E4EF] focus:border-[#258FE5] focus:ring-2 focus:ring-[#258FE5]/20 outline-none text-[#163B63] font-bold bg-[#F8FBFE]"
                      required
                      autoFocus
                    />
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-[#526A82]">
                    <span>Code valid for 10 minutes</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || isLoading}
                      className="text-[#258FE5] font-semibold hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center h-12"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Verify Code
                </Button>
              </form>

              <div className="pt-2 text-center text-xs text-[#526A82] border-t border-[#D5E4EF]">
                <Link
                  href={`/login?role=${role}`}
                  className="inline-flex items-center gap-1.5 text-[#258FE5] font-semibold hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </div>
          )}

          {/* =========================================================================
              STAGE 3: SET NEW PASSWORD
             ========================================================================= */}
          {step === "SET_NEW_PASSWORD" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/30">
                  Step 3 of 3 • New Password
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
                  Create New Password
                </h1>
                <p className="text-xs sm:text-sm text-[#526A82] font-light leading-relaxed">
                  Enter and confirm a secure new password for your <strong className="text-[#163B63] font-medium">{role}</strong> account.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
                <Input
                  label="New Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-[#526A82]" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#526A82] hover:text-[#163B63]"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                  autoFocus
                />

                <Input
                  label="Confirm New Password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-[#526A82]" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-[#526A82] hover:text-[#163B63]"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                />

                <div className="p-3 rounded-2xl bg-[#F8FBFE] border border-[#DCECF8] text-[11px] text-[#526A82] space-y-1">
                  <div className="font-semibold text-[#163B63]">Password Requirements:</div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 8 ? "bg-emerald-500" : "bg-gray-300"}`} />
                    <span>Minimum 8 characters in length</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${newPassword && newPassword === confirmPassword ? "bg-emerald-500" : "bg-gray-300"}`} />
                    <span>Passwords match</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center h-12"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Reset Password
                </Button>
              </form>

              <div className="pt-2 text-center text-xs text-[#526A82] border-t border-[#D5E4EF]">
                <Link
                  href={`/login?role=${role}`}
                  className="inline-flex items-center gap-1.5 text-[#258FE5] font-semibold hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </div>
          )}

          {/* =========================================================================
              STAGE 4: SUCCESS CONFIRMATION
             ========================================================================= */}
          {step === "SUCCESS" && (
            <div className="space-y-6 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-serif text-[#163B63]">
                  Password Reset Successful!
                </h1>
                <p className="text-xs sm:text-sm text-[#526A82] font-light leading-relaxed max-w-sm mx-auto">
                  Your password has been successfully updated. All previous sessions have been securely revoked. You can now sign in with your new password.
                </p>
              </div>

              <div className="pt-2">
                <Link href={`/login?role=${role}`}>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full justify-center h-12"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Proceed to {role === "doctor" ? "Doctor Sign In" : "Patient Sign In"}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Security Footer Notice */}
        <div className="text-center text-[11px] text-[#94A3B8] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
          <span>Bcrypt-encrypted credentials & HIPAA-compliant multi-role session protection.</span>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#EDF5FA] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
