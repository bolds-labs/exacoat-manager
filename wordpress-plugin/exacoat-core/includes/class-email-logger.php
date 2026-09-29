<?php
/**
 * Exacoat Email Logger & Telemetry Engine
 * High-performance database logging for outbound transactional emails via ZeptoMail,
 * real-time webhook delivery tracking, analytics, and instant resend capability.
 *
 * @package Exacoat_Core
 * @version 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Email_Logger' ) ) {

class Exacoat_Email_Logger {

	const TABLE_NAME = 'exacoat_email_logs';
	private static $table_verified = false;

	public static function init(): void {
		// 1. Ensure table schema is up to date
		add_action( 'init', [ __CLASS__, 'ensure_table_exists' ], 5 );

		// 2. Register REST API routes
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// 3. Action Scheduler daily log retention pruning (60 days)
		add_action( 'exacoat_daily_email_log_cleanup', [ __CLASS__, 'purge_expired_logs' ] );
		if ( function_exists( 'as_has_scheduled_action' ) && ! as_has_scheduled_action( 'exacoat_daily_email_log_cleanup' ) ) {
			as_schedule_recurring_action( time() + 3600, DAY_IN_SECONDS, 'exacoat_daily_email_log_cleanup', [], 'exacoat-email-logs' );
		}
	}

	public static function get_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . self::TABLE_NAME;
	}

	/**
	 * Ensure the dedicated email logs table exists
	 */
	public static function ensure_table_exists(): void {
		if ( self::$table_verified ) {
			return;
		}

		global $wpdb;
		$table = self::get_table_name();

		if ( $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) ) === $table ) {
			self::$table_verified = true;
			return;
		}

		if ( file_exists( ABSPATH . 'wp-admin/includes/upgrade.php' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			request_id varchar(128) NOT NULL DEFAULT '',
			message_id varchar(191) DEFAULT NULL,
			provider varchar(32) NOT NULL DEFAULT 'zeptomail',
			event varchar(64) NOT NULL DEFAULT '',
			order_id bigint(20) DEFAULT NULL,
			recipient_email varchar(191) NOT NULL,
			recipient_name varchar(191) NOT NULL DEFAULT '',
			subject varchar(255) NOT NULL DEFAULT '',
			status varchar(32) NOT NULL DEFAULT 'sent',
			status_code int(5) NOT NULL DEFAULT 200,
			latency_ms int(10) NOT NULL DEFAULT 0,
			bounce_reason text DEFAULT NULL,
			error_message text DEFAULT NULL,
			metadata longtext DEFAULT NULL,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			delivered_at datetime DEFAULT NULL,
			opened_at datetime DEFAULT NULL,
			PRIMARY KEY (id),
			KEY request_id (request_id(64)),
			KEY order_id (order_id),
			KEY recipient_email (recipient_email(100)),
			KEY event (event(32)),
			KEY status (status(20)),
			KEY created_at (created_at)
		) {$charset_collate};";

		if ( function_exists( 'dbDelta' ) ) {
			dbDelta( $sql );
		} else {
			$wpdb->query( $sql );
		}

		self::$table_verified = true;
	}

	/**
	 * Register REST routes for ZeptoMail Webhooks and Manager ERP Bridge
	 */
	public static function register_rest_routes(): void {
		$ns = 'exacoat-core/v1';

		// 1. ZeptoMail Inbound Webhook (Public POST endpoint for ZeptoMail delivery telemetry)
		register_rest_route( $ns, '/zeptomail-webhook', [
			'methods'             => [ 'POST', 'GET' ],
			'callback'            => [ __CLASS__, 'handle_webhook' ],
			'permission_callback' => '__return_true',
		] );

		// 2. Fetch Paginated Email Logs & Telemetry
		register_rest_route( $ns, '/emails/logs', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_logs' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 3. Resend Transactional Email
		register_rest_route( $ns, '/emails/resend', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_resend_email' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 4. Clear Email Logs
		register_rest_route( $ns, '/emails/clear-logs', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_clear_logs' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 5. Purge Expired Logs
		register_rest_route( $ns, '/emails/purge-old', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_purge_old_logs' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );
	}

	/**
	 * Record Outbound Email Dispatch
	 */
	public static function log_outbound( array $args ): int {
		global $wpdb;
		self::ensure_table_exists();

		$table = self::get_table_name();

		$request_id      = sanitize_text_field( $args['request_id'] ?? '' );
		$message_id      = sanitize_text_field( $args['message_id'] ?? '' );
		$provider        = sanitize_key( $args['provider'] ?? 'zeptomail' );
		$event           = sanitize_key( $args['event'] ?? 'general' );
		$order_id        = ! empty( $args['order_id'] ) ? intval( $args['order_id'] ) : null;
		$recipient_email = sanitize_email( $args['recipient_email'] ?? '' );
		$recipient_name  = sanitize_text_field( $args['recipient_name'] ?? '' );
		$subject         = sanitize_text_field( $args['subject'] ?? '' );
		$status          = sanitize_key( $args['status'] ?? 'sent' );
		$status_code     = intval( $args['status_code'] ?? 200 );
		$latency_ms      = intval( $args['latency_ms'] ?? 0 );
		$error_message   = ! empty( $args['error_message'] ) ? sanitize_text_field( (string) $args['error_message'] ) : null;
		$bounce_reason   = ! empty( $args['bounce_reason'] ) ? sanitize_text_field( (string) $args['bounce_reason'] ) : null;

		$metadata = null;
		if ( ! empty( $args['metadata'] ) && is_array( $args['metadata'] ) ) {
			// Strip large binary attachments or raw HTML bodies before persisting to keep database lean
			$clean_meta = $args['metadata'];
			unset( $clean_meta['html'], $clean_meta['htmlbody'], $clean_meta['attachments'] );
			$metadata = wp_json_encode( $clean_meta );
		}

		$wpdb->insert(
			$table,
			[
				'request_id'      => $request_id,
				'message_id'      => $message_id,
				'provider'        => $provider,
				'event'           => $event,
				'order_id'        => $order_id,
				'recipient_email' => $recipient_email,
				'recipient_name'  => $recipient_name,
				'subject'         => $subject,
				'status'          => $status,
				'status_code'     => $status_code,
				'latency_ms'      => $latency_ms,
				'error_message'   => $error_message,
				'bounce_reason'   => $bounce_reason,
				'metadata'        => $metadata,
				'created_at'      => current_time( 'mysql' ),
			],
			[ '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s', '%s' ]
		);

		return (int) $wpdb->insert_id;
	}

	/**
	 * Update log row status when a webhook or async event arrives
	 */
	public static function update_status_by_request_id( string $request_id, string $status, array $extra = [] ): bool {
		global $wpdb;
		if ( empty( $request_id ) ) {
			return false;
		}

		$table = self::get_table_name();
		$update_data = [
			'status' => sanitize_key( $status ),
		];
		$format = [ '%s' ];

		if ( 'delivered' === $status ) {
			$update_data['delivered_at'] = current_time( 'mysql' );
			$format[] = '%s';
		} elseif ( 'opened' === $status ) {
			$update_data['opened_at'] = current_time( 'mysql' );
			$format[] = '%s';
		}

		if ( ! empty( $extra['bounce_reason'] ) ) {
			$update_data['bounce_reason'] = sanitize_text_field( (string) $extra['bounce_reason'] );
			$format[] = '%s';
		}

		if ( ! empty( $extra['message_id'] ) ) {
			$update_data['message_id'] = sanitize_text_field( (string) $extra['message_id'] );
			$format[] = '%s';
		}

		$updated = $wpdb->update(
			$table,
			$update_data,
			[ 'request_id' => $request_id ],
			$format,
			[ '%s' ]
		);

		return false !== $updated;
	}

	/**
	 * Handle Inbound ZeptoMail Webhook
	 * Supports delivery notifications, opens, clicks, and hard/soft bounces.
	 */
	public static function handle_webhook( WP_REST_Request $request ) {
		// If GET request, return health check / webhook verification
		if ( 'GET' === $request->get_method() ) {
			return rest_ensure_response( [
				'success' => true,
				'message' => 'ZeptoMail Webhook listener is active and ready.',
				'timestamp' => current_time( 'mysql' ),
			] );
		}

		$body = $request->get_json_params() ?: $request->get_params();
		if ( empty( $body ) ) {
			$raw = $request->get_body();
			$body = json_decode( $raw, true );
		}

		if ( empty( $body ) ) {
			return rest_ensure_response( [ 'success' => false, 'message' => 'Empty webhook payload.' ] );
		}

		// Normalize events: payload might be a single event dict or an array of event dicts
		$events = [];
		if ( isset( $body[0] ) && is_array( $body[0] ) ) {
			$events = $body;
		} elseif ( isset( $body['data'] ) && is_array( $body['data'] ) ) {
			$events = isset( $body['data'][0] ) ? $body['data'] : [ $body['data'] ];
		} else {
			$events = [ $body ];
		}

		global $wpdb;
		$table = self::get_table_name();
		$processed = 0;

		foreach ( $events as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			// ZeptoMail fields
			$raw_event   = strtolower( (string) ( $item['event_type'] ?? ( $item['event'] ?? ( $item['type'] ?? '' ) ) ) );
			$request_id  = (string) ( $item['request_id'] ?? ( $item['requestId'] ?? ( $item['client_reference'] ?? '' ) ) );
			$message_id  = (string) ( $item['message_id'] ?? ( $item['messageId'] ?? '' ) );
			$email_addr  = sanitize_email( (string) ( $item['email_address'] ?? ( $item['recipient'] ?? ( $item['to'] ?? '' ) ) ) );
			$reason      = (string) ( $item['reason'] ?? ( $item['bounce_reason'] ?? ( $item['description'] ?? ( $item['message'] ?? '' ) ) ) );

			// Map ZeptoMail event type to clean status
			$mapped_status = '';
			if ( strpos( $raw_event, 'deliver' ) !== false ) {
				$mapped_status = 'delivered';
			} elseif ( strpos( $raw_event, 'open' ) !== false ) {
				$mapped_status = 'opened';
			} elseif ( strpos( $raw_event, 'click' ) !== false ) {
				$mapped_status = 'clicked';
			} elseif ( strpos( $raw_event, 'bounce' ) !== false || strpos( $raw_event, 'soft_bounce' ) !== false || strpos( $raw_event, 'hard_bounce' ) !== false ) {
				$mapped_status = 'bounced';
			} elseif ( strpos( $raw_event, 'fail' ) !== false || strpos( $raw_event, 'reject' ) !== false ) {
				$mapped_status = 'failed';
			}

			if ( empty( $mapped_status ) ) {
				continue;
			}

			// Match row by request_id, or message_id, or fall back to most recent email for recipient
			$target_id = 0;
			if ( ! empty( $request_id ) ) {
				$target_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE request_id = %s ORDER BY id DESC LIMIT 1", $request_id ) );
			}
			if ( ! $target_id && ! empty( $message_id ) ) {
				$target_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE message_id = %s ORDER BY id DESC LIMIT 1", $message_id ) );
			}
			if ( ! $target_id && ! empty( $email_addr ) ) {
				$target_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE recipient_email = %s AND created_at >= NOW() - INTERVAL 2 DAY ORDER BY id DESC LIMIT 1", $email_addr ) );
			}

			if ( $target_id ) {
				$update_vals = [ 'status' => $mapped_status ];
				$formats     = [ '%s' ];

				if ( 'delivered' === $mapped_status ) {
					$update_vals['delivered_at'] = current_time( 'mysql' );
					$formats[] = '%s';
				} elseif ( 'opened' === $mapped_status ) {
					$update_vals['opened_at'] = current_time( 'mysql' );
					$formats[] = '%s';
				}

				if ( ! empty( $reason ) ) {
					$update_vals['bounce_reason'] = sanitize_text_field( $reason );
					$formats[] = '%s';
				}
				if ( ! empty( $message_id ) ) {
					$update_vals['message_id'] = sanitize_text_field( $message_id );
					$formats[] = '%s';
				}

				$wpdb->update( $table, $update_vals, [ 'id' => $target_id ], $formats, [ '%d' ] );
				$processed++;
			}
		}

		return rest_ensure_response( [
			'success'   => true,
			'processed' => $processed,
			'message'   => "Successfully processed {$processed} webhook event(s).",
		] );
	}

	/**
	 * REST: Query Paginated Logs & Aggregated Statistics
	 */
	public static function rest_get_logs( WP_REST_Request $request ) {
		global $wpdb;
		self::ensure_table_exists();

		$table  = self::get_table_name();
		$params = $request->get_params();

		$status   = sanitize_key( $params['status'] ?? 'all' );
		$event    = sanitize_key( $params['event'] ?? 'all' );
		$search   = sanitize_text_field( $params['search'] ?? '' );
		$order_id = ! empty( $params['order_id'] ) ? intval( $params['order_id'] ) : 0;
		$page     = max( 1, intval( $params['page'] ?? 1 ) );
		$limit    = min( 100, max( 10, intval( $params['limit'] ?? 25 ) ) );
		$offset   = ( $page - 1 ) * $limit;

		$where  = [ '1=1' ];
		$values = [];

		if ( ! empty( $status ) && 'all' !== $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		if ( ! empty( $event ) && 'all' !== $event ) {
			$where[]  = 'event = %s';
			$values[] = $event;
		}

		if ( $order_id > 0 ) {
			$where[]  = 'order_id = %d';
			$values[] = $order_id;
		}

		if ( ! empty( $search ) ) {
			$wildcard = '%' . $wpdb->esc_like( $search ) . '%';
			$where[]  = '(recipient_email LIKE %s OR recipient_name LIKE %s OR subject LIKE %s OR request_id LIKE %s OR order_id = %d)';
			$values[] = $wildcard;
			$values[] = $wildcard;
			$values[] = $wildcard;
			$values[] = $wildcard;
			$values[] = is_numeric( $search ) ? intval( $search ) : 0;
		}

		$where_clause = implode( ' AND ', $where );

		// 1. Get filtered total count
		$sql_count = "SELECT COUNT(*) FROM {$table} WHERE {$where_clause}";
		$total     = ! empty( $values )
			? (int) $wpdb->get_var( $wpdb->prepare( $sql_count, $values ) )
			: (int) $wpdb->get_var( $sql_count );

		// 2. Fetch log rows
		$sql_rows = "SELECT id, request_id, message_id, provider, event, order_id, recipient_email, recipient_name, subject, status, status_code, latency_ms, bounce_reason, error_message, metadata, created_at, updated_at, delivered_at, opened_at FROM {$table} WHERE {$where_clause} ORDER BY id DESC LIMIT %d OFFSET %d";
		$row_values = array_merge( $values, [ $limit, $offset ] );
		$raw_rows   = $wpdb->get_results( $wpdb->prepare( $sql_rows, $row_values ), ARRAY_A );

		$formatted_rows = array_map( function( $row ) {
			$meta = ! empty( $row['metadata'] ) ? json_decode( $row['metadata'], true ) : null;
			return [
				'id'              => (int) $row['id'],
				'request_id'      => $row['request_id'],
				'message_id'      => $row['message_id'],
				'provider'        => $row['provider'],
				'event'           => $row['event'],
				'order_id'        => $row['order_id'] ? (int) $row['order_id'] : null,
				'recipient_email' => $row['recipient_email'],
				'recipient_name'  => $row['recipient_name'],
				'subject'         => $row['subject'],
				'status'          => $row['status'],
				'status_code'     => (int) $row['status_code'],
				'latency_ms'      => (int) $row['latency_ms'],
				'bounce_reason'   => $row['bounce_reason'],
				'error_message'   => $row['error_message'],
				'metadata'        => $meta,
				'created_at'      => $row['created_at'],
				'delivered_at'    => $row['delivered_at'],
				'opened_at'       => $row['opened_at'],
			];
		}, $raw_rows ?: [] );

		// 3. Compute overall system telemetry statistics (last 30 days)
		$stats_sql = "SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
			SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
			SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked,
			SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
			SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
			AVG(latency_ms) as avg_latency
			FROM {$table} WHERE created_at >= NOW() - INTERVAL 30 DAY";
		$stats_raw = $wpdb->get_row( $stats_sql, ARRAY_A ) ?: [];

		$total_stat     = (int) ( $stats_raw['total'] ?? 0 );
		$delivered_stat = (int) ( $stats_raw['delivered'] ?? 0 );
		$opened_stat    = (int) ( $stats_raw['opened'] ?? 0 );
		$bounced_stat   = (int) ( $stats_raw['bounced'] ?? 0 );
		$failed_stat    = (int) ( $stats_raw['failed'] ?? 0 );
		$avg_latency    = round( (float) ( $stats_raw['avg_latency'] ?? 0 ) );

		$delivery_rate = $total_stat > 0 ? round( ( ( $delivered_stat + $opened_stat ) / $total_stat ) * 100, 1 ) : 100.0;
		$open_rate     = ( $delivered_stat + $opened_stat ) > 0 ? round( ( $opened_stat / ( $delivered_stat + $opened_stat ) ) * 100, 1 ) : 0.0;

		return rest_ensure_response( [
			'success'     => true,
			'logs'        => $formatted_rows,
			'total'       => $total,
			'page'        => $page,
			'limit'       => $limit,
			'total_pages' => ceil( $total / $limit ),
			'stats'       => [
				'total'         => $total_stat,
				'delivered'     => $delivered_stat,
				'opened'        => $opened_stat,
				'clicked'       => (int) ( $stats_raw['clicked'] ?? 0 ),
				'sent'          => (int) ( $stats_raw['sent'] ?? 0 ),
				'bounced'       => $bounced_stat,
				'failed'        => $failed_stat,
				'delivery_rate' => $delivery_rate,
				'open_rate'     => $open_rate,
				'avg_latency_ms'=> $avg_latency,
			],
			'webhook_url' => rest_url( 'exacoat-core/v1/zeptomail-webhook' ),
		] );
	}

	/**
	 * REST: Resend an Email from Log
	 */
	public static function rest_resend_email( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();
		$log_id = intval( $params['log_id'] ?? 0 );

		if ( ! $log_id ) {
			return rest_ensure_response( [ 'success' => false, 'message' => 'Missing log_id parameter.' ] );
		}

		global $wpdb;
		$table = self::get_table_name();
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $log_id ), ARRAY_A );

		if ( ! $row ) {
			return rest_ensure_response( [ 'success' => false, 'message' => 'Email log not found.' ] );
		}

		$event           = $row['event'];
		$recipient_email = $row['recipient_email'];
		$recipient_name  = $row['recipient_name'];
		$meta            = ! empty( $row['metadata'] ) ? json_decode( $row['metadata'], true ) : [];

		if ( ! class_exists( 'Exacoat_Email_Engine' ) ) {
			return rest_ensure_response( [ 'success' => false, 'message' => 'Email engine is not available.' ] );
		}

		// Re-dispatch using email engine
		$res = Exacoat_Email_Engine::send_email( $event, $recipient_email, $recipient_name, (array) $meta );

		return rest_ensure_response( [
			'success' => $res['success'] ?? false,
			'message' => $res['message'] ?? ( $res['success'] ? 'Email re-sent successfully.' : 'Failed to re-send email.' ),
			'result'  => $res,
		] );
	}

	/**
	 * REST: Clear All Email Logs
	 */
	public static function rest_clear_logs() {
		global $wpdb;
		$table = self::get_table_name();
		$wpdb->query( "TRUNCATE TABLE {$table}" );

		return rest_ensure_response( [
			'success' => true,
			'message' => 'All email telemetry logs have been cleared.',
		] );
	}

	/**
	 * REST: Purge Old Logs
	 */
	public static function rest_purge_old_logs( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();
		$days   = max( 1, intval( $params['days'] ?? 60 ) );
		$purged = self::purge_expired_logs( $days );

		return rest_ensure_response( [
			'success' => true,
			'purged'  => $purged,
			'message' => "Purged {$purged} email logs older than {$days} days.",
		] );
	}

	/**
	 * Purge logs older than X days
	 */
	public static function purge_expired_logs( int $days = 60 ): int {
		global $wpdb;
		$table = self::get_table_name();
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < NOW() - INTERVAL %d DAY", $days ) );
	}
}

Exacoat_Email_Logger::init();

}
