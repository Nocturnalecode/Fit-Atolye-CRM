// Utility: format Turkish phone number for wa.me and build greeting URL
export function normalizePhone(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.startsWith("90")) d = d;
  else if (d.length === 10) d = "90" + d;
  return d;
}

export function renderTemplate(tpl, personName, consultantName) {
  const content = tpl || "Merhaba {name}, ben {consultant} - FitAtölye danışmanınızım. 🌿";
  return content
    .replace(/\{name\}/g, personName || "")
    .replace(/\{consultant\}/g, consultantName || "FitAtölye");
}

export function whatsappLink(phone, personName, consultantName, template) {
  const d = normalizePhone(phone);
  if (!d) return null;
  const msg = renderTemplate(template, personName, consultantName);
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}
