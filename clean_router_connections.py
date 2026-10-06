import json

def build_clean_2route_workflow():
    with open('working_nurture_agent.json', 'r') as f:
        wf = json.load(f)

    # 1. Configure the Router with 2 unified output handles:
    # Handle 0: approve_and_send (Bypass to Validate)
    # Handle 1: all 6 canonical campaign types + fallback (Routes to Prompt Builder)
    for node in wf['nodes']:
        if node['id'] == 'core_switch-nurture-router':
            node['data']['inputs'] = {
                "mode": "rules",
                "rules": [
                    {
                        "value1": "{{ $json.action || '' }}",
                        "value2": "approve_and_send",
                        "operator": "equal",
                        "outputIndex": 0
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "festival_wish",
                        "operator": "equal",
                        "outputIndex": 1
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "newsletter",
                        "operator": "equal",
                        "outputIndex": 1
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "promotional",
                        "operator": "equal",
                        "outputIndex": 1
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "follow_up",
                        "operator": "equal",
                        "outputIndex": 1
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "event_invitation",
                        "operator": "equal",
                        "outputIndex": 1
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "announcement",
                        "operator": "equal",
                        "outputIndex": 1
                    }
                ],
                "ignoreCase": True,
                "fallbackOutput": 1,
                "sendToAllMatches": False
            }

    # 2. Update Edges to have exactly 1 edge from output-0 to Validate and 1 edge from output-1 to Prompt Builder!
    clean_edges = [
        # Webhook -> Ingest
        {
            "id": "e-webhook-to-ingest",
            "type": "custom",
            "data": {},
            "source": "webhook-trigger-client-nurturing",
            "target": "code.execute-nurture-ingest",
            "selected": False
        },
        # Ingest -> Router
        {
            "id": "e-ingest-to-router",
            "type": "custom",
            "data": {},
            "source": "code.execute-nurture-ingest",
            "target": "core_switch-nurture-router",
            "selected": False
        },
        # Router output-0 (approve_and_send) -> Validate (Single clean top line)
        {
            "id": "e-router-out0-approve-and-send",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-1790678109627001",
            "sourceHandle": "output-0",
            "selected": False
        },
        # Router output-1 (all campaign types + preview) -> Prompt Builder (Single clean bottom line)
        {
            "id": "e-router-out1-prompt-builder",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-1",
            "selected": False
        },
        # Prompt Builder -> Groq LLM
        {
            "id": "e-prompt-builder-to-llm",
            "type": "custom",
            "data": {},
            "source": "code.execute-campaign-prompt-builder",
            "target": "groq-nurture-personalizer",
            "selected": False
        },
        # Groq LLM -> Validate & Sanitize
        {
            "id": "e-llm-to-validate",
            "type": "custom",
            "data": {},
            "source": "groq-nurture-personalizer",
            "target": "code.execute-1790678109627001",
            "selected": False
        },
        # Validate & Sanitize -> Dispatch Gate
        {
            "id": "e-validate-to-dispatch-gate",
            "type": "custom",
            "data": {},
            "source": "code.execute-1790678109627001",
            "target": "core_switch-nurture-generation-valid",
            "selected": False
        },
        # Dispatch Gate output-0 (send_allowed == true) -> SMTP Send
        {
            "id": "e-dispatch-gate-out0-smtp",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-generation-valid",
            "target": "smtp-nurture-dispatch",
            "sourceHandle": "output-0",
            "selected": False
        },
        # Dispatch Gate output-1 (send_allowed == false / preview) -> Format Response
        {
            "id": "e-dispatch-gate-out1-response",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-generation-valid",
            "target": "code.execute-format-response",
            "sourceHandle": "output-1",
            "selected": False
        },
        # SMTP Send -> Telemetry
        {
            "id": "e-smtp-to-telemetry",
            "type": "custom",
            "data": {},
            "source": "smtp-nurture-dispatch",
            "target": "code.execute-engagement-telemetry",
            "selected": False
        },
        # Telemetry -> Format Response
        {
            "id": "e-telemetry-to-format-response",
            "type": "custom",
            "data": {},
            "source": "code.execute-engagement-telemetry",
            "target": "code.execute-format-response",
            "selected": False
        },
        # Format Response -> Webhook Respond
        {
            "id": "e-format-response-to-webhook-respond",
            "type": "custom",
            "data": {},
            "source": "code.execute-format-response",
            "target": "respond-to-webhook-nurture",
            "selected": False
        }
    ]

    wf['edges'] = clean_edges

    target_files = [
        'new_nurture_agent_workflow.json',
        'new_nurturing_agent_workflow.json',
        'SNS_Square_Nurturing_Agent_Workflow.json',
        'working_nurture_agent.json',
        'working_nurture_agent_workflow.json',
        'nurturing_agent_workflow.json',
        'nurturing_aget_workflow.json',
        'SNS_Square_Client_Nurturing_Final_Working_Workflow.json',
        'SNS_Square_Client_Nurturing_Production_Workflow.json',
        'client_nurturing_workbench_workflow.json',
        'contact-agent/client_nurturing_workbench_workflow.json'
    ]

    for fname in target_files:
        with open(fname, 'w') as out_f:
            json.dump(wf, out_f, indent=2)
        print(f"Updated clean 2-route workflow: {fname}")

if __name__ == '__main__':
    build_clean_2route_workflow()
    print("SUCCESS: Route switch now has exactly 2 clean connection lines!")
