# Rumus SQL untuk Validasi Data Dashboard

Dokumen ini menyediakan kueri (query) SQL untuk memvalidasi apakah kalkulasi data dinamis pada dashboard kustom Anda sudah sesuai dengan data aktual di database/tabel backend OWS.

> [!NOTE]
> Nama tabel dalam contoh kueri di bawah menggunakan `tb_problem_ticket`. Harap sesuaikan dengan nama tabel riil di database Anda.
> Sesuaikan juga nama kolom jika ada perbedaan penamaan (misal: `ticket_status` vs `ticketstatus`).

---

## 1. Validasi Segment 1: Severity Overview (SLA Based)
Kueri ini digunakan untuk mencocokkan jumlah **Total PT**, **Pending PT**, dan **Over SLA** untuk tiap tingkat keparahan (*Emergency, Critical, Major, Minor*):

```sql
SELECT 
    CASE 
        WHEN LOWER(severity) LIKE '%emergency%' OR severity = '1' THEN 'Emergency'
        WHEN LOWER(severity) LIKE '%critical%' OR severity = '2' THEN 'Critical'
        WHEN LOWER(severity) LIKE '%major%' OR severity = '3' THEN 'Major'
        WHEN LOWER(severity) LIKE '%minor%' OR severity = '4' THEN 'Minor'
        ELSE 'Others'
    END AS severity_category,
    COUNT(1) AS total_pt,
    SUM(CASE WHEN LOWER(ticketstatus) IN ('pending', 'in progress') THEN 1 ELSE 0 END) AS pending_pt,
    SUM(CASE WHEN over_sla = 1 OR over_sla = true OR LOWER(CAST(over_sla AS CHAR)) = 'true' THEN 1 ELSE 0 END) AS over_sla_pt
FROM tb_problem_ticket
GROUP BY 1;
```

---

## 2. Validasi Segment 2: Phase Status by Responsibility Party (Pending)
Kueri ini menghitung matriks umur tiket (*Aging Bucket*) untuk setiap tahapan proses (*Phase*) dan penanggung jawab (*Partner*):

```sql
SELECT 
    -- Map Partner
    CASE 
        WHEN LOWER(createptassignto) LIKE '%telkom%' OR LOWER(createptassignto) LIKE '%akses%' THEN 'Telkom Akses'
        WHEN LOWER(createptassignto) LIKE '%mandau%' OR LOWER(createptassignto) LIKE '%pm%' THEN 'Mandau'
        WHEN LOWER(createptassignto) LIKE '%persada%' OR LOWER(createptassignto) LIKE '%pwx%' THEN 'Persada'
        ELSE 'Others'
    END AS partner_name,
    -- Map Phase
    CASE 
        WHEN LOWER(phase) LIKE '%confirm%' THEN '6. Confirm PT'
        WHEN LOWER(phase) LIKE '%handle analyze%' THEN '2. Handle Analyze PT'
        WHEN LOWER(phase) LIKE '%analyze%' THEN '3. Analyze PT'
        WHEN LOWER(phase) LIKE '%handle implement%' THEN '4. Handle Implement PT'
        WHEN LOWER(phase) LIKE '%implement%' THEN '5. Implement PT'
        ELSE '1. Create PT'
    END AS phase_name,
    COUNT(1) AS total_pt,
    -- Aging Buckets
    SUM(CASE WHEN aging <= 7 THEN 1 ELSE 0 END) AS bucket_0_7,
    SUM(CASE WHEN aging > 7 AND aging <= 15 THEN 1 ELSE 0 END) AS bucket_8_15,
    SUM(CASE WHEN aging > 15 AND aging <= 21 THEN 1 ELSE 0 END) AS bucket_16_21,
    SUM(CASE WHEN aging > 21 THEN 1 ELSE 0 END) AS bucket_over_sla,
    -- Average Aging
    ROUND(AVG(aging), 1) AS avg_aging_days
FROM tb_problem_ticket
GROUP BY 1, 2
ORDER BY 1, 2;
```

---

## 3. Validasi Segment 4: SLA Compliance by Party
Kueri ini digunakan untuk memvalidasi tabel persentase pemenuhan SLA per vendor/partner:

```sql
SELECT 
    CASE 
        WHEN LOWER(createptassignto) LIKE '%persada%' THEN 'Persada'
        WHEN LOWER(createptassignto) LIKE '%telkom%' OR LOWER(createptassignto) LIKE '%akses%' THEN 'Telkom Akses'
        WHEN LOWER(createptassignto) LIKE '%mandau%' THEN 'Mandau'
        WHEN LOWER(createptassignto) LIKE '%ije%' THEN 'IJE'
        ELSE 'Surge'
    END AS party,
    COUNT(1) AS total_pt,
    SUM(CASE WHEN over_sla = 0 OR over_sla = false OR LOWER(CAST(over_sla AS CHAR)) = 'false' THEN 1 ELSE 0 END) AS within_sla,
    SUM(CASE WHEN over_sla = 1 OR over_sla = true OR LOWER(CAST(over_sla AS CHAR)) = 'true' THEN 1 ELSE 0 END) AS over_sla,
    CONCAT(ROUND((SUM(CASE WHEN over_sla = 0 OR over_sla = false THEN 1 ELSE 0 END) * 100.0) / COUNT(1), 1), '%') AS sla_achievement
FROM tb_problem_ticket
GROUP BY 1
ORDER BY total_pt DESC;
```

---

## 4. Validasi Segment 5: Top Root Cause (All PT)
Kueri ini digunakan untuk mencocokkan chart peringkat penyebab gangguan utama:

```sql
SELECT 
    CASE 
        WHEN LOWER(root_cause) LIKE '%fiber%' OR LOWER(root_cause) LIKE '%cut%' THEN 'Fiber Cut'
        WHEN LOWER(root_cause) LIKE '%hardware%' OR LOWER(root_cause) LIKE '%hw%' THEN 'Hardware'
        WHEN LOWER(root_cause) LIKE '%power%' OR LOWER(root_cause) LIKE '%pwr%' THEN 'Power'
        WHEN LOWER(root_cause) LIKE '%config%' THEN 'Configuration'
        WHEN LOWER(root_cause) LIKE '%software%' OR LOWER(root_cause) LIKE '%app%' THEN 'Software'
        ELSE 'Others'
    END AS root_cause_category,
    COUNT(1) AS total_pt,
    CONCAT(ROUND((COUNT(1) * 100.0) / (SELECT COUNT(1) FROM tb_problem_ticket), 1), '%') AS percentage
FROM tb_problem_ticket
GROUP BY 1
ORDER BY total_pt DESC;
```
