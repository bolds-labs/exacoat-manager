<?php
/**
 * Artmatter Store & Frontend Enhancements Module
 * Consolidates Snippets: #1867, #2491, #3452, #5059, #9115, #10117, #10301, #10380, #11889, #12109, #12532, #12727, #12819, #12853, #13840, #14576, #14577, #14819, #15133, #16143
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Store_Enhancements' ) ) {

class Exacoat_Store_Enhancements {

	public static function init() {
		// 1. Store Tweaks & Cleanups (#2491)
		add_filter( 'woocommerce_countries_ex_tax_or_vat', '__return_empty_string' );
		add_filter( 'woocommerce_bacs_process_payment_order_status', fn() => 'pending', 10, 2 );
		add_filter( 'big_image_size_threshold', '__return_false' );
		add_filter( 'cfw_promo_code_toggle_link_text', fn() => __( 'Have a promo code?', 'artmatter-core' ) );
		add_filter( 'cfw_disable_email_domain_validation', '__return_true' );

		// Cart to checkout redirect, disabled by default to preserve standard WooCommerce cart behavior
		if ( Exacoat_Core::get_setting( 'redirect_cart_checkout', 0 ) ) {
			add_action( 'template_redirect', [ __CLASS__, 'redirect_cart_to_checkout' ] );
		}

		// Optional login page redirect
		if ( Exacoat_Core::get_setting( 'redirect_wp_login', 0 ) ) {
			add_action( 'init', [ __CLASS__, 'redirect_wp_login_page' ] );
		}

		// Logout redirect to homepage
		add_action( 'wp_logout', fn() => wp_safe_redirect( home_url( '/' ) ) );

		// Product Tags Meta Sync
		add_action( 'updated_post_meta', [ __CLASS__, 'sync_meta_to_tag_taxonomy' ], 10, 4 );
		add_action( 'added_post_meta', [ __CLASS__, 'sync_meta_to_tag_taxonomy' ], 10, 4 );
		add_action( 'set_object_terms', [ __CLASS__, 'sync_tag_taxonomy_to_meta' ], 10, 6 );

		// Custom Product Statuses: 'Rejected' & 'Scheduled for removal'
		add_action( 'init', [ __CLASS__, 'register_custom_product_statuses' ] );
		add_filter( 'display_post_states', [ __CLASS__, 'display_custom_product_post_states' ], 10, 2 );
		add_filter( 'woocommerce_product_query_post_status', [ __CLASS__, 'include_rejected_in_product_query' ] );

		// Lockdown /wp/v2/users Endpoint
		add_filter( 'rest_authentication_errors', [ __CLASS__, 'lockdown_users_rest_api' ], 10, 1 );

		// Aelia Multi-Currency auto-price generator with Configurable FX Rates & Markup
		add_action( 'woocommerce_process_product_meta', [ __CLASS__, 'auto_set_aelia_currency_prices' ], 20 );
		add_action( 'woocommerce_after_product_object_save', [ __CLASS__, 'auto_set_aelia_currency_prices_after_save' ], 20, 2 );
		add_filter( 'woocommerce_price_num_decimals', [ __CLASS__, 'get_active_currency_decimals' ], 999 );

		// 15. Checkout Shipping Rules (#14577)
		add_filter( 'woocommerce_package_rates', [ __CLASS__, 'apply_zone_tiered_shipping_discount' ], 100, 2 );

		// 18. Virtual Upload Folder Path Resolver & 404 Prevention
		add_action( 'init', [ __CLASS__, 'resolve_virtual_upload' ], 1 );
		add_filter( 'redirect_canonical', [ __CLASS__, 'prevent_upload_404_redirect_loop' ], 10, 2 );
		add_filter( 'wp_get_attachment_url', [ __CLASS__, 'filter_virtual_attachment_url' ], 10, 2 );

		// 19. Custom Print Finish (FeelForm 3D vs Flat) Cart & Order Handling
		add_filter( 'woocommerce_add_cart_item_data', [ __CLASS__, 'add_print_finish_to_cart_item' ], 10, 3 );
		add_filter( 'woocommerce_get_item_data', [ __CLASS__, 'display_print_finish_in_cart' ], 10, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', [ __CLASS__, 'save_print_finish_to_order_item' ], 10, 4 );

		// 20. WebP Image Integration for Products in WooCommerce Cart & Checkout
		add_filter( 'woocommerce_cart_item_thumbnail', [ __CLASS__, 'filter_cart_item_thumbnail_webp' ], 20, 3 );
		add_filter( 'woocommerce_admin_order_item_thumbnail', [ __CLASS__, 'filter_order_item_thumbnail_webp' ], 20, 3 );

		// 21. Selective WooCommerce Asset Decoupling on Non-Shop Pages
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'maybe_unload_wc_assets_on_non_shop' ], 99 );

		// 22. Shortlink Redirects (/cs, /wa, /whatsapp -> WhatsApp Customer Support)
		add_action( 'template_redirect', [ __CLASS__, 'handle_shortlink_redirects' ], 1 );
	}

	/**
	 * Shortlink redirect handler: /cs, /wa, /whatsapp -> WhatsApp customer support
	 */
	public static function handle_shortlink_redirects() {
		if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		$request_uri = untrailingslashit( strtolower( parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH ) ?: '' ) );

		if ( in_array( $request_uri, [ '/cs', '/wa', '/whatsapp' ], true ) ) {
			$wa_url = 'https://api.whatsapp.com/send?phone=628975556000';
			wp_redirect( $wa_url, 302 );
			exit;
		}
	}

	public static function redirect_cart_to_checkout() {
		if ( ! Exacoat_Core::get_setting( 'redirect_cart_checkout', 1 ) ) return;

		if ( function_exists( 'is_cart' ) && is_cart() ) {
			wp_safe_redirect( wc_get_checkout_url() );
			exit;
		}
	}

	public static function journal_rewrite_rules() {
		add_rewrite_rule( '^journal/([^/]+)/?$', 'index.php?name=$matches[1]', 'top' );
	}

	public static function custom_order_rewrite_rules() {
		add_rewrite_rule( '^posters/(custom-order-[^/]+)/?$', 'index.php?product=$matches[1]', 'top' );
	}

	public static function handle_custom_order_redirect() {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) return;
		$uri = trim( parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ), '/' );

		if ( preg_match( '#^posters/(custom-order-[a-z0-9\-_]+)$#i', $uri, $matches ) ) {
			$slug = strtolower( $matches[1] );
			$posts = get_posts( [
				'name'        => $slug,
				'post_type'   => 'product',
				'post_status' => 'publish',
				'numberposts' => 1,
			] );

			if ( ! empty( $posts ) ) {
				$target = get_permalink( $posts[0]->ID );
				if ( $target && strcasecmp( home_url( $_SERVER['REQUEST_URI'] ), $target ) !== 0 ) {
					wp_safe_redirect( $target, 302 );
					exit;
				}
			}
		}
	}

	public static function redirect_wp_login_page() {
		if ( empty( $_SERVER['REQUEST_URI'] ) || ( $_SERVER['REQUEST_METHOD'] ?? '' ) !== 'GET' ) {
			return;
		}

		$path = trim( (string) parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ), '/' );
		if ( 'wp-login.php' !== basename( $path ) ) {
			return;
		}

		// Allow WordPress logout, password recovery, postpass, and Nextend Social Login
		$action = isset( $_GET['action'] ) ? sanitize_key( $_GET['action'] ) : '';
		if ( in_array( $action, [ 'logout', 'postpass', 'lostpassword', 'rp', 'resetpass' ], true ) || isset( $_GET['loginSocial'] ) ) {
			return;
		}

		$login_page = home_url( '/login/' );
		if ( ! empty( $_GET['redirect_to'] ) ) {
			$login_page = add_query_arg( 'redirect_to', rawurlencode( wp_unslash( $_GET['redirect_to'] ) ), $login_page );
		}

		wp_safe_redirect( $login_page );
		exit;
	}

	public static function sync_art_fandom_meta( $term_id, $tt_id, $taxonomy, $update = false ) {
		if ( $taxonomy !== 'art_fandom' ) return;
		clean_term_cache( $term_id, $taxonomy );
		$term = get_term( $term_id, $taxonomy );
		if ( ! $term || is_wp_error( $term ) ) return;

		$acf_id = 'art_fandom_' . $term_id;
		if ( function_exists( 'update_field' ) ) {
			update_field( 'fandom_title', $term->name, $acf_id );
			update_field( 'fandom_slug', $term->slug, $acf_id );
			$link = get_term_link( $term );
			if ( ! is_wp_error( $link ) ) {
				update_field( 'fandom_public_url', $link, $acf_id );
			}
		}

		if ( ! $update ) {
			Artmatter_Webhook_Dispatcher::dispatch( 'fandom_created', get_option( 'admin_email' ), 'Admin', [
				'term_id'     => $term_id,
				'name'        => $term->name,
				'slug'        => $term->slug,
				'description' => $term->description,
			] );
		}
	}

	public static function sync_collection_term_meta( $term_id ) {
		$term = get_term( $term_id, 'artist_collection' );
		if ( ! $term || is_wp_error( $term ) ) return;
		update_term_meta( $term_id, 'collection_term_id', (int) $term_id );
		update_term_meta( $term_id, 'collection_term_name', $term->name );
		update_term_meta( $term_id, 'collection_term_slug', $term->slug );
	}

	public static function sync_artwork_collection_meta( $value, $post_id, $field ) {
		if ( get_post_type( $post_id ) !== 'product' ) return $value;
		$term_id = is_array( $value ) ? reset( $value ) : $value;
		if ( $term_id ) {
			$term = get_term( (int) $term_id, 'artist_collection' );
			if ( $term && ! is_wp_error( $term ) ) {
				update_post_meta( $post_id, 'artwork_artist_collection_name', $term->name );
				update_post_meta( $post_id, 'artwork_artist_collection_slug', $term->slug );
			}
		} else {
			delete_post_meta( $post_id, 'artwork_artist_collection_name' );
			delete_post_meta( $post_id, 'artwork_artist_collection_slug' );
		}
		return $value;
	}

	public static function sync_artwork_fandom_meta( $value, $post_id, $field ) {
		if ( get_post_type( $post_id ) !== 'product' ) return $value;
		$term_id = is_array( $value ) ? reset( $value ) : $value;
		if ( $term_id ) {
			$term = get_term( (int) $term_id, 'art_fandom' );
			if ( $term && ! is_wp_error( $term ) ) {
				update_post_meta( $post_id, 'artwork_fandom_name', $term->name );
				update_post_meta( $post_id, 'artwork_fandom_slug', $term->slug );
			}
		} else {
			delete_post_meta( $post_id, 'artwork_fandom_name' );
			delete_post_meta( $post_id, 'artwork_fandom_slug' );
		}
		return $value;
	}

	public static function sync_author_and_artist_field( $post_id ) {
		if ( get_post_type( $post_id ) !== 'product' ) return;

		// Decoupled architecture: all products are owned by Master Admin (ID 1)
		$current_author = (int) get_post_field( 'post_author', $post_id );
		if ( $current_author !== 1 ) {
			global $wpdb;
			$wpdb->update( $wpdb->posts, [ 'post_author' => 1 ], [ 'ID' => $post_id ] );
			clean_post_cache( $post_id );
		}

		// Ensure the featured image has post_parent and post_author set to 1
		$thumb_id = get_post_thumbnail_id( $post_id );
		if ( $thumb_id ) {
			$thumb_parent = (int) get_post_field( 'post_parent', $thumb_id );
			$thumb_author = (int) get_post_field( 'post_author', $thumb_id );
			$needs_update = false;
			$thumb_update = [ 'ID' => $thumb_id ];
			if ( $thumb_parent !== (int) $post_id ) {
				$thumb_update['post_parent'] = $post_id;
				$needs_update = true;
			}
			if ( $thumb_author !== 1 ) {
				$thumb_update['post_author'] = 1;
				$needs_update = true;
			}
			if ( $needs_update ) {
				wp_update_post( $thumb_update );
				clean_post_cache( $thumb_id );
			}
		}
	}

	public static function sync_product_artist_display_name( $post_id, $post = null ) {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
		if ( wp_is_post_revision( $post_id ) ) return;
		if ( get_post_type( $post_id ) !== 'product' ) return;

		$artist_id = (int) get_post_meta( $post_id, 'artwork_artist', true );
		if ( ! $artist_id && $post ) {
			$artist_id = (int) $post->post_author;
		}

		if ( $artist_id ) {
			$custom_name = get_user_meta( $artist_id, 'artist_display_name', true );
			if ( is_array( $custom_name ) ) $custom_name = $custom_name[0];
			$final_name = ! empty( $custom_name ) ? $custom_name : get_the_author_meta( 'display_name', $artist_id );
			update_post_meta( $post_id, 'artwork_artist_display_name', $final_name );
			update_post_meta( $post_id, 'product_artist_display_name', $final_name );
		}
	}

	private static $tag_syncing = false;

	public static function sync_meta_to_tag_taxonomy( $meta_id, $object_id, $meta_key, $meta_value ) {
		if ( self::$tag_syncing || $meta_key !== 'product_tags' || get_post_type( $object_id ) !== 'product' ) return;
		self::$tag_syncing = true;
		$tags = array_filter( array_map( 'trim', explode( ',', strtolower( (string) $meta_value ) ) ) );
		if ( ! empty( $tags ) ) {
			wp_set_post_terms( $object_id, $tags, 'product_tag', false );
		}
		self::$tag_syncing = false;
	}

	public static function sync_tag_taxonomy_to_meta( $object_id, $terms, $tt_ids, $taxonomy, $append, $old_tt_ids ) {
		if ( self::$tag_syncing || $taxonomy !== 'product_tag' || get_post_type( $object_id ) !== 'product' ) return;
		self::$tag_syncing = true;
		$term_names = wp_get_post_terms( $object_id, 'product_tag', [ 'fields' => 'names' ] );
		if ( ! is_wp_error( $term_names ) ) {
			$normalized = implode( ', ', array_unique( array_map( 'strtolower', $term_names ) ) );
			update_post_meta( $object_id, 'product_tags', $normalized );
		}
		self::$tag_syncing = false;
	}

	/**
	 * Fast SQL search query extension covering product_tag and device taxonomies (#12532)
	 */

	public static function register_custom_product_statuses() {
		register_post_status( 'rejected', [
			'label'                     => _x( 'Rejected', 'post status', 'artmatter-core' ),
			'public'                    => false,
			'private'                   => true,
			'protected'                 => false,
			'exclude_from_search'       => true,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Rejected <span class="count">(%s)</span>', 'Rejected <span class="count">(%s)</span>', 'artmatter-core' ),
		] );

		register_post_status( 'sched_removal', [
			'label'                     => _x( 'Delisting Wind-Down (7 Days)', 'post status', 'artmatter-core' ),
			'public'                    => false,
			'private'                   => true,
			'protected'                 => false,
			'exclude_from_search'       => true,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Delisting Wind-Down <span class="count">(%s)</span>', 'Delisting Wind-Down <span class="count">(%s)</span>', 'artmatter-core' ),
		] );

		register_post_status( 'scheduled_removal', [
			'label'                     => _x( 'Scheduled for Removal', 'post status', 'artmatter-core' ),
			'public'                    => false,
			'private'                   => true,
			'protected'                 => false,
			'exclude_from_search'       => true,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Scheduled for Removal <span class="count">(%s)</span>', 'Scheduled for Removal <span class="count">(%s)</span>', 'artmatter-core' ),
		] );

		register_post_status( 'delisted', [
			'label'                     => _x( 'Delisted', 'post status', 'artmatter-core' ),
			'public'                    => false,
			'private'                   => true,
			'protected'                 => false,
			'exclude_from_search'       => true,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Delisted <span class="count">(%s)</span>', 'Delisted <span class="count">(%s)</span>', 'artmatter-core' ),
		] );
	}

	public static function display_custom_product_post_states( $states, $post ) {
		if ( $post->post_type === 'product' ) {
			if ( $post->post_status === 'rejected' ) {
				$states['rejected'] = __( 'Rejected', 'artmatter-core' );
			} elseif ( $post->post_status === 'sched_removal' || $post->post_status === 'scheduled_removal' ) {
				$states['sched_removal'] = __( 'Delisting Wind-Down (7 Days)', 'artmatter-core' );
			} elseif ( $post->post_status === 'delisted' ) {
				$states['delisted'] = __( 'Delisted (Archived)', 'artmatter-core' );
			}
		}
		return $states;
	}

	public static function include_rejected_in_product_query( $statuses ) {
		$statuses[] = 'rejected';
		$statuses[] = 'sched_removal';
		$statuses[] = 'scheduled_removal';
		$statuses[] = 'delisted';
		return $statuses;
	}

	/**
	 * Force Product Slug with ID: {slug}-{id} (#10117)
	 */
	public static function force_product_slug_with_id( $slug, $post_ID, $post_status, $post_type, $post_parent, $original_slug ) {
		if ( $post_type !== 'product' || empty( $post_ID ) ) {
			return $slug;
		}

		if ( ! Exacoat_Core::get_setting( 'enable_product_id_slugs', 1 ) ) return $slug;

		if ( get_post_meta( $post_ID, '_artmatter_custom_product', true ) ) {
			return $slug;
		}

		$excluded_category_slugs = [ 'misc', 'accessories' ];
		$product_terms = wp_get_post_terms( $post_ID, 'product_cat', [ 'fields' => 'slugs' ] );
		if ( ! is_wp_error( $product_terms ) && array_intersect( $excluded_category_slugs, $product_terms ) ) {
			return $slug;
		}

		$base_slug = empty( $slug ) ? 'product' : $slug;
		$id_suffix = '-' . $post_ID;

		if ( substr( $base_slug, -strlen( $id_suffix ) ) === $id_suffix ) {
			return $base_slug;
		}

		return $base_slug . $id_suffix;
	}

	public static function lockdown_users_rest_api( $result ) {
		if ( ! Exacoat_Core::get_setting( 'lockdown_users_api', 1 ) ) return $result;

		if ( ! empty( $result ) ) return $result;
		$route = $GLOBALS['wp']->query_vars['rest_route'] ?? '';
		if ( strpos( $route, '/wp/v2/users' ) !== false && ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required to view users.', 'artmatter-core' ), [ 'status' => 401 ] );
		}
		return $result;
	}

	public static function display_singles_collection_name( $term, $taxonomy ) {
		return $term;
	}

	/**
	 * Dynamic Currency Registry (#11889)
	 */
	public static function get_currency_rates(): array {
		$settings = Exacoat_Core::get_settings();
		$default_currencies = [
			'USD' => [ 'symbol' => '$',   'rate' => 0.000059, 'rounding' => '9_end' ],
			'EUR' => [ 'symbol' => '€',   'rate' => 0.000051, 'rounding' => '9_end' ],
			'AUD' => [ 'symbol' => 'A$',  'rate' => 0.000089, 'rounding' => '9_end' ],
			'SGD' => [ 'symbol' => 'S$',  'rate' => 0.000076, 'rounding' => '9_end' ],
			'JPY' => [ 'symbol' => '¥',   'rate' => 0.009350, 'rounding' => '50_step' ],
			'GBP' => [ 'symbol' => '£',   'rate' => 0.000044, 'rounding' => '9_end' ],
			'CAD' => [ 'symbol' => 'CA$', 'rate' => 0.000082, 'rounding' => '9_end' ],
			'CHF' => [ 'symbol' => 'CHF', 'rate' => 0.000047, 'rounding' => '9_end' ],
			'HKD' => [ 'symbol' => 'HK$', 'rate' => 0.000462, 'rounding' => '9_end' ],
			'THB' => [ 'symbol' => '฿',   'rate' => 0.001866, 'rounding' => '90_end' ],
			'KRW' => [ 'symbol' => '₩',   'rate' => 0.086400, 'rounding' => '500_step' ],
		];

		$currencies = $settings['currency_rates'] ?? $default_currencies;
		if ( ! is_array( $currencies ) || empty( $currencies ) ) {
			$currencies = $default_currencies;
		}

		return $currencies;
	}

	public static function auto_set_aelia_currency_prices_after_save( $product, $data_store = null ) {
		if ( ! $product instanceof WC_Product ) return;
		self::auto_set_aelia_currency_prices( $product->get_id() );
	}

	/**
	 * Calculate rounded price for a given IDR base amount in any target currency using the official rounding rules
	 */
	public static function calculate_price_for_currency( $amount_idr, $currency_code = 'IDR' ): float {
		$currency_code = strtoupper( trim( (string) $currency_code ) );
		if ( empty( $currency_code ) || $currency_code === 'IDR' ) {
			return (float) $amount_idr;
		}

		$settings   = Exacoat_Core::get_settings();
		$markup     = floatval( $settings['currency_global_markup'] ?? 1.15 );
		$currencies = self::get_currency_rates();

		if ( ! isset( $currencies[ $currency_code ] ) ) {
			return (float) round( $amount_idr * 0.000059 * $markup );
		}

		$data          = $currencies[ $currency_code ];
		$rate          = floatval( is_array( $data ) ? ( $data['rate'] ?? 0 ) : $data );
		$rounding_type = is_array( $data ) ? ( $data['rounding'] ?? '9_end' ) : '9_end';

		if ( $rate <= 0 ) {
			return (float) $amount_idr;
		}

		$raw = $amount_idr * $rate * $markup;
		if ( $rounding_type === '90_end' || $currency_code === 'THB' ) {
			$val = ( ceil( $raw / 100 ) * 100 ) - 10;
		} elseif ( $rounding_type === '500_step' || $currency_code === 'KRW' ) {
			$val = ceil( $raw / 500 ) * 500;
		} elseif ( $rounding_type === '50_step' || $currency_code === 'JPY' ) {
			$val = ceil( $raw / 50 ) * 50;
		} elseif ( $rounding_type === '9_end' || $currency_code === 'HKD' ) {
			$val = ( ceil( $raw / 10 ) * 10 ) - 1;
		} elseif ( $rounding_type === 'none' ) {
			$val = round( $raw, 2 );
		} else {
			$val = ( ceil( $raw / 10 ) * 10 ) - 1;
		}

		return (float) max( 0, $val );
	}

	public static function get_currency_decimals( string $currency_code ): int {
		$currency_code = strtoupper( trim( $currency_code ) );
		if ( 'IDR' === $currency_code ) {
			return 0;
		}

		$currencies = self::get_currency_rates();
		$rounding   = $currencies[ $currency_code ]['rounding'] ?? '9_end';
		return 'none' === $rounding ? 2 : 0;
	}

	public static function get_active_currency_decimals( $decimals ): int {
		$currency = class_exists( 'Exacoat_Checkout_Engine' )
			? Exacoat_Checkout_Engine::get_active_currency()
			: ( class_exists( 'Artmatter_Checkout_Engine' )
				? Artmatter_Checkout_Engine::get_active_currency()
				: ( function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR' ) );
		return self::get_currency_decimals( $currency );
	}

	public static function auto_set_aelia_currency_prices( $post_id ) {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
		if ( wp_is_post_revision( $post_id ) ) return;

		$product = wc_get_product( $post_id );
		if ( ! $product ) return;

		$base_regular = get_post_meta( $post_id, '_regular_price', true );
		$base_sale    = get_post_meta( $post_id, '_sale_price', true );
		if ( ! is_numeric( $base_regular ) || $base_regular <= 0 ) return;

		$currencies = self::get_currency_rates();
		$regular_prices = [];
		$sale_prices    = [];

		foreach ( $currencies as $code => $data ) {
			$decimals = self::get_currency_decimals( $code );
			$regular_prices[ $code ] = number_format( self::calculate_price_for_currency( $base_regular, $code ), $decimals, '.', '' );
			if ( is_numeric( $base_sale ) && $base_sale > 0 ) {
				$sale_prices[ $code ] = number_format( self::calculate_price_for_currency( $base_sale, $code ), $decimals, '.', '' );
			}
		}

		update_post_meta( $post_id, '_regular_currency_prices', wp_json_encode( $regular_prices ) );

		if ( ! empty( $sale_prices ) ) {
			update_post_meta( $post_id, '_sale_currency_prices', wp_json_encode( $sale_prices ) );
		} else {
			delete_post_meta( $post_id, '_sale_currency_prices' );
		}
	}


	/**
	 * Handle Preview & Maintenance Bypass Cookie & Safe URL Parameters
	 * Allows testing live product pages and museum views without being redirected to coming soon or blocked by maintenance mode.
	 * Trigger params: ?preview=1, ?preview=true, ?bypass=artmatter, ?bypass=1, ?artmatter_preview=1, ?preview_mode=1
	 * Exit params: ?preview=0, ?bypass=0, ?exit_preview=1
	 */
	public static function handle_preview_bypass_cookies_and_redirects() {
		// Exit bypass mode
		if ( isset( $_GET['exit_preview'] ) || ( isset( $_GET['preview'] ) && ( $_GET['preview'] === '0' || $_GET['preview'] === 'false' ) ) || ( isset( $_GET['bypass'] ) && $_GET['bypass'] === '0' ) ) {
			if ( ! headers_sent() ) {
				setcookie( 'artmatter_preview_bypass', '', time() - 3600, '/' );
			}
			unset( $_COOKIE['artmatter_preview_bypass'] );
			if ( ! is_admin() && ! ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
				wp_safe_redirect( home_url( '/template/coming-soon' ), 302 );
				exit;
			}
			return;
		}

		// Activate bypass mode
		$has_bypass_param = false;
		if ( isset( $_GET['bypass'] ) && ( $_GET['bypass'] === 'artmatter' || $_GET['bypass'] === 'true' || $_GET['bypass'] === '1' ) ) {
			$has_bypass_param = true;
		} elseif ( isset( $_GET['preview'] ) && ( $_GET['preview'] === '1' || $_GET['preview'] === 'true' ) ) {
			$has_bypass_param = true;
		} elseif ( isset( $_GET['artmatter_preview'] ) || isset( $_GET['preview_mode'] ) || isset( $_GET['preview_auth'] ) ) {
			$has_bypass_param = true;
		}

		if ( $has_bypass_param ) {
			if ( ! headers_sent() ) {
				setcookie( 'artmatter_preview_bypass', '1', time() + ( 86400 * 7 ), '/' );
			}
			$_COOKIE['artmatter_preview_bypass'] = '1';
		}
	}

	public static function is_preview_bypass_active(): bool {
		if ( ! empty( $_COOKIE['artmatter_preview_bypass'] ) && $_COOKIE['artmatter_preview_bypass'] === '1' ) {
			return true;
		}
		if ( isset( $_GET['bypass'] ) && ( $_GET['bypass'] === 'artmatter' || $_GET['bypass'] === 'true' || $_GET['bypass'] === '1' ) ) {
			return true;
		}
		if ( isset( $_GET['preview'] ) && ( $_GET['preview'] === '1' || $_GET['preview'] === 'true' ) ) {
			return true;
		}
		if ( isset( $_GET['artmatter_preview'] ) || isset( $_GET['preview_mode'] ) || isset( $_GET['preview_auth'] ) ) {
			return true;
		}
		return false;
	}


	/**
	 * Get Shipping Zones Configuration (#14577)
	 */
	public static function get_shipping_config(): array {
		$settings = Exacoat_Core::get_settings();

		$default_zones = [
			'indonesia' => [
				'name'        => 'Indonesia',
				'countries'   => 'ID',
				'currency'    => 'IDR',
				'free'        => 2000000,
				'filter_text' => '',
			],
			'asia' => [
				'name'        => 'Asia',
				'countries'   => 'SG, MY, TH, VN, PH, JP, KR, HK, TW, CN',
				'currency'    => 'SGD',
				'free'        => 350,
				'filter_text' => '',
			],
			'united_states' => [
				'name'        => 'United States',
				'countries'   => 'US',
				'currency'    => 'USD',
				'free'        => 250,
				'filter_text' => '',
			],
			'australia' => [
				'name'        => 'Australia',
				'countries'   => 'AU',
				'currency'    => 'AUD',
				'free'        => 300,
				'filter_text' => '',
			],
			'united_kingdom' => [
				'name'        => 'United Kingdom',
				'countries'   => 'GB',
				'currency'    => 'GBP',
				'free'        => 200,
				'filter_text' => '',
			],
			'europe_zone_1' => [
				'name'        => 'Europe Zone 1',
				'countries'   => 'DE, FR, NL, BE, LU',
				'currency'    => 'EUR',
				'free'        => 240,
				'filter_text' => '',
			],
			'europe_zone_2' => [
				'name'        => 'Europe Zone 2',
				'countries'   => 'IT, ES, PT, AT, CH',
				'currency'    => 'EUR',
				'free'        => 240,
				'filter_text' => '',
			],
			'europe_zone_3' => [
				'name'        => 'Europe Zone 3',
				'countries'   => 'SE, NO, DK, FI, PL, CZ, IE',
				'currency'    => 'EUR',
				'free'        => 280,
				'filter_text' => '',
			],
			'europe_others' => [
				'name'        => 'Europe Others',
				'countries'   => 'GR, HU, RO, BG, HR',
				'currency'    => 'EUR',
				'free'        => 280,
				'filter_text' => '',
			],
			'default' => [
				'name'        => 'Default (Rest of World)',
				'countries'   => '*',
				'currency'    => 'USD',
				'free'        => 250,
				'filter_text' => '',
			],
		];

		$target_methods_raw = $settings['shipping_target_method_ids'] ?? 'flat_rate, biteship_shipping';
		$target_methods     = array_values( array_filter( array_map( 'trim', explode( ',', $target_methods_raw ) ) ) );
		if ( ! in_array( 'biteship_shipping', $target_methods, true ) ) {
			$target_methods[] = 'biteship_shipping';
		}

		$zones = $settings['shipping_zones'] ?? $default_zones;
		if ( ! is_array( $zones ) || empty( $zones ) ) {
			$zones = $default_zones;
		} else {
			// Migrate legacy IDR-scaled zone amounts or missing currency keys
			foreach ( $zones as $k => &$z ) {
				$z_curr = strtoupper( trim( $z['currency'] ?? '' ) );
				if ( empty( $z_curr ) ) {
					$c_raw = strtoupper( $z['countries'] ?? '' );
					if ( strpos( $c_raw, 'AU' ) !== false ) $z_curr = 'AUD';
					elseif ( strpos( $c_raw, 'US' ) !== false ) $z_curr = 'USD';
					elseif ( strpos( $c_raw, 'GB' ) !== false ) $z_curr = 'GBP';
					elseif ( strpos( $c_raw, 'SG' ) !== false || strpos( $c_raw, 'MY' ) !== false ) $z_curr = 'SGD';
					elseif ( strpos( $c_raw, 'DE' ) !== false || strpos( $c_raw, 'FR' ) !== false || strpos( $c_raw, 'IT' ) !== false ) $z_curr = 'EUR';
					elseif ( strpos( $c_raw, 'ID' ) !== false ) $z_curr = 'IDR';
					else $z_curr = ( (float)( $z['free'] ?? 0 ) > 50000 ) ? 'IDR' : 'USD';
					$z['currency'] = $z_curr;
				}
				$free_val = (float) ( $z['free'] ?? 0 );
				// If legacy threshold is in IDR (> 10,000) for a non-IDR zone, migrate to default native or converted amount
				if ( 'IDR' !== $z_curr && $free_val > 10000 ) {
					if ( isset( $default_zones[ $k ]['free'] ) && $default_zones[ $k ]['currency'] === $z_curr ) {
						$z['free'] = $default_zones[ $k ]['free'];
					} else {
						$converted = (float) apply_filters( 'wc_aelia_cs_convert', $free_val, 'IDR', $z_curr );
						$z['free'] = $converted > 0 ? round( $converted ) : 250;
					}
				}
			}
			unset( $z );
		}

		return [
			'target_method_ids' => $target_methods,
			'zones'             => $zones,
		];
	}

	/**
	 * Apply Multi-Zone Tiered Free Shipping Discount (#14577)
	 */
	public static function apply_zone_tiered_shipping_discount( $rates, $package ) {
		if ( is_admin() && ! defined( 'DOING_AJAX' ) ) return $rates;

		$config     = self::get_shipping_config();
		$target_ids = $config['target_method_ids'];
		$zones      = $config['zones'];

		$country    = strtoupper( trim( $package['destination']['country'] ?? 'ID' ) );
		$cart_total = ( function_exists( 'WC' ) && WC()->cart ) ? (float) WC()->cart->get_displayed_subtotal() : 0.0;

		$active_currency = class_exists( 'Exacoat_Checkout_Engine' )
			? Exacoat_Checkout_Engine::get_active_currency()
			: ( class_exists( 'Artmatter_Checkout_Engine' )
				? Artmatter_Checkout_Engine::get_active_currency()
				: ( function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR' ) );

		// Normalize cart total to IDR base currency for comparison against IDR-configured zone thresholds
		$cart_total_idr = $cart_total;
		if ( 'IDR' !== $active_currency ) {
			$currencies = self::get_currency_rates();
			$rate_val   = floatval( $currencies[ $active_currency ]['rate'] ?? 0 );
			if ( $rate_val > 0 ) {
				$cart_total_idr = $cart_total / $rate_val;
			}
		}

		// Match destination country
		$matched_zone = null;
		foreach ( $zones as $z_key => $zone ) {
			if ( empty( $zone['countries'] ) ) continue;
			$c_list = array_map( 'trim', explode( ',', strtoupper( $zone['countries'] ) ) );
			if ( in_array( $country, $c_list, true ) ) {
				$matched_zone = $zone;
				break;
			}
		}

		// Fallback to default
		if ( ! $matched_zone && isset( $zones['default'] ) ) {
			$matched_zone = $zones['default'];
		}

		if ( ! $matched_zone ) {
			return $rates;
		}
		$free_thresh = floatval( $matched_zone['free'] ?? 0 );
		$zone_curr   = strtoupper( trim( $matched_zone['currency'] ?? '' ) );
		if ( empty( $zone_curr ) ) {
			$zone_curr = ( $free_thresh > 50000 ) ? 'IDR' : 'USD';
		}

		$effective_threshold = $free_thresh;
		if ( $zone_curr !== $active_currency ) {
			if ( 'IDR' === $zone_curr ) {
				$converted = apply_filters( 'wc_aelia_cs_convert', $free_thresh, 'IDR', $active_currency );
				if ( (float) $converted === (float) $free_thresh && $active_currency !== 'IDR' ) {
					$currencies = self::get_currency_rates();
					$rate_val   = floatval( $currencies[ $active_currency ]['rate'] ?? 0 );
					$effective_threshold = $rate_val > 0 ? ( $free_thresh * $rate_val ) : $free_thresh;
				} else {
					$effective_threshold = (float) $converted;
				}
			} else {
				$thresh_idr = (float) apply_filters( 'wc_aelia_cs_convert', $free_thresh, $zone_curr, 'IDR' );
				if ( (float) $thresh_idr === (float) $free_thresh && $zone_curr !== 'IDR' ) {
					$currencies = self::get_currency_rates();
					$rate_val   = floatval( $currencies[ $zone_curr ]['rate'] ?? 0 );
					$thresh_idr = $rate_val > 0 ? ( $free_thresh / $rate_val ) : $free_thresh;
				}
				$converted = apply_filters( 'wc_aelia_cs_convert', $thresh_idr, 'IDR', $active_currency );
				if ( (float) $converted === (float) $thresh_idr && $active_currency !== 'IDR' ) {
					$currencies = self::get_currency_rates();
					$rate_val   = floatval( $currencies[ $active_currency ]['rate'] ?? 0 );
					$effective_threshold = $rate_val > 0 ? ( $thresh_idr * $rate_val ) : $thresh_idr;
				} else {
					$effective_threshold = (float) $converted;
				}
			}
		}

		$is_free_qualified = ( $effective_threshold > 0 && $cart_total >= $effective_threshold );
		$filter_text       = trim( strtolower( (string) ( $matched_zone['filter_text'] ?? '' ) ) );

		foreach ( $rates as $rate_id => $rate ) {
			$is_biteship = ( strpos( $rate->id, 'biteship_shipping' ) !== false || ( isset( $rate->method_id ) && 'biteship_shipping' === $rate->method_id ) );

			// Target method ID verification
			if ( ! empty( $target_ids ) ) {
				$matched_method = false;
				foreach ( $target_ids as $tid ) {
					if ( strpos( $rate->id, $tid ) !== false || ( isset( $rate->method_id ) && $rate->method_id === $tid ) ) {
						$matched_method = true;
						break;
					}
				}
				// Biteship rates always pass method ID verification so filter_text applies cleanly
				if ( ! $matched_method && $is_biteship ) {
					$matched_method = true;
				}
				if ( ! $matched_method ) continue;
			}

			// Filter text check (e.g. 'goorita')
			if ( ! empty( $filter_text ) ) {
				$rate_label   = strtolower( (string) $rate->label );
				$rate_id_s    = strtolower( (string) $rate->id );
				$is_flat_rate = ( isset( $rate->method_id ) && 'flat_rate' === $rate->method_id ) || ( strpos( $rate_id_s, 'flat_rate' ) !== false );
				$matches_text = ( strpos( $rate_label, $filter_text ) !== false || strpos( $rate_id_s, $filter_text ) !== false );

				// If zone filter is 'goorita', also match any standard international flat_rate method unless it is DHL
				if ( ! $matches_text && 'goorita' === $filter_text && $is_flat_rate && false === strpos( $rate_label, 'dhl' ) && false === strpos( $rate_id_s, 'dhl' ) ) {
					$matches_text = true;
				}

				if ( ! $matches_text ) {
					continue;
				}
			}

			// 100% Free Shipping Rule
			$existing_meta = method_exists( $rate, 'get_meta_data' ) ? $rate->get_meta_data() : [];
			$orig_cost     = null;
			if ( ! empty( $existing_meta ) && is_array( $existing_meta ) ) {
				foreach ( $existing_meta as $mk => $mv ) {
					if ( 'original_cost' === $mk || ( is_object( $mv ) && isset( $mv->key ) && 'original_cost' === $mv->key ) ) {
						$orig_cost = is_object( $mv ) ? $mv->value : $mv;
						break;
					}
				}
			}
			if ( null === $orig_cost && floatval( $rate->cost ) > 0 ) {
				$orig_cost = floatval( $rate->cost );
			}

			if ( $is_free_qualified ) {
				if ( $orig_cost > 0 && method_exists( $rate, 'add_meta_data' ) ) {
					$rate->add_meta_data( 'original_cost', (string) $orig_cost, true );
					$rate->add_meta_data( 'is_free_shipping', '1', true );
				}
				$rate->cost = 0;
				if ( strpos( $rate->label, 'Free Shipping' ) === false ) {
					$rate->label .= ' (Free Shipping)';
				}
			}
		}

		return $rates;
	}

	/**
	 * 18. Prevent infinite 301 redirect loops when static uploads (images, PDFs) 404.
	 */
	public static function prevent_upload_404_redirect_loop( $redirect_url, $requested_url ) {
		if ( strpos( $requested_url, '/wp-content/uploads/' ) !== false ) {
			return false;
		}
		return $redirect_url;
	}

	/**
	 * Virtual Upload Folder Path Resolver.
	 *
	 * Intercepts requests to virtual upload paths (e.g. /wp-content/uploads/Assets/Image/Skin Textures/<file>)
	 * where folders are virtual only and not physically present on disk.
	 * Resolves to the physical file in the root uploads directory or media library,
	 * and serves the asset with full browser/edge caching and CORS headers.
	 */
	public static function resolve_virtual_upload() {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}

		$request_uri = (string) $_SERVER['REQUEST_URI'];
		if ( strpos( $request_uri, '/wp-content/uploads/' ) === false ) {
			return;
		}

		$parsed_path = parse_url( $request_uri, PHP_URL_PATH );
		if ( empty( $parsed_path ) ) {
			return;
		}

		$decoded_path  = rawurldecode( $parsed_path );
		$upload_marker = '/wp-content/uploads/';
		$pos           = strpos( $decoded_path, $upload_marker );
		if ( false === $pos ) {
			return;
		}

		$rel_path = ltrim( substr( $decoded_path, $pos + strlen( $upload_marker ) ), '/' );
		if ( empty( $rel_path ) ) {
			return;
		}

		$upload_dir = wp_upload_dir();
		$basedir    = wp_normalize_path( $upload_dir['basedir'] );

		// If physical file exists at exact relative path, serve directly
		$exact_physical = $basedir . '/' . $rel_path;
		if ( file_exists( $exact_physical ) && is_file( $exact_physical ) ) {
			self::serve_virtual_file( $exact_physical );
			exit;
		}

		// Virtual folder path: resolve physical file location
		$filename = wp_basename( $rel_path );
		if ( empty( $filename ) ) {
			return;
		}

		$resolved_file = self::locate_physical_upload( $filename, $rel_path, $basedir );
		if ( empty( $resolved_file ) || ! file_exists( $resolved_file ) || ! is_file( $resolved_file ) ) {
			return;
		}

		$clean_rel_found = ltrim( str_replace( $basedir, '', wp_normalize_path( $resolved_file ) ), '/' );
		$canonical_url   = trailingslashit( $upload_dir['baseurl'] ) . $clean_rel_found;

		$force_redirect = ! empty( $_GET['redirect'] ) || apply_filters( 'exacoat_virtual_upload_redirect', false );
		if ( $force_redirect ) {
			wp_safe_redirect( $canonical_url, 301 );
			exit;
		}

		self::serve_virtual_file( $resolved_file, $canonical_url );
		exit;
	}

	/**
	 * Revert any nested Assets/ uploads back to root /wp-content/uploads/.
	 * Moves nested files to root, removes empty folders, and cleans attachment meta in database.
	 */
	public static function revert_assets_to_flat_uploads(): array {
		$upload_dir = wp_upload_dir();
		$basedir    = wp_normalize_path( $upload_dir['basedir'] );
		$assets_dir = $basedir . '/Assets';

		$files_moved        = 0;
		$files_deduplicated = 0;
		$dirs_removed       = 0;
		$meta_updated       = 0;
		$errors             = [];

		if ( is_dir( $assets_dir ) ) {
			try {
				$iterator = new RecursiveIteratorIterator(
					new RecursiveDirectoryIterator( $assets_dir, RecursiveDirectoryIterator::SKIP_DOTS ),
					RecursiveIteratorIterator::CHILD_FIRST
				);

				foreach ( $iterator as $item ) {
					$item_path = wp_normalize_path( $item->getPathname() );

					if ( $item->isFile() ) {
						$filename    = $item->getFilename();
						$target_path = $basedir . '/' . $filename;

						if ( file_exists( $target_path ) ) {
							// Root file already exists; safely remove nested duplicate
							@unlink( $item_path );
							$files_deduplicated++;
						} else {
							// Move nested file to root uploads
							$moved = @rename( $item_path, $target_path );
							if ( ! $moved ) {
								$moved = @copy( $item_path, $target_path );
								if ( $moved ) {
									@unlink( $item_path );
								}
							}
							if ( $moved ) {
								$files_moved++;
							} else {
								$errors[] = 'Failed to move: ' . $filename;
							}
						}
					} elseif ( $item->isDir() ) {
						if ( @rmdir( $item_path ) ) {
							$dirs_removed++;
						}
					}
				}

				if ( is_dir( $assets_dir ) ) {
					@rmdir( $assets_dir );
				}
			} catch ( \Throwable $e ) {
				$errors[] = $e->getMessage();
			}
		}

		// Update database postmeta references
		global $wpdb;
		if ( isset( $wpdb->postmeta ) ) {
			$meta_rows = $wpdb->get_results(
				"SELECT meta_id, post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value LIKE 'Assets/%'"
			);

			if ( ! empty( $meta_rows ) ) {
				foreach ( $meta_rows as $row ) {
					$old_val = (string) $row->meta_value;
					$new_val = wp_basename( $old_val );
					if ( $new_val !== $old_val ) {
						$updated = $wpdb->update(
							$wpdb->postmeta,
							[ 'meta_value' => $new_val ],
							[ 'meta_id' => $row->meta_id ]
						);
						if ( false !== $updated ) {
							$meta_updated++;
						}
					}
				}
			}

			if ( isset( $wpdb->posts ) ) {
				$wpdb->query(
					"UPDATE {$wpdb->posts} SET guid = REPLACE(guid, '/wp-content/uploads/Assets/Image/Skin Textures/', '/wp-content/uploads/') WHERE post_type = 'attachment' AND guid LIKE '%/wp-content/uploads/Assets/%'"
				);
				$wpdb->query(
					"UPDATE {$wpdb->posts} SET guid = REPLACE(guid, '/wp-content/uploads/Assets/', '/wp-content/uploads/') WHERE post_type = 'attachment' AND guid LIKE '%/wp-content/uploads/Assets/%'"
				);
			}
		}

		return [
			'status'             => empty( $errors ) ? 'success' : 'partial',
			'files_moved'        => $files_moved,
			'files_deduplicated' => $files_deduplicated,
			'dirs_removed'       => $dirs_removed,
			'meta_updated'       => $meta_updated,
			'errors'             => $errors,
			'message'            => sprintf(
				'Media consolidation complete: %d file(s) moved to root /uploads, %d duplicate(s) cleaned, %d database record(s) updated.',
				$files_moved,
				$files_deduplicated,
				$meta_updated
			),
		];
	}

	/**
	 * Locate physical file on disk for a virtual upload filename.
	 */
	public static function locate_physical_upload( $filename, $rel_path = '', $basedir = '' ) {
		if ( empty( $basedir ) ) {
			$upload_dir = wp_upload_dir();
			$basedir    = wp_normalize_path( $upload_dir['basedir'] );
		}

		// 1. Check flat in root uploads directory
		$flat_path = $basedir . '/' . $filename;
		if ( file_exists( $flat_path ) && is_file( $flat_path ) ) {
			return $flat_path;
		}

		// 2. Variations in spaces, hyphens, and underscores
		$variations = [
			str_replace( ' ', '-', $filename ),
			str_replace( '-', ' ', $filename ),
			str_replace( [ ' ', '-' ], '_', $filename ),
			str_replace( '_', '-', $filename ),
		];
		foreach ( array_unique( $variations ) as $var_name ) {
			if ( $var_name !== $filename ) {
				$test_path = $basedir . '/' . $var_name;
				if ( file_exists( $test_path ) && is_file( $test_path ) ) {
					return $test_path;
				}
			}
		}

		// 3. Strip 'Assets/' or 'Assets/Image/' prefix if intermediate folders physically exist
		if ( ! empty( $rel_path ) ) {
			$stripped = preg_replace( '#^Assets/(?:Image/)?#i', '', $rel_path );
			if ( ! empty( $stripped ) && $stripped !== $rel_path ) {
				$test_path = $basedir . '/' . $stripped;
				if ( file_exists( $test_path ) && is_file( $test_path ) ) {
					return $test_path;
				}
			}
		}

		// 4. WebP / original extension cross-lookup
		$ext         = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		$name_no_ext = pathinfo( $filename, PATHINFO_FILENAME );
		if ( in_array( $ext, [ 'jpg', 'jpeg', 'png' ], true ) ) {
			$webp_test = $basedir . '/' . $name_no_ext . '.webp';
			if ( file_exists( $webp_test ) && is_file( $webp_test ) ) {
				return $webp_test;
			}
		} elseif ( 'webp' === $ext ) {
			foreach ( [ 'jpg', 'jpeg', 'png' ] as $fallback_ext ) {
				$img_test = $basedir . '/' . $name_no_ext . '.' . $fallback_ext;
				if ( file_exists( $img_test ) && is_file( $img_test ) ) {
					return $img_test;
				}
			}
		}

		// 5. Query WordPress attachment database meta (_wp_attached_file)
		global $wpdb;
		if ( $wpdb instanceof wpdb || ( is_object( $wpdb ) && method_exists( $wpdb, 'get_var' ) ) ) {
			$attached = $wpdb->get_var( $wpdb->prepare(
				"SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND ( meta_value = %s OR meta_value LIKE %s ) LIMIT 1",
				$filename,
				'%' . $wpdb->esc_like( '/' . $filename )
			) );
			if ( ! empty( $attached ) ) {
				$db_path = $basedir . '/' . ltrim( $attached, '/' );
				if ( file_exists( $db_path ) && is_file( $db_path ) ) {
					return $db_path;
				}
			}
		}

		return null;
	}

	/**
	 * Output physical file stream with headers for client/edge caching and CORS.
	 */
	public static function serve_virtual_file( $filepath, $canonical_url = '' ) {
		if ( ! file_exists( $filepath ) || ! is_readable( $filepath ) ) {
			return;
		}

		$filesize   = (int) filesize( $filepath );
		$filemtime  = (int) filemtime( $filepath );
		$filetype   = function_exists( 'wp_check_filetype' ) ? wp_check_filetype( $filepath ) : [];
		$mime_type  = ! empty( $filetype['type'] ) ? $filetype['type'] : ( function_exists( 'mime_content_type' ) ? mime_content_type( $filepath ) : 'image/jpeg' );
		$etag       = '"' . md5( $filemtime . '_' . $filesize ) . '"';
		$last_mod   = gmdate( 'D, d M Y H:i:s', $filemtime ) . ' GMT';

		if ( isset( $_SERVER['HTTP_IF_NONE_MATCH'] ) && trim( (string) $_SERVER['HTTP_IF_NONE_MATCH'] ) === $etag ) {
			if ( function_exists( 'status_header' ) ) {
				status_header( 304 );
			} else {
				header( 'HTTP/1.1 304 Not Modified' );
			}
			exit;
		}
		if ( isset( $_SERVER['HTTP_IF_MODIFIED_SINCE'] ) && strtotime( (string) $_SERVER['HTTP_IF_MODIFIED_SINCE'] ) >= $filemtime ) {
			if ( function_exists( 'status_header' ) ) {
				status_header( 304 );
			} else {
				header( 'HTTP/1.1 304 Not Modified' );
			}
			exit;
		}

		if ( function_exists( 'status_header' ) ) {
			status_header( 200 );
		} else {
			header( 'HTTP/1.1 200 OK' );
		}

		header( 'Content-Type: ' . $mime_type );
		header( 'Content-Length: ' . $filesize );
		header( 'ETag: ' . $etag );
		header( 'Last-Modified: ' . $last_mod );
		header( 'Cache-Control: public, max-age=31536000, immutable' );
		header( 'Access-Control-Allow-Origin: *' );
		header( 'Access-Control-Allow-Methods: GET, HEAD, OPTIONS' );
		header( 'Access-Control-Allow-Headers: *' );
		header( 'X-Virtual-Upload: resolved' );

		if ( ! empty( $canonical_url ) ) {
			header( 'Link: <' . esc_url( $canonical_url ) . '>; rel="canonical"' );
		}

		$request_method = strtoupper( (string) ( $_SERVER['REQUEST_METHOD'] ?? 'GET' ) );
		if ( in_array( $request_method, [ 'HEAD', 'OPTIONS' ], true ) ) {
			exit;
		}

		while ( ob_get_level() ) {
			ob_end_clean();
		}

		readfile( $filepath );
		exit;
	}

	/**
	 * Normalize attachment URLs that reference virtual folders.
	 */
	public static function filter_virtual_attachment_url( $url, $post_id = 0 ) {
		if ( empty( $url ) || strpos( $url, '/wp-content/uploads/' ) === false ) {
			return $url;
		}

		if ( preg_match( '#/wp-content/uploads/Assets/(.+)$#i', $url, $matches ) ) {
			$clean_rel  = ltrim( parse_url( $matches[1], PHP_URL_PATH ) ?: $matches[1], '/' );
			$upload_dir = wp_upload_dir();
			$basedir    = wp_normalize_path( $upload_dir['basedir'] );

			if ( ! file_exists( $basedir . '/Assets/' . $clean_rel ) ) {
				$filename = wp_basename( $clean_rel );
				if ( file_exists( $basedir . '/' . $filename ) ) {
					return trailingslashit( $upload_dir['baseurl'] ) . $filename;
				}
			}
		}

		return $url;
	}

	/**
	 * 19. Add Print Finish (FeelForm 3D vs Flat) to WooCommerce Cart Item
	 */
	public static function add_print_finish_to_cart_item( $cart_item_data, $product_id, $variation_id ) {
		$finish = '';
		if ( ! empty( $_POST['print_finish'] ) ) {
			$finish = sanitize_text_field( wp_unslash( $_POST['print_finish'] ) );
		} elseif ( ! empty( $_POST['finish'] ) ) {
			$finish = sanitize_text_field( wp_unslash( $_POST['finish'] ) );
		} elseif ( ! empty( $_POST['feelform_mode'] ) ) {
			$finish = sanitize_text_field( wp_unslash( $_POST['feelform_mode'] ) );
		} elseif ( ! empty( $_GET['print_finish'] ) ) {
			$finish = sanitize_text_field( wp_unslash( $_GET['print_finish'] ) );
		}

		if ( ! empty( $finish ) ) {
			$is_flat = ( stripos( $finish, 'flat' ) !== false || $finish === '2d' || $finish === 'classic' || $finish === 'standard' );
			$cart_item_data['print_finish'] = $is_flat ? 'flat' : 'feelform';
			$cart_item_data['print_finish_label'] = $is_flat ? 'Flat (Classic)' : 'FeelForm™';
			$cart_item_data['unique_key'] = md5( microtime() . rand() );
		}

		return $cart_item_data;
	}

	/**
	 * Display Print Finish in Cart & Checkout
	 */
	public static function display_print_finish_in_cart( $item_data, $cart_item ) {
		if ( ! empty( $cart_item['print_finish_label'] ) ) {
			$item_data[] = [
				'key'   => __( 'Print Finish', 'artmatter-core' ),
				'value' => esc_html( $cart_item['print_finish_label'] ),
			];
		}
		return $item_data;
	}

	/**
	 * Save Print Finish to WooCommerce Order Line Item Meta
	 */
	public static function save_print_finish_to_order_item( $item, $cart_item_key, $values, $order ) {
		if ( ! empty( $values['print_finish'] ) ) {
			$item->add_meta_data( 'print_finish', $values['print_finish'], true );
			$item->add_meta_data( 'Print Finish', $values['print_finish_label'] ?? ucfirst( $values['print_finish'] ), true );
			$item->add_meta_data( 'feelform_mode', $values['print_finish'], true );
		}
	}

	/**
	 * Filter WooCommerce Cart & Checkout Item Thumbnail to use WebP for Products
	 */
	public static function filter_cart_item_thumbnail_webp( $thumbnail, $cart_item, $cart_item_key ) {
		$product_id = (int) ( $cart_item['product_id'] ?? 0 );
		if ( ! $product_id ) {
			return $thumbnail;
		}

		$webp_url = class_exists( 'Artmatter_Feelform_3D' ) ? Artmatter_Feelform_3D::get_tactile_flat_preview_url( $product_id ) : '';

		if ( ! empty( $webp_url ) ) {
			$product = $cart_item['data'] ?? ( function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null );
			$title = $product ? $product->get_name() : get_the_title( $product_id );
			return sprintf(
				'<img src="%s" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail artmatter-cart-webp-thumb" alt="%s" loading="lazy" style="aspect-ratio:32/45;object-fit:cover;border-radius:0;" />',
				esc_url( $webp_url ),
				esc_attr( $title )
			);
		}

		return $thumbnail;
	}

	/**
	 * Filter Admin/Email Order Item Thumbnail to use WebP for Products
	 */
	public static function filter_order_item_thumbnail_webp( $thumbnail, $item_id, $item ) {
		if ( ! is_object( $item ) || ! method_exists( $item, 'get_product_id' ) ) {
			return $thumbnail;
		}

		$product_id = (int) $item->get_product_id();
		if ( ! $product_id ) {
			return $thumbnail;
		}

		$is_metal_poster = class_exists( 'Artmatter_Artwork_Vault' )
			? Artmatter_Artwork_Vault::is_metal_poster( $product_id )
			: true;

		if ( ! $is_metal_poster ) {
			return $thumbnail;
		}

		$webp_url = class_exists( 'Artmatter_Feelform_3D' ) ? Artmatter_Feelform_3D::get_tactile_flat_preview_url( $product_id ) : '';

		if ( ! empty( $webp_url ) ) {
			$product = $item->get_product();
			$title = $product ? $product->get_name() : get_the_title( $product_id );
			return sprintf(
				'<img src="%s" width="60" height="84" class="attachment-60x84 size-60x84 artmatter-order-webp-thumb" alt="%s" style="aspect-ratio:32/45;object-fit:cover;border-radius:0;" />',
				esc_url( $webp_url ),
				esc_attr( $title )
			);
		}

		return $thumbnail;
	}

	/**
	 * Selective WooCommerce Asset Decoupling
	 * Prevents heavy WooCommerce CSS/JS from loading on non-eCommerce pages (e.g. /journal/, about, homepage)
	 */
	public static function maybe_unload_wc_assets_on_non_shop() {
		if ( ! function_exists( 'is_woocommerce' ) ) {
			return;
		}

		$speed = class_exists( 'Artmatter_Performance_Auditor' ) 
			? Artmatter_Performance_Auditor::get_speed_settings() 
			: [ 'selective_wc_assets' => 1 ];

		if ( empty( $speed['selective_wc_assets'] ) ) {
			return;
		}

		// Keep assets on WooCommerce store pages, cart, checkout, account, product, or shop taxonomy
		if ( is_woocommerce() || is_cart() || is_checkout() || is_account_page() ) {
			return;
		}

		// Also check specific page slugs or endpoints
		if ( is_page( [ 'cart', 'checkout', 'my-account', 'order-pay', 'order-received' ] ) ) {
			return;
		}

		// Check if singular post is a product
		if ( is_singular( [ 'product', 'product_variation' ] ) ) {
			return;
		}

		// Dequeue WooCommerce default stylesheets
		wp_dequeue_style( 'woocommerce-layout' );
		wp_dequeue_style( 'woocommerce-smallscreen' );
		wp_dequeue_style( 'woocommerce-general' );
		wp_dequeue_style( 'woocommerce_frontend_styles' );
		wp_dequeue_style( 'woocommerce_fancybox_styles' );
		wp_dequeue_style( 'woocommerce_chosen_styles' );
		wp_dequeue_style( 'woocommerce_prettyPhoto_css' );

		// Dequeue WooCommerce default scripts
		wp_dequeue_script( 'wc-single-product' );
		wp_dequeue_script( 'woocommerce' );
		wp_dequeue_script( 'prettyPhoto' );
		wp_dequeue_script( 'prettyPhoto-init' );
		wp_dequeue_script( 'fancybox' );
		wp_dequeue_script( 'enable-lightbox' );
	}
}

}

if ( ! class_exists( 'Artmatter_Store_Enhancements' ) ) {
	class_alias( 'Exacoat_Store_Enhancements', 'Artmatter_Store_Enhancements' );
}
