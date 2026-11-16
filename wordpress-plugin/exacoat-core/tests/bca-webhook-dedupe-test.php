<?php
/**
 * Standalone check: a BCA credit delivered twice (forwarder retry, or direct plus relay) is
 * recorded once in the global seen store and the repeat is ignored, so it cannot pay a second order.
 * Run: php wordpress-plugin/exacoat-core/tests/bca-webhook-dedupe-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['options']   = [];
$GLOBALS['transient'] = [];
function get_option( $k, $d = false ) { return array_key_exists( $k, $GLOBALS['options'] ) ? $GLOBALS['options'][ $k ] : $d; }
function update_option( $k, $v, $autoload = null ) { $GLOBALS['options'][ $k ] = $v; $GLOBALS['autoload'][ $k ] = $autoload; return true; }
function delete_option( $k ) { unset( $GLOBALS['options'][ $k ] ); return true; }
function get_transient( $k ) { return $GLOBALS['transient'][ $k ] ?? false; }
function set_transient( $k, $v, $t = 0 ) { $GLOBALS['transient'][ $k ] = $v; return true; }
function delete_transient( $k ) { unset( $GLOBALS['transient'][ $k ] ); return true; }
function wp_cache_delete( $k, $g = '' ) { return true; }
function sanitize_text_field( $s ) { return trim( strip_tags( (string) $s ) ); }
function sanitize_textarea_field( $s ) { return trim( strip_tags( (string) $s ) ); }
function wp_unslash( $s ) { return is_string( $s ) ? stripslashes( $s ) : $s; }
function wp_next_scheduled( $h ) { return false; }
function wp_schedule_single_event( $t, $h ) { return true; }
function current_time( $t ) { return gmdate( 'Y-m-d H:i:s' ); }

/** Options table with the lock row semantics the plugin relies on (INSERT IGNORE on option_name). */
class Fake_WPDB {
	public $options = 'wp_options';
	public function prepare( $sql, ...$args ) { return [ $sql, $args ]; }
	public function query( $q ) {
		[ $sql, $args ] = $q;
		if ( 0 === strpos( $sql, 'INSERT IGNORE' ) ) {
			if ( array_key_exists( $args[0], $GLOBALS['options'] ) ) {
				return 0;
			}
			$GLOBALS['options'][ $args[0] ] = $args[1];
			return 1;
		}
		if ( 0 === strpos( $sql, 'DELETE' ) ) {
			if ( ( $GLOBALS['options'][ $args[0] ] ?? null ) === $args[1] ) {
				unset( $GLOBALS['options'][ $args[0] ] );
				return 1;
			}
			return 0;
		}
		return false;
	}
	public function get_var( $q ) { return $GLOBALS['options'][ $q[1][0] ] ?? null; }
}
$GLOBALS['wpdb'] = new Fake_WPDB();

class WP_REST_Request {
	private $p;
	private $h;
	public function __construct( array $p = [], array $h = [] ) { $this->p = $p; $this->h = $h; }
	public function get_param( $k ) { return $this->p[ $k ] ?? null; }
	public function get_params() { return $this->p; }
	public function get_header( $k ) { return $this->h[ strtolower( $k ) ] ?? null; }
}
class WP_REST_Response {
	public $data;
	public $status;
	public function __construct( $d = null, $s = 200 ) { $this->data = $d; $this->status = $s; }
	public function get_data() { return $this->data; }
	public function get_status() { return $this->status; }
}

require_once __DIR__ . '/../includes/class-bca-payment-webhook.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};

$W = 'Exacoat_BCA_Payment_Webhook';

// Key: the MesinOtomatis mutation id when present, else the amount and description hash used on the order.
$check( $W::mutation_hash( 150023, '  TRSF E-BANKING CR 1234  ' ), md5( '150023|TRSF E-BANKING CR 1234' ), 'hash trims the description' );
$check( $W::mutation_key( 150023, 'TRSF', '' ), 'h:' . md5( '150023|TRSF' ), 'no id: key on the hash' );
$check( $W::mutation_key( 150023, 'TRSF', 'MUT-77' ), 'id:MUT-77', 'id: key on the id' );
$check( $W::mutation_key( 150023, 'TRSF', '   ' ), 'h:' . md5( '150023|TRSF' ), 'blank id falls back to the hash' );

// Pure claim and prune.
$now = 1800000000;
[ $fresh, $seen ] = $W::claim_seen_mutation( [], 'h:a', $now );
$check( $fresh, true, 'first sighting is fresh' );
$check( $seen, [ 'h:a' => $now ], 'first sighting recorded' );
[ $fresh, $seen2 ] = $W::claim_seen_mutation( $seen, 'h:a', $now + 60 );
$check( $fresh, false, 'second sighting is a duplicate' );
$check( $seen2, [ 'h:a' => $now ], 'duplicate keeps the first time' );
[ $fresh, $seen3 ] = $W::claim_seen_mutation( [ 'h:old' => $now - 8 * 86400, 'h:a' => $now - 6 * 86400 ], 'h:b', $now );
$check( $fresh, true, 'new key with history is fresh' );
$check( array_keys( $seen3 ), [ 'h:a', 'h:b' ], 'entries older than 7 days pruned' );
[ $fresh, ] = $W::claim_seen_mutation( [ 'h:a' => $now - 8 * 86400 ], 'h:a', $now );
$check( $fresh, true, 'an entry older than 7 days no longer blocks' );
[ $fresh, $seen4 ] = $W::claim_seen_mutation( [ 'h:a' => 'garbage' ], 'h:a', $now );
$check( $fresh, true, 'non numeric entry is dropped' );

// Full request path.
$token = 'bca-webhook-token-0123456789abcdef';
$GLOBALS['options']['exacoat_bca_webhook_token'] = $token;
$post = fn( array $p ) => $W::handle_webhook_request( new WP_REST_Request( $p + [ 'token' => $token ] ) );

$r1 = $post( [ 'amount' => '150023', 'description' => 'TRSF E-BANKING CR 0811 BUDI' ] );
$check( $r1->get_status(), 200, 'first delivery processed' );
$check( $r1->get_data()['status'] ?? null, null, 'first delivery is not a duplicate' );
$key = 'h:' . md5( '150023|TRSF E-BANKING CR 0811 BUDI' );
$check( isset( $GLOBALS['options']['exa_bca_seen_mutations'][ $key ] ), true, 'unmatched credit still recorded' );
$check( $GLOBALS['autoload']['exa_bca_seen_mutations'], false, 'seen store not autoloaded' );
$check( isset( $GLOBALS['options']['exa_bca_seen_lock'] ), false, 'lock released' );

$r2 = $post( [ 'amount' => '150.023', 'keterangan' => ' TRSF E-BANKING CR 0811 BUDI ' ] );
$check( $r2->get_status(), 200, 'repeat answers 200 so the forwarder stops retrying' );
$check( $r2->get_data()['success'] ?? null, true, 'repeat success' );
$check( $r2->get_data()['status'] ?? null, 'duplicate_ignored', 'repeat flagged duplicate, ignored' );
$check( get_option( 'exawebhook_queue', [] ), [], 'repeat never queued' );

// Same amount and text but distinct MesinOtomatis ids: two real transfers, both processed.
$r3 = $post( [ 'amount' => '99000', 'description' => 'SAME', 'mutation_id' => 'M1' ] );
$r4 = $post( [ 'amount' => '99000', 'description' => 'SAME', 'id' => 'M2' ] );
$check( $r3->get_data()['status'] ?? null, null, 'id M1 processed' );
$check( $r4->get_data()['status'] ?? null, null, 'id M2 processed' );
$r5 = $post( [ 'amount' => '99000', 'description' => 'SAME', 'mutation_id' => 'M1' ] );
$check( $r5->get_data()['status'] ?? null, 'duplicate_ignored', 'id M1 again ignored' );

// Lock held by another request: no order work, 503 so the forwarder retries later.
$other_lock = time() . ':other';
$GLOBALS['options']['exa_bca_seen_lock'] = $other_lock;
$r6 = $post( [ 'amount' => '120000', 'description' => 'BUSY' ] );
$check( $r6->get_status(), 503, 'busy lock answers 503' );
$check( isset( $GLOBALS['options']['exa_bca_seen_mutations'][ 'h:' . md5( '120000|BUSY' ) ] ), false, 'busy credit not recorded' );
$check( $GLOBALS['options']['exa_bca_seen_lock'] ?? null, $other_lock, 'other holder lock untouched' );
// A lock left behind long ago is broken.
$GLOBALS['options']['exa_bca_seen_lock'] = ( time() - 60 ) . ':crashed';
$r7 = $post( [ 'amount' => '120000', 'description' => 'BUSY' ] );
$check( $r7->get_status(), 200, 'stale lock broken' );

// Logged context never carries the MesinOtomatis account key or other credentials.
$check(
	$W::loggable_params( [ 'id' => '165843346', 'key' => str_repeat( 'a', 32 ), 'Signature' => 'x', 'api_key' => 'y', 'secret' => 'z', 'amount' => '186026' ] ),
	[ 'id' => '165843346', 'amount' => '186026' ],
	'credentials removed from logged context'
);

if ( $fails > 0 ) {
	echo "$fails check(s) failed\n";
	exit( 1 );
}
echo "bca webhook dedupe: all checks passed\n";
