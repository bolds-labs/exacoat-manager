<?php
/**
 * Standalone check for the public warranty claim guards (Exacoat_Warranty_Manager):
 * order ownership proof, per IP rate limit and the courier rate filter.
 * Run: php wordpress-plugin/exacoat-core/tests/warranty-claim-guard-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'MINUTE_IN_SECONDS', 60 );

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

class WC_Order {
	public function get_order_key() { return 'wc_order_abc123'; }
	public function get_billing_email() { return 'Ana@Example.com'; }
	public function get_customer_id() { return 42; }
}
class WP_REST_Request {
	private $p;
	public function __construct( array $p ) { $this->p = $p; }
	public function get_param( $k ) { return $this->p[ $k ] ?? null; }
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
$check( $owns( [ 'billing_email' => 'ana@example.com' ] ), true, 'billing email, any case' );
$check( $owns( [ 'email' => 'eve@example.com' ] ), false, 'other email' );
$GLOBALS['user_id'] = 42;
$check( $owns( [] ), true, 'signed-in customer of the order' );
$GLOBALS['user_id'] = 7;
$check( $owns( [] ), false, 'another signed-in customer' );

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

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "warranty claim guards: all checks passed\n";
