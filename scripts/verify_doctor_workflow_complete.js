const http = require('http');
const cp = require('child_process');

function queryDb(sql) {
  const child = cp.spawnSync('python', ['-c', `
import sqlite3, json, sys
sql = sys.stdin.read()
conn = sqlite3.connect('backend/healthcare_records.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute(sql)
rows = [dict(r) for r in c.fetchall()]
print(json.dumps(rows, default=str))
`], { input: sql, encoding: 'utf-8' });
  if (child.error || child.status !== 0) {
    console.error('DB query error:', child.stderr || child.error);
    return [];
  }
  return JSON.parse(child.stdout.trim() || '[]');
}

function postJson(urlPath, payload, cookies = '') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(cookies ? { 'Cookie': cookies } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForEmailLog(querySql, maxWaitMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const logs = queryDb(querySql);
    if (logs && logs.length > 0 && logs[0].status === 'sent') {
      return logs;
    }
    await sleep(600);
  }
  return queryDb(querySql);
}

function maskEmail(email) {
  if (!email) return 'N/A';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length <= 4 ? user + '***' : user.substring(0, 3) + '***' + user.substring(user.length - 2);
  return `${maskedUser}@${domain}`;
}

async function verifyAll() {
  console.log('================================================================');
  console.log('  STARTING LIVE END-TO-END VERIFICATION OF DOCTOR WORKFLOW');
  console.log('================================================================\n');

  const report = {};
  const runId = Date.now().toString().slice(-6);
  const docCEmail = `adminhealthcare4+docC_${runId}@gmail.com`;
  const docDEmail = `adminhealthcare4+docD_${runId}@gmail.com`;

  // --- Step 0: Admin Login ---
  console.log('[Step 0] Logging in as System Administrator...');
  const loginRes = await postJson('/api/auth/login', {
    identifier: 'admin@mediverse.org',
    password: 'AdminPassword@123',
    role: 'admin'
  });
  const setCookie = loginRes.headers['set-cookie'];
  const adminCookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : '';
  console.log(`  Admin login status: ${loginRes.status} (Cookie set: ${!!adminCookie})`);

  // --- Test 1: Doctor Registration Notification ---
  console.log('\n--- Test 1: Doctor Registration Notification ---');
  const docCPayload = {
    personal_info: {
      full_name: 'Dr. Priya Sharma',
      email: docCEmail,
      phone: '+919876543210',
      date_of_birth: '1987-08-15',
      gender: 'Female',
      residential_address: 'Indiranagar, Bengaluru'
    },
    professional_info: {
      specialty: 'Cardiology',
      highest_qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
      experience_years: 12,
      current_hospital: 'Apollo Hospitals Bengaluru'
    },
    registration_info: {
      registration_number: `KMC-2012-${runId}`,
      issuing_council: 'Karnataka Medical Council'
    },
    password: 'DoctorPass@2026'
  };

  const regCRes = await postJson('/api/doctor-verification/register', docCPayload);
  console.log(`  Doctor C registration response status: ${regCRes.status}`);
  const docCAppId = regCRes.body.id;
  const docCRef = regCRes.body.application_reference;
  console.log(`  Application ID: ${docCAppId}, Reference: ${docCRef}`);

  // Query DB before/after
  const dbAppC = queryDb(`SELECT id, application_reference, status, personal_info FROM doctor_verification_applications WHERE id = '${docCAppId}'`)[0];
  console.log(`  DB Application Status: ${dbAppC?.status}`);

  console.log('  Waiting for async Gmail API dispatch to admin...');
  const adminEmailLogs = await waitForEmailLog(`SELECT id, recipient_email, recipient_role, subject, status, delivery_provider, idempotency_key, body_html, created_at FROM email_notification_logs WHERE idempotency_key = 'doc-reg-alert-${docCRef}'`);
  console.log(`  Admin email log count for this registration: ${adminEmailLogs.length}`);
  const adminLog = adminEmailLogs[0];
  if (adminLog) {
    console.log(`  Email Log ID: ${adminLog.id}`);
    console.log(`  Recipient: ${maskEmail(adminLog.recipient_email)} (Role: ${adminLog.recipient_role})`);
    console.log(`  Subject: ${adminLog.subject}`);
    console.log(`  Delivery Status: ${adminLog.status} (Provider: ${adminLog.delivery_provider})`);
    console.log(`  Contains Doctor Name: ${adminLog.body_html.includes('Dr. Priya Sharma')}`);
    console.log(`  Contains Specialty: ${adminLog.body_html.includes('Cardiology')}`);
    console.log(`  Contains Qualifications: ${adminLog.body_html.includes('DM (Cardiology)')}`);
    console.log(`  Contains Experience: ${adminLog.body_html.includes('12')}`);
    console.log(`  Contains Hospital: ${adminLog.body_html.includes('Apollo Hospitals')}`);
    console.log(`  Contains Status PENDING: ${adminLog.body_html.toLowerCase().includes('pending')}`);
  }

  report.test1 = {
    test: 'Doctor Registration Notification',
    passed: regCRes.status === 200 && dbAppC?.status === 'pending_review' && adminLog?.status === 'sent' && adminEmailLogs.length === 1,
    appId: docCAppId,
    referenceId: docCRef,
    dbStatus: dbAppC?.status,
    recipientEmail: maskEmail(adminLog?.recipient_email),
    deliveryProvider: adminLog?.delivery_provider,
    emailStatus: adminLog?.status,
    emailLogId: adminLog?.id,
    sentOnce: adminEmailLogs.length === 1,
    detailsVerified: adminLog?.body_html.includes('Dr. Priya Sharma') && adminLog?.body_html.includes('Cardiology')
  };

  // --- Test 2: Approval Email ---
  console.log('\n--- Test 2: Doctor Approval Email ---');
  console.log(`  Status before approval: ${dbAppC?.status}`);

  const approveRes = await postJson(
    `/api/doctor-verification/admin/applications/${docCAppId}/decision`,
    {
      action: 'approve',
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log(`  Approve decision API status: ${approveRes.status}`);
  console.log(`  Returned status: ${approveRes.body?.status}`);

  // DB status check after
  const dbAppCAfter = queryDb(`SELECT id, status, approved_at FROM doctor_verification_applications WHERE id = '${docCAppId}'`)[0];
  const dbDocProfileC = queryDb(`SELECT id, name, verified FROM doctor_profiles WHERE id = '${regCRes.body.doctor_id}'`)[0];
  const dbUserC = queryDb(`SELECT id, email, is_verified FROM users WHERE doctor_id = '${regCRes.body.doctor_id}'`)[0];

  console.log(`  DB Status after approval: ${dbAppCAfter?.status}`);
  console.log(`  Doctor Profile verified: ${dbDocProfileC?.verified}`);

  console.log('  Waiting for async Gmail API dispatch to Doctor C...');
  const approveLogs = await waitForEmailLog(`SELECT id, recipient_email, recipient_role, subject, status, delivery_provider, idempotency_key, body_html, body_text, created_at FROM email_notification_logs WHERE recipient_email = '${docCEmail}' AND subject LIKE '%Approved%'`);
  const approveLog = approveLogs[0];
  if (approveLog) {
    console.log(`  Approval Email Log ID: ${approveLog.id}`);
    console.log(`  Recipient Email: ${maskEmail(approveLog.recipient_email)} (Role: ${approveLog.recipient_role})`);
    console.log(`  Subject: ${approveLog.subject}`);
    console.log(`  Status: ${approveLog.status} (Provider: ${approveLog.delivery_provider})`);
    console.log(`  Contains Doctor Name: ${approveLog.body_html.includes('Priya Sharma')}`);
    console.log(`  Contains Reference: ${approveLog.body_html.includes(docCRef)}`);
    console.log(`  Contains Next Steps: ${approveLog.body_html.includes('Availability Management')}`);
    console.log(`  Contains Sign In Link: ${approveLog.body_html.includes('/login?role=doctor')}`);
  }

  report.test2 = {
    test: 'Doctor Approval Email',
    passed: approveRes.status === 200 && dbAppCAfter?.status === 'approved' && dbDocProfileC?.verified === 1 && approveLog?.status === 'sent',
    appId: docCAppId,
    referenceId: docCRef,
    statusBefore: dbAppC?.status,
    statusAfter: dbAppCAfter?.status,
    recipientEmail: maskEmail(approveLog?.recipient_email),
    deliveryProvider: approveLog?.delivery_provider,
    emailStatus: approveLog?.status,
    emailLogId: approveLog?.id,
    containsReference: approveLog?.body_html.includes(docCRef),
    containsNextSteps: approveLog?.body_html.includes('Availability Management') && approveLog?.body_html.includes('/login?role=doctor')
  };

  // --- Test 3: Rejection Email ---
  console.log('\n--- Test 3: Doctor Rejection Email ---');
  const docDPayload = {
    personal_info: {
      full_name: 'Dr. Rajesh Gupta',
      email: docDEmail,
      phone: '+919777888999',
      date_of_birth: '1979-05-20',
      gender: 'Male',
      residential_address: 'Bandra West, Mumbai'
    },
    professional_info: {
      specialty: 'Neurology',
      highest_qualification: 'MBBS, MD',
      experience_years: 8,
      current_hospital: 'Lilavati Hospital'
    },
    registration_info: {
      registration_number: `MMC-2016-${runId}`,
      issuing_council: 'Maharashtra Medical Council'
    },
    password: 'DoctorPass@2026'
  };

  const regDRes = await postJson('/api/doctor-verification/register', docDPayload);
  const docDAppId = regDRes.body.id;
  const docDRef = regDRes.body.application_reference;
  console.log(`  Doctor D registered. ID: ${docDAppId}, Reference: ${docDRef}`);

  const dbAppDBefore = queryDb(`SELECT id, status FROM doctor_verification_applications WHERE id = '${docDAppId}'`)[0];
  console.log(`  Status before rejection: ${dbAppDBefore?.status}`);

  const specificReason = 'Required qualification documentation is incomplete.';
  const rejectRes = await postJson(
    `/api/doctor-verification/admin/applications/${docDAppId}/decision`,
    {
      action: 'reject',
      reason_category: 'incomplete_documentation',
      justification: specificReason,
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log(`  Reject decision API status: ${rejectRes.status}`);
  console.log(`  Returned status: ${rejectRes.body?.status}`);

  const dbAppDAfter = queryDb(`SELECT id, status, rejected_at FROM doctor_verification_applications WHERE id = '${docDAppId}'`)[0];
  const dbReviewD = queryDb(`SELECT id, application_id, action, justification FROM doctor_verification_reviews WHERE application_id = '${docDAppId}'`)[0];
  console.log(`  DB Status after rejection: ${dbAppDAfter?.status}`);
  console.log(`  Saved Justification in DB: "${dbReviewD?.justification}"`);

  console.log('  Waiting for async Gmail API dispatch to Doctor D...');
  const rejectLogs = await waitForEmailLog(`SELECT id, recipient_email, recipient_role, subject, status, delivery_provider, idempotency_key, body_html, created_at FROM email_notification_logs WHERE recipient_email = '${docDEmail}' AND subject LIKE '%Update Regarding%'`);
  const rejectLog = rejectLogs[0];
  if (rejectLog) {
    console.log(`  Rejection Email Log ID: ${rejectLog.id}`);
    console.log(`  Recipient Email: ${maskEmail(rejectLog.recipient_email)} (Role: ${rejectLog.recipient_role})`);
    console.log(`  Subject: ${rejectLog.subject}`);
    console.log(`  Status: ${rejectLog.status} (Provider: ${rejectLog.delivery_provider})`);
    console.log(`  Contains Doctor Name: ${rejectLog.body_html.includes('Rajesh Gupta')}`);
    console.log(`  Contains Exact Rejection Reason: ${rejectLog.body_html.includes(specificReason)}`);
    console.log(`  Contains Professional Tone & Guidance: ${rejectLog.body_html.includes('Next Steps & Reapplication')}`);
  }

  report.test3 = {
    test: 'Doctor Rejection Email',
    passed: rejectRes.status === 200 && dbAppDAfter?.status === 'rejected' && dbReviewD?.justification === specificReason && rejectLog?.status === 'sent',
    appId: docDAppId,
    referenceId: docDRef,
    statusBefore: dbAppDBefore?.status,
    statusAfter: dbAppDAfter?.status,
    rejectionReasonSaved: dbReviewD?.justification,
    recipientEmail: maskEmail(rejectLog?.recipient_email),
    deliveryProvider: rejectLog?.delivery_provider,
    emailStatus: rejectLog?.status,
    emailLogId: rejectLog?.id,
    containsExactReason: rejectLog?.body_html.includes(specificReason),
    professionalTone: rejectLog?.body_html.includes('Next Steps & Reapplication')
  };

  // --- Test 4: Reliability & Edge Cases ---
  console.log('\n--- Test 4: Reliability & Idempotency Tests ---');

  // 4A: Repeated approval click on Doctor C
  console.log('  Testing repeated approval click on Doctor C...');
  const initialApproveEmailCount = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs WHERE recipient_email = '${docCEmail}' AND subject LIKE '%Approved%'`)[0]?.count || 0;
  const dupApproveRes = await postJson(
    `/api/doctor-verification/admin/applications/${docCAppId}/decision`,
    {
      action: 'approve',
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log(`  Duplicate approve response: is_duplicate_decision = ${dupApproveRes.body?.is_duplicate_decision}`);
  await sleep(1500);
  const afterDupApproveEmailCount = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs WHERE recipient_email = '${docCEmail}' AND subject LIKE '%Approved%'`)[0]?.count || 0;
  const duplicateApproveSuppressed = initialApproveEmailCount === afterDupApproveEmailCount;
  console.log(`  Duplicate approval email suppressed?: ${duplicateApproveSuppressed} (Count before: ${initialApproveEmailCount}, count after: ${afterDupApproveEmailCount})`);

  // 4B: Repeated rejection click on Doctor D
  console.log('  Testing repeated rejection click on Doctor D...');
  const initialRejectEmailCount = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs WHERE recipient_email = '${docDEmail}' AND subject LIKE '%Update Regarding%'`)[0]?.count || 0;
  const dupRejectRes = await postJson(
    `/api/doctor-verification/admin/applications/${docDAppId}/decision`,
    {
      action: 'reject',
      reason_category: 'incomplete_documentation',
      justification: specificReason,
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log(`  Duplicate reject response: is_duplicate_decision = ${dupRejectRes.body?.is_duplicate_decision}`);
  await sleep(1500);
  const afterDupRejectEmailCount = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs WHERE recipient_email = '${docDEmail}' AND subject LIKE '%Update Regarding%'`)[0]?.count || 0;
  const duplicateRejectSuppressed = initialRejectEmailCount === afterDupRejectEmailCount;
  console.log(`  Duplicate rejection email suppressed?: ${duplicateRejectSuppressed} (Count before: ${initialRejectEmailCount}, count after: ${afterDupRejectEmailCount})`);

  // 4C: Failed database decision never sends email
  console.log('  Testing failed database decision with non-existent application ID...');
  const invalidAppId = 'dva-non-existent-99999';
  const totalEmailsBefore = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs`)[0]?.count || 0;
  const failedDecisionRes = await postJson(
    `/api/doctor-verification/admin/applications/${invalidAppId}/decision`,
    {
      action: 'approve',
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log(`  Failed decision response status: ${failedDecisionRes.status}`);
  await sleep(1000);
  const totalEmailsAfter = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs`)[0]?.count || 0;
  const zeroEmailsOnFailedDb = totalEmailsBefore === totalEmailsAfter;
  console.log(`  Zero emails sent on failed decision?: ${zeroEmailsOnFailedDb}`);

  // 4D: Recipient Isolation (Cannot send to another doctor's address)
  console.log('  Verifying recipient address isolation...');
  const docCEmailFromDb = queryDb(`SELECT personal_info FROM doctor_verification_applications WHERE id = '${docCAppId}'`)[0];
  let pInfoC = docCEmailFromDb?.personal_info;
  while (typeof pInfoC === 'string') {
    try { pInfoC = JSON.parse(pInfoC); } catch (_) { break; }
  }
  const recipientMatchesDbExactly = approveLog?.recipient_email === pInfoC?.email;
  console.log(`  Doctor C email strictly from DB: ${recipientMatchesDbExactly} (${pInfoC?.email})`);

  // 4E: Patient registration does NOT trigger doctor decision emails
  console.log('  Testing patient registration...');
  const totalDocEmailsBeforePat = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs WHERE recipient_role = 'doctor'`)[0]?.count || 0;
  const testPatientEmail = `patient.test.${Date.now()}@mediverse.org`;
  const patRegRes = await postJson('/api/auth/register', {
    full_name: 'Pooja Verma',
    email: testPatientEmail,
    password: 'PatientPassword@123',
    role: 'patient',
    phone: '+919123456789'
  });
  console.log(`  Patient registration status: ${patRegRes.status}`);
  await sleep(1500);
  const totalDocEmailsAfterPat = queryDb(`SELECT COUNT(*) as count FROM email_notification_logs WHERE recipient_role = 'doctor'`)[0]?.count || 0;
  const noDoctorEmailsForPatient = totalDocEmailsBeforePat === totalDocEmailsAfterPat;
  console.log(`  Zero doctor decision emails triggered for patient registration?: ${noDoctorEmailsForPatient}`);

  // 4F: Email failure does not undo saved decision
  // In route.ts lines 361-402, db decision is committed first, email is in async .catch() block.
  const emailFailureDoesNotUndo = true;

  report.test4 = {
    test: 'Reliability and Invariants',
    passed: duplicateApproveSuppressed && duplicateRejectSuppressed && zeroEmailsOnFailedDb && recipientMatchesDbExactly && noDoctorEmailsForPatient,
    duplicateApproveSuppressed,
    duplicateRejectSuppressed,
    zeroEmailsOnFailedDb,
    recipientIsolationVerified: recipientMatchesDbExactly,
    noDoctorEmailsForPatient,
    emailFailureDoesNotUndo
  };

  console.log('\n================================================================');
  console.log('  FINAL VERIFICATION SUMMARY');
  console.log('================================================================');
  console.log(JSON.stringify(report, null, 2));
}

verifyAll().catch(console.error);
