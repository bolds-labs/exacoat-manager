<?php

define( 'ABSPATH', __DIR__ . '/' );

class WP_REST_Request {
	public function __construct( private array $params ) {}
	public function get_param( string $key ) { return $this->params[ $key ] ?? null; }
	public function get_route(): string { return '/exacoat-core/v1/warranty/manual-replacement'; }
}

class WP_REST_Response {
	public function __construct( public array $data, public int $status ) {}
}

class WP_Query {
	public array $posts = [];
}

class WC_Order_Item_Shipping {
	public float $total;
	public function set_method_title( $title ): void {}
	public function set_method_id( $method ): void {}
	public function set_total( $total ): void { $this->total = $total; }
}

class ReplacementOrderFixture {
	public $status;
	public $customer_note;
	public array $meta = [];
	public array $notes = [];
	public array $item = [];
	public array $prices = [];
	public float $shipping = 0;
	public bool $calculate_tax = true;
	public function set_address( $address, $type ): void {}
	public function add_product( $product, $quantity, $prices ): int { $this->prices = $prices; return 1; }
	public function get_item( $id ): self { return $this; }
	public function add_meta_data( $key, $value, $unique ): void { $this->item[ $key ] = $value; }
	public function add_item( $item ): void { $this->shipping = $item->total; }
	public function set_currency( $currency ): void {}
	public function calculate_totals( $tax ): void { $this->calculate_tax = $tax; }
	public function get_id(): int { return 42; }
	public function get_order_number(): string { return '42'; }
	public function update_meta_data( $key, $value ): void { $this->meta[ $key ] = $value; }
	public function set_status( $status ): void { $this->status = $status; }
	public function save(): void {}
	public function add_order_note( $notes ): void { $this->notes[] = $notes; }
}

function sanitize_text_field( $v ) { return trim( $v ); }
function sanitize_textarea_field( $v ) { return trim( $v ); }
function sanitize_email( $v ) { return trim( $v ); }
function is_wp_error( $v ) { return false; }
function absint( $v ) { return abs( (int) $v ); }
function wc_get_product( $id ) { return (object) [ 'id' => $id ]; }
function wc_get_order( $id ) { return null; }
function wc_create_order( $params ) {
	$order = new ReplacementOrderFixture();
	$order->status = $params['status'];
	$order->customer_note = $params['customer_note'];
	$GLOBALS['replacement_fixture'] = $order;
	return $order;
}

$wpdb = new class {
	public string $prefix = 'wp_';
	public array $queries = [];
	public function prepare( $query, $value ) { return $query; }
	public function get_var( $query ) { $this->queries[] = $query; return '1'; }
};

require_once __DIR__ . '/../includes/class-warranty-manager.php';

$params = [
	'source_type' => 'marketplace', 'rma_type' => 'Warranty', 'initial_status' => 'processing',
	'channel' => 'Shopee', 'marketplace_invoice' => 'TEST-1', 'customer_name' => 'Example Customer',
	'customer_phone' => '0000000000', 'customer_email' => 'customer@example.com',
	'items' => [ [ 'product_id' => 7, 'configuration' => 'Back: Swarm' ] ],
	'courier_id' => 'jne_reg', 'courier_label' => 'JNE - REG',
	'shipping_cost' => 14000, 'actual_shipping_cost' => 99000, 'notes' => 'Internal note fixture',
];
$rejected = Exacoat_Warranty_Manager::rest_create_manual_claim( new WP_REST_Request( array_merge( $params, [ 'waive_shipping' => true ] ) ) );
if ( 400 !== $rejected->status || isset( $GLOBALS['replacement_fixture'] ) ) {
	throw new RuntimeException( 'Customer-paid replacement must reject a waived shipping fee.' );
}

$result = Exacoat_Warranty_Manager::rest_create_manual_claim( new WP_REST_Request( $params ) );
if ( 200 !== $result->status ) {
	throw new RuntimeException( $result->data['message'] );
}
$order = $GLOBALS['replacement_fixture'];
if ( 'on-hold' !== $order->status || 14000.0 !== $order->shipping || $order->calculate_tax ||
	[ 'subtotal' => 0, 'total' => 0 ] !== $order->prices || 'REPLACEMENT' !== $order->meta['_order_badge'] ||
	isset( $order->meta['_rma_order_type'] ) || isset( $order->item['_is_warranty'] ) ||
	'' !== $order->customer_note || ! str_contains( implode( "\n", $order->notes ), 'Internal note fixture' ) ||
	! in_array( 'SELECT RELEASE_LOCK(%s)', $wpdb->queries, true ) ) {
	throw new RuntimeException( 'Customer-paid replacement did not preserve payment, pricing, classification, or notes.' );
}

echo "manual customer-paid replacement: all checks passed\n";
