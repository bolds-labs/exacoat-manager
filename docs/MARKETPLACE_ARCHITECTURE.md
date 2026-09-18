# Exacoat Multi-Channel Marketplace Architecture

Strategic and technical architectural review for managing external e-commerce marketplaces (Shopee Indonesia, TikTok Shop Open Platform, Tokopedia) within the Exacoat ecosystem.

---

## 1. Context and Architectural Challenge

Exacoat operates an advanced custom manufacturing and customization business:
- **Exacoat Direct Web**: WooCommerce with Acowebs custom skin configurators.
- **Shopee Indonesia Store**: High-volume marketplace orders with SPX / J&T logistics.
- **TikTok Shop**: Live shopping and social commerce fulfillment.
- **Exacoat Manager (manager.exacoat.com)**: Unified operations workstation for tracking, production, thermal labeling, and warranty claims.

Managing multiple marketplaces introduces three architectural requirements:
1. **Cryptographic Security**: Secure server-side storage of partner secrets (pp_secret, partner_key) and request signing (HMAC-SHA256).
2. **24/7 Webhook Listening**: High-throughput public endpoints responding within 2 seconds to marketplace status events.
3. **Warranty Deduplication**: Cross-referencing marketplace invoice numbers against WooCommerce warranty claim history to eliminate fraudulent duplicate claims.

---

## 2. Architecture Comparison

### Option A: WordPress Plugin Engine (exacoat-core): Current Implementation
- **Topology**: React SPA on Dokploy (manager.exacoat.com) communicates via authenticated REST calls with WordPress plugin endpoints (/wp-json/exacoat-core/v1/...).
- **Benefits**:
  - Zero extra hosting cost or server footprint.
  - Native database access: Checking _marketplace_invoice against WooCommerce orders is a single local SQL query.
  - Rapid implementation: Shopee and TikTok engines share identical lifecycle paradigms.
- **Trade-offs**:
  - Webhooks and sync batches execute within PHP worker threads.
  - Maintenance on WordPress pauses marketplace synchronization.

### Option B: Unified Dokploy API Service (api.manager.exacoat.com): Scaled Future State
- **Topology**: Separate Node.js / Fastify container running on Dokploy alongside manager.exacoat.com, backed by Postgres or Supabase.
- **Benefits**:
  - Complete decoupling from WooCommerce.
  - Event-driven Node.js event loop handling hundreds of webhook requests per second with sub-10ms response times.
  - In-memory token management and reliable cron timers.
- **Trade-offs**:
  - Requires maintaining an additional Docker service and database in Dokploy.
  - Requires network HTTP calls back to WooCommerce for customer warranty claim validation.

---

## 3. Decision and Phased Progression

### Phase 1: Operational Agility (Active)
Implement TikTok Shop Open Platform in exacoat-core (class-tiktok-client.php) alongside class-shopee-client.php.
- Provides instant order visibility, AWB thermal label printing, shipment arrangement, and warranty checks today.
- Methods are built with clean, isolated JSON contracts.

### Phase 2: Decoupled Migration Trigger (Future)
When marketplace order volume exceeds server thresholds or when Exacoat transitions to a headless storefront:
1. Spin up Dokploy service exacoat-api running Node.js / Express.
2. Port Exacoat_Shopee_Client and Exacoat_TikTok_Client into TypeScript services (ShopeeService.ts, TikTokService.ts).
3. Connect Dokploy Traefik routing for pi.manager.exacoat.com.
4. Point manager.exacoat.com directly to pi.manager.exacoat.com.
5. Update exacoat-core warranty check to query https://api.manager.exacoat.com/v1/orders/verify.
