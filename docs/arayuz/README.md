# Arayüz yenilemesi: onaylanan taslak

Kullanıcının beğendiği ve arayüz yenilemesinde **referans** alınacak tasarım (10 Kasım 2026).
`docs/SONRAKI_ISLER.md` "Arayüz yenilemesi" bölümündeki ekran tarifleri bu taslaktan gelir.

| Ekran | Boş şablon | İçerikle doldurulmuş |
|---|---|---|
| 1. Müfredat haritası | `ekran-1.png` | `dolu-1.png` |
| 2. Ders (yedi parçalı adım çubuğu) | `ekran-2.png` | `dolu-2.png` |
| 3. Simülatör çalışma alanı | `ekran-3.png` | `dolu-3.png` |
| 4. Arıza senaryosu | `ekran-4.png` | `dolu-4.png` |

Kaynaklar: `wire.html` (boş şablonlar), `dolu.html` (doldurulmuş). Görseller 1440 px genişliğinde,
açık temadadır.

Uygularken:
- Yerleşim, bilgi yoğunluğu, kart ve panel biçimleri, renk tonları ve boşluklar taslağa uyar.
  Koyu tema aynı yerleşimin karanlık karşılığıdır.
- Taslaktaki üst gezinme adları eskidir: "Lab" → **Simülatör**, "Gerçek Lab" → **Canlı Lab**
  (`SONRAKI_ISLER.md` "Adlandırma").
- Taslaktaki içerik örnektir (gerçek ders/senaryo verisi `src/data/` ve
  `simulator/network-scenarios.json`'dan gelir).
- Taslak harici font ya da CDN kullanmıyorsa ürün de kullanmaz (tek HTML, çevrimdışı).
