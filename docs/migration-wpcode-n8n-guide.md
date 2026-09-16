# Artmatter Master Plugin Migration & Deactivation Guide

A comprehensive, step-by-step guide to installing the **Artmatter Core Engine** WordPress master plugin, configuring GitHub auto-updates, and safely deactivating redundant WPCode snippets and n8n workflows.

---

## 1. How to Install the Plugin in WordPress

### Method A: Upload via WordPress Admin (Easiest)
1. Download `artmatter-core.zip` from your Artmatter Artist Manager ERP app (**Settings tab → Download Plugin button**) or grab it directly from the repo.
2. Log in to your WordPress Admin (`artmatter.co/wp-admin`).
3. Go to **Plugins → Add New Plugin → Upload Plugin**.
4. Choose `artmatter-core.zip` and click **Install Now**.
5. Click **Activate Plugin**.
6. Navigate to the new menu item: **Artmatter Core** in your WP Admin sidebar.
7. Click **"Run Diagnostic Test"** to verify your live Supabase connection!

### Method B: Upload via SFTP / SSH
1. Upload the unzipped `artmatter-core` folder to `/wp-content/plugins/`.
2. Go to **Plugins → Installed Plugins** and click **Activate** on **Artmatter Core Engine**.

---

## 2. How GitHub Auto-Updates Work

The plugin includes an embedded **GitHub Automatic Updater** (`admin/class-github-updater.php`).

### How to push updates:
Whenever you make updates to the plugin in `github.com/bolds-labs/artmatter-artist-manager`:
1. Increment the version in `artmatter-core.php` (e.g. `Version: 1.0.1`).
2. Create a new GitHub Release or Tag (e.g. `v1.0.1`).
3. In your WordPress Admin (**Plugins → Installed Plugins**), WordPress will automatically display:
   > *"There is a new version of Artmatter Core Engine available. View version 1.0.1 details or **Update Now**."*
4. Clicking **Update Now** updates the plugin in 1 click directly from GitHub!

---

## 3. WPCode Snippets Audit: Which Ones to Disable

Once the `artmatter-core` plugin is activated, you can safely turn OFF the following snippets in your WPCode dashboard.

### Group 1: 🔴 TURN OFF (Consolidated into Plugin)

| WPCode Snippet ID | Snippet Title | Consolidated Plugin Class | Notes |
| :--- | :--- | :--- | :--- |
| **`1235`** | `Artist - Create Page for Each Artist` | `class-artist-manager.php` | Custom rewrite for `/artist/username/` + RankMath SEO title override. |
| **`14015`** | `[ARTIST INVITE CODE] Logic & Function` | `class-artist-manager.php` | `AMXXXX` invite code validator, note logger & table manager. |
| **`14067`** | `[SECURITY] OTP verification - email` | `class-artist-manager.php` | REST API for sending & verifying 6-digit email OTPs. |
| **`12477`** | `[SECURITY] OTP verification - phone` | `class-artist-manager.php` | Mobile SMS/Phone OTP endpoint. |
| **`13401`** | `[META_KEYS] - Artist artwork counts` | `class-artist-manager.php` | Fast direct SQL artwork published counter (`artist_artwork_published`). |
| **`13840`** | `[META_KEYS] - Add product_artist_display_name` | `class-artist-manager.php` | Denormalizes artist display name to product meta. |
| **`12109`** | `[ACF INTEGRATION] artist_country in bricks` | `class-artist-manager.php` | Artist country helper. |
| **`12916`** | `[WEBHOOK] - Order Update` | `class-supabase-sync.php` | Replaced by Action Scheduler direct Supabase sync with automatic retry queues. |
| **`12913`** | `[ARTIST] - Share & Earn Referral Link` | `class-commission-engine.php` | Captures `?r=username` cookie and credits bonus commission. |
| **`14478`** | `[ARTIST] [ACFW] Buy their own artwork, get 40% discount` | `class-commission-engine.php` | Restricts `ARTISTPERKS` coupon strictly to artist's own artworks. |
| **`14576`** | `[CHECKOUT] - Disable IDR for overseas` | `class-commission-engine.php` | Prevents checkout if IDR currency is used for international delivery. |
| **`11889`** | `Aelia Multi Currency - auto generate prices` | `class-commission-engine.php` | Currency conversions and price generation. |
| **`2979`** | `[UPLOAD SYSTEM] Move artwork into hidden folder` | `class-artwork-vault.php` | Master high-res file protection vault. |
| **`4281`** | `[MEDIA] Disable thumbnail generation on /arts-master/` | `class-artwork-vault.php` | Eliminates storage bloat from 300 DPI master files. |
| **`4381`** | `[MEDIA] Real Physical Library sync with server` | `class-artwork-vault.php` | File system sync. |
| **`12640`** | `[MEDIA] Hide /arts-master/ from media library` | `class-artwork-vault.php` | Hides master files from general media modal. |
| **`12819`** | `[PRODUCT] - Add 'Rejected' & 'Scheduled for removal' status` | `class-artwork-vault.php` | Registers custom post statuses in WooCommerce. |
| **`10117`** | `[NAMING SYSTEM] - Product Slugs with Product ID` | `class-artwork-vault.php` | Enforces `title-{id}` URL slugs. |
| **`15132`** | `[PRODUCT] - Master File Replacement on product page` | `class-artwork-vault.php` | High-res master replacement meta box. |
| **`6902`** | `WOOCOMMERCE - Shipping Method from BiteShip` | `class-shipping-tracker.php` | Biteship integration. |
| **`13537`** | `[SHIPMENT] - Add tracking URL & Inject email` | `class-shipping-tracker.php` | Carrier tracking URL formatting and customer email injection. |
| **`13600`** | `[SHIPMENT] - Add order notes on tracking update` | `class-shipping-tracker.php` | Automatic order note logging. |
| **`14577`** | `[SHIPMENT] - Free shipping function` | `class-shipping-tracker.php` | Free shipping calculation rules. |
| **`12366`** | `[WEBHOOK] - User Update` | `class-supabase-sync.php` | Direct Supabase artist profile sync. |

---

### Group 2: 🗑️ DELETE PERMANENTLY (Obsolete / Test / Debug Snippets)

| Snippet ID | Snippet Title | Reason to Delete |
| :--- | :--- | :--- |
| **`15133`** | `test` | Temporary `?rml_fix=15279` test URL trigger. |
| **`15091`** | `debug` | Scratch "Truth Finder" database postmeta search page. |
| **`12853`** | `temporary` | Incomplete 3-line query snippet. |

---

### Group 3: 🟢 KEEP AS-IS IN WPCODE (Site/Builder Specific)

| Snippet ID | Snippet Title | Reason to Keep in WPCode |
| :--- | :--- | :--- |
| **`14819`** | `[ANALYTICS] Rybbit - Woocommerce action` | Pure analytics pixel tracker. Keep in WPCode or move to Google Tag Manager. |
| **`16143`** | `[BRICKS] Bypass Maintenance mode for custom posters` | Bricks-specific route filter for `/posters/custom`. Keep if using Bricks maintenance mode. |
| **`2491`** | `PHP Scripts` (Custom login redirect / CheckoutWC coupon label) | Theme-level template redirect. |

---

## 4. n8n Workflows: What to Keep vs. What to Simplify

Because the WordPress plugin now communicates **directly with Supabase using signed REST endpoints and Action Scheduler background retries**, you can optimize your n8n workflows:

### Workflows to RETIRE in n8n:
- ❌ **Order Webhook Router (`artmatter/wp/order`)**: No longer needed for registering commissions in Supabase; WordPress does this directly with guaranteed retry delivery.
- ❌ **User Profile Sync Webhook (`WPcode - user update`)**: Direct sync is now handled by `class-supabase-sync.php`.
- ❌ **Duplicate FX Currency Fetch**: Supabase and the ERP handle multi-currency conversions automatically.

### Workflows to KEEP in n8n:
- ✅ **ZeptoMail Transactional Notification Router**: (e.g. sending artist approval emails, first sale alerts, payout completion emails with PDF attachments).
- ✅ **Pushover Admin Alerts**: (e.g. notifications when an artist purchases their own artwork or applies for verification).
- ✅ **AI Image Analysis / Fandom Description Generator**: (Gemini/OpenAI LangChain nodes for generating artwork tags and fandom metadata).
