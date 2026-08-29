# FitAtölye CRM - Kurulum Rehberi

Bu paket, tam çalışır durumda FitAtölye CRM uygulamasının kaynak kodunu içerir.

## İçerik
- `backend/` — FastAPI + MongoDB (Python)
- `frontend/` — React 19 + Tailwind + shadcn UI
- `memory/` — PRD ve test bilgileri
- `README.md` — proje özeti
- `design_guidelines.json` — tasarım kılavuzu

## Gereksinimler
- **Python 3.10+**
- **Node.js 18+** ve **Yarn**
- **MongoDB 6+** (yerelde çalışan veya Atlas)

## Yerelde Çalıştırma

### 1) MongoDB'yi başlat
Yerel MongoDB kurulu ise:
```bash
mongod --dbpath /veri/klasörü
```
Alternatif: MongoDB Atlas hesabı açıp bağlantı adresini `.env` dosyasında kullan.

### 2) Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt

# .env dosyasını düzenle
# MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend `http://localhost:8001` adresinde çalışır. İlk başlangıçta demo veri ve yönetici hesabını otomatik oluşturur.

### 3) Frontend
```bash
cd frontend

# .env dosyasında REACT_APP_BACKEND_URL değerini ayarla
# yerelde: REACT_APP_BACKEND_URL=http://localhost:8001

yarn install
yarn start
```

Frontend `http://localhost:3000` adresinde açılır.

### 4) İlk Giriş
Backend `.env` içindeki `ADMIN_EMAIL` ve `ADMIN_PASSWORD` ile giriş yap. Yeni kullanıcıları **Ayarlar → Kullanıcılar → Kullanıcı Ekle** ile oluşturabilirsin.

## Üretim İçin Notlar

- `JWT_SECRET`'ı mutlaka değiştir (rastgele 64 karakterli hex önerilir).
- `CORS_ORIGINS` değerini frontend domain'iyle sınırla (örn. `https://crm.fitatolye.com`).
- `ADMIN_PASSWORD`'ü güçlü bir değere çevir; backend başlarken şifreyi otomatik güncelleyecektir.
- MongoDB üzerinde otomatik oluşturulan index'ler için üretim ortamında yazma yetkisi gerekir.

## Önemli Klasörler
- `backend/server.py` — tüm API endpoint'leri
- `backend/auth.py` — JWT + bcrypt yardımcıları
- `backend/seed.py` — demo veri seed'i
- `frontend/src/pages/` — sayfalar (Dashboard, Leads, Customers, vb.)
- `frontend/src/components/` — ortak UI (Layout, MonthCalendar, WhatsAppPicker)

## Modüller
1. Dashboard (tıklanabilir KPI kartları + drill-down modaller)
2. Potansiyel Müşteriler (Kanban + Liste görünümleri, WhatsApp şablon seçici)
3. Aktif Müşteriler (8 sekmeli profil)
4. Mezunlar Arşivi
5. Takvim ve Görevler (aylık grid, sürükle-onay, hover popover)
6. Raporlar (Excel/PDF dışa aktarma)
7. Ürünler (yönetici katalog yönetimi)
8. Ayarlar (kaynak, aşama, kategori, kullanıcı, otomasyon, WhatsApp şablonları)

İyi çalışmalar!
