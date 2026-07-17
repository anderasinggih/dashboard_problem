# Rumus SQL untuk Validasi Data Dashboard

Dokumen ini menyediakan kueri (query) SQL standar yang siap dijalankan langsung di **Database Client** Anda (seperti **DBeaver**, **Navicat**, atau **PL/SQL Developer**) untuk memvalidasi data asli di database dengan visualisasi dashboard.

> [!IMPORTANT]
> Jalankan kueri ini di aplikasi database client Anda, **bukan di menu editor TQL / Proxy Model ADC Studio** (karena ADC TQL tidak mendukung query agregasi kompleks).

---

## 1. Validasi Segment 1: Severity Overview (SLA Based)
Kueri ini menghitung jumlah **Total PT**, **Pending PT**, dan **Over SLA** berdasarkan tingkat keparahan (*severity*):

```sql
SELECT 
    severity_category,
    COUNT(1) AS total_pt,
    SUM(CASE WHEN LOWER(ticketstatus) IN ('pending', 'running', 'in progress') THEN 1 ELSE 0 END) AS pending_pt,
    SUM(CASE WHEN over_sla = 1 OR over_sla = true OR over_sla = 'true' THEN 1 ELSE 0 END) AS over_sla_pt
FROM (
    SELECT 
        ticketstatus,
        over_sla,
        CASE 
            WHEN LOWER(severity) LIKE '%emergency%' OR severity = '1' THEN 'Emergency'
            WHEN LOWER(severity) LIKE '%critical%' OR severity = '2' THEN 'Critical'
            WHEN LOWER(severity) LIKE '%major%' OR severity = '3' THEN 'Major'
            WHEN LOWER(severity) LIKE '%minor%' OR severity = '4' THEN 'Minor'
            ELSE 'Others'
        END AS severity_category
    FROM pt_problemticket
) t
GROUP BY severity_category;
```

---

## 2. Validasi Segment 2: Phase Status by Responsibility Party (Pending)
Kueri ini menghitung matriks umur tiket (*Aging Bucket*) untuk setiap tahapan proses (*operate_phase*) dan penanggung jawab (*Partner*):

```sql
SELECT 
    partner_name,
    phase_name,
    COUNT(1) AS total_pt,
    SUM(CASE WHEN aging <= 7 THEN 1 ELSE 0 END) AS bucket_0_7,
    SUM(CASE WHEN aging > 7 AND aging <= 15 THEN 1 ELSE 0 END) AS bucket_8_15,
    SUM(CASE WHEN aging > 15 AND aging <= 21 THEN 1 ELSE 0 END) AS bucket_16_21,
    SUM(CASE WHEN aging > 21 THEN 1 ELSE 0 END) AS bucket_over_sla,
    ROUND(AVG(aging), 1) AS avg_aging_days
FROM (
    SELECT 
        aging,
        CASE 
            WHEN LOWER(createptassignto) LIKE '%telkom%' OR LOWER(createptassignto) LIKE '%akses%' THEN 'Telkom Akses'
            WHEN LOWER(createptassignto) LIKE '%mandau%' OR LOWER(createptassignto) LIKE '%pm%' THEN 'Mandau'
            WHEN LOWER(createptassignto) LIKE '%persada%' OR LOWER(createptassignto) LIKE '%pwx%' THEN 'Persada'
            ELSE 'Others'
        END AS partner_name,
        CASE 
            WHEN LOWER(operate_phase) LIKE '%confirm%' THEN '6. Confirm PT'
            WHEN LOWER(operate_phase) LIKE '%handle analyze%' THEN '2. Handle Analyze PT'
            WHEN LOWER(operate_phase) LIKE '%analyze%' THEN '3. Analyze PT'
            WHEN LOWER(operate_phase) LIKE '%handle implement%' THEN '4. Handle Implement PT'
            WHEN LOWER(operate_phase) LIKE '%implement%' THEN '5. Implement PT'
            ELSE '1. Create PT'
        END AS phase_name
    FROM pt_problemticket
) t
GROUP BY partner_name, phase_name
ORDER BY partner_name, phase_name;
```

---

## 3. Validasi Segment 4: SLA Compliance by Party
Kueri ini menghitung kepatuhan SLA per vendor/partner:

```sql
SELECT 
    party,
    COUNT(1) AS total_pt,
    SUM(CASE WHEN over_sla = 0 OR over_sla = false OR over_sla = 'false' THEN 1 ELSE 0 END) AS within_sla,
    SUM(CASE WHEN over_sla = 1 OR over_sla = true OR over_sla = 'true' THEN 1 ELSE 0 END) AS over_sla,
    CONCAT(ROUND((SUM(CASE WHEN over_sla = 0 OR over_sla = false OR over_sla = 'false' THEN 1 ELSE 0 END) * 100.0) / COUNT(1), 1), '%') AS sla_achievement
FROM (
    SELECT 
        over_sla,
        CASE 
            WHEN LOWER(createptassignto) LIKE '%persada%' OR LOWER(createptassignto) LIKE '%pwx%' THEN 'Persada'
            WHEN LOWER(createptassignto) LIKE '%telkom%' OR LOWER(createptassignto) LIKE '%akses%' THEN 'Telkom Akses'
            WHEN LOWER(createptassignto) LIKE '%mandau%' OR LOWER(createptassignto) LIKE '%pm%' THEN 'Mandau'
            WHEN LOWER(createptassignto) LIKE '%ije%' THEN 'IJE'
            ELSE 'Surge'
        END AS party
    FROM pt_problemticket
) t
GROUP BY party
ORDER BY total_pt DESC;
```

---

## 4. Validasi Segment 5: Top Root Cause (All PT)
Kueri peringkat sebab gangguan (*Root Cause*):

```sql
SELECT 
    root_cause_category,
    COUNT(1) AS total_pt,
    CONCAT(ROUND((COUNT(1) * 100.0) / (SELECT COUNT(1) FROM pt_problemticket), 1), '%') AS percentage
FROM (
    SELECT 
        CASE 
            WHEN LOWER(root_cause) LIKE '%fiber%' OR LOWER(root_cause) LIKE '%cut%' THEN 'Fiber Cut'
            WHEN LOWER(root_cause) LIKE '%hardware%' OR LOWER(root_cause) LIKE '%hw%' THEN 'Hardware'
            WHEN LOWER(root_cause) LIKE '%power%' OR LOWER(root_cause) LIKE '%pwr%' THEN 'Power'
            WHEN LOWER(root_cause) LIKE '%config%' THEN 'Configuration'
            WHEN LOWER(root_cause) LIKE '%software%' OR LOWER(root_cause) LIKE '%app%' THEN 'Software'
            ELSE 'Others'
        END AS root_cause_category
    FROM pt_problemticket
) t
GROUP BY root_cause_category
ORDER BY total_pt DESC;
```
