<?php
/**
 * Exacoat Core Store Credit & Cashback Notification Engine
 * Manages cashback email dispatch, store credit balance reminders, and ACFW email overrides.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Store_Credit_Manager' ) ) {

class Exacoat_Store_Credit_Manager {

	const QUEUE_GROUP = 'exacoat-store-credit';
	const REMINDER_ACTION = 'exacoat_send_store_credit_reminder_job';

	public static function init() {
		// 1. Suppress default unstyled Advanced Coupons WooCommerce emails
		$suppressed_emails = [
			'acfw_store_credit_reminder_email',
			'acfw_store_credit_email',
			'customer_store_credit',
			'wc_email_store_credit_reminder',
			'wc_email_store_credit',
		];
		foreach ( $suppressed_emails as $email_id ) {
			add_filter( "woocommerce_email_recipient_{$email_id}", '__return_empty_string', 999 );
			add_filter( "woocommerce_email_enabled_{$email_id}", '__return_false', 999 );
		}

		// 2. Intercept order completion to award and notify cashback
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'handle_order_completed' ], 25, 1 );

		// 3. Listen to direct store credit additions (manual admin credit or refunds)
		add_action( 'acfw_store_credit_added', [ __CLASS__, 'handle_acfw_store_credit_added' ], 10, 4 );
		add_action( 'acfw_add_store_credit', [ __CLASS__, 'handle_acfw_add_store_credit' ], 10, 3 );
		add_action( 'advanced_coupons_add_store_credit', [ __CLASS__, 'handle_acfw_add_store_credit' ], 10, 3 );

		// 4. Action Scheduler worker for follow-up reminder emails
		add_action( self::REMINDER_ACTION, [ __CLASS__, 'process_store_credit_reminder_job' ], 10, 1 );

		// 5. Admin AJAX test endpoints
		add_action( 'wp_ajax_exacoat_test_cashback_email', [ __CLASS__, 'ajax_test_cashback_email' ] );
		add_action( 'wp_ajax_exacoat_test_store_credit_reminder', [ __CLASS__, 'ajax_test_store_credit_reminder' ] );
	}

	/**
	 * Handle order completion: detect cashback, send branded email, and schedule 7-day reminder.
	 */
	public static function handle_order_completed( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		// Deduplication check: only notify once per order
		if ( 'yes' === $order->get_meta( '_exacoat_cashback_email_sent' ) ) {
			return;
		}

		$recipient_email = $order->get_billing_email();
		if ( ! $recipient_email || ! is_email( $recipient_email ) ) {
			return;
		}

		// Detect cashback earned on this order
		$cashback = self::resolve_order_cashback( $order );
		if ( empty( $cashback['amount'] ) || $cashback['amount'] <= 0 ) {
			return;
		}

		// Mark order as notified immediately to prevent race conditions
		$order->update_meta_data( '_exacoat_cashback_email_sent', 'yes' );
		$order->update_meta_data( '_exacoat_cashback_email_sent_at', current_time( 'mysql' ) );
		$order->save();

		$customer_id = (int) $order->get_customer_id();
		$currency    = $order->get_currency() ?: 'IDR';
		$balance     = self::get_customer_balance( $customer_id );

		// If current balance is lower than earned cashback, reflect at least the earned cashback
		if ( $balance < $cashback['amount'] ) {
			$balance = $cashback['amount'];
		}

		$first_name = $order->get_billing_first_name() ?: 'Customer';
		$full_name  = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() ) ?: $first_name;

		$shop_url = function_exists( 'exacoat_storefront_url' )
			? exacoat_storefront_url( 'shop' )
			: home_url( '/shop/' );

		$data = [
			'customer_first_name'  => $first_name,
			'customer_name'        => $full_name,
			'order_number'         => $order->get_order_number(),
			'order_id'             => $order_id,
			'cashback_amount'      => self::format_amount( $cashback['amount'], $currency ),
			'store_credit_balance' => self::format_amount( $balance, $currency ),
			'shop_url'             => $shop_url,
			'cta_text'             => 'Shop Device Skins',
		];

		// Dispatch branded email via Zoho ZeptoMail API
		Exacoat_Email_Engine::send_email(
			'customer_cashback_earned',
			$recipient_email,
			$full_name,
			$data
		);

		// Schedule 7-day follow-up reminder if customer account exists
		if ( $customer_id && function_exists( 'as_schedule_single_action' ) ) {
			if ( function_exists( 'as_unschedule_action' ) ) {
				as_unschedule_action( self::REMINDER_ACTION, [ 'customer_id' => $customer_id ], self::QUEUE_GROUP );
			}
			$reminder_delay = 7 * DAY_IN_SECONDS;
			as_schedule_single_action(
				time() + $reminder_delay,
				self::REMINDER_ACTION,
				[
					'customer_id' => $customer_id,
					'order_id'    => (int) $order_id,
				],
				self::QUEUE_GROUP
			);
		}
	}

	/**
	 * Handle direct addition of store credit via ACFW hook.
	 */
	public static function handle_acfw_store_credit_added( $customer_id, $amount, $reason = '', $args = [] ) {
		$customer_id = (int) $customer_id;
		$amount      = (float) $amount;
		if ( ! $customer_id || $amount <= 0 ) {
			return;
		}

		// If this was already triggered by an order completion, skip to avoid double emailing
		if ( is_string( $reason ) && preg_match( '/#(\d+)/', $reason, $matches ) ) {
			$order_id = (int) $matches[1];
			$order    = wc_get_order( $order_id );
			if ( $order && 'yes' === $order->get_meta( '_exacoat_cashback_email_sent' ) ) {
				return;
			}
		}

		// Schedule 7-day follow-up reminder for the recipient
		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action(
				time() + ( 7 * DAY_IN_SECONDS ),
				self::REMINDER_ACTION,
				[
					'customer_id' => $customer_id,
					'order_id'    => 0,
				],
				self::QUEUE_GROUP
			);
		}
	}

	/**
	 * Callback for alternate ACFW hook signature.
	 */
	public static function handle_acfw_add_store_credit( $customer_id, $amount, $reason = '' ) {
		self::handle_acfw_store_credit_added( $customer_id, $amount, $reason );
	}

	/**
	 * Process scheduled store credit reminder job (Action Scheduler).
	 */
	public static function process_store_credit_reminder_job( array $args ) {
		$customer_id = (int) ( $args['customer_id'] ?? 0 );
		$order_id    = (int) ( $args['order_id'] ?? 0 );
		if ( ! $customer_id ) {
			return;
		}

		$user = get_userdata( $customer_id );
		if ( ! $user || ! is_email( $user->user_email ) ) {
			return;
		}

		// 1. Verify positive store credit balance
		$balance = self::get_customer_balance( $customer_id );
		if ( $balance <= 0 ) {
			return;
		}

		// 2. Check if customer placed an order since the original qualifying order
		if ( $order_id ) {
			$post_date = get_post_field( 'post_date', $order_id );
			if ( $post_date ) {
				$recent_orders = wc_get_orders( [
					'customer_id' => $customer_id,
					'limit'       => 1,
					'status'      => [ 'wc-processing', 'wc-completed', 'wc-ready-to-ship', 'wc-in-production' ],
					'exclude'     => [ $order_id ],
					'date_after'  => $post_date,
				] );
				if ( ! empty( $recent_orders ) ) {
					return;
				}
			}
		}

		// 3. Rate-limit reminders (maximum 1 reminder per customer every 14 days)
		$last_sent = (int) get_user_meta( $customer_id, '_exacoat_last_sc_reminder_sent', true );
		if ( $last_sent && ( time() - $last_sent ) < ( 14 * DAY_IN_SECONDS ) ) {
			return;
		}

		// Mark reminder timestamp
		update_user_meta( $customer_id, '_exacoat_last_sc_reminder_sent', time() );

		$currency   = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR';
		$first_name = $user->first_name ?: ( $user->display_name ?: 'Customer' );
		$full_name  = trim( $user->first_name . ' ' . $user->last_name ) ?: $first_name;

		$shop_url = function_exists( 'exacoat_storefront_url' )
			? exacoat_storefront_url( 'shop' )
			: home_url( '/shop/' );

		$data = [
			'customer_first_name'  => $first_name,
			'customer_name'        => $full_name,
			'store_credit_balance' => self::format_amount( $balance, $currency ),
			'shop_url'             => $shop_url,
			'cta_text'             => 'Use Your Credit',
		];

		Exacoat_Email_Engine::send_email(
			'customer_store_credit_reminder',
			$user->user_email,
			$full_name,
			$data
		);
	}

	/**
	 * Extract cashback earned amount from WooCommerce order.
	 */
	public static function resolve_order_cashback( $order ): array {
		if ( ! is_a( $order, 'WC_Order' ) ) {
			$order = wc_get_order( $order );
			if ( ! $order ) {
				return [ 'amount' => 0.0, 'code' => '' ];
			}
		}

		// 1. Check order meta fields populated by ACFW or Exacoat
		$meta_keys = [
			'_cashback_earned',
			'cashback_earned',
			'_acfw_cashback_earned',
			'_acfw_order_cashback',
		];
		foreach ( $meta_keys as $key ) {
			$val = $order->get_meta( $key );
			if ( ! empty( $val ) ) {
				if ( is_numeric( $val ) && (float) $val > 0 ) {
					return [ 'amount' => (float) $val, 'code' => '' ];
				}
				// Parse numeric values from formatted strings (e.g. "Rp 25.000" or "$15.00")
				if ( is_string( $val ) ) {
					$cleaned = preg_replace( '/[^\d.]/', '', str_replace( ',', '.', $val ) );
					if ( is_numeric( $cleaned ) && (float) $cleaned > 0 ) {
						return [ 'amount' => (float) $cleaned, 'code' => '' ];
					}
				}
			}
		}

		// 2. Evaluate applied coupons on the order dynamically
		$total_cashback = 0.0;
		$matched_code   = '';
		$coupon_codes   = (array) $order->get_coupon_codes();

		foreach ( $coupon_codes as $code ) {
			if ( in_array( strtolower( $code ), [ 'store credit', 'store-credit', 'store_credit' ], true ) ) {
				continue;
			}
			$coupon = new WC_Coupon( $code );
			$cid    = $coupon->get_id();
			if ( ! $cid ) {
				continue;
			}

			$discount_type = (string) $coupon->get_discount_type();
			$is_cashback   = (
				false !== strpos( $discount_type, 'cashback' )
				|| 'yes' === get_post_meta( $cid, '_is_coupon_cashback', true )
			);

			if ( $is_cashback ) {
				$coupon_amt = (float) $coupon->get_amount();
				$matched_code = strtoupper( $code );

				if ( 'acfw_percentage_cashback' === $discount_type || false !== strpos( $discount_type, 'percentage' ) || 'percent' === $discount_type ) {
					$subtotal = (float) $order->get_subtotal();
					$calc     = $subtotal * ( $coupon_amt / 100.0 );
					$cap      = (float) get_post_meta( $cid, '_acfw_percentage_discount_cap', true );
					if ( $cap > 0 && $calc > $cap ) {
						$calc = $cap;
					}
					$total_cashback += $calc;
				} else {
					$total_cashback += $coupon_amt;
				}
			}
		}

		return [
			'amount' => round( $total_cashback, 2 ),
			'code'   => $matched_code,
		];
	}

	/**
	 * Retrieve customer store credit balance from ACFW or user meta.
	 */
	public static function get_customer_balance( int $customer_id ): float {
		if ( ! $customer_id ) {
			return 0.0;
		}

		// 1. Try ACFW helper method
		if ( class_exists( 'ACFW_Store_Credits' ) && method_exists( 'ACFW_Store_Credits', 'get_customer_credit' ) ) {
			try {
				return (float) \ACFW_Store_Credits::get_customer_credit( $customer_id );
			} catch ( \Throwable $e ) {
				// Fallback to user meta
			}
		}

		// 2. Direct user meta lookup
		return (float) get_user_meta( $customer_id, 'acfw_store_credit_balance', true );
	}

	/**
	 * Format currency amount for display in transactional emails.
	 */
	public static function format_amount( float $amount, string $currency = 'IDR' ): string {
		if ( function_exists( 'wc_price' ) ) {
			return wp_strip_all_tags( wc_price( $amount, [ 'currency' => $currency ] ) );
		}
		if ( 'IDR' === strtoupper( $currency ) ) {
			return 'Rp ' . number_format( $amount, 0, ',', '.' );
		}
		return '$' . number_format( $amount, 2, '.', ',' );
	}

	/**
	 * AJAX Handler: Dispatch Live Test Cashback Email
	 */
	public static function ajax_test_cashback_email() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}
		$email = sanitize_email( $_POST['email'] ?? get_option( 'admin_email' ) );
		if ( ! is_email( $email ) ) {
			wp_send_json_error( [ 'message' => 'Invalid email address' ] );
		}

		$data = [
			'customer_first_name'  => 'Alex',
			'customer_name'        => 'Alex Morgan',
			'order_number'         => '14589',
			'cashback_amount'      => 'Rp 25.000',
			'store_credit_balance' => 'Rp 25.000',
			'shop_url'             => home_url( '/shop/' ),
			'cta_text'             => 'Shop Device Skins',
		];

		$res = Exacoat_Email_Engine::send_email( 'customer_cashback_earned', $email, 'Alex Morgan', $data );
		if ( ! empty( $res['success'] ) ) {
			wp_send_json_success( $res );
		} else {
			wp_send_json_error( $res );
		}
	}

	/**
	 * AJAX Handler: Dispatch Live Test Store Credit Reminder
	 */
	public static function ajax_test_store_credit_reminder() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}
		$email = sanitize_email( $_POST['email'] ?? get_option( 'admin_email' ) );
		if ( ! is_email( $email ) ) {
			wp_send_json_error( [ 'message' => 'Invalid email address' ] );
		}

		$data = [
			'customer_first_name'  => 'Alex',
			'customer_name'        => 'Alex Morgan',
			'store_credit_balance' => 'Rp 50.000',
			'shop_url'             => home_url( '/shop/' ),
			'cta_text'             => 'Use Your Credit',
		];

		$res = Exacoat_Email_Engine::send_email( 'customer_store_credit_reminder', $email, 'Alex Morgan', $data );
		if ( ! empty( $res['success'] ) ) {
			wp_send_json_success( $res );
		} else {
			wp_send_json_error( $res );
		}
	}
}

}

if ( ! class_exists( 'Artmatter_Store_Credit_Manager' ) ) {
	class_alias( 'Exacoat_Store_Credit_Manager', 'Artmatter_Store_Credit_Manager' );
}
