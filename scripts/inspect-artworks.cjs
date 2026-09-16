const { Client } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'artworks' 
    ORDER BY ordinal_position;
  `);
  console.log('Columns in artworks table:');
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
