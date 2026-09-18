<?php
/**
 * Biteship Shipping Method & Automated Address Resolution Engine
 * Version: 4.3.5 / Core 7.3.6
 * Supports automated postal code address resolution, token editor, and dynamic live rates.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Biteship_Engine' ) ) {

class Exacoat_Biteship_Engine {

	public static function init() {
		// 1. Hook shipping class definition into woocommerce_shipping_init
		add_action( 'woocommerce_shipping_init', [ __CLASS__, 'shipping_init' ] );

		// 2. Register Biteship shipping method
		add_filter( 'woocommerce_shipping_methods', [ __CLASS__, 'register_biteship_shipping_method' ] );

		// 3. Add address data to WooCommerce fragments
		add_filter( 'woocommerce_update_order_review_fragments', [ __CLASS__, 'add_address_data_to_fragments' ] );

		// 4. Modify posted address data on checkout submission
		add_filter( 'woocommerce_checkout_posted_data', [ __CLASS__, 'modify_posted_address_data' ] );

		// 5. Save district and subdistrict meta to order
		add_action( 'woocommerce_checkout_update_order_meta', [ __CLASS__, 'save_address_to_order_meta' ] );
	}

	public static function shipping_init() {
		if ( class_exists( 'WC_Shipping_Method' ) && ! class_exists( 'WC_Biteship_Shipping_Method' ) ) {
			$base_path = defined( 'EXACOAT_CORE_PATH' ) ? EXACOAT_CORE_PATH : ( defined( 'ARTMATTER_CORE_PATH' ) ? ARTMATTER_CORE_PATH : plugin_dir_path( dirname( __DIR__ ) . '/exacoat-core.php' ) );
			require_once $base_path . 'includes/class-wc-biteship-shipping-method.php';
		}
	}

	public static function register_biteship_shipping_method( $methods ) {
		if ( class_exists( 'WC_Biteship_Shipping_Method' ) || class_exists( 'WC_Shipping_Method' ) ) {
			self::shipping_init();
		}
		if ( class_exists( 'WC_Biteship_Shipping_Method' ) ) {
			$methods['biteship_shipping'] = 'WC_Biteship_Shipping_Method';
		}
		return $methods;
	}

	public static function add_address_data_to_fragments( $fragments ) {
		if ( function_exists( 'WC' ) && WC()->session ) {
			$fragments['biteship_destination_data'] = WC()->session->get( 'biteship_destination_data' );
		}
		return $fragments;
	}

	public static function normalize_id_province_label( $label ) {
		$n = strtolower( trim( $label ?: '' ) );
		$n = preg_replace( '/\s*\(.*?\)\s*/', '', $n );
		$n = preg_replace( '/\s+/', ' ', $n );

		$aliases = [
			'nanggroe aceh darussalam' => 'Daerah Istimewa Aceh',
			'nad'                      => 'Daerah Istimewa Aceh',
			'aceh'                     => 'Daerah Istimewa Aceh',
			'di yogyakarta'            => 'Daerah Istimewa Yogyakarta',
			'diy'                      => 'Daerah Istimewa Yogyakarta',
			'yogyakarta'               => 'Daerah Istimewa Yogyakarta',
			'jakarta'                  => 'DKI Jakarta',
			'dki'                      => 'DKI Jakarta',
			'dki jakarta'              => 'DKI Jakarta',
		];

		return $aliases[ $n ] ?? ucwords( $n );
	}

	public static function get_province_code_from_name( $province_name, $country_code ) {
		if ( empty( $province_name ) || empty( $country_code ) || ! function_exists( 'WC' ) || ! WC()->countries ) {
			return '';
		}
		$states = WC()->countries->get_states( $country_code );
		if ( empty( $states ) ) {
			return '';
		}

		$canonical = self::normalize_id_province_label( $province_name );
		foreach ( $states as $code => $name ) {
			if ( strcasecmp( trim( $name ), trim( $canonical ) ) === 0 ) {
				return $code;
			}
		}

		$norm = function( $s ) {
			$s = strtolower( trim( (string) $s ) );
			$s = preg_replace( '/\s*\(.*?\)\s*/', '', $s );
			$s = preg_replace( '/[^a-z0-9]+/', ' ', $s );
			return trim( $s );
		};
		$needle = $norm( $canonical );
		foreach ( $states as $code => $name ) {
			if ( $norm( $name ) === $needle ) {
				return $code;
			}
		}

		return '';
	}

	public static function get_api_key() {
		if ( ! class_exists( 'WC_Shipping_Zones' ) ) {
			return '';
		}

		self::shipping_init();
		$zone_ids = [ 0 ];
		foreach ( WC_Shipping_Zones::get_zones() as $zone ) {
			$zone_ids[] = absint( $zone['zone_id'] ?? 0 );
		}

		foreach ( array_unique( $zone_ids ) as $zone_id ) {
			$zone = new WC_Shipping_Zone( $zone_id );
			foreach ( $zone->get_shipping_methods( true ) as $method ) {
				if ( 'biteship_shipping' !== $method->id || 'yes' !== $method->enabled ) {
					continue;
				}
				$api_key = trim( (string) $method->get_option( 'api_key', '' ) );
				if ( $api_key ) {
					return $api_key;
				}
			}
		}

		return '';
	}

	public static function get_origin_zip() {
		if ( ! class_exists( 'WC_Shipping_Zones' ) ) {
			return '17142';
		}

		self::shipping_init();
		$zone_ids = [ 0 ];
		foreach ( WC_Shipping_Zones::get_zones() as $zone ) {
			$zone_ids[] = absint( $zone['zone_id'] ?? 0 );
		}

		foreach ( array_unique( $zone_ids ) as $zone_id ) {
			$zone = new WC_Shipping_Zone( $zone_id );
			foreach ( $zone->get_shipping_methods( true ) as $method ) {
				if ( 'biteship_shipping' !== $method->id || 'yes' !== $method->enabled ) {
					continue;
				}
				$origin_zip = trim( (string) $method->get_option( 'origin_zip', '17142' ) );
				if ( $origin_zip ) {
					return $origin_zip;
				}
			}
		}

		return '17142';
	}

	public static function resolve_postcode( $postcode ) {
		$postcode = sanitize_text_field( $postcode );
		if ( ! preg_match( '/^\d{5}$/', $postcode ) ) {
			return new WP_Error( 'invalid_postcode', 'Enter a valid Indonesian postal code.', [ 'status' => 400 ] );
		}

		$api_key = self::get_api_key();
		if ( ! $api_key ) {
			return new WP_Error( 'address_service_unavailable', 'Address lookup is temporarily unavailable.', [ 'status' => 503 ] );
		}

		$destination_data = null;

		// 1. First attempt: Query Biteship rates routing table (/v1/rates/couriers).
		// This matches native WooCommerce calculate_shipping() and returns canonical level 4 (subdistrict / Kelurahan)
		// e.g. Marga Mulya for 17142, Jatibening for 17412.
		$origin_zip     = self::get_origin_zip();
		$rates_response = wp_remote_post( 'https://api.biteship.com/v1/rates/couriers', [
			'headers' => [
				'Authorization' => $api_key,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			],
			'body'    => json_encode( [
				'origin_postal_code'      => (int) $origin_zip,
				'destination_postal_code' => (int) $postcode,
				'couriers'                => 'jne',
				'items'                   => [
					[
						'name'     => 'Exacoat Device Skin',
						'value'    => 100000,
						'weight'   => 150,
						'quantity' => 1,
					],
				],
			] ),
			'timeout' => 8,
		] );

		if ( ! is_wp_error( $rates_response ) ) {
			$rates_status = wp_remote_retrieve_response_code( $rates_response );
			if ( $rates_status >= 200 && $rates_status < 300 ) {
				$rates_body = json_decode( wp_remote_retrieve_body( $rates_response ), true );
				if ( ! empty( $rates_body['destination'] ) && is_array( $rates_body['destination'] ) ) {
					$d           = $rates_body['destination'];
					$province    = sanitize_text_field( $d['administrative_division_level_1_name'] ?? '' );
					$city        = sanitize_text_field( $d['administrative_division_level_2_name'] ?? '' );
					$district    = sanitize_text_field( $d['administrative_division_level_3_name'] ?? '' );
					$subdistrict = sanitize_text_field( $d['administrative_division_level_4_name'] ?? '' );

					if ( $province && $city ) {
						$destination_data = [
							'postcode'    => $postcode,
							'province'    => $province,
							'state'       => self::get_province_code_from_name( $province, 'ID' ),
							'city'        => $city,
							'district'    => $district,
							'subdistrict' => $subdistrict,
						];
					}
				}
			}
		}

		// 2. Second attempt / Fallback: Query Biteship areas (/v1/maps/areas) without type=single
		// When type=single is omitted, Biteship returns an array of areas down to level 4.
		if ( ! $destination_data || empty( $destination_data['subdistrict'] ) ) {
			$areas_response = wp_remote_get( add_query_arg( [
				'countries' => 'ID',
				'input'     => $postcode,
			], 'https://api.biteship.com/v1/maps/areas' ), [
				'headers' => [
					'Authorization' => $api_key,
					'Accept'        => 'application/json',
				],
				'timeout' => 8,
			] );

			if ( ! is_wp_error( $areas_response ) ) {
				$status = wp_remote_retrieve_response_code( $areas_response );
				$body   = json_decode( wp_remote_retrieve_body( $areas_response ), true );
				$areas  = is_array( $body['areas'] ?? null ) ? $body['areas'] : [];

				if ( $status >= 200 && $status < 300 && ! empty( $areas ) ) {
					$best_area = null;
					foreach ( $areas as $area_candidate ) {
						if ( ! empty( $area_candidate['administrative_division_level_4_name'] ) ) {
							$best_area = $area_candidate;
							break;
						}
					}
					if ( ! $best_area ) {
						$best_area = $areas[0];
					}

					$province    = sanitize_text_field( $best_area['administrative_division_level_1_name'] ?? '' );
					$city        = sanitize_text_field( $best_area['administrative_division_level_2_name'] ?? '' );
					$district    = sanitize_text_field( $best_area['administrative_division_level_3_name'] ?? '' );
					$subdistrict = sanitize_text_field( $best_area['administrative_division_level_4_name'] ?? '' );

					if ( $province && $city ) {
						$destination_data = [
							'postcode'    => $postcode,
							'province'    => $province,
							'state'       => self::get_province_code_from_name( $province, 'ID' ),
							'city'        => $city,
							'district'    => $district,
							'subdistrict' => $subdistrict,
						];
					}
				}
			}
		}

		if ( ! $destination_data || ! $destination_data['province'] || ! $destination_data['city'] ) {
			return new WP_Error( 'address_not_found', 'No address was found for this postal code.', [ 'status' => 404 ] );
		}

		set_transient( 'artmatter_checkout_address_' . $postcode, $destination_data, DAY_IN_SECONDS );
		return rest_ensure_response( $destination_data );
	}

	public static function modify_posted_address_data( $data ) {
		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || ! function_exists( 'WC' ) || ! WC()->session ) {
			return $data;
		}

		$session_data  = WC()->session->get( 'biteship_destination_data' );
		$sub_override  = isset( $_POST['biteship_subdistrict_override'] ) ? sanitize_text_field( wp_unslash( $_POST['biteship_subdistrict_override'] ) ) : null;
		$dist_override = isset( $_POST['biteship_district_override'] ) ? sanitize_text_field( wp_unslash( $_POST['biteship_district_override'] ) ) : null;

		if ( $session_data && ( null !== $sub_override || null !== $dist_override ) ) {
			if ( null !== $sub_override ) {
				$session_data['subdistrict'] = $sub_override;
			}
			if ( null !== $dist_override ) {
				$session_data['district'] = $dist_override;
			}
			WC()->session->set( 'biteship_destination_data', $session_data );
		}

		$biteship_data = WC()->session->get( 'biteship_destination_data' );

		if ( ! $biteship_data || ! isset( $data['billing_country'] ) || 'ID' !== $data['billing_country'] ) {
			return $data;
		}

		if ( ! empty( $biteship_data['city'] ) ) {
			$data['billing_city'] = $biteship_data['city'];
		}
		if ( ! empty( $biteship_data['province'] ) ) {
			$state_code = self::get_province_code_from_name( $biteship_data['province'], $data['billing_country'] );
			if ( $state_code ) {
				$data['billing_state'] = $state_code;
			}
		}

		if ( ! empty( $data['ship_to_different_address'] ) ) {
			if ( ! empty( $biteship_data['city'] ) ) {
				$data['shipping_city'] = $biteship_data['city'];
			}
			if ( ! empty( $biteship_data['province'] ) ) {
				$state_code = self::get_province_code_from_name( $biteship_data['province'], $data['shipping_country'] );
				if ( $state_code ) {
					$data['shipping_state'] = $state_code;
				}
			}
		}

		$area_details = array_filter( [
			$biteship_data['subdistrict'] ?? null,
			$biteship_data['district'] ?? null,
		] );

		if ( ! empty( $area_details ) ) {
			$area_details_string       = implode( ', ', $area_details );
			$data['billing_address_2'] = $area_details_string;

			if ( ! empty( $data['ship_to_different_address'] ) ) {
				$data['shipping_address_2'] = $area_details_string;
			}
		}

		return $data;
	}

	public static function save_address_to_order_meta( $order_id ) {
		if ( ! $order_id || ! function_exists( 'WC' ) || ! WC()->session || ! WC()->session->get( 'biteship_destination_data' ) ) {
			return;
		}
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : null;
		if ( ! $order ) {
			return;
		}
		$data           = WC()->session->get( 'biteship_destination_data' );
		$fields_to_save = [ 'district', 'subdistrict' ];
		foreach ( $fields_to_save as $field ) {
			if ( ! empty( $data[ $field ] ) ) {
				$order->update_meta_data( '_billing_' . $field, $data[ $field ] );
				if ( $order->get_shipping_address_1() ) {
					$order->update_meta_data( '_shipping_' . $field, $data[ $field ] );
				}
			}
		}
		$order->save();
	}

	public static function display_biteship_duration_in_checkout( $method, $index ) {
		if ( strpos( $method->get_id(), 'biteship_shipping' ) !== false ) {
			$meta_data = $method->get_meta_data();
			if ( isset( $meta_data['_biteship_duration'] ) && ! empty( $meta_data['_biteship_duration'] ) ) {
				printf(
					'<div class="biteship-shipping-duration" style="font-size: 11px; color: #a1a1aa; margin-top: 3px;">%s</div>',
					esc_html( $meta_data['_biteship_duration'] )
				);
			}
		}
	}
}

}

if ( ! class_exists( 'Artmatter_Biteship_Engine' ) ) {
	class_alias( 'Exacoat_Biteship_Engine', 'Artmatter_Biteship_Engine' );
}
