import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { X, Search, User } from "lucide-react";

// Small inline picker: search customer/graduate/lead by name and select as referrer.
export default function ReferralPicker({ value, valueName, onChange, testid = "referrer-picker", placeholder = "Müşteri adı ara..." }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState(valueName || "");
  const boxRef = useRef();

  useEffect(() => {
    setSelectedName(valueName || "");
  }, [valueName]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        // Fetch customers + graduates matching q
        const [cust, grad] = await Promise.all([
          api.get("/persons", { params: { lifecycle: "customer", q: query } }),
          api.get("/persons", { params: { lifecycle: "graduate", q: query } }),
        ]);
        if (!cancelled) setResults([...cust.data, ...grad.data].slice(0, 8));
      } catch (_) { if (!cancelled) setResults([]); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const select = (p) => {
    setSelectedName(p.name);
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(p.id, p.name);
  };

  const clear = (e) => {
    e.stopPropagation();
    setSelectedName("");
    onChange(null, null);
  };

  return (
    <div className="relative" ref={boxRef}>
      {value && selectedName ? (
        <div className="flex items-center justify-between border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 text-sm" data-testid={testid}>
          <span className="flex items-center gap-2 text-[#065F46]">
            <User className="w-3.5 h-3.5" />
            {selectedName}
          </span>
          <button type="button" onClick={clear} className="text-[#6B7280] hover:text-red-500" data-testid={`${testid}-clear`}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            className="w-full border border-[#E5E7EB] rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-[#065F46]"
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            data-testid={`${testid}-input`}
          />
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 max-h-56 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#F0FDF4] flex justify-between items-center border-b border-[#F3F4F6] last:border-b-0"
                  data-testid={`${testid}-option-${p.id}`}
                >
                  <span className="font-medium text-[#111827]">{p.name}</span>
                  <span className="text-[11px] text-[#6B7280]">{p.lifecycle_status === "graduate" ? "Mezun" : "Aktif"}</span>
                </button>
              ))}
            </div>
          )}
          {open && query.length >= 2 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-[#6B7280] z-30">
              Eşleşen müşteri bulunamadı.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
