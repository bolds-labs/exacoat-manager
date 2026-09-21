<?php
/**
 * Exacoat Checkout - Order Review Totals Template
 * Version: 7.3.2
 * Overrides default WooCommerce review-order.php table with sleek dark totals breakdown.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>

<div class="artmatter-co-totals-table woocommerce-checkout-review-order-table">
	<!-- Subtotal -->
	<div class="artmatter-co-total-row">
		<span class="total-label"><?php esc_html_e( 'Subtotal', 'woocommerce' ); ?></span>
		<span class="total-value"><?php wc_cart_totals_subtotal_html(); ?></span>
	</div>

	<!-- Coupons -->
	<?php foreach ( WC()->cart->get_coupons() as $code => $coupon ) : ?>
		<div class="artmatter-co-total-row discount-row coupon-<?php echo esc_attr( sanitize_title( $code ) ); ?>">
			<span class="total-label"><?php wc_cart_totals_coupon_label( $coupon ); ?></span>
			<span class="total-value"><?php wc_cart_totals_coupon_html( $coupon ); ?></span>
		</div>
	<?php endforeach; ?>



	<!-- Shipping -->
	<?php if ( WC()->cart->needs_shipping() ) : ?>
		<div class="artmatter-co-total-row shipping-row">
			<span class="total-label"><?php esc_html_e( 'Shipping', 'woocommerce' ); ?></span>
			<span class="total-value">
				<?php
				$packages = ( function_exists( 'WC' ) && WC()->shipping() ) ? WC()->shipping()->get_packages() : [];
				$chosen_method = WC()->session ? ( WC()->session->get( 'chosen_shipping_methods' )[0] ?? '' ) : '';
				$rates = ( ! empty( $packages ) && isset( $packages[0]['rates'] ) ) ? $packages[0]['rates'] : [];
				if ( ! empty( $chosen_method ) && isset( $rates[ $chosen_method ] ) ) {
					$cost = $rates[ $chosen_method ]->get_cost();
					$checkout_engine = class_exists( 'Exacoat_Checkout_Engine' ) ? 'Exacoat_Checkout_Engine' : ( class_exists( 'Artmatter_Checkout_Engine' ) ? 'Artmatter_Checkout_Engine' : false );
					$curr = $checkout_engine ? $checkout_engine::get_active_currency() : ( function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR' );
					echo ( $cost == 0 ) ? esc_html__( 'Free', 'exacoat-core' ) : wc_price( $cost, [ 'currency' => $curr ] );
				} else {
					echo '<span class="shipping-calculated-note" style="font-size:12px;color:var(--am-co-text-muted,#a1a1aa);font-weight:400;">' . esc_html__( 'Calculated at next step', 'exacoat-core' ) . '</span>';
				}
				?>
			</span>
		</div>
	<?php endif; ?>

	<!-- Fees -->
	<?php foreach ( WC()->cart->get_fees() as $fee ) : 
		$is_discount = ( $fee->total < 0 || stripos( $fee->name, 'discount' ) !== false );
	?>
		<div class="artmatter-co-total-row fee-row <?php echo $is_discount ? 'discount-row shipping-discount-row' : ''; ?>">
			<span class="total-label"><?php echo esc_html( $fee->name ); ?></span>
			<span class="total-value"><?php wc_cart_totals_fee_html( $fee ); ?></span>
		</div>
	<?php endforeach; ?>

	<!-- Tax -->
	<?php if ( wc_tax_enabled() && ! WC()->cart->display_prices_including_tax() ) : ?>
		<?php if ( 'itemized' === get_option( 'woocommerce_tax_total_display' ) ) : ?>
			<?php foreach ( WC()->cart->get_tax_totals() as $code => $tax ) : ?>
				<div class="artmatter-co-total-row tax-row">
					<span class="total-label"><?php echo esc_html( $tax->label ); ?></span>
					<span class="total-value"><?php echo wp_kses_post( $tax->formatted_amount ); ?></span>
				</div>
			<?php endforeach; ?>
		<?php else : ?>
			<div class="artmatter-co-total-row tax-row">
				<span class="total-label"><?php echo esc_html( WC()->countries->tax_or_vat() ); ?></span>
				<span class="total-value"><?php wc_cart_totals_taxes_total_html(); ?></span>
			</div>
		<?php endif; ?>
	<?php endif; ?>

	<!-- Final Total -->
	<div class="artmatter-co-total-row final-total-row">
		<span class="total-label"><?php esc_html_e( 'Total', 'woocommerce' ); ?></span>
		<span class="total-value amount"><?php wc_cart_totals_order_total_html(); ?></span>
	</div>
</div>
