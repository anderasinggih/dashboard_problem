/**
 * OWS GDE Studio - Problem Ticket Run Script Backend
 * Target Data Model: "/ProblemTicket/ProblemTicket/pt_problemticket"
 * 
 * RunScript ini mengeksekusi TQL langsung ke database OWS dan mengembalikan
 * payload terstruktur siap pakai untuk Dashboard Problem Ticket.
 */

function normalizeText(value) {
    if (value === null || typeof value === "undefined") {
        return "";
    }
    return String(value).trim();
}

function toNumber(value) {
    var numberValue = parseFloat(value);
    if (isNaN(numberValue)) {
        return 0;
    }
    return numberValue;
}

function getRows(response) {
    if (response === null || typeof response === "undefined") {
        return [];
    }

    if (response.result &&
        response.result._values &&
        typeof response.result._values.length === "number") {
        return response.result._values;
    }

    if (response.result &&
        response.result.results &&
        typeof response.result.results.length === "number") {
        return response.result.results;
    }

    if (response._values &&
        typeof response._values.length === "number") {
        return response._values;
    }

    if (response.results &&
        typeof response.results.length === "number") {
        return response.results;
    }

    if (response.data &&
        typeof response.data.length === "number") {
        return response.data;
    }

    return [];
}

function queryByTql(tql, parameters, start, limit) {
    var request = {};
    var response;
    var cleanParams = {};

    if (parameters && typeof parameters === 'object') {
        for (var key in parameters) {
            if (parameters.hasOwnProperty(key) && parameters[key] !== null && parameters[key] !== undefined && parameters[key] !== '') {
                cleanParams[key] = parameters[key];
            }
        }
    }

    request.start = start;
    request.limit = limit;
    request.page_size = limit;
    request.tql = tql;
    request.query_type = "NORMAL";
    request.parameters = cleanParams;

    response = ServiceInvoker.post(
        "/adc-model/rest/v1/model-instances/query-by-tql",
        request
    );

    return getRows(response);
}

function formatWeekLabel(weekKey) {
    var text = String(weekKey);
    var year;
    var week;

    if (text.length < 5) {
        return text;
    }

    year = text.substring(0, 4);
    week = text.substring(4);

    if (week.length === 1) {
        week = "0" + week;
    }

    return year + "-W" + week;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

var input = _message.Input;
var startDate;
var endDate;
var party;
var startTime;
var endTime;
var parameters;
var dataStart;
var dataLimit;

// Target Data Model OWS Problem Ticket
var modelUri = "\"/ProblemTicket/ProblemTicket/pt_problemticket\"";

var summaryTql;
var severityTql;
var phaseStatusTql;
var partnerSummaryTql;
var rootCauseTql;
var weeklyTrendTql;
var partyOptionsTql;
var alldataGridTql;
var dataGridTotalTql;

var summaryRows;
var severityRows;
var phaseRows;
var partnerRows;
var rootRows;
var weeklyRows;
var partyOptionRows;
var alldataGridRows;
var dataGridTotalRows;

var summaryRow;
var summary;
var dataGridTotalRow;
var dataGridTotal;

var severityOverview = [];
var phaseStatus = [];
var partnerSummary = [];
var rootCause = [];
var weeklyTrend = [];
var partyOptions = [];

var i;
var row;

// Parse Input Message
if (input === null ||
    typeof input === "undefined" ||
    typeof input !== "object") {
    input = _message;
}

if (input._values &&
    typeof input._values.length === "number" &&
    input._values.length > 0) {
    input = input._values[0];
}

startDate = normalizeText(input.start_date || input.startDate);
endDate = normalizeText(input.end_date || input.endDate);
party = normalizeText(input.party || input.responsibility);

dataStart = parseInt(input.start, 10);
dataLimit = parseInt(input.limit, 10);

if (isNaN(dataStart) || dataStart < 0) {
    dataStart = 0;
}

if (isNaN(dataLimit) || dataLimit <= 0) {
    dataLimit = 1000;
}

if (dataLimit > 1000) {
    dataLimit = 1000;
}

if (party.toUpperCase() === "ALL" ||
    party.toUpperCase() === "ALL PARTY") {
    party = "";
}

// Date Filter Validations
if ((startDate !== "" && endDate === "") ||
    (startDate === "" && endDate !== "")) {
    throw new ScriptError(
        "Start Date and End Date must be provided together."
    );
}

// Support both 'yyyy-MM-dd' and 'yyyy-MM-dd HH:mm:ss'
if (startDate !== "") {
    if (startDate.length > 10) {
        startDate = startDate.substring(0, 10);
    }
    if (startDate.search(/^\d{4}-\d{2}-\d{2}$/) !== 0) {
        throw new ScriptError(
            "Start Date must use yyyy-MM-dd format."
        );
    }
}

if (endDate !== "") {
    if (endDate.length > 10) {
        endDate = endDate.substring(0, 10);
    }
    if (endDate.search(/^\d{4}-\d{2}-\d{2}$/) !== 0) {
        throw new ScriptError(
            "End Date must use yyyy-MM-dd format."
        );
    }
}

if (startDate !== "" && startDate > endDate) {
    throw new ScriptError(
        "Start Date cannot be later than End Date."
    );
}

startTime = startDate === "" ? "" : startDate + " 00:00:00";
endTime = endDate === "" ? "" : endDate + " 23:59:59";

parameters = {
    start_time: startTime,
    end_time: endTime,
    party: party
};

// Build dynamic WHERE clause based on provided parameters
var whereClause = " where 1 = 1";

if (startTime !== "") {
    whereClause += " and pt.createtime >= $!start_time";
}
if (endTime !== "") {
    whereClause += " and pt.createtime <= $!end_time";
}
if (party !== "") {
    if (party.toLowerCase() === 'others') {
        whereClause += " and (pt.responsibility is null or (lower(pt.responsibility) not like '%telkom%' and lower(pt.responsibility) not like '%akses%' and lower(pt.responsibility) not like '%mandau%' and lower(pt.responsibility) not like '%persada%'))";
    } else {
        whereClause += " and pt.responsibility = $!party";
    }
}

// 1. SUMMARY STAT CARDS TQL (All-Time Unfiltered Overview)
summaryTql =
    "select " +
    "count(1) as total, " +
    "sum(case " +
    "when (lower(pt.ticketstatus) = 'closed' or lower(pt.ticketstatus) = 'completed') " +
    "and (lower(pt.confirmaccept) = 'accept' or lower(pt.confirmaccept) = 'accepted' or lower(pt.confirmaccept) = 'yes' or lower(pt.confirmaccept) = 'true') " +
    "then 1 else 0 end) as closed, " +
    "sum(case " +
    "when lower(pt.ticketstatus) = 'canceled' or lower(pt.ticketstatus) = 'cancelled' or lower(pt.ticketstatus) = 'rejected' " +
    "then 1 else 0 end) as canceled, " +
    "sum(case " +
    "when lower(pt.ticketstatus) = 'pending' or lower(pt.ticketstatus) = 'in progress' " +
    "then 1 else 0 end) as pending, " +
    "sum(case " +
    "when (lower(pt.ticketstatus) = 'closed' or lower(pt.ticketstatus) = 'completed') " +
    "and (lower(pt.confirmaccept) = 'accept' or lower(pt.confirmaccept) = 'accepted' or lower(pt.confirmaccept) = 'yes' or lower(pt.confirmaccept) = 'true') " +
    "then 0 " +
    "when lower(pt.ticketstatus) = 'canceled' or lower(pt.ticketstatus) = 'cancelled' or lower(pt.ticketstatus) = 'rejected' " +
    "then 0 else 1 end) as open " +
    "from " + modelUri + " pt where 1 = 1";

// 2. SEVERITY OVERVIEW TQL (SLA Based: Emergency, Critical, Major, Minor)
severityTql =
    "select " +
    "pt.createticketlevel as severity, " +
    "count(1) as total " +
    "from " + modelUri + " pt " +
    whereClause + " " +
    "group by pt.createticketlevel " +
    "order by total desc";

// 3. PHASE STATUS TQL
phaseStatusTql =
    "select " +
    "pt.operate_phase as operate_phase, " +
    "pt.current_phase as current_phase, " +
    "pt.confirmaccept as confirmaccept, " +
    "count(1) as total " +
    "from " + modelUri + " pt " +
    whereClause + " " +
    "group by pt.operate_phase, pt.current_phase, pt.confirmaccept " +
    "order by total desc";

// 4. PARTNER SUMMARY TQL (Telkom Akses, Mandau, Persada, Others)
var partnerWhereClause = " where 1 = 1";
if (startTime !== "") partnerWhereClause += " and pt.createtime >= $!start_time";
if (endTime !== "") partnerWhereClause += " and pt.createtime <= $!end_time";

partnerSummaryTql =
    "select " +
    "pt.responsibility as partner, " +
    "count(1) as total " +
    "from " + modelUri + " pt " +
    partnerWhereClause + " " +
    "group by pt.responsibility " +
    "order by total desc";

// 5. ROOT CAUSE BREAKDOWN TQL
rootCauseTql =
    "select " +
    "pt.root_cause as name, " +
    "count(1) as value " +
    "from " + modelUri + " pt " +
    whereClause + " " +
    "group by pt.root_cause " +
    "order by value desc " +
    "limit 10";

// 6. WEEKLY TREND TQL
var weeklyWhereClause = whereClause + (whereClause.indexOf('createtime') !== -1 ? "" : " and pt.createtime is not null");
weeklyTrendTql =
    "select " +
    "yearweek(pt.createtime, 1) as week_key, " +
    "count(1) as new_pt, " +
    "sum(case when (lower(pt.ticketstatus) = 'closed' or lower(pt.ticketstatus) = 'completed') and (lower(pt.confirmaccept) = 'accept' or lower(pt.confirmaccept) = 'yes') then 1 else 0 end) as closed_pt, " +
    "sum(case when lower(pt.ticketstatus) = 'pending' or lower(pt.ticketstatus) = 'in progress' then 1 else 0 end) as pending_pt " +
    "from " + modelUri + " pt " +
    weeklyWhereClause + " " +
    "group by yearweek(pt.createtime, 1) " +
    "order by week_key asc " +
    "limit 500";

// 7. RESPONSIBILITY PARTY OPTIONS TQL (For Filter Dropdown)
partyOptionsTql =
    "select " +
    "pt.responsibility as party, " +
    "count(1) as total " +
    "from " + modelUri + " pt " +
    partnerWhereClause + " " +
    "group by pt.responsibility " +
    "order by pt.responsibility asc " +
    "limit 500";

// 8. TICKET LIST DATA GRID TQL (Detail List - Optimized Explicit Fields Selection)
alldataGridTql =
    "select " +
    "pt.orderid as orderid, " +
    "pt.title as title, " +
    "pt.ticketstatus as ticketstatus, " +
    "pt.createticketlevel as createticketlevel, " +
    "pt.current_phase as current_phase, " +
    "pt.operate_phase as operate_phase, " +
    "pt.responsibility as responsibility, " +
    "pt.createtime as createtime, " +
    "pt.closetime as closetime, " +
    "pt.lastupdatetime as lastupdatetime, " +
    "pt.operate_time as operate_time, " +
    "pt.root_cause as root_cause, " +
    "pt.createptproblemdes as createptproblemdes, " +
    "pt.currentoperator as currentoperator, " +
    "pt.originator as originator, " +
    "pt.confirmaccept as confirmaccept, " +
    "pt.pt14_submittime as pt14_submittime, " +
    "pt.slastatus as slastatus " +
    "from " + modelUri + " pt " +
    whereClause + " " +
    "order by pt.createtime desc";

dataGridTotalTql =
    "select " +
    "count(1) as total " +
    "from " + modelUri + " pt " +
    whereClause;

// EXECUTE ALL QUERIES SAFELY WITH DETAILED QUERY-LEVEL TRY-CATCH
try {
    try { summaryRows = queryByTql(summaryTql, parameters, 0, 10); } catch (e1) { console.error('summaryTql error:', e1); summaryRows = []; }
    try { severityRows = queryByTql(severityTql, parameters, 0, 50); } catch (e2) { console.error('severityTql error:', e2); severityRows = []; }
    try { phaseRows = queryByTql(phaseStatusTql, parameters, 0, 100); } catch (e3) { console.error('phaseStatusTql error:', e3); phaseRows = []; }
    try { partnerRows = queryByTql(partnerSummaryTql, parameters, 0, 500); } catch (e4) { console.error('partnerSummaryTql error:', e4); partnerRows = []; }
    try { rootRows = queryByTql(rootCauseTql, parameters, 0, 20); } catch (e5) { console.error('rootCauseTql error:', e5); rootRows = []; }
    try { weeklyRows = queryByTql(weeklyTrendTql, parameters, 0, 500); } catch (e6) { console.error('weeklyTrendTql error:', e6); weeklyRows = []; }
    try { partyOptionRows = queryByTql(partyOptionsTql, { start_time: startTime, end_time: endTime }, 0, 500); } catch (e7) { console.error('partyOptionsTql error:', e7); partyOptionRows = []; }
    try { dataGridTotalRows = queryByTql(dataGridTotalTql, parameters, 0, 1); } catch (e8) { console.error('dataGridTotalTql error:', e8); dataGridTotalRows = []; }
    try { alldataGridRows = queryByTql(alldataGridTql, parameters, dataStart, dataLimit); } catch (e9) { console.error('alldataGridTql error:', e9); alldataGridRows = []; }
} catch (error) {
    throw new ScriptError(
        "Failed to query Problem Ticket dashboard data: " + error.message
    );
}

// FORMAT SUMMARY OUTPUT
summaryRow = summaryRows.length > 0 ? summaryRows[0] : {};
summary = {
    total: toNumber(summaryRow.total),
    open: toNumber(summaryRow.open),
    pending: toNumber(summaryRow.pending),
    closed: toNumber(summaryRow.closed),
    canceled: toNumber(summaryRow.canceled)
};

dataGridTotalRow = dataGridTotalRows.length > 0 ? dataGridTotalRows[0] : {};
dataGridTotal = toNumber(dataGridTotalRow.total);

// FORMAT SEVERITY OVERVIEW
for (i = 0; i < severityRows.length; i++) {
    row = severityRows[i];
    severityOverview.push({
        severity: normalizeText(row.severity || 'Minor'),
        total: toNumber(row.total),
        pending: toNumber(row.pending),
        over_sla: toNumber(row.over_sla)
    });
}

// FORMAT PHASE STATUS & AGING
for (i = 0; i < phaseRows.length; i++) {
    row = phaseRows[i];
    phaseStatus.push({
        phase: normalizeText(row.phase || '1. Create PT'),
        total: toNumber(row.total),
        b1: toNumber(row.b1),
        b2: toNumber(row.b2),
        avg_aging_days: toNumber(row.avg_aging_days)
    });
}

// FORMAT PARTNER SUMMARY
for (i = 0; i < partnerRows.length; i++) {
    row = partnerRows[i];
    partnerSummary.push({
        partner: normalizeText(row.partner),
        total: toNumber(row.total),
        open: toNumber(row.open),
        pending: toNumber(row.pending),
        closed: toNumber(row.closed),
        canceled: toNumber(row.canceled)
    });
}

// FORMAT ROOT CAUSE
for (i = 0; i < rootRows.length; i++) {
    row = rootRows[i];
    rootCause.push({
        name: normalizeText(row.name || 'Others'),
        value: toNumber(row.value)
    });
}

// FORMAT WEEKLY TREND
for (i = 0; i < weeklyRows.length; i++) {
    row = weeklyRows[i];
    if (row.week_key !== null && typeof row.week_key !== "undefined") {
        weeklyTrend.push({
            week_key: toNumber(row.week_key),
            week_label: formatWeekLabel(row.week_key),
            new_pt: toNumber(row.new_pt),
            pending_pt: toNumber(row.pending_pt),
            closed_pt: toNumber(row.closed_pt)
        });
    }
}

// FORMAT PARTY OPTIONS
for (i = 0; i < partyOptionRows.length; i++) {
    row = partyOptionRows[i];
    if (row.party && normalizeText(row.party) !== "") {
        partyOptions.push(normalizeText(row.party));
    }
}

// RETURN CLEAN JSON PAYLOAD
return {
    result: {
        success: true,
        message: "Problem Ticket dashboard data successfully loaded.",
        applied_filters: {
            start_date: startDate,
            end_date: endDate,
            party: party
        },
        summary: summary,
        partner_summary: partnerSummary,
        severity_overview: severityOverview,
        phase_status: phaseStatus,
        charts: {
            root_cause: rootCause,
            weekly_trend: weeklyTrend
        },
        filters: {
            parties: partyOptions
        },
        data_grid: {
            start: dataStart,
            limit: dataLimit,
            total: dataGridTotal,
            rows: alldataGridRows
        }
    }
};
