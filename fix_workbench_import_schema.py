import json

def fix_workflow():
    with open('client_nurturing_workbench_workflow_v2 copy.json', 'r') as f:
        base_wf = json.load(f)

    with open('working_nurture_agent.json', 'r') as f:
        current_wf = json.load(f)

    # Use the complete, tested node definitions from current_wf
    nodes = current_wf['nodes']

    # Ensure every node has 100% valid fields and no undefined/null
    for node in nodes:
        node['selected'] = False
        node['dragging'] = False
        if 'width' not in node or not node['width']:
            node['width'] = 220
        if 'height' not in node or not node['height']:
            node['height'] = 94
        if 'position' not in node or not node['position']:
            node['position'] = {"x": 100, "y": 100}
        
        data = node.get('data', {})
        if 'connectedHandles' not in data or data['connectedHandles'] is None:
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

    # Build clean edges with string IDs and omit null sourceHandles
    clean_edges = [
        {
            "id": "e-webhook-to-ingest",
            "type": "custom",
            "data": {},
            "source": "webhook-trigger-client-nurturing",
            "target": "code.execute-nurture-ingest",
            "selected": False
        },
        {
            "id": "e-ingest-to-router",
            "type": "custom",
            "data": {},
            "source": "code.execute-nurture-ingest",
            "target": "core_switch-nurture-router",
            "selected": False
        },
        # output-0: approve_and_send bypasses LLM directly to Validate & Sanitize
        {
            "id": "e-router-out-0-approve-and-send",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-1790678109627001",
            "sourceHandle": "output-0",
            "selected": False
        },
        # output-1 to 6 & 7: preview goes to prompt builder
        {
            "id": "e-router-out-1-festival",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-1",
            "selected": False
        },
        {
            "id": "e-router-out-2-newsletter",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-2",
            "selected": False
        },
        {
            "id": "e-router-out-3-promotional",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-3",
            "selected": False
        },
        {
            "id": "e-router-out-4-followup",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-4",
            "selected": False
        },
        {
            "id": "e-router-out-5-event",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-5",
            "selected": False
        },
        {
            "id": "e-router-out-6-announcement",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-6",
            "selected": False
        },
        {
            "id": "e-router-out-7-fallback",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-router",
            "target": "code.execute-campaign-prompt-builder",
            "sourceHandle": "output-7",
            "selected": False
        },
        # Prompt Builder -> LLM Personalizer
        {
            "id": "e-prompt-builder-to-llm",
            "type": "custom",
            "data": {},
            "source": "code.execute-campaign-prompt-builder",
            "target": "groq-nurture-personalizer",
            "selected": False
        },
        # LLM Personalizer -> Validate & Sanitize
        {
            "id": "e-llm-to-validate",
            "type": "custom",
            "data": {},
            "source": "groq-nurture-personalizer",
            "target": "code.execute-1790678109627001",
            "selected": False
        },
        # Validate & Sanitize -> Dispatch Gate (Switch)
        {
            "id": "e-validate-to-dispatch-gate",
            "type": "custom",
            "data": {},
            "source": "code.execute-1790678109627001",
            "target": "core_switch-nurture-generation-valid",
            "selected": False
        },
        # Dispatch Gate output-0 (send_allowed == true) -> SMTP Node
        {
            "id": "e-dispatch-gate-to-smtp",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-generation-valid",
            "target": "smtp-nurture-dispatch",
            "sourceHandle": "output-0",
            "selected": False
        },
        # Dispatch Gate output-1 (send_allowed == false) -> Format Response
        {
            "id": "e-dispatch-gate-to-response",
            "type": "custom",
            "data": {},
            "source": "core_switch-nurture-generation-valid",
            "target": "code.execute-format-response",
            "sourceHandle": "output-1",
            "selected": False
        },
        # SMTP -> Telemetry
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
            "id": "e-telemetry-to-response",
            "type": "custom",
            "data": {},
            "source": "code.execute-engagement-telemetry",
            "target": "code.execute-format-response",
            "selected": False
        },
        # Format Response -> Webhook Respond
        {
            "id": "e-response-to-webhook-respond",
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
        "_exportedAt": "2026-10-06T11:45:00.000Z",
        "_fingerprint": "YWN0aW9uOmNvZGUuZXhlY3V0ZXxhY3Rpb246Y29kZS5leGVjdXRlfGFjdGlvbjpj",
        "name": "working nurture agent",
        "_description": "SNS Square Digital Client Nurturing Agent — Direct SMTP delivery and clean Groq AI campaign synthesis",
        "nodes": nodes,
        "edges": clean_edges
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
        print(f"Sanitized & Saved: {fname}")

if __name__ == '__main__':
    fix_workflow()
    print("SUCCESS: Workflow JSON files sanitized for seamless Workbench import!")
