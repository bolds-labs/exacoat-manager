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
		add_action( 'exacoat_shopee_hourly_sync', [ __CLASS__, 'cron_sync_orders' ] );
		if ( ! wp_next_scheduled( 'exacoat_shopee_hourly_sync' ) ) {
			wp_schedule_event( time() + 300, 'hourly', 'exacoat_shopee_hourly_sync' );
		}
	}

	/**
	 * Cron callback: Automatically sync Shopee orders every hour
	 */
	public static function cron_sync_orders(): void {
		$settings = self::get_settings();
		if ( empty( $settings['access_token'] ) && empty( $settings['shop_id'] ) ) {
			return;
		}
		$res = self::sync_orders( 30, 500 );
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_cron',
				sprintf( 'Automated hourly Shopee sync executed: %s orders synced', $res['total_synced'] ?? ( $res['count'] ?? 0 ) ),
				$res
			);
		}
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
			'live_push_partner_key' => '58724959565954534b6d797147587a55505a4f79614243526464424a66686e63',
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
				'shopee_sync',
				sprintf( 'Initiating Shopee order sync (days_back: %d, max_orders: %d, env: %s)', $days_back, $max_fetch, $s['environment'] ),
				[
					'partner_id' => self::get_active_partner_id(),
					'shop_id'    => $s['shop_id'] ?? 0,
					'days_back'  => $days_back,
					'max_fetch'  => $max_fetch,
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

		// Shopee API v2 restricts get_order_list time slot to a maximum of 15 days.
		// To support 30, 60, or 90 days, partition the requested range into 14-day sliding slots.
		$now = time();
		$overall_from = $now - ( $days_back * 86400 );
		$slot_size = 14 * 86400;
		$windows = [];
		$curr_to = $now;

		while ( $curr_to > $overall_from ) {
			$curr_from = max( $overall_from, $curr_to - $slot_size );
			$windows[] = [
				'time_from' => $curr_from,
				'time_to'   => $curr_to,
			];
			$curr_to = $curr_from;
		}

		// Step 1: Iterate through time slots and paginate using next_cursor
		$order_sns = [];

		foreach ( $windows as $window ) {
			if ( count( $order_sns ) >= $max_fetch ) {
				break;
			}

			$cursor = '';
			do {
				$list_path = '/api/v2/order/get_order_list';
				$list_ts = time();
				$list_sign = self::sign_shop( $list_path, $list_ts, $partner_id, $partner_key, $access_token, $shop_id );

				$query_args = [
					'partner_id'        => $partner_id,
					'timestamp'         => $list_ts,
					'access_token'      => $access_token,
					'shop_id'           => $shop_id,
					'sign'              => $list_sign,
					'time_range_field'  => 'create_time',
					'time_from'         => $window['time_from'],
					'time_to'           => $window['time_to'],
					'page_size'         => 50,
				];
				if ( ! empty( $cursor ) ) {
					$query_args['cursor'] = $cursor;
				}

				$list_url = "{$base_url}{$list_path}?" . http_build_query( $query_args );
				$list_res = wp_remote_get( $list_url, [ 'timeout' => 25 ] );
				if ( is_wp_error( $list_res ) ) {
					$err = $list_res->get_error_message();
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log( 'error', 'shopee_sync', 'Shopee get_order_list HTTP transport error: ' . $err );
					}
					break;
				}

				$list_data = json_decode( wp_remote_retrieve_body( $list_res ), true );
				if ( ! empty( $list_data['error'] ) ) {
					$err = $list_data['message'] ?? $list_data['error'];
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log( 'error', 'shopee_sync', 'Shopee get_order_list API error: ' . $err, $list_data );
					}
					break;
				}

				$raw_order_list = $list_data['response']['order_list'] ?? [];
				if ( empty( $raw_order_list ) ) {
					break;
				}

				foreach ( $raw_order_list as $item ) {
					$sn = $item['order_sn'] ?? '';
					if ( ! empty( $sn ) && ! in_array( $sn, $order_sns, true ) ) {
						$order_sns[] = $sn;
					}
				}

				$has_more = ! empty( $list_data['response']['more'] );
				$cursor   = (string) ( $list_data['response']['next_cursor'] ?? '' );
			} while ( $has_more && ! empty( $cursor ) && count( $order_sns ) < $max_fetch );
		}

		if ( empty( $order_sns ) ) {
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'info', 'shopee_sync', 'Shopee get_order_list completed: 0 orders found for time range' );
			}
			$cached = get_option( self::ORDERS_CACHE_KEY, [] );
			return [
				'success'      => true,
				'orders'       => is_array( $cached ) ? $cached : [],
				'total_synced' => 0,
				'message'      => 'No recent Shopee orders found in the selected time range.',
			];
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_sync',
				sprintf( 'Shopee get_order_list found %d orders. Fetching details in chunks...', count( $order_sns ) ),
				[ 'order_sns_count' => count( $order_sns ) ]
			);
		}

		// Step 2: Call /api/v2/order/get_order_detail in batches of 50
		$raw_details = [];
		$chunks = array_chunk( $order_sns, 50 );

		foreach ( $chunks as $chunk_sns ) {
			$detail_path = '/api/v2/order/get_order_detail';
			$detail_ts = time();
			$detail_sign = self::sign_shop( $detail_path, $detail_ts, $partner_id, $partner_key, $access_token, $shop_id );

			$detail_url = "{$base_url}{$detail_path}?" . http_build_query([
				'partner_id'                => $partner_id,
				'timestamp'                 => $detail_ts,
				'access_token'              => $access_token,
				'shop_id'                   => $shop_id,
				'sign'                      => $detail_sign,
				'order_sn_list'             => implode( ',', $chunk_sns ),
				'response_optional_fields'  => 'buyer_user_id,buyer_username,recipient_address,item_list,shipping_carrier,total_amount,pay_time,order_status,package_list,note,shipping_document_status,ship_by_date,tracking_number',
			]);

			$detail_res = wp_remote_get( $detail_url, [ 'timeout' => 30 ] );
			if ( ! is_wp_error( $detail_res ) ) {
				$detail_data = json_decode( wp_remote_retrieve_body( $detail_res ), true );
				$chunk_details = $detail_data['response']['order_list'] ?? [];
				if ( is_array( $chunk_details ) ) {
					$raw_details = array_merge( $raw_details, $chunk_details );
				}
			}
		}

		$normalized_orders = [];
		foreach ( $raw_details as $ord ) {
			$norm = self::normalize_shopee_order( $ord );
			if ( $norm ) {
				$normalized_orders[] = $norm;
			}
		}

		// Merge with existing cached orders so older orders are preserved!
		$existing_cached = get_option( self::ORDERS_CACHE_KEY, [] );
		if ( ! is_array( $existing_cached ) ) {
			$existing_cached = [];
		}

		$order_map = [];
		foreach ( $existing_cached as $old_ord ) {
			if ( ! empty( $old_ord['order_sn'] ) ) {
				$order_map[ $old_ord['order_sn'] ] = $old_ord;
			}
		}
		$newly_synced_sns = [];
		foreach ( $normalized_orders as $new_ord ) {
			if ( ! empty( $new_ord['order_sn'] ) ) {
				$sn = $new_ord['order_sn'];
				$newly_synced_sns[ $sn ] = true;
				// Preserve existing tracking number if already cached
				if ( empty( $new_ord['tracking_number'] ) && ! empty( $order_map[ $sn ]['tracking_number'] ) ) {
					$new_ord['tracking_number'] = $order_map[ $sn ]['tracking_number'];
				}
				// Preserve existing printed status if previous cache marked it printed
				$was_printed = ! empty( $order_map[ $sn ]['is_printed'] ) || ( ( $order_map[ $sn ]['shipping_document_status'] ?? '' ) === 'PRINTED' );
				if ( $was_printed && empty( $new_ord['is_printed'] ) ) {
					$new_ord['is_printed'] = true;
					$new_ord['shipping_document_status'] = 'PRINTED';
				}
				// Preserve cached escrow fields before refreshing
				if ( ! empty( $order_map[ $sn ]['escrow_synced'] ) ) {
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
						'voucher_from_seller',
						'voucher_from_shopee',
						'seller_coin_cash_back',
						'actual_shipping_fee',
						'buyer_paid_shipping',
						'shopee_shipping_rebate',
					];
					foreach ( $preserve_keys as $pk ) {
						if ( isset( $order_map[ $sn ][ $pk ] ) ) {
							$new_ord[ $pk ] = $order_map[ $sn ][ $pk ];
						}
					}
				}
				$order_map[ $sn ] = $new_ord;
			}
		}

		// Step 3: Batch-fetch escrow/income settlement details for active orders
		$escrow_target_sns = [];
		foreach ( $order_map as $sn => $cand_ord ) {
			if ( count( $escrow_target_sns ) >= 360 ) {
				break;
			}
			$st = strtoupper( (string) ( $cand_ord['order_status'] ?? '' ) );
			if ( in_array( $st, [ 'UNPAID', 'CANCELLED', 'IN_CANCEL' ], true ) ) {
				continue;
			}
			$needs_escrow = empty( $cand_ord['escrow_synced'] ) || (float) ( $cand_ord['escrow_amount'] ?? 0 ) <= 0;
			if ( $needs_escrow ) {
				$escrow_target_sns[] = $sn;
			}
		}

		if ( ! empty( $escrow_target_sns ) ) {
			$escrow_map = self::fetch_escrow_details_for_orders(
				$escrow_target_sns,
				$partner_id,
				$partner_key,
				$base_url,
				$access_token,
				$shop_id
			);
			foreach ( $escrow_map as $sn => $esc ) {
				if ( isset( $order_map[ $sn ] ) ) {
					$order_map[ $sn ] = self::apply_escrow_to_order( $order_map[ $sn ], $esc );
				}
			}
		}

		// Fallback lookup: Resolve missing tracking numbers for up to 15 arranged/shipped/completed orders
		$resi_lookup_count = 0;
		foreach ( $order_map as $sn => &$m_ord ) {
			if ( $resi_lookup_count >= 15 ) break;
			$st = strtoupper( $m_ord['order_status'] ?? '' );
			if (
				empty( $m_ord['tracking_number'] ) &&
				in_array( $st, [ 'PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED' ], true )
			) {
				$resi_res = self::get_tracking_number( $sn, $m_ord['package_number'] ?? '' );
				if ( ! empty( $resi_res['response']['tracking_number'] ) ) {
					$m_ord['tracking_number'] = trim( $resi_res['response']['tracking_number'] );
					$resi_lookup_count++;
				}
			}
		}
		unset( $m_ord );

		$all_cached_orders = array_values( $order_map );
		usort( $all_cached_orders, function( $a, $b ) {
			return ( $b['create_timestamp'] ?? 0 ) <=> ( $a['create_timestamp'] ?? 0 );
		});
		$all_cached_orders = array_slice( $all_cached_orders, 0, 3000 ); // Retain up to 3,000 orders

		update_option( self::ORDERS_CACHE_KEY, $all_cached_orders );
		self::save_settings([ 'last_synced_at' => time() ]);

		$elapsed = round( microtime( true ) - $start_time, 2 );
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_sync',
				sprintf( 'Shopee order sync completed successfully: %d synced, %d total in cache (elapsed: %ss)', count( $normalized_orders ), count( $all_cached_orders ), $elapsed ),
				[
					'synced_count' => count( $normalized_orders ),
					'total_cached' => count( $all_cached_orders ),
					'elapsed_sec'  => $elapsed,
				]
			);
		}

		return [
			'success'      => true,
			'orders'       => $all_cached_orders,
			'total_synced' => count( $normalized_orders ),
			'total_cached' => count( $all_cached_orders ),
			'synced_at'    => date( 'Y-m-d H:i:s' ),
		];
	}

	/**
	 * Fetch Shopee escrow / income details in batches of 20 using get_escrow_detail_batch
	 * with single-order get_escrow_detail fallback.
	 */
	public static function fetch_escrow_details_for_orders(
		array $order_sns,
		int $partner_id,
		string $partner_key,
		string $base_url,
		string $access_token,
		int $shop_id
	): array {
		$escrow_map = [];
		$chunks = array_chunk( array_values( array_unique( $order_sns ) ), 20 );
		$single_fallback_sns = [];

		foreach ( $chunks as $chunk_sns ) {
			$batch_path = '/api/v2/payment/get_escrow_detail_batch';
			$batch_ts   = time();
			$batch_sign = self::sign_shop( $batch_path, $batch_ts, $partner_id, $partner_key, $access_token, $shop_id );

			$batch_url = "{$base_url}{$batch_path}?" . http_build_query([
				'partner_id'   => $partner_id,
				'timestamp'    => $batch_ts,
				'access_token' => $access_token,
				'shop_id'      => $shop_id,
				'sign'         => $batch_sign,
			]);

			$batch_res = wp_remote_post( $batch_url, [
				'headers' => [ 'Content-Type' => 'application/json' ],
				'body'    => wp_json_encode([ 'order_sn_list' => array_values( $chunk_sns ) ]),
				'timeout' => 25,
			]);

			$resolved_in_chunk = [];
			if ( ! is_wp_error( $batch_res ) ) {
				$batch_data = json_decode( wp_remote_retrieve_body( $batch_res ), true );
				$resp       = $batch_data['response'] ?? [];
				$entries    = [];

				if ( isset( $resp['escrow_detail'] ) && is_array( $resp['escrow_detail'] ) && isset( $resp['escrow_detail'][0] ) ) {
					$entries = $resp['escrow_detail'];
				} elseif ( isset( $resp['escrow_detail_list'] ) && is_array( $resp['escrow_detail_list'] ) ) {
					$entries = $resp['escrow_detail_list'];
				} elseif ( isset( $resp['order_list'] ) && is_array( $resp['order_list'] ) ) {
					$entries = $resp['order_list'];
				} elseif ( is_array( $resp ) ) {
					$entries = $resp;
				}

				foreach ( $entries as $entry ) {
					if ( ! is_array( $entry ) ) {
						continue;
					}
					$detail = ( isset( $entry['escrow_detail'] ) && is_array( $entry['escrow_detail'] ) ) ? $entry['escrow_detail'] : $entry;
					$sn     = (string) ( $detail['order_sn'] ?? ( $entry['order_sn'] ?? '' ) );
					$income = $detail['order_income'] ?? ( $entry['order_income'] ?? null );
					if ( ! empty( $sn ) && is_array( $income ) ) {
						$parsed = self::parse_shopee_order_income( $income );
						if ( $parsed['escrow_amount'] > 0 || $parsed['explicit_platform_fee'] > 0 ) {
							$escrow_map[ $sn ]       = $parsed;
							$resolved_in_chunk[ $sn ] = true;
						}
					}
				}
			}

			foreach ( $chunk_sns as $sn ) {
				if ( empty( $resolved_in_chunk[ $sn ] ) && count( $single_fallback_sns ) < 25 ) {
					$single_fallback_sns[] = $sn;
				}
			}
		}

		// Fallback to single get_escrow_detail if batch missed any orders
		foreach ( $single_fallback_sns as $sn ) {
			$single_path = '/api/v2/payment/get_escrow_detail';
			$single_ts   = time();
			$single_sign = self::sign_shop( $single_path, $single_ts, $partner_id, $partner_key, $access_token, $shop_id );

			$single_url = "{$base_url}{$single_path}?" . http_build_query([
				'partner_id'   => $partner_id,
				'timestamp'    => $single_ts,
				'access_token' => $access_token,
				'shop_id'      => $shop_id,
				'sign'         => $single_sign,
				'order_sn'     => $sn,
			]);

			$single_res = wp_remote_get( $single_url, [ 'timeout' => 15 ] );
			if ( ! is_wp_error( $single_res ) ) {
				$single_data = json_decode( wp_remote_retrieve_body( $single_res ), true );
				$income      = $single_data['response']['order_income'] ?? null;
				if ( is_array( $income ) ) {
					$parsed = self::parse_shopee_order_income( $income );
					if ( $parsed['escrow_amount'] > 0 || $parsed['explicit_platform_fee'] > 0 ) {
						$escrow_map[ $sn ] = $parsed;
					}
				}
			}
		}

		return $escrow_map;
	}

	/**
	 * Parse Shopee order_income array into standardized fee and escrow fields
	 */
	public static function parse_shopee_order_income( array $inc ): array {
		$escrow_raw = ( isset( $inc['escrow_amount_after_adjustment'] ) && is_numeric( $inc['escrow_amount_after_adjustment'] ) && (float) $inc['escrow_amount_after_adjustment'] > 0 )
			? (float) $inc['escrow_amount_after_adjustment']
			: (float) ( $inc['escrow_amount'] ?? 0 );
		$escrow_amount          = max( 0.0, $escrow_raw );
		$commission_fee         = abs( (float) ( $inc['commission_fee'] ?? 0 ) );
		$service_fee            = abs( (float) ( $inc['service_fee'] ?? 0 ) );
		$seller_transaction_fee = abs( (float) ( $inc['seller_transaction_fee'] ?? 0 ) );
		$ams_commission_fee     = abs( (float) ( $inc['ams_commission_fee'] ?? ( $inc['order_ams_commission_fee'] ?? 0 ) ) );
		$campaign_fee           = abs( (float) ( $inc['campaign_fee'] ?? 0 ) );
		$withholding_tax        = abs( (float) ( $inc['withholding_tax'] ?? ( $inc['escrow_tax'] ?? ( $inc['cross_border_tax'] ?? 0 ) ) ) );
		$voucher_from_seller    = abs( (float) ( $inc['voucher_from_seller'] ?? 0 ) );
		$voucher_from_shopee    = abs( (float) ( $inc['voucher_from_shopee'] ?? 0 ) );
		$seller_coin_cash_back  = abs( (float) ( $inc['seller_coin_cash_back'] ?? 0 ) );
		$coins                  = abs( (float) ( $inc['coins'] ?? 0 ) );
		$cost_of_goods_sold     = (float) ( $inc['cost_of_goods_sold'] ?? 0 );
		$actual_shipping_fee    = abs( (float) ( $inc['actual_shipping_fee'] ?? 0 ) );
		$buyer_paid_shipping    = abs( (float) ( $inc['buyer_paid_shipping_fee'] ?? 0 ) );
		$shopee_shipping_rebate = abs( (float) ( $inc['shopee_shipping_rebate'] ?? 0 ) );

		$explicit_platform_fee = $commission_fee + $service_fee + $seller_transaction_fee + $ams_commission_fee + $campaign_fee + $withholding_tax;

		return [
			'escrow_synced'          => true,
			'escrow_amount'          => $escrow_amount,
			'commission_fee'         => $commission_fee,
			'service_fee'            => $service_fee,
			'seller_transaction_fee' => $seller_transaction_fee,
			'ams_commission_fee'     => $ams_commission_fee,
			'campaign_fee'           => $campaign_fee,
			'withholding_tax'        => $withholding_tax,
			'voucher_from_seller'    => $voucher_from_seller,
			'voucher_from_shopee'    => $voucher_from_shopee,
			'seller_coin_cash_back'  => $seller_coin_cash_back,
			'coins'                  => $coins,
			'cost_of_goods_sold'     => $cost_of_goods_sold,
			'actual_shipping_fee'    => $actual_shipping_fee,
			'buyer_paid_shipping'    => $buyer_paid_shipping,
			'shopee_shipping_rebate' => $shopee_shipping_rebate,
			'explicit_platform_fee'  => $explicit_platform_fee,
		];
	}

	/**
	 * Merge parsed escrow fields onto a normalized Shopee order
	 */
	public static function apply_escrow_to_order( array $ord, array $esc ): array {
		$gross = (float) ( $ord['gross_amount'] ?? ( $ord['total_amount'] ?? 0 ) );
		if ( $esc['cost_of_goods_sold'] > 0 && $esc['cost_of_goods_sold'] > $gross ) {
			$gross = $esc['cost_of_goods_sold'];
			$ord['gross_amount'] = $gross;
		}

		$seller_voucher = $esc['voucher_from_seller'] + $esc['seller_coin_cash_back'];
		$escrow_amt     = $esc['escrow_amount'];

		if ( $escrow_amt > 0 && $gross > 0 ) {
			$implied_fee        = max( 0.0, ( $gross - $seller_voucher ) - $escrow_amt );
			$total_platform_fee = max( $esc['explicit_platform_fee'], $implied_fee );
			$other_platform_fee = max( 0.0, $total_platform_fee - $esc['explicit_platform_fee'] );
		} else {
			$total_platform_fee = $esc['explicit_platform_fee'];
			$other_platform_fee = 0.0;
			if ( $escrow_amt <= 0 && $gross > 0 && $total_platform_fee > 0 ) {
				$escrow_amt = max( 0.0, $gross - $seller_voucher - $total_platform_fee );
			}
		}

		$ord['escrow_synced']          = true;
		$ord['escrow_amount']          = $escrow_amt;
		$ord['net_escrow_amount']      = $escrow_amt;
		$ord['total_platform_fee']     = $total_platform_fee;
		$ord['commission_fee']         = $esc['commission_fee'];
		$ord['service_fee']            = $esc['service_fee'];
		$ord['seller_transaction_fee'] = $esc['seller_transaction_fee'];
		$ord['ams_commission_fee']     = $esc['ams_commission_fee'];
		$ord['other_platform_fee']     = $other_platform_fee + $esc['campaign_fee'] + $esc['withholding_tax'];
		$ord['voucher_from_seller']    = $seller_voucher;
		$ord['voucher_from_shopee']    = $esc['voucher_from_shopee'] + $esc['coins'];
		$ord['seller_coin_cash_back']  = $esc['seller_coin_cash_back'];
		$ord['actual_shipping_fee']    = $esc['actual_shipping_fee'];
		$ord['buyer_paid_shipping']    = $esc['buyer_paid_shipping'];
		$ord['shopee_shipping_rebate'] = $esc['shopee_shipping_rebate'];

		return $ord;
	}

	/**
	 * Normalize raw Shopee order array
	 */
	public static function normalize_shopee_order( array $ord ): ?array {
		$sn = $ord['order_sn'] ?? '';
		if ( empty( $sn ) ) return null;

		$claim_info = self::check_existing_claim( $sn );

		$items = [];
		$items_subtotal = 0.0;
		$original_subtotal = 0.0;
		foreach ( ( $ord['item_list'] ?? [] ) as $item ) {
			$var_name = trim( $item['model_name'] ?? '' );
			$prod_name = trim( $item['item_name'] ?? 'Exacoat Skin' );
			$item_note = trim( (string) ( $item['order_item_note'] ?? ( $item['item_note'] ?? ( $item['note'] ?? '' ) ) ) );
			$qty = (int) ( $item['model_quantity_purchased'] ?? 1 );
			$disc_price = (float) ( $item['model_discounted_price'] ?? $item['model_original_price'] ?? 0 );
			$orig_price = (float) ( $item['model_original_price'] ?? $disc_price );
			$items_subtotal += $disc_price * $qty;
			$original_subtotal += $orig_price * $qty;

			$items[] = [
				'item_id'          => $item['item_id'] ?? 0,
				'item_name'        => $prod_name,
				'model_id'         => $item['model_id'] ?? 0,
				'model_name'       => $var_name,
				'quantity'         => $qty,
				'price'            => $disc_price,
				'original_price'   => $orig_price,
				'image_url'        => $item['image_info']['image_url'] ?? '',
				'note'             => $item_note,
				'item_note'        => $item_note,
				'order_item_note'  => $item['order_item_note'] ?? '',
				'buyer_note'       => $item['buyer_note'] ?? '',
			];
		}

		$buyer_total_amount = (float) ( $ord['total_amount'] ?? 0 );
		$gross_amount = $items_subtotal > 0 ? $items_subtotal : $buyer_total_amount;
		$original_amount = $original_subtotal > 0 ? $original_subtotal : $gross_amount;
		$seller_discount = max( 0.0, $original_amount - $gross_amount );
		$platform_voucher_subsidy = $buyer_total_amount > 0 ? max( 0.0, $gross_amount - $buyer_total_amount ) : 0.0;

		$rec = $ord['recipient_address'] ?? [];
		$package = ( $ord['package_list'] ?? [] )[0] ?? [];
		$pkg_logistics_st = strtoupper( (string) ( $package['logistics_status'] ?? '' ) );
		$shipping_doc_st = '';
		if ( ! empty( $ord['shipping_document_status'] ) ) {
			$shipping_doc_st = strtoupper( (string) $ord['shipping_document_status'] );
		} else {
			foreach ( ( $ord['package_list'] ?? [] ) as $pkg_item ) {
				if ( ! empty( $pkg_item['shipping_document_status'] ) ) {
					$shipping_doc_st = strtoupper( (string) $pkg_item['shipping_document_status'] );
					break;
				}
			}
		}
		$raw_order_st = strtoupper( (string) ( $ord['order_status'] ?? 'UNKNOWN' ) );
		$tracking_num = trim( (string) ( $ord['tracking_number'] ?? ( $ord['tracking_no'] ?? '' ) ) );
		$pkg_num = '';
		if ( ! empty( $ord['package_list'] ) && is_array( $ord['package_list'] ) ) {
			foreach ( $ord['package_list'] as $pkg_item ) {
				if ( empty( $tracking_num ) ) {
					$candidate = trim( (string) ( $pkg_item['tracking_number'] ?? ( $pkg_item['tracking_no'] ?? '' ) ) );
					if ( ! empty( $candidate ) ) {
						$tracking_num = $candidate;
					}
				}
				if ( empty( $pkg_num ) && ! empty( $pkg_item['package_number'] ) ) {
					$pkg_num = trim( (string) $pkg_item['package_number'] );
				}
			}
		}

		$ship_by_ts = ! empty( $ord['ship_by_date'] ) && is_numeric( $ord['ship_by_date'] ) ? (int) $ord['ship_by_date'] : null;
		$ship_by_date = $ship_by_ts ? date( 'Y-m-d H:i:s', $ship_by_ts ) : null;

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

		// In Shopee API v2, order_status is READY_TO_SHIP before the seller arranges shipment ("Perlu Diproses").
		// Once the seller arranges shipment (pickup/dropoff booked), order_status becomes PROCESSED ("Telah Diproses").
		// Note: package logistics_status like LOGISTICS_REQUEST_CREATED or LOGISTICS_READY are pre-generated on all new orders
		// and must not be used to treat unarranged orders as arranged.
		$is_arranged = (
			$raw_order_st === 'PROCESSED' ||
			$pkg_logistics_st === 'LOGISTICS_PICKUP_DONE' ||
			in_array( $raw_order_st, [ 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED' ], true )
		);

		// Only mark as printed if Shopee explicitly returned PRINTED status
		$is_printed = ( $shipping_doc_st === 'PRINTED' );

		return [
			'order_sn'                 => $sn,
			'order_status'             => $ord['order_status'] ?? 'UNKNOWN',
			'create_time'              => function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $ord['create_time'] ?? time() ) : date( 'Y-m-d H:i:s', $ord['create_time'] ?? time() ),
			'create_timestamp'         => $ord['create_time'] ?? time(),
			'pay_time'                 => ! empty( $ord['pay_time'] ) ? ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $ord['pay_time'] ) : date( 'Y-m-d H:i:s', $ord['pay_time'] ) ) : null,
			'ship_by_date'             => $ship_by_date,
			'ship_by_timestamp'        => $ship_by_ts,
			'buyer_username'           => $ord['buyer_username'] ?? 'Shopee Customer',
			'buyer_user_id'            => $ord['buyer_user_id'] ?? 0,
			'total_amount'             => $buyer_total_amount,
			'gross_amount'             => $gross_amount,
			'original_amount'          => $original_amount,
			'buyer_paid_amount'        => $buyer_total_amount,
			'seller_discount'          => $seller_discount,
			'platform_voucher_subsidy' => $platform_voucher_subsidy,
			'currency'                 => 'IDR',
			'shipping_carrier'         => $ord['shipping_carrier'] ?? ( $package['shipping_carrier'] ?? 'SPX / J&T' ),
			'tracking_number'          => $tracking_num,
			'package_number'           => $pkg_num,
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
			'shipping_document_status' => $shipping_doc_st ?: null,
			'already_claimed'          => $claim_info['already_claimed'],
			'existing_claim'           => $claim_info,
		];
	}

	/**
	 * Live on-demand fetch of a single order directly from Shopee API
	 */
	public static function fetch_single_order_live( string $order_sn ): ?array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) return null;

		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) return null;

		$partner_id = self::get_active_partner_id();
		$partner_key = self::get_active_partner_key();
		$base_url = self::get_base_url();
		$access_token = $token_res['access_token'];
		$shop_id = $token_res['shop_id'];

		$detail_path = '/api/v2/order/get_order_detail';
		$detail_ts = time();
		$detail_sign = self::sign_shop( $detail_path, $detail_ts, $partner_id, $partner_key, $access_token, $shop_id );

		$detail_url = "{$base_url}{$detail_path}?" . http_build_query([
			'partner_id'                => $partner_id,
			'timestamp'                 => $detail_ts,
			'access_token'              => $access_token,
			'shop_id'                   => $shop_id,
			'sign'                      => $detail_sign,
			'order_sn_list'             => $clean_sn,
			'response_optional_fields'  => 'buyer_user_id,buyer_username,recipient_address,item_list,shipping_carrier,total_amount,pay_time,order_status,package_list,note,shipping_document_status,ship_by_date,tracking_number',
		]);

		$res = wp_remote_get( $detail_url, [ 'timeout' => 20 ] );
		if ( is_wp_error( $res ) ) return null;

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		$list = $data['response']['order_list'] ?? [];
		if ( empty( $list[0] ) ) return null;

		$norm = self::normalize_shopee_order( $list[0] );
		if ( $norm ) {
			// Preserve existing printed status if previous cache marked it printed
			$cached = get_option( self::ORDERS_CACHE_KEY, [] );
			if ( is_array( $cached ) ) {
				foreach ( $cached as $old_ord ) {
					if ( strcasecmp( $old_ord['order_sn'] ?? '', $clean_sn ) === 0 ) {
						$was_printed = ! empty( $old_ord['is_printed'] ) || ( ( $old_ord['shipping_document_status'] ?? '' ) === 'PRINTED' );
						if ( $was_printed ) {
							$norm['is_printed'] = true;
							$norm['shipping_document_status'] = 'PRINTED';
						}
						break;
					}
				}
			}

			// If order is arranged and not yet marked printed, query Shopee shipping document result directly
			if ( empty( $norm['is_printed'] ) && ! empty( $norm['is_arranged'] ) ) {
				$doc_res = self::get_shipping_document_result( $clean_sn );
				if ( ! empty( $doc_res['response']['result_list'][0]['status'] ) ) {
					$doc_status = strtoupper( (string) $doc_res['response']['result_list'][0]['status'] );
					$norm['shipping_document_status'] = $doc_status;
					if ( $doc_status === 'PRINTED' ) {
						$norm['is_printed'] = true;
					}
				}
			}

			// Save into cache so future accesses are instant across all admin PCs
			self::update_order_cache_field( $clean_sn, $norm );
		}
		return $norm;
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
		} elseif ( ! empty( $fields['order_sn'] ) ) {
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
				'created_at'          => $ord->get_date_created() ? ( function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i', $ord->get_date_created()->getTimestamp() ) : date_i18n( 'Y-m-d H:i', $ord->get_date_created()->getTimestamp() ) ) : '',
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
			$pickup = (array) $ship_data['pickup'];
			if ( empty( $pickup['address_id'] ) ) {
				$params = self::get_shipping_parameter( $clean_sn );
				if ( ! empty( $params['response']['pickup']['address_list'][0]['address_id'] ) ) {
					$pickup['address_id'] = $params['response']['pickup']['address_list'][0]['address_id'];
				}
			}
			$body['pickup'] = array_filter( $pickup, function( $v ) {
				return $v !== null && $v !== '';
			} );
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
	public static function create_shipping_document( string $order_sn, string $doc_type = 'THERMAL_AIR_WAYBILL', string $package_num = '', string $tracking_num = '' ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		$order_item = [ 'order_sn' => $clean_sn ];
		if ( ! empty( $package_num ) ) {
			$order_item['package_number'] = $package_num;
		}
		if ( ! empty( $tracking_num ) ) {
			$order_item['tracking_number'] = $tracking_num;
		}

		$body = [
			'order_list'             => [ $order_item ],
			'shipping_document_type' => $doc_type,
		];

		return self::call_shop_api( '/api/v2/logistics/create_shipping_document', 'POST', [], $body );
	}

	/**
	 * Get shipping document generation status
	 */
	public static function get_shipping_document_result( string $order_sn, string $doc_type = 'THERMAL_AIR_WAYBILL', string $package_num = '' ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		$order_item = [ 'order_sn' => $clean_sn ];
		if ( ! empty( $package_num ) ) {
			$order_item['package_number'] = $package_num;
		}

		$body = [
			'order_list'             => [ $order_item ],
			'shipping_document_type' => $doc_type,
		];

		return self::call_shop_api( '/api/v2/logistics/get_shipping_document_result', 'POST', [], $body );
	}

	/**
	 * Download official Shopee shipping document PDF with async polling
	 */
	public static function download_shipping_document( string $order_sn, string $doc_type = 'THERMAL_AIR_WAYBILL' ): array {
		$clean_sn = trim( preg_replace( '/^#+/', '', $order_sn ) );
		if ( empty( $clean_sn ) ) {
			return [ 'success' => false, 'error' => 'Order SN is required.' ];
		}

		$cached_orders = get_option( self::ORDERS_CACHE_KEY, [] );
		$cached_order  = null;
		foreach ( (array) $cached_orders as $ord ) {
			if ( strcasecmp( $ord['order_sn'] ?? '', $clean_sn ) === 0 ) {
				$cached_order = $ord;
				break;
			}
		}

		$pkg_num = $cached_order['package_number'] ?? '';
		$track_num = $cached_order['tracking_number'] ?? '';

		$order_item = [ 'order_sn' => $clean_sn ];
		if ( ! empty( $pkg_num ) ) {
			$order_item['package_number'] = $pkg_num;
		}
		if ( ! empty( $track_num ) ) {
			$order_item['tracking_number'] = $track_num;
		}

		$body = [
			'shipping_document_type' => $doc_type,
			'order_list'             => [ $order_item ],
		];

		// Check status first to see if document is already prepared
		$status_res = self::call_shop_api( '/api/v2/logistics/get_shipping_document_result', 'POST', [], $body );
		$result_list = $status_res['response']['result_list'] ?? [];
		$doc_status = '';
		if ( is_array( $result_list ) && ! empty( $result_list[0]['status'] ) ) {
			$doc_status = strtoupper( (string) $result_list[0]['status'] );
		}

		// If not ready, trigger creation and poll up to 4 times
		if ( $doc_status !== 'READY' ) {
			self::call_shop_api( '/api/v2/logistics/create_shipping_document', 'POST', [], $body );

			for ( $i = 0; $i < 4; $i++ ) {
				sleep( 1 );
				$poll_res = self::call_shop_api( '/api/v2/logistics/get_shipping_document_result', 'POST', [], $body );
				$p_list = $poll_res['response']['result_list'] ?? [];
				if ( is_array( $p_list ) && ! empty( $p_list[0]['status'] ) ) {
					$st = strtoupper( (string) $p_list[0]['status'] );
					if ( $st === 'READY' ) {
						$doc_status = 'READY';
						break;
					}
					if ( $st === 'FAILED' ) {
						return [
							'success' => false,
							'error'   => 'Shopee gagal membuat dokumen pengiriman: ' . ( $p_list[0]['fail_message'] ?? 'Status FAILED' ),
						];
					}
				}
			}
		}

		// Download binary PDF directly from Shopee
		$download_res = self::call_shop_api( '/api/v2/logistics/download_shipping_document', 'POST', [], $body );
		if ( ! empty( $download_res['is_pdf'] ) ) {
			self::update_order_cache_field( $clean_sn, [
				'shipping_document_status' => 'PRINTED',
				'is_printed'               => true,
			]);
			return $download_res;
		}

		if ( ! empty( $download_res['error'] ) ) {
			return [
				'success' => false,
				'error'   => 'Shopee API: ' . ( $download_res['message'] ?? $download_res['error'] ),
			];
		}

		return $download_res;
	}

	/**
	 * Download batch official Shopee shipping documents into one combined PDF
	 */
	public static function download_batch_shipping_documents( array $order_sns, string $doc_type = 'THERMAL_AIR_WAYBILL' ): array {
		$clean_sns = [];
		foreach ( $order_sns as $sn ) {
			$c = trim( preg_replace( '/^#+/', '', $sn ) );
			if ( ! empty( $c ) ) {
				$clean_sns[] = $c;
			}
		}
		if ( empty( $clean_sns ) ) {
			return [ 'success' => false, 'error' => 'Daftar Order SN kosong.' ];
		}

		$cached_orders = get_option( self::ORDERS_CACHE_KEY, [] );
		$order_map = [];
		foreach ( (array) $cached_orders as $ord ) {
			if ( ! empty( $ord['order_sn'] ) ) {
				$order_map[ strtoupper( $ord['order_sn'] ) ] = $ord;
			}
		}

		$order_list = [];
		foreach ( $clean_sns as $sn ) {
			$c_ord = $order_map[ strtoupper( $sn ) ] ?? null;
			$item = [ 'order_sn' => $sn ];
			if ( ! empty( $c_ord['package_number'] ) ) {
				$item['package_number'] = $c_ord['package_number'];
			}
			if ( ! empty( $c_ord['tracking_number'] ) ) {
				$item['tracking_number'] = $c_ord['tracking_number'];
			}
			$order_list[] = $item;
		}

		if ( empty( $order_list ) ) {
			return [
				'success' => false,
				'error'   => 'Semua pesanan yang dipilih belum diatur pengirimannya (' . implode( ', ', $unarranged ) . '). Silakan atur pengiriman terlebih dahulu.',
			];
		}

		$body = [
			'shipping_document_type' => $doc_type,
			'order_list'             => $order_list,
		];

		// Trigger creation
		self::call_shop_api( '/api/v2/logistics/create_shipping_document', 'POST', [], $body );

		// Poll up to 5 times
		for ( $i = 0; $i < 5; $i++ ) {
			sleep( 1 );
			$poll_res = self::call_shop_api( '/api/v2/logistics/get_shipping_document_result', 'POST', [], $body );
			$p_list = $poll_res['response']['result_list'] ?? [];
			$all_ready = true;
			if ( is_array( $p_list ) && ! empty( $p_list ) ) {
				foreach ( $p_list as $res_item ) {
					$st = strtoupper( (string) ( $res_item['status'] ?? '' ) );
					if ( $st !== 'READY' ) {
						$all_ready = false;
						break;
					}
				}
				if ( $all_ready ) {
					break;
				}
			}
		}

		$download_res = self::call_shop_api( '/api/v2/logistics/download_shipping_document', 'POST', [], $body );
		if ( ! empty( $download_res['is_pdf'] ) ) {
			foreach ( $order_list as $oi ) {
				self::update_order_cache_field( $oi['order_sn'], [
					'shipping_document_status' => 'PRINTED',
					'is_printed'               => true,
				]);
			}
			return $download_res;
		}

		if ( ! empty( $download_res['error'] ) ) {
			return [
				'success' => false,
				'error'   => 'Shopee API: ' . ( $download_res['message'] ?? $download_res['error'] ),
			];
		}

		return $download_res;
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

		// 12. POST /shopee/orders/toggle-print
		register_rest_route( $ns, '/shopee/orders/toggle-print', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_toggle_order_print' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 13. GET /shopee/product-preview
		register_rest_route( $ns, '/shopee/product-preview', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_product_preview' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 14. POST /shopee/upload-image
		register_rest_route( $ns, '/shopee/upload-image', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_upload_image' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 15. POST /shopee/duplicate-product
		register_rest_route( $ns, '/shopee/duplicate-product', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_duplicate_product' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 16. GET /shopee/products
		register_rest_route( $ns, '/shopee/products', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_products' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 17. POST /shopee/product/set-status
		register_rest_route( $ns, '/shopee/product/set-status', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_set_product_status' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 18. POST /shopee/product/delete
		register_rest_route( $ns, '/shopee/product/delete', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_delete_product' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);

		// 19. POST /shopee/product/inject-images
		register_rest_route( $ns, '/shopee/product/inject-images', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_inject_product_images' ],
			'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
		]);
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

		// Ensure READY_TO_SHIP orders are never falsely marked as arranged
		$cache_dirty = false;
		foreach ( $cached as &$c_ord ) {
			if ( ( $c_ord['order_status'] ?? '' ) === 'READY_TO_SHIP' && ! empty( $c_ord['is_arranged'] ) ) {
				$c_ord['is_arranged'] = false;
				$cache_dirty = true;
			}
		}
		unset( $c_ord );
		if ( $cache_dirty ) {
			update_option( self::ORDERS_CACHE_KEY, $cached );
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

			// If no match in cache and search string looks like an order SN, attempt on-demand live lookup from Shopee API
			if ( empty( $filtered ) && strlen( $search ) >= 6 && ! str_contains( $search, ' ' ) ) {
				$live_order = self::fetch_single_order_live( $search );
				if ( $live_order ) {
					$filtered = [ $live_order ];
				}
			}
		}

		// Sort by create_timestamp desc
		usort( $filtered, function( $a, $b ) {
			return ( $b['create_timestamp'] ?? 0 ) <=> ( $a['create_timestamp'] ?? 0 );
		});

		// Resolve missing tracking numbers on-the-fly for up to 10 recent orders that are arranged or shipped
		$resolved_resi_count = 0;
		$cache_resi_updated = false;
		foreach ( $filtered as &$f_ord ) {
			if ( $resolved_resi_count >= 10 ) break;
			$st = strtoupper( $f_ord['order_status'] ?? '' );
			if (
				empty( $f_ord['tracking_number'] ) &&
				in_array( $st, [ 'PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED' ], true )
			) {
				$resi_res = self::get_tracking_number( $f_ord['order_sn'], $f_ord['package_number'] ?? '' );
				if ( ! empty( $resi_res['response']['tracking_number'] ) ) {
					$f_ord['tracking_number'] = trim( $resi_res['response']['tracking_number'] );
					foreach ( $cached as &$c_target ) {
						if ( ( $c_target['order_sn'] ?? '' ) === $f_ord['order_sn'] ) {
							$c_target['tracking_number'] = $f_ord['tracking_number'];
							break;
						}
					}
					unset( $c_target );
					$cache_resi_updated = true;
					$resolved_resi_count++;
				}
			}
		}
		unset( $f_ord );
		if ( $cache_resi_updated ) {
			update_option( self::ORDERS_CACHE_KEY, $cached );
		}

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
			'shop_id'                 => $s['shop_id'],
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
		$order_sns_param = $request->get_param( 'order_sns' );
		$doc_type = sanitize_text_field( $request->get_param( 'document_type' ) ?: 'THERMAL_AIR_WAYBILL' );

		if ( ! empty( $order_sns_param ) ) {
			$sns = is_array( $order_sns_param ) ? $order_sns_param : explode( ',', (string) $order_sns_param );
			$res = self::download_batch_shipping_documents( $sns, $doc_type );
		} else {
			$res = self::download_shipping_document( $order_sn, $doc_type );
		}

		if ( ! empty( $res['is_pdf'] ) && ! empty( $res['pdf_data'] ) ) {
			header( 'Content-Type: application/pdf' );
			header( 'Content-Disposition: inline; filename="shopee-awb-' . ( $order_sn ?: 'batch' ) . '.pdf"' );
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

		// Check cached orders first by order_sn, tracking_number, or package_number
		$cached = get_option( self::ORDERS_CACHE_KEY, [] );
		$found = null;
		foreach ( (array) $cached as $ord ) {
			if (
				strcasecmp( $ord['order_sn'] ?? '', $clean ) === 0 ||
				( ! empty( $ord['tracking_number'] ) && strcasecmp( $ord['tracking_number'], $clean ) === 0 ) ||
				( ! empty( $ord['package_number'] ) && strcasecmp( $ord['package_number'], $clean ) === 0 )
			) {
				$found = $ord;
				break;
			}
		}

		$order_sn_to_verify = $found['order_sn'] ?? $clean;

		// Check if already claimed
		$claim_info = self::check_existing_claim( $order_sn_to_verify );
		if ( $claim_info['already_claimed'] ) {
			return rest_ensure_response([
				'success'             => false,
				'already_claimed'     => true,
				'message'             => "This Shopee order ({$order_sn_to_verify}) has already been processed for replacement under Order #{$claim_info['existing_order_num']} ({$claim_info['claim_type']}).",
				'existing_order_num'  => $claim_info['existing_order_num'],
				'existing_order_type' => $claim_info['claim_type'],
			]);
		}

		// If not in cache, query Shopee Open API v2 live
		if ( ! $found ) {
			$live_order = self::fetch_single_order_live( $clean );
			if ( $live_order ) {
				$found = $live_order;
			}
		}

		if ( ! $found ) {
			$detail_res = self::call_shop_api( '/api/v2/order/get_order_detail', 'GET', [
				'order_sn_list'            => $clean,
				'response_optional_fields' => 'buyer_user_id,buyer_username,recipient_address,item_list,shipping_carrier,total_amount,pay_time,order_status,package_list,note,shipping_document_status,ship_by_date,tracking_number',
			]);
			if ( ! empty( $detail_res['response']['order_list'][0] ) ) {
				$live_ord = $detail_res['response']['order_list'][0];
				$raw_st = strtoupper( (string) ( $live_ord['order_status'] ?? 'UNKNOWN' ) );
				$package = ( $live_ord['package_list'] ?? [] )[0] ?? [];
				$pkg_logistics_st = strtoupper( (string) ( $package['logistics_status'] ?? '' ) );
				$tracking_num = trim( (string) ( $live_ord['tracking_number'] ?? ( $package['tracking_number'] ?? '' ) ) );
				if ( empty( $tracking_num ) && in_array( $raw_st, [ 'PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED' ], true ) ) {
					$resi_res = self::get_tracking_number( $clean, $package['package_number'] ?? '' );
					if ( ! empty( $resi_res['response']['tracking_number'] ) ) {
						$tracking_num = trim( $resi_res['response']['tracking_number'] );
					}
				}
				$rec = $live_ord['recipient_address'] ?? [];

				$items = [];
				foreach ( ( $live_ord['item_list'] ?? [] ) as $item ) {
					$item_note = trim( (string) ( $item['order_item_note'] ?? ( $item['item_note'] ?? ( $item['note'] ?? '' ) ) ) );
					$items[] = [
						'item_id'    => $item['item_id'] ?? 0,
						'item_name'  => trim( $item['item_name'] ?? 'Exacoat Skin' ),
						'model_id'   => $item['model_id'] ?? 0,
						'model_name' => trim( $item['model_name'] ?? '' ),
						'quantity'   => (int) ( $item['model_quantity_purchased'] ?? 1 ),
						'price'      => (float) ( $item['model_discounted_price'] ?? $item['model_original_price'] ?? 0 ),
						'image_url'  => $item['image_info']['image_url'] ?? '',
						'note'       => $item_note,
						'item_note'  => $item_note,
					];
				}

				$found = [
					'order_sn'         => $live_ord['order_sn'] ?? $clean,
					'order_status'     => $raw_st,
					'buyer_username'   => $live_ord['buyer_username'] ?? 'Shopee Customer',
					'buyer_note'       => $live_ord['note'] ?? '',
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

		// If found in cache but not yet marked delivered, query live order details from Shopee API to check updated status
		if ( $found && empty( $found['is_delivered'] ) && ! in_array( strtoupper( $found['order_status'] ?? '' ), [ 'COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE' ], true ) ) {
			$live_refresh = self::fetch_single_order_live( $order_sn_to_verify );
			if ( $live_refresh ) {
				$found = $live_refresh;
			}
		}

		// Query tracking info to detect live delivery status
		$tracking_target = $found['order_sn'] ?? $clean;
		$tracking        = self::get_tracking_info( $tracking_target );
		$order_status    = $found['order_status'] ?? ( $tracking['logistics_status'] ?: 'UNKNOWN' );
		$is_delivered    = ! empty( $tracking['is_delivered'] ) || in_array( strtoupper( $order_status ), [ 'COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE' ], true ) || ! empty( $found['is_delivered'] );
		$delivered_time  = $tracking['delivered_time'] ?? ( $found['delivered_time'] ?? null );
		$delivered_ts    = $tracking['delivered_ts'] ?? ( $found['delivered_ts'] ?? null );

		if ( $found ) {
			return rest_ensure_response([
				'success'          => true,
				'order_sn'         => $found['order_sn'],
				'order_status'     => $is_delivered ? 'COMPLETED' : $order_status,
				'is_delivered'     => $is_delivered,
				'delivered_time'   => $delivered_time,
				'delivered_ts'     => $delivered_ts,
				'buyer_username'   => $found['buyer_username'] ?? '',
				'buyer_note'       => $found['buyer_note'] ?? '',
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
				$order_sn = (string) ( $data['ordersn'] ?? ( $data['order_sn'] ?? '' ) );
				$status   = (string) ( $data['status'] ?? '' );
				if ( ! empty( $order_sn ) ) {
					$status_upper = strtoupper( $status );
					$is_delivered = in_array( $status_upper, [ 'COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE' ], true );
					$update_ts    = ! empty( $data['update_time'] ) ? (int) $data['update_time'] : time();
					$fields       = [
						'order_status' => $status,
						'update_time'  => function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $update_ts ) : date( 'Y-m-d H:i:s', $update_ts ),
					];
					if ( $is_delivered ) {
						$fields['is_delivered']   = true;
						$fields['delivered_time'] = function_exists( 'wp_date' ) ? wp_date( 'Y-m-d H:i:s', $update_ts ) : date( 'Y-m-d H:i:s', $update_ts );
						$fields['delivered_ts']   = $update_ts;
					}

					$updated = self::update_order_cache_field( $order_sn, $fields );
					if ( ! $updated ) {
						self::fetch_single_order_live( $order_sn );
					}

					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log(
							'info',
							'shopee_push',
							sprintf( 'Updated order_status to %s for Order SN %s (delivered: %s)', $status, $order_sn, $is_delivered ? 'yes' : 'no' )
						);
					}
				}
				break;

			case 4:
			case 24:
				// order_trackingno_push / booking_trackingno_push: Live courier resi assigned or updated
				$order_sn = (string) ( $data['ordersn'] ?? ( $data['order_sn'] ?? '' ) );
				$tracking_no = (string) ( $data['tracking_no'] ?? ( $data['tracking_number'] ?? '' ) );
				if ( ! empty( $order_sn ) ) {
					$updated = self::update_order_cache_field( $order_sn, [
						'tracking_number' => $tracking_no,
					]);
					if ( ! $updated ) {
						self::fetch_single_order_live( $order_sn );
					}
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log(
							'info',
							'shopee_push',
							sprintf( 'Updated tracking_number to %s for Order SN %s', $tracking_no, $order_sn )
						);
					}
				}
				break;

			case 15:
			case 25:
				// shipping_document_status_push / booking_shipping_document_status_push
				$order_sn = $data['ordersn'] ?? ( $data['order_sn'] ?? '' );
				$doc_st   = strtoupper( (string) ( $data['status'] ?? '' ) );
				if ( ! empty( $order_sn ) ) {
					$fields = [
						'shipping_document_status' => $doc_st,
					];
					if ( in_array( $doc_st, [ 'PRINTED', 'READY' ], true ) ) {
						$fields['is_printed'] = ( $doc_st === 'PRINTED' );
					}
					self::update_order_cache_field( $order_sn, $fields );
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log(
							'info',
							'shopee_push',
							sprintf( 'Updated shipping_document_status to %s for Order SN %s', $doc_st, $order_sn )
						);
					}
				}
				break;

			case 23:
				// booking_status_push: Logistics pickup/dropoff booking status update
				$order_sn = $data['ordersn'] ?? ( $data['order_sn'] ?? '' );
				$booking_st = $data['status'] ?? '';
				if ( ! empty( $order_sn ) && class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log(
						'info',
						'shopee_push',
						sprintf( 'Received booking_status_push (%s) for Order SN %s', $booking_st, $order_sn )
					);
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

	/**
	 * Toggle or update print status of a cached order
	 */
	public static function rest_toggle_order_print( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params() ?: [];
		$sn = trim( (string) ( $body['order_sn'] ?? $request->get_param( 'order_sn' ) ?? '' ) );
		$is_printed = isset( $body['is_printed'] ) ? (bool) $body['is_printed'] : true;

		if ( empty( $sn ) ) {
			return new \WP_REST_Response([ 'success' => false, 'error' => 'Order SN is required.' ], 400 );
		}

		$updated = self::update_order_cache_field( $sn, [
			'is_printed'               => $is_printed,
			'shipping_document_status' => $is_printed ? 'PRINTED' : 'UNPRINTED',
		]);

		return new \WP_REST_Response([
			'success'    => $updated,
			'order_sn'   => $sn,
			'is_printed' => $is_printed,
		]);
	}

	/**
	 * Parse Shopee item ID from plain ID or product page URL
	 */
	public static function parse_shopee_item_id( string $input ): int {
		$clean = trim( $input );
		if ( is_numeric( $clean ) ) {
			return (int) $clean;
		}

		// Match standard Shopee URL pattern: ...-i.{shop_id}.{item_id}
		if ( preg_match( '/-i\.\d+\.(\d+)/', $clean, $matches ) ) {
			return (int) $matches[1];
		}

		// Match secondary format: .../{shop_id}/{item_id} or .{item_id}?
		if ( preg_match( '/\.(\d{8,14})(?:[?&#]|$)/', $clean, $matches ) ) {
			return (int) $matches[1];
		}

		return 0;
	}

	/**
	 * REST Endpoint: Preview a Shopee product and its models
	 */
	public static function rest_product_preview( \WP_REST_Request $request ): \WP_REST_Response {
		$input = trim( (string) ( $request->get_param( 'item_id' ) ?? $request->get_param( 'url' ) ?? '' ) );
		$item_id = self::parse_shopee_item_id( $input );

		if ( empty( $item_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid Shopee Item ID or Product URL is required.',
			], 400 );
		}

		// 1. Fetch base info
		$base_res = self::call_shop_api( '/api/v2/product/get_item_base_info', 'GET', [
			'item_id_list' => (string) $item_id,
		]);

		if ( ! $base_res['success'] ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $base_res['error'] ?? 'Failed to retrieve item base info from Shopee.',
				'message' => $base_res['message'] ?? '',
				'raw'     => $base_res['raw'] ?? null,
			], 400 );
		}

		$item_list = $base_res['response']['item_list'] ?? [];
		if ( empty( $item_list[0] ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => "Shopee product #{$item_id} was not found in connected shop.",
			], 404 );
		}

		$source = $item_list[0];

		// 2. Fetch models and variations if product has models
		$models = [];
		$tier_variation = [];
		if ( ! empty( $source['has_model'] ) ) {
			$model_res = self::call_shop_api( '/api/v2/product/get_model_list', 'GET', [
				'item_id' => $item_id,
			]);

			if ( $model_res['success'] && ! empty( $model_res['response'] ) ) {
				$tier_variation = $model_res['response']['tier_variation'] ?? [];
				$raw_models = $model_res['response']['model'] ?? [];
				foreach ( $raw_models as $m ) {
					$models[] = [
						'model_id'       => $m['model_id'] ?? 0,
						'tier_index'     => $m['tier_index'] ?? [],
						'model_sku'      => $m['model_sku'] ?? '',
						'original_price' => (float) ( $m['price_info'][0]['original_price'] ?? $source['original_price'] ?? 0 ),
						'current_price'  => (float) ( $m['price_info'][0]['current_price'] ?? $source['original_price'] ?? 0 ),
						'normal_stock'   => (int) ( $m['stock_info_v2']['summary_info']['total_available_stock'] ?? 0 ),
					];
				}
			}
		}

		// Format images
		$images = [];
		$img_ids = $source['image']['image_id_list'] ?? [];
		$img_urls = $source['image']['image_url_list'] ?? [];
		foreach ( $img_ids as $idx => $id ) {
			$images[] = [
				'image_id'  => $id,
				'image_url' => $img_urls[ $idx ] ?? '',
			];
		}

		// Infer device name from title
		$item_name = (string) ( $source['item_name'] ?? '' );
		$inferred_device = '';
		if ( preg_match( '/(iPhone\s+\d+(?:\s*(?:Pro\s*Max|Pro|Plus|Mini))?|iPad\s+[A-Za-z0-9\s]+|MacBook\s+[A-Za-z0-9\s]+|Galaxy\s+[A-Za-z0-9\s]+)/i', $item_name, $dev_matches ) ) {
			$inferred_device = trim( $dev_matches[1] );
		}

		return new \WP_REST_Response([
			'success'         => true,
			'item_id'         => (int) $source['item_id'],
			'item_name'       => $item_name,
			'description'     => (string) ( $source['description'] ?? '' ),
			'category_id'     => (int) ( $source['category_id'] ?? 0 ),
			'brand'           => $source['brand'] ?? [ 'brand_id' => 0, 'original_brand_name' => 'Exacoat' ],
			'item_status'     => (string) ( $source['item_status'] ?? 'NORMAL' ),
			'weight'          => (float) ( $source['weight'] ?? 0.05 ),
			'dimension'       => $source['dimension'] ?? [ 'package_height' => 1, 'package_length' => 20, 'package_width' => 15 ],
			'logistic_info'   => $source['logistic_info'] ?? [],
			'attribute_list'  => $source['attribute_list'] ?? [],
			'images'          => $images,
			'tier_variation'  => $tier_variation,
			'models'          => $models,
			'inferred_device' => $inferred_device,
		], 200 );
	}

	/**
	 * Upload an image buffer to Shopee Media Space API
	 */
	public static function upload_media_image( string $image_bytes, string $filename = 'product.jpg' ): array {
		$token_res = self::ensure_valid_token();
		if ( ! $token_res['success'] ) {
			return $token_res;
		}

		$access_token = $token_res['access_token'];
		$shop_id      = (int) $token_res['shop_id'];
		$partner_id   = self::get_active_partner_id();
		$partner_key  = self::get_active_partner_key();
		$base_url     = self::get_base_url();

		$path = '/api/v2/media_space/upload_image';
		$timestamp = time();
		$sign = self::sign_shop( $path, $timestamp, $partner_id, $partner_key, $access_token, $shop_id );

		$query = http_build_query([
			'partner_id'   => $partner_id,
			'timestamp'    => $timestamp,
			'access_token' => $access_token,
			'shop_id'      => $shop_id,
			'sign'         => $sign,
		]);
		$url = "{$base_url}{$path}?{$query}";

		$boundary = wp_generate_uuid4();
		$mime_type = 'image/jpeg';
		if ( str_ends_with( strtolower( $filename ), '.png' ) ) {
			$mime_type = 'image/png';
		}

		$payload = '';
		// Field: scene
		$payload .= "--{$boundary}\r\n";
		$payload .= "Content-Disposition: form-data; name=\"scene\"\r\n\r\n";
		$payload .= "normal\r\n";

		// Field: image file
		$payload .= "--{$boundary}\r\n";
		$payload .= "Content-Disposition: form-data; name=\"image\"; filename=\"{$filename}\"\r\n";
		$payload .= "Content-Type: {$mime_type}\r\n\r\n";
		$payload .= $image_bytes . "\r\n";
		$payload .= "--{$boundary}--\r\n";

		$res = wp_remote_post( $url, [
			'headers' => [
				'Content-Type' => "multipart/form-data; boundary={$boundary}",
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
		if ( ! empty( $data['error'] ) ) {
			return [
				'success' => false,
				'error'   => $data['error'],
				'message' => $data['message'] ?? 'Failed to upload image to Shopee media space.',
			];
		}

		$info = $data['response']['image_info'] ?? [];
		if ( empty( $info['image_id'] ) ) {
			return [
				'success' => false,
				'error'   => 'Shopee media space did not return an image ID.',
			];
		}

		$first_url = $info['image_url_list'][0]['image_url'] ?? '';

		return [
			'success'   => true,
			'image_id'  => $info['image_id'],
			'image_url' => $first_url,
		];
	}

	/**
	 * REST Endpoint: Upload an image to Shopee Media Space
	 */
	public static function rest_upload_image( \WP_REST_Request $request ): \WP_REST_Response {
		$filename = 'product.jpg';
		$image_bytes = '';

		// Check for base64 payload
		$body = $request->get_json_params() ?: [];
		if ( ! empty( $body['image_data'] ) ) {
			$raw_b64 = (string) $body['image_data'];
			if ( preg_match( '/^data:image\/(\w+);base64,/', $raw_b64, $m ) ) {
				$filename = 'product.' . ( $m[1] === 'png' ? 'png' : 'jpg' );
				$raw_b64 = substr( $raw_b64, strpos( $raw_b64, ',' ) + 1 );
			}
			$image_bytes = base64_decode( $raw_b64 );
		} elseif ( ! empty( $_FILES['image']['tmp_name'] ) && is_uploaded_file( $_FILES['image']['tmp_name'] ) ) {
			$filename = sanitize_file_name( $_FILES['image']['name'] ?? 'product.jpg' );
			$image_bytes = file_get_contents( $_FILES['image']['tmp_name'] );
		}

		if ( empty( $image_bytes ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'No image data or file provided for upload.',
			], 400 );
		}

		$upload_res = self::upload_media_image( $image_bytes, $filename );
		if ( ! $upload_res['success'] ) {
			return new \WP_REST_Response( $upload_res, 400 );
		}

		return new \WP_REST_Response( $upload_res, 200 );
	}

	/**
	 * REST Endpoint: Duplicate Shopee product into draft (UNLIST) status
	 */
	public static function rest_duplicate_product( \WP_REST_Request $request ): \WP_REST_Response {
		@set_time_limit( 90 );
		$body = $request->get_json_params() ?: [];

		$source_input = trim( (string) ( $body['source_item_id'] ?? $body['source_url'] ?? '' ) );
		$source_item_id = self::parse_shopee_item_id( $source_input );
		$source_device = trim( (string) ( $body['source_device'] ?? '' ) );
		$target_device = trim( (string) ( $body['target_device'] ?? '' ) );

		if ( empty( $source_item_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid source Shopee Item ID or Product URL is required.',
			], 400 );
		}

		if ( empty( $target_device ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'Target device name is required (e.g. iPhone 18 Pro Max).',
			], 400 );
		}

		// 1. Fetch source product base info
		$base_res = self::call_shop_api( '/api/v2/product/get_item_base_info', 'GET', [
			'item_id_list' => (string) $source_item_id,
		]);

		if ( ! $base_res['success'] || empty( $base_res['response']['item_list'][0] ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'Could not fetch source product details from Shopee.',
				'message' => $base_res['message'] ?? '',
			], 400 );
		}

		$src = $base_res['response']['item_list'][0];

		// Auto-detect source device if not specified
		if ( empty( $source_device ) ) {
			if ( preg_match( '/(iPhone\s+\d+(?:\s*(?:Pro\s*Max|Pro|Plus|Mini))?|iPad\s+[A-Za-z0-9\s]+|MacBook\s+[A-Za-z0-9\s]+|Galaxy\s+[A-Za-z0-9\s]+)/i', $src['item_name'], $m ) ) {
				$source_device = trim( $m[1] );
			}
		}

		// Compute new item title and description with device name substitution
		$raw_title = $src['item_name'];
		$new_title = ! empty( $body['custom_item_name'] )
			? trim( (string) $body['custom_item_name'] )
			: ( ! empty( $source_device ) ? str_ireplace( $source_device, $target_device, $raw_title ) : "{$raw_title} ({$target_device})" );

		$raw_desc = (string) ( $src['description'] ?? '' );
		$new_desc = ! empty( $body['custom_description'] )
			? trim( (string) $body['custom_description'] )
			: ( ! empty( $source_device ) ? str_ireplace( $source_device, $target_device, $raw_desc ) : $raw_desc );

		// Prepare images: custom image IDs or source image IDs
		$image_ids = [];
		if ( ! empty( $body['custom_image_ids'] ) && is_array( $body['custom_image_ids'] ) ) {
			$image_ids = array_values( array_filter( array_map( 'strval', $body['custom_image_ids'] ) ) );
		}
		if ( empty( $image_ids ) && ! empty( $src['image']['image_id_list'] ) ) {
			$image_ids = $src['image']['image_id_list'];
		}

		// Cap image count to 9 (Shopee maximum)
		$image_ids = array_slice( $image_ids, 0, 9 );

		// Fetch source models to extract base pricing and variation structures
		$model_res = self::call_shop_api( '/api/v2/product/get_model_list', 'GET', [
			'item_id' => $source_item_id,
		]);

		$source_tier_variation = [];
		$source_models = [];
		$base_price = (float) ( $src['original_price'] ?? 149000 );

		if ( $model_res['success'] && ! empty( $model_res['response'] ) ) {
			$source_tier_variation = $model_res['response']['tier_variation'] ?? [];
			$source_models = $model_res['response']['model'] ?? [];
			if ( ! empty( $source_models[0]['price_info'][0]['original_price'] ) ) {
				$base_price = (float) $source_models[0]['price_info'][0]['original_price'];
			}
		}

		if ( $base_price <= 0 ) {
			$base_price = 149000;
		}

		// 2. Fetch enabled logistics channels for the shop (mandatory in Shopee add_item)
		$logistic_info = [];
		$channel_res = self::call_shop_api( '/api/v2/logistics/get_channel_list', 'GET' );
		if ( ! empty( $channel_res['response']['logistics_channel_list'] ) ) {
			foreach ( $channel_res['response']['logistics_channel_list'] as $ch ) {
				if ( ! empty( $ch['enabled'] ) && ! empty( $ch['logistics_channel_id'] ) ) {
					$logistic_info[] = [
						'logistic_id' => (int) $ch['logistics_channel_id'],
						'enabled'     => true,
					];
				}
			}
		}

		if ( empty( $logistic_info ) ) {
			// Fallback: standard Indonesian Shopee logistics channel IDs
			$logistic_info = [
				[ 'logistic_id' => 80001, 'enabled' => true ],
				[ 'logistic_id' => 80002, 'enabled' => true ],
			];
		}

		// Brand object formatting
		$brand = [
			'brand_id'            => (int) ( $src['brand']['brand_id'] ?? 0 ),
			'original_brand_name' => (string) ( $src['brand']['original_brand_name'] ?? 'NoBrand' ),
		];
		if ( empty( $brand['original_brand_name'] ) ) {
			$brand['original_brand_name'] = 'NoBrand';
		}

		// Weight and Dimension formatting
		$weight = (float) ( $src['weight'] ?? 0.05 );
		if ( $weight <= 0 ) {
			$weight = 0.05;
		}

		$dimension = $src['dimension'] ?? [ 'package_height' => 1, 'package_length' => 20, 'package_width' => 15 ];
		if ( empty( $dimension['package_height'] ) ) $dimension['package_height'] = 1;
		if ( empty( $dimension['package_length'] ) ) $dimension['package_length'] = 20;
		if ( empty( $dimension['package_width'] ) ) $dimension['package_width'] = 15;

		// Resolve location_id from source product or models (mandatory for multi-warehouse shops)
		$detected_location_id = '';
		if ( ! empty( $src['stock_info_v2']['seller_stock'] ) && is_array( $src['stock_info_v2']['seller_stock'] ) ) {
			foreach ( $src['stock_info_v2']['seller_stock'] as $ss ) {
				if ( ! empty( $ss['location_id'] ) && $ss['location_id'] !== '-' ) {
					$detected_location_id = (string) $ss['location_id'];
					break;
				}
			}
		}
		if ( empty( $detected_location_id ) && ! empty( $source_models ) ) {
			foreach ( $source_models as $sm ) {
				if ( ! empty( $sm['stock_info_v2']['seller_stock'] ) && is_array( $sm['stock_info_v2']['seller_stock'] ) ) {
					foreach ( $sm['stock_info_v2']['seller_stock'] as $ss ) {
						if ( ! empty( $ss['location_id'] ) && $ss['location_id'] !== '-' ) {
							$detected_location_id = (string) $ss['location_id'];
							break 2;
						}
					}
				}
			}
		}
		if ( empty( $detected_location_id ) ) {
			$wh_res = self::call_shop_api( '/api/v2/shop/get_warehouse_detail', 'GET' );
			if ( ! empty( $wh_res['response'] ) ) {
				$wh_data = $wh_res['response'];
				$wh_candidates = [];
				if ( ! empty( $wh_data['warehouse_list'] ) && is_array( $wh_data['warehouse_list'] ) ) {
					$wh_candidates = $wh_data['warehouse_list'];
				} elseif ( ! empty( $wh_data['warehouse_detail_list'] ) && is_array( $wh_data['warehouse_detail_list'] ) ) {
					$wh_candidates = $wh_data['warehouse_detail_list'];
				} elseif ( is_array( $wh_data ) && isset( $wh_data[0] ) ) {
					$wh_candidates = $wh_data;
				}
				foreach ( $wh_candidates as $wh ) {
					if ( ! empty( $wh['location_id'] ) && $wh['location_id'] !== '-' ) {
						$detected_location_id = (string) $wh['location_id'];
						break;
					}
				}
			}
		}

		// Format seller_stock for base product add_item (mandatory in Shopee Open Platform V2)
		$base_seller_stock = [];
		if ( ! empty( $src['stock_info_v2']['seller_stock'] ) && is_array( $src['stock_info_v2']['seller_stock'] ) ) {
			foreach ( $src['stock_info_v2']['seller_stock'] as $stk ) {
				$qty = (int) ( $stk['stock'] ?? 0 );
				if ( $qty <= 0 ) {
					$qty = 100;
				}
				$entry = [ 'stock' => $qty ];
				if ( ! empty( $stk['location_id'] ) && $stk['location_id'] !== '-' ) {
					$entry['location_id'] = (string) $stk['location_id'];
				} elseif ( ! empty( $detected_location_id ) ) {
					$entry['location_id'] = $detected_location_id;
				}
				$base_seller_stock[] = $entry;
			}
		}

		if ( empty( $base_seller_stock ) ) {
			$entry = [ 'stock' => 100 ];
			if ( ! empty( $detected_location_id ) ) {
				$entry['location_id'] = $detected_location_id;
			}
			$base_seller_stock[] = $entry;
		}

		// 3. Create Base Product Listing with UNLIST (draft) status
		$add_payload = [
			'original_price' => $base_price,
			'description'    => $new_desc,
			'weight'         => $weight,
			'item_name'      => $new_title,
			'item_status'    => 'UNLIST', // Ensures item is saved as unlisted draft
			'seller_stock'   => $base_seller_stock,
			'category_id'    => (int) ( $src['category_id'] ?? 0 ),
			'image'          => [
				'image_id_list' => $image_ids,
			],
			'brand'          => $brand,
			'logistic_info'  => $logistic_info,
			'dimension'      => $dimension,
			'condition'      => 'NEW',
		];

		if ( ! empty( $src['attribute_list'] ) ) {
			$add_payload['attribute_list'] = $src['attribute_list'];
		}

		$create_res = self::call_shop_api( '/api/v2/product/add_item', 'POST', [], $add_payload );

		if ( ! $create_res['success'] || empty( $create_res['response']['item_id'] ) ) {
			$error_txt = $create_res['message'] ?? $create_res['error'] ?? 'Shopee add_item request failed.';
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'shopee_duplicate', 'add_item failed: ' . $error_txt, [
					'payload' => $add_payload,
					'res'     => $create_res,
				]);
			}
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $error_txt,
				'message' => $error_txt,
				'raw'     => $create_res['raw'] ?? null,
			], 400 );
		}

		$new_item_id = (int) $create_res['response']['item_id'];

		// 4. Initialize Tier Variations & Models if source product has them
		$models_initialized = 0;
		$variation_error = null;

		if ( ! empty( $source_tier_variation ) && ! empty( $source_models ) ) {
			// Wait 5 seconds for Shopee indexing before calling init_tier_variation
			sleep( 5 );

			$transformed_models = [];
			foreach ( $source_models as $m ) {
				$m_price = (float) ( $m['price_info'][0]['original_price'] ?? $base_price );
				if ( $m_price <= 0 ) {
					$m_price = $base_price;
				}

				$m_stock = (int) ( $m['stock_info_v2']['summary_info']['total_available_stock'] ?? 50 );
				if ( $m_stock <= 0 ) {
					$m_stock = 50;
				}

				$m_sku = (string) ( $m['model_sku'] ?? '' );
				if ( ! empty( $m_sku ) && ! empty( $source_device ) ) {
					$m_sku = str_ireplace( $source_device, $target_device, $m_sku );
				}

				$m_seller_stock = [];
				if ( ! empty( $m['stock_info_v2']['seller_stock'] ) && is_array( $m['stock_info_v2']['seller_stock'] ) ) {
					foreach ( $m['stock_info_v2']['seller_stock'] as $stk ) {
						$qty = (int) ( $stk['stock'] ?? 0 );
						if ( $qty <= 0 ) {
							$qty = $m_stock;
						}
						$entry = [ 'stock' => $qty ];
						if ( ! empty( $stk['location_id'] ) && $stk['location_id'] !== '-' ) {
							$entry['location_id'] = (string) $stk['location_id'];
						} elseif ( ! empty( $detected_location_id ) ) {
							$entry['location_id'] = $detected_location_id;
						}
						$m_seller_stock[] = $entry;
					}
				}

				if ( empty( $m_seller_stock ) ) {
					$entry = [ 'stock' => $m_stock ];
					if ( ! empty( $detected_location_id ) ) {
						$entry['location_id'] = $detected_location_id;
					}
					$m_seller_stock[] = $entry;
				}

				$transformed_models[] = [
					'tier_index'     => array_values( array_map( 'intval', (array) ( $m['tier_index'] ?? [ 0 ] ) ) ),
					'seller_stock'   => $m_seller_stock,
					'original_price' => $m_price,
					'model_sku'      => $m_sku,
				];
			}

			// Clean tier variation options with proper option_list key
			$clean_tier_variation = [];
			foreach ( $source_tier_variation as $tier_idx => $tv ) {
				$raw_opts = $tv['option_list'] ?? $tv['options'] ?? [];
				$opts = [];
				foreach ( $raw_opts as $opt_entry ) {
					$opt_name = is_array( $opt_entry ) ? ( $opt_entry['option'] ?? '' ) : (string) $opt_entry;
					if ( empty( $opt_name ) ) {
						continue;
					}
					$clean_opt = [
						'option' => (string) $opt_name,
					];
					// Variant images are only allowed on the first tier (index 0) in Shopee Open Platform
					if ( $tier_idx === 0 && ! empty( $opt_entry['image']['image_id'] ) ) {
						$clean_opt['image'] = [
							'image_id' => (string) $opt_entry['image']['image_id'],
						];
					}
					$opts[] = $clean_opt;
				}

				if ( ! empty( $opts ) ) {
					$clean_tier_variation[] = [
						'name'        => (string) ( $tv['name'] ?? 'Varian' ),
						'option_list' => $opts,
					];
				}
			}

			if ( ! empty( $clean_tier_variation ) && ! empty( $transformed_models ) ) {
				$init_res = self::call_shop_api( '/api/v2/product/init_tier_variation', 'POST', [], [
					'item_id'        => $new_item_id,
					'tier_variation' => $clean_tier_variation,
					'model'          => $transformed_models,
				]);

				if ( ! $init_res['success'] ) {
					// Retry once after 3 seconds in case Shopee data propagation was lagging
					sleep( 3 );
					$init_res = self::call_shop_api( '/api/v2/product/init_tier_variation', 'POST', [], [
						'item_id'        => $new_item_id,
						'tier_variation' => $clean_tier_variation,
						'model'          => $transformed_models,
					]);
				}

				if ( $init_res['success'] ) {
					$models_initialized = count( $transformed_models );
				} else {
					$variation_error = $init_res['message'] ?? $init_res['error'] ?? 'Variation initialization warning';
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log( 'error', 'shopee_duplicate', 'Failed to init tier variation on draft item', [
							'item_id' => $new_item_id,
							'res'     => $init_res,
						]);
					}
				}
			}
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				'info',
				'shopee_duplicate',
				sprintf( 'Successfully duplicated Shopee listing %s -> %s (Draft ID %d, Variations %d)', $source_device, $target_device, $new_item_id, $models_initialized )
			);
		}

		return new \WP_REST_Response([
			'success'            => true,
			'new_item_id'        => $new_item_id,
			'item_name'          => $new_title,
			'item_status'        => 'UNLIST',
			'status_label'       => 'Belum Ditampilkan (Draft)',
			'seller_centre_url'  => "https://seller.shopee.co.id/portal/product/{$new_item_id}",
			'models_initialized' => $models_initialized,
			'source_item_id'     => $source_item_id,
			'target_device'      => $target_device,
			'warning'            => $variation_error,
		], 200 );
	}

	/**
	 * REST Endpoint: Fetch Shopee product listings with base info and search
	 */
	public static function rest_get_products( \WP_REST_Request $request ): \WP_REST_Response {
		$offset = max( 0, (int) ( $request->get_param( 'offset' ) ?: 0 ) );
		$page_size = min( 100, max( 1, (int) ( $request->get_param( 'page_size' ) ?: 50 ) ) );
		$status_param = sanitize_text_field( (string) ( $request->get_param( 'item_status' ) ?: 'NORMAL' ) );
		$search = trim( sanitize_text_field( (string) ( $request->get_param( 'search' ) ?: '' ) ) );

		$item_ids = [];
		$total = 0;
		$has_next = false;
		$next_offset = $offset;

		// 1. Direct Shopee URL or Item ID Search
		$direct_id = self::parse_shopee_item_id( $search );
		if ( ! empty( $direct_id ) ) {
			$item_ids = [ $direct_id ];
			$total = 1;
			$has_next = false;
		} elseif ( ! empty( $search ) ) {
			// 2. Keyword Search
			// Search across UNLIST drafts and NORMAL live products unless explicitly filtered
			$statuses_to_search = ( $status_param === 'UNLIST' )
				? [ 'UNLIST' ]
				: ( $status_param === 'BANNED' ? [ 'BANNED' ] : [ 'UNLIST', 'NORMAL' ] );

			$search_clean = preg_replace( '/[\[\]\/\-\(\)\,\.]+/u', ' ', strtolower( $search ) );
			$search_tokens = array_values( array_filter( explode( ' ', $search_clean ), function( $t ) {
				return strlen( trim( $t ) ) > 1;
			} ) );

			// Try Shopee v2.product.search_item API first if searching live items
			if ( in_array( 'NORMAL', $statuses_to_search, true ) && ! empty( $search_tokens ) ) {
				$search_res = self::call_shop_api( '/api/v2/product/search_item', 'POST', [], [
					'item_name' => implode( ' ', array_slice( $search_tokens, 0, 5 ) ),
					'page_size' => $page_size,
					'offset'    => 0,
				] );
				if ( $search_res['success'] && ! empty( $search_res['response'] ) ) {
					$resp = $search_res['response'];
					$raw_found_ids = $resp['item_id_list'] ?? $resp['item_list'] ?? $resp['item'] ?? [];
					foreach ( (array) $raw_found_ids as $entry ) {
						if ( is_array( $entry ) && isset( $entry['item_id'] ) ) {
							$item_ids[] = (int) $entry['item_id'];
						} elseif ( is_numeric( $entry ) ) {
							$item_ids[] = (int) $entry;
						}
					}
				}
			}

			// Also fetch item IDs from get_item_list for UNLIST drafts (and NORMAL catalog if needed)
			$collected_ids = [];
			foreach ( $statuses_to_search as $st ) {
				$max_pages = ( $st === 'UNLIST' ) ? 2 : ( empty( $item_ids ) ? 4 : 1 );
				for ( $p = 0; $p < $max_pages; $p++ ) {
					$list_res = self::call_shop_api( '/api/v2/product/get_item_list', 'GET', [
						'offset'      => $p * 100,
						'page_size'   => 100,
						'item_status' => $st,
					] );
					if ( empty( $list_res['response']['item'] ) ) {
						break;
					}
					foreach ( $list_res['response']['item'] as $it ) {
						if ( ! empty( $it['item_id'] ) ) {
							$collected_ids[] = (int) $it['item_id'];
						}
					}
					if ( empty( $list_res['response']['has_next_page'] ) ) {
						break;
					}
				}
			}

			$combined_candidate_ids = array_values( array_unique( array_merge( $item_ids, $collected_ids ) ) );
			$matched_ids = [];

			if ( ! empty( $combined_candidate_ids ) ) {
				$chunks = array_chunk( $combined_candidate_ids, 50 );
				foreach ( $chunks as $chunk ) {
					$chunk_res = self::call_shop_api( '/api/v2/product/get_item_base_info', 'GET', [
						'item_id_list' => implode( ',', $chunk ),
					] );
					if ( ! empty( $chunk_res['response']['item_list'] ) ) {
						foreach ( $chunk_res['response']['item_list'] as $it ) {
							$name_lower = strtolower( (string) ( $it['item_name'] ?? '' ) );
							$matches = true;
							foreach ( $search_tokens as $token ) {
								if ( ! str_contains( $name_lower, $token ) ) {
									$matches = false;
									break;
								}
							}
							if ( $matches ) {
								$matched_ids[] = (int) $it['item_id'];
							}
						}
					}
				}
			}

			$item_ids = array_values( array_unique( $matched_ids ) );
			$total = count( $item_ids );
			$has_next = false;
		} else {
			// 3. Standard Item List
			if ( $status_param === 'ALL' ) {
				$raw_items = [];
				$total = 0;
				if ( $offset === 0 ) {
					$unlist_res = self::call_shop_api( '/api/v2/product/get_item_list', 'GET', [
						'offset'      => 0,
						'page_size'   => 50,
						'item_status' => 'UNLIST',
					] );
					if ( ! empty( $unlist_res['response']['item'] ) ) {
						$raw_items = array_merge( $raw_items, $unlist_res['response']['item'] );
						$total += (int) ( $unlist_res['response']['total_count'] ?? count( $unlist_res['response']['item'] ) );
					}
				}

				$normal_res = self::call_shop_api( '/api/v2/product/get_item_list', 'GET', [
					'offset'      => $offset,
					'page_size'   => $page_size,
					'item_status' => 'NORMAL',
				] );
				if ( ! empty( $normal_res['response']['item'] ) ) {
					$raw_items = array_merge( $raw_items, $normal_res['response']['item'] );
					$total += (int) ( $normal_res['response']['total_count'] ?? count( $normal_res['response']['item'] ) );
				}
				$has_next = (bool) ( $normal_res['response']['has_next_page'] ?? false );
				$next_offset = (int) ( $normal_res['response']['next_offset'] ?? ( $offset + count( $normal_res['response']['item'] ?? [] ) ) );

				$item_ids = array_values( array_filter( array_map( function( $it ) {
					return isset( $it['item_id'] ) ? (int) $it['item_id'] : 0;
				}, $raw_items ) ) );
			} else {
				$query_params = [
					'offset'      => $offset,
					'page_size'   => $page_size,
					'item_status' => $status_param,
				];

				$list_res = self::call_shop_api( '/api/v2/product/get_item_list', 'GET', $query_params );
				if ( ! $list_res['success'] ) {
					return new \WP_REST_Response([
						'success' => false,
						'error'   => $list_res['error'] ?? 'Failed to retrieve item list from Shopee.',
						'message' => $list_res['message'] ?? '',
						'items'   => [],
						'total'   => 0,
					], 400 );
				}

				$raw_items = $list_res['response']['item'] ?? [];
				$total = (int) ( $list_res['response']['total_count'] ?? count( $raw_items ) );
				$has_next = (bool) ( $list_res['response']['has_next_page'] ?? false );
				$next_offset = (int) ( $list_res['response']['next_offset'] ?? ( $offset + count( $raw_items ) ) );

				$item_ids = array_values( array_filter( array_map( function( $it ) {
					return isset( $it['item_id'] ) ? (int) $it['item_id'] : 0;
				}, $raw_items ) ) );
			}
		}

		if ( empty( $item_ids ) ) {
			return new \WP_REST_Response([
				'success'       => true,
				'items'         => [],
				'total'         => $total,
				'has_next_page' => false,
				'next_offset'   => $offset,
			], 200 );
		}

		// Fetch detailed base info
		$chunks = array_chunk( $item_ids, 50 );
		$detailed_items = [];
		$model_fetches = 0;

		foreach ( $chunks as $chunk ) {
			$base_res = self::call_shop_api( '/api/v2/product/get_item_base_info', 'GET', [
				'item_id_list' => implode( ',', $chunk ),
			]);

			if ( $base_res['success'] && ! empty( $base_res['response']['item_list'] ) ) {
				foreach ( $base_res['response']['item_list'] as $item ) {
					$item_id = (int) ( $item['item_id'] ?? 0 );
					$images = [];
					if ( ! empty( $item['image']['image_url_list'] ) && is_array( $item['image']['image_url_list'] ) ) {
						$images = $item['image']['image_url_list'];
					}

					// Resolve real model price if item has variants
					$original_price = (float) ( $item['price_info'][0]['original_price'] ?? 0 );
					$current_price  = (float) ( $item['price_info'][0]['current_price'] ?? 0 );
					$has_model      = ! empty( $item['has_model'] );

					if ( ( $original_price <= 0 || $current_price <= 0 ) && $has_model ) {
						$cache_key = '_shopee_price_' . $item_id;
						$cached = get_transient( $cache_key );
						if ( is_array( $cached ) && ! empty( $cached['original_price'] ) ) {
							$original_price = (float) $cached['original_price'];
							$current_price  = (float) $cached['current_price'];
						} elseif ( $model_fetches < 2 ) {
							$model_fetches++;
							$model_res = self::call_shop_api( '/api/v2/product/get_model_list', 'GET', [ 'item_id' => $item_id ] );
							if ( $model_res['success'] && ! empty( $model_res['response']['model'][0]['price_info'][0] ) ) {
								$first_model_price = $model_res['response']['model'][0]['price_info'][0];
								$original_price = (float) ( $first_model_price['original_price'] ?? 149000 );
								$current_price  = (float) ( $first_model_price['current_price'] ?? 149000 );
								set_transient( $cache_key, [
									'original_price' => $original_price,
									'current_price'  => $current_price,
								], 12 * HOUR_IN_SECONDS );
							} else {
								$original_price = 149000;
								$current_price  = 149000;
							}
						} else {
							$original_price = 149000;
							$current_price  = 149000;
						}
					}

					if ( $original_price <= 0 ) {
						$original_price = 149000;
					}
					if ( $current_price <= 0 ) {
						$current_price = $original_price;
					}

					$price_info_resolved = [
						[
							'currency'       => 'IDR',
							'original_price' => $original_price,
							'current_price'  => $current_price,
						]
					];

					$detailed_items[] = [
						'item_id'           => $item_id,
						'item_name'         => (string) ( $item['item_name'] ?? '' ),
						'item_status'       => (string) ( $item['item_status'] ?? 'NORMAL' ),
						'description'       => (string) ( $item['description'] ?? '' ),
						'has_model'         => $has_model,
						'price_info'        => $price_info_resolved,
						'stock_info_v2'     => $item['stock_info_v2'] ?? [],
						'image'             => $item['image'] ?? [ 'image_url_list' => $images ],
						'brand'             => $item['brand'] ?? [ 'brand_id' => 0, 'original_brand_name' => 'Exacoat' ],
						'category_id'       => (int) ( $item['category_id'] ?? 0 ),
						'create_time'       => (int) ( $item['create_time'] ?? 0 ),
						'update_time'       => (int) ( $item['update_time'] ?? 0 ),
						'seller_centre_url' => "https://seller.shopee.co.id/portal/product/{$item_id}",
					];
				}
			}
		}

		return new \WP_REST_Response([
			'success'       => true,
			'items'         => $detailed_items,
			'total'         => $total,
			'has_next_page' => $has_next,
			'next_offset'   => $next_offset,
		], 200 );
	}

	/**
	 * REST Endpoint: Set Shopee product status (NORMAL vs UNLIST)
	 */
	public static function rest_set_product_status( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params() ?: [];
		$item_id = (int) ( $body['item_id'] ?? 0 );
		$unlist = ! empty( $body['unlist'] ); // true = unlist (draft), false = normal (publish)

		if ( empty( $item_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid Shopee Item ID is required.',
			], 400 );
		}

		$payload = [
			'item_list' => [
				[
					'item_id' => $item_id,
					'unlist'  => $unlist,
				],
			],
		];

		$res = self::call_shop_api( '/api/v2/product/unlist_item', 'POST', [], $payload );
		if ( ! $res['success'] ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $res['error'] ?? 'Failed to update item status on Shopee.',
				'message' => $res['message'] ?? '',
			], 400 );
		}

		$new_status = $unlist ? 'UNLIST' : 'NORMAL';
		return new \WP_REST_Response([
			'success'     => true,
			'item_id'     => $item_id,
			'unlist'      => $unlist,
			'item_status' => $new_status,
			'message'     => $unlist ? 'Product moved to unlisted draft.' : 'Product published live.',
		], 200 );
	}

	/**
	 * REST Endpoint: Delete Shopee product
	 */
	public static function rest_delete_product( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params() ?: [];
		$item_id = (int) ( $body['item_id'] ?? 0 );

		if ( empty( $item_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid Shopee Item ID is required.',
			], 400 );
		}

		$payload = [
			'item_id' => $item_id,
		];

		$res = self::call_shop_api( '/api/v2/product/delete_item', 'POST', [], $payload );
		if ( ! $res['success'] ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => $res['error'] ?? 'Failed to delete product on Shopee.',
				'message' => $res['message'] ?? '',
			], 400 );
		}

		return new \WP_REST_Response([
			'success' => true,
			'item_id' => $item_id,
			'message' => 'Product listing removed successfully from Shopee.',
		], 200 );
	}

	/**
	 * REST Endpoint: Non-destructively inject cover image, variation pictures, new variant options, ordering, and prices into Shopee listing
	 */
	public static function rest_inject_product_images( \WP_REST_Request $request ): \WP_REST_Response {
		@set_time_limit( 180 );
		$body = $request->get_json_params() ?: [];

		$item_id        = (int) ( $body['item_id'] ?? 0 );
		$cover_image_id = trim( (string) ( $body['cover_image_id'] ?? '' ) );
		$new_item_name  = trim( sanitize_text_field( (string) ( $body['item_name'] ?? '' ) ) );
		$variant_images = (array) ( $body['variant_images'] ?? [] );
		$variant_plan   = (array) ( $body['variant_plan'] ?? [] );

		if ( empty( $item_id ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'A valid Shopee Item ID is required.',
			], 400 );
		}

		if ( empty( $cover_image_id ) && empty( $variant_images ) && empty( $variant_plan ) && empty( $new_item_name ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'At least one of cover_image_id, variant_images, variant_plan, or item_name must be provided.',
			], 400 );
		}

		$cover_updated           = false;
		$title_updated           = false;
		$gallery_preserved_count = 0;
		$variants_updated        = 0;
		$variants_added          = 0;
		$variants_reordered      = false;
		$prices_updated          = 0;
		$errors                  = [];

		// 1. Fetch current item info to read existing images and warehouse stock info non-destructively
		$base_res = self::call_shop_api( '/api/v2/product/get_item_base_info', 'GET', [
			'item_id_list' => (string) $item_id,
		]);

		if ( ! $base_res['success'] || empty( $base_res['response']['item_list'][0] ) ) {
			return new \WP_REST_Response([
				'success' => false,
				'error'   => 'Could not fetch current product info from Shopee API.',
				'message' => $base_res['message'] ?? '',
			], 400 );
		}

		$src                = $base_res['response']['item_list'][0];
		$existing_image_ids = $src['image']['image_id_list'] ?? [];
		$existing_title     = trim( (string) ( $src['item_name'] ?? '' ) );
		$title_changed      = ( $new_item_name !== '' && $new_item_name !== $existing_title );

		// 2. Non-destructively update primary cover image (index 0) and/or item title (item_name)
		if ( ! empty( $cover_image_id ) || $title_changed ) {
			$update_item_payload = [
				'item_id' => $item_id,
			];

			if ( ! empty( $cover_image_id ) ) {
				$new_image_ids = [ $cover_image_id ];

				// Preserve existing gallery images (skipping the old primary image at index 0)
				if ( is_array( $existing_image_ids ) ) {
					for ( $i = 1; $i < count( $existing_image_ids ); $i++ ) {
						$existing_id = (string) $existing_image_ids[ $i ];
						if ( ! empty( $existing_id ) && $existing_id !== $cover_image_id && ! in_array( $existing_id, $new_image_ids, true ) ) {
							$new_image_ids[] = $existing_id;
							$gallery_preserved_count++;
						}
					}
				}

				// Shopee allows maximum 9 images per product
				$new_image_ids = array_slice( $new_image_ids, 0, 9 );
				$update_item_payload['image'] = [
					'image_id_list' => $new_image_ids,
				];
			}

			if ( $title_changed ) {
				$update_item_payload['item_name'] = $new_item_name;
			}

			$update_item_res = self::call_shop_api( '/api/v2/product/update_item', 'POST', [], $update_item_payload );

			if ( $update_item_res['success'] ) {
				if ( ! empty( $cover_image_id ) ) {
					$cover_updated = true;
				}
				if ( $title_changed ) {
					$title_updated = true;
				}
			} else {
				$err_msg = $update_item_res['message'] ?? $update_item_res['error'] ?? 'Failed to update item details on Shopee.';
				$errors[] = 'Item update: ' . $err_msg;
				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'error', 'shopee_inject_images', 'update_item failed: ' . $err_msg, [
						'item_id' => $item_id,
						'payload' => $update_item_payload,
						'res'     => $update_item_res,
					]);
				}
			}
		}

		// 3. Update variation pictures, new variant options, ordering, and per-variant pricing
		if ( ! empty( $variant_images ) || ! empty( $variant_plan ) ) {
			$model_res = self::call_shop_api( '/api/v2/product/get_model_list', 'GET', [
				'item_id' => $item_id,
			]);

			if ( $model_res['success'] && ! empty( $model_res['response']['tier_variation'] ) ) {
				$tier_variations = $model_res['response']['tier_variation'];
				$existing_models = $model_res['response']['model'] ?? [];

				// Build lookup map for incoming variant images (case-insensitive trimmed)
				$var_map = [];
				foreach ( $variant_images as $vi ) {
					$opt_name = strtolower( trim( (string) ( $vi['option'] ?? '' ) ) );
					$img_id   = trim( (string) ( $vi['image_id'] ?? '' ) );
					if ( ! empty( $opt_name ) && ! empty( $img_id ) ) {
						$var_map[ $opt_name ] = $img_id;
					}
				}

				// Index existing tier 0 options by original index and by lowercase name
				$raw_tier0_opts       = $tier_variations[0]['option_list'] ?? $tier_variations[0]['options'] ?? [];
				$old_opts_by_index    = [];
				$old_opts_by_key      = [];
				$fallback_opt_img_id  = ! empty( $cover_image_id ) ? $cover_image_id : ( (string) ( $existing_image_ids[0] ?? '' ) );
				$tier0_uses_images    = ! empty( $var_map );

				foreach ( $raw_tier0_opts as $old_idx => $opt_entry ) {
					$opt_name = is_array( $opt_entry ) ? trim( (string) ( $opt_entry['option'] ?? '' ) ) : trim( (string) $opt_entry );
					$opt_img  = is_array( $opt_entry ) ? trim( (string) ( $opt_entry['image']['image_id'] ?? '' ) ) : '';
					if ( ! empty( $opt_img ) ) {
						$tier0_uses_images = true;
						if ( empty( $fallback_opt_img_id ) ) {
							$fallback_opt_img_id = $opt_img;
						}
					}
					$old_opts_by_index[ (int) $old_idx ] = [
						'option'   => $opt_name,
						'image_id' => $opt_img,
						'old_idx'  => (int) $old_idx,
					];
					if ( ! empty( $opt_name ) ) {
						$old_opts_by_key[ strtolower( $opt_name ) ] = [
							'option'   => $opt_name,
							'image_id' => $opt_img,
							'old_idx'  => (int) $old_idx,
						];
					}
				}

				$old_to_new_index_map = [];
				$desired_prices_by_new_idx = [];
				$updated_tier_variation = [];
				$structure_changed = false;

				if ( ! empty( $variant_plan ) ) {
					$new_tier0_opts = [];
					foreach ( array_values( $variant_plan ) as $new_idx => $plan_item ) {
						$opt_name = trim( (string) ( $plan_item['option'] ?? '' ) );
						if ( empty( $opt_name ) ) {
							continue;
						}
						$lookup_key = strtolower( $opt_name );
						$plan_img   = trim( (string) ( $plan_item['image_id'] ?? '' ) );
						$plan_price = (float) ( $plan_item['price'] ?? 0 );

						// Match against existing option
						$matched_old = null;
						if ( isset( $plan_item['old_index'] ) && is_numeric( $plan_item['old_index'] ) ) {
							$cand_old_idx = (int) $plan_item['old_index'];
							if ( isset( $old_opts_by_index[ $cand_old_idx ] ) && strtolower( $old_opts_by_index[ $cand_old_idx ]['option'] ) === $lookup_key ) {
								$matched_old = $old_opts_by_index[ $cand_old_idx ];
							}
						}
						if ( ! $matched_old && isset( $old_opts_by_key[ $lookup_key ] ) ) {
							$matched_old = $old_opts_by_key[ $lookup_key ];
						}

						if ( $matched_old ) {
							$old_idx = (int) $matched_old['old_idx'];
							$old_to_new_index_map[ $old_idx ] = $new_idx;
							if ( $old_idx !== $new_idx ) {
								$structure_changed  = true;
								$variants_reordered = true;
							}
						} else {
							$structure_changed = true;
						}

						$resolved_img_id = '';
						if ( isset( $var_map[ $lookup_key ] ) ) {
							$resolved_img_id = $var_map[ $lookup_key ];
							$variants_updated++;
						} elseif ( ! empty( $plan_img ) ) {
							$resolved_img_id = $plan_img;
							if ( ! $matched_old || $plan_img !== $matched_old['image_id'] ) {
								$variants_updated++;
							}
						} elseif ( $matched_old && ! empty( $matched_old['image_id'] ) ) {
							$resolved_img_id = $matched_old['image_id'];
						} elseif ( $tier0_uses_images && ! empty( $fallback_opt_img_id ) ) {
							$resolved_img_id = $fallback_opt_img_id;
						}

						$clean_opt = [
							'option' => $opt_name,
						];
						if ( ! empty( $resolved_img_id ) ) {
							$clean_opt['image'] = [
								'image_id' => $resolved_img_id,
							];
						}

						$new_tier0_opts[] = $clean_opt;
						if ( $plan_price > 0 ) {
							$desired_prices_by_new_idx[ $new_idx ] = $plan_price;
						}
					}

					if ( count( $new_tier0_opts ) !== count( $old_opts_by_index ) ) {
						$structure_changed = true;
					}

					if ( ! empty( $new_tier0_opts ) ) {
						$updated_tier_variation[] = [
							'name'        => (string) ( $tier_variations[0]['name'] ?? 'Warna' ),
							'option_list' => $new_tier0_opts,
						];
					}

					// Preserve any secondary tiers (tier_idx >= 1)
					for ( $t_idx = 1; $t_idx < count( $tier_variations ); $t_idx++ ) {
						$tv       = $tier_variations[ $t_idx ];
						$raw_opts = $tv['option_list'] ?? $tv['options'] ?? [];
						$opts     = [];
						foreach ( $raw_opts as $opt_entry ) {
							$o_name = is_array( $opt_entry ) ? ( $opt_entry['option'] ?? '' ) : (string) $opt_entry;
							if ( ! empty( $o_name ) ) {
								$opts[] = [ 'option' => (string) $o_name ];
							}
						}
						if ( ! empty( $opts ) ) {
							$updated_tier_variation[] = [
								'name'        => (string) ( $tv['name'] ?? 'Varian' ),
								'option_list' => $opts,
							];
						}
					}
				} else {
					// Legacy path: only variant_images provided without variant_plan
					foreach ( $tier_variations as $tier_idx => $tv ) {
						$raw_opts = $tv['option_list'] ?? $tv['options'] ?? [];
						$opts     = [];
						foreach ( $raw_opts as $opt_Idx => $opt_entry ) {
							$opt_name = is_array( $opt_entry ) ? ( $opt_entry['option'] ?? '' ) : (string) $opt_entry;
							if ( empty( $opt_name ) ) {
								continue;
							}
							$clean_opt = [
								'option' => (string) $opt_name,
							];
							if ( $tier_idx === 0 ) {
								$old_to_new_index_map[ (int) $opt_Idx ] = (int) $opt_Idx;
								$lookup_key = strtolower( trim( $opt_name ) );
								if ( isset( $var_map[ $lookup_key ] ) ) {
									$clean_opt['image'] = [
										'image_id' => $var_map[ $lookup_key ],
									];
									$variants_updated++;
								} elseif ( ! empty( $opt_entry['image']['image_id'] ) ) {
									$clean_opt['image'] = [
										'image_id' => (string) $opt_entry['image']['image_id'],
									];
								}
							}
							$opts[] = $clean_opt;
						}
						if ( ! empty( $opts ) ) {
							$updated_tier_variation[] = [
								'name'        => (string) ( $tv['name'] ?? 'Varian' ),
								'option_list' => $opts,
							];
						}
					}
				}

				// 3a. Call update_tier_variation when images, option order, or option count changed
				if ( ! empty( $updated_tier_variation ) && ( $variants_updated > 0 || $structure_changed ) ) {
					$remap_model_list = [];
					foreach ( $existing_models as $em ) {
						$em_id   = (int) ( $em['model_id'] ?? 0 );
						$em_tier = array_values( array_map( 'intval', (array) ( $em['tier_index'] ?? [] ) ) );
						if ( $em_id > 0 && ! empty( $em_tier ) ) {
							$old_t0 = $em_tier[0];
							if ( isset( $old_to_new_index_map[ $old_t0 ] ) ) {
								$em_tier[0]         = $old_to_new_index_map[ $old_t0 ];
								$remap_model_list[] = [
									'model_id'   => $em_id,
									'tier_index' => $em_tier,
								];
							}
						}
					}

					$utv_payload = [
						'item_id'        => $item_id,
						'tier_variation' => $updated_tier_variation,
					];
					if ( $structure_changed && ! empty( $remap_model_list ) ) {
						$utv_payload['model_list'] = $remap_model_list;
					}

					$update_var_res = self::call_shop_api( '/api/v2/product/update_tier_variation', 'POST', [], $utv_payload );

					if ( ! $update_var_res['success'] ) {
						sleep( 2 );
						$update_var_res = self::call_shop_api( '/api/v2/product/update_tier_variation', 'POST', [], $utv_payload );
					}

					// Fallback: if Shopee rejected model_list or required model_list, try the alternate payload
					if ( ! $update_var_res['success'] ) {
						$alt_payload = [
							'item_id'        => $item_id,
							'tier_variation' => $updated_tier_variation,
						];
						if ( empty( $utv_payload['model_list'] ) && ! empty( $remap_model_list ) ) {
							$alt_payload['model_list'] = $remap_model_list;
						}
						$update_var_res = self::call_shop_api( '/api/v2/product/update_tier_variation', 'POST', [], $alt_payload );
					}

					if ( ! $update_var_res['success'] ) {
						$err_msg  = $update_var_res['message'] ?? $update_var_res['error'] ?? 'Failed to update tier variation.';
						$errors[] = 'Variation update: ' . $err_msg;
						if ( class_exists( 'Exacoat_Logger' ) ) {
							Exacoat_Logger::log( 'error', 'shopee_inject_images', 'update_tier_variation failed: ' . $err_msg, [
								'item_id' => $item_id,
								'res'     => $update_var_res,
							]);
						}
					}
				}

				// 3b. Re-fetch live models to detect any newly added tier options without a model, and sync prices
				if ( ! empty( $variant_plan ) ) {
					if ( $structure_changed ) {
						sleep( 1 );
					}
					$post_model_res = self::call_shop_api( '/api/v2/product/get_model_list', 'GET', [
						'item_id' => $item_id,
					]);
					$live_models = ( $post_model_res['success'] && ! empty( $post_model_res['response']['model'] ) )
						? $post_model_res['response']['model']
						: $existing_models;

					$covered_t0_indices = [];
					$default_model_price = 189000;
					foreach ( $live_models as $lm ) {
						$lm_tier = array_values( array_map( 'intval', (array) ( $lm['tier_index'] ?? [] ) ) );
						if ( isset( $lm_tier[0] ) ) {
							$covered_t0_indices[ $lm_tier[0] ] = true;
						}
						$lm_price = (float) ( $lm['price_info'][0]['original_price'] ?? 0 );
						if ( $lm_price > 0 ) {
							$default_model_price = $lm_price;
						}
					}

					$total_new_tier0_count = ! empty( $updated_tier_variation[0]['option_list'] )
						? count( $updated_tier_variation[0]['option_list'] )
						: 0;

					$missing_t0_indices = [];
					for ( $idx = 0; $idx < $total_new_tier0_count; $idx++ ) {
						if ( empty( $covered_t0_indices[ $idx ] ) ) {
							$missing_t0_indices[] = $idx;
						}
					}

					// Create models for newly added variant options with fixed initial stock = 100
					if ( ! empty( $missing_t0_indices ) ) {
						// Resolve warehouse location_id
						$detected_location_id = '';
						if ( ! empty( $src['stock_info_v2']['seller_stock'] ) && is_array( $src['stock_info_v2']['seller_stock'] ) ) {
							foreach ( $src['stock_info_v2']['seller_stock'] as $ss ) {
								if ( ! empty( $ss['location_id'] ) && $ss['location_id'] !== '-' ) {
									$detected_location_id = (string) $ss['location_id'];
									break;
								}
							}
						}
						if ( empty( $detected_location_id ) && ! empty( $live_models ) ) {
							foreach ( $live_models as $sm ) {
								if ( ! empty( $sm['stock_info_v2']['seller_stock'] ) && is_array( $sm['stock_info_v2']['seller_stock'] ) ) {
									foreach ( $sm['stock_info_v2']['seller_stock'] as $ss ) {
										if ( ! empty( $ss['location_id'] ) && $ss['location_id'] !== '-' ) {
											$detected_location_id = (string) $ss['location_id'];
											break 2;
										}
									}
								}
							}
						}
						if ( empty( $detected_location_id ) ) {
							$wh_res = self::call_shop_api( '/api/v2/shop/get_warehouse_detail', 'GET' );
							if ( ! empty( $wh_res['response'] ) ) {
								$wh_data       = $wh_res['response'];
								$wh_candidates = $wh_data['warehouse_list'] ?? $wh_data['warehouse_detail_list'] ?? ( isset( $wh_data[0] ) ? $wh_data : [] );
								foreach ( (array) $wh_candidates as $wh ) {
									if ( ! empty( $wh['location_id'] ) && $wh['location_id'] !== '-' ) {
										$detected_location_id = (string) $wh['location_id'];
										break;
									}
								}
							}
						}

						$seller_stock_entry = [ 'stock' => 100 ];
						if ( ! empty( $detected_location_id ) ) {
							$seller_stock_entry['location_id'] = $detected_location_id;
						}

						$models_to_add = [];
						foreach ( $missing_t0_indices as $m_idx ) {
							$m_price = $desired_prices_by_new_idx[ $m_idx ] ?? $default_model_price;
							if ( $m_price <= 0 ) {
								$m_price = $default_model_price;
							}
							$models_to_add[] = [
								'tier_index'     => [ (int) $m_idx ],
								'original_price' => (float) $m_price,
								'seller_stock'   => [ $seller_stock_entry ],
							];
						}

						$add_model_res = self::call_shop_api( '/api/v2/product/add_model', 'POST', [], [
							'item_id'    => $item_id,
							'model_list' => $models_to_add,
						]);

						if ( ! $add_model_res['success'] ) {
							sleep( 2 );
							$add_model_res = self::call_shop_api( '/api/v2/product/add_model', 'POST', [], [
								'item_id'    => $item_id,
								'model_list' => $models_to_add,
							]);
						}

						if ( $add_model_res['success'] ) {
							$variants_added = count( $models_to_add );
							// Refresh live models after adding new models
							$refresh_models_res = self::call_shop_api( '/api/v2/product/get_model_list', 'GET', [
								'item_id' => $item_id,
							]);
							if ( $refresh_models_res['success'] && ! empty( $refresh_models_res['response']['model'] ) ) {
								$live_models = $refresh_models_res['response']['model'];
							}
						} else {
							$err_msg  = $add_model_res['message'] ?? $add_model_res['error'] ?? 'Failed to create models for new variants.';
							$errors[] = 'Add new variant models: ' . $err_msg;
							if ( class_exists( 'Exacoat_Logger' ) ) {
								Exacoat_Logger::log( 'error', 'shopee_inject_images', 'add_model failed: ' . $err_msg, [
									'item_id'       => $item_id,
									'models_to_add' => $models_to_add,
									'res'           => $add_model_res,
								]);
							}
						}
					}

					// 3c. Sync per-variant prices for any model whose desired price differs from live price
					if ( ! empty( $desired_prices_by_new_idx ) && ! empty( $live_models ) ) {
						$price_list_to_update = [];
						foreach ( $live_models as $lm ) {
							$lm_id   = (int) ( $lm['model_id'] ?? 0 );
							$lm_tier = array_values( array_map( 'intval', (array) ( $lm['tier_index'] ?? [] ) ) );
							if ( $lm_id <= 0 || ! isset( $lm_tier[0] ) ) {
								continue;
							}
							$t0_idx = $lm_tier[0];
							if ( ! isset( $desired_prices_by_new_idx[ $t0_idx ] ) ) {
								continue;
							}
							$target_price  = (float) $desired_prices_by_new_idx[ $t0_idx ];
							$current_price = (float) ( $lm['price_info'][0]['original_price'] ?? 0 );
							if ( $target_price > 0 && abs( $current_price - $target_price ) >= 1 ) {
								$price_list_to_update[] = [
									'model_id'       => $lm_id,
									'original_price' => $target_price,
								];
							}
						}

						if ( ! empty( $price_list_to_update ) ) {
							$price_chunks = array_chunk( $price_list_to_update, 50 );
							foreach ( $price_chunks as $p_chunk ) {
								$price_res = self::call_shop_api( '/api/v2/product/update_price', 'POST', [], [
									'item_id'    => $item_id,
									'price_list' => $p_chunk,
								]);
								if ( $price_res['success'] ) {
									$prices_updated += count( $p_chunk );
								} else {
									$err_msg  = $price_res['message'] ?? $price_res['error'] ?? 'Failed to update variant prices.';
									$errors[] = 'Price update: ' . $err_msg;
									if ( class_exists( 'Exacoat_Logger' ) ) {
										Exacoat_Logger::log( 'error', 'shopee_inject_images', 'update_price failed: ' . $err_msg, [
											'item_id'    => $item_id,
											'price_list' => $p_chunk,
											'res'        => $price_res,
										]);
									}
								}
							}
							delete_transient( '_shopee_price_' . $item_id );
						}
					}
				}
			} else {
				$errors[] = 'No tier variations found on listing to update.';
			}
		}

		$all_success = empty( $errors );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log(
				$all_success ? 'info' : 'warning',
				'shopee_inject_images',
				sprintf(
					'Image & variant injection on Shopee #%d: cover=%s, gallery_kept=%d, var_imgs=%d, var_added=%d, reordered=%s, prices_updated=%d, errors=%s',
					$item_id,
					$cover_updated ? 'yes' : 'no',
					$gallery_preserved_count,
					$variants_updated,
					$variants_added,
					$variants_reordered ? 'yes' : 'no',
					$prices_updated,
					! empty( $errors ) ? implode( '; ', $errors ) : 'none'
				)
			);
		}

		$summary_parts = [];
		if ( $cover_updated ) {
			$summary_parts[] = sprintf( 'cover updated (%d gallery images preserved)', $gallery_preserved_count );
		}
		if ( $variants_updated > 0 ) {
			$summary_parts[] = sprintf( '%d variant photos injected', $variants_updated );
		}
		if ( $variants_added > 0 ) {
			$summary_parts[] = sprintf( '%d new variants created (stock 100)', $variants_added );
		}
		if ( $title_updated ) {
			$summary_parts[] = 'title updated';
		}
		if ( $variants_reordered ) {
			$summary_parts[] = 'variant order updated';
		}
		if ( $prices_updated > 0 ) {
			$summary_parts[] = sprintf( '%d variant prices updated', $prices_updated );
		}

		return new \WP_REST_Response([
			'success'                 => $all_success || $cover_updated || $title_updated || $variants_updated > 0 || $variants_added > 0 || $prices_updated > 0 || $variants_reordered,
			'item_id'                 => $item_id,
			'cover_updated'           => $cover_updated,
			'title_updated'           => $title_updated,
			'item_name'               => $title_updated ? $new_item_name : ( $src['item_name'] ?? '' ),
			'gallery_preserved_count' => $gallery_preserved_count,
			'variants_updated'        => $variants_updated,
			'variants_added'          => $variants_added,
			'variants_reordered'      => $variants_reordered,
			'prices_updated'          => $prices_updated,
			'seller_centre_url'       => "https://seller.shopee.co.id/portal/product/{$item_id}",
			'errors'                  => $errors,
			'message'                 => $all_success
				? ( ! empty( $summary_parts ) ? 'Successfully updated Shopee listing: ' . implode( ', ', $summary_parts ) . '.' : 'Shopee listing is up to date.' )
				: implode( '; ', $errors ),
		], $all_success ? 200 : 207 );
	}
}

}


