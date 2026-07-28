// Safe JSON.parse wrapper for GDE Studio Previewer environment to catch undefined/null inputs
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

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC PARTY MANAGEMENT SYSTEM (PartyManager)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// OWS CENTRALIZED PARTY MANAGEMENT SYSTEM (PartyManager)
// Service Endpoint: /gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config
// ─────────────────────────────────────────────────────────────────────────────
var OWS_PARTY_CONFIG_GET_SERVICE = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config_get_list';
var OWS_PARTY_CONFIG_GET_SINGLE_SERVICE = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config_get';
var OWS_PARTY_CONFIG_CREATE_SERVICE = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config_create';
var OWS_PARTY_CONFIG_UPDATE_SERVICE = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config_update';
var OWS_PARTY_CONFIG_DELETE_SERVICE = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config_delete';
var OWS_PARTY_CONFIG_BATCH_DELETE_SERVICE = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_problem_ticket_dashboard_party_config_delete';

var _memoryParties = null;
var _memoryPartyMappings = null;
var _memoryDbRecords = {}; // Maps partyName or rawId to DB record object for deletion

window.PartyManager = {
    STORAGE_KEY: 'ows_registered_parties',
    MAPPING_STORAGE_KEY: 'ows_party_mappings',

    // Sync with OWS Database Model via get_list service
    fetchFromOwsDb: function (onComplete) {
        if (typeof MessageProcessor === 'undefined' || !MessageProcessor.process) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        var processResponse = function (res) {
            try {
                var rows = [];
                if (res && res.result && res.result._values) rows = res.result._values;
                else if (res && res.result && res.result.results) rows = res.result.results;
                else if (res && res.result && Array.isArray(res.result)) rows = res.result;
                else if (res && res.results) rows = res.results;
                else if (res && res._values) rows = res._values;
                else if (res && res.data) rows = res.data;
                else if (Array.isArray(res)) rows = res;

                var parties = [];
                var mappings = {};
                _memoryDbRecords = {};

                rows.forEach(function (r) {
                    var partyName = String(r.party_name || r.partyName || r.name || '').trim();
                    var rawId = String(r.raw_id || r.rawId || r.rawid || '').trim();
                    // Prioritise Sequence Primary Key pt_party_id
                    var recordId = r.pt_party_id !== undefined && r.pt_party_id !== null ? r.pt_party_id : (r.ptPartyId !== undefined ? r.ptPartyId : r.id);

                    var isAct = r.is_active || r.isActive;
                    var actBool = r.active;

                    // Skip deactivated records
                    if (isAct !== undefined && String(isAct).toUpperCase() === 'NO') return;
                    if (actBool !== undefined && (actBool === false || String(actBool).toLowerCase() === 'false')) return;

                    if (partyName) {
                        if (parties.indexOf(partyName) === -1) {
                            parties.push(partyName);
                        }
                        if (recordId) {
                            _memoryDbRecords[partyName.toLowerCase()] = recordId;
                        }
                    }
                    if (rawId && partyName) {
                        mappings[rawId.toLowerCase()] = partyName;
                        if (recordId) {
                            _memoryDbRecords[rawId.toLowerCase()] = recordId;
                        }
                    }
                });

                _memoryParties = parties;
                _memoryPartyMappings = mappings;

                try {
                    if (typeof localStorage !== 'undefined') {
                        localStorage.setItem('ows_registered_parties', JSON.stringify(parties));
                        localStorage.setItem('ows_party_mappings', JSON.stringify(mappings));
                    }
                } catch (e) { }

                console.log('[PartyManager] OWS DB Sync Success. Parties:', parties, 'Mappings:', mappings);
            } catch (err) {
                console.warn('[PartyManager] Error parsing OWS DB response:', err);
            }
            if (typeof onComplete === 'function') onComplete();
        };

        // Call get_list endpoint primary
        MessageProcessor.process({
            serviceId: OWS_PARTY_CONFIG_GET_SERVICE,
            data: { start: 0, limit: 1000 },
            success: processResponse,
            error: function (err) {
                console.warn('[PartyManager] get_list service error, fallback to get:', err);
                // Fallback try get endpoint if get_list is unavailable
                MessageProcessor.process({
                    serviceId: OWS_PARTY_CONFIG_GET_SINGLE_SERVICE,
                    data: { start: 0, limit: 1000 },
                    success: processResponse,
                    error: function (err2) {
                        console.warn('[PartyManager] OWS DB Sync error (using local cache):', err2);
                        if (typeof onComplete === 'function') onComplete();
                    }
                });
            }
        });
    },

    getRegisteredParties: function () {
        if (_memoryParties && Array.isArray(_memoryParties)) {
            return _memoryParties.slice();
        }
        try {
            var stored = typeof localStorage !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY) : null;
            if (stored !== null) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    _memoryParties = parsed;
                    return parsed.slice();
                }
            }
        } catch (e) {
            console.warn('[PartyManager] localStorage read error:', e);
        }
        _memoryParties = [];
        return [];
    },

    getPartyMappings: function () {
        if (_memoryPartyMappings && typeof _memoryPartyMappings === 'object') {
            return Object.assign({}, _memoryPartyMappings);
        }
        try {
            var stored = typeof localStorage !== 'undefined' ? localStorage.getItem(this.MAPPING_STORAGE_KEY) : null;
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') {
                    _memoryPartyMappings = parsed;
                    return Object.assign({}, parsed);
                }
            }
        } catch (e) {
            console.warn('[PartyManager] Mapping read error:', e);
        }
        _memoryPartyMappings = {};
        return {};
    },

    setMapping: function (rawId, displayName) {
        if (!rawId || !displayName) return false;
        var cleanRaw = String(rawId).trim();
        var cleanDisplay = String(displayName).trim();
        if (!cleanRaw || !cleanDisplay) return false;

        var mappings = this.getPartyMappings();
        mappings[cleanRaw.toLowerCase()] = cleanDisplay;
        _memoryPartyMappings = mappings;
        window.allTimePartnerMetrics = null; // Clear cached partner metrics

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(this.MAPPING_STORAGE_KEY, JSON.stringify(mappings));
            }
        } catch (e) { }

        // Insert mapping into OWS DB Model
        if (typeof MessageProcessor !== 'undefined' && MessageProcessor.process) {
            MessageProcessor.process({
                serviceId: OWS_PARTY_CONFIG_CREATE_SERVICE,
                data: {
                    raw_id: cleanRaw,
                    party_name: cleanDisplay,
                    is_active: 'YES'
                },
                success: function (res) {
                    console.log('[PartyManager] DB Mapping Save Success:', res);
                    window.allTimePartnerMetrics = null;
                },
                error: function (err) {
                    console.warn('[PartyManager] DB Mapping Save Notice:', err);
                }
            });
        }
        return true;
    },

    addParty: function (name) {
        if (!name || typeof name !== 'string') return false;
        var cleanName = name.trim();
        if (!cleanName) return false;

        var parties = this.getRegisteredParties();
        var exists = parties.some(function (p) { return p.toLowerCase() === cleanName.toLowerCase(); });
        if (!exists) {
            parties.push(cleanName);
            _memoryParties = parties.slice();
            window.allTimePartnerMetrics = null; // Clear cached partner metrics

            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parties));
                }
            } catch (e) { }

            // Insert new party into OWS DB Model
            if (typeof MessageProcessor !== 'undefined' && MessageProcessor.process) {
                MessageProcessor.process({
                    serviceId: OWS_PARTY_CONFIG_CREATE_SERVICE,
                    data: {
                        party_name: cleanName,
                        is_active: 'YES'
                    },
                    success: function (res) {
                        console.log('[PartyManager] DB Party Add Success:', res);
                        window.allTimePartnerMetrics = null;
                    },
                    error: function (err) {
                        console.warn('[PartyManager] DB Party Add Notice:', err);
                    }
                });
            }
            return true;
        }
        return false;
    },

    removeParty: function (name) {
        if (!name) return false;
        var cleanName = String(name).trim().toLowerCase();
        var parties = this.getRegisteredParties();
        var initialLen = parties.length;
        parties = parties.filter(function (p) { return p.toLowerCase() !== cleanName; });

        if (parties.length !== initialLen) {
            _memoryParties = parties.slice();
            window.allTimePartnerMetrics = null; // Clear cached partner metrics

            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parties));
                }
            } catch (e) { }

            // Delete record permanently via single delete service
            var recId = _memoryDbRecords[cleanName];
            if (typeof MessageProcessor !== 'undefined' && MessageProcessor.process) {
                var deletePayload = {
                    pt_party_id: recId || '',
                    party_name: cleanName
                };
                MessageProcessor.process({
                    serviceId: OWS_PARTY_CONFIG_DELETE_SERVICE,
                    data: deletePayload,
                    success: function (res) {
                        console.log('[PartyManager] OWS DB Batch Delete Success:', res);
                        window.allTimePartnerMetrics = null;
                        PartyManager.fetchFromOwsDb(function () {
                            if (typeof renderPartyConfigPage === 'function') {
                                renderPartyConfigPage();
                            }
                        });
                    },
                    error: function (err) {
                        console.warn('[PartyManager] OWS DB Batch Delete Notice:', err);
                    }
                });
            }
            return true;
        }
        return false;
    }
};

function getTicketPartner(item) {
    if (!item) return 'Others';
    var rawParty = String(item.responsibility || item.problem_responsible_party || '').trim();
    if (!rawParty) return 'Others';

    var lowerRaw = rawParty.toLowerCase();
    var mappings = PartyManager.getPartyMappings();

    // 1. Direct mapping check (e.g. UUID -> Official Display Name)
    if (mappings[lowerRaw]) {
        return mappings[lowerRaw];
    }

    // 2. Substring check against mapped raw_id / UUID keys
    var mapKeys = Object.keys(mappings);
    for (var k = 0; k < mapKeys.length; k++) {
        var key = mapKeys[k];
        if (key && lowerRaw.indexOf(key.toLowerCase()) !== -1) {
            return mappings[key];
        }
    }

    // 3. Registered party name substring check
    var registeredParties = PartyManager.getRegisteredParties();
    for (var i = 0; i < registeredParties.length; i++) {
        var reg = registeredParties[i];
        var regLower = reg.toLowerCase();
        if (lowerRaw.indexOf(regLower) !== -1 || regLower.indexOf(lowerRaw) !== -1) {
            return reg;
        }
    }
    return 'Others';
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

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS (top-level, used across multiple render functions)
// Centralised here to avoid duplicating identical logic in 2–3 places each.
// ─────────────────────────────────────────────────────────────────────────────

// OWS severity UUID constants (from createticketlevel field)
var SEV_UUID_EMERGENCY = '507';
var SEV_UUID_CRITICAL = '508';
var SEV_UUID_MAJOR = '50c';
var SEV_UUID_MINOR = '1029';

/**
 * Extracts raw text from OWS complex field types (Array of Objects, Objects, or Strings).
 * Safely unpacks OWS structures like [{ text: "Major", value: "Major" }] or { local: "2026-06-25" }.
 * @param {any} val
 * @returns {string}
 */
function extractOWSField(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val) && val.length > 0) {
        var item = val[0];
        if (typeof item === 'object' && item !== null) {
            return item.text || item.value || item.name || item.label || item.id || item.code || item.keycode || item.val || '';
        }
        return String(item);
    }
    if (typeof val === 'object') {
        return val.text || val.value || val.local || val.utc || val.name || val.label || val.id || val.code || val.keycode || val.val || '';
    }
    return String(val);
}

function getSeverityLabel(rawVal) {
    var valStr = extractOWSField(rawVal);
    if (!valStr) return 'Minor';

    var s = String(valStr).toLowerCase().trim();

    // 1. EMERGENCY (9 tickets in prod: eb0eb4fd-e4ad-11f0-9270-0255ac12120e)
    if (s.indexOf('eb0eb4fd') !== -1 || s.indexOf('606516bb') !== -1 || s.indexOf('emergenc') !== -1 || s === '7' || s === 'p1' || s.indexOf('level 1') !== -1 || s.indexOf('level1') !== -1) {
        return 'Emergency';
    }

    // 2. CRITICAL (33 tickets in prod: 9acc3211-e172-11f0-bac9-0255ac1218ed)
    if (s.indexOf('9acc3211') !== -1 || s.indexOf('8fb52507') !== -1 || s.indexOf('2507') !== -1 || s.indexOf('critic') !== -1 || s === '1' || s === 'p2' || s.indexOf('level 2') !== -1 || s.indexOf('level2') !== -1) {
        return 'Critical';
    }

    // 3. MAJOR (1614 tickets in prod: 9acc3212-e172-11f0-bac9-0255ac1218ed)
    if (s.indexOf('9acc3212') !== -1 || s.indexOf('8fb52508') !== -1 || s.indexOf('2508') !== -1 || s.indexOf('major') !== -1 || s === '2' || s === 'p3' || s.indexOf('level 3') !== -1 || s.indexOf('level3') !== -1 || s === 'high') {
        return 'Major';
    }

    // 4. MINOR (154 tickets in prod: 9acc3216-e172-11f0-bac9-0255ac1218ed)
    if (s.indexOf('9acc3216') !== -1 || s.indexOf('8fb5250c') !== -1 || s.indexOf('250c') !== -1 || s.indexOf('minor') !== -1 || s === '6' || s === 'p4' || s.indexOf('level 4') !== -1 || s.indexOf('level4') !== -1 || s === 'low' || s === 'medium') {
        return 'Minor';
    }

    return 'Minor';
}

/**
 * Returns canonical root cause label from raw root_cause field value.
 * @param {string} rawStr
 * @returns {'Environment'|'Transmission'|'Power'|'Hardware'|'Others'}
 */
function getRootCauseLabel(rawStr) {
    var r = String(rawStr || '').toLowerCase();
    if (r.indexOf('env') !== -1 || r.indexOf('lingkungan') !== -1 || r.indexOf('suhu') !== -1)
        return 'Environment';
    if (r.indexOf('trans') !== -1 || r.indexOf('fiber') !== -1 || r.indexOf('cut') !== -1 ||
        r.indexOf('optic') !== -1 || r.indexOf('fo') !== -1 || r.indexOf('kabel') !== -1 || r.indexOf('cable') !== -1)
        return 'Transmission';
    if (r.indexOf('power') !== -1 || r.indexOf('pwr') !== -1 || r.indexOf('pln') !== -1 ||
        r.indexOf('genset') !== -1 || r.indexOf('baterai') !== -1 || r.indexOf('battery') !== -1)
        return 'Power';
    if (r.indexOf('hardware') !== -1 || r.indexOf('hw') !== -1 || r.indexOf('perangkat') !== -1 ||
        r.indexOf('modul') !== -1 || r.indexOf('card') !== -1 || r.indexOf('sfp') !== -1)
        return 'Hardware';
    return 'Others';
}

/**
 * Returns canonical status category from raw ticketstatus field value.
 * @param {string} rawStr
 * @returns {'open'|'pending'|'closed'|'canceled'|'unknown'}
 */
function getStatusCategory(rawStr) {
    var s = String(rawStr || '').toLowerCase();
    if (s === 'canceled' || s === 'cancelled' || s === 'rejected') return 'canceled';
    if (s === 'closed' || s === 'completed') return 'closed';
    if (s === 'pending' || s === 'in progress') return 'pending';
    return 'open';
}

/**
 * Returns the ISO-8601 week label (e.g. 'W28') for a given date string.
 * Returns null if the date string is missing or invalid — callers must check for null.
 * @param {string} dateStr
 * @returns {string|null}
 */
function getWeekLabel(dateStr) {
    if (!dateStr) return null;
    var cleanDateStr = dateStr.replace(/\//g, '-');
    var parts = cleanDateStr.split(' ')[0].split('-');
    if (parts.length < 3) return null;
    var yr = parseInt(parts[0], 10);
    var mo = parseInt(parts[1], 10) - 1;
    var dy = parseInt(parts[2], 10);
    var d = new Date(yr, mo, dy);
    if (isNaN(d.getTime())) return null;
    // ISO-8601: week starts Monday, Thursday determines the year
    var dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return 'W' + weekNo;
}

/**
 * Returns a human-readable date range string (e.g. '14 Jul - 20 Jul 2026') for a week label.
 * @param {string} wLabel  e.g. 'W28'
 * @param {Array}  tickets used to infer the year from ticket create dates
 * @returns {string}
 */
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
                if (!isNaN(yr)) { year = yr; break; }
            }
        }
    }
    var jan4 = new Date(year, 0, 4);
    var jan4Day = jan4.getDay() || 7;
    var mondayOfW1 = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
    var startOfWeek = new Date(mondayOfW1.getTime() + (num - 1) * 7 * 86400000);
    var endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return startOfWeek.getDate() + ' ' + mo[startOfWeek.getMonth()] + ' - ' +
        endOfWeek.getDate() + ' ' + mo[endOfWeek.getMonth()] + ' ' + endOfWeek.getFullYear();
}

// Registered ECharts resize handlers keyed by containerId — prevents listener accumulation on re-renders
var _echartsResizeHandlers = {};

// ─────────────────────────────────────────────────────────────────────────────
// 02. AUTO-PAGINATION & DATA THINNING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

var PAGE_LIMIT = 1000;
var OWS_SUMMARY_SERVICE_ID = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_getsummarysc';
// var OWS_LIST_SERVICE_ID = '/adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_tt_problem_ticket_get_list';

function getSlaTargetDays(sevRaw) {
    var sev = getSeverityLabel(sevRaw);
    if (sev === 'Emergency') return 7;
    if (sev === 'Critical') return 15;
    if (sev === 'Major') return 21;
    return 30; // Minor
}

function sanitizeTicket(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    var sevRaw = extractOWSField(raw.severity || raw.createticketlevel || '');
    var slaStat = extractOWSField(raw.slastatus || '');
    var statusStr = extractOWSField(raw.ticketstatus || raw.status || '');

    var createTimeStr = extractOWSField(raw.createtime || raw.createfirstoccurtime || '');
    var closeTimeStr = extractOWSField(raw.closetime || '');
    var lastUpdateStr = extractOWSField(raw.lastupdatetime || '');
    var operateTimeStr = extractOWSField(raw.operate_time || '');
    var respStr = extractOWSField(raw.responsibility || raw.problem_responsible_party || '');

    var agingDays = raw.aging !== undefined && raw.aging !== null ? Number(raw.aging) : calculateAgingDays(createTimeStr, closeTimeStr, lastUpdateStr, operateTimeStr, statusStr);
    var targetSlaDays = getSlaTargetDays(sevRaw);

    var isOver = raw.over_sla !== undefined && raw.over_sla !== null 
        ? (raw.over_sla === true || String(raw.over_sla).toLowerCase() === 'true' || String(raw.over_sla) === '1')
        : (String(slaStat).toLowerCase() === 'sla_violation' || String(slaStat).toLowerCase() === 'over' || agingDays > targetSlaDays);

    return {
        orderid: raw.orderid || raw.keycode || raw.id || '',
        title: raw.title || '',
        ticketstatus: statusStr,
        severity: sevRaw,
        createticketlevel: sevRaw,
        root_cause: extractOWSField(raw.root_cause || raw.analyzecause || ''),
        operate_phase: extractOWSField(raw.current_phase || ''),
        current_phase: extractOWSField(raw.current_phase || ''),
        responsibility: respStr,
        createptproblemdes: raw.createptproblemdes || raw.procfaultreasondes || '',
        createptassignto: extractOWSField(raw.createptassignto || ''),
        currentoperator: extractOWSField(raw.currentoperator || ''),
        originator: extractOWSField(raw.originator || ''),
        createtime: createTimeStr,
        closetime: closeTimeStr,
        lastupdatetime: lastUpdateStr,
        operate_time: operateTimeStr,
        aging: agingDays,
        over_sla: isOver,
        target_sla_days: targetSlaDays,
        slastatus: slaStat,
        confirmaccept: extractOWSField(raw.confirmaccept || ''),
        pt14_submittime: extractOWSField(raw.pt14_submittime || ''),
        slapaused: extractOWSField(raw.slapaused || raw.slapausing || raw.sla_suspend_state || ''),
        slapausereason: extractOWSField(raw.slapausereason || raw.pause_reason || raw.exemptreason || '')
    };
}

function extractTickets(res) {
    var rawList = [];
    if (res && res.result && res.result._values) rawList = res.result._values;
    else if (res && res.result && res.result.results) rawList = res.result.results;
    else if (res && res.results) rawList = res.results;
    else if (res && res._values) rawList = res._values;
    else if (res && res.data) rawList = res.data;
    else if (Array.isArray(res)) rawList = res;

    if (!Array.isArray(rawList)) return [];

    var thinned = new Array(rawList.length);
    for (var i = 0; i < rawList.length; i++) {
        thinned[i] = sanitizeTicket(rawList[i]);
    }
    return thinned;
}

function callOWSSummary(startDate, endDate, party, onSuccess, onError) {
    var mappedParty = party || "ALL";
    var mappings = PartyManager.getPartyMappings();
    var rawIds = [];
    if (party && party !== 'ALL') {
        Object.keys(mappings).forEach(function (rawId) {
            if (mappings[rawId].toLowerCase() === party.toLowerCase()) {
                rawIds.push(rawId);
            }
        });
        if (rawIds.length > 0) {
            mappedParty = rawIds[0]; // Send raw UUID if mapped
        }
    }

    var allRows = [];
    var totalRecords = 0;
    var firstResponseData = null;

    function updateLoadingStatus(fetched, total) {
        var container = document.querySelector('#ticketContainer');
        if (container) {
            var loadingDiv = container.querySelector('.custom-loading-msg');
            if (!loadingDiv) {
                container.innerHTML = '';
                loadingDiv = document.createElement('div');
                loadingDiv.className = 'custom-loading-msg';
                loadingDiv.style.color = '#6c757d';
                loadingDiv.style.padding = '12px';
                container.appendChild(loadingDiv);
            }
            if (total && total > 0) {
                loadingDiv.textContent = 'Memuat data dari server OWS (' + fetched + ' / ' + total + ' tiket)...';
            } else if (fetched > 0) {
                loadingDiv.textContent = 'Memuat data dari server OWS (' + fetched + ' tiket)...';
            } else {
                loadingDiv.textContent = 'Memuat data dari server OWS...';
            }
        }
    }

    function fetchPage(startOffset) {
        var requestData = {
            "startDate": startDate || "",
            "endDate": endDate || "",
            "party": mappedParty,
            "selected_party_name": party || "ALL",
            "start": startOffset,
            "limit": PAGE_LIMIT
        };
        console.log('[SUMMARY] Fetching batch start=' + startOffset + ' limit=' + PAGE_LIMIT, requestData);

        MessageProcessor.process({
            serviceId: OWS_SUMMARY_SERVICE_ID,
            data: requestData,
            success: function (res) {
                var data = res && res.result ? res.result : (res || {});
                if (!firstResponseData) {
                    firstResponseData = data;
                }

                var summary = data.summary || {};
                var dataGrid = data.data_grid || {};
                var batchRows = dataGrid.rows || [];
                totalRecords = Math.max(dataGrid.total !== undefined ? dataGrid.total : 0, summary.total !== undefined ? summary.total : 0);

                allRows = allRows.concat(batchRows);
                updateLoadingStatus(allRows.length, totalRecords);

                // If more records remain and current batch is non-empty, fetch next batch
                if (totalRecords > allRows.length && batchRows.length > 0) {
                    fetchPage(startOffset + batchRows.length);
                } else {
                    // All pages fetched! Construct full combined response payload
                    if (!firstResponseData) firstResponseData = {};
                    if (!firstResponseData.data_grid) firstResponseData.data_grid = {};
                    firstResponseData.data_grid.rows = allRows;
                    firstResponseData.data_grid.total = totalRecords || allRows.length;
                    onSuccess(firstResponseData);
                }
            },
            error: function (err) {
                if (allRows.length > 0) {
                    console.warn('[SUMMARY] Partial fetch completed with error on offset ' + startOffset + ':', err);
                    if (!firstResponseData) firstResponseData = {};
                    if (!firstResponseData.data_grid) firstResponseData.data_grid = {};
                    firstResponseData.data_grid.rows = allRows;
                    onSuccess(firstResponseData);
                } else {
                    onError(err);
                }
            }
        });
    }

    updateLoadingStatus(0, 0);
    fetchPage(0);
}

function loadProblemTickets(startDate, endDate, party) {
    var container = document.querySelector('#ticketContainer');
    if (container) {
        container.innerHTML = '';
        var loadingDiv = document.createElement('div');
        loadingDiv.style.color = '#6c757d';
        loadingDiv.style.padding = '12px';
        loadingDiv.textContent = 'Memuat data dari server OWS...';
        container.appendChild(loadingDiv);
    }

    var isFiltered = !!(startDate || endDate || (party && party !== 'ALL'));

    // Panggil RunScript Summary Service (/problem_ticket_getsummarysc)
    callOWSSummary(startDate, endDate, party, function (res) {
        var data = res && res.result ? res.result : (res || {});
        renderRunScriptFullDashboard(data, isFiltered, party);
    }, function (err) {
        console.warn('OWS Summary Service Notice:', err);
    });
}

function renderRunScriptFullDashboard(data, isFiltered, party) {
    var summary = data.summary || {};
    var dataGrid = data.data_grid || {};
    var rawRows = dataGrid.rows || [];
    var rows = extractTickets(rawRows);

    // Save All-Time Unfiltered Summary on initial load
    if (!window.allTimeSummary || !isFiltered) {
        var pausedCount = summary.paused || 0;
        if (!pausedCount && Array.isArray(rows)) {
            rows.forEach(function (t) {
                var sp = String(t.slapaused || '').toLowerCase();
                if (sp === 'yes' || sp === 'true' || sp === '1') pausedCount++;
            });
        }
        summary.paused = pausedCount;
        window.allTimeSummary = summary;
    }

    var registeredParties = PartyManager.getRegisteredParties();

    // Dynamically compute partner breakdown cards using rows returned by server on initial unfiltered load
    if (!window.allTimePartnerMetrics || !isFiltered) {
        var partnerMetrics = {};
        registeredParties.forEach(function (p) {
            partnerMetrics[p] = { open: 0, pending: 0, closed: 0, canceled: 0 };
        });
        partnerMetrics['Others'] = { open: 0, pending: 0, closed: 0, canceled: 0 };

        if (Array.isArray(rows)) {
            rows.forEach(function (t) {
                var partner = getTicketPartner(t);
                var statusCat = getStatusCategory(t.ticketstatus || t.status || '');
                if (!partnerMetrics[partner]) {
                    partnerMetrics[partner] = { open: 0, pending: 0, closed: 0, canceled: 0 };
                }
                if (statusCat === 'open') partnerMetrics[partner].open++;
                else if (statusCat === 'pending') partnerMetrics[partner].pending++;
                else if (statusCat === 'closed') partnerMetrics[partner].closed++;
                else if (statusCat === 'canceled') partnerMetrics[partner].canceled++;
            });
        }
        window.allTimePartnerMetrics = partnerMetrics;
    }

    // 1. Header Stat Cards (Reflects Filtered Summary when Filter is Active)
    var headerSum = isFiltered ? summary : (window.allTimeSummary || summary);
    setCardValue('statTotal', headerSum.total !== undefined ? headerSum.total : (rows.length || 0));
    setCardValue('statOpen', headerSum.open !== undefined ? headerSum.open : 0);
    setCardValue('statInProgress', headerSum.pending !== undefined ? headerSum.pending : 0);
    setCardValue('statClosed', headerSum.closed !== undefined ? headerSum.closed : 0);
    setCardValue('statCanceled', headerSum.canceled !== undefined ? headerSum.canceled : 0);
    setCardValue('statPaused', headerSum.paused !== undefined ? headerSum.paused : 0);

    // 2. Dynamic Partner Breakdown Cards (Rendered via JS DOM into #partnerCardsContainer)
    renderDynamicPartnerCards();

    // 3. Render SELURUH Dashboard (Severity, Phase, Trends, SLA & List Tabel)
    window.allTicketsData = rows;

    renderTicketsData(rows, rows);
    renderSeverityDashboard(rows);
    renderPhaseDashboard(rows);
    renderTrendsAndCompliance(rows, rows, rows);
    renderSlaPauseReason(rows);
    updatePanelFilterBadges(party);
    updateLastUpdatedTimestamp();
}

function updateLastUpdatedTimestamp() {
    var el = document.getElementById('lastUpdatedTimestamp');
    if (!el) return;
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = 'Updated: ' + h + ':' + m + ':' + s;
}

function escapeHtmlStr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderSlaPauseReason(rows) {
    var container = document.getElementById('slaPauseReasonContainer');
    if (!container) return;

    var pausedTickets = (rows || []).filter(function (t) {
        var sp = String(t.slapaused || t.slapausing || t.sla_suspend_state || '').toLowerCase();
        return sp === 'yes' || sp === 'true' || sp === '1';
    });

    var counts = {};

    pausedTickets.forEach(function (t) {
        var r = String(t.slapausereason || t.pause_reason || t.exemptreason || '').trim();
        if (!r) r = 'Unspecified Reason';

        // Format raw reason string e.g. SLAPauseReasonThirdPartiesDeployment -> Third Parties Deployment
        var cleanReason = r.replace(/^SLAPauseReason/i, '');
        cleanReason = cleanReason.replace(/([A-Z])/g, ' $1').trim();
        if (!cleanReason) cleanReason = r;

        counts[cleanReason] = (counts[cleanReason] || 0) + 1;
    });

    var sortedReasons = Object.keys(counts).map(function (k) {
        return { reason: k, count: counts[k] };
    }).sort(function (a, b) {
        return b.count - a.count;
    });

    if (sortedReasons.length === 0) {
        container.innerHTML = '<div style="color: #8b949e; padding: 16px; font-size: 13px; text-align: center; background-color: #161b22; border: 1px solid #30363d; border-radius: 8px;">No tickets with SLA Paused = YES found for this filter.</div>';
        return;
    }

    var html = '<div class="custom-pause-reason-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">';

    sortedReasons.forEach(function (item) {
        html += '<div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">' +
            '<div style="color: #f0f6fc; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; max-width: 75%; line-height: 1.3;">' + escapeHtmlStr(item.reason) + '</div>' +
            '<div style="background: rgba(167, 139, 250, 0.18); color: #c4b5fd; border: 1px solid rgba(167, 139, 250, 0.4); font-weight: 800; font-size: 18px; border-radius: 6px; padding: 4px 14px; min-width: 40px; text-align: center;">' +
            item.count +
            '</div>' +
            '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
}

function renderDynamicPartnerCards() {
    var container = document.getElementById('partnerCardsContainer');
    if (!container) return;

    var registeredParties = PartyManager.getRegisteredParties();
    var displayParties = registeredParties.slice();
    displayParties.push('Others'); // Always show Others bucket

    var pm = window.allTimePartnerMetrics || {};

    container.innerHTML = '';
    displayParties.forEach(function (partnerName) {
        var metrics = pm[partnerName] || { open: 0, pending: 0, closed: 0, canceled: 0 };

        var cardDiv = document.createElement('div');
        cardDiv.className = 'custom-partner-card';

        var logoDiv = document.createElement('div');
        logoDiv.className = 'custom-partner-logo';

        var titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'color: #e4e4e7; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;';
        titleSpan.innerText = partnerName;
        logoDiv.appendChild(titleSpan);

        var metricsDiv = document.createElement('div');
        metricsDiv.className = 'custom-partner-metrics';

        var statusCols = [
            { label: 'Open PT', val: metrics.open },
            { label: 'Pending PT', val: metrics.pending },
            { label: 'Closed PT', val: metrics.closed },
            { label: 'Canceled PT', val: metrics.canceled }
        ];

        statusCols.forEach(function (sc) {
            var colDiv = document.createElement('div');
            colDiv.className = 'custom-metric-col';

            var lblDiv = document.createElement('div');
            lblDiv.className = 'custom-metric-label';
            lblDiv.innerText = sc.label;

            var valDiv = document.createElement('div');
            valDiv.className = 'custom-metric-val';
            valDiv.innerText = sc.val;

            colDiv.appendChild(lblDiv);
            colDiv.appendChild(valDiv);
            metricsDiv.appendChild(colDiv);
        });

        cardDiv.appendChild(logoDiv);
        cardDiv.appendChild(metricsDiv);
        container.appendChild(cardDiv);
    });
}

function updatePanelFilterBadges(party) {
    var headers = document.querySelectorAll('.custom-panel-header span');
    for (var i = 0; i < headers.length; i++) {
        var el = headers[i];
        var text = (el.innerText || el.textContent || '').toUpperCase();

        var isTarget = text.indexOf('1. SEVERITY OVERVIEW') !== -1 ||
            text.indexOf('2. PHASE STATUS') !== -1 ||
            text.indexOf('3. WEEKLY TREND') !== -1 ||
            text.indexOf('4. TOP ROOT CAUSE') !== -1 ||
            text.indexOf('5. SLA COMPLIANCE') !== -1 ||
            text.indexOf('6. SLA PAUSE REASON') !== -1 ||
            text.indexOf('7. PROBLEM TICKET LIST') !== -1;

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

// Global pagination state
window.ticketsPagination = {
    tickets: [],
    currentPage: 1,
    pageSize: 10
};

function renderSearchBar() {
    var container = document.getElementById('ticketSearchContainer');
    if (!container) return;
    if (!document.getElementById('customTicketSearchInput')) {
        var html = '<div style="padding: 12px 16px; border-bottom: 1px solid #27272a; display: flex; gap: 10px; align-items: center;">';
        html += '  <input type="text" id="customTicketSearchInput" placeholder="Search by Ticket ID, Title, Operator..." ';
        html += '    style="flex: 1; background-color: #0d0d10; border: 1px solid #27272a; border-radius: 6px; padding: 8px 12px; color: #e4e4e7; font-size: 13px; outline: none; transition: border-color 0.2s;" ';
        html += '    oninput="handleTicketSearch(this.value)">';
        html += '</div>';
        container.innerHTML = html;
    }
}

function renderTicketsData(tickets, dateFilteredTickets) {
    // Inject search bar into placeholder div dynamically from JS
    renderSearchBar();

    // Simpan data asli hasil filter tanggal+party untuk pencarian
    window.activeFilteredTickets = tickets || [];

    // Reset search input jika elemennya ada
    var searchInput = document.getElementById('customTicketSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }

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

    var searchHtml =
        '<div style="padding: 12px 16px; border-bottom: 1px solid #27272a; display: flex; gap: 10px; align-items: center;">' +
        '  <input type="text" id="customTicketSearchInput" placeholder="Search by Ticket ID, Title, Operator..." ' +
        '    value="' + (document.getElementById('customTicketSearchInput')?.value || '') + '" ' +
        '    style="flex: 1; background-color: #0d0d10; border: 1px solid #27272a; border-radius: 6px; padding: 8px 12px; color: #e4e4e7; font-size: 13px; outline: none;" ' +
        '    oninput="handleTicketSearch(this.value)">' +
        '</div>';

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
        var phase = item.current_phase || '-';

        // Calculate aging days dynamically from timestamps if not pre-calculated in DB
        var agingVal = item.aging || item.aging_days || item.days || calculateAgingDays(item.createtime, item.closetime, item.lastupdatetime, item.operate_time, status);

        var partner = getTicketPartner(item);

        // Map Severity — uses getSeverityLabel() helper (top-level, avoids duplication)
        var sevLabel = getSeverityLabel(item.severity || item.createticketlevel || '');
        var sevClass = 'custom-badge-sev-' + sevLabel.toLowerCase();

        // Map Status — uses getStatusCategory() helper
        var statusCat = getStatusCategory(status);
        var statusClass = statusCat === 'open' ? 'custom-badge-open'
            : statusCat === 'pending' ? 'custom-badge-pending'
                : statusCat === 'closed' ? 'custom-badge-closed'
                    : statusCat === 'canceled' ? 'custom-badge-canceled'
                        : 'custom-badge-open';

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
            // Use centralised helpers to avoid duplicating mapping logic
            var sev = getSeverityLabel(t.severity || t.createticketlevel || t.priority || '', t);
            severityData[sev].total++;

            var statusCat = getStatusCategory(t.ticketstatus || t.status || '');
            if (statusCat === 'pending' || statusCat === 'open') {
                severityData[sev].pending++;
            }

            var slaOver = t.over_sla || t.sla_over || t.is_over_sla || (t.slastatus && String(t.slastatus).toLowerCase() === 'over');
            if (slaOver === true || String(slaOver).toLowerCase() === 'true' || String(slaOver) === '1') {
                severityData[sev].overSla++;
            }

            var rcName = getRootCauseLabel(t.root_cause || t.rootcause || t.cause || '');
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

    // Fix: remove old handler before adding new to prevent accumulation on re-renders
    if (_echartsResizeHandlers[containerId]) {
        window.removeEventListener('resize', _echartsResizeHandlers[containerId]);
    }
    _echartsResizeHandlers[containerId] = function () { myChart.resize(); };
    window.addEventListener('resize', _echartsResizeHandlers[containerId]);
}

function renderPhaseDashboard(tickets) {
    var phases = [
        '1. Create PT',
        '2. Handle Analyze PT',
        '3. Analyze PT',
        '4. Handle Implement PT',
        '5. Implement PT',
        '6. Confirm PT',
        '7. Closed PT',
        '8. Canceled PT'
    ];

    var registeredParties = PartyManager.getRegisteredParties();
    var categories = ['Overall'];
    registeredParties.forEach(function (p) {
        categories.push(p);
    });
    categories.push('Others');

    var phaseData = {};
    categories.forEach(function (cat) {
        phaseData[cat] = phases.map(function (p) {
            return { phase: p, total: 0, b1: 0, b2: 0, b3: 0, b4: 0, avg: 0, agingSum: 0 };
        });
    });

    if (tickets && tickets.length > 0) {
        tickets.forEach(function (t) {
            var statusCat = getStatusCategory(t.ticketstatus || t.status || '');
            var phase = '1. Create PT';

            if (statusCat === 'closed') {
                phase = '7. Closed PT';
            } else if (statusCat === 'canceled') {
                phase = '8. Canceled PT';
            } else {
                var isRejected = (String(t.confirmaccept || t['Accept or Not(Confirm PT)'] || '').toLowerCase().indexOf('reject') !== -1);
                var phaseRaw = String(t.current_phase || t.state || '').toLowerCase();

                if (isRejected) {
                    phase = '5. Implement PT';
                } else if (phaseRaw.indexOf('confirm') !== -1) {
                    phase = '6. Confirm PT';
                } else if (phaseRaw.indexOf('handle analyze') !== -1) {
                    phase = '2. Handle Analyze PT';
                } else if (phaseRaw.indexOf('analyze') !== -1) {
                    phase = '3. Analyze PT';
                } else if (phaseRaw.indexOf('handle implement') !== -1) {
                    phase = '4. Handle Implement PT';
                } else if (phaseRaw.indexOf('implement') !== -1) {
                    phase = '5. Implement PT';
                }
            }

            var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();
            var aging = parseFloat(t.aging || t.aging_days || t.days || calculateAgingDays(t.createtime, t.closetime, t.lastupdatetime, t.operate_time, statusRaw));

            var partner = getTicketPartner(t);
            var targetPartner = categories.indexOf(partner) !== -1 ? partner : 'Others';

            var buck = 'b1';
            if (aging > 7) buck = 'b2';

            [targetPartner, 'Overall'].forEach(function (targetCat) {
                if (phaseData[targetCat]) {
                    var row = phaseData[targetCat].find(function (r) { return r.phase === phase; });
                    if (row) {
                        row.total++;
                        row[buck]++;
                        row.agingSum += aging;
                    }
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

    // Render Overall
    renderPhaseOverall('tablePhaseOverall', phaseData.Overall);

    // Dynamic Render for Partner Phase Columns
    var gridContainer = document.getElementById('phasePartnersGrid');
    if (gridContainer) {
        gridContainer.innerHTML = '';
        var partnerCats = categories.filter(function (c) { return c !== 'Overall'; });

        partnerCats.forEach(function (catName) {
            var colDiv = document.createElement('div');
            colDiv.className = 'custom-phase-col';

            var headerDiv = document.createElement('div');
            headerDiv.className = 'custom-phase-col-header';

            var titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'font-weight: 700; font-size: 14px; text-transform: uppercase; color: #e4e4e7;';
            titleSpan.innerText = catName;
            headerDiv.appendChild(titleSpan);

            var wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'custom-phase-table-wrapper';
            var tableId = 'tablePhase_' + catName.replace(/[^a-zA-Z0-9]/g, '_');
            wrapperDiv.id = tableId;

            colDiv.appendChild(headerDiv);
            colDiv.appendChild(wrapperDiv);
            gridContainer.appendChild(colDiv);

            renderPhasePartner(tableId, phaseData[catName]);
        });
    }
}

function renderPhaseOverall(containerId, phaseRows) {
    var wrapper = document.querySelector('#' + containerId);
    if (!wrapper) return;

    var totalPT = 0;
    var totalB1 = 0, totalB2 = 0;
    var weightedAgingSum = 0;

    var html = '<table class="custom-phase-table" style="table-layout: fixed; width: 100%;">';
    html += '<colgroup>';
    html += '  <col style="width: 200px;">';  // Phase name — fixed, not stretching
    html += '  <col style="width: 70px;">';   // Total PT — narrow
    html += '  <col>';                         // Aging Bucket — takes remaining space (widest)
    html += '  <col style="width: 110px;">';  // Avg Aging
    html += '</colgroup>';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Phase</th>';
    html += '<th>Total PT</th>';
    html += '<th>Aging Bucket (Days)</th>';
    html += '<th>Avg Aging (Days)</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    phaseRows.forEach(function (row) {
        totalPT += row.total;
        totalB1 += row.b1;
        totalB2 += row.b2;
        weightedAgingSum += row.avg * row.total;

        var maxVal = Math.max(1, row.total);
        var w1 = Math.round((row.b1 / maxVal) * 100);
        var w2 = Math.round((row.b2 / maxVal) * 100);

        var diff = 100 - (w1 + w2);
        if (diff !== 0 && (w1 || w2)) {
            if (w2 > 0) w2 += diff;
            else if (w1 > 0) w1 += diff;
        }

        html += '<tr>';
        html += '<td class="custom-phase-name-col">' + row.phase + '</td>';
        html += '<td class="custom-total-val">' + row.total + '</td>';
        html += '<td>';
        html += '  <div class="custom-stacked-bar">';
        if (row.b1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + w1 + '%;" title="0-7 Days: ' + row.b1 + '">' + (w1 >= 12 ? row.b1 : '') + '</div>';
        if (row.b2 > 0) html += '    <div class="custom-bar-segment custom-seg-gt-7" style="width: ' + w2 + '%;" title="> 7 Days: ' + row.b2 + '">' + (w2 >= 12 ? row.b2 : '') + '</div>';
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
    if (totalB1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + tw1 + '%;" title="Total 0-7 Days: ' + totalB1 + '">' + (tw1 >= 12 ? totalB1 : '') + '</div>';
    if (totalB2 > 0) html += '    <div class="custom-bar-segment custom-seg-gt-7" style="width: ' + tw2 + '%;" title="Total > 7 Days: ' + totalB2 + '">' + (tw2 >= 12 ? totalB2 : '') + '</div>';
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
    var totalB1 = 0, totalB2 = 0;
    var weightedAgingSum = 0;

    var html = '<table class="custom-phase-table" style="table-layout: fixed; width: 100%;">';
    html += '<colgroup>';
    html += '  <col style="width: 110px;">'; // Phase name
    html += '  <col style="width: 40px;">';  // 0-7
    html += '  <col style="width: 40px;">';  // >7
    html += '  <col style="width: 55px;">';  // Total PT
    html += '  <col style="width: 75px;">';  // Avg Aging (Days)
    html += '</colgroup>';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Phase</th>';
    html += '<th>0-7</th>';
    html += '<th>&gt;7</th>';
    html += '<th>Total PT</th>';
    html += '<th>Avg Aging (Days)</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    phaseRows.forEach(function (row) {
        totalPT += row.total;
        totalB1 += row.b1;
        totalB2 += row.b2;
        weightedAgingSum += row.avg * row.total;

        html += '<tr>';
        html += '<td class="custom-phase-name-col">' + row.phase + '</td>';
        html += '<td class="custom-heatmap-cell custom-heatmap-0-7">' + (row.b1 || '-') + '</td>';
        html += '<td class="custom-heatmap-cell custom-heatmap-gt-7">' + (row.b2 || '-') + '</td>';
        html += '<td class="custom-total-val">' + row.total + '</td>';
        html += '<td class="custom-avg-val">' + parseFloat(row.avg).toFixed(1) + '</td>';
        html += '</tr>';
    });

    var totalAvg = totalPT ? (weightedAgingSum / totalPT).toFixed(1) : '0.0';
    html += '<tr class="custom-total-row">';
    html += '<td style="text-align:left;">TOTAL</td>';
    html += '<td class="custom-heatmap-cell custom-heatmap-0-7">' + (totalB1 || '-') + '</td>';
    html += '<td class="custom-heatmap-cell custom-heatmap-gt-7">' + (totalB2 || '-') + '</td>';
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

    var registeredParties = PartyManager.getRegisteredParties();
    var complianceData = registeredParties.map(function (p) {
        return { party: p, total: 0, within: 0, over: 0, ach: '0.0%' };
    });
    complianceData.push({ party: 'Others', total: 0, within: 0, over: 0, ach: '0.0%' });

    var weeklyMap = {};
    // getWeekLabel and getWeekRangeString are now top-level functions — no closure redefinition needed

    // 1. Top Root Cause — uses getRootCauseLabel() helper
    var rcTickets = rootCauseTickets || [];
    if (rcTickets.length > 0) {
        rcTickets.forEach(function (t) {
            var rcName = getRootCauseLabel(t.root_cause || t.rootcause || t.cause || '');
            var rcObj = rootCauseData.find(function (rc) { return rc.name === rcName; });
            if (rcObj) rcObj.value++;
        });
    }

    // 2. SLA Compliance — falls back to 'Others' bucket for unrecognised partners
    var compTickets = complianceTickets || [];
    if (compTickets.length > 0) {
        compTickets.forEach(function (t) {
            var partner = getTicketPartner(t);
            var compObj = complianceData.find(function (c) { return c.party === partner; })
                || complianceData.find(function (c) { return c.party === 'Others'; });
            if (compObj) {
                compObj.total++;
                var isOver = t.over_sla || t.sla_over || t.is_over_sla;
                var overVal = (isOver === true || String(isOver).toLowerCase() === 'true' || String(isOver) === '1');
                if (overVal) { compObj.over++; } else { compObj.within++; }
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
                if (createWeek) {
                    if (!weeklyMap[createWeek]) {
                        weeklyMap[createWeek] = { newPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0 };
                    }
                    weeklyMap[createWeek].newPT++;
                }
            }

            // 2. Count as Closed/Pending/SLA in the week of resolution (for closed) or creation (for pending)
            var isClosed = isTicketClosed(t);
            var targetDate = isClosed ? getConfirmSubmitTime(t) : (t.createtime || t.createfirstoccurtime || t.operate_time);
            if (targetDate) {
                var targetWeek = getWeekLabel(targetDate);
                if (targetWeek) {
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
            }
        });
    }

    // getWeekRangeString is now top-level — no closure redefinition needed
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
            top: '2%'
        },
        grid: {
            top: '12%',
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        dataZoom: [
            {
                type: 'slider',
                show: true,
                startValue: Math.max(0, data.weeks.length - 12),
                endValue: data.weeks.length - 1,
                height: 18,
                bottom: 25,
                borderColor: 'transparent',
                backgroundColor: 'rgba(47, 47, 54, 0.4)',
                fillerColor: 'rgba(88, 166, 255, 0.2)',
                handleColor: '#58a6ff',
                handleSize: '100%',
                textStyle: {
                    color: '#8b949e'
                }
            },
            {
                type: 'inside',
                startValue: Math.max(0, data.weeks.length - 12),
                endValue: data.weeks.length - 1
            }
        ],
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
                itemStyle: { color: '#ffd000ff' },
                lineStyle: { width: 3.5, type: 'solid' },
                symbol: 'circle',
                symbolSize: 8,
                label: {
                    show: true,
                    position: 'top',
                    color: '#00e5ff',
                    fontSize: 11,
                    fontWeight: 'bold'
                }
            },
            {
                name: 'Over SLA',
                type: 'line',
                data: data.overSla,
                itemStyle: { color: '#ff0055' },
                lineStyle: { width: 3, type: 'dashed' },
                symbol: 'triangle',
                symbolSize: 9,
                label: {
                    show: true,
                    position: 'bottom',
                    color: '#ff0055',
                    fontSize: 11,
                    fontWeight: 'bold'
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
    if (_echartsResizeHandlers[containerId]) window.removeEventListener('resize', _echartsResizeHandlers[containerId]);
    _echartsResizeHandlers[containerId] = function () { myChart.resize(); };
    window.addEventListener('resize', _echartsResizeHandlers[containerId]);
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
    if (_echartsResizeHandlers[containerId]) window.removeEventListener('resize', _echartsResizeHandlers[containerId]);
    _echartsResizeHandlers[containerId] = function () { myChart.resize(); };
    window.addEventListener('resize', _echartsResizeHandlers[containerId]);
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
            PartyManager.fetchFromOwsDb(function () {
                initDateFilterDOM(); // Re-render dropdown with DB parties
                loadProblemTickets();
            });
        } else if (retryCount < 100) { // Retry for up to 5 seconds
            retryCount++;
            setTimeout(tryInit, 50);
        } else {
            console.warn('customFilterContainer placeholder not found in DOM after 5s. Loading tickets fallback.');
            initDetailModalDOM();
            startLiveClock();
            PartyManager.fetchFromOwsDb(function () {
                loadProblemTickets();
            });
        }
    }
    tryInit();
}

if (typeof U !== 'undefined' && typeof U.ready === 'function') {
    U.ready(initDashboard);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
}

function initDateFilterDOM() {
    var container = document.getElementById('customFilterContainer');
    if (!container) return;

    var registeredParties = PartyManager.getRegisteredParties();
    var partyOptionsHtml = '<option value="ALL">All Party</option>';
    registeredParties.forEach(function (p) {
        partyOptionsHtml += '<option value="' + p + '">' + p + '</option>';
    });
    partyOptionsHtml += '<option value="Others">Others</option>';

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
        partyOptionsHtml +
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
        '.custom-badge-open { background-color: #d29922 !important; color: #09090b !important; } ' +
        '.custom-badge-pending { background-color: #d15704 !important; color: #ffffff !important; } ' +
        '.custom-badge-closed { background-color: #238636 !important; color: #ffffff !important; } ' +
        '.custom-badge-canceled { background-color: #da3633 !important; color: #ffffff !important; }';
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

    var status = ticket.ticketstatus || 'Open';
    var title = ticket.title || 'No Title';
    var desc = ticket.createptproblemdes || 'No Description';
    var createTime = ticket.createtime || '-';
    var lastUpdate = ticket.lastupdatetime || '-';
    var closeTime = ticket.closetime || '-';
    var phase = ticket.current_phase || '-';
    var assign = ticket.createptassignto || '-';
    var operator = ticket.currentoperator || '-';
    var originator = ticket.originator || '-';

    var agingVal = ticket.aging !== null && ticket.aging !== undefined ? ticket.aging : calculateAgingDays(ticket.createtime, ticket.closetime, ticket.lastupdatetime, ticket.operate_time, status);

    var sevLabel = getSeverityLabel(ticket.severity || ticket.createticketlevel || '');
    var sevClass = 'custom-badge-sev-' + sevLabel.toLowerCase();

    var rc = ticket.root_cause || '-';

    var statusCatModal = getStatusCategory(status);
    var statusClass = statusCatModal === 'pending' ? 'custom-badge-pending'
        : statusCatModal === 'closed' ? 'custom-badge-closed'
            : statusCatModal === 'canceled' ? 'custom-badge-canceled'
                : 'custom-badge-open';

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

function isTicketAccepted(t) {
    if (!t) return false;
    var val = t['Accept or Not(Confirm PT)'] || t.confirmaccept || '';
    val = String(val).toLowerCase();
    return val === 'accept' || val === 'accepted' || val === 'yes' || val === 'true';
}

function isTicketClosed(t) {
    if (!t) return false;
    var statusRaw = String(t.ticketstatus || t.status || '').toLowerCase();

    // Explicitly exclude Canceled status
    if (statusRaw === 'canceled' || statusRaw === 'cancelled' || statusRaw === 'rejected') {
        return false;
    }

    // Strict Double Verification: Status must be Closed/Completed AND User must have Confirm & Accepted
    var isStatusClosed = (statusRaw === 'closed' || statusRaw === 'completed' || statusRaw === 'false' || statusRaw === '0');
    var isAccepted = isTicketAccepted(t);

    return isStatusClosed && isAccepted;
}

function getConfirmSubmitTime(t) {
    if (!t) return null;
    var val = t['SubmitTime(Confirm PT)'] || t.pt14_submittime || '';
    if (val) return val;
    return t.closetime || t.lastupdatetime || t.operate_time || t.createtime;
}

var _searchDebounceTimer = null;

function handleTicketSearch(query) {
    if (_searchDebounceTimer) {
        clearTimeout(_searchDebounceTimer);
    }
    _searchDebounceTimer = setTimeout(function () {
        executeTicketSearch(query);
    }, 300);
}

function executeTicketSearch(query) {
    var rawList = window.activeFilteredTickets || [];
    if (!query || !query.trim()) {
        window.ticketsPagination.tickets = rawList;
    } else {
        var q = query.trim().toLowerCase();
        window.ticketsPagination.tickets = rawList.filter(function (t) {
            for (var key in t) {
                if (t.hasOwnProperty(key)) {
                    var val = t[key];
                    if (val !== null && val !== undefined) {
                        if (String(val).toLowerCase().indexOf(q) !== -1) {
                            return true;
                        }
                    }
                }
            }
            return false;
        });
    }
    window.ticketsPagination.currentPage = 1;
    renderCurrentTicketsPage();
}

// Global Explicit Window Exports for GDE Scope Bypass
window.applyDateFilter = applyDateFilter;
window.resetDateFilter = resetDateFilter;
window.prevTicketsPage = prevTicketsPage;
window.nextTicketsPage = nextTicketsPage;
window.gotoTicketsPage = gotoTicketsPage;
window.changeTicketsPageSize = changeTicketsPageSize;
window.showTicketDetailModal = showTicketDetailModal;
window.closeTicketDetailModal = closeTicketDetailModal;
window.startLiveClock = startLiveClock;
window.isTicketAccepted = isTicketAccepted;
window.isTicketClosed = isTicketClosed;
window.getConfirmSubmitTime = getConfirmSubmitTime;
window.handleTicketSearch = handleTicketSearch;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE NAVIGATION & PARTY CONFIGURATION PAGE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
window.OWS_PARTY_CONFIG_NAME = 'party_config';
window.OWS_DASHBOARD_NAME = 'problem_ticket_dashboard';

function navigateToOwsPage(pageName, fallbackFile) {
    try {
        var search = window.location.search;
        var hash = window.location.hash;

        // 1. OWS Designer Mode (spl-designer.html?pageName=...)
        if (search && search.indexOf('pageName=') !== -1) {
            window.location.search = search.replace(/pageName=[^&]+/, 'pageName=' + encodeURIComponent(pageName));
            return;
        }

        // 2. OWS Runtime Hash Mode (#page/...)
        if (hash && hash.indexOf('page/') !== -1) {
            window.location.hash = '#page/' + pageName;
            return;
        }

        // 3. Fallback Local File Mode
        window.location.href = fallbackFile;
    } catch (e) {
        console.warn('[OWS Navigation] Redirect fallback:', e);
        window.location.href = fallbackFile;
    }
}

function switchDashboardPage(pageId) {
    var dashView = document.getElementById('pageDashboardView');
    var configView = document.getElementById('pagePartyConfigView');

    if (pageId === 'partyConfig') {
        // If configView is not in DOM (2 separate OWS Pages mode in OWS Portal)
        if (!configView) {
            navigateToOwsPage(window.OWS_PARTY_CONFIG_NAME, 'party_config.html');
            return;
        }

        if (dashView) dashView.style.display = 'none';
        configView.style.display = 'block';
        var btnDash = document.getElementById('btnNavDashboard');
        var btnConfig = document.getElementById('btnNavPartyConfig');
        if (btnDash) btnDash.classList.remove('active');
        if (btnConfig) btnConfig.classList.add('active');
        renderPartyConfigPage();
    } else {
        if (!dashView) {
            navigateToOwsPage(window.OWS_DASHBOARD_NAME, 'index.html');
            return;
        }
        if (configView) configView.style.display = 'none';
        dashView.style.display = 'block';
        var btnDash = document.getElementById('btnNavDashboard');
        var btnConfig = document.getElementById('btnNavPartyConfig');
        if (btnConfig) btnConfig.classList.remove('active');
        if (btnDash) btnDash.classList.add('active');
        if (window.allTicketsData) {
            renderRunScriptFullDashboard({ data_grid: { rows: window.allTicketsData } }, false, 'ALL');
        }
    }
}

function renderBackNavigation() {
    var container = document.getElementById('backNavContainer');
    if (!container) return;

    container.innerHTML = '';
    var btnWrapper = document.createElement('div');
    btnWrapper.className = 'custom-btn-wrapper';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'custom-btn custom-btn-secondary';
    btn.innerText = '<- Back to Dashboard';
    btn.onclick = function () {
        switchDashboardPage('dashboard');
    };

    btnWrapper.appendChild(btn);
    container.appendChild(btnWrapper);
}

function renderPartyConfigPage() {
    var registered = PartyManager.getRegisteredParties();

    // 2. Render Form Label & Form Input + Button dynamically via JS DOM (Sanitizer Proof)
    var formSectionDom = document.getElementById('addPartyFormSection');
    if (formSectionDom) {
        formSectionDom.innerHTML = '';

        var label = document.createElement('label');
        label.style.cssText = 'font-size: 12px; font-weight: 600; color: #a1a1aa; display: block; margin-bottom: 6px;';
        label.innerText = '+ Add New Official Party:';

        var formDiv = document.createElement('div');
        formDiv.className = 'custom-add-party-form';

        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'inputNewPartyName';
        input.className = 'custom-add-party-input';
        input.placeholder = 'Enter new party name (e.g., Cyber Partner)';

        var btnWrapper = document.createElement('div');
        btnWrapper.className = 'custom-btn-wrapper';

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'custom-btn custom-btn-primary';
        addBtn.id = 'btnAddNewParty';
        addBtn.innerText = '+ Add Party';
        addBtn.onclick = handleAddNewParty;

        btnWrapper.appendChild(addBtn);
        formDiv.appendChild(input);
        formDiv.appendChild(btnWrapper);

        formSectionDom.appendChild(label);
        formSectionDom.appendChild(formDiv);
    }

    // 3. Render Scan Button dynamically via JS DOM nodes
    var scanDom = document.getElementById('scanBtnContainer');
    if (scanDom) {
        scanDom.innerHTML = '';
        var scanWrapper = document.createElement('div');
        scanWrapper.className = 'custom-btn-wrapper';

        var scanBtn = document.createElement('button');
        scanBtn.type = 'button';
        scanBtn.className = 'custom-btn custom-btn-secondary';
        scanBtn.style.cssText = 'font-size: 11px; padding: 4px 10px;';
        scanBtn.innerText = 'Scan Database';
        scanBtn.onclick = refreshAutoDetectParties;

        scanWrapper.appendChild(scanBtn);
        scanDom.appendChild(scanWrapper);
    }

    // 4. Render Tag List dynamically via JS DOM nodes
    var tagListDom = document.getElementById('registeredPartiesTagList');
    var countDom = document.getElementById('activePartiesCount');
    if (countDom) countDom.innerText = registered.length + ' Registered';

    if (tagListDom) {
        tagListDom.innerHTML = '';
        var mappings = PartyManager.getPartyMappings();
        var mappingKeys = Object.keys(mappings);

        if (registered.length === 0 && mappingKeys.length === 0) {
            var emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'color: #a1a1aa; font-size: 13px;';
            emptyMsg.innerText = 'No registered parties found. Add one below.';
            tagListDom.appendChild(emptyMsg);
        } else {
            registered.forEach(function (party) {
                var tagDiv = document.createElement('div');
                tagDiv.className = 'custom-party-tag';

                // If party name is an alias mapping, display clean label
                var displayName = party;
                var mappings = PartyManager.getPartyMappings();
                var rawMapped = null;
                Object.keys(mappings).forEach(function (k) {
                    if (mappings[k].toLowerCase() === party.toLowerCase()) {
                        rawMapped = k;
                    }
                });

                var nameSpan = document.createElement('span');
                nameSpan.innerText = rawMapped ? (party + ' (' + rawMapped.substring(0, 8) + '...)') : party;

                var delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'custom-party-tag-del';
                delBtn.innerText = 'x';
                delBtn.title = 'Remove party from registered list';
                delBtn.onclick = function (e) {
                    if (e) e.stopPropagation();
                    handleRemoveParty(party);
                };

                tagDiv.appendChild(nameSpan);
                tagDiv.appendChild(delBtn);
                tagListDom.appendChild(tagDiv);
            });
        }
    }

    refreshAutoDetectParties();
}

function handleAddNewParty() {
    var input = document.getElementById('inputNewPartyName');
    if (!input || !input.value.trim()) return;

    var name = input.value.trim();
    if (PartyManager.addParty(name)) {
        window.allTimePartnerMetrics = null;
        input.value = '';
        renderPartyConfigPage();
    }
}

function handleRemoveParty(partyName) {
    if (confirm('Are you sure you want to remove the party "' + partyName + '" from the registered list?\nTickets for this party will be automatically grouped under OTHERS.')) {
        PartyManager.removeParty(partyName);
        window.allTimePartnerMetrics = null;
        renderPartyConfigPage();
    }
}

function getDetectedResponsibilitiesMap() {
    var detectedMap = {};

    // 1. Try reading in-memory window.allTicketsData (live data from OWS)
    var rawTickets = window.allTicketsData || [];
    if (rawTickets.length > 0) {
        rawTickets.forEach(function (t) {
            var rawParty = String(t.responsibility || t.problem_responsible_party || '').trim();
            if (rawParty) {
                if (!detectedMap[rawParty]) detectedMap[rawParty] = 0;
                detectedMap[rawParty]++;
            }
        });
        try {
            localStorage.setItem('OWS_DB_RESPONSIBILITIES', JSON.stringify(detectedMap));
        } catch (e) { }
        return detectedMap;
    }

    // 2. Try reading cached responsibilities from localStorage
    try {
        var cached = localStorage.getItem('OWS_DB_RESPONSIBILITIES');
        if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                return parsed;
            }
        }
    } catch (e) { }

    // 3. Return empty object if no live DB data or cache exists
    return {};
}

function refreshAutoDetectParties() {
    var autoContainer = document.getElementById('autoDetectPartiesContainer');
    if (!autoContainer) return;

    var registered = PartyManager.getRegisteredParties();
    var registeredLowers = registered.map(function (p) { return p.toLowerCase(); });
    var mappings = PartyManager.getPartyMappings();

    var detectedMap = getDetectedResponsibilitiesMap();
    var keys = Object.keys(detectedMap).sort(function (a, b) { return detectedMap[b] - detectedMap[a]; });

    autoContainer.innerHTML = '';
    var table = document.createElement('table');
    table.className = 'custom-config-table';

    var thead = document.createElement('thead');
    var trHead = document.createElement('tr');
    trHead.innerHTML = '<th>DB Responsibility</th><th>Ticket Count</th><th>Registration Status</th><th>Action</th>';
    thead.appendChild(trHead);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    if (keys.length === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.colSpan = 4;
        tdEmpty.style.cssText = 'color: #a1a1aa; text-align: center; padding: 16px;';
        tdEmpty.innerText = 'No responsibility records found in database.';
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
    } else {
        keys.forEach(function (partyName) {
            var tr = document.createElement('tr');

            // isReg: exact/substring match OR UUID has a mapping entry
            var partyLower = partyName.toLowerCase();
            var isReg = registeredLowers.some(function (r) {
                return partyLower === r || partyLower.indexOf(r) !== -1 || r.indexOf(partyLower) !== -1;
            });
            // UUID mapped to an alias also counts as Registered
            if (!isReg && mappings && mappings[partyName]) {
                isReg = true;
            }

            var td1 = document.createElement('td');
            td1.style.fontWeight = '600';
            td1.innerText = partyName;

            var td2 = document.createElement('td');
            var badge2 = document.createElement('span');
            badge2.className = 'custom-badge custom-bg-secondary';
            badge2.innerText = detectedMap[partyName] + ' Tickets';
            td2.appendChild(badge2);

            var td3 = document.createElement('td');
            var td4 = document.createElement('td');

            if (isReg) {
                var badge3 = document.createElement('span');
                badge3.className = 'custom-badge custom-bg-success';
                badge3.innerText = 'Registered';
                td3.appendChild(badge3);

                var span4 = document.createElement('span');
                span4.style.cssText = 'color: #a1a1aa; font-size: 11px;';
                span4.innerText = 'Already Registered';
                td4.appendChild(span4);
            } else {
                var badge3 = document.createElement('span');
                badge3.className = 'custom-badge custom-bg-warning';
                badge3.innerText = 'Discovered (OTHERS)';
                td3.appendChild(badge3);

                var btnWrap = document.createElement('div');
                btnWrap.className = 'custom-btn-wrapper';

                var addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'custom-btn custom-btn-primary';
                addBtn.style.cssText = 'font-size: 11px; padding: 3px 8px;';
                addBtn.innerText = '+ Register';
                addBtn.onclick = function () {
                    handleQuickAddParty(partyName);
                };

                btnWrap.appendChild(addBtn);
                td4.appendChild(btnWrap);
            }

            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);
            tr.appendChild(td4);
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    autoContainer.appendChild(table);
}

function handleQuickAddParty(rawPartyName) {
    if (!rawPartyName) return;

    // If rawPartyName looks like a UUID or raw DB ID (e.g. 0b5f02b9-ed39-11f0...)
    if (rawPartyName.length > 20 && rawPartyName.indexOf('-') !== -1) {
        var aliasName = prompt('Daftarkan ID Responsibility DB:\n"' + rawPartyName + '"\n\nMasukkan Nama Party / Mitra Resmi untuk ID ini:', 'Mitra Baru');
        if (aliasName && aliasName.trim()) {
            // setMapping internally registers the alias via addParty
            PartyManager.setMapping(rawPartyName, aliasName.trim());
            window.allTimePartnerMetrics = null; // Force dashboard re-compute
            renderPartyConfigPage();
            return;
        }
        return; // User cancelled — do nothing
    }

    if (PartyManager.addParty(rawPartyName)) {
        window.allTimePartnerMetrics = null; // Force dashboard re-compute
        renderPartyConfigPage();
    }
}

// Auto-Refresh Manager
var _autoRefreshIntervalId = null;

function setupAutoRefresh() {
    var placeholder = document.getElementById('customHeaderControlsPlaceholder');
    var header = document.querySelector('.custom-dashboard-header');
    
    var container = placeholder || document.getElementById('autoRefreshControlsContainer');
    if (!container && header) {
        container = document.createElement('div');
        container.id = 'autoRefreshControlsContainer';
        header.appendChild(container);
    }
    
    if (!container) return;
    if (container.dataset.initialized === 'true') return;
    container.dataset.initialized = 'true';
    container.className = 'custom-header-controls';

    // Inject DOM elements dynamically to bypass OWS HTML Panel Sanitizer escaping
    var label = document.createElement('label');
    label.htmlFor = 'autoRefreshSelect';
    label.className = 'custom-refresh-label';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '4px';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    label.style.color = '#a1a1aa';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'custom-refresh-svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#c4b5fd');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2');
    svg.appendChild(path);

    label.appendChild(svg);
    label.appendChild(document.createTextNode(' Auto Refresh:'));

    var select = document.createElement('select');
    select.id = 'autoRefreshSelect';
    select.className = 'custom-refresh-select';

    var options = [
        { text: 'Off', val: 'off' },
        { text: '30s', val: '30' },
        { text: '1m', val: '60' },
        { text: '5m', val: '300' }
    ];

    options.forEach(function (opt) {
        var el = document.createElement('option');
        el.value = opt.val;
        el.textContent = opt.text;
        select.appendChild(el);
    });

    var timeBadge = document.createElement('span');
    timeBadge.id = 'lastUpdatedTimestamp';
    timeBadge.className = 'custom-last-updated';
    timeBadge.textContent = 'Updated: --:--:--';

    container.innerHTML = '';
    container.appendChild(label);
    container.appendChild(select);
    container.appendChild(timeBadge);

    select.addEventListener('change', function () {
        if (_autoRefreshIntervalId) {
            clearInterval(_autoRefreshIntervalId);
            _autoRefreshIntervalId = null;
        }

        var sec = parseInt(this.value, 10);
        if (!isNaN(sec) && sec > 0) {
            _autoRefreshIntervalId = setInterval(function () {
                var sDate = window.currentStartDate || '';
                var eDate = window.currentEndDate || '';
                var party = window.currentSelectedParty || 'ALL';
                loadProblemTickets(sDate, eDate, party);
            }, sec * 1000);
        }
    });
}

// Auto-run when DOM is ready
(function initDashboardNavAndPartyConfig() {
    function tryInit() {
        setupAutoRefresh();
        if (document.getElementById('registeredPartiesTagList') || document.getElementById('partyConfigPageContainer')) {
            PartyManager.fetchFromOwsDb(function () {
                renderPartyConfigPage();
            });
            startLiveClock();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
    setTimeout(tryInit, 50);
    setTimeout(tryInit, 300);
})();

// Global Exports
window.renderBackNavigation = renderBackNavigation;
window.renderPartyConfigPage = renderPartyConfigPage;
window.handleAddNewParty = handleAddNewParty;
window.handleRemoveParty = handleRemoveParty;
window.refreshAutoDetectParties = refreshAutoDetectParties;
window.handleQuickAddParty = handleQuickAddParty;