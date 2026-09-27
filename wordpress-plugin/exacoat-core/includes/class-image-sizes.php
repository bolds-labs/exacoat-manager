<?php
/**
 * Exacoat-owned image derivatives, batch regeneration, and storage bloat cleaner.
 *
 * Provides optimized intermediate thumbnails for Next.js headless storefront:
 * - exacoat_thumb_sm (240x240 uncropped): search modal, cart drawer, checkout items.
 * - exacoat_thumb_md (720x720 uncropped): shop directory, category grids, device carousels.
 * - Configurator layers and swatches strictly retain original full-resolution master files.
 *
 * @package Exacoat_Core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Image_Sizes' ) ) {

class Exacoat_Image_Sizes {

	public const THUMB_SM = 'exacoat_thumb_sm';
	public const THUMB_MD = 'exacoat_thumb_md';

	public const SM_WIDTH  = 240;
	public const SM_HEIGHT = 240;
	public const MD_WIDTH  = 720;
	public const MD_HEIGHT = 720;

	/**
	 * Threshold in bytes for automatic master compression (500 KB).
	 */
	public const LARGE_FILE_THRESHOLD = 512000; // 500 * 1024

	/**
	 * Quality level for JPEG and WebP generation (85%).
	 */
	public const TARGET_QUALITY = 85;

	/**
	 * Prevent recursion during attachment metadata generation.
	 */
	private static bool $is_optimizing = false;

	public static function init(): void {
		// Register image sizes early
		add_action( 'init', [ __CLASS__, 'register' ], 5 );

		// Enforce quality 85 across all JPEG and WebP derivative generations
		add_filter( 'jpeg_quality', static fn() => 85, 20 );
		add_filter( 'wp_editor_set_quality', static fn() => 85, 20 );

		// Automatic optimization on direct WordPress upload (compresses >500KB without resizing + generates .webp)
		add_filter( 'wp_generate_attachment_metadata', [ __CLASS__, 'filter_generate_attachment_metadata' ], 10, 2 );

		// Single-attachment media detail fields & instant regeneration
		add_filter( 'attachment_fields_to_edit', [ __CLASS__, 'filter_attachment_fields' ], 10, 2 );
		add_action( 'wp_ajax_exacoat_regenerate_single_thumbnail', [ __CLASS__, 'ajax_regenerate_single_thumbnail' ] );
		add_action( 'wp_ajax_exacoat_optimize_single_image', [ __CLASS__, 'ajax_optimize_single_image' ] );
		add_action( 'admin_footer', [ __CLASS__, 'print_admin_scripts' ] );

		// AJAX Endpoints for Admin Dashboard
		add_action( 'wp_ajax_exacoat_regenerate_thumbnails', [ __CLASS__, 'ajax_regenerate_thumbnails' ] );
		add_action( 'wp_ajax_artmatter_regenerate_thumbnails', [ __CLASS__, 'ajax_regenerate_thumbnails' ] );
		add_action( 'wp_ajax_exacoat_delete_old_thumbnails', [ __CLASS__, 'ajax_delete_old_thumbnails' ] );
		add_action( 'wp_ajax_artmatter_delete_old_thumbnails', [ __CLASS__, 'ajax_delete_old_thumbnails' ] );

		// Batch Optimizer Endpoint
		add_action( 'wp_ajax_exacoat_batch_optimize_images', [ __CLASS__, 'ajax_batch_optimize_images' ] );
		add_action( 'wp_ajax_artmatter_batch_optimize_images', [ __CLASS__, 'ajax_batch_optimize_images' ] );
	}

	/**
	 * Register Exacoat Image Sizes (uncropped to preserve precise device aspect ratios).
	 */
	public static function register(): void {
		add_image_size( self::THUMB_SM, self::SM_WIDTH, self::SM_HEIGHT, false );
		add_image_size( self::THUMB_MD, self::MD_WIDTH, self::MD_HEIGHT, false );
	}

	/**
	 * Check if an attachment is missing any required Exacoat thumbnail derivatives.
	 */
	public static function has_missing_sizes( int $attachment_id ): bool {
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			return false;
		}

		$source_file = get_attached_file( $attachment_id );
		if ( ! $source_file || ! file_exists( $source_file ) ) {
			return false;
		}

		$metadata = wp_get_attachment_metadata( $attachment_id );
		if ( ! is_array( $metadata ) || empty( $metadata['sizes'] ) ) {
			return true;
		}

		$dir = dirname( $source_file );
		$required = [ self::THUMB_SM, self::THUMB_MD ];

		foreach ( $required as $size_name ) {
			if ( empty( $metadata['sizes'][ $size_name ]['file'] ) ) {
				return true;
			}
			$target_file = path_join( $dir, $metadata['sizes'][ $size_name ]['file'] );
			if ( ! file_exists( $target_file ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Regenerate thumbnails for a single attachment.
	 */
	public static function regenerate_attachment_thumbnails( int $attachment_id, bool $only_missing = true ): bool {
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			return false;
		}

		if ( $only_missing && ! self::has_missing_sizes( $attachment_id ) ) {
			return true; // Already intact
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$source_file = get_attached_file( $attachment_id );
		if ( ! $source_file || ! file_exists( $source_file ) ) {
			return false;
		}

		$new_metadata = wp_generate_attachment_metadata( $attachment_id, $source_file );
		if ( ! empty( $new_metadata ) && is_array( $new_metadata ) ) {
			wp_update_attachment_metadata( $attachment_id, $new_metadata );
			clean_post_cache( $attachment_id );
			return true;
		}

		return false;
	}

	/**
	 * Delete obsolete, unused intermediate thumbnail files for an attachment.
	 * Preserves master original file and currently registered metadata sizes.
	 */
	public static function delete_old_thumbnails( int $attachment_id ): array {
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			return [ 'deleted' => 0, 'files' => [] ];
		}

		$source_file = get_attached_file( $attachment_id );
		if ( ! $source_file || ! file_exists( $source_file ) ) {
			return [ 'deleted' => 0, 'files' => [] ];
		}

		$metadata = wp_get_attachment_metadata( $attachment_id );
		$dir = dirname( $source_file );
		$base_filename = basename( $source_file );
		$name_part = pathinfo( $base_filename, PATHINFO_FILENAME );
		$ext_part  = pathinfo( $base_filename, PATHINFO_EXTENSION );

		// Keep files currently registered in attachment metadata
		$keep_files = [ $base_filename ];
		if ( is_array( $metadata ) && ! empty( $metadata['sizes'] ) ) {
			foreach ( $metadata['sizes'] as $size_info ) {
				if ( ! empty( $size_info['file'] ) ) {
					$keep_files[] = $size_info['file'];
				}
			}
		}

		$deleted_files = [];
		$matches = glob( $dir . '/' . $name_part . '-*x*.' . $ext_part );

		if ( is_array( $matches ) ) {
			foreach ( $matches as $filepath ) {
				$filename = basename( $filepath );
				// Safety: never delete the master file, only dimension-suffixed derivatives not in keep_files
				if ( ! in_array( $filename, $keep_files, true ) && preg_match( '/-\d+x\d+\.[a-zA-Z0-9]+$/i', $filename ) ) {
					if ( @unlink( $filepath ) ) {
						$deleted_files[] = $filename;
					}
				}
			}
		}

		return [
			'deleted' => count( $deleted_files ),
			'files'   => $deleted_files,
		];
	}

	/**
	 * AJAX Handler: Batch Regenerate Thumbnails (Chunked Runner)
	 */
	public static function ajax_regenerate_thumbnails(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		global $wpdb;

		@set_time_limit( 120 );
		if ( function_exists( 'ini_set' ) ) {
			@ini_set( 'memory_limit', '1024M' );
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$offset        = isset( $_POST['offset'] ) ? max( 0, (int) $_POST['offset'] ) : 0;
		$batch_size    = isset( $_POST['batch_size'] ) ? max( 1, min( 50, (int) $_POST['batch_size'] ) ) : 15;
		$only_missing  = ! isset( $_POST['only_missing'] ) || '1' === (string) $_POST['only_missing'] || true === $_POST['only_missing'];
		$products_only = isset( $_POST['products_only'] ) ? ( '1' === (string) $_POST['products_only'] || true === $_POST['products_only'] ) : true;

		$where_clause = "WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%'";
		if ( $products_only ) {
			$where_clause .= " AND (
				post_parent IN (SELECT ID FROM {$wpdb->posts} WHERE post_type IN ('product', 'product_variation'))
				OR ID IN (SELECT CAST(meta_value AS UNSIGNED) FROM {$wpdb->postmeta} WHERE meta_key IN ('_thumbnail_id'))
				OR post_title LIKE '%Skin%' OR post_title LIKE '%Body%' OR post_title LIKE '%Case%' OR post_title LIKE '%Gallery%'
			)";
		}

		$total_attachments = (int) $wpdb->get_var(
			"SELECT COUNT(ID) FROM {$wpdb->posts} {$where_clause}"
		);

		$attachment_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} {$where_clause} ORDER BY ID DESC LIMIT %d OFFSET %d",
			$batch_size,
			$offset
		) );

		$regenerated = 0;
		$skipped     = 0;
		$failed      = 0;

		foreach ( $attachment_ids as $att_id ) {
			$att_id = (int) $att_id;
			$source_file = get_attached_file( $att_id );

			if ( ! $source_file || ! file_exists( $source_file ) ) {
				$failed++;
				continue;
			}

			if ( $only_missing && ! self::has_missing_sizes( $att_id ) ) {
				$skipped++;
				continue;
			}

			$new_meta = wp_generate_attachment_metadata( $att_id, $source_file );
			if ( ! empty( $new_meta ) && is_array( $new_meta ) ) {
				wp_update_attachment_metadata( $att_id, $new_meta );
				clean_post_cache( $att_id );
				$regenerated++;
			} else {
				$failed++;
			}
		}

		$processed_in_batch = count( $attachment_ids );
		$next_offset        = $offset + $processed_in_batch;
		$is_complete        = $next_offset >= $total_attachments || 0 === $processed_in_batch;

		wp_send_json_success( [
			'total_attachments'  => $total_attachments,
			'processed_in_batch' => $processed_in_batch,
			'regenerated'        => $regenerated,
			'skipped'            => $skipped,
			'failed'             => $failed,
			'next_offset'        => $next_offset,
			'is_complete'        => $is_complete,
			'message'            => $is_complete
				? "Finished scanning {$total_attachments} media items."
				: "Processed {$next_offset} of {$total_attachments} media items...",
		] );
	}

	/**
	 * AJAX Handler: Batch Clean Old / Unused Thumbnails (Chunked Runner)
	 */
	public static function ajax_delete_old_thumbnails(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		global $wpdb;

		@set_time_limit( 120 );

		$offset        = isset( $_POST['offset'] ) ? max( 0, (int) $_POST['offset'] ) : 0;
		$batch_size    = isset( $_POST['batch_size'] ) ? max( 1, min( 100, (int) $_POST['batch_size'] ) ) : 25;
		$products_only = isset( $_POST['products_only'] ) ? ( '1' === (string) $_POST['products_only'] || true === $_POST['products_only'] ) : false;

		$where_clause = "WHERE post_type = 'attachment' AND post_mime_type LIKE 'image/%'";
		if ( $products_only ) {
			$where_clause .= " AND (
				post_parent IN (SELECT ID FROM {$wpdb->posts} WHERE post_type IN ('product', 'product_variation'))
				OR ID IN (SELECT CAST(meta_value AS UNSIGNED) FROM {$wpdb->postmeta} WHERE meta_key IN ('_thumbnail_id'))
				OR post_title LIKE '%Skin%' OR post_title LIKE '%Body%' OR post_title LIKE '%Case%' OR post_title LIKE '%Gallery%'
			)";
		}

		$total_attachments = (int) $wpdb->get_var(
			"SELECT COUNT(ID) FROM {$wpdb->posts} {$where_clause}"
		);

		$attachment_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} {$where_clause} ORDER BY ID DESC LIMIT %d OFFSET %d",
			$batch_size,
			$offset
		) );

		$total_deleted_files = 0;

		foreach ( $attachment_ids as $att_id ) {
			$res = self::delete_old_thumbnails( (int) $att_id );
			$total_deleted_files += $res['deleted'];
		}

		$processed_in_batch = count( $attachment_ids );
		$next_offset        = $offset + $processed_in_batch;
		$is_complete        = $next_offset >= $total_attachments || 0 === $processed_in_batch;

		wp_send_json_success( [
			'total_attachments'   => $total_attachments,
			'processed_in_batch'  => $processed_in_batch,
			'deleted_files_count' => $total_deleted_files,
			'next_offset'         => $next_offset,
			'is_complete'         => $is_complete,
			'message'             => $is_complete
				? "Cleanup finished. Purged unused intermediate files across {$total_attachments} attachments."
				: "Cleaned {$next_offset} of {$total_attachments} attachments...",
		] );
	}

	/**
	 * Append Exacoat thumbnail derivatives status and generate button to media details.
	 *
	 * @param array    $form_fields Existing form fields.
	 * @param \WP_Post $post        Attachment post object.
	 * @return array Modified form fields.
	 */
	public static function filter_attachment_fields( array $form_fields, \WP_Post $post ): array {
		if ( ! wp_attachment_is_image( $post->ID ) ) {
			return $form_fields;
		}

		$form_fields['exacoat_thumbnails'] = [
			'label' => __( 'Exacoat Sizes', 'exacoat-core' ),
			'input' => 'html',
			'html'  => self::get_attachment_thumbnail_status_html( $post->ID ),
		];

		return $form_fields;
	}

	/**
	 * Compress a master image file without resizing and generate a companion .webp file.
	 *
	 * - Strictly preserves original dimensions (width and height are untouched).
	 * - Only replaces original file if compressed version is smaller in bytes.
	 * - Preserves full alpha transparency for PNGs.
	 * - Generates high-efficiency .webp companion at quality 85.
	 *
	 * @param string $file_path Path to image file on disk.
	 * @param bool   $force_compress Force master compression even if under threshold.
	 * @param int    $min_size_bytes Minimum file size in bytes to trigger master compression (default 500KB).
	 * @param bool   $generate_webp  Whether to generate companion .webp file (default true).
	 * @return array Result stats.
	 */
	public static function optimize_master_file(
		string $file_path,
		bool $force_compress = false,
		int $min_size_bytes = self::LARGE_FILE_THRESHOLD,
		bool $generate_webp = true
	): array {
		if ( empty( $file_path ) || ! file_exists( $file_path ) || ! is_file( $file_path ) ) {
			return [ 'success' => false, 'error' => 'File not found' ];
		}

		$orig_size = (int) @filesize( $file_path );
		if ( $orig_size <= 0 ) {
			return [ 'success' => false, 'error' => 'Empty file' ];
		}

		$img_info = @getimagesize( $file_path );
		if ( empty( $img_info ) || empty( $img_info[0] ) || empty( $img_info[1] ) ) {
			return [ 'success' => false, 'error' => 'Not a valid image' ];
		}

		$orig_w = (int) $img_info[0];
		$orig_h = (int) $img_info[1];
		$mime   = (string) ( $img_info['mime'] ?? '' );

		$master_compressed = false;
		$webp_generated    = false;
		$saved_bytes       = 0;

		$should_compress_master = $force_compress || ( $orig_size >= $min_size_bytes );

		// 1. Compress Master File In-Place (NO RESIZE - PRESERVES EXACT DIMENSIONS)
		if ( $should_compress_master ) {
			if ( in_array( $mime, [ 'image/jpeg', 'image/jpg' ], true ) ) {
				$tmp_file = $file_path . '.exopt.jpg';

				// Try WP_Image_Editor first (handles EXIF orientation & Imagick/GD)
				if ( function_exists( 'wp_get_image_editor' ) ) {
					$editor = wp_get_image_editor( $file_path );
					if ( ! is_wp_error( $editor ) ) {
						$editor->set_quality( self::TARGET_QUALITY );
						$saved = $editor->save( $tmp_file, 'image/jpeg' );
						if ( ! is_wp_error( $saved ) && file_exists( $tmp_file ) ) {
							$tmp_size = (int) @filesize( $tmp_file );
							$tmp_info = @getimagesize( $tmp_file );
							// Guarantee exact dimensions are preserved & size strictly reduced
							if ( $tmp_info && (int) $tmp_info[0] === $orig_w && (int) $tmp_info[1] === $orig_h && $tmp_size > 0 && $tmp_size < $orig_size ) {
								@rename( $tmp_file, $file_path );
								$master_compressed = true;
								$saved_bytes       = $orig_size - $tmp_size;
							} else {
								@unlink( $tmp_file );
							}
						}
					}
				}

				// Fallback to native GD if editor was not used or did not produce savings
				if ( ! $master_compressed && function_exists( 'imagecreatefromjpeg' ) && function_exists( 'imagejpeg' ) ) {
					$im = @imagecreatefromjpeg( $file_path );
					if ( $im ) {
						if ( @imagejpeg( $im, $tmp_file, self::TARGET_QUALITY ) ) {
							$tmp_size = (int) @filesize( $tmp_file );
							$tmp_info = @getimagesize( $tmp_file );
							if ( $tmp_info && (int) $tmp_info[0] === $orig_w && (int) $tmp_info[1] === $orig_h && $tmp_size > 0 && $tmp_size < $orig_size ) {
								@rename( $tmp_file, $file_path );
								$master_compressed = true;
								$saved_bytes       = $orig_size - $tmp_size;
							} else {
								@unlink( $tmp_file );
							}
						}
						imagedestroy( $im );
					}
				}
			} elseif ( 'image/png' === $mime ) {
				$tmp_file = $file_path . '.exopt.png';

				if ( function_exists( 'imagecreatefrompng' ) && function_exists( 'imagepng' ) ) {
					$im = @imagecreatefrompng( $file_path );
					if ( $im ) {
						imagealphablending( $im, false );
						imagesavealpha( $im, true );

						// For huge PNGs (> 500KB), quantize to 128-color palette while preserving alpha (matches Manager)
						if ( $orig_size >= $min_size_bytes && imageistruecolor( $im ) && function_exists( 'imagetruecolortopalette' ) && function_exists( 'imagecreatetruecolor' ) ) {
							$palette_im = imagecreatetruecolor( $orig_w, $orig_h );
							imagealphablending( $palette_im, false );
							imagesavealpha( $palette_im, true );
							imagecopy( $palette_im, $im, 0, 0, 0, 0, $orig_w, $orig_h );
							imagetruecolortopalette( $palette_im, true, 128 );

							if ( @imagepng( $palette_im, $tmp_file, 9 ) ) {
								$tmp_size = (int) @filesize( $tmp_file );
								$tmp_info = @getimagesize( $tmp_file );
								if ( $tmp_info && (int) $tmp_info[0] === $orig_w && (int) $tmp_info[1] === $orig_h && $tmp_size > 0 && $tmp_size < $orig_size ) {
									@rename( $tmp_file, $file_path );
									$master_compressed = true;
									$saved_bytes       = $orig_size - $tmp_size;
								} else {
									@unlink( $tmp_file );
								}
							}
							imagedestroy( $palette_im );
						}

						// Fallback: standard PNG level 9 lossless re-compression
						if ( ! $master_compressed ) {
							if ( @imagepng( $im, $tmp_file, 9 ) ) {
								$tmp_size = (int) @filesize( $tmp_file );
								$tmp_info = @getimagesize( $tmp_file );
								if ( $tmp_info && (int) $tmp_info[0] === $orig_w && (int) $tmp_info[1] === $orig_h && $tmp_size > 0 && $tmp_size < $orig_size ) {
									@rename( $tmp_file, $file_path );
									$master_compressed = true;
									$saved_bytes       = $orig_size - $tmp_size;
								} else {
									@unlink( $tmp_file );
								}
							}
						}
						imagedestroy( $im );
					}
				}
			}
		}

		$current_master_size = (int) @filesize( $file_path );

		// 2. Generate Companion WebP File (NO RESIZE - PRESERVES EXACT DIMENSIONS & FULL ALPHA)
		$webp_path = preg_replace( '/\.(jpe?g|png)$/i', '.webp', $file_path );
		$webp_size = 0;

		if ( $generate_webp && $webp_path && $webp_path !== $file_path ) {
			$needs_webp = ! file_exists( $webp_path ) || ( $master_compressed && ( @filemtime( $file_path ) > @filemtime( $webp_path ) ) );

			if ( $needs_webp ) {
				// Try WP_Image_Editor first
				if ( function_exists( 'wp_get_image_editor' ) ) {
					$editor = wp_get_image_editor( $file_path );
					if ( ! is_wp_error( $editor ) ) {
						$editor->set_quality( self::TARGET_QUALITY );
						$saved_webp = $editor->save( $webp_path, 'image/webp' );
						if ( ! is_wp_error( $saved_webp ) && file_exists( $webp_path ) && filesize( $webp_path ) > 0 ) {
							$webp_generated = true;
						}
					}
				}

				// Fallback to native GD imagewebp
				if ( ! $webp_generated && function_exists( 'imagewebp' ) ) {
					$im = null;
					if ( 'image/png' === $mime && function_exists( 'imagecreatefrompng' ) ) {
						$im = @imagecreatefrompng( $file_path );
					} elseif ( in_array( $mime, [ 'image/jpeg', 'image/jpg' ], true ) && function_exists( 'imagecreatefromjpeg' ) ) {
						$im = @imagecreatefromjpeg( $file_path );
					}

					if ( $im ) {
						if ( ! imageistruecolor( $im ) && function_exists( 'imagepalettetotruecolor' ) ) {
							@imagepalettetotruecolor( $im );
						}
						imagealphablending( $im, true );
						imagesavealpha( $im, true );
						if ( @imagewebp( $im, $webp_path, self::TARGET_QUALITY ) && file_exists( $webp_path ) && filesize( $webp_path ) > 0 ) {
							$webp_generated = true;
						}
						imagedestroy( $im );
					}
				}
			}

			if ( file_exists( $webp_path ) ) {
				$webp_size = (int) @filesize( $webp_path );
			}
		}

		return [
			'success'           => true,
			'master_compressed' => $master_compressed,
			'webp_generated'    => $webp_generated,
			'original_size'     => $orig_size,
			'current_size'      => $current_master_size,
			'saved_bytes'       => $saved_bytes,
			'webp_size'         => $webp_size,
			'webp_path'         => $webp_path,
			'width'             => $orig_w,
			'height'            => $orig_h,
			'mime'              => $mime,
		];
	}

	/**
	 * Optimize an attachment master file and generate WebP companion.
	 *
	 * @param int  $attachment_id   Attachment ID.
	 * @param bool $force_compress  Force master compression regardless of size.
	 * @param int  $min_size_bytes  Minimum file size in bytes to trigger master compression.
	 * @return array
	 */
	public static function optimize_attachment(
		int $attachment_id,
		bool $force_compress = false,
		int $min_size_bytes = self::LARGE_FILE_THRESHOLD
	): array {
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			return [ 'success' => false, 'error' => 'Invalid image attachment ID' ];
		}

		$source_file = get_attached_file( $attachment_id );
		if ( ! $source_file || ! file_exists( $source_file ) ) {
			return [ 'success' => false, 'error' => 'File not found on disk' ];
		}

		$res = self::optimize_master_file( $source_file, $force_compress, $min_size_bytes, true );

		if ( $res['success'] ) {
			update_post_meta( $attachment_id, '_exacoat_optimized_at', current_time( 'mysql' ) );
			if ( ! empty( $res['master_compressed'] ) ) {
				update_post_meta( $attachment_id, '_exacoat_master_compressed', 1 );
				$metadata = wp_get_attachment_metadata( $attachment_id );
				if ( is_array( $metadata ) ) {
					$metadata['filesize'] = $res['current_size'];
					wp_update_attachment_metadata( $attachment_id, $metadata );
				}
				clean_post_cache( $attachment_id );
			}
		}

		return $res;
	}

	/**
	 * Auto-optimize uploads hooking into wp_generate_attachment_metadata.
	 * Runs on every direct WordPress upload: compresses master images over 500KB without resizing & generates .webp.
	 *
	 * @param array $metadata      Attachment metadata.
	 * @param int   $attachment_id Attachment ID.
	 * @return array
	 */
	public static function filter_generate_attachment_metadata( array $metadata, int $attachment_id ): array {
		if ( self::$is_optimizing || $attachment_id <= 0 ) {
			return $metadata;
		}

		self::$is_optimizing = true;
		try {
			$res = self::optimize_attachment( $attachment_id, false, self::LARGE_FILE_THRESHOLD );
			if ( ! empty( $res['master_compressed'] ) && isset( $metadata['filesize'] ) ) {
				$metadata['filesize'] = $res['current_size'];
			}
		} catch ( \Throwable $e ) {
			if ( class_exists( 'Exacoat_Logger' ) ) {
				Exacoat_Logger::log( 'error', 'media', 'Auto-optimization failed for #' . $attachment_id . ': ' . $e->getMessage() );
			}
		} finally {
			self::$is_optimizing = false;
		}

		return $metadata;
	}

	/**
	 * Render HTML widget showing master image status, WebP presence, and sm/md derivatives.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string Rendered HTML.
	 */
	public static function get_attachment_thumbnail_status_html( int $attachment_id ): string {
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			return '';
		}

		$source_file = get_attached_file( $attachment_id );
		if ( ! $source_file || ! file_exists( $source_file ) ) {
			return '<span style="color:#ef4444;font-size:12px;">Original file not found on disk.</span>';
		}

		$dir      = dirname( $source_file );
		$metadata = wp_get_attachment_metadata( $attachment_id );
		$nonce    = wp_create_nonce( 'exacoat_media_thumb_nonce' );

		// Master file status
		$master_size_bytes = (int) @filesize( $source_file );
		$master_size_fmt   = size_format( $master_size_bytes, 1 );
		$is_large          = $master_size_bytes >= self::LARGE_FILE_THRESHOLD;
		$orig_w            = ! empty( $metadata['width'] ) ? (int) $metadata['width'] : 0;
		$orig_h            = ! empty( $metadata['height'] ) ? (int) $metadata['height'] : 0;
		$dim_label         = ( $orig_w && $orig_h ) ? " ({$orig_w}x{$orig_h})" : '';

		// Companion WebP status
		$webp_file     = preg_replace( '/\.(jpe?g|png)$/i', '.webp', $source_file );
		$has_webp      = $webp_file && file_exists( $webp_file );
		$webp_size_fmt = $has_webp ? size_format( (int) @filesize( $webp_file ), 1 ) : '';

		if ( $has_webp ) {
			if ( $is_large ) {
				$master_status_html = sprintf(
					'<span style="color:#059669;font-weight:600;font-size:11px;background:#ecfdf5;padding:2px 7px;border-radius:4px;border:1px solid #a7f3d0;" title="Full resolution master preserved. Companion WebP is active for web delivery.">%s (Full-Res Master)</span>',
					esc_html( $master_size_fmt )
				);
			} else {
				$master_status_html = sprintf(
					'<span style="color:#059669;font-weight:600;font-size:11px;background:#ecfdf5;padding:2px 7px;border-radius:4px;border:1px solid #a7f3d0;" title="Master file is under 500KB threshold.">%s (Optimal)</span>',
					esc_html( $master_size_fmt )
				);
			}
		} else {
			if ( $is_large ) {
				$master_status_html = sprintf(
					'<span style="color:#b45309;font-weight:600;font-size:11px;background:#fffbeb;padding:2px 7px;border-radius:4px;border:1px solid #fde68a;" title="File exceeds 500KB and companion WebP is missing. Click Optimize & WebP below.">%s (Needs Optimization)</span>',
					esc_html( $master_size_fmt )
				);
			} else {
				$master_status_html = sprintf(
					'<span style="color:#b45309;font-weight:600;font-size:11px;background:#fffbeb;padding:2px 7px;border-radius:4px;border:1px solid #fde68a;" title="WebP companion is missing. Click Optimize & WebP below.">%s (No WebP)</span>',
					esc_html( $master_size_fmt )
				);
			}
		}

		$webp_status_html = $has_webp
			? sprintf(
				'<span style="color:#059669;font-weight:600;font-size:11px;background:#ecfdf5;padding:2px 7px;border-radius:4px;border:1px solid #a7f3d0;">Present (%s)</span>',
				esc_html( $webp_size_fmt )
			)
			: '<span style="color:#dc2626;font-weight:600;font-size:11px;background:#fef2f2;padding:2px 7px;border-radius:4px;border:1px solid #fecaca;">Missing</span>';

		$sizes = [
			'sm' => [
				'key'   => self::THUMB_SM,
				'label' => 'sm (240x240)',
			],
			'md' => [
				'key'   => self::THUMB_MD,
				'label' => 'md (720x720)',
			],
		];

		$has_missing_thumbs = false;
		$rows_html          = '';

		// Master File Row
		$rows_html .= sprintf(
			'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:12px;">' .
				'<span style="font-weight:600;color:#374151;">Master File%s</span>' .
				'<div style="display:flex;align-items:center;">%s</div>' .
			'</div>',
			esc_html( $dim_label ),
			$master_status_html
		);

		// WebP Companion Row
		$rows_html .= sprintf(
			'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:12px;">' .
				'<span style="font-weight:600;color:#374151;">Companion WebP</span>' .
				'<div style="display:flex;align-items:center;">%s</div>' .
			'</div>',
			$webp_status_html
		);

		// Thumbnails Rows
		foreach ( $sizes as $size_info ) {
			$key        = $size_info['key'];
			$label      = $size_info['label'];
			$size_entry = ( is_array( $metadata ) && ! empty( $metadata['sizes'][ $key ] ) ) ? $metadata['sizes'][ $key ] : null;
			$file_name  = ! empty( $size_entry['file'] ) ? $size_entry['file'] : '';
			$file_path  = $file_name ? path_join( $dir, $file_name ) : '';
			$exists     = $file_path && file_exists( $file_path );

			if ( ! $exists ) {
				$has_missing_thumbs = true;
				$status_html        = '<span style="color:#dc2626;font-weight:600;font-size:11px;background:#fef2f2;padding:2px 7px;border-radius:4px;border:1px solid #fecaca;">Missing</span>';
			} else {
				$file_size = size_format( filesize( $file_path ), 1 );
				$file_url  = wp_get_attachment_image_url( $attachment_id, $key );
				if ( ! $file_url && $file_name ) {
					$upload_dir = wp_upload_dir();
					$rel_dir    = str_replace( wp_normalize_path( $upload_dir['basedir'] ), '', wp_normalize_path( $dir ) );
					$file_url   = $upload_dir['baseurl'] . $rel_dir . '/' . $file_name;
				}

				$status_html = sprintf(
					'<span style="color:#059669;font-weight:600;font-size:11px;background:#ecfdf5;padding:2px 7px;border-radius:4px;border:1px solid #a7f3d0;">Present (%s)</span>' .
					( $file_url ? ' <a href="%s" target="_blank" rel="noopener noreferrer" style="font-size:11px;text-decoration:none;margin-left:4px;color:#2563eb;" title="View derivative">View &#8599;</a>' : '' ),
					esc_html( $file_size ),
					esc_url( $file_url )
				);
			}

			$rows_html .= sprintf(
				'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:12px;">' .
					'<span style="font-weight:600;color:#374151;">%s</span>' .
					'<div style="display:flex;align-items:center;">%s</div>' .
				'</div>',
				esc_html( $label ),
				$status_html
			);
		}

		$regen_btn_text = $has_missing_thumbs ? 'Generate sm & md' : 'Regen sm & md';
		$opt_btn_text   = $has_webp ? 'Re-optimize & WebP' : 'Optimize & WebP';

		return sprintf(
			'<div id="exacoat-thumb-status-%1$d" class="exacoat-thumb-status-container" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:9px 11px;margin-top:4px;max-width:340px;">' .
				'%2$s' .
				'<div style="margin-top:8px;padding-top:7px;border-top:1px solid #e5e7eb;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' .
					'<button type="button" class="button button-small button-primary exacoat-opt-master-btn" data-attachment-id="%1$d" data-nonce="%3$s" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;height:26px;line-height:24px;">' .
						'<span class="dashicons dashicons-performance" style="font-size:13px;width:13px;height:13px;line-height:13px;"></span>' .
						'<span>%5$s</span>' .
					'</button>' .
					'<button type="button" class="button button-small exacoat-regen-thumb-btn" data-attachment-id="%1$d" data-nonce="%3$s" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;height:26px;line-height:24px;">' .
						'<span class="dashicons dashicons-update" style="font-size:13px;width:13px;height:13px;line-height:13px;"></span>' .
						'<span>%4$s</span>' .
					'</button>' .
					'<span class="spinner exacoat-regen-spinner" style="float:none;margin:0;display:none;vertical-align:middle;"></span>' .
					'<span class="exacoat-regen-msg" style="font-size:11px;font-weight:500;"></span>' .
				'</div>' .
			'</div>',
			$attachment_id,
			$rows_html,
			esc_attr( $nonce ),
			esc_html( $regen_btn_text ),
			esc_html( $opt_btn_text )
		);
	}

	/**
	 * AJAX Handler: Single Attachment Thumbnail Generation.
	 */
	public static function ajax_regenerate_single_thumbnail(): void {
		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized user.' ] );
		}

		check_ajax_referer( 'exacoat_media_thumb_nonce', 'nonce' );

		$attachment_id = isset( $_POST['attachment_id'] ) ? (int) $_POST['attachment_id'] : 0;
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			wp_send_json_error( [ 'message' => 'Invalid image attachment ID.' ] );
		}

		$success = self::regenerate_attachment_thumbnails( $attachment_id, false );
		if ( ! $success ) {
			wp_send_json_error( [ 'message' => 'Generation failed. Verify source file on disk.' ] );
		}

		$html = self::get_attachment_thumbnail_status_html( $attachment_id );
		wp_send_json_success( [
			'attachment_id' => $attachment_id,
			'html'          => $html,
			'message'       => 'Thumbnails generated successfully.',
		] );
	}

	/**
	 * AJAX Handler: Single Attachment Master Image Optimization & WebP Generation.
	 */
	public static function ajax_optimize_single_image(): void {
		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized user.' ] );
		}

		check_ajax_referer( 'exacoat_media_thumb_nonce', 'nonce' );

		$attachment_id = isset( $_POST['attachment_id'] ) ? (int) $_POST['attachment_id'] : 0;
		if ( $attachment_id <= 0 || ! wp_attachment_is_image( $attachment_id ) ) {
			wp_send_json_error( [ 'message' => 'Invalid image attachment ID.' ] );
		}

		$res = self::optimize_attachment( $attachment_id, true, 0 );
		if ( empty( $res['success'] ) ) {
			wp_send_json_error( [ 'message' => $res['error'] ?? 'Optimization failed.' ] );
		}

		$html = self::get_attachment_thumbnail_status_html( $attachment_id );
		$msg  = 'Optimization complete. ';
		if ( ! empty( $res['master_compressed'] ) ) {
			$msg .= 'Compressed master, saved ' . size_format( $res['saved_bytes'], 1 ) . '. ';
		} else {
			$msg .= 'Master file already optimal. ';
		}
		if ( ! empty( $res['webp_generated'] ) ) {
			$msg .= 'Generated companion .webp (' . size_format( $res['webp_size'], 1 ) . ').';
		}

		wp_send_json_success( [
			'attachment_id' => $attachment_id,
			'html'          => $html,
			'message'       => trim( $msg ),
		] );
	}

	/**
	 * AJAX Handler: Batch Master Image Optimizer & WebP Generator (Chunked Runner).
	 */
	public static function ajax_batch_optimize_images(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized administrator access.' ] );
		}

		global $wpdb;

		@set_time_limit( 180 );
		if ( function_exists( 'ini_set' ) ) {
			@ini_set( 'memory_limit', '1024M' );
		}

		$offset          = isset( $_POST['offset'] ) ? max( 0, (int) $_POST['offset'] ) : 0;
		$batch_size      = isset( $_POST['batch_size'] ) ? max( 1, min( 50, (int) $_POST['batch_size'] ) ) : 15;
		$only_over_500kb = ! isset( $_POST['only_over_500kb'] ) || '1' === (string) $_POST['only_over_500kb'] || true === $_POST['only_over_500kb'];
		$generate_webp   = ! isset( $_POST['generate_webp'] ) || '1' === (string) $_POST['generate_webp'] || true === $_POST['generate_webp'];
		$products_only   = isset( $_POST['products_only'] ) && ( '1' === (string) $_POST['products_only'] || true === $_POST['products_only'] );

		$where_clause = "WHERE post_type = 'attachment' AND post_mime_type IN ('image/jpeg', 'image/jpg', 'image/png')";
		if ( $products_only ) {
			$where_clause .= " AND (
				post_parent IN (SELECT ID FROM {$wpdb->posts} WHERE post_type IN ('product', 'product_variation'))
				OR ID IN (SELECT CAST(meta_value AS UNSIGNED) FROM {$wpdb->postmeta} WHERE meta_key IN ('_thumbnail_id'))
				OR post_title LIKE '%Skin%' OR post_title LIKE '%Body%' OR post_title LIKE '%Case%' OR post_title LIKE '%Gallery%' OR post_title LIKE '%Texture%'
			)";
		}

		$total_attachments = (int) $wpdb->get_var(
			"SELECT COUNT(ID) FROM {$wpdb->posts} {$where_clause}"
		);

		$attachment_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} {$where_clause} ORDER BY ID DESC LIMIT %d OFFSET %d",
			$batch_size,
			$offset
		) );

		$compressed_count = 0;
		$webp_count       = 0;
		$saved_bytes      = 0;
		$skipped_count    = 0;

		$threshold_bytes = $only_over_500kb ? self::LARGE_FILE_THRESHOLD : 0;

		foreach ( $attachment_ids as $att_id ) {
			$att_id      = (int) $att_id;
			$source_file = get_attached_file( $att_id );

			if ( ! $source_file || ! file_exists( $source_file ) ) {
				$skipped_count++;
				continue;
			}

			$current_size = (int) @filesize( $source_file );
			$webp_file    = preg_replace( '/\.(jpe?g|png)$/i', '.webp', $source_file );
			$has_webp     = $webp_file && file_exists( $webp_file );

			$needs_compression = ( $current_size >= $threshold_bytes );
			$needs_webp        = $generate_webp && ! $has_webp;

			if ( ! $needs_compression && ! $needs_webp ) {
				$skipped_count++;
				continue;
			}

			$res = self::optimize_master_file(
				$source_file,
				! $only_over_500kb,
				self::LARGE_FILE_THRESHOLD,
				$generate_webp
			);

			if ( ! empty( $res['master_compressed'] ) ) {
				$compressed_count++;
				$saved_bytes += (int) ( $res['saved_bytes'] ?? 0 );
			}

			if ( ! empty( $res['webp_generated'] ) ) {
				$webp_count++;
			}
		}

		$processed_in_batch = count( $attachment_ids );
		$next_offset        = $offset + $processed_in_batch;
		$is_complete        = $next_offset >= $total_attachments || 0 === $processed_in_batch;

		wp_send_json_success( [
			'total_attachments'  => $total_attachments,
			'processed_in_batch' => $processed_in_batch,
			'compressed_count'   => $compressed_count,
			'webp_count'         => $webp_count,
			'saved_bytes'        => $saved_bytes,
			'formatted_saved'    => size_format( $saved_bytes, 1 ),
			'skipped_count'      => $skipped_count,
			'next_offset'        => $next_offset,
			'is_complete'        => $is_complete,
			'message'            => $is_complete
				? "Optimization complete. Scanned {$total_attachments} media items."
				: "Processed {$next_offset} of {$total_attachments} media items...",
		] );
	}

	/**
	 * Print inline admin JavaScript for 1-click thumbnail generation and master optimization.
	 */
	public static function print_admin_scripts(): void {
		if ( ! is_admin() ) {
			return;
		}
		?>
		<script>
		jQuery(document).ready(function($) {
			// Single Thumbnail Regeneration
			$(document).on('click', '.exacoat-regen-thumb-btn', function(e) {
				e.preventDefault();
				var $btn = $(this);
				var attachmentId = $btn.data('attachment-id');
				var nonce = $btn.data('nonce');
				var $container = $('#exacoat-thumb-status-' + attachmentId);
				var $spinner = $container.find('.exacoat-regen-spinner');
				var $msg = $container.find('.exacoat-regen-msg');

				$btn.prop('disabled', true);
				$spinner.css('display', 'inline-block').addClass('is-active');
				$msg.text('Generating...').css('color', '#6b7280');

				$.post(ajaxurl, {
					action: 'exacoat_regenerate_single_thumbnail',
					attachment_id: attachmentId,
					nonce: nonce
				}).done(function(res) {
					if (res && res.success && res.data && res.data.html) {
						$container.replaceWith(res.data.html);
					} else {
						$btn.prop('disabled', false);
						$spinner.css('display', 'none').removeClass('is-active');
						$msg.text(res && res.data && res.data.message ? res.data.message : 'Error generating.').css('color', '#dc2626');
					}
				}).fail(function() {
					$btn.prop('disabled', false);
					$spinner.css('display', 'none').removeClass('is-active');
					$msg.text('Network error.').css('color', '#dc2626');
				});
			});

			// Single Master Image Optimization & WebP Generation
			$(document).on('click', '.exacoat-opt-master-btn', function(e) {
				e.preventDefault();
				var $btn = $(this);
				var attachmentId = $btn.data('attachment-id');
				var nonce = $btn.data('nonce');
				var $container = $('#exacoat-thumb-status-' + attachmentId);
				var $spinner = $container.find('.exacoat-regen-spinner');
				var $msg = $container.find('.exacoat-regen-msg');

				$btn.prop('disabled', true);
				$spinner.css('display', 'inline-block').addClass('is-active');
				$msg.text('Optimizing master & WebP...').css('color', '#6b7280');

				$.post(ajaxurl, {
					action: 'exacoat_optimize_single_image',
					attachment_id: attachmentId,
					nonce: nonce
				}).done(function(res) {
					if (res && res.success && res.data && res.data.html) {
						$container.replaceWith(res.data.html);
					} else {
						$btn.prop('disabled', false);
						$spinner.css('display', 'none').removeClass('is-active');
						$msg.text(res && res.data && res.data.message ? res.data.message : 'Optimization failed.').css('color', '#dc2626');
					}
				}).fail(function() {
					$btn.prop('disabled', false);
					$spinner.css('display', 'none').removeClass('is-active');
					$msg.text('Network error.').css('color', '#dc2626');
				});
			});
		});
		</script>
		<?php
	}
}

}

if ( ! class_exists( 'Artmatter_Image_Sizes' ) ) {
	class_alias( 'Exacoat_Image_Sizes', 'Artmatter_Image_Sizes' );
}

