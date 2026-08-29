import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Download } from "lucide-react";

export default function Reports() {
  const { isAdmin } = useAuth();
  const [kpi, setKpi] = useState(null);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");

  const load = async () => {
    const { data } = await api.get("/reports/kpi", { params: userId ? { user_id: userId } : {} });
    setKpi(data);
  };
  useEffect(() => { load(); api.get("/users").then((r) => setUsers(r.data)); }, []); // eslint-disable-line
  useEffect(() => { load(); }, [userId]); // eslint-disable-line

  const download = async (fmt) => {
    const token = localStorage.getItem("fitatolye_token");
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/reports/export/${fmt}${userId ? `?user_id=${userId}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kpi_raporu.${fmt === "excel" ? "xlsx" : "pdf"}`;
    a.click();
  };

  if (!kpi) return <div className="p-8">Yükleniyor...</div>;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-extrabold" style={{fontFamily:'Manrope'}}>Raporlar</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <select className="text-sm border rounded-lg px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)} data-testid="report-user">
              <option value="">Tüm Ekip</option>
              {users.filter((u) => u.role === "consultant").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button className="btn-ghost" onClick={() => download("excel")} data-testid="export-excel"><Download className="w-4 h-4" /> Excel</button>
          <button className="btn-ghost" onClick={() => download("pdf")} data-testid="export-pdf"><Download className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KCard label="Yeni Talep" v={kpi.new_leads} />
        <KCard label="Arama Sayısı" v={kpi.calls} />
        <KCard label="Randevu" v={kpi.appointments} />
        <KCard label="Dönüşüm Oranı" v={`%${kpi.conversion_rate}`} />
        <KCard label="Yeni Üyelik" v={kpi.new_memberships} />
        <KCard label="Zamanında Tamamlanan" v={kpi.ontime_tasks} />
        <KCard label="Gecikmiş Görev" v={kpi.overdue_tasks} />
      </div>
    </div>
  );
}
function KCard({ label, v }) { return <div className="kpi-card" data-testid={`kpi-${label}`}><div className="kpi-value">{v}</div><div className="kpi-label">{label}</div></div>; }
