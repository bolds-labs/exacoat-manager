<?php

define( 'ABSPATH', __DIR__ . '/' );

class WP_REST_Request {
	public function __construct( private array $params ) {}
	public function get_param( $key ) { return $this->params[ $key ] ?? null; }
	public function get_json_params() { return $this->params; }
}

class WP_Error {
	public function __construct( public string $code, string $message, public array $data ) {}
}

class OrderSaved extends RuntimeException {}

class WC_Order {
	public string $billing_email = 'old-billing@example.com';
	public string $shipping_email = 'old-shipping@example.com';
	public array $meta = [
		'_customer_email' => 'old-contact@example.com',
		'_warranty_email' => 'old-warranty@example.com',
	];

	public function get_items( $type ) { return []; }
	public function get_meta( $key ) { return $this->meta[ $key ] ?? ''; }
	public function meta_exists( $key ) { return array_key_exists( $key, $this->meta ); }
	public function update_meta_data( $key, $value ) { $this->meta[ $key ] = $value; }
	public function delete_meta_data( $key ) { unset( $this->meta[ $key ] ); }
	public function set_billing_email( $email ) { $this->billing_email = $email; }
	public function set_shipping_email( $email ) { $this->shipping_email = $email; }
	public function calculate_totals() {}
	public function save() { throw new OrderSaved(); }
}

function wc_get_order( $id ) { return $GLOBALS['updated_order']; }
function sanitize_email( $email ) { return filter_var( $email, FILTER_VALIDATE_EMAIL ) ?: ''; }
function is_email( $email ) { return filter_var( $email, FILTER_VALIDATE_EMAIL ); }

require_once __DIR__ . '/../includes/class-order-manager.php';

foreach ( [
	[ [ 'customer_email' => 'new@example.com' ], 'new@example.com' ],
	[ [ 'billing' => [ 'email' => 'billing@example.com' ] ], 'billing@example.com' ],
	[ [ 'customer_email' => 'legacy@example.com', 'billing' => [ 'email' => 'billing@example.com' ] ], 'billing@example.com' ],
	[ [ 'customer_email' => 'sales&returns@example.com' ], 'sales&returns@example.com' ],
	[ [ 'customer_email' => '' ], '' ],
] as [ $params, $expected ] ) {
	$updated_order = new WC_Order();
	try {
		Exacoat_Order_Manager::update_order( new WP_REST_Request( [ 'id' => 42 ] + $params ) );
		throw new RuntimeException( 'Email update did not reach WooCommerce save.' );
	} catch ( OrderSaved $e ) {
		foreach ( [ $updated_order->billing_email, $updated_order->shipping_email, $updated_order->get_meta( '_customer_email' ), $updated_order->get_meta( '_warranty_email' ) ] as $actual ) {
			if ( $actual !== $expected ) {
				throw new RuntimeException( "Expected the order email to be {$expected}, got {$actual}." );
			}
		}
	}
}

$updated_order = new WC_Order();
$result = Exacoat_Order_Manager::update_order( new WP_REST_Request( [ 'id' => 42, 'customer_email' => 'invalid' ] ) );
if ( ! $result instanceof WP_Error || 'invalid_customer_email' !== $result->code || 400 !== $result->data['status'] || 'old-billing@example.com' !== $updated_order->billing_email ) {
	throw new RuntimeException( 'Invalid email should be rejected before editing the order.' );
}

$address = Exacoat_Order_Manager::clean_address_data( [
	'email' => 'sales&returns@example.com',
	'company' => 'Sales&amp;Returns',
] );
if ( 'sales&returns@example.com' !== $address['email'] || 'Sales & Returns' !== $address['company'] ) {
	throw new RuntimeException( 'Address display cleanup must preserve the exact email address.' );
}

echo "Order email update tests passed.\n";
