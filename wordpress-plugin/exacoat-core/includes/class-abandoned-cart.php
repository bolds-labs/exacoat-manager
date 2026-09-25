<?php
/**
 * Exacoat Abandoned Cart Recovery Engine
 * Captures checkout carts, runs scheduled 2-email recovery sequences via ZeptoMail,
 * provides 1-click cart restoration, and tracks recovered revenue.
 *
 * @package Exacoat_Core
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Abandoned_Cart' ) ) {

class Exacoat_Abandoned_Cart {

	const TABLE_NAME = 'exacoat_abandoned_carts';

	public static function init(): void {
		// 1. Ensure database table exists
		add_action( 'init', [ __CLASS__, 'ensure_tables_exist' ], 5 );

		// 2. Register REST API endpoints
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// 3. Front-end checkout email capture script
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_tracking_assets' ] );

		// 4. Cart updates & Order placement hooks
		add_action( 'woocommerce_checkout_order_processed', [ __CLASS__, 'on_order_processed' ], 10, 3 );
		add_action( 'woocommerce_thankyou', [ __CLASS__, 'on_thankyou' ], 10, 1 );

		// 5. 1-Click Cart Restore & Unsubscribe endpoints
		add_action( 'template_redirect', [ __CLASS__, 'handle_cart_restore' ], 1 );
		add_action( 'template_redirect', [ __CLASS__, 'handle_cart_unsubscribe' ], 1 );

		// 6. Action Scheduler recurring cron job
		add_action( 'exacoat_check_abandoned_carts_job', [ __CLASS__, 'process_abandoned_carts' ] );
		self::schedule_cron_job();
	}

	public static function get_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . self::TABLE_NAME;
	}

	/**
	 * Create or update database schema
	 */
	public static function create_tables(): void {
		global $wpdb;
		$table_name      = self::get_table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			cart_token varchar(64) NOT NULL,
			session_id varchar(128) NOT NULL DEFAULT '',
			user_id bigint(20) NOT NULL DEFAULT 0,
			customer_email varchar(255) NOT NULL,
			customer_first_name varchar(100) NOT NULL DEFAULT '',
			customer_phone varchar(50) NOT NULL DEFAULT '',
			cart_contents longtext NOT NULL,
			cart_total decimal(12,2) NOT NULL DEFAULT 0.00,
			currency varchar(10) NOT NULL DEFAULT 'IDR',
			status varchar(20) NOT NULL DEFAULT 'active',
			restore_token varchar(64) NOT NULL,
			email_1_status varchar(20) NOT NULL DEFAULT 'pending',
			email_1_sent_at datetime DEFAULT NULL,
			email_2_status varchar(20) NOT NULL DEFAULT 'pending',
			email_2_sent_at datetime DEFAULT NULL,
			last_active_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
			recovered_order_id bigint(20) DEFAULT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY cart_token (cart_token),
			KEY customer_email (customer_email(191)),
			KEY status (status),
			KEY last_active_at (last_active_at),
			KEY restore_token (restore_token)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}

	public static function ensure_tables_exist(): void {
		global $wpdb;
		$table_name = self::get_table_name();
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) ) !== $table_name ) {
			self::create_tables();
		}
	}

	/**
	 * Schedule background Action Scheduler recurring action
	 */
	public static function schedule_cron_job(): void {
		if ( function_exists( 'as_has_scheduled_action' ) && ! as_has_scheduled_action( 'exacoat_check_abandoned_carts_job' ) ) {
			as_schedule_recurring_action( time() + 300, 900, 'exacoat_check_abandoned_carts_job', [], 'exacoat-abandoned-cart' );
		} elseif ( ! wp_next_scheduled( 'exacoat_check_abandoned_carts_job' ) ) {
			wp_schedule_event( time() + 300, 'hourly', 'exacoat_check_abandoned_carts_job' );
		}
	}

	/**
	 * Register REST API routes
	 */
	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat-core/v1' ];

		foreach ( $namespaces as $ns ) {
			// Public tracking endpoint (invoked via checkout debounce)
			register_rest_route( $ns, '/cart/track', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_track_cart' ],
				'permission_callback' => '__return_true',
			] );

			// Admin stats endpoint
			register_rest_route( $ns, '/abandoned-carts/stats', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_stats' ],
				'permission_callback' => [ __CLASS__, 'verify_admin_permission' ],
			] );

			// Admin test email dispatch endpoint
			register_rest_route( $ns, '/abandoned-carts/send-test', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_send_test_email' ],
				'permission_callback' => [ __CLASS__, 'verify_admin_permission' ],
			] );
		}
	}

	public static function verify_admin_permission( WP_REST_Request $request ): bool {
		if ( class_exists( 'Exacoat_Core' ) && method_exists( 'Exacoat_Core', 'verify_bridge_permission' ) ) {
			return Exacoat_Core::verify_bridge_permission( $request );
		}
		return current_user_can( 'manage_options' );
	}

	/**
	 * Enqueue checkout JS email capture listener
	 */
	public static function enqueue_tracking_assets(): void {
		if ( ! is_checkout() && ! is_cart() ) {
			return;
		}

		$track_url = esc_url_raw( rest_url( 'exacoat-core/v1/cart/track' ) );
		$nonce     = wp_create_nonce( 'wp_rest' );

		$js = "
		(function() {
			var debounceTimer = null;
			var lastEmail = '';

			function getCookie(name) {
				var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
				return v ? v[2] : null;
			}

			function setCookie(name, val, days) {
				var d = new Date();
				d.setTime(d.getTime() + 24*60*60*1000*days);
				document.cookie = name + '=' + val + ';path=/;expires=' + d.toGMTString();
			}

			var cartToken = getCookie('exacoat_cart_token');
			if (!cartToken) {
				cartToken = 'exa_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
				setCookie('exacoat_cart_token', cartToken, 30);
			}

			function sendCartBeacon(email, firstName, phone) {
				if (!email || email === lastEmail) return;
				if (!email.match(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/)) return;
				lastEmail = email;

				var payload = {
					email: email,
					first_name: firstName || '',
					phone: phone || '',
					cart_token: cartToken
				};

				try {
					fetch('{$track_url}', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': '{$nonce}'
						},
						body: JSON.stringify(payload),
						credentials: 'same-origin'
					}).catch(function() {});
				} catch(e) {}
			}

			function attachListeners() {
				var emailField = document.getElementById('billing_email') || document.querySelector('input[type=\"email\"][name*=\"email\"]');
				if (!emailField) return;

				var triggerDebounced = function() {
					clearTimeout(debounceTimer);
					debounceTimer = setTimeout(function() {
						var fNameField = document.getElementById('billing_first_name') || document.querySelector('input[name*=\"first_name\"]');
						var phoneField = document.getElementById('billing_phone') || document.querySelector('input[name*=\"phone\"]');
						sendCartBeacon(
							emailField.value.trim(),
							fNameField ? fNameField.value.trim() : '',
							phoneField ? phoneField.value.trim() : ''
						);
					}, 750);
				};

				emailField.addEventListener('input', triggerDebounced);
				emailField.addEventListener('change', triggerDebounced);
				emailField.addEventListener('blur', triggerDebounced);
			}

			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', attachListeners);
			} else {
				attachListeners();
			}
		})();
		";

		wp_add_inline_script( 'woocommerce', $js );
	}

	/**
	 * REST: Track active cart from frontend beacon
	 */
	public static function rest_track_cart( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$params = $request->get_json_params() ?: $request->get_params();

		$email = sanitize_email( $params['email'] ?? '' );
		if ( ! is_email( $email ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid email address' ], 400 );
		}

		$first_name = sanitize_text_field( $params['first_name'] ?? '' );
		$phone      = sanitize_text_field( $params['phone'] ?? '' );
		$cart_token = sanitize_text_field( $params['cart_token'] ?? '' );

		if ( empty( $cart_token ) ) {
			$cart_token = 'exa_' . wp_generate_password( 24, false );
		}

		// Extract items from WooCommerce cart session
		$cart_items = [];
		$cart_total = 0.00;
		$currency   = get_woocommerce_currency();

		if ( function_exists( 'WC' ) && WC()->cart && ! WC()->cart->is_empty() ) {
			$cart_total = (float) WC()->cart->get_total( 'edit' );
			foreach ( WC()->cart->get_cart() as $cart_item_key => $item ) {
				$product = $item['data'] ?? null;
				if ( ! ( $product instanceof WC_Product ) ) {
					continue;
				}

				$image_id  = $product->get_image_id();
				$image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'medium' ) : '';
				if ( ! empty( $item['composite_url'] ) ) {
					$image_url = $item['composite_url'];
				} elseif ( ! empty( $item['_composite_url'] ) ) {
					$image_url = $item['_composite_url'];
				}

				// Build clear spec summary
				$specs = [];
				if ( ! empty( $item['device_name'] ) ) {
					$specs[] = $item['device_name'];
				}
				if ( ! empty( $item['print_finish_label'] ) ) {
					$specs[] = 'Finish: ' . $item['print_finish_label'];
				}
				if ( ! empty( $item['variation'] ) && is_array( $item['variation'] ) ) {
					foreach ( $item['variation'] as $k => $v ) {
						$specs[] = wc_attribute_label( str_replace( 'attribute_', '', $k ) ) . ': ' . $v;
					}
				}

				$cart_items[] = [
					'product_id'   => $item['product_id'],
					'variation_id' => $item['variation_id'] ?? 0,
					'name'         => $product->get_name(),
					'image_url'    => $image_url ?: 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
					'quantity'     => (int) ( $item['quantity'] ?? 1 ),
					'price'        => wc_price( (float) $product->get_price() ),
					'subtotal'     => wc_price( (float) $item['line_total'] ),
					'meta'         => implode( "\n", $specs ),
					'item_data'    => $item,
				];
			}
		}

		if ( empty( $cart_items ) ) {
			return new WP_REST_Response( [ 'success' => true, 'tracked' => false, 'message' => 'Cart is empty' ] );
		}

		$table_name    = self::get_table_name();
		$existing_cart = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$table_name} WHERE cart_token = %s OR (customer_email = %s AND status IN ('active', 'abandoned')) ORDER BY id DESC LIMIT 1",
			$cart_token,
			$email
		) );

		$restore_token = $existing_cart ? $existing_cart->restore_token : wp_generate_password( 32, false );
		$now           = current_time( 'mysql' );

		if ( $existing_cart ) {
			$wpdb->update(
				$table_name,
				[
					'customer_email'      => $email,
					'customer_first_name' => $first_name ?: $existing_cart->customer_first_name,
					'customer_phone'      => $phone ?: $existing_cart->customer_phone,
					'cart_contents'       => wp_json_encode( $cart_items ),
					'cart_total'          => $cart_total,
					'currency'            => $currency,
					'status'              => 'active',
					'last_active_at'      => $now,
					'updated_at'          => $now,
				],
				[ 'id' => $existing_cart->id ],
				[ '%s', '%s', '%s', '%s', '%f', '%s', '%s', '%s', '%s' ],
				[ '%d' ]
			);
		} else {
			$wpdb->insert(
				$table_name,
				[
					'cart_token'          => $cart_token,
					'user_id'             => get_current_user_id(),
					'customer_email'      => $email,
					'customer_first_name' => $first_name,
					'customer_phone'      => $phone,
					'cart_contents'       => wp_json_encode( $cart_items ),
					'cart_total'          => $cart_total,
					'currency'            => $currency,
					'status'              => 'active',
					'restore_token'       => $restore_token,
					'last_active_at'      => $now,
					'created_at'          => $now,
					'updated_at'          => $now,
				],
				[ '%s', '%d', '%s', '%s', '%s', '%s', '%f', '%s', '%s', '%s', '%s', '%s', '%s' ]
			);
		}

		return new WP_REST_Response( [
			'success'    => true,
			'cart_token' => $cart_token,
			'items'      => count( $cart_items ),
		] );
	}

	/**
	 * Hook: Order placed in checkout
	 */
	public static function on_order_processed( int $order_id, array $posted_data, WC_Order $order ): void {
		self::mark_cart_recovered( $order );
	}

	/**
	 * Hook: Order received / thankyou page
	 */
	public static function on_thankyou( int $order_id ): void {
		if ( ! $order_id ) return;
		$order = wc_get_order( $order_id );
		if ( $order instanceof WC_Order ) {
			self::mark_cart_recovered( $order );
		}
	}

	/**
	 * Mark cart as recovered when customer completes purchase
	 */
	private static function mark_cart_recovered( WC_Order $order ): void {
		global $wpdb;
		$email = $order->get_billing_email();
		if ( ! $email ) return;

		$table_name = self::get_table_name();
		$wpdb->query( $wpdb->prepare(
			"UPDATE {$table_name} 
			 SET status = 'recovered', recovered_order_id = %d, updated_at = %s 
			 WHERE customer_email = %s AND status IN ('active', 'abandoned')",
			$order->get_id(),
			current_time( 'mysql' ),
			$email
		) );
	}

	/**
	 * Endpoint: 1-Click Cart Restore
	 */
	public static function handle_cart_restore(): void {
		if ( ! isset( $_GET['restore_cart'] ) || empty( $_GET['restore_cart'] ) ) {
			return;
		}

		$restore_token = sanitize_text_field( wp_unslash( $_GET['restore_cart'] ) );
		global $wpdb;
		$table_name = self::get_table_name();

		$cart_row = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$table_name} WHERE restore_token = %s LIMIT 1",
			$restore_token
		) );

		if ( ! $cart_row ) {
			wp_safe_redirect( wc_get_checkout_url() );
			exit;
		}

		$items = json_decode( $cart_row->cart_contents, true );
		if ( is_array( $items ) && ! empty( $items ) && function_exists( 'WC' ) ) {
			WC()->cart->empty_cart();

			foreach ( $items as $item ) {
				$product_id   = (int) ( $item['product_id'] ?? 0 );
				$quantity     = (int) ( $item['quantity'] ?? 1 );
				$variation_id = (int) ( $item['variation_id'] ?? 0 );
				$item_data    = $item['item_data'] ?? [];

				// Clean internal WC keys from saved item data
				unset( $item_data['key'], $item_data['data'] );

				WC()->cart->add_to_cart( $product_id, $quantity, $variation_id, [], $item_data );
			}

			// Pre-fill customer billing information in session
			if ( WC()->customer ) {
				if ( ! empty( $cart_row->customer_email ) ) {
					WC()->customer->set_billing_email( $cart_row->customer_email );
				}
				if ( ! empty( $cart_row->customer_first_name ) ) {
					WC()->customer->set_billing_first_name( $cart_row->customer_first_name );
				}
				if ( ! empty( $cart_row->customer_phone ) ) {
					WC()->customer->set_billing_phone( $cart_row->customer_phone );
				}
			}

			WC()->cart->calculate_totals();
			WC()->cart->set_session();
			if ( WC()->session ) {
				WC()->session->set_customer_session_cookie( true );
				WC()->session->save_data();
			}
		}

		// Update activity timestamp
		$wpdb->update(
			$table_name,
			[ 'last_active_at' => current_time( 'mysql' ) ],
			[ 'id' => $cart_row->id ],
			[ '%s' ],
			[ '%d' ]
		);

		wp_safe_redirect( wc_get_checkout_url() );
		exit;
	}

	/**
	 * Endpoint: Unsubscribe from cart reminders
	 */
	public static function handle_cart_unsubscribe(): void {
		if ( ! isset( $_GET['unsubscribe_cart'] ) || empty( $_GET['unsubscribe_cart'] ) ) {
			return;
		}

		$restore_token = sanitize_text_field( wp_unslash( $_GET['unsubscribe_cart'] ) );
		global $wpdb;
		$table_name = self::get_table_name();

		$wpdb->update(
			$table_name,
			[
				'status'         => 'unsubscribed',
				'email_1_status' => 'skipped',
				'email_2_status' => 'skipped',
				'updated_at'     => current_time( 'mysql' ),
			],
			[ 'restore_token' => $restore_token ],
			[ '%s', '%s', '%s', '%s' ],
			[ '%s' ]
		);

		wp_die(
			'<div style="max-width:500px;margin:80px auto;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;text-align:center;padding:32px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;">'
			. '<h2 style="font-size:20px;font-weight:700;color:#18181b;margin-bottom:8px;">Unsubscribed Successfully</h2>'
			. '<p style="font-size:14px;color:#71717a;line-height:1.5;">You will not receive any further cart reminders for this session.</p>'
			. '<a href="' . esc_url( home_url() ) . '" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#111111;color:#ffffff;text-decoration:none;border-radius:10px;font-size:13px;font-weight:600;">Return to Store &rarr;</a>'
			. '</div>',
			'Unsubscribed'
		);
	}

	/**
	 * Background Cron: Process Abandoned Carts for Email 1 and Email 2
	 */
	public static function process_abandoned_carts(): void {
		global $wpdb;
		$table_name = self::get_table_name();

		// -------------------------------------------------------------
		// A. Process Email 1: 1 Hour after last activity
		// -------------------------------------------------------------
		$one_hour_ago     = gmdate( 'Y-m-d H:i:s', time() - 3600 );
		$twenty_four_ago  = gmdate( 'Y-m-d H:i:s', time() - ( 24 * 3600 ) );

		$eligible_email_1 = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$table_name} 
			 WHERE status = 'active'
			   AND last_active_at <= %s
			   AND last_active_at >= %s
			   AND email_1_status = 'pending'
			 ORDER BY id ASC LIMIT 25",
			$one_hour_ago,
			$twenty_four_ago
		) );

		foreach ( $eligible_email_1 as $cart ) {
			// Safety check: Has customer completed an order with this email?
			if ( self::customer_has_recent_order( $cart->customer_email, $cart->created_at ) ) {
				$wpdb->update(
					$table_name,
					[ 'status' => 'recovered', 'email_1_status' => 'skipped', 'email_2_status' => 'skipped' ],
					[ 'id' => $cart->id ],
					[ '%s', '%s', '%s' ],
					[ '%d' ]
				);
				continue;
			}

			// Mark as sent before dispatching to prevent double send
			$wpdb->update(
				$table_name,
				[
					'status'         => 'abandoned',
					'email_1_status' => 'sent',
					'email_1_sent_at'=> current_time( 'mysql' ),
				],
				[ 'id' => $cart->id ],
				[ '%s', '%s', '%s' ],
				[ '%d' ]
			);

			self::dispatch_abandoned_email( 'customer_cart_abandoned_1', $cart, '1' );
		}

		// -------------------------------------------------------------
		// B. Process Email 2: 24 Hours after last activity
		// -------------------------------------------------------------
		$seventy_two_ago  = gmdate( 'Y-m-d H:i:s', time() - ( 72 * 3600 ) );

		$eligible_email_2 = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$table_name} 
			 WHERE status = 'abandoned'
			   AND last_active_at <= %s
			   AND last_active_at >= %s
			   AND email_1_status = 'sent'
			   AND email_2_status = 'pending'
			 ORDER BY id ASC LIMIT 25",
			$twenty_four_ago,
			$seventy_two_ago
		) );

		foreach ( $eligible_email_2 as $cart ) {
			if ( self::customer_has_recent_order( $cart->customer_email, $cart->created_at ) ) {
				$wpdb->update(
					$table_name,
					[ 'status' => 'recovered', 'email_2_status' => 'skipped' ],
					[ 'id' => $cart->id ],
					[ '%s', '%s' ],
					[ '%d' ]
				);
				continue;
			}

			$wpdb->update(
				$table_name,
				[
					'email_2_status' => 'sent',
					'email_2_sent_at'=> current_time( 'mysql' ),
				],
				[ 'id' => $cart->id ],
				[ '%s', '%s' ],
				[ '%d' ]
			);

			self::dispatch_abandoned_email( 'customer_cart_abandoned_2', $cart, '2' );
		}
	}

	/**
	 * Verify if customer placed any order in WooCommerce since cart creation
	 */
	public static function customer_has_recent_order( string $email, string $since_date ): bool {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return false;
		}

		$orders = wc_get_orders( [
			'billing_email' => $email,
			'date_after'    => $since_date,
			'status'        => [ 'processing', 'completed', 'on-hold', 'in-production', 'ready-to-ship' ],
			'limit'         => 1,
		] );

		return ! empty( $orders );
	}

	/**
	 * Build payload and dispatch via Exacoat_Email_Engine
	 */
	private static function dispatch_abandoned_email( string $event, object $cart, string $sequence ): void {
		if ( ! class_exists( 'Exacoat_Email_Engine' ) ) {
			return;
		}

		$items           = json_decode( $cart->cart_contents, true ) ?: [];
		$storefront_base = function_exists( 'exacoat_storefront_url' ) ? exacoat_storefront_url() : home_url();

		$payload = [
			'customer_first_name' => $cart->customer_first_name ?: 'there',
			'customer_email'      => $cart->customer_email,
			'cart_token'          => $cart->cart_token,
			'restore_url'         => trailingslashit( $storefront_base ) . 'checkout/?restore_cart=' . rawurlencode( $cart->restore_token ),
			'unsubscribe_url'     => trailingslashit( $storefront_base ) . 'cart/?unsubscribe_cart=' . rawurlencode( $cart->restore_token ),
			'items'               => $items,
			'subtotal'            => function_exists( 'wc_price' ) ? wc_price( $cart->cart_total ) : number_format( $cart->cart_total, 0, ',', '.' ),
			'total'               => function_exists( 'wc_price' ) ? wc_price( $cart->cart_total ) : number_format( $cart->cart_total, 0, ',', '.' ),
			'currency'            => $cart->currency,
			'sequence'            => $sequence,
		];

		Exacoat_Email_Engine::send_email(
			$event,
			$cart->customer_email,
			$cart->customer_first_name ?: 'Customer',
			$payload
		);
	}

	/**
	 * REST: Admin stats
	 */
	public static function rest_get_stats( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table_name = self::get_table_name();

		$total_tracked   = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table_name}" );
		$total_abandoned = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table_name} WHERE status = 'abandoned'" );
		$total_recovered = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table_name} WHERE status = 'recovered'" );
		$revenue_recov   = (float) $wpdb->get_var( "SELECT COALESCE(SUM(cart_total), 0) FROM {$table_name} WHERE status = 'recovered'" );

		$recent_carts = $wpdb->get_results(
			"SELECT id, customer_email, customer_first_name, cart_total, currency, status, email_1_status, email_2_status, created_at, last_active_at 
			 FROM {$table_name} 
			 ORDER BY id DESC LIMIT 20"
		);

		return new WP_REST_Response( [
			'success'         => true,
			'total_tracked'   => $total_tracked,
			'total_abandoned' => $total_abandoned,
			'total_recovered' => $total_recovered,
			'recovery_rate'   => $total_tracked > 0 ? round( ( $total_recovered / $total_tracked ) * 100, 1 ) : 0,
			'recovered_revenue' => $revenue_recov,
			'recent_carts'    => $recent_carts,
		] );
	}

	/**
	 * REST: Send live test email
	 */
	public static function rest_send_test_email( WP_REST_Request $request ): WP_REST_Response {
		$recipient = sanitize_email( $request->get_param( 'email' ) );
		$sequence  = sanitize_text_field( $request->get_param( 'sequence' ) ?: '1' );

		if ( ! is_email( $recipient ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid test recipient email' ], 400 );
		}

		$event = ( $sequence === '2' ) ? 'customer_cart_abandoned_2' : 'customer_cart_abandoned_1';
		$mock_data = Exacoat_Email_Engine::get_mock_abandoned_cart_defaults( $sequence );
		$mock_data['customer_email'] = $recipient;

		$res = Exacoat_Email_Engine::send_email(
			$event,
			$recipient,
			'Tester',
			$mock_data
		);

		return new WP_REST_Response( [
			'success' => $res['success'] ?? true,
			'event'   => $event,
			'message' => 'Test abandoned cart email sent to ' . $recipient,
			'detail'  => $res,
		] );
	}
}

}
