import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { invalidateSession } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("mediverse_session")?.value;

    if (sessionToken) {
      invalidateSession(sessionToken);
      callDbBridge("auth_logout", [sessionToken]);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully." });
    response.cookies.delete("mediverse_session");
    response.cookies.delete("mediverse_role");
    response.cookies.set("mediverse_session", "", { path: "/", maxAge: 0, expires: new Date(0) });
    response.cookies.set("mediverse_role", "", { path: "/", maxAge: 0, expires: new Date(0) });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
