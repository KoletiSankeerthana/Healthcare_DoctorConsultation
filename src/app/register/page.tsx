"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2
} from "lucide-react";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      errs.fullName = "Please enter your full legal name (minimum 3 characters).";
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      errs.email = "Please enter a valid email address.";
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      errs.phone = "Please enter a valid 10-digit mobile number.";
    }
    if (!password || password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    if (!agreeTerms) {
      errs.agreeTerms = "Please agree to our clinical service guidelines and privacy policy.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          role: "patient"
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setGeneralError(data.error || "Registration failed. Please check your information and try again.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push(redirectTarget || data.redirect_url || "/patient/dashboard");
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setGeneralError(err.message || "Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDF5FA] py-14 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 text-left font-serif">
      <div className="max-w-lg w-full space-y-7">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-subtle border border-[#D5E4EF] shrink-0">
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
          <h2 className="text-2xl sm:text-3xl font-serif font-normal text-[#163B63]">
            Create Patient Account
          </h2>
          <p className="text-xs text-[#526A82] font-light">
            Connect with vetted medical specialists, manage health records, and access verified clinical insights
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[36px] bg-white border border-[#D5E4EF] p-8 sm:p-10 shadow-editorial space-y-6">
          {generalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {generalError}
            </div>
          )}

          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#EAF5FC] text-[#258FE5] border border-[#20B8AD]/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h3 className="text-2xl font-serif font-normal text-[#163B63]">
                Account Created Successfully
              </h3>
              <p className="text-xs sm:text-sm text-[#526A82] max-w-xs mx-auto font-light">
                Welcome, {fullName}! Opening your personal Patient Dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Legal Name"
                placeholder="e.g. Aditya Vardhan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4 text-[#526A82]" />}
                error={errors.fullName}
                required
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-[#526A82]" />}
                error={errors.email}
                required
              />

              <Input
                label="Mobile Phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="w-4 h-4 text-[#526A82]" />}
                error={errors.phone}
                helperText="For consultation confirmations and doctor SMS updates"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-[#526A82]" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#526A82] hover:text-[#163B63]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  error={errors.password}
                  required
                />

                <Input
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-[#526A82]" />}
                  error={errors.confirmPassword}
                  required
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#526A82]">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-[#D5E4EF] text-[#258FE5] focus:ring-[#258FE5]"
                  />
                  <span className="font-light">
                    I accept the Healthcare terms of service, teleconsultation consent standards, and medical confidentiality protocols.
                  </span>
                </label>
                {errors.agreeTerms && (
                  <p className="text-xs text-rose-600 font-medium mt-1">{errors.agreeTerms}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full justify-center h-12 mt-4"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account
              </Button>
            </form>
          )}

          <div className="pt-2 text-center text-xs text-[#526A82] border-t border-[#D5E4EF]">
            Already have an account?{" "}
            <Link
              href={redirectTarget ? `/login?redirect=${encodeURIComponent(redirectTarget)}` : "/login"}
              className="text-[#258FE5] font-semibold hover:underline"
            >
              Sign In
            </Link>{" "}
            • Are you a doctor?{" "}
            <Link href="/register/doctor" className="text-[#258FE5] font-semibold hover:underline">
              Physician Onboarding
            </Link>
          </div>
        </div>

        <div className="text-center text-[11px] text-[#94A3B8] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#20B8AD]" />
          <span>Patient data is securely stored and encrypted under ISO 27001 standards.</span>
        </div>
      </div>
    </div>
  );
}

export default function PatientRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F9FC] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#258FE5] animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
