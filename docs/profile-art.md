# Profil kartı görselleri

Üç görsel yerleşik imagegen aracıyla üretildi. PNG dosyalarının alfa kanalı korunmuştur.

- `public/assets/profile/character.png`: Original adult female videogame character, full body, charcoal casual jacket and pants, relaxed confident pose, polished realistic 3D game illustration, neutral silver rim light, transparent background, no text or weapons, facing slightly left for the bottom-right corner of a dark card.
- `public/assets/profile/identity.png`: Layered generic ID cards with a magnifying glass, premium 3D illustration, smoky graphite and silver materials, transparent background, no readable text or logo, compact bottom-right decoration.
- `public/assets/profile/career.png`: Small leather briefcase and generic badge, realistic stylized 3D game illustration, charcoal leather and silver hardware, transparent background, no text or logo, compact bottom-right decoration.

Kart tonları resimlere sabitlenmez; panelin `--section-color` değeri kullanılır.
Oynama süresi varsa ajanın `metadata.playtimeMinutes` alanından alınır. Oluşturulma tarihi varsa `created_at`, `created` veya `metadata.createdAt` alanından gelir. Olmayan bilgiler `none` olarak gösterilir.
Yeni kişisel bilgi düzenlemeleri `dbSetProfile` yetkisiyle korunur. Qbox/QB çevrimiçi değişiklikleri framework üzerinden; çevrimdışı değişiklikler mevcut değer kontrolüyle uygulanır. ESX çevrimiçi kişisel bilgi düzenlemesi desteklenmediğinde ajan açıklayıcı hata döndürür.
