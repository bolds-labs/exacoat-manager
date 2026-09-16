const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkArtwork() {
  const { data, error } = await supabase
    .from('artworks')
    .select('id, title, wp_post_id, preview_url, image_url, thumbnail_url, status')
    .or('wp_post_id.eq.15770,title.ilike.%visit%');

  console.log('Artworks service query result:');
  console.log(JSON.stringify(data, null, 2));
}

checkArtwork();
