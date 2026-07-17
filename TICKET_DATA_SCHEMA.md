# Dokumentasi Struktur Kolom & Integrasi API Tiket

Dokumen ini menjelaskan struktur data (payload JSON) yang diharapkan oleh skrip kustom dashboard OWS/ADC di proyek **dashboard_problem_ticket_test**.

---

## 1. Spesifikasi Endpoint OWS
* **Service ID / URI:** `/adc-service/rest/v1/services/dashboard_problem_ticket_test/dashboard_problem_ticket_test/dashboard__problem_ticket`
* **Metode:** `POST` (Diproses oleh `MessageProcessor.process`)
* **Format Payload Permintaan:**
```json
{
  "start": 0,
  "limit": 50
}
```

---

## 2. Struktur Kolom Objek Tiket (JSON Schema)

Setiap elemen di dalam array hasil respons (`res.result._values` atau sejenisnya) harus memiliki struktur kolom sebagai berikut:

| Nama Kolom (Property) | Tipe Data | Keterangan / Nilai yang Diterima | Penggunaan di UI |
| :--- | :--- | :--- | :--- |
| `orderid` \| `id` \| `code` | `String` | ID unik dari tiket (contoh: `"TCK2026071701"`) | Ditampilkan di daftar tiket |
| `title` \| `problem_name` \| `description` | `String` | Nama masalah atau judul tiket singkat | Ditampilkan di daftar tiket |
| `ticketstatus` \| `status` \| `active_status` | `String` | Status tiket saat ini (`"Open"`, `"Pending"`, `"Closed"`, dll) | Badge status & penghitungan KPI |
| `createptproblemdes` | `String` | Deskripsi detail dari permasalahan | Penentuan partner lewat kata kunci |
| `createptassignto` | `String` | Nama penugasan grup / operator (contoh: `"PWX"`, `"PM"`, `"IJE"`, `"Surge"`) | Penentuan partner (Telkom Akses/Mandau/Persada/IJE/Surge) |
| `currentoperator` | `String` | Akun/Nama operator yang sedang memproses | Penentuan partner |
| `originator` | `String` | Pembuat tiket | Penentuan partner |
| `severity` \| `priority` | `String` \| `Int` | Tingkat keparahan tiket. Nilai yang disarankan: <br>- `"Emergency"` atau `1`<br>- `"Critical"` atau `2`<br>- `"Major"` atau `3`<br>- `"Minor"` atau `4` | Pembagian kategori kartu di panel **Severity Overview** |
| `root_cause` \| `rootcause` \| `cause` | `String` | Akar masalah tiket. Dicocokkan secara dinamis berdasarkan kata kunci teks: <br>- `"fiber"` / `"cut"` $\rightarrow$ **Fiber Cut**<br>- `"hardware"` / `"hw"` $\rightarrow$ **Hardware**<br>- `"power"` / `"pwr"` $\rightarrow$ **Power**<br>- `"config"` $\rightarrow$ **Configuration**<br>- Lainnya $\rightarrow$ **Others** | Legend & grafik ECharts Donut Chart |
| `over_sla` \| `sla_over` \| `is_over_sla` | `Boolean` \| `Int` | Penanda tiket apakah sudah melewati waktu batas SLA (`true` / `1` atau `false` / `0`) | Penghitungan jumlah tiket **Over SLA** di tabel statistik kartu |
| `phase` \| `current_phase` \| `state` | `String` | Tahapan proses tiket saat ini. Nilai yang disarankan:<br>- `"Create PT"`<br>- `"Handle Analyze PT"`<br>- `"Analyze PT"`<br>- `"Handle Implement PT"`<br>- `"Implement PT"`<br>- `"Confirm PT"` | Pembagian data baris di panel **Phase Status** |
| `aging` \| `aging_days` \| `days` | `Number` | Umur tiket berjalan dalam satuan hari (contoh: `12.5`) | Pengelompokan umur tiket ke dalam bucket (`0-7`, `8-15`, `16-21`, `> SLA`) |

---

## 3. Contoh Payload Respons API (Contoh JSON)

Berikut adalah contoh format JSON lengkap yang valid dari API OWS agar dashboard menampilkan data dinamis secara sempurna:

```json
{
  "result": {
    "_values": [
      {
        "orderid": "TCK-99012",
        "title": "Kabel Fiber Optik Putus di Sektor 3",
        "ticketstatus": "Open",
        "createptproblemdes": "Pekerjaan galian menyebabkan fiber cut di jalan utama",
        "createptassignto": "Telkom Akses",
        "currentoperator": "OP-Andi",
        "originator": "System-Alert",
        "severity": "Emergency",
        "root_cause": "fiber cut",
        "over_sla": true
      },
      {
        "orderid": "TCK-99013",
        "title": "Kegagalan Modul GPON Card",
        "ticketstatus": "Pending",
        "createptproblemdes": "Hardware module gpon terbakar petir",
        "createptassignto": "PM_Mandau",
        "currentoperator": "OP-Budi",
        "originator": "NOC-GSC",
        "severity": "Critical",
        "root_cause": "hardware failure",
        "over_sla": false
      },
      {
        "orderid": "TCK-99014",
        "title": "Genset Mati di Site Induk",
        "ticketstatus": "Closed",
        "createptproblemdes": "Power supply down karena BBM habis",
        "createptassignto": "Persada",
        "currentoperator": "OP-Caca",
        "originator": "NOC-GSC",
        "severity": "Major",
        "root_cause": "power issue",
        "over_sla": false
      }
    ]
  }
}
```

---

## 4. Mekanisme Pengolahan Data di Frontend

* **Validasi Awal:** Skrip kustom akan mendeteksi apakah payload respons valid dan memiliki field `severity`.
* **Jika Valid:** Data diolah langsung dan grafik donat ECharts akan me-render jumlah aktual dari database.
* **Jika Kosong/Tidak Valid:** Skrip secara otomatis beralih ke **Mock Data** bawaan (Emergency: 48 tiket, Critical: 120 tiket, dst) sehingga tampilan visual dashboard tidak akan pernah terlihat kosong atau rusak di editor/dashboard preview.
