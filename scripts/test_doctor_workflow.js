const http = require('http');

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

async function run() {
  console.log('=== Step 0: Admin Authentication ===');
  const loginRes = await postJson('/api/auth/login', {
    identifier: 'admin@mediverse.org',
    password: 'AdminPassword@123',
    role: 'admin'
  });
  console.log('Admin login status:', loginRes.status);
  const setCookie = loginRes.headers['set-cookie'];
  const adminCookie = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : '';
  console.log('Admin session cookie established.');

  console.log('\n=== Step 1: Register Doctor A (Dr. Anita Nair) ===');
  const docAPayload = {
    personal_info: {
      full_name: 'Dr. Anita Nair',
      email: 'adminhealthcare4+docA@gmail.com',
      phone: '+919811122233',
      date_of_birth: '1985-04-12',
      gender: 'Female',
      residential_address: 'Koramangala, Bengaluru'
    },
    professional_info: {
      specialty: 'Pediatrics',
      highest_qualification: 'MBBS, MD (Pediatrics)',
      experience_years: 10,
      current_hospital: 'Rainbow Children\'s Hospital'
    },
    registration_info: {
      registration_number: 'KMC-2014-99881',
      issuing_council: 'Karnataka Medical Council'
    },
    password: 'DoctorPass@2026'
  };

  const regARes = await postJson('/api/doctor-verification/register', docAPayload);
  console.log('Doctor A Registration Status:', regARes.status);
  console.log('Doctor A Application ID:', regARes.body.id);
  console.log('Doctor A Reference:', regARes.body.application_reference);
  console.log('Doctor A Verification Status in DB:', regARes.body.status);

  console.log('Waiting 3 seconds for async Admin notification email via Gmail API...');
  await sleep(3000);

  console.log('\n=== Step 2: Admin Approves Doctor A ===');
  const approveARes = await postJson(
    `/api/doctor-verification/admin/applications/${regARes.body.id}/decision`,
    {
      action: 'approve',
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log('Approve Decision Status:', approveARes.status);
  console.log('Updated Status in DB:', approveARes.body.status);
  console.log('Approval Decision ID:', approveARes.body.decision_id);

  console.log('Waiting 3 seconds for async Doctor A Approval email via Gmail API...');
  await sleep(3000);

  console.log('\n=== Step 3: Register Doctor B (Dr. Vikram Malhotra) ===');
  const docBPayload = {
    personal_info: {
      full_name: 'Dr. Vikram Malhotra',
      email: 'adminhealthcare4+docB@gmail.com',
      phone: '+919844455566',
      date_of_birth: '1982-11-03',
      gender: 'Male',
      residential_address: 'Whitefield, Bengaluru'
    },
    professional_info: {
      specialty: 'Orthopedics',
      highest_qualification: 'MBBS, MS (Orthopedics)',
      experience_years: 14,
      current_hospital: 'Manipal Hospital'
    },
    registration_info: {
      registration_number: 'MMC-2010-44552',
      issuing_council: 'Maharashtra Medical Council'
    },
    password: 'DoctorPass@2026'
  };

  const regBRes = await postJson('/api/doctor-verification/register', docBPayload);
  console.log('Doctor B Registration Status:', regBRes.status);
  console.log('Doctor B Application ID:', regBRes.body.id);
  console.log('Doctor B Reference:', regBRes.body.application_reference);

  console.log('Waiting 3 seconds for async Admin notification email via Gmail API...');
  await sleep(3000);

  console.log('\n=== Step 4: Admin Rejects Doctor B with Explicit Reason ===');
  const rejectionReason = 'Uploaded state council registration certificate expired on 2024-03-31. Please provide renewed standing certificate from Maharashtra Medical Council.';
  const rejectBRes = await postJson(
    `/api/doctor-verification/admin/applications/${regBRes.body.id}/decision`,
    {
      action: 'reject',
      reason_category: 'invalid_registration',
      justification: rejectionReason,
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log('Reject Decision Status:', rejectBRes.status);
  console.log('Updated Status in DB:', rejectBRes.body.status);
  console.log('Rejection Justification saved:', rejectBRes.body.justification);

  console.log('Waiting 3 seconds for async Doctor B Rejection email via Gmail API...');
  await sleep(3000);

  console.log('\n=== Step 5: Test Duplicate Click Protection on Doctor B ===');
  const dupRejectRes = await postJson(
    `/api/doctor-verification/admin/applications/${regBRes.body.id}/decision`,
    {
      action: 'reject',
      reason_category: 'invalid_registration',
      justification: rejectionReason,
      admin_id: 'usr-admin-001'
    },
    adminCookie
  );
  console.log('Duplicate Reject Status:', dupRejectRes.status);
  console.log('Is Duplicate Decision:', dupRejectRes.body.is_duplicate_decision);

  console.log('\nAll API actions completed successfully.');
}

run().catch(console.error);
