# AğLab Akademi — AGL-001–010

AGL-006–010 uyarlaması ve kalan laboratuvarların denetimi için
[uyarlama raporuna](academy/ADAPTATION.md) bakın. Aşağıdaki v1 notları
ilk beş görevin kapsamını anlatır.

HTML dosyasını aç, Laboratuvar alanında Akademi bölümünden görev seç ve başlat.
Başlat/sıfırla mevcut çalışma topolojisini değiştirir; önce JSON dışa aktarılabilir.
Cihaz, kablo ve CLI düzenlemeleri mevcut simülatör üzerinden yapılır. Kavramsal
soruları Akademi bölümünde cevapla ve Çözümümü kontrol et düğmesini kullan.
İpuçları sırayla açılır. Sıfırla, etkin görevin özgün başlangıcını ve boş cevapları yükler.

## Kaldığın yerden devam etme

Etkin laboratuvar, öğrenci topolojisi, seçilen cevaplar ve açılan ipuçları aynı topoloji kaydında tutulur. Aynı adres ve tarayıcı profiliyle sayfayı yeniden açınca Laboratuvar → Akademi bölümünden çalışmana devam edebilirsin. Önceden kontrol ettiğin çözümün puanı yeniden hesaplanır; eski bir başarı sonucu güncel topolojiye körlemesine uygulanmaz. Yapılandırma veya cevap değişirse önceki sonuç yerine yeniden kontrol etme uyarısı gösterilir.

Laboratuvar listesindeki en iyi puan ve tamamlanma durumu bu tarayıcı profilinde saklanır. Baştan başla / sıfırla mevcut denemeyi, cevapları ve ipuçlarını temizler; geçmiş en iyi puanı silmez. Başka bir topoloji içe aktarmak veya hazır ağ senaryosuna geçmek etkin Akademi görevini kapatır. Akademi kaydı içeren JSON, etkin oturum bilgilerini de taşır; geçersiz oturum kaydı mevcut çalışmayı değiştirmeden reddedilir.

Farklı cihazlar/profiller arasında hesap senkronizasyonu yoktur. Tarayıcı verisini silmek yerel kayıtları kaldırır. En iyi puan geçmişi JSON'a dahil edilmez; etkin oturum ve topoloji dahil edilir. Depolama hatası gösterilirse çalışmayı JSON olarak dışa aktar. Bu istemci tarafı ilerleme, güvenli sınav notu veya öğrenci kimlik sistemi değildir.

## Kaynak ve veri koruma

Kaynak: önceki çalışmanın `AgLab_Akademi_Ilk_40_TR.zip` paketi,
`aglab-akademi-ilk-40/labs/AGL-001.json`–`AGL-005.json`.
İstenen geliştirilmiş ZIP yerel ortamda bulunamadı; ilk 40 laboratuvarın özgün
paketi bulundu. Özgün beş JSON `academy/source/` altında baytları değiştirilmeden
saklanır; SHA256.json ile test edilir. Başlangıçlar, hedefler, adımlar ve 100 puanlık
rubrikler değiştirilmedi. Bazı kriterler başlangıçta sağlanır; UI bunu açıkça gösterir.

`academy/student/` öğretmen açıklamalarını, answer_key ve target_topology alanlarını
içermez. `academy/teacher/` bunları ayrı saklar. Öğrenci ZIP'ine teacher/source
dizinleri alınmaz; öğretmen ZIP'i ayrı üretilir. Öğrenci HTML'inde otomatik kontrol
için rubriğin expected değerleri bulunur. Bu çevrimdışı eğitim sürümü cevapları
geliştirici araçlarına karşı gizleyen bir sınav güvenliği sistemi değildir. Güvenli
sınav puanlaması için sunucu tarafında değerlendirici gerekir. Depoya erişen kişi
kaynak ve öğretmen dizinlerini de görebilir.

## Değerlendirme kapsamı

Bu ilk beş görevde gereken state.equals, answer.equals ve pozitif probe.icmp
ölçütleri desteklenir. Kablo sırası ve yönü önemsiz; uçlar, portlar, up durumu ve
bağlantı sayısı eşit olmalıdır. Cihaz yolları ID ile çözülür; eksik alan geçmez.
IP değerleri kanonik karşılaştırılır. Slash içeren port adları literal anahtardır.
Desteklenmeyen kriter not_evaluated, teknik hata error olur; eksik kapsamda sonuç
incomplete olur, puan 100'e ölçeklenmez. Yalnız tüm ölçütler geçerse 100/100 verilir.

ICMP gerçek cihaz trafiği değildir: mevcut deterministik eğitim motorunda güncel
öğrenci topolojisine beş kez ping uygulanır; ilk deneme ısınma, son dörtte en az üç
başarı gerekir. Motor zamanla yakınsama veya paket kaybı modellemediğinden içerik
sözleşmesindeki 2 saniye bekleme / 1 saniye aralık uygulanmaz. Bu açık bir motor
uyarlamasıdır; gerçek zamanlı icmp-5-v1 uygunluğu iddia edilmez. Negatif probe,
kimlik yeniden eşleme ve AGL-006–040 bu sürümün kapsamı dışındadır.
Yeni Packet Tracer desteği eklenmez; mevcut dönüştürücü ve kaynak arşivi korunur.

## Geliştirme ve doğrulama

`academy/academy.js` ve `academy/student-data.js` HTML içine `python build_academy.py`
ile gömülür. HTML tek başına çevrimdışı açılabilir. Kaynak JS değişince yeniden
derleyin. `python run_pipeline.py` mevcut regresyonları ve Akademi Chromium testlerini birlikte çalıştırır. ZIP yalnız tüm testler geçerse oluşturulur.
Testler özgün veri özetlerini, başlangıç/çözüm, ters/sırasız kablolar, bozuk ağ,
cevaplar, ipuçları, sıfırlama ve eksik kapsamı kontrol eder.

`test_aglab_student_journey.py` öğretmen hedefini yüklemeden görünür öğrenci arayüzünü kullanır: AGL-005 CLI çözümü, AGL-001 kablolama/cevap değerlendirmesi, yenileme, kalıcı profilde yeni Chromium süreci, mobil genişlik, ipuçları, güncel puan, sıfırlama, ilerleme ve dış topoloji geçişi. İlk beş laboratuvarın özgün kaynak/rubrik testleri de korunur.
