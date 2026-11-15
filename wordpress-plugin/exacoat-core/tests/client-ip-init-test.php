<?php
/**
 * Runs the real init hook path of Exacoat_Checkout_Engine (apply_headless_currency_context
 * on init -999) and checks that no request header can rewrite the client IP used by limits.
 * Run: php wordpress-plugin/exacoat-core/tests/client-ip-init-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'EXACOAT_CART_PRICE_SECRET', 'test-secret-0123456789abcdef0123456789abcdef' );

$GLOBALS['hooks'] = [];
function add_action( $hook, $cb, $prio = 10, $args = 1 ) { $GLOBALS['hooks'][ $hook ][ $prio ][] = $cb; return true; }
function add_filter( $hook, $cb, $prio = 10, $args = 1 ) { return add_action( $hook, $cb, $prio, $args ); }
function remove_action( $hook, $cb, $prio = 10 ) { return true; }
function did_action( $hook ) { return 1; }
function apply_filters( $hook, $value ) { return $value; }
function sanitize_text_field( $t ) { return trim( strip_tags( (string) $t ) ); }
function wp_unslash( $v ) { return is_string( $v ) ? stripslashes( $v ) : $v; }
// Runs the hook's callbacks up to $max_priority (the early init callbacks that run before
// WordPress resolves the visitor; later ones need a full WordPress).
function do_action( $hook, $max_priority = -999 ) {
	$by_prio = $GLOBALS['hooks'][ $hook ] ?? [];
	ksort( $by_prio );
	foreach ( $by_prio as $prio => $cbs ) {
		if ( $prio > $max_priority ) {
			break;
		}
		foreach ( $cbs as $cb ) {
			call_user_func( $cb );
		}
	}
}
class Exacoat_Core {
	public static function get_setting( $k, $d = null ) { return $d; }
}

// The web server sets REMOTE_ADDR before WordPress and the plugin load.
$_SERVER['REMOTE_ADDR']              = '203.0.113.50';
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP'] = '198.51.100.9';
$_SERVER['HTTP_X_ARTMATTER_CLIENT_IP'] = '198.51.100.10';

require_once __DIR__ . '/../includes/class-request-guard.php';
require_once __DIR__ . '/../includes/class-checkout-engine.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

Exacoat_Checkout_Engine::init();
$check( isset( $GLOBALS['hooks']['init'][-999] ), true, 'currency context registered on init -999' );
do_action( 'init' );

$check( $_SERVER['REMOTE_ADDR'], '203.0.113.50', 'unsigned client IP header does not rewrite REMOTE_ADDR' );
$check( Exacoat_Request_Guard::client_ip(), '203.0.113.50', 'limits see the real address' );

// A signed storefront header is used for geolocation and limits.
$ts = time();
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP']     = '198.51.100.9';
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP_TS']  = (string) $ts;
$_SERVER['HTTP_X_EXACOAT_CLIENT_IP_SIG'] = Exacoat_Request_Guard::client_ip_signature( EXACOAT_CART_PRICE_SECRET, '198.51.100.9', $ts );
do_action( 'init' );
$check( $_SERVER['REMOTE_ADDR'], '198.51.100.9', 'signed client IP used for geolocation' );
$check( Exacoat_Request_Guard::client_ip(), '198.51.100.9', 'signed client IP used for limits' );

// Whatever rewrites REMOTE_ADDR later, unsigned requests are judged by the original address.
unset( $_SERVER['HTTP_X_EXACOAT_CLIENT_IP_SIG'] );
$_SERVER['REMOTE_ADDR'] = '198.51.100.77';
$check( Exacoat_Request_Guard::client_ip(), '203.0.113.50', 'original REMOTE_ADDR kept' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "client ip init path: all checks passed\n";
