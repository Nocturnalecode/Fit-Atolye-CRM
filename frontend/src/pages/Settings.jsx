import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

const REFS = [
  ["sources", "Müşteri Kaynakları"],
  ["stages", "Satış Aşamaları"],
  ["response_categories", "Cevap Kategorileri"],
  ["negative_reasons", "Olumsuzluk Nedenleri"],
  ["tags", "Etiketler"],
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const [active, setActive] = useState("sources");
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState("");
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showUser, setShowUser] = useState(false);
  const [waTemplates, setWaTemplates] = useState([]);
  const [waEditing, setWaEditing] = useState(null);
  const [selected, setSelected] = useState([]); // ids

  const isRef = REFS.map(([k]) => k).includes(active);
  const load = () => { if (isRef) { api.get(`/ref/${active}`).then((r) => setItems(r.data)); setSelected([]); } };
  const loadWa = () => api.get("/wa-templates").then((r) => setWaTemplates(r.data));
  useEffect(() => { load(); if (active === "wa") loadWa(); }, [active]); // eslint-disable-line
  useEffect(() => {
    if (isAdmin) {
      api.get("/users").then((r) => setUsers(r.data));
      api.get("/settings").then((r) => setSettings(r.data));
    }
  }, [isAdmin]);

  const addItem = async () => {
    if (!newName) return;
    try { await api.post(`/ref/${active}`, { name: newName }); setNewName(""); load(); toast.success("Eklendi"); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const toggle = async (it) => {
    await api.patch(`/ref/${active}/${it.id}`, { active: !it.active });
    load();
  };

  // Restore one or many previously-deleted ref items (for undo)
  const restore = async (kind, snapshots) => {
    try {
      for (const s of snapshots) {
        await api.post(`/ref/${kind}`, s);
      }
      toast.success(snapshots.length > 1 ? `${snapshots.length} kayıt geri alındı` : "Geri alındı");
      if (kind === active) load();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
    }
  };

  const deleteWithUndo = async (it) => {
    // Fetch usage first
    let usageText = "";
    try {
      const { data } = await api.get(`/ref/${active}/${it.id}/usage`);
      if (data.total > 0) {
        usageText = `\n\n⚠ Bu kayıt ${data.total} yerde kullanılıyor. Silmek eski kayıtları etkileyebilir.`;
      }
    } catch (_) {}
    if (!window.confirm(`"${it.name}" kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.${usageText}`)) return;
    // Snapshot then delete
    const snapshot = { id: it.id, name: it.name, active: it.active };
    if (it.order != null) snapshot.order = it.order;
    if (it.auto_task_days != null) snapshot.auto_task_days = it.auto_task_days;
    if (it.auto_enabled != null) snapshot.auto_enabled = it.auto_enabled;
    const kind = active;
    try {
      await api.delete(`/ref/${kind}/${it.id}`);
      load();
      toast.success(`"${it.name}" silindi`, {
        duration: 5000,
        action: { label: "Geri Al", onClick: () => restore(kind, [snapshot]) },
      });
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    // Aggregate usage
    let totalUsage = 0;
    try {
      const results = await Promise.all(selected.map((id) => api.get(`/ref/${active}/${id}/usage`).then((r) => r.data.total).catch(() => 0)));
      totalUsage = results.reduce((a, b) => a + b, 0);
    } catch (_) {}
    const suffix = totalUsage > 0 ? `\n\n⚠ Seçili kayıtlar toplam ${totalUsage} yerde kullanılıyor.` : "";
    if (!window.confirm(`${selected.length} kayıt silinsin mi? Bu işlem geri alınamaz.${suffix}`)) return;
    const snapshots = items.filter((it) => selected.includes(it.id)).map((it) => {
      const s = { id: it.id, name: it.name, active: it.active };
      if (it.order != null) s.order = it.order;
      if (it.auto_task_days != null) s.auto_task_days = it.auto_task_days;
      if (it.auto_enabled != null) s.auto_enabled = it.auto_enabled;
      return s;
    });
    const kind = active;
    try {
      for (const id of selected) {
        await api.delete(`/ref/${kind}/${id}`);
      }
      const count = selected.length;
      setSelected([]);
      load();
      toast.success(`${count} kayıt silindi`, {
        duration: 5000,
        action: { label: "Geri Al", onClick: () => restore(kind, snapshots) },
      });
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); load(); }
  };

  const toggleOne = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === items.length ? [] : items.map((i) => i.id));

  if (!isAdmin) return <div className="p-8 text-[#6B7280]">Sadece yönetici erişebilir.</div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <h1 className="text-2xl font-extrabold mb-5" style={{fontFamily:'Manrope'}}>Ayarlar</h1>

      <div className="pill-tabs mb-5">
        {REFS.map(([k, l]) => <button key={k} className={active === k ? "active" : ""} onClick={() => setActive(k)} data-testid={`settings-tab-${k}`}>{l}</button>)}
        <button className={active === "users" ? "active" : ""} onClick={() => setActive("users")}>Kullanıcılar</button>
        <button className={active === "auto" ? "active" : ""} onClick={() => setActive("auto")}>Otomasyon</button>
        <button className={active === "wa" ? "active" : ""} onClick={() => setActive("wa")} data-testid="settings-tab-wa">WhatsApp Şablonları</button>
      </div>

      {REFS.map(([k]) => k).includes(active) && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex gap-2 mb-4">
            <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Yeni ekle..." value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="ref-input" />
            <button className="btn-primary" onClick={addItem} data-testid="ref-add">Ekle</button>
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between mb-3 px-1">
              <label className="flex items-center gap-2 text-xs text-[#6B7280]">
                <input
                  type="checkbox"
                  checked={selected.length === items.length && items.length > 0}
                  onChange={toggleAll}
                  data-testid="ref-select-all"
                />
                <span>Tümünü seç</span>
              </label>
              {selected.length > 0 && (
                <button
                  className="text-xs font-semibold text-red-600 hover:text-red-800 underline"
                  onClick={bulkDelete}
                  data-testid="ref-bulk-delete"
                >
                  Seçilenleri Sil ({selected.length})
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className={`flex justify-between items-center p-3 border rounded-lg ${selected.includes(it.id) ? "bg-[#F0FDF4] border-emerald-200" : ""}`}>
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(it.id)}
                    onChange={() => toggleOne(it.id)}
                    data-testid={`ref-select-${it.id}`}
                  />
                  <span className={it.active ? "" : "text-[#9CA3AF] line-through"}>{it.name}</span>
                </label>
                <div className="flex gap-3 items-center">
                  <button className="btn-ghost text-xs" onClick={() => toggle(it)}>{it.active ? "Pasife Al" : "Aktif Yap"}</button>
                  <button
                    className="text-xs underline text-red-600 hover:text-red-800"
                    data-testid={`delete-ref-${it.id}`}
                    onClick={() => deleteWithUndo(it)}
                  >Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === "users" && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold" style={{fontFamily:'Manrope'}}>Kullanıcılar</h3>
            <button className="btn-primary" onClick={() => setShowUser(true)} data-testid="add-user-btn">Kullanıcı Ekle</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>İşlem</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <React.Fragment key={u.id}>
                <tr>
                  <td>{u.name}</td><td>{u.email}</td>
                  <td>{u.role === "admin" ? "Yönetici" : "Beslenme Koçu"}</td>
                  <td>
                    <div className="flex gap-3 items-center">
                      <button
                        className="text-xs underline text-[#065F46] hover:text-[#047857]"
                        data-testid={`reset-password-${u.id}`}
                        onClick={async () => {
                          const np = window.prompt(`${u.name} için yeni şifre belirleyin (en az 6 karakter):`);
                          if (!np) return;
                          if (np.length < 6) { toast.error("Şifre en az 6 karakter olmalı"); return; }
                          try {
                            await api.patch(`/users/${u.id}`, { password: np });
                            toast.success(`${u.name} için şifre güncellendi`);
                          } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
                        }}
                      >Şifre Sıfırla</button>
                      <button
                        className="text-xs underline text-red-600 hover:text-red-800"
                        data-testid={`delete-user-${u.id}`}
                        onClick={async () => {
                          const me = JSON.parse(localStorage.getItem("fitatolye_user") || "{}");
                          if (u.id === me.id) { toast.error("Kendi hesabınızı silemezsiniz"); return; }
                          if (!window.confirm(`${u.name} kullanıcısı silinsin mi? Bu işlem geri alınamaz. Kullanıcının potansiyelleri ve görevleri atanmamış olarak kalır.`)) return;
                          try {
                            await api.delete(`/users/${u.id}`);
                            toast.success("Kullanıcı silindi");
                            api.get("/users").then((r) => setUsers(r.data));
                          } catch (e) {
                            toast.error(formatError(e.response?.data?.detail));
                          }
                        }}
                      >Sil</button>
                    </div>
                  </td>
                </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active === "auto" && settings && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h3 className="font-bold mb-2" style={{fontFamily:'Manrope'}}>Otomasyon Ayarları</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.auto_enabled} onChange={(e) => setSettings({ ...settings, auto_enabled: e.target.checked })} /> Otomasyon aktif</label>
          <NumRow label="Ulaşılamadı → gün sonra takip" v={settings.days_unreachable} k="days_unreachable" state={settings} set={setSettings} />
          <NumRow label="Düşünecek → gün sonra takip" v={settings.days_thinking} k="days_thinking" state={settings} set={setSettings} />
          <NumRow label="Randevuya gelmedi → aynı gün (0)" v={settings.days_no_show} k="days_no_show" state={settings} set={setSettings} />
          <NumRow label="Üyelik bitişine gün kala görev" v={settings.renewal_task_days} k="renewal_task_days" state={settings} set={setSettings} />
          <NumRow label="Üyelik bitişine gün kala hatırlatma" v={settings.renewal_reminder_days} k="renewal_reminder_days" state={settings} set={setSettings} />
          <button className="btn-primary" onClick={async () => { await api.patch("/settings", settings); toast.success("Kaydedildi"); }} data-testid="save-settings">Kaydet</button>
        </div>
      )}

      {active === "wa" && (
        <div className="bg-white border rounded-xl p-5">
          <div className="flex justify-between mb-4">
            <div>
              <h3 className="font-bold" style={{fontFamily:'Manrope'}}>WhatsApp Şablonları</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Değişkenler: <code className="bg-[#F3F4F6] px-1 rounded">{"{name}"}</code> · <code className="bg-[#F3F4F6] px-1 rounded">{"{consultant}"}</code>
              </p>
            </div>
            <button className="btn-primary" onClick={() => setWaEditing({ name: "", content: "Merhaba {name}, ben {consultant} - FitAtölye danışmanınızım.", is_default: false, active: true })} data-testid="add-wa-tpl">Yeni Şablon</button>
          </div>
          <div className="space-y-2">
            {waTemplates.length === 0 ? <div className="text-center py-6 text-sm text-[#6B7280]">Şablon yok.</div> : waTemplates.map((t) => (
              <div key={t.id} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t.name}</span>
                    {t.is_default && <span className="badge-soft bg-emerald-100 text-emerald-800">Varsayılan</span>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="text-xs underline" onClick={() => setWaEditing(t)} data-testid={`edit-wa-${t.id}`}>Düzenle</button>
                    <button className="text-xs underline text-red-500" onClick={async () => {
                      if (!window.confirm(`"${t.name}" şablonunu silmek istediğinize emin misiniz?`)) return;
                      try { await api.delete(`/wa-templates/${t.id}`); toast.success("Silindi"); loadWa(); }
                      catch (e) { toast.error(formatError(e.response?.data?.detail)); }
                    }} data-testid={`delete-wa-${t.id}`}>Sil</button>
                  </div>
                </div>
                <p className="text-xs text-[#6B7280]">{t.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {waEditing && <WATemplateForm tpl={waEditing} onClose={() => setWaEditing(null)} onSaved={() => { loadWa(); setWaEditing(null); }} />}

      {showUser && <UserForm onClose={() => setShowUser(false)} onSaved={() => api.get("/users").then((r) => setUsers(r.data))} />}
    </div>
  );
}

function NumRow({ label, v, k, state, set }) {
  return <div className="flex justify-between items-center"><span className="text-sm">{label}</span><input type="number" className="w-20 border rounded px-2 py-1 text-sm" value={v} onChange={(e) => set({ ...state, [k]: parseInt(e.target.value) })} /></div>;
}

function UserForm({ onClose, onSaved }) {
  const [f, setF] = useState({ email: "", password: "", name: "", role: "consultant" });
  const submit = async () => {
    try { await api.post("/users", f); toast.success("Kullanıcı eklendi"); onSaved(); onClose(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>Yeni Kullanıcı</h2>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold">Ad</label><input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="user-name" /></div>
          <div><label className="text-xs font-semibold">E-posta</label><input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="user-email" /></div>
          <div><label className="text-xs font-semibold">Şifre</label><input type="password" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} data-testid="user-password" /></div>
          <div><label className="text-xs font-semibold">Rol</label><select className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="consultant">Beslenme Koçu</option><option value="admin">Yönetici</option></select></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="user-save">Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function WATemplateForm({ tpl, onClose, onSaved }) {
  const [f, setF] = useState(tpl);
  const submit = async () => {
    try {
      const body = { name: f.name, content: f.content, is_default: !!f.is_default, active: f.active !== false };
      if (f.id) await api.patch(`/wa-templates/${f.id}`, body);
      else await api.post("/wa-templates", body);
      toast.success("Kaydedildi"); onSaved();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const preview = (f.content || "").replace(/\{name\}/g, "Ahmet").replace(/\{consultant\}/g, "Ayşe Demir");
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6" data-testid="wa-tpl-form">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>{f.id ? "Şablonu Düzenle" : "Yeni Şablon"}</h2>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold">Şablon Adı *</label><input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="wa-tpl-name" /></div>
          <div>
            <label className="text-xs font-semibold">İçerik *</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={4} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} data-testid="wa-tpl-content" />
            <p className="text-[11px] text-[#6B7280] mt-1">Değişken: {"{name}"} kişi adı · {"{consultant}"} danışman adı</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} data-testid="wa-tpl-default" /> Varsayılan yap</label>
          <div className="bg-[#F0FDF4] border border-emerald-200 rounded-lg p-3 text-xs">
            <div className="font-semibold text-[#065F46] mb-1">Önizleme:</div>
            <div className="text-[#111827]">{preview}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="wa-tpl-save">Kaydet</button>
        </div>
      </div>
    </div>
  );
}
