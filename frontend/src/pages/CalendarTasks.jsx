import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { formatDateTR, todayISO } from "../lib/auth";
import { toast } from "sonner";
import { Plus, Check, Trash2, LayoutGrid, List as ListIcon } from "lucide-react";
import MonthCalendar from "../components/MonthCalendar";

export default function CalendarTasks() {
  const [tasks, setTasks] = useState([]);
  const [appts, setAppts] = useState([]);
  const [persons, setPersons] = useState([]);
  const [filter, setFilter] = useState("all");
  const [aptView, setAptView] = useState("month"); // month | list
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [t, a, pc, pg] = await Promise.all([
      api.get("/tasks"),
      api.get("/appointments"),
      api.get("/persons", { params: { lifecycle: "customer" } }),
      api.get("/persons", { params: { lifecycle: "graduate" } }),
    ]);
    setTasks(t.data); setAppts(a.data);
    setPersons([...pc.data, ...pg.data]);
  };
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const filtered = tasks.filter((t) => {
    if (filter === "today") return t.due_date === today && !t.done;
    if (filter === "overdue") return t.due_date < today && !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  const toggle = async (t) => {
    await api.patch(`/tasks/${t.id}`, { done: !t.done });
    load();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold" style={{fontFamily:'Manrope'}}>Takvim ve Görevler</h1>
          <p className="text-sm text-[#6B7280]">{filtered.length} görev · {appts.length} randevu</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)} data-testid="add-task-btn"><Plus className="w-4 h-4" /> Görev Ekle</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointments (2/3) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold" style={{fontFamily:'Manrope'}}>Randevular</h3>
            <div className="pill-tabs">
              <button className={aptView === "month" ? "active" : ""} onClick={() => setAptView("month")} data-testid="apt-view-month"><LayoutGrid className="w-3.5 h-3.5 inline mr-1" /> Ay</button>
              <button className={aptView === "list" ? "active" : ""} onClick={() => setAptView("list")} data-testid="apt-view-list"><ListIcon className="w-3.5 h-3.5 inline mr-1" /> Liste</button>
            </div>
          </div>
          {aptView === "month" ? (
            <MonthCalendar appointments={appts} persons={persons} onChanged={load} />
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              {appts.length === 0 ? <div className="text-center py-8 text-sm text-[#6B7280]">Randevu yok.</div> : (
                <div className="space-y-2">
                  {appts.slice(0, 30).map((a) => (
                    <div key={a.id} className="p-3 border rounded-lg">
                      <div className="text-sm font-medium">{a.type} · {formatDateTR(a.date)}</div>
                      <div className="text-xs text-[#6B7280]">{a.status} · {a.duration_min} dk</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tasks (1/3) */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{fontFamily:'Manrope'}}>Görevler</h3>
          </div>
          <div className="pill-tabs mb-3 !flex-wrap">
            {[["all","Tümü"],["today","Bugün"],["overdue","Gecikmiş"],["done","Bitti"]].map(([k,l]) => (
              <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)} data-testid={`filter-${k}`}>{l}</button>
            ))}
          </div>
          {filtered.length === 0 ? <div className="text-center py-8 text-sm text-[#6B7280]">Görev yok.</div> : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2.5 border rounded-lg">
                  <button onClick={() => toggle(t)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${t.done ? "bg-[#065F46] border-[#065F46]" : "border-[#E5E7EB]"}`} data-testid={`task-toggle-${t.id}`}>
                    {t.done && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${t.done ? "line-through text-[#9CA3AF]" : ""}`}>{t.title}</div>
                    <div className="text-xs text-[#6B7280]">{formatDateTR(t.due_date)} {t.due_date < today && !t.done && <span className="text-red-600 font-medium">· Gecikmiş</span>}</div>
                  </div>
                    <button onClick={async () => {
                      if (!window.confirm(`"${t.title}" görevini silmek istediğinize emin misiniz?`)) return;
                      await api.delete(`/tasks/${t.id}`);
                      toast.success("Görev silindi");
                      load();
                    }} data-testid={`task-delete-${t.id}`}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && <TaskForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function TaskForm({ onClose, onSaved }) {
  const [f, setF] = useState({ title: "", due_date: todayISO(), type: "manual" });
  const submit = async () => {
    try { await api.post("/tasks", f); toast.success("Görev eklendi"); onSaved(); onClose(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>Yeni Görev</h2>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold">Başlık *</label><input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="task-title" /></div>
          <div><label className="text-xs font-semibold">Vade Tarihi *</label><input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="task-save">Kaydet</button>
        </div>
      </div>
    </div>
  );
}
