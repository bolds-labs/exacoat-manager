const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRpcs() {
  const { data, error } = await supabase.rpc('get_admin_users');
  console.log('get_admin_users result:', error ? error.message : data?.length + ' users');
  
  // Set password for yokokwanarta@gmail.com if needed or check its status
  const { data: userData, error: userErr } = await supabase.auth.admin.listUsers();
  const yoko = userData?.users?.find(u => u.email === 'yokokwanarta@gmail.com');
  console.log('Yoko user:', yoko ? { id: yoko.id, email: yoko.email, confirmed: yoko.email_confirmed_at } : 'Not found');
}

checkRpcs();
