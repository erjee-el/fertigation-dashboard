/**
 * ==========================================================================
 * CONNECTION.JS - BROKER MQTT CONNECTION MANAGEMENT (PAHO MQTT)
 * Smart Fertigation System - ESP32 (WiFi Direct)
 * ==========================================================================
 * BROKER: HiveMQ Public (broker.hivemq.com)
 * TRANSPORT: WebSocket Secure (wss://) pada port 8884 (Wajib untuk HTTPS Vercel)
 * NAMESPACE: irigasi/drip/*
 * ==========================================================================
 */

// CONFIGURATION - HiveMQ Public Broker via WebSocket Secure (WSS)
const MQTT_CONFIG = {
    host: 'broker.hivemq.com',      // HiveMQ Public MQTT Broker
    port: 8884,                     // Port WSS (8884) — Wajib SSL di Vercel HTTPS
    clientId: 'web_client_' + Math.random().toString(16).substr(2, 8),
    topics: {
        // Topik SUBSCRIBE: menerima telemetri sensor dari ESP32
        sensorData: 'irigasi/drip/sensor',
        // Topik PUBLISH: mengirim perintah kontrol/kalibrasi ke ESP32
        controlDevice: 'irigasi/drip/kontrol'
    }
};

let mqttClient = null;

/**
 * 1. Menginisialisasi Koneksi MQTT ke HiveMQ Public Broker
 */
function initMQTT() {
    mqttClient = new Paho.MQTT.Client(MQTT_CONFIG.host, MQTT_CONFIG.port, MQTT_CONFIG.clientId);

    // Tempelkan ke global window agar file lain bisa mendeteksi status .isConnected()
    window.mqttClient = mqttClient;

    // Set callback handlers
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;

    const connectOptions = {
        onSuccess: onConnectSuccess,
        onFailure: onConnectFailure,
        useSSL: true,           // Wajib true untuk koneksi WSS di Vercel
        timeout: 10,            // Timeout 10 detik
        keepAliveInterval: 60,  // Keep-alive 60 detik
        cleanSession: true
        // 'reconnect' dihapus karena tidak didukung oleh paho-mqtt
    };

    console.log("%c[MQTT] Menghubungkan ke HiveMQ Public Broker (wss://" + MQTT_CONFIG.host + ":" + MQTT_CONFIG.port + ")...", "color: #3b82f6; font-weight: bold;");
    mqttClient.connect(connectOptions);
}

/**
 * 2. Callback Ketika Berhasil Terhubung ke Broker
 */
function onConnectSuccess() {
    console.log("%c[MQTT] Terhubung ke HiveMQ Public Broker dengan Sukses!", "color: #10b981; font-weight: bold;");
    
    // Update badge status UI
    if (typeof window.updateStatusBadge === 'function') {
        window.updateStatusBadge(true);
    } else {
        updateStatusBadge(true);
    }

    // Subscribe ke topik data sensor ESP32
    mqttClient.subscribe(MQTT_CONFIG.topics.sensorData);
    console.log(`[MQTT] Subscribed ke topik: ${MQTT_CONFIG.topics.sensorData}`);
}

/**
 * 3. Callback Jika Gagal Terhubung saat Inisiasi
 */
function onConnectFailure(error) {
    console.error("[MQTT] Gagal terhubung ke HiveMQ Broker:", error.errorMessage || error);
    
    if (typeof window.updateStatusBadge === 'function') {
        window.updateStatusBadge(false);
    } else {
        updateStatusBadge(false);
    }
    
    setTimeout(initMQTT, 5000); // Auto-reconnect manual dalam 5 detik
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
        
        setTimeout(initMQTT, 5000); // Auto-reconnect manual dalam 5 detik
    }
}

/**
 * 5. Callback Ketika Data/Payload Masuk dari ESP32
 */
function onMessageArrived(message) {
    try {
        const rawPayload = message.payloadString.trim();

        // Validasi format JSON
        if (!rawPayload.startsWith('{') || !rawPayload.endsWith('}')) {
            console.warn("[MQTT] Mengabaikan data bukan JSON:", rawPayload);
            return;
        }

        let payload = JSON.parse(rawPayload);
        console.log("[MQTT] Data real-time diterima:", payload);

        // EXTRACTION UTILITY: Menangani data bertingkat dari ESP32 (misal payload.sensor1)
        if (payload.sensor1) {
            payload = { ...payload, ...payload.sensor1 };
        }

        // Ambil komponen waktu lokal
        const now = new Date();
        const timeLabel = now.toTimeString().split(' ')[0]; 

        // 1. UPDATE GRAFIK CHART
        if (typeof window.updateLiveChart === 'function') {
            window.updateLiveChart(timeLabel, payload.ph, payload.tds);
        } else if (typeof updateLiveChart === 'function') {
            updateLiveChart(timeLabel, payload.ph, payload.tds);
        }

        // 2. PARSER UTAMA (Teks Nilai Sensor)
        if (typeof window.parseIncomingJSON === 'function') {
            window.parseIncomingJSON(payload);
        } else if (typeof parseIncomingJSON === 'function') {
            parseIncomingJSON(payload);
        }

        // 3. PANEL KONTROL AKTUATOR (Relay / Status Device)
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
 * 6. Fungsi Global Publish Instruksi ke ESP32
 */
function mqttPublish(topic, dataObj) {
    if (!mqttClient || !mqttClient.isConnected()) {
        console.error("[MQTT] Gagal publish, MQTT tidak terkoneksi.");
        return false;
    }

    const payloadString = typeof dataObj === 'object' ? JSON.stringify(dataObj) : dataObj; 
    const message = new Paho.MQTT.Message(payloadString);
    
    message.destinationName = topic || MQTT_CONFIG.topics.controlDevice;
    message.qos = 0; // Disamakan QoS 0 dengan ESP32
    
    mqttClient.send(message);
    console.log(`[MQTT] Mempublikasikan perintah ke [${message.destinationName}]:`, payloadString);
    return true;
}

/**
 * 7. Utilitas Indikator Status UI (Fallback)
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

// Global scope registration
window.mqttPublish = mqttPublish;
window.publishCalibration = mqttPublish;
window.initMQTT = initMQTT;

// Jalankan otomatis saat DOM siap
document.addEventListener("DOMContentLoaded", initMQTT);