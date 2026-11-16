/**
 * Style Vibeus — Prototype 2: In-Hero 3D Flagship Showroom
 * assets/hero-3d-boutique.js
 * High-performance 60fps lerp 3D parallax, mobile touch/gyro, & smooth scrolling.
 */

(function () {
  'use strict';

  const instances = new Map();

  class Hero3DBoutique {
    constructor(element) {
      this.container = element;
      this.viewport = element.querySelector('[data-hero-3d-viewport]');
      this.stage = element.querySelector('[data-hero-3d-stage]');
      if (!this.stage) return;

      this.intensity = parseFloat(element.dataset.intensity) || 1.0;
      this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Coordinate tracking
      this.targetNormX = 0;
      this.targetNormY = 0;
      this.currentNormX = 0;
      this.currentNormY = 0;
      this.lerpFactor = 0.08;

      // Idle subtle breathing wave
      this.lastUserInteraction = performance.now();
      this.isUserInteracting = false;

      // Animation loop control
      this.rafId = null;
      this.isVisible = true;
      this.isDestroyed = false;

      // Device orientation support
      this.hasGyro = false;
      this.gyroAvailable = false;

      // Bind methods
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      this.onDeviceOrientation = this.onDeviceOrientation.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.onCtaClick = this.onCtaClick.bind(this);
      this.renderFrame = this.renderFrame.bind(this);

      this.init();
    }

    init() {
      if (this.isReducedMotion) {
        this.bindCtaLinks();
        return;
      }

      this.bindEvents();
      this.setupObserver();
      this.bindCtaLinks();
      this.startLoop();
    }

    bindEvents() {
      // Desktop Pointer Tracking
      const targetArea = this.viewport || this.container;
      targetArea.addEventListener('pointermove', this.onPointerMove, { passive: true });
      targetArea.addEventListener('pointerleave', this.onPointerLeave, { passive: true });

      // Mobile Touch Tracking
      targetArea.addEventListener('touchstart', this.onTouchStart, { passive: true });
      targetArea.addEventListener('touchmove', this.onTouchMove, { passive: true });
      targetArea.addEventListener('touchend', this.onTouchEnd, { passive: true });
      targetArea.addEventListener('touchcancel', this.onTouchEnd, { passive: true });

      // Gyroscope / DeviceOrientation Tracking (Mobile)
      if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
        window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
      }

      // Visibility Change (Pause when tab is hidden)
      document.addEventListener('visibilitychange', this.onVisibilityChange, { passive: true });
    }

    setupObserver() {
      // IntersectionObserver: Pause rendering when hero is not visible in viewport
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              this.isVisible = entry.isIntersecting;
              if (this.isVisible) {
                this.startLoop();
              } else {
                this.stopLoop();
              }
            });
          },
          { threshold: 0.05 }
        );
        this.observer.observe(this.container);
      }
    }

    bindCtaLinks() {
      // Intercept CTA and scroll cues for smooth navigation to #hanger-rack
      const ctas = this.container.querySelectorAll('[data-hero-3d-cta], [data-hero-3d-scroll-cue]');
      ctas.forEach((cta) => {
        cta.addEventListener('click', this.onCtaClick);
      });
    }

    onCtaClick(e) {
      const link = e.currentTarget;
      const href = link.getAttribute('href');
      if (!href) return;

      // Check if href is an in-page hash or contains #hanger-rack
      const hashIndex = href.indexOf('#');
      if (hashIndex !== -1) {
        const hash = href.slice(hashIndex);
        let targetEl = null;

        if (hash === '#hanger-rack' || hash === '#HangerRack' || hash.includes('hanger')) {
          targetEl =
            document.querySelector('[data-hanger-rack]') ||
            document.getElementById('hanger-rack') ||
            document.querySelector('.hanger-rack') ||
            document.querySelector('[id^="HangerRack-"]');
        } else if (hash.length > 1) {
          try {
            targetEl = document.querySelector(hash);
          } catch (err) {
            // invalid selector fallback
          }
        }

        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // Focus target element for screen reader accessibility
          if (!targetEl.hasAttribute('tabindex')) {
            targetEl.setAttribute('tabindex', '-1');
          }
          targetEl.focus({ preventScroll: true });
        }
      }
    }

    onPointerMove(e) {
      this.isUserInteracting = true;
      this.lastUserInteraction = performance.now();

      const rect = this.container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // Normalized coordinates: -0.5 to +0.5
      const clientX = e.clientX;
      const clientY = e.clientY;

      const normX = (clientX - rect.left) / rect.width - 0.5;
      const normY = (clientY - rect.top) / rect.height - 0.5;

      this.targetNormX = Math.max(-0.5, Math.min(0.5, normX));
      this.targetNormY = Math.max(-0.5, Math.min(0.5, normY));
    }

    onPointerLeave() {
      this.isUserInteracting = false;
      this.targetNormX = 0;
      this.targetNormY = 0;
    }

    onTouchStart(e) {
      this.isUserInteracting = true;
      this.lastUserInteraction = performance.now();
      if (e.touches && e.touches[0]) {
        this.handleTouchCoords(e.touches[0]);
      }
    }

    onTouchMove(e) {
      this.isUserInteracting = true;
      this.lastUserInteraction = performance.now();
      if (e.touches && e.touches[0]) {
        this.handleTouchCoords(e.touches[0]);
      }
    }

    onTouchEnd() {
      this.isUserInteracting = false;
      this.targetNormX = 0;
      this.targetNormY = 0;
    }

    handleTouchCoords(touch) {
      const rect = this.container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const normX = (touch.clientX - rect.left) / rect.width - 0.5;
      const normY = (touch.clientY - rect.top) / rect.height - 0.5;

      // Soft clamp for mobile touch
      this.targetNormX = Math.max(-0.4, Math.min(0.4, normX));
      this.targetNormY = Math.max(-0.4, Math.min(0.4, normY));
    }

    onDeviceOrientation(e) {
      if (this.isUserInteracting) return;
      if (e.gamma === null || e.beta === null) return;

      this.gyroAvailable = true;
      // Gamma: left-to-right tilt [-90 to 90], Beta: front-to-back tilt [-180 to 180]
      const clampedGamma = Math.max(-30, Math.min(30, e.gamma));
      const clampedBeta = Math.max(10, Math.min(70, e.beta)) - 40; // calibrated for ~40deg viewing angle

      this.targetNormX = (clampedGamma / 30) * 0.4;
      this.targetNormY = (clampedBeta / 30) * 0.4;
    }

    onVisibilityChange() {
      if (document.hidden) {
        this.stopLoop();
      } else if (this.isVisible) {
        this.startLoop();
      }
    }

    startLoop() {
      if (this.rafId || this.isDestroyed || this.isReducedMotion) return;
      this.rafId = requestAnimationFrame(this.renderFrame);
    }

    stopLoop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    renderFrame(now) {
      if (this.isDestroyed || !this.isVisible) {
        this.rafId = null;
        return;
      }

      // If user has been idle for >1.8s and not using gyro, apply subtle ambient breathing wave
      if (!this.isUserInteracting && !this.gyroAvailable) {
        const idleTime = now - this.lastUserInteraction;
        if (idleTime > 1800) {
          const wave = Math.sin(now * 0.0012);
          const waveY = Math.cos(now * 0.0009);
          this.targetNormX = wave * 0.06;
          this.targetNormY = waveY * 0.04;
        }
      }

      // Linear interpolation (lerp) for buttery smooth 60fps
      this.currentNormX += (this.targetNormX - this.currentNormX) * this.lerpFactor;
      this.currentNormY += (this.targetNormY - this.currentNormY) * this.lerpFactor;

      // Apply values to CSS custom properties
      const intensity = this.intensity;
      const rotX = -this.currentNormY * 13 * intensity;
      const rotY = this.currentNormX * 16 * intensity;

      const bgTx = -this.currentNormX * 36 * intensity;
      const bgTy = -this.currentNormY * 24 * intensity;

      const midTx = this.currentNormX * 22 * intensity;
      const midTy = this.currentNormY * 16 * intensity;

      const fgTx = this.currentNormX * 12 * intensity;
      const fgTy = this.currentNormY * 8 * intensity;

      const specularX = 50 + this.currentNormX * 55;
      const specularY = 40 + this.currentNormY * 45;

      const shadowScale = 1 - Math.abs(this.currentNormX) * 0.12;
      const shadowTx = this.currentNormX * 26 * intensity;

      const s = this.stage.style;
      s.setProperty('--rot-x', `${rotX.toFixed(2)}deg`);
      s.setProperty('--rot-y', `${rotY.toFixed(2)}deg`);
      s.setProperty('--bg-tx', `${bgTx.toFixed(1)}px`);
      s.setProperty('--bg-ty', `${bgTy.toFixed(1)}px`);
      s.setProperty('--mid-tx', `${midTx.toFixed(1)}px`);
      s.setProperty('--mid-ty', `${midTy.toFixed(1)}px`);
      s.setProperty('--fg-tx', `${fgTx.toFixed(1)}px`);
      s.setProperty('--fg-ty', `${fgTy.toFixed(1)}px`);
      s.setProperty('--specular-x', `${specularX.toFixed(1)}%`);
      s.setProperty('--specular-y', `${specularY.toFixed(1)}%`);
      s.setProperty('--shadow-scale', `${shadowScale.toFixed(2)}`);
      s.setProperty('--shadow-tx', `${shadowTx.toFixed(1)}px`);

      this.rafId = requestAnimationFrame(this.renderFrame);
    }

    destroy() {
      this.isDestroyed = true;
      this.stopLoop();

      if (this.observer) {
        this.observer.disconnect();
      }

      const targetArea = this.viewport || this.container;
      targetArea.removeEventListener('pointermove', this.onPointerMove);
      targetArea.removeEventListener('pointerleave', this.onPointerLeave);
      targetArea.removeEventListener('touchstart', this.onTouchStart);
      targetArea.removeEventListener('touchmove', this.onTouchMove);
      targetArea.removeEventListener('touchend', this.onTouchEnd);
      targetArea.removeEventListener('touchcancel', this.onTouchEnd);

      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', this.onDeviceOrientation);
      }
      document.removeEventListener('visibilitychange', this.onVisibilityChange);

      const ctas = this.container.querySelectorAll('[data-hero-3d-cta], [data-hero-3d-scroll-cue]');
      ctas.forEach((cta) => {
        cta.removeEventListener('click', this.onCtaClick);
      });
    }
  }

  function initSection(container) {
    if (!container || instances.has(container)) return;
    const instance = new Hero3DBoutique(container);
    instances.set(container, instance);
  }

  function destroySection(container) {
    if (!container || !instances.has(container)) return;
    const instance = instances.get(container);
    instance.destroy();
    instances.delete(container);
  }

  // DOM ready initialization
  function initAll() {
    document.querySelectorAll('[data-hero-3d]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Shopify Theme Editor Integration
  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-hero-3d]') || (e.target.matches('[data-hero-3d]') ? e.target : null);
    if (el) initSection(el);
  });

  document.addEventListener('shopify:section:unload', (e) => {
    const el = e.target.querySelector('[data-hero-3d]') || (e.target.matches('[data-hero-3d]') ? e.target : null);
    if (el) destroySection(el);
  });

  document.addEventListener('shopify:section:select', (e) => {
    const el = e.target.querySelector('[data-hero-3d]') || (e.target.matches('[data-hero-3d]') ? e.target : null);
    if (el && instances.has(el)) {
      instances.get(el).startLoop();
    }
  });
})();
