/**
 * Style Vibeus — Hybrid Cinematic Entrance + Interactive Showroom
 * ---------------------------------------------------------------------------
 * - Stage 1 (0 -> 2.5s): Plays photorealistic entrance video
 * - Stage 2 (Interactive): Seamless transition into real-product showroom
 * - Hover/tap any real Shopify product -> opens /products/...
 * - Back button from product returns straight into the showroom
 * - Explicit exit ("Enter Store X" / "Shop Now ->" / Esc) marks seen
 */

(function () {
  'use strict';

  var SEEN_KEY = 'sv_cinematic_seen';
  var IN_STORE_KEY = 'sv_cinematic_in_store';
  var FADE_OUT_MS = 460;
  var AUTO_SAFETY_MS = 3200;

  function hasSeenIntro() {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(SEEN_KEY, '1');
        window.sessionStorage.removeItem(IN_STORE_KEY);
      }
    } catch (e) {}
  }

  function isReturningInStore() {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(IN_STORE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markInStore() {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(IN_STORE_KEY, '1');
      }
    } catch (e) {}
  }

  function initCinematicIntro() {
    var intro = document.getElementById('sv-cinematic-intro');
    if (!intro) return;

    var video = document.getElementById('sv-cinematic-video');
    var showroom = document.getElementById('sv-cinematic-showroom');
    var viewport = document.getElementById('sv-showroom-viewport');
    var stage = document.getElementById('sv-showroom-stage');
    var skipBtn = document.getElementById('sv-cinematic-skip');
    var enterBtn = document.getElementById('sv-cinematic-enter');
    var shopNowBtn = document.getElementById('sv-cinematic-shop-now');
    var progressWrap = document.getElementById('sv-cinematic-progress-wrap');
    var exploreBar = document.getElementById('sv-cinematic-explore');
    var productPill = document.getElementById('sv-cinematic-product-pill');
    var pillTitle = productPill && productPill.querySelector('[data-pill-title]');
    var pillPrice = productPill && productPill.querySelector('[data-pill-price]');

    var mode = intro.getAttribute('data-mode') || 'auto';
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (hasSeenIntro() || prefersReduced) {
      document.documentElement.classList.add('sv-cinematic-dismissed');
      intro.classList.add('sv-cinematic-done');
      intro.setAttribute('aria-hidden', 'true');
      intro.style.display = 'none';
      document.body.classList.remove('sv-cinematic-locked');
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
        } catch (e) {}
      }
      return;
    }

    document.body.classList.add('sv-cinematic-locked');

    var inertNodes = [];
    var prevFocus = document.activeElement;
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child !== intro && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE' && !child.inert) {
        child.inert = true;
        inertNodes.push(child);
      }
    });

    var isShowroom = false;
    var isExiting = false;
    var isDone = false;
    var safetyTimer = null;
    var cleanupTimer = null;

    // Optional mobile video override
    if (video) {
      var mobileSrc = video.getAttribute('data-mobile-src');
      if (mobileSrc && (window.innerWidth || 1024) < 768) {
        var sourceEl = video.querySelector('source');
        if (sourceEl) {
          sourceEl.setAttribute('src', mobileSrc);
          if (mobileSrc.toLowerCase().indexOf('.webm') !== -1) {
            sourceEl.setAttribute('type', 'video/webm');
          }
          try {
            video.load();
          } catch (e) {}
        }
      }
    }

    function centerMobileViewport() {
      if (!viewport) return;
      if (viewport.scrollWidth > viewport.clientWidth) {
        viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      }
    }

    function enterShowroom() {
      if (isShowroom || isExiting || isDone) return;
      isShowroom = true;
      clearTimeout(safetyTimer);

      if (video) {
        try {
          video.pause();
        } catch (e) {}
      }

      if (enterBtn) enterBtn.hidden = true;
      if (progressWrap) progressWrap.hidden = true;
      if (exploreBar) exploreBar.hidden = false;
      if (showroom) showroom.setAttribute('aria-hidden', 'false');

      intro.classList.add('is-showroom');
      requestAnimationFrame(centerMobileViewport);
    }

    function finishExit() {
      if (isDone) return;
      isDone = true;
      clearTimeout(safetyTimer);
      clearTimeout(cleanupTimer);

      intro.classList.remove('sv-cinematic-fading', 'is-playing', 'is-showroom');
      intro.classList.add('sv-cinematic-done');

      if (document.activeElement && intro.contains(document.activeElement)) {
        try {
          document.activeElement.blur();
        } catch (e) {}
      }

      intro.setAttribute('aria-hidden', 'true');
      intro.style.display = 'none';
      document.body.classList.remove('sv-cinematic-locked');

      inertNodes.forEach(function (node) {
        node.inert = false;
      });
      if (prevFocus && typeof prevFocus.focus === 'function') {
        try {
          prevFocus.focus({ preventScroll: true });
        } catch (e) {}
      }

      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (e) {}
      }

      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      if (skipBtn) skipBtn.removeEventListener('click', onExitClick);
      if (shopNowBtn) shopNowBtn.removeEventListener('click', onExitClick);
      if (enterBtn) enterBtn.removeEventListener('click', onEnterClick);
    }

    function triggerExit(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (isExiting || isDone) return;
      isExiting = true;
      markIntroSeen();
      clearTimeout(safetyTimer);

      intro.classList.add('sv-cinematic-fading');
      document.body.classList.remove('sv-cinematic-locked');
      cleanupTimer = setTimeout(finishExit, FADE_OUT_MS);
    }

    function onExitClick(e) {
      triggerExit(e);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        triggerExit(e);
      }
    }

    function startPlayback() {
      if (!video) {
        enterShowroom();
        return;
      }
      intro.classList.add('is-playing');
      safetyTimer = setTimeout(enterShowroom, AUTO_SAFETY_MS);

      try {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {
            // Autoplay blocked (e.g. Low Power Mode): enter interactive showroom gracefully
            clearTimeout(safetyTimer);
            setTimeout(enterShowroom, 350);
          });
        }
      } catch (err) {
        enterShowroom();
      }
    }

    function onEnterClick(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (enterBtn) enterBtn.hidden = true;
      startPlayback();
    }

    function onPointerMove(e) {
      if (!isShowroom || !stage || isExiting || isDone) return;
      if ((window.innerWidth || 1024) < 768) return;
      var nx = (e.clientX / (window.innerWidth || 1440) - 0.5) * 2;
      var ny = (e.clientY / (window.innerHeight || 900) - 0.5) * 2;
      stage.style.setProperty('--pan-x', (-nx * 26).toFixed(1) + 'px');
      stage.style.setProperty('--pan-y', (-ny * 10).toFixed(1) + 'px');
    }

    // Bind product hotspots
    var garmentLinks = intro.querySelectorAll('[data-garment-link]');
    Array.prototype.forEach.call(garmentLinks, function (link) {
      var showPill = function () {
        if (!productPill) return;
        if (pillTitle) pillTitle.textContent = link.getAttribute('data-title') || '';
        if (pillPrice) pillPrice.textContent = link.getAttribute('data-price') || '';
        productPill.setAttribute('href', link.getAttribute('href') || '#');
        productPill.hidden = false;
      };
      link.addEventListener('mouseenter', showPill);
      link.addEventListener('focus', showPill);
      link.addEventListener('click', function () {
        markInStore();
      });
    });

    if (productPill) {
      productPill.addEventListener('click', function () {
        markInStore();
      });
    }

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    if (skipBtn) skipBtn.addEventListener('click', onExitClick);
    if (shopNowBtn) shopNowBtn.addEventListener('click', onExitClick);

    if (video) {
      video.addEventListener('ended', enterShowroom, { once: true });
      video.addEventListener('error', enterShowroom, { once: true });
    }

    // Returning from product detail? Open straight inside showroom
    if (isReturningInStore()) {
      enterShowroom();
      return;
    }

    if (mode === 'enter' && enterBtn) {
      enterBtn.hidden = false;
      enterBtn.addEventListener('click', onEnterClick);
    } else {
      startPlayback();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCinematicIntro);
  } else {
    initCinematicIntro();
  }
})();
