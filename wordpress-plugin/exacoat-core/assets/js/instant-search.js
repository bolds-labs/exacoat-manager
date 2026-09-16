/**
 * Artmatter Instant Live Search Client
 * Lightning-fast multi-index search with keyboard navigation & client-side caching
 */
(function () {
  'use strict';

  // Config & State
  const settings = window.artmatterSearchSettings || {
    apiUrl: '/wp-json/artmatter-core/v1/search',
    currency: 'IDR',
    siteUrl: '/',
  };

  const cache = new Map();
  let activeQuery = '';
  let activeTab = 'all';
  let debounceTimer = null;
  let selectedIndex = -1;
  let currentResults = null;

  // DOM Elements
  let modal, backdrop, input, clearBtn, resultsContainer, loadingSkeleton, tabButtons;

  function init() {
    modal = document.getElementById('artmatter-search-modal');
    if (!modal) return;

    backdrop = modal.querySelector('.artmatter-search-backdrop');
    input = document.getElementById('artmatter-search-input');
    clearBtn = document.getElementById('artmatter-search-clear');
    resultsContainer = document.getElementById('artmatter-search-results');
    loadingSkeleton = document.getElementById('artmatter-search-loading');
    tabButtons = document.querySelectorAll('.artmatter-tab-btn');

    attachGlobalEvents();
    attachModalEvents();
  }

  function attachGlobalEvents() {
    // 1. Click on any search trigger button / bar / link
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest(
        '[data-artmatter-search-trigger], .artmatter-search-trigger, #artmatter-search-trigger, a[href="#search"], a[href="#artmatter-search"], .search-trigger'
      );

      if (trigger) {
        e.preventDefault();
        openModal();
      }
    });

    // 2. Global Shortcut: Cmd+K / Ctrl+K / '/'
    document.addEventListener('keydown', function (e) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleModal();
        return;
      }

      // Quick slash trigger when not in an input
      if (e.key === '/' && !isModalOpen()) {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag !== 'input' && activeTag !== 'textarea' && !document.activeElement.isContentEditable) {
          e.preventDefault();
          openModal();
        }
      }
    });
  }

  function attachModalEvents() {
    // Close on backdrop / close buttons
    modal.querySelectorAll('[data-artmatter-search-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    // Input changes with debounce
    input.addEventListener('input', function () {
      const q = input.value.trim();
      clearBtn.style.display = q.length > 0 ? 'inline-flex' : 'none';
      handleSearchInput(q);
    });

    // Clear button
    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.style.display = 'none';
      input.focus();
      handleSearchInput('');
    });

    // Tab buttons
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab') || 'all';
        selectedIndex = -1;
        renderResults();
      });
    });

    // Keyboard navigation inside modal
    input.addEventListener('keydown', function (e) {
      if (!isModalOpen()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }

      const items = resultsContainer.querySelectorAll('.artmatter-search-item');

      if (e.key === 'ArrowDown') {
        if (!items.length) return;
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        highlightItem(items);
      } else if (e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
        highlightItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // If user actively navigated and highlighted an item with arrow keys
        if (selectedIndex >= 0 && items[selectedIndex]) {
          items[selectedIndex].click();
        } else {
          // Direct search page redirect on Enter
          const q = (input.value || activeQuery || '').trim();
          if (q) {
            const siteUrl = (settings.siteUrl || '/').replace(/\/$/, '');
            window.location.href = siteUrl + '/?s=' + encodeURIComponent(q);
          }
        }
      }
    });
  }

  function highlightItem(items) {
    items.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.classList.add('is-selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('is-selected');
      }
    });
  }

  function isModalOpen() {
    return modal && modal.classList.contains('is-open');
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Auto-focus input
    setTimeout(() => {
      input.focus();
      if (!activeQuery) {
        fetchResults('');
      }
    }, 50);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function toggleModal() {
    if (isModalOpen()) {
      closeModal();
    } else {
      openModal();
    }
  }

  function handleSearchInput(query) {
    activeQuery = query;
    clearTimeout(debounceTimer);
    selectedIndex = -1;

    // Check cache
    if (cache.has(query)) {
      currentResults = cache.get(query);
      renderResults();
      return;
    }

    // Show loading skeleton
    loadingSkeleton.style.display = 'block';
    resultsContainer.style.display = 'none';

    debounceTimer = setTimeout(() => {
      fetchResults(query);
    }, 120);
  }

  async function fetchResults(query) {
    try {
      const url = new URL(settings.apiUrl, window.location.origin);
      if (query) url.searchParams.set('q', query);
      url.searchParams.set('currency', settings.currency);

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      currentResults = data;
      cache.set(query, data);

      renderResults();
    } catch (err) {
      console.warn('[Artmatter Search Error]', err);
      renderErrorState();
    } finally {
      loadingSkeleton.style.display = 'none';
      resultsContainer.style.display = 'block';
    }
  }

  function renderResults() {
    if (!currentResults || !currentResults.results) return;

    const res = currentResults.results;
    const isInit = currentResults.is_initial;
    const counts = currentResults.counts || { artworks: 0, artists: 0, fandoms: 0, collections: 0 };

    // Update tab count badges
    updateTabCount('artworks', counts.artworks);
    updateTabCount('artists', counts.artists);
    updateTabCount('fandoms', counts.fandoms);

    let html = '';

    const showArtworks = (activeTab === 'all' || activeTab === 'artworks') && res.artworks && res.artworks.length > 0;
    const showArtists = (activeTab === 'all' || activeTab === 'artists') && res.artists && res.artists.length > 0;
    const showFandoms = (activeTab === 'all' || activeTab === 'fandoms') && res.fandoms && res.fandoms.length > 0;
    const showCollections = (activeTab === 'all' || activeTab === 'fandoms') && res.collections && res.collections.length > 0;

    if (!showArtworks && !showArtists && !showFandoms && !showCollections) {
      if (isInit) {
        html = `
          <div class="artmatter-search-empty">
            <svg class="artmatter-empty-icon" viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <p class="artmatter-empty-title">Discover Exacoat</p>
            <p class="artmatter-empty-desc">Search across precision device skins, models, and series.</p>
          </div>
        `;
      } else {
        html = `
          <div class="artmatter-search-empty">
            <svg class="artmatter-empty-icon" viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="artmatter-empty-title">No matching results</p>
            <p class="artmatter-empty-desc">No products or collections found matching "${escapeHtml(activeQuery)}".</p>
          </div>
        `;
      }
      resultsContainer.innerHTML = html;
      return;
    }

    // 1. Artists Section (Top 4 in modal)
    if (showArtists && res.artists.length > 0) {
      const displayArtists = isInit ? res.artists : res.artists.slice(0, 4);
      html += `
        <div class="artmatter-result-group">
          <div class="artmatter-group-title">
            <span>${isInit ? 'Featured Artists' : 'Artists'}</span>
            <span>${res.artists.length}</span>
          </div>
          <div class="artmatter-group-items">
            ${displayArtists.map(a => renderArtistItem(a)).join('')}
          </div>
        </div>
      `;
    }

    // 2. Fandoms Section (Top 4 in modal)
    if (showFandoms && res.fandoms.length > 0) {
      const displayFandoms = isInit ? res.fandoms : res.fandoms.slice(0, 4);
      html += `
        <div class="artmatter-result-group">
          <div class="artmatter-group-title">
            <span>${isInit ? 'Popular Fandoms' : 'Fandoms'}</span>
            <span>${res.fandoms.length}</span>
          </div>
          <div class="artmatter-group-items">
            ${displayFandoms.map(f => renderFandomItem(f)).join('')}
          </div>
        </div>
      `;
    }

    // 3. Artworks Section (Top 5 in modal)
    if (showArtworks && res.artworks.length > 0) {
      const displayArtworks = isInit ? res.artworks : res.artworks.slice(0, 5);
      html += `
        <div class="artmatter-result-group">
          <div class="artmatter-group-title">
            <span>${isInit ? 'Featured Skins' : 'Products'}</span>
            <span>${res.artworks.length}</span>
          </div>
          <div class="artmatter-group-items">
            ${displayArtworks.map(art => renderArtworkItem(art)).join('')}
          </div>
        </div>
      `;
    }

    // 4. See All Results Action Button if results exceed modal preview limit
    if (!isInit && activeQuery && (res.artworks.length > 5 || res.artists.length > 4 || res.fandoms.length > 4)) {
      const siteUrl = (settings.siteUrl || '/').replace(/\/$/, '');
      const searchUrl = siteUrl + '/?s=' + encodeURIComponent(activeQuery);
      html += `
        <div class="artmatter-search-see-all-wrap">
          <a href="${escapeHtml(searchUrl)}" class="artmatter-search-see-all-btn">
            <span>See all ${res.artworks.length} skins for "${escapeHtml(activeQuery)}"</span>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </a>
        </div>
      `;
    }

    resultsContainer.innerHTML = html;
  }

  function updateTabCount(tabId, count) {
    const el = document.getElementById('tab-count-' + tabId);
    if (!el) return;
    el.textContent = count > 0 ? count : '';
    el.style.display = count > 0 ? 'inline-block' : 'none';
  }

  function renderArtistItem(artist) {
    const avatarHtml = artist.avatar
      ? `<img src="${escapeHtml(artist.avatar)}" class="artmatter-item-avatar" alt="${escapeHtml(artist.name)}" loading="lazy" />`
      : `<div class="artmatter-item-icon-wrap"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;

    const badgeHtml = artist.badge
      ? `<span class="artmatter-item-pill">${escapeHtml(artist.badge)}</span>`
      : '';

    const highlightedName = highlightMatch(artist.name, activeQuery);
    const subtitle = artist.artwork_count > 0 ? `${artist.artwork_count} Artworks` : 'View Artist Profile';

    return `
      <a href="${escapeHtml(artist.url)}" class="artmatter-search-item">
        ${avatarHtml}
        <div class="artmatter-item-content">
          <div class="artmatter-item-title">
            <span>${highlightedName}</span>
            ${badgeHtml}
          </div>
          <div class="artmatter-item-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <div class="artmatter-item-meta">
          <svg class="artmatter-item-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </a>
    `;
  }

  function renderFandomItem(fandom) {
    const highlightedName = highlightMatch(fandom.name, activeQuery);
    const countText = fandom.count > 0 ? `${fandom.count} Artworks` : 'Fandom Gallery';
    const thumbImg = fandom.thumbnail || fandom.banner;

    const thumbHtml = thumbImg
      ? `<img src="${escapeHtml(thumbImg)}" class="artmatter-item-thumb" alt="${escapeHtml(fandom.name)}" loading="lazy" />`
      : `<div class="artmatter-item-icon-wrap"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`;

    return `
      <a href="${escapeHtml(fandom.url)}" class="artmatter-search-item">
        ${thumbHtml}
        <div class="artmatter-item-content">
          <div class="artmatter-item-title">
            <span>${highlightedName}</span>
          </div>
          <div class="artmatter-item-subtitle">${escapeHtml(countText)}</div>
        </div>
        <div class="artmatter-item-meta">
          <svg class="artmatter-item-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </a>
    `;
  }

  function renderArtworkItem(art) {
    const thumbHtml = art.thumbnail
      ? `<img src="${escapeHtml(art.thumbnail)}" class="artmatter-item-thumb" alt="${escapeHtml(art.title)}" loading="lazy" />`
      : `<div class="artmatter-item-icon-wrap"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`;

    const highlightedTitle = highlightMatch(art.title, activeQuery);
    const artistSub = art.artist ? `by ${art.artist}` : 'Device Skin';

    return `
      <a href="${escapeHtml(art.url)}" class="artmatter-search-item">
        ${thumbHtml}
        <div class="artmatter-item-content">
          <div class="artmatter-item-title">
            <span>${highlightedTitle}</span>
          </div>
          <div class="artmatter-item-subtitle">${escapeHtml(artistSub)}</div>
        </div>
        <div class="artmatter-item-meta">
          <svg class="artmatter-item-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </a>
    `;
  }

  function renderErrorState() {
    resultsContainer.innerHTML = `
      <div class="artmatter-search-empty">
        <p class="artmatter-empty-title">Search Unavailable</p>
        <p class="artmatter-empty-desc">Could not connect to the search service. Please try again.</p>
      </div>
    `;
  }

  function highlightMatch(text, query) {
    return escapeHtml(text || '');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initMuseumArtGalleries() {
    const galleries = document.querySelectorAll('.artmatter-search-results-page, .artmatter-artist-artworks-wrap:not(.artmatter-product-archive-wrap)');
    galleries.forEach(setupMuseumGallery);
  }

  function setupMuseumGallery(wrap) {
    const orientBtns = wrap.querySelectorAll('.artmatter-orient-btn');
    const chipBtns = wrap.querySelectorAll('.artmatter-dir-chip');
    const shuffleBtn = wrap.querySelector('.artmatter-dir-shuffle-btn');
    const searchWrap = wrap.querySelector('.artmatter-dir-search-wrap');
    const searchToggle = wrap.querySelector('.artmatter-dir-search-toggle');
    const searchInput = wrap.querySelector('.artmatter-dir-search-input');
    const clearBtn = wrap.querySelector('.artmatter-dir-search-clear');
    const grid = wrap.querySelector('.artmatter-museum-grid');
    const sentinel = wrap.querySelector('.artmatter-infinite-sentinel');
    const spinner = wrap.querySelector('.artmatter-infinite-spinner');
    const colToggleBtn = wrap.querySelector('.artmatter-mobile-col-toggle');
    if (!grid) return;

    // Mobile Column Switcher (1 or 2 cols on mobile)
    function setMobileCols(cols) {
      if (grid) grid.setAttribute('data-mobile-cols', cols);
      if (colToggleBtn) {
        const i2 = colToggleBtn.querySelector('.col-icon-2');
        const i1 = colToggleBtn.querySelector('.col-icon-1');
        if (i2 && i1) {
          i2.style.display = (cols === '2') ? 'none' : 'block';
          i1.style.display = (cols === '2') ? 'block' : 'none';
        }
      }
    }
    const initMobileCols = localStorage.getItem('artmatter_mobile_cols') || '1';
    setMobileCols(initMobileCols);
    if (colToggleBtn) {
      colToggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const current = (grid && grid.getAttribute('data-mobile-cols') === '2') ? '2' : '1';
        const next = current === '2' ? '1' : '2';
        setMobileCols(next);
        localStorage.setItem('artmatter_mobile_cols', next);
      });
    }

    let items = Array.from(grid.querySelectorAll('.artmatter-results-item'));
    if (!items.length) return;

    let activeOrient = 'portrait';
    const activeOrientBtn = wrap.querySelector('.artmatter-orient-btn.active');
    if (activeOrientBtn) {
      activeOrient = activeOrientBtn.getAttribute('data-orient') || 'portrait';
    } else if (orientBtns.length) {
      activeOrient = orientBtns[0].getAttribute('data-orient') || 'portrait';
    }

    let activeCol = 'all';
    let activeQuery = '';
    let pageSize = 12;
    let currentPage = 1;
    let matchingItems = [];

    function renderGalleryBatch(skipFlip = false) {
      const limit = currentPage * pageSize;
      const firstPos = new Map();
      if (!skipFlip) {
        items.forEach(it => {
          if (it.offsetParent !== null) {
            firstPos.set(it, it.getBoundingClientRect());
          }
        });
      }

      // Hide all items
      items.forEach(it => {
        it.style.display = 'none';
      });

      // Reveal matching items up to limit
      const visibleNow = matchingItems.slice(0, limit);
      visibleNow.forEach(it => {
        it.style.display = '';
        grid.appendChild(it);
      });

      if (spinner) {
        spinner.style.display = (limit < matchingItems.length) ? 'flex' : 'none';
      }

      // FLIP Animations
      if (!skipFlip) {
        visibleNow.forEach(it => {
          const first = firstPos.get(it);
          if (first) {
            const last = it.getBoundingClientRect();
            const dx = first.left - last.left;
            const dy = first.top - last.top;
            if (dx !== 0 || dy !== 0) {
              it.style.transform = `translate(${dx}px, ${dy}px)`;
              it.style.transition = 'none';
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  it.style.transition = 'transform 0.5s ease, opacity 0.35s ease';
                  it.style.transform = '';
                });
              });
            }
          } else {
            it.style.opacity = '0';
            it.style.transform = 'translateY(14px) scale(0.98)';
            it.style.transition = 'none';
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                it.style.transition = 'transform 0.5s ease, opacity 0.35s ease';
                it.style.opacity = '1';
                it.style.transform = '';
              });
            });
          }
        });
      }

      // Trigger feelform lazy initialization
      window.dispatchEvent(new CustomEvent('artmatter:items-rendered'));
    }

    if (typeof IntersectionObserver !== 'undefined' && sentinel) {
      const sentinelObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && currentPage * pageSize < matchingItems.length) {
            currentPage++;
            renderGalleryBatch(true);
          }
        });
      }, { rootMargin: '400px 0px' });
      sentinelObs.observe(sentinel);
    }

    function filterAndAnimate(skipFlip = false) {
      const matching = [];
      items.forEach(it => {
        const itemOrient = it.getAttribute('data-orient') || 'portrait';
        const itemCols = (it.getAttribute('data-cols') || 'all').split(',');
        const itemTitle = (it.getAttribute('data-title') || '').toLowerCase();
        const itemArtist = (it.getAttribute('data-artist') || '').toLowerCase();
        const itemSearch = (it.getAttribute('data-search') || '').toLowerCase();

        // When search is active, match across orientations so user doesn't miss results
        const matchOrient = (!activeQuery && activeOrient !== 'all') ? (itemOrient === activeOrient) : true;
        const matchCol = (activeCol === 'all' || itemCols.includes(activeCol));
        const matchQuery = (!activeQuery || itemTitle.includes(activeQuery) || itemArtist.includes(activeQuery) || itemSearch.includes(activeQuery));

        if (matchOrient && matchCol && matchQuery) {
          matching.push(it);
        }
      });

      matchingItems = matching;

      // Grid landscape-view class
      if (activeOrient === 'landscape' && !activeQuery) {
        grid.classList.add('landscape-view');
      } else {
        grid.classList.remove('landscape-view');
      }

      currentPage = 1;
      renderGalleryBatch(skipFlip);
    }

    // Orientation toggle
    orientBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        orientBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeOrient = btn.getAttribute('data-orient') || 'portrait';
        filterAndAnimate();
      });
    });

    // Collection chip filter (fallback if pills rendered)
    chipBtns.forEach(chip => {
      chip.addEventListener('click', function () {
        chipBtns.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCol = chip.getAttribute('data-col') || 'all';
        filterAndAnimate();
      });
    });

    // Collections Dropdown & Logic
    const colWrap = wrap.querySelector('.artmatter-dir-col-wrap');
    const colBtn = wrap.querySelector('.artmatter-dir-col-btn');
    const colLabel = wrap.querySelector('.artmatter-col-current-label');
    const colBadge = wrap.querySelector('.artmatter-col-current-badge');
    const colOptions = wrap.querySelectorAll('.artmatter-col-option');

    if (colBtn && colWrap) {
      colBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (sortWrap) sortWrap.classList.remove('open');
        colWrap.classList.toggle('open');
      });

      document.addEventListener('click', function (e) {
        if (!colWrap.contains(e.target)) {
          colWrap.classList.remove('open');
        }
      });

      colOptions.forEach(opt => {
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          colOptions.forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          activeCol = opt.getAttribute('data-col') || 'all';
          if (colLabel && nameEl) colLabel.textContent = nameEl.textContent.trim();
          if (colBadge && badgeEl) colBadge.textContent = badgeEl.textContent.trim();
          if (activeCol !== 'all') {
            colBtn.classList.add('active');
            if (nameEl) colBtn.setAttribute('title', nameEl.textContent.trim());
          } else {
            colBtn.classList.remove('active');
            colBtn.setAttribute('title', 'Filter by collection');
          }
          colWrap.classList.remove('open');
          filterAndAnimate();
        });
      });
    }

    // Sort Dropdown & Logic
    const sortWrap = wrap.querySelector('.artmatter-dir-sort-wrap');
    const sortBtn = wrap.querySelector('.artmatter-dir-sort-btn');
    const sortLabel = wrap.querySelector('.artmatter-sort-current-label');
    const sortOptions = wrap.querySelectorAll('.artmatter-sort-option');

    if (sortBtn && sortWrap) {
      sortBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (colWrap) colWrap.classList.remove('open');
        sortWrap.classList.toggle('open');
      });

      document.addEventListener('click', function (e) {
        if (!sortWrap.contains(e.target)) {
          sortWrap.classList.remove('open');
        }
      });

      sortOptions.forEach(opt => {
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          sortOptions.forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          const sortMode = opt.getAttribute('data-sort') || 'sales';
          if (sortLabel) sortLabel.textContent = opt.textContent.trim();
          sortWrap.classList.remove('open');
          applySorting(sortMode);
        });
      });
    }

    function applySorting(sortMode) {
      switch (sortMode) {
        case 'recommended':
        case 'for-you':
          items.sort((a, b) => {
            const pinA = a.getAttribute('data-pinned') === 'true' ? 1 : 0;
            const pinB = b.getAttribute('data-pinned') === 'true' ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;

            if (window.ArtmatterTaste && typeof window.ArtmatterTaste.calculateScore === 'function' && window.ArtmatterTaste.hasTasteData()) {
              const scoreA = window.ArtmatterTaste.calculateScore(a);
              const scoreB = window.ArtmatterTaste.calculateScore(b);
              if (scoreB !== scoreA) return scoreB - scoreA;
            }

            const salesA = parseInt(a.getAttribute('data-sales'), 10) || 0;
            const salesB = parseInt(b.getAttribute('data-sales'), 10) || 0;
            if (salesB !== salesA) return salesB - salesA;
            const idA = parseInt(a.getAttribute('data-id'), 10) || 0;
            const idB = parseInt(b.getAttribute('data-id'), 10) || 0;
            return idB - idA;
          });
          break;

        case 'popular':
        case 'sales':
          items.sort((a, b) => {
            const pinA = a.getAttribute('data-pinned') === 'true' ? 1 : 0;
            const pinB = b.getAttribute('data-pinned') === 'true' ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;

            const salesA = parseInt(a.getAttribute('data-sales'), 10) || 0;
            const salesB = parseInt(b.getAttribute('data-sales'), 10) || 0;
            if (salesB !== salesA) return salesB - salesA;
            const idA = parseInt(a.getAttribute('data-id'), 10) || 0;
            const idB = parseInt(b.getAttribute('data-id'), 10) || 0;
            return idB - idA;
          });
          break;

        case 'new':
        case 'latest':
          items.sort((a, b) => {
            const pinA = a.getAttribute('data-pinned') === 'true' ? 1 : 0;
            const pinB = b.getAttribute('data-pinned') === 'true' ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;

            const idA = parseInt(a.getAttribute('data-id'), 10) || 0;
            const idB = parseInt(b.getAttribute('data-id'), 10) || 0;
            return idB - idA;
          });
          break;

        case 'name_asc':
        case 'title':
          items.sort((a, b) => {
            const pinA = a.getAttribute('data-pinned') === 'true' ? 1 : 0;
            const pinB = b.getAttribute('data-pinned') === 'true' ? 1 : 0;
            if (pinB !== pinA) return pinB - pinA;

            const titleA = a.getAttribute('data-title') || '';
            const titleB = b.getAttribute('data-title') || '';
            return titleA.localeCompare(titleB);
          });
          break;

        case 'shuffle':
          const pinned = items.filter(it => it.getAttribute('data-pinned') === 'true');
          const unpinned = items.filter(it => it.getAttribute('data-pinned') !== 'true');
          for (let i = unpinned.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unpinned[i], unpinned[j]] = [unpinned[j], unpinned[i]];
          }
          items = [...pinned, ...unpinned];
          break;
      }

      filterAndAnimate(false);
    }

    // Direct Shuffle button (fallback if present)
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', function () {
        applySorting('shuffle');
      });
    }

    // Expandable Search
    if (searchToggle && searchWrap && searchInput) {
      searchToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = searchWrap.classList.toggle('open');
        if (isOpen) {
          searchInput.focus();
        } else if (activeQuery) {
          searchInput.value = '';
          activeQuery = '';
          if (clearBtn) clearBtn.style.display = 'none';
          filterAndAnimate();
        }
      });

      searchInput.addEventListener('input', function () {
        activeQuery = searchInput.value.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.style.display = activeQuery.length > 0 ? 'inline-flex' : 'none';
        }
        filterAndAnimate();
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          searchInput.value = '';
          activeQuery = '';
          clearBtn.style.display = 'none';
          searchInput.focus();
          filterAndAnimate();
        });
      }

      document.addEventListener('click', function (e) {
        if (!searchWrap.contains(e.target) && !activeQuery) {
          searchWrap.classList.remove('open');
        }
      });
    }

    // Horizontal Chip Drag & Swipe
    const chipsRow = wrap.querySelector('.artmatter-dir-chips-row') || wrap.querySelector('.artmatter-dir-chips-track');
    if (chipsRow) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      chipsRow.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - chipsRow.offsetLeft;
        scrollLeft = chipsRow.scrollLeft;
      });
      chipsRow.addEventListener('mouseleave', () => { isDown = false; });
      chipsRow.addEventListener('mouseup', () => { isDown = false; });
      chipsRow.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - chipsRow.offsetLeft;
        const walk = (x - startX) * 1.5;
        chipsRow.scrollLeft = scrollLeft - walk;
      });
    }
  }

  function initMuseumImages() {
    document.querySelectorAll('.artmatter-museum-art-img, .artmatter-poster-img').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        var wrap = img.closest('.artmatter-museum-art-wrap');
        if (wrap) wrap.classList.add('is-loaded');
      } else {
        img.addEventListener('load', function () {
          var wrap = img.closest('.artmatter-museum-art-wrap');
          if (wrap) wrap.classList.add('is-loaded');
        });
      }
    });
  }

  // Initialize on DOMContentLoaded or immediately
  function start() {
    init();
    initMuseumArtGalleries();
    initMuseumImages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
