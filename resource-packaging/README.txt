FiveISO sunucuya özel kurulum

ZIP'i resources klasörü DIŞINDA açın. FiveM sunucusunu çalıştıran kullanıcıyla kurun.
oxmysql ve framework, fiveiso'dan önce başlatılmış olmalıdır.

Linux:
  bash install.sh /sunucu/server.cfg /sunucu/resources
Windows PowerShell:
  .\install.ps1 -ServerConfig 'C:\sunucu\server.cfg' -Resources 'C:\sunucu\resources'

Kurulum mevcut fiveiso klasörünü ve server.cfg dosyasını yedekler; ensure ve komut
yetkisi satırlarını otomatik ekler. Kimlik, adres veya token yazmanız gerekmez.
Sunucuyu yeniden başlatın veya FiveM konsolunda ensure fiveiso çalıştırın.
Veritabanı uyarlamaları için fiveiso/database-config.lua dosyasını düzenleyebilirsiniz.

İlk bağlantı, lisansı panelin gördüğü çıkış IP'sine ve sunucu parmak izine bağlar.
IP/port/kurulum yolu veya makine değişirse panelde lisansı silip yeniden oluşturun.
Silme eski paketi geçersiz kılar. Yeni paketi indirip tekrar kurun.
Panel erişimi durursa ya da doğrulama 90 saniye boyunca yapılamazsa fiveiso durur.
license.json gizlidir; paylaşmayın veya istemci dosyaları arasına eklemeyin.

Bu paket FiveISO AES-256-GCM korumasını kullanır, Cfx.re FXAP/Asset Escrow değildir.
Kod çalıştığı yetkili makinenin belleğinden alınabilir; çözülemezlik garantisi yoktur.
İstemci kodu yalnızca lisans doğrulandıktan sonra bağlı oyunculara gönderilir.

Güncelleme:
Panelin üstündeki FiveISO indir düğmesini kullanın. Bu işlem lisansı veya bağlı
makineyi değiştirmeden en güncel paketi hazırlar. Kurulum betiğini yeniden çalıştırın;
mevcut database-config.lua korunur. Ardından FiveM konsolunda restart fiveiso çalıştırın.
