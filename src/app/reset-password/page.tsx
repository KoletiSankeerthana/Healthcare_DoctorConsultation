"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const target = params ? `/forgot-password?${params}` : "/forgot-password";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#EDF5FA] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#EDF5FA] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#258FE5] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordRedirect />
    </Suspense>
  );
}
