import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Link } from "react-router-dom";
import { Users, UserCheck, GraduationCap, Calendar, CheckCircle2, Clock, Mail, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Coaches() {
  const { isAdmin, user } = useAuth();
  const [stats, setStats] = useState(null);

  const load = () => {
    if (isAdmin) api.get("/coaches/stats").then((r) => setStats(r.data));
  };
  useEffect(() => { load(); }, [isAdmin]);

  const handleDelete = async (c) => {
    if (c.id === user?.id) { toast.error("Kendi hesabınızı silemezsiniz"); return; }
    const msg = c.active_customers > 0 || c.leads > 0
      ? `"${c.name}" adlı koçu silmek istediğinize emin misiniz?\n\n${c.active_customers} aktif müşteri ve ${c.leads} potansiyel müşterinin ataması kaldırılacak (kayıtlar silinmez).\n\nBu işlem geri alınamaz.`
      : `"${c.name}" adlı koçu kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`;
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/users/${c.id}`);
      toast.success(`${c.name} silindi`);
      load();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail) || "Silme başarısız");
    }
  };

  if (!isAdmin) return <div className="p-8 text-[#6B7280]">Sadece yönetici erişebilir.</div>;
  if (!stats) return <div className="p-8 text-[#6B7280]">Yükleniyor...</div>;

  const totals = stats.reduce((acc, c) => ({
    leads: acc.leads + c.leads,
    active_customers: acc.active_customers + c.active_customers,
    graduates: acc.graduates + c.graduates,
    appointments: acc.appointments + c.appointments,
    overdue_tasks: acc.overdue_tasks + c.overdue_tasks,
  }), { leads: 0, active_customers: 0, graduates: 0, appointments: 0, overdue_tasks: 0 });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold" style={{fontFamily:'Manrope'}}>Beslenme Koçları</h1>
        <p className="text-sm text-[#6B7280] mt-1">Her koçun anlık performansı ve iş yükü</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <TotalCard label="Toplam Koç" value={stats.length} />
        <TotalCard label="Aktif Müşteri" value={totals.active_customers} />
        <TotalCard label="Potansiyel" value={totals.leads} />
        <TotalCard label="Randevu" value={totals.appointments} />
        <TotalCard label="Gecikmiş Görev" value={totals.overdue_tasks} tone="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((c) => (
          <div key={c.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5" data-testid={`coach-card-${c.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#065F46] font-bold">{c.name[0]}</div>
                <div>
                  <div className="font-bold text-[#111827]" style={{fontFamily:'Manrope'}}>{c.name}</div>
                  <a href={`mailto:${c.email}`} className="text-xs text-[#6B7280] flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</a>
                </div>
              </div>
              {c.overdue_tasks > 0 && <span className="badge-soft bg-red-100 text-red-700">⚠ {c.overdue_tasks}</span>}
              {c.id !== user?.id && (
                <button
                  onClick={() => handleDelete(c)}
                  className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition ml-1"
                  title="Beslenme koçunu sil"
                  data-testid={`coach-delete-${c.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat icon={UserCheck} label="Aktif" value={c.active_customers} tone="emerald" />
              <Stat icon={Users} label="Potansiyel" value={c.leads} />
              <Stat icon={GraduationCap} label="Mezun" value={c.graduates} />
              <Stat icon={Calendar} label="Randevu" value={c.appointments} />
              <Stat icon={CheckCircle2} label="Açık Görev" value={c.open_tasks} />
              <Stat icon={Clock} label="Gecikmiş" value={c.overdue_tasks} tone={c.overdue_tasks > 0 ? "red" : ""} />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-[#059669]" />
                <span className="text-[#6B7280]">Dönüşüm:</span>
                <span className="font-bold text-[#065F46]">%{c.conversion_rate}</span>
              </div>
              <Link to={`/leads?assigned_to=${c.id}`} className="text-xs text-[#065F46] font-semibold hover:underline">Kayıtlarını gör →</Link>
            </div>
          </div>
        ))}
        {stats.length === 0 && (
          <div className="col-span-full bg-white border rounded-xl p-10 text-center text-[#6B7280]">
            Henüz beslenme koçu yok. Ayarlar → Kullanıcılar'dan ekleyebilirsiniz.
          </div>
        )}
      </div>
    </div>
  );
}

function TotalCard({ label, value, tone }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-value ${tone === "red" && value > 0 ? "text-red-600" : ""}`}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div>
      <div className={`flex items-center gap-1 text-xs mb-0.5 ${tone === "red" ? "text-red-500" : tone === "emerald" ? "text-[#059669]" : "text-[#6B7280]"}`}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-lg font-bold ${tone === "red" && value > 0 ? "text-red-600" : "text-[#111827]"}`} style={{fontFamily:'Manrope'}}>{value}</div>
    </div>
  );
}
