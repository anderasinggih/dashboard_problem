# COMPLETE PROMPT & MANUAL GUIDE FOR MIRO DIAGRAM GENERATOR (SEGMENTED SWIMLANES)
## Problem Ticket Dashboard (Huawei OWS / GDE Studio) Data Flow & Business Logic Diagram

---

## 📝 OPSI 1: PROMPT EXTREME DETAIL UNTUK MIRO AI / DIAGRAM GENERATOR (WITH EXPLICIT SWIMLANES)

Copy-paste seluruh teks di dalam kotak di bawah ini ke fitur **Miro AI Assist / Mermaid Diagram Generator / ChatGPT Visual Prompter**:

```text
Create a highly detailed, professional, and visually structured technical flowchart diagram for a Huawei OWS (GDE Studio) Problem Ticket Dashboard System. 

CRITICAL REQUIREMENT: Group the flowchart into 5 DISTINCT VISUAL CONTAINERS / SWIMLANES (Visual Sub-groups) from Top to Bottom. Each segment must be enclosed in its own labeled bounding box / frame to separate execution concerns clearly.

Use standard flowchart notation (Ovals for Start/End, Rectangles for Data Processes, Diamonds for Decisions/Logics, Subroutines/Group Boxes for System Modules, and Parallelograms for Data Inputs/Outputs).

================================================================================
SEGMENT 1 [SWIMLANE FRAME 1]: DATA INGESTION & HYBRID PIPELINE
================================================================================
Frame Title: "SEGMENT 1: OWS API INGESTION & PARALLEL HYBRID PIPELINE"
Visual Style: Light Blue Bounding Box Background

Nodes inside Frame 1:
- [Start] Oval: "Start: Dashboard Initialization"
- [Input] Parallelogram: "Payload API Request (Parameters: startDate, endDate, party)"
- [Sub-Group]: "Parallel Execution"
  ├── Branch A (Instant Aggregation): "Call Summary Service API (/adc-service/.../problem_ticket_get_dashboard_summary)"
  │   └── [Process]: "Extract Aggregated Counts & Instantly Render Top Stat Cards (Total, Open, Pending, Closed, Canceled)"
  └── Branch B (Paginated Detail Fetching): "Call List Service API (/adc-service/.../dashboard__problem_ticket)"
      └── [Process]: "Batch Pagination Loop (start=offset, limit=1000) until all raw tickets fetched"

================================================================================
SEGMENT 2 [SWIMLANE FRAME 2]: DATA SANITIZATION & FIELD UNPACKING
================================================================================
Frame Title: "SEGMENT 2: DYNAMIC FIELD UNPACKING (extractOWSField)"
Visual Style: Soft Purple Bounding Box Background

Nodes inside Frame 2:
- [Process]: "Iterate through raw JSON tickets"
- [Process]: "Execute Safe JSON.parse Wrapper & extractOWSField() helper"
- [Data Extraction Grid]:
  ├── 'orderid' / 'keycode' ────────► Ticket ID
  ├── 'ticketstatus' / 'status' ────► Ticket Status
  ├── 'operate_phase' / 'current_phase' ► Phase Status
  ├── 'confirmaccept' ──────────────► Confirm Accept (Accept/Reject)
  ├── 'responsibility' ─────────────► Responsible Party
  ├── 'createticketlevel' / 'severity'► Ticket Severity
  ├── 'root_cause' / 'analyzecause' ──► Root Cause
  ├── 'createtime' & 'closetime' ───► Timestamps
  └── 'slastatus' / 'over_sla' ─────► SLA Violation Flag

================================================================================
SEGMENT 3 [SWIMLANE FRAME 3]: PARTNER RESPONSIBILITY MAPPING
================================================================================
Frame Title: "SEGMENT 3: PARTNER RESPONSIBILITY MAPPING (getTicketPartner)"
Visual Style: Slate Gray Bounding Box Background

Nodes inside Frame 3:
- [Decision] Diamond: "Evaluate responsibility field (rawParty.toLowerCase()):"
  ├── Branch 1: Contains 'telkom' OR 'akses' ──► [Process]: Set Partner = "Telkom Akses"
  ├── Branch 2: Contains 'mandau' ───────────────► [Process]: Set Partner = "Mandau"
  ├── Branch 3: Contains 'persada' ──────────────► [Process]: Set Partner = "Persada"
  └── Branch 4: Otherwise / Default ───────────► [Process]: Set Partner = "Others"

================================================================================
SEGMENT 4 [SWIMLANE FRAME 4]: STRICT STATUS VALIDATION & REJECT LOOP
================================================================================
Frame Title: "SEGMENT 4: STRICT STATUS VALIDATION, REJECT LOOP, & AGING CALCULATION"
Visual Style: Dark Blue / Amber Bounding Box Background

Nodes inside Frame 4:
- [Decision] Diamond: "Is Ticket Closed? DOUBLE CONDITION: (ticketstatus = 'Closed'/'Completed') AND (confirmaccept = 'Accept'/'Accepted'/'Yes'/'True')"

  ├── [YES BRANCH - CLOSED TICKETS]:
  │   ├── [Process]: Set Status Category = "closed" (Closed PT)
  │   ├── [Process]: Calculate Closed Aging = (closetime - createtime) / 86,400,000 ms
  │   └── [Process]: Assign Ticket Phase = "7. Closed PT"
  │
  └── [NO BRANCH - OPEN / RUNNING / CANCELED TICKETS]:
      ├── [Decision] Diamond: "Is ticketstatus = 'Canceled' OR 'Cancelled' OR 'Rejected'?"
      │   ├── [YES]: Set Status = "canceled" (Canceled PT) & Assign Phase = "8. Canceled PT"
      │   └── [NO]: Set Status = "open" / "pending" (Running PT)
      │
      ├── [Decision] Diamond: "REJECT LOOP CHECK: Does confirmaccept contain string 'reject'?"
      │   ├── [YES (RED ARROW)]: OVERRIDE Phase = "5. Implement PT" (Force Reject Loop Back)
      │   └── [NO]: Map Phase based on operate_phase (Create, Handle Analyze, Analyze, Handle Implement, Implement, Confirm)
      │
      └── [Process]: Calculate Running Aging = (Current Time - createtime) / 86,400,000 ms

================================================================================
SEGMENT 5 [SWIMLANE FRAME 5]: AGING BUCKETS, SLA MATCHING, & UI RENDERING
================================================================================
Frame Title: "SEGMENT 5: AGING BUCKETS, SLA TARGETS, & FINAL UI RENDERING"
Visual Style: Light Emerald Bounding Box Background

Nodes inside Frame 5:
- [Process]: "Aging Bucket Grouping: <= 7 Days -> Bucket b1 | > 7 Days -> Bucket b2"
- [Process]: "Match Severity SLA Targets: Emergency (7d) | Critical (15d) | Major (21d) | Minor (30d)"
- [Process]: "Match Root Cause Category: Environment | Transmission | Power | Hardware | Others"
- [Output] Parallelogram: "Render Components 1-6:"
  ├── Container 1: Severity Overview Donut Charts (ECharts) & SLA Violation Stats
  ├── Container 2: Phase Status Table & Heatmap Grid (Overall & Partner Breakdown)
  ├── Container 3: Weekly Open vs Closed Trend Line/Bar Chart (ECharts)
  ├── Container 4: Top Root Cause Pie Chart (ECharts)
  ├── Container 5: Weekly SLA Compliance Rate Table (%)
  └── Container 6: Interactive Ticket List Table (Debounced Search 300ms, Filter, & Detail Modal)

- [End] Oval: "End: Interactive Dashboard Active"

DESIGN STYLING INSTRUCTIONS:
- Generate 5 DISTINCT SUB-GRAPH FRAMES / SWIMLANES to separate Segment 1 to Segment 5 clearly.
- Use explicit visual borders and background colors for each segment frame.
- Use bold labels for OWS field names (**ticketstatus**, **confirmaccept**, **responsibility**).
- Draw clear directional arrows connecting Segment 1 ──► Segment 2 ──► Segment 3 ──► Segment 4 ──► Segment 5.
```

---

## 🎨 OPSI 2: PANDUAN MANUAL SUSUNAN SEGMENT/SWIMLANE DI MIRO

Jika menyusun di Miro secara manual, gunakan fitur **Frame (F)** untuk membuat 5 kotak pembatas vertikal dari atas ke bawah:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 🟦 FRAME 1: DATA INGESTION & HYBRID PIPELINE                           │
│   [Start] ──► [Input API] ──► [Service A (Summary) & Service B (List)]  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🟪 FRAME 2: DATA SANITIZATION & FIELD UNPACKING                        │
│   [Safe JSON.parse] ──► [extractOWSField() Grid: 9 Fields Unpacked]     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ ⬜ FRAME 3: PARTNER RESPONSIBILITY MAPPING                              │
│   [Check Party] ──► (Telkom Akses | Mandau | Persada | Others)         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🟨 FRAME 4: STRICT STATUS VALIDATION & REJECT LOOP                      │
│   [Closed Check (Double Cond)] ──► YA (Closed PT) / TIDAK (Running PT) │
│   [Reject Loop Check] ──► OVERRIDE to "5. Implement PT"                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🟩 FRAME 5: AGING BUCKETS, SLA MATCHING, & FINAL UI RENDERING          │
│   [Aging Bucket b1/b2] ──► [SLA Matching] ──► [Render Containers 1-6]  │
│   ──► [End Node]                                                       │
└────────────────────────────────────────────────────────────────────────┘
```
