/* Anne Keyfi Buy-Box: Variant Swatches, Gallery, Quantity, AJAX Cart & Sticky ATC */
(() => {
  const roots = document.querySelectorAll('[data-ak-buybox]');
  if (!roots.length) return;

  roots.forEach((root) => {
    const variantsEl = root.querySelector('[data-ak-variants-json]');
    const variants = variantsEl ? JSON.parse(variantsEl.textContent || '[]') : [];
    const mainImg = root.querySelector('[data-ak-main-img]');
    const demoSvgBody = root.querySelector('[data-ak-demo-pillow]');
    const demoSvgArms = root.querySelectorAll('[data-ak-demo-arm]');
    const thumbBtns = root.querySelectorAll('[data-ak-thumb]');
    const swatchBtns = root.querySelectorAll('[data-ak-swatch]');
    const activeColorName = root.querySelector('[data-ak-active-color]');
    const stickyColorName = root.querySelector('[data-ak-sticky-color]');
    const priceEl = root.querySelector('[data-ak-price]');
    const compareEl = root.querySelector('[data-ak-compare]');
    const stickyPriceEl = root.querySelector('[data-ak-sticky-price]');
    const variantInput = root.querySelector('input[name="id"]');
    const submitBtn = root.querySelector('[data-ak-submit]');
    const stickySubmitBtn = root.querySelector('[data-ak-sticky-submit]');
    const qtyInput = root.querySelector('input[name="quantity"]');
    const qtyMinus = root.querySelector('[data-ak-qty-minus]');
    const qtyPlus = root.querySelector('[data-ak-qty-plus]');
    const packBtns = root.querySelectorAll('[data-ak-pack]');
    const form = root.querySelector('form[data-ak-form]');
    const feedback = root.querySelector('[data-ak-feedback]');
    const stickyBar = root.querySelector('[data-ak-sticky-bar]');

    const selectedOptions = {};
    swatchBtns.forEach((btn) => {
      if (btn.classList.contains('is-active')) {
        selectedOptions[btn.dataset.optionIndex] = btn.dataset.value;
      }
    });

    const formatMoney = (cents) => {
      if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
        return Shopify.formatMoney(cents, root.dataset.moneyFormat || '{{amount}} TL');
      }
      return (cents / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
    };

    const updateGallery = (src, alt) => {
      if (!mainImg || !src) return;
      mainImg.src = src;
      if (alt) mainImg.alt = alt;
      thumbBtns.forEach((t) => {
        t.classList.toggle('is-active', t.dataset.src === src);
      });
    };

    thumbBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        updateGallery(btn.dataset.src, btn.dataset.alt);
      });
    });

    const syncVariant = () => {
      if (!variants.length) return;
      const match = variants.find((v) =>
        v.options.every((opt, idx) => !selectedOptions[idx] || selectedOptions[idx] === opt)
      );
      if (!match) return;

      if (variantInput) variantInput.value = match.id;
      if (priceEl) priceEl.textContent = formatMoney(match.price);
      if (stickyPriceEl) stickyPriceEl.textContent = formatMoney(match.price);

      if (compareEl) {
        if (match.compare_at_price && match.compare_at_price > match.price) {
          compareEl.textContent = formatMoney(match.compare_at_price);
          compareEl.hidden = false;
        } else {
          compareEl.hidden = true;
        }
      }

      if (match.featured_image && match.featured_image.src) {
        updateGallery(match.featured_image.src, match.featured_image.alt || '');
      }

      const soldOutLabel = root.dataset.soldOutText || 'Tükendi';
      const addLabel = root.dataset.addText || 'Sepete Ekle';
      if (submitBtn) {
        submitBtn.disabled = !match.available;
        submitBtn.textContent = match.available ? addLabel : soldOutLabel;
      }
      if (stickySubmitBtn) {
        stickySubmitBtn.disabled = !match.available;
        stickySubmitBtn.textContent = match.available ? addLabel : soldOutLabel;
      }
    };

    swatchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.optionIndex || '0';
        const val = btn.dataset.value || '';
        const hex = btn.dataset.hex || '';
        selectedOptions[idx] = val;

        root.querySelectorAll(`[data-ak-swatch][data-option-index="${idx}"]`).forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        if (activeColorName) activeColorName.textContent = val;
        if (stickyColorName) stickyColorName.textContent = val;

        if (demoSvgBody && hex) {
          demoSvgBody.setAttribute('fill', hex);
          demoSvgArms.forEach((arm) => arm.setAttribute('fill', hex));
        }

        syncVariant();
      });
    });

    const syncPack = (qty) => {
      packBtns.forEach((p) => {
        const active = parseInt(p.dataset.akPack || '1', 10) === qty;
        p.classList.toggle('is-active', active);
        p.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    packBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetQty = parseInt(btn.dataset.akPack || '1', 10);
        if (qtyInput) qtyInput.value = String(targetQty);
        syncPack(targetQty);
      });
    });

    if (qtyMinus && qtyInput) {
      qtyMinus.addEventListener('click', () => {
        const current = parseInt(qtyInput.value || '1', 10);
        const next = Math.max(1, current - 1);
        qtyInput.value = String(next);
        syncPack(next);
      });
    }
    if (qtyPlus && qtyInput) {
      qtyPlus.addEventListener('click', () => {
        const current = parseInt(qtyInput.value || '1', 10);
        const next = Math.min(20, current + 1);
        qtyInput.value = String(next);
        syncPack(next);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        if (!variantInput || !variantInput.value) {
          e.preventDefault();
          if (feedback) {
            feedback.hidden = false;
            feedback.textContent = 'Önizleme modu: Shopify Admin üzerinden ürün eklendiğinde sepet aktif olur.';
          }
          return;
        }

        e.preventDefault();
        const originalText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Ekleniyor...';
        }

        try {
          const cartDrawer = document.querySelector('cart-drawer');
          const formData = new FormData(form);
          if (cartDrawer && typeof cartDrawer.getSectionsToRender === 'function') {
            formData.append(
              'sections',
              cartDrawer.getSectionsToRender().map((s) => s.id).join(',')
            );
            formData.append('sections_url', window.location.pathname);
          }

          const res = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.description || data.message || 'Sepete eklenemedi.');
          }

          if (cartDrawer && typeof cartDrawer.renderContents === 'function') {
            cartDrawer.classList.remove('is-empty');
            cartDrawer.renderContents(data);
          } else {
            window.location.href = `${window.Shopify?.routes?.root || '/'}cart`;
          }
        } catch (err) {
          if (feedback) {
            feedback.hidden = false;
            feedback.textContent = err.message || 'Bir hata oluştu.';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        }
      });
    }

    if (stickySubmitBtn && form) {
      stickySubmitBtn.addEventListener('click', () => {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    }

    if (stickyBar && 'IntersectionObserver' in window) {
      const target = submitBtn || root;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            stickyBar.classList.toggle('is-visible', passed);
          });
        },
        { threshold: 0 }
      );
      obs.observe(target);
    }
  });
})();
