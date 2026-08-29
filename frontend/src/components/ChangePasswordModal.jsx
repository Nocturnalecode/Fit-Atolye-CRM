import React, { useState } from "react";
import { api } from "../lib/api";
import { formatError } from "../lib/api";
import { toast } from "sonner";
import { X, KeyRound } from "lucide-react";

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("Yeni şifre en az 6 karakter olmalı");
    if (next !== confirm) return toast.error("Yeni şifreler eşleşmiyor");
    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Şifreniz değiştirildi");
      onClose();
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} data-testid="change-password-modal">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#065F46]" />
            <h2 className="font-bold text-lg" style={{fontFamily:'Manrope'}}>Şifremi Değiştir</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Mevcut Şifre *</label>
            <input type="password" required className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} data-testid="cp-current" />
          </div>
          <div>
            <label className="text-xs font-semibold">Yeni Şifre *</label>
            <input type="password" required minLength={6} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={next} onChange={(e) => setNext(e.target.value)} data-testid="cp-new" />
            <p className="text-[11px] text-[#6B7280] mt-1">En az 6 karakter</p>
          </div>
          <div>
            <label className="text-xs font-semibold">Yeni Şifre (Tekrar) *</label>
            <input type="password" required className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="cp-confirm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>İptal</button>
            <button type="submit" className="btn-primary" disabled={loading} data-testid="cp-save">Değiştir</button>
          </div>
        </form>
      </div>
    </div>
  );
}
