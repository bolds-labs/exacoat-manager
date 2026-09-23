<?php
/**
 * Plugin Name:       Exacoat Core Platform
 * Plugin URI:        https://exacoat.com
 * Description:       Proprietary e-commerce core engine, configurator manager, and ERP workstation integration for Exacoat.
 * Version:           0.1.38
 * Author:            Exacoat
 * Author URI:        https://exacoat.com
 * License:           Proprietary
 * Text Domain:       exacoat-core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'EXACOAT_CORE_VERSION' ) ) {
	define( 'EXACOAT_CORE_VERSION', '0.1.38' );
}
if ( ! defined( 'EXACOAT_CORE_FILE' ) ) {
	define( 'EXACOAT_CORE_FILE', __FILE__ );
}
if ( ! defined( 'EXACOAT_CORE_PATH' ) ) {
	define( 'EXACOAT_CORE_PATH', plugin_dir_path( __FILE__ ) );
}
if ( ! defined( 'EXACOAT_CORE_URL' ) ) {
	define( 'EXACOAT_CORE_URL', plugin_dir_url( __FILE__ ) );
}
if ( ! defined( 'EXACOAT_WEB_URL' ) ) {
	define( 'EXACOAT_WEB_URL', getenv( 'EXACOAT_WEB_URL' ) ?: 'https://exacoat.com' );
}
if ( ! defined( 'EXACOAT_MEDIA_URL' ) ) {
	define( 'EXACOAT_MEDIA_URL', getenv( 'EXACOAT_MEDIA_URL' ) ?: 'https://exacoat.com' );
}

// Safety Fallbacks for legacy/forked constant references to prevent fatal undefined constant crashes
if ( ! defined( 'ARTMATTER_CORE_VERSION' ) ) {
	define( 'ARTMATTER_CORE_VERSION', EXACOAT_CORE_VERSION );
}
if ( ! defined( 'ARTMATTER_CORE_FILE' ) ) {
	define( 'ARTMATTER_CORE_FILE', EXACOAT_CORE_FILE );
}
if ( ! defined( 'ARTMATTER_CORE_PATH' ) ) {
	define( 'ARTMATTER_CORE_PATH', EXACOAT_CORE_PATH );
}
if ( ! defined( 'ARTMATTER_CORE_URL' ) ) {
	define( 'ARTMATTER_CORE_URL', EXACOAT_CORE_URL );
}
if ( ! defined( 'ARTMATTER_WEB_URL' ) ) {
	define( 'ARTMATTER_WEB_URL', EXACOAT_WEB_URL );
}
if ( ! defined( 'ARTMATTER_MEDIA_URL' ) ) {
	define( 'ARTMATTER_MEDIA_URL', EXACOAT_MEDIA_URL );
}

// Authenticate WooCommerce API keys across custom REST endpoints before WordPress Application Passwords (prio 20) triggers invalid_username
add_filter( 'determine_current_user', function( $user ) {
	if ( $user ) {
		return $user;
	}
	$key = '';
	if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) && preg_match( '/^Basic\s+(.+)$/i', $_SERVER['HTTP_AUTHORIZATION'], $m ) ) {
		$decoded = base64_decode( $m[1] );
		if ( strpos( $decoded, ':' ) !== false ) {
			list( $k, $s ) = explode( ':', $decoded, 2 );
			if ( strpos( $k, 'ck_' ) === 0 ) {
				$key = $k;
			}
		}
	}
	if ( ! $key && ! empty( $_GET['consumer_key'] ) ) {
		$key = sanitize_text_field( wp_unslash( $_GET['consumer_key'] ) );
	}
	if ( $key ) {
		global $wpdb;
		$hash = function_exists( 'wc_api_hash' ) ? wc_api_hash( $key ) : hash_hmac( 'sha256', $key, 'wc-api' );
		$user_id = $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$wpdb->prefix}woocommerce_api_keys WHERE consumer_key = %s OR truncated_key = %s LIMIT 1",
			$hash,
			substr( $key, -7 )
		) );
		if ( $user_id ) {
			return (int) $user_id;
		}
	}
	return $user;
}, 10 );

// Ensure sufficient PHP memory for high-resolution product image processing, thumbnail regeneration, and Bricks asset compiling
if ( function_exists( 'ini_set' ) ) {
	@ini_set( 'memory_limit', '1024M' );
}

add_filter( 'image_memory_limit', function() {
	return '1024M';
}, 999 );

add_filter( 'admin_memory_limit', function() {
	return '1024M';
}, 999 );

add_action( 'init', function() {
	if ( function_exists( 'ini_set' ) ) {
		@ini_set( 'memory_limit', '1024M' );
	}
}, -999 );

add_action( 'template_redirect', function() {
	if ( function_exists( 'ini_set' ) ) {
		@ini_set( 'memory_limit', '1024M' );
	}
}, -999 );


if ( ! function_exists( 'exacoat_storefront_url' ) ) {
	function exacoat_storefront_url( string $path = '/' ): string {
		$base = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : getenv( 'EXACOAT_WEB_URL' );
		return untrailingslashit( $base ?: 'https://exacoat.com' ) . '/' . ltrim( $path, '/' );
	}
}

if ( ! function_exists( 'exacoat_media_url' ) ) {
	function exacoat_media_url( string $url ): string {
		if ( empty( $url ) || strpos( $url, '/wp-content/uploads/' ) === false ) {
			return $url;
		}
		if ( preg_match( '#/wp-content/uploads/Assets/(.+)$#i', $url, $m ) ) {
			$clean = ltrim( parse_url( $m[1], PHP_URL_PATH ) ?: $m[1], '/' );
			if ( function_exists( 'wp_upload_dir' ) ) {
				$upload_dir = wp_upload_dir();
				$basedir    = function_exists( 'wp_normalize_path' ) ? wp_normalize_path( $upload_dir['basedir'] ) : str_replace( '\\', '/', $upload_dir['basedir'] );
				if ( ! file_exists( $basedir . '/Assets/' . $clean ) ) {
					$filename = function_exists( 'wp_basename' ) ? wp_basename( $clean ) : basename( $clean );
					if ( file_exists( $basedir . '/' . $filename ) ) {
						return trailingslashit( $upload_dir['baseurl'] ) . $filename;
					}
				}
			}
		}
		return $url;
	}
}

if ( ! function_exists( 'exacoat_media_urls_in_text' ) ) {
	function exacoat_media_urls_in_text( string $value ): string {
		if ( empty( $value ) || strpos( $value, '/wp-content/uploads/Assets/' ) === false ) {
			return $value;
		}
		return preg_replace_callback(
			'#https?://[^"\'\s]+/wp-content/uploads/Assets/[^"\'\s]+#i',
			function ( $matches ) {
				return exacoat_media_url( $matches[0] );
			},
			$value
		);
	}
}

add_filter( 'rest_post_dispatch', function( $response ) {
	if ( ! $response instanceof WP_REST_Response ) {
		return $response;
	}

	$data = $response->get_data();

	// Enrich Store API order/checkout responses with shipping method and accurate shipping total
	if ( is_array( $data ) && isset( $data['id'], $data['totals'] ) && function_exists( 'wc_get_order' ) ) {
		$order = wc_get_order( (int) $data['id'] );
		if ( $order instanceof WC_Order ) {
			$data['shipping_method'] = $order->get_shipping_method();
			$data['shipping_total']  = (float) $order->get_shipping_total();
			$data['payment_method']  = $order->get_payment_method_title() ?: ( $data['payment_method'] ?? '' );
		}
	}

	$response->set_data( $data );
	return $response;
}, 1000 );

// Rewrite product permalinks to the headless storefront only when headless links are explicitly requested.
add_filter( 'post_type_link', function( $url, $post ) {
	if ( $post instanceof WP_Post && 'product' === $post->post_type ) {
		if ( defined( 'EXACOAT_ENABLE_HEADLESS_LINKS' ) && EXACOAT_ENABLE_HEADLESS_LINKS ) {
			return exacoat_storefront_url( 'products/' . rawurlencode( $post->post_name ) );
		}
	}
	return $url;
}, 1000, 2 );

// Keep the CMS out of search results if configured
add_action( 'send_headers', function() {
	if ( ! is_admin() && ! wp_is_json_request() && ( defined( 'EXACOAT_NOINDEX' ) && EXACOAT_NOINDEX ) ) {
		header( 'X-Robots-Tag: noindex, nofollow', true );
	}
}, 20 );

// Global Safe Fallbacks for ACF Functions (Guarantees 100% independence from ACF plugin)
if ( ! function_exists( 'get_field' ) ) {
	function get_field( $selector, $post_id = false, $format_value = true ) {
		if ( ! $post_id ) {
			$post_id = get_the_ID();
		}
		if ( is_string( $post_id ) ) {
			if ( strpos( $post_id, 'term_' ) === 0 ) {
				return get_term_meta( (int) substr( $post_id, 5 ), $selector, true );
			}
			if ( strpos( $post_id, 'user_' ) === 0 ) {
				return get_user_meta( (int) substr( $post_id, 5 ), $selector, true );
			}
			if ( preg_match( '/^.+_(\d+)$/', $post_id, $m ) ) {
				return get_term_meta( (int) $m[1], $selector, true ) ?: get_post_meta( (int) $m[1], $selector, true );
			}
		}
		if ( is_numeric( $post_id ) ) {
			return get_post_meta( (int) $post_id, $selector, true );
		}
		if ( is_object( $post_id ) && method_exists( $post_id, 'get_meta' ) ) {
			return $post_id->get_meta( $selector ) ?: $post_id->get_meta( '_' . $selector );
		}
		return '';
	}
}

if ( ! function_exists( 'update_field' ) ) {
	function update_field( $selector, $value, $post_id = false ) {
		if ( ! $post_id ) {
			$post_id = get_the_ID();
		}
		if ( is_string( $post_id ) ) {
			if ( strpos( $post_id, 'term_' ) === 0 ) {
				return update_term_meta( (int) substr( $post_id, 5 ), $selector, $value );
			}
			if ( strpos( $post_id, 'user_' ) === 0 ) {
				return update_user_meta( (int) substr( $post_id, 5 ), $selector, $value );
			}
			if ( preg_match( '/^.+_(\d+)$/', $post_id, $m ) ) {
				return update_term_meta( (int) $m[1], $selector, $value );
			}
		}
		if ( is_numeric( $post_id ) ) {
			return update_post_meta( (int) $post_id, $selector, $value );
		}
		if ( is_object( $post_id ) && method_exists( $post_id, 'update_meta_data' ) ) {
			$post_id->update_meta_data( $selector, $value );
			if ( method_exists( $post_id, 'save' ) ) {
				$post_id->save();
			}
			return true;
		}
		return false;
	}
}

if ( ! function_exists( 'delete_field' ) ) {
	function delete_field( $selector, $post_id = false ) {
		if ( ! $post_id ) {
			$post_id = get_the_ID();
		}
		if ( is_string( $post_id ) ) {
			if ( strpos( $post_id, 'term_' ) === 0 ) {
				return delete_term_meta( (int) substr( $post_id, 5 ), $selector );
			}
			if ( strpos( $post_id, 'user_' ) === 0 ) {
				return delete_user_meta( (int) substr( $post_id, 5 ), $selector );
			}
		}
		if ( is_numeric( $post_id ) ) {
			return delete_post_meta( (int) $post_id, $selector );
		}
		return false;
	}
}

if ( ! function_exists( 'get_field_object' ) ) {
	function get_field_object( $selector, $post_id = false, $format_value = true, $load_value = true ) {
		$val = get_field( $selector, $post_id, $format_value );
		return [
			'key'   => $selector,
			'name'  => $selector,
			'label' => ucwords( str_replace( [ '_', '-' ], ' ', $selector ) ),
			'value' => $val,
		];
	}
}

if ( ! function_exists( 'have_rows' ) ) {
	function have_rows( $selector, $post_id = false ) {
		return false;
	}
}

if ( ! function_exists( 'the_row' ) ) {
	function the_row() {
		return false;
	}
}

if ( ! function_exists( 'get_sub_field' ) ) {
	function get_sub_field( $selector, $format_value = true ) {
		return '';
	}
}

require_once EXACOAT_CORE_PATH . 'includes/class-logger.php';
require_once EXACOAT_CORE_PATH . 'includes/class-pushover-service.php';
require_once EXACOAT_CORE_PATH . 'includes/class-exacoat-core.php';
require_once EXACOAT_CORE_PATH . 'includes/class-shipping-tracker.php';
require_once EXACOAT_CORE_PATH . 'includes/class-biteship-shipping.php';
require_once EXACOAT_CORE_PATH . 'includes/class-store-enhancements.php';
require_once EXACOAT_CORE_PATH . 'includes/class-diagnostics.php';
require_once EXACOAT_CORE_PATH . 'includes/class-performance-auditor.php';
require_once EXACOAT_CORE_PATH . 'includes/class-email-engine.php';
require_once EXACOAT_CORE_PATH . 'includes/class-order-manager.php';
require_once EXACOAT_CORE_PATH . 'includes/class-checkout-engine.php';
require_once EXACOAT_CORE_PATH . 'includes/class-customer-auth.php';
require_once EXACOAT_CORE_PATH . 'includes/class-review-manager.php';
require_once EXACOAT_CORE_PATH . 'includes/class-pages-controller.php';
require_once EXACOAT_CORE_PATH . 'includes/class-configurator-engine.php';
require_once EXACOAT_CORE_PATH . 'includes/class-image-sizes.php';
require_once EXACOAT_CORE_PATH . 'includes/class-export-manager.php';
require_once EXACOAT_CORE_PATH . 'includes/class-bca-payment-webhook.php';
require_once EXACOAT_CORE_PATH . 'includes/class-tracking-pool.php';
require_once EXACOAT_CORE_PATH . 'includes/class-whatsapp-service.php';
require_once EXACOAT_CORE_PATH . 'includes/class-warranty-manager.php';
require_once EXACOAT_CORE_PATH . 'includes/class-guarantee-manager.php';
require_once EXACOAT_CORE_PATH . 'includes/class-shopee-client.php';
require_once EXACOAT_CORE_PATH . 'includes/class-tiktok-client.php';
require_once EXACOAT_CORE_PATH . 'includes/class-webhook-dispatcher.php';
require_once EXACOAT_CORE_PATH . 'admin/class-admin-settings.php';
require_once EXACOAT_CORE_PATH . 'admin/class-github-updater.php';

// Initialize Headless Pages REST Controller
if ( class_exists( 'Exacoat_Pages_Controller' ) ) {
	Exacoat_Pages_Controller::init();
}

// Initialize Custom Image Sizes & Media Derivative Engine
if ( class_exists( 'Exacoat_Image_Sizes' ) ) {
	Exacoat_Image_Sizes::init();
}

// Initialize Logistics Export Manager (JNE & Goorita)
if ( class_exists( 'Exacoat_Export_Manager' ) ) {
	Exacoat_Export_Manager::init();
}

// Initialize BCA Automated Payment Webhook & Unique Code Engine
if ( class_exists( 'Exacoat_BCA_Payment_Webhook' ) ) {
	Exacoat_BCA_Payment_Webhook::init();
}

// Initialize Automated Tracking Pool Dispenser Engine
if ( class_exists( 'Exacoat_Tracking_Pool' ) ) {
	Exacoat_Tracking_Pool::init();
}

// Initialize Automated WhatsApp Notification Engine
if ( class_exists( 'Exacoat_WhatsApp_Service' ) ) {
	Exacoat_WhatsApp_Service::init();
}

// Initialize 48-Hour Installation Warranty & RMA Engine
if ( class_exists( 'Exacoat_Warranty_Manager' ) ) {
	Exacoat_Warranty_Manager::init();
}

// Initialize 30-Day Money Back Guarantee Manager
if ( class_exists( 'Exacoat_Guarantee_Manager' ) ) {
	Exacoat_Guarantee_Manager::init();
}

// Initialize Shopee Open Platform API v2 Engine
if ( class_exists( 'Exacoat_Shopee_Client' ) ) {
	Exacoat_Shopee_Client::init();
}

// Initialize TikTok Shop Open Platform Engine
if ( class_exists( 'Exacoat_TikTok_Client' ) ) {
	Exacoat_TikTok_Client::init();
}

// Initialize Review & Customer Feedback Manager
if ( class_exists( 'Exacoat_Review_Manager' ) ) {
	Exacoat_Review_Manager::init();
}

// Safe version tracking on admin_init
add_action( 'admin_init', function () {
	try {
		$installed_ver = get_option( 'exacoat_core_installed_version' ) ?: get_option( 'artmatter_core_installed_version' );
		if ( $installed_ver !== EXACOAT_CORE_VERSION ) {
			update_option( 'exacoat_core_installed_version', EXACOAT_CORE_VERSION );
			delete_transient( 'exacoat_core_remote_version_manifest' );
			delete_transient( 'artmatter_core_remote_version_manifest' );
			delete_site_transient( 'update_plugins' );
		}
	} catch ( \Throwable $e ) {
		// Suppress any non-critical upgrade notice
	}
} );

/**
 * Plugin Activation Hook
 */
register_activation_hook( __FILE__, function () {
	try {
		// 1. Initialize default plugin options
		if ( ! get_option( 'exacoat_core_settings' ) ) {
			$legacy_settings = get_option( 'artmatter_core_settings' );
			$default_settings = is_array( $legacy_settings ) ? $legacy_settings : [
				'enable_shipping_tracker' => 1,
				'enable_review_manager'   => 1,
				'enable_order_manager'    => 1,
				'webhook_secret'          => 'EXA_SECRET_' . wp_generate_password( 24, false ),
			];
			update_option( 'exacoat_core_settings', $default_settings );
		}

		// 2. Create Reviews table if not exists
		if ( class_exists( 'Exacoat_Review_Manager' ) ) {
			Exacoat_Review_Manager::create_tables();
		}

		// 3. Flush rewrite rules
		flush_rewrite_rules();
	} catch ( \Throwable $e ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'Exacoat Core activation warning: ' . $e->getMessage() );
		}
	}
} );

/**
 * Plugin Deactivation Hook
 */
register_deactivation_hook( __FILE__, function () {
	try {
		flush_rewrite_rules();
	} catch ( \Throwable $e ) {
		// Suppress deactivation exceptions
	}
} );

/**
 * Initialize Exacoat Automatic Updater & REST Webhook
 */
if ( class_exists( 'Exacoat_Plugin_Updater' ) ) {
	new Exacoat_Plugin_Updater(
		EXACOAT_CORE_FILE,
		'bolds-labs',
		'exacoat-manager',
		EXACOAT_CORE_VERSION
	);
}

/**
 * Launch Main Engine
 */
if ( ! function_exists( 'exacoat_core' ) ) {
	function exacoat_core() {
		if ( class_exists( 'Exacoat_Core' ) ) {
			return Exacoat_Core::instance();
		}
		return null;
	}
}

try {
	exacoat_core();
} catch ( \Throwable $e ) {
	if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
		error_log( 'Exacoat Core launch warning: ' . $e->getMessage() );
	}
}
