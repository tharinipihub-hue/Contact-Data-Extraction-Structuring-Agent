import json

code_clean = """const item = $json || {};
let raw = item.text || item.content?.parts?.[0]?.text || item.content || item.choices?.[0]?.message?.content || item.choices?.[0]?.text || item.message?.content || item.output || item.response || item.data || item.result || item.body || "";
let generated = null;
if (raw && typeof raw === "object" && !Array.isArray(raw)) {
  generated = raw;
} else if (typeof raw === "string" && raw.trim()) {
  let clean = raw.trim();
  if (clean.startsWith("```json")) clean = clean.replace(/^```json\\s*/i, "").replace(/\\s*```$/, "");
  else if (clean.startsWith("```")) clean = clean.replace(/^```\\s*/, "").replace(/\\s*```$/, "");
  clean = clean.trim();
  try {
    generated = JSON.parse(clean);
  } catch (_) {
    const jsonMatch = clean.match(/\\{[\\s\\S]*\\}/);
    if (jsonMatch) {
      try { generated = JSON.parse(jsonMatch[0]); } catch (e) {}
    }
  }
}
if (!generated && (item.subject || item.email_body || item.hero_headline || item.content_blocks)) {
  generated = item;
}

const getNodeJson = (id, label) => {
  if (typeof $node === 'object' && $node !== null) {
    const target = $node[id] || $node[label];
    if (target) {
      if (target.json && typeof target.json === 'object') return target.json;
      return target;
    }
  }
  return {};
};

const getAllNodeData = () => {
  if (typeof $node === 'object' && $node !== null) {
    for (const key of Object.keys($node)) {
      const val = $node[key];
      const data = (val && val.json && typeof val.json === 'object') ? val.json : val;
      if (data && typeof data === 'object' && (data.action || data.active_contact || data.campaign_name || data.campaign_type)) {
        return data;
      }
    }
  }
  return {};
};

const promptNode = Object.keys(getNodeJson("code.execute-campaign-prompt-builder", "Build Campaign-Aware Prompt")).length > 0
  ? getNodeJson("code.execute-campaign-prompt-builder", "Build Campaign-Aware Prompt")
  : ($json && $json.llm_prompt ? $json : {});

const ingest = Object.keys(getNodeJson("code.execute-nurture-ingest", "Ingest Campaign Context & Opt-In Contacts")).length > 0
  ? getNodeJson("code.execute-nurture-ingest", "Ingest Campaign Context & Opt-In Contacts")
  : (Object.keys(getNodeJson("webhook-trigger-client-nurturing", "Client Nurturing Webhook Trigger")).length > 0
      ? getNodeJson("webhook-trigger-client-nurturing", "Client Nurturing Webhook Trigger")
      : (Object.keys(getAllNodeData()).length > 0
          ? getAllNodeData()
          : ($json && ($json.action || $json.active_contact) ? $json : {})));

const banned = /(?:FESTIVAL\\s+WISH\\s+RULE|CAMPAIGN\\s+RULES?|EDITORIAL\\s+GUIDELINES|STRATEGIC\\s+SYNTHESIS|OFFICIAL\\s+SIGN[- ]?OFF|KEY\\s+ANNOUNCEMENT\\s*(?:&|AND)\\s*BRIEFING\\s*:|STRATEGIC\\s+IMPACT\\s+FOR|RETURN\\s+ONLY|OUTPUT\\s+ONLY|GENERATE\\s+JSON|SYSTEM\\s+INSTRUCTIONS?|DEVELOPER\\s+INSTRUCTIONS?|INTERNAL\\s+PROMPT|CONFIDENTIAL|INTERNAL\\s+ONLY|DO\\s+NOT\\s+INCLUDE|OMIT\\s+THIS|META\\s+DIRECTIVE|SNS_PROMPT_VERSION|LLM_BACKEND|EXECUTION_GRAPH_VALIDATION|AI\\s+AGENT\\s+WORKBENCH)/i;
const schemaFieldPattern = /\\b(?:hero_headline|hero_body|content_blocks|foundations_title|foundations|closing_text|promo_banner|greeting_type|cta_label|cta_url)\\s*[:=]/i;

function leakIn(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return banned.test(val) || schemaFieldPattern.test(val);
  if (Array.isArray(val)) return val.some(leakIn);
  if (typeof val === "object") return Object.values(val).some(leakIn);
  return false;
}

function sourceText(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) return val.map(sourceText).filter(Boolean).join("\\n\\n");
  if (typeof val === "object") {
    for (const key of ["text","body","value","content","paragraph","title","headline"]) {
      if (typeof val[key] === "string" && val[key].trim()) return val[key].trim();
    }
  }
  return String(val).trim();
}

function escapeText(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

const allowedUrls = new Set(Array.isArray(promptNode.approved_urls) ? promptNode.approved_urls : (Array.isArray(ingest.approved_urls) ? ingest.approved_urls : []));

function cleanHtml(html) {
  if (!html) return "";
  let out = String(html)
    .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, "")
    .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, "")
    .replace(/\\son\\w+\\s*=\\s*[\"'][^\"']*[\"']/gi, "")
    .replace(/\\son\\w+\\s*=\\s*[^\\s>]+/gi, "");
  out = out.replace(/<a\\b([^>]*)>/gi, (match, attrs) => {
    const hrefMatch = attrs.match(/href\\s*=\\s*[\"']([^\"']*)[\"']/i);
    const href = hrefMatch ? hrefMatch[1].trim() : "";
    return href && allowedUrls.has(href) ? `<a href="${href}">` : "<a>";
  });
  return out.trim();
}

const generatedObject = generated && typeof generated === "object" && !Array.isArray(generated) && !generated.error;
const campaignTypeSupported = promptNode.campaign_type_supported === true;
let result = {};
let valid = Boolean(campaignTypeSupported && generatedObject && !leakIn(generated));
let validation_reason = campaignTypeSupported ? "" : "Campaign type is not supported by the SNS Square Client Nurturing workflow.";

const stringFields = ["subject","campaign_name","header_title","header_subtitle","greeting_type","greeting","hero_headline","foundations_title","closing_text","promo_banner"];
if (valid) {
  for (const key of stringFields) result[key] = sourceText(generated[key]);
  const heroRaw = Array.isArray(generated.hero_body) ? generated.hero_body : (generated.hero_body === undefined || generated.hero_body === null || generated.hero_body === "" ? [] : [generated.hero_body]);
  result.hero_body = heroRaw.map(sourceText).filter(Boolean);
  result.content_blocks = Array.isArray(generated.content_blocks) ? generated.content_blocks.filter(b => b && typeof b === "object" && !Array.isArray(b)).map(b => {
    const block = {};
    for (const key of ["headline","body","image_url","cta_label","cta_url"]) {
      const value = sourceText(b[key]);
      if (value) block[key] = value;
    }
    if (block.image_url && (!/^https:\\/\\//i.test(block.image_url) || !allowedUrls.has(block.image_url))) delete block.image_url;
    if (block.cta_url && (!/^https:\\/\\//i.test(block.cta_url) || !allowedUrls.has(block.cta_url))) delete block.cta_url;
    return block;
  }).filter(b => Object.keys(b).length > 0) : [];
  result.foundations = Array.isArray(generated.foundations) ? generated.foundations.map(sourceText).filter(Boolean) : [];
  let body = sourceText(generated.email_body);
  if (body) body = cleanHtml(body);
  if (!body) {
    const parts = [];
    if (result.greeting) parts.push(`<p>${escapeText(result.greeting)}</p>`);
    if (result.hero_headline) parts.push(`<p><strong>${escapeText(result.hero_headline)}</strong></p>`);
    for (const paragraph of result.hero_body) parts.push(`<p>${escapeText(paragraph)}</p>`);
    for (const block of result.content_blocks) {
      if (block.headline) parts.push(`<p><strong>${escapeText(block.headline)}</strong></p>`);
      if (block.body) parts.push(`<p>${escapeText(block.body)}</p>`);
      if (block.cta_label) parts.push(`<p>${escapeText(block.cta_label)}</p>`);
    }
    if (result.foundations_title) parts.push(`<p>${escapeText(result.foundations_title)}</p>`);
    if (result.foundations.length) parts.push(`<ul>${result.foundations.map(x => `<li>${escapeText(x)}</li>`).join("")}</ul>`);
    if (result.closing_text) parts.push(`<p>${escapeText(result.closing_text)}</p>`);
    body = parts.join("");
  }
  result.email_body = body;
  valid = valid && !leakIn(result) && Boolean(result.subject || result.greeting || result.hero_headline || result.hero_body.length || result.content_blocks.length || result.foundations.length || result.closing_text || result.promo_banner || result.email_body);
} else { result = {}; }

if (!valid) {
  result = {};
  validation_reason = leakIn(generated) ? "Workbench output contained prompt or internal instruction leakage." : "Workbench returned no usable structured campaign content.";
}

// ---------------------------------------------------------------------------
// DISPATCH PATH (action === "approve_and_send")
// ---------------------------------------------------------------------------
const isDispatchRequest = ingest.action === "approve_and_send" || ($json && $json.action === "approve_and_send") || (item && item.action === "approve_and_send");
if (isDispatchRequest) {
  const dispatchSubject = sourceText(ingest.subject || ($json && $json.subject) || (ingest.content && ingest.content.subject) || ($json && $json.content && $json.content.subject));
  const dispatchBodyRaw = sourceText(ingest.email_body || ($json && $json.email_body) || (ingest.content && ingest.content.email_body) || ($json && $json.content && $json.content.email_body));
  const dispatchContact = ingest.active_contact || ($json && $json.active_contact) || (ingest.contacts && ingest.contacts[0]) || ($json && $json.contacts && $json.contacts[0]) || {};
  const dispatchEmail = typeof dispatchContact.email === "string" ? dispatchContact.email.trim() : (typeof ingest.to_email === "string" ? ingest.to_email.trim() : (typeof ($json && $json.to_email) === "string" ? $json.to_email.trim() : ""));
  const dispatchOptIn = dispatchContact.opt_in === true || dispatchContact.opt_in === "true" || dispatchContact.opt_in === 1;

  if (!dispatchSubject || !dispatchBodyRaw) {
    result = {};
    valid = false;
    validation_reason = "Dispatch request did not supply both a campaign subject and an email body.";
  } else if (!dispatchContact || Object.keys(dispatchContact).length === 0) {
    result = {};
    valid = false;
    validation_reason = "Dispatch has no recipient with active opt-in consent.";
  } else if (!dispatchEmail) {
    result = {};
    valid = false;
    validation_reason = "Dispatch recipient has no email address.";
  } else if (!dispatchOptIn) {
    result = {};
    valid = false;
    validation_reason = "Dispatch recipient has not opted in.";
  } else if (leakIn({ subject: dispatchSubject, email_body: dispatchBodyRaw })) {
    result = {};
    valid = false;
    validation_reason = "Dispatch content contained prompt or internal instruction leakage.";
  } else {
    const sanitisedDispatchBody = cleanHtml(dispatchBodyRaw);
    result = { subject: dispatchSubject, email_body: sanitisedDispatchBody };
    valid = Boolean(sanitisedDispatchBody.trim());
    if (!valid) validation_reason = "Dispatch content was empty after HTML sanitisation.";
  }
}

const contact = ingest.active_contact || ($json && $json.active_contact) || {};
const recipientEmail = typeof contact.email === "string" ? contact.email.trim() : (typeof ingest.to_email === "string" ? ingest.to_email.trim() : (typeof ($json && $json.to_email) === "string" ? $json.to_email.trim() : ""));
const subjectOk = Boolean(String(result.subject || ingest.subject || ($json && $json.subject) || "").trim());
const bodyOk = Boolean(String(result.email_body || ingest.email_body || ($json && $json.email_body) || "").trim());
const isExplicitSend = ingest.action === "approve_and_send" || ($json && $json.action === "approve_and_send");
const sendAllowed = Boolean(
  valid &&
  ingest.action !== "generate_preview" &&
  (!($json) || $json.action !== "generate_preview") &&
  (ingest.send_allowed === true || ($json && $json.send_allowed === true) || isExplicitSend) &&
  contact.opt_in === true &&
  recipientEmail &&
  subjectOk &&
  bodyOk
);

let sendBlockedReason = "";
if (!sendAllowed) {
  if (!valid) sendBlockedReason = validation_reason || "Workbench returned no usable structured campaign content.";
  else if (ingest.action === "generate_preview" || ($json && $json.action === "generate_preview")) sendBlockedReason = "Preview requests are never dispatched.";
  else if (!recipientEmail) sendBlockedReason = "Recipient has no email address.";
  else if (contact.opt_in !== true) sendBlockedReason = "Recipient has not opted in.";
  else if (!subjectOk) sendBlockedReason = "Generated campaign has no subject line.";
  else if (!bodyOk) sendBlockedReason = "Generated campaign has no email body.";
  else sendBlockedReason = "Dispatch was not explicitly confirmed.";
}

const finalSubject = result.subject || ingest.subject || ($json && $json.subject) || "";
const finalBody = result.email_body || ingest.email_body || ($json && $json.email_body) || "";
const senderEmail = ingest.from_email || ingest.sender_email || ($json && ($json.from_email || $json.sender_email)) || "";

return {
  ...ingest,
  ...($json || {}),
  ...result,
  subject: finalSubject,
  email_body: finalBody,
  to_email: recipientEmail,
  toEmail: recipientEmail,
  from_email: senderEmail,
  fromEmail: senderEmail,
  recipient_email: recipientEmail,
  send_allowed: sendAllowed,
  send_blocked_reason: sendBlockedReason,
  recipient_email_present: Boolean(recipientEmail),
  generation_validation: {
    valid,
    status: valid ? "accepted" : "rejected",
    reason: valid ? "" : (validation_reason || "Workbench returned no usable structured campaign content or returned invalid/instructional output"),
    subject_present: subjectOk,
    email_body_present: bodyOk,
    recipient_email_present: Boolean(recipientEmail),
    recipient_opted_in: contact.opt_in === true
  },
  normalized_generated_content: valid
};"""

files = [
  'nurturing_agent_workflow.json',
  'nurturing_aget_workflow.json',
  'SNS_Square_Client_Nurturing_Final_Working_Workflow.json',
  'SNS_Square_Client_Nurturing_Production_Workflow.json',
  'SNS_Square_Client_Nurturing_Live_Workflow.json',
  'client_nurturing_workbench_workflow.json',
  'client_nurturing_workbench_workflow_v2.json'
]

for f in files:
  with open(f, 'r') as fp:
    wf = json.load(fp)
  for node in wf['nodes']:
    if node['id'] == 'code.execute-1790678109627001':
      node['data']['inputs']['code'] = code_clean
  with open(f, 'w') as fp:
    json.dump(wf, fp, indent=2)

print("SUCCESS: Updated clean code across all files!")
