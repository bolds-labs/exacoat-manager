<?php
/**
 * Artmatter Core Order Management & Production Engine
 * Handles custom WooCommerce order statuses, fulfillment tracking, master print vault links, and REST bridge.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Order_Manager' ) ) {

class Exacoat_Order_Manager {

	public static function init() {
		// 1. Register Custom Order Statuses in WooCommerce
		add_action( 'init', [ __CLASS__, 'register_custom_order_statuses' ] );
		add_filter( 'wc_order_statuses', [ __CLASS__, 'add_custom_order_statuses_to_wc' ] );
		add_filter( 'bulk_actions-edit-shop_order', [ __CLASS__, 'add_bulk_actions' ] );
		add_filter( 'woocommerce_reports_order_statuses', [ __CLASS__, 'add_reports_order_statuses' ] );
		add_filter( 'woocommerce_order_is_paid_statuses', [ __CLASS__, 'add_paid_order_statuses' ] );

		// 2. Order Status Transition Webhooks & Custom ZeptoMail Notifications
		add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'handle_order_status_changed' ], 10, 4 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'handle_payment_complete' ], 20, 1 );
		add_filter( 'woocommerce_get_return_url', [ __CLASS__, 'get_storefront_return_url' ], 9999, 2 );
		add_filter( 'woocommerce_paypal_return_url', [ __CLASS__, 'get_storefront_return_url' ], 9999, 2 );

		// 3. Customer Order Details Progress Timeline & Live Tracking Checkpoints
		add_action( 'woocommerce_order_details_before_order_table', [ __CLASS__, 'render_order_details_timeline' ], 5, 1 );
	}

	public static function add_reports_order_statuses( $statuses ) {
		$statuses[] = 'preparing-order';
		$statuses[] = 'ready-to-ship';
		$statuses[] = 'smb-ready';
		$statuses[] = 'smb-picked';
		$statuses[] = 'shipped';
		$statuses[] = 'completed';
		return array_unique( $statuses );
	}

	public static function add_paid_order_statuses( $statuses ) {
		$statuses[] = 'preparing-order';
		$statuses[] = 'ready-to-ship';
		$statuses[] = 'smb-ready';
		$statuses[] = 'smb-picked';
		$statuses[] = 'shipped';
		$statuses[] = 'completed';
		return array_unique( $statuses );
	}

	/**
	 * Register Custom WooCommerce Order Statuses for Precision Skin Production
	 */
	public static function register_custom_order_statuses() {
		register_post_status( 'wc-in-production', [
			'label'                     => _x( 'In Production', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'In Production <span class="count">(%s)</span>', 'In Production <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-quality-check', [
			'label'                     => _x( 'QC & Packaging', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'QC & Packaging <span class="count">(%s)</span>', 'QC & Packaging <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-awaiting-pickup', [
			'label'                     => _x( 'Awaiting Courier Pickup', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Awaiting Pickup <span class="count">(%s)</span>', 'Awaiting Pickup <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-preparing-order', [
			'label'                     => _x( 'Preparing order', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Preparing order <span class="count">(%s)</span>', 'Preparing order <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-ready-to-ship', [
			'label'                     => _x( 'Waiting for Courier Pickup', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Waiting for Courier Pickup <span class="count">(%s)</span>', 'Waiting for Courier Pickup <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-smb-ready', [
			'label'                     => _x( 'SMB Ready (Store Pickup)', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'SMB Ready <span class="count">(%s)</span>', 'SMB Ready <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-smb-picked', [
			'label'                     => _x( 'SMB Picked (Store Collected)', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'SMB Picked <span class="count">(%s)</span>', 'SMB Picked <span class="count">(%s)</span>', 'exacoat-core' ),
		] );

		register_post_status( 'wc-shipped', [
			'label'                     => _x( 'Shipped', 'Order status', 'exacoat-core' ),
			'public'                    => true,
			'exclude_from_search'       => false,
			'show_in_admin_all_list'    => true,
			'show_in_admin_status_list' => true,
			'label_count'               => _n_noop( 'Shipped <span class="count">(%s)</span>', 'Shipped <span class="count">(%s)</span>', 'exacoat-core' ),
		] );
	}

	/**
	 * Add Custom Statuses into standard WooCommerce order status lists
	 */
	public static function add_custom_order_statuses_to_wc( $order_statuses ) {
		$new_statuses = [];
		foreach ( $order_statuses as $key => $status ) {
			if ( 'wc-processing' === $key ) {
				$new_statuses['wc-processing']       = _x( 'Payment confirmed', 'Order status', 'exacoat-core' );
				$new_statuses['wc-preparing-order'] = _x( 'Preparing order', 'Order status', 'exacoat-core' );
				$new_statuses['wc-ready-to-ship']   = _x( 'Waiting for Courier Pickup', 'Order status', 'exacoat-core' );
				$new_statuses['wc-smb-ready']       = _x( 'SMB Ready (Store Pickup)', 'Order status', 'exacoat-core' );
				$new_statuses['wc-smb-picked']      = _x( 'SMB Picked (Store Collected)', 'Order status', 'exacoat-core' );
				$new_statuses['wc-shipped']         = _x( 'Shipped', 'Order status', 'exacoat-core' );
			} elseif ( 'wc-completed' === $key ) {
				$new_statuses['wc-completed']       = _x( 'Completed', 'Order status', 'exacoat-core' );
			} else {
				$new_statuses[ $key ] = $status;
			}
		}

		if ( ! isset( $new_statuses['wc-preparing-order'] ) ) {
			$new_statuses['wc-preparing-order'] = _x( 'Preparing order', 'Order status', 'exacoat-core' );
		}
		if ( ! isset( $new_statuses['wc-ready-to-ship'] ) ) {
			$new_statuses['wc-ready-to-ship'] = _x( 'Waiting for Courier Pickup', 'Order status', 'exacoat-core' );
		}
		if ( ! isset( $new_statuses['wc-smb-ready'] ) ) {
			$new_statuses['wc-smb-ready'] = _x( 'SMB Ready', 'Order status', 'exacoat-core' );
		}
		if ( ! isset( $new_statuses['wc-smb-picked'] ) ) {
			$new_statuses['wc-smb-picked'] = _x( 'SMB Picked', 'Order status', 'exacoat-core' );
		}
		if ( ! isset( $new_statuses['wc-shipped'] ) ) {
			$new_statuses['wc-shipped'] = _x( 'Shipped', 'Order status', 'exacoat-core' );
		}

		return $new_statuses;
	}

	/**
	 * Add Custom Statuses to bulk actions in WooCommerce Admin
	 */
	public static function add_bulk_actions( $bulk_actions ) {
		$bulk_actions['mark_preparing-order'] = __( 'Change status to preparing order', 'exacoat-core' );
		$bulk_actions['mark_ready-to-ship']   = __( 'Change status to waiting for pickup', 'exacoat-core' );
		$bulk_actions['mark_smb-ready']       = __( 'Change status to SMB ready', 'exacoat-core' );
		$bulk_actions['mark_smb-picked']      = __( 'Change status to SMB picked', 'exacoat-core' );
		$bulk_actions['mark_shipped']         = __( 'Change status to shipped', 'exacoat-core' );
		$bulk_actions['mark_completed']       = __( 'Change status to completed', 'exacoat-core' );
		return $bulk_actions;
	}

	/**
	 * REST Route: Get List of Orders with Rich Creator & Production Metadata
	 */
	public static function get_orders( WP_REST_Request $request ) {
		try {
			if ( ! function_exists( 'wc_get_orders' ) ) {
				return rest_ensure_response( [ 'success' => false, 'message' => 'WooCommerce is not active', 'orders' => [] ] );
			}

			$status   = sanitize_text_field( $request->get_param( 'status' ) ?: 'any' );
			$search   = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
			$courier  = sanitize_text_field( $request->get_param( 'courier' ) ?: '' );
			$page     = max( 1, intval( $request->get_param( 'page' ) ?: 1 ) );
			$per_page = max( 1, min( 250, intval( $request->get_param( 'per_page' ) ?: 50 ) ) );

			$args = [
				'limit'    => $per_page,
				'page'     => $page,
				'paginate' => true,
				'orderby'  => 'date',
				'order'    => 'DESC',
			];

			if ( 'any' !== $status && ! empty( $status ) ) {
				$clean_status = str_replace( 'wc-', '', $status );
				if ( 'ready-to-ship' === $clean_status ) {
					$args['status'] = [ 'ready-to-ship', 'awaiting-pickup', 'smb-ready' ];
				} elseif ( 'preparing-order' === $clean_status ) {
					$args['status'] = [ 'preparing-order', 'in-production' ];
				} elseif ( 'store-pickup' === $clean_status ) {
					$args['status'] = [ 'smb-ready', 'smb-picked' ];
				} elseif ( 'on-hold' === $clean_status ) {
					$args['status'] = [ 'on-hold', 'pending' ];
				} elseif ( 'warranty' === $clean_status ) {
					$args['meta_key'] = '_is_warranty_claim';
					$args['meta_value'] = 'yes';
				} elseif ( 'redeem' === $clean_status ) {
					$args['meta_key'] = '_is_redeem_claim';
					$args['meta_value'] = 'yes';
				} else {
					$args['status'] = $clean_status;
				}
			}

			if ( ! empty( $courier ) && 'all' !== strtolower( $courier ) ) {
				global $wpdb;
				$courier_raw = strtolower( trim( $courier ) );

				if ( in_array( $courier_raw, [ 'pickup', 'store-pickup', 'store pickup', 'smb' ], true ) ) {
					$pickup_order_ids = $wpdb->get_col(
						"SELECT DISTINCT order_id FROM {$wpdb->prefix}woocommerce_order_items 
						 WHERE order_item_type = 'shipping' 
						   AND (order_item_name LIKE '%pickup%' OR order_item_name LIKE '%smb%' OR order_item_name LIKE '%ambil%')"
					);
					$matched_ids = array_unique( array_filter( array_map( 'intval', $pickup_order_ids ?: [] ) ) );
				} else {
					$courier_map = [
						'pos'      => 'pos',
						'jne'      => 'jne',
						'sicepat'  => 'sicepat',
						'goorita'  => 'goorita',
						'dhl'      => 'dhl',
						'fedex'    => 'fedex',
						'lion'     => 'lion',
						'jnt'      => 'j&t',
						'biteship' => 'biteship',
					];

					$keyword = $courier_raw;
					foreach ( $courier_map as $k => $term ) {
						if ( false !== strpos( $courier_raw, $k ) ) {
							$keyword = $term;
							break;
						}
					}

					$like_keyword = '%' . $wpdb->esc_like( $keyword ) . '%';
					$like_raw     = '%' . $wpdb->esc_like( $courier_raw ) . '%';

					// 1. Check shipping method in woocommerce_order_items
					$shipping_order_ids = $wpdb->get_col( $wpdb->prepare(
						"SELECT DISTINCT order_id FROM {$wpdb->prefix}woocommerce_order_items 
						 WHERE order_item_type = 'shipping' 
						   AND (order_item_name LIKE %s OR order_item_name LIKE %s)",
						$like_keyword,
						$like_raw
					) );

					// 2. Check carrier metadata in postmeta or HPOS wc_orders_meta
					$meta_table = $wpdb->postmeta;
					$meta_id_col = 'post_id';
					$hpos_table = "{$wpdb->prefix}wc_orders_meta";
					if ( $wpdb->get_var( "SHOW TABLES LIKE '{$hpos_table}'" ) === $hpos_table ) {
						$meta_table = $hpos_table;
						$meta_id_col = 'order_id';
					}

					$meta_order_ids = $wpdb->get_col( $wpdb->prepare(
						"SELECT DISTINCT {$meta_id_col} FROM {$meta_table} 
						 WHERE (meta_key IN ('carrier_id', '_tracking_provider', '_ywot_carrier_id', 'tracking_courier') AND (meta_value LIKE %s OR meta_value LIKE %s))
						    OR (meta_key = '_artmatter_tracking_info' AND (meta_value LIKE %s OR meta_value LIKE %s))",
						$like_keyword,
						$like_raw,
						$like_keyword,
						$like_raw
					) );

					$matched_ids = array_unique( array_filter( array_merge( 
						array_map( 'intval', $shipping_order_ids ?: [] ), 
						array_map( 'intval', $meta_order_ids ?: [] ) 
					) ) );
				}

				if ( empty( $matched_ids ) ) {
					$args['post__in'] = [ 0 ];
					$args['include']  = [ 0 ];
				} else {
					$args['include'] = $matched_ids;
				}
			}

			if ( ! empty( $search ) ) {
				$args['s'] = $search;
			}

			$results = wc_get_orders( $args );
			$orders_data = [];

			if ( is_object( $results ) && isset( $results->orders ) && is_array( $results->orders ) ) {
				foreach ( $results->orders as $order ) {
					if ( $order && is_a( $order, 'WC_Order' ) ) {
						try {
							$orders_data[] = self::format_order_for_manager( $order );
						} catch ( Throwable $err ) {
							if ( class_exists( 'Artmatter_Logger' ) ) {
								Artmatter_Logger::error( 'orders', "Error formatting Order #{$order->get_id()}: " . $err->getMessage(), [
									'file'  => $err->getFile(),
									'line'  => $err->getLine(),
									'trace' => $err->getTraceAsString(),
								] );
							}
						}
					}
				}
				$total_orders = $results->total ?? count( $orders_data );
				$max_pages    = $results->max_num_pages ?? 1;
			} elseif ( is_array( $results ) ) {
				foreach ( $results as $order ) {
					if ( $order && is_a( $order, 'WC_Order' ) ) {
						try {
							$orders_data[] = self::format_order_for_manager( $order );
						} catch ( Throwable $err ) {
							if ( class_exists( 'Artmatter_Logger' ) ) {
								Artmatter_Logger::error( 'orders', "Error formatting Order #{$order->get_id()}: " . $err->getMessage(), [
									'file'  => $err->getFile(),
									'line'  => $err->getLine(),
									'trace' => $err->getTraceAsString(),
								] );
							}
						}
					}
				}
				$total_orders = count( $orders_data );
				$max_pages    = 1;
			} else {
				$total_orders = 0;
				$max_pages    = 1;
			}

			return rest_ensure_response( [
				'success'      => true,
				'total_orders' => (int) $total_orders,
				'max_pages'    => (int) $max_pages,
				'current_page' => $page,
				'orders'       => $orders_data,
			] );
		} catch ( Throwable $e ) {
			if ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::error( 'orders', 'Orders fetch exception: ' . $e->getMessage(), [
					'file'  => $e->getFile(),
					'line'  => $e->getLine(),
					'trace' => $e->getTraceAsString(),
				] );
			}
			return rest_ensure_response( [
				'success' => false,
				'message' => 'Orders fetch exception: ' . $e->getMessage(),
				'orders'  => [],
			] );
		}
	}

	/**
	 * REST Route: Get Single Order Details
	 */
	public static function get_single_order( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'id' );
		$order = wc_get_order( $order_id );

		if ( ! $order ) {
			return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
		}

		return rest_ensure_response( [
			'success' => true,
			'order'   => self::format_order_for_manager( $order ),
		] );
	}

	/**
	 * REST Route: Update Order Status
	 */
	public static function update_order_status( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'id' );
		$params   = $request->get_json_params() ?: $request->get_params();
		$new_status = sanitize_text_field( $params['status'] ?? '' );

		if ( empty( $new_status ) ) {
			return new WP_Error( 'missing_status', 'Status is required', [ 'status' => 400 ] );
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
		}

		$clean_status    = str_replace( 'wc-', '', $new_status );
		$notify_customer = isset( $params['notify_customer'] ) ? (bool) $params['notify_customer'] : true;

		// Suppress customer email if notify_customer is explicitly false
		if ( ! $notify_customer ) {
			add_filter( 'woocommerce_email_enabled_customer_processing_order', '__return_false', 99 );
			add_filter( 'woocommerce_email_enabled_customer_completed_order', '__return_false', 99 );
			add_filter( 'woocommerce_email_enabled_customer_invoice', '__return_false', 99 );
		}

		$order->update_status( $clean_status, 'Status updated via Artmatter Manager ERP' );

		if ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::info( 'orders', "Status for Order #{$order_id} updated to '{$clean_status}' via Manager ERP", [
				'order_id'   => $order_id,
				'new_status' => $clean_status,
			] );
		}

		return rest_ensure_response( [
			'success' => true,
			'message' => "Order #{$order_id} status updated to {$clean_status}",
			'order'   => self::format_order_for_manager( $order ),
		] );
	}

	/**
	 * REST Route: Fulfill Order & Attach Tracking Information
	 */
	public static function fulfill_order( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'id' );
		$params   = $request->get_json_params() ?: $request->get_params();

		$courier         = sanitize_text_field( $params['courier'] ?? 'JNE Express' );
		$tracking_number = sanitize_text_field( $params['tracking_number'] ?? '' );
		$tracking_url    = esc_url_raw( $params['tracking_url'] ?? '' );
		$new_status      = sanitize_text_field( $params['status'] ?? 'none' );
		$notify_customer = ! empty( $params['notify_customer'] );

		if ( empty( $tracking_number ) ) {
			return new WP_Error( 'missing_tracking', 'Tracking number is required', [ 'status' => 400 ] );
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
		}

		// Normalize carrier key
		$carrier_map = [
			'jne'                 => 'jne',
			'jne express'         => 'jne',
			'sicepat'             => 'sicepat',
			'pos'                 => 'pos',
			'pos indonesia'       => 'pos',
			'goorita'             => 'goorita',
			'goorita send usa'    => 'goorita',
			'dhl'                 => 'dhl',
			'dhl express'         => 'dhl',
			'fedex'               => 'fedex',
			'fedex international' => 'fedex',
			'biteship'            => 'biteship',
			'lion'                => 'lion',
			'lion parcel'         => 'lion',
			'jnt'                 => 'jnt',
			'j&t express'         => 'jnt',
		];
		$carrier_id = $carrier_map[ strtolower( trim( $courier ) ) ] ?? strtolower( trim( $courier ) );

		if ( empty( $tracking_url ) && class_exists( 'Artmatter_Shipping_Tracker' ) ) {
			$tracking_url = Artmatter_Shipping_Tracker::get_carrier_tracking_url( $carrier_id, $tracking_number );
		}

		$carrier_labels = [
			'jne'     => 'JNE Express',
			'sicepat' => 'SiCepat',
			'pos'     => 'POS Indonesia',
			'goorita' => 'Goorita Send USA',
			'dhl'     => 'DHL Express',
			'fedex'   => 'FedEx International',
			'biteship'=> 'Biteship',
			'lion'    => 'Lion Parcel',
			'jnt'     => 'J&T Express',
		];
		$carrier_display = $carrier_labels[ $carrier_id ] ?? ( ! empty( $courier ) ? $courier : 'Express Courier' );

		// Save tracking metadata
		$tracking_info = [
			'courier'         => $carrier_display,
			'carrier_id'      => $carrier_id,
			'tracking_number' => $tracking_number,
			'tracking_url'    => $tracking_url,
			'shipped_at'      => current_time( 'mysql' ),
		];

		// Save to WooCommerce Order object metadata (HPOS compatible)
		$order->update_meta_data( 'tracking_number', $tracking_number );
		$order->update_meta_data( 'carrier_id', $carrier_id );
		$order->update_meta_data( '_artmatter_tracking_info', $tracking_info );
		$order->update_meta_data( '_artmatter_courier', $carrier_display );
		$order->update_meta_data( '_artmatter_tracking_number', $tracking_number );
		$order->update_meta_data( '_tracking_number', $tracking_number );
		$order->update_meta_data( '_tracking_provider', $carrier_display );
		$order->save();

		// Save to traditional postmeta and ACF fields
		update_post_meta( $order_id, 'tracking_number', $tracking_number );
		update_post_meta( $order_id, 'carrier_id', $carrier_id );
		update_post_meta( $order_id, '_artmatter_tracking_info', $tracking_info );
		update_post_meta( $order_id, '_artmatter_courier', $carrier_display );
		update_post_meta( $order_id, '_artmatter_tracking_number', $tracking_number );
		update_post_meta( $order_id, '_tracking_number', $tracking_number );
		update_post_meta( $order_id, '_tracking_provider', $carrier_display );
		update_post_meta( $order_id, '_ywot_tracking_code', $tracking_number );
		update_post_meta( $order_id, '_ywot_carrier_id', $carrier_id );

		if ( function_exists( 'update_field' ) ) {
			update_field( 'tracking_number', $tracking_number, $order_id );
			update_field( 'carrier_id', $carrier_id, $order_id );
		}

		// Update order status: default to 'shipped' on fulfillment
		$requested_status = sanitize_text_field( $params['status'] ?? '' );
		$new_status       = ! empty( $requested_status ) && 'none' !== $requested_status ? $requested_status : 'shipped';
		if ( 'completed' === $new_status ) {
			$new_status = 'shipped';
		}

		$clean_status = str_replace( 'wc-', '', $new_status );
		$order->update_status( $clean_status, "Order tracking updated with {$carrier_display} #{$tracking_number}" );

		// Automatically register tracking with 17TRACK
		if ( class_exists( 'Artmatter_Shipping_Tracker' ) && ! empty( $tracking_number ) ) {
			Artmatter_Shipping_Tracker::register_with_17track( $tracking_number, $carrier_id, $order_id );
		}

		if ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::info( 'shipping', "Tracking details saved for Order #{$order_id}: {$carrier_display} #{$tracking_number}", [
				'order_id'        => $order_id,
				'courier'         => $carrier_display,
				'carrier_id'      => $carrier_id,
				'tracking_number' => $tracking_number,
				'tracking_url'    => $tracking_url,
			] );
		}

		// Send customized dark-mode tracking email if enabled or if order is now shipped
		$current_status = str_replace( 'wc-', '', $order->get_status() );
		if ( ( $notify_customer || in_array( $current_status, [ 'shipped', 'completed' ], true ) ) && class_exists( 'Artmatter_Email_Engine' ) && 'none' !== $new_status ) {
			self::send_customer_shipping_email( $order, $tracking_info );
		}

		return rest_ensure_response( [
			'success'       => true,
			'message'       => "Tracking details saved ({$carrier_display} #{$tracking_number})",
			'tracking_info' => $tracking_info,
			'order'         => self::format_order_for_manager( $order ),
		] );
	}

	/**
	 * Process WooCommerce Native Refund directly via REST API
	 */
	public static function process_refund( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'id' );
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
		}

		$params                 = $request->get_json_params() ?: $request->get_params();
		$refund_amount          = floatval( $params['amount'] ?? 0 );
		$reason                 = sanitize_text_field( $params['reason'] ?? 'Manual refund via Studio Manager' );
		$restock                = ! empty( $params['restock_items'] );
		$refund_to_store_credit = ! empty( $params['refund_to_store_credit'] );
		$line_items             = $params['line_items'] ?? [];

		if ( $refund_amount <= 0 ) {
			return new WP_Error( 'invalid_amount', 'Refund amount must be greater than 0', [ 'status' => 400 ] );
		}

		$available_refund = max( 0, round( floatval( $order->get_total() ) - floatval( $order->get_total_refunded() ), 2 ) );
		if ( $refund_amount > $available_refund ) {
			return new WP_Error( 'amount_exceeded', "Refund amount ({$refund_amount}) exceeds available refundable balance ({$available_refund})", [ 'status' => 400 ] );
		}

		$customer_id = $order->get_customer_id();

		// Handle Advanced Coupons store credit refund if requested
		if ( $refund_to_store_credit ) {
			if ( ! $customer_id ) {
				return new WP_Error( 'guest_customer', 'Store credit refunds require a registered customer account.', [ 'status' => 400 ] );
			}

			$store_credit_issued = false;

			// 1. Try ACFW official helper classes if loaded
			if ( class_exists( 'ACFW_Store_Credits' ) && method_exists( 'ACFW_Store_Credits', 'add_credit' ) ) {
				try {
					\ACFW_Store_Credits::add_credit( $customer_id, $refund_amount, "Refund for Order #{$order_id}" );
					$store_credit_issued = true;
				} catch ( Throwable $e ) {
					// Fallback
				}
			}

			// 2. Action hooks (Advanced Coupons & store credit ecosystem)
			if ( ! $store_credit_issued ) {
				do_action( 'acfw_add_store_credit', $customer_id, $refund_amount, "Refund for Order #{$order_id}" );
				do_action( 'advanced_coupons_add_store_credit', $customer_id, $refund_amount, "Refund for Order #{$order_id}" );
			}

			// 3. User meta update for acfw_store_credit_balance
			$current_bal = floatval( get_user_meta( $customer_id, 'acfw_store_credit_balance', true ) );
			$new_bal     = round( $current_bal + $refund_amount, 2 );
			update_user_meta( $customer_id, 'acfw_store_credit_balance', $new_bal );

			// Prefix reason with Store Credit
			if ( stripos( $reason, 'store credit' ) === false ) {
				$reason = empty( $reason ) ? 'Refunded to Store Credit' : "Store Credit: {$reason}";
			}

			$order->add_order_note( "Refunded " . wc_price( $refund_amount ) . " to customer store credit balance (New balance: " . wc_price( $new_bal ) . ")." );
		}

		$refund_args = [
			'amount'           => $refund_amount,
			'reason'           => $reason,
			'order_id'         => $order_id,
			'restock_items'    => $restock,
			'refunded_payment' => ! $refund_to_store_credit,
		];

		if ( ! empty( $line_items ) && is_array( $line_items ) ) {
			$refund_args['line_items'] = $line_items;
		}

		$refund = wc_create_refund( $refund_args );

		if ( is_wp_error( $refund ) ) {
			if ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::error( 'refunds', "Failed creating refund for Order #{$order_id}: " . $refund->get_error_message(), [
					'order_id' => $order_id,
					'amount'   => $refund_amount,
					'reason'   => $reason,
				] );
			}
			return new WP_Error( 'refund_failed', $refund->get_error_message(), [ 'status' => 500 ] );
		}

		// Refresh order instance
		$updated_order = wc_get_order( $order_id );

		// If fully refunded, mark status as refunded
		if ( floatval( $updated_order->get_total_refunded() ) >= floatval( $updated_order->get_total() ) ) {
			$updated_order->update_status( 'refunded', "Order fully refunded ({$refund_amount}) via Studio Manager" );
		}

		if ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::info( 'refunds', "Refund #{$refund->get_id()} of " . number_format( $refund_amount, 2 ) . " processed for Order #{$order_id}", [
				'order_id'               => $order_id,
				'refund_id'              => $refund->get_id(),
				'refund_amount'          => $refund_amount,
				'reason'                 => $reason,
				'restock'                => $restock,
				'refund_to_store_credit' => $refund_to_store_credit,
			] );
		}

		return rest_ensure_response( [
			'success'       => true,
			'refund_id'     => $refund->get_id(),
			'message'       => $refund_to_store_credit 
				? "Refund of " . number_format( $refund_amount, 2 ) . " issued to Store Credit"
				: "Refund of " . number_format( $refund_amount, 2 ) . " processed",
			'order'         => self::format_order_for_manager( $updated_order ),
		] );
	}

	/**
	 * Extract legacy custom product addons (e.g. WooCommerce Product Add-ons, Acowebs WCPA, Order #542240)
	 */
	public static function extract_custom_addons( $item ): array {
		$addons = [];
		if ( ! $item || ! method_exists( $item, 'get_meta_data' ) ) {
			return $addons;
		}

		$seen = [];
		$add_entry = function( $label, $value ) use ( &$addons, &$seen ) {
			$l = trim( wp_strip_all_tags( (string) $label ) );
			$v = trim( wp_strip_all_tags( (string) $value ) );
			if ( empty( $l ) || empty( $v ) ) return;
			// Strip legacy price adjustments e.g. (+Rp 0), (+Rp 25.000)
			$v = preg_replace( '/\s*\(\+[^)]+\)\s*$/i', '', $v );
			$sig = strtolower( $l . ':' . $v );
			if ( ! isset( $seen[ $sig ] ) ) {
				$seen[ $sig ] = true;
				$addons[] = [
					'label'         => $l,
					'name'          => $l,
					'value'         => $v,
					'display_value' => $v,
				];
			}
		};

		foreach ( $item->get_meta_data() as $m ) {
			$m_data = is_object( $m ) && method_exists( $m, 'get_data' ) ? $m->get_data() : (array) $m;
			$key    = strtolower( trim( (string) ( $m_data['key'] ?? '' ) ) );
			$val    = maybe_unserialize( $m_data['value'] ?? '' );

			if ( empty( $key ) ) continue;

			// Check Acowebs WCPA (_wcpa_order_meta_data)
			if ( str_contains( $key, 'wcpa' ) ) {
				if ( is_array( $val ) ) {
					foreach ( $val as $entry ) {
						if ( is_array( $entry ) ) {
							$lbl = $entry['label'] ?? ( $entry['name'] ?? '' );
							$v   = $entry['value'] ?? ( $entry['display_value'] ?? '' );
							if ( is_array( $v ) ) {
								$v = implode( ', ', array_map( 'strval', $v ) );
							}
							$add_entry( $lbl, $v );
						}
					}
				}
			}

			// Check official WooCommerce Product Add-Ons (_pao_ids, _pao_addon_values, addons)
			if ( str_contains( $key, 'pao' ) || $key === 'addons' || $key === '_addons' || $key === '_custom_product_addons' ) {
				if ( is_array( $val ) ) {
					foreach ( $val as $entry ) {
						if ( is_array( $entry ) ) {
							$lbl = $entry['name'] ?? ( $entry['label'] ?? ( $entry['title'] ?? '' ) );
							$v   = $entry['value'] ?? ( $entry['display_value'] ?? '' );
							if ( is_array( $v ) ) {
								$v = implode( ', ', array_map( 'strval', $v ) );
							}
							$add_entry( $lbl, $v );
						}
					}
				}
			}

			// Check exacoat configurator custom addons
			if ( $key === 'exacoat_addons' || $key === '_exacoat_addons' ) {
				if ( is_array( $val ) ) {
					foreach ( $val as $entry ) {
						if ( is_array( $entry ) ) {
							$lbl = $entry['label'] ?? ( $entry['name'] ?? '' );
							$v   = $entry['value'] ?? '';
							$add_entry( $lbl, $v );
						}
					}
				}
			}
		}

		return $addons;
	}

	/**
	 * Helper: Format WooCommerce Order object into rich ERP JSON structure
	 */
	public static function format_order_for_manager( $order ): array {
		$order_id = $order->get_id();

		// 1. Resolve tracking info from WooCommerce Order Meta / ACF / HPOS
		$clean_tracking = function( $val ) {
			if ( ! is_scalar( $val ) ) return '';
			$s = trim( (string) $val );
			if ( empty( $s ) || str_starts_with( $s, 'field_' ) ) return '';
			return $s;
		};

		$tracking_code = $clean_tracking( $order->get_meta( 'tracking_number' ) )
			?: ( $clean_tracking( get_post_meta( $order_id, 'tracking_number', true ) )
			?: ( function_exists( 'get_field' ) ? $clean_tracking( get_field( 'tracking_number', $order_id ) ) : '' ) );

		$carrier_val = $clean_tracking( $order->get_meta( 'carrier_id' ) )
			?: ( $clean_tracking( get_post_meta( $order_id, 'carrier_id', true ) )
			?: ( function_exists( 'get_field' ) ? $clean_tracking( get_field( 'carrier_id', $order_id ) ) : '' ) );

		if ( empty( $tracking_code ) ) {
			$raw_meta = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order_id, '_artmatter_tracking_info', true );
			if ( is_array( $raw_meta ) && ! empty( $clean_tracking( $raw_meta['tracking_number'] ?? '' ) ) ) {
				$tracking_code = $clean_tracking( $raw_meta['tracking_number'] );
				$carrier_val   = $clean_tracking( $raw_meta['carrier_id'] ?? ( $raw_meta['courier'] ?? $carrier_val ) );
			}
		}

		if ( empty( $tracking_code ) ) {
			$wc_st_items = $order->get_meta( '_wc_shipment_tracking_items' ) ?: get_post_meta( $order_id, '_wc_shipment_tracking_items', true );
			if ( is_array( $wc_st_items ) && ! empty( $wc_st_items ) ) {
				$first_item = reset( $wc_st_items );
				if ( ! empty( $clean_tracking( $first_item['tracking_number'] ?? '' ) ) ) {
					$tracking_code = $clean_tracking( $first_item['tracking_number'] );
					$carrier_val   = $clean_tracking( $first_item['custom_tracking_provider'] ?: ( $first_item['tracking_provider'] ?: $carrier_val ) );
				}
			}
		}

		if ( empty( $tracking_code ) ) {
			$tracking_code = $clean_tracking( $order->get_meta( '_ywot_tracking_code' ) )
				?: ( $clean_tracking( get_post_meta( $order_id, '_ywot_tracking_code', true ) )
				?: ( $clean_tracking( $order->get_meta( 'yith_wcmg_tracking_code' ) )
				?: $clean_tracking( get_post_meta( $order_id, 'yith_wcmg_tracking_code', true ) ) ) );

			$carrier_val = $clean_tracking( $order->get_meta( '_tracking_provider' ) )
				?: ( $clean_tracking( get_post_meta( $order_id, '_tracking_provider', true ) )
				?: ( $clean_tracking( $order->get_meta( '_ywot_carrier_id' ) )
				?: ( $clean_tracking( get_post_meta( $order_id, '_ywot_carrier_id', true ) )
				?: $carrier_val ) ) );
		}

		$tracking = null;
		if ( ! empty( $tracking_code ) ) {
			$carrier_key = strtolower( trim( (string) $carrier_val ) );
			$carrier_labels = [
				'jne'                 => 'JNE Express',
				'sicepat'             => 'SiCepat',
				'pos'                 => 'POS Indonesia',
				'goorita'             => 'Goorita Send USA',
				'dhl'                 => 'DHL Express',
				'fedex'               => 'FedEx International',
				'biteship'            => 'Biteship',
				'lion'                => 'Lion Parcel',
				'jnt'                 => 'J&T Express',
			];
			$carrier_display = $carrier_labels[ $carrier_key ] ?? ( ! empty( $carrier_val ) ? ucfirst( (string) $carrier_val ) : 'Express Courier' );

			$tracking_url = class_exists( 'Artmatter_Shipping_Tracker' )
				? Artmatter_Shipping_Tracker::get_carrier_tracking_url( $carrier_key, $tracking_code )
				: '';

			$tracking = [
				'courier'         => $carrier_display,
				'carrier_id'      => $carrier_key ?: 'jne',
				'tracking_number' => (string) $tracking_code,
				'tracking_url'    => $tracking_url,
				'shipped_at'      => null,
			];
		}

		$items_data = [];
		$total_commissions = 0;

		foreach ( $order->get_items() as $item_id => $item ) {
			$product_id = $item->get_product_id();
			$product    = $item->get_product();

			$img_url = '';
			if ( $product ) {
				$img_id = $product->get_image_id();
				if ( $img_id ) {
					$img_url = wp_get_attachment_image_url( $img_id, 'medium' ) ?: '';
				}
			}

			$orientation = get_post_meta( $product_id, 'artwork_orientation', true ) ?: '';
			$feelform    = get_post_meta( $product_id, 'artwork_feelform', true ) ?: '';

			// Check line item metadata for customer selected finish (if any)
			$item_finish = $item->get_meta( 'print_finish' )
				?: ( $item->get_meta( 'Print Finish' )
				?: ( $item->get_meta( 'finish' )
				?: ( $item->get_meta( 'Finish' )
				?: ( $item->get_meta( 'feelform_mode' )
				?: ( $item->get_meta( 'FeelForm' )
				?: '' ) ) ) ) );

			if ( ! empty( $item_finish ) ) {
				$feelform = ( stripos( (string) $item_finish, 'flat' ) !== false ) ? 'flat' : (string) $item_finish;
			}

			// Vault / Master Print File URL resolver (if attached to product)
			$vault_file_url = '';
			if ( $product ) {
				$img_id = $product->get_image_id();
				if ( $img_id ) {
					$vault_file_url = wp_get_attachment_url( $img_id ) ?: '';
				}
			}

			// Item Financials
			$quantity   = max( 1, intval( $item->get_quantity() ) );
			$subtotal   = floatval( $item->get_subtotal() );
			$total      = floatval( $item->get_total() );
			$discount   = max( 0, round( $subtotal - $total, 2 ) );
			$tax        = floatval( $item->get_total_tax() );
			$unit_price = round( $subtotal / $quantity, 2 );

			// Item Refund Data (Safely extract across all WooCommerce versions)
			$qty_refunded = 0;
			$amt_refunded = 0;
			$tax_refunded = 0;

			if ( method_exists( $order, 'get_qty_refunded_for_item' ) ) {
				try {
					$qty_refunded = abs( intval( $order->get_qty_refunded_for_item( $item_id ) ) );
				} catch ( Throwable $e ) {
					$qty_refunded = 0;
				}
			}

			if ( method_exists( $order, 'get_total_refunded_for_item' ) ) {
				try {
					$amt_refunded = abs( floatval( $order->get_total_refunded_for_item( $item_id ) ) );
				} catch ( Throwable $e ) {
					$amt_refunded = 0;
				}
			}

			if ( method_exists( $order, 'get_taxes_refunded_for_item' ) ) {
				try {
					$taxes = $order->get_taxes_refunded_for_item( $item_id );
					if ( is_array( $taxes ) ) {
						$tax_refunded = abs( floatval( array_sum( $taxes ) ) );
					}
				} catch ( Throwable $e ) {
					$tax_refunded = 0;
				}
			}

			$formatted_meta = [];
			if ( method_exists( $item, 'get_formatted_meta_data' ) ) {
				foreach ( $item->get_formatted_meta_data() as $m ) {
					$formatted_meta[] = [
						'key'           => $m->key,
						'label'         => $m->display_key,
						'value'         => wp_strip_all_tags( $m->display_value ),
						'display_value' => wp_strip_all_tags( $m->display_value ),
					];
				}
			}

			// Extract legacy custom product addons (WooCommerce Product Add-ons / Acowebs WCPA, e.g. Order #542240)
			$custom_addons = self::extract_custom_addons( $item );
			if ( ! empty( $custom_addons ) ) {
				foreach ( $custom_addons as $ca ) {
					$formatted_meta[] = [
						'key'           => $ca['label'],
						'label'         => $ca['label'],
						'value'         => $ca['value'],
						'display_value' => $ca['display_value'],
					];
				}
			}

			$meta_data = [];
			if ( method_exists( $item, 'get_meta_data' ) ) {
				foreach ( $item->get_meta_data() as $m ) {
					$m_data = is_object( $m ) && method_exists( $m, 'get_data' ) ? $m->get_data() : (array) $m;
					$raw_val = $m_data['value'] ?? '';
					$meta_data[] = [
						'id'    => $m_data['id'] ?? null,
						'key'   => $m_data['key'] ?? '',
						'value' => maybe_unserialize( $raw_val ),
					];
				}
			}

			$items_data[] = [
				'id'                   => $item_id,
				'product_id'           => $product_id,
				'name'                 => $item->get_name(),
				'quantity'             => $quantity,
				'price'                => $unit_price,
				'subtotal'             => $subtotal,
				'total'                => $total,
				'discount'             => $discount,
				'tax'                  => $tax,
				'qty_refunded'         => $qty_refunded,
				'amount_refunded'      => $amt_refunded,
				'tax_refunded'         => $tax_refunded,
				'is_refunded'          => $qty_refunded >= $quantity,
				'sku'                  => $product ? $product->get_sku() : '',
				'image_url'            => $img_url,
				'orientation'          => $orientation,
				'feelform_mode'        => $feelform,
				'vault_print_file_url' => $vault_file_url,
				'artist_id'            => null,
				'artist_name'          => null,
				'artist_username'      => null,
				'commission_rate'      => 0,
				'commission_amount'    => 0,
				'meta_data'            => $meta_data,
				'formatted_meta'       => $formatted_meta,
				'custom_addons'        => $custom_addons,
			];
		}

		// Fee items (e.g. Shipping Privilege discount, custom surcharges, RMA adjustments)
		$fees_data = [];
		$fee_total = 0;
		foreach ( $order->get_fees() as $fee_id => $fee ) {
			$f_total = floatval( $fee->get_total() );
			$f_tax   = floatval( $fee->get_total_tax() );
			$fee_total += $f_total;
			$fee_name = $fee->get_name();

			if ( strtolower( trim( $fee_name ) ) === 'price adjustment' ) {
				$rma_type = strtolower( (string) $order->get_meta( '_rma_order_type' ) );
				$is_warranty = ( 'warranty' === $rma_type ) || ( 'yes' === (string) $order->get_meta( '_is_warranty' ) ) || ( 'WARRANTY' === (string) $order->get_meta( '_order_badge' ) );
				$is_redeem   = ( 'redeem' === $rma_type ) || ( 'yes' === (string) $order->get_meta( '_is_redeem' ) ) || ( 'REDEEM' === (string) $order->get_meta( '_order_badge' ) );

				if ( $is_warranty ) {
					$fee_name = __( 'Installation Warranty', 'exacoat-core' );
				} elseif ( $is_redeem ) {
					$fee_name = __( 'Redeem Discount', 'exacoat-core' );
				} else {
					$fee_name = __( 'Warranty / Claim Discount', 'exacoat-core' );
				}
			}

			$fees_data[] = [
				'id'    => $fee_id,
				'name'  => $fee_name,
				'total' => $f_total,
				'tax'   => $f_tax,
			];
		}

		// Coupons used
		$coupons_data = [];
		foreach ( $order->get_coupons() as $coupon_id => $coupon ) {
			$coupons_data[] = [
				'id'              => $coupon_id,
				'code'            => $coupon->get_code(),
				'discount_amount' => floatval( $coupon->get_discount() ),
				'discount_tax'    => floatval( $coupon->get_discount_tax() ),
			];
		}
		$coupon_codes = $order->get_coupon_codes();

		// Refunds list and remaining available refundable amount
		$total_refunded   = floatval( $order->get_total_refunded() );
		$available_refund = max( 0, round( floatval( $order->get_total() ) - $total_refunded, 2 ) );
		$refunds_data     = [];
		foreach ( $order->get_refunds() as $ref ) {
			$refunds_data[] = [
				'id'           => $ref->get_id(),
				'amount'       => floatval( $ref->get_amount() ),
				'reason'       => $ref->get_reason() ?: 'Manual refund',
				'date_created' => $ref->get_date_created() ? $ref->get_date_created()->date( 'c' ) : '',
				'refunded_by'  => $ref->get_refunded_by(),
			];
		}

		// Order Notes & Timeline history
		$notes_data = self::get_formatted_order_notes( $order_id );

		$shipping = $order->get_address( 'shipping' );
		$billing  = $order->get_address( 'billing' );

		$cust_id = $order->get_customer_id();
		$store_credit_balance = 0;
		if ( $cust_id ) {
			$store_credit_balance = floatval( get_user_meta( $cust_id, 'acfw_store_credit_balance', true ) );
		}

		// Collector Review Info
		$review_data = null;
		if ( $order->get_meta( '_artmatter_has_review' ) ) {
			global $wpdb;
			$rev_table = $wpdb->prefix . 'artmatter_reviews';
			$r_row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$rev_table} WHERE order_id = %d LIMIT 1", $order_id ), ARRAY_A );
			if ( $r_row ) {
				$r_row['rating'] = (int) $r_row['rating'];
				$r_row['media']  = json_decode( $r_row['media'] ?? '[]', true ) ?: [];
				$review_data     = $r_row;
			}
		}

		$currency_code = strtoupper( (string) $order->get_currency() );
		$raw_order_total = floatval( $order->get_total() );
		$calculated_total_idr = $raw_order_total;
		if ( 'IDR' !== $currency_code && class_exists( 'Exacoat_Store_Enhancements' ) && method_exists( 'Exacoat_Store_Enhancements', 'get_currency_rates' ) ) {
			$all_rates = Exacoat_Store_Enhancements::get_currency_rates();
			$fx_entry = $all_rates[ $currency_code ] ?? null;
			$fx_rate = is_array( $fx_entry ) ? floatval( $fx_entry['rate'] ?? 0 ) : floatval( $fx_entry );
			if ( $fx_rate > 0 ) {
				$calculated_total_idr = round( $raw_order_total / $fx_rate );
			}
		}

		return [
			'id'                            => $order_id,
			'order_number'                  => '#' . $order->get_order_number(),
			'status'                        => $order->get_status(),
			'currency'                      => $order->get_currency(),
			'subtotal'                      => floatval( $order->get_subtotal() ),
			'discount_total'                => floatval( $order->get_discount_total() ),
			'discount_tax'                  => floatval( $order->get_discount_tax() ),
			'fee_total'                     => $fee_total,
			'fees'                          => $fees_data,
			'coupons'                       => $coupons_data,
			'coupon_codes'                  => $coupon_codes,
			'shipping_total'                => floatval( $order->get_shipping_total() ),
			'shipping_tax'                  => floatval( $order->get_shipping_tax() ),
			'shipping_method_name'          => $order->get_shipping_method() ?: 'Standard Tracked Delivery',
			'total_tax'                     => floatval( $order->get_total_tax() ),
			'total'                         => floatval( $order->get_total() ),
			'total_idr'                     => $calculated_total_idr,
			'total_refunded'                => $total_refunded,
			'remaining_refund_available'    => $available_refund,
			'refunds'                       => $refunds_data,
			'created_at'                    => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : current_time( 'c' ),
			'date_paid'                     => $order->get_date_paid() ? $order->get_date_paid()->date( 'c' ) : null,
			'date_completed'                => $order->get_date_completed() ? $order->get_date_completed()->date( 'c' ) : null,
			'customer_ip'                   => $order->get_customer_ip_address() ?: '',
			'customer_id'                   => $cust_id,
			'customer_store_credit_balance' => $store_credit_balance,
			'customer_name'                 => trim( ( $shipping['first_name'] ?? '' ) . ' ' . ( $shipping['last_name'] ?? '' ) ) ?: ( trim( ( $billing['first_name'] ?? '' ) . ' ' . ( $billing['last_name'] ?? '' ) ) ?: 'Store Customer' ),
			'customer_email'                => $order->get_billing_email(),
			'customer_phone'                => $order->get_billing_phone(),
			'customer_note'                 => $order->get_customer_note(),
			'payment_method'                => $order->get_payment_method(),
			'payment_method_title'          => $order->get_payment_method_title(),
			'shipping'                   => $shipping,
			'billing'                    => $billing,
			'items'                      => $items_data,
			'item_count'                 => count( $items_data ),
			'tracking'                   => is_array( $tracking ) ? $tracking : null,
			'notes'                      => $notes_data,
			'total_commission'           => round( $total_commissions, 2 ),
			'total_commission_usd'       => round( $total_commissions, 2 ),
			'review'                     => $review_data,
			'review_invite_scheduled_at' => $order->get_meta( '_artmatter_review_invite_scheduled_at' ) ?: null,
			'review_invited_at'          => $order->get_meta( '_artmatter_review_invited_at' ) ?: null,
		];
	}

	/**
	 * Helper: Format Order Notes for ERP Timeline
	 */
	public static function get_formatted_order_notes( $order_id ): array {
		$notes_data = [];

		if ( function_exists( 'wc_get_order_notes' ) ) {
			$raw_notes = wc_get_order_notes( [ 'order_id' => $order_id ] );
			foreach ( $raw_notes as $n ) {
				$raw_added_by = trim( (string) $n->added_by );
				$author_name  = $raw_added_by ?: 'System';
				$author_role  = 'System';
				$author_avatar = '';

				if ( ! empty( $raw_added_by ) && 'system' !== strtolower( $raw_added_by ) ) {
					$user = is_numeric( $raw_added_by ) ? get_user_by( 'id', (int) $raw_added_by ) : get_user_by( 'login', $raw_added_by );
					if ( ! $user ) {
						$user = get_user_by( 'slug', $raw_added_by ) ?: get_user_by( 'email', $raw_added_by );
					}
					if ( $user ) {
						$author_name = $user->display_name ?: $user->user_login;
						$roles = (array) $user->roles;
						if ( in_array( 'administrator', $roles, true ) ) {
							$author_role = 'Administrator';
						} elseif ( in_array( 'shop_manager', $roles, true ) ) {
							$author_role = 'Shop Manager';
						} elseif ( in_array( 'customer', $roles, true ) ) {
							$author_role = 'Customer';
						} else {
							$author_role = ! empty( $roles[0] ) ? ucfirst( $roles[0] ) : 'Staff';
						}
						$author_avatar = get_avatar_url( $user->ID, [ 'size' => 48 ] ) ?: '';
					} else {
						$author_name = ucfirst( $raw_added_by );
						$author_role = 'Staff';
					}
				}

				$notes_data[] = [
					'id'            => $n->id,
					'content'       => $n->content,
					'date_created'  => $n->date_created ? $n->date_created->date( 'c' ) : '',
					'customer_note' => (bool) $n->customer_note,
					'added_by'      => $author_name,
					'author_name'   => $author_name,
					'author_role'   => $author_role,
					'author_avatar' => $author_avatar,
				];
			}
		}
		return $notes_data;
	}

	/**
	 * REST Route: Handle Order Notes (List & Create)
	 */
	public static function handle_order_notes( WP_REST_Request $request ) {
		$order_id = (int) $request->get_param( 'id' );
		$order    = wc_get_order( $order_id );

		if ( ! $order ) {
			return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
		}

		if ( 'POST' === $request->get_method() ) {
			$params       = $request->get_json_params() ?: $request->get_params();
			$note_content = sanitize_textarea_field( $params['note'] ?? '' );
			$is_customer  = ! empty( $params['is_customer_note'] );

			if ( empty( $note_content ) ) {
				return new WP_Error( 'missing_note', 'Note content is required', [ 'status' => 400 ] );
			}

			$note_id = $order->add_order_note( $note_content, $is_customer, true );

			if ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::info( 'orders', "Added " . ( $is_customer ? 'customer' : 'internal staff' ) . " note to Order #{$order_id}", [
					'order_id'    => $order_id,
					'note_id'     => $note_id,
					'is_customer' => $is_customer,
					'snippet'     => mb_substr( $note_content, 0, 120 ),
				] );
			}

			return rest_ensure_response( [
				'success' => true,
				'note_id' => $note_id,
				'message' => 'Order note added successfully',
				'notes'   => self::get_formatted_order_notes( $order_id ),
			] );
		}

		return rest_ensure_response( [
			'success' => true,
			'notes'   => self::get_formatted_order_notes( $order_id ),
		] );
	}

	/**
	/**
	 * Helper: Build Structured Order Payload for Customer Transactional Emails
	 */
	public static function get_email_order_payload( $order, array $extra = [] ): array {
		if ( ! is_a( $order, 'WC_Order' ) ) {
			return $extra;
		}

		$order_id = $order->get_id();
		$currency = $order->get_currency();

		$items_data = [];
		foreach ( $order->get_items() as $item_id => $item ) {
			$product = $item->get_product();
			$product_id = $item->get_product_id();
			$image_url = '';

			// Check for configured skin composite image or custom rendered thumbnail
			$custom_img = $item->get_meta( '_configured_image_url' )
				?: ( $item->get_meta( '_configurator_image' )
				?: ( $item->get_meta( 'mkl_pc_thumbnail_url' )
				?: ( $item->get_meta( '_thumbnail_url' )
				?: ( $item->get_meta( 'image_url' ) ?: '' ) ) ) );

			if ( ! empty( $custom_img ) ) {
				$image_url = $custom_img;
			} elseif ( $product && $product->get_image_id() ) {
				$image_url = wp_get_attachment_image_url( $product->get_image_id(), 'medium' );
			}
			if ( empty( $image_url ) ) {
				$image_url = 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg';
			}

			// Configuration / specs parsing
			$parsed_config = [];
			$raw_config = $item->get_meta( '_configurator_data_raw' ) ?: $item->get_meta( '_configurator_data' );
			if ( ! empty( $raw_config ) ) {
				if ( is_string( $raw_config ) ) {
					$decoded = json_decode( $raw_config, true );
					if ( is_array( $decoded ) ) {
						$raw_config = $decoded;
					}
				}
				if ( is_array( $raw_config ) ) {
					foreach ( $raw_config as $v ) {
						$l_name = $v['layer_data']['layer_name'] ?? ( $v['layer_data']['name'] ?? ( $v['layer_name'] ?? 'Layer' ) );
						$c_name = $v['layer_data']['name'] ?? ( $v['choice_name'] ?? ( $v['name'] ?? '' ) );
						if ( $c_name ) {
							$parsed_config[] = [
								'layer_name'  => $l_name,
								'choice_name' => $c_name,
							];
						}
					}
				}
			}

			$meta_str = '';
			if ( empty( $parsed_config ) ) {
				$config_text = $item->get_meta( 'Configuration' );
				if ( ! empty( $config_text ) ) {
					$meta_str = (string) $config_text;
				}
			}

			$items_data[] = [
				'name'                => $item->get_name(),
				'product_id'          => $item->get_product_id(),
				'image_url'           => $image_url,
				'quantity'            => $item->get_quantity(),
				'subtotal'            => wc_price( $item->get_subtotal(), [ 'currency' => $currency ] ),
				'total'               => wc_price( $item->get_total(), [ 'currency' => $currency ] ),
				'parsed_configurator' => $parsed_config,
				'meta'                => $meta_str,
				'device_model'        => $item->get_meta( 'device_model' ) ?: ( $item->get_meta( 'pa_device' ) ?: '' ),
			];
		}

		$shipping = $order->get_address( 'shipping' );
		$billing  = $order->get_address( 'billing' );

		$formatted_shipping = trim( implode( "\n", array_filter( [
			trim( ( $shipping['first_name'] ?? '' ) . ' ' . ( $shipping['last_name'] ?? '' ) ),
			$shipping['company'] ?? '',
			$shipping['address_1'] ?? '',
			$shipping['address_2'] ?? '',
			trim( ( $shipping['city'] ?? '' ) . ( ! empty( $shipping['state'] ) ? ', ' . $shipping['state'] : '' ) . ( ! empty( $shipping['postcode'] ) ? ' ' . $shipping['postcode'] : '' ) ),
			$shipping['country'] ?? '',
		] ) ) );

		$formatted_billing = trim( implode( "\n", array_filter( [
			trim( ( $billing['first_name'] ?? '' ) . ' ' . ( $billing['last_name'] ?? '' ) ),
			$billing['company'] ?? '',
			$billing['address_1'] ?? '',
			$billing['address_2'] ?? '',
			trim( ( $billing['city'] ?? '' ) . ( ! empty( $billing['state'] ) ? ', ' . $billing['state'] : '' ) . ( ! empty( $billing['postcode'] ) ? ' ' . $billing['postcode'] : '' ) ),
			$billing['country'] ?? '',
		] ) ) );

		$coupons = [];
		foreach ( $order->get_coupon_codes() as $code ) {
			$coupons[] = $code;
		}

		$base = [
			'order_number'         => (string) $order_id,
			'customer_first_name'  => $order->get_billing_first_name() ?: ( $order->get_formatted_billing_full_name() ?: 'Valued Customer' ),
			'currency'             => $currency,
			'items'                => $items_data,
			'item_count'           => count( $items_data ),
			'subtotal'             => wc_price( $order->get_subtotal(), [ 'currency' => $currency ] ),
			'discount_total'       => wc_price( $order->get_discount_total(), [ 'currency' => $currency ] ),
			'discount_tax'         => wc_price( $order->get_discount_tax(), [ 'currency' => $currency ] ),
			'coupon_codes'         => $coupons,
			'shipping_total'       => wc_price( $order->get_shipping_total(), [ 'currency' => $currency ] ),
			'shipping_tax'         => wc_price( $order->get_shipping_tax(), [ 'currency' => $currency ] ),
			'shipping_method_name' => $order->get_shipping_method() ?: 'Standard Tracked Delivery',
			'total_tax'            => wc_price( $order->get_total_tax(), [ 'currency' => $currency ] ),
			'total'                => wc_price( $order->get_total(), [ 'currency' => $currency ] ),
			'total_refunded'       => wc_price( $order->get_total_refunded(), [ 'currency' => $currency ] ),
			'payment_method_title' => $order->get_payment_method_title() ?: ucfirst( $order->get_payment_method() ?: 'Online Payment' ),
			'shipping_address'     => $formatted_shipping,
			'billing_address'      => $formatted_billing,
		];

		return array_merge( $base, $extra );
	}

	/**
	 * Send Customer Shipping Notification Email via ZeptoMail
	 */
	public static function send_customer_shipping_email( $order, array $tracking_info ) {
		$customer_email = $order->get_billing_email();
		if ( ! is_email( $customer_email ) ) return;

		$order_id     = $order->get_id();
		$courier      = $tracking_info['courier'] ?? 'Express Courier';
		$tracking_num = $tracking_info['tracking_number'] ?? '';
		$order_received_url = $order->get_checkout_order_received_url();
		$tracking_url = ! empty( $order_received_url )
			? $order_received_url . '#artmatter-order-tracking'
			: ( $tracking_info['tracking_url'] ?? '' );

		if ( class_exists( 'Artmatter_Email_Engine' ) ) {
			if ( class_exists( 'Artmatter_Logger' ) ) {
				Artmatter_Logger::info( 'emails', "Dispatched customer_order_shipped email for Order #{$order_id} to {$customer_email} ({$courier} #{$tracking_num})" );
			}
			Artmatter_Email_Engine::send_email(
				'customer_order_shipped',
				$customer_email,
				$order->get_formatted_billing_full_name() ?: 'Valued Customer',
				self::get_email_order_payload( $order, [
					'courier'         => $courier,
					'tracking_number' => $tracking_num,
					'tracking_url'    => $tracking_url,
				] )
			);
		}
	}

	/**
	 * Handle Order Status Transitions
	 */
	public static function handle_order_status_changed( $order_id, $from_status, $to_status, $order ) {
		if ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::log( 'info', 'orders', "Order #{$order_id} status changed from {$from_status} to {$to_status}" );
		}

		if ( ! $order || ! is_a( $order, 'WC_Order' ) ) {
			$order = wc_get_order( $order_id );
		}
		if ( ! $order ) return;

		$customer_email = $order->get_billing_email();
		$customer_name  = $order->get_formatted_billing_full_name() ?: 'Customer';
		if ( ! is_email( $customer_email ) || ! class_exists( 'Artmatter_Email_Engine' ) ) return;

		$clean_to = str_replace( 'wc-', '', $to_status );

		$shipping_method = '';
		$shipping_methods = $order->get_shipping_methods();
		if ( ! empty( $shipping_methods ) ) {
			$first_shipping = reset( $shipping_methods );
			$shipping_method = strtolower( $first_shipping->get_name() . ' ' . $first_shipping->get_method_title() );
		}
		$shipping_address = strtolower( (string) $order->get_shipping_address_1() . ' ' . (string) $order->get_shipping_city() . ' ' . (string) $order->get_shipping_postcode() );
		$is_store_pickup = str_contains( $shipping_method, 'pickup' ) ||
			str_contains( $shipping_method, 'store' ) ||
			str_contains( $shipping_address, 'summarecon' ) ||
			str_contains( $shipping_address, 'bekasi store' ) ||
			str_contains( $shipping_address, 'ruby commercial' ) ||
			in_array( $clean_to, [ 'smb-ready', 'smb-picked' ], true );

		if ( 'processing' === $clean_to ) {
			self::send_order_confirmation_once( $order );
		} elseif ( 'in-production' === $clean_to ) {
			Artmatter_Email_Engine::send_email(
				'customer_order_in_production',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order )
			);
		} elseif ( 'smb-ready' === $clean_to ) {
			Artmatter_Email_Engine::send_email(
				'customer_order_store_pickup_ready',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order, [
					'is_store_pickup' => true,
					'pickup_ready'    => true,
				] )
			);
		} elseif ( in_array( $clean_to, [ 'awaiting-pickup', 'awaiting_pickup' ], true ) ) {
			Artmatter_Email_Engine::send_email(
				'customer_order_awaiting_pickup',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order )
			);
		} elseif ( 'shipped' === $clean_to ) {
			// Record shipped_at timestamp if not already set
			if ( empty( $order->get_meta( '_shipped_at' ) ) ) {
				$now_mysql = current_time( 'mysql' );
				$order->update_meta_data( '_shipped_at', $now_mysql );
				$order->update_meta_data( '_artmatter_shipped_at', $now_mysql );
				$order->save();
				update_post_meta( $order_id, '_shipped_at', $now_mysql );
				update_post_meta( $order_id, '_artmatter_shipped_at', $now_mysql );
			}

			// Extract tracking number & carrier from ACF / Order Meta / HPOS
			$tracking_code = $order->get_meta( 'tracking_number' ) 
				?: ( get_post_meta( $order_id, 'tracking_number', true ) 
				?: ( function_exists( 'get_field' ) ? get_field( 'tracking_number', $order_id ) : '' ) );

			$carrier_val = $order->get_meta( 'carrier_id' ) 
				?: ( get_post_meta( $order_id, 'carrier_id', true ) 
				?: ( function_exists( 'get_field' ) ? get_field( 'carrier_id', $order_id ) : '' ) );

			if ( empty( $tracking_code ) ) {
				$tracking_meta = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order_id, '_artmatter_tracking_info', true );
				if ( is_array( $tracking_meta ) && ! empty( $tracking_meta['tracking_number'] ) ) {
					$tracking_code = $tracking_meta['tracking_number'];
					$carrier_val   = $tracking_meta['carrier_id'] ?? ( $tracking_meta['courier'] ?? $carrier_val );
				}
			}

			$carrier_key = strtolower( trim( (string) $carrier_val ) );
			$carrier_labels = [
				'jne'                 => 'JNE Express',
				'sicepat'             => 'SiCepat',
				'pos'                 => 'POS Indonesia',
				'goorita'             => 'Goorita Send USA',
				'dhl'                 => 'DHL Express',
				'fedex'               => 'FedEx International',
				'biteship'            => 'Biteship',
				'lion'                => 'Lion Parcel',
				'jnt'                 => 'J&T Express',
			];
			$courier_name = $carrier_labels[ $carrier_key ] ?? ( ! empty( $carrier_val ) ? ucfirst( (string) $carrier_val ) : 'Express Courier' );

			$order_received_url = $order->get_checkout_order_received_url();
			$tracking_url = ! empty( $order_received_url )
				? $order_received_url . '#artmatter-order-tracking'
				: ( class_exists( 'Artmatter_Shipping_Tracker' ) ? Artmatter_Shipping_Tracker::get_carrier_tracking_url( $carrier_key, $tracking_code ) : '' );

			$invoice_html = self::generate_invoice_html( $order );
			$order_num    = str_replace( '#', '', $order->get_order_number() );
			$attachments  = [
				[
					'content'   => base64_encode( $invoice_html ),
					'mime_type' => 'text/html',
					'name'      => "Invoice-INV-{$order_num}.html",
				],
			];

			Artmatter_Email_Engine::send_email(
				'customer_order_shipped',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order, [
					'courier'         => $courier_name,
					'tracking_number' => (string) $tracking_code,
					'tracking_url'    => $tracking_url,
					'attachments'     => $attachments,
				] )
			);

			// Automatically register tracking with 17TRACK
			if ( class_exists( 'Artmatter_Shipping_Tracker' ) && ! empty( $tracking_code ) ) {
				Artmatter_Shipping_Tracker::register_with_17track( $tracking_code, $carrier_key, $order_id );
			}
		} elseif ( in_array( $clean_to, [ 'completed', 'delivered', 'smb-picked' ], true ) ) {
			// Delivery confirmed! Record delivered_at and begin 14-day commission clearance
			$delivered_time = current_time( 'mysql' );
			$order->update_meta_data( '_artmatter_delivered_at', $delivered_time );
			update_post_meta( $order_id, '_artmatter_delivered_at', $delivered_time );

			$clearance_timestamp = time() + ( 14 * DAY_IN_SECONDS );
			$clearance_iso = gmdate( 'Y-m-d H:i:s', $clearance_timestamp );
			$clearance_iso_8601 = gmdate( 'Y-m-d\TH:i:s\Z', $clearance_timestamp );
			$order->update_meta_data( '_artmatter_clearance_at', $clearance_iso );
			update_post_meta( $order_id, '_artmatter_clearance_at', $clearance_iso );
			$order->save();

			// Sync 14-day clearance maturity to Supabase commissions ledger
			if ( class_exists( 'Artmatter_Supabase_Sync' ) ) {
				Artmatter_Supabase_Sync::update_order_commission_clearance( $order_id, $clearance_iso_8601 );
			}

			// Send Luxury "Your Art Has Arrived" email
			if ( class_exists( 'Artmatter_Email_Engine' ) ) {
				$carrier_display = $order->get_meta( '_artmatter_courier' ) ?: ( $order->get_meta( 'carrier_id' ) ?: 'Express Courier' );
				$tracking_num    = $order->get_meta( 'tracking_number' ) ?: $order->get_meta( '_artmatter_tracking_number' );

				if ( $is_store_pickup ) {
					Artmatter_Email_Engine::send_email(
						'customer_order_store_pickup_completed',
						$customer_email,
						$customer_name,
						self::get_email_order_payload( $order, [
							'is_store_pickup' => true,
							'pickup_review'   => true,
						] )
					);
				} else {
					Artmatter_Email_Engine::send_email(
						'customer_order_delivered',
						$customer_email,
						$customer_name,
						self::get_email_order_payload( $order, [
							'courier'         => (string) $carrier_display,
							'tracking_number' => (string) $tracking_num,
						] )
					);
				}
			}

			// Automatically schedule post-delivery Collector Review Invitation (default: 36h)
			if ( class_exists( 'Artmatter_Review_Manager' ) ) {
				Artmatter_Review_Manager::schedule_review_invitation( $order_id );
			}
		} elseif ( 'refunded' === $clean_to ) {
			if ( class_exists( 'Artmatter_Review_Manager' ) ) {
				Artmatter_Review_Manager::cancel_scheduled_invitation( $order_id );
			}
			$ref_amt = wc_price( $order->get_total_refunded() ?: $order->get_total(), [ 'currency' => $order->get_currency() ] );
			Artmatter_Email_Engine::send_email(
				'customer_order_refunded',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order, [
					'refund_amount' => $ref_amt,
				] )
			);
		} elseif ( in_array( $clean_to, [ 'on-hold', 'on_hold' ], true ) ) {
			Artmatter_Email_Engine::send_email(
				'customer_order_on_hold',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order )
			);
		} elseif ( 'failed' === $clean_to ) {
			Artmatter_Email_Engine::send_email(
				'customer_order_failed',
				$customer_email,
				$customer_name,
				self::get_email_order_payload( $order )
			);
		}
	}

	/**
	 * Return manager sales metrics grouped by currency, without sending order history to the browser.
	 */
	public static function get_sales_analytics( WP_REST_Request $request ) {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return new WP_Error( 'woocommerce_unavailable', 'Sales data is unavailable.', [ 'status' => 503 ] );
		}

		$start = sanitize_text_field( $request->get_param( 'start' ) ?: '' );
		$end   = sanitize_text_field( $request->get_param( 'end' ) ?: '' );
		$timezone = wp_timezone();
		$start_date = DateTimeImmutable::createFromFormat( '!Y-m-d', $start, $timezone );
		$end_date   = DateTimeImmutable::createFromFormat( '!Y-m-d', $end, $timezone );

		if ( ! $start_date || ! $end_date || $start_date > $end_date ) {
			return new WP_Error( 'invalid_date_range', 'Choose a valid date range.', [ 'status' => 400 ] );
		}

		$end_date = $end_date->setTime( 23, 59, 59 );
		$page = 1;
		$buckets = [];
		$paid_statuses = array_unique( array_merge(
			wc_get_is_paid_statuses(),
			[ 'processing', 'in-production', 'quality-check', 'awaiting-pickup', 'shipped', 'completed', 'refunded' ]
		) );

		do {
			$results = wc_get_orders( [
				'limit'        => 250,
				'page'         => $page,
				'paginate'     => true,
				'orderby'      => 'date',
				'order'        => 'DESC',
				'status'       => $paid_statuses,
				'date_created' => $start_date->getTimestamp() . '...' . $end_date->getTimestamp(),
			] );

			$orders = is_object( $results ) && isset( $results->orders ) ? $results->orders : [];
			foreach ( $orders as $order ) {
				if ( ! $order instanceof WC_Order ) {
					continue;
				}

				$currency = strtoupper( $order->get_currency() ?: get_woocommerce_currency() );
				if ( ! isset( $buckets[ $currency ] ) ) {
					$buckets[ $currency ] = [
						'currency' => $currency,
						'gross_revenue' => 0.0,
						'net_revenue' => 0.0,
						'refunded' => 0.0,
						'orders' => 0,
						'items_sold' => 0,
						'customers' => [],
						'timeline' => [],
						'countries' => [],
						'products' => [],
					];
				}

				$gross = max( 0, (float) $order->get_total() );
				$refunded = max( 0, (float) $order->get_total_refunded() );
				$net = max( 0, $gross - $refunded );
				$created = $order->get_date_created();
				$date_key = $created ? $created->date_i18n( 'Y-m-d' ) : '';
				$country_code = strtoupper( $order->get_shipping_country() ?: $order->get_billing_country() ?: 'ZZ' );
				$country_name = 'Not provided';
				if ( 'ZZ' !== $country_code && function_exists( 'WC' ) && WC()->countries ) {
					$countries = WC()->countries->get_countries();
					$country_name = $countries[ $country_code ] ?? $country_code;
				}

				$buckets[ $currency ]['gross_revenue'] += $gross;
				$buckets[ $currency ]['net_revenue'] += $net;
				$buckets[ $currency ]['refunded'] += $refunded;
				$buckets[ $currency ]['orders']++;
				$email = strtolower( trim( $order->get_billing_email() ) );
				if ( $email ) {
					$buckets[ $currency ]['customers'][ $email ] = true;
				}

				if ( $date_key ) {
					if ( ! isset( $buckets[ $currency ]['timeline'][ $date_key ] ) ) {
						$buckets[ $currency ]['timeline'][ $date_key ] = [ 'date' => $date_key, 'revenue' => 0.0, 'orders' => 0 ];
					}
					$buckets[ $currency ]['timeline'][ $date_key ]['revenue'] += $net;
					$buckets[ $currency ]['timeline'][ $date_key ]['orders']++;
				}

				if ( ! isset( $buckets[ $currency ]['countries'][ $country_code ] ) ) {
					$buckets[ $currency ]['countries'][ $country_code ] = [
						'code' => $country_code,
						'name' => $country_name,
						'revenue' => 0.0,
						'orders' => 0,
					];
				}
				$buckets[ $currency ]['countries'][ $country_code ]['revenue'] += $net;
				$buckets[ $currency ]['countries'][ $country_code ]['orders']++;

				foreach ( $order->get_items( 'line_item' ) as $item_id => $item ) {
					$quantity = max( 0, (int) $item->get_quantity() - abs( (int) $order->get_qty_refunded_for_item( $item_id ) ) );
					$refunded_tax = 0.0;
					if ( method_exists( $order, 'get_taxes_refunded_for_item' ) ) {
						$taxes_refunded = $order->get_taxes_refunded_for_item( $item_id );
						$refunded_tax = is_array( $taxes_refunded ) ? abs( (float) array_sum( $taxes_refunded ) ) : 0.0;
					}
					$item_revenue = max( 0, (float) $item->get_total() + (float) $item->get_total_tax() - abs( (float) $order->get_total_refunded_for_item( $item_id ) ) - $refunded_tax );
					$product_key = (string) ( $item->get_product_id() ?: $item->get_name() );
					if ( ! isset( $buckets[ $currency ]['products'][ $product_key ] ) ) {
						$buckets[ $currency ]['products'][ $product_key ] = [
							'product_id' => (int) $item->get_product_id(),
							'name' => $item->get_name(),
							'quantity' => 0,
							'revenue' => 0.0,
						];
					}
					$buckets[ $currency ]['products'][ $product_key ]['quantity'] += $quantity;
					$buckets[ $currency ]['products'][ $product_key ]['revenue'] += $item_revenue;
					$buckets[ $currency ]['items_sold'] += $quantity;
				}
			}

			$max_pages = is_object( $results ) && isset( $results->max_num_pages ) ? (int) $results->max_num_pages : 1;
			$page++;
		} while ( $page <= $max_pages );

		$analytics = [];
		foreach ( $buckets as $currency => $bucket ) {
			$timeline = array_values( $bucket['timeline'] );
			usort( $timeline, fn( $a, $b ) => strcmp( $a['date'], $b['date'] ) );
			$countries = array_values( $bucket['countries'] );
			usort( $countries, fn( $a, $b ) => $b['revenue'] <=> $a['revenue'] );
			$products = array_values( $bucket['products'] );
			usort( $products, fn( $a, $b ) => $b['quantity'] <=> $a['quantity'] ?: $b['revenue'] <=> $a['revenue'] );

			$analytics[] = [
				'currency' => $currency,
				'summary' => [
					'gross_revenue' => round( $bucket['gross_revenue'], 2 ),
					'net_revenue' => round( $bucket['net_revenue'], 2 ),
					'refunded' => round( $bucket['refunded'], 2 ),
					'orders' => $bucket['orders'],
					'items_sold' => $bucket['items_sold'],
					'unique_customers' => count( $bucket['customers'] ),
					'average_order_value' => $bucket['orders'] ? round( $bucket['net_revenue'] / $bucket['orders'], 2 ) : 0,
				],
				'timeline' => $timeline,
				'countries' => array_slice( $countries, 0, 10 ),
				'products' => array_slice( $products, 0, 10 ),
			];
		}

		usort( $analytics, fn( $a, $b ) => $b['summary']['net_revenue'] <=> $a['summary']['net_revenue'] );

		return rest_ensure_response( [
			'success' => true,
			'start_date' => $start,
			'end_date' => $end,
			'currencies' => $analytics,
		] );
	}

	/**
	 * Ensure paid orders receive one Artmatter confirmation email regardless of gateway hook order.
	 */
	public static function handle_payment_complete( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order ) {
			self::send_order_confirmation_once( $order );
		}
	}

	private static function send_order_confirmation_once( $order ) {
		if ( ! $order instanceof WC_Order || 'yes' === $order->get_meta( '_artmatter_confirmation_email_sent', true ) ) {
			return;
		}

		$customer_email = $order->get_billing_email();
		if ( ! is_email( $customer_email ) || ! class_exists( 'Artmatter_Email_Engine' ) ) {
			return;
		}

		$result = Artmatter_Email_Engine::send_email(
			'customer_order_processing',
			$customer_email,
			$order->get_formatted_billing_full_name() ?: 'Customer',
			self::get_email_order_payload( $order )
		);

		if ( ! empty( $result['success'] ) ) {
			$order->update_meta_data( '_artmatter_confirmation_email_sent', 'yes' );
			$order->save();
		} elseif ( class_exists( 'Artmatter_Logger' ) ) {
			Artmatter_Logger::log( 'error', 'email', "Order #{$order->get_id()} confirmation email failed", [
				'message' => $result['message'] ?? 'Unknown email error',
			] );
		}
	}

	/**
	 * Keep gateway callbacks on WordPress, then return the customer to the headless storefront.
	 */
	public static function get_storefront_return_url( $return_url, $order ) {
		if ( ! $order instanceof WC_Order ) {
			return $return_url;
		}

		$base_url = defined( 'EXACOAT_WEB_URL' ) ? EXACOAT_WEB_URL : ( defined( 'ARTMATTER_WEB_URL' ) ? ARTMATTER_WEB_URL : 'https://exacoat.com' );
		return add_query_arg(
			[
				'order'  => $order->get_id(),
				'key'    => $order->get_order_key(),
				'status' => $order->get_status(),
			],
			rtrim( $base_url, '/' ) . '/thank-you'
		);
	}

	/**
	 * Generate Official Printable Customer Tax Invoice HTML Document
	 */
	public static function generate_invoice_html( WC_Order $order ): string {
		$order_num      = $order->get_order_number();
		$clean_num      = str_replace( '#', '', $order_num );
		$invoice_num    = 'INV-' . $clean_num;
		$date           = $order->get_date_created() ? $order->get_date_created()->date_i18n( 'F j, Y' ) : date( 'F j, Y' );
		$billing_name   = $order->get_formatted_billing_full_name() ?: ( $order->get_formatted_shipping_full_name() ?: 'Valued Collector' );
		$billing_email  = $order->get_billing_email() ?: '-';
		$billing_phone  = $order->get_billing_phone() ?: ( $order->get_shipping_phone() ?: '-' );
		$billing_addr   = $order->get_formatted_billing_address() ?: 'Address on file';
		$shipping_addr  = $order->get_formatted_shipping_address() ?: $billing_addr;
		$currency       = $order->get_currency();
		$payment_method = $order->get_payment_method_title() ?: ( $order->get_payment_method() ?: 'Electronic Payment' );

		$items_html = '';
		foreach ( $order->get_items() as $item ) {
			$prod_name = esc_html( $item->get_name() );
			$qty       = (int) $item->get_quantity();
			$total     = wc_price( $item->get_total(), [ 'currency' => $currency ] );
			$subtotal  = wc_price( $item->get_subtotal() / max( 1, $qty ), [ 'currency' => $currency ] );
			$items_html .= "
			<tr style=\"border-bottom:1px solid #e5e7eb;\">
				<td style=\"padding:12px 14px;color:#111827;font-weight:700;font-size:13px;\">{$prod_name}</td>
				<td style=\"padding:12px 14px;text-align:center;color:#374151;font-weight:600;font-size:13px;\">{$qty}x</td>
				<td style=\"padding:12px 14px;text-align:right;color:#374151;font-weight:600;font-size:13px;font-family:monospace;\">{$subtotal}</td>
				<td style=\"padding:12px 14px;text-align:right;color:#111827;font-weight:800;font-size:13px;font-family:monospace;\">{$total}</td>
			</tr>";
		}

		$shipping_total = $order->get_shipping_total();
		$shipping_str   = ( (float) $shipping_total > 0 ) ? wc_price( $shipping_total, [ 'currency' => $currency ] ) : 'Free Shipping';
		$tax_str        = wc_price( $order->get_total_tax(), [ 'currency' => $currency ] );
		$grand_total    = wc_price( $order->get_total(), [ 'currency' => $currency ] );
		$items_subtotal = wc_price( (float) $order->get_total() - (float) $shipping_total - (float) $order->get_total_tax(), [ 'currency' => $currency ] );

		return "<!DOCTYPE html>
		<html>
		<head>
			<meta charset=\"utf-8\">
			<title>Invoice - {$invoice_num}</title>
			<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap\" rel=\"stylesheet\">
			<style>
				body { font-family: 'Inter', sans-serif; margin: 0; padding: 30px; color: #111827; background: #ffffff; }
				.box { max-width: 750px; margin: 0 auto; }
				.header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
				.grid { display: flex; gap: 20px; margin-bottom: 24px; }
				.col { flex: 1; background: #f9fafb; padding: 14px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 12px; }
				table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12.5px; }
				th { background: #f3f4f6; padding: 10px 14px; text-transform: uppercase; font-size: 10.5px; font-weight: 800; border-bottom: 2px solid #e5e7eb; text-align: left; }
				.totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
				.totals-table { width: 300px; font-size: 12.5px; }
				.totals-table td { padding: 6px 12px; }
				.grand { border-top: 2px solid #111; font-weight: 900; font-size: 14.5px; color: #000; }
				.badge { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; }
			</style>
		</head>
		<body>
			<div class=\"box\">
				<div class=\"header\">
					<div>
						<img src=\"https://exacoat.com/wp-content/uploads/exacoat-logo.png\" alt=\"Exacoat\" style=\"height:22px;display:block;margin-bottom:6px;\" />
						<div style=\"font-size:11px;color:#555;\">Exacoat &bull; Precision Device Skins &amp; Wraps</div>
						<div style=\"font-size:11px;color:#555;\">support@exacoat.com &bull; https://exacoat.com</div>
					</div>
					<div style=\"text-align:right;\">
						<div style=\"font-size:18px;font-weight:900;\">TAX INVOICE</div>
						<div style=\"font-size:11px;color:#555;margin-top:2px;\">{$invoice_num}</div>
						<div style=\"font-size:11px;color:#555;\">{$date}</div>
						<div style=\"margin-top:4px;\"><span class=\"badge\">PAID IN FULL</span></div>
					</div>
				</div>
				<div class=\"grid\">
					<div class=\"col\">
						<div style=\"font-size:9.5px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:4px;\">BILLED TO</div>
						<div style=\"font-weight:800;font-size:13px;\">{$billing_name}</div>
						<div>Email: {$billing_email}</div>
						<div>Tel: {$billing_phone}</div>
						<div style=\"margin-top:4px;\">{$billing_addr}</div>
					</div>
					<div class=\"col\">
						<div style=\"font-size:9.5px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:4px;\">SHIPPED TO</div>
						<div style=\"font-weight:800;font-size:13px;\">{$billing_name}</div>
						<div>Tel: {$billing_phone}</div>
						<div style=\"margin-top:4px;\">{$shipping_addr}</div>
					</div>
				</div>
				<table>
					<thead>
						<tr>
							<th>Item Description</th>
							<th style=\"text-align:center;width:50px;\">Qty</th>
							<th style=\"text-align:right;width:100px;\">Unit Price</th>
							<th style=\"text-align:right;width:100px;\">Amount</th>
						</tr>
					</thead>
					<tbody>
						{$items_html}
					</tbody>
				</table>
				<div class=\"totals\">
					<table class=\"totals-table\">
						<tr><td style=\"color:#6b7280;\">Subtotal:</td><td style=\"text-align:right;font-weight:700;font-family:monospace;\">{$items_subtotal}</td></tr>
						<tr><td style=\"color:#6b7280;\">Shipping:</td><td style=\"text-align:right;font-weight:700;font-family:monospace;\">{$shipping_str}</td></tr>
						<tr><td style=\"color:#6b7280;\">Tax:</td><td style=\"text-align:right;font-weight:700;font-family:monospace;\">{$tax_str}</td></tr>
						<tr class=\"grand\"><td>Total Paid:</td><td style=\"text-align:right;font-family:monospace;\">{$grand_total}</td></tr>
					</table>
				</div>
				<div style=\"border-top:1px solid #e5e7eb;padding-top:12px;font-size:10.5px;color:#6b7280;display:flex;justify-content:space-between;\">
					<span>Thank you for ordering with Exacoat.</span>
					<span>Official Electronic Receipt &bull; Payment via {$payment_method}</span>
				</div>
			</div>
		</body>
		</html>";
	}

	/**
	 * Render 6-Stage Luxury Production & Live Courier Tracking Timeline on Customer Order Details Screen
	 */
	public static function render_order_details_timeline( $order ) {
		if ( ! $order instanceof WC_Order ) {
			$order_id = is_numeric( $order ) ? (int) $order : get_the_ID();
			$order    = wc_get_order( $order_id );
		}
		if ( ! $order ) return;

		$raw_status  = $order->get_status();
		$order_id    = $order->get_id();
		$status_name = wc_get_order_status_name( $raw_status );

		$status_stages = [
			'pending'         => 1,
			'on-hold'         => 1,
			'processing'      => 1,
			'in-production'   => 2,
			'quality-check'   => 3,
			'awaiting-pickup' => 4,
			'shipped'         => 5,
			'completed'       => 6,
			'delivered'       => 6,
		];

		$active_stage = $status_stages[ $raw_status ] ?? 1;
		$is_cancelled = in_array( $raw_status, [ 'cancelled', 'refunded', 'failed' ], true );
		if ( $is_cancelled ) return;

		$stages = [
			1 => [
				'label' => __( 'Confirmed', 'exacoat-core' ),
				'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
			],
			2 => [
				'label' => __( 'In Production', 'exacoat-core' ),
				'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
			],
			3 => [
				'label' => __( 'Quality Check', 'exacoat-core' ),
				'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
			],
			4 => [
				'label' => __( 'Ready to Ship', 'exacoat-core' ),
				'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
			],
			5 => [
				'label' => __( 'Shipped', 'exacoat-core' ),
				'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg>',
			],
			6 => [
				'label' => __( 'Delivered', 'exacoat-core' ),
				'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
			],
		];

		$tracking_num = (string) ( $order->get_meta( 'tracking_number' ) 
			?: ( $order->get_meta( '_tracking_number' ) 
			?: ( $order->get_meta( '_artmatter_tracking_number' ) 
			?: ( get_post_meta( $order_id, 'tracking_number', true ) 
			?: ( function_exists( 'get_field' ) ? (string) get_field( 'tracking_number', $order_id ) : '' ) ) ) ) );

		if ( empty( $tracking_num ) ) {
			$t_info = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order_id, '_artmatter_tracking_info', true );
			if ( is_array( $t_info ) && ! empty( $t_info['tracking_number'] ) ) {
				$tracking_num = (string) $t_info['tracking_number'];
			}
		}
		$tracking_num = trim( $tracking_num );

		// Self-healing: auto-register with 17TRACK if tracking exists but not registered yet
		$is_registered = $order->get_meta( '_artmatter_17track_registered' ) ?: get_post_meta( $order_id, '_artmatter_17track_registered', true );
		if ( ! empty( $tracking_num ) && empty( $is_registered ) && class_exists( 'Artmatter_Shipping_Tracker' ) ) {
			Artmatter_Shipping_Tracker::handle_order_save( $order_id );
		}

		$carrier_val  = (string) ( $order->get_meta( 'carrier_id' ) ?: ( get_post_meta( $order_id, 'carrier_id', true ) ?: '' ) );
		$carriers     = class_exists( 'Artmatter_Shipping_Tracker' ) ? Artmatter_Shipping_Tracker::get_carrier_registry() : [];
		$courier_name = $carriers[ strtolower( $carrier_val ) ]['name'] ?? ( ! empty( $carrier_val ) ? ucfirst( $carrier_val ) : 'Express Courier' );

		$tracking_url = '';
		if ( ! empty( $tracking_num ) && class_exists( 'Artmatter_Shipping_Tracker' ) ) {
			$tracking_url = Artmatter_Shipping_Tracker::get_carrier_tracking_url( $carrier_val, $tracking_num );
		}

		$checkpoints = $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: get_post_meta( $order_id, '_artmatter_tracking_checkpoints', true );
		if ( ! is_array( $checkpoints ) ) {
			$checkpoints = [];
		}

		// Auto-sync live TrackingMore data if tracking number exists and checkpoints are missing,
		// or if not synced within 15 minutes and order is not yet delivered/completed.
		if ( ! empty( $tracking_num ) && class_exists( 'Artmatter_Shipping_Tracker' ) ) {
			$last_sync  = (int) ( $order->get_meta( '_artmatter_last_tracking_sync' ) ?: get_post_meta( $order_id, '_artmatter_last_tracking_sync', true ) );
			$needs_sync = empty( $checkpoints ) || ( ( time() - $last_sync ) > 900 && ! in_array( $raw_status, [ 'completed', 'delivered' ], true ) );

			if ( $needs_sync ) {
				update_post_meta( $order_id, '_artmatter_last_tracking_sync', time() );
				$order->update_meta_data( '_artmatter_last_tracking_sync', time() );
				$order->save();

				Artmatter_Shipping_Tracker::sync_order_tracking( $order_id );

				$order_refreshed = wc_get_order( $order_id );
				if ( $order_refreshed ) {
					$order        = $order_refreshed;
					$raw_status   = $order->get_status();
					$status_name  = wc_get_order_status_name( $raw_status );
					$active_stage = $status_stages[ $raw_status ] ?? 1;
					$checkpoints  = $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: [];
					if ( ! is_array( $checkpoints ) ) {
						$checkpoints = [];
					}
				}
			}
		}
		?>
		<style>
		@keyframes artmatterSpin { 100% { transform: rotate(360deg); } }
		.artmatter-spin-anim { animation: artmatterSpin 0.75s linear infinite; }
		</style>
		<div id="artmatter-order-tracking" class="artmatter-order-progress-card" style="background:#121214; border:1px solid #27272a; border-radius:14px; padding:20px; margin-bottom:28px; font-family:'Neue Haas Display', 'Neue Haas Grotesk Text Pro', inherit, sans-serif; color:#ffffff; scroll-margin-top:32px;">
			<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
				<div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#a1a1aa;">
					Fulfillment & Delivery Progress
				</div>
				<?php
				$status_styles = [
					'completed'       => 'color:#86efac; background:rgba(134,239,172,0.08); border:1px solid rgba(134,239,172,0.18);',
					'delivered'       => 'color:#86efac; background:rgba(134,239,172,0.08); border:1px solid rgba(134,239,172,0.18);',
					'processing'      => 'color:#94a3b8; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.18);',
					'confirmed'       => 'color:#94a3b8; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.18);',
					'in-production'   => 'color:#e2c08d; background:rgba(226,192,141,0.08); border:1px solid rgba(226,192,141,0.18);',
					'quality-check'   => 'color:#c4b5fd; background:rgba(196,181,253,0.08); border:1px solid rgba(196,181,253,0.18);',
					'awaiting-pickup' => 'color:#93c5fd; background:rgba(147,197,253,0.08); border:1px solid rgba(147,197,253,0.18);',
					'shipped'         => 'color:#93c5fd; background:rgba(147,197,253,0.08); border:1px solid rgba(147,197,253,0.18);',
				];
				$badge_color_style = $status_styles[ $raw_status ] ?? 'color:#86efac; background:rgba(134,239,172,0.08); border:1px solid rgba(134,239,172,0.18);';
				?>
				<span id="artmatter-status-badge" style="display:inline-flex; align-items:center; justify-content:center; line-height:1; font-size:11px; font-weight:400; padding:5px 8px; border-radius:9999px; letter-spacing:0.02em; <?php echo esc_attr( $badge_color_style ); ?>">
					<?php echo esc_html( $status_name ); ?>
				</span>
			</div>

			<!-- 6-Stage Internal Workshop Progress Bar -->
			<div style="display:flex; align-items:center; justify-content:space-between; position:relative; margin-bottom:20px; padding:0 10px;">
				<div style="position:absolute; top:14px; left:37px; right:37px; height:2px; background:#27272a; z-index:1;">
					<div style="position:absolute; top:0; left:0; height:100%; width:<?php echo esc_attr( min( 100, max( 0, ( ( $active_stage - 1 ) / 5 ) * 100 ) ) ); ?>%; background:#f3aa18; transition:width 0.3s ease;"></div>
				</div>
				<?php foreach ( $stages as $idx => $st ) : 
					$is_done = $active_stage >= $idx;
					$is_curr = $active_stage === $idx;
				?>
				<div style="position:relative; z-index:3; display:flex; flex-direction:column; align-items:center; text-align:center; width:54px;">
					<div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; <?php echo $is_done ? 'background:#f3aa18; color:#000000;' : 'background:#18181b; color:#71717a; border:2px solid #27272a;'; ?> <?php echo $is_curr ? 'box-shadow:0 0 12px rgba(243,170,24,0.4);' : ''; ?>">
						<?php echo $st['icon']; ?>
					</div>
					<div style="margin-top:6px; font-size:10px; font-weight:<?php echo $is_curr ? '700' : '500'; ?>; color:<?php echo $is_done ? '#ffffff' : '#71717a'; ?>; white-space:nowrap;">
						<?php echo esc_html( $st['label'] ); ?>
					</div>
				</div>
				<?php endforeach; ?>
			</div>

			<!-- Live Courier Checkpoints & Dedicated Shipment Tracking Timeline -->
			<?php if ( ! empty( $tracking_num ) ) : ?>
			<div style="background:#18181b; border:1px solid #27272a; border-radius:10px; padding:16px 18px; margin-top:16px;">
				<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-bottom:14px; border-bottom:1px solid #27272a;">
					<div>
						<div style="font-size:11px; color:#71717a; text-transform:uppercase; letter-spacing:0.04em;">Carrier & Tracking</div>
						<div style="font-size:14px; font-weight:700; color:#ffffff; margin-top:2px;">
							<?php echo esc_html( $courier_name ); ?> &bull; <span style="font-family:monospace; color:#f3aa18;"><?php echo esc_html( $tracking_num ); ?></span>
						</div>
					</div>
					<div style="display:flex; align-items:center; gap:8px;">
						<button type="button" id="artmatter-refresh-tracking-btn" data-order-id="<?php echo esc_attr( $order_id ); ?>" data-nonce="<?php echo esc_attr( wp_create_nonce( 'artmatter_customer_tracking_' . $order_id ) ); ?>" style="cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#d4d4d8; border-radius:9999px; padding:6px 14px; font-size:11px; font-weight:400; transition:all 0.15s ease; display:inline-flex; align-items:center; gap:6px;">
							<svg class="artmatter-refresh-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.4s ease;"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
							<span class="refresh-text"><?php esc_html_e( 'Refresh status', 'exacoat-core' ); ?></span>
						</button>
					</div>
				</div>

				<!-- Dedicated Courier Shipment Tracking Timeline -->
				<div id="artmatter-checkpoints-container" style="margin-top:16px;">
					<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
						<div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#a1a1aa;">
							<?php esc_html_e( 'Shipment Tracking Timeline', 'exacoat-core' ); ?>
						</div>
					</div>

					<?php if ( ! empty( $checkpoints ) && is_array( $checkpoints ) ) : ?>
						<div class="artmatter-checkpoints-list" style="position:relative; padding-left:22px;">
							<div style="position:absolute; left:7px; top:8px; bottom:14px; width:1.5px; background:#27272a;"></div>
							<?php 
							$total_cps = count( $checkpoints );
							foreach ( $checkpoints as $idx => $ev ) : 
								$time = ! empty( $ev['time'] ) ? $ev['time'] : ( $ev['time_iso'] ?? '' );
								$desc = $ev['description'] ?? ( $ev['context'] ?? '' );
								$raw_loc = $ev['location'] ?? '';
								$loc  = class_exists( 'Artmatter_Shipping_Tracker' ) ? Artmatter_Shipping_Tracker::clean_checkpoint_location( $raw_loc ) : trim( $raw_loc );
								$is_latest = ( $idx === 0 );

								// Suppress duplicate location if description already mentions or ends with it
								$show_loc = ! empty( $loc );
								if ( $show_loc ) {
									$desc_clean = trim( rtrim( $desc, '.' ) );
									if ( strcasecmp( substr( $desc_clean, -strlen( $loc ) ), $loc ) === 0 || stripos( $desc, '(' . $loc . ')' ) !== false ) {
										$show_loc = false;
									}
								}

								$time_formatted = class_exists( 'Artmatter_Shipping_Tracker' )
									? Artmatter_Shipping_Tracker::format_checkpoint_time( $time )
									: $time;
							?>
							<div style="position:relative; margin-bottom:<?php echo $idx === $total_cps - 1 ? '0' : '16px'; ?>;">
								<div style="position:absolute; left:-22px; top:3px; width:15px; height:15px; border-radius:50%; display:flex; align-items:center; justify-content:center; <?php echo $is_latest ? 'background:#f3aa18; box-shadow:0 0 10px rgba(243,170,24,0.3);' : 'background:#18181b; border:1.5px solid #3f3f46;'; ?>">
									<?php if ( $is_latest ) : ?>
										<div style="width:5px; height:5px; border-radius:50%; background:#000000;"></div>
									<?php else : ?>
										<div style="width:4px; height:4px; border-radius:50%; background:#71717a;"></div>
									<?php endif; ?>
								</div>
								<div>
									<div style="font-size:12px; font-weight:<?php echo $is_latest ? '600' : '400'; ?>; color:<?php echo $is_latest ? '#ffffff' : '#d4d4d8'; ?>; line-height:1.4;">
										<?php echo esc_html( $desc ); ?>
										<?php if ( $show_loc ) : ?>
											<span style="color:#71717a; font-weight:400;"> &bull; <?php echo esc_html( $loc ); ?></span>
										<?php endif; ?>
									</div>
									<?php if ( ! empty( $time_formatted ) ) : ?>
										<div style="font-size:10.5px; color:#71717a; margin-top:3px; font-family:'Neue Haas Display', 'Neue Haas Grotesk Text Pro', inherit, sans-serif;">
											<?php echo esc_html( $time_formatted ); ?>
										</div>
									<?php endif; ?>
								</div>
							</div>
							<?php endforeach; ?>
							<div style="font-size:10.5px; color:#71717a; margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); font-family:'Neue Haas Display', 'Neue Haas Grotesk Text Pro', inherit, sans-serif; display:flex; align-items:center; gap:6px;">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
								<span><?php esc_html_e( 'Scan timestamps reflect the local time of the courier facility.', 'exacoat-core' ); ?></span>
							</div>
						</div>
					<?php else : ?>
						<!-- Clean, honest notice when awaiting live courier scans (Zero fake steps) -->
						<div class="artmatter-tracking-awaiting" style="padding:16px 18px; background:rgba(255,255,255,0.02); border:1px solid #27272a; border-radius:10px;">
							<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
								<div style="width:7px; height:7px; border-radius:50%; background:#f3aa18;"></div>
								<div style="font-size:12px; font-weight:600; color:#ffffff; letter-spacing:0.04em; text-transform:uppercase;">
									<?php esc_html_e( 'Manifest Registered with Carrier', 'exacoat-core' ); ?>
								</div>
							</div>
							<div style="font-size:12px; line-height:1.6; color:#a1a1aa; font-weight:400;">
								<?php echo sprintf( esc_html__( 'Electronic shipping manifest registered with %s. Initial intake and route checkpoints will appear here once the carrier scans the parcel at their processing hub.', 'exacoat-core' ), '<strong>' . esc_html( $courier_name ) . '</strong>' ); ?>
							</div>
						</div>
					<?php endif; ?>
				</div>
			</div>

			<script>
			(function() {
				var refreshBtn = document.getElementById('artmatter-refresh-tracking-btn');
				if (!refreshBtn) return;

				function formatCheckpointTime(str) {
					if (!str) return '';
					try {
						var match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:([+-]\d{2}):?(\d{2})?|Z)?/i);
						var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
						if (match) {
							var y = match[1];
							var m = months[parseInt(match[2], 10) - 1];
							var d = parseInt(match[3], 10);
							var hh = match[4];
							var mm = match[5];
							var ss = match[6] || '00';
							var tzSign = match[7];
							var dateStr = m + ' ' + d + ', ' + y;
							if (hh === '00' && mm === '00' && ss === '00') {
								return dateStr;
							}
							var tzLabel = 'Local time';
							if (str.toUpperCase().endsWith('Z')) {
								tzLabel = 'UTC';
							} else if (tzSign) {
								var hOffset = parseInt(tzSign, 10);
								tzLabel = 'Local time, UTC' + (hOffset >= 0 ? '+' : '') + hOffset;
							}
							return dateStr + ' \u2022 ' + hh + ':' + mm + ' (' + tzLabel + ')';
						}
						var d = new Date(str);
						if (isNaN(d.getTime())) return str;
						var dateStr = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
						if (d.getHours() === 0 && d.getMinutes() === 0) return dateStr;
						var hh = (d.getHours() < 10 ? '0' : '') + d.getHours();
						var mm = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
						return dateStr + ' \u2022 ' + hh + ':' + mm + ' (Local time)';
					} catch(e) {
						return str;
					}
				}

				function cleanCheckpointLocation(loc, desc) {
					if (!loc) return '';
					var parts = loc.split(/\s*[-,\/|]\s*/);
					var seen = {};
					var cleaned = [];
					var isoMap = { de:'germany', id:'indonesia', us:'united states', gb:'united kingdom', uk:'united kingdom', fr:'france', nl:'netherlands', au:'australia', sg:'singapore', jp:'japan', cn:'china', ch:'switzerland', at:'austria', it:'italy', es:'spain', ca:'canada' };

					for (var i = 0; i < parts.length; i++) {
						var p = parts[i].trim();
						if (!p) continue;
						var pLower = p.toLowerCase();
						if (pLower.length === 2 && isoMap[pLower] && seen[isoMap[pLower]]) {
							continue;
						}
						if (seen[pLower]) continue;
						for (var k in seen) {
							if (k.length === 2 && isoMap[k] === pLower) {
								cleaned = cleaned.filter(function(item) { return item.toLowerCase() !== k; });
								delete seen[k];
							}
						}
						seen[pLower] = true;
						if (p === p.toUpperCase() || p === p.toLowerCase()) {
							p = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
						}
						cleaned.push(p);
					}
					var res = cleaned.join(', ');
					if (desc && res) {
						var dClean = desc.replace(/\.+$/, '').trim();
						if (dClean.toLowerCase().endsWith(res.toLowerCase()) || desc.indexOf('(' + res + ')') !== -1) {
							return '';
						}
					}
					return res;
				}

				refreshBtn.addEventListener('click', function(e) {
					e.preventDefault();
					var orderId = this.getAttribute('data-order-id');
					var nonce = this.getAttribute('data-nonce');
					var icon = this.querySelector('.artmatter-refresh-icon');
					var text = this.querySelector('.refresh-text');
					var btn = this;

					if (btn.disabled) return;
					btn.disabled = true;
					if (icon) icon.classList.add('artmatter-spin-anim');
					if (text) text.textContent = 'Updating...';

					var ajaxUrl = '<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>';

					var xhr = new XMLHttpRequest();
					xhr.open('POST', ajaxUrl, true);
					xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
					xhr.onload = function() {
						btn.disabled = false;
						if (icon) icon.classList.remove('artmatter-spin-anim');

						if (xhr.status >= 200 && xhr.status < 400) {
							try {
								var res = JSON.parse(xhr.responseText);
								if (res && res.success && res.data) {
									var cps = res.data.checkpoints;
									var container = document.getElementById('artmatter-checkpoints-container');
									if (container && Array.isArray(cps) && cps.length > 0) {
										var html = '<div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#a1a1aa; margin-bottom:14px;">Shipment Tracking Timeline</div>';
										html += '<div class="artmatter-checkpoints-list" style="position:relative; padding-left:22px;">';
										html += '<div style="position:absolute; left:7px; top:8px; bottom:14px; width:1.5px; background:#27272a;"></div>';
										for (var i = 0; i < cps.length; i++) {
											var item = cps[i];
											var time = item.time || item.time_iso || '';
											var timeFmt = formatCheckpointTime(time);
											var desc = item.description || item.context || '';
											var cloc = cleanCheckpointLocation(item.location || '', desc);
											var loc = cloc ? ' &bull; ' + cloc : '';
											var isLatest = (i === 0);
											var dotBg = isLatest ? 'background:#f3aa18; box-shadow:0 0 10px rgba(243,170,24,0.3);' : 'background:#18181b; border:1.5px solid #3f3f46;';
											var innerDot = isLatest ? '<div style="width:5px; height:5px; border-radius:50%; background:#000000;"></div>' : '<div style="width:4px; height:4px; border-radius:50%; background:#71717a;"></div>';
											var mb = (i === cps.length - 1) ? '0' : '16px';
											var fw = isLatest ? '600' : '400';
											var col = isLatest ? '#ffffff' : '#d4d4d8';

											html += '<div style="position:relative; margin-bottom:' + mb + ';">';
											html += '<div style="position:absolute; left:-22px; top:3px; width:15px; height:15px; border-radius:50%; display:flex; align-items:center; justify-content:center; ' + dotBg + '">' + innerDot + '</div>';
											html += '<div><div style="font-size:12px; font-weight:' + fw + '; color:' + col + '; line-height:1.4;">' + desc + '<span style="color:#71717a; font-weight:400;">' + loc + '</span></div>';
											if (timeFmt) html += '<div style="font-size:10.5px; color:#71717a; margin-top:3px; font-family:\'Neue Haas Display\', \'Neue Haas Grotesk Text Pro\', inherit, sans-serif;">' + timeFmt + '</div>';
											html += '</div></div>';
										}
										html += '<div style="font-size:10.5px; color:#71717a; margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); font-family:\'Neue Haas Display\', \'Neue Haas Grotesk Text Pro\', inherit, sans-serif; display:flex; align-items:center; gap:6px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Scan timestamps reflect the local time of the courier facility.</span></div>';
										html += '</div>';
										container.innerHTML = html;
									}
									if (res.data.status_name) {
										var badge = document.getElementById('artmatter-status-badge');
										if (badge) badge.textContent = res.data.status_name;
									}
									if (res.data.is_delivered) {
										// Reload to reflect all stages complete if newly delivered
										setTimeout(function() { window.location.reload(); }, 1200);
									}
									if (text) text.textContent = 'Up to date';
									setTimeout(function() { if (text) text.textContent = 'Refresh status'; }, 2500);
									return;
								}
							} catch(err) {}
						}
						if (text) text.textContent = 'Up to date';
						setTimeout(function() { if (text) text.textContent = 'Refresh status'; }, 2000);
					};
					xhr.onerror = function() {
						btn.disabled = false;
						if (icon) icon.classList.remove('artmatter-spin-anim');
						if (text) text.textContent = 'Refresh status';
					};
					xhr.send('action=artmatter_refresh_order_tracking&order_id=' + encodeURIComponent(orderId) + '&security=' + encodeURIComponent(nonce));
				});
			})();
			</script>
			<?php endif; ?>
		</div>
		<?php
	}
}

}

if ( ! class_exists( 'Artmatter_Order_Manager' ) ) {
	class_alias( 'Exacoat_Order_Manager', 'Artmatter_Order_Manager' );
}
