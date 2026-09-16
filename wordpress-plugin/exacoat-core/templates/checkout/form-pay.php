<?php
/**
 * Artmatter Luxury Checkout - Order Repayment Form Template
 * Version: 7.3.1
 * Overrides default WooCommerce form-pay.php with dark luxury payment form.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>

<div class="artmatter-order-pay-shell">
	<div class="artmatter-order-pay-card">
		<div class="artmatter-co-section-header" style="margin-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:16px;">
			<h2 class="artmatter-co-title" style="font-size:22px;"><?php esc_html_e( 'Pay for Order', 'woocommerce' ); ?> #<?php echo esc_html( $order->get_order_number() ); ?></h2>
			<p class="artmatter-co-user-greeting"><?php echo sprintf( esc_html__( 'Total amount due: %s', 'artmatter-core' ), '<strong style="color:#f3aa18;font-family:var(--am-co-font-mono);">' . $order->get_formatted_order_total() . '</strong>' ); ?></p>
		</div>

		<form id="order_review" method="post">
			<!-- Itemized summary table -->
			<div class="artmatter-co-summary-items" style="margin-bottom:24px;">
				<?php if ( count( $order->get_items() ) > 0 ) : ?>
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
				<?php endif; ?>
			</div>

			<!-- Payment Method Selector -->
			<div id="payment" style="margin-top:24px;">
				<?php if ( $order->needs_payment() ) : ?>
					<h3 class="artmatter-co-subtitle" style="font-size:14px;color:#ffffff;margin-bottom:12px;"><?php esc_html_e( 'Payment Method', 'artmatter-core' ); ?></h3>
					<ul class="wc_payment_methods payment_methods methods">
						<?php
						if ( ! empty( $available_gateways ) ) {
							foreach ( $available_gateways as $gateway ) {
								wc_get_template( 'checkout/payment-method.php', array( 'gateway' => $gateway ) );
							}
						} else {
							echo '<li class="woocommerce-notice woocommerce-notice--info woocommerce-info">' . apply_filters( 'woocommerce_no_available_payment_methods_message', esc_html__( 'Sorry, it seems that there are no available payment methods for your location. Please contact us if you require assistance or wish to make alternate arrangements.', 'woocommerce' ) ) . '</li>';
						}
						?>
					</ul>
				<?php endif; ?>

				<div class="form-row" style="margin-top:20px;">
					<input type="hidden" name="woocommerce_pay" value="1" />
					<?php wc_get_template( 'checkout/terms.php' ); ?>
					<?php do_action( 'woocommerce_pay_order_before_submit' ); ?>

					<?php echo apply_filters( 'woocommerce_pay_order_button_html', '<button type="submit" class="button alt artmatter-co-btn-submit" id="place_order" value="' . esc_attr( $order_button_text ) . '" data-value="' . esc_attr( $order_button_text ) . '">' . esc_html( $order_button_text ) . '</button>' ); ?>

					<?php do_action( 'woocommerce_pay_order_after_submit' ); ?>
					<?php wp_nonce_field( 'woocommerce-pay', 'woocommerce-pay-nonce' ); ?>
				</div>
			</div>
		</form>
	</div>
</div>
