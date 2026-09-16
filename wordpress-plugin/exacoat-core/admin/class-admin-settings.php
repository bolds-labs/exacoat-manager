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
		$settings['enable_shipping_tracker'] = 1;
		return $settings;
	}

	public static function on_settings_updated( $old_value, $value ) {
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
