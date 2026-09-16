const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

snippets.slice(0, 16).forEach(s => {
  console.log(`========================================================================`);
  console.log(`ID: ${s.id} | Title: ${s.title}`);
  console.log(`------------------------------------------------------------------------`);
  
  const addActionMatches = [...s.code.matchAll(/add_action\s*\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const addFilterMatches = [...s.code.matchAll(/add_filter\s*\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const updateOptionMatches = [...s.code.matchAll(/update_option\s*\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const getOptionMatches = [...s.code.matchAll(/get_option\s*\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const updatePostMetaMatches = [...s.code.matchAll(/update_post_meta\s*\([^,]+,\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const getPostMetaMatches = [...s.code.matchAll(/get_post_meta\s*\([^,]+,\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const updateUserMetaMatches = [...s.code.matchAll(/update_user_meta\s*\([^,]+,\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const getUserMetaMatches = [...s.code.matchAll(/get_user_meta\s*\([^,]+,\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const httpMatches = [...s.code.matchAll(/https?:\/\/[^\s"'\)]+/g)].map(m => m[0]);
  
  console.log(`Actions (${addActionMatches.length}):`, addActionMatches);
  console.log(`Filters (${addFilterMatches.length}):`, addFilterMatches);
  console.log(`Options (get/update):`, [...new Set([...getOptionMatches, ...updateOptionMatches])]);
  console.log(`Post Meta:`, [...new Set([...getPostMetaMatches, ...updatePostMetaMatches])]);
  console.log(`User Meta:`, [...new Set([...getUserMetaMatches, ...updateUserMetaMatches])]);
  console.log(`Endpoints/URLs:`, [...new Set(httpMatches)]);
});
