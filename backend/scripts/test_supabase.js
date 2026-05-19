const { Client } = require('pg');

async function testConnection() {
  const connectionString = "postgresql://postgres.ymliwapczkojcbpjmusi:Smc2026Database@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Attempting to connect to Supabase...");
    await client.connect();
    console.log("✅ Connection Successful!");
    
    const res = await client.query('SELECT NOW()');
    console.log("Time from DB:", res.rows[0]);
  } catch (err) {
    console.error("❌ Connection Failed!");
    console.error(err.message);
  } finally {
    await client.end();
  }
}

testConnection();
