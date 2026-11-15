<?php
/**
 * Trusted client IP and simple transient counters for public routes.
 *
 * Client IP, in order:
 * 1. X-Exacoat-Client-IP, only with a valid storefront signature (X-Exacoat-Client-IP-Ts and
 *    X-Exacoat-Client-IP-Sig, HMAC-SHA256 with EXACOAT_CART_PRICE_SECRET, 5 minute window).
 * 2. CF-Connecting-IP, only when REMOTE_ADDR is a Cloudflare edge address.
 * 3. REMOTE_ADDR.
 * X-Forwarded-For is never trusted. See AGENTS.md "Plugin Auth and Ownership".
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Exacoat_Request_Guard {

	const CLIENT_IP_VERSION  = 'exacoat-client-ip-v1';
	const CLIENT_IP_MAX_SKEW = 300;

	/**
	 * Cloudflare edge address ranges. Source: https://www.cloudflare.com/ips/ (ips-v4 and
	 * ips-v6, checked 2026-11-15). Update here or with the `exacoat_cloudflare_ip_ranges` filter.
	 */
	const CLOUDFLARE_IP_RANGES = [
		'173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
		'141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
		'197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
		'104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
		'2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
		'2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
	];

	/** REMOTE_ADDR as the web server set it, captured when the plugin loads. */
	private static $original_remote_addr = null;

	/**
	 * Keeps the web server's REMOTE_ADDR before any code (or header copy) can rewrite it.
	 * Called when this file loads, which is before every plugin hook runs.
	 */
	public static function capture_remote_addr(): void {
		if ( null === self::$original_remote_addr && isset( $_SERVER['REMOTE_ADDR'] ) && '' !== (string) $_SERVER['REMOTE_ADDR'] ) {
			self::$original_remote_addr = (string) $_SERVER['REMOTE_ADDR'];
		}
	}

	public static function remote_addr(): string {
		return trim( null !== self::$original_remote_addr ? self::$original_remote_addr : (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	}

	public static function client_ip_payload( string $ip, int $ts ): string {
		return self::CLIENT_IP_VERSION . "\n" . $ip . "\n" . $ts;
	}

	public static function client_ip_signature( string $secret, string $ip, int $ts ): string {
		return hash_hmac( 'sha256', self::client_ip_payload( $ip, $ts ), $secret );
	}

	private static function secret(): string {
		if ( class_exists( 'Exacoat_Configurator_Engine' ) && method_exists( 'Exacoat_Configurator_Engine', 'cart_price_secret' ) ) {
			return Exacoat_Configurator_Engine::cart_price_secret();
		}
		return ( defined( 'EXACOAT_CART_PRICE_SECRET' ) && is_string( EXACOAT_CART_PRICE_SECRET ) && strlen( EXACOAT_CART_PRICE_SECRET ) >= 32 ) ? EXACOAT_CART_PRICE_SECRET : '';
	}

	/** Customer IP forwarded by the storefront server with a valid signature, or null. */
	public static function signed_storefront_ip(): ?string {
		$ip  = trim( (string) ( $_SERVER['HTTP_X_EXACOAT_CLIENT_IP'] ?? '' ) );
		$ts  = trim( (string) ( $_SERVER['HTTP_X_EXACOAT_CLIENT_IP_TS'] ?? '' ) );
		$sig = strtolower( trim( (string) ( $_SERVER['HTTP_X_EXACOAT_CLIENT_IP_SIG'] ?? '' ) ) );
		if ( '' === $ip || ! ctype_digit( $ts ) || ! preg_match( '/^[0-9a-f]{64}$/', $sig ) || false === filter_var( $ip, FILTER_VALIDATE_IP ) ) {
			return null;
		}
		if ( abs( time() - (int) $ts ) > self::CLIENT_IP_MAX_SKEW ) {
			return null;
		}
		$secret = self::secret();
		if ( strlen( $secret ) < 32 ) {
			return null;
		}
		return hash_equals( self::client_ip_signature( $secret, $ip, (int) $ts ), $sig ) ? $ip : null;
	}

	public static function client_ip(): string {
		$signed = self::signed_storefront_ip();
		if ( null !== $signed ) {
			return $signed;
		}
		$remote = self::remote_addr();
		$cf     = trim( (string) ( $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '' ) );
		if ( '' !== $cf && false !== filter_var( $cf, FILTER_VALIDATE_IP ) && false !== filter_var( $remote, FILTER_VALIDATE_IP ) ) {
			$ranges = (array) apply_filters( 'exacoat_cloudflare_ip_ranges', self::CLOUDFLARE_IP_RANGES );
			foreach ( $ranges as $cidr ) {
				if ( self::ip_in_cidr( $remote, (string) $cidr ) ) {
					return $cf;
				}
			}
		}
		return '' !== $remote ? $remote : 'unknown';
	}

	/** Whether $ip (IPv4 or IPv6) is inside $cidr. */
	public static function ip_in_cidr( string $ip, string $cidr ): bool {
		$parts = explode( '/', $cidr, 2 );
		$addr  = @inet_pton( $ip );
		$net   = @inet_pton( $parts[0] );
		if ( false === $addr || false === $net || strlen( $addr ) !== strlen( $net ) ) {
			return false;
		}
		$bits = isset( $parts[1] ) ? (int) $parts[1] : strlen( $net ) * 8;
		$full = intdiv( $bits, 8 );
		if ( substr( $addr, 0, $full ) !== substr( $net, 0, $full ) ) {
			return false;
		}
		$rest = $bits % 8;
		if ( 0 === $rest ) {
			return true;
		}
		$mask = ( 0xff << ( 8 - $rest ) ) & 0xff;
		return ( ord( $addr[ $full ] ) & $mask ) === ( ord( $net[ $full ] ) & $mask );
	}

	private static function key( string $bucket, string $subject ): string {
		return 'exacoat_rl_' . $bucket . '_' . md5( strtolower( $subject ) );
	}

	private static function use_object_cache(): bool {
		return function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache()
			&& function_exists( 'wp_cache_add' ) && function_exists( 'wp_cache_incr' );
	}

	/**
	 * Counts one event for $subject; true when $limit events were already counted in the window.
	 * With a persistent object cache the increment is atomic (wp_cache_add then wp_cache_incr).
	 * Without one it falls back to a transient read and write, so two requests at the same
	 * moment can both pass; the limits are sized so that race only lets a few extra through.
	 */
	public static function hit( string $bucket, string $subject, int $limit, int $window ): bool {
		$key = self::key( $bucket, $subject );
		if ( self::use_object_cache() ) {
			wp_cache_add( $key, 0, 'exacoat_rl', $window );
			$count = (int) wp_cache_incr( $key, 1, 'exacoat_rl' );
			return $count > $limit;
		}
		$count = (int) get_transient( $key );
		if ( $count >= $limit ) {
			return true;
		}
		set_transient( $key, $count + 1, $window );
		return false;
	}

	/** True when $subject already reached $limit, without counting. */
	public static function is_over( string $bucket, string $subject, int $limit ): bool {
		$key = self::key( $bucket, $subject );
		$count = self::use_object_cache() ? (int) wp_cache_get( $key, 'exacoat_rl' ) : (int) get_transient( $key );
		return $count >= $limit;
	}

	public static function clear( string $bucket, string $subject ): void {
		$key = self::key( $bucket, $subject );
		if ( self::use_object_cache() ) {
			wp_cache_delete( $key, 'exacoat_rl' );
		}
		delete_transient( $key );
	}
}

Exacoat_Request_Guard::capture_remote_addr();
