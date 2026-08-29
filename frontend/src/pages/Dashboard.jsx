import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, formatTRY, formatDateTR } from "../lib/auth";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Users, TrendingUp, X, ChevronRight, Cake } from "lucide-react";

const COLORS = ["#065F46", "#0D9488", "#34D399", "#A7F3D0", "#FBBF24", "#F87171"];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [drill, setDrill] = useState(null); // {kind, title}

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="p-8 text-[#6B7280]">Yükleniyor...</div>;

  const cards = [
    isAdmin && { kind: "unassigned", label: "Atanmamış Potansiyel", value: data.unassigned_leads, icon: AlertTriangle, tone: "amber", testid: "kpi-unassigned" },
    { kind: "today_tasks", label: "Bugünkü Takipler", value: data.today_tasks, icon: CheckCircle2, tone: "emerald", testid: "kpi-today-tasks" },
    { kind: "overdue_tasks", label: "Gecikmiş Görevler", value: data.overdue_tasks, icon: Clock, tone: "red", testid: "kpi-overdue-tasks" },
    { kind: "today_apts", label: "Bugünkü Randevular", value: data.today_appointments, icon: Calendar, tone: "emerald", testid: "kpi-today-apts" },
    { kind: "active_customers", label: "Aktif Müşteriler", value: data.active_customers, icon: Users, tone: "emerald", testid: "kpi-active-customers" },
    { kind: "overdue_payments", label: "Gecikmiş Ödemeler", value: data.overdue_payments, icon: TrendingUp, tone: "red", testid: "kpi-overdue-payments" },
    { kind: "birthdays_today", label: "Bugün Doğum Günü", value: (data.birthdays_today || []).length, icon: Cake, tone: "pink", testid: "kpi-birthdays" },
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => setDrill({ kind: c.kind, title: c.label })}
            className="kpi-card text-left hover:border-[#065F46] hover:shadow-sm transition-all group"
            data-testid={c.testid}
          >
            <div className="flex items-start justify-between mb-2">
              <c.icon className={`w-4 h-4 ${c.tone === "red" ? "text-red-500" : c.tone === "amber" ? "text-amber-500" : c.tone === "pink" ? "text-pink-500" : "text-[#059669]"}`} />
              <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="kpi-value">{c.value}</div>
            <div className="kpi-label">{c.label}</div>
          </button>
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

      {drill && <DrillModal kind={drill.kind} title={drill.title} onClose={() => setDrill(null)} />}
    </div>
  );
}

function DrillModal({ kind, title, onClose }) {
  const [items, setItems] = useState(null);
  const [persons, setPersons] = useState([]);
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const load = async () => {
      let res = [];
      if (kind === "unassigned") res = (await api.get("/persons", { params: { lifecycle: "lead", unassigned: true } })).data;
      else if (kind === "today_tasks") res = (await api.get("/tasks", { params: { today: true } })).data;
      else if (kind === "overdue_tasks") res = (await api.get("/tasks", { params: { overdue: true } })).data;
      else if (kind === "today_apts") res = (await api.get("/appointments", { params: { date_from: today + "T00:00", date_to: today + "T23:59" } })).data;
      else if (kind === "active_customers") res = (await api.get("/persons", { params: { lifecycle: "customer" } })).data;
      else if (kind === "overdue_payments") res = (await api.get("/payments", { params: { overdue: true } })).data;
      else if (kind === "birthdays_today") res = (await api.get("/dashboard")).data.birthdays_today || [];
      setItems(res);
      // load persons map for tasks/appointments/payments
      if (["today_tasks", "overdue_tasks", "today_apts", "overdue_payments"].includes(kind)) {
        const [pc, pl, pg] = await Promise.all([
          api.get("/persons", { params: { lifecycle: "customer" } }),
          api.get("/persons", { params: { lifecycle: "lead" } }),
          api.get("/persons", { params: { lifecycle: "graduate" } }),
        ]);
        setPersons([...pc.data, ...pl.data, ...pg.data]);
      }
    };
    load();
  }, [kind, today]);

  const personName = (pid) => persons.find((p) => p.id === pid)?.name || "-";
  const personRoute = (pid) => {
    const p = persons.find((x) => x.id === pid);
    if (!p) return null;
    return p.lifecycle_status === "lead" ? `/leads/${pid}` : `/customers/${pid}`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="drill-modal">
        <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
          <div>
            <h2 className="font-bold text-lg" style={{fontFamily:'Manrope'}}>{title}</h2>
            {items && <p className="text-xs text-[#6B7280]">{items.length} kayıt</p>}
          </div>
          <button onClick={onClose} data-testid="drill-close"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!items ? (
            <div className="text-center py-10 text-sm text-[#6B7280]">Yükleniyor...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#6B7280]">Kayıt yok.</div>
          ) : (
            <div className="space-y-2">
              {kind === "unassigned" && items.map((p) => (
                <Link key={p.id} to={`/leads/${p.id}`} onClick={onClose} className="block p-3 border border-[#E5E7EB] rounded-lg hover:border-[#065F46] hover:bg-[#F9FAFB]">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-xs text-[#6B7280]">{p.phone || p.instagram || "-"}</div>
                    </div>
                    <span className="badge-soft bg-amber-100 text-amber-800">Atanmamış</span>
                  </div>
                </Link>
              ))}
              {kind === "active_customers" && items.map((p) => (
                <Link key={p.id} to={`/customers/${p.id}`} onClick={onClose} className="block p-3 border border-[#E5E7EB] rounded-lg hover:border-[#065F46] hover:bg-[#F9FAFB]">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-xs text-[#6B7280]">Müşteri: {formatDateTR(p.customer_since)}</div>
                    </div>
                    <span className="badge-soft bg-emerald-100 text-emerald-800">Aktif</span>
                  </div>
                </Link>
              ))}
              {(kind === "today_tasks" || kind === "overdue_tasks") && items.map((t) => {
                const route = t.person_id ? personRoute(t.person_id) : null;
                const inner = (
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm">{t.title}</div>
                      <div className="text-xs text-[#6B7280]">
                        {t.person_id && personName(t.person_id) !== "-" ? `${personName(t.person_id)} · ` : ""}Vade: {formatDateTR(t.due_date)}
                      </div>
                    </div>
                    <span className={`badge-soft ${kind === "overdue_tasks" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                      {kind === "overdue_tasks" ? "Gecikmiş" : "Bugün"}
                    </span>
                  </div>
                );
                return route ? (
                  <Link key={t.id} to={route} onClick={onClose} className="block p-3 border border-[#E5E7EB] rounded-lg hover:border-[#065F46] hover:bg-[#F9FAFB]">{inner}</Link>
                ) : (
                  <div key={t.id} className="p-3 border border-[#E5E7EB] rounded-lg">{inner}</div>
                );
              })}
              {kind === "today_apts" && items.map((a) => {
                const route = personRoute(a.person_id);
                const inner = (
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm">{personName(a.person_id)}</div>
                      <div className="text-xs text-[#6B7280]">{a.type} · {a.date?.slice(11, 16) || ""} · {a.duration_min} dk</div>
                    </div>
                    <span className="badge-soft bg-emerald-100 text-emerald-800">{a.status}</span>
                  </div>
                );
                return route ? (
                  <Link key={a.id} to={route} onClick={onClose} className="block p-3 border border-[#E5E7EB] rounded-lg hover:border-[#065F46] hover:bg-[#F9FAFB]">{inner}</Link>
                ) : (
                  <div key={a.id} className="p-3 border border-[#E5E7EB] rounded-lg">{inner}</div>
                );
              })}
              {kind === "birthdays_today" && items.map((p) => {
                const route = p.lifecycle_status === "lead" ? `/leads/${p.id}` : `/customers/${p.id}`;
                return (
                <Link key={p.id} to={route} onClick={onClose} className="block p-3 border border-[#E5E7EB] rounded-lg hover:border-[#065F46] hover:bg-[#F9FAFB]">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-sm">🎂 {p.name}</div>
                      <div className="text-xs text-[#6B7280]">{p.phone || "-"} · Doğum: {formatDateTR(p.birth_date)}</div>
                    </div>
                    <span className="badge-soft bg-pink-100 text-pink-700">Bugün!</span>
                  </div>
                </Link>
                );
              })}
              {kind === "overdue_payments" && items.map((p) => {
                const route = personRoute(p.person_id);
                const inner = (
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-sm">{personName(p.person_id)}</div>
                      <div className="text-xs text-[#6B7280]">Vade: {formatDateTR(p.due_date)} · {p.method}{p.note ? ` · ${p.note}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-red-600">{formatTRY(p.amount)}</div>
                      <span className="badge-soft bg-red-100 text-red-700 mt-1">Gecikmiş</span>
                    </div>
                  </div>
                );
                return route ? (
                  <Link key={p.id} to={route} onClick={onClose} className="block p-3 border border-[#E5E7EB] rounded-lg hover:border-[#065F46] hover:bg-[#F9FAFB]">{inner}</Link>
                ) : (
                  <div key={p.id} className="p-3 border border-[#E5E7EB] rounded-lg">{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
