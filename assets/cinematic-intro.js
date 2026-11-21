/**
 * Style Vibeus — Cinematic Flagship Video Intro Controller
 * --------------------------------------------------------------------------
 * - Respects sessionStorage (`sv_cinematic_seen`) & `prefers-reduced-motion`
 * - Swaps mobile vertical video source (`data-mobile-src`) on viewports < 768px
 * - Supports `auto` mode (with 650ms Low Power Mode fallback & 4200ms safety timeout)
 *   and `enter` mode (paused on poster until ENTER click, fades out on ended)
 * - Unlocks scroll & applies GPU-composited opacity fade before display: none
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'sv_cinematic_seen';
  var FADE_OUT_MS = 450;
  var AUTO_SAFETY_TIMEOUT_MS = 4200;
  var AUTOPLAY_BLOCKED_DELAY_MS = 650;

  function hasSeenIntro() {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
      }
    } catch (e) {}
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function inferMimeType(url) {
    return url.toLowerCase().indexOf('.webm') !== -1 ? 'video/webm' : 'video/mp4';
  }

  function releaseVideoResources(video) {
    if (!video) return;
    try {
      video.pause();
      var sources = video.querySelectorAll('source');
      for (var i = 0; i < sources.length; i++) {
        sources[i].removeAttribute('src');
      }
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
  }

  function initCinematicIntro() {
    var intro = document.getElementById('sv-cinematic-intro');
    if (!intro) return;

    var video = document.getElementById('sv-cinematic-video');
    var skipBtn = document.getElementById('sv-cinematic-skip');
    var enterBtn = document.getElementById('sv-cinematic-enter');
    var enterWrap = intro.querySelector('.cinematic-intro__center');
    var progressFill = document.getElementById('sv-cinematic-progress-fill');

    // Immediate bypass on repeat session visits or reduced motion
    if (hasSeenIntro() || prefersReducedMotion() || !video) {
      document.documentElement.classList.add('sv-cinematic-dismissed');
      intro.classList.add('sv-cinematic-done');
      intro.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sv-cinematic-locked');
      releaseVideoResources(video);
      return;
    }

    var mode = (intro.getAttribute('data-mode') || 'auto').toLowerCase() === 'enter' ? 'enter' : 'auto';
    var isFading = false;
    var isDone = false;
    var hasStartedEnter = false;
    var autoplayBlockedHandled = false;
    var safetyTimer = null;
    var blockedTimer = null;
    var cleanupTimer = null;
    var progressRaf = null;
    var fallbackStartTime = null;
    var inertedNodes = [];
    var previousActiveElement = document.activeElement;

    // Lock scroll and mark sibling landmarks inert while modal dialog is active
    document.body.classList.add('sv-cinematic-locked');
    var bodyChildren = document.body ? document.body.children : [];
    for (var i = 0; i < bodyChildren.length; i++) {
      var child = bodyChildren[i];
      if (
        child !== intro &&
        child.tagName !== 'SCRIPT' &&
        child.tagName !== 'STYLE' &&
        !child.hasAttribute('inert')
      ) {
        child.setAttribute('inert', '');
        inertedNodes.push(child);
      }
    }

    try {
      intro.focus({ preventScroll: true });
    } catch (e) {}

    // Swap mobile vertical video source on viewports < 768px before playback
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    var mobileSrc = (video.getAttribute('data-mobile-src') || '').trim();
    var sourceEl = video.querySelector('source');

    if (viewportWidth < 768 && mobileSrc) {
      if (sourceEl) {
        if (sourceEl.getAttribute('src') !== mobileSrc) {
          sourceEl.setAttribute('src', mobileSrc);
          sourceEl.setAttribute('type', inferMimeType(mobileSrc));
          video.load();
        }
      } else {
        video.setAttribute('src', mobileSrc);
        video.load();
      }
    }

    function setProgress(ratio) {
      if (!progressFill) return;
      progressFill.style.transform = 'scaleX(' + clamp(ratio, 0, 1).toFixed(4) + ')';
    }

    function stopProgressLoop() {
      if (progressRaf) {
        cancelAnimationFrame(progressRaf);
        progressRaf = null;
      }
    }

    function tickProgress(now) {
      if (isFading || isDone) return;
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setProgress(video.currentTime / video.duration);
      } else if (mode === 'auto') {
        if (fallbackStartTime === null) fallbackStartTime = now;
        setProgress((now - fallbackStartTime) / AUTO_SAFETY_TIMEOUT_MS);
      }
      progressRaf = requestAnimationFrame(tickProgress);
    }

    function startProgressLoop() {
      stopProgressLoop();
      fallbackStartTime = null;
      progressRaf = requestAnimationFrame(tickProgress);
    }

    function clearTimers() {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      if (blockedTimer) {
        clearTimeout(blockedTimer);
        blockedTimer = null;
      }
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
    }

    function restoreInertAndFocus() {
      for (var j = 0; j < inertedNodes.length; j++) {
        inertedNodes[j].removeAttribute('inert');
      }
      inertedNodes = [];

      if (
        previousActiveElement &&
        previousActiveElement !== document.body &&
        typeof previousActiveElement.focus === 'function' &&
        document.contains(previousActiveElement)
      ) {
        try {
          previousActiveElement.focus({ preventScroll: true });
        } catch (e) {}
      }
    }

    function cleanup() {
      if (isDone) return;
      isDone = true;
      clearTimers();
      stopProgressLoop();

      intro.classList.remove('sv-cinematic-fading', 'is-playing', 'is-autoplay-blocked');
      intro.classList.add('sv-cinematic-done');
      intro.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.add('sv-cinematic-dismissed');
      document.body.classList.remove('sv-cinematic-locked');

      restoreInertAndFocus();
      releaseVideoResources(video);

      document.removeEventListener('keydown', onKeyDown);
      intro.removeEventListener('click', onBlockedTap);
      intro.removeEventListener('transitionend', onFadeEnd);
      if (skipBtn) skipBtn.removeEventListener('click', onSkipClick);
      if (enterBtn) enterBtn.removeEventListener('click', onEnterClick);
      video.removeEventListener('ended', onVideoEnded);
      video.removeEventListener('error', onMediaError);
      if (sourceEl) sourceEl.removeEventListener('error', onMediaError);

      try {
        window.dispatchEvent(new CustomEvent('sv:cinematic:dismissed', { bubbles: true }));
      } catch (e) {}
    }

    function onFadeEnd(e) {
      if (e && e.target === intro && e.propertyName === 'opacity' && isFading) {
        cleanup();
      }
    }

    function triggerExit() {
      if (isFading || isDone) return;
      isFading = true;
      clearTimers();
      stopProgressLoop();
      setProgress(1);
      markIntroSeen();

      document.body.classList.remove('sv-cinematic-locked');
      intro.classList.add('sv-cinematic-fading');

      // Wait for opacity transitionend with deterministic failsafe timeout
      cleanupTimer = setTimeout(cleanup, FADE_OUT_MS + 60);
    }

    function handleAutoplayBlocked() {
      if (autoplayBlockedHandled || isFading || isDone) return;
      autoplayBlockedHandled = true;
      clearTimers();
      stopProgressLoop();

      intro.classList.add('is-autoplay-blocked');
      intro.addEventListener('click', onBlockedTap);
      blockedTimer = setTimeout(triggerExit, AUTOPLAY_BLOCKED_DELAY_MS);
    }

    function onBlockedTap() {
      triggerExit();
    }

    function onSkipClick(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      triggerExit();
    }

    function onVideoEnded() {
      triggerExit();
    }

    function onMediaError() {
      if (mode === 'auto' || hasStartedEnter) {
        handleAutoplayBlocked();
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        triggerExit();
      }
    }

    function attemptPlayback() {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      try {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(function () {
              if (isFading || isDone) return;
              intro.classList.add('is-playing');
              startProgressLoop();
            })
            .catch(function () {
              handleAutoplayBlocked();
            });
        } else {
          intro.classList.add('is-playing');
          startProgressLoop();
        }
      } catch (err) {
        handleAutoplayBlocked();
      }
    }

    function onEnterClick(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (hasStartedEnter || isFading || isDone) return;
      hasStartedEnter = true;

      if (video.error) {
        handleAutoplayBlocked();
        return;
      }

      attemptPlayback();
    }

    // Bind event listeners
    document.addEventListener('keydown', onKeyDown);
    intro.addEventListener('transitionend', onFadeEnd);
    if (skipBtn) skipBtn.addEventListener('click', onSkipClick);
    if (enterBtn) enterBtn.addEventListener('click', onEnterClick);
    video.addEventListener('ended', onVideoEnded);
    video.addEventListener('error', onMediaError);
    if (sourceEl) sourceEl.addEventListener('error', onMediaError);

    // Initialize mode behavior
    if (mode === 'enter') {
      if (enterWrap) enterWrap.hidden = false;
      if (enterBtn) enterBtn.hidden = false;
      try {
        video.pause();
        if (video.readyState >= 1) {
          video.currentTime = 0;
        }
      } catch (e) {}
      setProgress(0);
    } else {
      if (enterWrap) enterWrap.hidden = true;
      if (enterBtn) enterBtn.hidden = true;
      safetyTimer = setTimeout(triggerExit, AUTO_SAFETY_TIMEOUT_MS);
      if (video.error) {
        handleAutoplayBlocked();
      } else {
        attemptPlayback();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCinematicIntro);
  } else {
    initCinematicIntro();
  }
})();
