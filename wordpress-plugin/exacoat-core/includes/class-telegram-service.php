<?php
/**
 * Exacoat Core Telegram Notification Service
 * Dispatches real-time push alerts to administrator Telegram chat and topic threads.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Telegram_Service' ) ) {

class Exacoat_Telegram_Service {

	private const DEFAULT_BOT_TOKEN = '5576968403:AAFxQrqNYAfO9GSi6QElD6fMI0-yPUTtcFA';
	private const DEFAULT_CHAT_ID   = '-1002257662366';
	private const DEFAULT_THREAD_ID = '774';

	/**
	 * Get Telegram Configuration from Settings & Environment
	 */
	public static function get_config(): array {
		$settings = class_exists( 'Exacoat_Core' ) ? Exacoat_Core::get_settings() : get_option( 'exacoat_core_settings', [] );

		$bot_token = trim( (string) (
			defined( 'EXA_TELEGRAM_BOT_TOKEN' ) ? EXA_TELEGRAM_BOT_TOKEN :
			( defined( 'AM_TELEGRAM_BOT_TOKEN' ) ? AM_TELEGRAM_BOT_TOKEN :
			( getenv( 'EXA_TELEGRAM_BOT_TOKEN' ) ?:
			( getenv( 'AM_TELEGRAM_BOT_TOKEN' ) ?:
			( $settings['telegram_bot_token'] ?? self::DEFAULT_BOT_TOKEN ) ) ) )
		) );

		$chat_id = trim( (string) (
			defined( 'EXA_TELEGRAM_CHAT_ID' ) ? EXA_TELEGRAM_CHAT_ID :
			( defined( 'AM_TELEGRAM_CHAT_ID' ) ? AM_TELEGRAM_CHAT_ID :
			( getenv( 'EXA_TELEGRAM_CHAT_ID' ) ?:
			( getenv( 'AM_TELEGRAM_CHAT_ID' ) ?:
			( $settings['telegram_chat_id'] ?? self::DEFAULT_CHAT_ID ) ) ) )
		) );

		$thread_id = trim( (string) (
			defined( 'EXA_TELEGRAM_THREAD_ID' ) ? EXA_TELEGRAM_THREAD_ID :
			( defined( 'AM_TELEGRAM_THREAD_ID' ) ? AM_TELEGRAM_THREAD_ID :
			( getenv( 'EXA_TELEGRAM_THREAD_ID' ) ?:
			( getenv( 'AM_TELEGRAM_THREAD_ID' ) ?:
			( $settings['telegram_thread_id'] ?? self::DEFAULT_THREAD_ID ) ) ) )
		) );

		return [
			'enabled'                   => (bool) ( $settings['enable_telegram'] ?? $settings['telegram_enabled'] ?? 1 ),
			'bot_token'                 => $bot_token,
			'chat_id'                   => $chat_id,
			'thread_id'                 => $thread_id,
			'notify_new_sale'           => (bool) ( $settings['telegram_notify_new_sale'] ?? 1 ),
			'notify_kyc'                => (bool) ( $settings['telegram_notify_kyc'] ?? 1 ),
			'notify_affiliate_register' => (bool) ( $settings['telegram_notify_affiliate_register'] ?? 1 ),
			'notify_affiliate_payout'   => (bool) ( $settings['telegram_notify_affiliate_payout'] ?? 1 ),
			'notify_inventory'          => (bool) ( $settings['telegram_notify_inventory'] ?? 1 ),
			'notify_errors'             => (bool) ( $settings['telegram_notify_errors'] ?? 1 ),
		];
	}

	/**
	 * Send Telegram Message
	 *
	 * @param string $text Message content (HTML supported)
	 * @param array  $options Optional overrides: bot_token, chat_id, thread_id, parse_mode, disable_preview, force
	 * @return array [ 'success' => bool, 'message' => string, 'latency_ms' => int, 'message_id' => int|null ]
	 */
	public static function send( string $text, array $options = [] ): array {
		$config = self::get_config();

		if ( empty( $config['enabled'] ) && empty( $options['force'] ) ) {
			return [
				'success'    => false,
				'message'    => 'Telegram notifications disabled in settings',
				'latency_ms' => 0,
			];
		}

		$bot_token = ! empty( $options['bot_token'] ) ? trim( (string) $options['bot_token'] ) : $config['bot_token'];
		$chat_id   = ! empty( $options['chat_id'] ) ? trim( (string) $options['chat_id'] ) : $config['chat_id'];
		$thread_id = isset( $options['thread_id'] ) && $options['thread_id'] !== '' ? trim( (string) $options['thread_id'] ) : $config['thread_id'];

		if ( empty( $bot_token ) || empty( $chat_id ) ) {
			return [
				'success'    => false,
				'message'    => 'Telegram Bot Token or Chat ID is missing',
				'latency_ms' => 0,
			];
		}

		$payload = [
			'chat_id'                  => $chat_id,
			'text'                     => $text,
			'parse_mode'               => $options['parse_mode'] ?? 'HTML',
			'disable_web_page_preview' => ! empty( $options['disable_preview'] ),
		];

		if ( $thread_id !== '' && is_numeric( $thread_id ) ) {
			$payload['message_thread_id'] = (int) $thread_id;
		}

		$start = microtime( true );
		$api_url = "https://api.telegram.org/bot{$bot_token}/sendMessage";

		$response = wp_remote_post( $api_url, [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'body'    => wp_json_encode( $payload ),
			'timeout' => 8,
		] );

		$latency = round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $response ) ) {
			$err_msg = $response->get_error_message();
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'telegram', 'Telegram Alert Failed: ' . $err_msg );
			}
			return [
				'success'    => false,
				'message'    => $err_msg,
				'latency_ms' => $latency,
			];
		}

		$code = wp_remote_retrieve_response_code( $response );
		$raw_body = wp_remote_retrieve_body( $response );
		$body = json_decode( $raw_body, true );

		if ( $code === 200 && ! empty( $body['ok'] ) ) {
			$message_id = $body['result']['message_id'] ?? null;
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'info', 'telegram', "Telegram Alert Delivered ({$latency}ms) [Msg #{$message_id}]" );
			}
			return [
				'success'    => true,
				'message'    => 'Telegram notification delivered successfully',
				'latency_ms' => $latency,
				'message_id' => $message_id,
			];
		}

		$err_msg = ! empty( $body['description'] ) ? $body['description'] : "HTTP {$code}";
		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'warning', 'telegram', "Telegram Delivery Error: {$err_msg}", [ 'response' => $body ] );
		}

		return [
			'success'    => false,
			'message'    => $err_msg,
			'latency_ms' => $latency,
		];
	}
}

}
