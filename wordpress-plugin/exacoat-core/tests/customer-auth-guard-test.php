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

// Sign-in: the lock counts failures per email and client IP, so another IP cannot lock the owner.
Exacoat_Customer_Auth::$login_slow_seconds = 0;
$_SERVER['REMOTE_ADDR'] = '203.0.113.5';
for ( $i = 0; $i < 10; $i++ ) {
	Exacoat_Customer_Auth::record_login_failure( 'Ana@Example.com' );
}
$check( Exacoat_Customer_Auth::login_gate( 'ana@example.com' ), 'locked', 'email locked from the attacking IP' );
$_SERVER['REMOTE_ADDR'] = '203.0.113.99';
$check( Exacoat_Customer_Auth::login_gate( 'ana@example.com' ), 'ok', 'owner on another IP not locked' );
$check( Exacoat_Customer_Auth::login_gate( 'eve@example.com' ), 'ok', 'other account open' );
Exacoat_Customer_Auth::clear_login_failures( 'ana@example.com' );

// Many IPs failing one email only slows sign-in (a correct password still works).
$GLOBALS['transients'] = [];
for ( $i = 0; $i < 100; $i++ ) {
	$_SERVER['REMOTE_ADDR'] = '198.51.100.' . ( $i % 250 );
	Exacoat_Customer_Auth::record_login_failure( 'boss@example.com' );
}
$_SERVER['REMOTE_ADDR'] = '203.0.113.200';
$check( Exacoat_Customer_Auth::login_gate( 'boss@example.com' ), 'slow', 'global per email limit slows, never refuses' );

// Guest order lookups: correct proofs are never gated or counted; failures are.
$GLOBALS['transients'] = [];
$_SERVER['REMOTE_ADDR'] = '203.0.113.5';
for ( $i = 0; $i < 10; $i++ ) {
	Exacoat_Customer_Auth::record_guest_lookup_failure( 900 );
}
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 900 ), true, 'order paused after 10 failed lookups' );
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 901 ), false, 'other order open' );
$GLOBALS['transients'] = [];
for ( $i = 0; $i < 200; $i++ ) {
	Exacoat_Customer_Auth::guest_lookup_blocked( 1000 + $i );
}
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 3000 ), false, 'checking the gate never counts' );
for ( $i = 0; $i < 60; $i++ ) {
	Exacoat_Customer_Auth::record_guest_lookup_failure( 4000 + $i );
}
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 5000 ), true, 'per IP pause after 60 failures' );
$_SERVER['REMOTE_ADDR'] = '203.0.113.6';
$check( Exacoat_Customer_Auth::guest_lookup_blocked( 5000 ), false, 'other IP open' );

// Coupons: email-restricted coupons only for the user id they were issued to.
$check( Exacoat_Customer_Auth::coupon_listed_for_user( 42, [ 'owner@example.com' ], 42, true ), true, 'issued to this user id' );
$check( Exacoat_Customer_Auth::coupon_listed_for_user( 7, [ 'owner@example.com' ], 42, true ), false, 'issued to another user id' );
$check( Exacoat_Customer_Auth::coupon_listed_for_user( 7, [ 'victim@example.com' ], 0, true ), false, 'email match alone never lists' );
$check( Exacoat_Customer_Auth::coupon_listed_for_user( 7, [], 0, true ), true, 'public my coupons page coupon' );
$check( Exacoat_Customer_Auth::coupon_listed_for_user( 7, [], 0, false ), false, 'hidden coupon' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "customer auth guards: all checks passed\n";
