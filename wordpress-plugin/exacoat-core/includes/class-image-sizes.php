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

	public static function init(): void {
		// Register image sizes early
		add_action( 'init', [ __CLASS__, 'register' ], 5 );

		// AJAX Endpoints for Admin Dashboard
		add_action( 'wp_ajax_exacoat_regenerate_thumbnails', [ __CLASS__, 'ajax_regenerate_thumbnails' ] );
		add_action( 'wp_ajax_artmatter_regenerate_thumbnails', [ __CLASS__, 'ajax_regenerate_thumbnails' ] );
		add_action( 'wp_ajax_exacoat_delete_old_thumbnails', [ __CLASS__, 'ajax_delete_old_thumbnails' ] );
		add_action( 'wp_ajax_artmatter_delete_old_thumbnails', [ __CLASS__, 'ajax_delete_old_thumbnails' ] );
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
}

}

if ( ! class_exists( 'Artmatter_Image_Sizes' ) ) {
	class_alias( 'Exacoat_Image_Sizes', 'Artmatter_Image_Sizes' );
}
