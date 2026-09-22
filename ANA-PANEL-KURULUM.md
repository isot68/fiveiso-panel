# FiveISO v3 — Ana panel ve müşteri panelleri

## İki ayrı arayüz

- **Ana panel:** `/` veya `/owner`. Yalnızca `owner` hesabı erişebilir.
- **Müşteri paneli:** `/panel`. Müşteri hesabı yalnızca atandığı çalışma alanındaki sunucuları görür.
- Sahip `/panel` üzerinden tüm sunucuların operasyonlarını da yönetebilir.

Bu ayrım yalnızca görsel değildir. Müşteri, sunucu kimliğini veya API isteğini değiştirerek başka müşterinin kayıtlarına erişemez. Oyuncu, kaynak, hesap, envanter, konum, ekonomi, yasak ve denetim verileri sunucuda filtrelenir. Müşteri süresi dolarsa veya paket durdurulursa API erişimi kesilir; oturum açık kalmış olsa da yeni işlem yapılamaz.

## İlk sahip hesabı

Proje klasöründe:

```powershell
npm ci
Copy-Item .env.example .env
powershell -File scripts/create-user.ps1 -Username owner -Role owner
npm run build
npm run center
```

`http://localhost:8080/owner` adresinden giriş yapın. İlk kurulumda kullanıcı ve parolayı siz belirlersiniz; hazır veya ortak parola yoktur. Önceki sürümün `admin` rolü müşteri yöneticisidir ve ana sahip paneline erişmez. Aynı kullanıcı adını owner rolüyle yerel araçtan yeniden kaydedebilirsiniz.

## Müşteriye panel verme

1. Ana panelde **Müşteri oluştur** seçin.
2. Müşteri adını, erişim bitiş tarihini ve modülleri belirleyin. Bitiş tarihi boşsa paket süresizdir. Tarih sonu Türkiye saatiyle 23:59:59 olarak kaydedilir.
3. **Kullanıcı oluştur** ile o müşteriye admin hesabı açın. Parolayı müşteriye kendi güvenli kanalınızdan iletin.
4. **Sunucu ekle** ile ajan kimliği/anahtarı üretin. Ardından **Sunucu atamaları** alanından müşteriye atayın. Yeni sunucu ilk olarak “Mevcut çalışma alanı” altında oluşur.
5. Müşteriye kendi merkez adresinizin `/panel` bağlantısını verin.
6. Her FiveM sunucusunda `../fiveiso` klasörünü kurup kendi sunucu anahtarını tanımlayın.

Merkez sizin ana makinenizde kalır. Kullanıcılara merkez kaynaklarını, SQLite veritabanını veya owner hesabını vermeyin. Müşteriler tarayıcı erişimi kullanır; kendilerine ait FiveM sunucusuna yalnızca ajan kurulur. Alan adı/HTTPS veya VPN gereksinimleri KURULUM.md içinde açıklanmıştır.

## Yetki ve paket kuralları

- `owner`: bütün müşterileri, kullanıcıları, süreleri, paketleri ve sunucuları yönetir.
- `admin`: atanmış müşterinin etkin modüllerinde oyun işlemlerini yapar; ekip modülü açıksa kendi müşterisine alt hesap açar.
- `moderator`: temel uzaklaştırma, yasaklama ve duyuru işlemleri. Kaynak, ekonomi veya envanter değiştiremez.
- `viewer`: okuma.

Müşteri yöneticisi başka müşterinin hesabını değiştiremez, owner rolü veremez, kendi paketine modül ekleyemez veya süreyi uzatamaz. Paket değişikliği bekleyen komutlar ajana teslim edilmeden yeniden kontrol edilir. İzin kaldırılmışsa komut `cancelled` olur. Ajana daha önce teslim edilmiş bir komut geriye dönük geri alınamaz.

## Framework adaptörleri

Otomatik algılama sırası: `qbx_core` → `qb-core` → `es_extended` → standalone. Aynı sunucuda tek aktif framework beklenir.

- Qbox: oyuncu, para, iş ve çete işlemleri `qbx_core` export'larıyla çalışır.
- QBCore: `qb-core` oyuncu fonksiyonları, işler ve çeteler kullanılır.
- ESX: `es_extended` oyuncu, para, iş ve standart envanter API'leri kullanılır.
- Envanter: `ox_inventory`, `qb-inventory`, standart ESX envanteri.
- ESX'te standart bir çete API'si bulunmadığı için çete yazma işlemi otomatik açılmaz.

Ajan desteklediği işlemleri merkeze bildirir. Sunucuda gerekli adaptör yoksa işlem düğmesi etkin olmaz. Framework API'si hata verirse sonuç kaydına hata yazılır. Oyun istemcisinde uygulanan işlemler için hedef oyuncu ve lisans eşleştirilerek geri bildirim beklenir. İstemci bildirimi, bağımsız sunucu doğrulaması veya anti-cheat kanıtı değildir.

Canlandırma için kullandığınız ambulans kaynağının doğru istemci olayını açıkça tanımlayın:

```cfg
set fiveiso_revive_event "KULLANDIGINIZ_KAYNAGIN_CANLANDIRMA_OLAYI"
```

Bu olay için varsayılan tahmin yapılmaz. Standart iyileştirme can değerini yükseltir; ambulans kaynağının ölüm/yaralanma metaverisini temizlediği varsayılmaz. Özel ambulans, envanter, garaj veya ESX çete kaynakları için ilave adaptör gerekir.

## Yeni modüler dosyalar

- `modules/owner/owner-panel.tsx`: sahip paneli.
- `modules/panel/game-tools.tsx`: oyun işlemleri ve kayıt tabloları.
- `modules/panel/location-map.tsx`: canlı koordinat haritası.
- `modules/panel/team-manager.tsx`: müşteri ekip yönetimi.
- `server/tenancy.mjs`: müşteri izolasyonu, paketler ve süreler.
- `server/game-actions.mjs`: oyun işlemi doğrulama ve modül bazlı veri süzme.
- `../fiveiso/bridge.lua`: Qbox, QBCore ve ESX adaptörleri.
- `../fiveiso/client.lua`: oyun istemcisi işlemleri ve sonuç bildirimi.

Önceki veritabanı korunur. Yeni müşteri tabloları ilk başlatmada eklenir; mevcut sunucu ve hesaplar “Mevcut çalışma alanı” altında kalır. İlk yükseltmeden önce veritabanını yedekleyin.

## Doğrulama durumu

Üretim derlemesi ve TypeScript kontrolü başarılı. Sekiz API entegrasyon testi; yetkileri, müşteri izolasyonunu, paket süresini, oturum iptalini, komut iptalini ve işlem miktarı sınırlarını kontrol eder. Ajanın dört Lua dosyası sözdizimi kontrolünden geçti. Gerçek FXServer/Qbox/QBCore/ESX oturumunda çalıştırılmadı; canlı entegrasyon testi henüz yapılmadı.

mAdmin'in bütün işlevleriyle tam eşdeğerlik iddia edilmez. Açık kapsam ve kalan işler KAPSAM.md dosyasındadır.

## Bağımlılık denetimi notu

Bu sürümün bağımlılık denetimi geliştirme/önizleme zincirinde güvenlik uyarıları bildiriyor (Vinext/RSC, Vite ve bazı geçişli paketler). Üretim merkezi bunları sunucu olarak çalıştırmaz; derlenmiş statik arayüzü Node'un yerleşik HTTP/SQLite API'leriyle sunar. Buna rağmen tüm bağımlılıkların güvenlik açısından temiz olduğu iddia edilmez. Geliştirme sunucusunu internete açmayın; sürüm yükseltmeleri ayrı uyumluluk testi gerektirir.


## v4 veritabanı bağlantısı
Çevrimdışı karakter, bakiye ve araç kayıtları için VERITABANI-KURULUM.md dosyasını izleyin. Dağıtımda ana-panel ve musteri-scripti ayrı klasörlerdir; müşteriye yalnızca musteri-scripti klasörünü verin.
