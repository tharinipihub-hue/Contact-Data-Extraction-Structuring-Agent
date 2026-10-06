import json

def generate_perfect_workflow():
    with open('working_nurture_agent.json', 'r') as f:
        wf = json.load(f)

    # Filter out any orphan/unused nodes like groq-intent-classifier
    active_node_ids = {
        'webhook-trigger-client-nurturing',
        'code.execute-nurture-ingest',
        'core_switch-nurture-router',
        'code.execute-campaign-prompt-builder',
        'groq-nurture-personalizer',
        'code.execute-1790678109627001',
        'core_switch-nurture-generation-valid',
        'smtp-nurture-dispatch',
        'code.execute-engagement-telemetry',
        'code.execute-format-response',
        'respond-to-webhook-nurture'
    }

    nodes = [n for n in wf['nodes'] if n['id'] in active_node_ids]

    # Perfect 2D coordinates for visual clarity in Agent Workbench
    positions = {
        'webhook-trigger-client-nurturing': {'x': 60, 'y': 350},
        'code.execute-nurture-ingest': {'x': 400, 'y': 350},
        'core_switch-nurture-router': {'x': 750, 'y': 350},
        'code.execute-campaign-prompt-builder': {'x': 1100, 'y': 520},
        'groq-nurture-personalizer': {'x': 1450, 'y': 520},
        'code.execute-1790678109627001': {'x': 1800, 'y': 350},
        'core_switch-nurture-generation-valid': {'x': 2150, 'y': 350},
        'smtp-nurture-dispatch': {'x': 2520, 'y': 180},
        'code.execute-engagement-telemetry': {'x': 2880, 'y': 180},
        'code.execute-format-response': {'x': 3240, 'y': 350},
        'respond-to-webhook-nurture': {'x': 3600, 'y': 350}
    }

    for node in nodes:
        nid = node['id']
        node['position'] = positions.get(nid, {'x': 100, 'y': 100})
        node['width'] = 240 if node.get('type') == 'switch' else 220
        node['height'] = 269 if node.get('type') == 'switch' else 94
        node['selected'] = False
        node['dragging'] = False
        
        data = node.get('data', {})
        data['connectedHandles'] = []
        if 'isTrigger' not in data:
            data['isTrigger'] = False
        if 'isFormWait' not in data:
            data['isFormWait'] = False
        if 'isTimerWait' not in data:
            data['isTimerWait'] = False
        if 'isWebhookWait' not in data:
            data['isWebhookWait'] = False
        if 'isPrimaryTrigger' not in data:
            data['isPrimaryTrigger'] = (node['type'] == 'webhook')

    # Explicit, clean edges
    edges = [
        # 1. Webhook -> Ingest
        {
            "id": "e-webhook-to-ingest",
            "type": "custom",
            "data": {},
            "source": "webhook-trigger-client-nurturing",
            "target": "code.execute-nurture-ingest",
            "selected": False
        },
        # 2. Ingest -> Router
        {
            "id": "e-ingest-to-router",
            "type": "custom",
            "data": {},
            "source": "code.execute-nurture-ingest",
            "target": "core_switch-nurture-router",
            "selected": False
        },
        # 3. Router output-0 (approve_and_send) -> Validate (direct bypass of LLM)
        {
            "id": "e-router-out0-approve-and-send",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-1790678109627001",
            "sourceHandle": "output-0",
            "selected": False
        },
        # 4. Router output-1..6 & fallback 7 -> Prompt Builder
        {
            "id": "e-router-out1-festival",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-1",
            "selected": False
        },
        {
            "id": "e-router-out2-newsletter",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-2",
            "selected": False
        },
        {
            "id": "e-router-out3-promotional",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-3",
            "selected": False
        },
        {
            "id": "e-router-out4-followup",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-4",
            "selected": False
        },
        {
            "id": "e-router-out5-event",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-5",
            "selected": False
        },
        {
            "id": "e-router-out6-announcement",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-6",
            "selected": False
        },
        {
            "id": "e-router-out7-fallback",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-7",
            "selected": False
        },
        # 5. Prompt Builder -> Groq LLM
        {
            "id": "e-prompt-builder-to-llm",
            "type": "custom",
            "data": {},
            "source": "code.execute-campaign-prompt-builder",
            "target": "groq-nurture-personalizer",
            "selected": False
        },
        # 6. Groq LLM -> Validate & Sanitize
        {
            "id": "e-llm-to-validate",
            "type": "custom",
            "data": {},
            "source": "groq-nurture-personalizer",
            "target": "code.execute-1790678109627001",
            "selected": False
        },
        # 7. Validate & Sanitize -> Dispatch Gate
        {
            "id": "e-validate-to-dispatch-gate",
            "type": "custom",
            "data": {},
            "source": "code.execute-1790678109627001",
            "target": "core_switch-nurture-generation-valid",
            "selected": False
        },
        # 8. Dispatch Gate output-0 (send_allowed == true) -> SMTP Send
        {
            "id": "e-dispatch-gate-out0-smtp",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-generation-valid",
            "target": "smtp-nurture-dispatch",
            "sourceHandle": "output-0",
            "selected": False
        },
        # 9. Dispatch Gate output-1 (send_allowed == false / preview) -> Format Response
        {
            "id": "e-dispatch-gate-out1-response",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-generation-valid",
            "target": "code.execute-format-response",
            "sourceHandle": "output-1",
            "selected": False
        },
        # 10. SMTP Send -> Telemetry
        {
            "id": "e-smtp-to-telemetry",
            "type": "custom",
            "data": {},
            "source": "smtp-nurture-dispatch",
            "target": "code.execute-engagement-telemetry",
            "selected": False
        },
        # 11. Telemetry -> Format Response
        {
            "id": "e-telemetry-to-format-response",
            "type": "custom",
            "data": {},
            "source": "code.execute-engagement-telemetry",
            "target": "code.execute-format-response",
            "selected": False
        },
        # 12. Format Response -> Webhook Respond
        {
            "id": "e-format-response-to-webhook-respond",
            "type": "custom",
            "data": {},
            "source": "code.execute-format-response",
            "target": "respond-to-webhook-nurture",
            "selected": False
        }
    ]

    final_wf = {
        "_platform": "agentbuilder",
        "_version": 1,
        "_exportedAt": "2026-10-06T11:55:00.000Z",
        "_fingerprint": "YWN0aW9uOmNvZGUuZXhlY3V0ZXxhY3Rpb246Y29kZS5leGVjdXRlfGFjdGlvbjpj",
        "name": "working nurture agent",
        "_description": "SNS Square Digital Client Nurturing Agent — Direct SMTP delivery and clean Groq AI campaign synthesis",
        "nodes": nodes,
        "edges": edges
    }

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
            json.dump(final_wf, out_f, indent=2)
        print(f"Generated clean layout: {fname}")

if __name__ == '__main__':
    generate_perfect_workflow()
    print("SUCCESS: All nodes aligned and 100% connected!")
