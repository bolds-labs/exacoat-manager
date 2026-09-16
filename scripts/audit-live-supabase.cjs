const pat = process.env.SUPABASE_PAT;
const projectRef = process.env.SUPABASE_PROJECT_REF;

if (!pat || !projectRef) {
  throw new Error('SUPABASE_PAT and SUPABASE_PROJECT_REF are required');
}

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Supabase audit failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function main() {
  const view = await query(`
    SELECT c.relname, c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'public_artist_profiles'
  `);
  const featured = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'artworks' AND column_name = 'is_featured'
  `);
  const policies = await query(`
    SELECT tablename, policyname, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('artists', 'artworks', 'commissions', 'payouts', 'audit_logs')
    ORDER BY tablename, policyname
  `);
  const legacyImages = await query(`
    SELECT count(*)::integer AS count
    FROM public.artworks
    WHERE image_url ~* '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/'
  `);
  console.log(JSON.stringify({ view, featured, policies, legacyImages }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
