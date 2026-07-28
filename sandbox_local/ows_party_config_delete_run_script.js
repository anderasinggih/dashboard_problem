/**
 * =============================================================================
 * HUAWEI OWS RUNSCRIPT BACKEND - DELETE PARTY CONFIG SERVICE
 * =============================================================================
 * Service Address Target:
 * /adc-service/rest/v1/services/gde_dashboard/problem_ticket_dashboard/problem_ticket_dashboard_party_config_delete
 * 
 * Model Target URI:
 * "/ProblemTicket/ProblemTicket/problem_ticket_dashboard_party_config"
 * =============================================================================
 */

var rawInput = _message;
if (_message && _message.Input) rawInput = _message.Input;

var input = (rawInput && rawInput.body) ? rawInput.body : (rawInput.input_params && rawInput.input_params.body ? rawInput.input_params.body : rawInput);

var ptPartyId = (input && input.pt_party_id !== undefined && input.pt_party_id !== null) ? input.pt_party_id : ((input && input.id !== undefined) ? input.id : (_message && _message.pt_party_id ? _message.pt_party_id : ""));
var partyName = (input && input.party_name) ? String(input.party_name).trim() : (_message && _message.party_name ? String(_message.party_name).trim() : "");

var modelUri = "\"/ProblemTicket/ProblemTicket/problem_ticket_dashboard_party_config\"";

var statusResult = "NO_ACTION";
var deleteTql = "";
var parameters = {};

if (ptPartyId !== "") {
    deleteTql = "delete from " + modelUri + " pt where pt.pt_party_id = $!pt_party_id or pt.raw_id = $!pt_party_id";
    parameters.pt_party_id = String(ptPartyId);
} else if (partyName !== "") {
    deleteTql = "delete from " + modelUri + " pt where lower(pt.party_name) = lower($!party_name)";
    parameters.party_name = String(partyName);
}

if (deleteTql) {
    try {
        if (typeof executeTql !== 'undefined') {
            executeTql(deleteTql, parameters);
            statusResult = "SUCCESS_EXECUTE_TQL";
        } else if (typeof ServiceInvoker !== 'undefined' && ServiceInvoker.post) {
            ServiceInvoker.post("/adc-model/rest/v1/model-instances/query-by-tql", {
                tql: deleteTql,
                parameters: parameters
            });
            statusResult = "SUCCESS_SERVICE_INVOKER";
        }
    } catch (e) {
        statusResult = "ERROR: " + e.message;
    }
}

_message.Output = {
    "result": {
        "status": statusResult,
        "deleted_party": partyName,
        "pt_party_id": ptPartyId,
        "tql": deleteTql
    }
};
