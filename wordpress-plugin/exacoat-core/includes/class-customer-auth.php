<?php
/**
 * Headless customer authentication for the Artmatter storefront.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Customer_Auth' ) ) {

class Exacoat_Customer_Auth {
	private const NAMESPACE = 'artmatter-core/v1';
	private const SESSION_TTL = 1209600;
	private const STATE_TTL = 600;
	private const CODE_TTL = 90;

	public static function init(): void {
		add_filter( 'determine_current_user', [ __CLASS__, 'determine_current_user' ], 20 );
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
		add_action( 'template_redirect', [ __CLASS__, 'handle_social_start' ], -100 );
		add_action( 'template_redirect', [ __CLASS__, 'handle_social_callback' ], -100 );
		add_filter( 'retrieve_password_message', [ __CLASS__, 'use_storefront_reset_url' ], 10, 4 );
		add_filter( 'nsl_googlelast_location_redirect', [ __CLASS__, 'filter_nsl_redirect' ], 9999, 2 );
		add_filter( 'google_login_redirect_url', [ __CLASS__, 'filter_nsl_fixed_redirect' ], 9999, 2 );
		add_filter( 'google_register_redirect_url', [ __CLASS__, 'filter_nsl_fixed_redirect' ], 9999, 2 );
	}

	public static function register_routes(): void {
		$namespaces = [ 'exacoat-core/v1', 'artmatter-core/v1', 'exacoat/v1' ];
		foreach ( [ 'login', 'register', 'forgot', 'reset', 'exchange', 'logout', 'profile', 'password', 'orders', 'order', 'coupons', 'link-ticket', 'delete' ] as $action ) {
			foreach ( $namespaces as $namespace ) {
				register_rest_route( $namespace, '/auth/' . $action, [
					'methods'             => 'POST',
					'callback'            => [ __CLASS__, 'rest_' . str_replace( '-', '_', $action ) ],
					'permission_callback' => '__return_true',
				] );
			}
		}

		foreach ( $namespaces as $namespace ) {
			register_rest_route( $namespace, '/auth/me', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_me' ],
				'permission_callback' => '__return_true',
			] );

			register_rest_route( $namespace, '/auth/coupons', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_coupons' ],
				'permission_callback' => '__return_true',
			] );
		}
	}

	public static function rest_login( WP_REST_Request $request ) {
		if ( self::is_rate_limited( 'login', 12, 15 * MINUTE_IN_SECONDS ) ) {
			return self::error( 'Too many sign-in attempts. Please wait a few minutes.', 429 );
		}

		$email    = sanitize_email( (string) $request->get_param( 'email' ) );
		$password = (string) $request->get_param( 'password' );
		if ( ! $email || ! $password ) {
			return self::error( 'Enter your email address and password.', 400 );
		}

		$user = wp_authenticate( $email, $password );
		if ( is_wp_error( $user ) ) {
			return self::error( 'The email or password is incorrect.', 401 );
		}

		return self::authenticated_response( $user );
	}

	public static function rest_register( WP_REST_Request $request ) {
		if ( self::is_rate_limited( 'register', 6, HOUR_IN_SECONDS ) ) {
			return self::error( 'Too many account requests. Please try again later.', 429 );
		}

		$name     = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$email    = sanitize_email( (string) $request->get_param( 'email' ) );
		$password = (string) $request->get_param( 'password' );
		$terms    = (string) $request->get_param( 'terms' );

		if ( ! $name || ! is_email( $email ) || strlen( $password ) < 8 ) {
			return self::error( 'Enter your name, a valid email, and a password of at least 8 characters.', 400 );
		}
		if ( 'accepted' !== $terms ) {
			return self::error( 'You must agree to the Terms of Service and Privacy Policy.', 400 );
		}
		if ( email_exists( $email ) ) {
			return self::error( 'An account with this email already exists. Try signing in instead.', 409 );
		}

		$name_parts = preg_split( '/\s+/', trim( $name ), 2 );
		$first_name = $name_parts[0] ?? '';
		$last_name  = $name_parts[1] ?? '';
		$username   = self::unique_username( $email );

		if ( function_exists( 'wc_create_new_customer' ) ) {
			$user_id = wc_create_new_customer( $email, $username, $password, [
				'first_name'   => $first_name,
				'last_name'    => $last_name,
				'display_name' => $name,
			] );
		} else {
			$user_id = wp_create_user( $username, $password, $email );
			if ( ! is_wp_error( $user_id ) ) {
				wp_update_user( [ 'ID' => $user_id, 'display_name' => $name, 'first_name' => $first_name, 'last_name' => $last_name ] );
			}
		}

		if ( is_wp_error( $user_id ) ) {
			return self::error( $user_id->get_error_message(), 400 );
		}

		update_user_meta( $user_id, '_artmatter_terms_accepted_at', gmdate( 'c' ) );
		return self::authenticated_response( get_user_by( 'id', $user_id ), 201 );
	}

	public static function rest_forgot( WP_REST_Request $request ) {
		if ( self::is_rate_limited( 'forgot', 5, HOUR_IN_SECONDS ) ) {
			return self::error( 'Too many reset requests. Please try again later.', 429 );
		}

		$email = sanitize_email( (string) $request->get_param( 'email' ) );
		if ( is_email( $email ) ) {
			retrieve_password( $email );
		}

		return self::response( [
			'success' => true,
			'message' => 'If that account exists, a secure reset link has been sent.',
		] );
	}

	public static function rest_reset( WP_REST_Request $request ) {
		$key      = sanitize_text_field( (string) $request->get_param( 'key' ) );
		$login    = sanitize_text_field( (string) $request->get_param( 'login' ) );
		$password = (string) $request->get_param( 'password' );
		if ( strlen( $password ) < 8 ) {
			return self::error( 'Your new password must contain at least 8 characters.', 400 );
		}

		$user = check_password_reset_key( $key, $login );
		if ( is_wp_error( $user ) ) {
			return self::error( 'This reset link is invalid or has expired. Request a new one.', 400 );
		}

		reset_password( $user, $password );
		return self::response( [ 'success' => true, 'message' => 'Your password has been updated. You can now sign in.' ] );
	}

	public static function rest_exchange( WP_REST_Request $request ) {
		$code = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $request->get_param( 'code' ) );
		if ( ! $code ) {
			return self::error( 'The social sign-in code is missing.', 400 );
		}

		$key  = 'artmatter_auth_code_' . hash( 'sha256', $code );
		$data = get_transient( $key );
		delete_transient( $key );
		if ( ! is_array( $data ) || empty( $data['user_id'] ) ) {
			return self::error( 'This social sign-in has expired. Please try again.', 401 );
		}

		$user = get_user_by( 'id', (int) $data['user_id'] );
		return $user ? self::authenticated_response( $user ) : self::error( 'Account not found.', 404 );
	}

	public static function rest_me( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		return $user instanceof WP_User
			? self::response( [ 'success' => true, 'user' => self::user_payload( $user ) ] )
			: self::error( 'Your session has expired.', 401 );
	}

	public static function rest_logout( WP_REST_Request $request ) {
		$token = self::bearer_token( $request );
		if ( $token && preg_match( '/^(\d+)\.([A-Za-z0-9_-]+)$/', $token, $matches ) ) {
			WP_Session_Tokens::get_instance( (int) $matches[1] )->destroy( $matches[2] );
		}
		return self::response( [ 'success' => true, 'message' => 'You have been signed out.' ] );
	}

	public static function rest_delete( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		if ( ! $user instanceof WP_User ) {
			return self::error( 'Your session has expired.', 401 );
		}

		if ( user_can( $user, 'manage_options' ) ) {
			return self::error( 'Administrator accounts cannot be deleted via the storefront.', 403 );
		}

		$confirm_email = sanitize_email( (string) $request->get_param( 'email' ) );
		if ( ! $confirm_email || strtolower( trim( $confirm_email ) ) !== strtolower( trim( $user->user_email ) ) ) {
			return self::error( 'Please enter your account email to confirm deletion.', 400 );
		}

		$user_id = (int) $user->ID;

		// Invalidate all active session tokens immediately
		WP_Session_Tokens::get_instance( $user_id )->destroy_all();

		// Reassign authored content to an administrator to preserve database referential integrity
		require_once ABSPATH . 'wp-admin/includes/user.php';
		$admin_users = get_users( [ 'role' => 'administrator', 'number' => 1 ] );
		$reassign_id = ! empty( $admin_users ) ? (int) $admin_users[0]->ID : null;

		$deleted = wp_delete_user( $user_id, $reassign_id );
		if ( ! $deleted ) {
			return self::error( 'Unable to delete account. Please contact support.', 500 );
		}

		return self::response( [
			'success' => true,
			'message' => 'Your account has been permanently deleted.',
		] );
	}

	public static function rest_profile( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		if ( ! $user instanceof WP_User ) {
			return self::error( 'Your session has expired.', 401 );
		}

		$first_name = sanitize_text_field( (string) $request->get_param( 'firstName' ) );
		$last_name  = sanitize_text_field( (string) $request->get_param( 'lastName' ) );
		$email      = sanitize_email( (string) $request->get_param( 'email' ) );
		if ( ! $first_name || ! is_email( $email ) ) {
			return self::error( 'Enter your first name and a valid email address.', 400 );
		}

		$existing = get_user_by( 'email', $email );
		if ( $existing && (int) $existing->ID !== (int) $user->ID ) {
			return self::error( 'That email address is already connected to another account.', 409 );
		}

		$result = wp_update_user( [
			'ID'           => $user->ID,
			'first_name'   => $first_name,
			'last_name'    => $last_name,
			'display_name' => trim( $first_name . ' ' . $last_name ),
			'user_email'   => $email,
		] );
		if ( is_wp_error( $result ) ) {
			return self::error( $result->get_error_message(), 400 );
		}

		$billing_address = $request->get_param( 'billingAddress' );
		if ( is_array( $billing_address ) ) {
			$address_result = self::save_customer_address( (int) $user->ID, $email, $billing_address );
			if ( is_wp_error( $address_result ) ) {
				return self::error( $address_result->get_error_message(), 400 );
			}
		} else {
			update_user_meta( $user->ID, 'billing_first_name', $first_name );
			update_user_meta( $user->ID, 'billing_last_name', $last_name );
		}
		update_user_meta( $user->ID, 'billing_email', $email );
		return self::response( [
			'success' => true,
			'message' => 'Your account details have been updated.',
			'user'    => self::user_payload( get_user_by( 'id', $user->ID ) ),
		] );
	}

	private static function save_customer_address( int $user_id, string $email, array $input ) {
		$fields  = [ 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'phone' ];
		$address = [];
		foreach ( $fields as $field ) {
			$value = sanitize_text_field( (string) ( $input[ $field ] ?? '' ) );
			if ( strlen( $value ) > 200 ) {
				return new WP_Error( 'artmatter_address_too_long', 'One or more address fields are too long.' );
			}
			$address[ $field ] = $value;
		}

		$address['country'] = strtoupper( $address['country'] );
		$required = [ 'first_name', 'last_name', 'address_1', 'country', 'phone' ];
		if ( 'ID' === $address['country'] ) {
			$required[] = 'address_2';
			$required[] = 'city';
			$required[] = 'state';
			$required[] = 'postcode';
		}
		foreach ( $required as $field ) {
			if ( '' === $address[ $field ] ) {
				return new WP_Error( 'artmatter_address_required', 'Complete all required delivery address fields.' );
			}
		}

		if ( function_exists( 'WC' ) && WC()->countries ) {
			$countries = WC()->countries->get_countries();
			if ( ! isset( $countries[ $address['country'] ] ) ) {
				return new WP_Error( 'artmatter_address_country', 'Select a valid country or region.' );
			}
			$states = WC()->countries->get_states( $address['country'] );
			if ( $address['state'] && is_array( $states ) && ! empty( $states ) && ! isset( $states[ $address['state'] ] ) ) {
				return new WP_Error( 'artmatter_address_state', 'Select a valid state or province.' );
			}
		}

		foreach ( $address as $field => $value ) {
			update_user_meta( $user_id, 'billing_' . $field, $value );
			if ( 'phone' !== $field ) {
				update_user_meta( $user_id, 'shipping_' . $field, $value );
			}
		}
		update_user_meta( $user_id, 'billing_email', $email );

		return true;
	}

	public static function rest_password( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		if ( ! $user instanceof WP_User ) {
			return self::error( 'Your session has expired.', 401 );
		}

		$current = (string) $request->get_param( 'currentPassword' );
		$new     = (string) $request->get_param( 'newPassword' );
		if ( ! wp_check_password( $current, $user->user_pass, $user->ID ) ) {
			return self::error( 'Your current password is incorrect.', 400 );
		}
		if ( strlen( $new ) < 8 ) {
			return self::error( 'Your new password must contain at least 8 characters.', 400 );
		}
		if ( $current === $new ) {
			return self::error( 'Choose a password different from your current password.', 400 );
		}

		wp_set_password( $new, $user->ID );
		return self::authenticated_response( get_user_by( 'id', $user->ID ), 200, 'Your password has been updated.' );
	}

	public static function rest_orders( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		if ( ! $user instanceof WP_User ) {
			return self::error( 'Your session has expired.', 401 );
		}
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return self::error( 'Order history is currently unavailable.', 503 );
		}

		$page = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = 10;
		$customer_query = wc_get_orders( [
			'customer_id' => $user->ID,
			'limit'       => -1,
			'return'      => 'ids',
			'orderby'     => 'date',
			'order'       => 'DESC',
		] );
		$email_query = wc_get_orders( [
			'billing_email' => $user->user_email,
			'limit'         => -1,
			'return'        => 'ids',
			'orderby'       => 'date',
			'order'         => 'DESC',
		] );
		$order_ids = array_values( array_unique( array_map( 'intval', array_merge( $customer_query, $email_query ) ) ) );
		usort( $order_ids, function( $a, $b ) {
			$order_a = wc_get_order( $a );
			$order_b = wc_get_order( $b );
			$time_a  = $order_a && $order_a->get_date_created() ? $order_a->get_date_created()->getTimestamp() : 0;
			$time_b  = $order_b && $order_b->get_date_created() ? $order_b->get_date_created()->getTimestamp() : 0;
			return $time_b <=> $time_a;
		} );
		$total       = count( $order_ids );
		$total_pages = max( 1, (int) ceil( $total / $per_page ) );
		$order_ids   = array_slice( $order_ids, ( $page - 1 ) * $per_page, $per_page );
		$carriers    = class_exists( 'Artmatter_Shipping_Tracker' ) ? Artmatter_Shipping_Tracker::get_carrier_registry() : [
			'pos'     => [ 'name' => 'POS Indonesia' ],
			'sicepat' => [ 'name' => 'SiCepat' ],
			'jne'     => [ 'name' => 'JNE Express' ],
			'dhl'     => [ 'name' => 'DHL Express' ],
			'fedex'   => [ 'name' => 'FedEx' ],
			'goorita' => [ 'name' => 'Goorita' ],
			'biteship'=> [ 'name' => 'Biteship' ],
		];

		$orders = [];
		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order instanceof WC_Order ) {
				continue;
			}
			$items = [];
			foreach ( $order->get_items() as $item ) {
				$product = $item->get_product();
				$product_id = $item->get_product_id();
				$image = self::resolve_order_item_image_url( $product, $product_id, $item );
				$slug = ( $product instanceof WC_Product ) ? $product->get_slug() : '';
				$url  = $slug ? '/product/' . rawurlencode( $slug ) : '';
				$items[] = [
					'id'       => $product_id,
					'name'     => $item->get_name(),
					'quantity' => $item->get_quantity(),
					'image'    => $image,
					'slug'     => $slug,
					'url'      => $url,
					'layers'   => self::extract_order_item_layers( $item ),
				];
			}
			$view_url        = $order->get_checkout_order_received_url() ?: $order->get_view_order_url();
			$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) ?: $order->get_meta( '_tracking_number' ) ?: $order->get_meta( '_exacoat_tracking_number' ) ?: $order->get_meta( '_artmatter_tracking_number' ) );
			$carrier_raw     = (string) ( $order->get_meta( 'carrier_id' ) ?: $order->get_meta( '_carrier_id' ) );
			$carrier_key     = strtolower( trim( $carrier_raw ) );
			$carrier_name    = $carriers[ $carrier_key ]['name'] ?? ( $carrier_key ? ucfirst( $carrier_key ) : '' );
			$tracker_class   = class_exists( 'Exacoat_Shipping_Tracker' ) ? 'Exacoat_Shipping_Tracker' : ( class_exists( 'Artmatter_Shipping_Tracker' ) ? 'Artmatter_Shipping_Tracker' : null );
			$tracking_url    = ( $tracking_number && $tracker_class )
				? $tracker_class::get_carrier_tracking_url( $carrier_key, $tracking_number )
				: '';
			$checkpoints     = $order->get_meta( '_exacoat_tracking_checkpoints' ) ?: ( $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: ( get_post_meta( $order->get_id(), '_exacoat_tracking_checkpoints', true ) ?: get_post_meta( $order->get_id(), '_artmatter_tracking_checkpoints', true ) ) );

			$orders[] = [
				'id'              => $order->get_id(),
				'number'          => (string) $order->get_order_number(),
				'status'          => $order->get_status(),
				'statusLabel'     => wc_get_order_status_name( $order->get_status() ),
				'date'            => $order->get_date_created() ? $order->get_date_created()->date( DATE_ATOM ) : '',
				'total'           => (float) $order->get_total(),
				'currency'        => $order->get_currency(),
				'itemCount'       => $order->get_item_count(),
				'viewUrl'         => esc_url_raw( $view_url ),
				'shippingMethod'  => self::resolve_order_shipping_method( $order ),
				'trackingNumber'  => $tracking_number,
				'trackingCarrier' => $carrier_name,
				'trackingUrl'     => esc_url_raw( $tracking_url ),
				'checkpoints'     => is_array( $checkpoints ) ? array_values( $checkpoints ) : [],
				'items'           => $items,
			];
		}

		return self::response( [
			'success'    => true,
			'orders'     => $orders,
			'total'      => $total,
			'totalPages' => $total_pages,
			'page'       => min( $page, $total_pages ),
		] );
	}

	public static function rest_order( WP_REST_Request $request ) {
		$order_id = absint( $request->get_param( 'orderId' ) );
		$order    = $order_id ? wc_get_order( $order_id ) : null;
		if ( ! $order instanceof WC_Order ) {
			return self::error( 'Order not found.', 404 );
		}

		$user     = self::authenticated_user( $request );
		$is_owner = ( $user instanceof WP_User && self::user_owns_order( $user, $order ) );

		$order_key      = sanitize_text_field( (string) $request->get_param( 'key' ) );
		$billing_email  = sanitize_email( (string) $request->get_param( 'email' ) );
		$is_key_valid   = ( ! empty( $order_key ) && hash_equals( (string) $order->get_order_key(), $order_key ) );
		$is_email_valid = ( ! empty( $billing_email ) && ! empty( $order->get_billing_email() ) && 0 === strcasecmp( (string) $order->get_billing_email(), $billing_email ) );
		if ( $is_key_valid && ! empty( $billing_email ) && ! empty( $order->get_billing_email() ) ) {
			$is_key_valid = ( 0 === strcasecmp( (string) $order->get_billing_email(), $billing_email ) );
		}

		if ( ! $is_owner && ! $is_key_valid && ! $is_email_valid ) {
			return self::error( $user ? 'Order not found.' : 'Order details could not be found with the credentials provided.', 401 );
		}

		$items = [];
		foreach ( $order->get_items() as $item ) {
			$product    = $item->get_product();
			$product_id = $item->get_product_id();
			$image      = self::resolve_order_item_image_url( $product, $product_id, $item );
			$slug = ( $product instanceof WC_Product ) ? $product->get_slug() : '';
			$url  = $slug ? '/product/' . rawurlencode( $slug ) : '';
			$items[] = [
				'id'       => $product_id,
				'name'     => $item->get_name(),
				'quantity' => $item->get_quantity(),
				'image'    => $image,
				'total'    => (float) $item->get_total(),
				'slug'     => $slug,
				'url'      => $url,
				'layers'   => self::extract_order_item_layers( $item ),
			];
		}

		$carriers = class_exists( 'Artmatter_Shipping_Tracker' ) ? Artmatter_Shipping_Tracker::get_carrier_registry() : [
			'pos'     => [ 'name' => 'POS Indonesia' ],
			'sicepat' => [ 'name' => 'SiCepat' ],
			'jne'     => [ 'name' => 'JNE Express' ],
			'dhl'     => [ 'name' => 'DHL Express' ],
			'fedex'   => [ 'name' => 'FedEx' ],
			'goorita' => [ 'name' => 'Goorita' ],
			'biteship'=> [ 'name' => 'Biteship' ],
		];

		$shipping_address = $order->get_formatted_shipping_address() ?: $order->get_formatted_billing_address();
		$shipping_address = preg_replace( '/<br\s*\/?>/i', "\n", $shipping_address );
		$tracking_number  = (string) ( $order->get_meta( 'tracking_number' ) ?: $order->get_meta( '_tracking_number' ) ?: $order->get_meta( '_exacoat_tracking_number' ) ?: $order->get_meta( '_artmatter_tracking_number' ) );
		$tracking_carrier = (string) ( $order->get_meta( 'carrier_id' ) ?: $order->get_meta( '_carrier_id' ) );
		$carrier_key      = strtolower( trim( $tracking_carrier ) );
		$carrier_name     = $carriers[ $carrier_key ]['name'] ?? ( $carrier_key ? ucfirst( $carrier_key ) : '' );
		$tracker_class    = class_exists( 'Exacoat_Shipping_Tracker' ) ? 'Exacoat_Shipping_Tracker' : ( class_exists( 'Artmatter_Shipping_Tracker' ) ? 'Artmatter_Shipping_Tracker' : null );
		$tracking_url     = ( $tracking_number && $tracker_class )
			? $tracker_class::get_carrier_tracking_url( $carrier_key, $tracking_number )
			: '';

		$checkpoints = $order->get_meta( '_exacoat_tracking_checkpoints' ) ?: ( $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: ( get_post_meta( $order->get_id(), '_exacoat_tracking_checkpoints', true ) ?: get_post_meta( $order->get_id(), '_artmatter_tracking_checkpoints', true ) ) );
		if ( empty( $checkpoints ) && $tracking_number && $tracker_class ) {
			$tracker_class::sync_order_tracking( $order->get_id() );
			$checkpoints = $order->get_meta( '_exacoat_tracking_checkpoints' ) ?: ( $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: ( get_post_meta( $order->get_id(), '_exacoat_tracking_checkpoints', true ) ?: get_post_meta( $order->get_id(), '_artmatter_tracking_checkpoints', true ) ) );
		}

		$fee_lines   = [];
		$unique_code = null;
		foreach ( $order->get_fees() as $fee ) {
			$fee_name  = $fee->get_name();
			$fee_total = (float) $fee->get_total();
			$fee_lines[] = [
				'id'    => $fee->get_id(),
				'name'  => $fee_name,
				'total' => $fee_total,
			];
			if ( stripos( $fee_name, 'Kode Unik' ) !== false || stripos( $fee_name, 'Unique Payment Code' ) !== false || strtolower( trim( $fee_name ) ) === 'unique code' ) {
				$fee_lines[ count( $fee_lines ) - 1 ]['name'] = 'Unique Payment Code';
				$unique_code = (int) round( $fee_total );
			}
		}

		return self::response( [
			'success' => true,
			'order'   => [
				'id'               => $order->get_id(),
				'number'           => (string) $order->get_order_number(),
				'status'           => $order->get_status(),
				'statusLabel'      => wc_get_order_status_name( $order->get_status() ),
				'date'             => $order->get_date_created() ? $order->get_date_created()->date( DATE_ATOM ) : '',
				'currency'         => $order->get_currency(),
				'subtotal'         => (float) $order->get_subtotal(),
				'discount'         => (float) $order->get_discount_total(),
				'shipping'         => (float) $order->get_shipping_total(),
				'tax'              => (float) $order->get_total_tax(),
				'total'            => (float) $order->get_total(),
				'itemCount'        => $order->get_item_count(),
				'items'            => $items,
				'viewUrl'          => '',
				'trackingUrl'      => esc_url_raw( $tracking_url ),
				'paymentMethod'    => $order->get_payment_method_title(),
				'paymentMethodId'  => (string) $order->get_payment_method(),
				'shippingMethod'   => self::resolve_order_shipping_method( $order ),
				'shippingAddress'  => trim( wp_strip_all_tags( $shipping_address ) ),
				'billingEmail'     => $order->get_billing_email(),
				'billingPhone'     => $order->get_billing_phone(),
				'trackingNumber'   => $tracking_number,
				'trackingCarrier'  => $carrier_name,
				'checkpoints'      => is_array( $checkpoints ) ? array_values( $checkpoints ) : [],
				'feeLines'         => $fee_lines,
				'uniqueCode'       => $unique_code,
				'orderKey'         => (string) $order->get_order_key(),
				'snapToken'        => (string) ( $order->get_meta( '_mt_payment_snap_token' ) ?: '' ),
				'snapUrl'          => (string) ( $order->get_meta( '_mt_payment_url' ) ?: '' ),
			],
		] );
	}

	public static function rest_coupons( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		if ( ! $user instanceof WP_User ) {
			return self::error( 'Your session has expired.', 401 );
		}

		$user_id = $user->ID;
		$user_email = strtolower( trim( $user->user_email ) );
		$user_roles = (array) $user->roles;

		// Fetch coupons configured for My Coupons page OR specifically assigned to this collector
		$posts = get_posts( [
			'post_type'      => 'shop_coupon',
			'post_status'    => 'publish',
			'posts_per_page' => 100,
			'orderby'        => 'date',
			'order'          => 'DESC',
		] );

		$coupons = [];
		$now = time();

		foreach ( $posts as $post ) {
			$id = $post->ID;
			$coupon = new WC_Coupon( $id );
			$code = $coupon->get_code();
			if ( empty( $code ) ) {
				continue;
			}

			// Check ACFW "Show on my coupons page" or "Show only eligible coupon" meta
			$show_on_my_coupons = (
				'yes' === get_post_meta( $id, '_acfw_show_on_my_coupons_page', true ) ||
				'yes' === get_post_meta( $id, '_acfw_show_on_my_coupons', true ) ||
				'yes' === get_post_meta( $id, '_acfw_show_only_eligible_coupon_my_coupons_page', true )
			);

			$email_restrictions = array_map( 'strtolower', array_map( 'trim', (array) $coupon->get_email_restrictions() ) );
			$is_direct_user_coupon = in_array( $user_email, $email_restrictions, true );

			// If explicitly disabled from My Coupons page, skip unless restricted directly to this user
			if ( ! $show_on_my_coupons && ! $is_direct_user_coupon ) {
				continue;
			}

			// 1. Expiration check
			$expires = $coupon->get_date_expires();
			$is_expired = false;
			$formatted_expires = null;
			$expires_iso = null;
			if ( $expires instanceof WC_DateTime ) {
				$expires_timestamp = $expires->getTimestamp();
				$expires_iso = $expires->date( 'c' );
				$formatted_expires = $expires->date_i18n( 'F j, Y' );
				if ( $expires_timestamp < $now ) {
					$is_expired = true;
				}
			}

			if ( $is_expired ) {
				continue;
			}

			// 2. Total usage limit
			$usage_limit = (int) $coupon->get_usage_limit();
			$usage_count = (int) $coupon->get_usage_count();
			if ( $usage_limit > 0 && $usage_count >= $usage_limit ) {
				continue;
			}

			// 3. User usage limit
			$usage_limit_per_user = (int) $coupon->get_usage_limit_per_user();
			if ( $usage_limit_per_user > 0 ) {
				$used_by = (array) $coupon->get_used_by();
				$times_used = 0;
				foreach ( $used_by as $used ) {
					if ( (string) $used === (string) $user_id || strtolower( (string) $used ) === $user_email ) {
						$times_used++;
					}
				}
				if ( $times_used >= $usage_limit_per_user ) {
					continue;
				}
			}

			// 4. Email restrictions
			if ( ! empty( $email_restrictions ) && ! in_array( $user_email, $email_restrictions, true ) ) {
				continue;
			}

			// 5. Role restrictions (ACFW / WooCommerce)
			$role_restrictions = get_post_meta( $id, '_acfw_customer_roles', true )
				?: get_post_meta( $id, '_acfw_role_restrictions', true );
			if ( ! empty( $role_restrictions ) && is_array( $role_restrictions ) ) {
				if ( empty( array_intersect( $user_roles, $role_restrictions ) ) ) {
					continue;
				}
			}

			// 6. Advanced Coupons Cart Conditions (e.g. number-of-orders / first purchase)
			$cart_conditions = get_post_meta( $id, '_acfw_cart_conditions', true );
			if ( ! empty( $cart_conditions ) && is_array( $cart_conditions ) ) {
				$conditions_passed = true;
				foreach ( $cart_conditions as $group ) {
					$fields = $group['fields'] ?? [];
					foreach ( $fields as $field ) {
						$field_type = $field['type'] ?? '';
						$data = $field['data'] ?? [];

						if ( 'number-of-orders' === $field_type ) {
							$target_cond = $data['condition'] ?? '=';
							$target_val  = (int) ( $data['value'] ?? 0 );
							$offset_days = (int) ( $data['offset'] ?? 0 );

							// Calculate user order count
							$order_args = [
								'customer' => [ $user_id, $user_email ],
								'status'   => [ 'wc-completed', 'wc-processing', 'wc-on-hold' ],
								'limit'    => -1,
								'return'   => 'ids',
							];
							if ( $offset_days > 0 ) {
								$order_args['date_after'] = date( 'Y-m-d H:i:s', time() - ( $offset_days * DAY_IN_SECONDS ) );
							}
							$user_orders = function_exists( 'wc_get_orders' ) ? wc_get_orders( $order_args ) : [];
							$user_order_count = is_array( $user_orders ) ? count( $user_orders ) : 0;

							if ( '=' === $target_cond || '==' === $target_cond ) {
								if ( $user_order_count !== $target_val ) {
									$conditions_passed = false;
									break 2;
								}
							} elseif ( '<' === $target_cond ) {
								if ( $user_order_count >= $target_val ) {
									$conditions_passed = false;
									break 2;
								}
							} elseif ( '<=' === $target_cond ) {
								if ( $user_order_count > $target_val ) {
									$conditions_passed = false;
									break 2;
								}
							} elseif ( '>' === $target_cond ) {
								if ( $user_order_count <= $target_val ) {
									$conditions_passed = false;
									break 2;
								}
							} elseif ( '>=' === $target_cond ) {
								if ( $user_order_count < $target_val ) {
									$conditions_passed = false;
									break 2;
								}
							}
						}
					}
				}

				if ( ! $conditions_passed ) {
					continue;
				}
			}

			// Extract friendly display fields
			$label = get_post_meta( $id, '_acfw_coupon_label', true ) ?: '';
			if ( empty( $label ) && ( 0 === strpos( $code, 'EXACOAT' ) || 0 === strpos( $code, 'COLLECTOR' ) || 0 === strpos( $code, 'REVIEW' ) ) ) {
				$label = 'Customer Review Privilege';
			} elseif ( empty( $label ) && 0 === strpos( $code, 'WELCOME' ) ) {
				$label = 'Welcome Privilege: 20% Off';
			}
			$desc = $coupon->get_description();

			// For BOGO deals or special types, extract deal details if description is blank
			$discount_type = $coupon->get_discount_type();
			$amount = (float) $coupon->get_amount();
			$is_cashback = (
				false !== strpos( $discount_type, 'cashback' )
				|| 'yes' === get_post_meta( $id, '_is_coupon_cashback', true )
			);
			$formatted_discount = '';

			if ( $is_cashback ) {
				$formatted_discount = $amount . '% CASHBACK';
			} elseif ( 'percent' === $discount_type ) {
				$formatted_discount = $amount . '% OFF';
			} elseif ( 'fixed_cart' === $discount_type || 'fixed_product' === $discount_type ) {
				$formatted_discount = function_exists( 'wc_price' ) ? html_entity_decode( wp_strip_all_tags( wc_price( $amount ) ) ) : (string) $amount;
			} elseif ( 'acfw_bogo' === $discount_type ) {
				$bogo_deals = get_post_meta( $id, '_acfw_bogo_deals', true );
				if ( is_array( $bogo_deals ) ) {
					$bogo_val = $bogo_deals['deals']['discount_value'] ?? 0;
					$bogo_type = $bogo_deals['deals']['discount_type'] ?? 'percent';
					if ( 'percent' === $bogo_type && $bogo_val > 0 ) {
						$formatted_discount = $bogo_val . '% OFF';
					}
					if ( empty( $desc ) && ! empty( $bogo_deals['notice_settings']['message'] ) ) {
						$desc = sanitize_text_field( $bogo_deals['notice_settings']['message'] );
					}
				}
				if ( empty( $formatted_discount ) ) {
					$formatted_discount = 'BUNDLE OFFER';
				}
			} else {
				$formatted_discount = $amount > 0 ? ( $amount . '% OFF' ) : 'PRIVILEGE OFFER';
			}

			if ( empty( $desc ) && ! empty( $label ) ) {
				$desc = $label;
			}

			$min_spend = (float) $coupon->get_minimum_amount();
			$max_spend = (float) $coupon->get_maximum_amount();

			$coupons[] = [
				'id'                 => $id,
				'code'               => strtoupper( $code ),
				'label'              => $label ?: strtoupper( $code ),
				'description'        => $desc,
				'discount_type'      => $discount_type,
				'amount'             => $amount,
				'formatted_discount' => $formatted_discount,
				'expires_at'         => $expires_iso,
				'formatted_expires'  => $formatted_expires,
				'minimum_amount'          => $min_spend > 0 ? $min_spend : null,
				'maximum_amount'          => $max_spend > 0 ? $max_spend : null,
				'individual_use'          => (bool) $coupon->get_individual_use(),
				'free_shipping'           => (bool) $coupon->get_free_shipping(),
				'is_cashback'             => $is_cashback,
				'cashback_waiting_period' => (int) get_post_meta( $id, '_acfw_cashback_waiting_period', true ),
			];
		}

		return self::response( [
			'success' => true,
			'coupons' => $coupons,
			'total'   => count( $coupons ),
		] );
	}

	private static function user_owns_order( WP_User $user, WC_Order $order ): bool {
		return (int) $order->get_user_id() === (int) $user->ID
			|| ( $order->get_billing_email() && 0 === strcasecmp( trim( $order->get_billing_email() ), trim( $user->user_email ) ) );
	}

	public static function rest_link_ticket( WP_REST_Request $request ) {
		$user = self::authenticated_user( $request );
		if ( ! $user instanceof WP_User ) {
			return self::error( 'Your session has expired.', 401 );
		}

		$provider = sanitize_key( (string) $request->get_param( 'provider' ) );
		if ( 'google' !== $provider ) {
			return self::error( 'This social provider is not supported.', 400 );
		}

		$ticket = self::random_token( 32 );
		set_transient( 'artmatter_auth_link_ticket_' . hash( 'sha256', $ticket ), [
			'user_id'  => $user->ID,
			'provider' => $provider,
		], self::CODE_TTL );

		return self::response( [
			'success' => true,
			'url'     => add_query_arg( 'artmatter_auth_link', $ticket, home_url( '/' ) ),
		] );
	}

	public static function handle_social_start(): void {
		if ( ! empty( $_GET['exacoat_auth_link_callback'] ) || ! empty( $_GET['artmatter_auth_link_callback'] ) ) {
			self::finish_social_link();
		}
		if ( ! empty( $_GET['exacoat_auth_link'] ) || ! empty( $_GET['artmatter_auth_link'] ) ) {
			self::start_social_link();
		}
		if ( empty( $_GET['exacoat_auth_social'] ) && empty( $_GET['artmatter_auth_social'] ) ) {
			return;
		}

		$provider_id = sanitize_key( wp_unslash( $_GET['exacoat_auth_social'] ?? $_GET['artmatter_auth_social'] ) );
		$return_url  = esc_url_raw( wp_unslash( $_GET['return_url'] ?? '' ) );
		if ( 'google' !== $provider_id || ! self::is_allowed_callback( $return_url ) ) {
			self::social_failure( $return_url );
		}

		$launch = function() use ( $provider_id, $return_url ) {
			if ( ! class_exists( 'NextendSocialLogin' ) || empty( NextendSocialLogin::$enabledProviders[ $provider_id ] ) ) {
				self::social_failure( $return_url );
			}

			$state = self::random_token( 32 );
			set_transient( 'exacoat_auth_state_' . hash( 'sha256', $state ), [ 'return_url' => $return_url ], self::STATE_TTL );
			set_transient( 'artmatter_auth_state_' . hash( 'sha256', $state ), [ 'return_url' => $return_url ], self::STATE_TTL );
			setcookie( 'exacoat_auth_state', $state, [
				'expires'  => time() + self::STATE_TTL,
				'path'     => '/',
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			] );
			setcookie( 'artmatter_auth_state', $state, [
				'expires'  => time() + self::STATE_TTL,
				'path'     => '/',
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			] );

			$callback  = add_query_arg( [ 'exacoat_auth_callback' => '1', 'artmatter_auth_callback' => '1', 'state' => $state ], home_url( '/' ) );
			$login_url = NextendSocialLogin::$enabledProviders[ $provider_id ]->getLoginUrl();
			wp_redirect( add_query_arg( 'redirect', rawurlencode( $callback ), $login_url ) );
			exit;
		};

		if ( did_action( 'nsl_providers_loaded' ) ) {
			$launch();
		}
		add_action( 'nsl_providers_loaded', $launch, 100 );
	}

	public static function determine_link_flow_user( $user_id ) {
		if ( $user_id ) {
			return $user_id;
		}
		$is_google_request = isset( $_GET['loginSocial'] ) && 'google' === sanitize_key( wp_unslash( $_GET['loginSocial'] ) );
		if ( ! $is_google_request && empty( $_GET['artmatter_auth_link_callback'] ) ) {
			return $user_id;
		}
		$flow = self::link_flow();
		return $flow ? (int) $flow['user_id'] : $user_id;
	}

	private static function start_social_link(): void {
		$ticket = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_GET['artmatter_auth_link'] ) );
		$key    = 'artmatter_auth_link_ticket_' . hash( 'sha256', $ticket );
		$data   = get_transient( $key );
		delete_transient( $key );
		if ( ! is_array( $data ) || empty( $data['user_id'] ) || 'google' !== ( $data['provider'] ?? '' ) ) {
			wp_redirect( trailingslashit( self::web_origin() ) . 'account?google=error', 303 );
			exit;
		}

		$launch = function() use ( $data ) {
			if ( ! class_exists( 'NextendSocialLogin' ) || empty( NextendSocialLogin::$enabledProviders['google'] ) ) {
				wp_redirect( trailingslashit( self::web_origin() ) . 'account?google=error', 303 );
				exit;
			}
			$flow = self::random_token( 32 );
			set_transient( 'artmatter_auth_link_flow_' . hash( 'sha256', $flow ), $data, self::STATE_TTL );
			self::set_link_cookie( $flow, time() + self::STATE_TTL );
			$callback = add_query_arg( 'artmatter_auth_link_callback', '1', home_url( '/' ) );
			$url = add_query_arg( [ 'action' => 'link', 'redirect' => rawurlencode( $callback ) ], NextendSocialLogin::$enabledProviders['google']->getLoginUrl() );
			wp_redirect( $url );
			exit;
		};

		if ( did_action( 'nsl_providers_loaded' ) ) {
			$launch();
		}
		add_action( 'nsl_providers_loaded', $launch, 100 );
	}

	private static function finish_social_link(): void {
		$flow = self::link_flow();
		if ( ! $flow ) {
			wp_redirect( trailingslashit( self::web_origin() ) . 'account?google=error', 303 );
			exit;
		}

		$finish = function() use ( $flow ) {
			$linked = class_exists( 'NextendSocialLogin' )
				&& ! empty( NextendSocialLogin::$enabledProviders['google'] )
				&& false !== NextendSocialLogin::$enabledProviders['google']->isUserConnected( (int) $flow['user_id'] );
			self::clear_link_flow();
			wp_redirect( trailingslashit( self::web_origin() ) . 'account?google=' . ( $linked ? 'linked' : 'error' ), 303 );
			exit;
		};
		if ( did_action( 'nsl_providers_loaded' ) ) {
			$finish();
		}
		add_action( 'nsl_providers_loaded', $finish, 100 );
	}

	private static function link_flow() {
		$token = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_COOKIE['artmatter_auth_link_flow'] ?? '' ) );
		if ( ! $token ) {
			return null;
		}
		$data = get_transient( 'artmatter_auth_link_flow_' . hash( 'sha256', $token ) );
		return is_array( $data ) && ! empty( $data['user_id'] ) ? $data : null;
	}

	private static function clear_link_flow(): void {
		$token = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_COOKIE['artmatter_auth_link_flow'] ?? '' ) );
		if ( $token ) {
			delete_transient( 'artmatter_auth_link_flow_' . hash( 'sha256', $token ) );
		}
		self::set_link_cookie( '', time() - HOUR_IN_SECONDS );
	}

	private static function set_link_cookie( string $value, int $expires ): void {
		setcookie( 'artmatter_auth_link_flow', $value, [
			'expires'  => $expires,
			'path'     => '/',
			'secure'   => is_ssl(),
			'httponly' => true,
			'samesite' => 'Lax',
		] );
	}

	public static function handle_social_callback(): void {
		if ( empty( $_GET['exacoat_auth_callback'] ) && empty( $_GET['artmatter_auth_callback'] ) ) {
			return;
		}

		$state        = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_GET['state'] ?? '' ) );
		$cookie_state = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_COOKIE['exacoat_auth_state'] ?? ( $_COOKIE['artmatter_auth_state'] ?? '' ) ) );

		if ( ! $state && ! empty( $cookie_state ) ) {
			$state = $cookie_state;
		}

		$data = get_transient( 'exacoat_auth_state_' . hash( 'sha256', $state ) );
		if ( ! $data ) {
			$data = get_transient( 'artmatter_auth_state_' . hash( 'sha256', $state ) );
		}
		delete_transient( 'exacoat_auth_state_' . hash( 'sha256', $state ) );
		delete_transient( 'artmatter_auth_state_' . hash( 'sha256', $state ) );

		setcookie( 'exacoat_auth_state', '', [ 'expires' => time() - HOUR_IN_SECONDS, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax' ] );
		setcookie( 'artmatter_auth_state', '', [ 'expires' => time() - HOUR_IN_SECONDS, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax' ] );

		if ( ! $state || ( $cookie_state && ! hash_equals( $state, $cookie_state ) ) || ! is_array( $data ) || ! is_user_logged_in() ) {
			self::social_failure( is_array( $data ) ? ( $data['return_url'] ?? '' ) : '' );
		}

		$code = self::random_token( 32 );
		set_transient( 'exacoat_auth_code_' . hash( 'sha256', $code ), [ 'user_id' => get_current_user_id() ], self::CODE_TTL );
		set_transient( 'artmatter_auth_code_' . hash( 'sha256', $code ), [ 'user_id' => get_current_user_id() ], self::CODE_TTL );
		wp_redirect( add_query_arg( 'code', $code, $data['return_url'] ), 303 );
		exit;
	}

	public static function filter_nsl_redirect( $redirect_to, $requested_redirect_to ) {
		if ( ! empty( $requested_redirect_to ) && ( false !== strpos( $requested_redirect_to, 'exacoat_auth_callback' ) || false !== strpos( $requested_redirect_to, 'artmatter_auth_callback' ) ) ) {
			return $requested_redirect_to;
		}
		$cookie_state = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_COOKIE['exacoat_auth_state'] ?? ( $_COOKIE['artmatter_auth_state'] ?? '' ) ) );
		if ( ! empty( $cookie_state ) && ( false !== strpos( $redirect_to, 'exacoat_auth_callback' ) || false !== strpos( $redirect_to, 'artmatter_auth_callback' ) ) && false === strpos( $redirect_to, 'state=' ) ) {
			return add_query_arg( 'state', $cookie_state, $redirect_to );
		}
		return $redirect_to;
	}

	public static function filter_nsl_fixed_redirect( $fixed_redirect, $provider ) {
		$cookie_state = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_COOKIE['exacoat_auth_state'] ?? ( $_COOKIE['artmatter_auth_state'] ?? '' ) ) );
		$link_flow    = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) wp_unslash( $_COOKIE['exacoat_auth_link_flow'] ?? ( $_COOKIE['artmatter_auth_link_flow'] ?? '' ) ) );
		if ( ! empty( $cookie_state ) || ! empty( $link_flow ) ) {
			return '';
		}
		return $fixed_redirect;
	}

	public static function use_storefront_reset_url( $message, $key, $user_login, $user_data ) {
		$wordpress_url = network_site_url( 'wp-login.php?action=rp&key=' . $key . '&login=' . rawurlencode( $user_login ), 'login' );
		$storefront_url = add_query_arg( [
			'mode'  => 'reset',
			'key'   => $key,
			'login' => $user_login,
		], trailingslashit( self::web_origin() ) . 'login' );
		return str_replace( $wordpress_url, $storefront_url, $message );
	}

	private static function authenticated_response( WP_User $user, int $status = 200, string $message = '' ): WP_REST_Response {
		$expiration = time() + self::SESSION_TTL;
		$token      = WP_Session_Tokens::get_instance( $user->ID )->create( $expiration );
		$payload = [
			'success'   => true,
			'token'     => $user->ID . '.' . $token,
			'expiresAt' => $expiration,
			'user'      => self::user_payload( $user ),
		];
		if ( $message ) {
			$payload['message'] = $message;
		}
		return self::response( $payload, $status );
	}

	public static function determine_current_user( $user_id ) {
		if ( ! empty( $user_id ) ) {
			return $user_id;
		}

		$token = '';
		if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) && preg_match( '/^Bearer\s+(.+)$/i', (string) $_SERVER['HTTP_AUTHORIZATION'], $matches ) ) {
			$token = trim( $matches[1] );
		}
		if ( ! $token && ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) && preg_match( '/^Bearer\s+(.+)$/i', (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'], $matches ) ) {
			$token = trim( $matches[1] );
		}
		if ( ! $token && ! empty( $_COOKIE['exacoat_customer_session'] ) ) {
			$token = trim( (string) $_COOKIE['exacoat_customer_session'] );
		}
		if ( ! $token && ! empty( $_COOKIE['artmatter_customer_session'] ) ) {
			$token = trim( (string) $_COOKIE['artmatter_customer_session'] );
		}
		if ( ! $token || ! preg_match( '/^(\d+)\.([A-Za-z0-9_-]+)$/', $token, $matches ) ) {
			return $user_id;
		}
		if ( ! WP_Session_Tokens::get_instance( (int) $matches[1] )->verify( $matches[2] ) ) {
			return $user_id;
		}

		return (int) $matches[1];
	}

	private static function authenticated_user( WP_REST_Request $request ) {
		$token = self::bearer_token( $request );
		if ( ! $token || ! preg_match( '/^(\d+)\.([A-Za-z0-9_-]+)$/', $token, $matches ) ) {
			return null;
		}
		if ( ! WP_Session_Tokens::get_instance( (int) $matches[1] )->verify( $matches[2] ) ) {
			return null;
		}
		return get_user_by( 'id', (int) $matches[1] );
	}

	private static function bearer_token( WP_REST_Request $request ): string {
		$header = (string) $request->get_header( 'authorization' );
		return preg_match( '/^Bearer\s+(.+)$/i', $header, $matches ) ? trim( $matches[1] ) : '';
	}

	private static function user_payload( WP_User $user ): array {
		$linked_providers = [];
		if ( class_exists( 'NextendSocialLogin' ) && did_action( 'nsl_providers_loaded' ) && ! empty( NextendSocialLogin::$enabledProviders['google'] ) ) {
			if ( false !== NextendSocialLogin::$enabledProviders['google']->isUserConnected( $user->ID ) ) {
				$linked_providers[] = 'google';
			}
		}

		$billing = [
			'first_name' => get_user_meta( $user->ID, 'billing_first_name', true ) ?: $user->first_name,
			'last_name'  => get_user_meta( $user->ID, 'billing_last_name', true ) ?: $user->last_name,
			'company'    => get_user_meta( $user->ID, 'billing_company', true ) ?: '',
			'address_1'  => get_user_meta( $user->ID, 'billing_address_1', true ) ?: '',
			'address_2'  => get_user_meta( $user->ID, 'billing_address_2', true ) ?: '',
			'city'       => get_user_meta( $user->ID, 'billing_city', true ) ?: '',
			'state'      => get_user_meta( $user->ID, 'billing_state', true ) ?: '',
			'postcode'   => get_user_meta( $user->ID, 'billing_postcode', true ) ?: '',
			'country'    => get_user_meta( $user->ID, 'billing_country', true ) ?: 'ID',
			'phone'      => get_user_meta( $user->ID, 'billing_phone', true ) ?: '',
			'email'      => get_user_meta( $user->ID, 'billing_email', true ) ?: $user->user_email,
		];

		$roles = (array) $user->roles;
		$role  = in_array( 'administrator', $roles, true ) ? 'super_admin' : ( in_array( 'shop_manager', $roles, true ) ? 'shop_manager' : 'customer' );

		return [
			'id'              => $user->ID,
			'email'           => $user->user_email,
			'displayName'     => $user->display_name ?: $user->user_login,
			'firstName'       => $user->first_name,
			'lastName'        => $user->last_name,
			'roles'           => $roles,
			'role'            => $role,
			'createdAt'       => $user->user_registered,
			'linkedProviders' => $linked_providers,
			'billingAddress'  => $billing,
		];
	}

	private static function unique_username( string $email ): string {
		$base = sanitize_user( strtok( $email, '@' ), true ) ?: 'collector';
		$name = $base;
		$index = 2;
		while ( username_exists( $name ) ) {
			$name = $base . $index++;
		}
		return $name;
	}

	private static function is_rate_limited( string $action, int $limit, int $window ): bool {
		$ip  = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? 'unknown' ) );
		$key = 'artmatter_auth_rate_' . md5( $action . '|' . $ip );
		$data = get_transient( $key );
		$count = is_array( $data ) ? (int) $data['count'] : 0;
		set_transient( $key, [ 'count' => $count + 1 ], $window );
		return $count >= $limit;
	}

	private static function web_origin(): string {
		$url = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : ( getenv( 'EXACOAT_WEB_URL' ) ?: ( defined( 'ARTMATTER_WEB_URL' ) ? ARTMATTER_WEB_URL : 'https://exacoat.com' ) );
		return untrailingslashit( esc_url_raw( $url ?: home_url( '/' ) ) );
	}

	private static function is_allowed_callback( string $url ): bool {
		$callback = wp_parse_url( $url );
		$allowed  = wp_parse_url( self::web_origin() );
		if ( ! $callback || ! $allowed ) {
			return false;
		}
		$allowed_hosts = array_filter( [ $allowed['host'] ?? '', 'exacoat.com', 'web.exacoat.com', 'manager.exacoat.com' ] );
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$allowed_hosts[] = 'localhost';
			$allowed_hosts[] = '127.0.0.1';
		}
		if ( ! in_array( $callback['host'] ?? '', $allowed_hosts, true ) ) {
			return false;
		}
		return '/api/auth/callback' === ( $callback['path'] ?? '' );
	}

	private static function social_failure( string $return_url ): void {
		$target = self::is_allowed_callback( $return_url ) ? $return_url : trailingslashit( self::web_origin() ) . 'login';
		wp_redirect( add_query_arg( 'error', 'social', $target ), 303 );
		exit;
	}

	private static function random_token( int $bytes ): string {
		return rtrim( strtr( base64_encode( random_bytes( $bytes ) ), '+/', '-_' ), '=' );
	}

	private static function response( array $data, int $status = 200 ): WP_REST_Response {
		$response = new WP_REST_Response( $data, $status );
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}

	private static function resolve_order_item_image_url( $product, int $product_id, $item = null ): string {
		$image = '';

		// 0. Primary: check configured composite skin image or thumbnail URL on order line item
		if ( $item instanceof WC_Order_Item_Product ) {
			$custom_img = (string) (
				$item->get_meta( '_configured_image_url' )
				?: $item->get_meta( '_configurator_image' )
				?: $item->get_meta( '_thumbnail_url' )
				?: $item->get_meta( '_product_image_url' )
				?: $item->get_meta( '_skin_image_url' )
				?: $item->get_meta( 'image_url' )
				?: $item->get_meta( 'mkl_pc_thumbnail_url' )
			);
			if ( ! empty( $custom_img ) ) {
				if ( function_exists( 'artmatter_media_url' ) ) {
					$custom_img = artmatter_media_url( $custom_img );
				}
				return esc_url_raw( $custom_img );
			}
		}

		// 1. Try master product attachment with preview derivative
		$master_id = $product_id > 0 ? (int) get_post_meta( $product_id, '_artmatter_master_attachment_id', true ) : 0;
		if ( $master_id > 0 ) {
			$image = wp_get_attachment_image_url( $master_id, 'artmatter_preview' )
				?: wp_get_attachment_image_url( $master_id, 'woocommerce_thumbnail' )
				?: wp_get_attachment_image_url( $master_id, 'medium' )
				?: wp_get_attachment_image_url( $master_id, 'full' )
				?: '';
		}

		// 2. Try product featured thumbnail with 'artmatter_preview'
		if ( ! $image ) {
			$thumb_id = $product instanceof WC_Product ? (int) $product->get_image_id() : ( $product_id > 0 ? (int) get_post_thumbnail_id( $product_id ) : 0 );
			if ( $thumb_id > 0 ) {
				$image = wp_get_attachment_image_url( $thumb_id, 'artmatter_preview' )
					?: wp_get_attachment_image_url( $thumb_id, 'woocommerce_thumbnail' )
					?: wp_get_attachment_image_url( $thumb_id, 'medium' )
					?: wp_get_attachment_image_url( $thumb_id, 'full' )
					?: '';
			}
		}

		// 3. Try tactile still macro/preview attachment or URL
		if ( ! $image && $product_id > 0 ) {
			$still_id = (int) get_post_meta( $product_id, '_artmatter_tactile_still_attach_id', true );
			if ( $still_id > 0 ) {
				$image = wp_get_attachment_image_url( $still_id, 'artmatter_preview' )
					?: wp_get_attachment_image_url( $still_id, 'medium' )
					?: wp_get_attachment_image_url( $still_id, 'full' )
					?: '';
			}
			if ( ! $image ) {
				$image = (string) get_post_meta( $product_id, '_artmatter_tactile_still_url', true );
			}
		}

		// 4. Fallback to tactile flat preview or flat URL only if nothing else is available
		if ( ! $image && $product_id > 0 ) {
			$image = (string) ( get_post_meta( $product_id, '_artmatter_tactile_flat_preview_url', true )
				?: get_post_meta( $product_id, '_artmatter_tactile_flat_url', true ) );
		}

		if ( $image && function_exists( 'artmatter_media_url' ) ) {
			$image = artmatter_media_url( $image );
		}

		return esc_url_raw( $image );
	}

	private static function extract_order_item_layers( $item ): array {
		if ( ! $item instanceof WC_Order_Item_Product ) {
			return [];
		}

		$layers = [];

		$config_meta = $item->get_meta( '_configurator_data_raw' ) ?: $item->get_meta( '_configurator_data' ) ?: $item->get_meta( '_pc_configurator_data' );
		if ( is_string( $config_meta ) ) {
			$decoded = json_decode( $config_meta, true );
			if ( is_array( $decoded ) ) {
				$config_meta = $decoded;
			}
		}

		if ( is_array( $config_meta ) ) {
			foreach ( $config_meta as $idx => $l ) {
				$layer_name = trim( (string) ( $l['layer_name'] ?? $l['layerName'] ?? $l['layer_title'] ?? $l['label'] ?? '' ) );
				$choice_name = trim( (string) ( $l['name'] ?? $l['choiceName'] ?? $l['choice_name'] ?? $l['choice'] ?? $l['value'] ?? '' ) );
				if ( ! empty( $layer_name ) || ! empty( $choice_name ) ) {
					$layers[] = [
						'layerId'    => (string) ( $l['layer_id'] ?? $l['layerId'] ?? ( $idx + 1 ) ),
						'layerName'  => $layer_name,
						'choiceName' => $choice_name,
					];
				}
			}
		}

		// Fallback: extract from formatted item meta data
		if ( empty( $layers ) ) {
			$meta_data = $item->get_formatted_meta_data( '' );
			foreach ( $meta_data as $m ) {
				$key = trim( wp_strip_all_tags( (string) $m->display_key ) );
				$val = trim( wp_strip_all_tags( (string) $m->display_value ) );
				if ( empty( $key ) || empty( $val ) ) {
					continue;
				}
				if ( str_starts_with( $key, '_' ) || in_array( strtolower( $key ), [ 'sku', 'product id', 'items' ], true ) ) {
					continue;
				}
				$layers[] = [
					'layerId'    => (string) $m->id,
					'layerName'  => $key,
					'choiceName' => $val,
				];
			}
		}

		return $layers;
	}

	private static function resolve_order_shipping_method( WC_Order $order ): string {
		$active_shipping = '';
		$shipping_lines = $order->get_shipping_methods();
		if ( ! empty( $shipping_lines ) ) {
			// 1. Prioritize courier line with positive shipping cost
			foreach ( $shipping_lines as $shipping_item ) {
				if ( (float) $shipping_item->get_total() > 0 ) {
					$active_shipping = $shipping_item->get_name();
					break;
				}
			}
			// 2. If no paid line, pick non-pickup courier line
			if ( empty( $active_shipping ) ) {
				foreach ( $shipping_lines as $shipping_item ) {
					if ( $shipping_item->get_method_id() !== 'local_pickup' && ! empty( $shipping_item->get_name() ) ) {
						$active_shipping = $shipping_item->get_name();
						break;
					}
				}
			}
			// 3. Fallback to last line or first line
			if ( empty( $active_shipping ) ) {
				$last_line = end( $shipping_lines );
				$active_shipping = $last_line ? $last_line->get_name() : '';
			}
		}
		if ( empty( $active_shipping ) ) {
			$active_shipping = (string) $order->get_shipping_method();
		}
		return $active_shipping;
	}

	private static function error( string $message, int $status ): WP_REST_Response {
		return self::response( [ 'success' => false, 'message' => $message ], $status );
	}
}

}

if ( ! class_exists( 'Artmatter_Customer_Auth' ) ) {
	class_alias( 'Exacoat_Customer_Auth', 'Artmatter_Customer_Auth' );
}
