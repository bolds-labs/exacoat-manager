const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vamdbdbbltxjfcrsbgsq.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log('=== SUPABASE QUERY LATENCY BENCHMARK ===');
  
  const tables = ['artists', 'artworks', 'commissions', 'payouts', 'orders'];
  for (const table of tables) {
    const t0 = Date.now();
    try {
      const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' }).limit(10);
      const elapsed = Date.now() - t0;
      if (error) {
        console.log(`[${table}] ❌ Error (${elapsed}ms): ${error.message}`);
      } else {
        console.log(`[${table}] ⏱️ ${elapsed}ms | Total rows in table: ${count} | Fetched 10 rows (${JSON.stringify(data).length} bytes)`);
      }
    } catch (e) {
      console.log(`[${table}] ❌ Exception: ${e.message}`);
    }
  }
}

testSupabase();