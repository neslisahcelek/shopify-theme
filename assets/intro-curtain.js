/**
 * Style Vibeus — Prototype 1: Boutique Split / Curtain Reveal
 * -------------------------------------------------------------
 * - Session storage guard: 'sv_curtain_seen'
 * - Fallback timer: 1.3s safety timeout
 * - Instant interaction triggers: Click, touchstart, Escape key, Skip button
 * - Clean cleanup with zero layout/click blockage after animation
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'sv_curtain_seen';
  var FALLBACK_SAFETY_MS = 1300;
  var AUTO_OPEN_MS = 1150;
  var CLEANUP_BUFFER_MS = 1400;

  function hasSeenCurtain() {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markCurtainSeen() {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
      }
    } catch (e) {}
  }

  function initCurtain() {
    var curtain = document.getElementById('sv-curtain-intro');
    if (!curtain) return;

    var skipBtn = document.getElementById('sv-curtain-skip') || curtain.querySelector('.curtain-skip');
    var leftPanel = curtain.querySelector('.curtain-panel--left');

    // 1. If already seen, bypass entirely with zero delay
    if (hasSeenCurtain()) {
      document.documentElement.classList.add('sv-curtain-dismissed');
      curtain.classList.add('sv-curtain-done');
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.display = 'none';
      return;
    }

    // 2. Mark seen immediately so reloads or sub-navigations do not re-trigger
    markCurtainSeen();

    // 3. Lock scroll during opening presentation
    document.body.classList.add('sv-curtain-locked');

    var isOpening = false;
    var isDone = false;
    var autoOpenTimer = null;
    var safetyTimer = null;
    var cleanupTimer = null;

    // Check for reduced motion preference
    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function finishCurtain() {
      if (isDone) return;
      isDone = true;

      // Clear all timers
      clearTimeout(autoOpenTimer);
      clearTimeout(safetyTimer);
      clearTimeout(cleanupTimer);

      // DOM & Accessibility cleanup
      curtain.classList.remove('sv-curtain-opening');
      curtain.classList.add('sv-curtain-done');
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.display = 'none';
      document.body.classList.remove('sv-curtain-locked');

      // Remove event listeners
      curtain.removeEventListener('click', onInteractiveTrigger);
      curtain.removeEventListener('touchstart', onInteractiveTrigger);
      document.removeEventListener('keydown', onKeyDown);
      if (skipBtn) {
        skipBtn.removeEventListener('click', onInteractiveTrigger);
      }
      if (leftPanel) {
        leftPanel.removeEventListener('transitionend', onPanelTransitionEnd);
      }

      // Dispatch global completion event for other sections/animations
      try {
        window.dispatchEvent(
          new CustomEvent('sv:curtain:opened', {
            bubbles: true,
            detail: { timestamp: Date.now() },
          })
        );
      } catch (err) {}
    }

    function openCurtain() {
      if (isOpening || isDone) return;
      isOpening = true;

      // If reduced motion, finish immediately
      if (prefersReducedMotion) {
        finishCurtain();
        return;
      }

      // Add opening class to trigger door split and text fade
      curtain.classList.add('sv-curtain-opening');

      // Release body scroll smoothly as the doors part
      setTimeout(function () {
        document.body.classList.remove('sv-curtain-locked');
      }, 150);

      // Listen for transition end on the left panel
      if (leftPanel) {
        leftPanel.addEventListener('transitionend', onPanelTransitionEnd, { once: true });
      }

      // Safety timeout in case transitionend does not fire
      cleanupTimer = setTimeout(finishCurtain, CLEANUP_BUFFER_MS);
    }

    function onPanelTransitionEnd(e) {
      if (e.target === leftPanel && e.propertyName === 'transform') {
        finishCurtain();
      }
    }

    function onInteractiveTrigger(e) {
      if (e) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }
      openCurtain();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        openCurtain();
      }
    }

    // Bind interaction events (tap, click, keyboard, skip button)
    curtain.addEventListener('click', onInteractiveTrigger, { passive: true });
    curtain.addEventListener('touchstart', onInteractiveTrigger, { passive: true });
    document.addEventListener('keydown', onKeyDown);

    if (skipBtn) {
      skipBtn.addEventListener('click', function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        openCurtain();
      });
    }

    // Schedule auto-open sequence
    autoOpenTimer = setTimeout(openCurtain, AUTO_OPEN_MS);

    // Fallback safety timer (1.3s)
    safetyTimer = setTimeout(function () {
      if (!isOpening) {
        openCurtain();
      }
    }, FALLBACK_SAFETY_MS);
  }

  // Run on DOM ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCurtain);
  } else {
    initCurtain();
  }
})();
