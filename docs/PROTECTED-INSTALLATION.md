# Sunucuya bağlı dağıtım

Müşteri yöneticisi Bağlantı & kurulum ekranından paket oluşturur. Ana yönetici de
Sunucu atamaları > Kurulum / lisans üzerinden yönetebilir. Kimlik/token ekrana
kopyalatılmaz; yalnızca sunucuya kurulan license.json içinde bulunur.

## Derleme ve dağıtım

1. fiveiso deposunda `npm ci && npm run build`.
2. fiveiso-panel deposunda `npm ci --legacy-peer-deps`.
3. `FIVEISO_SOURCE=/kaynak/fiveiso npm run build:release`.
4. dist/client web çıktısıdır. dist/resource-template.json **özel** paket şablonudur;
   public veya dist/client içine koymayın. dist/protected/server ve
   dist/protected/fiveiso-host dağıtıma hazır obfuscate edilmiş .mjs dosyalarıdır.
5. Dağıtımda mevcut .env, veritabanı ve kullanıcı verileri korunur. Korumalı server
   dosyalarını uygulamanın server/ dizinine koyun; public/assets/blips kataloğu
   kaynak kurulumundaki konumunda kalmalıdır.

Panel JS çıktısı Vite renderChunk aşamasında obfuscate edilir; içerik hashleri
son kodu yansıtır. Tüm server/ ve fiveiso-host/ JS/MJS dosyaları dolaşılarak korunur.
FiveM sunucu JS, Lua ve Vite NUI paketi şifreli yükün içindedir. Config, manifest,
HTML ve kurulum betikleri çalıştırılabilir/özelleştirilebilir kalır. Yeni üst seviye
resource JS/MJS/Lua dosyası paket listesine eklenmezse derleme hata verir.

## Yetkilendirme

`POST /api/servers/:id/license` action=create ile paket, action=revoke ile iptal;
`GET /api/servers/:id/package` kimliği doğrulanmış indirme. Yalnızca ana yönetici
ve atanmış müşterinin yöneticisi kullanabilir. Personel ve diğer müşteriler erişemez.
Paket üretimi eski ajan token'ını yeniler. Mevcut paketi tekrar indirmek lisansı
ve IP bağını değiştirmez. Silip yeniden oluşturmak anahtarı, token'ı ve paket ID'sini
yeniler. Eski paketin anahtarı DB'den kaldırılır; eski token tüm bağlantılarda reddedilir.

`FIVEISO_RESOURCE_ORIGIN=https://api.fiveiso.com` ile yeni paketlerin makine
bağlantısı tarayıcı alan adından ayrılır. API alan adına Cloudflare Challenge
uygulanmamalıdır. İlk HTTPS activation, panelin gördüğü IP ve SHA-256 parmak izine bağlar. Parmak izi
makine adı, sv_licenseKey, netPort ve resource yolundan türetilir; ham Cfx anahtarı
panele gönderilmez. Sunucu token'ı istemci manifest dosyalarına eklenmez. Token,
fingerprint, müşteri durumu ve doğrulama süresi heartbeat, envanter, ekran ve WS
bağlantılarında kontrol edilir. Bağımsız Host, token+IP ile kontrol edilir; yeni paket
sonrası Host kullanılıyorsa onun FIVEISO_TOKEN değeri de yeni license.json ile eşlenmelidir.

Gerçek IP için `PANEL_TRUST_LOCAL_PROXY=true` yalnızca yerel güvenilir Nginx
arkasında kullanılır. Nginx X-Real-IP'yi overwrite etmeli; Cloudflare gerçek IP
başlığı yalnızca resmi Cloudflare kaynak CIDR'larından kabul edilmelidir. Uygulamaya
doğrudan erişimde bu ayar false kalır. IPv4/IPv6 çıkış değişimi yeni lisans gerektirir.

Şifreleme AES-256-GCM, her pakete özel rastgele key+IV ve paket ID'si AAD kullanır.
Anahtar ZIP'te bulunmaz; özel DB'de durur. Dosya biçimi FISO1'dir, FXAP taklidi değildir.
Önyükleyici 30 saniyede bir doğrular; 90 saniyelik süre dolarsa kaynağı durdurur.
İlk yetkilendirme yapılmadan sunucu uygulama kodu yüklenmez; istemci/NUI kodu yalnızca
lisanslı sunucudaki oyunculara gönderilir. Kaynak başlatıldıktan sonra bağlı oyuncuların
istemci yükünü almaları ağ hızına göre birkaç saniye sürebilir.

## Sınırlar

Kodun çalıştığı yetkili makine sahibi bellekteki anahtarı/kodu çıkarabilir. İstemci
kodu yetkili oyuncunun cihazına ulaşır. Obfuscation ve IP kilidi mutlak kopya veya
çözülemezlik garantisi vermez; parmak izi de güvenilir donanım kimliği değildir.
Cfx Asset Escrow ayrı bir Portal/Tebex işlemi gerektirir ve mevcut resmi belgelerde
Lua desteklenirken JS/NUI desteklenmez. Bu paket Cfx escrow değildir.

https://docs.fivem.net/docs/server-manual/asset-escrow/

Kurulum betikleri server.cfg'yi ve eski resource klasörünü yedekler, gerekli ensure
ve ACE kaydını otomatik ekler. Script'in kendine ACE yetkisi verme girişimi yoktur.
Kurulumu sunucunun işletim sistemi kullanıcısı çalıştırır. Önceki database-config.lua ayarları otomatik korunur.
