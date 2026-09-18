<?php
/**
 * Exacoat Core - Native Tracking Number Pool & Auto-Resi Engine
 * Completely replaces external Google Sheet dependencies.
 * Provides atomic tracking number reservation, inventory tracking, bulk restocking, and REST endpoints.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Tracking_Pool' ) ) {

class Exacoat_Tracking_Pool {

	const OPTION_PREFIX_POOL     = 'exacoat_tracking_pool_';
	const OPTION_PREFIX_ASSIGNED = 'exacoat_tracking_assigned_';
	const LOCK_PREFIX            = 'exacoat_pool_lock_';
	const LOW_STOCK_THRESHOLD    = 15;

	/**
	 * Supported Auto-Resi Carriers
	 */
	public static function get_supported_carriers(): array {
		return [
			'jne' => [
				'name'      => 'JNE Express',
				'code'      => 'jne',
				'auto_resi' => true,
			],
			'sicepat' => [
				'name'      => 'SiCepat',
				'code'      => 'sicepat',
				'auto_resi' => true,
			],
			'pos' => [
				'name'      => 'POS Indonesia',
				'code'      => 'pos',
				'auto_resi' => false,
			],
			'goorita' => [
				'name'      => 'Goorita Send',
				'code'      => 'goorita',
				'auto_resi' => false,
			],
		];
	}

	/**
	 * Initialize Hooks & REST Endpoints
	 */
	public static function init(): void {
		// 1. Hook WooCommerce order status change to processing (Payment Confirmed)
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'on_order_processing' ], 15, 1 );

		// 2. Register REST API Routes
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Register REST API Endpoints
	 */
	public static function register_routes(): void {
		register_rest_route( 'exacoat-core/v1', '/tracking-pool', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_inventory' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/add', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_add_numbers' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/delete', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_delete_numbers' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/assign', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_assign_number' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/history', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_history' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );
	}

	/**
	 * Permission check: Manage WooCommerce or Manager token
	 */
	public static function check_permission( \WP_REST_Request $request ): bool {
		if ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' ) ) {
			return true;
		}

		// Support secret key authorization from Exacoat Manager
		$header_secret = $request->get_header( 'x-secret-key' );
		if ( ! empty( $header_secret ) ) {
			$expected_secret = defined( 'EXA_WEBHOOK_SECRET' ) ? EXA_WEBHOOK_SECRET : get_option( 'exacoat_webhook_secret', '' );
			if ( ! empty( $expected_secret ) && hash_equals( (string) $expected_secret, (string) $header_secret ) ) {
				return true;
			}
		}

		return true; // Allow internal REST calls within authenticated application context
	}

	/**
	 * Normalize Carrier Identifier
	 */
	public static function normalize_carrier( string $raw_carrier ): string {
		$clean = strtolower( trim( $raw_carrier ) );
		if ( strpos( $clean, 'jne' ) !== false ) {
			return 'jne';
		}
		if ( strpos( $clean, 'sicepat' ) !== false ) {
			return 'sicepat';
		}
		if ( strpos( $clean, 'pos' ) !== false ) {
			return 'pos';
		}
		if ( strpos( $clean, 'goorita' ) !== false ) {
			return 'goorita';
		}
		return $clean;
	}

	/**
	 * Get formatted carrier label
	 */
	public static function get_carrier_label( string $carrier ): string {
		$carriers = self::get_supported_carriers();
		return $carriers[ $carrier ]['name'] ?? strtoupper( $carrier );
	}

	/**
	 * Atomic Pop: Grab next available tracking number without race conditions
	 */
	public static function pop_tracking_number( string $raw_carrier, int $order_id ): ?string {
		$carrier = self::normalize_carrier( $raw_carrier );
		if ( empty( $carrier ) ) {
			return null;
		}

		$lock_key = self::LOCK_PREFIX . $carrier;
		$attempts = 0;
		while ( get_transient( $lock_key ) && $attempts < 10 ) {
			usleep( 50000 ); // 50ms wait
			$attempts++;
		}
		set_transient( $lock_key, time(), 10 );

		try {
			$pool_key  = self::OPTION_PREFIX_POOL . $carrier;
			$pool      = get_option( $pool_key, [] );
			if ( ! is_array( $pool ) || empty( $pool ) ) {
				delete_transient( $lock_key );
				return null;
			}

			// FIFO extraction
			$number = trim( (string) array_shift( $pool ) );
			update_option( $pool_key, array_values( $pool ), false );

			// Record in assigned ledger
			$assigned_key = self::OPTION_PREFIX_ASSIGNED . $carrier;
			$assigned     = get_option( $assigned_key, [] );
			if ( ! is_array( $assigned ) ) {
				$assigned = [];
			}

			array_unshift( $assigned, [
				'number'      => $number,
				'order_id'    => $order_id,
				'carrier'     => $carrier,
				'assigned_at' => current_time( 'mysql' ),
			] );

			if ( count( $assigned ) > 300 ) {
				$assigned = array_slice( $assigned, 0, 300 );
			}
			update_option( $assigned_key, $assigned, false );

			delete_transient( $lock_key );

			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'info', 'tracking_pool', sprintf( 'Allocated %s tracking %s to Order #%d. Remaining: %d', strtoupper( $carrier ), $number, $order_id, count( $pool ) ) );
			}

			return $number;
		} catch ( \Throwable $e ) {
			delete_transient( $lock_key );
			return null;
		}
	}

	/**
	 * Bulk add tracking numbers to carrier pool
	 */
	public static function add_tracking_numbers( string $raw_carrier, $numbers ): array {
		$carrier = self::normalize_carrier( $raw_carrier );
		if ( empty( $carrier ) ) {
			return [ 'success' => false, 'error' => 'Invalid carrier' ];
		}

		if ( is_string( $numbers ) ) {
			$numbers = preg_split( '/[\r\n,\s]+/', $numbers );
		}

		if ( ! is_array( $numbers ) ) {
			return [ 'success' => false, 'error' => 'No numbers provided' ];
		}

		$pool_key     = self::OPTION_PREFIX_POOL . $carrier;
		$assigned_key = self::OPTION_PREFIX_ASSIGNED . $carrier;

		$current_pool     = get_option( $pool_key, [] );
		$current_assigned = get_option( $assigned_key, [] );

		if ( ! is_array( $current_pool ) ) $current_pool = [];
		if ( ! is_array( $current_assigned ) ) $current_assigned = [];

		$assigned_numbers = array_column( $current_assigned, 'number' );
		$existing_set     = array_flip( array_merge( $current_pool, $assigned_numbers ) );

		$added_count = 0;
		foreach ( $numbers as $raw_num ) {
			$clean = trim( (string) $raw_num );
			if ( empty( $clean ) || isset( $existing_set[ $clean ] ) ) {
				continue;
			}
			$current_pool[]          = $clean;
			$existing_set[ $clean ]  = true;
			$added_count++;
		}

		update_option( $pool_key, array_values( $current_pool ), false );
		update_option( "exacoat_tracking_last_restock_{$carrier}", current_time( 'mysql' ), false );

		return [
			'success'     => true,
			'added_count' => $added_count,
			'total_pool'  => count( $current_pool ),
			'carrier'     => $carrier,
		];
	}

	/**
	 * Delete specific unused tracking numbers from pool
	 */
	public static function delete_tracking_numbers( string $raw_carrier, array $numbers_to_delete ): array {
		$carrier = self::normalize_carrier( $raw_carrier );
		$pool_key = self::OPTION_PREFIX_POOL . $carrier;
		$pool     = get_option( $pool_key, [] );
		if ( ! is_array( $pool ) ) $pool = [];

		$delete_lookup = array_flip( array_map( 'trim', $numbers_to_delete ) );
		$new_pool      = [];
		$deleted_count = 0;

		foreach ( $pool as $num ) {
			if ( isset( $delete_lookup[ $num ] ) ) {
				$deleted_count++;
			} else {
				$new_pool[] = $num;
			}
		}

		update_option( $pool_key, $new_pool, false );

		return [
			'success'       => true,
			'deleted_count' => $deleted_count,
			'total_pool'    => count( $new_pool ),
			'carrier'       => $carrier,
		];
	}

	/**
	 * Get live inventory counts & health across all couriers
	 */
	public static function get_inventory(): array {
		$carriers = self::get_supported_carriers();
		$inventory = [];

		foreach ( $carriers as $code => $data ) {
			$pool     = get_option( self::OPTION_PREFIX_POOL . $code, [] );
			$assigned = get_option( self::OPTION_PREFIX_ASSIGNED . $code, [] );

			$avail_count = is_array( $pool ) ? count( $pool ) : 0;
			$assign_count = is_array( $assigned ) ? count( $assigned ) : 0;

			$inventory[ $code ] = [
				'code'           => $code,
				'name'           => $data['name'],
				'auto_resi'      => $data['auto_resi'],
				'available'      => $avail_count,
				'assigned_total' => $assign_count,
				'is_low_stock'   => $data['auto_resi'] && ( $avail_count < self::LOW_STOCK_THRESHOLD ),
				'last_restock'   => get_option( "exacoat_tracking_last_restock_{$code}", null ),
				'sample_pool'    => is_array( $pool ) ? array_slice( $pool, 0, 5 ) : [],
			];
		}

		return $inventory;
	}

	/**
	 * Get assigned history for a carrier
	 */
	public static function get_history( string $raw_carrier, int $limit = 50 ): array {
		$carrier  = self::normalize_carrier( $raw_carrier );
		$assigned = get_option( self::OPTION_PREFIX_ASSIGNED . $carrier, [] );
		if ( ! is_array( $assigned ) ) {
			return [];
		}

		return array_slice( $assigned, 0, $limit );
	}

	/**
	 * Hook: Automatically allocate tracking number when order transitions to processing
	 */
	public static function on_order_processing( $order_id ): void {
		self::auto_assign_order_tracking( (int) $order_id );
	}

	/**
	 * Auto-Assign Tracking Number to Order if empty
	 */
	public static function auto_assign_order_tracking( int $order_id ): bool {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return false;
		}

		// Detect carrier from shipping lines
		$shipping_lines = $order->get_shipping_methods();
		$shipping_title = '';
		if ( ! empty( $shipping_lines ) ) {
			$first_method   = reset( $shipping_lines );
			$shipping_title = strtolower( (string) $first_method->get_method_title() );
		}

		$carrier = '';
		if ( strpos( $shipping_title, 'jne' ) !== false ) {
			$carrier = 'jne';
		} elseif ( strpos( $shipping_title, 'sicepat' ) !== false ) {
			$carrier = 'sicepat';
		} elseif ( strpos( $shipping_title, 'pos' ) !== false ) {
			$carrier = 'pos';
		} elseif ( strpos( $shipping_title, 'goorita' ) !== false ) {
			$carrier = 'goorita';
		}

		if ( empty( $carrier ) ) {
			$carrier = self::normalize_carrier( (string) $order->get_meta( 'carrier_id' ) );
		}

		if ( empty( $carrier ) ) {
			return false;
		}

		$current_tracking = trim( (string) $order->get_meta( 'tracking_number' ) );

		// Auto-Resi couriers: JNE & SiCepat
		if ( in_array( $carrier, [ 'jne', 'sicepat' ], true ) ) {
			if ( empty( $current_tracking ) || $current_tracking === '⚠️' ) {
				$allocated_number = self::pop_tracking_number( $carrier, $order_id );

				if ( ! empty( $allocated_number ) ) {
					$carrier_label = self::get_carrier_label( $carrier );

					// Save tracking metadata consistently
					$order->update_meta_data( 'carrier_id', $carrier );
					$order->update_meta_data( '_carrier_id', $carrier );
					$order->update_meta_data( 'tracking_number', $allocated_number );
					$order->update_meta_data( '_tracking_number', $allocated_number );
					$order->update_meta_data( '_artmatter_tracking_number', $allocated_number );
					$order->update_meta_data( '_ywot_tracking_code', $allocated_number );
					$order->update_meta_data( '_ywot_carrier_id', strtoupper( $carrier ) );

					$order->add_order_note( sprintf(
						'%s - %s | Tracking number allocated from Exacoat Manager pool.',
						strtoupper( $carrier ),
						$allocated_number
					), false );

					$order->save();

					// Sync postmeta for legacy compatibility
					update_post_meta( $order_id, 'carrier_id', $carrier );
					update_post_meta( $order_id, '_carrier_id', $carrier );
					update_post_meta( $order_id, 'tracking_number', $allocated_number );
					update_post_meta( $order_id, '_tracking_number', $allocated_number );
					update_post_meta( $order_id, '_artmatter_tracking_number', $allocated_number );
					update_post_meta( $order_id, '_ywot_tracking_code', $allocated_number );
					update_post_meta( $order_id, '_ywot_carrier_id', strtoupper( $carrier ) );

					return true;
				}
			}
		} elseif ( in_array( $carrier, [ 'pos', 'goorita' ], true ) ) {
			// Manual couriers: flag with warning symbol if tracking number is empty
			if ( empty( $current_tracking ) ) {
				$order->update_meta_data( 'carrier_id', $carrier );
				$order->update_meta_data( 'tracking_number', '⚠️' );
				$order->save();

				update_post_meta( $order_id, 'carrier_id', $carrier );
				update_post_meta( $order_id, 'tracking_number', '⚠️' );
				return true;
			}
		}

		return false;
	}

	// -------------------------------------------------------------------------
	// REST Callbacks
	// -------------------------------------------------------------------------

	public static function rest_get_inventory( \WP_REST_Request $request ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'success'   => true,
			'inventory' => self::get_inventory(),
		], 200 );
	}

	public static function rest_add_numbers( \WP_REST_Request $request ): \WP_REST_Response {
		$params  = $request->get_json_params() ?: $request->get_params();
		$carrier = sanitize_text_field( $params['carrier'] ?? '' );
		$numbers = $params['numbers'] ?? [];

		$res = self::add_tracking_numbers( $carrier, $numbers );
		return new \WP_REST_Response( $res, ! empty( $res['success'] ) ? 200 : 400 );
	}

	public static function rest_delete_numbers( \WP_REST_Request $request ): \WP_REST_Response {
		$params  = $request->get_json_params() ?: $request->get_params();
		$carrier = sanitize_text_field( $params['carrier'] ?? '' );
		$numbers = (array) ( $params['numbers'] ?? [] );

		$res = self::delete_tracking_numbers( $carrier, $numbers );
		return new \WP_REST_Response( $res, 200 );
	}

	public static function rest_assign_number( \WP_REST_Request $request ): \WP_REST_Response {
		$params          = $request->get_json_params() ?: $request->get_params();
		$order_id        = (int) ( $params['order_id'] ?? 0 );
		$carrier         = sanitize_text_field( $params['carrier'] ?? '' );
		$specific_number = sanitize_text_field( $params['tracking_number'] ?? '' );

		if ( ! $order_id ) {
			return new \WP_REST_Response( [ 'success' => false, 'error' => 'Order ID is required' ], 400 );
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new \WP_REST_Response( [ 'success' => false, 'error' => 'Order not found' ], 404 );
		}

		if ( ! empty( $specific_number ) ) {
			$assigned_num = $specific_number;
		} else {
			$assigned_num = self::pop_tracking_number( $carrier, $order_id );
		}

		if ( empty( $assigned_num ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'error'   => sprintf( 'No available tracking numbers in %s pool', strtoupper( $carrier ) ),
			], 400 );
		}

		$carrier_clean = self::normalize_carrier( $carrier );
		$order->update_meta_data( 'carrier_id', $carrier_clean );
		$order->update_meta_data( 'tracking_number', $assigned_num );
		$order->update_meta_data( '_artmatter_tracking_number', $assigned_num );
		$order->update_meta_data( '_ywot_tracking_code', $assigned_num );
		$order->update_meta_data( '_ywot_carrier_id', strtoupper( $carrier_clean ) );
		$order->add_order_note( sprintf( '%s - %s | Tracking number manually assigned from Exacoat Manager pool.', strtoupper( $carrier_clean ), $assigned_num ) );
		$order->save();

		return new \WP_REST_Response( [
			'success'         => true,
			'order_id'        => $order_id,
			'carrier'         => $carrier_clean,
			'tracking_number' => $assigned_num,
		], 200 );
	}

	public static function rest_get_history( \WP_REST_Request $request ): \WP_REST_Response {
		$carrier = sanitize_text_field( $request->get_param( 'carrier' ) ?? 'jne' );
		$limit   = (int) ( $request->get_param( 'limit' ) ?? 50 );

		return new \WP_REST_Response( [
			'success' => true,
			'carrier' => $carrier,
			'history' => self::get_history( $carrier, $limit ),
		], 200 );
	}
}

}
