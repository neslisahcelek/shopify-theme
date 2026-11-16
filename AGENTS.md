# Style Vibeus — Shopify Tema Geliştirme Kuralları (AGENTS.md)

Bu çalışma alanı **Style Vibeus** (`https://stylevibeus.com/` / `etthsd-i7.myshopify.com`) Shopify mağazasının Online Store 2.0 tema geliştirmesi içindir. Tüm ajanlar ve alt ajanlar aşağıdaki kurallara kesinlikle uymak zorundadır.

## 1. Canlı Site Güvenlik Kuralı (KRİTİK)
- **Canlı (published) temaya ASLA doğrudan yazma veya push yapma.**
- Referans kaynak tema: `StyleVibe (live)` (Theme ID: `189563109512`, Schema: `Atelier 0.1.0`).
- Yerel çekme (`pull`) işlemi `189563109512` üzerinden yapılabilir, ancak uzak sunucuya gönderim (`push`) **yalnızca taslak (unpublished) tema** üzerine (`shopify theme push --unpublished` veya kullanıcı tarafından onaylanmış taslak Theme ID) yapılmalıdır.
- `shopify theme push --live` veya canlı temayı değiştiren herhangi bir Shopify Admin işlemi **kesinlikle yasaktır**.
- Canlı yayınlama kararı yalnızca kullanıcıya aittir.

## 2. Teknoloji ve Mimari Kurallar (Online Store 2.0)
- Tüm yeni bölümler `sections/*.liquid` içinde geçerli `{% schema %}` bloklarıyla oluşturulmalıdır.
- Metinler, renkler, animasyon hızları ve aç/kapa seçenekleri Shopify Tema Özelleştirici (Theme Editor) üzerinden yönetilebilir olmalıdır.
- Yeni CSS ve JS dosyaları `assets/` altında modüler tutulmalı, yalnızca ilgili section veya `layout/theme.liquid` üzerinden temiz şekilde yüklenmelidir.
- Üçüncü parti ağır kütüphaneler eklemek yerine modern, bağımlılıksız (vanilla) CSS & JS tercih edilmelidir.

## 3. Tasarım ve Marka Kuralları
- Mevcut renk paleti ve tipografi korunmalıdır (detaylar için `DESIGN_SYSTEM.md` dosyasına bakın).
- Mevcut ürün görselleriyle çalışılır; arka planı temizlenmemiş (dikdörtgen/stüdyo) ürün fotoğraflarının doğal ve estetik görünmesi için uygun çerçeveleme, aspect-ratio ve askı/kart sunumu kullanılmalıdır.

## 4. Animasyon, Performans ve Erişilebilirlik
- Yalnızca GPU hızlandırmalı özellikler (`transform`, `opacity`, `filter`) animasyonlanmalıdır; `width`, `height`, `top`, `left` gibi layout tetikleyen özelliklerden kaçınılmalıdır.
- Her animasyon `@media (prefers-reduced-motion: reduce)` kuralına saygı göstermelidir.
- Core Web Vitals (özellikle LCP ve CLS) korunmalıdır; hero dışı görsellerde uygun `loading` stratejisi uygulanmalıdır.

## 5. Doğrulama Zorunluluğu
- Kod değişikliklerinden sonra `shopify theme check` çalıştırılmalıdır.
- Görsel ve etkileşim doğrulaması `shopify theme dev` önizleme sunucusu üzerinden masaüstü (`1440px`) ve mobil (`390px`) görünümlerde yapılmalıdır.
