<?php
/**
 * Standalone check for the Midtrans notification fallback guard
 * (Exacoat_Checkout_Engine::midtrans_notification_valid): fails closed without a server key
 * and requires gross_amount to equal the order total.
 * Run: php wordpress-plugin/exacoat-core/tests/midtrans-notification-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/../includes/class-checkout-engine.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$key  = 'SB-Mid-server-test-0123456789';
$sign = fn( string $id, string $code, string $gross, string $k ) => hash( 'sha512', $id . $code . $gross . $k );
$data = fn( string $gross, string $k ) => [ 'status_code' => '200', 'gross_amount' => $gross, 'signature_key' => $sign( '542001', '200', $gross, $k ) ];

$check( Exacoat_Checkout_Engine::midtrans_notification_valid( $data( '150023.00', $key ), '542001', $key, 150023.0 ), true, 'valid notification' );
$check( Exacoat_Checkout_Engine::midtrans_notification_valid( $data( '150023.00', '' ), '542001', '', 150023.0 ), false, 'empty server key fails closed' );
$check( Exacoat_Checkout_Engine::midtrans_notification_valid( $data( '1000.00', $key ), '542001', $key, 150023.0 ), false, 'gross amount must equal the order total' );
$bad = $data( '150023.00', $key );
$bad['signature_key'] = str_repeat( 'a', 128 );
$check( Exacoat_Checkout_Engine::midtrans_notification_valid( $bad, '542001', $key, 150023.0 ), false, 'wrong signature' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "midtrans notification: all checks passed\n";
