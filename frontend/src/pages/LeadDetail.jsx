import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatError } from "../lib/api";
import { formatDateTR, formatDateTimeTR, formatTRY, todayISO, useAuth } from "../lib/auth";
import { toast } from "sonner";
import { ArrowLeft, Phone, Instagram, Plus, UserCheck, Archive } from "lucide-react";
import ReferralPicker from "../components/ReferralPicker";

export default function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [p, setP] = useState(null);
  const [refs, setRefs] = useState({ stages: [], sources: [], categories: [], negatives: [], users: [] });
  const [contacts, setContacts] = useState([]);
  const [referrerName, setReferrerName] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/persons/${id}`);
    setP(data);
    setContacts((await api.get(`/contacts?person_id=${id}`)).data);
    if (data.referred_by_person_id) {
      try {
        const { data: ref } = await api.get(`/persons/${data.referred_by_person_id}`);
        setReferrerName(ref.name);
      } catch { setReferrerName(""); }
    } else {
      setReferrerName("");
    }
  };

  useEffect(() => {
    load();
    Promise.all([
      api.get("/ref/stages"), api.get("/ref/sources"),
      api.get("/ref/response_categories"), api.get("/ref/negative_reasons"),
      api.get("/users"),
    ]).then(([s, sr, c, n, u]) => setRefs({ stages: s.data, sources: sr.data, categories: c.data, negatives: n.data, users: u.data }));
  }, [id]); // eslint-disable-line

  if (!p) return <div className="p-8">Yükleniyor...</div>;

  const update = async (patch) => {
    try { await api.patch(`/persons/${id}`, patch); load(); toast.success("Güncellendi"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const isCustomer = p.lifecycle_status !== "lead";

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <button onClick={() => nav(-1)} className="text-sm text-[#6B7280] flex items-center gap-1 mb-3 hover:text-[#065F46]"><ArrowLeft className="w-4 h-4" /> Geri</button>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold" style={{fontFamily:'Manrope'}}>{p.name}</h1>
            <span className={`badge-soft ${p.lifecycle_status === "customer" ? "bg-emerald-100 text-emerald-800" : p.lifecycle_status === "graduate" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"}`}>
              {p.lifecycle_status === "customer" ? "Aktif Müşteri" : p.lifecycle_status === "graduate" ? "Mezun" : "Potansiyel"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B7280] mt-1">
            {p.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {p.phone}</span>}
            {p.instagram && <span className="flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> {p.instagram}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isCustomer && <button className="btn-primary" onClick={() => setShowConvert(true)} data-testid="convert-btn"><UserCheck className="w-4 h-4" /> Müşteriye Dönüştür</button>}
          <button className="btn-ghost" onClick={() => update({ archived: !p.archived })}><Archive className="w-4 h-4" /> {p.archived ? "Aktif Yap" : "Arşivle"}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: profile info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h3 className="font-bold mb-3" style={{fontFamily:'Manrope'}}>Profil Bilgileri</h3>
            <div className="space-y-3 text-sm">
              <SelectRow label="Aşama" value={p.sales_stage_id} onChange={(v) => update({ sales_stage_id: v })} options={refs.stages} testid="stage-select" />
              <SelectRow label="Cevap Kategorisi" value={p.response_category_id} onChange={(v) => update({ response_category_id: v })} options={refs.categories} allowEmpty />
              <SelectRow label="Kaynak" value={p.source_id} onChange={(v) => update({ source_id: v })} options={refs.sources} />
              {isAdmin && <SelectRow label="Beslenme Koçu" value={p.assigned_to || ""} onChange={(v) => update({ assigned_to: v })} options={refs.users.filter((u) => u.role === "consultant")} allowEmpty />}
              <SelectRow label="Olumsuzluk Nedeni" value={p.negative_reason_id} onChange={(v) => update({ negative_reason_id: v })} options={refs.negatives} allowEmpty />
              <div className="flex justify-between"><span className="text-[#6B7280]">Öncelik</span>
                <select value={p.priority} onChange={(e) => update({ priority: e.target.value })} className="text-sm border border-[#E5E7EB] rounded px-2 py-1">
                  <option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option>
                </select>
              </div>
              <Row label="Talep Tarihi" v={formatDateTR(p.request_date)} />
              {(() => {
                const src = refs.sources.find((s) => s.id === p.source_id);
                const isRef = src && src.name.toLowerCase().includes("referans");
                if (!isRef) return null;
                return (
                  <div>
                    <div className="text-[#6B7280] mb-1">Kimin Referansı</div>
                    <ReferralPicker
                      value={p.referred_by_person_id}
                      valueName={referrerName}
                      onChange={(refId) => update({ referred_by_person_id: refId })}
                      testid="lead-referrer"
                    />
                    {p.referred_by_person_id && referrerName && (
                      <Link to={`/customers/${p.referred_by_person_id}`} className="text-xs text-[#065F46] hover:underline block mt-1">
                        Referans veren müşteriye git →
                      </Link>
                    )}
                  </div>
                );
              })()}
              <div className="flex justify-between items-center gap-2">
                <span className="text-[#6B7280]">Doğum Tarihi</span>
                <input type="date" defaultValue={p.birth_date || ""} onBlur={(e) => e.target.value !== (p.birth_date || "") && update({ birth_date: e.target.value || null })} className="text-sm border border-[#E5E7EB] rounded px-2 py-1 max-w-[60%]" data-testid="lead-birth-input" />
              </div>
              <Row label="Son Güncelleme" v={formatDateTimeTR(p.updated_at)} />
              <Row label="Güncelleyen" v={p.updated_by} />
            </div>
          </div>
        </div>

        {/* Right: contact history */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{fontFamily:'Manrope'}}>İletişim Geçmişi</h3>
              <button className="btn-primary text-xs" onClick={() => setShowContact(true)} data-testid="add-contact-btn"><Plus className="w-3.5 h-3.5" /> Yeni Kayıt</button>
            </div>
            {contacts.length === 0 ? (
              <div className="text-sm text-[#6B7280] text-center py-8">Henüz iletişim kaydı yok.</div>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => (
                  <div key={c.id} className="border border-[#F3F4F6] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-semibold text-[#065F46]">{c.channel}</span>
                      <span className="text-[#6B7280]">{formatDateTimeTR(c.date)}</span>
                    </div>
                    <div className="text-sm text-[#111827]">{c.note || <em className="text-[#6B7280]">Not yok</em>}</div>
                    <div className="flex gap-3 mt-2 text-xs text-[#6B7280]">
                      <span>Kaydeden: {c.user_name}</span>
                      {c.next_followup_date && <span>Sonraki takip: {formatDateTR(c.next_followup_date)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showContact && <ContactForm personId={id} onClose={() => setShowContact(false)} onSaved={load} categories={refs.categories} />}
      {showConvert && <ConvertForm personId={id} onClose={() => setShowConvert(false)} onDone={() => nav(`/customers/${id}`)} />}
    </div>
  );
}

function Row({ label, v }) { return <div className="flex justify-between"><span className="text-[#6B7280]">{label}</span><span className="text-[#111827] font-medium">{v || "-"}</span></div>; }
function SelectRow({ label, value, onChange, options, allowEmpty, testid }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-[#6B7280]">{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="text-sm border border-[#E5E7EB] rounded px-2 py-1 max-w-[60%]" data-testid={testid}>
        {allowEmpty && <option value="">-</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

function ContactForm({ personId, onClose, onSaved, categories }) {
  const [f, setF] = useState({ channel: "Telefon", response_category_id: "", note: "", next_followup_date: "" });
  const submit = async () => {
    try {
      await api.post("/contacts", { person_id: personId, ...f });
      toast.success("İletişim kaydı eklendi");
      onSaved(); onClose();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>Yeni İletişim Kaydı</h2>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold">Kanal</label><select className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} data-testid="contact-channel">
            <option>Telefon</option><option>WhatsApp</option><option>Instagram DM</option><option>Diğer</option></select></div>
          <div><label className="text-xs font-semibold">Cevap Kategorisi</label><select className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.response_category_id} onChange={(e) => setF({ ...f, response_category_id: e.target.value })} data-testid="contact-category">
            <option value="">-</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs font-semibold">Not</label><textarea className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid="contact-note" /></div>
          <div><label className="text-xs font-semibold">Sonraki Takip</label><input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.next_followup_date} onChange={(e) => setF({ ...f, next_followup_date: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="contact-save">Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function ConvertForm({ personId, onClose, onDone }) {
  const [f, setF] = useState({ start_date: todayISO(), monthly_fee: 5000, payment_method: "Havale/EFT", payment_plan: "peşin" });
  const submit = async () => {
    try {
      await api.post(`/persons/${personId}/convert`, f);
      toast.success("Müşteriye dönüştürüldü");
      onDone();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>Müşteriye Dönüştür</h2>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold">Üyelik Başlangıç *</label><input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} data-testid="convert-start" /></div>
          <div><label className="text-xs font-semibold">Aylık Ücret (₺) *</label><input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.monthly_fee} onChange={(e) => setF({ ...f, monthly_fee: parseFloat(e.target.value) })} data-testid="convert-fee" /></div>
          <div><label className="text-xs font-semibold">Ödeme Yöntemi *</label><select className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })} data-testid="convert-method">
            <option>Havale/EFT</option><option>Kredi kartı</option></select></div>
          <div><label className="text-xs font-semibold">Ödeme Planı *</label><select className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.payment_plan} onChange={(e) => setF({ ...f, payment_plan: e.target.value })} data-testid="convert-plan">
            <option value="peşin">Peşin</option><option value="1w">1 haftalık</option><option value="2w">2 haftalık</option><option value="3w">3 haftalık</option><option value="4w">4 haftalık</option></select></div>
          <p className="text-xs text-[#6B7280]">Üyelik bitiş tarihi otomatik olarak 1 ay sonrası oluşturulur.</p>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="convert-save">Dönüştür</button>
        </div>
      </div>
    </div>
  );
}
