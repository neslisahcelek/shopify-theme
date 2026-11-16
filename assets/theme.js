/* =========================================================
   Atelier — theme scripts (no dependencies)
   Every feature is initialised per root element so the
   theme editor can re-run it when a section reloads.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const html = document.documentElement;
  const motion = () => html.classList.contains('motion');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const theme = window.theme || { routes: {}, settings: {}, strings: {} };

  /* ---------- Scroll loop: one rAF for every scroll-driven effect ---------- */
  const scrollHandlers = new Set();
  let lastY = scrollY, velocity = 0, ticking = false;
  function runScroll() {
    const y = scrollY;
    velocity = y - lastY;
    lastY = y;
    scrollHandlers.forEach((fn) => fn(y, velocity));
    ticking = false;
  }
  const requestScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } };
  addEventListener('scroll', requestScroll, { passive: true });
  addEventListener('resize', requestScroll, { passive: true });

  /* ---------- Preloader (once per session) ---------- */
  function initPreloader() {
    const el = $('.preloader');
    if (!el) return;
    let seen = false;
    try { seen = sessionStorage.getItem('atelier-loaded') === '1'; sessionStorage.setItem('atelier-loaded', '1'); } catch (e) {}
    if (seen || !motion()) { el.classList.add('is-skipped'); return; }
    const done = () => setTimeout(() => el.classList.add('is-done'), 300);
    if (document.readyState === 'complete') done(); else addEventListener('load', done, { once: true });
    setTimeout(() => el.classList.add('is-done'), 2500);
  }

  /* ---------- Split text into masked words (keeps <em>, <a>, <br>) ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.style.setProperty('--w', index++);
            const inner = document.createElement('span');
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  }

  /* ---------- Reveal on scroll ---------- */
  // Image wipes start fully clipped, and Chrome never reports a fully clipped
  // element as intersecting, so those are watched through their parent instead.
  const proxyTargets = new Map();
  const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      // the watcher may itself be a reveal item, so it always gets the class too
      [e.target, ...(proxyTargets.get(e.target) || [])].forEach((el) => el.classList.add('is-in'));
      proxyTargets.delete(e.target);
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }) : null;

  function initReveal(root) {
    $$('[data-split], [data-scrub]', root).forEach(splitWords);
    const items = $$('[data-reveal], [data-split], .img-reveal', root);
    if (!revealIO || !motion()) { items.forEach((el) => el.classList.add('is-in')); return; }
    items.forEach((el) => {
      if (!el.classList.contains('img-reveal') || !el.parentElement) { revealIO.observe(el); return; }
      const watcher = el.parentElement;
      if (!proxyTargets.has(watcher)) proxyTargets.set(watcher, []);
      proxyTargets.get(watcher).push(el);
      revealIO.observe(watcher);
    });
  }

  /* ---------- Text scrub: words light up with scroll position ---------- */
  function initScrub(root) {
    $$('[data-scrub]', root).forEach((el) => {
      const words = $$('.w', el);
      if (!motion()) { words.forEach((w) => w.classList.add('is-lit')); return; }
      const fn = () => {
        const r = el.getBoundingClientRect();
        const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35));
        const lit = Math.round(p * words.length);
        words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
      };
      scrollHandlers.add(fn); fn();
    });
  }

  /* ---------- Parallax ---------- */
  function initParallax(root) {
    if (!motion()) return;
    $$('[data-parallax]', root).forEach((el) => {
      const strength = parseFloat(el.dataset.parallax) || 0;
      if (!strength) return;
      const fn = () => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -100 || r.top > innerHeight + 100) return;
        const offset = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        el.style.transform = `translate3d(0, ${(-offset * strength * 100).toFixed(2)}%, 0)`;
      };
      scrollHandlers.add(fn); fn();
    });
  }

  /* ---------- Marquee speeds up with scroll velocity ---------- */
  function initMarqueeBoost(root) {
    if (!motion()) return;
    $$('.marquee--boost .marquee__track', root).forEach((track) => {
      let rate = 1;
      const fn = (y, v) => {
        const anim = track.getAnimations()[0];
        if (!anim) return;
        rate = 1 + Math.min(Math.abs(v) / 12, 4);
        anim.playbackRate = rate;
      };
      scrollHandlers.add(fn);
      // ease back to normal speed when scrolling stops
      setInterval(() => {
        const anim = track.getAnimations()[0];
        if (anim && anim.playbackRate > 1) anim.playbackRate = Math.max(1, anim.playbackRate * 0.9);
      }, 60);
    });
  }

  /* ---------- Header: hide on scroll down, solid after leaving the top ---------- */
  function initHeader() {
    const header = $('[data-header]');
    if (!header) return;
    const setHeight = () => html.style.setProperty('--header-h', header.offsetHeight + 'px');
    setHeight(); addEventListener('resize', setHeight);
    const sticky = header.classList.contains('header--sticky');
    const fn = (y, v) => {
      header.classList.toggle('is-scrolled', y > 10);
      if (!sticky || header.classList.contains('is-open')) return;
      if (y > 300 && v > 4) header.classList.add('is-hidden');
      else if (v < -4 || y < 300) header.classList.remove('is-hidden');
      html.style.setProperty('--header-offset', header.classList.contains('is-hidden') ? '0px' : header.offsetHeight + 'px');
    };
    scrollHandlers.add(fn); fn(scrollY, 0);

    const toggle = $('[data-menu-toggle]', header);
    const menu = $('[data-mobile-menu]');
    toggle?.addEventListener('click', () => {
      const open = !header.classList.contains('is-open');
      header.classList.toggle('is-open', open);
      menu?.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
      toggle.setAttribute('aria-expanded', open);
    });

    const searchToggle = $('[data-search-toggle]', header);
    const panel = $('[data-search-panel]', header);
    searchToggle?.addEventListener('click', (e) => {
      if (!panel) return;
      e.preventDefault();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) $('input[type="search"]', panel)?.focus();
    });
  }

  function initScrollProgress() {
    const bar = $('.scroll-progress');
    if (!bar) return;
    scrollHandlers.add((y) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
    });
  }

  /* ---------- Custom cursor ---------- */
  function initCursor() {
    const cursor = $('.cursor');
    if (!cursor || !finePointer || !motion()) return;
    cursor.classList.add('is-ready');
    const dot = $('.cursor__dot', cursor), ring = $('.cursor__ring', cursor), label = $('.cursor__label', cursor);
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px, ${y}px)`; }, { passive: true });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    (function loop() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointerover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const hover = e.target.closest('a, button, label, summary, input, select, [data-magnetic]');
      cursor.classList.toggle('is-label', !!labelled);
      cursor.classList.toggle('is-hover', !labelled && !!hover);
      if (labelled) label.textContent = labelled.dataset.cursor;
    });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-hover', 'is-label'));
  }

  /* ---------- Magnetic buttons ---------- */
  function initMagnetic(root) {
    if (!theme.settings.magnetic || !finePointer || !motion()) return;
    $$('[data-magnetic]', root).forEach((el) => {
      if (el.dataset.magneticDone) return;
      el.dataset.magneticDone = '1';
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.3;
        const dy = (e.clientY - r.top - r.height / 2) * 0.4;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Slideshow hero ---------- */
  function initSlideshow(root) {
    $$('[data-slideshow]', root).forEach((el) => {
      if (el.dataset.ssDone) return;
      el.dataset.ssDone = '1';
      requestAnimationFrame(() => el.classList.add('is-ready'));

      // curtain: report how far the next section has covered the pinned hero (0 → 1)
      if (el.classList.contains('slideshow--curtain')) {
        const next = el.closest('.shopify-section')?.nextElementSibling;
        if (next) {
          const fn = () => {
            const p = clamp(1 - next.getBoundingClientRect().top / innerHeight);
            el.style.setProperty('--cover', p.toFixed(3));
          };
          scrollHandlers.add(fn); fn();
        }
      }

      if (el.dataset.layout !== 'slider') return;
      initSlider(el);
    });
  }

  /* ---------- Lift effect: long-press on touch screens (hover is pure CSS) ---------- */
  function initLift(root) {
    $$('[data-lift]', root).forEach((media) => {
      if (media.dataset.liftDone) return;
      media.dataset.liftDone = '1';
      const host = media.closest('.slide, .look') || media;
      let holdTimer = null;
      const drop = () => { clearTimeout(holdTimer); host.classList.remove('is-lifted'); };
      media.addEventListener('touchstart', () => {
        holdTimer = setTimeout(() => {
          host.classList.add('is-lifted');
          navigator.vibrate?.(12);
        }, 320);
      }, { passive: true });
      media.addEventListener('touchmove', () => clearTimeout(holdTimer), { passive: true });
      media.addEventListener('touchend', (e) => {
        // a completed long-press should not also follow the item's link
        if (host.classList.contains('is-lifted')) e.preventDefault();
        setTimeout(drop, 900);
      });
      media.addEventListener('touchcancel', drop);
      media.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  /* ---------- Image swap: tap toggles the second view on touch screens ---------- */
  function initSwap(root) {
    if (finePointer) return; // hover handles it in CSS
    $$('[data-swap]', root).forEach((el) => {
      if (el.dataset.swapDone) return;
      el.dataset.swapDone = '1';
      el.addEventListener('click', () => el.classList.toggle('is-flipped'));
    });
  }

  /* ---------- Slideshow: autoplay, dots, swipe ---------- */
  function initSlider(el) {
    {
      const slides = $$('[data-slide]', el);
      const dots = $$('[data-dot]', el);
      if (slides.length < 2) return;
      const speed = parseFloat(getComputedStyle(el).getPropertyValue('--ss-speed')) * 1000 || 6000;
      const autoplay = el.dataset.autoplay === 'true' && motion();
      let index = 0, timer = null;

      const go = (next) => {
        next = (next + slides.length) % slides.length;
        if (next === index) return;
        const prev = slides[index];
        prev.classList.remove('is-active');
        prev.classList.add('is-leaving');
        setTimeout(() => prev.classList.remove('is-leaving'), 1200);
        slides[next].classList.add('is-active');
        slides.forEach((s, i) => { const a = $('a', s); if (a) a.tabIndex = i === next ? 0 : -1; });
        dots.forEach((d, i) => { d.classList.toggle('is-active', i === next); d.setAttribute('aria-selected', i === next); });
        index = next;
        restart();
      };
      const restart = () => {
        clearTimeout(timer);
        if (!autoplay || el.classList.contains('is-paused')) { el.classList.remove('is-playing'); return; }
        // re-trigger the dot progress animation
        el.classList.remove('is-playing'); void el.offsetWidth; el.classList.add('is-playing');
        timer = setTimeout(() => go(index + 1), speed);
      };

      dots.forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.dot))));
      el.addEventListener('pointerenter', () => { el.classList.add('is-paused'); restart(); });
      el.addEventListener('pointerleave', () => { el.classList.remove('is-paused'); restart(); });
      document.addEventListener('visibilitychange', () => { document.hidden ? clearTimeout(timer) : restart(); });

      let startX = null;
      el.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        startX = null;
      });

      el.addEventListener('shopify:block:select', (e) => {
        const i = slides.indexOf(e.target.closest('[data-slide]'));
        if (i > -1) { el.classList.add('is-paused'); go(i); }
      });
      restart();
    }
  }

  /* ---------- 3D tilt toward the cursor (hero product) ---------- */
  function initTilt(root) {
    if (!finePointer || !motion()) return;
    $$('[data-tilt]', root).forEach((el) => {
      const inner = $('[data-tilt-inner]', el);
      if (!inner || el.dataset.tiltDone) return;
      el.dataset.tiltDone = '1';
      // listen on the whole hero so the card reacts before the cursor reaches it
      const area = el.closest('section') || el;
      area.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = clamp((e.clientX - r.left) / r.width, -0.5, 1.5) - 0.5;
        const y = clamp((e.clientY - r.top) / r.height, -0.5, 1.5) - 0.5;
        inner.style.transform = `rotateY(${(x * 14).toFixed(2)}deg) rotateX(${(-y * 10).toFixed(2)}deg)`;
      });
      area.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    });
  }

  /* ---------- Drag to scroll (product sliders) ---------- */
  function initDragScroll(root) {
    $$('[data-drag-scroll]', root).forEach((el) => {
      if (el.dataset.dragDone || !finePointer) return;
      el.dataset.dragDone = '1';
      let down = false, startX = 0, startLeft = 0, moved = 0;
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = 0; startX = e.clientX; startLeft = el.scrollLeft;
      });
      addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 5) el.classList.add('is-dragging');
        el.scrollLeft = startLeft - dx;
      });
      addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        setTimeout(() => el.classList.remove('is-dragging'), 0);
      });
      el.addEventListener('click', (e) => { if (moved > 5) { e.preventDefault(); e.stopPropagation(); } }, true);
    });
  }

  /* ---------- Collection index: preview image follows the cursor ---------- */
  function initHoverReveal(root) {
    $$('[data-hover-reveal]', root).forEach((list) => {
      if (!finePointer) return;
      let mx = 0, my = 0, cx = 0, cy = 0, raf = null;
      const loop = () => {
        cx += (mx - cx) * 0.15; cy += (my - cy) * 0.15;
        list.style.setProperty('--mx', cx + 'px');
        list.style.setProperty('--my', cy + 'px');
        raf = Math.abs(mx - cx) + Math.abs(my - cy) > 0.5 ? requestAnimationFrame(loop) : null;
      };
      list.addEventListener('pointermove', (e) => {
        mx = e.clientX + 24; my = e.clientY - 160;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ---------- Lookbook: pinned horizontal scroll ---------- */
  function initLookbook(root) {
    $$('[data-lookbook]', root).forEach((section) => {
      const track = $('[data-lookbook-track]', section);
      const progress = $('.lookbook__progress', section);
      const imgs = $$('.look__img', section);
      const desktop = matchMedia('(min-width: 990px) and (hover: hover)');
      let distance = 0;

      const measure = () => {
        const pinned = motion() && desktop.matches;
        section.classList.toggle('is-pinned', pinned);
        if (!pinned) { section.style.removeProperty('--lookbook-h'); track.style.removeProperty('--lx'); return; }
        distance = Math.max(0, track.scrollWidth - innerWidth);
        section.style.setProperty('--lookbook-h', `${innerHeight + distance}px`);
      };

      const update = () => {
        let p;
        if (section.classList.contains('is-pinned')) {
          const r = section.getBoundingClientRect();
          p = clamp(-r.top / Math.max(1, r.height - innerHeight));
          track.style.setProperty('--lx', `${(-p * distance).toFixed(1)}px`);
        } else {
          const max = track.scrollWidth - track.clientWidth;
          p = max > 0 ? track.scrollLeft / max : 0;
        }
        progress?.style.setProperty('--lp', p.toFixed(4));
        // cut-out products aren't cropped, so the inner zoom-pan would clip them
        if (!motion() || section.classList.contains('lookbook--cutout')) return;
        imgs.forEach((img) => {
          const r = img.parentElement.getBoundingClientRect();
          const o = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
          img.style.transform = `scale(1.15) translate3d(${(o * -8).toFixed(2)}%, 0, 0)`;
        });
      };

      measure(); update();
      addEventListener('resize', () => { measure(); update(); });
      desktop.addEventListener?.('change', () => { measure(); update(); });
      track.addEventListener('scroll', update, { passive: true });
      scrollHandlers.add(update);
      $$('img', track).forEach((img) => img.complete || img.addEventListener('load', () => { measure(); update(); }, { once: true }));
    });
  }

  function initFooterBig(root) {
    const el = $('[data-footer-big]', root);
    const text = el && $('span', el);
    if (!text || !motion()) return;
    scrollHandlers.add(() => {
      const r = el.getBoundingClientRect();
      const p = clamp((innerHeight - r.top) / (r.height * 2));
      text.style.setProperty('--fb', `${((1 - p) * 100).toFixed(2)}%`);
    });
  }

  /* =========================================================
     Cart
     ========================================================= */
  const toastEl = $('.toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  }

  const drawerSectionId = 'cart-drawer';
  let lastFocus = null;

  function openDrawer() {
    const drawer = $('[data-cart-drawer]');
    if (!drawer) { location.href = theme.routes.cart; return; }
    lastFocus = document.activeElement;
    document.body.classList.add('cart-open', 'is-locked');
    setTimeout(() => drawer.focus(), 50);
  }
  function closeDrawer() {
    document.body.classList.remove('cart-open', 'is-locked');
    lastFocus?.focus?.();
  }

  function updateCount(count) {
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.classList.toggle('is-empty', count === 0);
      el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
    });
  }

  function renderDrawer(sectionsHtml) {
    const markup = sectionsHtml?.[drawerSectionId];
    if (!markup) return;
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const fresh = $('[data-cart-drawer]', doc);
    const current = $('[data-cart-drawer]');
    if (fresh && current) current.innerHTML = fresh.innerHTML;
    const count = parseInt($('[data-cart-drawer-count]', doc)?.textContent, 10);
    if (!Number.isNaN(count)) updateCount(count);
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || data.status) throw new Error(data.description || data.message || theme.strings.error);
    return data;
  }

  function flyToCart(fromEl) {
    const target = $('.header__cart');
    if (!fromEl || !target || !motion()) return;
    const img = fromEl.closest('.card, [data-product]')?.querySelector('img');
    if (!img) return;
    const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    const clone = img.cloneNode();
    Object.assign(clone.style, {
      position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px',
      objectFit: 'cover', borderRadius: '14px', zIndex: 1300, pointerEvents: 'none', margin: 0
    });
    document.body.appendChild(clone);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    clone.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy - 80}px) scale(.35)`, opacity: .9, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0 }
    ], { duration: 850, easing: 'cubic-bezier(.65,0,.35,1)' }).onfinish = () => clone.remove();
  }

  async function addToCart(form) {
    const button = $('[type="submit"]', form);
    const errorEl = $('[data-form-error]', form);
    const fd = new FormData(form);
    const body = {
      items: [{ id: Number(fd.get('id')), quantity: Number(fd.get('quantity') || 1) }],
      sections: drawerSectionId,
      sections_url: location.pathname
    };
    button?.classList.add('is-loading');
    if (errorEl) errorEl.hidden = true;
    try {
      const data = await postJSON(theme.routes.cartAdd, body);
      flyToCart(button);
      if (theme.settings.cartType === 'page') { location.href = theme.routes.cart; return; }
      renderDrawer(data.sections);
      setTimeout(openDrawer, motion() ? 450 : 0);
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.hidden = false; } else toast(err.message);
    } finally {
      button?.classList.remove('is-loading');
    }
  }

  async function changeLine(line, quantity) {
    const drawer = $('[data-cart-drawer]');
    drawer?.classList.add('is-busy');
    try {
      const data = await postJSON(theme.routes.cartChange, { line, quantity, sections: drawerSectionId, sections_url: location.pathname });
      renderDrawer(data.sections);
      if (location.pathname === theme.routes.cart) location.reload();
    } catch (err) {
      toast(err.message);
    } finally {
      $('[data-cart-drawer]')?.classList.remove('is-busy');
    }
  }

  function initCart() {
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-product-form]');
      if (!form || theme.settings.cartType === undefined) return;
      e.preventDefault();
      addToCart(form);
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-toggle]') && theme.settings.cartType === 'drawer') {
        e.preventDefault(); openDrawer(); return;
      }
      if (e.target.closest('[data-drawer-close]')) { closeDrawer(); return; }

      const step = e.target.closest('[data-qty-change]');
      if (step) {
        const wrap = step.closest('[data-line]');
        const input = $('[data-qty-input]', wrap);
        changeLine(Number(wrap.dataset.line), Math.max(0, Number(input.value) + Number(step.dataset.qtyChange)));
        return;
      }
      const remove = e.target.closest('[data-line-remove]');
      if (remove) changeLine(Number(remove.dataset.lineRemove), 0);

      const qtyStep = e.target.closest('[data-qty-step]');
      if (qtyStep) {
        const input = $('input', qtyStep.parentElement);
        input.value = Math.max(1, Number(input.value) + Number(qtyStep.dataset.qtyStep));
      }
    });

    document.addEventListener('change', (e) => {
      const input = e.target.closest('[data-qty-input]');
      if (input) changeLine(Number(input.closest('[data-line]').dataset.line), Math.max(0, Number(input.value)));
      const auto = e.target.closest('[data-auto-submit]');
      if (auto) auto.form?.requestSubmit ? auto.form.requestSubmit() : auto.form?.submit();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.body.classList.contains('cart-open')) closeDrawer();
      const header = $('[data-header].is-open');
      if (header) $('[data-menu-toggle]', header)?.click();
    });
  }

  /* =========================================================
     Product page
     ========================================================= */
  function initProduct(root) {
    $$('[data-product]', root).forEach((section) => {
      const variants = JSON.parse($('[data-variants]', section)?.textContent || '[]');
      const picker = $('[data-variant-picker]', section);
      const idInput = $('[data-variant-id]', section);
      const addBtn = $('[data-add-button]', section);
      const addLabel = $('[data-add-label]', section);
      const priceWrap = $('[data-price-wrap] [data-price]', section);
      const mediaList = $('.product__media-list', section);

      const selected = () => $$('fieldset', picker).map((fs) => $('input:checked', fs)?.value);

      const markAvailability = () => {
        if (!picker) return;
        const current = selected();
        $$('fieldset', picker).forEach((fs, pos) => {
          $$('input', fs).forEach((input) => {
            const test = [...current]; test[pos] = input.value;
            const ok = variants.some((v) => v.available && v.options.every((o, i) => o === test[i]));
            input.nextElementSibling?.classList.toggle('is-unavailable', !ok);
          });
        });
      };

      const update = () => {
        const opts = selected();
        $$('fieldset', picker).forEach((fs, i) => { const v = $('[data-option-value]', fs); if (v) v.textContent = opts[i]; });
        const variant = variants.find((v) => v.options.every((o, i) => o === opts[i]));
        markAvailability();
        if (!variant) {
          addBtn.disabled = true; addLabel.textContent = theme.strings.unavailable; return;
        }
        idInput.value = variant.id;
        addBtn.disabled = !variant.available;
        addLabel.textContent = variant.available ? theme.strings.addToCart : theme.strings.soldOut;
        if (priceWrap) {
          priceWrap.classList.toggle('price--sale', !!variant.compare);
          priceWrap.innerHTML = `<span class="price__current">${variant.price}</span>` +
            (variant.compare ? `<s class="price__compare">${variant.compare}</s><span class="price__badge">-%${variant.discount}</span>` : '');
        }
        const url = new URL(location.href);
        url.searchParams.set('variant', variant.id);
        history.replaceState(null, '', url);
        if (variant.media && mediaList) {
          const media = $(`[data-media-id="${variant.media}"]`, mediaList);
          if (media) {
            $$('.product__media', mediaList).forEach((m) => m.classList.toggle('is-active', m === media));
            if (getComputedStyle(mediaList).display === 'flex') mediaList.scrollTo({ left: media.offsetLeft - mediaList.offsetLeft, behavior: motion() ? 'smooth' : 'auto' });
            else if (media.getBoundingClientRect().top < 0 || media.getBoundingClientRect().top > innerHeight) media.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'start' });
          }
        }
      };
      picker?.addEventListener('change', update);
      markAvailability();

      // gallery: one photo at a time, dots and arrows follow the scroll position
      const dots = $$('.product__dots i', section);
      const prevBtn = $('[data-gallery-prev]', section);
      const nextBtn = $('[data-gallery-next]', section);
      if (mediaList) {
        const sync = () => {
          const i = Math.round(mediaList.scrollLeft / (mediaList.clientWidth || 1));
          dots.forEach((d, j) => d.classList.toggle('is-active', i === j));
          if (prevBtn) prevBtn.disabled = mediaList.scrollLeft <= 4;
          if (nextBtn) nextBtn.disabled = mediaList.scrollLeft >= mediaList.scrollWidth - mediaList.clientWidth - 4;
        };
        const go = (dir) => mediaList.scrollBy({ left: dir * mediaList.clientWidth, behavior: motion() ? 'smooth' : 'auto' });
        prevBtn?.addEventListener('click', () => go(-1));
        nextBtn?.addEventListener('click', () => go(1));
        mediaList.addEventListener('scroll', sync, { passive: true });
        addEventListener('resize', sync, { passive: true });
        sync();
      }

      // full-screen view: tap a photo; swipe, arrows or keyboard to move; Esc, X or the empty area to close
      const box = $('[data-lightbox]', section);
      if (box && mediaList && box.showModal) {
        const track = $('[data-lightbox-track]', box);
        const step = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: motion() ? 'smooth' : 'auto' });
        mediaList.addEventListener('click', (e) => {
          const media = e.target.closest('.product__media');
          const slide = media && $(`[data-media-id="${media.dataset.mediaId}"]`, track);
          if (!slide) return;
          box.showModal();
          html.style.overflow = 'hidden';
          requestAnimationFrame(() => track.scrollTo({ left: slide.offsetLeft, behavior: 'auto' }));
        });
        box.addEventListener('close', () => { html.style.overflow = ''; });
        $('[data-lightbox-close]', box).addEventListener('click', () => box.close());
        $('[data-lightbox-prev]', box)?.addEventListener('click', () => step(-1));
        $('[data-lightbox-next]', box)?.addEventListener('click', () => step(1));
        track.addEventListener('click', (e) => { if (e.target.classList.contains('lightbox__slide')) box.close(); });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') step(-1);
          if (e.key === 'ArrowRight') step(1);
        });
      }

      // sticky add-to-cart bar appears once the main button scrolls out of view
      const sticky = $('[data-sticky-atc]');
      if (sticky && addBtn && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          const show = !e.isIntersecting && e.boundingClientRect.top < 0;
          sticky.classList.toggle('is-visible', show);
          sticky.setAttribute('aria-hidden', !show);
          $('[data-sticky-atc-button]', sticky).tabIndex = show ? 0 : -1;
        }).observe(addBtn);
        $('[data-sticky-atc-button]', sticky).addEventListener('click', () => {
          if (addBtn.disabled) { addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
          addBtn.closest('form').requestSubmit();
        });
      }
    });
  }

  async function initRecommendations(root) {
    for (const el of $$('[data-recommendations]', root)) {
      if (el.dataset.loaded) continue;
      el.dataset.loaded = '1';
      try {
        const res = await fetch(el.dataset.url);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const fresh = $('[data-recommendations]', doc);
        if (fresh && fresh.innerHTML.trim()) { el.innerHTML = fresh.innerHTML; initAll(el); }
      } catch (e) {}
    }
  }

  /* ---------- Collection filters submit on change ---------- */
  function initFilters(root) {
    $$('[data-filter-form]', root).forEach((form) => {
      form.addEventListener('submit', (e) => {
        // drop empty price inputs so the URL stays clean
        $$('input[type="number"]', form).forEach((i) => { if (!i.value) i.disabled = true; });
      });
      $$('input[type="checkbox"]', form).forEach((i) => i.addEventListener('change', () => form.requestSubmit()));
    });
  }

  /* ---------- Boot ---------- */
  function initAll(root = document) {
    initReveal(root);
    initScrub(root);
    initParallax(root);
    initMarqueeBoost(root);
    initMagnetic(root);
    initSlideshow(root);
    initLift(root);
    initSwap(root);
    initTilt(root);
    initDragScroll(root);
    initHoverReveal(root);
    initLookbook(root);
    initFooterBig(root);
    initProduct(root);
    initRecommendations(root);
    initFilters(root);
    requestScroll();
  }

  function boot() {
    initPreloader();
    initHeader();
    initScrollProgress();
    initCursor();
    initCart();
    initAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  /* ---------- Theme editor support ---------- */
  document.addEventListener('shopify:section:load', (e) => {
    initAll(e.target);
    if (e.target.querySelector('[data-header]')) initHeader();
  });
  document.addEventListener('shopify:block:select', (e) => {
    const look = e.target.closest('[data-lookbook]');
    if (look && !look.classList.contains('is-pinned')) e.target.scrollIntoView({ inline: 'center', block: 'nearest' });
  });

  window.Atelier = { openDrawer, closeDrawer, toast };
})();
