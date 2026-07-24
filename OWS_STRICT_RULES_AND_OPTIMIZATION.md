# HUAWEI OWS (GDE STUDIO) DASHBOARD DEVELOPMENT GUIDELINES & STRICT RULES

Dokumen ini berisi standar arsitektur, panduan lingkungan runtime, aturan ketat (*strict rules*), dan optimasi khusus untuk pengembangan **Custom HTML/JS Dashboard** di platform **Huawei OWS (GDE Studio / ADC Studio)**.

Dokumen ini dirancang agar AI Agent / Developer lain dapat langsung memahami batas teknis, perilaku unik (*quirks*), dan praktik terbaik saat membangun dashboard kustom di OWS.

---

## 1. Overview Arsitektur & Perilaku Runtime OWS

### A. Lingkungan Eksekusi (Browser & Sandbox)
1. **Parallel Hybrid Data Pipeline**:
   - **Summary Service (API Stat/Agg) & List Service (API Pagination)**:
     - Gunakan Summary Service untuk mengisi komponen header/kartu statistik utama agar cepat secara instan.
     - Gunakan List Service secara asinkron (*paged fetching*) untuk mengunduh dataset lengkap yang digunakan oleh ECharts, Heatmap Aging, dan Tabel Detail Ticket.
2. **MessageProcessor (Context Runtime OWS)**:
   - Di lingkungan live OWS GDE Studio, komunikasi API menggunakan objek bawaan `MessageProcessor`.
   - Di lingkungan pengujian lokal (misal `http.server`), objek `MessageProcessor` tidak ada, sehingga script **WAJIB** memiliki *fallback mechanism* (misal memuat file CSV/JSON mock lokal).

---

## 2. Dynamic OWS JSON Payload Handling (SANGAT PENTING)

Payload API dari OWS GDE Studio sering kali me-return tipe data yang dibungkus (*wrapped*) dalam struktur kompleks berupa `Array of Objects` atau `Nested Objects`.

### A. Ekstraksi Field Serbaguna (`extractOWSField`)
AI/Developer **DILARANG** mengasumsikan field bertipe String murni. Setiap membaca field dari item tiket (seperti `responsibility`, `ticketstatus`, `operate_phase`, `createticketlevel`), gunakan helper sanitasi berikut:

```javascript
function extractOWSField(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val) && val.length > 0) {
        var item = val[0];
        if (typeof item === 'object' && item !== null) {
            return item.text || item.value || item.name || item.label || '';
        }
        return String(item);
    }
    if (typeof val === 'object') {
        return val.text || val.value || val.local || val.utc || val.name || val.label || '';
    }
    return String(val);
}
```

### B. Safe JSON.parse Wrapper (Mencegah Crash `splPreviewer`)
Di lingkungan Studio Web OWS (`splPreviewer.js`), terdapat bug bawaan Studio di mana previewer memanggil `JSON.parse` pada variabel yang bernilai `undefined`. Tempatkan **Safe Wrapper** ini di baris pertama file JS utama:

```javascript
(function () {
    if (typeof JSON !== 'undefined' && JSON.parse) {
        var _nativeJSONParse = JSON.parse;
        JSON.parse = function (text, reviver) {
            if (text === undefined || text === null || text === 'undefined' || text === '') {
                return null;
            }
            try {
                return _nativeJSONParse.call(JSON, text, reviver);
            } catch (e) {
                console.warn('[OWS Safe JSON.parse] Prevented crash on invalid JSON input:', text);
                return null;
            }
        };
    }
})();
```

---

## 3. Aturan Bisnis & Logika Status Tiket (Strict Rules)

### A. Logika Tiket Selesai / Closed (`isTicketClosed`)
Tiket dianggap **Closed/Completed** HANYA JIKA memenuhi dua syarat ganda sekaligus:
1. `Status` = `'Closed'` ATAU `'Completed'`
2. `Confirm Accept` (Kolom `confirmaccept` / `Accept or Not(Confirm PT)`) = `'Accept'`, `'Accepted'`, `'Yes'`, ATAU `'True'`.

### B. Logika Reject Loop (Perulangan Fase Konfirmasi)
Jika tiket berada di fase konfirmasi (`operate_phase` mengandung `'Confirm'`) TETAPI kolom `confirmaccept` bernilai `'Reject'`, maka status fase tiket **HARUS dikembalikan secara logis ke Fase 5 (Implement PT)**.

### C. Pemetaan Partner Responsibilitas (`responsibility`)
1. **Telkom Akses**: String mengandung `'telkom'` atau `'akses'`.
2. **Mandau**: String mengandung `'mandau'`.
3. **Persada**: String mengandung `'persada'`.
4. **Others**: Nilai selain tiga di atas.

---

## 4. TQL (Task Query Language) & Database Engine OWS

Saat melakukan query API ke backend OWS GDE Studio:
1. **Klausa `FROM`**: Gunakan path absolut tanpa tanda petik (contoh: `FROM /ProblemTicket/DataModel`).
2. **Filter Waktu (ISO Standard)**: Format timestamp menggunakan standar ISO string (contoh: `2026-07-01 00:00:00`).
3. **Case Sensitivity**: Perhatikan bahwa nama field di database JSON API OWS menggunakan karakter huruf kecil (contoh: `confirmaccept`, `operate_phase`, `pt14_submittime`).

---

## 5. UI/UX & Visual Standards

### A. Palet Warna Status Tiket
- **Running / Open**: Kuning / Amber (`#e3b341`, `#382a0f`).
- **Closed / Completed**: Hijau Emerald (`#56d364`, `#132d15`).
- **Canceled / Rejected**: Merah Crimson (`#ff7b72`, `#341212`).

### B. Aging Bucket Standards
Gunakan rentang aging yang disederhanakan:
- **0 - 7 Hari**: Dalam batas wajar SLA.
- **> 7 Hari**: Melebihi target SLA.

### C. Search Bar Debouncing
Setiap input pencarian pada tabel tiket harus menerapkan **Debounce (300ms)** untuk menghindari *layout freeze* atau *re-render spam* pada dataset berukuran besar.

```javascript
var searchTimeout;
function onSearchInput(val) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        // Execute search filter
    }, 300);
}
```

---

## 6. Checklist Sebelum Deploy ke OWS GDE Studio

- [ ] Baris pertama file JS menyertakan `JSON.parse` safe wrapper.
- [ ] Objek `MessageProcessor` dikemas dalam `try-catch` dengan fallback data mock lokal.
- [ ] Pengambilan field dari payload API dibungkus oleh `extractOWSField()`.
- [ ] Status tiket closed menggunakan verifikasi ganda (Status + Confirm Accept).
- [ ] Semua penanganan pencarian/filter menggunakan debouncing.
