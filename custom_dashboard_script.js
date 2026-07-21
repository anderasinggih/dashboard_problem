function getTicketPartner(item) {
    if (!item) return 'Blanks';
    
    var rawParty = item.problem_responsible_party || item.problemresponsibleparty || item['Problem Responsible Party'] || '';
    rawParty = rawParty.trim();
    
    // Fallback jika kolom utama kosong (OWS API response tidak populate)
    if (!rawParty) {
        var title = String(item.title || item.problem_name || item.description || '').toLowerCase();
        var desc = String(item.createptproblemdes || '').toLowerCase();
        var assign = String(item.createptassignto || '').toLowerCase();
        var operator = String(item.currentoperator || '').toLowerCase();
        var originator = String(item.originator || '').toLowerCase();
        
        if (title.indexOf('telkom') !== -1 || title.indexOf('akses') !== -1 || desc.indexOf('telkom') !== -1) {
            return 'Telkom Akses';
        } else if (title.indexOf('mandau') !== -1 || desc.indexOf('mandau') !== -1 || assign.indexOf('pm') !== -1 || operator.indexOf('pm') !== -1) {
            return 'Mandau';
        } else if (title.indexOf('persada') !== -1 || desc.indexOf('persada') !== -1 || assign.indexOf('pwx') !== -1 || originator.indexOf('pwx') !== -1 || operator.indexOf('pwx') !== -1) {
            return 'Persada';
        } else if (title.indexOf('ije') !== -1 || assign.indexOf('ije') !== -1) {
            return 'IJE';
        }
        return 'Blanks';
    }
    
    var lower = rawParty.toLowerCase();
    if (lower.indexOf('telkom') !== -1 || lower.indexOf('akses') !== -1) {
        return 'Telkom Akses';
    } else if (lower.indexOf('mandau') !== -1) {
        return 'Mandau';
    } else if (lower.indexOf('persada') !== -1) {
        return 'Persada';
    } else if (lower.indexOf('famika') !== -1) {
        return 'Famika';
    } else if (lower.indexOf('fiberhome') !== -1) {
        return 'Fiberhome';
    } else if (lower.indexOf('huawei') !== -1) {
        return 'Huawei';
    } else if (lower.indexOf('kopindosat') !== -1) {
        return 'Kopindosat';
    } else if (lower.indexOf('nokia') !== -1) {
        return 'Nokia';
    } else {
        return 'Others';
    }
}

function calculateAgingDays(createTimeStr, closeTimeStr, lastUpdateTimeStr, operateTimeStr, ticketstatus) {
    if (!createTimeStr || typeof createTimeStr !== 'string') return 0;
    // Replace '-' with '/' for broad browser support of date parsing
    var start = new Date(createTimeStr.replace(/-/g, '/'));
    var end = new Date();

    var statusLower = String(ticketstatus || '').toLowerCase();
    if (statusLower === 'completed' || statusLower === 'closed') {
        var endStr = closeTimeStr || lastUpdateTimeStr || operateTimeStr;
        if (endStr && typeof endStr === 'string') {
            end = new Date(endStr.replace(/-/g, '/'));
        }
    }

    var diffMs = end - start;
    if (isNaN(diffMs) || diffMs < 0) return 0;
    return diffMs / (1000 * 60 * 60 * 24);
}

function loadProblemTickets(startDate, endDate, party) {
    var container = document.querySelector('#ticketContainer');
    if (container) {
        container.innerHTML = '';
        var loadingDiv = document.createElement('div');
        loadingDiv.style.color = '#6c757d';
        loadingDiv.style.padding = '12px';
        loadingDiv.textContent = 'Memuat data real dari server...';
        container.appendChild(loadingDiv);
    }

    var requestData = {
        "start": 0,
        "limit": 1000,
        "startDate": startDate || "2000-01-01 00:00:00",
        "endDate": endDate || "2099-12-31 23:59:59",
        "party": party || "ALL"
    };

    console.log('[DEBUG] Calling OWS Service with payload:', JSON.stringify(requestData));

    if (typeof MessageProcessor !== 'undefined') {
        MessageProcessor.process({
            serviceId: '/adc-service/rest/v1/services/dashboard_problem_ticket_test/dashboard_problem_ticket_test/dashboard__problem_ticket',
            data: requestData,
            success: function (res) {
                console.log('Response OWS Success:', res);
                parseAndRender(res, !!(startDate || endDate || (party && party !== 'ALL')), startDate, endDate, party);
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

function parseAndRender(res, isFiltered, startDate, endDate, party) {
    try {
        var rawTickets = [];
        if (res && res.result && res.result._values) {
            rawTickets = res.result._values;
        } else if (res && res.result && res.result.results) {
            rawTickets = res.result.results;
        } else if (res && res.results) {
            rawTickets = res.results;
        } else if (res && res._values) {
            rawTickets = res._values;
        } else if (res && res.data) {
            rawTickets = res.data;
        } else if (Array.isArray(res)) {
            rawTickets = res;
        }
        //filterr
        var dateFilteredTickets = rawTickets;
        if (rawTickets && rawTickets.length > 0) {
            // Client-side date filter fallback to ensure dashboard updates correctly even if OWS backend has type mismatch issues
            if (startDate || endDate) {
                var startMs = startDate ? new Date(startDate.replace(/-/g, '/')).getTime() : 0;
                var endMs = endDate ? new Date(endDate.replace(/-/g, '/')).getTime() : Infinity;
                dateFilteredTickets = rawTickets.filter(function (t) {
                    if (!t.createtime) return false;
                    var tMs = new Date(t.createtime.replace(/-/g, '/')).getTime();
                    return tMs >= startMs && tMs <= endMs;
                });
            }
        }

        var fullyFilteredTickets = dateFilteredTickets;
        if (dateFilteredTickets && dateFilteredTickets.length > 0) {
            // Client-side party filter fallback
            if (party && party !== 'ALL') {
                fullyFilteredTickets = dateFilteredTickets.filter(function (t) {
                    var ticketPartner = getTicketPartner(t);
                    return ticketPartner.toLowerCase() === party.toLowerCase();
                });
            }
        }

        console.log('[DEBUG] OWS Response parsed. Raw Count:', rawTickets.length, 'DateFiltered:', dateFilteredTickets.length, 'FullyFiltered:', fullyFilteredTickets.length);

        // Save dataset and update cards ONLY on all-time load
        if (!isFiltered) {
            window.allTicketsData = rawTickets;
            updateAllTimeCards(rawTickets);
        }

        // Render list & charts
        renderTicketsData(fullyFilteredTickets, dateFilteredTickets);
        updatePanelFilterBadges(party);
    } catch (e) {
        alert('[parseAndRender ERROR]: ' + e.message + '\nStack: ' + e.stack);
        console.error('[CRITICAL] parseAndRender crashed:', e);
    }
}

function updatePanelFilterBadges(party) {
    var headers = document.querySelectorAll('.custom-panel-header span');
    for (var i = 0; i < headers.length; i++) {
        var el = headers[i];
        var text = el.innerText || el.textContent || '';

        var isTarget = text.indexOf('1. SEVERITY OVERVIEW') !== -1 ||
            text.indexOf('3. WEEKLY TREND') !== -1 ||
            text.indexOf('4. TOP ROOT CAUSE') !== -1 ||
            text.indexOf('6. PROBLEM TICKET LIST') !== -1;

        if (isTarget) {
            var parent = el.parentNode;
            var oldBadge = parent.querySelector('.custom-filter-header-badge');
            if (oldBadge) {
                parent.removeChild(oldBadge);
            }

            if (party && party !== 'ALL') {
                var badge = document.createElement('span');
                badge.className = 'custom-filter-header-badge';
                badge.innerText = party;
                badge.style.display = 'inline-block';
                badge.style.marginLeft = '10px';
                badge.style.padding = '2px 8px';
                badge.style.fontSize = '11px';
                badge.style.fontWeight = '600';
                badge.style.borderRadius = '4px';
                badge.style.backgroundColor = 'rgba(88, 166, 255, 0.15)';
                badge.style.color = '#58a6ff';
                badge.style.border = '1px solid rgba(88, 166, 255, 0.3)';
                badge.style.verticalAlign = 'middle';
                parent.appendChild(badge);
            }
        }
    }
}

function updateAllTimeCards(tickets) {
    if (!tickets || tickets.length === 0) {
        setCardValue('statTotal', 0);
        setCardValue('statOpen', 0);
        setCardValue('statInProgress', 0);
        setCardValue('statClosed', 0);
        setCardValue('taOpen', 0); setCardValue('taPending', 0); setCardValue('taClosed', 0);
        setCardValue('mOpen', 0); setCardValue('mPending', 0); setCardValue('mClosed', 0);
        setCardValue('pOpen', 0); setCardValue('pPending', 0); setCardValue('pClosed', 0);
        setCardValue('othOpen', 0); setCardValue('othPending', 0); setCardValue('othClosed', 0);
        return;
    }

    var openCount = 0, inProgressCount = 0, closedCount = 0;
    var taOpen = 0, taPending = 0, taClosed = 0;
    var mOpen = 0, mPending = 0, mClosed = 0;
    var pOpen = 0, pPending = 0, pClosed = 0;
    var othOpen = 0, othPending = 0, othClosed = 0;

    for (var i = 0; i < tickets.length; i++) {
        var item = tickets[i];
        var statusLower = String(item.ticketstatus || item.status || '').toLowerCase();

        var partner = getTicketPartner(item);

        if (statusLower === 'running' || statusLower === 'open' || statusLower === 'true' || statusLower === '1') {
            openCount++;
            if (partner === 'Telkom Akses') taOpen++;
            else if (partner === 'Mandau') mOpen++;
            else if (partner === 'Persada') pOpen++;
            else othOpen++;
        } else if (statusLower === 'in progress' || statusLower === 'pending') {
            inProgressCount++;
            if (partner === 'Telkom Akses') taPending++;
            else if (partner === 'Mandau') mPending++;
            else if (partner === 'Persada') pPending++;
            else othPending++;
        } else if (statusLower === 'closed' || statusLower === 'completed' || statusLower === 'false' || statusLower === '0') {
            closedCount++;
            if (partner === 'Telkom Akses') taClosed++;
            else if (partner === 'Mandau') mClosed++;
            else if (partner === 'Persada') pClosed++;
            else othClosed++;
        }
    }

    setCardValue('statTotal', tickets.length);
    setCardValue('statOpen', openCount);
    setCardValue('statInProgress', inProgressCount);
    setCardValue('statClosed', closedCount);
    setCardValue('taOpen', taOpen); setCardValue('taPending', taPending); setCardValue('taClosed', taClosed);
    setCardValue('mOpen', mOpen); setCardValue('mPending', mPending); setCardValue('mClosed', mClosed);
    setCardValue('pOpen', pOpen); setCardValue('pPending', pPending); setCardValue('pClosed', pClosed);
    setCardValue('othOpen', othOpen); setCardValue('othPending', othPending); setCardValue('othClosed', othClosed);
}

// Global pagination state
window.ticketsPagination = {
    tickets: [],
    currentPage: 1,
    pageSize: 10
};

function renderTicketsData(tickets, dateFilteredTickets) {
    // Cache tickets and reset page index
    window.ticketsPagination.tickets = tickets || [];
    window.ticketsPagination.currentPage = 1;

    // Render current active page in list table
    renderCurrentTicketsPage();

    // Render the Severity Overview charts and tables (Filtered by Date + Party)
    renderSeverityDashboard(tickets);

    // Render the Phase Status tables (Filtered by Date ONLY)
    renderPhaseDashboard(dateFilteredTickets || window.allTicketsData || tickets);

    // Render Weekly Trend (fully filtered), Top Root Cause (fully filtered), and SLA Compliance (date filtered only)
    renderTrendsAndCompliance(tickets, tickets, dateFilteredTickets || window.allTicketsData || tickets);
}

function renderCurrentTicketsPage() {
    var container = document.querySelector('#ticketContainer');
    if (!container) return;

    var pag = window.ticketsPagination;
    var tickets = pag.tickets || [];

    if (tickets.length === 0) {
        container.innerHTML = '<div style="color: #6c757d; padding: 12px;">No tickets found for the selected date range.</div>';
        return;
    }

    var startIdx = (pag.currentPage - 1) * pag.pageSize;
    var endIdx = Math.min(startIdx + pag.pageSize, tickets.length);
    var pageTickets = tickets.slice(startIdx, endIdx);

    var html = '<table class="custom-noc-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="width: 50px; text-align: center;">No.</th>';
    html += '<th>Ticket ID</th>';
    html += '<th>Title / Description</th>';
    html += '<th>Assignee</th>';
    html += '<th>Severity</th>';
    html += '<th>Root Cause</th>';
    html += '<th>Current Phase</th>';
    html += '<th>Aging</th>';
    html += '<th>Status</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    for (var i = 0; i < pageTickets.length; i++) {
        var item = pageTickets[i];
        var status = item.ticketstatus || item.status || item.active_status || 'Open';
        var title = item.title || item.problem_name || item.description || 'Tanpa Judul';
        var id = item.orderid || item.id || item.code || 'TCK';
        var phase = item.operate_phase || item.phase || item.current_phase || '-';

        // Calculate aging days dynamically from timestamps if not pre-calculated in DB
        var agingVal = item.aging || item.aging_days || item.days || calculateAgingDays(item.createtime, item.closetime, item.lastupdatetime, item.operate_time, status);

        var partner = getTicketPartner(item);

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
        } else if (statusLower === 'in progress' || statusLower === 'pending') {
            statusClass = 'custom-badge-pending';
        } else if (statusLower === 'closed' || statusLower === 'completed' || statusLower === 'false' || statusLower === '0') {
            statusClass = 'custom-badge-closed';
        }

        var displayNo = startIdx + i + 1;
        var rc = item.root_cause || item.rootcause || item.cause || '-';
        html += '<tr onclick="showTicketDetailModal(\'' + id + '\')">';
        html += '<td style="text-align: center; color: #8b949e; font-weight: 600;">' + displayNo + '</td>';
        html += '<td style="font-family: monospace; font-weight: bold; color: #58a6ff;">' + id + '</td>';
        html += '<td style="text-align: left; font-weight: 500;">' + title + '</td>';
        html += '<td>' + partner + '</td>';
        html += '<td><span class="custom-badge-severity ' + sevClass + '">' + sevLabel + '</span></td>';
        html += '<td style="font-weight: 600; text-transform: uppercase;">' + rc + '</td>';
        html += '<td>' + phase + '</td>';
        html += '<td style="font-weight: 600;">' + parseFloat(agingVal).toFixed(1) + ' Days</td>';
        html += '<td><span class="custom-badge-status ' + statusClass + '">' + status + '</span></td>';
        html += '</tr>';
    }

    html += '</tbody>';
    html += '</table>';

    // Render Pagination Control UI below list table
    var totalPages = Math.ceil(tickets.length / pag.pageSize);

    var paginationHtml = '<div class="custom-pagination-wrapper">';
    paginationHtml += '  <span class="custom-pagination-total">Total ' + tickets.length + '</span>';

    // Page Size Select
    paginationHtml += '  <select onchange="changeTicketsPageSize(parseInt(this.value))" class="custom-pagesize-select">';
    [10, 20, 50, 100].forEach(function (size) {
        var selected = pag.pageSize === size ? 'selected' : '';
        paginationHtml += '    <option value="' + size + '" ' + selected + '>' + size + '/page</option>';
    });
    paginationHtml += '  </select>';

    // Prev Button (<)
    var prevDisabled = pag.currentPage === 1 ? 'disabled' : '';
    paginationHtml += '  <button onclick="prevTicketsPage()" class="custom-page-num-btn ' + prevDisabled + '" ' + prevDisabled + '>&lt;</button>';

    // Page Numbers with Ellipsis
    var pageNumbers = getPageNumbers(pag.currentPage, totalPages);
    pageNumbers.forEach(function (p) {
        if (p === '...') {
            paginationHtml += '  <span class="custom-pagination-ellipsis">...</span>';
        } else {
            var activeClass = pag.currentPage === p ? 'active' : '';
            paginationHtml += '  <button onclick="gotoTicketsPage(' + p + ')" class="custom-page-num-btn ' + activeClass + '">' + p + '</button>';
        }
    });

    // Next Button (>)
    var nextDisabled = pag.currentPage === totalPages ? 'disabled' : '';
    paginationHtml += '  <button onclick="nextTicketsPage()" class="custom-page-num-btn ' + nextDisabled + '" ' + nextDisabled + '>&gt;</button>';

    // Go to input
    paginationHtml += '  <div class="custom-page-jump-wrapper">';
    paginationHtml += '    <span>Go to</span>';
    paginationHtml += '    <input type="number" min="1" max="' + totalPages + '" value="' + pag.currentPage + '" onkeydown="if(event.key===\'Enter\') gotoTicketsPage(parseInt(this.value))" class="custom-page-jump-input">';
    paginationHtml += '  </div>';

    paginationHtml += '</div>';

    html += paginationHtml;
    container.innerHTML = html;
}

function getPageNumbers(current, total) {
    var pages = [];
    if (total <= 7) {
        for (var i = 1; i <= total; i++) pages.push(i);
    } else {
        if (current <= 4) {
            pages = [1, 2, 3, 4, 5, '...', total];
        } else if (current >= total - 3) {
            pages = [1, '...', total - 4, total - 3, total - 2, total - 1, total];
        } else {
            pages = [1, '...', current - 1, current, current + 1, '...', total];
        }
    }
    return pages;
}

function prevTicketsPage() {
    if (window.ticketsPagination.currentPage > 1) {
        window.ticketsPagination.currentPage--;
        renderCurrentTicketsPage();
    }
}

function nextTicketsPage() {
    var totalPages = Math.ceil(window.ticketsPagination.tickets.length / window.ticketsPagination.pageSize);
    if (window.ticketsPagination.currentPage < totalPages) {
        window.ticketsPagination.currentPage++;
        renderCurrentTicketsPage();
    }
}

function gotoTicketsPage(page) {
    var totalPages = Math.ceil(window.ticketsPagination.tickets.length / window.ticketsPagination.pageSize);
    if (page >= 1 && page <= totalPages) {
        window.ticketsPagination.currentPage = page;
        renderCurrentTicketsPage();
    }
}

function changeTicketsPageSize(size) {
    window.ticketsPagination.pageSize = size;
    window.ticketsPagination.currentPage = 1; // Reset to page 1
    renderCurrentTicketsPage();
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
        setTimeout(function () { renderSeverityDashboard(tickets); }, 500);
        return;
    }

    var categories = ['Emergency', 'Critical', 'Major', 'Minor'];
    var severityData = {};

    categories.forEach(function (cat) {
        severityData[cat] = {
            total: 0,
            pending: 0,
            overSla: 0,
            pctOfTotal: '0%',
            rootCauses: [
                { name: 'Environment', value: 0, pct: '0%', color: '#8a3ffc' },
                { name: 'Transmission', value: 0, pct: '0%', color: '#0f62fe' },
                { name: 'Power', value: 0, pct: '0%', color: '#24a148' },
                { name: 'Hardware', value: 0, pct: '0%', color: '#ff7849' },
                { name: 'Others', value: 0, pct: '0%', color: '#8d8d8d' }
            ]
        };
    });

    if (tickets && tickets.length > 0) {
        tickets.forEach(function (t) {
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
            if (rcRaw.indexOf('env') !== -1 || rcRaw.indexOf('lingkungan') !== -1 || rcRaw.indexOf('suhu') !== -1) rcName = 'Environment';
            else if (rcRaw.indexOf('trans') !== -1 || rcRaw.indexOf('fiber') !== -1 || rcRaw.indexOf('cut') !== -1 || rcRaw.indexOf('optic') !== -1 || rcRaw.indexOf('fo') !== -1 || rcRaw.indexOf('kabel') !== -1 || rcRaw.indexOf('cable') !== -1) rcName = 'Transmission';
            else if (rcRaw.indexOf('power') !== -1 || rcRaw.indexOf('pwr') !== -1 || rcRaw.indexOf('pln') !== -1 || rcRaw.indexOf('genset') !== -1 || rcRaw.indexOf('baterai') !== -1 || rcRaw.indexOf('battery') !== -1) rcName = 'Power';
            else if (rcRaw.indexOf('hardware') !== -1 || rcRaw.indexOf('hw') !== -1 || rcRaw.indexOf('perangkat') !== -1 || rcRaw.indexOf('modul') !== -1 || rcRaw.indexOf('card') !== -1 || rcRaw.indexOf('sfp') !== -1) rcName = 'Hardware';

            var rcObj = severityData[sev].rootCauses.find(function (rc) { return rc.name === rcName; });
            if (rcObj) {
                rcObj.value++;
            } else {
                var otherObj = severityData[sev].rootCauses.find(function (rc) { return rc.name === 'Others'; });
                if (otherObj) otherObj.value++;
            }
        });

        // Recalculate percentages
        categories.forEach(function (cat) {
            var catTotal = severityData[cat].total;
            severityData[cat].pctOfTotal = tickets.length ? Math.round((catTotal / tickets.length) * 100) + '%' : '0%';

            severityData[cat].rootCauses.forEach(function (rc) {
                rc.pct = catTotal ? Math.round((rc.value / catTotal) * 100) + '%' : '0%';
            });
        });
    }

    // Render components for each severity card
    var types = ['Emergency', 'Critical', 'Major', 'Minor'];
    types.forEach(function (type) {
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
        if (item.name === 'Environment') dotClass = 'custom-environment';
        else if (item.name === 'Transmission') dotClass = 'custom-transmission';
        else if (item.name === 'Power') dotClass = 'custom-power';
        else if (item.name === 'Hardware') dotClass = 'custom-hardware';
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

    window.addEventListener('resize', function () {
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

    var categories = ['Overall', 'TelkomAkses', 'Mandau', 'Persada', 'Others'];
    var phaseData = {};

    categories.forEach(function (cat) {
        phaseData[cat] = phases.map(function (p) {
            return { phase: p, total: 0, b1: 0, b2: 0, b3: 0, b4: 0, avg: 0, agingSum: 0 };
        });
    });

    if (tickets && tickets.length > 0) {
        tickets.forEach(function (t) {
            if (isTicketClosed(t)) return;
            var phaseRaw = String(t.operate_phase || t.phase || t.current_phase || t.state || '').toLowerCase();
            var phase = '1. Create PT';
            if (phaseRaw.indexOf('confirm') !== -1) phase = '6. Confirm PT';
            else if (phaseRaw.indexOf('handle analyze') !== -1) phase = '2. Handle Analyze PT';
            else if (phaseRaw.indexOf('analyze') !== -1) phase = '3. Analyze PT';
            else if (phaseRaw.indexOf('handle implement') !== -1) phase = '4. Handle Implement PT';
            else if (phaseRaw.indexOf('implement') !== -1) phase = '5. Implement PT';

            var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();
            var aging = parseFloat(t.aging || t.aging_days || t.days || calculateAgingDays(t.createtime, t.closetime, t.lastupdatetime, t.operate_time, statusRaw));

            var partner = getTicketPartner(t).replace(' ', ''); // Returns 'TelkomAkses', 'Mandau', 'Persada', 'Huawei', etc.
            var targetPartner = partner;
            if (partner !== 'TelkomAkses' && partner !== 'Mandau' && partner !== 'Persada') {
                targetPartner = 'Others';
            }

            var buck = 'b1';
            if (aging > 21) buck = 'b4';
            else if (aging > 15) buck = 'b3';
            else if (aging > 7) buck = 'b2';

            [targetPartner, 'Overall'].forEach(function (targetCat) {
                var row = phaseData[targetCat].find(function (r) { return r.phase === phase; });
                if (row) {
                    row.total++;
                    row[buck]++;
                    row.agingSum += aging;
                }
            });
        });

        // Calculate averages
        categories.forEach(function (cat) {
            phaseData[cat].forEach(function (row) {
                row.avg = row.total > 0 ? (row.agingSum / row.total) : 0;
            });
        });
    }

    // Render columns
    renderPhaseOverall('tablePhaseOverall', phaseData.Overall);
    renderPhasePartner('tablePhaseTelkom', phaseData.TelkomAkses);
    renderPhasePartner('tablePhaseMandau', phaseData.Mandau);
    renderPhasePartner('tablePhasePersada', phaseData.Persada);
    renderPhasePartner('tablePhaseOthers', phaseData.Others);
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

    phaseRows.forEach(function (row) {
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
        if (row.b1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + w1 + '%;" title="0-7 Days: ' + row.b1 + '">' + (w1 >= 12 ? row.b1 : '') + '</div>';
        if (row.b2 > 0) html += '    <div class="custom-bar-segment custom-seg-8-15" style="width: ' + w2 + '%;" title="8-15 Days: ' + row.b2 + '">' + (w2 >= 12 ? row.b2 : '') + '</div>';
        if (row.b3 > 0) html += '    <div class="custom-bar-segment custom-seg-16-21" style="width: ' + w3 + '%;" title="16-21 Days: ' + row.b3 + '">' + (w3 >= 12 ? row.b3 : '') + '</div>';
        if (row.b4 > 0) html += '    <div class="custom-bar-segment custom-seg-sla" style="width: ' + w4 + '%;" title="> SLA Days: ' + row.b4 + '">' + (w4 >= 12 ? row.b4 : '') + '</div>';
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
    if (totalB1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + tw1 + '%;" title="Total 0-7 Days: ' + totalB1 + '">' + (tw1 >= 12 ? totalB1 : '') + '</div>';
    if (totalB2 > 0) html += '    <div class="custom-bar-segment custom-seg-8-15" style="width: ' + tw2 + '%;" title="Total 8-15 Days: ' + totalB2 + '">' + (tw2 >= 12 ? totalB2 : '') + '</div>';
    if (totalB3 > 0) html += '    <div class="custom-bar-segment custom-seg-16-21" style="width: ' + tw3 + '%;" title="Total 16-21 Days: ' + totalB3 + '">' + (tw3 >= 12 ? totalB3 : '') + '</div>';
    if (totalB4 > 0) html += '    <div class="custom-bar-segment custom-seg-sla" style="width: ' + tw4 + '%;" title="Total > SLA Days: ' + totalB4 + '">' + (tw4 >= 12 ? totalB4 : '') + '</div>';
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

    phaseRows.forEach(function (row) {
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

function renderTrendsAndCompliance(weeklyTrendTickets, rootCauseTickets, complianceTickets) {
    if (typeof echarts === 'undefined') {
        console.warn('ECharts not available yet. Retrying in 500ms...');
        setTimeout(function () { renderTrendsAndCompliance(weeklyTrendTickets, rootCauseTickets, complianceTickets); }, 500);
        return;
    }

    var rootCauseData = [
        { name: 'Environment', value: 0, color: '#bc8cff' },
        { name: 'Transmission', value: 0, color: '#58a6ff' },
        { name: 'Power', value: 0, color: '#3fb950' },
        { name: 'Hardware', value: 0, color: '#f0883e' },
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
        var cleanDateStr = dateStr.replace(/\//g, '-');
        var parts = cleanDateStr.split(' ')[0].split('-');
        if (parts.length < 3) return 'W28';
        var yr = parseInt(parts[0], 10);
        var mo = parseInt(parts[1], 10) - 1;
        var dy = parseInt(parts[2], 10);
        var d = new Date(yr, mo, dy);
        if (isNaN(d.getTime())) return 'W28';
        var dayNum = d.getDay() || 7;
        d.setDate(d.getDate() + 4 - dayNum);
        var yearStart = new Date(d.getFullYear(), 0, 1);
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return 'W' + weekNo;
    }

    // 1. Top Root Cause (using rootCauseTickets - fully filtered by date + party)
    var rcTickets = rootCauseTickets || [];
    if (rcTickets.length > 0) {
        rcTickets.forEach(function (t) {
            var rcRaw = String(t.root_cause || t.rootcause || t.cause || '').toLowerCase();
            var rcName = 'Others';
            if (rcRaw.indexOf('env') !== -1 || rcRaw.indexOf('lingkungan') !== -1 || rcRaw.indexOf('suhu') !== -1) rcName = 'Environment';
            else if (rcRaw.indexOf('trans') !== -1 || rcRaw.indexOf('fiber') !== -1 || rcRaw.indexOf('cut') !== -1 || rcRaw.indexOf('optic') !== -1 || rcRaw.indexOf('fo') !== -1 || rcRaw.indexOf('kabel') !== -1 || rcRaw.indexOf('cable') !== -1) rcName = 'Transmission';
            else if (rcRaw.indexOf('power') !== -1 || rcRaw.indexOf('pwr') !== -1 || rcRaw.indexOf('pln') !== -1 || rcRaw.indexOf('genset') !== -1 || rcRaw.indexOf('baterai') !== -1 || rcRaw.indexOf('battery') !== -1) rcName = 'Power';
            else if (rcRaw.indexOf('hardware') !== -1 || rcRaw.indexOf('hw') !== -1 || rcRaw.indexOf('perangkat') !== -1 || rcRaw.indexOf('modul') !== -1 || rcRaw.indexOf('card') !== -1 || rcRaw.indexOf('sfp') !== -1) rcName = 'Hardware';

            var rcObj = rootCauseData.find(function (rc) { return rc.name === rcName; });
            if (rcObj) rcObj.value++;
        });
    }

    // 2. SLA Compliance (using complianceTickets - date-filtered only)
    var compTickets = complianceTickets || [];
    if (compTickets.length > 0) {
        compTickets.forEach(function (t) {
            var partner = getTicketPartner(t);
            var compObj = complianceData.find(function (c) { return c.party === partner; });
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
        });

        complianceData.forEach(function (c) {
            c.ach = c.total ? ((c.within / c.total) * 100).toFixed(1) + '%' : '0.0%';
        });
    }

    // 3. Weekly Trend (using weeklyTrendTickets - fully filtered by date + party)
    var trendTickets = weeklyTrendTickets || [];
    if (trendTickets.length > 0) {
        trendTickets.forEach(function (t) {
            // 1. Count as New PT in the week of creation
            var createDate = t.createtime || t.createfirstoccurtime || t.operate_time;
            if (createDate) {
                var createWeek = getWeekLabel(createDate);
                if (!weeklyMap[createWeek]) {
                    weeklyMap[createWeek] = { newPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0 };
                }
                weeklyMap[createWeek].newPT++;
            }

            // 2. Count as Closed/Pending/SLA in the week of resolution (for closed) or creation (for pending)
            var isClosed = isTicketClosed(t);
            var targetDate = isClosed ? getConfirmSubmitTime(t) : (t.createtime || t.createfirstoccurtime || t.operate_time);
            if (targetDate) {
                var targetWeek = getWeekLabel(targetDate);
                if (!weeklyMap[targetWeek]) {
                    weeklyMap[targetWeek] = { newPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0 };
                }
                var weekRow = weeklyMap[targetWeek];
                weekRow.total++;

                if (isClosed) {
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
            }
        });
    }

    function getWeekRangeString(wLabel, tickets) {
        var num = parseInt(wLabel.replace('W', ''), 10);
        if (isNaN(num)) return '';
        var year = 2026;
        if (tickets && tickets.length > 0) {
            for (var i = 0; i < tickets.length; i++) {
                var dStr = tickets[i].createtime || tickets[i].operate_time;
                if (dStr) {
                    var cleanDStr = dStr.replace(/\//g, '-');
                    var yr = parseInt(cleanDStr.split(' ')[0].split('-')[0], 10);
                    if (!isNaN(yr)) {
                        year = yr;
                        break;
                    }
                }
            }
        }
        var jan4 = new Date(year, 0, 4);
        var jan4Day = jan4.getDay() || 7;
        var mondayOfW1 = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
        var startOfWeek = new Date(mondayOfW1.getTime() + (num - 1) * 7 * 86400000);
        var endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
        var monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return String(startOfWeek.getDate()) + ' ' + monthsShort[startOfWeek.getMonth()] + ' - ' + String(endOfWeek.getDate()) + ' ' + monthsShort[endOfWeek.getMonth()] + ' ' + endOfWeek.getFullYear();
    }

    var weeksList = Object.keys(weeklyMap).sort(function (a, b) {
        var numA = parseInt(a.replace('W', ''), 10);
        var numB = parseInt(b.replace('W', ''), 10);
        return numA - numB;
    });
    var trendData = {
        weeks: weeksList,
        ranges: [],
        newPT: [],
        closedPT: [],
        pendingPT: [],
        overSla: [],
        slaAchievement: []
    };

    weeksList.forEach(function (w) {
        var row = weeklyMap[w];
        trendData.ranges.push(getWeekRangeString(w, trendTickets));
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
            },
            formatter: function (params) {
                if (!params || params.length === 0) return '';
                var dataIndex = params[0].dataIndex;
                var weekLabel = params[0].name;
                var rangeStr = data.ranges && data.ranges[dataIndex] ? data.ranges[dataIndex] : '';
                var html = '<div style="font-weight: bold; margin-bottom: 4px; color: inherit;">' + weekLabel + ' (' + rangeStr + ')</div>';
                params.forEach(function (p) {
                    var val = p.value;
                    if (p.seriesName.indexOf('%') !== -1) {
                        val = val + '%';
                    }
                    html += '<div>' + p.marker + ' ' + p.seriesName + ': <span style="font-weight: bold; float: right; margin-left: 15px;">' + val + '</span></div>';
                });
                return html;
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
    window.addEventListener('resize', function () { myChart.resize(); });
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

    sortedData.forEach(function (item) {
        yAxisData.push(item.name);
        seriesData.push(item.value);
        colors.push(item.color);
    });

    var totalSum = seriesData.reduce(function (a, b) { return a + b; }, 0);

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
                    color: function (params) {
                        return colors[params.dataIndex];
                    },
                    borderRadius: [0, 4, 4, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: function (params) {
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
    window.addEventListener('resize', function () { myChart.resize(); });
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

    rows.forEach(function (row) {
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

function formatIndonesianDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;

    var year = parts[0];
    var monthIndex = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    var months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    return day + ' ' + months[monthIndex] + ' ' + year;
}

function applyDateFilter() {
    var startEl = document.querySelector('.custom-filter-start-input');
    var endEl = document.querySelector('.custom-filter-end-input');
    var partyEl = document.querySelector('.custom-filter-party-input');
    var startInput = startEl ? startEl.value : '';
    var endInput = endEl ? endEl.value : '';
    var partyInput = partyEl ? partyEl.value : 'ALL';

    console.log('[DEBUG] applyDateFilter clicked. startInput:', startInput, 'endInput:', endInput, 'partyInput:', partyInput);

    if ((startInput && !endInput) || (!startInput && endInput)) {
        alert('Please select both Start Date and End Date to filter by date range.');
        return;
    }

    var startParam = null;
    var endParam = null;
    if (startInput && endInput) {
        var startDateObj = new Date(startInput);
        var endDateObj = new Date(endInput);

        if (startDateObj > endDateObj) {
            alert('Start Date cannot be later than End Date.');
            return;
        }
        startParam = startInput + ' 00:00:00';
        endParam = endInput + ' 23:59:59';
    }

    console.log('[DEBUG] Formatted Params -> startParam:', startParam, 'endParam:', endParam, 'party:', partyInput);

    var activeEl = document.querySelector('.custom-filter-active-range');
    if (activeEl) {
        var dateText = (startInput && endInput) ? (formatIndonesianDate(startInput) + ' - ' + formatIndonesianDate(endInput)) : 'All Time';
        var partyText = (partyInput === 'ALL') ? 'All Party' : partyInput;
        activeEl.innerText = 'Active: ' + dateText + ' | Party: ' + partyText;
    }

    loadProblemTickets(startParam, endParam, partyInput);
}

function resetDateFilter() {
    console.log('[DEBUG] resetDateFilter clicked.');
    var startEl = document.querySelector('.custom-filter-start-input');
    var endEl = document.querySelector('.custom-filter-end-input');
    var partyEl = document.querySelector('.custom-filter-party-input');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (partyEl) partyEl.value = 'ALL';

    var activeEl = document.querySelector('.custom-filter-active-range');
    if (activeEl) {
        activeEl.innerText = 'Active: All Time | Party: All Party';
    }

    loadProblemTickets(null, null, 'ALL');
}

// Safe event listener and loader registration for OWS (GDE) & Local Sandbox
function initDashboard() {
    var retryCount = 0;
    function tryInit() {
        var container = document.getElementById('customFilterContainer');
        if (container) {
            initDetailModalDOM();
            initDateFilterDOM();
            startLiveClock();
            loadProblemTickets();
        } else if (retryCount < 100) { // Retry for up to 5 seconds
            retryCount++;
            setTimeout(tryInit, 50);
        } else {
            console.warn('customFilterContainer placeholder not found in DOM after 5s. Loading tickets fallback.');
            initDetailModalDOM();
            startLiveClock();
            loadProblemTickets();
        }
    }
    tryInit();
}

if (typeof U !== 'undefined' && typeof U.ready === 'function') {
    U.ready(initDashboard);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

function initDateFilterDOM() {
    var container = document.getElementById('customFilterContainer');
    if (!container) return;

    container.innerHTML = '<div class="custom-filter-card">' +
        '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">' +
        '    <div class="custom-filter-title" style="margin-bottom:0;">Date Range & Party Filter (Createtime)</div>' +
        '    <div class="custom-filter-active-range" style="font-size:14px; font-weight:600; color:#58a6ff; background:rgba(88,166,255,0.1); padding:6px 14px; border-radius:15px; border:1px solid rgba(88,166,255,0.2);">Active: All Time | Party: All Party</div>' +
        '  </div>' +
        '  <div class="custom-filter-inputs">' +
        '    <div class="custom-filter-field">' +
        '      <label>Start Date</label>' +
        '      <input type="date" class="custom-filter-start-input">' +
        '    </div>' +
        '    <div class="custom-filter-field">' +
        '      <label>End Date</label>' +
        '      <input type="date" class="custom-filter-end-input">' +
        '    </div>' +
        '    <div class="custom-filter-field">' +
        '      <label>Party</label>' +
        '      <select class="custom-filter-party-input" style="background-color: #09090b; border: 1px solid #27272a; border-radius: 6px; color: #e4e4e7; padding: 8px 12px; font-size: 13px; outline: none; width: 160px; color-scheme: dark;">' +
        '        <option value="ALL">All Party</option>' +
        '        <option value="Telkom Akses">Telkom Akses</option>' +
        '        <option value="Mandau">Mandau</option>' +
        '        <option value="Persada">Persada</option>' +
        '      </select>' +
        '    </div>' +
        '    <div class="custom-filter-actions">' +
        '      <button onclick="applyDateFilter()" class="custom-btn custom-btn-primary custom-btn-apply-filter">Apply Filter</button>' +
        '      <button onclick="resetDateFilter()" class="custom-btn custom-btn-secondary custom-btn-reset-filter">Reset</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
}

function initDetailModalDOM() {
    if (document.getElementById('customDetailModal')) return;

    // Inject ALL modal CSS rules dynamically to bypass ADC's strict static CSS compiler checks
    var dynamicStyle = document.createElement('style');
    dynamicStyle.innerHTML =
        '.custom-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: none; align-items: center; justify-content: center; z-index: 99999; } ' +
        '.custom-modal-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); } ' +
        '.custom-modal-content { position: relative; background-color: #0d0d10; border: 1px solid #27272a; border-radius: 12px; width: 90%; max-width: 650px; max-height: 85vh; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; animation: modalFadeIn 0.2s ease-out; color: #e4e4e7; z-index: 100000; } ' +
        '@keyframes modalFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } } ' +
        '.custom-modal-header { padding: 16px 20px; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; } ' +
        '.custom-modal-title { margin: 0; font-size: 16px; font-weight: 700; color: #fafafa; } ' +
        '.custom-modal-close { font-size: 24px; color: #a1a1aa; cursor: pointer; transition: color 0.2s; line-height: 1; } ' +
        '.custom-modal-close:hover { color: #fafafa; } ' +
        '.custom-modal-body { padding: 20px; overflow-y: auto; font-size: 14px; line-height: 1.5; } ' +
        '.custom-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; } ' +
        '@media (max-width: 500px) { .custom-detail-grid { grid-template-columns: 1fr !important; } } ' +
        '.custom-detail-item { display: flex; flex-direction: column; gap: 4px; } ' +
        '.custom-detail-label { font-size: 12px; color: #a1a1aa; font-weight: 600; text-transform: uppercase; } ' +
        '.custom-detail-value { font-size: 14px; color: #e4e4e7; font-weight: 500; } ' +
        '.custom-detail-desc-block { border-top: 1px solid #27272a; padding-top: 16px; margin-top: 16px; } ' +
        '.custom-page-jump-input::-webkit-outer-spin-button, .custom-page-jump-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }' +
        '.custom-badge-severity { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase; } ' +
        '.custom-badge-sev-emergency { background-color: #341212 !important; color: #ff7b72 !important; border: 1px solid #da3633 !important; } ' +
        '.custom-badge-sev-critical { background-color: #3c1f0d !important; color: #f0883e !important; border: 1px solid #d15704 !important; } ' +
        '.custom-badge-sev-major { background-color: #382a0f !important; color: #e3b341 !important; border: 1px solid #b58900 !important; } ' +
        '.custom-badge-sev-minor { background-color: #132d15 !important; color: #56d364 !important; border: 1px solid #238636 !important; } ' +
        '.custom-badge-status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 10px; text-transform: uppercase; } ' +
        '.custom-badge-open { background-color: #da3633 !important; color: #ffffff !important; } ' +
        '.custom-badge-pending { background-color: #d15704 !important; color: #ffffff !important; } ' +
        '.custom-badge-closed { background-color: #238636 !important; color: #ffffff !important; }';
    document.head.appendChild(dynamicStyle);

    var modalDiv = document.createElement('div');
    modalDiv.id = 'customDetailModal';
    modalDiv.className = 'custom-modal';
    modalDiv.style.display = 'none';
    modalDiv.innerHTML =
        '<div class="custom-modal-backdrop" onclick="closeTicketDetailModal()"></div>' +
        '<div class="custom-modal-content">' +
        '  <div class="custom-modal-header">' +
        '    <h3 class="custom-modal-title">Problem Ticket Details</h3>' +
        '    <span class="custom-modal-close" onclick="closeTicketDetailModal()">&times;</span>' +
        '  </div>' +
        '  <div class="custom-modal-body" id="customModalBodyContent"></div>' +
        '</div>';
    document.body.appendChild(modalDiv);
}

function showTicketDetailModal(ticketId) {
    var tickets = (window.ticketsPagination && window.ticketsPagination.tickets) || [];
    var ticket = null;
    for (var i = 0; i < tickets.length; i++) {
        var idVal = tickets[i].orderid || tickets[i].id || tickets[i].code;
        if (String(idVal) === String(ticketId)) {
            ticket = tickets[i];
            break;
        }
    }

    if (!ticket) {
        console.warn('Ticket details not found for ID:', ticketId);
        return;
    }

    var bodyContent = document.getElementById('customModalBodyContent');
    if (!bodyContent) return;

    var status = ticket.ticketstatus || ticket.status || ticket.active_status || 'Open';
    var title = ticket.title || ticket.problem_name || ticket.description || 'No Title';
    var desc = ticket.createptproblemdes || ticket.problem_description || 'No Description';
    var createTime = ticket.createtime || '-';
    var lastUpdate = ticket.lastupdatetime || '-';
    var closeTime = ticket.closetime || '-';
    var phase = ticket.operate_phase || ticket.phase || ticket.current_phase || '-';
    var assign = ticket.createptassignto || '-';
    var operator = ticket.currentoperator || '-';
    var originator = ticket.originator || '-';

    var agingVal = ticket.aging || ticket.aging_days || ticket.days || calculateAgingDays(ticket.createtime, ticket.closetime, ticket.lastupdatetime, ticket.operate_time, status);

    var sevRaw = String(ticket.severity || ticket.createticketlevel || '').toLowerCase();
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
    }

    var rc = ticket.root_cause || ticket.rootcause || ticket.cause || '-';

    var statusClass = 'custom-badge-open';
    var statusLower = String(status).toLowerCase();
    if (statusLower === 'running' || statusLower === 'open' || statusLower === 'true' || statusLower === '1') {
        statusClass = 'custom-badge-open';
    } else if (statusLower === 'in progress' || statusLower === 'pending') {
        statusClass = 'custom-badge-pending';
    } else if (statusLower === 'closed' || statusLower === 'completed' || statusLower === 'false' || statusLower === '0') {
        statusClass = 'custom-badge-closed';
    }

    var html = '<div style="margin-bottom:16px;">';
    html += '  <h4 style="margin:0 0 6px 0; color:#f0f6fc; font-size:15px; font-weight:600;">' + title + '</h4>';
    html += '</div>';

    html += '<div class="custom-detail-grid">';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">TICKET ID</span>';
    html += '    <span class="custom-detail-value" style="font-family:monospace; font-weight:bold; color:#58a6ff;">' + ticketId + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">STATUS</span>';
    html += '    <span><span class="custom-badge-status ' + statusClass + '">' + status + '</span></span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">SEVERITY</span>';
    html += '    <span><span class="custom-badge-severity ' + sevClass + '">' + sevLabel + '</span></span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">ROOT CAUSE</span>';
    html += '    <span class="custom-detail-value" style="font-weight:700; color:#ff7b72; text-transform:uppercase;">' + rc + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">AGING DAYS</span>';
    html += '    <span class="custom-detail-value" style="font-weight:600; color:#56d364;">' + parseFloat(agingVal).toFixed(2) + ' Days</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">CURRENT PHASE</span>';
    html += '    <span class="custom-detail-value">' + phase + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">ASSIGNEE GROUP / PARTNER</span>';
    html += '    <span class="custom-detail-value">' + assign + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">CURRENT OPERATOR</span>';
    html += '    <span class="custom-detail-value">' + operator + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">ORIGINATOR</span>';
    html += '    <span class="custom-detail-value">' + originator + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">CREATE TIME</span>';
    html += '    <span class="custom-detail-value">' + createTime + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">LAST UPDATE TIME</span>';
    html += '    <span class="custom-detail-value">' + lastUpdate + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">CLOSE TIME</span>';
    html += '    <span class="custom-detail-value">' + closeTime + '</span>';
    html += '  </div>';

    html += '</div>'; // End Grid

    html += '<div class="custom-detail-desc-block">';
    html += '  <span class="custom-detail-label" style="display:block; margin-bottom:6px;">PROBLEM DESCRIPTION</span>';
    html += '  <div style="background:#0d1117; border:1px solid #30363d; border-radius:6px; padding:12px; font-size:13px; color:#c9d1d9; white-space:pre-wrap; word-break:break-word; max-height:120px; overflow-y:auto;">' + desc + '</div>';
    html += '</div>';

    bodyContent.innerHTML = html;

    var modal = document.getElementById('customDetailModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeTicketDetailModal() {
    var modal = document.getElementById('customDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Bind functions to window object explicitly to bypass GDE's private scope wrapper
window.applyDateFilter = applyDateFilter;
window.resetDateFilter = resetDateFilter;
window.prevTicketsPage = prevTicketsPage;
window.nextTicketsPage = nextTicketsPage;
window.gotoTicketsPage = gotoTicketsPage;
window.changeTicketsPageSize = changeTicketsPageSize;
window.showTicketDetailModal = showTicketDetailModal;
window.closeTicketDetailModal = closeTicketDetailModal;

function startLiveClock() {
    function updateClock() {
        var el = document.querySelector('.custom-dashboard-wrapper .custom-header-subtitle') || document.getElementById('liveTickerClock');
        if (!el) return;

        var now = new Date();
        var hrs = now.getHours();
        var mins = now.getMinutes();
        var secs = now.getSeconds();

        var hrsStr = hrs < 10 ? '0' + hrs : hrs;
        var minsStr = mins < 10 ? '0' + mins : mins;
        var secsStr = secs < 10 ? '0' + secs : secs;

        var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        var months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        var dayName = days[now.getDay()];
        var dayNum = now.getDate();
        var monthName = months[now.getMonth()];
        var year = now.getFullYear();

        el.innerText = dayName + ', ' + dayNum + ' ' + monthName + ' ' + year + ' — ' + hrsStr + ':' + minsStr + ':' + secsStr;
    }

    updateClock();
    setInterval(updateClock, 1000);
}
window.startLiveClock = startLiveClock;

function isTicketAccepted(t) {
    if (!t) return false;
    var val = t['Accept or Not(Confirm PT)'] || t.accept_or_not_confirm_pt || t.acceptornotconfirmpt || t.accept_or_not || t.acceptornot || t.confirm_status || '';
    val = String(val).toLowerCase();
    return val === 'accept' || val === 'accepted' || val === 'yes' || val === 'true';
}

function isTicketClosed(t) {
    if (!t) return false;
    var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();
    if (statusRaw === 'closed' || statusRaw === 'completed' || statusRaw === 'false' || statusRaw === '0') {
        return true;
    }
    return isTicketAccepted(t);
}

function getConfirmSubmitTime(t) {
    if (!t) return null;
    var val = t['SubmitTime(Confirm PT)'] || t.submittime_confirm_pt || t.submittimeconfirmpt || t.submit_time_confirm || t.confirm_submit_time || '';
    if (val) return val;
    return t.closetime || t.closure_time || t.lastupdatetime || t.operate_time || t.createtime;
}

window.isTicketAccepted = isTicketAccepted;
window.isTicketClosed = isTicketClosed;
window.getConfirmSubmitTime = getConfirmSubmitTime;
window.startLiveClock = startLiveClock;