<?php
/**
 * Main Exacoat Core Class & REST API Bridge
 *
 * @package Exacoat_Core
 * @version 0.0.8
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Core' ) ) {

class Exacoat_Core {

	private static $instance = null;
	private static $cached_settings = null;
	public $settings = [];

	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Memoized Settings Accessors
	 */
	public static function get_settings(): array {
		if ( self::$cached_settings === null ) {
			$options = get_option( 'exacoat_core_settings', [] );
			if ( empty( $options ) || ! is_array( $options ) ) {
				$options = get_option( 'artmatter_core_settings', [] );
			}
			if ( ! is_array( $options ) ) {
				$options = [];
			}
			// Environment constant fallbacks for AI credentials from wp-config.php
			$env_gemini = defined( 'EXA_GEMINI_API_KEY' ) ? EXA_GEMINI_API_KEY : ( defined( 'AM_GEMINI_API_KEY' ) ? AM_GEMINI_API_KEY : ( defined( 'GEMINI_API_KEY' ) ? GEMINI_API_KEY : getenv( 'EXA_GEMINI_API_KEY' ) ) );
			if ( empty( $options['gemini_api_key'] ) && ! empty( $env_gemini ) ) {
				$options['gemini_api_key'] = trim( (string) $env_gemini );
			}
			$env_openai = defined( 'EXA_OPENAI_API_KEY' ) ? EXA_OPENAI_API_KEY : ( defined( 'AM_OPENAI_API_KEY' ) ? AM_OPENAI_API_KEY : ( defined( 'OPENAI_API_KEY' ) ? OPENAI_API_KEY : getenv( 'EXA_OPENAI_API_KEY' ) ) );
			if ( empty( $options['openai_api_key'] ) && ! empty( $env_openai ) ) {
				$options['openai_api_key'] = trim( (string) $env_openai );
			}
			self::$cached_settings = $options;
		}
		return self::$cached_settings;
	}

	public static function get_setting( string $key, $default = null ) {
		$settings = self::get_settings();
		return $settings[ $key ] ?? $default;
	}

	public static function clear_settings_cache(): void {
		self::$cached_settings = null;
	}

	private function __construct() {
		$this->settings = self::get_settings();
		$this->init_modules();

		// Invalidate settings cache when updated
		add_action( 'update_option_exacoat_core_settings', [ __CLASS__, 'clear_settings_cache' ] );
		add_action( 'update_option_artmatter_core_settings', [ __CLASS__, 'clear_settings_cache' ] );

		// Register REST API Bridge for Exacoat Manager ERP communication
		add_action( 'rest_api_init', [ $this, 'register_bridge_routes' ] );

		// Preflight OPTIONS handler early in request lifecycle
		add_action( 'init', function() {
			$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
			if ( ! empty( $origin ) && self::is_cors_origin_allowed( $origin ) ) {
				self::send_cors_headers( $origin );
				if ( ( $_SERVER['REQUEST_METHOD'] ?? '' ) === 'OPTIONS' ) {
					status_header( 200 );
					exit;
				}
			}
		}, 1 );

		add_filter( 'allowed_http_origins', function( $origins ) {
			$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
			if ( ! empty( $origin ) && self::is_cors_origin_allowed( $origin ) ) {
				$origins[] = $origin;
			}
			return array_values( array_unique( (array) $origins ) );
		} );

		remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
		add_filter( 'rest_pre_serve_request', function( $value ) {
			$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
			if ( ! empty( $origin ) && self::is_cors_origin_allowed( $origin ) ) {
				self::send_cors_headers( $origin );
				if ( ( $_SERVER['REQUEST_METHOD'] ?? '' ) === 'OPTIONS' ) {
					status_header( 200 );
					exit;
				}
			}
			return $value;
		}, 999 );

		add_filter( 'rest_allowed_cors_headers', function( $headers ) {
			$custom = [ 'Authorization', 'Content-Type', 'X-WP-Nonce', 'Cache-Control', 'Pragma', 'X-Requested-With', 'sent_from', 'x-api-key', 'X-Api-Key', 'apikey', 'Accept', 'Origin', 'Cart-Token', 'Nonce', 'X-Exacoat-Currency', 'X-Artmatter-Currency', 'X-Exacoat-Client-IP', 'X-Artmatter-Client-IP', 'x-secret-key', 'X-Secret-Key', 'X-Exacoat-Secret', 'x_exacoat_secret' ];
			return array_unique( array_merge( (array) $headers, $custom ) );
		} );
	}

	/**
	 * Check if an origin is permitted for cross-origin resource sharing
	 */
	public static function is_cors_origin_allowed( ?string $origin ): bool {
		if ( empty( $origin ) ) {
			return false;
		}

		$parsed = wp_parse_url( $origin );
		$host   = strtolower( (string) ( $parsed['host'] ?? '' ) );
		if ( empty( $host ) ) {
			return false;
		}

		if ( $host === 'localhost' || $host === '127.0.0.1' ) {
			return true;
		}

		if ( preg_match( '/(^|\.)(exacoat\.com|artmatter\.co)$/i', $host ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Send unified CORS response headers
	 */
	public static function send_cors_headers( ?string $origin = null ): void {
		$origin = $origin ?: ( $_SERVER['HTTP_ORIGIN'] ?? '' );
		if ( empty( $origin ) || ! self::is_cors_origin_allowed( $origin ) ) {
			return;
		}

		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Credentials' );
		header( "Access-Control-Allow-Origin: {$origin}" );
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Vary: Origin', false );
		header( 'Access-Control-Allow-Methods: OPTIONS, GET, POST, PUT, PATCH, DELETE, HEAD' );
		header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, Cache-Control, Pragma, X-Requested-With, sent_from, x-api-key, X-Api-Key, apikey, Accept, Origin, Cart-Token, Nonce, X-Exacoat-Currency, X-Artmatter-Currency, X-Exacoat-Client-IP, X-Artmatter-Client-IP, x-secret-key, X-Secret-Key, X-Exacoat-Secret, x_exacoat_secret' );
		header( 'Access-Control-Expose-Headers: Cart-Token, Nonce, X-WP-Total, X-WP-TotalPages, X-Exacoat-Currency, X-Artmatter-Currency' );
		header( 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' );
		header( 'Pragma: no-cache' );
		header( 'Expires: 0' );
		header( 'X-LiteSpeed-Cache-Control: no-cache' );
	}

	private function init_modules() {
		try {
			// 0. High-Performance Logging & Telemetry Engine (7-Day Retention)
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::init();
			} elseif ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Logger init error: ' . $e->getMessage() );
		}

		try {
			// 1. Shipping & Biteship Tracker
			if ( self::get_setting( 'enable_shipping_tracker', 1 ) ) {
				if ( class_exists( 'Exacoat_Shipping_Tracker' ) ) {
					Exacoat_Shipping_Tracker::init();
				} elseif ( class_exists( 'Artmatter_Shipping_Tracker' ) ) {
					Artmatter_Shipping_Tracker::init();
				}
			}
			if ( class_exists( 'Exacoat_Biteship_Engine' ) ) {
				Exacoat_Biteship_Engine::init();
			} elseif ( class_exists( 'Artmatter_Biteship_Engine' ) ) {
				Artmatter_Biteship_Engine::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Shipping Tracker init error: ' . $e->getMessage() );
		}

		try {
			// 2. Store Enhancements & Frontend Cleanups
			if ( class_exists( 'Exacoat_Store_Enhancements' ) ) {
				Exacoat_Store_Enhancements::init();
			} elseif ( class_exists( 'Artmatter_Store_Enhancements' ) ) {
				Artmatter_Store_Enhancements::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Store Enhancements init error: ' . $e->getMessage() );
		}

		try {
			// 3. Comprehensive Diagnostics & Safe Testing Suite
			if ( class_exists( 'Exacoat_Diagnostics' ) ) {
				Exacoat_Diagnostics::init();
			} elseif ( class_exists( 'Artmatter_Diagnostics' ) ) {
				Artmatter_Diagnostics::init();
			}
			if ( class_exists( 'Exacoat_Performance_Auditor' ) ) {
				Exacoat_Performance_Auditor::init();
			} elseif ( class_exists( 'Artmatter_Performance_Auditor' ) ) {
				Artmatter_Performance_Auditor::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Diagnostics init error: ' . $e->getMessage() );
		}

		try {
			// 4. Native Responsive HTML Email Engine
			if ( class_exists( 'Exacoat_Email_Engine' ) ) {
				Exacoat_Email_Engine::init();
			} elseif ( class_exists( 'Artmatter_Email_Engine' ) ) {
				Artmatter_Email_Engine::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Email Engine init error: ' . $e->getMessage() );
		}

		try {
			// 5. Order Manager & Production Hub
			if ( class_exists( 'Exacoat_Order_Manager' ) ) {
				Exacoat_Order_Manager::init();
			} elseif ( class_exists( 'Artmatter_Order_Manager' ) ) {
				Artmatter_Order_Manager::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Order Manager init error: ' . $e->getMessage() );
		}

		try {
			// 6. Checkout, Thank You & Repayment Engine
			if ( class_exists( 'Exacoat_Checkout_Engine' ) ) {
				Exacoat_Checkout_Engine::init();
			} elseif ( class_exists( 'Artmatter_Checkout_Engine' ) ) {
				Artmatter_Checkout_Engine::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Checkout Engine init error: ' . $e->getMessage() );
		}

		try {
			// 7. Headless customer sessions, registration, recovery, and auth bridge
			if ( class_exists( 'Exacoat_Customer_Auth' ) ) {
				Exacoat_Customer_Auth::init();
			} elseif ( class_exists( 'Artmatter_Customer_Auth' ) ) {
				Artmatter_Customer_Auth::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Customer Auth init error: ' . $e->getMessage() );
		}

		try {
			// Admin Settings Panel
			if ( is_admin() ) {
				if ( class_exists( 'Exacoat_Admin_Settings' ) ) {
					Exacoat_Admin_Settings::init();
				} elseif ( class_exists( 'Artmatter_Admin_Settings' ) ) {
					Artmatter_Admin_Settings::init();
				}
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Admin Settings init error: ' . $e->getMessage() );
		}

		try {
			// 8. Dynamic Configurator Engine & Global Finishes Inventory
			if ( class_exists( 'Exacoat_Configurator_Engine' ) ) {
				Exacoat_Configurator_Engine::init();
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Configurator Engine init error: ' . $e->getMessage() );
		}

		try {
			// 9. Review & Customer Feedback Manager
			if ( self::get_setting( 'enable_review_manager', 1 ) ) {
				if ( class_exists( 'Exacoat_Review_Manager' ) ) {
					Exacoat_Review_Manager::init();
				} elseif ( class_exists( 'Artmatter_Review_Manager' ) ) {
					Artmatter_Review_Manager::init();
				}
			}
		} catch ( \Throwable $e ) {
			error_log( 'Exacoat Review Manager init error: ' . $e->getMessage() );
		}
	}

	/**
	 * Unified Order Payload Generator for Supabase & Webhook sync
	 */
	public static function build_order_payload( int $order_id ): ?array {
		$order = wc_get_order( $order_id );
		if ( ! $order ) return null;

		$meta_data = [];
		foreach ( $order->get_meta_data() as $meta ) {
			$meta_data[ $meta->key ] = $meta->value;
		}

		$items = [];
		foreach ( $order->get_items() as $item_id => $item ) {
			$item_meta = [];
			foreach ( $item->get_meta_data() as $im ) {
				$item_meta[ $im->key ] = $im->value;
			}
			$product = $item->get_product();
			$items[] = [
				'order_item_id' => (int) $item_id,
				'product_id'    => (int) $item->get_product_id(),
				'variation_id'  => (int) $item->get_variation_id(),
				'name'          => $item->get_name(),
				'quantity'      => (int) $item->get_quantity(),
				'subtotal'      => (float) $item->get_subtotal(),
				'total'         => (float) $item->get_total(),
				'sku'           => $product ? $product->get_sku() : '',
				'meta'          => $item_meta,
			];
		}

		$fees = [];
		$fees_total = 0.0;
		foreach ( $order->get_fees() as $fee_id => $fee ) {
			$amount = (float) $fee->get_total();
			$name   = $fee->get_name();
			$is_shipping_discount = stripos( $name, 'shipping' ) !== false;
			$fees[] = [
				'fee_id' => (int) $fee_id,
				'name'   => $name,
				'total'  => $amount,
				'tax'    => (float) $fee->get_total_tax(),
				'type'   => $is_shipping_discount ? 'shipping_discount' : 'fee',
			];
			$fees_total += $amount;
		}

		return [
			'order_id'     => $order_id,
			'order_number' => $order->get_order_number(),
			'status'       => $order->get_status(),
			'currency'     => $order->get_currency(),
			'created_at'   => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
			'updated_at'   => $order->get_date_modified() ? $order->get_date_modified()->date( 'c' ) : null,
			'totals'       => [
				'subtotal'   => (float) $order->get_subtotal(),
				'shipping'   => (float) $order->get_shipping_total(),
				'discount'   => (float) $order->get_discount_total(),
				'fees_total' => (float) $fees_total,
				'total'      => (float) $order->get_total(),
			],
			'fees'         => $fees,
			'items'        => $items,
			'customer'     => [
				'id'    => (int) $order->get_customer_id(),
				'email' => $order->get_billing_email(),
				'phone' => $order->get_billing_phone(),
				'note'  => $order->get_customer_note(),
			],
			'billing'      => $order->get_address( 'billing' ),
			'shipping'     => $order->get_address( 'shipping' ),
			'meta'         => $meta_data,
		];
	}

	/**
	 * Secure Verification for Manager ERP & External Bridge API Requests
	 */
	public static function verify_bridge_permission( WP_REST_Request $request ): bool {
		// 1. Native WordPress admin session cookie (wp-admin or authenticated AJAX)
		if ( current_user_can( 'manage_options' ) || current_user_can( 'manage_woocommerce' ) ) {
			return true;
		}

		// 2. WooCommerce REST API Keys (Consumer Key & Consumer Secret via Basic auth or params)
		if ( self::verify_wc_api_credentials( $request ) ) {
			return true;
		}

		// 3. WordPress Application Passwords (HTTP Basic Auth username:app_password)
		if ( self::verify_application_password( $request ) ) {
			return true;
		}

		// 4. Plugin Master Webhook Secret Header
		if ( self::verify_secret_key( $request ) ) {
			return true;
		}

		// 5. Customer / Staff Auth Bearer Session Token (from Exacoat_Customer_Auth)
		if ( self::verify_customer_auth_session( $request ) ) {
			return true;
		}

		// 6. Supabase User Session (if configured)
		if ( self::verify_manager_session( $request ) ) {
			return true;
		}

		// 7. Local development loopback (requests originating from localhost / local Vite dev server)
		if ( self::is_local_dev_request( $request ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Verify WooCommerce Consumer Key & Secret against wp_woocommerce_api_keys
	 */
	public static function verify_wc_api_credentials( WP_REST_Request $request ): bool {
		global $wpdb;

		$consumer_key = '';
		$consumer_secret = '';

		// A. Check HTTP Basic Auth header
		$auth_header = (string) $request->get_header( 'Authorization' );
		if ( ! empty( $auth_header ) && preg_match( '/^Basic\s+(.+)$/i', $auth_header, $matches ) ) {
			$decoded = base64_decode( trim( $matches[1] ) );
			if ( strpos( $decoded, ':' ) !== false ) {
				list( $consumer_key, $consumer_secret ) = explode( ':', $decoded, 2 );
			}
		}

		// B. Check URL query parameters or request body
		if ( empty( $consumer_key ) ) {
			$consumer_key = (string) ( $request->get_param( 'consumer_key' ) ?: $request->get_header( 'X-WC-Consumer-Key' ) );
			$consumer_secret = (string) ( $request->get_param( 'consumer_secret' ) ?: $request->get_header( 'X-WC-Consumer-Secret' ) );
		}

		if ( empty( $consumer_key ) || empty( $consumer_secret ) ) {
			return false;
		}

		$table_name = $wpdb->prefix . 'woocommerce_api_keys';
		if ( $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table_name ) ) !== $table_name ) {
			return false;
		}

		$key_hash = function_exists( 'wc_api_hash' ) ? wc_api_hash( $consumer_key ) : hash( 'sha256', $consumer_key );
		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT key_id, user_id, permissions, consumer_secret FROM {$table_name} WHERE consumer_key = %s LIMIT 1",
			$key_hash
		) );

		if ( ! $row ) {
			return false;
		}

		if ( ! hash_equals( (string) $row->consumer_secret, (string) $consumer_secret ) ) {
			return false;
		}

		if ( ! in_array( $row->permissions, [ 'write', 'read_write' ], true ) ) {
			return false;
		}

		$user = get_user_by( 'id', (int) $row->user_id );
		if ( ! $user || ( ! $user->has_cap( 'manage_woocommerce' ) && ! $user->has_cap( 'manage_options' ) && ! in_array( 'shop_manager', (array) $user->roles, true ) ) ) {
			return false;
		}

		wp_set_current_user( (int) $row->user_id );
		return true;
	}

	/**
	 * Verify WordPress Application Password
	 */
	public static function verify_application_password( WP_REST_Request $request ): bool {
		$auth_header = (string) $request->get_header( 'Authorization' );
		if ( empty( $auth_header ) || ! preg_match( '/^Basic\s+(.+)$/i', $auth_header, $matches ) ) {
			return false;
		}

		$decoded = base64_decode( trim( $matches[1] ) );
		if ( strpos( $decoded, ':' ) === false ) {
			return false;
		}

		list( $username, $password ) = explode( ':', $decoded, 2 );
		if ( ! function_exists( 'wp_authenticate_application_password' ) ) {
			return false;
		}

		$user = wp_authenticate_application_password( null, $username, $password );
		if ( is_wp_error( $user ) || ! $user instanceof \WP_User ) {
			return false;
		}

		if ( $user->has_cap( 'manage_woocommerce' ) || $user->has_cap( 'manage_options' ) || in_array( 'shop_manager', (array) $user->roles, true ) ) {
			wp_set_current_user( $user->ID );
			return true;
		}

		return false;
	}

	/**
	 * Verify Plugin Master Secret Header
	 */
	public static function verify_secret_key( WP_REST_Request $request ): bool {
		$settings = self::get_settings();
		$expected = trim( (string) ( $settings['webhook_secret'] ?? '' ) );
		if ( empty( $expected ) ) {
			return false;
		}

		$secret = (string) ( $request->get_header( 'X-Exacoat-Secret' )
			?: $request->get_header( 'X-Manager-Secret' )
			?: $request->get_header( 'X-Artmatter-Secret' )
			?: $request->get_param( 'secret' ) );

		return ! empty( $secret ) && hash_equals( $expected, trim( $secret ) );
	}

	/**
	 * Verify Customer / Staff Bearer Session Token
	 */
	public static function verify_customer_auth_session( WP_REST_Request $request ): bool {
		$auth_header = (string) $request->get_header( 'Authorization' );
		if ( ! preg_match( '/^Bearer\s+(\d+)\.([A-Za-z0-9_-]+)$/i', $auth_header, $matches ) ) {
			return false;
		}

		$user_id  = (int) $matches[1];
		$verifier = $matches[2];

		if ( ! class_exists( 'WP_Session_Tokens' ) || ! \WP_Session_Tokens::get_instance( $user_id )->verify( $verifier ) ) {
			return false;
		}

		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return false;
		}

		if ( $user->has_cap( 'manage_woocommerce' ) || $user->has_cap( 'manage_options' ) || in_array( 'shop_manager', (array) $user->roles, true ) ) {
			wp_set_current_user( $user_id );
			return true;
		}

		return false;
	}

	/**
	 * Check if request originates from localhost development environment
	 */
	private static function is_local_dev_request( WP_REST_Request $request ): bool {
		$origin  = (string) $request->get_header( 'Origin' );
		$referer = (string) $request->get_header( 'Referer' );
		$host    = (string) $request->get_header( 'Host' );

		$is_local_origin = false;
		foreach ( [ $origin, $referer ] as $url ) {
			if ( ! empty( $url ) && preg_match( '#^https?://(localhost|127\.0\.0\.1)(:\d+)?#i', $url ) ) {
				$is_local_origin = true;
				break;
			}
		}

		if ( ! $is_local_origin ) {
			return false;
		}

		if ( ( defined( 'WP_DEBUG' ) && WP_DEBUG )
			|| ( defined( 'EXACOAT_LOCAL_DEV' ) && EXACOAT_LOCAL_DEV )
			|| in_array( $host, [ 'localhost', '127.0.0.1', 'localhost:8080', 'localhost:8000', 'localhost:3005' ], true ) ) {
			return true;
		}

		return false;
	}

	public static function verify_manager_session( WP_REST_Request $request ): bool {
		$user = self::get_verified_supabase_user( $request );
		if ( empty( $user ) ) {
			return false;
		}

		$role = $user['app_metadata']['role'] ?? '';
		$email = strtolower( (string) ( $user['email'] ?? '' ) );
		return in_array( $role, [ 'manager', 'super_admin', 'shop_manager' ], true )
			|| in_array( $email, [ 'admin@exacoat.com', 'shandy@exacoat.com', 'admin@artmatter.co', 'shandy@artmatter.co' ], true );
	}

	public static function verify_authenticated_session( WP_REST_Request $request ): bool {
		return current_user_can( 'manage_options' ) || ! empty( self::get_verified_supabase_user( $request ) );
	}

	private static function get_verified_supabase_user( WP_REST_Request $request ): array {
		$auth_header = (string) $request->get_header( 'Authorization' );
		if ( ! preg_match( '/^Bearer\s+(.+)$/i', $auth_header, $matches ) ) {
			return [];
		}

		$config = class_exists( 'Artmatter_Supabase_Sync' ) ? Artmatter_Supabase_Sync::get_config() : [];
		if ( empty( $config['url'] ) || empty( $config['service_key'] ) ) {
			return [];
		}

		$response = wp_remote_get( untrailingslashit( $config['url'] ) . '/auth/v1/user', [
			'headers' => [
				'apikey'        => $config['service_key'],
				'Authorization' => 'Bearer ' . trim( $matches[1] ),
			],
			'timeout' => 10,
		] );
		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return [];
		}

		$user = json_decode( wp_remote_retrieve_body( $response ), true );
		return is_array( $user ) ? $user : [];
	}

	public function rest_purge_cloudflare_cache( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();

		// Detect target with defensive handling for legacy parameter order
		$target = sanitize_text_field( $params['target'] ?? '' );
		if ( empty( $target ) || 'all' === $target ) {
			if ( ! empty( $params['zone_id'] ) && in_array( $params['zone_id'], [ 'manager', 'storefront', 'all' ], true ) ) {
				$target = $params['zone_id'];
			} else {
				$target = 'all';
			}
		}

		$zone_id_param = ! empty( $params['zone_id'] ) && ! in_array( $params['zone_id'], [ 'manager', 'storefront', 'all' ], true )
			? sanitize_text_field( $params['zone_id'] )
			: '';

		$zone_id = ! empty( $zone_id_param )
			? $zone_id_param
			: ( defined( 'EXA_CLOUDFLARE_ZONE_ID' ) ? EXA_CLOUDFLARE_ZONE_ID : ( defined( 'EXACOAT_CLOUDFLARE_ZONE_ID' ) ? EXACOAT_CLOUDFLARE_ZONE_ID : ( defined( 'AM_CLOUDFLARE_ZONE_ID' ) ? AM_CLOUDFLARE_ZONE_ID : ( defined( 'CLOUDFLARE_ZONE_ID' ) ? CLOUDFLARE_ZONE_ID : ( getenv( 'EXA_CLOUDFLARE_ZONE_ID' ) ?: ( getenv( 'EXACOAT_CLOUDFLARE_ZONE_ID' ) ?: ( getenv( 'AM_CLOUDFLARE_ZONE_ID' ) ?: self::get_setting( 'cloudflare_zone_id', '' ) ) ) ) ) ) ) );

		$api_token_param = sanitize_text_field( $params['cloudflare_api_token'] ?? $params['api_token'] ?? '' );
		$api_token = ! empty( $api_token_param )
			? $api_token_param
			: ( defined( 'EXA_CLOUDFLARE_API_TOKEN' ) ? EXA_CLOUDFLARE_API_TOKEN : ( defined( 'EXACOAT_CLOUDFLARE_API_TOKEN' ) ? EXACOAT_CLOUDFLARE_API_TOKEN : ( defined( 'AM_CLOUDFLARE_API_TOKEN' ) ? AM_CLOUDFLARE_API_TOKEN : ( defined( 'CLOUDFLARE_API_TOKEN' ) ? CLOUDFLARE_API_TOKEN : ( getenv( 'EXA_CLOUDFLARE_API_TOKEN' ) ?: ( getenv( 'EXACOAT_CLOUDFLARE_API_TOKEN' ) ?: ( getenv( 'AM_CLOUDFLARE_API_TOKEN' ) ?: self::get_setting( 'cloudflare_api_token', '' ) ) ) ) ) ) ) );

		if ( empty( $zone_id ) || empty( $api_token ) ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => 'Cloudflare cache credentials are not configured.' ], 400 );
		}

		if ( 'manager' === $target ) {
			$purge_payload = [
				'files' => [
					'https://manager.exacoat.com/',
					'https://manager.exacoat.com/version.json',
					'https://manager.exacoat.com/exacoat-core.zip',
					'https://manager.exacoat.com/index.html',
					'https://manager.exacoat.com/env-config.js',
				],
			];
			$success_message = 'Manager workstation cache purged (manager.exacoat.com).';
		} elseif ( 'storefront' === $target ) {
			$purge_payload = [
				'files' => [
					'https://exacoat.com/',
					'https://exacoat.com/shop/',
					'https://exacoat.com/products/',
				],
			];
			$success_message = 'Storefront key pages cache purged (exacoat.com).';
		} else {
			$purge_payload = [ 'purge_everything' => true ];
			$success_message = 'Entire Exacoat network cache cleared (Storefront, Manager & CMS).';
		}

		$response = wp_remote_post( 'https://api.cloudflare.com/client/v4/zones/' . rawurlencode( trim( $zone_id ) ) . '/purge_cache', [
			'headers' => [
				'Authorization' => 'Bearer ' . trim( $api_token ),
				'Content-Type'  => 'application/json',
			],
			'body'    => wp_json_encode( $purge_payload ),
			'timeout' => 20,
		] );
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => $response->get_error_message() ], 502 );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( 200 !== wp_remote_retrieve_response_code( $response ) || empty( $body['success'] ) ) {
			$message = $body['errors'][0]['message'] ?? 'Cloudflare did not clear the cache.';
			return new WP_REST_Response( [ 'success' => false, 'error' => $message ], 502 );
		}

		return new WP_REST_Response( [ 'success' => true, 'message' => $success_message, 'target' => $target ] );
	}

	public function rest_get_catalog_prices( WP_REST_Request $request ) {
		$currency = strtoupper( sanitize_text_field( (string) $request->get_param( 'currency' ) ) );
		$page      = min( 1000, max( 1, absint( $request->get_param( 'page' ) ) ) );
		$per_page  = min( 250, max( 1, absint( $request->get_param( 'per_page' ) ) ) );
		$cache_key = 'exacoat_catalog_prices_' . strtolower( $currency ) . "_{$page}_{$per_page}";
		$cached    = get_transient( $cache_key );

		if ( is_array( $cached ) ) {
			$response = new WP_REST_Response( $cached );
			$response->header( 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300' );
			return $response;
		}

		$visibility_ids = function_exists( 'wc_get_product_visibility_term_ids' )
			? wc_get_product_visibility_term_ids()
			: [];
		$tax_query      = [];

		if ( ! empty( $visibility_ids['exclude-from-catalog'] ) ) {
			$tax_query[] = [
				'taxonomy' => 'product_visibility',
				'field'    => 'term_taxonomy_id',
				'terms'    => [ (int) $visibility_ids['exclude-from-catalog'] ],
				'operator' => 'NOT IN',
			];
		}

		$query = new WP_Query( [
			'post_type'              => 'product',
			'post_status'            => 'publish',
			'fields'                 => 'ids',
			'posts_per_page'         => $per_page,
			'paged'                  => $page,
			'orderby'                => 'ID',
			'order'                  => 'ASC',
			'ignore_sticky_posts'    => true,
			'update_post_meta_cache' => true,
			'update_post_term_cache' => false,
			'tax_query'              => $tax_query,
		] );

		$items = [];
		foreach ( $query->posts as $product_id ) {
			$base_price = get_post_meta( $product_id, '_price', true );
			if ( '' === $base_price || ! is_numeric( $base_price ) || (float) $base_price < 0 ) {
				return new WP_Error(
					'catalog_price_unavailable',
					'Catalog pricing is temporarily unavailable.',
					[ 'status' => 503 ]
				);
			}

			$price = 'IDR' === $currency
				? (float) $base_price
				: ( class_exists( 'Artmatter_Store_Enhancements' ) ? Artmatter_Store_Enhancements::calculate_price_for_currency( (float) $base_price, $currency ) : (float) $base_price );
			$items[] = [
				'id'    => (int) $product_id,
				'price' => $price,
			];
		}

		$data = [
			'currency'    => $currency,
			'page'        => $page,
			'per_page'    => $per_page,
			'total'       => (int) $query->found_posts,
			'total_pages' => (int) $query->max_num_pages,
			'items'       => $items,
		];
		set_transient( $cache_key, $data, MINUTE_IN_SECONDS );

		$response = new WP_REST_Response( $data );
		$response->header( 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300' );
		return $response;
	}

	/**
	 * REST API Endpoint Registration for Exacoat Manager ERP & Storefront
	 */
	public function register_bridge_routes() {
		$namespaces = [ 'exacoat-core/v1', 'artmatter-core/v1' ];

		$register = function( string $route, array $args ) use ( $namespaces ) {
			foreach ( $namespaces as $namespace ) {
				register_rest_route( $namespace, $route, $args );
			}
		};

		$register( '/health', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_get_health_status' ],
			'permission_callback' => '__return_true',
		] );

		$register( '/catalog/prices', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_get_catalog_prices' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'currency' => [
					'required'          => true,
					'sanitize_callback' => static function( $value ) {
						return strtoupper( sanitize_text_field( (string) $value ) );
					},
					'validate_callback' => static function( $value ) {
						$currency = strtoupper( sanitize_text_field( (string) $value ) );
						$allowed  = array_merge( [ 'IDR' ], class_exists( 'Artmatter_Store_Enhancements' ) ? array_keys( Artmatter_Store_Enhancements::get_currency_rates() ) : [ 'USD', 'SGD', 'MYR', 'EUR', 'GBP', 'AUD' ] );
						return in_array( $currency, array_unique( $allowed ), true );
					},
				],
				'page' => [
					'default'           => 1,
					'sanitize_callback' => 'absint',
					'validate_callback' => static function( $value ) {
						return is_numeric( $value ) && (int) $value >= 1 && (int) $value <= 1000;
					},
				],
				'per_page' => [
					'default'           => 100,
					'sanitize_callback' => 'absint',
					'validate_callback' => static function( $value ) {
						return is_numeric( $value ) && (int) $value >= 1 && (int) $value <= 250;
					},
				],
			],
		] );

		$register( '/ping', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_handle_ping' ],
			'permission_callback' => '__return_true',
		] );

		$register( '/contact', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_submit_contact' ],
			'permission_callback' => '__return_true',
		] );

		$register( '/settings', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_get_settings' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/settings', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_save_settings' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/settings/currency', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ $this, 'rest_handle_currency_settings' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/settings/shipping', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ $this, 'rest_handle_shipping_settings' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/settings/feelform', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_get_public_feelform_settings' ],
			'permission_callback' => '__return_true',
		] );

		$register( '/cache/cloudflare/purge', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_purge_cloudflare_cache' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// User Taste Profile REST Endpoints
		$register( '/user/taste-profile', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				$user_id = get_current_user_id();
				if ( ! $user_id ) {
					return rest_ensure_response( [ 'success' => false, 'error' => 'User not logged in' ] );
				}

				if ( $request->get_method() === 'POST' ) {
					$params  = $request->get_json_params() ?: $request->get_params();
					$profile = $params['profile'] ?? null;
					if ( is_array( $profile ) ) {
						update_user_meta( $user_id, '_exacoat_taste_profile', $profile );
						update_user_meta( $user_id, '_artmatter_taste_profile', $profile );
						return rest_ensure_response( [ 'success' => true, 'message' => 'Taste profile synchronized' ] );
					}
					return rest_ensure_response( [ 'success' => false, 'error' => 'Invalid profile payload' ] );
				}

				$profile = get_user_meta( $user_id, '_exacoat_taste_profile', true ) ?: ( get_user_meta( $user_id, '_artmatter_taste_profile', true ) ?: [] );
				return rest_ensure_response( [ 'success' => true, 'profile' => $profile ] );
			},
			'permission_callback' => '__return_true',
		] );

		// Diagnostics Endpoints
		$register( '/diagnostics/run', [
			'methods'             => 'GET',
			'callback'            => function() {
				$diag = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
				return rest_ensure_response( $diag ? $diag::run_full_api_health_check() : [ 'success' => true ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/catalog-reconciliation', [
			'methods'             => 'GET',
			'callback'            => function( WP_REST_Request $request ) {
				$diag = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
				return rest_ensure_response( $diag ? $diag::reconcile_catalog(
					max( 1, absint( $request->get_param( 'page' ) ) ),
					min( 250, max( 1, absint( $request->get_param( 'per_page' ) ) ) )
				) : [ 'success' => true ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
			'args'                => [
				'page'     => [ 'default' => 1, 'sanitize_callback' => 'absint' ],
				'per_page' => [ 'default' => 100, 'sanitize_callback' => 'absint' ],
			],
		] );

		$register( '/diagnostics/test-email', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params    = $request->get_json_params() ?: $request->get_params();
				$event     = sanitize_key( $params['event'] ?? 'test_ping' );
				$recipient = sanitize_email( $params['recipient_email'] ?? '' );
				$diag      = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
				return rest_ensure_response( $diag ? $diag::test_email_webhook( $event, $recipient, $params ) : [ 'success' => true ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/test-pushover', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params    = $request->get_json_params() ?: $request->get_params();
				$app_token = sanitize_text_field( $params['app_token'] ?? '' );
				$user_key  = sanitize_text_field( $params['user_key'] ?? '' );
				$title     = sanitize_text_field( $params['title'] ?? '' );
				$message   = sanitize_text_field( $params['message'] ?? '' );
				$url       = esc_url_raw( $params['url'] ?? '' );
				$priority  = isset( $params['priority'] ) ? intval( $params['priority'] ) : 0;
				$diag      = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
				return rest_ensure_response( $diag ? $diag::test_pushover( $app_token, $user_key, $title, $message, $url, $priority ) : [ 'success' => true ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/test-r2', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => function() {
				$diag = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
				return rest_ensure_response( $diag ? $diag::test_r2() : [ 'success' => true ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/test-drime', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				try {
					$params = $request->get_json_params() ?: $request->get_params();
					$diag   = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
					return rest_ensure_response( $diag ? $diag::test_drime( $params ) : [ 'success' => true ] );
				} catch ( Throwable $e ) {
					return rest_ensure_response( [
						'success' => false,
						'message' => 'Diagnostic Exception: ' . $e->getMessage(),
					] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/test-cloudflare', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				$params    = $request->get_json_params() ?: $request->get_params();
				$zone_id   = sanitize_text_field( $params['cloudflare_zone_id'] ?? $params['zone_id'] ?? '' );
				$api_token = sanitize_text_field( $params['cloudflare_api_token'] ?? $params['api_token'] ?? $params['token'] ?? '' );
				$diag      = class_exists( 'Exacoat_Diagnostics' ) ? 'Exacoat_Diagnostics' : ( class_exists( 'Artmatter_Diagnostics' ) ? 'Artmatter_Diagnostics' : false );
				return rest_ensure_response( $diag ? $diag::test_cloudflare_cache( $zone_id, $api_token ) : [ 'success' => true ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/test-gemini', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params  = $request->get_json_params() ?: $request->get_params();
				$api_key = sanitize_text_field( $params['api_key'] ?? '' );
				if ( class_exists( 'Exacoat_Diagnostics' ) ) {
					return rest_ensure_response( Exacoat_Diagnostics::test_gemini( $api_key ) );
				}
				return rest_ensure_response( [ 'success' => false, 'message' => 'Diagnostics class not available' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/diagnostics/test-openai', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params  = $request->get_json_params() ?: $request->get_params();
				$api_key = sanitize_text_field( $params['api_key'] ?? '' );
				if ( class_exists( 'Exacoat_Diagnostics' ) ) {
					return rest_ensure_response( Exacoat_Diagnostics::test_openai( $api_key ) );
				}
				return rest_ensure_response( [ 'success' => false, 'message' => 'Diagnostics class not available' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/fandom/generate', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params   = $request->get_json_params() ?: $request->get_params();
				$name     = sanitize_text_field( $params['name'] ?? '' );
				$provider = sanitize_text_field( $params['provider'] ?? 'openai' );
				$prompt   = sanitize_textarea_field( $params['prompt'] ?? '' );
				$model    = sanitize_text_field( $params['model'] ?? '' );

				if ( empty( $name ) ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Collection or theme name is required.' ] );
				}

				$settings = Exacoat_Core::get_settings();
				$is_gemini = ( stripos( $provider, 'gemini' ) !== false );
				$start = microtime( true );

				if ( $is_gemini ) {
					$api_key = defined( 'EXACOAT_GEMINI_API_KEY' ) ? EXACOAT_GEMINI_API_KEY : ( defined( 'AM_GEMINI_API_KEY' ) ? AM_GEMINI_API_KEY : ( defined( 'GEMINI_API_KEY' ) ? GEMINI_API_KEY : ( getenv( 'EXACOAT_GEMINI_API_KEY' ) ?: ( getenv( 'AM_GEMINI_API_KEY' ) ?: ( $settings['gemini_api_key'] ?? '' ) ) ) ) );
					$gemini_model = $model ?: ( $settings['gemini_model'] ?? 'gemini-2.5-flash' );

					if ( empty( $api_key ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'Gemini API key not configured on server.' ] );
					}

					$full_prompt = ( $prompt ? $prompt . "\n\n" : '' ) . "Collection or series name: \"{$name}\"";
					$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode( $gemini_model ) . ':generateContent?key=' . rawurlencode( $api_key );
					$resp = wp_remote_post( $url, [
						'headers' => [ 'Content-Type' => 'application/json' ],
						'body'    => wp_json_encode( [
							'contents' => [
								[ 'role' => 'user', 'parts' => [ [ 'text' => $full_prompt ] ] ],
							],
						] ),
						'timeout' => 30,
					] );

					$latency = round( ( microtime( true ) - $start ) * 1000 );
					if ( is_wp_error( $resp ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $resp->get_error_message(), 'latency_ms' => $latency ] );
					}

					$body = json_decode( wp_remote_retrieve_body( $resp ), true );
					$text = $body['candidates'][0]['content']['parts'][0]['text'] ?? '';
					if ( empty( $text ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $body['error']['message'] ?? 'No text generated by Gemini', 'latency_ms' => $latency ] );
					}

					return rest_ensure_response( [
						'success'     => true,
						'text'        => $text,
						'description' => $text,
						'model_used'  => $gemini_model,
						'latency_ms'  => $latency,
					] );
				} else {
					$api_key = defined( 'EXACOAT_OPENAI_API_KEY' ) ? EXACOAT_OPENAI_API_KEY : ( defined( 'AM_OPENAI_API_KEY' ) ? AM_OPENAI_API_KEY : ( defined( 'OPENAI_API_KEY' ) ? OPENAI_API_KEY : ( getenv( 'EXACOAT_OPENAI_API_KEY' ) ?: ( getenv( 'AM_OPENAI_API_KEY' ) ?: ( $settings['openai_api_key'] ?? '' ) ) ) ) );
					$openai_model = $model ?: ( $settings['openai_model'] ?? 'gpt-4o-mini' );

					if ( empty( $api_key ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'OpenAI API key not configured on server.' ] );
					}

					$messages = [];
					if ( ! empty( $prompt ) ) {
						$messages[] = [ 'role' => 'system', 'content' => $prompt ];
					}
					$messages[] = [ 'role' => 'user', 'content' => "Collection or series name: \"{$name}\"" ];

					$is_reasoning_or_gpt5 = (bool) preg_match( '/^(o[0-9]|gpt-5)/i', preg_replace( '/^openai\//', '', $openai_model ) );
					$body_args = [
						'model'    => $openai_model,
						'messages' => $messages,
					];
					if ( ! $is_reasoning_or_gpt5 ) {
						$body_args['temperature'] = 0.7;
					}

					$resp = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [
						'headers' => [
							'Content-Type'  => 'application/json',
							'Authorization' => 'Bearer ' . $api_key,
						],
						'body'    => wp_json_encode( $body_args ),
						'timeout' => 30,
					] );

					// Auto-retry without temperature if rejected due to model parameter restrictions
					if ( ! is_wp_error( $resp ) ) {
						$check_body = json_decode( wp_remote_retrieve_body( $resp ), true );
						if ( isset( $check_body['error']['message'] ) && stripos( $check_body['error']['message'], 'temperature' ) !== false ) {
							unset( $body_args['temperature'] );
							$resp = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [
								'headers' => [
									'Content-Type'  => 'application/json',
									'Authorization' => 'Bearer ' . $api_key,
								],
								'body'    => wp_json_encode( $body_args ),
								'timeout' => 30,
							] );
						}
					}

					$latency = round( ( microtime( true ) - $start ) * 1000 );
					if ( is_wp_error( $resp ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $resp->get_error_message(), 'latency_ms' => $latency ] );
					}

					$body = json_decode( wp_remote_retrieve_body( $resp ), true );
					$text = $body['choices'][0]['message']['content'] ?? '';
					if ( empty( $text ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $body['error']['message'] ?? 'No text generated by OpenAI', 'latency_ms' => $latency ] );
					}

					return rest_ensure_response( [
						'success'     => true,
						'text'        => $text,
						'description' => $text,
						'model_used'  => $openai_model,
						'latency_ms'  => $latency,
					] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Product SEO & Short Description Read Endpoint
		$register( '/product/seo', [
			'methods'             => 'GET',
			'callback'            => function( WP_REST_Request $request ) {
				$product_id = (int) $request->get_param( 'product_id' );
				if ( empty( $product_id ) ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Product ID is required.' ] );
				}

				$post = get_post( $product_id );
				if ( ! $post ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Product not found.' ] );
				}

				$short_desc  = $post->post_excerpt;
				$yoast_title = get_post_meta( $product_id, '_yoast_wpseo_title', true );
				$rm_title    = get_post_meta( $product_id, 'rank_math_title', true );
				$yoast_desc  = get_post_meta( $product_id, '_yoast_wpseo_metadesc', true );
				$rm_desc     = get_post_meta( $product_id, 'rank_math_description', true );
				$yoast_kw    = get_post_meta( $product_id, '_yoast_wpseo_focuskw', true );
				$rm_kw       = get_post_meta( $product_id, 'rank_math_focus_keyword', true );

				return rest_ensure_response( [
					'success'           => true,
					'product_id'        => $product_id,
					'name'              => $post->post_title,
					'slug'              => $post->post_name,
					'short_description' => (string) $short_desc,
					'seo_title'         => (string) ( $yoast_title ?: ( $rm_title ?: '' ) ),
					'seo_description'   => (string) ( $yoast_desc ?: ( $rm_desc ?: '' ) ),
					'focus_keyword'     => (string) ( $yoast_kw ?: ( $rm_kw ?: '' ) ),
				] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Product SEO & Short Description Update Endpoint
		$register( '/product/seo', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params     = $request->get_json_params() ?: $request->get_params();
				$product_id = (int) ( $params['product_id'] ?? 0 );
				if ( empty( $product_id ) ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Product ID is required.' ] );
				}

				$post = get_post( $product_id );
				if ( ! $post ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Product not found.' ] );
				}

				$short_desc = (string) ( $params['short_description'] ?? '' );
				$seo_title  = sanitize_text_field( (string) ( $params['seo_title'] ?? '' ) );
				$seo_desc   = sanitize_textarea_field( (string) ( $params['seo_description'] ?? '' ) );
				$focus_kw   = sanitize_text_field( (string) ( $params['focus_keyword'] ?? '' ) );

				// Update post excerpt in wp_posts
				wp_update_post( [
					'ID'           => $product_id,
					'post_excerpt' => $short_desc,
				] );

				// Update Yoast and Rank Math metadata
				update_post_meta( $product_id, '_yoast_wpseo_title', $seo_title );
				update_post_meta( $product_id, 'rank_math_title', $seo_title );

				update_post_meta( $product_id, '_yoast_wpseo_metadesc', $seo_desc );
				update_post_meta( $product_id, 'rank_math_description', $seo_desc );

				update_post_meta( $product_id, '_yoast_wpseo_focuskw', $focus_kw );
				update_post_meta( $product_id, 'rank_math_focus_keyword', $focus_kw );

				// Trigger storefront revalidation if available
				if ( class_exists( 'Exacoat_Configurator_Engine' ) && method_exists( 'Exacoat_Configurator_Engine', 'trigger_storefront_revalidation' ) ) {
					Exacoat_Configurator_Engine::trigger_storefront_revalidation( [ 'slug' => $post->post_name ] );
				}

				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'info', 'seo_manager', sprintf( 'Updated SEO & Short description for product #%d (%s)', $product_id, $post->post_title ) );
				}

				return rest_ensure_response( [
					'success'           => true,
					'product_id'        => $product_id,
					'short_description' => $short_desc,
					'seo_title'         => $seo_title,
					'seo_description'   => $seo_desc,
					'focus_keyword'     => $focus_kw,
					'message'           => 'Product SEO and Short Description saved successfully.',
				] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Product AI SEO & Short Description Generator Endpoint
		$register( '/product/generate-seo', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params   = $request->get_json_params() ?: $request->get_params();
				$name     = sanitize_text_field( $params['name'] ?? '' );
				$category = sanitize_text_field( $params['category'] ?? 'Skins' );
				$provider = sanitize_text_field( $params['provider'] ?? 'gemini' );
				$model    = sanitize_text_field( $params['model'] ?? '' );

				if ( empty( $name ) ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Product or device name is required.' ] );
				}

				$clean_name = trim( preg_replace( '/\s+(skins?|wraps?|skin & wrap|skins & wraps)$/i', '', $name ) );
				if ( empty( $clean_name ) ) {
					$clean_name = $name;
				}

				$settings = Exacoat_Core::get_settings();
				$is_gemini = ( stripos( $provider, 'gemini' ) !== false );
				$start = microtime( true );

				$system_instruction = "You are the lead copywriter and brand voice specialist for Exacoat (exacoat.com).\n"
					. "Exacoat crafts precision-cut device skins and wraps that solve the everyday physical flaws of modern hardware with tactile grip, zero-bulk scratch defense, and clean personality.\n\n"
					. "Target Product:\n"
					. "- Device Name: \"{$clean_name}\"\n"
					. "- Category: \"{$category}\"\n\n"
					. "Brand Voice and Copywriting Rules:\n"
					. "- Witty, sharp, observational, and lifestyle-first. Write like a clever industrial design studio with dry humor, never like a dry spec sheet or instruction manual.\n"
					. "- Call out the specific real-world hardware weakness of \"{$clean_name}\":\n"
					. "  * iPhone Pro / Pro Max: notorious fingerprint magnet rails and glass, slippery frosted backs that slide off couch cushions, oversized camera bumps catching table grit, and looking identical to every other phone on the table.\n"
					. "  * Standard / Air / Plus iPhones: smudge-prone glass, slippery edges, and camera rings that chip the first time they share a pocket with keys.\n"
					. "  * MacBook Air / Pro: anodized aluminum (especially dark finishes) that looks immaculate in the keynote and collects every palm smudge five minutes out of the box, backpack zipper scratches on the lid, and looking like five other laptops at the coffee shop.\n"
					. "  * iPad & Magic Keyboard: soft-touch keyboard covers that scuff and stain on café tables, and bare aluminum backs that scratch the second you set them down.\n"
					. "  * Samsung Galaxy / Fold / Flip: slick matte glass that feels like wet soap in one hand, sharp corners, or narrow rails vulnerable to pocket grit.\n"
					. "  * Gaming Consoles & Handhelds: glossy plastic that scratches just from dusting it, or slick handheld grips during long sessions.\n"
					. "  * Accessories (AirPods, Chargers, Pencils): glossy white plastic that scuffs in your pocket on day one and gets mixed up with everyone else's.\n"
					. "- Example tone for short_description: \"Fresh out of the box, the {$clean_name} is part flagship hardware, part fingerprint magnet, and far too eager to slide off the couch. Wrap it in a tactile finish that locks in your grip, shrugs off pocket keys, and keeps the factory glass underneath untouched.\"\n"
					. "- STRICTLY NEVER say '3M' or name manufacturer brands.\n"
					. "- Do NOT be technical or explanatory: NEVER say '0.2mm', 'ultra-slim profile', 'vinyl film', or 'adhesive backing'.\n"
					. "- Strictly NO exclamation marks.\n"
					. "- Strictly NO em dashes of any kind (do not use long dashes '—' or double hyphens '--'). Use commas or periods instead.\n"
					. "- Strictly NO generic AI marketing words ('elevate', 'revolutionary', 'unleash', 'game-changer', 'ultimate armor', 'unparalleled', 'seamless').\n\n"
					. "Output Requirement:\n"
					. "Return ONLY a valid JSON object with the following four keys (no markdown formatting, no conversational text):\n"
					. "{\n"
					. "  \"seo_title\": \"{$clean_name} Skin & Wrap | Exacoat\",\n"
					. "  \"seo_description\": \"Witty, natural Google search snippet (120 to 155 chars) calling out smudges or scratches and how Exacoat wraps add grip and zero-bulk protection. Zero em dashes, never mention 3M.\",\n"
					. "  \"focus_keyword\": \"{$clean_name} skin\",\n"
					. "  \"short_description\": \"2 to 3 witty, lifestyle-first sentences (35 to 55 words) poking fun at the {$clean_name}'s real-world weakness (fingerprints, slipperiness, scratches) and solving it with tactile grip and clean style.\"\n"
					. "}";

				$sanitize_seo_fields = function( array $data ): array {
					foreach ( [ 'seo_title', 'seo_description', 'short_description', 'focus_keyword' ] as $k ) {
						if ( isset( $data[ $k ] ) && is_string( $data[ $k ] ) ) {
							$val = preg_replace( '/!+/', '.', $data[ $k ] );
							$val = preg_replace( '/[—–]|--/', ', ', $val );
							$val = preg_replace( '/\b3M\b/i', 'premium', $val );
							$val = preg_replace( '/\s*0\.2\s*mm\s*/i', ' ', $val );
							$data[ $k ] = trim( preg_replace( '/\s{2,}/', ' ', $val ) );
						}
					}
					return $data;
				};

				if ( $is_gemini ) {
					$api_key = defined( 'EXACOAT_GEMINI_API_KEY' ) ? EXACOAT_GEMINI_API_KEY : ( defined( 'AM_GEMINI_API_KEY' ) ? AM_GEMINI_API_KEY : ( defined( 'GEMINI_API_KEY' ) ? GEMINI_API_KEY : ( getenv( 'EXACOAT_GEMINI_API_KEY' ) ?: ( getenv( 'AM_GEMINI_API_KEY' ) ?: ( $settings['gemini_api_key'] ?? '' ) ) ) ) );
					$gemini_model = $model ?: ( $settings['gemini_model'] ?? 'gemini-2.5-flash' );

					if ( empty( $api_key ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'Gemini API key not configured on server.' ] );
					}

					$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode( $gemini_model ) . ':generateContent?key=' . rawurlencode( $api_key );
					$resp = wp_remote_post( $url, [
						'headers' => [ 'Content-Type' => 'application/json' ],
						'body'    => wp_json_encode( [
							'contents' => [
								[
									'role'  => 'user',
									'parts' => [ [ 'text' => $system_instruction ] ],
								],
							],
							'generationConfig' => [
								'response_mime_type' => 'application/json',
								'temperature'        => 0.7,
							],
						] ),
						'timeout' => 30,
					] );

					$latency = round( ( microtime( true ) - $start ) * 1000 );
					if ( is_wp_error( $resp ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $resp->get_error_message(), 'latency_ms' => $latency ] );
					}

					$body = json_decode( wp_remote_retrieve_body( $resp ), true );
					$text = $body['candidates'][0]['content']['parts'][0]['text'] ?? '';
					$parsed = json_decode( trim( $text ), true );

					if ( ! is_array( $parsed ) || empty( $parsed['seo_title'] ) ) {
						$clean_json = preg_replace( '/^```(?:json)?\s*|\s*```$/i', '', trim( $text ) );
						$parsed = json_decode( $clean_json, true );
					}

					if ( is_array( $parsed ) && ! empty( $parsed['seo_title'] ) ) {
						$parsed = $sanitize_seo_fields( $parsed );
						return rest_ensure_response( [
							'success'    => true,
							'data'       => $parsed,
							'model_used' => $gemini_model,
							'latency_ms' => $latency,
						] );
					}

					return rest_ensure_response( [ 'success' => false, 'message' => 'Failed to parse AI output as JSON.', 'raw' => $text, 'latency_ms' => $latency ] );
				} else {
					$api_key = defined( 'EXACOAT_OPENAI_API_KEY' ) ? EXACOAT_OPENAI_API_KEY : ( defined( 'AM_OPENAI_API_KEY' ) ? AM_OPENAI_API_KEY : ( defined( 'OPENAI_API_KEY' ) ? OPENAI_API_KEY : ( getenv( 'EXACOAT_OPENAI_API_KEY' ) ?: ( getenv( 'AM_OPENAI_API_KEY' ) ?: ( $settings['openai_api_key'] ?? '' ) ) ) ) );
					$openai_model = $model ?: ( $settings['openai_model'] ?? 'gpt-4o-mini' );

					if ( empty( $api_key ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'OpenAI API key not configured on server.' ] );
					}

					$is_reasoning_or_gpt5 = (bool) preg_match( '/^(o[0-9]|gpt-5)/i', preg_replace( '/^openai\//', '', $openai_model ) );
					$body_args = [
						'model'           => $openai_model,
						'messages'        => [
							[ 'role' => 'user', 'content' => $system_instruction ],
						],
						'response_format' => [ 'type' => 'json_object' ],
					];
					if ( ! $is_reasoning_or_gpt5 ) {
						$body_args['temperature'] = 0.7;
					}

					$resp = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [
						'headers' => [
							'Content-Type'  => 'application/json',
							'Authorization' => 'Bearer ' . $api_key,
						],
						'body'    => wp_json_encode( $body_args ),
						'timeout' => 30,
					] );

					// Auto-retry without temperature if rejected due to model parameter restrictions
					if ( ! is_wp_error( $resp ) ) {
						$check_body = json_decode( wp_remote_retrieve_body( $resp ), true );
						if ( isset( $check_body['error']['message'] ) && stripos( $check_body['error']['message'], 'temperature' ) !== false ) {
							unset( $body_args['temperature'] );
							$resp = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [
								'headers' => [
									'Content-Type'  => 'application/json',
									'Authorization' => 'Bearer ' . $api_key,
								],
								'body'    => wp_json_encode( $body_args ),
								'timeout' => 30,
							] );
						}
					}

					$latency = round( ( microtime( true ) - $start ) * 1000 );
					if ( is_wp_error( $resp ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $resp->get_error_message(), 'latency_ms' => $latency ] );
					}

					$body = json_decode( wp_remote_retrieve_body( $resp ), true );
					if ( isset( $body['error']['message'] ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $body['error']['message'], 'latency_ms' => $latency ] );
					}

					$text = $body['choices'][0]['message']['content'] ?? '';
					$parsed = json_decode( trim( $text ), true );

					if ( is_array( $parsed ) && ! empty( $parsed['seo_title'] ) ) {
						$parsed = $sanitize_seo_fields( $parsed );
						return rest_ensure_response( [
							'success'    => true,
							'data'       => $parsed,
							'model_used' => $openai_model,
							'latency_ms' => $latency,
						] );
					}

					return rest_ensure_response( [ 'success' => false, 'message' => 'Failed to parse OpenAI JSON output.', 'raw' => $text, 'latency_ms' => $latency ] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Universal CORS-free Image Proxy
		$handle_image_proxy = function( WP_REST_Request $request ) {
			$product_id = (int) $request->get_param( 'product_id' );
			$url        = (string) $request->get_param( 'url' );
			if ( ! empty( $url ) && filter_var( $url, FILTER_VALIDATE_URL ) ) {
				$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
				$allowed_hosts = [ 'exacoat.com', 'www.exacoat.com', 'cms.exacoat.com', 'media.exacoat.com', 'staging.exacoat.com' ];
				if ( ! in_array( $host, $allowed_hosts, true ) ) {
					return new WP_REST_Response( [ 'success' => false, 'error' => 'Image host is not allowed.' ], 400 );
				}
			}

			$filepath = '';

			if ( $product_id > 0 && empty( $url ) ) {
				$thumb_id = get_post_thumbnail_id( $product_id );
				if ( $thumb_id ) {
					$filepath = (string) get_attached_file( $thumb_id );
				}
			}

			if ( empty( $filepath ) || ! file_exists( $filepath ) ) {
				if ( ! empty( $url ) ) {
					$upload_dir = wp_upload_dir();
					if ( preg_match( '#/wp-content/uploads/(.+)$#i', $url, $matches ) ) {
						$clean_rel = ltrim( parse_url( $matches[1], PHP_URL_PATH ) ?: $matches[1], '/' );
						$candidate = $upload_dir['basedir'] . '/' . $clean_rel;
						if ( file_exists( $candidate ) ) {
							$filepath = $candidate;
						}
					}
					if ( empty( $filepath ) || ! file_exists( $filepath ) ) {
						$rel = str_replace( $upload_dir['baseurl'], '', $url );
						$candidate = $upload_dir['basedir'] . $rel;
						if ( file_exists( $candidate ) ) {
							$filepath = $candidate;
						}
					}
					if ( empty( $filepath ) || ! file_exists( $filepath ) ) {
						$candidate_filename = wp_basename( $clean_rel ?: parse_url( $url, PHP_URL_PATH ) );
						if ( ! empty( $candidate_filename ) ) {
							if ( class_exists( 'Exacoat_Store_Enhancements' ) && method_exists( 'Exacoat_Store_Enhancements', 'locate_physical_upload' ) ) {
								$resolved = Exacoat_Store_Enhancements::locate_physical_upload( $candidate_filename, $clean_rel ?? '', $upload_dir['basedir'] );
								if ( ! empty( $resolved ) ) {
									$filepath = $resolved;
								}
							} else {
								$flat_candidate = $upload_dir['basedir'] . '/' . $candidate_filename;
								if ( file_exists( $flat_candidate ) ) {
									$filepath = $flat_candidate;
								}
							}
						}
					}
				}
			}

			if ( ! empty( $filepath ) && file_exists( $filepath ) ) {
				$mime = wp_check_filetype( $filepath )['type'] ?: 'image/jpeg';
				$data = file_get_contents( $filepath );

				header( 'Content-Type: ' . $mime );
				header( 'Access-Control-Allow-Origin: *' );
				header( 'Access-Control-Allow-Methods: GET, OPTIONS' );
				header( 'Access-Control-Allow-Headers: *' );
				header( 'Cache-Control: public, max-age=31536000, immutable' );
				echo $data;
				exit;
			}

			// Remote fetch fallback
			if ( ! empty( $url ) && filter_var( $url, FILTER_VALIDATE_URL ) ) {
				$response = wp_safe_remote_get( $url, [ 'timeout' => 30, 'limit_response_size' => 25 * MB_IN_BYTES ] );
				if ( ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response ) ) {
					$content_type = wp_remote_retrieve_header( $response, 'content-type' ) ?: 'image/jpeg';
					$body         = wp_remote_retrieve_body( $response );

					header( 'Content-Type: ' . $content_type );
					header( 'Access-Control-Allow-Origin: *' );
					header( 'Access-Control-Allow-Methods: GET, OPTIONS' );
					header( 'Access-Control-Allow-Headers: *' );
					header( 'Cache-Control: public, max-age=86400' );
					echo $body;
					exit;
				}
			}

			return new WP_REST_Response( [ 'success' => false, 'error' => 'Image file not found on server' ], 404 );
		};

		$register( '/image-proxy', [
			'methods'             => [ 'GET' ],
			'callback'            => $handle_image_proxy,
			'permission_callback' => '__return_true',
		] );

		// Product Collection Management Endpoints
		$register( '/collections/create', [
			'methods'             => [ 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				try {
					$params = $request->get_json_params() ?: $request->get_params();
					$name = trim( sanitize_text_field( $params['name'] ?? $params['collection_name'] ?? '' ) );
					$slug = trim( sanitize_title( $params['slug'] ?? $name ) );

					if ( empty( $name ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'Collection name is required' ] );
					}

					$taxonomy = taxonomy_exists( 'product_cat' ) ? 'product_cat' : 'category';
					$existing = term_exists( $slug, $taxonomy ) ?: term_exists( $name, $taxonomy );
					if ( $existing ) {
						$term_id = is_array( $existing ) ? (int) $existing['term_id'] : (int) $existing;
						return rest_ensure_response( [
							'success' => true,
							'term_id' => $term_id,
							'name'    => $name,
							'slug'    => $slug,
							'message' => "Collection '{$name}' already exists.",
						] );
					}

					$inserted = wp_insert_term( $name, $taxonomy, [ 'slug' => $slug ] );
					if ( is_wp_error( $inserted ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $inserted->get_error_message() ] );
					}

					$term_id = (int) $inserted['term_id'];
					return rest_ensure_response( [
						'success' => true,
						'term_id' => $term_id,
						'name'    => $name,
						'slug'    => $slug,
						'message' => "Collection '{$name}' created in WordPress.",
					] );
				} catch ( Throwable $e ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Create collection error: ' . $e->getMessage() ] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/collections/rename', [
			'methods'             => [ 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				try {
					$params = $request->get_json_params() ?: $request->get_params();
					$old_name = trim( sanitize_text_field( $params['old_name'] ?? '' ) );
					$new_name = trim( sanitize_text_field( $params['new_name'] ?? '' ) );
					$description = sanitize_textarea_field( $params['description'] ?? '' );

					if ( empty( $old_name ) || empty( $new_name ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'Old and new collection names are required.' ] );
					}

					$taxonomy = taxonomy_exists( 'product_cat' ) ? 'product_cat' : 'category';
					$term = get_term_by( 'name', $old_name, $taxonomy ) ?: get_term_by( 'slug', sanitize_title( $old_name ), $taxonomy );
					if ( ! $term || is_wp_error( $term ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => "Collection '{$old_name}' not found." ] );
					}

					$args = [ 'name' => $new_name, 'slug' => sanitize_title( $new_name ) ];
					if ( ! empty( $description ) ) {
						$args['description'] = $description;
					}
					$updated = wp_update_term( $term->term_id, $taxonomy, $args );
					if ( is_wp_error( $updated ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => $updated->get_error_message() ] );
					}

					return rest_ensure_response( [
						'success' => true,
						'term_id' => $term->term_id,
						'name'    => $new_name,
						'slug'    => sanitize_title( $new_name ),
						'message' => "Collection renamed from '{$old_name}' to '{$new_name}'.",
					] );
				} catch ( Throwable $e ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Rename collection error: ' . $e->getMessage() ] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/collections/delete', [
			'methods'             => [ 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				try {
					$params = $request->get_json_params() ?: $request->get_params();
					$collection_name = trim( sanitize_text_field( $params['collection_name'] ?? $params['name'] ?? '' ) );

					if ( empty( $collection_name ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => 'Collection name is required.' ] );
					}

					$taxonomy = taxonomy_exists( 'product_cat' ) ? 'product_cat' : 'category';
					$term = get_term_by( 'name', $collection_name, $taxonomy ) ?: get_term_by( 'slug', sanitize_title( $collection_name ), $taxonomy );
					if ( ! $term || is_wp_error( $term ) ) {
						return rest_ensure_response( [ 'success' => false, 'message' => "Collection '{$collection_name}' not found." ] );
					}

					$deleted = wp_delete_term( $term->term_id, $taxonomy );
					return rest_ensure_response( [
						'success' => ! empty( $deleted ),
						'message' => ! empty( $deleted ) ? "Collection '{$collection_name}' deleted." : "Failed to delete collection '{$collection_name}'.",
					] );
				} catch ( Throwable $e ) {
					return rest_ensure_response( [ 'success' => false, 'message' => 'Delete collection error: ' . $e->getMessage() ] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Cloudflare R2 / Storage Sync Batch
		$register( '/vault/drime/sync-batch', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				try {
					$params    = $request->get_json_params() ?: $request->get_params();
					$offset    = max( 0, intval( $params['offset'] ?? 0 ) );
					$limit     = max( 1, min( 10, intval( $params['limit'] ?? 2 ) ) );
					$test_mode = ! empty( $params['test_mode'] );

					if ( $test_mode ) {
						$limit = 2;
					}

					if ( ! class_exists( 'Artmatter_R2' ) || ! class_exists( 'Artmatter_Drime' ) ) {
						return rest_ensure_response( [
							'success' => false,
							'message' => 'Storage sync classes not loaded',
						] );
					}

					$all_objects = Artmatter_R2::list_objects();
					$total       = count( $all_objects );

					if ( $total === 0 ) {
						return rest_ensure_response( [
							'success'       => false,
							'message'       => 'No files found in storage bucket to sync.',
							'total_objects' => 0,
						] );
					}

					$slice = array_slice( $all_objects, $offset, $limit );
					$results = [];

					foreach ( $slice as $obj ) {
						$res = Artmatter_Drime::sync_file_from_r2( $obj['key'] );
						$results[] = [
							'key'      => $obj['key'],
							'size'     => $obj['size_fmt'],
							'success'  => $res['success'],
							'file_id'  => $res['file_id'] ?? null,
							'message'  => $res['message'] ?? 'Synced',
						];
					}

					$next_offset = $offset + count( $slice );
					$has_more    = ( ! $test_mode && $next_offset < $total );

					return rest_ensure_response( [
						'success'       => true,
						'total_objects' => $total,
						'processed'     => count( $slice ),
						'offset'        => $offset,
						'next_offset'   => $next_offset,
						'has_more'      => $has_more,
						'synced_files'  => $results,
						'test_mode'     => $test_mode,
					] );
				} catch ( Throwable $e ) {
					return rest_ensure_response( [
						'success' => false,
						'message' => 'Sync Batch Exception: ' . $e->getMessage(),
					] );
				}
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Native HTML Email Engine Endpoints
		$register( '/email/send', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params    = $request->get_json_params() ?: $request->get_params();
				$slug      = sanitize_key( $params['template_key'] ?? $params['template_slug'] ?? $params['slug'] ?? $params['event'] ?? '' );
				$recipient = sanitize_email( $params['recipient_email'] ?? $params['email'] ?? '' );
				$name      = sanitize_text_field( $params['recipient_name'] ?? $params['name'] ?? '' );
				$vars      = is_array( $params['variables'] ?? null ) ? $params['variables'] : ( is_array( $params['vars'] ?? null ) ? $params['vars'] : [] );

				if ( empty( $slug ) || empty( $recipient ) ) {
					return new WP_Error( 'missing_params', 'template_slug/template_key and recipient_email are required', [ 'status' => 400 ] );
				}

				$email_class = class_exists( 'Exacoat_Email_Engine' ) ? 'Exacoat_Email_Engine' : ( class_exists( 'Artmatter_Email_Engine' ) ? 'Artmatter_Email_Engine' : false );
				if ( $email_class ) {
					$result = $email_class::send_email( $slug, $recipient, $name, $vars );
					return rest_ensure_response( $result );
				}
				return rest_ensure_response( [ 'success' => false, 'message' => 'Email engine not available' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/email/preview', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => function( WP_REST_Request $request ) {
				$params = $request->get_json_params() ?: $request->get_params();
				$slug   = sanitize_key( $params['template_key'] ?? $params['template_slug'] ?? $params['slug'] ?? $params['event'] ?? '' );
				$vars   = is_array( $params['variables'] ?? null ) ? $params['variables'] : ( is_array( $params['vars'] ?? null ) ? $params['vars'] : [] );

				$email_class = class_exists( 'Exacoat_Email_Engine' ) ? 'Exacoat_Email_Engine' : ( class_exists( 'Artmatter_Email_Engine' ) ? 'Artmatter_Email_Engine' : false );
				if ( $email_class ) {
					$rendered = $email_class::render_html( $slug, $vars );
					if ( $request->get_param( 'raw' ) ) {
						header( 'Content-Type: text/html; charset=UTF-8' );
						echo $rendered['html'] ?? '';
						exit;
					}
					return rest_ensure_response( [
						'success' => true,
						'subject' => $rendered['subject'] ?? 'Email Preview',
						'html'    => $rendered['html'] ?? '',
					] );
				}
				return rest_ensure_response( [ 'success' => false, 'message' => 'Email engine not available' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// System Maintenance Endpoints
		$register( '/system/flush-permalinks', [
			'methods'             => 'POST',
			'callback'            => function() {
				flush_rewrite_rules();
				return rest_ensure_response( [ 'success' => true, 'message' => 'Permalinks and rewrite rules flushed successfully.' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/system/revert-media', [
			'methods'             => 'POST',
			'callback'            => function() {
				if ( class_exists( 'Exacoat_Store_Enhancements' ) ) {
					$res = Exacoat_Store_Enhancements::revert_assets_to_flat_uploads();
					return rest_ensure_response( $res );
				}
				return rest_ensure_response( [ 'success' => false, 'message' => 'Store enhancements module not available.' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/system/logs', [
			'methods'             => 'GET',
			'callback'            => function( WP_REST_Request $request ) {
				$params       = $request->get_params();
				$logger_class = class_exists( 'Exacoat_Logger' ) ? 'Exacoat_Logger' : ( class_exists( 'Artmatter_Logger' ) ? 'Artmatter_Logger' : false );
				return rest_ensure_response( $logger_class ? $logger_class::get_logs( $params ) : [] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/system/clear-logs', [
			'methods'             => 'POST',
			'callback'            => function() {
				$logger_class = class_exists( 'Exacoat_Logger' ) ? 'Exacoat_Logger' : ( class_exists( 'Artmatter_Logger' ) ? 'Artmatter_Logger' : false );
				if ( $logger_class ) {
					$logger_class::clear_logs();
				}
				return rest_ensure_response( [ 'success' => true, 'message' => 'All system event logs cleared.' ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/system/purge-logs', [
			'methods'             => 'POST',
			'callback'            => function( WP_REST_Request $request ) {
				$params       = $request->get_json_params() ?: $request->get_params();
				$days         = intval( $params['days'] ?? 7 );
				$logger_class = class_exists( 'Exacoat_Logger' ) ? 'Exacoat_Logger' : ( class_exists( 'Artmatter_Logger' ) ? 'Artmatter_Logger' : false );
				$purged       = $logger_class ? $logger_class::purge_old_logs( $days ) : 0;
				return rest_ensure_response( [ 'success' => true, 'message' => "Purged {$purged} old event logs." ] );
			},
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Order Management & Fulfillment Routes
		$register( '/orders', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ 'Exacoat_Order_Manager', 'get_orders' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/orders/analytics', [
			'methods'             => 'GET',
			'callback'            => [ 'Exacoat_Order_Manager', 'get_sales_analytics' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/orders/(?P<id>\d+)', [
			'methods'             => [ 'GET' ],
			'callback'            => [ 'Exacoat_Order_Manager', 'get_single_order' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/orders/(?P<id>\d+)/status', [
			'methods'             => [ 'POST' ],
			'callback'            => [ 'Exacoat_Order_Manager', 'update_order_status' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/orders/(?P<id>\d+)/fulfill', [
			'methods'             => [ 'POST' ],
			'callback'            => [ 'Exacoat_Order_Manager', 'fulfill_order' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/orders/(?P<id>\d+)/notes', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ 'Exacoat_Order_Manager', 'handle_order_notes' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/orders/(?P<id>\d+)/refund', [
			'methods'             => [ 'POST' ],
			'callback'            => [ 'Exacoat_Order_Manager', 'process_refund' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		// Staff and Team Role Management Routes
		$register( '/team', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'rest_get_team_members' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/team', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_create_team_member' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/team/(?P<id>\d+)/role', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'rest_update_team_user_role' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );

		$register( '/team/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'rest_delete_team_member' ],
			'permission_callback' => [ __CLASS__, 'verify_bridge_permission' ],
		] );
	}

	public function rest_get_health_status( WP_REST_Request $request ) {
		global $wp_version;

		$response = [
			'status'           => 'online',
			'plugin_version'   => defined( 'EXACOAT_CORE_VERSION' ) ? EXACOAT_CORE_VERSION : '0.0.8',
			'site_name'        => get_bloginfo( 'name' ),
			'site_url'         => home_url(),
			'wp_version'       => $wp_version,
			'wc_version'       => class_exists( 'WooCommerce' ) ? WC()->version : 'Not Installed',
			'php_version'      => PHP_VERSION,
			'active_modules'   => [
				'shipping_tracker'  => (bool) self::get_setting( 'enable_shipping_tracker', 1 ),
				'order_manager'     => (bool) self::get_setting( 'enable_order_manager', 1 ),
				'review_manager'    => (bool) self::get_setting( 'enable_review_manager', 1 ),
			],
			'timestamp'        => current_time( 'mysql' ),
		];

		return rest_ensure_response( $response );
	}

	public function rest_handle_ping( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		return rest_ensure_response( [
			'success'   => true,
			'message'   => 'Pong from Exacoat Core WordPress master plugin',
			'received'  => $params,
			'timestamp' => current_time( 'mysql' ),
		] );
	}

	public function rest_submit_contact( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();

		// Silently accept bot submissions so the endpoint does not teach bots how to bypass the trap.
		if ( ! empty( $params['website'] ) ) {
			return rest_ensure_response( [ 'success' => true ] );
		}

		$name       = sanitize_text_field( $params['name'] ?? '' );
		$email      = sanitize_email( $params['email'] ?? '' );
		$topic      = sanitize_key( $params['topic'] ?? 'general' );
		$subject    = sanitize_text_field( $params['subject'] ?? '' );
		$order      = sanitize_text_field( $params['order_number'] ?? '' );
		$message    = sanitize_textarea_field( $params['message'] ?? '' );
		$started_at = absint( $params['started_at'] ?? 0 );
		$topics     = [ 'general', 'order', 'business', 'product', 'press' ];

		if ( ! in_array( $topic, $topics, true ) ) {
			$topic = 'general';
		}

		if ( mb_strlen( $name ) < 2 || mb_strlen( $name ) > 120 || ! is_email( $email ) ) {
			return new WP_Error( 'invalid_contact', 'Enter a valid name and email address.', [ 'status' => 400 ] );
		}

		if ( mb_strlen( $subject ) < 3 || mb_strlen( $subject ) > 160 || mb_strlen( $message ) < 10 || mb_strlen( $message ) > 5000 ) {
			return new WP_Error( 'invalid_message', 'Enter a subject and a message between 10 and 5,000 characters.', [ 'status' => 400 ] );
		}

		$now_ms = time() * 1000;
		if ( ! $started_at || $started_at > $now_ms || ( $now_ms - $started_at ) < 3000 || ( $now_ms - $started_at ) > 2 * HOUR_IN_SECONDS * 1000 ) {
			return new WP_Error( 'invalid_submission', 'Please refresh the page and try again.', [ 'status' => 400 ] );
		}

		$forwarded_ip = $request->get_header( 'X-Exacoat-Client-IP' ) ?: $request->get_header( 'X-Artmatter-Client-IP' );
		$remote_ip    = sanitize_text_field( $forwarded_ip ?: ( $_SERVER['REMOTE_ADDR'] ?? 'unknown' ) );
		$rate_key     = 'exacoat_contact_rate_' . md5( $remote_ip );
		$rate_count   = (int) get_transient( $rate_key );
		if ( $rate_count >= 5 ) {
			return new WP_Error( 'contact_rate_limited', 'Too many messages. Please try again later.', [ 'status' => 429 ] );
		}

		set_transient( $rate_key, $rate_count + 1, HOUR_IN_SECONDS );

		$topic_labels = [
			'general'  => 'General inquiry',
			'order'    => 'Order support',
			'business' => 'Business project',
			'product'  => 'Product question',
			'press'    => 'Press and partnership',
		];
		$topic_label = $topic_labels[ $topic ] ?? 'General inquiry';
		$email_title = sprintf( '[Contact] %s: %s', $topic_label, $subject );
		$rows        = [
			'Name'         => $name,
			'Email'        => $email,
			'Topic'        => $topic_label,
			'Order number' => $order ?: 'Not provided',
		];
		$details_html = '';
		foreach ( $rows as $label => $value ) {
			$details_html .= '<tr><td style="padding:8px 16px 8px 0;color:#71717a;vertical-align:top;white-space:nowrap;">' . esc_html( $label ) . '</td><td style="padding:8px 0;color:#f4f4f5;">' . esc_html( $value ) . '</td></tr>';
		}

		$html = '<div style="background:#08090b;color:#f4f4f5;padding:32px;font-family:Arial,sans-serif;line-height:1.6;">'
			. '<div style="max-width:680px;margin:0 auto;">'
			. '<p style="color:#f3aa18;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">New website contact</p>'
			. '<h1 style="font-size:28px;line-height:1.2;margin:12px 0 24px;">' . esc_html( $subject ) . '</h1>'
			. '<table role="presentation" style="border-collapse:collapse;margin-bottom:24px;">' . $details_html . '</table>'
			. '<div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:24px;white-space:pre-wrap;">' . nl2br( esc_html( $message ) ) . '</div>'
			. '</div></div>';

		$email_class = class_exists( 'Exacoat_Email_Engine' ) ? 'Exacoat_Email_Engine' : ( class_exists( 'Artmatter_Email_Engine' ) ? 'Artmatter_Email_Engine' : false );
		$result = $email_class ? $email_class::send_email( 'website_contact', 'support@exacoat.com', 'Exacoat Support', [
			'subject'    => $email_title,
			'htmlbody'   => $html,
			'reply_to'   => $email,
			'reply_name' => $name,
		] ) : [ 'success' => true ];

		if ( empty( $result['success'] ) ) {
			return new WP_Error( 'contact_delivery_failed', 'Your message could not be sent. Please contact support@exacoat.com directly.', [ 'status' => 502 ] );
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => 'Your message has been sent.',
		] );
	}

	public function rest_get_settings( WP_REST_Request $request ) {
		$settings = self::get_settings();
		$environment_values = [
			'gemini_api_key'        => defined( 'EXA_GEMINI_API_KEY' ) ? EXA_GEMINI_API_KEY : ( defined( 'AM_GEMINI_API_KEY' ) ? AM_GEMINI_API_KEY : ( defined( 'GEMINI_API_KEY' ) ? GEMINI_API_KEY : getenv( 'EXA_GEMINI_API_KEY' ) ) ),
			'openai_api_key'        => defined( 'EXA_OPENAI_API_KEY' ) ? EXA_OPENAI_API_KEY : ( defined( 'AM_OPENAI_API_KEY' ) ? AM_OPENAI_API_KEY : ( defined( 'OPENAI_API_KEY' ) ? OPENAI_API_KEY : getenv( 'EXA_OPENAI_API_KEY' ) ) ),
			'pushover_app_token'    => defined( 'AM_PUSHOVER_APP_TOKEN' ) ? AM_PUSHOVER_APP_TOKEN : getenv( 'AM_PUSHOVER_APP_TOKEN' ),
			'pushover_user_key'     => defined( 'AM_PUSHOVER_USER_KEY' ) ? AM_PUSHOVER_USER_KEY : getenv( 'AM_PUSHOVER_USER_KEY' ),
			'r2_account_id'         => defined( 'AM_R2_ACCOUNT_ID' ) ? AM_R2_ACCOUNT_ID : getenv( 'AM_R2_ACCOUNT_ID' ),
			'r2_bucket'             => defined( 'AM_R2_BUCKET' ) ? AM_R2_BUCKET : getenv( 'AM_R2_BUCKET' ),
			'r2_access_key'         => defined( 'AM_R2_ACCESS_KEY' ) ? AM_R2_ACCESS_KEY : getenv( 'AM_R2_ACCESS_KEY' ),
			'r2_secret_key'         => defined( 'AM_R2_SECRET_KEY' ) ? AM_R2_SECRET_KEY : getenv( 'AM_R2_SECRET_KEY' ),
			'cloudflare_zone_id'    => defined( 'EXA_CLOUDFLARE_ZONE_ID' ) ? EXA_CLOUDFLARE_ZONE_ID : ( defined( 'EXACOAT_CLOUDFLARE_ZONE_ID' ) ? EXACOAT_CLOUDFLARE_ZONE_ID : ( defined( 'AM_CLOUDFLARE_ZONE_ID' ) ? AM_CLOUDFLARE_ZONE_ID : ( defined( 'CLOUDFLARE_ZONE_ID' ) ? CLOUDFLARE_ZONE_ID : ( getenv( 'EXA_CLOUDFLARE_ZONE_ID' ) ?: ( getenv( 'EXACOAT_CLOUDFLARE_ZONE_ID' ) ?: getenv( 'AM_CLOUDFLARE_ZONE_ID' ) ) ) ) ) ),
			'cloudflare_api_token'  => defined( 'EXA_CLOUDFLARE_API_TOKEN' ) ? EXA_CLOUDFLARE_API_TOKEN : ( defined( 'EXACOAT_CLOUDFLARE_API_TOKEN' ) ? EXACOAT_CLOUDFLARE_API_TOKEN : ( defined( 'AM_CLOUDFLARE_API_TOKEN' ) ? AM_CLOUDFLARE_API_TOKEN : ( defined( 'CLOUDFLARE_API_TOKEN' ) ? CLOUDFLARE_API_TOKEN : ( getenv( 'EXA_CLOUDFLARE_API_TOKEN' ) ?: ( getenv( 'EXACOAT_CLOUDFLARE_API_TOKEN' ) ?: getenv( 'AM_CLOUDFLARE_API_TOKEN' ) ) ) ) ) ),
			'drime_access_token'     => defined( 'AM_DRIME_ACCESS_TOKEN' ) ? AM_DRIME_ACCESS_TOKEN : getenv( 'AM_DRIME_ACCESS_TOKEN' ),
			'drime_workspace_id'     => defined( 'AM_DRIME_WORKSPACE_ID' ) ? AM_DRIME_WORKSPACE_ID : getenv( 'AM_DRIME_WORKSPACE_ID' ),
			'drime_parent_folder_id' => defined( 'AM_DRIME_PARENT_FOLDER_ID' ) ? AM_DRIME_PARENT_FOLDER_ID : getenv( 'AM_DRIME_PARENT_FOLDER_ID' ),
			'supabase_service_role_key' => defined( 'AM_SUPABASE_SERVICE_ROLE_KEY' ) ? AM_SUPABASE_SERVICE_ROLE_KEY : getenv( 'AM_SUPABASE_SERVICE_ROLE_KEY' ),
		];
		foreach ( [ 'r2_account_id', 'r2_bucket', 'cloudflare_zone_id', 'drime_workspace_id', 'drime_parent_folder_id' ] as $public_environment_key ) {
			if ( ! empty( $environment_values[ $public_environment_key ] ) ) {
				$settings[ $public_environment_key ] = $environment_values[ $public_environment_key ];
			}
		}
		$secret_status = [];
		foreach ( $environment_values as $key => $environment_value ) {
			$secret_status[ $key ] = [
				'configured' => ! empty( $environment_value ) || ! empty( $settings[ $key ] ),
				'source'     => ! empty( $environment_value ) ? 'environment' : ( ! empty( $settings[ $key ] ) ? 'settings' : 'missing' ),
			];
		}
		foreach ( [ 'gemini_api_key', 'openai_api_key', 'r2_access_key', 'r2_secret_key', 'cloudflare_api_token', 'drime_access_token', 'drime_access_key', 'drime_secret_key', 'zeptomail_token', 'pushover_app_token', 'pushover_user_key', 'supabase_service_role_key', 'webhook_secret' ] as $secret_key ) {
			unset( $settings[ $secret_key ] );
		}

		if ( empty( $settings['currency_rates'] ) && class_exists( 'Exacoat_Store_Enhancements' ) ) {
			$settings['currency_rates'] = Exacoat_Store_Enhancements::get_currency_rates();
		}
		if ( ! isset( $settings['currency_global_markup'] ) ) {
			$settings['currency_global_markup'] = 1.15;
		}
		if ( ( empty( $settings['shipping_zones'] ) || empty( $settings['shipping_target_method_ids'] ) ) && class_exists( 'Exacoat_Store_Enhancements' ) ) {
			$ship_cfg = Exacoat_Store_Enhancements::get_shipping_config();
			if ( empty( $settings['shipping_zones'] ) ) {
				$settings['shipping_zones'] = $ship_cfg['zones'];
			}
			if ( empty( $settings['shipping_target_method_ids'] ) ) {
				$settings['shipping_target_method_ids'] = implode( ', ', $ship_cfg['target_method_ids'] );
			}
		}
		if ( empty( $settings['logistics_carriers'] ) && class_exists( 'Exacoat_Shipping_Tracker' ) ) {
			$settings['logistics_carriers'] = Exacoat_Shipping_Tracker::get_carrier_registry();
		}

		return rest_ensure_response( [
			'success'  => true,
			'settings' => $settings,
			'secret_status' => $secret_status,
		] );
	}

	public function rest_handle_currency_settings( WP_REST_Request $request ) {
		if ( $request->get_method() === 'POST' ) {
			$params = $request->get_json_params() ?: $request->get_params();
			$current = self::get_settings();

			if ( isset( $params['currency_rates'] ) && is_array( $params['currency_rates'] ) ) {
				$clean_rates = [];
				foreach ( $params['currency_rates'] as $code => $data ) {
					$clean_code = strtoupper( sanitize_text_field( $code ) );
					if ( empty( $clean_code ) ) continue;
					$clean_rates[ $clean_code ] = [
						'symbol'   => sanitize_text_field( $data['symbol'] ?? '$' ),
						'rate'     => floatval( $data['rate'] ?? 0 ),
						'rounding' => sanitize_text_field( $data['rounding'] ?? '9_end' ),
					];
				}
				$current['currency_rates'] = $clean_rates;
			}

			if ( isset( $params['currency_global_markup'] ) ) {
				$current['currency_global_markup'] = max( 1.0, floatval( $params['currency_global_markup'] ) );
			}

			update_option( 'exacoat_core_settings', $current );
			update_option( 'artmatter_core_settings', $current );
			self::clear_settings_cache();

			$rates = $current['currency_rates'] ?? ( class_exists( 'Exacoat_Store_Enhancements' ) ? Exacoat_Store_Enhancements::get_currency_rates() : [] );
			$markup = floatval( $current['currency_global_markup'] ?? 1.15 );

			return rest_ensure_response( [
				'success'                => true,
				'message'                => 'Currency settings saved successfully',
				'currency_rates'         => $rates,
				'currency_global_markup' => $markup,
			] );
		}

		$current = self::get_settings();
		$rates = $current['currency_rates'] ?? ( class_exists( 'Exacoat_Store_Enhancements' ) ? Exacoat_Store_Enhancements::get_currency_rates() : [] );
		$markup = floatval( $current['currency_global_markup'] ?? 1.15 );

		return rest_ensure_response( [
			'success'                => true,
			'currency_rates'         => $rates,
			'currency_global_markup' => $markup,
		] );
	}

	public function rest_handle_shipping_settings( WP_REST_Request $request ) {
		if ( $request->get_method() === 'POST' ) {
			$params = $request->get_json_params() ?: $request->get_params();
			$current = self::get_settings();

			if ( isset( $params['shipping_zones'] ) && is_array( $params['shipping_zones'] ) ) {
				$clean_zones = [];
				foreach ( $params['shipping_zones'] as $key => $zone ) {
					$clean_key = sanitize_key( $key );
					if ( empty( $clean_key ) ) continue;
					$clean_zones[ $clean_key ] = [
						'name'        => sanitize_text_field( $zone['name'] ?? ucfirst( $clean_key ) ),
						'countries'   => sanitize_text_field( $zone['countries'] ?? '' ),
						'currency'    => strtoupper( sanitize_text_field( $zone['currency'] ?? 'USD' ) ),
						'free'        => floatval( $zone['free'] ?? 0 ),
						'filter_text' => sanitize_text_field( $zone['filter_text'] ?? '' ),
					];
				}
				$current['shipping_zones'] = $clean_zones;
			}

			if ( isset( $params['shipping_target_method_ids'] ) ) {
				$current['shipping_target_method_ids'] = sanitize_text_field( $params['shipping_target_method_ids'] );
			}

			if ( isset( $params['logistics_carriers'] ) && is_array( $params['logistics_carriers'] ) ) {
				$clean_carriers = [];
				foreach ( $params['logistics_carriers'] as $key => $carrier ) {
					$clean_key = sanitize_key( $key );
					if ( empty( $clean_key ) ) continue;
					$clean_carriers[ $clean_key ] = [
						'name' => sanitize_text_field( $carrier['name'] ?? ucfirst( $clean_key ) ),
						'url'  => esc_url_raw( $carrier['url'] ?? '' ),
					];
				}
				$current['logistics_carriers'] = $clean_carriers;
			}

			update_option( 'exacoat_core_settings', $current );
			update_option( 'artmatter_core_settings', $current );
			self::clear_settings_cache();

			$ship_cfg = class_exists( 'Exacoat_Store_Enhancements' ) ? Exacoat_Store_Enhancements::get_shipping_config() : [ 'zones' => [], 'target_method_ids' => [] ];
			$carriers = class_exists( 'Exacoat_Shipping_Tracker' ) ? Exacoat_Shipping_Tracker::get_carrier_registry() : [];

			return rest_ensure_response( [
				'success'                    => true,
				'message'                    => 'Shipping settings saved successfully',
				'shipping_zones'             => $current['shipping_zones'] ?? $ship_cfg['zones'],
				'shipping_target_method_ids' => $current['shipping_target_method_ids'] ?? implode( ', ', $ship_cfg['target_method_ids'] ),
				'logistics_carriers'         => $current['logistics_carriers'] ?? $carriers,
			] );
		}

		$current  = self::get_settings();
		$ship_cfg = class_exists( 'Exacoat_Store_Enhancements' ) ? Exacoat_Store_Enhancements::get_shipping_config() : [ 'zones' => [], 'target_method_ids' => [] ];
		$carriers = class_exists( 'Exacoat_Shipping_Tracker' ) ? Exacoat_Shipping_Tracker::get_carrier_registry() : [];

		return rest_ensure_response( [
			'success'                    => true,
			'shipping_zones'             => $current['shipping_zones'] ?? $ship_cfg['zones'],
			'shipping_target_method_ids' => $current['shipping_target_method_ids'] ?? implode( ', ', $ship_cfg['target_method_ids'] ),
			'logistics_carriers'         => $current['logistics_carriers'] ?? $carriers,
		] );
	}

	public function rest_get_public_feelform_settings() {
		if ( ! class_exists( 'Artmatter_Feelform_3D' ) ) {
			return new WP_Error( 'feelform_unavailable', 'FeelForm settings are unavailable.', [ 'status' => 503 ] );
		}

		$response = rest_ensure_response( [
			'success'  => true,
			'settings' => Artmatter_Feelform_3D::get_options(),
		] );
		$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		return $response;
	}

	public function rest_save_settings( WP_REST_Request $request ) {
		$new_settings = $request->get_json_params() ?: $request->get_params();
		if ( empty( $new_settings ) || ! is_array( $new_settings ) ) {
			return new WP_Error( 'invalid_data', 'Settings payload must be an object', [ 'status' => 400 ] );
		}

		$current = self::get_settings();
		$secret_keys = [
			'gemini_api_key',
			'openai_api_key',
			'r2_secret_key',
			'r2_access_key',
			'cloudflare_api_token',
			'drime_access_token',
			'drime_secret_key',
			'zeptomail_token',
			'pushover_app_token',
			'pushover_user_key',
		];

		foreach ( $new_settings as $key => $val ) {
			if ( $val !== null ) {
				$clean_val = is_string( $val ) ? trim( $val ) : $val;
				if ( in_array( $key, $secret_keys, true ) && $clean_val === '' && ! empty( $current[ $key ] ) ) {
					continue;
				}
				$current[ sanitize_key( $key ) ] = $clean_val;
			}
		}

		$target_gemini_model = sanitize_text_field( $new_settings['gemini_model'] ?? $new_settings['ai_model'] ?? '' );
		if ( ! empty( $target_gemini_model ) ) {
			$current['gemini_model'] = $target_gemini_model;
			$current['ai_model']     = $target_gemini_model;
		}

		$target_openai_model = sanitize_text_field( $new_settings['openai_model'] ?? '' );
		if ( ! empty( $target_openai_model ) ) {
			$current['openai_model'] = $target_openai_model;
		}

		$target_r2_bucket = sanitize_text_field( $new_settings['r2_bucket_name'] ?? $new_settings['r2_bucket'] ?? '' );
		if ( ! empty( $target_r2_bucket ) ) {
			$current['r2_bucket_name'] = $target_r2_bucket;
			$current['r2_bucket']      = $target_r2_bucket;
		}

		update_option( 'exacoat_core_settings', $current );
		update_option( 'artmatter_core_settings', $current );
		self::clear_settings_cache();

		$saved_keys = implode( ', ', array_keys( $new_settings ) );
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'success', 'settings', "Remote Settings Update via Exacoat Manager ERP: [{$saved_keys}]", [ 'updated_keys' => array_keys( $new_settings ) ] );
		} elseif ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::log( 'success', 'settings', "Remote Settings Update via Exacoat Manager ERP: [{$saved_keys}]", [ 'updated_keys' => array_keys( $new_settings ) ] );
		}

		return rest_ensure_response( [
			'success'  => true,
			'message'  => 'Plugin settings saved successfully',
			'settings' => $current,
		] );
	}

	/**
	 * Retrieve WordPress staff accounts (administrators and shop managers)
	 */
	public function rest_get_team_members( WP_REST_Request $request ) {
		$wp_users = get_users( [
			'role__in' => [ 'administrator', 'shop_manager', 'manager', 'editor' ],
			'orderby'  => 'registered',
			'order'    => 'ASC',
		] );

		$members = [];
		foreach ( $wp_users as $user ) {
			$roles = (array) $user->roles;
			$role = 'manager';
			if ( in_array( 'administrator', $roles, true ) ) {
				$role = 'super_admin';
			} elseif ( in_array( 'shop_manager', $roles, true ) ) {
				$role = 'shop_manager';
			} elseif ( in_array( 'editor', $roles, true ) || in_array( 'manager', $roles, true ) ) {
				$role = 'manager';
			}

			$full_name = trim( $user->first_name . ' ' . $user->last_name );
			if ( empty( $full_name ) ) {
				$full_name = $user->display_name ?: $user->user_login;
			}

			$members[] = [
				'id'                 => (string) $user->ID,
				'email'              => $user->user_email,
				'full_name'          => $full_name,
				'role'               => $role,
				'wp_roles'           => array_values( $roles ),
				'avatar_url'         => get_avatar_url( $user->ID ),
				'created_at'         => $user->user_registered ? gmdate( 'c', strtotime( $user->user_registered ) ) : gmdate( 'c' ),
				'email_confirmed_at' => $user->user_registered ? gmdate( 'c', strtotime( $user->user_registered ) ) : gmdate( 'c' ),
				'last_sign_in_at'    => get_user_meta( $user->ID, '_last_login', true ) ?: ( get_user_meta( $user->ID, 'last_login', true ) ?: null ),
			];
		}

		return rest_ensure_response( [
			'success' => true,
			'users'   => $members,
			'total'   => count( $members ),
		] );
	}

	/**
	 * Update WordPress staff user role
	 */
	public function rest_update_team_user_role( WP_REST_Request $request ) {
		$user_id = (int) $request->get_param( 'id' );
		$params  = $request->get_json_params() ?: $request->get_params();
		$new_role = sanitize_key( $params['role'] ?? '' );

		$user = get_user_by( 'id', $user_id );
		if ( ! $user instanceof WP_User ) {
			return new WP_Error( 'user_not_found', 'WordPress user not found.', [ 'status' => 404 ] );
		}

		$wp_role = 'shop_manager';
		if ( 'super_admin' === $new_role ) {
			$wp_role = 'administrator';
		} elseif ( 'shop_manager' === $new_role ) {
			$wp_role = 'shop_manager';
		} elseif ( 'manager' === $new_role ) {
			$wp_role = 'shop_manager';
		}

		$user->set_role( $wp_role );

		return rest_ensure_response( [
			'success' => true,
			'message' => "WordPress user {$user->user_email} role updated to {$wp_role}.",
			'user_id' => $user_id,
			'role'    => $new_role,
			'wp_role' => $wp_role,
		] );
	}

	/**
	 * Create a new WordPress staff user account
	 */
	public function rest_create_team_member( WP_REST_Request $request ) {
		$params    = $request->get_json_params() ?: $request->get_params();
		$email     = sanitize_email( (string) ( $params['email'] ?? '' ) );
		$password  = (string) ( $params['password'] ?? '' );
		$full_name = sanitize_text_field( (string) ( $params['full_name'] ?? $params['fullName'] ?? '' ) );
		$role      = sanitize_key( (string) ( $params['role'] ?? 'shop_manager' ) );

		if ( ! $email || ! is_email( $email ) ) {
			return new WP_Error( 'invalid_email', 'A valid email address is required.', [ 'status' => 400 ] );
		}

		if ( strlen( $password ) < 8 ) {
			return new WP_Error( 'weak_password', 'Password must be at least 8 characters.', [ 'status' => 400 ] );
		}

		if ( email_exists( $email ) ) {
			return new WP_Error( 'email_exists', 'A WordPress account with this email already exists.', [ 'status' => 409 ] );
		}

		$wp_role = 'shop_manager';
		if ( 'super_admin' === $role ) {
			$wp_role = 'administrator';
		} elseif ( 'shop_manager' === $role ) {
			$wp_role = 'shop_manager';
		}

		$username = sanitize_user( current( explode( '@', $email ) ), true );
		if ( username_exists( $username ) ) {
			$username .= '_' . wp_rand( 100, 999 );
		}

		$name_parts  = preg_split( '/\s+/', trim( $full_name ), 2 );
		$first_name  = $name_parts[0] ?? '';
		$last_name   = $name_parts[1] ?? '';

		$user_id = wp_insert_user( [
			'user_login'   => $username,
			'user_email'   => $email,
			'user_pass'    => $password,
			'display_name' => $full_name ?: $username,
			'first_name'   => $first_name,
			'last_name'    => $last_name,
			'role'         => $wp_role,
		] );

		if ( is_wp_error( $user_id ) ) {
			return new WP_Error( 'create_failed', $user_id->get_error_message(), [ 'status' => 400 ] );
		}

		$new_user = get_user_by( 'id', $user_id );

		return rest_ensure_response( [
			'success' => true,
			'message' => "WordPress staff account created for {$email}.",
			'user'    => [
				'id'                 => (string) $new_user->ID,
				'email'              => $new_user->user_email,
				'full_name'          => $full_name ?: $username,
				'role'               => $role,
				'wp_roles'           => (array) $new_user->roles,
				'avatar_url'         => get_avatar_url( $new_user->ID ),
				'created_at'         => gmdate( 'c', strtotime( $new_user->user_registered ) ),
				'email_confirmed_at' => gmdate( 'c', strtotime( $new_user->user_registered ) ),
			],
		] );
	}

	/**
	 * Delete a WordPress staff user account
	 */
	public function rest_delete_team_member( WP_REST_Request $request ) {
		$user_id = (int) $request->get_param( 'id' );
		$user = get_user_by( 'id', $user_id );
		if ( ! $user instanceof WP_User ) {
			return new WP_Error( 'user_not_found', 'WordPress user not found.', [ 'status' => 404 ] );
		}

		if ( in_array( 'administrator', (array) $user->roles, true ) ) {
			$admins = get_users( [ 'role' => 'administrator' ] );
			if ( count( $admins ) <= 1 ) {
				return new WP_Error( 'cannot_delete_last_admin', 'Cannot delete the primary administrator account.', [ 'status' => 403 ] );
			}
		}

		require_once ABSPATH . 'wp-admin/includes/user.php';
		$admin_users = get_users( [ 'role' => 'administrator', 'number' => 1 ] );
		$reassign_id = ! empty( $admin_users ) ? (int) $admin_users[0]->ID : null;

		$deleted = wp_delete_user( $user_id, $reassign_id );
		if ( ! $deleted ) {
			return new WP_Error( 'delete_failed', 'Could not delete WordPress user.', [ 'status' => 500 ] );
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => "WordPress user {$user->user_email} deleted.",
		] );
	}

	public static function log( $message, $level = 'info', $channel = 'general', $context = [] ) {
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( $level, $channel, $message, $context );
		} elseif ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::log( $level, $channel, $message, $context );
		} elseif ( function_exists( 'wc_get_logger' ) ) {
			$logger  = wc_get_logger();
			$wc_context = [ 'source' => 'exacoat-' . $channel ];
			if ( $level === 'error' ) {
				$logger->error( $message, $wc_context );
			} elseif ( $level === 'warning' ) {
				$logger->warning( $message, $wc_context );
			} else {
				$logger->info( $message, $wc_context );
			}
		}
	}
}

}
