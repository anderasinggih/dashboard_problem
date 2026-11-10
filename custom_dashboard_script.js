function safeJsonParse(text) {
    if (!text || text === 'undefined' || text === 'null') return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

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
                var parsed = safeJsonParse(stored);
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
                var parsed = safeJsonParse(stored);
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
    var rawParty = String(item.responsibility || '').trim();
    if (!rawParty) return 'Others';

    var lowerRaw = rawParty.toLowerCase();
    var mappings = PartyManager.getPartyMappings();

    // 1. Direct mapping check (e.g. UUID -> Official Display Name)
    if (mappings[lowerRaw]) {
        return mappings[lowerRaw];
    }

    // 2. Substring check against mapped raw_id / UUID keys
    var mapKeys = Object.keys(mappings);
    for (var m = 0; m < mapKeys.length; m++) {
        var k = mapKeys[m];
        if (k && k.length > 5 && (lowerRaw.indexOf(k) !== -1 || k.indexOf(lowerRaw) !== -1)) {
            return mappings[k];
        }
    }

    // 3. Registered party exact match
    var registered = PartyManager.getRegisteredParties();
    for (var i = 0; i < registered.length; i++) {
        var regParty = registered[i];
        if (lowerRaw === regParty.toLowerCase()) {
            return regParty;
        }
    }

    // 4. Registered party substring match
    for (var j = 0; j < registered.length; j++) {
        var regP = registered[j];
        var regLower = regP.toLowerCase();
        if (lowerRaw.indexOf(regLower) !== -1 || regLower.indexOf(lowerRaw) !== -1) {
            return regP;
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
        var endStr = closeTimeStr || '';
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

function padZero(n) {
    return n < 10 ? '0' + n : String(n);
}

/**
 * Converts a UTC date string or timestamp from OWS DB into UTC+7 (WIB) formatted string (YYYY-MM-DD HH:mm:ss).
 * @param {any} val
 * @returns {string}
 */
function formatToUTC7(val) {
    if (!val || val === '-') return '-';
    var rawStr = typeof val === 'object' ? extractOWSField(val) : String(val).trim();
    if (!rawStr || rawStr === '-' || rawStr === 'null' || rawStr === 'undefined') return '-';

    var dt = null;
    var match = rawStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
        var yr = parseInt(match[1], 10);
        var mo = parseInt(match[2], 10) - 1;
        var dy = parseInt(match[3], 10);
        var hr = match[4] ? parseInt(match[4], 10) : 0;
        var min = match[5] ? parseInt(match[5], 10) : 0;
        var sec = match[6] ? parseInt(match[6], 10) : 0;

        if (rawStr.indexOf('Z') !== -1 || rawStr.match(/[+-]\d{2}:?\d{2}$/)) {
            dt = new Date(rawStr);
        } else {
            var utcEpoch = Date.UTC(yr, mo, dy, hr, min, sec);
            dt = new Date(utcEpoch);
        }
    } else if (!isNaN(Number(rawStr))) {
        dt = new Date(Number(rawStr));
    } else {
        dt = new Date(rawStr);
    }

    if (!dt || isNaN(dt.getTime())) {
        return rawStr;
    }

    var utc7Date = new Date(dt.getTime() + (7 * 60 * 60 * 1000));
    var y = utc7Date.getUTCFullYear();
    var m = padZero(utc7Date.getUTCMonth() + 1);
    var d = padZero(utc7Date.getUTCDate());
    var hh = padZero(utc7Date.getUTCHours());
    var mm = padZero(utc7Date.getUTCMinutes());
    var ss = padZero(utc7Date.getUTCSeconds());

    return y + '-' + m + '-' + d + ' ' + hh + ':' + mm + ':' + ss;
}

/**
 * Extracts raw text from OWS complex field types (Array of Objects, Objects, or Strings).
 * Safely unpacks OWS structures like [{ text: "Major", value: "Major" }] or { local: "2026-06-25" }.
 * @param {any} val
 * @returns {string}
 */
function extractOWSField(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') {
        var trimmed = val.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            var parsed = safeJsonParse(trimmed);
            if (parsed !== null) val = parsed;
            else return val;
        } else {
            return val;
        }
    }
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
 * Returns canonical status category from raw ticket object or status/businessstatus strings.
 * @param {string|object} rawStatusOrTicket
 * @param {string} [rawBusinessStatus]
 * @returns {'open'|'pending'|'closed'|'canceled'|'unknown'}
 */
function getStatusCategory(rawStatusOrTicket, rawBusinessStatus) {
    var ts = '';
    var bs = '';

    if (rawStatusOrTicket && typeof rawStatusOrTicket === 'object') {
        ts = String(rawStatusOrTicket.ticketstatus || '').toLowerCase();
        bs = String(rawStatusOrTicket.businessstatus || '').toLowerCase();
    } else {
        ts = String(rawStatusOrTicket || '').toLowerCase();
        bs = String(rawBusinessStatus || '').toLowerCase();
    }

    // 1. CANCELED (Strict Production UUIDs & labels)
    if (ts === 'canceled' || ts === 'cancelled' || ts === 'rejected' ||
        bs === 'bb129930-e165-11f0-aa35-0255ac1218d9' || // Canceled (Production)
        bs === 'bb12994b-e165-11f0-aa35-0255ac1218d9' || // Abort Exception (Production)
        bs === 'b1fcdece-e15e-11f0-a47f-0255ac120028' || // Canceled (Dev)
        bs === 'b1fcdee9-e15e-11f0-a47f-0255ac120028' || // Abort Exception (Dev)
        bs === 'canceled' || bs === 'rejected') {
        return 'canceled';
    }

    // 2. CLOSED (Strict Production UUIDs & labels)
    if (ts === 'closed' || ts === 'completed' ||
        bs === 'bb129922-e165-11f0-aa35-0255ac1218d9' || // Closed (Production)
        bs === 'bb129937-e165-11f0-aa35-0255ac1218d9' || // Completed (Production)
        bs === 'bb12991f-e165-11f0-aa35-0255ac1218d9' || // BO Reject Closed (Production)
        bs === 'b1fcdec0-e15e-11f0-a47f-0255ac120028' || // Closed (Dev)
        bs === 'b1fcdebd-e15e-11f0-a47f-0255ac120028' || // BO Reject Closed (Dev)
        bs === 'completed' || bs === 'closed') {
        return 'closed';
    }

    // 3. PENDING PT (Strict 22 Business Status UUIDs)
    var pendingUuidsAndLabels = [
        // Real Production UUIDs dari mappingan businesstatus production.csv
        'bb12992f-e165-11f0-aa35-0255ac1218d9', // Pending for Approval
        'bb129928-e165-11f0-aa35-0255ac1218d9', // Pending for Assessment
        'bb129941-e165-11f0-aa35-0255ac1218d9', // Pending for Validation
        'bb12991d-e165-11f0-aa35-0255ac1218d9', // Pending
        'bb12993a-e165-11f0-aa35-0255ac1218d9', // Pending for Analyze
        'bb129916-e165-11f0-aa35-0255ac1218d9', // Pending for Handle
        'bb12993c-e165-11f0-aa35-0255ac1218d9', // Pending for Review
        'bb129923-e165-11f0-aa35-0255ac1218d9', // Pending for Analyze Plan
        'bb129927-e165-11f0-aa35-0255ac1218d9', // Pending for Approve Plan
        'bb12993f-e165-11f0-aa35-0255ac1218d9', // Pending for BO Accept
        'bb129940-e165-11f0-aa35-0255ac1218d9', // Pending for BO Resolve
        'bb12991c-e165-11f0-aa35-0255ac1218d9', // Pending for Confirmation
        'bb129925-e165-11f0-aa35-0255ac1218d9', // Pending for Execute
        'bb12992d-e165-11f0-aa35-0255ac1218d9', // Pending for Implementation
        'bb129942-e165-11f0-aa35-0255ac1218d9', // Pending for Review Improvement Plan
        'bb129944-e165-11f0-aa35-0255ac1218d9', // Pending for requester confirm
        'bb12991a-e165-11f0-aa35-0255ac1218d9', // BusinessStatusWIP
        'bb12992e-e165-11f0-aa35-0255ac1218d9', // BusinessStatusNew
        'bb12993e-e165-11f0-aa35-0255ac1218d9', // BusinessStatusAssigned
        'bb12993b-e165-11f0-aa35-0255ac1218d9', // BusinessStatusInProgress
        'bb12993d-e165-11f0-aa35-0255ac1218d9', // BusinessStatusBuildandTestInProgress
        'bb129932-e165-11f0-aa35-0255ac1218d9', // BusinessStatusImplementationInProgress

        // Dev / Testing UUIDs (yang muncul di data riil)
        'b1fcdedc-e15e-11f0-a47f-0255ac120028', // Assigned (Dev)
        'b1fcdeb8-e15e-11f0-a47f-0255ac120028', // In Progress / Analyze (Dev)
        'b1fcdecc-e15e-11f0-a47f-0255ac120028', // Rejected (Dev)
        'b1fcdecd-e15e-11f0-a47f-0255ac120028', // Pending Approval (Dev)
        'b1fcdec6-e15e-11f0-a47f-0255ac120028', // Pending Assessment (Dev)
        'b1fcdedf-e15e-11f0-a47f-0255ac120028'  // Pending Validation (Dev)
    ];

    if (pendingUuidsAndLabels.indexOf(bs) !== -1) {
        return 'pending';
    }

    // 4. OPEN PT (Tiket running)
    if (ts === 'running' || ts === 'open') {
        return 'open';
    }

    return 'open';
}

/**
 * Returns the ISO-8601 week label (e.g. 'W28') for a given date string.
 * Returns null if the date string is missing or invalid — callers must check for null.
 * @param {string} dateStr
 * @returns {string|null}
 */
/**
 * Returns the custom week label (e.g. 'W30') for a given date string based on Thursday-to-Wednesday cycle.
 * W1 always starts on Jan 1st (Thursday) of the target year.
 * (e.g., 23 - 29 July 2026 = Week 30)
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

    // Direct Thursday-to-Wednesday Cycle starting Jan 1st (Thu) of the year
    var w1Start = new Date(yr, 0, 1); // Jan 1st
    var diffMs = d.getTime() - w1Start.getTime();
    if (diffMs < 0) {
        // Fallback for dates before Jan 1st of current year
        w1Start = new Date(yr - 1, 0, 1);
        diffMs = d.getTime() - w1Start.getTime();
    }
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    var weekNo = Math.floor(diffDays / 7) + 1;
    return 'W' + weekNo;
}

/**
 * Returns a human-readable Thursday-to-Wednesday date range string (e.g. '23 Jul - 29 Jul 2026') for a week label.
 * @param {string} wLabel  e.g. 'W30'
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
    // W1 starts on Jan 1st (Thursday)
    var w1Start = new Date(year, 0, 1);
    var startOfWeek = new Date(w1Start.getTime() + (num - 1) * 7 * 86400000);
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
    var sevRaw = extractOWSField(raw.createticketlevel || '');
    var slaStat = extractOWSField(raw.slastatus || '');
    var statusStr = extractOWSField(raw.ticketstatus || '');

    var createTimeStr = extractOWSField(raw.createtime || '');
    var closeTimeStr = extractOWSField(raw.closetime || '');
    var lastUpdateStr = extractOWSField(raw.lastupdatetime || '');
    var operateTimeStr = extractOWSField(raw.operate_time || '');
    var respStr = extractOWSField(raw.responsibility || '');

    var agingDays = raw.aging !== undefined && raw.aging !== null ? Number(raw.aging) : calculateAgingDays(createTimeStr, closeTimeStr, lastUpdateStr, operateTimeStr, statusStr);
    var targetSlaDays = getSlaTargetDays(sevRaw);

    var isOver = raw.over_sla !== undefined && raw.over_sla !== null
        ? (raw.over_sla === true || String(raw.over_sla).toLowerCase() === 'true' || String(raw.over_sla) === '1')
        : (String(slaStat).toLowerCase() === 'sla_violation' || String(slaStat).toLowerCase() === 'over' || agingDays > targetSlaDays);

    return {
        orderid: raw.orderid || '',
        title: raw.title || '',
        ticketstatus: statusStr,
        businessstatus: extractOWSField(raw.businessstatus || ''),
        severity: sevRaw,
        createticketlevel: sevRaw,
        root_cause: extractOWSField(raw.root_cause || ''),
        sub_root_cause: extractOWSField(raw.sub_root_cause || ''),
        operate_phase: extractOWSField(raw.operate_phase || ''),
        current_phase: extractOWSField(raw.current_phase || ''),
        responsibility: respStr,
        createptproblemdes: raw.createptproblemdes || '',
        createptassignto: extractOWSField(raw.createptassignto || ''),
        currentoperator: extractOWSField(raw.currentoperator || ''),
        lastoperator: extractOWSField(raw.lastoperator || ''),
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
        tt10_createtime: extractOWSField(raw.tt10_createtime || ''),
        tt10_submittime: extractOWSField(raw.tt10_submittime || ''),
        tt11_createtime: extractOWSField(raw.tt11_createtime || ''),
        tt11_submittime: extractOWSField(raw.tt11_submittime || ''),
        tt12_createtime: extractOWSField(raw.tt12_createtime || ''),
        tt12_submittime: extractOWSField(raw.tt12_submittime || ''),
        pt10_createtime: extractOWSField(raw.pt10_createtime || ''),
        pt10_submittime: extractOWSField(raw.pt10_submittime || ''),
        pt12_createtime: extractOWSField(raw.pt12_createtime || ''),
        pt12_submittime: extractOWSField(raw.pt12_submittime || ''),
        pt14_createtime: extractOWSField(raw.pt14_createtime || ''),
        pt14_submittime: extractOWSField(raw.pt14_submittime || ''),
        slapausing: extractOWSField(raw.slapausing || ''),
        slapaused: extractOWSField(raw.slapaused || ''),
        slapausereason: extractOWSField(raw.slapausereason || ''),
        implhandleplandate: extractOWSField(raw.implhandleplandate || '')
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
    if (party && party !== 'ALL' && party.toLowerCase() !== 'others') {
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
                loadingDiv.textContent = 'Loading data from OWS server (' + fetched + ' / ' + total + ' tickets)...';
            } else if (fetched > 0) {
                loadingDiv.textContent = 'Loading data from OWS server (' + fetched + ' tickets)...';
            } else {
                loadingDiv.textContent = 'Loading data from OWS server...';
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
        loadingDiv.textContent = 'Loading data from OWS server...';
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

    // If party filter is active, ensure client-side row filtering matches getTicketPartner
    if (party && party !== 'ALL') {
        var partyLower = party.toLowerCase();
        rows = rows.filter(function (t) {
            var partner = getTicketPartner(t);
            return partner.toLowerCase() === partyLower;
        });
    }

    // Always compute robust summary directly from extracted rows if rows exist
    if (Array.isArray(rows) && rows.length > 0) {
        var computedSum = { total: 0, open: 0, pending: 0, closed: 0, canceled: 0, paused: 0 };
        rows.forEach(function (t) {
            var cat = getStatusCategory(t);
            if (cat === 'canceled') {
                computedSum.canceled++;
            } else {
                computedSum.total++;
                var ts = String(t.ticketstatus || t.status || '').toLowerCase();
                if (cat !== 'closed' && (ts === 'running' || ts === 'open')) computedSum.open++;
                var phaseRaw = String(t.current_phase || '').toLowerCase();
                var isPendingPhase = (phaseRaw.indexOf('implement') !== -1 || phaseRaw.indexOf('confirm') !== -1);
                if (cat !== 'closed' && isPendingPhase) computedSum.pending++;
                if (cat === 'closed') computedSum.closed++;
            }
            var sp = String(t.slapausing || '').toLowerCase();
            if (sp === 'yes' || sp === 'true' || sp === '1') computedSum.paused++;
        });
        summary = computedSum;
    }

    // Save All-Time Unfiltered Summary on initial load
    if (!window.allTimeSummary || !isFiltered) {
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
                var statusCat = getStatusCategory(t);
                if (!partnerMetrics[partner]) {
                    partnerMetrics[partner] = { open: 0, pending: 0, closed: 0, canceled: 0 };
                }
                var ts = String(t.ticketstatus || t.status || '').toLowerCase();
                var phaseRaw = String(t.current_phase || '').toLowerCase();
                var isPendingPhase = (phaseRaw.indexOf('implement') !== -1 || phaseRaw.indexOf('confirm') !== -1);

                if (statusCat === 'canceled') {
                    partnerMetrics[partner].canceled++;
                } else if (statusCat === 'closed') {
                    partnerMetrics[partner].closed++;
                } else {
                    if (ts === 'running' || ts === 'open') partnerMetrics[partner].open++;
                    if (isPendingPhase) partnerMetrics[partner].pending++;
                }
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
        var sp = String(t.slapausing || '').toLowerCase();
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
        container.innerHTML = '<div style="color: #a1a1aa; padding: 16px; font-size: 13px; text-align: center; background-color: #121215; border: 1px solid #222227; border-radius: 6px;">No tickets with SLA Paused = YES found for this filter.</div>';
        return;
    }

    var html = '<div class="custom-pause-reason-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;">';

    sortedReasons.forEach(function (item) {
        html += '<div style="background-color: #121215; border: 1px solid #222227; border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">' +
            '<div style="color: #f4f4f5; font-weight: 600; font-size: 13px; letter-spacing: -0.01em; max-width: 75%; line-height: 1.35;">' + escapeHtmlStr(item.reason) + '</div>' +
            '<div style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); font-weight: 700; font-size: 16px; border-radius: 6px; padding: 3px 12px; min-width: 36px; text-align: center;">' +
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
    pageSize: 10,
    sortColumn: null,
    sortOrder: 'asc' // 'asc' atau 'desc'
};

function sortTicketsTable(colKey) {
    var pag = window.ticketsPagination;
    if (pag.sortColumn === colKey) {
        pag.sortOrder = pag.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        pag.sortColumn = colKey;
        pag.sortOrder = 'asc';
    }

    var isAsc = pag.sortOrder === 'asc';

    pag.tickets.sort(function (a, b) {
        var valA = getSortableValue(a, colKey);
        var valB = getSortableValue(b, colKey);

        if (typeof valA === 'number' && typeof valB === 'number') {
            return isAsc ? valA - valB : valB - valA;
        }
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });

    pag.currentPage = 1;
    renderCurrentTicketsPage();
}

function getSortableValue(item, colKey) {
    if (colKey === 'id') return item.orderid || item.id || item.code || '';
    if (colKey === 'title') return item.title || item.problem_name || item.description || '';
    if (colKey === 'slastatus') return item.slastatus || '';
    if (colKey === 'assignee') return getTicketPartner(item);
    if (colKey === 'severity') {
        var sev = getSeverityLabel(item.severity || item.createticketlevel || '');
        var order = { 'Emergency': 1, 'Critical': 2, 'Major': 3, 'Minor': 4 };
        return order[sev] || 5;
    }
    if (colKey === 'root_cause') return item.root_cause || item.rootcause || item.cause || '';
    if (colKey === 'phase') return item.current_phase || '';
    if (colKey === 'aging') {
        var phaseRaw = String(item.current_phase || item.state || '').toLowerCase();
        var phaseStartTime = item.createtime;
        var statusCat = getStatusCategory(item);
        if (statusCat === 'closed' || statusCat === 'canceled') {
            phaseStartTime = item.createtime;
        } else if (phaseRaw.indexOf('handle analyze') !== -1) {
            phaseStartTime = item.tt10_submittime || item.tt11_createtime || item.createtime;
        } else if (phaseRaw.indexOf('analyze') !== -1) {
            phaseStartTime = item.tt11_submittime || item.tt12_createtime || item.tt10_submittime || item.createtime;
        } else if (phaseRaw.indexOf('handle implement') !== -1) {
            phaseStartTime = item.tt12_submittime || item.pt10_createtime || item.tt11_submittime || item.createtime;
        } else if (phaseRaw.indexOf('implement') !== -1) {
            phaseStartTime = item.pt10_submittime || item.pt12_createtime || item.tt12_submittime || item.createtime;
        } else if (phaseRaw.indexOf('confirm') !== -1) {
            phaseStartTime = item.pt12_submittime || item.pt14_createtime || item.pt10_submittime || item.createtime;
        }
        var agingVal = parseFloat(calculateAgingDays(phaseStartTime, item.closetime, item.lastupdatetime, item.operate_time, item.ticketstatus || item.status));
        return isNaN(agingVal) ? 0 : agingVal;
    }
    if (colKey === 'status') return getStatusCategory(item);
    return '';
}

function renderSearchBar() {
    var container = document.getElementById('ticketSearchContainer');
    if (!container) return;
    var selectedPhase = window.selectedPhaseFilter || 'ALL';
    var selectedQuery = (document.getElementById('customTicketSearchInput') ? document.getElementById('customTicketSearchInput').value : '');

    var html = '<div style="padding: 12px 16px; border-bottom: 1px solid #222227; display: flex; gap: 10px; align-items: center; width: 100%; box-sizing: border-box;">';
    html += '  <input type="text" id="customTicketSearchInput" placeholder="Search by Ticket ID, Title, Operator..." ';
    html += '    value="' + selectedQuery + '" ';
    html += '    style="flex: 1 1 auto; min-width: 240px; background-color: #09090b; border: 1px solid #222227; border-radius: 6px; padding: 7px 12px; color: #f4f4f5; font-size: 12.5px; outline: none; transition: border-color 0.15s ease; box-sizing: border-box;" ';
    html += '    oninput="handleTicketSearchFilter()">';
    html += '  <select id="customTicketPhaseFilter" onchange="handleTicketSearchFilter()" ';
    html += '    style="flex: 0 0 auto; background-color: #09090b; border: 1px solid #222227; border-radius: 6px; padding: 7px 12px; color: #f4f4f5; font-size: 12.5px; outline: none; cursor: pointer; color-scheme: dark; box-sizing: border-box;">';
    html += '    <option value="ALL" ' + (selectedPhase === 'ALL' ? 'selected' : '') + '>All Phases</option>';
    html += '    <option value="1. Create PT" ' + (selectedPhase === '1. Create PT' ? 'selected' : '') + '>1. Create PT</option>';
    html += '    <option value="2. Handle Analyze PT" ' + (selectedPhase === '2. Handle Analyze PT' ? 'selected' : '') + '>2. Handle Analyze PT</option>';
    html += '    <option value="3. Analyze PT" ' + (selectedPhase === '3. Analyze PT' ? 'selected' : '') + '>3. Analyze PT</option>';
    html += '    <option value="4. Handle Implement PT" ' + (selectedPhase === '4. Handle Implement PT' ? 'selected' : '') + '>4. Handle Implement PT</option>';
    html += '    <option value="5. Implement PT" ' + (selectedPhase === '5. Implement PT' ? 'selected' : '') + '>5. Implement PT</option>';
    html += '    <option value="6. Confirm PT" ' + (selectedPhase === '6. Confirm PT' ? 'selected' : '') + '>6. Confirm PT</option>';
    html += '    <option value="7. Closed PT" ' + (selectedPhase === '7. Closed PT' ? 'selected' : '') + '>7. Closed PT</option>';
    html += '    <option value="8. Canceled PT" ' + (selectedPhase === '8. Canceled PT' ? 'selected' : '') + '>8. Canceled PT</option>';
    html += '    <option value="SLA Paused" ' + (selectedPhase === 'SLA Paused' ? 'selected' : '') + '>⏸ SLA Paused</option>';
    html += '  </select>';
    html += '</div>';
    container.innerHTML = html;
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

    var searchInput = document.getElementById('customTicketSearchInput');
    var selectedQuery = (searchInput && searchInput.value) ? searchInput.value : '';


    if (tickets.length === 0) {
        container.innerHTML = '<div style="color: #6c757d; padding: 12px;">No tickets found for the selected date range.</div>';
        return;
    }

    var startIdx = (pag.currentPage - 1) * pag.pageSize;
    var endIdx = Math.min(startIdx + pag.pageSize, tickets.length);
    var pageTickets = tickets.slice(startIdx, endIdx);

    function getSortIcon(colKey) {
        if (pag.sortColumn !== colKey) return '<span style="opacity: 0.35; margin-left: 4px;">↕</span>';
        return pag.sortOrder === 'asc' ? '<span style="color: #58a6ff; margin-left: 4px;">↑</span>' : '<span style="color: #58a6ff; margin-left: 4px;">↓</span>';
    }

    var html = '<table class="custom-noc-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="width: 50px; text-align: center;">No.</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'id\')">Ticket ID ' + getSortIcon('id') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'title\')">Title / Description ' + getSortIcon('title') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'slastatus\')">SLA Status ' + getSortIcon('slastatus') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'assignee\')">Assignee ' + getSortIcon('assignee') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'severity\')">Severity ' + getSortIcon('severity') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'root_cause\')">Root Cause ' + getSortIcon('root_cause') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'phase\')">Current Phase ' + getSortIcon('phase') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'aging\')">Aging ' + getSortIcon('aging') + '</th>';
    html += '<th class="sortable" onclick="sortTicketsTable(\'status\')">Status ' + getSortIcon('status') + '</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    for (var i = 0; i < pageTickets.length; i++) {
        var item = pageTickets[i];
        var status = item.ticketstatus || item.status || item.active_status || 'Open';
        var title = item.title || item.problem_name || item.description || 'Tanpa Judul';
        var id = item.orderid || item.id || item.code || 'TCK';
        var phase = item.current_phase || '-';

        // Map Status — uses getStatusCategory() helper
        var statusCat = getStatusCategory(item);

        // Phase-specific start aging date calculation
        var phaseRaw = String(item.current_phase || item.state || '').toLowerCase();
        var phaseStartTime = item.createtime;
        if (statusCat === 'closed' || statusCat === 'canceled') {
            phaseStartTime = item.createtime;
        } else if (phaseRaw.indexOf('handle analyze') !== -1) {
            phaseStartTime = item.tt10_submittime || item.tt11_createtime || item.createtime;
        } else if (phaseRaw.indexOf('analyze') !== -1) {
            phaseStartTime = item.tt11_submittime || item.tt12_createtime || item.tt10_submittime || item.createtime;
        } else if (phaseRaw.indexOf('handle implement') !== -1) {
            phaseStartTime = item.tt12_submittime || item.pt10_createtime || item.tt11_submittime || item.createtime;
        } else if (phaseRaw.indexOf('implement') !== -1) {
            phaseStartTime = item.pt10_submittime || item.pt12_createtime || item.tt12_submittime || item.createtime;
        } else if (phaseRaw.indexOf('confirm') !== -1) {
            phaseStartTime = item.pt12_submittime || item.pt14_createtime || item.pt10_submittime || item.createtime;
        }

        var agingVal = parseFloat(calculateAgingDays(phaseStartTime, item.closetime, item.lastupdatetime, item.operate_time, status));
        if (isNaN(agingVal) || agingVal < 0) agingVal = parseFloat(item.aging || 0);

        var partner = getTicketPartner(item);

        // Map Severity — uses getSeverityLabel() helper (top-level, avoids duplication)
        var sevLabel = getSeverityLabel(item.severity || item.createticketlevel || '');
        var sevClass = 'custom-badge-sev-' + sevLabel.toLowerCase();

        // Map Status — uses getStatusCategory() helper
        var statusCat = getStatusCategory(item);
        var statusClass = statusCat === 'open' ? 'custom-badge-open'
            : statusCat === 'pending' ? 'custom-badge-pending'
                : statusCat === 'closed' ? 'custom-badge-closed'
                    : statusCat === 'canceled' ? 'custom-badge-canceled'
                        : 'custom-badge-open';
        var statusLabelText = String(statusCat || 'open').toUpperCase();

        var displayNo = startIdx + i + 1;
        var rc = item.root_cause || item.rootcause || item.cause || '-';
        var slaStatRaw = item.slastatus || '-';
        var isSlaOver = item.over_sla || String(slaStatRaw).toLowerCase().indexOf('violation') !== -1 || String(slaStatRaw).toLowerCase() === 'over';

        var slaDisplay = '-';
        if (slaStatRaw && slaStatRaw !== '-') {
            var slaLower = String(slaStatRaw).toLowerCase();
            if (slaLower === 'normal' || slaLower === 'within_sla' || slaLower === 'within sla') {
                slaDisplay = 'Within SLA';
            } else if (slaLower === 'sla_violation' || slaLower === 'over' || slaLower === 'over_sla' || slaLower === 'over sla') {
                slaDisplay = 'Over SLA';
            } else {
                slaDisplay = slaStatRaw;
            }
        } else if (item.aging !== undefined || item.over_sla !== undefined) {
            slaDisplay = isSlaOver ? 'Over SLA' : 'Within SLA';
        }

        var slaBadgeColor = isSlaOver ? '#ff7b72' : '#56d364';

        html += '<tr onclick="showTicketDetailModal(\'' + id + '\')">';
        html += '<td style="text-align: center; color: #8b949e; font-weight: 500;">' + displayNo + '</td>';
        html += '<td><span class="custom-ticket-id-badge">' + id + '</span></td>';
        html += '<td style="text-align: left; font-weight: 500;">' + title + '</td>';
        html += '<td style="font-weight: 600; color: ' + slaBadgeColor + ';">' + slaDisplay + '</td>';
        html += '<td>' + partner + '</td>';
        html += '<td><span class="custom-badge-severity ' + sevClass + '">' + sevLabel + '</span></td>';
        html += '<td style="font-weight: 600; text-transform: uppercase;">' + rc + '</td>';
        html += '<td>' + phase + '</td>';
        html += '<td style="font-weight: 600;">' + parseFloat(agingVal).toFixed(1) + ' Days</td>';
        html += '<td><span class="custom-badge-status ' + statusClass + '">' + statusLabelText + '</span></td>';
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
            closed: 0,
            withinSla: 0,
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
        var validTickets = tickets.filter(function (t) {
            return getStatusCategory(t) !== 'canceled';
        });

        validTickets.forEach(function (t) {
            // Use centralised helpers to avoid duplicating mapping logic
            var sev = getSeverityLabel(t.severity || t.createticketlevel || t.priority || '', t);
            severityData[sev].total++;

            var statusCat = getStatusCategory(t);
            if (statusCat === 'pending' || statusCat === 'open') {
                severityData[sev].pending++;
            } else if (statusCat === 'closed') {
                severityData[sev].closed++;
            }

            var slaOver = t.over_sla || t.sla_over || t.is_over_sla || (t.slastatus && String(t.slastatus).toLowerCase() === 'over');
            var isOverVal = (slaOver === true || String(slaOver).toLowerCase() === 'true' || String(slaOver) === '1');
            // Menghitung tiket yang TIDAK lebih dari target SLA (Within SLA)
            if (!isOverVal) {
                severityData[sev].withinSla++;
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
            severityData[cat].pctOfTotal = validTickets.length ? Math.round((catTotal / validTickets.length) * 100) + '%' : '0%';

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
        setCardValue(type.toLowerCase() + 'Closed', data.closed);
        setCardValue(type.toLowerCase() + 'Within', data.withinSla);

        // Render legend table
        renderLegend('legend' + type, data.rootCauses);

        // Render ECharts Donut Chart
        renderDonutChart('chart' + type, data, data.total, data.pctOfTotal);
    });
}

function renderLegend(containerId, rootCauses) {
    var legendDom = document.querySelector('#' + containerId);
    if (!legendDom) return;

    var html = '<table class="custom-legend-table" style="table-layout: fixed; width: 100%;">';
    html += '<colgroup>';
    html += '  <col style="width: 54%;">';
    html += '  <col style="width: 22%;">';
    html += '  <col style="width: 24%;">';
    html += '</colgroup>';
    html += '<thead><tr style="border-bottom: 1px solid #222227;"><th style="text-align:left; font-weight:600; color:#71717a; font-size:9.5px; padding:3px 2px; text-transform:uppercase;">Root Cause</th><th style="font-weight:600; color:#71717a; text-align:right; font-size:9.5px; padding:3px 2px; text-transform:uppercase;">Qty</th><th style="font-weight:600; color:#71717a; text-align:right; font-size:9.5px; padding:3px 2px; text-transform:uppercase;">%</th></tr></thead>';
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
        html += '<td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><span class="custom-legend-dot ' + dotClass + '"></span>' + item.name + '</td>';
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
            backgroundColor: '#121215',
            borderColor: '#222227',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#f4f4f5', fontSize: 12 },
            extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 6px;',
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
        '8. Canceled PT',
        '9. SLA Paused'
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
            var statusCat = getStatusCategory(t);
            var phase = '1. Create PT';

            var sp = String(t.slapausing || t.slapaused || '').toLowerCase();
            if (sp === 'yes' || sp === 'true' || sp === '1') {
                phase = '9. SLA Paused';
            } else if (statusCat === 'closed') {
                phase = '7. Closed PT';
            } else if (statusCat === 'canceled') {
                phase = '8. Canceled PT';
            } else {
                var phaseRaw = String(t.current_phase || t.state || '').toLowerCase();

                if (phaseRaw.indexOf('confirm') !== -1) {
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

            // Phase-specific start aging date calculation
            var phaseStartTime = t.createtime;
            if (phase === '2. Handle Analyze PT') {
                phaseStartTime = t.tt10_submittime || t.tt11_createtime || t.createtime;
            } else if (phase === '3. Analyze PT') {
                phaseStartTime = t.tt11_submittime || t.tt12_createtime || t.tt10_submittime || t.createtime;
            } else if (phase === '4. Handle Implement PT') {
                phaseStartTime = t.tt12_submittime || t.pt10_createtime || t.tt11_submittime || t.createtime;
            } else if (phase === '5. Implement PT') {
                phaseStartTime = t.pt10_submittime || t.pt12_createtime || t.tt12_submittime || t.createtime;
            } else if (phase === '6. Confirm PT') {
                phaseStartTime = t.pt12_submittime || t.pt14_createtime || t.pt10_submittime || t.createtime;
            }

            var aging = parseFloat(calculateAgingDays(phaseStartTime, t.closetime, t.lastupdatetime, t.operate_time, statusRaw));
            if (isNaN(aging) || aging < 0) aging = parseFloat(t.aging || 0);

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
    html += '  <col style="width: 180px;">';
    html += '  <col style="width: 80px;">';
    html += '  <col>';
    html += '  <col style="width: 130px;">';
    html += '</colgroup>';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Phase</th>';
    html += '<th>Total PT</th>';
    html += '<th>Aging Bucket (Days) <span style="font-weight:normal; margin-left:8px; font-size:10px; text-transform:none;"><span style="display:inline-block; width:7px; height:7px; background:#34d399; border-radius:2px; margin-right:3px;"></span>0-7 Days <span style="display:inline-block; width:7px; height:7px; background:#f87171; border-radius:2px; margin-left:8px; margin-right:3px;"></span>&gt;7 Days</span></th>';
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
        if (row.b1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + w1 + '%; background-color: #34d399; color: #ffffff;" title="0-7 Days: ' + row.b1 + '">' + (w1 >= 10 ? row.b1 : '') + '</div>';
        if (row.b2 > 0) html += '    <div class="custom-bar-segment custom-seg-gt-7" style="width: ' + w2 + '%; background-color: #f87171; color: #ffffff;" title="> 7 Days: ' + row.b2 + '">' + (w2 >= 10 ? row.b2 : '') + '</div>';
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
    if (totalB1 > 0) html += '    <div class="custom-bar-segment custom-seg-0-7" style="width: ' + tw1 + '%; background-color: #34d399; color: #ffffff;" title="Total 0-7 Days: ' + totalB1 + '">' + (tw1 >= 10 ? totalB1 : '') + '</div>';
    if (totalB2 > 0) html += '    <div class="custom-bar-segment custom-seg-gt-7" style="width: ' + tw2 + '%; background-color: #f87171; color: #ffffff;" title="Total > 7 Days: ' + totalB2 + '">' + (tw2 >= 10 ? totalB2 : '') + '</div>';
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
    html += '  <col style="width: 38%;">';
    html += '  <col style="width: 14%;">';
    html += '  <col style="width: 14%;">';
    html += '  <col style="width: 16%;">';
    html += '  <col style="width: 18%;">';
    html += '</colgroup>';
    html += '<thead>';
    html += '<tr>';
    html += '<th style="text-align:left;">Phase</th>';
    html += '<th>0-7</th>';
    html += '<th>&gt;7</th>';
    html += '<th>Total PT</th>';
    html += '<th>Avg (Days)</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    phaseRows.forEach(function (row) {
        totalPT += row.total;
        totalB1 += row.b1;
        totalB2 += row.b2;
        weightedAgingSum += row.avg * row.total;

        var b1Class = row.b1 > 0 ? 'custom-heatmap-0-7' : 'custom-heatmap-empty';
        var b2Class = row.b2 > 0 ? 'custom-heatmap-gt-7' : 'custom-heatmap-empty';

        html += '<tr>';
        html += '<td class="custom-phase-name-col">' + row.phase + '</td>';
        html += '<td class="custom-heatmap-cell ' + b1Class + '">' + (row.b1 || '-') + '</td>';
        html += '<td class="custom-heatmap-cell ' + b2Class + '">' + (row.b2 || '-') + '</td>';
        html += '<td class="custom-total-val">' + row.total + '</td>';
        html += '<td class="custom-avg-val">' + parseFloat(row.avg).toFixed(1) + '</td>';
        html += '</tr>';
    });

    var totalAvg = totalPT ? (weightedAgingSum / totalPT).toFixed(1) : '0.0';
    var totalB1Class = totalB1 > 0 ? 'custom-heatmap-0-7' : 'custom-heatmap-empty';
    var totalB2Class = totalB2 > 0 ? 'custom-heatmap-gt-7' : 'custom-heatmap-empty';

    html += '<tr class="custom-total-row">';
    html += '<td style="text-align:left;">TOTAL</td>';
    html += '<td class="custom-heatmap-cell ' + totalB1Class + '">' + (totalB1 || '-') + '</td>';
    html += '<td class="custom-heatmap-cell ' + totalB2Class + '">' + (totalB2 || '-') + '</td>';
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

    // complianceData: semua tiket (tidak peduli status) → dipakai donut chart
    var complianceData = registeredParties.map(function (p) {
        return { party: p, total: 0, within: 0, over: 0, ach: '0.0%' };
    });
    complianceData.push({ party: 'Others', total: 0, within: 0, over: 0, ach: '0.0%' });

    // complianceTableData: hanya tiket yg sudah complete/closed → dipakai tabel kanan + SLA Ach
    var complianceTableData = registeredParties.map(function (p) {
        return { party: p, total: 0, within: 0, over: 0, ach: '0.0%' };
    });
    complianceTableData.push({ party: 'Others', total: 0, within: 0, over: 0, ach: '0.0%' });

    var weeklyMap = {};
    // getWeekLabel and getWeekRangeString are now top-level functions — no closure redefinition needed

    // 1. Top Root Cause — Filter out canceled tickets
    var rcTickets = (rootCauseTickets || []).filter(function (t) {
        return getStatusCategory(t) !== 'canceled';
    });
    if (rcTickets.length > 0) {
        rcTickets.forEach(function (t) {
            var rcName = getRootCauseLabel(t.root_cause || t.rootcause || t.cause || '');
            var rcObj = rootCauseData.find(function (rc) { return rc.name === rcName; });
            if (rcObj) rcObj.value++;
        });
    }

    // 2a. SLA Compliance (donut) — semua tiket kecuali canceled
    var compTickets = (complianceTickets || []).filter(function (t) {
        return getStatusCategory(t) !== 'canceled';
    });
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

    // 2b. SLA Compliance table — hanya tiket yg ticketstatus = 'completed'
    var compClosedTickets = (complianceTickets || []).filter(function (t) {
        var ts = String(t.ticketstatus || t.status || '').trim().toLowerCase();
        return ts === 'completed';
    });
    if (compClosedTickets.length > 0) {
        compClosedTickets.forEach(function (t) {
            var partner = getTicketPartner(t);
            var tblObj = complianceTableData.find(function (c) { return c.party === partner; })
                || complianceTableData.find(function (c) { return c.party === 'Others'; });
            if (tblObj) {
                tblObj.total++;
                var isOver2 = t.over_sla || t.sla_over || t.is_over_sla;
                var overVal2 = (isOver2 === true || String(isOver2).toLowerCase() === 'true' || String(isOver2) === '1');
                if (overVal2) { tblObj.over++; } else { tblObj.within++; }
            }
        });
        complianceTableData.forEach(function (c) {
            c.ach = c.total ? ((c.within / c.total) * 100).toFixed(1) + '%' : '0.0%';
        });
    }

    // 3. Weekly Trend — Snapshot Backlog per Minggu
    //    LOGIC:
    //      - New PT     → dihitung di minggu createtime tiket
    //      - Closed PT  → dihitung di minggu closure time (fallback createtime)
    //      - Pending PT → SNAPSHOT: berapa tiket yang masih pending di AKHIR minggu W tersebut
    //                     W30 = 500 (tiket yg sudah ada saat W30 berakhir tapi belum closed)
    //                     W31 = 603 (tiket yg masih pending sekarang = sinkron dgn Stat Card)
    var trendTickets = weeklyTrendTickets || [];

    // Helper: parse date string ke timestamp ms (midnight)
    function parseDateMs(str) {
        if (!str) return NaN;
        var clean = String(str).replace(/\//g, '-').split(' ')[0]; // ambil YYYY-MM-DD
        var parts = clean.split('-');
        if (parts.length < 3) return NaN;
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
    }

    if (trendTickets.length > 0) {
        // Deteksi tahun referensi dari data tiket
        var refYear = 2026;
        for (var ri = 0; ri < trendTickets.length; ri++) {
            var rStr = trendTickets[ri].createtime || trendTickets[ri].operate_time;
            if (rStr) {
                var rYr = parseInt(String(rStr).replace(/\//g, '-').split('-')[0], 10);
                if (!isNaN(rYr) && rYr > 2000) { refYear = rYr; break; }
            }
        }

        // Pass 1: Hitung New PT (per createtime) & Closed PT (per closure time)
        //         Sekaligus kumpulkan semua minggu yang relevan ke weeklyMap
        trendTickets.forEach(function (t) {
            var isClosed = isTicketClosed(t);

            // New PT → minggu pembuatan
            var createDate = t.createtime || t.createfirstoccurtime || t.operate_time;
            if (createDate) {
                var createWeek = getWeekLabel(createDate);
                if (createWeek) {
                    if (!weeklyMap[createWeek]) {
                        weeklyMap[createWeek] = { newPT: 0, implementPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0, pendingByParty: {} };
                    }
                    weeklyMap[createWeek].newPT++;
                    // Over SLA & Within SLA: hanya tiket yg ticketstatus = 'completed'
                    //   - slastatus = sla_violation → Over SLA
                    //   - slastatus = normal        → Within SLA
                    var tsRaw = String(t.ticketstatus || t.status || '').trim().toLowerCase();
                    var slaRaw = String(t.slastatus || '').trim().toLowerCase();
                    if (tsRaw === 'completed') {
                        if (slaRaw === 'sla_violation') { weeklyMap[createWeek].overSla++; }
                        else if (slaRaw === 'normal') { weeklyMap[createWeek].withinSla++; }
                    }
                }
            }

            // Implemented PT → dihitung jika field pt12_submittime ada isinya DAN current_phase nilainya persis 'Implement PT'
            var phaseStr = String(t.current_phase || '').trim().toLowerCase();
            if (t.pt12_submittime && phaseStr === 'implement pt') {
                var implWeek = getWeekLabel(t.pt12_submittime);
                if (implWeek) {
                    if (!weeklyMap[implWeek]) {
                        weeklyMap[implWeek] = { newPT: 0, implementPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0, pendingByParty: {} };
                    }
                    weeklyMap[implWeek].implementPT++;
                }
            }

            // Closed PT → dihitung jika ticketstatus Completed/Closed DAN ada closetime, di-group sesuai minggu closetime
            var tsStr = String(t.ticketstatus || '').trim().toLowerCase();
            if ((tsStr === 'completed' || tsStr === 'closed') && t.closetime) {
                var closeWeek = getWeekLabel(t.closetime);
                if (closeWeek) {
                    if (!weeklyMap[closeWeek]) {
                        weeklyMap[closeWeek] = { newPT: 0, implementPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0, pendingByParty: {} };
                    }
                    weeklyMap[closeWeek].closedPT++;
                }
            }

            var currentWeek = getWeekLabel(new Date().toISOString().split('T')[0]);
            if (currentWeek && !weeklyMap[currentWeek]) {
                weeklyMap[currentWeek] = { newPT: 0, implementPT: 0, closedPT: 0, pendingPT: 0, overSla: 0, total: 0, withinSla: 0, pendingByParty: {} };
            }
        });

        var sortedWeeks = Object.keys(weeklyMap).sort(function (a, b) {
            return parseInt(a.replace('W', ''), 10) - parseInt(b.replace('W', ''), 10);
        });

        sortedWeeks.forEach(function (wLabel) {
            var pendingCountTotal = 0;
            var pendingByParty = {};

            trendTickets.forEach(function (t) {
                var statusCat = getStatusCategory(t);
                // Hanya hitung tiket yang saat ini statusnya Pending / Running
                if (statusCat !== 'pending') return;

                var createDate = t.createtime || t.createfirstoccurtime || t.operate_time;
                if (!createDate) return;
                var ticketCreateWeek = getWeekLabel(createDate);

                // Jika tiket di-create pada minggu ini (wLabel)
                if (ticketCreateWeek === wLabel) {
                    pendingCountTotal++;
                    var partner = getTicketPartner(t);
                    if (!pendingByParty[partner]) {
                        pendingByParty[partner] = 0;
                    }
                    pendingByParty[partner]++;
                }
            });

            weeklyMap[wLabel].pendingPT = pendingCountTotal;
            weeklyMap[wLabel].pendingByParty = pendingByParty;
        });
    }

    var weeksList = Object.keys(weeklyMap).sort(function (a, b) {
        var numA = parseInt(a.replace('W', ''), 10);
        var numB = parseInt(b.replace('W', ''), 10);
        return numA - numB;
    });

    var partySet = {};
    trendTickets.forEach(function (t) {
        if (getStatusCategory(t) === 'pending') {
            var p = getTicketPartner(t);
            if (p) partySet[p] = true;
        }
    });
    registeredParties.forEach(function (p) { partySet[p] = true; });
    partySet['Others'] = true;

    var activePartyList = Object.keys(partySet);

    var trendData = {
        weeks: weeksList,
        ranges: [],
        newPT: [],
        implementPT: [],
        closedPT: [],
        pendingPT: [],
        pendingByPartySeries: {},
        overSla: [],
        slaAchievement: []
    };

    activePartyList.forEach(function (party) {
        trendData.pendingByPartySeries[party] = [];
    });

    weeksList.forEach(function (w) {
        var row = weeklyMap[w];
        trendData.ranges.push(getWeekRangeString(w, trendTickets));
        trendData.newPT.push(row.newPT);
        trendData.implementPT.push(row.implementPT || 0);
        trendData.closedPT.push(row.closedPT);
        trendData.pendingPT.push(row.pendingPT);
        trendData.overSla.push(row.overSla);
        trendData.slaAchievement.push(row.withinSla);

        activePartyList.forEach(function (party) {
            var partyPending = (row.pendingByParty && row.pendingByParty[party]) ? row.pendingByParty[party] : 0;
            trendData.pendingByPartySeries[party].push(partyPending);
        });
    });

    renderSlaComplianceTable('tableSlaCompliance', complianceData, complianceTableData);

    window.lastWeeklyTrendData = trendData;
    renderWeeklyTrendTabControls();
    drawWeeklyTrendChart('chartWeeklyTrend', trendData);
    drawTopRootCauseChart('chartTopRootCause', rootCauseData);
}

window.currentWeeklyTrendMode = 'overview'; // 'overview' | 'vendor'
window.currentWeeklyTimeframe = '12W'; // '4W' | '12W' | 'ALL'

function renderWeeklyTrendTabControls() {
    var placeholder = document.getElementById('weeklyTrendControlsPlaceholder');
    var header = placeholder || document.getElementById('weeklyTrendHeader');
    if (!header) {
        var chartDom = document.getElementById('chartWeeklyTrend');
        if (chartDom) {
            var panelCard = chartDom.closest('.custom-panel-card') || chartDom.closest('.custom-section-container');
            if (panelCard) {
                header = panelCard.querySelector('.custom-panel-header') || panelCard.querySelector('.custom-section-header');
            }
        }
    }
    if (!header) return;

    var existingTab = header.querySelector('.custom-weekly-tab-container') || (placeholder && placeholder.querySelector('.custom-weekly-tab-container'));
    if (existingTab && existingTab.parentNode) {
        existingTab.parentNode.removeChild(existingTab);
    }

    var newTabContainer = document.createElement('div');
    newTabContainer.className = 'custom-weekly-tab-container';
    newTabContainer.style.display = 'inline-flex';
    newTabContainer.style.alignItems = 'center';
    newTabContainer.style.gap = '10px';

    var modePills =
        '<div class="custom-weekly-tab-group">' +
        '  <button type="button" class="custom-weekly-tab-btn ' + (window.currentWeeklyTrendMode === 'overview' ? 'active' : '') + '" id="btnWeeklyTabOverview" onclick="switchWeeklyTrendMode(\'overview\')">Overview</button>' +
        '  <button type="button" class="custom-weekly-tab-btn ' + (window.currentWeeklyTrendMode === 'vendor' ? 'active' : '') + '" id="btnWeeklyTabVendor" onclick="switchWeeklyTrendMode(\'vendor\')">Vendor Breakdown</button>' +
        '</div>';

    var tf = window.currentWeeklyTimeframe || '12W';
    var timeframePills =
        '<div class="custom-weekly-tab-group custom-timeframe-group">' +
        '  <button type="button" class="custom-weekly-tab-btn ' + (tf === '4W' ? 'active' : '') + '" id="btnTf4W" onclick="switchWeeklyTimeframe(\'4W\')">4W</button>' +
        '  <button type="button" class="custom-weekly-tab-btn ' + (tf === '12W' ? 'active' : '') + '" id="btnTf12W" onclick="switchWeeklyTimeframe(\'12W\')">12W</button>' +
        '  <button type="button" class="custom-weekly-tab-btn ' + (tf === 'ALL' ? 'active' : '') + '" id="btnTfALL" onclick="switchWeeklyTimeframe(\'ALL\')">All</button>' +
        '</div>';

    newTabContainer.innerHTML = modePills + timeframePills;
    if (placeholder) {
        placeholder.appendChild(newTabContainer);
    } else {
        header.appendChild(newTabContainer);
    }
}

function switchWeeklyTrendMode(mode) {
    if (mode !== 'overview' && mode !== 'vendor') return;
    window.currentWeeklyTrendMode = mode;

    var btnOverview = document.getElementById('btnWeeklyTabOverview');
    var btnVendor = document.getElementById('btnWeeklyTabVendor');

    if (btnOverview) {
        if (mode === 'overview') btnOverview.classList.add('active');
        else btnOverview.classList.remove('active');
    }
    if (btnVendor) {
        if (mode === 'vendor') btnVendor.classList.add('active');
        else btnVendor.classList.remove('active');
    }

    if (window.lastWeeklyTrendData) {
        drawWeeklyTrendChart('chartWeeklyTrend', window.lastWeeklyTrendData);
    }
}
window.switchWeeklyTrendMode = switchWeeklyTrendMode;

function switchWeeklyTimeframe(tf) {
    if (tf !== '4W' && tf !== '12W' && tf !== 'ALL') return;
    window.currentWeeklyTimeframe = tf;

    ['4W', '12W', 'ALL'].forEach(function (tItem) {
        var btn = document.getElementById('btnTf' + tItem);
        if (btn) {
            if (tItem === tf) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    if (window.lastWeeklyTrendData) {
        drawWeeklyTrendChart('chartWeeklyTrend', window.lastWeeklyTrendData);
    }
}
window.switchWeeklyTimeframe = switchWeeklyTimeframe;

function hexToRgbaStr(hex, opacity) {
    if (!hex) return 'rgba(88, 166, 255, ' + (opacity !== undefined ? opacity : 1) + ')';
    var cleanHex = String(hex).replace('#', '');
    if (cleanHex.length === 8) { cleanHex = cleanHex.substring(0, 6); }
    if (cleanHex.length === 3) {
        cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }
    var num = parseInt(cleanHex, 16);
    if (isNaN(num)) return 'rgba(88, 166, 255, ' + (opacity !== undefined ? opacity : 1) + ')';
    var r = (num >> 16) & 255;
    var g = (num >> 8) & 255;
    var b = num & 255;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (opacity !== undefined ? opacity : 1) + ')';
}

function createTradingViewAreaGradient(colorHex, opacityTop, opacityBottom) {
    var topOpacity = opacityTop !== undefined ? opacityTop : 0.4;
    var bottomOpacity = opacityBottom !== undefined ? opacityBottom : 0.02;

    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: hexToRgbaStr(colorHex, topOpacity) },
        { offset: 1, color: hexToRgbaStr(colorHex, bottomOpacity) }
    ]);
}

function drawWeeklyTrendChart(containerId, data) {
    var chartDom = document.querySelector('#' + containerId);
    if (!chartDom) return;

    var existingInstance = echarts.getInstanceByDom(chartDom);
    if (existingInstance) {
        existingInstance.dispose();
    }

    var myChart = echarts.init(chartDom);
    var mode = window.currentWeeklyTrendMode || 'overview';
    var tf = window.currentWeeklyTimeframe || '12W';

    var totalWeeks = data.weeks ? data.weeks.length : 0;
    var startIdx = 0;
    if (tf === '4W') {
        startIdx = Math.max(0, totalWeeks - 4);
    } else if (tf === '12W') {
        startIdx = Math.max(0, totalWeeks - 12);
    } else {
        startIdx = 0; // ALL
    }
    var endIdx = Math.max(0, totalWeeks - 1);

    var vendorColorPalette = [
        '#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#f87171',
        '#818cf8', '#2dd4bf', '#fb923c', '#e879f9', '#94a3b8',
        '#60a5fa', '#4ade80', '#f472b6', '#cbd5e1'
    ];

    function getVendorColor(vendorName, index) {
        if (typeof index === 'number' && index >= 0) {
            return vendorColorPalette[index % vendorColorPalette.length];
        }
        var hash = 0;
        var str = String(vendorName || '');
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        var hue = Math.abs(hash) % 360;
        return 'hsl(' + hue + ', 65%, 60%)';
    }

    var legendItems = [];
    var seriesList = [];

    if (mode === 'overview') {
        legendItems = ['New PT', 'Implemented PT', 'Closed PT', 'Pending PT', 'Over SLA', 'Within SLA'];
        seriesList = [
            {
                name: 'New PT',
                type: 'bar',
                yAxisIndex: 0,
                data: data.newPT,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#38bdf8' },
                        { offset: 1, color: 'rgba(56, 189, 248, 0.4)' }
                    ]),
                    borderRadius: [3, 3, 0, 0]
                },
                barWidth: '16%',
                barGap: '20%',
                label: {
                    show: true,
                    position: 'top',
                    color: '#38bdf8',
                    fontSize: 9,
                    fontWeight: '600',
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            },
            {
                name: 'Implemented PT',
                type: 'bar',
                yAxisIndex: 0,
                data: data.implementPT,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#a855f7' },
                        { offset: 1, color: 'rgba(168, 85, 247, 0.4)' }
                    ]),
                    borderRadius: [3, 3, 0, 0]
                },
                barWidth: '16%',
                barGap: '20%',
                label: {
                    show: true,
                    position: 'top',
                    color: '#c084fc',
                    fontSize: 9,
                    fontWeight: '600',
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            },
            {
                name: 'Closed PT',
                type: 'bar',
                yAxisIndex: 0,
                data: data.closedPT,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#10b981' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.4)' }
                    ]),
                    borderRadius: [3, 3, 0, 0]
                },
                barWidth: '16%',
                barGap: '20%',
                label: {
                    show: true,
                    position: 'top',
                    color: '#10b981',
                    fontSize: 9,
                    fontWeight: '600',
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            },
            {
                name: 'Pending PT',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                symbol: 'circle',
                symbolSize: 5,
                showSymbol: false,
                data: data.pendingPT,
                itemStyle: { color: '#fbbf24' },
                lineStyle: { width: 2, color: '#fbbf24' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(251, 191, 36, 0.28)' },
                        { offset: 0.8, color: 'rgba(251, 191, 36, 0.04)' },
                        { offset: 1, color: 'rgba(251, 191, 36, 0.0)' }
                    ])
                },
                label: {
                    show: true,
                    position: 'top',
                    color: '#fbbf24',
                    fontSize: 10,
                    fontWeight: '600',
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            },
            {
                name: 'Over SLA',
                type: 'line',
                yAxisIndex: 0,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                showSymbol: false,
                data: data.overSla,
                itemStyle: { color: '#f43f5e' },
                lineStyle: { width: 1.75, type: 'dashed', color: '#f43f5e' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(244, 63, 94, 0.2)' },
                        { offset: 0.8, color: 'rgba(244, 63, 94, 0.02)' },
                        { offset: 1, color: 'rgba(244, 63, 94, 0.0)' }
                    ])
                },
                label: {
                    show: true,
                    position: 'top',
                    color: '#f43f5e',
                    fontSize: 9,
                    fontWeight: '600',
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            },
            {
                name: 'Within SLA',
                type: 'line',
                yAxisIndex: 0,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                showSymbol: false,
                data: data.slaAchievement,
                itemStyle: { color: '#34d399' },
                lineStyle: { width: 1.75, type: 'dotted', color: '#34d399' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(52, 211, 153, 0.18)' },
                        { offset: 0.8, color: 'rgba(52, 211, 153, 0.02)' },
                        { offset: 1, color: 'rgba(52, 211, 153, 0.0)' }
                    ])
                },
                label: {
                    show: true,
                    position: 'top',
                    color: '#34d399',
                    fontSize: 9,
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            }
        ];
    } else {
        var partyKeys = Object.keys(data.pendingByPartySeries || {});
        var activePartiesWithData = partyKeys.filter(function (party) {
            var arr = data.pendingByPartySeries[party];
            return arr && arr.some(function (val) { return val > 0; });
        });

        if (activePartiesWithData.length === 0) {
            activePartiesWithData = partyKeys.length > 0 ? [partyKeys[0]] : ['Pending PT'];
        }

        activePartiesWithData.forEach(function (party) {
            legendItems.push('Pending (' + party + ')');
        });

        activePartiesWithData.forEach(function (party, idx) {
            var seriesColor = getVendorColor(party, idx);
            var seriesData = data.pendingByPartySeries[party] || [];

            seriesList.push({
                name: 'Pending (' + party + ')',
                type: 'line',
                yAxisIndex: 0,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                showSymbol: false,
                data: seriesData,
                itemStyle: { color: seriesColor },
                lineStyle: { width: 1.75, color: seriesColor },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: hexToRgbaStr(seriesColor, 0.25) },
                        { offset: 0.8, color: hexToRgbaStr(seriesColor, 0.03) },
                        { offset: 1, color: hexToRgbaStr(seriesColor, 0.0) }
                    ])
                },
                label: {
                    show: true,
                    position: 'top',
                    color: seriesColor,
                    fontSize: 10,
                    fontWeight: '600',
                    formatter: function (p) { return p.value > 0 ? p.value : ''; }
                }
            });
        });
    }

    // Buat susunan yAxis dinamis sesuai mode
    var yAxisConfig = [];
    if (mode === 'overview') {
        yAxisConfig = [
            {
                type: 'value',
                name: 'Weekly Volume',
                nameGap: 10,
                nameTextStyle: { color: '#8b949e' },
                axisLine: { lineStyle: { color: '#30363d' } },
                axisLabel: { color: '#8b949e', margin: 6 },
                splitLine: { lineStyle: { color: '#30363d' } }
            },
            {
                type: 'value',
                name: 'Pending',
                nameGap: 10,
                nameTextStyle: { color: '#ffd000', padding: [0, 15, 0, 0] },
                position: 'right',
                axisLine: { lineStyle: { color: '#ffd000' } },
                axisLabel: { color: '#ffd000', margin: 4 },
                splitLine: { show: false }
            }
        ];
    } else {
        // Mode Vendor Breakdown: 1 Sumbu Y Kanan meppet untuk Pending PT per Vendor
        yAxisConfig = [
            {
                type: 'value',
                name: 'Pending PT',
                nameGap: 10,
                position: 'right',
                nameTextStyle: { color: '#ffd000' },
                axisLine: { lineStyle: { color: '#ffd000' } },
                axisLabel: { color: '#ffd000', margin: 4 },
                splitLine: { lineStyle: { color: '#30363d' } }
            }
        ];
    }

    var option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            backgroundColor: '#121215',
            borderColor: '#222227',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#f4f4f5', fontSize: 12 },
            extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 6px;',
            confine: true,
            formatter: function (params) {
                if (!params || params.length === 0) return '';
                var dataIndex = params[0].dataIndex;
                var weekLabel = params[0].name;
                var rangeStr = data.ranges && data.ranges[dataIndex] ? data.ranges[dataIndex] : '';
                var html = '<div style="font-weight: bold; margin-bottom: 6px; color: #f4f4f5; border-bottom: 1px solid #222227; padding-bottom: 4px;">' + weekLabel + ' (' + rangeStr + ')</div>';
                params.forEach(function (p) {
                    var val = p.value;
                    if (p.seriesName.indexOf('%') !== -1) {
                        val = val + '%';
                    }
                    html += '<div style="display: flex; justify-content: space-between; gap: 16px; margin: 3px 0; color: #d4d4d8;"><span>' + p.marker + ' ' + p.seriesName + '</span><span style="font-weight: bold; color: #ffffff;">' + val + '</span></div>';
                });
                return html;
            }
        },
        legend: {
            data: legendItems,
            selectedMode: true,
            type: 'scroll',
            textStyle: {
                color: '#c9d1d9',
                fontSize: 11
            },
            top: '1%',
            itemGap: 15
        },
        grid: {
            top: '18%',
            left: '2%',
            right: mode === 'overview' ? '2%' : '1.5%',
            bottom: '12%',
            containLabel: true
        },
        dataZoom: [
            {
                type: 'slider',
                show: true,
                startValue: startIdx,
                endValue: endIdx,
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
                startValue: startIdx,
                endValue: endIdx
            }
        ],
        xAxis: [
            {
                type: 'category',
                boundaryGap: ['2%', '2%'],
                data: data.weeks,
                axisLine: { lineStyle: { color: '#30363d' } },
                axisLabel: { color: '#8b949e' }
            }
        ],
        yAxis: yAxisConfig,
        series: seriesList
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
        textStyle: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: '#121215',
            borderColor: '#222227',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#f4f4f5', fontSize: 12, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
            extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 6px;',
            confine: true
        },
        grid: {
            top: '4%',
            left: '2%',
            right: '20%',
            bottom: '4%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#27272a' } },
            axisLabel: { color: '#a1a1aa', fontSize: 11, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
            splitLine: { lineStyle: { color: '#222227' } }
        },
        yAxis: {
            type: 'category',
            data: yAxisData,
            axisLine: { lineStyle: { color: '#27272a' } },
            axisLabel: { color: '#f4f4f5', fontSize: 11, fontWeight: 500, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
        },
        series: [
            {
                name: 'Top Root Cause',
                type: 'bar',
                data: seriesData,
                itemStyle: {
                    color: function (params) {
                        var baseColor = colors[params.dataIndex] || '#58a6ff';
                        return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: hexToRgbaStr(baseColor, 0.35) },
                            { offset: 1, color: baseColor }
                        ]);
                    },
                    borderRadius: [0, 4, 4, 0]
                },
                barMaxWidth: 24,
                label: {
                    show: true,
                    position: 'right',
                    formatter: function (params) {
                        var val = params.value;
                        var pct = totalSum ? Math.round((val / totalSum) * 1000) / 10 + '%' : '0%';
                        return val + ' (' + pct + ')';
                    },
                    color: '#e4e4e7',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    distance: 8
                }
            }
        ]
    };

    myChart.setOption(option);

    myChart.off('click');
    myChart.on('click', function (params) {
        if (params && params.name) {
            showSubRootCauseModal(params.name);
        }
    });

    if (_echartsResizeHandlers[containerId]) window.removeEventListener('resize', _echartsResizeHandlers[containerId]);
    _echartsResizeHandlers[containerId] = function () { myChart.resize(); };
    window.addEventListener('resize', _echartsResizeHandlers[containerId]);
}

function showSubRootCauseModal(rootCauseCategory) {
    initDetailModalDOM();
    var modal = document.getElementById('customDetailModal');
    var body = document.getElementById('customModalBodyContent');
    if (!modal || !body) return;

    var titleEl = modal.querySelector('.custom-modal-title');
    if (titleEl) titleEl.innerText = 'Sub Root Cause Breakdown — ' + String(rootCauseCategory).toUpperCase();

    var allTickets = (window.ticketsPagination && window.ticketsPagination.tickets) || [];
    var filteredTickets = allTickets.filter(function (t) {
        if (getStatusCategory(t) === 'canceled') return false;
        var cat = getRootCauseLabel(t.root_cause || t.rootcause || t.cause || '');
        return cat.toLowerCase() === String(rootCauseCategory).toLowerCase();
    });

    var subMap = {};
    filteredTickets.forEach(function (t) {
        var subName = t.sub_root_cause ? String(t.sub_root_cause).trim() : 'Unspecified Detail';
        if (!subName) subName = 'Unspecified Detail';
        if (!subMap[subName]) subMap[subName] = 0;
        subMap[subName]++;
    });

    var subList = Object.keys(subMap).map(function (k) {
        return { name: k, count: subMap[k] };
    }).sort(function (a, b) { return b.count - a.count; });

    var totalCat = filteredTickets.length;

    var html = '<div style="margin-bottom:16px; font-size:13px; color:#a1a1aa;">';
    html += 'Total Tickets (' + rootCauseCategory + '): <strong style="color:#f0f6fc;">' + totalCat + ' Tickets</strong>';
    html += '</div>';

    if (subList.length === 0) {
        html += '<div style="padding:20px; text-align:center; color:#8b949e;">No Sub Root Cause data available.</div>';
    } else {
        html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
        html += '<thead><tr style="border-bottom:1px solid #27272a; color:#a1a1aa; text-align:left;">';
        html += '<th style="padding:8px 12px;">Sub Root Cause Detail</th>';
        html += '<th style="padding:8px 12px; text-align:right;">Ticket Count</th>';
        html += '<th style="padding:8px 12px; text-align:right;">Percentage</th>';
        html += '</tr></thead><tbody>';

        subList.forEach(function (item) {
            var pct = totalCat ? ((item.count / totalCat) * 100).toFixed(1) + '%' : '0%';
            html += '<tr style="border-bottom:1px solid #18181b;">';
            html += '<td style="padding:10px 12px; color:#e4e4e7; font-weight:600;">' + item.name + '</td>';
            html += '<td style="padding:10px 12px; text-align:right; color:#58a6ff; font-weight:700;">' + item.count + '</td>';
            html += '<td style="padding:10px 12px; text-align:right; color:#3fb950; font-weight:600;">' + pct + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
    }

    body.innerHTML = html;
    modal.style.display = 'flex';
}

function renderSlaComplianceTable(containerId, donutRows, tableRows) {
    var wrapper = document.querySelector('#' + containerId);
    if (!wrapper) return;

    var totalPT = 0;
    var totalWithin = 0;
    var totalOver = 0;

    var partyPalette = ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#2dd4bf', '#94a3b8'];
    var partyColorMap = {};

    (donutRows || []).forEach(function (row, idx) {
        partyColorMap[row.party] = partyPalette[idx % partyPalette.length];
        totalPT += row.total;
        totalWithin += row.within;
        totalOver += row.over;
    });

    var withinData = [];
    var overData = [];

    (donutRows || []).forEach(function (row) {
        if (row.within > 0) {
            withinData.push({ name: row.party, value: row.within, itemStyle: { color: partyColorMap[row.party] } });
        }
        if (row.over > 0) {
            overData.push({ name: row.party, value: row.over, itemStyle: { color: partyColorMap[row.party] } });
        }
    });

    var tableTotalPT = 0;
    var tableTotalWithin = 0;
    var tableTotalOver = 0;
    (tableRows || []).forEach(function (row) {
        tableTotalPT += row.total;
        tableTotalWithin += row.within;
        tableTotalOver += row.over;
    });
    var tableTotalAch = tableTotalPT ? ((tableTotalWithin / tableTotalPT) * 100).toFixed(1) + '%' : '0.0%';

    var html = '<div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">';
    html += '  <!-- 2 Donut Charts + Party Breakdown Legend Container -->';
    html += '  <div style="display:flex; flex-direction:column; align-items:center; flex-shrink:0; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">';
    html += '    <div style="display:flex; gap:12px;">';
    html += '      <div style="display:flex; flex-direction:column; align-items:center; width:130px;">';
    html += '        <div id="chartSlaComplianceWithinDonut" style="width:130px; height:130px;"></div>';
    html += '        <span style="color:#3fb950; font-size:11px; font-weight:700; margin-top:2px;">Within SLA (' + totalWithin + ')</span>';
    html += '      </div>';
    html += '      <div style="display:flex; flex-direction:column; align-items:center; width:130px;">';
    html += '        <div id="chartSlaComplianceOverDonut" style="width:130px; height:130px;"></div>';
    html += '        <span style="color:#ff7b72; font-size:11px; font-weight:700; margin-top:2px;">Over SLA (' + totalOver + ')</span>';
    html += '      </div>';
    html += '    </div>';

    // Registered Party Breakdown Legend under 2 Donut Charts
    html += '    <div style="margin-top:10px; width:100%; border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px; display:flex; flex-direction:column; gap:4px;">';
    html += '      <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#8b949e; margin-bottom:2px; text-align:center;">Registered Party Share (% of Total PT)</div>';

    (donutRows || []).forEach(function (row) {
        var partySharePct = totalPT > 0 ? ((row.total / totalPT) * 100).toFixed(1) + '%' : '0.0%';
        var color = partyColorMap[row.party] || '#8b949e';
        html += '      <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; padding:2px 4px; background:rgba(0,0,0,0.2); border-radius:4px;">';
        html += '        <span style="display:flex; align-items:center; gap:6px; font-weight:600; color:#e4e4e7;">';
        html += '          <span style="display:inline-block; width:8px; height:8px; background:' + color + '; border-radius:2px;"></span>';
        html += '          ' + row.party;
        html += '        </span>';
        html += '        <span style="font-weight:700; color:' + color + ';">' + partySharePct + ' <span style="font-weight:normal; color:#8b949e; font-size:9px;">(' + row.total + ' PT)</span></span>';
        html += '      </div>';
    });

    html += '    </div>';
    html += '  </div>';

    html += '  <!-- Compliance Table -->';
    html += '  <div style="flex:1; min-width:240px; overflow-x:auto;">';
    html += '    <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#8b949e; margin-bottom:4px; text-align:center;">CLOSED PT</div>';
    html += '    <table class="custom-compliance-table" style="width:100%; font-size:11px;">';
    html += '      <thead>';
    html += '        <tr>';
    html += '          <th style="text-align:left;">Party</th>';
    html += '          <th>Total PT</th>';
    html += '          <th>Within SLA</th>';
    html += '          <th>Over SLA</th>';
    html += '          <th>SLA Ach</th>';
    html += '        </tr>';
    html += '      </thead>';
    html += '      <tbody>';

    (tableRows || []).forEach(function (row) {
        var achPct = parseFloat(row.ach);
        var achClass = 'custom-ach-success';
        if (achPct < 90) achClass = 'custom-ach-danger';
        else if (achPct < 95) achClass = 'custom-ach-warning';

        var color = partyColorMap[row.party] || '#e4e4e7';

        html += '        <tr>';
        html += '          <td class="custom-party-name" style="text-align:left; font-weight:600;"><span style="display:inline-block; width:6px; height:6px; background:' + color + '; border-radius:50%; margin-right:5px;"></span>' + row.party + '</td>';
        html += '          <td>' + row.total + '</td>';
        html += '          <td>' + row.within + '</td>';
        html += '          <td style="color:#ff7b72; font-weight:700;">' + row.over + '</td>';
        html += '          <td class="' + achClass + '">' + row.ach + '</td>';
        html += '        </tr>';
    });

    var totalAchPct = parseFloat(tableTotalAch);
    var totalAchClass = 'custom-ach-success';
    if (totalAchPct < 90) totalAchClass = 'custom-ach-danger';
    else if (totalAchPct < 95) totalAchClass = 'custom-ach-warning';

    html += '        <tr class="custom-total-row">';
    html += '          <td style="text-align:left;">TOTAL</td>';
    html += '          <td>' + tableTotalPT + '</td>';
    html += '          <td>' + tableTotalWithin + '</td>';
    html += '          <td style="color:#ff7b72; font-weight:700;">' + tableTotalOver + '</td>';
    html += '          <td class="' + totalAchClass + '">' + tableTotalAch + '</td>';
    html += '        </tr>';

    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '</div>';

    wrapper.innerHTML = html;

    // Render 2 Donut Charts (Within SLA Breakdown vs Over SLA Breakdown by Party)
    if (typeof echarts !== 'undefined') {
        // Chart 1: Within SLA by Party
        var withinDom = document.getElementById('chartSlaComplianceWithinDonut');
        if (withinDom) {
            var existingInst1 = echarts.getInstanceByDom(withinDom);
            if (existingInst1) existingInst1.dispose();
            var chartWithin = echarts.init(withinDom);
            chartWithin.setOption({
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)',
                    backgroundColor: '#121215',
                    borderColor: '#222227',
                    borderWidth: 1,
                    padding: [8, 12],
                    textStyle: { color: '#f4f4f5', fontSize: 12 },
                    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 6px;',
                    confine: true
                },
                series: [{
                    name: 'Within SLA',
                    type: 'pie',
                    radius: ['55%', '85%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    labelLine: { show: false },
                    data: withinData.length > 0 ? withinData : [{ name: 'No Data', value: 0, itemStyle: { color: '#333' } }]
                }],
                graphic: [{
                    type: 'text', left: 'center', top: '42%',
                    style: { text: String(totalWithin), textAlign: 'center', fill: '#3fb950', fontSize: 15, fontWeight: 'bold' }
                }, {
                    type: 'text', left: 'center', top: '62%',
                    style: { text: 'Within', textAlign: 'center', fill: '#8b949e', fontSize: 9 }
                }]
            });
        }

        // Chart 2: Over SLA by Party
        var overDom = document.getElementById('chartSlaComplianceOverDonut');
        if (overDom) {
            var existingInst2 = echarts.getInstanceByDom(overDom);
            if (existingInst2) existingInst2.dispose();
            var chartOver = echarts.init(overDom);
            chartOver.setOption({
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)',
                    backgroundColor: '#121215',
                    borderColor: '#222227',
                    borderWidth: 1,
                    padding: [8, 12],
                    textStyle: { color: '#f4f4f5', fontSize: 12 },
                    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 6px;',
                    confine: true
                },
                series: [{
                    name: 'Over SLA',
                    type: 'pie',
                    radius: ['55%', '85%'],
                    avoidLabelOverlap: false,
                    label: { show: false },
                    labelLine: { show: false },
                    data: overData.length > 0 ? overData : [{ name: 'No Data', value: 0, itemStyle: { color: '#333' } }]
                }],
                graphic: [{
                    type: 'text', left: 'center', top: '42%',
                    style: { text: String(totalOver), textAlign: 'center', fill: '#ff7b72', fontSize: 15, fontWeight: 'bold' }
                }, {
                    type: 'text', left: 'center', top: '62%',
                    style: { text: 'Over', textAlign: 'center', fill: '#8b949e', fontSize: 9 }
                }]
            });
        }
    }
}

function formatEnglishDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;

    var year = parts[0];
    var monthIndex = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    var months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
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

    var activeEl = document.querySelector('.custom-filter-active-range');
    if (activeEl) {
        var dateText = (startInput && endInput) ? (formatEnglishDate(startInput) + ' - ' + formatEnglishDate(endInput)) : 'All Time';
        var partyText = (partyInput === 'ALL') ? 'All Party' : partyInput;
        activeEl.innerText = 'Active: ' + dateText + ' | Party: ' + partyText;
    }

    loadProblemTickets(startParam, endParam, partyInput);
}

function resetDateFilter() {
    var startEl = document.querySelector('.custom-filter-start-input');
    var endEl = document.querySelector('.custom-filter-end-input');
    var partyEl = document.querySelector('.custom-filter-party-input');
    var rangeEl = document.querySelector('.custom-filter-range-input');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (partyEl) partyEl.value = 'ALL';
    if (rangeEl) rangeEl.value = '';

    var activeEl = document.querySelector('.custom-filter-active-range');
    if (activeEl) {
        activeEl.innerText = 'Active: All Time | Party: All Party';
    }

    loadProblemTickets(null, null, 'ALL');
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK RANGE FILTER (Minggu: Kamis → Rabu)
// ─────────────────────────────────────────────────────────────────────────────

function formatDateInput(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}

// Kembalikan tanggal Kamis yang menjadi awal minggu (Thu = day 4, JS: Sun=0)
function getWeekStartThursday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var offset = (d.getDay() - 4 + 7) % 7;
    d.setDate(d.getDate() - offset);
    return d;
}

function computeQuickRange(option) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    if (option === 'today') {
        return { start: formatDateInput(today), end: formatDateInput(today) };
    }

    var weekStart = getWeekStartThursday(); // Kamis minggu ini

    if (option === 'current_week') {
        var wEnd = new Date(weekStart);
        wEnd.setDate(wEnd.getDate() + 6);
        return { start: formatDateInput(weekStart), end: formatDateInput(wEnd) };
    }

    if (option === 'last_1_week') {
        var l1s = new Date(weekStart);
        l1s.setDate(l1s.getDate() - 7);
        var l1e = new Date(weekStart);
        l1e.setDate(l1e.getDate() - 1);
        return { start: formatDateInput(l1s), end: formatDateInput(l1e) };
    }

    if (option === 'last_2_weeks') {
        var l2s = new Date(weekStart);
        l2s.setDate(l2s.getDate() - 14);
        var l2e = new Date(weekStart);
        l2e.setDate(l2e.getDate() - 1);
        return { start: formatDateInput(l2s), end: formatDateInput(l2e) };
    }

    return null;
}

function onQuickRangeChange() {
    var sel = document.querySelector('.custom-filter-range-input');
    if (!sel || !sel.value) return;

    var range = computeQuickRange(sel.value);
    if (!range) return;

    var startEl = document.querySelector('.custom-filter-start-input');
    var endEl = document.querySelector('.custom-filter-end-input');
    if (startEl) startEl.value = range.start;
    if (endEl) endEl.value = range.end;

    applyDateFilter();
}
window.onQuickRangeChange = onQuickRangeChange;

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
        '  <div class="custom-filter-title-row">' +
        '    <div class="custom-filter-title">Filter by Date Range & Responsibility Party</div>' +
        '    <div class="custom-filter-active-range">Active: All Time | Party: All Party</div>' +
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
        '      <label>Quick Range</label>' +
        '      <select class="custom-filter-range-input" onchange="onQuickRangeChange()">' +
        '        <option value="">Custom</option>' +
        '        <option value="today">Today</option>' +
        '        <option value="current_week">Current Week</option>' +
        '        <option value="last_1_week">Last 1 Week</option>' +
        '        <option value="last_2_weeks">Last 2 Weeks</option>' +
        '      </select>' +
        '    </div>' +
        '    <div class="custom-filter-field">' +
        '      <label>Party</label>' +
        '      <select class="custom-filter-party-input">' +
        partyOptionsHtml +
        '      </select>' +
        '    </div>' +
        '    <div class="custom-filter-actions">' +
        '      <button onclick="applyDateFilter()" class="custom-btn-apply custom-btn-apply-filter">Apply Filter</button>' +
        '      <button onclick="resetDateFilter()" class="custom-btn-reset custom-btn-reset-filter">Reset</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
}

function initDetailModalDOM() {
    if (!document.getElementById('custom-modal-dynamic-style')) {
        var dynamicStyle = document.createElement('style');
        dynamicStyle.id = 'custom-modal-dynamic-style';
        dynamicStyle.innerHTML =
            '.custom-modal { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; display: none; align-items: center !important; justify-content: center !important; z-index: 999999 !important; box-sizing: border-box !important; padding: 20px !important; } ' +
            '.custom-modal-backdrop { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background-color: rgba(6, 6, 8, 0.8) !important; backdrop-filter: blur(4px) !important; z-index: 999998 !important; } ' +
            '.custom-modal-content { position: relative !important; background-color: #121215 !important; border: 1px solid #222227 !important; border-radius: 8px !important; width: 720px !important; max-width: 95vw !important; max-height: 85vh !important; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75) !important; display: flex !important; flex-direction: column !important; color: #f4f4f5 !important; z-index: 1000000 !important; overflow: hidden !important; } ' +
            '.custom-modal-header { padding: 12px 18px !important; border-bottom: 1px solid #222227 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; background-color: #121215 !important; } ' +
            '.custom-modal-title { margin: 0 !important; font-size: 14px !important; font-weight: 650 !important; color: #f4f4f5 !important; } ' +
            '.custom-modal-close { background: #1a1a1e !important; border: 1px solid #282830 !important; color: #a1a1aa !important; border-radius: 6px !important; width: 26px !important; height: 26px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; line-height: 1 !important; cursor: pointer !important; padding: 0 !important; } ' +
            '.custom-modal-close:hover { background: #27272f !important; color: #ffffff !important; border-color: #3f3f46 !important; } ' +
            '.custom-modal-body { padding: 18px !important; overflow-y: auto !important; font-size: 12.5px !important; line-height: 1.5 !important; } ' +
            '.custom-detail-grid { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 14px 20px !important; margin-bottom: 16px !important; } ' +
            '.custom-detail-item { display: flex !important; flex-direction: column !important; gap: 4px !important; } ' +
            '.custom-detail-label { font-size: 11px !important; font-weight: 600 !important; color: #a1a1aa !important; text-transform: uppercase !important; letter-spacing: 0.4px !important; } ' +
            '.custom-detail-value { font-size: 13px !important; font-weight: 500 !important; color: #f4f4f5 !important; word-break: break-word !important; } ' +
            '.custom-detail-desc-block { border-top: 1px solid #222227 !important; padding-top: 14px !important; margin-top: 14px !important; }';
        document.head.appendChild(dynamicStyle);
    }

    var modalDiv = document.getElementById('customDetailModal');
    if (!modalDiv) {
        modalDiv = document.createElement('div');
        modalDiv.id = 'customDetailModal';
        modalDiv.className = 'custom-modal';
        modalDiv.style.display = 'none';
        modalDiv.innerHTML =
            '<div class="custom-modal-backdrop" onclick="closeTicketDetailModal()"></div>' +
            '<div class="custom-modal-content">' +
            '  <div class="custom-modal-header">' +
            '    <h3 class="custom-modal-title">Problem Ticket Details</h3>' +
            '    <button class="custom-modal-close" onclick="closeTicketDetailModal()" title="Close">&times;</button>' +
            '  </div>' +
            '  <div class="custom-modal-body" id="customModalBodyContent"></div>' +
            '</div>';
        var wrapper = document.querySelector('.custom-dashboard-wrapper') || document.body;
        wrapper.appendChild(modalDiv);
    }

    if (!window._modalEscBound) {
        window._modalEscBound = true;
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                closeTicketDetailModal();
            }
        });
    }
}

function showTicketDetailModal(ticketId) {
    initDetailModalDOM();
    var modal = document.getElementById('customDetailModal');
    if (modal) {
        var titleEl = modal.querySelector('.custom-modal-title');
        if (titleEl) titleEl.innerText = 'Problem Ticket Details';
    }
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
    var createTime = formatToUTC7(ticket.createtime);
    var lastUpdate = formatToUTC7(ticket.lastupdatetime);
    var closeTime = formatToUTC7(ticket.closetime);
    var phase = ticket.current_phase || '-';
    var assign = extractOWSField(ticket.createptassignto || '') || '-';
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

    var lastOperator = ticket.lastoperator || '-';

    var html = '<div style="margin-bottom:16px;">';
    html += '  <h4 style="margin:0 0 6px 0; color:#f0f6fc; font-size:15px; font-weight:600;">' + title + '</h4>';
    html += '</div>';

    html += '<div class="custom-detail-grid">';
    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">TICKET ID</span>';
    html += '    <div><span class="custom-ticket-id-badge">' + ticketId + ' <button type="button" class="custom-copy-btn" title="Copy Ticket ID" onclick="event.stopPropagation(); copyTicketIdToClipboard(\'' + ticketId + '\', this);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></span></div>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">STATUS</span>';
    html += '    <div><span class="custom-badge-status ' + statusClass + '">' + status + '</span></div>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">SEVERITY</span>';
    html += '    <div><span class="custom-badge-severity ' + sevClass + '">' + sevLabel + '</span></div>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">ROOT CAUSE</span>';
    html += '    <span class="custom-detail-value" style="font-weight:600; color:#ef4444; text-transform:uppercase;">' + rc + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">AGING DAYS</span>';
    html += '    <span class="custom-detail-value" style="font-weight:600; color:#10b981;">' + parseFloat(agingVal).toFixed(2) + ' Days</span>';
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
    html += '    <span class="custom-detail-label">LAST OPERATOR</span>';
    html += '    <span class="custom-detail-value">' + lastOperator + '</span>';
    html += '  </div>';

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">ORIGINATOR</span>';
    html += '    <span class="custom-detail-value">' + originator + '</span>';
    html += '  </div>';

    var planDate = formatToUTC7(ticket.implhandleplandate);

    html += '  <div class="custom-detail-item">';
    html += '    <span class="custom-detail-label">PLAN DATE</span>';
    html += '    <span class="custom-detail-value">' + planDate + '</span>';
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
    html += '  <div style="background:#09090b; border:1px solid #222227; border-radius:6px; padding:12px; font-size:12.5px; color:#f4f4f5; white-space:pre-wrap; word-break:break-word; max-height:120px; overflow-y:auto;">' + desc + '</div>';
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

function handleTicketSearchFilter() {
    if (_searchDebounceTimer) {
        clearTimeout(_searchDebounceTimer);
    }
    _searchDebounceTimer = setTimeout(function () {
        executeTicketSearchFilter();
    }, 300);
}

function executeTicketSearchFilter() {
    var searchEl = document.getElementById('customTicketSearchInput');
    var phaseEl = document.getElementById('customTicketPhaseFilter');

    var query = searchEl ? searchEl.value.trim().toLowerCase() : '';
    var phase = phaseEl ? phaseEl.value : 'ALL';
    window.selectedPhaseFilter = phase;

    var rawList = window.activeFilteredTickets || [];

    var filtered = rawList.filter(function (t) {
        // 1. Phase Filter Check
        if (phase !== 'ALL') {
            if (phase === 'SLA Paused') {
                var sp = String(t.slapausing || t.slapaused || '').toLowerCase();
                if (sp !== 'yes' && sp !== 'true' && sp !== '1') return false;
            } else {
                var statusCat = getStatusCategory(t);
                var tPhase = '1. Create PT';

                if (statusCat === 'closed') {
                    tPhase = '7. Closed PT';
                } else if (statusCat === 'canceled') {
                    tPhase = '8. Canceled PT';
                } else {
                    var phaseRaw = String(t.current_phase || t.state || '').toLowerCase();

                    if (phaseRaw.indexOf('confirm') !== -1) {
                        tPhase = '6. Confirm PT';
                    } else if (phaseRaw.indexOf('handle analyze') !== -1) {
                        tPhase = '2. Handle Analyze PT';
                    } else if (phaseRaw.indexOf('analyze') !== -1) {
                        tPhase = '3. Analyze PT';
                    } else if (phaseRaw.indexOf('handle implement') !== -1) {
                        tPhase = '4. Handle Implement PT';
                    } else if (phaseRaw.indexOf('implement') !== -1) {
                        tPhase = '5. Implement PT';
                    }
                }

                if (tPhase !== phase) return false;
            }
        }

        // 2. Keyword Search Check
        if (query) {
            var matchFound = false;
            for (var key in t) {
                if (t.hasOwnProperty(key)) {
                    var val = t[key];
                    if (val !== null && val !== undefined) {
                        if (String(val).toLowerCase().indexOf(query) !== -1) {
                            matchFound = true;
                            break;
                        }
                    }
                }
            }
            if (!matchFound) return false;
        }

        return true;
    });

    window.ticketsPagination.tickets = filtered;
    window.ticketsPagination.currentPage = 1;
    renderCurrentTicketsPage();
}

function copyTicketIdToClipboard(text, btnEl) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            if (btnEl) {
                btnEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(function () {
                    btnEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                }, 1500);
            }
        });
    } else {
        var temp = document.createElement('input');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
    }
}

// Global Explicit Window Exports for GDE Scope Bypass
window.applyDateFilter = applyDateFilter;
window.resetDateFilter = resetDateFilter;
window.prevTicketsPage = prevTicketsPage;
window.nextTicketsPage = nextTicketsPage;
window.gotoTicketsPage = gotoTicketsPage;
window.changeTicketsPageSize = changeTicketsPageSize;
window.showTicketDetailModal = showTicketDetailModal;
window.showSubRootCauseModal = showSubRootCauseModal;
window.closeTicketDetailModal = closeTicketDetailModal;
window.copyTicketIdToClipboard = copyTicketIdToClipboard;
window.startLiveClock = startLiveClock;
window.isTicketAccepted = isTicketAccepted;
window.isTicketClosed = isTicketClosed;
window.getConfirmSubmitTime = getConfirmSubmitTime;
window.handleTicketSearch = handleTicketSearchFilter;
window.handleTicketSearchFilter = handleTicketSearchFilter;

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
    var registeredLowers = registered.map(function (p) { return p.toLowerCase(); });
    var mappings = PartyManager.getPartyMappings();

    // 1. Update Selected Count Badge
    var countDom = document.getElementById('activePartiesCount');
    if (countDom) countDom.innerText = registered.length + ' Selected';

    // 2. Render Selected Vendors Table (Right Table)
    var selectedContainer = document.getElementById('registeredPartiesTagList');
    if (selectedContainer) {
        selectedContainer.innerHTML = '';
        var tableSel = document.createElement('table');
        tableSel.className = 'custom-config-table';

        var theadSel = document.createElement('thead');
        var trHeadSel = document.createElement('tr');
        trHeadSel.innerHTML = '<th>Selected Vendor</th><th>Status</th><th>Action</th>';
        theadSel.appendChild(trHeadSel);
        tableSel.appendChild(theadSel);

        var tbodySel = document.createElement('tbody');

        if (registered.length === 0) {
            var trEmpty = document.createElement('tr');
            var tdEmpty = document.createElement('td');
            tdEmpty.colSpan = 3;
            tdEmpty.style.cssText = 'color: #71717a; text-align: center; padding: 20px; font-size: 12px;';
            tdEmpty.innerText = 'No vendor selected. Click "+ Add" on Available Vendors.';
            trEmpty.appendChild(tdEmpty);
            tbodySel.appendChild(trEmpty);
        } else {
            registered.forEach(function (party) {
                var tr = document.createElement('tr');

                var td1 = document.createElement('td');
                td1.style.fontWeight = '600';
                td1.style.color = '#f4f4f5';
                td1.innerText = party;

                var td2 = document.createElement('td');
                var badge = document.createElement('span');
                badge.className = 'custom-badge custom-bg-success';
                badge.innerText = 'Active';
                td2.appendChild(badge);

                var td3 = document.createElement('td');
                var btnWrap = document.createElement('div');
                btnWrap.className = 'custom-btn-wrapper';

                var delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'custom-btn custom-btn-secondary';
                delBtn.style.cssText = 'font-size: 11px; padding: 3px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);';
                delBtn.innerText = 'Remove';
                delBtn.onclick = function () {
                    handleRemoveParty(party);
                };

                btnWrap.appendChild(delBtn);
                td3.appendChild(btnWrap);

                tr.appendChild(td1);
                tr.appendChild(td2);
                tr.appendChild(td3);
                tbodySel.appendChild(tr);
            });
        }

        tableSel.appendChild(tbodySel);
        selectedContainer.appendChild(tableSel);
    }

    // 3. Render Available Vendors Table (Left Table)
    refreshAutoDetectParties();
}

function handleRemoveParty(partyName) {
    PartyManager.removeParty(partyName);
    window.allTimePartnerMetrics = null;
    renderPartyConfigPage();
}

// Embedded OWS Official Vendor Mapping (from /DataSource/msup_customization_options/customization_options_vendor)
var KNOWN_VENDOR_MAP = {
    "0b5f02b9-ed39-11f0-9f6a-0255ac121583": "FiberHome",
    "19f8313f-ed39-11f0-bbb7-0255ac120452": "Comnect",
    "22972c72-4e87-11f1-8b4b-0255ac12102e": "ISP",
    "29fb01f6-ed39-11f0-803b-0255ac122060": "YNet",
    "3166e140-ed39-11f0-95f9-0255ac120037": "OREX SAI",
    "3c1c944e-ed39-11f0-95f9-0255ac120037": "Baicells",
    "47fa6464-541e-11f1-8d7d-0255ac1209a9": "MicroTik",
    "4a3d5f1b-ed39-11f0-9e05-0255ac122052": "CICT mobile",
    "52db7aff-5423-11f1-b35e-0255ac12003d": "Common",
    "53fc2e87-ed39-11f0-9e05-0255ac122052": "Protelindo",
    "58476811-541f-11f1-b35e-0255ac12003d": "OrexSai",
    "5aed389a-ed39-11f0-9388-0255ac1200af": "Tower Bersama",
    "61d9603e-ed39-11f0-803b-0255ac122060": "Centratama",
    "67a3c491-ed39-11f0-ae8e-0255ac12157b": "Persada",
    "67ebe504-7365-11f1-840a-0255ac12102e": "IFORTE",
    "731f9b37-707d-11f1-8686-0255ac120033": "Telkom Akses",
    "795f0f40-7365-11f1-93e1-0255ac120577": "Viberlink",
    "8180a97b-7365-11f1-840a-0255ac12102e": "Triasmitra",
    "909486cf-7365-11f1-93aa-0255ac120835": "TBG",
    "9c3b3a9a-54bf-11f1-a242-0255ac1215a4": "ARI",
    "a7a0a508-7365-11f1-93aa-0255ac120835": "Mandau",
    "a9991b54-e172-11f0-b28c-0255ac120410": "Outsourcing",
    "a9991b55-e172-11f0-b28c-0255ac120410": "NEC",
    "a9991b56-e172-11f0-b28c-0255ac120410": "Nokia_Siemens",
    "a9991b57-e172-11f0-b28c-0255ac120410": "Others",
    "a9991b58-e172-11f0-b28c-0255ac120410": "Sonix",
    "a9991b59-e172-11f0-b28c-0255ac120410": "Motorola",
    "a9991b5a-e172-11f0-b28c-0255ac120410": "Alcatel_Lucent",
    "a9991b5b-e172-11f0-b28c-0255ac120410": "ZTE",
    "a9991b5c-e172-11f0-b28c-0255ac120410": "Cisco",
    "a9991b5d-e172-11f0-b28c-0255ac120410": "Ericsson",
    "a9991b5e-e172-11f0-b28c-0255ac120410": "Nokia",
    "a9991b5f-e172-11f0-b28c-0255ac120410": "Huawei_M2000_corba",
    "a9991b60-e172-11f0-b28c-0255ac120410": "Nortel",
    "a9991b61-e172-11f0-b28c-0255ac120410": "Huawei",
    "a9991b62-e172-11f0-b28c-0255ac120410": "H3C",
    "a9991b63-e172-11f0-b28c-0255ac120410": "Juniper",
    "a9991b64-e172-11f0-b28c-0255ac120410": "Ruijie",
    "a9991b65-e172-11f0-b28c-0255ac120410": "Tellabs",
    "ae59600b-7365-11f1-a0a2-0255ac120459": "Kopindosat",
    "b92cd43d-7365-11f1-93e1-0255ac120577": "IJE",
    "c703767f-7365-11f1-840a-0255ac12102e": "Famika",
    "cece3ef5-7365-11f1-9bb9-0255ac1215ab": "CMI",
    "e1bb9edf-b1c1-11f1-ae01-0255ac120f4d": "WANWAN DIDIK"
};

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
    trHead.innerHTML = '<th>Vendor Name</th><th>Ticket Count</th><th>Status</th><th>Action</th>';
    thead.appendChild(trHead);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    if (keys.length === 0) {
        var trEmpty = document.createElement('tr');
        var tdEmpty = document.createElement('td');
        tdEmpty.colSpan = 4;
        tdEmpty.style.cssText = 'color: #71717a; text-align: center; padding: 20px; font-size: 12px;';
        tdEmpty.innerText = 'No vendor records found.';
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
    } else {
        keys.forEach(function (partyName) {
            var tr = document.createElement('tr');

            // Resolve Vendor Name cleanly without showing UUID
            var resolvedName = KNOWN_VENDOR_MAP[partyName] || KNOWN_VENDOR_MAP[partyName.toLowerCase()] || mappings[partyName] || mappings[partyName.toLowerCase()] || partyName;

            // isReg: exact/substring match OR UUID has a mapping entry
            var partyLower = resolvedName.toLowerCase();
            var rawLower = partyName.toLowerCase();
            var isReg = registeredLowers.some(function (r) {
                return partyLower === r || rawLower === r || partyLower.indexOf(r) !== -1 || r.indexOf(partyLower) !== -1;
            });
            // UUID mapped to an alias also counts as Registered
            if (!isReg && mappings && (mappings[partyName] || mappings[rawLower])) {
                isReg = true;
            }

            var td1 = document.createElement('td');
            td1.style.fontWeight = '600';
            td1.style.color = '#f4f4f5';
            td1.innerText = resolvedName;

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
                badge3.innerText = 'Selected';
                td3.appendChild(badge3);

                var span4 = document.createElement('span');
                span4.style.cssText = 'color: #71717a; font-size: 11px;';
                span4.innerText = 'Added';
                td4.appendChild(span4);
            } else {
                var badge3 = document.createElement('span');
                badge3.className = 'custom-badge custom-bg-warning';
                badge3.innerText = 'Available';
                td3.appendChild(badge3);

                var btnWrap = document.createElement('div');
                btnWrap.className = 'custom-btn-wrapper';

                var addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'custom-btn custom-btn-primary';
                addBtn.style.cssText = 'font-size: 11px; padding: 3px 10px;';
                addBtn.innerText = '+ Add';
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

    var vendorName = KNOWN_VENDOR_MAP[rawPartyName] || KNOWN_VENDOR_MAP[rawPartyName.toLowerCase()] || rawPartyName;

    // 1-Click Register: automatically map UUID to the official vendor name and register it directly
    if (rawPartyName.length > 20 && rawPartyName.indexOf('-') !== -1) {
        PartyManager.setMapping(rawPartyName, vendorName);
    } else {
        PartyManager.addParty(vendorName);
    }

    window.allTimePartnerMetrics = null; // Force dashboard re-compute
    renderPartyConfigPage();
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
window.formatToUTC7 = formatToUTC7;
window.sortTicketsTable = sortTicketsTable;
window.renderBackNavigation = renderBackNavigation;
window.renderPartyConfigPage = renderPartyConfigPage;
window.handleRemoveParty = handleRemoveParty;
window.refreshAutoDetectParties = refreshAutoDetectParties;
window.handleQuickAddParty = handleQuickAddParty;