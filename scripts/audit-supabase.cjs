async function inspectNotificationTriggers() {
  const pat = process.env.SUPABASE_PAT;
  if (!pat) throw new Error('SUPABASE_PAT is required');
  const projectRef = 'vamdbdbbltxjfcrsbgsq';

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    return await res.json();
  }

  const defs = await query(`
    SELECT proname, pg_get_functiondef(oid) as def
    FROM pg_proc 
    WHERE proname IN ('notify_commission_updates', 'notify_artist_updates');
  `);

  console.log(JSON.stringify(defs, null, 2));
}

inspectNotificationTriggers().catch(console.error);
