# FitAtölye CRM

Türkçe arayüzlü, potansiyel müşteri takibi, aktif üyelik yönetimi, ölçüm ve ürün satışı için hazırlanmış tek sayfalık CRM uygulaması.

## Yığın
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React 19 + Tailwind + shadcn UI + @hello-pangea/dnd + recharts
- Kimlik doğrulama: JWT (Bearer token)

## Giriş
- Yönetici: `armaganesralife@gmail.com` / `Admin123!`
- Örnek danışman: `ayse@fitatolye.com` / `Danisman123!`

## Modüller
- Dashboard (yönetici/danışman görünümleri)
- Potansiyel Müşteriler (Kanban + liste, sürükle-bırak, mükerrer kontrolü)
- Aktif Müşteriler ve profilde 8 sekme (Genel Bakış, İletişim, Üyelikler, Ödemeler, Ölçümler, Randevular, Ürün Satışları, Notlar)
- Mezunlar Arşivi
- Takvim ve Görevler
- Raporlar (Excel/PDF dışa aktarma)
- Ürünler
- Ayarlar (kaynak/aşama/kategori/olumsuzluk nedenleri/etiketler, kullanıcılar, otomasyon)

## Notlar
- Uygulama ilk açılışta demo veri seed'ler.
- Otomatik takip görevleri cevap kategorisine göre oluşturulur (ayarlar üzerinden değiştirilebilir).
- Ölçüm kayıtları yalnızca müşteri statüsündeki kayıtlara eklenebilir.
