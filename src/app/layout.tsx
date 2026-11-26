import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BRAND } from "@/lib/brand";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: `${BRAND.displayName} — ${BRAND.tagline}`,
  description: `${BRAND.description} Access verified doctors, manage digital health records, and receive intelligent healthcare guidance with ${BRAND.name}.`,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/images/healvia-icon.png", type: "image/png" }
    ],
    apple: "/images/healvia-icon.png"
  },
  keywords: [
    "Healvia",
    "HEALVIA healthcare",
    "doctor consultation",
    "telehealth platform",
    "verified specialists",
    "AI healthcare assistant",
    "digital health sanctuary",
    "medical records",
    "online doctor appointment"
  ],
  openGraph: {
    title: `${BRAND.displayName} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: [{ url: "/images/healvia-logo.png" }],
    siteName: BRAND.name,
  }
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
