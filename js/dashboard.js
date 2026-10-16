// ====================================================================
// e-Care Manager & IT Dashboard Logic with Role-Based Controls
// ====================================================================

let allTickets = [];
let currentSelectedTicket = null;
let currentTab = "ALL";
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  // Hanya Lead/Manager dan IT/Dev yang boleh akses Dashboard
  currentUser = Auth.protectPage(["LEAD_MANAGER", "IT_DEV"]);
  if (!currentUser) return;

  // Sesuaikan tampilan awal jika user adalah IT Dev
  const roleInfoBanner = document.getElementById("roleInfoBanner");
  const roleSubheader = document.getElementById("roleSubheader");

  if (currentUser.role === "IT_DEV") {
    roleSubheader.textContent = "IT Engineer & Development Monitor";
    roleInfoBanner.style.display = "block";
    roleInfoBanner.style.background = "rgba(168, 85, 247, 0.15)";
    roleInfoBanner.style.border = "1px solid rgba(168, 85, 247, 0.3)";
    roleInfoBanner.style.color = "#c084fc";
    roleInfoBanner.innerHTML = `💻 <strong>Mode IT Engineer:</strong> Fokus pada antrean tiket berstatus <strong>READY TO DEV</strong> yang sudah disaring oleh Lead/Manager.`;
    
    // Otomatis aktifkan tab READY_TO_DEV untuk IT
    switchTab("READY_TO_DEV");
  } else {
    roleSubheader.textContent = "Lead & Manager Control Center";
    roleInfoBanner.style.display = "block";
    roleInfoBanner.style.background = "rgba(99, 102, 241, 0.15)";
    roleInfoBanner.style.border = "1px solid rgba(99, 102, 241, 0.3)";
    roleInfoBanner.style.color = "#a5b4fc";
    roleInfoBanner.innerHTML = `👑 <strong>Mode Lead / Manager:</strong> Review keluhan dari Sales/Implementor dan naikkan statusnya ke <strong>READY TO DEV</strong> untuk ditangani tim IT.`;
  }

  // Event Listeners
  document.getElementById("refreshBtn").addEventListener("click", loadDashboardData);
  document.getElementById("searchInput").addEventListener("input", filterAndRenderTickets);
  document.getElementById("urgencyFilter").addEventListener("change", filterAndRenderTickets);
  document.getElementById("closeModalBtn").addEventListener("click", () => {
    document.getElementById("detailModal").style.display = "none";
  });

  // Tab Pill Listeners
  document.querySelectorAll(".tab-pill").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const tab = e.currentTarget.getAttribute("data-tab");
      switchTab(tab);
    });
  });

  window.addEventListener("click", (e) => {
    const modal = document.getElementById("detailModal");
    if (e.target === modal) modal.style.display = "none";
  });

  loadDashboardData();
});

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll(".tab-pill").forEach(btn => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const heading = document.getElementById("tableHeadingTitle");
  if (tabName === "READY_TO_DEV") heading.textContent = "🚀 Antrean Tiket IT (Ready to Dev)";
  else if (tabName === "OPEN") heading.textContent = "⏳ Tiket Baru Perlu Review";
  else if (tabName === "RESOLVED") heading.textContent = "✅ Tiket Selesai / Resolved";
  else heading.textContent = "📋 Semua Tiket Masuk";

  filterAndRenderTickets();
}

/**
 * Fetch semua data tiket dari GAS
 */
async function loadDashboardData() {
  const tableBody = document.getElementById("ticketsTableBody");
  const countBadge = document.getElementById("ticketCountBadge");

  if (!CONFIG.GAS_API_URL || CONFIG.GAS_API_URL.includes("MASUKKAN_URL_WEB_APP")) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #f87171;">
          ⚠️ URL Google Apps Script belum disetel di <code>js/config.js</code>.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div class="spinner" style="margin-bottom: 12px;"></div>
        <div>Mengambil data tiket dari Google Sheets...</div>
      </td>
    </tr>
  `;

  try {
    const url = CONFIG.GAS_API_URL + (CONFIG.GAS_API_URL.includes("?") ? "&" : "?") + "action=get_tickets";
    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      allTickets = result.data || [];
      calculateMetrics(allTickets);
      filterAndRenderTickets();
      countBadge.textContent = `${allTickets.length} Total Tiket`;
    } else {
      throw new Error(result.error || "Gagal mengambil data");
    }
  } catch (err) {
    console.error("Dashboard Fetch Error:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #f87171;">
          ❌ Gagal memuat data: ${err.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Hitung Metrik & Tab Badges
 */
function calculateMetrics(tickets) {
  let criticalCount = 0;
  let readyDevCount = 0;
  let openCount = 0;
  let resolvedCount = 0;

  tickets.forEach(t => {
    const urgency = (t.urgency || "").toUpperCase();
    const status = (t.status || "OPEN").toUpperCase();

    if (urgency === "CRITICAL") criticalCount++;
    if (status === "READY_TO_DEV" || status === "IN_DEV") readyDevCount++;
    if (status === "OPEN") openCount++;
    if (status === "RESOLVED") resolvedCount++;
  });

  document.getElementById("statTotal").textContent = tickets.length;
  document.getElementById("statCritical").textContent = criticalCount;
  document.getElementById("statReadyToDev").textContent = readyDevCount;
  document.getElementById("statResolved").textContent = resolvedCount;

  document.getElementById("tabCountAll").textContent = tickets.length;
  document.getElementById("tabCountReadyDev").textContent = readyDevCount;
  document.getElementById("tabCountOpen").textContent = openCount;
  document.getElementById("tabCountResolved").textContent = resolvedCount;
}

/**
 * Filter & Render Tabel Tiket
 */
function filterAndRenderTickets() {
  const searchVal = document.getElementById("searchInput").value.toLowerCase();
  const urgencyVal = document.getElementById("urgencyFilter").value.toUpperCase();
  const tableBody = document.getElementById("ticketsTableBody");

  const filtered = allTickets.filter(t => {
    const status = (t.status || "OPEN").toUpperCase();

    // Tab Filter
    if (currentTab === "READY_TO_DEV" && status !== "READY_TO_DEV" && status !== "IN_DEV") return false;
    if (currentTab === "OPEN" && status !== "OPEN") return false;
    if (currentTab === "RESOLVED" && status !== "RESOLVED") return false;

    // Search filter
    const matchesSearch = 
      (t.ticketId && t.ticketId.toLowerCase().includes(searchVal)) ||
      (t.customerName && t.customerName.toLowerCase().includes(searchVal)) ||
      (t.reporterName && t.reporterName.toLowerCase().includes(searchVal)) ||
      (t.summary && t.summary.toLowerCase().includes(searchVal));

    // Urgency filter
    const matchesUrgency = !urgencyVal || (t.urgency && t.urgency.toUpperCase() === urgencyVal);

    return matchesSearch && matchesUrgency;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Tidak ada tiket dalam kategori ini.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map((t, idx) => {
    const priority = (t.priority || "MEDIUM").toUpperCase();
    const urgency = (t.urgency || "NORMAL").toUpperCase();
    const status = (t.status || "OPEN").toUpperCase();

    const priorityClass = "badge-" + priority.toLowerCase();
    const urgencyClass = "badge-" + urgency.toLowerCase();
    
    let statusClass = "badge-open";
    let statusLabel = status;

    if (status === "READY_TO_DEV") {
      statusClass = "badge-ready_to_dev";
      statusLabel = "🚀 READY TO DEV";
    } else if (status === "IN_DEV") {
      statusClass = "badge-in_dev";
      statusLabel = "⚙️ IN DEVELOPMENT";
    } else if (status === "RESOLVED") {
      statusClass = "badge-resolved";
      statusLabel = "✅ RESOLVED";
    }

    const formattedDate = t.timestamp ? t.timestamp.toString().substring(0, 16) : "-";

    return `
      <tr>
        <td><span class="ticket-id">${escapeHtml(t.ticketId)}</span></td>
        <td style="white-space: nowrap; font-size: 11px; color: var(--text-muted);">${formattedDate}</td>
        <td><strong>${escapeHtml(t.customerName)}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(t.reporterName)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(t.role || 'Sales')}</div>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-direction: column;">
            <span class="badge ${urgencyClass}">⚡ ${urgency}</span>
            <span class="badge ${priorityClass}">🎯 ${priority}</span>
          </div>
        </td>
        <td style="max-width: 280px;">
          <div style="font-size: 12px; color: #e2e8f0; font-weight: 500;">
            ${escapeHtml(t.summary || t.description || '-')}
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
            Kategori: ${escapeHtml(t.category || '-')}
          </div>
        </td>
        <td>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </td>
        <td>
          <button class="btn-action" onclick="openDetailModal('${t.ticketId}')">Periksa</button>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * Buka Modal Detail Tiket & Tombol Role Aksi
 */
window.openDetailModal = function(ticketId) {
  const ticket = allTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return;

  currentSelectedTicket = ticket;

  document.getElementById("modalTicketId").textContent = ticket.ticketId;
  document.getElementById("modalCustomer").textContent = ticket.customerName;

  const prioEl = document.getElementById("modalPriority");
  prioEl.textContent = "PRIORITAS: " + (ticket.priority || "MEDIUM");
  prioEl.className = "badge badge-" + (ticket.priority || "medium").toLowerCase();

  const urgEl = document.getElementById("modalUrgency");
  urgEl.textContent = "URGENSI: " + (ticket.urgency || "NORMAL");
  urgEl.className = "badge badge-" + (ticket.urgency || "normal").toLowerCase();

  const statusEl = document.getElementById("modalStatus");
  statusEl.textContent = "STATUS: " + (ticket.status || "OPEN");
  statusEl.className = "badge " + (ticket.status === "READY_TO_DEV" ? "badge-ready_to_dev" : "badge-open");

  document.getElementById("modalReporterMeta").textContent = 
    `Dilaporkan oleh ${ticket.reporterName} (${ticket.role || 'Sales'}) • ${ticket.reporterEmail || '-'}`;

  document.getElementById("modalOriginalDesc").textContent = ticket.description || "-";
  document.getElementById("modalAiSummary").textContent = ticket.summary || "-";
  document.getElementById("modalAiAction").textContent = ticket.suggestedAction || "-";
  document.getElementById("modalDevNotes").value = ticket.devNotes || "";

  // Render Action Buttons sesuai Role Pengguna
  renderRoleActionButtons(ticket);

  document.getElementById("detailModal").style.display = "flex";
};

/**
 * Render Tombol Aksi Berdasarkan Siapa yang Sedang Login
 */
function renderRoleActionButtons(ticket) {
  const container = document.getElementById("modalActionControls");
  container.innerHTML = "";

  const role = currentUser.role;
  const status = (ticket.status || "OPEN").toUpperCase();

  // 1. TAMPILAN UNTUK LEAD / MANAGER
  if (role === "LEAD_MANAGER") {
    if (status !== "READY_TO_DEV") {
      const btnReady = document.createElement("button");
      btnReady.className = "btn-submit";
      btnReady.style.background = "linear-gradient(135deg, #a855f7, #6366f1)";
      btnReady.style.boxShadow = "none";
      btnReady.innerHTML = "🚀 Naikkan ke READY TO DEV";
      btnReady.onclick = () => submitStatusChange("READY_TO_DEV");
      container.appendChild(btnReady);
    }

    if (status !== "RESOLVED") {
      const btnResolve = document.createElement("button");
      btnResolve.className = "btn-submit";
      btnResolve.style.background = "rgba(16, 185, 129, 0.2)";
      btnResolve.style.border = "1px solid rgba(16, 185, 129, 0.4)";
      btnResolve.style.color = "#34d399";
      btnResolve.style.boxShadow = "none";
      btnResolve.innerHTML = "✅ Selesaikan Langsung (Resolved)";
      btnResolve.onclick = () => submitStatusChange("RESOLVED");
      container.appendChild(btnResolve);
    }
  }

  // 2. TAMPILAN UNTUK IT / DEV
  if (role === "IT_DEV") {
    if (status === "READY_TO_DEV") {
      const btnInDev = document.createElement("button");
      btnInDev.className = "btn-submit";
      btnInDev.style.background = "rgba(6, 182, 212, 0.2)";
      btnInDev.style.border = "1px solid rgba(6, 182, 212, 0.4)";
      btnInDev.style.color = "#22d3ee";
      btnInDev.style.boxShadow = "none";
      btnInDev.innerHTML = "⚙️ Mulai Kerjakan (In Dev)";
      btnInDev.onclick = () => submitStatusChange("IN_DEV");
      container.appendChild(btnInDev);
    }

    if (status === "IN_DEV" || status === "READY_TO_DEV") {
      const btnDone = document.createElement("button");
      btnDone.className = "btn-submit";
      btnDone.style.background = "rgba(16, 185, 129, 0.2)";
      btnDone.style.border = "1px solid rgba(16, 185, 129, 0.4)";
      btnDone.style.color = "#34d399";
      btnDone.style.boxShadow = "none";
      btnDone.innerHTML = "🎉 Selesai & Deployed (Resolved)";
      btnDone.onclick = () => submitStatusChange("RESOLVED");
      container.appendChild(btnDone);
    }
  }
}

/**
 * Kirim Perubahan Status ke GAS Backend
 */
async function submitStatusChange(newStatus) {
  if (!currentSelectedTicket) return;

  const devNotes = document.getElementById("modalDevNotes").value.trim();

  try {
    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "update_status",
        ticketId: currentSelectedTicket.ticketId,
        newStatus: newStatus,
        updatedBy: `${currentUser.name} (${currentUser.role})`,
        devNotes: devNotes
      })
    });

    const result = await response.json();
    if (result.success) {
      alert(`✅ Berhasil! Status tiket ${currentSelectedTicket.ticketId} diubah menjadi ${newStatus}.`);
      document.getElementById("detailModal").style.display = "none";
      loadDashboardData();
    } else {
      throw new Error(result.error || "Gagal update status");
    }
  } catch (err) {
    alert("❌ Gagal update: " + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
