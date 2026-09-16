const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('[MIGRATION] Connecting to PostgreSQL database...');
  const connectionString = process.env.DATABASE_URL;
  const migrationName = process.argv[2];
  if (!connectionString) throw new Error('DATABASE_URL is required');
  if (!migrationName || !/^\d{3}_[a-z0-9_-]+\.sql$/i.test(migrationName)) {
    throw new Error('Pass a migration filename from reference/supabase-migrations');
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    console.log('[MIGRATION] Connected successfully to Supabase PostgreSQL!');

    const sqlPath = path.join(__dirname, '../reference/supabase-migrations', migrationName);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log(`[MIGRATION] Executing ${migrationName}...`);
    await client.query(sqlContent);
    console.log('[MIGRATION] Migration executed successfully!');

    // Verify indexes
    const indexRes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('commissions', 'artists', 'artworks', 'payouts', 'audit_logs')
      ORDER BY tablename, indexname;
    `);
    console.log('[MIGRATION] Active Indexes count:', indexRes.rows.length);
    console.log(indexRes.rows.map(r => `${r.tablename}.${r.indexname}`));

    // Verify triggers
    const trgRes = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE event_object_table IN ('commissions', 'artists', 'artworks', 'payouts');
    `);
    console.log('[MIGRATION] Active Triggers:', trgRes.rows.map(r => `${r.event_object_table} -> ${r.trigger_name} (${r.event_manipulation})`));

    await client.end();
    console.log('[MIGRATION] Complete.');
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

runMigration();
