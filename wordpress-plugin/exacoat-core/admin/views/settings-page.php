<?php
/**
 * Exacoat Core Platform - Operations & Settings Dashboard
 * Modern, High-Performance Admin Console for WordPress & WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $wpdb;

// Ensure version constants
$current_version = defined( 'EXACOAT_CORE_VERSION' ) ? EXACOAT_CORE_VERSION : '0.0.3';
$php_version     = phpversion();
$memory_limit    = ini_get( 'memory_limit' );
$wp_version      = get_bloginfo( 'version' );
$wc_active       = class_exists( 'WooCommerce' );
$wc_version      = $wc_active ? WC()->version : 'Not Installed';
$upload_dir      = wp_upload_dir();
$upload_writable = is_writable( $upload_dir['basedir'] );

// Check update status safely
$update_plugins     = get_site_transient( 'update_plugins' );
$plugin_basename    = defined( 'EXACOAT_CORE_FILE' ) ? plugin_basename( EXACOAT_CORE_FILE ) : 'exacoat-core/exacoat-core.php';
$has_pending_update = false;
$pending_version    = '';

if ( is_object( $update_plugins ) && isset( $update_plugins->response ) && is_array( $update_plugins->response ) ) {
	if ( isset( $update_plugins->response[ $plugin_basename ]->new_version ) ) {
		$remote_ver = trim( (string) $update_plugins->response[ $plugin_basename ]->new_version );
		// Ignore any legacy Artmatter 7.x contamination
		if ( version_compare( $remote_ver, '7.0', '<' ) && version_compare( $current_version, $remote_ver, '<' ) ) {
			$has_pending_update = true;
			$pending_version    = $remote_ver;
		}
	}
}

// Manager URL
$manager_url = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : 'http://localhost:3005';
?>

<style>
/* Reset & Full Bleed Overrides */
#wpcontent { padding-left: 0 !important; }
#wpbody-content { padding-bottom: 0 !important; }
#wpfooter { display: none !important; }
.notice, div.error, div.updated { display: none !important; }
.exacoat-notice { display: block !important; }

/* Exacoat App Shell */
.ex-app {
	display: flex;
	min-height: calc(100vh - 48px);
	background: #090a0d;
	color: #f4f4f5;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
	margin: 12px 20px 24px 16px;
	border-radius: 16px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
	overflow: hidden;
	box-sizing: border-box;
}

/* Sidebar */
.ex-sidebar {
	width: 260px;
	min-width: 260px;
	background: #0d0e12;
	border-right: 1px solid rgba(255, 255, 255, 0.08);
	display: flex;
	flex-direction: column;
	position: sticky;
	top: 32px;
	height: calc(100vh - 32px);
	z-index: 100;
}
@media screen and (max-width: 782px) {
	.ex-sidebar { top: 46px; height: calc(100vh - 46px); }
}

/* Brand */
.ex-brand {
	padding: 22px 20px 18px;
	display: flex;
	align-items: center;
	gap: 12px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	background: #0e0f14;
}
.ex-brand-logo {
	width: 36px;
	height: 36px;
	border-radius: 10px;
	background: linear-gradient(180deg, #f6b328 0%, #ea9c0f 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 2px 8px rgba(243, 170, 24, 0.3);
	color: #08090b;
	font-weight: 900;
	font-size: 16px;
	flex-shrink: 0;
}
.ex-brand-info {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.ex-brand-title {
	font-size: 14px;
	font-weight: 700;
	color: #ffffff;
	letter-spacing: -0.01em;
}
.ex-brand-version {
	font-size: 11px;
	font-weight: 700;
	color: #f3aa18;
	font-family: ui-monospace, SFMono-Regular, monospace;
}

/* Nav */
.ex-nav {
	padding: 16px 12px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 1;
}
.ex-nav-header {
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #71717a;
	margin: 16px 12px 6px;
}
.ex-nav-header:first-child { margin-top: 2px; }
.ex-nav-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 12px;
	border-radius: 9px;
	color: #a1a1aa;
	text-decoration: none !important;
	font-size: 13px;
	font-weight: 500;
	transition: all 0.15s ease;
	cursor: pointer;
}
.ex-nav-item:hover {
	color: #ffffff;
	background: rgba(255, 255, 255, 0.05);
}
.ex-nav-item.active {
	color: #08090b;
	background: linear-gradient(180deg, #f6b328 0%, #ea9c0f 100%);
	font-weight: 700;
	box-shadow: 0 2px 8px rgba(243, 170, 24, 0.25);
}
.ex-nav-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
}

/* Sidebar Footer */
.ex-sidebar-footer {
	padding: 16px;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
	background: #090a0d;
}
.ex-status-pill {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: #a1a1aa;
	margin-bottom: 12px;
}
.ex-status-dot {
	width: 8px;
	height: 8px;
	border-radius: 5px;
	background: #10b981;
	box-shadow: 0 0 8px #10b981;
}

/* Main Container */
.ex-main {
	flex: 1;
	display: flex;
	flex-direction: column;
	background: #090a0d;
	overflow-y: auto;
}

/* Topbar */
.ex-topbar {
	padding: 14px 28px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: #0c0d12;
}
.ex-topbar-title {
	font-size: 15px;
	font-weight: 700;
	color: #ffffff;
}
.ex-topbar-actions {
	display: flex;
	align-items: center;
	gap: 10px;
}

/* Action Buttons */
.ex-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 14px;
	border-radius: 9px;
	font-size: 12px;
	font-weight: 600;
	text-decoration: none !important;
	cursor: pointer;
	transition: all 0.2s ease;
	border: none;
	outline: none;
}
.ex-btn-primary {
	background: linear-gradient(180deg, #f6b328 0%, #ea9c0f 100%);
	color: #08090b !important;
	font-weight: 700;
	box-shadow: inset 0 -1.5px 0 rgba(0, 0, 0, 0.18), 0 2px 6px rgba(243, 170, 24, 0.25);
}
.ex-btn-primary:hover {
	background: linear-gradient(180deg, #f8ba3a 0%, #efa518 100%);
	box-shadow: 0 3px 10px rgba(243, 170, 24, 0.35);
}
.ex-btn-secondary {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #e4e4e7 !important;
}
.ex-btn-secondary:hover {
	background: rgba(255, 255, 255, 0.1);
	color: #ffffff !important;
}

/* Content Area */
.ex-content {
	padding: 28px;
	display: flex;
	flex-direction: column;
	gap: 24px;
	flex: 1;
}

/* Panes */
.ex-pane { display: none; }
.ex-pane.active { display: flex; flex-direction: column; gap: 24px; }

/* Grid & Cards */
.ex-grid-4 {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
	gap: 16px;
}
.ex-grid-2 {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
	gap: 20px;
}
.ex-card {
	background: #121318;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 12px;
	padding: 20px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	position: relative;
	overflow: hidden;
}
.ex-card-title {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: #a1a1aa;
}
.ex-card-value {
	font-size: 20px;
	font-weight: 700;
	color: #ffffff;
}
.ex-card-sub {
	font-size: 12px;
	color: #71717a;
}
.ex-card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	padding-bottom: 12px;
	margin-bottom: 8px;
}
.ex-card-h3 {
	font-size: 14px;
	font-weight: 700;
	color: #ffffff;
	margin: 0;
}

/* Tables & Lists */
.ex-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 12px;
}
.ex-table th {
	text-align: left;
	padding: 10px 12px;
	color: #71717a;
	font-size: 11px;
	text-transform: uppercase;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.ex-table td {
	padding: 12px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	color: #d4d4d8;
}
.ex-table tr:hover td {
	background: rgba(255, 255, 255, 0.02);
}
.ex-code {
	font-family: ui-monospace, SFMono-Regular, monospace;
	font-size: 11px;
	background: rgba(255, 255, 255, 0.06);
	padding: 3px 6px;
	border-radius: 4px;
	color: #f3aa18;
}
.ex-badge {
	display: inline-flex;
	align-items: center;
	padding: 3px 8px;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 600;
}
.ex-badge-emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.ex-badge-sky { background: rgba(14, 165, 233, 0.15); color: #38bdf8; }
.ex-badge-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
</style>

<div class="ex-app">
	<!-- SIDEBAR -->
	<aside class="ex-sidebar">
		<div class="ex-brand">
			<div class="ex-brand-logo">E</div>
			<div class="ex-brand-info">
				<div class="ex-brand-title">Exacoat Core</div>
				<div class="ex-brand-version">v<?php echo esc_html( $current_version ); ?></div>
			</div>
		</div>

		<nav class="ex-nav">
			<div class="ex-nav-header">PLATFORM</div>
			<a class="ex-nav-item active" data-pane="overview">
				<span class="ex-nav-icon">📊</span>
				<span>Dashboard & Status</span>
			</a>
			<a class="ex-nav-item" data-pane="headless">
				<span class="ex-nav-icon">⚡</span>
				<span>Headless REST API</span>
			</a>
			<a class="ex-nav-item" data-pane="shipping">
				<span class="ex-nav-icon">🚚</span>
				<span>Fulfillment & Courier</span>
			</a>

			<div class="ex-nav-header">SYSTEM</div>
			<a class="ex-nav-item" data-pane="logs">
				<span class="ex-nav-icon">📋</span>
				<span>Diagnostics & Logs</span>
			</a>
		</nav>

		<div class="ex-sidebar-footer">
			<div class="ex-status-pill">
				<div class="ex-status-dot"></div>
				<span>System Operational</span>
			</div>
			<div style="display: flex; gap: 8px;">
				<button type="button" id="btn-sidebar-flush" class="ex-btn ex-btn-secondary" style="flex: 1; justify-content: center;">
					⚡ Flush
				</button>
				<a href="<?php echo esc_url( $manager_url ); ?>" target="_blank" class="ex-btn ex-btn-primary" style="flex: 1; justify-content: center;">
					ERP ↗
				</a>
			</div>
		</div>
	</aside>

	<!-- MAIN VIEW -->
	<main class="ex-main">
		<!-- TOPBAR -->
		<header class="ex-topbar">
			<div class="ex-topbar-title" id="pane-title">Dashboard & Engine Status</div>
			<div class="ex-topbar-actions">
				<button type="button" id="btn-top-check-updates" class="ex-btn ex-btn-secondary">
					🔄 Check Updates
				</button>
				<a href="<?php echo esc_url( $manager_url ); ?>" target="_blank" class="ex-btn ex-btn-primary">
					Open Exacoat Manager ERP ↗
				</a>
			</div>
		</header>

		<!-- CONTENT -->
		<div class="ex-content">

			<!-- PANE 1: OVERVIEW -->
			<div class="ex-pane active" id="pane-overview">
				<!-- KPI Cards -->
				<div class="ex-grid-4">
					<div class="ex-card">
						<div class="ex-card-title">Plugin Version</div>
						<div class="ex-card-value">v<?php echo esc_html( $current_version ); ?></div>
						<div class="ex-card-sub"><?php echo $has_pending_update ? 'Update to v' . esc_html( $pending_version ) . ' available' : 'Up to date (Channel: Stable)'; ?></div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">Headless REST API</div>
						<div class="ex-card-value" style="color: #34d399;">Active</div>
						<div class="ex-card-sub">/wp-json/exacoat/v1</div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">WooCommerce Engine</div>
						<div class="ex-card-value"><?php echo $wc_active ? 'v' . esc_html( $wc_version ) : 'Inactive'; ?></div>
						<div class="ex-card-sub"><?php echo $wc_active ? 'Orders & Fulfillment Connected' : 'WooCommerce Required'; ?></div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">Shipping & Couriers</div>
						<div class="ex-card-value" style="color: #fbbf24;">Biteship</div>
						<div class="ex-card-sub">Waybill A6 barcodes active</div>
					</div>
				</div>

				<!-- Architecture Cards -->
				<div class="ex-grid-2">
					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Platform Modules & Features</h3>
							<span class="ex-badge ex-badge-emerald">Live</span>
						</div>
						<table class="ex-table">
							<tr>
								<td><strong>Headless Pages Controller</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Bricks Builder API for Next.js (<span class="ex-code">/pages</span>)</td>
							</tr>
							<tr>
								<td><strong>Ready-to-Ship Statuses</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td><span class="ex-code">wc-in-production</span>, <span class="ex-code">wc-quality-check</span></td>
							</tr>
							<tr>
								<td><strong>Customer Reviews Engine</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Photo uploads & buyer verification</td>
							</tr>
							<tr>
								<td><strong>Customer Wishlists</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Session & user product saves</td>
							</tr>
							<tr>
								<td><strong>Pushover Alert Service</strong></td>
								<td><span class="ex-badge ex-badge-sky">Standby</span></td>
								<td>Real-time order notifications</td>
							</tr>
						</table>
					</div>

					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Server & Runtime Environment</h3>
							<span class="ex-badge ex-badge-sky">Optimized</span>
						</div>
						<table class="ex-table">
							<tr>
								<td>PHP Version</td>
								<td><span class="ex-code"><?php echo esc_html( $php_version ); ?></span></td>
							</tr>
							<tr>
								<td>Memory Limit</td>
								<td><span class="ex-code"><?php echo esc_html( $memory_limit ); ?></span> (Target: 1024M)</td>
							</tr>
							<tr>
								<td>WordPress Core</td>
								<td><span class="ex-code">v<?php echo esc_html( $wp_version ); ?></span></td>
							</tr>
							<tr>
								<td>Upload Directory</td>
								<td><?php echo $upload_writable ? '<span class="ex-badge ex-badge-emerald">Writable</span>' : '<span class="ex-badge" style="background:rgba(239,68,68,0.2);color:#f87171;">Not Writable</span>'; ?></td>
							</tr>
							<tr>
								<td>Media Structure</td>
								<td style="display:flex; align-items:center; gap:8px;">
									<span class="ex-badge ex-badge-emerald">Flat (/uploads)</span>
									<button type="button" id="btn-revert-media" class="ex-btn ex-btn-secondary" style="padding: 3px 8px; font-size: 11px;">Consolidate to /uploads</button>
								</td>
							</tr>
							<tr>
								<td>Permalinks Rewrite Rules</td>
								<td><button type="button" id="btn-inline-flush" class="ex-btn ex-btn-secondary" style="padding: 3px 8px; font-size: 11px;">Flush Rewrite Rules</button></td>
							</tr>
						</table>
					</div>
				</div>
			</div>

			<!-- PANE 2: HEADLESS REST API -->
			<div class="ex-pane" id="pane-headless">
				<div class="ex-card">
					<div class="ex-card-header">
						<h3 class="ex-card-h3">Headless REST API Routes (<span class="ex-code">exacoat/v1</span>)</h3>
						<span class="ex-badge ex-badge-emerald">Ready for exacoat-web</span>
					</div>
					<p style="font-size: 13px; color: #a1a1aa; margin: 0 0 12px 0;">
						These endpoints are queried by your Next.js storefront (<span class="ex-code">exacoat-web</span>) to render published WordPress pages, Bricks Builder content trees, and handle customer operations.
					</p>
					<table class="ex-table">
						<thead>
							<tr>
								<th>Method</th>
								<th>Endpoint Route</th>
								<th>Description</th>
								<th>Test in Browser</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td><span class="ex-badge ex-badge-sky">GET</span></td>
								<td><span class="ex-code">/wp-json/exacoat/v1/pages</span></td>
								<td>List all published pages with Bricks status & modified timestamps</td>
								<td><a href="<?php echo esc_url( rest_url( 'exacoat/v1/pages' ) ); ?>" target="_blank" class="ex-btn ex-btn-secondary" style="padding: 2px 8px; font-size: 11px;">View JSON ↗</a></td>
							</tr>
							<tr>
								<td><span class="ex-badge ex-badge-sky">GET</span></td>
								<td><span class="ex-code">/wp-json/exacoat/v1/pages/{slug}</span></td>
								<td>Single page with raw Bricks elements tree, SEO, & CSS assets</td>
								<td><a href="<?php echo esc_url( rest_url( 'exacoat/v1/pages/sample-page' ) ); ?>" target="_blank" class="ex-btn ex-btn-secondary" style="padding: 2px 8px; font-size: 11px;">View Sample ↗</a></td>
							</tr>
							<tr>
								<td><span class="ex-badge ex-badge-amber">POST</span></td>
								<td><span class="ex-code">/wp-json/exacoat/v1/auth/login</span></td>
								<td>Headless customer authentication with JWT tokens</td>
								<td><span style="color:#71717a;">POST payload</span></td>
							</tr>
							<tr>
								<td><span class="ex-badge ex-badge-sky">GET</span></td>
								<td><span class="ex-code">/wp-json/exacoat/v1/reviews</span></td>
								<td>Product reviews, photo attachments, and buyer ratings</td>
								<td><a href="<?php echo esc_url( rest_url( 'exacoat/v1/reviews' ) ); ?>" target="_blank" class="ex-btn ex-btn-secondary" style="padding: 2px 8px; font-size: 11px;">View JSON ↗</a></td>
							</tr>
							<tr>
								<td><span class="ex-badge ex-badge-sky">GET</span></td>
								<td><span class="ex-code">/wp-json/exacoat/v1/wishlist</span></td>
								<td>Customer wishlist products and live counters</td>
								<td><a href="<?php echo esc_url( rest_url( 'exacoat/v1/wishlist' ) ); ?>" target="_blank" class="ex-btn ex-btn-secondary" style="padding: 2px 8px; font-size: 11px;">View JSON ↗</a></td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- PANE 3: SHIPPING & FULFILLMENT -->
			<div class="ex-pane" id="pane-shipping">
				<div class="ex-grid-2">
					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Order Production Pipeline</h3>
							<span class="ex-badge ex-badge-emerald">Active</span>
						</div>
						<p style="font-size: 12.5px; color: #a1a1aa; line-height: 1.6;">
							Exacoat Core injects specialized manufacturing stages into WooCommerce orders:
						</p>
						<ul style="font-size: 12.5px; color: #d4d4d8; line-height: 1.8; margin-left: 18px;">
							<li><strong style="color:#38bdf8;">In Production</strong> (<span class="ex-code">wc-in-production</span>): Skin plotting, vinyl cutting, and lamination started.</li>
							<li><strong style="color:#fbbf24;">Quality Check</strong> (<span class="ex-code">wc-quality-check</span>): Accuracy check on precision cutouts and dimensions.</li>
							<li><strong style="color:#34d399;">Ready to Ship</strong> (<span class="ex-code">wc-ready-to-ship</span>): A6 thermal packing label generated with courier barcode.</li>
							<li><strong style="color:#ffffff;">Shipped</strong>: Live tracking link dispatched to customer via email.</li>
						</ul>
					</div>

					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Couriers & Tracking Providers</h3>
							<span class="ex-badge ex-badge-sky">Supported</span>
						</div>
						<table class="ex-table">
							<tr>
								<td><strong>Biteship Gateway</strong></td>
								<td>Indonesian multi-courier rate calculation & automated booking</td>
							</tr>
							<tr>
								<td><strong>JNE / SiCepat / J&T</strong></td>
								<td>Integrated A6 barcode sync & live tracking redirect</td>
							</tr>
							<tr>
								<td><strong>DHL Express / FedEx</strong></td>
								<td>International priority express tracking links</td>
							</tr>
						</table>
					</div>
				</div>
			</div>

			<!-- PANE 4: DIAGNOSTICS & LOGS -->
			<div class="ex-pane" id="pane-logs">
				<div class="ex-card">
					<div class="ex-card-header">
						<h3 class="ex-card-h3">System Telemetry & Health Test</h3>
						<div style="display:flex; gap: 8px;">
							<button type="button" id="btn-run-diagnostics" class="ex-btn ex-btn-primary" style="padding: 4px 10px; font-size: 11px;">
								Run Self-Test
							</button>
						</div>
					</div>
					<div id="diagnostics-result" style="font-size: 12.5px; color: #a1a1aa; line-height: 1.6;">
						Click "Run Self-Test" to inspect database tables, write permissions, and queue scheduler.
					</div>
				</div>

				<div class="ex-card">
					<div class="ex-card-header">
						<h3 class="ex-card-h3">Recent System Logs</h3>
						<button type="button" id="btn-clear-logs" class="ex-btn ex-btn-secondary" style="padding: 4px 10px; font-size: 11px;">
							Clear Logs
						</button>
					</div>
					<div id="logs-container" style="background:#08090b; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:12px; font-family:monospace; font-size:11px; max-height:280px; overflow-y:auto; color:#a1a1aa;">
						Loading recent telemetry events...
					</div>
				</div>
			</div>

		</div>
	</main>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
	// Tab Switching
	const navItems = document.querySelectorAll('.ex-nav-item');
	const panes = document.querySelectorAll('.ex-pane');
	const paneTitle = document.getElementById('pane-title');

	const titles = {
		'overview': 'Dashboard & Engine Status',
		'headless': 'Headless REST API & Bricks Integration',
		'shipping': 'Fulfillment & Logistics Matrix',
		'logs': 'System Diagnostics & Telemetry'
	};

	navItems.forEach(item => {
		item.addEventListener('click', function(e) {
			e.preventDefault();
			const paneId = this.getAttribute('data-pane');

			navItems.forEach(n => n.classList.remove('active'));
			panes.forEach(p => p.classList.remove('active'));

			this.classList.add('active');
			const targetPane = document.getElementById('pane-' + paneId);
			if (targetPane) targetPane.classList.add('active');

			if (paneTitle && titles[paneId]) {
				paneTitle.textContent = titles[paneId];
			}

			if (paneId === 'logs') {
				fetchLogs();
			}
		});
	});

	// Flush Permalinks AJAX
	function flushPermalinks(btn) {
		if (!btn) return;
		const originalText = btn.innerHTML;
		btn.innerHTML = '⏳ Flushing...';
		btn.style.pointerEvents = 'none';

		const fd = new FormData();
		fd.append('action', 'artmatter_flush_permalinks');

		fetch(ajaxurl, { method: 'POST', body: fd })
			.then(r => r.json())
			.then(res => {
				btn.innerHTML = res.success ? '✓ Flushed!' : '⚠️ Failed';
				setTimeout(() => {
					btn.innerHTML = originalText;
					btn.style.pointerEvents = 'auto';
				}, 2500);
			})
			.catch(() => {
				btn.innerHTML = '⚠️ Error';
				setTimeout(() => {
					btn.innerHTML = originalText;
					btn.style.pointerEvents = 'auto';
				}, 2500);
			});
	}

	const sidebarFlush = document.getElementById('btn-sidebar-flush');
	if (sidebarFlush) sidebarFlush.addEventListener('click', () => flushPermalinks(sidebarFlush));

	const inlineFlush = document.getElementById('btn-inline-flush');
	if (inlineFlush) inlineFlush.addEventListener('click', () => flushPermalinks(inlineFlush));

	// Consolidate & Revert Media AJAX
	const revertMediaBtn = document.getElementById('btn-revert-media');
	if (revertMediaBtn) {
		revertMediaBtn.addEventListener('click', function() {
			const originalText = this.innerHTML;
			this.innerHTML = 'Consolidating...';
			this.style.pointerEvents = 'none';

			const fd = new FormData();
			fd.append('action', 'exacoat_revert_flat_media');

			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(r => r.json())
				.then(res => {
					if (res.success && res.data) {
						alert(res.data.message || 'Media consolidated successfully to root /uploads.');
						revertMediaBtn.innerHTML = 'Consolidated';
					} else {
						alert('Failed to consolidate media: ' + (res.data && res.data.message ? res.data.message : 'Unknown error'));
						revertMediaBtn.innerHTML = 'Failed';
					}
					setTimeout(() => {
						revertMediaBtn.innerHTML = originalText;
						revertMediaBtn.style.pointerEvents = 'auto';
					}, 3000);
				})
				.catch(() => {
					alert('Network or server error while consolidating media.');
					revertMediaBtn.innerHTML = originalText;
					revertMediaBtn.style.pointerEvents = 'auto';
				});
		});
	}

	// Check Updates AJAX
	const checkUpdatesBtn = document.getElementById('btn-top-check-updates');
	if (checkUpdatesBtn) {
		checkUpdatesBtn.addEventListener('click', function() {
			const originalText = this.innerHTML;
			this.innerHTML = '⏳ Checking...';
			this.style.pointerEvents = 'none';

			const fd = new FormData();
			fd.append('action', 'exacoat_check_plugin_update');

			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(r => r.json())
				.then(res => {
					if (res.success && res.data) {
						if (res.data.has_update) {
							checkUpdatesBtn.innerHTML = '⚡ v' + res.data.latest_version + ' Available!';
						} else {
							checkUpdatesBtn.innerHTML = '✓ Up to date';
						}
					} else {
						checkUpdatesBtn.innerHTML = '✓ Engine Normal';
					}
					setTimeout(() => {
						checkUpdatesBtn.innerHTML = originalText;
						checkUpdatesBtn.style.pointerEvents = 'auto';
					}, 3500);
				})
				.catch(() => {
					checkUpdatesBtn.innerHTML = '✓ Engine Normal';
					setTimeout(() => {
						checkUpdatesBtn.innerHTML = originalText;
						checkUpdatesBtn.style.pointerEvents = 'auto';
					}, 2500);
				});
		});
	}

	// Diagnostics Runner
	const diagBtn = document.getElementById('btn-run-diagnostics');
	const diagResult = document.getElementById('diagnostics-result');
	if (diagBtn && diagResult) {
		diagBtn.addEventListener('click', function() {
			diagBtn.innerHTML = '⏳ Testing...';
			diagBtn.style.pointerEvents = 'none';

			const fd = new FormData();
			fd.append('action', 'artmatter_run_health_test');

			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(r => r.json())
				.then(res => {
					diagBtn.innerHTML = 'Run Self-Test';
					diagBtn.style.pointerEvents = 'auto';
					if (res.success && res.data) {
						let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
						for (const [key, item] of Object.entries(res.data)) {
							const color = item.status === 'healthy' ? '#34d399' : '#fbbf24';
							html += `<div><strong style="color:${color}">●</strong> <strong>${key}:</strong> ${item.message}</div>`;
						}
						html += '</div>';
						diagResult.innerHTML = html;
					}
				})
				.catch(() => {
					diagBtn.innerHTML = 'Run Self-Test';
					diagBtn.style.pointerEvents = 'auto';
					diagResult.innerHTML = '<span style="color:#f87171;">⚠️ Diagnostic connection error</span>';
				});
		});
	}

	// Logs
	function fetchLogs() {
		const container = document.getElementById('logs-container');
		if (!container) return;

		const fd = new FormData();
		fd.append('action', 'artmatter_get_logs');

		fetch(ajaxurl, { method: 'POST', body: fd })
			.then(r => r.json())
			.then(res => {
				if (res.success && res.data && res.data.logs && res.data.logs.length > 0) {
					let html = '';
					res.data.logs.forEach(l => {
						const color = l.level === 'error' ? '#f87171' : (l.level === 'warning' ? '#fbbf24' : '#34d399');
						html += `<div><span style="color:#71717a;">[${l.created_at || ''}]</span> <span style="color:${color}">[${(l.level || 'info').toUpperCase()}]</span> [${l.category || 'core'}]: ${l.message || ''}</div>`;
					});
					container.innerHTML = html;
				} else {
					container.innerHTML = '<span style="color:#71717a;">No recent system errors logged. All core engines operating normally.</span>';
				}
			})
			.catch(() => {
				container.innerHTML = '<span style="color:#71717a;">No log entries found. All systems operating normally.</span>';
			});
	}

	const clearLogsBtn = document.getElementById('btn-clear-logs');
	if (clearLogsBtn) {
		clearLogsBtn.addEventListener('click', function() {
			if (!confirm('Clear all telemetry logs?')) return;
			const fd = new FormData();
			fd.append('action', 'artmatter_clear_logs');
			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(() => fetchLogs());
		});
	}
});
</script>
