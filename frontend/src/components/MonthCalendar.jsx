import React, { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(year, month) {
  // Returns 6*7 grid of Date objects starting Monday
  const first = new Date(year, month, 1);
  // Monday=0
  const shift = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - shift);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function MonthCalendar({ appointments, onChanged }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const byDay = useMemo(() => {
    const m = {};
    for (const a of appointments) {
      const key = (a.date || "").slice(0, 10);
      if (!m[key]) m[key] = [];
      m[key].push(a);
    }
    return m;
  }, [appointments]);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const aid = result.draggableId;
    const newDate = result.destination.droppableId;
    const apt = appointments.find((a) => a.id === aid);
    if (!apt) return;
    // preserve time part if present
    const timePart = (apt.date || "").includes("T") ? apt.date.slice(10) : "T09:00";
    const newIso = newDate + timePart;
    try {
      await api.patch(`/appointments/${aid}`, { date: newIso });
      toast.success("Randevu taşındı");
      onChanged?.();
    } catch (e) {
      toast.error("Taşıma başarısız");
    }
  };

  const isSameMonth = (d) => d.getMonth() === cursor.getMonth();
  const isToday = (d) => ymd(d) === ymd(today);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4" data-testid="month-calendar">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost !p-1.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} data-testid="month-prev"><ChevronLeft className="w-4 h-4" /></button>
          <div className="font-bold text-lg min-w-[180px] text-center" style={{fontFamily:'Manrope'}}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
          <button className="btn-ghost !p-1.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} data-testid="month-next"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button className="btn-ghost text-xs" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))} data-testid="month-today">Bugün</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => <div key={d} className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide text-center py-1">{d}</div>)}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const key = ymd(d);
            const items = byDay[key] || [];
            return (
              <Droppable droppableId={key} key={key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[90px] rounded-lg border p-1.5 flex flex-col gap-1 transition-colors ${!isSameMonth(d) ? "bg-[#FAFBFC] border-[#F3F4F6]" : "bg-white border-[#E5E7EB]"} ${snapshot.isDraggingOver ? "bg-emerald-50 border-emerald-300" : ""}`}
                    data-testid={`month-cell-${key}`}
                  >
                    <div className={`text-[11px] font-semibold self-end ${isToday(d) ? "text-white bg-[#065F46] rounded-full w-5 h-5 flex items-center justify-center" : isSameMonth(d) ? "text-[#111827]" : "text-[#9CA3AF]"}`}>
                      {d.getDate()}
                    </div>
                    {items.slice(0, 3).map((a, idx) => (
                      <Draggable key={a.id} draggableId={a.id} index={idx}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`text-[10px] leading-tight px-1.5 py-1 rounded truncate cursor-grab ${snap.isDragging ? "shadow-lg" : ""} ${a.status === "Geldi" ? "bg-emerald-100 text-emerald-800" : a.status === "Gelmedi" ? "bg-red-100 text-red-800" : a.status === "İptal edildi" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-800"}`}
                            title={`${a.type} - ${a.status}`}
                            data-testid={`apt-chip-${a.id}`}
                          >
                            {(a.date || "").includes("T") ? a.date.slice(11, 16) : ""} {a.type}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {items.length > 3 && <div className="text-[10px] text-[#6B7280]">+{items.length - 3} daha</div>}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
