const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listArtworks() {
  const { data, error } = await supabase.from('artworks').select('id, title, wp_product_id, preview_url, status').limit(5);
  console.log('Artworks (5):', error ? error.message : data);
}

listArtworks();
