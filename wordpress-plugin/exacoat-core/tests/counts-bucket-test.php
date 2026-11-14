<?php
/**
 * Standalone check for the order counts status mapping.
 * Run: php wordpress-plugin/exacoat-core/tests/counts-bucket-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/../includes/class-order-manager.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$rows = [
	[ 'pending', false, 'awaiting_payment' ],
	[ 'on-hold', false, 'awaiting_payment' ],
	[ 'pending-payment', false, 'awaiting_payment' ],
	[ 'processing', false, 'to_prepare' ],
	[ 'preparing-order', false, 'preparing' ],
	[ 'in-production', false, 'preparing' ],
	[ 'ready-to-ship', false, 'waiting_for_courier' ],
	[ 'awaiting-pickup', false, 'waiting_for_courier' ],
	[ 'ready-to-ship', true, 'ready_for_pickup' ],
	[ 'awaiting-pickup', true, 'ready_for_pickup' ],
	[ 'smb-ready', false, 'ready_for_pickup' ],
	[ 'smb-ready', true, 'ready_for_pickup' ],
	[ 'smb-picked', false, 'picked_up' ],
	[ 'shipped', false, 'shipped' ],
	[ 'completed', false, 'completed' ],
	[ 'delivered', false, 'completed' ],
	[ 'cancelled', false, null ],
	[ 'refunded', false, null ],
	[ 'failed', false, null ],
	[ 'trash', false, null ],
	[ 'wc-processing', false, 'to_prepare' ],
	[ 'wc-ready-to-ship', true, 'ready_for_pickup' ],
];
foreach ( $rows as [ $status, $pickup, $expected ] ) {
	$check( Exacoat_Order_Manager::bucket_for_status( $status, $pickup ), $expected, $status . ( $pickup ? ' (pickup)' : '' ) );
}

$base = [
	'delivery_override' => '', 'pickup_meta' => '', 'tracking' => '', 'carrier' => '', 'status' => 'ready-to-ship',
	'company' => '', 'addr1' => '', 'addr2' => '', 'postcode' => '', 'city' => '', 'shipping_lines' => [], 'note' => '',
];
$sig = fn( array $o ) => Exacoat_Order_Manager::is_pickup_from_signals( array_merge( $base, $o ) );
$check( $sig( [] ), false, 'plain order is courier' );
$check( $sig( [ 'delivery_override' => 'yes', 'pickup_meta' => 'yes' ] ), false, 'override beats pickup meta' );
$check( $sig( [ 'pickup_meta' => 'yes' ] ), true, 'pickup meta yes' );
$check( $sig( [ 'pickup_meta' => 'no', 'status' => 'smb-ready' ] ), false, 'pickup meta no' );
$check( $sig( [ 'tracking' => 'AB123', 'carrier' => 'jne', 'shipping_lines' => [ [ 'local_pickup', 'Pickup' ] ] ] ), false, 'tracking plus carrier is courier' );
$check( $sig( [ 'status' => 'smb-picked' ] ), true, 'smb status' );
$check( $sig( [ 'addr1' => 'Ruby Commercial Lt 1', 'postcode' => '17142' ] ), true, 'store address' );
$check( $sig( [ 'company' => 'Exacoat Store Summarecon Bekasi', 'addr1' => 'Jl Mawar', 'city' => 'Jakarta' ] ), false, 'company alone with real address' );
$check( $sig( [ 'shipping_lines' => [ [ 'local_pickup', 'Store' ] ] ] ), true, 'local_pickup method' );
$check( $sig( [ 'shipping_lines' => [ [ 'flat_rate', 'Ambil di toko' ] ] ] ), true, 'pickup title' );
$check( $sig( [ 'note' => 'Mohon ambil sendiri ya' ] ), true, 'customer note' );

if ( $fails ) {
	echo $fails . " failure(s)\n";
	exit( 1 );
}
echo "OK\n";
