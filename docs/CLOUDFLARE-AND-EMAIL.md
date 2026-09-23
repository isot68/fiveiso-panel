# Cloudflare doğrulaması ve doğrulama e-postaları

## Cloudflare

Görülen “Güvenlik doğrulaması yapılıyor” ekranı uygulama HTML'i değil Cloudflare
Managed Challenge sayfasıdır. Güvenlik kuralı tetiklenmediğinde veya geçerli
cf_clearance çerezi bulunduğunda gösterilmez.

fiveiso.com > Security > WAF / Custom rules altında action=Managed Challenge:

```
(http.host eq "panel.fiveiso.com" and http.request.method eq "GET" and http.request.uri.path in {"/" "/panel" "/owner"})
```

Yalnızca tarayıcı giriş sayfaları hedeflenir. /api/agent/*, /api/host/*,
/api/license/activate ve WebSocket rotalarına Challenge koymayın: FiveM bu
HTML doğrulamasını tamamlayamaz. Tüm alan adına Under Attack Mode uygulamayın.
Kuralın gerçek Cloudflare hesabında eklenmesi gerekir; uygulama sahte doğrulama
sayfası göstermez. Bu çalışma için Cloudflare API erişimi sağlanmadı. Canlı kontrolde panel alan
adında Challenge yanıtı görüldü. Yeni FiveM paketleri doğrulama uygulanmayan
api.fiveiso.com üzerinden bağlanır; eski panel.fiveiso.com bağlantılı kaynaklar
yeni pakete geçirilmelidir.

Resmi bilgi: https://developers.cloudflare.com/cloudflare-challenges/concepts/how-challenges-work/
https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/challenge-passage/

## Hostinger e-posta

/etc/fiveiso-panel/panel.env içinde:

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@fiveiso.com
SMTP_PASS=POSTA_KUTUSU_PAROLASI
SMTP_FROM=FiveISO <info@fiveiso.com>
```

Gönderen adresi kullanıcı tarafından doğrulanmalıdır; info.fiveiso.com bir posta
adresi değildir. Parolayı repoya veya sohbete eklemeyin. Değişiklikten sonra
systemctl restart fiveiso-panel. SMTP_USER, SMTP_PASS ve SMTP_FROM tamamlanmadan
kayıt ekranı gönderime açılmaz. TLS sertifika doğrulaması kapatılmaz.

Hostinger resmi ayarları:
https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email

Kayıt kodu 10 dakika geçerli ve tek kullanımlıktır; 5 yanlış deneme kilitler.
IP başına saatte 8, e-posta başına saatte 3 gönderim sınırı vardır; doğrulama için
IP başına 15 dakikada 30 deneme. Kod/parola hashleri saklanır. Gönderim başarısızsa
kayıt tamamlanmaz. Doğrulanan hesap ayrı müşteri alanı açar; yalnızca overview ve
settings görünür, sunucu/lisans ataması için ana yönetici gerekir.
