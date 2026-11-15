<?php
/**
 * Signed shipping quotes and the server-side headless shipping charge.
 *
 * The storefront's server signs every courier quote it hands to the browser
 * (exacoat-web lib/server/shipping-quote-signature.ts). A headless checkout or warranty
 * shipping choice is accepted only with a quote that matches the order's own destination
 * and item count and has not expired. The secret is EXACOAT_CART_PRICE_SECRET; the
 * version string keeps shipping quotes apart from signed cart prices.
 *
 * See AGENTS.md "Server-Decided Shipping".
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Exacoat_Shipping_Quote {

	const VERSION         = 'exacoat-ship-v1';
	const MAX_TTL         = 7200;
	const MIN_SECRET      = 32;
	const INVALID_MESSAGE = 'Shipping rates changed, please choose a courier again.';
	const INVALID_CODE    = 'exacoat_shipping_quote_invalid';

	/** Couriers the storefront quotes for Indonesian delivery. */
	const QUOTED_COURIERS = [ 'jne', 'sicepat' ];

	/** Same normalisation as normalizeShippingQuoteFields() in the storefront. */
	public static function normalize( array $f ): array {
		$clean = static function ( $v ): string {
			return trim( str_replace( [ "\r", "\n" ], '', (string) $v ) );
		};
		return [
			'context'  => $clean( $f['context'] ?? '' ),
			'courier'  => strtolower( $clean( $f['courier'] ?? '' ) ),
			'service'  => strtolower( $clean( $f['service'] ?? '' ) ),
			'country'  => strtoupper( $clean( $f['country'] ?? '' ) ),
			'postcode' => preg_replace( '/\s+/', '', strtoupper( $clean( $f['postcode'] ?? '' ) ) ),
			'quantity' => (int) ( $f['quantity'] ?? 0 ),
			'amount'   => (int) ( $f['amount'] ?? 0 ),
		];
	}

	public static function payload( array $fields, int $exp ): string {
		$f = self::normalize( $fields );
		return implode( "\n", [
			self::VERSION,
			$f['context'],
			$f['courier'],
			$f['service'],
			$f['country'],
			$f['postcode'],
			(string) $f['quantity'],
			(string) $f['amount'],
			(string) $exp,
		] );
	}

	public static function sign( string $secret, array $fields, int $exp ): string {
		return hash_hmac( 'sha256', self::payload( $fields, $exp ), $secret );
	}

	/**
	 * @param string $token "{exp}.{hex signature}" as issued by the storefront.
	 */
	public static function verify( string $secret, array $fields, string $token, int $now ): bool {
		if ( strlen( $secret ) < self::MIN_SECRET ) {
			return false;
		}
		if ( ! preg_match( '/^(\d{1,12})\.([0-9a-f]{64})$/', trim( $token ), $m ) ) {
			return false;
		}
		$exp = (int) $m[1];
		if ( $exp < $now || $exp > $now + self::MAX_TTL ) {
			return false;
		}
		$f = self::normalize( $fields );
		if ( '' === $f['courier'] || '' === $f['service'] || '' === $f['country'] || $f['quantity'] < 1 || $f['amount'] < 0 ) {
			return false;
		}
		return hash_equals( self::sign( $secret, $f, $exp ), $m[2] );
	}

	/** "biteship:jne_reg" or "jne_reg" to [ courier, service ], else null. */
	public static function parse_rate_id( string $rate_id ): ?array {
		$raw = strtolower( trim( $rate_id ) );
		if ( 0 === strpos( $raw, 'biteship:' ) ) {
			$raw = substr( $raw, 9 );
		}
		$idx = strpos( $raw, '_' );
		if ( false === $idx || 0 === $idx || strlen( $raw ) - 1 === $idx ) {
			return null;
		}
		$courier = substr( $raw, 0, $idx );
		$service = substr( $raw, $idx + 1 );
		if ( ! preg_match( '/^[a-z0-9]+$/', $courier ) || ! preg_match( '/^[a-z0-9_]+$/', $service ) ) {
			return null;
		}
		return [ 'courier' => $courier, 'service' => $service ];
	}

	public static function label( string $courier, string $service ): string {
		return strtoupper( $courier ) . ' - ' . strtoupper( $service );
	}

	/**
	 * Shipping charge for a verified courier quote, in IDR.
	 * Free shipping (zone rule) wins over the shipping promo coupon, as on the checkout page.
	 *
	 * @param int        $raw_idr        Verified courier price.
	 * @param bool       $free_qualified Order subtotal meets the destination zone threshold.
	 * @param string     $free_filter    Zone filter text (e.g. "reg").
	 * @param array|null $promo          get_shipping_promo_config() result.
	 * @param bool       $promo_applied  The promo coupon is applied on the order.
	 */
	public static function headless_charge( int $raw_idr, string $courier, string $service, bool $free_qualified, string $free_filter, ?array $promo, bool $promo_applied ): array {
		$raw    = max( 0, $raw_idr );
		$target = strtolower( 'biteship:' . $courier . '_' . $service . ' ' . self::label( $courier, $service ) );
		$filter = strtolower( trim( $free_filter ) );

		if ( $free_qualified && '' !== $filter && false !== strpos( $target, $filter ) ) {
			return [ 'raw' => $raw, 'discount' => $raw, 'total' => 0, 'is_free' => true, 'promo_code' => 'FREE SHIPPING' ];
		}

		if ( $promo_applied && is_array( $promo ) && ! empty( $promo['enabled'] ) && ! empty( $promo['code'] ) ) {
			$promo_filter = strtolower( trim( (string) ( $promo['filter_text'] ?? 'reg' ) ) );
			if ( '' !== $promo_filter && false !== strpos( $target, $promo_filter ) && $raw > 0 ) {
				$discount = (int) min( $raw, (int) round( (float) ( $promo['max_discount'] ?? 15000 ) ) );
				return [ 'raw' => $raw, 'discount' => $discount, 'total' => $raw - $discount, 'is_free' => false, 'promo_code' => (string) $promo['code'] ];
			}
		}

		return [ 'raw' => $raw, 'discount' => 0, 'total' => $raw, 'is_free' => false, 'promo_code' => '' ];
	}
}
