/**
 * ==========================================================================
 * MAIN.JS - DASHBOARD UI LOGIC & REAL-TIME DATA ROUTER (COMPURATED & SECURED)
 * Sistem Monitoring Smart Fertigation - Cabai
 * Handlers: Dynamic Sidebar, Navigation Highlighter, Mobile Menu, & UI Parsers
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
    const sidebarContainer = document.getElementById("sidebar");

    // ==========================================
    // 1. DEKLARASI GLOBAL FUNGSI STATUS BADGE (Dinaikkan agar aman dari Race Condition)
    // ==========================================
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

    // ==========================================
    // 2. MEMUAT KOMPONEN SIDEBAR (ASYNCHRONOUS)
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

                // Daftarkan event handler khusus mobile TEPAT setelah sidebar selesai dimuat
                initMobileMenu();

                // Periksa status MQTT awal jika client sudah terhubung lebih dulu
                if (window.mqttClient && typeof window.mqttClient.isConnected === 'function') {
                    const isConnected = window.mqttClient.isConnected();
                    window.updateStatusBadge(isConnected);
                }
            })
            .catch(err => console.error("[UI] Gagal memuat komponen sidebar:", err));
    }

    // ==========================================
    // 3. MENANDAI HALAMAN YANG AKTIF (HIGHLIGHT)
    // ==========================================
    function highlightActiveMenu() {
        const currentPath = window.location.pathname.split("/").pop().split("?")[0] || "index.html";
        
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
    // 4. INITIALIZATION MOBILE TOGGLE MENU
    // ==========================================
   function initMobileMenu() {
    const menuToggleBtn = document.getElementById("menu-toggle");

    if (menuToggleBtn && sidebarContainer) {
        menuToggleBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            sidebarContainer.classList.toggle("sidebar-active");
        });
    }

    // BARU: Menutup sidebar jika salah satu link menu di dalam sidebar diklik
    if (sidebarContainer) {
        const sidebarLinks = sidebarContainer.querySelectorAll("a");
        sidebarLinks.forEach(link => {
            link.addEventListener("click", () => {
                sidebarContainer.classList.remove("sidebar-active");
            });
        });
    }

    // Menutup sidebar otomatis jika user mengklik area di luar sidebar
    document.addEventListener("click", function (event) {
        if (sidebarContainer && sidebarContainer.classList.contains("sidebar-active")) {
            if (!sidebarContainer.contains(event.target) && menuToggleBtn && !menuToggleBtn.contains(event.target)) {
                sidebarContainer.classList.remove("sidebar-active");
                }
            }
        });
    }
});

// ==========================================================================
// 5. GLOBAL HANDLER: PARSE INCOMING DATA (Diselaraskan dengan ID index.html)
// ==========================================================================

window.parseIncomingJSON = function (payload) {
    if (!payload) return;

    try {
        // Parsing pH dengan pengaman tipe data
        if (payload.ph !== undefined && payload.ph !== null) {
            const phVal = parseFloat(payload.ph);
            const phEl = document.getElementById('val-ph');
            if (phEl && !isNaN(phVal)) phEl.innerText = phVal.toFixed(2);
        }

        // Parsing TDS dengan pengaman tipe data
        if (payload.tds !== undefined && payload.tds !== null) {
            const tdsVal = parseInt(payload.tds);
            const tdsEl = document.getElementById('val-tds');
            if (tdsEl && !isNaN(tdsVal)) tdsEl.innerText = tdsVal;
        }

        // Pembaharuan Stempel Waktu (Timestamp Lokalan)
        const timeEl = document.getElementById('last-update-time');
        if (timeEl) {
            const now = new Date();
            timeEl.innerText = now.toTimeString().split(' ')[0];
        }

        // Pemicu Status Indikator Bahaya/Aman (Disesuaikan rentang target cabai generatif)
        if (typeof updateBadgeStatus === "function") {
            updateBadgeStatus('ph', payload.ph, payload.ph < 5.5, payload.ph > 6.5);
            updateBadgeStatus('tds', payload.tds, payload.tds < 1200, payload.tds > 1500);
        }
        
        // Perhitungan visualisasi keanggotaan fuzzy di web dashboard
        if (typeof calculateFuzzyMemberships === "function") {
            calculateFuzzyMemberships(payload);
        }

        // Pemicu pembaruan real-time grafik Chart.js
        if (window.updateDashboardChart && payload.ph !== undefined && payload.tds !== undefined) {
            window.updateDashboardChart(payload.ph, payload.tds);
        }

    } catch (error) {
        console.error("[UI Parser] Gagal merender data teks numerik:", error);
    }
};

window.updateActuatorPanel = function (payload) {
    if (!payload) return;

    // Pengaman konversi biner relay untuk menghindari bug "NaN === 1"
    if (typeof updateRelayUI === "function") {
        if (payload.relay_ph_up !== undefined && payload.relay_ph_up !== null) {
            updateRelayUI('phup', parseInt(payload.relay_ph_up) === 1);
        }
        if (payload.relay_ph_down !== undefined && payload.relay_ph_down !== null) {
            updateRelayUI('phdown', parseInt(payload.relay_ph_down) === 1);
        }
        if (payload.relay_nutrisi_a !== undefined && payload.relay_nutrisi_a !== null) {
            updateRelayUI('nut1', parseInt(payload.relay_nutrisi_a) === 1);
        }
        if (payload.relay_nutrisi_b !== undefined && payload.relay_nutrisi_b !== null) {
            updateRelayUI('nut2', parseInt(payload.relay_nutrisi_b) === 1);
        }
    }

    // Manajer Kecepatan Pompa Utama Melalui Nilai Output PWM Drip Irrigation
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
                else if (safePwm <= 100) pwmStatusText.innerText = "LAMBAT";
                else if (safePwm <= 200) pwmStatusText.innerText = "SEDANG";
                else pwmStatusText.innerText = "CEPAT";
            }
        }
    }
};