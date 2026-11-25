import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const latStr = searchParams.get("lat") || searchParams.get("latitude") || "13.0827";
    const lngStr = searchParams.get("lng") || searchParams.get("longitude") || "80.2707";
    const specsStr = searchParams.get("specialties") || searchParams.get("specialty") || "";
    const radiusStr = searchParams.get("radius_km") || searchParams.get("radius") || "5.0";
    const city = searchParams.get("city") || "Chennai";

    const specialties = specsStr ? specsStr.split(",").map((s) => s.trim()) : [];

    const payload = {
      latitude: parseFloat(latStr),
      longitude: parseFloat(lngStr),
      specialties,
      radius_km: parseFloat(radiusStr),
      city
    };

    const res = callDbBridge("find_nearby_doctors", [], payload);
    if (!res || res.error) {
      return NextResponse.json(
        { error: res?.error || "Failed to find nearby doctors." },
        { status: 500 }
      );
    }

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error discovering nearby doctors." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lat = body.latitude || body.lat || 13.0827;
    const lng = body.longitude || body.lng || 80.2707;
    const specialties = body.specialties || (body.specialty ? [body.specialty] : []);
    const radius_km = body.radius_km || 5.0;
    const city = body.city || "Chennai";

    const payload = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      specialties,
      radius_km: parseFloat(radius_km),
      city
    };

    const res = callDbBridge("find_nearby_doctors", [], payload);
    if (!res || res.error) {
      return NextResponse.json(
        { error: res?.error || "Failed to find nearby doctors." },
        { status: 500 }
      );
    }

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error discovering nearby doctors." },
      { status: 500 }
    );
  }
}
