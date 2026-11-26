"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ChangePasswordFormProps {
  userRole?: "patient" | "doctor" | "admin";
  onSuccess?: () => void;
  className?: string;
}

export function ChangePasswordForm({
  userRole = "patient",
  onSuccess,
  className = ""
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Realtime password checks
  const hasMinLength = newPassword.length >= 8;
  const hasMixedChar = /[A-Za-z]/.test(newPassword) && /[0-9!@#$%^&*]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferentFromCurrent = currentPassword.length > 0 && newPassword.length > 0 && currentPassword !== newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }

    if (!newPassword) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage("New password cannot be identical to your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The new passwords do not match. Please verify.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to update password. Please check your current password.");
        return;
      }

      setSuccessMessage(
        "Your password has been successfully updated! A security confirmation email has been sent to your registered address."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "A network error occurred while updating your password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D5E4EF]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#258FE5] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Account Security
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#20B8AD]/10 text-[#20B8AD] font-semibold border border-[#20B8AD]/30">
              Bcrypt 256-Bit Encrypted
            </span>
          </div>
          <h2 className="text-xl font-serif text-[#163B63]">Change Account Password</h2>
          <p className="text-xs sm:text-sm text-[#526A82] mt-0.5">
            Update your account password regularly to keep your health records and consultations secure.
          </p>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-[#EAF5FC] border border-[#20B8AD]/40 text-xs text-[#163B63] flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#20B8AD] shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold mb-0.5 text-[#163B63]">Password Successfully Changed!</strong>
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Current Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[#163B63]">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <Link
              href={`/forgot-password?role=${userRole}`}
              className="text-[11px] text-[#258FE5] hover:text-[#163B63] hover:underline"
            >
              Forgot current password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] text-sm text-[#163B63] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#258FE5] focus:border-transparent transition-all bg-white"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#163B63]"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs font-semibold text-[#163B63] mb-1.5">
            New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] text-sm text-[#163B63] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#258FE5] focus:border-transparent transition-all bg-white"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#163B63]"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs font-semibold text-[#163B63] mb-1.5">
            Confirm New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] text-sm text-[#163B63] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#258FE5] focus:border-transparent transition-all bg-white"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#163B63]"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password Requirements Checklist */}
        <div className="p-4 rounded-2xl bg-[#F5F9FC] border border-[#D5E4EF] space-y-2">
          <span className="text-[11px] font-semibold text-[#163B63] uppercase tracking-wider block">
            Password Security Requirements
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-700 font-medium" : "text-[#526A82]"}`}>
              {hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasMixedChar ? "text-emerald-700 font-medium" : "text-[#526A82]"}`}>
              {hasMixedChar ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
              <span>Letters and numbers/symbols</span>
            </div>
            <div className={`flex items-center gap-1.5 ${passwordsMatch ? "text-emerald-700 font-medium" : "text-[#526A82]"}`}>
              {passwordsMatch ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
              <span>Passwords match</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isDifferentFromCurrent ? "text-emerald-700 font-medium" : "text-[#526A82]"}`}>
              {isDifferentFromCurrent ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
              <span>Different from current</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#526A82]">
            Changing your password will maintain your current session while securing all future logins.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8}
            className="w-full sm:w-auto bg-[#258FE5] hover:bg-[#163B63] text-white shrink-0 min-w-[160px]"
          >
            {isLoading ? "Updating Password..." : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
