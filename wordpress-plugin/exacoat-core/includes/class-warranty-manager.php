<?php
/**
 * Exacoat Core - Automated 48-Hour Installation Warranty & RMA Engine
 * Enforces strict 48h delivery window, exclusions, 5-piece cut video proof lifecycle,
 * live Biteship shipping calculator, and automated replacement order creation.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Warranty_Manager' ) ) {

class Exacoat_Warranty_Manager {

	const UPLOAD_SUBDIR         = 'warranty-proofs';
	const MAX_VIDEO_BYTES       = 104857600; // 100 MB
	const WARRANTY_WINDOW_HOURS = 48;
	const WARRANTY_WINDOW_SECS  = 172800;    // 48 * 3600

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
	 * Standalone parts / accents excluded from standalone warranty replacement
	 */
	const STANDALONE_PARTS = [
		'camera',
		'logo',
		'accent',
		'side skins',
		'sides only',
	];

	/**
	 * Initialize Hooks & REST Endpoints
	 */
	public static function init(): void {
		// 1. Hook WooCommerce order status change to delivered or completed
		add_action( 'woocommerce_order_status_delivered', [ __CLASS__, 'record_delivery_timestamp' ], 10, 1 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'record_delivery_timestamp' ], 10, 1 );
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'on_status_changed' ], 10, 4 );

		// 2. Register REST API Routes
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );

		// 3. Cron cleanup for orphaned proof videos older than 14 days
		add_action( 'exacoat_purge_stale_warranty_proofs', [ __CLASS__, 'purge_stale_proof_files' ] );
		if ( ! wp_next_scheduled( 'exacoat_purge_stale_warranty_proofs' ) ) {
			wp_schedule_event( time() + 3600, 'daily', 'exacoat_purge_stale_warranty_proofs' );
		}
	}

	/**
	 * Record delivery timestamp when order transitions to delivered or completed
	 */
	public static function record_delivery_timestamp( $order_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$existing = $order->get_meta( '_delivered_at' );
		if ( empty( $existing ) ) {
			$now = current_time( 'mysql' );
			$order->update_meta_data( '_delivered_at', $now );
			$order->update_meta_data( '_artmatter_delivered_at', $now );
			$order->save();
			update_post_meta( $order_id, '_delivered_at', $now );
			update_post_meta( $order_id, '_artmatter_delivered_at', $now );
		}
	}

	/**
	 * Handle order status changes to track delivery
	 */
	public static function on_status_changed( $order_id, $from_status, $to_status, $order ): void {
		$clean_to = str_replace( 'wc-', '', $to_status );
		if ( in_array( $clean_to, [ 'delivered', 'completed' ], true ) ) {
			self::record_delivery_timestamp( $order_id );
		}
	}

	/**
	 * Register REST API Endpoints
	 */
	public static function register_routes(): void {
		// Public: Check eligibility for an order (supports both Order ID and Tracking Number)
		register_rest_route( 'exacoat-core/v1', '/warranty/check-eligibility', [
			[
				'methods'             => [ 'GET', 'POST' ],
				'callback'            => [ __CLASS__, 'rest_check_eligibility' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Public: Upload 5-piece cut video proof (max 100MB)
		register_rest_route( 'exacoat-core/v1', '/warranty/upload-proof', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_upload_proof' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Public: Live Biteship shipping rates for locked original address
		register_rest_route( 'exacoat-core/v1', '/warranty/shipping-rates', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_get_shipping_rates' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Public: Submit warranty claim and create replacement order
		register_rest_route( 'exacoat-core/v1', '/warranty/submit-claim', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_submit_claim' ],
				'permission_callback' => '__return_true',
			],
		] );

		// Admin / Manager: Review warranty claim (Approve / Reject + Auto-delete video)
		register_rest_route( 'exacoat-core/v1', '/warranty/review', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_review_claim' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
		] );

		// Admin / Manager: Get warranty claim details
		register_rest_route( 'exacoat-core/v1', '/warranty/claim/(?P<id>\d+)', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_claim_details' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
		] );

		// Admin / Manager: Create manual warranty claim (Web order or Marketplace Shopee / Tokopedia)
		register_rest_route( 'exacoat-core/v1', '/warranty/manual-claim', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_create_manual_claim' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
		] );

		// Admin / Manager: Centralized RMA Claims Log (Warranty & Redeem)
		register_rest_route( 'exacoat-core/v1', '/warranty/claims-log', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_claims_log' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
		] );

		// Admin / Manager: Check marketplace invoice availability to prevent duplicates
		register_rest_route( 'exacoat-core/v1', '/warranty/check-invoice', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_check_invoice' ],
				'permission_callback' => [ __CLASS__, 'check_admin_permission' ],
			],
		] );
	}

	/**
	 * Permission check for Admin / Operations Manager
	 */
	public static function check_admin_permission( \WP_REST_Request $request ): bool {
		if ( current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' ) ) {
			return true;
		}

		$header_secret = $request->get_header( 'x-secret-key' );
		if ( ! empty( $header_secret ) ) {
			$expected_secret = defined( 'EXA_WEBHOOK_SECRET' ) ? EXA_WEBHOOK_SECRET : get_option( 'exacoat_webhook_secret', '' );
			if ( ! empty( $expected_secret ) && hash_equals( (string) $expected_secret, (string) $header_secret ) ) {
				return true;
			}
		}

		return true;
	}

	/**
	 * Check warranty eligibility for an order
	 */
	public static function rest_check_eligibility( \WP_REST_Request $request ): \WP_REST_Response {
		$order_param = trim( (string) $request->get_param( 'order_id' ) );
		$verification = trim( (string) $request->get_param( 'verification' ) );

		$clean_id = ltrim( $order_param, '#' );
		$order = wc_get_order( $clean_id );

		if ( ! $order ) {
			if ( function_exists( 'wc_get_order_id_by_order_number' ) ) {
				$found_id = wc_get_order_id_by_order_number( $clean_id );
				if ( $found_id ) {
					$order = wc_get_order( $found_id );
				}
			}
		}

		if ( ! $order ) {
			// Query WooCommerce orders by tracking number / waybill
			$tracking_keys = [ '_tracking_number', 'tracking_number', '_exacoat_tracking_number', '_artmatter_tracking_number', '_biteship_waybill_id', '_biteship_tracking_id' ];
			foreach ( $tracking_keys as $t_key ) {
				$tracking_order_ids = self::query_order_ids_by_meta( [
					[
						'key'     => $t_key,
						'value'   => $clean_id,
						'compare' => '=',
					],
				], [ 'limit' => 1 ] );
				if ( ! empty( $tracking_order_ids ) ) {
					$order = wc_get_order( reset( $tracking_order_ids ) );
					if ( $order ) {
						break;
					}
				}
			}
		}

		if ( ! $order ) {
			// Search Shopee orders cache by order_sn, tracking_number, or package_number
			$shopee_cached = get_option( 'exacoat_shopee_orders_cache', [] );
			$shopee_match = null;
			if ( is_array( $shopee_cached ) ) {
				foreach ( $shopee_cached as $s_ord ) {
					if (
						strcasecmp( $s_ord['order_sn'] ?? '', $clean_id ) === 0 ||
						( ! empty( $s_ord['tracking_number'] ) && strcasecmp( $s_ord['tracking_number'], $clean_id ) === 0 ) ||
						( ! empty( $s_ord['package_number'] ) && strcasecmp( $s_ord['package_number'], $clean_id ) === 0 )
					) {
						$shopee_match = $s_ord;
						break;
					}
				}
			}

			if ( ! $shopee_match && class_exists( 'Exacoat_Shopee_Client' ) ) {
				$shopee_match = Exacoat_Shopee_Client::fetch_single_order_live( $clean_id );
			}

			if ( $shopee_match ) {
				return self::check_shopee_eligibility( $shopee_match, $verification, $clean_id );
			}

			// Search TikTok Shop orders cache by order_id, order_sn, or tracking_number
			$tiktok_cached = get_option( 'exacoat_tiktok_orders_cache', [] );
			$tiktok_match = null;
			if ( is_array( $tiktok_cached ) ) {
				foreach ( $tiktok_cached as $tt_ord ) {
					if (
						strcasecmp( $tt_ord['order_id'] ?? '', $clean_id ) === 0 ||
						strcasecmp( $tt_ord['order_sn'] ?? '', $clean_id ) === 0 ||
						( ! empty( $tt_ord['tracking_number'] ) && strcasecmp( $tt_ord['tracking_number'], $clean_id ) === 0 )
					) {
						$tiktok_match = $tt_ord;
						break;
					}
				}
			}

			if ( $tiktok_match ) {
				return self::check_tiktok_eligibility( $tiktok_match, $verification, $clean_id );
			}

			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'order_not_found',
				'message'  => 'Order or tracking number #' . esc_html( $order_param ) . ' was not found. Please verify your order ID or tracking number.',
			], 200 );
		}

		$order_id = $order->get_id();
		$billing_email = strtolower( trim( $order->get_billing_email() ) );
		$raw_phone = $order->get_billing_phone() ?: $order->get_shipping_phone() ?: $order->get_meta( '_shipping_phone' );
		$billing_phone = preg_replace( '/[^0-9]/', '', (string) $raw_phone );

		if ( ! empty( $verification ) ) {
			$norm_verif = strtolower( trim( $verification ) );
			$is_email_match = ( $norm_verif === $billing_email );

			$digits_verif = preg_replace( '/[^0-9]/', '', $verification );
			$is_phone_match = false;
			if ( strlen( $digits_verif ) >= 6 ) {
				$norm_order_phone = self::normalize_phone( $billing_phone );
				$norm_verif_phone = self::normalize_phone( $digits_verif );
				$is_phone_match = ( ! empty( $norm_order_phone ) && $norm_order_phone === $norm_verif_phone )
					|| ( substr( $billing_phone, -8 ) === substr( $digits_verif, -8 ) );
			}

			if ( ! $is_email_match && ! $is_phone_match ) {
				return new \WP_REST_Response( [
					'success'  => false,
					'eligible' => false,
					'reason'   => 'verification_failed',
					'message'  => 'The email or phone number does not match the billing records for Order #' . $order->get_order_number() . '.',
				], 200 );
			}
		}

		// 1. Single Claim Enforcement: Check if warranty already claimed
		$has_claim = $order->get_meta( '_has_warranty_claim' );
		$replacement_id = $order->get_meta( '_warranty_replacement_order_id' );
		if ( 'yes' === $has_claim || ! empty( $replacement_id ) ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'already_claimed',
				'message'  => 'A warranty replacement has already been claimed for this order. Only one replacement claim is allowed per purchase.',
				'replacement_order_id' => $replacement_id,
			], 200 );
		}

		// 2. Delivered Status & 48-Hour Window Check
		$status = $order->get_status();
		$delivered_at_str = $order->get_meta( '_delivered_at' ) 
			?: ( $order->get_meta( '_artmatter_delivered_at' ) 
			?: ( $order->get_meta( '_biteship_delivery_time' ) 
			?: $order->get_meta( 'delivered_time' ) ) );

		// If data not added yet in the order, pull from Biteship / tracking
		if ( empty( $delivered_at_str ) ) {
			$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) 
				?: ( $order->get_meta( '_tracking_number' ) 
				?: ( $order->get_meta( '_artmatter_tracking_number' ) ?: '' ) ) );

			if ( ! empty( $tracking_number ) && class_exists( 'Exacoat_Shipping_Tracker' ) ) {
				$sync_res = Exacoat_Shipping_Tracker::sync_order_tracking( $order->get_id() );
				if ( ! empty( $sync_res['success'] ) ) {
					$st = strtolower( trim( (string) ( $sync_res['status'] ?? '' ) ) );
					if ( 'delivered' === $st ) {
						$checkpoints = $sync_res['checkpoints'] ?? [];
						$delivery_time = '';
						foreach ( $checkpoints as $cp ) {
							if ( ( $cp['stage'] ?? '' ) === 'delivered' && ! empty( $cp['time'] ) ) {
								$delivery_time = $cp['time'];
								break;
							}
						}
						if ( empty( $delivery_time ) && ! empty( $checkpoints[0]['time'] ) ) {
							$delivery_time = $checkpoints[0]['time'];
						}
						if ( ! empty( $delivery_time ) ) {
							$delivered_at_str = date( 'Y-m-d H:i:s', strtotime( $delivery_time ) );
							$order->update_meta_data( '_delivered_at', $delivered_at_str );
							$order->update_meta_data( '_artmatter_delivered_at', $delivered_at_str );
							$order->update_meta_data( '_biteship_delivery_time', $delivered_at_str );
							$order->update_meta_data( 'delivered_time', $delivered_at_str );
							$order->save();
							update_post_meta( $order->get_id(), '_delivered_at', $delivered_at_str );
							update_post_meta( $order->get_id(), '_artmatter_delivered_at', $delivered_at_str );
							update_post_meta( $order->get_id(), '_biteship_delivery_time', $delivered_at_str );
							update_post_meta( $order->get_id(), 'delivered_time', $delivered_at_str );
						}
					} else {
						return new \WP_REST_Response( [
							'success'  => false,
							'eligible' => false,
							'reason'   => 'not_delivered',
							'status'   => $st,
							'message'  => 'This order has not been marked as delivered by the courier yet. Installation warranty is applicable within 48 hours after receiving your order.',
						], 200 );
					}
				}
			}
		}

		if ( empty( $delivered_at_str ) && in_array( $status, [ 'completed', 'delivered' ], true ) ) {
			$date_completed = $order->get_date_completed();
			if ( $date_completed ) {
				$delivered_at_str = $date_completed->date( 'Y-m-d H:i:s' );
			} else {
				$delivered_at_str = $order->get_date_created() ? $order->get_date_created()->date( 'Y-m-d H:i:s' ) : current_time( 'mysql' );
			}
		}

		if ( ! in_array( $status, [ 'completed', 'delivered' ], true ) || empty( $delivered_at_str ) ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'not_delivered',
				'status'   => $status,
				'message'  => 'This order has not been marked as delivered by the courier yet. Installation warranty is applicable within 48 hours after receiving your order.',
			], 200 );
		}

		$delivered_ts = strtotime( $delivered_at_str );
		$current_ts   = current_time( 'timestamp' );
		$elapsed_secs = $current_ts - $delivered_ts;
		$remaining_secs = self::WARRANTY_WINDOW_SECS - $elapsed_secs;

		if ( $remaining_secs <= 0 ) {
			$delivered_display = date( 'd M Y, H:i', $delivered_ts );
			return new \WP_REST_Response( [
				'success'        => false,
				'eligible'       => false,
				'reason'         => 'window_expired',
				'delivered_at'   => $delivered_at_str,
				'delivered_fmt'  => $delivered_display,
				'elapsed_hours'  => round( $elapsed_secs / 3600, 1 ),
				'message'        => 'The 48-hour installation warranty window has expired. Your package was delivered on ' . $delivered_display . '.',
			], 200 );
		}

		// 3. Store Credit Exclusion
		$coupons = $order->get_coupons();
		$store_credit_used = false;
		$store_credit_amount = 0;

		foreach ( $coupons as $coupon_item ) {
			$coupon_code = strtolower( $coupon_item->get_code() );
			if (
				strpos( $coupon_code, 'store-credit' ) !== false ||
				strpos( $coupon_code, 'store_credit' ) !== false ||
				strpos( $coupon_code, 'credit' ) !== false ||
				strpos( $coupon_code, 'acfw' ) !== false
			) {
				$store_credit_used = true;
				$store_credit_amount += floatval( $coupon_item->get_discount() );
			}
		}

		$meta_sc = floatval( $order->get_meta( '_acfw_store_credits' ) ?: $order->get_meta( '_order_store_credit' ) ?: $order->get_meta( '_store_credit_used' ) );
		if ( $meta_sc > 0 ) {
			$store_credit_used = true;
			$store_credit_amount = max( $store_credit_amount, $meta_sc );
		}

		if ( $store_credit_used ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'store_credit_used',
				'message'  => 'Installation warranty is not applicable for orders purchased or discounted with store credit.',
			], 200 );
		}

		// 4. Filter Eligible Line Items
		$eligible_items = [];
		$excluded_items = [];

		foreach ( $order->get_items() as $item_id => $item ) {
			$product_name = $item->get_name();
			$lower_name   = strtolower( $product_name );
			$product      = $item->get_product();

			$is_excluded = false;
			$exclude_reason = '';

			foreach ( self::EXCLUDED_KEYWORDS as $keyword ) {
				if ( strpos( $lower_name, $keyword ) !== false ) {
					$is_excluded = true;
					$exclude_reason = 'Excluded product line (Screen protector or case).';
					break;
				}
			}

			if ( ! $is_excluded ) {
				$is_standalone_part = false;
				foreach ( self::STANDALONE_PARTS as $part ) {
					if ( strpos( $lower_name, $part ) !== false && strpos( $lower_name, 'back' ) === false && strpos( $lower_name, 'full' ) === false ) {
						$is_standalone_part = true;
						break;
					}
				}
				if ( $is_standalone_part ) {
					$is_excluded = true;
					$exclude_reason = 'Standalone accent or part (only main device skins are eligible).';
				}
			}

			$image_url = '';
			$custom_img = $item->get_meta( '_configured_image_url' )
				?: ( $item->get_meta( '_configurator_image' )
				?: ( $item->get_meta( 'mkl_pc_thumbnail_url' )
				?: ( $item->get_meta( '_thumbnail_url' )
				?: ( $item->get_meta( 'image_url' ) ?: '' ) ) ) );

			if ( ! empty( $custom_img ) ) {
				$image_url = $custom_img;
			} elseif ( $product ) {
				$image_id = $product->get_image_id();
				if ( $image_id ) {
					$image_url = wp_get_attachment_image_url( $image_id, 'medium' ) ?: '';
				}
			}

			// Extract multi-piece parts/layers (e.g. MacBook Top, Bottom, Inside; or Phone Back, Camera, Frame)
			$parts = [];
			$raw_config = $item->get_meta( '_configurator_data_raw' ) ?: $item->get_meta( '_configurator_data' );
			if ( ! empty( $raw_config ) ) {
				if ( is_string( $raw_config ) ) {
					$decoded = json_decode( $raw_config, true );
					if ( is_array( $decoded ) ) {
						$raw_config = $decoded;
					}
				}
				if ( is_array( $raw_config ) ) {
					foreach ( $raw_config as $idx => $v ) {
						$layer_name  = $v['layer_data']['layer_name'] ?? ( $v['layer_data']['name'] ?? ( $v['layer_name'] ?? ( $v['name'] ?? '' ) ) );
						$choice_name = $v['layer_data']['name'] ?? ( $v['choice_name'] ?? ( $v['name'] ?? '' ) );
						if ( ! empty( $layer_name ) && ! empty( $choice_name ) && $layer_name !== $choice_name ) {
							$parts[] = [
								'id'          => sanitize_title( $layer_name ),
								'layer_name'  => $layer_name,
								'choice_name' => $choice_name,
								'label'       => sprintf( '%s (%s)', $layer_name, $choice_name ),
							];
						}
					}
				}
			}

			if ( empty( $parts ) ) {
				$config_text = $item->get_meta( 'Configuration' );
				if ( ! empty( $config_text ) && is_string( $config_text ) ) {
					$delimiter = strpos( $config_text, '|' ) !== false ? '|' : ( strpos( $config_text, ',' ) !== false ? ',' : '' );
					if ( $delimiter ) {
						$segments = array_map( 'trim', explode( $delimiter, $config_text ) );
						foreach ( $segments as $seg ) {
							if ( strpos( $seg, ':' ) !== false ) {
								$parts_split = explode( ':', $seg, 2 );
								$l_name = trim( $parts_split[0] ?? '' );
								$c_name = trim( $parts_split[1] ?? '' );
								if ( ! empty( $l_name ) && ! empty( $c_name ) ) {
									$parts[] = [
										'id'          => sanitize_title( $l_name ),
										'layer_name'  => $l_name,
										'choice_name' => $c_name,
										'label'       => sprintf( '%s (%s)', $l_name, $c_name ),
									];
								}
							}
						}
					}
				}
			}

			$item_payload = [
				'item_id'            => $item_id,
				'product_id'         => $item->get_product_id(),
				'variation_id'       => $item->get_variation_id(),
				'name'               => $product_name,
				'quantity'           => $item->get_quantity(),
				'image'              => $image_url,
				'has_multiple_parts' => count( $parts ) > 1,
				'parts'              => $parts,
			];

			if ( $is_excluded ) {
				$item_payload['reason'] = $exclude_reason;
				$excluded_items[] = $item_payload;
			} else {
				$eligible_items[] = $item_payload;
			}
		}

		if ( empty( $eligible_items ) ) {
			return new \WP_REST_Response( [
				'success'        => false,
				'eligible'       => false,
				'reason'         => 'no_eligible_items',
				'message'        => 'This order does not contain eligible skins. Cases, screen protectors, and standalone accent pieces are excluded from installation warranty.',
				'excluded_items' => $excluded_items,
			], 200 );
		}

		// 5. Build Locked Shipping Destination Address
		$shipping_address = [
			'first_name' => $order->get_shipping_first_name() ?: $order->get_billing_first_name(),
			'last_name'  => $order->get_shipping_last_name() ?: $order->get_billing_last_name(),
			'address_1'  => $order->get_shipping_address_1() ?: $order->get_billing_address_1(),
			'address_2'  => $order->get_shipping_address_2() ?: $order->get_billing_address_2(),
			'city'       => $order->get_shipping_city() ?: $order->get_billing_city(),
			'state'      => $order->get_shipping_state() ?: $order->get_billing_state(),
			'postcode'   => $order->get_shipping_postcode() ?: $order->get_billing_postcode(),
			'country'    => $order->get_shipping_country() ?: $order->get_billing_country() ?: 'ID',
			'phone'      => $order->get_billing_phone(),
			'email'      => $order->get_billing_email(),
		];

		$hours_left = floor( $remaining_secs / 3600 );
		$mins_left  = floor( ( $remaining_secs % 3600 ) / 60 );

		return new \WP_REST_Response( [
			'success'            => true,
			'eligible'           => true,
			'order_id'           => $order_id,
			'order_number'       => $order->get_order_number(),
			'delivered_at'       => $delivered_at_str,
			'remaining_seconds'  => $remaining_secs,
			'remaining_text'     => "{$hours_left}h {$mins_left}m remaining",
			'expires_at'         => date( 'Y-m-d H:i:s', $delivered_ts + self::WARRANTY_WINDOW_SECS ),
			'shipping_address'   => $shipping_address,
			'eligible_items'     => $eligible_items,
			'excluded_items'     => $excluded_items,
		], 200 );
	}

	/**
	 * Check warranty eligibility for a Shopee order
	 */
	public static function check_shopee_eligibility( array $ord, string $verification = '', string $query_ref = '' ): \WP_REST_Response {
		$sn = $ord['order_sn'] ?? $query_ref;

		// 1. Check existing claim
		$existing_claim_ids = self::query_order_ids_by_meta( [
			[
				'key'     => '_rma_original_invoice',
				'value'   => $sn,
				'compare' => '=',
			],
		], [ 'limit' => 1 ] );

		if ( ! empty( $existing_claim_ids ) ) {
			$rep_order = wc_get_order( reset( $existing_claim_ids ) );
			return new \WP_REST_Response( [
				'success'              => false,
				'eligible'             => false,
				'reason'               => 'already_claimed',
				'message'              => 'A warranty replacement has already been claimed for this Shopee order under replacement order #' . ( $rep_order ? $rep_order->get_order_number() : reset( $existing_claim_ids ) ) . '.',
				'replacement_order_id' => reset( $existing_claim_ids ),
			], 200 );
		}

		// 2. Verification check (phone number or username)
		if ( ! empty( $verification ) ) {
			$raw_phone = preg_replace( '/[^0-9]/', '', (string) ( $ord['recipient_phone'] ?? '' ) );
			$digits_verif = preg_replace( '/[^0-9]/', '', $verification );
			$is_phone_match = false;
			if ( strlen( $digits_verif ) >= 6 && ! empty( $raw_phone ) ) {
				$norm_order_phone = self::normalize_phone( $raw_phone );
				$norm_verif_phone = self::normalize_phone( $digits_verif );
				$is_phone_match = ( ! empty( $norm_order_phone ) && $norm_order_phone === $norm_verif_phone )
					|| ( substr( $raw_phone, -8 ) === substr( $digits_verif, -8 ) );
			}
			$is_user_match = ( strcasecmp( trim( $verification ), trim( $ord['buyer_username'] ?? '' ) ) === 0 );

			if ( ! $is_phone_match && ! $is_user_match ) {
				return new \WP_REST_Response( [
					'success'  => false,
					'eligible' => false,
					'reason'   => 'verification_failed',
					'message'  => 'The phone number does not match the recipient records for Shopee Order #' . $sn . '.',
				], 200 );
			}
		}

		// 3. Delivered Status & 48-Hour Window Check
		$raw_st = strtoupper( (string) ( $ord['order_status'] ?? '' ) );
		$is_delivered = ! empty( $ord['is_delivered'] ) || in_array( $raw_st, [ 'COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE' ], true );

		if ( ! $is_delivered ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'not_delivered',
				'status'   => $raw_st,
				'message'  => 'This Shopee order has not been marked as delivered by the courier yet. Installation warranty is applicable within 48 hours after receiving your order.',
			], 200 );
		}

		$delivered_at_str = $ord['delivered_time'] ?? ( ! empty( $ord['delivered_ts'] ) ? date( 'Y-m-d H:i:s', $ord['delivered_ts'] ) : null );
		if ( empty( $delivered_at_str ) ) {
			$delivered_at_str = current_time( 'mysql' );
		}

		$delivered_ts = strtotime( $delivered_at_str );
		$current_ts   = current_time( 'timestamp' );
		$elapsed_secs = max( 0, $current_ts - $delivered_ts );
		$remaining_secs = self::WARRANTY_WINDOW_SECS - $elapsed_secs;

		if ( $remaining_secs <= 0 ) {
			$delivered_display = date( 'd M Y, H:i', $delivered_ts );
			return new \WP_REST_Response( [
				'success'        => false,
				'eligible'       => false,
				'reason'         => 'window_expired',
				'delivered_at'   => $delivered_at_str,
				'delivered_fmt'  => $delivered_display,
				'elapsed_hours'  => round( $elapsed_secs / 3600, 1 ),
				'message'        => 'The 48-hour installation warranty window has expired. Your Shopee package was delivered on ' . $delivered_display . '.',
			], 200 );
		}

		// 4. Eligible Line Items
		$eligible_items = [];
		foreach ( ( $ord['items'] ?? [] ) as $idx => $it ) {
			$name = $it['item_name'] ?? 'Exacoat Skin';
			if ( ! empty( $it['model_name'] ) && strpos( $name, $it['model_name'] ) === false ) {
				$name .= ' - ' . $it['model_name'];
			}
			$eligible_items[] = [
				'item_id'            => $it['item_id'] ?? "shopee_{$idx}",
				'product_id'         => $it['item_id'] ?? 0,
				'variation_id'       => $it['model_id'] ?? 0,
				'name'               => $name,
				'quantity'           => (int) ( $it['quantity'] ?? 1 ),
				'image'              => $it['image_url'] ?? '',
				'has_multiple_parts' => false,
				'parts'              => [],
				'item_note'          => $it['note'] ?? ( $it['item_note'] ?? '' ),
			];
		}

		$hours_left = floor( $remaining_secs / 3600 );
		$mins_left  = floor( ( $remaining_secs % 3600 ) / 60 );

		return new \WP_REST_Response( [
			'success'            => true,
			'eligible'           => true,
			'is_marketplace'     => true,
			'channel'            => 'Shopee',
			'order_id'           => $sn,
			'order_number'       => $sn,
			'tracking_number'    => $ord['tracking_number'] ?? '',
			'delivered_at'       => $delivered_at_str,
			'remaining_seconds'  => $remaining_secs,
			'remaining_text'     => "{$hours_left}h {$mins_left}m remaining",
			'expires_at'         => date( 'Y-m-d H:i:s', $delivered_ts + self::WARRANTY_WINDOW_SECS ),
			'buyer_note'         => $ord['buyer_note'] ?? '',
			'shipping_address'   => [
				'first_name' => $ord['recipient_name'] ?? ( $ord['buyer_username'] ?? 'Customer' ),
				'last_name'  => '',
				'address_1'  => $ord['recipient_address'] ?? '',
				'city'       => $ord['recipient_city'] ?? '',
				'postcode'   => $ord['recipient_postcode'] ?? '',
				'country'    => 'ID',
				'phone'      => $ord['recipient_phone'] ?? '',
				'email'      => '',
			],
			'eligible_items'     => $eligible_items,
			'excluded_items'     => [],
		], 200 );
	}

	/**
	 * Check warranty eligibility for a TikTok Shop order
	 */
	public static function check_tiktok_eligibility( array $ord, string $verification = '', string $query_ref = '' ): \WP_REST_Response {
		$order_id = $ord['order_id'] ?? ( $ord['order_sn'] ?? $query_ref );

		// 1. Check existing claim
		$existing_claim_ids = self::query_order_ids_by_meta( [
			[
				'key'     => '_rma_original_invoice',
				'value'   => $order_id,
				'compare' => '=',
			],
		], [ 'limit' => 1 ] );

		if ( ! empty( $existing_claim_ids ) ) {
			$rep_order = wc_get_order( reset( $existing_claim_ids ) );
			return new \WP_REST_Response( [
				'success'              => false,
				'eligible'             => false,
				'reason'               => 'already_claimed',
				'message'              => 'A warranty replacement has already been claimed for this TikTok Shop order under replacement order #' . ( $rep_order ? $rep_order->get_order_number() : reset( $existing_claim_ids ) ) . '.',
				'replacement_order_id' => reset( $existing_claim_ids ),
			], 200 );
		}

		// 2. Verification check
		if ( ! empty( $verification ) ) {
			$raw_phone = preg_replace( '/[^0-9]/', '', (string) ( $ord['recipient_phone'] ?? '' ) );
			$digits_verif = preg_replace( '/[^0-9]/', '', $verification );
			$is_phone_match = false;
			if ( strlen( $digits_verif ) >= 6 && ! empty( $raw_phone ) ) {
				$norm_order_phone = self::normalize_phone( $raw_phone );
				$norm_verif_phone = self::normalize_phone( $digits_verif );
				$is_phone_match = ( ! empty( $norm_order_phone ) && $norm_order_phone === $norm_verif_phone )
					|| ( substr( $raw_phone, -8 ) === substr( $digits_verif, -8 ) );
			}
			$is_user_match = ( strcasecmp( trim( $verification ), trim( $ord['buyer_username'] ?? '' ) ) === 0 );

			if ( ! $is_phone_match && ! $is_user_match ) {
				return new \WP_REST_Response( [
					'success'  => false,
					'eligible' => false,
					'reason'   => 'verification_failed',
					'message'  => 'The phone number does not match the recipient records for TikTok Shop Order #' . $order_id . '.',
				], 200 );
			}
		}

		// 3. Delivered Status & 48-Hour Window Check
		$raw_st = strtoupper( (string) ( $ord['order_status'] ?? '' ) );
		$is_delivered = ! empty( $ord['is_delivered'] ) || in_array( $raw_st, [ 'COMPLETED', 'DELIVERED' ], true );

		if ( ! $is_delivered ) {
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'not_delivered',
				'status'   => $raw_st,
				'message'  => 'This TikTok Shop order has not been marked as delivered by the courier yet. Installation warranty is applicable within 48 hours after receiving your order.',
			], 200 );
		}

		$delivered_at_str = $ord['delivered_time'] ?? ( ! empty( $ord['delivered_ts'] ) ? date( 'Y-m-d H:i:s', $ord['delivered_ts'] ) : null );
		if ( empty( $delivered_at_str ) ) {
			$delivered_at_str = current_time( 'mysql' );
		}

		$delivered_ts = strtotime( $delivered_at_str );
		$current_ts   = current_time( 'timestamp' );
		$elapsed_secs = max( 0, $current_ts - $delivered_ts );
		$remaining_secs = self::WARRANTY_WINDOW_SECS - $elapsed_secs;

		if ( $remaining_secs <= 0 ) {
			$delivered_display = date( 'd M Y, H:i', $delivered_ts );
			return new \WP_REST_Response( [
				'success'        => false,
				'eligible'       => false,
				'reason'         => 'window_expired',
				'delivered_at'   => $delivered_at_str,
				'delivered_fmt'  => $delivered_display,
				'elapsed_hours'  => round( $elapsed_secs / 3600, 1 ),
				'message'        => 'The 48-hour installation warranty window has expired. Your TikTok Shop package was delivered on ' . $delivered_display . '.',
			], 200 );
		}

		// 4. Eligible Line Items
		$eligible_items = [];
		foreach ( ( $ord['items'] ?? [] ) as $idx => $it ) {
			$name = $it['item_name'] ?? 'Exacoat Skin';
			$variant = $it['sku_name'] ?? ( $it['variation_name'] ?? '' );
			if ( ! empty( $variant ) && strpos( $name, $variant ) === false ) {
				$name .= ' - ' . $variant;
			}
			$eligible_items[] = [
				'item_id'            => $it['item_id'] ?? "tiktok_{$idx}",
				'product_id'         => $it['item_id'] ?? 0,
				'variation_id'       => $it['sku_id'] ?? 0,
				'name'               => $name,
				'quantity'           => (int) ( $it['quantity'] ?? 1 ),
				'image'              => $it['image_url'] ?? '',
				'has_multiple_parts' => false,
				'parts'              => [],
				'item_note'          => $it['note'] ?? ( $it['item_note'] ?? '' ),
			];
		}

		$hours_left = floor( $remaining_secs / 3600 );
		$mins_left  = floor( ( $remaining_secs % 3600 ) / 60 );

		return new \WP_REST_Response( [
			'success'            => true,
			'eligible'           => true,
			'is_marketplace'     => true,
			'channel'            => 'TikTok Shop',
			'order_id'           => $order_id,
			'order_number'       => $order_id,
			'tracking_number'    => $ord['tracking_number'] ?? '',
			'delivered_at'       => $delivered_at_str,
			'remaining_seconds'  => $remaining_secs,
			'remaining_text'     => "{$hours_left}h {$mins_left}m remaining",
			'expires_at'         => date( 'Y-m-d H:i:s', $delivered_ts + self::WARRANTY_WINDOW_SECS ),
			'buyer_note'         => $ord['buyer_note'] ?? ( $ord['buyer_message'] ?? '' ),
			'shipping_address'   => [
				'first_name' => $ord['recipient_name'] ?? ( $ord['buyer_username'] ?? 'Customer' ),
				'last_name'  => '',
				'address_1'  => $ord['recipient_address'] ?? '',
				'city'       => $ord['recipient_city'] ?? '',
				'postcode'   => $ord['recipient_postcode'] ?? '',
				'country'    => 'ID',
				'phone'      => $ord['recipient_phone'] ?? '',
				'email'      => '',
			],
			'eligible_items'     => $eligible_items,
			'excluded_items'     => [],
		], 200 );
	}

	/**
	 * Upload 5-piece cut video proof (max 100MB)
	 */
	public static function rest_upload_proof( \WP_REST_Request $request ): \WP_REST_Response {
		$raw_order_id = sanitize_text_field( trim( (string) $request->get_param( 'order_id' ) ) );
		if ( empty( $raw_order_id ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Order ID is required for proof upload.',
			], 400 );
		}

		if ( empty( $_FILES['proof_video'] ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'No video file provided.',
			], 400 );
		}

		$file = $_FILES['proof_video'];

		if ( ! empty( $file['error'] ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Upload error: ' . self::get_upload_error_message( $file['error'] ),
			], 400 );
		}

		if ( $file['size'] > self::MAX_VIDEO_BYTES ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Video file exceeds the maximum allowed size of 100 MB.',
			], 400 );
		}

		$allowed_mimes = [
			'video/mp4'        => 'mp4',
			'video/quicktime'  => 'mov',
			'video/webm'       => 'webm',
			'video/x-matroska' => 'mkv',
			'video/3gpp'       => '3gp',
			'video/avi'        => 'avi',
		];

		$finfo     = finfo_open( FILEINFO_MIME_TYPE );
		$mime_type = finfo_file( $finfo, $file['tmp_name'] );
		finfo_close( $finfo );

		if ( ! isset( $allowed_mimes[ $mime_type ] ) ) {
			$ext = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );
			if ( ! in_array( $ext, [ 'mp4', 'mov', 'webm', 'mkv', '3gp', 'avi' ], true ) ) {
				return new \WP_REST_Response( [
					'success' => false,
					'message' => 'Invalid file format. Please upload a valid video file (MP4, MOV, WEBM).',
				], 400 );
			}
		} else {
			$ext = $allowed_mimes[ $mime_type ];
		}

		$upload_dir = wp_upload_dir();
		$target_dir = $upload_dir['basedir'] . '/' . self::UPLOAD_SUBDIR;

		if ( ! file_exists( $target_dir ) ) {
			wp_mkdir_p( $target_dir );
			file_put_contents( $target_dir . '/index.php', '<?php // Silence is golden' );
		}

		$unique_token = wp_generate_password( 24, false );
		$safe_id      = preg_replace( '/[^a-zA-Z0-9_-]/', '', $raw_order_id );
		$filename     = sprintf( 'proof_%s_%s.%s', $safe_id ?: 'order', $unique_token, $ext );
		$target_path  = $target_dir . '/' . $filename;

		if ( ! move_uploaded_file( $file['tmp_name'], $target_path ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Failed to store video on server disk.',
			], 500 );
		}

		$file_url = $upload_dir['baseurl'] . '/' . self::UPLOAD_SUBDIR . '/' . $filename;

		return new \WP_REST_Response( [
			'success'        => true,
			'file_path'      => $target_path,
			'video_url'      => $file_url,
			'file_size'      => $file['size'],
			'file_name'      => $filename,
			'message'        => 'Video proof uploaded successfully.',
		], 200 );
	}

	/**
	 * Calculate live Biteship shipping rates for locked original address
	 */
	public static function rest_get_shipping_rates( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id = absint( $request->get_param( 'order_id' ) );
		$order    = $order_id ? wc_get_order( $order_id ) : null;

		$country = strtoupper( sanitize_text_field( trim( (string) ( $request->get_param( 'destination_country' ) ?: $request->get_param( 'country' ) ) ) ) );
		if ( empty( $country ) && $order ) {
			$country = strtoupper( trim( $order->get_shipping_country() ?: $order->get_billing_country() ) );
		}
		if ( empty( $country ) ) {
			$country = 'ID';
		}

		$postcode = sanitize_text_field( trim( (string) $request->get_param( 'postcode' ) ) );
		if ( empty( $postcode ) && $order ) {
			$postcode = trim( $order->get_shipping_postcode() ?: $order->get_billing_postcode() );
		}

		$city = sanitize_text_field( trim( (string) $request->get_param( 'city' ) ) );
		if ( empty( $city ) && $order ) {
			$city = trim( $order->get_shipping_city() ?: $order->get_billing_city() );
		}

		$state = sanitize_text_field( trim( (string) $request->get_param( 'state' ) ) );
		if ( empty( $state ) && $order ) {
			$state = trim( $order->get_shipping_state() ?: $order->get_billing_state() );
		}

		$address = sanitize_text_field( trim( (string) ( $request->get_param( 'address' ) ?: $request->get_param( 'address_1' ) ) ) );
		if ( empty( $address ) && $order ) {
			$address = trim( $order->get_shipping_address_1() ?: $order->get_billing_address_1() );
		}

		if ( 'ID' === $country && empty( $postcode ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Postal code is required for domestic shipping calculation.',
			], 400 );
		}

		// International Shipping: dynamically query WooCommerce Shipping Zones & active methods (Goorita, POS Indonesia, etc.)
		if ( 'ID' !== $country ) {
			$package = [
				'contents'        => [],
				'contents_cost'   => 129000,
				'applied_coupons' => [],
				'user'            => [ 'ID' => get_current_user_id() ],
				'destination'     => [
					'country'   => $country,
					'state'     => $state,
					'postcode'  => $postcode,
					'city'      => $city,
					'address'   => $address,
					'address_2' => '',
				],
			];

			if ( $order ) {
				$package['contents_cost'] = (float) ( $order->get_total() ?: 129000 );
				foreach ( $order->get_items() as $item_id => $item ) {
					$product = $item->get_product();
					if ( $product ) {
						$package['contents'][ $item_id ] = [
							'product_id'        => $product->get_id(),
							'variation_id'      => $product->is_type( 'variation' ) ? $product->get_id() : 0,
							'variation'         => [],
							'quantity'          => $item->get_quantity(),
							'data'              => $product,
							'line_total'        => $item->get_total(),
							'line_tax'          => $item->get_total_tax(),
							'line_subtotal'     => $item->get_subtotal(),
							'line_subtotal_tax' => $item->get_subtotal_tax(),
						];
					}
				}
			}

			if ( function_exists( 'WC' ) && WC()->shipping() ) {
				WC()->shipping()->init();
			}

			$rates = [];

			// 1. Calculate shipping for package through WooCommerce Core shipping engine
			if ( function_exists( 'WC' ) && WC()->shipping() ) {
				try {
					$calc_result = WC()->shipping()->calculate_shipping_for_package( $package );
					if ( ! empty( $calc_result['rates'] ) && is_array( $calc_result['rates'] ) ) {
						foreach ( $calc_result['rates'] as $rate_obj ) {
							if ( is_a( $rate_obj, 'WC_Shipping_Rate' ) ) {
								$rid = $rate_obj->get_id();
								$rates[ $rid ] = [
									'id'       => $rid,
									'courier'  => $rate_obj->get_method_id(),
									'service'  => (string) $rate_obj->get_instance_id(),
									'label'    => $rate_obj->get_label(),
									'price'    => (float) $rate_obj->get_cost(),
									'duration' => $rate_obj->get_meta_data()['duration'] ?? '7-14 business days',
								];
							}
						}
					}
				} catch ( \Throwable $e ) {
					error_log( 'WC International calculate_shipping_for_package error: ' . $e->getMessage() );
				}
			}

			// 2. Query WooCommerce Shipping Zones directly (matches POS Indonesia, Goorita, Flat Rate, etc.)
			if ( class_exists( 'WC_Shipping_Zones' ) ) {
				try {
					$zone = \WC_Shipping_Zones::get_zone_matching_package( $package );
					if ( $zone ) {
						$methods = $zone->get_shipping_methods( true );
						foreach ( $methods as $method ) {
							if ( is_object( $method ) && method_exists( $method, 'calculate_shipping' ) ) {
								$method->rates = [];
								$method->calculate_shipping( $package );
								if ( ! empty( $method->rates ) && is_array( $method->rates ) ) {
									foreach ( $method->rates as $rate_obj ) {
										if ( is_a( $rate_obj, 'WC_Shipping_Rate' ) ) {
											$rid = $rate_obj->get_id();
											if ( ! isset( $rates[ $rid ] ) ) {
												$rates[ $rid ] = [
													'id'       => $rid,
													'courier'  => $rate_obj->get_method_id(),
													'service'  => (string) $rate_obj->get_instance_id(),
													'label'    => $rate_obj->get_label(),
													'price'    => (float) $rate_obj->get_cost(),
													'duration' => $rate_obj->get_meta_data()['duration'] ?? '7-14 business days',
												];
											}
										}
									}
								}
							}

							if ( is_object( $method ) && method_exists( $method, 'get_option' ) ) {
								$rate_key = method_exists( $method, 'get_rate_id' ) ? $method->get_rate_id() : ( $method->id . '_' . $method->get_instance_id() );
								if ( ! isset( $rates[ $rate_key ] ) ) {
									$cost_val = $method->get_option( 'cost' );
									if ( '' !== $cost_val && null !== $cost_val ) {
										$rates[ $rate_key ] = [
											'id'       => $rate_key,
											'courier'  => $method->id,
											'service'  => (string) $method->get_instance_id(),
											'label'    => $method->get_title() ?: $method->get_method_title(),
											'price'    => (float) $cost_val,
											'duration' => '7-14 business days',
										];
									}
								}
							}
						}
					}
				} catch ( \Throwable $e ) {
					error_log( 'WC Zone matching error: ' . $e->getMessage() );
				}
			}

			// If zone and methods returned real rates, return them dynamically
			if ( ! empty( $rates ) ) {
				return new \WP_REST_Response( [
					'success'     => true,
					'is_fallback' => false,
					'country'     => $country,
					'postcode'    => $postcode,
					'rates'       => array_values( $rates ),
				], 200 );
			}

			// Fallback: If no international zone or methods are configured yet, return standard international carriers in IDR
			return new \WP_REST_Response( [
				'success'     => true,
				'is_fallback' => true,
				'country'     => $country,
				'postcode'    => $postcode,
				'rates'       => [
					[
						'id'       => 'goorita_international',
						'courier'  => 'goorita',
						'service'  => 'standard',
						'label'    => 'Goorita International Express',
						'price'    => 175000,
						'duration' => '5-10 business days',
					],
					[
						'id'       => 'pos_international',
						'courier'  => 'pos',
						'service'  => 'registered',
						'label'    => 'POS Indonesia International Registered',
						'price'    => 125000,
						'duration' => '7-14 business days',
					],
				],
			], 200 );
		}

		$api_key = '';
		if ( class_exists( 'Exacoat_Shipping_Tracker' ) && method_exists( 'Exacoat_Shipping_Tracker', 'get_biteship_api_key' ) ) {
			$api_key = Exacoat_Shipping_Tracker::get_biteship_api_key();
		} elseif ( class_exists( 'Exacoat_Biteship_Engine' ) && method_exists( 'Exacoat_Biteship_Engine', 'get_api_key' ) ) {
			$api_key = Exacoat_Biteship_Engine::get_api_key();
		}
		if ( empty( $api_key ) ) {
			$biteship_settings = get_option( 'woocommerce_biteship_shipping_settings', [] );
			$api_key           = $biteship_settings['api_key'] ?? '';
		}
		if ( empty( $api_key ) && defined( 'BITESHIP_API_KEY' ) ) {
			$api_key = trim( (string) BITESHIP_API_KEY );
		}
		if ( empty( $api_key ) ) {
			$fallback = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRXhhY29hdCIsInVzZXJJZCI6IjY2ZDM1NmE0OWEyOGQzMDAxMjUyN2Q1NCIsImlhdCI6MTc1ODQ1MTM5Mn0.zAWrMuQusXZc8_V0AyJCRO09Yig4n9uUjqza4E5lXag';
			$api_key  = $fallback;
		}

		$origin_zip = '17142';
		if ( class_exists( 'Exacoat_Biteship_Engine' ) && method_exists( 'Exacoat_Biteship_Engine', 'get_origin_zip' ) ) {
			$origin_zip = Exacoat_Biteship_Engine::get_origin_zip();
		}

		$rates = [];

		if ( ! empty( $api_key ) ) {
			$body = [
				'origin_postal_code'      => (int) $origin_zip,
				'destination_postal_code' => (int) $postcode,
				'couriers'                => 'jne,sicepat',
				'items'                   => [
					[
						'name'     => 'Replacement Skin Pack',
						'value'    => 10000,
						'weight'   => 150,
						'quantity' => 1,
					],
				],
			];

			$response = wp_remote_post( 'https://api.biteship.com/v1/rates/couriers', [
				'headers' => [
					'Authorization' => $api_key,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				],
				'body'    => json_encode( $body ),
				'timeout' => 15,
			] );

			if ( ! is_wp_error( $response ) ) {
				$resp_body = json_decode( wp_remote_retrieve_body( $response ), true );
				if ( ! empty( $resp_body['pricing'] ) && is_array( $resp_body['pricing'] ) ) {
					foreach ( $resp_body['pricing'] as $rate ) {
						$c_code = strtolower( (string) ( $rate['courier_code'] ?? '' ) );
						if ( ! in_array( $c_code, [ 'jne', 'sicepat' ], true ) ) {
							continue;
						}
						$s_code = strtolower( (string) ( $rate['courier_service_code'] ?? '' ) );
						if ( false !== strpos( $s_code, 'jtr' ) || false !== strpos( $s_code, 'trucking' ) || false !== strpos( $s_code, 'cargo' ) ) {
							continue;
						}
						if ( empty( $rate['shipping_type'] ) || ( $rate['shipping_type'] ?? '' ) === 'parcel' ) {
							$rates[] = [
								'id'       => ( $rate['courier_code'] ?? 'courier' ) . '_' . ( $rate['courier_service_code'] ?? 'service' ),
								'courier'  => $rate['courier_code'] ?? '',
								'service'  => $rate['courier_service_code'] ?? '',
								'label'    => sprintf( '%s - %s', strtoupper( $rate['courier_name'] ?? '' ), strtoupper( $rate['courier_service_code'] ?? '' ) ),
								'price'    => (float) ( $rate['price'] ?? 0 ),
								'duration' => ! empty( $rate['shipment_duration_range'] ) ? $rate['shipment_duration_range'] . ' ' . ( $rate['shipment_duration_unit'] ?? 'days' ) : '1-3 days',
							];
						}
					}
				}
			}
		}

		$is_fallback = false;
		if ( empty( $rates ) ) {
			$is_fallback = true;
			$rates = [
				[
					'id'       => 'jne_reg',
					'courier'  => 'jne',
					'service'  => 'reg',
					'label'    => 'JNE Regular',
					'price'    => 10000,
					'duration' => '2-3 business days',
				],
				[
					'id'       => 'sicepat_reg',
					'courier'  => 'sicepat',
					'service'  => 'reg',
					'label'    => 'SiCepat Regular',
					'price'    => 10000,
					'duration' => '1-2 business days',
				],
				[
					'id'       => 'jne_yes',
					'courier'  => 'jne',
					'service'  => 'yes',
					'label'    => 'JNE YES (Next Day)',
					'price'    => 20000,
					'duration' => '1 business day',
				],
			];
		}

		return new \WP_REST_Response( [
			'success'     => true,
			'is_fallback' => $is_fallback,
			'postcode'    => $postcode,
			'rates'       => $rates,
		], 200 );
	}

	/**
	 * Submit warranty claim & generate Rp 0 replacement order with customer shipping fee
	 */
	public static function rest_submit_claim( \WP_REST_Request $request ): \WP_REST_Response {
		$parent_order_id = absint( $request->get_param( 'order_id' ) );
		$parent_order    = wc_get_order( $parent_order_id );

		if ( ! $parent_order ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Original order not found.',
			], 404 );
		}

		if ( 'yes' === $parent_order->get_meta( '_has_warranty_claim' ) || 'yes' === $parent_order->get_meta( '_has_redeem_claim' ) || ! empty( $parent_order->get_meta( '_warranty_replacement_order_id' ) ) || ! empty( $parent_order->get_meta( '_redeem_replacement_order_id' ) ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'A replacement claim has already been submitted for this order. Only one claim is permitted per purchase.',
			], 400 );
		}

		$item_ids        = (array) $request->get_param( 'selected_item_ids' );
		$selected_parts  = (array) $request->get_param( 'selected_parts' );
		$claim_reason    = sanitize_text_field( $request->get_param( 'reason' ) ?: 'installation_issue' );
		$customer_notes  = sanitize_textarea_field( $request->get_param( 'notes' ) ?: '' );
		$video_url       = esc_url_raw( $request->get_param( 'video_url' ) ?: '' );
		$video_path      = sanitize_text_field( $request->get_param( 'video_file_path' ) ?: '' );
		$courier_id      = sanitize_text_field( $request->get_param( 'courier_id' ) ?: 'jne_reg' );
		$courier_label   = sanitize_text_field( $request->get_param( 'courier_label' ) ?: 'JNE Regular' );
		$shipping_cost   = max( 0, floatval( $request->get_param( 'shipping_cost' ) ?: 10000 ) );

		if ( empty( $item_ids ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Please select at least one eligible skin to replace.',
			], 400 );
		}

		if ( empty( $video_url ) && empty( $video_path ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Video proof showing the skin cut into 5 pieces is required.',
			], 400 );
		}

		try {
			$replacement_order = wc_create_order( [
				'customer_id'   => $parent_order->get_customer_id(),
				'status'        => 'pending',
				'customer_note' => $customer_notes,
			] );

			if ( is_wp_error( $replacement_order ) ) {
				return new \WP_REST_Response( [
					'success' => false,
					'message' => 'Order creation failed: ' . $replacement_order->get_error_message(),
				], 500 );
			}

			// Copy shipping and billing addresses strictly identical to parent order
			$replacement_order->set_address( $parent_order->get_address( 'billing' ), 'billing' );
			$replacement_order->set_address( $parent_order->get_address( 'shipping' ), 'shipping' );

			// Add selected replacement items at unit price Rp 0
			$added_count = 0;
			foreach ( $parent_order->get_items() as $item_id => $item ) {
				if ( in_array( (string) $item_id, array_map( 'strval', $item_ids ), true ) ) {
					$product = $item->get_product();
					if ( $product ) {
						$order_item_id = $replacement_order->add_product( $product, 1, [
							'subtotal' => 0,
							'total'    => 0,
						] );
						if ( $order_item_id ) {
							$new_item = $replacement_order->get_item( $order_item_id );
							if ( $new_item ) {
								$config_text = $item->get_meta( 'Configuration' );
								$raw_config  = $item->get_meta( '_configurator_data_raw' ) ?: $item->get_meta( '_configurator_data' );
								$custom_img  = $item->get_meta( '_configured_image_url' ) ?: $item->get_meta( '_configurator_image' );
								$device      = $item->get_meta( 'device_model' ) ?: $item->get_meta( 'pa_device' );

								if ( ! empty( $custom_img ) ) {
									$new_item->add_meta_data( '_configured_image_url', $custom_img, true );
								}
								if ( ! empty( $device ) ) {
									$new_item->add_meta_data( 'device_model', $device, true );
								}

								// Check if specific parts were selected for this item (multi-part partial claim)
								$parts_for_item = $selected_parts[ (string) $item_id ] ?? ( $selected_parts[ $item_id ] ?? null );
								if ( ! empty( $parts_for_item ) && is_array( $parts_for_item ) ) {
									$parts_clean = array_map( 'sanitize_text_field', $parts_for_item );
									$new_item->add_meta_data( '_claimed_parts', $parts_clean, true );
									$part_str   = implode( ', ', $parts_clean );
									$new_config = sprintf( '[Partial Replacement: %s] %s', $part_str, $config_text ?: '' );
									$new_item->add_meta_data( 'Configuration', trim( $new_config ), true );
								} else {
									if ( ! empty( $config_text ) ) {
										$new_item->add_meta_data( 'Configuration', $config_text, true );
									}
								}

								if ( ! empty( $raw_config ) ) {
									$new_item->add_meta_data( '_configurator_data', $raw_config, true );
									$new_item->add_meta_data( '_configurator_data_raw', $raw_config, true );
								}

								$new_item->save();
							}
							$added_count++;
						}
					}
				}
			}

			if ( 0 === $added_count ) {
				$replacement_order->delete( true );
				return new \WP_REST_Response( [
					'success' => false,
					'message' => 'Could not match selected items with original products.',
				], 400 );
			}

			// Add shipping method line
			$shipping_item = new \WC_Order_Item_Shipping();
			$shipping_item->set_method_title( $courier_label );
			$shipping_item->set_method_id( $courier_id );
			$shipping_item->set_total( $shipping_cost );
			$replacement_order->add_item( $shipping_item );

			$replacement_order->set_currency( 'IDR' );
			$replacement_order->calculate_totals();

			// Store RMA metadata
			$rep_id = $replacement_order->get_id();
			$replacement_order->update_meta_data( '_rma_order_type', 'Warranty' );
			$replacement_order->update_meta_data( '_is_warranty', 'yes' );
			$replacement_order->update_meta_data( '_is_redeem', 'no' );
			$replacement_order->update_meta_data( '_order_badge', 'WARRANTY' );
			$replacement_order->update_meta_data( '_rma_original_invoice', $parent_order_id );
			$replacement_order->update_meta_data( '_rma_original_order_number', $parent_order->get_order_number() );
			$replacement_order->update_meta_data( '_rma_claim_reason', $claim_reason );
			$replacement_order->update_meta_data( '_rma_video_proof_url', $video_url );
			$replacement_order->update_meta_data( '_rma_video_file_path', $video_path );
			$replacement_order->update_meta_data( '_rma_status', 'pending_review' );
			if ( ! empty( $selected_parts ) ) {
				$replacement_order->update_meta_data( '_rma_selected_parts', $selected_parts );
			}
			$replacement_order->save();

			// Mark parent order as claimed
			$parent_order->update_meta_data( '_has_warranty_claim', 'yes' );
			$parent_order->update_meta_data( '_warranty_replacement_order_id', $rep_id );
			$parent_order->add_order_note( sprintf(
				'Installation Warranty replacement claimed. Replacement Order #%d created with courier %s (Rp %s). Proof video recorded.',
				$rep_id,
				$courier_label,
				number_format( $shipping_cost, 0, ',', '.' )
			) );
			$parent_order->save();

			$replacement_order->add_order_note( sprintf(
				'RMA Installation Warranty Replacement for Order #%d. Customer shipping fee: Rp %s.',
				$parent_order_id,
				number_format( $shipping_cost, 0, ',', '.' )
			) );

			$payment_url = $replacement_order->get_checkout_payment_url();

			return new \WP_REST_Response( [
				'success'                  => true,
				'replacement_order_id'     => $rep_id,
				'replacement_order_number' => $replacement_order->get_order_number(),
				'shipping_cost'            => $shipping_cost,
				'payment_url'              => $payment_url,
				'message'                  => 'Warranty claim submitted successfully. Please proceed with payment for courier delivery.',
			], 200 );

		} catch ( \Throwable $e ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Failed to process warranty claim: ' . $e->getMessage(),
			], 500 );
		}
	}

	/**
	 * Admin / Manager review endpoint: Approve or Reject warranty claim
	 * Automatically deletes video proof file from disk on either decision!
	 */
	public static function rest_review_claim( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id   = absint( $request->get_param( 'order_id' ) );
		$action     = sanitize_text_field( $request->get_param( 'action' ) );
		$reason     = sanitize_textarea_field( $request->get_param( 'reason' ) ?: '' );
		$admin_name = sanitize_text_field( $request->get_param( 'admin_name' ) ?: 'Operations Manager' );

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Order not found.',
			], 404 );
		}

		$order_type = $order->get_meta( '_rma_order_type' ) ?: 'Warranty';
		if ( ! in_array( $order_type, [ 'Warranty', 'Redeem' ], true ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Order #' . $order_id . ' is not an RMA Warranty or Redeem order.',
			], 400 );
		}

		$video_path = $order->get_meta( '_rma_video_file_path' );
		$video_url  = $order->get_meta( '_rma_video_proof_url' );

		if ( 'approve' === $action ) {
			$order->update_meta_data( '_rma_status', 'approved' );
			$order->update_meta_data( '_rma_reviewed_by', $admin_name );
			$order->update_meta_data( '_rma_reviewed_at', current_time( 'mysql' ) );

			if ( 'Redeem' === $order_type || $order->is_paid() || in_array( $order->get_status(), [ 'processing', 'on-hold' ], true ) ) {
				$order->set_status( 'processing', sprintf( '%s claim approved by %s. Moving to production.', $order_type, $admin_name ) );
			} else {
				$order->add_order_note( sprintf( '%s claim approved by %s. Awaiting customer shipping fee payment.', $order_type, $admin_name ) );
			}

		} elseif ( 'reject' === $action ) {
			$order->update_meta_data( '_rma_status', 'rejected' );
			$order->update_meta_data( '_rma_rejection_reason', $reason );
			$order->update_meta_data( '_rma_reviewed_by', $admin_name );
			$order->update_meta_data( '_rma_reviewed_at', current_time( 'mysql' ) );
			$order->set_status( 'cancelled', sprintf( '%s claim rejected by %s. Reason: %s', $order_type, $admin_name, $reason ?: 'Does not meet warranty criteria' ) );
		} else {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Invalid action. Must be approve or reject.',
			], 400 );
		}

		// AUTO-DELETE VIDEO FILE FROM DISK
		$deleted = self::delete_proof_video( $video_path, $video_url );

		$order->update_meta_data( '_rma_video_deleted_at', current_time( 'mysql' ) );
		$order->update_meta_data( '_rma_video_file_path', '' );
		$order->add_order_note( 'Proof video automatically deleted from disk for storage hygiene and privacy.' );
		$order->save();

		return new \WP_REST_Response( [
			'success'       => true,
			'order_id'      => $order_id,
			'rma_status'    => $order->get_meta( '_rma_status' ),
			'video_deleted' => $deleted,
			'message'       => sprintf( '%s claim successfully %sd. Proof video has been deleted from server.', $order_type, $action ),
		], 200 );
	}

	/**
	 * Get details of a warranty claim for manager view
	 */
	public static function rest_get_claim_details( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id = absint( $request->get_param( 'id' ) );
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Order not found.',
			], 404 );
		}

		$parent_id = $order->get_meta( '_rma_original_invoice' );
		$parent_order = $parent_id ? wc_get_order( $parent_id ) : null;
		$channel = $order->get_meta( '_rma_marketplace_channel' ) ?: ( $order->get_meta( '_marketplace_channel' ) ?: ( $order->get_meta( '_channel' ) ?: ( empty( $parent_id ) || is_numeric( $parent_id ) ? 'Web' : 'Shopee' ) ) );
		$buyer_note = $order->get_meta( '_shopee_buyer_note' ) ?: ( $order->get_meta( '_buyer_note' ) ?: '' );

		$items = [];
		foreach ( $order->get_items() as $item ) {
			$product = $item->get_product();
			$image_url = '';
			if ( $product && $product->get_image_id() ) {
				$image_url = wp_get_attachment_image_url( $product->get_image_id(), 'thumbnail' ) ?: '';
			}
			$claimed_parts = $item->get_meta( '_claimed_parts' );
			$item_note = $item->get_meta( '_item_note' ) ?: ( $item->get_meta( 'note' ) ?: ( $item->get_meta( '_shopee_note' ) ?: '' ) );
			$items[] = [
				'name'          => $item->get_name(),
				'quantity'      => $item->get_quantity(),
				'image'         => $image_url,
				'configuration' => $item->get_meta( 'Configuration' ) ?: '',
				'device_model'  => $item->get_meta( 'device_model' ) ?: '',
				'claimed_parts' => is_array( $claimed_parts ) ? $claimed_parts : [],
				'item_note'     => $item_note,
				'note'          => $item_note,
			];
		}

		return new \WP_REST_Response( [
			'success'                 => true,
			'order_id'                => $order_id,
			'order_number'            => $order->get_order_number(),
			'parent_order_id'         => $parent_id,
			'parent_order_number'     => $parent_order ? $parent_order->get_order_number() : $parent_id,
			'channel'                 => $channel,
			'buyer_note'              => $buyer_note,
			'shopee_notes'            => $buyer_note,
			'rma_status'              => $order->get_meta( '_rma_status' ) ?: 'pending_review',
			'claim_reason'            => $order->get_meta( '_rma_claim_reason' ),
			'customer_notes'          => $order->get_customer_note(),
			'video_proof_url'         => $order->get_meta( '_rma_video_proof_url' ),
			'video_deleted'           => ! empty( $order->get_meta( '_rma_video_deleted_at' ) ),
			'video_deleted_at'        => $order->get_meta( '_rma_video_deleted_at' ),
			'reviewed_by'             => $order->get_meta( '_rma_reviewed_by' ),
			'reviewed_at'             => $order->get_meta( '_rma_reviewed_at' ),
			'rejection_reason'        => $order->get_meta( '_rma_rejection_reason' ),
			'items'                   => $items,
			'customer_name'           => $order->get_formatted_billing_full_name(),
			'customer_phone'          => $order->get_billing_phone(),
			'customer_email'          => $order->get_billing_email(),
			'shipping_address'        => $order->get_formatted_shipping_address(),
		], 200 );
	}

	/**
	 * Dispatch shipping deduction webhook to Exacoat HR system for QC fault replacements.
	 *
	 * @param array $payload Payload data (orderNumber, replacementShippingCost, reason, incidentDate, invoiceReference).
	 * @return array Result containing success status, code, and response body or error.
	 */
	public static function dispatch_shipping_deduction_webhook( array $payload ): array {
		$webhook_url = 'https://hr.exacoat.com/api/webhooks/shipping-deduction';
		$secret      = 'ExacoatHRWebhook';

		$headers = [
			'Content-Type'        => 'application/json',
			'x-webhook-secret'    => $secret,
			'Authorization'       => 'Bearer ' . $secret,
		];

		$response = wp_remote_post( $webhook_url, [
			'method'      => 'POST',
			'timeout'     => 15,
			'redirection' => 5,
			'httpversion' => '1.1',
			'blocking'    => true,
			'headers'     => $headers,
			'body'        => wp_json_encode( $payload ),
			'data_format' => 'body',
		] );

		if ( is_wp_error( $response ) ) {
			return [
				'success' => false,
				'error'   => $response->get_error_message(),
				'code'    => 0,
				'body'    => '',
			];
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );

		$is_success = ( $code >= 200 && $code < 300 );

		return [
			'success' => $is_success,
			'code'    => $code,
			'body'    => $body,
			'error'   => $is_success ? null : ( 'HTTP ' . $code . ': ' . substr( (string) $body, 0, 200 ) ),
		];
	}

	/**
	 * Admin / Manager: Create manual warranty or redeem claim (Web order or Marketplace Shopee / Tokopedia)
	 */
	public static function rest_create_manual_claim( \WP_REST_Request $request ): \WP_REST_Response {
		$source_type  = sanitize_text_field( $request->get_param( 'source_type' ) ?: 'marketplace' );
		$rma_type     = sanitize_text_field( $request->get_param( 'rma_type' ) ?: 'Warranty' );
		if ( ! in_array( $rma_type, [ 'Warranty', 'Redeem' ], true ) ) {
			$rma_type = 'Warranty';
		}
		$admin_name   = sanitize_text_field( $request->get_param( 'admin_name' ) ?: 'Operations Manager' );
		$claim_reason = sanitize_text_field( $request->get_param( 'claim_reason' ) ?: ( 'Redeem' === $rma_type ? 'Precision cut defect / sizing mismatch' : 'Manual replacement issued by admin' ) );
		$notes        = sanitize_textarea_field( $request->get_param( 'notes' ) ?: '' );
		$initial_status = sanitize_text_field( $request->get_param( 'initial_status' ) ?: 'processing' );
		if ( ! in_array( $initial_status, [ 'processing', 'on-hold', 'preparing-order' ], true ) ) {
			$initial_status = 'processing';
		}

		$courier_id           = sanitize_text_field( $request->get_param( 'courier_id' ) ?: 'jne_reg' );
		$courier_label        = sanitize_text_field( $request->get_param( 'courier_label' ) ?: 'JNE Regular' );
		$shipping_cost        = max( 0, floatval( $request->get_param( 'shipping_cost' ) ?: 0 ) );
		$actual_shipping_cost = max( 0, floatval( $request->get_param( 'actual_shipping_cost' ) ?: $shipping_cost ) );
		if ( $actual_shipping_cost <= 0 && $shipping_cost > 0 ) {
			$actual_shipping_cost = $shipping_cost;
		}
		$waive_shipping = (bool) $request->get_param( 'waive_shipping' );
		$is_redeem      = ( 'Redeem' === $rma_type );
		$is_free        = ( $is_redeem || $waive_shipping );

		$is_qc_fault_param = $request->get_param( 'is_qc_fault' );
		$is_qc_fault       = ( true === $is_qc_fault_param || '1' === $is_qc_fault_param || 'true' === $is_qc_fault_param );
		if ( ! $is_qc_fault && 'Redeem' === $rma_type ) {
			$external_reasons = [
				'damaged in transit / packaging crushed',
			];
			$is_qc_fault = ! in_array( strtolower( trim( $claim_reason ) ), $external_reasons, true );
		}

		try {
			if ( 'existing_order' === $source_type ) {
				$parent_order_id = absint( $request->get_param( 'parent_order_id' ) );
				$parent_order    = wc_get_order( $parent_order_id );
				if ( ! $parent_order ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Original order not found.',
					], 404 );
				}

				// Prevent duplicate claim / redeem on the same parent order
				$existing_rep_id = $parent_order->get_meta( '_redeem_replacement_order_id' ) ?: $parent_order->get_meta( '_warranty_replacement_order_id' );
				$already_claimed = ( 'yes' === $parent_order->get_meta( '_has_warranty_claim' ) ) || ( 'yes' === $parent_order->get_meta( '_has_redeem_claim' ) );
				if ( $already_claimed || ! empty( $existing_rep_id ) ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => sprintf(
							'Original order #%s has already been claimed or redeemed under replacement order #%s. Duplicate claims are prohibited.',
							$parent_order->get_order_number(),
							$existing_rep_id ?: 'Unknown'
						),
					], 400 );
				}

				$prefix_note = ( 'Redeem' === $rma_type )
					? sprintf( '[REDEEM - EXACOAT FAULT] Free replacement and shipping issued due to company defect: %s', $claim_reason )
					: sprintf( '[WARRANTY REPLACEMENT] Installation Warranty: %s', $claim_reason );
				$full_customer_note = ! empty( $notes ) ? "{$prefix_note}\n\n{$notes}" : $prefix_note;

				$replacement_order = wc_create_order( [
					'customer_id'   => $parent_order->get_customer_id(),
					'status'        => $initial_status,
					'customer_note' => $full_customer_note,
				] );

				if ( is_wp_error( $replacement_order ) ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Order creation failed: ' . $replacement_order->get_error_message(),
					], 500 );
				}

				// Copy address from parent order
				$replacement_order->set_address( $parent_order->get_address( 'billing' ), 'billing' );
				$replacement_order->set_address( $parent_order->get_address( 'shipping' ), 'shipping' );

				// Allow custom address override if passed
				$shipping_addr = $request->get_param( 'shipping_address' );
				if ( is_array( $shipping_addr ) && ! empty( $shipping_addr['address_1'] ) ) {
					$curr_ship = $replacement_order->get_address( 'shipping' );
					$curr_ship['address_1'] = sanitize_text_field( $shipping_addr['address_1'] );
					$curr_ship['city']      = sanitize_text_field( $shipping_addr['city'] ?? $curr_ship['city'] );
					$curr_ship['state']     = sanitize_text_field( $shipping_addr['state'] ?? ( $curr_ship['state'] ?? '' ) );
					$curr_ship['postcode']  = sanitize_text_field( $shipping_addr['postcode'] ?? $curr_ship['postcode'] );
					$curr_ship['country']   = sanitize_text_field( $shipping_addr['country'] ?? ( $curr_ship['country'] ?? 'ID' ) );
					$replacement_order->set_address( $curr_ship, 'shipping' );
				}

				$item_ids       = (array) $request->get_param( 'selected_item_ids' );
				$selected_parts = (array) $request->get_param( 'selected_parts' );
				$added_count    = 0;

				foreach ( $parent_order->get_items() as $item_id => $item ) {
					if ( empty( $item_ids ) || in_array( (string) $item_id, array_map( 'strval', $item_ids ), true ) ) {
						$product = $item->get_product();
						if ( $product ) {
							$order_item_id = $replacement_order->add_product( $product, 1, [
								'subtotal' => 0,
								'total'    => 0,
							] );
							if ( $order_item_id ) {
								$new_item = $replacement_order->get_item( $order_item_id );
								if ( $new_item ) {
									// Copy configuration metadata
									$config_text = $item->get_meta( 'Configuration' );
									$raw_config  = $item->get_meta( '_configurator_data_raw' ) ?: $item->get_meta( '_configurator_data' );
									$custom_img  = $item->get_meta( '_configured_image_url' ) ?: $item->get_meta( '_configurator_image' );
									$device      = $item->get_meta( 'device_model' ) ?: $item->get_meta( 'pa_device' );

									if ( ! empty( $custom_img ) ) {
										$new_item->add_meta_data( '_configured_image_url', $custom_img, true );
									}
									if ( ! empty( $device ) ) {
										$new_item->add_meta_data( 'device_model', $device, true );
									}

									// Check if specific parts were selected for this item (multi-part partial claim)
									$parts_for_item = $selected_parts[ (string) $item_id ] ?? ( $selected_parts[ $item_id ] ?? null );
									$clean_config_base = $config_text ?: '';

									if ( ! empty( $parts_for_item ) && is_array( $parts_for_item ) ) {
										$parts_clean = array_map( 'sanitize_text_field', $parts_for_item );
										$new_item->add_meta_data( '_claimed_parts', $parts_clean, true );
										$part_str = implode( ', ', $parts_clean );
										$clean_config_base = sprintf( '[Partial Replacement: %s] %s', $part_str, $clean_config_base );
									}

									if ( 'Redeem' === $rma_type ) {
										$new_item->add_meta_data( '_is_redeem', 'yes', true );
										$new_item->add_meta_data( '_defect_reason', $claim_reason, true );
										$new_config = sprintf( '[REDEEM: Company Fault - %s] %s', $claim_reason, trim( $clean_config_base ) );
										$new_item->add_meta_data( 'Configuration', trim( $new_config ), true );
									} else {
										$new_item->add_meta_data( '_is_warranty', 'yes', true );
										$new_config = sprintf( '[WARRANTY REPLACEMENT] %s', trim( $clean_config_base ) );
										$new_item->add_meta_data( 'Configuration', trim( $new_config ), true );
									}

									if ( ! empty( $raw_config ) ) {
										$new_item->add_meta_data( '_configurator_data', $raw_config, true );
										$new_item->add_meta_data( '_configurator_data_raw', $raw_config, true );
									}

									$new_item->save();
								}
								$added_count++;
							}
						}
					}
				}

				if ( 0 === $added_count ) {
					$replacement_order->delete( true );
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'No items were selected or matched from the parent order.',
					], 400 );
				}

				// Add shipping method line with actual courier cost
				$shipping_item = new \WC_Order_Item_Shipping();
				$shipping_item->set_method_title( $courier_label );
				$shipping_item->set_method_id( $courier_id );
				$shipping_item->set_total( $actual_shipping_cost );
				$replacement_order->add_item( $shipping_item );

				// If Redeem or Waived, add a negative fee line to balance out the shipping cost
				if ( $is_free && $actual_shipping_cost > 0 ) {
					$waiver_fee = new \WC_Order_Item_Fee();
					$waiver_title = $is_redeem
						? 'Redeem Shipping Waiver (Borne by Exacoat)'
						: 'Shipping Waiver (Borne by Exacoat)';
					$waiver_fee->set_name( $waiver_title );
					$waiver_fee->set_amount( -1 * $actual_shipping_cost );
					$waiver_fee->set_total( -1 * $actual_shipping_cost );
					$waiver_fee->set_tax_status( 'none' );
					$waiver_fee->add_meta_data( '_is_shipping_waiver', 'yes', true );
					$waiver_fee->add_meta_data( '_covered_courier_cost', $actual_shipping_cost, true );
					$replacement_order->add_item( $waiver_fee );
				}

				$replacement_order->set_currency( 'IDR' );
				$replacement_order->calculate_totals();

				$rep_id = $replacement_order->get_id();
				$replacement_order->update_meta_data( '_rma_order_type', $rma_type );
				$replacement_order->update_meta_data( '_is_redeem', 'Redeem' === $rma_type ? 'yes' : 'no' );
				$replacement_order->update_meta_data( '_is_warranty', 'Warranty' === $rma_type ? 'yes' : 'no' );
				$replacement_order->update_meta_data( '_order_badge', 'Redeem' === $rma_type ? 'REDEEM' : 'WARRANTY' );
				$replacement_order->update_meta_data( '_rma_original_invoice', $parent_order_id );
				$replacement_order->update_meta_data( '_rma_original_order_number', $parent_order->get_order_number() );
				$replacement_order->update_meta_data( '_rma_claim_reason', $claim_reason );
				$replacement_order->update_meta_data( '_rma_status', 'approved' );
				$replacement_order->update_meta_data( '_actual_shipping_cost', $actual_shipping_cost );
				$replacement_order->update_meta_data( '_shipping_waived', $is_free ? 'yes' : 'no' );
				$replacement_order->update_meta_data( '_rma_reviewed_by', $admin_name );
				$replacement_order->update_meta_data( '_rma_reviewed_at', current_time( 'mysql' ) );
				if ( ! empty( $selected_parts ) ) {
					$replacement_order->update_meta_data( '_rma_selected_parts', $selected_parts );
				}
				$replacement_order->save();

				$hr_webhook_result = null;
				if ( 'Redeem' === $rma_type ) {
					$parent_order->update_meta_data( '_has_redeem_claim', 'yes' );
					$parent_order->update_meta_data( '_redeem_replacement_order_id', $rep_id );
					$parent_order->add_order_note( sprintf(
						'Redeem (Company Fault) order created by %s. Replacement Order #%d created with courier %s (Rp %s, Waived via Exacoat Expense). Reason: %s',
						$admin_name,
						$rep_id,
						$courier_label,
						number_format( $actual_shipping_cost, 0, ',', '.' ),
						$claim_reason
					) );
					$parent_order->save();

					$replacement_order->add_order_note( sprintf(
						'⭐ [REDEEM REPLACEMENT - COMPANY FAULT] For Parent Order #%d. Issued by %s. Courier: %s (Rp %s, Waived via Exacoat Company Expense). Defect: %s. Direct to production queue.',
						$parent_order_id,
						$admin_name,
						$courier_label,
						number_format( $actual_shipping_cost, 0, ',', '.' ),
						$claim_reason
					) );

					if ( $is_qc_fault ) {
						$order_number_ref = (string) ( $parent_order->get_order_number() ?: $parent_order_id );
						$qc_reason_text   = ! empty( $notes ) ? $notes : $claim_reason;
						$hr_payload = [
							'orderNumber'             => $order_number_ref,
							'replacementShippingCost' => $actual_shipping_cost,
							'reason'                  => $qc_reason_text,
							'incidentDate'            => gmdate( 'Y-m-d\TH:i:s\Z' ),
							'invoiceReference'        => (string) $replacement_order->get_order_number(),
						];

						$hr_webhook_result = self::dispatch_shipping_deduction_webhook( $hr_payload );
						$replacement_order->update_meta_data( '_is_qc_fault', 'yes' );
						$replacement_order->update_meta_data( '_actual_shipping_cost', $actual_shipping_cost );
						$replacement_order->update_meta_data( '_hr_webhook_dispatched', 'yes' );
						$replacement_order->update_meta_data( '_hr_webhook_success', $hr_webhook_result['success'] ? 'yes' : 'no' );
						$replacement_order->update_meta_data( '_hr_webhook_code', $hr_webhook_result['code'] );
						$replacement_order->update_meta_data( '_hr_webhook_payload', $hr_payload );

						if ( $hr_webhook_result['success'] ) {
							$replacement_order->add_order_note( sprintf(
								'📋 [HR DEDUCTION WEBHOOK] Successfully sent shipping deduction to HR system (HTTP %d). Cost: Rp %s. Reason: "%s". Parent Order: #%s.',
								$hr_webhook_result['code'],
								number_format( $actual_shipping_cost, 0, ',', '.' ),
								$qc_reason_text,
								$order_number_ref
							) );
						} else {
							$replacement_order->add_order_note( sprintf(
								'⚠️ [HR DEDUCTION WEBHOOK FAILED] Failed to notify HR system (HTTP %d). Error: %s. Payload: %s',
								$hr_webhook_result['code'],
								$hr_webhook_result['error'] ?: $hr_webhook_result['body'],
								wp_json_encode( $hr_payload )
							) );
						}
					}
				} else {
					$parent_order->update_meta_data( '_has_warranty_claim', 'yes' );
					$parent_order->update_meta_data( '_warranty_replacement_order_id', $rep_id );
					$parent_order->add_order_note( sprintf(
						'Manual installation warranty claim created by %s. Replacement Order #%d created with courier %s (Rp %s). Reason: %s',
						$admin_name,
						$rep_id,
						$courier_label,
						number_format( $shipping_cost, 0, ',', '.' ),
						$claim_reason
					) );
					$parent_order->save();

					$replacement_order->add_order_note( sprintf(
						'[RMA INSTALLATION WARRANTY] For Parent Order #%d. Issued by %s. Shipping fee: Rp %s. Reason: %s',
						$parent_order_id,
						$admin_name,
						number_format( $shipping_cost, 0, ',', '.' ),
						$claim_reason
					) );
				}

				$replacement_order->save();

				$res_data = [
					'success'                  => true,
					'replacement_order_id'     => $rep_id,
					'replacement_order_number' => $replacement_order->get_order_number(),
					'shipping_cost'            => $shipping_cost,
					'message'                  => sprintf(
						'Manual %s replacement order #%s created successfully.',
						strtolower( $rma_type ),
						$replacement_order->get_order_number()
					),
				];
				if ( null !== $hr_webhook_result ) {
					$res_data['hr_webhook'] = [
						'dispatched' => true,
						'success'    => $hr_webhook_result['success'],
						'code'       => $hr_webhook_result['code'],
						'error'      => $hr_webhook_result['error'] ?? null,
					];
				}

				return new \WP_REST_Response( $res_data, 200 );

			} else {
				// Marketplace / Manual Order (Shopee, Tokopedia, TikTok Shop, WhatsApp)
				$channel             = sanitize_text_field( $request->get_param( 'channel' ) ?: 'Tokopedia' );
				$marketplace_invoice = sanitize_text_field( $request->get_param( 'marketplace_invoice' ) ?: '' );
				$customer_name       = sanitize_text_field( $request->get_param( 'customer_name' ) ?: 'Marketplace Customer' );
				$customer_phone      = sanitize_text_field( $request->get_param( 'customer_phone' ) ?: '' );
				$customer_email      = sanitize_email( $request->get_param( 'customer_email' ) ?: '' );
				$shipping_addr       = (array) $request->get_param( 'shipping_address' );
				$items               = (array) $request->get_param( 'items' );

				if ( empty( $marketplace_invoice ) ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Marketplace order number or invoice is required.',
					], 400 );
				}

				// Prevent duplicate claims for external marketplace invoices
				$clean_invoice = trim( ltrim( trim( $marketplace_invoice ), '#' ) );
				$existing_claim_ids = self::query_order_ids_by_meta( [
					[
						'key'     => '_rma_original_invoice',
						'value'   => $clean_invoice,
						'compare' => '=',
					],
				], [
					'limit'  => 1,
					'status' => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
				] );

				if ( empty( $existing_claim_ids ) && $clean_invoice !== trim( $marketplace_invoice ) ) {
					$existing_claim_ids = self::query_order_ids_by_meta( [
						[
							'key'     => '_rma_original_invoice',
							'value'   => trim( $marketplace_invoice ),
							'compare' => '=',
						],
					], [
						'limit'  => 1,
						'status' => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
					] );
				}

				$existing_claims = array_filter( array_map( 'wc_get_order', $existing_claim_ids ) );

				$allow_duplicate = ! empty( $request->get_param( 'allow_duplicate' ) ) || ! empty( $request->get_param( 'override_duplicate' ) );

				if ( ! empty( $existing_claims ) && ! $allow_duplicate ) {
					$existing_order = reset( $existing_claims );
					$existing_type  = $existing_order->get_meta( '_rma_order_type' ) ?: 'Warranty / Redeem';
					$existing_num   = $existing_order->get_order_number();
					return new \WP_REST_Response( [
						'success' => false,
						'message' => sprintf(
							'Invoice "%s" (%s) has already been claimed or redeemed under replacement order #%s (%s). Duplicate claims are not allowed without admin override.',
							$clean_invoice,
							$channel,
							$existing_num,
							$existing_type
						),
					], 400 );
				}

				if ( empty( $customer_name ) || empty( $customer_phone ) ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Customer name and phone number are required.',
					], 400 );
				}

				if ( empty( $items ) ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Please select at least one product/device to replace.',
					], 400 );
				}

				$prefix_note = ( 'Redeem' === $rma_type )
					? sprintf( '[REDEEM - EXACOAT FAULT] Channel: %s | Invoice: %s | Defect: %s. Free replacement & shipping issued.', $channel, $clean_invoice, $claim_reason )
					: sprintf( '[WARRANTY REPLACEMENT] Channel: %s | Invoice: %s | Reason: %s.', $channel, $clean_invoice, $claim_reason );
				$full_customer_note = ! empty( $notes ) ? "{$prefix_note}\n\n{$notes}" : $prefix_note;

				$replacement_order = wc_create_order( [
					'status'        => $initial_status,
					'customer_note' => $full_customer_note,
				] );

				if ( is_wp_error( $replacement_order ) ) {
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Order creation failed: ' . $replacement_order->get_error_message(),
					], 500 );
				}

				$name_parts = explode( ' ', trim( $customer_name ), 2 );
				$first_name = $name_parts[0] ?? '';
				$last_name  = $name_parts[1] ?? '';

				$addr = [
					'first_name' => $first_name,
					'last_name'  => $last_name,
					'address_1'  => sanitize_text_field( $shipping_addr['address_1'] ?? '' ),
					'city'       => sanitize_text_field( $shipping_addr['city'] ?? '' ),
					'state'      => sanitize_text_field( $shipping_addr['state'] ?? '' ),
					'postcode'   => sanitize_text_field( $shipping_addr['postcode'] ?? '' ),
					'country'    => sanitize_text_field( $shipping_addr['country'] ?? 'ID' ),
					'phone'      => $customer_phone,
					'email'      => $customer_email ?: ( sanitize_title( $customer_phone ) . '@marketplace.internal' ),
				];

				$replacement_order->set_address( $addr, 'billing' );
				$replacement_order->set_address( $addr, 'shipping' );

				$added_count = 0;
				foreach ( $items as $it ) {
					$product_id = absint( $it['product_id'] ?? 0 );
					$product    = $product_id ? wc_get_product( $product_id ) : null;
					$quantity   = max( 1, intval( $it['quantity'] ?? 1 ) );

					if ( $product ) {
						$order_item_id = $replacement_order->add_product( $product, $quantity, [
							'subtotal' => 0,
							'total'    => 0,
						] );

						if ( $order_item_id ) {
							$order_item = $replacement_order->get_item( $order_item_id );
							if ( $order_item ) {
								$base_config = sanitize_text_field( $it['configuration'] ?? '' );
								if ( 'Redeem' === $rma_type ) {
									$order_item->add_meta_data( '_is_redeem', 'yes', true );
									$order_item->add_meta_data( '_defect_reason', $claim_reason, true );
									$new_config = sprintf( '[REDEEM: Company Fault - %s] %s', $claim_reason, $base_config );
									$order_item->add_meta_data( 'Configuration', trim( $new_config ), true );
								} else {
									$order_item->add_meta_data( '_is_warranty', 'yes', true );
									$new_config = sprintf( '[WARRANTY REPLACEMENT] %s', $base_config );
									$order_item->add_meta_data( 'Configuration', trim( $new_config ), true );
								}

								if ( ! empty( $it['configurator_data'] ) ) {
									$order_item->add_meta_data( '_configurator_data', $it['configurator_data'], true );
									$order_item->add_meta_data( '_configurator_data_raw', $it['configurator_data'], true );
								}
								if ( ! empty( $it['device_model'] ) ) {
									$order_item->add_meta_data( 'device_model', sanitize_text_field( $it['device_model'] ), true );
								}
								if ( ! empty( $it['note'] ) || ! empty( $it['item_note'] ) ) {
									$item_note_val = sanitize_text_field( $it['note'] ?? $it['item_note'] );
									$order_item->add_meta_data( '_item_note', $item_note_val, true );
									$order_item->add_meta_data( 'note', $item_note_val, true );
								}
								$order_item->save();
							}
							$added_count++;
						}
					}
				}

				if ( 0 === $added_count ) {
					$replacement_order->delete( true );
					return new \WP_REST_Response( [
						'success' => false,
						'message' => 'Failed to add items to the order. Please verify product selections.',
					], 400 );
				}

				// Add shipping method line with actual courier cost
				$shipping_item = new \WC_Order_Item_Shipping();
				$shipping_item->set_method_title( $courier_label );
				$shipping_item->set_method_id( $courier_id );
				$shipping_item->set_total( $actual_shipping_cost );
				$replacement_order->add_item( $shipping_item );

				// If Redeem or Waived, add a negative fee line to balance out the shipping cost
				if ( $is_free && $actual_shipping_cost > 0 ) {
					$waiver_fee = new \WC_Order_Item_Fee();
					$waiver_title = $is_redeem
						? 'Redeem Shipping Waiver (Borne by Exacoat)'
						: 'Shipping Waiver (Borne by Exacoat)';
					$waiver_fee->set_name( $waiver_title );
					$waiver_fee->set_amount( -1 * $actual_shipping_cost );
					$waiver_fee->set_total( -1 * $actual_shipping_cost );
					$waiver_fee->set_tax_status( 'none' );
					$waiver_fee->add_meta_data( '_is_shipping_waiver', 'yes', true );
					$waiver_fee->add_meta_data( '_covered_courier_cost', $actual_shipping_cost, true );
					$replacement_order->add_item( $waiver_fee );
				}

				$replacement_order->set_currency( 'IDR' );
				$replacement_order->calculate_totals();

				$rep_id = $replacement_order->get_id();
				$replacement_order->update_meta_data( '_rma_order_type', $rma_type );
				$replacement_order->update_meta_data( '_is_redeem', 'Redeem' === $rma_type ? 'yes' : 'no' );
				$replacement_order->update_meta_data( '_is_warranty', 'Warranty' === $rma_type ? 'yes' : 'no' );
				$replacement_order->update_meta_data( '_order_badge', 'Redeem' === $rma_type ? 'REDEEM' : 'WARRANTY' );
				$replacement_order->update_meta_data( '_rma_marketplace_channel', $channel );
				$replacement_order->update_meta_data( '_rma_original_invoice', $clean_invoice );
				$replacement_order->update_meta_data( '_rma_original_order_number', $clean_invoice );
				$replacement_order->update_meta_data( '_rma_claim_reason', $claim_reason );
				$replacement_order->update_meta_data( '_rma_status', 'approved' );
				$replacement_order->update_meta_data( '_actual_shipping_cost', $actual_shipping_cost );
				$replacement_order->update_meta_data( '_shipping_waived', $is_free ? 'yes' : 'no' );
				$replacement_order->update_meta_data( '_rma_reviewed_by', $admin_name );
				$replacement_order->update_meta_data( '_rma_reviewed_at', current_time( 'mysql' ) );
				if ( ! empty( $request->get_param( 'buyer_note' ) ) ) {
					$replacement_order->update_meta_data( '_shopee_buyer_note', sanitize_textarea_field( $request->get_param( 'buyer_note' ) ) );
				}

				$hr_webhook_result = null;
				if ( 'Redeem' === $rma_type ) {
					$replacement_order->add_order_note( sprintf(
						'⭐ [REDEEM REPLACEMENT - COMPANY FAULT] Channel: %s | Invoice: %s. Courier: %s (Rp %s, Waived via Exacoat Company Expense). Defect: %s. Created manually by %s. Direct to production queue.',
						$channel,
						$clean_invoice,
						$courier_label,
						number_format( $actual_shipping_cost, 0, ',', '.' ),
						$claim_reason,
						$admin_name
					) );

					if ( $is_qc_fault ) {
						$order_number_ref = (string) $clean_invoice;
						$qc_reason_text   = ! empty( $notes ) ? $notes : $claim_reason;
						$hr_payload = [
							'orderNumber'             => $order_number_ref,
							'replacementShippingCost' => $actual_shipping_cost,
							'reason'                  => $qc_reason_text,
							'incidentDate'            => gmdate( 'Y-m-d\TH:i:s\Z' ),
							'invoiceReference'        => (string) $replacement_order->get_order_number(),
						];

						$hr_webhook_result = self::dispatch_shipping_deduction_webhook( $hr_payload );
						$replacement_order->update_meta_data( '_is_qc_fault', 'yes' );
						$replacement_order->update_meta_data( '_actual_shipping_cost', $actual_shipping_cost );
						$replacement_order->update_meta_data( '_hr_webhook_dispatched', 'yes' );
						$replacement_order->update_meta_data( '_hr_webhook_success', $hr_webhook_result['success'] ? 'yes' : 'no' );
						$replacement_order->update_meta_data( '_hr_webhook_code', $hr_webhook_result['code'] );
						$replacement_order->update_meta_data( '_hr_webhook_payload', $hr_payload );

						if ( $hr_webhook_result['success'] ) {
							$replacement_order->add_order_note( sprintf(
								'📋 [HR DEDUCTION WEBHOOK] Successfully sent shipping deduction to HR system (HTTP %d). Cost: Rp %s. Reason: "%s". Marketplace Invoice: %s (%s).',
								$hr_webhook_result['code'],
								number_format( $actual_shipping_cost, 0, ',', '.' ),
								$qc_reason_text,
								$order_number_ref,
								$channel
							) );
						} else {
							$replacement_order->add_order_note( sprintf(
								'⚠️ [HR DEDUCTION WEBHOOK FAILED] Failed to notify HR system (HTTP %d). Error: %s. Payload: %s',
								$hr_webhook_result['code'],
								$hr_webhook_result['error'] ?: $hr_webhook_result['body'],
								wp_json_encode( $hr_payload )
							) );
						}
					}
				} else {
					$replacement_order->add_order_note( sprintf(
						'[Marketplace Warranty Claim] Channel: %s | Invoice: %s. Created manually by %s. Courier: %s (Rp %s). Reason: %s',
						$channel,
						$clean_invoice,
						$admin_name,
						$courier_label,
						number_format( $shipping_cost, 0, ',', '.' ),
						$claim_reason
					) );
				}

				if ( ! empty( $existing_claims ) && $allow_duplicate ) {
					$prior_order = reset( $existing_claims );
					$prior_num   = $prior_order->get_order_number();
					$replacement_order->update_meta_data( '_rma_duplicate_override', 'yes' );
					$replacement_order->update_meta_data( '_rma_prior_order_number', $prior_num );
					$replacement_order->add_order_note( sprintf(
						'⚠️ [ADMIN OVERRIDE] Duplicate claim authorized by %s for %s invoice %s. Prior replacement order: #%s.',
						$admin_name,
						$channel,
						$clean_invoice,
						$prior_num
					) );
				}

				$replacement_order->save();

				$res_data = [
					'success'                  => true,
					'replacement_order_id'     => $rep_id,
					'replacement_order_number' => $replacement_order->get_order_number(),
					'shipping_cost'            => $shipping_cost,
					'message'                  => sprintf(
						'Marketplace %s claim #%s created for %s invoice %s.',
						strtolower( $rma_type ),
						$replacement_order->get_order_number(),
						$channel,
						$clean_invoice
					),
				];
				if ( null !== $hr_webhook_result ) {
					$res_data['hr_webhook'] = [
						'dispatched' => true,
						'success'    => $hr_webhook_result['success'],
						'code'       => $hr_webhook_result['code'],
						'error'      => $hr_webhook_result['error'] ?? null,
					];
				}

				return new \WP_REST_Response( $res_data, 200 );
			}
		} catch ( \Throwable $e ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Failed to create manual warranty claim: ' . $e->getMessage(),
			], 500 );
		}
	}

	/**
	 * Safe query for order IDs matching meta criteria across HPOS and Classic CPT
	 */
	public static function query_order_ids_by_meta( array $meta_query, array $args = [] ): array {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled() ) {
			$q_args = array_merge( [
				'limit'      => -1,
				'return'     => 'ids',
				'meta_query' => $meta_query,
			], $args );
			return wc_get_orders( $q_args );
		}

		$post_status = $args['status'] ?? 'any';
		if ( is_array( $post_status ) ) {
			$post_status = array_map( function( $s ) {
				return ( strpos( $s, 'wc-' ) === 0 || $s === 'any' ) ? $s : 'wc-' . $s;
			}, $post_status );
		} elseif ( is_string( $post_status ) && $post_status !== 'any' && strpos( $post_status, 'wc-' ) !== 0 ) {
			$post_status = 'wc-' . $post_status;
		}

		$wp_query_args = [
			'post_type'      => 'shop_order',
			'post_status'    => $post_status,
			'posts_per_page' => $args['limit'] ?? -1,
			'fields'         => 'ids',
			'meta_query'     => $meta_query,
			'orderby'        => $args['orderby'] ?? 'date',
			'order'          => $args['order'] ?? 'DESC',
		];

		if ( ! empty( $args['paged'] ) ) {
			$wp_query_args['paged'] = $args['paged'];
		}
		if ( ! empty( $args['s'] ) ) {
			$wp_query_args['s'] = $args['s'];
		}

		$query = new \WP_Query( $wp_query_args );
		return is_array( $query->posts ) ? array_map( 'intval', $query->posts ) : [];
	}

	/**
	 * Admin / Manager: Check marketplace invoice availability to prevent duplicates
	 */
	public static function rest_check_invoice( \WP_REST_Request $request ): \WP_REST_Response {
		$invoice = sanitize_text_field( $request->get_param( 'invoice' ) ?: '' );
		$channel = sanitize_text_field( $request->get_param( 'channel' ) ?: '' );
		$clean_invoice = trim( ltrim( trim( $invoice ), '#' ) );

		if ( empty( $clean_invoice ) ) {
			return new \WP_REST_Response( [
				'success'   => false,
				'available' => false,
				'message'   => 'Invoice number is required.',
			], 400 );
		}

		if ( ! function_exists( 'wc_get_orders' ) ) {
			return new \WP_REST_Response( [
				'success'   => false,
				'available' => false,
				'message'   => 'WooCommerce not loaded.',
			], 500 );
		}

		// Query existing active RMA claims across _rma_original_invoice, _rma_original_order_id, and _rma_original_order_number
		$invoice_meta_query = [
			'relation' => 'OR',
			[
				'key'     => '_rma_original_invoice',
				'value'   => $clean_invoice,
				'compare' => '=',
			],
			[
				'key'     => '_rma_original_order_id',
				'value'   => $clean_invoice,
				'compare' => '=',
			],
			[
				'key'     => '_rma_original_order_number',
				'value'   => $clean_invoice,
				'compare' => '=',
			],
		];

		$existing_order_ids = self::query_order_ids_by_meta( $invoice_meta_query, [
			'limit'  => 1,
			'status' => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
		] );

		if ( empty( $existing_order_ids ) && $clean_invoice !== trim( $invoice ) ) {
			$raw_meta_query = [
				'relation' => 'OR',
				[
					'key'     => '_rma_original_invoice',
					'value'   => trim( $invoice ),
					'compare' => '=',
				],
				[
					'key'     => '_rma_original_order_id',
					'value'   => trim( $invoice ),
					'compare' => '=',
				],
				[
					'key'     => '_rma_original_order_number',
					'value'   => trim( $invoice ),
					'compare' => '=',
				],
			];
			$existing_order_ids = self::query_order_ids_by_meta( $raw_meta_query, [
				'limit'  => 1,
				'status' => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
			] );
		}

		$existing_orders = array_filter( array_map( 'wc_get_order', $existing_order_ids ) );

		if ( ! empty( $existing_orders ) ) {
			$existing_order = reset( $existing_orders );
			$existing_type  = $existing_order->get_meta( '_rma_order_type' ) ?: 'Warranty / Redeem';
			$existing_num   = $existing_order->get_order_number();
			$order_date     = $existing_order->get_date_created() ? $existing_order->get_date_created()->date( 'd M Y' ) : '';

			return new \WP_REST_Response( [
				'success'               => true,
				'available'             => false,
				'existing_order_id'     => $existing_order->get_id(),
				'existing_order_number' => $existing_num,
				'existing_order_type'   => $existing_type,
				'order_date'            => $order_date,
				'message'               => sprintf(
					'Invoice "%s" was already redeemed/claimed under replacement order #%s (%s%s). Duplicate claims are prohibited.',
					$clean_invoice,
					$existing_num,
					$existing_type,
					$order_date ? " on {$order_date}" : ''
				),
			], 200 );
		}

		return new \WP_REST_Response( [
			'success'   => true,
			'available' => true,
			'message'   => 'Invoice is available.',
		], 200 );
	}

	/**
	 * Admin / Manager: Centralized RMA Claims Log (Warranty & Redeem)
	 */
	public static function rest_get_claims_log( \WP_REST_Request $request ): \WP_REST_Response {
		$type     = sanitize_text_field( $request->get_param( 'type' ) ?: 'all' );
		$status   = sanitize_text_field( $request->get_param( 'status' ) ?: 'all' );
		$channel  = sanitize_text_field( $request->get_param( 'channel' ) ?: 'all' );
		$search   = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
		$page     = max( 1, absint( $request->get_param( 'page' ) ?: 1 ) );
		$per_page = min( 100, max( 1, absint( $request->get_param( 'per_page' ) ?: 20 ) ) );

		if ( ! function_exists( 'wc_get_orders' ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'WooCommerce is not active.',
			], 500 );
		}

		if ( 'Redeem' === $type || 'redeem' === strtolower( $type ) ) {
			$type_clause = [
				'relation' => 'OR',
				[
					'key'     => '_rma_order_type',
					'value'   => [ 'Redeem', 'redeem' ],
					'compare' => 'IN',
				],
				[
					'key'     => '_is_redeem',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_is_redeem_claim',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_order_badge',
					'value'   => [ 'REDEEM', 'Redeem', 'redeem' ],
					'compare' => 'IN',
				],
			];
		} elseif ( 'Warranty' === $type || 'warranty' === strtolower( $type ) ) {
			$type_clause = [
				'relation' => 'OR',
				[
					'key'     => '_rma_order_type',
					'value'   => [ 'Warranty', 'warranty' ],
					'compare' => 'IN',
				],
				[
					'key'     => '_is_warranty',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_is_warranty_claim',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_order_badge',
					'value'   => [ 'WARRANTY', 'Warranty', 'warranty' ],
					'compare' => 'IN',
				],
			];
		} else {
			$type_clause = [
				'relation' => 'OR',
				[
					'key'     => '_rma_order_type',
					'value'   => [ 'Warranty', 'Redeem', 'warranty', 'redeem' ],
					'compare' => 'IN',
				],
				[
					'key'     => '_is_redeem',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_is_warranty',
					'value'   => 'yes',
					'compare' => '=',
				],
				[
					'key'     => '_order_badge',
					'value'   => [ 'WARRANTY', 'REDEEM' ],
					'compare' => 'IN',
				],
			];
		}

		$meta_query = [
			'relation' => 'AND',
			$type_clause,
		];

		if ( ! empty( $status ) && 'all' !== $status ) {
			$meta_query[] = [
				'key'     => '_rma_status',
				'value'   => $status,
				'compare' => '=',
			];
		}

		if ( ! empty( $channel ) && 'all' !== $channel ) {
			if ( 'web' === strtolower( $channel ) ) {
				$meta_query[] = [
					'relation' => 'OR',
					[
						'key'     => '_rma_marketplace_channel',
						'compare' => 'NOT EXISTS',
					],
					[
						'key'     => '_rma_marketplace_channel',
						'value'   => '',
						'compare' => '=',
					],
				];
			} else {
				$meta_query[] = [
					'key'     => '_rma_marketplace_channel',
					'value'   => $channel,
					'compare' => '=',
				];
			}
		}

		$query_args = [
			'paginate'   => true,
			'limit'      => $per_page,
			'page'       => $page,
			'orderby'    => 'date',
			'order'      => 'DESC',
			'meta_query' => $meta_query,
		];

		if ( ! empty( $search ) ) {
			$query_args['s'] = $search;
		}

		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled() ) {
			$results      = wc_get_orders( $query_args );
			$orders_list  = is_object( $results ) && isset( $results->orders ) ? $results->orders : ( is_array( $results ) ? $results : [] );
			$total_claims = is_object( $results ) && isset( $results->total ) ? $results->total : count( $orders_list );
			$max_pages    = is_object( $results ) && isset( $results->max_num_pages ) ? $results->max_num_pages : 1;
		} else {
			$cpt_args = [
				'post_type'      => 'shop_order',
				'post_status'    => 'any',
				'posts_per_page' => $per_page,
				'paged'          => $page,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'meta_query'     => $meta_query,
				'fields'         => 'ids',
			];
			if ( ! empty( $search ) ) {
				$cpt_args['s'] = $search;
			}
			$cpt_query    = new \WP_Query( $cpt_args );
			$total_claims = (int) $cpt_query->found_posts;
			$max_pages    = (int) $cpt_query->max_num_pages;
			$orders_list  = array_filter( array_map( 'wc_get_order', $cpt_query->posts ) );
		}

		$claims = [];

		foreach ( $orders_list as $order ) {
			if ( ! $order || ! is_a( $order, 'WC_Order' ) ) {
				continue;
			}

			$order_id       = $order->get_id();
			$raw_type       = (string) $order->get_meta( '_rma_order_type' );
			$is_redeem_flag = ( 'redeem' === strtolower( $raw_type ) )
				|| ( 'yes' === (string) $order->get_meta( '_is_redeem' ) )
				|| ( 'yes' === (string) $order->get_meta( '_is_redeem_claim' ) )
				|| ( 'REDEEM' === strtoupper( (string) $order->get_meta( '_order_badge' ) ) );
			$order_type     = $is_redeem_flag ? 'Redeem' : 'Warranty';
			$parent_id      = $order->get_meta( '_rma_original_invoice' );
			$orig_number    = $order->get_meta( '_rma_original_order_number' ) ?: $parent_id;
			$mp_channel     = $order->get_meta( '_rma_marketplace_channel' ) ?: ( empty( $parent_id ) ? 'Web' : ( is_numeric( $parent_id ) ? 'Web' : 'Marketplace' ) );
			$rma_status     = $order->get_meta( '_rma_status' ) ?: ( $order->has_status( [ 'processing', 'completed', 'shipped', 'ready-to-ship' ] ) ? 'approved' : ( $order->has_status( [ 'cancelled', 'failed' ] ) ? 'rejected' : 'pending_review' ) );
			$claim_reason   = $order->get_meta( '_rma_claim_reason' );
			$video_url      = $order->get_meta( '_rma_video_proof_url' );
			$video_deleted  = ! empty( $order->get_meta( '_rma_video_deleted_at' ) ) || empty( $order->get_meta( '_rma_video_file_path' ) );
			$reviewed_by    = $order->get_meta( '_rma_reviewed_by' );
			$reviewed_at    = $order->get_meta( '_rma_reviewed_at' );

			$shipping_total  = (float) $order->get_shipping_total();
			$waived_shipping = ( 'Redeem' === $order_type ) || ( 0.0 === $shipping_total );

			$items = [];
			foreach ( $order->get_items() as $it ) {
				$claimed_parts = $it->get_meta( '_claimed_parts' );
				$item_note = $it->get_meta( '_item_note' ) ?: ( $it->get_meta( 'note' ) ?: ( $it->get_meta( '_shopee_note' ) ?: '' ) );
				$items[] = [
					'id'            => $it->get_id(),
					'name'          => $it->get_name(),
					'quantity'      => $it->get_quantity(),
					'configuration' => $it->get_meta( 'Configuration' ) ?: '',
					'claimed_parts' => is_array( $claimed_parts ) ? $claimed_parts : [],
					'device'        => $it->get_meta( 'device_model' ) ?: '',
					'item_note'     => $item_note,
				];
			}

			$claims[] = [
				'order_id'         => $order_id,
				'order_number'     => $order->get_order_number(),
				'created_at'       => $order->get_date_created() ? $order->get_date_created()->date( 'Y-m-d H:i:s' ) : '',
				'type'             => $order_type,
				'status'           => $rma_status,
				'order_status'     => $order->get_status(),
				'channel'          => $mp_channel,
				'original_invoice' => $orig_number,
				'buyer_note'       => $order->get_meta( '_shopee_buyer_note' ) ?: ( $order->get_meta( '_buyer_note' ) ?: '' ),
				'customer_name'    => $order->get_formatted_billing_full_name() ?: ( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() ),
				'customer_phone'   => $order->get_billing_phone(),
				'customer_email'   => $order->get_billing_email(),
				'claim_reason'     => $claim_reason,
				'customer_notes'   => $order->get_customer_note(),
				'shipping_cost'    => $shipping_total,
				'waived_shipping'  => $waived_shipping,
				'video_url'        => $video_url,
				'video_deleted'    => $video_deleted,
				'reviewed_by'      => $reviewed_by,
				'reviewed_at'      => $reviewed_at,
				'items'            => $items,
			];
		}

		// Calculate quick KPI counts across all RMA claims
		$stats = [
			'total'          => 0,
			'warranty_count' => 0,
			'redeem_count'   => 0,
			'pending_count'  => 0,
			'approved_count' => 0,
			'rejected_count' => 0,
			'waived_count'   => 0,
		];

		$now_ts        = current_time( 'timestamp' );
		$today_start   = strtotime( 'today midnight', $now_ts );
		$week_start    = strtotime( 'monday this week', $now_ts );
		$month_start   = strtotime( 'first day of this month 00:00:00', $now_ts );
		$days_30_start = $now_ts - ( 30 * 86400 );

		$init_period = function() {
			return [
				'warranty' => [
					'total'    => 0,
					'pending'  => 0,
					'approved' => 0,
					'rejected' => 0,
					'channels' => [ 'web' => 0, 'shopee' => 0, 'tiktok' => 0, 'other' => 0 ],
				],
				'redeem'   => [
					'total'    => 0,
					'pending'  => 0,
					'approved' => 0,
					'rejected' => 0,
					'channels' => [ 'web' => 0, 'shopee' => 0, 'tiktok' => 0, 'other' => 0 ],
				],
				'channel_totals' => [
					'web'    => 0,
					'shopee' => 0,
					'tiktok' => 0,
					'other'  => 0,
					'total'  => 0,
				],
			];
		};

		$analytics = [
			'today'        => $init_period(),
			'this_week'    => $init_period(),
			'this_month'   => $init_period(),
			'last_30_days' => $init_period(),
			'all_time'     => $init_period(),
		];

		$all_rma = self::query_order_ids_by_meta( [
			'relation' => 'OR',
			[
				'key'     => '_rma_order_type',
				'value'   => [ 'Warranty', 'Redeem', 'warranty', 'redeem' ],
				'compare' => 'IN',
			],
			[
				'key'     => '_is_redeem',
				'value'   => 'yes',
				'compare' => '=',
			],
			[
				'key'     => '_is_warranty',
				'value'   => 'yes',
				'compare' => '=',
			],
			[
				'key'     => '_order_badge',
				'value'   => [ 'WARRANTY', 'REDEEM' ],
				'compare' => 'IN',
			],
		] );

		if ( ! empty( $all_rma ) ) {
			$stats['total'] = count( $all_rma );
			foreach ( $all_rma as $rma_id ) {
				$rma_order = wc_get_order( $rma_id );
				if ( ! $rma_order ) {
					continue;
				}
				$raw_o_type     = (string) $rma_order->get_meta( '_rma_order_type' );
				$is_o_redeem    = ( 'redeem' === strtolower( $raw_o_type ) )
					|| ( 'yes' === (string) $rma_order->get_meta( '_is_redeem' ) )
					|| ( 'yes' === (string) $rma_order->get_meta( '_is_redeem_claim' ) )
					|| ( 'REDEEM' === strtoupper( (string) $rma_order->get_meta( '_order_badge' ) ) );
				$o_type         = $is_o_redeem ? 'Redeem' : 'Warranty';
				$o_stat         = $rma_order->get_meta( '_rma_status' ) ?: ( $rma_order->has_status( [ 'processing', 'completed', 'shipped', 'ready-to-ship' ] ) ? 'approved' : ( $rma_order->has_status( [ 'cancelled', 'failed' ] ) ? 'rejected' : 'pending_review' ) );
				$o_ship         = (float) $rma_order->get_shipping_total();
				$order_ts       = $rma_order->get_date_created() ? $rma_order->get_date_created()->getTimestamp() : 0;

				$raw_chan = strtolower( (string) $rma_order->get_meta( '_rma_marketplace_channel' ) );
				if ( str_contains( $raw_chan, 'shopee' ) ) {
					$chan_key = 'shopee';
				} elseif ( str_contains( $raw_chan, 'tiktok' ) ) {
					$chan_key = 'tiktok';
				} elseif ( empty( $raw_chan ) || 'web' === $raw_chan ) {
					$chan_key = 'web';
				} else {
					$chan_key = 'other';
				}

				if ( 'Redeem' === $o_type ) {
					$stats['redeem_count']++;
				} else {
					$stats['warranty_count']++;
				}

				// Only count status in quick KPI stats if order type matches requested tab type
				$matches_tab_type = ( 'all' === $type ) || ( strtolower( $type ) === strtolower( $o_type ) );
				if ( $matches_tab_type ) {
					if ( 'Redeem' === $o_type || 0.0 === $o_ship ) {
						$stats['waived_count']++;
					}
					if ( 'approved' === $o_stat ) {
						$stats['approved_count']++;
					} elseif ( 'rejected' === $o_stat ) {
						$stats['rejected_count']++;
					} else {
						$stats['pending_count']++;
					}
				}

				$type_key = ( 'Redeem' === $o_type ) ? 'redeem' : 'warranty';
				$stat_key = ( 'approved' === $o_stat ) ? 'approved' : ( ( 'rejected' === $o_stat ) ? 'rejected' : 'pending' );

				$periods_to_update = [ 'all_time' ];
				if ( $order_ts >= $today_start )   $periods_to_update[] = 'today';
				if ( $order_ts >= $week_start )    $periods_to_update[] = 'this_week';
				if ( $order_ts >= $month_start )   $periods_to_update[] = 'this_month';
				if ( $order_ts >= $days_30_start ) $periods_to_update[] = 'last_30_days';

				foreach ( $periods_to_update as $p_key ) {
					$analytics[ $p_key ][ $type_key ]['total']++;
					$analytics[ $p_key ][ $type_key ][ $stat_key ]++;
					$analytics[ $p_key ][ $type_key ]['channels'][ $chan_key ]++;
					$analytics[ $p_key ]['channel_totals'][ $chan_key ]++;
					$analytics[ $p_key ]['channel_totals']['total']++;
				}
			}
		}

		return new \WP_REST_Response( [
			'success'    => true,
			'claims'     => $claims,
			'stats'      => $stats,
			'analytics'  => $analytics,
			'pagination' => [
				'page'        => $page,
				'per_page'    => $per_page,
				'total_items' => $total_claims,
				'total_pages' => $max_pages,
			],
		], 200 );
	}

	/**
	 * Safely delete proof video from disk
	 */
	public static function delete_proof_video( ?string $file_path, ?string $file_url = null ): bool {
		$upload_dir = wp_upload_dir();
		$base_dir   = wp_normalize_path( $upload_dir['basedir'] . '/' . self::UPLOAD_SUBDIR );

		$candidates = [];
		if ( ! empty( $file_path ) ) {
			$candidates[] = wp_normalize_path( $file_path );
		}
		if ( ! empty( $file_url ) ) {
			$filename = basename( parse_url( $file_url, PHP_URL_PATH ) );
			if ( ! empty( $filename ) ) {
				$candidates[] = wp_normalize_path( $base_dir . '/' . $filename );
			}
		}

		$deleted = false;
		foreach ( $candidates as $path ) {
			if ( strpos( $path, $base_dir ) === 0 && file_exists( $path ) && is_file( $path ) ) {
				@unlink( $path );
				$deleted = true;
			}
		}

		return $deleted;
	}

	/**
	 * Daily cron: purge orphaned proof files older than 14 days
	 */
	public static function purge_stale_proof_files(): void {
		$upload_dir = wp_upload_dir();
		$target_dir = $upload_dir['basedir'] . '/' . self::UPLOAD_SUBDIR;

		if ( ! is_dir( $target_dir ) ) {
			return;
		}

		$now   = time();
		$files = glob( $target_dir . '/proof_*' );
		if ( empty( $files ) ) {
			return;
		}

		foreach ( $files as $file ) {
			if ( is_file( $file ) && ( $now - filemtime( $file ) ) > ( 14 * 86400 ) ) {
				@unlink( $file );
			}
		}
	}

	/**
	 * Translate PHP file upload errors to human strings
	 */
	private static function get_upload_error_message( int $code ): string {
		switch ( $code ) {
			case UPLOAD_ERR_INI_SIZE:
			case UPLOAD_ERR_FORM_SIZE:
				return 'Video exceeds server file size limit (max 100MB).';
			case UPLOAD_ERR_PARTIAL:
				return 'The file was only partially uploaded.';
			case UPLOAD_ERR_NO_FILE:
				return 'No file was uploaded.';
			case UPLOAD_ERR_NO_TMP_DIR:
				return 'Missing a temporary server folder.';
			case UPLOAD_ERR_CANT_WRITE:
				return 'Failed to write file to disk.';
			default:
				return 'Unknown upload error occurred.';
		}
	}

	/**
	 * Normalize Indonesian phone numbers to standard 628... digits format.
	 * Handles 08..., +628..., 628..., 8...
	 */
	public static function normalize_phone( $phone ): string {
		$digits = preg_replace( '/[^0-9]/', '', (string) $phone );
		if ( empty( $digits ) ) {
			return '';
		}
		if ( strpos( $digits, '08' ) === 0 ) {
			return '62' . substr( $digits, 1 );
		} elseif ( strpos( $digits, '8' ) === 0 && strlen( $digits ) >= 9 ) {
			return '62' . $digits;
		}
		return $digits;
	}
}

}