<?php
/**
 * Artmatter Luxury Checkout, Thank You & Repayment Engine Module
 * Version: 7.3.1
 * Overrides WooCommerce checkout, review-order, thankyou, and form-pay templates.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Checkout_Engine' ) ) {

class Exacoat_Checkout_Engine {

	public static function init() {
		// Apply the headless request context before WooCommerce or Aelia resolves prices.
		add_action( 'init', [ __CLASS__, 'apply_headless_currency_context' ], -999 );
		add_filter( 'woocommerce_currency', [ __CLASS__, 'filter_headless_currency' ], PHP_INT_MAX );

		// 0. Convert the headless storefront payload into an authoritative WooCommerce cart.
		add_action( 'template_redirect', [ __CLASS__, 'handle_headless_cart_handoff' ], 0 );
		add_action( 'rest_api_init', [ __CLASS__, 'register_headless_checkout_routes' ] );
		add_filter( 'woocommerce_store_api_add_to_cart_data', [ __CLASS__, 'add_store_api_cart_item_data' ], 10, 2 );

		// Register Store API extension callback for store-credit
		if ( ! did_action( 'woocommerce_blocks_loaded' ) ) {
			add_action( 'woocommerce_blocks_loaded', [ __CLASS__, 'register_store_api_callbacks' ] );
		} else {
			self::register_store_api_callbacks();
		}

		// 4. AJAX Coupon Code Apply Handler
		add_action( 'wp_ajax_artmatter_checkout_apply_coupon', [ __CLASS__, 'ajax_apply_coupon' ] );
		add_action( 'wp_ajax_nopriv_artmatter_checkout_apply_coupon', [ __CLASS__, 'ajax_apply_coupon' ] );

		// 5. Custom Shipping Method Full Label Formatter & Package Name Cleaner
		add_filter( 'woocommerce_cart_shipping_method_full_label', [ __CLASS__, 'format_shipping_method_full_label' ], 20, 2 );
		add_filter( 'woocommerce_shipping_package_name', '__return_empty_string', 99 );

		// 7. Country Locale Customization (Make Singapore & non-state countries work seamlessly)
		add_filter( 'woocommerce_get_country_locale', [ __CLASS__, 'customize_country_locales' ], 99 );
		add_filter( 'woocommerce_checkout_fields', [ __CLASS__, 'customize_checkout_fields' ], 99 );

		// 8. Auto-detect Existing User & Quick Login AJAX Handlers
		add_action( 'wp_ajax_nopriv_artmatter_check_user_exists', [ __CLASS__, 'ajax_check_user_exists' ] );
		add_action( 'wp_ajax_nopriv_artmatter_checkout_quick_login', [ __CLASS__, 'ajax_quick_login' ] );

		// Whitelist storefront domain for WordPress safe redirects
		add_filter( 'allowed_redirect_hosts', [ __CLASS__, 'filter_allowed_redirect_hosts' ] );

		// Order Received & Cancellation Redirects to Headless Storefront
		add_action( 'init', [ __CLASS__, 'handle_checkout_cancellation_redirect' ], -50 );
		add_action( 'template_redirect', [ __CLASS__, 'handle_checkout_cancellation_redirect' ], -50 );
		add_action( 'template_redirect', [ __CLASS__, 'handle_order_received_redirect' ], 5 );
		add_action( 'template_redirect', [ __CLASS__, 'handle_view_order_endpoint_redirect' ], 5 );

		// PayPal Payments Experience Context / Cancel URL Rewriting
		add_filter( 'woocommerce_paypal_payments_order_data', [ __CLASS__, 'filter_paypal_order_data' ], 99, 2 );
		add_filter( 'woocommerce_paypal_payments_create_order_request', [ __CLASS__, 'filter_paypal_order_data' ], 99, 2 );
		add_filter( 'woocommerce_get_cancel_order_url', [ __CLASS__, 'filter_cancel_order_url' ], 99, 2 );
		add_filter( 'woocommerce_get_cancel_order_url_raw', [ __CLASS__, 'filter_cancel_order_url_raw' ], 99, 1 );

		// Order Item Thumbnail for Transactional Emails & Admin
		add_filter( 'woocommerce_order_item_thumbnail', [ __CLASS__, 'filter_order_item_thumbnail' ], 10, 2 );
		add_filter( 'woocommerce_admin_order_item_thumbnail', [ __CLASS__, 'filter_order_item_thumbnail' ], 10, 2 );

		// Headless checkout templates, asset enqueues, and legacy overrides are strictly opt-in.
		// When disabled (default 0), standard WooCommerce and Bricks checkout and cart templates operate normally.
		if ( Exacoat_Core::get_setting( 'enable_headless_checkout', 0 ) ) {
			add_filter( 'woocommerce_locate_template', [ __CLASS__, 'locate_checkout_templates' ], 999, 3 );
			add_filter( 'wc_get_template', [ __CLASS__, 'intercept_checkout_templates' ], 999, 5 );
			add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_checkout_assets' ], 20 );

			remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10 );
			remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_login_form', 10 );
			remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_login_form', 20 );
			add_filter( 'woocommerce_checkout_login_message', '__return_empty_string', 999 );
			add_action( 'init', function() {
				remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_login_form', 10 );
				remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_login_form', 20 );
			}, 999 );

			add_filter( 'woocommerce_enable_order_notes_field', '__return_false', 99 );
			add_filter( 'woocommerce_checkout_posted_data', [ __CLASS__, 'filter_checkout_posted_data' ], 99 );

			add_action( 'template_redirect', [ __CLASS__, 'handle_empty_cart_redirect' ], 1 );
			add_filter( 'woocommerce_get_cart_url', [ __CLASS__, 'override_cart_url' ], 99 );
		}

		// 11. Live Shipping Methods Fragment for Multi-Step Checkout
		add_filter( 'woocommerce_update_order_review_fragments', [ __CLASS__, 'add_shipping_methods_fragment' ], 15 );

		// 12. Terms & Conditions Checked by Default (Seamless Checkout Flow)
		add_filter( 'woocommerce_terms_is_checked_default', '__return_true' );
	}

	/**
	 * Make the original visitor and explicitly selected currency available to Aelia.
	 */
	public static function apply_headless_currency_context(): void {
		$client_ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_EXACOAT_CLIENT_IP'] ?? ( $_SERVER['HTTP_X_ARTMATTER_CLIENT_IP'] ?? '' ) ) );
		if ( $client_ip && filter_var( $client_ip, FILTER_VALIDATE_IP ) ) {
			$_SERVER['REMOTE_ADDR'] = $client_ip;
		}

		$currency = self::get_requested_currency();
		if ( $currency ) {
			$_COOKIE['aelia_cs_selected_currency'] = $currency;
		}
	}

	public static function filter_headless_currency( $currency ): string {
		return self::get_requested_currency() ?: strtoupper( sanitize_text_field( (string) $currency ) );
	}

	private static function get_requested_currency(): string {
		$currency = strtoupper( sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_EXACOAT_CURRENCY'] ?? ( $_SERVER['HTTP_X_ARTMATTER_CURRENCY'] ?? '' ) ) ) );
		if ( ! preg_match( '/^[A-Z]{3}$/', $currency ) ) {
			return '';
		}

		$supported = [ 'IDR' ];
		if ( class_exists( 'Exacoat_Store_Enhancements' ) ) {
			$supported = array_merge( $supported, array_keys( Exacoat_Store_Enhancements::get_currency_rates() ) );
		} elseif ( class_exists( 'Artmatter_Store_Enhancements' ) ) {
			$supported = array_merge( $supported, array_keys( Artmatter_Store_Enhancements::get_currency_rates() ) );
		}

		return in_array( $currency, array_unique( $supported ), true ) ? $currency : '';
	}

	public static function register_headless_checkout_routes() {
		$namespaces = [ 'exacoat-core/v1', 'exacoat/v1', 'artmatter-core/v1' ];

		foreach ( $namespaces as $ns ) {
			register_rest_route( $ns, '/checkout/config', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_headless_checkout_config' ],
				'permission_callback' => '__return_true',
			] );

			register_rest_route( $ns, '/checkout/address', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'resolve_headless_checkout_address' ],
				'permission_callback' => '__return_true',
				'args'                => [
					'country'  => [
						'default'           => 'ID',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'postcode' => [
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			] );

			register_rest_route( $ns, '/checkout/price', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_headless_product_price' ],
				'permission_callback' => '__return_true',
				'args'                => [
					'product_id' => [
						'required'          => true,
						'sanitize_callback' => 'absint',
					],
				],
			] );

			register_rest_route( $ns, '/checkout/cancel-order', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'cancel_headless_checkout_order' ],
				'permission_callback' => '__return_true',
				'args'                => [
					'order_id' => [
						'required'          => true,
						'sanitize_callback' => 'absint',
					],
				],
			] );
		}
	}

	public static function cancel_headless_checkout_order( WP_REST_Request $request ) {
		$order_id = absint( $request->get_param( 'order_id' ) );
		if ( ! $order_id ) {
			return new WP_Error( 'invalid_order', 'Order ID required', [ 'status' => 400 ] );
		}
		$order = wc_get_order( $order_id );
		if ( ! $order instanceof WC_Order ) {
			return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
		}
		if ( $order->has_status( [ 'pending', 'on-hold', 'failed' ] ) ) {
			$order->update_status( 'cancelled', __( 'Customer cancelled payment.', 'artmatter-core' ) );
			return rest_ensure_response( [ 'success' => true, 'order_id' => $order_id, 'status' => 'cancelled' ] );
		}
		return rest_ensure_response( [ 'success' => true, 'order_id' => $order_id, 'status' => $order->get_status() ] );
	}

	public static function get_headless_product_price( WP_REST_Request $request ) {
		$product_id = absint( $request->get_param( 'product_id' ) );
		$product    = $product_id ? wc_get_product( $product_id ) : null;
		if ( ! $product || 'publish' !== $product->get_status() ) {
			return new WP_Error( 'product_not_found', 'Product not found.', [ 'status' => 404 ] );
		}
		if ( '1' === (string) get_post_meta( $product_id, '_artmatter_custom_product', true ) ) {
			$access = (string) ( $request->get_header( 'X-Artmatter-Custom-Access' ) ?: $request->get_param( 'access' ) );
			if ( ! class_exists( 'Artmatter_Bricks_Bridge' ) || ! Artmatter_Bricks_Bridge::validate_custom_order_access( $product_id, $access ) ) {
				return new WP_Error( 'product_not_found', 'Product not found.', [ 'status' => 404 ] );
			}
		}

		$currency = self::get_active_currency();
		$flat_idr = (float) ( get_post_meta( $product_id, '_price', true ) ?: 990000 );
		$convert  = static function( float $amount ) use ( $currency ): float {
			if ( class_exists( 'Exacoat_Store_Enhancements' ) ) {
				return Exacoat_Store_Enhancements::calculate_price_for_currency( $amount, $currency );
			}
			return class_exists( 'Artmatter_Store_Enhancements' )
				? Artmatter_Store_Enhancements::calculate_price_for_currency( $amount, $currency )
				: $amount;
		};

		$decimals = class_exists( 'Exacoat_Store_Enhancements' )
			? Exacoat_Store_Enhancements::get_currency_decimals( $currency )
			: ( class_exists( 'Artmatter_Store_Enhancements' )
				? Artmatter_Store_Enhancements::get_currency_decimals( $currency )
				: wc_get_price_decimals() );

		return rest_ensure_response( [
			'currency'   => $currency,
			'minor_unit' => $decimals,
			'prices'     => [
				'standard' => (float) $product->get_price(),
				'flat'     => $convert( $flat_idr ),
				'feelform' => $convert( 1290000 ),
			],
		] );
	}

	public static function get_headless_checkout_config( WP_REST_Request $request ) {
		if ( ! function_exists( 'WC' ) || ! WC()->countries ) {
			return new WP_Error( 'woocommerce_unavailable', 'WooCommerce is unavailable.', [ 'status' => 503 ] );
		}

		$country         = strtoupper( sanitize_text_field( $request->get_param( 'country' ) ?: '' ) );
		$active_currency = self::get_active_currency();

		if ( empty( $country ) && function_exists( 'WC' ) && WC()->customer ) {
			$country = strtoupper( WC()->customer->get_shipping_country() ?: WC()->customer->get_billing_country() );
		}
		if ( empty( $country ) ) {
			$curr_to_country = [
				'AUD' => 'AU',
				'USD' => 'US',
				'GBP' => 'GB',
				'EUR' => 'DE',
				'SGD' => 'SG',
				'CAD' => 'CA',
				'IDR' => 'ID',
				'NZD' => 'NZ',
				'MYR' => 'MY',
				'JPY' => 'JP',
			];
			$country = $curr_to_country[ $active_currency ] ?? 'US';
		}

		$states  = WC()->countries->get_states( $country );

		$free_shipping_threshold = 0.0;
		$thresholds_by_currency  = [];
		$shipping_zones          = [];

		$has_enhancements = class_exists( 'Exacoat_Store_Enhancements' ) || class_exists( 'Artmatter_Store_Enhancements' );
		if ( $has_enhancements ) {
			$shipping_config = class_exists( 'Exacoat_Store_Enhancements' )
				? Exacoat_Store_Enhancements::get_shipping_config()
				: Artmatter_Store_Enhancements::get_shipping_config();
			$zones           = $shipping_config['zones'] ?? [];
			$matched_zone    = null;

			foreach ( $zones as $k => $z ) {
				$c_list = array_map( 'trim', explode( ',', strtoupper( $z['countries'] ?? '' ) ) );
				if ( in_array( $country, $c_list, true ) ) {
					$matched_zone = $z;
				}

				$z_curr = strtoupper( trim( $z['currency'] ?? '' ) );
				$z_free = (float) ( $z['free'] ?? 0 );
				if ( empty( $z_curr ) ) {
					$z_curr = ( $z_free > 50000 ) ? 'IDR' : 'USD';
				}

				if ( $z_free > 0 ) {
					if ( ! isset( $thresholds_by_currency[ $z_curr ] ) || in_array( $country, $c_list, true ) ) {
						$thresholds_by_currency[ $z_curr ] = $z_free;
					}
				}

				$shipping_zones[] = [
					'key'       => $k,
					'name'      => $z['name'] ?? '',
					'countries' => $z['countries'] ?? '',
					'currency'  => $z_curr,
					'free'      => $z_free,
				];
			}

			if ( ! $matched_zone && isset( $zones['default'] ) ) {
				$matched_zone = $zones['default'];
			}

			$currencies = class_exists( 'Exacoat_Store_Enhancements' )
				? Exacoat_Store_Enhancements::get_currency_rates()
				: Artmatter_Store_Enhancements::get_currency_rates();

			if ( $matched_zone ) {
				$zone_curr = strtoupper( trim( $matched_zone['currency'] ?? '' ) );
				$free_amt  = (float) ( $matched_zone['free'] ?? 0 );

				if ( empty( $zone_curr ) ) {
					$zone_curr = ( $free_amt > 50000 ) ? 'IDR' : 'USD';
				}

				if ( $zone_curr === $active_currency ) {
					// Native currency matches active customer currency: direct threshold!
					$free_shipping_threshold = $free_amt;
				} elseif ( 'IDR' === $zone_curr ) {
					if ( 'IDR' === $active_currency ) {
						$free_shipping_threshold = $free_amt;
					} else {
						$converted = apply_filters( 'wc_aelia_cs_convert', $free_amt, 'IDR', $active_currency );
						if ( (float) $converted === (float) $free_amt && $active_currency !== 'IDR' ) {
							$rate_val = floatval( $currencies[ $active_currency ]['rate'] ?? 0 );
							$free_shipping_threshold = $rate_val > 0 ? ( $free_amt * $rate_val ) : $free_amt;
						} else {
							$free_shipping_threshold = (float) $converted;
						}
					}
				} else {
					// Zone in other foreign currency: convert to IDR, then to customer currency
					$thresh_idr = (float) apply_filters( 'wc_aelia_cs_convert', $free_amt, $zone_curr, 'IDR' );
					if ( (float) $thresh_idr === (float) $free_amt && $zone_curr !== 'IDR' ) {
						$rate_val   = floatval( $currencies[ $zone_curr ]['rate'] ?? 0 );
						$thresh_idr = $rate_val > 0 ? ( $free_amt / $rate_val ) : $free_amt;
					}
					$converted = apply_filters( 'wc_aelia_cs_convert', $thresh_idr, 'IDR', $active_currency );
					if ( (float) $converted === (float) $thresh_idr && $active_currency !== 'IDR' ) {
						$rate_val = floatval( $currencies[ $active_currency ]['rate'] ?? 0 );
						$free_shipping_threshold = $rate_val > 0 ? ( $thresh_idr * $rate_val ) : $thresh_idr;
					} else {
						$free_shipping_threshold = (float) $converted;
					}
				}
			}

			// Ensure all supported currencies have a calculated threshold
			$def_zone   = $zones['default'] ?? [ 'free' => 60, 'currency' => 'USD' ];
			$def_free   = (float) ( $def_zone['free'] ?? 60 );
			$def_curr   = strtoupper( trim( $def_zone['currency'] ?? 'USD' ) );
			foreach ( array_keys( $currencies ) as $cur_k ) {
				if ( ! isset( $thresholds_by_currency[ $cur_k ] ) ) {
					if ( $def_curr === $cur_k ) {
						$thresholds_by_currency[ $cur_k ] = $def_free;
					} else {
						$converted = (float) apply_filters( 'wc_aelia_cs_convert', $def_free, $def_curr, $cur_k );
						if ( $converted <= 0 || ( $converted === $def_free && $def_curr !== $cur_k ) ) {
							$rate_val = floatval( $currencies[ $cur_k ]['rate'] ?? 0 );
							$def_rate = floatval( $currencies[ $def_curr ]['rate'] ?? 0.000100 );
							$converted = ( $def_rate > 0 && $rate_val > 0 ) ? ( $def_free / $def_rate * $rate_val ) : $def_free;
						}
						$thresholds_by_currency[ $cur_k ] = in_array( $cur_k, [ 'IDR', 'JPY', 'KRW', 'THB', 'VND' ], true ) ? round( $converted ) : round( $converted, 2 );
					}
				}
			}
		}

		return rest_ensure_response( [
			'countries'               => WC()->countries->get_allowed_countries(),
			'states'                  => is_array( $states ) ? $states : [],
			'country'                 => $country,
			'currency'                => $active_currency,
			'free_shipping_threshold' => round( $free_shipping_threshold, 2 ),
			'thresholds_by_currency'  => $thresholds_by_currency,
			'shipping_zones'          => $shipping_zones,
		] );
	}

	public static function resolve_headless_checkout_address( WP_REST_Request $request ) {
		$country  = strtoupper( sanitize_text_field( $request->get_param( 'country' ) ?: 'ID' ) );
		$postcode = sanitize_text_field( $request->get_param( 'postcode' ) ?: '' );

		if ( 'ID' !== $country || ! preg_match( '/^\d{5}$/', $postcode ) ) {
			return new WP_Error( 'invalid_postcode', 'Enter a valid Indonesian postal code.', [ 'status' => 400 ] );
		}
		if ( ! class_exists( 'Artmatter_Biteship_Engine' ) ) {
			return new WP_Error( 'address_service_unavailable', 'Address lookup is temporarily unavailable.', [ 'status' => 503 ] );
		}

		$cached = get_transient( 'artmatter_checkout_address_' . $postcode );
		if ( is_array( $cached ) && ! empty( $cached['subdistrict'] ) ) {
			return rest_ensure_response( $cached );
		}

		$forwarded_ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '' ) );
		$client_ip    = filter_var( $forwarded_ip, FILTER_VALIDATE_IP ) ? $forwarded_ip : 'unknown';
		$limit_key    = 'artmatter_address_limit_' . md5( $client_ip );
		$request_count = (int) get_transient( $limit_key );
		if ( $request_count >= 20 ) {
			return new WP_Error( 'address_rate_limited', 'Too many address requests. Please wait a moment.', [ 'status' => 429 ] );
		}
		set_transient( $limit_key, $request_count + 1, 10 * MINUTE_IN_SECONDS );

		return Artmatter_Biteship_Engine::resolve_postcode( $postcode );
	}

	public static function add_store_api_cart_item_data( $add_to_cart_data, $request ) {
		$extensions = $request instanceof WP_REST_Request ? $request->get_param( 'extensions' ) : [];
		$artmatter  = is_array( $extensions ) && isset( $extensions['artmatter'] ) && is_array( $extensions['artmatter'] )
			? $extensions['artmatter']
			: [];
		$finish = sanitize_key( $artmatter['finish'] ?? '' );
		$product_id = absint( $add_to_cart_data['id'] ?? $request->get_param( 'id' ) ?? 0 );
		$product = $product_id ? wc_get_product( $product_id ) : null;
		$is_custom = $product && '1' === (string) get_post_meta( $product_id, '_artmatter_custom_product', true );
		if ( $is_custom ) {
			$access = (string) ( $artmatter['access'] ?? '' );
			if ( ! class_exists( 'Artmatter_Bricks_Bridge' ) || ! Artmatter_Bricks_Bridge::validate_custom_order_access( $product_id, $access ) ) {
				if ( class_exists( '\\Automattic\\WooCommerce\\StoreApi\\Exceptions\\RouteException' ) ) {
					throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
						'woocommerce_rest_product_not_found',
						'Product not found.',
						404
					);
				}
				$add_to_cart_data['id'] = 0;
				return $add_to_cart_data;
			}
		}

		if ( in_array( $finish, [ 'flat', 'feelform' ], true ) ) {
			$is_custom = $product && ( $is_custom || str_starts_with( $product->get_slug(), 'custom-order-' ) || has_term( 'custom', 'product_cat', $product_id ) );

			if ( $is_custom ) {
				$add_to_cart_data['cart_item_data']['print_finish']       = $finish;
				$add_to_cart_data['cart_item_data']['print_finish_label'] = 'flat' === $finish ? 'Flat (Classic)' : 'FeelForm™';
			}
		}

		return $add_to_cart_data;
	}

	/**
	 * Accept a top-level POST from the headless storefront and rebuild the cart
	 * from validated WooCommerce product IDs. Prices and product details from
	 * the browser are deliberately ignored.
	 */
	public static function handle_headless_cart_handoff() {
		if ( is_admin() || 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) {
			return;
		}

		if ( ! function_exists( 'wc_get_checkout_url' ) ) {
			return;
		}

		$request_uri = wp_unslash( $_SERVER['REQUEST_URI'] ?? '' );
		$path        = (string) wp_parse_url( $request_uri, PHP_URL_PATH );
		$checkout    = (string) wp_parse_url( wc_get_checkout_url(), PHP_URL_PATH );
		$source      = sanitize_text_field( wp_unslash( $_POST['source'] ?? '' ) );

		if ( 'react-web' !== $source || untrailingslashit( $path ) !== untrailingslashit( $checkout ) ) {
			return;
		}

		$origin      = wp_unslash( $_SERVER['HTTP_ORIGIN'] ?? '' );
		$origin_host = strtolower( (string) wp_parse_url( $origin, PHP_URL_HOST ) );
		$is_local    = in_array( $origin_host, [ 'localhost', '127.0.0.1' ], true );
		$is_artmatter = 'artmatter.co' === $origin_host || str_ends_with( $origin_host, '.artmatter.co' );
		$allowed     = (bool) apply_filters(
			'artmatter_headless_checkout_origin_allowed',
			$is_local || $is_artmatter,
			$origin_host
		);

		if ( ! $allowed ) {
			wp_die( esc_html__( 'Checkout could not be started from this site.', 'artmatter-core' ), '', [ 'response' => 403 ] );
		}

		$raw_cart = wp_unslash( $_POST['cart'] ?? '' );
		if ( ! is_string( $raw_cart ) || '' === $raw_cart || strlen( $raw_cart ) > 32768 ) {
			wp_safe_redirect( add_query_arg( 'checkout_error', 'invalid_cart', home_url( '/cart-empty/' ) ) );
			exit;
		}

		$items = json_decode( $raw_cart, true );
		if ( ! is_array( $items ) || count( $items ) > 20 ) {
			wp_safe_redirect( add_query_arg( 'checkout_error', 'invalid_cart', home_url( '/cart-empty/' ) ) );
			exit;
		}

		self::ensure_wc_session_and_cart();

		if ( ! function_exists( 'WC' ) || ! WC()->cart || ! WC()->session ) {
			wp_die( esc_html__( 'Checkout is temporarily unavailable.', 'artmatter-core' ), '', [ 'response' => 503 ] );
		}

		$normalized = [];
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$product_id = absint( $item['product_id'] ?? $item['wpId'] ?? $item['id'] ?? 0 );
			$quantity   = min( 10, max( 1, absint( $item['quantity'] ?? 1 ) ) );
			$finish     = sanitize_key( $item['finish'] ?? '' );
			$finish     = in_array( $finish, [ 'flat', 'feelform' ], true ) ? $finish : '';
			$orientation = sanitize_key( $item['orientation'] ?? 'portrait' );
			$orientation = 'landscape' === $orientation ? 'landscape' : 'portrait';

			if ( $product_id ) {
				if ( isset( $normalized[ $product_id ] ) ) {
					$normalized[ $product_id ]['quantity'] = min( 10, $normalized[ $product_id ]['quantity'] + $quantity );
				} else {
					$normalized[ $product_id ] = compact( 'product_id', 'quantity', 'finish', 'orientation' );
				}
			}
		}

		WC()->cart->empty_cart( true );
		$added = 0;
		foreach ( $normalized as $item ) {
			$product = wc_get_product( $item['product_id'] );
			if ( ! $product || 'publish' !== $product->get_status() || ! $product->is_purchasable() || ! $product->is_in_stock() ) {
				wc_add_notice( esc_html__( 'An item in your bag is no longer available.', 'exacoat-core' ), 'notice' );
				continue;
			}

			$cart_item_data = [
				'artmatter_headless_source' => 'react-web',
			];

			$is_custom_order = str_starts_with( $product->get_slug(), 'custom-order-' ) || has_term( 'custom', 'product_cat', $item['product_id'] );
			if ( $is_custom_order && $item['finish'] ) {
				$cart_item_data['print_finish']       = $item['finish'];
				$cart_item_data['print_finish_label'] = 'flat' === $item['finish'] ? 'Flat (Classic)' : 'FeelForm™';
				$cart_item_data['artmatter_finish']   = $item['finish'];
			}

			if ( WC()->cart->add_to_cart( $item['product_id'], $item['quantity'], 0, [], $cart_item_data ) ) {
				$added++;
			}
		}

		if ( 0 === $added ) {
			wp_safe_redirect( add_query_arg( 'checkout_error', 'unavailable', home_url( '/cart-empty/' ) ) );
			exit;
		}

		WC()->cart->calculate_totals();
		WC()->cart->set_session();
		WC()->session->set_customer_session_cookie( true );
		WC()->session->save_data();

		wp_safe_redirect( wc_get_checkout_url() );
		exit;
	}

	/**
	 * Locate plugin template overrides for WooCommerce
	 */
	public static function locate_checkout_templates( $template, $template_name, $template_path ) {
		$base_path = defined( 'EXACOAT_CORE_PATH' ) ? EXACOAT_CORE_PATH : ( defined( 'ARTMATTER_CORE_PATH' ) ? ARTMATTER_CORE_PATH : plugin_dir_path( dirname( __DIR__ ) . '/exacoat-core.php' ) );
		$plugin_path = $base_path . 'templates/' . $template_name;
		if ( file_exists( $plugin_path ) ) {
			return $plugin_path;
		}
		return $template;
	}

	/**
	 * Intercept wc_get_template calls directly
	 */
	public static function intercept_checkout_templates( $located, $template_name, $args, $template_path, $default_path ) {
		$base_path = defined( 'EXACOAT_CORE_PATH' ) ? EXACOAT_CORE_PATH : ( defined( 'ARTMATTER_CORE_PATH' ) ? ARTMATTER_CORE_PATH : plugin_dir_path( dirname( __DIR__ ) . '/exacoat-core.php' ) );
		$plugin_path = $base_path . 'templates/' . $template_name;
		if ( file_exists( $plugin_path ) ) {
			return $plugin_path;
		}
		return $located;
	}

	/**
	 * Enqueue Styles and Scripts on relevant checkout endpoints
	 */
	public static function enqueue_checkout_assets() {
		if ( ! function_exists( 'is_checkout' ) ) {
			return;
		}

		$is_checkout = is_checkout();
		$is_pay      = is_wc_endpoint_url( 'order-pay' );
		$is_received = is_wc_endpoint_url( 'order-received' );

		if ( $is_checkout || $is_pay || $is_received ) {
			$ver      = defined( 'EXACOAT_CORE_VERSION' ) ? EXACOAT_CORE_VERSION : ( defined( 'ARTMATTER_CORE_VERSION' ) ? ARTMATTER_CORE_VERSION : '0.0.32' );
			$core_url = defined( 'EXACOAT_CORE_URL' ) ? EXACOAT_CORE_URL : ( defined( 'ARTMATTER_CORE_URL' ) ? ARTMATTER_CORE_URL : plugin_dir_url( dirname( __DIR__ ) . '/exacoat-core.php' ) );

			wp_enqueue_style(
				'exacoat-checkout-style',
				$core_url . 'assets/css/checkout.css',
				[],
				$ver
			);

			wp_enqueue_script(
				'exacoat-checkout-script',
				$core_url . 'assets/js/checkout.js',
				[ 'jquery' ],
				$ver,
				true
			);

			$checkout_data = [
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'artmatter-checkout-nonce' ),
			];

			wp_localize_script( 'exacoat-checkout-script', 'exacoatCheckoutData', $checkout_data );
			wp_localize_script( 'exacoat-checkout-script', 'artmatterCheckoutData', $checkout_data );
		}
	}

	/**
	 * AJAX Handler for Coupon Application in Checkout Sidebar
	 */
	public static function ajax_apply_coupon() {
		check_ajax_referer( 'artmatter-checkout-nonce', 'security' );

		$coupon_code = sanitize_text_field( $_POST['coupon_code'] ?? '' );
		if ( empty( $coupon_code ) ) {
			wp_send_json_error( [ 'message' => esc_html__( 'Please enter a valid coupon code.', 'artmatter-core' ) ] );
		}

		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			wp_send_json_error( [ 'message' => esc_html__( 'Cart session not active.', 'artmatter-core' ) ] );
		}

		if ( WC()->cart->has_discount( $coupon_code ) ) {
			wp_send_json_error( [ 'message' => esc_html__( 'Coupon code already applied.', 'artmatter-core' ) ] );
		}

		$applied = WC()->cart->apply_coupon( $coupon_code );
		if ( $applied ) {
			WC()->cart->calculate_totals();
			$success_notices = wc_get_notices( 'success' );
			$raw_msg = ! empty( $success_notices ) ? $success_notices[0]['notice'] : esc_html__( 'Coupon applied.', 'artmatter-core' );
			$msg     = html_entity_decode( wp_strip_all_tags( $raw_msg ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			wc_clear_notices();
			wp_send_json_success( [ 'message' => $msg ] );
		} else {
			$notices = wc_get_notices( 'error' );
			$raw_msg = ! empty( $notices ) ? $notices[0]['notice'] : esc_html__( 'Invalid coupon code.', 'artmatter-core' );
			$msg     = html_entity_decode( wp_strip_all_tags( $raw_msg ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			wc_clear_notices();
			wp_send_json_error( [ 'message' => $msg ] );
		}
	}

	/**
	 * Get the active customer currency (Aelia Currency Switcher, cookie, or WooCommerce default)
	 */
	public static function get_active_currency(): string {
		if ( ! empty( $_COOKIE['aelia_cs_selected_currency'] ) ) {
			return sanitize_text_field( strtoupper( $_COOKIE['aelia_cs_selected_currency'] ) );
		}
		if ( function_exists( 'get_woocommerce_currency' ) ) {
			return get_woocommerce_currency();
		}
		return get_option( 'woocommerce_currency', 'IDR' );
	}

	/**
	 * Ensure shipping rates are converted to the active currency via Aelia Currency Switcher
	 *
	 * @param array $rates Available shipping rates
	 * @param array $package Shipping package
	 * @return array
	 */
	public static function convert_shipping_rates_for_aelia( $rates, $package ) {
		return $rates;
	}

	/**
	 * Clean customer-facing shipping label.
	 */
	public static function get_goorita_shipping_label( string $country ): string {
		return '';
	}

	/**
	 * Delivery estimate helper.
	 */
	public static function get_goorita_delivery_estimate( string $country ): string {
		return '';
	}

	/**
	 * Preserve native WooCommerce shipping method titles without renaming.
	 */
	public static function filter_shipping_rate_label( $label, $rate ) {
		return $label;
	}

	/**
	 * Deprecated poster shipping fee calculation. Returns 0 so native WooCommerce rates govern checkout.
	 */
	public static function calculate_goorita_shipping_cost( string $country, int $qty ): float {
		return 0.0;
	}

	/**
	 * Convert shipping rate cost linearly without product retail markup or psychological 9-ending rounding.
	 */
	public static function convert_shipping_rate_cost( float $cost, string $active_currency, string $shop_base_currency = 'IDR' ): float {
		if ( $cost <= 0 || $active_currency === $shop_base_currency ) {
			return $cost;
		}

		// 1. Try Aelia Currency Switcher filter first if an exchange rate is registered
		$aelia_converted = apply_filters( 'wc_aelia_cs_convert', $cost, $shop_base_currency, $active_currency );
		if ( $aelia_converted > 0 && (float) $aelia_converted !== (float) $cost ) {
			return round( (float) $aelia_converted, 2 );
		}

		// 2. Convert from IDR using Artmatter Core FX rates without 15% product markup and without 9-ending rounding
		if ( class_exists( 'Artmatter_Store_Enhancements' ) ) {
			$currencies = Artmatter_Store_Enhancements::get_currency_rates();
			if ( isset( $currencies[ $active_currency ] ) ) {
				$data = $currencies[ $active_currency ];
				$rate = floatval( is_array( $data ) ? ( $data['rate'] ?? 0 ) : $data );
				if ( $rate > 0 ) {
					$raw      = $cost * $rate;
					$decimals = in_array( $active_currency, [ 'IDR', 'JPY', 'KRW', 'VND' ], true ) ? 0 : 2;
					return round( $raw, $decimals );
				}
			}
		}

		return $cost;
	}

	/**
	 * Format Shipping Method Full Label with compact metadata and right-aligned price
	 */
	public static function format_shipping_method_full_label( $label, $method ) {
		$meta = method_exists( $method, 'get_meta_data' ) ? $method->get_meta_data() : [];
		$duration = $meta['_biteship_duration'] ?? '';

		$method_label    = $method->get_label();
		$cost            = (float) $method->get_cost();
		$active_currency = self::get_active_currency();

		// Format price in active currency (supporting Aelia Currency Switcher & WooCommerce multi-currency)
		$price_html = '';
		if ( $cost > 0 ) {
			if ( function_exists( 'WC' ) && WC()->cart && WC()->cart->display_prices_including_tax() ) {
				$tax = method_exists( $method, 'get_shipping_tax' ) ? (float) $method->get_shipping_tax() : 0.0;
				$price_html = wc_price( $cost + $tax, [ 'currency' => $active_currency ] );
			} else {
				$price_html = wc_price( $cost, [ 'currency' => $active_currency ] );
			}
		} else {
			// Do NOT hardcode '$0.00'. Format dynamically in the active currency set by Aelia / WooCommerce
			$price_html = '<span class="free-shipping-label">' . wc_price( 0, [ 'currency' => $active_currency ] ) . '</span>';
		}

		$html  = '<div class="am-shipping-meta-wrap">';
		$html .= '<span class="am-shipping-title">' . esc_html( $method_label ) . '</span>';
		if ( ! empty( $duration ) ) {
			$html .= '<span class="am-shipping-duration">' . esc_html( $duration ) . '</span>';
		}
		$html .= '</div>';
		$html .= '<div class="am-shipping-price">' . $price_html . '</div>';

		return $html;
	}

	/**
	 * Override WooCommerce country locales for countries without states or city-states like Singapore
	 */
	public static function customize_country_locales( $locales ) {
		$no_state_countries = [ 'SG', 'HK', 'MO', 'VA', 'SM', 'MC', 'GI', 'KW', 'BH', 'QA' ];
		foreach ( $no_state_countries as $code ) {
			if ( ! isset( $locales[ $code ] ) ) {
				$locales[ $code ] = [];
			}
			$locales[ $code ]['city'] = [
				'required' => true,
				'hidden'   => false,
				'label'    => __( 'Town / City', 'woocommerce' ),
			];
			$locales[ $code ]['state'] = [
				'required' => false,
				'hidden'   => true,
			];
		}
		return $locales;
	}

	/**
	 * Customize checkout fields default labels and properties
	 */
	public static function customize_checkout_fields( $fields ) {
		if ( isset( $fields['billing']['billing_address_2'] ) ) {
			$fields['billing']['billing_address_2']['label'] = __( 'Apartment, suite, unit, etc. (optional)', 'woocommerce' );
			$fields['billing']['billing_address_2']['placeholder'] = __( 'Apartment, suite, unit, etc. (optional)', 'woocommerce' );
		}
		if ( isset( $fields['order']['order_comments'] ) ) {
			unset( $fields['order']['order_comments'] );
		}
		if ( isset( $fields['account']['account_password'] ) ) {
			unset( $fields['account']['account_password'] );
		}
		return $fields;
	}

	/**
	 * Filter posted checkout data to prevent password errors and ensure smooth guest checkout
	 */
	public static function filter_checkout_posted_data( $data ) {
		if ( isset( $data['createaccount'] ) ) {
			unset( $data['createaccount'] );
		}
		if ( isset( $data['account_password'] ) ) {
			unset( $data['account_password'] );
		}
		return $data;
	}

	/**
	 * AJAX Handler to check if an email already belongs to a registered WordPress user
	 */
	public static function ajax_check_user_exists() {
		check_ajax_referer( 'artmatter-checkout-nonce', 'security' );

		$email = sanitize_email( $_POST['email'] ?? '' );
		if ( empty( $email ) || ! is_email( $email ) ) {
			wp_send_json_success( [ 'exists' => false ] );
		}

		$user = get_user_by( 'email', $email );
		if ( $user && $user->exists() ) {
			wp_send_json_success( [
				'exists'       => true,
				'email'        => $email,
				'display_name' => $user->display_name ?: $user->user_login,
			] );
		}

		wp_send_json_success( [ 'exists' => false ] );
	}

	/**
	 * AJAX Quick Login from Checkout Modal
	 */
	public static function ajax_quick_login() {
		check_ajax_referer( 'artmatter-checkout-nonce', 'security' );

		$email    = sanitize_email( $_POST['email'] ?? '' );
		$password = $_POST['password'] ?? '';

		if ( empty( $email ) || empty( $password ) ) {
			wp_send_json_error( [ 'message' => esc_html__( 'Please provide both email and password.', 'artmatter-core' ) ] );
		}

		$user = get_user_by( 'email', $email );
		if ( ! $user ) {
			wp_send_json_error( [ 'message' => esc_html__( 'No account found with this email.', 'artmatter-core' ) ] );
		}

		$creds = [
			'user_login'    => $user->user_login,
			'user_password' => $password,
			'remember'      => true,
		];

		$signon = wp_signon( $creds, is_ssl() );

		if ( is_wp_error( $signon ) ) {
			wp_send_json_error( [ 'message' => esc_html__( 'Incorrect password. Please try again or continue as guest.', 'artmatter-core' ) ] );
		}

		wp_set_current_user( $signon->ID );

		// Retrieve customer billing meta
		$uid = $signon->ID;
		$profile = [
			'display_name' => $signon->display_name ?: $signon->user_login,
			'email'        => $signon->user_email,
			'first_name'   => get_user_meta( $uid, 'billing_first_name', true ) ?: $signon->first_name,
			'last_name'    => get_user_meta( $uid, 'billing_last_name', true ) ?: $signon->last_name,
			'phone'        => get_user_meta( $uid, 'billing_phone', true ),
			'address_1'    => get_user_meta( $uid, 'billing_address_1', true ),
			'address_2'    => get_user_meta( $uid, 'billing_address_2', true ),
			'city'         => get_user_meta( $uid, 'billing_city', true ),
			'state'        => get_user_meta( $uid, 'billing_state', true ),
			'postcode'     => get_user_meta( $uid, 'billing_postcode', true ),
			'country'      => get_user_meta( $uid, 'billing_country', true ),
		];

		wp_send_json_success( [
			'message' => esc_html__( 'You are logged in.', 'artmatter-core' ),
			'user'    => $profile,
		] );
	}

	/**
	 * Seamless Redirect for /view-order/{id} requests to Thank You confirmation page
	 */
	public static function handle_view_order_endpoint_redirect() {
		if ( is_admin() || ! function_exists( 'wc_get_order' ) ) {
			return;
		}

		$request_uri = $_SERVER['REQUEST_URI'] ?? '';
		if ( preg_match( '#/view-order/(\d+)#', $request_uri, $matches ) ) {
			$order_id = intval( $matches[1] );
			$order = wc_get_order( $order_id );
			if ( $order && is_a( $order, 'WC_Order' ) ) {
				$dest_url = $order->get_checkout_order_received_url();
				if ( $dest_url ) {
					wp_safe_redirect( $dest_url );
					exit;
				}
			}
		}
	}

	/**
	 * Redirect empty checkout / cart visits to /cart-empty/
	 */
	public static function handle_empty_cart_redirect() {
		if ( is_admin() || ( function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url() ) ) {
			return;
		}

		// Never intercept payment gateway returns or cancellations
		if ( isset( $_GET['ppcp_action'] ) || isset( $_GET['payment_status'] ) || isset( $_GET['order_id'] ) || isset( $_GET['token'] ) ) {
			return;
		}

		if ( function_exists( 'is_cart' ) && is_cart() ) {
			wp_safe_redirect( home_url( '/cart-empty/' ) );
			exit;
		}

		if ( function_exists( 'is_checkout' ) && is_checkout() && ! is_order_received_page() ) {
			if ( function_exists( 'WC' ) && WC()->cart && WC()->cart->is_empty() ) {
				wp_safe_redirect( home_url( '/cart-empty/' ) );
				exit;
			}
		}
	}

	/**
	 * Override cart url across site to point to /cart-empty/
	 */
	public static function override_cart_url( $url ) {
		return home_url( '/cart-empty/' );
	}

	/**
	 * Inject live shipping methods HTML directly into WooCommerce update_order_review AJAX fragments
	 */
	public static function add_shipping_methods_fragment( $fragments ) {
		ob_start();
		?>
		<div id="artmatter-shipping-methods-container" class="artmatter-shipping-methods-container">
			<?php if ( function_exists( 'WC' ) && WC()->cart && WC()->cart->needs_shipping() && WC()->cart->show_shipping() ) : ?>
				<?php wc_cart_totals_shipping_html(); ?>
			<?php else : ?>
				<p style="font-size:13px;color:#a1a1aa;"><?php esc_html_e( 'No shipping required or standard complimentary shipping applies.', 'artmatter-core' ); ?></p>
			<?php endif; ?>
		</div>
		<?php
		$fragments['#artmatter-shipping-methods-container'] = ob_get_clean();

		if ( isset( $fragments['.woocommerce-checkout-review-order-table'] ) ) {
			$fragments['.artmatter-co-totals-table'] = $fragments['.woocommerce-checkout-review-order-table'];
		}

		return $fragments;
	}

	/**
	 * Register Store API update callbacks for headless cart extensions.
	 */
	public static function register_store_api_callbacks(): void {
		try {
			if ( function_exists( 'woocommerce_store_api_register_update_callback' ) ) {
				woocommerce_store_api_register_update_callback( [
					'namespace' => 'artmatter-store-credit',
					'callback'  => [ __CLASS__, 'handle_store_credit_update' ],
				] );
				woocommerce_store_api_register_update_callback( [
					'namespace' => 'exacoat-store-credit',
					'callback'  => [ __CLASS__, 'handle_store_credit_update' ],
				] );
			}

			if ( function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
				woocommerce_store_api_register_endpoint_data( [
					'endpoint'        => 'cart',
					'namespace'       => 'artmatter_coupons',
					'data_callback'   => [ __CLASS__, 'get_store_api_coupons_data' ],
					'schema_callback' => [ __CLASS__, 'get_store_api_coupons_schema' ],
					'schema_type'     => ARRAY_A,
				] );
				woocommerce_store_api_register_endpoint_data( [
					'endpoint'        => 'cart',
					'namespace'       => 'exacoat_coupons',
					'data_callback'   => [ __CLASS__, 'get_store_api_coupons_data' ],
					'schema_callback' => [ __CLASS__, 'get_store_api_coupons_schema' ],
					'schema_type'     => ARRAY_A,
				] );
			}
		} catch ( \Throwable $e ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( 'Exacoat Store API Callback Registration: ' . $e->getMessage() );
			}
		}
	}

	/**
	 * Extended coupon and cashback details for headless Store API cart.
	 */
	public static function get_store_api_coupons_data(): array {
		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			return [ 'coupons' => [] ];
		}
		$applied = (array) WC()->cart->get_applied_coupons();
		$cart_subtotal = (float) WC()->cart->get_subtotal();
		$list = [];

		foreach ( $applied as $code ) {
			$coupon = new WC_Coupon( $code );
			$id = $coupon->get_id();
			if ( ! $id ) {
				continue;
			}
			$discount_type = (string) $coupon->get_discount_type();
			$amount        = (float) $coupon->get_amount();
			$label         = (string) get_post_meta( $id, '_acfw_coupon_label', true ) ?: '';
			$is_cashback   = ( false !== strpos( $discount_type, 'cashback' ) );
			$waiting_days  = (int) get_post_meta( $id, '_acfw_cashback_waiting_period', true );

			$cashback_amount = 0.0;
			if ( $is_cashback ) {
				if ( 'acfw_percentage_cashback' === $discount_type || false !== strpos( $discount_type, 'percentage' ) ) {
					$cashback_amount = $cart_subtotal * ( $amount / 100.0 );
					$cap = (float) get_post_meta( $id, '_acfw_percentage_discount_cap', true );
					if ( $cap > 0 && $cashback_amount > $cap ) {
						$cashback_amount = $cap;
					}
				} else {
					$cashback_amount = $amount;
				}
			}

			$list[] = [
				'code'                    => strtoupper( $code ),
				'label'                   => $label ?: strtoupper( $code ),
				'discount_type'           => $discount_type,
				'amount'                  => $amount,
				'is_cashback'             => $is_cashback,
				'cashback_percent'        => $is_cashback ? $amount : 0,
				'cashback_waiting_period' => $waiting_days,
				'cashback_amount'         => round( $cashback_amount, 2 ),
			];
		}

		return [ 'coupons' => $list ];
	}

	public static function get_store_api_coupons_schema(): array {
		return [
			'coupons' => [
				'description' => 'Extended coupon and cashback details.',
				'type'        => 'array',
				'context'     => [ 'view', 'edit' ],
				'readonly'    => true,
			],
		];
	}

	/**
	 * Handle store credit application or removal from the headless checkout.
	 *
	 * @param array $data Extension data payload containing 'amount'.
	 * @throws Exception|\Automattic\WooCommerce\StoreApi\Exceptions\RouteException On validation or application failure.
	 * @return array Extension result.
	 */
	public static function handle_store_credit_update( array $data ): array {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			self::throw_store_api_error( 'artmatter_store_credit_unauthorized', __( 'You must be signed in to use store credit.', 'artmatter-core' ), 401 );
		}

		if ( function_exists( 'WC' ) && WC()->customer ) {
			$cart_customer_id = (int) WC()->customer->get_id();
			if ( $cart_customer_id && $cart_customer_id !== $user_id ) {
				self::throw_store_api_error( 'artmatter_store_credit_mismatch', __( 'Customer session mismatch.', 'artmatter-core' ), 403 );
			}
		}

		$amount = isset( $data['amount'] ) ? floatval( $data['amount'] ) : 0.0;

		// Safely locate Store_Credits_Checkout module from ACFWF or ACFWP
		$sc_checkout = null;
		if ( function_exists( 'ACFWF' ) ) {
			try {
				$sc_checkout = ACFWF()->Store_Credits_Checkout;
			} catch ( \Throwable $e ) {
				$sc_checkout = null;
			}
		}
		if ( ! $sc_checkout && function_exists( 'ACFWP' ) ) {
			try {
				$sc_checkout = ACFWP()->Store_Credits_Checkout;
			} catch ( \Throwable $e ) {
				$sc_checkout = null;
			}
		}

		// Removal of store credit
		if ( $amount <= 0 ) {
			if ( $sc_checkout && method_exists( $sc_checkout, 'clear_store_credit_session' ) ) {
				$sc_checkout->clear_store_credit_session();
			} else {
				if ( function_exists( 'WC' ) && WC()->session ) {
					WC()->session->set( 'acfw_store_credits_discount', null );
					WC()->session->set( 'acfw_store_credits_coupon_discount', null );
				}
			}

			$coupon_code = ( $sc_checkout && method_exists( $sc_checkout, 'get_store_credit_coupon_code' ) )
				? $sc_checkout->get_store_credit_coupon_code()
				: 'store credit';

			if ( $coupon_code && function_exists( 'WC' ) && WC()->cart && WC()->cart->has_discount( $coupon_code ) ) {
				WC()->cart->remove_coupon( $coupon_code );
			}
			if ( function_exists( 'WC' ) && WC()->cart ) {
				WC()->cart->calculate_totals();
			}
			return [
				'status' => 'success',
				'amount' => 0,
			];
		}

		// Retrieve customer store credit balance
		$balance = 0.0;
		if ( function_exists( 'ACFWF' ) ) {
			try {
				$balance = (float) ACFWF()->Store_Credits_Calculate->get_customer_balance( $user_id );
			} catch ( \Throwable $e ) {
				$balance = (float) get_user_meta( $user_id, 'acfw_store_credit_balance', true );
			}
		} else {
			$balance = (float) get_user_meta( $user_id, 'acfw_store_credit_balance', true );
		}
		$balance = (float) apply_filters( 'acfw_filter_amount', $balance );

		if ( $amount > $balance ) {
			self::throw_store_api_error( 'artmatter_store_credits_insufficient', __( 'The requested amount exceeds your available store credit balance.', 'artmatter-core' ), 400 );
		}

		// Delegate to Advanced Coupons if checkout model is available
		if ( $sc_checkout && method_exists( $sc_checkout, 'redeem_store_credits' ) ) {
			$result = $sc_checkout->redeem_store_credits( $user_id, $amount );
			if ( is_wp_error( $result ) ) {
				self::throw_store_api_error( $result->get_error_code(), $result->get_error_message(), 400 );
			}
		} else {
			// Direct fallback application via ACFW session and virtual coupon
			if ( function_exists( 'WC' ) && WC()->cart && WC()->session ) {
				$cart_subtotal = WC()->cart->get_subtotal();
				$cart_total    = $cart_subtotal + ( wc_prices_include_tax() ? WC()->cart->get_subtotal_tax() : 0 );
				$apply_amount  = min( $amount, max( 0.0, (float) $cart_total ) );

				$session_data = [
					'amount'         => $apply_amount,
					'cart_total'     => $cart_total,
					'subtotal'       => $cart_subtotal,
					'shipping_total' => WC()->cart->get_shipping_total(),
					'currency'       => get_woocommerce_currency(),
				];
				WC()->session->set( 'acfw_store_credits_coupon_discount', $session_data );
				WC()->session->set( 'acfw_store_credits_discount', $session_data );

				$coupon_code = 'store credit';
				if ( ! WC()->cart->has_discount( $coupon_code ) ) {
					$applied = WC()->cart->get_applied_coupons();
					$applied[] = $coupon_code;
					WC()->cart->set_applied_coupons( $applied );
				}
			}
		}

		if ( function_exists( 'WC' ) && WC()->cart ) {
			WC()->cart->calculate_totals();
		}

		return [
			'status' => 'success',
			'amount' => $amount,
		];
	}

	/**
	 * Intercept WooCommerce Order Received page and redirect to Next.js thank you page.
	 */
	private static function get_web_url(): string {
		if ( defined( 'EXACOAT_WEB_URL' ) && EXACOAT_WEB_URL ) {
			return EXACOAT_WEB_URL;
		}
		if ( defined( 'ARTMATTER_WEB_URL' ) && ARTMATTER_WEB_URL ) {
			return ARTMATTER_WEB_URL;
		}
		return getenv( 'EXACOAT_WEB_URL' ) ?: ( getenv( 'ARTMATTER_WEB_URL' ) ?: 'https://exacoat.com' );
	}

	public static function handle_order_received_redirect(): void {
		if ( function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
			$order_id  = absint( get_query_var( 'order-received' ) );
			$order_key = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '';

			$target = rtrim( self::get_web_url(), '/' ) . '/thank-you';
			if ( $order_id ) {
				$order = wc_get_order( $order_id );
				if ( $order instanceof WC_Order ) {
					$order_key = $order_key ?: $order->get_order_key();
					$target    = add_query_arg( [
						'order'  => $order_id,
						'key'    => $order_key,
						'status' => $order->get_status(),
					], $target );
				} else {
					$target = add_query_arg( [ 'order' => $order_id ], $target );
				}
			}
			wp_redirect( $target, 302, 'Exacoat' );
			exit;
		}
	}

	/**
	 * Whitelist storefront domain for WordPress safe redirects.
	 */
	public static function filter_allowed_redirect_hosts( array $hosts ): array {
		$web_host = parse_url( self::get_web_url(), PHP_URL_HOST );
		if ( $web_host && ! in_array( $web_host, $hosts, true ) ) {
			$hosts[] = $web_host;
		}
		foreach ( [ 'exacoat.com', 'www.exacoat.com', 'artmatter.co', 'www.artmatter.co' ] as $h ) {
			if ( ! in_array( $h, $hosts, true ) ) {
				$hosts[] = $h;
			}
		}
		return $hosts;
	}

	/**
	 * Intercept /checkout on CMS and redirect canceled PayPal / gateway returns or direct visits back to storefront checkout.
	 */
	public static function handle_checkout_cancellation_redirect(): void {
		if ( is_admin() ) {
			return;
		}

		$is_canceled = ( isset( $_GET['ppcp_action'] ) && 'canceled' === $_GET['ppcp_action'] )
			|| ( isset( $_GET['payment_status'] ) && 'canceled' === $_GET['payment_status'] );
		$order_id    = isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0;
		$token       = isset( $_GET['token'] ) ? sanitize_text_field( wp_unslash( $_GET['token'] ) ) : '';

		$is_checkout_path = false;
		$request_uri = $_SERVER['REQUEST_URI'] ?? '';
		$path = parse_url( $request_uri, PHP_URL_PATH ) ?: '';
		if ( function_exists( 'is_checkout' ) && is_checkout() && ! is_order_received_page() ) {
			$is_checkout_path = true;
		} elseif ( preg_match( '#^/(checkout|cart-empty)#i', $path ) ) {
			$is_checkout_path = true;
		}

		if ( $is_canceled || $is_checkout_path ) {
			if ( $is_canceled && $order_id && function_exists( 'wc_get_order' ) ) {
				$order = wc_get_order( $order_id );
				if ( $order instanceof WC_Order && $order->has_status( [ 'pending', 'on-hold', 'failed' ] ) ) {
					$order->update_status( 'cancelled', __( 'Customer cancelled payment on PayPal.', 'artmatter-core' ) );
				}
			}

			$target = rtrim( self::get_web_url(), '/' ) . '/checkout';
			$args   = [];
			if ( $is_canceled ) {
				$args['payment_status'] = 'canceled';
				$args['ppcp_action']    = 'canceled';
			}
			if ( $order_id ) {
				$args['order_id'] = $order_id;
			}
			if ( $token ) {
				$args['token'] = $token;
			}
			if ( ! empty( $args ) ) {
				$target = add_query_arg( $args, $target );
			}

			wp_redirect( $target, 302, 'Exacoat' );
			exit;
		}
	}

	/**
	 * Ensure cancellation URLs generated by WooCommerce point directly to the storefront checkout.
	 */
	public static function filter_cancel_order_url( string $url, $order = null ): string {
		$target = rtrim( self::get_web_url(), '/' ) . '/checkout';
		return add_query_arg( [
			'payment_status' => 'canceled',
			'order_id'       => $order instanceof WC_Order ? $order->get_id() : ( isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : '' ),
		], $target );
	}

	public static function filter_cancel_order_url_raw( string $url ): string {
		return rtrim( self::get_web_url(), '/' ) . '/checkout?payment_status=canceled';
	}

	/**
	 * Rewrite PayPal Payments order creation payload to ensure cancel_url and return_url use the storefront domain directly.
	 */
	public static function filter_paypal_order_data( $data, $order = null ) {
		if ( ! is_array( $data ) ) {
			return $data;
		}

		$cms_origin = rtrim( home_url(), '/' );
		$web_origin = rtrim( self::get_web_url(), '/' );

		foreach ( [ 'experience_context', 'application_context' ] as $ctx ) {
			if ( isset( $data[ $ctx ] ) && is_array( $data[ $ctx ] ) ) {
				if ( ! empty( $data[ $ctx ]['cancel_url'] ) && is_string( $data[ $ctx ]['cancel_url'] ) ) {
					$data[ $ctx ]['cancel_url'] = str_replace( $cms_origin, $web_origin, $data[ $ctx ]['cancel_url'] );
				}
				if ( ! empty( $data[ $ctx ]['return_url'] ) && is_string( $data[ $ctx ]['return_url'] ) ) {
					$data[ $ctx ]['return_url'] = str_replace( $cms_origin, $web_origin, $data[ $ctx ]['return_url'] );
				}
			}
		}

		return $data;
	}

	/**
	 * Provide configured skin composite image for WooCommerce transactional emails and admin order screen
	 */
	public static function filter_order_item_thumbnail( $image, $item ) {
		if ( ! is_a( $item, 'WC_Order_Item_Product' ) ) {
			return $image;
		}

		$custom_img = $item->get_meta( '_configured_image_url' )
			?: ( $item->get_meta( '_configurator_image' )
			?: ( $item->get_meta( 'mkl_pc_thumbnail_url' )
			?: ( $item->get_meta( '_thumbnail_url' )
			?: ( $item->get_meta( 'image_url' ) ?: '' ) ) ) );

		if ( ! empty( $custom_img ) ) {
			return '<img src="' . esc_url( $custom_img ) . '" alt="' . esc_attr( $item->get_name() ) . '" width="64" height="64" style="vertical-align:middle; margin-right: 10px; border-radius: 6px; object-fit: cover;" />';
		}

		return $image;
	}

	/**
	 * Helper to throw a Store API compatible RouteException or fallback Exception.
	 */
	private static function throw_store_api_error( string $code, string $message, int $status = 400 ): void {
		if ( class_exists( '\Automattic\WooCommerce\StoreApi\Exceptions\RouteException' ) ) {
			throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException( $code, $message, $status );
		}
		throw new \Exception( $message, $status );
	}

	/**
	 * Safe WooCommerce Cart and Session Initialization for REST API
	 */
	public static function ensure_wc_session_and_cart(): bool {
		if ( ! function_exists( 'WC' ) ) {
			return false;
		}

		if ( is_null( WC()->session ) && class_exists( 'WC_Session_Handler' ) ) {
			WC()->session = new WC_Session_Handler();
			WC()->session->init();
		}
		if ( is_null( WC()->customer ) && class_exists( 'WC_Customer' ) ) {
			WC()->customer = new WC_Customer( get_current_user_id(), true );
		}
		if ( is_null( WC()->cart ) && class_exists( 'WC_Cart' ) ) {
			WC()->cart = new WC_Cart();
			WC()->cart->get_cart_from_session();
		}

		if ( function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}

		return true;
	}
}

}

if ( ! class_exists( 'Artmatter_Checkout_Engine' ) ) {
	class_alias( 'Exacoat_Checkout_Engine', 'Artmatter_Checkout_Engine' );
}

