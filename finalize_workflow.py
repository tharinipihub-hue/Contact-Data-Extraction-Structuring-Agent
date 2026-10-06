import json

def finalize_workflow_files():
    with open('working_nurture_agent.json', 'r') as f:
        wf = json.load(f)

    wf['name'] = "SNS Square Digital Client Nurturing Agent (Production Ready)"
    wf['_description'] = "Production-ready Digital Client Nurturing Agent with direct approve_and_send bypass, structured Groq campaign generation, strict validation, and honest SMTP delivery telemetry."

    target_files = [
        'SNS_Square_Nurturing_Agent_Workflow.json',
        'nurturing_agent_workflow.json',
        'nurturing_aget_workflow.json',
        'working_nurture_agent.json',
        'working_nurture_agent_workflow.json',
        'SNS_Square_Client_Nurturing_Final_Working_Workflow.json',
        'SNS_Square_Client_Nurturing_Production_Workflow.json',
        'client_nurturing_workbench_workflow.json',
        'contact-agent/client_nurturing_workbench_workflow.json'
    ]

    for fname in target_files:
        with open(fname, 'w') as out_f:
            json.dump(wf, out_f, indent=2)
        print(f"Saved: {fname}")

if __name__ == '__main__':
    finalize_workflow_files()
    print("SUCCESS: All workflow files updated with full modified format!")
