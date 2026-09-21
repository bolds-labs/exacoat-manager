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
	const GROUPS_OPTION_KEY = 'exacoat_global_finish_groups';
	const GROUP_SETTINGS_OPTION_KEY = 'exacoat_finish_group_settings';
	const PRESETS_OPTION_KEY = 'exacoat_configurator_presets';
	const PROFILE_META_KEY = '_exacoat_configurator_profile';
	const CONFIGURATOR_FLAG_META_KEY = '_is_configurator';
	const AUDIT_TIME_META_KEY = '_configurator_last_audited';
	const AUDIT_STATUS_META_KEY = '_configurator_audit_status';
	const AUDIT_ISSUES_META_KEY = '_configurator_audit_issues';

	private static $cached_finishes = null;

	public static function get_finish_groups(): array {
		$groups = get_option( self::GROUPS_OPTION_KEY, null );
		if ( empty( $groups ) || ! is_array( $groups ) ) {
			$finishes = self::get_finishes();
			$derived  = array_values( array_unique( array_filter( array_column( $finishes, 'group' ) ) ) );
			$groups   = ! empty( $derived ) ? $derived : [ 'Limited', 'Signature skins', 'Colors', 'Natural' ];
			update_option( self::GROUPS_OPTION_KEY, $groups );
		}

		// Preserve all user-configured groups; only prune known obsolete legacy sample groups if empty
		$finishes      = self::get_finishes();
		$active_groups = array_values( array_unique( array_filter( array_column( $finishes, 'group' ) ) ) );
		$sanitized     = array_values( array_unique( array_filter( array_map( 'sanitize_text_field', $groups ) ) ) );

		$obsolete_legacy_defaults = [ 'Pastels & Colors', 'Special editions' ];
		$valid_groups = array_values( array_filter( $sanitized, function( $g ) use ( $active_groups, $obsolete_legacy_defaults ) {
			if ( in_array( $g, $obsolete_legacy_defaults, true ) && ! in_array( $g, $active_groups, true ) ) {
				return false;
			}
			return true;
		} ) );

		// Append any active groups missing from the sequence
		foreach ( $active_groups as $ag ) {
			if ( ! in_array( $ag, $valid_groups, true ) ) {
				$valid_groups[] = $ag;
			}
		}

		if ( empty( $valid_groups ) ) {
			$valid_groups = [ 'Limited', 'Signature skins', 'Colors', 'Natural' ];
		}

		return $valid_groups;
	}

	public static function save_finish_groups( array $groups ): bool {
		$sanitized = array_values( array_unique( array_filter( array_map( 'sanitize_text_field', $groups ) ) ) );
		update_option( self::GROUPS_OPTION_KEY, $sanitized );
		return true;
	}

	public static function get_finish_group_settings(): array {
		$settings = get_option( self::GROUP_SETTINGS_OPTION_KEY, null );
		if ( ! is_array( $settings ) ) {
			// Sensible initial defaults: Colors as compact dots
			$settings = [
				'Colors' => [
					'display_style'        => 'compact_dots',
					'collapsed_by_default' => false,
					'show_more_limit'      => 0,
				],
			];
		}
		return $settings;
	}

	public static function save_finish_group_settings( array $settings ): bool {
		$sanitized = [];
		foreach ( $settings as $grp => $cfg ) {
			$clean_grp = sanitize_text_field( $grp );
			if ( empty( $clean_grp ) || ! is_array( $cfg ) ) {
				continue;
			}
			$sanitized[ $clean_grp ] = [
				'display_style'        => in_array( $cfg['display_style'] ?? '', [ 'cards', 'compact_dots' ], true ) ? $cfg['display_style'] : 'cards',
				'collapsed_by_default' => ! empty( $cfg['collapsed_by_default'] ),
				'show_more_limit'      => max( 0, (int) ( $cfg['show_more_limit'] ?? 0 ) ),
			];
		}
		update_option( self::GROUP_SETTINGS_OPTION_KEY, $sanitized );
		return true;
	}

	public static function get_configurator_presets(): array {
		$presets = get_option( self::PRESETS_OPTION_KEY, null );
		if ( ! is_array( $presets ) || empty( $presets ) ) {
			$presets = [
				[
					'id'          => 'stealth-bespoke',
					'title'       => 'The Stealth Bespoke',
					'tagline'     => 'Titanium+ with Matte Black Camera Plateau',
					'badge'       => 'POPULAR',
					'coverage'    => 'model_360',
					'logo_cutout' => false,
					'layers'      => [
						'back'   => 'titanium-plus',
						'camera' => 'matte-black',
						'frame'  => 'titanium-plus',
					],
					'triggers'    => [ 'titanium-plus', 'titanium' ],
				],
				[
					'id'          => 'shadow-hex',
					'title'       => 'Shadow Hex',
					'tagline'     => 'Swarm Hexagonal Back with Matte Black Accents',
					'badge'       => 'STAFF PICK',
					'coverage'    => 'model_360',
					'logo_cutout' => true,
					'layers'      => [
						'back'   => 'swarm',
						'camera' => 'matte-black',
					],
					'triggers'    => [ 'swarm' ],
				],
			];
		}
		return $presets;
	}

	public static function save_configurator_presets( array $presets ): bool {
		$sanitized = [];
		foreach ( $presets as $p ) {
			if ( ! is_array( $p ) ) {
				continue;
			}
			$id = sanitize_title( $p['id'] ?? $p['title'] ?? '' );
			if ( empty( $id ) ) {
				continue;
			}
			$clean_layers = [];
			if ( isset( $p['layers'] ) && is_array( $p['layers'] ) ) {
				foreach ( $p['layers'] as $k => $v ) {
					$clean_layers[ sanitize_key( $k ) ] = sanitize_title( (string) $v );
				}
			}
			$clean_triggers = [];
			if ( isset( $p['triggers'] ) && is_array( $p['triggers'] ) ) {
				$clean_triggers = array_values( array_filter( array_map( 'sanitize_title', $p['triggers'] ) ) );
			}
			$sanitized[] = [
				'id'          => $id,
				'title'       => sanitize_text_field( $p['title'] ?? '' ),
				'tagline'     => sanitize_text_field( $p['tagline'] ?? '' ),
				'badge'       => sanitize_text_field( $p['badge'] ?? '' ),
				'coverage'    => in_array( $p['coverage'] ?? '', [ 'model_360', 'model_cut' ], true ) ? $p['coverage'] : 'model_360',
				'logo_cutout' => ! empty( $p['logo_cutout'] ),
				'layers'      => $clean_layers,
				'triggers'    => $clean_triggers,
			];
		}
		update_option( self::PRESETS_OPTION_KEY, $sanitized );
		return true;
	}

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// Hook into post save for product cache revalidation
		add_action( 'save_post_product', [ __CLASS__, 'on_product_saved' ], 20, 2 );

		// Hook into WooCommerce product REST response and data loading
		add_filter( 'woocommerce_rest_prepare_product_object', [ __CLASS__, 'enrich_wc_product_configurator_meta' ], 10, 3 );

		// Hook into WooCommerce product editor: Device Configurator checkbox
		add_action( 'woocommerce_product_options_general_product_data', [ __CLASS__, 'add_configurator_product_checkbox' ] );
		add_action( 'woocommerce_process_product_meta', [ __CLASS__, 'save_configurator_product_checkbox' ] );

		// Hook into WooCommerce cart and order items for headless addons
		add_filter( 'woocommerce_add_cart_item_data', [ __CLASS__, 'add_addon_data_to_cart_item' ], 10, 3 );
		add_action( 'woocommerce_before_calculate_totals', [ __CLASS__, 'calculate_custom_addon_totals' ], 20, 1 );
		add_filter( 'woocommerce_get_item_data', [ __CLASS__, 'display_custom_addons_in_cart' ], 10, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', [ __CLASS__, 'save_custom_addons_to_order_item' ], 10, 4 );
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
				'id'              => 'black-camo',
				'slug'            => 'black-camo',
				'name'            => 'Black Camo',
				'group'           => 'Signature skins',
				'class_name'      => 'cfg-black-camo',
				'thumbnail'       => 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
				'texture_big_url' => 'https://staging.exacoat.com/wp-content/uploads/Exacoat-Texture-Big-Black-Camo.jpg',
				'extra_price'     => 30000,
				'in_stock'        => true,
			],
			[
				'id'          => 'patina',
				'slug'        => 'patina',
				'name'        => 'Patina',
				'group'       => 'Signature skins',
				'class_name'  => 'cfg-patina',
				'thumbnail'   => 'https://exacoat.com/wp-content/uploads/Patina-Texture-Thumbnail.jpg',
				'extra_price' => 30000,
				'in_stock'    => false,
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

		// Ensure texture_url, order, and is_active fields exist on all returned finishes
		$idx = 0;
		foreach ( $finishes as &$f ) {
			if ( ! isset( $f['texture_url'] ) ) {
				$f['texture_url'] = $f['thumbnail'] ?? '';
			}
			if ( ! isset( $f['order'] ) ) {
				$f['order'] = $idx;
			}
			if ( ! isset( $f['is_active'] ) ) {
				$f['is_active'] = true;
			}
			$idx++;
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

		// POST /finishes/toggle-active: Toggle active/inactive status for a finish
		$register( '/finishes/toggle-active', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_toggle_finish_active' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
			'args'                => [
				'id' => [
					'required'          => true,
					'sanitize_callback' => 'sanitize_text_field',
				],
				'is_active' => [
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

		// POST /finishes/delete: Delete a finish
		$register( '/finishes/delete', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_delete_finish' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// POST /finishes/reorder-groups: Save finish groups order
		$register( '/finishes/reorder-groups', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_finish_groups' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// POST /finishes/rename-group: Rename a finish group and migrate all assigned finishes
		$register( '/finishes/rename-group', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_rename_finish_group' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// POST /finishes/save-all: Batch save finishes and groups
		$register( '/finishes/save-all', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_all_finishes' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// POST /finishes/group-settings: Save finish group presentation settings
		$register( '/finishes/group-settings', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_finish_group_settings' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// GET /configurator/presets: Fetch bespoke configurator presets
		$register( '/configurator/presets', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_configurator_presets' ],
			'permission_callback' => '__return_true',
		] );

		// POST /configurator/presets: Save bespoke configurator presets
		$register( '/configurator/presets', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_configurator_presets' ],
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

		// 8. POST /configurator/set-price: Set WooCommerce product price and sync profile base_price
		$register( '/configurator/set-price', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_set_product_price' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 9. POST /configurator/duplicate-product: Duplicate product and its configurator profile
		$register( '/configurator/duplicate-product', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_duplicate_product' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 10. GET /addons/schemas: Fetch custom product addon schemas and device catalog
		$register( '/addons/schemas', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_addon_schemas' ],
			'permission_callback' => '__return_true',
		] );

		// 11. POST /addons/schema/save: Save/update custom product addon schemas and catalog
		$register( '/addons/schema/save', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_save_addon_schemas' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 12. POST /configurator/toggle-configurator: Enable or disable configurator for a product
		$register( '/configurator/toggle-configurator', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_toggle_configurator' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 13. POST /configurator/mark-audited: Mark a single device as audited with timestamp & issues
		$register( '/configurator/mark-audited', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_mark_audited' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 14. POST /configurator/batch-mark-audited: Batch mark multiple devices as audited
		$register( '/configurator/batch-mark-audited', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_batch_mark_audited' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 15. POST /configurator/reset-audit: Reset audit records for a device or all devices
		$register( '/configurator/reset-audit', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_reset_audit' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 16. GET /media/list: Search and browse WordPress media library for configurator assets
		$register( '/media/list', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_media_list' ],
			'permission_callback' => '__return_true',
		] );

		// 17. POST /configurator/extract-shading: Extract multiply shadow and screen highlight PNGs from a neutral render
		$register( '/configurator/extract-shading', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_extract_shading' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 18. POST /configurator/revalidate-web: On-demand cache revalidation for web.exacoat.com and Cloudflare
		$register( '/configurator/revalidate-web', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_revalidate_web' ],
			'permission_callback' => [ __CLASS__, 'verify_permission' ],
		] );

		// 19. POST /configurator/composite/upload: Store rendered composite preview permanently in WordPress uploads
		$register( '/configurator/composite/upload', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_upload_composite' ],
			'permission_callback' => '__return_true',
		] );
		$register( '/composite/upload', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_upload_composite' ],
			'permission_callback' => '__return_true',
		] );
	}


	public static function verify_permission( WP_REST_Request $request ): bool {
		if ( class_exists( 'Exacoat_Core' ) && method_exists( 'Exacoat_Core', 'verify_bridge_permission' ) ) {
			return Exacoat_Core::verify_bridge_permission( $request );
		}
		return current_user_can( 'manage_options' );
	}

	public static function rest_get_finishes( WP_REST_Request $request ): WP_REST_Response {
		$finishes       = self::get_finishes();
		$groups         = self::get_finish_groups();
		$group_settings = self::get_finish_group_settings();
		$presets        = self::get_configurator_presets();
		$response = rest_ensure_response( [
			'success'        => true,
			'finishes'       => $finishes,
			'groups'         => $groups,
			'group_settings' => $group_settings,
			'presets'        => $presets,
			'total'          => count( $finishes ),
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
			'groups'   => self::get_finish_groups(),
		] );
	}

	public static function rest_toggle_finish_active( WP_REST_Request $request ): WP_REST_Response {
		$id = sanitize_text_field( (string) $request->get_param( 'id' ) );
		$is_active = (bool) $request->get_param( 'is_active' );

		$finishes = self::get_finishes();
		$found = false;

		foreach ( $finishes as &$f ) {
			if ( ( $f['id'] ?? '' ) === $id || ( $f['slug'] ?? '' ) === $id ) {
				$f['is_active'] = $is_active;
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
			Exacoat_Logger::log( 'info', 'materials', "Finish '{$id}' status toggled to " . ( $is_active ? 'ACTIVE' : 'INACTIVE' ) );
		}

		return rest_ensure_response( [
			'success'   => true,
			'id'        => $id,
			'is_active' => $is_active,
			'message'   => "Active status updated for '{$id}'.",
			'finishes'  => $finishes,
			'groups'    => self::get_finish_groups(),
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
		$texture_url = esc_url_raw( $params['texture_url'] ?? '' );
		$texture_big_url = esc_url_raw( $params['texture_big_url'] ?? '' );
		$extra_price = isset( $params['extra_price'] ) ? (float) $params['extra_price'] : 0.0;
		$in_stock = isset( $params['in_stock'] ) ? (bool) $params['in_stock'] : true;
		$is_active = isset( $params['is_active'] ) ? (bool) $params['is_active'] : true;
		$is_custom_per_device = ! empty( $params['is_custom_per_device'] );
		$order = isset( $params['order'] ) ? (int) $params['order'] : 0;
		$badge_text = sanitize_text_field( $params['badge_text'] ?? '' );
		$badge_color = sanitize_text_field( $params['badge_color'] ?? '' );
		$shadow_opacity = isset( $params['shadow_opacity'] ) ? (float) $params['shadow_opacity'] : null;
		$highlight_opacity = isset( $params['highlight_opacity'] ) ? (float) $params['highlight_opacity'] : null;

		$finishes = self::get_finishes();
		$updated = false;

		foreach ( $finishes as &$f ) {
			if ( ( $f['id'] ?? '' ) === $id || ( $f['slug'] ?? '' ) === $slug ) {
				$f['name']                 = $name;
				$f['group']                = $group;
				$f['class_name']           = $class_name;
				if ( ! empty( $thumbnail ) || isset( $params['thumbnail'] ) ) {
					$f['thumbnail'] = $thumbnail;
				}
				if ( ! empty( $texture_url ) || isset( $params['texture_url'] ) ) {
					$f['texture_url'] = $texture_url;
				}
				if ( ! empty( $texture_big_url ) || isset( $params['texture_big_url'] ) ) {
					$f['texture_big_url'] = $texture_big_url;
				}
				$f['extra_price']          = $extra_price;
				$f['in_stock']             = $in_stock;
				$f['is_active']            = $is_active;
				$f['is_custom_per_device'] = $is_custom_per_device;
				$f['badge_text']           = $badge_text;
				$f['badge_color']          = $badge_color;
				if ( isset( $params['shadow_opacity'] ) ) {
					$f['shadow_opacity']   = (float) $params['shadow_opacity'];
				}
				if ( isset( $params['highlight_opacity'] ) ) {
					$f['highlight_opacity'] = (float) $params['highlight_opacity'];
				}
				if ( isset( $params['order'] ) ) {
					$f['order'] = $order;
				}
				$updated = true;
				break;
			}
		}

		if ( ! $updated ) {
			$new_finish = [
				'id'                   => $id,
				'slug'                 => $slug,
				'name'                 => $name,
				'group'                => $group,
				'class_name'           => $class_name,
				'thumbnail'            => $thumbnail,
				'texture_url'          => $texture_url ?: $thumbnail,
				'texture_big_url'      => $texture_big_url,
				'extra_price'          => $extra_price,
				'in_stock'             => $in_stock,
				'is_active'            => $is_active,
				'is_custom_per_device' => $is_custom_per_device,
				'badge_text'           => $badge_text,
				'badge_color'          => $badge_color,
				'order'                => $order,
			];
			if ( $shadow_opacity !== null ) {
				$new_finish['shadow_opacity'] = $shadow_opacity;
			}
			if ( $highlight_opacity !== null ) {
				$new_finish['highlight_opacity'] = $highlight_opacity;
			}
			$finishes[] = $new_finish;
		}

		self::save_finishes( $finishes );

		// Auto-register new group if not present
		$groups = self::get_finish_groups();
		if ( ! empty( $group ) && ! in_array( $group, $groups, true ) ) {
			$groups[] = $group;
			self::save_finish_groups( $groups );
		}

		return rest_ensure_response( [
			'success'  => true,
			'message'  => $updated ? "Finish '{$name}' updated." : "Finish '{$name}' created.",
			'finish'   => [
				'id'                   => $id,
				'slug'                 => $slug,
				'name'                 => $name,
				'group'                => $group,
				'class_name'           => $class_name,
				'thumbnail'            => $thumbnail,
				'texture_url'          => $texture_url,
				'texture_big_url'      => $texture_big_url,
				'extra_price'          => $extra_price,
				'in_stock'             => $in_stock,
				'is_active'            => $is_active,
				'is_custom_per_device' => $is_custom_per_device,
				'shadow_opacity'       => $shadow_opacity,
				'highlight_opacity'    => $highlight_opacity,
				'order'                => $order,
			],
			'finishes' => $finishes,
			'groups'   => self::get_finish_groups(),
		] );

		// Automatically trigger storefront cache revalidation
		self::trigger_storefront_revalidation( [
			'tag'       => 'finishes',
			'path'      => '/api/configurator/finishes',
			'purge_all' => false,
		] );

		return $response;
	}

	public static function rest_delete_finish( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$id = sanitize_text_field( (string) ( $params['id'] ?? $params['slug'] ?? '' ) );

		if ( empty( $id ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Finish id is required.' ], 400 );
		}

		$finishes = self::get_finishes();
		$initial_count = count( $finishes );
		$finishes = array_values( array_filter( $finishes, function( $f ) use ( $id ) {
			return ( $f['id'] ?? '' ) !== $id && ( $f['slug'] ?? '' ) !== $id;
		} ) );

		if ( count( $finishes ) === $initial_count ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => "Finish '{$id}' not found." ], 404 );
		}

		self::save_finishes( $finishes );

		return rest_ensure_response( [
			'success'  => true,
			'message'  => "Finish '{$id}' deleted.",
			'finishes' => $finishes,
			'groups'   => self::get_finish_groups(),
		] );
	}

	public static function rest_save_finish_groups( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$groups = $params['groups'] ?? null;

		if ( ! is_array( $groups ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Groups must be an array.' ], 400 );
		}

		self::save_finish_groups( $groups );

		return rest_ensure_response( [
			'success' => true,
			'message' => 'Finish groups reordered.',
			'groups'  => self::get_finish_groups(),
		] );
	}

	public static function rest_rename_finish_group( WP_REST_Request $request ): WP_REST_Response {
		$params   = $request->get_json_params() ?: $request->get_params();
		$old_name = sanitize_text_field( trim( $params['old_name'] ?? '' ) );
		$new_name = sanitize_text_field( trim( $params['new_name'] ?? '' ) );

		if ( empty( $old_name ) || empty( $new_name ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Both old_name and new_name are required.' ], 400 );
		}

		$groups = self::get_finish_groups();
		$idx    = array_search( $old_name, $groups, true );
		if ( false !== $idx ) {
			$groups[ $idx ] = $new_name;
		} else {
			$groups[] = $new_name;
		}
		self::save_finish_groups( array_values( array_unique( $groups ) ) );

		$finishes      = self::get_finishes();
		$updated_count = 0;
		foreach ( $finishes as &$f ) {
			if ( ( $f['group'] ?? '' ) === $old_name ) {
				$f['group'] = $new_name;
				$updated_count++;
			}
		}
		unset( $f );
		self::save_finishes( $finishes );

		// Automatically trigger storefront cache revalidation
		self::trigger_storefront_revalidation( [
			'tag'       => 'finishes',
			'path'      => '/api/configurator/finishes',
			'purge_all' => false,
		] );

		return rest_ensure_response( [
			'success'       => true,
			'message'       => "Renamed group '{$old_name}' to '{$new_name}'.",
			'updated_count' => $updated_count,
			'groups'        => self::get_finish_groups(),
			'finishes'      => self::get_finishes(),
		] );
	}

	public static function rest_save_all_finishes( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$finishes = $params['finishes'] ?? null;
		$groups = $params['groups'] ?? null;
		$group_settings = $params['group_settings'] ?? null;

		if ( is_array( $groups ) ) {
			self::save_finish_groups( $groups );
		}
		if ( is_array( $group_settings ) ) {
			self::save_finish_group_settings( $group_settings );
		}
		if ( is_array( $finishes ) ) {
			foreach ( $finishes as &$item ) {
				if ( isset( $item['badge_text'] ) ) {
					$item['badge_text'] = sanitize_text_field( $item['badge_text'] );
				}
				if ( isset( $item['badge_color'] ) ) {
					$item['badge_color'] = sanitize_text_field( $item['badge_color'] );
				}
				if ( isset( $item['is_active'] ) ) {
					$item['is_active'] = (bool) $item['is_active'];
				}
				if ( isset( $item['order'] ) ) {
					$item['order'] = (int) $item['order'];
				}
			}
			unset( $item );
			self::save_finishes( $finishes );
		}

		$response = rest_ensure_response( [
			'success'        => true,
			'message'        => 'All finishes and groups updated.',
			'finishes'       => self::get_finishes(),
			'groups'         => self::get_finish_groups(),
			'group_settings' => self::get_finish_group_settings(),
		] );

		// Automatically trigger storefront cache revalidation
		self::trigger_storefront_revalidation( [
			'tag'       => 'finishes',
			'path'      => '/api/configurator/finishes',
			'purge_all' => false,
		] );

		return $response;
	}

	public static function rest_save_finish_group_settings( WP_REST_Request $request ): WP_REST_Response {
		$params   = $request->get_json_params() ?: $request->get_params();
		$settings = $params['settings'] ?? $params['group_settings'] ?? $params;

		if ( ! is_array( $settings ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Group settings must be an object.' ], 400 );
		}

		self::save_finish_group_settings( $settings );

		// Automatically trigger storefront cache revalidation
		self::trigger_storefront_revalidation( [
			'tag'       => 'finishes',
			'path'      => '/api/configurator/finishes',
			'purge_all' => false,
		] );

		return rest_ensure_response( [
			'success'        => true,
			'message'        => 'Group settings saved.',
			'group_settings' => self::get_finish_group_settings(),
		] );
	}

	public static function rest_get_configurator_presets( WP_REST_Request $request ): WP_REST_Response {
		$presets = self::get_configurator_presets();
		return rest_ensure_response( [
			'success' => true,
			'presets' => $presets,
			'total'   => count( $presets ),
		] );
	}

	public static function rest_save_configurator_presets( WP_REST_Request $request ): WP_REST_Response {
		$params  = $request->get_json_params() ?: $request->get_params();
		$presets = $params['presets'] ?? $params;

		if ( ! is_array( $presets ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Presets must be an array.' ], 400 );
		}

		self::save_configurator_presets( $presets );

		// Automatically trigger storefront cache revalidation
		self::trigger_storefront_revalidation( [
			'tag'       => 'configurator',
			'path'      => '/api/configurator/finishes',
			'purge_all' => false,
		] );

		return rest_ensure_response( [
			'success' => true,
			'message' => 'Configurator presets saved.',
			'presets' => self::get_configurator_presets(),
		] );
	}

	/**
	 * Render device configurator checkbox in WooCommerce product edit screen (General tab)
	 */
	public static function add_configurator_product_checkbox() {
		global $post;
		if ( ! $post || ! $post->ID ) return;
		$val = get_post_meta( $post->ID, self::CONFIGURATOR_FLAG_META_KEY, true );
		if ( '' === $val ) {
			$val = self::is_product_configurator( $post->ID ) ? 'yes' : 'no';
		}
		echo '<div class="options_group show_if_simple show_if_variable">';
		woocommerce_wp_checkbox( [
			'id'            => self::CONFIGURATOR_FLAG_META_KEY,
			'label'         => __( 'Device Configurator', 'exacoat-core' ),
			'description'   => __( 'Check this if this product is an interactive 2D device skin configurator (uncheck for merchandise, limited drops, standalone kits, cases).', 'exacoat-core' ),
			'value'         => $val,
			'desc_tip'      => true,
		] );
		echo '</div>';
	}

	/**
	 * Save device configurator checkbox on WooCommerce product save
	 */
	public static function save_configurator_product_checkbox( $post_id ) {
		$is_configurator = isset( $_POST[ self::CONFIGURATOR_FLAG_META_KEY ] ) ? 'yes' : 'no';
		update_post_meta( $post_id, self::CONFIGURATOR_FLAG_META_KEY, $is_configurator );
	}

	/**
	 * Determine if a product is an active device configurator
	 */
	public static function is_product_configurator( int $pid, ?array $profile_data = null ): bool {
		$flag = get_post_meta( $pid, self::CONFIGURATOR_FLAG_META_KEY, true );
		if ( 'yes' === $flag ) {
			return true;
		}
		if ( 'no' === $flag ) {
			return false;
		}

		// When flag is not explicitly saved yet, evaluate intelligently based on configurator layers
		if ( $profile_data !== null && isset( $profile_data['layers'] ) ) {
			return ! empty( $profile_data['layers'] );
		}

		$modern_profile = get_post_meta( $pid, self::PROFILE_META_KEY, true );
		if ( ! empty( $modern_profile ) ) {
			$decoded = is_array( $modern_profile ) ? $modern_profile : json_decode( $modern_profile, true );
			if ( ! empty( $decoded['layers'] ) ) {
				return true;
			}
		}

		$layers_meta = get_post_meta( $pid, '_layers', true );
		if ( ! empty( $layers_meta ) ) {
			$parsed = self::parse_meta_json( $layers_meta );
			if ( ! empty( $parsed ) && is_array( $parsed ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * REST Endpoint: Toggle configurator status for a product directly from Exacoat Manager
	 */
	public static function rest_toggle_configurator( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$pid = (int) ( $params['product_id'] ?? 0 );
		$is_cfg = ! empty( $params['is_configurator'] );

		if ( ! $pid || ! get_post( $pid ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid product ID' ], 400 );
		}

		update_post_meta( $pid, self::CONFIGURATOR_FLAG_META_KEY, $is_cfg ? 'yes' : 'no' );

		$post = get_post( $pid );
		self::trigger_storefront_revalidation( [
			'slug' => $post ? $post->post_name : '',
		] );

		return rest_ensure_response( [
			'success'         => true,
			'product_id'      => $pid,
			'is_configurator' => $is_cfg,
			'message'         => $is_cfg ? 'Product enabled as configurator device.' : 'Product excluded from configurator devices.',
		] );
	}

	/**
	 * REST Endpoint: Mark a single device profile as audited
	 */
	public static function rest_mark_audited( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$pid = (int) ( $params['product_id'] ?? 0 );
		$status = sanitize_text_field( $params['audit_status'] ?? 'clean' );
		$issues = (int) ( $params['audit_issues'] ?? 0 );
		$timestamp = sanitize_text_field( $params['last_audited_at'] ?? current_time( 'mysql' ) );

		if ( ! $pid || ! get_post( $pid ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid product ID' ], 400 );
		}

		update_post_meta( $pid, self::AUDIT_TIME_META_KEY, $timestamp );
		update_post_meta( $pid, self::AUDIT_STATUS_META_KEY, $status );
		update_post_meta( $pid, self::AUDIT_ISSUES_META_KEY, $issues );

		return rest_ensure_response( [
			'success'         => true,
			'product_id'      => $pid,
			'last_audited_at' => $timestamp,
			'audit_status'    => $status,
			'audit_issues'    => $issues,
		] );
	}

	/**
	 * REST Endpoint: Batch mark multiple devices as audited
	 */
	public static function rest_batch_mark_audited( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$results = $params['results'] ?? [];
		if ( ! is_array( $results ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Results must be an array' ], 400 );
		}

		$updated = 0;
		$now = current_time( 'mysql' );
		foreach ( $results as $row ) {
			$pid = (int) ( $row['product_id'] ?? 0 );
			if ( ! $pid || ! get_post( $pid ) ) continue;

			$status = sanitize_text_field( $row['audit_status'] ?? 'clean' );
			$issues = (int) ( $row['audit_issues'] ?? 0 );
			$ts = sanitize_text_field( $row['last_audited_at'] ?? $now );

			update_post_meta( $pid, self::AUDIT_TIME_META_KEY, $ts );
			update_post_meta( $pid, self::AUDIT_STATUS_META_KEY, $status );
			update_post_meta( $pid, self::AUDIT_ISSUES_META_KEY, $issues );
			$updated++;
		}

		return rest_ensure_response( [
			'success' => true,
			'updated' => $updated,
			'message' => "Successfully marked {$updated} devices as audited.",
		] );
	}

	/**
	 * REST Endpoint: Reset audit status for a device or all devices
	 */
	public static function rest_reset_audit( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$pid = (int) ( $params['product_id'] ?? 0 );
		$all = ! empty( $params['all'] );

		if ( $all ) {
			delete_post_meta_by_key( self::AUDIT_TIME_META_KEY );
			delete_post_meta_by_key( self::AUDIT_STATUS_META_KEY );
			delete_post_meta_by_key( self::AUDIT_ISSUES_META_KEY );
			return rest_ensure_response( [ 'success' => true, 'message' => 'Cleared all device audit records.' ] );
		}

		if ( ! $pid || ! get_post( $pid ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid product ID' ], 400 );
		}

		delete_post_meta( $pid, self::AUDIT_TIME_META_KEY );
		delete_post_meta( $pid, self::AUDIT_STATUS_META_KEY );
		delete_post_meta( $pid, self::AUDIT_ISSUES_META_KEY );

		return rest_ensure_response( [
			'success'    => true,
			'product_id' => $pid,
			'message'    => 'Audit status reset for device.',
		] );
	}

	/**
	 * Search and browse WordPress media library attachments for configurator studio
	 */
	public static function rest_get_media_list( WP_REST_Request $request ): WP_REST_Response {
		$search   = sanitize_text_field( (string) $request->get_param( 'search' ) );
		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?: 24 ) ) );

		$args = [
			'post_type'      => 'attachment',
			'post_mime_type' => 'image',
			'post_status'    => 'inherit',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'date',
			'order'          => 'DESC',
		];

		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		$query = new WP_Query( $args );
		$items = [];

		foreach ( $query->posts as $post ) {
			$id = $post->ID;
			$url = wp_get_attachment_url( $id );
			if ( ! $url ) {
				continue;
			}

			$meta = wp_get_attachment_metadata( $id );
			$thumb = wp_get_attachment_image_src( $id, 'medium' );
			$thumb_url = $thumb ? $thumb[0] : $url;

			$width  = isset( $meta['width'] ) ? (int) $meta['width'] : ( $thumb ? (int) $thumb[1] : 0 );
			$height = isset( $meta['height'] ) ? (int) $meta['height'] : ( $thumb ? (int) $thumb[2] : 0 );

			$items[] = [
				'id'            => $id,
				'title'         => get_the_title( $id ) ?: wp_basename( $url ),
				'filename'      => wp_basename( $url ),
				'url'           => $url,
				'thumbnail_url' => $thumb_url,
				'width'         => $width,
				'height'        => $height,
				'mime'          => get_post_mime_type( $id ) ?: 'image/png',
				'date'          => get_the_date( 'c', $id ),
			];
		}

		$response = new WP_REST_Response( [
			'success'     => true,
			'items'       => $items,
			'total'       => (int) $query->found_posts,
			'total_pages' => (int) $query->max_num_pages,
			'page'        => $page,
			'per_page'    => $per_page,
		] );

		$response->header( 'Access-Control-Allow-Origin', '*' );
		$response->header( 'Access-Control-Allow-Methods', 'GET, OPTIONS' );
		return $response;
	}

	/**
	 * REST Endpoint: Extract smooth multiply shadow and screen highlight PNG overlays from a neutral white render
	 */
	public static function rest_extract_shading( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$source_url = esc_url_raw( trim( $params['source_image_url'] ?? '' ) );
		$shadow_contrast = isset( $params['shadow_contrast'] ) ? max( 0.5, min( 2.5, (float) $params['shadow_contrast'] ) ) : 1.2;
		$highlight_contrast = isset( $params['highlight_contrast'] ) ? max( 0.5, min( 2.5, (float) $params['highlight_contrast'] ) ) : 1.0;

		if ( empty( $source_url ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Source image URL is required' ], 400 );
		}

		if ( ! extension_loaded( 'gd' ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'PHP GD extension is required on server for image extraction' ], 500 );
		}

		// Download or fetch source image
		$response = wp_remote_get( $source_url, [
			'timeout' => 30,
			'sslverify' => false,
			'headers' => [ 'User-Agent' => 'Exacoat-Manager/1.0' ],
		] );

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Unable to fetch source image: ' . ( is_wp_error( $response ) ? $response->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code( $response ) ) ], 400 );
		}

		$image_data = wp_remote_retrieve_body( $response );
		$src_img = @imagecreatefromstring( $image_data );
		if ( ! $src_img ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid image format. PNG with transparency is recommended.' ], 400 );
		}

		$width = imagesx( $src_img );
		$height = imagesy( $src_img );

		// Target directory in wp-content/uploads/configurator-shading/
		$upload_dir = wp_upload_dir();
		$shading_dir = trailingslashit( $upload_dir['basedir'] ) . 'configurator-shading';
		$shading_url = trailingslashit( $upload_dir['baseurl'] ) . 'configurator-shading';

		if ( ! file_exists( $shading_dir ) ) {
			wp_mkdir_p( $shading_dir );
		}

		// Find base luminance by sampling non-transparent pixels
		$lum_samples = [];
		for ( $y = 0; $y < $height; $y += 5 ) {
			for ( $x = 0; $x < $width; $x += 5 ) {
				$rgba = imagecolorat( $src_img, $x, $y );
				$a = ( $rgba >> 24 ) & 0x7F; // GD alpha: 0 = opaque, 127 = transparent
				if ( $a < 64 ) {
					$r = ( $rgba >> 16 ) & 0xFF;
					$g = ( $rgba >> 8 ) & 0xFF;
					$b = $rgba & 0xFF;
					$lum = 0.299 * $r + 0.587 * $g + 0.114 * $b;
					$lum_samples[] = $lum;
				}
			}
		}

		if ( empty( $lum_samples ) ) {
			imagedestroy( $src_img );
			return new WP_REST_Response( [ 'success' => false, 'message' => 'No visible skin pixels detected in source image' ], 400 );
		}

		sort( $lum_samples );
		// Median luminance is the flat neutral vinyl surface
		$base_lum = $lum_samples[ intval( count( $lum_samples ) * 0.5 ) ];
		if ( $base_lum < 180 ) {
			$base_lum = 240.0;
		}

		// Create TrueColor images with alpha channel
		$shadow_img = imagecreatetruecolor( $width, $height );
		imagealphablending( $shadow_img, false );
		imagesavealpha( $shadow_img, true );
		$transparent_black = imagecolorallocatealpha( $shadow_img, 0, 0, 0, 127 );
		imagefill( $shadow_img, 0, 0, $transparent_black );

		$highlight_img = imagecreatetruecolor( $width, $height );
		imagealphablending( $highlight_img, false );
		imagesavealpha( $highlight_img, true );
		$transparent_white = imagecolorallocatealpha( $highlight_img, 255, 255, 255, 127 );
		imagefill( $highlight_img, 0, 0, $transparent_white );

		for ( $y = 0; $y < $height; $y++ ) {
			for ( $x = 0; $x < $width; $x++ ) {
				$rgba = imagecolorat( $src_img, $x, $y );
				$gd_alpha = ( $rgba >> 24 ) & 0x7F; // 0 (opaque) to 127 (transparent)
				if ( $gd_alpha >= 120 ) {
					continue;
				}

				$r = ( $rgba >> 16 ) & 0xFF;
				$g = ( $rgba >> 8 ) & 0xFF;
				$b = $rgba & 0xFF;
				$lum = 0.299 * $r + 0.587 * $g + 0.114 * $b;
				$norm_alpha = ( 127 - $gd_alpha ) / 127.0; // 0.0 to 1.0

				// Shadow: where lum < base_lum
				if ( $lum < $base_lum ) {
					$shadow_factor = ( $base_lum - $lum ) / max( 1.0, $base_lum );
					$shadow_strength = min( 1.0, $shadow_factor * $shadow_contrast ) * $norm_alpha;
					if ( $shadow_strength > 0.01 ) {
						// In GD: 0 = opaque, 127 = transparent
						$gd_sh_alpha = intval( 127 - ( $shadow_strength * 127.0 ) );
						$col = imagecolorallocatealpha( $shadow_img, 0, 0, 0, max( 0, min( 127, $gd_sh_alpha ) ) );
						imagesetpixel( $shadow_img, $x, $y, $col );
					}
				}

				// Highlight: where lum > base_lum
				if ( $lum > $base_lum ) {
					$hl_factor = ( $lum - $base_lum ) / max( 1.0, 255.0 - $base_lum );
					$hl_strength = min( 1.0, $hl_factor * $highlight_contrast ) * $norm_alpha;
					if ( $hl_strength > 0.01 ) {
						$gd_hl_alpha = intval( 127 - ( $hl_strength * 127.0 ) );
						$col = imagecolorallocatealpha( $highlight_img, 255, 255, 255, max( 0, min( 127, $gd_hl_alpha ) ) );
						imagesetpixel( $highlight_img, $x, $y, $col );
					}
				}
			}
		}

		// Generate file names based on source hash
		$hash = substr( md5( $source_url ), 0, 10 );
		$filename_base = sanitize_title( pathinfo( parse_url( $source_url, PHP_URL_PATH ), PATHINFO_FILENAME ) );
		if ( empty( $filename_base ) ) $filename_base = 'shading';

		$shadow_filename = "{$filename_base}-shadow-{$hash}.png";
		$highlight_filename = "{$filename_base}-highlight-{$hash}.png";

		$shadow_path = $shading_dir . '/' . $shadow_filename;
		$highlight_path = $shading_dir . '/' . $highlight_filename;

		imagepng( $shadow_img, $shadow_path, 8 );
		imagepng( $highlight_img, $highlight_path, 8 );

		imagedestroy( $src_img );
		imagedestroy( $shadow_img );
		imagedestroy( $highlight_img );

		$res = new WP_REST_Response( [
			'success'       => true,
			'message'       => 'Shadow and highlight overlays extracted successfully.',
			'shadow_url'    => $shading_url . '/' . $shadow_filename,
			'highlight_url' => $shading_url . '/' . $highlight_filename,
			'base_lum'      => round( $base_lum, 1 ),
		] );
		$res->header( 'Access-Control-Allow-Origin', '*' );
		return $res;
	}

	/**
	 * Safe JSON parser for string or array meta values with unescaping support
	 */
	public static function parse_meta_json( $raw ) {
		if ( empty( $raw ) ) return [];
		if ( is_array( $raw ) ) return $raw;
		if ( is_string( $raw ) ) {
			$cur = trim( $raw );
			for ( $i = 0; $i < 3; $i++ ) {
				$decoded = json_decode( $cur, true );
				if ( is_array( $decoded ) ) return $decoded;
				if ( is_string( $decoded ) ) {
					$cur = $decoded;
					continue;
				}
				$unescaped = stripslashes( $cur );
				$decoded2 = json_decode( $unescaped, true );
				if ( is_array( $decoded2 ) ) return $decoded2;
				break;
			}
		}
		return [];
	}

	/**
	 * Permanently persist rendered configurator composite preview image into WordPress uploads/composites.
	 */
	public static function rest_upload_composite( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$raw_key = sanitize_text_field( $params['key'] ?? '' );
		$data_url = $params['dataUrl'] ?? ( $params['data_url'] ?? '' );

		if ( empty( $raw_key ) || empty( $data_url ) || ! is_string( $data_url ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Missing required key or dataUrl parameters.',
			], 400 );
		}

		$clean_key = preg_replace( '/[^a-zA-Z0-9_-]/', '_', $raw_key );
		$clean_key = substr( $clean_key, 0, 120 );

		if ( ! preg_match( '/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/', $data_url, $matches ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Invalid image data URL format.',
			], 400 );
		}

		$ext = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
		$image_binary = base64_decode( $matches[2] );
		if ( ! $image_binary ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Failed to decode base64 image data.',
			], 400 );
		}

		$upload_dir = wp_upload_dir();
		$composites_dir = trailingslashit( $upload_dir['basedir'] ) . 'composites';
		$composites_url = trailingslashit( $upload_dir['baseurl'] ) . 'composites';

		if ( ! file_exists( $composites_dir ) ) {
			wp_mkdir_p( $composites_dir );
		}

		$filename = $clean_key . '.' . $ext;
		$filepath = trailingslashit( $composites_dir ) . $filename;
		$file_saved = @file_put_contents( $filepath, $image_binary );

		if ( false === $file_saved ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Could not write composite image file to disk.',
			], 500 );
		}

		$public_url = trailingslashit( $composites_url ) . $filename;

		$response = new WP_REST_Response( [
			'success' => true,
			'key'     => $clean_key,
			'url'     => $public_url,
		], 200 );

		$response->header( 'Access-Control-Allow-Origin', '*' );
		$response->header( 'Access-Control-Allow-Methods', 'POST, GET, OPTIONS' );

		return $response;
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
			$size_multiplier = 2.0;
		} elseif ( strpos( $cat_lower, 'pad' ) !== false || strpos( $cat_lower, 'tablet' ) !== false ) {
			$family = 'tablet';
			$size_multiplier = 2.0;
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
				$slug = strtolower( preg_replace( '/[^a-z0-9]+/i', '_', $name ) );
				$slug = trim( $slug, '_' );
				$views[] = [
					'id'                => $slug ?: ( 'view_' . ( $a['_id'] ?? $order_idx ) ),
					'legacy_id'         => $a['_id'] ?? null,
					'name'              => $name,
					'is_default'        => $order_idx === 0,
					'aspect_ratio'      => '1:1',
					'canvas_dimensions' => [ 'width' => 1000, 'height' => 1000 ],
					'background_url'    => '',
					'texture_scale'     => 0.75,
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
				'background_url'    => '',
				'texture_scale'     => 0.75,
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

		// Find "Device" layer in MKL to extract base hardware body render
		$device_body_by_view = [];
		if ( is_array( $layers ) ) {
			foreach ( $layers as $l ) {
				$l_name = strtolower( trim( $l['name'] ?? '' ) );
				if ( $l_name === 'device' || strpos( (string) ( $l['class_name'] ?? '' ), 'device-body' ) !== false ) {
					$dev_choices = $content_by_layer[ $l['_id'] ?? 0 ] ?? [];
					foreach ( $dev_choices as $ch ) {
						if ( ! empty( $ch['images'] ) && is_array( $ch['images'] ) ) {
							foreach ( $ch['images'] as $img_obj ) {
								$url = $img_obj['image']['url'] ?? '';
								if ( empty( $url ) ) continue;
								$angle_id = $img_obj['angleId'] ?? null;
								$angle_name = $img_obj['angle_name'] ?? '';

								$matched = false;
								foreach ( $views as $v ) {
									if ( ( $angle_id && (int) ( $v['legacy_id'] ?? 0 ) === (int) $angle_id ) || ( $angle_name && strcasecmp( $v['name'], $angle_name ) === 0 ) ) {
										$device_body_by_view[ $v['id'] ] = $url;
										$matched = true;
									}
								}
								if ( ! $matched ) {
									foreach ( $views as $v ) {
										if ( empty( $device_body_by_view[ $v['id'] ] ) ) {
											$device_body_by_view[ $v['id'] ] = $url;
										}
									}
								}
							}
						}
					}
				}
			}
		}

		// Assign device body URL to views background_url
		foreach ( $views as &$v ) {
			if ( ! empty( $device_body_by_view[ $v['id'] ] ) ) {
				$v['background_url'] = $device_body_by_view[ $v['id'] ];
			}
		}
		unset( $v );

		// Convert Layers
		$normalized_layers = [];
		$variants = [];
		$logo_cutout_by_view = [];
		$has_logo_layer = false;

		if ( is_array( $layers ) ) {
			foreach ( $layers as $idx => $l ) {
				$layer_name = trim( $l['name'] ?? '' );
				if ( empty( $layer_name ) ) continue;
				$layer_name_lower = strtolower( $layer_name );

				// Device layer is the hardware chassis render (Layer 1 base image), not a configurable skin layer
				if ( $layer_name_lower === 'device' || strpos( (string) ( $l['class_name'] ?? '' ), 'device-body' ) !== false ) {
					continue;
				}

				$layer_id_num = $l['_id'] ?? $idx;
				$layer_slug = sanitize_title( $layer_name );
				$is_required = ( ( $l['required'] ?? '' ) === '1' || ( $l['required'] ?? false ) === true );
				$is_optional = ( ( $l['can_deselect'] ?? '' ) === '1' || strpos( (string) ( $l['class_name'] ?? '' ), 'optional' ) !== false );
				$is_selector = strpos( (string) ( $l['class_name'] ?? '' ), 'none-hover' ) !== false || in_array( $layer_name_lower, [ 'model', 'series', 'iphone model', 'ipad series', 'ipad version', 'device model', 'connectivity' ] );
				$is_logo = ( strpos( $layer_name_lower, 'logo' ) !== false || strpos( $layer_name_lower, 'cutout' ) !== false );
				$is_coverage = ( strpos( $layer_name_lower, 'coverage' ) !== false || strpos( $layer_name_lower, 'model cut' ) !== false || strpos( $layer_name_lower, 'model 360' ) !== false );

				$raw_choices = $content_by_layer[ $layer_id_num ] ?? [];

				if ( $is_logo ) {
					$has_logo_layer = true;
					foreach ( $raw_choices as $ch ) {
						$ch_name_lower = strtolower( $ch['name'] ?? '' );
						if ( ! empty( $ch['images'] ) && is_array( $ch['images'] ) ) {
							foreach ( $ch['images'] as $img_obj ) {
								$url = $img_obj['image']['url'] ?? '';
								if ( empty( $url ) ) continue;
								$angle_id = $img_obj['angleId'] ?? null;
								$angle_name = $img_obj['angle_name'] ?? '';

								$matched = false;
								foreach ( $views as $v ) {
									if ( ( $angle_id && (int) ( $v['legacy_id'] ?? 0 ) === (int) $angle_id ) || ( $angle_name && strcasecmp( $v['name'], $angle_name ) === 0 ) ) {
										$logo_cutout_by_view[ $v['id'] ] = $url;
										$matched = true;
									}
								}
								if ( ! $matched ) {
									foreach ( $views as $v ) {
										if ( empty( $logo_cutout_by_view[ $v['id'] ] ) ) {
											$logo_cutout_by_view[ $v['id'] ] = $url;
										}
									}
								}
							}
						}
					}
					// Logo Cutout is managed by coverage_and_cutouts, strictly not a production variant
					continue;
				}

				if ( $is_coverage ) {
					// Coverage is managed by coverage_and_cutouts, strictly not a production variant
					continue;
				}

				if ( $is_selector ) {
					$options = [];
					foreach ( $raw_choices as $ch ) {
						if ( empty( $ch['is_group'] ) && ! empty( $ch['name'] ) ) {
							$opt_img = '';
							if ( ! empty( $ch['images'] ) && is_array( $ch['images'] ) ) {
								foreach ( $ch['images'] as $img_obj ) {
									if ( ! empty( $img_obj['image']['url'] ) ) {
										$opt_img = $img_obj['image']['url'];
										break;
									}
								}
							}
							$price_val = isset( $ch['price'] ) ? (float) $ch['price'] : ( isset( $ch['extra_price'] ) ? (float) $ch['extra_price'] : 0 );
							$options[] = [
								'id'         => sanitize_title( $ch['name'] ),
								'name'       => $ch['name'],
								'price_diff' => $price_val,
								'image_url'  => $opt_img,
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

				// Build texture map for this layer across all views
				$assets_by_view = [];
				foreach ( $views as $v ) {
					$assets_by_view[ $v['id'] ] = [
						'render_texture_map'     => [],
						'base_hardware_body_url' => $device_body_by_view[ $v['id'] ] ?? '',
					];
				}
				$assets_by_view['main_view'] = [
					'render_texture_map'     => [],
					'base_hardware_body_url' => reset( $device_body_by_view ) ?: '',
				];

				$layer_extra_price = 0;

				foreach ( $raw_choices as $ch ) {
					if ( ! empty( $ch['is_group'] ) ) continue;
					$ch_name = $ch['name'] ?? '';
					$ch_slug = sanitize_title( $ch_name );
					$ch_price = isset( $ch['price'] ) ? (float) $ch['price'] : ( isset( $ch['extra_price'] ) ? (float) $ch['extra_price'] : 0 );
					if ( $ch_price > 0 && $layer_extra_price === 0 ) {
						$layer_extra_price = $ch_price;
					}

					if ( ! empty( $ch['images'] ) && is_array( $ch['images'] ) ) {
						foreach ( $ch['images'] as $img_obj ) {
							$url = $img_obj['image']['url'] ?? '';
							if ( empty( $url ) ) continue;

							$angle_id = $img_obj['angleId'] ?? null;
							$angle_name = $img_obj['angle_name'] ?? '';

							$matched = false;
							foreach ( $views as $v ) {
								if ( ( $angle_id && (int) ( $v['legacy_id'] ?? 0 ) === (int) $angle_id ) || ( $angle_name && strcasecmp( $v['name'], $angle_name ) === 0 ) ) {
									$assets_by_view[ $v['id'] ]['render_texture_map'][ $ch_slug ] = $url;
									$matched = true;
								}
							}

							if ( ! $matched || count( $views ) === 1 ) {
								foreach ( $views as $v ) {
									$assets_by_view[ $v['id'] ]['render_texture_map'][ $ch_slug ] = $url;
								}
							}

							$assets_by_view['main_view']['render_texture_map'][ $ch_slug ] = $url;
						}
					}
				}

				$layer_finish_slugs = [];
				foreach ( $raw_choices as $ch ) {
					if ( empty( $ch['is_group'] ) && ! empty( $ch['name'] ) ) {
						$layer_finish_slugs[] = sanitize_title( $ch['name'] );
					}
				}
				$layer_finish_slugs = array_values( array_unique( $layer_finish_slugs ) );

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
					'allowed_finish_slugs'  => ( count( $layer_finish_slugs ) > 0 && count( $layer_finish_slugs ) < 15 ) ? $layer_finish_slugs : [],
					'assets_by_view'        => $assets_by_view,
				];
			}
		}

		// Assign logo cutout mask to views if discovered
		foreach ( $views as &$v ) {
			if ( ! empty( $logo_cutout_by_view[ $v['id'] ] ) ) {
				$v['logo_cutout_mask_url'] = $logo_cutout_by_view[ $v['id'] ];
				$v['logo_image_url'] = $logo_cutout_by_view[ $v['id'] ];
			}
		}
		unset( $v );

		$primary_logo_url = reset( $logo_cutout_by_view ) ?: '';
		$coverage_and_cutouts = [
			'has_logo_cutout'       => $has_logo_layer || ! empty( $primary_logo_url ) || ( $family === 'laptop' ) || strpos( $cat_lower, 'macbook' ) !== false || strpos( $cat_lower, 'iphone' ) !== false,
			'logo_cutout_mask_url'  => $primary_logo_url,
			'has_pencil_cutout'     => false,
			'has_model_cut'         => false,
			'coverage_type'         => 'none',
			'model_360_extra_price' => 40000,
		];

		$base_price = (float) ( $product->get_price() ?: $product->get_regular_price() ?: 0 );

		return [
			'product_id'           => $product_id,
			'device_slug'          => $product->get_slug(),
			'device_name'          => $product->get_name(),
			'category'             => $main_cat,
			'family'               => $family,
			'base_price'           => $base_price,
			'currency'             => get_woocommerce_currency(),
			'size_multiplier'      => $size_multiplier,
			'texture_scale'        => isset( $views[0]['texture_scale'] ) ? (float) $views[0]['texture_scale'] : 0.75,
			'is_configurable'      => ! empty( $normalized_layers ),
			'configurator_version' => 'v1',
			'device_colors'        => [],
			'views'                => $views,
			'layers'               => $normalized_layers,
			'variants'             => self::sanitize_variants( $variants ),
			'coverage_and_cutouts' => $coverage_and_cutouts,
			'updated_at'           => current_time( 'mysql' ),
		];
	}

	/**
	 * Sanitize production variants array: strip out logo cutout and coverage options
	 */
	public static function sanitize_variants( $variants ): array {
		if ( ! is_array( $variants ) ) {
			return [];
		}
		$clean = [];
		foreach ( $variants as $v ) {
			if ( ! is_array( $v ) ) continue;
			$v_id = strtolower( (string) ( $v['id'] ?? '' ) );
			$v_name = strtolower( (string) ( $v['name'] ?? '' ) );
			if ( strpos( $v_id, 'logo' ) !== false || strpos( $v_name, 'logo' ) !== false || strpos( $v_id, 'cutout' ) !== false || strpos( $v_id, 'coverage' ) !== false || strpos( $v_name, 'coverage' ) !== false || strpos( $v_name, 'model cut' ) !== false ) {
				continue;
			}
			$clean[] = $v;
		}
		return array_values( $clean );
	}

	/**
	 * REST Endpoint: Fetch list of all product profiles summary
	 */
	public static function rest_get_configurator_profiles( WP_REST_Request $request ): WP_REST_Response {
		$page = max( 1, (int) $request->get_param( 'page' ) ?: 1 );
		$per_page_param = $request->get_param( 'per_page' );
		if ( $per_page_param === '-1' || (int) $per_page_param === -1 ) {
			$per_page = 500;
		} else {
			$per_page = max( 10, min( 500, (int) $per_page_param ?: 100 ) );
		}
		$search = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
		$category = sanitize_text_field( $request->get_param( 'category' ) ?: '' );
		$only_configurable = $request->get_param( 'only_configurable' );
		$filter_configurable = ( $only_configurable === null || $only_configurable === 'true' || $only_configurable === '1' || $only_configurable === true );

		$args = [
			'post_type'      => 'product',
			'post_status'    => [ 'publish', 'draft' ],
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

			$is_cfg = self::is_product_configurator( $pid, $profile_data );

			// If only_configurable is requested, exclude non-configurator items (merch, cases, drops)
			if ( $filter_configurable && ! $is_cfg ) {
				continue;
			}

			$product = wc_get_product( $pid );
			$cats = wp_get_post_terms( $pid, 'product_cat', [ 'fields' => 'names' ] );

			$last_audited = get_post_meta( $pid, self::AUDIT_TIME_META_KEY, true );
			$audit_status = get_post_meta( $pid, self::AUDIT_STATUS_META_KEY, true );
			$audit_issues = (int) get_post_meta( $pid, self::AUDIT_ISSUES_META_KEY, true );

			$profiles[] = [
				'product_id'           => $pid,
				'name'                 => $product ? $product->get_name() : $p->post_title,
				'slug'                 => $product ? $product->get_slug() : $p->post_name,
				'status'               => $product ? $product->get_status() : $p->post_status,
				'price'                => $product ? (float) $product->get_price() : 0,
				'categories'           => $cats,
				'is_migrated'          => $is_migrated,
				'configurator_version' => $profile_data['configurator_version'] ?? 'v1',
				'is_configurable'      => ! empty( $profile_data['layers'] ),
				'is_configurator'      => $is_cfg,
				'layers_count'         => count( $profile_data['layers'] ?? [] ),
				'views_count'          => count( $profile_data['views'] ?? [] ),
				'family'               => $profile_data['family'] ?? 'phone',
				'size_multiplier'      => ( in_array( $profile_data['family'] ?? '', [ 'laptop', 'tablet' ], true ) && in_array( (float) ( $profile_data['size_multiplier'] ?? 1.0 ), [ 2.5, 1.8, 1.0 ], true ) ) ? 2.0 : ( $profile_data['size_multiplier'] ?? 1.0 ),
				'texture_scale'        => isset( $profile_data['views'][0]['texture_scale'] ) ? (float) $profile_data['views'][0]['texture_scale'] : ( isset( $profile_data['texture_scale'] ) ? (float) $profile_data['texture_scale'] : 0.75 ),
				'last_audited_at'      => ! empty( $last_audited ) ? $last_audited : null,
				'audit_status'         => ! empty( $audit_status ) ? $audit_status : 'unaudited',
				'audit_issues'         => $audit_issues,
			];
		}

		return rest_ensure_response( [
			'success'     => true,
			'profiles'    => $profiles,
			'total'       => count( $profiles ),
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
		$profile = null;
		if ( ! empty( $modern_profile ) ) {
			if ( is_array( $modern_profile ) ) {
				$profile = $modern_profile;
			} elseif ( is_string( $modern_profile ) ) {
				$profile = json_decode( $modern_profile, true );
				if ( ! is_array( $profile ) ) {
					$profile = json_decode( wp_unslash( $modern_profile ), true );
				}
			}
		}
		
		if ( empty( $profile ) || ! is_array( $profile ) ) {
			// Auto-convert legacy MKL on-the-fly
			$profile = self::convert_mkl_to_profile( $product_id );
		}

		$product = wc_get_product( $product_id );
		if ( $profile && is_array( $profile ) ) {
			if ( $product ) {
				$profile['status'] = $product->get_status();
			}
			$profile['variants'] = self::sanitize_variants( $profile['variants'] ?? [] );
			if ( ! empty( $profile['coverage_and_cutouts'] ) && is_array( $profile['coverage_and_cutouts'] ) ) {
				if ( ! isset( $profile['coverage_and_cutouts']['model_360_extra_price'] ) || ! is_numeric( $profile['coverage_and_cutouts']['model_360_extra_price'] ) ) {
					$profile['coverage_and_cutouts']['model_360_extra_price'] = 40000;
				}
			}
		}

		return rest_ensure_response( [
			'success'        => true,
			'profile'        => $profile,
			'finishes'       => self::get_finishes(),
			'groups'         => self::get_finish_groups(),
			'group_settings' => self::get_finish_group_settings(),
			'presets'        => self::get_configurator_presets(),
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

		$raw_coverage = is_array( $params['coverage_and_cutouts'] ?? null ) ? $params['coverage_and_cutouts'] : null;
		if ( is_array( $raw_coverage ) ) {
			if ( ! isset( $raw_coverage['model_360_extra_price'] ) || ! is_numeric( $raw_coverage['model_360_extra_price'] ) ) {
				$raw_coverage['model_360_extra_price'] = 40000;
			} else {
				$raw_coverage['model_360_extra_price'] = (float) $raw_coverage['model_360_extra_price'];
			}
		}

		$profile = [
			'product_id'           => $product_id,
			'device_slug'          => sanitize_title( $params['device_slug'] ?? '' ),
			'device_name'          => sanitize_text_field( $params['device_name'] ?? '' ),
			'category'             => sanitize_text_field( $params['category'] ?? '' ),
			'family'               => sanitize_text_field( $params['family'] ?? 'phone' ),
			'base_price'           => (float) ( $params['base_price'] ?? 0 ),
			'currency'             => sanitize_text_field( $params['currency'] ?? 'IDR' ),
			'size_multiplier'      => (float) ( $params['size_multiplier'] ?? 1.0 ),
			'texture_scale'        => isset( $params['texture_scale'] ) ? (float) $params['texture_scale'] : 0.75,
			'configurator_version' => in_array( $params['configurator_version'] ?? '', [ 'v1', 'v2' ], true ) ? $params['configurator_version'] : 'v2',
			'device_colors'        => is_array( $params['device_colors'] ?? null ) ? $params['device_colors'] : [],
			'views'                => is_array( $params['views'] ?? null ) ? $params['views'] : [],
			'layers'               => is_array( $params['layers'] ?? null ) ? $params['layers'] : [],
			'variants'             => self::sanitize_variants( $params['variants'] ?? [] ),
			'coverage_and_cutouts' => $raw_coverage,
			'updated_at'           => current_time( 'mysql' ),
		];

		// For v2 profiles, prune legacy per-layer shading/shadow properties so universal view-level shading takes precedence
		if ( $profile['configurator_version'] === 'v2' && ! empty( $profile['layers'] ) ) {
			foreach ( $profile['layers'] as &$layer ) {
				if ( ! empty( $layer['assets_by_view'] ) && is_array( $layer['assets_by_view'] ) ) {
					foreach ( $layer['assets_by_view'] as &$view_asset ) {
						unset( $view_asset['shadow_png_url'], $view_asset['highlight_png_url'], $view_asset['shading_image_url'] );
					}
				}
			}
			unset( $layer );
		}

		// Use wp_slash so WordPress update_metadata does not strip quotes or slashes from JSON
		update_post_meta( $product_id, self::PROFILE_META_KEY, wp_slash( wp_json_encode( $profile ) ) );
		update_post_meta( $product_id, self::CONFIGURATOR_FLAG_META_KEY, 'yes' );
		update_post_meta( $product_id, '_configurator_version', $profile['configurator_version'] );
		update_post_meta( $product_id, '_device_family', $profile['family'] );
		update_post_meta( $product_id, '_size_multiplier', $profile['size_multiplier'] );

		// When saving a modern v2 profile, clean up conflicting obsolete MKL layers and content
		// so legacy fallback on duplicated products never shadows the v2 profile
		if ( $profile['configurator_version'] === 'v2' ) {
			delete_post_meta( $product_id, '_mkl_product_configurator_layers' );
			delete_post_meta( $product_id, '_mkl_product_configurator_content' );
		}

		// Sync WooCommerce product price with configurator base_price
		if ( isset( $params['base_price'] ) && (float) $params['base_price'] >= 0 ) {
			$product = wc_get_product( $product_id );
			if ( $product ) {
				$new_price = (float) $params['base_price'];
				$product->set_regular_price( $new_price );
				$product->set_price( $new_price );
				$product->save();
				update_post_meta( $product_id, '_regular_price', $new_price );
				update_post_meta( $product_id, '_price', $new_price );
			}
		}

		// Sync product status (publish / draft) if provided
		if ( ! empty( $params['status'] ) && in_array( $params['status'], [ 'publish', 'draft' ], true ) ) {
			$product = wc_get_product( $product_id );
			if ( $product ) {
				$product->set_status( $params['status'] );
				$product->save();
			}
			wp_update_post( [
				'ID'          => $product_id,
				'post_status' => $params['status'],
			] );
			$profile['status'] = $params['status'];
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'configurator', "Configurator profile updated for Product #{$product_id} ({$profile['device_name']})" );
		}

		// Trigger storefront Next.js ISR revalidation and Cloudflare cache purge
		$reval_results = self::trigger_storefront_revalidation( [
			'slug'     => $profile['device_slug'] ?? '',
			'category' => $profile['category'] ?? '',
		] );

		return rest_ensure_response( [
			'success'      => true,
			'message'      => "Configurator profile saved successfully.",
			'profile'      => $profile,
			'revalidation' => $reval_results,
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
	/**
	 * REST Endpoint: Set WooCommerce product price and sync configurator profile base_price
	 */
	public static function rest_set_product_price( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$product_id = (int) ( $params['product_id'] ?? 0 );
		$price = isset( $params['price'] ) ? (float) $params['price'] : null;

		if ( ! $product_id || $price === null || $price < 0 ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Valid product_id and non-negative price are required' ], 400 );
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Product not found' ], 404 );
		}

		$product->set_regular_price( $price );
		$product->set_price( $price );
		$product->save();

		update_post_meta( $product_id, '_regular_price', $price );
		update_post_meta( $product_id, '_price', $price );

		// Update base_price in profile metadata if present
		$meta = get_post_meta( $product_id, self::PROFILE_META_KEY, true );
		if ( ! empty( $meta ) ) {
			$profile = is_string( $meta ) ? json_decode( $meta, true ) : $meta;
			if ( is_array( $profile ) ) {
				$profile['base_price'] = $price;
				update_post_meta( $product_id, self::PROFILE_META_KEY, wp_json_encode( $profile ) );
			}
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'configurator', "Price updated to IDR {$price} for Product #{$product_id} ({$product->get_name()})" );
		}

		// Trigger storefront Next.js ISR revalidation and Cloudflare cache purge
		$reval_results = self::trigger_storefront_revalidation( [
			'slug' => $product->get_slug(),
		] );

		return rest_ensure_response( [
			'success'      => true,
			'product_id'   => $product_id,
			'price'        => $price,
			'message'      => "Price updated successfully to IDR " . number_format( $price, 0, ',', '.' ),
			'revalidation' => $reval_results,
		] );
	}

	/**
	 * REST Endpoint: Duplicate WooCommerce product and its configurator profile
	 */
	public static function rest_duplicate_product( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$source_id = (int) ( $params['source_product_id'] ?? 0 );
		$new_name = sanitize_text_field( $params['new_name'] ?? '' );
		$new_slug = sanitize_title( $params['new_slug'] ?? '' );
		$new_price = isset( $params['new_price'] ) ? (float) $params['new_price'] : null;
		$copy_configurator = ! empty( $params['copy_configurator'] );

		if ( ! $source_id ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Valid source_product_id is required' ], 400 );
		}

		$source_product = wc_get_product( $source_id );
		if ( ! $source_product ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Source product not found' ], 404 );
		}

		if ( empty( $new_name ) ) {
			$new_name = $source_product->get_name() . ' (Copy)';
		}

		if ( empty( $new_slug ) ) {
			$new_slug = sanitize_title( $new_name );
		}

		$short_desc = $source_product->get_short_description();
		$long_desc  = $source_product->get_description();
		$menu_order = (int) $source_product->get_menu_order();

		$new_product = null;
		if ( function_exists( 'wc_duplicate_product' ) ) {
			$new_product = wc_duplicate_product( $source_product );
		}

		if ( ! $new_product ) {
			// Fallback product creation
			$new_pid = wp_insert_post( [
				'post_title'   => $new_name,
				'post_name'    => $new_slug,
				'post_type'    => 'product',
				'post_status'  => 'draft',
				'post_content' => $long_desc,
				'post_excerpt' => $short_desc,
				'menu_order'   => $menu_order,
			] );

			if ( is_wp_error( $new_pid ) ) {
				return new WP_REST_Response( [ 'success' => false, 'message' => $new_pid->get_error_message() ], 500 );
			}

			$new_product = wc_get_product( $new_pid );
		}

		if ( ! $new_product ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Failed creating duplicate product' ], 500 );
		}

		$new_pid = $new_product->get_id();
		$new_product->set_name( $new_name );
		$new_product->set_slug( $new_slug );
		// Status must strictly be draft
		$new_product->set_status( 'draft' );

		// Set descriptions and menu order
		if ( ! empty( $short_desc ) ) {
			$new_product->set_short_description( $short_desc );
		}
		if ( ! empty( $long_desc ) ) {
			$new_product->set_description( $long_desc );
		}
		$new_product->set_menu_order( $menu_order );

		// Duplicate Featured Image (_thumbnail_id)
		$source_thumb_id = (int) $source_product->get_image_id();
		if ( $source_thumb_id > 0 ) {
			$new_product->set_image_id( $source_thumb_id );
			update_post_meta( $new_pid, '_thumbnail_id', $source_thumb_id );
		}

		// Duplicate Product Gallery (_product_image_gallery)
		$source_gallery = $source_product->get_gallery_image_ids();
		if ( ! empty( $source_gallery ) ) {
			$new_product->set_gallery_image_ids( $source_gallery );
			update_post_meta( $new_pid, '_product_image_gallery', implode( ',', $source_gallery ) );
		}

		// Set price
		$price_to_set = ( $new_price !== null && $new_price > 0 ) ? $new_price : (float) $source_product->get_price();
		if ( $price_to_set > 0 ) {
			$new_product->set_regular_price( $price_to_set );
			$new_product->set_price( $price_to_set );
		}

		// Set catalog visibility
		$new_product->set_catalog_visibility( $source_product->get_catalog_visibility() );

		$new_product->save();

		// Explicitly ensure post status is draft in wp_posts
		wp_update_post( [
			'ID'           => $new_pid,
			'post_status'  => 'draft',
			'post_excerpt' => $short_desc,
			'post_content' => $long_desc,
			'menu_order'   => $menu_order,
		] );

		update_post_meta( $new_pid, '_regular_price', $price_to_set );
		update_post_meta( $new_pid, '_price', $price_to_set );

		// Copy Categories
		$source_cats = wp_get_post_terms( $source_id, 'product_cat', [ 'fields' => 'ids' ] );
		if ( ! empty( $source_cats ) && ! is_wp_error( $source_cats ) ) {
			wp_set_post_terms( $new_pid, $source_cats, 'product_cat' );
		}

		// Copy Tags
		$source_tags = wp_get_post_terms( $source_id, 'product_tag', [ 'fields' => 'ids' ] );
		if ( ! empty( $source_tags ) && ! is_wp_error( $source_tags ) ) {
			wp_set_post_terms( $new_pid, $source_tags, 'product_tag' );
		}

		// Copy Configurator Post Meta Flags & Family
		$is_cfg = get_post_meta( $source_id, self::CONFIGURATOR_FLAG_META_KEY, true );
		update_post_meta( $new_pid, self::CONFIGURATOR_FLAG_META_KEY, ! empty( $is_cfg ) ? $is_cfg : 'yes' );

		$family = get_post_meta( $source_id, '_device_family', true );
		if ( $family ) {
			update_post_meta( $new_pid, '_device_family', $family );
		}
		$size_mult = get_post_meta( $source_id, '_size_multiplier', true );
		if ( $size_mult ) {
			update_post_meta( $new_pid, '_size_multiplier', $size_mult );
		}
		$cfg_ver = get_post_meta( $source_id, '_configurator_version', true );
		if ( $cfg_ver ) {
			update_post_meta( $new_pid, '_configurator_version', $cfg_ver );
		}

		// Clean audit stamps so duplicate product starts fresh as unaudited
		delete_post_meta( $new_pid, self::AUDIT_TIME_META_KEY );
		delete_post_meta( $new_pid, self::AUDIT_STATUS_META_KEY );
		delete_post_meta( $new_pid, self::AUDIT_ISSUES_META_KEY );

		// Copy Configurator Profile if requested
		if ( $copy_configurator ) {
			$source_profile_raw = get_post_meta( $source_id, self::PROFILE_META_KEY, true );
			if ( ! empty( $source_profile_raw ) ) {
				$profile = is_string( $source_profile_raw ) ? json_decode( $source_profile_raw, true ) : $source_profile_raw;
			} else {
				$profile = self::convert_mkl_to_profile( $source_id );
			}

			if ( is_array( $profile ) ) {
				$profile['product_id'] = $new_pid;
				$profile['device_name'] = $new_name;
				$profile['device_slug'] = $new_slug;
				$profile['status'] = 'draft';
				if ( $price_to_set > 0 ) {
					$profile['base_price'] = $price_to_set;
				}
				// Note: Always use wp_slash(wp_json_encode()) to prevent unslashing corruption
				update_post_meta( $new_pid, self::PROFILE_META_KEY, wp_slash( wp_json_encode( $profile ) ) );
			}

			// Copy legacy MKL metadata for backward compatibility
			foreach ( [ '_mkl_product_configurator_angles', '_mkl_product_configurator_layers', '_mkl_product_configurator_content', '_mkl_pc__is_configurable' ] as $mkl_key ) {
				$mkl_val = get_post_meta( $source_id, $mkl_key, true );
				if ( ! empty( $mkl_val ) ) {
					update_post_meta( $new_pid, $mkl_key, $mkl_val );
				}
			}
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'configurator', "Product duplicated: #{$source_id} to #{$new_pid} ({$new_name}) in draft status" );
		}

		// Trigger storefront Next.js ISR revalidation and Cloudflare cache purge
		$reval_results = self::trigger_storefront_revalidation( [
			'slug' => $new_slug,
		] );

		return rest_ensure_response( [
			'success'      => true,
			'product_id'   => $new_pid,
			'name'         => $new_name,
			'slug'         => $new_slug,
			'price'        => $price_to_set,
			'status'       => 'draft',
			'message'      => "Product duplicated successfully as draft #{$new_pid} ({$new_name})",
			'revalidation' => $reval_results,
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

	const ADDON_SCHEMAS_OPTION_KEY = 'exacoat_addon_schemas';

	public static function rest_get_addon_schemas( WP_REST_Request $request ): WP_REST_Response {
		$schemas = get_option( self::ADDON_SCHEMAS_OPTION_KEY, null );
		return new WP_REST_Response( [
			'success' => true,
			'schemas' => $schemas,
		], 200 );
	}

	public static function rest_save_addon_schemas( WP_REST_Request $request ): WP_REST_Response {
		$schemas = $request->get_param( 'schemas' );
		if ( empty( $schemas ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Schema payload is required.',
			], 400 );
		}
		update_option( self::ADDON_SCHEMAS_OPTION_KEY, $schemas );
		return new WP_REST_Response( [
			'success' => true,
			'message' => 'Addon schemas updated successfully.',
		], 200 );
	}

	/**
	 * Sorts configurator addon layers so Back Skin / primary base layer appears on top.
	 */
	public static function sort_addon_layers( array $addons ): array {
		if ( count( $addons ) <= 1 ) {
			return $addons;
		}
		usort( $addons, function( $a, $b ) {
			$label_a = strtolower( trim( $a['label'] ?? ( $a['key'] ?? ( $a['name'] ?? '' ) ) ) );
			$label_b = strtolower( trim( $b['label'] ?? ( $b['key'] ?? ( $b['name'] ?? '' ) ) ) );

			$is_back_a = ( false !== strpos( $label_a, 'back' ) ) && ( false === strpos( $label_a, 'camera' ) ) && ( false === strpos( $label_a, 'glass' ) );
			$is_back_b = ( false !== strpos( $label_b, 'back' ) ) && ( false === strpos( $label_b, 'camera' ) ) && ( false === strpos( $label_b, 'glass' ) );
			if ( $is_back_a && ! $is_back_b ) return -1;
			if ( ! $is_back_a && $is_back_b ) return 1;

			$is_primary_a = ( false !== strpos( $label_a, 'top lid' ) ) || ( false !== strpos( $label_a, 'main body' ) ) || 'skin' === $label_a || 'body' === $label_a;
			$is_primary_b = ( false !== strpos( $label_b, 'top lid' ) ) || ( false !== strpos( $label_b, 'main body' ) ) || 'skin' === $label_b || 'body' === $label_b;
			if ( $is_primary_a && ! $is_primary_b ) return -1;
			if ( ! $is_primary_a && $is_primary_b ) return 1;

			$is_cov_a = false !== strpos( $label_a, 'coverage' );
			$is_cov_b = false !== strpos( $label_b, 'coverage' );
			$is_logo_a = false !== strpos( $label_a, 'logo' );
			$is_logo_b = false !== strpos( $label_b, 'logo' );
			$is_pen_a = ( false !== strpos( $label_a, 'pencil' ) ) || ( false !== strpos( $label_a, 'stylus' ) ) || ( false !== strpos( $label_a, 's-pen' ) );
			$is_pen_b = ( false !== strpos( $label_b, 'pencil' ) ) || ( false !== strpos( $label_b, 'stylus' ) ) || ( false !== strpos( $label_b, 's-pen' ) );

			$rank_a = $is_cov_a ? 100 : ( $is_logo_a ? 101 : ( $is_pen_a ? 102 : 10 ) );
			$rank_b = $is_cov_b ? 100 : ( $is_logo_b ? 101 : ( $is_pen_b ? 102 : 10 ) );

			if ( $rank_a !== $rank_b ) {
				return $rank_a - $rank_b;
			}
			return 0;
		} );
		return $addons;
	}

	public static function add_addon_data_to_cart_item( $cart_item_data, $product_id, $variation_id ) {
		if ( ! empty( $_POST['exacoat_addon_data'] ) ) {
			$raw = wp_unslash( $_POST['exacoat_addon_data'] );
			$parsed = json_decode( $raw, true );
			if ( is_array( $parsed ) ) {
				$cart_item_data['exacoat_addons'] = self::sort_addon_layers( $parsed );
				$cart_item_data['unique_key'] = md5( microtime() . rand() );
			}
		}
		if ( ! empty( $_POST['exacoat_custom_price'] ) ) {
			$custom_price = floatval( $_POST['exacoat_custom_price'] );
			if ( $custom_price > 0 ) {
				$cart_item_data['exacoat_custom_price'] = $custom_price;
			}
		}
		if ( ! empty( $_POST['exacoat_custom_image'] ) ) {
			$cart_item_data['exacoat_custom_image'] = esc_url_raw( wp_unslash( $_POST['exacoat_custom_image'] ) );
		}
		return $cart_item_data;
	}

	public static function calculate_custom_addon_totals( $cart ) {
		if ( is_admin() && ! defined( 'DOING_AJAX' ) ) return;
		if ( did_action( 'woocommerce_before_calculate_totals' ) >= 2 ) return;

		foreach ( $cart->get_cart() as $cart_item_key => $cart_item ) {
			if ( isset( $cart_item['exacoat_custom_price'] ) && floatval( $cart_item['exacoat_custom_price'] ) > 0 ) {
				$cart_item['data']->set_price( floatval( $cart_item['exacoat_custom_price'] ) );
			}
		}
	}

	public static function display_custom_addons_in_cart( $item_data, $cart_item ) {
		if ( ! empty( $cart_item['exacoat_addons'] ) && is_array( $cart_item['exacoat_addons'] ) ) {
			$sorted = self::sort_addon_layers( $cart_item['exacoat_addons'] );
			foreach ( $sorted as $addon ) {
				if ( ! empty( $addon['label'] ) && ! empty( $addon['value'] ) ) {
					$item_data[] = [
						'key'   => sanitize_text_field( $addon['label'] ),
						'value' => sanitize_text_field( $addon['value'] ),
					];
				}
			}
		}
		return $item_data;
	}

	public static function save_custom_addons_to_order_item( $item, $cart_item_key, $values, $order ) {
		if ( ! empty( $values['exacoat_addons'] ) && is_array( $values['exacoat_addons'] ) ) {
			$sorted = self::sort_addon_layers( $values['exacoat_addons'] );
			foreach ( $sorted as $addon ) {
				if ( ! empty( $addon['label'] ) && ! empty( $addon['value'] ) ) {
					$item->add_meta_data( sanitize_text_field( $addon['label'] ), sanitize_text_field( $addon['value'] ), true );
				}
			}
		}
		if ( ! empty( $values['exacoat_custom_image'] ) ) {
			$img_url = esc_url_raw( $values['exacoat_custom_image'] );
			$item->add_meta_data( '_configured_image_url', $img_url, true );
			$item->add_meta_data( '_configurator_image', $img_url, true );
			$item->add_meta_data( '_thumbnail_url', $img_url, true );
			$item->add_meta_data( 'image_url', $img_url, true );
		}
	}

	/**
	 * Hook triggered when any product post is saved/updated in WordPress.
	 */
	public static function on_product_saved( $post_id, $post ): void {
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}
		if ( ! $post || 'product' !== $post->post_type ) {
			return;
		}
		$slug = $post->post_name;
		self::trigger_storefront_revalidation( [ 'slug' => $slug ] );
	}

	/**
	 * Dual Revalidation: triggers Next.js storefront on-demand ISR revalidation and Cloudflare Edge Cache purge.
	 */
	public static function trigger_storefront_revalidation( array $params = [] ): array {
		$slug      = sanitize_title( $params['slug'] ?? '' );
		$category  = sanitize_title( $params['category'] ?? '' );
		$tag       = sanitize_text_field( $params['tag'] ?? 'products' );
		$path      = sanitize_text_field( $params['path'] ?? '' );
		$purge_all = ! empty( $params['purge_everything'] );

		$results = [
			'nextjs'     => null,
			'cloudflare' => null,
		];

		// 1. Next.js storefront revalidation (web.exacoat.com)
		$storefront_base = defined( 'EXACOAT_STOREFRONT_URL' ) ? EXACOAT_STOREFRONT_URL : 'https://web.exacoat.com';
		$secret = defined( 'EXACOAT_REVALIDATE_SECRET' ) ? EXACOAT_REVALIDATE_SECRET : 'exacoat_revalidate_secret_2026';
		$revalidate_url = trailingslashit( $storefront_base ) . 'api/revalidate?secret=' . rawurlencode( $secret );

		$payload = [
			'tag'      => $tag,
			'slug'     => $slug,
			'category' => $category,
			'path'     => $path,
		];

		$response = wp_remote_post( $revalidate_url, [
			'headers' => [ 'Content-Type' => 'application/json' ],
			'body'    => wp_json_encode( $payload ),
			'timeout' => 8,
		] );

		if ( is_wp_error( $response ) ) {
			$results['nextjs'] = [
				'success' => false,
				'error'   => $response->get_error_message(),
			];
		} else {
			$status_code = wp_remote_retrieve_response_code( $response );
			$body = json_decode( wp_remote_retrieve_body( $response ), true );
			$results['nextjs'] = [
				'success'     => ( 200 === $status_code && ! empty( $body['success'] ) ),
				'status_code' => $status_code,
				'details'     => $body,
			];
		}

		// 2. Cloudflare Edge Cache Purge (if credentials configured)
		$zone_id = defined( 'EXA_CLOUDFLARE_ZONE_ID' ) ? EXA_CLOUDFLARE_ZONE_ID : ( defined( 'EXACOAT_CLOUDFLARE_ZONE_ID' ) ? EXACOAT_CLOUDFLARE_ZONE_ID : ( defined( 'CLOUDFLARE_ZONE_ID' ) ? CLOUDFLARE_ZONE_ID : ( defined( 'AM_CLOUDFLARE_ZONE_ID' ) ? AM_CLOUDFLARE_ZONE_ID : ( getenv( 'EXA_CLOUDFLARE_ZONE_ID' ) ?: ( class_exists( 'Exacoat_Core' ) ? Exacoat_Core::get_setting( 'cloudflare_zone_id', '' ) : '' ) ) ) ) );
		$api_token = defined( 'EXA_CLOUDFLARE_API_TOKEN' ) ? EXA_CLOUDFLARE_API_TOKEN : ( defined( 'EXACOAT_CLOUDFLARE_API_TOKEN' ) ? EXACOAT_CLOUDFLARE_API_TOKEN : ( defined( 'CLOUDFLARE_API_TOKEN' ) ? CLOUDFLARE_API_TOKEN : ( defined( 'AM_CLOUDFLARE_API_TOKEN' ) ? AM_CLOUDFLARE_API_TOKEN : ( getenv( 'EXA_CLOUDFLARE_API_TOKEN' ) ?: ( class_exists( 'Exacoat_Core' ) ? Exacoat_Core::get_setting( 'cloudflare_api_token', '' ) : '' ) ) ) ) );

		if ( ! empty( $zone_id ) && ! empty( $api_token ) ) {
			if ( $purge_all ) {
				$cf_payload = [ 'purge_everything' => true ];
			} else {
				$files = [
					'https://web.exacoat.com/',
					'https://web.exacoat.com/shop',
					'https://exacoat.com/',
					'https://exacoat.com/shop/',
				];
				if ( ! empty( $slug ) ) {
					$files[] = "https://web.exacoat.com/product/{$slug}";
					$files[] = "https://exacoat.com/product/{$slug}";
				}
				if ( ! empty( $category ) ) {
					$files[] = "https://web.exacoat.com/shop/{$category}";
				}
				$cf_payload = [ 'files' => array_values( array_unique( $files ) ) ];
			}

			$cf_res = wp_remote_post( 'https://api.cloudflare.com/client/v4/zones/' . rawurlencode( trim( $zone_id ) ) . '/purge_cache', [
				'headers' => [
					'Authorization' => 'Bearer ' . trim( $api_token ),
					'Content-Type'  => 'application/json',
				],
				'body'    => wp_json_encode( $cf_payload ),
				'timeout' => 12,
			] );

			if ( is_wp_error( $cf_res ) ) {
				$results['cloudflare'] = [
					'success' => false,
					'error'   => $cf_res->get_error_message(),
				];
			} else {
				$cf_code = wp_remote_retrieve_response_code( $cf_res );
				$cf_body = json_decode( wp_remote_retrieve_body( $cf_res ), true );
				$results['cloudflare'] = [
					'success'     => ( 200 === $cf_code && ! empty( $cf_body['success'] ) ),
					'status_code' => $cf_code,
					'details'     => $cf_body,
				];
			}
		} else {
			$results['cloudflare'] = [
				'configured' => false,
				'message'    => 'Cloudflare credentials not configured in wp-config.php or settings.',
			];
		}

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'configurator', "Storefront revalidation triggered for slug: '{$slug}', category: '{$category}'" );
		}

		return $results;
	}

	/**
	 * REST Endpoint: On-demand cache revalidation for web.exacoat.com and Cloudflare
	 */
	public static function rest_revalidate_web( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params() ?: $request->get_params();
		$results = self::trigger_storefront_revalidation( $params );

		return rest_ensure_response( [
			'success' => ( ! empty( $results['nextjs']['success'] ) || ! empty( $results['cloudflare']['success'] ) ),
			'results' => $results,
			'message' => 'Storefront web cache revalidation completed.',
		] );
	}
}

}

