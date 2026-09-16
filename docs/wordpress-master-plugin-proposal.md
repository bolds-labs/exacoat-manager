# Artmatter Core — WordPress Master Plugin Architecture Proposal

## 1. Executive Summary

Artmatter currently utilizes **38 individual WPCode snippets** alongside multi-step n8n webhook pipelines to manage artist profiles, submission workflows, coupon discounts, master artwork storage, tracking numbers, and commission recording in Supabase.

### Current Challenges with Snippets & Fragmented Automation:
- **Execution Overhead**: Running 38 loose code snippets on every WordPress request introduces hook latency, race conditions, and debugging friction.
- **Flaky Multi-Hop Sync**: If an n8n webhook or network hiccup occurs during an order transition, commissions can be missed with no automatic WooCommerce retry.
- **Database Pollution**: Custom user meta and product meta are written across different snippet scopes without unified data validation.

---

## 2. Proposed Architecture: `artmatter-core` Plugin

Consolidate all snippets into a modular, object-oriented WordPress plugin located in `/wp-content/plugins/artmatter-core/`.

### Directory Structure
```
artmatter-core/
├── artmatter-core.php                 # Main plugin entry point & autoloader
├── includes/
│   ├── class-artmatter-core.php       # Core bootstrap & dependency container
│   ├── class-artist-manager.php       # Artist roles, AMXXXX invite codes, OTP verification, bio sync
│   ├── class-commission-engine.php    # Order commission calculation (12.5%, 17.5%, 20%, Share & Earn)
│   ├── class-supabase-sync.php        # Direct, signed REST webhook sync with Action Scheduler retries
│   ├── class-image-sizes.php           # Canonical artwork and tactile WebP derivatives
│   ├── class-artwork-vault.php        # /arts-master/ protection, watermark generation, RML sync
│   ├── class-shipping-tracker.php     # Biteship integration, tracking URL injector & order notes
│   └── class-multicurrency.php        # Aelia / FX conversion cache (USD / IDR rate management)
└── admin/
    ├── class-admin-settings.php       # WP Admin settings panel for Supabase keys & webhook URLs
    └── views/
        └── settings-page.php          # Admin UI
```

---

## 3. Core Modules & Snippet Mapping

| Master Plugin Module | Consolidated WPCode Snippets | Purpose & Benefits |
| :--- | :--- | :--- |
| **`class-artist-manager.php`** | `14015` (Invite Codes), `14067` (Email OTP), `12477` (Phone OTP), `12366` (User Webhook), `13840` (Display Name Denormalization), `13401` (Artwork Recount) | Unifies all artist profile fields, invite codes (`AMXXXX`), phone/email OTP verification into a single service. |
| **`class-commission-engine.php`** | `12916` (Order Webhook), `12913` (Share & Earn Referrals), `14478` (40% Artist discount for own art) | Calculates exact commission tiers directly within WooCommerce upon order completion, eliminating n8n calculation latency. |
| **`class-supabase-sync.php`** | n8n order webhooks, user sync webhooks | Directly communicates with Supabase REST API via signed JWTs. Uses WooCommerce Action Scheduler to guarantee delivery with automatic exponential retries. |
| **`class-image-sizes.php`** | Artmatter-owned image sizing | Registers proportional 480px artwork previews, 800px tactile flat previews, and 1200px display images. Keeps storefront and Manager image contracts independent from theme and WooCommerce settings. |
| **`class-artwork-vault.php`** | `2979` (Hidden artwork move), `4281` (Disable thumbnails on `/arts-master/`), `4381` (Real physical library sync), `12640` (Hide master files in media library), `15132` (Master file replacement) | High-res artwork protection vault. Keeps original 300 DPI master files safe from public scraping and prevents WordPress thumbnail bloat. |
| **`class-shipping-tracker.php`** | `6902` (Biteship shipping), `13537` (Tracking URL inject), `13600` (Tracking order notes), `14577` (Free shipping logic) | Seamless carrier tracking injection (JNE, SiCepat, DHL) and automated order note auditing. |
| **`class-multicurrency.php`** | `11889` (Aelia multi-currency), `14576` (Disable IDR overseas) | Currency normalization and checkout validation. |

---

## 4. Sample Implementation: `class-supabase-sync.php`

```php
<?php
/**
 * Direct Supabase Synchronizer with Action Scheduler Retries
 * Location: wp-content/plugins/artmatter-core/includes/class-supabase-sync.php
 */

if (!defined('ABSPATH')) exit;

class Artmatter_Supabase_Sync {

    private static $supabase_url = 'https://vamdbdbbltxjfcrsbgsq.supabase.co';
    private static $service_key  = ''; // Read from the server environment.

    public static function init() {
        // Hook order completion to debounced background sync
        add_action('woocommerce_order_status_completed', [__CLASS__, 'queue_order_sync'], 10, 1);
        add_action('artmatter_execute_supabase_order_sync', [__CLASS__, 'execute_order_sync'], 10, 1);
    }

    public static function queue_order_sync($order_id) {
        if (function_exists('as_enqueue_async_action')) {
            as_enqueue_async_action('artmatter_execute_supabase_order_sync', ['order_id' => $order_id], 'artmatter-sync');
        }
    }

    public static function execute_order_sync($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) return;

        $items = $order->get_items();
        foreach ($items as $item_id => $item) {
            $product_id = $item->get_product_id();
            $artist_id  = get_post_meta($product_id, 'artwork_artist_uuid', true);
            $comm_rate  = floatval(get_post_meta($product_id, 'artwork_commission_rate', true) ?: 12.5);

            $line_total = floatval($item->get_total());
            $comm_amount = round($line_total * ($comm_rate / 100), 2);

            // Send payload to Supabase commissions table
            $payload = [
                'order_wp_id'       => $order_id,
                'order_item_wp_id'  => $item_id,
                'artist_id'         => $artist_id ?: null,
                'original_amount'   => $line_total,
                'converted_amount'  => $line_total,
                'commission_rate'   => $comm_rate,
                'commission_amount' => $comm_amount,
                'order_currency'    => $order->get_currency(),
                'status'            => 'commission_pending',
                'created_by'        => 'artmatter_core_wp',
                'created_at'        => gmdate('Y-m-d\TH:i:s\Z'),
                'clearance_at'      => gmdate('Y-m-d\TH:i:s\Z', strtotime('+14 days')),
            ];

            wp_remote_post(self::$supabase_url . '/rest/v1/commissions', [
                'headers' => [
                    'apikey'        => self::$service_key,
                    'Authorization' => 'Bearer ' . self::$service_key,
                    'Content-Type'  => 'application/json',
                    'Prefer'        => 'return=representation',
                ],
                'body'    => wp_json_encode($payload),
                'timeout' => 15,
            ]);
        }
    }
}

Artmatter_Supabase_Sync::init();
```

---

## 5. Migration Strategy

1. **Phase 1: Deploy Artmatter Artist Manager ERP** (Current web application running on Dokploy to manage Supabase data in real-time).
2. **Phase 2: Package `artmatter-core` Plugin** (Install in staging WordPress to verify checkout and commission generation).
3. **Phase 3: Disable WPCode Snippets** (Deactivate snippets 1-by-1 in WPCode dashboard with zero downtime).
