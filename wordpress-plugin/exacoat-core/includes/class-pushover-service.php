<?php
/**
 * Artmatter Core Pushover Notification Service
 * Dispatches real-time push alerts to administrator devices for key events.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Pushover_Service' ) ) {

class Exacoat_Pushover_Service {

	private static $api_endpoint = 'https://api.pushover.net/1/messages.json';

	/**
	 * Get Pushover Configuration from Settings
	 */
	public static function get_config(): array {
		$settings = Artmatter_Core::get_settings();
		return [
			'enabled'              => (bool) ( $settings['enable_pushover'] ?? $settings['pushover_enabled'] ?? 1 ),
			'user_key'             => trim( defined( 'AM_PUSHOVER_USER_KEY' ) ? AM_PUSHOVER_USER_KEY : ( getenv( 'AM_PUSHOVER_USER_KEY' ) ?: ( $settings['pushover_user_key'] ?? '' ) ) ),
			'app_token'            => trim( defined( 'AM_PUSHOVER_APP_TOKEN' ) ? AM_PUSHOVER_APP_TOKEN : ( getenv( 'AM_PUSHOVER_APP_TOKEN' ) ?: ( $settings['pushover_app_token'] ?? '' ) ) ),
												'notify_new_sale'      => (bool) ( $settings['pushover_notify_new_sale'] ?? 1 ),
									'notify_errors'        => (bool) ( $settings['pushover_notify_errors'] ?? 1 ),
		];
	}

	/**
	 * Send Pushover Message
	 *
	 * @param string $title
	 * @param string $message (supports HTML)
	 * @param array $options [ 'url' => '', 'url_title' => '', 'image_data' => '', 'image_path' => '', 'priority' => 0 ]
	 * @return array [ 'success' => bool, 'message' => string ]
	 */
	public static function send( string $title, string $message, array $options = [] ): array {
		$config = self::get_config();

		if ( empty( $config['enabled'] ) && empty( $options['force'] ) ) {
			return [ 'success' => false, 'message' => 'Pushover notifications disabled in settings' ];
		}

		if ( empty( $config['user_key'] ) || empty( $config['app_token'] ) ) {
			return [ 'success' => false, 'message' => 'Pushover User Key or App Token missing' ];
		}

		$body_params = [
			'token'     => $config['app_token'],
			'user'      => $config['user_key'],
			'title'     => wp_strip_all_tags( $title ),
			'message'   => $message,
			'html'      => 1,
			'priority'  => isset( $options['priority'] ) ? (int) $options['priority'] : 0,
		];

		if ( ! empty( $options['url'] ) ) {
			$body_params['url'] = esc_url_raw( $options['url'] );
			$body_params['url_title'] = ! empty( $options['url_title'] ) ? sanitize_text_field( $options['url_title'] ) : 'View Details';
		}

		// Handle Attachment (Binary or File Path)
		$boundary = wp_generate_password( 24, false );
		$payload  = '';
		$headers  = [];

		$has_attachment = ! empty( $options['image_data'] ) || ! empty( $options['image_path'] );

		if ( $has_attachment ) {
			$headers['Content-Type'] = 'multipart/form-data; boundary=' . $boundary;

			foreach ( $body_params as $name => $val ) {
				$payload .= "--{$boundary}\r\n";
				$payload .= "Content-Disposition: form-data; name=\"{$name}\"\r\n\r\n";
				$payload .= "{$val}\r\n";
			}

			$image_bytes = '';
			$filename = 'image.jpg';

			if ( ! empty( $options['image_data'] ) ) {
				$image_bytes = $options['image_data'];
			} elseif ( ! empty( $options['image_path'] ) && file_exists( $options['image_path'] ) ) {
				$image_bytes = file_get_contents( $options['image_path'] );
				$filename    = basename( $options['image_path'] );
			} elseif ( ! empty( $options['image_url'] ) ) {
				$img_resp = wp_remote_get( $options['image_url'], [ 'timeout' => 3 ] );
				if ( ! is_wp_error( $img_resp ) ) {
					$image_bytes = wp_remote_retrieve_body( $img_resp );
				}
			}

			if ( ! empty( $image_bytes ) ) {
				$payload .= "--{$boundary}\r\n";
				$payload .= "Content-Disposition: form-data; name=\"attachment\"; filename=\"{$filename}\"\r\n";
				$payload .= "Content-Type: image/jpeg\r\n\r\n";
				$payload .= $image_bytes . "\r\n";
			}

			$payload .= "--{$boundary}--\r\n";
		} else {
			$headers['Content-Type'] = 'application/x-www-form-urlencoded';
			$payload = http_build_query( $body_params );
		}

		$response = wp_remote_post( self::$api_endpoint, [
			'headers' => $headers,
			'body'    => $payload,
			'timeout' => 3.5,
		] );

		if ( is_wp_error( $response ) ) {
			Artmatter_Logger::log(
				'error',
				'pushover',
				'Pushover Alert Failed: ' . $response->get_error_message(),
				[ 'title' => $title ]
			);
			return [ 'success' => false, 'message' => $response->get_error_message() ];
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code === 200 && ! empty( $body['status'] ) && (int) $body['status'] === 1 ) {
			Artmatter_Logger::log(
				'info',
				'pushover',
				"Pushover Alert Sent: \"{$title}\"",
				[ 'title' => $title ]
			);
			return [ 'success' => true, 'message' => 'Pushover alert delivered successfully' ];
		}

		$err_msg = ! empty( $body['errors'] ) ? implode( ', ', (array) $body['errors'] ) : "HTTP {$code}";
		Artmatter_Logger::log(
			'warning',
			'pushover',
			"Pushover Delivery Error: {$err_msg}",
			[ 'title' => $title, 'response' => $body ]
		);
		return [ 'success' => false, 'message' => $err_msg ];
	}

	public static function notify_new_artwork( $id, $title = '', $author = '', $cats = [], $thumb = '' ) {}
	public static function notify_new_artist( $name, $email, $user_id = 0 ) {}
	public static function notify_artist_kyc_submitted( $user_id ) {}
	public static function notify_self_purchase( $order_id, $artist_name = '', $email = '' ) {}

	/**
	 * Convenience Helper: New Order Sale Alert
	 */
	public static function notify_new_sale( int $order_id, $arg2 = null, $arg3 = null, $arg4 = '' ) {
		$config = self::get_config();
		if ( empty( $config['notify_new_sale'] ) ) return;

		$msg  = "<b>New Store Order:</b> #" . $order_id . "\n";
		if ( ! empty( $arg4 ) ) {
			$msg .= "<b>Product:</b> " . esc_html( $arg4 ) . "\n";
		}

		self::send( 'New Order Received', $msg, [
			'url'       => admin_url( 'post.php?post=' . $order_id . '&action=edit' ),
			'url_title' => 'View Order',
			'priority'  => 0,
		] );
	}

	public static function notify_critical_error( string $title, string $details ) {
		$config = self::get_config();
		if ( empty( $config['notify_errors'] ) ) return;

		$msg = "<b>Error:</b> " . esc_html( $title ) . "\n";
		$msg .= "<code>" . esc_html( wp_trim_words( $details, 40 ) ) . "</code>";

		self::send( 'Artmatter Core Error', $msg, [
			'url'       => admin_url( 'admin.php?page=artmatter-core' ),
			'url_title' => 'Inspect Diagnostics & Logs',
			'priority'  => 1,
		] );
	}
}

}

if ( ! class_exists( 'Artmatter_Pushover_Service' ) ) {
	class_alias( 'Exacoat_Pushover_Service', 'Artmatter_Pushover_Service' );
}
if ( ! class_exists( 'Artmatter_Pushover' ) ) {
	class_alias( 'Exacoat_Pushover_Service', 'Artmatter_Pushover' );
}
