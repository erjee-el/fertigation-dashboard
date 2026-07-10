/**
 * ==========================================================================
 * MAIN.JS - DASHBOARD UI LOGIC & REAL-TIME DATA ROUTER (LENGKAP)
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
    const sidebarContainer = document.getElementById("sidebar");

    // 1. MEMUAT KOMPONEN SIDEBAR (FIXED PATH)
    if (sidebarContainer) {
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

    // 2. HIGHLIGHT MENU
    window.highlightActiveMenu = function() {
        const path = window.location.pathname.split("/").pop() || "index.html";
        const map = { "index.html": "nav-index", "kalibrasi.html": "nav-kalibrasi", "riwayat.html": "nav-riwayat" };
        const active = document.getElementById(map[path]);
        if (active) active.className = "flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl font-medium text-sm";
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

// 5. DATA PARSER (REAL-TIME)
window.parseIncomingJSON = function (payload) {
    if (!payload) return;
    try {
        if (payload.ph !== undefined) document.getElementById('val-ph').innerText = parseFloat(payload.ph).toFixed(2);
        if (payload.tds !== undefined) document.getElementById('val-tds').innerText = parseInt(payload.tds);
        document.getElementById('last-update-time').innerText = new Date().toTimeString().split(' ')[0];
        
        if (window.updateBadgeStatus) {
            window.updateBadgeStatus('ph', payload.ph, payload.ph < 5.5, payload.ph > 6.5);
            window.updateBadgeStatus('tds', payload.tds, payload.tds < 1200, payload.tds > 1500);
        }
        if (window.calculateFuzzyMemberships) window.calculateFuzzyMemberships(payload);
        if (window.updateDashboardChart) window.updateDashboardChart(payload.ph, payload.tds);
    } catch (e) { console.error("Parser Error:", e); }
};

// 6. ACTUATOR MONITOR
window.updateActuatorPanel = function (payload) {
    if (!payload) return;
    ['phup', 'phdown', 'nut1', 'nut2'].forEach((key, i) => {
        const val = payload[`relay_${['ph_up', 'ph_down', 'nutrisi_a', 'nutrisi_b'][i]}`];
        if (val !== undefined && window.updateRelayUI) window.updateRelayUI(key, parseInt(val) === 1);
    });

    if (payload.pwm !== undefined) {
        const p = Math.min(Math.max(parseInt(payload.pwm), 0), 255);
        document.getElementById('val-pwm').innerText = p;
        document.getElementById('bar-pwm').style.width = `${Math.round((p/255)*100)}%`;
    }
};