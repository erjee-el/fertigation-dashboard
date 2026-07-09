/**
 * ==========================================================================
 * MAIN.JS - DASHBOARD UI LOGIC & REAL-TIME DATA ROUTER (FIXED)
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
    // 3. MENU TOGGLE MOBILE (EVENT DELEGATION FIXED)
    // ==========================================
    document.addEventListener("click", function (event) {
        // Mendeteksi klik pada tombol hamburger menu (garis tiga)
        if (event.target.closest("#menu-toggle") || event.target.closest(".hamburger-btn")) {
            if (sidebarContainer) {
                // Gunakan toggle class kustom yang selaras dengan style.css (Langkah 1 sebelumnya)
                sidebarContainer.classList.toggle("sidebar-active");
            }
        }
        
        // Fitur Tambahan: Menutup sidebar otomatis jika user mengklik area di luar sidebar saat mode mobile aktif
        if (!event.target.closest("#sidebar") && !event.target.closest("#menu-toggle") && !event.target.closest(".hamburger-btn")) {
            if (sidebarContainer && sidebarContainer.classList.contains("sidebar-active")) {
                sidebarContainer.classList.remove("sidebar-active");
            }
        }
    });
});

// ==========================================================================
// 4. GLOBAL HANDLER: PARSE INCOMING DATA (Dipanggil dari connection.js)
// ==========================================================================

/**
 * Memperbarui teks nilai indikator numerik utama di dashboard utama.
 * @param {Object} payload - Objek JSON data sensor dari broker MQTT.
 */
window.parseIncomingJSON = function (payload) {
    if (!payload) return;

    try {
        // Pembaruan teks nilai Sensor pH digital
        if (payload.ph !== undefined && payload.ph !== null) {
            const phEl = document.getElementById('current-ph');
            if (phEl) phEl.innerText = parseFloat(payload.ph).toFixed(2);
        }

        // Pembaruan teks nilai Sensor TDS Nutrisi (PPM)
        if (payload.tds !== undefined && payload.tds !== null) {
            const tdsEl = document.getElementById('current-tds');
            if (tdsEl) tdsEl.innerText = `${parseInt(payload.tds)} PPM`;
        }

        // Pembaruan cap waktu pembaruan terakhir (Last Update Info Element)
        const timeEl = document.getElementById('last-update-time');
        if (timeEl) {
            const now = new Date();
            timeEl.innerText = `Update terakhir: ${now.toLocaleTimeString('id-ID')}`;
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

    // Pemetaan ID elemen HTML indikator lingkaran bulatan beserta warna aktifnya
    const relays = [
        { id: 'relay1-status', value: payload.relay_ph_up, activeClass: 'bg-emerald-500' },
        { id: 'relay2-status', value: payload.relay_ph_down, activeClass: 'bg-rose-500' },
        { id: 'relay3-status', value: payload.relay_nutrisi_a, activeClass: 'bg-sky-500' },
        { id: 'relay4-status', value: payload.relay_nutrisi_b, activeClass: 'bg-sky-500' }
    ];

    // Iterasi eksekusi manipulasi warna status bulatan relay
    relays.forEach(relay => {
        const element = document.getElementById(relay.id);
        if (element && relay.value !== undefined && relay.value !== null) {
            const state = parseInt(relay.value);
            if (state === 1) {
                element.className = `w-3.5 h-3.5 rounded-full shadow-inner transition-all duration-300 animate-pulse-glowing ${relay.activeClass}`;
            } else {
                element.className = "w-3.5 h-3.5 rounded-full bg-slate-300 shadow-inner border border-slate-400/20 transition-all duration-300";
            }
        }
    });

    // Pembaruan bar kemajuan (progress bar) PWM Pompa Utama dari Fuzzy Logic
    if (payload.pwm !== undefined && payload.pwm !== null) {
        const pwmText = document.getElementById('pwm-text-value');
        const pwmBar = document.getElementById('pwm-progress-bar');
        
        if (pwmText && pwmBar) {
            const safePwm = Math.min(Math.max(parseInt(payload.pwm), 0), 255);
            const percentage = Math.round((safePwm / 255) * 100);

            pwmText.innerText = `${safePwm} / 255`;
            pwmBar.style.width = `${percentage}%`;
        }
    }
};

/**
 * Mengubah warna dan teks indikator broker MQTT di bagian bawah sidebar (FIXED)
 * @param {boolean} isConnected - Status koneksi MQTT (true/false)
 */
window.updateStatusBadge = function (isConnected) {
    const badge = document.getElementById("mqtt-status-badge");
    if (!badge) return;

    if (isConnected) {
        badge.className = "flex items-center gap-1.5 text-emerald-400 font-medium transition-all duration-300";
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glowing"></span> Connected (Live)`;
    } else {
        badge.className = "flex items-center gap-1.5 text-rose-500 font-medium transition-all duration-300";
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-rose-500"></span> Disconnected`;
    }
};