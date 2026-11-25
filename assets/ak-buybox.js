/* Anne Keyfi Buy-Box: Carousel Gallery, Lightbox, Variant Swatches, Quantity, AJAX Cart & Sticky ATC */
(() => {
  const roots = document.querySelectorAll('[data-ak-buybox]');
  if (!roots.length) return;

  roots.forEach((root) => {
    const variantsEl = root.querySelector('[data-ak-variants-json]');
    const variants = variantsEl ? JSON.parse(variantsEl.textContent || '[]') : [];
    const track = root.querySelector('[data-ak-track]');
    const slides = Array.from(root.querySelectorAll('[data-ak-slide]'));
    const thumbsWrap = root.querySelector('[data-ak-thumbs]');
    const thumbBtns = Array.from(root.querySelectorAll('[data-ak-thumb]'));
    const prevBtn = root.querySelector('[data-ak-prev]');
    const nextBtn = root.querySelector('[data-ak-next]');
    const counterEl = root.querySelector('[data-ak-counter]');

    const lightbox = root.querySelector('[data-ak-lightbox]');
    const lightboxTrack = root.querySelector('[data-ak-lightbox-track]');
    const lightboxCounter = root.querySelector('[data-ak-lightbox-counter]');
    const lightboxClose = root.querySelector('[data-ak-lightbox-close]');
    const lightboxPrev = root.querySelector('[data-ak-lightbox-prev]');
    const lightboxNext = root.querySelector('[data-ak-lightbox-next]');
    const zoomTriggers = root.querySelectorAll('[data-ak-open-lightbox]');

    const demoSvgBody = root.querySelector('[data-ak-demo-pillow]');
    const demoSvgArms = root.querySelectorAll('[data-ak-demo-arm]');
    const swatchBtns = root.querySelectorAll('[data-ak-swatch]');
    const activeColorName = root.querySelector('[data-ak-active-color]');
    const stickyColorName = root.querySelector('[data-ak-sticky-color]');
    const priceEl = root.querySelector('[data-ak-price]');
    const compareEl = root.querySelector('[data-ak-compare]');
    const stickyPriceEl = root.querySelector('[data-ak-sticky-price]');
    const variantInput = root.querySelector('input[name="id"]');
    const submitBtn = root.querySelector('[data-ak-submit]');
    const buyNowBtn = root.querySelector('[data-ak-buy-now]');
    const stickySubmitBtn = root.querySelector('[data-ak-sticky-submit]');
    const qtyInput = root.querySelector('input[name="quantity"]');
    const qtyMinus = root.querySelector('[data-ak-qty-minus]');
    const qtyPlus = root.querySelector('[data-ak-qty-plus]');
    const packBtns = root.querySelectorAll('[data-ak-pack]');
    const form = root.querySelector('form[data-ak-form]');
    const feedback = root.querySelector('[data-ak-feedback]');
    const stickyBar = root.querySelector('[data-ak-sticky-bar]');

    let currentIndex = 0;
    let lightboxIndex = 0;

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

    const syncGalleryUI = (idx) => {
      if (!slides.length) return;
      const safeIdx = Math.max(0, Math.min(idx, slides.length - 1));
      currentIndex = safeIdx;

      if (counterEl) {
        counterEl.textContent = `${safeIdx + 1} / ${slides.length}`;
      }

      thumbBtns.forEach((btn, i) => {
        const active = i === safeIdx;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-current', active ? 'true' : 'false');
      });

      const activeThumb = thumbBtns[safeIdx];
      if (thumbsWrap && activeThumb) {
        const targetLeft = activeThumb.offsetLeft - (thumbsWrap.clientWidth - activeThumb.clientWidth) / 2;
        thumbsWrap.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
      }
    };

    const goToSlide = (idx, smooth = true) => {
      if (!track || !slides.length) return;
      const total = slides.length;
      const safeIdx = ((idx % total) + total) % total;
      const targetSlide = slides[safeIdx];
      if (targetSlide) {
        track.scrollTo({
          left: targetSlide.offsetLeft,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
      syncGalleryUI(safeIdx);
    };

    if (track && slides.length) {
      let scrollRaf = 0;
      track.addEventListener(
        'scroll',
        () => {
          if (scrollRaf) cancelAnimationFrame(scrollRaf);
          scrollRaf = requestAnimationFrame(() => {
            const width = track.clientWidth || 1;
            const idx = Math.round(track.scrollLeft / width);
            if (idx !== currentIndex) {
              syncGalleryUI(idx);
            }
          });
        },
        { passive: true }
      );

      // On initial load, ensure the active thumbnail's slide is shown
      const initialActiveThumbIdx = thumbBtns.findIndex((b) => b.classList.contains('is-active'));
      if (initialActiveThumbIdx > 0) {
        goToSlide(initialActiveThumbIdx, false);
      }
    }

    thumbBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index || '0', 10);
        goToSlide(idx, true);
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1, true));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1, true));
    }

    // Lightbox / Zoom Modal
    const syncLightboxUI = (idx) => {
      if (!slides.length) return;
      const safeIdx = Math.max(0, Math.min(idx, slides.length - 1));
      lightboxIndex = safeIdx;
      if (lightboxCounter) {
        lightboxCounter.textContent = `${safeIdx + 1} / ${slides.length}`;
      }
    };

    const goToLightboxSlide = (idx, smooth = true) => {
      if (!lightboxTrack || !slides.length) return;
      const total = slides.length;
      const safeIdx = ((idx % total) + total) % total;
      const targetSlide = lightboxTrack.children[safeIdx];
      if (targetSlide) {
        lightboxTrack.scrollTo({
          left: targetSlide.offsetLeft,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
      syncLightboxUI(safeIdx);
    };

    const openLightbox = (idx) => {
      if (!lightbox) return;
      if (typeof lightbox.showModal === 'function') {
        if (!lightbox.open) lightbox.showModal();
      } else {
        lightbox.setAttribute('open', '');
      }
      requestAnimationFrame(() => {
        goToLightboxSlide(idx, false);
      });
    };

    const closeLightbox = () => {
      if (!lightbox) return;
      if (typeof lightbox.close === 'function' && lightbox.open) {
        lightbox.close();
      } else {
        lightbox.removeAttribute('open');
      }
    };

    zoomTriggers.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index || String(currentIndex), 10);
        openLightbox(idx);
      });
    });

    if (lightbox) {
      if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
      }
      if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => goToLightboxSlide(lightboxIndex - 1, true));
      }
      if (lightboxNext) {
        lightboxNext.addEventListener('click', () => goToLightboxSlide(lightboxIndex + 1, true));
      }

      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
          closeLightbox();
        }
      });

      lightbox.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToLightboxSlide(lightboxIndex - 1, true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToLightboxSlide(lightboxIndex + 1, true);
        }
      });

      if (lightboxTrack) {
        let lbRaf = 0;
        lightboxTrack.addEventListener(
          'scroll',
          () => {
            if (lbRaf) cancelAnimationFrame(lbRaf);
            lbRaf = requestAnimationFrame(() => {
              const width = lightboxTrack.clientWidth || 1;
              const idx = Math.round(lightboxTrack.scrollLeft / width);
              if (idx !== lightboxIndex) {
                syncLightboxUI(idx);
              }
            });
          },
          { passive: true }
        );
      }
    }

    const findSlideIndexForVariant = (variant) => {
      if (!variant || !slides.length) return -1;
      const mediaId = variant.featured_media?.id || variant.featured_image?.id;
      if (mediaId) {
        const byId = slides.findIndex((s) => String(s.dataset.mediaId) === String(mediaId));
        if (byId !== -1) return byId;
      }
      if (variant.featured_image && variant.featured_image.src) {
        const cleanTarget = variant.featured_image.src.split('?')[0].replace(/^https?:/, '');
        const bySrc = thumbBtns.findIndex((t) => {
          const cleanThumb = (t.dataset.src || '').split('?')[0].replace(/^https?:/, '');
          return cleanThumb && cleanThumb === cleanTarget;
        });
        if (bySrc !== -1) return bySrc;
      }
      return -1;
    };

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

      const targetSlideIdx = findSlideIndexForVariant(match);
      if (targetSlideIdx !== -1) {
        goToSlide(targetSlideIdx, true);
      }

      const soldOutLabel = root.dataset.soldOutText || 'Tükendi';
      const addLabel = root.dataset.addText || 'Sepete Ekle';
      if (submitBtn) {
        submitBtn.disabled = !match.available;
        submitBtn.textContent = match.available ? addLabel : soldOutLabel;
      }
      if (buyNowBtn) {
        buyNowBtn.disabled = !match.available;
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

    if (buyNowBtn && form) {
      buyNowBtn.addEventListener('click', async () => {
        if (!variantInput || !variantInput.value) {
          if (feedback) {
            feedback.hidden = false;
            feedback.textContent = 'Önizleme modu: Shopify Admin üzerinden ürün eklendiğinde ödeme aktif olur.';
          }
          return;
        }

        const originalText = buyNowBtn.textContent;
        buyNowBtn.disabled = true;
        buyNowBtn.textContent = 'Ödemeye yönlendiriliyor...';

        try {
          const formData = new FormData(form);
          const rootUrl = window.Shopify?.routes?.root || '/';
          const res = await fetch(`${rootUrl}cart/add.js`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.description || data.message || 'Sipariş başlatılamadı.');
          }
          window.location.href = `${rootUrl}checkout`;
        } catch (err) {
          if (feedback) {
            feedback.hidden = false;
            feedback.textContent = err.message || 'Bir hata oluştu.';
          }
          buyNowBtn.disabled = false;
          buyNowBtn.textContent = originalText;
        }
      });
    }

    if (stickyBar && 'IntersectionObserver' in window) {
      const target = submitBtn || root;
      const footerEl = document.querySelector('footer, .footer');
      let passedBuybox = false;
      let footerVisible = false;
      const syncSticky = () => {
        stickyBar.classList.toggle('is-visible', passedBuybox && !footerVisible);
      };

      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === target) {
              passedBuybox = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            } else if (entry.target === footerEl) {
              footerVisible = entry.isIntersecting;
            }
          });
          syncSticky();
        },
        { threshold: 0 }
      );
      obs.observe(target);
      if (footerEl) obs.observe(footerEl);
    }
  });
})();
