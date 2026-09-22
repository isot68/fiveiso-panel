# FiveM veritabanı bağlantısı

Ana panel SQLite kullanmaya devam eder. FiveM kayıtları, müşteri sunucusundaki **oxmysql** üzerinden okunur ve düzenlenir. MySQL parolası ana panele gönderilmez; dışarıya MySQL portu açmanız gerekmez. Ana makinenizdeki panel servisine HTTPS/VPN erişimi gerekir.

## Hazır işlemler

- Karakter kimliği/ad ile arama, sayfalama; kayıtlı ad ve soyadı düzenleme.
- Kayıtlı nakit/banka bakiyelerini sorgulama ve yeni toplam bakiye belirleme.
- Sahip kimliği/plaka ile araç arama ve garaj kodunu değiştirme.
- Müşterinin hesap/ekonomi/araç modüllerine, rolüne ve erişim süresine göre API denetimi.
- Önceki değer kontrolü: kayıt sorgudan sonra değiştiyse güncelleme reddedilir.
- İşlem sonuçları talebi açan yönetici ve owner tarafından görülebilir. Ayrıntılı sorgu sonuçları bir saat tutulur; işlem denetim kayıtları kalır. Yeniden bağlanınca sonuç alınamamış komut otomatik tekrarlanmaz.

Owner `/panel` üzerinden tüm sunuculara ulaşabilir. Aktif lisanslı müşteri yalnızca kendi sunucusundaki karakter ve araç kayıtlarını sorgulayıp düzenleyebilir. Tenant ve modül erişim denetimleri her istekte uygulanır.

## Kurulum

1. `musteri-scripti/fiveiso-agent` klasörünü sunucunuzun `resources/[management]/` dizinine kopyalayın. Resource adı `fiveiso-agent` kalsın.
2. Var olan `mysql_connection_string` ayarınızı kullanın. Framework tablolarını yeniden içeri aktarmayın; bu paket mevcut tabloları silmez veya yeniden oluşturmaz.
3. `fiveiso-agent/database-config.lua` dosyasında framework ve garaj sütun eşlemesini kontrol edin.
4. `server.cfg` sırası: `ensure oxmysql`, kullandığınız framework, garaj/envanter kaynakları, en son `ensure fiveiso-agent`.
5. Owner panelden oluşturduğunuz sunucu kimliğini ve anahtarını müşteri scriptinin örnek bağlantı ayarlarına yazın.
6. Konsolda `[FiveISO SQL] ... bağlantısı hazır.` mesajını kontrol edin. Eksik garaj sütunu varsa yalnızca garaj SQL modülü kapanır.
7. Müşteri panelinde Karakter hesapları, Para yönetimi veya Araçlar sayfasındaki **Kayıtlı ...** bölümünden sorgulayın.

## Canlı SQL düzenleme ve oyuncu girişleri

Karakter ve araç SQL düzenlemeleri için bakım ayarı, bekleme veya sunucunun boş olması gerekmez. Güncellemeler önceki değer kontrolüyle doğrudan SQL'e uygulanır; kayıt arada değişmişse işlem güvenli biçimde reddedilir.

Oyuncu girişlerini kapatma, SQL düzenlemesinden bağımsızdır. Panelde **Bağlantı & kurulum → Oyuncu girişleri** bölümünden açılıp kapatılır. Bu anahtar yeni bağlantıları engeller, mevcut oyuncuları atmaz ve resource KVP'sinde kalıcı tutulur.

Garaj kodu mevcut garaj kaynağınızda tanımlı olmalıdır; işlem araç durumunu veya mülkiyetini değiştirmez.

## Desteklenen şemalar

- QBCore / Qbox: `players.citizenid`, `charinfo` JSON, `money` JSON; standart `player_vehicles`.
- ESX Legacy: `users.identifier`, `firstname`, `lastname`, `accounts` JSON; standart `owned_vehicles`.
- ESX garaj sütununun varsayılan adı `parking` olarak yapılandırılmıştır. Sizin kaynağınızda farklıysa `database-config.lua` içindeki eşlemeyi değiştirin. Şema algılaması eşleşmeyen garaj işlemlerini kapatır.
- JSON hesaplarında QBCore/Qbox `cash`/`bank`, ESX `money`/`bank` anahtarları kullanılır. Farklı dizi/özel hesap biçimleri yazmada reddedilir.

Özel garaj veritabanları ve envanter metaverisi farklı olabilir. Bu sürüm çevrimdışı envanter, meslek/çete düzenleme veya karakter silme yapmaz. Canlı FiveM ve gerçek MySQL üzerinde test yapılmadı; API testleri ve üç framework için benzetimli Lua adaptör testleri geçti.

Şema referansları: [QBCore](https://github.com/qbcore-framework/qb-core/blob/main/qbcore.sql), [Qbox](https://github.com/Qbox-project/qbx_core/blob/main/qbx_core.sql), [ESX Legacy](https://github.com/esx-framework/esx_core/blob/main/%5BSQL%5D/legacy.sql), [Qbox araçlar](https://github.com/Qbox-project/qbx_vehicles/blob/main/vehicles.sql), [oxmysql API](https://github.com/overextended/oxmysql/blob/main/lib/MySQL.lua).
