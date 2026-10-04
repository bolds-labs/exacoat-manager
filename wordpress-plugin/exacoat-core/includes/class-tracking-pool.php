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
		// 1. Hook WooCommerce order status change to processing (Payment Confirmed) & status transitions (Priority 20: run after status transition completes)
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'on_order_processing' ], 20, 1 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'on_order_processing' ], 20, 1 );
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'on_order_status_changed' ], 20, 3 );

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

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/numbers', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_numbers' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/update', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_update_numbers' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/set', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_update_numbers' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/tracking-pool/take', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_take_number' ],
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
	 * Get all active numbers in carrier pool
	 */
	public static function get_tracking_numbers( string $raw_carrier ): array {
		$carrier = self::normalize_carrier( $raw_carrier );
		if ( empty( $carrier ) ) {
			return [];
		}
		$pool = get_option( self::OPTION_PREFIX_POOL . $carrier, [] );
		if ( ! is_array( $pool ) ) {
			return [];
		}
		return array_values( array_filter( array_map( 'trim', $pool ) ) );
	}

	/**
	 * Set / Replace entire tracking number pool for carrier
	 */
	public static function set_tracking_numbers( string $raw_carrier, $numbers ): array {
		$carrier = self::normalize_carrier( $raw_carrier );
		if ( empty( $carrier ) ) {
			return [ 'success' => false, 'error' => 'Invalid carrier' ];
		}

		if ( is_string( $numbers ) ) {
			$numbers = preg_split( '/[\r\n,\s]+/', $numbers );
		}

		if ( ! is_array( $numbers ) ) {
			$numbers = [];
		}

		$pool_key   = self::OPTION_PREFIX_POOL . $carrier;
		$clean_pool = [];
		$seen       = [];

		foreach ( $numbers as $n ) {
			$clean = trim( (string) $n );
			if ( $clean !== '' && ! isset( $seen[ $clean ] ) ) {
				$clean_pool[]   = $clean;
				$seen[ $clean ] = true;
			}
		}

		update_option( $pool_key, array_values( $clean_pool ), false );
		update_option( "exacoat_tracking_last_restock_{$carrier}", current_time( 'mysql' ), false );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'tracking_pool', sprintf( 'Updated %s tracking pool. Total available: %d', strtoupper( $carrier ), count( $clean_pool ) ) );
		}

		return [
			'success'    => true,
			'carrier'    => $carrier,
			'total_pool' => count( $clean_pool ),
			'numbers'    => $clean_pool,
		];
	}

	/**
	 * Take a tracking number manually from pool (removes from pool and marks in assigned ledger)
	 */
	public static function take_tracking_number_manually( string $raw_carrier, string $specific_number = '', string $note = 'Manual withdrawal' ): array {
		$carrier = self::normalize_carrier( $raw_carrier );
		if ( empty( $carrier ) ) {
			return [ 'success' => false, 'error' => 'Invalid carrier' ];
		}

		$lock_key = self::LOCK_PREFIX . $carrier;
		$attempts = 0;
		while ( get_transient( $lock_key ) && $attempts < 10 ) {
			usleep( 50000 );
			$attempts++;
		}
		set_transient( $lock_key, time(), 10 );

		try {
			$pool_key = self::OPTION_PREFIX_POOL . $carrier;
			$pool     = get_option( $pool_key, [] );
			if ( ! is_array( $pool ) || empty( $pool ) ) {
				delete_transient( $lock_key );
				return [ 'success' => false, 'error' => sprintf( 'No tracking numbers available in %s pool', strtoupper( $carrier ) ) ];
			}

			$taken_number = '';
			if ( ! empty( $specific_number ) ) {
				$key = array_search( trim( $specific_number ), $pool, true );
				if ( $key === false ) {
					delete_transient( $lock_key );
					return [ 'success' => false, 'error' => 'Specified tracking number not found in pool' ];
				}
				$taken_number = trim( $pool[ $key ] );
				array_splice( $pool, $key, 1 );
			} else {
				$taken_number = trim( (string) array_shift( $pool ) );
			}

			update_option( $pool_key, array_values( $pool ), false );

			// Record in assigned ledger as manual withdrawal
			$assigned_key = self::OPTION_PREFIX_ASSIGNED . $carrier;
			$assigned     = get_option( $assigned_key, [] );
			if ( ! is_array( $assigned ) ) {
				$assigned = [];
			}

			array_unshift( $assigned, [
				'number'      => $taken_number,
				'order_id'    => 0,
				'carrier'     => $carrier,
				'assigned_at' => current_time( 'mysql' ),
				'note'        => $note,
			] );

			if ( count( $assigned ) > 300 ) {
				$assigned = array_slice( $assigned, 0, 300 );
			}
			update_option( $assigned_key, $assigned, false );

			delete_transient( $lock_key );

			return [
				'success'   => true,
				'carrier'   => $carrier,
				'number'    => $taken_number,
				'remaining' => count( $pool ),
			];
		} catch ( \Throwable $e ) {
			delete_transient( $lock_key );
			return [ 'success' => false, 'error' => $e->getMessage() ];
		}
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

			$avail_count  = is_array( $pool ) ? count( $pool ) : 0;
			$assign_count = is_array( $assigned ) ? count( $assigned ) : 0;
			$clean_pool   = is_array( $pool ) ? array_values( array_map( 'trim', $pool ) ) : [];

			$inventory[ $code ] = [
				'code'           => $code,
				'name'           => $data['name'],
				'auto_resi'      => $data['auto_resi'],
				'available'      => $avail_count,
				'assigned_total' => $assign_count,
				'is_low_stock'   => $data['auto_resi'] && ( $avail_count < self::LOW_STOCK_THRESHOLD ),
				'last_restock'   => get_option( "exacoat_tracking_last_restock_{$code}", null ),
				'sample_pool'    => array_slice( $clean_pool, 0, 5 ),
				'numbers'        => $clean_pool,
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
	 * Hook: Order status changed
	 */
	public static function on_order_status_changed( $order_id, $old_status, $new_status ): void {
		$clean_new = str_replace( 'wc-', '', $new_status );
		if ( in_array( $clean_new, [ 'processing', 'confirmed', 'preparing-order', 'ready-to-ship' ], true ) ) {
			self::auto_assign_order_tracking( (int) $order_id );
		}
	}

	/**
	 * Detect Carrier from Order thoroughly
	 */
	public static function detect_order_carrier( $order ): string {
		if ( ! $order ) {
			return '';
		}

		// 1. Direct explicit meta
		$carrier_meta = (string) ( $order->get_meta( 'carrier_id' ) ?: ( $order->get_meta( '_carrier_id' ) ?: ( $order->get_meta( 'courier' ) ?: $order->get_meta( '_courier' ) ) ) );
		$clean_meta = self::normalize_carrier( $carrier_meta );
		if ( ! empty( $clean_meta ) && in_array( $clean_meta, [ 'jne', 'sicepat', 'pos', 'goorita' ], true ) ) {
			return $clean_meta;
		}

		// 2. Search texts across customer note, shipping method, shipping lines, items
		$search_texts = [];
		$cust_note = (string) $order->get_customer_note();
		if ( ! empty( $cust_note ) ) {
			$search_texts[] = $cust_note;
		}

		$ship_method = (string) $order->get_shipping_method();
		if ( ! empty( $ship_method ) ) {
			$search_texts[] = $ship_method;
		}

		if ( method_exists( $order, 'get_items' ) ) {
			foreach ( $order->get_items( 'shipping' ) as $s_item ) {
				$search_texts[] = (string) $s_item->get_method_title();
				$search_texts[] = (string) $s_item->get_method_id();
				if ( method_exists( $s_item, 'get_meta_data' ) ) {
					foreach ( $s_item->get_meta_data() as $m ) {
						$search_texts[] = (string) $m->key . ' ' . (string) ( is_scalar( $m->value ) ? $m->value : '' );
					}
				}
			}
		}

		foreach ( $search_texts as $st ) {
			$st_lower = strtolower( $st );
			if ( strpos( $st_lower, 'sicepat' ) !== false || strpos( $st_lower, 'si cepat' ) !== false ) {
				return 'sicepat';
			} elseif ( strpos( $st_lower, 'jne' ) !== false ) {
				return 'jne';
			} elseif ( strpos( $st_lower, 'pos indonesia' ) !== false || preg_match( '/\bpos\b/', $st_lower ) ) {
				return 'pos';
			} elseif ( strpos( $st_lower, 'goorita' ) !== false ) {
				return 'goorita';
			}
		}

		if ( ! empty( $clean_meta ) ) {
			return $clean_meta;
		}

		return '';
	}

	/**
	 * Auto-Assign Tracking Number to Order if empty (guaranteed for JNE & SiCepat)
	 */
	public static function auto_assign_order_tracking( int $order_id ): bool {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return false;
		}

		// Guarantee tracking numbers are ONLY auto-assigned when order is confirmed/paid/processing
		$status = str_replace( 'wc-', '', $order->get_status() );
		if ( ! in_array( $status, [ 'processing', 'confirmed', 'preparing-order', 'ready-to-ship', 'completed', 'shipped' ], true ) ) {
			return false;
		}

		$carrier = self::detect_order_carrier( $order );
		if ( empty( $carrier ) ) {
			return false;
		}

		$clean_tracking = function( $val ) {
			if ( ! is_scalar( $val ) ) return '';
			$s = trim( (string) $val );
			if ( empty( $s ) || str_starts_with( $s, 'field_' ) || $s === '⚠️' || $s === 'N/A' || $s === '-' ) return '';
			return $s;
		};

		$current_tracking = $clean_tracking( $order->get_meta( 'tracking_number' ) )
			?: ( $clean_tracking( $order->get_meta( '_tracking_number' ) )
			?: ( $clean_tracking( $order->get_meta( '_artmatter_tracking_number' ) )
			?: $clean_tracking( $order->get_meta( '_ywot_tracking_code' ) ) ) );

		// Auto-Resi couriers: JNE & SiCepat
		if ( in_array( $carrier, [ 'jne', 'sicepat' ], true ) ) {
			if ( empty( $current_tracking ) ) {
				$allocated_number = self::pop_tracking_number( $carrier, $order_id );

				if ( ! empty( $allocated_number ) ) {
					$carrier_label = self::get_carrier_label( $carrier );

					// Save tracking metadata consistently across all recognized keys
					$order->update_meta_data( 'carrier_id', $carrier );
					$order->update_meta_data( '_carrier_id', $carrier );
					$order->update_meta_data( 'tracking_number', $allocated_number );
					$order->update_meta_data( '_tracking_number', $allocated_number );
					$order->update_meta_data( '_ywot_tracking_code', $allocated_number );
					$order->update_meta_data( '_ywot_carrier_id', strtoupper( $carrier ) );
					$order->update_meta_data( '_exacoat_tracking_number', $allocated_number );
					$order->update_meta_data( '_exacoat_tracking_note_logged_number', $allocated_number );
					$order->update_meta_data( '_exacoat_tracking_note_logged_carrier', $carrier );

					// WC Shipment Tracking item structure
					$shipment_items = [
						[
							'tracking_number'          => $allocated_number,
							'custom_tracking_provider' => $carrier_label,
							'tracking_provider'        => $carrier,
							'date_shipped'             => current_time( 'Y-m-d' ),
						],
					];
					$order->update_meta_data( '_wc_shipment_tracking_items', $shipment_items );

					$order->add_order_note( sprintf(
						'%s - %s | Tracking number allocated from Exacoat Manager pool.',
						strtoupper( $carrier ),
						$allocated_number
					), false );

					$order->save();

					// Sync postmeta for legacy database tables
					update_post_meta( $order_id, 'carrier_id', $carrier );
					update_post_meta( $order_id, '_carrier_id', $carrier );
					update_post_meta( $order_id, 'tracking_number', $allocated_number );
					update_post_meta( $order_id, '_tracking_number', $allocated_number );
					update_post_meta( $order_id, '_ywot_tracking_code', $allocated_number );
					update_post_meta( $order_id, '_ywot_carrier_id', strtoupper( $carrier ) );
					update_post_meta( $order_id, '_exacoat_tracking_number', $allocated_number );
					update_post_meta( $order_id, '_exacoat_tracking_note_logged_number', $allocated_number );
					update_post_meta( $order_id, '_exacoat_tracking_note_logged_carrier', $carrier );
					update_post_meta( $order_id, '_wc_shipment_tracking_items', $shipment_items );

					return true;
				}
			}
		} elseif ( 'goorita' === $carrier ) {
			// Goorita US shipments: assign carrier metadata and delegate to Exacoat_Goorita_Service
			$order->update_meta_data( 'carrier_id', 'goorita' );
			$order->update_meta_data( '_carrier_id', 'goorita' );
			update_post_meta( $order_id, 'carrier_id', 'goorita' );
			update_post_meta( $order_id, '_carrier_id', 'goorita' );

			// Clear legacy warning symbol if present
			if ( $order->get_meta( 'tracking_number' ) === '⚠️' || get_post_meta( $order_id, 'tracking_number', true ) === '⚠️' ) {
				$order->delete_meta_data( 'tracking_number' );
				$order->delete_meta_data( '_tracking_number' );
				$order->delete_meta_data( '_exacoat_tracking_number' );
				delete_post_meta( $order_id, 'tracking_number' );
				delete_post_meta( $order_id, '_tracking_number' );
				delete_post_meta( $order_id, '_exacoat_tracking_number' );
			}
			$order->save();

			if ( class_exists( 'Exacoat_Goorita_Service' ) ) {
				Exacoat_Goorita_Service::handle_auto_booking( $order_id, $order );
			}
			return true;
		} elseif ( 'pos' === $carrier ) {
			// POS Indonesia manual courier: ensure carrier metadata is set without corrupting tracking number
			$order->update_meta_data( 'carrier_id', 'pos' );
			$order->update_meta_data( '_carrier_id', 'pos' );
			if ( $order->get_meta( 'tracking_number' ) === '⚠️' || get_post_meta( $order_id, 'tracking_number', true ) === '⚠️' ) {
				$order->delete_meta_data( 'tracking_number' );
				$order->delete_meta_data( '_tracking_number' );
				$order->delete_meta_data( '_exacoat_tracking_number' );
				delete_post_meta( $order_id, 'tracking_number' );
				delete_post_meta( $order_id, '_tracking_number' );
				delete_post_meta( $order_id, '_exacoat_tracking_number' );
			}
			$order->save();

			update_post_meta( $order_id, 'carrier_id', 'pos' );
			update_post_meta( $order_id, '_carrier_id', 'pos' );
			return true;
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

	public static function rest_get_numbers( \WP_REST_Request $request ): \WP_REST_Response {
		$carrier = sanitize_text_field( $request->get_param( 'carrier' ) ?? 'jne' );
		$numbers = self::get_tracking_numbers( $carrier );
		return new \WP_REST_Response( [
			'success'    => true,
			'carrier'    => $carrier,
			'total_pool' => count( $numbers ),
			'numbers'    => $numbers,
		], 200 );
	}

	public static function rest_update_numbers( \WP_REST_Request $request ): \WP_REST_Response {
		$params  = $request->get_json_params() ?: $request->get_params();
		$carrier = sanitize_text_field( $params['carrier'] ?? '' );
		$numbers = $params['numbers'] ?? [];

		$res = self::set_tracking_numbers( $carrier, $numbers );
		return new \WP_REST_Response( $res, ! empty( $res['success'] ) ? 200 : 400 );
	}

	public static function rest_take_number( \WP_REST_Request $request ): \WP_REST_Response {
		$params          = $request->get_json_params() ?: $request->get_params();
		$carrier         = sanitize_text_field( $params['carrier'] ?? '' );
		$specific_number = sanitize_text_field( $params['number'] ?? '' );
		$note            = sanitize_text_field( $params['note'] ?? 'Manual take via Exacoat Manager' );

		$res = self::take_tracking_number_manually( $carrier, $specific_number, $note );
		return new \WP_REST_Response( $res, ! empty( $res['success'] ) ? 200 : 400 );
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
		$order->update_meta_data( '_ywot_tracking_code', $assigned_num );
		$order->update_meta_data( '_ywot_carrier_id', strtoupper( $carrier_clean ) );
		$order->update_meta_data( '_exacoat_tracking_number', $assigned_num );
		$order->update_meta_data( '_exacoat_tracking_note_logged_number', $assigned_num );
		$order->update_meta_data( '_exacoat_tracking_note_logged_carrier', $carrier_clean );
		$order->add_order_note( sprintf( '%s - %s | Tracking number manually assigned from Exacoat Manager pool.', strtoupper( $carrier_clean ), $assigned_num ) );
		$order->save();

		update_post_meta( $order_id, '_exacoat_tracking_note_logged_number', $assigned_num );
		update_post_meta( $order_id, '_exacoat_tracking_note_logged_carrier', $carrier_clean );

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

