<?php
/**
 * Shipping & Biteship Tracker Module
 * Consolidates Snippets: #6902, #13537, #13600, #14577
 * Dynamic Registry for Logistics Carriers & Tracking URLs
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Shipping_Tracker' ) ) {

class Exacoat_Shipping_Tracker {

	private static $old_tracking_state = [];

	public static function init() {
		// 1. Order Notes on tracking number update & Universal Auto-Register with TrackingMore (HPOS + CPT + ACF)
		add_action( 'woocommerce_process_shop_order_meta', [ __CLASS__, 'handle_order_save' ], 25, 2 );
		add_action( 'woocommerce_update_order', [ __CLASS__, 'handle_order_save' ], 25, 1 );
		add_action( 'save_post_shop_order', [ __CLASS__, 'handle_order_save' ], 25, 1 );
		add_action( 'save_post', [ __CLASS__, 'handle_order_save' ], 25, 1 );
		add_action( 'acf/save_post', [ __CLASS__, 'handle_acf_save' ], 25, 1 );
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'handle_status_change' ], 25, 4 );

		// 2. Admin Meta Box for WooCommerce Orders (HPOS & Classic CPT)
		add_action( 'add_meta_boxes', [ __CLASS__, 'register_admin_meta_boxes' ] );

		// 3. Inject tracking info into customer completed order email (#13537)
		add_action( 'woocommerce_email_before_order_table', [ __CLASS__, 'render_email_tracking_info' ], 20, 4 );

		// 4. Dynamically populate ACF carrier_id field choices
		add_filter( 'acf/load_field/name=carrier_id', [ __CLASS__, 'populate_acf_carrier_choices' ] );

		// 5. Register Tracking Webhook REST Routes (TrackingMore + 17TRACK alias)
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );

		// 6. Public Tracking Shortcodes: [artmatter_order_tracking], [artmatter_track_order]
		add_shortcode( 'artmatter_order_tracking', [ __CLASS__, 'render_tracking_shortcode' ] );
		add_shortcode( 'artmatter_track_order', [ __CLASS__, 'render_tracking_shortcode' ] );

		// 7. AJAX Handlers for TrackingMore Admin Diagnostics, Admin Sync, & Live Customer Refresh
		add_action( 'wp_ajax_artmatter_test_trackingmore_connection', [ __CLASS__, 'ajax_test_trackingmore_connection' ] );
		add_action( 'wp_ajax_artmatter_test_17track_connection', [ __CLASS__, 'ajax_test_trackingmore_connection' ] );
		add_action( 'wp_ajax_artmatter_admin_sync_trackingmore', [ __CLASS__, 'ajax_admin_sync_trackingmore' ] );
		add_action( 'wp_ajax_artmatter_admin_sync_17track', [ __CLASS__, 'ajax_admin_sync_trackingmore' ] );
		add_action( 'wp_ajax_artmatter_refresh_order_tracking', [ __CLASS__, 'ajax_refresh_order_tracking' ] );
		add_action( 'wp_ajax_nopriv_artmatter_refresh_order_tracking', [ __CLASS__, 'ajax_refresh_order_tracking' ] );

		// 8. Automated Shipping Sync Cron for Active Domestic & International Orders (Every 6 Hours to conserve Biteship tokens)
		add_filter( 'cron_schedules', [ __CLASS__, 'register_cron_intervals' ] );
		add_action( 'exacoat_shipping_sync_cron', [ __CLASS__, 'cron_sync_active_shipments' ] );
		add_action( 'exacoat_hourly_shipping_sync', [ __CLASS__, 'cron_sync_active_shipments' ] );
		add_action( 'artmatter_hourly_shipping_sync', [ __CLASS__, 'cron_sync_active_shipments' ] );
		if ( ! wp_next_scheduled( 'exacoat_shipping_sync_cron' ) ) {
			wp_schedule_event( time() + 600, 'six_hours', 'exacoat_shipping_sync_cron' );
		}
	}

	/**
	 * Get Dynamic Carrier Registry
	 */
	public static function get_carrier_registry(): array {
		$settings = class_exists( 'Artmatter_Core' ) ? Artmatter_Core::get_settings() : [];
		$default_carriers = [
			'jne' => [
				'name' => 'JNE Express',
				'url'  => 'https://www.jne.co.id/',
			],
			'sicepat' => [
				'name' => 'SiCepat',
				'url'  => 'https://www.sicepat.com',
			],
			'pos' => [
				'name' => 'POS Indonesia',
				'url'  => 'https://www.posindonesia.co.id/en/tracking/?tracknumbers=%s',
			],
			'goorita' => [
				'name' => 'Goorita',
				'url'  => 'https://send.goorita.com/track',
			],
			'dhl' => [
				'name' => 'DHL Express',
				'url'  => 'https://www.dhl.com/en/express/tracking.html?AWB=%s',
			],
			'fedex' => [
				'name' => 'FedEx',
				'url'  => 'https://www.fedex.com/fedextrack/?trknbr=%s',
			],
			'biteship' => [
				'name' => 'Biteship / Default',
				'url'  => 'https://biteship.com/track/%s',
			],
		];

		$carriers = $settings['logistics_carriers'] ?? $default_carriers;
		if ( ! is_array( $carriers ) || empty( $carriers ) ) {
			$carriers = $default_carriers;
		}

		return $carriers;
	}

	/**
	 * Dynamically populate ACF choices for carrier_id
	 */
	public static function populate_acf_carrier_choices( $field ) {
		$carriers = self::get_carrier_registry();
		$field['choices'] = [];
		foreach ( $carriers as $key => $data ) {
			$field['choices'][ $key ] = $data['name'] ?? ucfirst( (string) $key );
		}
		return $field;
	}

	/**
	 * Construct carrier tracking URL with placeholder replacement
	 */
	public static function get_carrier_tracking_url( $carrier, $tracking_number ): string {
		if ( empty( $carrier ) || empty( $tracking_number ) ) {
			return '';
		}

		$raw_tracking    = trim( (string) $tracking_number );
		$tracking_number = rawurlencode( $raw_tracking );
		$carrier_key     = strtolower( trim( (string) $carrier ) );

		$carriers = self::get_carrier_registry();

		if ( isset( $carriers[ $carrier_key ]['url'] ) && ! empty( $carriers[ $carrier_key ]['url'] ) ) {
			$template = $carriers[ $carrier_key ]['url'];
			return strpos( $template, '%s' ) !== false ? sprintf( $template, $tracking_number ) : $template;
		}

		// Fallback to TrackingMore official tracking portal
		return sprintf( 'https://www.trackingmore.com/track/en/%s', $tracking_number );
	}

	public static function capture_old_tracking( $post_id ) {
		// Preserved for backward compatibility with older hooks
	}

	public static function log_tracking_changes( $post_id ) {
		self::handle_order_save( $post_id );
	}

	public static function handle_acf_save( $post_id ) {
		if ( is_string( $post_id ) && strpos( $post_id, 'post_' ) === 0 ) {
			$post_id = (int) substr( $post_id, 5 );
		}
		if ( is_numeric( $post_id ) && (int) $post_id > 0 ) {
			self::handle_order_save( (int) $post_id );
		}
	}

	public static function handle_status_change( $order_id, $from = '', $to = '', $order = null ) {
		if ( is_numeric( $order_id ) && (int) $order_id > 0 ) {
			self::handle_order_save( (int) $order_id );
		}
	}

	/**
	 * Universal Order Save Handler: HPOS, CPT, ACF & Standard WooCommerce Order Admin
	 */
	public static function handle_order_save( $order_id ) {
		static $processing_orders = [];

		if ( ! is_numeric( $order_id ) || (int) $order_id <= 0 ) {
			return;
		}
		$order_id = (int) $order_id;

		if ( isset( $processing_orders[ $order_id ] ) ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$processing_orders[ $order_id ] = true;

		// 1. Resolve Tracking Number from all potential sources (POST, HPOS meta, Postmeta, ACF, Tracking Info)
		$tracking_number = '';
		if ( isset( $_POST['tracking_number'] ) && is_string( $_POST['tracking_number'] ) ) {
			$tracking_number = sanitize_text_field( wp_unslash( $_POST['tracking_number'] ) );
		} elseif ( isset( $_POST['_tracking_number'] ) && is_string( $_POST['_tracking_number'] ) ) {
			$tracking_number = sanitize_text_field( wp_unslash( $_POST['_tracking_number'] ) );
		} elseif ( isset( $_POST['_artmatter_tracking_number'] ) && is_string( $_POST['_artmatter_tracking_number'] ) ) {
			$tracking_number = sanitize_text_field( wp_unslash( $_POST['_artmatter_tracking_number'] ) );
		}

		if ( empty( $tracking_number ) ) {
			$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) 
				?: ( $order->get_meta( '_tracking_number' ) 
				?: ( $order->get_meta( '_artmatter_tracking_number' ) 
				?: ( get_post_meta( $order_id, 'tracking_number', true ) 
				?: ( get_post_meta( $order_id, '_tracking_number', true ) 
				?: ( function_exists( 'get_field' ) ? (string) get_field( 'tracking_number', $order_id ) : '' ) ) ) ) ) );
		}

		if ( empty( $tracking_number ) ) {
			$t_info = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order_id, '_artmatter_tracking_info', true );
			if ( is_array( $t_info ) && ! empty( $t_info['tracking_number'] ) ) {
				$tracking_number = (string) $t_info['tracking_number'];
			}
		}

		$tracking_number = trim( $tracking_number );

		// 2. Resolve Carrier
		$carrier = '';
		if ( isset( $_POST['carrier_id'] ) && is_string( $_POST['carrier_id'] ) ) {
			$carrier = sanitize_text_field( wp_unslash( $_POST['carrier_id'] ) );
		} elseif ( isset( $_POST['_carrier_id'] ) && is_string( $_POST['_carrier_id'] ) ) {
			$carrier = sanitize_text_field( wp_unslash( $_POST['_carrier_id'] ) );
		}

		if ( empty( $carrier ) ) {
			$carrier = (string) ( $order->get_meta( 'carrier_id' ) 
				?: ( $order->get_meta( '_carrier_id' ) 
				?: ( get_post_meta( $order_id, 'carrier_id', true ) 
				?: ( function_exists( 'get_field' ) ? (string) get_field( 'carrier_id', $order_id ) : '' ) ) ) );
		}

		if ( empty( $carrier ) && ! empty( $t_info['carrier_id'] ) ) {
			$carrier = (string) $t_info['carrier_id'];
		}

		$carrier = trim( strtolower( $carrier ) );

		// 3. Compare with previously registered tracking number
		$prev_registered = (string) ( $order->get_meta( '_artmatter_trackingmore_registered_number' ) 
			?: ( $order->get_meta( '_artmatter_17track_registered_number' ) 
			?: ( get_post_meta( $order_id, '_artmatter_trackingmore_registered_number', true ) 
			?: ( get_post_meta( $order_id, '_artmatter_17track_registered_number', true ) ?: '' ) ) ) );

		if ( ! empty( $tracking_number ) ) {
			// Ensure consistent metadata across HPOS and postmeta
			$order->update_meta_data( 'tracking_number', $tracking_number );
			$order->update_meta_data( '_tracking_number', $tracking_number );
			$order->update_meta_data( '_artmatter_tracking_number', $tracking_number );
			if ( ! empty( $carrier ) ) {
				$order->update_meta_data( 'carrier_id', $carrier );
				$order->update_meta_data( '_carrier_id', $carrier );
			}
			$order->save();

			update_post_meta( $order_id, 'tracking_number', $tracking_number );
			update_post_meta( $order_id, '_tracking_number', $tracking_number );
			update_post_meta( $order_id, '_artmatter_tracking_number', $tracking_number );
			if ( ! empty( $carrier ) ) {
				update_post_meta( $order_id, 'carrier_id', $carrier );
				update_post_meta( $order_id, '_carrier_id', $carrier );
			}

			// If tracking number changed or has not been registered yet
			if ( $prev_registered !== $tracking_number ) {
				$carriers = self::get_carrier_registry();
				$carrier_label = $carriers[ $carrier ]['name'] ?? ( ! empty( $carrier ) ? ucfirst( $carrier ) : 'Auto-Detect' );

				$note_action = empty( $prev_registered ) ? 'added' : 'updated';
				$order->add_order_note( sprintf( 'Shipping: Tracking %s <strong>%s</strong> (%s)', esc_html( $note_action ), esc_html( $tracking_number ), esc_html( $carrier_label ) ) );

				// Register with TrackingMore
				$reg_result = self::register_with_trackingmore( $tracking_number, $carrier, $order_id );
				if ( ! empty( $reg_result['success'] ) ) {
					$order->update_meta_data( '_artmatter_trackingmore_registered_number', $tracking_number );
					$order->update_meta_data( '_artmatter_trackingmore_registered', 1 );
					$order->update_meta_data( '_artmatter_17track_registered_number', $tracking_number );
					$order->update_meta_data( '_artmatter_17track_registered', 1 );
					$order->save();
					update_post_meta( $order_id, '_artmatter_trackingmore_registered_number', $tracking_number );
					update_post_meta( $order_id, '_artmatter_trackingmore_registered', 1 );
					update_post_meta( $order_id, '_artmatter_17track_registered_number', $tracking_number );
					update_post_meta( $order_id, '_artmatter_17track_registered', 1 );

					// Trigger initial sync for live checkpoints
					self::sync_order_tracking( $order_id );
				}
			}
		} elseif ( ! empty( $prev_registered ) && empty( $tracking_number ) ) {
			$order->add_order_note( 'Shipping: Tracking number removed.' );
			$order->delete_meta_data( '_artmatter_trackingmore_registered_number' );
			$order->delete_meta_data( '_artmatter_trackingmore_registered' );
			$order->delete_meta_data( '_artmatter_17track_registered_number' );
			$order->delete_meta_data( '_artmatter_17track_registered' );
			$order->save();
			delete_post_meta( $order_id, '_artmatter_trackingmore_registered_number' );
			delete_post_meta( $order_id, '_artmatter_trackingmore_registered' );
			delete_post_meta( $order_id, '_artmatter_17track_registered_number' );
			delete_post_meta( $order_id, '_artmatter_17track_registered' );
		}

		unset( $processing_orders[ $order_id ] );
	}

	public static function render_email_tracking_info( $order, $sent_to_admin, $plain_text, $email ) {
		if ( ! $order instanceof WC_Order ) return;
		if ( is_object( $email ) && isset( $email->id ) && 'customer_completed_order' !== $email->id ) {
			return;
		}

		$order_id        = $order->get_id();
		$carrier_value   = (string) ( $order->get_meta( 'carrier_id' ) ?: ( get_post_meta( $order_id, 'carrier_id', true ) ?: ( function_exists( 'get_field' ) ? get_field( 'carrier_id', $order_id ) : '' ) ) );
		$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) ?: ( get_post_meta( $order_id, 'tracking_number', true ) ?: ( function_exists( 'get_field' ) ? get_field( 'tracking_number', $order_id ) : '' ) ) );

		if ( empty( $carrier_value ) || empty( $tracking_number ) ) return;

		// Link directly to Exacoat storefront tracking page (/track)
		$billing_email = $order->get_billing_email();
		$track_base    = function_exists( 'exacoat_storefront_url' ) ? exacoat_storefront_url( 'track' ) : home_url( '/track' );
		$tracking_url  = add_query_arg( [
			'order_id'    => $order->get_order_number(),
			'order_email' => $billing_email,
			'key'         => $order->get_order_key(),
		], $track_base );

		$carriers = self::get_carrier_registry();
		$carrier_label = $carriers[ $carrier_value ]['name'] ?? ucfirst( (string) $carrier_value );
		?>
		<div style="margin-bottom: 24px; padding: 16px; font-family: 'Neue Haas Display', 'Neue Haas Grotesk Text Pro', inherit, sans-serif; color: #000000; background-color: #f4f4f5; border-radius: 12px; border: 1px solid #e4e4e7;">
			<table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation">
				<tr>
					<td align="left" valign="middle">
						<p style="margin: 0; font-size: 13px; color: #71717a; font-weight: 500;">
							Shipped via <?php echo esc_html( $carrier_label ); ?>
						</p>
						<p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #09090b; letter-spacing: 0.3px; font-family: monospace;">
							<?php echo esc_html( $tracking_number ); ?>
						</p>
					</td>
					<?php if ( ! empty( $tracking_url ) ) : ?>
					<td align="right" valign="middle">
						<a href="<?php echo esc_url( $tracking_url ); ?>" target="_blank" style="font-size: 13px; color: #ffffff; font-weight: 700; white-space: nowrap; padding: 10px 22px; border-radius: 8px; background-color: #18181b; text-decoration: none; display: inline-block;">
							Track Package &rarr;
						</a>
					</td>
					<?php endif; ?>
				</tr>
			</table>
		</div>
		<?php
	}

	/**
	 * Render Public Tracking Page Shortcode: [artmatter_order_tracking] / [artmatter_track_order]
	 * Allows customers to look up tracking by Order ID + Billing Email (or Key) without logging in
	 */
	public static function render_tracking_shortcode( $atts = [] ) {
		ob_start();

		$order_id_input = isset( $_REQUEST['order_id'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['order_id'] ) ) : '';
		$order_id_input = ltrim( $order_id_input, '#' );
		$email_input    = isset( $_REQUEST['order_email'] ) ? sanitize_email( wp_unslash( $_REQUEST['order_email'] ) ) : ( isset( $_REQUEST['email'] ) ? sanitize_email( wp_unslash( $_REQUEST['email'] ) ) : '' );
		$order_key      = isset( $_REQUEST['key'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['key'] ) ) : '';

		$order = null;
		$error_msg = '';

		if ( ! empty( $order_id_input ) ) {
			$found_order = wc_get_order( (int) $order_id_input );
			if ( $found_order ) {
				$matched = false;
				if ( ! empty( $order_key ) && hash_equals( (string) $found_order->get_order_key(), $order_key ) ) {
					$matched = true;
				} elseif ( ! empty( $email_input ) && strcasecmp( trim( (string) $found_order->get_billing_email() ), trim( $email_input ) ) === 0 ) {
					$matched = true;
				} elseif ( current_user_can( 'manage_woocommerce' ) ) {
					$matched = true;
				}

				if ( $matched ) {
					$order = $found_order;
				} else {
					$error_msg = __( 'Order details could not be found with the email provided.', 'artmatter-core' );
				}
			} else {
				$error_msg = __( 'No order found with that number.', 'artmatter-core' );
			}
		}

		if ( wp_style_is( 'artmatter-reviews', 'registered' ) ) {
			wp_enqueue_style( 'artmatter-reviews' );
		}

		if ( $order && class_exists( 'Artmatter_Order_Manager' ) ) {
			echo '<div class="artmatter-track-form-container artmatter-review-form-container" style="max-width:820px;">';
			echo '<div class="artmatter-public-tracker">';
			Artmatter_Order_Manager::render_order_details_timeline( $order );
			echo '</div>';
			echo '</div>';
		} else {
			?>
			<div class="artmatter-track-form-container artmatter-review-form-container" style="max-width:580px;">
				<div class="artmatter-review-form-card artmatter-review-gate-card artmatter-order-lookup-card">
					<span class="artmatter-badge-pill"><?php esc_html_e( 'Exacoat Logistics', 'exacoat-core' ); ?></span>
					<h2 class="artmatter-form-heading"><?php esc_html_e( 'Track Your Order', 'exacoat-core' ); ?></h2>
					<p class="artmatter-form-subheading">
						<?php esc_html_e( 'Enter your order number and billing email to view live fulfillment and courier status.', 'exacoat-core' ); ?>
					</p>

					<?php if ( ! empty( $error_msg ) ) : ?>
						<div class="artmatter-form-feedback is-error" style="display:block; margin-bottom:20px;">
							<?php echo esc_html( $error_msg ); ?>
						</div>
					<?php endif; ?>

					<form method="GET" action="" class="artmatter-lookup-form">
						<div class="artmatter-form-group">
							<label class="artmatter-label" for="track_order_id"><?php esc_html_e( 'Order Number', 'artmatter-core' ); ?></label>
							<input type="text" id="track_order_id" name="order_id" value="<?php echo esc_attr( $order_id_input ); ?>" placeholder="e.g. 18516" class="artmatter-input" required />
						</div>
						<div class="artmatter-form-group">
							<label class="artmatter-label" for="track_order_email"><?php esc_html_e( 'Billing Email', 'artmatter-core' ); ?></label>
							<input type="email" id="track_order_email" name="order_email" value="<?php echo esc_attr( $email_input ); ?>" placeholder="e.g. customer@example.com" class="artmatter-input" required />
						</div>
						<div class="artmatter-form-actions" style="margin-top:24px;">
							<button type="submit" class="artmatter-btn-primary" style="width:100%; height:46px; justify-content:center; font-size:14.5px;">
								<span><?php esc_html_e( 'Track Shipment', 'artmatter-core' ); ?></span>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
							</button>
						</div>
					</form>
				</div>
			</div>
			<?php
		}

		return ob_get_clean();
	}

	/**
	 * Get Biteship API Secret Key with dynamic multi-source fallback
	 */
	public static function get_biteship_api_key(): string {
		$key = '';

		// 1. Check Biteship Shipping Method instance if active
		if ( class_exists( 'Exacoat_Biteship_Engine' ) && method_exists( 'Exacoat_Biteship_Engine', 'get_api_key' ) ) {
			$key = Exacoat_Biteship_Engine::get_api_key();
		}

		// 2. Check Plugin Settings
		if ( empty( $key ) && class_exists( 'Artmatter_Core' ) ) {
			$settings = Artmatter_Core::get_settings();
			$key = trim( (string) ( $settings['biteship_api_key'] ?? '' ) );
		}

		// 3. Check PHP Constant
		if ( empty( $key ) && defined( 'BITESHIP_API_KEY' ) ) {
			$key = trim( (string) BITESHIP_API_KEY );
		}

		// 4. Check wp_options for woocommerce_biteship_shipping_%_settings
		if ( empty( $key ) ) {
			global $wpdb;
			if ( ! empty( $wpdb ) && is_object( $wpdb ) && ! empty( $wpdb->options ) ) {
				$opt_val = $wpdb->get_var( "SELECT option_value FROM {$wpdb->options} WHERE option_name LIKE 'woocommerce_biteship_shipping_%_settings' ORDER BY option_id DESC LIMIT 1" );
				if ( ! empty( $opt_val ) ) {
					$parsed = maybe_unserialize( $opt_val );
					if ( is_array( $parsed ) && ! empty( $parsed['api_key'] ) ) {
						$key = trim( (string) $parsed['api_key'] );
					}
				}
			}
		}

		// Guard: If the key is only 24 hex characters (Biteship token ID, e.g. 68cfd6c09b89f1001134ffa2) without JWT signature,
		// or if key is empty, fallback to the validated production live token.
		if ( empty( $key ) || ( strlen( $key ) === 24 && ctype_xdigit( $key ) ) || strpos( $key, 'biteship_live.' ) === false ) {
			$fallback = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRXhhY29hdCIsInVzZXJJZCI6IjY2ZDM1NmE0OWEyOGQzMDAxMjUyN2Q1NCIsImlhdCI6MTc1ODQ1MTM5Mn0.zAWrMuQusXZc8_V0AyJCRO09Yig4n9uUjqza4E5lXag';
			if ( empty( $key ) || ( strlen( $key ) === 24 && ctype_xdigit( $key ) ) ) {
				return $fallback;
			}
		}

		return $key;
	}

	/**
	 * Map internal carrier slug to Biteship official courier code
	 */
	public static function get_biteship_courier_code( string $carrier ): string {
		$carrier = strtolower( trim( $carrier ) );
		$map = [
			'jne'           => 'jne',
			'jne express'   => 'jne',
			'sicepat'       => 'sicepat',
			'pos'           => 'pos',
			'pos indonesia' => 'pos',
			'posindonesia'  => 'pos',
			'pos-indonesia' => 'pos',
			'jnt'           => 'jnt',
			'j&t'           => 'jnt',
			'j&t express'   => 'jnt',
			'anteraja'      => 'anteraja',
			'tiki'          => 'tiki',
			'wahana'        => 'wahana',
			'lion'          => 'lion',
			'lion parcel'   => 'lion',
			'ninja'         => 'ninja',
			'ninja van'     => 'ninja',
		];
		return $map[ $carrier ] ?? '';
	}

	/**
	 * Get TrackingMore API Key
	 */
	public static function get_trackingmore_api_key(): string {
		$key = '';
		if ( class_exists( 'Artmatter_Core' ) ) {
			$settings = Artmatter_Core::get_settings();
			$key = trim( $settings['trackingmore_api_key'] ?? ( $settings['17track_api_key'] ?? '' ) );
		}
		return ! empty( $key ) ? $key : 'bkows1gc-6uu5-si5b-f4st-bqvk3lae9u5c';
	}

	/**
	 * Backward compatibility alias for 17TRACK API key
	 */
	public static function get_17track_api_key(): string {
		return self::get_trackingmore_api_key();
	}

	/**
	 * Map Internal Carrier Slugs to TrackingMore Official Courier Codes
	 */
	public static function get_trackingmore_carrier_code( string $carrier_id, string $tracking_number = '' ): string {
		$carrier_map = [
			'jne'                 => 'jne',
			'jne express'         => 'jne',
			'sicepat'             => 'sicepat',
			'pos'                 => 'indonesia-post',
			'pos indonesia'       => 'indonesia-post',
			'posindonesia'        => 'indonesia-post',
			'pos-indonesia'       => 'indonesia-post',
			'goorita'             => 'indonesia-post',
			'jnt'                 => 'j-and-t-express',
			'j&t'                 => 'j-and-t-express',
			'j&t express'         => 'j-and-t-express',
			'lion'                => 'lion-parcel',
			'lion parcel'         => 'lion-parcel',
			'dhl'                 => 'dhl',
			'dhl express'         => 'dhl',
			'fedex'               => 'fedex',
			'fedex international' => 'fedex',
			'anteraja'            => 'anteraja',
			'tiki'                => 'tiki',
			'ninja'               => 'ninja-van-id',
			'ninjavan'            => 'ninja-van-id',
			'usps'                => 'usps',
			'ups'                 => 'ups',
		];
		$key = strtolower( trim( $carrier_id ) );
		if ( isset( $carrier_map[ $key ] ) ) {
			return $carrier_map[ $key ];
		}
		if ( ! empty( $tracking_number ) ) {
			$detected = self::detect_trackingmore_courier( $tracking_number );
			if ( ! empty( $detected ) ) {
				return $detected;
			}
		}
		return '';
	}

	/**
	 * Auto-detect courier using TrackingMore API
	 */
	public static function detect_trackingmore_courier( string $tracking_number ): string {
		$tracking_number = trim( $tracking_number );
		if ( empty( $tracking_number ) ) {
			return '';
		}
		$api_key = self::get_trackingmore_api_key();
		if ( empty( $api_key ) ) {
			return '';
		}

		$response = wp_remote_post( 'https://api.trackingmore.com/v4/couriers/detect', [
			'headers'     => [
				'Tracking-Api-Key' => $api_key,
				'Content-Type'     => 'application/json',
			],
			'body'        => wp_json_encode( [ 'tracking_number' => $tracking_number ] ),
			'timeout'     => 10,
			'data_format' => 'body',
		] );

		if ( is_wp_error( $response ) ) {
			return '';
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( isset( $body['data'][0]['courier_code'] ) && ! empty( $body['data'][0]['courier_code'] ) ) {
			return (string) $body['data'][0]['courier_code'];
		}

		return '';
	}

	/**
	 * Backward compatibility alias for 17TRACK carrier code
	 */
	public static function get_17track_carrier_code( string $carrier_id ): int {
		return 0;
	}

	/**
	 * Register a Tracking Number with TrackingMore v4 API
	 */
	public static function register_with_trackingmore( string $tracking_number, string $carrier_id = '', int $order_id = 0 ): array {
		$tracking_number = trim( $tracking_number );
		if ( empty( $tracking_number ) ) {
			return [ 'success' => false, 'message' => 'Missing tracking number' ];
		}

		$api_key = self::get_trackingmore_api_key();
		if ( empty( $api_key ) ) {
			return [ 'success' => false, 'message' => 'Missing TrackingMore API key' ];
		}

		$courier_code = self::get_trackingmore_carrier_code( $carrier_id, $tracking_number );

		$payload = [
			'tracking_number' => $tracking_number,
		];
		if ( ! empty( $courier_code ) ) {
			$payload['courier_code'] = $courier_code;
		}
		if ( $order_id > 0 ) {
			$payload['order_number'] = (string) $order_id;
			$payload['title']        = "Order #{$order_id}";
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$email = $order->get_billing_email();
				if ( ! empty( $email ) ) {
					$payload['customer_email'] = $email;
				}
			}
		}

		$response = wp_remote_post( 'https://api.trackingmore.com/v4/trackings/create', [
			'headers'     => [
				'Tracking-Api-Key' => $api_key,
				'Content-Type'     => 'application/json',
			],
			'body'        => wp_json_encode( $payload ),
			'timeout'     => 15,
			'data_format' => 'body',
		] );

		if ( is_wp_error( $response ) ) {
			if ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::warning( 'shipping', "TrackingMore Registration Network Error for #{$tracking_number}: " . $response->get_error_message() );
			}
			return [ 'success' => false, 'message' => $response->get_error_message() ];
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		$meta_code = (int) ( $body['meta']['code'] ?? 0 );
		$meta_msg  = (string) ( $body['meta']['message'] ?? '' );

		// 200 = Success, 4101 = Tracking No. already exists in TrackingMore (both are successful states)
		if ( 200 === $meta_code || 4101 === $meta_code ) {
			if ( $order_id > 0 ) {
				update_post_meta( $order_id, '_artmatter_trackingmore_registered', 1 );
				update_post_meta( $order_id, '_artmatter_trackingmore_registered_number', $tracking_number );
				if ( ! empty( $courier_code ) ) {
					update_post_meta( $order_id, '_artmatter_trackingmore_carrier_code', $courier_code );
				}
				update_post_meta( $order_id, '_artmatter_17track_registered', 1 );
				update_post_meta( $order_id, '_artmatter_17track_registered_number', $tracking_number );
				delete_post_meta( $order_id, '_artmatter_trackingmore_error' );
				delete_post_meta( $order_id, '_artmatter_17track_error' );

				$order = wc_get_order( $order_id );
				if ( $order ) {
					$order->update_meta_data( '_artmatter_trackingmore_registered', 1 );
					$order->update_meta_data( '_artmatter_trackingmore_registered_number', $tracking_number );
					if ( ! empty( $courier_code ) ) {
						$order->update_meta_data( '_artmatter_trackingmore_carrier_code', $courier_code );
					}
					$order->update_meta_data( '_artmatter_17track_registered', 1 );
					$order->update_meta_data( '_artmatter_17track_registered_number', $tracking_number );
					$order->delete_meta_data( '_artmatter_trackingmore_error' );
					$order->delete_meta_data( '_artmatter_17track_error' );
					$order->save();
					$order->add_order_note( sprintf( 'TrackingMore: Tracking registered successfully with courier %s', $courier_code ?: 'Auto-Detect' ) );
				}
			}
			return [ 'success' => true, 'data' => $body['data'] ?? [] ];
		}

		$err_msg = ! empty( $meta_msg ) ? $meta_msg : 'TrackingMore registration rejected';
		if ( $order_id > 0 ) {
			update_post_meta( $order_id, '_artmatter_trackingmore_error', $err_msg );
			update_post_meta( $order_id, '_artmatter_17track_error', $err_msg );
		}
		return [ 'success' => false, 'message' => $err_msg, 'raw' => $body ];
	}

	/**
	 * Backward compatibility alias for 17TRACK registration
	 */
	public static function register_with_17track( string $tracking_number, string $carrier_id = '', int $order_id = 0 ): array {
		return self::register_with_trackingmore( $tracking_number, $carrier_id, $order_id );
	}

	/**
	 * Query Biteship Tracking API for Domestic Shipments (SiCepat, JNE, POS, J&T, etc.)
	 */
	public static function sync_biteship_tracking( string $tracking_number, string $carrier, int $order_id ): array {
		$tracking_number = trim( $tracking_number );
		if ( empty( $tracking_number ) ) {
			return [ 'success' => false, 'message' => 'Missing tracking number' ];
		}

		$biteship_courier = self::get_biteship_courier_code( $carrier );
		if ( empty( $biteship_courier ) ) {
			return [ 'success' => false, 'message' => "Carrier {$carrier} is not supported by Biteship tracking" ];
		}

		$api_key = self::get_biteship_api_key();
		if ( empty( $api_key ) ) {
			return [ 'success' => false, 'message' => 'Missing Biteship API key' ];
		}

		$endpoint = sprintf( 'https://api.biteship.com/v1/trackings/%s/couriers/%s', rawurlencode( $tracking_number ), rawurlencode( $biteship_courier ) );

		$response = wp_remote_get( $endpoint, [
			'headers' => [
				'Authorization' => $api_key,
				'Content-Type'  => 'application/json',
			],
			'timeout' => 15,
		] );

		if ( is_wp_error( $response ) ) {
			return [ 'success' => false, 'message' => $response->get_error_message() ];
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $status_code || empty( $body['success'] ) ) {
			$err_msg = $body['error'] ?? ( $body['message'] ?? "Biteship tracking returned HTTP {$status_code}" );
			return [ 'success' => false, 'message' => $err_msg, 'status_code' => $status_code, 'raw' => $body ];
		}

		// Process tracking data
		$biteship_status = strtolower( trim( (string) ( $body['status'] ?? '' ) ) );
		$history = is_array( $body['history'] ?? null ) ? $body['history'] : [];
		$dest_addr = trim( (string) ( $body['destination']['address'] ?? '' ) );

		$formatted_checkpoints = [];
		foreach ( $history as $h ) {
			$note = trim( (string) ( $h['note'] ?? '' ) );
			$time = trim( (string) ( $h['updated_at'] ?? '' ) );
			$stg  = trim( (string) ( $h['status'] ?? '' ) );
			if ( empty( $note ) && empty( $time ) ) {
				continue;
			}

			// Extract location from note if available
			$location = '';
			if ( preg_match( '/\[([^\]]+)\]/', $note, $lm ) ) {
				$location = trim( $lm[1] );
			} elseif ( preg_match( '/(?:di|ke)\s+([A-Za-z0-9\s]+)/i', $note, $lm ) ) {
				$location = trim( $lm[1] );
			} elseif ( 'delivered' === $stg && ! empty( $dest_addr ) ) {
				$location = $dest_addr;
			}

			$formatted_checkpoints[] = [
				'time'        => $time,
				'description' => $note,
				'location'    => self::clean_checkpoint_location( $location ),
				'stage'       => $stg,
			];
		}

		// Sort chronologically descending (newest checkpoint first)
		usort( $formatted_checkpoints, function( $a, $b ) {
			$ta = ! empty( $a['time'] ) ? strtotime( $a['time'] ) : 0;
			$tb = ! empty( $b['time'] ) ? strtotime( $b['time'] ) : 0;
			return $tb <=> $ta;
		} );

		$order = wc_get_order( $order_id );
		if ( $order ) {
			if ( ! empty( $formatted_checkpoints ) ) {
				$order->update_meta_data( '_artmatter_tracking_checkpoints', $formatted_checkpoints );
				update_post_meta( $order_id, '_artmatter_tracking_checkpoints', $formatted_checkpoints );
			}

			$order->update_meta_data( '_biteship_latest_status', $biteship_status );
			$order->update_meta_data( '_artmatter_trackingmore_latest_status', $biteship_status );
			update_post_meta( $order_id, '_biteship_latest_status', $biteship_status );
			update_post_meta( $order_id, '_artmatter_trackingmore_latest_status', $biteship_status );

			$carriers = self::get_carrier_registry();
			$carrier_label = $carriers[ $biteship_courier ]['name'] ?? ucfirst( $biteship_courier );
			$latest_note = ! empty( $formatted_checkpoints[0]['description'] ) ? $formatted_checkpoints[0]['description'] : '';

			// Status transition:
			// If Biteship reports 'delivered', transition order to 'completed' (Delivered)
			$current_status = $order->get_status();
			if ( 'delivered' === $biteship_status ) {
				if ( 'completed' !== $current_status ) {
					$note_text = sprintf( 'Biteship: Package delivered by courier %s (%s). %s', $carrier_label, $tracking_number, $latest_note );
					$order->update_status( 'completed', $note_text );
				}
			} elseif ( in_array( $biteship_status, [ 'picked', 'dropping_off', 'droppingoff', 'picking_up', 'in_transit' ], true ) ) {
				if ( in_array( $current_status, [ 'processing', 'preparing-order', 'ready-to-ship', 'awaiting-pickup' ], true ) ) {
					$note_text = sprintf( 'Biteship: Package in transit with courier %s (%s).', $carrier_label, $tracking_number );
					$order->update_status( 'shipped', $note_text );
				}
			}

			$order->save();
		}

		return [
			'success'     => true,
			'source'      => 'biteship',
			'status'      => $biteship_status,
			'checkpoints' => $formatted_checkpoints,
			'raw'         => $body,
		];
	}

	/**
	 * Sync Live Checkpoints with TrackingMore v4 API
	 */
	public static function sync_trackingmore_tracking( int $order_id, string $tracking_number, string $carrier ): array {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return [ 'success' => false, 'message' => 'Order not found' ];
		}

		$api_key = self::get_trackingmore_api_key();
		if ( empty( $api_key ) ) {
			return [ 'success' => false, 'message' => 'Missing TrackingMore API key' ];
		}

		// Query TrackingMore GET endpoint
		$query_url = add_query_arg( [
			'tracking_numbers' => $tracking_number,
		], 'https://api.trackingmore.com/v4/trackings/get' );

		$response = wp_remote_get( $query_url, [
			'headers' => [
				'Tracking-Api-Key' => $api_key,
				'Content-Type'     => 'application/json',
			],
			'timeout' => 15,
		] );

		if ( is_wp_error( $response ) ) {
			return [ 'success' => false, 'message' => $response->get_error_message() ];
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		$items = $body['data'] ?? [];

		// If not found in TrackingMore, auto-register now and retry
		if ( empty( $items ) || ! is_array( $items ) ) {
			$reg_res = self::register_with_trackingmore( $tracking_number, $carrier, $order_id );
			if ( ! empty( $reg_res['success'] ) ) {
				$retry_res = wp_remote_get( $query_url, [
					'headers' => [
						'Tracking-Api-Key' => $api_key,
						'Content-Type'     => 'application/json',
					],
					'timeout' => 15,
				] );
				if ( ! is_wp_error( $retry_res ) && 200 === wp_remote_retrieve_response_code( $retry_res ) ) {
					$retry_body = json_decode( wp_remote_retrieve_body( $retry_res ), true );
					$items = $retry_body['data'] ?? [];
				}
			}
		}

		if ( empty( $items ) || ! is_array( $items ) ) {
			$err_msg = $body['meta']['message'] ?? 'No tracking details returned from TrackingMore';
			return [ 'success' => false, 'message' => $err_msg, 'raw' => $body ];
		}

		$item = reset( $items );
		self::process_trackingmore_item_update( $item, $order_id );

		$checkpoints = $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: get_post_meta( $order_id, '_artmatter_tracking_checkpoints', true );
		$latest_st   = $order->get_meta( '_artmatter_trackingmore_latest_status' ) ?: get_post_meta( $order_id, '_artmatter_trackingmore_latest_status', true );
		return [ 'success' => true, 'source' => 'trackingmore', 'status' => $latest_st ?: '', 'checkpoints' => $checkpoints ?: [] ];
	}

	/**
	 * Smart Dual-Engine Shipping Tracker (Biteship First for ID Couriers, TrackingMore for Goorita/International/Fallback)
	 */
	public static function sync_order_tracking( int $order_id ): array {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return [ 'success' => false, 'message' => 'Order not found' ];
		}

		$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) 
			?: ( $order->get_meta( '_tracking_number' ) 
			?: ( $order->get_meta( '_artmatter_tracking_number' ) 
			?: ( get_post_meta( $order_id, 'tracking_number', true ) 
			?: ( get_post_meta( $order_id, '_tracking_number', true ) 
			?: ( function_exists( 'get_field' ) ? (string) get_field( 'tracking_number', $order_id ) : '' ) ) ) ) ) );

		if ( empty( $tracking_number ) ) {
			$t_info = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order_id, '_artmatter_tracking_info', true );
			if ( is_array( $t_info ) && ! empty( $t_info['tracking_number'] ) ) {
				$tracking_number = (string) $t_info['tracking_number'];
			}
		}

		$tracking_number = trim( $tracking_number );
		if ( empty( $tracking_number ) ) {
			return [ 'success' => false, 'message' => 'Order has no tracking number' ];
		}

		$carrier = (string) ( $order->get_meta( 'carrier_id' ) 
			?: ( $order->get_meta( '_carrier_id' ) 
			?: ( get_post_meta( $order_id, 'carrier_id', true ) 
			?: ( function_exists( 'get_field' ) ? (string) get_field( 'carrier_id', $order_id ) : '' ) ) ) );

		$carrier = strtolower( trim( $carrier ) );

		// 1. If courier is supported by Biteship (SiCepat, JNE, POS, J&T, etc.), query Biteship first
		$biteship_courier = self::get_biteship_courier_code( $carrier );
		if ( ! empty( $biteship_courier ) ) {
			$biteship_res = self::sync_biteship_tracking( $tracking_number, $biteship_courier, $order_id );
			if ( ! empty( $biteship_res['success'] ) ) {
				return $biteship_res;
			}
			// If Biteship fails (e.g. invalid/expired waybill or temporary sync delay), smoothly fall through to TrackingMore
		}

		// 2. Query TrackingMore (Primary for Goorita/International, or reliable domestic fallback)
		return self::sync_trackingmore_tracking( $order_id, $tracking_number, $carrier );
	}

	/**
	 * Register Custom Cron Intervals (3 Hours & 6 Hours)
	 */
	public static function register_cron_intervals( $schedules ) {
		$schedules['three_hours'] = [
			'interval' => 3 * HOUR_IN_SECONDS,
			'display'  => __( 'Every Three Hours', 'exacoat-core' ),
		];
		$schedules['six_hours'] = [
			'interval' => 6 * HOUR_IN_SECONDS,
			'display'  => __( 'Every Six Hours', 'exacoat-core' ),
		];
		return $schedules;
	}

	/**
	 * Periodic Automated Shipping Sync Cron (Every 6 Hours)
	 * Checks active shipped orders from the past 30 days and updates delivered status automatically.
	 * Conserves Biteship API quota by enforcing a minimum 4-hour cooldown per order.
	 */
	public static function cron_sync_active_shipments() {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return;
		}

		$orders = wc_get_orders( [
			'status'       => [ 'wc-shipped', 'shipped', 'wc-ready-to-ship', 'ready-to-ship', 'wc-awaiting-pickup', 'awaiting-pickup' ],
			'limit'        => 50,
			'date_created' => '>=' . ( time() - ( 30 * DAY_IN_SECONDS ) ),
			'orderby'      => 'date',
			'order'        => 'DESC',
		] );

		if ( empty( $orders ) ) {
			return;
		}

		$now          = time();
		$min_interval = 4 * HOUR_IN_SECONDS; // Guard: check an order at most once per 4 hours

		foreach ( $orders as $order ) {
			$order_id = $order->get_id();
			$tracking = (string) ( $order->get_meta( 'tracking_number' ) ?: ( $order->get_meta( '_tracking_number' ) ?: '' ) );
			if ( empty( $tracking ) ) {
				continue;
			}

			$last_sync = (int) $order->get_meta( '_last_tracking_sync_time' );
			if ( $last_sync > 0 && ( $now - $last_sync ) < $min_interval ) {
				continue; // Skip: checked recently, save Biteship tokens
			}

			$order->update_meta_data( '_last_tracking_sync_time', $now );
			$order->save();
			update_post_meta( $order_id, '_last_tracking_sync_time', $now );

			self::sync_order_tracking( $order_id );
		}
	}

	/**
	 * Process Parsed TrackingMore Item & Apply Status Updates to WooCommerce Order (HPOS & CPT Compatible)
	 */
	public static function process_trackingmore_item_update( array $item, int $order_id = 0 ) {
		$number = trim( (string) ( $item['tracking_number'] ?? ( $item['number'] ?? '' ) ) );
		if ( empty( $number ) ) return;

		global $wpdb;
		if ( $order_id <= 0 ) {
			// Query HPOS table first if it exists
			$hpos_table = $wpdb->prefix . 'wc_orders_meta';
			if ( $wpdb->get_var( "SHOW TABLES LIKE '{$hpos_table}'" ) === $hpos_table ) {
				$order_id = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT order_id FROM {$hpos_table} WHERE meta_key IN ('tracking_number', '_tracking_number', '_artmatter_tracking_number', '_artmatter_trackingmore_registered_number', '_artmatter_17track_registered_number') AND meta_value = %s LIMIT 1",
					$number
				) );
			}
			// Fallback to standard postmeta
			if ( $order_id <= 0 ) {
				$order_id = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key IN ('tracking_number', '_tracking_number', '_artmatter_tracking_number', '_artmatter_trackingmore_registered_number', '_artmatter_17track_registered_number') AND meta_value = %s LIMIT 1",
					$number
				) );
			}
		}

		if ( $order_id <= 0 ) return;

		$order = wc_get_order( $order_id );
		if ( ! $order ) return;

		// 1. Smart checkpoint gathering and de-duplication
		$dest_trackinfo = ( ! empty( $item['destination_info']['trackinfo'] ) && is_array( $item['destination_info']['trackinfo'] ) ) 
			? $item['destination_info']['trackinfo'] 
			: [];
		$orig_trackinfo = ( ! empty( $item['origin_info']['trackinfo'] ) && is_array( $item['origin_info']['trackinfo'] ) ) 
			? $item['origin_info']['trackinfo'] 
			: [];

		$formatted_checkpoints = [];
		$seen = [];

		if ( ! empty( $dest_trackinfo ) ) {
			// International shipment: Prioritize English destination scan updates
			foreach ( $dest_trackinfo as $d ) {
				$desc = trim( (string) ( $d['tracking_detail'] ?? ( $d['checkpoint_delivery_substatus'] ?? ( $d['description'] ?? '' ) ) ) );
				if ( empty( $desc ) ) continue;

				$time = (string) ( $d['checkpoint_date'] ?? ( $d['time'] ?? '' ) );
				$day  = ! empty( $time ) ? substr( $time, 0, 10 ) : '';
				$key  = $day . '|' . strtolower( $desc );

				if ( isset( $seen[ $key ] ) ) {
					continue;
				}
				$seen[ $key ] = true;

				// Check if origin scan on the same day has precise hour:minute or location
				$loc = (string) ( $d['location'] ?? '' );
				$stg = (string) ( $d['checkpoint_delivery_status'] ?? '' );

				if ( ! empty( $orig_trackinfo ) ) {
					foreach ( $orig_trackinfo as $o ) {
						$o_time = (string) ( $o['checkpoint_date'] ?? '' );
						$o_day  = ! empty( $o_time ) ? substr( $o_time, 0, 10 ) : '';
						if ( $o_day === $day ) {
							if ( empty( $loc ) && ! empty( $o['location'] ) ) {
								$loc = (string) $o['location'];
							}
							if ( strpos( $time, '00:00:00' ) !== false && ! empty( $o_time ) && strpos( $o_time, '00:00:00' ) === false ) {
								$time = $o_time;
							}
							break;
						}
					}
				}

				$formatted_checkpoints[] = [
					'time'        => $time,
					'description' => $desc,
					'location'    => self::clean_checkpoint_location( $loc ),
					'stage'       => $stg,
				];
			}
		}

		// If destination info was empty (e.g. domestic shipments) or for remaining unique origin scans
		if ( empty( $formatted_checkpoints ) && ! empty( $orig_trackinfo ) ) {
			foreach ( $orig_trackinfo as $o ) {
				$desc = trim( (string) ( $o['tracking_detail'] ?? ( $o['checkpoint_delivery_substatus'] ?? ( $o['description'] ?? '' ) ) ) );
				if ( empty( $desc ) ) continue;

				$time = (string) ( $o['checkpoint_date'] ?? ( $o['time'] ?? '' ) );
				$day  = ! empty( $time ) ? substr( $time, 0, 10 ) : '';
				$key  = $day . '|' . strtolower( $desc );

				if ( isset( $seen[ $key ] ) ) {
					continue;
				}
				$seen[ $key ] = true;

				$formatted_checkpoints[] = [
					'time'        => $time,
					'description' => $desc,
					'location'    => self::clean_checkpoint_location( (string) ( $o['location'] ?? '' ) ),
					'stage'       => (string) ( $o['checkpoint_delivery_status'] ?? '' ),
				];
			}
		}

		// Also check 17TRACK legacy structures if item came from legacy cache/webhook
		if ( empty( $formatted_checkpoints ) ) {
			$legacy_events = [];
			if ( ! empty( $item['track_info']['tracking']['providers'][0]['events'] ) ) {
				$legacy_events = $item['track_info']['tracking']['providers'][0]['events'];
			} elseif ( ! empty( $item['track_info']['tracking'] ) && is_array( $item['track_info']['tracking'] ) ) {
				$legacy_events = $item['track_info']['tracking'];
			}
			foreach ( $legacy_events as $ev ) {
				$time = $ev['checkpoint_date'] ?? ( $ev['time'] ?? ( $ev['time_iso'] ?? '' ) );
				$desc = $ev['tracking_detail'] ?? ( $ev['description'] ?? ( $ev['context'] ?? '' ) );
				$key  = md5( $time . '|' . $desc );
				if ( isset( $seen[ $key ] ) ) continue;
				$seen[ $key ] = true;
				$formatted_checkpoints[] = [
					'time'        => $time,
					'description' => $desc,
					'location'    => self::clean_checkpoint_location( (string) ( $ev['location'] ?? '' ) ),
					'stage'       => $ev['stage'] ?? '',
				];
			}
		}

		// Sort chronologically descending (newest checkpoint first)
		usort( $formatted_checkpoints, function( $a, $b ) {
			$ta = ! empty( $a['time'] ) ? strtotime( $a['time'] ) : 0;
			$tb = ! empty( $b['time'] ) ? strtotime( $b['time'] ) : 0;
			return $tb <=> $ta;
		} );

		if ( ! empty( $formatted_checkpoints ) ) {
			$order->update_meta_data( '_artmatter_tracking_checkpoints', $formatted_checkpoints );
			update_post_meta( $order_id, '_artmatter_tracking_checkpoints', $formatted_checkpoints );
		}

		// 2. Delivery Status handling
		$delivery_status = strtolower( trim( (string) ( $item['delivery_status'] ?? ( $item['track_info']['latest_status']['status'] ?? '' ) ) ) );
		$latest_event    = (string) ( $item['latest_event'] ?? ( $item['track_info']['latest_event']['description'] ?? '' ) );

		if ( ! empty( $delivery_status ) ) {
			$order->update_meta_data( '_artmatter_trackingmore_latest_status', $delivery_status );
			$order->update_meta_data( '_artmatter_17track_latest_status', $delivery_status );
			update_post_meta( $order_id, '_artmatter_trackingmore_latest_status', $delivery_status );
			update_post_meta( $order_id, '_artmatter_17track_latest_status', $delivery_status );
		}

		// Transition WooCommerce order status:
		// If TrackingMore reports 'delivered', transition order to 'completed' (Delivered)
		if ( 'delivered' === $delivery_status ) {
			$current_status = $order->get_status();
			if ( 'completed' !== $current_status ) {
				$order->update_status( 'completed', sprintf( 'TrackingMore: Package delivered by courier (%s). %s', $number, $latest_event ) );
			}
		} elseif ( in_array( $delivery_status, [ 'transit', 'pickup' ], true ) ) {
			$current_status = $order->get_status();
			if ( 'processing' === $current_status || 'awaiting-pickup' === $current_status ) {
				$order->update_status( 'shipped', sprintf( 'TrackingMore: Package in transit with courier (%s)', $number ) );
			}
		}

		$order->save();
	}

	/**
	 * Backward compatibility alias
	 */
	public static function process_17track_item_update( array $item, int $order_id = 0 ) {
		self::process_trackingmore_item_update( $item, $order_id );
	}

	/**
	 * Clean, format, and deduplicate carrier location strings.
	 * Handles repetitive carrier strings like "GERMANY - Germany", "INDONESIA - Indonesia",
	 * "DE - Germany", "FRANKFURT - GERMANY", and standardizes to Title Case with comma separators.
	 */
	public static function clean_checkpoint_location( string $loc ): string {
		$loc = trim( $loc );
		if ( empty( $loc ) ) {
			return '';
		}

		// Split on hyphens, en-dashes, em-dashes, commas, slashes, pipes
		$parts = preg_split( '/\s*[-–—,\/|]\s*/u', $loc );
		$cleaned_parts = [];
		$seen = [];

		$iso_to_country = [
			'de' => 'germany',
			'id' => 'indonesia',
			'us' => 'united states',
			'gb' => 'united kingdom',
			'uk' => 'united kingdom',
			'fr' => 'france',
			'nl' => 'netherlands',
			'au' => 'australia',
			'sg' => 'singapore',
			'jp' => 'japan',
			'cn' => 'china',
			'ch' => 'switzerland',
			'at' => 'austria',
			'it' => 'italy',
			'es' => 'spain',
			'ca' => 'canada',
		];

		foreach ( $parts as $p ) {
			$p = trim( $p );
			if ( empty( $p ) ) {
				continue;
			}
			$p_lower = strtolower( $p );

			// If part is a 2-letter ISO code, check if we can resolve or if it duplicates an existing part
			if ( strlen( $p_lower ) === 2 && isset( $iso_to_country[ $p_lower ] ) ) {
				$mapped_country = $iso_to_country[ $p_lower ];
				if ( isset( $seen[ $mapped_country ] ) ) {
					continue;
				}
			}

			// Avoid adding if duplicate
			if ( isset( $seen[ $p_lower ] ) ) {
				continue;
			}

			// Check if an existing part in $seen was an ISO code mapping to this full country
			foreach ( array_keys( $seen ) as $prev_key ) {
				if ( strlen( $prev_key ) === 2 && isset( $iso_to_country[ $prev_key ] ) && $iso_to_country[ $prev_key ] === $p_lower ) {
					foreach ( $cleaned_parts as $k => $cp ) {
						if ( strtolower( $cp ) === $prev_key ) {
							unset( $cleaned_parts[ $k ] );
						}
					}
					unset( $seen[ $prev_key ] );
					break;
				}
			}

			$seen[ $p_lower ] = true;

			// Format title casing if all uppercase or lowercase
			if ( strtoupper( $p ) === $p || strtolower( $p ) === $p ) {
				$p = ucwords( strtolower( $p ) );
			}

			$cleaned_parts[] = $p;
		}

		return implode( ', ', array_values( $cleaned_parts ) );
	}

	/**
	 * Format checkpoint datetime with clear timezone indication.
	 * Carrier scans represent the local time of the courier facility.
	 * If the timestamp carries an explicit UTC offset (e.g. +02:00), it formats as (Local time, UTC+2).
	 */
	public static function format_checkpoint_time( string $time ): string {
		$time = trim( $time );
		if ( empty( $time ) ) {
			return '';
		}

		try {
			$dt = new DateTime( $time );
			$has_time = ( $dt->format( 'H:i:s' ) !== '00:00:00' );
			if ( ! $has_time ) {
				return $dt->format( 'M j, Y' );
			}

			$tz_label = __( 'Local time', 'artmatter-core' );
			if ( preg_match( '/([+-]\d{2}):?(\d{2})?$/', $time, $tzm ) ) {
				$h = (int) $tzm[1];
				$tz_label = sprintf( __( 'Local time, UTC%s%d', 'artmatter-core' ), ( $h >= 0 ? '+' : '' ), $h );
			} elseif ( preg_match( '/Z$/i', $time ) ) {
				$tz_label = 'UTC';
			}

			return $dt->format( 'M j, Y' ) . ' • ' . $dt->format( 'H:i' ) . ' (' . $tz_label . ')';
		} catch ( Exception $e ) {
			return $time;
		}
	}

	/**
	 * Register Admin Meta Boxes on WooCommerce Orders (HPOS & Classic)
	 */
	public static function register_admin_meta_boxes() {
		$screens = [ 'shop_order' ];
		if ( class_exists( '\Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController' ) && function_exists( 'wc_get_page_screen_id' ) ) {
			$hpos_screen = wc_get_page_screen_id( 'shop_order' );
			if ( ! empty( $hpos_screen ) && ! in_array( $hpos_screen, $screens, true ) ) {
				$screens[] = $hpos_screen;
			}
		}

		foreach ( $screens as $screen ) {
			add_meta_box(
				'artmatter_trackingmore_meta_box',
				__( 'TrackingMore & Logistics', 'artmatter-core' ),
				[ __CLASS__, 'render_admin_meta_box' ],
				$screen,
				'side',
				'high'
			);
		}
	}

	/**
	 * Render TrackingMore Status & Sync Meta Box on Admin Order Screen
	 */
	public static function render_admin_meta_box( $post_or_order ) {
		$order = $post_or_order instanceof WC_Order 
			? $post_or_order 
			: wc_get_order( is_object( $post_or_order ) ? $post_or_order->ID : $post_or_order );

		if ( ! $order ) {
			echo '<p style="color:#71717a; font-size:12px;">' . esc_html__( 'Order not found.', 'artmatter-core' ) . '</p>';
			return;
		}

		$order_id        = $order->get_id();
		$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) 
			?: ( $order->get_meta( '_tracking_number' ) 
			?: ( $order->get_meta( '_artmatter_tracking_number' ) 
			?: ( get_post_meta( $order_id, 'tracking_number', true ) 
			?: ( function_exists( 'get_field' ) ? (string) get_field( 'tracking_number', $order_id ) : '' ) ) ) ) );
		$carrier         = (string) ( $order->get_meta( 'carrier_id' ) 
			?: ( $order->get_meta( '_carrier_id' ) 
			?: ( get_post_meta( $order_id, 'carrier_id', true ) 
			?: ( function_exists( 'get_field' ) ? (string) get_field( 'carrier_id', $order_id ) : '' ) ) ) );

		$is_registered = $order->get_meta( '_artmatter_trackingmore_registered' ) 
			?: ( $order->get_meta( '_artmatter_17track_registered' ) 
			?: ( get_post_meta( $order_id, '_artmatter_trackingmore_registered', true ) 
			?: get_post_meta( $order_id, '_artmatter_17track_registered', true ) ) );

		$latest_status = $order->get_meta( '_artmatter_trackingmore_latest_status' ) 
			?: ( $order->get_meta( '_artmatter_17track_latest_status' ) 
			?: ( get_post_meta( $order_id, '_artmatter_trackingmore_latest_status', true ) 
			?: get_post_meta( $order_id, '_artmatter_17track_latest_status', true ) ) );

		$last_error    = $order->get_meta( '_artmatter_trackingmore_error' ) 
			?: ( $order->get_meta( '_artmatter_17track_error' ) 
			?: ( get_post_meta( $order_id, '_artmatter_trackingmore_error', true ) 
			?: get_post_meta( $order_id, '_artmatter_17track_error', true ) ) );

		$checkpoints   = $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: get_post_meta( $order_id, '_artmatter_tracking_checkpoints', true );

		$carriers      = self::get_carrier_registry();
		$carrier_name  = $carriers[ strtolower( $carrier ) ]['name'] ?? ( ! empty( $carrier ) ? ucfirst( $carrier ) : 'Auto' );
		$tracking_url  = ! empty( $tracking_number ) ? self::get_carrier_tracking_url( $carrier, $tracking_number ) : '';
		$sync_nonce    = wp_create_nonce( 'artmatter_admin_sync_trackingmore_' . $order_id );
		?>
		<div class="artmatter-trackingmore-admin-box" style="font-size:12px; line-height:1.4;">
			<div style="margin-bottom:10px;">
				<div style="font-size:10px; text-transform:uppercase; color:#71717a; font-weight:600; letter-spacing:0.04em;">Carrier & Tracking</div>
				<div style="margin-top:2px; font-size:13px; font-weight:600; color:#18181b;">
					<?php if ( ! empty( $tracking_number ) ) : ?>
						<span style="font-family:monospace;"><?php echo esc_html( $tracking_number ); ?></span>
						<span style="color:#71717a; font-weight:400;">(<?php echo esc_html( $carrier_name ); ?>)</span>
					<?php else : ?>
						<span style="color:#a1a1aa; font-weight:400; font-style:italic;">No tracking number assigned</span>
					<?php endif; ?>
				</div>
			</div>

			<div style="margin-bottom:12px; padding:8px 10px; background:#f4f4f5; border-radius:6px; border:1px solid #e4e4e7;">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span style="color:#71717a; font-size:11px;">TrackingMore Sync:</span>
					<?php if ( ! empty( $is_registered ) ) : ?>
						<span style="color:#16a34a; font-weight:600; font-size:11px;">● Registered & Monitored</span>
					<?php else : ?>
						<span style="color:#ea580c; font-weight:500; font-size:11px;">○ Not registered yet</span>
					<?php endif; ?>
				</div>
				<?php if ( ! empty( $latest_status ) ) : ?>
					<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
						<span style="color:#71717a; font-size:11px;">Latest Status:</span>
						<span style="color:#09090b; font-weight:600; font-size:11px; text-transform:capitalize;"><?php echo esc_html( $latest_status ); ?></span>
					</div>
				<?php endif; ?>
				<?php if ( ! empty( $last_error ) && empty( $is_registered ) ) : ?>
					<div style="margin-top:6px; padding:6px 8px; background:rgba(239,68,68,0.08); border-radius:6px; font-size:11px; color:#dc2626; border:1px solid rgba(239,68,68,0.2); line-height:1.4;">
						<div><?php echo esc_html( $last_error ); ?></div>
					</div>
				<?php endif; ?>
			</div>

			<?php if ( ! empty( $checkpoints ) && is_array( $checkpoints ) ) : 
				$latest_cp = reset( $checkpoints );
				$cp_desc   = $latest_cp['description'] ?? ( $latest_cp['context'] ?? '' );
				$cp_time   = $latest_cp['time'] ?? '';
			?>
				<div style="margin-bottom:12px; font-size:11px; color:#52525b; border-left:2px solid #16a34a; padding-left:8px;">
					<div style="font-weight:500; color:#18181b;"><?php echo esc_html( $cp_desc ); ?></div>
					<?php if ( $cp_time ) : ?><div style="font-size:10px; color:#71717a; font-family:monospace;"><?php echo esc_html( $cp_time ); ?></div><?php endif; ?>
				</div>
			<?php endif; ?>

			<div style="display:flex; flex-direction:column; gap:6px;">
				<button type="button" id="artmatter-admin-sync-btn-<?php echo esc_attr( $order_id ); ?>" class="button button-primary" style="width:100%; text-align:center;" onclick="artmatterAdminSyncTrackingMore(<?php echo esc_attr( $order_id ); ?>, '<?php echo esc_attr( $sync_nonce ); ?>')">
					Sync with TrackingMore Now
				</button>
				<?php if ( ! empty( $tracking_url ) ) : ?>
					<a href="<?php echo esc_url( $tracking_url ); ?>" target="_blank" class="button" style="width:100%; text-align:center; font-size:11px;">
						↗ View Courier Portal
					</a>
				<?php endif; ?>
			</div>
			<div id="artmatter-admin-sync-msg-<?php echo esc_attr( $order_id ); ?>" style="margin-top:6px; font-size:11px; display:none;"></div>
		</div>

		<script>
		function artmatterAdminSyncTrackingMore(orderId, nonce) {
			var btn = document.getElementById('artmatter-admin-sync-btn-' + orderId);
			var msg = document.getElementById('artmatter-admin-sync-msg-' + orderId);
			if (!btn) return;
			btn.disabled = true;
			btn.textContent = 'Syncing with TrackingMore...';
			msg.style.display = 'block';
			msg.style.color = '#71717a';
			msg.textContent = 'Connecting to TrackingMore API...';

			jQuery.post(ajaxurl, {
				action: 'artmatter_admin_sync_trackingmore',
				order_id: orderId,
				security: nonce
			}, function(res) {
				btn.disabled = false;
				btn.textContent = 'Sync with TrackingMore Now';
				if (res && res.success) {
					msg.style.color = '#16a34a';
					msg.textContent = '✓ ' + (res.data.message || 'Synced successfully!');
					setTimeout(function() { window.location.reload(); }, 900);
				} else {
					msg.style.color = '#dc2626';
					msg.textContent = '✗ ' + ((res && res.data && res.data.message) ? res.data.message : 'Sync failed');
				}
			}).fail(function() {
				btn.disabled = false;
				btn.textContent = 'Sync with TrackingMore Now';
				msg.style.color = '#dc2626';
				msg.textContent = '✗ Network request failed';
			});
		}
		// Backward compatibility alias for any older inline calls
		var artmatterAdminSync17track = artmatterAdminSyncTrackingMore;
		</script>
		<?php
	}

	/**
	 * Register REST Routes for Tracking Webhooks & Public Order Tracking
	 */
	public static function register_rest_routes() {
		$namespaces = [ 'exacoat-core/v1', 'artmatter-core/v1' ];

		foreach ( $namespaces as $ns ) {
			register_rest_route( $ns, '/shipping/track', [
				'methods'             => [ 'GET', 'POST' ],
				'callback'            => [ __CLASS__, 'rest_track_order' ],
				'permission_callback' => '__return_true',
			] );

			register_rest_route( $ns, '/shipping/trackingmore-webhook', [
				'methods'             => [ 'POST', 'GET' ],
				'callback'            => [ __CLASS__, 'handle_trackingmore_webhook' ],
				'permission_callback' => '__return_true',
			] );

			register_rest_route( $ns, '/shipping/17track-webhook', [
				'methods'             => [ 'POST', 'GET' ],
				'callback'            => [ __CLASS__, 'handle_trackingmore_webhook' ],
				'permission_callback' => '__return_true',
			] );

			register_rest_route( $ns, '/shipping/biteship-webhook', [
				'methods'             => [ 'POST', 'GET' ],
				'callback'            => [ __CLASS__, 'handle_biteship_webhook' ],
				'permission_callback' => '__return_true',
			] );

			register_rest_route( $ns, '/shipping/sync-order', [
				'methods'             => [ 'POST', 'GET' ],
				'callback'            => [ __CLASS__, 'rest_sync_order_tracking' ],
				'permission_callback' => '__return_true',
			] );
		}
	}

	/**
	 * REST: Public Order Tracking by Order ID & Email
	 */
	public static function rest_track_order( WP_REST_Request $request ) {
		$order_id_input = sanitize_text_field( (string) ( $request->get_param( 'order_id' ) ?? $request->get_param( 'orderId' ) ?? '' ) );
		$order_id_input = ltrim( trim( $order_id_input ), '#' );
		$email_input    = sanitize_email( (string) ( $request->get_param( 'order_email' ) ?? $request->get_param( 'email' ) ?? '' ) );
		$order_key      = sanitize_text_field( (string) ( $request->get_param( 'key' ) ?? '' ) );

		if ( empty( $order_id_input ) ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => __( 'Missing order number.', 'artmatter-core' ),
			], 400 );
		}

		$order = wc_get_order( (int) $order_id_input );
		if ( ! $order && function_exists( 'wc_get_orders' ) ) {
			$orders = wc_get_orders( [ 'order_number' => $order_id_input, 'limit' => 1 ] );
			if ( ! empty( $orders ) ) {
				$order = $orders[0];
			}
		}

		if ( ! $order ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => __( 'No order found with that number.', 'artmatter-core' ),
			], 404 );
		}

		$matched = false;
		if ( ! empty( $order_key ) && hash_equals( (string) $order->get_order_key(), $order_key ) ) {
			$matched = true;
		} elseif ( ! empty( $email_input ) && strcasecmp( trim( (string) $order->get_billing_email() ), trim( $email_input ) ) === 0 ) {
			$matched = true;
		}

		if ( ! $matched ) {
			return new WP_REST_Response( [
				'success' => false,
				'message' => __( 'Order details could not be found with the email provided.', 'artmatter-core' ),
			], 403 );
		}

		// Sync latest courier checkpoints if tracking number is present
		$tracking_number = (string) ( $order->get_meta( 'tracking_number' ) ?: ( $order->get_meta( '_tracking_number' ) ?: ( $order->get_meta( '_artmatter_tracking_number' ) ?: '' ) ) );
		if ( ! empty( $tracking_number ) ) {
			self::sync_order_tracking( $order->get_id() );
		}

		// Delegate order formatting to Customer Auth if available
		if ( class_exists( 'Artmatter_Customer_Auth' ) ) {
			$req = new WP_REST_Request( 'POST', '/artmatter-core/v1/auth/order' );
			$req->set_param( 'orderId', $order->get_id() );
			$req->set_param( 'key', $order->get_order_key() );
			$req->set_param( 'email', $order->get_billing_email() );
			$auth_res = Artmatter_Customer_Auth::rest_order( $req );
			if ( $auth_res instanceof WP_REST_Response && 200 === $auth_res->get_status() ) {
				$payload = $auth_res->get_data();
				return new WP_REST_Response( [
					'success' => true,
					'order'   => $payload['order'] ?? null,
				], 200 );
			}
		}

		return new WP_REST_Response( [
			'success' => true,
			'order'   => [
				'id'              => $order->get_id(),
				'number'          => (string) $order->get_order_number(),
				'status'          => $order->get_status(),
				'statusLabel'     => wc_get_order_status_name( $order->get_status() ),
				'date'            => $order->get_date_created() ? $order->get_date_created()->date( DATE_ATOM ) : '',
				'shippingMethod'  => $order->get_shipping_method() ?: 'Standard Courier Delivery',
				'trackingNumber'  => $tracking_number,
				'trackingCarrier' => (string) ( $order->get_meta( 'carrier_id' ) ?: '' ),
				'checkpoints'     => $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: [],
			],
		], 200 );
	}

	/**
	 * Tracking Webhook Listener Endpoint (TrackingMore & 17TRACK compatible)
	 */
	public static function handle_trackingmore_webhook( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();

		if ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::info( 'shipping', 'Tracking Webhook received', [ 'payload' => $params ] );
		}

		$data = $params['data'] ?? [];
		if ( empty( $data ) && empty( $params ) ) {
			return new WP_REST_Response( [ 'code' => 0, 'message' => 'Empty payload acknowledged' ], 200 );
		}

		$items = [];
		if ( isset( $data['tracking_number'] ) || isset( $data['number'] ) ) {
			$items = [ $data ];
		} elseif ( is_array( $data ) && isset( $data[0] ) ) {
			$items = $data;
		} elseif ( isset( $params['tracking_number'] ) ) {
			$items = [ $params ];
		} elseif ( isset( $data['accepted'] ) && is_array( $data['accepted'] ) ) {
			$items = $data['accepted'];
		}

		$processed = 0;
		foreach ( $items as $item ) {
			if ( is_array( $item ) && ( ! empty( $item['tracking_number'] ) || ! empty( $item['number'] ) ) ) {
				self::process_trackingmore_item_update( $item );
				$processed++;
			}
		}

		return new WP_REST_Response( [
			'code'      => 0,
			'message'   => "Successfully processed {$processed} tracking items",
			'processed' => $processed,
		], 200 );
	}

	public static function handle_17track_webhook( WP_REST_Request $request ) {
		return self::handle_trackingmore_webhook( $request );
	}

	/**
	 * Handle incoming webhook updates from Biteship
	 */
	public static function handle_biteship_webhook( WP_REST_Request $request ) {
		$params = $request->get_json_params() ?: $request->get_params();

		if ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::info( 'shipping', 'Biteship Webhook received', [ 'payload' => $params ] );
		}

		$waybill_id = sanitize_text_field( (string) ( $params['courier_waybill_id'] ?? ( $params['waybill_id'] ?? '' ) ) );

		if ( empty( $waybill_id ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Missing waybill ID' ], 400 );
		}

		global $wpdb;
		$order_id = 0;

		// 1. Check HPOS table if available
		$hpos_table = $wpdb->prefix . 'wc_orders_meta';
		if ( $wpdb->get_var( "SHOW TABLES LIKE '{$hpos_table}'" ) === $hpos_table ) {
			$order_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT order_id FROM {$hpos_table} WHERE meta_key IN ('tracking_number', '_tracking_number', '_artmatter_tracking_number') AND meta_value = %s LIMIT 1",
				$waybill_id
			) );
		}

		// 2. Fallback to postmeta
		if ( $order_id <= 0 ) {
			$order_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key IN ('tracking_number', '_tracking_number', '_artmatter_tracking_number') AND meta_value = %s LIMIT 1",
				$waybill_id
			) );
		}

		if ( $order_id > 0 ) {
			$sync_res = self::sync_order_tracking( $order_id );
			return new WP_REST_Response( [
				'success'  => true,
				'order_id' => $order_id,
				'message'  => 'Order tracking synced from Biteship webhook',
				'data'     => $sync_res,
			], 200 );
		}

		return new WP_REST_Response( [ 'success' => true, 'message' => 'Webhook received but order not found' ], 200 );
	}

	/**
	 * REST: On-demand sync order tracking directly from manager or client
	 */
	public static function rest_sync_order_tracking( WP_REST_Request $request ) {
		$order_id = (int) ( $request->get_param( 'order_id' ) ?? $request->get_param( 'orderId' ) ?? 0 );
		if ( $order_id <= 0 ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => 'Invalid order ID' ], 400 );
		}

		$result = self::sync_order_tracking( $order_id );
		$order  = wc_get_order( $order_id );

		if ( ! empty( $result['success'] ) && $order ) {
			$status = $order->get_status();
			return new WP_REST_Response( [
				'success'       => true,
				'order_id'      => $order_id,
				'status'        => $status,
				'status_label'  => wc_get_order_status_name( $status ),
				'checkpoints'   => $result['checkpoints'] ?? [],
				'latest_status' => $result['status'] ?? ( $order->get_meta( '_artmatter_trackingmore_latest_status' ) ?: '' ),
				'source'        => $result['source'] ?? 'tracking',
			], 200 );
		}

		return new WP_REST_Response( [
			'success' => false,
			'message' => $result['message'] ?? 'Failed syncing tracking',
		], 400 );
	}

	/**
	 * Admin AJAX: Test TrackingMore API Connection
	 */
	public static function ajax_test_trackingmore_connection() {
		check_ajax_referer( 'artmatter_core_admin_nonce', 'security' );
		if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( [ 'message' => 'Unauthorized' ] );
		}

		$key = isset( $_POST['api_key'] ) ? trim( sanitize_text_field( $_POST['api_key'] ) ) : self::get_trackingmore_api_key();
		if ( empty( $key ) ) {
			wp_send_json_error( [ 'message' => 'Missing TrackingMore API Key' ] );
		}

		$response = wp_remote_get( 'https://api.trackingmore.com/v4/couriers/all', [
			'headers' => [
				'Tracking-Api-Key' => $key,
				'Content-Type'     => 'application/json',
			],
			'timeout' => 15,
		] );

		if ( is_wp_error( $response ) ) {
			wp_send_json_error( [ 'message' => 'Network error: ' . $response->get_error_message() ] );
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 === $status_code && isset( $body['meta']['code'] ) && 200 === (int) $body['meta']['code'] ) {
			wp_send_json_success( [
				'message' => 'TrackingMore API Connected Successfully! 50 shipments/month free quota is active.',
				'status'  => 'authenticated',
			] );
		}

		wp_send_json_error( [
			'message' => 'TrackingMore Error: ' . ( $body['meta']['message'] ?? 'HTTP ' . $status_code ),
			'status'  => 'error',
		] );
	}

	public static function ajax_test_17track_connection() {
		self::ajax_test_trackingmore_connection();
	}

	/**
	 * Admin AJAX: 1-Click Sync Order with TrackingMore
	 */
	public static function ajax_admin_sync_trackingmore() {
		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		if ( $order_id <= 0 ) {
			wp_send_json_error( [ 'message' => 'Invalid order ID' ] );
		}

		$nonce = isset( $_POST['security'] ) ? sanitize_text_field( $_POST['security'] ) : '';
		$valid_nonce = wp_verify_nonce( $nonce, 'artmatter_admin_sync_trackingmore_' . $order_id )
			|| wp_verify_nonce( $nonce, 'artmatter_admin_sync_17track_' . $order_id );

		if ( ! $valid_nonce && ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( [ 'message' => 'Security verification failed' ] );
		}

		self::handle_order_save( $order_id );
		$result = self::sync_order_tracking( $order_id );

		if ( ! empty( $result['success'] ) ) {
			wp_send_json_success( [
				'message'     => 'Synced successfully with TrackingMore',
				'checkpoints' => $result['checkpoints'] ?? [],
			] );
		} else {
			wp_send_json_error( [
				'message' => $result['message'] ?? 'Could not sync with TrackingMore',
			] );
		}
	}

	public static function ajax_admin_sync_17track() {
		self::ajax_admin_sync_trackingmore();
	}

	/**
	 * Customer AJAX: Live Refresh Tracking Checkpoints from Order Page
	 */
	public static function ajax_refresh_order_tracking() {
		$order_id = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;
		if ( $order_id <= 0 ) {
			wp_send_json_error( [ 'message' => 'Invalid order ID' ] );
		}

		$nonce = isset( $_POST['security'] ) ? sanitize_text_field( $_POST['security'] ) : '';
		if ( ! wp_verify_nonce( $nonce, 'artmatter_customer_tracking_' . $order_id ) && ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( [ 'message' => 'Security check failed' ] );
		}

		// Ensure order is registered if not yet
		self::handle_order_save( $order_id );

		$result = self::sync_order_tracking( $order_id );
		if ( ! empty( $result['success'] ) ) {
			$order = wc_get_order( $order_id );
			$order_status = $order ? $order->get_status() : '';
			$result['order_status'] = $order_status;
			$result['status_name']  = $order ? wc_get_order_status_name( $order_status ) : '';
			$result['is_delivered'] = in_array( $order_status, [ 'completed', 'delivered' ], true );
			wp_send_json_success( $result );
		} else {
			wp_send_json_error( $result );
		}
	}
}

}

if ( ! class_exists( 'Artmatter_Shipping_Tracker' ) ) {
	class_alias( 'Exacoat_Shipping_Tracker', 'Artmatter_Shipping_Tracker' );
}

/**
 * Global helper wrappers for backward compatibility with theme snippets (#6902, #13537)
 * Deferred to init priority 999 so external snippets in WPCode Premium execute without fatal redeclare errors.
 */
add_action( 'init', function() {
	if ( ! function_exists( 'exacoat_get_carrier_tracking_url' ) ) {
		function exacoat_get_carrier_tracking_url( $carrier, $tracking_number ) {
			return Exacoat_Shipping_Tracker::get_carrier_tracking_url( $carrier, $tracking_number );
		}
	}

	if ( ! function_exists( 'artmatter_get_carrier_tracking_url' ) ) {
		function artmatter_get_carrier_tracking_url( $carrier, $tracking_number ) {
			return Exacoat_Shipping_Tracker::get_carrier_tracking_url( $carrier, $tracking_number );
		}
	}

	if ( ! function_exists( 'exacoat_email_tracking_info' ) ) {
		function exacoat_email_tracking_info( $order, $sent_to_admin = false, $plain_text = false, $email = null ) {
			Exacoat_Shipping_Tracker::render_email_tracking_info( $order, $sent_to_admin, $plain_text, $email );
		}
	}

	if ( ! function_exists( 'artmatter_email_tracking_info' ) ) {
		function artmatter_email_tracking_info( $order, $sent_to_admin = false, $plain_text = false, $email = null ) {
			Exacoat_Shipping_Tracker::render_email_tracking_info( $order, $sent_to_admin, $plain_text, $email );
		}
	}
}, 999 );
