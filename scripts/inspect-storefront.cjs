const https = require('https');

https.get('https://artmatter.co/', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('=== HTML SIZE & SCRIPT INSPECTION ===');
    console.log(`HTML Payload Size: ${(body.length / 1024).toFixed(2)} KB`);
    
    // Find all <script> tags
    const scripts = body.match(/<script[^>]+src=["']([^"']+)["']/gi) || [];
    console.log(`Total External Scripts: ${scripts.length}`);
    scripts.slice(0, 15).forEach(s => console.log('  ', s));

    // Find all <link rel="stylesheet"> tags
    const styles = body.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi) || [];
    console.log(`Total Stylesheets: ${styles.length}`);

    // Check for images
    const images = body.match(/<img[^>]+src=["']([^"']+)["']/gi) || [];
    console.log(`Total <img> tags: ${images.length}`);
  });
});