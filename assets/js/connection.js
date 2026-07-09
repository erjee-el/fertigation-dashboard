/**
 * ==========================================================================
 * CONNECTION.JS - BROKER MQTT CONNECTION MANAGEMENT (PAHO MQTT)
 * Sinkronisasi data antara USR-N510 (RS485) dengan Web Dashboard
 * Smart Fertigation System - ESP8266 & Arduino Nano
 * ==========================================================================
 */

// CONFIGURATION - Disesuaikan dengan sistem passthrough USR-N510 Anda
const MQTT_CONFIG = {
    host: 'broker.hivemq.com',      // Alamat MQTT Broker HiveMQ Publik
    port: 8000,                     // Port WebSocket untuk browser (Gunakan 8884 jika menggunakan SSL/WSS)
    clientId: 'web_client_' + Math.random().toString(16).substr(2, 8),
    topics: {
        sensorData: 'usr/passthrough', 
        controlDevice: 'usr/passthrough/control' 
    }
};

let mqttClient = null;

/**
 * 1. Menginisialisasi Koneksi MQTT
 */
function initMQTT() {
    mqttClient = new Paho.MQTT.Client(MQTT_CONFIG.host, MQTT_CONFIG.port, MQTT_CONFIG.clientId);

    // Tempelkan ke global window agar main.js bisa mendeteksi status .isConnected()
    window.mqttClient = mqttClient;

    // Set callback handlers
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;

    const connectOptions = {
        onSuccess: onConnectSuccess,
        onFailure: onConnectFailure,
        useSSL: false, // Set true jika pindah ke HiveMQ Cloud (Port 8884 / 443)
        timeout: 5,
        keepAliveInterval: 30,
        cleanSession: true
    };

    console.log("%c[MQTT] Menghubungkan ke MQTT Broker...", "color: #3b82f6; font-weight: bold;");
    mqttClient.connect(connectOptions);
}

/**
 * 2. Callback Ketika Berhasil Terhubung ke Broker
 */
function onConnectSuccess() {
    console.log("%c[MQTT] Terhubung ke MQTT Broker dengan Sukses!", "color: #10b981; font-weight: bold;");
    
    // Gunakan fungsi status badge aman dari global window scope
    if (typeof window.updateStatusBadge === 'function') {
        window.updateStatusBadge(true);
    } else {
        updateStatusBadge(true);
    }

    // Subscribe ke topik data sensor USR-N510
    mqttClient.subscribe(MQTT_CONFIG.topics.sensorData);
    console.log(`[MQTT] Subscribed ke topik: ${MQTT_CONFIG.topics.sensorData}`);
}

/**
 * 3. Callback Jika Gagal Terhubung saat Inisiasi
 */
function onConnectFailure(error) {
    console.error("[MQTT] Gagal terhubung ke MQTT Broker:", error.errorMessage);
    
    if (typeof window.updateStatusBadge === 'function') {
        window.updateStatusBadge(false);
    } else {
        updateStatusBadge(false);
    }
    
    setTimeout(initMQTT, 5000); // Auto-reconnect dalam 5 detik
}

/**
 * 4. Callback Jika Koneksi Terputus Ditengah Jalan
 */
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.warn("[MQTT] Koneksi MQTT Terputus:", responseObject.errorMessage);
        
        if (typeof window.updateStatusBadge === 'function') {
            window.updateStatusBadge(false);
        } else {
            updateStatusBadge(false);
        }
        
        setTimeout(initMQTT, 5000); // Auto-reconnect dalam 5 detik
    }
}

/**
 * 5. Callback Ketika Data/Payload Masuk dari USR-N510 via Broker
 */
function onMessageArrived(message) {
    try {
        const rawPayload = message.payloadString.trim();

        // VALIDASI AMAN: Pastikan string diawali '{' dan diakhiri '}' agar tidak crash akibat data serial terpotong
        if (!rawPayload.startsWith('{') || !rawPayload.endsWith('}')) {
            console.warn("[MQTT] Mengabaikan data rusak/terpotong dari RS485:", rawPayload);
            return;
        }

        const payload = JSON.parse(rawPayload);
        console.log("[MQTT] Data real-time diterima:", payload);
        
        // Ambil komponen waktu lokal untuk penanda update terakhir
        const now = new Date();
        const timeLabel = now.toTimeString().split(' ')[0]; 

        // 1. KIRIM DATA KE GRAFIK CHART
        if (typeof window.updateLiveChart === 'function') {
            window.updateLiveChart(timeLabel, payload.ph, payload.tds);
        } else if (typeof updateLiveChart === 'function') {
            updateLiveChart(timeLabel, payload.ph, payload.tds);
        }

        // 2. KIRIM DATA KE PARSER UTAMA (Teks & Batasan Angka)
        if (typeof window.parseIncomingJSON === 'function') {
            window.parseIncomingJSON(payload);
        } else if (typeof parseIncomingJSON === 'function') {
            parseIncomingJSON(payload);
        }

        // 3. KIRIM DATA KE PANEL KONTROL AKTUATOR (Relay & PWM Pompa Drip)
        if (typeof window.updateActuatorPanel === 'function') {
            window.updateActuatorPanel(payload);
        } else if (typeof updateActuatorPanel === 'function') {
            updateActuatorPanel(payload);
        }

    } catch (error) {
        console.error("[MQTT] Gagal memproses payload JSON. Error:", error);
    }
}

/**
 * 6. Fungsi Global untuk Mengirim Instruksi Balik ke Alat (Kalibrasi / Kontrol)
 * Disesuaikan agar sinkron dengan panggilan form di main.js
 */
function mqttPublish(topic, dataObj) {
    if (!mqttClient || !mqttClient.isConnected()) {
        console.error("[MQTT] Gagal publish, MQTT tidak terkoneksi.");
        return false;
    }

    const payloadString = typeof dataObj === 'object' ? JSON.stringify(dataObj) : dataObj; 
    const message = new Paho.MQTT.Message(payloadString);
    
    message.destinationName = topic || MQTT_CONFIG.topics.controlDevice;
    message.qos = 1; // QoS 1 menjamin instruksi kalibrasi sampai ke perangkat minimal sekali
    
    mqttClient.send(message);
    console.log(`[MQTT] Mempublikasikan perintah ke [${message.destinationName}]:`, payloadString);
    return true;
}

/**
 * 7. Utilitas Mengubah Warna Indikator Status di Sidebar (Fungsi Lokal/Fallback)
 */
function updateStatusBadge(isConnected) {
    let badge = document.getElementById('mqtt-status-badge');
    
    if (!badge) {
        badge = document.querySelector('aside span.text-emerald-400') || 
                document.querySelector('aside span.text-rose-400') || 
                document.querySelector('aside span.text-amber-400');
    }
    if (!badge) return;

    if (isConnected) {
        badge.className = "flex items-center gap-1.5 text-emerald-400 font-medium";
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> Connected (Live)`;
    } else {
        badge.className = "flex items-center gap-1.5 text-rose-500 font-medium";
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-rose-500"></span> Disconnected`;
    }
}

// Daftarkan fungsi ke global window scope agar bisa diakses silang antar file .html dan main.js
window.mqttPublish = mqttPublish;
window.publishCalibration = mqttPublish; // Alias backward-compatibility jika file lain memanggil nama lama
window.initMQTT = initMQTT;

// Jalankan koneksi secara otomatis saat struktur DOM halaman telah siap
document.addEventListener("DOMContentLoaded", initMQTT);