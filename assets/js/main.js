/**
 * ==========================================================================
 * MAIN.JS - DASHBOARD UI LOGIC & REAL-TIME DATA ROUTER (FULLY ALIGNED)
 * Sistem Monitoring Smart Fertigation - Cabai
 * Handlers: Dynamic Sidebar, Navigation Highlighter, Mobile Menu, & UI Parsers
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
    const sidebarContainer = document.getElementById("sidebar");

    // ==========================================
    // 1. MEMUAT KOMPONEN SIDEBAR (ASYNCHRONOUS)
    // ==========================================
    if (sidebarContainer) {
        fetch("Components/Sidebar.html")
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                // Masukkan komponen HTML ke dalam container sidebar
                sidebarContainer.innerHTML = data;
                
                // Tandai menu yang aktif sesuai URL halaman saat ini
                highlightActiveMenu();

                // Periksa status MQTT awal jika client sudah terhubung lebih dulu
                if (window.mqttClient && typeof window.mqttClient.isConnected === 'function') {
                    const isConnected = window.mqttClient.isConnected();
                    window.updateStatusBadge(isConnected);
                }
            })
            .catch(err => console.error("[UI] Gagal memuat komponen sidebar:", err));
    }

    // ==========================================
    // 2. MENANDAI HALAMAN YANG AKTIF (HIGHLIGHT)
    // ==========================================
    function highlightActiveMenu() {
        const currentPath = window.location.pathname.split("/").pop().split("?")[0] || "index.html";
        
        // Pemetaan rute halaman ke ID elemen navigasi di Sidebar.html
        let activeMenuId = "nav-index"; 
        if (currentPath === "kalibrasi.html") activeMenuId = "nav-kalibrasi";
        if (currentPath === "riwayat.html") activeMenuId = "nav-riwayat";

        const activeItem = document.getElementById(activeMenuId);
        if (activeItem) {
            activeItem.classList.remove("text-slate-400", "hover:bg-slate-800");
            activeItem.classList.add("bg-emerald-500/10", "text-emerald-400", "font-semibold");
        }
    }

    // ==========================================
    // 3. MENU TOGGLE MOBILE (EVENT DELEGATION)
    // ==========================================
    document.addEventListener("click", function (event) {
        if (event.target.closest("#menu-toggle") || event.target.closest(".hamburger-btn")) {
            if (sidebarContainer) {
                sidebarContainer.classList.toggle("sidebar-active");
            }
        }
        
        // Menutup sidebar otomatis jika user mengklik area di luar sidebar
        if (!event.target.closest("#sidebar") && !event.target.closest("#menu-toggle") && !event.target.closest(".hamburger-btn")) {
            if (sidebarContainer && sidebarContainer.classList.contains("sidebar-active")) {
                sidebarContainer.classList.remove("sidebar-active");
            }
        }
    });
});

// ==========================================================================
// 4. GLOBAL HANDLER: PARSE INCOMING DATA (Diselaraskan dengan ID index.html)
// ==========================================================================

/**
 * Memperbarui teks nilai indikator numerik utama di dashboard utama.
 * @param {Object} payload - Objek JSON data sensor dari broker MQTT.
 */
window.parseIncomingJSON = function (payload) {
    if (!payload) return;

    try {
        // 1. Pembaruan teks nilai Sensor pH digital (ID: val-ph)
        if (payload.ph !== undefined && payload.ph !== null) {
            const phEl = document.getElementById('val-ph');
            if (phEl) phEl.innerText = parseFloat(payload.ph).toFixed(2);
        }

        // 2. Pembaruan teks nilai Sensor TDS Nutrisi (ID: val-tds)
        if (payload.tds !== undefined && payload.tds !== null) {
            const tdsEl = document.getElementById('val-tds');
            if (tdsEl) tdsEl.innerText = parseInt(payload.tds);
        }

        // 3. Pembaruan cap waktu pembaruan terakhir (ID: last-update-time)
        const timeEl = document.getElementById('last-update-time');
        if (timeEl) {
            const now = new Date();
            timeEl.innerText = now.toTimeString().split(' ')[0];
        }

        // 4. Meneruskan data ke fungsi bawaan lokal di index.html (untuk update badge status, level air, dan grafik)
        // Ini mendeteksi jika fungsi-fungsi di tag <script> index.html Anda tersedia
        if (typeof updateBadgeStatus === "function") {
            updateBadgeStatus('ph', payload.ph, payload.ph <= 4.5, payload.ph >= 7.5);
            updateBadgeStatus('tds', payload.tds, payload.tds <= 1400, payload.tds >= 1800);
        }
        
        if (typeof calculateFuzzyMemberships === "function") {
            calculateFuzzyMemberships(payload);
        }

        if (window.updateDashboardChart) {
            window.updateDashboardChart(payload.ph, payload.tds);
        }

    } catch (error) {
        console.error("[UI Parser] Gagal merender data teks numerik:", error);
    }
};

/**
 * Memperbarui visual komponen pada panel kontrol status relay & bar PWM utama.
 * @param {Object} payload - Objek JSON status kontrol dari broker MQTT.
 */
window.updateActuatorPanel = function (payload) {
    if (!payload) return;

    // Pemetaan ID sesuai dengan struktur fungsi updateRelayUI bawaan index.html Anda
    // Mencocokkan property incoming MQTT ke variabel lokal index.html
    if (typeof updateRelayUI === "function") {
        if (payload.relay_ph_up !== undefined) updateRelayUI('phup', parseInt(payload.relay_ph_up) === 1);
        if (payload.relay_ph_down !== undefined) updateRelayUI('phdown', parseInt(payload.relay_ph_down) === 1);
        if (payload.relay_nutrisi_a !== undefined) updateRelayUI('nut1', parseInt(payload.relay_nutrisi_a) === 1);
        if (payload.relay_nutrisi_b !== undefined) updateRelayUI('nut2', parseInt(payload.relay_nutrisi_b) === 1);
    }

    // Pembaruan bar kemajuan (progress bar) PWM Pompa Utama (ID: val-pwm & bar-pwm)
    if (payload.pwm !== undefined && payload.pwm !== null) {
        const pwmText = document.getElementById('val-pwm');
        const pwmBar = document.getElementById('bar-pwm');
        const pwmStatusText = document.getElementById('txt-pwm-status');
        
        if (pwmText && pwmBar) {
            const safePwm = Math.min(Math.max(parseInt(payload.pwm), 0), 255);
            const percentage = Math.round((safePwm / 255) * 100);

            pwmText.innerText = safePwm;
            pwmBar.style.width = `${percentage}%`;

            if (pwmStatusText) {
                if (safePwm === 0) pwmStatusText.innerText = "MATI";
                else if (safePwm <= 120) pwmStatusText.innerText = "LAMBAT";
                else if (safePwm <= 180) pwmStatusText.innerText = "SEDANG";
                else pwmStatusText.innerText = "CEPAT";
            }
        }
    }
};

/**
 * Mengubah warna dan teks indikator broker MQTT di bagian bawah sidebar
 * @param {boolean} isConnected - Status koneksi MQTT (true/false)
 */
window.updateStatusBadge = function (isConnected) {
    const badge = document.getElementById("mqtt-status-badge");
    if (!badge) return;

    if (isConnected) {
        badge.className = "flex items-center gap-1.5 text-emerald-400 font-medium transition-all duration-300";
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> Connected (Live)`;
    } else {
        badge.className = "flex items-center gap-1.5 text-rose-500 font-medium transition-all duration-300";
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-rose-500"></span> Disconnected`;
    }
};