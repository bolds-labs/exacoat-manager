<?php
/**
 * Plugin Name:       Exacoat Core - Headless ERP & Commerce Bridge
 * Plugin URI:        https://exacoat.com
 * Description:       High-speed REST API bridge, custom order statuses (Ready to Ship), and headless configurator integration for Exacoat ecosystem.
 * Version:           1.0.0
 * Author:            Exacoat Engineering
 * Author URI:        https://exacoat.com
 * Text Domain:       exacoat-core
 * Domain Path:       /languages
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * WC requires at least: 6.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('EXACOAT_CORE_VERSION', '1.0.0');
define('EXACOAT_CORE_FILE', __FILE__);
define('EXACOAT_CORE_PATH', plugin_dir_path(__FILE__));
define('EXACOAT_CORE_URL', plugin_dir_url(__FILE__));

class Exacoat_Core {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', array($this, 'register_order_statuses'));
        add_filter('wc_order_statuses', array($this, 'add_order_statuses'));
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }

    /**
     * Register custom order status: wc-ready-to-ship
     */
    public function register_order_statuses() {
        register_post_status('wc-ready-to-ship', array(
            'label'                     => _x('Ready to Ship', 'Order status', 'exacoat-core'),
            'public'                    => true,
            'exclude_from_search'       => false,
            'show_in_admin_all_list'    => true,
            'show_in_admin_status_list' => true,
            'label_count'               => _n_noop('Ready to Ship <span class="count">(%s)</span>', 'Ready to Ship <span class="count">(%s)</span>', 'exacoat-core'),
        ));
    }

    /**
     * Add custom order status to WooCommerce order status list
     */
    public function add_order_statuses($order_statuses) {
        $new_order_statuses = array();

        foreach ($order_statuses as $key => $status) {
            $new_order_statuses[$key] = $status;
            if ('wc-processing' === $key) {
                $new_order_statuses['wc-ready-to-ship'] = _x('Ready to Ship', 'Order status', 'exacoat-core');
            }
        }

        return $new_order_statuses;
    }

    /**
     * Register REST API routes for Exacoat Manager
     */
    public function register_rest_routes() {
        register_rest_route('exacoat/v1', '/health', array(
            'methods'  => 'GET',
            'callback' => array($this, 'get_health'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('exacoat/v1', '/orders', array(
            'methods'  => 'GET',
            'callback' => array($this, 'get_orders_summary'),
            'permission_callback' => array($this, 'check_api_permission'),
        ));
    }

    public function check_api_permission() {
        return current_user_can('manage_woocommerce');
    }

    public function get_health() {
        return rest_ensure_response(array(
            'success' => true,
            'status'  => 'online',
            'version' => EXACOAT_CORE_VERSION,
            'wp_version' => get_bloginfo('version'),
            'wc_active'  => class_exists('WooCommerce'),
            'mkl_active' => defined('MKL_PC_VERSION'),
            'wcpa_active'=> defined('WCPA_POST_TYPE'),
            'timestamp'  => current_time('mysql'),
        ));
    }

    public function get_orders_summary($request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('wc_missing', 'WooCommerce is not active', array('status' => 500));
        }

        $args = array(
            'limit' => intval($request->get_param('limit') ?: 20),
            'status' => $request->get_param('status') ?: array('processing', 'ready-to-ship'),
            'orderby' => 'date',
            'order' => 'DESC',
        );

        $orders = wc_get_orders($args);
        $result = array();

        foreach ($orders as $order) {
            $result[] = array(
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'currency' => $order->get_currency(),
                'total' => $order->get_total(),
                'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
                'customer_name' => $order->get_formatted_billing_full_name(),
                'tracking_number' => $order->get_meta('tracking_number'),
            );
        }

        return rest_ensure_response(array(
            'success' => true,
            'orders' => $result,
        ));
    }
}

function exacoat_core_init() {
    return Exacoat_Core::get_instance();
}
add_action('plugins_loaded', 'exacoat_core_init');
