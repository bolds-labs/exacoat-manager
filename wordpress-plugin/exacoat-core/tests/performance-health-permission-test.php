<?php

define( 'ABSPATH', __DIR__ . '/' );

class WP_REST_Request {
	private $headers;

	public function __construct( array $headers = [] ) {
		$this->headers = $headers;
	}

	public function get_header( string $name ) {
		return $this->headers[ $name ] ?? null;
	}

	public function get_param( string $name ) {
		return null;
	}
}

$routes = [];
$is_admin = false;

function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['routes'][ $namespace . $route ] = $args;
}

function current_user_can( $capability ) {
	return $GLOBALS['is_admin'] && $capability === 'manage_options';
}

function get_option( $name, $default = false ) {
	return $name === 'exacoat_core_settings' ? [ 'webhook_secret' => 'test-bridge-secret' ] : $default;
}

require_once __DIR__ . '/../includes/class-exacoat-core.php';
require_once __DIR__ . '/../includes/class-performance-auditor.php';

Exacoat_Performance_Auditor::register_rest_routes();

foreach ( [ 'exacoat-core/v1', 'exacoat/v1' ] as $namespace ) {
	$route = $namespace . '/performance/health';
	$permission = $routes[ $route ]['permission_callback'] ?? null;
	if ( ! is_callable( $permission ) ) {
		throw new RuntimeException( "Missing permission callback for {$route}" );
	}

	$is_admin = false;
	if ( false !== $permission( new WP_REST_Request() ) ) {
		throw new RuntimeException( "Anonymous request admitted for {$route}" );
	}
	if ( true !== $permission( new WP_REST_Request( [ 'X-Exacoat-Secret' => 'test-bridge-secret' ] ) ) ) {
		throw new RuntimeException( "Valid bridge request rejected for {$route}" );
	}

	$is_admin = true;
	if ( true !== $permission( new WP_REST_Request() ) ) {
		throw new RuntimeException( "WordPress administrator rejected for {$route}" );
	}
}

echo "Performance health permissions passed for both REST namespaces.\n";
