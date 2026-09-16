const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vamdbdbbltxjfcrsbgsq.supabase.co';
const anonKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, anonKey);

async function checkArtwork() {
  const { data, error } = await supabase
    .from('artworks')
    .select('id, title, wp_post_id, preview_url, image_url, thumbnail_url, status')
    .ilike('title', '%visit%');

  console.log('Artworks query result:');
  console.log(JSON.stringify(data, null, 2));
}

checkArtwork();