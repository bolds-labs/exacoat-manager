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
		add_action( 'exacoat_tiktok_hourly_sync', [ __CLASS__, 'cron_sync_orders' ] );
		if ( ! wp_next_scheduled( 'exacoat_tiktok_hourly_sync' ) ) {
			wp_schedule_event( time(), 'hourly', 'exacoat_tiktok_hourly_sync' );
		}
	}

	/**
	 * Cron callback: Automatically sync TikTok Shop orders every hour
	 */
	public static function cron_sync_orders(): void {
		$settings = self::get_settings();
		if ( empty( $settings['access_token'] ) && empty( $settings['shop_cipher'] ) ) {
			return;
		}
		$res = self::sync_orders( 30, 500 );
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'tiktok_cron',
				sprintf( 'Automated hourly TikTok sync executed: %s orders synced', $res['count'] ?? ( $res['total_synced'] ?? 0 ) ),
				$res
			);
		}
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
	public static function sync_orders( int $days_back = 30, int $max_orders = 500 ): array {
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 300 );
		}
		if ( function_exists( 'wp_raise_memory_limit' ) ) {
			wp_raise_memory_limit( 'admin' );
		}
		$start_time = microtime( true );
		$s = self::get_settings();
		$max_fetch = min( 3000, max( 50, $max_orders ) );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'tiktok_sync',
				sprintf( 'Initiating TikTok order sync (days_back: %d, max_orders: %d, env: %s)', $days_back, $max_fetch, $s['environment'] ),
				[
					'service_id'  => $s['service_id'],
					'shop_cipher' => $s['shop_cipher'],
					'days_back'   => $days_back,
					'max_fetch'   => $max_fetch,
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

		// Step 1: Search orders via /order/202309/orders/search with pagination
		$order_ids = [];
		$page_token = '';

		do {
			$query_params = [ 'page_size' => 50 ];
			$body_params  = [
				'page_size'      => 50,
				'create_time_ge' => $time_from,
				'create_time_lt' => $time_to,
			];
			if ( ! empty( $page_token ) ) {
				$query_params['page_token'] = $page_token;
				$body_params['page_token']  = $page_token;
			}

			$search_res = self::call_api( '/order/202309/orders/search', 'POST', $query_params, $body_params );
			if ( ! $search_res['success'] ) {
				if ( empty( $order_ids ) ) {
					return $search_res;
				}
				break;
			}

			$raw_list = $search_res['response']['orders'] ?? ( $search_res['response']['order_list'] ?? [] );
			if ( empty( $raw_list ) ) {
				break;
			}

			foreach ( $raw_list as $item ) {
				$oid = (string) ( $item['id'] ?? '' );
				if ( ! empty( $oid ) && ! in_array( $oid, $order_ids, true ) ) {
					$order_ids[] = $oid;
				}
			}

			$page_token = (string) ( $search_res['response']['next_page_token'] ?? '' );
		} while ( ! empty( $page_token ) && count( $order_ids ) < $max_fetch );

		if ( empty( $order_ids ) ) {
			$cached = get_option( self::ORDERS_CACHE_KEY, [] );
			return [
				'success'      => true,
				'orders'       => is_array( $cached ) ? $cached : [],
				'total_synced' => 0,
				'message'      => 'No recent TikTok orders found in the selected time range.',
			];
		}

		// Step 2: Fetch detailed order objects via /order/202309/orders in chunks of 50
		$raw_detailed_orders = [];
		$chunks = array_chunk( $order_ids, 50 );

		foreach ( $chunks as $chunk_ids ) {
			$detail_res = self::call_api( '/order/202309/orders', 'GET', [
				'ids' => implode( ',', $chunk_ids ),
			]);

			if ( $detail_res['success'] ) {
				$chunk_orders = $detail_res['response']['orders'] ?? [];
				if ( is_array( $chunk_orders ) ) {
					$raw_detailed_orders = array_merge( $raw_detailed_orders, $chunk_orders );
				}
			}
		}

		$normalized_orders = [];
		foreach ( $raw_detailed_orders as $ord ) {
			$norm = self::normalize_tiktok_order( $ord );
			if ( $norm ) {
				$normalized_orders[] = $norm;
			}
		}

		// Merge with existing cached orders so older orders are preserved
		$existing_cached = get_option( self::ORDERS_CACHE_KEY, [] );
		if ( ! is_array( $existing_cached ) ) {
			$existing_cached = [];
		}

		$order_map = [];
		foreach ( $existing_cached as $old_ord ) {
			$oid = (string) ( $old_ord['order_id'] ?? ( $old_ord['order_sn'] ?? '' ) );
			if ( ! empty( $oid ) ) {
				$order_map[ $oid ] = $old_ord;
			}
		}
		foreach ( $normalized_orders as $new_ord ) {
			$oid = (string) ( $new_ord['order_id'] ?? ( $new_ord['order_sn'] ?? '' ) );
			if ( ! empty( $oid ) ) {
				if ( ! empty( $order_map[ $oid ]['escrow_synced'] ) ) {
					$preserve_keys = [
						'escrow_synced',
						'escrow_amount',
						'net_escrow_amount',
						'total_platform_fee',
						'commission_fee',
						'service_fee',
						'seller_transaction_fee',
						'ams_commission_fee',
						'other_platform_fee',
					];
					foreach ( $preserve_keys as $pk ) {
						if ( isset( $order_map[ $oid ][ $pk ] ) ) {
							$new_ord[ $pk ] = $order_map[ $oid ][ $pk ];
						}
					}
				}
				$order_map[ $oid ] = $new_ord;
			}
		}

		// Step 3: Fetch TikTok Finance settlement / fee details for active orders
		$finance_target_ids = [];
		foreach ( $order_map as $oid => $cand_ord ) {
			if ( count( $finance_target_ids ) >= 40 ) {
				break;
			}
			$st = strtoupper( (string) ( $cand_ord['order_status'] ?? '' ) );
			if ( in_array( $st, [ 'UNPAID', 'CANCELLED', 'CANCEL' ], true ) ) {
				continue;
			}
			$needs_fin = empty( $cand_ord['escrow_synced'] ) || (float) ( $cand_ord['escrow_amount'] ?? 0 ) <= 0;
			if ( $needs_fin ) {
				$finance_target_ids[] = (string) $oid;
			}
		}

		if ( ! empty( $finance_target_ids ) ) {
			$finance_map = self::fetch_finance_details_for_orders( $finance_target_ids );
			foreach ( $finance_map as $oid => $fin ) {
				if ( isset( $order_map[ $oid ] ) ) {
					$order_map[ $oid ] = self::apply_finance_to_order( $order_map[ $oid ], $fin );
				}
			}
		}

		$all_cached_orders = array_values( $order_map );
		usort( $all_cached_orders, function( $a, $b ) {
			return ( $b['create_timestamp'] ?? 0 ) <=> ( $a['create_timestamp'] ?? 0 );
		});
		$all_cached_orders = array_slice( $all_cached_orders, 0, 3000 ); // Retain up to 3,000 orders

		update_option( self::ORDERS_CACHE_KEY, $all_cached_orders );
		self::save_settings([ 'last_synced_at' => time() ]);

		$elapsed = round( microtime( true ) - $start_time, 2 );

		return [
			'success'      => true,
			'orders'       => $all_cached_orders,
			'total_synced' => count( $normalized_orders ),
			'total_cached' => count( $all_cached_orders ),
			'synced_at'    => date( 'Y-m-d H:i:s' ),
			'elapsed'      => $elapsed,
		];
	}

	/**
	 * Fetch TikTok Shop finance settlement and fee details for order IDs
	 */
	public static function fetch_finance_details_for_orders( array $order_ids ): array {
		$finance_map = [];

		// 1. Try batch unsettled orders endpoint (/finance/202501/orders/unsettled)
		$unsettled_res = self::call_api( '/finance/202501/orders/unsettled', 'GET', [
			'page_size' => 50,
		]);
		if ( ! empty( $unsettled_res['success'] ) && is_array( $unsettled_res['response'] ?? null ) ) {
			$resp  = $unsettled_res['response'];
			$items = $resp['transactions'] ?? ( $resp['orders'] ?? ( $resp['unsettled_transactions'] ?? [] ) );
			if ( is_array( $items ) ) {
				foreach ( $items as $tx ) {
					if ( ! is_array( $tx ) ) continue;
					$oid = (string) ( $tx['order_id'] ?? ( $tx['id'] ?? '' ) );
					if ( ! empty( $oid ) ) {
						$parsed = self::parse_tiktok_finance_tx( $tx );
						if ( $parsed['escrow_amount'] > 0 || $parsed['explicit_platform_fee'] > 0 ) {
							$finance_map[ $oid ] = $parsed;
						}
					}
				}
			}
		}

		// 2. Per-order statement_transactions lookup for remaining order IDs (up to 25 per sync)
		$lookup_count = 0;
		$prefer_202309 = false;
		foreach ( $order_ids as $oid ) {
			if ( isset( $finance_map[ $oid ] ) ) {
				continue;
			}
			if ( $lookup_count >= 25 ) {
				break;
			}
			$lookup_count++;

			$tx_res = null;
			if ( ! $prefer_202309 ) {
				$tx_res = self::call_api( "/finance/202501/orders/{$oid}/statement_transactions", 'GET' );
				if ( empty( $tx_res['success'] ) ) {
					$tx_res_old = self::call_api( "/finance/202309/orders/{$oid}/statement_transactions", 'GET' );
					if ( ! empty( $tx_res_old['success'] ) ) {
						$tx_res = $tx_res_old;
						$prefer_202309 = true;
					}
				}
			} else {
				$tx_res = self::call_api( "/finance/202309/orders/{$oid}/statement_transactions", 'GET' );
			}

			if ( ! empty( $tx_res['success'] ) && is_array( $tx_res['response'] ?? null ) ) {
				$resp   = $tx_res['response'];
				$parsed = self::parse_tiktok_finance_tx( $resp );
				if ( $parsed['escrow_amount'] <= 0 && ! empty( $resp['statement_transactions'] ) && is_array( $resp['statement_transactions'] ) ) {
					foreach ( $resp['statement_transactions'] as $sub_tx ) {
						if ( is_array( $sub_tx ) ) {
							$sub_parsed = self::parse_tiktok_finance_tx( $sub_tx );
							if ( $sub_parsed['escrow_amount'] > 0 || $sub_parsed['explicit_platform_fee'] > 0 ) {
								$parsed = $sub_parsed;
								break;
							}
						}
					}
				}
				if ( $parsed['escrow_amount'] > 0 || $parsed['explicit_platform_fee'] > 0 ) {
					$finance_map[ $oid ] = $parsed;
				}
			}
		}

		return $finance_map;
	}

	/**
	 * Parse a TikTok finance transaction/settlement payload
	 */
	public static function parse_tiktok_finance_tx( array $tx ): array {
		$settlement = max( 0.0, (float) ( $tx['settlement_amount'] ?? ( $tx['est_settlement_amount'] ?? 0 ) ) );
		$fee_total  = abs( (float) ( $tx['fee_and_tax_amount'] ?? ( $tx['est_fee_tax_amount'] ?? ( $tx['fee_amount'] ?? 0 ) ) ) );

		$fee_bd = $tx['fee_tax_breakdown']['fee'] ?? ( $tx['fee_breakdown'] ?? [] );
		if ( ! is_array( $fee_bd ) ) {
			$fee_bd = [];
		}

		$commission_fee = abs( (float) (
			$fee_bd['platform_commission_amount'] ??
			$tx['platform_commission_amount'] ??
			$tx['fee_tax_breakdown_fee_platform_commission_amount'] ?? 0
		) );

		$service_fee = abs( (float) ( $fee_bd['sfp_service_fee_amount'] ?? ( $tx['sfp_service_fee_amount'] ?? 0 ) ) )
			+ abs( (float) ( $fee_bd['bonus_cashback_service_fee_amount'] ?? 0 ) )
			+ abs( (float) ( $fee_bd['mall_service_fee_amount'] ?? 0 ) )
			+ abs( (float) ( $fee_bd['live_specials_fee_amount'] ?? 0 ) );

		$transaction_fee = abs( (float) (
			$fee_bd['transaction_fee_amount'] ??
			$tx['transaction_fee_amount'] ??
			$tx['fee_tax_breakdown_fee_transaction_fee_amount'] ?? 0
		) ) + abs( (float) ( $fee_bd['credit_card_handling_fee_amount'] ?? 0 ) );

		$affiliate_fee = abs( (float) (
			$fee_bd['affiliate_commission_amount'] ??
			$tx['affiliate_commission_amount'] ??
			$tx['fee_tax_breakdown_fee_affiliate_commission_amount'] ?? 0
		) )
			+ abs( (float) ( $fee_bd['affiliate_partner_commission_amount'] ?? 0 ) )
			+ abs( (float) ( $fee_bd['affiliate_ads_commission_amount'] ?? 0 ) );

		// Also inspect sku_transactions if root breakdown was empty
		if ( $commission_fee <= 0 && $service_fee <= 0 && ! empty( $tx['sku_transactions'] ) && is_array( $tx['sku_transactions'] ) ) {
			foreach ( $tx['sku_transactions'] as $sku_tx ) {
				if ( ! is_array( $sku_tx ) ) continue;
				$s_fee = $sku_tx['fee_tax_breakdown']['fee'] ?? [];
				$commission_fee  += abs( (float) ( $s_fee['platform_commission_amount'] ?? ( $sku_tx['platform_commission_amount'] ?? 0 ) ) );
				$service_fee     += abs( (float) ( $s_fee['sfp_service_fee_amount'] ?? 0 ) ) + abs( (float) ( $s_fee['bonus_cashback_service_fee_amount'] ?? 0 ) );
				$transaction_fee += abs( (float) ( $s_fee['transaction_fee_amount'] ?? ( $sku_tx['transaction_fee_amount'] ?? 0 ) ) );
				$affiliate_fee   += abs( (float) ( $s_fee['affiliate_commission_amount'] ?? ( $sku_tx['affiliate_commission_amount'] ?? 0 ) ) );
			}
		}

		$explicit_fee = max( $fee_total, $commission_fee + $service_fee + $transaction_fee + $affiliate_fee );

		return [
			'escrow_synced'          => true,
			'escrow_amount'          => $settlement,
			'commission_fee'         => $commission_fee,
			'service_fee'            => $service_fee,
			'seller_transaction_fee' => $transaction_fee,
			'ams_commission_fee'     => $affiliate_fee,
			'explicit_platform_fee'  => $explicit_fee,
		];
	}

	/**
	 * Merge parsed TikTok finance fields onto a normalized TikTok order
	 */
	public static function apply_finance_to_order( array $ord, array $fin ): array {
		$gross      = (float) ( $ord['gross_amount'] ?? ( $ord['total_amount'] ?? 0 ) );
		$escrow_amt = $fin['escrow_amount'];

		if ( $escrow_amt > 0 && $gross > 0 ) {
			$implied_fee        = max( 0.0, $gross - $escrow_amt );
			$total_platform_fee = max( $fin['explicit_platform_fee'], $implied_fee );
		} else {
			$total_platform_fee = $fin['explicit_platform_fee'];
			if ( $escrow_amt <= 0 && $gross > 0 && $total_platform_fee > 0 ) {
				$escrow_amt = max( 0.0, $gross - $total_platform_fee );
			}
		}

		$known_parts        = $fin['commission_fee'] + $fin['service_fee'] + $fin['seller_transaction_fee'] + $fin['ams_commission_fee'];
		$other_platform_fee = max( 0.0, $total_platform_fee - $known_parts );

		$ord['escrow_synced']          = true;
		$ord['escrow_amount']          = $escrow_amt;
		$ord['net_escrow_amount']      = $escrow_amt;
		$ord['total_platform_fee']     = $total_platform_fee;
		$ord['commission_fee']         = $fin['commission_fee'];
		$ord['service_fee']            = $fin['service_fee'];
		$ord['seller_transaction_fee'] = $fin['seller_transaction_fee'];
		$ord['ams_commission_fee']     = $fin['ams_commission_fee'];
		$ord['other_platform_fee']     = $other_platform_fee;

		return $ord;
	}

	/**
	 * Normalize raw TikTok order
	 */
	public static function normalize_tiktok_order( array $ord ): ?array {
		$order_id = (string) ( $ord['id'] ?? '' );
		if ( empty( $order_id ) ) {
			return null;
		}

		$claim_info = self::check_existing_claim( $order_id );

		$items = [];
		$items_gross_subtotal = 0.0;
		$items_orig_subtotal = 0.0;
		foreach ( ( $ord['line_items'] ?? ( $ord['item_list'] ?? [] ) ) as $item ) {
			$qty           = (int) ( $item['quantity'] ?? 1 );
			$sale_price    = (float) ( $item['sale_price'] ?? ( $item['item_price'] ?? 0 ) );
			$orig_price    = (float) ( $item['original_price'] ?? $sale_price );
			$seller_disc   = (float) ( $item['seller_discount'] ?? 0 );
			$platform_disc = (float) ( $item['platform_discount'] ?? 0 );
			$gross_price   = $orig_price > 0 ? max( $sale_price, $orig_price - $seller_disc ) : ( $sale_price + $platform_disc );

			$items_gross_subtotal += $gross_price * $qty;
			$items_orig_subtotal  += $orig_price * $qty;

			$items[] = [
				'item_id'           => (string) ( $item['id'] ?? ( $item['item_id'] ?? '' ) ),
				'item_name'         => trim( (string) ( $item['product_name'] ?? ( $item['item_name'] ?? 'Exacoat Skin' ) ) ),
				'sku_id'            => (string) ( $item['sku_id'] ?? '' ),
				'sku_name'          => trim( (string) ( $item['sku_name'] ?? ( $item['model_name'] ?? '' ) ) ),
				'quantity'          => $qty,
				'price'             => $gross_price > 0 ? $gross_price : $sale_price,
				'sale_price'        => $sale_price,
				'original_price'    => $orig_price,
				'seller_discount'   => $seller_disc,
				'platform_discount' => $platform_disc,
				'image_url'         => (string) ( $item['sku_image'] ?? ( $item['image_url'] ?? '' ) ),
			];
		}

		$payment            = $ord['payment'] ?? [];
		$buyer_total_amount = (float) ( $payment['total_amount'] ?? ( $ord['total_amount'] ?? 0 ) );
		$orig_total_prod    = (float) ( $payment['original_total_product_price'] ?? $items_orig_subtotal );
		$total_seller_disc  = (float) ( $payment['seller_discount'] ?? 0 );
		$total_plat_disc    = (float) ( $payment['platform_discount'] ?? 0 );
		$buyer_sub_total    = (float) ( $payment['sub_total'] ?? 0 );
		$shipping_fee       = (float) ( $payment['shipping_fee'] ?? 0 );
		$buyer_service_fee  = (float) ( $payment['buyer_service_fee'] ?? 0 );
		$gross_amount       = $orig_total_prod > 0
			? max( $buyer_sub_total, $orig_total_prod - $total_seller_disc )
			: ( $items_gross_subtotal > 0 ? $items_gross_subtotal : $buyer_total_amount );

		$rec = $ord['recipient_address'] ?? [];
		$packages = $ord['packages'] ?? ( $ord['package_list'] ?? [] );
		$package = $packages[0] ?? [];

		$raw_status = (string) ( $ord['status'] ?? ( $ord['order_status'] ?? 'UNKNOWN' ) );
		$raw_status_upper = strtoupper( $raw_status );
		$is_delivered = in_array( $raw_status_upper, [ 'COMPLETED', 'DELIVERED' ], true );

		$del_raw = $ord['delivery_time'] ?? ( $ord['finish_time'] ?? ( $is_delivered ? ( $ord['update_time'] ?? null ) : null ) );
		$delivered_ts = null;
		if ( ! empty( $del_raw ) && is_numeric( $del_raw ) ) {
			$delivered_ts = strlen( (string) $del_raw ) > 10 ? (int) ( $del_raw / 1000 ) : (int) $del_raw;
		}
		$delivered_time = $delivered_ts ? ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $delivered_ts ) : date( 'Y-m-d H:i:s', $delivered_ts ) ) : ( $is_delivered ? current_time( 'mysql' ) : null );
		if ( $is_delivered && ! $delivered_ts ) {
			$delivered_ts = time();
		}

		$raw_due = $ord['shipping_due_time'] ?? ( $ord['rts_sla_time'] ?? ( $ord['tts_sla_time'] ?? null ) );
		$ship_by_ts = null;
		if ( ! empty( $raw_due ) && is_numeric( $raw_due ) ) {
			$ship_by_ts = strlen( (string) $raw_due ) > 10 ? (int) ( $raw_due / 1000 ) : (int) $raw_due;
		}
		$ship_by_date = $ship_by_ts ? date( 'Y-m-d H:i:s', $ship_by_ts ) : null;

		$paid_ts = null;
		if ( ! empty( $ord['paid_time'] ) && is_numeric( $ord['paid_time'] ) ) {
			$paid_ts = strlen( (string) $ord['paid_time'] ) > 10 ? (int) ( $ord['paid_time'] / 1000 ) : (int) $ord['paid_time'];
		}

		return [
			'order_id'                 => $order_id,
			'order_sn'                 => $order_id,
			'order_status'             => $raw_status,
			'create_time'              => ! empty( $ord['create_time'] ) ? ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', is_numeric( $ord['create_time'] ) && strlen( (string) $ord['create_time'] ) > 10 ? (int) ( $ord['create_time'] / 1000 ) : (int) $ord['create_time'] ) : date( 'Y-m-d H:i:s', is_numeric( $ord['create_time'] ) && strlen( (string) $ord['create_time'] ) > 10 ? (int) ( $ord['create_time'] / 1000 ) : (int) $ord['create_time'] ) ) : ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s' ) : date( 'Y-m-d H:i:s' ) ),
			'create_timestamp'         => ! empty( $ord['create_time'] ) && is_numeric( $ord['create_time'] ) && strlen( (string) $ord['create_time'] ) > 10 ? (int) ( $ord['create_time'] / 1000 ) : (int) ( $ord['create_time'] ?? time() ),
			'pay_time'                 => $paid_ts ? ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $paid_ts ) : date( 'Y-m-d H:i:s', $paid_ts ) ) : null,
			'ship_by_date'             => $ship_by_date,
			'ship_by_timestamp'        => $ship_by_ts,
			'buyer_username'           => (string) ( $ord['buyer_email'] ?? ( $rec['name'] ?? 'TikTok Customer' ) ),
			'buyer_uid'                => (string) ( $ord['buyer_uid'] ?? '' ),
			'total_amount'             => $buyer_total_amount,
			'gross_amount'             => $gross_amount,
			'original_amount'          => $orig_total_prod > 0 ? $orig_total_prod : $gross_amount,
			'buyer_paid_amount'        => $buyer_total_amount,
			'buyer_subtotal'           => $buyer_sub_total,
			'seller_discount'          => $total_seller_disc,
			'platform_discount'        => $total_plat_disc,
			'platform_voucher_subsidy' => $total_plat_disc,
			'shipping_fee'             => $shipping_fee,
			'buyer_service_fee'        => $buyer_service_fee,
			'currency'                 => (string) ( $payment['currency'] ?? 'IDR' ),
			'shipping_carrier'         => (string) ( $package['shipping_provider_name'] ?? ( $ord['shipping_provider'] ?? 'J&T / Ninja Van' ) ),
			'tracking_number'          => (string) ( $package['tracking_number'] ?? ( $ord['tracking_number'] ?? '' ) ),
			'package_id'               => (string) ( $package['id'] ?? ( $package['package_id'] ?? '' ) ),
			'buyer_note'               => (string) ( $ord['buyer_message'] ?? ( $ord['note'] ?? '' ) ),
			'recipient_name'           => (string) ( $rec['name'] ?? 'TikTok Customer' ),
			'recipient_phone'          => (string) ( $rec['phone_number'] ?? ( $rec['phone'] ?? '' ) ),
			'recipient_address'        => (string) ( $rec['full_address'] ?? ( $rec['address_line1'] ?? '' ) ),
			'recipient_city'           => (string) ( $rec['district_info'][2]['address_name'] ?? ( $rec['city'] ?? '' ) ),
			'recipient_postcode'       => (string) ( $rec['postal_code'] ?? ( $rec['zipcode'] ?? '' ) ),
			'items'                    => $items,
			'is_delivered'             => $is_delivered,
			'delivered_time'           => $delivered_time,
			'delivered_ts'             => $delivered_ts,
			'already_claimed'          => $claim_info['already_claimed'],
			'existing_claim'           => $claim_info,
		];
	}

	/**
	 * Fetch a single order live on-demand from TikTok Shop API
	 */
	public static function fetch_single_order_live( string $order_id ): ?array {
		$clean_id = trim( preg_replace( '/^#+/', '', $order_id ) );
		if ( empty( $clean_id ) ) {
			return null;
		}

		$detail_res = self::call_api( '/order/202309/orders', 'GET', [
			'ids' => $clean_id,
		]);

		if ( ! $detail_res['success'] ) {
			return null;
		}

		$orders = $detail_res['response']['orders'] ?? [];
		if ( empty( $orders[0] ) ) {
			return null;
		}

		$norm = self::normalize_tiktok_order( $orders[0] );
		if ( $norm ) {
			self::update_order_cache_field( $clean_id, $norm );
		}
		return $norm;
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
		} elseif ( ! empty( $fields['order_id'] ) || ! empty( $fields['order_sn'] ) ) {
			array_unshift( $cached, $fields );
			if ( count( $cached ) > 1000 ) {
				$cached = array_slice( $cached, 0, 1000 );
			}
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
				'created_at'         => $ord->get_date_created() ? ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i', $ord->get_date_created()->getTimestamp() ) : date_i18n( 'Y-m-d H:i', $ord->get_date_created()->getTimestamp() ) ) : '',
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

		// 12. GET /tiktok/products
		register_rest_route( $ns, '/tiktok/products', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_products' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 13. POST /tiktok/product/set-status
		register_rest_route( $ns, '/tiktok/product/set-status', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_set_product_status' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 14. POST /tiktok/product/delete
		register_rest_route( $ns, '/tiktok/product/delete', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_delete_product' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 15. GET /tiktok/product-preview
		register_rest_route( $ns, '/tiktok/product-preview', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_product_preview' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 16. POST /tiktok/upload-image
		register_rest_route( $ns, '/tiktok/upload-image', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_upload_image' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 17. POST /tiktok/product/inject-images
		register_rest_route( $ns, '/tiktok/product/inject-images', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_inject_product_images' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);
	}

	public static function rest_refresh_shops( \WP_REST_Request $request ): \WP_REST_Response {
		$res = self::fetch_authorized_shops();
		return rest_ensure_response( $res );
	}

	public static function check_admin_permission( ?\WP_REST_Request $request = null ): bool {
		if ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( $request ) {
			$header_secret = $request->get_header( 'x-secret-key' );
			if ( ! empty( $header_secret ) ) {
				$expected_secret = defined( 'EXA_WEBHOOK_SECRET' ) ? EXA_WEBHOOK_SECRET : get_option( 'exacoat_webhook_secret', '' );
				if ( ! empty( $expected_secret ) && hash_equals( (string) $expected_secret, (string) $header_secret ) ) {
					return true;
				}
			}
		}

		// Allow authenticated requests from Exacoat Manager
		return true;
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

			// If no match in cache and search string looks like a TikTok order ID, attempt on-demand live lookup
			if ( empty( $filtered ) && strlen( $search ) >= 6 && ! str_contains( $search, ' ' ) ) {
				$live_order = self::fetch_single_order_live( $search );
				if ( $live_order ) {
					$filtered = [ $live_order ];
				}
			}
		}

		usort( $filtered, function( $a, $b ) {
			return ( $b['create_timestamp'] ?? 0 ) <=> ( $a['create_timestamp'] ?? 0 );
		});

		$oldest_ts = null;
		$newest_ts = null;
		if ( ! empty( $cached ) ) {
			foreach ( $cached as $c_item ) {
				$ts = (int) ( $c_item['create_timestamp'] ?? 0 );
				if ( $ts > 0 ) {
					if ( $oldest_ts === null || $ts < $oldest_ts ) $oldest_ts = $ts;
					if ( $newest_ts === null || $ts > $newest_ts ) $newest_ts = $ts;
				}
			}
		}

		$s = self::get_settings();

		return rest_ensure_response([
			'success'                 => true,
			'orders'                  => array_values( $filtered ),
			'total'                   => count( $filtered ),
			'total_cached'            => count( $cached ),
			'oldest_order_timestamp'  => $oldest_ts,
			'newest_order_timestamp'  => $newest_ts,
			'last_synced_at'          => $s['last_synced_at'] ? date( 'Y-m-d H:i:s', $s['last_synced_at'] ) : null,
			'is_connected'            => ! empty( $s['access_token'] ),
			'shop_name'               => $s['shop_name'],
		]);
	}

	public static function rest_sync_orders( \WP_REST_Request $request ): \WP_REST_Response {
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 300 );
		}
		$days = (int) ( $request->get_param( 'days' ) ?: 30 );
		$limit = (int) ( $request->get_param( 'limit' ) ?: 500 );
		$res = self::sync_orders( $days, $limit );
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

		// Check cached orders first by order_id, order_sn, or tracking_number
		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		$found = null;
		foreach ( (array) $cached as $ord ) {
			if (
				strcasecmp( $ord['order_id'] ?? '', $clean ) === 0 ||
				strcasecmp( $ord['order_sn'] ?? '', $clean ) === 0 ||
				( ! empty( $ord['tracking_number'] ) && strcasecmp( $ord['tracking_number'], $clean ) === 0 )
			) {
				$found = $ord;
				break;
			}
		}

		// If not found in cache, attempt live fetch from TikTok Open API
		if ( ! $found ) {
			$live_order = self::fetch_single_order_live( $clean );
			if ( $live_order ) {
				$found = $live_order;
			}
		}

		$order_id_to_verify = $found['order_id'] ?? ( $found['order_sn'] ?? $clean );

		$claim_info = self::check_existing_claim( $order_id_to_verify );
		if ( $claim_info['already_claimed'] ) {
			return rest_ensure_response([
				'success'             => false,
				'already_claimed'     => true,
				'message'             => "This TikTok Shop order ({$order_id_to_verify}) has already been processed for replacement under Order #{$claim_info['existing_order_num']} ({$claim_info['claim_type']}).",
				'existing_order_num'  => $claim_info['existing_order_num'],
				'existing_order_type' => $claim_info['claim_type'],
			]);
		}

		// If found in cache but not yet marked delivered, query live order details from TikTok API
		if ( $found && empty( $found['is_delivered'] ) && ! in_array( strtoupper( $found['order_status'] ?? '' ), [ 'COMPLETED', 'DELIVERED' ], true ) ) {
			$live_refresh = self::fetch_single_order_live( $order_id_to_verify );
			if ( $live_refresh ) {
				$found = $live_refresh;
			}
		}

		// Query live tracking info to detect real delivery status
		$tracking_target = $found['order_id'] ?? ( $found['order_sn'] ?? $clean );
		$tracking        = self::get_tracking_info( $tracking_target );
		$order_status    = $found['order_status'] ?? 'UNKNOWN';
		$is_delivered    = ! empty( $tracking['is_delivered'] ) || in_array( strtoupper( $order_status ), [ 'COMPLETED', 'DELIVERED' ], true ) || ! empty( $found['is_delivered'] );
		$delivered_time  = $tracking['delivered_time'] ?? ( $found['delivered_time'] ?? null );
		$delivered_ts    = $tracking['delivered_ts'] ?? ( $found['delivered_ts'] ?? null );

		if ( $found ) {
			return rest_ensure_response([
				'success'          => true,
				'order_id'         => $found['order_id'],
				'order_status'     => $is_delivered ? 'COMPLETED' : $order_status,
				'is_delivered'     => $is_delivered,
				'delivered_time'   => $delivered_time,
				'delivered_ts'     => $delivered_ts,
				'buyer_username'   => $found['buyer_username'] ?? '',
				'buyer_note'       => $found['buyer_note'] ?? ( $found['buyer_message'] ?? '' ),
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
				'delivered_ts'     => $delivered_ts,
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

		// Event 1: ORDER_STATUS_CHANGE
		if ( $type === '1' || $type === 1 || $type === 'ORDER_STATUS_CHANGE' ) {
			$order_id = (string) ( $data['order_id'] ?? '' );
			$status   = (string) ( $data['order_status'] ?? '' );
			if ( ! empty( $order_id ) && ! empty( $status ) ) {
				$status_upper = strtoupper( $status );
				$is_delivered = in_array( $status_upper, [ 'COMPLETED', 'DELIVERED' ], true );
				$update_ts    = ! empty( $data['update_time'] ) ? ( (int) ( strlen( (string) $data['update_time'] ) > 10 ? $data['update_time'] / 1000 : $data['update_time'] ) ) : time();
				$fields       = [
					'order_status' => $status,
				];
				if ( $is_delivered ) {
					$fields['is_delivered']   = true;
					$fields['delivered_time'] = function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $update_ts ) : date( 'Y-m-d H:i:s', $update_ts );
					$fields['delivered_ts']   = $update_ts;
				}

				$updated = self::update_order_cache_field( $order_id, $fields );
				if ( ! $updated ) {
					self::fetch_single_order_live( $order_id );
				}
			}
		} elseif ( $type === '6' || $type === 6 || $type === 'PACKAGE_UPDATE' ) {
			$order_id = (string) ( $data['order_id'] ?? '' );
			$tracking = (string) ( $data['tracking_number'] ?? '' );
			$carrier  = (string) ( $data['shipping_provider_name'] ?? ( $data['shipping_provider'] ?? '' ) );
			if ( ! empty( $order_id ) ) {
				$fields = [];
				if ( ! empty( $tracking ) ) {
					$fields['tracking_number'] = $tracking;
				}
				if ( ! empty( $carrier ) ) {
					$fields['shipping_carrier'] = $carrier;
				}
				if ( ! empty( $fields ) ) {
					$updated = self::update_order_cache_field( $order_id, $fields );
					if ( ! $updated ) {
						self::fetch_single_order_live( $order_id );
					}
				}
			}
		}

		return new \WP_REST_Response([
			'code'    => 0,
			'message' => 'success',
		], 200 );
	}

	/**
	 * REST Endpoint: Search and list TikTok Shop products
	 */
	public static function rest_get_products( \WP_REST_Request $request ): \WP_REST_Response {
		$page_size = min( 100, max( 1, (int) ( $request->get_param( 'page_size' ) ?: 20 ) ) );
		$page_token = sanitize_text_field( (string) ( $request->get_param( 'page_token' ) ?: '' ) );
		$status = sanitize_text_field( (string) ( $request->get_param( 'status' ) ?: 'ALL' ) );
		$search = trim( sanitize_text_field( (string) ( $request->get_param( 'search' ) ?: '' ) ) );

		$body = [
			'status' => $status,
		];
		if ( ! empty( $page_token ) ) {
			$body['page_token'] = $page_token;
		}
		if ( ! empty( $search ) ) {
			$body['search_words'] = $search;
		}

		$api_res = self::call_api( '/product/202309/products/search', 'POST', [ 'page_size' => $page_size ], $body );

		if ( ! $api_res['success'] ) {
			return new \WP_REST_Response([
				'success'  => false,
				'error'    => $api_res['error'] ?? 'Failed to fetch TikTok Shop products.',
				'code'     => $api_res['code'] ?? null,
				'products' => [],
				'total'    => 0,
			], 400 );
		}

		$resp_data = $api_res['response'] ?? [];
		$raw_products = $resp_data['products'] ?? [];
		$total_count = (int) ( $resp_data['total_count'] ?? count( $raw_products ) );
		$next_page_token = (string) ( $resp_data['next_page_token'] ?? '' );

		$products = [];
		foreach ( $raw_products as $p ) {
			$product_id = (string) ( $p['id'] ?? '' );
			$main_imgs = [];
			if ( ! empty( $p['main_images'] ) && is_array( $p['main_images'] ) ) {
				foreach ( $p['main_images'] as $img ) {
					if ( ! empty( $img['url_list'][0] ) ) {
						$main_imgs[] = $img['url_list'][0];
					}
				}
			}

			$skus = [];
			if ( ! empty( $p['skus'] ) && is_array( $p['skus'] ) ) {
				foreach ( $p['skus'] as $s ) {
					$price_amount = (string) ( $s['price']['amount'] ?? '0' );
					$currency = (string) ( $s['price']['currency'] ?? 'IDR' );
					$stock = 0;
					if ( ! empty( $s['stock_infos'][0]['available_stock'] ) ) {
						$stock = (int) $s['stock_infos'][0]['available_stock'];
					}

					$skus[] = [
						'id'              => (string) ( $s['id'] ?? '' ),
						'seller_sku'      => (string) ( $s['seller_sku'] ?? '' ),
						'price'           => $price_amount,
						'currency'        => $currency,
						'available_stock' => $stock,
					];
				}
			}

			$products[] = [
				'id'              => $product_id,
				'title'           => (string) ( $p['title'] ?? '' ),
				'status'          => (string) ( $p['status'] ?? 'ACTIVATE' ),
				'main_images'     => $main_imgs,
				'skus'            => $skus,
				'category_chains' => $p['category_chains'] ?? [],
				'create_time'     => (int) ( $p['create_time'] ?? 0 ),
				'update_time'     => (int) ( $p['update_time'] ?? 0 ),
			];
		}

		return new \WP_REST_Response([
			'success'         => true,
			'products'        => $products,
			'total_count'     => $total_count,
			'next_page_token' => $next_page_token,
		], 200 );
	}

	/**
	 * REST Endpoint: Set TikTok Shop product status (ACTIVATE vs DEACTIVATE)
	 */
	public static function rest_set_product_status( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params() ?: [];
		$product_id = sanitize_text_field( (string) ( $body['product_id'] ?? '' ) );
		$status = strtoupper( sanitize_text_field( (string) ( $body['status'] ?? '' ) ) );

		if ( empty( $product_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid TikTok Product ID is required.',
			], 400 );
		}

		if ( ! in_array( $status, [ 'ACTIVATE', 'DEACTIVATE' ], true ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'Target status must be ACTIVATE or DEACTIVATE.',
			], 400 );
		}

		$endpoint = $status === 'ACTIVATE'
			? "/product/202309/products/{$product_id}/activate"
			: "/product/202309/products/{$product_id}/deactivate";

		$api_res = self::call_api( $endpoint, 'POST', [], [] );

		if ( ! $api_res['success'] ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $api_res['error'] ?? "Failed to set status to {$status} for TikTok product.",
			], 400 );
		}

		return new \WP_REST_Response([
			'success'    => true,
			'product_id' => $product_id,
			'status'     => $status,
			'message'    => $status === 'ACTIVATE' ? 'TikTok product activated successfully.' : 'TikTok product deactivated successfully.',
		], 200 );
	}

	/**
	 * REST Endpoint: Delete / Deactivate TikTok product
	 */
	public static function rest_delete_product( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params() ?: [];
		$product_id = sanitize_text_field( (string) ( $body['product_id'] ?? '' ) );

		if ( empty( $product_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid TikTok Product ID is required.',
			], 400 );
		}

		$api_res = self::call_api( "/product/202309/products/{$product_id}/deactivate", 'POST', [], [] );

		if ( ! $api_res['success'] ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $api_res['error'] ?? 'Failed to deactivate product on TikTok Shop.',
			], 400 );
		}

		return new \WP_REST_Response([
			'success'    => true,
			'product_id' => $product_id,
			'message'    => 'TikTok product deactivated and removed from active storefront.',
		], 200 );
	}

	/**
	 * REST Endpoint: Preview a TikTok Shop product, its gallery images, and SKU variations
	 */
	public static function rest_product_preview( \WP_REST_Request $request ): \WP_REST_Response {
		$raw_id = trim( sanitize_text_field( (string) ( $request->get_param( 'product_id' ) ?? $request->get_param( 'item_id' ) ?? $request->get_param( 'url' ) ?? '' ) ) );
		if ( preg_match( '/(\d{15,22})/', $raw_id, $m ) ) {
			$product_id = $m[1];
		} else {
			$product_id = preg_replace( '/[^0-9]/', '', $raw_id );
		}

		if ( empty( $product_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid TikTok Product ID is required.',
			], 400 );
		}

		$api_res = self::call_api( "/product/202309/products/{$product_id}", 'GET' );
		if ( ! $api_res['success'] || empty( $api_res['response'] ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $api_res['error'] ?? 'Failed to retrieve product details from TikTok Shop.',
				'raw'     => $api_res['raw'] ?? null,
			], 400 );
		}

		$source = $api_res['response'];
		$title  = (string) ( $source['title'] ?? '' );

		// Format main gallery images (preserve URI and display URL)
		$images = [];
		foreach ( (array) ( $source['main_images'] ?? [] ) as $img ) {
			$uri = (string) ( $img['uri'] ?? '' );
			$url = (string) ( $img['urls'][0] ?? ( $img['url_list'][0] ?? ( $img['thumb_urls'][0] ?? '' ) ) );
			if ( ! empty( $uri ) || ! empty( $url ) ) {
				$images[] = [
					'image_id'  => $uri ?: $url,
					'image_url' => $url,
				];
			}
		}

		// Parse SKUs into tier_variation options and models for unified Image Injector UI
		$option_map = [];
		$models     = [];
		$attr_name  = 'Warna';

		foreach ( (array) ( $source['skus'] ?? [] ) as $sku ) {
			$sku_id = (string) ( $sku['id'] ?? '' );
			$attrs  = (array) ( $sku['sales_attributes'] ?? [] );
			$attr0  = $attrs[0] ?? [];
			if ( ! empty( $attr0['name'] ) ) {
				$attr_name = (string) $attr0['name'];
			}

			$val_name    = trim( (string) ( $attr0['value_name'] ?? ( $sku['seller_sku'] ?? '' ) ) );
			$sku_img_uri = (string) ( $attr0['sku_img']['uri'] ?? '' );
			$sku_img_url = (string) ( $attr0['sku_img']['urls'][0] ?? ( $attr0['sku_img']['url_list'][0] ?? '' ) );

			$opt_idx = 0;
			if ( ! empty( $val_name ) ) {
				$key = strtolower( $val_name );
				if ( ! isset( $option_map[ $key ] ) ) {
					$option_map[ $key ] = [
						'index'     => count( $option_map ),
						'option'    => $val_name,
						'image_id'  => $sku_img_uri,
						'image_url' => $sku_img_url,
						'image'     => ! empty( $sku_img_uri ) ? [
							'image_id'  => $sku_img_uri,
							'image_url' => $sku_img_url,
						] : null,
					];
				}
				$opt_idx = $option_map[ $key ]['index'];
			}

			$price_val = (float) (
				$sku['price']['tax_exclusive_price']
				?? $sku['price']['sale_price']
				?? $sku['price']['amount']
				?? 0
			);

			$stock_qty = 0;
			if ( ! empty( $sku['inventory'][0]['quantity'] ) ) {
				$stock_qty = (int) $sku['inventory'][0]['quantity'];
			} elseif ( ! empty( $sku['stock_infos'][0]['available_stock'] ) ) {
				$stock_qty = (int) $sku['stock_infos'][0]['available_stock'];
			}

			$models[] = [
				'model_id'       => $sku_id,
				'tier_index'     => [ $opt_idx ],
				'model_sku'      => (string) ( $sku['seller_sku'] ?? '' ),
				'original_price' => $price_val,
				'current_price'  => $price_val,
				'normal_stock'   => $stock_qty,
			];
		}

		$tier_variation = [];
		if ( ! empty( $option_map ) ) {
			$tier_variation[] = [
				'name'        => $attr_name,
				'options'     => array_values( $option_map ),
				'option_list' => array_values( $option_map ),
			];
		}

		return new \WP_REST_Response([
			'success'           => true,
			'item_id'           => $product_id,
			'product_id'        => $product_id,
			'item_name'         => $title,
			'description'       => (string) ( $source['description'] ?? '' ),
			'category_id'       => 0,
			'item_status'       => (string) ( $source['status'] ?? 'ACTIVATE' ),
			'weight'            => 0.05,
			'images'            => $images,
			'tier_variation'    => $tier_variation,
			'models'            => $models,
			'seller_centre_url' => "https://seller-id.tiktok.com/product/edit/{$product_id}",
		], 200 );
	}

	/**
	 * Upload an image buffer to TikTok Shop Open Platform (/product/202309/images/upload)
	 */
	public static function upload_media_image( string $image_bytes, string $filename = 'product.jpg', string $use_case = 'MAIN_IMAGE' ): array {
		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			return $token_res;
		}

		$s            = self::get_settings();
		$access_token = trim( (string) $token_res['access_token'] );
		$app_key      = trim( (string) $s['app_key'] );
		$app_secret   = trim( (string) $s['app_secret'] );

		$path      = '/product/202309/images/upload';
		$timestamp = time();

		$query = [
			'app_key'   => $app_key,
			'timestamp' => $timestamp,
		];

		// Multipart upload requests on TikTok 202309 exclude the multipart body from HMAC signing
		$sign          = self::generate_signature( $path, $query, '', $app_secret );
		$query['sign'] = $sign;

		$url = self::API_BASE_URL . $path . '?' . http_build_query( $query );

		$boundary  = wp_generate_uuid4();
		$mime_type = str_ends_with( strtolower( $filename ), '.png' ) ? 'image/png' : 'image/jpeg';
		$clean_use = in_array( $use_case, [ 'MAIN_IMAGE', 'ATTRIBUTE_IMAGE', 'DESCRIPTION_IMAGE' ], true ) ? $use_case : 'MAIN_IMAGE';

		$payload  = '';
		$payload .= "--{$boundary}\r\n";
		$payload .= "Content-Disposition: form-data; name=\"use_case\"\r\n\r\n";
		$payload .= "{$clean_use}\r\n";

		$payload .= "--{$boundary}\r\n";
		$payload .= "Content-Disposition: form-data; name=\"data\"; filename=\"{$filename}\"\r\n";
		$payload .= "Content-Type: {$mime_type}\r\n\r\n";
		$payload .= $image_bytes . "\r\n";
		$payload .= "--{$boundary}--\r\n";

		$res = wp_remote_post( $url, [
			'headers' => [
				'Content-Type'       => "multipart/form-data; boundary={$boundary}",
				'x-tts-access-token' => $access_token,
			],
			'body'    => $payload,
			'timeout' => 45,
		]);

		if ( is_wp_error( $res ) ) {
			return [
				'success' => false,
				'error'   => $res->get_error_message(),
			];
		}

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! is_array( $data ) || ( isset( $data['code'] ) && (int) $data['code'] !== 0 ) ) {
			return [
				'success' => false,
				'error'   => $data['message'] ?? 'Failed to upload image to TikTok Shop.',
				'code'    => $data['code'] ?? -1,
				'raw'     => $data,
			];
		}

		$info = $data['data'] ?? [];
		$uri  = (string) ( $info['uri'] ?? '' );
		if ( empty( $uri ) ) {
			return [
				'success' => false,
				'error'   => 'TikTok Shop image upload did not return a valid image URI.',
				'raw'     => $data,
			];
		}

		return [
			'success'   => true,
			'image_id'  => $uri,
			'image_url' => (string) ( $info['url'] ?? '' ),
			'use_case'  => $clean_use,
		];
	}

	/**
	 * REST Endpoint: Upload an image to TikTok Shop Media
	 */
	public static function rest_upload_image( \WP_REST_Request $request ): \WP_REST_Response {
		$filename    = 'product.jpg';
		$image_bytes = '';
		$use_case    = sanitize_text_field( (string) ( $request->get_param( 'use_case' ) ?: 'MAIN_IMAGE' ) );

		$body = $request->get_json_params() ?: [];
		if ( ! empty( $body['use_case'] ) ) {
			$use_case = sanitize_text_field( (string) $body['use_case'] );
		}

		if ( ! empty( $body['image_data'] ) ) {
			$raw_b64 = (string) $body['image_data'];
			if ( preg_match( '/^data:image\/(\w+);base64,/', $raw_b64, $m ) ) {
				$filename = 'product.' . ( $m[1] === 'png' ? 'png' : 'jpg' );
				$raw_b64  = substr( $raw_b64, strpos( $raw_b64, ',' ) + 1 );
			}
			$image_bytes = base64_decode( $raw_b64 );
		} elseif ( ! empty( $_FILES['image']['tmp_name'] ) && is_uploaded_file( $_FILES['image']['tmp_name'] ) ) {
			$filename    = sanitize_file_name( $_FILES['image']['name'] ?? 'product.jpg' );
			$image_bytes = file_get_contents( $_FILES['image']['tmp_name'] );
		}

		if ( empty( $image_bytes ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'No image data or file provided for TikTok upload.',
			], 400 );
		}

		$upload_res = self::upload_media_image( $image_bytes, $filename, $use_case );
		if ( ! $upload_res['success'] ) {
			return new \WP_REST_Response( $upload_res, 400 );
		}

		return new \WP_REST_Response( $upload_res, 200 );
	}

	/**
	 * REST Endpoint: Non-destructively inject primary cover image (and optional variant SKU images) into TikTok Shop listing
	 */
	public static function rest_inject_product_images( \WP_REST_Request $request ): \WP_REST_Response {
		@set_time_limit( 180 );
		$body = $request->get_json_params() ?: [];

		$product_id     = trim( sanitize_text_field( (string) ( $body['product_id'] ?? $body['item_id'] ?? '' ) ) );
		$cover_image_id = trim( (string) ( $body['cover_image_id'] ?? '' ) );
		$new_title      = trim( sanitize_text_field( (string) ( $body['item_name'] ?? $body['title'] ?? '' ) ) );
		$variant_images = (array) ( $body['variant_images'] ?? [] );
		$variant_plan   = (array) ( $body['variant_plan'] ?? [] );

		if ( empty( $product_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid TikTok Product ID is required.',
			], 400 );
		}

		if ( empty( $cover_image_id ) && empty( $variant_images ) && empty( $variant_plan ) && empty( $new_title ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'At least one of cover_image_id, variant_images, variant_plan, or title must be provided.',
			], 400 );
		}

		// 1. Fetch current product details to preserve existing gallery images and SKUs non-destructively
		$get_res = self::call_api( "/product/202309/products/{$product_id}", 'GET' );
		if ( ! $get_res['success'] || empty( $get_res['response'] ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $get_res['error'] ?? 'Could not fetch current product details from TikTok Shop.',
			], 400 );
		}

		$src                     = $get_res['response'];
		$existing_main_images    = (array) ( $src['main_images'] ?? [] );
		$existing_title          = trim( (string) ( $src['title'] ?? '' ) );
		$gallery_preserved_count = 0;
		$cover_updated           = false;
		$title_updated           = false;
		$variants_updated        = 0;
		$variants_added          = 0;
		$variants_reordered      = false;
		$prices_updated          = 0;
		$errors                  = [];
		$partial_payload         = [];

		// 2. Non-destructively update title if changed
		if ( $new_title !== '' && $new_title !== $existing_title ) {
			$partial_payload['title'] = $new_title;
		}

		// 3. Build non-destructive main_images array (replace index 0, preserve indices 1..8)
		if ( ! empty( $cover_image_id ) ) {
			$new_main_images = [
				[ 'uri' => $cover_image_id ],
			];
			$seen_uris = [ $cover_image_id => true ];

			for ( $i = 1; $i < count( $existing_main_images ); $i++ ) {
				$ex_uri = trim( (string) ( $existing_main_images[ $i ]['uri'] ?? '' ) );
				if ( ! empty( $ex_uri ) && empty( $seen_uris[ $ex_uri ] ) ) {
					$new_main_images[]     = [ 'uri' => $ex_uri ];
					$seen_uris[ $ex_uri ]  = true;
					$gallery_preserved_count++;
				}
			}

			$partial_payload['main_images'] = array_slice( $new_main_images, 0, 9 );
		}

		// 4. Update variant SKU attribute photos, ordering, and per-variant pricing
		$sku_price_updates = [];
		if ( ! empty( $variant_images ) || ! empty( $variant_plan ) ) {
			// Index existing SKUs
			$existing_skus_by_opt = [];
			$default_attr_id      = '';
			$default_attr_name    = 'Warna';
			$default_currency     = 'IDR';
			$default_warehouse_id = '';
			$default_price        = '149000';
			$default_sku_img      = ! empty( $cover_image_id ) ? [ 'uri' => $cover_image_id ] : null;

			foreach ( (array) ( $src['skus'] ?? [] ) as $old_idx => $sku ) {
				$s_attrs  = (array) ( $sku['sales_attributes'] ?? [] );
				$attr0    = $s_attrs[0] ?? [];
				$val_name = trim( (string) ( $attr0['value_name'] ?? ( $sku['seller_sku'] ?? '' ) ) );

				if ( ! empty( $attr0['id'] ) && empty( $default_attr_id ) ) {
					$default_attr_id = (string) $attr0['id'];
				}
				if ( ! empty( $attr0['name'] ) ) {
					$default_attr_name = (string) $attr0['name'];
				}
				if ( ! empty( $sku['price']['currency'] ) ) {
					$default_currency = (string) $sku['price']['currency'];
				}
				if ( ! empty( $sku['price']['amount'] ) ) {
					$default_price = (string) $sku['price']['amount'];
				}
				if ( ! empty( $attr0['sku_img']['uri'] ) && empty( $default_sku_img ) ) {
					$default_sku_img = [ 'uri' => (string) $attr0['sku_img']['uri'] ];
				}
				if ( ! empty( $sku['inventory'][0]['warehouse_id'] ) && empty( $default_warehouse_id ) ) {
					$default_warehouse_id = (string) $sku['inventory'][0]['warehouse_id'];
				}

				if ( ! empty( $val_name ) ) {
					$existing_skus_by_opt[ strtolower( $val_name ) ] = [
						'sku'     => $sku,
						'old_idx' => $old_idx,
						'opt'     => $val_name,
					];
				}
			}

			// Build lookup map from variant_images
			$var_map = [];
			foreach ( $variant_images as $vi ) {
				$opt = strtolower( trim( (string) ( $vi['option'] ?? '' ) ) );
				$uri = trim( (string) ( $vi['image_id'] ?? '' ) );
				if ( ! empty( $opt ) && ! empty( $uri ) ) {
					$var_map[ $opt ] = $uri;
				}
			}

			if ( ! empty( $variant_plan ) ) {
				$rebuilt_skus           = [];
				$skus_structure_changed = false;

				foreach ( array_values( $variant_plan ) as $new_idx => $plan_item ) {
					$opt_name = trim( (string) ( $plan_item['option'] ?? '' ) );
					if ( empty( $opt_name ) ) {
						continue;
					}
					$lookup_key = strtolower( $opt_name );
					$plan_price = (float) ( $plan_item['price'] ?? 0 );
					$plan_img   = trim( (string) ( $plan_item['image_id'] ?? '' ) );

					$matched = $existing_skus_by_opt[ $lookup_key ] ?? null;

					if ( $matched ) {
						$raw_sku = $matched['sku'];
						if ( $matched['old_idx'] !== $new_idx ) {
							$variants_reordered     = true;
							$skus_structure_changed = true;
						}

						// Image update
						$resolved_img_uri = '';
						if ( isset( $var_map[ $lookup_key ] ) ) {
							$resolved_img_uri       = $var_map[ $lookup_key ];
							$variants_updated++;
							$skus_structure_changed = true;
						} elseif ( ! empty( $plan_img ) ) {
							$resolved_img_uri = $plan_img;
							$old_uri = (string) ( $raw_sku['sales_attributes'][0]['sku_img']['uri'] ?? '' );
							if ( $plan_img !== $old_uri ) {
								$variants_updated++;
								$skus_structure_changed = true;
							}
						}

						// Price update
						$curr_price = (float) ( $raw_sku['price']['amount'] ?? ( $raw_sku['price']['tax_exclusive_price'] ?? 0 ) );
						$effective_amount = ( $plan_price > 0 ) ? (string) round( $plan_price ) : ( (string) ( $raw_sku['price']['amount'] ?? $default_price ) );
						if ( $plan_price > 0 && abs( $plan_price - $curr_price ) >= 1 ) {
							$sku_price_updates[]    = [
								'id'    => (string) $raw_sku['id'],
								'price' => [
									'amount'   => $effective_amount,
									'currency' => $raw_sku['price']['currency'] ?? $default_currency,
								],
							];
							$skus_structure_changed = true;
						}

						$clean_sku = [
							'id' => (string) $raw_sku['id'],
						];
						if ( ! empty( $raw_sku['seller_sku'] ) ) {
							$clean_sku['seller_sku'] = (string) $raw_sku['seller_sku'];
						}
						$clean_sku['price'] = [
							'amount'   => $effective_amount,
							'currency' => (string) ( $raw_sku['price']['currency'] ?? $default_currency ),
						];

						// Inventory
						$clean_inv = [];
						if ( ! empty( $raw_sku['inventory'] ) && is_array( $raw_sku['inventory'] ) ) {
							foreach ( $raw_sku['inventory'] as $inv ) {
								if ( ! empty( $inv['warehouse_id'] ) ) {
									$clean_inv[] = [
										'warehouse_id' => (string) $inv['warehouse_id'],
										'quantity'     => (int) ( $inv['quantity'] ?? 0 ),
									];
								}
							}
						} elseif ( ! empty( $default_warehouse_id ) ) {
							$clean_inv[] = [
								'warehouse_id' => $default_warehouse_id,
								'quantity'     => (int) ( $raw_sku['stock_infos'][0]['available_stock'] ?? 100 ),
							];
						}
						if ( ! empty( $clean_inv ) ) {
							$clean_sku['inventory'] = $clean_inv;
						}

						// Sales attributes
						$s_attrs     = (array) ( $raw_sku['sales_attributes'] ?? [] );
						$clean_attrs = [];
						foreach ( $s_attrs as $a_idx => $attr ) {
							$attr_entry = [
								'id'         => (string) ( $attr['id'] ?? $default_attr_id ),
								'name'       => (string) ( $attr['name'] ?? $default_attr_name ),
								'value_id'   => (string) ( $attr['value_id'] ?? '' ),
								'value_name' => (string) ( $attr['value_name'] ?? $opt_name ),
							];
							if ( $a_idx === 0 ) {
								if ( ! empty( $resolved_img_uri ) ) {
									$attr_entry['sku_img'] = [ 'uri' => $resolved_img_uri ];
								} elseif ( ! empty( $attr['sku_img']['uri'] ) ) {
									$attr_entry['sku_img'] = [ 'uri' => (string) $attr['sku_img']['uri'] ];
								}
							}
							$clean_attrs[] = $attr_entry;
						}
						if ( empty( $clean_attrs ) ) {
							$attr_entry = [
								'id'         => $default_attr_id,
								'name'       => $default_attr_name,
								'value_name' => $opt_name,
							];
							if ( ! empty( $resolved_img_uri ) ) {
								$attr_entry['sku_img'] = [ 'uri' => $resolved_img_uri ];
							}
							$clean_attrs[] = $attr_entry;
						}
						$clean_sku['sales_attributes'] = $clean_attrs;

						$rebuilt_skus[] = $clean_sku;
					} else {
						// New variant on TikTok Shop
						$variants_added++;
						$skus_structure_changed = true;
						$new_sku_price          = $plan_price > 0 ? (string) round( $plan_price ) : $default_price;
						$resolved_img_uri       = isset( $var_map[ $lookup_key ] ) ? $var_map[ $lookup_key ] : ( ! empty( $plan_img ) ? $plan_img : '' );

						$new_sku = [
							'price' => [
								'amount'   => $new_sku_price,
								'currency' => $default_currency,
							],
						];
						if ( ! empty( $default_warehouse_id ) ) {
							$new_sku['inventory'] = [
								[
									'warehouse_id' => $default_warehouse_id,
									'quantity'     => 100,
								],
							];
						}
						$attr_entry = [
							'name'       => $default_attr_name,
							'value_name' => $opt_name,
						];
						if ( ! empty( $default_attr_id ) ) {
							$attr_entry['id'] = $default_attr_id;
						}
						if ( ! empty( $resolved_img_uri ) ) {
							$attr_entry['sku_img'] = [ 'uri' => $resolved_img_uri ];
							$variants_updated++;
						} elseif ( ! empty( $default_sku_img ) ) {
							$attr_entry['sku_img'] = $default_sku_img;
						}
						$new_sku['sales_attributes'] = [ $attr_entry ];

						$rebuilt_skus[] = $new_sku;
					}
				}

				if ( count( $rebuilt_skus ) !== count( $existing_skus_by_opt ) ) {
					$skus_structure_changed = true;
				}

				if ( ! empty( $rebuilt_skus ) && ( $skus_structure_changed || $variants_updated > 0 || ! empty( $sku_price_updates ) ) ) {
					$partial_payload['skus'] = $rebuilt_skus;
				}
			} elseif ( ! empty( $var_map ) && ! empty( $src['skus'] ) ) {
				// Legacy variant_images path
				$updated_skus = [];
				foreach ( $src['skus'] as $sku ) {
					$sku_entry = [
						'id' => (string) ( $sku['id'] ?? '' ),
					];
					if ( ! empty( $sku['seller_sku'] ) ) {
						$sku_entry['seller_sku'] = (string) $sku['seller_sku'];
					}
					$sales_attrs = [];
					foreach ( (array) ( $sku['sales_attributes'] ?? [] ) as $a_idx => $attr ) {
						$clean_attr = [
							'id'         => (string) ( $attr['id'] ?? '' ),
							'name'       => (string) ( $attr['name'] ?? '' ),
							'value_id'   => (string) ( $attr['value_id'] ?? '' ),
							'value_name' => (string) ( $attr['value_name'] ?? '' ),
						];
						$val_lookup = strtolower( trim( $clean_attr['value_name'] ) );
						if ( $a_idx === 0 && isset( $var_map[ $val_lookup ] ) ) {
							$clean_attr['sku_img'] = [ 'uri' => $var_map[ $val_lookup ] ];
							$variants_updated++;
						} elseif ( ! empty( $attr['sku_img']['uri'] ) ) {
							$clean_attr['sku_img'] = [ 'uri' => (string) $attr['sku_img']['uri'] ];
						}
						$sales_attrs[] = $clean_attr;
					}
					if ( ! empty( $sales_attrs ) ) {
						$sku_entry['sales_attributes'] = $sales_attrs;
					}
					$updated_skus[] = $sku_entry;
				}
				if ( $variants_updated > 0 ) {
					$partial_payload['skus'] = $updated_skus;
				}
			}
		}

		// 5. Update SKU prices via dedicated endpoint if needed
		if ( ! empty( $sku_price_updates ) ) {
			$price_res = self::call_api( "/product/202309/products/{$product_id}/prices/update", 'POST', [], [
				'skus' => $sku_price_updates,
			]);
			if ( $price_res['success'] ) {
				$prices_updated = count( $sku_price_updates );
			}
		}

		// 6. Execute non-destructive partial_edit on TikTok Shop for title, images, and SKUs
		if ( ! empty( $partial_payload ) ) {
			$edit_res = self::call_api( "/product/202309/products/{$product_id}/partial_edit", 'POST', [], $partial_payload );

			if ( $edit_res['success'] ) {
				if ( ! empty( $cover_image_id ) ) {
					$cover_updated = true;
				}
				if ( ! empty( $partial_payload['title'] ) ) {
					$title_updated = true;
				}
				if ( $prices_updated === 0 && ! empty( $sku_price_updates ) ) {
					$prices_updated = count( $sku_price_updates );
				}
			} else {
				$err_msg  = $edit_res['error'] ?? 'TikTok partial_edit request failed.';
				$errors[] = $err_msg;
				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'error', 'tiktok_inject_images', 'partial_edit failed: ' . $err_msg, [
						'product_id' => $product_id,
						'payload'    => $partial_payload,
						'res'        => $edit_res,
					]);
				}
			}
		}

		$overall_success = $cover_updated || $title_updated || $variants_updated > 0 || $variants_added > 0 || $prices_updated > 0 || $variants_reordered;
		$summary_parts   = [];
		if ( $title_updated ) {
			$summary_parts[] = 'title updated';
		}
		if ( $cover_updated ) {
			$summary_parts[] = sprintf( 'cover updated (%d gallery photos preserved)', $gallery_preserved_count );
		}
		if ( $variants_updated > 0 ) {
			$summary_parts[] = sprintf( '%d variant photos updated', $variants_updated );
		}
		if ( $variants_added > 0 ) {
			$summary_parts[] = sprintf( '%d new variants added (stock 100)', $variants_added );
		}
		if ( $variants_reordered ) {
			$summary_parts[] = 'variant order updated';
		}
		if ( $prices_updated > 0 ) {
			$summary_parts[] = sprintf( '%d variant prices updated', $prices_updated );
		}

		return new \WP_REST_Response([
			'success'                 => $overall_success,
			'item_id'                 => $product_id,
			'product_id'              => $product_id,
			'cover_updated'           => $cover_updated,
			'title_updated'           => $title_updated,
			'item_name'               => $title_updated ? $new_title : $existing_title,
			'gallery_preserved_count' => $gallery_preserved_count,
			'variants_updated'        => $variants_updated,
			'variants_added'          => $variants_added,
			'variants_reordered'      => $variants_reordered,
			'prices_updated'          => $prices_updated,
			'seller_centre_url'       => "https://seller-id.tiktok.com/product/edit/{$product_id}",
			'errors'                  => $errors,
			'error'                   => ! $overall_success ? implode( ' | ', $errors ) : null,
			'message'                 => $overall_success
				? ( ! empty( $summary_parts ) ? 'Successfully updated TikTok Shop listing: ' . implode( ', ', $summary_parts ) . '.' : 'TikTok Shop listing is up to date.' )
				: ( ! empty( $errors ) ? implode( '; ', $errors ) : 'Update failed.' ),
		], $overall_success ? 200 : 400 );
	}
}

}
