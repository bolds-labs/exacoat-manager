<?php
/**
 * Exacoat Configurator Engine
 *
 * Manages global finishes inventory, materials stock availability,
 * dynamic configurator data injection, and composable device profiles.
 *
 * @package Exacoat_Core
 * @version 0.0.9
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Configurator_Engine' ) ) {

class Exacoat_Configurator_Engine {

	const OPTION_KEY = 'exacoat_global_finishes';
	const LEGACY_OPTION_KEY = 'artmatter_global_finishes';
	const PROFILE_META_KEY = '_exacoat_configurator_profile';

	private static $cached_finishes = null;

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// Hook into WooCommerce product REST response and data loading
		add_filter( 'woocommerce_rest_prepare_product_object', [ __CLASS__, 'enrich_wc_product_configurator_meta' ], 10, 3 );
	}

	/**
	 * Default initial finish database
	 */
	public static function get_default_finishes(): array {
		return [
			// Signature skins
			[
				'id'          => 'swarm',
				'slug'        => 'swarm',
				'name'        => 'Swarm',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-swarm',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Swarm-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => true,
			],
			[
				'id'          => 'black-camo',
				'slug'        => 'black-camo',
				'name'        => 'Black Camo',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-black-camo',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => true,
			],
			[
				'id'          => 'patina',
				'slug'        => 'patina',
				'name'        => 'Patina',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-patina',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Patina-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => true,
			],
			[
				'id'          => 'slate',
				'slug'        => 'slate',
				'name'        => 'Slate',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-slate',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Slate-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => true,
			],
			[
				'id'          => 'dragon-black',
				'slug'        => 'dragon-black',
				'name'        => 'Dragon Black',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-dragon-black',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Dragon-Black-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'carbon-fiber-black',
				'slug'        => 'carbon-fiber-black',
				'name'        => 'Carbon Fiber Black',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-carbon-fiber-black',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Carbon-Fiber-Black-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'forged-carbon',
				'slug'        => 'forged-carbon',
				'name'        => 'Forged Carbon',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-forged-carbon',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Forged-Carbon-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => true,
			],
			[
				'id'          => 'woven',
				'slug'        => 'woven',
				'name'        => 'Woven',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-woven',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Woven-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => true,
			],

			// Colors
			[
				'id'          => 'matte-black',
				'slug'        => 'matte-black',
				'name'        => 'Matte Black',
				'group'       => 'Colors',
				'class_name'  => 'cfg-matte-black',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Matte-Black-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'matte-white',
				'slug'        => 'matte-white',
				'name'        => 'Matte White',
				'group'       => 'Colors',
				'class_name'  => 'cfg-matte-white',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Matte-White-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'arctic-blue',
				'slug'        => 'arctic-blue',
				'name'        => 'Arctic Blue',
				'group'       => 'Colors',
				'class_name'  => 'cfg-arctic-blue',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Arctic-Blue-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'glacial-green',
				'slug'        => 'glacial-green',
				'name'        => 'Glacial Green',
				'group'       => 'Colors',
				'class_name'  => 'cfg-glacial-green',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Glacial-Green-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'mellow-yellow',
				'slug'        => 'mellow-yellow',
				'name'        => 'Mellow Yellow',
				'group'       => 'Colors',
				'class_name'  => 'cfg-mellow-yellow',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Mellow-Yellow-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'petal-pink',
				'slug'        => 'petal-pink',
				'name'        => 'Petal Pink',
				'group'       => 'Colors',
				'class_name'  => 'cfg-petal-pink',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Petal-Pink-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'blush-pink',
				'slug'        => 'blush-pink',
				'name'        => 'Blush Pink',
				'group'       => 'Colors',
				'class_name'  => 'cfg-blush-pink',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Blush-Pink-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'emerald-green',
				'slug'        => 'emerald-green',
				'name'        => 'Emerald Green',
				'group'       => 'Colors',
				'class_name'  => 'cfg-emerald-green',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Emerald-Green-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'lust-red',
				'slug'        => 'lust-red',
				'name'        => 'Lust Red',
				'group'       => 'Colors',
				'class_name'  => 'cfg-lust-red',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Lust-Red-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'lemon-yellow',
				'slug'        => 'lemon-yellow',
				'name'        => 'Lemon Yellow',
				'group'       => 'Colors',
				'class_name'  => 'cfg-lemon-yellow',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Lemon-Yellow-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],

			// Natural
			[
				'id'          => 'marble-white',
				'slug'        => 'marble-white',
				'name'        => 'Marble White',
				'group'       => 'Natural',
				'class_name'  => 'cfg-marble-white',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Marble-White-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'leather-black',
				'slug'        => 'leather-black',
				'name'        => 'Leather Black',
				'group'       => 'Natural',
				'class_name'  => 'cfg-leather-black',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Leather-Black-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
			[
				'id'          => 'titanium-black',
				'slug'        => 'titanium-black',
				'name'        => 'Titanium Black',
				'group'       => 'Natural',
				'class_name'  => 'cfg-titanium-black',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Titanium-Black-Texture-Thumbnail.jpg',
				'extra_price' => 0,
				'in_stock'    => true,
			],
		];
	}

	/**
	 * Get all global finishes
	 */
	public static function get_finishes(): array {
		if ( self::$cached_finishes !== null ) {
			return self::$cached_finishes;
		}

		$finishes = get_option( self::OPTION_KEY, null );
		if ( $finishes === null ) {
			$finishes = get_option( self::LEGACY_OPTION_KEY, null );
		}

		if ( empty( $finishes ) || ! is_array( $finishes ) ) {
			$finishes = self::get_default_finishes();
			update_option( self::OPTION_KEY, $finishes );
			update_option( self::LEGACY_OPTION_KEY, $finishes );
		}

		self::$cached_finishes = $finishes;
		return self::$cached_finishes;
	}

	/**
	 * Save global finishes list
	 */
	public static function save_finishes( array $finishes ): bool {
		self::$cached_finishes = $finishes;
		update_option( self::OPTION_KEY, $finishes );
		update_option( self::LEGACY_OPTION_KEY, $finishes );
		return true;
	}

	/**
	 * Map finishes by slug, id, and class_name for fast lookup
	 */
	public static function get_finish_lookup_map(): array {
		$finishes = self::get_finishes();
		$map = [];

		foreach ( $finishes as $f ) {
			$id = $f['id'] ?? '';
			$slug = $f['slug'] ?? $id;
			$cls = trim( $f['class_name'] ?? '' );
			$name = strtolower( trim( $f['name'] ?? '' ) );

			if ( $id ) {
				$map[ $id ] = $f;
			}
			if ( $slug ) {
				$map[ $slug ] = $f;
			}
			if ( $cls ) {
				$map[ $cls ] = $f;
				$unprefixed = preg_replace( '/^cfg-/', '', $cls );
				if ( $unprefixed ) {
					$map[ $unprefixed ] = $f;
				}
			}
			if ( $name ) {
				$map[ $name ] = $f;
			}
		}

		return $map;
	}

	/**
	 * Register REST routes
	 */
	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat-core/v1', 'artmatter-core/v1' ];

		$register = function( string $route, array $args ) use ( $namespaces ) {
			foreach ( $namespaces as $namespace ) {
				register_rest_route( $namespace, $route, $args );
			}
		};

		// 1. GET /finishes: Fetch all global finishes and stock statuses
		$register( '/finishes', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_finishes' ],
			'permission_callback' => '__return_true',
		] );

		// 2. POST /finishes/toggle-stock: Toggle in_stock status for a finish
		$register( '/finishes/toggle-stock', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_toggle_finish_stock' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
			'args'                => [
				'id' => [
					'required'          => true,
					'sanitize_callback' => 'sanitize_text_field',
				],
				'in_stock' => [
					'required' => true,
					'type'     => 'boolean',
				],
			],
		] );

		// 3. POST /finishes/save: Add or update a finish
		$register( '/finishes/save', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_finish' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 4. GET /configurator/profiles: List all products and their configurator profiles
		$register( '/configurator/profiles', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_configurator_profiles' ],
			'permission_callback' => '__return_true',
		] );

		// 5. GET /configurator/(?P<id_or_slug>[a-zA-Z0-9_-]+): Fetch normalized product configurator profile
		$register( '/configurator/(?P<id_or_slug>[a-zA-Z0-9_-]+)', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_product_configurator' ],
			'permission_callback' => '__return_true',
		] );

		// 6. POST /configurator/save: Save/update a device profile
		$register( '/configurator/save', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_product_configurator' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 7. POST /configurator/batch-migrate: Convert all MKL products to modern profile
		$register( '/configurator/batch-migrate', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_batch_migrate' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );
	}

	public static function verify_permission( WP_REST_Request $request ): bool {
		if ( class_exists( 'Exacoat_Core' ) && method_exists( 'Exacoat_Core', 'verify_bridge_permission' ) ) {
			return Exacoat_Core::verify_bridge_permission( $request );
		}
		if ( class_exists( 'Artmatter_Core' ) && method_exists( 'Artmatter_Core', 'verify_bridge_permission' ) ) {
			return Artmatter_Core::verify_bridge_permission( $request );
		}
		return current_user_can( 'manage_options' );
	}

	public static function rest_get_finishes( WP_REST_Request $request ): WP_REST_Response {
		$finishes = self::get_finishes();
		$response = rest_ensure_response( [
			'success'  => true,
			'finishes' => $finishes,
			'total'    => count( $finishes ),
		] );
		$response->header( 'Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' );
		return $response;
	}

	public static function rest_toggle_finish_stock( WP_REST_Request $request ): WP_REST_Response {
		$id = sanitize_text_field( (string) $request->get_param( 'id' ) );
		$in_stock = (bool) $request->get_param( 'in_stock' );

		$finishes = self::get_finishes();
		$found = false;

		foreach ( $finishes as &$f ) {
			if ( ( $f['id'] ?? '' ) === $id || ( $f['slug'] ?? '' ) === $id ) {
				$f['in_stock'] = $in_stock;
				$found = true;
				break;
			}
		}

		if ( ! $found ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => "Finish '{$id}' not found.",
			], 404 );
		}

		self::save_finishes( $finishes );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'materials', "Finish '{$id}' stock toggled to " . ( $in_stock ? 'IN STOCK' : 'OUT OF STOCK' ) );
		}

		return rest_ensure_response( [
			'success'  => true,
			'id'       => $id,
			'in_stock' => $in_stock,
			'message'  => "Stock status updated for '{$id}'.",
			'finishes' => $finishes,
		] );
	}

	public static function rest_save_finish( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();

		$name = sanitize_text_field( $params['name'] ?? '' );
		if ( empty( $name ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Finish name is required' ], 400 );
		}

		$id = sanitize_title( $params['id'] ?? $params['slug'] ?? $name );
		$slug = sanitize_title( $params['slug'] ?? $id );
		$group = sanitize_text_field( $params['group'] ?? 'Signature skins' );
		$class_name = sanitize_html_class( $params['class_name'] ?? ( 'cfg-' . $slug ) );
		$thumbnail = esc_url_raw( $params['thumbnail'] ?? '' );
		$extra_price = isset( $params['extra_price'] ) ? (float) $params['extra_price'] : 0.0;
		$in_stock = isset( $params['in_stock'] ) ? (bool) $params['in_stock'] : true;

		$finishes = self::get_finishes();
		$updated = false;

		foreach ( $finishes as &$f ) {
			if ( ( $f['id'] ?? '' ) === $id || ( $f['slug'] ?? '' ) === $slug ) {
				$f['name']        = $name;
				$f['group']       = $group;
				$f['class_name']  = $class_name;
				$f['thumbnail']   = $thumbnail;
				$f['extra_price'] = $extra_price;
				$f['in_stock']    = $in_stock;
				$updated          = true;
				break;
			}
		}

		if ( ! $updated ) {
			$finishes[] = [
				'id'          => $id,
				'slug'        => $slug,
				'name'        => $name,
				'group'       => $group,
				'class_name'  => $class_name,
				'thumbnail'   => $thumbnail,
				'extra_price' => $extra_price,
				'in_stock'    => $in_stock,
			];
		}

		self::save_finishes( $finishes );

		return rest_ensure_response( [
			'success'  => true,
			'message'  => $updated ? "Finish '{$name}' updated." : "Finish '{$name}' created.",
			'finish'   => [
				'id'          => $id,
				'slug'        => $slug,
				'name'        => $name,
				'group'       => $group,
				'class_name'  => $class_name,
				'thumbnail'   => $thumbnail,
				'extra_price' => $extra_price,
				'in_stock'    => $in_stock,
			],
			'finishes' => $finishes,
		] );
	}

	/**
	 * Safe JSON parser for string or array meta values
	 */
	public static function parse_meta_json( $raw ) {
		if ( empty( $raw ) ) return [];
		if ( is_array( $raw ) ) return $raw;
		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) return $decoded;
			$unescaped = stripslashes( $raw );
			$decoded2 = json_decode( $unescaped, true );
			if ( is_array( $decoded2 ) ) return $decoded2;
		}
		return [];
	}

	/**
	 * Convert legacy MKL product meta into modern Composable Device Profile
	 */
	public static function convert_mkl_to_profile( int $product_id ): array {
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return [];
		}

		$angles_raw = get_post_meta( $product_id, '_mkl_product_configurator_angles', true );
		$layers_raw = get_post_meta( $product_id, '_mkl_product_configurator_layers', true );
		$content_raw = get_post_meta( $product_id, '_mkl_product_configurator_content', true );

		$angles = self::parse_meta_json( $angles_raw );
		$layers = self::parse_meta_json( $layers_raw );
		$content = self::parse_meta_json( $content_raw );

		$cat_names = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'names' ] );
		$main_cat = ! empty( $cat_names ) && is_array( $cat_names ) ? $cat_names[0] : 'General';
		$cat_lower = strtolower( $main_cat );

		// Determine device family and size multiplier
		$family = 'phone';
		$size_multiplier = 1.0;

		if ( strpos( $cat_lower, 'macbook' ) !== false || strpos( $cat_lower, 'laptop' ) !== false ) {
			$family = 'laptop';
			$size_multiplier = 2.5;
		} elseif ( strpos( $cat_lower, 'pad' ) !== false || strpos( $cat_lower, 'tablet' ) !== false ) {
			$family = 'tablet';
			$size_multiplier = 1.8;
		} elseif ( strpos( $cat_lower, 'fold' ) !== false || strpos( $cat_lower, 'flip' ) !== false ) {
			$family = 'foldable';
			$size_multiplier = 1.3;
		} elseif ( strpos( $cat_lower, 'keyboard' ) !== false ) {
			$family = 'keyboard';
			$size_multiplier = 2.0;
		} elseif ( strpos( $cat_lower, 'case' ) !== false ) {
			$family = 'case';
			$size_multiplier = 1.0;
		}

		// Convert Views
		$views = [];
		if ( ! empty( $angles ) && is_array( $angles ) ) {
			$order_idx = 0;
			foreach ( $angles as $a ) {
				$name = trim( $a['name'] ?? '' );
				if ( empty( $name ) ) continue;
				$slug = sanitize_title( $name );
				$views[] = [
					'id'                => $slug ?: ( 'view_' . ( $a['_id'] ?? $order_idx ) ),
					'legacy_id'         => $a['_id'] ?? null,
					'name'              => $name,
					'is_default'        => $order_idx === 0,
					'aspect_ratio'      => '1:1',
					'canvas_dimensions' => [ 'width' => 1000, 'height' => 1000 ],
				];
				$order_idx++;
			}
		}

		if ( empty( $views ) ) {
			$views[] = [
				'id'                => 'main_view',
				'name'              => 'Main View',
				'is_default'        => true,
				'aspect_ratio'      => '1:1',
				'canvas_dimensions' => [ 'width' => 1000, 'height' => 1000 ],
			];
		}

		// Group content by layerId
		$content_by_layer = [];
		if ( is_array( $content ) ) {
			foreach ( $content as $item ) {
				if ( isset( $item['layerId'] ) ) {
					$content_by_layer[ $item['layerId'] ] = $item['choices'] ?? [];
				}
			}
		}

		// Convert Layers
		$normalized_layers = [];
		$variants = [];

		if ( is_array( $layers ) ) {
			foreach ( $layers as $idx => $l ) {
				$layer_name = trim( $l['name'] ?? '' );
				if ( empty( $layer_name ) ) continue;

				$layer_id_num = $l['_id'] ?? $idx;
				$layer_slug = sanitize_title( $layer_name );
				$is_required = ( ( $l['required'] ?? '' ) === '1' || ( $l['required'] ?? false ) === true );
				$is_optional = ( ( $l['can_deselect'] ?? '' ) === '1' || strpos( (string) ( $l['class_name'] ?? '' ), 'optional' ) !== false );
				$is_selector = strpos( (string) ( $l['class_name'] ?? '' ), 'none-hover' ) !== false || in_array( strtolower( $layer_name ), [ 'model', 'series', 'iphone model', 'ipad series', 'ipad version', 'device model', 'connectivity' ] );

				$raw_choices = $content_by_layer[ $layer_id_num ] ?? [];

				if ( $is_selector ) {
					$options = [];
					foreach ( $raw_choices as $ch ) {
						if ( empty( $ch['is_group'] ) && ! empty( $ch['name'] ) ) {
							$options[] = [
								'id'         => sanitize_title( $ch['name'] ),
								'name'       => $ch['name'],
								'price_diff' => isset( $ch['price'] ) ? (float) $ch['price'] : 0,
							];
						}
					}
					if ( ! empty( $options ) ) {
						$variants[] = [
							'id'      => $layer_slug,
							'name'    => $layer_name,
							'options' => $options,
						];
					}
					continue;
				}

				// Build texture map for this layer
				$texture_map = [];
				$layer_extra_price = 0;

				foreach ( $raw_choices as $ch ) {
					if ( ! empty( $ch['is_group'] ) ) continue;
					$ch_name = $ch['name'] ?? '';
					$ch_slug = sanitize_title( $ch_name );
					if ( isset( $ch['price'] ) && (float) $ch['price'] > 0 && $layer_extra_price === 0 ) {
						$layer_extra_price = (float) $ch['price'];
					}

					if ( ! empty( $ch['images'] ) && is_array( $ch['images'] ) ) {
						foreach ( $ch['images'] as $img_obj ) {
							$url = $img_obj['image']['url'] ?? '';
							if ( $url ) {
								$texture_map[ $ch_slug ] = $url;
							}
						}
					}
				}

				$normalized_layers[] = [
					'id'                    => $layer_slug,
					'legacy_id'             => $layer_id_num,
					'name'                  => $layer_name,
					'group'                 => in_array( strtolower( $layer_name ), [ 'back', 'top', 'device' ] ) ? 'primary' : 'accent',
					'is_required'           => $is_required,
					'is_optional'           => $is_optional,
					'default_selected'      => $is_required || ! $is_optional,
					'extra_price'           => $layer_extra_price,
					'z_index'               => $idx + 1,
					'allowed_finish_groups' => [ 'Signature skins', 'Colors', 'Natural' ],
					'assets_by_view'        => [
						'main_view' => [
							'render_texture_map' => $texture_map,
						],
					],
				];
			}
		}

		$base_price = (float) ( $product->get_price() ?: $product->get_regular_price() ?: 0 );

		return [
			'product_id'      => $product_id,
			'device_slug'     => $product->get_slug(),
			'device_name'     => $product->get_name(),
			'category'        => $main_cat,
			'family'          => $family,
			'base_price'      => $base_price,
			'currency'        => get_woocommerce_currency(),
			'size_multiplier' => $size_multiplier,
			'is_configurable' => ! empty( $normalized_layers ),
			'views'           => $views,
			'layers'          => $normalized_layers,
			'variants'        => $variants,
			'updated_at'      => current_time( 'mysql' ),
		];
	}

	/**
	 * REST Endpoint: Fetch list of all product profiles summary
	 */
	public static function rest_get_configurator_profiles( WP_REST_Request $request ): WP_REST_Response {
		$page = max( 1, (int) $request->get_param( 'page' ) ?: 1 );
		$per_page = max( 10, min( 200, (int) $request->get_param( 'per_page' ) ?: 50 ) );
		$search = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
		$category = sanitize_text_field( $request->get_param( 'category' ) ?: '' );

		$args = [
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'ID',
			'order'          => 'DESC',
		];

		if ( $search ) {
			$args['s'] = $search;
		}

		if ( $category && $category !== 'all' ) {
			$args['tax_query'] = [
				[
					'taxonomy' => 'product_cat',
					'field'    => 'slug',
					'terms'    => $category,
				],
			];
		}

		$query = new WP_Query( $args );
		$profiles = [];

		foreach ( $query->posts as $p ) {
			$pid = $p->ID;
			$modern_profile = get_post_meta( $pid, self::PROFILE_META_KEY, true );
			$is_migrated = ! empty( $modern_profile );

			if ( ! empty( $modern_profile ) && is_string( $modern_profile ) ) {
				$profile_data = json_decode( $modern_profile, true );
			} elseif ( is_array( $modern_profile ) ) {
				$profile_data = $modern_profile;
			} else {
				$profile_data = self::convert_mkl_to_profile( $pid );
			}

			$product = wc_get_product( $pid );
			$cats = wp_get_post_terms( $pid, 'product_cat', [ 'fields' => 'names' ] );

			$profiles[] = [
				'product_id'      => $pid,
				'name'            => $product ? $product->get_name() : $p->post_title,
				'slug'            => $product ? $product->get_slug() : $p->post_name,
				'price'           => $product ? (float) $product->get_price() : 0,
				'categories'      => $cats,
				'is_migrated'     => $is_migrated,
				'is_configurable' => ! empty( $profile_data['layers'] ),
				'layers_count'    => count( $profile_data['layers'] ?? [] ),
				'views_count'     => count( $profile_data['views'] ?? [] ),
				'family'          => $profile_data['family'] ?? 'phone',
				'size_multiplier' => $profile_data['size_multiplier'] ?? 1.0,
			];
		}

		return rest_ensure_response( [
			'success'     => true,
			'profiles'    => $profiles,
			'total'       => (int) $query->found_posts,
			'total_pages' => (int) $query->max_num_pages,
			'page'        => $page,
		] );
	}

	/**
	 * REST Endpoint to get fully processed configurator data for a product
	 */
	public static function rest_get_product_configurator( WP_REST_Request $request ): WP_REST_Response {
		$id_or_slug = sanitize_text_field( $request->get_param( 'id_or_slug' ) );

		if ( is_numeric( $id_or_slug ) ) {
			$product_id = (int) $id_or_slug;
		} else {
			$product_id = wc_get_product_id_by_slug( $id_or_slug );
		}

		if ( ! $product_id ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Product not found' ], 404 );
		}

		// 1. Check if Modern Composable Profile exists
		$modern_profile = get_post_meta( $product_id, self::PROFILE_META_KEY, true );
		if ( ! empty( $modern_profile ) ) {
			$profile = is_string( $modern_profile ) ? json_decode( $modern_profile, true ) : $modern_profile;
		} else {
			// Auto-convert legacy MKL on-the-fly
			$profile = self::convert_mkl_to_profile( $product_id );
		}

		return rest_ensure_response( [
			'success'  => true,
			'profile'  => $profile,
			'finishes' => self::get_finishes(),
		] );
	}

	/**
	 * REST Endpoint to save/update a product configurator profile
	 */
	public static function rest_save_product_configurator( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$product_id = (int) ( $params['product_id'] ?? 0 );

		if ( ! $product_id || ! get_post( $product_id ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Valid product_id is required' ], 400 );
		}

		$profile = [
			'product_id'      => $product_id,
			'device_slug'     => sanitize_title( $params['device_slug'] ?? '' ),
			'device_name'     => sanitize_text_field( $params['device_name'] ?? '' ),
			'category'        => sanitize_text_field( $params['category'] ?? '' ),
			'family'          => sanitize_text_field( $params['family'] ?? 'phone' ),
			'base_price'      => (float) ( $params['base_price'] ?? 0 ),
			'currency'        => sanitize_text_field( $params['currency'] ?? 'IDR' ),
			'size_multiplier' => (float) ( $params['size_multiplier'] ?? 1.0 ),
			'views'           => is_array( $params['views'] ?? null ) ? $params['views'] : [],
			'layers'          => is_array( $params['layers'] ?? null ) ? $params['layers'] : [],
			'variants'        => is_array( $params['variants'] ?? null ) ? $params['variants'] : [],
			'updated_at'      => current_time( 'mysql' ),
		];

		update_post_meta( $product_id, self::PROFILE_META_KEY, wp_json_encode( $profile ) );

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'configurator', "Configurator profile updated for Product #{$product_id} ({$profile['device_name']})" );
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => "Configurator profile saved successfully.",
			'profile' => $profile,
		] );
	}

	/**
	 * REST Endpoint to batch migrate all products from MKL to Modern Profile
	 */
	public static function rest_batch_migrate( WP_REST_Request $request ): WP_REST_Response {
		$args = [
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'fields'         => 'ids',
		];

		$product_ids = get_posts( $args );
		$migrated_count = 0;
		$skipped_count = 0;

		foreach ( $product_ids as $pid ) {
			$layers_raw = get_post_meta( $pid, '_mkl_product_configurator_layers', true );
			$is_mkl = get_post_meta( $pid, '_mkl_pc__is_configurable', true ) === 'yes';

			if ( $is_mkl || ! empty( $layers_raw ) ) {
				$profile = self::convert_mkl_to_profile( $pid );
				if ( ! empty( $profile['layers'] ) ) {
					update_post_meta( $pid, self::PROFILE_META_KEY, wp_json_encode( $profile ) );
					$migrated_count++;
					continue;
				}
			}
			$skipped_count++;
		}

		return rest_ensure_response( [
			'success'        => true,
			'message'        => "Batch migration completed: {$migrated_count} products converted to modern configurator profiles.",
			'migrated_count' => $migrated_count,
			'skipped_count'  => $skipped_count,
			'total_scanned'  => count( $product_ids ),
		] );
	}

	/**
	 * Enriches WooCommerce Product REST responses with configurator data
	 */
	public static function enrich_wc_product_configurator_meta( WP_REST_Response $response, $product, WP_REST_Request $request ): WP_REST_Response {
		$data = $response->get_data();
		if ( ! is_array( $data ) || empty( $data['id'] ) ) {
			return $response;
		}

		$profile_raw = get_post_meta( $data['id'], self::PROFILE_META_KEY, true );
		if ( ! empty( $profile_raw ) ) {
			$profile = is_string( $profile_raw ) ? json_decode( $profile_raw, true ) : $profile_raw;
			$data['configurator_profile'] = $profile;
		}

		$response->set_data( $data );
		return $response;
	}
}

}
