# FitAtölye CRM - Product Requirements Document

## Original Problem Statement
Turkish CRM web app for FitAtölye (health/fitness/nutrition consultancy) to prevent losing potential customers, organize follow-ups, convert leads to customers, and keep history in one place. Full requirements captured in initial user brief.

## User Personas
- **Yönetici (Admin)**: Full access to all leads, customers, graduates, memberships, payments, measurements, product sales, reports, settings. Manages consultants and reference data.
- **Danışman (Consultant)**: Access limited to their own assigned persons. Can create contact history, tasks, appointments, memberships, payments, measurements, product sales for own customers.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT bearer auth
- **Frontend**: React 19 + TailwindCSS + shadcn UI + @hello-pangea/dnd (Kanban) + recharts (reports)
- **Auth**: JWT tokens (7 days) stored in localStorage; bcrypt hashing; brute-force lockout (5 fails → 15min); admin auto-seeded from .env
- **DB Collections**: users, persons (unified leads/customers/graduates via lifecycle_status), contacts, tasks, appointments, memberships, payments, measurements, products, product_sales, sources, sales_stages, response_categories, negative_reasons, tags, targets, settings, login_attempts

## What's Been Implemented (2026-02)
- ✅ JWT auth with role-based access (admin/consultant) + brute-force protection
- ✅ 9 modules: Dashboard, Leads (Kanban+List), Customers, Graduates, Calendar/Tasks, Reports, Products, Settings, Login
- ✅ Kanban pipeline with drag-drop stage changes
- ✅ Duplicate check on phone/instagram at create-time with "go to existing" flow
- ✅ Contact history + automatic follow-up task generation from response category (Ulaşılamadı→1 day, Düşünecek→3 days, etc.)
- ✅ Lead→Customer manual conversion with membership creation + payment plan (peşin / 1-4 weekly installments)
- ✅ Full membership lifecycle (Aktif, Donduruldu, Yenilendi, Mezun edildi, İptal etti) with freeze extending end_date
- ✅ Refund calculator: kullanılan gün × (aylık/26)
- ✅ Measurements (16 vücut analiz + mezura alanları), only for customers
- ✅ Product catalog (admin-managed) + sales tied to customers/graduates
- ✅ Financial summary per customer (paid, pending, partial for membership + product)
- ✅ Reports with 7 KPIs + Excel/PDF export via openpyxl/reportlab
- ✅ Settings: reference data CRUD (sources, stages, categories, negative reasons, tags), user management, automation timing
- ✅ Turkish UI throughout, DD.MM.YYYY dates, 24h time, ₺ currency
- ✅ Responsive sidebar layout with mobile menu toggle
- ✅ Demo seed: 9 leads, 2 customers, 1 graduate, 5 products, 3 consultants, sample measurements/payments/tasks

## Backend Tested (90% pass, 81/90)
Critical fixes applied after testing: ref 404 validation, task/appointment/payment/measurement PATCH+DELETE ownership checks, dashboard chart data scoped by role, CORS explicit origins, login brute-force lockout with 429.

## Backlog (P1)
- Audit log for financial edits
- File uploads for contact history (audio/screenshot) via object storage
- Monthly target UI (backend endpoints exist, no UI yet)
- Detail edit view for measurements
- Full appointment calendar view (currently list-based)

## Backlog (P2)
- Instagram/WhatsApp API integration (deferred per spec)
- SMS/Email reminders (deferred per spec)
- Advanced Kanban card customization
