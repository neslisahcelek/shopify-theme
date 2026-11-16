# Style Vibeus — Tasarım Sistemi ve Animasyon Rehberi

## 1. Renk Paleti (`assets/base.css` Tokenları)
- **Arka Plan:** `--bg: #fbf8f4` (sıcak krem), `--bg-2: #f6eee5`
- **Ön Plan / Vurgu:** `--fg: #111111`, `--accent: #111111`, `--accent-fg: #ffffff`
- **İkincil / Çizgiler:** `--muted: rgba(17, 17, 17, 0.6)`, `--line: rgba(17, 17, 17, 0.12)`
- **İndirim Rozeti:** `--sale: #c98a8a`
- **Koyu Alanlar (Footer vb.):** `--dark-bg: #0b0b0b`, `--dark-fg: #f5f5f5`
- **Gradyan:** `--grad: linear-gradient(110deg, #e9d8c8, #e8b9bc 50%, #cdb39a)`

## 2. Tipografi
- **Başlıklar (Display):** `Syne, system-ui, sans-serif`
- **Gövde:** `Manrope, system-ui, sans-serif` (`16px`)
- **Serif Vurgu:** `Instrument Serif, Georgia, serif`

## 3. Köşe Yuvarlaklıkları ve Yerleşim
- `--radius: 14px`
- `--radius-btn: 999px` (pill butonlar)
- `--page-width: 1440px`

## 4. Modernizasyon Hedefleri (SNUG WRLD Referanslı)
1. **İnteraktif Askılı Ürün Rayı (`sections/hanger-rack.liquid`):**
   - Üstte minimalist yatay askı rayı ve her ürün kartının üstünde askı kancası/klips detayı.
   - Odaktaki (merkez/seçili) ürün net ve büyük (`scale(1)` / `blur(0)`), komşu ürünler derinlik hissiyle küçülmüş ve hafif bulanık (`scale` + `blur` + `opacity`).
   - Mouse/scroll/drag/dokunma ile pürüzsüz geçiş ve merkez snap.
   - Altta dinamik ürün başlığı/fiyatı + pill CTA butonu.
2. **Kayan Marquee Bandı (`sections/marquee-ticker.liquid`):**
   - Kesintisiz GPU hızlandırmalı kayan duyuru şeridi; varsayılan olarak mevcut paletle (`#111111` zemin / `#fbf8f4` yazı) uyumlu, Theme Editor'dan renk değiştirilebilir.
3. **Global Scroll-Reveal ve Mikro-Etkileşimler:**
   - Bölümler için `IntersectionObserver` tabanlı yumuşak giriş animasyonları (`[data-reveal]`).
   - Ürün kartı hover geçişleri ve akıcı sepet çekmecesi (Cart Drawer) animasyonları.
