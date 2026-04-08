// ============================================================
// Client-side search filter for dashboard
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("clientSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      document.querySelectorAll(".client-card").forEach(card => {
        const text = card.textContent.toLowerCase();
        card.parentElement.style.display = text.includes(q) ? "" : "none";
      });
    });
  }
});

// ============================================================
// Copy credential — calls API, then copies to clipboard
// ============================================================
async function copyField(passwordId, field, btn) {
  try {
    const res = await fetch(`/api/reveal/${passwordId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field }),
    });

    if (!res.ok) throw new Error("Falha na requisição");
    const data = await res.json();

    await navigator.clipboard.writeText(data.value);

    // Visual feedback
    const original = btn.innerHTML;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.classList.add("copied");
    btn.title = "Copiado!";

    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove("copied");
      btn.title = field === "login" ? "Copiar login" : "Copiar senha";
    }, 2000);
  } catch (err) {
    console.error(err);
    showToast("Erro ao copiar. Tente novamente.", "danger");
  }
}

// ============================================================
// Toast notification
// ============================================================
function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `alert alert-${type}`;
  t.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;min-width:260px;animation:fadeIn .3s ease";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ============================================================
// Delete confirmation
// ============================================================
function confirmDelete(form, name) {
  if (confirm(`Deseja realmente excluir "${name}"? Esta ação não pode ser desfeita.`)) {
    form.submit();
  }
}
