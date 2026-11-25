"use client";

import React, { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { VideoRoom } from "@/components/consultation/VideoRoom";
import { Loader2 } from "lucide-react";

function ConsultationInner() {
  const params = useParams();
  const searchParams = useSearchParams();

  const roomId = (params?.id as string) || "ROOM-DEFAULT";
  const role = (searchParams?.get("role") as "doctor" | "patient") || "patient";
  const userName = searchParams?.get("name") || undefined;
  const userId = searchParams?.get("userId") || undefined;

  return (
    <VideoRoom
      roomId={roomId}
      initialRole={role}
      initialUserName={userName}
      initialUserId={userId}
    />
  );
}

export default function ConsultationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0E2742] flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#20B8AD] mx-auto" />
            <p className="text-xs text-[#20B8AD]/70">Connecting to secure telehealth room...</p>
          </div>
        </div>
      }
    >
      <ConsultationInner />
    </Suspense>
  );
}
