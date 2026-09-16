<?php
/**
 * Artmatter Luxury Checkout - Thank You / Order Received Template
 * Version: 7.5.1
 * Overrides default WooCommerce thankyou.php with real production status and delivery address.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>

<div class="artmatter-thankyou-shell">
	<?php if ( $order ) : ?>

		<?php if ( $order->has_status( 'failed' ) ) : ?>
			<div class="artmatter-ty-header">
				<div class="artmatter-ty-badge-icon" style="background:rgba(244,63,94,0.1);border-color:rgba(244,63,94,0.3);box-shadow:0 0 30px rgba(244,63,94,0.2);">
					<svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
				</div>
				<h1 class="artmatter-ty-title"><?php esc_html_e( 'Order Payment Failed', 'woocommerce' ); ?></h1>
				<p class="artmatter-ty-subtitle"><?php esc_html_e( 'Unfortunately your order cannot be processed as the originating bank/merchant declined the transaction. Please attempt your purchase again.', 'woocommerce' ); ?></p>
				<div class="artmatter-ty-actions" style="margin-top:24px;">
					<a href="<?php echo esc_url( $order->get_checkout_payment_url() ); ?>" class="artmatter-ty-btn-primary"><?php esc_html_e( 'Pay for Order', 'woocommerce' ); ?></a>
				</div>
			</div>
		<?php else : ?>

			<?php
			$first_name = $order->get_billing_first_name() ?: esc_html__( 'Customer', 'exacoat-core' );
			$order_id   = $order->get_id();
			$order_num  = $order->get_order_number();
			$raw_status = $order->get_status();
			$status_name = wc_get_order_status_name( $raw_status );

			// Determine active production stage (1 to 6)
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

			$is_abnormal_status = in_array( $raw_status, [ 'cancelled', 'refunded', 'failed' ], true );
			$active_stage_index = isset( $status_stages[ $raw_status ] ) ? $status_stages[ $raw_status ] : 1;
			?>

			<div class="artmatter-ty-header">
				<div class="artmatter-ty-badge-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
				</div>
				<h1 class="artmatter-ty-title"><?php echo sprintf( esc_html__( 'Thank you for your order, %s!', 'artmatter-core' ), esc_html( $first_name ) ); ?></h1>
				<p class="artmatter-ty-subtitle"><?php echo sprintf( esc_html__( 'Order #%s has been received and is currently in %s status.', 'artmatter-core' ), esc_html( $order_num ), '<strong style="color:#ffffff;">' . esc_html( $status_name ) . '</strong>' ); ?></p>
			</div>

			<!-- Dynamic Production Fulfillment Timeline -->
			<?php if ( ! $is_abnormal_status ) : ?>
				<div class="artmatter-ty-timeline-card">
					<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
						<div style="font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;font-weight:500;">
							<?php esc_html_e( 'Fulfillment Status', 'artmatter-core' ); ?>
						</div>
						<div class="artmatter-order-status-pill status-<?php echo esc_attr( $raw_status ); ?>">
							<?php echo esc_html( $status_name ); ?>
						</div>
					</div>
					<div class="artmatter-ty-timeline">
						<?php
						$stages = [
							1 => [
								'label' => __( 'Confirmed', 'artmatter-core' ),
								'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
							],
							2 => [
								'label' => __( 'In Production', 'artmatter-core' ),
								'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
							],
							3 => [
								'label' => __( 'Quality Check', 'artmatter-core' ),
								'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
							],
							4 => [
								'label' => __( 'Ready to Ship', 'artmatter-core' ),
								'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
							],
							5 => [
								'label' => __( 'Shipped', 'artmatter-core' ),
								'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg>',
							],
							6 => [
								'label' => __( 'Delivered', 'artmatter-core' ),
								'icon'  => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
							],
						];

						foreach ( $stages as $idx => $stage_data ) :
							$is_active  = ( $active_stage_index >= $idx );
							$is_current = ( $active_stage_index === $idx );
						?>
							<div class="artmatter-ty-timeline-step <?php echo $is_active ? 'is-active' : ''; ?> <?php echo $is_current ? 'is-current' : ''; ?>">
								<div class="artmatter-ty-step-dot"><?php echo $stage_data['icon']; ?></div>
								<div class="artmatter-ty-step-label"><?php echo esc_html( $stage_data['label'] ); ?></div>
							</div>
						<?php endforeach; ?>
					</div>
				</div>
			<?php else : ?>
				<div class="artmatter-ty-timeline-card" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);">
					<div style="display:flex;align-items:center;gap:10px;">
						<span class="artmatter-order-status-pill status-<?php echo esc_attr( $raw_status ); ?>" style="font-size:12px;padding:4px 10px;">
							<?php echo esc_html( $status_name ); ?>
						</span>
						<span style="font-size:12.5px;color:#fca5a5;"><?php echo sprintf( esc_html__( 'This order has been marked as %s.', 'artmatter-core' ), esc_html( strtolower( $status_name ) ) ); ?></span>
					</div>
				</div>
			<?php endif; ?>

			<!-- Itemized Order Summary -->
			<div class="artmatter-ty-details-card">
				<h3 style="font-size:16px;font-weight:500;color:#ffffff;margin:0 0 16px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px;">
					<?php esc_html_e( 'Order Details', 'woocommerce' ); ?>
				</h3>
				<div class="artmatter-co-summary-items">
					<?php foreach ( $order->get_items() as $item_id => $item ) :
						$product = $item->get_product();
						$qty     = $item->get_quantity();
						$thumb_url = $product ? ( wp_get_attachment_image_url( $product->get_image_id(), 'medium' ) ?: wc_placeholder_img_src() ) : wc_placeholder_img_src();
					?>
						<div class="artmatter-co-item-row">
							<div class="artmatter-co-item-thumb-frame">
								<img src="<?php echo esc_url( $thumb_url ); ?>" alt="<?php echo esc_attr( $item->get_name() ); ?>" class="artmatter-co-item-thumb-img" />
								<span class="artmatter-co-item-qty-badge"><?php echo esc_html( $qty ); ?></span>
							</div>
							<div class="artmatter-co-item-info">
								<div class="artmatter-co-item-name"><?php echo esc_html( $item->get_name() ); ?></div>
							</div>
							<div class="artmatter-co-item-price"><?php echo $order->get_formatted_line_subtotal( $item ); ?></div>
						</div>
					<?php endforeach; ?>
				</div>

				<div class="artmatter-co-totals-table" style="margin-top:20px;">
					<?php
					$order_item_totals = $order->get_order_item_totals();
					if ( ! empty( $order_item_totals ) ) :
						foreach ( $order_item_totals as $key => $total_item ) :
							$is_total = ( 'order_total' === $key );
					?>
							<div class="artmatter-co-total-row <?php echo $is_total ? 'final-total-row' : ''; ?> <?php echo esc_attr( $key ); ?>-row">
								<span class="total-label"><?php echo esc_html( rtrim( $total_item['label'], ':' ) ); ?></span>
								<span class="total-value <?php echo $is_total ? 'amount' : ''; ?>"><?php echo wp_kses_post( $total_item['value'] ); ?></span>
							</div>
					<?php
						endforeach;
					else :
					?>
						<div class="artmatter-co-total-row">
							<span class="total-label"><?php esc_html_e( 'Subtotal', 'woocommerce' ); ?></span>
							<span class="total-value"><?php echo $order->get_subtotal_to_display(); ?></span>
						</div>
						<?php if ( $order->get_discount_total() > 0 ) : ?>
							<div class="artmatter-co-total-row discount-row">
								<span class="total-label"><?php esc_html_e( 'Discount', 'woocommerce' ); ?></span>
								<span class="total-value">-<?php echo wc_price( $order->get_discount_total(), [ 'currency' => $order->get_currency() ] ); ?></span>
							</div>
						<?php endif; ?>
						<div class="artmatter-co-total-row shipping-row">
							<span class="total-label"><?php esc_html_e( 'Shipping', 'woocommerce' ); ?></span>
							<span class="total-value"><?php echo $order->get_shipping_to_display() ?: esc_html__( 'Free', 'artmatter-core' ); ?></span>
						</div>
						<div class="artmatter-co-total-row final-total-row">
							<span class="total-label"><?php esc_html_e( 'Total Paid', 'woocommerce' ); ?></span>
							<span class="total-value amount"><?php echo $order->get_formatted_order_total(); ?></span>
						</div>
					<?php endif; ?>
				</div>
			</div>

			<!-- Customer Shipping Address & Delivery Details Card -->
			<div class="artmatter-ty-details-card" style="margin-top:16px;">
				<h3 style="font-size:16px;font-weight:500;color:#ffffff;margin:0 0 14px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px;">
					<?php esc_html_e( 'Delivery & Shipping Details', 'artmatter-core' ); ?>
				</h3>
				<div class="artmatter-ty-address-grid">
					<div class="artmatter-ty-address-card">
						<div class="artmatter-ty-card-subtitle"><?php esc_html_e( 'Shipping Address', 'artmatter-core' ); ?></div>
						<div class="artmatter-ty-card-text">
							<?php
							$formatted_address = $order->get_formatted_shipping_address() ?: $order->get_formatted_billing_address();
							echo wp_kses_post( $formatted_address ?: '-' );
							?>
							<?php if ( $order->get_billing_phone() ) : ?>
								<div style="margin-top:6px;color:#a1a1aa;"><?php echo esc_html( $order->get_billing_phone() ); ?></div>
							<?php endif; ?>
							<?php if ( $order->get_billing_email() ) : ?>
								<div style="color:#71717a;"><?php echo esc_html( $order->get_billing_email() ); ?></div>
							<?php endif; ?>
						</div>
					</div>
					<div class="artmatter-ty-address-card">
						<div class="artmatter-ty-card-subtitle"><?php esc_html_e( 'Shipping Method', 'artmatter-core' ); ?></div>
						<div class="artmatter-ty-card-text">
							<div style="color:#ffffff;font-weight:500;"><?php echo esc_html( $order->get_shipping_method() ?: __( 'Standard Shipping', 'exacoat-core' ) ); ?></div>
							<?php
							$carrier = ( function_exists( 'get_field' ) ? get_field( 'carrier_id', $order_id ) : '' ) 
								?: $order->get_meta( 'carrier_id' ) 
								?: $order->get_meta( '_carrier_id' ) 
								?: get_post_meta( $order_id, 'carrier_id', true );

							$tracking_number = ( function_exists( 'get_field' ) ? get_field( 'tracking_number', $order_id ) : '' ) 
								?: $order->get_meta( 'tracking_number' ) 
								?: $order->get_meta( '_tracking_number' ) 
								?: $order->get_meta( '_artmatter_tracking_number' ) 
								?: get_post_meta( $order_id, 'tracking_number', true );

							if ( empty( $tracking_number ) ) {
								$t_info = $order->get_meta( '_artmatter_tracking_info' ) ?: get_post_meta( $order_id, '_artmatter_tracking_info', true );
								if ( is_array( $t_info ) && ! empty( $t_info['tracking_number'] ) ) {
									$tracking_number = $t_info['tracking_number'];
									$carrier         = $t_info['carrier_id'] ?? ( $t_info['courier'] ?? $carrier );
								}
							}

							if ( $tracking_number ) :
								$track_url = '';
								if ( class_exists( 'Artmatter_Shipping_Tracker' ) ) {
									$track_url = Artmatter_Shipping_Tracker::get_carrier_tracking_url( $carrier, $tracking_number );
								} elseif ( function_exists( 'artmatter_get_carrier_tracking_url' ) ) {
									$track_url = artmatter_get_carrier_tracking_url( $carrier, $tracking_number );
								}

								$checkpoints = $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: get_post_meta( $order_id, '_artmatter_tracking_checkpoints', true );
								if ( ! is_array( $checkpoints ) ) {
									$checkpoints = [];
								}

								// Auto-sync live TrackingMore checkpoints if missing or stale
								if ( class_exists( 'Artmatter_Shipping_Tracker' ) ) {
									$last_sync  = (int) ( $order->get_meta( '_artmatter_last_tracking_sync' ) ?: get_post_meta( $order_id, '_artmatter_last_tracking_sync', true ) );
									$needs_sync = empty( $checkpoints ) || ( ( time() - $last_sync ) > 900 && ! in_array( $raw_status, [ 'completed', 'delivered' ], true ) );

									if ( $needs_sync ) {
										update_post_meta( $order_id, '_artmatter_last_tracking_sync', time() );
										$order->update_meta_data( '_artmatter_last_tracking_sync', time() );
										$order->save();

										Artmatter_Shipping_Tracker::sync_order_tracking( $order_id );

										$order_refreshed = wc_get_order( $order_id );
										if ( $order_refreshed ) {
											$order              = $order_refreshed;
											$raw_status         = $order->get_status();
											$status_name        = wc_get_order_status_name( $raw_status );
											$active_stage_index = isset( $status_stages[ $raw_status ] ) ? $status_stages[ $raw_status ] : 1;
											$checkpoints        = $order->get_meta( '_artmatter_tracking_checkpoints' ) ?: [];
											if ( ! is_array( $checkpoints ) ) {
												$checkpoints = [];
											}
										}
									}
								}
							?>
								<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
									<div style="color:#a1a1aa;font-size:11.5px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
										<span>Tracking: <strong style="color:#f3aa18;font-family:monospace;font-size:12.5px;"><?php echo esc_html( $tracking_number ); ?></strong></span>
									</div>

									<?php if ( ! empty( $checkpoints ) && is_array( $checkpoints ) ) : 
										$top_events = array_slice( $checkpoints, 0, 4 );
										$total_top  = count( $top_events );
									?>
										<div class="artmatter-checkpoints-list" style="position:relative; padding-left:18px; margin-top:12px;">
											<div style="position:absolute; left:5px; top:6px; bottom:10px; width:1.5px; background:rgba(255,255,255,0.1);"></div>
											<?php foreach ( $top_events as $c_idx => $ev ) : 
												$c_time = ! empty( $ev['time'] ) ? $ev['time'] : ( $ev['time_iso'] ?? '' );
												$c_desc = $ev['description'] ?? ( $ev['context'] ?? '' );
												$raw_loc = $ev['location'] ?? '';
												$c_loc  = class_exists( 'Artmatter_Shipping_Tracker' ) ? Artmatter_Shipping_Tracker::clean_checkpoint_location( $raw_loc ) : trim( $raw_loc );
												$is_lat = ( $c_idx === 0 );

												// Suppress duplicate location if description already mentions or ends with it
												$show_loc = ! empty( $c_loc );
												if ( $show_loc ) {
													$desc_clean = trim( rtrim( $c_desc, '.' ) );
													if ( strcasecmp( substr( $desc_clean, -strlen( $c_loc ) ), $c_loc ) === 0 || stripos( $c_desc, '(' . $c_loc . ')' ) !== false ) {
														$show_loc = false;
													}
												}

												$c_time_fmt = class_exists( 'Artmatter_Shipping_Tracker' )
													? Artmatter_Shipping_Tracker::format_checkpoint_time( $c_time )
													: $c_time;
											?>
												<div style="position:relative; margin-bottom:<?php echo $c_idx === $total_top - 1 ? '0' : '12px'; ?>;">
													<div style="position:absolute; left:-18px; top:3px; width:12px; height:12px; border-radius:50%; display:flex; align-items:center; justify-content:center; <?php echo $is_lat ? 'background:#f3aa18; box-shadow:0 0 8px rgba(243,170,24,0.3);' : 'background:#18181b; border:1.5px solid #3f3f46;'; ?>">
														<?php if ( $is_lat ) : ?>
															<div style="width:4px; height:4px; border-radius:50%; background:#000000;"></div>
														<?php else : ?>
															<div style="width:3px; height:3px; border-radius:50%; background:#71717a;"></div>
														<?php endif; ?>
													</div>
													<div>
														<div style="font-size:11.5px; line-height:1.4; color:<?php echo $is_lat ? '#ffffff' : '#d4d4d8'; ?>; font-weight:<?php echo $is_lat ? '500' : '400'; ?>;">
															<?php echo esc_html( $c_desc ); ?>
															<?php if ( $show_loc ) : ?>
																<span style="color:#71717a; font-weight:400;"> &bull; <?php echo esc_html( $c_loc ); ?></span>
															<?php endif; ?>
														</div>
														<?php if ( ! empty( $c_time_fmt ) ) : ?>
															<div style="font-size:10px; color:#71717a; font-family:'Neue Haas Display', 'Neue Haas Grotesk Text Pro', inherit, sans-serif; margin-top:2px;"><?php echo esc_html( $c_time_fmt ); ?></div>
														<?php endif; ?>
													</div>
												</div>
											<?php endforeach; ?>
										</div>
									<?php else : ?>
										<!-- Clean, honest notice when awaiting live courier scans (Zero fake steps) -->
										<div class="artmatter-ty-pending-notice" style="margin-top:12px; padding:10px 12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; display:flex; align-items:flex-start; gap:8px;">
											<div style="width:5px; height:5px; border-radius:50%; background:#f3aa18; margin-top:5px; flex-shrink:0;"></div>
											<div style="font-size:11.5px; line-height:1.5; color:#a1a1aa; font-weight:400;">
												<?php esc_html_e( 'Electronic shipping manifest registered with carrier. Checkpoints will update as your order is processed at the courier hub.', 'artmatter-core' ); ?>
											</div>
										</div>
									<?php endif; ?>
								</div>
							<?php endif; ?>
						</div>
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="artmatter-ty-actions" style="margin-top:24px;">
				<a href="<?php echo esc_url( home_url( '/shop/' ) ); ?>" class="artmatter-ty-btn-primary">
					<span><?php esc_html_e( 'Explore More Skins', 'exacoat-core' ); ?></span>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
				</a>
				<a href="<?php echo esc_url( home_url( '/account#orders' ) ); ?>" class="artmatter-ty-btn-secondary">
					<span><?php esc_html_e( 'View Order History', 'artmatter-core' ); ?></span>
				</a>
			</div>

		<?php endif; ?>

	<?php else : ?>
		<div class="artmatter-ty-header">
			<h1 class="artmatter-ty-title"><?php esc_html_e( 'Thank you for your order!', 'woocommerce' ); ?></h1>
			<p class="artmatter-ty-subtitle"><?php esc_html_e( 'Your order has been received.', 'woocommerce' ); ?></p>
		</div>
	<?php endif; ?>
</div>
