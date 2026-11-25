import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 1. Try FastAPI backend over HTTP (ultra-fast < 5ms)
  try {
    const fastApiUrl = `${BACKEND_URL}/doctors?${searchParams.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(fastApiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (e) {
    // Backend initializing or offline; fall back to direct SQLite bridge
  }

  // 2. High-reliability fallback to SQLite database via pythonBridge
  const payload = {
    search: searchParams.get("search") || "",
    specialty: searchParams.get("specialty") || "",
    city: searchParams.get("city") || "",
    consult_type: searchParams.get("type") || searchParams.get("consult_type") || "",
    min_exp: parseInt(searchParams.get("minExp") || searchParams.get("min_exp") || "0", 10),
    max_fee: parseFloat(searchParams.get("maxFee") || searchParams.get("max_fee") || "0"),
    min_rating: parseFloat(searchParams.get("minRating") || searchParams.get("min_rating") || "0"),
    language: searchParams.get("language") || "",
    sort_by: searchParams.get("sortBy") || searchParams.get("sort_by") || "rating"
  };

  const doctors = callDbBridge("approved_doctors", [JSON.stringify(payload)]);

  if (!doctors || !Array.isArray(doctors)) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(doctors, { status: 200 });
}
