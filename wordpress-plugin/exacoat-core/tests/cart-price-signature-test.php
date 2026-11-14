<?php
/**
 * Standalone check for signed cart prices (configurator add to cart).
 * Run: php wordpress-plugin/exacoat-core/tests/cart-price-signature-test.php
 *
 * The vectors match lib/server/cart-price-signature.test.ts in the storefront, so both
 * sides agree on the payload and the encoding.
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'EXACOAT_CART_PRICE_SECRET', 'test-secret-0123456789abcdef0123456789abcdef' );

// Minimal WordPress stand-ins used by the add to cart filter.
function wp_unslash( $value ) {
	return is_string( $value ) ? stripslashes( $value ) : $value;
}
function wp_slash( $value ) {
	return is_string( $value ) ? addslashes( $value ) : $value;
}
function absint( $value ) {
	return abs( (int) $value );
}
function __( $text, $domain = '' ) {
	return $text;
}
function esc_url_raw( $url ) {
	return (string) $url;
}
function wp_rand() {
	return mt_rand();
}
function sanitize_key( $key ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
}

require_once __DIR__ . '/../includes/class-configurator-engine.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$secret = EXACOAT_CART_PRICE_SECRET;
$addon  = '[{"label":"Camera","value":"Swarm"},{"label":"Back Glass","value":"Swarm"}]';
$exp    = 1800000000;
$now    = $exp - 60;

// Shared vectors.
$check(
	Exacoat_Configurator_Engine::cart_price_payload( 537445, '110000', $addon, $exp ),
	"exacoat-cart-v1\n537445\n110000\nb078f8b385daa3931941db542dda06867d12cf41438c16b8ac352a6a62f90504\n1800000000",
	'payload'
);
$sig  = 'f72eba8aeb88fc0e1933ad153ea86b213b8fca756ada9045761cb5d07d026bf9';
$sig2 = '442ff2970618a8ba64c5987a9536f07c0de7a577433474a726d309c7d56fcfb2';
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000', $addon, $exp, $sig, $now ), true, 'storefront vector verifies' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 900001, '', '[]', $exp, $sig2, $now ), true, 'catalog-priced vector verifies' );

// Tampering.
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '1000', $addon, $exp, $sig, $now ), false, 'changed price' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '', $addon, $exp, $sig, $now ), false, 'price removed' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000', str_replace( 'Swarm', 'Matte Black', $addon ), $exp, $sig, $now ), false, 'changed lines' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537446, '110000', $addon, $exp, $sig, $now ), false, 'other product' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000', $addon, $exp + 1, $sig, $now ), false, 'changed expiry' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000', $addon, $exp, $sig, $exp + 1 ), false, 'expired' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000', $addon, $exp, $sig, $exp - 7200 ), false, 'expiry too far ahead' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( '', 537445, '110000', $addon, $exp, $sig, $now ), false, 'no secret' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( 'short', 537445, '110000', $addon, $exp, $sig, $now ), false, 'short secret' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000.5', $addon, $exp, $sig, $now ), false, 'non-integer price' );
$check( Exacoat_Configurator_Engine::verify_cart_price_signature( $secret, 537445, '110000', $addon, $exp, '', $now ), false, 'missing signature' );

// The add to cart filter.
$add = function ( array $post, int $product_id = 537445, int $variation_id = 0 ) {
	$_POST = array_map( 'addslashes', $post ); // WordPress adds magic quotes to $_POST.
	try {
		return Exacoat_Configurator_Engine::add_addon_data_to_cart_item( [], $product_id, $variation_id );
	} catch ( Exception $e ) {
		return 'refused';
	}
};
$live_exp = time() + 600;
$signed   = function ( int $item_id, string $price, string $addon_json ) use ( $secret, $live_exp ) {
	return [
		'exacoat_addon_data'   => $addon_json,
		'exacoat_custom_price' => $price,
		'exacoat_price_exp'    => (string) $live_exp,
		'exacoat_price_sig'    => hash_hmac( 'sha256', Exacoat_Configurator_Engine::cart_price_payload( $item_id, $price, $addon_json, $live_exp ), $secret ),
	];
};

$check( $add( [] ), [], 'plain add to cart untouched' );
$check( $add( [ 'exacoat_custom_price' => '1' ] ), 'refused', 'unsigned price refused' );
$check( $add( [ 'exacoat_addon_data' => $addon ] ), 'refused', 'unsigned lines refused' );
$check( $add( array_merge( $signed( 537445, '110000', $addon ), [ 'exacoat_custom_price' => '1000' ] ) ), 'refused', 'tampered price refused' );

$ok = $add( $signed( 537445, '110000', $addon ) );
$check( is_array( $ok ) ? $ok['exacoat_custom_price'] : $ok, 110000.0, 'signed price stored' );
$check( is_array( $ok ) ? $ok['exacoat_price_verified'] : $ok, 1, 'signed price marked verified' );
$check( is_array( $ok ) ? count( $ok['exacoat_addons'] ) : $ok, 2, 'signed lines stored' );

$quoted = '[{"label":"Macbook Pro 14\" Top","value":"Swarm"}]';
$ok = $add( $signed( 522632, '370000', $quoted ), 522632 );
$check( is_array( $ok ) ? $ok['exacoat_addons'][0]['label'] : $ok, 'Macbook Pro 14" Top', 'lines with quotes survive magic quotes' );

$ok = $add( $signed( 11, '', '[{"label":"Device Model","value":"iPhone 14 Pro"}]' ), 430927, 11 );
$check( is_array( $ok ) ? array_key_exists( 'exacoat_custom_price', $ok ) : $ok, false, 'catalog-priced variation keeps WooCommerce price' );
$check( $add( $signed( 430927, '', '[]' ), 430927, 11 ), 'refused', 'variation signed with parent id refused' );

// Bundle prices.
$check(
	Exacoat_Configurator_Engine::sanitize_bundle_pricing( [ 'all_parts_price' => '90000', 'part_finish_surcharges' => [ 'back-glass' => 15000, 'camera' => '5000', 'bad' => 'x' ] ] ),
	[ 'all_parts_price' => 90000.0, 'part_finish_surcharges' => [ 'back-glass' => 15000.0, 'camera' => 5000.0 ] ],
	'bundle pricing sanitized'
);
$check( Exacoat_Configurator_Engine::sanitize_bundle_pricing( [ 'all_parts_price' => 0 ] ), null, 'empty bundle pricing is null' );
$check( Exacoat_Configurator_Engine::sanitize_bundle_pricing( 'x' ), null, 'non-array bundle pricing is null' );

if ( $fails ) {
	echo $fails . " failure(s)\n";
	exit( 1 );
}
echo "cart price signature: all checks passed\n";
