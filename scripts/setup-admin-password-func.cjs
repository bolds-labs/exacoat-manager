const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');
    
    // Create or replace function to allow admin password updates and verified status
    const sql = `
      CREATE OR REPLACE FUNCTION set_user_password_admin(target_user_id UUID, new_password TEXT)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Check if caller is super_admin or manager
        IF NOT (
          auth.jwt() ->> 'email' IN ('admin@artmatter.co', 'shandy@artmatter.co')
          OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'manager')
          OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'manager')
          OR auth.role() = 'service_role'
        ) THEN
          RAISE EXCEPTION 'Unauthorized: only super_admin or manager can set user password';
        END IF;

        UPDATE auth.users
        SET 
          encrypted_password = crypt(new_password, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          updated_at = NOW()
        WHERE id = target_user_id;

        RETURN TRUE;
      END;
      $$;

      GRANT EXECUTE ON FUNCTION set_user_password_admin(UUID, TEXT) TO authenticated, service_role;
    `;
    
    await client.query(sql);
    console.log('✅ set_user_password_admin function created/updated!');

    // Let's also check yokokwanarta in auth.users
    const userRes = await client.query("SELECT id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data FROM auth.users WHERE email = 'yokokwanarta@gmail.com'");
    console.log('Yoko user DB record:', userRes.rows[0]);

  } catch (err) {
    console.error('PostgreSQL error:', err.message);
  } finally {
    await client.end();
  }
}

run();
