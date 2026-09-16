/**
 * Artmatter 3D Circular Arc Exhibition Slider Engine
 * 1:1.4 aspect ratio, big desktop exhibition proportions,
 * continuous circular merry-go-round arc with smooth angle blending & depth zoom-out,
 * spatial bounding hit-testing (100% full unblocked click area on next/prev/center),
 * invariant step geometry, and true toroidal physics.
 */

(function () {
    'use strict';

    function initSlider(wrap) {
        if (!wrap || wrap.dataset.artmatterSlideInitialized) return;
        wrap.dataset.artmatterSlideInitialized = 'true';

        const viewport = wrap.querySelector('.artmatter-slide-viewport');
        const track = wrap.querySelector('.artmatter-slide-track');
        let allCards = Array.from(wrap.querySelectorAll('.artmatter-slide-card'));
        const prevBtn = wrap.querySelector('.artmatter-slide-nav-btn.prev');
        const nextBtn = wrap.querySelector('.artmatter-slide-nav-btn.next');
        const orientBtns = wrap.querySelectorAll('.artmatter-orient-btn');
        const shuffleBtn = wrap.querySelector('.artmatter-slide-shuffle-btn');

        if (allCards.length === 0 || !track) return;

        let currentOrient = 'portrait';
        let visibleCards = [];
        let virtualScroll = 0;
        let targetScroll = 0;
        let cachedStep = 0;
        let isDragging = false;
        let isSettled = true;
        let startX = 0;
        let startScroll = 0;
        let lastMoveX = 0;
        let lastMoveTime = 0;
        let velocity = 0;
        let animFrame = null;
        let isMoved = false;

        const isMobile = () => window.innerWidth <= 768;
        const isLandscape = () => currentOrient === 'landscape';

        // Compute invariant layout step width (unaffected by 3D rotate/scale transforms)
        function recalculateStep() {
            const firstCard = visibleCards.find(c => !c.classList.contains('is-filtered-out')) || allCards[0];
            if (firstCard) {
                const cardWidth = firstCard.offsetWidth;
                if (cardWidth && cardWidth > 50) {
                    const gap = isMobile() ? (isLandscape() ? 24 : 18) : (isLandscape() ? 56 : 48);
                    cachedStep = cardWidth + gap;
                    return cachedStep;
                }
            }
            cachedStep = isMobile() ? (isLandscape() ? 300 : 220) : (isLandscape() ? 520 : 380);
            return cachedStep;
        }

        const getStep = () => cachedStep || recalculateStep();

        // Render Cards along the Circular Merry-Go-Round Arc
        function updateLayout() {
            const count = visibleCards.length;
            if (count === 0) return;

            const step = getStep();

            visibleCards.forEach((card, idx) => {
                // Compute toroidal offset from current virtual scroll
                let normScroll = virtualScroll % count;
                if (normScroll < 0) normScroll += count;

                let offset = idx - normScroll;
                while (offset > count / 2) offset -= count;
                while (offset < -count / 2) offset += count;

                const absOffset = Math.abs(offset);

                // Cull far offscreen cards
                if (absOffset > 4.5) {
                    card.style.display = 'none';
                    return;
                }

                card.style.display = 'flex';

                // Dynamic lazy image load for nearby cards
                if (absOffset <= 3.5) {
                    const img = card.querySelector('.artmatter-slide-img');
                    if (img && img.dataset.src) {
                        img.src = img.dataset.src;
                        delete img.dataset.src;
                    }
                }

                const isActive = absOffset < 0.5;
                const sign = Math.sign(offset);

                // Continuous Circular Merry-Go-Round Geometry:
                // Smooth unbroken angle progression (0deg at dead center, curving along the arc)
                const arcAngle = -sign * Math.min(36, Math.pow(absOffset, 0.88) * 22);

                // Cylinder depth recession (far items naturally recess into background)
                const zDepth = 40 - (Math.pow(absOffset, 1.22) * 80);

                // Symmetrical zoom-out scale
                const scale = Math.max(0.66, 1.04 - Math.pow(absOffset, 0.9) * 0.11);

                // Graduated luxury illumination
                const brightness = absOffset < 0.5 
                    ? Math.round(72 + 28 * (1 - absOffset * 2)) 
                    : Math.max(22, Math.round(52 - (absOffset - 0.5) * 14));

                const zIndex = Math.round(300 - absOffset * 25);
                const x = offset * step * Math.max(0.84, 1 - absOffset * 0.035);

                card.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, ${zDepth}px) perspective(1600px) rotateY(${arcAngle}deg) scale(${scale})`;
                card.style.filter = `brightness(${brightness}%)`;
                card.style.zIndex = `${zIndex}`;

                if (isActive && isSettled) {
                    card.classList.add('is-active', 'is-settled');
                } else if (isActive) {
                    card.classList.add('is-active');
                    card.classList.remove('is-settled');
                } else {
                    card.classList.remove('is-active', 'is-settled');
                }
            });
        }

        // Filter cards by orientation (Portrait / Landscape)
        function filterOrientation(orient) {
            currentOrient = orient;

            orientBtns.forEach((btn) => {
                if (btn.dataset.orient === orient) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            allCards.forEach((card) => {
                let cardOrient = card.getAttribute('data-orient') || 'portrait';
                const img = card.querySelector('.artmatter-slide-img');
                if (img && img.naturalWidth && img.naturalHeight) {
                    if (img.naturalWidth > img.naturalHeight) {
                        cardOrient = 'landscape';
                        card.setAttribute('data-orient', 'landscape');
                        card.classList.add('is-landscape');
                        card.classList.remove('is-portrait');
                    }
                }

                if (orient === 'all' || cardOrient === orient) {
                    card.classList.remove('is-filtered-out');
                } else {
                    card.classList.add('is-filtered-out');
                }
            });

            visibleCards = allCards.filter((c) => !c.classList.contains('is-filtered-out'));

            if (visibleCards.length === 0) {
                // If filter returned 0, show all items
                allCards.forEach((c) => c.classList.remove('is-filtered-out'));
                visibleCards = allCards;
            }

            virtualScroll = 0;
            targetScroll = 0;
            isSettled = true;
            
            // Recompute invariant step and render layout
            requestAnimationFrame(() => {
                recalculateStep();
                updateLayout();
            });
        }

        // Shuffle Products
        function shuffleProducts() {
            for (let i = visibleCards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [visibleCards[i], visibleCards[j]] = [visibleCards[j], visibleCards[i]];
            }

            visibleCards.forEach((card) => track.appendChild(card));
            allCards = Array.from(wrap.querySelectorAll('.artmatter-slide-card'));

            virtualScroll = 0;
            targetScroll = 0;
            isSettled = true;
            updateLayout();
        }
        const shuffleArtworks = shuffleProducts;

        // Smooth Animation Loop
        function animate() {
            const diff = targetScroll - virtualScroll;
            if (Math.abs(diff) < 0.002) {
                virtualScroll = targetScroll;
                isSettled = true;
                updateLayout();
                cancelAnimationFrame(animFrame);
                animFrame = null;
                return;
            }

            isSettled = false;
            // Luxury smooth 0.08 lerp
            virtualScroll += diff * 0.08;
            updateLayout();
            animFrame = requestAnimationFrame(animate);
        }

        function scrollToPosition(pos) {
            targetScroll = pos;
            isSettled = false;
            if (!animFrame) {
                animFrame = requestAnimationFrame(animate);
            }
        }

        function next() {
            scrollToPosition(Math.round(targetScroll) + 1);
        }

        function prev() {
            scrollToPosition(Math.round(targetScroll) - 1);
        }

        // Orientation Selector Clicks
        orientBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const orient = btn.dataset.orient;
                if (orient) {
                    filterOrientation(orient);
                }
            });
        });

        // Shuffle Button Click
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                shuffleProducts();
            });
        }

        // Navigation Arrows
        if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); prev(); });
        if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); next(); });

        // 100% Unblocked Spatial Click Detection on Viewport
        viewport.addEventListener('click', (e) => {
            if (isMoved) return;
            if (e.target.closest('.artmatter-slide-nav-btn, .artmatter-orient-pills, .artmatter-slide-shuffle-btn')) return;

            const clickX = e.clientX;
            const clickY = e.clientY;

            // Find closest visible card by physical on-screen bounding rect center
            let targetCard = null;
            let minDistance = Infinity;

            visibleCards.forEach((card) => {
                if (card.classList.contains('is-filtered-out') || card.style.display === 'none') return;
                const rect = card.getBoundingClientRect();
                if (clickX >= rect.left && clickX <= rect.right && clickY >= rect.top && clickY <= rect.bottom) {
                    const cardCenterX = rect.left + rect.width / 2;
                    const dist = Math.abs(clickX - cardCenterX);
                    if (dist < minDistance) {
                        minDistance = dist;
                        targetCard = card;
                    }
                }
            });

            if (!targetCard) {
                targetCard = e.target.closest('.artmatter-slide-card');
            }

            if (!targetCard) return;

            const idx = visibleCards.indexOf(targetCard);
            if (idx === -1) return;

            const count = visibleCards.length;
            let normScroll = virtualScroll % count;
            if (normScroll < 0) normScroll += count;

            let offset = idx - normScroll;
            while (offset > count / 2) offset -= count;
            while (offset < -count / 2) offset += count;

            if (Math.abs(offset) >= 0.4) {
                e.preventDefault();
                scrollToPosition(Math.round(virtualScroll + offset));
            } else {
                const url = targetCard.getAttribute('data-url');
                if (url && url !== '#') {
                    window.location.href = url;
                }
            }
        });

        // 1:1 Direct Tracking Pointer Dragging
        viewport.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.artmatter-slide-nav-btn, .artmatter-orient-pills, .artmatter-slide-shuffle-btn')) return;
            isDragging = true;
            isMoved = false;
            startX = e.clientX;
            lastMoveX = e.clientX;
            startScroll = virtualScroll;
            velocity = 0;
            lastMoveTime = performance.now();
            viewport.classList.add('is-dragging');

            if (animFrame) {
                cancelAnimationFrame(animFrame);
                animFrame = null;
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 4) {
                isMoved = true;
                isSettled = false;
            }

            const now = performance.now();
            const dt = now - lastMoveTime || 16;
            const moveDx = e.clientX - lastMoveX;
            velocity = moveDx / dt;
            lastMoveX = e.clientX;
            lastMoveTime = now;

            const step = getStep();
            virtualScroll = startScroll - (dx / step);
            updateLayout();
        });

        function handlePointerEnd() {
            if (!isDragging) return;
            isDragging = false;
            viewport.classList.remove('is-dragging');

            const projected = virtualScroll - (velocity * 2.5);
            targetScroll = Math.round(projected);
            animate();

            setTimeout(() => { isMoved = false; }, 50);
        }

        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);

        // Horizontal Wheel / Trackpad
        let wheelTimeout = null;
        viewport.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                if (e.deltaX > 20) {
                    clearTimeout(wheelTimeout);
                    wheelTimeout = setTimeout(next, 30);
                } else if (e.deltaX < -20) {
                    clearTimeout(wheelTimeout);
                    wheelTimeout = setTimeout(prev, 30);
                }
            }
        }, { passive: false });

        // Keyboard Navigation
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        });

        // Window Resize
        window.addEventListener('resize', () => {
            recalculateStep();
            updateLayout();
        });

        // Listen for image loads to re-validate orientation if needed
        allCards.forEach((card) => {
            const img = card.querySelector('.artmatter-slide-img');
            if (img) {
                img.addEventListener('load', () => {
                    if (img.naturalWidth && img.naturalHeight && img.naturalWidth > img.naturalHeight) {
                        card.setAttribute('data-orient', 'landscape');
                        card.classList.add('is-landscape');
                        card.classList.remove('is-portrait');
                    }
                });
            }
        });

        // Initialize First Frame (Defaults to Portrait)
        const initialBtn = wrap.querySelector('.artmatter-orient-btn.active');
        const initOrient = initialBtn ? initialBtn.dataset.orient : 'portrait';
        filterOrientation(initOrient || 'portrait');
    }

    // Auto-init on DOM Ready
    function initAllSliders() {
        document.querySelectorAll('.artmatter-shop-slide-wrap').forEach(initSlider);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllSliders);
    } else {
        initAllSliders();
    }

    window.artmatterInitShopSlide = initAllSliders;

})();
