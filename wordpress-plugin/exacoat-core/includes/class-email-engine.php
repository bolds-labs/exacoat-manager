<?php
/**
 * Exacoat Core Universal Native Email Engine
 * Directly renders pixel-perfect responsive dark-mode HTML templates and dispatches via Zoho ZeptoMail API.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Email_Engine' ) ) {

class Exacoat_Email_Engine {

	public static function init() {
		// AJAX Test / Preview Handlers
		add_action( 'wp_ajax_artmatter_send_native_test_email', [ __CLASS__, 'ajax_send_test_email' ] );
		add_action( 'wp_ajax_exacoat_send_native_test_email', [ __CLASS__, 'ajax_send_test_email' ] );
		add_action( 'wp_ajax_artmatter_preview_email_html', [ __CLASS__, 'ajax_preview_email_html' ] );
		add_action( 'wp_ajax_exacoat_preview_email_html', [ __CLASS__, 'ajax_preview_email_html' ] );

		// Action Scheduler async worker for sending emails in background
		add_action( 'artmatter_async_send_email_job', [ __CLASS__, 'process_async_email_job' ], 10, 4 );
		add_action( 'exacoat_async_send_email_job', [ __CLASS__, 'process_async_email_job' ], 10, 4 );

		// 1. Automatically suppress default WooCommerce core duplicate emails
		$suppressed_emails = [
			'customer_processing_order',
			'customer_completed_order',
			'customer_refunded_order',
			'customer_on_hold_order',
			'customer_note',
			'customer_invoice',
			'customer_reset_password',
			'customer_new_account',
			'failed_order',
		];
		foreach ( $suppressed_emails as $email_id ) {
			add_filter( "woocommerce_email_recipient_{$email_id}", '__return_empty_string', 999 );
			add_filter( "woocommerce_email_enabled_{$email_id}", '__return_false', 999 );
		}

		// 2. Intercept Customer Note Created
		add_action( 'woocommerce_new_customer_note', [ __CLASS__, 'handle_woocommerce_new_customer_note' ], 10, 1 );

		// 3. Intercept Customer Password Reset Notification
		add_action( 'woocommerce_reset_password_notification', [ __CLASS__, 'handle_woocommerce_reset_password_notification' ], 10, 2 );

		// 4. Intercept Customer Account Created
		add_action( 'woocommerce_created_customer', [ __CLASS__, 'handle_woocommerce_created_customer' ], 10, 3 );

		// 5. Intercept Manual Resend Order Details / Invoice
		add_action( 'woocommerce_before_resend_order_emails', [ __CLASS__, 'handle_woocommerce_resend_order_emails' ], 10, 2 );
	}

	/**
	 * Configuration Accessor
	 */
	/**
	 * Official Exacoat Brand Logo SVG
	 */
	public static function get_brand_logo_html(): string {
		return '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="136" height="24" viewBox="0 0 1368000 241000" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" style="display:block;border:0;outline:none;width:136px;height:24px;">'
			. '<path fill="#000000" fill-rule="nonzero" d="M1281000 218000l0 -40000 22000 -23000 43000 0 22000 23000 0 40000 -22000 23000 -43000 0 -22000 -23000zm59000 10000l14000 -14000 0 -32000 -14000 -14000 -31000 0 -14000 14000 0 32000 14000 14000 31000 0zm-33000 -52000l28000 0 8000 8000 0 13000 -5000 5000 6000 6000 0 10000 -12000 0 0 -7000 -4000 -5000 -9000 0 0 12000 -12000 0 0 -42000zm22000 20000l3000 -2000 0 -5000 -3000 -3000 -10000 0 0 10000 10000 0z"/>'
			. '<path fill="#000000" fill-rule="nonzero" d="M0 202000l0 -108000 36000 -36000 97000 0 37000 36000 0 67000 -129000 0 0 29000 13000 14000 62000 0 13000 -13000 0 -11000 40000 0 0 23000 -35000 35000 -99000 0 -35000 -36000zm129000 -70000l0 -25000 -14000 -15000 -60000 0 -14000 15000 0 25000 88000 0zm180000 106000l-43000 -60000 -44000 60000 -45000 0 66000 -91000 -65000 -89000 46000 0 42000 58000 41000 -58000 46000 0 -64000 89000 66000 91000 -46000 0zm51000 -32000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -74000 0 -11000 11000 0 22000 11000 11000 44000 0zm102000 -4000l0 -108000 35000 -36000 95000 0 35000 36000 0 30000 -40000 0 0 -17000 -15000 -14000 -55000 0 -15000 14000 0 82000 15000 14000 55000 0 15000 -14000 0 -17000 40000 0 0 30000 -35000 36000 -95000 0 -35000 -36000zm188000 0l0 -108000 36000 -36000 100000 0 36000 36000 0 108000 -36000 36000 -100000 0 -36000 -36000zm116000 2000l15000 -15000 0 -82000 -15000 -14000 -60000 0 -15000 14000 0 82000 15000 15000 60000 0zm84000 2000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -73000 0 -12000 11000 0 22000 11000 11000 44000 0zm118000 -4000l0 -109000 -33000 0 0 -35000 34000 0 0 -58000 40000 0 0 58000 55000 0 0 35000 -55000 0 0 96000 14000 14000 41000 0 0 35000 -60000 0 -36000 -36000z"/>'
			. '</svg>';
	}

	public static function get_config(): array {
		$settings = Exacoat_Core::get_settings();
		return [
			'zeptomail_token' => trim( $settings['zeptomail_token'] ?? '' ),
			'from_email'      => trim( $settings['email_from_address'] ?? 'support@exacoat.com' ),
			'from_name'       => trim( $settings['email_from_name'] ?? 'Exacoat' ),
			'reply_to'        => 'support@exacoat.com',
		];
	}

	/**
	 * Standard Icon URL Resolver (Supports official Artmatter PNGs + Lucide Icons fallback)
	 */
	public static function resolve_icon_url( string $icon_name_or_url ): string {
		if ( filter_var( $icon_name_or_url, FILTER_VALIDATE_URL ) ) {
			return $icon_name_or_url;
		}

		$official_map = [
			'security'            => 'https://media.artmatter.co/assets/icons-png/security.png',
																		'document_submitted'  => 'https://media.artmatter.co/assets/icons-png/document-submitted.png',
			'document_verified'   => 'https://media.artmatter.co/assets/icons-png/document-verified.png',
			'document_alert'      => 'https://media.artmatter.co/assets/icons-png/document-alert.png',
			'commission_pending'  => 'https://media.artmatter.co/assets/icons-png/commission-pending.png',
			'commission_approved' => 'https://media.artmatter.co/assets/icons-png/commission-approved.png',
			'payout_pending'      => 'https://media.artmatter.co/assets/icons-png/payout-pending.png',
			'payout_completed'    => 'https://media.artmatter.co/assets/icons-png/document-verified.png',
		];

		$key = strtolower( str_replace( [ '-', ' ' ], '_', $icon_name_or_url ) );
		if ( isset( $official_map[ $key ] ) ) {
			return $official_map[ $key ];
		}

		// Fallback to Lucide CDN SVG rendered dynamically
		$clean_lucide = strtolower( str_replace( '_', '-', $icon_name_or_url ) );
		return "https://cdn.jsdelivr.net/npm/lucide-static@0.460.0/icons/{$clean_lucide}.svg";
	}

	/**
	 * Complete Registry of Dynamic Email Event Templates
	 */
	public static function get_template_registry(): array {
		return [
			// 1. Customer Authentication & Accounts
			'customer_otp' => [
				'category'       => 'Authentication',
				'label'          => '🔑 Customer OTP Verification Code',
				'subject'        => 'Your verification code for Exacoat',
				'badge'          => 'Security verification',
				'icon'           => 'security',
				'title'          => 'Verify your identity',
				'body_primary'   => 'Use the code below to complete verification.',
				'type'           => 'otp',
				'defaults'       => [
					'otp_code' => '849201',
				],
			],
			'customer_new_account' => [
				'category'       => 'Authentication',
				'label'          => 'Customer Account Created (Welcome)',
				'subject'        => 'Welcome to Exacoat',
				'badge'          => 'Account created',
				'icon'           => 'security',
				'title'          => 'Welcome to Exacoat',
				'body_primary'   => 'Your Exacoat account has been created. You can use your account to review orders, save delivery details, and track shipments.',
				'type'           => 'customer_account',
				'defaults'       => [
					'customer_first_name' => 'Customer',
					'account_url'         => 'https://exacoat.com/my-account',
				],
			],
			'customer_reset_password' => [
				'category'       => 'Authentication',
				'label'          => 'Customer Password Reset',
				'subject'        => 'Password reset request for Exacoat',
				'badge'          => 'Account security',
				'icon'           => 'security',
				'title'          => 'Reset your password',
				'body_primary'   => 'Someone has requested a password reset for your Exacoat account.',
				'type'           => 'customer_account',
				'defaults'       => [
					'customer_first_name' => 'Customer',
					'reset_url'           => 'https://exacoat.com/my-account/lost-password/?key=sample_key',
				],
			],

			// 2. Customer Orders & Fulfillment
			'customer_order_processing' => [
				'category'       => 'Orders',
				'label'          => 'Order Confirmed',
				'subject'        => 'Your Exacoat order #{{order_number}} is confirmed',
				'badge'          => 'Order confirmed',
				'icon'           => 'security',
				'title'          => 'Order confirmed',
				'body_primary'   => 'Thank you for your order. We’ve received order #{{order_number}} and our production team will begin preparing your order shortly.',
				'body_secondary' => 'You can review your order and delivery details below.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_in_production' => [
				'category'       => 'Orders',
				'label'          => 'In Production',
				'subject'        => 'Your Exacoat order #{{order_number}} is in production',
				'badge'          => 'In production',
				'icon'           => 'security',
				'title'          => 'In production',
				'body_primary'   => 'Your custom skins for order #{{order_number}} are now on our production line.',
				'body_secondary' => 'We will notify you as soon as your order is packaged and ready to ship.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_awaiting_pickup' => [
				'category'       => 'Orders',
				'label'          => 'Ready to Ship',
				'subject'        => 'Your Exacoat order #{{order_number}} is ready to ship',
				'badge'          => 'Ready to ship',
				'icon'           => 'document_verified',
				'title'          => 'Ready to ship',
				'body_primary'   => 'Your order #{{order_number}} has passed quality inspection and has been packaged for courier pickup.',
				'body_secondary' => 'Your tracking number will be activated once scanned at the logistics hub.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_shipped' => [
				'category'       => 'Orders',
				'label'          => 'Shipped',
				'subject'        => 'Your Exacoat order #{{order_number}} is on its way',
				'badge'          => 'On its way',
				'icon'           => 'document_verified',
				'title'          => 'On its way to you',
				'body_primary'   => 'Your order #{{order_number}} has been dispatched and is on its way.',
				'body_secondary' => 'You can find your tracking details and order summary below.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589', [
					'courier'         => 'JNE Express',
					'tracking_number' => 'JNE9842194829',
					'tracking_url'    => 'https://www.jne.co.id',
				] ),
			],
			'customer_order_completed' => [
				'category'       => 'Orders',
				'label'          => 'Delivered',
				'subject'        => 'Your Exacoat order #{{order_number}} has arrived',
				'badge'          => 'Delivered',
				'icon'           => 'document_verified',
				'title'          => 'Delivered',
				'body_primary'   => 'Your order #{{order_number}} has been delivered by the courier.',
				'body_secondary' => 'We hope you enjoy your new skins. If you need any assistance, our support team is always here to help.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_delivered' => [
				'category'       => 'Orders',
				'label'          => 'Delivered',
				'subject'        => 'Your Exacoat order #{{order_number}} has arrived',
				'badge'          => 'Delivered',
				'icon'           => 'document_verified',
				'title'          => 'Delivered',
				'body_primary'   => 'Your order #{{order_number}} has been delivered by the courier.',
				'body_secondary' => 'We hope you enjoy your new skins. If you need any assistance, our support team is always here to help.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_store_pickup_ready' => [
				'category'       => 'Orders',
				'label'          => 'Store Pickup Ready (SMB)',
				'subject'        => '{customer_first_name}, your order (#{order_number}) is ready for pick up',
				'preheader'      => 'Ready to protect your device?',
				'badge'          => 'Ready for pick up',
				'icon'           => 'document_verified',
				'title'          => 'Your order is ready for pick up',
				'body_primary'   => 'Your order <b>(#{order_number})</b> is ready for pick up.<br>Bring your order number and get it installed for free on:',
				'body_secondary' => '',
				'is_store_pickup'=> true,
				'pickup_ready'   => true,
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589', [
					'is_store_pickup'      => true,
					'pickup_ready'         => true,
					'shipping_total'       => 'Rp 0',
					'shipping_method_name' => 'Store Pickup (Summarecon Bekasi)',
					'courier'              => '',
					'tracking_number'      => '',
					'tracking_url'         => '',
				] ),
			],
			'customer_order_store_pickup_completed' => [
				'category'       => 'Orders',
				'label'          => 'Store Pickup Completed',
				'subject'        => '{customer_first_name}, your order has been picked up',
				'preheader'      => 'Thank you for coming!',
				'badge'          => 'Picked up',
				'icon'           => 'document_verified',
				'title'          => 'Order picked up',
				'body_primary'   => 'Your order <b>(#{order_number})</b> has been picked up.<br>Leave a review and tell us about your experience!',
				'body_secondary' => '',
				'is_store_pickup'=> true,
				'pickup_review'  => true,
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589', [
					'is_store_pickup'      => true,
					'pickup_review'        => true,
					'shipping_total'       => 'Rp 0',
					'shipping_method_name' => 'Store Pickup (Summarecon Bekasi)',
					'courier'              => '',
					'tracking_number'      => '',
					'tracking_url'         => '',
				] ),
			],
			'customer_order_review_invitation' => [
				'category'       => 'Orders',
				'label'          => 'Product Review Invitation',
				'subject'        => 'Review {{product_title}} and get a special offer on your next order',
				'badge'          => 'Product Review',
				'icon'           => 'document_verified',
				'title'          => 'How do your new skins look?',
				'body_primary'   => 'Your Exacoat skin was delivered recently. We hope you love your new look.',
				'body_secondary' => 'Take a moment to share your review and a photo of your skin installed on your device.',
				'cta_text'       => 'Write a Review',
				'type'           => 'review_invitation',
				'defaults'       => [
					'order_number'        => '14589',
					'customer_first_name' => 'Alex',
					'product_title'       => 'iPhone 16 Pro Skins',
					'artwork_title'       => 'iPhone 16 Pro Skins',
					'artwork_image'       => 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
					'review_url'          => 'https://exacoat.com/review?order_id=14589',
				],
			],
			'customer_order_refunded' => [
				'category'       => 'Orders',
				'label'          => 'Refunded',
				'subject'        => 'Refund confirmation for order #{{order_number}}',
				'badge'          => 'Refund processed',
				'icon'           => 'document_alert',
				'title'          => 'Refund processed',
				'body_primary'   => 'We have processed a refund of {{refund_amount}} for order #{{order_number}}.',
				'body_secondary' => 'Depending on your payment method or bank, the funds will reflect in your account within 3 to 5 business days.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589', [
					'refund_amount'  => 'Rp 149.000',
					'total_refunded' => 'Rp 149.000',
				] ),
			],
			'customer_order_on_hold' => [
				'category'       => 'Orders',
				'label'          => 'Order On Hold',
				'subject'        => 'Your Exacoat order #{{order_number}} is on hold',
				'badge'          => 'Payment pending',
				'icon'           => 'security',
				'title'          => 'Order on hold',
				'body_primary'   => 'We’ve received your order #{{order_number}} and are awaiting payment confirmation.',
				'body_secondary' => 'Your order will enter production as soon as payment is confirmed.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_failed' => [
				'category'       => 'Orders',
				'label'          => 'Payment Failed',
				'subject'        => 'Payment incomplete for order #{{order_number}}',
				'badge'          => 'Payment not completed',
				'icon'           => 'document_alert',
				'title'          => 'Payment not completed',
				'body_primary'   => 'We were unable to process payment for order #{{order_number}}.',
				'body_secondary' => 'Your items remain saved in your cart. You can retry checkout with an alternative payment method.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_order_note' => [
				'category'       => 'Orders',
				'label'          => 'Customer Order Note Added',
				'subject'        => 'Update regarding your Exacoat order #{{order_number}}',
				'badge'          => 'Order update',
				'icon'           => 'document_verified',
				'title'          => 'Note regarding your order',
				'body_primary'   => 'A note has been added to your order #{{order_number}}:',
				'body_secondary' => '',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589', [
					'customer_note' => 'Your device skin has completed quality inspection and packaging.',
				] ),
			],
			'customer_order_invoice' => [
				'category'       => 'Orders',
				'label'          => 'Order Summary Resend',
				'subject'        => 'Order summary for order #{{order_number}}',
				'badge'          => 'Order summary',
				'icon'           => 'document_verified',
				'title'          => 'Your order summary',
				'body_primary'   => 'Here is a copy of your order details for order #{{order_number}}.',
				'body_secondary' => 'You can review your complete order breakdown and delivery details below.',
				'type'           => 'customer_order',
				'defaults'       => self::get_mock_order_defaults( '14589' ),
			],
			'customer_cashback_earned' => [
				'category'       => 'Store Credits',
				'label'          => 'Cashback Credited (Store Credit)',
				'subject'        => 'You received {{cashback_amount}} cashback on order #{{order_number}}',
				'badge'          => 'Store Credit',
				'icon'           => 'document_verified',
				'title'          => 'Your cashback is ready to use',
				'body_primary'   => 'Your cashback of {{cashback_amount}} from order #{{order_number}} has been credited to your Exacoat store credit balance.',
				'body_secondary' => 'Your available store credit balance is now {{store_credit_balance}}. You can apply it directly during checkout on your next order.',
				'cta_text'       => 'Shop Device Skins',
				'type'           => 'store_credit',
				'defaults'       => [
					'customer_first_name'  => 'Alex',
					'cashback_amount'      => 'Rp 25.000',
					'store_credit_balance' => 'Rp 25.000',
					'order_number'         => '14589',
					'shop_url'             => 'https://exacoat.com/shop/',
				],
			],
			'customer_store_credit_reminder' => [
				'category'       => 'Store Credits',
				'label'          => 'Store Credit Balance Reminder',
				'subject'        => 'You have {{store_credit_balance}} store credit waiting in your Exacoat account',
				'badge'          => 'Store Credit',
				'icon'           => 'document_verified',
				'title'          => 'Your store credit is waiting',
				'body_primary'   => 'You still have {{store_credit_balance}} in store credit available in your Exacoat account.',
				'body_secondary' => 'Use it on your next precision skin, camera protection, or accessories. Simply log in and apply your balance at checkout.',
				'cta_text'       => 'Use Your Credit',
				'type'           => 'store_credit',
				'defaults'       => [
					'customer_first_name'  => 'Alex',
					'store_credit_balance' => 'Rp 50.000',
					'shop_url'             => 'https://exacoat.com/shop/',
				],
			],
			'customer_order_review_reward' => [
				'category'       => 'Orders',
				'label'          => 'Exacoat Perks Promo Code',
				'subject'        => 'Your Exacoat Perks promo code is here',
				'badge'          => 'Exacoat Perks',
				'icon'           => 'document_verified',
				'title'          => 'Your Exacoat Perks',
				'body_primary'   => 'Thank you for sharing your experience with the Exacoat community. Here is your exclusive 20% promo code for your next order.',
				'body_secondary' => 'This promo code applies to any device skin across our entire catalog.',
				'cta_text'       => 'Explore The Collection',
				'type'           => 'review_reward',
				'defaults'       => [
					'customer_first_name' => 'Alex',
					'coupon_code'         => 'EXACOAT20-X8K9P',
					'discount_percent'    => '20',
					'discount_amount'     => '20%',
					'expiry_date'         => date( 'F j, Y', strtotime( '+30 days' ) ),
					'product_title'       => 'Device Skin',
					'shop_url'            => 'https://exacoat.com/shop/',
				],
			],
		];
	}

	/**
	 * Helper: Mock Order Defaults for Customer Order Email Previews
	 */
	public static function get_mock_order_defaults( string $order_number = '14589', array $extra = [] ): array {
		return array_merge( [
			'order_number'         => $order_number,
			'customer_first_name'  => 'William',
			'currency'             => 'IDR',
			'items'                => [
				[
					'name'          => 'iPhone 16 Pro Skins',
					'image_url'     => 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
					'quantity'      => 1,
					'subtotal'      => 'Rp 149.000',
					'total'         => 'Rp 149.000',
					'meta'          => "Variant: Full Body\nTexture: Matrix Black",
				],
			],
			'item_count'           => 1,
			'subtotal'             => 'Rp 149.000',
			'discount_total'       => '',
			'coupon_codes'         => [],
			'shipping_total'       => 'Rp 15.000',
			'shipping_method_name' => 'JNE Reguler',
			'total_tax'            => '',
			'total'                => 'Rp 164.000',
			'total_refunded'       => '',
			'payment_method_title' => 'Midtrans / QRIS',
			'shipping_address'     => "William Vance\nJl. Sudirman No. 42\nJakarta Selatan 12190\nIndonesia",
			'billing_address'      => "William Vance\nJl. Sudirman No. 42\nJakarta Selatan 12190\nIndonesia",
			'courier'              => 'JNE Express',
			'tracking_number'      => 'JNE9842194829',
			'tracking_url'         => 'https://www.jne.co.id',
		], $extra );
	}

	/**
	 * Master HTML Email Renderer
	 * Generates pixel-perfect, responsive dark-mode HTML matching Artmatter's brand guidelines.
	 */
	public static function render_html( string $event, array $data = [] ): array {
		// Normalize alias event names
		$aliases = [
			'customer_order_completed' => 'customer_order_delivered',
			'commission_earned'        => 'commission_pending',
			'payout_completed'   => 'payout_sent',
			'payout_processed'   => 'payout_sent',
			'otp'                => 'artist_otp_code',
			'artist_otp'         => 'artist_otp_code',
			'welcome'            => 'artist_applied',
			'approved'           => 'artist_approved',
			'rejected'           => 'artist_rejected',
		];
		if ( isset( $aliases[ $event ] ) ) {
			$event = $aliases[ $event ];
		}

		$registry = self::get_template_registry();
		$tmpl     = $registry[ $event ] ?? $registry['artist_otp_code'];

		// Merge defaults with provided data
		$merged_data = array_merge( $tmpl['defaults'] ?? [], $data );

		$type = $tmpl['type'] ?? 'notice';

		// Branch directly to Light-Mode Customer Account Layout
		if ( $type === 'customer_account' || in_array( $event, [ 'customer_reset_password', 'customer_new_account' ], true ) ) {
			return self::render_customer_account_html( $event, $merged_data, $tmpl );
		}

		// Branch directly to Light-Mode Custom Poster Order Layout
		if ( $event === 'custom_order_link' || $type === 'custom_order' || $type === 'custom_order_link' ) {
			return self::render_custom_poster_order_html( $event, $merged_data, $tmpl );
		}

		// Branch directly to Product Review Invitation Layout
		if ( $event === 'customer_order_review_invitation' || $type === 'review_invitation' ) {
			return self::render_review_invitation_html( $event, $merged_data, $tmpl );
		}

		// Branch directly to Light-Mode Store Credit / Cashback Layout
		if ( $type === 'store_credit' || in_array( $event, [ 'customer_cashback_earned', 'customer_store_credit_reminder' ], true ) ) {
			return self::render_store_credit_html( $event, $merged_data, $tmpl );
		}

		// Branch directly to Exacoat Perks Promo Code Reward Layout
		if ( $event === 'customer_order_review_reward' || $type === 'review_reward' ) {
			return self::render_review_reward_html( $event, $merged_data, $tmpl );
		}

		// Branch directly to Light-Mode Customer Order Layout for customer orders
		if ( $type === 'customer_order' || str_starts_with( $event, 'customer_order_' ) ) {
			return self::render_customer_order_html( $event, $merged_data, $tmpl );
		}

		$customer_name = esc_html( $merged_data['customer_name'] ?? $merged_data['display_name'] ?? 'Customer' );
		$badge_text    = esc_html( $merged_data['badge_text'] ?? $tmpl['badge'] ?? 'Exacoat' );
		$title         = esc_html( $merged_data['title'] ?? $tmpl['title'] ?? 'Notification' );
		$icon_url      = self::resolve_icon_url( $merged_data['icon_image'] ?? $tmpl['icon'] ?? 'security' );
		$body_primary  = $merged_data['body_primary'] ?? $tmpl['body_primary'] ?? '';
		$body_secondary= $merged_data['body_secondary'] ?? $tmpl['body_secondary'] ?? '';
		$body_additional=$merged_data['body_additional'] ?? $tmpl['body_additional'] ?? '';
		$type          = $tmpl['type'] ?? 'notice';

		// Dynamically build replacement map for ALL scalar keys in $merged_data (supports both {{key}} and {key})
		$replacements = [];
		foreach ( $merged_data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		// Ensure primary canonical fallbacks
		if ( ! isset( $replacements['{{artist_name}}'] ) ) {
			$replacements['{{artist_name}}'] = $artist_name;
			$replacements['{artist_name}']   = $artist_name;
		}
		if ( ! empty( $merged_data['order_code'] ) ) {
			$replacements['{{order_code}}'] = (string) $merged_data['order_code'];
			$replacements['{order_code}']   = (string) $merged_data['order_code'];
		}

		$subject         = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );
		$title           = str_replace( array_keys( $replacements ), array_values( $replacements ), $title );
		$body_primary    = str_replace( array_keys( $replacements ), array_values( $replacements ), $body_primary );
		$body_secondary  = str_replace( array_keys( $replacements ), array_values( $replacements ), $body_secondary );
		$body_additional = str_replace( array_keys( $replacements ), array_values( $replacements ), $body_additional );

		// Clean up any remaining orphan {{tags}} and dangling # symbols in text components
		$tag_pattern     = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject         = preg_replace( $tag_pattern, '', $subject );
		$subject         = preg_replace( '/\(\s*#\s*\)/', '', $subject );
		$subject         = preg_replace( '/#(?=\s|$)/', '', $subject );
		$subject         = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );

		$title           = preg_replace( $tag_pattern, '', $title );
		$title           = preg_replace( '/\s{2,}/', ' ', trim( $title ) );
		$body_primary    = preg_replace( $tag_pattern, '', $body_primary );
		$body_secondary  = preg_replace( $tag_pattern, '', $body_secondary );
		$body_additional = preg_replace( $tag_pattern, '', $body_additional );

		// Render Type-Specific Content Slot
		$slot_html = '';

		if ( $type === 'otp' ) {
			$otp_code = esc_html( $merged_data['otp_code'] ?? '849201' );
			$slot_html = "
			<tr>
				<td align=\"center\" style=\"padding:0 40px 32px;\">
					<table width=\"100%\" style=\"border-collapse:collapse;background:#141414;border-radius:14px;\">
						<tbody>
							<tr>
								<td align=\"center\" style=\"padding:32px 16px 8px;\">
									<span style=\"color:#ffffff;font-size:48px;display:inline-block;font-weight:600;letter-spacing:10px;font-family:monospace;\">{$otp_code}</span>
								</td>
							</tr>
							<tr>
								<td align=\"center\" style=\"padding:0 16px 24px;\">
									<p style=\"margin:0;font-size:13px;color:#9a9a9a;\">This code is valid for <b>5 minutes</b></p>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>";
		} elseif ( $type === 'commission' ) {
			$art_img   = esc_url( $merged_data['artwork_image'] ?? 'https://media.artmatter.co/2026/08/sample-art.jpg' );
			$art_title = esc_html( $merged_data['product_title'] ?? ( $merged_data['artwork_title'] ?? 'Precision Skin' ) );
			$quantity  = intval( $merged_data['quantity'] ?? 1 );
			$comm_stat = esc_html( $merged_data['commission_status'] ?? 'Pending' );
			$comm_amt  = esc_html( $merged_data['commission_amount'] ?? '$15.00' );
			$share_display = ! empty( $merged_data['share_and_earn'] ) ? 'inline-block' : 'none';

			$slot_html = "
			<tr>
				<td align=\"center\" style=\"padding:0 40px 32px;\">
					<table width=\"100%\" style=\"background:#141414;border-radius:14px;overflow:hidden;\">
						<tbody>
							<tr>
								<td align=\"center\" style=\"padding-top:20px;\">
									<img src=\"{$art_img}\" alt=\"{$art_title}\" style=\"width:80%;max-width:480px;height:auto;border-radius:8px;\">
								</td>
							</tr>
							<tr>
								<td align=\"center\" style=\"padding:20px 16px 24px;\">
									<p style=\"margin:0 0 6px;font-size:16px;font-weight:600;color:#ffffff;\">{$art_title}</p>
									<p style=\"margin:0 0 16px;font-size:13px;color:#9a9a9a;\">Quantity: {$quantity}</p>
									<table cellpadding=\"0\" cellspacing=\"0\" align=\"center\">
										<tbody>
											<tr>
												<td style=\"padding:6px 12px;font-size:11px;background:#333333;color:#ffffff;border-radius:999px;\">
													{$comm_stat}
												</td>
												<td style=\"padding-left:8px;\"></td>
												<td style=\"padding:6px 12px;font-size:11px;font-weight:700;background:#f3aa18;color:#111111;border-radius:999px;\">
													{$comm_amt}
												</td>
												<td style=\"padding-left:8px;\"></td>
												<td style=\"display:{$share_display};padding:6px 12px;font-size:11px;font-weight:600;background:#484535;color:#fbbf24;border-radius:999px;\">
													Share &amp; Earn
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr>
				<td align=\"center\" style=\"padding:0 40px 16px;\">
					<a href=\"https://exacoat.com/dashboard\" target=\"_blank\" style=\"display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#111111;background:#ffffff;border-radius:12px;text-decoration:none;\">
						View dashboard
					</a>
				</td>
			</tr>";
		} elseif ( $type === 'artwork_rejection' ) {
			$art_img   = esc_url( $merged_data['artwork_image'] ?? '' );
			$art_title = esc_html( $merged_data['product_title'] ?? ( $merged_data['artwork_title'] ?? 'Precision Skin' ) );
			$reason    = esc_html( $merged_data['rejection_reason'] ?? 'Submission does not meet curation criteria.' );
			$cta_text  = esc_html( $tmpl['cta_text'] ?? 'Go to Studio Dashboard' );
			$cta_url   = esc_url( $tmpl['cta_url'] ?? 'https://exacoat.com/dashboard' );

			$img_html = '';
			if ( ! empty( $art_img ) && $art_img !== 'https://media.artmatter.co/assets/sample-art.jpg' ) {
				$img_html = "
				<tr>
					<td align=\"center\" style=\"padding-top:20px;\">
						<img src=\"{$art_img}\" alt=\"{$art_title}\" style=\"width:70%;max-width:380px;height:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.08);display:block;\">
					</td>
				</tr>";
			}

			$slot_html = "
			<tr>
				<td align=\"center\" style=\"padding:0 40px 24px;\">
					<table width=\"100%\" style=\"background:#141414;border-radius:14px;border:1px solid #27272a;overflow:hidden;\">
						<tbody>
							{$img_html}
							<tr>
								<td align=\"center\" style=\"padding:16px 20px 14px;\">
									<p style=\"margin:0 0 6px;font-size:16px;font-weight:700;color:#ffffff;\">{$art_title}</p>
									<span style=\"display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;\">Declined / Not Approved</span>
								</td>
							</tr>
							<tr>
								<td style=\"padding:0 20px 20px;\">
									<div style=\"background:rgba(239,68,68,0.06);border-left:3px solid #ef4444;border-radius:6px;padding:12px 14px;text-align:left;\">
										<p style=\"margin:0 0 4px;font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:0.5px;\">Curation Feedback:</p>
										<p style=\"margin:0;font-size:13px;line-height:1.6;color:#e4e4e7;\">{$reason}</p>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr>
				<td align=\"center\" style=\"padding:0 40px 28px;\">
					<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\">
						<tbody>
							<tr>
								<td align=\"center\" style=\"background-color:#ffffff;border-radius:12px;\">
									<a href=\"{$cta_url}\" target=\"_blank\" style=\"display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#111111;text-decoration:none;border-radius:12px;\">
										{$cta_text}
									</a>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>";
		} elseif ( $type === 'action_list' ) {
			$cta_text = esc_html( $tmpl['cta_text'] ?? 'Go to Store' );
			$cta_url  = esc_url( $tmpl['cta_url'] ?? 'https://exacoat.com/dashboard' );
			$sec_text = ! empty( $tmpl['secondary_link_text'] ) ? esc_html( $tmpl['secondary_link_text'] ) : '';
			$sec_url  = ! empty( $merged_data['artist_page_url'] ) ? esc_url( $merged_data['artist_page_url'] ) : ( ! empty( $tmpl['secondary_link_url'] ) ? esc_url( $tmpl['secondary_link_url'] ) : '' );

			$checklist_items = '';
			if ( ! empty( $tmpl['checklist'] ) && is_array( $tmpl['checklist'] ) ) {
				foreach ( $tmpl['checklist'] as $item ) {
					$checklist_items .= "<li style=\"margin-bottom:6px;\">" . esc_html( $item ) . "</li>";
				}
			}

			$checklist_title = esc_html( $tmpl['checklist_title'] ?? 'What you can do next' );

			$slot_html = "
			<tr>
				<td align=\"center\" style=\"padding:0 40px 32px;\">
					<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\">
						<tbody>
							<tr>
								<td align=\"center\" style=\"background-color:#ffffff;border-radius:12px;\">
									<a href=\"{$cta_url}\" target=\"_blank\" style=\"display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#111111;text-decoration:none;border-radius:12px;\">
										{$cta_text}
									</a>
								</td>
							</tr>
						</tbody>
					</table>";

			if ( $sec_text && $sec_url ) {
				$slot_html .= "
					<p style=\"margin:12px 0 0 0;\">
						<span style=\"font-size:13px;color:#8f8f8f;\">or <a href=\"{$sec_url}\" style=\"color:#ffffff;text-decoration:underline;\">" . esc_html( str_replace( 'or ', '', $sec_text ) ) . "</a></span>
					</p>";
			}

			if ( $checklist_items ) {
				$slot_html .= "
					<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-top:36px;background-color:#141414;border-radius:12px;\">
						<tbody>
							<tr>
								<td style=\"padding:24px;text-align:left;\">
									<p style=\"margin:0 0 12px 0;font-weight:600;font-size:14px;color:#ffffff;\">{$checklist_title}</p>
									<ul style=\"margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:#b0b0b0;\">
										{$checklist_items}
									</ul>
								</td>
							</tr>
						</tbody>
					</table>";
			}

			$slot_html .= "</td></tr>";
		} elseif ( $type === 'payout' ) {
			$payout_amt  = esc_html( $merged_data['payout_amount'] ?? '$71.73' );
			$payout_rec  = esc_html( $merged_data['payout_record_id'] ?? $merged_data['payout_id'] ?? 'P-8108' );
			$payout_meth = esc_html( $merged_data['payout_method'] ?? 'PayPal' );
			$payout_dest = esc_html( $merged_data['payout_destination'] ?? 'support@exacoat.com' );
			$cta_url     = esc_url( $tmpl['cta_url'] ?? 'https://exacoat.com/dashboard#payouts' );
			$cta_text    = esc_html( $tmpl['cta_text'] ?? 'View Payout Statement' );

			$slot_html = "
			<tr>
				<td align=\"center\" style=\"padding:0 40px 32px;\">
					<table width=\"100%\" style=\"background:#141414;border-radius:14px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;\">
						<tbody>
							<tr>
								<td align=\"center\" style=\"padding:28px 20px 24px;\">
									<p style=\"margin:0 0 4px;font-size:11px;color:#9a9a9a;text-transform:uppercase;letter-spacing:0.8px;font-family:monospace;\">Total Settlement Transferred</p>
									<p style=\"margin:0 0 16px;font-size:36px;font-weight:800;color:#f3aa18;letter-spacing:-0.5px;\">{$payout_amt}</p>
									<table cellpadding=\"0\" cellspacing=\"0\" align=\"center\" style=\"font-size:12px;\">
										<tbody>
											<tr>
												<td style=\"padding:6px 12px;background:#222;color:#fff;border-radius:999px;font-family:monospace;\">
													Payout ID: <b>{$payout_rec}</b>
												</td>
												<td style=\"padding-left:8px;\"></td>
												<td style=\"padding:6px 12px;background:#1e2920;color:#f3aa18;border-radius:999px;font-weight:600;\">
													{$payout_meth}
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
			<tr>
				<td align=\"center\" style=\"padding:0 40px 16px;\">
					<a href=\"{$cta_url}\" target=\"_blank\" style=\"display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#111111;background:#ffffff;border-radius:12px;text-decoration:none;\">
						{$cta_text}
					</a>
				</td>
			</tr>";
		} elseif ( $type === 'custom_order' ) {
			$art_img    = esc_url( $merged_data['artwork_image'] ?? '' );
			$order_code = esc_html( $merged_data['order_code'] ?? 'CUSTOM' );
			$order_url  = esc_url( $merged_data['order_url'] ?? ( home_url( '/product/custom-order-' . strtolower( $order_code ) ) ) );
			$cta_text   = esc_html( $tmpl['cta_text'] ?? 'Complete Custom Order' );

			$slot_html = "
			<tr>
				<td align=\"center\" style=\"padding:0 40px 32px;\">
					<table width=\"100%\" style=\"background:#141414;border-radius:14px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;\">
						<tbody>";
			if ( $art_img ) {
				$slot_html .= "
							<tr>
								<td align=\"center\" style=\"padding:24px 24px 0;\">
									<img src=\"{$art_img}\" alt=\"Custom Poster #{$order_code}\" style=\"width:100%;max-width:380px;height:auto;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.5);display:block;\">
								</td>
							</tr>";
			}
			$slot_html .= "
							<tr>
								<td align=\"center\" style=\"padding:24px 20px 28px;\">
									<p style=\"margin:0 0 4px;font-size:11px;color:#9a9a9a;text-transform:uppercase;letter-spacing:0.8px;font-family:monospace;\">Order Code</p>
									<p style=\"margin:0 0 16px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;font-family:monospace;\">#{$order_code}</p>
									<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\">
										<tbody>
											<tr>
												<td align=\"center\" style=\"background-color:#f3aa18;border-radius:12px;\">
													<a href=\"{$order_url}\" target=\"_blank\" style=\"display:inline-block;padding:16px 36px;font-size:15px;font-weight:700;color:#111111;text-decoration:none;border-radius:12px;\">
														{$cta_text} &rarr;
													</a>
												</td>
											</tr>
										</tbody>
									</table>
									<p style=\"margin:16px 0 0;font-size:12px;color:#777777;\">
										Link expires in 48 hours: <a href=\"{$order_url}\" style=\"color:#f3aa18;text-decoration:underline;\">{$order_url}</a>
									</p>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>";
		}

		$secondary_p = $body_secondary ? "<p style=\"margin:0 0 20px;font-size:16px;line-height:1.7;color:#b0b0b0;\">{$body_secondary}</p>" : '';
		$additional_p = $body_additional ? "<tr><td align=\"center\" style=\"padding:0 40px 32px;\"><p style=\"margin:0;font-size:13px;color:#8f8f8f;\">{$body_additional}</p></td></tr>" : '';

		// Assemble Full Responsive Dark-Mode HTML
		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #0f0f0f;
      font-family: 'Neue Haas Display', 'Neue Haas Grotesk Text Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }
    a[x-apple-data-detectors],
    u+#body a,
    #MessageViewBody a {
      color: inherit !important;
      text-decoration: none !important;
    }
    @media screen and (max-width: 600px) {
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .h1-mobile {
        font-size: 26px !important;
        line-height: 34px !important;
      }
    }
  </style>
</head>
<body bgcolor=\"#0f0f0f\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#0f0f0f\" style=\"border-collapse:collapse;\">
    <tbody>
      <tr>
        <td align=\"center\" style=\"padding:48px 16px;\">
          <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;background-color:#1a1a1a;border-radius:16px;overflow:hidden;\" bgcolor=\"#1a1a1a\">
            <tbody>
              <!-- 1. Wordmark Header -->
              <tr>
                <td align=\"center\" style=\"padding:48px 40px 12px;\" class=\"mobile-padding\">
                  ' . self::get_brand_logo_html() . '
                </td>
              </tr>

              <!-- 2. Pill Badge -->
              <tr>
                <td align=\"center\" style=\"padding:5px 40px 24px;\">
                  <table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-collapse:collapse;\">
                    <tbody>
                      <tr>
                        <td style=\"padding:4px 12px;font-size:10px;font-weight:500;color:#cfcfcf;background-color:#2a2a2a;border-radius:999px;\">
                          {$badge_text}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- 3. Top Divider -->
              <tr>
                <td style=\"padding:0 40px;\">
                  <hr style=\"border:none;border-top:1px solid #2a2a2a;margin:0;\">
                </td>
              </tr>

              <!-- 4. Center Visual Icon -->
              <tr>
                <td align=\"center\" style=\"padding:28px 0 14px;\">
                  <img src=\"{$icon_url}\" alt=\"{$badge_text}\" width=\"96\" style=\"display:block;width:96px;height:auto;\">
                </td>
              </tr>

              <!-- 5. H1 Headline -->
              <tr>
                <td align=\"center\" style=\"padding:0 40px 16px;\" class=\"mobile-padding\">
                  <h1 class=\"h1-mobile\" style=\"margin:0;font-size:32px;font-weight:600;letter-spacing:-0.4px;color:#ffffff;\">
                    {$title}
                  </h1>
                </td>
              </tr>

              <!-- 6. Greeting & Paragraphs -->
              <tr>
                <td align=\"center\" style=\"padding:12px 40px 32px;\" class=\"mobile-padding\">
                  <p style=\"margin:0 0 12px;font-size:16px;color:#d4d4d4;\">Hi {$artist_name},</p>
                  <p style=\"margin:0 0 16px;font-size:16px;line-height:1.7;color:#b0b0b0;\">{$body_primary}</p>
                  {$secondary_p}
                </td>
              </tr>

              <!-- 7. Dynamic Content Slot (OTP, Commission, Action List, etc.) -->
              {$slot_html}
              {$additional_p}

              <!-- 8. Bottom Divider -->
              <tr>
                <td style=\"padding:0 40px;\">
                  <hr style=\"border:none;border-top:1px solid #2a2a2a;margin:0;\">
                </td>
              </tr>

              <!-- 9. Help & Support -->
              <tr>
                <td align=\"center\" style=\"padding:32px 40px;\">
                  <p style=\"margin:0;font-size:12px;line-height:1.6;color:#8f8f8f;\">
                    Have questions or need help?<br>
                    Reach us at <a href=\"mailto:support@exacoat.com\" style=\"color:#ffffff;text-decoration:underline;\">support@exacoat.com</a>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 10. Legal Footer -->
          <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;margin-top:28px;\">
            <tbody>
              <tr>
                <td align=\"center\">
                  <p style=\"margin:0 0 8px;font-size:12px;color:#555555;\">© Exacoat. All rights reserved.</p>
                  <p style=\"margin:0;font-size:12px;color:#444444;\">You’re receiving this email regarding your Exacoat account.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
</html>";

		// Final Pass: Ensure ZERO raw template tags exist anywhere in output HTML or Subject
		$html    = preg_replace( '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/', '', $html );
		$subject = preg_replace( '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/', '', $subject );
		$subject = preg_replace( '/\(\s*#\s*\)/', '', $subject );
		$subject = preg_replace( '/#(?=\s|$)/', '', $subject );
		$subject = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );

		return [
			'subject'  => $subject,
			'html'     => $html,
			'tmpl_info'=> $tmpl,
		];
	}

	/**
	 * Generate Official Settlement Statement HTML Document
	 */
	public static function generate_payout_statement_html( array $data ): string {
		$payout_id     = esc_html( $data['payout_id'] ?? 'PO-8108' );
		$artist_name   = esc_html( $data['artist_name'] ?? ( $data['artist_username'] ?? 'Vendor / Beneficiary' ) );
		$amount        = esc_html( $data['payout_amount'] ?? '$0.00' );
		$method        = esc_html( $data['payout_method'] ?? 'Bank Transfer / PayPal' );
		$destination   = esc_html( $data['payout_destination'] ?? 'Account on file' );
		$date          = esc_html( $data['processed_date'] ?? date( 'F j, Y' ) );

		return "<!DOCTYPE html>
		<html>
		<head>
			<meta charset=\"utf-8\">
			<title>Payout Settlement Statement - {$payout_id}</title>
			<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap\" rel=\"stylesheet\">
			<style>
				body { font-family: 'Inter', sans-serif; margin: 0; padding: 30px; color: #111827; background: #ffffff; }
				.box { max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
				.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 18px; margin-bottom: 20px; }
				.badge { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
				.row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
				.grand-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 24px 0; display: flex; justify-content: space-between; align-items: center; }
			</style>
		</head>
		<body>
			<div class=\"box\">
				<div class=\"header\">
					<div>
						<img src=\"https://exacoat.com/wp-content/uploads/exacoat-logo.png\" alt=\"Exacoat\" style=\"height:22px;display:block;margin-bottom:6px;\" />
						<div style=\"font-size:11px;color:#4b5563;font-weight:500;\">Exacoat Operations &bull; Settlement Statement</div>
						<div style=\"font-size:11px;color:#4b5563;\">support@exacoat.com &bull; https://exacoat.com</div>
					</div>
					<div style=\"text-align:right;\">
						<div style=\"font-size:18px;font-weight:900;text-transform:uppercase;\">PAYOUT STATEMENT</div>
						<div style=\"font-size:11.5px;color:#4b5563;font-family:monospace;margin-top:2px;\">#{$payout_id}</div>
						<div style=\"margin-top:6px;\"><span class=\"badge\">&#10003; SETTLEMENT COMPLETED</span></div>
					</div>
				</div>
				<div style=\"margin-bottom:20px;\">
					<div class=\"row\"><span style=\"color:#6b7280;font-weight:600;\">Vendor / Beneficiary:</span><strong style=\"color:#111827;\">{$artist_name}</strong></div>
					<div class=\"row\"><span style=\"color:#6b7280;font-weight:600;\">Settlement Date:</span><strong style=\"color:#111827;\">{$date}</strong></div>
					<div class=\"row\"><span style=\"color:#6b7280;font-weight:600;\">Payment Channel:</span><strong style=\"color:#111827;\">{$method}</strong></div>
					<div class=\"row\"><span style=\"color:#6b7280;font-weight:600;\">Account Destination:</span><strong style=\"font-family:monospace;color:#111827;\">{$destination}</strong></div>
				</div>
				<div class=\"grand-box\">
					<span style=\"font-weight:800;font-size:14px;color:#111827;\">Total Net Commission Transferred:</span>
					<span style=\"font-size:22px;font-weight:900;color:#059669;font-family:monospace;\">{$amount}</span>
				</div>
				<div style=\"font-size:11px;color:#6b7280;text-align:center;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:14px;\">
					Exacoat Core Platform &bull; Certified Operations Engine &bull; support@exacoat.com
				</div>
			</div>
		</body>
		</html>";
	}

	/**
	 * Render Professional Light-Mode Customer Order Transactional Email
	 */
	public static function render_customer_order_html( string $event, array $data, array $tmpl ): array {
		$replacements = [];
		foreach ( $data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		$order_num = esc_html( $data['order_number'] ?? '14589' );
		$cust_name = esc_html( $data['customer_first_name'] ?? ( $data['artist_name'] ?? 'Customer' ) );
		$badge_text = esc_html( $data['badge_text'] ?? $tmpl['badge'] ?? "Order #{$order_num}" );
		$title      = esc_html( $data['title'] ?? $tmpl['title'] ?? 'Order Update' );

		$subject         = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );
		$title           = str_replace( array_keys( $replacements ), array_values( $replacements ), $title );
		$body_primary    = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_primary'] ?? '' );
		$body_secondary  = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_secondary'] ?? '' );

		// Clean up orphan tags
		$tag_pattern = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject     = preg_replace( $tag_pattern, '', $subject );
		$subject     = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );
		$title       = preg_replace( $tag_pattern, '', $title );
		$body_primary= preg_replace( $tag_pattern, '', $body_primary );
		$body_secondary = preg_replace( $tag_pattern, '', $body_secondary );

		$preheader = $tmpl['preheader'] ?? $data['preheader'] ?? '';
		if ( ! empty( $preheader ) ) {
			$preheader = str_replace( array_keys( $replacements ), array_values( $replacements ), $preheader );
			$preheader = preg_replace( $tag_pattern, '', $preheader );
		}

		$is_store_pickup = ! empty( $tmpl['is_store_pickup'] ) || ! empty( $data['is_store_pickup'] );

		$pickup_action_html = '';
		if ( ! empty( $tmpl['pickup_ready'] ) || ! empty( $data['pickup_ready'] ) ) {
			$pickup_action_html = '
			<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;margin:24px 0;">
				<tr>
					<td style="padding:22px 24px;">
						<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827;letter-spacing:-0.2px;">Exacoat Store Bekasi</p>
						<p style="margin:0 0 16px;font-size:13.5px;color:#4b5563;line-height:1.5;">Ruby Commercial TB-12, Summarecon Bekasi, Bekasi Utara</p>
						<a href="https://maps.app.goo.gl/B9Z2n98o5kM33k4q9" target="_blank" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;font-size:13px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;">Open in Google Maps &rarr;</a>
					</td>
				</tr>
			</table>
			<p style="margin:16px 0 0;font-size:13px;color:#71717a;">Need help? <a href="https://exacoat.com/cs" style="color:#f3aa18;text-decoration:underline;font-weight:600;">Contact admin</a></p>';
		} elseif ( ! empty( $tmpl['pickup_review'] ) || ! empty( $data['pickup_review'] ) ) {
			$pickup_action_html = '
			<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;margin:24px 0;">
				<tr>
					<td style="padding:24px;text-align:center;">
						<p style="margin:0 0 16px;font-size:14.5px;color:#374151;font-weight:500;">Leave a review and tell us about your experience!</p>
						<a href="https://g.page/r/CZZ440l0WvPWEBM/review" target="_blank" style="display:inline-block;padding:12px 28px;background:#111111;color:#ffffff;font-size:13.5px;font-weight:700;border-radius:100px;text-decoration:none;letter-spacing:0.2px;">Write a review &rarr;</a>
					</td>
				</tr>
			</table>
			<p style="margin:16px 0 0;font-size:13px;color:#71717a;text-align:center;">Need help? <a href="https://exacoat.com/cs" style="color:#f3aa18;text-decoration:underline;font-weight:600;">Contact admin</a></p>';
		}

		if ( ! empty( $data['customer_note'] ) ) {
			$note_content = esc_html( (string) $data['customer_note'] );
			$body_secondary .= "
			<div style=\"background:#fafafa;border:1px solid #e5e7eb;border-left:3px solid #111111;padding:14px 18px;border-radius:0 12px 12px 0;margin:16px 0;font-size:14px;color:#18181b;line-height:1.6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
				{$note_content}
			</div>";
		}

		$courier         = esc_html( $data['courier'] ?? '' );
		$tracking_number = esc_html( $data['tracking_number'] ?? '' );
		$tracking_url    = esc_url( $data['tracking_url'] ?? ( $tracking_number ? "https://parcelsapp.com/en/tracking/{$tracking_number}" : '' ) );

		// Shipment Block (if tracking exists)
		$shipment_html = '';
		if ( ! empty( $tracking_number ) ) {
			$track_btn = $tracking_url 
				? "<a href=\"{$tracking_url}\" target=\"_blank\" style=\"display:inline-block;padding:11px 22px;background:#111111;color:#ffffff;font-size:13px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 6px rgba(0,0,0,0.08);white-space:nowrap;\">Track Package &rarr;</a>"
				: "";

			$shipment_html = "
			<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;margin:28px 0;\">
				<tr>
					<td style=\"padding:22px 24px;\">
						<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
							<tr>
								<td valign=\"middle\">
									<span style=\"display:inline-block;padding:3px 9px;background:#e5e7eb;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;border-radius:6px;margin-bottom:8px;\">Courier Dispatch</span>
									" . ( $courier ? "<p style=\"margin:0 0 5px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.2px;\">{$courier}</p>" : "" ) . "
									<p style=\"margin:0;font-size:12.5px;color:#6b7280;\">Tracking: <span style=\"font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700;color:#111827;background:#ffffff;padding:2px 8px;border-radius:6px;border:1px solid #e5e7eb;display:inline-block;font-size:13px;margin-left:4px;\">{$tracking_number}</span></p>
								</td>
								<td align=\"right\" valign=\"middle\" style=\"padding-left:16px;\">
									{$track_btn}
								</td>
							</tr>
						</table>
					</td>
				</tr>
			</table>";
		}

		// Items Table
		$items = $data['items'] ?? [];
		if ( empty( $items ) || ! is_array( $items ) ) {
			$items = [
				[
					'name'          => 'iPhone 16 Pro Skins',
					'image_url'     => 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
					'quantity'      => 1,
					'total'         => $data['total'] ?? 'Rp 149.000',
					'meta'          => "Variant: Full Body\nTexture: Matrix Black",
				]
			];
		}

		$items_rows = '';
		foreach ( $items as $item ) {
			$raw_name = $item['name'] ?? 'Device Skin';
			$clean_name = trim( preg_replace( '/\s*\(\s*feelform.*?\s*\)/i', '', (string) $raw_name ) );
			$i_name = esc_html( $clean_name );
			$i_img  = esc_url( $item['image_url'] ?? ( $item['image'] ?? 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg' ) );
			$i_qty  = intval( $item['quantity'] ?? ( $item['qty'] ?? 1 ) );
			$i_tot  = esc_html( $item['total'] ?? ( $item['price'] ?? ( $item['subtotal'] ?? 'Rp 149.000' ) ) );
			
			$specs = [];
			if ( ! empty( $item['parsed_configurator'] ) && is_array( $item['parsed_configurator'] ) ) {
				foreach ( $item['parsed_configurator'] as $c ) {
					$layer  = trim( (string) ( $c['layer_name'] ?? ( $c['name'] ?? '' ) ) );
					$choice = trim( (string) ( $c['choice_name'] ?? ( $c['choice_title'] ?? ( $c['name'] ?? '' ) ) ) );
					if ( '' !== $layer && '' !== $choice && strtolower( $layer ) !== strtolower( $choice ) ) {
						$specs[] = esc_html( $layer ) . ': ' . esc_html( $choice );
					} elseif ( '' !== $choice ) {
						$specs[] = esc_html( $choice );
					}
				}
			} elseif ( ! empty( $item['meta'] ) ) {
				$raw_meta = (string) $item['meta'];
				$parts    = preg_split( '/\s*(?:&bull;|•|<br\s*\/?>|\r?\n|\|)\s*/i', $raw_meta );
				if ( is_array( $parts ) ) {
					foreach ( $parts as $p ) {
						$clean = trim( str_replace( [ '&bull;', '•' ], '', $p ) );
						if ( '' !== $clean ) {
							$specs[] = esc_html( $clean );
						}
					}
				}
			} elseif ( ! empty( $item['device_model'] ) ) {
				$specs[] = esc_html( trim( (string) $item['device_model'] ) );
			}
			$specs_str = ! empty( $specs ) ? implode( '<br>', $specs ) : '';

			$items_rows .= "
			<tr>
				<td style=\"padding:18px 0;border-bottom:1px solid #f4f4f5;\">
					<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
						<tr>
							<td width=\"80\" valign=\"top\" style=\"padding-right:18px;\">
								<img src=\"{$i_img}\" width=\"80\" height=\"80\" alt=\"{$i_name}\" style=\"width:80px;height:80px;object-fit:cover;border-radius:12px;border:1px solid #e4e4e7;display:block;\">
							</td>
							<td valign=\"top\">
								<p style=\"margin:0 0 5px;font-size:15px;font-weight:600;color:#111111;line-height:1.4;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$i_name}</p>
								" . ( $specs_str ? "<p style=\"margin:0 0 6px;font-size:12px;color:#71717a;line-height:1.5;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$specs_str}</p>" : "" ) . "
								<p style=\"margin:0;font-size:12.5px;color:#52525b;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">Qty: <strong style=\"color:#111111;\">{$i_qty}</strong></p>
							</td>
							<td align=\"right\" valign=\"top\" style=\"white-space:nowrap;padding-left:14px;\">
								<span style=\"font-size:15px;font-weight:700;color:#111111;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$i_tot}</span>
							</td>
						</tr>
					</table>
				</td>
			</tr>";
		}

		$subtotal       = esc_html( $data['subtotal'] ?? 'Rp 149.000' );
		$discount_total = esc_html( $data['discount_total'] ?? '' );
		$coupons        = $data['coupon_codes'] ?? [];
		$shipping_total = esc_html( $data['shipping_total'] ?? 'Rp 15.000' );
		$shipping_name  = esc_html( $data['shipping_method_name'] ?? 'JNE Reguler' );
		$total_tax      = esc_html( $data['total_tax'] ?? '' );
		$total          = esc_html( $data['total'] ?? 'Rp 164.000' );
		$total_refunded = esc_html( $data['total_refunded'] ?? '' );
		$payment_meth   = esc_html( $data['payment_method_title'] ?? 'Midtrans / QRIS' );
		$shipping_addr  = nl2br( esc_html( $data['shipping_address'] ?? "William Vance\nJl. Sudirman No. 42\nJakarta Selatan 12190\nIndonesia" ) );

		$coupons_row = '';
		if ( ! empty( $discount_total ) && '$0.00' !== $discount_total && '0' !== $discount_total && 'Rp 0' !== $discount_total ) {
			$c_code = ! empty( $coupons ) ? '(' . implode( ', ', array_map( 'esc_html', (array) $coupons ) ) . ')' : '';
			$coupons_row = "
			<tr>
				<td style=\"padding:8px 0;font-size:13.5px;color:#52525b;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">Discount {$c_code}</td>
				<td align=\"right\" style=\"padding:8px 0;font-size:13.5px;color:#059669;font-weight:600;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">-{$discount_total}</td>
			</tr>";
		}

		$tax_row = '';
		if ( ! empty( $total_tax ) && '$0.00' !== $total_tax && '0' !== $total_tax && 'Rp 0' !== $total_tax ) {
			$tax_row = "
			<tr>
				<td style=\"padding:8px 0;font-size:13.5px;color:#52525b;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">Taxes / DDP</td>
				<td align=\"right\" style=\"padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$total_tax}</td>
			</tr>";
		}

		$refund_row = '';
		if ( ! empty( $total_refunded ) && '$0.00' !== $total_refunded && '0' !== $total_refunded && 'Rp 0' !== $total_refunded ) {
			$refund_row = "
			<tr>
				<td style=\"padding:8px 0;font-size:13.5px;color:#dc2626;font-weight:600;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">Refunded Amount</td>
				<td align=\"right\" style=\"padding:8px 0;font-size:13.5px;color:#dc2626;font-weight:700;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">-{$total_refunded}</td>
			</tr>";
		}

		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .address-col { display: block !important; width: 100% !important; border-right: none !important; border-bottom: 1px solid #eeeeee !important; padding-bottom: 20px !important; margin-bottom: 20px !important; }
    }
  </style>
</head>
<body bgcolor=\"#f7f7f7\" style=\"margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">
  " . ( ! empty( $preheader ) ? "<div style=\"display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;\">" . esc_html( $preheader ) . "</div>" : "" ) . "
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#f7f7f7\" style=\"background-color:#f7f7f7;padding:44px 16px;\">
    <tr>
      <td align=\"center\">
        <!-- Main Card -->
        <table class=\"container-table\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);\">
          <tbody>
            <!-- Top Header (Logo + Badge) -->
            <tr>
              <td style=\"padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;\" class=\"mobile-padding\">
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td valign=\"middle\">
                      " . self::get_brand_logo_html() . "
                    </td>
                    <td align=\"right\" valign=\"middle\">
                      <span style=\"display:inline-block;padding:5px 13px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #e4e4e7;letter-spacing:0.3px;\">{$badge_text}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Message Headline & Body -->
            <tr>
              <td style=\"padding:36px 40px 32px;\" class=\"mobile-padding\">
                <h1 style=\"margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;\">{$title}</h1>
                <p style=\"margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;\">Hi {$cust_name},</p>
                <p style=\"margin:0 0 16px;font-size:14.5px;line-height:1.7;color:#3f3f46;\">{$body_primary}</p>
                " . ( $body_secondary ? "<p style=\"margin:0 0 24px;font-size:14.5px;line-height:1.7;color:#52525b;\">{$body_secondary}</p>" : "" ) . "
                
                {$shipment_html}
                {$pickup_action_html}

                <!-- Dedicated Spacer above Order Summary -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td height=\"36\" style=\"height:36px;font-size:0;line-height:0;\">&nbsp;</td>
                  </tr>
                </table>

                <!-- Order Items Table -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-top:1px solid #f0f0f0;\">
                  <tr>
                    <td style=\"padding-top:24px;padding-bottom:12px;\">
                      <p style=\"margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;\">Order Summary</p>
                    </td>
                  </tr>
                  {$items_rows}
                </table>

                <!-- Financial Breakdown -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:20px;margin-bottom:32px;\">
                  <tr>
                    <td style=\"padding:8px 0;font-size:13.5px;color:#52525b;\">Subtotal</td>
                    <td align=\"right\" style=\"padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;\">{$subtotal}</td>
                  </tr>
                  {$coupons_row}
                  <tr>
                    <td style=\"padding:8px 0;font-size:13.5px;color:#52525b;\">Shipping ({$shipping_name})</td>
                    <td align=\"right\" style=\"padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;\">{$shipping_total}</td>
                  </tr>
                  {$tax_row}
                  {$refund_row}
                  <tr>
                    <td style=\"padding:16px 0 0;border-top:1px solid #e4e4e7;font-size:15px;font-weight:700;color:#111111;\">Total</td>
                    <td align=\"right\" style=\"padding:16px 0 0;border-top:1px solid #e4e4e7;font-size:17px;font-weight:800;color:#111111;\">{$total}</td>
                  </tr>
                </table>

                <!-- Delivery & Payment Information Card (Shipping address & Payment method only) -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fafafa;border:1px solid #eaeaea;border-radius:16px;margin-bottom:32px;\">
                  <tr>
                    <td class=\"address-col\" width=\"58%\" valign=\"top\" style=\"padding:22px 24px;border-right:1px solid #eaeaea;\">
                      " . ( $is_store_pickup
                        ? "<p style=\"margin:0 0 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;\">Store Pickup Location</p>
                           <p style=\"margin:0;font-size:13px;line-height:1.65;color:#3f3f46;\">Exacoat Store Bekasi<br>Ruby Commercial TB-12, Summarecon Bekasi, Bekasi Utara</p>"
                        : "<p style=\"margin:0 0 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;\">Shipping Address</p>
                           <p style=\"margin:0;font-size:13px;line-height:1.65;color:#3f3f46;\">{$shipping_addr}</p>"
                      ) . "
                    </td>
                    <td class=\"address-col\" width=\"42%\" valign=\"top\" style=\"padding:22px 24px;\">
                      <p style=\"margin:0 0 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;\">Payment Method</p>
                      <p style=\"margin:0;font-size:14px;color:#111111;font-weight:600;line-height:1.4;\">{$payment_meth}</p>
                    </td>
                  </tr>
                </table>

                <!-- Dedicated Spacer above Concierge Support -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td height=\"36\" style=\"height:36px;font-size:0;line-height:0;\">&nbsp;</td>
                  </tr>
                </table>

                <!-- Help & Assistance Section -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-top:1px solid #f0f0f0;text-align:center;\">
                  <tr>
                    <td align=\"center\" style=\"padding-top:28px;\">
                      <p style=\"margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;\">
                        Have questions about your order? Reach our team at <a href=\"mailto:support@exacoat.com\" style=\"color:#111111;text-decoration:underline;font-weight:500;\">support@exacoat.com</a>
                      </p>
                      <p style=\"margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;\">
                        &copy; Exacoat
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

		// Clean up any remaining tags
		$html    = preg_replace( $tag_pattern, '', $html );
		$subject = preg_replace( $tag_pattern, '', $subject );
		$subject = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );

		return [
			'subject'   => $subject,
			'html'      => $html,
			'tmpl_info' => $tmpl,
		];
	}

	/**
	 * Render Quiet-Luxury Product Review Invitation Email
	 */
	public static function render_review_invitation_html( string $event, array $data, array $tmpl ): array {
		$replacements = [];
		foreach ( $data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		$order_num     = esc_html( $data['order_number'] ?? '14589' );
		$cust_name     = esc_html( $data['customer_first_name'] ?? 'Customer' );
		$badge_text    = esc_html( $data['badge_text'] ?? $tmpl['badge'] ?? 'Product Review' );
		$title         = esc_html( $data['title'] ?? $tmpl['title'] ?? 'How does your new skin look on your device?' );
		$art_title     = esc_html( $data['product_title'] ?? ( $data['artwork_title'] ?? 'Precision Device Skin' ) );
		$art_img       = esc_url( $data['artwork_image'] ?? 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg' );
		$artist_name   = esc_html( $data['artist_name'] ?? 'Exacoat' );
		$review_url    = esc_url( $data['review_url'] ?? ( function_exists( 'exacoat_storefront_url' ) ? exacoat_storefront_url( 'review?order_id=' . $order_num ) : home_url( '/review?order_id=' . $order_num ) ) );

		$has_reward   = ! empty( $data['has_reward'] ) || ! empty( $data['discount_percent'] );
		$discount_pct = max( 0, (int) ( $data['discount_percent'] ?? 0 ) );

		$subject        = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );
		$title          = str_replace( array_keys( $replacements ), array_values( $replacements ), $title );
		$body_primary   = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_primary'] ?? '' );
		$body_secondary = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_secondary'] ?? '' );

		if ( $has_reward && $discount_pct > 0 ) {
			$badge_text     = "Special Offer";
			$subject        = "Review {$art_title} and get special offer on your next piece";
			$body_secondary .= " Submit your review with a photo or video to receive an exclusive {$discount_pct}% promo code on your next purchase.";
			$cta_text       = "Submit Review & Claim Special Offer";
		} else {
			$subject        = "Review {$art_title} and get special offer on your next piece";
			$cta_text       = "Share your thoughts";
		}

		// Clean up orphan tags & double spaces
		$tag_pattern = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject     = preg_replace( $tag_pattern, '', $subject );
		$subject     = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );
		$title       = preg_replace( $tag_pattern, '', $title );
		$body_primary   = preg_replace( $tag_pattern, '', $body_primary );
		$body_secondary = preg_replace( $tag_pattern, '', $body_secondary );

		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    body { margin:0; padding:0; width:100% !important; background-color:#f8f8fa; font-family:'Neue Haas Display','Neue Haas Grotesk Text Pro',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; display:block; }
    @media only screen and (max-width:620px) {
      .container-table { width:100% !important; border-radius:0 !important; border-left:none !important; border-right:none !important; }
      .mobile-padding { padding:24px 20px !important; }
    }
  </style>
</head>
<body style=\"margin:0;padding:40px 10px;background-color:#f8f8fa;\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">
    <tr>
      <td align=\"center\">
        <table class=\"container-table\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:580px;background:#ffffff;border:1px solid #eaeaea;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.03);\">
          <tbody>
            <!-- Header -->
            <tr>
              <td style=\"padding:28px 36px 20px;border-bottom:1px solid #f0f0f2;\" class=\"mobile-padding\">
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td valign=\"middle\">
                      " . self::get_brand_logo_html() . "
                    </td>
                    <td align=\"right\" valign=\"middle\">
                      <span style=\"display:inline-block;padding:4px 10px;background:#f4f4f5;color:#52525b;font-size:11px;font-weight:500;border-radius:9999px;\">{$badge_text}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style=\"padding:36px 36px 28px;\" class=\"mobile-padding\">
                <h1 style=\"margin:0 0 16px;font-size:24px;font-weight:600;color:#111111;letter-spacing:-0.4px;line-height:1.3;\">{$title}</h1>
                <p style=\"margin:0 0 12px;font-size:15px;font-weight:500;color:#18181b;\">Hi {$cust_name},</p>
                <p style=\"margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;\">{$body_primary}</p>
                <p style=\"margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;\">{$body_secondary}</p>

                <!-- Product Card -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fafafa;border:1px solid #ebebeb;border-radius:14px;overflow:hidden;margin-bottom:28px;\">
                  <tr>
                    <td width=\"100\" valign=\"middle\" style=\"padding:12px;width:100px;\">
                      <img src=\"{$art_img}\" alt=\"{$art_title}\" width=\"80\" height=\"100\" style=\"width:80px;height:100px;object-fit:cover;border-radius:8px;display:block;\" />
                    </td>
                    <td valign=\"middle\" style=\"padding:12px 16px;\">
                      <p style=\"margin:0 0 4px;font-size:15px;font-weight:600;color:#111111;\">{$art_title}</p>
                      <p style=\"margin:0;font-size:13px;color:#71717a;\">Exacoat Skin</p>
                      <p style=\"margin:6px 0 0;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;\">Order #{$order_num}</p>
                    </td>
                  </tr>
                </table>

                <!-- Action Button -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td align=\"center\" style=\"padding:6px 0 12px;\">
                      <a href=\"{$review_url}\" target=\"_blank\" style=\"display:inline-block;padding:15px 36px;font-size:14px;font-weight:600;color:#ffffff;background:#111111;border-radius:12px;text-decoration:none;letter-spacing:0.2px;\">
                        {$cta_text} &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align=\"center\" style=\"padding-top:8px;\">
                      <span style=\"font-size:12px;color:#71717a;\">Takes less than a minute. You can also share an optional photo of your device.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style=\"padding:24px 36px 28px;background:#fcfcfd;border-top:1px solid #f0f0f2;text-align:center;\" class=\"mobile-padding\">
                <p style=\"margin:0 0 8px;font-size:12px;line-height:1.65;color:#71717a;\">
                  Have questions about your order? Reach our team at <a href=\"mailto:support@exacoat.com\" style=\"color:#111111;text-decoration:underline;font-weight:500;\">support@exacoat.com</a>
                </p>
                <p style=\"margin:0 0 8px;font-size:11px;color:#a1a1aa;\">
                  Direct review link: <a href=\"{$review_url}\" style=\"color:#71717a;text-decoration:underline;\">{$review_url}</a>
                </p>
                <p style=\"margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;\">
                  &copy; Exacoat
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

		return [
			'subject'   => $subject,
			'html'      => $html,
			'tmpl_info' => $tmpl,
		];
	}

	/**
	 * Render Professional Light-Mode Exacoat Perks Promo Code Reward Email
	 */
	public static function render_review_reward_html( string $event, array $data, array $tmpl ): array {
		$replacements = [];
		foreach ( $data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		$cust_name    = esc_html( $data['customer_first_name'] ?? ( $data['artist_name'] ?? 'Collector' ) );
		$coupon_code  = esc_html( $data['coupon_code'] ?? 'EXACOAT20-X8K9P' );
		$discount_pct = esc_html( $data['discount_percent'] ?? '20' );
		$expiry_date  = esc_html( $data['expiry_date'] ?? date( 'F j, Y', strtotime( '+30 days' ) ) );
		$shop_url     = esc_url( $data['shop_url'] ?? home_url( '/shop/' ) );
		$badge_text   = esc_html( $tmpl['badge'] ?? 'Exacoat Perks' );
		$title        = esc_html( $tmpl['title'] ?? 'Your Exacoat Perks' );
		$cta_text     = esc_html( $tmpl['cta_text'] ?? 'Explore The Collection' );

		$subject        = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );
		$title          = str_replace( array_keys( $replacements ), array_values( $replacements ), $title );
		$body_primary   = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_primary'] ?? '' );
		$body_secondary = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_secondary'] ?? '' );

		// Clean up tags
		$tag_pattern    = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject        = preg_replace( $tag_pattern, '', $subject );
		$subject        = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );
		$title          = preg_replace( $tag_pattern, '', $title );
		$body_primary   = preg_replace( $tag_pattern, '', $body_primary );
		$body_secondary = preg_replace( $tag_pattern, '', $body_secondary );

		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    body { margin:0; padding:0; width:100% !important; background-color:#f8f8fa; font-family:'Neue Haas Display','Neue Haas Grotesk Text Pro',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; display:block; }
    @media only screen and (max-width:620px) {
      .container-table { width:100% !important; border-radius:0 !important; border-left:none !important; border-right:none !important; }
      .mobile-padding { padding:24px 20px !important; }
      .promo-code-text { font-size:24px !important; letter-spacing:4px !important; }
    }
  </style>
</head>
<body style=\"margin:0;padding:40px 10px;background-color:#f8f8fa;\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">
    <tr>
      <td align=\"center\">
        <table class=\"container-table\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:580px;background:#ffffff;border:1px solid #eaeaea;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.03);\">
          <tbody>
            <!-- Header -->
            <tr>
              <td style=\"padding:28px 36px 20px;border-bottom:1px solid #f0f0f2;\" class=\"mobile-padding\">
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td valign=\"middle\">
                      " . self::get_brand_logo_html() . "
                    </td>
                    <td align=\"right\" valign=\"middle\">
                      <span style=\"display:inline-block;padding:5px 12px;background:#f4f4f5;color:#18181b;font-size:11px;font-weight:600;border-radius:9999px;border:1px solid #e4e4e7;\">{$badge_text}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style=\"padding:36px 36px 28px;\" class=\"mobile-padding\">
                <h1 style=\"margin:0 0 16px;font-size:24px;font-weight:600;color:#111111;letter-spacing:-0.4px;line-height:1.3;\">{$title}</h1>
                <p style=\"margin:0 0 12px;font-size:15px;font-weight:500;color:#18181b;\">Hi {$cust_name},</p>
                <p style=\"margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;\">{$body_primary}</p>
                <p style=\"margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;\">{$body_secondary}</p>

                <!-- Luxury Promo Code Card -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fafafa;border:1.5px dashed #22c55e;border-radius:14px;overflow:hidden;margin-bottom:28px;\">
                  <tr>
                    <td align=\"center\" style=\"padding:24px 20px;\">
                      <p style=\"margin:0 0 8px;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;\">Exclusive Exacoat Promo Code ({$discount_pct}% Off)</p>
                      <div style=\"display:inline-block;padding:12px 24px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:8px 0 12px;\">
                        <span class=\"promo-code-text\" style=\"font-size:28px;font-weight:800;letter-spacing:6px;color:#111111;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;\">{$coupon_code}</span>
                      </div>
                      <p style=\"margin:4px 0 0;font-size:12px;color:#71717a;\">
                        Single-use promo code &bull; Valid through <strong>{$expiry_date}</strong>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Action Button -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td align=\"center\" style=\"padding:6px 0 12px;\">
                      <a href=\"{$shop_url}\" target=\"_blank\" style=\"display:inline-block;padding:15px 36px;font-size:14px;font-weight:600;color:#ffffff;background:#111111;border-radius:12px;text-decoration:none;letter-spacing:0.2px;\">
                        {$cta_text} &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align=\"center\" style=\"padding-top:8px;\">
                      <span style=\"font-size:12px;color:#71717a;\">Apply promo code at checkout on your next order.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style=\"padding:24px 36px 28px;background:#fcfcfd;border-top:1px solid #f0f0f2;text-align:center;\" class=\"mobile-padding\">
                <p style=\"margin:0 0 8px;font-size:12px;line-height:1.65;color:#71717a;\">
                  Have questions about your order? Reach our team at <a href=\"mailto:support@exacoat.com\" style=\"color:#111111;text-decoration:underline;font-weight:500;\">support@exacoat.com</a>
                </p>
                <p style=\"margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;\">
                  &copy; Exacoat
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

		return [
			'subject'   => $subject,
			'html'      => $html,
			'tmpl_info' => $tmpl,
		];
	}

	/**
	 * Render Professional Light-Mode Store Credit & Cashback Notification Email
	 */
	public static function render_store_credit_html( string $event, array $data, array $tmpl ): array {
		$replacements = [];
		foreach ( $data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		$cust_name       = esc_html( $data['customer_first_name'] ?? ( $data['customer_name'] ?? 'Customer' ) );
		$balance         = esc_html( $data['store_credit_balance'] ?? 'Rp 25.000' );
		$cashback_amount = esc_html( $data['cashback_amount'] ?? '' );
		$order_num       = esc_html( $data['order_number'] ?? '' );
		$shop_url        = esc_url( $data['shop_url'] ?? ( function_exists( 'exacoat_storefront_url' ) ? exacoat_storefront_url( 'shop' ) : home_url( '/shop/' ) ) );
		$badge_text      = esc_html( $data['badge_text'] ?? ( $tmpl['badge'] ?? 'Store Credit' ) );
		$title           = esc_html( $data['title'] ?? ( $tmpl['title'] ?? 'Your store credit is ready' ) );
		$cta_text        = esc_html( $data['cta_text'] ?? ( $tmpl['cta_text'] ?? 'Shop Device Skins' ) );

		$subject        = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );
		$title          = str_replace( array_keys( $replacements ), array_values( $replacements ), $title );
		$body_primary   = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_primary'] ?? '' );
		$body_secondary = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['body_secondary'] ?? '' );

		// Clean up tags
		$tag_pattern    = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject        = preg_replace( $tag_pattern, '', $subject );
		$subject        = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );
		$title          = preg_replace( $tag_pattern, '', $title );
		$body_primary   = preg_replace( $tag_pattern, '', $body_primary );
		$body_secondary = preg_replace( $tag_pattern, '', $body_secondary );

		$cashback_pill = '';
		if ( ! empty( $cashback_amount ) ) {
			$order_label = ! empty( $order_num ) ? " from Order #{$order_num}" : '';
			$cashback_pill = "<div style=\"display:inline-block;padding:4px 12px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #a7f3d0;margin-top:10px;\">
				+{$cashback_amount} Cashback{$order_label}
			</div>";
		}

		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    body { margin:0; padding:0; width:100% !important; background-color:#f8f8fa; font-family:'Neue Haas Display','Neue Haas Grotesk Text Pro',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; display:block; }
    @media only screen and (max-width:620px) {
      .container-table { width:100% !important; border-radius:0 !important; border-left:none !important; border-right:none !important; }
      .mobile-padding { padding:24px 20px !important; }
      .balance-text { font-size:28px !important; }
    }
  </style>
</head>
<body style=\"margin:0;padding:40px 10px;background-color:#f8f8fa;\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">
    <tr>
      <td align=\"center\">
        <table class=\"container-table\" width=\"580\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:580px;background:#ffffff;border:1px solid #eaeaea;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.03);\">
          <tbody>
            <!-- Header -->
            <tr>
              <td style=\"padding:28px 36px 20px;border-bottom:1px solid #f0f0f2;\" class=\"mobile-padding\">
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td valign=\"middle\">
                      " . self::get_brand_logo_html() . "
                    </td>
                    <td align=\"right\" valign=\"middle\">
                      <span style=\"display:inline-block;padding:5px 12px;background:#f4f4f5;color:#18181b;font-size:11px;font-weight:600;border-radius:9999px;border:1px solid #e4e4e7;\">{$badge_text}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style=\"padding:36px 36px 28px;\" class=\"mobile-padding\">
                <h1 style=\"margin:0 0 16px;font-size:24px;font-weight:600;color:#111111;letter-spacing:-0.4px;line-height:1.3;\">{$title}</h1>
                <p style=\"margin:0 0 12px;font-size:15px;font-weight:500;color:#18181b;\">Hi {$cust_name},</p>
                <p style=\"margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;\">{$body_primary}</p>
                <p style=\"margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;\">{$body_secondary}</p>

                <!-- Store Credit Card -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fafafa;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;margin-bottom:28px;\">
                  <tr>
                    <td align=\"center\" style=\"padding:26px 20px;\">
                      <p style=\"margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;\">Available Store Credit</p>
                      <div style=\"margin:6px 0;\">
                        <span class=\"balance-text\" style=\"font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#111111;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;\">{$balance}</span>
                      </div>
                      {$cashback_pill}
                      <p style=\"margin:12px 0 0;font-size:12px;color:#71717a;\">
                        Applied automatically at checkout when signed in
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Action Button -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td align=\"center\" style=\"padding:6px 0 12px;\">
                      <a href=\"{$shop_url}\" target=\"_blank\" style=\"display:inline-block;padding:15px 36px;font-size:14px;font-weight:600;color:#ffffff;background:#111111;border-radius:12px;text-decoration:none;letter-spacing:0.2px;\">
                        {$cta_text} &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align=\"center\" style=\"padding-top:8px;\">
                      <span style=\"font-size:12px;color:#71717a;\">Your store credit balance is saved in your account with no immediate expiry.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style=\"padding:24px 36px 28px;background:#fcfcfd;border-top:1px solid #f0f0f2;text-align:center;\" class=\"mobile-padding\">
                <p style=\"margin:0 0 8px;font-size:12px;line-height:1.65;color:#71717a;\">
                  Have questions about your order or store credit? Reach our team at <a href=\"mailto:support@exacoat.com\" style=\"color:#111111;text-decoration:underline;font-weight:500;\">support@exacoat.com</a>
                </p>
                <p style=\"margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;\">
                  &copy; Exacoat
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

		return [
			'subject'   => $subject,
			'html'      => $html,
			'tmpl_info' => $tmpl,
		];
	}

	/**
	 * Render Professional Light-Mode Customer Account Email (Password Reset & Welcome)
	 */
	public static function render_customer_account_html( string $event, array $data, array $tmpl ): array {
		$replacements = [];
		foreach ( $data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		$cust_name = esc_html( $data['customer_first_name'] ?? ( $data['display_name'] ?? 'Collector' ) );
		$subject   = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );

		// Clean up tags
		$tag_pattern = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject     = preg_replace( $tag_pattern, '', $subject );
		$subject     = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );

		if ( $event === 'customer_reset_password' ) {
			$reset_url  = esc_url( $data['reset_url'] ?? home_url( '/my-account/lost-password' ) );
			$badge_text = 'Account security';
			$title      = 'Reset your password';
			$content_html = "
			<p style=\"margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#3f3f46;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
				Someone has requested a password reset for your Exacoat account. If this was you, you can choose a new password using the link below.
			</p>
			<div style=\"margin:28px 0;\">
				<a href=\"{$reset_url}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:13px 26px;background:#111111;color:#ffffff;font-size:14px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,0.1);font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
					Reset Password &rarr;
				</a>
			</div>
			<p style=\"margin:0 0 20px;font-size:13.5px;line-height:1.65;color:#71717a;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
				If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
			</p>";
		} else {
			$account_url = esc_url( $data['account_url'] ?? ( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/my-account' ) ) );
			$badge_text  = 'Account created';
			$title       = 'Welcome to Exacoat';
			$content_html = "
			<p style=\"margin:0 0 16px;font-size:14.5px;line-height:1.7;color:#3f3f46;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
				Your Exacoat account has been created. You can use your account to review orders, save delivery details, and track shipments.
			</p>
			<div style=\"margin:28px 0;\">
				<a href=\"{$account_url}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:13px 26px;background:#111111;color:#ffffff;font-size:14px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,0.1);font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
					Visit Your Account &rarr;
				</a>
			</div>";
		}

		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body bgcolor=\"#f7f7f7\" style=\"margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#f7f7f7\" style=\"background-color:#f7f7f7;padding:44px 16px;\">
    <tr>
      <td align=\"center\">
        <!-- Main Card -->
        <table class=\"container-table\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);\">
          <tbody>
            <!-- Top Header (Logo + Badge) -->
            <tr>
              <td style=\"padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;\" class=\"mobile-padding\">
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td valign=\"middle\">
                      " . self::get_brand_logo_html() . "
                    </td>
                    <td align=\"right\" valign=\"middle\">
                      <span style=\"display:inline-block;padding:5px 13px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #e4e4e7;letter-spacing:0.3px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$badge_text}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Message Headline & Body -->
            <tr>
              <td style=\"padding:36px 40px 32px;\" class=\"mobile-padding\">
                <h1 style=\"margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$title}</h1>
                <p style=\"margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">Hi {$cust_name},</p>
                {$content_html}

                <!-- Dedicated Spacer above Concierge Support -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td height=\"36\" style=\"height:36px;font-size:0;line-height:0;\">&nbsp;</td>
                  </tr>
                </table>

                <!-- Help & Assistance Section -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-top:1px solid #f0f0f0;text-align:center;\">
                  <tr>
                    <td align=\"center\" style=\"padding-top:28px;\">
                      <p style=\"margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                        Have questions about your account? Reach our team at <a href=\"mailto:support@exacoat.com\" style=\"color:#111111;text-decoration:underline;font-weight:500;\">support@exacoat.com</a>
                      </p>
                      <p style=\"margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                        &copy; Exacoat
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

		return [
			'subject'   => $subject,
			'html'      => $html,
			'tmpl_info' => $tmpl,
		];
	}

	/**
	 * Render Luxury Light-Mode Custom Poster Private Order Link Email
	 */
	public static function render_custom_poster_order_html( string $event, array $data, array $tmpl ): array {
		$replacements = [];
		foreach ( $data as $k => $v ) {
			if ( is_scalar( $v ) ) {
				$val_str = (string) $v;
				$replacements[ '{{' . $k . '}}' ] = $val_str;
				$replacements[ '{' . $k . '}' ]   = $val_str;
			}
		}

		$order_code = esc_html( $data['order_code'] ?? 'CUSTOM' );
		$cust_name  = esc_html( $data['customer_name'] ?? $data['customer_first_name'] ?? ( $data['display_name'] ?? 'there' ) );
		if ( strtolower( $cust_name ) === 'customer'  ) {
			$cust_name = 'there';
		}
		$art_img    = esc_url( $data['artwork_image'] ?? '' );
		$order_url  = esc_url( $data['order_url'] ?? home_url( "/product/custom-order-" . strtolower( $order_code ) ) );
		$cta_text   = esc_html( $tmpl['cta_text'] ?? 'Complete Custom Order' );
		$badge_text = esc_html( $tmpl['badge'] ?? 'Custom Poster Order' );
		$title      = esc_html( $tmpl['title'] ?? 'Your custom poster is ready' );
		$subject    = str_replace( array_keys( $replacements ), array_values( $replacements ), $tmpl['subject'] );

		// Clean up tags
		$tag_pattern = '/\{\{[a-zA-Z0-9_-]+\}\}|\{[a-zA-Z0-9_-]+\}/';
		$subject     = preg_replace( $tag_pattern, '', $subject );
		$subject     = preg_replace( '/\s{2,}/', ' ', trim( $subject ) );

		$img_preview_html = '';
		if ( ! empty( $art_img ) ) {
			$img_preview_html = "
			<div style=\"margin:24px 0;background:#fafafa;border:1px solid #eaeaea;border-radius:16px;padding:24px;text-align:center;\">
				<img src=\"{$art_img}\" alt=\"Custom Poster #{$order_code}\" style=\"width:100%;max-width:380px;height:auto;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.08);display:block;margin:0 auto;border:1px solid #e4e4e7;\">
				<div style=\"margin-top:18px;\">
					<span style=\"display:inline-block;padding:4px 12px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;font-size:11.5px;font-weight:700;color:#3f3f46;text-transform:uppercase;letter-spacing:0.8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;\">Order Code: #{$order_code}</span>
				</div>
			</div>";
		}

		$html = "<!doctype html>
<html lang=\"en\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">
  <title>" . esc_html( $subject ) . "</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body bgcolor=\"#f7f7f7\" style=\"margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">
  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#f7f7f7\" style=\"background-color:#f7f7f7;padding:44px 16px;\">
    <tr>
      <td align=\"center\">
        <!-- Main Card -->
        <table class=\"container-table\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);\">
          <tbody>
            <!-- Top Header (Logo + Badge) -->
            <tr>
              <td style=\"padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;\" class=\"mobile-padding\">
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td valign=\"middle\">
                      " . self::get_brand_logo_html() . "
                    </td>
                    <td align=\"right\" valign=\"middle\">
                      <span style=\"display:inline-block;padding:5px 13px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #e4e4e7;letter-spacing:0.3px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$badge_text}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Message Headline & Body -->
            <tr>
              <td style=\"padding:36px 40px 32px;\" class=\"mobile-padding\">
                <h1 style=\"margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">{$title}</h1>
                <p style=\"margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">Hi {$cust_name},</p>
                <p style=\"margin:0 0 16px;font-size:14.5px;line-height:1.7;color:#3f3f46;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                  We’ve prepared your custom device skin order.
                </p>
                <p style=\"margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#52525b;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                  This private order link is reserved for your email. Review your device skin options below and complete checkout.
                </p>

                {$img_preview_html}

                <!-- Primary CTA Button -->
                <div style=\"margin:32px 0 20px;text-align:center;\">
                  <a href=\"{$order_url}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:15px 36px;background:#111111;color:#ffffff;font-size:14px;font-weight:700;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 3px 10px rgba(0,0,0,0.12);font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                    {$cta_text} &rarr;
                  </a>
                </div>

                <p style=\"margin:0 0 24px;font-size:12px;color:#71717a;text-align:center;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                  Direct link: <a href=\"{$order_url}\" style=\"color:#111111;text-decoration:underline;\">{$order_url}</a>
                </p>

                <!-- Dedicated Spacer above Concierge Support -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                  <tr>
                    <td height=\"36\" style=\"height:36px;font-size:0;line-height:0;\">&nbsp;</td>
                  </tr>
                </table>

                <!-- Help & Assistance Section -->
                <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-top:1px solid #f0f0f0;text-align:center;\">
                  <tr>
                    <td align=\"center\" style=\"padding-top:28px;\">
                      <p style=\"margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                        Have questions about your custom order? Reach our team at <a href=\"mailto:support@exacoat.com\" style=\"color:#111111;text-decoration:underline;font-weight:500;\">support@exacoat.com</a>
                      </p>
                      <p style=\"margin:0 0 6px;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                        &copy; Exacoat. All rights reserved.
                      </p>
                      <p style=\"margin:0;font-size:11px;color:#a1a1aa;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">
                        You’re receiving this email regarding your custom order on exacoat.com.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

		return [
			'subject'   => $subject,
			'html'      => $html,
			'tmpl_info' => $tmpl,
		];
	}

	/**
	 * Handler: Customer Note Added
	 */
	public static function handle_woocommerce_new_customer_note( $args ) {
		$order_id      = is_array( $args ) ? ( $args['order_id'] ?? 0 ) : ( is_numeric( $args ) ? (int) $args : 0 );
		$customer_note = is_array( $args ) ? ( $args['customer_note'] ?? '' ) : '';
		
		if ( ! $order_id || ! function_exists( 'wc_get_order' ) ) return;
		$order = wc_get_order( $order_id );
		if ( ! $order ) return;

		$customer_email = $order->get_billing_email();
		$customer_name  = $order->get_formatted_billing_full_name() ?: 'Customer';
		if ( ! is_email( $customer_email ) ) return;

		$payload = class_exists( 'Artmatter_Order_Manager' ) 
			? Artmatter_Order_Manager::get_email_order_payload( $order, [ 'customer_note' => $customer_note ] )
			: [ 'customer_note' => $customer_note ];

		self::send_email( 'customer_order_note', $customer_email, $customer_name, $payload );
	}

	/**
	 * Handler: WooCommerce Customer Reset Password
	 */
	public static function handle_woocommerce_reset_password_notification( $user_login, $reset_key ) {
		$user = get_user_by( 'login', $user_login );
		if ( ! $user || ! is_email( $user->user_email ) ) return;

		$reset_url = add_query_arg( [
			'key'   => $reset_key,
			'id'    => $user->ID,
			'login' => rawurlencode( $user_login ),
		], function_exists( 'wc_get_endpoint_url' ) ? wc_get_endpoint_url( 'lost-password', '', wc_get_page_permalink( 'myaccount' ) ) : home_url( '/my-account/lost-password' ) );

		$first_name = get_user_meta( $user->ID, 'first_name', true ) ?: ( $user->display_name ?: 'Collector' );

		self::send_email( 'customer_reset_password', $user->user_email, $first_name, [
			'customer_first_name' => $first_name,
			'reset_url'           => $reset_url,
		] );
	}

	/**
	 * Handler: WooCommerce Customer Account Created
	 */
	public static function handle_woocommerce_created_customer( $customer_id, $new_customer_data, $password_generated ) {
		$user = get_userdata( $customer_id );
		if ( ! $user || ! is_email( $user->user_email ) ) return;

		$first_name = get_user_meta( $customer_id, 'first_name', true ) ?: ( $user->display_name ?: 'Collector' );
		$account_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/my-account' );

		self::send_email( 'customer_new_account', $user->user_email, $first_name, [
			'customer_first_name' => $first_name,
			'account_url'         => $account_url,
		] );
	}

	/**
	 * Handler: Manual Resend Order Details / Invoice
	 */
	public static function handle_woocommerce_resend_order_emails( $order, $email_type = '' ) {
		if ( ! $order || ! is_a( $order, 'WC_Order' ) ) return;
		$customer_email = $order->get_billing_email();
		$customer_name  = $order->get_formatted_billing_full_name() ?: 'Customer';
		if ( ! is_email( $customer_email ) ) return;

		$payload = class_exists( 'Artmatter_Order_Manager' )
			? Artmatter_Order_Manager::get_email_order_payload( $order )
			: [];

		self::send_email( 'customer_order_invoice', $customer_email, $customer_name, $payload );
	}

	/**
	 * Send Transactional Email via Zoho ZeptoMail API (or wp_mail fallback)
	 */
	public static function send_email( string $event, string $recipient_email, string $recipient_name = '', array $data = [] ): array {
		if ( ! is_email( $recipient_email ) ) {
			return [ 'success' => false, 'message' => 'Invalid recipient email address' ];
		}

		$config = self::get_config();
		if ( ! empty( $data['htmlbody'] ) || ! empty( $data['html'] ) ) {
			$html    = $data['htmlbody'] ?? $data['html'];
			$subject = $data['subject'] ?? 'Exacoat Update';
		} else {
			$rendered = self::render_html( $event, array_merge( [ 'customer_name' => $recipient_name ?: 'Customer' ], $data ) );
			$subject = $rendered['subject'];
			$html    = $rendered['html'];
		}

		// Direct ZeptoMail Send Mail API
		if ( ! empty( $config['zeptomail_token'] ) ) {
			$api_url = 'https://api.zeptomail.com/v1.1/email';
			$payload = [
				'from'     => [
					'address' => $config['from_email'],
					'name'    => $config['from_name'],
				],
				'to'       => [
					[
						'email_address' => [
							'address' => $recipient_email,
							'name'    => $recipient_name ?: 'Customer',
						],
					],
				],
				'subject'  => $subject,
				'htmlbody' => $html,
			];

			$reply_to = sanitize_email( $data['reply_to'] ?? '' );
			if ( is_email( $reply_to ) ) {
				$payload['reply_to'] = [
					[
						'address' => $reply_to,
						'name'    => sanitize_text_field( $data['reply_name'] ?? '' ),
					],
				];
			}

			// Process attachments (Custom Invoice, Payout Statement, etc.)
			$attachments = $data['attachments'] ?? [];
			if ( empty( $attachments ) ) {
				if ( 'payout_sent' === $event ) {
					$statement_html = self::generate_payout_statement_html( $data );
					$payout_id = $data['payout_id'] ?? 'Statement';
					$attachments[] = [
						'content'   => base64_encode( $statement_html ),
						'mime_type' => 'text/html',
						'name'      => "Payout-Statement-{$payout_id}.html",
					];
				}
			}

			if ( ! empty( $attachments ) ) {
				$payload['attachments'] = $attachments;
			}

			$auth_header = str_starts_with( $config['zeptomail_token'], 'Zoho-enczapikey ' )
				? $config['zeptomail_token']
				: 'Zoho-enczapikey ' . $config['zeptomail_token'];

			$start = microtime( true );
			$response = wp_remote_post( $api_url, [
				'headers' => [
					'Accept'        => 'application/json',
					'Content-Type'  => 'application/json',
					'Authorization' => $auth_header,
				],
				'body'    => wp_json_encode( $payload ),
				'timeout' => 15,
			] );
			$latency = round( ( microtime( true ) - $start ) * 1000 );

			if ( is_wp_error( $response ) ) {
				$err_msg = $response->get_error_message();
				Artmatter_Logger::log( 'error', 'email', "ZeptoMail Direct API Failed: {$err_msg}", [ 'event' => $event, 'recipient' => $recipient_email ] );
				return [ 'success' => false, 'message' => "ZeptoMail Error: {$err_msg}", 'latency_ms' => $latency ];
			}

			$status_code = wp_remote_retrieve_response_code( $response );
			$body        = json_decode( wp_remote_retrieve_body( $response ), true );
			$is_ok       = ( $status_code >= 200 && $status_code < 300 );

			Artmatter_Logger::log(
				$is_ok ? 'success' : 'error',
				'email',
				"Direct ZeptoMail Email Sent: '{$event}' to {$recipient_email} -> HTTP {$status_code} ({$latency}ms)",
				[
					'event'       => $event,
					'recipient'   => $recipient_email,
					'status_code' => $status_code,
					'latency_ms'  => $latency,
					'request_id'  => $body['data'][0]['request_id'] ?? '',
				]
			);

			return [
				'success'     => $is_ok,
				'status_code' => $status_code,
				'latency_ms'  => $latency,
				'message'     => $is_ok ? "Email sent directly via ZeptoMail in {$latency}ms!" : ( $body['message'] ?? "HTTP {$status_code}" ),
				'response'    => $body,
			];
		}

		// Fallback to WordPress standard wp_mail()
		$headers  = [ 'Content-Type: text/html; charset=UTF-8', "From: {$config['from_name']} <{$config['from_email']}>" ];
		$reply_to = sanitize_email( $data['reply_to'] ?? '' );
		if ( is_email( $reply_to ) ) {
			$reply_name = sanitize_text_field( $data['reply_name'] ?? '' );
			$headers[]  = "Reply-To: {$reply_name} <{$reply_to}>";
		}
		$sent = wp_mail( $recipient_email, $subject, $html, $headers );

		Artmatter_Logger::log(
			$sent ? 'success' : 'error',
			'email',
			"Email Sent via wp_mail(): '{$event}' to {$recipient_email}",
			[ 'event' => $event, 'recipient' => $recipient_email ]
		);

		return [
			'success' => $sent,
			'message' => $sent ? 'Email delivered via WordPress wp_mail()' : 'wp_mail failed to dispatch',
		];
	}

	public static function process_async_email_job( $event, $recipient_email, $recipient_name, $data ) {
		self::send_email( (string) $event, (string) $recipient_email, (string) $recipient_name, (array) $data );
	}

	/**
	 * AJAX Handler: Send Live Test Email
	 */
	public static function ajax_send_test_email() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$event     = sanitize_key( $_POST['event'] ?? 'artist_otp_code' );
		$recipient = sanitize_email( $_POST['recipient_email'] ?? '' );
		$name      = sanitize_text_field( $_POST['recipient_name'] ?? 'Customer' );

		$res = self::send_email( $event, $recipient, $name );
		if ( $res['success'] ) {
			wp_send_json_success( $res );
		} else {
			wp_send_json_error( $res );
		}
	}

	/**
	 * AJAX Handler: Live Visual HTML Preview
	 */
	public static function ajax_preview_email_html() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$event = sanitize_key( $_GET['event'] ?? ( $_POST['event'] ?? ( $_GET['template_key'] ?? ( $_POST['template_key'] ?? ( $_GET['template_slug'] ?? ( $_POST['template_slug'] ?? ( $_GET['slug'] ?? ( $_POST['slug'] ?? 'customer_order_processing' ) ) ) ) ) ) ) );
		$custom_data = $_POST['data'] ?? ( $_GET['data'] ?? [] );
		if ( is_string( $custom_data ) ) {
			$decoded = json_decode( stripslashes( $custom_data ), true );
			if ( is_array( $decoded ) ) {
				$custom_data = $decoded;
			}
		}
		$rendered = self::render_html( $event, is_array( $custom_data ) ? $custom_data : [] );

		wp_send_json_success( [
			'subject' => $rendered['subject'],
			'html'    => $rendered['html'],
		] );
	}
}

}

if ( ! class_exists( 'Artmatter_Email_Engine' ) ) {
	class_alias( 'Exacoat_Email_Engine', 'Artmatter_Email_Engine' );
}
