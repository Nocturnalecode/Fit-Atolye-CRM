// Utility: format Turkish phone number for wa.me and build greeting URL
export function whatsappLink(phone, personName, consultantName) {
  if (!phone) return null;
  // strip everything except digits
  let d = String(phone).replace(/\D/g, "");
  // Turkish: leading 0 → 90; leading 90 → 90; else prepend 90 if 10 digits
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.startsWith("90")) d = d;
  else if (d.length === 10) d = "90" + d;
  const greeting = `Merhaba ${personName || ""}, ben ${consultantName || "FitAtölye"} - FitAtölye danışmanınızım. Görüşme talebiniz hakkında size ulaşıyorum. 🌿`;
  return `https://wa.me/${d}?text=${encodeURIComponent(greeting)}`;
}
