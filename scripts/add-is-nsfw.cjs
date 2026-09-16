const { Client } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

async function run() {
  await client.connect();
  console.log('Adding is_nsfw column to artworks...');
  await client.query(`
    ALTER TABLE artworks ADD COLUMN IF NOT EXISTS is_nsfw boolean DEFAULT false;
  `);
  console.log('Reloading PostgREST schema cache...');
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('Done!');
  await client.end();
}

run().catch(console.error);
