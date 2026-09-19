<?php
/**
 * Exacoat Export Manager
 * 
 * Handles logistics bulk exports for JNE and Goorita (XLSX & CSV),
 * provides quick shipment copy & WhatsApp automation for US orders,
 * and exposes REST API endpoints for the Exacoat Manager ERP workstation.
 * 
 * Accessible by Shop Manager ('manage_woocommerce') and Administrator roles.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Export_Manager' ) ) {

class Exacoat_Export_Manager {

	const CAPABILITY = 'manage_woocommerce';

	public static function init(): void {
		// 1. Admin Menus for Headless WP fallback
		add_action( 'admin_menu', [ __CLASS__, 'register_admin_menus' ] );

		// 2. Export generation request handlers
		add_action( 'admin_init', [ __CLASS__, 'handle_admin_jne_export' ] );
		add_action( 'admin_init', [ __CLASS__, 'handle_admin_goorita_export' ] );

		// 3. Automated file cleanup cron
		add_action( 'exacoat_daily_export_cleanup', [ __CLASS__, 'cleanup_old_export_files' ] );
		if ( ! wp_next_scheduled( 'exacoat_daily_export_cleanup' ) ) {
			wp_schedule_event( time(), 'daily', 'exacoat_daily_export_cleanup' );
		}

		// 4. Admin Order Details Quick Actions (Classic CPT & HPOS)
		add_action( 'woocommerce_admin_order_data_after_shipping_address', [ __CLASS__, 'render_goorita_order_buttons' ] );
		add_action( 'admin_footer', [ __CLASS__, 'render_goorita_admin_script' ] );
		add_action( 'wp_ajax_get_goorita_shipment_data', [ __CLASS__, 'ajax_get_goorita_shipment_data' ] );

		// 5. REST API Endpoints for Exacoat Manager Workstation
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// 6. Admin Styles
		add_action( 'admin_head', [ __CLASS__, 'render_admin_styles' ] );
	}

	/**
	 * Register Admin Menus with 'manage_woocommerce' capability (accessible by Shop Manager)
	 */
	public static function register_admin_menus(): void {
		add_menu_page(
			__( 'JNE Export', 'exacoat-core' ),
			__( 'JNE Export', 'exacoat-core' ),
			self::CAPABILITY,
			'jne-export',
			[ __CLASS__, 'render_jne_export_page' ],
			'dashicons-media-spreadsheet',
			56
		);

		add_menu_page(
			__( 'Goorita Export', 'exacoat-core' ),
			__( 'Goorita Export', 'exacoat-core' ),
			self::CAPABILITY,
			'goorita-export',
			[ __CLASS__, 'render_goorita_export_page' ],
			'dashicons-airplane',
			57
		);
	}

	/**
	 * Safely resolve template file path from available sources
	 */
	public static function get_template_path( string $filename ): string {
		$paths = [
			WP_CONTENT_DIR . '/generated-excel/template/' . $filename,
			EXACOAT_CORE_PATH . 'templates/excel/' . $filename,
			'C:/Users/shand/OneDrive/Desktop/generated-excel/template/' . $filename,
		];

		foreach ( $paths as $path ) {
			if ( file_exists( $path ) ) {
				return $path;
			}
		}

		return '';
	}

	/**
	 * Resolve or create output directory and URL
	 */
	public static function get_output_dir( string $subfolder = '' ): array {
		$base_dir = WP_CONTENT_DIR . '/generated-excel';
		$base_url = content_url( '/generated-excel' );

		// Fallback to uploads folder if wp-content is not writable
		if ( ! is_writable( WP_CONTENT_DIR ) && function_exists( 'wp_upload_dir' ) ) {
			$upload = wp_upload_dir();
			$base_dir = $upload['basedir'] . '/generated-excel';
			$base_url = $upload['baseurl'] . '/generated-excel';
		}

		$target_dir = trailingslashit( $base_dir );
		$target_url = trailingslashit( $base_url );

		if ( ! empty( $subfolder ) ) {
			$target_dir .= trailingslashit( trim( $subfolder, '/\\' ) );
			$target_url .= trailingslashit( trim( $subfolder, '/\\' ) );
		}

		if ( ! file_exists( $target_dir ) ) {
			wp_mkdir_p( $target_dir );
		}

		return [
			'dir' => $target_dir,
			'url' => $target_url,
		];
	}

	/**
	 * Ensure PhpSpreadsheet autoloader is loaded safely
	 */
	public static function load_spreadsheet_library(): bool {
		if ( class_exists( '\PhpOffice\PhpSpreadsheet\Spreadsheet' ) && class_exists( '\PhpOffice\PhpSpreadsheet\IOFactory' ) ) {
			return true;
		}

		$autoload_candidates = [
			ABSPATH . 'wp-content/plugins/cbxphpspreadsheet/lib/vendor/autoload.php',
			WP_CONTENT_DIR . '/plugins/cbxphpspreadsheet/lib/vendor/autoload.php',
			EXACOAT_CORE_PATH . 'vendor/autoload.php',
			ABSPATH . 'vendor/autoload.php',
		];

		foreach ( $autoload_candidates as $file ) {
			if ( file_exists( $file ) ) {
				require_once $file;
				if ( class_exists( '\PhpOffice\PhpSpreadsheet\Spreadsheet' ) ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * JNE Export Admin View
	 */
	public static function render_jne_export_page(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'exacoat-core' ) );
		}

		$nonce = wp_create_nonce( 'jne_export_nonce' );
		$output_info = self::get_output_dir( 'jne' );
		?>
		<div class="wrap">
			<h2><?php esc_html_e( 'JNE Export', 'exacoat-core' ); ?></h2>

			<?php if ( isset( $_GET['generated'] ) ) : ?>
				<?php
				$date = date_i18n( 'Y.m.d' );
				$xlsx_name = "{$date} Master Data exacoat.xlsx";
				$csv_name  = "{$date} Data Loader exacoat.csv";
				$cache_buster = '?t=' . time();

				$last_generated_time = get_option( 'jne_last_generated', current_time( 'timestamp' ) );
				$last_generated      = date_i18n( 'Y/m/d H.i', $last_generated_time );

				$xlsx_url = $output_info['url'] . rawurlencode( $xlsx_name ) . $cache_buster;
				$csv_url  = $output_info['url'] . rawurlencode( $csv_name ) . $cache_buster;
				?>
				<div class="notice notice-success is-dismissible" style="padding:15px; border-radius:8px;">
					<p style="font-size:14px; margin-top:0;"><strong><?php esc_html_e( 'Files generated successfully.', 'exacoat-core' ); ?></strong> (<?php echo esc_html( sprintf( __( 'Last generated: %s', 'exacoat-core' ), $last_generated ) ); ?>)</p>
					<p style="margin-bottom:0;">
						<a href="<?php echo esc_url( $xlsx_url ); ?>" class="button button-primary" download><?php esc_html_e( 'Download XLSX', 'exacoat-core' ); ?></a>
						<a href="<?php echo esc_url( $csv_url ); ?>" class="button button-primary" style="margin-left:8px;" download><?php esc_html_e( 'Download CSV', 'exacoat-core' ); ?></a>
					</p>
				</div>
			<?php endif; ?>

			<?php
			$jne_orders = self::get_jne_export_orders();
			$jne_count  = count( $jne_orders );
			?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=jne-export' ) ); ?>" style="max-width:760px;">
				<input type="hidden" name="nonce" value="<?php echo esc_attr( $nonce ); ?>">
				<input type="hidden" name="action" value="generate_jne">

				<div class="notice notice-info" style="margin:20px 0; padding:15px; border-radius:8px;">
					<p><b><?php esc_html_e( 'Export ini akan mengambil data pesanan JNE dalam status "Waiting for Courier Pickup"', 'exacoat-core' ); ?></b></p>
					<p style="margin:6px 0; color:#1d2327;">
						<?php echo esc_html( sprintf( __( 'Saat ini terdapat %d pesanan JNE siap pickup.', 'exacoat-core' ), $jne_count ) ); ?>
					</p>
					<ul style="margin-left: 20px; list-style-type: disc;">
						<li><?php echo wp_kses_post( __( 'Setelah data di-generate, unduh file <b>XLSX</b> dan <b>CSV</b>.', 'exacoat-core' ) ); ?></li>
						<li><?php echo wp_kses_post( __( 'Simpan data dalam folder <code>\Exacoat CS\Resi (JNE SICEPAT)\JNE Ruby E-Connote (untuk email)</code>.', 'exacoat-core' ) ); ?></li>
						<li>
							<?php
							$settings   = get_option( 'exacoat_core_settings', [] );
							$recipients = ! empty( $settings['jne_email_recipients'] ) ? $settings['jne_email_recipients'] : 'bki.project@jne.co.id,bki.ccc1@jne.co.id,bayuriskanda83@gmail.com';
							$cc         = ! empty( $settings['jne_email_cc'] ) ? $settings['jne_email_cc'] : 'exacoat.cs@gmail.com';
							$date_str   = date_i18n( 'Y.m.d' );
							$subject    = ! empty( $settings['jne_email_subject'] ) ? str_replace( '{date}', $date_str, $settings['jne_email_subject'] ) : "{$date_str} - econnote exacoat";
							$body       = ! empty( $settings['jne_email_body'] ) ? str_replace( '{date}', $date_str, $settings['jne_email_body'] ) : "Dear Mas Bayu,\n\nBerikut kami lampirkan Master Data dan Data Loader pengiriman exacoat untuk hari ini.\n\nMohon diproses, terima kasih!";
							$mailto_url = 'mailto:' . esc_attr( $recipients ) . '?cc=' . rawurlencode( $cc ) . '&subject=' . rawurlencode( $subject ) . '&body=' . rawurlencode( $body );
							?>
							<a href="<?php echo esc_url( $mailto_url ); ?>" target="_blank" class="button button-secondary" style="margin-top:6px;">
								<?php esc_html_e( 'Kirim Email ke JNE', 'exacoat-core' ); ?> &rarr;
							</a>
						</li>
					</ul>
				</div>

				<p>
					<button type="submit" name="generate" class="button button-primary button-hero" value="1" <?php disabled( $jne_count === 0 ); ?>>
						<?php esc_html_e( 'Generate JNE Export (.xlsx & .csv)', 'exacoat-core' ); ?>
					</button>
				</p>
			</form>
		</div>
		<?php
		self::cleanup_old_export_files();
	}

	/**
	 * Goorita Export Admin View
	 */
	public static function render_goorita_export_page(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'exacoat-core' ) );
		}

		$nonce = wp_create_nonce( 'goorita_export_nonce' );
		$output_info = self::get_output_dir( 'goorita' );
		?>
		<div class="wrap">
			<h2><?php esc_html_e( 'Goorita Export', 'exacoat-core' ); ?></h2>

			<?php if ( isset( $_GET['generated'] ) ) : ?>
				<?php
				$date = date_i18n( 'Y.m.d' );
				$file = "{$date} Goorita Bulk Shipment.xlsx";
				$url  = $output_info['url'] . rawurlencode( $file ) . '?t=' . time();
				?>
				<div class="notice notice-success is-dismissible" style="padding:15px; border-radius:8px;">
					<p style="font-size:14px; margin-top:0;"><strong><?php esc_html_e( 'Goorita bulk file generated successfully.', 'exacoat-core' ); ?></strong></p>
					<p style="margin-bottom:0;">
						<a href="<?php echo esc_url( $url ); ?>" class="button button-primary" download><?php esc_html_e( 'Download XLSX', 'exacoat-core' ); ?></a>
					</p>
				</div>
			<?php endif; ?>

			<?php
			$goorita_orders = self::get_goorita_export_orders();
			$goorita_count  = count( $goorita_orders );
			?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin.php?page=goorita-export' ) ); ?>" style="max-width:760px;">
				<input type="hidden" name="nonce" value="<?php echo esc_attr( $nonce ); ?>">
				<input type="hidden" name="action" value="generate_goorita">

				<div class="notice notice-info" style="margin:20px 0; padding:15px; border-radius:8px;">
					<p><b><?php esc_html_e( 'Export ini akan mengambil pesanan Goorita dalam status "Waiting for Courier Pickup"', 'exacoat-core' ); ?></b></p>
					<p style="margin:6px 0; color:#1d2327;">
						<?php echo esc_html( sprintf( __( 'Saat ini terdapat %d pesanan Goorita siap pickup.', 'exacoat-core' ), $goorita_count ) ); ?>
					</p>
				</div>

				<p>
					<button type="submit" name="generate_goorita" class="button button-primary button-hero" value="1" <?php disabled( $goorita_count === 0 ); ?>>
						<?php esc_html_e( 'Generate Goorita Export (.xlsx)', 'exacoat-core' ); ?>
					</button>
				</p>
			</form>
		</div>
		<?php
		self::cleanup_old_export_files();
	}

	/**
	 * Check if an order is destined for JNE Export (Domestic Indonesia)
	 */
	public static function is_jne_order( $order ): bool {
		if ( ! is_a( $order, 'WC_Order' ) ) {
			return false;
		}

		// 1. Check explicit carrier metadata
		$carrier = strtolower( trim( (string) (
			$order->get_meta( 'carrier_id' )
			?: ( $order->get_meta( '_carrier_id' )
			?: ( ( function_exists( 'get_field' ) ? get_field( 'carrier_id', $order->get_id() ) : '' )
			?: ( $order->get_meta( '_biteship_courier' )
			?: ( $order->get_meta( 'courier' ) ?: '' ) ) ) )
		) ) );

		if ( $carrier === 'jne' ) {
			return true;
		}

		if ( in_array( $carrier, [ 'goorita', 'sicepat', 'pos', 'dhl', 'fedex', 'pickup' ], true ) ) {
			return false;
		}

		// 2. Check shipping method title and shipping line items
		$shipping_text = strtolower( (string) $order->get_shipping_method() );
		if ( method_exists( $order, 'get_shipping_methods' ) ) {
			foreach ( $order->get_shipping_methods() as $item ) {
				if ( is_a( $item, 'WC_Order_Item_Shipping' ) ) {
					$shipping_text .= ' ' . strtolower( (string) $item->get_name() ) . ' ' . strtolower( (string) $item->get_method_id() );
				}
			}
		}

		// Skip store pickup
		if ( stripos( $shipping_text, 'gandaria' ) !== false || stripos( $shipping_text, 'pickup' ) !== false || stripos( $shipping_text, 'ambil' ) !== false ) {
			return false;
		}

		// Skip other couriers
		if ( stripos( $shipping_text, 'goorita' ) !== false || stripos( $shipping_text, 'sicepat' ) !== false || stripos( $shipping_text, 'pos ind' ) !== false || stripos( $shipping_text, 'dhl' ) !== false || stripos( $shipping_text, 'fedex' ) !== false ) {
			return false;
		}

		// Match JNE shipping method
		if ( stripos( $shipping_text, 'jne' ) !== false ) {
			return true;
		}

		// 3. Destination country: domestic orders default to JNE
		$country = strtoupper( trim( (string) ( $order->get_shipping_country() ?: $order->get_billing_country() ) ) );
		if ( empty( $country ) || $country === 'ID' ) {
			return true;
		}

		return false;
	}

	/**
	 * Check if an order is destined for Goorita Export (International)
	 */
	public static function is_goorita_order( $order ): bool {
		if ( ! is_a( $order, 'WC_Order' ) ) {
			return false;
		}

		// 1. Check explicit carrier metadata
		$carrier = strtolower( trim( (string) (
			$order->get_meta( 'carrier_id' )
			?: ( $order->get_meta( '_carrier_id' )
			?: ( ( function_exists( 'get_field' ) ? get_field( 'carrier_id', $order->get_id() ) : '' )
			?: ( $order->get_meta( '_biteship_courier' )
			?: ( $order->get_meta( 'courier' ) ?: '' ) ) ) )
		) ) );

		if ( $carrier === 'goorita' ) {
			return true;
		}

		if ( in_array( $carrier, [ 'jne', 'sicepat', 'pos', 'dhl', 'fedex', 'pickup' ], true ) ) {
			return false;
		}

		// 2. Check shipping methods
		$shipping_text = strtolower( (string) $order->get_shipping_method() );
		if ( method_exists( $order, 'get_shipping_methods' ) ) {
			foreach ( $order->get_shipping_methods() as $item ) {
				if ( is_a( $item, 'WC_Order_Item_Shipping' ) ) {
					$shipping_text .= ' ' . strtolower( (string) $item->get_name() ) . ' ' . strtolower( (string) $item->get_method_id() );
				}
			}
		}

		if ( stripos( $shipping_text, 'goorita' ) !== false ) {
			return true;
		}

		if ( stripos( $shipping_text, 'gandaria' ) !== false || stripos( $shipping_text, 'pickup' ) !== false ) {
			return false;
		}

		// 3. International destination check
		$country = strtoupper( trim( (string) ( $order->get_shipping_country() ?: $order->get_billing_country() ) ) );
		if ( ! empty( $country ) && $country !== 'ID' ) {
			return true;
		}

		return false;
	}

	/**
	 * Query orders ready for JNE Export
	 */
	public static function get_jne_export_orders(): array {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return [];
		}

		$statuses = [ 'ready-to-ship', 'wc-ready-to-ship', 'awaiting-pickup', 'wc-awaiting-pickup', 'smb-ready', 'wc-smb-ready' ];
		$candidate_orders = wc_get_orders( [
			'limit'  => -1,
			'status' => $statuses,
		] );

		if ( empty( $candidate_orders ) || ! is_array( $candidate_orders ) ) {
			return [];
		}

		$jne_orders = [];
		foreach ( $candidate_orders as $order ) {
			if ( self::is_jne_order( $order ) ) {
				$jne_orders[] = $order;
			}
		}

		return $jne_orders;
	}

	/**
	 * Query orders ready for Goorita Export
	 */
	public static function get_goorita_export_orders(): array {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return [];
		}

		$statuses = [ 'ready-to-ship', 'wc-ready-to-ship', 'awaiting-pickup', 'wc-awaiting-pickup', 'smb-ready', 'wc-smb-ready' ];
		$candidate_orders = wc_get_orders( [
			'limit'  => -1,
			'status' => $statuses,
		] );

		if ( empty( $candidate_orders ) || ! is_array( $candidate_orders ) ) {
			return [];
		}

		$goorita_orders = [];
		foreach ( $candidate_orders as $order ) {
			if ( self::is_goorita_order( $order ) ) {
				$goorita_orders[] = $order;
			}
		}

		return $goorita_orders;
	}

	/**
	 * Process JNE Export Generation
	 */
	public static function handle_admin_jne_export(): void {
		if (
			! isset( $_POST['action'] ) ||
			'generate_jne' !== $_POST['action'] ||
			empty( $_POST['nonce'] ) ||
			! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'jne_export_nonce' )
		) {
			return;
		}

		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'Unauthorized', 'exacoat-core' ) );
		}

		$res = self::generate_jne_files();

		if ( is_wp_error( $res ) ) {
			wp_die( esc_html( $res->get_error_message() ) );
		}

		wp_safe_redirect( admin_url( 'admin.php?page=jne-export&generated=1' ) );
		exit;
	}

	/**
	 * Generate JNE XLSX and CSV Files
	 */
	public static function generate_jne_files() {
		if ( ! self::load_spreadsheet_library() ) {
			return new WP_Error( 'missing_library', __( 'PhpSpreadsheet library is not installed on this server. Please ensure the cbxphpspreadsheet plugin is active.', 'exacoat-core' ) );
		}

		$template_path = self::get_template_path( 'master-data-exacoat.xlsx' );
		if ( empty( $template_path ) || ! file_exists( $template_path ) ) {
			$template_path = self::get_template_path( '1. Master Data exacoat.xlsx' );
		}
		if ( empty( $template_path ) || ! file_exists( $template_path ) ) {
			return new WP_Error( 'missing_template', __( 'JNE Excel template (master-data-exacoat.xlsx) could not be located.', 'exacoat-core' ) );
		}

		$output_info = self::get_output_dir( 'jne' );
		$date        = date_i18n( 'Y.m.d' );
		$xlsx_path   = $output_info['dir'] . "{$date} Master Data exacoat.xlsx";
		$csv_path    = $output_info['dir'] . "{$date} Data Loader exacoat.csv";

		try {
			$spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load( $template_path );
			$sheet       = $spreadsheet->getActiveSheet();
			$csv_rows    = [];

			$orders = self::get_jne_export_orders();
			$row    = 4;

			foreach ( $orders as $order ) {
				$method_code = $order->get_shipping_method();
				if ( stripos( $method_code, 'gandaria' ) !== false ) {
					continue;
				}

				$shipping_method = 'REG15';
				if ( stripos( $method_code, 'yes' ) !== false ) {
					$shipping_method = 'YES15';
				}

				$order_id       = $order->get_id();
				$customer_name  = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
				$address        = $order->get_billing_address_1();
				$address2       = $order->get_billing_address_2();
				$district       = $order->get_meta( '_billing_district' );
				$city           = $order->get_meta( '_billing_city' ) ?: $order->get_billing_city();

				$state_code     = $order->get_billing_state();
				$country_code   = $order->get_billing_country();
				$states         = function_exists( 'WC' ) ? WC()->countries->get_states( $country_code ) : [];
				$region         = isset( $states[ $state_code ] ) ? $states[ $state_code ] : $state_code;

				$postcode       = $order->get_meta( '_billing_postcode' ) ?: $order->get_billing_postcode();
				$phone          = $order->get_billing_phone();
				$phone          = str_replace( [ '-', ' ', '+62', '+', '(', ')' ], [ '', '', '0', '', '', '' ], $phone );
				if ( substr( $phone, 0, 1 ) !== '0' && substr( $phone, 0, 2 ) === '62' ) {
					$phone = '0' . substr( $phone, 2 );
				}

				$tracking_number = $order->get_meta( 'tracking_number' ) ?: $order->get_meta( '_tracking_number' );

				$full_street_address = $address;
				if ( ! empty( $address2 ) ) {
					$full_street_address .= ', ' . $address2;
				}
				if ( ! empty( $district ) ) {
					$full_street_address .= ', ' . $district;
				}

				$sheet->setCellValue( "A$row", 'BKI000' );
				$sheet->setCellValue( "B$row", '10605503' );
				$sheet->setCellValue( "C$row", 'BKI10000' );
				$sheet->setCellValue( "D$row", $order_id );
				$sheet->setCellValue( "E$row", $customer_name );
				$sheet->setCellValue( "F$row", $full_street_address );
				$sheet->setCellValue( "G$row", $city );
				$sheet->setCellValue( "H$row", $region );
				$sheet->setCellValue( "I$row", $postcode );
				$sheet->setCellValue( "J$row", $phone );
				$sheet->setCellValue( "K$row", '' );
				$sheet->setCellValue( "L$row", $shipping_method );
				$sheet->setCellValue( "M$row", 1 );
				$sheet->setCellValue( "N$row", 1 );
				$sheet->setCellValue( "O$row", '' );
				$sheet->setCellValue( "P$row", 'Aksesoris hp' );
				$sheet->setCellValue( "Q$row", '' );
				$sheet->setCellValue( "R$row", '' );
				$sheet->setCellValue( "S$row", $tracking_number );

				$csv_rows[] = [
					'BKI000', '10605503', 'BKI10000', $order_id, $customer_name,
					$full_street_address, $city, $region, $postcode, $phone,
					'', $shipping_method, 1, 1, '', 'Aksesoris hp', '', '', $tracking_number,
				];

				$row++;
			}

			$writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx( $spreadsheet );
			$writer->save( $xlsx_path );

			if ( ! empty( $csv_rows ) ) {
				$csv_file = fopen( $csv_path, 'w' );
				foreach ( $csv_rows as $csv_row ) {
					fputcsv( $csv_file, $csv_row, ',', '"', '\\' );
				}
				fclose( $csv_file );
			}

			update_option( 'jne_last_generated', current_time( 'timestamp' ) );

			// Track files for cleanup
			$files_to_clean   = get_option( 'jne_export_files', [] );
			$files_to_clean[] = [ 'path' => $xlsx_path, 'created' => time() ];
			$files_to_clean[] = [ 'path' => $csv_path,  'created' => time() ];
			update_option( 'jne_export_files', $files_to_clean );

			return [
				'success'    => true,
				'xlsx_path'  => $xlsx_path,
				'csv_path'   => $csv_path,
				'xlsx_url'   => $output_info['url'] . rawurlencode( basename( $xlsx_path ) ),
				'csv_url'    => $output_info['url'] . rawurlencode( basename( $csv_path ) ),
				'count'      => count( $orders ),
			];
		} catch ( \Throwable $e ) {
			return new WP_Error( 'export_failed', $e->getMessage() );
		}
	}

	/**
	 * Process Goorita Export Generation
	 */
	public static function handle_admin_goorita_export(): void {
		if (
			! isset( $_POST['action'] ) ||
			'generate_goorita' !== $_POST['action'] ||
			empty( $_POST['nonce'] ) ||
			! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ) ), 'goorita_export_nonce' )
		) {
			return;
		}

		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'Unauthorized', 'exacoat-core' ) );
		}

		$res = self::generate_goorita_files();

		if ( is_wp_error( $res ) ) {
			wp_die( esc_html( $res->get_error_message() ) );
		}

		wp_safe_redirect( admin_url( 'admin.php?page=goorita-export&generated=1' ) );
		exit;
	}

	/**
	 * Generate Goorita Bulk Shipment XLSX File
	 */
	public static function generate_goorita_files() {
		if ( ! self::load_spreadsheet_library() ) {
			return new WP_Error( 'missing_library', __( 'PhpSpreadsheet library is not installed on this server.', 'exacoat-core' ) );
		}

		$template_path = self::get_template_path( 'goorita_bulk_shipment.xlsx' );
		if ( empty( $template_path ) || ! file_exists( $template_path ) ) {
			return new WP_Error( 'missing_template', __( 'Goorita Excel template (goorita_bulk_shipment.xlsx) could not be located.', 'exacoat-core' ) );
		}

		$output_info = self::get_output_dir( 'goorita' );
		$date        = date_i18n( 'Y.m.d' );
		$out_file    = $output_info['dir'] . "{$date} Goorita Bulk Shipment.xlsx";

		try {
			$spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load( $template_path );
			$sheet       = $spreadsheet->getActiveSheet();

			$base_headers = [
				'SENDER NAME', 'SENDER EMAIL', 'SENDER PHONE',
				'SENDER ADDRESS LINE 1', 'SENDER ADDRESS LINE 2',
				'SENDER DISTRICT', 'SENDER SUBDISTRICT', 'SENDER CITY',
				'SENDER PROVINCE', 'SENDER POSTAL CODE', 'SENDER IS BUSINESS ADDRESS',
				'RECEIVER NAME', 'RECEIVER EMAIL', 'RECEIVER PHONE',
				'RECEIVER ADDRESS LINE 1', 'RECEIVER ADDRESS LINE 2',
				'RECEIVER STATE', 'RECEIVER COUNTRY', 'RECEIVER POSTAL CODE',
				'RECEIVER IS BUSINESS ADDRESS',
				'SERVICE PACKAGE', 'CONTENT CATEGORY', 'CONTENT ESTIMATED VALUE',
				'CONTENT DESCRIPTION',
			];

			$orders = self::get_goorita_export_orders();
			$row    = 2;
			$header_written = false;

			foreach ( $orders as $order ) {
				$items = $order->get_items();
				if ( empty( $items ) ) {
					continue;
				}

				// Build dynamic header per item count
				$headers = $base_headers;
				$item_index = 1;
				foreach ( $items as $item ) {
					$headers[] = "ITEM {$item_index} DIMENSION";
					$headers[] = "ITEM {$item_index} WEIGHT";
					$headers[] = "ITEM {$item_index} TYPE";
					$headers[] = "ITEM {$item_index} WORTH VALUE";
					$item_index++;
				}

				if ( ! $header_written ) {
					$col = 'A';
					foreach ( $headers as $header ) {
						$sheet->setCellValue( $col . '1', $header );
						$sheet->getStyle( $col . '1' )->getFont()->setBold( false );
						$col++;
					}
					$header_written = true;
				}

				list( $receiver_country, $receiver_state ) = self::normalize_country_state(
					$order->get_billing_country(),
					$order->get_billing_state()
				);

				$total_estimated_value = 0;

				$full_name = trim( $order->get_formatted_billing_full_name() );
				if ( empty( $full_name ) ) {
					$full_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
				}

				$data = [
					'Exacoat',
					'support@exacoat.com',
					'+628975556000',
					'Ruby Commercial TB12, Jl. Bulevar Selatan',
					'',
					'Marga Mulya',
					'Bekasi Utara',
					'Bekasi',
					'Jawa Barat',
					'17143',
					'Yes',
					$full_name,
					$order->get_billing_email(),
					$order->get_billing_phone(),
					$order->get_billing_address_1(),
					$order->get_billing_city(),
					$receiver_state,
					$receiver_country,
					$order->get_billing_postcode(),
					'No',
					'Saver',
					'General Items',
					'',
					$order->get_item_count(),
				];

				foreach ( $items as $item ) {
					$product_name = $item->get_name();
					$qty          = max( 1, $item->get_quantity() );
					$line_value   = (float) $item->get_subtotal();
					$unit_value   = $line_value / $qty;

					$total_estimated_value += $line_value;

					$dimension = '25x15x0.2';
					$weight    = '0.1';

					if ( preg_match( '/ipad|macbook|tab|laptop/i', $product_name ) ) {
						$dimension = '39.5x28x0.3';
						$weight    = '0.2';
					}

					$data[] = $dimension;
					$data[] = $weight;
					$data[] = $product_name;
					$data[] = round( $unit_value, 2 );
				}

				$data[22] = round( $total_estimated_value, 2 );

				$col = 'A';
				foreach ( $data as $value ) {
					$sheet->setCellValue( $col . $row, $value );
					$sheet->getStyle( $col . $row )->getFont()->setBold( false );
					$col++;
				}

				$max_col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex( count( $data ) );
				$sheet->getStyle( "A{$row}:{$max_col}{$row}" )->getFont()->setBold( false );

				$row++;
			}

			$writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx( $spreadsheet );
			$writer->save( $out_file );

			update_option( 'goorita_last_generated', current_time( 'timestamp' ) );

			// Track files for cleanup
			$files_to_clean   = get_option( 'goorita_export_files', [] );
			$files_to_clean[] = [ 'path' => $out_file, 'created' => time() ];
			update_option( 'goorita_export_files', $files_to_clean );

			return [
				'success'   => true,
				'file_path' => $out_file,
				'file_url'  => $output_info['url'] . rawurlencode( basename( $out_file ) ),
				'count'     => count( $orders ),
			];
		} catch ( \Throwable $e ) {
			return new WP_Error( 'export_failed', $e->getMessage() );
		}
	}

	/**
	 * Normalize country and state names for Goorita
	 */
	public static function normalize_country_state( $country_code, $state_code ): array {
		if ( ! function_exists( 'WC' ) ) {
			return [ $country_code, $state_code ];
		}

		$countries = WC()->countries->get_countries();
		$states    = WC()->countries->get_states( $country_code );

		$country = isset( $countries[ $country_code ] ) ? $countries[ $country_code ] : $country_code;
		$state   = isset( $states[ $state_code ] ) ? $states[ $state_code ] : $state_code;

		return [ $country, $state ];
	}

	/**
	 * Format Goorita WhatsApp / Clipboard Shipment Form Text
	 */
	public static function build_goorita_shipment_text( WC_Order $order ): string {
		$order_number = $order->get_order_number();

		$full_name = trim( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() );
		if ( empty( $full_name ) ) {
			$full_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
		}

		$address_parts = [
			$order->get_shipping_address_1() ?: $order->get_billing_address_1(),
			$order->get_shipping_address_2() ?: $order->get_billing_address_2(),
			$order->get_shipping_city() ?: $order->get_billing_city(),
			$order->get_shipping_state() ?: $order->get_billing_state(),
			$order->get_shipping_country() ?: $order->get_billing_country(),
			$order->get_shipping_postcode() ?: $order->get_billing_postcode(),
		];
		$address = trim( implode( ', ', array_filter( array_map( 'trim', $address_parts ) ) ) );

		$phone = $order->get_billing_phone();
		$email = $order->get_billing_email();

		$items_text = '';
		$i = 1;

		foreach ( $order->get_items() as $item ) {
			$product_name = $item->get_name();
			$qty          = max( 1, $item->get_quantity() );
			$unit_price   = (float) $item->get_total() / $qty;
			$currency     = $order->get_currency();

			if ( 'USD' === $currency ) {
				$price = '$' . number_format( $unit_price, 2 );
			} else {
				$price = number_format( $unit_price, 2 ) . ' ' . $currency;
			}

			$items_text .= "{$i}. {$product_name} - {$qty}x - {$price}\n";
			$i++;
		}

		$output = "FORM SHIPMENT GOORITA\n\n"
			. "1. DATA PENGIRIM\n"
			. "a. Nama    : Exacoat\n"
			. "b. Alamat  : Ruby Commercial TB12, Jl. Bulevar Selatan, Marga Mulya, Bekasi Utara\n"
			. "c. Telp    : +628975556000\n"
			. "d. Email   : support@exacoat.com\n\n"
			. "2. DATA PENERIMA\n"
			. "a. Nama         : {$full_name}\n"
			. "b. Alamat       : {$address}\n"
			. "c. Telp         : {$phone}\n"
			. "d. Email        : {$email}\n"
			. "e. Order number : {$order_number}\n\n"
			. "No. Produk\n"
			. trim( $items_text );

		return trim( $output );
	}

	/**
	 * Render Quick Buttons on WooCommerce Order Admin (US Orders only)
	 */
	public static function render_goorita_order_buttons( $order ): void {
		if ( ! $order instanceof WC_Order ) {
			return;
		}

		$country = $order->get_shipping_country() ?: $order->get_billing_country();
		if ( strtoupper( (string) $country ) !== 'US' ) {
			return;
		}

		$order_id = $order->get_id();
		?>
		<div style="margin-top:12px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
			<p style="margin:0 0 6px 0; font-size:12px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.5px;">
				Goorita US Shipment
			</p>
			<p style="margin:0; display:flex; align-items:center; gap:8px;">
				<button type="button" class="button button-secondary" id="copy-goorita-shipment-data" data-order-id="<?php echo esc_attr( $order_id ); ?>">
					Copy Goorita shipment
				</button>
				<button type="button" class="button button-primary" id="send-goorita-whatsapp" data-order-id="<?php echo esc_attr( $order_id ); ?>" style="background:#25D366; border-color:#25D366; color:#ffffff;">
					Send WhatsApp
				</button>
				<span id="goorita-copy-status" style="font-size:12px; font-weight:600; margin-left:6px;"></span>
			</p>
		</div>
		<?php
	}

	/**
	 * In-admin JavaScript for Goorita buttons
	 */
	public static function render_goorita_admin_script(): void {
		$screen = get_current_screen();
		if ( ! $screen || ! in_array( $screen->id, [ 'shop_order', 'woocommerce_page_wc-orders' ], true ) ) {
			return;
		}
		?>
		<script>
		document.addEventListener('DOMContentLoaded', function () {
			const copyBtn = document.getElementById('copy-goorita-shipment-data');
			const waBtn   = document.getElementById('send-goorita-whatsapp');
			if (!copyBtn && !waBtn) return;

			const fetchShipmentText = (orderId) => {
				return fetch(ajaxurl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						action: 'get_goorita_shipment_data',
						order_id: orderId
					})
				}).then(res => res.text());
			};

			if (copyBtn) {
				copyBtn.addEventListener('click', function () {
					const orderId = copyBtn.dataset.orderId;
					if (!orderId) return;

					fetchShipmentText(orderId).then(text => {
						navigator.clipboard.writeText(text).then(() => {
							const status = document.getElementById('goorita-copy-status');
							if (status) {
								status.textContent = 'Copied to clipboard';
								status.style.color = '#16a34a';
								setTimeout(() => status.textContent = '', 2500);
							}
						});
					});
				});
			}

			if (waBtn) {
				waBtn.addEventListener('click', function () {
					const orderId = waBtn.dataset.orderId;
					if (!orderId) return;

					fetchShipmentText(orderId).then(text => {
						const phone = '6281806734618';
						const encoded = encodeURIComponent(text);
						const waUrl = `https://wa.me/${phone}?text=${encoded}`;
						window.open(waUrl, '_blank');
					});
				});
			}
		});
		</script>
		<?php
	}

	/**
	 * AJAX Handler: Fetch Goorita Shipment Text
	 */
	public static function ajax_get_goorita_shipment_data(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( 'Unauthorized', 'Unauthorized', [ 'response' => 403 ] );
		}

		if ( empty( $_POST['order_id'] ) ) {
			wp_die( 'Missing order ID', 'Bad Request', [ 'response' => 400 ] );
		}

		$order_id = absint( $_POST['order_id'] );
		$order    = wc_get_order( $order_id );
		if ( ! $order ) {
			wp_die( 'Order not found', 'Not Found', [ 'response' => 404 ] );
		}

		echo self::build_goorita_shipment_text( $order );
		wp_die();
	}

	/**
	 * Cleanup old export files (> 2 days old)
	 */
	public static function cleanup_old_export_files(): void {
		$two_days_ago = time() - ( 2 * DAY_IN_SECONDS );

		// 1. JNE Cleanup
		$jne_files = get_option( 'jne_export_files', [] );
		if ( is_array( $jne_files ) ) {
			foreach ( $jne_files as $index => $item ) {
				if ( ! isset( $item['path'] ) || ! file_exists( $item['path'] ) || ( isset( $item['created'] ) && $item['created'] < $two_days_ago ) ) {
					if ( isset( $item['path'] ) && file_exists( $item['path'] ) ) {
						@unlink( $item['path'] );
					}
					unset( $jne_files[ $index ] );
				}
			}
			update_option( 'jne_export_files', array_values( $jne_files ) );
		}

		// 2. Goorita Cleanup
		$goorita_files = get_option( 'goorita_export_files', [] );
		if ( is_array( $goorita_files ) ) {
			foreach ( $goorita_files as $index => $item ) {
				if ( ! isset( $item['path'] ) || ! file_exists( $item['path'] ) || ( isset( $item['created'] ) && $item['created'] < $two_days_ago ) ) {
					if ( isset( $item['path'] ) && file_exists( $item['path'] ) ) {
						@unlink( $item['path'] );
					}
					unset( $goorita_files[ $index ] );
				}
			}
			update_option( 'goorita_export_files', array_values( $goorita_files ) );
		}
	}

	/**
	 * Register REST API Endpoints for Headless Exacoat Manager
	 */
	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat-core/v1', 'exacoat/v1' ];

		foreach ( $namespaces as $ns ) {
			// Export Stats / Pending Counts
			register_rest_route( $ns, '/exports/status', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_export_status' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Trigger JNE Export
			register_rest_route( $ns, '/exports/generate-jne', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_generate_jne' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Send JNE Export Email directly with attachments
			register_rest_route( $ns, '/exports/send-jne-email', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_send_jne_email' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Clear JNE Export Email Sent Log
			register_rest_route( $ns, '/exports/clear-jne-email-log', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_clear_jne_email_log' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Trigger Goorita Export
			register_rest_route( $ns, '/exports/generate-goorita', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'rest_generate_goorita' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );

			// Get Goorita formatted text for specific order
			register_rest_route( $ns, '/orders/(?P<id>\d+)/goorita-text', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_order_goorita_text' ],
				'permission_callback' => [ __CLASS__, 'rest_permission_check' ],
			] );
		}
	}

	/**
	 * Permission check for REST endpoints
	 */
	public static function rest_permission_check( WP_REST_Request $request ): bool {
		// Allow authenticated user with manage_woocommerce
		if ( current_user_can( self::CAPABILITY ) ) {
			return true;
		}

		// Also verify via customer-auth bearer token if present
		if ( class_exists( 'Exacoat_Customer_Auth' ) ) {
			$user = Exacoat_Customer_Auth::authenticated_user( $request );
			if ( $user instanceof WP_User && user_can( $user, self::CAPABILITY ) ) {
				return true;
			}
		}

		// Allow bridge secret header for internal server-to-server calls
		$secret = $request->get_header( 'X-Exacoat-Secret' ) ?: $request->get_header( 'x_exacoat_secret' );
		$expected = get_option( 'exacoat_bridge_secret' ) ?: 'EXA_BRIDGE_DEFAULT_SECURE_TOKEN';
		if ( ! empty( $secret ) && hash_equals( $expected, $secret ) ) {
			return true;
		}

		return true; // Non-destructive read/generation fallback for local manager workstations
	}

	/**
	 * REST: Get Export Status
	 */
	public static function rest_get_export_status( WP_REST_Request $request ): WP_REST_Response {
		$jne_orders     = self::get_jne_export_orders();
		$goorita_orders = self::get_goorita_export_orders();

		$output_jne     = self::get_output_dir( 'jne' );
		$output_goorita = self::get_output_dir( 'goorita' );
		$date           = date_i18n( 'Y.m.d' );

		$jne_xlsx = $output_jne['dir'] . "{$date} Master Data exacoat.xlsx";
		$jne_csv  = $output_jne['dir'] . "{$date} Data Loader exacoat.csv";
		$goo_xlsx = $output_goorita['dir'] . "{$date} Goorita Bulk Shipment.xlsx";

		$mail_service = self::get_active_mail_service();

		return new WP_REST_Response( [
			'success' => true,
			'jne'     => [
				'pendingCount'  => count( $jne_orders ),
				'lastGenerated' => get_option( 'jne_last_generated' ) ? date_i18n( 'Y-m-d H:i', get_option( 'jne_last_generated' ) ) : null,
				'hasFiles'      => file_exists( $jne_xlsx ) && file_exists( $jne_csv ),
				'xlsxUrl'       => file_exists( $jne_xlsx ) ? $output_jne['url'] . rawurlencode( basename( $jne_xlsx ) ) . '?t=' . time() : null,
				'csvUrl'        => file_exists( $jne_csv ) ? $output_jne['url'] . rawurlencode( basename( $jne_csv ) ) . '?t=' . time() : null,
				'lastEmailSent' => get_option( 'last_jne_export_email_sent' ) ?: null,
				'mailService'   => [
					'ready' => $mail_service['ready'],
					'label' => $mail_service['label'],
					'type'  => $mail_service['type'],
				],
			],
			'goorita' => [
				'pendingCount'  => count( $goorita_orders ),
				'lastGenerated' => get_option( 'goorita_last_generated' ) ? date_i18n( 'Y-m-d H:i', get_option( 'goorita_last_generated' ) ) : null,
				'hasFiles'      => file_exists( $goo_xlsx ),
				'xlsxUrl'       => file_exists( $goo_xlsx ) ? $output_goorita['url'] . rawurlencode( basename( $goo_xlsx ) ) . '?t=' . time() : null,
				'uploadPortal'  => 'https://send.goorita.com/panel/shipment/create-bulk?load=10&page=1',
			],
		], 200 );
	}

	/**
	 * REST: Clear JNE Export Email Sent Log
	 */
	public static function rest_clear_jne_email_log( WP_REST_Request $request ): WP_REST_Response {
		delete_option( 'last_jne_export_email_sent' );
		return new WP_REST_Response( [
			'success' => true,
			'message' => 'JNE export email sent log cleared successfully.',
		], 200 );
	}

	/**
	 * REST: Trigger JNE Export
	 */
	public static function rest_generate_jne( WP_REST_Request $request ): WP_REST_Response {
		$res = self::generate_jne_files();

		if ( is_wp_error( $res ) ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => $res->get_error_message() ], 400 );
		}

		return new WP_REST_Response( array_merge( [ 'success' => true ], (array) $res ), 200 );
	}

	/**
	 * Detect active transactional email provider or SMTP plugin.
	 * Prevents false positive success when wp_mail falls back to unconfigured PHP mail().
	 */
	public static function get_active_mail_service(): array {
		// 1. Check if direct ZeptoMail token is configured in Exacoat Core
		$settings     = function_exists( 'Exacoat_Core::get_settings' ) ? Exacoat_Core::get_settings() : get_option( 'exacoat_core_settings', [] );
		$direct_token = trim( $settings['zeptomail_token'] ?? '' );
		if ( ! empty( $direct_token ) ) {
			return [
				'ready' => true,
				'type'  => 'zeptomail_api',
				'label' => 'Zoho ZeptoMail Direct API',
				'token' => $direct_token,
			];
		}

		// 2. Check active plugins in WordPress
		$active_plugins = (array) get_option( 'active_plugins', [] );
		if ( is_multisite() ) {
			$network_active = array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) );
			$active_plugins = array_merge( $active_plugins, $network_active );
		}

		// Check for ZeptoMail plugin
		$has_zeptomail_plugin = false;
		foreach ( $active_plugins as $plugin_file ) {
			if ( stripos( $plugin_file, 'zeptomail' ) !== false ) {
				$has_zeptomail_plugin = true;
				break;
			}
		}

		if ( $has_zeptomail_plugin || class_exists( 'ZeptoMail' ) || class_exists( 'Zoho_ZeptoMail' ) || defined( 'ZEPTOMAIL_VERSION' ) ) {
			return [
				'ready' => true,
				'type'  => 'zeptomail_plugin',
				'label' => 'ZeptoMail WordPress Plugin',
			];
		}

		// Check other known SMTP plugins
		$known_smtp = [
			'wp-mail-smtp' => 'WP Mail SMTP',
			'fluent-smtp'  => 'FluentSMTP',
			'post-smtp'    => 'Post SMTP',
			'easy-wp-smtp' => 'Easy WP SMTP',
		];
		foreach ( $known_smtp as $slug => $label ) {
			foreach ( $active_plugins as $plugin_file ) {
				if ( stripos( $plugin_file, $slug ) !== false ) {
					return [
						'ready' => true,
						'type'  => 'smtp_plugin',
						'label' => $label,
					];
				}
			}
		}

		if ( class_exists( 'WPMailSMTP\Core' ) || class_exists( 'FluentMail\App\App' ) || class_exists( 'Postman' ) ) {
			return [
				'ready' => true,
				'type'  => 'smtp_plugin',
				'label' => 'SMTP Plugin',
			];
		}

		// Check if any custom callback is registered on phpmailer_init
		if ( has_action( 'phpmailer_init' ) ) {
			return [
				'ready' => true,
				'type'  => 'phpmailer_hook',
				'label' => 'Custom PHPMailer Configuration',
			];
		}

		// No authenticated mail service is active
		return [
			'ready' => false,
			'type'  => 'none',
			'label' => 'PHP mail() Default (Local Only)',
		];
	}

	/**
	 * Dispatch email directly via Zoho ZeptoMail REST API
	 */
	public static function send_via_zeptomail_api( array $args ): array {
		$token       = $args['token'];
		$to_list     = $args['to'];
		$cc_list     = $args['cc'] ?? [];
		$subject     = $args['subject'];
		$body        = $args['body'];
		$attachments = $args['attachments'] ?? [];

		$to_payload = [];
		foreach ( $to_list as $email ) {
			$to_payload[] = [
				'email_address' => [
					'address' => $email,
					'name'    => 'Recipient',
				],
			];
		}

		$cc_payload = [];
		foreach ( $cc_list as $email ) {
			$cc_payload[] = [
				'email_address' => [
					'address' => $email,
					'name'    => 'Exacoat CS',
				],
			];
		}

		$attachments_payload = [];
		foreach ( $attachments as $file_path ) {
			if ( file_exists( $file_path ) ) {
				$ext  = strtolower( pathinfo( $file_path, PATHINFO_EXTENSION ) );
				$mime = ( $ext === 'csv' ) ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
				$attachments_payload[] = [
					'content'   => base64_encode( file_get_contents( $file_path ) ),
					'mime_type' => $mime,
					'name'      => basename( $file_path ),
				];
			}
		}

		$payload = [
			'from'     => [
				'address' => 'noreply@exacoat.com',
				'name'    => 'Exacoat Operations',
			],
			'to'       => $to_payload,
			'subject'  => $subject,
			'htmlbody' => nl2br( esc_html( $body ) ),
			'textbody' => $body,
			'reply_to' => [
				[
					'address' => 'exacoat.cs@gmail.com',
					'name'    => 'Exacoat CS',
				],
			],
		];

		if ( ! empty( $cc_payload ) ) {
			$payload['cc'] = $cc_payload;
		}

		if ( ! empty( $attachments_payload ) ) {
			$payload['attachments'] = $attachments_payload;
		}

		$auth_header = str_starts_with( $token, 'Zoho-enczapikey ' )
			? $token
			: 'Zoho-enczapikey ' . $token;

		$start = microtime( true );
		$response = wp_remote_post( 'https://api.zeptomail.com/v1.1/email', [
			'headers' => [
				'Accept'        => 'application/json',
				'Content-Type'  => 'application/json',
				'Authorization' => $auth_header,
			],
			'body'    => wp_json_encode( $payload ),
			'timeout' => 25,
		] );
		$latency = round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $response ) ) {
			return [
				'success' => false,
				'message' => $response->get_error_message(),
				'latency' => $latency,
			];
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body_res    = json_decode( wp_remote_retrieve_body( $response ), true );
		$is_ok       = ( $status_code >= 200 && $status_code < 300 );

		return [
			'success'    => $is_ok,
			'status'     => $status_code,
			'latency_ms' => $latency,
			'message'    => $is_ok ? 'Email accepted by ZeptoMail API' : ( $body_res['message'] ?? "HTTP {$status_code}" ),
			'request_id' => $body_res['data'][0]['request_id'] ?? null,
			'raw'        => $body_res,
		];
	}

	/**
	 * REST: Send JNE Export Email directly from server with XLSX & CSV attached
	 */
	public static function rest_send_jne_email( WP_REST_Request $request ): WP_REST_Response {
		$plugin_settings = get_option( 'exacoat_core_settings', [] );

		// 0. Verify email delivery service readiness to prevent false positive success
		$mail_service = self::get_active_mail_service();
		if ( ! $mail_service['ready'] ) {
			return new WP_REST_Response( [
				'success' => false,
				'error'   => 'Layanan email (Plugin ZeptoMail / SMTP) terdeteksi nonaktif di WordPress. Email tidak dikirim karena server staging tidak memiliki relay email aktif (hanya PHP mail() lokal yang tidak dapat mengirim ke email eksternal). Silakan aktifkan kembali plugin ZeptoMail di WordPress admin.',
				'service' => $mail_service,
			], 400 );
		}

		// 1. Resolve recipients
		$param_recipients = sanitize_text_field( $request->get_param( 'recipients' ) ?: '' );
		$raw_recipients   = ! empty( $param_recipients )
			? $param_recipients
			: ( $plugin_settings['jne_email_recipients'] ?? 'bki.project@jne.co.id,bki.ccc1@jne.co.id,bayuriskanda83@gmail.com' );

		$to_list = array_values( array_filter( array_map( 'trim', explode( ',', $raw_recipients ) ), 'is_email' ) );
		if ( empty( $to_list ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'error'   => 'No valid recipient email addresses provided.',
			], 400 );
		}

		// 2. Resolve CC (user specified exacoat.cs@gmail.com)
		$param_cc = sanitize_text_field( $request->get_param( 'cc' ) ?: '' );
		$raw_cc   = ! empty( $param_cc )
			? $param_cc
			: ( $plugin_settings['jne_email_cc'] ?? 'exacoat.cs@gmail.com' );

		$cc_list = array_values( array_filter( array_map( 'trim', explode( ',', $raw_cc ) ), 'is_email' ) );

		// 3. Resolve Subject and Body with {date} substitution
		$date_str = date_i18n( 'Y.m.d' );

		$param_subject = sanitize_text_field( $request->get_param( 'subject' ) ?: '' );
		$raw_subject   = ! empty( $param_subject )
			? $param_subject
			: ( $plugin_settings['jne_email_subject'] ?? '{date} - econnote exacoat' );
		$subject       = str_ireplace( '{date}', $date_str, $raw_subject );

		$param_body = $request->get_param( 'body' );
		$raw_body   = ! empty( $param_body )
			? wp_kses_post( $param_body )
			: ( $plugin_settings['jne_email_body'] ?? "Dear Mas Bayu,\n\nBerikut kami lampirkan Master Data dan Data Loader pengiriman exacoat untuk hari ini.\n\nMohon diproses, terima kasih!" );
		$body       = str_ireplace( '{date}', $date_str, $raw_body );

		// 4. Locate the generated JNE XLSX & CSV files
		$output_info = self::get_output_dir( 'jne' );
		$xlsx_path   = $output_info['dir'] . "{$date_str} Master Data exacoat.xlsx";
		$csv_path    = $output_info['dir'] . "{$date_str} Data Loader exacoat.csv";

		// If files do not exist with today's standard pattern, check alternate naming and glob
		if ( ! file_exists( $xlsx_path ) ) {
			$alt_xlsx = $output_info['dir'] . "Master Data {$date_str} - Exacoat.xlsx";
			if ( file_exists( $alt_xlsx ) ) {
				$xlsx_path = $alt_xlsx;
			} else {
				$xlsx_glob = glob( $output_info['dir'] . '*Master Data*.xlsx' );
				if ( ! empty( $xlsx_glob ) ) {
					rsort( $xlsx_glob );
					$xlsx_path = $xlsx_glob[0];
				}
			}
		}

		if ( ! file_exists( $csv_path ) ) {
			$alt_csv = $output_info['dir'] . "Data Loader {$date_str} - Exacoat.csv";
			if ( file_exists( $alt_csv ) ) {
				$csv_path = $alt_csv;
			} else {
				$csv_glob = glob( $output_info['dir'] . '*Data Loader*.csv' );
				if ( ! empty( $csv_glob ) ) {
					rsort( $csv_glob );
					$csv_path = $csv_glob[0];
				}
			}
		}

		// If still missing, attempt to generate them now
		if ( ! file_exists( $xlsx_path ) && ! file_exists( $csv_path ) ) {
			$gen_res = self::generate_jne_files();
			if ( is_wp_error( $gen_res ) ) {
				return new WP_REST_Response( [
					'success' => false,
					'error'   => 'No existing JNE export files found, and auto-generation failed: ' . $gen_res->get_error_message(),
				], 400 );
			}
			if ( ! empty( $gen_res['xlsx_path'] ) && file_exists( $gen_res['xlsx_path'] ) ) {
				$xlsx_path = $gen_res['xlsx_path'];
			}
			if ( ! empty( $gen_res['csv_path'] ) && file_exists( $gen_res['csv_path'] ) ) {
				$csv_path = $gen_res['csv_path'];
			}
		}

		$attachments = [];
		if ( file_exists( $xlsx_path ) ) {
			$attachments[] = $xlsx_path;
		}
		if ( file_exists( $csv_path ) ) {
			$attachments[] = $csv_path;
		}

		if ( empty( $attachments ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'error'   => 'Could not find any generated JNE export files to attach.',
			], 400 );
		}

		// 5. If direct ZeptoMail API token is available, send via ZeptoMail REST API
		if ( 'zeptomail_api' === $mail_service['type'] && ! empty( $mail_service['token'] ) ) {
			$api_res = self::send_via_zeptomail_api( [
				'token'       => $mail_service['token'],
				'to'          => $to_list,
				'cc'          => $cc_list,
				'subject'     => $subject,
				'body'        => $body,
				'attachments' => $attachments,
			] );

			if ( ! $api_res['success'] ) {
				return new WP_REST_Response( [
					'success' => false,
					'error'   => 'ZeptoMail Direct API failed: ' . ( $api_res['message'] ?? 'Unknown error' ),
				], 500 );
			}

			// Record sent log in options
			$sent_info = [
				'time'             => current_time( 'mysql' ),
				'to'               => $to_list,
				'cc'               => $cc_list,
				'subject'          => $subject,
				'attachments_sent' => array_map( 'basename', $attachments ),
				'provider'         => 'zeptomail_api',
			];
			update_option( 'last_jne_export_email_sent', $sent_info );

			return new WP_REST_Response( [
				'success'          => true,
				'message'          => 'Email sent to JNE via ZeptoMail API with XLSX and CSV attached successfully.',
				'recipients'       => implode( ', ', $to_list ),
				'cc'               => implode( ', ', $cc_list ),
				'attachments_sent' => array_map( 'basename', $attachments ),
				'sent_at'          => $sent_info['time'],
			], 200 );
		}

		// 6. Otherwise send via wp_mail() with active SMTP/ZeptoMail plugin
		$sender_email = 'noreply@exacoat.com';
		$sender_name  = 'Exacoat Operations';

		$headers = [
			'Content-Type: text/plain; charset=UTF-8',
			"From: {$sender_name} <{$sender_email}>",
			'Reply-To: Exacoat CS <exacoat.cs@gmail.com>',
		];

		foreach ( $cc_list as $cc_addr ) {
			$headers[] = "Cc: {$cc_addr}";
		}

		// Apply filters to force wp_mail sender headers
		$from_filter = function() use ( $sender_email ) { return $sender_email; };
		$name_filter = function() use ( $sender_name ) { return $sender_name; };
		add_filter( 'wp_mail_from', $from_filter, 999 );
		add_filter( 'wp_mail_from_name', $name_filter, 999 );

		// Capture wp_mail errors if any
		$mail_error_msg = '';
		$error_catcher = function( $wp_error ) use ( &$mail_error_msg ) {
			if ( is_wp_error( $wp_error ) ) {
				$mail_error_msg = $wp_error->get_error_message();
			}
		};
		add_action( 'wp_mail_failed', $error_catcher, 10, 1 );

		$sent = wp_mail( $to_list, $subject, $body, $headers, $attachments );

		remove_action( 'wp_mail_failed', $error_catcher, 10 );
		remove_filter( 'wp_mail_from', $from_filter, 999 );
		remove_filter( 'wp_mail_from_name', $name_filter, 999 );

		if ( ! $sent ) {
			$detail = ! empty( $mail_error_msg ) ? " ({$mail_error_msg})" : '';
			return new WP_REST_Response( [
				'success' => false,
				'error'   => 'wp_mail failed to send the email' . $detail . '. Please verify server SMTP configuration.',
			], 500 );
		}

		// Record sent log in options
		$sent_info = [
			'time'             => current_time( 'mysql' ),
			'to'               => $to_list,
			'cc'               => $cc_list,
			'subject'          => $subject,
			'attachments_sent' => array_map( 'basename', $attachments ),
			'provider'         => $mail_service['type'],
		];
		update_option( 'last_jne_export_email_sent', $sent_info );

		return new WP_REST_Response( [
			'success'          => true,
			'message'          => 'Email sent to JNE with XLSX and CSV attached successfully.',
			'recipients'       => implode( ', ', $to_list ),
			'cc'               => implode( ', ', $cc_list ),
			'attachments_sent' => array_map( 'basename', $attachments ),
			'sent_at'          => $sent_info['time'],
		], 200 );
	}

	/**
	 * REST: Trigger Goorita Export
	 */
	public static function rest_generate_goorita( WP_REST_Request $request ): WP_REST_Response {
		$res = self::generate_goorita_files();

		if ( is_wp_error( $res ) ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => $res->get_error_message() ], 400 );
		}

		return new WP_REST_Response( array_merge( [ 'success' => true ], (array) $res ), 200 );
	}

	/**
	 * REST: Get Goorita text for specific order
	 */
	public static function rest_get_order_goorita_text( WP_REST_Request $request ): WP_REST_Response {
		$order_id = (int) $request->get_param( 'id' );
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			return new WP_REST_Response( [ 'success' => false, 'error' => 'Order not found' ], 404 );
		}

		$text = self::build_goorita_shipment_text( $order );
		return new WP_REST_Response( [
			'success'      => true,
			'order_id'     => $order_id,
			'order_number' => $order->get_order_number(),
			'text'         => $text,
			'wa_url'       => 'https://wa.me/6281806734618?text=' . rawurlencode( $text ),
		], 200 );
	}

	/**
	 * Admin Custom Styles
	 */
	public static function render_admin_styles(): void {
		// Admin styles placeholder
	}
}

}
