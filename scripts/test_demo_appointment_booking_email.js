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

function requestJson(urlPath, method = 'GET', payload = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const postData = payload ? JSON.stringify(payload) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: method,
      headers: {
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {}),
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
    if (postData) req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForEmailLogs(appointmentId, maxWaitMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const logs = queryDb(`SELECT id, appointment_id, recipient_email, recipient_role, recipient_name, subject, status, delivery_provider, idempotency_key, body_html, body_text, error_message, created_at FROM email_notification_logs WHERE appointment_id = '${appointmentId}'`);
    if (logs && logs.length >= 2 && logs.every(l => l.status === 'sent')) {
      return logs;
    }
    await sleep(600);
  }
  return queryDb(`SELECT id, appointment_id, recipient_email, recipient_role, recipient_name, subject, status, delivery_provider, idempotency_key, body_html, body_text, error_message, created_at FROM email_notification_logs WHERE appointment_id = '${appointmentId}'`);
}

async function run() {
  console.log('================================================================');
  console.log('  TESTING REAL APPOINTMENT BOOKING EMAIL NOTIFICATIONS');
  console.log('================================================================\n');

  // Step 1: Patient Login
  console.log('[Step 1] Logging in as demo patient Keerthana...');
  const loginRes = await requestJson('/api/auth/login', 'POST', {
    identifier: 'sankeerthana2905@gmail.com',
    password: 'PatientPassword@123',
    expected_role: 'patient'
  });
  console.log(`  Login status: ${loginRes.status}`);
  console.log(`  Authenticated User: ${loginRes.body.user?.full_name} (${loginRes.body.user?.email})`);

  const setCookie = loginRes.headers['set-cookie'];
  const patientCookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : '';
  console.log(`  Session Cookie established: ${!!patientCookie}`);

  // Step 2: Fetch Doctor Availability
  let targetDate = '2026-11-26';
  let availRes = await requestJson(`/api/doctors/doc-sankeerthana/availability?date=${targetDate}`, 'GET');
  if (!availRes.body.slots || availRes.body.slots.length === 0) {
    targetDate = '2026-11-27';
    availRes = await requestJson(`/api/doctors/doc-sankeerthana/availability?date=${targetDate}`, 'GET');
  }
  console.log(`\n[Step 2] Fetching Dr. Sankeerthana's published availability for ${targetDate}...`);
  console.log(`  Availability API status: ${availRes.status}`);
  console.log(`  Total available slots: ${availRes.body.total_available_slots}`);

  const availableSlots = availRes.body.slots || [];
  if (availableSlots.length === 0) {
    throw new Error('No available slots found for Dr. Sankeerthana.');
  }

  // Pick the first available slot
  const selectedSlot = availableSlots[0];
  console.log(`  Selected Slot: ${selectedSlot.display_time} (${selectedSlot.start_time} - ${selectedSlot.end_time})`);

  // Step 3: Book Appointment
  console.log('\n[Step 3] Booking appointment with Dr. Sankeerthana...');
  const bookingPayload = {
    doctor_id: 'doc-sankeerthana',
    date: targetDate,
    time: selectedSlot.display_time,
    start_time: selectedSlot.start_time,
    end_time: selectedSlot.end_time,
    type: 'online',
    symptoms: 'Routine clinical checkup and preventative consultation'
  };

  const bookingRes = await requestJson('/api/appointments', 'POST', bookingPayload, patientCookie);
  console.log(`  Booking Response Status: ${bookingRes.status}`);
  const aptData = bookingRes.body.appointment;
  if (!aptData) {
    throw new Error(`Booking failed: ${JSON.stringify(bookingRes.body)}`);
  }

  console.log(`  Appointment ID: ${aptData.id}`);
  console.log(`  Booking Reference: ${aptData.reference || aptData.appointment_reference}`);
  console.log(`  Doctor: ${aptData.doctor_name} (${aptData.doctor_specialty})`);
  console.log(`  Doctor Email in appointment: ${aptData.doctor_email}`);
  console.log(`  Patient: ${aptData.patient_name}`);
  console.log(`  Patient Email in appointment: ${aptData.patient_email}`);
  console.log(`  Scheduled: ${aptData.date} at ${aptData.time}`);

  // Step 4: Verify in Database
  console.log('\n[Step 4] Verifying Appointment record in SQLite database...');
  const dbApt = queryDb(`SELECT id, appointment_reference, doctor_id, doctor_name, doctor_specialty, patient_id, patient_name, patient_email, date, time, status FROM appointments WHERE id = '${aptData.id}'`)[0];
  console.log(`  DB Appointment Status: ${dbApt?.status}`);
  console.log(`  DB Patient Email: ${dbApt?.patient_email}`);
  console.log(`  DB Doctor ID: ${dbApt?.doctor_id}`);

  // Step 5: Wait for Gmail API Delivery
  console.log('\n[Step 5] Waiting for async Gmail API dispatch of Patient and Doctor emails...');
  const emailLogs = await waitForEmailLogs(aptData.id);
  console.log(`  Total email logs recorded for this appointment: ${emailLogs.length}`);

  const patientEmailLog = emailLogs.find(l => l.recipient_role === 'patient');
  const doctorEmailLog = emailLogs.find(l => l.recipient_role === 'doctor');

  console.log('\n--- EMAIL 1: PATIENT CONFIRMATION ---');
  if (patientEmailLog) {
    console.log(`  Notification ID: ${patientEmailLog.id}`);
    console.log(`  Recipient: ${patientEmailLog.recipient_email} (Role: ${patientEmailLog.recipient_role})`);
    console.log(`  Subject: ${patientEmailLog.subject}`);
    console.log(`  Delivery Provider: ${patientEmailLog.delivery_provider}`);
    console.log(`  Status: ${patientEmailLog.status}`);
    console.log(`  Error Message: ${patientEmailLog.error_message || 'None (Accepted by Gmail API)'}`);
    console.log(`  Contains Doctor Name (Dr. Sankeerthana): ${patientEmailLog.body_html.includes('Dr. Sankeerthana')}`);
    console.log(`  Contains Specialization: ${patientEmailLog.body_html.includes('General Physician')}`);
    console.log(`  Contains Date (${targetDate}): ${patientEmailLog.body_html.includes(targetDate)}`);
    console.log(`  Contains Time (${selectedSlot.display_time}): ${patientEmailLog.body_html.includes(selectedSlot.display_time)}`);
  } else {
    console.log('  FAILED to find patient email log!');
  }

  console.log('\n--- EMAIL 2: DOCTOR NOTIFICATION ---');
  if (doctorEmailLog) {
    console.log(`  Notification ID: ${doctorEmailLog.id}`);
    console.log(`  Recipient: ${doctorEmailLog.recipient_email} (Role: ${doctorEmailLog.recipient_role})`);
    console.log(`  Subject: ${doctorEmailLog.subject}`);
    console.log(`  Delivery Provider: ${doctorEmailLog.delivery_provider}`);
    console.log(`  Status: ${doctorEmailLog.status}`);
    console.log(`  Error Message: ${doctorEmailLog.error_message || 'None (Accepted by Gmail API)'}`);
    console.log(`  Contains Patient Name (Keerthana): ${doctorEmailLog.body_html.includes('Keerthana')}`);
    console.log(`  Contains Specialization: ${doctorEmailLog.body_html.includes('General Physician')}`);
    console.log(`  Contains Date (${targetDate}): ${doctorEmailLog.body_html.includes(targetDate)}`);
    console.log(`  Contains Time (${selectedSlot.display_time}): ${doctorEmailLog.body_html.includes(selectedSlot.display_time)}`);
  } else {
    console.log('  FAILED to find doctor email log!');
  }

  const success = patientEmailLog?.status === 'sent' && 
                  doctorEmailLog?.status === 'sent' &&
                  patientEmailLog.recipient_email === 'sankeerthana2905@gmail.com' &&
                  doctorEmailLog.recipient_email === 'koletisankeerthana@gmail.com';

  console.log('\n================================================================');
  console.log(`  OVERALL TEST RESULT: ${success ? 'ALL CHECKS PASSED' : 'FAILED'}`);
  console.log('================================================================');
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
