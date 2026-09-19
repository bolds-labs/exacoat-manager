<?php
/**
 * Exacoat Core - TikTok Shop Open Platform API Engine (202309)
 * Connects Exacoat Manager with TikTok Shop Open Platform for Service ID 7686433028542351124.
 * Handles HMAC-SHA256 request signing, OAuth 2.0 token management, order sync,
 * package fulfillment, AWB shipping document retrieval, and warranty verification.
 * Strict Antislop compliant: No em dashes in copy, comments, or strings.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_TikTok_Client' ) ) {

class Exacoat_TikTok_Client {

	const OPTION_KEY          = '_exacoat_tiktok_settings';
	const ORDERS_CACHE_KEY    = '_exacoat_tiktok_orders_cache';
	const DEFAULT_SERVICE_ID  = '7686433028542351124';
	const DEFAULT_WEBHOOK_URL = 'https://exacoat.com/wp-json/exacoat-core/v1/tiktok/webhook';
	const AUTH_BASE_URL       = 'https://auth.tiktok-shops.com';
	const API_BASE_URL        = 'https://open-api.tiktokglobalshop.com';
	const PARTNER_AUTH_URL    = 'https://services.tiktokshop.com/open/authorize';

	/**
	 * Initialize Hooks & REST API Routes
	 */
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Get current TikTok Shop settings
	 */
	public static function get_settings(): array {
		$defaults = [
			'environment'      => 'live', // 'sandbox' | 'live'
			'service_id'       => self::DEFAULT_SERVICE_ID,
			'app_key'          => '6lauu7vv75n01',
			'app_secret'       => '8ddf6cf5571d6c09168bed1b62b60ef56e448e5e',
			'shop_cipher'      => '',
			'shop_id'          => '',
			'shop_name'        => 'Exacoat TikTok Shop',
			'redirect_url'     => 'https://manager.exacoat.com',
			'webhook_url'      => self::DEFAULT_WEBHOOK_URL,
			'access_token'     => '',
			'refresh_token'    => '',
			'token_expires_at' => 0,
			'last_synced_at'   => 0,
		];

		$saved = get_option( self::OPTION_KEY, [] );
		return wp_parse_args( is_array( $saved ) ? $saved : [], $defaults );
	}

	/**
	 * Save updated TikTok Shop settings
	 */
	public static function save_settings( array $settings ): bool {
		$current = self::get_settings();
		$updated = array_merge( $current, $settings );
		return update_option( self::OPTION_KEY, $updated );
	}

	/**
	 * Generate HMAC-SHA256 signature for TikTok Shop Open Platform requests
	 * Formula: hash_hmac('sha256', app_secret + path + sorted_params + body + app_secret, app_secret)
	 */
	public static function generate_signature( string $path, array $params, string $body, string $app_secret ): string {
		// Filter out 'sign' and 'access_token'
		unset( $params['sign'], $params['access_token'] );

		// Sort query parameters alphabetically by key
		ksort( $params );

		$param_str = '';
		foreach ( $params as $k => $v ) {
			$param_str .= $k . (string) $v;
		}

		$base_str = $app_secret . $path . $param_str . $body . $app_secret;
		return hash_hmac( 'sha256', $base_str, $app_secret );
	}

	/**
	 * Generate partner authorization URL for seller consent
	 */
	public static function get_auth_url(): string {
		$s = self::get_settings();
		$service_id = ! empty( $s['service_id'] ) ? $s['service_id'] : self::DEFAULT_SERVICE_ID;
		return self::PARTNER_AUTH_URL . '?service_id=' . rawurlencode( $service_id );
	}

	/**
	 * Exchange authorization code for access_token and refresh_token
	 */
	public static function exchange_code_for_tokens( string $code ): array {
		$s = self::get_settings();
		$app_key = trim( $s['app_key'] );
		$app_secret = trim( $s['app_secret'] );

		if ( empty( $app_key ) || empty( $app_secret ) ) {
			return [
				'success' => false,
				'error'   => 'TikTok App Key and App Secret must be configured before connecting.',
			];
		}

		$url = self::AUTH_BASE_URL . '/api/v2/token/get?' . http_build_query([
			'app_key'    => $app_key,
			'app_secret' => $app_secret,
			'auth_code'  => trim( $code ),
			'grant_type' => 'authorized_code',
		]);

		$res = wp_remote_get( $url, [ 'timeout' => 25 ] );
		if ( is_wp_error( $res ) ) {
			return [ 'success' => false, 'error' => $res->get_error_message() ];
		}

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $data ) || ( isset( $data['code'] ) && (int) $data['code'] !== 0 ) ) {
			return [
				'success' => false,
				'error'   => $data['message'] ?? 'Failed to exchange TikTok authorization code.',
			];
		}

		$token_data = $data['data'] ?? [];
		$access_token = $token_data['access_token'] ?? '';
		$refresh_token = $token_data['refresh_token'] ?? '';
		$expires_in = (int) ( $token_data['access_token_expire_in'] ?? 604800 ); // default 7 days

		if ( empty( $access_token ) ) {
			return [ 'success' => false, 'error' => 'No access token returned from TikTok.' ];
		}

		self::save_settings([
			'access_token'     => $access_token,
			'refresh_token'    => $refresh_token,
			'token_expires_at' => time() + $expires_in,
			'shop_name'        => $token_data['seller_name'] ?? $s['shop_name'],
		]);

		// Immediately fetch authorized shops to retrieve the official shop_cipher
		$shops_res = self::fetch_authorized_shops();
		$final_s = self::get_settings();

		return [
			'success'      => true,
			'access_token' => $access_token,
			'seller_name'  => $token_data['seller_name'] ?? '',
			'shop_cipher'  => $final_s['shop_cipher'] ?? '',
			'shop_name'    => $final_s['shop_name'] ?? '',
			'expire_in'    => $expires_in,
		];
	}

	/**
	 * Fetch Authorized Shops from TikTok Open Platform API
	 * Endpoint: GET /authorization/202309/shops
	 * Resolves the true shop_cipher, shop_id, and shop_name
	 */
	public static function fetch_authorized_shops(): array {
		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			return $token_res;
		}

		$s = self::get_settings();
		$access_token = trim( (string) ( $token_res['access_token'] ?? $s['access_token'] ?? '' ) );
		$app_key      = trim( (string) ( $s['app_key'] ?? '' ) );
		$app_secret   = trim( (string) ( $s['app_secret'] ?? '' ) );

		if ( empty( $access_token ) ) {
			return [
				'success' => false,
				'error'   => 'TikTok Shop is not connected. Please authorize first.',
			];
		}

		if ( empty( $app_key ) || empty( $app_secret ) ) {
			return [
				'success' => false,
				'error'   => 'TikTok App Key and App Secret must be configured.',
			];
		}

		$path      = '/authorization/202309/shops';
		$timestamp = time();

		$query = [
			'app_key'   => $app_key,
			'timestamp' => $timestamp,
		];

		// Do not attach shop_cipher when calling the shops discovery endpoint
		$sign = self::generate_signature( $path, $query, '', $app_secret );
		$query['sign'] = $sign;

		$url = self::API_BASE_URL . $path . '?' . http_build_query( $query );

		$res = wp_remote_get( $url, [
			'headers' => [
				'Content-Type'       => 'application/json',
				'x-tts-access-token' => $access_token,
			],
			'timeout' => 25,
		] );

		if ( is_wp_error( $res ) ) {
			return [ 'success' => false, 'error' => $res->get_error_message() ];
		}

		$raw_body = wp_remote_retrieve_body( $res );
		$data = json_decode( $raw_body, true );

		if ( empty( $data ) || ( isset( $data['code'] ) && (int) $data['code'] !== 0 ) ) {
			$err_msg = (string) ( $data['message'] ?? 'Failed to fetch authorized shops from TikTok.' );
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'tiktok', "fetch_authorized_shops failed: {$err_msg}", [ 'raw' => $data ] );
			}
			return [
				'success' => false,
				'error'   => $err_msg,
				'code'    => $data['code'] ?? -1,
				'raw'     => $data,
			];
		}

		$shops = $data['data']['shops'] ?? ( $data['data']['shop_list'] ?? [] );
		if ( empty( $shops ) && isset( $data['data'][0]['cipher'] ) ) {
			$shops = $data['data'];
		}

		if ( empty( $shops ) ) {
			return [
				'success' => false,
				'error'   => 'No authorized shops found for this TikTok seller account. Please ensure your TikTok seller account authorized this app in Partner Center.',
				'shops'   => [],
			];
		}

		// Prefer first authorized shop or match existing shop_id if available
		$selected_shop = $shops[0];
		if ( ! empty( $s['shop_id'] ) ) {
			foreach ( $shops as $sh ) {
				if ( (string) ( $sh['id'] ?? '' ) === (string) $s['shop_id'] ) {
					$selected_shop = $sh;
					break;
				}
			}
		}

		$shop_cipher = trim( (string) ( $selected_shop['cipher'] ?? ( $selected_shop['shop_cipher'] ?? '' ) ) );
		$shop_id     = trim( (string) ( $selected_shop['id'] ?? ( $selected_shop['shop_id'] ?? '' ) ) );
		$shop_name   = trim( (string) ( $selected_shop['name'] ?? ( $selected_shop['shop_name'] ?? ( $s['shop_name'] ?? 'Exacoat TikTok Shop' ) ) ) );
		$shop_code   = trim( (string) ( $selected_shop['code'] ?? '' ) );

		if ( ! empty( $shop_cipher ) ) {
			self::save_settings([
				'shop_cipher' => $shop_cipher,
				'shop_id'     => $shop_id,
				'shop_name'   => $shop_name,
			]);

			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log(
					'info',
					'tiktok',
					"TikTok shop_cipher successfully resolved: {$shop_name} ({$shop_id}) -> {$shop_cipher}",
					[
						'shop_id'     => $shop_id,
						'shop_name'   => $shop_name,
						'shop_cipher' => $shop_cipher,
						'total_shops' => count( $shops ),
					]
				);
			}
		}

		return [
			'success'     => true,
			'shops'       => $shops,
			'shop_cipher' => $shop_cipher,
			'shop_id'     => $shop_id,
			'shop_name'   => $shop_name,
			'shop_code'   => $shop_code,
		];
	}

	/**
	 * Ensure valid access token, auto-refreshing if expiring within 1 hour
	 */
	public static function ensure_valid_token(): array {
		$s = self::get_settings();
		if ( empty( $s['access_token'] ) ) {
			return [ 'success' => false, 'error' => 'TikTok Shop is not connected. Please authorize first.' ];
		}

		// Valid for more than 1 hour (3600 seconds)
		if ( $s['token_expires_at'] > ( time() + 3600 ) ) {
			return [
				'success'      => true,
				'access_token' => $s['access_token'],
				'shop_cipher'  => $s['shop_cipher'],
			];
		}

		// Token expiring soon or expired, refresh it
		if ( empty( $s['refresh_token'] ) ) {
			return [ 'success' => false, 'error' => 'TikTok refresh token missing. Re-authorization required.' ];
		}

		$app_key = trim( $s['app_key'] );
		$app_secret = trim( $s['app_secret'] );

		$url = self::AUTH_BASE_URL . '/api/v2/token/refresh?' . http_build_query([
			'app_key'       => $app_key,
			'app_secret'    => $app_secret,
			'refresh_token' => $s['refresh_token'],
			'grant_type'    => 'refresh_token',
		]);

		$res = wp_remote_get( $url, [ 'timeout' => 25 ] );
		if ( is_wp_error( $res ) ) {
			return [ 'success' => false, 'error' => $res->get_error_message() ];
		}

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $data ) || ( isset( $data['code'] ) && (int) $data['code'] !== 0 ) ) {
			return [
				'success' => false,
				'error'   => $data['message'] ?? 'Failed to refresh TikTok access token.',
			];
		}

		$token_data = $data['data'] ?? [];
		$new_access = $token_data['access_token'] ?? '';
		$new_refresh = $token_data['refresh_token'] ?? $s['refresh_token'];
		$expires_in = (int) ( $token_data['access_token_expire_in'] ?? 604800 );

		if ( ! empty( $new_access ) ) {
			self::save_settings([
				'access_token'     => $new_access,
				'refresh_token'    => $new_refresh,
				'token_expires_at' => time() + $expires_in,
			]);

			return [
				'success'      => true,
				'access_token' => $new_access,
				'shop_cipher'  => $s['shop_cipher'],
			];
		}

		return [ 'success' => false, 'error' => 'Invalid token structure returned from TikTok refresh API.' ];
	}

	/**
	 * Core TikTok Open API caller with automated signing, token header, and shop_cipher resolution
	 */
	public static function call_api( string $path, string $method = 'GET', array $query = [], array $body = [], int $retry_count = 0 ): array {
		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			return $token_res;
		}

		$s = self::get_settings();
		$access_token = $token_res['access_token'];
		$app_key      = trim( $s['app_key'] );
		$app_secret   = trim( $s['app_secret'] );
		$shop_cipher  = trim( $s['shop_cipher'] );

		// Auto-resolve shop_cipher if empty and calling a shop-scoped endpoint
		if ( empty( $shop_cipher ) && $path !== '/authorization/202309/shops' ) {
			$shops_res = self::fetch_authorized_shops();
			if ( ! empty( $shops_res['shop_cipher'] ) ) {
				$shop_cipher = $shops_res['shop_cipher'];
			} else {
				$reason = ! empty( $shops_res['error'] ) ? $shops_res['error'] : 'Could not detect authorized shop cipher from TikTok.';
				return [
					'success' => false,
					'error'   => "TikTok Shop Cipher is required. {$reason} Please re-authorize TikTok Shop or enter Shop Cipher in Settings.",
					'code'    => 106013,
					'raw'     => $shops_res,
				];
			}
		}

		$timestamp = time();

		$common_query = [
			'app_key'   => $app_key,
			'timestamp' => $timestamp,
		];
		if ( ! empty( $shop_cipher ) && $path !== '/authorization/202309/shops' ) {
			$common_query['shop_cipher'] = $shop_cipher;
		}

		$all_query = array_merge( $common_query, $query );
		$body_str = ( strtoupper( $method ) !== 'GET' && ! empty( $body ) ) ? wp_json_encode( $body ) : '';

		$sign = self::generate_signature( $path, $all_query, $body_str, $app_secret );
		$all_query['sign'] = $sign;

		$url = self::API_BASE_URL . $path . '?' . http_build_query( $all_query );

		$args = [
			'headers' => [
				'Content-Type'       => 'application/json',
				'x-tts-access-token' => $access_token,
			],
			'timeout' => 30,
		];

		if ( strtoupper( $method ) === 'POST' ) {
			$args['body'] = ! empty( $body_str ) ? $body_str : '{}';
			$res = wp_remote_post( $url, $args );
		} else {
			$res = wp_remote_get( $url, $args );
		}

		if ( is_wp_error( $res ) ) {
			return [ 'success' => false, 'error' => $res->get_error_message() ];
		}

		$raw_body = wp_remote_retrieve_body( $res );
		$content_type = wp_remote_retrieve_header( $res, 'content-type' );

		// Check if response is raw PDF stream
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
				'error'   => 'Non-JSON response returned from TikTok API.',
				'raw'     => substr( $raw_body, 0, 300 ),
			];
		}

		// Self-healing: if error says shop_cipher is missing or invalid, try fetching shop_cipher and retrying once
		if ( isset( $data['code'] ) && (int) $data['code'] !== 0 ) {
			$err_msg = (string) ( $data['message'] ?? '' );
			$is_cipher_err = ( (int) $data['code'] === 106013 || str_contains( strtolower( $err_msg ), 'shop_cipher' ) );

			if ( $is_cipher_err && $retry_count < 1 && $path !== '/authorization/202309/shops' ) {
				$shops_res = self::fetch_authorized_shops();
				if ( ! empty( $shops_res['shop_cipher'] ) ) {
					return self::call_api( $path, $method, $query, $body, $retry_count + 1 );
				}
			}

			return [
				'success' => false,
				'error'   => $data['message'] ?? 'TikTok API error',
				'code'    => $data['code'],
				'raw'     => $data,
			];
		}

		return [
			'success'  => true,
			'response' => $data['data'] ?? $data,
		];
	}

	/**
	 * Synchronize orders from TikTok Shop Open Platform
	 */
	public static function sync_orders( int $days_back = 15 ): array {
		$start_time = microtime( true );
		$s = self::get_settings();

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'tiktok_sync',
				sprintf( 'Initiating TikTok order sync (days_back: %d, env: %s)', $days_back, $s['environment'] ),
				[
					'service_id'  => $s['service_id'],
					'shop_cipher' => $s['shop_cipher'],
					'days_back'   => $days_back,
				]
			);
		}

		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			// Gracefully return cached orders if not connected
			$cached = get_option( self::ORDERS_CACHE_KEY, [] );
			if ( ! empty( $cached ) ) {
				return [
					'success'    => true,
					'orders'     => $cached,
					'from_cache' => true,
					'warning'    => $token_res['error'],
				];
			}
			return $token_res;
		}

		$time_to = time();
		$time_from = $time_to - ( $days_back * 86400 );

		// Step 1: Search orders via /order/202309/orders/search
		// page_size is a mandatory URL query parameter in TikTok Shop API 202309 (1-100)
		$search_res = self::call_api( '/order/202309/orders/search', 'POST', [
			'page_size' => 50,
		], [
			'page_size'      => 50,
			'create_time_ge' => $time_from,
			'create_time_lt' => $time_to,
		]);

		if ( ! $search_res['success'] ) {
			return $search_res;
		}

		$raw_list = $search_res['response']['orders'] ?? ( $search_res['response']['order_list'] ?? [] );
		if ( empty( $raw_list ) ) {
			return [
				'success'      => true,
				'orders'       => [],
				'total_synced' => 0,
				'message'      => 'No recent TikTok orders found in the selected time range.',
			];
		}

		$order_ids = array_column( $raw_list, 'id' );
		$order_ids = array_filter( $order_ids );

		if ( empty( $order_ids ) ) {
			return [
				'success'      => true,
				'orders'       => [],
				'total_synced' => 0,
				'message'      => 'No valid order IDs returned from TikTok search.',
			];
		}

		// Step 2: Fetch detailed order objects via /order/202309/orders
		$detail_res = self::call_api( '/order/202309/orders', 'GET', [
			'ids' => implode( ',', array_slice( $order_ids, 0, 50 ) ),
		]);

		$detailed_orders = $detail_res['success'] ? ( $detail_res['response']['orders'] ?? $raw_list ) : $raw_list;
		$normalized_orders = [];

		foreach ( $detailed_orders as $ord ) {
			$order_id = (string) ( $ord['id'] ?? '' );
			if ( empty( $order_id ) ) {
				continue;
			}

			$claim_info = self::check_existing_claim( $order_id );

			$items = [];
			foreach ( ( $ord['line_items'] ?? ( $ord['item_list'] ?? [] ) ) as $item ) {
				$items[] = [
					'item_id'    => (string) ( $item['id'] ?? ( $item['item_id'] ?? '' ) ),
					'item_name'  => trim( (string) ( $item['product_name'] ?? ( $item['item_name'] ?? 'Exacoat Skin' ) ) ),
					'sku_id'     => (string) ( $item['sku_id'] ?? '' ),
					'sku_name'   => trim( (string) ( $item['sku_name'] ?? ( $item['model_name'] ?? '' ) ) ),
					'quantity'   => (int) ( $item['quantity'] ?? 1 ),
					'price'      => (float) ( $item['sale_price'] ?? ( $item['item_price'] ?? 0 ) ),
					'image_url'  => (string) ( $item['sku_image'] ?? ( $item['image_url'] ?? '' ) ),
				];
			}

			$rec = $ord['recipient_address'] ?? [];
			$packages = $ord['packages'] ?? ( $ord['package_list'] ?? [] );
			$package = $packages[0] ?? [];

			$raw_status = (string) ( $ord['status'] ?? ( $ord['order_status'] ?? 'UNKNOWN' ) );

			$normalized_orders[] = [
				'order_id'           => $order_id,
				'order_sn'           => $order_id,
				'order_status'       => $raw_status,
				'create_time'        => ! empty( $ord['create_time'] ) ? date( 'Y-m-d H:i:s', is_numeric( $ord['create_time'] ) && strlen( (string) $ord['create_time'] ) > 10 ? (int) ( $ord['create_time'] / 1000 ) : (int) $ord['create_time'] ) : date( 'Y-m-d H:i:s' ),
				'create_timestamp'   => ! empty( $ord['create_time'] ) && is_numeric( $ord['create_time'] ) && strlen( (string) $ord['create_time'] ) > 10 ? (int) ( $ord['create_time'] / 1000 ) : (int) ( $ord['create_time'] ?? time() ),
				'pay_time'           => ! empty( $ord['paid_time'] ) ? date( 'Y-m-d H:i:s', (int) ( $ord['paid_time'] / 1000 ) ) : null,
				'buyer_username'     => (string) ( $ord['buyer_email'] ?? ( $rec['name'] ?? 'TikTok Customer' ) ),
				'buyer_uid'          => (string) ( $ord['buyer_uid'] ?? '' ),
				'total_amount'       => (float) ( $ord['payment']['total_amount'] ?? ( $ord['total_amount'] ?? 0 ) ),
				'currency'           => (string) ( $ord['payment']['currency'] ?? 'IDR' ),
				'shipping_carrier'   => (string) ( $package['shipping_provider_name'] ?? ( $ord['shipping_provider'] ?? 'J&T / Ninja Van' ) ),
				'tracking_number'    => (string) ( $package['tracking_number'] ?? ( $ord['tracking_number'] ?? '' ) ),
				'package_id'         => (string) ( $package['id'] ?? ( $package['package_id'] ?? '' ) ),
				'buyer_note'         => (string) ( $ord['buyer_message'] ?? ( $ord['note'] ?? '' ) ),
				'recipient_name'     => (string) ( $rec['name'] ?? 'TikTok Customer' ),
				'recipient_phone'    => (string) ( $rec['phone_number'] ?? ( $rec['phone'] ?? '' ) ),
				'recipient_address'  => (string) ( $rec['full_address'] ?? ( $rec['address_line1'] ?? '' ) ),
				'recipient_city'     => (string) ( $rec['district_info'][2]['address_name'] ?? ( $rec['city'] ?? '' ) ),
				'recipient_postcode' => (string) ( $rec['postal_code'] ?? ( $rec['zipcode'] ?? '' ) ),
				'items'              => $items,
				'already_claimed'    => $claim_info['already_claimed'],
				'existing_claim'     => $claim_info,
			];
		}

		update_option( self::ORDERS_CACHE_KEY, $normalized_orders );
		self::save_settings([ 'last_synced_at' => time() ]);

		$elapsed = round( microtime( true ) - $start_time, 2 );

		return [
			'success'      => true,
			'orders'       => $normalized_orders,
			'total_synced' => count( $normalized_orders ),
			'synced_at'    => date( 'Y-m-d H:i:s' ),
			'elapsed'      => $elapsed,
		];
	}

	/**
	 * Update specific order fields in the cached orders list
	 */
	public static function update_order_cache_field( string $order_id, array $fields ): bool {
		$clean_id = trim( preg_replace( '/^#+/', '', $order_id ) );
		if ( empty( $clean_id ) || empty( $fields ) ) {
			return false;
		}

		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		if ( ! is_array( $cached ) ) {
			$cached = [];
		}

		$found = false;
		foreach ( $cached as &$ord ) {
			if ( strcasecmp( $ord['order_id'] ?? '', $clean_id ) === 0 || strcasecmp( $ord['order_sn'] ?? '', $clean_id ) === 0 ) {
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
	 * Check if a TikTok Order ID has already been claimed for Warranty or Redeem in WooCommerce
	 */
	public static function check_existing_claim( string $order_id ): array {
		$clean = trim( preg_replace( '/^#+/', '', $order_id ) );
		if ( empty( $clean ) ) {
			return [ 'already_claimed' => false ];
		}

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
				'already_claimed'    => true,
				'existing_order_id'  => $ord->get_id(),
				'existing_order_num' => $ord->get_order_number(),
				'claim_type'         => $is_redeem ? 'Redeem' : 'Warranty',
				'created_at'         => $ord->get_date_created() ? $ord->get_date_created()->date( 'Y-m-d H:i' ) : '',
			];
		}

		return [ 'already_claimed' => false ];
	}

	/**
	 * Arrange shipment / Ship Package in TikTok Shop
	 */
	public static function ship_package( string $package_id, array $ship_data = [] ): array {
		$clean_pid = trim( $package_id );
		if ( empty( $clean_pid ) ) {
			return [ 'success' => false, 'error' => 'Package ID is required.' ];
		}

		$body = [
			'pick_up_type' => (int) ( $ship_data['pick_up_type'] ?? 1 ), // 1: Dropoff, 2: Pickup
		];

		if ( ! empty( $ship_data['tracking_number'] ) ) {
			$body['self_shipment'] = [
				'tracking_number'      => trim( $ship_data['tracking_number'] ),
				'shipping_provider_id' => $ship_data['shipping_provider_id'] ?? '',
			];
		}

		$res = self::call_api( "/fulfillment/202309/packages/{$clean_pid}/ship", 'POST', [], $body );
		if ( ! $res['success'] ) {
			return $res;
		}

		$order_id = $ship_data['order_id'] ?? '';
		if ( ! empty( $order_id ) ) {
			self::update_order_cache_field( $order_id, [
				'order_status'    => 'AWAITING_COLLECTION',
				'tracking_number' => $ship_data['tracking_number'] ?? '',
			]);
		}

		return [
			'success'    => true,
			'package_id' => $clean_pid,
			'message'    => 'Package marked as shipped successfully.',
		];
	}

	/**
	 * Download official TikTok shipping document (AWB PDF)
	 */
	public static function download_shipping_document( string $package_id, string $doc_size = 'A6' ): array {
		$clean_pid = trim( $package_id );
		if ( empty( $clean_pid ) ) {
			return [ 'success' => false, 'error' => 'Package ID is required.' ];
		}

		$res = self::call_api( "/fulfillment/202309/packages/{$clean_pid}/shipping_documents", 'GET', [
			'document_type' => 'SL', // Shipping Label
			'document_size' => $doc_size,
		]);

		if ( ! $res['success'] ) {
			return $res;
		}

		// TikTok API returns doc_url in JSON response
		$doc_url = $res['response']['doc_url'] ?? '';
		if ( empty( $doc_url ) ) {
			return [ 'success' => false, 'error' => 'Shipping document URL not yet available from TikTok courier.' ];
		}

		// Fetch the PDF binary stream
		$pdf_res = wp_remote_get( $doc_url, [ 'timeout' => 30 ] );
		if ( is_wp_error( $pdf_res ) ) {
			return [
				'success' => true,
				'doc_url' => $doc_url,
				'warning' => 'Direct download failed, open link directly.',
			];
		}

		$pdf_data = wp_remote_retrieve_body( $pdf_res );
		return [
			'success'      => true,
			'is_pdf'       => true,
			'content_type' => 'application/pdf',
			'pdf_data'     => $pdf_data,
			'doc_url'      => $doc_url,
		];
	}

	/**
	 * Register REST API Routes
	 */
	public static function register_routes(): void {
		$ns = 'exacoat-core/v1';

		// 1. GET & POST /tiktok/settings
		register_rest_route( $ns, '/tiktok/settings', [
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

		// 2. GET /tiktok/auth-url
		register_rest_route( $ns, '/tiktok/auth-url', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_auth_url' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 3. GET & POST /tiktok/callback
		register_rest_route( $ns, '/tiktok/callback', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ __CLASS__, 'rest_handle_callback' ],
			'permission_callback' => '__return_true',
		]);

		// 4. GET /tiktok/orders
		register_rest_route( $ns, '/tiktok/orders', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_orders' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 5. POST /tiktok/sync
		register_rest_route( $ns, '/tiktok/sync', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_sync_orders' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 6. POST /tiktok/ship-package
		register_rest_route( $ns, '/tiktok/ship-package', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_ship_package' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 7. GET /tiktok/shipping-document
		register_rest_route( $ns, '/tiktok/shipping-document', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_download_shipping_document' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 8. GET /tiktok/verify-order (public claim check)
		register_rest_route( $ns, '/tiktok/verify-order', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_verify_order' ],
			'permission_callback' => '__return_true',
		]);

		// 9. GET & POST /tiktok/webhook
		register_rest_route( $ns, '/tiktok/webhook', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ __CLASS__, 'rest_handle_webhook' ],
			'permission_callback' => '__return_true',
		]);

		// 10. GET & POST /tiktok/refresh-shops
		register_rest_route( $ns, '/tiktok/refresh-shops', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ __CLASS__, 'rest_refresh_shops' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 11. GET /tiktok/tracking-info (live logistics checkpoints and delivery detection)
		register_rest_route( $ns, '/tiktok/tracking-info', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_tracking_info' ],
			'permission_callback' => '__return_true',
		]);
	}

	public static function rest_refresh_shops( \WP_REST_Request $request ): \WP_REST_Response {
		$res = self::fetch_authorized_shops();
		return rest_ensure_response( $res );
	}

	public static function check_admin_permission(): bool {
		return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
	}

	public static function rest_get_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$s = self::get_settings();
		$masked_secret = ! empty( $s['app_secret'] ) ? substr( $s['app_secret'], 0, 8 ) . '...' . substr( $s['app_secret'], -4 ) : '';

		return rest_ensure_response([
			'success'          => true,
			'environment'      => $s['environment'],
			'service_id'       => $s['service_id'],
			'app_key'          => $s['app_key'],
			'app_secret'       => $masked_secret,
			'has_secret'       => ! empty( $s['app_secret'] ),
			'shop_cipher'      => $s['shop_cipher'],
			'shop_name'        => $s['shop_name'],
			'redirect_url'     => $s['redirect_url'],
			'webhook_url'      => $s['webhook_url'],
			'is_connected'     => ! empty( $s['access_token'] ),
			'token_expires_at' => $s['token_expires_at'],
			'is_expired'       => $s['token_expires_at'] > 0 && time() >= $s['token_expires_at'],
			'last_synced_at'   => $s['last_synced_at'] ? date( 'Y-m-d H:i:s', $s['last_synced_at'] ) : null,
		]);
	}

	public static function rest_save_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$params = $request->get_json_params() ?: [];
		$updates = [];

		if ( isset( $params['environment'] ) && in_array( $params['environment'], [ 'sandbox', 'live' ], true ) ) {
			$updates['environment'] = $params['environment'];
		}
		if ( isset( $params['service_id'] ) ) {
			$updates['service_id'] = sanitize_text_field( $params['service_id'] );
		}
		if ( isset( $params['app_key'] ) ) {
			$updates['app_key'] = sanitize_text_field( $params['app_key'] );
		}
		if ( ! empty( $params['app_secret'] ) && ! str_contains( $params['app_secret'], '...' ) ) {
			$updates['app_secret'] = trim( $params['app_secret'] );
		}
		if ( isset( $params['shop_cipher'] ) ) {
			$updates['shop_cipher'] = sanitize_text_field( $params['shop_cipher'] );
		}
		if ( isset( $params['shop_name'] ) ) {
			$updates['shop_name'] = sanitize_text_field( $params['shop_name'] );
		}

		self::save_settings( $updates );

		return rest_ensure_response([
			'success' => true,
			'message' => 'TikTok Shop settings updated successfully.',
		]);
	}

	public static function rest_get_auth_url( \WP_REST_Request $request ): \WP_REST_Response {
		return rest_ensure_response([
			'success'  => true,
			'auth_url' => self::get_auth_url(),
		]);
	}

	public static function rest_handle_callback( \WP_REST_Request $request ): \WP_REST_Response {
		$code = $request->get_param( 'code' );
		if ( empty( $code ) ) {
			return new \WP_REST_Response([ 'success' => false, 'error' => 'Missing authorization code in query parameters.' ], 400 );
		}

		$result = self::exchange_code_for_tokens( $code );
		if ( ! $result['success'] ) {
			return new \WP_REST_Response( $result, 400 );
		}

		if ( str_contains( $_SERVER['HTTP_ACCEPT'] ?? '', 'text/html' ) ) {
			echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TikTok Shop Connected</title>' .
				'<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0d0d;color:#fff;margin:0} ' .
				'.card{background:#181818;padding:32px;border-radius:16px;border:1px solid #333;text-align:center;max-width:400px} ' .
				'.btn{background:#FE2C55;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:16px}</style></head>' .
				'<body><div class="card"><h2 style="color:#00f2fe;margin:0 0 12px">TikTok Shop Connected!</h2>' .
				'<p style="color:#aaa;font-size:14px;margin:0 0 16px">Store successfully linked with Exacoat Manager.</p>' .
				'<button class="btn" onclick="if(window.opener){window.opener.postMessage({tiktok_connected:true},\"*\");window.close();}else{window.location.href=\"https://manager.exacoat.com/#orders\";}">Return to Manager</button>' .
				'<script>if(window.opener){window.opener.postMessage({tiktok_connected:true},\"*\");setTimeout(function(){window.close();},1500);}</script>' .
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

		$filtered = $cached;
		if ( ! empty( $status ) && $status !== 'all' ) {
			$status_upper = strtoupper( $status );
			$filtered = array_filter( $filtered, function( $o ) use ( $status_upper ) {
				$st = strtoupper( $o['order_status'] ?? '' );
				if ( $status_upper === 'READY_TO_SHIP' ) {
					return in_array( $st, [ 'AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP' ], true );
				}
				return $st === $status_upper;
			});
		}

		if ( ! empty( $search ) ) {
			$search_lower = strtolower( $search );
			$filtered = array_filter( $filtered, function( $o ) use ( $search_lower ) {
				$oid = strtolower( $o['order_id'] ?? '' );
				$buyer = strtolower( $o['buyer_username'] ?? '' );
				$resi = strtolower( $o['tracking_number'] ?? '' );
				$prod = '';
				foreach ( ( $o['items'] ?? [] ) as $item ) {
					$prod .= ' ' . strtolower( ( $item['item_name'] ?? '' ) . ' ' . ( $item['sku_name'] ?? '' ) );
				}
				return str_contains( $oid, $search_lower ) || str_contains( $buyer, $search_lower ) || str_contains( $resi, $search_lower ) || str_contains( $prod, $search_lower );
			});
		}

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
			'shop_name'      => $s['shop_name'],
		]);
	}

	public static function rest_sync_orders( \WP_REST_Request $request ): \WP_REST_Response {
		$days = (int) ( $request->get_param( 'days' ) ?: 15 );
		$res = self::sync_orders( $days );
		return rest_ensure_response( $res );
	}

	public static function rest_ship_package( \WP_REST_Request $request ): \WP_REST_Response {
		$params = $request->get_json_params() ?: [];
		$package_id = trim( (string) ( $params['package_id'] ?? $request->get_param( 'package_id' ) ) );
		$res = self::ship_package( $package_id, $params );
		return rest_ensure_response( $res );
	}

	public static function rest_download_shipping_document( \WP_REST_Request $request ) {
		$package_id = trim( (string) $request->get_param( 'package_id' ) );
		$doc_size   = sanitize_text_field( $request->get_param( 'document_size' ) ?: 'A6' );

		$res = self::download_shipping_document( $package_id, $doc_size );

		if ( ! empty( $res['is_pdf'] ) && ! empty( $res['pdf_data'] ) ) {
			header( 'Content-Type: application/pdf' );
			header( 'Content-Disposition: inline; filename="tiktok-awb-' . $package_id . '.pdf"' );
			header( 'Content-Length: ' . strlen( $res['pdf_data'] ) );
			echo $res['pdf_data'];
			exit;
		}

		return rest_ensure_response( $res );
	}

	/**
	 * Retrieve tracking timeline checkpoints and detect true delivery status
	 */
	public static function get_tracking_info( string $order_id ): array {
		$clean_id = trim( preg_replace( '/^#+/', '', $order_id ) );
		if ( empty( $clean_id ) ) {
			return [
				'success' => false,
				'error'   => 'Order ID is required.',
			];
		}

		$cached_orders = get_option( self::ORDERS_CACHE_KEY, [] );
		$cached_order  = null;
		foreach ( (array) $cached_orders as $ord ) {
			if ( strcasecmp( $ord['order_id'] ?? '', $clean_id ) === 0 || strcasecmp( $ord['order_sn'] ?? '', $clean_id ) === 0 ) {
				$cached_order = $ord;
				break;
			}
		}

		$checkpoints    = [];
		$is_delivered   = false;
		$delivered_time = null;
		$delivered_ts   = null;

		// 1. Query TikTok Shop API if package_id exists
		$package_id = $cached_order['package_id'] ?? '';
		if ( ! empty( $package_id ) ) {
			$track_res = self::call_api( "/fulfillment/202309/packages/{$package_id}/tracking", 'GET' );
			if ( ! empty( $track_res['success'] ) && ! empty( $track_res['response'] ) ) {
				$raw_events = $track_res['response']['tracking_events'] ?? ( $track_res['response']['events'] ?? [] );
				if ( is_array( $raw_events ) && ! empty( $raw_events ) ) {
					usort( $raw_events, function( $a, $b ) {
						return ( (int) ( $b['update_time'] ?? 0 ) ) <=> ( (int) ( $a['update_time'] ?? 0 ) );
					});

					foreach ( $raw_events as $ev ) {
						$ev_ts = (int) ( $ev['update_time'] ?? ( $ev['event_time'] ?? 0 ) );
						if ( strlen( (string) $ev_ts ) > 10 ) {
							$ev_ts = (int) ( $ev_ts / 1000 );
						}
						$ev_desc = trim( (string) ( $ev['description'] ?? ( $ev['event_name'] ?? '' ) ) );
						$ev_type = strtoupper( (string) ( $ev['event_type'] ?? '' ) );

						$stage = 'in_transit';
						$desc_lower = strtolower( $ev_desc );
						if (
							str_contains( $ev_type, 'DELIVERED' ) ||
							str_contains( $ev_type, 'COMPLETED' ) ||
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
						} elseif ( str_contains( $ev_type, 'PICKUP' ) || str_contains( $desc_lower, 'pickup' ) || str_contains( $desc_lower, 'diserahkan' ) ) {
							$stage = 'pickup';
						}

						$checkpoints[] = [
							'time'        => $ev_ts ? date( 'Y-m-d H:i:s', $ev_ts ) : '',
							'timestamp'   => $ev_ts,
							'description' => $ev_desc,
							'stage'       => $stage,
						];
					}
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
			self::update_order_cache_field( $clean_id, [
				'order_status'   => 'COMPLETED',
				'delivered_time' => $delivered_time,
			]);
		}

		return [
			'success'          => true,
			'order_id'         => $clean_id,
			'tracking_number'  => $cached_order['tracking_number'] ?? '',
			'shipping_carrier' => $cached_order['shipping_carrier'] ?? '',
			'is_delivered'     => $is_delivered,
			'delivered_time'   => $delivered_time,
			'delivered_ts'     => $delivered_ts,
			'checkpoints'      => $checkpoints,
		];
	}

	public static function rest_get_tracking_info( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id = trim( (string) $request->get_param( 'order_id' ) );
		$res = self::get_tracking_info( $order_id );
		return rest_ensure_response( $res );
	}

	public static function rest_verify_order( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id = trim( (string) $request->get_param( 'order_id' ) );
		$clean = preg_replace( '/^#+/', '', $order_id );

		if ( empty( $clean ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'TikTok order number / invoice is required.',
			], 400 );
		}

		$claim_info = self::check_existing_claim( $clean );
		if ( $claim_info['already_claimed'] ) {
			return rest_ensure_response([
				'success'             => false,
				'already_claimed'     => true,
				'message'             => "This TikTok Shop invoice ({$clean}) has already been processed for replacement under Order #{$claim_info['existing_order_num']} ({$claim_info['claim_type']}).",
				'existing_order_num'  => $claim_info['existing_order_num'],
				'existing_order_type' => $claim_info['claim_type'],
			]);
		}

		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		$found = null;
		foreach ( (array) $cached as $ord ) {
			if ( strcasecmp( $ord['order_id'] ?? '', $clean ) === 0 || strcasecmp( $ord['order_sn'] ?? '', $clean ) === 0 ) {
				$found = $ord;
				break;
			}
		}

		// Query live tracking info to detect real delivery status
		$tracking       = self::get_tracking_info( $clean );
		$order_status   = $found['order_status'] ?? 'UNKNOWN';
		$is_delivered   = ! empty( $tracking['is_delivered'] ) || in_array( strtoupper( $order_status ), [ 'COMPLETED', 'DELIVERED' ], true );
		$delivered_time = $tracking['delivered_time'] ?? ( $found['delivered_time'] ?? null );

		if ( $found ) {
			return rest_ensure_response([
				'success'          => true,
				'order_id'         => $found['order_id'],
				'order_status'     => $is_delivered ? 'COMPLETED' : $order_status,
				'is_delivered'     => $is_delivered,
				'delivered_time'   => $delivered_time,
				'buyer_username'   => $found['buyer_username'] ?? '',
				'shipping_carrier' => $found['shipping_carrier'] ?? '',
				'tracking_number'  => $found['tracking_number'] ?? '',
				'items'            => $found['items'] ?? [],
				'already_claimed'  => false,
			]);
		}

		// If live checkpoints were retrieved, return tracking state
		if ( ! empty( $tracking['checkpoints'] ) ) {
			return rest_ensure_response([
				'success'          => true,
				'order_id'         => $clean,
				'order_status'     => $is_delivered ? 'COMPLETED' : 'IN_TRANSIT',
				'is_delivered'     => $is_delivered,
				'delivered_time'   => $delivered_time,
				'already_claimed'  => false,
			]);
		}

		return rest_ensure_response([
			'success'          => false,
			'order_id'         => $clean,
			'order_status'     => 'NOT_FOUND',
			'is_delivered'     => false,
			'already_claimed'  => false,
			'message'          => "TikTok Shop order #{$clean} not found. Please verify your invoice number.",
		]);
	}

	public static function rest_handle_webhook( \WP_REST_Request $request ): \WP_REST_Response {
		if ( $request->get_method() === 'GET' ) {
			return new \WP_REST_Response([
				'code'    => 0,
				'status'  => 'active',
				'message' => 'Exacoat TikTok Shop webhook receiver is operational.',
			], 200 );
		}

		$raw_body = $request->get_body();
		$payload = json_decode( $raw_body, true ) ?: ( $request->get_json_params() ?: [] );

		$type = (string) ( $payload['type'] ?? ( $payload['event'] ?? '' ) );
		$data = $payload['data'] ?? [];

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'tiktok_webhook',
				sprintf( 'Received TikTok Webhook: Event %s', $type ?: 'Ping' ),
				[
					'type' => $type,
					'data' => $data,
				]
			);
		}

		if ( $type === 'ORDER_STATUS_CHANGE' ) {
			$order_id = $data['order_id'] ?? '';
			$status = $data['order_status'] ?? '';
			if ( ! empty( $order_id ) && ! empty( $status ) ) {
				self::update_order_cache_field( $order_id, [ 'order_status' => $status ] );
			}
		} elseif ( $type === 'PACKAGE_UPDATE' ) {
			$order_id = $data['order_id'] ?? '';
			$tracking = $data['tracking_number'] ?? '';
			if ( ! empty( $order_id ) && ! empty( $tracking ) ) {
				self::update_order_cache_field( $order_id, [ 'tracking_number' => $tracking ] );
			}
		}

		return new \WP_REST_Response([
			'code'    => 0,
			'message' => 'success',
		], 200 );
	}
}

}
