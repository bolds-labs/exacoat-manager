<?php
/**
 * Artmatter High-Performance Native Wishlist Engine
 * 
 * Replaces heavy legacy plugins (YITH Wishlist) with an instant, client-first,
 * zero-database-bloat wishlist architecture for guests and logged-in customers.
 * 
 * Features:
 * - 0ms instant localStorage toggles for guests and logged-in users (no cache busting)
 * - Silent asynchronous REST API sync to user meta upon login
 * - Bricks Builder Dynamic Tags: {echo:artmatter_wishlist_button()}, {echo:artmatter_wishlist_count()}, {echo:artmatter_wishlist_page()}
 * - Shortcodes: [artmatter_wishlist], [artmatter_wishlist_button]
 * - Full interactive shop gallery matching Artmatter's luxury dark glassmorphism theme
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Wishlist_Engine' ) ) {

class Exacoat_Wishlist_Engine {

	const META_KEY = '_artmatter_wishlist';
	const REST_NAMESPACE = 'artmatter-core/v1';

	public static function init() {
		// REST API Endpoints
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// Frontend Assets
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_frontend_assets' ] );

		// Shortcodes
		add_shortcode( 'exacoat_wishlist', [ __CLASS__, 'render_wishlist_page_shortcode' ] );
		add_shortcode( 'artmatter_wishlist', [ __CLASS__, 'render_wishlist_page_shortcode' ] );
		add_shortcode( 'artmatter_wishlist_page', [ __CLASS__, 'render_wishlist_page_shortcode' ] );
		add_shortcode( 'artmatter_wishlist_archive', [ __CLASS__, 'render_wishlist_page_shortcode' ] );
		add_shortcode( 'artmatter_wishlist_button', [ __CLASS__, 'render_wishlist_button_shortcode' ] );
		add_shortcode( 'artmatter_wishlist_toggle', [ __CLASS__, 'render_wishlist_button_shortcode' ] );
		add_shortcode( 'artmatter_bookmark_button', [ __CLASS__, 'render_wishlist_button_shortcode' ] );
	}

	/**
	 * Register REST API Endpoints
	 */
	public static function register_rest_routes() {
		// GET /wp-json/artmatter-core/v1/wishlist/products?ids=1,2,3
		register_rest_route( self::REST_NAMESPACE, '/wishlist/products', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'rest_get_products' ],
			'permission_callback' => '__return_true',
		] );

		// POST /wp-json/artmatter-core/v1/wishlist/sync
		register_rest_route( self::REST_NAMESPACE, '/wishlist/sync', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_sync_wishlist' ],
			'permission_callback' => '__return_true',
		] );

		// POST /wp-json/artmatter-core/v1/wishlist/toggle
		register_rest_route( self::REST_NAMESPACE, '/wishlist/toggle', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'rest_toggle_item' ],
			'permission_callback' => '__return_true',
		] );
	}

	/**
	 * Retrieve saved wishlist IDs for a given user
	 */
	public static function get_user_wishlist( int $user_id = 0 ): array {
		if ( ! $user_id ) {
			$user_id = get_current_user_id();
		}
		if ( ! $user_id ) {
			return [];
		}

		$ids = get_user_meta( $user_id, self::META_KEY, true );
		if ( ! is_array( $ids ) ) {
			return [];
		}

		return array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
	}

	/**
	 * Save wishlist IDs for a given user
	 */
	public static function update_user_wishlist( int $user_id, array $ids ): bool {
		if ( ! $user_id ) {
			return false;
		}

		$sanitized = array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
		return (bool) update_user_meta( $user_id, self::META_KEY, $sanitized );
	}

	/**
	 * Enqueue CSS & JS Assets
	 */
	public static function enqueue_frontend_assets() {
		$core_url = defined( 'EXACOAT_CORE_URL' ) ? EXACOAT_CORE_URL : ( defined( 'ARTMATTER_CORE_URL' ) ? ARTMATTER_CORE_URL : plugin_dir_url( dirname( __DIR__ ) . '/exacoat-core.php' ) );
		$core_ver = defined( 'EXACOAT_CORE_VERSION' ) ? EXACOAT_CORE_VERSION : ( defined( 'ARTMATTER_CORE_VERSION' ) ? ARTMATTER_CORE_VERSION : '0.0.32' );

		wp_enqueue_style(
			'exacoat-wishlist-css',
			$core_url . 'assets/css/wishlist-engine.css',
			[],
			$core_ver
		);

		wp_enqueue_script(
			'exacoat-wishlist-js',
			$core_url . 'assets/js/wishlist-engine.js',
			[],
			$core_ver,
			true
		);

		$user_id = get_current_user_id();
		$user_ids = $user_id ? self::get_user_wishlist( $user_id ) : [];

		wp_localize_script( 'artmatter-wishlist-js', 'artmatterWishlistData', [
			'restUrl'        => esc_url_raw( rest_url( self::REST_NAMESPACE . '/wishlist' ) ),
			'nonce'          => wp_create_nonce( 'wp_rest' ),
			'isLoggedIn'     => (bool) $user_id,
			'userId'         => (int) $user_id,
			'serverIds'      => $user_ids,
			'currency'       => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR',
			'currencySymbol' => function_exists( 'get_woocommerce_currency_symbol' ) ? get_woocommerce_currency_symbol() : 'Rp',
			'shopUrl'        => function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' ),
		] );
	}

	/**
	 * REST: Retrieve formatted product data for a list of IDs
	 */
	public static function rest_get_products( WP_REST_Request $request ) {
		$raw_ids = $request->get_param( 'ids' );
		if ( empty( $raw_ids ) ) {
			return rest_ensure_response( [ 'products' => [] ] );
		}

		if ( is_string( $raw_ids ) ) {
			$id_list = array_map( 'intval', explode( ',', $raw_ids ) );
		} elseif ( is_array( $raw_ids ) ) {
			$id_list = array_map( 'intval', $raw_ids );
		} else {
			$id_list = [];
		}

		$id_list = array_filter( array_unique( $id_list ) );
		if ( empty( $id_list ) ) {
			return rest_ensure_response( [ 'products' => [] ] );
		}

		$products = [];
		$currency = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR';

		foreach ( $id_list as $product_id ) {
			$wc_product = wc_get_product( $product_id );
			if ( ! $wc_product || 'trash' === $wc_product->get_status() ) {
				continue;
			}

			// Flat WebP resolution with fallback
			$flat_url = '';
			if ( class_exists( 'Artmatter_Feelform_3D' ) ) {
				$flat_url = Artmatter_Feelform_3D::get_tactile_flat_preview_url( $product_id );
			}
			if ( empty( $flat_url ) ) {
				$flat_url = get_the_post_thumbnail_url( $product_id, 'woocommerce_thumbnail' ) ?: get_the_post_thumbnail_url( $product_id, 'full' );
			}

			// Category / device resolution
			$category_name = '';
			$cat_terms = wp_get_post_terms( $product_id, 'product_cat' );
			if ( ! empty( $cat_terms ) && ! is_wp_error( $cat_terms ) ) {
				$category_name = $cat_terms[0]->name;
			}

			// Orientation
			$orientation = 'vertical';
			$orient_terms = wp_get_post_terms( $product_id, 'art_orientation' );
			if ( ! empty( $orient_terms ) && ! is_wp_error( $orient_terms ) ) {
				$orientation = $orient_terms[0]->slug;
			}

			// Price
			$price_html = $wc_product->get_price_html();
			$raw_price = (float) $wc_product->get_price();

			// Add to Cart Link (Ensure storefront base URL, avoiding REST API URL reflection)
			$cart_page_url = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );
			if ( $wc_product->is_type( 'variable' ) ) {
				$add_to_cart_url = get_permalink( $product_id );
			} else {
				$add_to_cart_url = add_query_arg( 'add-to-cart', $product_id, $cart_page_url );
			}

			$products[] = [
				'id'             => (int) $product_id,
				'title'          => $wc_product->get_name(),
				'artist_name'    => $artist_name,
				'image_url'      => $flat_url ?: '',
				'image_variants' => Artmatter_Image_Sizes::get_product_variants( $product_id ),
				'price_html'     => $price_html,
				'price'          => $raw_price,
				'in_stock'       => $wc_product->is_in_stock(),
				'permalink'      => get_permalink( $product_id ),
				'add_to_cart_url'=> $add_to_cart_url,
				'is_variable'    => $wc_product->is_type( 'variable' ),
				'orientation'    => $orientation,
				'menu_order'     => (int) $wc_product->get_menu_order(),
			];
		}

		return rest_ensure_response( [
			'products' => $products,
			'count'    => count( $products ),
		] );
	}

	/**
	 * REST: Merge guest localStorage IDs into user meta
	 */
	public static function rest_sync_wishlist( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_Error( 'not_logged_in', 'User is not logged in', [ 'status' => 401 ] );
		}

		$client_ids = $request->get_param( 'ids' );
		if ( ! is_array( $client_ids ) ) {
			$client_ids = [];
		}

		$client_ids = array_map( 'intval', $client_ids );
		$server_ids = self::get_user_wishlist( $user_id );

		// Merge unique
		$merged = array_values( array_unique( array_filter( array_merge( $server_ids, $client_ids ) ) ) );
		self::update_user_wishlist( $user_id, $merged );

		return rest_ensure_response( [
			'success' => true,
			'ids'     => $merged,
			'count'   => count( $merged ),
		] );
	}

	/**
	 * REST: Toggle a single item
	 */
	public static function rest_toggle_item( WP_REST_Request $request ) {
		$product_id = (int) $request->get_param( 'product_id' );
		if ( ! $product_id ) {
			return new WP_Error( 'invalid_id', 'Invalid product ID', [ 'status' => 400 ] );
		}

		$user_id = get_current_user_id();
		$action = 'added';
		$ids = [];

		if ( $user_id ) {
			$ids = self::get_user_wishlist( $user_id );
			$idx = array_search( $product_id, $ids, true );

			if ( false !== $idx ) {
				unset( $ids[ $idx ] );
				$ids = array_values( $ids );
				$action = 'removed';
			} else {
				$ids[] = $product_id;
				$action = 'added';
			}

			self::update_user_wishlist( $user_id, $ids );
		}

		return rest_ensure_response( [
			'success'    => true,
			'action'     => $action,
			'product_id' => $product_id,
			'ids'        => $ids,
			'count'      => count( $ids ),
		] );
	}

	/**
	 * Check if a product is a Custom Order / Custom Product
	 */
	public static function is_custom_product( int $product_id = 0 ): bool {
		if ( ! $product_id ) {
			$product_id = (int) get_the_ID();
		}
		if ( ! $product_id ) {
			return false;
		}

		// 1. Check Product Categories
		$cats = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'slugs' ] );
		if ( ! is_wp_error( $cats ) && is_array( $cats ) ) {
			foreach ( $cats as $c ) {
				if ( false !== strpos( strtolower( $c ), 'custom' ) ) {
					return true;
				}
			}
		}

		// 2. Check Product Tags
		$tags = wp_get_post_terms( $product_id, 'product_tag', [ 'fields' => 'slugs' ] );
		if ( ! is_wp_error( $tags ) && is_array( $tags ) ) {
			foreach ( $tags as $t ) {
				if ( false !== strpos( strtolower( $t ), 'custom' ) ) {
					return true;
				}
			}
		}

		// 3. Check Post Slug
		$slug = get_post_field( 'post_name', $product_id );
		if ( $slug && ( false !== strpos( strtolower( $slug ), 'custom' ) || false !== strpos( strtolower( $slug ), 'your-art' ) ) ) {
			return true;
		}

		// 4. Check Meta
		$meta_custom = get_post_meta( $product_id, '_is_custom', true ) ?: get_post_meta( $product_id, 'is_custom', true );
		if ( $meta_custom && 'no' !== $meta_custom && '0' !== $meta_custom ) {
			return true;
		}

		return false;
	}

	/**
	 * Render Bookmark Wishlist Toggle Button Shortcode
	 * Usable as [artmatter_wishlist_button product_id="123" icon_only="true"] or [artmatter_bookmark_button]
	 */
	public static function render_wishlist_button_shortcode( $atts = [] ): string {
		$atts = shortcode_atts( [
			'product_id' => 0,
			'class'      => '',
			'icon_only'  => '',
			'logo_only'  => '',
		], $atts, 'artmatter_wishlist_button' );

		$product_id = ! empty( $atts['product_id'] ) ? (int) $atts['product_id'] : (int) get_the_ID();
		if ( ! $product_id || self::is_custom_product( $product_id ) ) {
			return '';
		}

		$is_icon_only = false;
		if ( 'true' === $atts['icon_only'] || 'true' === $atts['logo_only'] || '1' === $atts['icon_only'] || '1' === $atts['logo_only'] ) {
			$is_icon_only = true;
		}

		$icon_class = $is_icon_only ? 'icon-only ' : '';
		$extra_class = esc_attr( trim( 'artmatter-wishlist-btn artmatter-wishlist-toggle ' . $icon_class . $atts['class'] ) );

		$title = get_the_title( $product_id ) ?: 'Precision Skin';
		$aria_label = $title ? "Save {$title} to Wishlist" : 'Save to Wishlist';

		return sprintf(
			'<button type="button" class="%s" data-product-id="%d" data-product-title="%s" aria-label="%s" title="Save to Wishlist">
				<svg class="artmatter-bookmark-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
				</svg>
				%s
			</button>',
			$extra_class,
			$product_id,
			esc_attr( $title ),
			esc_attr( $aria_label ),
			$label_html
		);
	}

	/**
	 * Render Full Interactive Wishlist Archive Shortcode
	 * Usable as [artmatter_wishlist]
	 */
	public static function render_wishlist_page_shortcode( $atts = [] ): string {
		try {
			$atts = is_array( $atts ) ? $atts : [];

			$atts = shortcode_atts( [
				'title'       => 'My Wishlist',
				'subtitle'    => 'Save your favorite precision skins and wraps.',
				'columns'     => '3',
				'class'       => '',
			], $atts, 'artmatter_wishlist' );

			self::enqueue_frontend_assets();

		ob_start();
		?>
		<div id="artmatter-wishlist-root" class="artmatter-wishlist-wrapper <?php echo esc_attr( $atts['class'] ); ?>">
			<!-- Header -->
			<div class="artmatter-wishlist-header">
				<div class="artmatter-wishlist-header-left">
					<h1 class="artmatter-wishlist-title"><?php echo esc_html( $atts['title'] ); ?></h1>
					<p class="artmatter-wishlist-subtitle"><?php echo esc_html( $atts['subtitle'] ); ?></p>
				</div>
				<div class="artmatter-wishlist-header-right">
					<span class="artmatter-wishlist-badge"><span class="artmatter-wishlist-badge-count">0</span> Saved</span>
				</div>
			</div>

			<!-- Controls & Filters Bar (Matching Exact Museum Shop Gallery Architecture) -->
			<div class="artmatter-wishlist-controls">
				<!-- Left: Orientation Switcher -->
				<div class="artmatter-results-orient-bar">
					<button type="button" class="artmatter-orient-btn active" data-orient="all">
						<span>All</span>
					</button>
					<button type="button" class="artmatter-orient-btn" data-orient="portrait">
						<svg class="artmatter-orient-icon" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="5" y="3" width="14" height="18" rx="2"/></svg>
						<span>Portrait</span>
					</button>
					<button type="button" class="artmatter-orient-btn" data-orient="landscape">
						<svg class="artmatter-orient-icon" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
						<span>Landscape</span>
					</button>
				</div>

				<!-- Right: Actions Group (Custom Sort Menu + Clear List) -->
				<div class="artmatter-dir-actions">
					<!-- Custom Luxury Sort Menu (No Price Sort) -->
					<div class="artmatter-dir-sort-wrap">
						<button type="button" class="artmatter-dir-sort-btn" aria-label="Sort collection" title="Sort collection">
							<svg class="artmatter-sort-icon" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
								<path d="m21 16-4 4-4-4"></path>
								<path d="M17 20V4"></path>
								<path d="m3 8 4-4 4 4"></path>
								<path d="M7 4v16"></path>
							</svg>
							<span class="artmatter-sort-current-label">Recently Added</span>
						</button>
						<div class="artmatter-dir-sort-menu">
							<button type="button" class="artmatter-sort-option active" data-sort="recent">Recently Added</button>
							<button type="button" class="artmatter-sort-option" data-sort="title_asc">Title (A-Z)</button>
						</div>
					</div>

					<!-- Clear List Button -->
					<button type="button" id="artmatter-wishlist-clear-btn" class="artmatter-wishlist-clear-btn" title="Clear all saved items">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
						<span>Clear List</span>
					</button>
				</div>
			</div>

			<!-- Dynamic Product Grid -->
			<div id="artmatter-wishlist-grid" class="artmatter-archive-grid artmatter-wishlist-grid cols-<?php echo esc_attr( $atts['columns'] ); ?>">
				<!-- Rendered via JS reactive engine -->
				<div class="artmatter-wishlist-loader">
					<div class="artmatter-wishlist-spinner"></div>
					<span>Loading your wishlist...</span>
				</div>
			</div>

			<!-- Empty State -->
			<div id="artmatter-wishlist-empty" class="artmatter-wishlist-empty" style="display: none;">
				<div class="artmatter-wishlist-empty-icon">
					<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
					</svg>
				</div>
				<h3 class="artmatter-wishlist-empty-title">Your wishlist is empty</h3>
				<p class="artmatter-wishlist-empty-desc">Explore our catalog and tap the bookmark icon on any item to save it to your wishlist.</p>
				<a href="<?php echo esc_url( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' ) ); ?>" class="artmatter-wishlist-empty-btn">
					<span>Explore Skins</span>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
				</a>
			</div>
		</div>
		<?php
		return ob_get_clean();
		} catch ( \Throwable $e ) {
			if ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::log( 'error', 'Wishlist page render error: ' . $e->getMessage() );
			}
			return '';
		}
		}
	}
}

if ( ! class_exists( 'Artmatter_Wishlist_Engine' ) ) {
	class_alias( 'Exacoat_Wishlist_Engine', 'Artmatter_Wishlist_Engine' );
}

// Initialize
Exacoat_Wishlist_Engine::init();

// ==============================================================================
// GLOBAL BRICKS BUILDER DYNAMIC TAG HELPERS FOR WISHLIST
// Usable in Bricks as {echo:artmatter_wishlist_button()} or {echo:artmatter_bookmark_button()}
// Deferred to init priority 999 so external snippets in WPCode execute without fatal redeclare errors.
// ==============================================================================
add_action( 'init', function() {
	if ( ! function_exists( 'artmatter_wishlist_button' ) ) {
		function artmatter_wishlist_button( $product_id = null, string $class = '', bool $icon_only = true ): string {
			return Artmatter_Wishlist_Engine::render_wishlist_button_shortcode( [
				'product_id' => $product_id ?: 0,
				'class'      => $class,
				'icon_only'  => $icon_only ? 'true' : 'false',
			] );
		}
	}

	if ( ! function_exists( 'artmatter_bookmark_button' ) ) {
		function artmatter_bookmark_button( $product_id = null, $class = '' ): string {
			$product_id = ! empty( $product_id ) ? (int) $product_id : 0;
			$class = is_string( $class ) ? $class : '';

			return Artmatter_Wishlist_Engine::render_wishlist_button_shortcode( [
				'product_id' => $product_id,
				'class'      => $class,
				'icon_only'  => 'true',
			] );
		}
	}

	if ( ! function_exists( 'artmatter_wishlist_count' ) ) {
		function artmatter_wishlist_count( $format = '(%d)', $show_zero = false ): string {
			$user_id = get_current_user_id();
			$count = $user_id ? count( Artmatter_Wishlist_Engine::get_user_wishlist( $user_id ) ) : 0;
			$format = ( is_string( $format ) && ! empty( $format ) ) ? $format : '(%d)';
			$display = ( $count === 0 && ! $show_zero ) ? '0' : sprintf( $format, $count );

			return '<span class="artmatter-wishlist-count" data-format="' . esc_attr( $format ) . '" data-show-zero="' . ( $show_zero ? 'true' : 'false' ) . '">' . esc_html( $display ) . '</span>';
		}
	}

	if ( ! function_exists( 'artmatter_wishlist_page' ) ) {
		function artmatter_wishlist_page( $atts = [] ): string {
			$atts = is_array( $atts ) ? $atts : [];
			return Artmatter_Wishlist_Engine::render_wishlist_page_shortcode( $atts );
		}
	}

	if ( ! function_exists( 'exacoat_wishlist_count' ) ) {
		function exacoat_wishlist_count( $format = '(%d)', $show_zero = false ): string {
			return artmatter_wishlist_count( $format, $show_zero );
		}
	}

	if ( ! function_exists( 'exacoat_wishlist_page' ) ) {
		function exacoat_wishlist_page( $atts = [] ): string {
			return artmatter_wishlist_page( $atts );
		}
	}
}, 999 );
