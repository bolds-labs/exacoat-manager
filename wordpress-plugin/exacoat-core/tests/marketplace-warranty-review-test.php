<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );

class WP_REST_Request {
	public function __construct( private array $params = [] ) {}
	public function get_param( $name ) { return $this->params[ $name ] ?? null; }
	public function get_header( $name ) { return ''; }
}

class WP_REST_Response {
	public function __construct( public array $data, public int $status ) {}
}

class WC_Data_Exception extends RuntimeException {
	public function __construct( $code, $message, $status ) { parent::__construct( $message, $status ); }
}

class WC_Order {
	public string $status = 'on-hold';
	public bool $verified = false;
	public function get_status(): string { return $this->status; }
	public function get_meta( $key ) {
		return [
			'_rma_unverified_marketplace_ref' => '261116DXKUFTP6',
			'_rma_marketplace_verified_at'    => $this->verified ? '2026-11-19 10:00:00' : '',
		][ $key ] ?? '';
	}
}

function absint( $id ): int { return abs( (int) $id ); }
function wc_get_order( $id ) { return $GLOBALS['review_order']; }
function current_user_can( $cap ): bool { return $GLOBALS['can_review'] && 'manage_woocommerce' === $cap; }
function get_option( $key, $default ) { return $GLOBALS['marketplace_cache'][ $key ] ?? $default; }

class Exacoat_Request_Guard {
	public static function client_ip(): string { return '192.0.2.1'; }
	public static function hit( $bucket, $subject, $limit, $window ): bool { return $GLOBALS['mask_limited']; }
}

require_once __DIR__ . '/../includes/class-warranty-manager.php';
require_once __DIR__ . '/../includes/class-shopee-client.php';
require_once __DIR__ . '/../includes/class-tiktok-client.php';

$mask_limited = false;
$marketplace_cache = [
	Exacoat_Shopee_Client::ORDERS_CACHE_KEY => [
		[ 'order_sn' => '261116DXKUFTP6', 'recipient_phone' => '08 ***-****12' ],
		[ 'order_sn' => '261116DXKUFTP7', 'recipient_phone' => '***12' ],
		[ 'order_sn' => '261116DXKUFTP8', 'recipient_phone' => '08123456712' ],
	],
	Exacoat_TikTok_Client::ORDERS_CACHE_KEY => [
		[ 'order_id' => '572200045606622301', 'recipient_phone' => '+62 (•••) ••••12' ],
	],
];
$mask_cases = [
	[ 'shopee', '261116dxkuftp6', '12', 11 ],
	[ 'tiktok_tokopedia', '572200045606622301', '12', 11 ],
	[ 'shopee', '261116DXKUFTP6', '21', 12 ],
	[ 'shopee', '261116DXKUFTP7', '12', 12 ],
	[ 'shopee', '261116DXKUFTP8', '12', 12 ],
	[ 'shopee', '261116DXKUFTP9', '12', 12 ],
	[ 'tiktok_tokopedia', 'INV/20261119/MPL/123', '12', 12 ],
];
foreach ( $mask_cases as [ $channel, $reference, $suffix, $length ] ) {
	$response = Exacoat_Warranty_Manager::rest_marketplace_phone_mask( new WP_REST_Request( [
		'channel' => $channel, 'order_id' => $reference, 'suffix' => $suffix,
	] ) );
	if ( 200 !== $response->status || [ 'phone_length' => $length ] !== $response->data ) {
		throw new RuntimeException( "Wrong mask response for {$channel} {$reference}." );
	}
}
$mask_limited = true;
$response = Exacoat_Warranty_Manager::rest_marketplace_phone_mask( new WP_REST_Request( [
	'channel' => 'shopee', 'order_id' => '261116DXKUFTP6', 'suffix' => '12',
] ) );
if ( [ 'phone_length' => 12 ] !== $response->data ) {
	throw new RuntimeException( 'The rate limited mask request must return the default length.' );
}

$can_review = false;
$review_order = new WC_Order();
if ( Exacoat_Warranty_Manager::check_admin_permission( new WP_REST_Request() ) ) {
	throw new RuntimeException( 'Anonymous users must not be able to review warranty orders.' );
}
$can_review = true;
if ( ! Exacoat_Warranty_Manager::check_admin_permission( new WP_REST_Request() ) ) {
	throw new RuntimeException( 'WooCommerce managers must retain review access.' );
}
$result = Exacoat_Warranty_Manager::rest_review_claim( new WP_REST_Request( [ 'order_id' => 42, 'action' => 'approve' ] ) );
if ( 400 !== $result->status ) {
	throw new RuntimeException( 'Marketplace purchase verification is required to approve.' );
}

Exacoat_Warranty_Manager::hold_unverified_marketplace_claim( $review_order );
if ( Exacoat_Warranty_Manager::marketplace_review_payment_allowed( true, $review_order ) ) {
	throw new RuntimeException( 'An unverified marketplace request can be paid.' );
}
$review_order->status = 'processing';
try {
	Exacoat_Warranty_Manager::hold_unverified_marketplace_claim( $review_order );
	throw new RuntimeException( 'A generic order status update bypassed marketplace purchase review.' );
} catch ( WC_Data_Exception $expected ) {
}
$review_order->verified = true;
Exacoat_Warranty_Manager::hold_unverified_marketplace_claim( $review_order );
echo "marketplace warranty review: all checks passed\n";
