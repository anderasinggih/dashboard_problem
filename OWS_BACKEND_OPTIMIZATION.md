# Dokumentasi Field Name Resmi OWS Database & Dashboard Mapping

Dokumen ini mencatat **daftar nama kolom/field resmi** hasil inspect payload JSON dari server OWS Production (Network Tab F12), serta cara pemetaan (*mapping*) data pada script `custom_dashboard_script.js`.

---

## 1. Daftar Field Name Resmi OWS (JSON Payload)

| Nama Field (OWS Official) | Tipe Data Payload | Contoh Value dari Production | Keterangan & Penggunaan |
| :--- | :--- | :--- | :--- |
| `orderid` / `keycode` / `id` | String | `"PT-20260625-00000001"` | Identifier unik Ticket ID |
| `title` | String | `"[Transmission] Fiber Cut – Cable Burn..."` | Judul ticket |
| `responsibility` | String | `"Telkom Akses"` | **Field Resmi Responsibility Party** (Telkom Akses, Mandau, Persada, Others) |
| `createticketlevel` / `severity` | Array of Object / String | `[{"text": "Major", "value": "Major"}]` | Severity / Tingkat Keparahan ticket |
| `root_cause` / `analyzecause` | String | `"Transmission"` | Root Cause (Environment, Transmission, Power, Hardware, Others) |
| `sub_root_cause` | String | `"Fiber Cut - Fire"` | Detail Sub Root Cause |
| `ticketstatus` / `status` | String | `"running"`, `"open"`, `"closed"` | Status tiket |
| `slastatus` | String | `"sla_violation"`, `"within"` | Status SLA |
| `over_sla` | Boolean / String | `true`, `false`, `"1"` | Indicator SLA Overdue |
| `current_phase` / `operate_phase` | String | `"Handle Analyze PT"`, `"Create PT"` | Phase operasional tiket (TT10, TT11, confirm, etc.) |
| `createptproblemdes` / `procfaultreasondes` | String | `"Secure cable installation..."` | Deskripsi masalah |
| `createptassignto` | String | `"group:HW NOC FO;group:Telkom Akses MS"` | Grup penanggung jawab |
| `currentoperator` | String | `"group:HW NOC FO"` | Operator aktif saat ini |
| `originator` | String | `"user:bwx1495591"` | Pembuat tiket |
| `createtime` / `createfirstoccurtime` | String / Object | `"2026-06-24 17:20:33"` / `{"local": "..."}` | Waktu tiket dibuat |
| `closetime` | String | `"2026-07-16 00:20:36"` | Waktu tiket ditutup |
| `lastupdatetime` | String | `"2026-07-16 00:20:36"` | Waktu pembaruan terakhir |
| `operate_time` | String | `"2026-06-24 17:20:33"` | Waktu eksekusi operasional |
| `createdomain` / `createptnetworktype` | String / Array | `"DWDM"` / `[{"text": "DWDM"}]` | Domain jaringan |
| `createrequestsrcticketid` | String | `"INC-20260623-00000094"` | Source Incident ID terkait |
| `confirmaccept` | String | `"accept"`, `"yes"`, `"true"` | Konfirmasi penerimaan tiket |
| `pt14_submittime` | String | `"2026-06-24 17:20:34"` | Timestamp submit konfirmasi PT |

---

## 2. Aturan Handling Tipe Data Kompleks OWS

Server OWS seringkali mengembalikan nilai berupa **Array of Object** atau **Object Timestamp**. Script Dashboard menangani ini secara otomatis menggunakan helper function `extractOWSField(val)`:

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

---

## 3. Sampel Full JSON Payload Asli (Production OWS)

```json
{
  "orderid": "PT-20260625-00000001",
  "keycode": "PT-20260625-00000001",
  "id": "PT-20260625-00000001",
  "title": "[Transmission] Fiber Cut – Cable Burn at Cibatu <> Tasikmalaya",
  "responsibility": "Telkom Akses",
  "createticketlevel": [
    { "text": "Major", "suffix": "", "value": "Major" }
  ],
  "root_cause": "Transmission",
  "sub_root_cause": "Fiber Cut - Fire",
  "ticketstatus": "running",
  "slastatus": "sla_violation",
  "current_phase": "Handle Analyze PT",
  "current_phaseid": "TT11",
  "operate_phase": "Create PT",
  "createtime": "2026-06-24 17:20:33",
  "createfirstoccurtime": {
    "utc": "2026-06-24 17:12:14",
    "local": "2026-06-25 00:12:14"
  },
  "createptproblemdes": "\"Secure cable installation\\nUse Buried Cable\\nEnd to End OTDR\"\n",
  "procfaultreasondes": "[Transmission] Fiber Cut – Cable Burn at Cibatu <> Tasikmalaya",
  "createptassignto": "group:HW NOC FO;group:HW NOC BO;group:Telkom Akses MS",
  "currentoperator": "group:HW NOC FO;group:HW NOC BO;group:Telkom Akses MS",
  "originator": "user:bwx1495591",
  "lastupdatetime": "2026-07-16 00:20:36",
  "createdomain": "DWDM",
  "createrequestsrcticketid": "INC-20260623-00000094"
}
```
