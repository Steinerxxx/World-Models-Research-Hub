

async function testBackend() {
  const baseUrl = 'https://world-models-research-hub-backend.onrender.com';
  console.log(`Testing backend at: ${baseUrl}`);

  try {
    // 1. Test Health Endpoint
    console.log('1. Testing /health...');
    const healthRes = await fetch(`${baseUrl}/health`);
    console.log(`   Status: ${healthRes.status} ${healthRes.statusText}`);
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      console.log('   Response:', healthData);
    } else {
      const text = await healthRes.text();
      console.log('   Error body:', text.slice(0, 100));
    }

    // 2. Test Papers Endpoint
    console.log('\n2. Testing /api/papers...');
    const papersRes = await fetch(`${baseUrl}/api/papers`);
    console.log(`   Status: ${papersRes.status} ${papersRes.statusText}`);
    if (papersRes.ok) {
      const papersData = await papersRes.json();
      console.log(`   Success! Got ${Array.isArray(papersData) ? papersData.length : 'unknown'} papers`);
    } else {
      const text = await papersRes.text();
      console.log('   Error body:', text.slice(0, 100));
    }

  } catch (error) {
    console.error('Network Error:', error.message);
  }
}

testBackend();
