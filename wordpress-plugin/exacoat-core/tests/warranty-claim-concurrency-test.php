<?php

define( 'ABSPATH', __DIR__ . '/' );

class WP_REST_Request {
	public function __construct( private array $params = [] ) {}
	public function get_param( $key ) { return $this->params[ $key ] ?? null; }
	public function get_route() { return '/exacoat-core/v1/warranty/manual-claim'; }
}
class WP_REST_Response {
	public function __construct( public array $data, public int $status ) {}
}
class WP_Error {
	public function __construct( public string $code, public string $message, public array $data ) {}
}
class WC_Order {
	public function __construct( private array $meta ) {}
	public function get_meta( $key ) { return $this->meta[ $key ] ?? ''; }
	public function get_status() { return 'on-hold'; }
	public function get_id() { return 65; }
	public function get_order_number() { return '65'; }
	public function get_date_created() { return null; }
}
class WP_Query {
	public array $posts;
	public function __construct( $args ) {
		$this->posts = [];
		foreach ( $args['meta_query'] as $meta ) {
			if ( is_array( $meta ) && '_rma_original_invoice' === $meta['key'] &&
				in_array( 'wc-quality-check', $args['post_status'], true ) &&
				in_array( '#AB123', array_map( 'strtoupper', (array) $meta['value'] ), true ) &&
				$GLOBALS['active_claim'] ) {
				$this->posts = [ 65 ];
			}
		}
	}
}

function wc_get_order( $id ) { return new WC_Order( [] ); }
function wc_get_orders() { return []; }
function sanitize_text_field( $value ) { return trim( $value ); }
function sanitize_textarea_field( $value ) { return trim( $value ); }
function sanitize_email( $value ) { return trim( $value ); }

$wpdb = new class {
	public string $prefix = 'wp_';
	public array $locks = [];
	public function prepare( $query, $key ) { return [ $query, $key ]; }
	public function get_var( $statement ) {
		[ $query, $key ] = $statement;
		if ( str_contains( $query, 'RELEASE_LOCK' ) ) {
			unset( $this->locks[ $key ] );
			return '1';
		}
		if ( isset( $this->locks[ $key ] ) ) {
			return '0';
		}
		$this->locks[ $key ] = true;
		return '1';
	}
};

require_once __DIR__ . '/../includes/class-warranty-manager.php';

function expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$active_claim = false;
$first = new WP_REST_Request();
$retry = new WP_REST_Request();
$order = new WC_Order( [ '_is_warranty_claim' => 'yes', '_rma_original_invoice' => 'AB123' ] );
$same_purchase = new WC_Order( [ '_is_warranty_claim' => 'yes', '_rma_original_invoice' => ' #ab123 ' ] );
$manual = new WP_REST_Request( [
	'rma_type' => 'Warranty',
	'source_type' => 'marketplace',
	'marketplace_invoice' => 'ab123',
	'channel' => 'Shopee',
	'allow_duplicate' => true,
] );

expect( $order === Exacoat_Warranty_Manager::guard_rest_claim_creation( $order, $first, true ), 'The first creation should reserve the purchase.' );
$busy = Exacoat_Warranty_Manager::guard_rest_claim_creation( $same_purchase, $retry, true );
expect( $busy instanceof WP_Error && 'warranty_claim_in_progress' === $busy->code, 'Concurrent creation should fail even with a case or # variation.' );
$manual_busy = Exacoat_Warranty_Manager::rest_create_manual_claim( $manual );
expect( 409 === $manual_busy->status && str_contains( $manual_busy->data['message'], 'already being created' ), 'Staff and WooCommerce creation must acquire the same purchase lock.' );

$active_claim = true;
$response = new stdClass();
expect( $response === Exacoat_Warranty_Manager::release_rest_claim_lock( $response, [], $first ), 'Releasing the lock should preserve the controller response.' );
$duplicate = Exacoat_Warranty_Manager::guard_rest_claim_creation( $same_purchase, $retry, true );
expect( $duplicate instanceof WP_Error && 'warranty_already_claimed' === $duplicate->code && [] === $wpdb->locks, 'A retry should detect the persisted order and release its lock.' );
$manual_duplicate = Exacoat_Warranty_Manager::rest_create_manual_claim( $manual );
expect( 409 === $manual_duplicate->status && str_contains( $manual_duplicate->data['message'], '#65' ), 'Staff Warranty requests must enforce the existing claim even when an override is posted.' );

$active_claim = false;
expect( $same_purchase === Exacoat_Warranty_Manager::guard_rest_claim_creation( $same_purchase, $retry, true ), 'A purchase without an active claim should be eligible again.' );
Exacoat_Warranty_Manager::release_rest_claim_lock( new WP_Error( 'save_failed', '', [] ), [], $retry );
expect( [] === $wpdb->locks, 'Failed controller responses should also release the lock.' );

$unverified = new WC_Order( [ '_is_warranty_claim' => 'yes', '_rma_unverified_marketplace_ref' => 'AB123' ] );
expect( $unverified === Exacoat_Warranty_Manager::guard_rest_claim_creation( $unverified, $first, true ) && [] === $wpdb->locks, 'Unverified intake remains a review request.' );
expect( $order === Exacoat_Warranty_Manager::guard_rest_claim_creation( $order, $first, false ) && [] === $wpdb->locks, 'Updates should leave the creation lock untouched.' );

echo "warranty claim concurrency: all checks passed\n";
