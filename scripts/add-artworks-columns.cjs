const { Client } = require('pg');

async function run() {
  console.log('[PG MIGRATION] Connecting to PostgreSQL database...');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    console.log('[PG MIGRATION] Connected successfully to Supabase PostgreSQL!');

    console.log('[PG MIGRATION] Adding short_description and description columns to artworks table...');
    await client.query(`
      ALTER TABLE artworks ADD COLUMN IF NOT EXISTS short_description text;
      ALTER TABLE artworks ADD COLUMN IF NOT EXISTS description text;
    `);
    console.log('✓ Columns added/verified.');

    console.log('[PG MIGRATION] Adding unique constraint on artworks(wp_id)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'artworks_wp_id_unique'
        ) THEN
          ALTER TABLE artworks ADD CONSTRAINT artworks_wp_id_unique UNIQUE (wp_id);
        END IF;
      END $$;
    `);
    console.log('✓ Unique constraint artworks_wp_id_unique added/verified.');

    console.log('[PG MIGRATION] Populating short_description from metadata where available...');
    const updateRes = await client.query(`
      UPDATE artworks 
      SET 
        short_description = COALESCE(short_description, metadata->>'short_description'),
        description = COALESCE(description, metadata->>'description')
      WHERE metadata IS NOT NULL AND (short_description IS NULL OR description IS NULL);
    `);
    console.log(`✓ Updated ${updateRes.rowCount} rows.`);

    console.log('[PG MIGRATION] Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('✓ PostgREST schema cache reloaded.');

    // Verify columns
    const colRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'artworks'
      ORDER BY ordinal_position;
    `);
    console.log('\n--- Current Columns in "artworks" Table ---');
    console.table(colRes.rows);

    // Verify constraints
    const conRes = await client.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'artworks'::regclass;
    `);
    console.log('\n--- Current Constraints on "artworks" Table ---');
    console.table(conRes.rows);

    await client.end();
    console.log('\n[PG MIGRATION] Completed successfully!');
  } catch (err) {
    console.error('[PG MIGRATION ERROR]', err);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

run();
