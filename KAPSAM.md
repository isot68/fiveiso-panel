# Özellik kapsamı ve kalan entegrasyonlar

Referans: CodeM'in resmî mAdmin tanıtımındaki ana sayfa başlıkları. Kaynak: https://www.youtube.com/watch?v=_jYNEZzWllQ . Aşağıdaki tablo bir test edilmiş tam eşdeğerlik beyanı değildir.

| Alan | Bu sürümde | Henüz tamamlanmayan bölüm |
| --- | --- | --- |
| Ana sahip paneli | Müşteriler, kullanıcılar, süreler, modül seçimi, erişim durdurma, sunucu atama | Ödeme sağlayıcısı / otomatik faturalama |
| Müşteri paneli | Ayrı giriş alanı, müşteriye bağlı sunucular, rol ve modül denetimi | Müşteriye özel alan adı / tema marka ayarları |
| Kontrol merkezi | Oyuncu sayısı, ping, kaynaklar, ajan süresi, ölçüm grafiği, sunucu makinesi CPU/RAM telemetrisi | Disk telemetrisi |
| Oyuncular | Uzaklaştırma, yasak, duyuru, iyileştirme, dondurma, öldürme, özel mesaj, bucket | Spectate, oyuncu ekran görüntüsü, kıyafet arayüzü ve özel hasar sistemleri |
| Canlandırma | Yapılandırılabilir olay adaptörü | Kullanılan ambulans kaynağında doğrulama |
| Karakter hesapları | Bağlı oyuncuların karakter kimliği, meslek ve rütbesi; SQL karakter arama ve ad/soyad düzenleme | Karakter silme, özel karakter metaverisi düzenleme |
| Canlı harita | OneSync koordinat görünümü, yakınlaştırma, oyuncuya odaklanma, koordinata ışınlama | GTA harita görsel katmanı |
| Araçlar | Aktif araç listesi, araç oluşturma, kullanılan aracı onarma/silme; SQL araç arama ve garaj kodu düzenleme | Mülkiyet transferi ve özel garaj işlevleri |
| Envanter | Bağlı oyuncuların envanteri, eşya verme/alma | Özel envanter metaverisi editörü ve diğer envanter adaptörleri |
| Ekonomi | Bağlı oyuncunun nakit/banka bakiyesi, ekleme/alma; SQL kayıtlı bakiye sorgulama/düzenleme | Özel hesap türleri |
| Meslekler | Mevcut meslek/rütbe listesi, oyuncuya atama | Kalıcı meslek/rütbe yaratma ve maaş tanımı düzenleme |
| Çeteler / gruplar | Qbox/QBCore grup ve rütbeleri, oyuncuya atama | ESX özel çete kaynağı, kalıcı grup tanımı düzenleme |
| Kayıtlar | Panel işlemleri, sonuç ve JSON dışa aktarma | Sunucuya özel oyun olayları / özel webhook eşlemeleri |
| Konsol | İzinli kaynak/duyuru komutları ve sonuçları | Tam FXServer stdout akışı, sınırsız konsol |
| Kaynaklar | Liste, başlat/durdur/yeniden başlat | Kaynak dosyası düzenleyici / dosya yükleme |
| Yetkililer | Sahip kullanıcı ataması ve müşterinin kendi ekibini yönetmesi | Discord OAuth ve iki aşamalı giriş |
| Yönetim / ayarlar | Paket ve yetki yönetimi, API doğrulaması, SQLite yedek aracı | FXServer süreç başlatma/durdurma, otomatik görevler, tam sunucu yedeği |

Tam kapsamın bitmesi için özel envanter, ambulans, garaj ve çete kaynaklarının adları/sürümleri, ilgili sunucu veritabanı şemaları ve çalışır test sunucusunda entegrasyon doğrulaması gereklidir. Mevcut kod bu eksikleri başarılı işlem gibi göstermez.
