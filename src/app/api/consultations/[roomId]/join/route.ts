import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    const authUser = getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    // Determine target role:
    // When explicit body.user_role is provided (from dashboard link or testing switcher),
    // respect body.user_role so multi-role testing works smoothly in development.
    const userRole = body.user_role || authUser?.role || "patient";

    let userId = body.user_id;
    let userName = body.user_name;

    if (authUser) {
      if (authUser.role === userRole) {
        // Authenticated user matches the role being requested
        userId = (userRole === "doctor" ? authUser.doctor_id || authUser.id : authUser.patient_id || authUser.id) || userId;
        userName = authUser.full_name || userName;
      } else if (authUser.role === "admin") {
        // System admin can join as either role
        userId = userId || authUser.id;
        userName = userName || authUser.full_name;
      }
      // If authUser role differs (e.g. testing doctor role while logged in as patient),
      // preserve body.user_id and body.user_name from the doctor dashboard link
    }

    if (!userId) {
      userId = userRole === "doctor" ? "doc-1" : "usr-pat-101";
    }
    if (!userName) {
      userName = userRole === "doctor" ? "Doctor" : "Patient";
    }

    const payload = {
      room_id: roomId,
      user_id: userId,
      user_name: userName,
      user_role: userRole
    };

    const res = callDbBridge("join_consultation", [], payload);
    if (!res || !res.success) {
      return NextResponse.json(
        { error: res?.error || "Unable to join consultation room. Please verify your appointment time and credentials." },
        { status: 403 }
      );
    }
    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to join consultation room." }, { status: 500 });
  }
}
