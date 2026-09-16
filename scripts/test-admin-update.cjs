const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testAdminUpdate() {
  const yokoId = '6c8b3a1a-247c-4b80-b596-2d4e647fb3a5';
  console.log('Testing admin updateUserById for:', yokoId);
  
  const { data, error } = await supabase.auth.admin.updateUserById(yokoId, {
    user_metadata: { role: 'artist' },
    email_confirm: true
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('✅ Success! User updated:', data.user.email);
  }
}

testAdminUpdate();
