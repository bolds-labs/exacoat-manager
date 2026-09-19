<?php
/**
 * Exacoat Core - 30-Day Money Back Guarantee Manager
 * Handles 30-day eligibility counted strictly from shipment date,
 * physical return package intake at Ruby Commercial TB12,
 * claim lifecycle in Exacoat Manager, and light-theme refund email dispatch.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Guarantee_Manager' ) ) {

class Exacoat_Guarantee_Manager {

	const GUARANTEE_WINDOW_DAYS = 30;

	// Official Exacoat Returns Hub Address
	const HUB_NAME        = 'Exacoat Returns Hub';
	const HUB_ADDRESS_1   = 'Ruby Commercial TB12';
	const HUB_ADDRESS_2   = 'Jl. Bulevar Selatan, Marga Mulya, Bekasi Utara';
	const HUB_CITY        = 'Kota Bekasi';
	const HUB_STATE       = 'Jawa Barat';
	const HUB_POSTCODE    = '17142';
	const HUB_COUNTRY     = 'Indonesia';
	const HUB_PHONE       = '+62 897-5556-000';
	const HUB_EMAIL       = 'support@exacoat.com';

	/**
	 * Excluded product / line item keywords
	 */
	const EXCLUDED_KEYWORDS = [
		'edge 3d',
		'screen protector',
		'tempered glass',
		'dusk',
		'hybrid case',
		'case',
	];

	/**
	 * Initialize Hooks & REST Endpoints
	 */
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Register REST API Endpoints
	 */
	public static function register_routes(): void {
		// Public: Check guarantee eligibility for an order
		register_rest_route( 'exacoat-core/v1', '/guarantee/check-eligibility', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_check_eligibility' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Public: Submit a 30-day money-back guarantee return claim
		register_rest_route( 'exacoat-core/v1', '/guarantee/submit-claim', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_submit_claim' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Public: Update return shipment tracking (resi pengembalian)
		register_rest_route( 'exacoat-core/v1', '/guarantee/update-resi', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_update_resi' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Admin: Get guarantee claims log
		register_rest_route( 'exacoat-core/v1', '/guarantee/claims-log', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_claims_log' ],
				'permission_callback' => [ __CLASS__, 'admin_permission_check' ],
			],
		] );

		// Admin: Process guarantee action (mark received, approve refund, reject)
		register_rest_route( 'exacoat-core/v1', '/guarantee/action', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_process_action' ],
				'permission_callback' => [ __CLASS__, 'admin_permission_check' ],
			],
		] );
	}

	/**
	 * Admin Permission Check
	 */
	public static function admin_permission_check( $request ): bool {
		$auth_header = $request->get_header( 'Authorization' ) ?: ( $request->get_header( 'authorization' ) ?: '' );
		if ( ! empty( $auth_header ) && str_starts_with( $auth_header, 'Basic ' ) ) {
			$creds = base64_decode( substr( $auth_header, 6 ) );
			if ( $creds && strpos( $creds, ':' ) !== false ) {
				list( $user, $pass ) = explode( ':', $creds, 2 );
				$u = wp_authenticate( $user, $pass );
				if ( ! is_wp_error( $u ) && ( user_can( $u, 'manage_woocommerce' ) || user_can( $u, 'administrator' ) ) ) {
					return true;
				}
			}
		}

		if ( is_user_logged_in() && ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'administrator' ) ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Helper: Retrieve or resolve the order shipment timestamp
	 * Returns Unix timestamp or null if not yet shipped
	 */
	public static function get_order_shipped_timestamp( \WC_Order $order ): ?int {
		// 1. Direct meta: _shipped_at
		$shipped_meta = $order->get_meta( '_shipped_at' ) ?: get_post_meta( $order->get_id(), '_shipped_at', true );
		if ( ! empty( $shipped_meta ) ) {
			$ts = strtotime( $shipped_meta );
			if ( $ts > 0 ) {
				return $ts;
			}
		}

		// 2. Tracking info meta: _artmatter_tracking_info['shipped_at']
		$tracking_meta = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order->get_id(), '_artmatter_tracking_info', true );
		if ( is_array( $tracking_meta ) && ! empty( $tracking_meta['shipped_at'] ) ) {
			$ts = strtotime( $tracking_meta['shipped_at'] );
			if ( $ts > 0 ) {
				return $ts;
			}
		}

		// 3. Fallback: If status is shipped, completed, or delivered
		if ( $order->has_status( [ 'shipped', 'wc-shipped', 'completed', 'wc-completed', 'delivered', 'wc-delivered' ] ) ) {
			$date_completed = $order->get_date_completed();
			if ( $date_completed ) {
				return $date_completed->getTimestamp();
			}

			$date_modified = $order->get_date_modified();
			if ( $date_modified ) {
				return $date_modified->getTimestamp();
			}
		}

		return null;
	}

	/**
	 * Helper: Return standardized Return Hub Address structure
	 */
	public static function get_return_hub_details( string $order_number = '' ): array {
		$clean_num = trim( str_replace( '#', '', $order_number ) );
		$recipient = self::HUB_NAME . ( $clean_num ? " (Order #{$clean_num})" : '' );

		return [
			'name'           => $recipient,
			'address_line1'  => self::HUB_ADDRESS_1,
			'address_line2'  => self::HUB_ADDRESS_2,
			'city'           => self::HUB_CITY,
			'state'          => self::HUB_STATE,
			'postcode'       => self::HUB_POSTCODE,
			'country'        => self::HUB_COUNTRY,
			'phone'          => self::HUB_PHONE,
			'email'          => self::HUB_EMAIL,
			'formatted_text' => "{$recipient}\n" . self::HUB_ADDRESS_1 . "\n" . self::HUB_ADDRESS_2 . "\n" . self::HUB_CITY . ", " . self::HUB_STATE . " " . self::HUB_POSTCODE . "\n" . self::HUB_COUNTRY,
		];
	}

	/**
	 * REST Endpoint: Check 30-Day Guarantee Eligibility
	 */
	public static function rest_check_eligibility( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id_input = sanitize_text_field( $request->get_param( 'order_id' ) ?: ( $request->get_param( 'order_number' ) ?: '' ) );
		$email_input    = sanitize_email( $request->get_param( 'email' ) ?: '' );

		if ( empty( $order_id_input ) || empty( $email_input ) ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'message'  => 'Please enter both your Order ID and billing email address.',
			], 400 );
		}

		// Normalize order ID
		$clean_id = preg_replace( '/[^0-9]/', '', $order_id_input );
		if ( empty( $clean_id ) ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'message'  => 'Invalid Order ID format. Example: #14589.',
			], 400 );
		}

		$order = wc_get_order( (int) $clean_id );
		if ( ! $order ) {
			return new \WP_REST_Response( [
				'success'  => true,
				'eligible' => false,
				'status'   => 'not_found',
				'message'  => "Order #{$clean_id} was not found. Please verify your order number.",
			], 200 );
		}

		// Verify email match
		$order_email = strtolower( trim( $order->get_billing_email() ) );
		if ( $order_email !== strtolower( trim( $email_input ) ) ) {
			return new \WP_REST_Response( [
				'success'  => true,
				'eligible' => false,
				'status'   => 'email_mismatch',
				'message'  => 'The email entered does not match the billing email registered with this order.',
			], 200 );
		}

		// Status verification
		if ( $order->has_status( [ 'cancelled', 'failed', 'refunded' ] ) ) {
			return new \WP_REST_Response( [
				'success'  => true,
				'eligible' => false,
				'status'   => 'invalid_order_status',
				'message'  => "Order #{$order->get_order_number()} cannot be claimed because its current status is {$order->get_status()}.",
			], 200 );
		}

		// Prior claim verification
		$has_claim = $order->get_meta( '_has_guarantee_claim' );
		if ( 'yes' === $has_claim ) {
			$claim_status = $order->get_meta( '_guarantee_status' ) ?: 'pending_return';
			return new \WP_REST_Response( [
				'success'       => true,
				'eligible'      => false,
				'status'        => 'already_claimed',
				'claim_status'  => $claim_status,
				'message'       => "A 30-Day Money Back Guarantee request has already been submitted for Order #{$order->get_order_number()} (Current Status: {$claim_status}).",
			], 200 );
		}

		// Shipment timestamp verification: strictly counted from shipment date
		$shipped_timestamp = self::get_order_shipped_timestamp( $order );
		if ( ! $shipped_timestamp ) {
			return new \WP_REST_Response( [
				'success'      => true,
				'eligible'     => false,
				'status'       => 'not_shipped',
				'order_number' => $order->get_order_number(),
				'order_status' => $order->get_status(),
				'message'      => "Order #{$order->get_order_number()} has not been shipped yet. The 30-day guarantee period begins on the day your package is shipped by the courier.",
			], 200 );
		}

		// Calculate days since shipped
		$now_timestamp       = time();
		$seconds_since_ship = $now_timestamp - $shipped_timestamp;
		$days_since_shipped  = max( 0, (int) floor( $seconds_since_ship / 86400 ) );
		$days_remaining      = max( 0, self::GUARANTEE_WINDOW_DAYS - $days_since_shipped );
		$shipped_date_str    = date( 'F j, Y', $shipped_timestamp );

		if ( $days_since_shipped > self::GUARANTEE_WINDOW_DAYS ) {
			return new \WP_REST_Response( [
				'success'            => true,
				'eligible'           => false,
				'status'             => 'expired',
				'order_number'       => $order->get_order_number(),
				'shipped_at'         => $shipped_date_str,
				'days_since_shipped' => $days_since_shipped,
				'message'            => "Order #{$order->get_order_number()} was shipped on {$shipped_date_str} ({$days_since_shipped} days ago). The 30-day money-back guarantee period has expired.",
			], 200 );
		}

		// Line items eligibility check
		$eligible_items   = [];
		$ineligible_items = [];
		$eligible_total   = 0.0;

		foreach ( $order->get_items() as $item_id => $item ) {
			/** @var \WC_Order_Item_Product $item */
			$item_name  = $item->get_name();
			$lower_name = strtolower( $item_name );

			$is_excluded = false;
			foreach ( self::EXCLUDED_KEYWORDS as $keyword ) {
				if ( str_contains( $lower_name, $keyword ) ) {
					$is_excluded = true;
					break;
				}
			}

			$line_total = (float) $item->get_total();
			$quantity   = (int) $item->get_quantity();

			if ( $is_excluded ) {
				$ineligible_items[] = [
					'id'       => $item_id,
					'name'     => $item_name,
					'quantity' => $quantity,
					'reason'   => 'Excluded product variant (Screen Protector / Glass / DUSK Case).',
				];
			} else {
				$eligible_items[] = [
					'id'         => $item_id,
					'name'       => $item_name,
					'quantity'   => $quantity,
					'unit_price' => $quantity > 0 ? ( $line_total / $quantity ) : $line_total,
					'total'      => $line_total,
				];
				$eligible_total += $line_total;
			}
		}

		if ( empty( $eligible_items ) ) {
			return new \WP_REST_Response( [
				'success'          => true,
				'eligible'         => false,
				'status'           => 'no_eligible_items',
				'order_number'     => $order->get_order_number(),
				'shipped_at'       => $shipped_date_str,
				'ineligible_items' => $ineligible_items,
				'message'          => "None of the products in Order #{$order->get_order_number()} qualify for the 30-Day Money Back Guarantee.",
			], 200 );
		}

		// Currency & Payout calculations
		$currency = $order->get_currency();
		$currency_symbol = get_woocommerce_currency_symbol( $currency );

		// Payout options:
		// Option 1: 100% Store Credit
		$store_credit_amount = $eligible_total;
		// Option 2 & 3: 70% Bank Transfer / PayPal (30% restocking & administration fee)
		$cash_refund_amount  = round( $eligible_total * 0.70, 2 );

		return new \WP_REST_Response( [
			'success'            => true,
			'eligible'           => true,
			'order_id'           => $order->get_id(),
			'order_number'       => $order->get_order_number(),
			'shipped_at'         => $shipped_date_str,
			'shipped_timestamp'  => $shipped_timestamp,
			'days_since_shipped' => $days_since_shipped,
			'days_remaining'     => $days_remaining,
			'currency'           => $currency,
			'currency_symbol'    => $currency_symbol,
			'eligible_subtotal'  => $eligible_total,
			'eligible_items'     => $eligible_items,
			'ineligible_items'   => $ineligible_items,
			'refund_options'     => [
				[
					'key'         => 'store_credit',
					'name'        => 'Store Credit (100%)',
					'percentage'  => 100,
					'amount'      => $store_credit_amount,
					'amount_fmt'  => $currency_symbol . ' ' . number_format( $store_credit_amount, 0, ',', '.' ),
					'description' => '100% value credited to your Exacoat Account Wallet for future purchases.',
				],
				[
					'key'         => 'bank_transfer',
					'name'        => 'Bank Transfer (70%)',
					'percentage'  => 70,
					'amount'      => $cash_refund_amount,
					'amount_fmt'  => $currency_symbol . ' ' . number_format( $cash_refund_amount, 0, ',', '.' ),
					'description' => 'Transferred to your Indonesian bank account (30% administration & operational fee applied).',
				],
				[
					'key'         => 'paypal',
					'name'        => 'PayPal (70%)',
					'percentage'  => 70,
					'amount'      => $cash_refund_amount,
					'amount_fmt'  => $currency_symbol . ' ' . number_format( $cash_refund_amount, 0, ',', '.' ),
					'description' => 'Transferred to your PayPal account (30% administration & operational fee applied).',
				],
			],
			'return_hub'         => self::get_return_hub_details( $order->get_order_number() ),
			'packaging_rule'     => 'Items must be returned complete with all original retail packaging, wipes, and accessories to qualify for a refund.',
		], 200 );
	}

	/**
	 * REST Endpoint: Submit 30-Day Guarantee Return Claim
	 */
	public static function rest_submit_claim( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id_input = sanitize_text_field( $request->get_param( 'order_id' ) ?: '' );
		$email_input    = sanitize_email( $request->get_param( 'email' ) ?: '' );
		$refund_method  = sanitize_text_field( $request->get_param( 'refund_method' ) ?: 'store_credit' );
		$bank_name      = sanitize_text_field( $request->get_param( 'bank_name' ) ?: '' );
		$bank_acc_name  = sanitize_text_field( $request->get_param( 'bank_account_name' ) ?: '' );
		$bank_acc_num   = sanitize_text_field( $request->get_param( 'bank_account_number' ) ?: '' );
		$paypal_email   = sanitize_email( $request->get_param( 'paypal_email' ) ?: '' );
		$claim_reason   = sanitize_textarea_field( $request->get_param( 'reason' ) ?: '' );
		$return_courier = sanitize_text_field( $request->get_param( 'return_courier' ) ?: '' );
		$return_resi    = sanitize_text_field( $request->get_param( 'return_tracking_number' ) ?: '' );

		$clean_id = preg_replace( '/[^0-9]/', '', $order_id_input );
		$order    = wc_get_order( (int) $clean_id );
		if ( ! $order ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Order was not found.',
			], 404 );
		}

		if ( strtolower( trim( $order->get_billing_email() ) ) !== strtolower( trim( $email_input ) ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Email does not match order billing email.',
			], 403 );
		}

		if ( 'yes' === $order->get_meta( '_has_guarantee_claim' ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'A guarantee claim has already been submitted for this order.',
			], 400 );
		}

		// Calculate eligible amount
		$eligible_total = 0.0;
		$items_list     = [];
		foreach ( $order->get_items() as $item_id => $item ) {
			$name       = $item->get_name();
			$lower_name = strtolower( $name );
			$is_excl    = false;
			foreach ( self::EXCLUDED_KEYWORDS as $kw ) {
				if ( str_contains( $lower_name, $kw ) ) {
					$is_excl = true;
					break;
				}
			}
			if ( ! $is_excl ) {
				$eligible_total += (float) $item->get_total();
				$items_list[] = $name . ' (x' . $item->get_quantity() . ')';
			}
		}

		$is_store_credit = 'store_credit' === $refund_method;
		$percentage      = $is_store_credit ? 100 : 70;
		$refund_amount   = $is_store_credit ? $eligible_total : round( $eligible_total * 0.70, 2 );

		// Destination descriptor
		$destination_desc = '';
		if ( 'store_credit' === $refund_method ) {
			$destination_desc = 'Exacoat Account Wallet';
		} elseif ( 'bank_transfer' === $refund_method ) {
			$destination_desc = "{$bank_name} - {$bank_acc_num} ({$bank_acc_name})";
		} elseif ( 'paypal' === $refund_method ) {
			$destination_desc = "PayPal: {$paypal_email}";
		}

		$claim_data = [
			'submitted_at'          => current_time( 'mysql' ),
			'refund_method'         => $refund_method,
			'refund_percentage'     => $percentage,
			'refund_amount'         => $refund_amount,
			'currency'              => $order->get_currency(),
			'bank_name'             => $bank_name,
			'bank_account_name'     => $bank_acc_name,
			'bank_account_number'   => $bank_acc_num,
			'paypal_email'          => $paypal_email,
			'destination_desc'      => $destination_desc,
			'reason'                => $claim_reason,
			'return_courier'        => $return_courier,
			'return_tracking_number'=> $return_resi,
			'claimed_items'         => $items_list,
		];

		// Save metadata
		$order->update_meta_data( '_has_guarantee_claim', 'yes' );
		$order->update_meta_data( '_guarantee_status', 'pending_return' );
		$order->update_meta_data( '_guarantee_refund_method', $refund_method );
		$order->update_meta_data( '_guarantee_refund_amount', (string) $refund_amount );
		$order->update_meta_data( '_guarantee_destination', $destination_desc );
		$order->update_meta_data( '_guarantee_return_courier', $return_courier );
		$order->update_meta_data( '_guarantee_return_tracking', $return_resi );
		$order->update_meta_data( '_guarantee_claim_data', $claim_data );
		$order->save();

		// Traditional postmeta
		$order_id = $order->get_id();
		update_post_meta( $order_id, '_has_guarantee_claim', 'yes' );
		update_post_meta( $order_id, '_guarantee_status', 'pending_return' );
		update_post_meta( $order_id, '_guarantee_refund_method', $refund_method );
		update_post_meta( $order_id, '_guarantee_refund_amount', (string) $refund_amount );
		update_post_meta( $order_id, '_guarantee_destination', $destination_desc );
		update_post_meta( $order_id, '_guarantee_claim_data', $claim_data );

		// High visibility order note
		$currency_symbol = get_woocommerce_currency_symbol( $order->get_currency() );
		$amount_formatted = $currency_symbol . ' ' . number_format( $refund_amount, 0, ',', '.' );
		$note = sprintf(
			"🔄 [30-DAY GUARANTEE CLAIM] Customer submitted refund request.\nMethod: %s (%d%%)\nDestination: %s\nEst. Payout: %s\nAwaiting physical item return complete with original packaging at Ruby Commercial TB12.%s",
			ucwords( str_replace( '_', ' ', $refund_method ) ),
			$percentage,
			$destination_desc,
			$amount_formatted,
			! empty( $return_resi ) ? "\nCustomer Return Resi: {$return_courier} #{$return_resi}" : ''
		);
		$order->add_order_note( $note );

		return new \WP_REST_Response( [
			'success'            => true,
			'message'            => 'Return authorization created. Please send the goods complete with original packaging to Exacoat Returns Hub.',
			'order_number'       => $order->get_order_number(),
			'guarantee_status'   => 'pending_return',
			'refund_amount'      => $refund_amount,
			'refund_amount_fmt'  => $amount_formatted,
			'destination'        => $destination_desc,
			'return_hub'         => self::get_return_hub_details( $order->get_order_number() ),
		], 200 );
	}

	/**
	 * REST Endpoint: Update return tracking (resi)
	 */
	public static function rest_update_resi( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id_input = sanitize_text_field( $request->get_param( 'order_id' ) ?: '' );
		$email_input    = sanitize_email( $request->get_param( 'email' ) ?: '' );
		$courier        = sanitize_text_field( $request->get_param( 'return_courier' ) ?: '' );
		$resi           = sanitize_text_field( $request->get_param( 'return_tracking_number' ) ?: '' );

		$clean_id = preg_replace( '/[^0-9]/', '', $order_id_input );
		$order    = wc_get_order( (int) $clean_id );
		if ( ! $order ) {
			return new \WP_REST_Response( [ 'success' => false, 'message' => 'Order not found.' ], 404 );
		}

		if ( strtolower( trim( $order->get_billing_email() ) ) !== strtolower( trim( $email_input ) ) ) {
			return new \WP_REST_Response( [ 'success' => false, 'message' => 'Email mismatch.' ], 403 );
		}

		$order->update_meta_data( '_guarantee_return_courier', $courier );
		$order->update_meta_data( '_guarantee_return_tracking', $resi );
		$order->save();

		update_post_meta( $order->get_id(), '_guarantee_return_courier', $courier );
		update_post_meta( $order->get_id(), '_guarantee_return_tracking', $resi );

		$order->add_order_note( sprintf( '🚚 [30-DAY GUARANTEE] Customer updated return shipment tracking: %s #%s.', $courier ?: 'Courier', $resi ) );

		return new \WP_REST_Response( [
			'success' => true,
			'message' => 'Return tracking information saved successfully.',
		], 200 );
	}

	/**
	 * REST Endpoint: Admin Claims Log Feed
	 * Strictly returns orders that submitted the /money-back-guarantee form.
	 * Automatically expires pending return claims where the customer has not sent back the item within 30 days.
	 */
	public static function rest_get_claims_log( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;
		$status_filter = sanitize_text_field( $request->get_param( 'status' ) ?: 'all' );
		$search_query  = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
		$page          = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );
		$per_page      = max( 1, min( 100, (int) ( $request->get_param( 'per_page' ) ?: 20 ) ) );

		// 1. Gather all order IDs that explicitly have 30-day guarantee claim metadata
		$guarantee_order_ids = [];

		$guarantee_meta_keys = [
			'_guarantee_claim_status',
			'_guarantee_claimed_at',
			'_has_guarantee_claim',
			'_guarantee_payout_details',
			'_guarantee_returned_items',
		];
		$keys_sql = "'" . implode( "','", array_map( 'esc_sql', $guarantee_meta_keys ) ) . "'";

		$hpos_meta_table = "{$wpdb->prefix}wc_orders_meta";
		if ( $wpdb->get_var( "SHOW TABLES LIKE '{$hpos_meta_table}'" ) === $hpos_meta_table ) {
			$hpos_ids = $wpdb->get_col( "SELECT DISTINCT order_id FROM {$hpos_meta_table} WHERE (meta_key IN ({$keys_sql}) AND meta_value != '' AND meta_value != 'no') OR (meta_key = '_rma_order_type' AND meta_value = 'guarantee_return')" );
			if ( ! empty( $hpos_ids ) ) {
				$guarantee_order_ids = array_merge( $guarantee_order_ids, array_map( 'intval', $hpos_ids ) );
			}
		}

		$postmeta_ids = $wpdb->get_col( "SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE (meta_key IN ({$keys_sql}) AND meta_value != '' AND meta_value != 'no') OR (meta_key = '_rma_order_type' AND meta_value = 'guarantee_return')" );
		if ( ! empty( $postmeta_ids ) ) {
			$guarantee_order_ids = array_merge( $guarantee_order_ids, array_map( 'intval', $postmeta_ids ) );
		}

		$guarantee_order_ids = array_values( array_unique( array_filter( $guarantee_order_ids ) ) );

		// If no orders match the guarantee meta keys, return immediately with zeroed stats
		if ( empty( $guarantee_order_ids ) ) {
			return new \WP_REST_Response( [
				'success'    => true,
				'claims'     => [],
				'stats'      => [
					'total'            => 0,
					'pending_return'   => 0,
					'package_received' => 0,
					'refunded'         => 0,
					'rejected'         => 0,
					'expired'          => 0,
				],
				'pagination' => [
					'page'        => $page,
					'per_page'    => $per_page,
					'total_items' => 0,
					'total_pages' => 1,
				],
			], 200 );
		}

		// 2. Process all candidate guarantee orders and strictly verify them
		$all_verified_claims = [];
		$stats = [
			'total'            => 0,
			'pending_return'   => 0,
			'package_received' => 0,
			'refunded'         => 0,
			'rejected'         => 0,
			'expired'          => 0,
		];

		$now_ts = time();

		foreach ( $guarantee_order_ids as $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order || ! is_a( $order, 'WC_Order' ) ) {
				continue;
			}

			// Extract metadata
			$claim_status   = $order->get_meta( '_guarantee_claim_status' ) ?: ( $order->get_meta( '_guarantee_status' ) ?: '' );
			$claimed_at_raw = $order->get_meta( '_guarantee_claimed_at' ) ?: '';
			$rma_type       = $order->get_meta( '_rma_order_type' );
			$has_claim_flag = $order->get_meta( '_has_guarantee_claim' );
			$claim_data     = $order->get_meta( '_guarantee_claim_data' ) ?: [];
			$payout_details = $order->get_meta( '_guarantee_payout_details' ) ?: ( $order->get_meta( '_guarantee_destination' ) ?: ( $claim_data['destination_desc'] ?? '' ) );
			$refund_amount  = (float) (
				$order->get_meta( '_guarantee_total_refund' )
				?: ( $order->get_meta( '_guarantee_refund_amount' )
				?: ( $order->get_meta( '_guarantee_est_refund_store_credit' )
				?: ( $claim_data['refund_amount'] ?? 0 ) ) )
			);
			$reason         = $order->get_meta( '_guarantee_claim_reason' ) ?: ( $claim_data['reason'] ?? '' );
			$returned_meta  = $order->get_meta( '_guarantee_returned_items' );
			$claimed_items  = [];
			if ( ! empty( $returned_meta ) ) {
				$decoded = is_string( $returned_meta ) ? json_decode( $returned_meta, true ) : $returned_meta;
				if ( is_array( $decoded ) ) {
					$claimed_items = $decoded;
				}
			}
			if ( empty( $claimed_items ) && ! empty( $claim_data['claimed_items'] ) ) {
				$claimed_items = $claim_data['claimed_items'];
			}

			// Strict verification:
			// Must have at least one genuine guarantee field indicating a submission from /money-back-guarantee
			$is_genuine_claim = (
				! empty( $claimed_at_raw ) ||
				'guarantee_return' === $rma_type ||
				'yes' === $has_claim_flag ||
				! empty( $payout_details ) ||
				! empty( $claimed_items ) ||
				( ! empty( $reason ) && ! empty( $claim_status ) ) ||
				( $refund_amount > 0 && ! empty( $claim_status ) )
			);

			if ( ! $is_genuine_claim ) {
				continue;
			}

			// Calculate submission timestamp
			$claimed_ts = 0;
			if ( ! empty( $claimed_at_raw ) ) {
				$claimed_ts = strtotime( $claimed_at_raw );
			} elseif ( ! empty( $claim_data['submitted_at'] ) ) {
				$claimed_ts = strtotime( $claim_data['submitted_at'] );
			} elseif ( 'yes' === $has_claim_flag && $order->get_date_created() ) {
				$claimed_ts = $order->get_date_created()->getTimestamp();
			}

			$days_since_claim = $claimed_ts > 0 ? max( 0, (int) floor( ( $now_ts - $claimed_ts ) / 86400 ) ) : 0;

			// Resolve claim status
			if ( empty( $claim_status ) ) {
				$claim_status = 'pending_return';
			}

			// AUTO-REMOVE / AUTO-EXPIRE OVERDUE CLAIMS:
			// If customer submitted the return form but hasn't sent back the item within 30 days:
			if ( 'pending_return' === $claim_status && $claimed_ts > 0 && $days_since_claim > 30 ) {
				$claim_status = 'expired';
				$order->update_meta_data( '_guarantee_claim_status', 'expired' );
				$order->update_meta_data( '_guarantee_status', 'expired' );
				$order->update_meta_data( '_guarantee_expired_at', current_time( 'mysql' ) );
				$order->save();
				update_post_meta( $order->get_id(), '_guarantee_claim_status', 'expired' );
				update_post_meta( $order->get_id(), '_guarantee_status', 'expired' );

				$order->add_order_note( sprintf(
					"⏰ [30-DAY GUARANTEE AUTO-EXPIRED] Return authorization expired automatically. Customer filed claim %d days ago (%s) but did not return the item within 30 days.",
					$days_since_claim,
					$claimed_at_raw ? date( 'M j, Y', $claimed_ts ) : '30+ days ago'
				) );
			}

			// Tally stats across verified claims
			$stats['total']++;
			if ( isset( $stats[ $claim_status ] ) ) {
				$stats[ $claim_status ]++;
			} else {
				$stats['pending_return']++;
			}

			// Filter check
			if ( ! empty( $status_filter ) && 'all' !== $status_filter && $claim_status !== $status_filter ) {
				continue;
			}

			// Search query check
			if ( ! empty( $search_query ) ) {
				$sq = strtolower( trim( $search_query ) );
				$order_num = strtolower( (string) $order->get_order_number() );
				$cust_name = strtolower( (string) $order->get_formatted_billing_full_name() );
				$cust_mail = strtolower( (string) $order->get_billing_email() );
				$ret_resi  = strtolower( (string) ( $order->get_meta( '_guarantee_return_tracking' ) ?: ( $claim_data['return_tracking_number'] ?? '' ) ) );

				$matches = (
					str_contains( $order_num, str_replace( '#', '', $sq ) ) ||
					str_contains( $cust_name, $sq ) ||
					str_contains( $cust_mail, $sq ) ||
					str_contains( $ret_resi, $sq )
				);

				if ( ! $matches ) {
					continue;
				}
			}

			$shipped_ts   = self::get_order_shipped_timestamp( $order );
			$currency_sym = get_woocommerce_currency_symbol( $order->get_currency() );

			$all_verified_claims[] = [
				'order_id'                 => $order->get_id(),
				'order_number'             => $order->get_order_number(),
				'order_status'             => $order->get_status(),
				'customer_name'            => $order->get_formatted_billing_full_name() ?: 'Customer',
				'customer_email'           => $order->get_billing_email(),
				'customer_phone'           => $order->get_billing_phone(),
				'shipped_at'               => $shipped_ts ? date( 'M j, Y', $shipped_ts ) : 'Unknown',
				'days_since_shipped'       => $shipped_ts ? max( 0, (int) floor( ( $now_ts - $shipped_ts ) / 86400 ) ) : 0,
				'guarantee_status'         => $claim_status,
				'refund_method'            => $order->get_meta( '_guarantee_refund_method' ) ?: ( $claim_data['refund_method'] ?? 'store_credit' ),
				'refund_amount'            => $refund_amount,
				'refund_amount_fmt'        => $currency_sym . ' ' . number_format( $refund_amount, 0, ',', '.' ),
				'refund_destination'       => $payout_details,
				'return_courier'           => $order->get_meta( '_guarantee_return_courier' ) ?: ( $claim_data['return_courier'] ?? '' ),
				'return_tracking_number'   => $order->get_meta( '_guarantee_return_tracking' ) ?: ( $claim_data['return_tracking_number'] ?? '' ),
				'submitted_at'             => $claimed_at_raw ?: ( $claimed_ts ? date( 'Y-m-d H:i:s', $claimed_ts ) : '' ),
				'days_since_claim'         => $days_since_claim,
				'days_remaining_to_return' => max( 0, 30 - $days_since_claim ),
				'is_expired'               => 'expired' === $claim_status || $days_since_claim > 30,
				'reason'                   => $reason,
				'claimed_items'            => $claimed_items,
				'created_ts'               => $claimed_ts ?: ( $order->get_date_created() ? $order->get_date_created()->getTimestamp() : 0 ),
			];
		}

		// Sort claims by submission timestamp descending
		usort( $all_verified_claims, function( $a, $b ) {
			return ( $b['created_ts'] ?? 0 ) <=> ( $a['created_ts'] ?? 0 );
		} );

		$total_filtered = count( $all_verified_claims );
		$total_pages    = max( 1, (int) ceil( $total_filtered / $per_page ) );
		$offset         = ( $page - 1 ) * $per_page;
		$paged_claims   = array_slice( $all_verified_claims, $offset, $per_page );

		return new \WP_REST_Response( [
			'success'    => true,
			'claims'     => $paged_claims,
			'stats'      => $stats,
			'pagination' => [
				'page'        => $page,
				'per_page'    => $per_page,
				'total_items' => $total_filtered,
				'total_pages' => $total_pages,
			],
		], 200 );
	}

	/**
	 * REST Endpoint: Admin Guarantee Action
	 * - mark_received: Package received & inspected at Ruby Commercial TB12
	 * - approve_refund: Approve refund, set status refunded, and dispatch light-theme refund email
	 * - reject: Reject claim with notes
	 * - expire: Expire return authorization
	 * - auto_expire_overdue: Sweep all pending claims older than 30 days
	 */
	public static function rest_process_action( \WP_REST_Request $request ): \WP_REST_Response {
		$action   = sanitize_text_field( $request->get_param( 'action' ) ?: '' );
		$order_id = (int) $request->get_param( 'order_id' );
		$notes    = sanitize_textarea_field( $request->get_param( 'notes' ) ?: '' );

		if ( empty( $action ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Missing action parameter.',
			], 400 );
		}

		// Batch sweep action for auto-expiring overdue claims
		if ( 'auto_expire_overdue' === $action ) {
			global $wpdb;
			$hpos_meta_table = "{$wpdb->prefix}wc_orders_meta";
			$candidate_ids = [];

			if ( $wpdb->get_var( "SHOW TABLES LIKE '{$hpos_meta_table}'" ) === $hpos_meta_table ) {
				$ids = $wpdb->get_col( "SELECT DISTINCT order_id FROM {$hpos_meta_table} WHERE meta_key IN ('_guarantee_claim_status', '_guarantee_status') AND meta_value = 'pending_return'" );
				if ( ! empty( $ids ) ) {
					$candidate_ids = array_merge( $candidate_ids, array_map( 'intval', $ids ) );
				}
			}

			$post_ids = $wpdb->get_col( "SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE meta_key IN ('_guarantee_claim_status', '_guarantee_status') AND meta_value = 'pending_return'" );
			if ( ! empty( $post_ids ) ) {
				$candidate_ids = array_merge( $candidate_ids, array_map( 'intval', $post_ids ) );
			}

			$candidate_ids = array_values( array_unique( array_filter( $candidate_ids ) ) );
			$now_ts = time();
			$expired_count = 0;

			foreach ( $candidate_ids as $cid ) {
				$c_order = wc_get_order( $cid );
				if ( ! $c_order ) continue;

				$c_raw = $c_order->get_meta( '_guarantee_claimed_at' );
				$c_ts  = $c_raw ? strtotime( $c_raw ) : ( $c_order->get_date_created() ? $c_order->get_date_created()->getTimestamp() : 0 );
				$days  = $c_ts ? max( 0, (int) floor( ( $now_ts - $c_ts ) / 86400 ) ) : 0;

				if ( $days > 30 ) {
					$c_order->update_meta_data( '_guarantee_claim_status', 'expired' );
					$c_order->update_meta_data( '_guarantee_status', 'expired' );
					$c_order->update_meta_data( '_guarantee_expired_at', current_time( 'mysql' ) );
					$c_order->save();
					update_post_meta( $cid, '_guarantee_claim_status', 'expired' );
					update_post_meta( $cid, '_guarantee_status', 'expired' );

					$c_order->add_order_note( sprintf(
						"⏰ [30-DAY GUARANTEE AUTO-EXPIRED] Claim submitted %d days ago expired. Package was not returned within 30 days.",
						$days
					) );
					$expired_count++;
				}
			}

			return new \WP_REST_Response( [
				'success'       => true,
				'expired_count' => $expired_count,
				'message'       => sprintf( 'Swept overdue claims: %d return request(s) auto-expired.', $expired_count ),
			], 200 );
		}

		if ( ! $order_id ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Missing order ID.',
			], 400 );
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Order was not found.',
			], 404 );
		}

		$currency_sym  = get_woocommerce_currency_symbol( $order->get_currency() );
		$refund_amount = (float) (
			$order->get_meta( '_guarantee_total_refund' )
			?: ( $order->get_meta( '_guarantee_refund_amount' )
			?: ( $order->get_meta( '_guarantee_est_refund_store_credit' ) ?: 0 ) )
		);
		$method        = $order->get_meta( '_guarantee_refund_method' ) ?: 'store_credit';
		$destination   = $order->get_meta( '_guarantee_payout_details' ) ?: ( $order->get_meta( '_guarantee_destination' ) ?: '' );

		if ( 'mark_received' === $action ) {
			$order->update_meta_data( '_guarantee_status', 'package_received' );
			$order->update_meta_data( '_guarantee_claim_status', 'package_received' );
			$order->update_meta_data( '_guarantee_received_at', current_time( 'mysql' ) );
			$order->save();
			update_post_meta( $order_id, '_guarantee_status', 'package_received' );
			update_post_meta( $order_id, '_guarantee_claim_status', 'package_received' );

			$note = sprintf(
				"📦 [30-DAY GUARANTEE] Return package received and inspected at Ruby Commercial TB12.%s",
				! empty( $notes ) ? "\nInspector Notes: {$notes}" : ''
			);
			$order->add_order_note( $note );

			return new \WP_REST_Response( [
				'success' => true,
				'status'  => 'package_received',
				'message' => 'Package marked as received at Ruby Commercial TB12.',
			], 200 );
		}

		if ( 'approve_refund' === $action ) {
			$order->update_meta_data( '_guarantee_status', 'refunded' );
			$order->update_meta_data( '_guarantee_claim_status', 'refunded' );
			$order->update_meta_data( '_guarantee_refunded_at', current_time( 'mysql' ) );
			if ( ! empty( $notes ) ) {
				$order->update_meta_data( '_guarantee_admin_notes', $notes );
			}
			$order->save();

			update_post_meta( $order_id, '_guarantee_status', 'refunded' );
			update_post_meta( $order_id, '_guarantee_claim_status', 'refunded' );
			update_post_meta( $order_id, '_guarantee_refunded_at', current_time( 'mysql' ) );

			// Update WooCommerce status to refunded
			$order->update_status( 'refunded', sprintf(
				'30-Day Money Back Guarantee refund paid (%s %s via %s - %s).',
				$currency_sym,
				number_format( $refund_amount, 0, ',', '.' ),
				ucwords( str_replace( '_', ' ', $method ) ),
				$destination
			) );

			$amount_fmt = $currency_sym . ' ' . number_format( $refund_amount, 0, ',', '.' );

			// Dispatch light-theme refund email via Exacoat Email Engine
			$email_dispatched = false;
			if ( class_exists( 'Exacoat_Email_Engine' ) || class_exists( 'Artmatter_Email_Engine' ) ) {
				$email_class = class_exists( 'Exacoat_Email_Engine' ) ? 'Exacoat_Email_Engine' : 'Artmatter_Email_Engine';
				$cust_email  = $order->get_billing_email();
				$cust_name   = $order->get_formatted_billing_full_name() ?: 'Customer';

				if ( is_email( $cust_email ) ) {
					$method_label = 'store_credit' === $method 
						? 'Store Credit (Account Wallet)' 
						: ( 'bank_transfer' === $method ? 'Bank Transfer' : 'PayPal' );

					$payload = [
						'order_number'        => $order->get_order_number(),
						'customer_first_name' => $order->get_billing_first_name() ?: 'Customer',
						'refund_amount'       => $amount_fmt,
						'total_refunded'      => $amount_fmt,
						'badge_text'          => 'Refund Processed',
						'title'               => '30-Day Guarantee Refund Processed',
						'body_primary'        => "We have approved and issued your refund of {$amount_fmt} for order #{$order->get_order_number()} under our 30-Day Money Back Guarantee.",
						'body_secondary'      => "Your returned goods and original packaging have been verified at our Returns Hub (Ruby Commercial TB12). Payout destination: {$method_label} - {$destination}.",
						'customer_note'       => "Return verified at Ruby Commercial TB12. Funds will reflect within 1 to 3 business days for bank transfers, or instantly in your store credit wallet.",
					];

					if ( class_exists( 'Artmatter_Order_Manager' ) ) {
						$payload = Artmatter_Order_Manager::get_email_order_payload( $order, $payload );
					}

					$send_res = call_user_func( [ $email_class, 'send_email' ], 'customer_order_refunded', $cust_email, $cust_name, $payload );
					$email_dispatched = ! empty( $send_res['success'] );
				}
			}

			$order->add_order_note( sprintf(
				"✅ [30-DAY GUARANTEE REFUND COMPLETED] Approved and issued: %s via %s (%s).%s%s",
				$amount_fmt,
				ucwords( str_replace( '_', ' ', $method ) ),
				$destination,
				$email_dispatched ? "\nDispatched light-themed refund confirmation email to customer." : '',
				! empty( $notes ) ? "\nAdmin Notes: {$notes}" : ''
			) );

			return new \WP_REST_Response( [
				'success'          => true,
				'status'           => 'refunded',
				'refund_amount'    => $amount_fmt,
				'email_dispatched' => $email_dispatched,
				'message'          => "Refund approved and marked as paid ({$amount_fmt}). Customer email dispatched.",
			], 200 );
		}

		if ( 'reject' === $action ) {
			$order->update_meta_data( '_guarantee_status', 'rejected' );
			$order->update_meta_data( '_guarantee_claim_status', 'rejected' );
			$order->update_meta_data( '_guarantee_admin_notes', $notes );
			$order->save();

			update_post_meta( $order_id, '_guarantee_status', 'rejected' );
			update_post_meta( $order_id, '_guarantee_claim_status', 'rejected' );

			$order->add_order_note( sprintf(
				"❌ [30-DAY GUARANTEE REJECTED] Claim was rejected.%s",
				! empty( $notes ) ? "\nReason: {$notes}" : ''
			) );

			return new \WP_REST_Response( [
				'success' => true,
				'status'  => 'rejected',
				'message' => 'Guarantee claim marked as rejected.',
			], 200 );
		}

		if ( 'expire' === $action ) {
			$order->update_meta_data( '_guarantee_status', 'expired' );
			$order->update_meta_data( '_guarantee_claim_status', 'expired' );
			$order->update_meta_data( '_guarantee_expired_at', current_time( 'mysql' ) );
			if ( ! empty( $notes ) ) {
				$order->update_meta_data( '_guarantee_admin_notes', $notes );
			}
			$order->save();

			update_post_meta( $order_id, '_guarantee_status', 'expired' );
			update_post_meta( $order_id, '_guarantee_claim_status', 'expired' );

			$order->add_order_note( sprintf(
				"⏰ [30-DAY GUARANTEE EXPIRED] Customer return authorization was closed/expired.%s",
				! empty( $notes ) ? "\nAdmin Notes: {$notes}" : ''
			) );

			return new \WP_REST_Response( [
				'success' => true,
				'status'  => 'expired',
				'message' => 'Guarantee return authorization marked as expired.',
			], 200 );
		}

		return new \WP_REST_Response( [
			'success' => false,
			'message' => 'Unrecognized guarantee action.',
		], 400 );
	}
}

} // End class_exists
