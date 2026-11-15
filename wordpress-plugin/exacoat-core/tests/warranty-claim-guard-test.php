<?php
/**
 * Standalone check for the public warranty claim guards (Exacoat_Warranty_Manager):
 * order ownership proof, per IP rate limit and the courier rate filter.
 * Run: php wordpress-plugin/exacoat-core/tests/warranty-claim-guard-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['transients'] = [];
$GLOBALS['user_id']    = 0;
$GLOBALS['is_staff']   = false;
function get_transient( $k ) { return $GLOBALS['transients'][ $k ] ?? false; }
function set_transient( $k, $v, $t ) { $GLOBALS['transients'][ $k ] = $v; return true; }
function current_user_can( $cap ) { return $GLOBALS['is_staff']; }
function get_current_user_id() { return $GLOBALS['user_id']; }
function sanitize_text_field( $t ) { return trim( strip_tags( (string) $t ) ); }
function sanitize_email( $e ) { return trim( (string) $e ); }
function wp_unslash( $v ) { return is_string( $v ) ? stripslashes( $v ) : $v; }
function apply_filters( $hook, $value ) { return $value; }
function absint( $v ) { return abs( (int) $v ); }
class Rate_Order {
	public function __call( $name, $args ) {
		return [ 'get_shipping_country' => 'ID', 'get_shipping_postcode' => '40115', 'get_shipping_city' => 'Bandung' ][ $name ] ?? '';
	}
}
function wc_get_order( $id ) { return 5 === (int) $id ? new Rate_Order() : null; }
function get_option( $k, $d = false ) { return 'woocommerce_biteship_shipping_settings' === $k ? [ 'api_key' => 'test-key' ] : $d; }
$GLOBALS['biteship_calls'] = 0;
function wp_remote_post( $url, $args ) { $GLOBALS['biteship_calls']++; return new WP_Error(); }
class WP_Error {}
function is_wp_error( $v ) { return $v instanceof WP_Error; }
function wp_remote_retrieve_body( $r ) { return ''; }
class WP_REST_Response {
	private $data;
	private $status;
	public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; }
	public function get_data() { return $this->data; }
	public function get_status() { return $this->status; }
}

class WC_Order {
	public function get_order_key() { return 'wc_order_abc123'; }
	public function get_billing_email() { return 'Ana@Example.com'; }
	public function get_customer_id() { return 42; }
	public function get_shipping_postcode() { return '40115'; }
	public function get_billing_postcode() { return '99999'; }
}
class WP_REST_Request {
	private $p = [];
	public function __construct( $p = [], $route = null ) { $this->p = is_array( $p ) ? $p : []; }
	public function get_param( $k ) { return $this->p[ $k ] ?? null; }
	public function set_param( $k, $v ) { $this->p[ $k ] = $v; }
}

require_once __DIR__ . '/../includes/class-warranty-manager.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$order = new WC_Order();
$owns  = fn( array $p ) => Exacoat_Warranty_Manager::caller_owns_order( $order, new WP_REST_Request( $p ) );
$check( $owns( [] ), false, 'no proof' );
$check( $owns( [ 'order_key' => 'wc_order_abc123' ] ), true, 'order key' );
$check( $owns( [ 'order_key' => 'wc_order_wrong' ] ), false, 'wrong order key' );
$check( $owns( [ 'billing_email' => 'ana@example.com' ] ), false, 'billing email alone is not enough' );
$check( $owns( [ 'billing_email' => 'ana@example.com', 'postcode' => '40115' ] ), true, 'billing email plus shipping postcode' );
$check( $owns( [ 'email' => 'ANA@example.com', 'shipping_postcode' => ' 40 115 ' ] ), true, 'email and postcode, any case and spacing' );
$check( $owns( [ 'billing_email' => 'ana@example.com', 'postcode' => '17142' ] ), false, 'email with the wrong postcode' );
$check( $owns( [ 'email' => 'eve@example.com', 'postcode' => '40115' ] ), false, 'other email' );
$GLOBALS['user_id'] = 42;
$check( $owns( [] ), true, 'signed-in customer of the order' );
$GLOBALS['user_id'] = 7;
$check( $owns( [] ), false, 'another signed-in customer' );

// Client IP: CF-Connecting-IP only from a Cloudflare address.
$_SERVER['REMOTE_ADDR']           = '203.0.113.50';
$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.7';
$check( Exacoat_Warranty_Manager::client_ip(), '203.0.113.50', 'spoofed CF header ignored' );
$_SERVER['REMOTE_ADDR'] = '162.158.10.1';
$check( Exacoat_Warranty_Manager::client_ip(), '198.51.100.7', 'CF header from a Cloudflare IPv4 address' );
$_SERVER['REMOTE_ADDR'] = '2606:4700:10::6816:1';
$check( Exacoat_Warranty_Manager::client_ip(), '198.51.100.7', 'CF header from a Cloudflare IPv6 address' );
$_SERVER['HTTP_CF_CONNECTING_IP'] = 'not-an-ip';
$check( Exacoat_Warranty_Manager::client_ip(), '2606:4700:10::6816:1', 'invalid CF header ignored' );
unset( $_SERVER['HTTP_CF_CONNECTING_IP'] );
$check( Exacoat_Warranty_Manager::ip_in_cidr( '104.16.5.5', '104.16.0.0/13' ), true, 'cidr match' );
$check( Exacoat_Warranty_Manager::ip_in_cidr( '104.24.0.1', '104.16.0.0/13' ), false, 'cidr miss' );

$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
$limited = [];
for ( $i = 0; $i < 4; $i++ ) {
	$limited[] = Exacoat_Warranty_Manager::public_request_limited( 'test', 3, 60 );
}
$check( $limited, [ false, false, false, true ], 'per IP limit' );
$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
$check( Exacoat_Warranty_Manager::public_request_limited( 'test', 3, 60 ), false, 'other IP not limited' );
$GLOBALS['is_staff']    = true;
$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
$check( Exacoat_Warranty_Manager::public_request_limited( 'test', 3, 60 ), false, 'staff not limited' );

$check( Exacoat_Warranty_Manager::is_courier_rate( 'flat_rate', 175000 ), true, 'paid zone rate' );
$check( Exacoat_Warranty_Manager::is_courier_rate( 'local_pickup', 0 ), false, 'local pickup skipped' );
$check( Exacoat_Warranty_Manager::is_courier_rate( 'free_shipping', 0 ), false, 'free shipping skipped' );
$check( Exacoat_Warranty_Manager::is_courier_rate( 'flat_rate', 0 ), false, 'zero cost skipped' );
$check( Exacoat_Warranty_Manager::is_courier_rate( 'flat_rate', '10000 * [qty]' ), false, 'formula cost skipped' );

// Public domestic lookups never hand out the flat fallback prices.
$GLOBALS['is_staff']    = false;
$GLOBALS['transients']  = [];
$_SERVER['REMOTE_ADDR'] = '203.0.113.77';
$lookup = function () {
	return Exacoat_Warranty_Manager::rest_get_shipping_rates( new WP_REST_Request( [ 'country' => 'ID', 'postcode' => '40115' ] ) );
};
$first = $lookup();
$check( [ $first->get_status(), $first->get_data()['code'] ?? null, $first->get_data()['message'] ?? null ], [ 503, 'shipping_rates_unavailable', Exacoat_Warranty_Manager::RATES_UNAVAILABLE_MESSAGE ], 'Biteship failure answers try later' );
$check( isset( $first->get_data()['rates'] ), false, 'no fallback rates for the public' );
$calls = $GLOBALS['biteship_calls'];
$second = $lookup();
$check( [ $second->get_status(), $GLOBALS['biteship_calls'] ], [ 503, $calls ], 'failed postcode not retried' );
$check( count( array_filter( array_keys( $GLOBALS['transients'] ), fn( $k ) => 0 === strpos( $k, 'biteship_warranty_fail_' ) ) ), 1, 'failure cached once per postcode and couriers' );

$GLOBALS['transients'] = [];
for ( $i = 0; $i < 31; $i++ ) {
	$GLOBALS['transients'] = array_filter( $GLOBALS['transients'], fn( $k ) => 0 !== strpos( $k, 'biteship_warranty_fail_' ), ARRAY_FILTER_USE_KEY );
	$last = $lookup();
}
$check( [ $last->get_status(), $GLOBALS['biteship_calls'] ], [ 503, $calls + 30 ], 'per IP limit answers try later without calling Biteship' );

$check( Exacoat_Warranty_Manager::server_rate_for_order( 5, 'jne_reg' ), [ 'unavailable' => true ], 'claim pricing refuses when rates are unavailable' );

$GLOBALS['is_staff'] = true;
$staff = $lookup()->get_data();
$check( [ $staff['is_fallback'] ?? null, $staff['rates'][0]['price'] ?? null ], [ true, 10000 ], 'staff still see fallback rates' );
$check( Exacoat_Warranty_Manager::server_rate_for_order( 5, 'jne_reg' ), [ 'unavailable' => true ], 'a fallback rate is never charged on a claim' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "warranty claim guards: all checks passed\n";
