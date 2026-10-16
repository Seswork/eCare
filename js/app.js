// ====================================================================
// e-Care Frontend Logic - Form Input Keluhan (Sales / Implementor)
// Dilengkapi Fitur Antrean Lokal (Outbox) & Auto-Retry Setiap 3 Menit
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Cek otentikasi login
  const currentUser = Auth.protectPage(["SALES", "IMPLEMENTOR", "LEAD_MANAGER", "IT_DEV"]);
  if (!currentUser) return;

  // Set field pelapor secara otomatis dari sesi akun
  const reporterNameInput = document.getElementById("reporterName");
  const reporterRoleVal = document.getElementById("reporterRoleVal");
  const roleDisplayBadge = document.getElementById("roleDisplayBadge");

  reporterNameInput.value = currentUser.name;
  reporterRoleVal.value = currentUser.role;

  let badgeColor = "badge-low";
  let roleTitle = "Tim Sales";
  if (currentUser.role === "IMPLEMENTOR") {
    badgeColor = "badge-medium";
    roleTitle = "Tim Implementor";
  } else if (currentUser.role === "LEAD_MANAGER") {
    badgeColor = "badge-critical";
    roleTitle = "Lead / Manager";
  } else if (currentUser.role === "IT_DEV") {
    badgeColor = "badge-high";
    roleTitle = "IT / Dev";
  }

  roleDisplayBadge.innerHTML = `<span class="badge ${badgeColor}">${roleTitle}</span>`;

  // Tampilkan link dashboard jika user adalah Lead / Manager / IT
  if (currentUser.role === "LEAD_MANAGER" || currentUser.role === "IT_DEV") {
    const navDashboardLink = document.getElementById("navDashboardLink");
    const bottomNavDashboard = document.getElementById("bottomNavDashboard");
    if (navDashboardLink) navDashboardLink.style.display = "inline-block";
    if (bottomNavDashboard) bottomNavDashboard.style.display = "flex";
  }

  const form = document.getElementById("complaintForm");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = document.getElementById("btnText");
  const btnSpinner = document.getElementById("btnSpinner");
  const aiResultCard = document.getElementById("aiResultCard");
  const resetFormBtn = document.getElementById("resetFormBtn");
  const btnRetryOutbox = document.getElementById("btnRetryOutbox");

  // Inisialisasi Tampilan Outbox saat halaman dibuka
  updateOutboxUI();

  // Jalankan auto-retry otomatis setiap 3 menit (3 * 60 * 1000 ms)
  setInterval(() => {
    processOutboxQueue(false);
  }, 3 * 60 * 1000);

  // Tombol Kirim Ulang Manual
  if (btnRetryOutbox) {
    btnRetryOutbox.addEventListener("click", () => {
      processOutboxQueue(true);
    });
  }

  // Handle Form Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!CONFIG.GAS_API_URL || CONFIG.GAS_API_URL.includes("MASUKKAN_URL_WEB_APP")) {
      alert("⚠️ Perhatian: URL Google Apps Script belum dimasukkan di file js/config.js!");
      return;
    }

    const customerName = document.getElementById("customerName").value.trim();
    const description = document.getElementById("description").value.trim();

    const complaintData = {
      role: currentUser.role,
      reporterName: currentUser.name,
      reporterEmail: currentUser.email,
      customerName: customerName,
      description: description,
      queuedAt: new Date().toISOString()
    };

    setLoading(true);

    try {
      const response = await fetch(CONFIG.GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "submit_complaint",
          data: complaintData
        })
      });

      const result = await response.json();

      // JIKA SUKSES DENGAN AI: Tampilkan Hasil
      if (result.success && result.data) {
        displayAiResult(result.data);
      } 
      // JIKA AI GAGAL / SIBUK: Simpan ke Antrean Lokal (Outbox)
      else if (result.aiFailed || !result.success) {
        saveToOutbox(complaintData);
        alert("⚠️ AI Google sedang mengalami gangguan / sibuk.\n\nLaporan TIDAK dikirim acak-acakan ke dashboard, melainkan DISIMPAN DI ANTREAN LOKAL HP kamu dan akan dicoba kirim otomatis setiap 3 menit!");
        form.reset();
        document.getElementById("reporterName").value = currentUser.name;
      }
    } catch (err) {
      // JIKA KONEKSI INTERNET MATI / OFFLINE: Simpan ke Antrean Lokal juga
      console.warn("Koneksi gagal, simpan ke antrean lokal:", err);
      saveToOutbox(complaintData);
      alert("📡 Koneksi terputus. Laporan berhasil diamankan di antrean HP kamu dan akan otomatis dikirim saat koneksi pulih (setiap 3 menit).");
      form.reset();
      document.getElementById("reporterName").value = currentUser.name;
    } finally {
      setLoading(false);
      updateOutboxUI();
    }
  });

  // Tampilkan Hasil AI
  function displayAiResult(data) {
    document.getElementById("resTicketId").textContent = data.ticketId;

    const priorityEl = document.getElementById("resPriority");
    priorityEl.textContent = data.priority;
    priorityEl.className = "badge badge-" + (data.priority ? data.priority.toLowerCase() : "medium");

    const urgencyEl = document.getElementById("resUrgency");
    urgencyEl.textContent = data.urgency;
    urgencyEl.className = "badge badge-" + (data.urgency ? data.urgency.toLowerCase() : "normal");

    document.getElementById("resCategory").textContent = data.category || "Transaksi & Pembayaran Kasir";
    document.getElementById("resSummary").textContent = data.summary || "-";
    document.getElementById("resAction").textContent = data.suggestedAction || "-";

    aiResultCard.style.display = "block";
    aiResultCard.scrollIntoView({ behavior: "smooth" });
  }

  // Tombol Reset untuk input keluhan baru
  resetFormBtn.addEventListener("click", () => {
    document.getElementById("customerName").value = "";
    document.getElementById("description").value = "";
    aiResultCard.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("customerName").focus();
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnText.textContent = "🤖 Menganalisis dengan Gemini AI...";
      btnSpinner.style.display = "inline-block";
    } else {
      btnText.textContent = "🚀 Kirim & Analisis dengan AI";
      btnSpinner.style.display = "none";
    }
  }

  // ====================================================================
  // SISTEM ANTREAN LOKAL (OUTBOX) & RETRY OTOMATIS
  // ====================================================================

  function getOutbox() {
    const raw = localStorage.getItem("ecare_outbox_queue");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function saveToOutbox(data) {
    const list = getOutbox();
    list.push(data);
    localStorage.setItem("ecare_outbox_queue", JSON.stringify(list));
  }

  function updateOutboxUI() {
    const list = getOutbox();
    const banner = document.getElementById("outboxBanner");
    const countEl = document.getElementById("outboxCount");

    if (!banner || !countEl) return;

    if (list.length > 0) {
      countEl.textContent = list.length;
      banner.style.display = "block";
    } else {
      banner.style.display = "none";
    }
  }

  async function processOutboxQueue(isManualTrigger = false) {
    let list = getOutbox();
    if (list.length === 0) {
      if (isManualTrigger) alert("Semua laporan sudah terkirim! Tidak ada antrean.");
      return;
    }

    if (isManualTrigger) {
      btnRetryOutbox.disabled = true;
      btnRetryOutbox.textContent = "⏳ Mencoba kirim...";
    }

    const remaining = [];
    let successCount = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      try {
        const response = await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "submit_complaint",
            data: item
          })
        });
        const result = await response.json();

        if (result.success && result.data) {
          successCount++;
        } else {
          remaining.push(item); // Masih gagal AI, simpan lagi
        }
      } catch (e) {
        remaining.push(item); // Masih offline/gangguan
      }
    }

    localStorage.setItem("ecare_outbox_queue", JSON.stringify(remaining));
    updateOutboxUI();

    if (isManualTrigger) {
      btnRetryOutbox.disabled = false;
      btnRetryOutbox.textContent = "🔄 Kirim Ulang Sekarang";
    }

    if (successCount > 0) {
      alert(`🎉 Sukses! ${successCount} laporan dari antrean lokal berhasil terkirim & dianalisis AI!`);
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
