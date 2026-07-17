function calculateAgingDays(createTimeStr, closeTimeStr, lastUpdateTimeStr, operateTimeStr, ticketstatus) {
    if (!createTimeStr) return 0;
    // Replace '-' with '/' for broad browser support of date parsing
    var start = new Date(createTimeStr.replace(/-/g, '/'));
    var end = new Date();
    
    var statusLower = String(ticketstatus || '').toLowerCase();
    if (statusLower === 'completed' || statusLower === 'closed') {
        var endStr = closeTimeStr || lastUpdateTimeStr || operateTimeStr;
        if (endStr) {
            end = new Date(endStr.replace(/-/g, '/'));
        }
    }
    
    var diffMs = end - start;
    if (isNaN(diffMs) || diffMs < 0) return 0;
    return diffMs / (1000 * 60 * 60 * 24);
}

function loadProblemTickets() {
    var container = document.querySelector('#ticketContainer');
    if (container) {
        container.innerHTML = '';
        var loadingDiv = document.createElement('div');
        loadingDiv.style.color = '#6c757d';
        loadingDiv.style.padding = '12px';
        loadingDiv.textContent = 'Memuat data real dari server...';
        container.appendChild(loadingDiv);
    }

    if (typeof MessageProcessor !== 'undefined') {
        MessageProcessor.process({
            serviceId: '/adc-service/rest/v1/services/dashboard_problem_ticket_test/dashboard_problem_ticket_test/dashboard__problem_ticket',
            data: {
                "start": 0,
                "limit": 5000
            },
            success: function (res) {
                console.log('Response OWS Success:', res);
                parseAndRender(res);
            },
            error: function (err) {
                console.error('Response OWS Error:', err);
                showError('Gagal memuat data: ' + (err.message || 'Error Service'));
            }
        });
    } else {
        showError('MessageProcessor OWS tidak ditemukan di browser context.');
    }
}

function parseAndRender(res) {
    var tickets = [];
    if (res && res.result && res.result._values) {
        tickets = res.result._values;
    } else if (res && res.result && res.result.results) {
        tickets = res.result.results;
    } else if (res && res.results) {
        tickets = res.results;
    } else if (res && res._values) {
        tickets = res._values;
    } else if (res && res.data) {
        tickets = res.data;
    } else if (Array.isArray(res)) {
        tickets = res;
    }
    renderTicketsData(tickets);
}

function renderTicketsData(tickets) {
    var container = document.querySelector('#ticketContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!tickets || tickets.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.style.color = '#6c757d';
        emptyDiv.style.padding = '12px';
        emptyDiv.textContent = 'Tidak ada data tiket ditemukan.';
        container.appendChild(emptyDiv);

        setCardValue('statTotal', 0);
        setCardValue('statOpen', 0);
        setCardValue('statInProgress', 0);
        setCardValue('statClosed', 0);
        
        setCardValue('taOpen', 0); setCardValue('taPending', 0); setCardValue('taClosed', 0);
        setCardValue('mOpen', 0); setCardValue('mPending', 0); setCardValue('mClosed', 0);
        setCardValue('pOpen', 0); setCardValue('pPending', 0); setCardValue('pClosed', 0);
        return;
    }

    var openCount = 0, inProgressCount = 0, closedCount = 0;
    var taOpen = 0, taPending = 0, taClosed = 0;
    var mOpen = 0, mPending = 0, mClosed = 0;
    var pOpen = 0, pPending = 0, pClosed = 0;

    var html = '<table class="custom-noc-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Ticket ID</th>';
    html += '<th>Title / Description</th>';
    html += '<th>Assignee</th>';
    html += '<th>Severity</th>';
    html += '<th>Current Phase</th>';
    html += '<th>Aging</th>';
    html += '<th>Status</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    for (var i = 0; i < tickets.length; i++) {
        var item = tickets[i];
        var status = item.ticketstatus || item.status || item.active_status || 'Open';
        var title = item.title || item.problem_name || item.description || 'Tanpa Judul';
        var id = item.orderid || item.id || item.code || 'TCK';
        var phase = item.operate_phase || item.phase || item.current_phase || '-';
        
        // Calculate aging days dynamically from timestamps if not pre-calculated in DB
        var agingVal = item.aging || item.aging_days || item.days || calculateAgingDays(item.createtime, item.closetime, item.lastupdatetime, item.operate_time, status);

        var partner = 'Telkom Akses';
        var assign = String(item.createptassignto || '').toLowerCase();
        var operator = String(item.currentoperator || '').toLowerCase();
        var originator = String(item.originator || '').toLowerCase();
        var respParty = String(item.problem_responsible_party || item.problemresponsibleparty || '').toLowerCase();
        var tLower = title.toLowerCase();
        var desc = String(item.createptproblemdes || '').toLowerCase();

        if (respParty.indexOf('telkom') !== -1 || respParty.indexOf('akses') !== -1) {
            partner = 'Telkom Akses';
        } else if (respParty.indexOf('mandau') !== -1) {
            partner = 'Mandau';
        } else if (respParty.indexOf('persada') !== -1) {
            partner = 'Persada';
        } else if (respParty.indexOf('ije') !== -1) {
            partner = 'IJE';
        } else if (tLower.indexOf('telkom') !== -1 || tLower.indexOf('akses') !== -1 || desc.indexOf('telkom') !== -1) {
            partner = 'Telkom Akses';
        } else if (tLower.indexOf('mandau') !== -1 || desc.indexOf('mandau') !== -1) {
            partner = 'Mandau';
        } else if (tLower.indexOf('persada') !== -1 || desc.indexOf('persada') !== -1) {
            partner = 'Persada';
        } else if (assign.indexOf('pwx') !== -1 || originator.indexOf('pwx') !== -1 || operator.indexOf('pwx') !== -1) {
            partner = 'Persada';
        } else if (assign.indexOf('pm') !== -1 || operator.indexOf('pm') !== -1) {
            partner = 'Mandau';
        } else {
            var rawAssign = item.createptassignto || item.currentoperator || item.originator || 'Surge';
            partner = rawAssign.replace('user:', '');
        }

        // Map Severity (including OWS createticketlevel UUID checks)
        var sevRaw = String(item.severity || item.createticketlevel || '').toLowerCase();
        var sevLabel = 'Minor';
        var sevClass = 'custom-badge-sev-minor';
        if (sevRaw.indexOf('507') !== -1 || sevRaw.indexOf('emergency') !== -1 || sevRaw === '1') {
            sevLabel = 'Emergency';
            sevClass = 'custom-badge-sev-emergency';
        } else if (sevRaw.indexOf('508') !== -1 || sevRaw.indexOf('critical') !== -1 || sevRaw === '2') {
            sevLabel = 'Critical';
            sevClass = 'custom-badge-sev-critical';
        } else if (sevRaw.indexOf('50c') !== -1 || sevRaw.indexOf('major') !== -1 || sevRaw === '3') {
            sevLabel = 'Major';
            sevClass = 'custom-badge-sev-major';
        } else if (sevRaw.indexOf('1029') !== -1 || sevRaw.indexOf('minor') !== -1 || sevRaw === '4') {
            sevLabel = 'Minor';
            sevClass = 'custom-badge-sev-minor';
        }

        // Map Status
        var statusClass = 'custom-badge-open';
        var statusLower = String(status).toLowerCase();
        if (statusLower === 'running' || statusLower === 'open' || statusLower === 'true' || statusLower === '1') {
            statusClass = 'custom-badge-open';
            openCount++;
            if (partner === 'Telkom Akses') taOpen++;
            else if (partner === 'Mandau') mOpen++;
            else if (partner === 'Persada') pOpen++;
        } else if (statusLower === 'in progress' || statusLower === 'pending') {
            statusClass = 'custom-badge-pending';
            inProgressCount++;
            if (partner === 'Telkom Akses') taPending++;
            else if (partner === 'Mandau') mPending++;
            else if (partner === 'Persada') pPending++;
        } else if (statusLower === 'closed' || statusLower === 'completed' || statusLower === 'false' || statusLower === '0') {
            statusClass = 'custom-badge-closed';
            closedCount++;
            if (partner === 'Telkom Akses') taClosed++;
            else if (partner === 'Mandau') mClosed++;
            else if (partner === 'Persada') pClosed++;
        }

        html += '<tr>';
        html += '<td style="font-family: monospace; font-weight: bold; color: #58a6ff;">' + id + '</td>';
        html += '<td style="text-align: left; font-weight: 500;">' + title + '</td>';
        html += '<td>' + partner + '</td>';
        html += '<td><span class="custom-badge-severity ' + sevClass + '">' + sevLabel + '</span></td>';
        html += '<td>' + phase + '</td>';
        html += '<td style="font-weight: 600;">' + parseFloat(agingVal).toFixed(1) + ' Days</td>';
        html += '<td><span class="custom-badge-status ' + statusClass + '">' + status + '</span></td>';
        html += '</tr>';
    }

    html += '</tbody>';
    html += '</table>';
    container.innerHTML = html;

    setCardValue('statTotal', tickets.length);
    setCardValue('statOpen', openCount);
    setCardValue('statInProgress', inProgressCount);
    setCardValue('statClosed', closedCount);

    setCardValue('taOpen', taOpen);
    setCardValue('taPending', taPending);
    setCardValue('taClosed', taClosed);

    setCardValue('mOpen', mOpen);
    setCardValue('mPending', mPending);
    setCardValue('mClosed', mClosed);

    setCardValue('pOpen', pOpen);
    setCardValue('pPending', pPending);
    setCardValue('pClosed', pClosed);

    // Render the Severity Overview charts and tables
    renderSeverityDashboard(tickets);

    // Render the Phase Status tables
    renderPhaseDashboard(tickets);

    // Render Weekly Trend, Top Root Cause, and SLA Compliance panels
    renderTrendsAndCompliance(tickets);
}

function setCardValue(id, val) {
    var el = document.querySelector('#' + id);
    if (el) el.innerText = val;
}

function showError(msg) {
    var container = document.querySelector('#ticketContainer');
    if (container) {
        container.innerHTML = '';
        var errDiv = document.createElement('div');
        errDiv.style.color = '#dc3545';
        errDiv.style.padding = '12px';
        errDiv.textContent = msg;
        container.appendChild(errDiv);
    }
}

function renderSeverityDashboard(tickets) {
    if (typeof echarts === 'undefined') {
        console.warn('ECharts library is not loaded. Retrying in 500ms...');
        setTimeout(function() { renderSeverityDashboard(tickets); }, 500);
        return;
    }

    var categories = ['Emergency', 'Critical', 'Major', 'Minor'];
    var severityData = {};
    
    categories.forEach(function(cat) {
        severityData[cat] = {
            total: 0,
            pending: 0,
            overSla: 0,
            pctOfTotal: '0%',
            rootCauses: [
                { name: 'Fiber Cut', value: 0, pct: '0%', color: '#0f62fe' },
                { name: 'Hardware', value: 0, pct: '0%', color: '#ff7849' },
                { name: 'Power', value: 0, pct: '0%', color: '#24a148' },
                { name: 'Configuration', value: 0, pct: '0%', color: '#8a3ffc' },
                { name: 'Others', value: 0, pct: '0%', color: '#8d8d8d' }
            ]
        };
    });

    if (tickets && tickets.length > 0) {
        tickets.forEach(function(t) {
            var sevRaw = String(t.severity || t.createticketlevel || t.priority || '').toLowerCase();
            var sev = 'Minor';
            if (sevRaw.indexOf('507') !== -1 || sevRaw.indexOf('emergency') !== -1 || sevRaw === '1') sev = 'Emergency';
            else if (sevRaw.indexOf('508') !== -1 || sevRaw.indexOf('critical') !== -1 || sevRaw === '2') sev = 'Critical';
            else if (sevRaw.indexOf('50c') !== -1 || sevRaw.indexOf('major') !== -1 || sevRaw === '3') sev = 'Major';
            else if (sevRaw.indexOf('1029') !== -1 || sevRaw.indexOf('minor') !== -1 || sevRaw === '4') sev = 'Minor';

            severityData[sev].total++;

            var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();
            if (statusRaw === 'pending' || statusRaw === 'in progress' || statusRaw === 'running') {
                severityData[sev].pending++;
            }

            var slaOver = t.over_sla || t.sla_over || t.is_over_sla || (t.slastatus && String(t.slastatus).toLowerCase() === 'over');
            if (slaOver === true || String(slaOver).toLowerCase() === 'true' || String(slaOver) === '1') {
                severityData[sev].overSla++;
            }

            // Map Root Cause
            var rcRaw = String(t.root_cause || t.rootcause || t.cause || '').toLowerCase();
            var rcName = 'Others';
            if (rcRaw.indexOf('fiber') !== -1 || rcRaw.indexOf('cut') !== -1) rcName = 'Fiber Cut';
            else if (rcRaw.indexOf('hardware') !== -1 || rcRaw.indexOf('hw') !== -1) rcName = 'Hardware';
            else if (rcRaw.indexOf('power') !== -1 || rcRaw.indexOf('pwr') !== -1) rcName = 'Power';
            else if (rcRaw.indexOf('config') !== -1) rcName = 'Configuration';
            else if (rcRaw.indexOf('software') !== -1 || rcRaw.indexOf('app') !== -1 || rcRaw.indexOf('sw') !== -1) rcName = 'Software';

            var rcObj = severityData[sev].rootCauses.find(function(rc) { return rc.name === rcName; });
            if (rcObj) {
                rcObj.value++;
            } else {
                var otherObj = severityData[sev].rootCauses.find(function(rc) { return rc.name === 'Others'; });
                if (otherObj) otherObj.value++;
            }
        });

        // Recalculate percentages
        categories.forEach(function(cat) {
            var catTotal = severityData[cat].total;
            severityData[cat].pctOfTotal = tickets.length ? Math.round((catTotal / tickets.length) * 100) + '%' : '0%';
            
            severityData[cat].rootCauses.forEach(function(rc) {
                rc.pct = catTotal ? Math.round((rc.value / catTotal) * 100) + '%' : '0%';
            });
        });
    }

    // Render components for each severity card
    var types = ['Emergency', 'Critical', 'Major', 'Minor'];
    types.forEach(function(type) {
        var data = severityData[type];
        
        // Update stats table
        setCardValue(type.toLowerCase() + 'Total', data.total);
        setCardValue(type.toLowerCase() + 'Pending', data.pending);
        setCardValue(type.toLowerCase() + 'Over', data.overSla);

        // Render legend table
        renderLegend('legend' + type, data.rootCauses);

        // Render ECharts Donut Chart
        renderDonutChart('chart' + type, data, data.total, data.pctOfTotal);
    });
}

function renderLegend(containerId, rootCauses) {
    var legendDom = document.querySelector('#' + containerId);
    if (!legendDom) return;
    
    var html = '<table class="custom-legend-table">';
    html += '<thead><tr style="border-bottom: 1px solid #f0f0f0;"><td style="font-weight:bold;color:#666;font-size:10px;">Root Cause</td><td style="font-weight:bold;color:#666;text-align:right;font-size:10px;">Qty</td><td style="font-weight:bold;color:#666;text-align:right;font-size:10px;">%</td></tr></thead>';
    html += '<tbody>';
    for (var i = 0; i < rootCauses.length; i++) {
        var item = rootCauses[i];
        var dotClass = '';
        if (item.name === 'Fiber Cut') dotClass = 'custom-fiber-cut';
        else if (item.name === 'Hardware') dotClass = 'custom-hardware';
        else if (item.name === 'Power') dotClass = 'custom-power';
        else if (item.name === 'Configuration') dotClass = 'custom-configuration';
        else dotClass = 'custom-others';
        
        html += '<tr>';
        html += '<td><span class="custom-legend-dot ' + dotClass + '"></span>' + item.name + '</td>';
        html += '<td class="custom-qty-col">' + item.value + '</td>';
        html += '<td class="custom-pct-col">' + item.pct + '</td>';
        html += '</tr>';
    }
    html += '</tbody></table>';
    legendDom.innerHTML = html;
}

function renderDonutChart(containerId, data, totalVal, pctVal) {
    var chartDom = document.querySelector('#' + containerId);
    if (!chartDom) return;
    
    var existingInstance = echarts.getInstanceByDom(chartDom);
    if (existingInstance) {
        existingInstance.dispose();
    }
    
    var myChart = echarts.init(chartDom);
    
    var chartData = [];
    var colors = [];
    for (var i = 0; i < data.rootCauses.length; i++) {
        var item = data.rootCauses[i];
        chartData.push({
            value: item.value,
            name: item.name
        });
        colors.push(item.color);
    }
    
    var option = {
        color: colors,
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)',
            confine: true
        },
        series: [
            {
                name: 'Root Cause',
                type: 'pie',
                radius: ['55%', '80%'],
                avoidLabelOverlap: false,
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: false
                    }
                },
                labelLine: {
                    show: false
                },
                data: chartData
            }
        ],
        graphic: [
            {
                type: 'text',
                left: 'center',
                top: '36%',
                style: {
                    text: String(totalVal),
                    textAlign: 'center',
                    fill: '#f0f6fc',
                    fontSize: 16,
                    fontWeight: 'bold'
                }
            },
            {
                type: 'text',
                left: 'center',
                top: '56%',
                style: {
                    text: '(' + pctVal + ')',
                    textAlign: 'center',
                    fill: '#8b949e',
                    fontSize: 9
                }
            }
        ]
    };
    
    myChart.setOption(option);
    
    window.addEventListener('resize', function() {
        myChart.resize();
    });
}

function renderPhaseDashboard(tickets) {
    var phases = [
        '1. Create PT',
        '2. Handle Analyze PT',
        '3. Analyze PT',
        '4. Handle Implement PT',
        '5. Implement PT',
        '6. Confirm PT'
    ];

    var categories = ['Overall', 'TelkomAkses', 'Mandau', 'Persada'];
    var phaseData = {};

    categories.forEach(function(cat) {
        phaseData[cat] = phases.map(function(p) {
            return { phase: p, total: 0, b1: 0, b2: 0, b3: 0, b4: 0, avg: 0, agingSum: 0 };
        });
    });

    if (tickets && tickets.length > 0) {
        tickets.forEach(function(t) {
            var phaseRaw = String(t.operate_phase || t.phase || t.current_phase || t.state || '').toLowerCase();
            var phase = '1. Create PT';
            if (phaseRaw.indexOf('confirm') !== -1) phase = '6. Confirm PT';
            else if (phaseRaw.indexOf('handle analyze') !== -1) phase = '2. Handle Analyze PT';
            else if (phaseRaw.indexOf('analyze') !== -1) phase = '3. Analyze PT';
            else if (phaseRaw.indexOf('handle implement') !== -1) phase = '4. Handle Implement PT';
            else if (phaseRaw.indexOf('implement') !== -1) phase = '5. Implement PT';

            var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();
            var aging = parseFloat(t.aging || t.aging_days || t.days || calculateAgingDays(t.createtime, t.closetime, t.lastupdatetime, t.operate_time, statusRaw));
            
            var partner = 'TelkomAkses';
            var title = String(t.title || t.problem_name || '').toLowerCase();
            var desc = String(t.createptproblemdes || '').toLowerCase();
            var assign = String(t.createptassignto || '').toLowerCase();
            var respParty = String(t.problem_responsible_party || t.problemresponsibleparty || '').toLowerCase();
            
            if (respParty.indexOf('telkom') !== -1 || respParty.indexOf('akses') !== -1) {
                partner = 'TelkomAkses';
            } else if (respParty.indexOf('mandau') !== -1) {
                partner = 'Mandau';
            } else if (respParty.indexOf('persada') !== -1) {
                partner = 'Persada';
            } else if (title.indexOf('mandau') !== -1 || desc.indexOf('mandau') !== -1 || assign.indexOf('pm') !== -1) {
                partner = 'Mandau';
            } else if (title.indexOf('persada') !== -1 || desc.indexOf('persada') !== -1 || assign.indexOf('pwx') !== -1) {
                partner = 'Persada';
            }

            var buck = 'b1';
            if (aging > 21) buck = 'b4';
            else if (aging > 15) buck = 'b3';
            else if (aging > 7) buck = 'b2';

            [partner, 'Overall'].forEach(function(targetCat) {
                var row = phaseData[targetCat].find(function(r) { return r.phase === phase; });
                if (row) {
                    row.total++;
                    row[buck]++;
                    row.agingSum += aging;
                }
            });
        });

        // Calculate averages
        categories.forEach(function(cat) {
            phaseData[cat].forEach(function(row) {
                row.avg = row.total > 0 ? (row.agingSum / row.total) : 0;
            });
        });
    }

    // Render columns
    renderPhaseOverall('tablePhaseOverall', phaseData.Overall);
    renderPhasePartner('tablePhaseTelkom', phaseData.TelkomAkses);
    renderPhasePartner('tablePhaseMandau', phaseData.Mandau);
    renderPhasePartner('tablePhasePersada', phaseData.Persada);
}

function renderPhaseOverall(containerId, phaseRows) {
    var wrapper = document.querySelector('#' + containerId);
    if (!wrapper) return;

    var totalPT = 0;
    var totalB1 = 0, totalB2 = 0, totalB3 = 0, totalB4 = 0;
    var weightedAgingSum = 0;

    var html = '<table class="custom-phase-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Phase</th>';
    html += '<th>Total PT</th>';
    html += '<th style="width: 120px;">Aging Bucket (Days)</th>';
    html += '<th>Avg Aging (Days)</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    phaseRows.forEach(function(row) {
        totalPT += row.total;
        totalB1 += row.b1;
        totalB2 += row.b2;
        totalB3 += row.b3;
        totalB4 += row.b4;
        weightedAgingSum += row.avg * row.total;

        var maxVal = Math.max(1, row.total);
        var w1 = Math.round((row.b1 / maxVal) * 100);
        var w2 = Math.round((row.b2 / maxVal) * 100);
        var w3 = Math.round((row.b3 / maxVal) * 100);
        var w4 = Math.round((row.b4 / maxVal) * 100);

        var diff = 100 - (w1 + w2 + w3 + w4);
        if (diff !== 0 && (w1 || w2 || w3 || w4)) {
            if (w4 > 0) w4 += diff;
            else if (w3 > 0) w3 += diff;
            else if (w2 > 0) w2 += diff;
            else if (w1 > 0) w1 += diff;
        }

        html += '<tr>';
        html += '<td class="custom-phase-name-col">' + row.phase + '</td>';
        html += '<td class="custom-total-val">' + row.total + '</td>';
        html += '<td>';
        html += '  <div class="custom-stacked-bar">';
        if (row.b1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + w1 + '%;">' + row.b1 + '</div>';
        if (row.b2 > 0) html += '    <div class="custom-bar-segment custom-seg-8-15" style="width: ' + w2 + '%;">' + row.b2 + '</div>';
        if (row.b3 > 0) html += '    <div class="custom-bar-segment custom-seg-16-21" style="width: ' + w3 + '%;">' + row.b3 + '</div>';
        if (row.b4 > 0) html += '    <div class="custom-bar-segment custom-seg-sla" style="width: ' + w4 + '%;">' + row.b4 + '</div>';
        html += '  </div>';
        html += '</td>';
        html += '<td class="custom-avg-val">' + parseFloat(row.avg).toFixed(1) + '</td>';
        html += '</tr>';
    });

    var totalAvg = totalPT ? (weightedAgingSum / totalPT).toFixed(1) : '0.0';
    html += '<tr class="custom-total-row">';
    html += '<td style="text-align:left;">TOTAL</td>';
    html += '<td class="custom-total-val">' + totalPT + '</td>';
    html += '<td>';
    html += '  <div class="custom-stacked-bar">';
    var tMax = Math.max(1, totalPT);
    var tw1 = Math.round((totalB1 / tMax) * 100);
    var tw2 = Math.round((totalB2 / tMax) * 100);
    var tw3 = Math.round((totalB3 / tMax) * 100);
    var tw4 = Math.round((totalB4 / tMax) * 100);
    if (totalB1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + tw1 + '%;">' + totalB1 + '</div>';
    if (totalB2 > 0) html += '    <div class="custom-bar-segment custom-seg-8-15" style="width: ' + tw2 + '%;">' + totalB2 + '</div>';
    if (totalB3 > 0) html += '    <div class="custom-bar-segment custom-seg-16-21" style="width: ' + tw3 + '%;">' + totalB3 + '</div>';
    if (totalB4 > 0) html += '    <div class="custom-bar-segment custom-seg-sla" style="width: ' + tw4 + '%;">' + totalB4 + '</div>';
    html += '  </div>';
    html += '</td>';
    html += '<td class="custom-avg-val">' + totalAvg + '</td>';
    html += '</tr>';

    html += '</tbody>';
    html += '</table>';

    wrapper.innerHTML = html;
}

function renderPhasePartner(containerId, phaseRows) {
    var wrapper = document.querySelector('#' + containerId);
    if (!wrapper) return;

    var totalPT = 0;
    var totalB1 = 0, totalB2 = 0, totalB3 = 0, totalB4 = 0;
    var weightedAgingSum = 0;

    var html = '<table class="custom-phase-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Phase</th>';
    html += '<th>0-7</th>';
    html += '<th>8-15</th>';
    html += '<th>16-21</th>';
    html += '<th>&gt; SLA</th>';
    html += '<th>Total PT</th>';
    html += '<th>Avg Aging (Days)</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    phaseRows.forEach(function(row) {
        totalPT += row.total;
        totalB1 += row.b1;
        totalB2 += row.b2;
        totalB3 += row.b3;
        totalB4 += row.b4;
        weightedAgingSum += row.avg * row.total;

        html += '<tr>';
        html += '<td class="custom-phase-name-col">' + row.phase + '</td>';
        html += '<td class="custom-heatmap-cell custom-heatmap-0-7">' + (row.b1 || '-') + '</td>';
        html += '<td class="custom-heatmap-cell custom-heatmap-8-15">' + (row.b2 || '-') + '</td>';
        html += '<td class="custom-heatmap-cell custom-heatmap-16-21">' + (row.b3 || '-') + '</td>';
        html += '<td class="custom-heatmap-cell custom-heatmap-sla">' + (row.b4 || '-') + '</td>';
        html += '<td class="custom-total-val">' + row.total + '</td>';
        html += '<td class="custom-avg-val">' + parseFloat(row.avg).toFixed(1) + '</td>';
        html += '</tr>';
    });

    var totalAvg = totalPT ? (weightedAgingSum / totalPT).toFixed(1) : '0.0';
    html += '<tr class="custom-total-row">';
    html += '<td style="text-align:left;">TOTAL</td>';
    html += '<td class="custom-heatmap-cell custom-heatmap-0-7">' + (totalB1 || '-') + '</td>';
    html += '<td class="custom-heatmap-cell custom-heatmap-8-15">' + (totalB2 || '-') + '</td>';
    html += '<td class="custom-heatmap-cell custom-heatmap-16-21">' + (totalB3 || '-') + '</td>';
    html += '<td class="custom-heatmap-cell custom-heatmap-sla">' + (totalB4 || '-') + '</td>';
    html += '<td class="custom-total-val">' + totalPT + '</td>';
    html += '<td class="custom-avg-val">' + totalAvg + '</td>';
    html += '</tr>';

    html += '</tbody>';
    html += '</table>';

    wrapper.innerHTML = html;
}

function renderTrendsAndCompliance(tickets) {
    if (typeof echarts === 'undefined') {
        console.warn('ECharts not available yet. Retrying in 500ms...');
        setTimeout(function() { renderTrendsAndCompliance(tickets); }, 500);
        return;
    }

    var rootCauseData = [
        { name: 'Fiber Cut', value: 0, color: '#58a6ff' },
        { name: 'Hardware', value: 0, color: '#f0883e' },
        { name: 'Power', value: 0, color: '#3fb950' },
        { name: 'Configuration', value: 0, color: '#bc8cff' },
        { name: 'Software', value: 0, color: '#ff7b72' },
        { name: 'Others', value: 0, color: '#8b949e' }
    ];

    var complianceData = [
        { party: 'Persada', total: 0, within: 0, over: 0, ach: '0.0%' },
        { party: 'Telkom Akses', total: 0, within: 0, over: 0, ach: '0.0%' },
        { party: 'Mandau', total: 0, within: 0, over: 0, ach: '0.0%' },
        { party: 'IJE', total: 0, within: 0, over: 0, ach: '0.0%' },
        { party: 'Surge', total: 0, within: 0, over: 0, ach: '0.0%' }
    ];

    var weeklyMap = {};

    function getWeekLabel(dateStr) {
        if (!dateStr) return 'W28';
        var parts = dateStr.split(' ')[0].split('-');
        if (parts.length < 3) return 'W28';
        var yr = parseInt(parts[0]);
        var mo = parseInt(parts[1]) - 1;
        var dy = parseInt(parts[2]);
        var d = new Date(yr, mo, dy);
        var onejan = new Date(yr, 0, 1);
        var weekNum = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        return 'W' + weekNum;
    }

    if (tickets && tickets.length > 0) {
        tickets.forEach(function(t) {
            // 1. Root Cause
            var rcRaw = String(t.root_cause || t.rootcause || t.cause || '').toLowerCase();
            var rcName = 'Others';
            if (rcRaw.indexOf('fiber') !== -1 || rcRaw.indexOf('cut') !== -1) rcName = 'Fiber Cut';
            else if (rcRaw.indexOf('hardware') !== -1 || rcRaw.indexOf('hw') !== -1) rcName = 'Hardware';
            else if (rcRaw.indexOf('power') !== -1 || rcRaw.indexOf('pwr') !== -1) rcName = 'Power';
            else if (rcRaw.indexOf('config') !== -1) rcName = 'Configuration';
            else if (rcRaw.indexOf('software') !== -1 || rcRaw.indexOf('app') !== -1 || rcRaw.indexOf('sw') !== -1) rcName = 'Software';

            var rcObj = rootCauseData.find(function(rc) { return rc.name === rcName; });
            if (rcObj) rcObj.value++;

            // 2. SLA Compliance
            var partner = 'Surge';
            var title = String(t.title || t.problem_name || '').toLowerCase();
            var desc = String(t.createptproblemdes || '').toLowerCase();
            var assign = String(t.createptassignto || '').toLowerCase();
            
            if (assign.indexOf('persada') !== -1 || title.indexOf('persada') !== -1 || desc.indexOf('persada') !== -1) partner = 'Persada';
            else if (assign.indexOf('telkom') !== -1 || assign.indexOf('akses') !== -1 || title.indexOf('akses') !== -1 || desc.indexOf('telkom') !== -1) partner = 'Telkom Akses';
            else if (assign.indexOf('mandau') !== -1 || assign.indexOf('pm') !== -1 || title.indexOf('mandau') !== -1 || desc.indexOf('mandau') !== -1) partner = 'Mandau';
            else if (assign.indexOf('ije') !== -1 || title.indexOf('ije') !== -1) partner = 'IJE';

            var compObj = complianceData.find(function(c) { return c.party === partner; });
            if (compObj) {
                compObj.total++;
                var isOver = t.over_sla || t.sla_over || t.is_over_sla;
                var overVal = (isOver === true || String(isOver).toLowerCase() === 'true' || String(isOver) === '1');
                if (overVal) {
                    compObj.over++;
                } else {
                    compObj.within++;
                }
            }

            // 3. Weekly Trend
            var dateVal = t.createtime || t.createfirstoccurtime || t.operate_time;
            var wLabel = getWeekLabel(dateVal);
            if (!weeklyMap[wLabel]) {
                weeklyMap[wLabel] = { newPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0 };
            }
            var weekRow = weeklyMap[wLabel];
            weekRow.total++;
            weekRow.newPT++;
            
            var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();
            if (statusRaw === 'closed' || statusRaw === 'completed' || statusRaw === 'false' || statusRaw === '0') {
                weekRow.closedPT++;
            } else {
                weekRow.pendingPT++;
            }

            var isOverVal = (t.over_sla === true || String(t.over_sla).toLowerCase() === 'true' || String(t.over_sla) === '1');
            if (isOverVal) {
                weekRow.overSla++;
            } else {
                weekRow.withinSla++;
            }
        });

        complianceData.forEach(function(c) {
            c.ach = c.total ? ((c.within / c.total) * 100).toFixed(1) + '%' : '0.0%';
        });
    }

    var weeksList = Object.keys(weeklyMap).sort();
    var trendData = {
        weeks: weeksList,
        newPT: [],
        closedPT: [],
        pendingPT: [],
        overSla: [],
        slaAchievement: []
    };

    weeksList.forEach(function(w) {
        var row = weeklyMap[w];
        trendData.newPT.push(row.newPT);
        trendData.closedPT.push(row.closedPT);
        trendData.pendingPT.push(row.pendingPT);
        trendData.overSla.push(row.overSla);
        trendData.slaAchievement.push(row.total ? parseFloat(((row.withinSla / row.total) * 100).toFixed(1)) : 0);
    });

    renderSlaComplianceTable('tableSlaCompliance', complianceData);

    drawWeeklyTrendChart('chartWeeklyTrend', trendData);
    drawTopRootCauseChart('chartTopRootCause', rootCauseData);
}

function drawWeeklyTrendChart(containerId, data) {
    var chartDom = document.querySelector('#' + containerId);
    if (!chartDom) return;

    var existingInstance = echarts.getInstanceByDom(chartDom);
    if (existingInstance) {
        existingInstance.dispose();
    }

    var myChart = echarts.init(chartDom);

    var option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        legend: {
            data: ['New PT', 'Closed PT', 'Pending PT', 'Over SLA', 'SLA Achievement (%)'],
            textStyle: {
                color: '#c9d1d9',
                fontSize: 10
            },
            bottom: '0%'
        },
        grid: {
            top: '12%',
            left: '3%',
            right: '4%',
            bottom: '12%',
            containLabel: true
        },
        xAxis: [
            {
                type: 'category',
                data: data.weeks,
                axisLine: { lineStyle: { color: '#30363d' } },
                axisLabel: { color: '#8b949e' }
            }
        ],
        yAxis: [
            {
                type: 'value',
                name: 'PT (Total)',
                nameTextStyle: { color: '#8b949e' },
                axisLine: { lineStyle: { color: '#30363d' } },
                axisLabel: { color: '#8b949e' },
                splitLine: { lineStyle: { color: '#30363d' } }
            },
            {
                type: 'value',
                name: 'SLA %',
                nameTextStyle: { color: '#8b949e' },
                min: 0,
                max: 100,
                axisLine: { lineStyle: { color: '#30363d' } },
                axisLabel: {
                    color: '#8b949e',
                    formatter: '{value}%'
                },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: 'New PT',
                type: 'bar',
                data: data.newPT,
                itemStyle: { color: '#58a6ff' },
                barWidth: '20%'
            },
            {
                name: 'Closed PT',
                type: 'bar',
                data: data.closedPT,
                itemStyle: { color: '#3fb950' },
                barWidth: '20%'
            },
            {
                name: 'Pending PT',
                type: 'line',
                data: data.pendingPT,
                itemStyle: { color: '#f0883e' },
                lineStyle: { width: 3 },
                label: {
                    show: true,
                    position: 'top',
                    color: '#f0883e',
                    fontSize: 10
                }
            },
            {
                name: 'Over SLA',
                type: 'line',
                data: data.overSla,
                itemStyle: { color: '#ff7b72' },
                lineStyle: { width: 2 },
                label: {
                    show: true,
                    position: 'top',
                    color: '#ff7b72',
                    fontSize: 10
                }
            },
            {
                name: 'SLA Achievement (%)',
                type: 'line',
                yAxisIndex: 1,
                data: data.slaAchievement,
                itemStyle: { color: '#bc8cff' },
                lineStyle: { type: 'dashed', width: 2 },
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}%',
                    color: '#bc8cff',
                    fontSize: 10
                }
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener('resize', function() { myChart.resize(); });
}

function drawTopRootCauseChart(containerId, data) {
    var chartDom = document.querySelector('#' + containerId);
    if (!chartDom) return;

    var existingInstance = echarts.getInstanceByDom(chartDom);
    if (existingInstance) {
        existingInstance.dispose();
    }

    var myChart = echarts.init(chartDom);

    var sortedData = data.slice().reverse();
    var yAxisData = [];
    var seriesData = [];
    var colors = [];

    sortedData.forEach(function(item) {
        yAxisData.push(item.name);
        seriesData.push(item.value);
        colors.push(item.color);
    });

    var totalSum = seriesData.reduce(function(a, b) { return a + b; }, 0);

    var option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: {
            top: '5%',
            left: '3%',
            right: '25%',
            bottom: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#30363d' } },
            axisLabel: { color: '#8b949e' },
            splitLine: { lineStyle: { color: '#30363d' } }
        },
        yAxis: {
            type: 'category',
            data: yAxisData,
            axisLine: { lineStyle: { color: '#30363d' } },
            axisLabel: { color: '#c9d1d9', fontSize: 10 }
        },
        series: [
            {
                type: 'bar',
                data: seriesData,
                itemStyle: {
                    color: function(params) {
                        return colors[params.dataIndex];
                    },
                    borderRadius: [0, 4, 4, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: function(params) {
                        var val = params.value;
                        var pct = totalSum ? Math.round((val / totalSum) * 1000) / 10 + '%' : '0%';
                        return val + ' (' + pct + ')';
                    },
                    color: '#c9d1d9',
                    fontSize: 9
                }
            }
        ]
    };

    myChart.setOption(option);
    window.addEventListener('resize', function() { myChart.resize(); });
}

function renderSlaComplianceTable(containerId, rows) {
    var wrapper = document.querySelector('#' + containerId);
    if (!wrapper) return;

    var totalPT = 0;
    var totalWithin = 0;
    var totalOver = 0;

    var html = '<table class="custom-compliance-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Party</th>';
    html += '<th>Total PT</th>';
    html += '<th>Within SLA</th>';
    html += '<th>Over SLA</th>';
    html += '<th>SLA Achievement</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    rows.forEach(function(row) {
        totalPT += row.total;
        totalWithin += row.within;
        totalOver += row.over;

        var achPct = parseFloat(row.ach);
        var achClass = 'custom-ach-success';
        if (achPct < 90) achClass = 'custom-ach-danger';
        else if (achPct < 95) achClass = 'custom-ach-warning';

        html += '<tr>';
        html += '<td class="custom-party-name">' + row.party + '</td>';
        html += '<td>' + row.total + '</td>';
        html += '<td>' + row.within + '</td>';
        html += '<td style="color:#ff7b72; font-weight:700;">' + row.over + '</td>';
        html += '<td class="' + achClass + '">' + row.ach + '</td>';
        html += '</tr>';
    });

    var totalAch = totalPT ? ((totalWithin / totalPT) * 100).toFixed(1) + '%' : '0.0%';
    var totalAchPct = parseFloat(totalAch);
    var totalAchClass = 'custom-ach-success';
    if (totalAchPct < 90) totalAchClass = 'custom-ach-danger';
    else if (totalAchPct < 95) totalAchClass = 'custom-ach-warning';

    html += '<tr class="custom-total-row">';
    html += '<td style="text-align:left;">TOTAL</td>';
    html += '<td>' + totalPT + '</td>';
    html += '<td>' + totalWithin + '</td>';
    html += '<td style="color:#ff7b72; font-weight:700;">' + totalOver + '</td>';
    html += '<td class="' + totalAchClass + '">' + totalAch + '</td>';
    html += '</tr>';

    html += '</tbody></table>';
    wrapper.innerHTML = html;
}

loadProblemTickets();