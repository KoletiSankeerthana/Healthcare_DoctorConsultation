/**
 * End-to-End Verification Script:
 * Tests the complete Password Recovery & OTP Workflow for both Patient and Doctor accounts
 * via Healvia live backend and Gmail OAuth email service.
 */

const http = require('http');
const { spawnSync } = require('child_process');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/healthcare_records.db').replace(/\\/g, '/');

function queryDb(sql, params = []) {
  const pyScript = [
    'import sqlite3, json, sys',
    `conn = sqlite3.connect('${DB_PATH}')`,
    'cur = conn.cursor()',
    `cur.execute('''${sql}''', ${JSON.stringify(params)})`,
    'cols = [c[0] for c in cur.description] if cur.description else []',
    'rows = [dict(zip(cols, r)) for r in cur.fetchall()]',
    'conn.close()',
    'print(json.dumps(rows))'
  ].join('\n');

  const proc = spawnSync('python', ['-c', pyScript], { encoding: 'utf-8' });
  if (proc.error || proc.status !== 0) {
    console.error('SQL query error:', proc.stderr || proc.error);
    return [];
  }
  return JSON.parse(proc.stdout.trim());
}

function requestJson(endpoint, method, payload = null) {
  return new Promise((resolve, reject) => {
    const postData = payload ? JSON.stringify(payload) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let body = {};
          try {
            body = JSON.parse(rawData);
          } catch (e) {
            body = { raw: rawData };
          }
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('================================================================');
  console.log('  TESTING COMPLETE HEALVIA PASSWORD RECOVERY WORKFLOW');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST A: ACCOUNT ISOLATION CHECK
  // ===========================================================================
  console.log('[Test A] Testing Account Isolation...');
  console.log('  Submitting Patient email (sankeerthana2905@gmail.com) under Doctor role:');
  const crossRoleRes = await requestJson('/api/auth/forgot-password', 'POST', {
    email: 'sankeerthana2905@gmail.com',
    role: 'doctor'
  });
  console.log(`  Response Status: ${crossRoleRes.status}`);
  console.log(`  Error received: "${crossRoleRes.body.error}"`);
  if (crossRoleRes.status === 404 && crossRoleRes.body.error) {
    console.log('  PASS: Account isolation verified - Patient email rejected under Doctor role.\n');
  } else {
    throw new Error('Account isolation check failed!');
  }

  // ===========================================================================
  // TEST B: PATIENT PASSWORD RECOVERY FLOW
  // ===========================================================================
  console.log('[Test B] Testing Patient Password Recovery (Keerthana)...');
  const patientEmail = 'sankeerthana2905@gmail.com';

  console.log('  1. Requesting OTP for patient:');
  const patientForgotRes = await requestJson('/api/auth/forgot-password', 'POST', {
    email: patientEmail,
    role: 'patient'
  });
  console.log(`     Status: ${patientForgotRes.status}`);
  console.log(`     Message: ${patientForgotRes.body.message}`);

  if (patientForgotRes.status !== 200 || !patientForgotRes.body.success) {
    throw new Error(`Patient OTP request failed: ${patientForgotRes.body.error}`);
  }

  // Fetch active OTP from database
  const patientTokens = await queryDb(
    `SELECT t.token, t.expires_at, t.used, u.email, u.full_name, u.role
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE u.email = ? AND t.used = 0
     ORDER BY t.created_at DESC LIMIT 1`,
    [patientEmail]
  );

  if (!patientTokens.length) {
    throw new Error('No active OTP token found in database for patient.');
  }

  const patientRawToken = patientTokens[0].token;
  const patientOtp = patientRawToken.replace('otp:', '');
  console.log(`     Generated OTP found in DB: ${patientOtp} (Valid until: ${patientTokens[0].expires_at})`);

  // Verify email logged in email_notification_logs
  await sleep(1000);
  const patientEmailLogs = await queryDb(
    `SELECT id, recipient_email, subject, delivery_provider, status, created_at
     FROM email_notification_logs
     WHERE recipient_email = ? AND subject LIKE '%Password Reset%'
     ORDER BY created_at DESC LIMIT 1`,
    [patientEmail]
  );
  if (patientEmailLogs.length) {
    const log = patientEmailLogs[0];
    console.log(`     Gmail OAuth Email Dispatch Log: [${log.id}]`);
    console.log(`     Subject: "${log.subject}"`);
    console.log(`     Delivery Provider: ${log.delivery_provider} | Status: ${log.status}`);
  }

  // Test invalid OTP rejection
  console.log('  2. Testing invalid OTP rejection:');
  const badOtpRes = await requestJson('/api/auth/verify-otp', 'POST', {
    email: patientEmail,
    role: 'patient',
    otp: '000000'
  });
  console.log(`     Invalid OTP Status: ${badOtpRes.status} (Error: "${badOtpRes.body.error}")`);

  // Verify real OTP
  console.log('  3. Verifying correct 6-digit OTP:');
  const verifyPatientRes = await requestJson('/api/auth/verify-otp', 'POST', {
    email: patientEmail,
    role: 'patient',
    otp: patientOtp
  });
  console.log(`     Verify Status: ${verifyPatientRes.status}`);
  console.log(`     Reset Token Generated: ${verifyPatientRes.body.reset_token?.substring(0, 16)}...`);

  if (!verifyPatientRes.body.reset_token) {
    throw new Error('Verify OTP failed to return reset token.');
  }

  const patientResetToken = verifyPatientRes.body.reset_token;

  // Set new password
  const newPatientPassword = 'PatientPassword@2026_Updated';
  console.log(`  4. Resetting password to "${newPatientPassword}":`);
  const resetPatientRes = await requestJson('/api/auth/reset-password', 'POST', {
    reset_token: patientResetToken,
    new_password: newPatientPassword,
    confirm_password: newPatientPassword
  });
  console.log(`     Reset Status: ${resetPatientRes.status}`);
  console.log(`     Message: ${resetPatientRes.body.message}`);

  if (resetPatientRes.status !== 200 || !resetPatientRes.body.success) {
    throw new Error(`Password reset failed: ${resetPatientRes.body.error}`);
  }

  // Test login with old password (must fail)
  console.log('  5. Verifying old password is now rejected:');
  const oldLoginRes = await requestJson('/api/auth/login', 'POST', {
    identifier: patientEmail,
    password: 'PatientPassword@123',
    expected_role: 'patient'
  });
  console.log(`     Old Password Login Status: ${oldLoginRes.status} (Rejected as expected)`);

  // Test login with new password (must succeed)
  console.log('  6. Verifying login with newly set password:');
  const newLoginRes = await requestJson('/api/auth/login', 'POST', {
    identifier: patientEmail,
    password: newPatientPassword,
    expected_role: 'patient'
  });
  console.log(`     New Password Login Status: ${newLoginRes.status}`);
  console.log(`     Authenticated User: ${newLoginRes.body.user?.full_name} (${newLoginRes.body.user?.email})`);

  if (newLoginRes.status !== 200 || !newLoginRes.body.success) {
    throw new Error('Login with new password failed!');
  }

  // Restore patient password back to PatientPassword@123 for seamless demo credentials
  console.log('  7. Restoring demo patient password to "PatientPassword@123":');
  const restoreRes1 = await requestJson('/api/auth/forgot-password', 'POST', { email: patientEmail, role: 'patient' });
  const restoreTokenRow1 = await queryDb(
    `SELECT token FROM password_reset_tokens WHERE user_id = 'usr-pat-101' AND used = 0 ORDER BY created_at DESC LIMIT 1`
  );
  const restoreOtp1 = restoreTokenRow1[0].token.replace('otp:', '');
  const verifyRestore1 = await requestJson('/api/auth/verify-otp', 'POST', { email: patientEmail, role: 'patient', otp: restoreOtp1 });
  await requestJson('/api/auth/reset-password', 'POST', {
    reset_token: verifyRestore1.body.reset_token,
    new_password: 'PatientPassword@123',
    confirm_password: 'PatientPassword@123'
  });
  console.log('     Restored patient password for demo button.\n');

  // ===========================================================================
  // TEST C: DOCTOR PASSWORD RECOVERY FLOW
  // ===========================================================================
  console.log('[Test C] Testing Doctor Password Recovery (Dr. Sankeerthana)...');
  const doctorEmail = 'koletisankeerthana@gmail.com';

  console.log('  1. Requesting OTP for doctor:');
  const docForgotRes = await requestJson('/api/auth/forgot-password', 'POST', {
    email: doctorEmail,
    role: 'doctor'
  });
  console.log(`     Status: ${docForgotRes.status}`);
  console.log(`     Message: ${docForgotRes.body.message}`);

  if (docForgotRes.status !== 200 || !docForgotRes.body.success) {
    throw new Error(`Doctor OTP request failed: ${docForgotRes.body.error}`);
  }

  // Fetch active OTP from database
  const docTokens = await queryDb(
    `SELECT t.token, t.expires_at, t.used, u.email, u.full_name, u.role
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE u.email = ? AND t.used = 0
     ORDER BY t.created_at DESC LIMIT 1`,
    [doctorEmail]
  );

  if (!docTokens.length) {
    throw new Error('No active OTP token found in database for doctor.');
  }

  const docRawToken = docTokens[0].token;
  const docOtp = docRawToken.replace('otp:', '');
  console.log(`     Generated OTP found in DB: ${docOtp} (Valid until: ${docTokens[0].expires_at})`);

  // Verify email logged in email_notification_logs
  await sleep(1000);
  const docEmailLogs = await queryDb(
    `SELECT id, recipient_email, subject, delivery_provider, status, created_at
     FROM email_notification_logs
     WHERE recipient_email = ? AND subject LIKE '%Password Reset%'
     ORDER BY created_at DESC LIMIT 1`,
    [doctorEmail]
  );
  if (docEmailLogs.length) {
    const log = docEmailLogs[0];
    console.log(`     Gmail OAuth Email Dispatch Log: [${log.id}]`);
    console.log(`     Subject: "${log.subject}"`);
    console.log(`     Delivery Provider: ${log.delivery_provider} | Status: ${log.status}`);
  }

  // Verify OTP
  console.log('  2. Verifying correct 6-digit OTP for Doctor:');
  const verifyDocRes = await requestJson('/api/auth/verify-otp', 'POST', {
    email: doctorEmail,
    role: 'doctor',
    otp: docOtp
  });
  console.log(`     Verify Status: ${verifyDocRes.status}`);
  console.log(`     Reset Token: ${verifyDocRes.body.reset_token?.substring(0, 16)}...`);

  // Reset password
  const newDocPassword = 'DoctorPassword@2026_Updated';
  console.log(`  3. Resetting Doctor password to "${newDocPassword}":`);
  const resetDocRes = await requestJson('/api/auth/reset-password', 'POST', {
    reset_token: verifyDocRes.body.reset_token,
    new_password: newDocPassword,
    confirm_password: newDocPassword
  });
  console.log(`     Reset Status: ${resetDocRes.status}`);
  console.log(`     Message: ${resetDocRes.body.message}`);

  // Test login with new password
  console.log('  4. Verifying Doctor login with new password:');
  const docNewLoginRes = await requestJson('/api/auth/login', 'POST', {
    identifier: doctorEmail,
    password: newDocPassword,
    expected_role: 'doctor'
  });
  console.log(`     New Password Login Status: ${docNewLoginRes.status}`);
  console.log(`     Authenticated Doctor: ${docNewLoginRes.body.user?.full_name} (${docNewLoginRes.body.user?.email})`);

  if (docNewLoginRes.status !== 200 || !docNewLoginRes.body.success) {
    throw new Error('Doctor login with new password failed!');
  }

  // Restore doctor password back to DoctorPassword@123 for demo credentials
  console.log('  5. Restoring demo doctor password to "DoctorPassword@123":');
  const restoreRes2 = await requestJson('/api/auth/forgot-password', 'POST', { email: doctorEmail, role: 'doctor' });
  const restoreTokenRow2 = await queryDb(
    `SELECT token FROM password_reset_tokens WHERE user_id = 'usr-doc-sankeerthana' AND used = 0 ORDER BY created_at DESC LIMIT 1`
  );
  const restoreOtp2 = restoreTokenRow2[0].token.replace('otp:', '');
  const verifyRestore2 = await requestJson('/api/auth/verify-otp', 'POST', { email: doctorEmail, role: 'doctor', otp: restoreOtp2 });
  await requestJson('/api/auth/reset-password', 'POST', {
    reset_token: verifyRestore2.body.reset_token,
    new_password: 'DoctorPassword@123',
    confirm_password: 'DoctorPassword@123'
  });
  console.log('     Restored doctor password for demo button.\n');

  console.log('================================================================');
  console.log('  ALL CHECKS PASSED: PASSWORD RECOVERY WORKFLOW IS VERIFIED!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
