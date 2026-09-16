<?php
/**
 * Exacoat Core Live Plugin Update & Notification Engine
 * Integrates directly with WordPress native update APIs (site_transient_update_plugins, plugins_api, upgrader_source_selection)
 * Manifest Endpoint: https://manager.exacoat.com/version.json (or filterable via exacoat_core_update_manifest_url)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Plugin_Updater' ) ) {
class Exacoat_Plugin_Updater {

	private $file;
	private $basename;
	private $slug;
	private $version;
	private $manifest_url;
	private static $cached_manifest = null;

	public function __construct( $file, $username = 'bolds-labs', $repository = 'exacoat-manager', $version = '0.0.8' ) {
		$this->file     = $file;
		$this->version  = $version;
		$this->basename = plugin_basename( $file );
		$this->slug     = dirname( $this->basename );

		if ( defined( 'EXACOAT_UPDATE_MANIFEST_URL' ) ) {
			$this->manifest_url = EXACOAT_UPDATE_MANIFEST_URL;
		} else {
			$this->manifest_url = apply_filters( 'exacoat_core_update_manifest_url', 'https://manager.exacoat.com/version.json' );
		}

		// One-time flush of legacy Artmatter transient to purge poisoned 7.12.98 update notices
		if ( ! get_transient( 'exacoat_flushed_legacy_update_v1' ) ) {
			delete_transient( 'artmatter_core_remote_version_manifest' );
			delete_site_transient( 'update_plugins' );
			set_transient( 'exacoat_flushed_legacy_update_v1', 1, DAY_IN_SECONDS * 30 );
		}

		// 0. Hook into native WordPress Core Update transient
		add_filter( 'site_transient_update_plugins', [ $this, 'check_for_plugin_update' ] );
		add_filter( 'pre_set_site_transient_update_plugins', [ $this, 'check_for_plugin_update' ] );

		// 1. Hook into Plugin Information Modal (View Version details popup)
		add_filter( 'plugins_api', [ $this, 'render_plugin_info_popup' ], 20, 3 );

		// 2. Ensure clean folder replacement on upgrade
		add_filter( 'upgrader_source_selection', [ $this, 'normalize_source_directory' ], 10, 4 );

		// 3. Auto-reactivate on core upgrader completion
		add_action( 'upgrader_process_complete', [ $this, 'auto_activate_after_upgrade' ], 10, 2 );

		// 4. Add Settings & manual Check for Updates links on Plugins page (plugins.php)
		add_filter( 'plugin_action_links_' . $this->basename, [ $this, 'add_plugin_action_links' ] );
		add_action( 'admin_footer-plugins.php', [ $this, 'render_plugins_page_updater_script' ] );

		// 5. AJAX Endpoints for Explicit Manual Check & 1-Click Update
		add_action( 'wp_ajax_exacoat_check_plugin_update', [ $this, 'ajax_check_plugin_update' ] );
		add_action( 'wp_ajax_artmatter_check_plugin_update', [ $this, 'ajax_check_plugin_update' ] );
		add_action( 'wp_ajax_exacoat_run_one_click_update', [ $this, 'ajax_run_one_click_update' ] );
		add_action( 'wp_ajax_artmatter_run_one_click_update', [ $this, 'ajax_run_one_click_update' ] );
	}

	/**
	 * Instant Webhook Handler: Flushes update transient & marks update ready in WordPress
	 */
	public function rest_handle_notify_release( $request = null ) {
		delete_transient( 'exacoat_core_remote_version_manifest' );
		delete_transient( 'artmatter_core_remote_version_manifest' );
		delete_site_transient( 'update_plugins' );
		self::$cached_manifest = null;

		$manifest = $this->get_remote_manifest( true );
		if ( ! $manifest || empty( $manifest->version ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => 'Unable to fetch remote version manifest from ' . $this->manifest_url,
			], 500 );
		}

		// Force-update WordPress core plugin update transient
		$current_transient = get_site_transient( 'update_plugins' );
		if ( ! is_object( $current_transient ) ) {
			$current_transient = new stdClass();
		}
		$updated_transient = $this->check_for_plugin_update( $current_transient );
		set_site_transient( 'update_plugins', $updated_transient );

		$remote_ver  = ltrim( (string) $manifest->version, 'v' );
		$current_ver = ltrim( (string) $this->version, 'v' );
		$has_update  = version_compare( $current_ver, $remote_ver, '<' );

		return new WP_REST_Response( [
			'success'         => true,
			'has_update'      => $has_update,
			'current_version' => $current_ver,
			'latest_version'  => $remote_ver,
			'message'         => $has_update 
				? "Update ready: v{$remote_ver} is now flagged in WordPress update queue. You can click update directly."
				: "WordPress is already on latest version v{$current_ver}.",
			'timestamp'       => current_time( 'mysql' ),
		], 200 );
	}

	/**
	 * Add "Settings" and "Check for Updates" links on wp-admin/plugins.php
	 */
	public function add_plugin_action_links( $links ) {
		$settings_link = '<a href="' . esc_url( admin_url( 'admin.php?page=exacoat-core' ) ) . '">' . __( 'Settings', 'exacoat-core' ) . '</a>';
		$check_link    = '<a href="javascript:void(0);" id="exacoat-inline-check-update" style="color:#f3aa18; font-weight:600;">' . __( 'Check for Updates', 'exacoat-core' ) . '</a>';
		array_unshift( $links, $settings_link, $check_link );
		return $links;
	}

	/**
	 * Inline Updater Script on wp-admin/plugins.php (No Redirects)
	 */
	public function render_plugins_page_updater_script() {
		?>
		<script type="text/javascript">
		document.addEventListener('DOMContentLoaded', function() {
			const checkBtn = document.getElementById('exacoat-inline-check-update') || document.getElementById('artmatter-inline-check-update');
			if (!checkBtn) return;

			checkBtn.addEventListener('click', function(e) {
				e.preventDefault();
				const originalText = checkBtn.innerHTML;
				checkBtn.innerHTML = '<span style="color:#a3a3a3;">⏳ Checking...</span>';
				checkBtn.style.pointerEvents = 'none';

				const formData = new FormData();
				formData.append('action', 'exacoat_check_plugin_update');

				fetch(ajaxurl, {
					method: 'POST',
					body: formData
				})
				.then(r => r.json())
				.then(res => {
					if (res.success && res.data) {
						if (res.data.has_update) {
							checkBtn.innerHTML = '<span style="color:#f3aa18; font-weight:700;">⚡ v' + res.data.latest_version + ' Available! <a href="javascript:void(0);" id="exacoat-inline-run-update" style="color:#ffffff; background:#22c55e; padding:2px 8px; border-radius:4px; text-decoration:none; margin-left:6px; font-weight:700; font-size:11px;">Update Now</a></span>';
							checkBtn.style.pointerEvents = 'auto';

							const runBtn = document.getElementById('exacoat-inline-run-update') || document.getElementById('artmatter-inline-run-update');
							if (runBtn) {
								runBtn.addEventListener('click', function(ev) {
									ev.preventDefault();
									runBtn.innerText = 'Updating...';
									runBtn.style.pointerEvents = 'none';

									const updateData = new FormData();
									updateData.append('action', 'exacoat_run_one_click_update');

									fetch(ajaxurl, { method: 'POST', body: updateData })
									.then(ur => ur.text())
									.then(text => {
										let ures = { success: true };
										try {
											ures = JSON.parse(text);
										} catch (e) {
											ures = { success: true };
										}
										if (ures.success) {
											runBtn.innerText = '✓ Updated! Reloading...';
											setTimeout(() => window.location.reload(), 1000);
										} else {
											alert('Update failed: ' + (ures.data?.message || 'Unknown error'));
											runBtn.innerText = 'Retry';
											runBtn.style.pointerEvents = 'auto';
										}
									})
									.catch(err => {
										// Fallback: If network severed due to server restart/file lock during upgrade, reload
										runBtn.innerText = '✓ Updated! Reloading...';
										setTimeout(() => window.location.reload(), 1000);
									});
								});
							}
						} else {
							checkBtn.innerHTML = '<span style="color:#f3aa18;">✓ Up to date (v' + res.data.current_version + ')</span>';
							setTimeout(() => {
								checkBtn.innerHTML = originalText;
								checkBtn.style.pointerEvents = 'auto';
							}, 4000);
						}
					} else {
						checkBtn.innerHTML = '<span style="color:#f87171;">⚠️ ' + (res.data?.message || 'Check failed') + '</span>';
						setTimeout(() => {
							checkBtn.innerHTML = originalText;
							checkBtn.style.pointerEvents = 'auto';
						}, 4000);
					}
				})
				.catch(err => {
					checkBtn.innerHTML = '<span style="color:#f87171;">⚠️ Connection Error</span>';
					setTimeout(() => {
						checkBtn.innerHTML = originalText;
						checkBtn.style.pointerEvents = 'auto';
					}, 4000);
				});
			});
		});
		</script>
		<?php
	}

	/**
	 * Fetch Remote Version Manifest with Transient Caching
	 */
	public function get_remote_manifest( $force = false ) {
		if ( ! $force && self::$cached_manifest !== null ) {
			return self::$cached_manifest;
		}

		$transient_key = 'exacoat_core_remote_version_manifest';
		$cached        = get_transient( $transient_key );

		if ( ! $force && $cached && is_object( $cached ) && ! empty( $cached->version ) ) {
			self::$cached_manifest = $cached;
			return $cached;
		}

		$response = wp_remote_get( $this->manifest_url . '?t=' . time(), [
			'timeout'    => 10,
			'user-agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . home_url(),
			'headers'    => [ 'Accept' => 'application/json' ],
			'sslverify'  => false,
		] );

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return false;
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body );

		if ( ! is_object( $data ) || empty( $data->version ) ) {
			return false;
		}

		// Strictly reject any legacy Artmatter 7.x manifest from contaminating Exacoat
		if ( version_compare( (string) $data->version, '7.0', '>=' ) ) {
			return false;
		}

		$cache_time = is_admin() ? 60 : HOUR_IN_SECONDS;
		set_transient( $transient_key, $data, $cache_time );
		self::$cached_manifest = $data;

		return $data;
	}

	/**
	 * Inject update payload into WordPress native update transients
	 */
	public function check_for_plugin_update( $transient ) {
		if ( empty( $transient ) || ! is_object( $transient ) ) {
			return $transient;
		}

		if ( ! isset( $transient->response ) || ! is_array( $transient->response ) ) {
			$transient->response = [];
		}

		if ( ! isset( $transient->no_update ) || ! is_array( $transient->no_update ) ) {
			$transient->no_update = [];
		}

		// Purge any legacy 7.x Artmatter update response that may have been cached in WordPress
		if ( isset( $transient->response[ $this->basename ] ) ) {
			$existing_res = $transient->response[ $this->basename ];
			if ( is_object( $existing_res ) && ! empty( $existing_res->new_version ) && version_compare( (string) $existing_res->new_version, '7.0', '>=' ) ) {
				unset( $transient->response[ $this->basename ] );
			}
		}

		$manifest = $this->get_remote_manifest();
		if ( ! $manifest || empty( $manifest->version ) ) {
			return $transient;
		}

		$remote_version = ltrim( (string) $manifest->version, 'v' );
		$current_ver    = ltrim( (string) $this->version, 'v' );

		// Extra safety check against 7.x
		if ( version_compare( $remote_version, '7.0', '>=' ) ) {
			unset( $transient->response[ $this->basename ] );
			return $transient;
		}

		$update_item = (object) [
			'id'            => $this->basename,
			'slug'          => $this->slug,
			'plugin'        => $this->basename,
			'new_version'   => $remote_version,
			'url'           => $manifest->homepage ?? 'https://exacoat.com',
			'package'       => $manifest->download_url ?? 'https://exacoat.com/exacoat-core.zip',
			'tested'        => $manifest->tested ?? get_bloginfo( 'version' ),
			'requires'      => $manifest->requires ?? '6.0',
			'requires_php'  => $manifest->requires_php ?? '7.4',
			'icons'         => [],
			'banners'       => [],
			'banners_rtl'   => [],
			'compatibility' => new stdClass(),
		];

		if ( version_compare( $current_ver, $remote_version, '<' ) ) {
			$transient->response[ $this->basename ] = $update_item;
			unset( $transient->no_update[ $this->basename ] );
		} else {
			$transient->no_update[ $this->basename ] = $update_item;
			unset( $transient->response[ $this->basename ] );
		}

		return $transient;
	}

	/**
	 * Hook into "View version details" modal popup
	 */
	public function render_plugin_info_popup( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || empty( $args->slug ) ) {
			return $result;
		}

		if ( $args->slug !== $this->slug && $args->slug !== $this->basename && $args->slug !== 'exacoat-core' ) {
			return $result;
		}

		$manifest = $this->get_remote_manifest();
		if ( ! $manifest ) {
			return $result;
		}

		return (object) [
			'name'              => $manifest->name ?? 'Exacoat Core Platform',
			'slug'              => $this->slug,
			'version'           => $manifest->version,
			'author'            => '<a href="https://exacoat.com">Exacoat Engineering</a>',
			'author_profile'    => 'https://exacoat.com',
			'homepage'          => $manifest->homepage ?? 'https://exacoat.com',
			'requires'          => $manifest->requires ?? '6.0',
			'tested'            => $manifest->tested ?? get_bloginfo( 'version' ),
			'requires_php'      => $manifest->requires_php ?? '7.4',
			'download_link'     => $manifest->download_url ?? 'https://exacoat.com/exacoat-core.zip',
			'sections'          => [
				'description' => $manifest->sections->description ?? 'Proprietary e-commerce core engine, configurator manager, and ERP workstation integration for Exacoat.',
				'changelog'   => nl2br( $manifest->sections->changelog ?? '' ),
			],
			'last_updated'      => $manifest->last_updated ?? current_time( 'mysql' ),
		];
	}

	/**
	 * Ensure the extracted zip folder matches the local active plugin directory
	 */
	public function normalize_source_directory( $source, $remote_source, $upgrader, $hook_extra ) {
		global $wp_filesystem;

		if ( isset( $hook_extra['plugin'] ) && $hook_extra['plugin'] === $this->basename ) {
			$norm_source      = wp_normalize_path( untrailingslashit( $source ) );
			$source_dir_name  = basename( $norm_source );
			$correct_slug     = untrailingslashit( $this->slug );

			if ( $source_dir_name !== $correct_slug ) {
				$new_source = trailingslashit( $remote_source ) . $correct_slug . '/';
				if ( $wp_filesystem->move( $source, $new_source ) ) {
					return $new_source;
				}
			}
		}

		return $source;
	}

	/**
	 * Display Global Admin Notice when an update is available
	 */
	public function display_update_admin_notice() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return;
		}

		// Don't show notice on plugin updater screen
		$screen = get_current_screen();
		if ( $screen && in_array( $screen->id, [ 'update', 'update-core' ], true ) ) {
			return;
		}

		$manifest = $this->get_remote_manifest();
		if ( ! $manifest || empty( $manifest->version ) ) {
			return;
		}

		$remote_version = ltrim( (string) $manifest->version, 'v' );
		$current_ver    = ltrim( (string) $this->version, 'v' );

		if ( version_compare( $current_ver, $remote_version, '<' ) ) {
			$update_url = wp_nonce_url(
				self_admin_url( 'update.php?action=upgrade-plugin&plugin=' . urlencode( $this->basename ) ),
				'upgrade-plugin_' . $this->basename
			);
			$settings_url = admin_url( 'admin.php?page=exacoat-core' );
			?>
			<div class="notice notice-warning is-dismissible" style="background: #16181E; border: 1px solid rgba(245,158,11,0.4); border-left: 4px solid #f59e0b; color: #FFFFFF; border-radius: 12px; padding: 14px 18px; margin: 15px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
				<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
					<div style="display: flex; align-items: center; gap: 10px;">
						<span style="font-size: 20px;">🚀</span>
						<div>
							<strong style="color: #FFFFFF; font-size: 13px;">Exacoat Core Update Available!</strong>
							<p style="margin: 2px 0 0 0; color: #D4D4D8; font-size: 12px;">
								Version <code style="color: #f3aa18; font-weight: bold; background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px;">v<?php echo esc_html( $remote_version ); ?></code> is ready to install (current installed: v<?php echo esc_html( $current_ver ); ?>).
							</p>
						</div>
					</div>
					<div style="display: flex; gap: 8px;">
						<a href="<?php echo esc_url( $update_url ); ?>" class="button button-primary" style="background: #f3aa18; color: #08090B; border: none; border-radius: 8px; font-weight: 700; font-size: 12px; padding: 4px 16px; text-decoration: none; display: inline-flex; align-items: center;">
							⚡ Update Now (WordPress)
						</a>
						<a href="<?php echo esc_url( $settings_url ); ?>" class="button" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 8px; font-size: 12px; text-decoration: none;">
							View Changelog & Settings
						</a>
					</div>
				</div>
			</div>
			<?php
		}
	}

	/**
	 * AJAX: Check for updates (forces refresh)
	 */
	public function ajax_check_plugin_update() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		delete_transient( 'exacoat_core_remote_version_manifest' );
		delete_transient( 'artmatter_core_remote_version_manifest' );
		delete_site_transient( 'update_plugins' );

		$manifest = $this->get_remote_manifest( true );
		if ( ! $manifest || empty( $manifest->version ) ) {
			wp_send_json_error( [ 'message' => 'Unable to reach update manifest at ' . esc_url( $this->manifest_url ) ] );
		}

		$remote_ver = ltrim( (string) $manifest->version, 'v' );
		$current_ver = ltrim( (string) $this->version, 'v' );
		$has_update  = version_compare( $current_ver, $remote_ver, '<' );

		$update_url = wp_nonce_url(
			self_admin_url( 'update.php?action=upgrade-plugin&plugin=' . urlencode( $this->basename ) ),
			'upgrade-plugin_' . $this->basename
		);

		wp_send_json_success( [
			'has_update'      => $has_update,
			'current_version' => $current_ver,
			'latest_version'  => $remote_ver,
			'changelog'       => $manifest->sections->changelog ?? '',
			'download_url'    => $manifest->download_url ?? '',
			'update_url'      => $update_url,
			'last_checked'    => current_time( 'mysql' ),
		] );
	}

	/**
	 * AJAX: 1-Click Background Update
	 */
	public function ajax_run_one_click_update() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized. Must have update_plugins capability.' ] );
		}

		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';

		// 1. Force fetch fresh manifest
		delete_transient( 'exacoat_core_remote_version_manifest' );
		delete_transient( 'artmatter_core_remote_version_manifest' );
		delete_site_transient( 'update_plugins' );
		self::$cached_manifest = null;

		$manifest = $this->get_remote_manifest( true );
		if ( ! $manifest || empty( $manifest->download_url ) ) {
			wp_send_json_error( [ 'message' => 'Invalid update manifest: unable to resolve download URL.' ] );
		}

		// 2. Explicitly populate update_plugins site transient
		$current_transient = get_site_transient( 'update_plugins' );
		if ( ! is_object( $current_transient ) ) {
			$current_transient = new stdClass();
		}
		$current_transient = $this->check_for_plugin_update( $current_transient );
		set_site_transient( 'update_plugins', $current_transient );

		$upgrade_succeeded = false;
		$error_message     = '';

		// 3. Guaranteed Direct Extraction & Clean Activation
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		global $wp_filesystem;

		$package_url = $manifest->download_url;
		$package_url .= ( strpos( $package_url, '?' ) !== false ? '&' : '?' ) . 't=' . time();

		$temp_file = download_url( $package_url, 300 );
		if ( is_wp_error( $temp_file ) ) {
			wp_send_json_error( [ 'message' => 'Download failed: ' . $temp_file->get_error_message() ] );
		}

		$plugins_dir        = WP_PLUGIN_DIR;
		$extraction_success = false;

		// 1. Primary engine: ZipArchive
		if ( class_exists( 'ZipArchive' ) ) {
			$zip = new ZipArchive();
			if ( true === $zip->open( $temp_file ) ) {
				for ( $i = 0; $i < $zip->numFiles; $i++ ) {
					$filename = $zip->getNameIndex( $i );
					if ( strpos( $filename, '../' ) !== false || strpos( $filename, '..\\' ) !== false ) {
						continue;
					}
					$target_path = $plugins_dir . '/' . $filename;
					if ( substr( $filename, -1 ) === '/' ) {
						if ( ! is_dir( $target_path ) ) {
							@mkdir( $target_path, 0777, true );
						}
					} else {
						$dir = dirname( $target_path );
						if ( ! is_dir( $dir ) ) {
							@mkdir( $dir, 0777, true );
						}
						$content = $zip->getFromIndex( $i );
						if ( false !== $content ) {
							@file_put_contents( $target_path, $content );
							@chmod( $target_path, 0666 );
						}
					}
				}
				$zip->close();
				$extraction_success = true;
			}
		}

		// 2. Secondary fallback: WordPress core unzip_file
		if ( ! $extraction_success ) {
			$unzip_result = unzip_file( $temp_file, $plugins_dir );
			if ( is_wp_error( $unzip_result ) ) {
				@unlink( $temp_file );
				wp_send_json_error( [ 'message' => 'Unzip failed: ' . $unzip_result->get_error_message() ] );
			}
		}

		@unlink( $temp_file );

		// 4. Ensure .maintenance file is removed immediately
		$maintenance_file = ABSPATH . '.maintenance';
		if ( file_exists( $maintenance_file ) ) {
			@unlink( $maintenance_file );
		}

		// 5. Ensure plugin is in active_plugins option list without re-including in-memory PHP files
		$active_plugins = (array) get_option( 'active_plugins', [] );
		if ( ! in_array( $this->basename, $active_plugins, true ) ) {
			$active_plugins[] = $this->basename;
			update_option( 'active_plugins', array_values( array_unique( $active_plugins ) ) );
		}

		// 6. Clear WordPress plugin headers cache
		if ( function_exists( 'wp_clean_plugins_cache' ) ) {
			wp_clean_plugins_cache( false );
		}

		// 7. Flush OPcache & invalidate bytecode for all plugin files
		if ( function_exists( 'opcache_invalidate' ) ) {
			try {
				$plugin_full_dir = $plugins_dir . '/' . $this->slug;
				if ( is_dir( $plugin_full_dir ) ) {
					$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $plugin_full_dir ) );
					foreach ( $iterator as $file ) {
						if ( $file->isFile() && $file->getExtension() === 'php' ) {
							@opcache_invalidate( $file->getPathname(), true );
						}
					}
				}
			} catch ( \Throwable $e ) {}
		}

		if ( function_exists( 'opcache_reset' ) ) {
			@opcache_reset();
		}
		if ( function_exists( 'wp_cache_flush' ) ) {
			@wp_cache_flush();
		}
		clearstatcache( true );

		if ( has_action( 'litespeed_purge_all' ) || defined( 'LSCWP_V' ) ) {
			do_action( 'litespeed_purge_all' );
		}

		delete_transient( 'exacoat_core_remote_version_manifest' );
		delete_transient( 'artmatter_core_remote_version_manifest' );
		delete_site_transient( 'update_plugins' );
		self::$cached_manifest = null;

		if ( class_exists( 'Exacoat_Logger' ) ) {
			Exacoat_Logger::log( 'info', 'updater', 'Plugin updated successfully to v' . (string) $manifest->version );
		} elseif ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::log( 'info', 'updater', 'Plugin updated successfully to v' . (string) $manifest->version );
		}

		wp_send_json_success( [
			'message' => 'Exacoat Core successfully updated and reactivated to v' . $manifest->version . '!',
			'version' => $manifest->version,
		] );
	}

	/**
	 * Automatically reactivate plugin when updated via WordPress core upgrader
	 */
	public function auto_activate_after_upgrade( $upgrader_object, $options ) {
		if ( isset( $options['action'], $options['type'] ) && 'update' === $options['action'] && 'plugin' === $options['type'] ) {
			$updated_plugins = [];
			if ( isset( $options['plugins'] ) && is_array( $options['plugins'] ) ) {
				$updated_plugins = $options['plugins'];
			} elseif ( ! empty( $options['plugin'] ) ) {
				$updated_plugins = (array) $options['plugin'];
			}

			if ( in_array( $this->basename, $updated_plugins, true ) || in_array( $this->slug, $updated_plugins, true ) ) {
				if ( ! function_exists( 'activate_plugin' ) ) {
					require_once ABSPATH . 'wp-admin/includes/plugin.php';
				}
				activate_plugin( $this->basename, '', false, true );

				// Flush OPcache & Object Cache immediately to prevent bytecode race conditions
				if ( function_exists( 'opcache_reset' ) ) {
					@opcache_reset();
				}
				if ( function_exists( 'wp_cache_flush' ) ) {
					@wp_cache_flush();
				}

				// Clean up any remaining .maintenance file immediately
				$maintenance_file = ABSPATH . '.maintenance';
				if ( file_exists( $maintenance_file ) ) {
					@unlink( $maintenance_file );
				}

				if ( class_exists( 'Exacoat_Logger' ) ) {
					Exacoat_Logger::log( 'info', 'updater', 'Plugin core upgrader reactivated to v' . EXACOAT_CORE_VERSION );
				} elseif ( class_exists( 'Artmatter_Logger' ) ) {
					Artmatter_Logger::log( 'info', 'updater', 'Plugin core upgrader reactivated to v' . EXACOAT_CORE_VERSION );
				}
			}
		}
	}
}
}

// Backwards compatibility alias
if ( ! class_exists( 'Artmatter_GitHub_Updater' ) ) {
	class_alias( 'Exacoat_Plugin_Updater', 'Artmatter_GitHub_Updater' );
}
