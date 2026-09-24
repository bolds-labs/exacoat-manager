<?php
/**
 * Exacoat Core BCA Automated Payment Confirmation & Unique Code Engine
 * Seamless integration for MesinOtomatis webhook, atomic queue processing, and collision-free unique verification codes.
 *
 * Compatible with legacy /wp-json/exawebhook/v1/endpoint and modern REST routes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_BCA_Payment_Webhook' ) ) {

class Exacoat_BCA_Payment_Webhook {

	/**
	 * Webhook option queue name
	 */
	const QUEUE_OPTION = 'exawebhook_queue';

	/**
	 * Webhook cron action hook
	 */
	const CRON_ACTION = 'exawebhook_process_queue';

	/**
	 * Strict bounds for Unique Payment Code (Rp 1 - Rp 100)
	 */
	const MIN_UNIQUE_CODE = 1;
	const MAX_UNIQUE_CODE = 100;

	/**
	 * Active order lookback window in days (used by both generator and webhook matcher)
	 */
	const ACTIVE_WINDOW_DAYS = 5;

	/**
	 * Initialize hooks and filters
	 */
	public static function init() {
		// 1. Register REST API endpoints
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );

		// 2. Cron queue processor
		add_action( self::CRON_ACTION, [ __CLASS__, 'process_queue' ] );

		// 3. Unique Payment Code Fee Generation & Post-Order Collision Guard
		add_action( 'woocommerce_cart_calculate_fees', [ __CLASS__, 'add_unique_payment_code_fee' ], 20 );
		add_action( 'woocommerce_checkout_create_order', [ __CLASS__, 'save_unique_code_to_order' ], 10, 2 );
		add_action( 'woocommerce_checkout_order_processed', [ __CLASS__, 'ensure_order_unique_total_by_id' ], 20, 1 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'ensure_order_unique_total' ], 20, 1 );
		add_action( 'woocommerce_thankyou', [ __CLASS__, 'clear_session_unique_code' ] );

		// 4. Admin Order Meta Display
		add_action( 'woocommerce_admin_order_data_after_billing_address', [ __CLASS__, 'display_admin_order_meta' ] );
	}

	/**
	 * Register REST API Webhook Endpoints
	 */
	public static function register_routes() {
		$endpoint_args = [
			'methods'             => \WP_REST_Server::CREATABLE,
			'callback'            => [ __CLASS__, 'handle_webhook_request' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'amount' => [
					'required'          => false,
					'sanitize_callback' => 'sanitize_text_field',
				],
				'description' => [
					'required'          => false,
					'sanitize_callback' => 'sanitize_textarea_field',
				],
			],
		];

		// Route 1: Exact legacy route for existing MesinOtomatis forwarder configurations
		register_rest_route( 'exawebhook/v1', '/endpoint', $endpoint_args );

		// Route 2: Dedicated Exacoat Core REST endpoint
		register_rest_route( 'exacoat-core/v1', '/bca-webhook', $endpoint_args );

		// Route 3: Status and unmatched mutations inspector
		register_rest_route( 'exacoat-core/v1', '/bca/status', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_status' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );
	}

	/**
	 * Permission check for BCA status endpoint
	 */
	public static function check_permission( \WP_REST_Request $request ): bool {
		if ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( class_exists( 'Exacoat_Core' ) && method_exists( 'Exacoat_Core', 'verify_bridge_permission' ) ) {
			if ( Exacoat_Core::verify_bridge_permission( $request ) ) {
				return true;
			}
		}

		$token = $request->get_header( 'X-Exacoat-Token' );
		if ( ! empty( $token ) ) {
			$expected = get_option( 'exacoat_api_secret', '' );
			if ( ! empty( $expected ) && hash_equals( (string) $expected, (string) $token ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * REST Callback: Get BCA Webhook status and unmatched mutations
	 */
	public static function rest_get_status( \WP_REST_Request $request ): \WP_REST_Response {
		$unmatched = get_option( 'exa_bca_unmatched_mutations', [] );
		if ( ! is_array( $unmatched ) ) {
			$unmatched = [];
		}

		return new \WP_REST_Response( [
			'success'             => true,
			'webhook_url'         => rest_url( 'exacoat-core/v1/bca-webhook' ),
			'unmatched_count'     => count( $unmatched ),
			'unmatched_mutations' => array_slice( array_reverse( $unmatched ), 0, 25 ),
		], 200 );
	}

	/**
	 * Parse and sanitize incoming amount (handles Indonesian thousand separators and strings)
	 */
	public static function parse_amount( $raw_amount ): int {
		if ( is_int( $raw_amount ) ) {
			return $raw_amount;
		}

		if ( is_float( $raw_amount ) ) {
			return (int) round( $raw_amount );
		}

		if ( is_string( $raw_amount ) ) {
			$clean = trim( $raw_amount );

			// Check for currency symbols or whitespace
			$clean = preg_replace( '/[^\d.,]/', '', $clean );

			// If both dot and comma exist, e.g. 150.000,00 or 150,000.00
			if ( strpos( $clean, '.' ) !== false && strpos( $clean, ',' ) !== false ) {
				$last_dot   = strrpos( $clean, '.' );
				$last_comma = strrpos( $clean, ',' );

				if ( $last_comma > $last_dot ) {
					// Format: 150.000,00 (Indonesian format with cents)
					$clean = str_replace( '.', '', $clean );
					$clean = str_replace( ',', '.', $clean );
				} else {
					// Format: 150,000.00 (US format)
					$clean = str_replace( ',', '', $clean );
				}
			} elseif ( strpos( $clean, '.' ) !== false ) {
				// Only dots present: e.g. "150.000" vs "150000.00"
				$parts = explode( '.', $clean );
				$last_part = end( $parts );

				if ( strlen( $last_part ) === 3 ) {
					// Thousand separator: 150.000 -> 150000
					$clean = str_replace( '.', '', $clean );
				} elseif ( strlen( $last_part ) <= 2 ) {
					// Decimals: 150000.00
					$clean = (float) $clean;
				}
			} elseif ( strpos( $clean, ',' ) !== false ) {
				// Only commas present: e.g. "150,000"
				$clean = str_replace( ',', '', $clean );
			}

			return (int) round( (float) $clean );
		}

		return 0;
	}

	/**
	 * Handle incoming REST Webhook payload from MesinOtomatis
	 */
	public static function handle_webhook_request( \WP_REST_Request $request ): \WP_REST_Response {
		$params = $request->get_params();

		// Extract amount from amount, nominal, or kredit
		$raw_amount = $params['amount'] ?? ( $params['nominal'] ?? ( $params['kredit'] ?? 0 ) );
		$amount     = self::parse_amount( $raw_amount );

		// Extract description from description, keterangan, or berita
		$description = isset( $params['description'] )
			? sanitize_textarea_field( wp_unslash( $params['description'] ) )
			: ( isset( $params['keterangan'] ) ? sanitize_textarea_field( wp_unslash( $params['keterangan'] ) ) : '' );

		// Filter transaction type: skip debits (money out)
		$type = strtoupper( sanitize_text_field( $params['type'] ?? ( $params['tipe'] ?? '' ) ) );
		if ( 'DB' === $type || 'DEBIT' === $type ) {
			return new \WP_REST_Response( [
				'success' => true,
				'message' => 'Debit transaction skipped.',
			], 200 );
		}

		if ( $amount <= 0 ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Invalid or zero amount received.',
			], 400 );
		}

		// Log raw incoming webhook event
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'bca_webhook', sprintf( 'Received BCA Webhook: Rp %s | %s', number_format( $amount, 0, ',', '.' ), $description ), $params );
		}

		// Load existing queue
		$queue   = get_option( self::QUEUE_OPTION, [] );
		if ( ! is_array( $queue ) ) {
			$queue = [];
		}

		// Append this payload
		$queue[] = [
			'amount'      => $amount,
			'description' => $description,
			'time'        => time(),
		];
		update_option( self::QUEUE_OPTION, $queue, false );

		// If this is the only item in queue, process immediately
		if ( count( $queue ) === 1 ) {
			$matched_order_id = self::process_queue();

			if ( $matched_order_id ) {
				return new \WP_REST_Response( [
					'success'  => true,
					'message'  => sprintf( 'Webhook processed immediately. Order #%d confirmed.', $matched_order_id ),
					'order_id' => $matched_order_id,
					'amount'   => $amount,
				], 200 );
			}

			return new \WP_REST_Response( [
				'success' => true,
				'message' => 'Webhook processed immediately. No pending order matched yet (logged to unmatched mutations).',
				'amount'  => $amount,
			], 200 );
		}

		// Multiple items: schedule background processing within 15 seconds
		if ( ! wp_next_scheduled( self::CRON_ACTION ) ) {
			wp_schedule_single_event( time() + 15, self::CRON_ACTION );
		}

		return new \WP_REST_Response( [
			'success' => true,
			'message' => 'Webhook queued for processing.',
			'amount'  => $amount,
		], 202 );
	}

	/**
	 * Process webhook queue
	 */
	public static function process_queue(): ?int {
		// Transient lock to prevent concurrent executions
		$lock_key = 'exa_bca_queue_lock';
		if ( get_transient( $lock_key ) ) {
			return null;
		}
		set_transient( $lock_key, time(), 45 );

		$queue = get_option( self::QUEUE_OPTION, [] );
		delete_option( self::QUEUE_OPTION );

		if ( empty( $queue ) || ! is_array( $queue ) ) {
			delete_transient( $lock_key );
			return null;
		}

		$last_matched_order_id = null;

		foreach ( $queue as $item ) {
			if ( empty( $item['amount'] ) ) {
				continue;
			}

			$order_id = self::match_update_woocommerce_order_status(
				(int) $item['amount'],
				(string) ( $item['description'] ?? '' )
			);

			if ( $order_id ) {
				$last_matched_order_id = $order_id;
			}
		}

		delete_transient( $lock_key );
		return $last_matched_order_id;
	}

	/**
	 * Match and update WooCommerce order status with atomic locking, collision disambiguation & deduplication
	 */
	public static function match_update_woocommerce_order_status( int $payment_amount, string $description ): ?int {
		if ( $payment_amount <= 0 || ! function_exists( 'wc_get_orders' ) ) {
			return null;
		}

		// Fetch all active pending and on-hold orders within the lookback window
		$orders = wc_get_orders( [
			'status'       => [ 'pending', 'on-hold' ],
			'limit'        => -1,
			'orderby'      => 'date',
			'order'        => 'DESC',
			'date_created' => '>' . ( time() - ( self::ACTIVE_WINDOW_DAYS * DAY_IN_SECONDS ) ),
		] );

		if ( empty( $orders ) ) {
			self::record_unmatched_mutation( $payment_amount, $description );
			return null;
		}

		$mutation_hash = md5( $payment_amount . '|' . trim( $description ) );

		// Collect all candidate orders that match the exact integer payment amount
		$candidates = [];
		foreach ( $orders as $order ) {
			if ( ! $order instanceof \WC_Order ) {
				continue;
			}
			$order_total = (int) round( (float) $order->get_total() );
			if ( $order_total === $payment_amount ) {
				$candidates[] = $order;
			}
		}

		if ( empty( $candidates ) ) {
			self::record_unmatched_mutation( $payment_amount, $description );
			return null;
		}

		// If multiple orders happen to share the exact same amount, disambiguate safely
		if ( count( $candidates ) > 1 ) {
			$bca_gateways = [ 'bacs', 'bca', 'bank_transfer', 'manual_bca' ];
			$bacs_only    = array_values( array_filter( $candidates, function( \WC_Order $o ) use ( $bca_gateways ) {
				return in_array( strtolower( (string) $o->get_payment_method() ), $bca_gateways, true );
			} ) );

			if ( count( $bacs_only ) === 1 ) {
				$candidates = $bacs_only;
			} else {
				$pool = ! empty( $bacs_only ) ? $bacs_only : $candidates;
				$desc_upper = strtoupper( $description );
				$matched_by_desc = [];

				foreach ( $pool as $cand ) {
					$oid   = (string) $cand->get_id();
					$fname = strtoupper( trim( (string) $cand->get_billing_first_name() ) );
					$lname = strtoupper( trim( (string) $cand->get_billing_last_name() ) );

					if (
						( $oid !== '' && strpos( $desc_upper, $oid ) !== false )
						|| ( strlen( $fname ) >= 3 && strpos( $desc_upper, $fname ) !== false )
						|| ( strlen( $lname ) >= 3 && strpos( $desc_upper, $lname ) !== false )
					) {
						$matched_by_desc[] = $cand;
					}
				}

				if ( count( $matched_by_desc ) === 1 ) {
					$candidates = $matched_by_desc;
				} else {
					// Refuse to blindly confirm when multiple orders share the exact same amount and cannot be disambiguated
					$conflict_ids = array_map( function( \WC_Order $o ) { return '#' . $o->get_id(); }, $pool );
					self::record_unmatched_mutation(
						$payment_amount,
						sprintf( '[AMBIGUOUS AMOUNT CONFLICT: %s] %s', implode( ', ', $conflict_ids ), $description )
					);
					return null;
				}
			}
		}

		foreach ( $candidates as $order ) {
			$order_id = $order->get_id();

			// Atomic order lock
			if ( ! self::try_lock_order( $order_id ) ) {
				continue;
			}

			try {
				// Deduplication 1: Check order meta for identical mutation hash
				$confirmed_hash = $order->get_meta( '_bca_confirmed_mutation' );
				if ( $confirmed_hash && $confirmed_hash === $mutation_hash ) {
					self::unlock_order( $order_id );
					continue;
				}

				// Deduplication 2: Check notes if description already present
				$notes = wc_get_order_notes( [ 'order_id' => $order_id, 'limit' => 20 ] );
				foreach ( $notes as $note ) {
					if ( ! empty( $description ) && strpos( $note->content, $description ) !== false ) {
						self::unlock_order( $order_id );
						continue 2;
					}
				}

				// Double-check integer total inside lock
				$order_total = (int) round( (float) $order->get_total() );

				if ( $order_total === $payment_amount ) {
					// 1. Record mutation meta
					$order->update_meta_data( '_bca_confirmed_mutation', $mutation_hash );
					$order->update_meta_data( '_bca_mutation_desc', $description );
					$order->update_meta_data( '_bca_confirmed_at', current_time( 'mysql' ) );

					// 2. Mark order payment complete (triggers stock deduction, emails, and transitions to processing)
					$transaction_id = 'BCA-' . date( 'YmdHis' ) . '-' . $order_id;
					$order->payment_complete( $transaction_id );

					// 3. Add clear order note
					$note_content = sprintf(
						"BCA Payment Confirmed via Automated Webhook.\nAmount: Rp %s\nTransaction ID: %s\nMutation: %s",
						number_format( $payment_amount, 0, ',', '.' ),
						$transaction_id,
						$description ?: 'N/A'
					);
					$order->add_order_note( $note_content, false );
					$order->save();

					delete_transient( 'exa_pending_order_totals' );
					self::unlock_order( $order_id );

					// Log success
					if ( class_exists( 'Exacoat_Logger' ) ) {
						Exacoat_Logger::log( 'info', 'bca_webhook', sprintf( 'Order #%d confirmed via BCA mutation Rp %s', $order_id, number_format( $payment_amount, 0, ',', '.' ) ), [
							'order_id'       => $order_id,
							'amount'         => $payment_amount,
							'transaction_id' => $transaction_id,
							'description'    => $description,
						] );
					}

					return $order_id;
				}
			} catch ( \Throwable $e ) {
				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'error', 'bca_webhook', 'Error during BCA order confirmation: ' . $e->getMessage(), [
						'order_id' => $order_id,
						'error'    => $e->getMessage(),
					] );
				}
			} finally {
				self::unlock_order( $order_id );
			}
		}

		// If loop completed without match, record unmatched mutation
		self::record_unmatched_mutation( $payment_amount, $description );
		return null;
	}

	/**
	 * Log unmatched BCA mutation for staff inspection in manager ERP / admin
	 */
	private static function record_unmatched_mutation( int $amount, string $description ) {
		$unmatched = get_option( 'exa_bca_unmatched_mutations', [] );
		if ( ! is_array( $unmatched ) ) {
			$unmatched = [];
		}

		// Keep only last 25 unmatched entries
		array_unshift( $unmatched, [
			'amount'      => $amount,
			'description' => $description,
			'timestamp'   => current_time( 'mysql' ),
		] );

		if ( count( $unmatched ) > 25 ) {
			$unmatched = array_slice( $unmatched, 0, 25 );
		}

		update_option( 'exa_bca_unmatched_mutations', $unmatched, false );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'warning', 'bca_webhook_unmatched', sprintf( 'Unmatched BCA mutation received: Rp %s | %s', number_format( $amount, 0, ',', '.' ), $description ) );
		}
	}

	/**
	 * Atomic Order Locking via Transient
	 */
	public static function try_lock_order( int $order_id ): bool {
		$lock_key = 'bca_lock_order_' . $order_id;
		if ( get_transient( $lock_key ) ) {
			return false;
		}
		set_transient( $lock_key, time(), 30 );
		return true;
	}

	/**
	 * Unlock Order
	 */
	public static function unlock_order( int $order_id ): void {
		delete_transient( 'bca_lock_order_' . $order_id );
	}

	/**
	 * Check whether a fee name represents the Unique Payment Code
	 */
	public static function is_unique_code_fee_name( string $name ): bool {
		$lower = strtolower( trim( $name ) );
		return strpos( $lower, 'unique payment code' ) !== false
			|| strpos( $lower, 'kode unik' ) !== false
			|| $lower === 'unique code';
	}

	/**
	 * Compute cart base total prior to adding Unique Payment Code
	 */
	public static function get_cart_base_total(): int {
		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			return 0;
		}

		$cart_contents_total = (float) WC()->cart->get_cart_contents_total();
		$shipping_total      = (float) WC()->cart->get_shipping_total();
		$other_fees_total    = 0.0;

		foreach ( WC()->cart->get_fees() as $fee ) {
			$fee_name = (string) ( $fee->name ?? '' );
			if ( ! self::is_unique_code_fee_name( $fee_name ) ) {
				$other_fees_total += (float) ( $fee->amount ?? 0 );
			}
		}

		return (int) round( $cart_contents_total + $shipping_total + $other_fees_total );
	}

	/**
	 * Add Unique Payment Code Fee (Rp 1 - Rp 100) to WooCommerce Cart
	 */
	public static function add_unique_payment_code_fee() {
		// Only run on frontend, Store API, or AJAX checkout
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}

		if ( ! function_exists( 'WC' ) || ! WC()->session || ! WC()->cart ) {
			return;
		}

		// Only apply if currency is IDR
		if ( get_woocommerce_currency() !== 'IDR' ) {
			return;
		}

		// Skip if custom order type is active and not normal
		$order_type = WC()->session->get( 'order_type' );
		if ( $order_type && 'normal' !== $order_type ) {
			return;
		}

		// Do not add fee if cart contents total is zero
		if ( WC()->cart->get_cart_contents_total() <= 0 ) {
			return;
		}

		// Restrict to Bank Transfer / BCA or unselected gateway
		$chosen_gateway = WC()->session->get( 'chosen_payment_method' );
		$applicable_gateways = apply_filters( 'exa_bca_unique_code_gateways', [
			'bacs',
			'bca',
			'bank_transfer',
			'manual_bca',
			'',
		] );

		if ( ! empty( $chosen_gateway ) && ! in_array( $chosen_gateway, $applicable_gateways, true ) ) {
			return;
		}

		$base_total      = self::get_cart_base_total();
		$existing_totals = self::get_active_pending_totals();

		// Retrieve or regenerate unique code (strictly 1-100 and collision-free against active orders)
		$unique_code = (int) WC()->session->get( 'bca_unique_payment_code' );
		if (
			! $unique_code
			|| $unique_code < self::MIN_UNIQUE_CODE
			|| $unique_code > self::MAX_UNIQUE_CODE
			|| ( $base_total > 0 && in_array( $base_total + $unique_code, $existing_totals, true ) )
		) {
			$unique_code = self::generate_unique_code( $base_total, $existing_totals );
			WC()->session->set( 'bca_unique_payment_code', $unique_code );
			WC()->session->set( 'random_fee', $unique_code );
		}

		// Add non-taxable fee to cart
		WC()->cart->add_fee( __( 'Unique Payment Code', 'exacoat-core' ), $unique_code, false );
	}

	/**
	 * Generate a collision-free unique code (1-100) comparing against all active pending/on-hold orders
	 */
	public static function generate_unique_code( ?int $base_total = null, ?array $existing_totals = null ): int {
		if ( null === $base_total ) {
			$base_total = self::get_cart_base_total();
		}

		if ( null === $existing_totals ) {
			$existing_totals = self::get_active_pending_totals();
		}

		// Test all 100 shuffled values (1..100) so any non-overlapping code is guaranteed to be found
		$candidates = range( self::MIN_UNIQUE_CODE, self::MAX_UNIQUE_CODE );
		shuffle( $candidates );

		foreach ( $candidates as $candidate ) {
			if ( ! in_array( $base_total + $candidate, $existing_totals, true ) ) {
				return (int) $candidate;
			}
		}

		return wp_rand( self::MIN_UNIQUE_CODE, self::MAX_UNIQUE_CODE );
	}

	/**
	 * Get list of integer totals for pending/on-hold orders in the last 5 days
	 */
	public static function get_active_pending_totals( int $exclude_order_id = 0, bool $force_refresh = false ): array {
		if ( ! $force_refresh && 0 === $exclude_order_id ) {
			$cached = get_transient( 'exa_pending_order_totals' );
			if ( is_array( $cached ) ) {
				return $cached;
			}
		}

		if ( ! function_exists( 'wc_get_orders' ) ) {
			return [];
		}

		$orders = wc_get_orders( [
			'status'       => [ 'pending', 'on-hold' ],
			'limit'        => -1,
			'date_created' => '>' . ( time() - ( self::ACTIVE_WINDOW_DAYS * DAY_IN_SECONDS ) ),
			'return'       => 'ids',
		] );

		$totals = [];
		foreach ( $orders as $order_id ) {
			if ( $exclude_order_id > 0 && (int) $order_id === $exclude_order_id ) {
				continue;
			}
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$totals[] = (int) round( (float) $order->get_total() );
			}
		}

		$totals = array_values( array_unique( $totals ) );

		if ( 0 === $exclude_order_id ) {
			set_transient( 'exa_pending_order_totals', $totals, 15 );
		}

		return $totals;
	}

	/**
	 * Save unique code to order meta upon checkout
	 */
	public static function save_unique_code_to_order( $order, $data ) {
		if ( ! $order instanceof \WC_Order ) {
			return;
		}

		if ( function_exists( 'WC' ) && WC()->session ) {
			$code = (int) ( WC()->session->get( 'bca_unique_payment_code' ) ?: WC()->session->get( 'random_fee' ) );
			if ( $code > 0 ) {
				$order->update_meta_data( '_bca_unique_code', $code );
			}
		}
	}

	/**
	 * Wrapper for classic checkout hook that passes order ID
	 */
	public static function ensure_order_unique_total_by_id( $order_id ) {
		if ( ! $order_id || ! function_exists( 'wc_get_order' ) ) {
			return;
		}
		$order = wc_get_order( $order_id );
		if ( $order instanceof \WC_Order ) {
			self::ensure_order_unique_total( $order );
		}
	}

	/**
	 * Ensure newly created order has a strictly non-overlapping total and 1..100 Unique Payment Code
	 */
	public static function ensure_order_unique_total( $order ) {
		if ( ! $order instanceof \WC_Order ) {
			return;
		}

		delete_transient( 'exa_pending_order_totals' );

		$fee_item_target = null;
		$current_code    = 0;

		foreach ( $order->get_items( 'fee' ) as $item_id => $fee_item ) {
			$fee_name = (string) $fee_item->get_name();
			if ( self::is_unique_code_fee_name( $fee_name ) ) {
				$fee_item_target = $fee_item;
				$current_code    = (int) round( (float) $fee_item->get_total() );
				break;
			}
		}

		if ( ! $fee_item_target ) {
			return;
		}

		$existing_totals = self::get_active_pending_totals( $order->get_id(), true );
		$order_total     = (int) round( (float) $order->get_total() );
		$base_total      = $order_total - $current_code;

		$needs_update = false;
		$new_code     = $current_code;

		if (
			$current_code < self::MIN_UNIQUE_CODE
			|| $current_code > self::MAX_UNIQUE_CODE
			|| in_array( $order_total, $existing_totals, true )
		) {
			$new_code     = self::generate_unique_code( $base_total, $existing_totals );
			$needs_update = true;
		}

		if ( $fee_item_target->get_name() !== 'Unique Payment Code' ) {
			$fee_item_target->set_name( 'Unique Payment Code' );
			$needs_update = true;
		}

		if ( $needs_update ) {
			$fee_item_target->set_amount( (string) $new_code );
			$fee_item_target->set_total( (string) $new_code );
			$fee_item_target->save();
			$order->update_meta_data( '_bca_unique_code', $new_code );
			$order->calculate_totals( false );
			$order->save();
			delete_transient( 'exa_pending_order_totals' );
		}
	}

	/**
	 * Clear session unique code after successful checkout
	 */
	public static function clear_session_unique_code() {
		delete_transient( 'exa_pending_order_totals' );
		if ( function_exists( 'WC' ) && WC()->session ) {
			WC()->session->__unset( 'bca_unique_payment_code' );
			WC()->session->__unset( 'random_fee' );
		}
	}

	/**
	 * Display unique code in WooCommerce Admin Order Data
	 */
	public static function display_admin_order_meta( $order ) {
		if ( ! $order instanceof \WC_Order ) {
			return;
		}

		$code = $order->get_meta( '_bca_unique_code' );
		if ( $code ) {
			echo '<p class="form-field form-field-wide"><strong>' . esc_html__( 'Unique Payment Code (BCA):', 'exacoat-core' ) . '</strong> Rp ' . esc_html( number_format( (int) $code, 0, ',', '.' ) ) . '</p>';
		}

		$mutation = $order->get_meta( '_bca_mutation_desc' );
		if ( $mutation ) {
			echo '<p class="form-field form-field-wide"><strong>' . esc_html__( 'BCA Mutation Match:', 'exacoat-core' ) . '</strong><br><code>' . esc_html( $mutation ) . '</code></p>';
		}
	}
}

}

/**
 * Backward compatibility class alias
 */
if ( ! class_exists( 'Artmatter_BCA_Payment_Webhook' ) ) {
	class_alias( 'Exacoat_BCA_Payment_Webhook', 'Artmatter_BCA_Payment_Webhook' );
}

/**
 * Global fallback functions to preserve exact compatibility with external snippets
 */
if ( ! function_exists( 'wp_try_lock_order' ) ) {
	function wp_try_lock_order( $order_id ) {
		return Exacoat_BCA_Payment_Webhook::try_lock_order( (int) $order_id );
	}
}

if ( ! function_exists( 'wp_unlock_order' ) ) {
	function wp_unlock_order( $order_id ) {
		Exacoat_BCA_Payment_Webhook::unlock_order( (int) $order_id );
	}
}

if ( ! function_exists( 'exa_confirm_bca_enqueue' ) ) {
	function exa_confirm_bca_enqueue( $request ) {
		return Exacoat_BCA_Payment_Webhook::handle_webhook_request( $request );
	}
}

if ( ! function_exists( 'exa_process_webhook_queue' ) ) {
	function exa_process_webhook_queue() {
		return Exacoat_BCA_Payment_Webhook::process_queue();
	}
}

if ( ! function_exists( 'match_update_woocommerce_order_status' ) ) {
	function match_update_woocommerce_order_status( $payment_amount, $description ) {
		return Exacoat_BCA_Payment_Webhook::match_update_woocommerce_order_status( (int) $payment_amount, (string) $description );
	}
}

if ( ! function_exists( 'add_random_fee_for_idr' ) ) {
	function add_random_fee_for_idr() {
		Exacoat_BCA_Payment_Webhook::add_unique_payment_code_fee();
	}
}
