import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { formatTRY, useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Products() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/products").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-extrabold" style={{fontFamily:'Manrope'}}>Ürünler</h1><p className="text-sm text-[#6B7280]">{items.length} ürün</p></div>
        {isAdmin && <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }} data-testid="add-product-btn"><Plus className="w-4 h-4" /> Yeni Ürün</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <div key={p.id} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-[#111827]" style={{fontFamily:'Manrope'}}>{p.name}</div>
                <div className="text-lg font-extrabold text-[#065F46] mt-1">{formatTRY(p.price)}</div>
              </div>
              {p.active ? <span className="badge-soft bg-emerald-100 text-emerald-800">Aktif</span> : <span className="badge-soft bg-gray-100 text-gray-600">Pasif</span>}
            </div>
            {isAdmin && (
              <button className="btn-ghost text-xs mt-3 w-full justify-center" onClick={() => { setEditing(p); setShowForm(true); }} data-testid={`edit-product-${p.id}`}>Düzenle</button>
            )}
          </div>
        ))}
      </div>

      {showForm && <ProductForm product={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const [f, setF] = useState(product || { name: "", price: 0, active: true });
  const submit = async () => {
    try {
      if (product) await api.patch(`/products/${product.id}`, f);
      else await api.post("/products", f);
      toast.success("Kaydedildi"); onSaved(); onClose();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4" style={{fontFamily:'Manrope'}}>{product ? "Ürün Düzenle" : "Yeni Ürün"}</h2>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold">Ad</label><input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="product-name" /></div>
          <div><label className="text-xs font-semibold">Fiyat (₺)</label><input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={f.price} onChange={(e) => setF({ ...f, price: parseFloat(e.target.value) })} data-testid="product-price" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Aktif</label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={submit} data-testid="product-save">Kaydet</button>
        </div>
      </div>
    </div>
  );
}
