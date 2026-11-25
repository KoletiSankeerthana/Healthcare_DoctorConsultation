import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { sendDoctorRegistrationNotification } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = (body.role || "patient").toLowerCase();

    // STRICT SECURITY: Reject any attempt to register an admin account publicly
    if (role === "admin") {
      return NextResponse.json(
        { error: "System administrator accounts cannot be registered publicly. They must be provisioned securely via system administration." },
        { status: 403 }
      );
    }

    const result = callDbBridge("auth_register", [], body);

    if (!result || result.error || !result.success) {
      return NextResponse.json(
        { error: result?.error || "Registration failed. Please check your information and try again." },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      redirect_url: result.redirect_url || "/patient/dashboard",
      message: "Account created successfully."
    });

    // Set authenticated session cookie
    if (result.session_token) {
      response.cookies.set("mediverse_session", result.session_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });
      // Also set client-readable role hint
      response.cookies.set("mediverse_role", result.user.role, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60
      });
    }

    // Asynchronously dispatch admin alert ONLY if a genuine new doctor has registered
    if (role === "doctor") {
      sendDoctorRegistrationNotification({
        doctorId: result.user?.id,
        doctorName: body.full_name || body.name || "Doctor",
        doctorEmail: body.email,
        doctorPhone: body.phone,
        specialty: body.specialty || body.department || "General Practice",
        qualification: body.qualification || body.highest_qualification || "MBBS",
        experienceYears: body.experience_years || body.experience,
        hospital: body.hospital || body.current_hospital || body.clinic_name || "Private Practice",
        clinicDetails: body.address || body.clinic_address,
        registrationNumber: body.registration_number,
        council: body.council || body.issuing_council,
        applicationReference: `REG-${result.user?.id || Date.now()}`,
        status: "pending_review",
        submittedAt: new Date().toISOString()
      }).catch((err) => {
        // Non-fatal: Email failure must not undo or block successful doctor registration
        console.error("[auth_register] Non-fatal admin email dispatch failure:", err);
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
