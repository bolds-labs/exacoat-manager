/**
 * Artmatter Mini Cart & Slide-Over Luxury Drawer Engine
 * Seamless AJAX quantity changes, removal animations, and WooCommerce fragment synchronization.
 */

(function () {
  'use strict';

  function initArtmatterMiniCart() {
    const settings = window.artmatterMiniCartSettings || {
      restUrl: '/wp-json/artmatter/v1/cart',
      nonce: '',
      currency: 'IDR',
      cartUrl: '/cart/',
      checkoutUrl: '/checkout/',
      shopUrl: '/shop/',
    };

    let isUpdating = false;

    // Ensure drawer is a direct child of <body> to eliminate ancestor transform/overflow clipping
    const drawer = document.querySelector('.artmatter-mini-cart-drawer');
    if (drawer && drawer.parentElement !== document.body) {
      document.body.appendChild(drawer);
    }

    // Dynamic positioning anchored directly beneath the active trigger icon
    let activeTrigger = null;

    function positionPanel(trigger) {
      const panel = document.querySelector('.artmatter-mc-panel');
      if (!panel) return;

      const targetEl = trigger || activeTrigger || document.querySelector('.artmatter-cart-trigger, #brxe-asapjl, .cart-toggle');
      const isMobile = window.innerWidth <= 640;

      if (targetEl && targetEl.offsetParent !== null) {
        const rect = targetEl.getBoundingClientRect();
        const top = Math.max(8, Math.round(rect.bottom + 8));

        if (isMobile) {
          panel.style.top = top + 'px';
          panel.style.left = '12px';
          panel.style.right = '12px';
          panel.style.width = 'calc(100vw - 24px)';
          panel.style.maxWidth = 'calc(100vw - 24px)';
          panel.style.maxHeight = 'calc(100vh - ' + (top + 16) + 'px)';
          panel.style.maxHeight = 'calc(100dvh - ' + (top + 16) + 'px)';
          panel.style.transformOrigin = 'top center';
        } else {
          const rightDist = Math.max(16, Math.round(window.innerWidth - rect.right));
          panel.style.top = top + 'px';
          panel.style.right = rightDist + 'px';
          panel.style.left = 'auto';
          panel.style.width = '390px';
          panel.style.maxWidth = 'calc(100vw - 32px)';
          panel.style.maxHeight = 'calc(100vh - ' + (top + 20) + 'px)';
          panel.style.maxHeight = 'calc(100dvh - ' + (top + 20) + 'px)';
          panel.style.transformOrigin = 'top right';
        }
      } else {
        // Fallback default position
        if (isMobile) {
          panel.style.top = '68px';
          panel.style.left = '12px';
          panel.style.right = '12px';
          panel.style.width = 'calc(100vw - 24px)';
          panel.style.maxWidth = 'calc(100vw - 24px)';
          panel.style.maxHeight = 'calc(100vh - 84px)';
          panel.style.maxHeight = 'calc(100dvh - 84px)';
          panel.style.transformOrigin = 'top center';
        } else {
          panel.style.top = '76px';
          panel.style.right = '24px';
          panel.style.left = 'auto';
          panel.style.width = '390px';
          panel.style.maxWidth = 'calc(100vw - 32px)';
          panel.style.maxHeight = 'calc(100vh - 96px)';
          panel.style.maxHeight = 'calc(100dvh - 96px)';
          panel.style.transformOrigin = 'top right';
        }
      }
    }

    function onViewportReposition() {
      const drawer = document.querySelector('.artmatter-mini-cart-drawer.is-open');
      if (drawer && activeTrigger) {
        positionPanel(activeTrigger);
      }
    }

    // 1. Open / Close Drawer Controls
    function openDrawer(trigger) {
      const drawer = document.querySelector('.artmatter-mini-cart-drawer');
      if (!drawer) return;

      if (drawer.parentElement !== document.body) {
        document.body.appendChild(drawer);
      }

      activeTrigger = trigger || null;
      positionPanel(activeTrigger);

      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');

      // Refresh drawer contents on-demand when opened
      fetchCartAndRefresh(false);

      window.addEventListener('resize', onViewportReposition, { passive: true });
      window.addEventListener('scroll', onViewportReposition, { passive: true });
    }

    function closeDrawer() {
      const drawer = document.querySelector('.artmatter-mini-cart-drawer');
      if (!drawer) return;

      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      activeTrigger = null;

      window.removeEventListener('resize', onViewportReposition);
      window.removeEventListener('scroll', onViewportReposition);
    }

    // 2. Global Event Delegation
    document.addEventListener('click', function (e) {
      // Open / Toggle Cart Trigger (Supports Bricks custom icon blocks, class triggers, and data attributes)
      const trigger = e.target.closest(
        '#brxe-asapjl, .artmatter-cart-trigger, .artmatter-cart-trigger-btn, .artmatter-open-cart, .artmatter-mini-cart-toggle, .cart-toggle, .open-mini-cart, .open-cart, [data-action="open-cart"], [data-artmatter-cart-open], [data-open-cart], a[href="#artmatter-cart"], a[href="#cart"]'
      );
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        const drawer = document.querySelector('.artmatter-mini-cart-drawer');
        if (drawer && drawer.classList.contains('is-open')) {
          closeDrawer();
        } else {
          openDrawer(trigger);
        }
        return;
      }

      // Close Cart Trigger
      const closeTrigger = e.target.closest('[data-action="close-mc"]');
      if (closeTrigger) {
        e.preventDefault();
        closeDrawer();
        return;
      }

      // Click outside context card to close
      const openDrawerEl = document.querySelector('.artmatter-mini-cart-drawer.is-open');
      if (openDrawerEl && !e.target.closest('.artmatter-mc-panel')) {
        closeDrawer();
      }

      // Quantity Increase
      const incBtn = e.target.closest('[data-action="increase-qty"]');
      if (incBtn) {
        e.preventDefault();
        const key = incBtn.dataset.key;
        const currentQty = parseInt(incBtn.dataset.currentQty, 10) || 1;
        updateQuantity(key, currentQty + 1);
        return;
      }

      // Quantity Decrease
      const decBtn = e.target.closest('[data-action="decrease-qty"]');
      if (decBtn) {
        e.preventDefault();
        const key = decBtn.dataset.key;
        const currentQty = parseInt(decBtn.dataset.currentQty, 10) || 1;
        if (currentQty <= 1) {
          removeItem(key);
        } else {
          updateQuantity(key, currentQty - 1);
        }
        return;
      }

      // Remove Item
      const removeBtn = e.target.closest('[data-action="remove-item"]');
      if (removeBtn) {
        e.preventDefault();
        const key = removeBtn.dataset.key;
        removeItem(key);
        return;
      }
    });

    // Close on Escape Key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const drawer = document.querySelector('.artmatter-mini-cart-drawer.is-open');
        if (drawer) {
          closeDrawer();
        }
      }
    });

    // 3. AJAX Actions: Update Quantity
    function updateQuantity(key, quantity) {
      if (isUpdating || !key) return;
      isUpdating = true;

      const card = document.querySelector(`.artmatter-mc-item-card[data-key="${key}"]`);
      if (card) {
        card.style.opacity = '0.6';
      }

      fetch(`${settings.restUrl}/update`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': settings.nonce,
        },
        body: JSON.stringify({
          key: key,
          quantity: quantity,
          currency: settings.currency,
        }),
      })
        .then(res => res.json())
        .then(data => {
          isUpdating = false;
          if (card) card.style.opacity = '1';

          if (data && data.success) {
            applyCartUpdates(data);
          }
        })
        .catch(err => {
          isUpdating = false;
          if (card) card.style.opacity = '1';
          console.warn('[ARTMATTER MINI CART] Update failed', err);
        });
    }

    // 4. AJAX Actions: Remove Item
    function removeItem(key) {
      if (isUpdating || !key) return;
      isUpdating = true;

      const card = document.querySelector(`.artmatter-mc-item-card[data-key="${key}"]`);
      if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
      }

      fetch(`${settings.restUrl}/remove`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': settings.nonce,
        },
        body: JSON.stringify({
          key: key,
          currency: settings.currency,
        }),
      })
        .then(res => res.json())
        .then(data => {
          isUpdating = false;
          if (data && data.success) {
            applyCartUpdates(data);
          }
        })
        .catch(err => {
          isUpdating = false;
          if (card) {
            card.style.opacity = '1';
            card.style.transform = 'none';
          }
          console.warn('[ARTMATTER MINI CART] Remove failed', err);
        });
    }

    let isFetching = false;
    let isInternalUpdate = false;
    let refreshDebounceTimer = null;

    // 5. Apply Cart Updates and Fragment Synchronization
    function applyCartUpdates(data) {
      if (!data) return;

      // Update Body HTML
      if (data.fragments && data.fragments['.artmatter-mini-cart-body-wrap']) {
        const bodyContainer = document.querySelector('.artmatter-mc-body');
        if (bodyContainer) {
          bodyContainer.innerHTML = data.fragments['.artmatter-mini-cart-body-wrap'];
        }
      }

      // Update Footer HTML
      if (data.fragments && data.fragments['.artmatter-mini-cart-footer-wrap']) {
        const footerContainer = document.querySelector('.artmatter-mc-footer');
        if (footerContainer) {
          footerContainer.innerHTML = data.fragments['.artmatter-mini-cart-footer-wrap'];
        }
      }

      // Update Badge Count on standard badges and custom Bricks triggers (e.g. #brxe-asapjl)
      const count = typeof data.item_count !== 'undefined' ? data.item_count : 0;
      syncTriggerBadges(count);

      // Trigger WooCommerce standard fragment refresh for theme mini-carts without triggering self-loop
      if (window.jQuery) {
        isInternalUpdate = true;
        window.jQuery(document.body).trigger('wc_fragments_loaded');
        setTimeout(() => {
          isInternalUpdate = false;
        }, 100);
      }
    }

    function updateAllBadgePositions() {
      const badges = document.querySelectorAll('.artmatter-cart-count-badge[data-target-trigger]');
      badges.forEach(badge => {
        const count = parseInt(badge.dataset.count, 10) || 0;
        if (count <= 0) {
          badge.style.setProperty('display', 'none', 'important');
          badge.style.opacity = '0';
          badge.style.visibility = 'hidden';
          return;
        }

        const selector = badge.getAttribute('data-target-trigger');
        if (!selector) return;
        const trigger = document.querySelector(selector);
        if (!trigger) {
          badge.style.setProperty('display', 'none', 'important');
          badge.style.opacity = '0';
          badge.style.visibility = 'hidden';
          return;
        }

        const rect = trigger.getBoundingClientRect();
        // Check if trigger is currently visible on screen (prevents top-left (0,0) placement for hidden desktop triggers on mobile)
        const isVisible = trigger.offsetParent !== null && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;

        if (isVisible) {
          badge.style.position = 'fixed';
          badge.style.top = Math.round(rect.top - 4) + 'px';
          badge.style.left = Math.round(rect.right - 10) + 'px';
          badge.style.right = 'auto';
          badge.style.bottom = 'auto';
          badge.style.setProperty('display', 'inline-flex', 'important');
          badge.style.opacity = '1';
          badge.style.visibility = 'visible';
          badge.style.zIndex = '999999';
          badge.style.pointerEvents = 'none';
        } else {
          // If the trigger element is hidden, strictly hide the badge
          badge.style.setProperty('display', 'none', 'important');
          badge.style.opacity = '0';
          badge.style.visibility = 'hidden';
        }
      });
    }

    // Attach persistent positioning listeners for detached overlay badges
    window.addEventListener('scroll', updateAllBadgePositions, { passive: true });
    window.addEventListener('resize', updateAllBadgePositions, { passive: true });

    function syncTriggerBadges(count) {
      let numericCount = parseInt(count, 10);
      if (isNaN(numericCount) || numericCount <= 0) {
        numericCount = 0;
      }

      // 1. Remove any inner child badges previously injected into Bricks button containers to restore original alignment
      document.querySelectorAll('#brxe-asapjl > .artmatter-cart-count-badge, .artmatter-cart-trigger > .artmatter-cart-count-badge, .cart-toggle > .artmatter-cart-count-badge, [data-action="open-cart"] > .artmatter-cart-count-badge').forEach(b => b.remove());

      // 2. Select all cart triggers across desktop and mobile headers
      const triggerCandidates = Array.from(document.querySelectorAll(
        '#brxe-asapjl, .artmatter-cart-trigger, .artmatter-mini-cart-toggle, .cart-toggle, [data-action="open-cart"], [data-artmatter-cart-open]'
      ));

      const uniqueTriggers = triggerCandidates.filter(el => {
        if (el.tagName.toLowerCase() === 'svg' || el.tagName.toLowerCase() === 'path') return false;
        return !el.parentElement?.closest('.artmatter-cart-trigger-btn, .artmatter-cart-trigger, #brxe-asapjl');
      });

      uniqueTriggers.forEach(el => {
        const selector = el.id ? `#${el.id}` : (el.classList.contains('artmatter-cart-trigger') ? '.artmatter-cart-trigger' : (el.classList.contains('cart-toggle') ? '.cart-toggle' : ''));
        if (!selector) return;

        let badge = document.querySelector(`.artmatter-cart-count-badge[data-target-trigger="${selector}"]`);
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'artmatter-cart-count-badge';
          badge.setAttribute('data-target-trigger', selector);
          document.body.appendChild(badge);
        }

        badge.textContent = numericCount > 0 ? String(numericCount) : '';
        badge.dataset.count = String(numericCount);
        if (numericCount <= 0) {
          badge.classList.add('is-zero');
          badge.style.setProperty('display', 'none', 'important');
          badge.style.opacity = '0';
          badge.style.visibility = 'hidden';
        } else {
          badge.classList.remove('is-zero');
        }
      });

      // 3. Update existing rendered badges inside native plugin buttons (e.g. .artmatter-cart-icon-box)
      document.querySelectorAll('.artmatter-cart-count-badge:not([data-target-trigger])').forEach(badge => {
        if (numericCount <= 0) {
          badge.textContent = '';
          badge.dataset.count = '0';
          badge.classList.add('is-zero');
          badge.style.setProperty('display', 'none', 'important');
          badge.style.opacity = '0';
          badge.style.visibility = 'hidden';
        } else {
          badge.textContent = String(numericCount);
          badge.dataset.count = String(numericCount);
          badge.classList.remove('is-zero');
          badge.style.removeProperty('display');
          badge.style.opacity = '1';
          badge.style.visibility = 'visible';
        }
      });

      updateAllBadgePositions();

      // 4. Header Counter Text in Drawer
      const headerBadge = document.querySelector('[data-bind="mc-item-count"]');
      if (headerBadge) {
        headerBadge.textContent = numericCount === 1 ? '1 item' : (numericCount === 0 ? '0 items' : `${numericCount} items`);
      }

      // 5. Persist reactive cart count into localStorage for instant 0ms page loads
      try {
        localStorage.setItem('artmatter_cart_count', String(numericCount));
      } catch (e) {}
    }

    // 6. WooCommerce Events Binding
    if (window.jQuery) {
      window.jQuery(document.body).on('added_to_cart', function () {
        clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = setTimeout(() => {
          fetchCartAndRefresh(true);
        }, 150);
      });

      window.jQuery(document.body).on('removed_from_cart', function () {
        clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = setTimeout(() => {
          fetchCartAndRefresh(false);
        }, 150);
      });
    }

    function fetchCartAndRefresh(autoOpen) {
      if (isFetching || isInternalUpdate) return;
      isFetching = true;

      fetch(`${settings.restUrl}?currency=${encodeURIComponent(settings.currency)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'X-WP-Nonce': settings.nonce,
        },
      })
        .then(res => res.json())
        .then(data => {
          isFetching = false;
          if (data && data.success) {
            applyCartUpdates(data);
            if (autoOpen) {
              openDrawer();
            }
          }
        })
        .catch(err => {
          isFetching = false;
          console.warn('[ARTMATTER MINI CART] Fetch failed', err);
        });
    }

    // Reactive Zero-Request Header Badge Hydration:
    // Read from localStorage instantly (0ms) so static pages can be 100% cached by Cloudflare/LiteSpeed
    let initialCount = typeof settings.initialCount !== 'undefined' ? parseInt(settings.initialCount, 10) : 0;
    try {
      const cached = localStorage.getItem('artmatter_cart_count');
      if (cached !== null && !isNaN(parseInt(cached, 10))) {
        initialCount = parseInt(cached, 10);
      }
    } catch (e) {}

    // Hydrate all trigger badges immediately with 0 network latency
    syncTriggerBadges(initialCount);

    // Attach prefetch on hover over cart triggers so drawer contents load instantly
    const prefetchTriggers = document.querySelectorAll('#brxe-asapjl, .artmatter-cart-trigger, .artmatter-mini-cart-toggle, .cart-toggle, [data-action="open-cart"], [data-artmatter-cart-open]');
    prefetchTriggers.forEach(t => {
      t.addEventListener('mouseenter', function () {
        if (!isFetching) {
          fetchCartAndRefresh(false);
        }
      }, { once: true, passive: true });
    });

    // If reactive cart is disabled by admin, fall back to legacy initial fetch
    if (settings.reactiveCart === false) {
      fetchCartAndRefresh(false);
    }
  }

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArtmatterMiniCart);
  } else {
    initArtmatterMiniCart();
  }
})();
