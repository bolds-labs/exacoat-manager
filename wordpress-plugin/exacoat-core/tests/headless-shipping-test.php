<?php
/**
 * Standalone check for the server-decided headless checkout shipping
 * (Exacoat_Checkout_Engine::headless_shipping_decision and attach_headless_shipping_before_payment).
 * Run: php wordpress-plugin/exacoat-core/tests/headless-shipping-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );

function wp_unslash( $value ) {
	return is_string( $value ) ? stripslashes( $value ) : $value;
}
function sanitize_text_field( $text ) {
	return trim( strip_tags( (string) $text ) );
}

class Exacoat_Configurator_Engine {
	public static function cart_price_secret(): string {
		return 'test-secret-0123456789abcdef0123456789abcdef';
	}
}

class Exacoat_Store_Enhancements {
	public static $threshold = 300000;
	public static function free_shipping_rule( string $country, float $subtotal, string $currency ): ?array {
		return [ 'qualified' => $subtotal >= self::$threshold, 'filter_text' => 'reg' ];
	}
	public static function get_shipping_promo_config(): array {
		return [ 'enabled' => true, 'code' => 'ONGKIR15', 'max_discount' => 15000.0, 'filter_text' => 'reg', 'currency' => 'IDR' ];
	}
	public static $last_markup = null;
	public static function calculate_price_for_currency( $amount, $currency, $is_addon = false, $markup = null ): float {
		self::$last_markup = $markup;
		return round( $amount * 0.0001 * ( $markup ?? 1.8 ), 2 );
	}
}

class WC_Order_Item_Shipping {
	public $title = '';
	public $method = '';
	public $total = '';
	public $meta = [];
	public function set_method_title( $t ) { $this->title = $t; }
	public function set_method_id( $m ) { $this->method = $m; }
	public function set_total( $t ) { $this->total = $t; }
	public function add_meta_data( $k, $v, $unique = false ) { $this->meta[ $k ] = $v; }
}

class Fake_Ship {
	private $method;
	public function __construct( string $method ) { $this->method = $method; }
	public function get_method_id() { return $this->method; }
}

class Fake_Line {
	private $qty;
	public function __construct( int $qty ) { $this->qty = $qty; }
	public function get_quantity() { return $this->qty; }
}

class WC_Order {
	public $id;
	public $shipping = [ 'first_name' => 'Ana', 'country' => 'ID', 'postcode' => '40115', 'address_1' => 'Jl. Merdeka 1' ];
	public $lines;
	public $subtotal = 200000.0;
	public $currency = 'IDR';
	public $coupons = [];
	public $meta = [];
	public $shipping_items;
	public $added = [];
	public $note = '';
	public function __construct( int $id, array $quantities ) {
		$this->id    = $id;
		$this->lines = array_map( fn( $q ) => new Fake_Line( $q ), $quantities );
		$this->shipping_items = [ 7 => new Fake_Ship( 'biteship_shipping' ) ];
	}
	public function get_id() { return $this->id; }
	public function get_shipping_country() { return $this->shipping['country'] ?? ''; }
	public function get_billing_country() { return ''; }
	public function get_shipping_postcode() { return $this->shipping['postcode'] ?? ''; }
	public function get_billing_postcode() { return ''; }
	public function get_items( $type = 'line_item' ) { return 'shipping' === $type ? $this->shipping_items : $this->lines; }
	public function get_currency() { return $this->currency; }
	public function get_subtotal() { return $this->subtotal; }
	public function get_coupon_codes() { return $this->coupons; }
	public function get_customer_note() { return $this->note; }
	public function set_customer_note( $n ) { $this->note = $n; }
	public function remove_item( $id ) { unset( $this->shipping_items[ $id ] ); }
	public function add_item( $item ) { $this->added[] = $item; }
	public function get_address( $type ) { return $this->shipping; }
	public function set_address( $a, $type ) { $this->shipping = $a; }
	public function update_meta_data( $k, $v ) { $this->meta[ $k ] = $v; }
	public function delete_meta_data( $k ) { unset( $this->meta[ $k ] ); }
	public function calculate_totals( $taxes = true ) {}
	public function save() {}
}

require_once __DIR__ . '/../includes/class-shipping-quote.php';
require_once __DIR__ . '/../includes/class-checkout-engine.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$secret  = Exacoat_Configurator_Engine::cart_price_secret();
$next_id = 100;
$set_headers = function ( array $h ) {
	foreach ( array_keys( $_SERVER ) as $k ) {
		if ( 0 === strpos( $k, 'HTTP_X_EXACOAT_SHIPPING_' ) ) {
			unset( $_SERVER[ $k ] );
		}
	}
	foreach ( $h as $k => $v ) {
		$_SERVER[ 'HTTP_X_EXACOAT_SHIPPING_' . $k ] = $v;
	}
};
$quote = function ( array $over = [] ) use ( $secret ) {
	$f   = array_merge( [ 'context' => 'checkout', 'courier' => 'jne', 'service' => 'reg', 'country' => 'ID', 'postcode' => '40115', 'quantity' => 3, 'amount' => 22000 ], $over );
	$exp = time() + 1800;
	return $exp . '.' . Exacoat_Shipping_Quote::sign( $secret, $f, $exp );
};
$courier_headers = function ( array $over = [], array $quote_over = [] ) use ( $quote ) {
	return array_merge( [ 'MODE' => 'courier', 'COURIER' => 'jne', 'SERVICE' => 'reg', 'AMOUNT' => '22000', 'QUOTE' => $quote( $quote_over ) ], $over );
};
$decide = function ( WC_Order $order ) {
	try {
		return Exacoat_Checkout_Engine::headless_shipping_decision( $order );
	} catch ( \Exception $e ) {
		return 'refused: ' . $e->getMessage();
	}
};
$refused = 'refused: ' . Exacoat_Shipping_Quote::INVALID_MESSAGE;

// No headless headers. Outside Indonesia WooCommerce's own selected rate stays.
$set_headers( [] );
$intl = new WC_Order( $next_id++, [ 1 ] );
$intl->shipping['country'] = 'US';
$intl->shipping_items = [ 7 => new Fake_Ship( 'flat_rate' ) ];
$check( $decide( $intl ), null, 'no headers, international rate kept' );

$no_line = new WC_Order( $next_id++, [ 1 ] );
$no_line->shipping_items = [];
$check( $decide( $no_line ), null, 'no headers, nothing to ship' );

// Indonesia without a signed quote: only store pickup is accepted.
$check( $decide( new WC_Order( $next_id++, [ 1 ] ) ), $refused, 'no headers, biteship line without a verified decision refused' );
$flat = new WC_Order( $next_id++, [ 1 ] );
$flat->shipping_items = [ 7 => new Fake_Ship( 'flat_rate' ) ];
$check( $decide( $flat ), $refused, 'no headers, other Indonesian method refused' );

$wc_pickup = new WC_Order( $next_id++, [ 1 ] );
$wc_pickup->shipping_items = [ 7 => new Fake_Ship( 'local_pickup' ) ];
$check( $decide( $wc_pickup ), [ 'mode' => 'pickup' ], 'no headers, local pickup' );
Exacoat_Checkout_Engine::attach_headless_shipping_before_payment( $wc_pickup );
$check( [ $wc_pickup->shipping['postcode'], $wc_pickup->meta['_is_store_pickup'] ?? null, $wc_pickup->added[0]->total ?? null ], [ '17142', 'yes', '0' ], 'no headers, local pickup gets the store address' );

// Valid quote, no discount.
$set_headers( $courier_headers() );
$order = new WC_Order( $next_id++, [ 1, 2 ] );
$d     = $decide( $order );
$check( $d['total'] ?? null, 22000.0, 'valid quote total' );
$check( $d['title'] ?? null, 'JNE - REG', 'title from courier and service' );

// The quote binds the order's destination and item count.
$set_headers( $courier_headers() );
$other = new WC_Order( $next_id++, [ 1, 2 ] );
$other->shipping['postcode'] = '17142';
$check( $decide( $other ), $refused, 'other postcode refused' );

$set_headers( $courier_headers() );
$check( $decide( new WC_Order( $next_id++, [ 1 ] ) ), $refused, 'other item count refused' );

$set_headers( $courier_headers( [ 'AMOUNT' => '1000' ] ) );
$check( $decide( new WC_Order( $next_id++, [ 3 ] ) ), $refused, 'lower amount refused' );

$set_headers( [ 'TOTAL' => '0', 'TITLE' => 'JNE - REG', 'RATE_ID' => 'biteship:jne_reg' ] );
$check( $decide( new WC_Order( $next_id++, [ 3 ] ) ), $refused, 'old unsigned total header refused' );

$set_headers( $courier_headers( [ 'QUOTE' => '' ] ) );
$check( $decide( new WC_Order( $next_id++, [ 3 ] ) ), $refused, 'missing quote refused' );

$set_headers( $courier_headers( [ 'COURIER' => 'gojek' ], [ 'courier' => 'gojek' ] ) );
$check( $decide( new WC_Order( $next_id++, [ 3 ] ) ), $refused, 'unquoted courier refused' );

// Free shipping from the zone rule on the order subtotal; client discount headers ignored.
$set_headers( $courier_headers( [ 'DISCOUNT' => '999999', 'TOTAL' => '0' ] ) );
$rich = new WC_Order( $next_id++, [ 3 ] );
$rich->subtotal = 350000.0;
$d = $decide( $rich );
$check( [ $d['total'] ?? null, $d['discount'] ?? null, $d['is_free'] ?? null ], [ 0.0, 22000.0, true ], 'free shipping over threshold' );

$set_headers( $courier_headers( [ 'SERVICE' => 'yes', 'AMOUNT' => '30000' ], [ 'service' => 'yes', 'amount' => 30000 ] ) );
$rich2 = new WC_Order( $next_id++, [ 3 ] );
$rich2->subtotal = 350000.0;
$check( $decide( $rich2 )['total'] ?? null, 30000.0, 'express is never free' );

// Promo coupon from the order, capped.
$set_headers( $courier_headers() );
$promo = new WC_Order( $next_id++, [ 3 ] );
$promo->coupons = [ 'ongkir15' ];
$d = $decide( $promo );
$check( [ $d['total'] ?? null, $d['promo_code'] ?? null ], [ 7000.0, 'ONGKIR15' ], 'promo coupon' );

// Other currency: converted like every IDR price.
$set_headers( $courier_headers() );
$usd = new WC_Order( $next_id++, [ 3 ] );
$usd->currency = 'USD';
$check( $decide( $usd )['total'] ?? null, 3.96, 'currency conversion' );
$check( Exacoat_Store_Enhancements::$last_markup, null, 'shipping converts with the global markup, like the page' );

// The second check at attach is real: a quote that stops matching is refused there.
$set_headers( $courier_headers() );
$late = new WC_Order( $next_id++, [ 3 ] );
$decide( $late );
$late->shipping['postcode'] = '17142';
try {
	Exacoat_Checkout_Engine::attach_headless_shipping_before_payment( $late );
	$check( 'attached', 'refused', 'attach re-checks the quote' );
} catch ( \Exception $e ) {
	$check( $e->getMessage(), Exacoat_Shipping_Quote::INVALID_MESSAGE, 'attach re-checks the quote' );
}

// Attach writes the decided line.
$set_headers( $courier_headers() );
$attach = new WC_Order( $next_id++, [ 3 ] );
Exacoat_Checkout_Engine::attach_headless_shipping_before_payment( $attach );
$check( [ count( $attach->shipping_items ), count( $attach->added ), $attach->added[0]->total ?? null, $attach->meta['_shipping_raw_price'] ?? null ], [ 0, 1, '22000', '22000' ], 'attach courier line' );

// Store pickup is free and moves the shipping address to the store.
$set_headers( [ 'MODE' => 'pickup', 'RATE_ID' => 'local_pickup:45' ] );
$pickup = new WC_Order( $next_id++, [ 3 ] );
Exacoat_Checkout_Engine::attach_headless_shipping_before_payment( $pickup );
$check( [ $pickup->added[0]->method ?? null, $pickup->added[0]->total ?? null, $pickup->shipping['postcode'], $pickup->shipping['address_1'], $pickup->shipping['first_name'], $pickup->meta['_is_store_pickup'] ?? null ], [ 'local_pickup', '0', '17142', 'Ruby Commercial TB12, Jl. Bulevar Selatan, Summarecon Bekasi', 'Ana', 'yes' ], 'pickup' );

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "headless shipping: all checks passed\n";
