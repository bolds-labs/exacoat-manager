<?php
/**
 * Exacoat Unified Push Notification Service
 * Coordinates push notification dispatches across Pushover and Telegram gateways.
 * Features multi-tier deduplication (in-memory, transient lock, and persistent post meta).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Notification_Service' ) ) {

class Exacoat_Notification_Service {

	/**
	 * In-memory registry to prevent duplicate notifications during the same PHP process
	 */
	private static array $notified_orders = [];
	private static array $notified_events = [];

	/**
	 * Initialize WordPress & WooCommerce notification hooks
	 */
	public static function init(): void {
		// Hook: Orders transitioning to 'processing' (User has completed payment)
		// Priority 20 ensures payment gateway, tracking pool, and coupons finish processing first
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'handle_order_processing' ], 20, 1 );
	}

	/**
	 * Action: Handle WooCommerce order status transition (compatibility fallback)
	 */
	public static function handle_order_status_changed( $order_id, $from_status, $to_status, $order = null ): void {
		$clean_to = str_replace( 'wc-', '', (string) $to_status );
		if ( 'processing' === $clean_to ) {
			self::handle_order_processing( $order ?: $order_id );
		}
	}

	/**
	 * Action: Handle order status 'processing' with triple-layer deduplication
	 */
	public static function handle_order_processing( $order_or_id ): void {
		$order_id = is_numeric( $order_or_id ) ? (int) $order_or_id : ( ( $order_or_id instanceof \WC_Order ) ? $order_or_id->get_id() : 0 );
		if ( ! $order_id ) {
			return;
		}

		// Layer 1: In-memory registry check (same PHP request)
		if ( ! empty( self::$notified_orders[ $order_id ] ) ) {
			return;
		}

		// Layer 2: Persistent database post meta check (bypasses stale WC_Order meta cache)
		$db_notified = get_post_meta( $order_id, '_exacoat_new_sale_notified', true );
		if ( 'yes' === $db_notified ) {
			self::$notified_orders[ $order_id ] = true;
			return;
		}

		// Layer 3: WordPress transient lock (cross-request race conditions from webhooks)
		$lock_key = 'exa_lock_notif_order_' . $order_id;
		if ( get_transient( $lock_key ) ) {
			self::$notified_orders[ $order_id ] = true;
			return;
		}
		set_transient( $lock_key, 1, 300 ); // 5 minute lock

		// Resolve WC_Order instance
		$order = is_numeric( $order_or_id ) ? wc_get_order( $order_id ) : $order_or_id;
		if ( ! $order || ! is_a( $order, 'WC_Order' ) ) {
			delete_transient( $lock_key );
			return;
		}

		// Double check status is processing
		$status = str_replace( 'wc-', '', $order->get_status() );
		if ( 'processing' !== $status ) {
			delete_transient( $lock_key );
			return;
		}

		// Check WC_Order meta as well
		if ( 'yes' === $order->get_meta( '_exacoat_new_sale_notified', true ) ) {
			self::$notified_orders[ $order_id ] = true;
			return;
		}

		// Mark order as notified immediately in memory, post meta, and WC meta
		self::$notified_orders[ $order_id ] = true;
		update_post_meta( $order_id, '_exacoat_new_sale_notified', 'yes' );
		update_post_meta( $order_id, '_exacoat_notified_at', current_time( 'mysql' ) );

		$order->update_meta_data( '_exacoat_new_sale_notified', 'yes' );
		$order->update_meta_data( '_exacoat_notified_at', current_time( 'mysql' ) );
		$order->save();

		self::dispatch_new_order_alert( $order );
	}

	/**
	 * Dispatch New Order Alert to Pushover & Telegram
	 */
	public static function dispatch_new_order_alert( WC_Order $order ): void {
		$order_id       = $order->get_id();
		$order_number   = $order->get_order_number();
		$currency       = $order->get_currency();
		$total          = $order->get_total();
		$payment_method = $order->get_payment_method_title() ?: ( $order->get_payment_method() ?: 'Online Checkout' );

		// Customer Name & Email
		$customer_name  = trim( (string) $order->get_formatted_billing_full_name() );
		if ( empty( $customer_name ) ) {
			$customer_name = trim( (string) $order->get_billing_first_name() . ' ' . (string) $order->get_billing_last_name() );
		}
		if ( empty( $customer_name ) ) {
			$customer_name = 'Customer';
		}
		$customer_email = $order->get_billing_email();

		// Destination
		$city       = $order->get_shipping_city() ?: $order->get_billing_city();
		$country    = $order->get_shipping_country() ?: $order->get_billing_country();
		$dest_parts = array_filter( [ $city, $country ] );
		$destination = ! empty( $dest_parts ) ? implode( ', ', $dest_parts ) : 'N/A';

		// Items list
		$item_lines = [];
		foreach ( $order->get_items() as $item ) {
			$name = $item->get_name();
			$qty  = $item->get_quantity();
			$item_lines[] = "• " . esc_html( $name ) . " (x{$qty})";
		}
		$items_formatted = implode( "\n", array_slice( $item_lines, 0, 5 ) );
		if ( count( $item_lines ) > 5 ) {
			$extra = count( $item_lines ) - 5;
			$items_formatted .= "\n• <i>...and {$extra} more item(s)</i>";
		}
		if ( empty( $items_formatted ) ) {
			$items_formatted = "• Standard Order Items";
		}

		// Price formatting
		$formatted_price = function_exists( 'wc_price' )
			? html_entity_decode( wp_strip_all_tags( wc_price( $total, [ 'currency' => $currency ] ) ) )
			: "{$currency} {$total}";

		$manager_base    = defined( 'EXACOAT_MANAGER_URL' ) ? EXACOAT_MANAGER_URL : ( getenv( 'EXACOAT_MANAGER_URL' ) ?: 'https://manager.exacoat.com' );
		$admin_order_url = rtrim( $manager_base, '/' ) . '/?order=' . $order_id;

		// 1. Pushover Dispatch
		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			$pushover_cfg = Exacoat_Pushover_Service::get_config();
			if ( ! empty( $pushover_cfg['enabled'] ) && ! empty( $pushover_cfg['notify_new_sale'] ) ) {
				$pushover_title = "New Order #{$order_number} ({$formatted_price})";
				$pushover_body  = "<b>Customer:</b> " . esc_html( $customer_name ) . "\n" .
					"<b>Status:</b> Paid (Processing)\n" .
					"<b>Total:</b> " . esc_html( $formatted_price ) . "\n" .
					"<b>Payment:</b> " . esc_html( $payment_method ) . "\n" .
					"<b>Ship To:</b> " . esc_html( $destination ) . "\n\n" .
					"<b>Items:</b>\n" . $items_formatted;

				Exacoat_Pushover_Service::send( $pushover_title, $pushover_body, [
					'url'       => $admin_order_url,
					'url_title' => "View Order #{$order_number}",
					'priority'  => 0,
				] );
			}
		}

		// 2. Telegram Dispatch (Toned down: green dot top-left, clean bold labels, no line emojis)
		if ( class_exists( 'Exacoat_Telegram_Service' ) ) {
			$telegram_cfg = Exacoat_Telegram_Service::get_config();
			if ( ! empty( $telegram_cfg['enabled'] ) && ! empty( $telegram_cfg['notify_new_sale'] ) ) {
				$telegram_text = "🟢 <b>New Order #{$order_number}</b>\n\n" .
					"<b>Customer:</b> " . esc_html( $customer_name ) . ( $customer_email ? " (" . esc_html( $customer_email ) . ")" : "" ) . "\n" .
					"<b>Total:</b> " . esc_html( $formatted_price ) . "\n" .
					"<b>Payment:</b> " . esc_html( $payment_method ) . "\n" .
					"<b>Ship To:</b> " . esc_html( $destination ) . "\n\n" .
					"<b>Items:</b>\n" . $items_formatted . "\n\n" .
					"<a href=\"" . esc_url( $admin_order_url ) . "\">View in Order Manager</a>";

				$telegram_options = [
					'disable_preview' => true,
					'buttons'         => [
						[
							[
								'text' => "View Order #{$order_number}",
								'url'  => $admin_order_url,
							],
						],
					],
				];

				Exacoat_Telegram_Service::send( $telegram_text, $telegram_options );
			}
		}
	}

	/**
	 * Convenience alias for manual sale triggers
	 */
	public static function notify_new_order( $order_or_id ): void {
		self::handle_order_processing( $order_or_id );
	}

	/**
	 * Dispatch New Affiliate Registration Alert
	 */
	public static function notify_affiliate_registration( array $applicant ): void {
		$name    = ! empty( $applicant['name'] ) ? trim( (string) $applicant['name'] ) : 'New Creator';
		$slug    = ! empty( $applicant['slug'] ) ? trim( (string) $applicant['slug'] ) : 'affiliate';
		$email   = ! empty( $applicant['email'] ) ? trim( (string) $applicant['email'] ) : 'N/A';
		$channel = ! empty( $applicant['promotion_channel'] ) ? trim( (string) $applicant['promotion_channel'] ) : 'Social Media';
		$type    = ! empty( $applicant['affiliate_type'] ) ? trim( (string) $applicant['affiliate_type'] ) : 'Affiliate Partner';
		$status  = ! empty( $applicant['status'] ) ? trim( (string) $applicant['status'] ) : 'pending_approval';

		// Deduplication check
		$dedup_key = 'exa_lock_notif_aff_reg_' . md5( strtolower( $slug . '|' . $email ) );
		if ( ! empty( self::$notified_events[ $dedup_key ] ) || get_transient( $dedup_key ) ) {
			return;
		}
		self::$notified_events[ $dedup_key ] = true;
		set_transient( $dedup_key, 1, 300 );

		$status_label = 'active' === $status ? 'Approved (Auto-Active)' : 'Pending Review';
		$manager_base = defined( 'EXACOAT_MANAGER_URL' ) ? EXACOAT_MANAGER_URL : ( getenv( 'EXACOAT_MANAGER_URL' ) ?: 'https://manager.exacoat.com' );
		$admin_url    = rtrim( $manager_base, '/' ) . '/#affiliates';

		// Pushover
		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			$cfg = Exacoat_Pushover_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_affiliate_register'] ) ) {
				$title = "New Affiliate Registration: {$name}";
				$body  = "<b>New Creator Registered</b>\n" .
					"• <b>Name:</b> " . esc_html( $name ) . " (@" . esc_html( $slug ) . ")\n" .
					"• <b>Email:</b> " . esc_html( $email ) . "\n" .
					"• <b>Channel:</b> " . esc_html( $channel ) . "\n" .
					"• <b>Type:</b> " . esc_html( $type ) . "\n" .
					"• <b>Status:</b> " . esc_html( $status_label );

				Exacoat_Pushover_Service::send( $title, $body, [
					'url'       => $admin_url,
					'url_title' => 'Review Affiliates',
					'priority'  => 0,
				] );
			}
		}

		// Telegram (Toned down: blue dot top-left, clean bold labels)
		if ( class_exists( 'Exacoat_Telegram_Service' ) ) {
			$cfg = Exacoat_Telegram_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_affiliate_register'] ) ) {
				$text = "🔵 <b>New Affiliate Registration</b>\n\n" .
					"<b>Creator:</b> " . esc_html( $name ) . " (@" . esc_html( $slug ) . ")\n" .
					"<b>Email:</b> " . esc_html( $email ) . "\n" .
					"<b>Channel:</b> " . esc_html( $channel ) . "\n" .
					"<b>Type:</b> " . esc_html( $type ) . "\n" .
					"<b>Status:</b> " . esc_html( $status_label ) . "\n\n" .
					"<a href=\"" . esc_url( $admin_url ) . "\">Review in Affiliate Manager</a>";

				$options = [
					'disable_preview' => true,
					'buttons'         => [
						[
							[
								'text' => 'Review Affiliate',
								'url'  => $admin_url,
							],
						],
					],
				];

				Exacoat_Telegram_Service::send( $text, $options );
			}
		}
	}

	/**
	 * Dispatch Affiliate Payout Request Alert
	 */
	public static function notify_affiliate_payout( array $payout ): void {
		$creator_name = ! empty( $payout['creator_name'] ) ? trim( (string) $payout['creator_name'] ) : 'Creator';
		$slug         = ! empty( $payout['slug'] ) ? trim( (string) $payout['slug'] ) : 'affiliate';
		$amount_str   = ! empty( $payout['amount_formatted'] ) ? trim( (string) $payout['amount_formatted'] ) : 'Rp 0';
		$bank_name    = ! empty( $payout['bank_name'] ) ? trim( (string) $payout['bank_name'] ) : 'Bank';
		$bank_account = ! empty( $payout['bank_account_number'] ) ? trim( (string) $payout['bank_account_number'] ) : '-';
		$bank_holder  = ! empty( $payout['bank_account_name'] ) ? trim( (string) $payout['bank_account_name'] ) : $creator_name;
		$payout_id    = (int) ( $payout['payout_id'] ?? 0 );

		// Deduplication check
		$dedup_key = 'exa_lock_notif_payout_' . ( $payout_id > 0 ? $payout_id : md5( $creator_name . '|' . $amount_str ) );
		if ( ! empty( self::$notified_events[ $dedup_key ] ) || get_transient( $dedup_key ) ) {
			return;
		}
		self::$notified_events[ $dedup_key ] = true;
		set_transient( $dedup_key, 1, 300 );

		$manager_base = defined( 'EXACOAT_MANAGER_URL' ) ? EXACOAT_MANAGER_URL : ( getenv( 'EXACOAT_MANAGER_URL' ) ?: 'https://manager.exacoat.com' );
		$admin_url    = rtrim( $manager_base, '/' ) . '/#affiliates';

		// Pushover
		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			$cfg = Exacoat_Pushover_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_affiliate_payout'] ) ) {
				$title = "Affiliate Payout Request: {$creator_name} ({$amount_str})";
				$body  = "<b>" . esc_html( $creator_name ) . "</b> requested a payout of <b>" . esc_html( $amount_str ) . "</b>.\n\n" .
					"• <b>Creator:</b> " . esc_html( $creator_name ) . " (@" . esc_html( $slug ) . ")\n" .
					"• <b>Bank:</b> " . esc_html( $bank_name ) . " - " . esc_html( $bank_account ) . "\n" .
					"• <b>A/N:</b> " . esc_html( $bank_holder ) . "\n" .
					"• <b>Payout ID:</b> #" . $payout_id;

				Exacoat_Pushover_Service::send( $title, $body, [
					'url'       => $admin_url,
					'url_title' => 'Review Payouts',
					'priority'  => 1,
				] );
			}
		}

		// Telegram (Toned down: yellow dot top-left, clean bold labels)
		if ( class_exists( 'Exacoat_Telegram_Service' ) ) {
			$cfg = Exacoat_Telegram_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_affiliate_payout'] ) ) {
				$text = "🟡 <b>Affiliate Payout Request #" . $payout_id . "</b>\n\n" .
					"<b>Creator:</b> " . esc_html( $creator_name ) . " (@" . esc_html( $slug ) . ")\n" .
					"<b>Amount:</b> " . esc_html( $amount_str ) . "\n" .
					"<b>Bank:</b> " . esc_html( $bank_name ) . " - " . esc_html( $bank_account ) . "\n" .
					"<b>A/N:</b> " . esc_html( $bank_holder ) . "\n\n" .
					"<a href=\"" . esc_url( $admin_url ) . "\">Process Payout in Manager</a>";

				$options = [
					'disable_preview' => true,
					'buttons'         => [
						[
							[
								'text' => 'Process Payout',
								'url'  => $admin_url,
							],
						],
					],
				];

				Exacoat_Telegram_Service::send( $text, $options );
			}
		}
	}

	/**
	 * Dispatch Customer Review Alert
	 */
	public static function notify_review( array $review ): void {
		$cust_name    = ! empty( $review['reviewer_name'] ) ? trim( (string) $review['reviewer_name'] ) : 'Customer';
		$rating       = (int) ( $review['rating'] ?? 5 );
		$product      = ! empty( $review['product_title'] ) ? trim( (string) $review['product_title'] ) : 'Custom Skin';
		$order_num    = ! empty( $review['order_number'] ) ? trim( (string) $review['order_number'] ) : '';
		$media_count  = (int) ( $review['media_count'] ?? 0 );
		$comment      = ! empty( $review['review_text'] ) ? trim( (string) $review['review_text'] ) : '';

		// Deduplication check
		$dedup_key = 'exa_lock_notif_rev_' . md5( (string) $order_num . '|' . $cust_name . '|' . $product );
		if ( ! empty( self::$notified_events[ $dedup_key ] ) || get_transient( $dedup_key ) ) {
			return;
		}
		self::$notified_events[ $dedup_key ] = true;
		set_transient( $dedup_key, 1, 120 );

		$stars        = str_repeat( '⭐', max( 1, min( 5, $rating ) ) );
		$manager_base = defined( 'EXACOAT_MANAGER_URL' ) ? EXACOAT_MANAGER_URL : ( getenv( 'EXACOAT_MANAGER_URL' ) ?: 'https://manager.exacoat.com' );
		$admin_url    = rtrim( $manager_base, '/' ) . '/#reviews';

		// Pushover
		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			$cfg = Exacoat_Pushover_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_kyc'] ) ) {
				$title = "New Customer Review: {$cust_name} ({$rating}/5★)";
				$body  = "<b>Customer:</b> " . esc_html( $cust_name ) . "\n" .
					"<b>Rating:</b> {$stars} ({$rating}/5)\n" .
					"<b>Product:</b> " . esc_html( $product ) . ( $order_num ? " (Order #{$order_num})" : "" ) . "\n" .
					( $media_count > 0 ? "<b>Media:</b> {$media_count} attachment(s)\n" : "" ) .
					( $comment ? "<b>Comment:</b> " . esc_html( wp_trim_words( $comment, 25 ) ) : "" );

				Exacoat_Pushover_Service::send( $title, $body, [
					'url'       => $admin_url,
					'url_title' => 'Inspect Reviews',
					'priority'  => 0,
				] );
			}
		}

		// Telegram (Toned down: single star top-left, clean bold labels)
		if ( class_exists( 'Exacoat_Telegram_Service' ) ) {
			$cfg = Exacoat_Telegram_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_kyc'] ) ) {
				$text = "⭐ <b>New Customer Review</b>\n\n" .
					"<b>Customer:</b> " . esc_html( $cust_name ) . "\n" .
					"<b>Rating:</b> {$stars} ({$rating}/5)\n" .
					"<b>Product:</b> " . esc_html( $product ) . ( $order_num ? " (Order #{$order_num})" : "" ) . "\n" .
					( $media_count > 0 ? "<b>Media:</b> {$media_count} file(s) attached\n" : "" ) .
					( $comment ? "<b>Review:</b> \"" . esc_html( wp_trim_words( $comment, 35 ) ) . "\"\n\n" : "\n" ) .
					"<a href=\"" . esc_url( $admin_url ) . "\">Inspect in Review Manager</a>";

				$options = [
					'disable_preview' => true,
					'buttons'         => [
						[
							[
								'text' => 'Inspect Review',
								'url'  => $admin_url,
							],
						],
					],
				];

				Exacoat_Telegram_Service::send( $text, $options );
			}
		}
	}

	/**
	 * Dispatch Low Stock / Inventory Alert
	 */
	public static function notify_inventory( string $title, string $details ): void {
		$dedup_key = 'exa_lock_notif_inv_' . md5( $title . '|' . $details );
		if ( ! empty( self::$notified_events[ $dedup_key ] ) || get_transient( $dedup_key ) ) {
			return;
		}
		self::$notified_events[ $dedup_key ] = true;
		set_transient( $dedup_key, 1, 300 );

		$manager_base  = defined( 'EXACOAT_MANAGER_URL' ) ? EXACOAT_MANAGER_URL : ( getenv( 'EXACOAT_MANAGER_URL' ) ?: 'https://manager.exacoat.com' );
		$materials_url = rtrim( $manager_base, '/' ) . '/#materials';

		// Pushover
		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			$cfg = Exacoat_Pushover_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_inventory'] ) ) {
				Exacoat_Pushover_Service::send( "⚠️ " . $title, $details, [
					'priority'  => 1,
					'url'       => $materials_url,
					'url_title' => 'Inspect Materials & Stock',
				] );
			}
		}

		// Telegram (Toned down: top-left warning icon)
		if ( class_exists( 'Exacoat_Telegram_Service' ) ) {
			$cfg = Exacoat_Telegram_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_inventory'] ) ) {
				$text = "⚠️ <b>Inventory Alert: " . esc_html( $title ) . "</b>\n\n" . esc_html( $details ) . "\n\n" .
					"<a href=\"" . esc_url( $materials_url ) . "\">Inspect in Materials Manager</a>";
				$options = [
					'disable_preview' => true,
					'buttons'         => [
						[
							[
								'text' => 'Inspect Materials',
								'url'  => $materials_url,
							],
						],
					],
				];
				Exacoat_Telegram_Service::send( $text, $options );
			}
		}
	}

	/**
	 * Dispatch Critical Error Alert
	 */
	public static function notify_error( string $title, string $details ): void {
		$dedup_key = 'exa_lock_notif_err_' . md5( $title . '|' . $details );
		if ( ! empty( self::$notified_events[ $dedup_key ] ) || get_transient( $dedup_key ) ) {
			return;
		}
		self::$notified_events[ $dedup_key ] = true;
		set_transient( $dedup_key, 1, 60 );

		$manager_base = defined( 'EXACOAT_MANAGER_URL' ) ? EXACOAT_MANAGER_URL : ( getenv( 'EXACOAT_MANAGER_URL' ) ?: 'https://manager.exacoat.com' );
		$logs_url     = rtrim( $manager_base, '/' ) . '/#audit?tab=wordpress';
		$health_url   = rtrim( $manager_base, '/' ) . '/#health';

		// Pushover
		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			$cfg = Exacoat_Pushover_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_errors'] ) ) {
				$msg = "<b>Error:</b> " . esc_html( $title ) . "\n" .
					"<code>" . esc_html( wp_trim_words( $details, 40 ) ) . "</code>";
				Exacoat_Pushover_Service::send( 'Exacoat Core Error', $msg, [
					'priority'  => 1,
					'url'       => $logs_url,
					'url_title' => 'Inspect Error Logs',
				] );
			}
		}

		// Telegram (Toned down: top-left alert icon)
		if ( class_exists( 'Exacoat_Telegram_Service' ) ) {
			$cfg = Exacoat_Telegram_Service::get_config();
			if ( ! empty( $cfg['enabled'] ) && ! empty( $cfg['notify_errors'] ) ) {
				$text = "🚨 <b>System Error Alert</b>\n\n" .
					"<b>" . esc_html( $title ) . "</b>\n" .
					"<code>" . esc_html( wp_trim_words( $details, 50 ) ) . "</code>\n\n" .
					"<a href=\"" . esc_url( $logs_url ) . "\">Inspect in Audit Logs</a>";
				$options = [
					'disable_preview' => true,
					'buttons'         => [
						[
							[
								'text' => 'Inspect Error Logs',
								'url'  => $logs_url,
							],
							[
								'text' => 'Store Health',
								'url'  => $health_url,
							],
						],
					],
				];
				Exacoat_Telegram_Service::send( $text, $options );
			}
		}
	}
}

}
