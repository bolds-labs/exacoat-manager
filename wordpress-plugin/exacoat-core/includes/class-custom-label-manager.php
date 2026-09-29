<?php
/**
 * Exacoat Custom Label Manager
 *
 * Handles custom 4x6 thermal shipping labels, shared address book storage,
 * and default sender settings across Administrator and Shop Manager roles.
 *
 * Strict Antislop compliant: No em dashes in copy or notifications.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Custom_Label_Manager' ) ) {

class Exacoat_Custom_Label_Manager {

	const CAPABILITY            = 'manage_woocommerce';
	const OPTION_ADDRESSES      = 'exacoat_custom_label_addresses';
	const OPTION_DEFAULT_SENDER = 'exacoat_custom_label_default_sender';

	/**
	 * Default sender configuration
	 */
	public static function get_default_sender(): array {
		$saved = get_option( self::OPTION_DEFAULT_SENDER );
		if ( is_array( $saved ) && ! empty( $saved['brand'] ) ) {
			return $saved;
		}

		return [
			'brand'        => 'EXACOAT',
			'name'         => 'Exacoat Workshop',
			'phone'        => '+62-813-800-9060',
			'email'        => 'support@exacoat.com',
			'address_line' => 'Summarecon Bekasi, West Java, Indonesia',
		];
	}

	/**
	 * Initialize hooks and REST endpoints
	 */
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
	}

	/**
	 * Register REST API Endpoints for Headless Exacoat Manager
	 */
	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat-core/v1', 'exacoat/v1' ];

		foreach ( $namespaces as $ns ) {
			// Get all saved addresses and default sender
			register_rest_route( $ns, '/custom-labels/addresses', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_addresses' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Save or update an address (or full list)
			register_rest_route( $ns, '/custom-labels/addresses', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_save_address' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Delete a saved address by ID
			register_rest_route( $ns, '/custom-labels/addresses', [
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'rest_delete_address' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Update default sender profile
			register_rest_route( $ns, '/custom-labels/sender', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_save_sender' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );
		}
	}

	/**
	 * Permission check: allows Administrator and Shop Manager
	 */
	public static function rest_permission_check( WP_REST_Request $request ): bool {
		if ( current_user_can( self::CAPABILITY ) || current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( class_exists( 'Exacoat_Core' ) && method_exists( 'Exacoat_Core', 'verify_bridge_permission' ) ) {
			if ( Exacoat_Core::verify_bridge_permission( $request ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Fetch saved addresses array from WordPress options
	 */
	public static function get_saved_addresses(): array {
		$addresses = get_option( self::OPTION_ADDRESSES, [] );
		if ( ! is_array( $addresses ) ) {
			return [];
		}

		return array_values( $addresses );
	}

	/**
	 * REST: GET /custom-labels/addresses
	 */
	public static function rest_get_addresses( WP_REST_Request $request ): WP_REST_Response {
		$addresses = self::get_saved_addresses();
		$sender    = self::get_default_sender();

		return new WP_REST_Response( [
			'success'        => true,
			'addresses'      => $addresses,
			'default_sender' => $sender,
		], 200 );
	}

	/**
	 * REST: POST /custom-labels/addresses
	 * Handles creating, updating, or batch syncing addresses
	 */
	public static function rest_save_address( WP_REST_Request $request ): WP_REST_Response {
		$body = $request->get_json_params() ?: $request->get_params();

		// Handle batch list replacement if array provided
		if ( isset( $body['addresses'] ) && is_array( $body['addresses'] ) ) {
			$clean_list = [];
			foreach ( $body['addresses'] as $item ) {
				$sanitized = self::sanitize_address_entry( $item );
				if ( ! empty( $sanitized['name'] ) ) {
					$clean_list[] = $sanitized;
				}
			}

			update_option( self::OPTION_ADDRESSES, $clean_list, false );

			return new WP_REST_Response( [
				'success'   => true,
				'message'   => 'Saved addresses updated successfully.',
				'addresses' => $clean_list,
			], 200 );
		}

		// Handle single address create or update
		$entry = self::sanitize_address_entry( $body );
		if ( empty( $entry['name'] ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Recipient name is required.',
			], 400 );
		}

		$current = self::get_saved_addresses();
		$exists  = false;

		foreach ( $current as $idx => $existing ) {
			if ( ! empty( $entry['id'] ) && $existing['id'] === $entry['id'] ) {
				$entry['created_at'] = $existing['created_at'] ?? current_time( 'c' );
				$entry['updated_at'] = current_time( 'c' );
				$current[ $idx ]     = $entry;
				$exists              = true;
				break;
			}
		}

		if ( ! $exists ) {
			if ( empty( $entry['id'] ) ) {
				$entry['id'] = 'addr_' . wp_generate_password( 10, false );
			}
			$entry['created_at'] = current_time( 'c' );
			$entry['updated_at'] = current_time( 'c' );
			array_unshift( $current, $entry );
		}

		update_option( self::OPTION_ADDRESSES, array_values( $current ), false );

		return new WP_REST_Response( [
			'success'   => true,
			'message'   => 'Address saved successfully.',
			'address'   => $entry,
			'addresses' => array_values( $current ),
		], 200 );
	}

	/**
	 * REST: DELETE /custom-labels/addresses
	 */
	public static function rest_delete_address( WP_REST_Request $request ): WP_REST_Response {
		$id = sanitize_text_field( $request->get_param( 'id' ) ?: '' );
		if ( empty( $id ) ) {
			$body = $request->get_json_params();
			$id   = sanitize_text_field( $body['id'] ?? '' );
		}

		if ( empty( $id ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Address ID is required for deletion.',
			], 400 );
		}

		$current = self::get_saved_addresses();
		$filtered = array_values( array_filter( $current, function ( $item ) use ( $id ) {
			return ( $item['id'] ?? '' ) !== $id;
		} ) );

		update_option( self::OPTION_ADDRESSES, $filtered, false );

		return new WP_REST_Response( [
			'success'   => true,
			'message'   => 'Address deleted successfully.',
			'addresses' => $filtered,
		], 200 );
	}

	/**
	 * REST: POST /custom-labels/sender
	 */
	public static function rest_save_sender( WP_REST_Request $request ): WP_REST_Response {
		$body = $request->get_json_params() ?: $request->get_params();

		$clean_sender = [
			'brand'        => sanitize_text_field( $body['brand'] ?? 'EXACOAT' ),
			'name'         => sanitize_text_field( $body['name'] ?? 'Exacoat Workshop' ),
			'phone'        => sanitize_text_field( $body['phone'] ?? '+62-813-800-9060' ),
			'email'        => sanitize_email( $body['email'] ?? 'support@exacoat.com' ),
			'address_line' => sanitize_text_field( $body['address_line'] ?? '' ),
		];

		update_option( self::OPTION_DEFAULT_SENDER, $clean_sender, false );

		return new WP_REST_Response( [
			'success' => true,
			'message' => 'Default sender settings updated.',
			'sender'  => $clean_sender,
		], 200 );
	}

	/**
	 * Sanitize address payload
	 */
	private static function sanitize_address_entry( array $raw ): array {
		$current_user = wp_get_current_user();
		$user_label   = $current_user && $current_user->exists() ? $current_user->display_name : 'Staff';

		return [
			'id'              => sanitize_text_field( $raw['id'] ?? ( 'addr_' . wp_generate_password( 10, false ) ) ),
			'label'           => sanitize_text_field( $raw['label'] ?? ( $raw['name'] ?? 'Saved Address' ) ),
			'name'            => sanitize_text_field( $raw['name'] ?? '' ),
			'company'         => sanitize_text_field( $raw['company'] ?? '' ),
			'phone'           => sanitize_text_field( $raw['phone'] ?? '' ),
			'email'           => sanitize_email( $raw['email'] ?? '' ),
			'address_1'       => sanitize_textarea_field( $raw['address_1'] ?? '' ),
			'address_2'       => sanitize_textarea_field( $raw['address_2'] ?? '' ),
			'city'            => sanitize_text_field( $raw['city'] ?? '' ),
			'state'           => sanitize_text_field( $raw['state'] ?? '' ),
			'postcode'        => sanitize_text_field( $raw['postcode'] ?? '' ),
			'country'         => sanitize_text_field( $raw['country'] ?? 'Indonesia' ),
			'courier'         => sanitize_text_field( $raw['courier'] ?? '' ),
			'tracking_number' => sanitize_text_field( $raw['tracking_number'] ?? '' ),
			'notes'           => sanitize_textarea_field( $raw['notes'] ?? '' ),
			'created_at'      => sanitize_text_field( $raw['created_at'] ?? current_time( 'c' ) ),
			'updated_at'      => current_time( 'c' ),
			'updated_by'      => sanitize_text_field( $raw['updated_by'] ?? $user_label ),
		];
	}
}

}
