// ====================================================================
// e-Care Authentication & Role-Based Access Control (RBAC)
// ====================================================================

const Auth = {
  // Ambil user yang sedang login
  getUser() {
    const raw = localStorage.getItem("ecare_session_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  // Simpan sesi login
  setUser(userData) {
    localStorage.setItem("ecare_session_user", JSON.stringify(userData));
  },

  // Keluar / Logout
  logout() {
    localStorage.removeItem("ecare_session_user");
    window.location.href = "login.html";
  },

  // Proteksi halaman berdasarkan Role
  protectPage(allowedRoles = []) {
    const user = this.getUser();

    // Jika belum login, lempar ke halaman login
    if (!user) {
      window.location.href = "login.html";
      return null;
    }

    // Jika role tidak diizinkan, arahkan ke halaman yang sesuai
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert(`⚠️ Akun kamu (${user.role}) tidak memiliki izin mengakses halaman ini.`);
      if (user.role === "SALES" || user.role === "IMPLEMENTOR") {
        window.location.href = "index.html";
      } else {
        window.location.href = "dashboard.html";
      }
      return null;
    }

    this.renderHeaderUser(user);
    return user;
  },

  // Tampilkan info user & tombol logout di header
  renderHeaderUser(user) {
    const userContainer = document.getElementById("headerUserSection");
    if (!userContainer) return;

    let roleBadgeClass = "badge-low";
    let roleTitle = "Sales";

    if (user.role === "LEAD_MANAGER") {
      roleBadgeClass = "badge-critical";
      roleTitle = "👑 Lead / Manager";
    } else if (user.role === "IT_DEV") {
      roleBadgeClass = "badge-high";
      roleTitle = "💻 IT Engineer";
    } else if (user.role === "IMPLEMENTOR") {
      roleBadgeClass = "badge-medium";
      roleTitle = "🛠️ Implementor";
    } else {
      roleTitle = "💼 Sales";
    }

    userContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="text-align: right; line-height: 1.2;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">${user.name}</div>
          <span class="badge ${roleBadgeClass}" style="font-size: 10px; padding: 2px 6px;">${roleTitle}</span>
        </div>
        <button id="logoutBtn" title="Logout" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600;">
          Keluar 🚪
        </button>
      </div>
    `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
      if (confirm("Yakin ingin keluar dari akun?")) {
        Auth.logout();
      }
    });
  }
};
