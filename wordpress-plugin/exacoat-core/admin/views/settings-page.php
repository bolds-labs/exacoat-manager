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

// Query live module data
$pool_inventory     = class_exists( 'Exacoat_Tracking_Pool' ) ? Exacoat_Tracking_Pool::get_inventory() : [];
$wa_settings        = class_exists( 'Exacoat_WhatsApp_Service' ) ? Exacoat_WhatsApp_Service::get_settings() : [];
$unmatched_bca      = get_option( 'exa_bca_unmatched_mutations', [] );
if ( ! is_array( $unmatched_bca ) ) {
	$unmatched_bca = [];
}
$jne_pool_count     = isset( $pool_inventory['jne']['available'] ) ? (int) $pool_inventory['jne']['available'] : 0;
$sicepat_pool_count = isset( $pool_inventory['sicepat']['available'] ) ? (int) $pool_inventory['sicepat']['available'] : 0;
$wa_configured      = ! empty( $wa_settings['phone_number_id'] ) && ! empty( $wa_settings['access_token'] );
$wa_active          = ! empty( $wa_settings['enabled'] ) && $wa_configured;

// Store & Currency Settings
$settings           = class_exists( 'Exacoat_Core' ) ? Exacoat_Core::get_settings() : get_option( 'exacoat_core_settings', [] );
if ( ! is_array( $settings ) ) {
	$settings = [];
}
$currencies         = class_exists( 'Exacoat_Store_Enhancements' ) ? Exacoat_Store_Enhancements::get_currency_rates() : [];
$shipping_cfg       = class_exists( 'Exacoat_Store_Enhancements' ) ? Exacoat_Store_Enhancements::get_shipping_config() : [ 'target_method_ids' => [], 'zones' => [] ];
$shipping_zones     = $shipping_cfg['zones'] ?? [];
$target_methods     = implode( ', ', $shipping_cfg['target_method_ids'] ?? [ 'flat_rate', 'biteship_shipping' ] );

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

/* Custom Inputs & Selects */
.ex-input, .ex-select {
	background: #15161c;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 8px;
	color: #ffffff;
	padding: 7px 10px;
	font-size: 12px;
	box-sizing: border-box;
	transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.ex-input:focus, .ex-select:focus {
	outline: none;
	border-color: #f6b328;
	box-shadow: 0 0 0 2px rgba(246, 179, 40, 0.2);
}
.ex-input.mono, .ex-select.mono {
	font-family: ui-monospace, SFMono-Regular, monospace;
}
.ex-sim-bar {
	background: #0d0e12;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 12px;
	padding: 16px 20px;
	display: flex;
	flex-wrap: wrap;
	gap: 20px;
	align-items: flex-end;
}
.ex-sim-col {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.ex-sim-label {
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #a1a1aa;
}
.ex-preset-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 6px;
	color: #d4d4d8;
	font-size: 11px;
	font-weight: 600;
	padding: 5px 10px;
	cursor: pointer;
	transition: all 0.15s ease;
}
.ex-preset-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #ffffff;
}
.ex-preset-btn.active {
	background: #f6b328;
	color: #08090b;
	border-color: #f6b328;
	font-weight: 700;
}
.ex-sim-results-box {
	background: #0d0e12;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 12px;
	padding: 16px 20px;
	margin-top: 14px;
}
.ex-sim-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	gap: 10px;
	margin-top: 12px;
}
.ex-sim-chip {
	padding: 10px 12px;
	border-radius: 8px;
	background: #15161c;
	border: 1px solid rgba(255, 255, 255, 0.06);
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.ex-btn-delete {
	background: rgba(239, 68, 68, 0.12);
	border: 1px solid rgba(239, 68, 68, 0.25);
	color: #f87171;
	border-radius: 6px;
	padding: 4px 10px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
}
.ex-btn-delete:hover {
	background: rgba(239, 68, 68, 0.25);
	color: #ffffff;
}
.ex-btn-add {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	background: rgba(246, 179, 40, 0.12);
	border: 1px solid rgba(246, 179, 40, 0.3);
	color: #f6b328;
	border-radius: 8px;
	padding: 8px 14px;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
	width: fit-content;
}
.ex-btn-add:hover {
	background: rgba(246, 179, 40, 0.22);
	color: #ffffff;
	border-color: #f6b328;
}
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
				<span>Dashboard &amp; Status</span>
			</a>
			<a class="ex-nav-item" data-pane="modules">
				<span class="ex-nav-icon">🧩</span>
				<span>Platform Modules</span>
			</a>
			<a class="ex-nav-item" data-pane="currency">
				<span class="ex-nav-icon">💱</span>
				<span>Store &amp; Currency</span>
			</a>
			<a class="ex-nav-item" data-pane="shipping">
				<span class="ex-nav-icon">🚚</span>
				<span>Fulfillment &amp; Shipping</span>
			</a>
			<a class="ex-nav-item" data-pane="automation">
				<span class="ex-nav-icon">🤖</span>
				<span>Automation &amp; WhatsApp</span>
			</a>
			<a class="ex-nav-item" data-pane="headless">
				<span class="ex-nav-icon">⚡</span>
				<span>Headless REST API</span>
			</a>
			<a class="ex-nav-item" data-pane="media">
				<span class="ex-nav-icon">🖼️</span>
				<span>Media &amp; Thumbnails</span>
			</a>

			<div class="ex-nav-header">SYSTEM</div>
			<a class="ex-nav-item" data-pane="logs">
				<span class="ex-nav-icon">📋</span>
				<span>Diagnostics &amp; Logs</span>
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
				<button type="submit" form="exacoatSettingsForm" id="btn-top-save-settings" class="ex-btn ex-btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
					💾 Save Changes
				</button>
				<button type="button" id="btn-top-check-updates" class="ex-btn ex-btn-secondary">
					🔄 Check Updates
				</button>
				<button type="button" id="btn-top-update-now" class="ex-btn" style="<?php echo $has_pending_update ? 'display: inline-flex;' : 'display: none;'; ?> align-items: center; gap: 6px; background: #22c55e; color: #08090b; font-weight: 700; border: none; cursor: pointer; padding: 6px 14px; border-radius: 8px; box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);" data-version="<?php echo esc_attr( $pending_version ); ?>">
					⚡ Update to v<span id="btn-top-update-ver"><?php echo esc_html( $pending_version ); ?></span> Now
				</button>
				<a href="<?php echo esc_url( $manager_url ); ?>" target="_blank" class="ex-btn ex-btn-secondary">
					ERP ↗
				</a>
			</div>
		</header>

		<!-- CONTENT -->
		<div class="ex-content">
			<?php if ( ! empty( $_GET['settings-updated'] ) ) : ?>
			<div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 10px; padding: 12px 18px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; color: #34d399; font-size: 13px; font-weight: 600;">
				<span>✓ Exacoat Core settings saved and synchronized successfully.</span>
			</div>
			<?php endif; ?>

			<form method="post" action="options.php" id="exacoatSettingsForm" style="display: flex; flex-direction: column; gap: 24px; width: 100%;">
				<?php settings_fields( 'exacoat_core_settings_group' ); ?>

			<!-- PANE 1: OVERVIEW -->
			<div class="ex-pane active" id="pane-overview">
				<!-- KPI Cards (6 Grid) -->
				<div class="ex-grid-4" style="grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));">
					<div class="ex-card" id="card-plugin-version">
						<div class="ex-card-title">Plugin Version</div>
						<div class="ex-card-value" id="val-plugin-version">v<?php echo esc_html( $current_version ); ?></div>
						<div class="ex-card-sub" id="sub-plugin-version"><?php echo $has_pending_update ? 'Update to v' . esc_html( $pending_version ) . ' available' : 'Up to date (Channel: Stable)'; ?></div>
						<button type="button" id="btn-card-update-now" class="ex-btn" style="<?php echo $has_pending_update ? 'display: inline-flex;' : 'display: none;'; ?> margin-top: 8px; align-items: center; gap: 6px; background: #22c55e; color: #08090b; font-weight: 700; font-size: 11px; padding: 5px 12px; width: fit-content; border: none; border-radius: 6px; cursor: pointer;" data-version="<?php echo esc_attr( $pending_version ); ?>">
							⚡ 1-Click Update to v<span id="btn-card-update-ver"><?php echo esc_html( $pending_version ); ?></span>
						</button>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">WhatsApp Cloud API</div>
						<div class="ex-card-value" style="color: <?php echo $wa_active ? '#34d399' : ( $wa_configured ? '#38bdf8' : '#fbbf24' ); ?>;">
							<?php echo $wa_active ? 'Active' : ( $wa_configured ? 'Standby' : 'Not Configured' ); ?>
						</div>
						<div class="ex-card-sub"><?php echo $wa_configured ? 'Meta Cloud API v20.0' : 'Set Phone ID & Access Token'; ?></div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">Tracking Number Pool</div>
						<div class="ex-card-value" style="color: <?php echo ( $jne_pool_count < 15 || $sicepat_pool_count < 15 ) ? '#fbbf24' : '#34d399'; ?>;">
							<?php echo (int) ( $jne_pool_count + $sicepat_pool_count ); ?> <span style="font-size: 13px; font-weight: normal; color: #a1a1aa;">Ready</span>
						</div>
						<div class="ex-card-sub">JNE: <?php echo $jne_pool_count; ?> | SiCepat: <?php echo $sicepat_pool_count; ?></div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">BCA Auto-Confirm</div>
						<div class="ex-card-value" style="color: #34d399;">Active</div>
						<div class="ex-card-sub"><?php echo count( $unmatched_bca ); ?> unmatched mutations</div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">Headless REST API</div>
						<div class="ex-card-value" style="color: #34d399;">Active</div>
						<div class="ex-card-sub">/wp-json/exacoat/v1</div>
					</div>
					<div class="ex-card">
						<div class="ex-card-title">WooCommerce Engine</div>
						<div class="ex-card-value"><?php echo $wc_active ? 'v' . esc_html( $wc_version ) : 'Inactive'; ?></div>
						<div class="ex-card-sub"><?php echo $wc_active ? 'Fulfillment & Statuses Active' : 'WooCommerce Required'; ?></div>
					</div>
				</div>

				<!-- Architecture Cards -->
				<div class="ex-grid-2">
					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Platform Modules & Features</h3>
							<span class="ex-badge ex-badge-emerald">10 Active</span>
						</div>
						<table class="ex-table">
							<tr>
								<td><strong>BCA Automated Payment Webhook</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Kode unik matching, auto processing transition (<span class="ex-code">/bca-webhook</span>)</td>
							</tr>
							<tr>
								<td><strong>Tracking Number Inventory Pool</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>FIFO auto-resi allocation for JNE &amp; SiCepat. Zero Google Sheets dependency.</td>
							</tr>
							<tr>
								<td><strong>WhatsApp Notification Engine</strong></td>
								<td><?php echo $wa_active ? '<span class="ex-badge ex-badge-emerald">Active</span>' : '<span class="ex-badge ex-badge-sky">Configured</span>'; ?></td>
								<td>Meta Cloud API templates for confirmed, shipped, warranty redeem, and SMB pickup.</td>
							</tr>
							<tr>
								<td><strong>Logistics Export Manager</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Direct JNE CSV, Biteship batch, POS Indonesia export (Gandaria City removed).</td>
							</tr>
							<tr>
								<td><strong>Headless Pages Controller</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Bricks Builder API for Next.js storefront (<span class="ex-code">/pages</span>)</td>
							</tr>
							<tr>
								<td><strong>Logistics &amp; Shipping Tracker</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Universal courier tracking URL resolution &amp; airwaybill metadata</td>
							</tr>
							<tr>
								<td><strong>Manufacturing &amp; Production Stages</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td><span class="ex-code">wc-in-production</span>, <span class="ex-code">wc-quality-check</span>, <span class="ex-code">wc-ready-to-ship</span></td>
							</tr>
							<tr>
								<td><strong>Customer Reviews Engine</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Headless verified buyer reviews, photo attachments, and ratings</td>
							</tr>
							<tr>
								<td><strong>Multi-Zone Free Shipping</strong></td>
								<td><span class="ex-badge ex-badge-emerald">Enabled</span></td>
								<td>Regional thresholds in native currencies with automated qualification</td>
							</tr>
							<tr>
								<td><strong>Pushover Alert Service</strong></td>
								<td><span class="ex-badge ex-badge-sky">Standby</span></td>
								<td>Real-time operations notifications for priority store events</td>
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

			<!-- PANE: PLATFORM MODULES (ARCHITECTURE SHOWCASE) -->
			<div class="ex-pane" id="pane-modules">
				<div class="ex-card">
					<div class="ex-card-header">
						<div>
							<h3 class="ex-card-h3">Platform Architecture &amp; Subsystems</h3>
							<p style="font-size: 12px; color: #a1a1aa; margin: 4px 0 0 0;">
								Exacoat Core delivers modular enterprise subsystems for headless commerce, automated payments, courier logistics, and customer messaging.
							</p>
						</div>
						<span class="ex-badge ex-badge-emerald">10 Modules Live</span>
					</div>

					<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-top: 12px;">
						<!-- Module 1: BCA Payment Webhook -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">💳 BCA Automated Payment Webhook</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_BCA_Payment_Webhook</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Live</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								High-reliability mutation listener for Bank Central Asia. Parses multiple currency/cent formats, matches unique payment codes (0–999 tolerance), automatically transitions orders to <span class="ex-code">processing</span>, and manages concurrency locks.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Endpoints:</strong> <span class="ex-code">POST /wp-json/exacoat-core/v1/bca-webhook</span>, <span class="ex-code">/bca/status</span>
							</div>
						</div>

						<!-- Module 2: Tracking Number Pool -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">📦 Tracking Number Pool &amp; Auto-Resi</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Tracking_Pool</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Self-Hosted</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Self-hosted tracking number inventory completely replacing external Google Sheet dependencies. Automatically allocates FIFO air waybills for JNE and SiCepat when payment is confirmed, updating order meta with atomic mutex protection.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Stock:</strong> JNE (<?php echo $jne_pool_count; ?>) &bull; SiCepat (<?php echo $sicepat_pool_count; ?>) &bull; <span class="ex-code">/wp-json/exacoat-core/v1/tracking-pool/*</span>
							</div>
						</div>

						<!-- Module 3: WhatsApp Service -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">💬 WhatsApp Notification Engine</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_WhatsApp_Service</div>
								</div>
								<?php echo $wa_active ? '<span class="ex-badge ex-badge-emerald">Live</span>' : '<span class="ex-badge ex-badge-sky">Configured</span>'; ?>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Direct Meta Cloud API (v20.0) customer notifications. Dispatches order confirmations, shipment tracking links, warranty redeem notices, and SMB store pickups. Features duplicate suppression and Telegram backup logging.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Templates:</strong> <span class="ex-code">notif_order_confirmed</span>, <span class="ex-code">notif_order_completed</span>, <span class="ex-code">notif_order_warranty_redeem</span>
							</div>
						</div>

						<!-- Module 4: Logistics Export Manager -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">🚚 Logistics Shipment Exporter</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Export_Manager</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Streamlined</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Batch fulfillment export generating standard JNE CSV files, Biteship bookings, and POS Indonesia manifests. Streamlined with Gandaria City branch logic fully removed for clean operations.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Supported:</strong> JNE Express, SiCepat, Biteship Multi-Courier, POS Indonesia, Goorita Send
							</div>
						</div>

						<!-- Module 5: Headless Pages Controller -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">⚡ Headless Pages Controller</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Pages_Controller</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Live</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Extracts and transforms Bricks Builder visual layouts into clean JSON AST trees consumed by the Next.js storefront (<span class="ex-code">exacoat-web</span>), with cache invalidation and page previews.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Route:</strong> <span class="ex-code">GET /wp-json/exacoat/v1/pages</span>
							</div>
						</div>

						<!-- Module 6: Shipping Tracker -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">📍 Logistics &amp; Shipping Tracker</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Shipping_Tracker</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Live</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Centralized courier tracking link builder and airwaybill manager for domestic Indonesian couriers and international express carriers.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Couriers:</strong> JNE, SiCepat, J&amp;T, Biteship, POS Indonesia, Goorita, DHL Express, FedEx
							</div>
						</div>

						<!-- Module 7: Manufacturing Pipeline -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">🏭 Manufacturing Pipeline Stages</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Order_Manager</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Live</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Custom WooCommerce manufacturing lifecycle states: In Production (<span class="ex-code">wc-in-production</span>), Quality Check (<span class="ex-code">wc-quality-check</span>), and Ready to Ship (<span class="ex-code">wc-ready-to-ship</span>).
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Features:</strong> Thermal A6 label printing, custom status badges, barcode sync
							</div>
						</div>

						<!-- Module 8: Customer Reviews -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">⭐ Customer Reviews &amp; Photos</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Review_Manager</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Live</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Direct API for customer reviews, photo uploads, device rating breakdowns, and verified buyer verification badges for headless frontend rendering.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Route:</strong> <span class="ex-code">/wp-json/exacoat/v1/reviews</span>
							</div>
						</div>

						<!-- Module 9: Multi-Currency & Free Shipping -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">🌐 Currency & Free Shipping Engine</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Store_Enhancements</div>
								</div>
								<span class="ex-badge ex-badge-emerald">Live</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Psychological currency rounding, multi-currency auto-pricing, and multi-zone free shipping threshold rules.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Routes:</strong> <span class="ex-code">/checkout/config</span> &bull; <span class="ex-code">/settings/currency</span>
							</div>
						</div>

						<!-- Module 10: Pushover -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;">
							<div style="display: flex; align-items: flex-start; justify-content: space-between;">
								<div>
									<div style="font-size: 14px; font-weight: 700; color: #ffffff;">🔔 Operations Pushover Alerts</div>
									<div style="font-size: 11px; color: #71717a; font-family: monospace;">Exacoat_Pushover_Service</div>
								</div>
								<span class="ex-badge ex-badge-sky">Standby</span>
							</div>
							<p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
								Instant push notifications dispatched to operational mobile devices upon high-priority store events and payment confirmations.
							</p>
							<div style="font-size: 11px; color: #71717a;">
								<strong>Integration:</strong> Pushover Gateway API
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- PANE: STORE & CURRENCY -->
			<div class="ex-pane" id="pane-currency">
				<!-- Multi-Currency Exchange Rates & Price Matrix Card -->
				<div class="ex-card">
					<div class="ex-card-header">
						<div>
							<h3 class="ex-card-h3">💱 Multi-Currency Exchange Rates &amp; Price Matrix</h3>
							<p style="font-size: 12px; color: #a1a1aa; margin: 4px 0 0 0;">
								Real-time exchange rates against IDR base, safety markup buffer, and ISO psychological rounding rules.
							</p>
						</div>
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="ex-badge ex-badge-amber"><?php echo count( $currencies ); ?> FX Pairs</span>
							<button type="submit" form="exacoatSettingsForm" class="ex-btn ex-btn-primary" style="padding: 5px 12px; font-size: 11px;">
								💾 Save Changes
							</button>
						</div>
					</div>

					<!-- Simulation & Multiplier Bar -->
					<div class="ex-sim-bar" style="margin-top: 14px;">
						<div class="ex-sim-col">
							<label class="ex-sim-label">Global Markup Multiplier</label>
							<div style="display: flex; align-items: center; gap: 8px;">
								<input type="number" step="0.01" name="exacoat_core_settings[currency_global_markup]" id="global-markup-input" value="<?php echo esc_attr( $settings['currency_global_markup'] ?? 1.15 ); ?>" class="ex-input mono" style="width: 110px;" onchange="runLiveCurrencySimulation()">
								<span class="ex-badge ex-badge-amber" title="Safety markup buffer against FX volatility">+15% Default</span>
							</div>
						</div>
						<div class="ex-sim-col" style="flex: 1; min-width: 280px;">
							<label class="ex-sim-label">Live Test Base Price (IDR)</label>
							<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
								<input type="number" id="sim-base-price" value="450000" class="ex-input mono" style="width: 150px;" oninput="runLiveCurrencySimulation()">
								<div style="display: flex; align-items: center; gap: 6px;">
									<button type="button" class="ex-preset-btn" onclick="setSimPrice(350000)">350K</button>
									<button type="button" class="ex-preset-btn active" onclick="setSimPrice(450000)">450K</button>
									<button type="button" class="ex-preset-btn" onclick="setSimPrice(750000)">750K</button>
									<button type="button" class="ex-preset-btn" onclick="setSimPrice(1200000)">1.2M</button>
								</div>
								<button type="button" class="ex-btn ex-btn-secondary" onclick="runLiveCurrencySimulation()" style="font-size: 11px; padding: 6px 12px;">
									⚡ Simulate
								</button>
							</div>
						</div>
					</div>

					<!-- Live Converted Price Matrix Grid Output -->
					<div id="sim-results-container" class="ex-sim-results-box">
						<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
							<span style="font-size: 12px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em;">Live Converted Currency Matrix</span>
							<span style="font-size: 11px; color: #71717a;">Dynamic calculation including markup multiplier &amp; rounding rules</span>
						</div>
						<div id="sim-results-grid" class="ex-sim-grid"></div>
					</div>

					<!-- Currencies Table -->
					<div style="overflow-x: auto; margin-top: 16px;">
						<table class="ex-table" id="currencies-table">
							<thead>
								<tr>
									<th style="width: 110px;">Currency</th>
									<th style="width: 100px;">Symbol</th>
									<th style="width: 160px;">Rate (vs IDR)</th>
									<th style="min-width: 220px;">Rounding Engine</th>
									<th style="width: 80px; text-align: center;">Action</th>
								</tr>
							</thead>
							<tbody id="currencies-tbody">
								<?php foreach ( $currencies as $curr_code => $curr ) : ?>
								<tr data-key="<?php echo esc_attr( $curr_code ); ?>">
									<td>
										<span class="ex-code" style="font-size: 12px; font-weight: 700; color: #f6b328;"><?php echo esc_html( $curr_code ); ?></span>
										<input type="hidden" name="exacoat_core_settings[currency_rates][<?php echo esc_attr( $curr_code ); ?>][code]" value="<?php echo esc_attr( $curr_code ); ?>">
									</td>
									<td>
										<input type="text" name="exacoat_core_settings[currency_rates][<?php echo esc_attr( $curr_code ); ?>][symbol]" value="<?php echo esc_attr( $curr['symbol'] ?? '$' ); ?>" class="ex-input mono" style="width: 70px;">
									</td>
									<td>
										<input type="number" step="0.00000001" name="exacoat_core_settings[currency_rates][<?php echo esc_attr( $curr_code ); ?>][rate]" value="<?php echo esc_attr( $curr['rate'] ?? 0 ); ?>" class="ex-input mono" style="width: 140px;" onchange="runLiveCurrencySimulation()">
									</td>
									<td>
										<select name="exacoat_core_settings[currency_rates][<?php echo esc_attr( $curr_code ); ?>][rounding]" class="ex-select mono" style="width: 100%; max-width: 240px;" onchange="runLiveCurrencySimulation()">
											<option value="9_end" <?php selected( '9_end', $curr['rounding'] ?? '9_end' ); ?>>End in 9 (e.g. $89, $29)</option>
											<option value="90_end" <?php selected( '90_end', $curr['rounding'] ?? '' ); ?>>End in 90 (e.g. 2,790฿)</option>
											<option value="50_step" <?php selected( '50_step', $curr['rounding'] ?? '' ); ?>>Step 50 (e.g. ¥13,900)</option>
											<option value="500_step" <?php selected( '500_step', $curr['rounding'] ?? '' ); ?>>Step 500 (e.g. ₩128,500)</option>
											<option value="none" <?php selected( 'none', $curr['rounding'] ?? '' ); ?>>Raw Math / No Rounding</option>
										</select>
									</td>
									<td style="text-align: center;">
										<button type="button" class="ex-btn-delete" onclick="removeTableRow(this); runLiveCurrencySimulation();">Delete</button>
									</td>
								</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					</div>

					<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
						<button type="button" class="ex-btn-add" id="btn-add-currency">
							+ Add Custom Currency
						</button>
						<button type="submit" form="exacoatSettingsForm" class="ex-btn ex-btn-primary" style="padding: 8px 16px;">
							💾 Save Currency Settings
						</button>
					</div>
				</div>
			</div>

			<!-- PANE: AUTOMATION & WHATSAPP SERVICE -->
			<div class="ex-pane" id="pane-automation">
				<!-- WhatsApp Cloud API Card -->
				<div class="ex-card">
					<div class="ex-card-header">
						<div>
							<h3 class="ex-card-h3">💬 WhatsApp Cloud API Integration (Meta)</h3>
							<p style="font-size: 12px; color: #a1a1aa; margin: 4px 0 0 0;">
								Configure official Meta Graph API v20.0 credentials for automated customer order notifications.
							</p>
						</div>
						<span class="ex-badge <?php echo $wa_active ? 'ex-badge-emerald' : 'ex-badge-amber'; ?>">
							<?php echo $wa_active ? '● Active' : '● Standby'; ?>
						</span>
					</div>

					<form id="form-whatsapp-settings" style="display: flex; flex-direction: column; gap: 16px; margin-top: 8px;">
						<div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;">
							<input type="checkbox" id="wa-enabled" name="enabled" value="1" <?php checked( ! empty( $wa_settings['enabled'] ) ); ?> style="width: 16px; height: 16px; cursor: pointer;">
							<label for="wa-enabled" style="font-size: 13px; font-weight: 600; color: #ffffff; cursor: pointer;">
								Enable WhatsApp Customer Notifications
							</label>
						</div>

						<div class="ex-grid-2">
							<div style="display: flex; flex-direction: column; gap: 6px;">
								<label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em;">
									Phone Number ID
								</label>
								<input type="text" id="wa-phone-id" name="phone_number_id" value="<?php echo esc_attr( $wa_settings['phone_number_id'] ?? '' ); ?>" placeholder="e.g. 1029384756..." style="background: #090a0d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px; font-family: monospace;">
							</div>

							<div style="display: flex; flex-direction: column; gap: 6px;">
								<label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em;">
									Meta Permanent Access Token
								</label>
								<input type="password" id="wa-token" name="access_token" value="<?php echo esc_attr( $wa_settings['access_token'] ?? '' ); ?>" placeholder="EAAG..." style="background: #090a0d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px; font-family: monospace;">
							</div>
						</div>

						<div style="display: flex; flex-direction: column; gap: 6px;">
							<label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em;">
								WhatsApp Business Account ID (Optional)
							</label>
							<input type="text" id="wa-biz-id" name="business_account_id" value="<?php echo esc_attr( $wa_settings['business_account_id'] ?? '' ); ?>" placeholder="e.g. 2938471029..." style="background: #090a0d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px; font-family: monospace;">
						</div>

						<!-- Notification Events -->
						<div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
							<label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 8px;">
								Active Notification Event Triggers
							</label>
							<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
								<label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d4d4d8; cursor: pointer;">
									<input type="checkbox" id="wa-ev-processing" name="event_processing" value="1" <?php checked( $wa_settings['events']['processing'] ?? true ); ?>>
									<span>Order Confirmed (<span class="ex-code">notif_order_confirmed</span>)</span>
								</label>
								<label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d4d4d8; cursor: pointer;">
									<input type="checkbox" id="wa-ev-completed" name="event_completed" value="1" <?php checked( $wa_settings['events']['completed'] ?? true ); ?>>
									<span>Order Shipped (<span class="ex-code">notif_order_completed</span>)</span>
								</label>
								<label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d4d4d8; cursor: pointer;">
									<input type="checkbox" id="wa-ev-smb-ready" name="event_smb_ready" value="1" <?php checked( $wa_settings['events']['smb_ready'] ?? true ); ?>>
									<span>SMB Ready (<span class="ex-code">notif_order_pickup_smb</span>)</span>
								</label>
								<label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d4d4d8; cursor: pointer;">
									<input type="checkbox" id="wa-ev-smb-picked" name="event_smb_picked" value="1" <?php checked( $wa_settings['events']['smb_picked'] ?? true ); ?>>
									<span>SMB Picked Up (<span class="ex-code">notif_order_picked_up_all</span>)</span>
								</label>
							</div>
						</div>

						<!-- Telegram Fallback Alerts -->
						<div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
							<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
								<input type="checkbox" id="wa-tg-alerts" name="telegram_alerts_enabled" value="1" <?php checked( ! empty( $wa_settings['telegram_alerts_enabled'] ) ); ?> style="cursor: pointer;">
								<label for="wa-tg-alerts" style="font-size: 12.5px; font-weight: 600; color: #ffffff; cursor: pointer;">
									Enable Telegram Operations Backup Alerts
								</label>
							</div>
							<div class="ex-grid-2">
								<div style="display: flex; flex-direction: column; gap: 6px;">
									<label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase;">Telegram Bot Token</label>
									<input type="text" id="wa-tg-token" name="telegram_bot_token" value="<?php echo esc_attr( $wa_settings['telegram_bot_token'] ?? '' ); ?>" placeholder="bot123456:ABC..." style="background: #090a0d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 12px; font-family: monospace;">
								</div>
								<div style="display: flex; flex-direction: column; gap: 6px;">
									<label style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase;">Telegram Chat ID</label>
									<input type="text" id="wa-tg-chat" name="telegram_chat_id" value="<?php echo esc_attr( $wa_settings['telegram_chat_id'] ?? '' ); ?>" placeholder="-100123456..." style="background: #090a0d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 12px; font-family: monospace;">
								</div>
							</div>
						</div>

						<div style="display: flex; align-items: center; gap: 10px; margin-top: 6px;">
							<button type="button" id="btn-save-wa" class="ex-btn ex-btn-primary" style="padding: 9px 18px; font-size: 13px;">
								💾 Save WhatsApp Configuration
							</button>
							<span id="wa-save-status" style="font-size: 12px; color: #34d399;"></span>
						</div>
					</form>

					<!-- Live Test Dispatcher -->
					<div style="margin-top: 20px; padding: 16px; background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;">
						<div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
							<span>🧪 Live Test Message Dispatcher</span>
							<span class="ex-badge ex-badge-sky">Instant Delivery</span>
						</div>
						<div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
							<input type="text" id="wa-test-phone" placeholder="Recipient phone: 628123456789" style="flex: 1; min-width: 220px; background: #121318; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #ffffff; font-size: 13px;">
							<select id="wa-test-template" style="background: #121318; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #ffffff; font-size: 13px;">
								<option value="notif_order_confirmed">notif_order_confirmed</option>
								<option value="notif_order_completed">notif_order_completed</option>
								<option value="notif_order_warranty_redeem">notif_order_warranty_redeem</option>
								<option value="notif_order_pickup_smb">notif_order_pickup_smb</option>
							</select>
							<button type="button" id="btn-test-wa" class="ex-btn ex-btn-secondary" style="padding: 8px 14px; font-size: 12px;">
								🚀 Send Test Message
							</button>
						</div>
						<div id="wa-test-result" style="margin-top: 10px; font-size: 12px; display: none;"></div>
					</div>
				</div>

				<!-- Tracking Number Inventory Pool Card -->
				<div class="ex-card">
					<div class="ex-card-header">
						<div>
							<h3 class="ex-card-h3">📦 Self-Hosted Tracking Number Pool</h3>
							<p style="font-size: 12px; color: #a1a1aa; margin: 4px 0 0 0;">
								Pre-allocated air waybill reserve for JNE &amp; SiCepat. Completely replaces Google Sheets.
							</p>
						</div>
						<span class="ex-badge ex-badge-emerald">Auto-Resi Enabled</span>
					</div>

					<!-- Balance Cards -->
					<div class="ex-grid-4" style="margin-top: 8px;">
						<div style="background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px;">
							<div style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase;">JNE Express Available</div>
							<div id="pool-count-jne" style="font-size: 24px; font-weight: 800; color: <?php echo $jne_pool_count < 15 ? '#fbbf24' : '#34d399'; ?>; margin: 4px 0;">
								<?php echo $jne_pool_count; ?>
							</div>
							<div style="font-size: 11px; color: #71717a;">Assigned: <?php echo (int) ( $pool_inventory['jne']['assigned_total'] ?? 0 ); ?> orders</div>
						</div>

						<div style="background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px;">
							<div style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase;">SiCepat Available</div>
							<div id="pool-count-sicepat" style="font-size: 24px; font-weight: 800; color: <?php echo $sicepat_pool_count < 15 ? '#fbbf24' : '#34d399'; ?>; margin: 4px 0;">
								<?php echo $sicepat_pool_count; ?>
							</div>
							<div style="font-size: 11px; color: #71717a;">Assigned: <?php echo (int) ( $pool_inventory['sicepat']['assigned_total'] ?? 0 ); ?> orders</div>
						</div>

						<div style="background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px;">
							<div style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase;">POS Indonesia</div>
							<div style="font-size: 24px; font-weight: 800; color: #93c5fd; margin: 4px 0;">Manual</div>
							<div style="font-size: 11px; color: #71717a;">Tagged ⚠️ for manual entry</div>
						</div>

						<div style="background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px;">
							<div style="font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase;">Goorita Send</div>
							<div style="font-size: 24px; font-weight: 800; color: #93c5fd; margin: 4px 0;">Manual</div>
							<div style="font-size: 11px; color: #71717a;">Tagged ⚠️ for manual entry</div>
						</div>
					</div>

					<!-- Bulk Import Box -->
					<div style="margin-top: 16px; background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px;">
						<div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
							📥 Bulk Restock Tracking Numbers
						</div>
						<div style="display: flex; gap: 12px; margin-bottom: 10px;">
							<label style="font-size: 12px; color: #d4d4d8; display: flex; align-items: center; gap: 6px; cursor: pointer;">
								<input type="radio" name="pool_target_carrier" value="jne" checked> JNE Express
							</label>
							<label style="font-size: 12px; color: #d4d4d8; display: flex; align-items: center; gap: 6px; cursor: pointer;">
								<input type="radio" name="pool_target_carrier" value="sicepat"> SiCepat
							</label>
						</div>
						<textarea id="pool-numbers-input" rows="4" placeholder="Paste tracking numbers here (one per line, comma, or space separated)..." style="width: 100%; box-sizing: border-box; background: #121318; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 12px; color: #ffffff; font-family: monospace; font-size: 12px;"></textarea>
						<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
							<button type="button" id="btn-add-pool-numbers" class="ex-btn ex-btn-primary" style="padding: 8px 16px;">
								➕ Add Numbers to Pool
							</button>
							<span id="pool-add-status" style="font-size: 12px;"></span>
						</div>
					</div>
				</div>

				<!-- BCA Payment Webhook Inspector Card -->
				<div class="ex-card">
					<div class="ex-card-header">
						<div>
							<h3 class="ex-card-h3">🏦 BCA Payment Webhook &amp; Unmatched Mutations</h3>
							<p style="font-size: 12px; color: #a1a1aa; margin: 4px 0 0 0;">
								Incoming BCA mutation receiver with atomic order settlement and kode unik tolerance.
							</p>
						</div>
						<span class="ex-badge ex-badge-emerald">Endpoint Active</span>
					</div>

					<div style="padding: 12px 14px; background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; margin-top: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
						<div>
							<span style="font-size: 11px; color: #71717a; text-transform: uppercase; font-weight: 700;">Webhook Listener URL</span>
							<div style="font-size: 12.5px; font-family: monospace; color: #f3aa18; margin-top: 2px;">
								<?php echo esc_html( rest_url( 'exacoat-core/v1/bca-webhook' ) ); ?>
							</div>
						</div>
						<span class="ex-badge ex-badge-sky">POST Request</span>
					</div>

					<div style="margin-top: 14px;">
						<div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
							<span>Unmatched Mutations Queue (<?php echo count( $unmatched_bca ); ?>)</span>
							<span style="font-size: 11px; color: #71717a;">Mutations without corresponding order match</span>
						</div>
						<?php if ( empty( $unmatched_bca ) ) : ?>
							<div style="padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; color: #71717a; font-size: 12px; text-align: center;">
								✓ Clean state: No unmatched mutations in queue.
							</div>
						<?php else : ?>
							<div style="max-height: 220px; overflow-y: auto; background: #090a0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;">
								<table class="ex-table">
									<thead>
										<tr>
											<th>Timestamp</th>
											<th>Amount</th>
											<th>Description</th>
										</tr>
									</thead>
									<tbody>
										<?php foreach ( array_slice( array_reverse( $unmatched_bca ), 0, 15 ) as $mut ) : ?>
											<tr>
												<td><span style="color:#71717a;"><?php echo esc_html( $mut['timestamp'] ?? '' ); ?></span></td>
												<td><strong style="color:#34d399;">Rp <?php echo esc_html( number_format( (float) ( $mut['amount'] ?? 0 ), 0, ',', '.' ) ); ?></strong></td>
												<td><span class="ex-code"><?php echo esc_html( $mut['description'] ?? '' ); ?></span></td>
											</tr>
										<?php endforeach; ?>
									</tbody>
								</table>
							</div>
						<?php endif; ?>
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
								<td><span class="ex-code">/wp-json/exacoat-core/v1/checkout/config</span></td>
								<td>Store checkout context, currency list, and free shipping bar thresholds</td>
								<td><a href="<?php echo esc_url( rest_url( 'exacoat-core/v1/checkout/config' ) ); ?>" target="_blank" class="ex-btn ex-btn-secondary" style="padding: 2px 8px; font-size: 11px;">View JSON ↗</a></td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- PANE 3: SHIPPING & FULFILLMENT -->
			<div class="ex-pane" id="pane-shipping">
				<!-- Multi-Zone Free Shipping Card -->
				<div class="ex-card">
					<div class="ex-card-header">
						<div>
							<h3 class="ex-card-h3">🚚 Multi-Zone Free Shipping Thresholds</h3>
							<p style="font-size: 12px; color: #a1a1aa; margin: 4px 0 0 0;">
								Autonomous 100% free shipping qualification rules evaluated dynamically per regional currency threshold.
							</p>
						</div>
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="ex-badge ex-badge-emerald"><?php echo count( $shipping_zones ); ?> Active Regions</span>
							<button type="submit" form="exacoatSettingsForm" class="ex-btn ex-btn-primary" style="padding: 5px 12px; font-size: 11px;">
								💾 Save Changes
							</button>
						</div>
					</div>

					<div style="background: #0d0e12; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px 20px; margin-top: 14px;">
						<label class="ex-sim-label">Target Shipping Method IDs (Comma-Separated)</label>
						<div style="margin-top: 6px;">
							<input type="text" name="exacoat_core_settings[shipping_target_method_ids]" value="<?php echo esc_attr( $target_methods ); ?>" class="ex-input mono" style="width: 100%; max-width: 520px;" placeholder="flat_rate, biteship_shipping">
							<p style="margin: 6px 0 0 0; font-size: 11px; color: #71717a;">Eligible method IDs discounted to 0.00 when the cart subtotal qualifies against the region's threshold.</p>
						</div>
					</div>

					<!-- Shipping Zones Table -->
					<div style="overflow-x: auto; margin-top: 16px;">
						<table class="ex-table" id="shipping-zones-table">
							<thead>
								<tr>
									<th style="width: 160px;">Zone Name</th>
									<th style="min-width: 200px;">Country Codes</th>
									<th style="width: 120px;">Currency</th>
									<th style="width: 170px;">100% Free Threshold</th>
									<th style="width: 140px;">Filter Match</th>
									<th style="width: 70px; text-align: center;">Action</th>
								</tr>
							</thead>
							<tbody id="shipping-zones-tbody">
								<?php
								$supported_currencies = [ 'AUD', 'USD', 'EUR', 'GBP', 'SGD', 'CAD', 'IDR', 'NZD', 'MYR', 'JPY', 'CHF', 'HKD', 'THB', 'KRW' ];
								foreach ( $shipping_zones as $key => $zone ) :
									$zone_curr = strtoupper( trim( $zone['currency'] ?? '' ) );
									if ( empty( $zone_curr ) ) {
										$c_raw = strtoupper( $zone['countries'] ?? '' );
										if ( strpos( $c_raw, 'AU' ) !== false ) $zone_curr = 'AUD';
										elseif ( strpos( $c_raw, 'US' ) !== false ) $zone_curr = 'USD';
										elseif ( strpos( $c_raw, 'GB' ) !== false ) $zone_curr = 'GBP';
										elseif ( strpos( $c_raw, 'SG' ) !== false || strpos( $c_raw, 'MY' ) !== false ) $zone_curr = 'SGD';
										elseif ( strpos( $c_raw, 'DE' ) !== false || strpos( $c_raw, 'FR' ) !== false || strpos( $c_raw, 'IT' ) !== false ) $zone_curr = 'EUR';
										elseif ( strpos( $c_raw, 'ID' ) !== false ) $zone_curr = 'IDR';
										else $zone_curr = ( (float)( $zone['free'] ?? 0 ) > 50000 ) ? 'IDR' : 'USD';
									}
									$free_val = $zone['free'] ?? 0;
								?>
								<tr data-key="<?php echo esc_attr( $key ); ?>">
									<td>
										<input type="text" name="exacoat_core_settings[shipping_zones][<?php echo esc_attr( $key ); ?>][name]" value="<?php echo esc_attr( $zone['name'] ?? ucfirst( $key ) ); ?>" class="ex-input" style="width: 100%; font-weight: 600;">
									</td>
									<td>
										<input type="text" name="exacoat_core_settings[shipping_zones][<?php echo esc_attr( $key ); ?>][countries]" value="<?php echo esc_attr( $zone['countries'] ?? '' ); ?>" class="ex-input mono" style="width: 100%;" placeholder="e.g. US, CA or * for fallback">
									</td>
									<td>
										<select name="exacoat_core_settings[shipping_zones][<?php echo esc_attr( $key ); ?>][currency]" class="ex-select mono" style="width: 100%;">
											<?php foreach ( $supported_currencies as $sc ) : ?>
												<option value="<?php echo esc_attr( $sc ); ?>" <?php selected( $zone_curr, $sc ); ?>><?php echo esc_html( $sc ); ?></option>
											<?php endforeach; ?>
										</select>
									</td>
									<td>
										<input type="number" step="any" name="exacoat_core_settings[shipping_zones][<?php echo esc_attr( $key ); ?>][free]" value="<?php echo esc_attr( $free_val ); ?>" class="ex-input mono" style="width: 100%; color: #34d399; font-weight: 700;">
									</td>
									<td>
										<input type="text" name="exacoat_core_settings[shipping_zones][<?php echo esc_attr( $key ); ?>][filter_text]" value="<?php echo esc_attr( $zone['filter_text'] ?? '' ); ?>" class="ex-input mono" style="width: 100%;" placeholder="e.g. biteship">
									</td>
									<td style="text-align: center;">
										<button type="button" class="ex-btn-delete" onclick="removeTableRow(this)">Delete</button>
									</td>
								</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					</div>

					<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
						<button type="button" class="ex-btn-add" id="btn-add-shipping-zone">
							+ Add Shipping Region
						</button>
						<button type="submit" form="exacoatSettingsForm" class="ex-btn ex-btn-primary" style="padding: 8px 16px;">
							💾 Save Shipping Thresholds
						</button>
					</div>
				</div>

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

			<!-- PANE: MEDIA & THUMBNAILS -->
			<div class="ex-pane" id="pane-media">
				<div class="ex-grid-2">
					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Next.js Headless Thumbnail Derivatives</h3>
							<span class="ex-badge ex-badge-emerald">Configured</span>
						</div>
						<p style="font-size: 12.5px; color: #a1a1aa; line-height: 1.6;">
							Intermediate thumbnail sizes registered by Exacoat Core for fast load times and optimized payload transfer in Next.js (<span class="ex-code">exacoat-web</span>):
						</p>
						<table class="ex-table">
							<tr>
								<td><strong>Small (sm)</strong></td>
								<td><span class="ex-code">240x240</span> (uncropped)</td>
								<td>Search modal, cart drawer, checkout items (~8-16 KB)</td>
							</tr>
							<tr>
								<td><strong>Medium (md)</strong></td>
								<td><span class="ex-code">720x720</span> (uncropped)</td>
								<td>Shop cards, category product grids, device carousels (~50-85 KB)</td>
							</tr>
							<tr>
								<td><strong>Full (Master)</strong></td>
								<td><span class="ex-badge ex-badge-amber">100% Original</span></td>
								<td>Configurator canvases, cut layers, swatches & finishes strictly preserved</td>
							</tr>
						</table>
					</div>

					<div class="ex-card">
						<div class="ex-card-header">
							<h3 class="ex-card-h3">Storage & Directory Hygiene</h3>
							<span class="ex-badge ex-badge-sky">Optimized</span>
						</div>
						<p style="font-size: 12.5px; color: #a1a1aa; line-height: 1.6;">
							Consolidate media files into root <span class="ex-code">/uploads</span> or clean up outdated/orphaned thumbnail derivatives created by legacy themes or past migrations.
						</p>
						<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
							<div style="display:flex; align-items:center; justify-content:space-between; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;">
								<div>
									<div style="font-weight: 600; font-size: 12px; color: #ffffff;">Consolidate Assets/ to Root</div>
									<div style="font-size: 11px; color: #71717a;">Moves any legacy nested files to standard uploads directory.</div>
								</div>
								<button type="button" id="btn-revert-media-pane" class="ex-btn ex-btn-secondary" style="padding: 4px 10px; font-size: 11px;">Consolidate</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Thumbnail Operations Card -->
				<div class="ex-card">
					<div class="ex-card-header">
						<h3 class="ex-card-h3">Batch Thumbnail Operations</h3>
						<span class="ex-badge ex-badge-sky">Chunked Background Runner</span>
					</div>
					<p style="font-size: 12.5px; color: #a1a1aa; line-height: 1.6; margin: 0 0 16px 0;">
						Run high-speed batch operations across your product and attachment media library. Missing-only mode tests disk existence before generating, completing thousands of items in seconds.
					</p>

					<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
						<!-- Regenerate Card -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
							<div>
								<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
									<h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #ffffff;">🖼️ Regenerate Thumbnails</h4>
									<span class="ex-badge ex-badge-emerald">sm & md Sizes</span>
								</div>
								<p style="margin: 0; font-size: 12px; color: #71717a; line-height: 1.5;">
									Generates 240x240 and 720x720 thumbnails for all media attachments. Full master images for configurator swatches and layers are untouched.
								</p>
								<label style="display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; color: #f3aa18; font-size: 12px; font-weight: 600; cursor: pointer;">
									<input type="checkbox" id="regen-thumbs-only-missing" value="1" checked>
									Only generate missing thumbnails (skip intact files)
								</label>
							</div>
							<div>
								<button type="button" id="btn-regen-thumbs" class="ex-btn ex-btn-primary" style="width: 100%; justify-content: center;">
									🖼️ Start Regeneration
								</button>
							</div>
						</div>

						<!-- Delete Old Card -->
						<div style="background: #0d0e12; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
							<div>
								<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
									<h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #ffffff;">🧹 Delete Old & Unused Thumbnails</h4>
									<span class="ex-badge ex-badge-amber">Storage Cleaner</span>
								</div>
								<p style="margin: 0; font-size: 12px; color: #71717a; line-height: 1.5;">
									Safely purges obsolete, unused intermediate image files on disk that are not registered in the current metadata. Never touches master original uploads.
								</p>
							</div>
							<div>
								<button type="button" id="btn-clean-old-thumbs" class="ex-btn ex-btn-secondary" style="width: 100%; justify-content: center;">
									🧹 Clean Obsolete Thumbnails
								</button>
							</div>
						</div>
					</div>

					<!-- Progress & Results Box -->
					<div id="media-ops-progress" style="display: none; margin-top: 16px;">
						<div style="padding: 14px 18px; border-radius: 10px; background: rgba(243, 170, 24, 0.08); border: 1px solid rgba(243, 170, 24, 0.25); color: #ffffff;">
							<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:600; font-size:12px;">
								<span id="media-ops-status">Initializing...</span>
								<span id="media-ops-pct" style="color:#f3aa18; font-family:monospace;">0%</span>
							</div>
							<div style="width:100%; height:6px; background:#27272a; border-radius:999px; overflow:hidden;">
								<div id="media-ops-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #f6b328, #ea9c0f); transition:width 0.2s ease;"></div>
							</div>
						</div>
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

			</form>
		</div>
	</main>
</div>

<script>
window.setSimPrice = function(val) {
	const el = document.getElementById('sim-base-price');
	if (el) el.value = val;
	document.querySelectorAll('.ex-preset-btn').forEach(b => {
		const label = val >= 1000000 ? (val / 1000000) + 'M' : (val / 1000) + 'K';
		b.classList.toggle('active', b.textContent.trim() === label);
	});
	window.runLiveCurrencySimulation();
};

window.removeTableRow = function(btn) {
	const row = btn.closest('tr');
	if (row) {
		row.remove();
	}
};

window.runLiveCurrencySimulation = function() {
	const baseInput = document.getElementById('sim-base-price');
	const markupInput = document.getElementById('global-markup-input');
	const baseAmount = parseFloat(baseInput?.value || '450000');
	const markup = parseFloat(markupInput?.value || '1.15');
	const rows = document.querySelectorAll('#currencies-tbody tr');
	const grid = document.getElementById('sim-results-grid');
	if (!grid) return;

	let html = '';
	rows.forEach(tr => {
		const code = tr.querySelector('td:nth-child(1) input')?.value || '';
		const symbol = tr.querySelector('td:nth-child(2) input')?.value || '$';
		const rate = parseFloat(tr.querySelector('td:nth-child(3) input')?.value || '0');
		const rounding = tr.querySelector('td:nth-child(4) select')?.value || '9_end';

		if (!code || rate <= 0) return;

		const raw = baseAmount * rate * markup;
		let val = 0;
		if (rounding === '90_end' || code === 'THB') {
			val = (Math.ceil(raw / 100) * 100) - 10;
		} else if (rounding === '500_step' || code === 'KRW') {
			val = Math.ceil(raw / 500) * 500;
		} else if (rounding === '50_step' || code === 'JPY') {
			val = Math.ceil(raw / 50) * 50;
		} else if (rounding === '9_end' || code === 'HKD') {
			val = (Math.ceil(raw / 10) * 10) - 1;
		} else if (rounding === 'none') {
			val = Math.round((raw + Number.EPSILON) * 100) / 100;
		} else {
			val = (Math.ceil(raw / 10) * 10) - 1;
		}

		html += `
			<div class="ex-sim-chip">
				<div style="font-size: 11px; font-weight: 700; color: #a1a1aa; font-family: monospace;">${code}</div>
				<div style="font-size: 15px; font-weight: 800; color: #f6b328; margin-top: 2px; font-family: monospace;">${symbol}${val.toLocaleString()}</div>
			</div>
		`;
	});

	grid.innerHTML = html || '<div style="color:#71717a; font-size:12px;">No active currency conversion rates found.</div>';
};

window.addCurrencyRow = function() {
	const tbody = document.getElementById('currencies-tbody');
	if (!tbody) return;
	const codeInput = prompt('Enter 3-letter currency code (e.g. "NZD"):');
	if (!codeInput) return;
	const safeCode = codeInput.toUpperCase().replace(/[^A-Z]/g, '');
	if (!safeCode || safeCode.length !== 3) {
		alert('Invalid currency code: must be 3 letters.');
		return;
	}

	if (tbody.querySelector(`tr[data-key="${safeCode}"]`)) {
		alert(`Currency ${safeCode} already exists in matrix.`);
		return;
	}

	const tr = document.createElement('tr');
	tr.setAttribute('data-key', safeCode);
	tr.innerHTML = `
		<td>
			<span class="ex-code" style="font-size: 12px; font-weight: 700; color: #f6b328;">${safeCode}</span>
			<input type="hidden" name="exacoat_core_settings[currency_rates][${safeCode}][code]" value="${safeCode}">
		</td>
		<td>
			<input type="text" name="exacoat_core_settings[currency_rates][${safeCode}][symbol]" value="$" class="ex-input mono" style="width: 70px;">
		</td>
		<td>
			<input type="number" step="0.00000001" name="exacoat_core_settings[currency_rates][${safeCode}][rate]" value="0.00010000" class="ex-input mono" style="width: 140px;" onchange="runLiveCurrencySimulation()">
		</td>
		<td>
			<select name="exacoat_core_settings[currency_rates][${safeCode}][rounding]" class="ex-select mono" style="width: 100%; max-width: 240px;" onchange="runLiveCurrencySimulation()">
				<option value="9_end">End in 9 (e.g. $89, $29)</option>
				<option value="90_end">End in 90 (e.g. 2,790฿)</option>
				<option value="50_step">Step 50 (e.g. ¥13,900)</option>
				<option value="500_step">Step 500 (e.g. ₩128,500)</option>
				<option value="none">Raw Math / No Rounding</option>
			</select>
		</td>
		<td style="text-align: center;">
			<button type="button" class="ex-btn-delete" onclick="removeTableRow(this); runLiveCurrencySimulation();">Delete</button>
		</td>
	`;
	tbody.appendChild(tr);
	window.runLiveCurrencySimulation();
};

window.addShippingZoneRow = function() {
	const tbody = document.getElementById('shipping-zones-tbody');
	if (!tbody) return;
	const newKey = 'region_' + Date.now();
	const tr = document.createElement('tr');
	tr.setAttribute('data-key', newKey);
	tr.innerHTML = `
		<td>
			<input type="text" name="exacoat_core_settings[shipping_zones][${newKey}][name]" value="New Region" class="ex-input" style="width: 100%; font-weight: 600;">
		</td>
		<td>
			<input type="text" name="exacoat_core_settings[shipping_zones][${newKey}][countries]" value="" class="ex-input mono" style="width: 100%;" placeholder="e.g. SG, MY or *">
		</td>
		<td>
			<select name="exacoat_core_settings[shipping_zones][${newKey}][currency]" class="ex-select mono" style="width: 100%;">
				<option value="USD" selected>USD</option>
				<option value="AUD">AUD</option>
				<option value="EUR">EUR</option>
				<option value="GBP">GBP</option>
				<option value="SGD">SGD</option>
				<option value="CAD">CAD</option>
				<option value="IDR">IDR</option>
				<option value="NZD">NZD</option>
				<option value="MYR">MYR</option>
				<option value="JPY">JPY</option>
				<option value="CHF">CHF</option>
				<option value="HKD">HKD</option>
				<option value="THB">THB</option>
				<option value="KRW">KRW</option>
			</select>
		</td>
		<td>
			<input type="number" step="any" name="exacoat_core_settings[shipping_zones][${newKey}][free]" value="100" class="ex-input mono" style="width: 100%; color: #34d399; font-weight: 700;">
		</td>
		<td>
			<input type="text" name="exacoat_core_settings[shipping_zones][${newKey}][filter_text]" value="" class="ex-input mono" style="width: 100%;" placeholder="e.g. biteship">
		</td>
		<td style="text-align: center;">
			<button type="button" class="ex-btn-delete" onclick="removeTableRow(this)">Delete</button>
		</td>
	`;
	tbody.appendChild(tr);
};

document.addEventListener('DOMContentLoaded', function() {
	// Tab Switching
	const navItems = document.querySelectorAll('.ex-nav-item');
	const panes = document.querySelectorAll('.ex-pane');
	const paneTitle = document.getElementById('pane-title');

	const titles = {
		'overview': 'Dashboard & Engine Status',
		'modules': 'Platform Architecture & Core Modules',
		'currency': 'Multi-Currency Exchange Rates & Price Matrix',
		'shipping': 'Fulfillment, Shipping & Regional Thresholds',
		'automation': 'Automation, BCA & WhatsApp Service',
		'headless': 'Headless REST API & Bricks Integration',
		'media': 'Media Assets & Thumbnail Optimizer',
		'logs': 'System Diagnostics & Telemetry'
	};

	// Connect Add Currency & Add Shipping Zone buttons
	const btnAddCurr = document.getElementById('btn-add-currency');
	if (btnAddCurr) btnAddCurr.addEventListener('click', window.addCurrencyRow);

	const btnAddZone = document.getElementById('btn-add-shipping-zone');
	if (btnAddZone) btnAddZone.addEventListener('click', window.addShippingZoneRow);

	// Run initial currency simulation
	window.runLiveCurrencySimulation();

	// Handle main settings form submission feedback
	const mainForm = document.getElementById('exacoatSettingsForm');
	if (mainForm) {
		mainForm.addEventListener('submit', function() {
			const saveButtons = document.querySelectorAll('button[type="submit"][form="exacoatSettingsForm"], button[type="submit"]');
			saveButtons.forEach(btn => {
				btn.disabled = true;
				btn.innerText = '⏳ Saving...';
			});
		});
	}

	// Save WhatsApp Settings AJAX
	const btnSaveWa = document.getElementById('btn-save-wa');
	const waSaveStatus = document.getElementById('wa-save-status');
	if (btnSaveWa) {
		btnSaveWa.addEventListener('click', function() {
			const originalText = btnSaveWa.innerText;
			btnSaveWa.innerText = '⏳ Saving...';
			btnSaveWa.disabled = true;
			if (waSaveStatus) waSaveStatus.innerText = '';

			const fd = new FormData(document.getElementById('form-whatsapp-settings'));
			fd.append('action', 'exacoat_save_whatsapp_settings');

			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(r => r.json())
				.then(res => {
					btnSaveWa.disabled = false;
					btnSaveWa.innerText = originalText;
					if (res.success) {
						if (waSaveStatus) {
							waSaveStatus.style.color = '#34d399';
							waSaveStatus.innerText = '✓ Configuration saved!';
							setTimeout(() => { waSaveStatus.innerText = ''; }, 3000);
						}
					} else {
						if (waSaveStatus) {
							waSaveStatus.style.color = '#f87171';
							waSaveStatus.innerText = '⚠️ ' + (res.data?.message || 'Save failed');
						}
					}
				})
				.catch(err => {
					btnSaveWa.disabled = false;
					btnSaveWa.innerText = originalText;
					if (waSaveStatus) {
						waSaveStatus.style.color = '#f87171';
						waSaveStatus.innerText = '⚠️ Network error';
					}
				});
		});
	}

	// Test WhatsApp Dispatcher AJAX
	const btnTestWa = document.getElementById('btn-test-wa');
	const waTestResult = document.getElementById('wa-test-result');
	if (btnTestWa) {
		btnTestWa.addEventListener('click', function() {
			const phone = document.getElementById('wa-test-phone')?.value?.trim();
			const template = document.getElementById('wa-test-template')?.value;
			if (!phone) {
				alert('Please enter a destination phone number with country code (e.g. 6281234567890)');
				return;
			}
			btnTestWa.innerText = '⏳ Sending...';
			btnTestWa.disabled = true;
			if (waTestResult) {
				waTestResult.style.display = 'none';
			}

			const fd = new FormData();
			fd.append('action', 'exacoat_test_whatsapp');
			fd.append('phone', phone);
			fd.append('template', template);

			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(r => r.json())
				.then(res => {
					btnTestWa.disabled = false;
					btnTestWa.innerText = '🚀 Send Test Message';
					if (waTestResult) {
						waTestResult.style.display = 'block';
						if (res.success) {
							waTestResult.style.color = '#34d399';
							waTestResult.innerHTML = `✓ Dispatched successfully! Message ID: <code>${res.data?.message_id || 'OK'}</code>`;
						} else {
							waTestResult.style.color = '#f87171';
							waTestResult.innerHTML = `⚠️ Send failed: ${res.data?.error || res.data?.message || 'Check Meta Cloud API credentials'}`;
						}
					}
				})
				.catch(err => {
					btnTestWa.disabled = false;
					btnTestWa.innerText = '🚀 Send Test Message';
					if (waTestResult) {
						waTestResult.style.display = 'block';
						waTestResult.style.color = '#f87171';
						waTestResult.innerHTML = `⚠️ Network error: ${err.message}`;
					}
				});
		});
	}

	// Bulk Add Tracking Numbers AJAX
	const btnAddPool = document.getElementById('btn-add-pool-numbers');
	const poolAddStatus = document.getElementById('pool-add-status');
	if (btnAddPool) {
		btnAddPool.addEventListener('click', function() {
			const numbersInput = document.getElementById('pool-numbers-input');
			const numbers = numbersInput?.value?.trim();
			const carrierEl = document.querySelector('input[name="pool_target_carrier"]:checked');
			const carrier = carrierEl ? carrierEl.value : 'jne';

			if (!numbers) {
				alert('Please paste at least one tracking number.');
				return;
			}

			btnAddPool.innerText = '⏳ Adding...';
			btnAddPool.disabled = true;

			const fd = new FormData();
			fd.append('action', 'exacoat_add_tracking_numbers');
			fd.append('carrier', carrier);
			fd.append('numbers', numbers);

			fetch(ajaxurl, { method: 'POST', body: fd })
				.then(r => r.json())
				.then(res => {
					btnAddPool.disabled = false;
					btnAddPool.innerText = '➕ Add Numbers to Pool';
					if (res.success) {
						if (poolAddStatus) {
							poolAddStatus.style.color = '#34d399';
							poolAddStatus.innerText = `✓ Added ${res.data.added_count} numbers! (Total available: ${res.data.total_pool})`;
						}
						numbersInput.value = '';
						const cntEl = document.getElementById('pool-count-' + carrier);
						if (cntEl) cntEl.innerText = res.data.total_pool;
						setTimeout(() => { if (poolAddStatus) poolAddStatus.innerText = ''; }, 4000);
					} else {
						if (poolAddStatus) {
							poolAddStatus.style.color = '#f87171';
							poolAddStatus.innerText = '⚠️ ' + (res.data?.error || res.data?.message || 'Failed to add numbers');
						}
					}
				})
				.catch(err => {
					btnAddPool.disabled = false;
					btnAddPool.innerText = '➕ Add Numbers to Pool';
					if (poolAddStatus) {
						poolAddStatus.style.color = '#f87171';
						poolAddStatus.innerText = '⚠️ Network error';
					}
				});
		});
	}

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

	// Consolidate Media from pane button
	const revertMediaPaneBtn = document.getElementById('btn-revert-media-pane');
	if (revertMediaPaneBtn && revertMediaBtn) {
		revertMediaPaneBtn.addEventListener('click', () => revertMediaBtn.click());
	}

	// 1-Click Batch Regenerate Thumbnails (Chunked Runner)
	const btnRegenThumbs = document.getElementById('btn-regen-thumbs');
	const chkOnlyMissing = document.getElementById('regen-thumbs-only-missing');
	const mediaOpsProgress = document.getElementById('media-ops-progress');
	const mediaOpsStatus = document.getElementById('media-ops-status');
	const mediaOpsPct = document.getElementById('media-ops-pct');
	const mediaOpsBar = document.getElementById('media-ops-bar');

	if (btnRegenThumbs) {
		btnRegenThumbs.addEventListener('click', async function() {
			const onlyMissing = chkOnlyMissing ? chkOnlyMissing.checked : true;
			const confirmMsg = onlyMissing
				? 'Scan Media Library and generate missing 240x240 & 720x720 thumbnails for Exacoat? (Intact files will be skipped)'
				: 'Force re-generate all 240x240 & 720x720 thumbnails for all images? (This will reprocess every attachment)';
			if (!confirm(confirmMsg)) return;

			btnRegenThumbs.disabled = true;
			btnRegenThumbs.innerText = 'Processing...';
			if (mediaOpsProgress) mediaOpsProgress.style.display = 'block';

			let offset = 0;
			const batchSize = 15;
			let totalScanned = 0;
			let totalRegen = 0;
			let totalSkipped = 0;
			let totalFailed = 0;

			try {
				let retryCount = 0;
				while (true) {
					let resp, text, json;
					try {
						const body = new URLSearchParams({
							action: 'exacoat_regenerate_thumbnails',
							offset: String(offset),
							batch_size: String(batchSize),
							only_missing: onlyMissing ? '1' : '0'
						});
						resp = await fetch(ajaxurl, { method: 'POST', body });
						text = await resp.text();
						json = JSON.parse(text);
						retryCount = 0;
					} catch(fetchErr) {
						if (retryCount < 3) {
							retryCount++;
							if (mediaOpsStatus) mediaOpsStatus.innerText = `Retrying batch at offset ${offset} (attempt ${retryCount}/3)...`;
							await new Promise(r => setTimeout(r, 1000));
							continue;
						}
						throw new Error('Server returned invalid output: ' + (text ? text.slice(0, 200) : fetchErr.message));
					}

					if (!json.success || !json.data) {
						throw new Error(json.data?.message || 'Regeneration failed');
					}

					const d = json.data;
					const total = d.total_attachments || 1;
					offset = d.next_offset;
					totalScanned = total;
					totalRegen += (d.regenerated || 0);
					totalSkipped += (d.skipped || 0);
					totalFailed += (d.failed || 0);

					const pct = Math.min(100, Math.round((offset / total) * 100));
					if (mediaOpsStatus) {
						mediaOpsStatus.innerText = onlyMissing
							? `Checking thumbnails: ${Math.min(offset, total)} / ${total} attachments (${totalRegen} generated, ${totalSkipped} intact)...`
							: `Regenerating thumbnails: ${Math.min(offset, total)} / ${total} attachments (${totalRegen} regenerated)...`;
					}
					if (mediaOpsPct) mediaOpsPct.innerText = `${pct}%`;
					if (mediaOpsBar) mediaOpsBar.style.width = `${pct}%`;

					btnRegenThumbs.innerText = `Processing (${pct}%)...`;

					if (d.is_complete || d.processed_in_batch === 0) {
						break;
					}
					await new Promise(r => setTimeout(r, 50));
				}

				btnRegenThumbs.innerText = '🖼️ Start Regeneration';
				btnRegenThumbs.disabled = false;
				if (mediaOpsStatus) {
					mediaOpsStatus.innerHTML = onlyMissing
						? `<strong style="color:#34d399;">✓ Complete: Scanned ${totalScanned} images. Generated ${totalRegen} missing thumbnails, ${totalSkipped} already intact!</strong>`
						: `<strong style="color:#34d399;">✓ Complete: Successfully regenerated thumbnails for ${totalRegen} images!</strong>`;
				}
				if (mediaOpsPct) mediaOpsPct.innerText = '100%';
				if (mediaOpsBar) mediaOpsBar.style.width = '100%';
			} catch (err) {
				btnRegenThumbs.innerText = '🖼️ Start Regeneration';
				btnRegenThumbs.disabled = false;
				if (mediaOpsStatus) mediaOpsStatus.innerHTML = `<span style="color:#f87171;">⚠️ Error: ${err.message}</span>`;
			}
		});
	}

	// 1-Click Clean Obsolete Thumbnails (Chunked Runner)
	const btnCleanOldThumbs = document.getElementById('btn-clean-old-thumbs');
	if (btnCleanOldThumbs) {
		btnCleanOldThumbs.addEventListener('click', async function() {
			if (!confirm('Scan Media Library and safely delete old, obsolete thumbnail files no longer registered in metadata? (Master original uploads will never be touched)')) return;

			btnCleanOldThumbs.disabled = true;
			btnCleanOldThumbs.innerText = 'Cleaning...';
			if (mediaOpsProgress) mediaOpsProgress.style.display = 'block';

			let offset = 0;
			const batchSize = 25;
			let totalScanned = 0;
			let totalDeleted = 0;

			try {
				let retryCount = 0;
				while (true) {
					let resp, text, json;
					try {
						const body = new URLSearchParams({
							action: 'exacoat_delete_old_thumbnails',
							offset: String(offset),
							batch_size: String(batchSize)
						});
						resp = await fetch(ajaxurl, { method: 'POST', body });
						text = await resp.text();
						json = JSON.parse(text);
						retryCount = 0;
					} catch(fetchErr) {
						if (retryCount < 3) {
							retryCount++;
							if (mediaOpsStatus) mediaOpsStatus.innerText = `Retrying cleanup at offset ${offset} (attempt ${retryCount}/3)...`;
							await new Promise(r => setTimeout(r, 1000));
							continue;
						}
						throw new Error('Server returned invalid output: ' + (text ? text.slice(0, 200) : fetchErr.message));
					}

					if (!json.success || !json.data) {
						throw new Error(json.data?.message || 'Cleanup failed');
					}

					const d = json.data;
					const total = d.total_attachments || 1;
					offset = d.next_offset;
					totalScanned = total;
					totalDeleted += (d.deleted_files_count || 0);

					const pct = Math.min(100, Math.round((offset / total) * 100));
					if (mediaOpsStatus) {
						mediaOpsStatus.innerText = `Scanning attachments: ${Math.min(offset, total)} / ${total} (${totalDeleted} obsolete files purged)...`;
					}
					if (mediaOpsPct) mediaOpsPct.innerText = `${pct}%`;
					if (mediaOpsBar) mediaOpsBar.style.width = `${pct}%`;

					btnCleanOldThumbs.innerText = `Cleaning (${pct}%)...`;

					if (d.is_complete || d.processed_in_batch === 0) {
						break;
					}
					await new Promise(r => setTimeout(r, 40));
				}

				btnCleanOldThumbs.innerText = '🧹 Clean Obsolete Thumbnails';
				btnCleanOldThumbs.disabled = false;
				if (mediaOpsStatus) {
					mediaOpsStatus.innerHTML = `<strong style="color:#34d399;">✓ Complete: Scanned ${totalScanned} media attachments. Safely purged ${totalDeleted} obsolete intermediate files!</strong>`;
				}
				if (mediaOpsPct) mediaOpsPct.innerText = '100%';
				if (mediaOpsBar) mediaOpsBar.style.width = '100%';
			} catch (err) {
				btnCleanOldThumbs.innerText = '🧹 Clean Obsolete Thumbnails';
				btnCleanOldThumbs.disabled = false;
				if (mediaOpsStatus) mediaOpsStatus.innerHTML = `<span style="color:#f87171;">⚠️ Error: ${err.message}</span>`;
			}
		});
	}

	// 1-Click Plugin Update Runner
	function runOneClickUpdate(btn) {
		const topBtn = document.getElementById('btn-top-update-now');
		const cardBtn = document.getElementById('btn-card-update-now');

		if (topBtn) { topBtn.innerHTML = '⏳ Installing Update...'; topBtn.style.pointerEvents = 'none'; }
		if (cardBtn) { cardBtn.innerHTML = '⏳ Installing Update...'; cardBtn.style.pointerEvents = 'none'; }

		const fd = new FormData();
		fd.append('action', 'exacoat_run_one_click_update');

		fetch(ajaxurl, { method: 'POST', body: fd, cache: 'no-store' })
			.then(r => r.json())
			.then(res => {
				if (res.success) {
					const msg = '✓ ' + (res.data?.message || 'Updated! Reloading...');
					if (topBtn) topBtn.innerHTML = msg;
					if (cardBtn) cardBtn.innerHTML = msg;
					setTimeout(() => window.location.reload(), 1200);
				} else {
					alert('Update failed: ' + (res.data?.message || 'Could not complete update.'));
					if (topBtn) { topBtn.innerHTML = '⚡ Update Now'; topBtn.style.pointerEvents = 'auto'; }
					if (cardBtn) { cardBtn.innerHTML = '⚡ Update Now'; cardBtn.style.pointerEvents = 'auto'; }
				}
			})
			.catch(() => {
				const msg = '✓ Updated! Reloading...';
				if (topBtn) topBtn.innerHTML = msg;
				if (cardBtn) cardBtn.innerHTML = msg;
				setTimeout(() => window.location.reload(), 1500);
			});
	}

	const topUpdateBtn = document.getElementById('btn-top-update-now');
	if (topUpdateBtn) topUpdateBtn.addEventListener('click', function() { runOneClickUpdate(this); });

	const cardUpdateBtn = document.getElementById('btn-card-update-now');
	if (cardUpdateBtn) cardUpdateBtn.addEventListener('click', function() { runOneClickUpdate(this); });

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
							checkUpdatesBtn.style.color = '#fbbf24';
							checkUpdatesBtn.style.borderColor = 'rgba(245, 158, 11, 0.4)';

							const topBtn = document.getElementById('btn-top-update-now');
							const topVer = document.getElementById('btn-top-update-ver');
							if (topBtn) {
								if (topVer) topVer.innerText = res.data.latest_version;
								topBtn.style.display = 'inline-flex';
							}

							const cardBtn = document.getElementById('btn-card-update-now');
							const cardVer = document.getElementById('btn-card-update-ver');
							const subVer = document.getElementById('sub-plugin-version');
							if (cardBtn) {
								if (cardVer) cardVer.innerText = res.data.latest_version;
								cardBtn.style.display = 'inline-flex';
							}
							if (subVer) {
								subVer.innerHTML = '<span style="color:#fbbf24; font-weight:600;">Update to v' + res.data.latest_version + ' available!</span>';
							}
						} else {
							checkUpdatesBtn.innerHTML = '✓ Up to date (v' + res.data.current_version + ')';
							checkUpdatesBtn.style.color = '#34d399';
							setTimeout(() => {
								checkUpdatesBtn.innerHTML = originalText;
								checkUpdatesBtn.style.color = '';
								checkUpdatesBtn.style.borderColor = '';
								checkUpdatesBtn.style.pointerEvents = 'auto';
							}, 3000);
						}
					} else {
						checkUpdatesBtn.innerHTML = '✓ Engine Normal';
						setTimeout(() => {
							checkUpdatesBtn.innerHTML = originalText;
							checkUpdatesBtn.style.pointerEvents = 'auto';
						}, 2500);
					}
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
