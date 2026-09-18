<?php
/**
 * Exacoat Core - WhatsApp Customer Notification Engine & Webhook Relay
 * Direct Meta WhatsApp Cloud API integration replacing external n8n workflows.
 * Fully configurable, multi-lingual, and deduplicated.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_WhatsApp_Service' ) ) {

class Exacoat_WhatsApp_Service {

	const SETTINGS_OPTION = 'exacoat_whatsapp_settings';
	const LOGS_OPTION     = 'exacoat_whatsapp_logs';

	/**
	 * Default Configuration
	 */
	public static function get_defaults(): array {
		return [
			'enabled'              => 1,
			'phone_number_id'      => '647199155145757',
			'access_token'         => '',
			'business_account_id'  => '',
			'notify_processing'    => 1,
			'notify_completed'     => 1,
			'notify_smb_ready'     => 1,
			'notify_smb_picked'    => 1,
			'telegram_enabled'     => 1,
			'telegram_bot_token'   => '',
			'telegram_chat_id'     => '-1002257662366',
			'telegram_thread_id'   => '774',
		];
	}

	/**
	 * Get Current Settings
	 */
	public static function get_settings(): array {
		$saved = get_option( self::SETTINGS_OPTION, [] );
		if ( ! is_array( $saved ) ) {
			$saved = [];
		}

		// Fallback to environment variables if present
		$env_token = getenv( 'EXACOAT_WHATSAPP_TOKEN' ) ?: getenv( 'WHATSAPP_API_TOKEN' );
		if ( ! empty( $env_token ) && empty( $saved['access_token'] ) ) {
			$saved['access_token'] = $env_token;
		}

		$env_phone_id = getenv( 'EXACOAT_WHATSAPP_PHONE_ID' ) ?: getenv( 'WHATSAPP_PHONE_NUMBER_ID' );
		if ( ! empty( $env_phone_id ) && empty( $saved['phone_number_id'] ) ) {
			$saved['phone_number_id'] = $env_phone_id;
		}

		return wp_parse_args( $saved, self::get_defaults() );
	}

	/**
	 * Update Settings
	 */
	public static function update_settings( array $new_settings ): bool {
		$current = self::get_settings();
		$updated = wp_parse_args( $new_settings, $current );
		return update_option( self::SETTINGS_OPTION, $updated, false );
	}

	/**
	 * Initialize Hooks & REST Routes
	 */
	public static function init(): void {
		// 1. Hook WooCommerce Order Status Changes
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'handle_order_status_change' ], 20, 4 );

		// 2. Register REST API Endpoints
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Register REST API Endpoints
	 */
	public static function register_routes(): void {
		register_rest_route( 'exacoat-core/v1', '/whatsapp/settings', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_settings' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_update_settings' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/whatsapp/test', [
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'rest_send_test' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );

		register_rest_route( 'exacoat-core/v1', '/whatsapp/logs', [
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'rest_get_logs' ],
				'permission_callback' => [ __CLASS__, 'check_permission' ],
			],
		] );
	}

	public static function check_permission(): bool {
		return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
	}

	/**
	 * Normalize Phone Number to E.164 (without leading +)
	 */
	public static function normalize_phone( string $raw_phone, string $country = 'ID' ): string {
		$clean = preg_replace( '/[^\d]/', '', $raw_phone );
		if ( empty( $clean ) ) {
			return '';
		}

		if ( 'ID' === strtoupper( $country ) || strpos( $clean, '08' ) === 0 ) {
			if ( strpos( $clean, '08' ) === 0 ) {
				$clean = '62' . substr( $clean, 1 );
			} elseif ( strpos( $clean, '8' ) === 0 ) {
				$clean = '62' . $clean;
			}
		}

		return ltrim( $clean, '+' );
	}

	/**
	 * Log WhatsApp Event
	 */
	public static function record_log( string $status, string $template, string $recipient, string $message, $meta = null ): void {
		$logs = get_option( self::LOGS_OPTION, [] );
		if ( ! is_array( $logs ) ) {
			$logs = [];
		}

		array_unshift( $logs, [
			'status'    => $status, // success, error, skipped
			'template'  => $template,
			'recipient' => $recipient,
			'message'   => $message,
			'meta'      => $meta,
			'timestamp' => current_time( 'mysql' ),
		] );

		if ( count( $logs ) > 100 ) {
			$logs = array_slice( $logs, 0, 100 );
		}

		update_option( self::LOGS_OPTION, $logs, false );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( $status === 'success' ? 'info' : 'warning', 'whatsapp', sprintf( '[%s] %s -> %s: %s', strtoupper( $status ), $template, $recipient, $message ), $meta );
		}
	}

	/**
	 * Send Meta WhatsApp Cloud API Template Message
	 */
	public static function send_template_message( string $phone, string $template_name, string $language_code, array $body_params = [], array $button_params = [] ): array {
		$settings = self::get_settings();
		$phone_id = trim( (string) ( $settings['phone_number_id'] ?? '' ) );
		$token    = trim( (string) ( $settings['access_token'] ?? '' ) );

		if ( empty( $phone_id ) || empty( $token ) ) {
			return [
				'success' => false,
				'error'   => 'WhatsApp Cloud API Phone ID or Access Token is missing in settings.',
			];
		}

		$clean_phone = self::normalize_phone( $phone );
		if ( empty( $clean_phone ) ) {
			return [
				'success' => false,
				'error'   => 'Invalid recipient phone number.',
			];
		}

		// Build components
		$components = [];

		// Body parameters
		if ( ! empty( $body_params ) ) {
			$parameters = [];
			foreach ( $body_params as $val ) {
				$parameters[] = [
					'type' => 'text',
					'text' => (string) $val,
				];
			}
			$components[] = [
				'type'       => 'body',
				'parameters' => $parameters,
			];
		}

		// Button parameters (dynamic URL suffix or payload)
		if ( ! empty( $button_params ) ) {
			foreach ( $button_params as $index => $btn ) {
				$btn_type = $btn['type'] ?? 'url';
				$sub_type = $btn['sub_type'] ?? 'url';

				$components[] = [
					'type'     => 'button',
					'sub_type' => $sub_type,
					'index'    => (string) $index,
					'parameters' => [
						[
							'type' => 'text',
							'text' => (string) ( $btn['text'] ?? ( $btn['payload'] ?? '' ) ),
						],
					],
				];
			}
		}

		$payload = [
			'messaging_product' => 'whatsapp',
			'recipient_type'    => 'individual',
			'to'                => $clean_phone,
			'type'              => 'template',
			'template'          => [
				'name'       => $template_name,
				'language'   => [
					'code' => $language_code,
				],
				'components' => $components,
			],
		];

		$url = "https://graph.facebook.com/v21.0/{$phone_id}/messages";

		$response = wp_remote_post( $url, [
			'headers' => [
				'Authorization' => 'Bearer ' . $token,
				'Content-Type'  => 'application/json',
			],
			'body'      => wp_json_encode( $payload ),
			'timeout'   => 15,
			'sslverify' => true,
		] );

		if ( is_wp_error( $response ) ) {
			$err = $response->get_error_message();
			self::record_log( 'error', $template_name, $clean_phone, $err, $payload );
			return [ 'success' => false, 'error' => $err ];
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code >= 200 && $code < 300 && ! empty( $body['messages'] ) ) {
			self::record_log( 'success', $template_name, $clean_phone, 'Delivered successfully via Meta API', $body );
			return [ 'success' => true, 'response' => $body ];
		}

		$error_message = $body['error']['message'] ?? ( 'HTTP ' . $code );
		self::record_log( 'error', $template_name, $clean_phone, $error_message, $body );

		return [
			'success' => false,
			'error'   => $error_message,
			'details' => $body,
		];
	}

	/**
	 * Send Telegram Notification
	 */
	public static function send_telegram_alert( string $text, array $buttons = [] ): bool {
		$settings   = self::get_settings();
		$bot_token  = trim( (string) ( $settings['telegram_bot_token'] ?? '' ) );
		$chat_id    = trim( (string) ( $settings['telegram_chat_id'] ?? '-1002257662366' ) );
		$thread_id  = trim( (string) ( $settings['telegram_thread_id'] ?? '774' ) );

		if ( empty( $bot_token ) || empty( $chat_id ) ) {
			return false;
		}

		$payload = [
			'chat_id' => $chat_id,
			'text'    => $text,
		];

		if ( ! empty( $thread_id ) ) {
			$payload['message_thread_id'] = (int) $thread_id;
		}

		if ( ! empty( $buttons ) ) {
			$payload['reply_markup'] = [
				'inline_keyboard' => $buttons,
			];
		}

		$url = "https://api.telegram.org/bot{$bot_token}/sendMessage";

		$response = wp_remote_post( $url, [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'body'    => wp_json_encode( $payload ),
			'timeout' => 8,
		] );

		return ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) === 200;
	}

	/**
	 * Handle WooCommerce Order Status Change Event
	 */
	public static function handle_order_status_change( $order_id, $from_status, $to_status, $order = null ): void {
		$settings = self::get_settings();
		if ( empty( $settings['enabled'] ) ) {
			return;
		}

		if ( ! $order instanceof \WC_Order ) {
			$order = wc_get_order( $order_id );
		}
		if ( ! $order ) {
			return;
		}

		$clean_new_status = str_replace( 'wc-', '', $to_status );
		$clean_old_status = str_replace( 'wc-', '', $from_status );

		if ( $clean_new_status === $clean_old_status ) {
			return;
		}

		// Deduplication check: Do not re-send notification if already sent for this status
		$last_notified = (string) $order->get_meta( '_whatsapp_last_notification' );
		if ( $last_notified === $clean_new_status ) {
			return;
		}

		$order_id_num   = $order->get_id();
		$customer_name  = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
		$billing_email  = $order->get_billing_email();
		$billing_phone  = $order->get_billing_phone();
		$country        = $order->get_billing_country();
		$language       = ( 'ID' === strtoupper( (string) $country ) ) ? 'id' : 'en';

		// Formatted items summary: [x1] Item Name, [x2] Item Name
		$item_strings = [];
		foreach ( $order->get_items() as $item ) {
			$item_strings[] = sprintf( '[x%d] %s', $item->get_quantity(), $item->get_name() );
		}
		$items_text = implode( ', ', $item_strings );

		// Shipping option detection
		$shipping_methods = $order->get_shipping_methods();
		$shipping_title   = '';
		if ( ! empty( $shipping_methods ) ) {
			$first_ship     = reset( $shipping_methods );
			$shipping_title = strtolower( (string) $first_ship->get_method_title() );
		}

		$shipping_option = 'delivery';
		if ( strpos( $shipping_title, 'ambil' ) !== false || strpos( $shipping_title, 'pick' ) !== false || strpos( $clean_new_status, 'smb' ) !== false ) {
			$shipping_option = 'pickup';
		}

		// Carrier and tracking code resolution
		$carrier_id   = strtolower( (string) ( $order->get_meta( 'carrier_id' ) ?: ( $order->get_meta( '_carrier_id' ) ?: '' ) ) );
		$carrier_name = class_exists( 'Exacoat_Tracking_Pool' ) ? Exacoat_Tracking_Pool::get_carrier_label( $carrier_id ) : strtoupper( $carrier_id );
		$tracking_num = (string) ( $order->get_meta( 'tracking_number' ) ?: ( $order->get_meta( '_tracking_number' ) ?: '' ) );

		// Cashback earned resolution
		$cashback_val = $order->get_meta( 'cashback_earned' ) ?: $order->get_meta( '_cashback_earned' );

		// RMA / Warranty / Redeem Order detection
		$rma_order_type = (string) ( $order->get_meta( '_rma_order_type' ) ?: $order->get_meta( 'rma_order_type' ) );
		$rma_invoice    = (string) ( $order->get_meta( '_rma_original_invoice' ) ?: '' );
		$is_rma         = in_array( strtolower( $rma_order_type ), [ 'warranty', 'redeem' ], true );

		// ---------------------------------------------------------------------
		// Branch 1: PROCESSING (Payment Confirmed)
		// ---------------------------------------------------------------------
		if ( 'processing' === $clean_new_status ) {
			// 1. Auto-allocate tracking number if empty
			if ( class_exists( 'Exacoat_Tracking_Pool' ) ) {
				Exacoat_Tracking_Pool::auto_assign_order_tracking( $order_id_num );
			}

			// If Warranty or Redeem order: Add note and skip customer WhatsApp notification
			if ( $is_rma ) {
				$rma_note = sprintf( "[%s Order]\nOriginal invoice: %s", ucfirst( $rma_order_type ), $rma_invoice );
				$order->add_order_note( $rma_note, false );
				$order->update_meta_data( '_whatsapp_last_notification', $clean_new_status );
				$order->save();
				return;
			}

			// Send Customer WhatsApp: notif_order_confirmed
			if ( ! empty( $settings['notify_processing'] ) && ! empty( $billing_phone ) ) {
				$status_text = ( 'delivery' === $shipping_option )
					? ( 'id' === $language ? '*pesanan kamu sudah dikirim* 🚚' : '*your order has been shipped* 🚚' )
					: ( 'id' === $language ? '*pesanan kamu sudah siap diambil* 🚚' : '*your order is ready to pick up* 🚚' );

				$cashback_text = ' ';
				if ( ! empty( $cashback_val ) ) {
					$cashback_text = ( 'id' === $language )
						? sprintf( 'Dan satu lagi, untuk pesanan ini, kamu akan mendapatkan *cashback sebesar %s* setelah pesanan selesai. 🎉', $cashback_val )
						: sprintf( 'One more thing, for this order you will receive *cashback of %s* once completed. 🎉', $cashback_val );
				}

				$body_params = [
					$customer_name,
					(string) $order_id_num,
					$items_text,
					$status_text,
					(string) $order_id_num,
					$cashback_text,
				];

				$button_params = [
					[ 'type' => 'url', 'sub_type' => 'url', 'text' => sprintf( '?id=%d&e=%s', $order_id_num, rawurlencode( $billing_email ) ) ],
				];

				self::send_template_message( $billing_phone, 'notif_order_confirmed', $language, $body_params, $button_params );
			}

			// Optional Telegram Alert
			if ( ! empty( $settings['telegram_enabled'] ) ) {
				$total_formatted = wp_strip_all_tags( wc_price( $order->get_total(), [ 'currency' => $order->get_currency() ] ) );
				$payment_title   = $order->get_payment_method_title() ?: 'Bank Transfer';

				$tg_text = sprintf(
					"🟢 New order confirmed on exacoat.com\n\nName: %s\nCountry: %s\nOrder Number: #%d\nTotal: %s\nPayment Method: %s\nItems: %s",
					$customer_name,
					$country,
					$order_id_num,
					$total_formatted,
					$payment_title,
					$items_text
				);

				$tg_buttons = [
					[
						[
							'text' => 'See the order',
							'url'  => admin_url( 'post.php?post=' . $order_id_num . '&action=edit' ),
						],
					],
				];

				self::send_telegram_alert( $tg_text, $tg_buttons );
			}

			$order->update_meta_data( '_whatsapp_last_notification', $clean_new_status );
			$order->update_meta_data( '_whatsapp_notified_at', current_time( 'mysql' ) );
			$order->save();
		}

		// ---------------------------------------------------------------------
		// Branch 2: COMPLETED (Shipped)
		// ---------------------------------------------------------------------
		elseif ( 'completed' === $clean_new_status ) {
			if ( ! empty( $settings['notify_completed'] ) && ! empty( $billing_phone ) ) {
				if ( $is_rma ) {
					// Warranty / Redeem Shipped Notification
					$body_params = [
						$customer_name,
						(string) $order_id_num,
						$carrier_name,
						$tracking_num ?: '-',
						(string) $order_id_num,
					];
					self::send_template_message( $billing_phone, 'notif_order_warranty_redeem', $language, $body_params );
				} else {
					// Standard Customer Order Shipped
					$cashback_text = ' ';
					if ( ! empty( $cashback_val ) ) {
						$cashback_text = ( 'id' === $language )
							? sprintf( '*Cashback sebesar %s* juga sudah masuk ke akun kamu untuk pemesanan berikutnya. 🎉', $cashback_val )
							: sprintf( '*Cashback of %s* has also been credited to your account for your next purchase. 🎉', $cashback_val );
					}

					$body_params = [
						$customer_name,
						(string) $order_id_num,
						$carrier_name,
						$tracking_num ?: '-',
						$cashback_text,
					];

					$button_params = [
						[ 'type' => 'url', 'sub_type' => 'url', 'text' => sprintf( '?id=%d&e=%s', $order_id_num, rawurlencode( $billing_email ) ) ],
					];

					self::send_template_message( $billing_phone, 'notif_order_completed', $language, $body_params, $button_params );
				}
			}

			$order->update_meta_data( '_whatsapp_last_notification', $clean_new_status );
			$order->update_meta_data( '_whatsapp_notified_at', current_time( 'mysql' ) );
			$order->save();
		}

		// ---------------------------------------------------------------------
		// Branch 3: SMB-READY (Summarecon Mall Bekasi Pickup Ready)
		// ---------------------------------------------------------------------
		elseif ( 'smb-ready' === $clean_new_status || 'wc-smb-ready' === $clean_new_status ) {
			if ( ! empty( $settings['notify_smb_ready'] ) && ! empty( $billing_phone ) ) {
				$body_params = [
					$customer_name,
					(string) $order_id_num,
					$items_text,
				];
				self::send_template_message( $billing_phone, 'notif_order_pickup_smb', $language, $body_params );
			}

			$order->update_meta_data( '_whatsapp_last_notification', $clean_new_status );
			$order->update_meta_data( '_whatsapp_notified_at', current_time( 'mysql' ) );
			$order->save();
		}

		// ---------------------------------------------------------------------
		// Branch 4: SMB-PICKED (Summarecon Mall Bekasi Picked Up)
		// ---------------------------------------------------------------------
		elseif ( 'smb-picked' === $clean_new_status || 'wc-smb-picked' === $clean_new_status ) {
			if ( ! empty( $settings['notify_smb_picked'] ) && ! empty( $billing_phone ) ) {
				$cashback_text = ' ';
				if ( ! empty( $cashback_val ) ) {
					$cashback_text = ( 'id' === $language )
						? sprintf( '*Cashback sebesar %s* juga sudah masuk ke akun kamu untuk pemesanan berikutnya. 🎉', $cashback_val )
						: sprintf( '*Cashback of %s* has also been credited to your account for your next purchase. 🎉', $cashback_val );
				}

				$body_params = [
					$customer_name,
					(string) $order_id_num,
					'Exacoat Store Bekasi',
					$cashback_text,
				];

				$button_params = [
					[ 'type' => 'button', 'sub_type' => 'url', 'payload' => 'review-bekasi' ],
				];

				self::send_template_message( $billing_phone, 'notif_order_picked_up_all', $language, $body_params, $button_params );
			}

			$order->update_meta_data( '_whatsapp_last_notification', $clean_new_status );
			$order->update_meta_data( '_whatsapp_notified_at', current_time( 'mysql' ) );
			$order->save();
		}
	}

	// -------------------------------------------------------------------------
	// REST Callbacks
	// -------------------------------------------------------------------------

	public static function rest_get_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$settings = self::get_settings();
		// Mask access token for security
		if ( ! empty( $settings['access_token'] ) ) {
			$settings['access_token_masked'] = substr( $settings['access_token'], 0, 8 ) . '...' . substr( $settings['access_token'], -6 );
		}
		return new \WP_REST_Response( [ 'success' => true, 'settings' => $settings ], 200 );
	}

	public static function rest_update_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		self::update_settings( $params );
		return new \WP_REST_Response( [ 'success' => true, 'settings' => self::get_settings() ], 200 );
	}

	public static function rest_send_test( \WP_REST_Request $request ): \WP_REST_Response {
		$params        = $request->get_json_params() ?: $request->get_params();
		$phone         = sanitize_text_field( $params['phone'] ?? '' );
		$template_name = sanitize_text_field( $params['template'] ?? 'notif_order_completed' );
		$language      = sanitize_text_field( $params['language'] ?? 'id' );

		if ( empty( $phone ) ) {
			return new \WP_REST_Response( [ 'success' => false, 'error' => 'Phone number is required' ], 400 );
		}

		$body_params = [
			'Test Customer',
			'999999',
			'JNE Express',
			'JNE1234567890',
			'Cashback of IDR 10.000 has been credited. 🎉',
		];

		$button_params = [
			[ 'type' => 'url', 'sub_type' => 'url', 'text' => '?id=999999&e=test@exacoat.com' ],
		];

		$res = self::send_template_message( $phone, $template_name, $language, $body_params, $button_params );
		return new \WP_REST_Response( $res, ! empty( $res['success'] ) ? 200 : 400 );
	}

	public static function rest_get_logs( \WP_REST_Request $request ): \WP_REST_Response {
		$logs = get_option( self::LOGS_OPTION, [] );
		if ( ! is_array( $logs ) ) $logs = [];
		return new \WP_REST_Response( [ 'success' => true, 'logs' => $logs ], 200 );
	}
}

}
