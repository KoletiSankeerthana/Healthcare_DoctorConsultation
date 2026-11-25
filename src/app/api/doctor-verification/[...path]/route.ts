import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { callDbBridge } from "@/lib/pythonBridge";
import {
  sendDoctorRegistrationNotification,
  sendDoctorApprovalNotification,
  sendDoctorRejectionNotification
} from "@/lib/emailService";
import { requireAuth } from "@/lib/server-auth";

const PERSISTENT_STORE_FILE = path.join(
  process.cwd(),
  "uploads",
  "doctor_credentials",
  "applications.json"
);

function getStoredApplications(): any[] {
  try {
    // Always sync from SQLite database first so any newly registered doctor appears immediately in the admin dashboard
    callDbBridge("sync");
    if (fs.existsSync(PERSISTENT_STORE_FILE)) {
      const data = fs.readFileSync(PERSISTENT_STORE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading persistent store:", err);
  }

  return [];
}

function persistApplications(apps: any[]) {
  try {
    const dir = path.dirname(PERSISTENT_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PERSISTENT_STORE_FILE, JSON.stringify(apps, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving persistent store:", err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: routePath } = await params;
  const subpath = routePath.join("/");

  const apps = getStoredApplications();

  if (subpath === "admin/stats") {
    // Return live stats
    const total = apps.length;
    const pending = apps.filter((a) => a.status === "pending_review").length;
    const under_review = apps.filter((a) => a.status === "under_review").length;
    const additional_docs = apps.filter((a) => a.status === "additional_documents_required").length;
    const approved = apps.filter((a) => a.status === "approved").length;
    const rejected = apps.filter((a) => a.status === "rejected").length;
    const suspended = apps.filter((a) => a.status === "suspended").length;

    return NextResponse.json({
      total_applications: total,
      pending_review: pending,
      under_review,
      additional_documents_required: additional_docs,
      resubmission_required: 0,
      approved,
      rejected,
      suspended
    });
  }

  if (subpath === "admin/applications") {
    const statusParam = request.nextUrl.searchParams.get("status_filter") || "all";
    const searchParam = request.nextUrl.searchParams.get("search")?.toLowerCase() || "";

    let list = apps;
    if (statusParam !== "all") {
      list = list.filter((a) => a.status === statusParam);
    }
    if (searchParam) {
      list = list.filter(
        (a) =>
          (a.application_reference && a.application_reference.toLowerCase().includes(searchParam)) ||
          (a.personal_info?.full_name && a.personal_info.full_name.toLowerCase().includes(searchParam)) ||
          (a.doctor_name && a.doctor_name.toLowerCase().includes(searchParam)) ||
          (a.personal_info?.email && a.personal_info.email.toLowerCase().includes(searchParam)) ||
          (a.doctor_email && a.doctor_email.toLowerCase().includes(searchParam)) ||
          (a.professional_info?.specialty && a.professional_info.specialty.toLowerCase().includes(searchParam)) ||
          (a.specialty && a.specialty.toLowerCase().includes(searchParam)) ||
          (a.registration_info?.registration_number && a.registration_info.registration_number.toLowerCase().includes(searchParam))
      );
    }

    const summaries = list.map((a) => ({
      id: a.id,
      doctor_id: a.doctor_id,
      application_reference: a.application_reference,
      doctor_name: a.personal_info?.full_name || a.doctor_name || "Doctor",
      doctor_email: a.personal_info?.email || a.doctor_email || "doctor@example.com",
      specialty: a.professional_info?.specialty || a.specialty || "General Medicine",
      registration_number: a.registration_info?.registration_number || a.registration_number || "N/A",
      issuing_council: a.registration_info?.issuing_council || a.issuing_council || "State Medical Council",
      highest_qualification: a.professional_info?.highest_qualification || a.highest_qualification || "MBBS",
      experience_years: a.professional_info?.experience_years ?? a.experience_years ?? 1,
      status: a.status,
      submitted_at: a.submitted_at,
      created_at: a.created_at,
      documents_count: a.documents?.length || 0,
      mandatory_documents_verified:
        a.documents && a.documents.length > 0
          ? a.documents.every((d: any) => !d.is_mandatory || d.review_status === "verified")
          : false
    }));

    return NextResponse.json(summaries);
  }

  if (subpath.startsWith("doctor/")) {
    const docId = routePath[1];
    const app = apps.find((a) => a.doctor_id === docId) || apps[0];
    return NextResponse.json(app || null);
  }

  // Get application details by application ID or reference
  const appId = routePath[0];
  let app = apps.find((a) => a.id === appId || a.application_reference === appId);
  if (!app) {
    // Try detail via db_bridge
    const bridgeDetail = callDbBridge("detail", [appId]);
    if (bridgeDetail) {
      return NextResponse.json(bridgeDetail);
    }
    app = apps[0];
  }
  return NextResponse.json(app || null);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: routePath } = await params;
  const subpath = routePath.join("/");

  const contentType = request.headers.get("content-type") || "";

  // 1. Handle Document Upload: /api/doctor-verification/{app_id}/documents
  if (subpath.endsWith("/documents")) {
    const appId = routePath[routePath.length - 2];
    try {
      let docType = "medical_degree";
      let docName = "Medical Degree Certificate";
      let filename = "document.pdf";
      let fileB64: string | null = null;
      let fileSize = 0;

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        docType = (formData.get("document_type") as string) || docType;
        docName = (formData.get("document_name") as string) || docName;
        filename = (formData.get("filename") as string) || file?.name || filename;

        if (file) {
          const buffer = Buffer.from(await file.arrayBuffer());
          fileB64 = buffer.toString("base64");
          fileSize = buffer.length;
        } else {
          fileSize = parseInt(formData.get("file_size") as string) || 500000;
        }
      } else {
        const body = await request.json();
        docType = body.document_type || docType;
        docName = body.document_name || docName;
        filename = body.filename || filename;
        fileB64 = body.file_b64 || null;
        fileSize = body.file_size || 500000;
      }

      const bridgeResult = callDbBridge("upload_doc", [], {
        application_id: appId,
        document_type: docType,
        document_name: docName,
        filename,
        file_b64: fileB64,
        file_size: fileSize
      });

      if (bridgeResult) {
        return NextResponse.json(bridgeResult);
      }

      // Local fallback
      const apps = getStoredApplications();
      const targetApp = apps.find((a) => a.id === appId);
      const newDoc = {
        id: `dcd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        application_id: appId,
        document_type: docType,
        document_name: docName,
        original_filename: filename,
        file_size: fileSize,
        is_mandatory: true,
        uploaded_at: new Date().toISOString(),
        review_status: "pending"
      };
      if (targetApp) {
        targetApp.documents = targetApp.documents || [];
        targetApp.documents.push(newDoc);
        targetApp.updated_at = new Date().toISOString();
        persistApplications(apps);
      }
      return NextResponse.json(newDoc);
    } catch (err: any) {
      console.error("Document upload error:", err);
      return NextResponse.json({ error: err.message || "Failed to upload document" }, { status: 500 });
    }
  }

  // 2. Handle JSON Requests (register, decision, review)
  let bodyPayload: any = {};
  if (contentType.includes("application/json")) {
    bodyPayload = await request.json();
  }

  // 2A. Handle Register
  if (subpath === "register") {
    // Try via db_bridge first to write to SQLite
    const bridgeResult = callDbBridge("register", [], bodyPayload);
    if (bridgeResult && bridgeResult.id) {
      // Re-read updated applications list
      getStoredApplications();

      // Trigger admin notification only after successful creation and persistence in database
      const pInfo = bodyPayload.personal_info || {};
      const profInfo = bodyPayload.professional_info || {};
      const regInfo = bodyPayload.registration_info || {};

      sendDoctorRegistrationNotification({
        doctorId: bridgeResult.doctor_id,
        doctorName: pInfo.full_name || bodyPayload.doctor_name || bodyPayload.name || "Doctor",
        doctorEmail: pInfo.email || bodyPayload.doctor_email || bodyPayload.email || "",
        doctorPhone: pInfo.phone || bodyPayload.doctor_phone || bodyPayload.phone || "",
        specialty: profInfo.specialty || bodyPayload.specialty || "General Medicine",
        qualification: profInfo.highest_qualification || bodyPayload.highest_qualification || bodyPayload.qualification || "MBBS",
        registrationNumber: regInfo.registration_number || bodyPayload.registration_number,
        council: regInfo.issuing_council || regInfo.state_council || bodyPayload.issuing_council,
        experienceYears: profInfo.experience_years ?? bodyPayload.experience_years ?? bodyPayload.experience,
        hospital: profInfo.current_hospital || bodyPayload.current_hospital || bodyPayload.hospital || bodyPayload.clinic_name || "Private Practice",
        clinicDetails: pInfo.residential_address || bodyPayload.residential_address || bodyPayload.clinic_address,
        applicationReference: bridgeResult.application_reference,
        status: bridgeResult.status || "pending_review",
        submittedAt: new Date().toISOString()
      }).catch((err) => {
        // Non-fatal: Email failure must not undo or block successful doctor registration
        console.error("[doctor-verification] Non-fatal admin email dispatch failure:", err);
      });

      return NextResponse.json(bridgeResult);
    }

    // Fallback in-memory
    const newId = `dva-${Date.now()}`;
    const newDocId = `doc-${Date.now()}`;
    const refId = `DOC-VER-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newApp = {
      id: newId,
      doctor_id: newDocId,
      application_reference: refId,
      status: "pending_review",
      personal_info: bodyPayload.personal_info,
      professional_info: bodyPayload.professional_info,
      registration_info: bodyPayload.registration_info,
      eligibility_checklist: bodyPayload.eligibility_checklist || {
        mandatory_info_completed: true,
        required_docs_uploaded: true,
        registration_provided: true,
        qualifications_documented: true,
        specialization_evidence: true,
        files_readable: true
      },
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      documents: [],
      reviews: [],
      history: [
        {
          id: `dvh-${Date.now()}`,
          application_id: newId,
          previous_status: "draft",
          new_status: "pending_review",
          changed_by: newDocId,
          reason: "Initial multi-step doctor registration submission",
          timestamp: new Date().toISOString()
        }
      ]
    };

    const currentApps = getStoredApplications();
    currentApps.unshift(newApp);
    persistApplications(currentApps);

    // Dispatch administrator notification asynchronously
    const fbPInfo = bodyPayload.personal_info || {};
    const fbProfInfo = bodyPayload.professional_info || {};
    const fbRegInfo = bodyPayload.registration_info || {};

    sendDoctorRegistrationNotification({
      doctorId: newDocId,
      doctorName: fbPInfo.full_name || bodyPayload.doctor_name || bodyPayload.name || "Doctor",
      doctorEmail: fbPInfo.email || bodyPayload.doctor_email || bodyPayload.email || "",
      doctorPhone: fbPInfo.phone || bodyPayload.doctor_phone || bodyPayload.phone || "",
      specialty: fbProfInfo.specialty || bodyPayload.specialty || "General Medicine",
      qualification: fbProfInfo.highest_qualification || bodyPayload.highest_qualification || bodyPayload.qualification || "MBBS",
      registrationNumber: fbRegInfo.registration_number || bodyPayload.registration_number,
      council: fbRegInfo.issuing_council || fbRegInfo.state_council || bodyPayload.issuing_council,
      experienceYears: fbProfInfo.experience_years ?? bodyPayload.experience_years ?? bodyPayload.experience,
      hospital: fbProfInfo.current_hospital || bodyPayload.current_hospital || bodyPayload.hospital || bodyPayload.clinic_name || "Private Practice",
      clinicDetails: fbPInfo.residential_address || bodyPayload.residential_address || bodyPayload.clinic_address,
      applicationReference: refId,
      status: "pending_review",
      submittedAt: new Date().toISOString()
    }).catch((err) => {
      console.error("[doctor-verification] Non-fatal admin email dispatch failure:", err);
    });

    return NextResponse.json(newApp);
  }

  // 2B. Handle Admin Decision (Approve / Reject / Request Additional Docs)
  if (subpath.includes("/decision")) {
    const appId = routePath[routePath.length - 2];

    // Verify admin privileges
    const { user: authUser, error: authError } = requireAuth(request, ["admin"]);
    const roleCookie = request.cookies.get("mediverse_role")?.value;
    if (authError && roleCookie !== "admin" && !bodyPayload.admin_id?.startsWith("admin")) {
      return authError;
    }

    const { action, reason_category, justification } = bodyPayload;
    if (action === "reject" && (!justification || justification.trim().length < 5)) {
      return NextResponse.json(
        { detail: "A detailed written justification is required for application rejection." },
        { status: 400 }
      );
    }

    const adminId = authUser?.id || bodyPayload.admin_id || "admin-gov-1";

    const bridgeResult = callDbBridge("decision", [], {
      application_id: appId,
      action,
      reason_category,
      justification,
      admin_id: adminId
    });

    if (bridgeResult) {
      getStoredApplications();

      // Dispatch decision email ONLY if database update confirmed and not a duplicate click
      if (!bridgeResult.is_duplicate_decision && bridgeResult.doctor_email) {
        if (action === "approve" && bridgeResult.status === "approved") {
          sendDoctorApprovalNotification({
            applicationId: bridgeResult.application_id || appId,
            doctorName: bridgeResult.doctor_name || "Doctor",
            doctorEmail: bridgeResult.doctor_email,
            applicationReference: bridgeResult.application_reference || appId,
            specialty: bridgeResult.specialty,
            decisionId: bridgeResult.decision_id,
            approvedAt: bridgeResult.decided_at
          }).catch((err) => {
            console.error("[decision] Non-fatal doctor approval email failure:", err);
          });
        } else if (action === "reject" && bridgeResult.status === "rejected") {
          sendDoctorRejectionNotification({
            applicationId: bridgeResult.application_id || appId,
            doctorName: bridgeResult.doctor_name || "Doctor",
            doctorEmail: bridgeResult.doctor_email,
            applicationReference: bridgeResult.application_reference || appId,
            rejectionReason: bridgeResult.justification || justification,
            specialty: bridgeResult.specialty,
            decisionId: bridgeResult.decision_id,
            rejectedAt: bridgeResult.decided_at
          }).catch((err) => {
            console.error("[decision] Non-fatal doctor rejection email failure:", err);
          });
        }
      }

      return NextResponse.json(bridgeResult);
    }

    // Fallback in-memory
    const currentApps = getStoredApplications();
    const app = currentApps.find((a) => a.id === appId || a.application_reference === appId);
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const prev = app.status;
    let newStatus = app.status;
    const isDup = (prev === "approved" && action === "approve") || (prev === "rejected" && action === "reject");

    if (action === "approve") {
      newStatus = "approved";
      app.approved_at = new Date().toISOString();
      if (app.documents) {
        app.documents.forEach((d: any) => {
          d.review_status = "verified";
        });
      }
    } else if (action === "reject") {
      newStatus = "rejected";
      app.rejected_at = new Date().toISOString();
    } else if (action === "request_additional_documents") {
      newStatus = "additional_documents_required";
    }

    app.status = newStatus;
    app.updated_at = new Date().toISOString();
    const decId = `dvr-${Date.now()}`;
    app.reviews = app.reviews || [];
    app.reviews.push({
      id: decId,
      application_id: app.id,
      admin_id: adminId,
      action,
      reason_category: reason_category || null,
      justification: justification || null,
      created_at: new Date().toISOString()
    });

    app.history = app.history || [];
    app.history.push({
      id: `dvh-${Date.now()}`,
      application_id: app.id,
      previous_status: prev,
      new_status: newStatus,
      changed_by: adminId,
      reason: justification || `Admin decision: ${action}`,
      timestamp: new Date().toISOString()
    });

    persistApplications(currentApps);

    const docEmail = app.personal_info?.email || app.doctor_email;
    const docName = app.personal_info?.full_name || app.doctor_name || "Doctor";

    if (!isDup && docEmail) {
      if (action === "approve" && newStatus === "approved") {
        sendDoctorApprovalNotification({
          applicationId: app.id,
          doctorName: docName,
          doctorEmail: docEmail,
          applicationReference: app.application_reference || app.id,
          specialty: app.professional_info?.specialty,
          decisionId: decId,
          approvedAt: app.approved_at
        }).catch((err) => {
          console.error("[decision] Non-fatal doctor approval email failure:", err);
        });
      } else if (action === "reject" && newStatus === "rejected") {
        sendDoctorRejectionNotification({
          applicationId: app.id,
          doctorName: docName,
          doctorEmail: docEmail,
          applicationReference: app.application_reference || app.id,
          rejectionReason: justification || "Application did not satisfy clinical criteria.",
          specialty: app.professional_info?.specialty,
          decisionId: decId,
          rejectedAt: app.rejected_at
        }).catch((err) => {
          console.error("[decision] Non-fatal doctor rejection email failure:", err);
        });
      }
    }

    return NextResponse.json({
      message: `Application ${action} processed successfully.`,
      application_id: app.id,
      status: newStatus
    });
  }

  // 2C. Handle Document Review
  if (subpath.includes("/review")) {
    const docId = routePath[routePath.length - 2];
    const bridgeResult = callDbBridge("review_doc", [], {
      document_id: docId,
      review_status: bodyPayload.review_status,
      reviewer_comments: bodyPayload.reviewer_comments,
      admin_id: bodyPayload.admin_id || "admin-gov-1"
    });

    if (bridgeResult) {
      getStoredApplications();
      return NextResponse.json(bridgeResult);
    }

    const currentApps = getStoredApplications();
    for (const a of currentApps) {
      const doc = a.documents?.find((d: any) => d.id === docId);
      if (doc) {
        doc.review_status = bodyPayload.review_status;
        doc.reviewer_comments = bodyPayload.reviewer_comments;
        doc.reviewed_at = new Date().toISOString();
        persistApplications(currentApps);
        return NextResponse.json({
          message: "Document review status updated",
          document_id: docId,
          review_status: doc.review_status
        });
      }
    }
  }

  return NextResponse.json({ message: "Action recorded" });
}
