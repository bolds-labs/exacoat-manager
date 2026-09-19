<?php
/**
 * Exacoat Core - Shopee Open Platform API v2 Engine
 * Connects Exacoat Manager directly with Shopee Open API v2 for both
 * Sandbox (Test-Stable) and Live (Production) environments.
 * Handles HMAC-SHA256 signing, OAuth tokens, order sync, and warranty verification.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Shopee_Client' ) ) {

class Exacoat_Shopee_Client {

	const OPTION_KEY             = '_exacoat_shopee_settings';
	const ORDERS_CACHE_KEY       = '_exacoat_shopee_orders_cache';
	const DEFAULT_TEST_PID       = 1244885;
	const DEFAULT_LIVE_PID       = 2011551;
	const DEFAULT_TEST_PUSH_KEY  = 'aaaaaaaaaaaaaactd5mbgvzd3cjhmhh48v428zpt6ywwnuosz567nweg42ey8pky';
	const DEFAULT_WEBHOOK_URL    = 'https://exacoat.com/wp-json/exacoat-core/v1/shopee/webhook';
	const SANDBOX_BASE_URL       = 'https://partner.test-stable.shopeemobile.com';
	const LIVE_BASE_URL          = 'https://partner.shopeemobile.com';

	/**
	 * Initialize Hooks & REST API Routes
	 */
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Get current Shopee configuration settings
	 */
	public static function get_settings(): array {
		$defaults = [
			'environment'           => 'live', // 'sandbox' | 'live'
			'test_partner_id'       => self::DEFAULT_TEST_PID,
			'test_partner_key'      => 'shpk666c6843537a484142475a44787861767052765558666f635a434f58566e',
			'test_push_partner_key' => self::DEFAULT_TEST_PUSH_KEY,
			'live_partner_id'       => self::DEFAULT_LIVE_PID,
			'live_partner_key'      => 'shpk706c666c6f42674755427a546a79445a78417449554e5674616b4b665a4f',
			'live_push_partner_key' => 'aaaaaaaaaaaaaactd5mbgvzd3cjhmhh48v428zpt6ywwnuosz567nweg42ey8pky',
			'redirect_url'          => 'https://manager.exacoat.com/shopee/callback',
			'push_callback_url'     => self::DEFAULT_WEBHOOK_URL,
			'shop_id'               => 0,
			'shop_name'             => 'Exacoat Official Store',
			'access_token'          => '',
			'refresh_token'         => '',
			'token_expires_at'      => 0,
			'last_synced_at'        => 0,
		];

		$saved = get_option( self::OPTION_KEY, [] );
		return wp_parse_args( is_array( $saved ) ? $saved : [], $defaults );
	}

	/**
	 * Save updated Shopee settings
	 */
	public static function save_settings( array $settings ): bool {
		$current = self::get_settings();
		$updated = array_merge( $current, $settings );
		return update_option( self::OPTION_KEY, $updated );
	}

	/**
	 * Get active partner ID based on environment
	 */
	public static function get_active_partner_id(): int {
		$s = self::get_settings();
		return $s['environment'] === 'live' ? (int) $s['live_partner_id'] : (int) $s['test_partner_id'];
	}

	/**
	 * Get active partner key based on environment
	 */
	public static function get_active_partner_key(): string {
		$s = self::get_settings();
		return $s['environment'] === 'live' ? trim( $s['live_partner_key'] ) : trim( $s['test_partner_key'] );
	}

	/**
	 * Get active push partner key for webhook signature verification
	 */
	public static function get_active_push_partner_key(): string {
		$s = self::get_settings();
		$key = $s['environment'] === 'live'
			? trim( (string) ( $s['live_push_partner_key'] ?? '' ) )
			: trim( (string) ( $s['test_push_partner_key'] ?? '' ) );

		if ( ! empty( $key ) ) {
			return $key;
		}
		return self::get_active_partner_key();
	}

	/**
	 * Verify HMAC-SHA256 signature from Shopee Push request header
	 * Base string: URL|request_body
	 */
	public static function verify_push_signature( string $url, string $raw_body, string $header_auth ): bool {
		if ( empty( $header_auth ) ) {
			return false;
		}

		$push_key = self::get_active_push_partner_key();
		if ( empty( $push_key ) ) {
			return true;
		}

		$base_str = $url . '|' . $raw_body;
		$computed = hash_hmac( 'sha256', $base_str, $push_key );
		if ( hash_equals( strtolower( $computed ), strtolower( trim( $header_auth ) ) ) ) {
			return true;
		}

		// Fallback check against standard partner key
		$std_key = self::get_active_partner_key();
		if ( ! empty( $std_key ) && $std_key !== $push_key ) {
			$computed_std = hash_hmac( 'sha256', $base_str, $std_key );
			if ( hash_equals( strtolower( $computed_std ), strtolower( trim( $header_auth ) ) ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get active base API URL
	 */
	public static function get_base_url(): string {
		$s = self::get_settings();
		return $s['environment'] === 'live' ? self::LIVE_BASE_URL : self::SANDBOX_BASE_URL;
	}

	/**
	 * Generate HMAC-SHA256 signature for Public API endpoints
	 * e.g. /api/v2/shop/auth_partner, /api/v2/auth/token/get
	 */
	public static function sign_public( string $path, int $timestamp, int $partner_id, string $partner_key ): string {
		$base_str = $partner_id . $path . $timestamp;
		return hash_hmac( 'sha256', $base_str, $partner_key );
	}

	/**
	 * Generate HMAC-SHA256 signature for Shop API endpoints
	 * e.g. /api/v2/order/get_order_list, /api/v2/order/get_order_detail
	 */
	public static function sign_shop( string $path, int $timestamp, int $partner_id, string $partner_key, string $access_token, int $shop_id ): string {
		$base_str = $partner_id . $path . $timestamp . $access_token . $shop_id;
		return hash_hmac( 'sha256', $base_str, $partner_key );
	}

	/**
	 * Generate signed seller authorization URL
	 */
	public static function get_auth_url( string $redirect_override = '' ): string {
		$settings = self::get_settings();
		$partner_id = self::get_active_partner_id();
		$partner_key = self::get_active_partner_key();
		$base_url = self::get_base_url();

		$path = '/api/v2/shop/auth_partner';
		$timestamp = time();
		$sign = self::sign_public( $path, $timestamp, $partner_id, $partner_key );

		$redirect = ! empty( $redirect_override ) ? $redirect_override : $settings['redirect_url'];

		$query = http_build_query([
			'partner_id' => $partner_id,
			'timestamp'  => $timestamp,
			'sign'       => $sign,
			'redirect'   => $redirect,
		]);

		return "{$base_url}{$path}?{$query}";
	}

	/**
	 * Exchange authorization code for access_token and refresh_token
	 */
	public static function exchange_code_for_tokens( string $code, int $shop_id ): array {
		$partner_id = self::get_active_partner_id();
		$partner_key = self::get_active_partner_key();
		$base_url = self::get_base_url();

		$path = '/api/v2/auth/token/get';
		$timestamp = time();
		$sign = self::sign_public( $path, $timestamp, $partner_id, $partner_key );

		$url = "{$base_url}{$path}?partner_id={$partner_id}&timestamp={$timestamp}&sign={$sign}";

		$body = wp_json_encode([
			'code'       => trim( $code ),
			'shop_id'    => $shop_id,
			'partner_id' => $partner_id,
		]);

		$res = wp_remote_post( $url, [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'body'    => $body,
			'timeout' => 20,
		]);

		if ( is_wp_error( $res ) ) {
			return [ 'success' => false, 'error' => $res->get_error_message() ];
		}

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! empty( $data['error'] ) ) {
			return [
				'success' => false,
				'error'   => $data['error'],
				'message' => $data['message'] ?? 'Failed to exchange Shopee authorization code.',
			];
		}

		if ( ! empty( $data['access_token'] ) ) {
			$expires_in = (int) ( $data['expire_in'] ?? 14400 );
			self::save_settings([
				'access_token'     => $data['access_token'],
				'refresh_token'    => $data['refresh_token'] ?? '',
				'shop_id'          => $shop_id,
				'token_expires_at' => time() + $expires_in,
			]);

			return [
				'success'       => true,
				'access_token'  => $data['access_token'],
				'refresh_token' => $data['refresh_token'] ?? '',
				'expire_in'     => $expires_in,
				'shop_id'       => $shop_id,
			];
		}

		return [ 'success' => false, 'error' => 'Invalid token response structure from Shopee.' ];
	}

	/**
	 * Ensure valid access token, auto-refreshing if expiring within 5 minutes
	 */
	public static function ensure_valid_token(): array {
		$s = self::get_settings();
		if ( empty( $s['access_token'] ) || empty( $s['shop_id'] ) ) {
			return [ 'success' => false, 'error' => 'Shopee store is not connected. Please authorize first.' ];
		}

		// If token still valid for more than 5 minutes, return current
		if ( $s['token_expires_at'] > ( time() + 300 ) ) {
			return [
				'success'      => true,
				'access_token' => $s['access_token'],
				'shop_id'      => (int) $s['shop_id'],
			];
		}

		// Token expired or expiring soon, refresh it
		if ( empty( $s['refresh_token'] ) ) {
			return [ 'success' => false, 'error' => 'Shopee refresh token missing. Re-authorization required.' ];
		}

		$partner_id = self::get_active_partner_id();
		$partner_key = self::get_active_partner_key();
		$base_url = self::get_base_url();

		$path = '/api/v2/auth/access_token/get';
		$timestamp = time();
		$sign = self::sign_public( $path, $timestamp, $partner_id, $partner_key );

		$url = "{$base_url}{$path}?partner_id={$partner_id}&timestamp={$timestamp}&sign={$sign}";

		$body = wp_json_encode([
			'refresh_token' => $s['refresh_token'],
			'shop_id'       => (int) $s['shop_id'],
			'partner_id'    => $partner_id,
		]);

		$res = wp_remote_post( $url, [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'body'    => $body,
			'timeout' => 20,
		]);

		if ( is_wp_error( $res ) ) {
			return [ 'success' => false, 'error' => $res->get_error_message() ];
		}

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! empty( $data['access_token'] ) ) {
			$expires_in = (int) ( $data['expire_in'] ?? 14400 );
			self::save_settings([
				'access_token'     => $data['access_token'],
				'refresh_token'    => $data['refresh_token'] ?? $s['refresh_token'],
				'token_expires_at' => time() + $expires_in,
			]);

			return [
				'success'      => true,
				'access_token' => $data['access_token'],
				'shop_id'      => (int) $s['shop_id'],
			];
		}

		return [
			'success' => false,
			'error'   => $data['message'] ?? 'Could not refresh Shopee access token. Please re-authorize.',
		];
	}

	/**
	 * Synchronize orders from Shopee Open API v2
	 */
	public static function sync_orders( int $days_back = 15 ): array {
		$start_time = microtime( true );
		$s = self::get_settings();

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_sync',
				sprintf( 'Initiating Shopee order sync (days_back: %d, env: %s)', $days_back, $s['environment'] ),
				[
					'partner_id' => self::get_active_partner_id(),
					'shop_id'    => $s['shop_id'] ?? 0,
					'days_back'  => $days_back,
				]
			);
		}

		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log(
					'warning',
					'shopee_sync',
					'Shopee token validation failed during sync: ' . ( $token_res['error'] ?? 'Token invalid' ),
					$token_res
				);
			}

			// If not connected or in sandbox without live orders, return cached orders gracefully
			$cached = get_option( self::ORDERS_CACHE_KEY, [] );
			if ( ! empty( $cached ) ) {
				return [
					'success'      => true,
					'orders'       => $cached,
					'from_cache'   => true,
					'warning'      => $token_res['error'],
				];
			}
			return $token_res;
		}

		$partner_id = self::get_active_partner_id();
		$partner_key = self::get_active_partner_key();
		$base_url = self::get_base_url();
		$access_token = $token_res['access_token'];
		$shop_id = $token_res['shop_id'];

		$time_to = time();
		$time_from = $time_to - ( $days_back * 86400 );

		// Step 1: Call /api/v2/order/get_order_list
		$list_path = '/api/v2/order/get_order_list';
		$list_ts = time();
		$list_sign = self::sign_shop( $list_path, $list_ts, $partner_id, $partner_key, $access_token, $shop_id );

		$list_url = "{$base_url}{$list_path}?" . http_build_query([
			'partner_id'        => $partner_id,
			'timestamp'         => $list_ts,
			'access_token'      => $access_token,
			'shop_id'           => $shop_id,
			'sign'              => $list_sign,
			'time_range_field'  => 'create_time',
			'time_from'         => $time_from,
			'time_to'           => $time_to,
			'page_size'         => 50,
		]);

		$list_res = wp_remote_get( $list_url, [ 'timeout' => 25 ] );
		if ( is_wp_error( $list_res ) ) {
			$err = $list_res->get_error_message();
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'shopee_sync', 'Shopee get_order_list HTTP transport error: ' . $err );
			}
			return [ 'success' => false, 'error' => $err ];
		}

		$list_data = json_decode( wp_remote_retrieve_body( $list_res ), true );
		if ( ! empty( $list_data['error'] ) ) {
			$err = $list_data['message'] ?? $list_data['error'];
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'shopee_sync', 'Shopee get_order_list API error: ' . $err, $list_data );
			}
			return [
				'success' => false,
				'error'   => $list_data['error'],
				'message' => $err,
			];
		}

		$raw_order_list = $list_data['response']['order_list'] ?? [];
		if ( empty( $raw_order_list ) ) {
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'info', 'shopee_sync', 'Shopee get_order_list completed: 0 orders found for time range' );
			}
			return [
				'success'      => true,
				'orders'       => [],
				'total_synced' => 0,
				'message'      => 'No recent Shopee orders found in the selected time range.',
			];
		}

		$order_sns = array_column( $raw_order_list, 'order_sn' );
		$order_sns = array_slice( $order_sns, 0, 50 );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_sync',
				sprintf( 'Shopee get_order_list found %d orders. Fetching batch details...', count( $order_sns ) ),
				[ 'order_sns' => $order_sns ]
			);
		}

		// Step 2: Call /api/v2/order/get_order_detail in batch
		$detail_path = '/api/v2/order/get_order_detail';
		$detail_ts = time();
		$detail_sign = self::sign_shop( $detail_path, $detail_ts, $partner_id, $partner_key, $access_token, $shop_id );

		$detail_url = "{$base_url}{$detail_path}?" . http_build_query([
			'partner_id'                => $partner_id,
			'timestamp'                 => $detail_ts,
			'access_token'              => $access_token,
			'shop_id'                   => $shop_id,
			'sign'                      => $detail_sign,
			'order_sn_list'             => implode( ',', $order_sns ),
			'response_optional_fields'  => 'buyer_user_id,buyer_username,recipient_address,item_list,shipping_carrier,total_amount,pay_time,order_status,package_list,note,shipping_document_status',
		]);

		$detail_res = wp_remote_get( $detail_url, [ 'timeout' => 30 ] );
		if ( is_wp_error( $detail_res ) ) {
			$err = $detail_res->get_error_message();
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'shopee_sync', 'Shopee get_order_detail HTTP transport error: ' . $err );
			}
			return [ 'success' => false, 'error' => $err ];
		}

		$detail_data = json_decode( wp_remote_retrieve_body( $detail_res ), true );
		if ( ! empty( $detail_data['error'] ) ) {
			$err = $detail_data['message'] ?? $detail_data['error'];
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'shopee_sync', 'Shopee get_order_detail API error: ' . $err, $detail_data );
			}
		}

		$raw_details = $detail_data['response']['order_list'] ?? [];
		$normalized_orders = [];

		foreach ( $raw_details as $ord ) {
			$sn = $ord['order_sn'] ?? '';
			if ( empty( $sn ) ) continue;

			// Check if already claimed for warranty or redeem in WooCommerce
			$claim_info = self::check_existing_claim( $sn );

			$items = [];
			foreach ( ( $ord['item_list'] ?? [] ) as $item ) {
				$var_name = trim( $item['model_name'] ?? '' );
				$prod_name = trim( $item['item_name'] ?? 'Exacoat Skin' );

				$items[] = [
					'item_id'          => $item['item_id'] ?? 0,
					'item_name'        => $prod_name,
					'model_id'         => $item['model_id'] ?? 0,
					'model_name'       => $var_name,
					'quantity'         => (int) ( $item['model_quantity_purchased'] ?? 1 ),
					'price'            => (float) ( $item['model_discounted_price'] ?? $item['model_original_price'] ?? 0 ),
					'image_url'        => $item['image_info']['image_url'] ?? '',
				];
			}

			$rec = $ord['recipient_address'] ?? [];
			$package = ( $ord['package_list'] ?? [] )[0] ?? [];
			$pkg_logistics_st = strtoupper( (string) ( $package['logistics_status'] ?? '' ) );
			$shipping_doc_st = strtoupper( (string) ( $ord['shipping_document_status'] ?? ( $package['shipping_document_status'] ?? '' ) ) );
			$raw_order_st = strtoupper( (string) ( $ord['order_status'] ?? 'UNKNOWN' ) );
			$tracking_num = trim( (string) ( $package['tracking_number'] ?? '' ) );

			// Check if delivery completed
			$is_delivered = false;
			$delivered_time = null;
			if (
				$raw_order_st === 'COMPLETED' ||
				$raw_order_st === 'TO_CONFIRM_RECEIVE' ||
				$pkg_logistics_st === 'LOGISTICS_DELIVERY_DONE'
			) {
				$is_delivered = true;
				$delivered_time = ! empty( $package['delivery_time'] )
					? date( 'Y-m-d H:i:s', $package['delivery_time'] )
					: ( ! empty( $ord['update_time'] ) ? date( 'Y-m-d H:i:s', $ord['update_time'] ) : current_time( 'mysql' ) );
			}

			// Check if shipping arranged / scheduled
			$is_arranged = (
				$raw_order_st === 'PROCESSED' ||
				! empty( $tracking_num ) ||
				in_array( $pkg_logistics_st, [ 'LOGISTICS_REQUEST_CREATED', 'LOGISTICS_READY', 'LOGISTICS_PICKUP_DONE' ], true )
			);

			// Check if label printed
			$is_printed = in_array( $shipping_doc_st, [ 'PRINTED', 'READY' ], true );

			$normalized_orders[] = [
				'order_sn'                 => $sn,
				'order_status'             => $ord['order_status'] ?? 'UNKNOWN',
				'create_time'              => date( 'Y-m-d H:i:s', $ord['create_time'] ?? time() ),
				'create_timestamp'         => $ord['create_time'] ?? time(),
				'pay_time'                 => ! empty( $ord['pay_time'] ) ? date( 'Y-m-d H:i:s', $ord['pay_time'] ) : null,
				'buyer_username'           => $ord['buyer_username'] ?? 'Shopee Customer',
				'buyer_user_id'            => $ord['buyer_user_id'] ?? 0,
				'total_amount'             => (float) ( $ord['total_amount'] ?? 0 ),
				'currency'                 => 'IDR',
				'shipping_carrier'         => $ord['shipping_carrier'] ?? ( $package['shipping_carrier'] ?? 'SPX / J&T' ),
				'tracking_number'          => $tracking_num,
				'buyer_note'               => $ord['note'] ?? '',
				'recipient_name'           => $rec['name'] ?? ( $ord['buyer_username'] ?? 'Shopee Customer' ),
				'recipient_phone'          => $rec['phone'] ?? '',
				'recipient_address'        => $rec['full_address'] ?? '',
				'recipient_city'           => $rec['city'] ?? ( $rec['district'] ?? '' ),
				'recipient_postcode'       => $rec['zipcode'] ?? '',
				'items'                    => $items,
				'is_delivered'             => $is_delivered,
				'delivered_time'           => $delivered_time,
				'is_arranged'              => $is_arranged,
				'is_printed'               => $is_printed,
				'logistics_status'         => $pkg_logistics_st,
				'shipping_document_status' => $shipping_doc_st,
				'already_claimed'          => $claim_info['already_claimed'],
				'existing_claim'           => $claim_info,
			];
		}

		// Update cache and sync timestamp
		update_option( self::ORDERS_CACHE_KEY, $normalized_orders );
		self::save_settings([ 'last_synced_at' => time() ]);

		$elapsed = round( microtime( true ) - $start_time, 2 );
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_sync',
				sprintf( 'Shopee order sync completed successfully: %d orders saved to cache (elapsed: %ss)', count( $normalized_orders ), $elapsed ),
				[
					'total_synced' => count( $normalized_orders ),
					'elapsed_sec'  => $elapsed,
					'order_sns'    => array_column( $normalized_orders, 'order_sn' ),
				]
			);
		}

		return [
			'success'      => true,
			'orders'       => $normalized_orders,
			'total_synced' => count( $normalized_orders ),
			'synced_at'    => date( 'Y-m-d H:i:s' ),
		];
	}

	/**
	 * Update specific order fields in the cached orders list
	 */
	public static function update_order_cache_field( string $order_sn, array $fields ): bool {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) || empty( $fields ) ) {
			return false;
		}

		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		if ( ! is_array( $cached ) ) {
			$cached = [];
		}

		$found = false;
		foreach ( $cached as &$ord ) {
			if ( strcasecmp( $ord['order_sn'] ?? '', $clean_sn ) === 0 ) {
				foreach ( $fields as $k => $v ) {
					$ord[ $k ] = $v;
				}
				$found = true;
				break;
			}
		}
		unset( $ord );

		if ( $found ) {
			update_option( self::ORDERS_CACHE_KEY, $cached );
			return true;
		}

		return false;
	}

	/**
	 * Check if a Shopee Order SN has already been processed for Warranty or Redeem
	 */
	public static function check_existing_claim( string $order_sn ): array {
		$clean = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean ) ) {
			return [ 'already_claimed' => false ];
		}

		// Query WooCommerce orders with matching marketplace invoice
		$orders = wc_get_orders([
			'limit'      => 1,
			'meta_key'   => '_marketplace_invoice',
			'meta_value' => $clean,
			'status'     => [ 'wc-processing', 'wc-completed', 'wc-shipped', 'wc-on-hold' ],
		]);

		if ( ! empty( $orders ) ) {
			$ord = $orders[0];
			$is_redeem = $ord->get_meta( '_is_redeem_order' ) === 'yes';
			return [
				'already_claimed'     => true,
				'existing_order_id'   => $ord->get_id(),
				'existing_order_num'  => $ord->get_order_number(),
				'claim_type'          => $is_redeem ? 'Redeem' : 'Warranty',
				'created_at'          => $ord->get_date_created() ? $ord->get_date_created()->date( 'Y-m-d H:i' ) : '',
			];
		}

		return [ 'already_claimed' => false ];
	}

	/**
	 * Generic Shop API caller with auto-token management and HMAC-SHA256 signature
	 */
	public static function call_shop_api( string $path, string $method = 'GET', array $params = [], array $body = [] ): array {
		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			return $token_res;
		}

		$access_token = $token_res['access_token'];
		$shop_id      = (int) $token_res['shop_id'];
		$partner_id   = self::get_active_partner_id();
		$partner_key  = self::get_active_partner_key();
		$base_url     = self::get_base_url();

		$timestamp = time();
		$sign = self::sign_shop( $path, $timestamp, $partner_id, $partner_key, $access_token, $shop_id );

		$common_params = [
			'partner_id'   => $partner_id,
			'timestamp'    => $timestamp,
			'access_token' => $access_token,
			'shop_id'      => $shop_id,
			'sign'         => $sign,
		];

		$all_params = array_merge( $common_params, $params );
		$url = $base_url . $path . '?' . http_build_query( $all_params );

		$args = [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'timeout' => 25,
		];

		if ( strtoupper( $method ) === 'POST' ) {
			$args['body'] = ! empty( $body ) ? wp_json_encode( $body ) : '{}';
			$res = wp_remote_post( $url, $args );
		} else {
			$res = wp_remote_get( $url, $args );
		}

		if ( is_wp_error( $res ) ) {
			return [
				'success' => false,
				'error'   => $res->get_error_message(),
			];
		}

		$raw_body = wp_remote_retrieve_body( $res );
		$content_type = wp_remote_retrieve_header( $res, 'content-type' );

		// Check if response is raw PDF binary stream
		if ( str_contains( (string) $content_type, 'application/pdf' ) || str_starts_with( $raw_body, '%PDF' ) ) {
			return [
				'success'      => true,
				'is_pdf'       => true,
				'content_type' => 'application/pdf',
				'pdf_data'     => $raw_body,
			];
		}

		$data = json_decode( $raw_body, true );
		if ( ! is_array( $data ) ) {
			return [
				'success' => false,
				'error'   => 'Non-JSON response returned from Shopee API.',
				'raw'     => substr( $raw_body, 0, 300 ),
			];
		}

		if ( ! empty( $data['error'] ) ) {
			return [
				'success' => false,
				'error'   => $data['error'],
				'message' => $data['message'] ?? 'Shopee API call failed.',
				'raw'     => $data,
			];
		}

		return [
			'success'  => true,
			'response' => $data['response'] ?? $data,
		];
	}

	/**
	 * Get shipping parameters (dropoff / pickup options) for an order
	 */
	public static function get_shipping_parameter( string $order_sn ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		return self::call_shop_api( '/api/v2/logistics/get_shipping_parameter', 'GET', [
			'order_sn' => $clean_sn,
		]);
	}

	/**
	 * Arrange shipment (Atur Pengiriman) for ready-to-ship order
	 */
	public static function ship_order( string $order_sn, array $ship_data ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		$body = [ 'order_sn' => $clean_sn ];
		if ( ! empty( $ship_data['dropoff'] ) ) {
			$body['dropoff'] = $ship_data['dropoff'];
		} elseif ( ! empty( $ship_data['pickup'] ) ) {
			$body['pickup'] = $ship_data['pickup'];
		}

		$res = self::call_shop_api( '/api/v2/logistics/ship_order', 'POST', [], $body );
		if ( ! $res['success'] ) {
			return $res;
		}

		// Retrieve tracking number immediately
		$tracking_res = self::get_tracking_number( $clean_sn );
		$tracking_number = '';
		if ( $tracking_res['success'] && ! empty( $tracking_res['response']['tracking_number'] ) ) {
			$tracking_number = $tracking_res['response']['tracking_number'];
		}

		// Update order in local cache to PROCESSED
		$updates = [ 'order_status' => 'PROCESSED' ];
		if ( ! empty( $tracking_number ) ) {
			$updates['tracking_number'] = $tracking_number;
		}
		self::update_order_cache_field( $clean_sn, $updates );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_logistics',
				sprintf( 'Arranged shipment for Shopee order %s (Resi: %s)', $clean_sn, $tracking_number ?: 'Pending' ),
				[
					'order_sn'        => $clean_sn,
					'tracking_number' => $tracking_number,
					'ship_data'       => $ship_data,
				]
			);
		}

		return [
			'success'         => true,
			'order_sn'        => $clean_sn,
			'order_status'    => 'PROCESSED',
			'tracking_number' => $tracking_number,
			'message'         => 'Shipment arranged successfully.',
		];
	}

	/**
	 * Get allocated tracking number for an order
	 */
	public static function get_tracking_number( string $order_sn ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		return self::call_shop_api( '/api/v2/logistics/get_tracking_number', 'GET', [
			'order_sn' => $clean_sn,
		]);
	}

	/**
	 * Request creation of thermal shipping document (100x150mm AWB)
	 */
	public static function create_shipping_document( string $order_sn, string $doc_type = 'THERMAL_AIR_WAYBILL' ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		$body = [
			'order_list'             => [ [ 'order_sn' => $clean_sn ] ],
			'shipping_document_type' => $doc_type,
		];

		return self::call_shop_api( '/api/v2/logistics/create_shipping_document', 'POST', [], $body );
	}

	/**
	 * Get shipping document generation status
	 */
	public static function get_shipping_document_result( string $order_sn, string $doc_type = 'THERMAL_AIR_WAYBILL' ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		$body = [
			'order_list'             => [ [ 'order_sn' => $clean_sn ] ],
			'shipping_document_type' => $doc_type,
		];

		return self::call_shop_api( '/api/v2/logistics/get_shipping_document_result', 'POST', [], $body );
	}

	/**
	 * Download official Shopee shipping document PDF
	 */
	public static function download_shipping_document( string $order_sn, string $doc_type = 'THERMAL_AIR_WAYBILL' ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		// Ensure document is requested first
		self::create_shipping_document( $clean_sn, $doc_type );

		$body = [
			'shipping_document_type' => $doc_type,
			'order_list'             => [ [ 'order_sn' => $clean_sn ] ],
		];

		return self::call_shop_api( '/api/v2/logistics/download_shipping_document', 'POST', [], $body );
	}

	/**
	 * Register REST API Routes
	 */
	public static function register_routes(): void {
		$ns = 'exacoat-core/v1';

		// 1. GET & POST /shopee/settings
		register_rest_route( $ns, '/shopee/settings', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_settings' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_save_settings' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
		]);

		// 2. GET /shopee/auth-url
		register_rest_route( $ns, '/shopee/auth-url', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_auth_url' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 3. GET & POST /shopee/callback (handles OAuth code redirect)
		register_rest_route( $ns, '/shopee/callback', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ __CLASS__, 'rest_handle_callback' ],
			'permission_callback' => '__return_true',
		]);

		// 4. GET /shopee/orders (returns synced orders with status filters)
		register_rest_route( $ns, '/shopee/orders', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_orders' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 5. POST /shopee/sync (triggers live fetch from Shopee API)
		register_rest_route( $ns, '/shopee/sync', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_sync_orders' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 6. GET /shopee/verify-order (public check for exacoat.com/warranty)
		register_rest_route( $ns, '/shopee/verify-order', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_verify_order' ],
			'permission_callback' => '__return_true',
		]);

		// 7. GET & POST /shopee/webhook (receives Shopee Push events and test verification pings)
		register_rest_route( $ns, '/shopee/webhook', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ __CLASS__, 'rest_handle_webhook' ],
			'permission_callback' => '__return_true',
		]);

		// 8. GET /shopee/shipping-parameter
		register_rest_route( $ns, '/shopee/shipping-parameter', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_shipping_parameter' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 9. POST /shopee/ship-order
		register_rest_route( $ns, '/shopee/ship-order', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_ship_order' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 10. GET /shopee/shipping-document (streams PDF directly)
		register_rest_route( $ns, '/shopee/shipping-document', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_download_shipping_document' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 11. GET /shopee/tracking-info (live logistics checkpoints and delivery detection)
		register_rest_route( $ns, '/shopee/tracking-info', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_tracking_info' ],
			'permission_callback' => '__return_true',
		]);
	}

	public static function check_admin_permission(): bool {
		return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
	}

	public static function rest_get_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$s = self::get_settings();

		// Mask keys for security
		$masked_test = ! empty( $s['test_partner_key'] ) ? substr( $s['test_partner_key'], 0, 8 ) . '...' . substr( $s['test_partner_key'], -4 ) : '';
		$masked_live = ! empty( $s['live_partner_key'] ) ? substr( $s['live_partner_key'], 0, 8 ) . '...' . substr( $s['live_partner_key'], -4 ) : '';
		$masked_test_push = ! empty( $s['test_push_partner_key'] ) ? substr( $s['test_push_partner_key'], 0, 8 ) . '...' . substr( $s['test_push_partner_key'], -4 ) : '';
		$masked_live_push = ! empty( $s['live_push_partner_key'] ) ? substr( $s['live_push_partner_key'], 0, 8 ) . '...' . substr( $s['live_push_partner_key'], -4 ) : '';

		return rest_ensure_response([
			'success'                => true,
			'environment'            => $s['environment'],
			'test_partner_id'        => $s['test_partner_id'],
			'test_partner_key'       => $masked_test,
			'has_test_key'           => ! empty( $s['test_partner_key'] ),
			'test_push_partner_key'  => $masked_test_push,
			'has_test_push_key'      => ! empty( $s['test_push_partner_key'] ),
			'live_partner_id'        => $s['live_partner_id'],
			'live_partner_key'       => $masked_live,
			'has_live_key'           => ! empty( $s['live_partner_key'] ),
			'live_push_partner_key'  => $masked_live_push,
			'has_live_push_key'      => ! empty( $s['live_push_partner_key'] ),
			'redirect_url'           => $s['redirect_url'],
			'push_callback_url'      => $s['push_callback_url'] ?? self::DEFAULT_WEBHOOK_URL,
			'shop_id'                => $s['shop_id'],
			'shop_name'              => $s['shop_name'],
			'is_connected'           => ! empty( $s['access_token'] ),
			'token_expires_at'       => $s['token_expires_at'],
			'is_expired'             => $s['token_expires_at'] > 0 && time() >= $s['token_expires_at'],
			'last_synced_at'         => $s['last_synced_at'] ? date( 'Y-m-d H:i:s', $s['last_synced_at'] ) : null,
		]);
	}

	public static function rest_save_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$params = $request->get_json_params() ?: [];
		$current = self::get_settings();

		$updates = [];
		if ( isset( $params['environment'] ) && in_array( $params['environment'], [ 'sandbox', 'live' ], true ) ) {
			$updates['environment'] = $params['environment'];
		}
		if ( isset( $params['test_partner_id'] ) ) {
			$updates['test_partner_id'] = (int) $params['test_partner_id'];
		}
		if ( ! empty( $params['test_partner_key'] ) && ! str_contains( $params['test_partner_key'], '...' ) ) {
			$updates['test_partner_key'] = trim( $params['test_partner_key'] );
		}
		if ( ! empty( $params['test_push_partner_key'] ) && ! str_contains( $params['test_push_partner_key'], '...' ) ) {
			$updates['test_push_partner_key'] = trim( $params['test_push_partner_key'] );
		}
		if ( isset( $params['live_partner_id'] ) ) {
			$updates['live_partner_id'] = (int) $params['live_partner_id'];
		}
		if ( ! empty( $params['live_partner_key'] ) && ! str_contains( $params['live_partner_key'], '...' ) ) {
			$updates['live_partner_key'] = trim( $params['live_partner_key'] );
		}
		if ( ! empty( $params['live_push_partner_key'] ) && ! str_contains( $params['live_push_partner_key'], '...' ) ) {
			$updates['live_push_partner_key'] = trim( $params['live_push_partner_key'] );
		}
		if ( isset( $params['redirect_url'] ) ) {
			$updates['redirect_url'] = esc_url_raw( trim( $params['redirect_url'] ) );
		}
		if ( isset( $params['push_callback_url'] ) ) {
			$updates['push_callback_url'] = esc_url_raw( trim( $params['push_callback_url'] ) );
		}
		if ( isset( $params['shop_id'] ) ) {
			$updates['shop_id'] = (int) $params['shop_id'];
		}
		if ( isset( $params['shop_name'] ) ) {
			$updates['shop_name'] = sanitize_text_field( $params['shop_name'] );
		}

		self::save_settings( $updates );

		$updated_settings_response = self::rest_get_settings( $request );

		return rest_ensure_response([
			'success'  => true,
			'message'  => 'Shopee settings updated successfully.',
			'settings' => $updated_settings_response->get_data(),
		]);
	}

	public static function rest_get_auth_url( \WP_REST_Request $request ): \WP_REST_Response {
		$override = $request->get_param( 'redirect_url' );
		$auth_url = self::get_auth_url( $override ? esc_url_raw( $override ) : '' );

		return rest_ensure_response([
			'success'  => true,
			'auth_url' => $auth_url,
		]);
	}

	public static function rest_handle_callback( \WP_REST_Request $request ): \WP_REST_Response {
		$code = $request->get_param( 'code' );
		$shop_id = (int) $request->get_param( 'shop_id' );

		if ( empty( $code ) || empty( $shop_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'Missing code or shop_id in callback parameters.',
			], 400 );
		}

		$result = self::exchange_code_for_tokens( $code, $shop_id );
		if ( ! $result['success'] ) {
			return new \WP_REST_Response( $result, 400 );
		}

		// If called from browser directly, render a clean HTML success message that closes the popup
		if ( str_contains( $_SERVER['HTTP_ACCEPT'] ?? '', 'text/html' ) ) {
			echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shopee Connected</title>' .
				'<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0d0d;color:#fff;margin:0} ' .
				'.card{background:#181818;padding:32px;border-radius:16px;border:1px solid #333;text-align:center;max-width:400px} ' .
				'.btn{background:#EE4D2D;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:16px}</style></head>' .
				'<body><div class="card"><h2 style="color:#10b981;margin:0 0 12px">Shopee Connected!</h2>' .
				'<p style="color:#aaa;font-size:14px;margin:0 0 16px">Shop ID #' . esc_html( $shop_id ) . ' successfully linked with Exacoat Manager.</p>' .
				'<button class="btn" onclick="if(window.opener){window.opener.postMessage({shopee_connected:true},\"*\");window.close();}else{window.location.href=\"https://manager.exacoat.com/#orders\";}">Return to Manager</button>' .
				'<script>if(window.opener){window.opener.postMessage({shopee_connected:true,shop_id:' . $shop_id . '},"*");setTimeout(function(){window.close();},1500);}</script>' .
				'</div></body></html>';
			exit;
		}

		return rest_ensure_response( $result );
	}

	public static function rest_get_orders( \WP_REST_Request $request ): \WP_REST_Response {
		$status = $request->get_param( 'status' );
		$search = trim( (string) $request->get_param( 'search' ) );

		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		if ( ! is_array( $cached ) ) {
			$cached = [];
		}

		// Filter orders
		$filtered = $cached;

		if ( ! empty( $status ) && $status !== 'all' ) {
			$status_upper = strtoupper( $status );
			$filtered = array_filter( $filtered, function( $o ) use ( $status_upper ) {
				$st = strtoupper( $o['order_status'] ?? '' );
				if ( $status_upper === 'READY_TO_SHIP' ) {
					return in_array( $st, [ 'READY_TO_SHIP', 'PROCESSED' ], true );
				}
				return $st === $status_upper;
			});
		}

		if ( ! empty( $search ) ) {
			$search_lower = strtolower( $search );
			$filtered = array_filter( $filtered, function( $o ) use ( $search_lower ) {
				$sn = strtolower( $o['order_sn'] ?? '' );
				$buyer = strtolower( $o['buyer_username'] ?? '' );
				$resi = strtolower( $o['tracking_number'] ?? '' );
				$prod = '';
				foreach ( ( $o['items'] ?? [] ) as $item ) {
					$prod .= ' ' . strtolower( $item['item_name'] . ' ' . $item['model_name'] );
				}
				return str_contains( $sn, $search_lower ) || str_contains( $buyer, $search_lower ) || str_contains( $resi, $search_lower ) || str_contains( $prod, $search_lower );
			});
		}

		// Sort by create_timestamp desc
		usort( $filtered, function( $a, $b ) {
			return ( $b['create_timestamp'] ?? 0 ) <=> ( $a['create_timestamp'] ?? 0 );
		});

		$s = self::get_settings();

		return rest_ensure_response([
			'success'        => true,
			'orders'         => array_values( $filtered ),
			'total'          => count( $filtered ),
			'last_synced_at' => $s['last_synced_at'] ? date( 'Y-m-d H:i:s', $s['last_synced_at'] ) : null,
			'is_connected'   => ! empty( $s['access_token'] ),
			'shop_id'        => $s['shop_id'],
		]);
	}

	public static function rest_sync_orders( \WP_REST_Request $request ): \WP_REST_Response {
		$days = (int) ( $request->get_param( 'days' ) ?: 15 );
		$res = self::sync_orders( $days );
		return rest_ensure_response( $res );
	}

	public static function rest_get_shipping_parameter( \WP_REST_Request $request ): \WP_REST_Response {
		$order_sn = trim( (string) $request->get_param( 'order_sn' ) );
		$res = self::get_shipping_parameter( $order_sn );
		return rest_ensure_response( $res );
	}

	public static function rest_ship_order( \WP_REST_Request $request ): \WP_REST_Response {
		$params = $request->get_json_params() ?: [];
		$order_sn = trim( (string) ( $params['order_sn'] ?? $request->get_param( 'order_sn' ) ) );
		$ship_data = $params['ship_data'] ?? $params;

		$res = self::ship_order( $order_sn, $ship_data );
		return rest_ensure_response( $res );
	}

	public static function rest_download_shipping_document( \WP_REST_Request $request ) {
		$order_sn = trim( (string) $request->get_param( 'order_sn' ) );
		$doc_type = sanitize_text_field( $request->get_param( 'document_type' ) ?: 'THERMAL_AIR_WAYBILL' );

		$res = self::download_shipping_document( $order_sn, $doc_type );

		if ( ! empty( $res['is_pdf'] ) && ! empty( $res['pdf_data'] ) ) {
			header( 'Content-Type: application/pdf' );
			header( 'Content-Disposition: inline; filename="shopee-awb-' . $order_sn . '.pdf"' );
			header( 'Content-Length: ' . strlen( $res['pdf_data'] ) );
			echo $res['pdf_data'];
			exit;
		}

		return rest_ensure_response( $res );
	}

	/**
	 * Retrieve tracking timeline checkpoints and detect true delivery status
	 */
	public static function get_tracking_info( string $order_sn ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [
				'success' => false,
				'error'   => 'Order SN is required.',
			];
		}

		$cached_orders = get_option( self::ORDERS_CACHE_KEY, [] );
		$cached_order  = null;
		foreach ( (array) $cached_orders as $ord ) {
			if ( strcasecmp( $ord['order_sn'] ?? '', $clean_sn ) === 0 ) {
				$cached_order = $ord;
				break;
			}
		}

		$checkpoints      = [];
		$logistics_status = '';
		$is_delivered     = false;
		$delivered_time   = null;
		$delivered_ts     = null;

		// 1. Query Shopee Open Platform API for live tracking info
		$api_res = self::call_shop_api( '/api/v2/logistics/get_tracking_info', 'GET', [ 'order_sn' => $clean_sn ] );
		if ( ! empty( $api_res['success'] ) && ! empty( $api_res['response'] ) ) {
			$resp = $api_res['response'];
			$logistics_status = (string) ( $resp['logistics_status'] ?? '' );
			$raw_events = $resp['tracking_info'] ?? [];

			if ( is_array( $raw_events ) && ! empty( $raw_events ) ) {
				usort( $raw_events, function( $a, $b ) {
					return ( (int) ( $b['update_time'] ?? 0 ) ) <=> ( (int) ( $a['update_time'] ?? 0 ) );
				});

				foreach ( $raw_events as $ev ) {
					$ev_ts     = (int) ( $ev['update_time'] ?? 0 );
					$ev_desc   = trim( (string) ( $ev['description'] ?? '' ) );
					$ev_status = strtoupper( (string) ( $ev['logistics_status'] ?? '' ) );

					$stage = 'in_transit';
					$desc_lower = strtolower( $ev_desc );
					if (
						str_contains( $ev_status, 'DELIVERY_DONE' ) ||
						str_contains( $ev_status, 'DELIVERED' ) ||
						str_contains( $desc_lower, 'delivered' ) ||
						str_contains( $desc_lower, 'telah sampai' ) ||
						str_contains( $desc_lower, 'diterima' ) ||
						str_contains( $desc_lower, 'selesai' )
					) {
						$stage = 'delivered';
						if ( ! $is_delivered ) {
							$is_delivered   = true;
							$delivered_ts   = $ev_ts;
							$delivered_time = $ev_ts ? date( 'Y-m-d H:i:s', $ev_ts ) : current_time( 'mysql' );
						}
					} elseif ( str_contains( $ev_status, 'PICKUP' ) || str_contains( $desc_lower, 'pickup' ) || str_contains( $desc_lower, 'diserahkan' ) ) {
						$stage = 'pickup';
					}

					$checkpoints[] = [
						'time'             => $ev_ts ? date( 'Y-m-d H:i:s', $ev_ts ) : '',
						'timestamp'        => $ev_ts,
						'description'      => $ev_desc,
						'stage'            => $stage,
						'logistics_status' => $ev_status,
					];
				}
			}
		}

		// 2. Fallback to Shipping Tracker if carrier and resi exist
		if ( empty( $checkpoints ) && $cached_order && ! empty( $cached_order['tracking_number'] ) ) {
			$carrier = $cached_order['shipping_carrier'] ?? '';
			$resi    = $cached_order['tracking_number'];
			if ( class_exists( 'Exacoat_Shipping_Tracker' ) && method_exists( 'Exacoat_Shipping_Tracker', 'track_shipment' ) ) {
				$track_res = \Exacoat_Shipping_Tracker::track_shipment( $carrier, $resi );
				if ( ! empty( $track_res['checkpoints'] ) ) {
					$checkpoints = $track_res['checkpoints'];
					if ( ( $track_res['latest_status'] ?? '' ) === 'delivered' ) {
						$is_delivered   = true;
						$delivered_time = $track_res['delivered_at'] ?? ( $checkpoints[0]['time'] ?? current_time( 'mysql' ) );
						$delivered_ts   = strtotime( $delivered_time );
					}
				}
			}
		}

		// 3. Fallback check from cached order status
		if ( ! $is_delivered && $cached_order ) {
			$raw_st = strtoupper( $cached_order['order_status'] ?? '' );
			if ( in_array( $raw_st, [ 'COMPLETED', 'DELIVERED' ], true ) ) {
				$is_delivered   = true;
				$delivered_time = $cached_order['delivered_time'] ?? ( $cached_order['update_time'] ?? ( $cached_order['pay_time'] ?? current_time( 'mysql' ) ) );
				$delivered_ts   = strtotime( $delivered_time );
			}
		}

		// If delivered, update cached order field
		if ( $is_delivered && $delivered_time ) {
			self::update_order_cache_field( $clean_sn, [
				'order_status'   => 'COMPLETED',
				'delivered_time' => $delivered_time,
			]);
		}

		return [
			'success'          => true,
			'order_sn'         => $clean_sn,
			'tracking_number'  => $cached_order['tracking_number'] ?? '',
			'shipping_carrier' => $cached_order['shipping_carrier'] ?? '',
			'logistics_status' => $logistics_status,
			'is_delivered'     => $is_delivered,
			'delivered_time'   => $delivered_time,
			'delivered_ts'     => $delivered_ts,
			'checkpoints'      => $checkpoints,
		];
	}

	public static function rest_get_tracking_info( \WP_REST_Request $request ): \WP_REST_Response {
		$order_sn = trim( (string) $request->get_param( 'order_sn' ) );
		$res = self::get_tracking_info( $order_sn );
		return rest_ensure_response( $res );
	}

	public static function rest_verify_order( \WP_REST_Request $request ): \WP_REST_Response {
		$order_sn = trim( (string) $request->get_param( 'order_sn' ) );
		$clean = preg_replace( '/^#+/', '', $order_sn );

		if ( empty( $clean ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'Shopee order number / invoice is required.',
			], 400 );
		}

		// Check if already claimed
		$claim_info = self::check_existing_claim( $clean );
		if ( $claim_info['already_claimed'] ) {
			return rest_ensure_response([
				'success'             => false,
				'already_claimed'     => true,
				'message'             => "This Shopee invoice ({$clean}) has already been processed for replacement under Order #{$claim_info['existing_order_num']} ({$claim_info['claim_type']}).",
				'existing_order_num'  => $claim_info['existing_order_num'],
				'existing_order_type' => $claim_info['claim_type'],
			]);
		}

		// Check cached orders
		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		$found = null;
		foreach ( (array) $cached as $ord ) {
			if ( strcasecmp( $ord['order_sn'] ?? '', $clean ) === 0 ) {
				$found = $ord;
				break;
			}
		}

		// If not in cache, query Shopee Open API v2 live
		if ( ! $found ) {
			$detail_res = self::call_shop_api( '/api/v2/order/get_order_detail', 'GET', [
				'order_sn_list'            => $clean,
				'response_optional_fields' => 'buyer_user_id,buyer_username,recipient_address,item_list,shipping_carrier,total_amount,pay_time,order_status,package_list,note',
			]);
			if ( ! empty( $detail_res['response']['order_list'][0] ) ) {
				$live_ord = $detail_res['response']['order_list'][0];
				$raw_st = strtoupper( (string) ( $live_ord['order_status'] ?? 'UNKNOWN' ) );
				$package = ( $live_ord['package_list'] ?? [] )[0] ?? [];
				$pkg_logistics_st = strtoupper( (string) ( $package['logistics_status'] ?? '' ) );
				$tracking_num = trim( (string) ( $package['tracking_number'] ?? '' ) );
				$rec = $live_ord['recipient_address'] ?? [];

				$items = [];
				foreach ( ( $live_ord['item_list'] ?? [] ) as $item ) {
					$items[] = [
						'item_id'    => $item['item_id'] ?? 0,
						'item_name'  => trim( $item['item_name'] ?? 'Exacoat Skin' ),
						'model_id'   => $item['model_id'] ?? 0,
						'model_name' => trim( $item['model_name'] ?? '' ),
						'quantity'   => (int) ( $item['model_quantity_purchased'] ?? 1 ),
						'price'      => (float) ( $item['model_discounted_price'] ?? $item['model_original_price'] ?? 0 ),
						'image_url'  => $item['image_info']['image_url'] ?? '',
					];
				}

				$found = [
					'order_sn'         => $clean,
					'order_status'     => $raw_st,
					'buyer_username'   => $live_ord['buyer_username'] ?? 'Shopee Customer',
					'shipping_carrier' => $live_ord['shipping_carrier'] ?? ( $package['shipping_carrier'] ?? '' ),
					'tracking_number'  => $tracking_num,
					'items'            => $items,
					'recipient_name'   => $rec['name'] ?? '',
					'recipient_phone'  => $rec['phone'] ?? '',
					'recipient_address'=> $rec['full_address'] ?? '',
					'recipient_city'   => $rec['city'] ?? '',
					'recipient_postcode'=> $rec['zipcode'] ?? '',
					'is_delivered'     => in_array( $raw_st, [ 'COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE' ], true ) || $pkg_logistics_st === 'LOGISTICS_DELIVERY_DONE',
					'delivered_time'   => ! empty( $package['delivery_time'] ) ? date( 'Y-m-d H:i:s', $package['delivery_time'] ) : null,
					'delivered_ts'     => ! empty( $package['delivery_time'] ) ? (int) $package['delivery_time'] : null,
				];
			}
		}

		// Query tracking info to detect live delivery status
		$tracking       = self::get_tracking_info( $clean );
		$order_status   = $found['order_status'] ?? ( $tracking['logistics_status'] ?: 'UNKNOWN' );
		$is_delivered   = ! empty( $tracking['is_delivered'] ) || in_array( strtoupper( $order_status ), [ 'COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE' ], true ) || ! empty( $found['is_delivered'] );
		$delivered_time = $tracking['delivered_time'] ?? ( $found['delivered_time'] ?? null );
		$delivered_ts   = $tracking['delivered_ts'] ?? ( $found['delivered_ts'] ?? null );

		if ( $found ) {
			return rest_ensure_response([
				'success'          => true,
				'order_sn'         => $found['order_sn'],
				'order_status'     => $is_delivered ? 'COMPLETED' : $order_status,
				'is_delivered'     => $is_delivered,
				'delivered_time'   => $delivered_time,
				'delivered_ts'     => $delivered_ts,
				'buyer_username'   => $found['buyer_username'] ?? '',
				'shipping_carrier' => $found['shipping_carrier'] ?? '',
				'tracking_number'  => $found['tracking_number'] ?? '',
				'items'            => $found['items'] ?? [],
				'already_claimed'  => false,
			]);
		}

		// If live checkpoints were retrieved from Shopee API, return tracking state
		if ( ! empty( $tracking['checkpoints'] ) ) {
			return rest_ensure_response([
				'success'          => true,
				'order_sn'         => $clean,
				'order_status'     => $is_delivered ? 'COMPLETED' : 'IN_TRANSIT',
				'is_delivered'     => $is_delivered,
				'delivered_time'   => $delivered_time,
				'already_claimed'  => false,
			]);
		}

		// Order not found in cache or live query
		return rest_ensure_response([
			'success'          => false,
			'order_sn'         => $clean,
			'order_status'     => 'NOT_FOUND',
			'is_delivered'     => false,
			'already_claimed'  => false,
			'message'          => "Shopee order #{$clean} not found. Please verify your invoice number.",
		]);
	}

	/**
	 * Handle incoming Shopee Push notifications and verification pings
	 */
	public static function rest_handle_webhook( \WP_REST_Request $request ): \WP_REST_Response {
		$method = $request->get_method();

		// Browser or GET health-check verification
		if ( $method === 'GET' ) {
			return new \WP_REST_Response([
				'code'    => 0,
				'status'  => 'active',
				'message' => 'Exacoat Shopee webhook receiver is operational.',
			], 200 );
		}

		$raw_body = $request->get_body();
		$auth_header = $request->get_header( 'authorization' ) ?: ( $_SERVER['HTTP_AUTHORIZATION'] ?? '' );
		$protocol = is_ssl() || ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https' ) ? 'https://' : 'http://';
		$request_url = $protocol . ( $_SERVER['HTTP_HOST'] ?? 'exacoat.com' ) . ( $_SERVER['REQUEST_URI'] ?? '/wp-json/exacoat-core/v1/shopee/webhook' );

		// Parse JSON payload
		$payload = json_decode( $raw_body, true );
		if ( ! is_array( $payload ) ) {
			$payload = $request->get_json_params() ?: [];
		}

		$code = (int) ( $payload['code'] ?? 0 );
		$shop_id = (int) ( $payload['shop_id'] ?? 0 );
		$timestamp = (int) ( $payload['timestamp'] ?? time() );
		$data = $payload['data'] ?? [];

		// Log incoming webhook event to Exacoat_Logger
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_push',
				sprintf( 'Received Shopee Push: Code %d for Shop #%d', $code, $shop_id ),
				[
					'code'          => $code,
					'shop_id'       => $shop_id,
					'timestamp'     => $timestamp,
					'data'          => $data,
					'has_signature' => ! empty( $auth_header ),
					'raw_bytes'     => strlen( $raw_body ),
				]
			);
		}

		// Optional signature verification check
		if ( ! empty( $auth_header ) ) {
			$is_valid_sign = self::verify_push_signature( $request_url, $raw_body, $auth_header );
			if ( ! $is_valid_sign && class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log(
					'warning',
					'shopee_push',
					'Shopee push signature verification mismatch. Processing event with caution.',
					[
						'computed_against' => $request_url,
						'auth_header'      => substr( $auth_header, 0, 12 ) . '...',
					]
				);
			}
		}

		// Process push events by code
		switch ( $code ) {
			case 3:
				// order_status_push: Buyer paid, shipped, completed, or cancelled
				$order_sn = $data['ordersn'] ?? ( $data['order_sn'] ?? '' );
				$status = $data['status'] ?? '';
				if ( ! empty( $order_sn ) ) {
					self::update_order_cache_field( $order_sn, [
						'order_status' => $status,
						'update_time'  => date( 'Y-m-d H:i:s', $data['update_time'] ?? time() ),
					]);
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log(
							'info',
							'shopee_push',
							sprintf( 'Updated order_status to %s for Order SN %s', $status, $order_sn )
						);
					}
				}
				break;

			case 4:
				// order_trackingno_push: Live courier resi assigned or updated
				$order_sn = $data['ordersn'] ?? ( $data['order_sn'] ?? '' );
				$tracking_no = $data['tracking_no'] ?? ( $data['tracking_number'] ?? '' );
				if ( ! empty( $order_sn ) ) {
					self::update_order_cache_field( $order_sn, [
						'tracking_number' => $tracking_no,
					]);
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log(
							'info',
							'shopee_push',
							sprintf( 'Updated tracking_number to %s for Order SN %s', $tracking_no, $order_sn )
						);
					}
				}
				break;

			case 30:
				// package_fulfillment_status_push
				$order_sn = $data['ordersn'] ?? ( $data['order_sn'] ?? '' );
				$package_number = $data['package_number'] ?? '';
				$fulfillment_status = $data['fulfillment_status'] ?? '';
				if ( ! empty( $order_sn ) ) {
					self::update_order_cache_field( $order_sn, [
						'fulfillment_status' => $fulfillment_status,
						'package_number'     => $package_number,
					]);
				}
				break;

			case 1:
				// shop_authorization_push
				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'info', 'shopee_push', "Shop #{$shop_id} authorized via Shopee Push" );
				}
				break;

			case 2:
				// shop_authorization_canceled_push
				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'warning', 'shopee_push', "Shop #{$shop_id} authorization revoked via Shopee Push" );
				}
				break;

			default:
				// Verification test ping or other push codes
				break;
		}

		// Shopee Open Platform expects HTTP 200 with code 0 to acknowledge receipt
		return new \WP_REST_Response([
			'code'    => 0,
			'message' => 'success',
		], 200 );
	}
}

}

