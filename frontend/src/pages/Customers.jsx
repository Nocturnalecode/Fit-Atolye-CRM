import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatError } from "../lib/api";
import { formatDateTR, useAuth, calcAge } from "../lib/auth";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ReferralBadge } from "../components/ReferralBadge";

export default function Customers({ lifecycle = "customer", title = "Aktif Müşteriler" }) {
  const { isAdmin } = useAuth();
  const [persons, setPersons] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [referralCounts, setReferralCounts] = useState({});

  const load = () => {
    api.get("/persons", { params: { lifecycle } }).then((r) => setPersons(r.data));
    api.get("/users").then((r) => setUsers(r.data));
    api.get("/persons/referrals/counts").then((r) => setReferralCounts(r.data || {})).catch(() => setReferralCounts({}));
  };

  useEffect(() => { load(); }, [lifecycle]);

  const userName = (id) => users.find((u) => u.id === id)?.name || "-";
  const filtered = persons.filter((p) => !q || (p.name || "").toLowerCase().includes(q.toLowerCase()) || (p.phone || "").includes(q));

  const handleDelete = async (p) => {
    if (!window.confirm(`"${p.name}" adlı kişiyi ve tüm ilişkili kayıtlarını (üyelik, ödeme, ölçüm, randevu, iletişim, satış) kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) return;
    try {
      await api.delete(`/persons/${p.id}`);
      toast.success(`${p.name} silindi`);
      load();
    } catch (e) {
      toast.error(formatError(e.response?.data?.detail) || "Silme başarısız");
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-extrabold mb-1" style={{fontFamily:'Manrope'}}>{title}</h1>
      <p className="text-sm text-[#6B7280] mb-5">{filtered.length} {lifecycle === "customer" ? "müşteri" : lifecycle === "graduate" ? "mezun" : "kayıt"}</p>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 mb-4">
        <input placeholder="Ara..." value={q} onChange={(e) => setQ(e.target.value)} className="w-full text-sm outline-none px-2 py-1" data-testid="customer-search" />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Yaş</th><th>Beslenme Koçu</th><th>Müşteri Olma Tarihi</th>{isAdmin && <th className="w-16 text-right">İşlem</th>}</tr></thead>
          <tbody>
            {filtered.map((p) => {
              const stars = referralCounts[p.id] || 0;
              return (
              <tr key={p.id}>
                <td>
                  <Link to={`/customers/${p.id}`} className="text-[#065F46] font-medium hover:underline inline-flex items-center gap-1.5" data-testid={`customer-row-${p.id}`}>
                    {p.name}
                    {stars > 0 && (
                      <span className="inline-flex items-center gap-0.5" title={`${stars} referans getirdi`} data-testid={`customer-stars-${p.id}`}>
                        {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                        {stars > 5 && <span className="text-[10px] font-semibold text-amber-600">+{stars - 5}</span>}
                      </span>
                    )}
                    <ReferralBadge count={stars} />
                  </Link>
                </td>
                <td>{p.phone || p.instagram || "-"}</td>
                <td className="text-sm">{calcAge(p.birth_date) != null ? calcAge(p.birth_date) : "-"}</td>
                <td>{userName(p.assigned_to)}</td>
                <td className="text-sm text-[#6B7280]">{formatDateTR(p.customer_since)}</td>
                {isAdmin && (
                  <td className="text-right">
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition"
                      title="Kalıcı olarak sil"
                      data-testid={`customer-delete-${p.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-10 text-[#6B7280]">Kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
