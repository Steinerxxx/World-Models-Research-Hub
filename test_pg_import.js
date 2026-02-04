import pg from 'pg';
try {
  console.log('PG Default Import:', typeof pg);
  console.log('PG Pool exists:', !!pg.Pool);
  if (pg.Pool) {
    console.log('PG Import Successful');
  } else {
    console.error('PG Pool missing on default import');
    // Try named import simulation
    // import { Pool } from 'pg'; // can't do static import dynamically easily in this test script structure without module
  }
} catch (e) {
  console.error('Error:', e);
}
