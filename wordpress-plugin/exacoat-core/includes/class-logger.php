<?php
/**
 * Artmatter Core Enterprise System Logger & Telemetry Engine
 * High-performance database logger with 7-day auto-prune retention, filtering & real-time telemetry.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Logger' ) ) {

class Exacoat_Logger {

	private static $table_name = 'exacoat_logs';

	public static function get_table_name(): string {
		global $wpdb;
		$table = $wpdb->prefix . self::$table_name;
		// Fallback to legacy table if it exists and new table does not
		if ( $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) ) !== $table ) {
			$legacy = $wpdb->prefix . 'artmatter_logs';
			if ( $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $legacy ) ) === $legacy ) {
				return $legacy;
			}
		}
		return $table;
	}

	public static function init() {
		self::ensure_table_exists();

		// Intercept frontend fatal error screen with Exacoat recovery screen & telemetry
		add_filter( 'wp_die_handler', [ __CLASS__, 'get_wp_die_handler' ], 99 );
		register_shutdown_function( [ __CLASS__, 'handle_fatal_shutdown' ] );
		set_exception_handler( [ __CLASS__, 'handle_uncaught_exception' ] );

		// AJAX endpoints for admin log viewer
		add_action( 'wp_ajax_exacoat_get_logs', [ __CLASS__, 'ajax_get_logs' ] );
		add_action( 'wp_ajax_artmatter_get_logs', [ __CLASS__, 'ajax_get_logs' ] );
		add_action( 'wp_ajax_exacoat_clear_logs', [ __CLASS__, 'ajax_clear_logs' ] );
		add_action( 'wp_ajax_artmatter_clear_logs', [ __CLASS__, 'ajax_clear_logs' ] );

		// Daily automatic log cleanup hook
		add_action( 'exacoat_daily_log_cleanup', [ __CLASS__, 'purge_expired_logs' ] );
		add_action( 'artmatter_daily_log_cleanup', [ __CLASS__, 'purge_expired_logs' ] );
		if ( function_exists( 'as_has_scheduled_action' ) && ! as_has_scheduled_action( 'exacoat_daily_log_cleanup' ) ) {
			as_schedule_recurring_action( time() + 3600, DAY_IN_SECONDS, 'exacoat_daily_log_cleanup', [], 'exacoat-logs' );
		}
	}

	private static $table_verified = false;

	/**
	 * Create or Update wp_artmatter_logs Table Schema
	 */
	public static function ensure_table_exists() {
		if ( self::$table_verified ) {
			return;
		}

		if ( get_option( '_artmatter_logs_table_v1' ) ) {
			self::$table_verified = true;
			return;
		}

		global $wpdb;
		$table = self::get_table_name();

		if ( $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) ) !== $table ) {
			if ( file_exists( ABSPATH . 'wp-admin/includes/upgrade.php' ) ) {
				require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			}
			$charset_collate = $wpdb->get_charset_collate();

			$sql = "CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				level varchar(20) NOT NULL DEFAULT 'info',
				channel varchar(50) NOT NULL DEFAULT 'general',
				message text NOT NULL,
				context longtext DEFAULT NULL,
				PRIMARY KEY (id),
				KEY created_at (created_at),
				KEY level (level),
				KEY channel (channel)
			) {$charset_collate};";

			if ( function_exists( 'dbDelta' ) ) {
				dbDelta( $sql );
			}
		}

		update_option( '_artmatter_logs_table_v1', '1', true );
		self::$table_verified = true;
	}

	/**
	 * Log an event with level, channel, message, and optional context
	 */
	public static function log( string $level, string $channel, string $message, $context = [] ) {
		global $wpdb;
		$table = self::get_table_name();

		$encoded_context = null;
		if ( ! empty( $context ) ) {
			$encoded_context = is_string( $context ) ? $context : wp_json_encode( $context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		}

		$wpdb->insert(
			$table,
			[
				'created_at' => current_time( 'mysql' ),
				'level'      => sanitize_key( $level ),
				'channel'    => sanitize_key( $channel ),
				'message'    => wp_strip_all_tags( $message ),
				'context'    => $encoded_context,
			],
			[ '%s', '%s', '%s', '%s', '%s' ]
		);

		// Mirror to WooCommerce Logger if available
		if ( function_exists( 'wc_get_logger' ) ) {
			$wc_logger  = wc_get_logger();
			$wc_context = [ 'source' => 'exacoat-' . $channel ];
			if ( $level === 'error' ) {
				$wc_logger->error( $message, $wc_context );
			} elseif ( $level === 'warning' ) {
				$wc_logger->warning( $message, $wc_context );
			} else {
				$wc_logger->info( $message, $wc_context );
			}
		}

		// 1% probabilistic cleanup during writes to keep database lightweight
		if ( mt_rand( 1, 100 ) === 1 ) {
			self::purge_expired_logs();
		}
	}

	public static function info( string $channel, string $message, $context = [] ) {
		self::log( 'info', $channel, $message, $context );
	}

	public static function success( string $channel, string $message, $context = [] ) {
		self::log( 'success', $channel, $message, $context );
	}

	public static function warning( string $channel, string $message, $context = [] ) {
		self::log( 'warning', $channel, $message, $context );
	}

	public static function error( string $channel, string $message, $context = [] ) {
		self::log( 'error', $channel, $message, $context );
	}

	/**
	 * Purge logs older than 7 days
	 */
	public static function purge_expired_logs(): int {
		global $wpdb;
		$table = self::get_table_name();
		return (int) $wpdb->query( "DELETE FROM {$table} WHERE created_at < NOW() - INTERVAL 7 DAY" );
	}

	/**
	 * Query Logs for Admin Dashboard
	 */
	public static function get_logs( array $args = [] ): array {
		global $wpdb;
		$table = self::get_table_name();

		$level   = sanitize_key( $args['level'] ?? '' );
		$channel = sanitize_key( $args['channel'] ?? '' );
		$search  = sanitize_text_field( $args['search'] ?? '' );
		$limit   = min( 200, max( 10, (int) ( $args['limit'] ?? 100 ) ) );
		$offset  = max( 0, (int) ( $args['offset'] ?? 0 ) );

		$where   = [ '1=1' ];
		$params  = [];

		if ( ! empty( $level ) && $level !== 'all' ) {
			$where[]  = 'level = %s';
			$params[] = $level;
		}

		if ( ! empty( $channel ) && $channel !== 'all' ) {
			$where[]  = 'channel = %s';
			$params[] = $channel;
		}

		if ( ! empty( $search ) ) {
			$where[]  = '(message LIKE %s OR context LIKE %s)';
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$params[] = $like;
			$params[] = $like;
		}

		$where_clause = implode( ' AND ', $where );

		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_clause}";
		$total     = ! empty( $params ) ? (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) ) : (int) $wpdb->get_var( $count_sql );

		$query_sql = "SELECT id, created_at, level, channel, message, context FROM {$table} WHERE {$where_clause} ORDER BY id DESC LIMIT %d OFFSET %d";
		$params[]  = $limit;
		$params[]  = $offset;

		$rows = $wpdb->get_results( $wpdb->prepare( $query_sql, $params ), ARRAY_A );

		// Stats
		$stats = [
			'total'    => $total,
			'errors'   => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE level = 'error'" ),
			'warnings' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE level = 'warning'" ),
			'success'  => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE level = 'success'" ),
			'info'     => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE level = 'info'" ),
		];

		return [
			'logs'  => $rows ?: [],
			'stats' => $stats,
		];
	}

	/**
	 * AJAX Handler for Fetching Logs
	 */
	public static function ajax_get_logs() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$data = self::get_logs( [
			'level'   => $_GET['level'] ?? 'all',
			'channel' => $_GET['channel'] ?? 'all',
			'search'  => $_GET['search'] ?? '',
			'limit'   => $_GET['limit'] ?? 100,
		] );

		wp_send_json_success( $data );
	}

	/**
	 * AJAX Handler for Clearing Logs
	 */
	public static function ajax_clear_logs() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		global $wpdb;
		$table = self::get_table_name();
		$wpdb->query( "TRUNCATE TABLE {$table}" );

		self::info( 'system', 'Log buffer cleared by Administrator' );

		wp_send_json_success( [ 'message' => 'Logs cleared successfully' ] );
	}

	public static function get_wp_die_handler( $handler = null ) {
		// Do not intercept AJAX, REST API, CLI, WP Admin, or Bricks Builder requests
		if ( wp_doing_ajax() || 
		     ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || 
		     ( defined( 'WP_CLI' ) && WP_CLI ) || 
		     is_admin() ||
		     isset( $_GET['bricks'] ) || 
		     isset( $_GET['brickspreview'] ) || 
		     ( function_exists( 'bricks_is_builder' ) && bricks_is_builder() ) ||
		     ( function_exists( 'bricks_is_builder_main' ) && bricks_is_builder_main() )
		) {
			return $handler ?: '_default_wp_die_handler';
		}
		return [ __CLASS__, 'render_artmatter_error_screen' ];
	}

	/**
	 * PHP Fatal Shutdown Interceptor & Telemetry Dispatcher
	 */
	public static function handle_fatal_shutdown() {
		$error = error_get_last();
		if ( $error && in_array( $error['type'], [ E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR ], true ) ) {
			$uri = $_SERVER['REQUEST_URI'] ?? 'CLI';
			$msg = sprintf( "PHP Fatal [%s]: %s in %s on line %d", $error['type'], $error['message'], $error['file'], $error['line'] );
			
			self::error( 'fatal', $msg, [
				'error'      => $error,
				'uri'        => $uri,
				'user_id'    => get_current_user_id(),
				'ip'         => $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN',
				'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN',
			] );

			if ( class_exists( 'Artmatter_Pushover_Service' ) ) {
				Artmatter_Pushover_Service::send(
					'🚨 Artmatter Fatal Error Caught',
					"URI: {$uri}\n{$error['message']}\nFile: " . basename( $error['file'] ) . ":{$error['line']}",
					[ 'priority' => 1 ]
				);
			}
		}
	}

	/**
	 * Uncaught Exception Telemetry Handler
	 */
	public static function handle_uncaught_exception( \Throwable $e ) {
		$uri = $_SERVER['REQUEST_URI'] ?? 'CLI';
		$msg = sprintf( "Uncaught %s: %s in %s on line %d", get_class( $e ), $e->getMessage(), $e->getFile(), $e->getLine() );
		
		self::error( 'exception', $msg, [
			'exception'  => get_class( $e ),
			'message'    => $e->getMessage(),
			'file'       => $e->getFile(),
			'line'       => $e->getLine(),
			'trace'      => $e->getTraceAsString(),
			'uri'        => $uri,
			'user_id'    => get_current_user_id(),
		] );

		if ( class_exists( 'Exacoat_Pushover_Service' ) ) {
			Exacoat_Pushover_Service::send(
				'⚠️ Exacoat Uncaught Exception',
				"URI: {$uri}\n{$e->getMessage()}\nFile: " . basename( $e->getFile() ) . ":{$e->getLine()}",
				[ 'priority' => 1 ]
			);
		} elseif ( class_exists( 'Artmatter_Pushover_Service' ) ) {
			Artmatter_Pushover_Service::send(
				'⚠️ Exacoat Uncaught Exception',
				"URI: {$uri}\n{$e->getMessage()}\nFile: " . basename( $e->getFile() ) . ":{$e->getLine()}",
				[ 'priority' => 1 ]
			);
		}

		if ( ! wp_doing_ajax() && ! ( defined( 'REST_REQUEST' ) && REST_REQUEST ) && ! is_admin() && ! isset( $_GET['bricks'] ) && ! isset( $_GET['brickspreview'] ) && ( ! function_exists( 'bricks_is_builder' ) || ! bricks_is_builder() ) ) {
			self::render_exacoat_error_screen( $e->getMessage(), 'An unexpected error occurred' );
		}
	}

	public static function render_artmatter_error_screen( $message = '', $title = '', $args = [] ) {
		self::render_exacoat_error_screen( $message, $title, $args );
	}

	/**
	 * High-resolution Exacoat Dark Wordmark Data URI (Offline & Localhost Safe)
	 */
	public static function get_logo_data_uri(): string {
		return 'data:image/png;base64,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';
	}

	/**
	 * Exacoat Error Screen (Replaces Generic WordPress Fatal Page on Frontend)
	 */
	public static function render_exacoat_error_screen( $message = '', $title = '', $args = [] ) {
		// If in AJAX, REST, Admin, or Bricks Builder, pass directly to default WordPress handler
		if ( wp_doing_ajax() || 
		     ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || 
		     is_admin() ||
		     isset( $_GET['bricks'] ) || 
		     isset( $_GET['brickspreview'] ) || 
		     ( function_exists( 'bricks_is_builder' ) && bricks_is_builder() ) ||
		     ( function_exists( 'bricks_is_builder_main' ) && bricks_is_builder_main() )
		) {
			if ( function_exists( '_default_wp_die_handler' ) ) {
				_default_wp_die_handler( $message, $title, $args );
				return;
			}
		}

		if ( ! headers_sent() ) {
			status_header( 500 );
			header( 'Content-Type: text/html; charset=utf-8' );
		}

		$incident_code = 'EXA-' . strtoupper( substr( md5( (string) microtime( true ) . ( $_SERVER['REQUEST_URI'] ?? '' ) ), 0, 8 ) );
		$is_admin = current_user_can( 'manage_options' );
		$home_url = function_exists( 'home_url' ) ? home_url( '/' ) : '/';

		if ( ! empty( $message ) ) {
			self::error( 'screen_rendered', is_string( $message ) ? $message : 'Fatal Screen Rendered', [
				'incident' => $incident_code,
				'uri'      => $_SERVER['REQUEST_URI'] ?? '',
			] );
		}

		header( 'Cache-Control: no-cache, no-store, must-revalidate, max-age=0' );
		header( 'Pragma: no-cache' );
		header( 'Expires: Wed, 11 Jan 1984 05:00:00 GMT' );
		?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Exacoat Error</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			background-color: #09090b;
			color: #f4f4f5;
			font-family: "Neue Haas Display", "Neue Haas Grotesk Text Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
			line-height: 1.6;
			overflow-x: hidden;
		}
		.exacoat-error-card, .artmatter-error-card {
			background: #121214;
			border: 1px solid rgba(255, 255, 255, 0.1);
			box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
			border-radius: 16px;
			max-width: 520px;
			width: 100%;
			padding: 40px 32px;
			text-align: center;
		}
		.exacoat-logo-wrap, .artmatter-logo-wrap {
			margin-bottom: 28px;
			display: flex;
			justify-content: center;
			align-items: center;
		}
		h1 {
			font-size: 20px;
			font-weight: 600;
			color: #ffffff;
			letter-spacing: -0.01em;
			margin-bottom: 10px;
		}
		p {
			font-size: 14px;
			color: #a1a1aa;
			margin-bottom: 28px;
			line-height: 1.5;
		}
		.actions {
			display: flex;
			flex-direction: column;
			gap: 10px;
			margin-bottom: 24px;
		}
		.btn-primary {
			background: #ffffff;
			color: #09090b;
			font-weight: 600;
			font-size: 13.5px;
			padding: 12px 20px;
			border-radius: 8px;
			text-decoration: none;
			border: none;
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			transition: all 0.15s ease;
		}
		.btn-primary:hover {
			background: #e4e4e7;
		}
		.btn-secondary {
			background: rgba(255, 255, 255, 0.06);
			color: #d4d4d8;
			font-weight: 500;
			font-size: 13.5px;
			padding: 12px 20px;
			border-radius: 8px;
			text-decoration: none;
			border: 1px solid rgba(255, 255, 255, 0.1);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			transition: all 0.15s ease;
		}
		.btn-secondary:hover {
			background: rgba(255, 255, 255, 0.1);
			color: #ffffff;
		}
		.incident-bar {
			padding-top: 18px;
			border-top: 1px solid rgba(255, 255, 255, 0.07);
			font-size: 11px;
			color: #71717a;
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		}
		.admin-debug-box {
			margin-top: 18px;
			padding: 12px;
			background: rgba(239, 68, 68, 0.1);
			border: 1px solid rgba(239, 68, 68, 0.25);
			border-radius: 8px;
			text-align: left;
			font-size: 11.5px;
			color: #fca5a5;
			font-family: monospace;
			max-height: 180px;
			overflow-y: auto;
			word-break: break-all;
		}
	</style>
</head>
<body>
	<div class="exacoat-error-card">
		<div class="exacoat-logo-wrap">
			<img src="<?php echo esc_attr( self::get_logo_data_uri() ); ?>" alt="Exacoat" style="height:32px;width:auto;display:inline-block;filter:brightness(0) invert(1);" />
		</div>

		<h1>An unexpected error occurred</h1>
		<p>We encountered a problem loading this page. Our technical team has been notified.</p>

		<div class="actions">
			<button onclick="window.location.reload();" class="btn-primary">
				Reload Page
			</button>
			<a href="<?php echo esc_url( $home_url ); ?>" class="btn-secondary">Return to Homepage</a>
		</div>

		<div class="incident-bar">
			Error Reference: <strong><?php echo esc_html( $incident_code ); ?></strong>
		</div>

		<?php if ( $is_admin && ! empty( $message ) ) : ?>
			<div class="admin-debug-box">
				<strong>Administrator Diagnostics:</strong><br>
				<?php echo is_string( $message ) ? esc_html( $message ) : esc_html( wp_json_encode( $message ) ); ?>
			</div>
		<?php endif; ?>
	</div>
</body>
</html>
		<?php
		exit;
	}
}

}

if ( ! class_exists( 'Artmatter_Logger' ) ) {
	class_alias( 'Exacoat_Logger', 'Artmatter_Logger' );
}

