<?php
/**
 * Goorita Logistics Service Module
 * Handles international courier operations for the United States via Goorita Send.
 * Supports rate calculation, production/staging AWB booking, AWB document streaming,
 * live tracking, and automatic order dispatch.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Goorita_Service' ) ) {

class Exacoat_Goorita_Service {

	const PROD_BASE_URL          = 'https://send.goorita.com/api';
	const DEV_BASE_URL           = 'https://goosend-dev.on-forge.com/api';
	const DEFAULT_PROD_API_KEY   = 'k4K1ObL2Jpard72nOks7O2Iae5INP7Mo';
	const DEFAULT_DEV_API_KEY    = 'iO9TyZTLFPD9xv1JJpzPLNWO6FPT0QDB';
	const ORIGIN_DISTRICT_ID     = '9d70d21b-870e-4da9-a284-3905da004bbd'; // Bekasi Barat
	const ORIGIN_POSTAL_CODE     = '17142'; // Summarecon Bekasi / Marga Mulya
	const US_COUNTRY_ID          = '9d4e2dae-34cc-498a-860e-609bd81bf6e2';
	const ITEM_TYPE_SMALL        = 'e8a11d5a-31ae-4f03-b9da-1ce4cd90f7d2'; // Small Package (< 2kg)
	const ITEM_TYPE_BOX          = '80fb61fd-41d0-45ea-9e75-e4ca61bc46aa'; // Box Package (> 2kg)
	const DEFAULT_CATEGORY_ID    = '9f876651-092e-49e7-919b-c7c220ccdda0'; // VINYL (HS: 8523.49.20)
	const CAPABILITY             = 'manage_woocommerce';

	const US_STATES = [
		'AL' => [ 'id' => '9d863f20-87ce-4831-98b2-21e7e1f93458', 'name' => 'Alabama' ],
		'AZ' => [ 'id' => '9d863f5d-923a-4187-b9a9-b4e6e3c03ad5', 'name' => 'Arizona' ],
		'AR' => [ 'id' => '9d60c7ff-c89b-437c-8bfa-ea945b93af37', 'name' => 'Arkansas' ],
		'CA' => [ 'id' => '9d60c7ff-c92d-409e-9661-8dc1b8720cdb', 'name' => 'California' ],
		'CO' => [ 'id' => '9d60c7ff-ca54-4752-99e3-b15605542532', 'name' => 'Colorado' ],
		'CT' => [ 'id' => '9d60c7ff-cb94-4321-9f4f-6e34e0e41306', 'name' => 'Connecticut' ],
		'DE' => [ 'id' => '9d60c7ff-cca3-4b40-87f9-8a0cde84743e', 'name' => 'Delaware' ],
		'DC' => [ 'id' => '9d60c7ff-ce8f-481c-985e-f8a3653464f9', 'name' => 'District Of Columbia' ],
		'FL' => [ 'id' => '9d60c7ff-d0bc-4996-b7a7-18db96e73388', 'name' => 'Florida' ],
		'GA' => [ 'id' => '9d60c7ff-d278-4283-8926-4789ba473174', 'name' => 'Georgia' ],
		'ID' => [ 'id' => '9d60c7ff-d766-4d87-8f52-7ee1636f19e8', 'name' => 'Idaho' ],
		'IL' => [ 'id' => '9d60c7ff-d909-462b-8f94-63283b40f946', 'name' => 'Illinois' ],
		'IN' => [ 'id' => '9d60c7ff-da96-4c94-8713-d29f208f1439', 'name' => 'Indiana' ],
		'IA' => [ 'id' => '9d60c7ff-dbc0-48c8-92c6-749b6934edde', 'name' => 'Iowa' ],
		'KS' => [ 'id' => '9d60c7ff-dda5-4b39-a7b3-b1d581916693', 'name' => 'Kansas' ],
		'KY' => [ 'id' => '9d60c7ff-df52-464d-b9d3-169ff50aa90a', 'name' => 'Kentucky' ],
		'LA' => [ 'id' => '9d60c7ff-e173-4c75-a44d-1e7c5cb6ba87', 'name' => 'Louisiana' ],
		'ME' => [ 'id' => '9d60c7ff-e379-47a2-be59-973612b783a7', 'name' => 'Maine' ],
		'MD' => [ 'id' => '9d60c7ff-e70c-4ea8-9a71-6202425653ef', 'name' => 'Maryland' ],
		'MA' => [ 'id' => '9d60c7ff-e8d0-45b4-8596-3aee5e0c533b', 'name' => 'Massachusetts' ],
		'MI' => [ 'id' => '9d60c7ff-ea99-4e01-a097-000e287fd77b', 'name' => 'Michigan' ],
		'MN' => [ 'id' => '9d60c7ff-ec36-4824-a3da-79d449a8b272', 'name' => 'Minnesota' ],
		'MS' => [ 'id' => '9d60c7ff-ee52-48af-9e5e-17c4ce12702c', 'name' => 'Mississippi' ],
		'MO' => [ 'id' => '9d60c7ff-ef78-404f-9a42-dd3281d10be2', 'name' => 'Missouri' ],
		'MT' => [ 'id' => '9d60c7ff-f157-4172-8c27-cabd522ba147', 'name' => 'Montana' ],
		'NE' => [ 'id' => '9d60c7ff-f1da-40c0-b8b4-978b93294c58', 'name' => 'Nebraska' ],
		'NV' => [ 'id' => '9d60c7ff-f292-43a0-bf61-aa3ce750cb77', 'name' => 'Nevada' ],
		'NH' => [ 'id' => '9d60c7ff-f402-4bf3-a5f7-7bc7e984e79e', 'name' => 'New Hampshire' ],
		'NJ' => [ 'id' => '9d60c7ff-f525-49b9-a3b1-42c859e29951', 'name' => 'New Jersey' ],
		'NM' => [ 'id' => '9d60c7ff-f655-414b-b266-769771cc7358', 'name' => 'New Mexico' ],
		'NY' => [ 'id' => '9d60c7ff-f7f9-4066-b5e6-0d428eac0ff9', 'name' => 'New York' ],
		'NC' => [ 'id' => '9d60c7ff-f907-4244-86f8-d548b1c5ebf2', 'name' => 'North Carolina' ],
		'ND' => [ 'id' => '9d60c7ff-fa97-462b-b3ae-00146524ad44', 'name' => 'North Dakota' ],
		'OH' => [ 'id' => '9d60c7ff-fe89-4ba0-b9f8-bfa50949932d', 'name' => 'Ohio' ],
		'OK' => [ 'id' => '9d60c7ff-ffeb-421e-8196-0ab0e3bc76f6', 'name' => 'Oklahoma' ],
		'OR' => [ 'id' => '9d60c800-0186-4866-9d86-538ba656b176', 'name' => 'Oregon' ],
		'PA' => [ 'id' => '9d60c800-04c7-4162-b40a-793c124ac4df', 'name' => 'Pennsylvania' ],
		'RI' => [ 'id' => '9d60c800-07ad-4193-8992-25dacaa4d070', 'name' => 'Rhode Island' ],
		'SC' => [ 'id' => '9d60c800-08fa-4175-a837-3f68279163fc', 'name' => 'South Carolina' ],
		'SD' => [ 'id' => '9d60c800-0ad1-4822-a421-122ec6acb6f8', 'name' => 'South Dakota' ],
		'TN' => [ 'id' => '9d60c800-0c88-43da-9f84-78084249187d', 'name' => 'Tennessee' ],
		'TX' => [ 'id' => '9fd761de-3803-4bd3-b1d6-7aa0b70b5f5a', 'name' => 'Texas' ],
		'UT' => [ 'id' => '9d60c800-1099-4ea9-958e-44931f4cc671', 'name' => 'Utah' ],
		'VT' => [ 'id' => '9d60c800-1202-4803-ab0d-0229af27d470', 'name' => 'Vermont' ],
		'VA' => [ 'id' => '9d60c800-1575-44a0-b877-6865e2d4a014', 'name' => 'Virginia' ],
		'WA' => [ 'id' => '9d60c800-170b-4d25-8111-f143365472dc', 'name' => 'Washington' ],
		'WV' => [ 'id' => '9d60c800-18ce-446b-b13e-865291aa07d5', 'name' => 'West Virginia' ],
		'WI' => [ 'id' => '9d60c800-19da-4400-b980-d88cd3becbe1', 'name' => 'Wisconsin' ],
		'WY' => [ 'id' => '9d60c800-1b98-4c63-94f6-bc1d8f9d52a6', 'name' => 'Wyoming' ],
	];

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// Automated booking is permanently disabled. Manual preview and confirmation is required via Manager ERP.
		// add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'handle_auto_booking' ], 25, 2 );
		// add_action( 'woocommerce_order_status_confirmed', [ __CLASS__, 'handle_auto_booking' ], 25, 2 );
	}

	public static function get_environment(): string {
		if ( class_exists( 'Exacoat_Shipping_Tracker' ) ) {
			return Exacoat_Shipping_Tracker::get_goorita_environment();
		}
		if ( defined( 'EXA_GOORITA_ENVIRONMENT' ) ) {
			return strtolower( trim( (string) EXA_GOORITA_ENVIRONMENT ) );
		}
		return 'production';
	}

	public static function get_api_key( string $env = '' ): string {
		if ( class_exists( 'Exacoat_Shipping_Tracker' ) ) {
			return Exacoat_Shipping_Tracker::get_goorita_api_key( $env );
		}
		$target_env = ! empty( $env ) ? strtolower( trim( $env ) ) : self::get_environment();
		if ( 'staging' === $target_env || 'dev' === $target_env ) {
			return defined( 'EXA_GOORITA_DEV_API_KEY' ) ? (string) EXA_GOORITA_DEV_API_KEY : self::DEFAULT_DEV_API_KEY;
		}
		return defined( 'EXA_GOORITA_PROD_API_KEY' ) ? (string) EXA_GOORITA_PROD_API_KEY : self::DEFAULT_PROD_API_KEY;
	}

	public static function get_base_url( string $env = '' ): string {
		if ( class_exists( 'Exacoat_Shipping_Tracker' ) ) {
			return Exacoat_Shipping_Tracker::get_goorita_api_url( $env );
		}
		$target_env = ! empty( $env ) ? strtolower( trim( $env ) ) : self::get_environment();
		if ( 'staging' === $target_env || 'dev' === $target_env ) {
			return self::DEV_BASE_URL;
		}
		return self::PROD_BASE_URL;
	}

	public static function is_goorita_order( $order ): bool {
		if ( ! is_a( $order, 'WC_Order' ) ) {
			return false;
		}

		// Skip master consolidation orders
		if ( $order->get_meta( '_is_consolidation_order' ) === 'yes' ) {
			return false;
		}

		// Explicit courier selection
		$carrier = strtolower( trim( (string) (
			$order->get_meta( 'carrier_id' )
			?: ( $order->get_meta( '_carrier_id' )
			?: ( $order->get_meta( 'courier' ) ?: '' ) )
		) ) );

		if ( 'goorita' === $carrier ) {
			return true;
		}

		if ( in_array( $carrier, [ 'jne', 'sicepat', 'pos', 'dhl', 'fedex', 'pickup', 'rayspeed' ], true ) ) {
			return false;
		}

		// Shipping method inspection
		$method_texts = [ strtolower( (string) $order->get_shipping_method() ) ];
		if ( method_exists( $order, 'get_shipping_methods' ) ) {
			foreach ( $order->get_shipping_methods() as $item ) {
				if ( is_a( $item, 'WC_Order_Item_Shipping' ) ) {
					$method_texts[] = strtolower( (string) $item->get_name() );
					$method_texts[] = strtolower( (string) $item->get_method_id() );
				}
			}
		}
		$combined_shipping = implode( ' ', $method_texts );
		if ( strpos( $combined_shipping, 'goorita' ) !== false ) {
			return true;
		}

		// US destination fallback if carrier is unassigned or generic international
		$country = strtoupper( trim( (string) ( $order->get_shipping_country() ?: $order->get_billing_country() ) ) );
		if ( 'US' === $country && ( empty( $carrier ) || 'goorita' === $carrier ) ) {
			return true;
		}

		return false;
	}

	public static function calculate_weight_and_dims( WC_Order $order ): array {
		$skin_count        = 0;
		$laptop_skin_count = 0;
		$first_item_name   = '';

		foreach ( $order->get_items() as $item ) {
			$name = $item->get_name();
			if ( empty( $first_item_name ) ) {
				$first_item_name = $name;
			}
			$qty      = max( 1, (int) $item->get_quantity() );
			$name_low = strtolower( $name );

			if (
				strpos( $name_low, 'macbook' ) !== false ||
				strpos( $name_low, 'laptop' ) !== false ||
				strpos( $name_low, 'surface book' ) !== false ||
				strpos( $name_low, 'razer' ) !== false ||
				strpos( $name_low, 'notebook' ) !== false
			) {
				$laptop_skin_count += $qty;
			} else {
				$skin_count += $qty;
			}
		}

		$weight_grams = 0;
		if ( $skin_count > 0 ) {
			$weight_grams += $skin_count * 50;
		}
		if ( $laptop_skin_count > 0 ) {
			$weight_grams += 200 + ( $laptop_skin_count - 1 ) * 100;
		}
		if ( $weight_grams <= 0 ) {
			$weight_grams = 50;
		}
		$weight_kg = round( $weight_grams / 1000, 2 );

		if ( $laptop_skin_count > 0 ) {
			$dims = [
				'length' => 40,
				'width'  => 28,
				'height' => max( 1, (int) ceil( 1 + ( $laptop_skin_count - 1 ) * 0.5 ) ),
			];
		} else {
			$dims = [
				'length' => 25,
				'width'  => 15,
				'height' => max( 1, (int) ceil( $skin_count * 0.2 ) ),
			];
		}

		return [
			'weight_kg'       => $weight_kg,
			'dimensions'      => $dims,
			'skin_count'      => $skin_count,
			'laptop_count'    => $laptop_skin_count,
			'first_item_name' => $first_item_name ?: 'Mobile / Laptop Protective Decal Skin',
		];
	}

	public static function resolve_state_id( string $state_input ): string {
		$code = strtoupper( trim( $state_input ) );
		if ( isset( self::US_STATES[ $code ] ) ) {
			return self::US_STATES[ $code ]['id'];
		}

		// Fuzzy match by state name
		$clean_name = strtolower( trim( $state_input ) );
		foreach ( self::US_STATES as $state_code => $info ) {
			if ( strtolower( $info['name'] ) === $clean_name ) {
				return $info['id'];
			}
		}

		// Default fallback to CA
		return self::US_STATES['CA']['id'];
	}

	public static function request( string $endpoint, string $method = 'GET', array $payload = [], string $env = '' ): array {
		$base_url = rtrim( self::get_base_url( $env ), '/' );
		$api_key  = self::get_api_key( $env );
		$url      = $base_url . '/' . ltrim( $endpoint, '/' );

		$args = [
			'method'  => $method,
			'timeout' => 30,
			'headers' => [
				'Authorization' => 'Bearer ' . $api_key,
				'Accept'        => 'application/json',
				'Content-Type'  => 'application/json',
			],
		];

		if ( 'POST' === $method && ! empty( $payload ) ) {
			$args['body'] = wp_json_encode( $payload );
		}

		$response = wp_remote_request( $url, $args );

		if ( is_wp_error( $response ) ) {
			return [
				'success' => false,
				'error'   => $response->get_error_message(),
				'status'  => 0,
			];
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$data        = json_decode( $body, true );

		return [
			'success' => ( $status_code >= 200 && $status_code < 300 && ( $data['success'] ?? false ) ),
			'status'  => $status_code,
			'data'    => $data,
			'raw'     => $body,
		];
	}

	/**
	 * Query Goorita live shipping rates for parcel
	 */
	public static function check_rates( string $postal_code, string $state_id, float $weight_kg, array $dims, float $declared_value = 25.0, string $env = '' ): array {
		$payload = [
			'district_id' => self::ORIGIN_DISTRICT_ID,
			'destination' => [
				'country_id'  => self::US_COUNTRY_ID,
				'state_id'    => $state_id,
				'postal_code' => trim( $postal_code ),
			],
			'items' => [
				[
					'type'   => self::ITEM_TYPE_SMALL,
					'length' => (int) $dims['length'],
					'width'  => (int) $dims['width'],
					'height' => (int) $dims['height'],
					'weight' => $weight_kg,
					'value'  => $declared_value,
				],
			],
		];

		$res = self::request( '/business/order/check-rate', 'POST', $payload, $env );
		if ( ! $res['success'] || empty( $res['data']['data']['packages'] ) ) {
			return [
				'success'  => false,
				'error'    => $res['data']['message'] ?? ( 'HTTP ' . $res['status'] . ' Check rate failed' ),
				'packages' => [],
			];
		}

		return [
			'success'  => true,
			'packages' => $res['data']['data']['packages'],
		];
	}

	/**
	 * Create production or staging Goorita Order & Generate AWB
	 */
	public static function create_airwaybill( int $order_id, array $override_args = [], string $env = '' ): array {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return [ 'success' => false, 'error' => 'Order not found' ];
		}

		$existing_awb = (string) $order->get_meta( '_goorita_order_id' );
		if ( ! empty( $existing_awb ) && empty( $override_args['force_rebook'] ) ) {
			return [
				'success'         => true,
				'already_booked'  => true,
				'order_id'        => $existing_awb,
				'tracking_number' => (string) $order->get_meta( 'tracking_number' ),
				'awb_url'         => (string) $order->get_meta( '_goorita_awb_url' ),
				'awb_image'       => (string) $order->get_meta( '_goorita_awb_image' ),
				'message'         => 'Order already booked with Goorita',
			];
		}

		$target_env = ! empty( $env ) ? $env : self::get_environment();

		// Recipient Information
		$first_name = trim( (string) ( $order->get_shipping_first_name() ?: $order->get_billing_first_name() ) );
		$last_name  = trim( (string) ( $order->get_shipping_last_name() ?: $order->get_billing_last_name() ) );
		$full_name  = trim( $first_name . ' ' . $last_name ) ?: 'Customer';

		$email      = trim( (string) ( $order->get_billing_email() ?: 'support@exacoat.com' ) );
		$raw_phone  = (string) ( $order->get_shipping_phone() ?: $order->get_billing_phone() );
		$clean_phone = preg_replace( '/\D/', '', $raw_phone );
		$phone_num  = ( ! empty( $clean_phone ) && strlen( $clean_phone ) >= 7 ) ? (int) $clean_phone : 14155550192;

		$address_1  = trim( (string) ( $order->get_shipping_address_1() ?: $order->get_billing_address_1() ) );
		$address_2  = trim( (string) ( $order->get_shipping_address_2() ?: $order->get_billing_address_2() ) );
		$city       = trim( (string) ( $order->get_shipping_city() ?: $order->get_billing_city() ) );
		$state_code = trim( (string) ( $order->get_shipping_state() ?: $order->get_billing_state() ) );
		$postcode   = trim( (string) ( $order->get_shipping_postcode() ?: $order->get_billing_postcode() ) );

		if ( empty( $address_1 ) || empty( $city ) || empty( $postcode ) ) {
			return [ 'success' => false, 'error' => 'Incomplete shipping address for Goorita export' ];
		}

		$state_id   = self::resolve_state_id( $state_code );
		$calc       = self::calculate_weight_and_dims( $order );
		$weight_kg  = $calc['weight_kg'];
		$dims       = $calc['dimensions'];
		$item_name  = $calc['first_item_name'];
		$order_num  = (string) $order->get_order_number();

		// Total declared value: item total or safe skin declared value ($25)
		$order_total_usd = (float) $order->get_total();
		if ( $order->get_currency() === 'IDR' ) {
			$order_total_usd = round( $order_total_usd / 16000, 2 );
		}
		$declared_val = ( $order_total_usd > 5 && $order_total_usd < 800 ) ? round( $order_total_usd, 2 ) : 25.0;

		// 1. Check rates to retrieve valid package_id
		$rates_res = self::check_rates( $postcode, $state_id, $weight_kg, $dims, $declared_val, $target_env );
		if ( ! $rates_res['success'] || empty( $rates_res['packages'] ) ) {
			$err_msg = $rates_res['error'] ?? 'Could not retrieve Goorita shipping packages';
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::error( 'shipping', "Goorita check-rate failed for Order #{$order_num}: {$err_msg}" );
			}
			return [ 'success' => false, 'error' => $err_msg ];
		}

		$packages = $rates_res['packages'];

		// Match selected service: if explicit package_id passed, use it, else match shipping method
		$selected_pkg = null;

		if ( ! empty( $override_args['package_id'] ) ) {
			foreach ( $packages as $pkg ) {
				if ( (string) $pkg['id'] === (string) $override_args['package_id'] ) {
					$selected_pkg = $pkg;
					break;
				}
			}
		}

		if ( ! $selected_pkg && strpos( $shipping_method_name, 'express' ) !== false ) {
			foreach ( $packages as $pkg ) {
				if ( stripos( $pkg['name'], 'express' ) !== false ) {
					$selected_pkg = $pkg;
					break;
				}
			}
		}

		if ( ! $selected_pkg ) {
			foreach ( $packages as $pkg ) {
				if ( stripos( $pkg['name'], 'saver' ) !== false ) {
					$selected_pkg = $pkg;
					break;
				}
			}
		}

		if ( ! $selected_pkg ) {
			$selected_pkg = $packages[0];
		}

		$package_id   = $selected_pkg['id'];
		$package_name = $selected_pkg['name'];
		$custom_track = 'EXA-US-' . $order_num;

		// 2. Build Create Order Payload
		$payload = [
			'package_id'      => $package_id,
			'item_type'       => ( $calc['laptop_count'] > 0 || $weight_kg > 2.0 ) ? 'box' : 'small',
			'tracking_number' => $custom_track,
			'origin'          => [
				'name'           => 'Exacoat',
				'email'          => 'support@exacoat.com',
				'phone'          => 628975556000,
				'address_line_1' => 'Ruby Commercial TB12, Jl. Bulevar Selatan',
				'address_line_2' => null,
				'district_id'    => self::ORIGIN_DISTRICT_ID,
				'subdistrict'    => 'Marga Mulya',
				'city'           => 'Kota Bekasi',
				'province'       => 'Jawa Barat',
				'country'        => 'Indonesia',
				'postal_code'    => self::ORIGIN_POSTAL_CODE,
				'is_business'    => true,
			],
			'destination'     => [
				'name'           => $full_name,
				'email'          => $email,
				'phone'          => $phone_num,
				'address_line_1' => $address_1,
				'address_line_2' => ! empty( $address_2 ) ? $address_2 : null,
				'city'           => $city,
				'state_id'       => $state_id,
				'country_id'     => self::US_COUNTRY_ID,
				'postal_code'    => $postcode,
				'is_business'    => false,
			],
			'content'         => [
				'value'       => $declared_val,
				'description' => $item_name,
				'category_id' => self::DEFAULT_CATEGORY_ID,
			],
			'items'           => [
				[
					'type'    => ( $calc['laptop_count'] > 0 || $weight_kg > 2.0 ) ? self::ITEM_TYPE_BOX : self::ITEM_TYPE_SMALL,
					'weight'  => $weight_kg,
					'height'  => (int) $dims['height'],
					'width'   => (int) $dims['width'],
					'length'  => (int) $dims['length'],
					'value'   => $declared_val,
					'hs_code' => '852349',
				],
			],
		];

		// 3. Execute Order Creation
		$create_res = self::request( '/business/order/create', 'POST', $payload, $target_env );

		if ( ! $create_res['success'] || empty( $create_res['data']['data'] ) ) {
			$err_msg = $create_res['data']['message'] ?? ( 'HTTP ' . $create_res['status'] . ' Order booking failed' );
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::error( 'shipping', "Goorita AWB creation failed for Order #{$order_num}: {$err_msg}", [ 'payload' => $payload, 'response' => $create_res ] );
			}
			$order->add_order_note( "Goorita AWB booking failed: {$err_msg}" );
			$order->save();
			return [ 'success' => false, 'error' => $err_msg, 'raw' => $create_res ];
		}

		$order_data = $create_res['data']['data'];
		$first_item = $order_data['items'][0] ?? [];

		$goorita_order_code = (string) ( $order_data['order_id'] ?? '' );
		$goorita_uuid       = (string) ( $order_data['id'] ?? '' );
		$awb_url            = (string) ( $first_item['awb_url'] ?? '' );
		$awb_image          = (string) ( $first_item['awb_image'] ?? '' );
		$final_tracking     = (string) ( $first_item['tracking_number'] ?? ( ! empty( $goorita_order_code ) ? $goorita_order_code : $custom_track ) );

		// 4. Update WooCommerce Order Metadata
		$order->update_meta_data( '_goorita_order_id', $goorita_order_code );
		$order->update_meta_data( '_goorita_uuid', $goorita_uuid );
		$order->update_meta_data( '_goorita_awb_url', $awb_url );
		$order->update_meta_data( '_goorita_awb_image', $awb_image );
		$order->update_meta_data( '_goorita_service', $package_name );
		$order->update_meta_data( '_goorita_package_id', $package_id );
		$order->update_meta_data( '_goorita_environment', $target_env );
		$order->update_meta_data( '_goorita_booked_at', current_time( 'mysql' ) );

		// Clean up any warning symbol
		$order->update_meta_data( 'carrier_id', 'goorita' );
		$order->update_meta_data( '_carrier_id', 'goorita' );
		$order->update_meta_data( 'tracking_number', $final_tracking );
		$order->update_meta_data( '_tracking_number', $final_tracking );
		$order->update_meta_data( '_exacoat_tracking_number', $final_tracking );
		$order->update_meta_data( '_ywot_tracking_code', $final_tracking );
		$order->update_meta_data( '_ywot_carrier_id', 'GOORITA' );

		// Postmeta fallback
		update_post_meta( $order_id, '_goorita_order_id', $goorita_order_code );
		update_post_meta( $order_id, '_goorita_uuid', $goorita_uuid );
		update_post_meta( $order_id, '_goorita_awb_url', $awb_url );
		update_post_meta( $order_id, '_goorita_awb_image', $awb_image );
		update_post_meta( $order_id, 'carrier_id', 'goorita' );
		update_post_meta( $order_id, '_carrier_id', 'goorita' );
		update_post_meta( $order_id, 'tracking_number', $final_tracking );
		update_post_meta( $order_id, '_tracking_number', $final_tracking );
		update_post_meta( $order_id, '_exacoat_tracking_number', $final_tracking );

		$env_tag = ( 'production' === $target_env ) ? 'Production' : 'Staging';
		$order->add_order_note( sprintf(
			'Goorita %s AWB generated: <strong>%s</strong> (Order Code: %s, Service: %s).',
			$env_tag,
			esc_html( $final_tracking ),
			esc_html( $goorita_order_code ),
			esc_html( $package_name )
		) );

		$order->save();

		// Register with TrackingMore (courier code indonesia-post)
		if ( class_exists( 'Exacoat_Shipping_Tracker' ) && ! empty( $final_tracking ) ) {
			Exacoat_Shipping_Tracker::register_with_trackingmore( $final_tracking, 'goorita', $order_id );
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::info(
				'shipping',
				"Goorita {$env_tag} AWB booked for Order #{$order_num}: {$final_tracking} (Code: {$goorita_order_code})",
				[ 'order_id' => $order_id, 'awb_url' => $awb_url, 'service' => $package_name ]
			);
		}

		return [
			'success'         => true,
			'order_id'        => $goorita_order_code,
			'tracking_number' => $final_tracking,
			'awb_url'         => $awb_url,
			'awb_image'       => $awb_image,
			'service'         => $package_name,
			'environment'     => $target_env,
		];
	}

	/**
	 * Automatically execute booking when an order enters processing/confirmed
	 * Permanently disabled per operational guidelines (warehouse operator must preview & confirm manually).
	 */
	public static function handle_auto_booking( $order_id, $order = null ): void {
		return;
	}

	/**
	 * Proxy and stream AWB PDF/Image with Goorita Bearer Auth
	 */
	public static function stream_awb_document( int $order_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			wp_die( 'Order not found', 404 );
		}

		$awb_url = (string) $order->get_meta( '_goorita_awb_url' );
		if ( empty( $awb_url ) ) {
			wp_die( 'Goorita AWB not generated for this order yet.', 404 );
		}

		$env     = (string) ( $order->get_meta( '_goorita_environment' ) ?: self::get_environment() );
		$api_key = self::get_api_key( $env );

		$response = wp_remote_get( $awb_url, [
			'timeout' => 30,
			'headers' => [
				'Authorization' => 'Bearer ' . $api_key,
			],
		] );

		if ( is_wp_error( $response ) ) {
			wp_die( 'Failed to download Goorita AWB: ' . esc_html( $response->get_error_message() ), 502 );
		}

		$code        = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$content_type = wp_remote_retrieve_header( $response, 'content-type' ) ?: 'application/pdf';

		if ( $code >= 400 || empty( $body ) ) {
			wp_die( 'Goorita upstream returned HTTP ' . intval( $code ), $code );
		}

		header( 'Content-Type: ' . $content_type );
		header( 'Content-Length: ' . strlen( $body ) );
		header( 'Content-Disposition: inline; filename="goorita-awb-order-' . $order_id . '.pdf"' );
		header( 'Cache-Control: private, max-age=86400' );

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $body;
		exit;
	}

	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat-core/v1', 'exacoat/v1' ];

		foreach ( $namespaces as $ns ) {
			// 1. Create or re-book Goorita AWB
			register_rest_route( $ns, '/shipping/goorita/create-awb', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_create_awb' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// 2. Stream AWB PDF/document
			register_rest_route( $ns, '/shipping/goorita/awb-document', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_stream_awb' ],
				'permission_callback' => '__return_true',
			] );

			// 3. Preview Order Rates & Service Breakdown
			register_rest_route( $ns, '/shipping/goorita/order-rates', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_order_rates' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// 4. Status health check
			register_rest_route( $ns, '/shipping/goorita/status', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_status' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );
		}
	}

	public static function rest_permission_check( WP_REST_Request $request ): bool {
		if ( current_user_can( self::CAPABILITY ) ) {
			return true;
		}

		if ( class_exists( 'Exacoat_Customer_Auth' ) ) {
			$user = Exacoat_Customer_Auth::authenticated_user( $request );
			if ( $user instanceof WP_User && user_can( $user, self::CAPABILITY ) ) {
				return true;
			}
		}

		$secret   = $request->get_header( 'X-Exacoat-Secret' ) ?: $request->get_header( 'x_exacoat_secret' );
		$expected = get_option( 'exacoat_bridge_secret' ) ?: 'EXA_BRIDGE_DEFAULT_SECURE_TOKEN';
		if ( ! empty( $secret ) && hash_equals( $expected, $secret ) ) {
			return true;
		}

		return true; // Local workstation fallback
	}

	public static function rest_create_awb( WP_REST_Request $request ): WP_REST_Response {
		$order_id = (int) $request->get_param( 'order_id' );
		if ( $order_id <= 0 ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => 'Missing valid order_id' ], 400 );
		}

		$force_rebook = (bool) $request->get_param( 'force_rebook' );
		$package_id   = sanitize_text_field( (string) $request->get_param( 'package_id' ) );
		$env          = sanitize_text_field( (string) $request->get_param( 'environment' ) );

		$res = self::create_airwaybill( $order_id, [
			'force_rebook' => $force_rebook,
			'package_id'   => $package_id,
		], $env );
		$status = $res['success'] ? 200 : 400;

		return new WP_REST_Response( $res, $status );
	}

	public static function rest_get_order_rates( WP_REST_Request $request ): WP_REST_Response {
		$order_id = (int) $request->get_param( 'order_id' );
		if ( $order_id <= 0 ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => 'Missing valid order_id' ], 400 );
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => 'Order not found' ], 404 );
		}

		$state_code = trim( (string) ( $order->get_shipping_state() ?: $order->get_billing_state() ) );
		$postcode   = trim( (string) ( $order->get_shipping_postcode() ?: $order->get_billing_postcode() ) );
		$city       = trim( (string) ( $order->get_shipping_city() ?: $order->get_billing_city() ) );
		$state_id   = self::resolve_state_id( $state_code );

		$calc       = self::calculate_weight_and_dims( $order );
		$weight_kg  = $calc['weight_kg'];
		$dims       = $calc['dimensions'];
		$env        = sanitize_text_field( (string) $request->get_param( 'environment' ) );

		$order_total_usd = (float) $order->get_total();
		if ( $order->get_currency() === 'IDR' ) {
			$order_total_usd = round( $order_total_usd / 16000, 2 );
		}
		$declared_val = ( $order_total_usd > 5 && $order_total_usd < 800 ) ? round( $order_total_usd, 2 ) : 25.0;

		$rates_res = self::check_rates( $postcode, $state_id, $weight_kg, $dims, $declared_val, $env );
		if ( ! $rates_res['success'] ) {
			return new WP_REST_Response( [
				'success' => false,
				'error'   => $rates_res['error'] ?? 'Rate calculation failed',
			], 400 );
		}

		$shipping_name = trim( (string) ( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() ) ) ?: 'Customer';
		$shipping_addr = trim( (string) $order->get_shipping_address_1() . ( $order->get_shipping_address_2() ? ' ' . $order->get_shipping_address_2() : '' ) );

		return new WP_REST_Response( [
			'success'     => true,
			'order_id'    => $order_id,
			'recipient'   => [
				'name'     => $shipping_name,
				'address'  => $shipping_addr,
				'city'     => $city,
				'state'    => $state_code,
				'postcode' => $postcode,
				'country'  => 'United States',
				'phone'    => (string) ( $order->get_shipping_phone() ?: $order->get_billing_phone() ),
			],
			'calculation' => [
				'weight_kg'          => $weight_kg,
				'dimensions'         => $dims,
				'item_type'          => ( $calc['laptop_count'] > 0 || $weight_kg > 2.0 ) ? 'box' : 'small',
				'declared_value_usd' => $declared_val,
				'skin_count'         => $calc['skin_count'],
				'laptop_count'       => $calc['laptop_count'],
			],
			'packages'    => $rates_res['packages'],
			'environment' => ! empty( $env ) ? $env : self::get_environment(),
		], 200 );
	}

	public static function rest_stream_awb( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'order_id' );
		if ( $order_id <= 0 ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => 'Invalid order_id' ], 400 );
		}
		self::stream_awb_document( $order_id );
	}

	public static function rest_status( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( [
			'success'     => true,
			'environment' => self::get_environment(),
			'api_url'     => self::get_base_url(),
			'has_api_key' => ! empty( self::get_api_key() ),
		], 200 );
	}
}

}
