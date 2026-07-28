# 📊 LOKASI MAPPING, LOGIKA, DAN ATURAN DASHBOARD PROBLEM TICKET (OWS)

Dokumen ini berisi dokumentasi lengkap mengenai logika arsitektur, pemetaan status bisnis, aturan agregasi, serta formula perhitungan aging per phase pada **Problem Ticket Dashboard OWS**.

---

## 1. 📌 LOGIKA PENGELOMPOKAN STATUS UTAMA (STAT CARDS)

Sistem mengelompokkan tiket ke dalam 4 kategori utama berdasarkan nilai pada kolom **`ticketstatus`** (kolom status makro) dan **`businessstatus`** (kolom ID UUID status bisnis produksi dari `/Bpm/msup_options/msup_options_businessstatus`).

| Kategori Dashboard | Status Ticket (`ticketstatus`) | Business Status UUID (`businessstatus`) | Pengaruh Terhadap TOTAL PT |
| :--- | :--- | :--- | :--- |
| **🔴 CANCELED PT** | `canceled`, `cancelled`, `rejected` | `bb129930-e165-11f0-aa35-0255ac1218d9` (*Canceled*)<br>`bb12994b-e165-11f0-aa35-0255ac1218d9` (*Abort Exception*) | **DI-EXCLUDE** (Dikeluarkan dari Total PT) |
| **🟣 CLOSED PT** | `closed`, `completed` | `bb129922-e165-11f0-aa35-0255ac1218d9` (*Closed*)<br>`bb129937-e165-11f0-aa35-0255ac1218d9` (*Completed*)<br>`bb12991f-e165-11f0-aa35-0255ac1218d9` (*BO Reject Closed*) | Termasuk dalam Total PT |
| **🟠 PENDING PT** | `running` | 22 Status Penanganan (Lihat Tabel Detail Section 2) | Termasuk dalam Total PT |
| **🟢 OPEN PT** | `running` | Seluruh `businessstatus` aktif di luar 22 status Pending & Canceled (misal: *In Review*, *Submitted*, *Accepted*, *CR*, dsb) | Termasuk dalam Total PT |

> **Formula Total PT:**
> $$\mathbf{\text{TOTAL PT}} = \text{OPEN PT} + \text{PENDING PT} + \text{CLOSED PT} \quad (\text{Tanpa Canceled PT})$$

---

## 2. 📋 DAFTAR DETAIL BUSINESS STATUS KATEGORI PENDING PT

Seluruh tiket berstatus **`ticketstatus = 'running'`** yang memiliki nilai **`businessstatus`** pada daftar 22 UUID di bawah ini dikategorikan sebagai **PENDING PT**:

| No | Label Status (*optionlabel*) | Nama Kode (*keycode*) | ID UUID Resmi Production |
| :---: | :--- | :--- | :--- |
| 1 | **Pending for Approval** | `BusinessStatus Pending for Approval` | `bb12992f-e165-11f0-aa35-0255ac1218d9` |
| 2 | **Pending for Assessment** | `BusinessStatus Pending for Assessment` | `bb129928-e165-11f0-aa35-0255ac1218d9` |
| 3 | **Pending for Validation** | `BusinessStatus Pending for Validation` | `bb129941-e165-11f0-aa35-0255ac1218d9` |
| 4 | **Pending** | `BusinessStatusPending` | `bb12991d-e165-11f0-aa35-0255ac1218d9` |
| 5 | **Pending for Analyze** | `BusinessStatusPendingForAnalyze` | `bb12993a-e165-11f0-aa35-0255ac1218d9` |
| 6 | **Pending for Handle** | `BusinessStatusPendingForHandle` | `bb129916-e165-11f0-aa35-0255ac1218d9` |
| 7 | **Pending for Review** | `BusinessStatusPendingForReview` | `bb12993c-e165-11f0-aa35-0255ac1218d9` |
| 8 | **Pending for Analyze Plan** | `BusinessStatusPendingforAnalyzePlan` | `bb129923-e165-11f0-aa35-0255ac1218d9` |
| 9 | **Pending for Approve Plan** | `BusinessStatusPendingforApprovePlan` | `bb129927-e165-11f0-aa35-0255ac1218d9` |
| 10 | **Pending for BO Accept** | `BusinessStatusPendingforBOAccept` | `bb12993f-e165-11f0-aa35-0255ac1218d9` |
| 11 | **Pending for BO Resolve** | `BusinessStatusPendingforBOResolve` | `bb129940-e165-11f0-aa35-0255ac1218d9` |
| 12 | **Pending for Confirmation** | `BusinessStatusPendingforConfirmation` | `bb12991c-e165-11f0-aa35-0255ac1218d9` |
| 13 | **Pending for Execute** | `BusinessStatusPendingforExcute` | `bb129925-e165-11f0-aa35-0255ac1218d9` |
| 14 | **Pending for Implementation** | `BusinessStatusPendingforImplementation` | `bb12992d-e165-11f0-aa35-0255ac1218d9` |
| 15 | **Pending for Review Improvement Plan** | `BusinessStatusPendingforReviewImprovementPlan` | `bb129942-e165-11f0-aa35-0255ac1218d9` |
| 16 | **Pending for requester confirm** | `BusinessStatusPendingforrequesterconfirm` | `bb129944-e165-11f0-aa35-0255ac1218d9` |
| 17 | **WIP** | `BusinessStatusWIP` | `bb12991a-e165-11f0-aa35-0255ac1218d9` |
| 18 | **New** | `BusinessStatusNew` | `bb12992e-e165-11f0-aa35-0255ac1218d9` |
| 19 | **Assigned** | `BusinessStatusAssigned` | `bb12993e-e165-11f0-aa35-0255ac1218d9` |
| 20 | **In Progress** | `BusinessStatusInProgress` | `bb12993b-e165-11f0-aa35-0255ac1218d9` |
| 21 | **Build and Test In Progress** | `BusinessStatusBuildandTestInProgress` | `bb12993d-e165-11f0-aa35-0255ac1218d9` |
| 22 | **Implementation In Progress** | `BusinessStatusImplementationInProgress` | `bb129932-e165-11f0-aa35-0255ac1218d9` |

---

## 3. ⏳ LOGIKA PERHITUNGAN AGING PER PHASE (PHASE STATUS BY RESPONSIBILITY PARTY)

Aging pada tabel **Phase Status by Responsibility Party** tidak dihitung dari waktu awal tiket dibuat (`createtime`), melainkan dihitung berdasarkan **waktu masuk (*Start Aging Date*) dari masing-masing phase penanganan**:

| Nama Phase | Tanggal Mulai Hitung Aging (*Start Aging Date*) | Kolom Timestamp OWS |
| :--- | :--- | :--- |
| **1. Create PT** | Waktu tiket pertama kali dibuat | `createtime` |
| **2. Handle Analyze PT** | Waktu tiket masuk ke tahap Handle Analyze | `tt10_submittime` / `tt11_createtime` |
| **3. Analyze PT** | Waktu tiket masuk ke tahap Analyze PT | `tt11_submittime` / `tt12_createtime` |
| **4. Handle Implement PT** | Waktu tiket masuk ke tahap Handle Implement | `tt12_submittime` / `pt10_createtime` |
| **5. Implement PT** | Waktu tiket masuk ke tahap Implement PT | `pt10_submittime` / `pt12_createtime` |
| **6. Confirm PT** | Waktu tiket masuk ke tahap Confirm PT | `pt12_submittime` / `pt14_createtime` |
| **7. Closed PT** | Durasi total sejak tiket dibuat hingga ditutup | `createtime` $\rightarrow$ `closetime` |
| **8. Canceled PT** | Durasi total sejak tiket dibuat hingga dibatalkan | `createtime` $\rightarrow$ `lastupdatetime` |

> **Kategori Bucket Aging per Phase:**
> - **`0-7 Days`**: Aging $\le 7$ hari.
> - **`>7 Days`**: Aging $> 7$ hari.
> - **`Avg Aging (Days)`**: $\frac{\sum \text{Durasi Hari pada Phase tersebut}}{\text{Total Tiket pada Phase tersebut}}$.

---

## 4. 🗓️ ATURAN SIKLUS MINGGUAN (WEEKLY PERIOD)

Dashboard menggunakan **Siklus Mingguan Operasional (Kamis s/d Rabu)**:
- **Hari Mulai Minggu:** Kamis (*Thursday*).
- **Hari Akhir Minggu:** Rabu (*Wednesday*).
- **Contoh Penamaan Label:** Rentang **23 Juli 2026 – 29 Juli 2026** dihitung secara otomatis sebagai **Week 30 (`W30`)**.

---

## 5. 🔍 TQL QUERY VALIDASI DATA PADA DATABASE OWS

Berikut adalah TQL Query lengkap yang bisa Anda gunakan langsung untuk memvalidasi jumlah data di database OWS:

### A. Validasi PENDING PT (Production UUIDs)
```sql
select count(1) as total_pending
from "/ProblemTicket/ProblemTicket/pt_problemticket" pt
where pt.businessstatus in (
    'bb12992f-e165-11f0-aa35-0255ac1218d9', -- Pending for Approval
    'bb129928-e165-11f0-aa35-0255ac1218d9', -- Pending for Assessment
    'bb129941-e165-11f0-aa35-0255ac1218d9', -- Pending for Validation
    'bb12991d-e165-11f0-aa35-0255ac1218d9', -- Pending
    'bb12993a-e165-11f0-aa35-0255ac1218d9', -- Pending for Analyze
    'bb129916-e165-11f0-aa35-0255ac1218d9', -- Pending for Handle
    'bb12993c-e165-11f0-aa35-0255ac1218d9', -- Pending for Review
    'bb129923-e165-11f0-aa35-0255ac1218d9', -- Pending for Analyze Plan
    'bb129927-e165-11f0-aa35-0255ac1218d9', -- Pending for Approve Plan
    'bb12993f-e165-11f0-aa35-0255ac1218d9', -- Pending for BO Accept
    'bb129940-e165-11f0-aa35-0255ac1218d9', -- Pending for BO Resolve
    'bb12991c-e165-11f0-aa35-0255ac1218d9', -- Pending for Confirmation
    'bb129925-e165-11f0-aa35-0255ac1218d9', -- Pending for Excute
    'bb12992d-e165-11f0-aa35-0255ac1218d9', -- Pending for Implementation
    'bb129942-e165-11f0-aa35-0255ac1218d9', -- Pending for Review Improvement Plan
    'bb129944-e165-11f0-aa35-0255ac1218d9', -- Pending for requester confirm
    'bb12991a-e165-11f0-aa35-0255ac1218d9', -- WIP
    'bb12992e-e165-11f0-aa35-0255ac1218d9', -- New
    'bb12993e-e165-11f0-aa35-0255ac1218d9', -- Assigned
    'bb12993b-e165-11f0-aa35-0255ac1218d9', -- In Progress
    'bb12993d-e165-11f0-aa35-0255ac1218d9', -- Build and Test In Progress
    'bb129932-e165-11f0-aa35-0255ac1218d9'  -- Implementation In Progress
)
```

### B. Validasi PENDING PT (Lingkungan Sandbox / Dev UUIDs)
```sql
select count(1) as total_pending_dev
from "/ProblemTicket/ProblemTicket/pt_problemticket" pt
where pt.businessstatus in (
    'b1fcdedc-e15e-11f0-a47f-0255ac120028', -- Assigned (Dev)
    'b1fcdeb8-e15e-11f0-a47f-0255ac120028', -- In Progress / Analyze (Dev)
    'b1fcdecc-e15e-11f0-a47f-0255ac120028', -- Rejected (Dev)
    'b1fcdecd-e15e-11f0-a47f-0255ac120028', -- Pending Approval (Dev)
    'b1fcdec6-e15e-11f0-a47f-0255ac120028', -- Pending Assessment (Dev)
    'b1fcdedf-e15e-11f0-a47f-0255ac120028'  -- Pending Validation (Dev)
)
```

### C. Validasi OPEN PT
```sql
select count(1) as total_open
from "/ProblemTicket/ProblemTicket/pt_problemticket" pt
where lower(pt.ticketstatus) = 'running'
  and pt.businessstatus not in (
    'bb12992f-e165-11f0-aa35-0255ac1218d9', 'bb129928-e165-11f0-aa35-0255ac1218d9',
    'bb129941-e165-11f0-aa35-0255ac1218d9', 'bb12991d-e165-11f0-aa35-0255ac1218d9',
    'bb12993a-e165-11f0-aa35-0255ac1218d9', 'bb129916-e165-11f0-aa35-0255ac1218d9',
    'bb12993c-e165-11f0-aa35-0255ac1218d9', 'bb129923-e165-11f0-aa35-0255ac1218d9',
    'bb129927-e165-11f0-aa35-0255ac1218d9', 'bb12993f-e165-11f0-aa35-0255ac1218d9',
    'bb129940-e165-11f0-aa35-0255ac1218d9', 'bb12991c-e165-11f0-aa35-0255ac1218d9',
    'bb129925-e165-11f0-aa35-0255ac1218d9', 'bb12992d-e165-11f0-aa35-0255ac1218d9',
    'bb129942-e165-11f0-aa35-0255ac1218d9', 'bb129944-e165-11f0-aa35-0255ac1218d9',
    'bb12991a-e165-11f0-aa35-0255ac1218d9', 'bb12992e-e165-11f0-aa35-0255ac1218d9',
    'bb12993e-e165-11f0-aa35-0255ac1218d9', 'bb12993b-e165-11f0-aa35-0255ac1218d9',
    'bb12993d-e165-11f0-aa35-0255ac1218d9', 'bb129932-e165-11f0-aa35-0255ac1218d9',
    'b1fcdedc-e15e-11f0-a47f-0255ac120028', 'b1fcdeb8-e15e-11f0-a47f-0255ac120028',
    'b1fcdecc-e15e-11f0-a47f-0255ac120028', 'b1fcdecd-e15e-11f0-a47f-0255ac120028',
    'b1fcdec6-e15e-11f0-a47f-0255ac120028', 'b1fcdedf-e15e-11f0-a47f-0255ac120028',
    'bb129930-e165-11f0-aa35-0255ac1218d9', 'bb12994b-e165-11f0-aa35-0255ac1218d9',
    'b1fcdece-e15e-11f0-a47f-0255ac120028', 'b1fcdee9-e15e-11f0-a47f-0255ac120028'
  )
```

### D. Validasi CLOSED PT
```sql
select count(1) as total_closed
from "/ProblemTicket/ProblemTicket/pt_problemticket" pt
where lower(pt.ticketstatus) in ('closed', 'completed')
   or pt.businessstatus in (
    'bb129922-e165-11f0-aa35-0255ac1218d9',
    'bb129937-e165-11f0-aa35-0255ac1218d9',
    'bb12991f-e165-11f0-aa35-0255ac1218d9',
    'b1fcdec0-e15e-11f0-a47f-0255ac120028',
    'b1fcdebd-e15e-11f0-a47f-0255ac120028'
   )
```

### E. Validasi CANCELED PT
```sql
select count(1) as total_canceled
from "/ProblemTicket/ProblemTicket/pt_problemticket" pt
where lower(pt.ticketstatus) in ('canceled', 'cancelled', 'rejected')
   or pt.businessstatus in (
    'bb129930-e165-11f0-aa35-0255ac1218d9',
    'bb12994b-e165-11f0-aa35-0255ac1218d9',
    'b1fcdece-e15e-11f0-a47f-0255ac120028',
    'b1fcdee9-e15e-11f0-a47f-0255ac120028'
   )
```

### F. Validasi TOTAL PT (Excluding Canceled)
```sql
select count(1) as total_pt_valid
from "/ProblemTicket/ProblemTicket/pt_problemticket" pt
where not (
    lower(pt.ticketstatus) in ('canceled', 'cancelled', 'rejected')
    or pt.businessstatus in (
        'bb129930-e165-11f0-aa35-0255ac1218d9',
        'bb12994b-e165-11f0-aa35-0255ac1218d9',
        'b1fcdece-e15e-11f0-a47f-0255ac120028',
        'b1fcdee9-e15e-11f0-a47f-0255ac120028'
    )
)
```

