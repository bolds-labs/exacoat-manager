<?php
/**
 * Artmatter Luxury Checkout Main Template
 * Version: 7.10.27
 * In-box stacked labels, Biteship automated address integration, and promo toggle drawer.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_login_form', 10 );
remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_login_form', 20 );
remove_action( 'woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10 );
do_action( 'woocommerce_before_checkout_form', $checkout );

// If checkout registration is disabled and not logged in
if ( ! $checkout->is_registration_enabled() && $checkout->is_registration_required() && ! is_user_logged_in() ) {
	echo esc_html( apply_filters( 'woocommerce_checkout_must_be_logged_in_message', __( 'You must be logged in to checkout.', 'woocommerce' ) ) );
	return;
}

$current_user = wp_get_current_user();
$user_email   = $current_user->exists() ? $current_user->user_email : '';
$user_name    = $current_user->exists() ? ( $current_user->display_name ?: $current_user->user_login ) : '';
$currency     = ! empty( $_COOKIE['aelia_cs_selected_currency'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['aelia_cs_selected_currency'] ) ) : ( function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IDR' );

$item_count    = ( function_exists( 'WC' ) && WC()->cart ) ? WC()->cart->get_cart_contents_count() : 0;
?>

<div class="artmatter-checkout-wrapper">
	<div class="artmatter-co-brand-header">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="artmatter-co-brand-link" aria-label="<?php esc_attr_e( 'Return to Exacoat', 'exacoat-core' ); ?>">
			<img src="https://exacoat.com/wp-content/uploads/exacoat-logo.png" alt="Exacoat" class="artmatter-co-brand-logo" />
		</a>
		<div class="artmatter-co-secure-note">
			<span class="artmatter-co-secure-dot" aria-hidden="true"></span>
			<span><?php esc_html_e( 'Secure checkout', 'exacoat-core' ); ?></span>
		</div>
	</div>

	<!-- Dedicated Notices Anchor on Top (Ensures all notices stick to the very top on mobile & desktop) -->
	<div id="artmatter-checkout-notices-top" class="artmatter-checkout-notices-top"></div>

	<!-- Centered Glass Stepper Progress on Top -->
	<div class="artmatter-co-stepper-wrap">
		<div class="artmatter-co-stepper">
			<a href="#information" class="artmatter-co-step is-active" data-step="information">
				<span><?php esc_html_e( 'Information', 'artmatter-core' ); ?></span>
			</a>
			<span class="artmatter-co-step-divider">›</span>
			<a href="#shipping" class="artmatter-co-step" data-step="shipping">
				<span><?php esc_html_e( 'Shipping', 'artmatter-core' ); ?></span>
			</a>
			<span class="artmatter-co-step-divider">›</span>
			<a href="#payment" class="artmatter-co-step" data-step="payment">
				<span><?php esc_html_e( 'Payment', 'artmatter-core' ); ?></span>
			</a>
		</div>
	</div>

	<form name="checkout" method="post" class="checkout woocommerce-checkout artmatter-checkout-grid" action="<?php echo esc_url( wc_get_checkout_url() ); ?>" enctype="multipart/form-data">

		<!-- Hidden Biteship Token Overrides -->
		<input type="hidden" id="biteship_subdistrict_override" name="biteship_subdistrict_override">
		<input type="hidden" id="biteship_district_override" name="biteship_district_override">

		<!-- =================================================================
		     LEFT COLUMN: Form Steps
		     ================================================================= -->
		<div class="artmatter-checkout-main">

			<!-- STEP 1: INFORMATION (Contact & Shipping Address) -->
			<div class="artmatter-co-step-panel is-active" id="artmatter-step-info">
				<div class="artmatter-co-section-header">
					<div class="artmatter-co-section-title-row">
						<h2 class="artmatter-co-title"><?php esc_html_e( 'Contact', 'artmatter-core' ); ?></h2>
						<?php if ( $current_user->exists() ) : ?>
							<div class="artmatter-co-user-greeting">
								<?php echo sprintf( esc_html__( 'Logged in as %s', 'artmatter-core' ), '<span class="artmatter-co-user-name">' . esc_html( $user_name ) . '</span>' ); ?>
							</div>
						<?php else : ?>
							<div class="artmatter-co-returning-customer-prompt">
								<span><?php esc_html_e( 'Have an account?', 'artmatter-core' ); ?></span>
								<a href="#login" id="artmatter_trigger_login_modal" class="artmatter-co-login-link"><?php esc_html_e( 'Log in', 'artmatter-core' ); ?></a>
							</div>
						<?php endif; ?>
					</div>
				</div>

				<div class="artmatter-co-address-block">
					<?php do_action( 'woocommerce_checkout_billing' ); ?>

					<!-- Biteship Automated Address Box (Injected for Indonesia) -->
					<div class="form-row form-row-wide biteship-automated-address-field" id="biteship_automated_address_field" style="display:none;">
						<label for="biteship_automated_input_billing"><?php esc_html_e( 'Automated Address', 'artmatter-core' ); ?></label>
						<span class="woocommerce-input-wrapper">
							<input type="text" class="input-text" id="biteship_automated_input_billing" readonly placeholder="<?php esc_attr_e( 'Enter postcode for automated address', 'artmatter-core' ); ?>">
						</span>
					</div>
					<div id="bte-edit-toggle" class="bte-edit-wrap" style="display:none;">
						<button type="button" class="bte-toggle-link" aria-expanded="false" aria-controls="biteship_token_editor"><?php esc_html_e( 'Incorrect address? Edit', 'artmatter-core' ); ?></button>
					</div>
					<div id="biteship_token_editor" class="biteship-token-editor" role="group" aria-hidden="true" style="display:none;">
						<span class="bte-token" data-key="subdistrict" contenteditable="true" title="Edit subdistrict"></span>
						<span class="bte-token" data-key="district" contenteditable="true" title="Edit district"></span>
					</div>

					<?php do_action( 'woocommerce_checkout_shipping' ); ?>

					<?php if ( ! $current_user->exists() ) : ?>
						<div class="artmatter-co-create-account-note">
							<span><?php esc_html_e( 'Save your info for next time: you can create an account on the order confirmation page.', 'artmatter-core' ); ?></span>
						</div>
					<?php endif; ?>
				</div>

				<div class="artmatter-co-nav-actions">
					<button type="button" class="artmatter-co-btn-next" data-action="goto-step" data-target-step="shipping">
						<span><?php esc_html_e( 'Continue to shipping', 'artmatter-core' ); ?></span>
					</button>
				</div>
			</div>

			<!-- STEP 2: SHIPPING METHOD -->
			<div class="artmatter-co-step-panel" id="artmatter-step-shipping" style="display:none;">
				<!-- Customer Info Recap Box (Directly at top) -->
				<div class="artmatter-co-recap-box">
					<div class="artmatter-co-recap-row">
						<span class="recap-label"><?php esc_html_e( 'Contact', 'artmatter-core' ); ?></span>
						<span class="recap-value" id="recap-email"><?php echo esc_html( $user_email ?: '-' ); ?></span>
						<a href="#information" class="recap-edit" data-action="goto-step" data-target-step="information"><?php esc_html_e( 'Change', 'artmatter-core' ); ?></a>
					</div>
					<div class="artmatter-co-recap-row">
						<span class="recap-label"><?php esc_html_e( 'Ship to', 'artmatter-core' ); ?></span>
						<span class="recap-value" id="recap-address">-</span>
						<a href="#information" class="recap-edit" data-action="goto-step" data-target-step="information"><?php esc_html_e( 'Change', 'artmatter-core' ); ?></a>
					</div>
				</div>

				<!-- Shipping Methods Section -->
				<div class="artmatter-co-shipping-options-wrap">
					<h2 class="artmatter-co-title" style="margin: 28px 0 14px;"><?php esc_html_e( 'Shipping method', 'artmatter-core' ); ?></h2>
					<div id="artmatter-shipping-methods-container">
						<?php if ( WC()->cart->needs_shipping() && WC()->cart->show_shipping() ) : ?>
							<?php wc_cart_totals_shipping_html(); ?>
						<?php else : ?>
							<p style="font-size:13px;color:#a1a1aa;"><?php esc_html_e( 'No shipping required or standard complimentary shipping applies.', 'artmatter-core' ); ?></p>
						<?php endif; ?>
					</div>
				</div>

				<div class="artmatter-co-nav-actions" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
					<button type="button" class="artmatter-co-btn-back" data-action="goto-step" data-target-step="information">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
						<span><?php esc_html_e( 'Return to information', 'artmatter-core' ); ?></span>
					</button>
					<button type="button" class="artmatter-co-btn-next" data-action="goto-step" data-target-step="payment">
						<span><?php esc_html_e( 'Continue to payment', 'artmatter-core' ); ?></span>
					</button>
				</div>
			</div>

			<!-- STEP 3: PAYMENT -->
			<div class="artmatter-co-step-panel" id="artmatter-step-payment" style="display:none;">
				<!-- Customer Info + Shipping Recap Box (Directly at top) -->
				<div class="artmatter-co-recap-box">
					<div class="artmatter-co-recap-row">
						<span class="recap-label"><?php esc_html_e( 'Contact', 'artmatter-core' ); ?></span>
						<span class="recap-value" id="recap-email-2"><?php echo esc_html( $user_email ?: '-' ); ?></span>
						<a href="#information" class="recap-edit" data-action="goto-step" data-target-step="information"><?php esc_html_e( 'Change', 'artmatter-core' ); ?></a>
					</div>
					<div class="artmatter-co-recap-row">
						<span class="recap-label"><?php esc_html_e( 'Ship to', 'artmatter-core' ); ?></span>
						<span class="recap-value" id="recap-address-2">-</span>
						<a href="#information" class="recap-edit" data-action="goto-step" data-target-step="information"><?php esc_html_e( 'Change', 'artmatter-core' ); ?></a>
					</div>
					<div class="artmatter-co-recap-row">
						<span class="recap-label"><?php esc_html_e( 'Method', 'artmatter-core' ); ?></span>
						<span class="recap-value" id="recap-shipping">-</span>
						<a href="#shipping" class="recap-edit" data-action="goto-step" data-target-step="shipping"><?php esc_html_e( 'Change', 'artmatter-core' ); ?></a>
					</div>
				</div>

				<!-- Payment Methods Section -->
				<div class="artmatter-co-payment-methods-wrap">
					<h2 class="artmatter-co-title" style="margin: 28px 0 4px;"><?php esc_html_e( 'Payment', 'artmatter-core' ); ?></h2>
					<p class="artmatter-co-user-greeting" style="margin-bottom: 16px;"><?php esc_html_e( 'All transactions are secure and encrypted.', 'artmatter-core' ); ?></p>
					<?php woocommerce_checkout_payment(); ?>
				</div>

				<div class="artmatter-co-nav-actions" style="margin-top:16px;">
					<button type="button" class="artmatter-co-btn-back" data-action="goto-step" data-target-step="shipping">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
						<span><?php esc_html_e( 'Return to shipping', 'artmatter-core' ); ?></span>
					</button>
				</div>
			</div>

		</div> <!-- .artmatter-checkout-main -->

		<!-- =================================================================
		     RIGHT COLUMN: Sticky Luxury Order Summary
		     ================================================================= -->
		<div class="artmatter-checkout-sidebar">
			<div class="artmatter-co-sticky-summary">
				<div class="artmatter-co-summary-card">

					<!-- Custom Line Items List with Museum Mat Frames -->
					<div class="artmatter-co-summary-items">
						<?php
						foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) :
							$product = $cart_item['data'] ?? null;
							if ( ! $product instanceof WC_Product ) continue;

							$qty        = max( 1, (int) ( $cart_item['quantity'] ?? 1 ) );
							$product_id = (int) ( $cart_item['product_id'] ?? 0 );

							$thumb_id   = $product->get_image_id();
							$thumb_url  = $thumb_id ? wp_get_attachment_image_url( $thumb_id, 'medium' ) : wc_placeholder_img_src();

							$is_landscape = false;
							if ( $thumb_id > 0 ) {
								$meta = wp_get_attachment_metadata( $thumb_id );
								if ( is_array( $meta ) && ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
									$is_landscape = ( (int) $meta['width'] > (int) $meta['height'] );
								}
							}

							// Extract variation finish metadata
							$finish_label = '';
							if ( ! empty( $cart_item['variation'] ) ) {
								foreach ( $cart_item['variation'] as $k => $v ) {
									if ( stripos( $k, 'finish' ) !== false || stripos( $k, 'pa_finish' ) !== false || stripos( $k, 'feelform' ) !== false ) {
										$finish_label = 'Finish: ' . ucwords( str_replace( '-', ' ', $v ) );
										break;
									}
								}
							}

							$line_price_html = WC()->cart->get_product_subtotal( $product, $qty );
							?>
							<div class="artmatter-co-item-row">
								<div class="artmatter-co-item-thumb-frame <?php echo $is_landscape ? 'is-landscape' : ''; ?>">
									<img src="<?php echo esc_url( $thumb_url ); ?>" alt="<?php echo esc_attr( $product->get_name() ); ?>" class="artmatter-co-item-thumb-img" loading="lazy" />
									<span class="artmatter-co-item-qty-badge"><?php echo esc_html( $qty ); ?></span>
								</div>
								<div class="artmatter-co-item-info">
									<div class="artmatter-co-item-name"><?php echo esc_html( $product->get_name() ); ?></div>
									<?php if ( ! empty( $finish_label ) ) : ?>
										<div class="artmatter-co-item-meta" style="color:#a1a1aa;"><?php echo esc_html( $finish_label ); ?></div>
									<?php endif; ?>
								</div>
								<div class="artmatter-co-item-price"><?php echo $line_price_html; ?></div>
							</div>
						<?php endforeach; ?>
					</div>

					<!-- Collapsible Promo / Discount Code Drawer -->
					<div class="artmatter-co-promo-wrap">
						<button type="button" class="artmatter-co-promo-toggle-btn" id="artmatter_promo_toggle_btn" aria-expanded="false">
							<span><?php esc_html_e( 'Have a promo code?', 'artmatter-core' ); ?></span>
							<svg class="artmatter-co-promo-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
						</button>
						<div class="artmatter-co-coupon-group" id="artmatter_promo_drawer" style="display:none;">
							<input type="text" name="artmatter_coupon_code_input" id="artmatter_coupon_code_input" placeholder="<?php esc_attr_e( 'Enter code...', 'artmatter-core' ); ?>" />
							<button type="button" id="artmatter_apply_coupon_btn" class="artmatter-co-btn-coupon"><?php esc_html_e( 'Apply', 'artmatter-core' ); ?></button>
						</div>
						<div id="artmatter_coupon_feedback" style="display:none;font-size:12px;margin-top:6px;"></div>
					</div>

					<!-- Live Totals Review Table Container -->
					<div id="order_review" class="woocommerce-checkout-review-order">
						<?php wc_get_template( 'checkout/review-order.php' ); ?>
					</div>

				</div> <!-- .artmatter-co-summary-card -->
			</div> <!-- .artmatter-co-sticky-summary -->
		</div> <!-- .artmatter-checkout-sidebar -->

	</form>

	<!-- Auto-Detected Existing User Quick Login Modal -->
	<div id="artmatter-account-modal" class="artmatter-co-modal-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="artmatter_modal_title">
		<div class="artmatter-co-modal-card">
			<button type="button" class="artmatter-co-modal-close" id="artmatter_close_account_modal" aria-label="<?php esc_attr_e( 'Close', 'artmatter-core' ); ?>">&times;</button>
			<div class="artmatter-co-modal-header">
				<div class="artmatter-co-modal-badge">
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
				</div>
				<h3 class="artmatter-co-modal-title" id="artmatter_modal_title"><?php esc_html_e( 'Welcome back', 'artmatter-core' ); ?></h3>
				<p class="artmatter-co-modal-desc">
					<?php esc_html_e( 'Log in to access your saved addresses & faster checkout.', 'artmatter-core' ); ?>
				</p>
			</div>

			<form id="artmatter_quick_login_form" method="post" onsubmit="return false;">
				<div class="artmatter-co-modal-field-group" id="artmatter_quick_email_group" style="display:none; margin-bottom:12px;">
					<label for="artmatter_quick_email"><?php esc_html_e( 'Email address', 'artmatter-core' ); ?></label>
					<input type="email" id="artmatter_quick_email" name="artmatter_quick_email" autocomplete="email" placeholder="<?php esc_attr_e( 'name@example.com', 'artmatter-core' ); ?>" />
				</div>
				<div class="artmatter-co-modal-field-group" style="margin-bottom:14px;">
					<label for="artmatter_quick_pass"><?php esc_html_e( 'Password', 'artmatter-core' ); ?></label>
					<input type="password" id="artmatter_quick_pass" name="artmatter_quick_pass" required autocomplete="current-password" placeholder="<?php esc_attr_e( 'Enter your password', 'artmatter-core' ); ?>" />
				</div>

				<div id="artmatter_quick_login_error" class="artmatter-co-modal-error" style="display:none;"></div>

				<div class="artmatter-co-modal-actions">
					<button type="submit" id="artmatter_btn_quick_login" class="artmatter-co-btn-next" style="width:100%;">
						<span><?php esc_html_e( 'Log In & Auto-fill', 'artmatter-core' ); ?></span>
					</button>
					<button type="button" id="artmatter_btn_continue_guest" class="artmatter-co-btn-guest-opt">
						<span><?php esc_html_e( 'Continue as guest', 'artmatter-core' ); ?></span>
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
