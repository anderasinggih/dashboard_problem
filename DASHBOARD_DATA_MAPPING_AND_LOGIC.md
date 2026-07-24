# TECHNICAL DOCUMENTATION: PROBLEM TICKET DASHBOARD DATA MAPPING & BUSINESS LOGIC

Dokumen ini berisi dokumentasi teknis lengkap mengenai **sumber data (data mapping)**, **pemetaan kolom OWS**, dan **logika bisnis (business logic)** yang digunakan pada aplikasi **Problem Ticket Dashboard (Huawei OWS / GDE Studio)**. Dokumen ini ditujukan sebagai panduan bagi developer selanjutnya.

---

## 1. Arsitektur Komunikasi Data & Service API

Dashboard ini menggunakan pendekatan **Parallel Hybrid Mode** untuk menjamin kecepatan *page load* serta kelengkapan data visualisasi:

1. **Summary Service (`OWS_SUMMARY_SERVICE_ID`)**:
   - **Endpoint ID**: `/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_get_dashboard_summary`
   - **Fungsi**: Mengambil data hitungan agregasi statistik (*count*) secara cepat (< 50ms) dari backend OWS untuk mengisi kartu statistik bagian atas (*Header Cards*).
   - **Parameter Request**: `startDate`, `endDate`, `party`.

2. **List Service (`OWS_LIST_SERVICE_ID`)**:
   - **Endpoint ID**: `/adc-service/rest/v1/services/dashboard_problem_ticket_test/dashboard_problem_ticket_test/dashboard__problem_ticket`
   - **Fungsi**: Mengunduh seluruh baris detail tiket secara bertahap (*pagination batching* 1000 record per request) untuk digunakan oleh ECharts, Heatmap Aging, dan Tabel Detail Tiket.
   - **Parameter Request**: `start` (offset), `limit` (1000), `startDate`, `endDate`, `party`.

---

## 2. Pemetaan Field JSON API OWS (Data Mapping)

Karena payload JSON dari database OWS sering membungkus nilai dalam bentuk *Array of Objects* atau *Nested Objects*, setiap field diproses menggunakan helper sanitasi `extractOWSField()`.

| Nama Field Dashboard | Kolom Database OWS (JSON API) | Kolom Export Excel / CSV | Tipe Data & Format Contoh | Keterangan / Fungsi |
| :--- | :--- | :--- | :--- | :--- |
| **Ticket ID** | `orderid` / `keycode` / `id` | `Ticket ID` | String (`"PT202607170001"`) | Identifier unik tiket |
| **Title / Summary** | `title` | `Title` | String (`"Trouble Link FO..."`) | Judul atau deskripsi singkat tiket |
| **Ticket Status** | `ticketstatus` / `status` | `Ticket Status` | String (`"Running"`, `"Closed"`, `"Canceled"`) | Status utama siklus tiket |
| **Current Phase** | `operate_phase` / `current_phase` | `Current Phase` | String (`"1. Create PT"`, `"6. Confirm PT"`) | Tahapan proses tiket berjalan |
| **Severity / Level** | `createticketlevel` / `severity` | `Ticket Level(Create PT)` | String / UUID (`"508"`, `"Emergency"`, `"Critical"`) | Tingkat keparahan tiket |
| **Responsibility** | `responsibility` / `problem_responsible_party` | `Problem Responsible Party` | String (`"Telkom Akses"`, `"Huawei"`, `"Mandau"`) | Pihak yang bertanggung jawab |
| **Confirm Accept** | `confirmaccept` | `Accept or Not(Confirm PT)` | String (`"Accept"`, `"Reject"`, `"Yes"`, `"No"`) | Nilai persetujuan di fase konfirmasi |
| **Confirm Submit Time**| `pt14_submittime` | `SubmitTime(Confirm PT)` | String (`"2026-07-17 14:00:00"`) | Timestamp waktu konfirmasi disubmit |
| **Root Cause** | `root_cause` / `analyzecause` | `Root Cause` | String (`"Fiber Cut"`, `"Power Issue"`) | Penyebab utama masalah |
| **Create Time** | `createtime` / `createfirstoccurtime` | `Created At` | String (`"2026-07-01 08:30:00"`) | Waktu tiket dibuat |
| **Close Time** | `closetime` / `lastupdatetime` | `Closure Time` | String (`"2026-07-05 10:00:00"`) | Waktu tiket ditutup |
| **SLA Status** | `slastatus` / `over_sla` | `SLA Status` | String / Boolean (`"SLA_VIOLATION"`, `true`) | Indikator pelanggaran SLA |

---

## 3. Logika Bisnis Utama (Business Logic)

### A. Strict Rules Status Tiket Closed (`isTicketClosed`)
Suatu tiket **HANYA** dikategorikan sebagai **Closed PT (Selesai)** apabila memenuhi **dua kondisi ganda** secara bersamaan:
1. `ticketstatus` bernilai `'Closed'` atau `'Completed'`.
2. `confirmaccept` bernilai `'Accept'`, `'Accepted'`, `'Yes'`, atau `'True'`.

```javascript
// Implementasi pada custom_dashboard_script.js
var statusCat = getStatusCategory(t.ticketstatus || t.status || '');
var isClosed = (statusCat === 'closed');
```

### B. Reject Loop Rule (Pengembalian Fase Tiket)
Jika tiket disubmit di fase Konfirmasi (`Confirm PT`), tetapi hasilnya **Ditolak (Reject)** oleh penanggung jawab:
- **Logika**: Tiket secara otomatis dikembalikan (*looping*) ke **Phase 5: Implement PT**.
- **Kondisi Code**:
  ```javascript
  var isRejected = (String(t.confirmaccept || '').toLowerCase().indexOf('reject') !== -1);
  if (isRejected) {
      phase = '5. Implement PT';
  }
  ```

### C. Pemetaan Responsibilitas Partner (`getTicketPartner`)
Pengelompokan partner penanggung jawab dikategorikan berdasarkan pencocokan substring nama party:
- **Telkom Akses**: String mengandung kata `'telkom'` atau `'akses'`.
- **Mandau**: String mengandung kata `'mandau'`.
- **Persada**: String mengandung kata `'persada'`.
- **Others**: Semua nama party/vendor di luar tiga partner di atas (misal Huawei, Subcontractor lain).

### D. Perhitungan Umur Tiket / Aging Days (`calculateAgingDays`)
Perhitungan umur tiket dalam satuan hari (`Days`):
- **Tiket Masih Running/Open**: `Aging = (Waktu Sekarang - Waktu Create)`
- **Tiket Sudah Closed/Completed**: `Aging = (Waktu Close - Waktu Create)`
- **Formula**: `diffMs / (1000 * 60 * 60 * 24)`

### E. Penyederhanaan Aging Bucket (Heatmap & Stacked Bar)
Kategori umur tiket pada tabel *Phase Status* disederhanakan menjadi 2 rentang utama:
1. **0 - 7 Hari (`b1`)**: Tiket dalam rentang waktu penanganan standar.
2. **> 7 Hari (`b2`)**: Tiket yang mengalami keterlambatan penanganan (> 7 hari).

### F. SLA Severity Target
Penetapan target SLA berdasarkan Severity Tiket:
- **Emergency**: Target SLA **7 Hari**
- **Critical**: Target SLA **15 Hari**
- **Major**: Target SLA **21 Hari**
- **Minor**: Target SLA **30 Hari**

---

## 4. Struktur Komponen Dashboard

Dashboard terdiri dari 6 kontainer utama:
1. **Header Stat Cards**: Menampilkan Total PT, Open PT, Pending PT, Closed PT, Canceled PT secara instan.
2. **Container 1: Severity Overview (SLA Based)**: Donut Chart ECharts per tingkat keparahan beserta breakdown Root Cause & SLA Compliance.
3. **Container 2: Phase Status by Responsibility Party**: Tabel Heatmap & Stacked Bar progress tiket per fase dan per partner penanggung jawab.
4. **Container 3 & 4: Weekly Trend & Top Root Cause**: Bar chart tren mingguan tiket open/closed dan Pie chart sebaran root cause.
5. **Container 5: SLA Compliance Rate**: Tabel pencapaian SLA mingguan (Compliance %) per partner.
6. **Container 6: Problem Ticket List Table**: Tabel interaktif daftar tiket lengkap dengan fitur pencarian (Debounce 300ms), filter partner, pagination, dan pop-up detail modal tiket.

---

## 5. Kontak & Pemeliharaan Kodingan

- **File Script Utama**: `custom_dashboard_script.js`
- **File Styling Utama**: `custom_dashboard_style.css`
- **File HTML Container**: `HTML_Panel` / `index.html`
- **File Aturan OWS**: `OWS_STRICT_RULES_AND_OPTIMIZATION.md`
