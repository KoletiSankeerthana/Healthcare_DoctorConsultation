"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Heart,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  featureName?: string;
  redirectPath?: string;
  onAuthenticated?: () => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  isOpen,
  onClose,
  title = "Please log in or create an account to access this feature.",
  description = "Create an account or sign in to access this feature and continue your healthcare journey.",
  featureName = "Healthcare Service",
  redirectPath = "/doctors",
  onAuthenticated
}) => {
  const { login } = useAuth();
  const [viewMode, setViewMode] = useState<"actions" | "quick_login">("actions");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  const registerUrl = `/register?redirect=${encodeURIComponent(redirectPath)}`;

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim() || !password) {
      setErrorMsg("Please provide your email/phone and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          expected_role: "patient"
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        login(data.user);
        onClose();
        if (onAuthenticated) {
          onAuthenticated();
        } else {
          window.location.href = redirectPath;
        }
      } else {
        setErrorMsg(data.error || "Authentication failed. Please verify credentials.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoPatient = () => {
    setIdentifier("aditya.vardhan@gmail.com");
    setPassword("PatientPassword@123");
    setErrorMsg(null);
  };

  const resetState = () => {
    setViewMode("actions");
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetState}
      title=""
      size="md"
    >
      <div className="text-center space-y-5 pt-1 pb-2">
        {/* Shield Icon Badge */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#DCECF8] to-[#EDF5FA] border border-[#20B8AD] flex items-center justify-center mx-auto text-[#20B8AD] shadow-xs">
          <ShieldCheck className="w-7 h-7 text-[#20B8AD]" />
        </div>

        {/* Feature Tag */}
        {featureName && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECF8] border border-[#20B8AD]/40 text-[11px] font-serif font-semibold text-[#163B63]">
            <Sparkles className="w-3 h-3 text-[#20B8AD]" />
            <span>Authentication Required for {featureName}</span>
          </div>
        )}

        {/* Heading & Narrative */}
        <div className="space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-serif font-normal text-[#163B63]">
            {title}
          </h3>
          <p className="text-xs sm:text-sm font-serif text-[#526A82] leading-relaxed max-w-sm mx-auto font-light">
            {description}
          </p>
        </div>

        {viewMode === "actions" ? (
          <>
            {/* Trust Badges Bar */}
            <div className="p-3.5 rounded-2xl bg-[#EDF5FA] border border-[#D5E4EF] grid grid-cols-2 gap-3 text-left text-[11px] font-serif text-[#526A82]">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#20B8AD] shrink-0" />
                <span>256-Bit Encrypted Storage</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Strict Privacy Ownership</span>
              </div>
            </div>

            {/* Action Buttons - Strict Two Actions Per Requirements */}
            <div className="space-y-2.5 pt-1">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setViewMode("quick_login")}
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white text-xs sm:text-sm font-serif font-semibold shadow-md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Existing Account
              </Button>

              <Link href={registerUrl} className="block w-full">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full justify-center border-2 border-[#258FE5] text-[#123D68] hover:bg-[#EDF5FA] text-xs sm:text-sm font-serif font-semibold"
                >
                  Create Free Account
                </Button>
              </Link>
            </div>
          </>
        ) : (
          /* Quick In-Modal Login Form */
          <form onSubmit={handleQuickLogin} className="space-y-4 text-left">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-serif flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-serif font-semibold text-[#163B63]">Email or Mobile Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@gmail.com or +91 98765 43210"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#D5E4EF] bg-white text-xs font-serif focus:outline-none focus:border-[#258FE5]"
                />
                <Mail className="w-4 h-4 text-[#8FA3B8] absolute left-3 top-3" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-serif font-semibold text-[#163B63]">Password</label>
                <button
                  type="button"
                  onClick={handleDemoPatient}
                  className="text-[11px] font-serif text-[#20B8AD] font-semibold hover:underline"
                >
                  Autofill Demo Patient
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-[#D5E4EF] bg-white text-xs font-serif focus:outline-none focus:border-[#258FE5]"
                />
                <Lock className="w-4 h-4 text-[#8FA3B8] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#8FA3B8] hover:text-[#526A82]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="w-full justify-center bg-[#258FE5] hover:bg-[#1D78C4] text-white text-xs font-serif font-semibold"
                rightIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              >
                {isSubmitting ? "Authenticating..." : "Authorize & Proceed to Booking"}
              </Button>

              <button
                type="button"
                onClick={() => setViewMode("actions")}
                className="w-full text-center text-xs font-serif text-[#526A82] hover:text-[#163B63] py-1"
              >
                &larr; Back to sign up options
              </button>
            </div>
          </form>
        )}

        {/* Dismiss Notice */}
        <button
          type="button"
          onClick={resetState}
          className="text-xs font-serif text-[#8FA3B8] hover:text-[#526A82] underline transition-colors"
        >
          Continue exploring public directory
        </button>
      </div>
    </Modal>
  );
};
