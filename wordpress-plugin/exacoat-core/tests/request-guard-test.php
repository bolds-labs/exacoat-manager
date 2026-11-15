<?php
/**
 * Standalone check for Exacoat_Request_Guard: trusted client IP (signed storefront header,
 * Cloudflare range check, REMOTE_ADDR) and the transient counters used by rate limits.
 * Run: php wordpress-plugin/exacoat-core/tests/request-guard-test.php
 *
 * The client IP signature vector is the one the storefront must reproduce
 * (see AGENTS.md "Plugin Auth and Ownership").
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'EXACOAT_CART_PRICE_SECRET', 'test-secret-0123456789abcdef0123456789abcdef' );

$GLOBALS['transients'] = [];
function get_transient( $k ) { return $GLOBALS['transients'][ $k ] ?? false; }
function set_transient( $k, $v, $t ) { $GLOBALS['transients'][ $k ] = $v; return true; }
function delete_transient( $k ) { unset( $GLOBALS['transients'][ $k ] ); return true; }
function apply_filters( $hook, $value ) { return $value; }

require_once __DIR__ . '/../includes/class-request-guard.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$secret = EXACOAT_CART_PRICE_SECRET;
$reset  = function () {
	foreach ( [ 'REMOTE_ADDR', 'HTTP_CF_CONNECTING_IP', 'HTTP_X_EXACOAT_CLIENT_IP', 'HTTP_X_EXACOAT_CLIENT_IP_TS', 'HTTP_X_EXACOAT_CLIENT_IP_SIG', 'HTTP_X_FORWARDED_FOR' ] as $k ) {
		unset( $_SERVER[ $k ] );
	}
};

// Shared vector for the storefront.
$check( Exacoat_Request_Guard::client_ip_payload( '198.51.100.7', 1800000000 ), "exacoat-client-ip-v1\n198.51.100.7\n1800000000", 'client ip payload' );
$check( Exacoat_Request_Guard::client_ip_signature( $secret, '198.51.100.7', 1800000000 ), hash_hmac( 'sha256', "exacoat-client-ip-v1\n198.51.100.7\n1800000000", $secret ), 'client ip signature' );

// Plain REMOTE_ADDR; X-Forwarded-For and unsigned X-Exacoat-Client-IP are never trusted.
$reset();
$_SERVER['REMOTE_ADDR']              = '203.0.113.50';
$_SERVER['HTTP_X_FORWARDED_FOR']     = '198.51.100.1';
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP'] = '198.51.100.2';
$check( Exacoat_Request_Guard::client_ip(), '203.0.113.50', 'unsigned headers ignored' );

// Signed storefront header.
$now = time();
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP_TS']  = (string) $now;
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP_SIG'] = Exacoat_Request_Guard::client_ip_signature( $secret, '198.51.100.2', $now );
$check( Exacoat_Request_Guard::client_ip(), '198.51.100.2', 'signed storefront client ip' );
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP'] = '198.51.100.3';
$check( Exacoat_Request_Guard::client_ip(), '203.0.113.50', 'signature for another ip refused' );
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP']     = '198.51.100.2';
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP_TS']  = (string) ( $now - 600 );
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP_SIG'] = Exacoat_Request_Guard::client_ip_signature( $secret, '198.51.100.2', $now - 600 );
$check( Exacoat_Request_Guard::client_ip(), '203.0.113.50', 'stale signature refused' );

// Cloudflare.
$reset();
$_SERVER['REMOTE_ADDR']           = '203.0.113.50';
$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.7';
$check( Exacoat_Request_Guard::client_ip(), '203.0.113.50', 'CF header from a non Cloudflare address ignored' );
$_SERVER['REMOTE_ADDR'] = '172.70.1.1';
$check( Exacoat_Request_Guard::client_ip(), '198.51.100.7', 'CF header from Cloudflare' );
$check( Exacoat_Request_Guard::ip_in_cidr( '2a06:98c7::1', '2a06:98c0::/29' ), true, 'ipv6 /29' );
$check( Exacoat_Request_Guard::ip_in_cidr( '2a06:98c8::1', '2a06:98c0::/29' ), false, 'ipv6 /29 miss' );

// Counters.
$hits = [];
for ( $i = 0; $i < 4; $i++ ) {
	$hits[] = Exacoat_Request_Guard::hit( 'b', 'subject', 3, 60 );
}
$check( $hits, [ false, false, false, true ], 'hit limits after 3' );
$check( Exacoat_Request_Guard::is_over( 'b', 'subject', 3 ), true, 'is_over without counting' );
$check( Exacoat_Request_Guard::is_over( 'b', 'other', 3 ), false, 'other subject' );
Exacoat_Request_Guard::clear( 'b', 'subject' );
$check( Exacoat_Request_Guard::is_over( 'b', 'subject', 3 ), false, 'clear' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "request guard: all checks passed\n";
