import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LayoutDashboard, Users, UserCheck, GraduationCap, Calendar as CalIcon,
  BarChart3, Package, Settings, LogOut, Menu, X, Flame
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/leads", label: "Potansiyel Müşteriler", icon: Users, testid: "nav-leads" },
  { to: "/customers", label: "Aktif Müşteriler", icon: UserCheck, testid: "nav-customers" },
  { to: "/graduates", label: "Mezunlar Arşivi", icon: GraduationCap, testid: "nav-graduates" },
  { to: "/calendar", label: "Takvim ve Görevler", icon: CalIcon, testid: "nav-calendar" },
  { to: "/reports", label: "Raporlar", icon: BarChart3, testid: "nav-reports" },
  { to: "/products", label: "Ürünler", icon: Package, testid: "nav-products" },
  { to: "/settings", label: "Ayarlar", icon: Settings, testid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 z-40 h-screen w-[240px] bg-white border-r border-[#E5E7EB] transform transition-transform flex flex-col shrink-0 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="p-5 flex items-center gap-2 border-b border-[#E5E7EB] shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#065F46] flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-[#111827] tracking-tight" style={{fontFamily:'Manrope'}}>FitAtölye</div>
            <div className="text-[11px] text-[#6B7280] -mt-0.5">CRM v1.0</div>
          </div>
        </div>

        {/* Nav (scrolls if needed) */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto min-h-0">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <n.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer: profile + logout */}
        <div className="p-4 border-t border-[#E5E7EB] bg-white shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#065F46] font-bold text-sm shrink-0">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#111827] truncate">{user?.name}</div>
              <div className="text-[11px] text-[#6B7280]">
                {user?.role === "admin" ? "Yönetici" : "Danışman"}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="logout-btn"
            className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151]"
          >
            <LogOut className="w-4 h-4" /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-white border border-[#E5E7EB] rounded-lg shadow-sm"
        data-testid="mobile-menu-btn"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Main */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
