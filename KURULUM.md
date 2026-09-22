# FiveISO — FiveM Kontrol Merkezi

> v3 güncellemesi: ayrı sahip/müşteri panelleri ve süreli modül paketleri için önce ANA-PANEL-KURULUM.md dosyasını okuyun. Güncel özellik durumu KAPSAM.md içindedir.

React 19 + TypeScript/TSX + Tailwind CSS 4 arayüzü, Node.js merkez servisi ve FiveM Lua ajanından oluşan modüler proje. Merkez kendi ana makinenizde çalışır. Farklı fiziksel makineler ve sağlayıcılardaki birden fazla FiveM sunucusu aynı merkeze bağlanabilir.

## İçerik

- Sunucu ekleme, ayrı ajan anahtarları ve bağlantı durumu.
- Aktif oyuncular, arama, ping, kapasite ve 24 saatlik oyuncu ölçümleri.
- Kaynak listeleme, başlatma, durdurma ve yeniden başlatma.
- Oyuncu uzaklaştırma, lisans bazlı kalıcı yasaklama ve yasak kaldırma.
- Oyunculara duyuru ve FiveM sunucu komut konsolu.
- Müşteri bazlı özel hesap yetkileri; görünürlük ve işlemler API tarafında uygulanır.
- İşlem kuyruğu, ajan onayı, hata/zaman aşımı durumları ve JSON kayıt indirme.
- SQLite kalıcılığı, veritabanı yedekleme aracı, anahtar yenileme aracı.
- Türkçe, mobil uyumlu arayüz ve gerçek sunuculardan ayrı etkileşimli demo.

## 1. Ana makine kurulumu

Node.js 24 LTS gerekir. Terminali bu klasörde açın.

```powershell
npm ci
Copy-Item .env.example .env
powershell -File scripts/create-user.ps1 -Username owner
npm run build
npm run center
```

Parola ekranda gösterilmeden istenir. En az 12 karakter kullanın. Aynı araç tekrar çalıştırılırsa owner parolası güncellenir. Linux'ta parolayı `FIVEISO_NEW_PASSWORD` ortam değişkeninde verip `node --env-file-if-exists=.env server/manage.mjs owner owner` çalıştırabilirsiniz; sonrasında değişkeni temizleyin.

Ana panel: **http://localhost:8080/owner**. Müşteri paneli: **http://localhost:8080/panel**. Sağ üstteki demo şeridinden **Merkeze giriş** seçin. Demo verileri bellektedir ve sayfa yenilendiğinde sıfırlanır. Girişten sonra yalnızca kendi veritabanınızın gerçek kayıtları gösterilir. Sunucu bağlı değilse liste boş olur; **Sunucu ekle** ile başlayın.

`npm run dev` yalnızca arayüz geliştirme içindir (3000 portu). Canlı API ile geliştirmek için merkez `.env` dosyasında `PANEL_ORIGIN=http://localhost:3000` kullanıp merkez servisini ayrı terminalde yeniden başlatın. Normal kullanımda bu değer 8080 adresine dönmelidir.

## 2. Farklı makinelerden bağlantı

Merkez varsayılan olarak yalnızca `127.0.0.1:8080` dinler. Uzak ajanların merkeze erişmesi gerekir; tarayıcı FiveM sunucularına doğrudan bağlanmaz.

**HTTPS ile:** Merkez önüne bir HTTPS ters vekil koyun. Vekil yerel 8080 portuna iletsin. `.env` içindeki `PANEL_ORIGIN` değerini tam dış adres olarak ayarlayın, örneğin `https://panel.ornek.com` (sonunda / olmadan). Vekil aynı makinedeyse `PANEL_HOST=127.0.0.1` kalabilir. Tarayıcıda da bu adresi kullanın.

**Özel ağ / VPN ile:** `PANEL_HOST` değerini merkezin özel ağ IP'si, `PANEL_ORIGIN` değerini tarayıcıdan kullanılan tam adres yapın. Güvenlik duvarında erişimi özel ağa sınırlayın. HTTP yalnızca güvenilen yerel/VPN ağı için desteklenir; internet üzerinden HTTPS kullanın.

Her uzak sunucuda merkez adresi erişilebilir olmalıdır. NAT arkasında özel VPN veya uygun yönlendirme gerekir. Bu proje otomatik olarak modem/port/güvenlik duvarı ayarı yapmaz.

## 3. FiveM ajan kurulumu

1. Panelde **Sunucu ekle** seçin. Sunucu kimliğini ve yalnızca bir defa gösterilen anahtarı kaydedin.
2. `../musteri-scripti/fiveiso-agent` klasörünü ilgili FiveM sunucusunun `resources/[management]/fiveiso-agent` klasörüne kopyalayın. Klasör adı `fiveiso-agent` kalmalıdır.
3. `server.cfg` içine ekleyin:

```cfg
set fiveiso_url "https://panel.ornek.com"
set fiveiso_server_id "PANELIN_URETTIGI_SUNUCU_KIMLIGI"
set fiveiso_token "PANELIN_URETTIGI_ANAHTAR"
add_ace resource.fiveiso-agent command allow
ensure fiveiso-agent
```

Güvenilen yerel/VPN ağında HTTP kullanıyorsanız ayrıca `set fiveiso_allow_http "true"` ekleyin. Anahtarları `setr` ile replike etmeyin. Yapılandırma dosyasını gizli tutun.

4. Ajan yaklaşık 5 saniyede bir ölçüm yollar. 20 saniye ölçüm gelmezse sunucu çevrimdışı görünür.
5. Her yeni sunucu için ayrı kayıt ve ayrı anahtar oluşturun. Anahtar yenilemek için:

```powershell
node --env-file-if-exists=.env server/manage.mjs rotate-token SUNUCU_KIMLIGI
```

Yeni anahtarı o sunucunun `server.cfg` dosyasına yazıp ajanı yerel olarak yeniden başlatın. Eski anahtar hemen geçersiz olur.

## 4. Ekip ve yetki modeli

`owner` yalnızca owner panelini kullanır. Owner panelinden oluşturulan lisans hesabı kendi çalışma alanının müşteri yöneticisidir. Müşteri yöneticisi `/panel` içindeki **Ekip ve yetkiler** bölümünden hesap açar; bölüm görünürlüğü ile kick, ban, konsola komut gönderme ve veritabanı düzenleme gibi işlemleri ayrı ayrı seçer. Verilmeyen işlem düğmeleri kullanıcıya gösterilmez ve API çağrıları da reddedilir.

Discord ile giriş için [Discord Developer Portal](https://discord.com/developers/applications) üzerinde bir uygulama oluşturun. OAuth2 yönlendirme adresini `.env` içindeki `DISCORD_REDIRECT_URI` ile birebir aynı ayarlayın; bu adres `PANEL_ORIGIN` + `/api/auth/discord/callback` olmalı. `DISCORD_CLIENT_ID` ve `DISCORD_CLIENT_SECRET` değerlerini `.env` içine yazıp merkezi yeniden başlatın. Discord uygulamasında yalnızca `identify` kapsamı kullanılır. Mevcut üyeler panelde **Ayarlar → Discord hesabını bağla** üzerinden hesaplarını bağlayıp sonraki girişlerde Discord'u kullanabilir. Yeni üye kaydı için müşteri yöneticisi önce bir rol oluşturur, sonra **Ekip ve yetkiler** bölümünden o role bağlı tek kullanımlık, 7 gün geçerli davet bağlantısı üretir. Davet bağlantısını alan kişi Discord ile kayıt olur; rolün yetkileri sunucuda uygulanır. Davetsiz Discord hesapları kendiliğinden panele erişemez.

Müşteri hesapları yalnızca kendi alanlarına atanan sunucuları görür. 2FA ve dış kimlik sağlayıcısı bu sürümde yoktur. Oturum 8 saat sürer; merkez yeniden başladığında yeniden giriş gerekir.

## 5. Konsol ve işlem sonuçları

İşlem konsolu işletim sistemi kabuğu değildir; yazılan tek satırlık komutu `fiveiso-agent` üzerinden FXServer `ExecuteCommand` işlevine gönderir. Örnekler:

```text
status
say Sunucuya hoş geldiniz!
start qb-housing
stop qb-housing
restart qb-housing
```

Konsol yazma izni çok güçlüdür ve yalnızca güvenilir hesaplara verilmelidir. `add_ace resource.fiveiso-agent command allow` satırı ajanın kısıtlı FXServer komutlarını da çalıştırabilmesini sağlar. Komutlar işletim sistemi kabuğuna aktarılmaz. Oyuncu uzaklaştırmada ID yanında lisans da eşleştirilir; yeniden kullanılan ID üzerinden farklı oyuncuya işlem uygulanmaz.

Durumlar: `queued` bekliyor, `dispatched` ajana teslim edildi, `completed` ajan başarılı bildirdi, `failed` ajan hata bildirdi, `expired` sonuç zamanında alınamadı. Sonuç belirsizse komut otomatik tekrarlanmaz. 60 saniyeden eski komutlar yeni heartbeat sırasında zaman aşımına alınır. Merkez kesintilerinde geç kalan komutların uygulanmaması tercih edilir. Ban kaydı merkeze hemen kaydedilir; ajan listesi sonraki heartbeat'te güncellenir. Ajan son ban listesini yerel KVP deposunda saklar.

Duyuru standart FiveM `chat:addMessage` olayıyla çalışır; özel sohbet kaynağınız varsa ajan içindeki duyuru adaptörünü ona göre uyarlayın. Kaynak işlemleri FiveM StartResource/StopResource, oyuncu verileri GetPlayers ve HTTP bağlantısı PerformHttpRequest üzerine kuruludur.

## 6. Yedekleme

```powershell
node --env-file-if-exists=.env scripts/backup.mjs
```

Bu komut **panel veritabanını** tutarlı SQLite anlık görüntüsü olarak `data/backups` içine yedekler. FiveM kaynak dosyalarını, oyun veritabanını veya oyuncu envanterini yedeklemez. Geri yüklemeden önce merkezi durdurun; mevcut veritabanını ayrıca saklayın ve yedeği `PANEL_DB` yoluna kopyalayın. Yedeklerde hesap karmaları ve moderasyon bilgileri bulunur; erişimi sınırlayın.

## Modüler dosya yapısı

```text
client/                 React uygulama girişi
app/                    Paylaşılan tema ve Sites önizleme girişi
modules/panel/          Panel ekranları, veri erişimi, demo ve grafik
modules/panel/dashboard.tsx  Ana kontrol merkezi ve oyuncu listesi
modules/panel/theme.css      FiveISO cam yüzey ve renk sistemi
components/ui/          Erişilebilir ortak arayüz bileşenleri
lib/panel-types.ts      TypeScript veri sözleşmeleri
server/index.mjs        HTTP API, oturum ve ajan iş akışları
server/security.mjs     Parola, anahtar, yetki ve işlem doğrulama
server/store.mjs        SQLite şeması ve kalıcılık
server/manage.mjs       Yerel hesap ve anahtar yönetimi
../musteri-scripti/fiveiso-agent/      FiveM sunucu ajanı
scripts/                Hesap açma ve yedekleme
 tests/                 API güvenlik ve entegrasyon testleri
```

Yeni panel modüllerini `modules/` altında tutun. API işlemini sunucu izin listesine, doğrulamaya ve ajan adaptörüne birlikte ekleyin. İşletim sistemi kabuğu çalıştırmayın; FXServer konsol yazma iznini yalnızca güvenilir hesaplara verin.

## Doğrulama ve sınırlar

`npm test` API entegrasyon testlerini; `npm run build` TypeScript kontrolünü ve üretim arayüzünü oluşturur. Üretilen `dist/client` merkez tarafından servis edilir. Bu oturumda gerçek FXServer sağlanmadığından Lua ajanı gerçek FiveM üzerinde denenmedi; canlıya geçmeden önce test sunucusunda bağlantı, kaynak ve moderasyon akışlarını doğrulayın.

Bu sürüm FXServer sürecini/işletim sistemini başlatıp kapatmaz, tam sunucu yeniden başlatması yapmaz; kaynakların yeniden başlatılmasını destekler. v3 içinde CPU/RAM ve bağlı oyuncuların ekonomi/envanter işlemleri eklendi. Dosya düzenleyici ve otomatik görev zamanlayıcısı henüz dahil değildir. Framework etiketi bilgi amaçlıdır; QBCore/ESX veritabanlarına doğrudan erişim yapılmaz.

Bu paket yerel kullanım içindir; çevrimiçi yayın yapılmadı. Gerçek sunucu yönetimi kendi ana makinenizdeki merkez adresinde yapılır.

FiveM referansları: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/PerformHttpRequest/ ve https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/GetPlayers/




## v4 veritabanı bağlantısı
Çevrimdışı karakter, bakiye ve araç kayıtları için VERITABANI-KURULUM.md dosyasını izleyin. Dağıtımda ana-panel ve musteri-scripti ayrı klasörlerdir; müşteriye yalnızca musteri-scripti klasörünü verin.
