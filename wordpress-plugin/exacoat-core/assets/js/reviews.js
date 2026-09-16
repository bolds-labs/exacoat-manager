/**
 * Artmatter Luxury Review & Collector Feedback Engine
 * Handles Lightbox modal, Video player, Client-side image downscaling, and AJAX review submission.
 */
(function ($) {
  'use strict';

  var piecesData = [];
  var currentPieceIndex = 0;
  var pieceDrafts = {}; // Keyed by product_id
  var selectedMediaFiles = []; // Array of { file: Blob/File, name: string, isVideo: boolean, isHeic: boolean, previewUrl: string, size: number }
  var MAX_MEDIA_FILES = 5;

  var ratingDescriptions = {
    '1': '1.0 • Needs Improvement',
    '1.5': '1.5 • Needs Improvement',
    '2': '2.0 • Fair',
    '2.5': '2.5 • Fair',
    '3': '3.0 • Good',
    '3.5': '3.5 • Good',
    '4': '4.0 • Very Good',
    '4.5': '4.5 • Exceptional',
    '5': '5.0 • Exceptional'
  };

  $(document).ready(function () {
    initLightboxModal();
    initStarSelector();
    initArtworkCarousel();
    initMediaUploader();
    initReviewForm();
    initReviewSliders();
  });

  /**
   * Museum Lightbox & Video Player Modal (Supports Multi-Media Carousel)
   */
  function initLightboxModal() {
    var $modal   = $('#artmatter-review-lightbox-modal');
    var $body    = $modal.find('.artmatter-review-modal-body');
    var $btnPrev = $('#artmatter-lightbox-prev');
    var $btnNext = $('#artmatter-lightbox-next');
    var $counter = $('#artmatter-lightbox-counter');

    var currentMediaList  = [];
    var currentMediaIndex = 0;

    function renderCurrentLightboxItem() {
      if (!currentMediaList.length) return;
      var item = currentMediaList[currentMediaIndex];
      $body.empty();

      if (item.type === 'video') {
        var $video = $('<video controls autoplay playsinline></video>')
          .attr('src', item.url)
          .attr('poster', item.poster_url || '');
        $body.append($video);
      } else {
        var $img = $('<img>').attr('src', item.url).attr('alt', 'Customer Skin Photo');
        $body.append($img);
      }

      if (currentMediaList.length > 1) {
        $btnPrev.show();
        $btnNext.show();
        $counter.text((currentMediaIndex + 1) + ' / ' + currentMediaList.length).show();
      } else {
        $btnPrev.hide();
        $btnNext.hide();
        $counter.hide();
      }
    }

    // Click on review media thumbnail
    $(document).on('click', '.artmatter-review-media-wrap', function (e) {
      e.preventDefault();
      var rawAll = $(this).attr('data-all-media');
      currentMediaList  = [];
      currentMediaIndex = 0;

      if (rawAll) {
        try {
          var parsed = JSON.parse(rawAll);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentMediaList = parsed;
          }
        } catch (err) {}
      }

      if (!currentMediaList.length) {
        var singleUrl  = $(this).attr('data-media-url');
        var singleType = $(this).attr('data-media-type') || 'photo';
        var singlePost = $(this).attr('data-poster');
        if (singleUrl) {
          currentMediaList = [{ url: singleUrl, type: singleType, poster_url: singlePost }];
        }
      }

      if (!currentMediaList.length) return;

      renderCurrentLightboxItem();
      $modal.fadeIn(250);
      $('body').css('overflow', 'hidden');
    });

    // Arrow navigation
    $btnPrev.on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (currentMediaList.length <= 1) return;
      currentMediaIndex = (currentMediaIndex - 1 + currentMediaList.length) % currentMediaList.length;
      renderCurrentLightboxItem();
    });

    $btnNext.on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (currentMediaList.length <= 1) return;
      currentMediaIndex = (currentMediaIndex + 1) % currentMediaList.length;
      renderCurrentLightboxItem();
    });

    // Keyboard navigation
    $(document).on('keydown', function (e) {
      if (!$modal.is(':visible')) return;
      if (e.key === 'ArrowLeft' && currentMediaList.length > 1) {
        currentMediaIndex = (currentMediaIndex - 1 + currentMediaList.length) % currentMediaList.length;
        renderCurrentLightboxItem();
      } else if (e.key === 'ArrowRight' && currentMediaList.length > 1) {
        currentMediaIndex = (currentMediaIndex + 1) % currentMediaList.length;
        renderCurrentLightboxItem();
      }
    });

    // Close modal
    function closeModal() {
      $modal.fadeOut(200, function () {
        var $vid = $body.find('video');
        if ($vid.length) {
          $vid[0].pause();
        }
        $body.empty();
        currentMediaList  = [];
        currentMediaIndex = 0;
      });
      $('body').css('overflow', '');
    }

    $modal.on('click', '.artmatter-review-modal-close, .artmatter-review-modal-backdrop', function () {
      closeModal();
    });

    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && $modal.is(':visible')) {
        closeModal();
      }
    });
  }

  /**
   * Calculate Star Value From Mouse / Touch Position (Half-Star Support)
   */
  function getRatingFromEvent(e, $btn) {
    var baseVal = parseFloat($btn.attr('data-val')) || 5.0;
    var width   = $btn.outerWidth();
    var offset  = e.offsetX;

    if (offset === undefined && e.originalEvent) {
      var touch = (e.originalEvent.touches && e.originalEvent.touches[0]) || (e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]);
      if (touch) {
        var rect = $btn[0].getBoundingClientRect();
        offset = touch.clientX - rect.left;
      }
    }

    // Left half of star button is X.5 (minimum 1.0)
    if (offset !== undefined && width > 0 && offset < width * 0.48) {
      return Math.max(1.0, baseVal - 0.5);
    }
    return baseVal;
  }

  /**
   * Render Star Rating State & Dynamic Feedback
   */
  function renderStarState(val) {
    var num          = parseFloat(val) || 5.0;
    var $starInput   = $('#artmatter-star-input');
    var $ratingLabel = $('#artmatter-rating-label');

    $starInput.find('.artmatter-star-btn, .artmatter-star-btn-large').each(function () {
      var starVal  = parseFloat($(this).attr('data-val'));
      var $svg     = $(this).find('svg');
      var $polygon = $svg.find('polygon');

      if (starVal <= Math.floor(num)) {
        $polygon.attr('fill', 'url(#artmatter-star-gold)')
                .attr('stroke', 'url(#artmatter-star-gold-stroke)')
                .attr('stroke-width', '0.8');
        $(this).addClass('is-active').removeClass('is-half');
      } else if (starVal === Math.ceil(num) && (num % 1 !== 0)) {
        $polygon.attr('fill', 'url(#artmatter-star-gold-half)')
                .attr('stroke', 'url(#artmatter-star-gold-stroke)')
                .attr('stroke-width', '0.8');
        $(this).addClass('is-active is-half');
      } else {
        $polygon.attr('fill', 'rgba(255, 255, 255, 0.05)')
                .attr('stroke', '#3f3f46')
                .attr('stroke-width', '1.2');
        $(this).removeClass('is-active is-half');
      }
    });

    if ($ratingLabel.length) {
      var key = (num % 1 === 0) ? num.toFixed(0) : num.toFixed(1);
      $ratingLabel.text(ratingDescriptions[key] || ratingDescriptions[num] || (num.toFixed(1) + ' • Exceptional'));
    }
  }

  /**
   * Star Selector Interaction with Dynamic Feedback
   */
  function initStarSelector() {
    var $starInput = $('#artmatter-star-input');
    var $ratingVal = $('#artmatter-rating-val');

    if (!$starInput.length) return;

    $starInput.on('mousemove', '.artmatter-star-btn, .artmatter-star-btn-large', function (e) {
      var hoverVal = getRatingFromEvent(e, $(this));
      renderStarState(hoverVal);
    });

    $starInput.on('mouseenter', '.artmatter-star-btn, .artmatter-star-btn-large', function (e) {
      var hoverVal = getRatingFromEvent(e, $(this));
      renderStarState(hoverVal);
    });

    $starInput.on('mouseleave', function () {
      var current = parseFloat($ratingVal.val()) || 5.0;
      renderStarState(current);
    });

    $starInput.on('click', '.artmatter-star-btn, .artmatter-star-btn-large', function (e) {
      e.preventDefault();
      var selected = getRatingFromEvent(e, $(this));
      $ratingVal.val(selected);
      renderStarState(selected);
    });
  }

  /**
   * Artwork Carousel Engine for Multi-Item Acquisitions
   */
  function initArtworkCarousel() {
    var $dataScript = $('#artmatter-order-pieces-data');
    if (!$dataScript.length) return;

    try {
      piecesData = JSON.parse($dataScript.text()) || [];
    } catch (e) {
      piecesData = [];
    }

    if (!piecesData.length) return;

    // Default to first unreviewed piece or piece 0
    currentPieceIndex = 0;
    for (var i = 0; i < piecesData.length; i++) {
      if (!piecesData[i].is_reviewed) {
        currentPieceIndex = i;
        break;
      }
    }

    renderActivePiece(currentPieceIndex);

    // Initial image load state
    var $initImg = $('#artmatter-active-art-img');
    if ($initImg.is('img')) {
      if ($initImg[0].complete && $initImg[0].naturalWidth > 0) {
        $initImg.closest('.artmatter-artwork-frame').addClass('is-loaded');
      } else {
        $initImg.on('load', function () {
          $(this).closest('.artmatter-artwork-frame').addClass('is-loaded');
        });
      }
    }

    // Carousel arrows
    $('#artmatter-carousel-prev').on('click', function (e) {
      e.preventDefault();
      if (currentPieceIndex > 0) {
        switchPiece(currentPieceIndex - 1);
      }
    });

    $('#artmatter-carousel-next').on('click', function (e) {
      e.preventDefault();
      if (currentPieceIndex < piecesData.length - 1) {
        switchPiece(currentPieceIndex + 1);
      }
    });

    // Pill clicks
    $(document).on('click', '.artmatter-carousel-pill', function (e) {
      e.preventDefault();
      var idx = parseInt($(this).attr('data-idx'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < piecesData.length) {
        switchPiece(idx);
      }
    });

    // Next piece button in feedback
    $(document).on('click', '#artmatter-btn-next-piece', function (e) {
      e.preventDefault();
      var nextIdx = -1;
      for (var j = 0; j < piecesData.length; j++) {
        if (!piecesData[j].is_reviewed) {
          nextIdx = j;
          break;
        }
      }
      if (nextIdx !== -1) {
        switchPiece(nextIdx);
        var $stage = $('#artmatter-artwork-showcase');
        if ($stage.length) {
          $('html, body').animate({ scrollTop: $stage.offset().top - 40 }, 350);
        }
      }
    });
  }

  function saveCurrentDraft() {
    if (!piecesData[currentPieceIndex]) return;
    var pid = piecesData[currentPieceIndex].product_id;
    pieceDrafts[pid] = {
      rating: parseFloat($('#artmatter-rating-val').val()) || 5.0,
      content: $('#review_content').val() || '',
      selectedMediaFiles: selectedMediaFiles.slice()
    };
  }

  function switchPiece(newIndex) {
    if (newIndex === currentPieceIndex) return;
    saveCurrentDraft();
    currentPieceIndex = newIndex;
    renderActivePiece(newIndex);
  }

  function renderActivePiece(idx) {
    var p = piecesData[idx];
    if (!p) return;

    // Update form hidden fields
    $('#artmatter-form-product-id').val(p.product_id || 0);
    $('#artmatter-form-artwork-title').val(p.title || '');
    $('#artmatter-form-artist-name').val(p.artist || '');
    $('#artmatter-form-artwork-image').val(p.image || '');

    // Update showcase details
    $('#artmatter-active-art-title').text(p.title || '');
    $('#artmatter-active-art-artist').text(p.artist || '');
    $('#artmatter-active-art-size').text(p.size || '');

    // Update uncropped artwork image
    var $mainImg = $('#artmatter-active-art-img');
    var $frame   = $mainImg.closest('.artmatter-artwork-frame');
    if (p.image) {
      if ($mainImg.is('img')) {
        $frame.removeClass('is-loaded');
        $mainImg.css('opacity', '0.2');
        var preload = new Image();
        preload.onload = function () {
          $mainImg.attr('src', p.image).attr('alt', p.title || '').css('opacity', '1');
          $frame.addClass('is-loaded');
        };
        preload.onerror = function () {
          $mainImg.attr('src', p.image).attr('alt', p.title || '').css('opacity', '1');
          $frame.addClass('is-loaded');
        };
        preload.src = p.image;
      } else {
        $frame.removeClass('is-loaded');
        $mainImg.replaceWith('<img src="' + p.image + '" alt="' + (p.title || '') + '" class="artmatter-artwork-main-img" id="artmatter-active-art-img" onload="jQuery(this).closest(\'.artmatter-artwork-frame\').addClass(\'is-loaded\')" />');
      }
    }

    // Update carousel pills
    var $pills = $('#artmatter-carousel-pills .artmatter-carousel-pill');
    $pills.removeClass('is-active');
    $pills.filter('[data-idx="' + idx + '"]').addClass('is-active');

    var activePill = $pills.filter('[data-idx="' + idx + '"]')[0];
    if (activePill && activePill.scrollIntoView) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Update counter
    $('#artmatter-carousel-curr').text(idx + 1);

    // Update arrows
    $('#artmatter-carousel-prev').prop('disabled', idx === 0);
    $('#artmatter-carousel-next').prop('disabled', idx === piecesData.length - 1);

    // Reviewed status badge & button states
    var $reviewedPill = $('#artmatter-active-reviewed-pill');
    var $submitBtn    = $('#artmatter-submit-review-btn');
    var $feedback     = $('#artmatter-review-feedback');

    if (p.is_reviewed) {
      $reviewedPill.show();
      $submitBtn.prop('disabled', true).find('span').text('Review Submitted');
      $feedback.removeClass('is-error').addClass('is-success').html('<div class="artmatter-feedback-msg">A review has already been recorded for this item.</div>').show();
    } else {
      $reviewedPill.hide();
      $submitBtn.prop('disabled', false).find('span').text('Submit Review');
      $feedback.hide().empty();

      // Restore draft if exists
      var draft = pieceDrafts[p.product_id];
      if (draft) {
        $('#artmatter-rating-val').val(draft.rating || 5);
        renderStarState(draft.rating || 5);
        $('#review_content').val(draft.content || '');
        selectedMediaFiles = (draft.selectedMediaFiles || []).slice();
        renderMediaPreview();
      } else {
        // Reset form for fresh piece
        $('#artmatter-rating-val').val(5);
        renderStarState(5);
        $('#review_content').val('');
        $('#review_media').val('');
        selectedMediaFiles = [];
        $('#artmatter-media-preview').empty().hide();
      }
    }
  }

  /**
   * Media File Upload & Client-Side Downscaling
  /**
   * Media File Upload & Client-Side Downscaling (Multiple Files, Max 5)
   */
  function renderMediaPreview() {
    var $preview = $('#artmatter-media-preview');
    $preview.empty();

    if (!selectedMediaFiles.length) {
      $preview.hide();
      return;
    }

    $preview.show();
    var $grid = $('<div class="artmatter-media-preview-grid"></div>');

    selectedMediaFiles.forEach(function (item, idx) {
      var $item = $('<div class="artmatter-media-preview-item" data-idx="' + idx + '"></div>');

      if (item.isVideo) {
        var $vid = $('<video muted loop autoplay playsinline></video>').attr('src', item.previewUrl);
        $item.append($vid);
        $item.append('<span class="artmatter-media-preview-badge">Video</span>');
      } else if (item.isHeic) {
        var $heicThumb = $('<div class="artmatter-media-heic-thumb"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="1.8"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>HEIC</span></div>');
        $item.append($heicThumb);
      } else {
        var $img = $('<img>').attr('src', item.previewUrl).attr('alt', 'Upload ' + (idx + 1));
        $item.append($img);
      }

      var $removeBtn = $('<button type="button" class="artmatter-media-preview-remove" data-idx="' + idx + '" aria-label="Remove file">&times;</button>');
      $item.append($removeBtn);
      $grid.append($item);
    });

    $preview.append($grid);

    var countText = selectedMediaFiles.length + ' / ' + MAX_MEDIA_FILES + ' media attached';
    if (selectedMediaFiles.length < MAX_MEDIA_FILES) {
      countText += ' &bull; <span class="artmatter-media-add-more">Click dropzone to add more</span>';
    } else {
      countText += ' &bull; <span class="artmatter-media-max-reached">Maximum reached</span>';
    }
    $preview.append('<div class="artmatter-media-count-indicator">' + countText + '</div>');
  }

  function initMediaUploader() {
    var $input   = $('#review_media');
    var $preview = $('#artmatter-media-preview');

    if (!$input.length) return;

    // Remove file handler
    $(document).on('click', '.artmatter-media-preview-remove', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var removeIdx = parseInt($(this).attr('data-idx'), 10);
      if (!isNaN(removeIdx) && removeIdx >= 0 && removeIdx < selectedMediaFiles.length) {
        selectedMediaFiles.splice(removeIdx, 1);
        renderMediaPreview();
        $input.val('');
      }
    });

    $input.on('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      if (!files.length) return;

      var availableSlots = MAX_MEDIA_FILES - selectedMediaFiles.length;
      if (availableSlots <= 0) {
        alert('Maximum ' + MAX_MEDIA_FILES + ' photos or videos allowed per review.');
        $input.val('');
        return;
      }

      if (files.length > availableSlots) {
        alert('You can only attach ' + availableSlots + ' more file(s). Processing the first ' + availableSlots + '.');
        files = files.slice(0, availableSlots);
      }

      var processedCount = 0;
      var totalToProcess = files.length;

      function checkAllProcessed() {
        processedCount++;
        if (processedCount >= totalToProcess) {
          renderMediaPreview();
          $input.val('');
        }
      }

      files.forEach(function (file, fileIdx) {
        // Enforce 100MB limit
        if (file.size > 100 * 1024 * 1024) {
          alert('"' + file.name + '" exceeds the maximum 100MB upload limit and was skipped.');
          checkAllProcessed();
          return;
        }

        var isVideo = file.type.startsWith('video/') || !!file.name.match(/\.(mp4|mov|webm|m4v|avi|mkv)$/i);
        var isHeic  = !!file.name.match(/\.(heic|heif)$/i) || file.type === 'image/heic' || file.type === 'image/heif';

        if (isVideo) {
          selectedMediaFiles.push({
            file: file,
            name: file.name || ('collector_clip_' + Date.now() + '_' + fileIdx + '.mp4'),
            isVideo: true,
            isHeic: false,
            previewUrl: URL.createObjectURL(file),
            size: file.size
          });
          checkAllProcessed();
        } else if (isHeic) {
          selectedMediaFiles.push({
            file: file,
            name: file.name,
            isVideo: false,
            isHeic: true,
            previewUrl: '',
            size: file.size
          });
          checkAllProcessed();
        } else if (file.type.startsWith('image/')) {
          compressImageFile(file, function (blob, dataUrl) {
            selectedMediaFiles.push({
              file: blob,
              name: 'collector_photo_' + Date.now() + '_' + fileIdx + '.webp',
              isVideo: false,
              isHeic: false,
              previewUrl: dataUrl,
              size: blob.size
            });
            checkAllProcessed();
          });
        } else {
          selectedMediaFiles.push({
            file: file,
            name: file.name,
            isVideo: false,
            isHeic: false,
            previewUrl: URL.createObjectURL(file),
            size: file.size
          });
          checkAllProcessed();
        }
      });
    });
  }

  function compressImageFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function (evt) {
      var img = new Image();
      img.onload = function () {
        var maxWidth  = 1920;
        var maxHeight = 1920;
        var width     = img.width;
        var height    = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width  = maxWidth;
          } else {
            width  = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        var canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(function (blob) {
          callback(blob, canvas.toDataURL('image/webp', 0.85));
        }, 'image/webp', 0.85);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Public Review Form AJAX Submission
   */
  function initReviewForm() {
    var $form     = $('#artmatter-collector-review-form');
    var $btn      = $('#artmatter-submit-review-btn');
    var $feedback = $('#artmatter-review-feedback');

    if (!$form.length) return;

    // Live public name redaction preview
    var $custName = $('#customer_name');
    var $preview  = $('#artmatter-redacted-preview');

    function updateRedactionPreview() {
      var val = ($custName.val() || '').trim();
      if (!val) {
        $preview.text('E***e');
        return;
      }
      var clean = val.replace(/[^\p{L}\p{N}]/gu, '');
      if (clean.length <= 2) {
        $preview.text(clean.charAt(0).toUpperCase() + '***');
        return;
      }
      var first = clean.charAt(0).toUpperCase();
      var last  = clean.charAt(clean.length - 1).toLowerCase();
      $preview.text(first + '***' + last);
    }

    var bypassMediaPrompt = false;

    // Perk Modal Action: Add Photo/Video
    $(document).on('click', '#artmatter-perk-add-photo-btn', function (e) {
      e.preventDefault();
      $('#artmatter-perk-modal').fadeOut(150);
      var $dropzone = $('#artmatter-media-dropzone');
      if ($dropzone.length) {
        $('html, body').animate({
          scrollTop: $dropzone.offset().top - 120
        }, 300, function () {
          $('#review_media').trigger('click');
        });
      }
    });

    // Perk Modal Action: Proceed Without Discount
    $(document).on('click', '#artmatter-perk-skip-btn', function (e) {
      e.preventDefault();
      $('#artmatter-perk-modal').fadeOut(150);
      bypassMediaPrompt = true;
      $form.trigger('submit');
    });

    // Perk Modal Action: Close Dialog
    $(document).on('click', '#artmatter-perk-modal-close, #artmatter-perk-modal .artmatter-review-modal-backdrop', function (e) {
      e.preventDefault();
      $('#artmatter-perk-modal').fadeOut(150);
    });

    $form.on('submit', function (e) {
      e.preventDefault();

      var hasMedia = (selectedMediaFiles.length > 0) || ($('#review_media')[0] && $('#review_media')[0].files && $('#review_media')[0].files.length > 0);

      // If no photo/video is attached and collector has not bypassed the prompt, show perk reminder modal
      if (!hasMedia && !bypassMediaPrompt) {
        $('#artmatter-perk-modal').fadeIn(200);
        return false;
      }

      // Reset bypass flag
      bypassMediaPrompt = false;

      var restBase = (window.ArtmatterReviewsData && window.ArtmatterReviewsData.restUrl)
        ? window.ArtmatterReviewsData.restUrl
        : '/wp-json/artmatter-core/v1/';

      var submitUrl = restBase + 'reviews/submit';

      var formData = new FormData($form[0]);

      // Clear raw media inputs from formData
      formData.delete('media');
      formData.delete('media[]');

      // Append all selected files (up to 5)
      selectedMediaFiles.forEach(function (item, idx) {
        formData.append('media[]', item.file, item.name);
        formData.append('media_' + idx, item.file, item.name);
      });

      $btn.prop('disabled', true).find('span').text('Submitting review...');
      $feedback.hide().removeClass('is-success is-error');

      $.ajax({
        url: submitUrl,
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: {
          'X-WP-Nonce': (window.ArtmatterReviewsData && window.ArtmatterReviewsData.nonce) ? window.ArtmatterReviewsData.nonce : ''
        },
        success: function (res) {
          if (res.success) {
            var msg  = res.message || 'Thank you for your review. It has been safely recorded.';
            var html = '<div class="artmatter-feedback-msg">' + msg + '</div>';

            // Mark active piece as reviewed in local state
            if (piecesData[currentPieceIndex]) {
              piecesData[currentPieceIndex].is_reviewed = true;
              var $pill = $('#artmatter-carousel-pills .artmatter-carousel-pill[data-idx="' + currentPieceIndex + '"]');
              $pill.addClass('is-reviewed');
              if (!$pill.find('.artmatter-pill-check').length) {
                $pill.append('<span class="artmatter-pill-check">&check;</span>');
              }
              $('#artmatter-active-reviewed-pill').show();
            }

            // Direct discount coupon box (No technical jargon)
            if (res.reward_coupon && res.reward_coupon.code) {
              var c = res.reward_coupon;
              html += '<div class="artmatter-reward-coupon-box">' +
                '<div class="artmatter-reward-coupon-header">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f3aa18" stroke-width="2"><path d="M20 12V8H4v4a2 2 0 0 1 0 4v4h16v-4a2 2 0 0 1 0-4Z"/><path d="M4 12h16"/></svg>' +
                  '<span>' + (c.discount_percent || 20) + '% Off Next Purchase</span>' +
                '</div>' +
                '<p class="artmatter-reward-coupon-desc">Thank you for sharing your photo and review! Enjoy ' + (c.discount_percent || 20) + '% off your next purchase with your promo code:</p>' +
                '<div class="artmatter-coupon-code-row">' +
                  '<code class="artmatter-coupon-code" id="artmatter-coupon-display">' + c.code + '</code>' +
                  '<button type="button" class="artmatter-btn-copy-coupon" data-code="' + c.code + '">' +
                    '<span>Copy Code</span>' +
                  '</button>' +
                '</div>' +
                '<p class="artmatter-reward-expiry">Single-use promo code &bull; Valid until ' + (c.expiry_date || '30 days') + '</p>' +
              '</div>';
            }

            // If there are more unreviewed pieces in this order, offer "Review Next Piece"
            var unreviewedLeft = 0;
            for (var k = 0; k < piecesData.length; k++) {
              if (!piecesData[k].is_reviewed) {
                unreviewedLeft++;
              }
            }

            if (unreviewedLeft > 0) {
              html += '<div style="margin-top: 14px; text-align: center;">' +
                '<button type="button" class="artmatter-btn-next-piece" id="artmatter-btn-next-piece">' +
                  '<span>Review Next Piece (' + unreviewedLeft + ' remaining) &rarr;</span>' +
                '</button>' +
              '</div>';
            }

            $feedback.addClass('is-success').html(html).fadeIn();
            $form[0].reset();
            selectedMediaFiles = [];
            $('#artmatter-media-preview').empty().hide();
            $btn.prop('disabled', true).find('span').text('Review Submitted');
          } else {
            $btn.prop('disabled', false).find('span').text('Submit Review');
            $feedback.addClass('is-error').text(res.message || 'An error occurred.').fadeIn();
          }
        },
        error: function (xhr) {
          $btn.prop('disabled', false).find('span').text('Submit Review');
          var err = 'Failed submitting review.';
          if (xhr.responseJSON && xhr.responseJSON.message) {
            err = xhr.responseJSON.message;
          }
          $feedback.addClass('is-error').text(err).fadeIn();
        }
      });
    });

    // 1-Click Copy Coupon Code
    $(document).on('click', '.artmatter-btn-copy-coupon', function (e) {
      e.preventDefault();
      var code = $(this).attr('data-code');
      if (!code) return;
      var $copyBtn = $(this);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
          $copyBtn.find('span').text('Copied!');
          setTimeout(function () {
            $copyBtn.find('span').text('Copy Code');
          }, 2500);
        });
      } else {
        var $temp = $('<input>');
        $('body').append($temp);
        $temp.val(code).select();
        document.execCommand('copy');
        $temp.remove();
        $copyBtn.find('span').text('Copied!');
        setTimeout(function () {
          $copyBtn.find('span').text('Copy Code');
        }, 2500);
      }
    });
  }

  /**
   * Reviews Slider / Carousel Navigation Controls
   */
  function initReviewSliders() {
    $(document).on('click', '.artmatter-reviews-arrow.is-prev', function (e) {
      e.preventDefault();
      var $wrap = $(this).closest('.artmatter-reviews-wrapper');
      var $container = $wrap.find('.artmatter-reviews-container');
      var scrollAmount = ($container.find('.artmatter-review-card').outerWidth(true) || 340) * 1.5;
      var currentPos = $container.scrollLeft();
      $container.animate({ scrollLeft: Math.max(0, currentPos - scrollAmount) }, 320);
    });

    $(document).on('click', '.artmatter-reviews-arrow.is-next', function (e) {
      e.preventDefault();
      var $wrap = $(this).closest('.artmatter-reviews-wrapper');
      var $container = $wrap.find('.artmatter-reviews-container');
      var scrollAmount = ($container.find('.artmatter-review-card').outerWidth(true) || 340) * 1.5;
      var currentPos = $container.scrollLeft();
      $container.animate({ scrollLeft: currentPos + scrollAmount }, 320);
    });
  }

})(jQuery);
