import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatError } from "../lib/api";
import { formatDateTR, formatTRY, todayISO, useAuth, calcAge } from "../lib/auth";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const TABS = ["Genel Bakış", "İletişim", "Üyelikler", "Ödemeler", "Ölçümler", "Randevular", "Ürün Satışları", "Notlar"];

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState("Genel Bakış");
  const [p, setP] = useState(null);
  const [financial, setFin] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [modal, setModal] = useState(null);

  const load = async () => {
    const [pr, f, m, py, me, ap, s, pr2, ct] = await Promise.all([
      api.get(`/persons/${id}`),
      api.get(`/persons/${id}/financial`).catch(() => ({ data: null })),
      api.get(`/memberships?person_id=${id}`),
      api.get(`/payments?person_id=${id}`),
      api.get(`/measurements?person_id=${id}`),
      api.get(`/appointments?person_id=${id}`),
      api.get(`/product-sales?person_id=${id}`),
      api.get(`/products?active=true`),
      api.get(`/contacts?person_id=${id}`),
    ]);
    setP(pr.data); setFin(f.data); setMemberships(m.data); setPayments(py.data);
    setMeasurements(me.data); setAppointments(ap.data); setSales(s.data);
    setProducts(pr2.data); setContacts(ct.data);
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!p) return <div className="p-8">Yükleniyor...</div>;

  const activeMem = memberships[0];
  const lastMeas = measurements[0];
  const prevMeas = measurements[1];

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <button onClick={() => nav(-1)} className="text-sm text-[#6B7280] flex items-center gap-1 mb-3"><ArrowLeft className="w-4 h-4" /> Geri</button>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{fontFamily:'Manrope'}}>{p.name}</h1>
          <div className="text-sm text-[#6B7280] mt-1">{p.phone || "-"} · {p.instagram || ""}</div>
        </div>
        <span className={`badge-soft ${p.lifecycle_status === "customer" ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"}`}>
          {p.lifecycle_status === "customer" ? "Aktif Müşteri" : "Mezun"}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SumCard label="Üyelik Bitişi" value={formatDateTR(activeMem?.end_date)} />
        <SumCard label="Son Ölçüm Kilo" value={lastMeas?.weight ? `${lastMeas.weight} kg` : "-"} sub={prevMeas?.weight ? `Δ ${(lastMeas.weight - prevMeas.weight).toFixed(1)} kg` : ""} />
        <SumCard label="Ödenmemiş" value={formatTRY(financial?.total_receivable || 0)} />
        <SumCard label="Toplam Ödeme" value={formatTRY((financial?.paid_membership || 0) + (financial?.paid_product || 0))} />
      </div>

      <div className="pill-tabs mb-5">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)} data-testid={`tab-${t}`}>{t}</button>
        ))}
      </div>

      {tab === "Genel Bakış" && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-2 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Info label="Durum" v={p.lifecycle_status} />
            <Info label="Müşteri Olma" v={formatDateTR(p.customer_since)} />
            <Info label="Öncelik" v={p.priority} />
            <Info label="Aylık Ücret" v={formatTRY(activeMem?.monthly_fee)} />
            <Info label="Ödeme Yöntemi" v={activeMem?.payment_method} />
            <Info label="Ödeme Planı" v={activeMem?.payment_plan} />
            <Info label="Yaş" v={calcAge(p.birth_date) != null ? `${calcAge(p.birth_date)} yaşında` : "-"} />
            <div>
              <div className="text-xs text-[#6B7280]">Doğum Tarihi</div>
              <input
                type="date"
                defaultValue={p.birth_date || ""}
                onBlur={async (e) => {
                  const v = e.target.value;
                  if (v !== (p.birth_date || "")) {
                    try {
                      await api.patch(`/persons/${id}`, { birth_date: v || null });
                      toast.success("Doğum tarihi güncellendi");
                      load();
                    } catch (err) { toast.error("Güncelleme başarısız"); }
                  }
                }}
                className="text-sm font-semibold border border-[#E5E7EB] rounded px-2 py-1 mt-0.5"
                data-testid="customer-birth-date"
              />
            </div>
          </div>
          {financial && (
            <div className="mt-5 border-t pt-4">
              <h4 className="font-bold mb-2" style={{fontFamily:'Manrope'}}>Finansal Özet</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Info label="Ödenmiş Üyelik" v={formatTRY(financial.paid_membership)} />
                <Info label="Ödenmiş Ürün" v={formatTRY(financial.paid_product)} />
                <Info label="Bekleyen Üyelik" v={formatTRY(financial.pending_membership)} />
                <Info label="Bekleyen Ürün" v={formatTRY(financial.pending_product)} />
                <Info label="Kısmi Üyelik" v={formatTRY(financial.partial_membership)} />
                <Info label="Kısmi Ürün" v={formatTRY(financial.partial_product)} />
                <Info label="Genel Toplam" v={formatTRY(financial.total)} />
                <Info label="Tahsil Edilecek" v={formatTRY(financial.total_receivable)} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "İletişim" && (
        <ListPanel title="İletişim Geçmişi" onAdd={null} items={contacts} render={(c) => (
          <div>
            <div className="text-xs text-[#6B7280]">{c.channel} · {formatDateTR(c.date)}</div>
            <div className="text-sm">{c.note}</div>
          </div>
        )} empty="İletişim yok." />
      )}

      {tab === "Üyelikler" && (
        <ListPanel title="Üyelikler" onAdd={() => setModal({ kind: "membership" })} items={memberships} render={(m) => (
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{formatDateTR(m.start_date)} → {formatDateTR(m.end_date)}</div>
              <div className="text-xs text-[#6B7280]">{formatTRY(m.monthly_fee)} · {m.payment_method} · {m.payment_plan}</div>
            </div>
            <div className="flex items-center gap-2">
              <select className="text-xs border rounded px-2 py-1" value={m.status} onChange={async (e) => { await api.patch(`/memberships/${m.id}`, { status: e.target.value }); load(); }} data-testid={`membership-status-${m.id}`}>
                {["Aktif","Donduruldu","Yenileme bekliyor","Yenilendi","Mezun edildi","İptal etti"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )} empty="Üyelik yok." />
      )}

      {tab === "Ödemeler" && (
        <ListPanel title="Ödemeler" onAdd={() => setModal({ kind: "payment" })} items={payments} render={(pay) => (
          <div className="flex flex-wrap justify-between gap-2 items-center">
            <div>
              <div className="text-sm font-medium">{formatTRY(pay.amount)} · Vade: {formatDateTR(pay.due_date)}</div>
              <div className="text-xs text-[#6B7280]">{pay.method} · {pay.note}</div>
            </div>
            <select className="text-xs border rounded px-2 py-1" value={pay.status} onChange={async (e) => { await api.patch(`/payments/${pay.id}`, { status: e.target.value }); load(); }}>
              {["Ödendi","Bekliyor","Kısmi ödendi","Gecikmiş"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )} empty="Ödeme yok." />
      )}

      {tab === "Ölçümler" && (
        <ListPanel title="Ölçümler" onAdd={() => setModal({ kind: "measurement" })} items={measurements} render={(m) => (
          <div>
            <div className="flex justify-between mb-1"><div className="font-medium text-sm">{formatDateTR(m.date)}</div><div className="text-xs text-[#6B7280]">{m.user_name}</div></div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              {[["Kilo",m.weight,"kg"],["Yağ",m.body_fat,"%"],["Kas",m.muscle,"%"],["Su",m.water,"%"],["Göğüs",m.chest,"cm"],["Bel",m.waist,"cm"]].filter(x=>x[1]!=null).map(([k,v,u])=>(
                <div key={k} className="bg-[#F9FAFB] rounded px-2 py-1"><span className="text-[#6B7280]">{k}: </span><span className="font-semibold">{v}{u}</span></div>
              ))}
            </div>
            {m.note && <div className="text-xs text-[#6B7280] mt-2">{m.note}</div>}
          </div>
        )} empty="Ölçüm yok." />
      )}

      {tab === "Randevular" && (
        <ListPanel title="Randevular" onAdd={() => setModal({ kind: "appointment" })} items={appointments} render={(a) => (
          <div className="flex justify-between">
            <div><div className="text-sm font-medium">{formatDateTR(a.date)} · {a.type}</div><div className="text-xs text-[#6B7280]">{a.note}</div></div>
            <select className="text-xs border rounded px-2 py-1" value={a.status} onChange={async (e) => { await api.patch(`/appointments/${a.id}`, { status: e.target.value }); load(); }}>
              {["Planlandı","Onaylandı","Geldi","Gelmedi","İptal edildi","Yeniden planlandı"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )} empty="Randevu yok." />
      )}

      {tab === "Ürün Satışları" && (
        <ListPanel title="Ürün Satışları" onAdd={() => setModal({ kind: "sale" })} items={sales} render={(s) => (
          <div className="flex justify-between items-center">
            <div><div className="text-sm font-medium">{s.product_name} × {s.qty}</div><div className="text-xs text-[#6B7280]">{formatDateTR(s.sale_date)} · {s.method}</div></div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{formatTRY(s.unit_price * s.qty)}</span>
              <button onClick={async () => { if (window.confirm("Silinsin mi?")) { await api.delete(`/product-sales/${s.id}`); load(); } }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          </div>
        )} empty="Satış yok." />
      )}

      {tab === "Notlar" && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5"><div className="text-sm">{p.last_note || "Not yok."}</div></div>
      )}

      {modal && <QuickModal kind={modal.kind} personId={id} products={products} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}

function SumCard({ label, value, sub }) {
  return <div className="kpi-card"><div className="kpi-label">{label}</div><div className="kpi-value text-xl mt-1">{value || "-"}</div>{sub && <div className="text-xs text-[#059669] mt-1">{sub}</div>}</div>;
}
function Info({ label, v }) { return <div><div className="text-xs text-[#6B7280]">{label}</div><div className="text-sm font-semibold">{v || "-"}</div></div>; }
function ListPanel({ title, onAdd, items, render, empty }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex justify-between mb-4"><h3 className="font-bold" style={{fontFamily:'Manrope'}}>{title}</h3>{onAdd && <button className="btn-primary text-xs" onClick={onAdd} data-testid={`add-${title}`}><Plus className="w-3.5 h-3.5" /> Ekle</button>}</div>
      {items.length === 0 ? <div className="text-center py-8 text-sm text-[#6B7280]">{empty}</div> : (
        <div className="space-y-2">{items.map((it) => <div key={it.id} className="border border-[#F3F4F6] rounded-lg p-3">{render(it)}</div>)}</div>
      )}
    </div>
  );
}

function QuickModal({ kind, personId, products, onClose, onSaved }) {
  const [f, setF] = useState(() => {
    if (kind === "membership") return { start_date: todayISO(), monthly_fee: 5000, payment_method: "Havale/EFT", payment_plan: "peşin" };
    if (kind === "payment") return { amount: 0, due_date: todayISO(), method: "Havale/EFT", status: "Bekliyor" };
    if (kind === "measurement") return { date: todayISO(), weight: "", body_fat: "", muscle: "", water: "", chest: "", waist: "", note: "" };
    if (kind === "appointment") return { date: todayISO(), type: "Ölçüm", status: "Planlandı", duration_min: 30, note: "" };
    if (kind === "sale") return { product_id: products[0]?.id || "", qty: 1, unit_price: products[0]?.price || 0, sale_date: todayISO(), method: "Havale/EFT", status: "Ödendi" };
  });
  const submit = async () => {
    try {
      const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "" && v !== null));
      if (kind === "membership") await api.post("/memberships", { person_id: personId, ...clean });
      if (kind === "payment") await api.post("/payments", { person_id: personId, ...clean });
      if (kind === "measurement") await api.post("/measurements", { person_id: personId, ...clean });
      if (kind === "appointment") await api.post("/appointments", { person_id: personId, ...clean });
      if (kind === "sale") await api.post("/product-sales", { person_id: personId, ...clean });
      toast.success("Kayıt eklendi");
      onSaved(); onClose();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>Yeni Kayıt</h2>
        <div className="space-y-3">
          {kind === "sale" && (
            <>
              <F label="Ürün"><select className="inp" value={f.product_id} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); setF({ ...f, product_id: e.target.value, unit_price: p?.price || 0 }); }} data-testid="sale-product">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
              <F label="Adet"><input type="number" className="inp" value={f.qty} onChange={(e) => setF({ ...f, qty: parseInt(e.target.value) })} /></F>
              <F label="Birim Fiyat"><input type="number" className="inp" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: parseFloat(e.target.value) })} /></F>
              <F label="Tarih"><input type="date" className="inp" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></F>
              <F label="Ödeme Yöntemi"><select className="inp" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option>Havale/EFT</option><option>Kredi kartı</option></select></F>
              <F label="Durum"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Ödendi</option><option>Bekliyor</option><option>Kısmi ödendi</option></select></F>
            </>
          )}
          {kind === "measurement" && (
            <div className="grid grid-cols-2 gap-2">
              <F label="Tarih"><input type="date" className="inp" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></F>
              <F label="Kilo (kg)"><input type="number" className="inp" value={f.weight} onChange={(e) => setF({ ...f, weight: parseFloat(e.target.value) })} data-testid="meas-weight" /></F>
              <F label="Yağ %"><input type="number" className="inp" value={f.body_fat} onChange={(e) => setF({ ...f, body_fat: parseFloat(e.target.value) })} /></F>
              <F label="Kas %"><input type="number" className="inp" value={f.muscle} onChange={(e) => setF({ ...f, muscle: parseFloat(e.target.value) })} /></F>
              <F label="Bel (cm)"><input type="number" className="inp" value={f.waist} onChange={(e) => setF({ ...f, waist: parseFloat(e.target.value) })} /></F>
              <F label="Göğüs (cm)"><input type="number" className="inp" value={f.chest} onChange={(e) => setF({ ...f, chest: parseFloat(e.target.value) })} /></F>
            </div>
          )}
          {kind === "appointment" && (
            <>
              <F label="Tarih/Saat"><input type="datetime-local" className="inp" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></F>
              <F label="Tip"><select className="inp" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option>İlk görüşme</option><option>Ölçüm</option><option>Takip</option></select></F>
              <F label="Not"><input className="inp" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></F>
            </>
          )}
          {kind === "membership" && (
            <>
              <F label="Başlangıç"><input type="date" className="inp" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></F>
              <F label="Aylık Ücret"><input type="number" className="inp" value={f.monthly_fee} onChange={(e) => setF({ ...f, monthly_fee: parseFloat(e.target.value) })} /></F>
              <F label="Ödeme"><select className="inp" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}><option>Havale/EFT</option><option>Kredi kartı</option></select></F>
              <F label="Plan"><select className="inp" value={f.payment_plan} onChange={(e) => setF({ ...f, payment_plan: e.target.value })}><option value="peşin">Peşin</option><option value="1w">1w</option><option value="2w">2w</option><option value="3w">3w</option><option value="4w">4w</option></select></F>
            </>
          )}
          {kind === "payment" && (
            <>
              <F label="Tutar"><input type="number" className="inp" value={f.amount} onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value) })} /></F>
              <F label="Vade"><input type="date" className="inp" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></F>
              <F label="Yöntem"><select className="inp" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option>Havale/EFT</option><option>Kredi kartı</option></select></F>
              <F label="Durum"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Bekliyor</option><option>Ödendi</option><option>Kısmi ödendi</option><option>Gecikmiş</option></select></F>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="quickmodal-save">Kaydet</button>
        </div>
      </div>
      <style>{`.inp{width:100%;padding:8px 12px;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;outline:none}.inp:focus{border-color:#065F46}`}</style>
    </div>
  );
}
function F({ label, children }) { return <div><label className="block text-xs font-semibold mb-1">{label}</label>{children}</div>; }
