<?php
/**
 * Exacoat Affiliate Engine
 * Manages affiliate registration, attribution tracking, 20% commission ledger,
 * 7-day post-delivery grace period maturation, BCA and Mandiri payout processing,
 * and REST APIs for affiliate.exacoat.com and manager.exacoat.com.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Affiliate_Manager' ) ) {

class Exacoat_Affiliate_Manager {

	public const COOKIE_NAME        = 'exacoat_aff_ref';
	public const COOKIE_DAYS        = 30;
	public const COMMISSION_RATE    = 20.0;
	public const MIN_PAYOUT_IDR     = 250000;
	public const ROLE_AFFILIATE     = 'affiliate';
	public const GRACE_PERIOD_DAYS  = 7;

	public static function get_commission_rate(): float {
		return (float) get_option( 'exacoat_affiliate_commission_rate', self::COMMISSION_RATE );
	}

	public static function get_min_payout(): float {
		return (float) get_option( 'exacoat_affiliate_min_payout', self::MIN_PAYOUT_IDR );
	}

	public static function get_grace_period_days(): int {
		return (int) get_option( 'exacoat_affiliate_grace_period_days', self::GRACE_PERIOD_DAYS );
	}

	public static function get_cookie_days(): int {
		return (int) get_option( 'exacoat_affiliate_cookie_days', self::COOKIE_DAYS );
	}

	public static function is_auto_approve(): bool {
		return (bool) get_option( 'exacoat_affiliate_auto_approve', false );
	}

	public static function init(): void {
		self::register_role();
		self::ensure_tables();

		// Cookie tracking across storefront requests
		add_action( 'init', [ __CLASS__, 'capture_referral_cookie' ], 1 );

		// WooCommerce order integration hooks
		add_action( 'woocommerce_checkout_order_processed', [ __CLASS__, 'attach_referral_to_order' ], 10, 3 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'handle_order_processing' ], 20, 1 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'handle_order_delivery_confirmed' ], 20, 1 );
		add_action( 'woocommerce_order_status_delivered', [ __CLASS__, 'handle_order_delivery_confirmed' ], 20, 1 );
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'handle_order_status_transition' ], 20, 3 );
		add_action( 'woocommerce_order_status_refunded', [ __CLASS__, 'handle_order_clawback' ], 20, 1 );
		add_action( 'woocommerce_order_status_cancelled', [ __CLASS__, 'handle_order_clawback' ], 20, 1 );
		add_action( 'woocommerce_order_status_failed', [ __CLASS__, 'handle_order_clawback' ], 20, 1 );
		add_action( 'woocommerce_order_refunded', [ __CLASS__, 'handle_order_refund_event' ], 20, 2 );

		// 7-day grace period maturation workers
		add_action( 'exacoat_affiliate_mature_commission_action', [ __CLASS__, 'mature_single_commission' ], 10, 1 );
		add_action( 'exacoat_affiliate_hourly_check', [ __CLASS__, 'process_matured_commissions' ] );
		if ( ! wp_next_scheduled( 'exacoat_affiliate_hourly_check' ) ) {
			wp_schedule_event( time(), 'hourly', 'exacoat_affiliate_hourly_check' );
		}

		// Register REST endpoints
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
	}

	/**
	 * Register the custom WordPress user role for affiliates.
	 */
	public static function register_role(): void {
		if ( ! get_role( self::ROLE_AFFILIATE ) ) {
			add_role(
				self::ROLE_AFFILIATE,
				'Affiliate',
				[
					'read'         => true,
					'edit_posts'   => false,
					'delete_posts' => false,
				]
			);
		}
	}

	/**
	 * Database migration for affiliate records, commissions, and payout batches.
	 */
	public static function ensure_tables(): void {
		global $wpdb;
		$installed_ver = get_option( 'exacoat_affiliate_db_version', '0.0.0' );
		$target_ver    = '1.1.0';

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset_collate = $wpdb->get_charset_collate();

		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';
		$sql_affiliates   = "CREATE TABLE {$table_affiliates} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			slug varchar(60) NOT NULL,
			slug_locked tinyint(1) NOT NULL DEFAULT 0,
			status varchar(30) NOT NULL DEFAULT 'pending_approval',
			affiliate_type varchar(100) NOT NULL DEFAULT '',
			promotion_channel varchar(255) NOT NULL DEFAULT '',
			promotion_notes text NULL,
			bank_name varchar(20) NOT NULL DEFAULT '',
			bank_account_number varchar(50) NOT NULL DEFAULT '',
			bank_account_name varchar(100) NOT NULL DEFAULT '',
			lifetime_earnings decimal(14,2) NOT NULL DEFAULT 0.00,
			unpaid_balance decimal(14,2) NOT NULL DEFAULT 0.00,
			total_clicks bigint(20) unsigned NOT NULL DEFAULT 0,
			total_orders bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY user_id (user_id),
			UNIQUE KEY slug (slug),
			KEY status (status)
		) {$charset_collate};";
		dbDelta( $sql_affiliates );

		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';
		$sql_commissions   = "CREATE TABLE {$table_commissions} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			affiliate_id bigint(20) unsigned NOT NULL,
			order_id bigint(20) unsigned NOT NULL,
			order_number varchar(60) NOT NULL DEFAULT '',
			order_subtotal decimal(14,2) NOT NULL DEFAULT 0.00,
			commission_rate decimal(5,2) NOT NULL DEFAULT 20.00,
			commission_amount decimal(14,2) NOT NULL DEFAULT 0.00,
			status varchar(30) NOT NULL DEFAULT 'pending',
			delivered_at datetime NULL,
			matures_at datetime NULL,
			rejection_reason varchar(255) NULL,
			payout_id bigint(20) unsigned NULL,
			customer_email varchar(100) NOT NULL DEFAULT '',
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY affiliate_id (affiliate_id),
			KEY order_id (order_id),
			KEY status (status),
			KEY matures_at (matures_at),
			KEY payout_id (payout_id)
		) {$charset_collate};";
		dbDelta( $sql_commissions );

		// Ensure columns exist on legacy tables
		$col_check = $wpdb->get_results( "SHOW COLUMNS FROM {$table_commissions} LIKE 'matures_at'" );
		if ( empty( $col_check ) ) {
			$wpdb->query( "ALTER TABLE {$table_commissions} ADD COLUMN delivered_at datetime NULL AFTER status, ADD COLUMN matures_at datetime NULL AFTER delivered_at, ADD KEY matures_at (matures_at)" );
		}

		$table_payouts = $wpdb->prefix . 'exacoat_affiliate_payouts';
		$sql_payouts   = "CREATE TABLE {$table_payouts} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			affiliate_id bigint(20) unsigned NOT NULL,
			amount decimal(14,2) NOT NULL DEFAULT 0.00,
			bank_name varchar(20) NOT NULL DEFAULT '',
			bank_account_number varchar(50) NOT NULL DEFAULT '',
			bank_account_name varchar(100) NOT NULL DEFAULT '',
			status varchar(30) NOT NULL DEFAULT 'pending',
			transfer_reference varchar(100) NULL,
			admin_notes text NULL,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			paid_at datetime NULL,
			updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY affiliate_id (affiliate_id),
			KEY status (status)
		) {$charset_collate};";
		dbDelta( $sql_payouts );

		$table_clicks = $wpdb->prefix . 'exacoat_affiliate_clicks';
		$sql_clicks   = "CREATE TABLE {$table_clicks} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			affiliate_id bigint(20) unsigned NOT NULL,
			landing_url varchar(255) NOT NULL DEFAULT '',
			referrer_url varchar(255) NOT NULL DEFAULT '',
			ip_address varchar(45) NOT NULL DEFAULT '',
			user_agent varchar(255) NOT NULL DEFAULT '',
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY affiliate_id (affiliate_id),
			KEY created_at (created_at)
		) {$charset_collate};";
		dbDelta( $sql_clicks );

		update_option( 'exacoat_affiliate_db_version', '1.2.0' );
	}

	/**
	 * Cookie tracking: credit last affiliate for 30 days on .exacoat.com.
	 */
	public static function capture_referral_cookie(): void {
		if ( empty( $_GET['ref'] ) ) {
			return;
		}

		$raw_slug = sanitize_title( wp_unslash( $_GET['ref'] ) );
		if ( empty( $raw_slug ) ) {
			return;
		}

		$affiliate = self::get_affiliate_by_slug( $raw_slug );
		if ( ! $affiliate || 'active' !== $affiliate->status ) {
			return;
		}

		global $wpdb;
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table_affiliates} SET total_clicks = total_clicks + 1 WHERE id = %d",
				$affiliate->id
			)
		);

		// Record detailed click event for analytics
		$table_clicks = $wpdb->prefix . 'exacoat_affiliate_clicks';
		$req_uri      = ! empty( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '/';
		$referrer     = ! empty( $_SERVER['HTTP_REFERER'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '';
		$user_agent   = ! empty( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '';
		$remote_ip    = ! empty( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

		$wpdb->insert(
			$table_clicks,
			[
				'affiliate_id' => (int) $affiliate->id,
				'landing_url'  => $req_uri,
				'referrer_url' => $referrer,
				'ip_address'   => $remote_ip,
				'user_agent'   => $user_agent,
				'created_at'   => current_time( 'mysql' ),
			],
			[ '%d', '%s', '%s', '%s', '%s', '%s' ]
		);

		$cookie_domain = self::get_cookie_domain();
		$ttl           = time() + ( self::get_cookie_days() * DAY_IN_SECONDS );
		$is_secure     = is_ssl();

		setcookie(
			self::COOKIE_NAME,
			$raw_slug,
			[
				'expires'  => $ttl,
				'path'     => '/',
				'domain'   => $cookie_domain,
				'secure'   => $is_secure,
				'httponly' => true,
				'samesite' => 'Lax',
			]
		);
		$_COOKIE[ self::COOKIE_NAME ] = $raw_slug;
	}

	/**
	 * Attach referral slug to WooCommerce order meta during checkout.
	 */
	public static function attach_referral_to_order( int $order_id, array $posted_data, WC_Order $order ): void {
		$ref_slug = '';
		if ( ! empty( $_COOKIE[ self::COOKIE_NAME ] ) ) {
			$ref_slug = sanitize_title( wp_unslash( $_COOKIE[ self::COOKIE_NAME ] ) );
		}

		if ( empty( $ref_slug ) ) {
			return;
		}

		$affiliate = self::get_affiliate_by_slug( $ref_slug );
		if ( ! $affiliate || 'active' !== $affiliate->status ) {
			return;
		}

		$order->update_meta_data( '_exacoat_affiliate_slug', $ref_slug );
		$order->update_meta_data( '_exacoat_affiliate_id', (int) $affiliate->id );
		$order->save();
	}

	/**
	 * Evaluate order for commission creation when it reaches processing status.
	 */
	public static function handle_order_processing( $order_id ): void {
		self::record_order_commission( (int) $order_id, 'pending' );
	}

	/**
	 * Intercept status transition to completed, delivered, or smb-picked.
	 */
	public static function handle_order_status_transition( $order_id, string $old_status, string $new_status ): void {
		$clean = strtolower( str_replace( 'wc-', '', $new_status ) );
		if ( in_array( $clean, [ 'completed', 'delivered', 'smb-picked' ], true ) ) {
			self::handle_order_delivery_confirmed( $order_id );
		}
	}

	/**
	 * Order delivery confirmed: start 7-day grace period countdown before commission matures to unpaid.
	 */
	public static function handle_order_delivery_confirmed( $order_id ): void {
		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';

		// Ensure commission record exists
		self::record_order_commission( (int) $order_id, 'pending' );

		$comm = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id, affiliate_id, commission_amount, status, delivered_at, matures_at 
				FROM {$table_commissions} 
				WHERE order_id = %d AND status = 'pending' LIMIT 1",
				(int) $order_id
			)
		);

		if ( ! $comm ) {
			return;
		}

		// Only stamp delivery and maturity if not already stamped
		if ( empty( $comm->delivered_at ) || empty( $comm->matures_at ) ) {
			$delivered_time = current_time( 'mysql' );
			$matures_time   = gmdate( 'Y-m-d H:i:s', time() + ( self::get_grace_period_days() * DAY_IN_SECONDS ) );

			$wpdb->update(
				$table_commissions,
				[
					'delivered_at' => $delivered_time,
					'matures_at'   => $matures_time,
				],
				[ 'id' => $comm->id ],
				[ '%s', '%s' ],
				[ '%d' ]
			);

			// Schedule single Action Scheduler worker if available
			if ( function_exists( 'as_schedule_single_action' ) ) {
				as_schedule_single_action(
					time() + ( self::get_grace_period_days() * DAY_IN_SECONDS ),
					'exacoat_affiliate_mature_commission_action',
					[ 'commission_id' => (int) $comm->id ]
				);
			}
		}
	}

	/**
	 * Mature single commission from pending to unpaid once 7-day post-delivery grace period ends.
	 */
	public static function mature_single_commission( int $commission_id ): void {
		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';
		$table_affiliates  = $wpdb->prefix . 'exacoat_affiliates';

		$comm = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table_commissions} WHERE id = %d LIMIT 1", $commission_id )
		);

		if ( ! $comm || 'pending' !== $comm->status ) {
			return;
		}

		// Verify 7-day grace period has actually passed
		if ( ! empty( $comm->matures_at ) && strtotime( $comm->matures_at ) > time() ) {
			return;
		}

		$wpdb->update(
			$table_commissions,
			[ 'status' => 'unpaid' ],
			[ 'id' => $comm->id ]
		);

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table_affiliates} 
				SET unpaid_balance = unpaid_balance + %f, 
				    lifetime_earnings = lifetime_earnings + %f 
				WHERE id = %d",
				$comm->commission_amount,
				$comm->commission_amount,
				$comm->affiliate_id
			)
		);

		$order = wc_get_order( $comm->order_id );
		if ( $order instanceof WC_Order ) {
			self::dispatch_commission_email( 'confirmed', (int) $comm->affiliate_id, $order, (float) $comm->commission_amount );
		}
	}

	/**
	 * Cron & On-Demand Worker: mature all pending commissions whose 7-day grace period has elapsed.
	 */
	public static function process_matured_commissions(): int {
		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';

		$now = current_time( 'mysql' );
		$matured_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM {$table_commissions} 
				WHERE status = 'pending' 
				  AND matures_at IS NOT NULL 
				  AND matures_at <= %s",
				$now
			)
		);

		$count = 0;
		if ( ! empty( $matured_ids ) ) {
			foreach ( $matured_ids as $cid ) {
				self::mature_single_commission( (int) $cid );
				$count++;
			}
		}
		return $count;
	}

	/**
	 * Calculate net 20% commission, prevent self referral, and record initial pending commission.
	 */
	public static function record_order_commission( int $order_id, string $target_status = 'pending' ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order instanceof WC_Order ) {
			return;
		}

		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';
		$table_affiliates  = $wpdb->prefix . 'exacoat_affiliates';

		$existing = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table_commissions} WHERE order_id = %d LIMIT 1", $order_id )
		);

		if ( $existing ) {
			return;
		}

		$ref_slug = $order->get_meta( '_exacoat_affiliate_slug' );
		if ( empty( $ref_slug ) && ! empty( $_COOKIE[ self::COOKIE_NAME ] ) ) {
			$ref_slug = sanitize_title( wp_unslash( $_COOKIE[ self::COOKIE_NAME ] ) );
		}

		if ( empty( $ref_slug ) ) {
			return;
		}

		$affiliate = self::get_affiliate_by_slug( $ref_slug );
		if ( ! $affiliate || 'active' !== $affiliate->status ) {
			return;
		}

		// Anti self-referral check: email, user ID, and phone number
		$affiliate_user = get_userdata( $affiliate->user_id );
		$affiliate_email = $affiliate_user ? strtolower( trim( $affiliate_user->user_email ) ) : '';
		$customer_email  = strtolower( trim( $order->get_billing_email() ) );
		$customer_user_id = (int) $order->get_user_id();

		$is_self_referral = false;
		if ( $customer_user_id > 0 && $customer_user_id === (int) $affiliate->user_id ) {
			$is_self_referral = true;
		}
		if ( ! empty( $affiliate_email ) && $affiliate_email === $customer_email ) {
			$is_self_referral = true;
		}

		// Compute commission base: subtotal minus discounts, strictly excluding tax and shipping
		$subtotal        = (float) $order->get_subtotal();
		$discount_total  = (float) $order->get_discount_total();
		$net_eligible    = max( 0.0, $subtotal - $discount_total );
		$commission_rate = self::get_commission_rate();
		$commission_amt  = round( $net_eligible * ( $commission_rate / 100.0 ), 2 );

		if ( $commission_amt <= 0 ) {
			return;
		}

		$initial_status   = $is_self_referral ? 'rejected' : 'pending';
		$rejection_reason = $is_self_referral ? 'Self referral prohibited' : null;

		$wpdb->insert(
			$table_commissions,
			[
				'affiliate_id'      => $affiliate->id,
				'order_id'          => $order_id,
				'order_number'      => $order->get_order_number(),
				'order_subtotal'    => $net_eligible,
				'commission_rate'   => $commission_rate,
				'commission_amount' => $commission_amt,
				'status'            => $initial_status,
				'delivered_at'      => null,
				'matures_at'        => null,
				'rejection_reason'  => $rejection_reason,
				'customer_email'    => $customer_email,
				'created_at'        => current_time( 'mysql' ),
			],
			[ '%d', '%d', '%s', '%f', '%f', '%f', '%s', '%s', '%s', '%s', '%s', '%s' ]
		);

		$commission_id = $wpdb->insert_id;
		$order->update_meta_data( '_exacoat_affiliate_id', (int) $affiliate->id );
		$order->update_meta_data( '_exacoat_affiliate_commission_id', (int) $commission_id );
		$order->save();

		// Record order count
		if ( ! $is_self_referral ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table_affiliates} SET total_orders = total_orders + 1 WHERE id = %d",
					$affiliate->id
				)
			);

			self::dispatch_commission_email( 'recorded', (int) $affiliate->id, $order, $commission_amt );
		}
	}

	/**
	 * Automatically revoke or reject commission on order refund or cancellation.
	 */
	public static function handle_order_clawback( $order_id ): void {
		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';
		$table_affiliates  = $wpdb->prefix . 'exacoat_affiliates';

		$commissions = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table_commissions} WHERE order_id = %d AND status IN ('pending', 'unpaid')",
				(int) $order_id
			)
		);

		if ( empty( $commissions ) ) {
			return;
		}

		$order = wc_get_order( $order_id );

		foreach ( $commissions as $comm ) {
			$wpdb->update(
				$table_commissions,
				[
					'status'           => 'rejected',
					'rejection_reason' => 'Order cancelled or refunded during or after grace period',
				],
				[ 'id' => $comm->id ]
			);

			// Deduct from balance only if previously matured into unpaid
			if ( 'unpaid' === $comm->status ) {
				$wpdb->query(
					$wpdb->prepare(
						"UPDATE {$table_affiliates} 
						SET unpaid_balance = GREATEST(0.00, unpaid_balance - %f),
						    lifetime_earnings = GREATEST(0.00, lifetime_earnings - %f)
						WHERE id = %d",
						$comm->commission_amount,
						$comm->commission_amount,
						$comm->affiliate_id
					)
				);
			}

			if ( $order instanceof WC_Order ) {
				self::dispatch_commission_email( 'rejected', (int) $comm->affiliate_id, $order, (float) $comm->commission_amount );
			}
		}
	}

	/**
	 * Handle partial or full refund hook.
	 */
	public static function handle_order_refund_event( $order_id, $refund_id ): void {
		self::handle_order_clawback( $order_id );
	}

	/**
	 * Helper: lookup affiliate row by slug.
	 */
	public static function get_affiliate_by_slug( string $slug ) {
		global $wpdb;
		$table = $wpdb->prefix . 'exacoat_affiliates';
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE slug = %s LIMIT 1", sanitize_title( $slug ) )
		);
	}

	/**
	 * Helper: lookup affiliate row by user ID.
	 */
	public static function get_affiliate_by_user_id( int $user_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'exacoat_affiliates';
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE user_id = %d LIMIT 1", $user_id )
		);
	}

	/**
	 * Determine cross-subdomain cookie domain.
	 */
	private static function get_cookie_domain(): string {
		$host = $_SERVER['HTTP_HOST'] ?? 'exacoat.com';
		$host = preg_replace( '/:\d+$/', '', $host );

		if ( 'localhost' === $host || filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return $host;
		}

		$parts = explode( '.', $host );
		if ( count( $parts ) >= 2 ) {
			return '.' . implode( '.', array_slice( $parts, -2 ) );
		}

		return '.' . $host;
	}

	/**
	 * Register REST API routes for creator portal and manager workstation.
	 */
	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat/v1', 'exacoat-core/v1' ];

		foreach ( $namespaces as $ns ) {
			// Public registration
			register_rest_route( $ns, '/affiliate/register', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_register' ],
				'permission_callback' => '__return_true',
			] );

			// Creator portal endpoints (requires authenticated affiliate user)
			register_rest_route( $ns, '/affiliate/portal', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_portal_data' ],
				'permission_callback' => [ __CLASS__, 'check_affiliate_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/settings', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_update_settings' ],
				'permission_callback' => [ __CLASS__, 'check_affiliate_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/payout-request', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_request_payout' ],
				'permission_callback' => [ __CLASS__, 'check_affiliate_auth' ],
			] );

			// Product search for deep link generator
			register_rest_route( $ns, '/affiliate/products', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_search_products' ],
				'permission_callback' => '__return_true',
			] );

			// Admin workstation endpoints (requires manage_woocommerce capability)
			register_rest_route( $ns, '/affiliate/admin/all', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_admin_get_affiliates' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/update-status', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_admin_update_status' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/commissions', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_admin_get_commissions' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/payouts', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_admin_get_payouts' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/update-payout', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_admin_update_payout' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/export-payouts', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_admin_export_payouts' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/settings', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_admin_get_settings' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/settings', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_admin_update_settings' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/slicewp-status', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_admin_slicewp_status' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );

			register_rest_route( $ns, '/affiliate/admin/slicewp-migrate', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_admin_slicewp_migrate' ],
				'permission_callback' => [ __CLASS__, 'check_admin_auth' ],
			] );
		}
	}

	/**
	 * Permission check: verify affiliate is logged in.
	 */
	public static function check_affiliate_auth( WP_REST_Request $request ): bool {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			$user_id = self::extract_authenticated_user_id( $request );
		}
		return $user_id > 0;
	}

	/**
	 * Permission check: verify administrator or shop_manager access.
	 */
	public static function check_admin_auth( WP_REST_Request $request ): bool {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			$user_id = self::extract_authenticated_user_id( $request );
		}

		if ( ! $user_id ) {
			return false;
		}

		return user_can( $user_id, 'manage_woocommerce' ) || user_can( $user_id, 'administrator' );
	}

	/**
	 * Extract user ID from application passwords or custom auth tokens.
	 */
	private static function extract_authenticated_user_id( WP_REST_Request $request ): int {
		$auth_header = $request->get_header( 'authorization' ) ?: ( $_SERVER['HTTP_AUTHORIZATION'] ?? '' );
		if ( ! empty( $auth_header ) && preg_match( '/^Basic\s+(.+)$/i', $auth_header, $m ) ) {
			$decoded = base64_decode( $m[1] );
			if ( strpos( $decoded, ':' ) !== false ) {
				list( $u, $p ) = explode( ':', $decoded, 2 );
				$user = wp_authenticate_application_password( null, $u, $p );
				if ( $user instanceof WP_User ) {
					return (int) $user->ID;
				}
				$normal_user = wp_authenticate( $u, $p );
				if ( $normal_user instanceof WP_User ) {
					return (int) $normal_user->ID;
				}
			}
		}
		return 0;
	}

	/**
	 * Verify Cloudflare Turnstile bot prevention token.
	 */
	public static function verify_turnstile( string $token, string $remote_ip = '' ): bool {
		if ( empty( $token ) ) {
			return false;
		}

		$secret_key = defined( 'CLOUDFLARE_TURNSTILE_SECRET_KEY' ) ? CLOUDFLARE_TURNSTILE_SECRET_KEY : '';
		if ( empty( $secret_key ) ) {
			return true;
		}

		$body = [
			'secret'   => $secret_key,
			'response' => $token,
		];
		if ( ! empty( $remote_ip ) ) {
			$body['remoteip'] = $remote_ip;
		}

		$response = wp_remote_post( 'https://challenges.cloudflare.com/turnstile/v0/siteverify', [
			'timeout' => 10,
			'body'    => $body,
		] );

		if ( is_wp_error( $response ) ) {
			error_log( '[Exacoat Turnstile] Verification API request error: ' . $response->get_error_message() );
			return false;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		return ! empty( $data['success'] );
	}

	/**
	 * Endpoint: Register a new affiliate applicant.
	 */
	public static function rest_register( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();

		// Verify Cloudflare Turnstile token to prevent spam bots
		$turnstile_token = trim( $params['turnstile_token'] ?? ( $params['cf-turnstile-response'] ?? '' ) );
		$remote_ip       = ! empty( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

		if ( ! self::verify_turnstile( $turnstile_token, $remote_ip ) ) {
			return new WP_Error(
				'turnstile_failed',
				'Bot verification challenge failed. Please verify you are human and try again.',
				[ 'status' => 403 ]
			);
		}

		$username          = sanitize_user( trim( $params['username'] ?? '' ) );
		$first_name        = sanitize_text_field( trim( $params['first_name'] ?? '' ) );
		$last_name         = sanitize_text_field( trim( $params['last_name'] ?? '' ) );
		$email             = sanitize_email( strtolower( trim( $params['email'] ?? '' ) ) );
		$password          = trim( $params['password'] ?? '' );
		$affiliate_type    = sanitize_text_field( is_array( $params['affiliate_type'] ?? '' ) ? implode( ', ', $params['affiliate_type'] ) : ( $params['affiliate_type'] ?? '' ) );
		$promotion_channel = sanitize_text_field( trim( $params['promotion_channel'] ?? '' ) );
		$promotion_notes   = sanitize_textarea_field( trim( $params['promotion_notes'] ?? '' ) );

		if ( empty( $username ) || empty( $email ) || empty( $password ) || empty( $first_name ) ) {
			return new WP_Error( 'missing_fields', 'Please complete all required fields.', [ 'status' => 400 ] );
		}

		if ( ! is_email( $email ) ) {
			return new WP_Error( 'invalid_email', 'Please provide a valid email address.', [ 'status' => 400 ] );
		}

		if ( username_exists( $username ) ) {
			return new WP_Error( 'username_exists', 'This username is already registered.', [ 'status' => 409 ] );
		}

		if ( email_exists( $email ) ) {
			return new WP_Error( 'email_exists', 'This email address is already registered.', [ 'status' => 409 ] );
		}

		$candidate_slug = sanitize_title( $username );
		if ( empty( $candidate_slug ) ) {
			$candidate_slug = 'affiliate-' . wp_generate_password( 6, false, false );
		}

		global $wpdb;
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';

		$slug_exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM {$table_affiliates} WHERE slug = %s LIMIT 1", $candidate_slug )
		);
		if ( $slug_exists ) {
			$candidate_slug .= '-' . wp_generate_password( 4, false, false );
		}

		$user_id = wp_create_user( $username, $password, $email );
		if ( is_wp_error( $user_id ) ) {
			return $user_id;
		}

		$wp_user = new WP_User( $user_id );
		$wp_user->add_role( self::ROLE_AFFILIATE );

		wp_update_user( [
			'ID'         => $user_id,
			'first_name' => $first_name,
			'last_name'  => $last_name,
			'nickname'   => $username,
		] );

		$initial_status = self::is_auto_approve() ? 'active' : 'pending_approval';

		$wpdb->insert(
			$table_affiliates,
			[
				'user_id'           => $user_id,
				'slug'              => $candidate_slug,
				'slug_locked'       => 0,
				'status'            => $initial_status,
				'affiliate_type'    => $affiliate_type,
				'promotion_channel' => $promotion_channel,
				'promotion_notes'   => $promotion_notes,
				'created_at'        => current_time( 'mysql' ),
			],
			[ '%d', '%s', '%d', '%s', '%s', '%s', '%s', '%s' ]
		);

		$affiliate_id = $wpdb->insert_id;

		if ( 'active' === $initial_status ) {
			self::dispatch_applicant_email( 'approved', $email, $first_name, $candidate_slug );
		} else {
			self::dispatch_applicant_email( 'received', $email, $first_name );
		}

		return rest_ensure_response( [
			'success'      => true,
			'message'      => 'active' === $initial_status
				? 'Application approved automatically. You can now access your creator portal.'
				: 'Application received. Our team will review your application shortly.',
			'affiliate_id' => $affiliate_id,
			'status'       => $initial_status,
			'slug'         => $candidate_slug,
		] );
	}

	/**
	 * Endpoint: Get dashboard and financial data for creator portal.
	 */
	public static function rest_get_portal_data( WP_REST_Request $request ) {
		$user_id = get_current_user_id() ?: self::extract_authenticated_user_id( $request );
		if ( ! $user_id ) {
			return new WP_Error( 'unauthorized', 'Authentication required.', [ 'status' => 401 ] );
		}

		// Ensure any commissions that have cleared the 7-day grace period mature now
		self::process_matured_commissions();

		$affiliate = self::get_affiliate_by_user_id( $user_id );
		if ( ! $affiliate ) {
			return new WP_Error( 'not_found', 'Affiliate profile not found.', [ 'status' => 404 ] );
		}

		$user = get_userdata( $user_id );
		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';
		$table_payouts     = $wpdb->prefix . 'exacoat_affiliate_payouts';

		// Retrieve commissions with grace period delivery timestamps
		$commissions = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, order_number, order_subtotal, commission_amount, status, delivered_at, matures_at, rejection_reason, created_at 
				FROM {$table_commissions} 
				WHERE affiliate_id = %d 
				ORDER BY id DESC LIMIT 50",
				$affiliate->id
			)
		);

		// Retrieve payout requests
		$payouts = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, amount, bank_name, bank_account_number, bank_account_name, status, transfer_reference, created_at, paid_at 
				FROM {$table_payouts} 
				WHERE affiliate_id = %d 
				ORDER BY id DESC LIMIT 30",
				$affiliate->id
			)
		);

		// Retrieve recent clicks/visits for analytics
		$table_clicks = $wpdb->prefix . 'exacoat_affiliate_clicks';
		$clicks = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, landing_url, referrer_url, created_at 
				FROM {$table_clicks} 
				WHERE affiliate_id = %d 
				ORDER BY id DESC LIMIT 300",
				$affiliate->id
			)
		);

		// Compute aggregated daily stats for the last 60 days
		$daily_clicks = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DATE(created_at) as stat_date, COUNT(*) as visit_count 
				FROM {$table_clicks} 
				WHERE affiliate_id = %d AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
				GROUP BY DATE(created_at)",
				$affiliate->id
			),
			OBJECT_K
		);

		$daily_commissions = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DATE(created_at) as stat_date, COUNT(*) as order_count, SUM(commission_amount) as total_earnings 
				FROM {$table_commissions} 
				WHERE affiliate_id = %d AND status != 'rejected' AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
				GROUP BY DATE(created_at)",
				$affiliate->id
			),
			OBJECT_K
		);

		$all_dates = array_unique( array_merge( array_keys( $daily_clicks ?: [] ), array_keys( $daily_commissions ?: [] ) ) );
		sort( $all_dates );

		$daily_stats = [];
		foreach ( $all_dates as $d ) {
			$v = isset( $daily_clicks[ $d ] ) ? (int) $daily_clicks[ $d ]->visit_count : 0;
			$o = isset( $daily_commissions[ $d ] ) ? (int) $daily_commissions[ $d ]->order_count : 0;
			$e = isset( $daily_commissions[ $d ] ) ? (float) $daily_commissions[ $d ]->total_earnings : 0.0;
			$daily_stats[] = [
				'date'     => $d,
				'visits'   => $v,
				'orders'   => $o,
				'earnings' => $e,
			];
		}

		$site_url = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : 'https://exacoat.com';
		$referral_url = trailingslashit( $site_url ) . '?ref=' . rawurlencode( $affiliate->slug );

		return rest_ensure_response( [
			'success' => true,
			'profile' => [
				'id'                  => (int) $affiliate->id,
				'username'            => $user ? $user->user_login : '',
				'first_name'          => $user ? $user->first_name : '',
				'last_name'           => $user ? $user->last_name : '',
				'email'               => $user ? $user->user_email : '',
				'slug'                => $affiliate->slug,
				'slug_locked'         => (bool) $affiliate->slug_locked,
				'status'              => $affiliate->status,
				'affiliate_type'      => $affiliate->affiliate_type,
				'promotion_channel'   => $affiliate->promotion_channel,
				'bank_name'           => $affiliate->bank_name,
				'bank_account_number' => $affiliate->bank_account_number,
				'bank_account_name'   => $affiliate->bank_account_name,
				'referral_url'        => $referral_url,
			],
			'metrics' => [
				'lifetime_earnings' => (float) $affiliate->lifetime_earnings,
				'unpaid_balance'    => (float) $affiliate->unpaid_balance,
				'total_clicks'      => (int) $affiliate->total_clicks,
				'total_orders'      => (int) $affiliate->total_orders,
				'commission_rate'   => self::get_commission_rate(),
				'grace_period_days' => self::get_grace_period_days(),
				'min_payout_amount' => self::get_min_payout(),
				'can_request_payout'=> ( (float) $affiliate->unpaid_balance >= self::get_min_payout() && in_array( $affiliate->bank_name, [ 'BCA', 'MANDIRI' ], true ) && ! empty( $affiliate->bank_account_number ) ),
			],
			'commissions' => $commissions ?: [],
			'payouts'     => $payouts ?: [],
			'clicks'      => $clicks ?: [],
			'daily_stats' => $daily_stats ?: [],
		] );
	}

	/**
	 * Endpoint: Save bank settings (BCA / Mandiri only) and lock referral slug.
	 */
	public static function rest_update_settings( WP_REST_Request $request ) {
		$user_id = get_current_user_id() ?: self::extract_authenticated_user_id( $request );
		if ( ! $user_id ) {
			return new WP_Error( 'unauthorized', 'Authentication required.', [ 'status' => 401 ] );
		}

		$affiliate = self::get_affiliate_by_user_id( $user_id );
		if ( ! $affiliate ) {
			return new WP_Error( 'not_found', 'Affiliate profile not found.', [ 'status' => 404 ] );
		}

		$params = $request->get_json_params() ?: $request->get_params();
		global $wpdb;
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';

		$updates = [];
		$formats = [];

		if ( isset( $params['bank_name'] ) ) {
			$raw_bank = strtoupper( trim( sanitize_text_field( $params['bank_name'] ) ) );
			if ( ! in_array( $raw_bank, [ 'BCA', 'MANDIRI' ], true ) ) {
				return new WP_Error( 'invalid_bank', 'Only BCA and Bank Mandiri are supported for payouts.', [ 'status' => 400 ] );
			}
			$updates['bank_name'] = $raw_bank;
			$formats[] = '%s';
		}

		if ( isset( $params['bank_account_number'] ) ) {
			$account_number = preg_replace( '/[^0-9]/', '', (string) $params['bank_account_number'] );
			if ( strlen( $account_number ) < 8 || strlen( $account_number ) > 20 ) {
				return new WP_Error( 'invalid_account_number', 'Please enter a valid bank account number.', [ 'status' => 400 ] );
			}
			$updates['bank_account_number'] = $account_number;
			$formats[] = '%s';
		}

		if ( isset( $params['bank_account_name'] ) ) {
			$account_name = sanitize_text_field( trim( $params['bank_account_name'] ) );
			if ( empty( $account_name ) ) {
				return new WP_Error( 'invalid_account_name', 'Bank account holder name is required.', [ 'status' => 400 ] );
			}
			$updates['bank_account_name'] = $account_name;
			$formats[] = '%s';
		}

		if ( ! empty( $params['slug'] ) && ! $affiliate->slug_locked ) {
			$new_slug = sanitize_title( trim( $params['slug'] ) );
			if ( strlen( $new_slug ) < 3 ) {
				return new WP_Error( 'invalid_slug', 'Referral URL slug must be at least 3 characters.', [ 'status' => 400 ] );
			}

			$existing_slug_owner = $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$table_affiliates} WHERE slug = %s AND id != %d LIMIT 1", $new_slug, $affiliate->id )
			);
			if ( $existing_slug_owner ) {
				return new WP_Error( 'slug_taken', 'This referral slug is already in use by another affiliate.', [ 'status' => 409 ] );
			}

			$updates['slug']        = $new_slug;
			$formats[]              = '%s';
			$updates['slug_locked'] = 1;
			$formats[]              = '%d';
		}

		if ( empty( $updates ) ) {
			return rest_ensure_response( [ 'success' => true, 'message' => 'No changes submitted.' ] );
		}

		$wpdb->update( $table_affiliates, $updates, [ 'id' => $affiliate->id ], $formats, [ '%d' ] );

		return rest_ensure_response( [
			'success' => true,
			'message' => 'Settings saved successfully.',
		] );
	}

	/**
	 * Endpoint: Submit payout request (minimum Rp 250,000 threshold).
	 */
	public static function rest_request_payout( WP_REST_Request $request ) {
		$user_id = get_current_user_id() ?: self::extract_authenticated_user_id( $request );
		if ( ! $user_id ) {
			return new WP_Error( 'unauthorized', 'Authentication required.', [ 'status' => 401 ] );
		}

		// Mature any eligible commissions first
		self::process_matured_commissions();

		$affiliate = self::get_affiliate_by_user_id( $user_id );
		if ( ! $affiliate || 'active' !== $affiliate->status ) {
			return new WP_Error( 'forbidden', 'Only approved active affiliates can request payouts.', [ 'status' => 403 ] );
		}

		if ( ! in_array( $affiliate->bank_name, [ 'BCA', 'MANDIRI' ], true ) || empty( $affiliate->bank_account_number ) ) {
			return new WP_Error( 'missing_bank', 'Please configure your BCA or Mandiri account before requesting a payout.', [ 'status' => 400 ] );
		}

		$unpaid = (float) $affiliate->unpaid_balance;
		$min_payout = self::get_min_payout();
		if ( $unpaid < $min_payout ) {
			return new WP_Error(
				'below_minimum',
				sprintf( 'Minimum payout threshold is Rp %s.', number_format( $min_payout, 0, ',', '.' ) ),
				[ 'status' => 400 ]
			);
		}

		global $wpdb;
		$table_payouts     = $wpdb->prefix . 'exacoat_affiliate_payouts';
		$table_affiliates  = $wpdb->prefix . 'exacoat_affiliates';
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';

		$active_pending = $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM {$table_payouts} WHERE affiliate_id = %d AND status = 'pending' LIMIT 1", $affiliate->id )
		);
		if ( $active_pending ) {
			return new WP_Error( 'pending_request_exists', 'You already have an open payout request under review.', [ 'status' => 409 ] );
		}

		$wpdb->insert(
			$table_payouts,
			[
				'affiliate_id'        => $affiliate->id,
				'amount'              => $unpaid,
				'bank_name'           => $affiliate->bank_name,
				'bank_account_number' => $affiliate->bank_account_number,
				'bank_account_name'   => $affiliate->bank_account_name,
				'status'              => 'pending',
				'created_at'          => current_time( 'mysql' ),
			],
			[ '%d', '%f', '%s', '%s', '%s', '%s', '%s' ]
		);

		$payout_id = $wpdb->insert_id;

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table_affiliates} SET unpaid_balance = GREATEST(0.00, unpaid_balance - %f) WHERE id = %d",
				$unpaid,
				$affiliate->id
			)
		);

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table_commissions} SET payout_id = %d WHERE affiliate_id = %d AND status = 'unpaid' AND payout_id IS NULL",
				$payout_id,
				$affiliate->id
			)
		);

		$user = get_userdata( $affiliate->user_id );
		if ( $user ) {
			self::dispatch_payout_email( 'requested', $user->user_email, $user->first_name, $unpaid, $affiliate->bank_name, $affiliate->bank_account_number );
		}

		return rest_ensure_response( [
			'success'   => true,
			'message'   => 'Payout request submitted. Funds will be transferred on the next scheduled payout cycle.',
			'payout_id' => $payout_id,
			'amount'    => $unpaid,
		] );
	}

	/**
	 * Endpoint: Search products on storefront to build referral links.
	 */
	public static function rest_search_products( WP_REST_Request $request ) {
		$query = sanitize_text_field( trim( $request->get_param( 'q' ) ?: '' ) );
		$args  = [
			'status'    => 'publish',
			'limit'     => 20,
			'orderby'   => 'popularity',
			'order'     => 'DESC',
		];

		if ( ! empty( $query ) ) {
			$args['s'] = $query;
		}

		$products = wc_get_products( $args );
		$site_url = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : 'https://exacoat.com';
		$results  = [];

		foreach ( $products as $prod ) {
			$image_id = $prod->get_image_id();
			$results[] = [
				'id'        => $prod->get_id(),
				'name'      => $prod->get_name(),
				'slug'      => $prod->get_slug(),
				'price'     => (float) $prod->get_price(),
				'permalink' => trailingslashit( $site_url ) . 'products/' . $prod->get_slug(),
				'image_url' => $image_id ? wp_get_attachment_image_url( $image_id, 'medium' ) : '',
			];
		}

		return rest_ensure_response( [ 'success' => true, 'products' => $results ] );
	}

	/**
	 * Admin Endpoint: List all affiliates with filters and metrics.
	 */
	public static function rest_admin_get_affiliates( WP_REST_Request $request ) {
		self::process_matured_commissions();

		global $wpdb;
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';

		$status = sanitize_text_field( $request->get_param( 'status' ) ?: '' );
		$search = sanitize_text_field( $request->get_param( 'search' ) ?: '' );

		$where_clauses = [ '1=1' ];
		$params        = [];

		if ( ! empty( $status ) && 'all' !== $status ) {
			$where_clauses[] = 'a.status = %s';
			$params[]        = $status;
		}

		if ( ! empty( $search ) ) {
			$where_clauses[] = '(a.slug LIKE %s OR u.user_email LIKE %s OR u.user_login LIKE %s OR a.bank_account_name LIKE %s)';
			$like = '%' . $wpdb->esc_like( $search ) . '%';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}

		$where_sql = implode( ' AND ', $where_clauses );
		$query = "SELECT a.*, u.user_email, u.user_login, u.display_name 
			FROM {$table_affiliates} a 
			LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID 
			WHERE {$where_sql} 
			ORDER BY a.id DESC";

		$results = ! empty( $params ) ? $wpdb->get_results( $wpdb->prepare( $query, ...$params ) ) : $wpdb->get_results( $query );

		return rest_ensure_response( [
			'success'    => true,
			'affiliates' => $results ?: [],
		] );
	}

	/**
	 * Admin Endpoint: Approve, reject, or suspend affiliate application.
	 */
	public static function rest_admin_update_status( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();
		$affiliate_id = (int) ( $params['affiliate_id'] ?? 0 );
		$new_status   = sanitize_text_field( $params['status'] ?? '' );
		$notes        = sanitize_textarea_field( $params['notes'] ?? '' );

		if ( ! in_array( $new_status, [ 'active', 'rejected', 'suspended' ], true ) ) {
			return new WP_Error( 'invalid_status', 'Invalid status specified.', [ 'status' => 400 ] );
		}

		global $wpdb;
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';

		$affiliate = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table_affiliates} WHERE id = %d LIMIT 1", $affiliate_id )
		);

		if ( ! $affiliate ) {
			return new WP_Error( 'not_found', 'Affiliate not found.', [ 'status' => 404 ] );
		}

		$wpdb->update(
			$table_affiliates,
			[ 'status' => $new_status ],
			[ 'id' => $affiliate_id ],
			[ '%s' ],
			[ '%d' ]
		);

		$user = get_userdata( $affiliate->user_id );
		if ( $user ) {
			if ( 'active' === $new_status ) {
				self::dispatch_applicant_email( 'approved', $user->user_email, $user->first_name, $affiliate->slug );
			} elseif ( 'rejected' === $new_status ) {
				self::dispatch_applicant_email( 'rejected', $user->user_email, $user->first_name, '', $notes );
			}
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => "Affiliate status updated to {$new_status}.",
		] );
	}

	/**
	 * Admin Endpoint: Commissions list for audit.
	 */
	public static function rest_admin_get_commissions( WP_REST_Request $request ) {
		self::process_matured_commissions();

		global $wpdb;
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';
		$table_affiliates  = $wpdb->prefix . 'exacoat_affiliates';

		$status = sanitize_text_field( $request->get_param( 'status' ) ?: '' );
		$aff_id = (int) ( $request->get_param( 'affiliate_id' ) ?: 0 );

		$where_clauses = [ '1=1' ];
		$params        = [];

		if ( ! empty( $status ) && 'all' !== $status ) {
			$where_clauses[] = 'c.status = %s';
			$params[]        = $status;
		}

		if ( $aff_id > 0 ) {
			$where_clauses[] = 'c.affiliate_id = %d';
			$params[]        = $aff_id;
		}

		$where_sql = implode( ' AND ', $where_clauses );
		$query = "SELECT c.*, a.slug as affiliate_slug, a.bank_name, a.bank_account_number 
			FROM {$table_commissions} c 
			LEFT JOIN {$table_affiliates} a ON c.affiliate_id = a.id 
			WHERE {$where_sql} 
			ORDER BY c.id DESC LIMIT 200";

		$results = ! empty( $params ) ? $wpdb->get_results( $wpdb->prepare( $query, ...$params ) ) : $wpdb->get_results( $query );

		return rest_ensure_response( [
			'success'     => true,
			'commissions' => $results ?: [],
		] );
	}

	/**
	 * Admin Endpoint: Payout requests ledger.
	 */
	public static function rest_admin_get_payouts( WP_REST_Request $request ) {
		self::process_matured_commissions();

		global $wpdb;
		$table_payouts    = $wpdb->prefix . 'exacoat_affiliate_payouts';
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';

		$status = sanitize_text_field( $request->get_param( 'status' ) ?: '' );

		$where_clauses = [ '1=1' ];
		$params        = [];

		if ( ! empty( $status ) && 'all' !== $status ) {
			$where_clauses[] = 'p.status = %s';
			$params[]        = $status;
		}

		$where_sql = implode( ' AND ', $where_clauses );
		$query = "SELECT p.*, a.slug as affiliate_slug, a.user_id, u.user_email 
			FROM {$table_payouts} p 
			LEFT JOIN {$table_affiliates} a ON p.affiliate_id = a.id 
			LEFT JOIN {$wpdb->users} u ON a.user_id = u.ID 
			WHERE {$where_sql} 
			ORDER BY p.id DESC";

		$results = ! empty( $params ) ? $wpdb->get_results( $wpdb->prepare( $query, ...$params ) ) : $wpdb->get_results( $query );

		return rest_ensure_response( [
			'success' => true,
			'payouts' => $results ?: [],
		] );
	}

	/**
	 * Admin Endpoint: Update payout request status (mark paid or reject).
	 */
	public static function rest_admin_update_payout( WP_REST_Request $request ) {
		$params    = $request->get_json_params() ?: $request->get_params();
		$payout_id = (int) ( $params['payout_id'] ?? 0 );
		$status    = sanitize_text_field( $params['status'] ?? '' );
		$reference = sanitize_text_field( $params['transfer_reference'] ?? '' );
		$notes     = sanitize_textarea_field( $params['admin_notes'] ?? '' );

		if ( ! in_array( $status, [ 'paid', 'rejected' ], true ) ) {
			return new WP_Error( 'invalid_status', 'Status must be paid or rejected.', [ 'status' => 400 ] );
		}

		global $wpdb;
		$table_payouts     = $wpdb->prefix . 'exacoat_affiliate_payouts';
		$table_affiliates  = $wpdb->prefix . 'exacoat_affiliates';
		$table_commissions = $wpdb->prefix . 'exacoat_affiliate_commissions';

		$payout = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table_payouts} WHERE id = %d LIMIT 1", $payout_id )
		);

		if ( ! $payout ) {
			return new WP_Error( 'not_found', 'Payout request not found.', [ 'status' => 404 ] );
		}

		if ( 'paid' === $status ) {
			$wpdb->update(
				$table_payouts,
				[
					'status'             => 'paid',
					'transfer_reference' => $reference,
					'admin_notes'        => $notes,
					'paid_at'            => current_time( 'mysql' ),
				],
				[ 'id' => $payout_id ]
			);

			$wpdb->update(
				$table_commissions,
				[ 'status' => 'paid' ],
				[ 'payout_id' => $payout_id ]
			);

			$affiliate = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$table_affiliates} WHERE id = %d LIMIT 1", $payout->affiliate_id )
			);
			if ( $affiliate ) {
				$user = get_userdata( $affiliate->user_id );
				if ( $user ) {
					self::dispatch_payout_email( 'completed', $user->user_email, $user->first_name, (float) $payout->amount, $payout->bank_name, $payout->bank_account_number, $reference );
				}
			}
		} elseif ( 'rejected' === $status ) {
			$wpdb->update(
				$table_payouts,
				[
					'status'      => 'rejected',
					'admin_notes' => $notes,
				],
				[ 'id' => $payout_id ]
			);

			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table_affiliates} SET unpaid_balance = unpaid_balance + %f WHERE id = %d",
					$payout->amount,
					$payout->affiliate_id
				)
			);

			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$table_commissions} SET payout_id = NULL WHERE payout_id = %d",
					$payout_id
				)
			);
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => "Payout marked as {$status}.",
		] );
	}

	/**
	 * Admin Endpoint: Export pending payouts to BCA KlikBCA Bisnis or Mandiri MCM CSV.
	 */
	public static function rest_admin_export_payouts( WP_REST_Request $request ) {
		$bank = strtoupper( sanitize_text_field( $request->get_param( 'bank' ) ?: 'BCA' ) );
		global $wpdb;
		$table_payouts    = $wpdb->prefix . 'exacoat_affiliate_payouts';
		$table_affiliates = $wpdb->prefix . 'exacoat_affiliates';

		$payouts = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.*, a.slug 
				FROM {$table_payouts} p 
				LEFT JOIN {$table_affiliates} a ON p.affiliate_id = a.id 
				WHERE p.status = 'pending' AND p.bank_name = %s 
				ORDER BY p.id ASC",
				$bank
			)
		);

		if ( empty( $payouts ) ) {
			return new WP_Error( 'empty', 'No pending payouts found for ' . $bank, [ 'status' => 404 ] );
		}

		$csv_lines = [];

		if ( 'BCA' === $bank ) {
			$csv_lines[] = 'No,Rekening Tujuan,Nama Penerima,Nomor Referensi,Nominal,Berita';
			$idx = 1;
			foreach ( $payouts as $p ) {
				$csv_lines[] = sprintf(
					'%d,%s,"%s",EXA-PAY-%d,%d,"Komisi Exacoat @%s"',
					$idx++,
					$p->bank_account_number,
					str_replace( '"', '""', $p->bank_account_name ),
					$p->id,
					(int) $p->amount,
					$p->slug
				);
			}
		} else {
			$csv_lines[] = 'Debit Account,Beneficiary Account,Beneficiary Name,Amount,Currency,Remark';
			foreach ( $payouts as $p ) {
				$csv_lines[] = sprintf(
					',%s,"%s",%d,IDR,"Komisi Exacoat @%s"',
					$p->bank_account_number,
					str_replace( '"', '""', $p->bank_account_name ),
					(int) $p->amount,
					$p->slug
				);
			}
		}

		$csv_content = implode( "\r\n", $csv_lines );
		$filename    = strtolower( $bank ) . '-payouts-' . gmdate( 'Y-m-d' ) . '.csv';

		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		echo $csv_content;
		exit;
	}

	/**
	 * Transactional email dispatcher for applicant lifecycle.
	 */
	private static function dispatch_applicant_email( string $type, string $email, string $first_name, string $slug = '', string $notes = '' ): void {
		if ( ! class_exists( 'Exacoat_Email_Engine' ) ) {
			return;
		}

		$store_url = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : 'https://exacoat.com';

		if ( 'received' === $type ) {
			$subject = 'We received your Exacoat affiliate application';
			$body    = "<p>Hi {$first_name},</p><p>Thank you for applying to the Exacoat Creator Affiliate Program. Our team is currently reviewing your application channels and promotion methods. We will notify you via email once approved.</p>";
		} elseif ( 'approved' === $type ) {
			$subject      = 'Welcome to the Exacoat Affiliate Program';
			$affiliate_url = trailingslashit( $store_url ) . '?ref=' . rawurlencode( $slug );
			$portal_url   = 'https://affiliate.exacoat.com';
			$body         = "<p>Congratulations {$first_name},</p><p>Your Exacoat affiliate application has been approved. You can now access your creator portal to copy your referral link, create product links, and track your commissions.</p><p><strong>Your Referral Link:</strong> <a href=\"{$affiliate_url}\">{$affiliate_url}</a></p><p><a href=\"{$portal_url}\" style=\"display:inline-block;padding:12px 24px;background:#18181b;color:#fff;border-radius:8px;text-decoration:none;\">Open Creator Portal</a></p>";
		} else {
			$subject = 'Update on your Exacoat affiliate application';
			$reason  = ! empty( $notes ) ? "<p>Feedback: {$notes}</p>" : '';
			$body    = "<p>Hi {$first_name},</p><p>Thank you for your interest in partnering with Exacoat. At this time, we are unable to accept your affiliate application.</p>{$reason}";
		}

		Exacoat_Email_Engine::send_email(
			'customer_new_account',
			$email,
			$first_name,
			[
				'subject'      => $subject,
				'body_primary' => $body,
			]
		);
	}

	/**
	 * Transactional email dispatcher for commission events.
	 */
	private static function dispatch_commission_email( string $type, int $affiliate_id, WC_Order $order, float $amount ): void {
		$affiliate = self::get_affiliate_by_id( $affiliate_id );
		if ( ! $affiliate ) {
			return;
		}

		$user = get_userdata( $affiliate->user_id );
		if ( ! $user ) {
			return;
		}

		$formatted_amount = 'Rp ' . number_format( $amount, 0, ',', '.' );
		$order_num        = $order->get_order_number();

		if ( 'confirmed' === $type ) {
			$subject = "Commission Cleared: {$formatted_amount} from Order #{$order_num}";
			$body    = "<p>Hi {$user->first_name},</p><p>Order #{$order_num} has successfully cleared the 7-day post-delivery grace period. Your 20% commission of <strong>{$formatted_amount}</strong> is now available in your withdrawable balance.</p>";
		} elseif ( 'recorded' === $type ) {
			$subject = "New Referral Sale Recorded: Order #{$order_num}";
			$body    = "<p>Hi {$user->first_name},</p><p>A customer just placed order #{$order_num} using your referral link. A commission of <strong>{$formatted_amount}</strong> is pending delivery and will mature to your balance after the 7-day post-delivery grace period.</p>";
		} else {
			$subject = "Commission Update: Order #{$order_num} Refunded";
			$body    = "<p>Hi {$user->first_name},</p><p>Order #{$order_num} was refunded or cancelled. The associated commission of {$formatted_amount} has been cancelled accordingly.</p>";
		}

		if ( class_exists( 'Exacoat_Email_Engine' ) ) {
			Exacoat_Email_Engine::send_email(
				'customer_order_refunded',
				$user->user_email,
				$user->first_name,
				[
					'subject'      => $subject,
					'body_primary' => $body,
				]
			);
		}
	}

	/**
	 * Transactional email dispatcher for payout notifications.
	 */
	private static function dispatch_payout_email( string $type, string $email, string $first_name, float $amount, string $bank, string $acc, string $ref = '' ): void {
		$formatted = 'Rp ' . number_format( $amount, 0, ',', '.' );

		if ( 'requested' === $type ) {
			$subject = "Payout Request Received: {$formatted}";
			$body    = "<p>Hi {$first_name},</p><p>We received your payout request for <strong>{$formatted}</strong> to your {$bank} account ({$acc}). Our finance team processes payouts on a regular schedule and you will receive a confirmation once transferred.</p>";
		} else {
			$subject = "Payout Sent: {$formatted} has been transferred";
			$ref_str = ! empty( $ref ) ? "<p>Bank Transfer Reference: <strong>{$ref}</strong></p>" : '';
			$body    = "<p>Hi {$first_name},</p><p>Your payout of <strong>{$formatted}</strong> has been transferred to your {$bank} account ({$acc}).</p>{$ref_str}";
		}

		if ( class_exists( 'Exacoat_Email_Engine' ) ) {
			Exacoat_Email_Engine::send_email(
				'customer_order_completed',
				$email,
				$first_name,
				[
					'subject'      => $subject,
					'body_primary' => $body,
				]
			);
		}
	}

	/**
	 * Helper: lookup affiliate row by internal affiliate table ID.
	 */
	public static function get_affiliate_by_id( int $id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'exacoat_affiliates';
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d LIMIT 1", $id )
		);
	}
}

}
