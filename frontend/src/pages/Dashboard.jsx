import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth, formatTRY, formatDateTR } from "../lib/auth";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Users, TrendingUp } from "lucide-react";

const COLORS = ["#065F46", "#0D9488", "#34D399", "#A7F3D0", "#FBBF24", "#F87171"];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="p-8 text-[#6B7280]">Yükleniyor...</div>;

  const cards = [
    isAdmin && { label: "Atanmamış Potansiyel", value: data.unassigned_leads, icon: AlertTriangle, tone: "amber", testid: "kpi-unassigned" },
    { label: "Bugünkü Takipler", value: data.today_tasks, icon: CheckCircle2, tone: "emerald", testid: "kpi-today-tasks" },
    { label: "Gecikmiş Görevler", value: data.overdue_tasks, icon: Clock, tone: "red", testid: "kpi-overdue-tasks" },
    { label: "Bugünkü Randevular", value: data.today_appointments, icon: Calendar, tone: "emerald", testid: "kpi-today-apts" },
    { label: "Aktif Müşteriler", value: data.active_customers, icon: Users, tone: "emerald", testid: "kpi-active-customers" },
    { label: "Gecikmiş Ödemeler", value: data.overdue_payments, icon: TrendingUp, tone: "red", testid: "kpi-overdue-payments" },
  ].filter(Boolean);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{fontFamily:'Manrope'}}>
          Merhaba, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {isAdmin ? "Yönetici paneli - tüm ekibin performansı" : "Kendi müşterilerin ve görevlerin"}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="kpi-card" data-testid={c.testid}>
            <div className="flex items-start justify-between mb-2">
              <c.icon className={`w-4 h-4 ${c.tone === "red" ? "text-red-500" : c.tone === "amber" ? "text-amber-500" : "text-[#059669]"}`} />
              {c.label === "Atanmamış Potansiyel" && c.value > 0 && (
                <span className="badge-soft bg-amber-100 text-amber-800">Uyarı</span>
              )}
            </div>
            <div className="kpi-value">{c.value}</div>
            <div className="kpi-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="font-bold text-[#111827] mb-4" style={{fontFamily:'Manrope'}}>Kaynaklara Göre Dağılım</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.by_source} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {data.by_source.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{fontSize: 12}} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="font-bold text-[#111827] mb-4" style={{fontFamily:'Manrope'}}>Satış Aşamalarına Göre</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_stage}>
              <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="#065F46" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {isAdmin && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 lg:col-span-2">
            <h3 className="font-bold text-[#111827] mb-4" style={{fontFamily:'Manrope'}}>Danışman Bazlı Dönüşüm</h3>
            <table className="data-table">
              <thead><tr><th>Danışman</th><th>Toplam</th><th>Dönüşen</th><th>Oran</th></tr></thead>
              <tbody>
                {data.conversion_by_consultant.map((c) => (
                  <tr key={c.name}>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.total}</td>
                    <td>{c.converted}</td>
                    <td><span className="badge-soft bg-emerald-100 text-emerald-800">%{c.rate}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 lg:col-span-2">
          <h3 className="font-bold text-[#111827] mb-4" style={{fontFamily:'Manrope'}}>Yenilemesi Yaklaşan Üyelikler</h3>
          {data.memberships_renewing.length === 0 ? (
            <div className="text-sm text-[#6B7280] py-6 text-center">Yaklaşan yenileme yok.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Bitiş Tarihi</th><th>Aylık Ücret</th><th>Durum</th></tr></thead>
              <tbody>
                {data.memberships_renewing.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDateTR(m.end_date)}</td>
                    <td>{formatTRY(m.monthly_fee)}</td>
                    <td><span className="badge-soft bg-amber-100 text-amber-800">{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
