const http = require('http');

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

async function runRegression() {
  console.log('================================================================');
  console.log('  MEDIVERSE COMPREHENSIVE REGRESSION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  // 1. Patient Login
  console.log('[Test 1] Patient Login (Keerthana)...');
  const patRes = await requestJson('/api/auth/login', 'POST', {
    identifier: 'sankeerthana2905@gmail.com',
    password: 'PatientPassword@123',
    expected_role: 'patient'
  });
  assert(patRes.status === 200, `Patient login status: ${patRes.status}`);
  assert(patRes.body.user?.full_name === 'Keerthana', `Patient user full_name is Keerthana (got: ${patRes.body.user?.full_name})`);
  assert(patRes.body.user?.role === 'patient', `Patient role is patient (got: ${patRes.body.user?.role})`);
  const patCookie = Array.isArray(patRes.headers['set-cookie']) ? patRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

  // 2. Doctor Login
  console.log('\n[Test 2] Doctor Login (Dr. Sankeerthana)...');
  const docRes = await requestJson('/api/auth/login', 'POST', {
    identifier: 'koletisankeerthana@gmail.com',
    password: 'DoctorPassword@123',
    expected_role: 'doctor'
  });
  assert(docRes.status === 200, `Doctor login status: ${docRes.status}`);
  assert(docRes.body.user?.role === 'doctor', `Doctor role is doctor (got: ${docRes.body.user?.role})`);
  assert(docRes.body.user?.doctor_id === 'doc-sankeerthana', `Doctor ID is doc-sankeerthana`);
  const docCookie = Array.isArray(docRes.headers['set-cookie']) ? docRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

  // 3. Admin Login
  console.log('\n[Test 3] Admin Login...');
  const admRes = await requestJson('/api/auth/login', 'POST', {
    identifier: 'admin@mediverse.org',
    password: 'AdminPassword@123',
    expected_role: 'admin'
  });
  assert(admRes.status === 200, `Admin login status: ${admRes.status}`);
  assert(admRes.body.user?.role === 'admin', `Admin role is admin (got: ${admRes.body.user?.role})`);

  // 4. Dynamic Doctor Availability
  console.log('\n[Test 4] Doctor Availability Engine...');
  const availRes = await requestJson('/api/doctors/doc-sankeerthana/availability?date=2026-11-27', 'GET');
  assert(availRes.status === 200, `Doctor availability status: ${availRes.status}`);
  assert(availRes.body.total_available_slots > 0, `Published available slots: ${availRes.body.total_available_slots}`);

  // 5. Patient Appointments Dashboard Fetch
  console.log('\n[Test 5] Patient Appointments Dashboard API...');
  const patAptRes = await requestJson('/api/appointments', 'GET', null, patCookie);
  assert(patAptRes.status === 200, `Patient appointments query status: ${patAptRes.status}`);
  assert(Array.isArray(patAptRes.body) || Array.isArray(patAptRes.body?.appointments), 'Returns appointments array');

  // 6. Doctor Appointments Dashboard Fetch
  console.log('\n[Test 6] Doctor Appointments Dashboard API...');
  const docAptRes = await requestJson('/api/appointments?role=doctor&doctor_id=doc-sankeerthana', 'GET', null, docCookie);
  assert(docAptRes.status === 200, `Doctor appointments query status: ${docAptRes.status}`);

  console.log('\n================================================================');
  console.log(`  REGRESSION RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runRegression().catch(err => {
  console.error('Regression error:', err);
  process.exit(1);
});
