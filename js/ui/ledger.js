// Ledger UI (minimal): renders decisions list.
export function renderLedger(container) {
  if (!container) return;
  const S = window.SG_StoryState;
  const decs = S ? S.getDecisions() : [];
  container.innerHTML = "";
  const h = document.createElement("h3");
  h.textContent = "The Ledger";
  container.appendChild(h);
  for (const d of decs) {
    const line = document.createElement("div");
    line.className = "ledger-line";
    line.textContent = (d.text || d.id) + (d.choice ? " — " + d.choice : "");
    container.appendChild(line);
  }
  if (!decs.length) {
    const empty = document.createElement("div");
    empty.textContent = "No lines yet.";
    container.appendChild(empty);
  }
}
export function showLedgerStrip(msg) {
  try {
    const el = document.getElementById("ledgerStrip");
    if (el) { el.textContent = msg || "A line was written."; el.style.display = "block"; setTimeout(() => { el.style.display = "none"; }, 1600); }
  } catch {}
}