const CODE_COLORS: Record<string, string> = {
  not_interested: "bg-red-500",
  no_answer: "bg-orange-400",
  not_responding: "bg-orange-400",
  wrong_number: "bg-orange-400",
  not_eligible: "bg-orange-400",
  quote_sent: "bg-violet-500",
  call_back: "bg-blue-500",
  awaiting_photos: "bg-cyan-500",
  follow_up_months: "bg-amber-500",
  whatsapp_message: "bg-teal-500",
  new_lead: "bg-indigo-500",
  won: "bg-emerald-500",
};

/** Stages without a recognized `code` (custom/renamed) fall back to matching legacy name keywords, then grey. */
function legacyNameColorClass(name: string): string {
  const n = name.toLowerCase();

  if (n.includes("pa interes") || n.includes("non interes") || n.includes("mbyllur – pa") || n.includes("lost") || n.includes("humbur") || n.includes("jo interes")) return "bg-red-500";
  if (n.includes("nuk p") || n.includes("non risponde") || n.includes("sbagliato") || n.includes("gabim") || n.includes("idoneo") || n.includes("idonë")) return "bg-orange-400";
  if (n.includes("fituar") || n.includes("won") || n.includes("konfirmuar") || n.includes("trajtim") || n.includes("mbyllur – f") || n.includes("aktiv")) return "bg-emerald-500";
  if (n.includes("call back") || n.includes("richiamo") || n.includes("kontakt") || n.includes("contact")) return "bg-blue-500";
  if (n.includes("preventiv") || n.includes("inviato") || n.includes("vendim") || n.includes("pritje vendim") || n.includes("propozim") || n.includes("negoziaz")) return "bg-violet-500";
  if (n.includes("dërgoi foto") || n.includes("attesa") || n.includes("foto") || n.includes("imazh")) return "bg-cyan-500";
  if (n.includes("interes")) return "bg-indigo-500";
  if (n.includes("whatsapp") || n.includes("messaggio") || n.includes("mesazh")) return "bg-teal-500";
  if (n.includes("dërgoi prev") || n.includes("preventiv")) return "bg-amber-500";

  return "bg-slate-400";
}

export function stageColorClass(name: string, code?: string | null): string {
  if (code && CODE_COLORS[code]) return CODE_COLORS[code];
  return legacyNameColorClass(name);
}

export function stageTextBadge(name: string, code?: string | null): string {
  const bg = stageColorClass(name, code);

  if (bg === "bg-red-500")    return "bg-red-50    text-red-700    border-red-200    dark:bg-red-500/10    dark:text-red-400    dark:border-red-500/20";
  if (bg === "bg-orange-400") return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20";
  if (bg === "bg-emerald-500")return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  if (bg === "bg-blue-500")   return "bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-500/10   dark:text-blue-400   dark:border-blue-500/20";
  if (bg === "bg-violet-500") return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20";
  if (bg === "bg-cyan-500")   return "bg-cyan-50   text-cyan-700   border-cyan-200   dark:bg-cyan-500/10   dark:text-cyan-400   dark:border-cyan-500/20";
  if (bg === "bg-indigo-500") return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
  if (bg === "bg-teal-500")   return "bg-teal-50   text-teal-700   border-teal-200   dark:bg-teal-500/10   dark:text-teal-400   dark:border-teal-500/20";
  if (bg === "bg-amber-500")  return "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-500/10  dark:text-amber-400  dark:border-amber-500/20";
  return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
}

export function stageBorderClass(name: string, code?: string | null): string {
  return stageColorClass(name, code).replace("bg-", "border-");
}
