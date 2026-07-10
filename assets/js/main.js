/**
 * ==========================================================================
 * MAIN.JS - DASHBOARD UI LOGIC & REAL-TIME DATA ROUTER (LENGKAP)
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
    const sidebarContainer = document.getElementById("sidebar");

    // 1. MEMUAT KOMPONEN SIDEBAR
    // Jika sidebar sudah ditulis langsung di HTML (punya isi/children),
    // jangan fetch ulang -- cukup jalankan highlight & mobile menu.
    if (sidebarContainer) {
        if (sidebarContainer.children.length > 0) {
            window.highlightActiveMenu();
            window.initMobileMenu();
            if (window.mqttClient) window.updateStatusBadge(window.mqttClient.isConnected());
        } else {
            fetch('/Components/Sidebar.html')
                .then(res => res.ok ? res.text() : Promise.reject())
                .then(data => {
                    sidebarContainer.innerHTML = data;
                    window.highlightActiveMenu();
                    window.initMobileMenu();
                    if (window.mqttClient) window.updateStatusBadge(window.mqttClient.isConnected());
                })
                .catch(() => window.initMobileMenu());
        }
    }

    // 2. HIGHLIGHT MENU (berdasarkan href, tidak bergantung pada id tertentu)
    window.highlightActiveMenu = function() {
        const path = window.location.pathname.split("/").pop() || "index.html";
        const links = document.querySelectorAll("#sidebar nav a");
        links.forEach(link => {
            const href = link.getAttribute("href");
            const isActive = href === path;
            link.className = isActive
                ? "flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl font-medium text-sm"
                : "flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-xl font-medium text-sm transition-all";
        });
    };

    // 3. MOBILE MENU TOGGLE
    window.initMobileMenu = function() {
        const btn = document.getElementById("menu-toggle");
        const sb = document.getElementById("sidebar");
        if (!btn || !sb) return;
        btn.onclick = (e) => { e.stopPropagation(); sb.classList.toggle("sidebar-active"); };
        document.onclick = (e) => { if (!sb.contains(e.target) && !btn.contains(e.target)) sb.classList.remove("sidebar-active"); };
    };

    // 4. GLOBAL STATUS BADGE
    window.updateStatusBadge = function (isConnected) {
        const badge = document.getElementById("mqtt-status-badge");
        if (!badge) return;
        badge.className = `flex items-center gap-1.5 ${isConnected ? 'text-emerald-400' : 'text-rose-500'} font-medium`;
        badge.innerHTML = `<span class="h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}"></span> ${isConnected ? 'Connected (Live)' : 'Disconnected'}`;
    };
});

// Helper kecil: set innerText hanya jika elemen ada, biar 1 elemen yang
// hilang tidak menghentikan seluruh proses update dashboard.
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// 5. DATA PARSER (REAL-TIME)
window.parseIncomingJSON = function (payload) {
    if (!payload) return;
    try {
        if (payload.ph !== undefined) setText('val-ph', parseFloat(payload.ph).toFixed(2));
        if (payload.tds !== undefined) setText('val-tds', parseInt(payload.tds));
        if (payload.temp !== undefined) setText('val-temp', parseFloat(payload.temp).toFixed(1));
        if (payload.pressure !== undefined) setText('val-pressure', parseFloat(payload.pressure).toFixed(2));

        if (payload.level !== undefined) {
            const isLow = parseInt(payload.level) === 0;
            setText('val-level', isLow ? 'RENDAH (LOW)' : 'NORMAL');
            const banner = document.getElementById('safety-alert-banner');
            if (banner) banner.classList.toggle('hidden', !isLow);
        }

        setText('last-update-time', new Date().toTimeString().split(' ')[0]);

        if (window.updateBadgeStatus) {
            if (payload.ph !== undefined) window.updateBadgeStatus('ph', payload.ph, payload.ph < 5.5, payload.ph > 6.5);
            if (payload.tds !== undefined) window.updateBadgeStatus('tds', payload.tds, payload.tds < 1200, payload.tds > 1500);
            if (payload.temp !== undefined) window.updateBadgeStatus('temp', payload.temp, payload.temp < 22, payload.temp > 30);
            if (payload.pressure !== undefined) window.updateBadgeStatus('pressure', payload.pressure, payload.pressure < 0.5, payload.pressure > 2.5);
        }

        if (window.calculateFuzzyMemberships && payload.ph !== undefined && payload.tds !== undefined) {
            window.calculateFuzzyMemberships(payload);
        }

        if (window.updateDashboardChart && payload.ph !== undefined && payload.tds !== undefined) {
            window.updateDashboardChart(payload.ph, payload.tds);
        }

        window.updateActuatorPanel(payload);
    } catch (e) {
        console.error("Parser Error:", e);
    }
};

// 6. ACTUATOR MONITOR
// Payload memakai key singkat (phup, phdown, nut1, nut2, pwm) sesuai
// data uji di index.html, jadi disamakan langsung di sini.
window.updateActuatorPanel = function (payload) {
    if (!payload) return;

    ['phup', 'phdown', 'nut1', 'nut2'].forEach((key) => {
        if (payload[key] !== undefined && window.updateRelayUI) {
            window.updateRelayUI(key, Boolean(payload[key]));
        }
    });

    if (payload.pwm !== undefined) {
        const p = Math.min(Math.max(parseInt(payload.pwm), 0), 255);
        setText('val-pwm', p);
        const bar = document.getElementById('bar-pwm');
        if (bar) bar.style.width = `${Math.round((p / 255) * 100)}%`;
        setText('txt-pwm-status', p > 0 ? 'AKTIF' : 'STANDBY');
    }
};
