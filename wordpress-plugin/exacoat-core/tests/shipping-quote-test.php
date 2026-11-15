<?php
/**
 * Standalone check for signed shipping quotes and the headless shipping charge.
 * Run: php wordpress-plugin/exacoat-core/tests/shipping-quote-test.php
 *
 * The vectors match lib/server/shipping-quote-signature.test.ts in the storefront, so both
 * sides agree on the payload and the encoding.
 */
define( 'ABSPATH', __DIR__ . '/' );

require_once __DIR__ . '/../includes/class-shipping-quote.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$secret   = 'test-secret-0123456789abcdef0123456789abcdef';
$exp      = 1800000000;
$now      = $exp - 60;
$checkout = [
	'context'  => 'checkout',
	'courier'  => 'jne',
	'service'  => 'reg',
	'country'  => 'ID',
	'postcode' => '17142',
	'quantity' => 2,
	'amount'   => 12000,
];
$warranty = [
	'context'  => 'warranty:542239',
	'courier'  => 'sicepat',
	'service'  => 'best',
	'country'  => 'ID',
	'postcode' => '40115',
	'quantity' => 1,
	'amount'   => 24000,
];

// Shared vectors.
$check(
	Exacoat_Shipping_Quote::payload( $checkout, $exp ),
	"exacoat-ship-v1\ncheckout\njne\nreg\nID\n17142\n2\n12000\n1800000000",
	'payload'
);
$check( Exacoat_Shipping_Quote::sign( $secret, $checkout, $exp ), '6ff033e4a8ed681e9532f8b228856d4c5bc159e89fbd1a82cb2ede3253401e8d', 'checkout vector' );
$check( Exacoat_Shipping_Quote::sign( $secret, $warranty, $exp ), '20a8234f2f20cc645dadfad8d63371ea64075283953314f0f774e61e3b4f2168', 'warranty vector' );

$messy = array_merge( $checkout, [ 'courier' => ' JNE ', 'service' => 'REG', 'country' => 'id', 'postcode' => ' 171 42 ' ] );
$check( Exacoat_Shipping_Quote::sign( $secret, $messy, $exp ), Exacoat_Shipping_Quote::sign( $secret, $checkout, $exp ), 'normalisation' );

$token = $exp . '.' . Exacoat_Shipping_Quote::sign( $secret, $checkout, $exp );
$check( Exacoat_Shipping_Quote::verify( $secret, $checkout, $token, $now ), true, 'valid quote' );
$check( Exacoat_Shipping_Quote::verify( $secret, array_merge( $checkout, [ 'amount' => 1 ] ), $token, $now ), false, 'lower amount' );
$check( Exacoat_Shipping_Quote::verify( $secret, array_merge( $checkout, [ 'postcode' => '99999' ] ), $token, $now ), false, 'other postcode' );
$check( Exacoat_Shipping_Quote::verify( $secret, array_merge( $checkout, [ 'quantity' => 5 ] ), $token, $now ), false, 'other quantity' );
$check( Exacoat_Shipping_Quote::verify( $secret, array_merge( $checkout, [ 'service' => 'yes' ] ), $token, $now ), false, 'other service' );
$check( Exacoat_Shipping_Quote::verify( $secret, array_merge( $checkout, [ 'context' => 'warranty:1' ] ), $token, $now ), false, 'other context' );
$check( Exacoat_Shipping_Quote::verify( $secret, $checkout, $token, $exp + 1 ), false, 'expired' );
$check( Exacoat_Shipping_Quote::verify( $secret, $checkout, $token, $exp - 7201 ), false, 'too far ahead' );
$check( Exacoat_Shipping_Quote::verify( $secret, $checkout, '', $now ), false, 'missing token' );
$check( Exacoat_Shipping_Quote::verify( $secret, $checkout, 'abc', $now ), false, 'malformed token' );
$check( Exacoat_Shipping_Quote::verify( 'short', $checkout, $token, $now ), false, 'short secret' );

// Rate ids.
$check( Exacoat_Shipping_Quote::parse_rate_id( 'biteship:jne_reg' ), [ 'courier' => 'jne', 'service' => 'reg' ], 'parse biteship id' );
$check( Exacoat_Shipping_Quote::parse_rate_id( 'sicepat_best' ), [ 'courier' => 'sicepat', 'service' => 'best' ], 'parse plain id' );
$check( Exacoat_Shipping_Quote::parse_rate_id( 'local_pickup:45' ), null, 'parse pickup id' );
$check( Exacoat_Shipping_Quote::parse_rate_id( 'jne' ), null, 'parse bad id' );

// Headless charge: free shipping from the zone rule, promo coupon, plain rate.
$promo = [ 'enabled' => true, 'code' => 'ONGKIR15', 'max_discount' => 15000.0, 'filter_text' => 'reg' ];

$free = Exacoat_Shipping_Quote::headless_charge( 18000, 'jne', 'reg', true, 'reg', $promo, true );
$check( $free, [ 'raw' => 18000, 'discount' => 18000, 'total' => 0, 'is_free' => true, 'promo_code' => 'FREE SHIPPING' ], 'free shipping wins' );

$not_matching = Exacoat_Shipping_Quote::headless_charge( 30000, 'jne', 'yes', true, 'reg', $promo, false );
$check( $not_matching, [ 'raw' => 30000, 'discount' => 0, 'total' => 30000, 'is_free' => false, 'promo_code' => '' ], 'free filter only matches reg' );

$promo_hit = Exacoat_Shipping_Quote::headless_charge( 22000, 'sicepat', 'reg', false, 'reg', $promo, true );
$check( $promo_hit, [ 'raw' => 22000, 'discount' => 15000, 'total' => 7000, 'is_free' => false, 'promo_code' => 'ONGKIR15' ], 'promo capped' );

$promo_small = Exacoat_Shipping_Quote::headless_charge( 9000, 'jne', 'reg', false, 'reg', $promo, true );
$check( $promo_small['total'], 0, 'promo never below zero' );

$promo_off = Exacoat_Shipping_Quote::headless_charge( 22000, 'jne', 'reg', false, 'reg', $promo, false );
$check( $promo_off['total'], 22000, 'promo needs the coupon' );

$promo_disabled = Exacoat_Shipping_Quote::headless_charge( 22000, 'jne', 'reg', false, 'reg', array_merge( $promo, [ 'enabled' => false ] ), true );
$check( $promo_disabled['total'], 22000, 'disabled promo' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "shipping quote: all checks passed\n";
