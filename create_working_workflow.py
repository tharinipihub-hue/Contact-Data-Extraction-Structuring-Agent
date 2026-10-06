import json
import os

def build_workflow():
    with open('nurturing_agent_workflow.json', 'r') as f:
        wf = json.load(f)

    # 1. Update Ingest & Router & SMTP nodes
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
                        "outputIndex": 2
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "promotional",
                        "operator": "equal",
                        "outputIndex": 3
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "follow_up",
                        "operator": "equal",
                        "outputIndex": 4
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "event_invitation",
                        "operator": "equal",
                        "outputIndex": 5
                    },
                    {
                        "value1": "{{ $json.campaign_type_normalized || $json.campaign_type || '' }}",
                        "value2": "announcement",
                        "operator": "equal",
                        "outputIndex": 6
                    }
                ],
                "ignoreCase": True,
                "fallbackOutput": 7,
                "sendToAllMatches": False
            }
        elif node['id'] == 'smtp-nurture-dispatch':
            node['data']['inputs'] = {
                "html": "{{ $node[\"code.execute-1790678109627001\"].json[\"email_body\"] || \"\" }}",
                "text": "{{ $node[\"code.execute-1790678109627001\"].json[\"email_body\"] || \"\" }}",
                "message": "{{ $node[\"code.execute-1790678109627001\"].json[\"email_body\"] || \"\" }}",
                "subject": "{{ $node[\"code.execute-1790678109627001\"].json[\"subject\"] || \"\" }}",
                "toEmail": "{{ ($node[\"code.execute-nurture-ingest\"].json[\"active_contact\"] || {}).email || \"\" }}",
                "fromEmail": "{{ $node[\"code.execute-nurture-ingest\"].json[\"from_email\"] || $node[\"code.execute-nurture-ingest\"].json[\"sender_email\"] || \"\" }}",
                "ignoreSSL": False,
                "operation": "Send",
                "emailFormat": "html",
                "credentialId": "71228e04-6a55-4a7b-80dd-fb1663064133",
                "label": "Dispatch Campaign via SMTP (guarded by send_allowed)"
            }

    # 2. Rebuild Edges
    new_edges = [
        {
            "source": "webhook-trigger-client-nurturing",
            "target": "code.execute-nurture-ingest",
            "sourceHandle": None
        },
        {
            "source": "code.execute-nurture-ingest",
            "target": "core_switch-nurture-router",
            "sourceHandle": None
        },
        # output-0: approve_and_send bypasses LLM directly to Validate & Sanitize
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-1790678109627001",
            "sourceHandle": "output-0"
        },
        # output-1 to 6 & fallback 7: preview goes to prompt builder
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-1"
        },
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-2"
        },
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-3"
        },
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-4"
        },
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-5"
        },
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-6"
        },
        {
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-7"
        },
        # Prompt Builder -> LLM Personalizer
        {
            "source": "code.execute-campaign-prompt-builder",
            "target": "groq-nurture-personalizer",
            "sourceHandle": None
        },
        # LLM Personalizer -> Validate & Sanitize
        {
            "source": "groq-nurture-personalizer",
            "target": "code.execute-1790678109627001",
            "sourceHandle": None
        },
        # Validate & Sanitize -> Dispatch Gate (Switch)
        {
            "source": "code.execute-1790678109627001",
            "target": "core_switch-nurture-generation-valid",
            "sourceHandle": None
        },
        # Dispatch Gate output-0 (send_allowed == true) -> SMTP Node
        {
            "source": "core_switch-nurture-generation-valid",
            "target": "smtp-nurture-dispatch",
            "sourceHandle": "output-0"
        },
        # Dispatch Gate output-1 (send_allowed == false) -> Telemetry / Response
        {
            "source": "core_switch-nurture-generation-valid",
            "target": "code.execute-format-response",
            "sourceHandle": "output-1"
        },
        # SMTP -> Telemetry
        {
            "source": "smtp-nurture-dispatch",
            "target": "code.execute-engagement-telemetry",
            "sourceHandle": None
        },
        # Telemetry -> Format Response
        {
            "source": "code.execute-engagement-telemetry",
            "target": "code.execute-format-response",
            "sourceHandle": None
        },
        # Format Response -> Webhook Respond
        {
            "source": "code.execute-format-response",
            "target": "respond-to-webhook-nurture",
            "sourceHandle": None
        }
    ]

    wf['edges'] = new_edges

    target_files = [
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
        print(f"Created/Updated: {fname}")

if __name__ == '__main__':
    build_workflow()
    print("SUCCESS: All workflow files updated with the direct approve_and_send bypass architecture!")
