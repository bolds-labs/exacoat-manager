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
		// Public: Check eligibility for an order
		register_rest_route( 'exacoat-core/v1', '/warranty/check-eligibility', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
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
			return new \WP_REST_Response( [
				'success'  => false,
				'eligible' => false,
				'reason'   => 'order_not_found',
				'message'  => 'Order #' . esc_html( $order_param ) . ' was not found. Please verify your order number.',
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
		$delivered_at_str = $order->get_meta( '_delivered_at' ) ?: $order->get_meta( '_artmatter_delivered_at' );

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
			if ( $product ) {
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
	 * Upload 5-piece cut video proof (max 100MB)
	 */
	public static function rest_upload_proof( \WP_REST_Request $request ): \WP_REST_Response {
		$order_id = absint( $request->get_param( 'order_id' ) );
		if ( empty( $order_id ) ) {
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
		$filename     = sprintf( 'proof_%d_%s.%s', $order_id, $unique_token, $ext );
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

		$postcode = sanitize_text_field( trim( (string) $request->get_param( 'postcode' ) ) );
		if ( empty( $postcode ) && $order ) {
			$postcode = trim( $order->get_shipping_postcode() ?: $order->get_billing_postcode() );
		}

		$country = sanitize_text_field( trim( (string) ( $request->get_param( 'destination_country' ) ?: $request->get_param( 'country' ) ) ) );
		if ( empty( $country ) && $order ) {
			$country = trim( $order->get_shipping_country() ?: $order->get_billing_country() );
		}
		if ( empty( $country ) ) {
			$country = 'ID';
		}

		if ( empty( $postcode ) ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Postal code is required.',
			], 400 );
		}

		if ( 'ID' !== $country ) {
			return new \WP_REST_Response( [
				'success'     => true,
				'is_fallback' => false,
				'postcode'    => $postcode,
				'rates'       => [
					[
						'id'       => 'pos_international',
						'courier'  => 'pos',
						'service'  => 'Standard Registered',
						'label'    => 'POS Indonesia International Registered',
						'price'    => 50000,
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
				'couriers'                => 'jne,sicepat,jnt',
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
						if ( empty( $rate['shipping_type'] ) || ( $rate['shipping_type'] ?? '' ) === 'parcel' ) {
							$rates[] = [
								'id'       => ( $rate['courier_code'] ?? 'courier' ) . '_' . ( $rate['courier_service_code'] ?? 'service' ),
								'courier'  => $rate['courier_code'] ?? '',
								'service'  => $rate['courier_service_code'] ?? '',
								'label'    => sprintf( '%s %s', strtoupper( $rate['courier_name'] ?? '' ), strtoupper( $rate['courier_service_code'] ?? '' ) ),
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

		$items = [];
		foreach ( $order->get_items() as $item ) {
			$product = $item->get_product();
			$image_url = '';
			if ( $product && $product->get_image_id() ) {
				$image_url = wp_get_attachment_image_url( $product->get_image_id(), 'thumbnail' ) ?: '';
			}
			$items[] = [
				'name'     => $item->get_name(),
				'quantity' => $item->get_quantity(),
				'image'    => $image_url,
			];
		}

		return new \WP_REST_Response( [
			'success'                 => true,
			'order_id'                => $order_id,
			'order_number'            => $order->get_order_number(),
			'parent_order_id'         => $parent_id,
			'parent_order_number'     => $parent_order ? $parent_order->get_order_number() : $parent_id,
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
	 * Admin / Manager: Create manual warranty or redeem claim (Web order or Marketplace Shopee / Tokopedia)
	 */
	public static function rest_create_manual_claim( \WP_REST_Request $request ): \WP_REST_Response {
		$source_type  = sanitize_text_field( $request->get_param( 'source_type' ) ?: 'marketplace' );
		$rma_type     = sanitize_text_field( $request->get_param( 'rma_type' ) ?: 'Warranty' );
		if ( ! in_array( $rma_type, [ 'Warranty', 'Redeem' ], true ) ) {
			$rma_type = 'Warranty';
		}
		$admin_name   = sanitize_text_field( $request->get_param( 'admin_name' ) ?: 'Operations Manager' );
		$claim_reason = sanitize_text_field( $request->get_param( 'claim_reason' ) ?: ( 'Redeem' === $rma_type ? 'Exacoat Defect / Production Error' : 'Manual replacement issued by admin' ) );
		$notes        = sanitize_textarea_field( $request->get_param( 'notes' ) ?: '' );
		$initial_status = sanitize_text_field( $request->get_param( 'initial_status' ) ?: 'processing' );
		if ( ! in_array( $initial_status, [ 'processing', 'on-hold', 'preparing-order' ], true ) ) {
			$initial_status = 'processing';
		}

		$courier_id     = sanitize_text_field( $request->get_param( 'courier_id' ) ?: 'jne_reg' );
		$courier_label  = sanitize_text_field( $request->get_param( 'courier_label' ) ?: 'JNE Regular' );
		$shipping_cost  = max( 0, floatval( $request->get_param( 'shipping_cost' ) ?: 0 ) );
		$waive_shipping = (bool) $request->get_param( 'waive_shipping' );
		if ( 'Redeem' === $rma_type || $waive_shipping ) {
			$shipping_cost = 0;
		}

		try {
			if ( 'existing_order' === $source_type ) {
				$parent_order_id = absint( $request->get_param( 'parent_order_id' ) );
				$parent_order    = wc_get_order( $parent_order_id );
				if ( ! parent_order ) {
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
					$curr_ship['postcode']  = sanitize_text_field( $shipping_addr['postcode'] ?? $curr_ship['postcode'] );
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

				// Add shipping method line
				$shipping_item = new \WC_Order_Item_Shipping();
				$shipping_item->set_method_title( $courier_label );
				$shipping_item->set_method_id( $courier_id );
				$shipping_item->set_total( $shipping_cost );
				$replacement_order->add_item( $shipping_item );

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
				$replacement_order->update_meta_data( '_rma_reviewed_by', $admin_name );
				$replacement_order->update_meta_data( '_rma_reviewed_at', current_time( 'mysql' ) );
				if ( ! empty( $selected_parts ) ) {
					$replacement_order->update_meta_data( '_rma_selected_parts', $selected_parts );
				}
				$replacement_order->save();

				if ( 'Redeem' === $rma_type ) {
					$parent_order->update_meta_data( '_has_redeem_claim', 'yes' );
					$parent_order->update_meta_data( '_redeem_replacement_order_id', $rep_id );
					$parent_order->add_order_note( sprintf(
						'Redeem (Company Fault) order created by %s. Replacement Order #%d created with courier %s (Free Shipping). Reason: %s',
						$admin_name,
						$rep_id,
						$courier_label,
						$claim_reason
					) );
					$parent_order->save();

					$replacement_order->add_order_note( sprintf(
						'⭐ [REDEEM REPLACEMENT - COMPANY FAULT] For Parent Order #%d. Issued by %s. Free Shipping (Rp 0). Defect: %s. Direct to production queue.',
						$parent_order_id,
						$admin_name,
						$claim_reason
					) );
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

				return new \WP_REST_Response( [
					'success'                  => true,
					'replacement_order_id'     => $rep_id,
					'replacement_order_number' => $replacement_order->get_order_number(),
					'shipping_cost'            => $shipping_cost,
					'message'                  => sprintf(
						'Manual %s replacement order #%s created successfully.',
						strtolower( $rma_type ),
						$replacement_order->get_order_number()
					),
				], 200 );

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
				$existing_claims = wc_get_orders( [
					'limit'      => 1,
					'status'     => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
					'meta_query' => [
						[
							'key'     => '_rma_original_invoice',
							'value'   => $clean_invoice,
							'compare' => '=',
						],
					],
				] );

				if ( empty( $existing_claims ) && $clean_invoice !== trim( $marketplace_invoice ) ) {
					$existing_claims = wc_get_orders( [
						'limit'      => 1,
						'status'     => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
						'meta_query' => [
							[
								'key'     => '_rma_original_invoice',
								'value'   => trim( $marketplace_invoice ),
								'compare' => '=',
							],
						],
					] );
				}

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

				// Add shipping method line
				$shipping_item = new \WC_Order_Item_Shipping();
				$shipping_item->set_method_title( $courier_label );
				$shipping_item->set_method_id( $courier_id );
				$shipping_item->set_total( $shipping_cost );
				$replacement_order->add_item( $shipping_item );

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
				$replacement_order->update_meta_data( '_rma_reviewed_by', $admin_name );
				$replacement_order->update_meta_data( '_rma_reviewed_at', current_time( 'mysql' ) );

				if ( 'Redeem' === $rma_type ) {
					$replacement_order->add_order_note( sprintf(
						'⭐ [REDEEM REPLACEMENT - COMPANY FAULT] Channel: %s | Invoice: %s. Free shipping (Rp 0). Defect: %s. Created manually by %s. Courier: %s. Direct to production queue.',
						$channel,
						$clean_invoice,
						$claim_reason,
						$admin_name,
						$courier_label
					) );
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

				return new \WP_REST_Response( [
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
				], 200 );
			}
		} catch ( \Throwable $e ) {
			return new \WP_REST_Response( [
				'success' => false,
				'message' => 'Failed to create manual warranty claim: ' . $e->getMessage(),
			], 500 );
		}
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

		// Query existing active RMA claims with this original invoice
		$existing_orders = wc_get_orders( [
			'limit'      => 1,
			'status'     => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
			'meta_query' => [
				[
					'key'     => '_rma_original_invoice',
					'value'   => $clean_invoice,
					'compare' => '=',
				],
			],
		] );

		if ( empty( $existing_orders ) && $clean_invoice !== trim( $invoice ) ) {
			$existing_orders = wc_get_orders( [
				'limit'      => 1,
				'status'     => [ 'pending', 'processing', 'on-hold', 'completed', 'shipped', 'ready-to-ship', 'delivered' ],
				'meta_query' => [
					[
						'key'     => '_rma_original_invoice',
						'value'   => trim( $invoice ),
						'compare' => '=',
					],
				],
			] );
		}

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

		$meta_query = [
			'relation' => 'AND',
			[
				'key'     => '_rma_order_type',
				'value'   => in_array( $type, [ 'Warranty', 'Redeem' ], true ) ? $type : [ 'Warranty', 'Redeem' ],
				'compare' => in_array( $type, [ 'Warranty', 'Redeem' ], true ) ? '=' : 'IN',
			],
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

		$results = wc_get_orders( $query_args );

		$claims = [];
		$orders_list  = is_object( $results ) && isset( $results->orders ) ? $results->orders : ( is_array( $results ) ? $results : [] );
		$total_claims = is_object( $results ) && isset( $results->total ) ? $results->total : count( $orders_list );
		$max_pages    = is_object( $results ) && isset( $results->max_num_pages ) ? $results->max_num_pages : 1;

		foreach ( $orders_list as $order ) {
			if ( ! $order || ! is_a( $order, 'WC_Order' ) ) {
				continue;
			}

			$order_id       = $order->get_id();
			$order_type     = $order->get_meta( '_rma_order_type' ) ?: 'Warranty';
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
				$items[] = [
					'id'            => $it->get_id(),
					'name'          => $it->get_name(),
					'quantity'      => $it->get_quantity(),
					'configuration' => $it->get_meta( 'Configuration' ) ?: '',
					'claimed_parts' => is_array( $claimed_parts ) ? $claimed_parts : [],
					'device'        => $it->get_meta( 'device_model' ) ?: '',
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

		$all_rma = wc_get_orders( [
			'limit'      => -1,
			'return'     => 'ids',
			'meta_query' => [
				[
					'key'     => '_rma_order_type',
					'value'   => [ 'Warranty', 'Redeem' ],
					'compare' => 'IN',
				],
			],
		] );

		if ( ! empty( $all_rma ) ) {
			$stats['total'] = count( $all_rma );
			foreach ( $all_rma as $rma_id ) {
				$rma_order = wc_get_order( $rma_id );
				if ( ! $rma_order ) {
					continue;
				}
				$o_type = $rma_order->get_meta( '_rma_order_type' ) ?: 'Warranty';
				$o_stat = $rma_order->get_meta( '_rma_status' );
				$o_ship = (float) $rma_order->get_shipping_total();

				if ( 'Redeem' === $o_type ) {
					$stats['redeem_count']++;
					$stats['waived_count']++;
				} else {
					$stats['warranty_count']++;
					if ( 0.0 === $o_ship ) {
						$stats['waived_count']++;
					}
				}

				if ( 'approved' === $o_stat ) {
					$stats['approved_count']++;
				} elseif ( 'rejected' === $o_stat ) {
					$stats['rejected_count']++;
				} else {
					$stats['pending_count']++;
				}
			}
		}

		return new \WP_REST_Response( [
			'success'    => true,
			'claims'     => $claims,
			'stats'      => $stats,
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