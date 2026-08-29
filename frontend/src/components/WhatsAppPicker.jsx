import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { whatsappLink, renderTemplate, normalizePhone } from "../lib/whatsapp";
import { X, MessageCircle } from "lucide-react";

export default function WhatsAppPicker({ phone, personName, consultantName, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/wa-templates").then((r) => {
      setTemplates(r.data);
      const def = r.data.find((t) => t.is_default) || r.data[0];
      if (def) setSelected(def);
    });
  }, []);

  const open = (tpl) => {
    const url = whatsappLink(phone, personName, consultantName, tpl.content);
    if (url) window.open(url, "_blank", "noopener");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} data-testid="wa-picker">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg" style={{fontFamily:'Manrope'}}>WhatsApp Şablonu Seç</h2>
            <p className="text-xs text-[#6B7280]">{personName} · {phone}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#6B7280]">Henüz şablon yok.</div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${selected?.id === t.id ? "border-[#065F46] bg-[#ECFDF5]" : "border-[#E5E7EB] hover:bg-[#F9FAFB]"}`}
                data-testid={`wa-tpl-${t.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-[#111827]">{t.name}</span>
                  {t.is_default && <span className="badge-soft bg-emerald-100 text-emerald-800">Varsayılan</span>}
                </div>
                <p className="text-xs text-[#6B7280] line-clamp-2">
                  {renderTemplate(t.content, personName, consultantName)}
                </p>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-4 bg-[#F0FDF4] border border-emerald-200 rounded-lg p-3 text-xs text-[#065F46]">
            <div className="font-semibold mb-1">Önizleme:</div>
            <div>{renderTemplate(selected.content, personName, consultantName)}</div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn-primary" disabled={!selected} onClick={() => selected && open(selected)} data-testid="wa-send">
            <MessageCircle className="w-4 h-4" /> WhatsApp'ta Aç
          </button>
        </div>
      </div>
    </div>
  );
}
