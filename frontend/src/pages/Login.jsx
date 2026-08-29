import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { formatError } from "../lib/api";
import { Flame, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (e) {
      setErr(formatError(e.response?.data?.detail) || "Giriş yapılamadı.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F9FAFB] to-[#ECFDF5] p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#065F46] flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-extrabold tracking-tight" style={{fontFamily:'Manrope'}}>FitAtölye</div>
            <div className="text-xs text-[#6B7280] -mt-0.5">CRM Yönetim Paneli</div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8">
          <h1 className="text-xl font-bold mb-1" style={{fontFamily:'Manrope'}}>Giriş Yap</h1>
          <p className="text-sm text-[#6B7280] mb-6">Hesabınızla oturum açın.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#374151] block mb-1.5">E-posta</label>
              <input
                data-testid="login-email"
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/10 outline-none text-sm"
                placeholder="ornek@fitatolye.com" required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#374151] block mb-1.5">Şifre</label>
              <input
                data-testid="login-password"
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/10 outline-none text-sm"
                placeholder="••••••••" required
              />
            </div>

            {err && <div className="text-sm text-[#DC2626] bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="login-error">{err}</div>}

            <button
              type="submit" disabled={loading}
              data-testid="login-submit"
              className="w-full btn-primary justify-center py-2.5"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
