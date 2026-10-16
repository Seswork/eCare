// ====================================================================
// e-Care Frontend Logic - Form Input Keluhan (Sales / Implementor)
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

  // Handle Form Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!CONFIG.GAS_API_URL || CONFIG.GAS_API_URL.includes("MASUKKAN_URL_WEB_APP")) {
      alert("⚠️ Perhatian: URL Google Apps Script belum dimasukkan di file js/config.js!");
      return;
    }

    const customerName = document.getElementById("customerName").value.trim();
    const description = document.getElementById("description").value.trim();

    setLoading(true);

    const payload = {
      action: "submit_complaint",
      data: {
        role: currentUser.role,
        reporterName: currentUser.name,
        reporterEmail: currentUser.email,
        customerName: customerName,
        description: description
      }
    };

    try {
      const response = await fetch(CONFIG.GAS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success && result.data) {
        displayAiResult(result.data);
      } else {
        throw new Error(result.error || "Gagal memproses data");
      }
    } catch (err) {
      console.error("Submit Error:", err);
      alert("❌ Terjadi kendala saat mengirim keluhan: " + err.message);
    } finally {
      setLoading(false);
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

    document.getElementById("resCategory").textContent = data.category || "General";
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
      btnText.textContent = "🤖 Menganalisis dengan Gemini 2.0 Flash...";
      btnSpinner.style.display = "inline-block";
    } else {
      btnText.textContent = "🚀 Kirim & Analisis dengan AI";
      btnSpinner.style.display = "none";
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
