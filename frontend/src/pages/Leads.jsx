import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { api, formatError } from "../lib/api";
import { useAuth, formatDateTR, todayISO } from "../lib/auth";
import { toast } from "sonner";
import { Plus, LayoutGrid, List, Search, X, Filter } from "lucide-react";

export default function Leads() {
  const { user, isAdmin } = useAuth();
  const [view, setView] = useState("kanban");
  const [persons, setPersons] = useState([]);
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ q: "", source_id: "", assigned_to: "", priority: "", archived: false });
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState([]);

  const reload = async () => {
    const params = { lifecycle: "lead", ...filters };
    Object.keys(params).forEach((k) => params[k] === "" && delete params[k]);
    const { data } = await api.get("/persons", { params });
    setPersons(data);
  };

  useEffect(() => {
    reload();
    api.get("/ref/stages").then((r) => setStages(r.data.filter((s) => s.active)));
    api.get("/ref/sources").then((r) => setSources(r.data.filter((s) => s.active)));
    api.get("/users").then((r) => setUsers(r.data));
  }, []); // eslint-disable-line

  useEffect(() => { reload(); }, [filters]); // eslint-disable-line

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const pid = result.draggableId;
    const newStage = result.destination.droppableId;
    setPersons((prev) => prev.map((p) => (p.id === pid ? { ...p, sales_stage_id: newStage } : p)));
    try {
      await api.patch(`/persons/${pid}`, { sales_stage_id: newStage });
      toast.success("Aşama güncellendi");
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail));
      reload();
    }
  };

  const userName = (id) => users.find((u) => u.id === id)?.name || "-";
  const sourceName = (id) => sources.find((s) => s.id === id)?.name || "-";

  const bulkAssign = async (uid) => {
    if (selected.length === 0) return;
    await api.post("/persons/bulk-assign", { person_ids: selected, assigned_to: uid });
    toast.success(`${selected.length} kayıt atandı`);
    setSelected([]);
    reload();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{fontFamily:'Manrope'}}>Potansiyel Müşteriler</h1>
          <p className="text-sm text-[#6B7280]">{persons.length} kayıt</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="pill-tabs">
            <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")} data-testid="view-kanban">
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1" /> Kanban
            </button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} data-testid="view-list">
              <List className="w-3.5 h-3.5 inline mr-1" /> Liste
            </button>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)} data-testid="add-lead-btn">
            <Plus className="w-4 h-4" /> Yeni Talep
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#6B7280]" />
          <input
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="İsim, telefon, Instagram..."
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            data-testid="lead-search"
          />
        </div>
        <select className="text-sm border border-[#E5E7EB] rounded-lg px-2 py-1.5" value={filters.source_id} onChange={(e) => setFilters({ ...filters, source_id: e.target.value })} data-testid="filter-source">
          <option value="">Tüm kaynaklar</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {isAdmin && (
          <select className="text-sm border border-[#E5E7EB] rounded-lg px-2 py-1.5" value={filters.assigned_to} onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })} data-testid="filter-consultant">
            <option value="">Tüm danışmanlar</option>
            {users.filter((u) => u.role === "consultant").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <select className="text-sm border border-[#E5E7EB] rounded-lg px-2 py-1.5" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">Öncelik</option>
          <option value="high">Yüksek</option><option value="normal">Normal</option><option value="low">Düşük</option>
        </select>
        <button className="btn-ghost" onClick={() => setFilters({ q: "", source_id: "", assigned_to: "", priority: "", archived: false })}>
          <X className="w-3.5 h-3.5" /> Temizle
        </button>
      </div>

      {isAdmin && selected.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-sm font-medium">{selected.length} kayıt seçildi</span>
          <select className="text-sm border border-emerald-300 rounded-lg px-2 py-1.5" onChange={(e) => e.target.value && bulkAssign(e.target.value)} data-testid="bulk-assign-select">
            <option value="">Danışmana ata...</option>
            {users.filter((u) => u.role === "consultant").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn-ghost text-xs" onClick={() => setSelected([])}>Vazgeç</button>
        </div>
      )}

      {view === "kanban" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto kanban-scroll pb-4">
            {stages.map((stage) => {
              const items = persons.filter((p) => p.sales_stage_id === stage.id);
              return (
                <div key={stage.id} className="min-w-[300px] w-[300px] bg-[#F3F4F6] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="font-semibold text-sm text-[#111827]" style={{fontFamily:'Manrope'}}>{stage.name}</div>
                    <span className="badge-soft bg-white text-[#6B7280]">{items.length}</span>
                  </div>
                  <Droppable droppableId={stage.id}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[100px]">
                        {items.map((p, idx) => (
                          <Draggable key={p.id} draggableId={p.id} index={idx}>
                            {(prov, snap) => (
                              <Link
                                to={`/leads/${p.id}`}
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                data-testid={`lead-card-${p.id}`}
                                className={`block kanban-card ${snap.isDragging ? "dragging" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="font-semibold text-sm text-[#111827]">{p.name}</div>
                                  {p.priority === "high" && <span className="badge-soft bg-red-100 text-red-700">Yüksek</span>}
                                </div>
                                <div className="text-xs text-[#6B7280] space-y-0.5">
                                  <div>{sourceName(p.source_id)}</div>
                                  <div>{userName(p.assigned_to)}</div>
                                  {p.next_followup_date && <div className="text-[#065F46]">Takip: {formatDateTR(p.next_followup_date)}</div>}
                                </div>
                              </Link>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {isAdmin && <th style={{width:30}}></th>}
                <th>Ad Soyad</th><th>Telefon</th><th>Kaynak</th><th>Aşama</th>
                <th>Danışman</th><th>Öncelik</th><th>Takip</th>
              </tr>
            </thead>
            <tbody>
              {persons.map((p) => (
                <tr key={p.id}>
                  {isAdmin && (
                    <td>
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} />
                    </td>
                  )}
                  <td><Link to={`/leads/${p.id}`} className="text-[#065F46] font-medium hover:underline" data-testid={`lead-row-${p.id}`}>{p.name}</Link></td>
                  <td>{p.phone || p.instagram || "-"}</td>
                  <td>{sourceName(p.source_id)}</td>
                  <td>{stages.find((s) => s.id === p.sales_stage_id)?.name || "-"}</td>
                  <td>{userName(p.assigned_to)}</td>
                  <td>
                    <span className={`badge-soft ${p.priority === "high" ? "bg-red-100 text-red-700" : p.priority === "low" ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.priority === "high" ? "Yüksek" : p.priority === "low" ? "Düşük" : "Normal"}
                    </span>
                  </td>
                  <td className="text-sm text-[#6B7280]">{formatDateTR(p.next_followup_date)}</td>
                </tr>
              ))}
              {persons.length === 0 && <tr><td colSpan="8" className="text-center py-10 text-[#6B7280]">Henüz veri yok. Yeni Talep ile başlayın.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <LeadForm onClose={() => setShowForm(false)} onSaved={reload} stages={stages} sources={sources} users={users} isAdmin={isAdmin} currentUserId={user.id} />}
    </div>
  );
}

function LeadForm({ onClose, onSaved, stages, sources, users, isAdmin, currentUserId }) {
  const [f, setF] = useState({
    name: "", phone: "", instagram: "", source_id: sources[0]?.id || "",
    assigned_to: isAdmin ? "" : currentUserId,
    request_date: todayISO(), priority: "normal", last_note: ""
  });
  const [err, setErr] = useState("");
  const [dup, setDup] = useState(null);

  const submit = async (force = false) => {
    setErr("");
    try {
      const { data } = await api.post("/persons", { ...f, force });
      if (data.duplicate) { setDup(data.existing); return; }
      toast.success("Potansiyel müşteri eklendi");
      onSaved(); onClose();
    } catch (e) {
      setErr(formatError(e.response?.data?.detail));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6" data-testid="lead-form-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{fontFamily:'Manrope'}}>Yeni Potansiyel Müşteri</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {dup ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-amber-900 mb-1">Mükerrer kayıt bulundu!</div>
              <div className="text-amber-800">{dup.name} - {dup.phone || dup.instagram} ({dup.lifecycle_status})</div>
            </div>
            <div className="flex gap-2">
              <Link to={`/leads/${dup.id}`} className="btn-ghost flex-1 justify-center" onClick={onClose}>Mevcut profile git</Link>
              {isAdmin && <button className="btn-primary flex-1 justify-center" onClick={() => submit(true)}>Yine de oluştur</button>}
              <button className="btn-ghost" onClick={() => setDup(null)}>Geri</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Ad Soyad *"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="lead-name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefon"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="lead-phone" /></Field>
              <Field label="Instagram"><input className="input" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} data-testid="lead-instagram" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kaynak *"><select className="input" value={f.source_id} onChange={(e) => setF({ ...f, source_id: e.target.value })} data-testid="lead-source">{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Talep Tarihi *"><input type="date" className="input" value={f.request_date} onChange={(e) => setF({ ...f, request_date: e.target.value })} /></Field>
            </div>
            {isAdmin && (
              <Field label="Sorumlu Danışman *"><select className="input" value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })} data-testid="lead-assigned"><option value="">Seçiniz</option>{users.filter((u) => u.role === "consultant").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Öncelik"><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option></select></Field>
              <Field label="Sonraki Takip"><input type="date" className="input" value={f.next_followup_date || ""} onChange={(e) => setF({ ...f, next_followup_date: e.target.value })} /></Field>
            </div>
            <Field label="Not"><textarea className="input" rows={2} value={f.last_note} onChange={(e) => setF({ ...f, last_note: e.target.value })} /></Field>
            {err && <div className="text-sm text-red-600" data-testid="lead-form-error">{err}</div>}
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-ghost" onClick={onClose}>İptal</button>
              <button className="btn-primary" onClick={() => submit(false)} data-testid="lead-form-submit">Kaydet</button>
            </div>
          </div>
        )}
      </div>
      <style>{`.input{width:100%;padding:8px 12px;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;outline:none}.input:focus{border-color:#065F46}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><label className="block text-xs font-semibold text-[#374151] mb-1">{label}</label>{children}</div>);
}
