<?php
/**
 * Standalone check for the staff dashboard pure rules (pickup time, overdue, notes cap).
 * Run: php wordpress-plugin/exacoat-core/tests/staff-dashboard-test.php
 */
define( 'ABSPATH', __DIR__ . '/' );
require_once __DIR__ . '/../includes/class-staff-dashboard.php';

$fails = 0;
$check = function ( $actual, $expected, string $label ) use ( &$fails ) {
	if ( $actual !== $expected ) {
		$fails++;
		echo 'FAIL ' . $label . ': expected ' . var_export( $expected, true ) . ' got ' . var_export( $actual, true ) . "\n";
	}
};
$S = 'Exacoat_Staff_Dashboard';

// Pickup time source order.
$check( $S::resolve_pickup_time( 100, 200, 300, 400 ), [ 'ts' => 100, 'source' => 'goorita' ], 'goorita first' );
$check( $S::resolve_pickup_time( null, 200, 300, 400 ), [ 'ts' => 200, 'source' => 'rayspeed' ], 'rayspeed second' );
$check( $S::resolve_pickup_time( null, null, 300, 400 ), [ 'ts' => 300, 'source' => 'status_note' ], 'status note third' );
$check( $S::resolve_pickup_time( null, null, null, 400 ), [ 'ts' => 400, 'source' => 'modified' ], 'modified last' );
$check( $S::resolve_pickup_time( 0, null, null, 400 ), [ 'ts' => 400, 'source' => 'modified' ], 'zero goorita ignored' );
$check( $S::resolve_pickup_time( null, null, null, null ), null, 'no time at all' );

// Overdue: more than 48 hours.
$now = 1_800_000_000;
$check( $S::is_overdue( $now - 172800, $now ), false, 'exactly 48h is not overdue' );
$check( $S::is_overdue( $now - 172801, $now ), true, '48h and a second is overdue' );
$check( $S::is_overdue( $now - 3600, $now ), false, 'one hour' );
$check( $S::is_overdue( $now + 3600, $now ), false, 'future time' );
$check( $S::full_days_since( $now - 172801, $now ), 2, 'just over 2 days shows 2' );
$check( $S::full_days_since( $now - 86400 * 4 - 5, $now ), 4, '4 days' );
$check( $S::full_days_since( $now + 50, $now ), 0, 'future is 0 days' );

// International.
$check( $S::is_international( 'US' ), true, 'US' );
$check( $S::is_international( 'sg' ), true, 'lowercase sg' );
$check( $S::is_international( 'ID' ), false, 'Indonesia' );
$check( $S::is_international( ' id ' ), false, 'Indonesia padded' );
$check( $S::is_international( '' ), false, 'unknown country' );

// Local time parsing in the site timezone.
$jkt = new DateTimeZone( 'Asia/Jakarta' );
$check( $S::parse_local_time( '2026-11-10 07:00:00', $jkt ), gmmktime( 0, 0, 0, 11, 10, 2026 ), 'Jakarta 07:00 is 00:00 UTC' );
$check( $S::parse_local_time( '', $jkt ), null, 'empty' );
$check( $S::parse_local_time( 'not a date', $jkt ), null, 'garbage' );
$check( $S::parse_local_time( '1790000000', $jkt ), 1790000000, 'numeric string' );

// Entering ready-to-ship from status notes.
$labels = [ 'Waiting for Courier Pickup', 'ready-to-ship' ];
$notes  = [
	[ 'content' => 'Order status changed from Pending payment to Payment confirmed.', 'ts' => 100 ],
	[ 'content' => 'Order status changed from Payment confirmed to Waiting for Courier Pickup.', 'ts' => 200 ],
	[ 'content' => 'Order status changed from Waiting for Courier Pickup to Preparing order.', 'ts' => 300 ],
	[ 'content' => 'Order status changed from Preparing order to <b>Waiting for Courier Pickup</b>.', 'ts' => 400 ],
	[ 'content' => 'Customer asked about Waiting for Courier Pickup', 'ts' => 900 ],
];
$check( $S::status_entered_from_notes( $notes, $labels ), 400, 'latest entry into ready-to-ship' );
$check( $S::status_entered_from_notes( array_slice( $notes, 0, 1 ), $labels ), null, 'never entered' );
$check( $S::status_entered_from_notes( [ [ 'content' => 'Order status changed from processing to ready-to-ship.', 'ts' => 50 ] ], $labels ), 50, 'slug form' );
$check( $S::status_entered_from_notes( [ [ 'content' => 'Order status changed from processing to Waiting for Courier Pickup', 'ts' => 60 ] ], $labels ), 60, 'no trailing period' );

// Notes cap: done first, then unpinned, oldest first.
$mk = fn( $id, $ts, $pinned = false, $done = false ) => [ 'id' => $id, 'created_at' => $ts, 'pinned' => $pinned, 'done' => $done ];
$set = [ $mk( 'a', 1, true ), $mk( 'b', 2 ), $mk( 'c', 3, false, true ), $mk( 'd', 4 ), $mk( 'e', 5, false, true ) ];
$ids = fn( $list ) => array_map( fn( $n ) => $n['id'], $list );
$check( $ids( $S::cap_notes( $set, 5 ) ), [ 'a', 'b', 'c', 'd', 'e' ], 'under cap unchanged' );
$check( $ids( $S::cap_notes( $set, 4 ) ), [ 'a', 'b', 'd', 'e' ], 'oldest done goes first' );
$check( $ids( $S::cap_notes( $set, 3 ) ), [ 'a', 'b', 'd' ], 'both done go' );
$check( $ids( $S::cap_notes( $set, 2 ) ), [ 'a', 'd' ], 'then oldest unpinned' );
$check( $ids( $S::cap_notes( $set, 1 ) ), [ 'a' ], 'pinned kept last' );

// Delete permission.
$note = [ 'author_id' => 7 ];
$check( $S::can_delete_note( $note, 7, false ), true, 'author' );
$check( $S::can_delete_note( $note, 8, false ), false, 'other staff' );
$check( $S::can_delete_note( $note, 8, true ), true, 'administrator' );
$check( $S::can_delete_note( [ 'author_id' => 0 ], 0, false ), false, 'anonymous' );

// Notes lock.
$check( $S::lock_is_stale( ( $now - 5 ) . ':abc', $now ), false, 'fresh lock' );
$check( $S::lock_is_stale( ( $now - 10 ) . ':abc', $now ), false, 'lock at 10s is kept' );
$check( $S::lock_is_stale( ( $now - 11 ) . ':abc', $now ), true, 'lock over 10s is stale' );
$check( $S::lock_is_stale( 'garbage', $now ), true, 'unreadable lock is stale' );

$log  = [];
$held = false;
$acq  = function () use ( &$held, &$log ) {
	$log[] = 'try';
	if ( $held ) {
		return false;
	}
	$held = true;
	return true;
};
$rel  = function () use ( &$held, &$log ) {
	$log[] = 'release';
	$held  = false;
};
$busy = fn() => 'busy';
$check( $S::with_lock( $acq, $rel, fn() => 'done', $busy ), 'done', 'free lock runs the work' );
$check( $log, [ 'try', 'release' ], 'released after work' );
$check( $held, false, 'not held after work' );

$log    = [];
$held   = true;
$pauses = 0;
$check( $S::with_lock( $acq, $rel, fn() => 'done', $busy, 3, function () use ( &$pauses ) { $pauses++; } ), 'busy', 'held lock gives busy' );
$check( $log, [ 'try', 'try', 'try' ], 'retries then gives up without releasing another request lock' );
$check( $pauses, 2, 'pauses only between tries' );

$tries = 0;
$late  = function () use ( &$tries ) {
	return ++$tries >= 2;
};
$check( $S::with_lock( $late, fn() => null, fn() => 'done', $busy, 3 ), 'done', 'lock taken on a later try' );

$log   = [];
$held  = false;
$threw = false;
try {
	$S::with_lock( $acq, $rel, function () {
		throw new RuntimeException( 'boom' );
	}, $busy );
} catch ( RuntimeException $e ) {
	$threw = true;
}
$check( $threw && ! $held && 'release' === end( $log ), true, 'released when the work throws' );

if ( $fails ) {
	echo $fails . " failure(s)\n";
	exit( 1 );
}
echo "OK\n";
