/**
 * Artmatter Luxury Checkout Engine Script
 * Version: 7.10.27
 * Handles multi-step navigation, customer recap sync, promo drawer toggle,
 * and Biteship Automated Address resolution for Indonesia.
 */

jQuery(function ($) {
  'use strict';

  const $body = $(document.body);

  // =========================================================================
  // 1. Multi-Step Navigation & Validation
  // =========================================================================
  const steps = ['information', 'shipping', 'payment'];
  let currentStep = 'information';

  function updateStepperUI(targetStep) {
    const targetIdx = steps.indexOf(targetStep);
    if (targetIdx === -1) return;

    $('.artmatter-co-step').each(function () {
      const stepName = $(this).data('step');
      const stepIdx = steps.indexOf(stepName);

      $(this).removeClass('is-active is-completed');
      if (stepIdx === targetIdx) {
        $(this).addClass('is-active');
      } else if (stepIdx < targetIdx) {
        $(this).addClass('is-completed');
      }
    });

    $('.artmatter-co-step-panel').hide().removeClass('is-active');
    if (targetStep === 'information') {
      $('#artmatter-step-info').fadeIn(150).addClass('is-active');
    } else if (targetStep === 'shipping') {
      $('#artmatter-step-shipping').fadeIn(150).addClass('is-active');
    } else if (targetStep === 'payment') {
      $('#artmatter-step-payment').fadeIn(150).addClass('is-active');
    }

    currentStep = targetStep;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncRecapData() {
    const email = $('#billing_email').val() || '-';
    const country = $('#billing_country').val() || '';

    const addr1 = $('#billing_address_1').val() || '';
    const autoAddr = $('#biteship_automated_input_billing').val() || '';
    const city = $('#billing_city').val() || '';
    const state = $('#billing_state option:selected').text() || $('#billing_state').val() || '';
    const postcode = $('#billing_postcode').val() || '';
    const countryName = $('#billing_country option:selected').text() || country;

    let line1 = addr1;
    let line2 = '';

    if (country === 'ID' && autoAddr && autoAddr.indexOf('not found') === -1) {
      line2 = [autoAddr, postcode].filter(Boolean).join(', ');
    } else {
      const addr2 = $('#billing_address_2').val() || '';
      if (addr2) line1 += (line1 ? ', ' : '') + addr2;
      line2 = [city, state, postcode, countryName].filter(Boolean).join(', ');
    }

    let addressHtml = '';
    if (line1 && line2) {
      addressHtml = line1 + '<br>' + line2;
    } else {
      addressHtml = line1 || line2 || '-';
    }

    const shippingLabel = $('input[name="shipping_method[0]"]:checked').closest('li').find('.am-shipping-title').text() ||
                          $('input[name^="shipping_method"]:checked').closest('li').find('.am-shipping-title').text() ||
                          $('input[name^="shipping_method"]:checked').closest('li').find('label').text() ||
                          'Complimentary Shipping';

    $('#recap-email, #recap-email-2').text(email);
    $('#recap-address, #recap-address-2').html(addressHtml);
    $('#recap-shipping').text(shippingLabel.replace(/\s+/g, ' ').trim());
  }

  function validatePostcodeFormat(postcode, country) {
    if (!postcode) return { valid: false, message: 'Postal code is required.' };
    postcode = postcode.trim();

    switch (country) {
      case 'ID':
        if (!postcode.match(/^\d{5}$/)) {
          return { valid: false, message: 'Invalid postal code for Indonesia (must be 5 digits).' };
        }
        break;
      case 'JP':
        if (!postcode.match(/^\d{3}-?\d{4}$/)) {
          return { valid: false, message: 'Invalid postal code for Japan (e.g. 123-4567 or 1234567).' };
        }
        break;
      case 'US':
        if (!postcode.match(/^\d{5}(-\d{4})?$/)) {
          return { valid: false, message: 'Invalid ZIP code for United States (e.g. 90210).' };
        }
        break;
      case 'SG':
        if (!postcode.match(/^\d{6}$/)) {
          return { valid: false, message: 'Invalid postal code for Singapore (must be 6 digits).' };
        }
        break;
      case 'GB':
        if (!postcode.match(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/)) {
          return { valid: false, message: 'Invalid postal code for United Kingdom (e.g. SW1A 1AA).' };
        }
        break;
      case 'CA':
        if (!postcode.match(/^[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d$/)) {
          return { valid: false, message: 'Invalid postal code for Canada (e.g. K1A 0B1).' };
        }
        break;
      case 'AU':
        if (!postcode.match(/^\d{4}$/)) {
          return { valid: false, message: 'Invalid postal code for Australia (must be 4 digits).' };
        }
        break;
      case 'MY':
      case 'TH':
      case 'KR':
      case 'FR':
      case 'DE':
      case 'IT':
      case 'ES':
        if (!postcode.match(/^\d{5}$/)) {
          return { valid: false, message: 'Invalid postal code (must be 5 digits).' };
        }
        break;
      default:
        if (postcode.length < 3 || postcode.length > 12) {
          return { valid: false, message: 'Invalid postal code format.' };
        }
        break;
    }
    return { valid: true };
  }

  function checkAndDisplayPostcodeError() {
    const country = $('#billing_country').val();
    const $field = $('#billing_postcode_field');
    const postcode = $('#billing_postcode').val() || '';

    $field.find('.artmatter-field-inline-error, .artmatter-postcode-inline-error').remove();
    $('.artmatter-postcode-inline-error').remove();

    if (!postcode) {
      $field.removeClass('woocommerce-invalid');
      return true;
    }

    const res = validatePostcodeFormat(postcode, country);
    if (!res.valid) {
      $field.addClass('woocommerce-invalid');
      $field.after(`<div class="artmatter-field-inline-error artmatter-postcode-inline-error">${res.message}</div>`);
      return false;
    } else {
      $field.removeClass('woocommerce-invalid');
      return true;
    }
  }

  $(document).on('blur change input', '#billing_postcode', checkAndDisplayPostcodeError);

  function validateStep(step) {
    if (step === 'information') {
      const country = $('#billing_country').val();
      let requiredIds = ['#billing_first_name', '#billing_last_name', '#billing_address_1', '#billing_postcode', '#billing_phone', '#billing_email'];
      
      if (country !== 'ID') {
        requiredIds.push('#billing_city');
        const $stateField = $('#billing_state_field');
        if ($stateField.is(':visible') && $stateField.css('display') !== 'none' && $stateField.hasClass('validate-required')) {
          requiredIds.push('#billing_state');
        }
      }

      let isValid = true;
      requiredIds.forEach(function (id) {
        const $el = $(id);
        if ($el.length && $el.is(':visible') && !$el.val()) {
          $el.closest('.form-row').addClass('woocommerce-invalid');
          isValid = false;
        } else if ($el.length) {
          $el.closest('.form-row').removeClass('woocommerce-invalid');
        }
      });

      // Postcode format check
      const postcode = $('#billing_postcode').val() || '';
      if (!postcode) {
        $('#billing_postcode_field').addClass('woocommerce-invalid');
        isValid = false;
      } else if (!checkAndDisplayPostcodeError()) {
        isValid = false;
      }

      // For Indonesia, verify Biteship automated address is valid
      if (country === 'ID') {
        const autoVal = $('#biteship_automated_input_billing').val() || '';
        if (!postcode.match(/^\d{5}$/) || !autoVal || autoVal.indexOf('not found') !== -1 || autoVal.indexOf('Looking up') !== -1) {
          $('#biteship_automated_input_billing').closest('.form-row').addClass('biteship-error-message');
          isValid = false;
        }
      }

      return isValid;
    }
    return true;
  }

  // Ensure all WooCommerce notices are cleanly anchored at the top and deduplicated
  function ensureNoticesOnTop() {
    const $notices = $('.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout, .woocommerce-notices-wrapper, .woocommerce-info, .woocommerce-error, .woocommerce-message, .acfw-one-click-notification, .acfw-coupon-notice')
      .filter(':not(.artmatter-co-modal-error)')
      .filter(function () {
        if ($(this).closest('#artmatter-checkout-notices-top').length) {
          return false;
        }
        // Avoid selecting child notice if parent notice container is already selected
        if ($(this).parents('.woocommerce-NoticeGroup, .woocommerce-NoticeGroup-checkout, .woocommerce-notices-wrapper').length) {
          return false;
        }
        return true;
      });

    if ($notices.length) {
      let $topContainer = $('#artmatter-checkout-notices-top');
      if (!$topContainer.length) {
        $('.artmatter-checkout-wrapper').prepend('<div id="artmatter-checkout-notices-top" class="artmatter-checkout-notices-top"></div>');
        $topContainer = $('#artmatter-checkout-notices-top');
      }
      $topContainer.append($notices);
    }

    deduplicateTopNotices();
  }

  // Deduplicate identical banners and clean empty containers
  function deduplicateTopNotices() {
    const $container = $('#artmatter-checkout-notices-top');
    if (!$container.length) return;

    const seenCouponCodes = new Set();
    const seenTexts = new Set();

    $container.children().each(function () {
      const $el = $(this);
      const text = $el.text().trim().replace(/\s+/g, ' ');

      // 1. Remove empty wrapper containers
      if (!text && !$el.find('input, button, img').length) {
        $el.remove();
        return;
      }

      // 2. De-duplicate by button coupon value (e.g. value="ship")
      const $couponBtn = $el.find('button.acfw_apply_notification, button[value]');
      if ($couponBtn.length) {
        const cVal = ($couponBtn.val() || $couponBtn.attr('value') || '').toLowerCase().trim();
        if (cVal) {
          if (seenCouponCodes.has(cVal)) {
            $el.remove();
            return;
          }
          seenCouponCodes.add(cVal);
        }
      }

      // 3. De-duplicate by normalized text
      if (text) {
        if (seenTexts.has(text)) {
          $el.remove();
        } else {
          seenTexts.add(text);
        }
      }
    });
  }

  // MutationObserver for instantaneous, race-condition-proof notice deduplication
  let noticeObserverInstance = null;
  function setupNoticeObserver() {
    const target = document.getElementById('artmatter-checkout-notices-top');
    if (target && !noticeObserverInstance) {
      noticeObserverInstance = new MutationObserver(function () {
        deduplicateTopNotices();
      });
      noticeObserverInstance.observe(target, { childList: true, subtree: true });
    }
  }

  // Ensure discount rows (like Shipping discount) are dynamically styled
  function styleDiscountRows() {
    $('.artmatter-co-total-row, .woocommerce-checkout-review-order-table tr').each(function () {
      const $row = $(this);
      const label = $row.find('.total-label, th').text().toLowerCase();
      const val = $row.find('.total-value, td').text().trim();
      if (label.indexOf('discount') !== -1 || val.indexOf('-') !== -1) {
        $row.addClass('discount-row shipping-discount-row');
      }
    });
  }

  ensureNoticesOnTop();
  styleDiscountRows();
  setupNoticeObserver();

  $(document).ready(function () {
    ensureNoticesOnTop();
    styleDiscountRows();
    setupNoticeObserver();
  });

  $body.on('updated_checkout', function () {
    setTimeout(function () {
      ensureNoticesOnTop();
      styleDiscountRows();
      deduplicateTopNotices();
    }, 40);
  });

  $(document).ajaxComplete(function () {
    setTimeout(function () {
      ensureNoticesOnTop();
      styleDiscountRows();
      deduplicateTopNotices();
    }, 50);
    setTimeout(deduplicateTopNotices, 200);
  });

  // Handle WooCommerce checkout AJAX error notices cleanly
  $body.on('checkout_error', function () {
    setTimeout(function () {
      ensureNoticesOnTop();
      const $notices = $('#artmatter-checkout-notices-top .woocommerce-error, .woocommerce-error');
      if ($notices.length) {
        const noticeText = $notices.text().toLowerCase();
        if (noticeText.indexOf('postcode') !== -1 || noticeText.indexOf('billing') !== -1 || noticeText.indexOf('address') !== -1 || noticeText.indexOf('phone') !== -1 || noticeText.indexOf('email') !== -1) {
          updateStepperUI('information');
          $('html, body').animate({ scrollTop: 0 }, 250);
        } else if (noticeText.indexOf('terms') !== -1 || noticeText.indexOf('condition') !== -1) {
          // Keep user on payment step, focus and highlight the terms card, and remove redundant top banner
          updateStepperUI('payment');
          const $termsBox = $('#payment .form-row.validate-required');
          if ($termsBox.length) {
            $termsBox.addClass('woocommerce-invalid');
            $('html, body').animate({
              scrollTop: $termsBox.offset().top - 120
            }, 200);
          }
          $('#artmatter-checkout-notices-top').empty();
        } else {
          $('html, body').animate({
            scrollTop: 0
          }, 250);
        }
      }
    }, 50);
  });

  // Stepper Header Links
  $(document).on('click', '.artmatter-co-step, [data-action="goto-step"]', function (e) {
    e.preventDefault();
    const targetStep = $(this).data('target-step') || $(this).data('step');
    if (!targetStep) return;

    const targetIdx = steps.indexOf(targetStep);
    const currentIdx = steps.indexOf(currentStep);

    if (targetIdx > currentIdx) {
      if (!validateStep(currentStep)) {
        return;
      }
    }

    // Sync billing address to shipping fields
    $('#shipping_country').val($('#billing_country').val());
    $('#shipping_postcode').val($('#billing_postcode').val());
    $('#shipping_city').val($('#billing_city').val());
    $('#shipping_state').val($('#billing_state').val());
    $('#shipping_address_1').val($('#billing_address_1').val());

    syncRecapData();
    updateStepperUI(targetStep);

    if (targetStep === 'shipping') {
      const $methodsContainer = $('#artmatter-shipping-methods-container');
      const hasMethods = $methodsContainer.find('ul#shipping_method li, input[name^="shipping_method"]').length > 0;
      if (!hasMethods || isAwaitingBiteshipResponse) {
        $body.trigger('update_checkout');
      }
    }
  });

  // Re-sync recap whenever inputs change
  $(document).on('change blur', '#billing_first_name, #billing_last_name, #billing_email, #billing_address_1, #billing_postcode, #billing_country, input[name^="shipping_method"]', function () {
    syncRecapData();
  });


  // =========================================================================
  // 2. Promo / Discount Code Drawer Toggle & AJAX Apply
  // =========================================================================
  $(document).on('click', '#artmatter_promo_toggle_btn', function (e) {
    e.preventDefault();
    const $drawer = $('#artmatter_promo_drawer');
    const isExpanded = $(this).attr('aria-expanded') === 'true';

    $(this).attr('aria-expanded', !isExpanded);
    $(this).toggleClass('is-open', !isExpanded);
    $drawer.slideToggle(150, function () {
      if (!isExpanded) {
        $('#artmatter_coupon_code_input').focus();
      }
    });
  });

  $(document).on('click', '#artmatter_apply_coupon_btn', function (e) {
    e.preventDefault();
    const $btn = $(this);
    const $input = $('#artmatter_coupon_code_input');
    const $feedback = $('#artmatter_coupon_feedback');
    const code = $input.val().trim();

    if (!code) {
      $feedback.css('color', '#ef4444').text('Please enter a coupon code.').show();
      return;
    }

    $btn.prop('disabled', true).text('Applying...');
    $feedback.hide();

    $.ajax({
      url: window.artmatterCheckoutData?.ajaxUrl || '/wp-admin/admin-ajax.php',
      type: 'POST',
      dataType: 'json',
      data: {
        action: 'artmatter_checkout_apply_coupon',
        coupon_code: code,
        security: window.artmatterCheckoutData?.nonce || '',
      },
      success: function (res) {
        $btn.prop('disabled', false).text('Apply');
        const div = document.createElement('textarea');
        div.innerHTML = res.data?.message || (res.success ? 'Coupon applied.' : 'Invalid coupon code.');
        const cleanMsg = div.value;

        if (res && res.success) {
          $feedback.css('color', '#f3aa18').text(cleanMsg).show();
          $input.val('');
          $body.trigger('update_checkout');
        } else {
          $feedback.css('color', '#ef4444').text(cleanMsg).show();
        }
      },
      error: function () {
        $btn.prop('disabled', false).text('Apply');
        $feedback.css('color', '#ef4444').text('Could not connect to apply coupon.').show();
      },
    });
  });


  // =========================================================================
  // 3. Biteship Automated Address Resolution Engine (Indonesia)
  // =========================================================================
  const ID_PROVINCE_SYNONYMS = {
    'nanggroe aceh darussalam': 'Daerah Istimewa Aceh',
    'nad': 'Daerah Istimewa Aceh',
    'aceh': 'Daerah Istimewa Aceh',
    'di yogyakarta': 'Daerah Istimewa Yogyakarta',
    'diy': 'Daerah Istimewa Yogyakarta',
    'yogyakarta': 'Daerah Istimewa Yogyakarta',
    'jakarta': 'DKI Jakarta',
    'dki': 'DKI Jakarta',
    'dki jakarta': 'DKI Jakarta',
  };

  function normProv(s) {
    return (s || '').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function canonicalProv(label) {
    const n = normProv(label);
    return ID_PROVINCE_SYNONYMS[n] || label;
  }

  function setProvinceSelectFromLabel($select, label) {
    if (!$select.length || !label) return false;
    const target = canonicalProv(label);
    const needle = normProv(target);
    const $opts = $select.find('option');
    let $hit = $opts.filter((i, el) => normProv($(el).text()) === needle);
    if ($hit.length) {
      $select.prop('readonly', false).val($hit.val()).trigger('change');
      return true;
    }
    return false;
  }

  let debounceTimer;
  let isAwaitingBiteshipResponse = false;
  let currentPostcode = '';

  function updateAddressFieldsVisibility() {
    const country = $('#billing_country').val();
    const $autoField = $('#biteship_automated_address_field');
    const $cityField = $('#billing_city_field');
    const $stateField = $('#billing_state_field');
    const $addr2Field = $('#billing_address_2_field');
    const $wrapper = $('.artmatter-checkout-wrapper');

    if (country === 'ID') {
      $wrapper.addClass('is-country-id');
      $cityField.hide().addClass('is-hidden').attr('style', 'display: none !important;');
      $stateField.hide().addClass('is-hidden').attr('style', 'display: none !important;');
      $addr2Field.hide().addClass('is-hidden').attr('style', 'display: none !important;');
      $autoField.show().attr('style', 'display: flex !important;');

      const postcode = $('#billing_postcode').val() || '';
      const autoAddr = $('#biteship_automated_input_billing').val() || '';
      const isValid = postcode.match(/^\d{5}$/) && autoAddr && autoAddr.indexOf('not found') === -1;
      if (isValid) {
        $('#bte-edit-toggle').show();
      }
    } else {
      $wrapper.removeClass('is-country-id');
      $cityField.show().removeClass('is-hidden').removeAttr('style');
      $addr2Field.show().removeClass('is-hidden').removeAttr('style');
      $autoField.attr('style', 'display: none !important;');
      $('#bte-edit-toggle, #biteship_token_editor').hide();

      // Check if state is hidden/not used for this country (e.g. SG, HK, MO, etc.)
      const checkState = function () {
        const currentCountry = $('#billing_country').val();
        const noStateCountries = ['SG', 'HK', 'MO', 'VA', 'SM', 'MC', 'GI', 'KW', 'BH', 'QA'];
        const isKnownNoState = noStateCountries.indexOf(currentCountry) !== -1;
        const isHiddenInDom = $stateField.is(':hidden') || $stateField.hasClass('hidden') || $stateField.attr('style')?.includes('display: none') || !$stateField.find('select, input:not([type="hidden"])').length || ($stateField.find('input').length && $stateField.find('input').val() === '' && !$stateField.hasClass('validate-required') && isKnownNoState);

        if (isKnownNoState || isHiddenInDom) {
          $stateField.hide().addClass('is-hidden').attr('style', 'display: none !important;');
          $cityField.addClass('full-width');
        } else {
          $stateField.removeClass('is-hidden').show().attr('style', 'display: flex !important;');
          $cityField.removeClass('full-width');
        }
      };

      checkState();
      setTimeout(checkState, 60);
      setTimeout(checkState, 250);
    }
  }

  // Country Autofill Detection & Sync
  function makeCountryAutofillReady() {
    const $selects = $('select#billing_country, select#shipping_country');
    $selects.attr('autocomplete', 'country country-name')
            .removeAttr('aria-hidden')
            .attr('tabindex', '0');
  }
  makeCountryAutofillReady();
  $(document).on('updated_checkout', makeCountryAutofillReady);

  function resolveCountryCode(val) {
    if (!val) return '';
    val = $.trim(val);
    if (val.length === 2) return val.toUpperCase();
    
    let matched = '';
    const needle = val.toLowerCase();
    $('#billing_country option').each(function () {
      const optVal = $(this).val().toUpperCase();
      const optText = $.trim($(this).text()).toLowerCase();
      if (optVal === needle.toUpperCase() || optText === needle || optText.indexOf(needle) === 0 || needle.indexOf(optText) === 0) {
        matched = optVal;
        return false;
      }
    });
    return matched;
  }

  let lastCountryVal = $('#billing_country').val() || '';

  function checkAndSyncCountry() {
    const $country = $('#billing_country');
    if (!$country.length) return;

    if ($country.attr('aria-hidden') === 'true') {
      $country.removeAttr('aria-hidden');
    }

    let currentVal = $country.val() || '';
    if (currentVal && currentVal.length !== 2) {
      const resolved = resolveCountryCode(currentVal);
      if (resolved) {
        currentVal = resolved;
        $country.val(resolved);
      }
    }

    if (currentVal && currentVal !== lastCountryVal) {
      lastCountryVal = currentVal;
      $('#shipping_country').val(currentVal);
      if (typeof $.fn.select2 !== 'undefined' && $country.hasClass('select2-hidden-accessible')) {
        $country.val(currentVal).trigger('change.select2');
      }
      $country.trigger('change');
      updateAddressFieldsVisibility();
      $body.trigger('update_checkout');
    }
  }

  $(document).on('input change blur focus animationstart', '#billing_country, #shipping_country, .woocommerce-billing-fields input', checkAndSyncCountry);
  // Browser autofill is not consistent about firing change events. Check a
  // few times during initial paint, then stop instead of polling forever.
  [80, 350, 900, 1800].forEach(function (delay) {
    setTimeout(checkAndSyncCountry, delay);
  });

  function populateTokenEditor(address) {
    const $editor = $('#biteship_token_editor');
    const $toggle = $('#bte-edit-toggle');

    const setToken = (key, val) => {
      const $el = $editor.find(`.bte-token[data-key="${key}"]`);
      $el.text(val || '').attr('data-orig', val || '');
    };

    if (address) {
      setToken('subdistrict', address.subdistrict);
      setToken('district', address.district);
      $editor.data({ city: address.city || '', province: address.province || '' });
      $toggle.show();
    } else {
      setToken('subdistrict', '');
      setToken('district', '');
      $editor.data({ city: '', province: '' });
      $('#biteship_subdistrict_override, #biteship_district_override').val('');
      $toggle.hide();
      $editor.removeClass('active').hide();
      $toggle.find('button').text('Incorrect address? Edit');
    }
  }

  // Bind Postcode Keyup for Biteship lookup
  $(document).on('keyup', '#billing_postcode', function () {
    if ($('#billing_country').val() !== 'ID') return;
    const postcode = $(this).val().trim();
    if (postcode === currentPostcode) return;
    currentPostcode = postcode;

    clearTimeout(debounceTimer);
    const $autoInput = $('#biteship_automated_input_billing');
    $autoInput.val('').closest('.form-row').removeClass('biteship-error-message');

    if (postcode && postcode.match(/^\d{5}$/)) {
      $autoInput.val('Looking up address...').css('color', '#a1a1aa');
      debounceTimer = setTimeout(() => {
        isAwaitingBiteshipResponse = true;
        $body.trigger('update_checkout');
      }, 400);
    } else {
      populateTokenEditor(null);
      if (postcode === '') {
        $body.trigger('update_checkout');
      }
    }
  });

  // Toggle Token Editor Link
  $(document).on('click', '.bte-toggle-link', function () {
    const $editor = $('#biteship_token_editor');
    const isOpen = $editor.toggle().is(':visible');
    $(this).text(isOpen ? 'Done' : 'Incorrect address? Edit');
    if (isOpen) {
      $editor.find('.bte-token:first').focus();
    }
  });

  // Token Editor Inline Edits
  $(document).on('input blur keydown', '#biteship_token_editor .bte-token', function (e) {
    if (e.type === 'keydown' && (e.key === ',' || e.key === 'Enter')) e.preventDefault();
    const sanitize = (s) => (s || '').replace(/[\r\n,]+/g, ' ').trim();
    const $editor = $('#biteship_token_editor');
    const sub = sanitize($editor.find('.bte-token[data-key="subdistrict"]').text());
    const dist = sanitize($editor.find('.bte-token[data-key="district"]').text());
    const city = $editor.data('city') || '';
    const prov = $editor.data('province') || '';

    $('#biteship_subdistrict_override').val(sub);
    $('#biteship_district_override').val(dist);

    const fallbackSub = $editor.find('.bte-token[data-key="subdistrict"]').attr('data-orig');
    const fallbackDist = $editor.find('.bte-token[data-key="district"]').attr('data-orig');

    const full = [sub || fallbackSub, dist || fallbackDist, city, prov].filter(Boolean).join(', ');
    $('#biteship_automated_input_billing').val(full).css('color', '#ffffff');

    const areaDetails = [sub || fallbackSub, dist || fallbackDist].filter(Boolean).join(', ');
    $('#billing_address_2').val(areaDetails);
  });

  // Country Change
  $(document).on('change', '#billing_country', function () {
    const country = $(this).val();
    if (country !== 'ID') {
      $('#biteship_automated_input_billing').val('');
      populateTokenEditor(null);
    }
    updateAddressFieldsVisibility();
    $body.trigger('update_checkout');
  });

  // Dynamic Scroll Masking Gradient for Order Summary
  function updateSummaryItemsMask() {
    const $el = $('.artmatter-co-summary-items');
    if (!$el.length) return;
    const el = $el[0];
    const isScrollable = el.scrollHeight > (el.clientHeight + 2);

    if (!isScrollable) {
      el.style.setProperty('-webkit-mask-image', 'none', 'important');
      el.style.setProperty('mask-image', 'none', 'important');
      return;
    }

    const scrollTop = el.scrollTop;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const atTop = scrollTop <= 3;
    const atBottom = scrollTop >= (maxScroll - 3);

    let maskVal = 'none';
    if (atTop) {
      maskVal = 'linear-gradient(180deg, #000 0%, #000 calc(100% - 36px), transparent 100%)';
    } else if (atBottom) {
      maskVal = 'linear-gradient(180deg, transparent 0%, #000 36px, #000 100%)';
    } else {
      maskVal = 'linear-gradient(180deg, transparent 0%, #000 36px, #000 calc(100% - 36px), transparent 100%)';
    }

    el.style.setProperty('-webkit-mask-image', maskVal, 'important');
    el.style.setProperty('mask-image', maskVal, 'important');
  }

  window.addEventListener('scroll', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('artmatter-co-summary-items')) {
      updateSummaryItemsMask();
    }
  }, true);
  $(window).on('resize', updateSummaryItemsMask);

  // =========================================================================
  // 3. Auto-Detect Existing User & Quick Login Modal
  // =========================================================================
  let hasCheckedEmail = {};
  let isCheckingEmail = false;

  $(document).on('blur change', '#billing_email', function () {
    const email = $(this).val().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email) || hasCheckedEmail[email] || isCheckingEmail) {
      return;
    }

    if ($('.artmatter-co-user-greeting').length) {
      return;
    }

    isCheckingEmail = true;
    $.ajax({
      url: window.artmatterCheckoutData?.ajaxUrl || '/wp-admin/admin-ajax.php',
      type: 'POST',
      data: {
        action: 'artmatter_check_user_exists',
        email: email,
        security: window.artmatterCheckoutData?.nonce,
      },
      success: function (res) {
        isCheckingEmail = false;
        hasCheckedEmail[email] = true;
        if (res.success && res.data && res.data.exists) {
          $('#artmatter_detected_email').text(email);
          $('#artmatter_quick_login_error').hide();
          $('#artmatter_quick_pass').val('');
          openAccountModal();
          setTimeout(() => $('#artmatter_quick_pass').focus(), 200);
        }
      },
      error: function () {
        isCheckingEmail = false;
      }
    });
  });

  function openAccountModal() {
    $('body, html').addClass('artmatter-modal-open').css('overflow', 'hidden');
    $('#artmatter-account-modal').fadeIn(160);
  }

  function closeAccountModal() {
    $('#artmatter-account-modal').fadeOut(150, function () {
      $('body, html').removeClass('artmatter-modal-open').css('overflow', '');
    });
  }

  $(document).on('click', '#artmatter_close_account_modal, #artmatter_btn_continue_guest', function () {
    closeAccountModal();
  });

  $(document).on('click', '#artmatter-account-modal', function (e) {
    if ($(e.target).is('#artmatter-account-modal')) {
      closeAccountModal();
    }
  });

  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && $('#artmatter-account-modal').is(':visible')) {
      closeAccountModal();
    }
  });

  $(document).on('submit', '#artmatter_quick_login_form', function (e) {
    e.preventDefault();
    const email = $('#artmatter_detected_email').text() || $('#billing_email').val();
    const password = $('#artmatter_quick_pass').val();
    const $error = $('#artmatter_quick_login_error');
    const $btn = $('#artmatter_btn_quick_login');

    if (!password) return;

    $btn.prop('disabled', true).html('<span>Authenticating...</span>');
    $error.hide();

    $.ajax({
      url: window.artmatterCheckoutData?.ajaxUrl || '/wp-admin/admin-ajax.php',
      type: 'POST',
      data: {
        action: 'artmatter_checkout_quick_login',
        email: email,
        password: password,
        security: window.artmatterCheckoutData?.nonce,
      },
      success: function (res) {
        $btn.prop('disabled', false).html('<span>Log In & Auto-fill</span>');
        if (res.success && res.data && res.data.user) {
          const u = res.data.user;
          if (u.first_name) $('#billing_first_name').val(u.first_name);
          if (u.last_name) $('#billing_last_name').val(u.last_name);
          if (u.phone) $('#billing_phone').val(u.phone);
          if (u.address_1) $('#billing_address_1').val(u.address_1);
          if (u.address_2) $('#billing_address_2').val(u.address_2);
          if (u.city) $('#billing_city').val(u.city);
          if (u.state) $('#billing_state').val(u.state).trigger('change');
          if (u.postcode) $('#billing_postcode').val(u.postcode).trigger('keyup');
          if (u.country) $('#billing_country').val(u.country).trigger('change');

          const greetingHtml = `<div class="artmatter-co-user-greeting">Welcome back, <span class="artmatter-co-user-name">${u.display_name}</span> (<span class="artmatter-co-user-email">${u.email}</span>).</div>`;
          $('.artmatter-co-section-header .artmatter-co-user-greeting').remove();
          $('.artmatter-co-section-header').prepend(greetingHtml);

          closeAccountModal();
          syncRecapData();
          $body.trigger('update_checkout');
        } else {
          $error.text(res.data?.message || 'Login failed.').fadeIn(150);
        }
      },
      error: function () {
        $btn.prop('disabled', false).html('<span>Log In & Auto-fill</span>');
        $error.text('Connection error. Please try again.').fadeIn(150);
      }
    });
  });

  // Updated Checkout Callback from WooCommerce AJAX
  $body.on('updated_checkout country_to_state_changed', function (event, data) {
    updateAddressFieldsVisibility();
    updateSummaryItemsMask();

    if (data && data.fragments && data.fragments['#artmatter-shipping-methods-container']) {
      $('#artmatter-shipping-methods-container').html(data.fragments['#artmatter-shipping-methods-container']);
    }

    if ($('#billing_country').val() !== 'ID' || !isAwaitingBiteshipResponse) {
      return;
    }
    isAwaitingBiteshipResponse = false;

    const $autoInput = $('#biteship_automated_input_billing');
    const $postcodeField = $('#billing_postcode');

    if (data && data.fragments && data.fragments.biteship_destination_data) {
      const address = data.fragments.biteship_destination_data;
      $('#billing_city').val(address.city);
      setProvinceSelectFromLabel($('#billing_state'), address.province);

      const fullAddress = [address.subdistrict, address.district, address.city, address.province].filter(Boolean).join(', ');
      $autoInput.val(fullAddress).css('color', '#ffffff').closest('.form-row').removeClass('biteship-error-message').css('border-color', '');
      populateTokenEditor(address);

      const areaDetails = [address.subdistrict, address.district].filter(Boolean).join(', ');
      $('#billing_address_2').val(areaDetails);
      $('#bte-edit-toggle').show();
    } else {
      if ($postcodeField.val().match(/^\d{5}$/)) {
        $autoInput.val('Postal code not found. Please check.').css('color', '#ef4444').closest('.form-row').addClass('biteship-error-message');
      } else {
        $autoInput.val('').css('color', '#ffffff').closest('.form-row').removeClass('biteship-error-message');
      }
      populateTokenEditor(null);
      $('#billing_address_2').val('');
    }

    syncRecapData();
  });

  // Initialize on Load
  const $billingWrapper = $('.woocommerce-billing-fields__field-wrapper');
  if ($billingWrapper.length) {
    $billingWrapper.append($('#biteship_automated_address_field, #bte-edit-toggle, #biteship_token_editor'));
  }

  function syncPaymentButtons() {
    const $placeOrder = $('#payment .place-order');
    const $placeOrderBtn = $('#payment #place_order');
    const $step3BackBtn = $('#artmatter-step-payment .artmatter-co-nav-actions .artmatter-co-btn-back');

    if ($placeOrder.length && $placeOrderBtn.length && $step3BackBtn.length) {
      let $actionsRow = $placeOrder.find('.artmatter-co-place-order-actions');
      if (!$actionsRow.length) {
        $actionsRow = $('<div class="artmatter-co-place-order-actions"></div>');
        $placeOrder.append($actionsRow);
      }
      if (!$actionsRow.find('.artmatter-co-btn-back').length) {
        $actionsRow.append($step3BackBtn);
      }
      if (!$actionsRow.find('#place_order').length) {
        $actionsRow.append($placeOrderBtn);
      }
    }
  }

  $(document).ajaxComplete(syncPaymentButtons);
  syncPaymentButtons();
  updateAddressFieldsVisibility();
  syncRecapData();
  setTimeout(updateSummaryItemsMask, 100);

  // Trigger login modal from header link
  $(document).on('click', '#artmatter_trigger_login_modal', function (e) {
    e.preventDefault();
    const email = $('#billing_email').val() ? $('#billing_email').val().trim() : '';
    $('#artmatter_quick_login_error').hide();
    $('#artmatter_quick_pass').val('');

    if (email) {
      $('#artmatter_quick_email').val(email);
      $('#artmatter_quick_email_group').hide();
    } else {
      $('#artmatter_quick_email').val('');
      $('#artmatter_quick_email_group').show();
    }

    openAccountModal();
    setTimeout(function () {
      if (email) {
        $('#artmatter_quick_pass').focus();
      } else {
        $('#artmatter_quick_email').focus();
      }
    }, 160);
  });

  // Universal click handler to activate/focus field on card click
  $(document).on('click', '.woocommerce-billing-fields .form-row, .woocommerce-shipping-fields .form-row, .biteship-automated-address-field, .artmatter-co-address-block .form-row', function (e) {
    if ($(e.target).closest('.woocommerce-account-fields, .bte-edit-wrap, #biteship_token_editor, a, button, input[type="checkbox"]').length) {
      return;
    }
    if ($(e.target).closest('.select2-container').length) {
      return;
    }
    
    const $select2 = $(this).find('select.select2-hidden-accessible');
    if ($select2.length) {
      $select2.select2('open');
      return;
    }
    
    if (!$(e.target).is('input, select, textarea')) {
      const $input = $(this).find('input, select, textarea').first();
      if ($input.length) {
        $input.trigger('focus');
      }
    }
  });

  function ensureShippingHeading() {
    if (!$('#artmatter_shipping_heading').length && $('#billing_country_field').length) {
      $('#billing_country_field').before('<div id="artmatter_shipping_heading" class="artmatter-co-shipping-heading-row"><h2 class="artmatter-co-title">Shipping Address</h2></div>');
    }
  }

  ensureShippingHeading();
  $(document).on('updated_checkout', ensureShippingHeading);

  // Group payment method logos into a dedicated right-aligned container
  function groupPaymentIcons() {
    $('ul.payment_methods li.wc_payment_method > label').each(function () {
      const $label = $(this);
      const $imgs = $label.find('img');
      if ($imgs.length && !$label.find('.artmatter-payment-icons').length) {
        $imgs.wrapAll('<span class="artmatter-payment-icons"></span>');
      }
    });
  }

  groupPaymentIcons();
  $(document).ready(groupPaymentIcons);
  $(document).on('updated_checkout', groupPaymentIcons);
  setTimeout(groupPaymentIcons, 250);
  setTimeout(groupPaymentIcons, 1000);

  // Smooth Payment Gateway Expansion / Collapse Animation
  $(document).on('click', 'ul.payment_methods li.wc_payment_method', function (e) {
    if ($(e.target).closest('.payment_box, a, button, input:not([type="radio"])').length) {
      return;
    }
    const $radio = $(this).find('input[type="radio"]');
    if ($radio.length && !$radio.prop('checked')) {
      $radio.prop('checked', true).trigger('change');
    }
  });

  $(document).on('change', 'input[name="payment_method"]', function () {
    const selectedMethod = $(this).val();
    $('ul.payment_methods li.wc_payment_method').each(function () {
      const $li = $(this);
      const isSelected = $li.find(`input[value="${selectedMethod}"]`).length > 0;
      if (isSelected) {
        $li.addClass('is-selected');
      } else {
        $li.removeClass('is-selected');
      }
    });
  });

  // Whole-card clickable for Terms and Conditions
  $(document).on('click', '#payment .form-row.validate-required, .woocommerce-terms-and-conditions-wrapper .form-row', function (e) {
    if ($(e.target).is('a, input[type="checkbox"]')) {
      return;
    }
    const $checkbox = $(this).find('input[type="checkbox"]#terms, input[type="checkbox"]');
    if ($checkbox.length) {
      $checkbox.prop('checked', !$checkbox.prop('checked')).trigger('change');
    }
  });

  $(document).on('change', '#payment input#terms', function () {
    if ($(this).is(':checked')) {
      $(this).closest('.form-row').removeClass('woocommerce-invalid');
    }
  });

  if ($('#billing_country').val() === 'ID' && $('#billing_postcode').val() && $('#billing_postcode').val().match(/^\d{5}$/)) {
    isAwaitingBiteshipResponse = true;
    $body.trigger('update_checkout');
  }
});
