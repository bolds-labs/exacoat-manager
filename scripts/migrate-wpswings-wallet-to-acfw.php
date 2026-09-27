<?php
/**
 * WPSwings Wallet to Advanced Coupons Store Credit Migration Script
 * Exacoat Headless Migration Suite
 *
 * Usage via WP-CLI on production server:
 *   Dry-Run (Inspection Only):
 *     wp eval-file migrate-wpswings-wallet-to-acfw.php --dry-run
 *
 *   Live Migration (Credits Advanced Coupons & Sets 1-Year Expiry):
 *     wp eval-file migrate-wpswings-wallet-to-acfw.php
 *
 *   Direct PHP CLI:
 *     php migrate-wpswings-wallet-to-acfw.php
 */

// If running outside WP-CLI, attempt to bootstrap WordPress
if ( ! defined( 'ABSPATH' ) ) {
	$wp_load_candidates = [
		__DIR__ . '/wp-load.php',
		__DIR__ . '/../wp-load.php',
		dirname( __DIR__, 2 ) . '/wp-load.php',
		'/home/exacoat/webapps/exacoat_v2/wp-load.php',
	];
	foreach ( $wp_load_candidates as $cand ) {
		if ( file_exists( $cand ) ) {
			require_once $cand;
			break;
		}
	}
}

if ( ! defined( 'ABSPATH' ) ) {
	echo "Error: WordPress environment not detected. Run this script with 'wp eval-file' inside your WordPress directory.\n";
	exit( 1 );
}

global $wpdb;

$is_dry_run = false;
if ( isset( $args ) && is_array( $args ) ) {
	$is_dry_run = in_array( '--dry-run', $args, true );
} elseif ( isset( $_SERVER['argv'] ) && is_array( $_SERVER['argv'] ) ) {
	$is_dry_run = in_array( '--dry-run', $_SERVER['argv'], true );
}

echo "====================================================================\n";
echo "Exacoat Store Credit Migration: WPSwings Wallet -> Advanced Coupons\n";
echo "Mode: " . ( $is_dry_run ? "DRY-RUN (Inspection Only - No Changes Made)" : "LIVE MIGRATION" ) . "\n";
echo "Date: " . date( 'Y-m-d H:i:s' ) . "\n";
echo "====================================================================\n\n";

// 1. Scan user meta for WPSwings wallet keys
$wallet_keys = [ 'wps_wallet', 'wps_wallet_cashback_bal', 'wallet_amount', '_current_wallet_amount', '_wallet_balance' ];
$keys_placeholder = "'" . implode( "','", array_map( 'esc_sql', $wallet_keys ) ) . "'";

$meta_results = $wpdb->get_results( "
	SELECT user_id, meta_key, meta_value 
	FROM {$wpdb->usermeta} 
	WHERE meta_key IN ({$keys_placeholder}) 
	  AND meta_value IS NOT NULL 
	  AND meta_value != '' 
	  AND meta_value != '0' 
	  AND meta_value != '0.00'
" );

$users_to_migrate = [];

if ( ! empty( $meta_results ) ) {
	foreach ( $meta_results as $row ) {
		$uid = (int) $row->user_id;
		$val = floatval( $row->meta_value );
		if ( $val > 0 ) {
			if ( ! isset( $users_to_migrate[ $uid ] ) || $val > $users_to_migrate[ $uid ] ) {
				$users_to_migrate[ $uid ] = $val;
			}
		}
	}
}

// 2. Scan custom WPSwings tables if present
$all_tables = $wpdb->get_col( "SHOW TABLES LIKE '%wallet%'" );
foreach ( $all_tables as $tbl ) {
	// Table: wp_wsfw_wallet or wp_wps_wallet
	if ( preg_match( '/(wsfw_wallet|wps_wallet)$/i', $tbl ) ) {
		$columns = $wpdb->get_col( "SHOW COLUMNS FROM {$tbl}" );
		$has_user = in_array( 'user_id', $columns, true );
		$amount_col = in_array( 'balance', $columns, true ) ? 'balance' : ( in_array( 'amount', $columns, true ) ? 'amount' : null );

		if ( $has_user && $amount_col ) {
			$custom_rows = $wpdb->get_results( "SELECT user_id, {$amount_col} AS bal FROM {$tbl} WHERE {$amount_col} > 0" );
			if ( ! empty( $custom_rows ) ) {
				foreach ( $custom_rows as $cr ) {
					$uid = (int) $cr->user_id;
					$bal = floatval( $cr->bal );
					if ( $bal > 0 ) {
						if ( ! isset( $users_to_migrate[ $uid ] ) || $bal > $users_to_migrate[ $uid ] ) {
							$users_to_migrate[ $uid ] = $bal;
						}
					}
				}
			}
		}
	}
}

// 3. Scan WPSwings transaction logs for any users with net positive credit
foreach ( $all_tables as $tbl ) {
	if ( preg_match( '/(wsfw_wallet_transactions?|wps_wallet_transactions?)$/i', $tbl ) ) {
		$tx_users = $wpdb->get_col( "SELECT DISTINCT user_id FROM {$tbl} WHERE user_id > 0" );
		if ( ! empty( $tx_users ) ) {
			foreach ( $tx_users as $uid_str ) {
				$uid = (int) $uid_str;
				if ( ! isset( $users_to_migrate[ $uid ] ) ) {
					// Check user's current live WPSwings balance
					$check_val = floatval( get_user_meta( $uid, 'wps_wallet', true ) );
					if ( ! $check_val ) {
						$check_val = floatval( get_user_meta( $uid, 'wallet_amount', true ) );
					}
					if ( $check_val > 0 ) {
						$users_to_migrate[ $uid ] = $check_val;
					}
				}
			}
		}
	}
}

if ( empty( $users_to_migrate ) ) {
	echo "No users found with a positive WPSwings wallet balance.\n";
	exit( 0 );
}

echo "Found " . count( $users_to_migrate ) . " customer(s) with active wallet balances:\n\n";

$expiry_ts       = strtotime( '+1 year' );
$expiry_date_str = date_i18n( get_option( 'date_format', 'F j, Y' ), $expiry_ts );
$total_migrated  = 0;
$success_count   = 0;

printf( "%-8s | %-32s | %-16s | %-20s\n", "User ID", "Email", "Balance", "Expiry Date" );
echo str_repeat( "-", 85 ) . "\n";

foreach ( $users_to_migrate as $user_id => $amount ) {
	$user = get_userdata( $user_id );
	$email = $user ? $user->user_email : "(User #{$user_id} deleted)";
	$formatted_amount = function_exists( 'wc_price' ) ? wp_strip_all_tags( wc_price( $amount ) ) : 'Rp ' . number_format( $amount, 0, ',', '.' );

	printf( "%-8d | %-32s | %-16s | %-20s\n", $user_id, substr( $email, 0, 32 ), $formatted_amount, $expiry_date_str );

	if ( ! $is_dry_run && $user ) {
		// A. Add credit to Advanced Coupons Store Credits
		$acfw_added = false;
		if ( class_exists( 'ACFW_Store_Credits' ) && method_exists( 'ACFW_Store_Credits', 'add_credit' ) ) {
			try {
				\ACFW_Store_Credits::add_credit(
					$user_id,
					$amount,
					sprintf( 'Migrated from WPSwings Wallet (Expires %s)', $expiry_date_str )
				);
				$acfw_added = true;
			} catch ( \Throwable $e ) {
				// Fallback to direct user meta below
			}
		}

		// B. Update ACFW Store Credit user meta directly
		$current_acfw = floatval( get_user_meta( $user_id, 'acfw_store_credit_balance', true ) );
		$new_acfw_bal = $current_acfw + ( $acfw_added ? 0 : $amount );
		update_user_meta( $user_id, 'acfw_store_credit_balance', $new_acfw_bal );

		// C. Stamp 1-year expiry metadata
		update_user_meta( $user_id, '_exacoat_cashback_expiry_ts', $expiry_ts );
		update_user_meta( $user_id, '_exacoat_cashback_expiry_date', $expiry_date_str );
		update_user_meta( $user_id, '_exacoat_last_credit_grant_ts', time() );
		update_user_meta( $user_id, '_wpswings_wallet_migrated_at', current_time( 'mysql' ) );
		update_user_meta( $user_id, '_wpswings_original_balance', $amount );

		// D. Archive old WPSwings balance to prevent re-crediting or double-spending
		update_user_meta( $user_id, 'wps_wallet_migrated_backup', $amount );
		update_user_meta( $user_id, 'wps_wallet', '0' );
		update_user_meta( $user_id, 'wps_wallet_cashback_bal', '0' );
		if ( metadata_exists( 'user', $user_id, 'wallet_amount' ) ) {
			update_user_meta( $user_id, 'wallet_amount', '0' );
		}

		// E. Schedule 335-day pre-expiry Action Scheduler reminder (30 days before expiration)
		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action(
				time() + ( 335 * DAY_IN_SECONDS ),
				'exacoat_send_store_credit_reminder_job',
				[
					'customer_id' => $user_id,
					'type'        => 'pre_expiry_30d',
				],
				'exacoat-store-credit'
			);
		}

		$success_count++;
	}

	$total_migrated += $amount;
}

echo str_repeat( "-", 85 ) . "\n";
echo "\nSummary:\n";
echo "Total Users with Balances : " . count( $users_to_migrate ) . "\n";
echo "Total Wallet Value        : Rp " . number_format( $total_migrated, 0, ',', '.' ) . "\n";
echo "Target Expiry Date        : {$expiry_date_str} (+1 year from today)\n";

if ( $is_dry_run ) {
	echo "\nDry-run completed successfully. No changes were made to the database.\n";
	echo "To execute the live migration, run:\n";
	echo "  wp eval-file migrate-wpswings-wallet-to-acfw.php\n";
} else {
	echo "\nLive migration completed successfully!\n";
	echo "Successfully credited {$success_count} customer(s) in Advanced Coupons Store Credits.\n";
	echo "Old WPSwings balances have been backed up to 'wps_wallet_migrated_backup' and zeroed out.\n";
}
