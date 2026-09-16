/**
 * Artmatter High-Performance Client-First Wishlist & Collection Engine
 * 
 * 0ms reactive toggles, localStorage persistence, silent server sync,
 * live header counter updater, museum orientation switcher, and custom luxury dropdown.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'artmatter_wishlist';
    const config = window.artmatterWishlistData || {
        restUrl: '/wp-json/artmatter-core/v1/wishlist',
        nonce: '',
        isLoggedIn: false,
        userId: 0,
        serverIds: [],
        currency: 'IDR',
        currencySymbol: 'Rp',
        shopUrl: '/shop/'
    };

    // --- 1. LOCALSTORAGE CORE ---
    function getStoredIds() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
        } catch (e) {
            return [];
        }
    }

    function saveStoredIds(ids) {
        try {
            const unique = Array.from(new Set(ids.map(Number).filter(Boolean)));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
            return unique;
        } catch (e) {
            return ids;
        }
    }

    // --- 2. REACTIVE STATE ---
    let wishlistIds = getStoredIds();

    function isInWishlist(productId) {
        const id = Number(productId);
        return wishlistIds.includes(id);
    }

    function toggleWishlist(productId, artworkTitle = '') {
        const id = Number(productId);
        if (!id) return false;

        const exists = wishlistIds.includes(id);
        if (exists) {
            wishlistIds = wishlistIds.filter(item => item !== id);
        } else {
            wishlistIds.push(id);
        }

        saveStoredIds(wishlistIds);
        updateUI();

        // Format Toast Message with Artwork Title
        let toastMsg = '';
        if (artworkTitle && artworkTitle.trim().length > 0) {
            const cleanTitle = artworkTitle.trim().replace(/^["']|["']$/g, '');
            toastMsg = exists 
                ? `Removed <strong>${cleanTitle}</strong> from your collection` 
                : `Saved <strong>${cleanTitle}</strong> to your collection`;
        } else {
            toastMsg = exists ? 'Removed from your collection' : 'Saved to your collection';
        }

        // Show Toast
        showToast(toastMsg, !exists);

        // Async server sync if logged in
        if (config.isLoggedIn && config.restUrl) {
            fetch(`${config.restUrl}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': config.nonce
                },
                body: JSON.stringify({ product_id: id })
            }).catch(err => console.warn('[Wishlist Engine] Sync notice:', err));
        }

        window.dispatchEvent(new CustomEvent('artmatter:wishlist-updated', {
            detail: { id, inWishlist: !exists, count: wishlistIds.length, ids: wishlistIds, title: artworkTitle }
        }));

        return !exists;
    }

    function clearWishlist() {
        wishlistIds = [];
        saveStoredIds([]);
        updateUI();

        if (config.isLoggedIn && config.restUrl) {
            fetch(`${config.restUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': config.nonce
                },
                body: JSON.stringify({ ids: [] })
            }).catch(() => {});
        }

        window.dispatchEvent(new CustomEvent('artmatter:wishlist-updated', {
            detail: { count: 0, ids: [] }
        }));
    }

    // --- 3. SERVER SYNC & AUTO-MERGE ---
    function initServerSync() {
        if (!config.isLoggedIn || !config.restUrl) return;

        const localIds = getStoredIds();
        const serverIds = Array.isArray(config.serverIds) ? config.serverIds.map(Number) : [];

        const hasUnsyncedLocal = localIds.some(id => !serverIds.includes(id));

        if (hasUnsyncedLocal) {
            fetch(`${config.restUrl}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': config.nonce
                },
                body: JSON.stringify({ ids: localIds })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.ids) {
                    wishlistIds = saveStoredIds(data.ids);
                    updateUI();
                }
            })
            .catch(() => {});
        } else {
            const merged = Array.from(new Set([...localIds, ...serverIds]));
            wishlistIds = saveStoredIds(merged);
            updateUI();
        }
    }

    // --- 4. UI UPDATE LOGIC ---
    function updateUI() {
        const count = wishlistIds.length;

        // Update all bookmark buttons on page
        document.querySelectorAll('.artmatter-wishlist-btn, .artmatter-wishlist-toggle, [data-artmatter-wishlist-btn]').forEach(btn => {
            const pid = Number(btn.getAttribute('data-product-id') || btn.dataset.productId);
            if (pid) {
                if (isInWishlist(pid)) {
                    btn.classList.add('is-active');
                    const label = btn.querySelector('.artmatter-wishlist-label');
                    if (label) label.textContent = 'Saved';
                } else {
                    btn.classList.remove('is-active');
                    const label = btn.querySelector('.artmatter-wishlist-label');
                    if (label) label.textContent = 'Save to Collection';
                }
            }
        });

        // Update header count badges
        document.querySelectorAll('.artmatter-wishlist-count').forEach(el => {
            const format = el.getAttribute('data-format') || '(%d)';
            const showZero = el.getAttribute('data-show-zero') === 'true';
            
            if (count === 0 && !showZero) {
                el.textContent = '0';
            } else {
                el.textContent = format.replace('%d', count);
            }
            
            el.classList.add('bump');
            setTimeout(() => el.classList.remove('bump'), 300);
        });

        // Update page badge count
        const badgeCount = document.querySelector('.artmatter-wishlist-badge-count');
        if (badgeCount) badgeCount.textContent = count;
    }

    // --- 5. TOAST NOTIFICATIONS ---
    let toastTimeout = null;
    function showToast(message, isAdded = true) {
        let toast = document.getElementById('artmatter-wishlist-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'artmatter-wishlist-toast';
            toast.className = 'artmatter-wishlist-toast';
            document.body.appendChild(toast);
        }

        const iconSvg = isAdded 
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="#f3aa18" stroke="#f3aa18" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        toast.classList.add('is-visible');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 2600);
    }

    // --- 6. INTERACTIVE WISHLIST GALLERY ARCHIVE PAGE ---
    let cachedProducts = [];
    let activeOrient = 'all';
    let activeSort = 'recent';

    async function initWishlistPage() {
        const root = document.getElementById('artmatter-wishlist-root');
        if (!root) return;

        const grid = document.getElementById('artmatter-wishlist-grid');
        const emptyState = document.getElementById('artmatter-wishlist-empty');
        const clearBtn = document.getElementById('artmatter-wishlist-clear-btn');
        const orientBtns = root.querySelectorAll('.artmatter-orient-btn');
        const sortWrap = root.querySelector('.artmatter-dir-sort-wrap');
        const sortBtn = root.querySelector('.artmatter-dir-sort-btn');
        const sortLabel = root.querySelector('.artmatter-sort-current-label');
        const sortOptions = root.querySelectorAll('.artmatter-sort-option');

        // Orientation Switcher Buttons (Always active)
        orientBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                orientBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeOrient = btn.getAttribute('data-orient') || 'all';
                renderWishlistGrid();
            });
        });

        // Custom Sort Dropdown (Always active)
        if (sortBtn && sortWrap) {
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sortWrap.classList.toggle('open');
            });

            document.addEventListener('click', (e) => {
                if (!sortWrap.contains(e.target)) {
                    sortWrap.classList.remove('open');
                }
            });

            sortOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    sortOptions.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    activeSort = opt.getAttribute('data-sort') || 'recent';
                    if (sortLabel) sortLabel.textContent = opt.textContent.trim();
                    sortWrap.classList.remove('open');
                    renderWishlistGrid();
                });
            });
        }

        // Clear List Button (Always active)
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (wishlistIds.length === 0) return;
                if (confirm('Are you sure you want to clear your saved collection?')) {
                    clearWishlist();
                    cachedProducts = [];
                    updateOrientationCounts();
                    renderWishlistGrid();
                }
            });
        }

        if (wishlistIds.length === 0) {
            if (grid) grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            updateOrientationCounts();
            return;
        }

        try {
            const res = await fetch(`${config.restUrl}/products?ids=${wishlistIds.join(',')}`);
            const data = await res.json();
            cachedProducts = data.products || [];
            updateOrientationCounts();
            renderWishlistGrid();
        } catch (err) {
            console.error('[Wishlist Engine] Fetch error:', err);
            if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#ef4444;">Unable to load saved items.</p>';
        }
    }

    function updateOrientationCounts() {
        const root = document.getElementById('artmatter-wishlist-root');
        if (!root) return;

        const currentList = cachedProducts.filter(p => wishlistIds.includes(p.id));
        const total = currentList.length;
        const portrait = currentList.filter(p => p.orientation === 'portrait' || !p.orientation).length;
        const landscape = currentList.filter(p => p.orientation === 'landscape').length;

        const allCount = root.querySelector('.artmatter-orient-count[data-count="all"]');
        const portCount = root.querySelector('.artmatter-orient-count[data-count="portrait"]');
        const landCount = root.querySelector('.artmatter-orient-count[data-count="landscape"]');

        if (allCount) allCount.textContent = total;
        if (portCount) portCount.textContent = portrait;
        if (landCount) landCount.textContent = landscape;
    }

    function renderWishlistGrid() {
        const grid = document.getElementById('artmatter-wishlist-grid');
        const emptyState = document.getElementById('artmatter-wishlist-empty');
        if (!grid) return;

        // Filter by Orientation
        let list = cachedProducts.filter(p => wishlistIds.includes(p.id));

        if (activeOrient === 'portrait') {
            list = list.filter(p => p.orientation === 'portrait' || !p.orientation);
        } else if (activeOrient === 'landscape') {
            list = list.filter(p => p.orientation === 'landscape');
        }

        // Sort (Recently added or Alphabetical)
        if (activeSort === 'title_asc') {
            list.sort((a, b) => a.title.localeCompare(b.title));
        } else {
            // Recent (maintain order of wishlistIds array reversed)
            list.sort((a, b) => wishlistIds.indexOf(b.id) - wishlistIds.indexOf(a.id));
        }

        if (list.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';

        grid.innerHTML = list.map(item => `
            <div class="artmatter-wishlist-card ${item.orientation === 'landscape' ? 'is-horizontal' : ''}" data-product-id="${item.id}">
                <div class="artmatter-museum-mat-card">
                    <button type="button" class="artmatter-wishlist-remove-btn artmatter-card-bookmark-btn is-active" data-remove-id="${item.id}" data-product-id="${item.id}" data-artwork-title="${item.title}" title="Remove from collection" aria-label="Remove ${item.title}">
                        <svg class="artmatter-bookmark-icon" viewBox="0 0 24 24" width="18" height="18" fill="#000000" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                    <a href="${item.permalink}" class="artmatter-museum-art-wrap">
                        <img src="${item.image_url}" alt="${item.title}" class="feelform-3d-flat" loading="lazy">
                    </a>
                </div>
                <div class="artmatter-wishlist-card-body">
                    <h3 class="artmatter-wishlist-card-title">
                        <a href="${item.permalink}">${item.title}</a>
                    </h3>
                    ${item.artist_name ? `<p class="artmatter-wishlist-card-artist">By ${item.artist_name}</p>` : ''}
                    <div class="artmatter-wishlist-card-footer">
                        <div class="artmatter-wishlist-card-price">${item.price_html}</div>
                        <a href="${item.add_to_cart_url}" class="artmatter-wishlist-card-btn-cart ${item.is_variable ? 'is-variable' : 'artmatter-ajax-cart'}" data-product_id="${item.id}" data-artwork-title="${item.title}">
                            <span>${item.is_variable ? 'Select Options' : 'Add to Bag'}</span>
                        </a>
                    </div>
                </div>
            </div>
        `).join('');

        // Bind remove actions on cards
        grid.querySelectorAll('.artmatter-wishlist-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rid = Number(btn.getAttribute('data-remove-id'));
                const card = btn.closest('.artmatter-wishlist-card');
                const titleEl = card ? card.querySelector('.artmatter-wishlist-card-title a') : null;
                const title = titleEl ? titleEl.textContent.trim() : (btn.getAttribute('data-artwork-title') || '');
                if (rid) {
                    if (card) {
                        card.style.transform = 'scale(0.85)';
                        card.style.opacity = '0';
                        setTimeout(() => {
                            toggleWishlist(rid, title);
                            updateOrientationCounts();
                            renderWishlistGrid();
                        }, 220);
                    } else {
                        toggleWishlist(rid, title);
                        updateOrientationCounts();
                        renderWishlistGrid();
                    }
                }
            });
        });

        // Bind AJAX Add to Cart buttons on wishlist cards
        grid.querySelectorAll('.artmatter-wishlist-card-btn-cart').forEach(cartBtn => {
            cartBtn.addEventListener('click', async (e) => {
                const pid = Number(cartBtn.getAttribute('data-product_id'));
                const isVariable = cartBtn.classList.contains('is-variable');
                if (!pid || isVariable) {
                    return; // Allow native navigation for variable products
                }

                e.preventDefault();
                e.stopPropagation();

                const defaultLabel = 'Add to Bag';
                cartBtn.classList.add('is-loading');
                cartBtn.classList.remove('is-added', 'added', 'loading');
                cartBtn.innerHTML = '<span>Adding...</span>';
                cartBtn.style.opacity = '0.75';
                cartBtn.style.pointerEvents = 'none';

                const card = cartBtn.closest('.artmatter-wishlist-card');
                const titleEl = card ? card.querySelector('.artmatter-wishlist-card-title a') : null;
                const title = titleEl ? titleEl.textContent.trim() : (cartBtn.getAttribute('data-artwork-title') || '');

                try {
                    const formData = new FormData();
                    formData.append('product_id', pid);
                    formData.append('quantity', 1);

                    const res = await fetch('/?wc-ajax=add_to_cart', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();

                    cartBtn.classList.remove('is-loading', 'loading');
                    cartBtn.classList.add('is-added');
                    cartBtn.innerHTML = '<span>✓ Added</span>';
                    cartBtn.style.background = '#f3aa18';
                    cartBtn.style.color = '#000000';
                    cartBtn.style.opacity = '1';

                    // Trigger WooCommerce cart refresh & Artmatter Mini-Cart drawer
                    if (window.jQuery) {
                        const fragments = (data && data.fragments) ? data.fragments : {};
                        const hash = (data && data.cart_hash) ? data.cart_hash : '';
                        window.jQuery(document.body).trigger('wc_fragment_refresh');
                        window.jQuery(document.body).trigger('added_to_cart', [fragments, hash, null]);
                    }
                    window.dispatchEvent(new CustomEvent('artmatter:cart-updated', { detail: { productId: pid } }));

                    showToast(title ? `Added <strong>${title}</strong> to your bag!` : 'Added to your bag!', true);

                    setTimeout(() => {
                        cartBtn.classList.remove('is-added', 'is-loading', 'added', 'loading');
                        cartBtn.innerHTML = `<span>${defaultLabel}</span>`;
                        cartBtn.style.background = '';
                        cartBtn.style.color = '';
                        cartBtn.style.opacity = '';
                        cartBtn.style.pointerEvents = '';
                    }, 2000);
                } catch (err) {
                    console.warn('[Wishlist] AJAX Add to Cart fallback:', err);
                    cartBtn.classList.remove('is-added', 'is-loading', 'added', 'loading');
                    cartBtn.innerHTML = `<span>${defaultLabel}</span>`;
                    cartBtn.style.background = '';
                    cartBtn.style.color = '';
                    cartBtn.style.opacity = '';
                    cartBtn.style.pointerEvents = '';
                    window.location.href = cartBtn.getAttribute('href');
                }
            });
        });

        // Initialize FeelForm flat previews if available
        if (typeof window.artmatterInitFeelform === 'function') {
            window.artmatterInitFeelform();
        }
    }

    // Hide Wishlist Icon on Custom Order / Customizer Products
    function removeWishlistFromCustomProducts() {
        const isCustom = document.querySelector('.artmatter-finish-selector-wrapper, [data-is-custom="1"], .product-type-custom, .single-custom-order, .product_cat-custom, .product_cat-custom-order, [data-feelform-selector="true"]') ||
                         document.body.classList.contains('term-custom') ||
                         document.body.classList.contains('product-tag-custom') ||
                         window.location.pathname.includes('/custom-order') ||
                         window.location.pathname.includes('/custom');
        if (isCustom) {
            document.querySelectorAll('.artmatter-wishlist-btn, .artmatter-wishlist-toggle, [data-artmatter-wishlist-btn]').forEach(el => el.remove());
        }
    }

    // --- 7. EVENT DELEGATION ---
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.artmatter-wishlist-btn, .artmatter-wishlist-toggle, [data-artmatter-wishlist-btn]');
        if (toggleBtn) {
            e.preventDefault();
            e.stopPropagation();
            const pid = toggleBtn.getAttribute('data-product-id') || toggleBtn.dataset.productId;
            if (pid) {
                // Discover Artwork Title from data attributes or DOM card structure
                let title = toggleBtn.getAttribute('data-artwork-title') || 
                            toggleBtn.getAttribute('data-product-title') || 
                            toggleBtn.dataset.artworkTitle || 
                            toggleBtn.dataset.productTitle || '';

                if (!title) {
                    const card = toggleBtn.closest('.artmatter-results-item, .artmatter-museum-mat-card, .artmatter-wishlist-card, .artmatter-featured-card, .product, .brxe-product-card, .brxe-block, .brxe-container, li.product');
                    if (card) {
                        const titleEl = card.querySelector('.artmatter-museum-title, .artmatter-results-title, .artmatter-wishlist-card-title a, .artmatter-wishlist-card-title, .woocommerce-loop-product__title, .product_title, h2, h3, h4');
                        if (titleEl) {
                            title = titleEl.textContent.trim();
                        }
                        if (!title) {
                            const img = card.querySelector('img.artmatter-museum-art-img, img.feelform-3d-flat, img');
                            if (img && img.alt) {
                                title = img.alt.trim();
                            }
                        }
                    }
                }

                if (!title && document.body.classList.contains('single-product')) {
                    const singleTitle = document.querySelector('.product_title, h1.entry-title');
                    if (singleTitle) title = singleTitle.textContent.trim();
                }

                toggleWishlist(pid, title);
            }
        }
    });

    window.addEventListener('artmatter:wishlist-updated', () => {
        updateUI();
    });

    // DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initServerSync();
            updateUI();
            removeWishlistFromCustomProducts();
            initWishlistPage();
        });
    } else {
        initServerSync();
        updateUI();
        removeWishlistFromCustomProducts();
        initWishlistPage();
    }

    // Export globally
    window.artmatterWishlist = {
        getIds: () => wishlistIds,
        has: isInWishlist,
        toggle: toggleWishlist,
        clear: clearWishlist,
        updateUI: updateUI
    };

})();
