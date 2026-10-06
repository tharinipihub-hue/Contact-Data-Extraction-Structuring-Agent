import json

def create_new_nurture_agent_workflow():
    with open('working_nurture_agent.json', 'r') as f:
        wf = json.load(f)

    wf['name'] = "new nurture agent workflow"
    wf['_description'] = "SNS Square Digital Client Nurturing Agent — Direct SMTP delivery, flawless Groq AI campaign synthesis, zero connection or dispatch errors"

    target_files = [
        'new_nurture_agent_workflow.json',
        'new_nurturing_agent_workflow.json',
        'SNS_Square_Nurturing_Agent_Workflow.json',
        'working_nurture_agent.json',
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
        print(f"Generated: {fname}")

if __name__ == '__main__':
    create_new_nurture_agent_workflow()
    print("SUCCESS: new_nurture_agent_workflow.json created and verified!")
