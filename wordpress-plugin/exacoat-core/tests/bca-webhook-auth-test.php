<?php
/**
 * Standalone check: the BCA mutation webhook (which marks orders paid) needs the shared
 * webhook token and fails closed without one.
 * Run: php wordpress-plugin/exacoat-core/tests/bca-webhook-auth-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );

$GLOBALS['options'] = [];
function get_option( $k, $d = false ) { return $GLOBALS['options'][ $k ] ?? $d; }

class WP_REST_Request {
	private $p;
	private $h;
	public function __construct( array $p = [], array $h = [] ) { $this->p = $p; $this->h = $h; }
	public function get_param( $k ) { return $this->p[ $k ] ?? null; }
	public function get_header( $k ) { return $this->h[ strtolower( $k ) ] ?? null; }
}

class Fake_BCA_Order {
	private $method;
	private $currency;
	public function __construct( string $m, string $c ) { $this->method = $m; $this->currency = $c; }
	public function get_payment_method() { return $this->method; }
	public function get_currency() { return $this->currency; }
}

require_once __DIR__ . '/../includes/class-bca-payment-webhook.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$auth = fn( array $p, array $h = [] ) => Exacoat_BCA_Payment_Webhook::webhook_auth_status( new WP_REST_Request( $p, $h ) );

$check( $auth( [ 'amount' => '150023' ] ), 'not_configured', 'no token configured fails closed' );
$GLOBALS['options']['exacoat_bca_webhook_token'] = 'short';
$check( $auth( [ 'token' => 'short' ] ), 'not_configured', 'too short token is not a token' );

$token = 'bca-webhook-token-0123456789abcdef';
$GLOBALS['options']['exacoat_bca_webhook_token'] = $token;
$check( $auth( [ 'amount' => '150023' ] ), 'denied', 'missing token' );
$check( $auth( [ 'token' => 'wrong-token-0123456789abcdef0000' ] ), 'denied', 'wrong token' );
$check( $auth( [ 'token' => $token ] ), 'ok', 'token in the URL query' );
$check( $auth( [], [ 'x-exacoat-webhook-token' => $token ] ), 'ok', 'token in the header' );

// Only IDR bank transfer orders can be paid by a BCA mutation.
$check( Exacoat_BCA_Payment_Webhook::is_bca_candidate( new Fake_BCA_Order( 'bacs', 'IDR' ) ), true, 'IDR bacs order' );
$check( Exacoat_BCA_Payment_Webhook::is_bca_candidate( new Fake_BCA_Order( 'midtrans', 'IDR' ) ), false, 'Midtrans order never matched' );
$check( Exacoat_BCA_Payment_Webhook::is_bca_candidate( new Fake_BCA_Order( 'bacs', 'USD' ) ), false, 'non IDR order never matched' );
$check( Exacoat_BCA_Payment_Webhook::is_bca_candidate( new Fake_BCA_Order( 'BCA', 'idr' ) ), true, 'case insensitive' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "bca webhook auth: all checks passed\n";
