"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/Button";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu,
  X,
  Stethoscope,
  ChevronDown,
  Sparkles,
  User,
  ShieldCheck,
  ArrowRight,
  LogOut,
  LayoutDashboard,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavLinkItem {
  label: string;
  href: string;
  isBadge?: boolean;
  protected?: boolean;
  featureName?: string;
}

export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalDropdownOpen, setPortalDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Authentication Gate Modal State for protected features when logged out
  const [authGateState, setAuthGateState] = useState<{
    isOpen: boolean;
    featureName: string;
    redirectPath: string;
  }>({
    isOpen: false,
    featureName: "Clinical Healthcare Feature",
    redirectPath: "/patient/dashboard",
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setPortalDropdownOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      setUserDropdownOpen(false);
      setMobileMenuOpen(false);
      await logout();
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const handleProtectedClick = (
    e: React.MouseEvent,
    featureName: string,
    targetHref: string
  ) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setPortalDropdownOpen(false);
      setMobileMenuOpen(false);
      setAuthGateState({
        isOpen: true,
        featureName,
        redirectPath: targetHref,
      });
    }
  };

  // Helper for dynamic user avatar initials
  const getUserInitials = (name?: string) => {
    if (!name || typeof name !== "string") return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Dynamic user dashboard path based on role
  const getUserDashboardPath = () => {
    if (!user) return "/patient/dashboard";
    if (user.role === "doctor") return "/doctor/dashboard";
    if (user.role === "admin") return "/admin/dashboard";
    return "/patient/dashboard";
  };

  // Universal navigation items: ALWAYS visible for both logged-in and logged-out visitors
  const navLinks: NavLinkItem[] = [
    { label: "Home", href: "/", protected: false },
    { label: "Find Doctors", href: "/doctors", protected: false },
    { label: "Specialties", href: "/specialties", protected: false },
    {
      label: "Document Intelligence",
      href: "/patient/medical-records",
      protected: true,
      featureName: "Document Intelligence & OCR Analysis",
    },
    {
      label: "AI Health Assistant",
      href: "/ai-assistant",
      isBadge: true,
      protected: true,
      featureName: "AI Health Assistant & Clinical Triage",
    },
    { label: "About", href: "/about", protected: false },
  ];

  // Universal Role Portal links inside the Portals dropdown
  const allPortalLinks = [
    {
      label: "Patient Sanctuary",
      description: "Consultations, digital prescriptions & health records",
      href: "/patient/dashboard",
      icon: User,
      role: "patient",
      featureName: "Patient Sanctuary",
    },
    {
      label: "Appointments",
      description: "Booked consultations & schedules",
      href: "/patient/appointments",
      icon: LayoutDashboard,
      role: "patient",
      featureName: "Appointment Management",
    },
    {
      label: "Health Profile",
      description: "Medical history, allergies & demographics",
      href: "/patient/profile",
      icon: ShieldCheck,
      role: "patient",
      featureName: "Health Profile",
    },
    {
      label: "Payment History",
      description: "Invoices, transactions & refunds",
      href: "/patient/payments",
      icon: ArrowRight,
      role: "patient",
      featureName: "Payment History",
    },
    {
      label: "Physician Workspace",
      description: "Patient schedule, clinical charting & availability",
      href: "/doctor/dashboard",
      icon: Stethoscope,
      role: "doctor",
      featureName: "Physician Workspace",
    },
    {
      label: "Executive Governance",
      description: "Credential verification & clinical quality audit",
      href: "/admin/dashboard",
      icon: ShieldCheck,
      role: "admin",
      featureName: "Executive Governance",
    },
  ];

  return (
    <>
      <header
        style={{
          backgroundColor: "#123D68",
          backgroundImage: "linear-gradient(90deg, #123D68 0%, #164E78 50%, #123D68 100%)",
        }}
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300 border-b border-white/15 text-white shadow-md shadow-[#123D68]/30",
          isScrolled ? "py-3" : "py-3.5"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo & Sanctuary Title */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2196E3] rounded-xl"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300 border border-white/30 shrink-0 bg-white">
              <Image
                src={BRAND.logo}
                alt={`${BRAND.displayName} Logo`}
                width={40}
                height={40}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl font-serif font-normal tracking-tight text-white drop-shadow-xs">
                {BRAND.displayName}
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] font-sans font-semibold text-[#18B7AE] -mt-0.5">
                {BRAND.tagline}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links - ALWAYS VISIBLE */}
          <nav className="hidden lg:flex items-center gap-1 text-[13px] font-medium text-[#EAF5FC]/90">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || (pathname.startsWith(link.href) && link.href !== "/");

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    if (link.protected) {
                      handleProtectedClick(e, link.featureName || link.label, link.href);
                    }
                  }}
                  className={cn(
                    "px-3.5 py-2 rounded-full transition-all duration-200 flex items-center gap-1.5",
                    isActive
                      ? "text-white font-semibold bg-white/15 border border-white/25 shadow-xs"
                      : "text-[#EAF5FC]/85 hover:text-white hover:bg-white/10 border border-transparent"
                  )}
                >
                  <span>{link.label}</span>
                  {link.isBadge && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded-full bg-[#18B7AE] text-white shadow-2xs">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                      AI
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Portals Dropdown - ALWAYS VISIBLE */}
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setPortalDropdownOpen(!portalDropdownOpen)}
                onBlur={() => setTimeout(() => setPortalDropdownOpen(false), 220)}
                className={cn(
                  "px-3.5 py-2 rounded-full transition-all duration-200 flex items-center gap-1 text-[#EAF5FC]/85 hover:text-white hover:bg-white/10 border border-transparent cursor-pointer",
                  pathname.includes("dashboard") && "text-white font-semibold bg-white/15 border-white/25"
                )}
              >
                <span>Portals</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200 opacity-80",
                    portalDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence>
                {portalDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    style={{ backgroundColor: "#123D68" }}
                    className="absolute right-0 mt-3 w-80 rounded-3xl bg-[#123D68] backdrop-blur-2xl p-3 shadow-2xl border border-white/20 z-50 text-left text-white"
                  >
                    <div className="text-[10px] font-bold text-[#18B7AE] px-3 py-1.5 uppercase tracking-widest">
                      Dedicated Role Portals
                    </div>
                    {allPortalLinks.map((item) => {
                      const Icon = item.icon;
                      const isCurrentRole = user?.role === item.role;
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={(e) => handleProtectedClick(e, item.featureName, item.href)}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-2xl transition-all group",
                            isCurrentRole ? "bg-white/15 border border-[#18B7AE]/40" : "hover:bg-white/10"
                          )}
                        >
                          <div className="p-2 rounded-xl bg-white/15 text-[#18B7AE] group-hover:bg-[#1677C8] group-hover:text-white transition-colors border border-white/15">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white group-hover:text-[#18B7AE] transition-colors flex items-center gap-1.5 font-serif">
                              <span>{item.label}</span>
                              {isCurrentRole && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#18B7AE]/20 text-[#18B7AE] font-bold uppercase border border-[#18B7AE]/40 font-sans">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#DCEAF5] line-clamp-1 mt-0.5 font-serif font-light">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Desktop Dynamic Authentication Header Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {isLoading ? (
              // Subtle loading skeleton placeholder
              <div className="w-32 h-9 rounded-2xl bg-white/10 animate-pulse" />
            ) : isAuthenticated && user ? (
              // LOGGED-IN STATE: My Dashboard + User Profile/Avatar with Dropdown
              <div className="flex items-center gap-3">
                {/* 1. My Dashboard Button */}
                <Link
                  href={getUserDashboardPath()}
                  className="px-4 py-2 rounded-2xl bg-white/15 border border-white/25 text-white text-xs font-serif font-semibold hover:bg-white/25 transition-all flex items-center gap-2 shadow-xs"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-[#18B7AE]" />
                  <span>My Dashboard</span>
                </Link>

                {/* 2. User Avatar & Profile Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    onBlur={() => setTimeout(() => setUserDropdownOpen(false), 220)}
                    className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer focus:outline-none"
                    aria-label="User Account Menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2196E3] to-[#18B7AE] flex items-center justify-center text-white text-xs font-bold shadow-xs">
                      {getUserInitials(user.full_name)}
                    </div>
                    <span className="text-xs font-serif font-medium max-w-[130px] truncate text-white">
                      {user.full_name}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-white/80 transition-transform duration-200",
                        userDropdownOpen && "rotate-180"
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        style={{ backgroundColor: "#123D68" }}
                        className="absolute right-0 mt-3 w-64 rounded-3xl bg-[#123D68] backdrop-blur-2xl p-2.5 shadow-2xl border border-white/20 z-50 text-left text-white"
                      >
                        {/* User Header Details */}
                        <div className="p-3 border-b border-white/15 mb-1.5">
                          <div className="text-sm font-serif font-semibold text-white truncate">
                            {user.full_name}
                          </div>
                          <div className="text-[11px] font-sans text-[#EAF5FC]/80 truncate mt-0.5">
                            {user.email}
                          </div>
                          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-[#18B7AE]/20 text-[#18B7AE] text-[9px] font-bold uppercase tracking-wider border border-[#18B7AE]/40 font-sans">
                            {user.role}
                          </div>
                        </div>

                        {/* Dropdown Navigation Options */}
                        <Link
                          href="/patient/profile"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-serif font-medium text-[#EAF5FC] hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <User className="w-4 h-4 text-[#18B7AE]" />
                          <span>My Profile</span>
                        </Link>

                        <Link
                          href={getUserDashboardPath()}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-serif font-medium text-[#EAF5FC] hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4 text-[#18B7AE]" />
                          <span>My Dashboard</span>
                        </Link>

                        <Link
                          href="/account/settings"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-serif font-medium text-[#EAF5FC] hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Settings className="w-4 h-4 text-[#18B7AE]" />
                          <span>Account Settings &amp; Security</span>
                        </Link>

                        <div className="border-t border-white/15 my-1.5" />

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-serif font-medium text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-rose-300" />
                          <span>Logout</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              // LOGGED-OUT STATE: Login and Get Started Buttons
              <div className="flex items-center gap-3">
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-serif font-medium text-white hover:text-[#2196E3] hover:bg-white/10"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-gradient-to-r from-[#1677C8] to-[#18B7AE] hover:brightness-110 text-white text-xs font-serif font-semibold shadow-md px-5 py-2 rounded-full border border-teal-300/30"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex lg:hidden items-center gap-2">
            {!isLoading && !isAuthenticated && (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-xs px-2.5 py-1.5 text-white font-serif font-medium hover:bg-white/10">
                  Login
                </Button>
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="p-2 rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ backgroundColor: "#123D68" }}
              className="lg:hidden border-b border-white/20 bg-[#123D68] backdrop-blur-2xl px-5 pt-3 pb-8 shadow-2xl overflow-hidden text-left text-white"
            >
              <div className="space-y-1">
                {/* User Info Bar if Logged In */}
                {isAuthenticated && user && (
                  <div className="flex items-center gap-3 p-3 mb-2 rounded-2xl bg-white/10 border border-white/15">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2196E3] to-[#18B7AE] flex items-center justify-center text-white text-sm font-bold shadow-xs">
                      {getUserInitials(user.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-serif font-semibold text-white truncate">
                        {user.full_name}
                      </div>
                      <div className="text-[11px] text-[#EAF5FC]/80 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                )}

                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={(e) => {
                        if (link.protected) {
                          handleProtectedClick(e, link.featureName || link.label, link.href);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-serif font-medium transition-colors",
                        isActive
                          ? "bg-white/15 text-white font-semibold border border-white/25"
                          : "text-[#EAF5FC] hover:bg-white/10"
                      )}
                    >
                      <span>{link.label}</span>
                      {link.isBadge && (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-[#18B7AE] text-white">
                          <Sparkles className="w-2.5 h-2.5 text-white" />
                          AI
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* Portals in Mobile Drawer */}
                <div className="pt-3 pb-1 border-t border-white/15 mt-3">
                  <div className="text-[10px] font-bold text-[#18B7AE] px-3.5 uppercase tracking-widest mb-1.5">
                    Dedicated Role Portals
                  </div>
                  {allPortalLinks.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={(e) => handleProtectedClick(e, item.featureName, item.href)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-serif font-medium text-[#EAF5FC] hover:bg-white/10"
                    >
                      <item.icon className="w-4 h-4 text-[#18B7AE]" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Mobile Authentication / Dashboard CTAs */}
                <div className="pt-5 flex flex-col gap-2.5">
                  {isAuthenticated && user ? (
                    <>
                      <Link href={getUserDashboardPath()} className="w-full">
                        <Button
                          variant="primary"
                          size="md"
                          className="w-full justify-center bg-gradient-to-r from-[#1677C8] to-[#18B7AE] font-serif text-white shadow-md"
                          leftIcon={<LayoutDashboard className="w-4 h-4 text-white" />}
                        >
                          Open My Dashboard
                        </Button>
                      </Link>
                      <Link href="/patient/profile" className="w-full">
                        <Button
                          variant="outline"
                          size="md"
                          className="w-full justify-center font-serif text-white border-white/30 hover:bg-white/10"
                          leftIcon={<User className="w-4 h-4 text-[#18B7AE]" />}
                        >
                          My Profile
                        </Button>
                      </Link>
                      <Link href="/account/settings" className="w-full">
                        <Button
                          variant="outline"
                          size="md"
                          className="w-full justify-center font-serif text-white border-white/30 hover:bg-white/10"
                          leftIcon={<Settings className="w-4 h-4 text-[#18B7AE]" />}
                        >
                          Account Settings &amp; Security
                        </Button>
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2.5 rounded-xl border border-rose-300/40 text-rose-300 text-xs font-serif font-medium hover:bg-rose-500/20"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/register" className="w-full">
                        <Button variant="primary" size="md" className="w-full justify-center bg-gradient-to-r from-[#1677C8] to-[#18B7AE] font-serif text-white shadow-md">
                          Get Started (Create Free Account)
                        </Button>
                      </Link>
                      <Link href="/login" className="w-full">
                        <Button variant="outline" size="md" className="w-full justify-center font-serif text-white border-white/30 hover:bg-white/10">
                          Sign In to Account
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Global Auth Gate Modal for Navigation Items when logged out */}
      <AuthGateModal
        isOpen={authGateState.isOpen}
        onClose={() => setAuthGateState((prev) => ({ ...prev, isOpen: false }))}
        title="Please log in or create an account to access this feature."
        description="Sign in to your account or create a new one to securely access this clinical healthcare feature."
        featureName={authGateState.featureName}
        redirectPath={authGateState.redirectPath}
      />
    </>
  );
};
