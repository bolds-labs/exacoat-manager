# Artmatter Artist Manager ERP & Payout Hub

> Enterprise-grade, modern glassmorphic Artist Management ERP, automated commission tracking, and payout disbursement platform for **Artmatter ([artmatter.co](https://artmatter.co))**, backed by live Supabase data and WordPress/WooCommerce integration.

---

## 🌟 Key Features & Capabilities

- **Executive Analytics & KPI Dashboard**:
  - Live Gross Sales ($), Total Artist Commissions ($), Pending Payouts ($), and Catalog statistics.
  - Interactive Recharts Area & Donut charts for sales volume, artist tier distributions, and payout trends.
  - Top Earning Artists Leaderboard and Top Selling Artworks Ranking.
  - Urgent Action Alert Banners for pending payouts and artwork approvals.

- **Artist CRM & Tier Management**:
  - Complete directory with search, filtering (by Badge, Status, KYC verification, Country, Boosted status), and sorting.
  - Slide-out Artist Detail Drawer with profile preview, financial KPI cards, identity document viewer, and payment details.
  - Real-time Tier / Badge Management (Community Creator 12.5%, Curated Artist 17.5%, Verified Artist 20.0%, Public Domain 0.0%) with instant commission rate recalculation.
  - Boosted Promo toggle and KYC verification management.

- **Artwork Moderation & High-Res Catalog**:
  - Toggle between visual Card Grid and rapid Table moderation views.
  - High-res artwork modal with zoom preview, metadata inspector (fandom, collection, tags, style, mood, colors).
  - Moderation workflow: Approve & Publish, Reject with reason note (triggers 14-day schedule deletion), and Schedule for Removal.

- **Commissions Real-time Ledger**:
  - Complete transaction ledger across all orders with multi-currency (IDR to USD) conversion.
  - Status management: `Pending Clearance`, `Approved for Payout`, `Processing`, `Paid Out`, `Cancelled`.
  - Batch approval actions and full CSV export.

- **Payouts Hub & Statement Generator**:
  - Tabbed payout processing queue (`Pending Requests`, `Processing`, `Completed / Sent`, `Rejected`).
  - Disbursement modal with withholding tax calculation and transaction reference / bank proof recording.
  - Manual Payout Wizard: Aggregate an artist's approved commissions into a new payout record.
  - Formatted Printable PDF Payout Statements & Invoices generated with jsPDF.

- **System Health Diagnostics & Anomaly Scanner**:
  - Real-time Supabase latency ping and table integrity inspection.
  - Automated anomaly scanner (detects orphan commissions, missing payout destinations, stale pending items, KYC verifications).
  - Diagnostic JSON report export.

- **Immutable Audit Trail**:
  - Searchable activity stream tracking badge upgrades, status modifications, and disbursements with expandable JSON payloads.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/bolds-labs/artmatter-artist-manager.git
cd artmatter-artist-manager

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start local development server
npm run dev
```

App will be available at `http://localhost:3000`.

---

## 🐳 Dokploy Production Deployment

This project includes a production-ready multi-stage `Dockerfile` and `nginx.conf` optimized for Dokploy.

1. In Dokploy, create a new **Application** connected to `bolds-labs/artmatter-artist-manager`.
2. Select **Dockerfile** build type.
3. Configure the public browser variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_EMAIL`. Keep service-role credentials and passwords in the CMS environment only.
4. Port: `80` (Internal).
5. Click **Deploy**.

For detailed setup instructions, see [docs/dokploy-deployment-guide.md](./docs/dokploy-deployment-guide.md).

---

## 📦 WordPress Master Plugin Architecture Proposal

See [docs/wordpress-master-plugin-proposal.md](./docs/wordpress-master-plugin-proposal.md) for the complete specification to consolidate the 38 WPCode snippets and n8n webhooks into a unified `artmatter-core` WordPress plugin.

---

## 🛡️ License

Proprietary • Built for Artmatter Co.
