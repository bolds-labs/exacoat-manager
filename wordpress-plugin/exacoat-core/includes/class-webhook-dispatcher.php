<?php
/**
 * Artmatter Centralized Event & Email Webhook Dispatcher
 * Consolidates Snippets: #12366, #12727, #12843, #12916
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Webhook_Dispatcher' ) ) {

class Exacoat_Webhook_Dispatcher {

	public static function init() {
		// 1. Order Sync to Webhook & Action Scheduler (#12916)
		add_action( 'woocommerce_new_order', [ __CLASS__, 'queue_order_sync' ], 10, 1 );
		add_action( 'woocommerce_update_order', [ __CLASS__, 'queue_order_sync' ], 10, 1 );
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'queue_order_sync' ], 10, 1 );
		add_action( 'woocommerce_saved_order_items', [ __CLASS__, 'queue_order_sync' ], 10, 2 );
		add_action( 'artmatter_n8n_sync_job', [ __CLASS__, 'execute_order_webhook_send' ], 10, 1 );

		// 2. Product Update Webhook (#12843)
		add_action( 'save_post_product', [ __CLASS__, 'queue_product_update_webhook' ], 25, 2 );
		add_action( 'shutdown', [ __CLASS__, 'process_queued_product_webhooks' ] );

		// 3. User Lifecycle Webhook (#12366)
		add_action( 'user_register', [ __CLASS__, 'on_user_registered_webhook' ], 10, 1 );
		add_action( 'profile_update', [ __CLASS__, 'on_user_profile_updated_webhook' ], 10, 2 );
	}

	public static function get_webhook_url() {
		$url = defined( 'AM_EMAIL_WEBHOOK_URL' ) ? AM_EMAIL_WEBHOOK_URL : Artmatter_Core::get_setting( 'email_webhook_url', '' );
		return ! empty( $url ) ? trim( $url ) : 'https://node.exacoat.com/webhook/artmatter/email';
	}

	public static function get_secret_key() {
		return defined( 'AM_WEBHOOK_SECRET' ) ? AM_WEBHOOK_SECRET : ( getenv( 'AM_WEBHOOK_SECRET' ) ?: Artmatter_Core::get_setting( 'webhook_secret_key', Artmatter_Core::get_setting( 'webhook_secret', '' ) ) );
	}

	public static function dispatch( $event, $recipient_email, $recipient_name = '', $data = [] ) {
		// Normalize event key for email template matching
		$normalized_event = $event;
		if ( $event === 'email_otp' ) $normalized_event = 'artist_otp_code';

		// 1. Direct Native ZeptoMail Dispatch
		if ( class_exists( 'Artmatter_Email_Engine' ) && is_email( $recipient_email ) ) {
			Artmatter_Email_Engine::send_email( $normalized_event, $recipient_email, $recipient_name, $data );
		}



		// 3. Optional External Webhook Relay
		$webhook_url = self::get_webhook_url();
		if ( ! empty( $webhook_url ) ) {
			$payload = array_merge( [
				'event'           => $normalized_event,
				'timestamp'       => current_time( 'mysql' ),
				'recipient_email' => $recipient_email,
				'toaddress'       => $recipient_email,
				'email'           => $recipient_email,
				'artist_name'     => $recipient_name,
				'display_name'    => $recipient_name,
				'mergeinfo'       => $data,
				'data'            => $data,
			], $data );

			wp_remote_post( $webhook_url, [
				'headers'   => [
					'Content-Type' => 'application/json',
					'x-secret-key' => self::get_secret_key(),
					'user-agent'   => 'Artmatter-Core/' . ARTMATTER_CORE_VERSION,
				],
				'body'      => wp_json_encode( $payload ),
				'timeout'   => 8,
				'blocking'  => false,
				'sslverify' => true,
			] );
		}

		return true;
	}

	/**
	 * 1. Action Scheduler Order Webhook (#12916)
	 */
	public static function queue_order_sync( $order_id ) {
		$order_id = (int) $order_id;
		if ( ! $order_id ) return;

		if ( function_exists( 'as_has_scheduled_action' ) && as_has_scheduled_action( 'artmatter_n8n_sync_job', [ 'order_id' => $order_id ] ) ) {
			return;
		}

		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action( time() + 5, 'artmatter_n8n_sync_job', [ 'order_id' => $order_id ], 'artmatter-webhooks' );
		} else {
			self::execute_order_webhook_send( $order_id );
		}
	}

	public static function execute_order_webhook_send( $order_id ) {
		$payload = Artmatter_Core::build_order_payload( $order_id );
		if ( ! $payload ) return;

		$logger      = function_exists( 'wc_get_logger' ) ? wc_get_logger() : null;
		$log_context = [ 'source' => 'artmatter-n8n' ];

		$response = wp_remote_post( 'https://api.artmatter.co/webhook/artmatter/wp/order', [
			'body'      => wp_json_encode( $payload ),
			'headers'   => [
				'Content-Type' => 'application/json',
				'x-secret-key' => self::get_secret_key(),
			],
			'timeout'   => 15,
			'blocking'  => true,
			'sslverify' => true,
		] );

		if ( is_wp_error( $response ) ) {
			if ( $logger ) {
				$logger->error( "Order #{$order_id} sync failed: " . $response->get_error_message(), $log_context );
			}
			throw new Exception( $response->get_error_message() );
		}

		$status = wp_remote_retrieve_response_code( $response );
		if ( $logger ) {
			if ( $status >= 200 && $status < 300 ) {
				$logger->info( "Order #{$order_id} sync success (HTTP {$status})", $log_context );
			} else {
				$logger->error( "Order #{$order_id} sync rejected (HTTP {$status})", $log_context );
			}
		}
	}

	/**
	 * 2. Product Update Webhook (#12843)
	 */
	private static $queued_products = [];

	public static function queue_product_update_webhook( $post_id, $post = null ) {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
		if ( wp_is_post_revision( $post_id ) ) return;
		if ( get_post_type( $post_id ) !== 'product' ) return;

		self::$queued_products[ $post_id ] = true;
	}

	public static function process_queued_product_webhooks() {
		if ( empty( self::$queued_products ) ) return;

		foreach ( array_keys( self::$queued_products ) as $post_id ) {
			clean_post_cache( $post_id );
			$post = get_post( $post_id );
			if ( ! $post ) continue;

			$image_id = get_post_thumbnail_id( $post_id );

			$payload = [
				'product_id'  => $post_id,
				'title'       => $post->post_title,
				'slug'        => $post->post_name,
				'status'      => $post->post_status,
				'created_at'  => $post->post_date,
				'updated_at'  => current_time( 'mysql' ),
				'product_url' => get_permalink( $post_id ),

				// Visuals
				'image_id'    => $image_id,
				'image_url'   => $image_id ? wp_get_attachment_url( $image_id ) : null,

				// Terms & Taxonomies
				'taxonomies'  => get_post_taxonomies( $post_id ),
				'terms'       => wp_get_post_terms( $post_id, get_post_taxonomies( $post_id ) ),

				// Meta Data
				'meta'        => get_post_meta( $post_id ),
			];

			$secret = self::get_secret_key();

			wp_remote_post( 'https://api.artmatter.co/webhook/artmatter/wp/product', [
				'headers'   => [
					'Content-Type' => 'application/json',
					'x-secret-key' => $secret,
				],
				'body'      => wp_json_encode( $payload ),
				'blocking'  => false,
				'timeout'   => 5,
				'sslverify' => false,
			] );

			wp_remote_post( 'https://api.exacoat.com/webhook/artmatter/wp/product', [
				'headers'   => [
					'Content-Type' => 'application/json',
					'x-secret-key' => $secret,
				],
				'body'      => wp_json_encode( $payload ),
				'blocking'  => false,
				'timeout'   => 5,
				'sslverify' => false,
			] );
		}

		self::$queued_products = [];
	}

	/**
	/**
	 * 3. User Lifecycle Webhook
	 */
	public static function on_user_registered_webhook( $user_id ) {
		$user = get_userdata( $user_id );
		if ( ! $user ) return;

		$roles = (array) $user->roles;

		// Standard user registered event
		self::dispatch( 'user_registered', $user->user_email, $user->display_name, [
			'user_id'  => $user_id,
			'username' => $user->user_login,
			'roles'    => $roles,
		] );
	}

	public static function on_user_profile_updated_webhook( $user_id, $old_user_data ) {
		// Profile update handler
	}

	/* Helpers for specific notifications */
	public static function send_email_otp( $recipient_email, $recipient_name, $otp_code ) {
		return self::dispatch( 'email_otp', $recipient_email, $recipient_name, [
			'otp_code'   => $otp_code,
			'expires_in' => '10 minutes',
		] );
	}
}

}

if ( ! class_exists( 'Artmatter_Webhook_Dispatcher' ) ) {
	class_alias( 'Exacoat_Webhook_Dispatcher', 'Artmatter_Webhook_Dispatcher' );
}
