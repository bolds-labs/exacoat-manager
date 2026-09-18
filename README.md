# Exacoat Manager ERP & Operations Workstation

> Enterprise-grade, modern operations ERP, multi-channel marketplace order dispatcher (Direct Web, Shopee, TikTok Shop), automated warranty & redemption manager, and thermal shipping label station for **Exacoat ([exacoat.com](https://exacoat.com))**.

---

## 🌟 Key Features & Capabilities

- **Multi-Channel Fulfillment Hub**:
  - Live unified order management across **Exacoat Direct Web**, **Shopee Indonesia**, and **TikTok Shop Open Platform**.
  - One-click logistics arrangement and tracking number allocation.
  - Thermal 4x6" / A6 shipping label generator with high-resolution Code128 barcodes and skin specification manifests.

- **Automated Warranty & Redeem Claims**:
  - Deduplication and verification of marketplace invoice numbers against WooCommerce warranty orders.
  - Pre-filled customer contact, device, and skin configuration mappings.

- **Precision Configurator Studio**:
  - Device skin model management, skin texture definitions, coverage configurations, and preview canvas.

- **System Diagnostics & Telemetry**:
  - Real-time API connectivity checks, courier tracking pool monitoring, and audit log telemetry.

---

## 📚 Documentation & Architecture

- **[Codebase Isolation Rules](./docs/CODEBASE_ISOLATION_RULES.md)**: Strict rules ensuring Artmatter reference code is never ported unadjusted into Exacoat.
- **[Shopee Integration Guide](./docs/SHOPEE_INTEGRATION.md)**: Shopee Open Platform API v2 HMAC signing, OAuth token auto-refresh, order sync, and thermal AWB printing.
- **[TikTok Shop Integration Guide](./docs/TIKTOK_INTEGRATION.md)**: TikTok Shop Open Platform API 202309, Service ID `7686433028542351124`, HMAC-SHA256 signing, order search, and shipment fulfillment.
- **[Marketplace Architecture Roadmap](./docs/MARKETPLACE_ARCHITECTURE.md)**: Phased transition from monolithic WordPress core plugin to high-performance standalone Go/Node container.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Build production bundle & package WordPress plugin
npm run build
```

---

## 🛡️ License

Proprietary • Built for Exacoat
