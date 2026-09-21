<?php
/**
 * Biteship WooCommerce Shipping Method Class Definition
 * Version: 4.3.5
 * Only included inside woocommerce_shipping_init when WC_Shipping_Method is loaded.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WC_Biteship_Shipping_Method' ) && class_exists( 'WC_Shipping_Method' ) ) {

	class WC_Biteship_Shipping_Method extends WC_Shipping_Method {
		public $api_key;
		public $origin_zip;
		public $couriers;

		public function __construct( $instance_id = 0 ) {
			$this->id                 = 'biteship_shipping';
			$this->instance_id        = absint( $instance_id );
			$this->method_title       = __( 'Biteship Shipping', 'exacoat-core' );
			$this->method_description = __( 'Dynamically calculate shipping rates using the Biteship API.', 'exacoat-core' );
			$this->supports           = [ 'shipping-zones', 'instance-settings', 'instance-settings-modal' ];
			$this->init();
		}

		public function init() {
			$this->init_form_fields();
			$this->init_settings();
			$this->title      = $this->get_option( 'title', __( 'Biteship Shipping', 'exacoat-core' ) );
			$this->enabled    = $this->get_option( 'enabled' );
			$this->api_key    = $this->get_option( 'api_key' );
			$this->origin_zip = $this->get_option( 'origin_zip', '17142' );
			$this->couriers   = $this->get_option( 'couriers', 'jne,sicepat' );
			add_action( 'woocommerce_update_options_shipping_' . $this->id, [ $this, 'process_admin_options' ] );
		}

		public function init_form_fields() {
			$this->instance_form_fields = [
				'title'      => [
					'title'       => __( 'Title', 'exacoat-core' ),
					'type'        => 'text',
					'description' => __( 'Title shown to customer during checkout.', 'exacoat-core' ),
					'default'     => __( 'Biteship Shipping', 'exacoat-core' ),
					'desc_tip'    => true,
				],
				'api_key'    => [
					'title'       => __( 'Biteship API Key', 'exacoat-core' ),
					'type'        => 'text',
					'description' => __( 'Enter your Biteship Live API Key.', 'exacoat-core' ),
					'default'     => '',
				],
				'origin_zip' => [
					'title'       => __( 'Origin Postal Code', 'exacoat-core' ),
					'type'        => 'text',
					'description' => __( 'The postal code of your warehouse or shipping origin.', 'exacoat-core' ),
					'default'     => '17142',
				],
				'couriers'   => [
					'title'       => __( 'Enabled Couriers', 'exacoat-core' ),
					'type'        => 'text',
					'description' => __( 'Comma-separated list of courier codes (e.g. jne,sicepat,jnt).', 'exacoat-core' ),
					'default'     => 'jne,sicepat',
				],
			];
		}

		public function calculate_shipping( $package = [] ) {
			if ( 'no' === $this->enabled || empty( $this->api_key ) ) {
				return;
			}
			$is_store_api_request = defined( 'REST_REQUEST' ) && REST_REQUEST;
			if ( ! is_user_logged_in() && ( ! function_exists( 'WC' ) || ! WC()->customer || ! WC()->customer->has_calculated_shipping() ) && ! wp_doing_ajax() && ! $is_store_api_request ) {
				return;
			}
			if ( ! isset( $package['destination']['country'] ) || 'ID' !== $package['destination']['country'] || empty( $package['destination']['postcode'] ) ) {
				if ( function_exists( 'WC' ) && WC()->session ) {
					WC()->session->__unset( 'biteship_destination_data' );
				}
				return;
			}
			if ( ! preg_match( '/^\d{5}$/', $package['destination']['postcode'] ) ) {
				if ( function_exists( 'WC' ) && WC()->session ) {
					WC()->session->__unset( 'biteship_destination_data' );
				}
				return;
			}

			$destination_zip   = $package['destination']['postcode'];
			$stable_cart_items = [];
			foreach ( $package['contents'] as $item_id => $values ) {
				$stable_cart_items[ $item_id ] = [
					'product_id'   => $values['product_id'],
					'variation_id' => $values['variation_id'],
					'quantity'     => $values['quantity'],
				];
			}
			$cart_hash     = md5( json_encode( $stable_cart_items ) . '_exacoat_v0.0.8' );
			$transient_key = 'biteship_rates_' . $destination_zip . '_' . $cart_hash;

			if ( false !== ( $cached_rates = get_transient( $transient_key ) ) ) {
				if ( false !== ( $cached_session = get_transient( $transient_key . '_session' ) ) ) {
					if ( function_exists( 'WC' ) && WC()->session ) {
						WC()->session->set( 'biteship_destination_data', $cached_session );
					}
				}
				foreach ( $cached_rates as $rate_data ) {
					$this->add_rate( $rate_data );
				}
				return;
			}

			$items              = [];
			$total_items_qty    = 0;
			$total_items_grams  = 0;

			foreach ( $package['contents'] as $values ) {
				$product     = $values['data'];
				$qty         = max( 1, intval( $values['quantity'] ?? 1 ) );
				$price       = (float) $product->get_price();
				$prod_weight = (float) $product->get_weight();
				$weight_g    = ( $prod_weight > 0 && function_exists( 'wc_get_weight' ) ) ? wc_get_weight( $prod_weight, 'g' ) : $prod_weight;
				$item_weight = ( $weight_g > 0 ) ? max( 1, (int) round( $weight_g ) ) : 1;

				$total_items_qty   += $qty;
				$total_items_grams += ( $item_weight * $qty );

				$items[] = [
					'name'     => $product->get_name(),
					'value'    => $price,
					'weight'   => $item_weight,
					'quantity' => $qty,
				];
			}

			$body     = [
				'origin_postal_code'      => (int) $this->origin_zip,
				'destination_postal_code' => (int) $destination_zip,
				'couriers'                => $this->couriers,
				'items'                   => $items,
			];
			$response = wp_remote_post( 'https://api.biteship.com/v1/rates/couriers', [
				'headers' => [
					'Authorization' => $this->api_key,
					'Content-Type'  => 'application/json',
				],
				'body'    => json_encode( $body ),
				'timeout' => 15,
			] );

			if ( is_wp_error( $response ) ) {
				if ( function_exists( 'wc_get_logger' ) ) {
					wc_get_logger()->error( 'Biteship API Error: ' . $response->get_error_message() );
				}
				return;
			}

			$response_body = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( isset( $response_body['success'] ) && true === $response_body['success'] && ! empty( $response_body['pricing'] ) ) {
				$destination_data = null;
				if ( isset( $response_body['destination'] ) ) {
					$d                = $response_body['destination'];
					$destination_data = [
						'province'    => $d['administrative_division_level_1_name'] ?? '',
						'city'        => $d['administrative_division_level_2_name'] ?? '',
						'district'    => $d['administrative_division_level_3_name'] ?? '',
						'subdistrict' => $d['administrative_division_level_4_name'] ?? '',
					];
					if ( function_exists( 'WC' ) && WC()->session ) {
						WC()->session->set( 'biteship_destination_data', $destination_data );
					}
				}
				$rates_to_cache = [];
				foreach ( $response_body['pricing'] as $rate ) {
					if ( isset( $rate['shipping_type'] ) && 'parcel' === $rate['shipping_type'] ) {
						$service_code = strtolower( (string) ( $rate['courier_service_code'] ?? '' ) );
						$service_name = strtolower( (string) ( $rate['courier_service_name'] ?? '' ) );

						// Exclude cargo, trucking, JTR, and GOKIL services
						if (
							strpos( $service_code, 'cargo' ) !== false ||
							strpos( $service_name, 'cargo' ) !== false ||
							strpos( $service_code, 'trucking' ) !== false ||
							strpos( $service_name, 'trucking' ) !== false ||
							strpos( $service_code, 'jtr' ) !== false ||
							strpos( $service_name, 'jtr' ) !== false ||
							strpos( $service_code, 'gokil' ) !== false ||
							strpos( $service_name, 'gokil' ) !== false
						) {
							continue;
						}

						$dr            = explode( ' - ', $rate['shipment_duration_range'] ?? '' );
						$duration_text = ( count( $dr ) > 1 && $dr[0] != $dr[1] ) ? $rate['shipment_duration_range'] . ' business days' : ( $dr[0] ?? '' ) . ' business day';
						$label         = sprintf( '%s - %s', strtoupper( $rate['courier_name'] ?? '' ), strtoupper( $rate['courier_service_code'] ?? '' ) );

						$biteship_idr_price = (float) ( $rate['price'] ?? 0 );
						$shop_base_currency = get_option( 'woocommerce_currency', 'IDR' );

						// Biteship rates from API are always in IDR.
						// If the store's base currency is not IDR, convert to shop base currency so WooCommerce interprets it correctly.
						$cost_in_base = $biteship_idr_price;
						if ( 'IDR' !== $shop_base_currency && $biteship_idr_price > 0 ) {
							$cost_in_base = apply_filters( 'wc_aelia_cs_convert', $biteship_idr_price, 'IDR', $shop_base_currency );
							$enhancements_class = class_exists( 'Exacoat_Store_Enhancements' ) ? 'Exacoat_Store_Enhancements' : ( class_exists( 'Artmatter_Store_Enhancements' ) ? 'Artmatter_Store_Enhancements' : false );
							if ( $cost_in_base === $biteship_idr_price && $enhancements_class ) {
								$currencies = $enhancements_class::get_currency_rates();
								$rate_val   = floatval( $currencies[ $shop_base_currency ]['rate'] ?? 0 );
								if ( $rate_val > 0 ) {
									$cost_in_base = round( $biteship_idr_price * $rate_val, 2 );
								}
							}
						}

						$args          = [
							'id'        => $this->get_rate_id( ( $rate['courier_code'] ?? 'courier' ) . '_' . ( $rate['courier_service_code'] ?? 'service' ) ),
							'label'     => $label,
							'cost'      => $cost_in_base,
							'calc_tax'  => 'per_order',
							'meta_data' => [
								'delivery_time'          => $duration_text,
								'description'            => $duration_text,
								'duration'               => $duration_text,
								'biteship_duration'      => $duration_text,
								'_biteship_duration'     => $duration_text,
								'_biteship_raw_idr_cost' => $biteship_idr_price,
							],
						];
						$this->add_rate( $args );
						$rates_to_cache[] = $args;
					}
				}
				if ( ! empty( $rates_to_cache ) ) {
					set_transient( $transient_key, $rates_to_cache, DAY_IN_SECONDS );
					if ( $destination_data ) {
						set_transient( $transient_key . '_session', $destination_data, DAY_IN_SECONDS );
					}
				}
			} else {
				if ( function_exists( 'WC' ) && WC()->session ) {
					WC()->session->__unset( 'biteship_destination_data' );
				}
				if ( function_exists( 'wc_get_logger' ) ) {
					wc_get_logger()->error( 'Biteship API Response Error: ' . json_encode( $response_body ) );
				}
			}
		}
	}

	// Ensure all shipping rates expose delivery_time and description to WooCommerce Store API
	add_filter( 'woocommerce_package_rates', function( $rates, $package ) {
		if ( ! is_array( $rates ) ) {
			return $rates;
		}
		foreach ( $rates as $rate_id => $rate ) {
			if ( ! $rate instanceof WC_Shipping_Rate ) {
				continue;
			}
			$meta = $rate->get_meta_data();
			$duration = $meta['_biteship_duration'] ?? ( $meta['delivery_time'] ?? ( $meta['duration'] ?? ( $meta['biteship_duration'] ?? '' ) ) );

			if ( ! empty( $duration ) ) {
				$rate->add_meta_data( 'delivery_time', $duration, true );
				$rate->add_meta_data( 'description', $duration, true );
				$rate->add_meta_data( 'duration', $duration, true );
				$rate->add_meta_data( 'biteship_duration', $duration, true );

				if ( method_exists( $rate, 'set_delivery_time' ) ) {
					$rate->set_delivery_time( $duration );
				}
				if ( method_exists( $rate, 'set_description' ) ) {
					$rate->set_description( $duration );
				}
			}
		}
		return $rates;
	}, 20, 2 );
}
