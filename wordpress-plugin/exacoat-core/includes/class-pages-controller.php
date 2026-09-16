<?php
/**
 * Headless Pages REST API Controller
 * Exposes published WordPress & Bricks Builder pages for the Next.js headless storefront.
 *
 * @package Exacoat_Core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Exacoat_Pages_Controller {

	/**
	 * REST route namespace.
	 *
	 * @var string
	 */
	const REST_NAMESPACE = 'exacoat/v1';

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	const REST_BASE = 'pages';

	/**
	 * In-memory cache for resolved attachment media.
	 *
	 * @var array<int, array>
	 */
	protected static $media_cache = [];

	/**
	 * Initialize hooks.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Register REST API routes.
	 */
	public static function register_routes(): void {
		// 1. GET /wp-json/exacoat/v1/pages - List all published pages
		register_rest_route(
			self::REST_NAMESPACE,
			'/' . self::REST_BASE,
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_pages' ],
					'permission_callback' => '__return_true',
				],
			]
		);

		// 2. GET /wp-json/exacoat/v1/pages/{slug} - Single page with Bricks tree & SEO
		register_rest_route(
			self::REST_NAMESPACE,
			'/' . self::REST_BASE . '/(?P<slug>[a-zA-Z0-9\-_/]+)',
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_page_by_slug' ],
					'permission_callback' => '__return_true',
					'args'                => [
						'slug' => [
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => [ __CLASS__, 'sanitize_slug' ],
							'description'       => __( 'The slug or path of the page.', 'exacoat-core' ),
						],
					],
				],
			]
		);
	}

	/**
	 * Sanitize page slug argument.
	 *
	 * @param mixed $slug Input slug.
	 * @return string Sanitized path slug.
	 */
	public static function sanitize_slug( $slug ): string {
		$raw = (string) $slug;
		$segments = explode( '/', trim( $raw, '/' ) );
		$clean = array_map( 'sanitize_title', $segments );
		return implode( '/', array_filter( $clean ) );
	}

	/**
	 * Retrieve a list of all published pages.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response
	 */
	public static function get_pages( WP_REST_Request $request ): WP_REST_Response {
		$posts = get_posts( [
			'post_type'              => 'page',
			'post_status'            => 'publish',
			'posts_per_page'         => -1,
			'orderby'                => 'menu_order title',
			'order'                  => 'ASC',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		] );

		$results = [];
		foreach ( $posts as $post ) {
			$results[] = [
				'id'           => (int) $post->ID,
				'slug'         => $post->post_name,
				'title'        => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'modified_gmt' => $post->post_modified_gmt,
			];
		}

		return new WP_REST_Response( $results, 200 );
	}

	/**
	 * Retrieve a single page by slug with full metadata and Bricks elements.
	 *
	 * @param WP_REST_Request $request REST request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_page_by_slug( WP_REST_Request $request ) {
		$slug = $request->get_param( 'slug' );
		if ( empty( $slug ) ) {
			return new WP_Error(
				'rest_invalid_slug',
				__( 'Invalid page slug provided.', 'exacoat-core' ),
				[ 'status' => 400 ]
			);
		}

		// 1. Attempt lookup by hierarchical path
		$output_type = defined( 'OBJECT' ) ? OBJECT : 'OBJECT';
		$page = get_page_by_path( $slug, $output_type, 'page' );

		// 2. Fallback: Lookup by post_name (flat slug)
		if ( ! $page ) {
			$flat_slug = basename( $slug );
			$matched = get_posts( [
				'name'                   => $flat_slug,
				'post_type'              => 'page',
				'post_status'            => 'publish',
				'posts_per_page'         => 1,
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
			] );

			if ( ! empty( $matched ) ) {
				$page = $matched[0];
			}
		}

		// 3. Verify page exists and is publicly published
		if ( ! $page instanceof WP_Post || 'publish' !== $page->post_status ) {
			return new WP_Error(
				'rest_page_not_found',
				__( 'Page not found.', 'exacoat-core' ),
				[ 'status' => 404 ]
			);
		}

		// 4. Format complete payload
		$response_payload = self::prepare_page_payload( $page );

		return new WP_REST_Response( $response_payload, 200 );
	}

	/**
	 * Prepare complete page payload.
	 *
	 * @param WP_Post $page Page post object.
	 * @return array
	 */
	protected static function prepare_page_payload( WP_Post $page ): array {
		$post_id = (int) $page->ID;

		// 1. Featured image resolution
		$featured_image_id = get_post_thumbnail_id( $post_id );
		$featured_image = $featured_image_id ? self::resolve_media_item( (int) $featured_image_id ) : null;
		$featured_image_url = $featured_image ? $featured_image['url'] : null;

		// 2. SEO metadata
		$seo_meta = self::get_seo_metadata( $page );

		// 3. Bricks structure & image resolution
		$media_map = [];
		if ( $featured_image ) {
			$media_map[ (string) $featured_image['id'] ] = $featured_image;
		}

		$bricks_data = self::get_bricks_data( $post_id );
		if ( ! empty( $bricks_data ) ) {
			self::enrich_bricks_tree( $bricks_data, $media_map );
		}

		// 4. Rendered HTML fallback
		$content_html = self::get_rendered_content( $page );

		return [
			'id'                 => $post_id,
			'slug'               => $page->post_name,
			'title'              => html_entity_decode( get_the_title( $page ), ENT_QUOTES, 'UTF-8' ),
			'status'             => $page->post_status,
			'modified'           => $page->post_modified,
			'modified_gmt'       => $page->post_modified_gmt,
			'featured_image'     => $featured_image,
			'featured_image_url' => $featured_image_url,
			'seo'                => $seo_meta,
			'bricks_data'        => $bricks_data,
			'media_map'          => (object) $media_map,
			'content_html'       => $content_html,
		];
	}

	/**
	 * Extract and parse Bricks Builder element tree from post meta.
	 *
	 * @param int $post_id Page ID.
	 * @return array
	 */
	protected static function get_bricks_data( int $post_id ): array {
		// Post meta key _bricks_page_content_2 is the primary storage in Bricks 1.5+
		$raw = get_post_meta( $post_id, '_bricks_page_content_2', true );
		if ( empty( $raw ) ) {
			$raw = get_post_meta( $post_id, '_bricks_page_content', true );
		}

		if ( empty( $raw ) ) {
			return [];
		}

		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
				return $decoded;
			}

			$unserialized = maybe_unserialize( $raw );
			if ( is_array( $unserialized ) ) {
				return $unserialized;
			}

			return [];
		}

		return is_array( $raw ) ? $raw : [];
	}

	/**
	 * Recursively traverse Bricks element tree to enrich media nodes in place
	 * and compile a complete media map dictionary.
	 *
	 * @param array $tree Bricks elements array passed by reference.
	 * @param array $media_map Compiled media map passed by reference.
	 */
	public static function enrich_bricks_tree( array &$tree, array &$media_map ): void {
		foreach ( $tree as $key => &$node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}

			// Case 1: Node represents an image object: e.g. {"id": 123} or {"image": {"id": 123}}
			if ( isset( $node['id'] ) && is_numeric( $node['id'] ) && (int) $node['id'] > 0 ) {
				$att_id = (int) $node['id'];
				if ( self::is_attachment( $att_id ) ) {
					$media = self::resolve_media_item( $att_id );
					if ( $media ) {
						$node['url']    = $media['url'];
						$node['alt']    = $media['alt'];
						$node['width']  = $media['width'];
						$node['height'] = $media['height'];
						$node['sizes']  = $media['sizes'];
						$media_map[ (string) $att_id ] = $media;
					}
				}
			}

			// Case 2: Array of gallery images: "images" => [123, 124] or [{"id": 123}, ...]
			if ( in_array( $key, [ 'images', 'gallery' ], true ) && is_array( $node ) ) {
				foreach ( $node as $sub_key => &$sub_val ) {
					if ( is_numeric( $sub_val ) && (int) $sub_val > 0 ) {
						$att_id = (int) $sub_val;
						if ( self::is_attachment( $att_id ) ) {
							$media = self::resolve_media_item( $att_id );
							if ( $media ) {
								$sub_val = $media;
								$media_map[ (string) $att_id ] = $media;
							}
						}
					} elseif ( is_array( $sub_val ) && isset( $sub_val['id'] ) && is_numeric( $sub_val['id'] ) ) {
						$att_id = (int) $sub_val['id'];
						if ( self::is_attachment( $att_id ) ) {
							$media = self::resolve_media_item( $att_id );
							if ( $media ) {
								$sub_val['url']    = $media['url'];
								$sub_val['alt']    = $media['alt'];
								$sub_val['width']  = $media['width'];
								$sub_val['height'] = $media['height'];
								$sub_val['sizes']  = $media['sizes'];
								$media_map[ (string) $att_id ] = $media;
							}
						}
					}
				}
				unset( $sub_val );
			}

			// Recurse into nested children and settings
			self::enrich_bricks_tree( $node, $media_map );
		}
		unset( $node );
	}

	/**
	 * Verify whether an ID represents a valid media attachment.
	 *
	 * @param int $id Post ID.
	 * @return bool
	 */
	protected static function is_attachment( int $id ): bool {
		if ( $id <= 0 ) {
			return false;
		}
		if ( isset( self::$media_cache[ $id ] ) ) {
			return true;
		}
		return 'attachment' === get_post_type( $id );
	}

	/**
	 * Resolve media metadata, full URL, alt text, and responsive sizes.
	 *
	 * @param int $attachment_id Media attachment ID.
	 * @return array|null
	 */
	public static function resolve_media_item( int $attachment_id ): ?array {
		if ( $attachment_id <= 0 ) {
			return null;
		}

		if ( isset( self::$media_cache[ $attachment_id ] ) ) {
			return self::$media_cache[ $attachment_id ];
		}

		$url = wp_get_attachment_image_url( $attachment_id, 'full' );
		if ( ! $url ) {
			return null;
		}

		// Normalize through Exacoat media CDN filter if active
		if ( function_exists( 'exacoat_media_url' ) ) {
			$url = exacoat_media_url( $url );
		}

		// Retrieve alt text or fall back to attachment title
		$alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
		if ( empty( $alt ) ) {
			$post = get_post( $attachment_id );
			$alt = $post instanceof WP_Post ? $post->post_title : '';
		}

		$meta   = wp_get_attachment_metadata( $attachment_id );
		$width  = isset( $meta['width'] ) ? (int) $meta['width'] : null;
		$height = isset( $meta['height'] ) ? (int) $meta['height'] : null;

		// Standard responsive sizes
		$sizes = [];
		$registered_sizes = [ 'thumbnail', 'medium', 'medium_large', 'large', 'full' ];
		foreach ( $registered_sizes as $size_name ) {
			$src = wp_get_attachment_image_src( $attachment_id, $size_name );
			if ( $src ) {
				$size_url = $src[0];
				if ( function_exists( 'exacoat_media_url' ) ) {
					$size_url = exacoat_media_url( $size_url );
				}
				$sizes[ $size_name ] = [
					'url'    => $size_url,
					'width'  => (int) $src[1],
					'height' => (int) $src[2],
				];
			}
		}

		$resolved = [
			'id'     => $attachment_id,
			'url'    => $url,
			'alt'    => html_entity_decode( (string) $alt, ENT_QUOTES, 'UTF-8' ),
			'width'  => $width,
			'height' => $height,
			'sizes'  => $sizes,
		];

		self::$media_cache[ $attachment_id ] = $resolved;
		return $resolved;
	}

	/**
	 * Compile comprehensive SEO metadata from Yoast, Rank Math, AIOSEO, or WordPress fallbacks.
	 *
	 * @param WP_Post $page Page post object.
	 * @return array
	 */
	protected static function get_seo_metadata( WP_Post $page ): array {
		$post_id   = (int) $page->ID;
		$site_name = get_bloginfo( 'name' );

		// 1. Yoast SEO
		$yoast_title = get_post_meta( $post_id, '_yoast_wpseo_title', true );
		$yoast_desc  = get_post_meta( $post_id, '_yoast_wpseo_metadesc', true );
		$yoast_og    = get_post_meta( $post_id, '_yoast_wpseo_opengraph-image', true );
		$yoast_canon = get_post_meta( $post_id, '_yoast_wpseo_canonical', true );

		// 2. Rank Math SEO
		$rm_title = get_post_meta( $post_id, 'rank_math_title', true );
		$rm_desc  = get_post_meta( $post_id, 'rank_math_description', true );
		$rm_og    = get_post_meta( $post_id, 'rank_math_facebook_image', true );
		$rm_canon = get_post_meta( $post_id, 'rank_math_canonical_url', true );

		// 3. All In One SEO
		$aioseo_title = get_post_meta( $post_id, '_aioseo_title', true );
		$aioseo_desc  = get_post_meta( $post_id, '_aioseo_description', true );

		// Resolve meta title
		$title = $yoast_title ?: ( $rm_title ?: ( $aioseo_title ?: '' ) );
		if ( empty( $title ) ) {
			$title = get_the_title( $page ) . ( $site_name ? ' | ' . $site_name : '' );
		} else {
			$title = str_replace(
				[ '%%title%%', '%%sitename%%', '%%sep%%', '%title%', '%sitename%' ],
				[ get_the_title( $page ), $site_name, '-', get_the_title( $page ), $site_name ],
				$title
			);
		}

		// Resolve meta description
		$description = $yoast_desc ?: ( $rm_desc ?: ( $aioseo_desc ?: '' ) );
		if ( empty( $description ) ) {
			if ( ! empty( $page->post_excerpt ) ) {
				$description = wp_strip_all_tags( $page->post_excerpt );
			} else {
				$raw_content = wp_strip_all_tags( $page->post_content );
				$description = wp_trim_words( $raw_content, 30, '...' );
			}
		}

		// Resolve canonical URL
		$canonical = $yoast_canon ?: ( $rm_canon ?: get_permalink( $page ) );

		// Resolve OpenGraph image
		$og_image = $yoast_og ?: ( $rm_og ?: '' );
		if ( empty( $og_image ) ) {
			$thumb_id = get_post_thumbnail_id( $post_id );
			if ( $thumb_id ) {
				$og_image = wp_get_attachment_image_url( $thumb_id, 'large' ) ?: '';
			}
		}

		return [
			'title'       => html_entity_decode( (string) $title, ENT_QUOTES, 'UTF-8' ),
			'description' => html_entity_decode( (string) $description, ENT_QUOTES, 'UTF-8' ),
			'canonical'   => (string) $canonical,
			'og_image'    => (string) $og_image,
		];
	}

	/**
	 * Generate rendered HTML fallback using Bricks frontend or WordPress the_content filter.
	 *
	 * @param WP_Post $page Page post object.
	 * @return string
	 */
	protected static function get_rendered_content( WP_Post $page ): string {
		$html = '';

		// 1. Attempt Bricks Builder native rendering
		if ( class_exists( '\Bricks\Frontend' ) && method_exists( '\Bricks\Frontend', 'render_content' ) ) {
			try {
				ob_start();
				\Bricks\Frontend::render_content( $page->ID );
				$html = (string) ob_get_clean();
			} catch ( \Throwable $e ) {
				$html = '';
			}
		}

		// 2. Fallback to WordPress standard filter pipeline
		if ( empty( trim( $html ) ) ) {
			global $post;
			$previous_post = $post;
			$post = $page;
			setup_postdata( $page );

			$html = (string) apply_filters( 'the_content', $page->post_content );

			// Restore global post state
			$post = $previous_post;
			if ( $previous_post instanceof WP_Post ) {
				setup_postdata( $previous_post );
			} else {
				wp_reset_postdata();
			}
		}

		// 3. Normalize media URLs through Exacoat CDN filter
		if ( function_exists( 'exacoat_media_urls_in_text' ) && ! empty( $html ) ) {
			$html = exacoat_media_urls_in_text( $html );
		}

		return $html;
	}
}
