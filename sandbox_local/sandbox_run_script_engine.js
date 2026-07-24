/**
 * LOCAL SANDBOX RUNSCRIPT EMULATOR
 * Reads tickets_data.csv locally and computes the exact OWS RunScript JSON payload.
 * Isolated inside sandbox_local folder.
 */

(function () {
    console.log('[SANDBOX RUNSCRIPT] Engine initialized.');

    function parseCSV(text) {
        let p = '', c = '', r = [];
        let q = false;
        let row = [''];
        for (let i = 0; i < text.length; i++) {
            c = text[i];
            let next = text[i + 1];
            if (c === '"') {
                if (q && next === '"') { row[row.length - 1] += '"'; i++; }
                else { q = !q; }
            } else if (c === ',') {
                if (q) { row[row.length - 1] += c; }
                else { row.push(''); }
            } else if (c === '\r' || c === '\n') {
                if (q) { row[row.length - 1] += c; }
                else {
                    if (c === '\r' && next === '\n') { i++; }
                    r.push(row);
                    row = [''];
                }
            } else {
                row[row.length - 1] += c;
            }
        }
        if (row.length > 1 || row[0] !== '') {
            r.push(row);
        }
        return r;
    }

    // Mock MessageProcessor for Local Sandbox Environment
    window.MessageProcessor = {
        process: function (options) {
            var params = options.data || {};
            var startDate = params.startDate || "";
            var endDate = params.endDate || "";
            var party = params.party || "ALL";
            var limit = params.limit || 1000;
            var start = params.start || 0;

            console.log('[SANDBOX RUNSCRIPT] Processing local query:', params);

            fetch('tickets_data.csv')
                .then(function (res) { return res.text(); })
                .then(function (text) {
                    var parsed = parseCSV(text);
                    if (parsed.length === 0) {
                        return options.success({ result: { data_grid: { rows: [] } } });
                    }

                    var headers = parsed[0].map(function (h) { return h.trim(); });

                    var headerMap = {
                        'Ticket ID': 'orderid',
                        'Title': 'title',
                        'Ticket Status': 'ticketstatus',
                        'Current Phase': 'current_phase',
                        'current_phase': 'current_phase',
                        'operate_phase': 'operate_phase',
                        'Responsibility': 'responsibility',
                        'Problem Responsible Party': 'responsibility',
                        'Ticket Level(Create PT)': 'severity',
                        'Created At': 'createtime',
                        'Closure Time': 'closetime',
                        'Updated At': 'lastupdatetime',
                        'operate_time': 'operate_time',
                        'Description': 'createptproblemdes',
                        'Root Cause': 'root_cause',
                        'SLA Status': 'slastatus',
                        'Accept or Not(Confirm PT)': 'confirmaccept',
                        'SubmitTime(Confirm PT)': 'pt14_submittime'
                    };

                    var tickets = [];
                    for (var i = 1; i < parsed.length; i++) {
                        var cols = parsed[i];
                        if (!cols || cols.length < 5) continue;
                        var cleanTicket = {
                            orderid: cols[1] || cols[126] || '',
                            title: cols[132] || cols[18] || '',
                            ticketstatus: cols[2] || '',
                            severity: cols[131] || '',
                            createticketlevel: cols[131] || '',
                            current_phase: cols[7] || cols[52] || cols[94] || '',
                            operate_phase: cols[94] || cols[7] || cols[52] || '',
                            responsibility: cols[74] || cols[110] || '',
                            createtime: cols[10] || cols[163] || '',
                            closetime: cols[11] || '',
                            lastupdatetime: cols[12] || '',
                            operate_time: cols[96] || '',
                            root_cause: cols[112] || cols[28] || '',
                            createptproblemdes: cols[14] || '',
                            currentoperator: cols[9] || '',
                            originator: cols[98] || '',
                            confirmaccept: cols[177] || '',
                            pt14_submittime: cols[179] || '',
                            slastatus: cols[0] || ''
                        };

                        if (cleanTicket.orderid || cleanTicket.createtime || cleanTicket.title) {
                            tickets.push(cleanTicket);
                        }
                    }

                    // Apply filters (Date Range & Party)
                    var filtered = tickets;
                    if (startDate) {
                        var startMs = new Date(startDate.replace(/-/g, '/')).getTime();
                        filtered = filtered.filter(function (t) {
                            if (!t.createtime) return false;
                            return new Date(t.createtime.replace(/-/g, '/')).getTime() >= startMs;
                        });
                    }
                    if (endDate) {
                        var endMs = new Date(endDate.replace(/-/g, '/')).getTime() + 86399000;
                        filtered = filtered.filter(function (t) {
                            if (!t.createtime) return false;
                            return new Date(t.createtime.replace(/-/g, '/')).getTime() <= endMs;
                        });
                    }

                    if (party && party !== 'ALL') {
                        var partyLower = party.toLowerCase();
                        filtered = filtered.filter(function (t) {
                            var resp = String(t.responsibility || '').toLowerCase();
                            if (partyLower === 'others') {
                                return !resp || (resp.indexOf('telkom') === -1 && resp.indexOf('akses') === -1 && resp.indexOf('mandau') === -1 && resp.indexOf('persada') === -1);
                            } else {
                                return resp.indexOf(partyLower) !== -1;
                            }
                        });
                    }

                    // Calculate All-Time Summary Aggregation Stats (Unfiltered)
                    var summary = { total: 0, open: 0, pending: 0, closed: 0, canceled: 0 };
                    tickets.forEach(function (t) {
                        summary.total++;
                        var st = String(t.ticketstatus || '').toLowerCase();
                        var acc = String(t.confirmaccept || '').toLowerCase();
                        if ((st === 'closed' || st === 'completed') && (acc === 'accept' || acc === 'yes')) {
                            summary.closed++;
                        } else if (st === 'canceled' || st === 'cancelled' || st === 'rejected') {
                            summary.canceled++;
                        } else if (st === 'pending' || st === 'in progress') {
                            summary.pending++;
                        } else {
                            summary.open++;
                        }
                    });

                    // Format RunScript SC JSON Response Payload
                    var responsePayload = {
                        result: {
                            success: true,
                            message: "Sandbox CSV data successfully loaded.",
                            applied_filters: {
                                start_date: startDate,
                                end_date: endDate,
                                party: party
                            },
                            summary: summary,
                            data_grid: {
                                start: start,
                                limit: limit,
                                total: filtered.length,
                                rows: filtered.slice(start, start + limit)
                            }
                        }
                    };

                    options.success(responsePayload);
                })
                .catch(function (err) {
                    console.error('[SANDBOX RUNSCRIPT ERROR]', err);
                    if (options.error) options.error(err);
                });
        }
    };
})();
