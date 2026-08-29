import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDateTR, useAuth, calcAge } from "../lib/auth";

export default function Customers({ lifecycle = "customer", title = "Aktif Müşteriler" }) {
  const { isAdmin } = useAuth();
  const [persons, setPersons] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/persons", { params: { lifecycle } }).then((r) => setPersons(r.data));
    api.get("/users").then((r) => setUsers(r.data));
  }, [lifecycle]);

  const userName = (id) => users.find((u) => u.id === id)?.name || "-";
  const filtered = persons.filter((p) => !q || (p.name || "").toLowerCase().includes(q.toLowerCase()) || (p.phone || "").includes(q));

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-extrabold mb-1" style={{fontFamily:'Manrope'}}>{title}</h1>
      <p className="text-sm text-[#6B7280] mb-5">{filtered.length} müşteri</p>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 mb-4">
        <input placeholder="Ara..." value={q} onChange={(e) => setQ(e.target.value)} className="w-full text-sm outline-none px-2 py-1" data-testid="customer-search" />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Yaş</th><th>Danışman</th><th>Müşteri Olma Tarihi</th></tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/customers/${p.id}`} className="text-[#065F46] font-medium hover:underline" data-testid={`customer-row-${p.id}`}>{p.name}</Link></td>
                <td>{p.phone || p.instagram || "-"}</td>
                <td className="text-sm">{calcAge(p.birth_date) != null ? calcAge(p.birth_date) : "-"}</td>
                <td>{userName(p.assigned_to)}</td>
                <td className="text-sm text-[#6B7280]">{formatDateTR(p.customer_since)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-[#6B7280]">Kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
