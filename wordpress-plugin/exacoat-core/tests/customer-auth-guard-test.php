<?php
/**
 * Standalone check for customer auth guards (Exacoat_Customer_Auth): order ownership by
 * customer id only, guest order payload without payment secrets, the per-account sign-in
 * limit and the guest order lookup limits.
 * Run: php wordpress-plugin/exacoat-core/tests/customer-auth-guard-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );

$GLOBALS['transients'] = [];
function get_transient( $k ) { return $GLOBALS['transients'][ $k ] ?? false; }
function set_transient( $k, $v, $t ) { $GLOBALS['transients'][ $k ] = $v; return true; }
function delete_transient( $k ) { unset( $GLOBALS['transients'][ $k ] ); return true; }
function apply_filters( $hook, $value ) { return $value; }

class WP_User {
	public $ID;
	public $user_email;
	public function __construct( int $id, string $email ) { $this->ID = $id; $this->user_email = $email; }
}
class WC_Order {
	private $uid;
	public function __construct( int $uid ) { $this->uid = $uid; }
	public function get_user_id() { return $this->uid; }
	public function get_customer_id() { return $this->uid; }
	public function get_billing_email() { return 'victim@example.com'; }
}

require_once __DIR__ . '/../includes/class-request-guard.php';
require_once __DIR__ . '/../includes/class-customer-auth.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

// Ownership: customer id only, never the billing email.
$attacker = new WP_User( 7, 'victim@example.com' );
$owner    = new WP_User( 42, 'owner@example.com' );
$check( Exacoat_Customer_Auth::owns_order( $owner, new WC_Order( 42 ) ), true, 'owner by customer id' );
$check( Exacoat_Customer_Auth::owns_order( $attacker, new WC_Order( 42 ) ), false, 'matching email does not own another customer order' );
$check( Exacoat_Customer_Auth::owns_order( $attacker, new WC_Order( 0 ) ), false, 'matching email does not own a guest order' );

// Guest payload: no order key, payment URL or Snap token.
$payload = [ 'id' => 5, 'orderKey' => 'wc_order_x', 'snapToken' => 't', 'snapUrl' => 'https://pay', 'viewUrl' => 'https://view', 'total' => 10.0 ];
$check( Exacoat_Customer_Auth::guest_order_payload( $payload ), [ 'id' => 5, 'orderKey' => '', 'snapToken' => '', 'snapUrl' => '', 'viewUrl' => '', 'total' => 10.0 ], 'guest payload stripped' );

// Per-account sign-in limit (10 failures per 15 minutes, any case).
$_SERVER['REMOTE_ADDR'] = '203.0.113.5';
for ( $i = 0; $i < 10; $i++ ) {
	Exacoat_Customer_Auth::record_login_failure( 'Ana@Example.com' );
}
$check( Exacoat_Customer_Auth::login_locked( 'ana@example.com' ), true, 'account locked after 10 failures' );
$check( Exacoat_Customer_Auth::login_locked( 'eve@example.com' ), false, 'other account not locked' );
Exacoat_Customer_Auth::clear_login_failures( 'ana@example.com' );
$check( Exacoat_Customer_Auth::login_locked( 'ana@example.com' ), false, 'cleared after success' );

// Guest order lookups: per order failures and per IP.
for ( $i = 0; $i < 10; $i++ ) {
	Exacoat_Customer_Auth::record_guest_lookup_failure( 900 );
}
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 900 ), true, 'order locked after 10 failed lookups' );
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 901 ), false, 'other order open' );
$blocked = false;
for ( $i = 0; $i < 61; $i++ ) {
	$blocked = Exacoat_Customer_Auth::guest_lookup_blocked( 1000 + $i );
}
$check( $blocked, true, 'per IP limit after 60 lookups' );
$_SERVER['REMOTE_ADDR'] = '203.0.113.6';
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 2000 ), false, 'other IP open' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "customer auth guards: all checks passed\n";
