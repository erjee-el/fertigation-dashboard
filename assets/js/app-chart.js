/**
 * ==========================================================================
 * APP-CHART.JS - REAL-TIME CHART CONFIGURATION (CHART.JS V3/V4)
 * Mengelola visualisasi tren pH dan TDS dari data passthrough ESP8266
 * Smart Fertigation System - Cabai
 * ==========================================================================
 */

// Global variables untuk menyimpan instance grafik
let fertigationChart = null;
const MAX_DATA_POINTS = 15; // Batas data yang tampil di layar agar performa rendering web tetap ringan

/**
 * 1. Inisialisasi Grafik Saat Struktur DOM Halaman Selesai Dimuat
 */
document.addEventListener("DOMContentLoaded", function () {
    const ctx = document.getElementById('fertigationChart');
    
    // Proteksi jika element canvas tidak ditemukan di halaman aktif (misal saat membuka kalibrasi.html atau riwayat.html)
    if (!ctx) return;

    // Konfigurasi awal Chart.js dengan Multi-Axis (Sumbu Y Ganda)
    fertigationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Akan diisi otomatis oleh timestamp waktu real-time (HH:MM:SS)
            datasets: [
                {
                    label: 'Kadar pH',
                    data: [],
                    borderColor: '#4f46e5', // Indigo-600
                    backgroundColor: 'rgba(79, 70, 229, 0.06)',
                    borderWidth: 3,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3, // Membuat garis melengkung halus (smooth curve)
                    yAxisID: 'y-ph' // Diarahkan ke sumbu Y bagian kiri
                },
                {
                    label: 'Nutrisi TDS (PPM)',
                    data: [],
                    borderColor: '#0ea5e9', // Sky-500
                    backgroundColor: 'rgba(14, 165, 233, 0.06)',
                    borderWidth: 3,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.3,
                    yAxisID: 'y-tds' // Diarahkan ke sumbu Y bagian kanan
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', // Slate-900 tebal
                    titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 700 },
                    bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
                    padding: 10,
                    borderRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 },
                        maxRotation: 0,
                        autoSkip: true
                    }
                },
                'y-ph': {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: 14,
                    title: {
                        display: true,
                        text: 'Skala pH',
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: 600 }
                    },
                    grid: { color: '#f1f5f9' }, // Garis grid horizontal tipis (Slate-100)
                    ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } }
                },
                'y-tds': {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    max: 2000, // Menampung target nutrisi maks pertumbuhan melon/cabai 
                    title: {
                        display: true,
                        text: 'Kepekatan TDS (PPM)',
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: 600 }
                    },
                    grid: { drawOnChartArea: false }, // Mencegah tabrakan garis kisi dengan y-ph
                    ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
});

/**
 * 2. Fungsi Global untuk Menyuntikkan Data Baru ke Grafik
 * Dipanggil secara otomatis oleh event onMessageArrived di connection.js
 * @param {string} time - Label waktu penanda (HH:MM:SS)
 * @param {any} phValue - Nilai pembacaan sensor pH
 * @param {any} tdsValue - Nilai pembacaan sensor TDS
 */
function updateLiveChart(time, phValue, tdsValue) {
    // Pastikan grafik telah terinisialisasi dengan benar sebelum dimanipulasi
    if (!fertigationChart) return;

    const dataLabels = fertigationChart.data.labels;
    const phDataset = fertigationChart.data.datasets[0].data;
    const tdsDataset = fertigationChart.data.datasets[1].data;

    // Proteksi Pengondisian Tipe Data (Data Sanitization)
    // Menghindari grafik kosong akibat data payload MQTT masuk sebagai teks string
    const parsedPH = phValue !== undefined && phValue !== null ? parseFloat(phValue) : 0.0;
    const parsedTDS = tdsValue !== undefined && tdsValue !== null ? parseInt(tdsValue) : 0;

    // Masukkan data tervalidasi ke ujung array
    dataLabels.push(time);
    phDataset.push(parsedPH);
    tdsDataset.push(parsedTDS);

    // Mekanisme Auto-Scroll Window Berjalan
    // Jika tumpukan array melebihi ambang batas, eliminasi data terlama (indeks 0)
    if (dataLabels.length > MAX_DATA_POINTS) {
        dataLabels.shift();
        phDataset.shift();
        tdsDataset.shift();
    }

    // Refresh grafik untuk memperbarui grafik secara instan
    // Menggunakan parameter kustom 'none' agar transisi pergeseran data mulus (tidak patah-patah)
    fertigationChart.update('none');
}

// Daftarkan fungsi ke global scope browser agar bisa diakses langsung oleh connection.js
window.updateLiveChart = updateLiveChart;