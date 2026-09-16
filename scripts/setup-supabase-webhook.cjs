async function main() {
  const pat = process.env.SUPABASE_PAT;
  if (!pat) throw new Error('SUPABASE_PAT is required');
  const projectRef = 'vamdbdbbltxjfcrsbgsq';

  console.log('[SUPABASE] Inspecting artists table schema...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'artists'
        ORDER BY ordinal_position;
      `
    })
  });

  const text = await res.text();
  console.log('[SUPABASE] Columns:', text);
}

main().catch(console.error);
