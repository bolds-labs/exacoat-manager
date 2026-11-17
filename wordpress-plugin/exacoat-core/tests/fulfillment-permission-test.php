<?php

define( 'ABSPATH', __DIR__ . '/' );

class WP_REST_Request {
	private $headers;

	public function __construct( array $headers = [] ) {
		$this->headers = array_change_key_case( $headers );
	}

	public function get_header( string $name ) {
		return $this->headers[ strtolower( $name ) ] ?? null;
	}
}

class WP_User {
	public $capabilities;

	public function __construct( array $capabilities ) {
		$this->capabilities = $capabilities;
	}
}

class WP_Session_Tokens {
	public static function get_instance( int $user_id ): self {
		return new self();
	}

	public function verify( string $token ): bool {
		return $token === 'fixture-session';
	}
}

$routes = [];
$current_user = new WP_User( [] );
$bridge_secret = '';
$users = [
	1 => new WP_User( [ 'manage_woocommerce' ] ),
	2 => new WP_User( [ 'edit_shop_orders' ] ),
	3 => new WP_User( [ 'read' ] ),
];

function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['routes'][ $namespace ][ $route ] = $args;
}

function user_can( WP_User $user, string $capability ): bool {
	return in_array( $capability, $user->capabilities, true );
}

function current_user_can( string $capability ): bool {
	return user_can( $GLOBALS['current_user'], $capability );
}

function get_user_by( string $field, int $id ) {
	return $GLOBALS['users'][ $id ] ?? false;
}

function get_option( string $name ) {
	return $name === 'exacoat_bridge_secret' ? $GLOBALS['bridge_secret'] : false;
}

require_once __DIR__ . '/../includes/class-customer-auth.php';
require_once __DIR__ . '/../includes/class-export-manager.php';
require_once __DIR__ . '/../includes/class-goorita-service.php';
require_once __DIR__ . '/../includes/class-rayspeed-service.php';

Exacoat_Export_Manager::register_rest_routes();
Exacoat_Goorita_Service::register_rest_routes();
Exacoat_Rayspeed_Service::register_rest_routes();

foreach ( [ 'exacoat-core/v1', 'exacoat/v1' ] as $namespace ) {
	$routes_to_check = [
		'/exports/status'                              => false,
		'/exports/generate-jne'                        => false,
		'/exports/pending-goorita-orders'              => false,
		'/orders/(?P<id>\d+)/goorita-text'               => false,
		'/shipping/goorita/status'                     => false,
		'/shipping/goorita/create-awb'                 => false,
		'/shipping/rayspeed/status'                    => true,
		'/shipping/rayspeed/destinations'              => true,
		'/shipping/rayspeed/track/(?P<awb>[a-zA-Z0-9_-]+)' => true,
		'/shipping/rayspeed/create-awb'                => true,
	];
	foreach ( $routes_to_check as $route => $allows_order_editor ) {
		$permission = $routes[ $namespace ][ $route ]['permission_callback'] ?? null;
		if ( ! is_callable( $permission ) ) {
			throw new RuntimeException( "Missing permission callback for {$namespace}{$route}" );
		}
		$cases = [
			'anonymous' => [ [], [], '', false ],
			'customer' => [ [], [ 'Authorization' => 'Bearer 3.fixture-session' ], '', false ],
			'invalid session' => [ [], [ 'Authorization' => 'Bearer 1.invalid' ], '', false ],
			'WordPress staff' => [ [ 'manage_woocommerce' ], [], '', true ],
			'staff session' => [ [], [ 'Authorization' => 'Bearer 1.fixture-session' ], '', true ],
			'order editor' => [ [ 'edit_shop_orders' ], [], '', $allows_order_editor ],
			'order editor session' => [ [], [ 'Authorization' => 'Bearer 2.fixture-session' ], '', $allows_order_editor ],
			'unconfigured bridge' => [ [], [ 'X-Exacoat-Secret' => 'fixture-secret' ], '', false ],
			'wrong bridge secret' => [ [], [ 'X-Exacoat-Secret' => 'incorrect-secret' ], 'fixture-secret', false ],
			'configured bridge' => [ [], [ 'X-Exacoat-Secret' => 'fixture-secret' ], 'fixture-secret', true ],
			'configured bridge with legacy header' => [ [], [ 'x_exacoat_secret' => 'fixture-secret' ], 'fixture-secret', true ],
		];
		foreach ( $cases as $label => [ $capabilities, $headers, $bridge_secret, $expected ] ) {
			$current_user = new WP_User( $capabilities );
			if ( $permission( new WP_REST_Request( $headers ) ) !== $expected ) {
				throw new RuntimeException( "Unexpected {$label} permission for {$namespace}{$route}" );
			}
		}
	}
}

echo "Fulfillment permissions passed for both REST namespaces.\n";
