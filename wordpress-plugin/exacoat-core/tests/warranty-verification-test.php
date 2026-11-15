<?php
/**
 * Standalone check for warranty eligibility verification (Exacoat_Warranty_Manager):
 * signed-in owner by customer id, exact billing email, or full normalised phone; never a
 * suffix match; marketplace username only without personal data.
 * Run: php wordpress-plugin/exacoat-core/tests/warranty-verification-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
$GLOBALS['user_id'] = 0;
function get_current_user_id() { return $GLOBALS['user_id']; }
function sanitize_text_field( $t ) { return trim( strip_tags( (string) $t ) ); }
function is_email( $e ) { return false !== filter_var( $e, FILTER_VALIDATE_EMAIL ); }

class WC_Order {
	public $phone = '0812-3456-7890';
	public function get_customer_id() { return 42; }
	public function get_billing_email() { return 'Ana@Example.com'; }
	public function get_billing_phone() { return $this->phone; }
	public function get_shipping_phone() { return ''; }
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
$v     = fn( string $s ) => Exacoat_Warranty_Manager::webstore_verification( $order, $s );

$check( $v( '' ), '', 'empty verification refused' );
$check( $v( 'ana@example.com' ), 'email', 'exact billing email, any case' );
$check( $v( 'ana@example.co' ), '', 'other email' );
$check( $v( '+62 812 3456 7890' ), 'phone', 'full phone in +62 form' );
$check( $v( '081234567890' ), 'phone', 'full phone in 08 form' );
$check( $v( '34567890' ), '', 'last 8 digits refused' );
$check( $v( '99934567890' ), '', 'suffix match refused' );
$check( $v( '17142' ), '', 'postcode guess refused' );
$GLOBALS['user_id'] = 42;
$check( $v( '' ), 'owner', 'signed-in customer of the order' );
$GLOBALS['user_id'] = 7;
$check( $v( '' ), '', 'another signed-in customer' );
$GLOBALS['user_id'] = 0;

$check( Exacoat_Warranty_Manager::phones_match( '0812****890', '0812****890' ), false, 'masked phone never matches' );
$check( Exacoat_Warranty_Manager::phones_match( '6281234567890', '0812-3456-7890' ), true, 'normalised phones match' );
$check( Exacoat_Warranty_Manager::phones_match( '081234', '081234' ), false, 'too short' );

$shopee = [ 'recipient_phone' => '6281234567890', 'buyer_username' => 'ana_shop' ];
$check( Exacoat_Warranty_Manager::marketplace_verification( $shopee, '081234567890' ), 'phone', 'marketplace full phone' );
$check( Exacoat_Warranty_Manager::marketplace_verification( $shopee, 'ANA_SHOP' ), 'username', 'marketplace username' );
$check( Exacoat_Warranty_Manager::marketplace_verification( $shopee, '67890' ), '', 'marketplace suffix refused' );
$check( Exacoat_Warranty_Manager::marketplace_verification( [ 'recipient_phone' => '62812******90' ], '6281200000090' ), '', 'masked marketplace phone refused' );
$check( Exacoat_Warranty_Manager::marketplace_verification( $shopee, '' ), '', 'marketplace empty refused' );

$addr = [ 'first_name' => 'Ana', 'last_name' => 'B', 'address_1' => 'Jl. Merdeka 1', 'city' => 'Bandung', 'postcode' => '40115', 'country' => 'ID', 'phone' => '0812', 'email' => 'a@b.c' ];
$check( Exacoat_Warranty_Manager::without_personal_data( $addr ), [ 'first_name' => '', 'last_name' => '', 'address_1' => '', 'city' => '', 'postcode' => '', 'country' => 'ID', 'phone' => '', 'email' => '' ], 'personal data removed' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "warranty verification: all checks passed\n";
