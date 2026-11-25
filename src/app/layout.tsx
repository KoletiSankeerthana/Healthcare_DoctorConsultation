import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BRAND } from "@/lib/brand";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: `${BRAND.name} — Modern Luxury Digital Healthcare & Doctor Consultation`,
  description: BRAND.description,
  keywords: [
    "luxury digital healthcare",
    "doctor consultation India",
    "telehealth sanctuary",
    "verified specialists",
    "online prescription",
    "AI health assistant",
    "modern medical technology",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans antialiased bg-[#F5F9FC] text-[#0F172A]">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
