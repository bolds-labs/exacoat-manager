const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectUser() {
  const email = 'yokokwanarta@gmail.com';
  console.log(`=== CHECKING USER: ${email} ===`);
  
  // 1. Auth Users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.log('Auth List Error:', authError.message);
  } else {
    const user = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      console.log('✅ Found in auth.users:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Email Confirmed At:', user.email_confirmed_at);
      console.log('  Last Sign In:', user.last_sign_in_at);
      console.log('  User Metadata:', JSON.stringify(user.user_metadata, null, 2));
      console.log('  App Metadata:', JSON.stringify(user.app_metadata, null, 2));
    } else {
      console.log('❌ NOT found in auth.users!');
      console.log('Total auth users:', authUsers.users.length);
      authUsers.users.slice(0, 10).forEach(u => console.log('  -', u.email));
    }
  }

  // 2. Artists table
  const { data: artists, error: artistError } = await supabase
    .from('artists')
    .select('*')
    .ilike('email', `%${email}%`);
  
  console.log('\n=== ARTISTS TABLE CHECK ===');
  if (artistError) {
    console.log('Artist Query Error:', artistError.message);
  } else {
    console.log(`Found ${artists.length} artist record(s):`);
    console.log(JSON.stringify(artists, null, 2));
  }
}

inspectUser();
