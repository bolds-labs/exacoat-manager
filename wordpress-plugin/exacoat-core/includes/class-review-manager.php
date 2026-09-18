<?php
/**
 * Artmatter Core Review & Collector Feedback Manager
 * 
 * Handles customer reviews, photo/video uploads, client/server compression,
 * Cloudflare R2 mirroring, Action Scheduler post-delivery invitations,
 * WooCommerce product rating synchronization, and front-end museum widgets.
 *
 * @package Exacoat_Core
 * @version 7.10.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Review_Manager' ) ) {

class Exacoat_Review_Manager {

	/**
	 * Table name
	 */
	public static function get_table_name(): string {
		global $wpdb;
		return $wpdb->prefix . 'artmatter_reviews';
	}

	/**
	 * Initialization
	 */
	public static function init() {
		// 1. Create / Update tables on admin_init or install
		add_action( 'admin_init', [ __CLASS__, 'check_table_schema' ] );

		// 2. Action Scheduler worker for post-delivery review invitation
		add_action( 'artmatter_send_review_invitation_job', [ __CLASS__, 'process_review_invitation_job' ], 10, 1 );

		// 3. Register REST API routes
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// 4. Register Shortcodes
		add_shortcode( 'exacoat_reviews', [ __CLASS__, 'render_reviews_shortcode' ] );
		add_shortcode( 'exacoat_product_reviews', [ __CLASS__, 'render_product_reviews_shortcode' ] );
		add_shortcode( 'exacoat_order_review', [ __CLASS__, 'render_review_submission_shortcode' ] );
		add_shortcode( 'artmatter_reviews', [ __CLASS__, 'render_reviews_shortcode' ] );
		add_shortcode( 'artmatter_custom_reviews', [ __CLASS__, 'render_custom_reviews_shortcode' ] );
		add_shortcode( 'artmatter_custom_art_reviews', [ __CLASS__, 'render_custom_reviews_shortcode' ] );
		add_shortcode( 'artmatter_product_reviews', [ __CLASS__, 'render_product_reviews_shortcode' ] );
		add_shortcode( 'artmatter_order_review', [ __CLASS__, 'render_review_submission_shortcode' ] );

		// 5. Enqueue frontend scripts & styles on demand
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'register_frontend_assets' ] );

		// 6. WooCommerce coupon rules: enforce strict non-stackable Exacoat Perks promo codes
		add_filter( 'woocommerce_apply_with_individual_use_coupon', '__return_false', 999 );
		add_filter( 'woocommerce_coupon_is_valid', [ __CLASS__, 'prevent_coupon_stacking' ], 10, 3 );
	}

	/**
	 * Create or update database schema
	 */
	public static function create_tables() {
		global $wpdb;
		$table_name      = self::get_table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
			id bigint(20) NOT NULL AUTO_INCREMENT,
			order_id bigint(20) NOT NULL,
			order_number varchar(50) NOT NULL DEFAULT '',
			product_id bigint(20) NOT NULL DEFAULT 0,
			artwork_id varchar(100) NOT NULL DEFAULT '',
			artwork_title varchar(255) NOT NULL DEFAULT '',
			artwork_image text NOT NULL,
			artist_name varchar(255) NOT NULL DEFAULT '',
			customer_name varchar(255) NOT NULL DEFAULT '',
			customer_email varchar(255) NOT NULL DEFAULT '',
			customer_location varchar(100) NOT NULL DEFAULT '',
			is_anonymous tinyint(1) NOT NULL DEFAULT 0,
			rating decimal(3,1) NOT NULL DEFAULT 5.0,
			title varchar(255) NOT NULL DEFAULT '',
			content text NOT NULL,
			media longtext NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'pending',
			verified_purchase tinyint(1) NOT NULL DEFAULT 1,
			wc_comment_id bigint(20) DEFAULT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
			PRIMARY KEY  (id),
			KEY order_id (order_id),
			KEY product_id (product_id),
			KEY status (status),
			KEY rating (rating),
			KEY created_at (created_at)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		self::ensure_reviews_dir();
	}

	/**
	 * Check schema version
	 */
	public static function check_table_schema() {
		global $wpdb;
		$table_name = self::get_table_name();
		$schema_ver = get_option( 'artmatter_reviews_schema_version', '0' );
		if ( version_compare( $schema_ver, '1.2.0', '<' ) ) {
			self::create_tables();

			// Ensure is_anonymous column exists for existing installations
			$col = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name} LIKE 'is_anonymous'" );
			if ( empty( $col ) ) {
				$wpdb->query( "ALTER TABLE {$table_name} ADD COLUMN is_anonymous tinyint(1) NOT NULL DEFAULT 0 AFTER customer_location" );
			}

			// Ensure rating is decimal(3,1) to support half-stars (e.g. 4.5)
			$rating_col = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name} LIKE 'rating'" );
			if ( ! empty( $rating_col ) && stripos( $rating_col[0]->Type ?? '', 'decimal' ) === false ) {
				$wpdb->query( "ALTER TABLE {$table_name} MODIFY COLUMN rating decimal(3,1) NOT NULL DEFAULT 5.0" );
			}

			update_option( 'artmatter_reviews_schema_version', '1.2.0' );
		}
	}

	/**
	 * Ensure dedicated reviews upload directory exists
	 */
	public static function ensure_reviews_dir(): string {
		$upload_dir = wp_upload_dir();
		$base_dir   = trailingslashit( $upload_dir['basedir'] ) . 'artmatter-reviews';

		if ( ! file_exists( $base_dir ) ) {
			wp_mkdir_p( $base_dir );
			@file_put_contents( $base_dir . '/index.php', '<?php // Silence is golden' );
		}

		$cur_year_month = date( 'Y/m' );
		$target_dir     = $base_dir . '/' . $cur_year_month;
		if ( ! file_exists( $target_dir ) ) {
			wp_mkdir_p( $target_dir );
			@file_put_contents( $target_dir . '/index.php', '<?php // Silence is golden' );
		}

		return $target_dir;
	}

	/**
	 * Get upload URL for reviews directory
	 */
	public static function get_reviews_upload_url( string $subpath = '' ): string {
		$upload_dir = wp_upload_dir();
		$base_url   = trailingslashit( $upload_dir['baseurl'] ) . 'artmatter-reviews';
		return trailingslashit( $base_url ) . ltrim( $subpath, '/' );
	}

	/**
	 * Generate signed HMAC zero-login token for review submission
	 */
	public static function generate_review_token( $order_id, $billing_email ): string {
		$secret = wp_salt( 'auth' );
		return hash_hmac( 'sha256', "{$order_id}|" . strtolower( trim( $billing_email ) ), $secret );
	}

	/**
	 * Verify signed HMAC zero-login token
	 */
	public static function verify_review_token( $order_id, $billing_email, $token ): bool {
		$expected = self::generate_review_token( $order_id, $billing_email );
		return hash_equals( $expected, (string) $token );
	}

	/**
	 * Mask customer name for privacy (e.g. "Alexander Miller" -> "A***m", "Adam" -> "A***m")
	 */
	public static function mask_customer_name( string $name ): string {
		$name = trim( $name );
		if ( empty( $name ) ) {
			return __('Verified Buyer', 'exacoat-core');
		}

		if ( strpos( $name, '***' ) !== false ) {
			return $name;
		}

		$clean = preg_replace( '/[^\p{L}\p{N}]/u', '', $name );
		if ( mb_strlen( $clean ) <= 2 ) {
			return mb_substr( $clean, 0, 1 ) . '***';
		}

		$first = mb_strtoupper( mb_substr( $clean, 0, 1 ) );
		$last  = mb_strtolower( mb_substr( $clean, -1 ) );

		return $first . '***' . $last;
	}

	/**
	 * Get direct review link for an order
	 */
	public static function get_review_url( $order ): string {
		if ( is_numeric( $order ) ) {
			$order = wc_get_order( $order );
		}
		if ( ! $order ) {
			return home_url( '/review' );
		}

		$order_id      = $order->get_id();
		$billing_email = $order->get_billing_email();
		$order_key     = $order->get_order_key();
		$token         = self::generate_review_token( $order_id, $billing_email );

		return add_query_arg( [
			'order_id'    => $order->get_order_number(),
			'order_email' => rawurlencode( $billing_email ),
			'key'         => $order_key,
			'token'       => $token,
		], home_url( '/review' ) );
	}

	/**
	 * Schedule post-delivery review invitation
	 */
	public static function schedule_review_invitation( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		// Don't schedule if already invited, already reviewed, or cancelled
		if ( $order->get_meta( '_artmatter_review_invited_at' ) || $order->get_meta( '_artmatter_has_review' ) ) {
			return;
		}

		// Configurable delay: default 36 hours (range 12h to 72h)
		$settings     = Exacoat_Core::get_settings();
		$delay_hours  = (int) ( $settings['review_invitation_delay_hours'] ?? 36 );
		if ( $delay_hours < 6 ) {
			$delay_hours = 36;
		}

		$scheduled_time = time() + ( $delay_hours * HOUR_IN_SECONDS );

		if ( function_exists( 'as_schedule_single_action' ) ) {
			// Unschedule any previous pending invitation for this order to prevent duplicates
			if ( function_exists( 'as_unschedule_action' ) ) {
				as_unschedule_action( 'artmatter_send_review_invitation_job', [ 'order_id' => (int) $order_id ], 'artmatter-reviews' );
			}
			as_schedule_single_action(
				$scheduled_time,
				'artmatter_send_review_invitation_job',
				[ 'order_id' => (int) $order_id ],
				'artmatter-reviews'
			);
		} else {
			wp_schedule_single_event(
				$scheduled_time,
				'artmatter_send_review_invitation_job',
				[ (int) $order_id ]
			);
		}

		$scheduled_iso = gmdate( 'Y-m-d H:i:s', $scheduled_time );
		$order->update_meta_data( '_artmatter_review_invite_scheduled_at', $scheduled_iso );
		$order->save();
	}

	/**
	 * Cancel scheduled invitation if order refunded or cancelled
	 */
	public static function cancel_scheduled_invitation( $order_id ) {
		if ( function_exists( 'as_unschedule_action' ) ) {
			as_unschedule_action( 'artmatter_send_review_invitation_job', [ 'order_id' => (int) $order_id ], 'artmatter-reviews' );
		}
		$order = wc_get_order( $order_id );
		if ( $order ) {
			$order->delete_meta_data( '_artmatter_review_invite_scheduled_at' );
			$order->save();
		}
	}

	/**
	 * Process review invitation Action Scheduler job
	 */
	public static function process_review_invitation_job( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		// Verify order is still in delivered/completed status
		$status = $order->get_status();
		if ( ! in_array( $status, [ 'completed', 'delivered' ], true ) ) {
			return;
		}

		// Don't re-invite if already sent or already reviewed
		if ( $order->get_meta( '_artmatter_review_invited_at' ) || $order->get_meta( '_artmatter_has_review' ) ) {
			return;
		}

		$customer_email = $order->get_billing_email();
		$customer_name  = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
		if ( empty( $customer_name ) ) {
			$customer_name = 'Customer';
		}

		$review_url = self::get_review_url( $order );

		// Extract first product thumbnail & title
		$art_title = 'Precision Device Skin';
		$art_image = 'https://media.artmatter.co/assets/sample-art.jpg';
		$artist = 'Exacoat';

		foreach ( $order->get_items() as $item ) {
			$prod = $item->get_product();
			if ( $prod ) {
				$art_title = $item->get_name();
				$img_id    = $prod->get_image_id();
				if ( $img_id ) {
					$art_image = wp_get_attachment_image_url( $img_id, 'medium' ) ?: $art_image;
				}
				$artist_meta = 'Exacoat';
				if ( $artist_meta ) {
					$artist = (string) $artist_meta;
				}
				break;
			}
		}

		// Dispatch via Artmatter Email Engine
		if ( class_exists( 'Artmatter_Email_Engine' ) ) {
			$reward_settings = self::get_reward_settings();
			$discount_pct    = ! empty( $reward_settings['enabled'] ) ? (int) ( $reward_settings['discount_percent'] ?? 20 ) : 0;

			$payload = [
				'order_number'        => $order->get_order_number(),
				'customer_first_name' => $order->get_billing_first_name() ?: 'Collector',
				'artwork_title'       => $art_title,
				'artwork_image'       => $art_image,
				'artist_name'         => $artist,
				'review_url'          => $review_url,
				'discount_percent'    => $discount_pct,
				'has_reward'          => $discount_pct > 0 ? 1 : 0,
			];

			Artmatter_Email_Engine::send_email(
				'customer_order_review_invitation',
				$customer_email,
				$customer_name,
				$payload
			);

			$sent_iso = current_time( 'mysql' );
			$order->update_meta_data( '_artmatter_review_invited_at', $sent_iso );
			$order->delete_meta_data( '_artmatter_review_invite_scheduled_at' );
			$order->save();
		}
	}

	/**
	 * Handle Photo Upload & WebP Compression
	/**
	 * Locate FFmpeg binary on Windows or Linux/macOS
	 */
	public static function get_ffmpeg_binary(): ?string {
		static $ffmpeg_bin = null;
		if ( null !== $ffmpeg_bin ) {
			return $ffmpeg_bin ?: null;
		}

		// Check if shell_exec is available and not disabled in php.ini
		if ( ! function_exists( 'shell_exec' ) ) {
			$ffmpeg_bin = false;
			return null;
		}
		$disabled = array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) );
		if ( in_array( 'shell_exec', $disabled, true ) || in_array( 'escapeshellcmd', $disabled, true ) ) {
			$ffmpeg_bin = false;
			return null;
		}

		// 1. Direct common path checks
		$common_paths = [
			'C:\\WINDOWS\\system32\\ffmpeg.exe',
			'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
			'/usr/bin/ffmpeg',
			'/usr/local/bin/ffmpeg',
			'/opt/homebrew/bin/ffmpeg',
			'/usr/bin/ffmpeg.exe',
		];
		foreach ( $common_paths as $p ) {
			if ( @file_exists( $p ) ) {
				$ffmpeg_bin = $p;
				return $ffmpeg_bin;
			}
		}

		// 2. Shell lookup ('where ffmpeg' on Windows, 'which ffmpeg' on Linux/macOS)
		$lookup_cmd = ( DIRECTORY_SEPARATOR === '\\' ) ? 'where ffmpeg 2>nul' : 'which ffmpeg 2>/dev/null';
		$found      = trim( (string) @shell_exec( $lookup_cmd ) );
		if ( ! empty( $found ) ) {
			$lines = preg_split( '/[\r\n]+/', $found );
			$first = trim( $lines[0] ?? '' );
			if ( ! empty( $first ) && @file_exists( $first ) ) {
				$ffmpeg_bin = $first;
				return $ffmpeg_bin;
			}
		}

		// 3. Fallback: test running bare 'ffmpeg -version'
		$test = @shell_exec( 'ffmpeg -version 2>&1' );
		if ( $test && str_contains( $test, 'ffmpeg version' ) ) {
			$ffmpeg_bin = 'ffmpeg';
			return $ffmpeg_bin;
		}

		$ffmpeg_bin = false;
		return null;
	}

	/**
	 * Handle Photo Upload & Modern WebP Conversion (including HEIC/HEIF)
	 */
	public static function process_photo_upload( array $file_info, int $order_id ): array {
		$target_dir = self::ensure_reviews_dir();
		$cur_ym     = date( 'Y/m' );

		// Enforce 100MB file size limit
		if ( ! empty( $file_info['size'] ) && $file_info['size'] > 100 * 1024 * 1024 ) {
			throw new Exception( 'Image exceeds maximum 100MB limit.' );
		}

		$ext = strtolower( pathinfo( $file_info['name'], PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, [ 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif' ], true ) ) {
			throw new Exception( 'Unsupported image format. Please upload JPG, PNG, WebP, or HEIC.' );
		}

		$hash_id     = wp_generate_password( 8, false );
		$filename    = 'rev_' . $order_id . '_' . $hash_id . '.webp';
		$target_path = trailingslashit( $target_dir ) . $filename;
		$width       = 1600;
		$height      = 1200;
		$converted   = false;

		$ffmpeg = self::get_ffmpeg_binary();

		// If HEIC / HEIF, convert to WebP via FFmpeg or Imagick
		if ( in_array( $ext, [ 'heic', 'heif' ], true ) ) {
			if ( $ffmpeg ) {
				$cmd = escapeshellcmd( $ffmpeg ) . ' -i ' . escapeshellarg( $file_info['tmp_name'] ) . ' -vf "scale=\'min(1920,iw)\':-2" -q:v 82 -y ' . escapeshellarg( $target_path ) . ' 2>&1';
				@shell_exec( $cmd );
				if ( file_exists( $target_path ) && filesize( $target_path ) > 0 ) {
					$converted = true;
				}
			}

			if ( ! $converted && class_exists( 'Imagick' ) ) {
				try {
					$im = new Imagick( $file_info['tmp_name'] );
					$im->setImageFormat( 'webp' );
					$im->setImageCompressionQuality( 82 );
					if ( $im->getImageWidth() > 1920 || $im->getImageHeight() > 1920 ) {
						$im->resizeImage( 1920, 1920, Imagick::FILTER_LANCZOS, 1, true );
					}
					$im->writeImage( $target_path );
					$im->clear();
					$im->destroy();
					if ( file_exists( $target_path ) && filesize( $target_path ) > 0 ) {
						$converted = true;
					}
				} catch ( Exception $ie ) {
					// Fall through
				}
			}

			if ( ! $converted ) {
				// Fallback: move as original heic
				$fallback_fn   = 'rev_' . $order_id . '_' . $hash_id . '.' . $ext;
				$fallback_path = trailingslashit( $target_dir ) . $fallback_fn;
				move_uploaded_file( $file_info['tmp_name'], $fallback_path );
				$target_path = $fallback_path;
				$filename    = $fallback_fn;
			}
		} else {
			// Standard image (JPG, PNG, WebP) - use WP Image Editor
			$editor = wp_get_image_editor( $file_info['tmp_name'] );
			if ( ! is_wp_error( $editor ) ) {
				$size   = $editor->get_size();
				$width  = $size['width'] ?? 1600;
				$height = $size['height'] ?? 1200;

				if ( $width > 1920 || $height > 1920 ) {
					$editor->resize( 1920, 1920, false );
					$new_size = $editor->get_size();
					$width    = $new_size['width'];
					$height   = $new_size['height'];
				}

				$editor->set_quality( 82 );
				$saved = $editor->save( $target_path, 'image/webp' );

				if ( is_wp_error( $saved ) ) {
					$fallback_fn   = 'rev_' . $order_id . '_' . $hash_id . '.' . $ext;
					$fallback_path = trailingslashit( $target_dir ) . $fallback_fn;
					move_uploaded_file( $file_info['tmp_name'], $fallback_path );
					$target_path = $fallback_path;
					$filename    = $fallback_fn;
				}
			} else {
				move_uploaded_file( $file_info['tmp_name'], $target_path );
			}
		}

		if ( file_exists( $target_path ) ) {
			$dims = @getimagesize( $target_path );
			if ( ! empty( $dims[0] ) && ! empty( $dims[1] ) ) {
				$width  = (int) $dims[0];
				$height = (int) $dims[1];
			}
		}

		$local_url     = self::get_reviews_upload_url( $cur_ym . '/' . $filename );
		$remote_r2_key = "reviews/{$cur_ym}/{$filename}";
		$r2_synced     = false;

		// Mirror to Cloudflare R2
		if ( class_exists( 'Artmatter_R2' ) && Artmatter_R2::is_configured() ) {
			$r2_synced = Artmatter_R2::upload_file( $target_path, $remote_r2_key );
		}

		return [
			'type'       => 'photo',
			'url'        => $local_url,
			'r2_key'     => $remote_r2_key,
			'r2_synced'  => $r2_synced ? 1 : 0,
			'width'      => $width,
			'height'     => $height,
			'poster_url' => $local_url,
		];
	}

	/**
	 * Handle Video Upload & Transcode to Ultra-Efficient WebM (VP9 + Opus)
	 */
	public static function process_video_upload( array $file_info, int $order_id ): array {
		$target_dir = self::ensure_reviews_dir();
		$cur_ym     = date( 'Y/m' );

		// Enforce 100MB file size limit
		if ( $file_info['size'] > 100 * 1024 * 1024 ) {
			throw new Exception( 'Video exceeds maximum 100MB limit.' );
		}

		$ext = strtolower( pathinfo( $file_info['name'], PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, [ 'mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv' ], true ) ) {
			throw new Exception( 'Unsupported video format. Please upload MP4 or WebM.' );
		}

		$hash_id       = wp_generate_password( 8, false );
		$raw_filename  = 'rev_' . $order_id . '_' . $hash_id . '_raw.' . $ext;
		$raw_path      = trailingslashit( $target_dir ) . $raw_filename;

		if ( ! move_uploaded_file( $file_info['tmp_name'], $raw_path ) ) {
			throw new Exception( 'Failed saving video upload.' );
		}

		$ffmpeg = self::get_ffmpeg_binary();

		// Target WebM file
		$webm_fn    = 'rev_' . $order_id . '_' . $hash_id . '.webm';
		$webm_path  = trailingslashit( $target_dir ) . $webm_fn;
		$final_fn   = $raw_filename;
		$final_path = $raw_path;
		$is_webm    = ( 'webm' === $ext );

		if ( $ffmpeg ) {
			// Convert to WebM (VP9 + Opus) with max dimension 1920 to save substantial space
			$transcode_cmd = escapeshellcmd( $ffmpeg ) . ' -i ' . escapeshellarg( $raw_path ) .
				' -c:v libvpx-vp9 -crf 34 -b:v 0 -deadline good -cpu-used 2 -c:a libopus -b:a 96k -vf "scale=\'min(1920,iw)\':-2" -y ' .
				escapeshellarg( $webm_path ) . ' 2>&1';
			@shell_exec( $transcode_cmd );

			if ( file_exists( $webm_path ) && filesize( $webm_path ) > 0 ) {
				$final_fn   = $webm_fn;
				$final_path = $webm_path;
				$is_webm    = true;
				// Remove raw upload file to save server space
				if ( ! $is_webm || $raw_path !== $webm_path ) {
					@unlink( $raw_path );
				}
			}
		}

		$local_url     = self::get_reviews_upload_url( $cur_ym . '/' . $final_fn );
		$remote_r2_key = "reviews/{$cur_ym}/{$final_fn}";
		$r2_synced     = false;

		// Extract video poster thumbnail at 0.5s into modern WebP format
		$poster_fn   = 'rev_' . $order_id . '_' . $hash_id . '_poster.webp';
		$poster_path = trailingslashit( $target_dir ) . $poster_fn;
		$poster_url  = '';

		if ( $ffmpeg ) {
			$poster_cmd = escapeshellcmd( $ffmpeg ) . ' -ss 00:00:00.5 -i ' . escapeshellarg( $final_path ) . ' -vframes 1 -vf "scale=\'min(1920,iw)\':-2" -q:v 80 -y ' . escapeshellarg( $poster_path ) . ' 2>&1';
			@shell_exec( $poster_cmd );
			if ( file_exists( $poster_path ) && filesize( $poster_path ) > 0 ) {
				$poster_url = self::get_reviews_upload_url( $cur_ym . '/' . $poster_fn );
				if ( class_exists( 'Artmatter_R2' ) && Artmatter_R2::is_configured() ) {
					Artmatter_R2::upload_file( $poster_path, "reviews/{$cur_ym}/{$poster_fn}" );
				}
			}
		}

		// Mirror final video to Cloudflare R2
		if ( class_exists( 'Artmatter_R2' ) && Artmatter_R2::is_configured() ) {
			$r2_synced = Artmatter_R2::upload_file( $final_path, $remote_r2_key );
		}

		return [
			'type'       => 'video',
			'url'        => $local_url,
			'r2_key'     => $remote_r2_key,
			'r2_synced'  => $r2_synced ? 1 : 0,
			'poster_url' => $poster_url ?: 'https://media.artmatter.co/assets/sample-art.jpg',
			'width'      => 1920,
			'height'     => 1080,
		];
	}

	/**
	 * Register REST Routes
	 */
	public static function register_rest_routes() {
		$namespace = 'artmatter-core/v1';

		// 1. List reviews (for Manager & Storefront)
		register_rest_route( $namespace, '/reviews', [
			'methods'             => [ 'GET' ],
			'callback'            => [ __CLASS__, 'api_get_reviews' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 2. Get reviews for a single order
		register_rest_route( $namespace, '/reviews/order/(?P<id>\d+)', [
			'methods'             => [ 'GET' ],
			'callback'            => [ __CLASS__, 'api_get_order_review' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 3. Update review status (approve, feature, reject)
		register_rest_route( $namespace, '/reviews/(?P<id>\d+)/status', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_update_review_status' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 4. Edit review content / rating
		register_rest_route( $namespace, '/reviews/(?P<id>\d+)/edit', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_edit_review' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 5. Delete review
		register_rest_route( $namespace, '/reviews/(?P<id>\d+)/delete', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_delete_review' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 6. Public signed review submission
		register_rest_route( $namespace, '/reviews/submit', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_submit_review' ],
			'permission_callback' => '__return_true',
		] );

		// 7. Manual review invite dispatch
		register_rest_route( $namespace, '/reviews/invite', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_manual_invite' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 8. Admin manual review creation
		register_rest_route( $namespace, '/reviews/create', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_create_review' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 9. Get review coupon reward settings
		register_rest_route( $namespace, '/reviews/reward-settings', [
			'methods'             => [ 'GET' ],
			'callback'            => [ __CLASS__, 'api_get_reward_settings' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 10. Update review coupon reward settings
		register_rest_route( $namespace, '/reviews/reward-settings', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_update_reward_settings' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 11. Direct media upload for customer reviews (photos & videos)
		register_rest_route( $namespace, '/reviews/upload-media', [
			'methods'             => [ 'POST' ],
			'callback'            => [ __CLASS__, 'api_upload_media' ],
			'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
		] );

		// 12. Public order verification for headless /review page
		register_rest_route( $namespace, '/reviews/verify-order', [
			'methods'             => [ 'GET', 'POST' ],
			'callback'            => [ __CLASS__, 'api_verify_order_for_review' ],
			'permission_callback' => '__return_true',
		] );
	}

	/**
	 * REST: Get reviews list with stats and pagination
	 */
	public static function api_get_reviews( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = self::get_table_name();

		$status     = sanitize_text_field( $request->get_param( 'status' ) ?? '' );
		$rating     = (float) ( $request->get_param( 'rating' ) ?? 0 );
		$search     = sanitize_text_field( $request->get_param( 'search' ) ?? '' );
		$with_media = $request->get_param( 'with_media' );
		$product_id = (int) ( $request->get_param( 'product_id' ) ?? 0 );
		$page       = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );
		$per_page   = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?? 20 ) ) );
		$offset     = ( $page - 1 ) * $per_page;

		$where   = [ '1=1' ];
		$params  = [];

		if ( ! empty( $status ) && $status !== 'all' ) {
			if ( $status === 'featured' ) {
				$where[]  = 'status = %s';
				$params[] = 'featured';
			} elseif ( $status === 'with_media' ) {
				$where[]  = "media != '' AND media != '[]' AND status IN ('approved', 'featured')";
			} else {
				$where[]  = 'status = %s';
				$params[] = $status;
			}
		}

		if ( $rating > 0 ) {
			$where[]  = 'rating >= %f';
			$params[] = $rating;
		}

		if ( $product_id > 0 ) {
			$where[]  = 'product_id = %d';
			$params[] = $product_id;
		}

		if ( ! empty( $search ) ) {
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$where[]  = '(order_number LIKE %s OR customer_name LIKE %s OR customer_email LIKE %s OR artwork_title LIKE %s OR title LIKE %s OR content LIKE %s)';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}

		$where_clause = implode( ' AND ', $where );

		// Count total matching
		$count_query = "SELECT COUNT(*) FROM {$table} WHERE {$where_clause}";
		$total       = empty( $params ) ? (int) $wpdb->get_var( $count_query ) : (int) $wpdb->get_var( $wpdb->prepare( $count_query, $params ) );

		// Fetch rows
		$data_query = "SELECT * FROM {$table} WHERE {$where_clause} ORDER BY created_at DESC LIMIT %d OFFSET %d";
		$fetch_params = array_merge( $params, [ $per_page, $offset ] );
		$rows       = $wpdb->get_results( $wpdb->prepare( $data_query, $fetch_params ), ARRAY_A );

		// Calculate overview statistics
		$stats = [
			'total'          => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ),
			'pending'        => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status = 'pending'" ),
			'approved'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status = 'approved'" ),
			'featured'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status = 'featured'" ),
			'with_media'     => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE media != '' AND media != '[]'" ),
			'average_rating' => round( (float) $wpdb->get_var( "SELECT AVG(rating) FROM {$table} WHERE status IN ('approved', 'featured')" ), 2 ) ?: 5.0,
		];

		// Format output
		$formatted = array_map( function( $row ) {
			$media_raw = $row['media'] ?? '[]';
			$media_arr = json_decode( $media_raw, true );
			if ( ! is_array( $media_arr ) ) {
				$media_arr = [];
			}
			$row['rating']            = (float) $row['rating'];
			$row['verified_purchase'] = (bool) $row['verified_purchase'];
			$row['is_anonymous']      = ! empty( $row['is_anonymous'] );
			$row['masked_name']       = self::mask_customer_name( $row['customer_name'] ?? '' );
			$row['media']             = $media_arr;
			return $row;
		}, $rows );

		return new WP_REST_Response( [
			'success'      => true,
			'reviews'      => $formatted,
			'total'        => $total,
			'stats'        => $stats,
			'current_page' => $page,
			'max_pages'    => ceil( $total / $per_page ) ?: 1,
		], 200 );
	}

	/**
	 * REST: Get review for order
	 */
	public static function api_get_order_review( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table    = self::get_table_name();
		$order_id = (int) $request->get_param( 'id' );

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE order_id = %d LIMIT 1", $order_id ), ARRAY_A );
		if ( ! $row ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'No review found for this order' ], 404 );
		}

		$row['rating'] = (int) $row['rating'];
		$row['media']  = json_decode( $row['media'] ?? '[]', true ) ?: [];

		return new WP_REST_Response( [ 'success' => true, 'review' => $row ], 200 );
	}

	/**
	 * REST: Update review status
	 */
	public static function api_update_review_status( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = self::get_table_name();
		$review_id = (int) $request->get_param( 'id' );
		$status    = sanitize_text_field( $request->get_param( 'status' ) ?? 'pending' );

		if ( ! in_array( $status, [ 'pending', 'approved', 'featured', 'rejected' ], true ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid status' ], 400 );
		}

		$updated = $wpdb->update( $table, [ 'status' => $status ], [ 'id' => $review_id ] );
		if ( false === $updated ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Database error updating status' ], 500 );
		}

		// Sync to WooCommerce comments / product ratings
		self::sync_review_to_woocommerce( $review_id );

		return new WP_REST_Response( [
			'success' => true,
			'message' => "Review marked as {$status}",
			'status'  => $status,
		], 200 );
	}

	/**
	 * REST: Edit review
	 */
	public static function api_edit_review( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = self::get_table_name();
		$review_id = (int) $request->get_param( 'id' );

		$title    = sanitize_text_field( $request->get_param( 'title' ) ?? '' );
		$content  = wp_kses_post( $request->get_param( 'content' ) ?? '' );
		$rating   = max( 1.0, min( 5.0, round( (float) ( $request->get_param( 'rating' ) ?? 5.0 ) * 2 ) / 2 ) );
		$name     = sanitize_text_field( $request->get_param( 'customer_name' ) ?? '' );
		$location = sanitize_text_field( $request->get_param( 'customer_location' ) ?? '' );
		$is_anon  = $request->get_param( 'is_anonymous' );

		$data = [
			'title'   => $title,
			'content' => $content,
			'rating'  => $rating,
		];
		if ( ! empty( $name ) ) {
			$data['customer_name'] = $name;
		}
		if ( ! empty( $location ) ) {
			$data['customer_location'] = $location;
		}
		if ( null !== $is_anon ) {
			$data['is_anonymous'] = ! empty( $is_anon ) ? 1 : 0;
		}
		if ( $request->has_param( 'media' ) ) {
			$media_param = $request->get_param( 'media' );
			if ( is_array( $media_param ) ) {
				$data['media'] = wp_json_encode( $media_param );
			} elseif ( is_string( $media_param ) ) {
				$data['media'] = $media_param;
			}
		}

		$wpdb->update( $table, $data, [ 'id' => $review_id ] );
		self::sync_review_to_woocommerce( $review_id );

		return new WP_REST_Response( [ 'success' => true, 'message' => 'Review updated successfully' ], 200 );
	}

	/**
	 * REST: Delete review
	 */
	public static function api_delete_review( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = self::get_table_name();
		$review_id = (int) $request->get_param( 'id' );

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $review_id ), ARRAY_A );
		if ( ! $row ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Review not found' ], 404 );
		}

		// Delete linked WooCommerce comment
		if ( ! empty( $row['wc_comment_id'] ) ) {
			wp_delete_comment( (int) $row['wc_comment_id'], true );
		}

		// Delete review record
		$wpdb->delete( $table, [ 'id' => $review_id ] );

		// Clear order meta flag
		$order = wc_get_order( (int) $row['order_id'] );
		if ( $order ) {
			$order->delete_meta_data( '_artmatter_has_review' );
			$order->save();
		}

		return new WP_REST_Response( [ 'success' => true, 'message' => 'Review deleted' ], 200 );
	}

	/**
	 * REST: Public Review Submission
	 */
	public static function api_submit_review( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = self::get_table_name();

		$order_id_raw = sanitize_text_field( $request->get_param( 'order_id' ) ?? '' );
		$email        = sanitize_email( $request->get_param( 'order_email' ) ?? $request->get_param( 'email' ) ?? '' );
		$key          = sanitize_text_field( $request->get_param( 'key' ) ?? '' );
		$token        = sanitize_text_field( $request->get_param( 'token' ) ?? '' );

		if ( empty( $order_id_raw ) || empty( $email ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Missing order reference' ], 400 );
		}

		// Locate order by ID or order number
		$order = wc_get_order( $order_id_raw );
		if ( ! $order && function_exists( 'wc_get_orders' ) ) {
			$orders = wc_get_orders( [ 'order_number' => $order_id_raw, 'limit' => 1 ] );
			if ( ! empty( $orders ) ) {
				$order = $orders[0];
			}
		}

		if ( ! $order ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Order not found' ], 404 );
		}

		// Validate token or order key
		$order_email = strtolower( trim( $order->get_billing_email() ) );
		$email_match = ( strtolower( trim( $email ) ) === $order_email );
		$key_match   = ( ! empty( $key ) && $order->get_order_key() === $key );
		$token_match = ( ! empty( $token ) && self::verify_review_token( $order->get_id(), $order_email, $token ) );

		if ( ! $email_match || ( ! $key_match && ! $token_match ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Security validation failed' ], 403 );
		}

		// Enforce delivered order status check
		$allowed_statuses = apply_filters( 'artmatter_review_allowed_order_statuses', [ 'completed', 'delivered' ] );
		if ( ! in_array( $order->get_status(), $allowed_statuses, true ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => __( 'Reviews can only be submitted after your order has been delivered.', 'artmatter-core' ),
			], 403 );
		}

		$target_product_id = (int) ( $request->get_param( 'product_id' ) ?? 0 );

		$rating       = max( 1.0, min( 5.0, round( (float) ( $request->get_param( 'rating' ) ?? 5.0 ) * 2 ) / 2 ) );
		$title        = sanitize_text_field( $request->get_param( 'title' ) ?? '' );
		$content      = wp_strip_all_tags( $request->get_param( 'content' ) ?? '' );
		$cust_name    = sanitize_text_field( $request->get_param( 'customer_name' ) ?? '' );
		$location     = sanitize_text_field( $request->get_param( 'customer_location' ) ?? '' );
		$is_anonymous = ! empty( $request->get_param( 'is_anonymous' ) ) ? 1 : 0;

		if ( empty( $cust_name ) ) {
			$cust_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
		}
		if ( empty( $location ) ) {
			$city     = $order->get_billing_city();
			$country  = $order->get_billing_country();
			$location = trim( "{$city}, {$country}", ', ' );
		}

		// Process Media Uploads (Photos & Videos, Max 5 Files)
		$media_list     = [];
		$files          = $request->get_file_params();
		$uploaded_items = [];

		if ( ! empty( $files['media'] ) ) {
			$raw_media = $files['media'];
			if ( is_array( $raw_media['name'] ?? null ) ) {
				foreach ( $raw_media['name'] as $idx => $fname ) {
					if ( ! empty( $fname ) && ! empty( $raw_media['tmp_name'][ $idx ] ) && (int) ( $raw_media['error'][ $idx ] ?? 0 ) === UPLOAD_ERR_OK ) {
						$uploaded_items[] = [
							'name'     => $fname,
							'type'     => $raw_media['type'][ $idx ] ?? '',
							'tmp_name' => $raw_media['tmp_name'][ $idx ],
							'error'    => $raw_media['error'][ $idx ] ?? 0,
							'size'     => $raw_media['size'][ $idx ] ?? 0,
						];
					}
				}
			} elseif ( ! empty( $raw_media['name'] ) && ! empty( $raw_media['tmp_name'] ) && (int) ( $raw_media['error'] ?? 0 ) === UPLOAD_ERR_OK ) {
				$uploaded_items[] = $raw_media;
			}
		}

		// Also check indexed keys media_0 ... media_4
		for ( $i = 0; $i < 5; $i++ ) {
			if ( ! empty( $files["media_{$i}"] ) && ! empty( $files["media_{$i}"]['tmp_name'] ) && (int) ( $files["media_{$i}"]['error'] ?? 0 ) === UPLOAD_ERR_OK ) {
				$tmp_match = false;
				foreach ( $uploaded_items as $ex_item ) {
					if ( ( $ex_item['tmp_name'] ?? '' ) === $files["media_{$i}"]['tmp_name'] ) {
						$tmp_match = true;
						break;
					}
				}
				if ( ! $tmp_match ) {
					$uploaded_items[] = $files["media_{$i}"];
				}
			}
		}

		// Cap to max 5 files
		$uploaded_items = array_slice( $uploaded_items, 0, 5 );

		foreach ( $uploaded_items as $item ) {
			$mime     = strtolower( trim( $item['type'] ?? '' ) );
			$ext      = strtolower( pathinfo( $item['name'] ?? '', PATHINFO_EXTENSION ) );
			$is_video = str_starts_with( $mime, 'video/' ) || in_array( $ext, [ 'mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv' ], true );
			try {
				if ( $is_video ) {
					$media_list[] = self::process_video_upload( $item, $order->get_id() );
				} else {
					$media_list[] = self::process_photo_upload( $item, $order->get_id() );
				}
			} catch ( Exception $e ) {
				// Soft log error but allow remaining files and review text to proceed
			}
		}

		// Collect items in order
		$order_art_items = [];
		foreach ( $order->get_items() as $item ) {
			$prod = $item->get_product();
			if ( ! $prod ) {
				continue;
			}
			$pid = $prod->is_type( 'variation' ) ? (int) $prod->get_parent_id() : (int) $prod->get_id();
			if ( isset( $order_art_items[ $pid ] ) ) {
				continue;
			}

			// Prioritize pre-baked FeelForm tactile flat WebP
			$tactile_url = class_exists( 'Artmatter_Feelform_3D' ) ? Artmatter_Feelform_3D::get_tactile_flat_url( $pid ) : '';
			if ( empty( $tactile_url ) ) {
				$tactile_url = (string) get_post_meta( $pid, '_artmatter_tactile_flat_url', true );
			}
			if ( empty( $tactile_url ) && class_exists( 'Artmatter_Tactile_Generator' ) ) {
				$upload_dir = wp_upload_dir();
				$path_base  = trailingslashit( $upload_dir['basedir'] ) . 'feelform-3d/';
				$url_base   = trailingslashit( $upload_dir['baseurl'] ) . 'feelform-3d/';
				if ( file_exists( $path_base . "art-{$pid}-flat.webp" ) ) {
					$tactile_url = $url_base . "art-{$pid}-flat.webp";
				}
			}

			$img_id  = $prod->get_image_id();
			$wc_img  = $img_id ? ( wp_get_attachment_image_url( $img_id, 'large' ) ?: wp_get_attachment_image_url( $img_id, 'full' ) ) : '';
			if ( empty( $wc_img ) ) {
				$wc_img = $prod->get_meta( '_artwork_image' ) ?: '';
			}
			$img_url = ! empty( $tactile_url ) ? $tactile_url : $wc_img;

			$artist_meta = 'Exacoat';
			$parent_prod = $prod->is_type( 'variation' ) ? wc_get_product( $pid ) : $prod;
			$art_title   = $parent_prod ? $parent_prod->get_name() : $prod->get_name();

			$order_art_items[ $pid ] = [
				'product_id'    => $pid,
				'artwork_id'    => (string) $pid,
				'artwork_title' => $art_title,
				'artwork_image' => $img_url,
				'artist_name'   => (string) $artist_meta,
			];
		}

		if ( empty( $order_art_items ) ) {
			$order_art_items[0] = [
				'product_id'    => 0,
				'artwork_id'    => '0',
				'artwork_title' => sanitize_text_field( $request->get_param( 'artwork_title' ) ?? 'Exacoat Skin' ),
				'artwork_image' => esc_url_raw( $request->get_param( 'artwork_image' ) ?? '' ),
				'artist_name'   => sanitize_text_field( $request->get_param( 'artist_name' ) ?? 'Exacoat' ),
			];
		}

		$selected_item = null;
		if ( $target_product_id > 0 && isset( $order_art_items[ $target_product_id ] ) ) {
			$selected_item = $order_art_items[ $target_product_id ];
		} else {
			// If target_product_id was a variation ID, check if its parent is in order_art_items
			$maybe_var = wc_get_product( $target_product_id );
			if ( $maybe_var && $maybe_var->is_type( 'variation' ) && isset( $order_art_items[ $maybe_var->get_parent_id() ] ) ) {
				$selected_item = $order_art_items[ $maybe_var->get_parent_id() ];
			} else {
				$selected_item = reset( $order_art_items );
			}
		}

		// Duplicate check for specific product in this order (checking both parent pid and child variation IDs)
		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$table} WHERE order_id = %d AND (product_id = %d OR product_id IN (SELECT ID FROM {$wpdb->posts} WHERE post_parent = %d))",
			$order->get_id(),
			$selected_item['product_id'],
			$selected_item['product_id']
		) );
		if ( $existing ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'A review has already been submitted for "' . $selected_item['artwork_title'] . '" in Order #' . $order->get_order_number(),
			], 409 );
		}

		$wpdb->insert( $table, [
			'order_id'          => $order->get_id(),
			'order_number'      => $order->get_order_number(),
			'product_id'        => $selected_item['product_id'],
			'artwork_id'        => $selected_item['artwork_id'],
			'artwork_title'     => $selected_item['artwork_title'],
			'artwork_image'     => $selected_item['artwork_image'],
			'artist_name'       => $selected_item['artist_name'],
			'customer_name'     => $cust_name,
			'customer_email'    => $order_email,
			'customer_location' => $location,
			'is_anonymous'      => $is_anonymous,
			'rating'            => $rating,
			'title'             => $title,
			'content'           => $content,
			'media'             => wp_json_encode( $media_list ),
			'status'            => 'pending',
			'verified_purchase' => 1,
			'created_at'        => current_time( 'mysql' ),
			'updated_at'        => current_time( 'mysql' ),
		] );

		$first_review_id = $wpdb->insert_id;
		if ( ! $first_review_id ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Failed saving review' ], 500 );
		}

		// Mark order meta
		$order->update_meta_data( '_artmatter_has_review', 1 );
		$order->update_meta_data( '_artmatter_review_id', $first_review_id );
		$order->save();

		// Issue reward coupon only if review includes customer photo or video
		$reward_coupon = null;
		if ( ! empty( $media_list ) ) {
			$reward_coupon = self::issue_reward_coupon( $order->get_id(), $order_email );
			if ( $reward_coupon && ! empty( $order_email ) && class_exists( 'Artmatter_Email_Engine' ) ) {
				Artmatter_Email_Engine::send_email(
					'customer_order_review_reward',
					$order_email,
					$cust_name,
					[
						'customer_first_name' => $cust_name,
						'coupon_code'         => $reward_coupon['code'] ?? '',
						'discount_percent'    => (string) ( $reward_coupon['discount_percent'] ?? '20' ),
						'discount_amount'     => ( $reward_coupon['discount_percent'] ?? '20' ) . '%',
						'expiry_date'         => $reward_coupon['expiry_date'] ?? '',
						'artwork_title'       => $selected_item['artwork_title'] ?? 'Precision Device Skin',
						'order_number'        => (string) $order->get_order_number(),
						'shop_url'            => home_url( '/shop/' ),
					]
				);
			}
		}

		// Count remaining unreviewed pieces in this order
		$unreviewed_count = 0;
		foreach ( $order_art_items as $ai ) {
			if ( (int) $ai['product_id'] === (int) $selected_item['product_id'] ) {
				continue;
			}
			$chk = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$table} WHERE order_id = %d AND (product_id = %d OR product_id IN (SELECT ID FROM {$wpdb->posts} WHERE post_parent = %d))",
				$order->get_id(),
				$ai['product_id'],
				$ai['product_id']
			) );
			if ( ! $chk ) {
				$unreviewed_count++;
			}
		}

		// Notify via Pushover if active
		if ( class_exists( 'Artmatter_Pushover_Service' ) ) {
			$media_count = count( $media_list );
			$media_txt   = $media_count > 0 ? " ({$media_count} photo/video)" : '';
			Artmatter_Pushover_Service::send(
				"⭐ New Customer Review: {$cust_name} ({$rating}/5★){$media_txt}\nOrder #{$order->get_order_number()} for \"{$selected_item['artwork_title']}\".",
				'New Customer Review'
			);
		}

		return new WP_REST_Response( [
			'success'          => true,
			'message'          => 'Thank you for your review. It has been safely recorded and will appear after moderation.',
			'review_id'        => $first_review_id,
			'product_id'       => $selected_item['product_id'],
			'unreviewed_count' => $unreviewed_count,
			'reward_coupon'    => $reward_coupon,
		], 200 );
	}

	/**
	 * REST: Verify order credentials and fetch items for headless /review page
	 */
	public static function api_verify_order_for_review( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = self::get_table_name();

		$order_id_param = sanitize_text_field( $request->get_param( 'order_id' ) ?? '' );
		$email_param    = sanitize_email( $request->get_param( 'order_email' ) ?? $request->get_param( 'email' ) ?? '' );
		$key_param      = sanitize_text_field( $request->get_param( 'key' ) ?? '' );
		$token_param    = sanitize_text_field( $request->get_param( 'token' ) ?? '' );

		if ( empty( $order_id_param ) ) {
			return new WP_REST_Response( [
				'success'     => false,
				'is_verified' => false,
				'message'     => 'Missing order number.',
			], 400 );
		}

		$order = wc_get_order( $order_id_param );
		if ( ! $order && function_exists( 'wc_get_orders' ) ) {
			$matched_orders = wc_get_orders( [ 'order_number' => $order_id_param, 'limit' => 1 ] );
			if ( ! empty( $matched_orders ) ) {
				$order = $matched_orders[0];
			}
		}

		if ( ! $order ) {
			return new WP_REST_Response( [
				'success'     => false,
				'is_verified' => false,
				'message'     => 'Order reference not found. Please check your order number.',
			], 404 );
		}

		$order_email = strtolower( trim( $order->get_billing_email() ) );
		$email_clean = strtolower( trim( $email_param ) );
		$email_match = ( ! empty( $email_clean ) && $email_clean === $order_email );
		$key_match   = ( ! empty( $key_param ) && $order->get_order_key() === $key_param );
		$token_match = ( ! empty( $token_param ) && self::verify_review_token( $order->get_id(), $order_email, $token_param ) );

		if ( ! $email_match && ! $key_match && ! $token_match ) {
			return new WP_REST_Response( [
				'success'     => false,
				'is_verified' => false,
				'message'     => 'The provided email or credentials do not match this order.',
			], 403 );
		}

		$status           = $order->get_status();
		$allowed_statuses = apply_filters( 'artmatter_review_allowed_order_statuses', [ 'completed', 'delivered' ] );
		if ( ! in_array( $status, $allowed_statuses, true ) ) {
			return new WP_REST_Response( [
				'success'     => false,
				'is_verified' => false,
				'message'     => 'Reviews can only be submitted after your order has been delivered.',
			], 403 );
		}

		if ( empty( $token_param ) ) {
			$token_param = self::generate_review_token( $order->get_id(), $order_email );
		}
		if ( empty( $key_param ) ) {
			$key_param = $order->get_order_key();
		}

		$order_items   = $order->get_items();
		$artwork_items = [];
		$seen_pids     = [];

		foreach ( $order_items as $item ) {
			$product = $item->get_product();
			if ( ! $product ) {
				continue;
			}
			$pid = $product->is_type( 'variation' ) ? (int) $product->get_parent_id() : (int) $product->get_id();
			if ( in_array( $pid, $seen_pids, true ) ) {
				continue;
			}
			$seen_pids[] = $pid;

			$tactile_url = class_exists( 'Artmatter_Feelform_3D' ) ? Artmatter_Feelform_3D::get_tactile_flat_url( $pid ) : '';
			if ( empty( $tactile_url ) ) {
				$tactile_url = (string) get_post_meta( $pid, '_artmatter_tactile_flat_url', true );
			}
			if ( empty( $tactile_url ) && class_exists( 'Artmatter_Tactile_Generator' ) ) {
				$upload_dir = wp_upload_dir();
				$path_base  = trailingslashit( $upload_dir['basedir'] ) . 'feelform-3d/';
				$url_base   = trailingslashit( $upload_dir['baseurl'] ) . 'feelform-3d/';
				if ( file_exists( $path_base . "art-{$pid}-flat.webp" ) ) {
					$tactile_url = $url_base . "art-{$pid}-flat.webp";
				}
			}

			$img_id  = $product->get_image_id();
			$wc_img  = $img_id ? ( wp_get_attachment_image_url( $img_id, 'large' ) ?: wp_get_attachment_image_url( $img_id, 'full' ) ) : '';
			if ( empty( $wc_img ) ) {
				$wc_img = $product->get_meta( '_artwork_image' ) ?: '';
			}
			$img_url = ! empty( $tactile_url ) ? $tactile_url : $wc_img;

			$artist_meta = 'Exacoat';
			$size_meta   = $product->get_attribute( 'size' );
			if ( empty( $size_meta ) ) {
				$size_meta = $item->get_meta( 'Size' ) ?: $item->get_meta( 'pa_size' ) ?: '';
			}

			$parent_prod = $product->is_type( 'variation' ) ? wc_get_product( $pid ) : $product;
			$art_title   = $parent_prod ? $parent_prod->get_name() : $product->get_name();

			$existing_art_review = $wpdb->get_row( $wpdb->prepare(
				"SELECT id, rating, title, content, media, created_at FROM {$table} WHERE order_id = %d AND (product_id = %d OR product_id IN (SELECT ID FROM {$wpdb->posts} WHERE post_parent = %d)) LIMIT 1",
				$order->get_id(),
				$pid,
				$pid
			), ARRAY_A );

			$artwork_items[] = [
				'product_id'      => $pid,
				'title'           => $art_title,
				'artist'          => (string) $artist_meta,
				'image'           => (string) $img_url,
				'size'            => (string) $size_meta,
				'is_reviewed'     => ! empty( $existing_art_review ),
				'existing_review' => $existing_art_review ? [
					'rating'     => (float) $existing_art_review['rating'],
					'title'      => (string) $existing_art_review['title'],
					'content'    => (string) $existing_art_review['content'],
					'media'      => json_decode( $existing_art_review['media'] ?? '[]', true ) ?: [],
					'created_at' => $existing_art_review['created_at'],
				] : null,
			];
		}

		if ( empty( $artwork_items ) ) {
			$artwork_items[] = [
				'product_id'      => 0,
				'title' => 'Exacoat Skin',
				'artist' => 'Exacoat',
				'image'           => '',
				'size'            => '',
				'is_reviewed'     => false,
				'existing_review' => null,
			];
		}

		$all_reviewed = ( count( array_filter( $artwork_items, fn( $a ) => ! $a['is_reviewed'] ) ) === 0 );
		$prefill_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
		$masked_name  = self::mask_customer_name( $prefill_name );

		$reward_settings = self::get_reward_settings();
		$existing_coupon = null;
		if ( ! empty( $reward_settings['enabled'] ) && ! empty( $reward_settings['discount_percent'] ) ) {
			$has_any_media = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$table} WHERE order_id = %d AND media != '' AND media != '[]' LIMIT 1",
				$order->get_id()
			) );
			if ( $has_any_media ) {
				$existing_coupon = self::issue_reward_coupon( $order->get_id(), $order_email );
			}
		}

		return new WP_REST_Response( [
			'success'         => true,
			'is_verified'     => true,
			'order_id'        => $order->get_id(),
			'order_number'    => $order->get_order_number(),
			'order_email'     => $order_email,
			'token'           => $token_param,
			'key'             => $key_param,
			'customer_name'   => $prefill_name,
			'masked_name'     => $masked_name,
			'artwork_items'   => $artwork_items,
			'all_reviewed'    => $all_reviewed,
			'reward_settings' => [
				'enabled'          => ! empty( $reward_settings['enabled'] ),
				'discount_percent' => (int) ( $reward_settings['discount_percent'] ?? 20 ),
			],
			'reward_coupon'   => $existing_coupon,
		], 200 );
	}

	/**
	 * REST: Admin Manual Review Creation
	 */
	public static function api_create_review( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table = self::get_table_name();

		$art_title = sanitize_text_field( $request->get_param( 'artwork_title' ) ?? '' );
		$content   = wp_kses_post( $request->get_param( 'content' ) ?? '' );
		$cust_name = sanitize_text_field( $request->get_param( 'customer_name' ) ?? '' );

		if ( empty( $art_title ) || empty( $content ) || empty( $cust_name ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Product title, customer name, and review content are required.' ], 400 );
		}

		$order_id_param = (int) ( $request->get_param( 'order_id' ) ?? 0 );
		$product_id     = (int) ( $request->get_param( 'product_id' ) ?? 0 );
		$artwork_id     = sanitize_text_field( $request->get_param( 'artwork_id' ) ?? ( $product_id ? (string) $product_id : '0' ) );
		$order_num      = sanitize_text_field( $request->get_param( 'order_number' ) ?? ( $order_id_param ? (string) $order_id_param : 'MANUAL' ) );
		$artist         = sanitize_text_field( $request->get_param( 'artist_name' ) ?? 'Exacoat' );
		$art_image      = esc_url_raw( $request->get_param( 'artwork_image' ) ?? '' );
		$cust_email     = sanitize_email( $request->get_param( 'customer_email' ) ?? 'support@exacoat.com' );
		$location       = sanitize_text_field( $request->get_param( 'customer_location' ) ?? '' );
		$rating         = max( 1.0, min( 5.0, round( (float) ( $request->get_param( 'rating' ) ?? 5.0 ) * 2 ) / 2 ) );
		$title          = sanitize_text_field( $request->get_param( 'title' ) ?? '' );
		$status         = sanitize_text_field( $request->get_param( 'status' ) ?? 'approved' );
		$verified       = ! empty( $request->get_param( 'verified_purchase' ) ) ? 1 : 0;
		$is_anonymous   = ! empty( $request->get_param( 'is_anonymous' ) ) ? 1 : 0;
		$custom_date    = sanitize_text_field( $request->get_param( 'created_at' ) ?? '' );
		$created_at     = ! empty( $custom_date ) ? gmdate( 'Y-m-d H:i:s', strtotime( $custom_date ) ) : current_time( 'mysql' );

		if ( ! in_array( $status, [ 'pending', 'approved', 'featured', 'rejected' ], true ) ) {
			$status = 'approved';
		}

		$media_param = $request->get_param( 'media' );
		$media_list  = [];
		if ( is_array( $media_param ) ) {
			$media_list = $media_param;
		} elseif ( is_string( $media_param ) && ! empty( $media_param ) ) {
			$decoded = json_decode( $media_param, true );
			if ( is_array( $decoded ) ) {
				$media_list = $decoded;
			} elseif ( filter_var( $media_param, FILTER_VALIDATE_URL ) ) {
				$media_list[] = [
					'type'       => 'photo',
					'url'        => esc_url_raw( $media_param ),
					'poster_url' => esc_url_raw( $media_param ),
					'r2_synced'  => 0,
				];
			}
		}

		$inserted = $wpdb->insert( $table, [
			'order_id'          => $order_id_param,
			'order_number'      => $order_num,
			'product_id'        => $product_id,
			'artwork_id'        => $artwork_id,
			'artwork_title'     => $art_title,
			'artwork_image'     => $art_image,
			'artist_name'       => $artist,
			'customer_name'     => $cust_name,
			'customer_email'    => $cust_email,
			'customer_location' => $location,
			'is_anonymous'      => $is_anonymous,
			'rating'            => $rating,
			'title'             => $title,
			'content'           => $content,
			'media'             => wp_json_encode( $media_list ),
			'status'            => $status,
			'verified_purchase' => $verified,
			'created_at'        => $created_at,
			'updated_at'        => current_time( 'mysql' ),
		] );

		if ( ! $inserted ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Database error creating review' ], 500 );
		}

		$review_id = $wpdb->insert_id;

		if ( in_array( $status, [ 'approved', 'featured' ], true ) ) {
			self::sync_review_to_woocommerce( $review_id );
		}

		return new WP_REST_Response( [
			'success'   => true,
			'message'   => 'Review created successfully.',
			'review_id' => $review_id,
		], 200 );
	}

	/**
	 * REST: Manual invite dispatch
	 */
	public static function api_manual_invite( WP_REST_Request $request ): WP_REST_Response {
		$order_id = (int) $request->get_param( 'order_id' );
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Order not found' ], 404 );
		}

		// Reset invited timestamp so email will dispatch
		$order->delete_meta_data( '_artmatter_review_invited_at' );
		$order->save();

		self::process_review_invitation_job( $order_id );

		return new WP_REST_Response( [ 'success' => true, 'message' => 'Review invitation sent to customer.' ], 200 );
	}

	/**
	 * REST: Direct Media Upload for Reviews (Photos & Videos)
	 */
	public static function api_upload_media( WP_REST_Request $request ): WP_REST_Response {
		ob_start();

		$files     = $request->get_file_params();
		$file_item = ! empty( $files['media'] ) ? $files['media'] : ( ! empty( $files['file'] ) ? $files['file'] : null );

		if ( ! $file_item ) {
			if ( ob_get_length() ) {
				ob_clean();
			}
			return new WP_REST_Response( [ 'success' => false, 'message' => 'No media file received.' ], 400 );
		}

		// Validate PHP upload error code
		if ( isset( $file_item['error'] ) && UPLOAD_ERR_OK !== (int) $file_item['error'] ) {
			if ( ob_get_length() ) {
				ob_clean();
			}
			$err_msg = match ( (int) $file_item['error'] ) {
				UPLOAD_ERR_INI_SIZE   => 'The uploaded file exceeds the server upload_max_filesize limit.',
				UPLOAD_ERR_FORM_SIZE  => 'The uploaded file exceeds the form upload limit.',
				UPLOAD_ERR_PARTIAL    => 'The uploaded file was only partially uploaded.',
				UPLOAD_ERR_NO_FILE    => 'No file was received.',
				UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary upload directory on server.',
				UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.',
				UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload.',
				default               => 'File upload error code: ' . $file_item['error'],
			};
			return new WP_REST_Response( [ 'success' => false, 'message' => $err_msg ], 400 );
		}

		if ( empty( $file_item['tmp_name'] ) || ! file_exists( $file_item['tmp_name'] ) ) {
			if ( ob_get_length() ) {
				ob_clean();
			}
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Uploaded temporary file not found.' ], 400 );
		}

		$order_id = (int) ( $request->get_param( 'order_id' ) ?? 0 );
		$name     = $file_item['name'] ?? '';
		$ext      = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		$mime     = strtolower( trim( $file_item['type'] ?? '' ) );
		$is_video = str_starts_with( $mime, 'video/' ) || in_array( $ext, [ 'mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv' ], true );

		try {
			if ( $is_video ) {
				$media = self::process_video_upload( $file_item, $order_id );
			} else {
				$media = self::process_photo_upload( $file_item, $order_id );
			}

			if ( ob_get_length() ) {
				ob_clean();
			}

			return new WP_REST_Response( [
				'success'    => true,
				'media'      => $media,
				'url'        => $media['url'] ?? '',
				'poster_url' => $media['poster_url'] ?? ( $media['url'] ?? '' ),
				'type'       => $media['type'] ?? ( $is_video ? 'video' : 'photo' ),
			], 200 );
		} catch ( \Throwable $e ) {
			if ( ob_get_length() ) {
				ob_clean();
			}
			return new WP_REST_Response( [ 'success' => false, 'message' => $e->getMessage() ], 400 );
		}
	}

	/**
	 * Get review reward coupon settings
	 */
	public static function get_reward_settings(): array {
		$defaults = [
			'enabled'          => true,
			'discount_percent' => 20,
			'coupon_prefix'    => 'EXACOAT',
			'expiry_days'      => 30,
		];
		$stored = get_option( 'artmatter_review_reward_settings', [] );
		if ( ! is_array( $stored ) ) {
			$stored = [];
		}
		return wp_parse_args( $stored, $defaults );
	}

	/**
	 * Generate or get coupon for review reward
	 */
	public static function issue_reward_coupon( int $order_id, string $customer_email ): ?array {
		$settings = self::get_reward_settings();
		if ( empty( $settings['enabled'] ) ) {
			return null;
		}

		$percent     = max( 5, min( 50, (int) ( $settings['discount_percent'] ?? 20 ) ) );
		$prefix      = sanitize_text_field( $settings['coupon_prefix'] ?? 'EXACOAT' );
		$expiry_days = max( 1, (int) ( $settings['expiry_days'] ?? 30 ) );

		// Generate clean coupon code
		$code = strtoupper( $prefix . $percent . '-' . wp_generate_password( 5, false, false ) );

		if ( class_exists( 'WC_Coupon' ) ) {
			try {
				$coupon = new WC_Coupon();
				$coupon->set_code( $code );
				$coupon->set_discount_type( 'percent' );
				$coupon->set_amount( $percent );
				$coupon->set_individual_use( true );
				$coupon->set_usage_limit( 1 );
				$coupon->set_usage_limit_per_user( 1 );
				if ( ! empty( $customer_email ) ) {
					$coupon->set_email_restrictions( [ strtolower( trim( $customer_email ) ) ] );
				}
				$expiry_timestamp = time() + ( $expiry_days * DAY_IN_SECONDS );
				$coupon->set_date_expires( $expiry_timestamp );
				$coupon->set_description( "Exacoat Perks Promo Code {$percent}% Off (Order #{$order_id}) - Non-stackable" );
				$coupon->save();

				$coupon_id = $coupon->get_id();
				if ( $coupon_id ) {
					update_post_meta( $coupon_id, '_acfw_show_on_my_coupons_page', 'yes' );
					update_post_meta( $coupon_id, '_acfw_coupon_label', "Customer Review Reward ({$percent}% OFF)" );
					update_post_meta( $coupon_id, '_artmatter_review_reward', 1 );
					update_post_meta( $coupon_id, '_artmatter_order_id', $order_id );
				}

				return [
					'code'             => $code,
					'discount_percent' => $percent,
					'expiry_days'      => $expiry_days,
					'expiry_date'      => date_i18n( get_option( 'date_format', 'M j, Y' ), $expiry_timestamp ),
				];
			} catch ( Exception $e ) {
				// Fallback to returned payload
			}
		}

		$expiry_timestamp = time() + ( $expiry_days * DAY_IN_SECONDS );
		return [
			'code'             => $code,
			'discount_percent' => $percent,
			'expiry_days'      => $expiry_days,
			'expiry_date'      => date_i18n( get_option( 'date_format', 'M j, Y' ), $expiry_timestamp ),
		];
	}

	/**
	 * Strictly prevent Exacoat Perks promo codes from being stacked or combined with any other coupon.
	 *
	 * @param bool $is_valid
	 * @param WC_Coupon $coupon
	 * @param WC_Discounts|null $discounts
	 * @return bool
	 * @throws Exception
	 */
	public static function prevent_coupon_stacking( $is_valid, $coupon, $discounts = null ) {
		if ( ! $is_valid || ! is_a( $coupon, 'WC_Coupon' ) ) {
			return $is_valid;
		}

		$coupon_code         = strtoupper( $coupon->get_code() );
		$is_collector_coupon = ( 0 === strpos( $coupon_code, 'EXACOAT' ) ) || $coupon->get_individual_use();

		if ( function_exists( 'WC' ) && WC()->cart ) {
			$applied_coupons = WC()->cart->get_applied_coupons();
			if ( ! empty( $applied_coupons ) ) {
				// 1. If applying a collector promo code while other coupons exist in the cart
				if ( $is_collector_coupon ) {
					foreach ( $applied_coupons as $code ) {
						if ( strtoupper( $code ) !== $coupon_code ) {
							throw new Exception( __( 'Exacoat Perks promo codes cannot be combined with any other coupon or promotional discount.', 'artmatter-core' ), 109 );
						}
					}
				}

				// 2. If another coupon is applied while a collector promo code is already in the cart
				foreach ( $applied_coupons as $code ) {
					$applied_upper = strtoupper( $code );
					if ( ( 0 === strpos( $applied_upper, 'EXACOAT' ) ) && $applied_upper !== $coupon_code ) {
						throw new Exception( __( 'A Exacoat Perks promo code is already active on this order. It cannot be combined with other coupons.', 'artmatter-core' ), 109 );
					}
				}
			}
		}

		return $is_valid;
	}

	/**
	 * REST: Get review reward coupon settings
	 */
	public static function api_get_reward_settings( WP_REST_Request $request ): WP_REST_Response {
		$settings = self::get_reward_settings();
		return new WP_REST_Response( [
			'success'  => true,
			'settings' => $settings,
		], 200 );
	}

	/**
	 * REST: Update review reward coupon settings
	 */
	public static function api_update_reward_settings( WP_REST_Request $request ): WP_REST_Response {
		$enabled          = ! empty( $request->get_param( 'enabled' ) );
		$discount_percent = max( 5, min( 50, (int) ( $request->get_param( 'discount_percent' ) ?? 20 ) ) );
		$coupon_prefix    = sanitize_text_field( $request->get_param( 'coupon_prefix' ) ?? 'EXACOAT' );
		$expiry_days      = max( 1, min( 180, (int) ( $request->get_param( 'expiry_days' ) ?? 30 ) ) );

		$data = [
			'enabled'          => $enabled,
			'discount_percent' => $discount_percent,
			'coupon_prefix'    => $coupon_prefix,
			'expiry_days'      => $expiry_days,
		];

		update_option( 'artmatter_review_reward_settings', $data );

		return new WP_REST_Response( [
			'success'  => true,
			'message'  => 'Reward settings updated successfully',
			'settings' => $data,
		], 200 );
	}

	/**
	 * Sync review to WooCommerce Comments & Aggregate Rating
	 */
	public static function sync_review_to_woocommerce( int $review_id ) {
		global $wpdb;
		$table = self::get_table_name();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $review_id ), ARRAY_A );

		if ( ! $row || empty( $row['product_id'] ) ) {
			return;
		}

		$product_id = (int) $row['product_id'];
		$comment_id = (int) ( $row['wc_comment_id'] ?? 0 );

		if ( in_array( $row['status'], [ 'approved', 'featured' ], true ) ) {
			$commentdata = [
				'comment_post_ID'      => $product_id,
				'comment_author'       => $row['customer_name'],
				'comment_author_email' => $row['customer_email'],
				'comment_content'      => $row['content'],
				'comment_type'         => 'review',
				'comment_approved'     => 1,
				'comment_date'         => $row['created_at'],
			];

			if ( $comment_id > 0 && get_comment( $comment_id ) ) {
				$commentdata['comment_ID'] = $comment_id;
				wp_update_comment( $commentdata );
			} else {
				$new_id = wp_insert_comment( $commentdata );
				if ( ! is_wp_error( $new_id ) && $new_id > 0 ) {
					$wpdb->update( $table, [ 'wc_comment_id' => $new_id ], [ 'id' => $review_id ] );
					$comment_id = $new_id;
				}
			}

			if ( $comment_id > 0 ) {
				update_comment_meta( $comment_id, 'rating', (float) $row['rating'] );
				update_comment_meta( $comment_id, 'verified', 1 );
			}
		} else {
			// Unapproved or rejected: remove comment from public
			if ( $comment_id > 0 && get_comment( $comment_id ) ) {
				wp_delete_comment( $comment_id, true );
				$wpdb->update( $table, [ 'wc_comment_id' => null ], [ 'id' => $review_id ] );
			}
		}

		// Recalculate WC Product Rating
		if ( class_exists( 'WC_Comments' ) ) {
			WC_Comments::clear_transients( $product_id );
		}
	}

	/**
	 * Register front-end scripts and styles
	 */
	public static function register_frontend_assets() {
		$core_url = defined( 'EXACOAT_CORE_URL' ) ? EXACOAT_CORE_URL : ( defined( 'ARTMATTER_CORE_URL' ) ? ARTMATTER_CORE_URL : plugin_dir_url( dirname( __DIR__ ) . '/exacoat-core.php' ) );
		$core_ver = defined( 'EXACOAT_CORE_VERSION' ) ? EXACOAT_CORE_VERSION : ( defined( 'ARTMATTER_CORE_VERSION' ) ? ARTMATTER_CORE_VERSION : '0.0.32' );

		wp_register_style(
			'exacoat-reviews',
			$core_url . 'assets/css/reviews.css',
			[],
			$core_ver
		);
		wp_register_style(
			'artmatter-reviews',
			$core_url . 'assets/css/reviews.css',
			[],
			$core_ver
		);

		wp_register_script(
			'exacoat-reviews',
			$core_url . 'assets/js/reviews.js',
			[ 'jquery' ],
			$core_ver,
			true
		);
		wp_register_script(
			'artmatter-reviews',
			$core_url . 'assets/js/reviews.js',
			[ 'jquery' ],
			$core_ver,
			true
		);

		$reviews_data = [
			'restUrl' => esc_url_raw( rest_url( 'exacoat-core/v1/' ) ),
			'nonce'   => wp_create_nonce( 'wp_rest' ),
		];

		wp_localize_script( 'exacoat-reviews', 'ExacoatReviewsData', $reviews_data );
		wp_localize_script( 'exacoat-reviews', 'ArtmatterReviewsData', $reviews_data );
		wp_localize_script( 'artmatter-reviews', 'ArtmatterReviewsData', $reviews_data );
	}

	/**
	 * Render [artmatter_custom_reviews] Shortcode for Custom Device Skin Reviews
	 */
	public static function render_custom_reviews_shortcode( $atts = [] ): string {
		$atts           = is_array( $atts ) ? $atts : [];
		$atts['custom'] = 'true';
		return self::render_reviews_shortcode( $atts );
	}

	/**
	 * Render [artmatter_reviews] Shortcode
	 */
	public static function render_reviews_shortcode( $atts ): string {
		wp_enqueue_style( 'artmatter-reviews' );
		wp_enqueue_script( 'artmatter-reviews' );

		$atts = shortcode_atts( [
			'layout'        => 'grid', // 'grid', 'slider', 'carousel', 'column', 'list'
			'columns'       => 'auto', // '1', '2', '3', '4', or 'auto'
			'cols'          => '',     // alias for columns
			'limit'         => 8,
			'featured_only' => 'false',
			'with_media'    => 'false',
			'rating'        => 4,
			'custom'        => 'false',
			'type'          => '',
			'product_id'    => 0,
			'arrows'        => 'true',
		], $atts, 'artmatter_reviews' );

		global $wpdb;
		$table = self::get_table_name();

		$is_custom_mode = ( 'true' === strtolower( (string) $atts['custom'] ) || 'custom' === strtolower( (string) $atts['type'] ) );

		$raw_cols = ! empty( $atts['cols'] ) ? $atts['cols'] : $atts['columns'];
		$columns  = in_array( (string) $raw_cols, [ '1', '2', '3', '4' ], true ) ? (string) $raw_cols : 'auto';

		$raw_layout = strtolower( trim( (string) $atts['layout'] ) );
		if ( in_array( $raw_layout, [ 'slider', 'carousel' ], true ) ) {
			$layout_class = 'slider';
		} elseif ( in_array( $raw_layout, [ 'column', 'list' ], true ) || '1' === $columns ) {
			$layout_class = 'column';
		} else {
			$layout_class = 'grid';
		}

		$show_arrows = ( 'false' !== strtolower( (string) $atts['arrows'] ) );
		$is_slider   = ( 'slider' === $layout_class );

		$where   = [ "status IN ('approved', 'featured')" ];
		$params  = [];

		if ( 'true' === strtolower( (string) $atts['featured_only'] ) ) {
			$where[] = "status = 'featured'";
		}
		if ( 'true' === strtolower( (string) $atts['with_media'] ) ) {
			$where[] = "media != '' AND media != '[]'";
		}
		if ( (int) $atts['rating'] > 0 ) {
			$where[]  = 'rating >= %d';
			$params[] = (int) $atts['rating'];
		}
		if ( (int) $atts['product_id'] > 0 ) {
			$where[]  = 'product_id = %d';
			$params[] = (int) $atts['product_id'];
		}

		$limit    = max( 1, (int) $atts['limit'] );
		$params[] = $limit;

		if ( $is_custom_mode ) {
			// Query reviews strictly from custom orders or custom products
			$custom_where   = array_merge( $where, [
				"(artwork_title LIKE '%custom%' OR artwork_title LIKE '%Custom%' OR product_id IN (SELECT ID FROM {$wpdb->posts} WHERE post_name LIKE 'custom-%' OR post_name LIKE 'custom-order-%'))"
			] );
			$custom_sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $custom_where ) . " ORDER BY (status = 'featured') DESC, created_at DESC LIMIT %d";
			$rows       = $wpdb->get_results( $wpdb->prepare( $custom_sql, $params ), ARRAY_A );
		} else {
			$where_sql = implode( ' AND ', $where );
			$sql       = "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY (status = 'featured') DESC, created_at DESC LIMIT %d";
			$rows      = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
		}

		if ( empty( $rows ) ) {
			return '';
		}

		ob_start();
		?>
		<div class="artmatter-reviews-wrapper artmatter-reviews-<?php echo esc_attr( $layout_class ); ?>" data-layout="<?php echo esc_attr( $layout_class ); ?>" data-columns="<?php echo esc_attr( $columns ); ?>">
			<!-- Global Star SVG Gradients for Review Cards -->
			<svg width="0" height="0" class="artmatter-star-defs" aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none;">
				<defs>
					<linearGradient id="artmatter-star-gold" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#fff8db" />
						<stop offset="28%" stop-color="#f5cc77" />
						<stop offset="68%" stop-color="#dda034" />
						<stop offset="100%" stop-color="#a46d13" />
					</linearGradient>
					<linearGradient id="artmatter-star-gold-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#fff2be" />
						<stop offset="100%" stop-color="#805105" />
					</linearGradient>
					<linearGradient id="artmatter-star-gold-half" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stop-color="#fff8db" />
						<stop offset="28%" stop-color="#f5cc77" />
						<stop offset="50%" stop-color="#dda034" />
						<stop offset="50%" stop-color="rgba(255, 255, 255, 0.05)" />
						<stop offset="100%" stop-color="rgba(255, 255, 255, 0.05)" />
					</linearGradient>
				</defs>
			</svg>

			<?php if ( $is_slider && $show_arrows ) : ?>
			<div class="artmatter-reviews-slider-track-wrap">
				<button type="button" class="artmatter-reviews-arrow is-prev" aria-label="Previous reviews">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
				</button>
			<?php endif; ?>

			<div class="artmatter-reviews-container">
				<?php foreach ( $rows as $rev ) : 
					$media_list    = json_decode( $rev['media'] ?? '[]', true ) ?: [];
					$media_items   = $media_list;
					$has_media     = ! empty( $media_items );
					$first_media   = $has_media ? $media_items[0] : null;
					$is_video      = $first_media && ( $first_media['type'] ?? '' ) === 'video';
					$rating_num    = (float) ( $rev['rating'] ?? 5.0 );
					$prod_id       = (int) ( $rev['product_id'] ?? 0 );
					$prod_url      = $prod_id > 0 ? get_permalink( $prod_id ) : '';
					$is_custom_rev = $is_custom_mode || ( stripos( (string) $rev['artwork_title'], 'custom' ) !== false );
				?>
				<div class="artmatter-review-card" data-review-id="<?php echo esc_attr( $rev['id'] ); ?>">
					<?php if ( $has_media && $first_media ) : ?>
					<div class="artmatter-review-media-wrap <?php echo $is_video ? 'is-video' : 'is-photo'; ?>" 
					     data-media-url="<?php echo esc_url( $first_media['url'] ); ?>"
					     data-media-type="<?php echo $is_video ? 'video' : 'photo'; ?>"
					     data-poster="<?php echo esc_url( $first_media['poster_url'] ?? '' ); ?>"
					     data-all-media="<?php echo esc_attr( wp_json_encode( $media_list ) ); ?>">
						<img src="<?php echo esc_url( $first_media['poster_url'] ?: $first_media['url'] ); ?>" 
						     alt="<?php echo esc_attr( $rev['artwork_title'] ); ?>" 
						     loading="lazy" 
						     class="artmatter-review-thumbnail" />
						<?php if ( $is_video ) : ?>
						<div class="artmatter-review-video-badge">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
							<span>Video</span>
						</div>
						<?php else : ?>
						<div class="artmatter-review-photo-badge">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
						</div>
						<?php endif; ?>
						<?php if ( count( $media_list ) > 1 ) : ?>
						<div class="artmatter-review-multi-badge">
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
							<span>+<?php echo ( count( $media_list ) - 1 ); ?></span>
						</div>
						<?php endif; ?>
					</div>
					<?php endif; ?>

					<div class="artmatter-review-content-wrap">
						<!-- Top Row: Star Rating on Left, Verified Collector Icon on Far Right -->
						<div class="artmatter-review-top-row">
							<div class="artmatter-review-stars" title="<?php echo esc_attr( number_format( $rating_num, 1 ) . ' / 5.0' ); ?>">
								<?php
								for ( $i = 1; $i <= 5; $i++ ) {
									if ( $i <= floor( $rating_num ) ) {
										$fill   = 'url(#artmatter-star-gold)';
										$stroke = 'url(#artmatter-star-gold-stroke)';
										$cls    = 'is-filled';
									} elseif ( ( $i - 0.5 ) <= $rating_num ) {
										$fill   = 'url(#artmatter-star-gold-half)';
										$stroke = 'url(#artmatter-star-gold-stroke)';
										$cls    = 'is-half';
									} else {
										$fill   = 'rgba(255, 255, 255, 0.05)';
										$stroke = '#3f3f46';
										$cls    = 'is-empty';
									}
									?>
									<svg class="artmatter-star <?php echo $cls; ?>" width="17" height="17" viewBox="0 0 24 24">
										<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="<?php echo $fill; ?>" stroke="<?php echo $stroke; ?>" stroke-width="0.8"/>
									</svg>
									<?php
								}
								?>
							</div>

							<?php if ( ! empty( $rev['verified_purchase'] ) ) : ?>
							<div class="artmatter-verified-collector-icon-badge" title="Verified Collector" aria-label="Verified Collector">
								<svg class="artmatter-verified-shield-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
									<polyline points="9 12 11 14 15 10"/>
								</svg>
								<span class="artmatter-verified-tooltip">Verified Collector</span>
							</div>
							<?php endif; ?>
						</div>

						<?php if ( ! empty( $rev['title'] ) ) : ?>
						<h4 class="artmatter-review-title"><?php echo esc_html( $rev['title'] ); ?></h4>
						<?php endif; ?>

						<p class="artmatter-review-quote">
							<?php echo esc_html( $rev['content'] ); ?>
						</p>

						<!-- Collector Byline: Name on left, Country on right, Collector piece tightly below -->
						<div class="artmatter-review-author-meta">
							<div class="artmatter-review-author-row">
								<span class="artmatter-review-author-name">
									<?php 
									$display_author = ! empty( $rev['is_anonymous'] ) 
										? self::mask_customer_name( $rev['customer_name'] ) 
										: $rev['customer_name'];
									echo esc_html( $display_author ); 
									?>
								</span>
								<?php if ( ! empty( $rev['customer_location'] ) ) : ?>
								<span class="artmatter-review-author-location"><?php echo esc_html( $rev['customer_location'] ); ?></span>
								<?php endif; ?>
							</div>
							<div class="artmatter-review-artwork-link">
								Collector piece: 
								<?php if ( $is_custom_rev ) : ?>
									<a href="<?php echo esc_url( home_url( '/posters/custom' ) ); ?>" class="artmatter-review-artwork-anchor" title="Custom design">Custom design</a>
								<?php elseif ( ! empty( $prod_url ) ) : ?>
									<a href="<?php echo esc_url( $prod_url ); ?>" class="artmatter-review-artwork-anchor" title="<?php echo esc_attr( $rev['artwork_title'] ); ?>"><?php echo esc_html( $rev['artwork_title'] ); ?></a>
								<?php elseif ( ! empty( $rev['artwork_title'] ) ) : ?>
									<span><?php echo esc_html( $rev['artwork_title'] ); ?></span>
								<?php else : ?>
									<span class="artmatter-review-artwork-anchor">Custom design</span>
								<?php endif; ?>
							</div>
						</div>
					</div>
				</div>
				<?php endforeach; ?>
			</div>

			<?php if ( $is_slider && $show_arrows ) : ?>
				<button type="button" class="artmatter-reviews-arrow is-next" aria-label="Next reviews">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
				</button>
			</div>
			<?php endif; ?>
		</div>

		<!-- Museum Lightbox & Video Modal (Multi-Media Support) -->
		<div id="artmatter-review-lightbox-modal" class="artmatter-review-modal" style="display: none;">
			<div class="artmatter-review-modal-backdrop"></div>
			<div class="artmatter-review-modal-dialog">
				<button type="button" class="artmatter-review-modal-close" aria-label="Close modal">&times;</button>
				<button type="button" class="artmatter-lightbox-arrow is-prev" id="artmatter-lightbox-prev" aria-label="Previous media" style="display: none;">&lsaquo;</button>
				<button type="button" class="artmatter-lightbox-arrow is-next" id="artmatter-lightbox-next" aria-label="Next media" style="display: none;">&rsaquo;</button>
				<div class="artmatter-review-modal-body"></div>
				<div class="artmatter-lightbox-counter" id="artmatter-lightbox-counter" style="display: none;"></div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Render [artmatter_product_reviews] Shortcode
	 */
	public static function render_product_reviews_shortcode( $atts ): string {
		global $product;
		$prod_id = $product ? $product->get_id() : get_the_ID();

		$atts = shortcode_atts( [
			'product_id' => $prod_id,
			'limit'      => 6,
		], $atts, 'artmatter_product_reviews' );

		return self::render_reviews_shortcode( [
			'layout'     => 'grid',
			'limit'      => (int) $atts['limit'],
			'product_id' => (int) $atts['product_id'],
		] );
	}

	/**
	 * Render [artmatter_order_review] Shortcode (Zero-Login Public Submission Form)
	 * Restricted exclusively to verified owners with order verification.
	 */
	public static function render_review_submission_shortcode(): string {
		wp_enqueue_style( 'artmatter-reviews' );
		wp_enqueue_script( 'artmatter-reviews' );

		global $wpdb;
		$table = self::get_table_name();

		$order_id_param = sanitize_text_field( $_GET['order_id'] ?? $_POST['order_id'] ?? '' );
		$email_param    = sanitize_email( $_GET['order_email'] ?? $_POST['order_email'] ?? '' );
		$key_param      = sanitize_text_field( $_GET['key'] ?? '' );
		$token_param    = sanitize_text_field( $_GET['token'] ?? '' );

		$order              = null;
		$is_verified        = false;
		$verification_error = '';

		// Locate order by ID or order number
		if ( ! empty( $order_id_param ) ) {
			$order = wc_get_order( $order_id_param );
			if ( ! $order && function_exists( 'wc_get_orders' ) ) {
				$matched_orders = wc_get_orders( [ 'order_number' => $order_id_param, 'limit' => 1 ] );
				if ( ! empty( $matched_orders ) ) {
					$order = $matched_orders[0];
				}
			}
		}

		// Verify order ownership
		if ( $order ) {
			$order_email = strtolower( trim( $order->get_billing_email() ) );
			$email_clean = strtolower( trim( $email_param ) );
			$email_match = ( ! empty( $email_clean ) && $email_clean === $order_email );

			$key_match   = ( ! empty( $key_param ) && $order->get_order_key() === $key_param );
			$token_match = ( ! empty( $token_param ) && self::verify_review_token( $order->get_id(), $order_email, $token_param ) );

			$current_user_id = get_current_user_id();
			$is_order_user   = ( $current_user_id > 0 && (int) $order->get_user_id() === $current_user_id );

			if ( $email_match || $token_match || $key_match || $is_order_user ) {
				$status           = $order->get_status();
				$allowed_statuses = apply_filters( 'artmatter_review_allowed_order_statuses', [ 'completed', 'delivered' ] );
				if ( ! in_array( $status, $allowed_statuses, true ) ) {
					$verification_error = __( 'Reviews can only be submitted after your order has been delivered.', 'artmatter-core' );
				} else {
					$is_verified = true;
					if ( empty( $token_param ) ) {
						$token_param = self::generate_review_token( $order->get_id(), $order_email );
					}
					if ( empty( $key_param ) ) {
						$key_param = $order->get_order_key();
					}
					if ( empty( $email_param ) ) {
						$email_param = $order_email;
					}
				}
			} else {
				$verification_error = __( 'The provided email or credentials do not match this order.', 'artmatter-core' );
			}
		} elseif ( ! empty( $order_id_param ) ) {
			$verification_error = __( 'Order reference not found. Please check your order number.', 'artmatter-core' );
		}

		// Check if this verified order already submitted a review
		$existing_review = null;
		if ( $is_verified && $order ) {
			$existing_review = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE order_id = %d LIMIT 1", $order->get_id() ), ARRAY_A );
		}

		ob_start();
		?>
		<div class="artmatter-review-form-container">

			<?php if ( $is_verified && $existing_review ) : ?>
				<!-- Already Reviewed State -->
				<div class="artmatter-review-form-card artmatter-review-completed-card">
					<div class="artmatter-review-gate-icon">
						<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="1.8">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
							<polyline points="22 4 12 14.01 9 11.01"/>
						</svg>
					</div>
					<span class="artmatter-badge-pill">Review Recorded</span>
					<h2 class="artmatter-form-heading">Thank you for your feedback</h2>
					<p class="artmatter-form-subheading">Your collector review for Order #<?php echo esc_html( $order->get_order_number() ); ?> has been safely recorded. Your impressions assist fellow collectors worldwide.</p>

					<div class="artmatter-recorded-review-box">
						<div class="artmatter-review-stars" style="justify-content: center; margin-bottom: 8px;">
							<?php for ( $s = 1; $s <= 5; $s++ ) : ?>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="<?php echo $s <= (int) $existing_review['rating'] ? '#fbbf24' : 'none'; ?>" stroke="<?php echo $s <= (int) $existing_review['rating'] ? '#fbbf24' : '#52525b'; ?>" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
							<?php endfor; ?>
						</div>
						<?php if ( ! empty( $existing_review['title'] ) ) : ?>
							<h4 class="artmatter-recorded-title"><?php echo esc_html( $existing_review['title'] ); ?></h4>
						<?php endif; ?>
						<p class="artmatter-recorded-quote">"<?php echo esc_html( $existing_review['content'] ); ?>"</p>
						<span class="artmatter-recorded-by">
							Customer <?php echo esc_html( ! empty( $existing_review['is_anonymous'] ) ? self::mask_customer_name( $existing_review['customer_name'] ) : $existing_review['customer_name'] ); ?>
						</span>
					</div>

					<div class="artmatter-form-actions" style="margin-top: 24px;">
						<a href="<?php echo esc_url( home_url( '/shop' ) ); ?>" class="artmatter-btn-primary" style="text-decoration: none;">
							<span>Explore Products</span>
						</a>
					</div>
				</div>

			<?php elseif ( ! $is_verified ) : ?>
				<!-- Restricted Gate: Verified Purchase Only -->
				<div class="artmatter-review-form-card artmatter-review-gate-card">
					<span class="artmatter-badge-pill">Verified Purchase Access</span>
					<h2 class="artmatter-form-heading">Customer Reviews Are Reserved for Verified Purchases</h2>
					<p class="artmatter-form-subheading">
						Every review on Exacoat is from a verified customer with the skin installed on their device.
						To share your thoughts, verify your purchase below or access your private review link from your delivery notification email.
					</p>

					<form method="GET" action="" class="artmatter-lookup-form">
						<div class="artmatter-form-group">
							<label class="artmatter-label" for="lookup_order_id">Order Number</label>
							<input type="text" id="lookup_order_id" name="order_id" class="artmatter-input" placeholder="123456" value="<?php echo esc_attr( $order_id_param ); ?>" required />
						</div>
						<div class="artmatter-form-group">
							<label class="artmatter-label" for="lookup_email">Billing Email</label>
							<input type="email" id="lookup_email" name="order_email" class="artmatter-input" placeholder="collector@example.com" value="<?php echo esc_attr( $email_param ); ?>" required />
						</div>
						<div class="artmatter-form-actions">
							<button type="submit" class="artmatter-btn-primary">
								<span>Verify Purchase</span>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
							</button>
						</div>
					</form>

					<?php if ( ! empty( $verification_error ) ) : ?>
						<div class="artmatter-form-feedback is-error" style="display: block; margin-top: 16px;">
							<?php echo esc_html( $verification_error ); ?>
						</div>
					<?php endif; ?>
				</div>

			<?php else : ?>
				<!-- Verified Submission Form -->
				<?php
				$order_items   = $order->get_items();
				$artwork_items = [];
				$seen_pids     = [];
				foreach ( $order_items as $item ) {
					$product = $item->get_product();
					if ( ! $product ) {
						continue;
					}
					// If variation, resolve to parent product so duplicate variations merge into 1 product review
					$pid = $product->is_type( 'variation' ) ? (int) $product->get_parent_id() : (int) $product->get_id();
					if ( in_array( $pid, $seen_pids, true ) ) {
						continue;
					}
					$seen_pids[] = $pid;

					// Prioritize FeelForm pre-baked tactile flat WebP
					$tactile_url = class_exists( 'Artmatter_Feelform_3D' ) ? Artmatter_Feelform_3D::get_tactile_flat_url( $pid ) : '';
					if ( empty( $tactile_url ) ) {
						$tactile_url = (string) get_post_meta( $pid, '_artmatter_tactile_flat_url', true );
					}
					if ( empty( $tactile_url ) && class_exists( 'Artmatter_Tactile_Generator' ) ) {
						$upload_dir = wp_upload_dir();
						$path_base  = trailingslashit( $upload_dir['basedir'] ) . 'feelform-3d/';
						$url_base   = trailingslashit( $upload_dir['baseurl'] ) . 'feelform-3d/';
						if ( file_exists( $path_base . "art-{$pid}-flat.webp" ) ) {
							$tactile_url = $url_base . "art-{$pid}-flat.webp";
						}
					}

					$img_id  = $product->get_image_id();
					$wc_img  = $img_id ? ( wp_get_attachment_image_url( $img_id, 'large' ) ?: wp_get_attachment_image_url( $img_id, 'full' ) ) : '';
					if ( empty( $wc_img ) ) {
						$wc_img = $product->get_meta( '_artwork_image' ) ?: '';
					}
					$img_url = ! empty( $tactile_url ) ? $tactile_url : $wc_img;

					$artist_meta = 'Exacoat';
					$size_meta   = $product->get_attribute( 'size' );
					if ( empty( $size_meta ) ) {
						$size_meta = $item->get_meta( 'Size' ) ?: $item->get_meta( 'pa_size' ) ?: '';
					}

					$parent_prod = $product->is_type( 'variation' ) ? wc_get_product( $pid ) : $product;
					$art_title   = $parent_prod ? $parent_prod->get_name() : $product->get_name();

					// Check if this item was reviewed in this order (checking both pid and child variation IDs)
					$is_reviewed = (bool) $wpdb->get_var( $wpdb->prepare(
						"SELECT id FROM {$table} WHERE order_id = %d AND (product_id = %d OR product_id IN (SELECT ID FROM {$wpdb->posts} WHERE post_parent = %d))",
						$order->get_id(),
						$pid,
						$pid
					) );

					$artwork_items[] = [
						'product_id'  => $pid,
						'title'       => $art_title,
						'artist'      => (string) $artist_meta,
						'image'       => (string) $img_url,
						'size'        => (string) $size_meta,
						'is_reviewed' => $is_reviewed,
					];
				}

				if ( empty( $artwork_items ) ) {
					$artwork_items[] = [
						'product_id'  => 0,
						'title' => 'Exacoat Skin',
						'artist' => 'Exacoat',
						'image'       => '',
						'size'        => '',
						'is_reviewed' => false,
					];
				}

				$all_reviewed = ( count( array_filter( $artwork_items, fn( $a ) => ! $a['is_reviewed'] ) ) === 0 );

				$active_idx = 0;
				foreach ( $artwork_items as $idx => $art ) {
					if ( ! $art['is_reviewed'] ) {
						$active_idx = $idx;
						break;
					}
				}
				$active_art   = $artwork_items[ $active_idx ];
				$prefill_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
				?>

				<?php if ( $all_reviewed ) : ?>
					<!-- All Items In Order Reviewed State -->
					<div class="artmatter-review-form-card artmatter-review-completed-card">
						<div class="artmatter-review-gate-icon">
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
						</div>
						<div class="artmatter-form-eyebrow">ORDER #<?php echo esc_html( $order->get_order_number() ); ?></div>
						<h2 class="artmatter-form-heading" style="margin-bottom: 12px;">All Reviews Completed</h2>
						<p class="artmatter-form-subheading" style="margin-bottom: 24px;">Thank you for sharing your thoughts for every piece in your purchase.</p>
						<?php
						$reward_settings = self::get_reward_settings();
						if ( ! empty( $reward_settings['enabled'] ) && ! empty( $reward_settings['discount_percent'] ) ) :
							$has_any_media = $wpdb->get_var( $wpdb->prepare(
								"SELECT id FROM {$table} WHERE order_id = %d AND media != '' AND media != '[]' LIMIT 1",
								$order->get_id()
							) );
							if ( $has_any_media ) :
								$existing_coupon = self::issue_reward_coupon( $order->get_id(), $order->get_billing_email() );
								if ( $existing_coupon ) :
						?>
						<div class="artmatter-reward-coupon-box" style="margin-top: 0;">
							<div class="artmatter-reward-coupon-header">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="8" width="18" height="4" rx="1"/>
									<path d="M12 8v13"/>
									<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
									<path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
								</svg>
								<span>Exacoat Perks: <?php echo (int) $existing_coupon['discount_percent']; ?>% Off Next Purchase</span>
							</div>
							<p class="artmatter-reward-coupon-desc">As a thank you for sharing your review, enjoy <?php echo (int) $existing_coupon['discount_percent']; ?>% off your next purchase with your promo code:</p>
							<div class="artmatter-coupon-code-row">
								<code class="artmatter-coupon-code" id="artmatter-coupon-display"><?php echo esc_html( $existing_coupon['code'] ); ?></code>
								<button type="button" class="artmatter-btn-copy-coupon" data-code="<?php echo esc_attr( $existing_coupon['code'] ); ?>">
									<span>Copy Code</span>
								</button>
							</div>
							<p class="artmatter-reward-expiry">Single-use promo code &bull; Valid until <?php echo esc_html( $existing_coupon['expiry_date'] ); ?></p>
						</div>
						<?php
								endif;
							endif;
						endif;
						?>
					</div>
				<?php else : ?>
					<div class="artmatter-review-form-card">
						<div class="artmatter-review-form-header">
							<div class="artmatter-form-eyebrow">EXACOAT REVIEW</div>
							<h2 class="artmatter-form-heading">How does your new skin feel on your device?</h2>
						</div>

						<?php
						$reward_settings = self::get_reward_settings();
						if ( ! empty( $reward_settings['enabled'] ) && ! empty( $reward_settings['discount_percent'] ) ) :
						?>
						<div class="artmatter-reward-incentive-notice">
							<div class="artmatter-reward-incentive-icon">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="8" width="18" height="4" rx="1"/>
									<path d="M12 8v13"/>
									<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
									<path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
								</svg>
							</div>
							<div class="artmatter-reward-incentive-content">
								<span class="artmatter-reward-incentive-badge">EXACOAT PERKS</span>
								<p class="artmatter-reward-incentive-text">Submit your review with a photo or video to receive <strong><?php echo (int) $reward_settings['discount_percent']; ?>% off</strong> your next purchase.</p>
							</div>
						</div>
						<?php endif; ?>

						<form id="artmatter-collector-review-form" class="artmatter-review-form" enctype="multipart/form-data">
							<input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>" />
							<input type="hidden" name="order_email" value="<?php echo esc_attr( $email_param ); ?>" />
							<input type="hidden" name="key" value="<?php echo esc_attr( $key_param ); ?>" />
							<input type="hidden" name="token" value="<?php echo esc_attr( $token_param ); ?>" />
							<input type="hidden" name="product_id" id="artmatter-form-product-id" value="<?php echo esc_attr( $active_art['product_id'] ); ?>" />
							<input type="hidden" name="artwork_title" id="artmatter-form-artwork-title" value="<?php echo esc_attr( $active_art['title'] ); ?>" />
							<input type="hidden" name="artist_name" id="artmatter-form-artist-name" value="<?php echo esc_attr( $active_art['artist'] ); ?>" />
							<input type="hidden" name="artwork_image" id="artmatter-form-artwork-image" value="<?php echo esc_attr( $active_art['image'] ); ?>" />

							<div class="artmatter-review-split-layout">
								<!-- Left Column: Item Showcase & Overall Rating -->
								<div class="artmatter-review-col-artwork">
									<div class="artmatter-artwork-showcase" id="artmatter-artwork-showcase">
										<?php if ( count( $artwork_items ) > 1 ) : ?>
											<!-- Multi-Piece Purchase Carousel Navigation (Inside Showcase Card) -->
											<div class="artmatter-carousel-nav" id="artmatter-carousel-nav">
												<button type="button" class="artmatter-carousel-arrow is-prev" id="artmatter-carousel-prev" aria-label="Previous item">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
												</button>
												<div class="artmatter-carousel-pills" id="artmatter-carousel-pills">
													<?php foreach ( $artwork_items as $idx => $art_item ) : ?>
														<button
															type="button"
															class="artmatter-carousel-pill <?php echo $idx === $active_idx ? 'is-active' : ''; ?> <?php echo $art_item['is_reviewed'] ? 'is-reviewed' : ''; ?>"
															data-idx="<?php echo $idx; ?>"
															title="<?php echo esc_attr( $art_item['title'] ); ?>"
														>
															<span class="artmatter-pill-label">Piece <?php echo $idx + 1; ?></span>
															<?php if ( $art_item['is_reviewed'] ) : ?>
																<span class="artmatter-pill-check">&check;</span>
															<?php endif; ?>
														</button>
													<?php endforeach; ?>
												</div>
												<button type="button" class="artmatter-carousel-arrow is-next" id="artmatter-carousel-next" aria-label="Next item">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
												</button>
											</div>
											<div class="artmatter-carousel-counter-row" id="artmatter-carousel-counter-row">
												<span>Item <strong id="artmatter-carousel-curr"><?php echo $active_idx + 1; ?></strong> of <strong><?php echo count( $artwork_items ); ?></strong></span>
											</div>
										<?php endif; ?>

										<!-- Product Showcase Stage -->
										<div class="artmatter-artwork-stage">
											<div class="artmatter-artwork-frame">
												<?php if ( ! empty( $active_art['image'] ) ) : ?>
													<img src="<?php echo esc_url( $active_art['image'] ); ?>" alt="<?php echo esc_attr( $active_art['title'] ); ?>" class="artmatter-artwork-main-img" id="artmatter-active-art-img" onload="this.parentElement.classList.add('is-loaded')" />
												<?php else : ?>
													<div class="artmatter-artwork-empty-thumb" id="artmatter-active-art-img">
														<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
													</div>
												<?php endif; ?>
											</div>
										</div>
										<div class="artmatter-artwork-details">
											<div class="artmatter-review-badge-row">
												<span class="artmatter-verified-collector-pill">
													<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
													Verified Purchase &bull; Order #<?php echo esc_html( $order->get_order_number() ); ?>
												</span>
												<span class="artmatter-reviewed-pill" id="artmatter-active-reviewed-pill" style="<?php echo $active_art['is_reviewed'] ? '' : 'display:none;'; ?>">
													Reviewed &check;
												</span>
											</div>
											<h3 class="artmatter-review-artwork-title" id="artmatter-active-art-title"><?php echo esc_html( $active_art['title'] ); ?></h3>
											<p class="artmatter-review-artwork-artist">
												Exacoat Precision Skin
											</p>
											<?php if ( ! empty( $active_art['size'] ) ) : ?>
												<span class="artmatter-review-artwork-spec" id="artmatter-active-art-size"><?php echo esc_html( $active_art['size'] ); ?></span>
											<?php endif; ?>
										</div>

										<!-- Overall Rating Widget -->
										<div class="artmatter-form-group artmatter-rating-group-showcase">
											<label class="artmatter-label artmatter-label-centered">Overall Rating</label>
											<div class="artmatter-rating-widget-showcase">
												<svg width="0" height="0" class="artmatter-star-defs" aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden;">
													<defs>
														<linearGradient id="artmatter-star-gold" x1="0%" y1="0%" x2="100%" y2="100%">
															<stop offset="0%" stop-color="#fff8db" />
															<stop offset="28%" stop-color="#f5cc77" />
															<stop offset="68%" stop-color="#dda034" />
															<stop offset="100%" stop-color="#a46d13" />
														</linearGradient>
														<linearGradient id="artmatter-star-gold-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
															<stop offset="0%" stop-color="#fff2be" />
															<stop offset="100%" stop-color="#805105" />
														</linearGradient>
														<linearGradient id="artmatter-star-gold-half" x1="0%" y1="0%" x2="100%" y2="0%">
															<stop offset="0%" stop-color="#fff8db" />
															<stop offset="28%" stop-color="#f5cc77" />
															<stop offset="50%" stop-color="#dda034" />
															<stop offset="50%" stop-color="rgba(255, 255, 255, 0.05)" />
															<stop offset="100%" stop-color="rgba(255, 255, 255, 0.05)" />
														</linearGradient>
													</defs>
												</svg>
												<div class="artmatter-star-selector-large" id="artmatter-star-input">
													<?php for ( $i = 1; $i <= 5; $i++ ) : ?>
													<button type="button" class="artmatter-star-btn-large is-active" data-val="<?php echo $i; ?>" aria-label="<?php echo $i; ?> Stars">
														<svg width="36" height="36" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#artmatter-star-gold)" stroke="url(#artmatter-star-gold-stroke)" stroke-width="0.8"/></svg>
													</button>
													<?php endfor; ?>
												</div>
												<div class="artmatter-rating-label-centered" id="artmatter-rating-label">5.0 • Exceptional</div>
											</div>
											<input type="hidden" name="rating" id="artmatter-rating-val" value="5" />
										</div>
									</div>

									<!-- Embedded Order Pieces JSON for Carousel Controller -->
									<script type="application/json" id="artmatter-order-pieces-data"><?php echo wp_json_encode( $artwork_items ); ?></script>
								</div>

								<!-- Right Column: Review, Upload, Name & Submit -->
								<div class="artmatter-review-col-form">
									<!-- Review Commentary -->
									<div class="artmatter-form-group">
										<label class="artmatter-label" for="review_content">Your Review</label>
										<textarea id="review_content" name="content" class="artmatter-textarea" rows="4" placeholder="How does your skin look and fit on your device?" required></textarea>
									</div>

									<!-- Media Upload Dropzone Supporting Multiple Photos (JPG, PNG, WebP, HEIC) & Videos (Max 5) -->
									<div class="artmatter-form-group">
										<label class="artmatter-label" for="review_media">Photos & Videos of Your Device</label>
										<div class="artmatter-media-dropzone" id="artmatter-media-dropzone">
											<input type="file" id="review_media" name="media[]" accept="image/*,image/heic,image/heif,.heic,.heif,video/mp4,video/quicktime,video/webm,video/*" class="artmatter-file-input" multiple />
											<div class="artmatter-dropzone-content">
												<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
												<p class="artmatter-dropzone-text">Tap or drag photos or videos of your installed skin</p>
												<span class="artmatter-dropzone-sub">Photos (JPG, PNG, WebP, HEIC) or Videos up to 100MB</span>
												<span class="artmatter-dropzone-perk-hint">Photo or video qualifies for Exacoat Perks</span>
											</div>
											<div class="artmatter-media-preview" id="artmatter-media-preview" style="display: none;"></div>
										</div>
									</div>

									<!-- Collector Display Name -->
									<div class="artmatter-form-group">
										<label class="artmatter-label" for="customer_name">Your Name</label>
										<input type="text" id="customer_name" name="customer_name" class="artmatter-input" value="<?php echo esc_attr( $prefill_name ); ?>" placeholder="e.g. Eleanor Vance" />
									</div>

									<!-- Public Name Redaction Option -->
									<div class="artmatter-form-group" style="margin-bottom: 24px;">
										<label class="artmatter-checkbox-card" for="is_anonymous">
											<input type="checkbox" id="is_anonymous" name="is_anonymous" value="1" style="accent-color: #f3aa18; width: 15px; height: 15px; border-radius: 4px;" />
											<span style="font-size: 12px; color: #a1a1aa;">Hide my full name publicly (display as <strong id="artmatter-redacted-preview" style="color: #ffffff; font-family: monospace; font-weight: 500;"><?php echo esc_html( self::mask_customer_name( $prefill_name ) ); ?></strong>)</span>
										</label>
									</div>

									<!-- Submit Button -->
									<div class="artmatter-form-actions">
										<button type="submit" id="artmatter-submit-review-btn" class="artmatter-btn-primary">
											<span>Submit Review</span>
											<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
										</button>
									</div>

									<div id="artmatter-review-feedback" class="artmatter-form-feedback" style="display: none;"></div>
								</div>
							</div>
						</form>
					</div>
				<?php endif; ?>
		<?php endif; ?>

			<!-- Exacoat Perks Photo/Video Requirement Prompt Modal -->
			<div id="artmatter-perk-modal" class="artmatter-review-modal" style="display: none;">
				<div class="artmatter-review-modal-backdrop"></div>
				<div class="artmatter-review-modal-content artmatter-perk-modal-content">
					<button type="button" class="artmatter-review-modal-close" id="artmatter-perk-modal-close" aria-label="Close dialog">&times;</button>
					<div class="artmatter-perk-modal-badge">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="8" width="18" height="4" rx="1"/>
							<path d="M12 8v13"/>
							<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
							<path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
						</svg>
					</div>
					<h3 class="artmatter-perk-modal-title">Claim 20% Off Your Next Piece</h3>
					<p class="artmatter-perk-modal-desc">
						Exacoat Perks are reserved for reviews with a photo or video of the skin installed on your device.
					</p>
					<p class="artmatter-perk-modal-sub">
						Add a photo or video now to receive your promo code upon submission.
					</p>
					<div class="artmatter-perk-modal-actions">
						<button type="button" class="artmatter-btn-primary" id="artmatter-perk-add-photo-btn">
							<span>Add Photo or Video</span>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
						</button>
						<button type="button" class="artmatter-perk-btn-skip" id="artmatter-perk-skip-btn">
							<span>I don't need the perks</span>
						</button>
					</div>
				</div>
			</div>

		</div>
		<?php
		return ob_get_clean();
	}
}

}

if ( ! class_exists( 'Artmatter_Review_Manager' ) ) {
	class_alias( 'Exacoat_Review_Manager', 'Artmatter_Review_Manager' );
}
