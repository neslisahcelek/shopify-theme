/* =========================================================
   Style Vibeus — Interactive 3D Hanger Rack Controller
   4-Stage SNUG WRLD Physics:
   1. Tightly packed 3D side-profile rail (rotateY ±52deg)
   2. 60fps spring-pendulum riffle sway (stiffness 0.14, damping 0.82)
   3. Hover/dwell 3D turn-to-front (rotateY 0deg, scale 1.34, part neighbors)
   4. Click-to-Inspect Mode (FRONT/BACK 180deg 3D flip, hangtag, size pills, ATC)
   ========================================================= */
(() => {
  'use strict';

  const RACK_SELECTOR = '[data-hanger-rack]';
  const instances = new WeakMap();

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const prefersReducedMotion = () =>
    Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const STIFFNESS = 0.14;
  const DAMPING = 0.82;

  function parseVariants(item) {
    const script = item.querySelector('[data-rack-variants]');
    let raw = [];
    if (script) {
      try {
        raw = JSON.parse(script.textContent || '[]');
      } catch (_) {
        raw = [];
      }
    }
    const fallbackId = item.dataset.variantId || '';
    const fallbackPrice = item.dataset.price || '';
    const fallbackCompare = item.dataset.comparePrice || '';
    const fallbackAvail = item.dataset.available !== 'false';

    if (
      !raw.length ||
      (raw.length === 1 && (!raw[0].title || raw[0].title === 'Default Title'))
    ) {
      const base = raw[0] || {
        id: fallbackId,
        price: fallbackPrice,
        compare_at_price: fallbackCompare,
        available: fallbackAvail
      };
      return ['S', 'M', 'L', 'XL'].map((size) => ({
        id: base.id ?? fallbackId,
        label: size,
        available: Boolean(base.available),
        price: base.price || fallbackPrice,
        compare_at_price: base.compare_at_price || fallbackCompare
      }));
    }

    const sizeOptIdx = script ? parseInt(script.dataset.sizeOptionIndex || '0', 10) || 0 : 0;
    const baseVariant =
      raw.find((v) => String(v.id) === String(fallbackId)) ||
      raw.find((v) => v.available) ||
      raw[0];

    const matchesBaseContext = (v) => {
      if (!baseVariant || !Array.isArray(v.options) || !Array.isArray(baseVariant.options)) {
        return false;
      }
      return v.options.every((optVal, idx) => idx === sizeOptIdx || optVal === baseVariant.options[idx]);
    };

    const bySize = new Map();

    raw.forEach((v) => {
      const rawLabel =
        v.size ||
        (Array.isArray(v.options) && v.options[sizeOptIdx]) ||
        v.option1 ||
        v.title ||
        'OS';
      const label = String(rawLabel).trim() || 'OS';
      const key = label.toUpperCase();

      const candidate = {
        id: v.id ?? fallbackId,
        label,
        available: Boolean(v.available),
        price: v.price || fallbackPrice,
        compare_at_price: v.compare_at_price || fallbackCompare,
        _matchesBase: matchesBaseContext(v)
      };

      if (!bySize.has(key)) {
        bySize.set(key, candidate);
        return;
      }

      const existing = bySize.get(key);
      // Prefer available variant, or one that shares the featured variant's color/other options
      if (
        (!existing.available && candidate.available) ||
        (existing.available === candidate.available && !existing._matchesBase && candidate._matchesBase)
      ) {
        bySize.set(key, candidate);
      }
    });

    return [...bySize.values()].map(({ _matchesBase, ...clean }) => clean);
  }

  function initRack(root) {
    if (!root || instances.has(root)) return;

    const stageWrap = root.querySelector('[data-rack-stage]');
    const viewport = root.querySelector('[data-rack-viewport]');
    const items = [...root.querySelectorAll('[data-rack-item]')];
    if (!viewport || !items.length) return;

    const pendulums = items.map((item) => ({
      el: item.querySelector('[data-rack-pendulum]') || item,
      angleZ: 0,
      omegaZ: 0,
      angleY: 0,
      omegaY: 0,
      pushX: 0,
      velX: 0,
      tiltX: 0,
      tiltY: 0,
      targetTiltX: 0,
      targetTiltY: 0
    }));

    const prevBtn = root.querySelector('[data-rack-prev]');
    const nextBtn = root.querySelector('[data-rack-next]');
    const counterEl = root.querySelector('[data-rack-counter]');
    const dotsWrap = root.querySelector('[data-rack-dots]');
    const dots = dotsWrap ? [...dotsWrap.querySelectorAll('[data-rack-dot]')] : [];
    const autoplayBtn = root.querySelector('[data-rack-autoplay-btn]');

    const titleEl = root.querySelector('[data-rack-title]');
    const priceEl = root.querySelector('[data-rack-price]');
    const statusEl = root.querySelector('[data-rack-status]');
    const ctaEl = root.querySelector('[data-rack-cta]');
    const inspectOpenBtn = root.querySelector('[data-rack-inspect-open]');
    const inspectCloseBtn = root.querySelector('[data-rack-inspect-close]');
    const inspectBar = root.querySelector('[data-rack-inspect-bar]');
    const flipBtns = [...root.querySelectorAll('[data-flip-side]')];
    const sizesWrap = root.querySelector('[data-rack-sizes]');
    const atcForm = root.querySelector('[data-rack-atc-form]');
    const variantIdInput = root.querySelector('[data-rack-variant-id]');
    const atcBtn = root.querySelector('[data-rack-atc-btn]');
    const atcLabel = root.querySelector('[data-rack-atc-label]');
    const viewLink = root.querySelector('[data-rack-view-link]');

    const maxBlur = parseFloat(root.dataset.blurStrength || '4');
    const autoplayEnabled = root.dataset.autoplay === 'true' && !prefersReducedMotion();

    const midIndex = (items.length - 1) / 2;
    const initialIndex = items.length <= 2 ? 0 : Math.min(Math.floor(items.length / 2), items.length - 1);

    const state = {
      index: initialIndex,
      floatIndex: initialIndex,
      inspecting: false,
      flipSide: 'front',
      isRiffling: false,
      riffleTimer: null,
      dragging: false,
      pointerId: null,
      dragMoved: false,
      startX: 0,
      startFloat: initialIndex,
      lastX: 0,
      lastTime: 0,
      velocity: 0,
      hoverLastX: null,
      hoverLastTime: 0,
      rafId: null,
      autoplayPaused: false,
      autoplayTimer: null,
      cardWidth: items[0].offsetWidth || 230,
      viewportRect: viewport.getBoundingClientRect(),
      isMobile: window.innerWidth < 750
    };

    function getStep() {
      if (state.isMobile) {
        return clamp(Math.round(state.cardWidth * 0.44), 76, 102);
      }
      return clamp(Math.round(state.cardWidth * 0.5), 112, 142);
    }

    function getAnchor(pos = state.floatIndex) {
      if (state.isMobile) return pos;
      if (state.inspecting) {
        return midIndex * 0.35 + pos * 0.65;
      }
      const panWeight = items.length > 8 ? 0.42 : 0.22;
      return midIndex * (1 - panWeight) + pos * panWeight;
    }

    function measure() {
      if (items[0]) {
        state.cardWidth = items[0].offsetWidth || 230;
      }
      state.isMobile = window.innerWidth < 750;
      state.viewportRect = viewport.getBoundingClientRect();
      render(state.floatIndex);
    }

    function render(pos = state.floatIndex) {
      const step = getStep();
      const anchor = getAnchor(pos);
      const activeIdx = state.index;
      const inspecting = state.inspecting;
      const riffling = state.isRiffling && !inspecting && !state.isMobile;

      const partGap = inspecting
        ? state.isMobile
          ? 88
          : 132
        : riffling
          ? 24
          : state.isMobile
            ? 64
            : 96;

      items.forEach((item, i) => {
        const isFocused = i === activeIdx && !state.dragging;
        const relToActive = i - pos;
        const absDist = Math.abs(relToActive);
        const sign = relToActive < 0 ? -1 : 1;

        // Base tightly-packed rail slot + neighbor parting around the focused garment
        let tx = (i - anchor) * step;
        if (absDist > 0.05) {
          const partStrength = Math.min(1, absDist);
          tx += sign * partGap * partStrength;
        }

        let rotY = 0;
        let scale = 1;
        let tz = 0;
        let ty = 0;
        let blur = 0;
        let opacity = 1;

        if (isFocused && !riffling) {
          // Stage 3 / Stage 4: Focused garment turns to face front & scales up
          rotY = 0;
          scale = inspecting ? (state.isMobile ? 1.26 : 1.42) : state.isMobile ? 1.2 : 1.34;
          tz = inspecting ? 110 : 80;
          ty = inspecting ? 4 : 2;
          blur = 0;
          opacity = 1;
        } else {
          // Stage 1: Side-profile garments hanging along the boutique rail
          const baseAngle = state.isMobile ? 46 : 52;
          if (isFocused && riffling) {
            rotY = state.velocity < 0 ? 34 : -34;
            scale = 1.04;
            tz = 28;
            blur = 0;
            opacity = 0.96;
          } else {
            rotY = sign < 0 ? baseAngle : -baseAngle;
            scale = inspecting
              ? Math.max(0.56, 0.72 - (absDist - 1) * 0.06)
              : Math.max(0.62, 0.78 - (absDist - 1) * 0.055);
            tz = -Math.min(90, absDist * 22);
            ty = Math.min(10, absDist * 2);
            blur = inspecting
              ? Math.min(maxBlur * 1.6, 5.5 + (absDist - 1) * 0.8)
              : Math.min(maxBlur * 1.4, Math.max(2.8, maxBlur * (0.82 + (absDist - 1) * 0.22)));
            opacity = inspecting
              ? Math.max(0.14, 0.28 - (absDist - 1) * 0.05)
              : absDist > 4.5
                ? 0
                : Math.max(0.24, 0.56 - (absDist - 1) * 0.08);
          }
        }

        const zIndex = isFocused ? 40 : Math.max(1, 30 - Math.round(absDist * 4));
        const flipDeg = isFocused && state.flipSide === 'back' ? 180 : 0;

        item.style.setProperty('--hr-tx', `${tx.toFixed(1)}px`);
        item.style.setProperty('--hr-ty', `${ty.toFixed(1)}px`);
        item.style.setProperty('--hr-tz', `${tz.toFixed(1)}px`);
        item.style.setProperty('--hr-rot-y', `${rotY.toFixed(1)}deg`);
        item.style.setProperty('--hr-scale', scale.toFixed(3));
        item.style.setProperty('--hr-blur', `${blur.toFixed(2)}px`);
        item.style.setProperty('--hr-opacity', opacity.toFixed(3));
        item.style.setProperty('--hr-z', String(zIndex));
        item.style.setProperty('--hr-flip-y', `${flipDeg}deg`);

        item.classList.toggle('is-active', isFocused);
        item.classList.toggle('is-flipped', isFocused && state.flipSide === 'back');
        item.setAttribute('aria-hidden', absDist > 3.5 ? 'true' : 'false');

        const backFace = item.querySelector('.hanger-rack__face--back');
        const frontFace = item.querySelector('.hanger-rack__face--front');
        if (backFace && frontFace) {
          const isBack = isFocused && state.flipSide === 'back';
          backFace.setAttribute('aria-hidden', isBack ? 'false' : 'true');
          frontFace.setAttribute('aria-hidden', isBack ? 'true' : 'false');
        }
      });
    }

    // ---------- Stage 2: 60fps Spring-Damper Pendulum Loop ----------
    function applyImpulse(index, vx, boost = 1) {
      if (prefersReducedMotion()) return;
      const clampedVx = clamp(vx, -3.2, 3.2);
      const dir = clampedVx === 0 ? 1 : Math.sign(clampedVx);
      const mag = Math.max(0.45, Math.abs(clampedVx));

      const baseOmegaZ = clamp(-dir * mag * 3.8 * boost, -9.5, 9.5);
      const baseOmegaY = clamp(dir * mag * 3.1 * boost, -7.5, 7.5);
      const baseVelX = clamp(dir * mag * 4.2 * boost, -10, 10);

      const hit = (idx, factor) => {
        if (idx < 0 || idx >= pendulums.length) return;
        const p = pendulums[idx];
        p.omegaZ = clamp(p.omegaZ + baseOmegaZ * factor, -14, 14);
        p.omegaY = clamp(p.omegaY + baseOmegaY * factor, -12, 12);
        p.velX = clamp(p.velX + baseVelX * factor, -16, 16);
      };

      hit(index, 1);
      hit(index - 1, 0.38);
      hit(index + 1, 0.38);
      hit(index - 2, 0.14);
      hit(index + 2, 0.14);

      startPhysicsLoop();
    }

    function startPhysicsLoop() {
      if (state.rafId !== null || prefersReducedMotion()) return;
      state.rafId = requestAnimationFrame(tickPhysics);
    }

    function tickPhysics() {
      let totalEnergy = 0;

      for (let i = 0; i < pendulums.length; i++) {
        const p = pendulums[i];
        const item = items[i];

        p.omegaZ = (p.omegaZ - p.angleZ * STIFFNESS) * DAMPING;
        p.angleZ = clamp(p.angleZ + p.omegaZ, -14, 14);

        p.omegaY = (p.omegaY - p.angleY * STIFFNESS) * DAMPING;
        p.angleY = clamp(p.angleY + p.omegaY, -12, 12);

        p.velX = (p.velX - p.pushX * 0.16) * 0.8;
        p.pushX = clamp(p.pushX + p.velX, -18, 18);

        p.tiltX += (p.targetTiltX - p.tiltX) * 0.18;
        p.tiltY += (p.targetTiltY - p.tiltY) * 0.18;

        const zStr = `${p.angleZ.toFixed(2)}deg`;
        const yStr = `${p.angleY.toFixed(2)}deg`;
        const pxStr = `${p.pushX.toFixed(1)}px`;
        const txStr = `${p.tiltX.toFixed(2)}deg`;
        const tyStr = `${p.tiltY.toFixed(2)}deg`;

        item.style.setProperty('--hr-sway-z', zStr);
        item.style.setProperty('--hr-sway-y', yStr);
        item.style.setProperty('--hr-push-x', pxStr);
        item.style.setProperty('--hr-tilt-x', txStr);
        item.style.setProperty('--hr-tilt-y', tyStr);

        p.el.style.transform = `translate3d(${pxStr}, 0, 0) rotateZ(${zStr}) rotateY(${(
          p.angleY + p.tiltY
        ).toFixed(2)}deg) rotateX(${txStr})`;

        totalEnergy +=
          Math.abs(p.angleZ) +
          Math.abs(p.omegaZ) +
          Math.abs(p.angleY) +
          Math.abs(p.omegaY) +
          Math.abs(p.pushX) +
          Math.abs(p.velX) +
          Math.abs(p.targetTiltX - p.tiltX) +
          Math.abs(p.targetTiltY - p.tiltY);
      }

      if (totalEnergy > 0.03) {
        state.rafId = requestAnimationFrame(tickPhysics);
      } else {
        for (let i = 0; i < pendulums.length; i++) {
          const p = pendulums[i];
          const item = items[i];
          p.angleZ = 0;
          p.omegaZ = 0;
          p.angleY = 0;
          p.omegaY = 0;
          p.pushX = 0;
          p.velX = 0;
          item.style.setProperty('--hr-sway-z', '0deg');
          item.style.setProperty('--hr-sway-y', '0deg');
          item.style.setProperty('--hr-push-x', '0px');
          p.el.style.transform = `translate3d(0px, 0, 0) rotateZ(0deg) rotateY(${p.tiltY.toFixed(
            2
          )}deg) rotateX(${p.tiltX.toFixed(2)}deg)`;
        }
        state.rafId = null;
      }
    }

    // ---------- Product Details & Variant Pills ----------
    function renderSizePills(activeItem) {
      if (!sizesWrap || !activeItem) return;
      const variants = parseVariants(activeItem);
      sizesWrap.innerHTML = '';

      let defaultIdx = variants.findIndex((v) => v.available && v.label === 'M');
      if (defaultIdx === -1) defaultIdx = variants.findIndex((v) => v.available);
      if (defaultIdx === -1) defaultIdx = 0;

      variants.forEach((v, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hanger-rack__size-pill';
        if (idx === defaultIdx) btn.classList.add('is-selected');
        if (!v.available) btn.classList.add('is-unavailable');
        btn.textContent = v.label;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', idx === defaultIdx ? 'true' : 'false');
        btn.dataset.variantId = String(v.id || '');
        btn.dataset.variantPrice = v.price || '';
        btn.dataset.variantCompare = v.compare_at_price || '';
        btn.dataset.variantAvailable = String(v.available);

        btn.addEventListener('click', () => {
          [...sizesWrap.querySelectorAll('.hanger-rack__size-pill')].forEach((pill) => {
            const isSel = pill === btn;
            pill.classList.toggle('is-selected', isSel);
            pill.setAttribute('aria-checked', isSel ? 'true' : 'false');
          });
          syncSelectedVariant(v, activeItem);
        });

        sizesWrap.appendChild(btn);
      });

      if (variants[defaultIdx]) {
        syncSelectedVariant(variants[defaultIdx], activeItem);
      }
    }

    function syncSelectedVariant(variant, activeItem) {
      if (variantIdInput) {
        variantIdInput.value = variant.id ? String(variant.id) : '';
      }
      if (priceEl && variant.price) {
        if (variant.compare_at_price) {
          priceEl.innerHTML = `<span>${variant.price}</span><s>${variant.compare_at_price}</s>`;
        } else {
          priceEl.textContent = variant.price;
        }
      }
      if (atcBtn && atcLabel) {
        const isAvail = Boolean(variant.available);
        atcBtn.disabled = !isAvail;
        atcLabel.textContent = isAvail
          ? 'ADD TO CART'
          : activeItem.dataset.soldOutLabel || 'SOLD OUT';
      }
    }

    function updateDetails() {
      const active = items[state.index];
      if (!active) return;

      const {
        title = '',
        price = '',
        comparePrice = '',
        url = '#',
        available = 'true',
        onSale = 'false',
        saleLabel = 'SALE',
        soldOutLabel = 'SOLD OUT'
      } = active.dataset;

      if (titleEl) titleEl.textContent = title;

      if (priceEl) {
        if (comparePrice && onSale === 'true') {
          priceEl.innerHTML = `<span>${price}</span><s>${comparePrice}</s>`;
        } else {
          priceEl.textContent = price;
        }
      }

      if (statusEl) {
        if (available === 'false') {
          statusEl.textContent = soldOutLabel;
          statusEl.className = 'hanger-rack__status hanger-rack__status--soldout';
          statusEl.hidden = false;
        } else if (onSale === 'true') {
          statusEl.textContent = saleLabel;
          statusEl.className = 'hanger-rack__status hanger-rack__status--sale';
          statusEl.hidden = false;
        } else {
          statusEl.hidden = true;
        }
      }

      if (viewLink) {
        viewLink.setAttribute('href', url && url !== '#' ? url : '#');
      }

      if (counterEl) {
        counterEl.textContent = `${state.index + 1} / ${items.length}`;
      }

      if (prevBtn) prevBtn.disabled = state.index <= 0;
      if (nextBtn) nextBtn.disabled = state.index >= items.length - 1;

      dots.forEach((dot, i) => {
        const isCurrent = i === state.index;
        dot.classList.toggle('is-active', isCurrent);
        dot.setAttribute('aria-current', isCurrent ? 'true' : 'false');
      });

      renderSizePills(active);
    }

    function setFlipSide(side) {
      const nextSide = side === 'back' ? 'back' : 'front';
      if (state.flipSide !== nextSide) {
        state.flipSide = nextSide;
        applyImpulse(state.index, nextSide === 'back' ? 0.9 : -0.9, 0.7);
      }
      flipBtns.forEach((btn) => {
        const isCurrent = btn.dataset.flipSide === state.flipSide;
        btn.classList.toggle('is-active', isCurrent);
        btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      });
      render(state.floatIndex);
    }

    function setInspectMode(enabled) {
      const nextState = Boolean(enabled);
      if (state.inspecting === nextState) return;
      state.inspecting = nextState;
      state.isRiffling = false;
      if (!nextState) {
        state.flipSide = 'front';
        flipBtns.forEach((btn) => {
          const isFront = btn.dataset.flipSide === 'front';
          btn.classList.toggle('is-active', isFront);
          btn.setAttribute('aria-pressed', isFront ? 'true' : 'false');
        });
      } else {
        stopAutoplay();
      }
      root.classList.toggle('is-inspecting', nextState);
      if (inspectBar) {
        inspectBar.setAttribute('aria-hidden', nextState ? 'false' : 'true');
      }
      applyImpulse(state.index, nextState ? 0.8 : -0.6, 0.65);
      render(state.floatIndex);
    }

    function goTo(targetIndex, wrap = false, impulseVx = 0) {
      let next = targetIndex;
      if (wrap) {
        next = (targetIndex + items.length) % items.length;
      } else {
        next = clamp(targetIndex, 0, items.length - 1);
      }
      const changed = next !== state.index;
      const dir = next > state.index ? 1 : -1;
      state.index = next;
      state.floatIndex = next;
      if (changed) {
        state.flipSide = 'front';
        flipBtns.forEach((btn) => {
          const isFront = btn.dataset.flipSide === 'front';
          btn.classList.toggle('is-active', isFront);
          btn.setAttribute('aria-pressed', isFront ? 'true' : 'false');
        });
        pendulums.forEach((p, idx) => {
          if (idx !== next) {
            p.targetTiltX = 0;
            p.targetTiltY = 0;
          }
        });
        applyImpulse(next, impulseVx || dir * 0.95, 0.85);
      }
      render(state.floatIndex);
      if (changed) updateDetails();
    }

    // ---------- Desktop Mouse Riffle & Hover-to-Focus ----------
    function findHoveredRailIndex(clientX) {
      const rect = viewport.getBoundingClientRect();
      const relX = clientX - (rect.left + rect.width / 2);
      const step = getStep();
      const anchor = getAnchor(state.floatIndex);

      let closestIdx = state.index;
      let minDist = Infinity;

      for (let i = 0; i < items.length; i++) {
        const baseSlotX = (i - anchor) * step;
        const dist = Math.abs(relX - baseSlotX);
        // 14px hysteresis preference for currently active item to prevent boundary flicker
        const adjustedDist = i === state.index ? Math.max(0, dist - 14) : dist;
        if (adjustedDist < minDist) {
          minDist = adjustedDist;
          closestIdx = i;
        }
      }
      return closestIdx;
    }

    function onDesktopHoverMove(e) {
      if (state.dragging || e.pointerType === 'touch') return;

      const now = performance.now();
      const dt = state.hoverLastTime ? Math.max(4, now - state.hoverLastTime) : 16;
      const dx = state.hoverLastX !== null ? e.clientX - state.hoverLastX : 0;
      const vx = clamp(dx / dt, -3.2, 3.2);

      state.hoverLastX = e.clientX;
      state.hoverLastTime = now;
      state.velocity = vx;

      // Subtle 3D tilt on active garment toward pointer
      const activeEl = items[state.index];
      if (activeEl && pendulums[state.index]) {
        const r = activeEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.7), -1, 1);
          const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.7), -1, 1);
          pendulums[state.index].targetTiltY = nx * 7.5;
          pendulums[state.index].targetTiltX = -ny * 5.5;
          startPhysicsLoop();
        }
      }

      // In Inspect Mode, sway the inspected garment gently on pointer movement without switching items
      if (state.inspecting) {
        if (Math.abs(vx) > 0.15) {
          applyImpulse(state.index, vx * 0.5, 0.35);
        }
        return;
      }

      const hoveredIdx = findHoveredRailIndex(e.clientX);

      // Fast sweep across the rail triggers Stage 1/2 tight side-profile riffle
      if (Math.abs(vx) > 1.05) {
        state.isRiffling = true;
        clearTimeout(state.riffleTimer);
        state.riffleTimer = setTimeout(() => {
          state.isRiffling = false;
          render(state.floatIndex);
        }, 70);
      }

      if (hoveredIdx !== state.index) {
        goTo(hoveredIdx, false, vx);
      } else if (Math.abs(vx) > 0.18) {
        applyImpulse(hoveredIdx, vx * 0.55, 0.32);
      }
    }

    function onViewportLeave() {
      state.hoverLastX = null;
      state.hoverLastTime = 0;
      if (state.isRiffling) {
        state.isRiffling = false;
        render(state.floatIndex);
      }
      pendulums.forEach((p) => {
        p.targetTiltX = 0;
        p.targetTiltY = 0;
      });
      startPhysicsLoop();
    }

    // ---------- Pointer Drag / Touch Scrub ----------
    function onPointerDown(e) {
      if (state.dragging) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('button, input, select, textarea')) return;

      state.dragging = true;
      state.pointerId = e.pointerId;
      state.dragMoved = false;
      state.startX = e.clientX;
      state.lastX = e.clientX;
      state.lastTime = performance.now();
      state.startFloat = state.floatIndex;
      state.velocity = 0;
      viewport.classList.add('is-dragging');
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    function onPointerMove(e) {
      if (!state.dragging) {
        onDesktopHoverMove(e);
        return;
      }
      if (e.pointerId !== state.pointerId) return;

      const now = performance.now();
      const dt = Math.max(4, now - state.lastTime);
      const dx = e.clientX - state.startX;
      const stepDx = e.clientX - state.lastX;

      if (Math.abs(dx) > 6) state.dragMoved = true;
      state.velocity = clamp(stepDx / dt, -3.2, 3.2);
      state.lastX = e.clientX;
      state.lastTime = now;

      const step = Math.max(85, getStep());
      const rawFloat = state.startFloat - dx / step;

      if (rawFloat < 0) {
        state.floatIndex = rawFloat * 0.25;
      } else if (rawFloat > items.length - 1) {
        state.floatIndex = items.length - 1 + (rawFloat - (items.length - 1)) * 0.25;
      } else {
        state.floatIndex = rawFloat;
      }

      const nearest = clamp(Math.round(state.floatIndex), 0, items.length - 1);
      if (nearest !== state.index) {
        state.index = nearest;
        updateDetails();
        applyImpulse(nearest, state.velocity, 0.9);
      } else if (Math.abs(state.velocity) > 0.2) {
        applyImpulse(nearest, state.velocity * 0.6, 0.4);
      }

      render(state.floatIndex);
    }

    function onPointerUp(e) {
      if (!state.dragging || e.pointerId !== state.pointerId) return;
      state.dragging = false;
      state.pointerId = null;
      viewport.classList.remove('is-dragging');
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const idleMs = performance.now() - state.lastTime;
      const effectiveVelocity = idleMs > 120 ? 0 : state.velocity;
      const momentum = -effectiveVelocity * 0.32;
      const snapped = clamp(Math.round(state.floatIndex + momentum), 0, items.length - 1);
      goTo(snapped, false, effectiveVelocity);

      if (state.dragMoved) {
        const suppressClick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        viewport.addEventListener('click', suppressClick, { capture: true, once: true });
        setTimeout(() => viewport.removeEventListener('click', suppressClick, { capture: true }), 80);
      }
    }

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('pointerleave', onViewportLeave);

    // ---------- Stage 4: Click Garment or CTA to Inspect ----------
    items.forEach((item, i) => {
      const link = item.querySelector('[data-rack-link]');
      if (!link) return;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (i !== state.index) {
          if (state.inspecting) setInspectMode(false);
          goTo(i);
        } else {
          setInspectMode(!state.inspecting);
        }
      });
    });

    if (inspectOpenBtn) {
      inspectOpenBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setInspectMode(true);
      });
    } else if (ctaEl) {
      ctaEl.addEventListener('click', (e) => {
        e.preventDefault();
        setInspectMode(true);
      });
    }

    if (inspectCloseBtn) {
      inspectCloseBtn.addEventListener('click', () => {
        setInspectMode(false);
      });
    }

    flipBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setFlipSide(btn.dataset.flipSide);
      });
    });

    // Fallback submit handler when placeholder product has no real Shopify variant ID
    if (atcForm) {
      atcForm.addEventListener(
        'submit',
        (e) => {
          const val = variantIdInput ? variantIdInput.value.trim() : '';
          if (!val) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const active = items[state.index];
            const targetUrl = active?.dataset.url || '/collections/all';
            window.location.href = targetUrl;
          }
        },
        true
      );
    }

    // Prev / Next
    if (prevBtn) prevBtn.addEventListener('click', () => goTo(state.index - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(state.index + 1));

    // Dots
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => goTo(i));
    });

    // Keyboard navigation & Escape from Inspect Mode
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.inspecting) {
        e.preventDefault();
        setInspectMode(false);
        stageWrap?.focus();
      }
    });

    if (stageWrap) {
      stageWrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goTo(state.index - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goTo(state.index + 1);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setInspectMode(!state.inspecting);
        }
      });
    }

    // Autoplay with accessible pause/play
    function startAutoplay() {
      stopAutoplay();
      if (!autoplayEnabled || state.autoplayPaused || state.inspecting || items.length < 2) return;
      state.autoplayTimer = setInterval(() => {
        goTo(state.index + 1, true);
      }, 4200);
    }

    function stopAutoplay() {
      if (state.autoplayTimer) {
        clearInterval(state.autoplayTimer);
        state.autoplayTimer = null;
      }
    }

    if (autoplayBtn) {
      autoplayBtn.addEventListener('click', () => {
        state.autoplayPaused = !state.autoplayPaused;
        autoplayBtn.setAttribute(
          'aria-label',
          state.autoplayPaused
            ? autoplayBtn.dataset.playLabel || 'Play'
            : autoplayBtn.dataset.pauseLabel || 'Pause'
        );
        const pauseIcon = autoplayBtn.querySelector('[data-icon-pause]');
        const playIcon = autoplayBtn.querySelector('[data-icon-play]');
        if (pauseIcon) pauseIcon.hidden = state.autoplayPaused;
        if (playIcon) playIcon.hidden = !state.autoplayPaused;
        if (state.autoplayPaused) stopAutoplay();
        else startAutoplay();
      });
    }

    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);
    root.addEventListener('focusin', stopAutoplay);
    root.addEventListener('focusout', startAutoplay);

    const onResize = () => measure();
    window.addEventListener('resize', onResize, { passive: true });

    // Initial render
    measure();
    updateDetails();
    startAutoplay();

    instances.set(root, {
      destroy() {
        stopAutoplay();
        clearTimeout(state.riffleTimer);
        if (state.rafId !== null) {
          cancelAnimationFrame(state.rafId);
          state.rafId = null;
        }
        window.removeEventListener('resize', onResize);
      }
    });
  }

  function initAll(scope = document) {
    scope.querySelectorAll(RACK_SELECTOR).forEach(initRack);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (e) => {
    initAll(e.target);
  });

  document.addEventListener('shopify:section:unload', (e) => {
    const rack = e.target.querySelector(RACK_SELECTOR);
    if (rack && instances.has(rack)) {
      instances.get(rack).destroy();
      instances.delete(rack);
    }
  });
})();
