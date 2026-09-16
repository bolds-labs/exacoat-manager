const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

async function testSync() {
  const payload = {
    wp_id: 3730,
    title: 'Sunlit Village Lanes',
    slug: 'sunlit-village-lane-3730',
    status: 'publish',
    short_description: 'A serene old-world alley winds between timeworn cottages with terracotta roofs and ivy-clad walls. Warm sunlight and cracked paint textures create a nostalgic, storybook charms.',
    description: null,
    metadata: {
      short_description: 'A serene old-world alley winds between timeworn cottages with terracotta roofs and ivy-clad walls. Warm sunlight and cracked paint textures create a nostalgic, storybook charms.',
      description: null,
      note: null,
      is_nsfw: false
    },
    image_url: 'https://artmatter.co/wp-content/uploads/arts/artists/maya/sunlit-village-lanes-3730.jpg',
    product_url: 'https://artmatter.co/posters/sunlit-village-lane-3730',
    orientation: 'portrait',
    fandom: null,
    collection: 'maya',
    tags: 'cottage architecture, countryside path, crackle effect art, european village scene, historic street, ivy covered walls, old village, quaint street, rustic painting, sunny alleyway, terracotta roof tiles, village lane',
    subject: 'Cityscape, Landscape',
    style: 'Painting, Vintage',
    mood: 'Calm, Nostalgic',
    color: 'Earth Tones, Light Palette, Warm Colors',
    is_exclusive: false,
    is_nsfw: false,
    total_sales: 12,
    updated_at: new Date().toISOString(),
    artist_id: '289acfe8-5822-4872-b00d-6449f65b27f7'
  };

  console.log('Sending PATCH request to Supabase...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?wp_id=eq.3730`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  console.log('PATCH Status:', res.status, res.statusText);
  const data = await res.json();
  console.log('PATCH Result:', data);
}

testSync().catch(console.error);
