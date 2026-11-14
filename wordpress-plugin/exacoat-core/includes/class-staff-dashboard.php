<?php
/**
 * Exacoat Staff Dashboard
 *
 * Team notes shared by every staff member (stored in WordPress, never in a browser) and the list of
 * international orders handed to the courier but still not marked shipped.
 *
 * Routes (exacoat-core/v1 and exacoat/v1, permission: Exacoat_Core::verify_bridge_permission):
 *   GET    /staff/notes                 list notes
 *   POST   /staff/notes                 create a note { text }
 *   POST   /staff/notes/{id}            update { pinned?, done? } (PATCH and PUT accepted too)
 *   DELETE /staff/notes/{id}            delete (author or administrator)
 *   GET    /staff/overdue-international ready-to-ship orders outside Indonesia, more than 2 days after pickup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Staff_Dashboard' ) ) {

class Exacoat_Staff_Dashboard {

	const OPTION_NOTES   = 'exacoat_staff_notes';
	/** Row used as a mutex around note writes (value: "{unix time}:{token}"). */
	const OPTION_LOCK    = 'exacoat_staff_notes_lock';
	/** A lock older than this many seconds is treated as left behind by a crashed request. */
	const LOCK_STALE     = 10;
	const LOCK_ATTEMPTS  = 5;
	const NOTES_CAP      = 300;
	const NOTE_MAX_CHARS = 2000;
	/** Overdue after more than this many seconds since pickup (2 full days). */
	const OVERDUE_AFTER  = 172800;
	/** Upper bound on ready-to-ship orders inspected per request. */
	const QUERY_LIMIT    = 300;
	/** UTC with a Z suffix (the manager reads +00:00 as legacy store time). */
	const ISO_UTC        = 'Y-m-d\TH:i:s\Z';

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
	}

	public static function register_rest_routes(): void {
		$permission = [ 'Exacoat_Core', 'verify_bridge_permission' ];
		foreach ( [ 'exacoat-core/v1', 'exacoat/v1' ] as $ns ) {
			register_rest_route( $ns, '/staff/notes', [
				[
					'methods'             => 'GET',
					'callback'            => [ __CLASS__, 'rest_list_notes' ],
					'permission_callback' => $permission,
				],
				[
					'methods'             => 'POST',
					'callback'            => [ __CLASS__, 'rest_create_note' ],
					'permission_callback' => $permission,
				],
			] );
			register_rest_route( $ns, '/staff/notes/(?P<id>[a-z0-9]{1,32})', [
				[
					'methods'             => [ 'POST', 'PUT', 'PATCH' ],
					'callback'            => [ __CLASS__, 'rest_update_note' ],
					'permission_callback' => $permission,
				],
				[
					'methods'             => 'DELETE',
					'callback'            => [ __CLASS__, 'rest_delete_note' ],
					'permission_callback' => $permission,
				],
			] );
			register_rest_route( $ns, '/staff/overdue-international', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_overdue_international' ],
				'permission_callback' => $permission,
			] );
		}
	}

	// ------------------------------------------------------------------
	// Pure helpers (covered by tests/staff-dashboard-test.php)
	// ------------------------------------------------------------------

	/**
	 * Pick the courier pickup time. Each input is a Unix timestamp or null.
	 * Order: Goorita booking, Rayspeed booking, time the order entered ready-to-ship, last modified.
	 *
	 * @return array{ts:int,source:string}|null
	 */
	public static function resolve_pickup_time( ?int $goorita, ?int $rayspeed, ?int $status_entered, ?int $modified ): ?array {
		$candidates = [
			'goorita'      => $goorita,
			'rayspeed'     => $rayspeed,
			'status_note'  => $status_entered,
			'modified'     => $modified,
		];
		foreach ( $candidates as $source => $ts ) {
			if ( is_int( $ts ) && $ts > 0 ) {
				return [ 'ts' => $ts, 'source' => $source ];
			}
		}
		return null;
	}

	/** Full 24 hour periods since the pickup time (0 when the time is in the future). */
	public static function full_days_since( int $pickup_ts, int $now ): int {
		$elapsed = $now - $pickup_ts;
		return $elapsed > 0 ? intdiv( $elapsed, 86400 ) : 0;
	}

	/** Overdue: more than 2 full days (48 hours) since pickup. */
	public static function is_overdue( int $pickup_ts, int $now ): bool {
		return ( $now - $pickup_ts ) > self::OVERDUE_AFTER;
	}

	/** International: a known shipping country that is not Indonesia. */
	public static function is_international( string $country ): bool {
		$c = strtoupper( trim( $country ) );
		return '' !== $c && 'ID' !== $c;
	}

	/**
	 * Parse a stored local time ("Y-m-d H:i:s" written with current_time('mysql')) in the site timezone.
	 */
	public static function parse_local_time( $value, DateTimeZone $tz ): ?int {
		if ( is_int( $value ) ) {
			return $value > 0 ? $value : null;
		}
		$s = trim( (string) $value );
		if ( '' === $s ) {
			return null;
		}
		if ( ctype_digit( $s ) ) {
			$n = (int) $s;
			return $n > 0 ? $n : null;
		}
		try {
			$dt = new DateTimeImmutable( $s, $tz );
		} catch ( Exception $e ) {
			return null;
		}
		$ts = $dt->getTimestamp();
		return $ts > 0 ? $ts : null;
	}

	/**
	 * Latest time an order entered the given status, from WooCommerce status change notes
	 * ("Order status changed from Payment confirmed to Waiting for Courier Pickup.").
	 *
	 * @param array<int,array{content:string,ts:int}> $notes
	 * @param string[]                                $labels Status names to match (label and slug).
	 */
	public static function status_entered_from_notes( array $notes, array $labels ): ?int {
		$latest = null;
		foreach ( $notes as $note ) {
			$content = strtolower( self::strip_tags_safe( (string) ( $note['content'] ?? '' ) ) );
			$ts      = (int) ( $note['ts'] ?? 0 );
			if ( $ts <= 0 || false === strpos( $content, 'status changed' ) ) {
				continue;
			}
			foreach ( $labels as $label ) {
				$label = strtolower( trim( (string) $label ) );
				if ( '' === $label ) {
					continue;
				}
				if ( preg_match( '/\bto\s+' . preg_quote( $label, '/' ) . '\s*(?:[.!,]|$)/', $content ) ) {
					if ( null === $latest || $ts > $latest ) {
						$latest = $ts;
					}
					break;
				}
			}
		}
		return $latest;
	}

	/**
	 * Keep at most $cap notes: drop done notes first, then unpinned, oldest first in each group.
	 *
	 * @param array<int,array> $notes
	 */
	public static function cap_notes( array $notes, int $cap ): array {
		$notes = array_values( $notes );
		$over  = count( $notes ) - $cap;
		if ( $over <= 0 ) {
			return $notes;
		}
		$rank = static function ( array $n ): int {
			if ( ! empty( $n['done'] ) ) {
				return 0;
			}
			return empty( $n['pinned'] ) ? 1 : 2;
		};
		$order = array_keys( $notes );
		usort( $order, static function ( $a, $b ) use ( $notes, $rank ) {
			$r = $rank( $notes[ $a ] ) <=> $rank( $notes[ $b ] );
			if ( 0 !== $r ) {
				return $r;
			}
			return ( (int) ( $notes[ $a ]['created_at'] ?? 0 ) ) <=> ( (int) ( $notes[ $b ]['created_at'] ?? 0 ) );
		} );
		$drop = array_flip( array_slice( $order, 0, $over ) );
		$kept = [];
		foreach ( $notes as $i => $n ) {
			if ( ! isset( $drop[ $i ] ) ) {
				$kept[] = $n;
			}
		}
		return $kept;
	}

	/** Whether a lock value ("{unix time}:{token}") is old enough to break. */
	public static function lock_is_stale( string $value, int $now ): bool {
		$ts = (int) strtok( $value, ':' );
		return $ts <= 0 || ( $now - $ts ) > self::LOCK_STALE;
	}

	/**
	 * Run $work while holding a lock. $try_acquire is called up to $attempts times ($pause between tries);
	 * the lock is always released after $work. When it cannot be taken, $on_busy's result is returned.
	 */
	public static function with_lock( callable $try_acquire, callable $release, callable $work, callable $on_busy, int $attempts = self::LOCK_ATTEMPTS, ?callable $pause = null ) {
		for ( $i = 0; $i < $attempts; $i++ ) {
			if ( $try_acquire() ) {
				try {
					return $work();
				} finally {
					$release();
				}
			}
			if ( $pause && $i < $attempts - 1 ) {
				$pause( $i );
			}
		}
		return $on_busy();
	}

	/** wp_strip_all_tags when WordPress is loaded, strip_tags otherwise (standalone tests). */
	private static function strip_tags_safe( string $s ): string {
		return function_exists( 'wp_strip_all_tags' ) ? wp_strip_all_tags( $s ) : strip_tags( $s );
	}

	/** Whether this user may delete the note: its author, or an administrator. */
	public static function can_delete_note( array $note, int $user_id, bool $is_admin ): bool {
		if ( $is_admin ) {
			return true;
		}
		return $user_id > 0 && (int) ( $note['author_id'] ?? 0 ) === $user_id;
	}

	// ------------------------------------------------------------------
	// Notes storage
	// ------------------------------------------------------------------

	/**
	 * Take the notes lock with INSERT IGNORE on the options table: atomic on the unique option_name
	 * (add_option() is not, it uses ON DUPLICATE KEY UPDATE). A stale lock is removed only while it
	 * still holds the value read, so two requests cannot both break it.
	 */
	private static function try_acquire_notes_lock( string $token ): bool {
		global $wpdb;
		$inserted = $wpdb->query( $wpdb->prepare(
			"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
			self::OPTION_LOCK,
			$token
		) );
		if ( 1 === (int) $inserted ) {
			return true;
		}
		$held = (string) $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", self::OPTION_LOCK ) );
		if ( '' !== $held && self::lock_is_stale( $held, time() ) ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s", self::OPTION_LOCK, $held ) );
		}
		return false;
	}

	private static function release_notes_lock( string $token ): void {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s", self::OPTION_LOCK, $token ) );
	}

	/** Read-change-write of the notes under the lock; HTTP 409 when another write keeps holding it. */
	private static function locked( callable $work ) {
		$token = time() . ':' . bin2hex( random_bytes( 8 ) );
		return self::with_lock(
			static fn() => self::try_acquire_notes_lock( $token ),
			static function () use ( $token ) {
				self::release_notes_lock( $token );
			},
			$work,
			static fn() => new WP_Error( 'exacoat_staff_notes_busy', 'Notes are busy, try again.', [ 'status' => 409 ] ),
			self::LOCK_ATTEMPTS,
			static function () {
				usleep( 150000 );
			}
		);
	}

	private static function read_notes( bool $fresh = false ): array {
		if ( $fresh && function_exists( 'wp_cache_delete' ) ) {
			// Inside the lock, never trust an object-cached copy from before another request's save.
			wp_cache_delete( self::OPTION_NOTES, 'options' );
		}
		$raw = get_option( self::OPTION_NOTES, [] );
		if ( ! is_array( $raw ) ) {
			return [];
		}
		return array_values( array_filter( $raw, static fn( $n ) => is_array( $n ) && ! empty( $n['id'] ) ) );
	}

	private static function write_notes( array $notes ): void {
		$notes = self::cap_notes( $notes, self::NOTES_CAP );
		if ( false === get_option( self::OPTION_NOTES, false ) ) {
			add_option( self::OPTION_NOTES, $notes, '', false );
		} else {
			update_option( self::OPTION_NOTES, $notes, false );
		}
	}

	private static function format_note( array $n ): array {
		return [
			'id'          => (string) $n['id'],
			'text'        => (string) ( $n['text'] ?? '' ),
			'author_id'   => (int) ( $n['author_id'] ?? 0 ),
			'author_name' => (string) ( $n['author_name'] ?? '' ),
			'created_at'  => gmdate( self::ISO_UTC, (int) ( $n['created_at'] ?? 0 ) ),
			'updated_at'  => gmdate( self::ISO_UTC, (int) ( $n['updated_at'] ?? ( $n['created_at'] ?? 0 ) ) ),
			'pinned'      => ! empty( $n['pinned'] ),
			'done'        => ! empty( $n['done'] ),
		];
	}

	private static function current_is_admin(): bool {
		return current_user_can( 'manage_options' );
	}

	private static function require_user() {
		$uid = get_current_user_id();
		if ( $uid <= 0 ) {
			return new WP_Error( 'exacoat_staff_sign_in', 'Sign in as a staff member to change team notes.', [ 'status' => 403 ] );
		}
		return $uid;
	}

	public static function rest_list_notes( WP_REST_Request $request ): WP_REST_Response {
		$notes = array_map( [ __CLASS__, 'format_note' ], self::read_notes() );
		return rest_ensure_response( [
			'success'         => true,
			'notes'           => $notes,
			'current_user_id' => get_current_user_id(),
			'can_moderate'    => self::current_is_admin(),
		] );
	}

	public static function rest_create_note( WP_REST_Request $request ) {
		$uid = self::require_user();
		if ( is_wp_error( $uid ) ) {
			return $uid;
		}
		$params = $request->get_json_params() ?: $request->get_params();
		$text   = trim( sanitize_textarea_field( (string) ( $params['text'] ?? '' ) ) );
		if ( '' === $text ) {
			return new WP_Error( 'exacoat_staff_note_empty', 'Write a note first.', [ 'status' => 400 ] );
		}
		if ( function_exists( 'mb_substr' ) ) {
			$text = mb_substr( $text, 0, self::NOTE_MAX_CHARS );
		} else {
			$text = substr( $text, 0, self::NOTE_MAX_CHARS );
		}
		$user = get_userdata( $uid );
		$now  = time();
		$note = [
			'id'          => 'n' . bin2hex( random_bytes( 6 ) ),
			'text'        => $text,
			'author_id'   => $uid,
			'author_name' => $user ? (string) $user->display_name : '',
			'created_at'  => $now,
			'updated_at'  => $now,
			'pinned'      => false,
			'done'        => false,
		];
		return self::locked( static function () use ( $note ) {
			$notes   = self::read_notes( true );
			$notes[] = $note;
			self::write_notes( $notes );
			return rest_ensure_response( [ 'success' => true, 'note' => self::format_note( $note ) ] );
		} );
	}

	public static function rest_update_note( WP_REST_Request $request ) {
		$uid = self::require_user();
		if ( is_wp_error( $uid ) ) {
			return $uid;
		}
		$id     = (string) $request->get_param( 'id' );
		$params = $request->get_json_params() ?: $request->get_params();
		return self::locked( static function () use ( $id, $params ) {
			$notes = self::read_notes( true );
			foreach ( $notes as $i => $n ) {
				if ( (string) $n['id'] !== $id ) {
					continue;
				}
				if ( array_key_exists( 'pinned', $params ) ) {
					$n['pinned'] = rest_sanitize_boolean( $params['pinned'] );
				}
				if ( array_key_exists( 'done', $params ) ) {
					$n['done'] = rest_sanitize_boolean( $params['done'] );
				}
				$n['updated_at'] = time();
				$notes[ $i ]     = $n;
				self::write_notes( $notes );
				return rest_ensure_response( [ 'success' => true, 'note' => self::format_note( $n ) ] );
			}
			return new WP_Error( 'exacoat_staff_note_missing', 'This note no longer exists.', [ 'status' => 404 ] );
		} );
	}

	public static function rest_delete_note( WP_REST_Request $request ) {
		$uid = self::require_user();
		if ( is_wp_error( $uid ) ) {
			return $uid;
		}
		$id    = (string) $request->get_param( 'id' );
		$is_admin = self::current_is_admin();
		return self::locked( static function () use ( $id, $uid, $is_admin ) {
			$notes = self::read_notes( true );
			foreach ( $notes as $i => $n ) {
				if ( (string) $n['id'] !== $id ) {
					continue;
				}
				if ( ! self::can_delete_note( $n, $uid, $is_admin ) ) {
					return new WP_Error( 'exacoat_staff_note_forbidden', 'Only the author or an administrator can delete this note.', [ 'status' => 403 ] );
				}
				unset( $notes[ $i ] );
				self::write_notes( array_values( $notes ) );
				return rest_ensure_response( [ 'success' => true, 'id' => $id ] );
			}
			return new WP_Error( 'exacoat_staff_note_missing', 'This note no longer exists.', [ 'status' => 404 ] );
		} );
	}

	// ------------------------------------------------------------------
	// Overdue international orders
	// ------------------------------------------------------------------

	private static function rayspeed_booked_ts( WC_Order $order, DateTimeZone $tz ): ?int {
		if ( '' === (string) $order->get_meta( '_rayspeed_awb' ) ) {
			return null;
		}
		$info = $order->get_meta( '_exacoat_tracking_info' );
		if ( is_array( $info ) && 'rayspeed' === strtolower( (string) ( $info['carrier_id'] ?? '' ) ) ) {
			return self::parse_local_time( $info['created_at'] ?? '', $tz );
		}
		return null;
	}

	private static function status_entered_ts( WC_Order $order, array $labels ): ?int {
		if ( ! function_exists( 'wc_get_order_notes' ) ) {
			return null;
		}
		$notes = [];
		foreach ( (array) wc_get_order_notes( [ 'order_id' => $order->get_id(), 'type' => 'internal', 'limit' => 50 ] ) as $note ) {
			$created = isset( $note->date_created ) && $note->date_created ? $note->date_created->getTimestamp() : 0;
			$notes[] = [ 'content' => (string) ( $note->content ?? '' ), 'ts' => (int) $created ];
		}
		return self::status_entered_from_notes( $notes, $labels );
	}

	public static function rest_overdue_international( WP_REST_Request $request ): WP_REST_Response {
		$tz     = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$now    = time();
		$labels = array_unique( array_filter( [
			function_exists( 'wc_get_order_status_name' ) ? wc_get_order_status_name( 'ready-to-ship' ) : '',
			'Waiting for Courier Pickup',
			'Ready to ship',
			'ready-to-ship',
		] ) );

		$orders = function_exists( 'wc_get_orders' ) ? wc_get_orders( [
			'status'  => [ 'ready-to-ship' ],
			'type'    => 'shop_order',
			'limit'   => self::QUERY_LIMIT,
			'orderby' => 'date',
			'order'   => 'ASC',
			'return'  => 'objects',
		] ) : [];

		$countries = ( function_exists( 'WC' ) && WC()->countries ) ? WC()->countries->get_countries() : [];
		$rows      = [];
		foreach ( (array) $orders as $order ) {
			if ( ! $order instanceof WC_Order ) {
				continue;
			}
			$country = (string) ( $order->get_shipping_country() ?: $order->get_billing_country() );
			if ( ! self::is_international( $country ) ) {
				continue;
			}
			$goorita  = self::parse_local_time( $order->get_meta( '_goorita_booked_at' ), $tz );
			$rayspeed = $goorita ? null : self::rayspeed_booked_ts( $order, $tz );
			$entered  = ( $goorita || $rayspeed ) ? null : self::status_entered_ts( $order, $labels );
			$modified = $order->get_date_modified() ? $order->get_date_modified()->getTimestamp() : null;
			$pickup   = self::resolve_pickup_time( $goorita, $rayspeed, $entered, $modified );
			if ( null === $pickup || ! self::is_overdue( $pickup['ts'], $now ) ) {
				continue;
			}
			$name = trim( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() );
			if ( '' === $name ) {
				$name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
			}
			$code    = strtoupper( $country );
			$courier = (string) ( $order->get_meta( '_carrier_id' ) ?: $order->get_meta( 'carrier_id' ) );
			if ( '' === $courier ) {
				$courier = (string) $order->get_shipping_method();
			}
			$rows[] = [
				'id'            => $order->get_id(),
				'number'        => (string) $order->get_order_number(),
				'customer_name' => $name,
				'country'       => $code,
				'country_name'  => html_entity_decode( (string) ( $countries[ $code ] ?? $code ), ENT_QUOTES ),
				'courier'       => $courier,
				'pickup_at'     => gmdate( self::ISO_UTC, $pickup['ts'] ),
				'pickup_source' => $pickup['source'],
				'days'          => self::full_days_since( $pickup['ts'], $now ),
			];
		}

		usort( $rows, static fn( $a, $b ) => strcmp( $a['pickup_at'], $b['pickup_at'] ) );

		return rest_ensure_response( [
			'success'   => true,
			'orders'    => $rows,
			'truncated' => count( (array) $orders ) >= self::QUERY_LIMIT,
		] );
	}
}

}
