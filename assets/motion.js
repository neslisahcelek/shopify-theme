/* =========================================================
   Style Vibeus — Global Scroll-Reveal & Motion Controller
   Above-the-fold safe, Theme Editor & Reduced-Motion aware
   ========================================================= */
(() => {
  'use strict';

  const prefersReduced = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isMotionEnabled = () =>
    document.documentElement.classList.contains('motion') && !prefersReduced();

  let sectionObserver = null;

  function revealImmediately(el) {
    el.classList.add('is-revealed');
    el.removeAttribute('data-motion-reveal');
  }

  function ensureObserver() {
    if (sectionObserver || !('IntersectionObserver' in window)) return sectionObserver;
    sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          sectionObserver.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );
    return sectionObserver;
  }

  function initSectionReveals(scope = document) {
    const main = document.getElementById('MainContent');
    if (!main) return;

    const sections =
      scope === document
        ? [...main.querySelectorAll(':scope > .shopify-section')]
        : scope.classList && scope.classList.contains('shopify-section')
          ? [scope]
          : [...scope.querySelectorAll('.shopify-section')];

    if (!sections.length) return;

    // Guarantee above-the-fold [data-reveal] elements are never stuck hidden
    const vh = window.innerHeight || 800;
    document.querySelectorAll('[data-reveal], [data-split]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.95) {
        el.classList.add('is-in');
      }
    });

    if (!isMotionEnabled() || !('IntersectionObserver' in window)) {
      sections.forEach(revealImmediately);
      return;
    }

    const io = ensureObserver();

    sections.forEach((sec, idx) => {
      // Never hide the first hero/slideshow section or anything already in initial viewport
      const isHero =
        idx === 0 ||
        sec.querySelector('.slideshow, .hero, [data-slideshow]') !== null;
      const rect = sec.getBoundingClientRect();
      const inViewport = rect.top < vh * 0.92;

      if (isHero || inViewport) {
        revealImmediately(sec);
        return;
      }

      if (!sec.classList.contains('is-revealed')) {
        sec.setAttribute('data-motion-reveal', '');
        io.observe(sec);
      }
    });
  }

  function initQuickSizeCards() {
    document.addEventListener(
      'click',
      (e) => {
        const sizeBtn = e.target.closest('[data-quick-size-btn]');
        if (!sizeBtn) return;
        const form = sizeBtn.closest('[data-product-form]');
        const idInput = form && form.querySelector('[data-quick-variant-id]');
        if (idInput && sizeBtn.dataset.variantId) {
          idInput.value = sizeBtn.dataset.variantId;
        }
        if (form) {
          form.querySelectorAll('[data-quick-size-btn]').forEach((b) => {
            b.classList.toggle('is-selected', b === sizeBtn);
          });
        }
      },
      true
    );
  }

  function boot() {
    initSectionReveals(document);
    initQuickSizeCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', (e) => {
    if (e.target) {
      e.target.classList.add('is-revealed');
      e.target.removeAttribute('data-motion-reveal');
      e.target.querySelectorAll('[data-reveal], [data-split]').forEach((el) => {
        el.classList.add('is-in');
      });
    }
  });
})();
