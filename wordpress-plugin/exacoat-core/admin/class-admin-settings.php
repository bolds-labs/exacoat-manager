<?php
/**
 * Admin Settings, Permalinks & Diagnostics Controller for Exacoat Core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Admin_Settings' ) ) {

class Exacoat_Admin_Settings {

	public static function init() {
		add_action( 'admin_menu', [ __CLASS__, 'register_admin_menu' ] );
		add_action( 'admin_init', [ __CLASS__, 'register_settings' ] );
		add_action( 'admin_head', [ __CLASS__, 'suppress_third_party_notices' ], 1 );
		add_action( 'update_option_exacoat_core_settings', [ __CLASS__, 'on_settings_updated' ], 10, 2 );
		add_action( 'update_option_artmatter_core_settings', [ __CLASS__, 'on_settings_updated' ], 10, 2 );
		add_action( 'wp_ajax_exacoat_run_health_test', [ __CLASS__, 'ajax_run_health_test' ] );
		add_action( 'wp_ajax_artmatter_run_health_test', [ __CLASS__, 'ajax_run_health_test' ] );
		add_action( 'wp_ajax_exacoat_flush_permalinks', [ __CLASS__, 'ajax_flush_permalinks' ] );
		add_action( 'wp_ajax_artmatter_flush_permalinks', [ __CLASS__, 'ajax_flush_permalinks' ] );
		add_action( 'wp_ajax_exacoat_revert_flat_media', [ __CLASS__, 'ajax_revert_flat_media' ] );
		add_action( 'wp_ajax_artmatter_revert_flat_media', [ __CLASS__, 'ajax_revert_flat_media' ] );
		add_action( 'wp_ajax_exacoat_save_whatsapp_settings', [ __CLASS__, 'ajax_save_whatsapp_settings' ] );
		add_action( 'wp_ajax_exacoat_test_whatsapp', [ __CLASS__, 'ajax_test_whatsapp' ] );
		add_action( 'wp_ajax_exacoat_add_tracking_numbers', [ __CLASS__, 'ajax_add_tracking_numbers' ] );
		add_action( 'wp_ajax_exacoat_get_tracking_inventory', [ __CLASS__, 'ajax_get_tracking_inventory' ] );
	}

	public static function suppress_third_party_notices() {
		$screen = get_current_screen();
		if ( $screen && in_array( $screen->id, [ 'toplevel_page_exacoat-core', 'toplevel_page_artmatter-core' ], true ) ) {
			remove_all_actions( 'admin_notices' );
			remove_all_actions( 'all_admin_notices' );
			remove_all_actions( 'user_admin_notices' );
			remove_all_actions( 'network_admin_notices' );
		}
	}

	public static function register_admin_menu() {
		add_menu_page(
			__( 'Exacoat Core', 'exacoat-core' ),
			__( 'Exacoat Core', 'exacoat-core' ),
			'manage_options',
			'exacoat-core',
			[ __CLASS__, 'render_settings_page' ],
			'dashicons-shield',
			56
		);

		// Backward compatibility hidden page for legacy artmatter-core slug
		add_submenu_page(
			null,
			__( 'Exacoat Core', 'exacoat-core' ),
			__( 'Exacoat Core', 'exacoat-core' ),
			'manage_options',
			'artmatter-core',
			[ __CLASS__, 'render_settings_page' ]
		);
	}

	public static function register_settings() {
		register_setting( 'exacoat_core_settings_group', 'exacoat_core_settings', [
			'sanitize_callback' => [ __CLASS__, 'sanitize_settings' ],
		] );
		register_setting( 'artmatter_core_settings_group', 'artmatter_core_settings', [
			'sanitize_callback' => [ __CLASS__, 'sanitize_settings' ],
		] );
	}

	public static function sanitize_settings( $value ): array {
		$settings = is_array( $value ) ? $value : [];

		// Global Currency Markup Multiplier
		if ( isset( $settings['currency_global_markup'] ) ) {
			$settings['currency_global_markup'] = floatval( $settings['currency_global_markup'] );
			if ( $settings['currency_global_markup'] <= 0 ) {
				$settings['currency_global_markup'] = 1.15;
			}
		}

		// Multi-Currency Rates & Rounding Matrix
		if ( isset( $settings['currency_rates'] ) && is_array( $settings['currency_rates'] ) ) {
			$sanitized_rates = [];
			$allowed_roundings = [ '9_end', '90_end', '50_step', '500_step', 'none' ];

			foreach ( $settings['currency_rates'] as $raw_code => $curr_data ) {
				if ( ! is_array( $curr_data ) ) {
					continue;
				}
				$code = strtoupper( preg_replace( '/[^A-Z]/', '', (string) ( $curr_data['code'] ?? $raw_code ) ) );
				if ( empty( $code ) || strlen( $code ) !== 3 ) {
					continue;
				}

				$symbol   = sanitize_text_field( $curr_data['symbol'] ?? '$' );
				$rate     = floatval( $curr_data['rate'] ?? 0 );
				$rounding = (string) ( $curr_data['rounding'] ?? '9_end' );
				if ( ! in_array( $rounding, $allowed_roundings, true ) ) {
					$rounding = '9_end';
				}

				$sanitized_rates[ $code ] = [
					'code'     => $code,
					'symbol'   => $symbol,
					'rate'     => $rate,
					'rounding' => $rounding,
				];
			}
			$settings['currency_rates'] = $sanitized_rates;
		}

		// Target Shipping Method IDs
		if ( isset( $settings['shipping_target_method_ids'] ) ) {
			$settings['shipping_target_method_ids'] = sanitize_text_field( $settings['shipping_target_method_ids'] );
		}

		// Multi-Zone Free Shipping Thresholds
		if ( isset( $settings['shipping_zones'] ) && is_array( $settings['shipping_zones'] ) ) {
			$sanitized_zones = [];
			foreach ( $settings['shipping_zones'] as $z_key => $zone ) {
				if ( ! is_array( $zone ) ) {
					continue;
				}
				$key = sanitize_key( (string) $z_key );
				if ( empty( $key ) ) {
					continue;
				}

				$sanitized_zones[ $key ] = [
					'name'        => sanitize_text_field( $zone['name'] ?? ucfirst( $key ) ),
					'countries'   => sanitize_text_field( $zone['countries'] ?? '' ),
					'currency'    => strtoupper( sanitize_text_field( $zone['currency'] ?? 'IDR' ) ),
					'free'        => floatval( $zone['free'] ?? 0 ),
					'filter_text' => sanitize_text_field( $zone['filter_text'] ?? '' ),
				];
			}
			$settings['shipping_zones'] = $sanitized_zones;
		}

		$settings['enable_shipping_tracker'] = 1;
		return $settings;
	}

	public static function on_settings_updated( $old_value, $value ) {
		if ( class_exists( 'Exacoat_Core' ) && method_exists( 'Exacoat_Core', 'clear_settings_cache' ) ) {
			Exacoat_Core::clear_settings_cache();
		}
		flush_rewrite_rules( false );
	}

	public static function render_settings_page() {
		require_once EXACOAT_CORE_PATH . 'admin/views/settings-page.php';
	}

	/**
	 * 1-Click Permalinks Flush AJAX Handler
	 */
	public static function ajax_flush_permalinks() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		flush_rewrite_rules( true );

		wp_send_json_success( [
			'message' => 'Permalinks and rewrite rules flushed successfully.',
		] );
	}

	/**
	 * AJAX Handler to safely flatten and revert media from Assets/ to root /uploads/.
	 */
	public static function ajax_revert_flat_media() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		if ( class_exists( 'Exacoat_Store_Enhancements' ) ) {
			$res = Exacoat_Store_Enhancements::revert_assets_to_flat_uploads();
			wp_send_json_success( $res );
		} elseif ( class_exists( 'Artmatter_Store_Enhancements' ) ) {
			$res = Artmatter_Store_Enhancements::revert_assets_to_flat_uploads();
			wp_send_json_success( $res );
		} else {
			wp_send_json_error( [ 'message' => 'Store enhancements module not available.' ] );
		}
	}

	/**
	 * AJAX Health Diagnostic Runner
	 */
	public static function ajax_run_health_test() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access' ] );
		}

		$results = [];

		// Test 1: Action Scheduler Background Queue
		$as_active = class_exists( 'ActionScheduler' );
		$pending_actions = 0;
		if ( $as_active && function_exists( 'as_get_scheduled_actions' ) ) {
			$pending_actions = count( as_get_scheduled_actions( [ 'status' => ActionScheduler_Store::STATUS_PENDING ] ) );
		}
		$results['action_scheduler'] = [
			'status'  => $as_active ? 'healthy' : 'warning',
			'message' => $as_active ? "Action Scheduler Operational ({$pending_actions} queue items)" : 'Action Scheduler missing (fallback synchronous mode)',
		];

		// Test 2: Uploads Directory Writable
		$upload_dir = wp_upload_dir();
		$writable   = is_writable( $upload_dir['basedir'] );
		$results['vault_dir'] = [
			'status'  => $writable ? 'healthy' : 'error',
			'message' => $writable ? 'Upload Directory Writable' : 'Upload Directory Not Writable by Web Server',
		];

		wp_send_json_success( $results );
	}

	/**
	 * AJAX Handler: Save WhatsApp Settings
	 */
	public static function ajax_save_whatsapp_settings() {
		if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		if ( ! class_exists( 'Exacoat_WhatsApp_Service' ) ) {
			wp_send_json_error( [ 'message' => 'WhatsApp service engine not loaded.' ] );
		}

		$enabled           = ! empty( $_POST['enabled'] );
		$phone_number_id   = sanitize_text_field( wp_unslash( $_POST['phone_number_id'] ?? '' ) );
		$access_token      = sanitize_text_field( wp_unslash( $_POST['access_token'] ?? '' ) );
		$business_acc_id   = sanitize_text_field( wp_unslash( $_POST['business_account_id'] ?? '' ) );
		$telegram_token    = sanitize_text_field( wp_unslash( $_POST['telegram_bot_token'] ?? '' ) );
		$telegram_chat_id  = sanitize_text_field( wp_unslash( $_POST['telegram_chat_id'] ?? '' ) );
		$telegram_alerts   = ! empty( $_POST['telegram_alerts_enabled'] );

		$events = [
			'processing' => ! empty( $_POST['event_processing'] ),
			'completed'  => ! empty( $_POST['event_completed'] ),
			'smb_ready'  => ! empty( $_POST['event_smb_ready'] ),
			'smb_picked' => ! empty( $_POST['event_smb_picked'] ),
		];

		$payload = [
			'enabled'                 => $enabled,
			'phone_number_id'         => $phone_number_id,
			'access_token'            => $access_token,
			'business_account_id'     => $business_acc_id,
			'telegram_bot_token'      => $telegram_token,
			'telegram_chat_id'        => $telegram_chat_id,
			'telegram_alerts_enabled' => $telegram_alerts,
			'events'                  => $events,
		];

		Exacoat_WhatsApp_Service::update_settings( $payload );

		wp_send_json_success( [
			'message'  => 'WhatsApp service configuration saved successfully.',
			'settings' => Exacoat_WhatsApp_Service::get_settings(),
		] );
	}

	/**
	 * AJAX Handler: Dispatch WhatsApp Test Message
	 */
	public static function ajax_test_whatsapp() {
		if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		if ( ! class_exists( 'Exacoat_WhatsApp_Service' ) ) {
			wp_send_json_error( [ 'message' => 'WhatsApp service engine not loaded.' ] );
		}

		$to_phone = sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) );
		$template = sanitize_text_field( wp_unslash( $_POST['template'] ?? 'notif_order_confirmed' ) );

		if ( empty( $to_phone ) ) {
			wp_send_json_error( [ 'message' => 'Please provide a valid destination phone number.' ] );
		}

		$result = Exacoat_WhatsApp_Service::send_test_message( $to_phone, $template );

		if ( $result['success'] ) {
			wp_send_json_success( $result );
		} else {
			wp_send_json_error( $result );
		}
	}

	/**
	 * AJAX Handler: Add Tracking Numbers to Pool
	 */
	public static function ajax_add_tracking_numbers() {
		if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		if ( ! class_exists( 'Exacoat_Tracking_Pool' ) ) {
			wp_send_json_error( [ 'message' => 'Tracking pool engine not loaded.' ] );
		}

		$carrier = sanitize_text_field( wp_unslash( $_POST['carrier'] ?? '' ) );
		$numbers = sanitize_textarea_field( wp_unslash( $_POST['numbers'] ?? '' ) );

		if ( empty( $carrier ) || empty( $numbers ) ) {
			wp_send_json_error( [ 'message' => 'Carrier and tracking numbers are required.' ] );
		}

		$result = Exacoat_Tracking_Pool::add_tracking_numbers( $carrier, $numbers );

		if ( $result['success'] ) {
			wp_send_json_success( $result );
		} else {
			wp_send_json_error( $result );
		}
	}

	/**
	 * AJAX Handler: Get Live Tracking Inventory
	 */
	public static function ajax_get_tracking_inventory() {
		if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		if ( ! class_exists( 'Exacoat_Tracking_Pool' ) ) {
			wp_send_json_error( [ 'message' => 'Tracking pool engine not loaded.' ] );
		}

		$inventory = Exacoat_Tracking_Pool::get_inventory();
		wp_send_json_success( $inventory );
	}

	/**
	 * Legacy AJAX Stub
	 */
	public static function ajax_legacy_stub() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}
		wp_send_json_success( [
			'success' => true,
			'message' => 'This legacy operation has been deprecated for Exacoat.',
		] );
	}
}
}

if ( ! class_exists( 'Artmatter_Admin_Settings' ) ) {
	class_alias( 'Exacoat_Admin_Settings', 'Artmatter_Admin_Settings' );
}
