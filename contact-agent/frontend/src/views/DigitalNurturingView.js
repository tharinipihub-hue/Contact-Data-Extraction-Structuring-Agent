import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import {
  User,
  Users,
  LayoutDashboard,
  Layers,
  Sparkles,
  Send,
  Calendar,
  Activity,
  UserCheck,
  RefreshCw,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  Flame,
  Check,
  Search,
  Filter,
  ArrowRight,
  Download,
  Share2,
  Globe,
  Database,
  Sliders,
  UserPlus,
  Target,
  TrendingUp,
  BarChart2,
  Edit3,
  CornerDownRight,
  Eye,
  CheckSquare,
  Square,
  Image,
  FileText,
  UploadCloud,
  X,
  Bell,
  UserX,
  CheckCheck,
  Inbox,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import './DigitalNurturingView.css';

const API_BASE = '/api';
const APP_ORIGIN = typeof window === 'undefined' ? '' : (
  window.location.hostname === 'localhost' && window.location.port === '3000'
    ? 'http://localhost:4000'
    : window.location.origin
);
const NURTURE_CONTACTS_URL = `${API_BASE}/contacts`;
const NURTURE_SHEET_MANAGEMENT_URL = process.env.REACT_APP_NURTURE_SHEET_MANAGEMENT_URL || '';

const UNSAFE_EMAIL_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'FORM', 'TEMPLATE', 'NOSCRIPT']);

function safeEmailHref(value) {
  const href = String(value || '').trim();
  if (!href || /\s/.test(href)) return null;
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid');
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
    if (url.protocol === 'mailto:' && !href.toLowerCase().startsWith('mailto:')) return null;
    return url.href;
  } catch (_err) {
    return null;
  }
}

function htmlEmailToMarkdown(source) {
  const fragment = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: ['a', 'article', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'i', 'li', 'ol', 'p', 'section', 'span', 'strong', 'ul'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true
  });
  const renderNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName;
    if (UNSAFE_EMAIL_TAGS.has(tag)) return '';
    const children = Array.from(node.childNodes).map(renderNode).join('');
    if (tag === 'BR') return '\n';
    if (tag === 'STRONG' || tag === 'B') return `**${children}**`;
    if (tag === 'EM' || tag === 'I') return `*${children}*`;
    if (tag === 'CODE') return `\`${children}\``;
    if (/^H[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${children.trim()}\n\n`;
    if (tag === 'LI') {
      const list = node.parentElement;
      const siblings = list ? Array.from(list.children).filter((child) => child.tagName === 'LI') : [];
      const index = siblings.indexOf(node);
      const marker = list?.tagName === 'OL' ? `${index + 1}. ` : '- ';
      return `${marker}${children.trim()}\n`;
    }
    if (tag === 'A') {
      const href = safeEmailHref(node.getAttribute('href'));
      return href ? `[${children}](${href})` : children;
    }
    if (['P', 'DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'BLOCKQUOTE', 'TR'].includes(tag)) return `\n\n${children.trim()}\n\n`;
    return children;
  };
  return Array.from(fragment.childNodes).map(renderNode).join('').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function emailPreviewSourceText(value) {
  if (!value) return '';
  let source = String(value);
  // Decode HTML entities as text only; escaping literal '<' prevents the parser
  // from interpreting markup or loading resources during this normalization.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decoded = new DOMParser().parseFromString(source.replace(/</g, '&lt;'), 'text/html').body.textContent || '';
    if (decoded === source) break;
    source = decoded;
  }
  return /<\/?[a-z][^>]*>/i.test(source) ? htmlEmailToMarkdown(source) : source;
}

function renderEmailInline(text, keyPrefix) {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~]+~~|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g;
  const parts = [];
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith('[')) {
      const href = safeEmailHref(match[3]);
      parts.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{match[2]}</a>
        : match[2]);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('~~')) {
      parts.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function EmailBodyPreview({ content }) {
  const text = emailPreviewSourceText(content);
  const lines = text.split('\n');
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); return; }
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (heading || unordered || ordered) {
      flushParagraph();
      const type = heading ? 'heading' : ordered ? 'ordered' : 'unordered';
      const previous = blocks[blocks.length - 1];
      if ((type === 'ordered' || type === 'unordered') && previous?.type === type) previous.items.push((heading || unordered || ordered)[1]);
      else if (type === 'ordered' || type === 'unordered') blocks.push({ type, items: [(unordered || ordered)[1]] });
      else blocks.push({ type, level: heading[0].match(/^#+/)[0].length, text: heading[1] });
      return;
    }
    paragraph.push(trimmed);
  });
  flushParagraph();

  return (
    <div className="dn-email-content">
      {blocks.map((block, index) => {
        if (block.type === 'unordered' || block.type === 'ordered') {
          const List = block.type === 'ordered' ? 'ol' : 'ul';
          return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderEmailInline(item, `${index}-${itemIndex}`)}</li>)}</List>;
        }
        if (block.type === 'heading') {
          const Heading = `h${Math.min(block.level, 4)}`;
          return <Heading key={index}>{renderEmailInline(block.text, `heading-${index}`)}</Heading>;
        }
        return <p key={index}>{block.lines.map((line, lineIndex) => <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderEmailInline(line, `${index}-${lineIndex}`)}</React.Fragment>)}</p>;
      })}
    </div>
  );
}

const WORKBENCH_PIPELINE_NODES = [
  { id: 'webhook-trigger', number: '01', name: 'Client Nurturing Webhook Trigger', type: 'webhook', desc: 'Receives lead payload, sector tags, and campaign type' },
  { id: 'code-ingest', number: '02', name: 'Ingest Client Context & Deduplicate', type: 'code.execute', desc: 'Validates email/phone, verifies Opt-In status, synthesizes history' },
  { id: 'switch-router', number: '03', name: 'Route by Campaign Type', type: 'core_switch', desc: 'Routes to newsletter, greeting, product update, or follow-up' },
  { id: 'groq-personalizer', number: '04', name: 'Groq AI Sector Personalizer', type: 'groq-llm', desc: 'Generates sector-tailored email body and WhatsApp copy' },
  { id: 'smtp-dispatch', number: '05', name: 'SMTP & Multi-Channel Dispatch', type: 'smtp-dispatch', desc: 'Delivers personalized content to client inbox & mobile' },
  { id: 'code-telemetry', number: '06', name: 'Dynamic Engagement Telemetry', type: 'code.execute', desc: 'Tracks open rates, link clicks, replies, and timestamps' },
  { id: 'groq-intent', number: '07', name: 'Groq Intent Classifier', type: 'groq-llm', desc: 'Classifies replies: Interested, Need More Info, Not Interested' },
  { id: 'switch-evaluator', number: '08', name: 'Evaluate Sales Handoff Decision', type: 'core_switch', desc: 'If high intent -> pushes directly to Sales Queue' },
  { id: 'sheets-sales', number: '09', name: 'Push to Sales Handoff Queue', type: 'google.sheets', desc: 'Syncs hot qualified leads to CRM Sales Handoff Sheet' },
  { id: 'sheets-master', number: '10', name: 'Update Nurtured Contacts Master', type: 'google.sheets', desc: 'Logs campaign touchpoint and engagement history in Google Sheets' },
  { id: 'code-response', number: '11', name: 'Format API Telemetry Response', type: 'code.execute', desc: 'Structures JSON response payload with metrics and audit data' },
  { id: 'webhook-respond', number: '12', name: 'Callback to Backend', type: 'respond-webhook', desc: 'Returns synchronized status back to frontend dashboard' }
];

const NURTURE_TEMPLATES = {
  Newsletter: {
    category: 'Newsletter',
    name: 'Newsletter Template',
    description: 'Industry relevance, technological breakthroughs, and executive thought leadership.',
    subject_structure: '[Industry] Intelligence Briefing: [Trend / Strategic Advancement]',
    sections: [
      { name: 'Subject structure', description: '[Industry] Intelligence Briefing: [Trend / Announcement]' },
      { name: 'Introduction', description: 'Executive greeting and macro industry context update' },
      { name: 'Main announcement', description: 'Key technological breakthrough, framework release, or milestone' },
      { name: 'Industry relevance', description: 'Tailored analysis highlighting specific ROI metrics for the recipient sector' },
      { name: 'CTA', description: 'Direct invitation to schedule an executive sync or read technical brief' },
      { name: 'Unsubscribe', description: 'Statutory compliance footer with instant one-click unsubscribe and preference management' }
    ],
    sample: {
      campaign_name: 'Q4 Technology Innovation Briefing',
      brief: 'Sharing latest industry benchmarks on accelerating enterprise operations with autonomous multi-agent pipelines.',
      subject: 'Technology Intelligence Briefing: Scaling Operations with Multi-Agent Systems in 2026',
      email_body: `Dear [Client Name],

As leadership at [Company], staying ahead in the rapidly evolving [Industry] landscape is paramount.

Our advisory team at SNS Square has structured exclusive benchmarks examining how enterprise organizations are transitioning from manual pipelines to autonomous agent orchestration, delivering 3.4x faster data processing and 40% cycle time reduction.

We have tailored these findings specifically to address operational goals at [Company].

Would you be open to an introductory 15-minute briefing next week?

SNS Square Multi-Agent Platform`,
      channel: 'Email'
    }
  },
  Welcome: {
    category: 'Welcome',
    name: 'Welcome Template',
    description: 'Executive welcome and onboarding sequence for new enterprise accounts.',
    subject_structure: 'Welcome to SNS Square: Strategic [Industry] Partnership',
    sections: [
      { name: 'Welcome message', description: 'Warm personalized welcome acknowledging client leadership' },
      { name: 'SNS introduction', description: 'SNS Square autonomous multi-agent platform capabilities' },
      { name: 'Relevant next step', description: 'Introductory strategy consultation / engineering discovery' },
      { name: 'Contact information', description: 'Dedicated relationship manager & direct communication channels' }
    ],
    sample: {
      campaign_name: 'Executive Client Welcome & Orientation',
      brief: 'Onboard newly ingested corporate clients with introductory overview of SNS Square Agent Workbench capabilities.',
      subject: 'Welcome to SNS Square: Strategic Partnership & Digital Acceleration',
      email_body: `Dear [Client Name],

Welcome to SNS Square! We are thrilled to partner with [Company] as you advance your strategic digital capabilities.

Your dedicated account advisory team is here to support seamless integration across our Agent Workbench, CRM pipelines, and automated intelligence systems.

To schedule your introductory orientation or explore our tailored architectures, simply reply to this email or reach us through your preference portal.

SNS Square Multi-Agent Platform`,
      channel: 'Email + WhatsApp'
    }
  },
  Festival: {
    category: 'Festival',
    name: 'Festival Template',
    description: 'Executive celebratory wishes across major holidays and occasions.',
    subject_structure: 'Warm [Festival Name] Greetings & Prosperity Wishes from SNS Square',
    sections: [
      { name: 'Greeting', description: 'Warm executive wishes for festival / occasion' },
      { name: 'Festival name', description: 'Occasion identification (Diwali, New Year, Thanksgiving, etc.)' },
      { name: 'Short personalized message', description: 'Celebrating shared milestones and wishing prosperity' },
      { name: 'SNS branding', description: 'SNS Square strategic partnership sign-off' }
    ],
    sample: {
      campaign_name: 'Diwali Executive Celebration 2026',
      occasion: 'Diwali 2026',
      brief: 'Warm Diwali greetings celebrating partnership milestones and wishing prosperity.',
      subject: 'Warm Diwali Greetings & Prosperity Wishes from SNS Square',
      email_body: `Dear [Client Name],

On behalf of everyone at SNS Square, we wish you, your team, and your loved ones a joyous, luminous, and prosperous Diwali!

May this festive season bring boundless growth, innovation, and success to all your strategic ventures at [Company].

SNS Square Multi-Agent Platform`,
      channel: 'Email + WhatsApp'
    }
  },
  Promotional: {
    category: 'Promotional',
    name: 'Promotional Template',
    description: 'Strategic product releases, customer success stories, and platform upgrades.',
    subject_structure: 'SNS Square Strategic Update: [Value Proposition / Platform Upgrade]',
    sections: [
      { name: 'Strategic update', description: 'Enterprise product release or high-impact operational upgrade' },
      { name: 'Value proposition', description: 'Measurable ROI, efficiency benchmarks, and cost reduction' },
      { name: 'Customer success story', description: 'Real-world results from peer enterprise clients' },
      { name: 'CTA', description: 'Schedule demo or trial access' },
      { name: 'Unsubscribe', description: 'Statutory compliance footer with one-click opt out' }
    ],
    sample: {
      campaign_name: 'SNS Square Autonomous Agent Capabilities Update',
      brief: 'Announcing next-generation agentic workbench with live bi-directional CRM syncing and OCR card extraction.',
      subject: 'SNS Square Platform Update: Accelerating Enterprise Structuring with Agent Workbench',
      email_body: `Dear [Client Name],

We are excited to share major operational advancements in the SNS Square Multi-Agent Platform, including automated card extraction, sub-second data deduplication, and bi-directional CRM syncing.

In recent enterprise deployments, organizations have reduced manual data handling by 84% while cutting lead-to-nurture response latency to under 5 seconds.

Reply directly to this email if you would like an exclusive demonstration tailored for [Company].

SNS Square Multi-Agent Platform`,
      channel: 'Email'
    }
  }
};


export default function DigitalNurturingView({ extractedLeads = [], onSwitchToExtraction }) {
  // Navigation: 'leads' (Client Directory) | 'dashboard' | 'sectors' | 'generator' | 'campaigns' | 'sales' | 'workflow'
  const [activeTab, setActiveTab] = useState('leads');

  // Leads & data state
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [salesHandoffs, setSalesHandoffs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedCampaignForPreview, setSelectedCampaignForPreview] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [optInFilter, setOptInFilter] = useState('All');

  // Opt-In & Opt-Out Notifications State
  const [optNotifications, setOptNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifFilter, setNotifFilter] = useState('all');

  // Wizard State (Create Campaign)
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCampaignType, setWizardCampaignType] = useState('Newsletter');
  const [wizardAudienceType, setWizardAudienceType] = useState('All Past Clients');
  const [wizardSelectedIndustry, setWizardSelectedIndustry] = useState('');
  const [wizardSelectedCompany, setWizardSelectedCompany] = useState('');
  const [wizardSelectedCustomContacts, setWizardSelectedCustomContacts] = useState(new Set());
  const [wizardCampaignName, setWizardCampaignName] = useState('Q4 Technology Intelligence Briefing');
  const [wizardBrief, setWizardBrief] = useState('');
  const [wizardBriefError, setWizardBriefError] = useState(false);
  const [wizardOccasion, setWizardOccasion] = useState('Diwali 2026');
  const [wizardChannels, setWizardChannels] = useState({ email: true, whatsapp: false });
  const [wizardGeneratedContent, setWizardGeneratedContent] = useState(null);
  const [wizardIsGenerating, setWizardIsGenerating] = useState(false);
  const [wizardIsEditing, setWizardIsEditing] = useState(false);
  const [wizardEditedSubject, setWizardEditedSubject] = useState('');
  const [wizardEditedBody, setWizardEditedBody] = useState('');
  const [wizardIsDispatching, setWizardIsDispatching] = useState(false);
  const [wizardImage, setWizardImage] = useState(null);
  const [wizardImageName, setWizardImageName] = useState('');
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [wizardSelectedContactId, setWizardSelectedContactId] = useState('');

  // Templates Tab State
  const [selectedTemplateTab, setSelectedTemplateTab] = useState('Newsletter');
  const [templateSelectedContactId, setTemplateSelectedContactId] = useState('');

  // Engagement Tab State
  const [selectedEngagementClientId, setSelectedEngagementClientId] = useState('');

  // Campaigns Filter
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('All');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('All');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [deletingCampaignId, setDeletingCampaignId] = useState(null);

  // Content Generator State
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedContentType, setSelectedContentType] = useState('newsletter');
  const [customTopic, setCustomTopic] = useState('');
  const [targetSector, setTargetSector] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // Import from Extraction Agent Modal
  const [isImportFromExtractionOpen, setIsImportFromExtractionOpen] = useState(false);
  const [selectedExtractedIds, setSelectedExtractedIds] = useState(new Set());

  // SNS Workbench Live Webhook Test State
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);

  const handleTestWorkbenchWebhook = async () => {
    const optedInContact = contacts.find(contact => contact.opt_in === true);
    if (!optedInContact) {
      showNotification('Select at least one opted-in audience contact before testing campaign generation.', true);
      return;
    }
    setIsTestingWebhook(true);
    setWebhookTestResult(null);
    const start = Date.now();
    try {
      const res = await axios.post(`${API_BASE}/campaigns/test-webhook`, {
        contact_id: optedInContact.id
      }, { timeout: 25000 });
      const elapsed = Date.now() - start;
      const confirmed = res.data?.success === true;
      setWebhookTestResult({
        success: confirmed,
        elapsed,
        source: 'workbench_webhook',
        status: confirmed ? 'Workbench Responded Successfully' : 'Workbench test failed',
        data: res.data?.response || res.data
      });
      if (confirmed) {
        showNotification(`SNS Workbench responded with HTTP ${res.data.status || 200} in ${elapsed}ms.`);
      } else {
        showNotification(res.data?.error || 'SNS Workbench test failed.', true);
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      setWebhookTestResult({
        success: false,
        elapsed,
        status: err.response?.data?.status || err.response?.status || 502,
        error: err.response?.data?.error || err.message
      });
      showNotification('Webhook test error: ' + (err.response?.data?.error || err.message), true);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Show Toast
  const showNotification = (msg, isError = false) => {
    if (typeof msg === 'object' && msg !== null) {
      setNotification({
        type: msg.type || (isError ? 'error' : 'info'),
        title: msg.title || (msg.type === 'opt_in' ? 'Client Opted In' : msg.type === 'opt_out' ? 'Client Opted Out' : 'Notice'),
        text: msg.text || '',
        name: msg.name || '',
        company: msg.company || '',
        isError: Boolean(isError || msg.isError)
      });
    } else {
      const cleanMsg = typeof msg === 'string' ? msg.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}]/gu, '').trim() : msg;
      setNotification({ text: cleanMsg, isError: Boolean(isError) });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  // Load current nurturing data from the same-origin application API.
  useEffect(() => {
    loadData();
    handleSyncSheets();
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    const syncInterval = setInterval(loadData, 4000);
    const sheetSyncInterval = setInterval(handleSyncSheets, 60000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(syncInterval);
      clearInterval(sheetSyncInterval);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      const res = await axios.get(NURTURE_CONTACTS_URL, { timeout: 10000 });
      if (Array.isArray(res.data?.contacts)) {
        setContacts(res.data.contacts);
        const optedIn = res.data.contacts.filter(c => c.opt_in === true);
        if (optedIn.length > 0) {
          setWizardSelectedContactId(prev => prev || optedIn[0].id);
          setWizardSelectedCompany(prev => prev || optedIn[0].company || '');
          setWizardSelectedIndustry(prev => prev || optedIn[0].sector || '');
          setWizardSelectedCustomContacts(prev => prev.size > 0 ? prev : new Set(optedIn.map(c => c.id)));
        }
        if (res.data.contacts.length === 0) {
          handleSyncSheets();
        }
      }
    } catch (err) {
      console.warn('Digital Nurturing contacts API warning:', err.message);
    }

    try {
      const cmpRes = await axios.get(`${API_BASE}/campaigns`, { timeout: 10000 });
      if (Array.isArray(cmpRes.data?.campaigns)) setCampaigns(cmpRes.data.campaigns);
      if (Array.isArray(cmpRes.data?.audit_logs)) setAuditLogs(cmpRes.data.audit_logs);
    } catch (err) {
      console.warn('Digital Nurturing campaigns API warning:', err.message);
    }

    try {
      const sRes = await axios.get(`${API_BASE}/sales/handoffs`, { timeout: 10000 });
      if (Array.isArray(sRes.data?.handoffs)) setSalesHandoffs(sRes.data.handoffs);
    } catch (err) {
      console.warn('Digital Nurturing sales handoffs API warning:', err.message);
    }

    try {
      const evtRes = await axios.get(`${API_BASE}/contacts/opt-events`, { timeout: 10000 });
      if (Array.isArray(evtRes.data?.events)) {
        setOptNotifications(evtRes.data.events);
      }
    } catch (evtErr) {
      // Keep initial/cached opt-events
    }
  };

  // Google Sheets contact sync runs through the backend so its configured source stays server-side.
  const handleSyncSheets = async () => {
    setIsSyncing(true);
    try {
      const res = await axios.post(`${API_BASE}/contacts/sync`, {}, { timeout: 30000 });
      if (!Array.isArray(res.data?.contacts)) {
        throw new Error('The contacts sync response did not contain a contact list.');
      }
      setContacts(res.data.contacts);
      const optedIn = res.data.contacts.filter(c => c.opt_in === true);
      if (optedIn.length > 0) {
        setWizardSelectedContactId(prev => prev || optedIn[0].id);
        setWizardSelectedCompany(prev => prev || optedIn[0].company || '');
        setWizardSelectedIndustry(prev => prev || optedIn[0].sector || '');
        setWizardSelectedCustomContacts(prev => prev.size > 0 ? prev : new Set(optedIn.map(c => c.id)));
      }
      showNotification(`Synchronized ${res.data.contacts.length} client leads from ${res.data.source || 'the configured source'}.`);
    } catch (err) {
      showNotification(`Could not synchronize contacts: ${err.response?.data?.error || err.message}`, true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Consent updates are reflected only after the backend records them.
  const handleToggleOptIn = async (contactId, explicitTarget) => {
    const targetContact = contacts.find(c => c.id === contactId);
    if (!targetContact) {
      showNotification('Contact not found. Refresh the contact list and try again.', true);
      return;
    }

    const newOptState = explicitTarget !== undefined ? Boolean(explicitTarget) : !targetContact.opt_in;
    try {
      const res = await axios.post(`${API_BASE}/contacts/${contactId}/toggle-opt-in`, {
        opt_in: newOptState,
        id: contactId,
        name: targetContact.name,
        email: targetContact.email
      });
      if (Array.isArray(res.data?.contacts)) setContacts(res.data.contacts);
      if (Array.isArray(res.data?.opt_events)) {
        setOptNotifications(res.data.opt_events);
        setUnreadNotifCount(res.data.opt_events.length);
      }
      showNotification({
        type: newOptState ? 'opt_in' : 'opt_out',
        title: newOptState ? 'Consent Update: Opted In' : 'Consent Update: Opted Out',
        name: targetContact.name,
        company: targetContact.company,
        text: newOptState
          ? `${targetContact.name} (${targetContact.company}) has OPTED IN for automated nurturing cadences.`
          : `${targetContact.name} (${targetContact.company}) has OPTED OUT of communications.`
      });
    } catch (err) {
      showNotification(`Could not save consent update: ${err.response?.data?.error || err.message}`, true);
    }
  };

  // Generate Sector Content
  const handleGenerateContent = async (contactToUse = null) => {
    const contact = contactToUse || contacts.find(c => c.id === selectedContactId) || contacts[0];
    if (!contact) {
      showNotification('Please select a lead first.', true);
      return;
    }
    if (contact.opt_in !== true) {
      showNotification(`${contact.name} has no recorded opt-in consent for automated campaigns.`, true);
      return;
    }

    setIsGenerating(true);
    const sector = contact.sector || contact.industry || targetSector || 'Technology';
    const isWelcome = selectedContentType === 'welcome';
    const isFestival = selectedContentType === 'festival_wish';
    const isContent = selectedContentType === 'content' || selectedContentType === 'case_study';

    let defaultTopic = `${sector} Enterprise Innovation & AI Digest`;
    let defaultCampaignName = `${sector} Sector Intelligence: ${defaultTopic}`;

    if (isWelcome) {
      defaultTopic = `Client Welcome & Partnership Orientation`;
      defaultCampaignName = `Welcome Sequence: ${contact.company}`;
    } else if (isFestival) {
      defaultTopic = `Festive Greetings & Executive Wishes 2026`;
      defaultCampaignName = `Executive Festive Greeting: ${contact.company}`;
    } else if (isContent) {
      defaultTopic = `${sector} Digital Transformation & Multi-Agent Case Study`;
      defaultCampaignName = `Case Study Briefing: ${contact.company}`;
    }

    const topic = customTopic.trim() || defaultTopic;
    const campaignName = defaultCampaignName;

    try {
      let preview = null;
      let generatedCampaign = null;
      try {
        const res = await axios.post(`${API_BASE}/campaigns/generate`, {
          campaign_name: campaignName,
          campaign_type: selectedContentType,
          topic: topic,
          sector: sector,
          contact_id: contact.id,
          contacts: [{ id: contact.id }],
          target_audience: `${sector} Sector Clients`,
          channel: 'email'
        }, { timeout: 30000 });

        if (res.data?.success === true && res.data?.content_source === 'workbench' && res.data?.preview && (res.data.preview.subject || res.data.preview.email_body)) {
          generatedCampaign = res.data.campaign || null;
          preview = {
            subject: res.data.preview.subject || '',
            email_body: res.data.preview.email_body || '',
            whatsapp_message: res.data.preview.whatsapp_message || '',
            content_source: res.data.content_source || res.data.preview.content_source || 'workbench',
            personalization_summary: res.data.preview.personalization_summary || ''
          };
        }
      } catch (apiErr) {
        console.warn('[handleGenerateContent] Backend API generate failed:', apiErr.message);
      }

      if (!preview || !preview.subject || preview.content_source !== 'workbench') {
        showNotification('SNS Workbench did not return generated campaign content. No preview was created.', true);
        return;
      }

      setGeneratedOutput({
        campaign_name: campaignName,
        campaign_type: selectedContentType,
        sector: sector,
        topic: topic,
        contact: contact,
        campaign_id: generatedCampaign?.id,
        subject: preview.subject,
        email_body: preview.email_body,
        whatsapp_message: preview.whatsapp_message,
        content_source: preview.content_source || 'workbench'
      });
      // Populate Campaign Wizard Step 5 preview and switch tab so generated newsletter is displayed immediately
      const allOptedIn = contacts.filter(cnt => cnt.opt_in === true);
      setWizardCampaignType(
        selectedContentType === 'newsletter' ? 'Newsletter' :
        selectedContentType === 'welcome' ? 'Welcome Message' :
        selectedContentType === 'festival' ? 'Festival / Occasion Greeting' : 'Industry Insights'
      );
      setWizardCampaignName(campaignName);
      // Default to All Past Clients so the campaign targets all opted-in leads by default
      setWizardAudienceType('All Past Clients');
      setWizardSelectedCustomContacts(new Set(allOptedIn.map(cnt => cnt.id)));
      setWizardSelectedIndustry(sector);
      setWizardSelectedCompany(contact.company || 'Client Organization');
      setWizardSelectedContactId(contact.id);
      setWizardBrief(topic);
      setWizardGeneratedContent(preview);
      setWizardEditedSubject(preview.subject);
      setWizardEditedBody(preview.email_body);
      setWizardIsEditing(false);
      setWizardStep(5);
      setActiveTab('create_campaign');

      if (preview.content_source === 'workbench') {
        await loadData();
        showNotification(`AI Personalization completed via SNS Workbench.`);
      } else {
        showNotification('SNS Workbench did not confirm campaign generation.', true);
      }
    } catch (err) {
      showNotification('Generation error: ' + err.message, true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Dedicated helper to cleanly open Campaign Wizard with reset audience targeting
  const handleOpenCreateCampaign = (initialAudienceType = 'All Past Clients', targetContact = null) => {
    const optedIn = contacts.filter(c => c.opt_in === true);
    setWizardStep(1);
    setWizardAudienceType(initialAudienceType);
    setWizardSelectedCustomContacts(new Set(optedIn.map(c => c.id)));
    if (targetContact) {
      setWizardSelectedContactId(targetContact.id);
      setWizardSelectedCompany(targetContact.company || '');
      setWizardSelectedIndustry(targetContact.sector || targetContact.industry || '');
    } else if (optedIn.length > 0) {
      setWizardSelectedContactId(optedIn[0].id);
      setWizardSelectedCompany(optedIn[0].company || '');
      setWizardSelectedIndustry(optedIn[0].sector || optedIn[0].industry || '');
    }
    setActiveTab('create_campaign');
  };

  // Audience resolution helper for Campaign Wizard
  const getWizardTargetRecipients = () => {
    const optedInContacts = contacts.filter(c => c.opt_in === true);
    if (wizardAudienceType === 'All Past Clients') {
      return optedInContacts;
    }
    if (wizardAudienceType === 'Custom Selection') {
      const selected = optedInContacts.filter(c => wizardSelectedCustomContacts.has(c.id));
      return selected.length > 0 ? selected : optedInContacts;
    }
    if (wizardAudienceType === 'Specific Client') {
      const match = optedInContacts.filter(c => c.id === wizardSelectedContactId);
      return match.length > 0 ? match : (optedInContacts.length > 0 ? [optedInContacts[0]] : []);
    }
    if (wizardAudienceType === 'Specific Industry') {
      return optedInContacts.filter(c => (c.sector || c.industry) === wizardSelectedIndustry);
    }
    if (wizardAudienceType === 'Specific Company') {
      return optedInContacts.filter(c => c.company === wizardSelectedCompany);
    }
    if (wizardAudienceType === 'New Clients') {
      return optedInContacts.filter(c => c.client_type === 'New Client');
    }
    if (wizardSelectedCustomContacts.size > 0) {
      const selected = optedInContacts.filter(c => wizardSelectedCustomContacts.has(c.id));
      if (selected.length > 0) return selected;
    }
    return optedInContacts;
  };

  const handleSelectAllOptedIn = () => {
    const optedIn = contacts.filter(c => c.opt_in === true);
    setWizardSelectedCustomContacts(new Set(optedIn.map(c => c.id)));
    setWizardAudienceType('All Past Clients');
    if (optedIn.length > 0) {
      setWizardSelectedContactId(optedIn[0].id);
      setWizardSelectedCompany(optedIn[0].company || '');
      setWizardSelectedIndustry(optedIn[0].sector || '');
    }
  };

  const handleDeselectAll = () => {
    setWizardSelectedCustomContacts(new Set());
    setWizardAudienceType('Custom Selection');
  };

  const handleToggleContactSelection = (contactId) => {
    const optedIn = contacts.filter(c => c.opt_in === true);
    setWizardSelectedCustomContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      if (next.size === optedIn.length && optedIn.length > 0) {
        setWizardAudienceType('All Past Clients');
      } else {
        setWizardAudienceType('Custom Selection');
      }
      return next;
    });
    const found = contacts.find(c => c.id === contactId);
    if (found && found.opt_in === true) {
      setWizardSelectedContactId(contactId);
      setWizardSelectedCompany(found.company || '');
      setWizardSelectedIndustry(found.sector || found.industry || '');
    }
  };

  const handleApplyTemplateInStep3 = (templateKey) => {
    const tmpl = NURTURE_TEMPLATES[templateKey];
    if (!tmpl) return;
    const typeMap = {
      Newsletter: 'Newsletter',
      Welcome: 'Welcome Message',
      Festival: 'Festival / Occasion Wish',
      Promotional: 'Promotional / Strategic Update'
    };
    const targetContact = contacts.find(c => c.id === wizardSelectedContactId && c.opt_in === true) || contacts.find(c => c.opt_in === true) || contacts[0];
    const typeStr = typeMap[templateKey] || 'Newsletter';
    const cName = tmpl.sample.campaign_name.replace('[Company]', targetContact?.company || 'Enterprise');

    setWizardCampaignType(typeStr);
    setWizardCampaignName(cName);
    setWizardBrief(tmpl.sample.brief);
    setWizardBriefError(false);
    if (tmpl.sample.occasion) {
      setWizardOccasion(tmpl.sample.occasion);
    }
    showNotification(`Loaded ${tmpl.name} brief & settings.`);
  };

  const handleSelectWizardType = (type) => {
    setWizardCampaignType(type);
    if (type === 'Newsletter') {
      setWizardCampaignName('Q4 Technology Intelligence Briefing');
    } else if (type === 'Welcome Message') {
      setWizardCampaignName('Executive Client Welcome Sequence 2026');
    } else if (type === 'Festival / Occasion Wish') {
      setWizardCampaignName('Diwali Executive Celebration 2026');
      setWizardOccasion('Diwali 2026');
    } else if (type === 'Promotional / Strategic Update') {
      setWizardCampaignName('SNS Square Autonomous Agent Capabilities Update');
    }
  };

  const handleUseTemplate = (templateKey, clientContactId = null) => {
    const tmpl = NURTURE_TEMPLATES[templateKey];
    if (!tmpl) return;
    const typeMap = {
      Newsletter: 'Newsletter',
      Welcome: 'Welcome Message',
      Festival: 'Festival / Occasion Wish',
      Promotional: 'Promotional / Strategic Update'
    };
    const contactId = clientContactId || templateSelectedContactId || wizardSelectedContactId;
    const targetContact = contacts.find(c => c.id === contactId && c.opt_in === true) || contacts.find(c => c.opt_in === true) || contacts[0];

    const typeStr = typeMap[templateKey] || 'Newsletter';
    const cName = tmpl.sample.campaign_name.replace('[Company]', targetContact?.company || 'Enterprise');
    const brief = tmpl.sample.brief;

    setWizardCampaignType(typeStr);
    setWizardCampaignName(cName);
    setWizardBrief(brief);
    setWizardBriefError(false);
    if (tmpl.sample.occasion) setWizardOccasion(tmpl.sample.occasion);
    if (targetContact) {
      setWizardSelectedContactId(targetContact.id);
      setWizardSelectedCompany(targetContact.company || '');
      setWizardSelectedIndustry(targetContact.sector || '');
    }
    setWizardStep(3);
    setActiveTab('create_campaign');
    showNotification(`Loaded ${tmpl.name} into Campaign Wizard.`);
  };

  const handleInstantGenerateTemplate = async (templateKey, clientContactId = null) => {
    const tmpl = NURTURE_TEMPLATES[templateKey];
    if (!tmpl) return;
    const typeMap = {
      Newsletter: 'Newsletter',
      Welcome: 'Welcome Message',
      Festival: 'Festival / Occasion Wish',
      Promotional: 'Promotional / Strategic Update'
    };
    const contactId = clientContactId || templateSelectedContactId || wizardSelectedContactId;
    const targetContact = contacts.find(c => c.id === contactId && c.opt_in === true) || contacts.find(c => c.opt_in === true) || contacts[0];

    const typeStr = typeMap[templateKey] || 'Newsletter';
    const cName = tmpl.sample.campaign_name.replace('[Company]', targetContact?.company || 'Enterprise');
    const brief = tmpl.sample.brief;

    setWizardCampaignType(typeStr);
    setWizardCampaignName(cName);
    setWizardBrief(brief);
    setWizardBriefError(false);
    if (tmpl.sample.occasion) setWizardOccasion(tmpl.sample.occasion);
    const allOptedIn = contacts.filter(c => c.opt_in === true);
    setWizardAudienceType('All Past Clients');
    setWizardSelectedCustomContacts(new Set(allOptedIn.map(c => c.id)));
    if (targetContact) {
      setWizardSelectedContactId(targetContact.id);
      setWizardSelectedCompany(targetContact.company || '');
      setWizardSelectedIndustry(targetContact.sector || '');
    }
    setActiveTab('create_campaign');
    await handleWizardGenerate(targetContact, brief, cName, typeStr);
  };

  const handleQuickGenerateFromStep1 = async (targetContactId = null) => {
    const effectiveBrief = wizardBrief.trim();
    if (!effectiveBrief) {
      setWizardBriefError(true);
      showNotification('Please enter a campaign brief in Step 3.', true);
      setWizardStep(3);
      return;
    }

    const contactId = targetContactId || wizardSelectedContactId;
    const targetContact = contacts.find(c => c.id === contactId && c.opt_in === true) || contacts.find(c => c.opt_in === true) || contacts[0];
    if (!targetContact) return;

    const allOptedIn = contacts.filter(c => c.opt_in === true);
    setWizardAudienceType('All Past Clients');
    setWizardSelectedCustomContacts(new Set(allOptedIn.map(c => c.id)));
    setWizardSelectedContactId(targetContact.id);
    setWizardSelectedCompany(targetContact.company || '');
    setWizardSelectedIndustry(targetContact.sector || '');

    await handleWizardGenerate(targetContact);
  };

  const handleWizardGenerate = async (contactOverride = null, briefOverride = null, nameOverride = null, typeOverride = null) => {
    const effectiveBrief = String(briefOverride !== null && briefOverride !== undefined ? briefOverride : wizardBrief).trim();
    if (!effectiveBrief) {
      setWizardBriefError(true);
      showNotification('Please enter a campaign brief.', true);
      setWizardStep(3);
      return;
    }

    const recipients = getWizardTargetRecipients();
    if (recipients.length === 0) {
      showNotification('Select at least one opted-in audience contact before generating a campaign.', true);
      return;
    }
    const primaryContact = contactOverride || (wizardAudienceType === 'Specific Client'
      ? recipients.find(c => c.id === wizardSelectedContactId)
      : recipients[0]);
    if (!primaryContact || !recipients.some(c => c.id === primaryContact.id)) {
      showNotification('The selected contact is not part of the opted-in campaign audience.', true);
      return;
    }
    setWizardSelectedContactId(primaryContact.id);
    setWizardIsGenerating(true);
    try {
      let preview = null;
      let generatedCampaign = null;
      const campaignName = nameOverride || wizardCampaignName;
      const effectiveType = typeOverride || wizardCampaignType;
      try {
        const res = await axios.post(`${API_BASE}/campaigns/generate`, {
          campaign_name: campaignName,
          campaign_type: effectiveType === 'Welcome Message' ? 'welcome' :
                         effectiveType === 'Festival / Occasion Wish' ? 'festival_wish' :
                         effectiveType === 'Promotional / Strategic Update' ? 'promotional' : 'newsletter',
          sector: primaryContact.sector || primaryContact.industry || 'Technology',
          contact_id: primaryContact.id,
          contacts: recipients.map(contact => ({ id: contact.id })),
          topic: effectiveBrief,
          developer_input: effectiveBrief,
          occasion: wizardOccasion || effectiveBrief,
          target_audience: wizardAudienceType === 'Specific Client' ? `${primaryContact.name} (${primaryContact.company})` : wizardAudienceType,
          channel: wizardChannels.email ? 'Email' : 'WhatsApp'
        }, { timeout: 30000 });

        if (res.data?.success === true && res.data?.content_source === 'workbench' && res.data?.preview && (res.data.preview.email_body || res.data.preview.subject)) {
          generatedCampaign = res.data.campaign || null;
          preview = {
            ...res.data.preview,
            content_source: res.data.content_source || res.data.preview.content_source || 'workbench'
          };
        }
      } catch (e) {
        console.warn('[handleWizardGenerate] Backend API generate failed:', e.message);
      }

      if (!preview || !preview.email_body || preview.content_source !== 'workbench') {
        showNotification('SNS Workbench did not return generated campaign content. No preview was created.', true);
        return;
      }

      setWizardGeneratedContent(preview);
      if (generatedCampaign?.id) setWizardGeneratedContent({ ...preview, campaign_id: generatedCampaign.id });
      setWizardEditedSubject(preview.subject || '');
      setWizardEditedBody(preview.email_body || '');
      setWizardStep(5);
      if (preview.content_source === 'workbench') {
        await loadData();
        showNotification(`AI Personalization completed via SNS Workbench.`);
      } else {
        showNotification('SNS Workbench did not confirm campaign generation.', true);
      }
    } catch (err) {
      showNotification('Generation error: ' + err.message, true);
    } finally {
      setWizardIsGenerating(false);
    }
  };

  const handleWizardDispatch = async () => {
    if (!wizardGeneratedContent) return;
    const recipients = getWizardTargetRecipients();
    if (recipients.length === 0) {
      showNotification('Select at least one opted-in audience contact before dispatching.', true);
      return;
    }
    const targetContact = wizardAudienceType === 'Specific Client'
      ? (contacts.find(c => c.id === wizardSelectedContactId) || recipients[0])
      : (recipients.length === 1 ? recipients[0] : null);

    setWizardIsDispatching(true);
    try {
      const activeSubject = wizardIsEditing ? wizardEditedSubject : (wizardGeneratedContent.subject || '');
      const activeBody = wizardIsEditing ? wizardEditedBody : (wizardGeneratedContent.email_body || '');

      let dispatchRes = null;
      try {
        dispatchRes = await axios.post(`${API_BASE}/campaigns/dispatch`, {
          campaign_id: wizardGeneratedContent.campaign_id,
          campaign_name: wizardCampaignName,
          campaign_type: wizardCampaignType,
          topic: wizardBrief,
          occasion: wizardOccasion,
          audience: wizardAudienceType,
          sector: targetContact?.sector || wizardSelectedIndustry || 'Technology',
          contact_id: targetContact?.id || (recipients.length === 1 ? recipients[0]?.id : null),
          contacts: recipients,
          channels: [wizardChannels.email ? 'Email' : null, wizardChannels.whatsapp ? 'WhatsApp' : null].filter(Boolean),
          image_url: wizardImage,
          content: {
            subject: activeSubject,
            email_body: activeBody,
            whatsapp_message: wizardGeneratedContent.whatsapp_message,
            image_url: wizardImage
          }
        }, { timeout: 35000 });
      } catch (e) {
        console.warn('[handleWizardDispatch] Workbench dispatch network warning:', e.message);
      }
      if (!dispatchRes?.data?.success || !dispatchRes?.data?.campaign) {
        throw new Error(dispatchRes?.data?.error || 'Workbench did not confirm campaign delivery.');
      }

      if (Array.isArray(dispatchRes?.data?.campaigns)) {
        setCampaigns(dispatchRes.data.campaigns);
      }
      if (Array.isArray(dispatchRes?.data?.contacts)) {
        setContacts(dispatchRes.data.contacts);
      }
      if (Array.isArray(dispatchRes?.data?.sales_handoffs)) {
        setSalesHandoffs(dispatchRes.data.sales_handoffs);
      }
      if (Array.isArray(dispatchRes?.data?.audit_logs)) {
        setAuditLogs(dispatchRes.data.audit_logs);
      }

      // Immediately sync fresh data from backend store
      try {
        await loadData();
      } catch (loadErr) {
        console.warn('[handleWizardDispatch] Post-dispatch loadData warning:', loadErr.message);
      }

      setEditingDraftId(null);
      setWizardStep(1);
      setWizardBrief('');
      setWizardGeneratedContent(null);
      setWizardIsEditing(false);
      setWizardEditedSubject('');
      setWizardEditedBody('');

      showNotification(`Campaign "${wizardCampaignName || 'Campaign'}" successfully approved & dispatched via SNS Workbench!`);
      setActiveTab('campaigns');
    } catch (err) {
      showNotification('Dispatch error: ' + err.message, true);
    } finally {
      setWizardIsDispatching(false);
    }
  };

  // Save Campaign as Draft
  const handleSaveDraft = async () => {
    const recipients = getWizardTargetRecipients();
    const activeSubject = wizardIsEditing ? wizardEditedSubject : (wizardEditedSubject || wizardGeneratedContent?.subject || wizardCampaignName);
    const activeBody = wizardIsEditing ? wizardEditedBody : (wizardEditedBody || wizardGeneratedContent?.email_body || wizardBrief);
    const typeShort =
      wizardCampaignType === 'Welcome Message' ? 'Welcome' :
      wizardCampaignType === 'Festival / Occasion Wish' ? 'Festival' :
      wizardCampaignType === 'Promotional / Strategic Update' ? 'Promotional' : 'Newsletter';

    const draftFields = {
      name: wizardCampaignName || 'Draft Campaign',
      type: typeShort,
      type_key: typeShort.toLowerCase(),
      target_audience: wizardAudienceType === 'All Past Clients' ? 'All Past Clients' : wizardAudienceType,
      audience: wizardAudienceType === 'All Past Clients' ? 'All Past Clients' : wizardAudienceType,
      created_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      sent_date: '—',
      recipients: recipients.length,
      status: 'Draft',
      engagement: '—',
      channel: [wizardChannels.email ? 'Email' : null, wizardChannels.whatsapp ? 'WhatsApp' : null].filter(Boolean).join(' + ') || 'Email',
      subject: activeSubject,
      email_body: activeBody,
      whatsapp_message: wizardGeneratedContent?.whatsapp_message || '',
      image_url: wizardImage || null,
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0 }
    };

    try {
      const response = editingDraftId
        ? await axios.put(`${API_BASE}/campaigns/${encodeURIComponent(editingDraftId)}`, draftFields, { timeout: 10000 })
        : await axios.post(`${API_BASE}/campaigns/draft`, {
            campaign_name: draftFields.name,
            campaign_type: draftFields.type,
            topic: wizardBrief,
            occasion: wizardOccasion,
            audience: draftFields.target_audience,
            channels: [wizardChannels.email ? 'Email' : null, wizardChannels.whatsapp ? 'WhatsApp' : null].filter(Boolean),
            image_url: wizardImage,
            content: {
              subject: activeSubject,
              email_body: activeBody,
              whatsapp_message: draftFields.whatsapp_message,
              image_url: wizardImage
            }
          }, { timeout: 10000 });
      if (!response.data?.success || !response.data?.campaign) {
        throw new Error(response.data?.error || 'The backend did not save the draft.');
      }
      const savedCampaign = response.data.campaign;
      setCampaigns(prev => [savedCampaign, ...prev.filter(c => c.id !== savedCampaign.id)]);
      setEditingDraftId(null);
      showNotification(`Campaign "${savedCampaign.name}" saved as Draft.`);
      setActiveTab('campaigns');
    } catch (err) {
      showNotification(`Could not save draft: ${err.response?.data?.error || err.message}`, true);
    }
  };

  const handleDeleteCampaign = async (campaign) => {
    if (!window.confirm(`Delete campaign "${campaign.name}"? This will permanently remove its campaign history.`)) return;
    setDeletingCampaignId(campaign.id);
    try {
      const response = await axios.delete(`${API_BASE}/campaigns/${encodeURIComponent(campaign.id)}`, { timeout: 10000 });
      if (!response.data?.success) throw new Error(response.data?.error || 'The backend did not confirm deletion.');
      await loadData();
      showNotification(`Campaign "${campaign.name}" deleted.`);
    } catch (err) {
      showNotification(`Could not delete campaign: ${err.response?.data?.error || err.message}`, true);
    } finally {
      setDeletingCampaignId(null);
    }
  };

  // Resume Draft in Wizard
  const handleResumeDraft = (draft) => {
    setEditingDraftId(draft.id);
    setWizardCampaignName(draft.name || '');
    setWizardBrief(draft.brief || draft.topic || draft.subject || '');
    setWizardOccasion(draft.occasion || 'Diwali 2026');
    setWizardAudienceType(draft.target_audience || 'All Past Clients');
    setWizardImage(draft.image_url || null);
    setWizardImageName(draft.image_url ? 'Attached Picture' : '');
    setWizardEditedSubject(draft.subject || '');
    setWizardEditedBody(draft.email_body || '');
    setWizardGeneratedContent({
      subject: draft.subject,
      email_body: draft.email_body,
      whatsapp_message: draft.whatsapp_message
    });
    setWizardStep(5);
    setWizardIsEditing(true);
    setActiveTab('create_campaign');
    showNotification(`Opened draft "${draft.name}" for editing.`);
  };

  // Upload Picture / Banner
  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file (PNG, JPG, WebP, etc.)', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target.result;
      setWizardImage(dataUri);
      setWizardImageName(file.name);
      showNotification(`Attached picture: ${file.name}`);

      try {
        const res = await axios.post(`${API_BASE}/campaigns/upload-image`, {
          image_data: dataUri,
          filename: file.name
        }, { timeout: 15000 });
        if (res.data?.url) {
          setWizardImage(res.data.url);
          console.log('[handleImageUpload] Hosted image URL ready:', res.data.url);
        }
      } catch (err) {
        console.warn('[handleImageUpload] Background upload warning:', err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  // Dispatch Campaign
  const handleDispatchCampaign = async () => {
    if (!generatedOutput) return;
    setIsDispatching(true);
    try {
      let dispatchRes = null;
      try {
        dispatchRes = await axios.post(`${API_BASE}/campaigns/dispatch`, {
          campaign_id: generatedOutput.campaign_id,
          campaign_name: generatedOutput.campaign_name,
          campaign_type: generatedOutput.campaign_type,
          topic: generatedOutput.topic,
          sector: generatedOutput.sector,
          contact_id: generatedOutput.contact?.id,
          contacts: [generatedOutput.contact || { id: generatedOutput.contact?.id }],
          audience: `${generatedOutput.sector} Clients`,
          channels: ['Email', 'WhatsApp'],
          image_url: generatedOutput.image_url || wizardImage,
          content: {
            subject: generatedOutput.subject,
            email_body: generatedOutput.email_body,
            whatsapp_message: generatedOutput.whatsapp_message,
            image_url: generatedOutput.image_url || wizardImage
          }
        }, { timeout: 35000 });
      } catch (e) {
        console.warn('[handleDispatchCampaign] Workbench dispatch warning:', e.message);
      }
      if (!dispatchRes?.data?.success || !dispatchRes?.data?.campaign) {
        throw new Error(dispatchRes?.data?.error || 'Workbench did not confirm campaign delivery.');
      }

      if (dispatchRes?.data?.campaigns) setCampaigns(dispatchRes.data.campaigns);
      if (dispatchRes?.data?.contacts) setContacts(dispatchRes.data.contacts);
      if (dispatchRes?.data?.sales_handoffs) setSalesHandoffs(dispatchRes.data.sales_handoffs);
      if (dispatchRes?.data?.audit_logs) setAuditLogs(dispatchRes.data.audit_logs);

      await loadData();

      const typeLabel =
        generatedOutput.campaign_type === 'welcome' ? 'Welcome Mail' :
        generatedOutput.campaign_type === 'newsletter' ? 'Sector Newsletter' :
        generatedOutput.campaign_type === 'content' || generatedOutput.campaign_type === 'case_study' ? 'Content / Case Study' :
        generatedOutput.campaign_type === 'festival_wish' ? 'Festival Greeting' : 'Campaign';

      showNotification(`${typeLabel} dispatched to ${generatedOutput.contact?.name} (${generatedOutput.contact?.company}) via SNS Workbench!`);
      setActiveTab('dashboard');
    } catch (err) {
      showNotification('Dispatch error: ' + err.message, true);
    } finally {
      setIsDispatching(false);
    }
  };

  // Import Leads from Contact Extraction Agent into Digital Nurturing
  const handleImportExtractedLeads = async () => {
    if (selectedExtractedIds.size === 0) {
      showNotification('Please select at least one contact to import.', true);
      return;
    }

    const toImport = extractedLeads.filter(l => selectedExtractedIds.has(l.id || l.name || l.full_name));
    const newNurtureLeads = toImport.map((lead, index) => {
      const name = lead.full_name || lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || '';
      const sourceId = lead.id || lead.contact_id || `${name}-${lead.company || ''}-${index}`;
      const safeId = String(sourceId).replace(/[^a-zA-Z0-9_-]/g, '-');
      const sector = lead.sector || lead.industry || lead.sector_industry || '';
      return {
        id: `CNT-EXT-${safeId}`,
        name,
        designation: lead.designation || '',
        company: lead.company || '',
        email: lead.email && lead.email !== 'Missing' ? lead.email : '',
        phone: lead.phone && lead.phone !== 'Missing' ? lead.phone : '',
        sector,
        industry: sector,
        client_type: 'Extracted Lead',
        previous_interaction: 'Imported from Contact Data Extraction Agent',
        status: 'Pending Consent',
        opt_in: false,
        location: [lead.city, lead.state, lead.country].filter(Boolean).join(', '),
        timeline: [
          { date: new Date().toLocaleDateString(), title: 'Imported from Contact Extraction Agent', detail: 'Consent is required before this contact can receive nurturing campaigns.' }
        ]
      };
    }).filter(lead => lead.name);

    if (newNurtureLeads.length === 0) {
      showNotification('The selected extraction results do not contain a contact name or email.', true);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/contacts/import`, { contacts: newNurtureLeads });
      if (!res.data?.success) throw new Error(res.data?.error || 'Contact import failed.');
      if (Array.isArray(res.data.contacts)) setContacts(res.data.contacts);
      showNotification(`Imported ${res.data.imported || 0} new contacts. Consent is required before campaign delivery.`);
      setIsImportFromExtractionOpen(false);
      setSelectedExtractedIds(new Set());
    } catch (err) {
      showNotification(`Could not import extracted contacts: ${err.response?.data?.error || err.message}`, true);
    }
  };

  // Filtered Leads
  const safeContacts = Array.isArray(contacts) ? contacts.filter(Boolean) : [];
  const filteredContacts = safeContacts.filter(c => {
    if (!c) return false;
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      !q ||
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.company || '').toLowerCase().includes(q) ||
      String(c.email || '').toLowerCase().includes(q) ||
      String(c.sector || '').toLowerCase().includes(q) ||
      String(c.location || '').toLowerCase().includes(q);

    const secFilter = String(sectorFilter || 'All').toLowerCase();
    const matchesSector =
      secFilter === 'all' ||
      String(c.sector || '').toLowerCase() === secFilter ||
      String(c.industry || '').toLowerCase() === secFilter;

    const matchesOptIn =
      optInFilter === 'All' ||
      (optInFilter === 'opted_in' && c.opt_in === true) ||
      (optInFilter === 'opted_out' && c.opt_in === false);

    return matchesSearch && matchesSector && matchesOptIn;
  });

  // KPI calculations
  const totalClients = safeContacts.length;
  const optedInCount = safeContacts.filter(c => c.opt_in === true).length;
  const optedOutCount = safeContacts.filter(c => c.opt_in === false).length;
  const highIntentCount = safeContacts.filter(c =>
    c.response_intent === 'Interested' ||
    c.sales_handoff_status === 'Handed Off to Sales' ||
    c.sales_handoff_status === 'Hot Lead' ||
    c.engagement_state === 'Replied'
  ).length;

  const sectorsList = Array.from(new Set(safeContacts.map(c => c.sector || c.industry || 'Unspecified'))).filter(Boolean);
  const consentPercent = totalClients ? Math.round((optedInCount / totalClients) * 100) : 0;

  const filteredOptNotifications = (Array.isArray(optNotifications) ? optNotifications : []).filter(n => {
    if (!n) return false;
    if (notifFilter === 'opt_in') return n.type === 'opt_in';
    if (notifFilter === 'opt_out') return n.type === 'opt_out';
    return true;
  });

  return (
    <div className="dn-root">
      {/* ── Sub Navigation Bar ── */}
      <div className="dn-subbar">
        <div className="dn-subbar-left">
          <div className="dn-subbar-tabs">
            <button
              className={`dn-subbar-tab ${activeTab === 'leads' ? 'active' : ''}`}
              onClick={() => setActiveTab('leads')}
            >
              <Users size={14} /> Client Leads ({totalClients})
            </button>
            <button
              className={`dn-subbar-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={14} /> Executive Dashboard
            </button>
            <button
              className={`dn-subbar-tab ${(activeTab === 'create_campaign' || activeTab === 'generator') ? 'active' : ''}`}
              onClick={() => handleOpenCreateCampaign('All Past Clients')}
            >
              <Plus size={14} /> Create Campaign
            </button>
            <button
              className={`dn-subbar-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveTab('campaigns')}
            >
              <Calendar size={14} /> Campaigns ({campaigns.length})
            </button>
            <button
              className={`dn-subbar-tab ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              <Layers size={14} /> Templates
            </button>
            <button
              className={`dn-subbar-tab ${activeTab === 'engagement' ? 'active' : ''}`}
              onClick={() => setActiveTab('engagement')}
            >
              <Activity size={14} /> Engagement
            </button>
            <button
              className={`dn-subbar-tab ${activeTab === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveTab('workflow')}
            >
              <Sliders size={14} /> SNS Workbench Flow
            </button>
          </div>
        </div>

        <div className="dn-subbar-right">
          {/* Consent Notifications Button & Dropdown */}
          <div className="dn-notif-container">
            <button
              className={`dn-btn dn-btn-secondary dn-btn-sm dn-notif-trigger-btn ${unreadNotifCount > 0 ? 'has-unread' : ''}`}
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!isNotifOpen) setUnreadNotifCount(0);
              }}
              title="Consent & Opt-In / Opt-Out Notifications"
            >
              <Bell size={13} className={unreadNotifCount > 0 ? 'bell-ringing' : ''} />
              <span>Consent Alerts</span>
              {unreadNotifCount > 0 ? (
                <span className="dn-notif-counter-badge">{unreadNotifCount}</span>
              ) : (
                <span className="dn-notif-counter-badge muted">{optNotifications.length}</span>
              )}
            </button>

            {isNotifOpen && (
              <div className="dn-notif-dropdown">
                <div className="dn-notif-header">
                  <div className="dn-notif-header-left">
                    <div className="dn-notif-bell-icon-wrap">
                      <Bell size={14} color="#2563eb" />
                    </div>
                    <div>
                      <div className="dn-notif-title">Consent Notifications</div>
                      <div className="dn-notif-subtitle">Tracking client opt-in & opt-out updates</div>
                    </div>
                  </div>
                  <div className="dn-notif-header-right">
                    <button
                      className="dn-notif-action-btn"
                      onClick={() => setUnreadNotifCount(0)}
                      title="Mark all as read"
                    >
                      <CheckCheck size={12} /> Mark Read
                    </button>
                    <button
                      className="dn-notif-close-btn"
                      onClick={() => setIsNotifOpen(false)}
                      title="Close notifications"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="dn-notif-filter-bar">
                  <button
                    className={`dn-notif-filter-pill ${notifFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setNotifFilter('all')}
                  >
                    All ({optNotifications.length})
                  </button>
                  <button
                    className={`dn-notif-filter-pill opt-in ${notifFilter === 'opt_in' ? 'active' : ''}`}
                    onClick={() => setNotifFilter('opt_in')}
                  >
                    Opted In ({optNotifications.filter(n => n.type === 'opt_in').length})
                  </button>
                  <button
                    className={`dn-notif-filter-pill opt-out ${notifFilter === 'opt_out' ? 'active' : ''}`}
                    onClick={() => setNotifFilter('opt_out')}
                  >
                    Opted Out ({optNotifications.filter(n => n.type === 'opt_out').length})
                  </button>
                </div>

                {/* Notifications List */}
                <div className="dn-notif-list">
                  {filteredOptNotifications.length === 0 ? (
                    <div className="dn-notif-empty">
                      <Inbox size={26} color="#94a3b8" />
                      <p>No notifications found for this filter.</p>
                    </div>
                  ) : (
                    filteredOptNotifications.map((notif, idx) => (
                      <div
                        key={notif.id || idx}
                        className={`dn-notif-item ${notif.type === 'opt_in' ? 'is-opt-in' : 'is-opt-out'}`}
                        onClick={() => {
                          const matched = contacts.find(c => c.id === notif.contactId || c.email === notif.email || c.name === notif.name);
                          if (matched) {
                            setSelectedLead(matched);
                            setActiveTab('leads');
                            setIsNotifOpen(false);
                          }
                        }}
                      >
                        <div className={`dn-notif-icon-circle ${notif.type === 'opt_in' ? 'green' : 'red'}`}>
                          {notif.type === 'opt_in' ? <UserCheck size={14} /> : <UserX size={14} />}
                        </div>
                        <div className="dn-notif-content">
                          <div className="dn-notif-row">
                            <span className="dn-notif-name">{notif.name}</span>
                            <span className={`dn-badge-sm ${notif.type === 'opt_in' ? 'badge-opt-in' : 'badge-opt-out'}`}>
                              {notif.type === 'opt_in' ? 'OPTED IN' : 'OPTED OUT'}
                            </span>
                          </div>
                          <div className="dn-notif-org">
                            {notif.company} • <span className="dn-notif-email">{notif.email}</span>
                          </div>
                          <div className="dn-notif-detail">{notif.detail || notif.channel}</div>
                          <div className="dn-notif-meta">
                            <span className="dn-notif-source">{notif.channel || 'System Consent'}</span>
                            <span className="dn-notif-dot">•</span>
                            <span className="dn-notif-time">{notif.formattedTime || 'Recently'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="dn-notif-footer">
                  <span>Audited compliance via Preference Engine</span>
                  <button
                    className="dn-btn-link dn-btn-xs"
                    onClick={() => {
                      setActiveTab('leads');
                      setIsNotifOpen(false);
                    }}
                  >
                    View Leads Directory →
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className="dn-btn dn-btn-secondary dn-btn-sm"
            onClick={handleSyncSheets}
            disabled={isSyncing}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin-icon' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Sheet'}
          </button>

          <button
            className="dn-btn dn-btn-primary dn-btn-sm"
            onClick={() => handleOpenCreateCampaign('All Past Clients')}
          >
            <Plus size={13} /> Create Campaign
          </button>
        </div>
      </div>

      <div className="dn-content">
        {/* ── KPI Stats Cards ── */}
        <div className="dn-stats-row">
          <div className="dn-stat-card">
            <div className="dn-stat-icon">
              <Users size={18} />
            </div>
            <div className="dn-stat-info">
              <div className="dn-stat-label">Total Nurtured Leads</div>
              <div className="dn-stat-value">{totalClients}</div>
            </div>
          </div>

          <div className="dn-stat-card">
            <div className="dn-stat-icon">
              <UserCheck size={18} />
            </div>
            <div className="dn-stat-info">
              <div className="dn-stat-label">Opted-In (Active Cadences)</div>
              <div className="dn-stat-value">{optedInCount}</div>
            </div>
          </div>

          <div className="dn-stat-card">
            <div className="dn-stat-icon">
              <Flame size={18} />
            </div>
            <div className="dn-stat-info">
              <div className="dn-stat-label">High-Intent Leads</div>
              <div className="dn-stat-value">{highIntentCount}</div>
            </div>
          </div>

          <div className="dn-stat-card">
            <div className="dn-stat-icon">
              <Layers size={18} />
            </div>
            <div className="dn-stat-info">
              <div className="dn-stat-label">Industry Sectors</div>
              <div className="dn-stat-value">{sectorsList.length}</div>
            </div>
          </div>

          <div className="dn-stat-card">
            <div className="dn-stat-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="dn-stat-info">
              <div className="dn-stat-label">Opted-Out Clients</div>
              <div className="dn-stat-value">{optedOutCount}</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1: CLIENT LEADS DIRECTORY
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'leads' && (
          <div className="dn-panel">
            <div className="dn-panel-header">
              <div className="dn-panel-title-wrap">
                <div className="dn-panel-title">
                  <Users size={17} color="#0f172a" />
                  Client Leads Directory
                  <span className="dn-badge dn-badge-gray">{filteredContacts.length} Leads</span>
                </div>
                <div className="dn-panel-subtitle">
                  Synchronized with Google Sheets and SNS Square Agent Workbench. Manage opt-in status, trigger automated cadences, and review telemetry.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="dn-btn dn-btn-primary dn-btn-sm"
                  style={{ background: '#2563eb', color: '#ffffff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleOpenCreateCampaign('All Past Clients')}
                >
                  <Sparkles size={13} /> Nurture All {optedInCount} Opted-In Clients
                </button>
                {NURTURE_SHEET_MANAGEMENT_URL && (
                  <a
                    href={NURTURE_SHEET_MANAGEMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dn-btn dn-btn-secondary dn-btn-sm"
                  >
                    <ExternalLink size={13} /> Open Google Sheet
                  </a>
                )}
              </div>
            </div>

            {/* Live Consent Activity & Opt-In/Opt-Out Notification Banner */}
            <div className="dn-consent-live-hub">
              <div className="dn-consent-hub-top">
                <div className="dn-consent-hub-left">
                  <div className="dn-consent-hub-headline">
                    <span className="dn-consent-live-indicator" />
                    <span className="dn-consent-hub-title">Live Client Consent & Opt-In / Opt-Out Status</span>
                    <span className="dn-consent-hub-rate-badge">
                      {consentPercent}% with recorded opt-in consent
                    </span>
                  </div>
                  <div className="dn-consent-hub-desc">
                    Active notifications stream when clients opt in for intelligence cadences or unsubscribe.
                  </div>
                </div>

                <div className="dn-consent-hub-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className={`dn-consent-mini-metric in ${optInFilter === 'opted_in' ? 'active-pill' : ''}`}
                    onClick={() => setOptInFilter(optInFilter === 'opted_in' ? 'All' : 'opted_in')}
                    title="Filter to Opted In leads"
                  >
                    <UserCheck size={14} />
                    <span><strong>{optedInCount}</strong> Opted In</span>
                  </button>

                  <button
                    className={`dn-consent-mini-metric out ${optInFilter === 'opted_out' ? 'active-pill' : ''}`}
                    onClick={() => setOptInFilter(optInFilter === 'opted_out' ? 'All' : 'opted_out')}
                    title="Filter to Opted Out leads"
                  >
                    <UserX size={14} />
                    <span><strong>{optedOutCount}</strong> Opted Out</span>
                  </button>

                  <button
                    type="button"
                    className="dn-btn dn-btn-primary dn-btn-sm"
                    style={{ background: '#16a34a', color: '#ffffff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', marginLeft: 4 }}
                    onClick={() => handleOpenCreateCampaign('All Past Clients')}
                    title="Create and dispatch campaign to all opted-in clients"
                  >
                    <Send size={13} /> Send Campaign to All {optedInCount} Opted-In Clients
                  </button>
                </div>
              </div>

              {optNotifications.length > 0 && (
                <div className="dn-consent-hub-ticker">
                  <div className="dn-consent-ticker-left">
                    <span className="dn-consent-ticker-label">LATEST CONSENT NOTIFICATION:</span>
                    <span className={`dn-consent-ticker-tag ${optNotifications[0].type === 'opt_in' ? 'in' : 'out'}`}>
                      {optNotifications[0].type === 'opt_in' ? 'OPTED IN' : 'OPTED OUT'}
                    </span>
                    <span className="dn-consent-ticker-name">
                      {optNotifications[0].name} ({optNotifications[0].company})
                    </span>
                    <span className="dn-consent-ticker-time">• {optNotifications[0].formattedTime || 'Just now'}</span>
                  </div>
                  <button
                    className="dn-consent-ticker-bell-btn"
                    onClick={() => {
                      setIsNotifOpen(true);
                      setUnreadNotifCount(0);
                    }}
                    title="Open notifications panel"
                  >
                    <Bell size={12} /> View Notification Center ({optNotifications.length}) →
                  </button>
                </div>
              )}
            </div>

            {/* Filter Bar */}
            <div className="dn-filter-bar">
              <div className="dn-filter-group">
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 4 }}>Sector:</span>
                <button
                  className={`dn-filter-pill ${sectorFilter === 'All' ? 'active' : ''}`}
                  onClick={() => setSectorFilter('All')}
                >
                  All
                </button>
                {sectorsList.map(sec => (
                  <button
                    key={sec}
                    className={`dn-filter-pill ${sectorFilter === sec ? 'active' : ''}`}
                    onClick={() => setSectorFilter(sec)}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="dn-filter-group">
                  <button
                    className={`dn-filter-pill ${optInFilter === 'All' ? 'active' : ''}`}
                    onClick={() => setOptInFilter('All')}
                  >
                    All Clients ({totalClients})
                  </button>
                  <button
                    className={`dn-filter-pill ${optInFilter === 'opted_in' ? 'active' : ''}`}
                    onClick={() => setOptInFilter('opted_in')}
                  >
                    Opted-In Only ({optedInCount})
                  </button>
                  <button
                    className={`dn-filter-pill ${optInFilter === 'opted_out' ? 'active' : ''}`}
                    onClick={() => setOptInFilter('opted_out')}
                  >
                    Opted-Out ({optedOutCount})
                  </button>
                </div>

                <div className="dn-search-input-wrap">
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    className="dn-search-input"
                    placeholder="Search client, role, company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="dn-table-wrap">
              <table className="dn-table">
                <thead>
                  <tr>
                    <th>Client Name & Role</th>
                    <th>Company & Location</th>
                    <th>Sector / Industry</th>
                    <th>Contact Information</th>
                    <th>Opt-In Status</th>
                    <th>Engagement & Intent</th>
                    <th>Lifecycle Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        No leads found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map(c => {
                      const isOptedIn = c.opt_in === true;
                      const sector = c.sector || c.industry || 'Unspecified';
                      const sectorBadgeClass = 'dn-badge-gray';

                      const initials = c.name
                        ? c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        : 'CL';

                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="dn-client-cell">
                              <div className="dn-avatar">{initials}</div>
                              <div>
                                <div className="dn-client-name">{c.name}</div>
                                <div className="dn-client-role">{c.designation}</div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="dn-company-name">{c.company}</div>
                            <div className="dn-location-text">{c.location || `${c.city || ''}, ${c.state || ''}`}</div>
                          </td>

                          <td>
                            <span className={`dn-badge ${sectorBadgeClass}`}>
                              {sector}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontSize: 12.5, color: '#0f172a' }}>{c.email}</div>
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.phone}</div>
                          </td>

                          <td>
                            {isOptedIn ? (
                              <span
                                className="dn-badge dn-badge-green"
                                title="Client has recorded opt-in consent for automated nurturing"
                              >
                                <CheckCircle2 size={12} /> Opted In
                              </span>
                            ) : c.opt_in === false ? (
                              <span
                                className="dn-badge dn-badge-red"
                                title="Client has opted out of automated nurturing"
                              >
                                <AlertTriangle size={12} /> Opted Out
                              </span>
                            ) : (
                              <span
                                className="dn-badge dn-badge-amber"
                                title="Pending explicit consent"
                              >
                                <AlertCircle size={12} /> Pending Consent
                              </span>
                            )}
                          </td>

                          <td>
                            <div>
                              <span className="dn-badge dn-badge-gray" style={{ fontSize: 11 }}>
                                {c.engagement_state || 'Not reported'}
                              </span>
                            </div>
                            {c.response_intent && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                                Intent: <strong>{c.response_intent}</strong>
                              </div>
                            )}
                          </td>

                          <td>
                            <span className="dn-badge dn-badge-gray">
                              In Nurturing
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <a
                                href={`${APP_ORIGIN}/preferences?id=${encodeURIComponent(c.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dn-btn dn-btn-secondary dn-btn-sm"
                                title="Open Client Preference & Unsubscribe Portal"
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <ExternalLink size={12} color="#475569" /> Preferences
                              </a>

                              <button
                                className="dn-btn dn-btn-secondary dn-btn-sm"
                                onClick={() => handleToggleOptIn(c.id, !isOptedIn)}
                                title={isOptedIn ? 'Click to Opt Out client' : 'Click to Opt In client'}
                              >
                                {isOptedIn ? (
                                  <>
                                    <ToggleRight size={14} color="#166534" /> Opt Out
                                  </>
                                ) : (
                                  <>
                                    <ToggleLeft size={14} color="#64748b" /> Opt In
                                  </>
                                )}
                              </button>

                              <button
                                className="dn-btn dn-btn-primary dn-btn-sm"
                                onClick={() => {
                                  setSelectedContactId(c.id);
                                  setTargetSector(sector);
                                  handleGenerateContent(c);
                                }}
                                disabled={!isOptedIn}
                                title={!isOptedIn ? 'Client opted out' : 'Generate tailored sector newsletter'}
                              >
                                <Sparkles size={12} /> Newsletter
                              </button>

                              <button
                                className="dn-btn dn-btn-secondary dn-btn-sm"
                                onClick={() => setSelectedLead(c)}
                                title="View Lead Details"
                              >
                                Profile
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2: EXECUTIVE DASHBOARD
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Zoho CRM Top KPI Strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #0066cc', borderRadius: 6, padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL LEADS</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{totalClients}</div>
                <div style={{ fontSize: 11.5, color: '#0066cc', marginTop: 4, fontWeight: 500 }}>Nurturing Active</div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #2e7d32', borderRadius: 6, padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>OPTED IN (ACTIVE)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d32', marginTop: 4 }}>{optedInCount}</div>
                <div style={{ fontSize: 11.5, color: '#2e7d32', marginTop: 4, fontWeight: 500 }}>{consentPercent}% with recorded opt-in consent</div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #4f46e5', borderRadius: 6, padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CAMPAIGNS SENT</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#4f46e5', marginTop: 4 }}>{campaigns.filter(c => c.status === 'Sent').length}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>Workbench-confirmed dispatches</div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #ed6c02', borderRadius: 6, padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SALES READY (HOT)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ed6c02', marginTop: 4 }}>{salesHandoffs.length}</div>
                <div style={{ fontSize: 11.5, color: '#ed6c02', marginTop: 4, fontWeight: 500 }}>Qualified for Sales Handoff</div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #64748b', borderRadius: 6, padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>OPTED OUT</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{optedOutCount}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>Suppressed Accounts</div>
              </div>
            </div>

            {/* ── Row 1: Pipeline Funnel + Sector Distribution ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
              {/* Widget 1: Pipeline Funnel */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Nurturing Pipeline by Stage</div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Active Conversion Funnel</span>
                </div>
                {(() => {
                  const safeCampaigns = Array.isArray(campaigns) ? campaigns.filter(Boolean) : [];
                  const sentCampaigns = safeCampaigns.filter(c => c && c.status === 'Sent');
                  const hasDeliveryMetrics = sentCampaigns.some(c => Number.isFinite(c?.metrics?.delivered));
                  const hasOpenMetrics = sentCampaigns.some(c => Number.isFinite(c?.metrics?.opened));
                  const hasReplyMetrics = sentCampaigns.some(c => Number.isFinite(c?.metrics?.replied));
                  const deliveredCount = sentCampaigns.reduce((acc, c) => acc + (Number.isFinite(c?.metrics?.delivered) ? c.metrics.delivered : 0), 0);
                  const openedCount = sentCampaigns.reduce((acc, c) => acc + (Number.isFinite(c?.metrics?.opened) ? c.metrics.opened : 0), 0);
                  const repliedCount = sentCampaigns.reduce((acc, c) => acc + (Number.isFinite(c?.metrics?.replied) ? c.metrics.replied : 0), 0);
                  const hotCount = Array.isArray(salesHandoffs) ? salesHandoffs.length : 0;

                  const deliveryDenominator = sentCampaigns.reduce((acc, c) => {
                    if (!Number.isFinite(c?.metrics?.delivered)) return acc;
                    return acc + (Number.isFinite(c?.metrics?.total_recipients) ? c.metrics.total_recipients : (Number.isFinite(c?.recipients) ? c.recipients : 0));
                  }, 0);
                  const deliveredPct = deliveryDenominator > 0 ? Math.min(100, Math.round((deliveredCount / deliveryDenominator) * 100)) : 0;
                  const openedPct = hasOpenMetrics && deliveredCount > 0 ? Math.min(100, Math.round((openedCount / deliveredCount) * 100)) : 0;
                  const repliedPct = hasReplyMetrics && deliveredCount > 0 ? Math.min(100, Math.round((repliedCount / deliveredCount) * 100)) : 0;
                  const hotPct = deliveryDenominator > 0 ? Math.min(100, Math.round((hotCount / deliveryDenominator) * 100)) : 0;

                  return (
                    <div style={{ padding: 18 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>1. Leads Ingested</span>
                            <span style={{ fontWeight: 700, color: '#0066cc' }}>{totalClients}</span>
                          </div>
                          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: '100%', height: '100%', background: '#0066cc', borderRadius: 4 }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>2. Delivery reported by Workbench</span>
                            <span style={{ fontWeight: 700, color: '#00897b' }}>{hasDeliveryMetrics ? `${deliveredCount} (${deliveredPct}%)` : 'Not reported'}</span>
                          </div>
                          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${deliveredPct}%`, height: '100%', background: '#00897b', borderRadius: 4 }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>3. Opened & Engaged</span>
                            <span style={{ fontWeight: 700, color: '#2e7d32' }}>{hasOpenMetrics ? `${openedCount}${deliveredCount > 0 ? ` (${openedPct}%)` : ' (rate unavailable)'}` : 'Not reported'}</span>
                          </div>
                          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${openedPct}%`, height: '100%', background: '#2e7d32', borderRadius: 4 }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>4. Replied / Inquired</span>
                            <span style={{ fontWeight: 700, color: '#7c3aed' }}>{hasReplyMetrics ? `${repliedCount}${deliveredCount > 0 ? ` (${repliedPct}%)` : ' (rate unavailable)'}` : 'Not reported'}</span>
                          </div>
                          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${repliedPct}%`, height: '100%', background: '#7c3aed', borderRadius: 4 }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>5. High-Intent Leads</span>
                            <span style={{ fontWeight: 700, color: '#ed6c02' }}>{hotCount}{hasDeliveryMetrics && deliveredCount > 0 ? ` (${hotPct}%)` : ''}</span>
                          </div>
                          <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${hotPct}%`, height: '100%', background: '#ed6c02', borderRadius: 4 }} />
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748b' }}>
                        <span>Delivery: <strong style={{ color: '#00897b' }}>{hasDeliveryMetrics ? `${deliveredCount} confirmed` : 'Not reported'}</strong></span>
                        <span>Inbound Replies: <strong style={{ color: '#7c3aed' }}>{repliedCount}</strong></span>
                        <span>Qualified Leads: <strong style={{ color: '#ed6c02' }}>{hotCount}</strong></span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Widget 2: Leads by Sector */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Leads by Industry Sector</div>
                  <span style={{ fontSize: 11, background: '#eff6ff', color: '#0066cc', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{sectorsList.length} Sectors</span>
                </div>
                <div style={{ padding: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sectorsList.map((sec, i) => {
                      const count = safeContacts.filter(c => (c.sector || c.industry || 'Unspecified') === sec).length;
                      const pct = totalClients ? ((count / totalClients) * 100).toFixed(0) : '0';
                      const colors = ['#0066cc', '#7c3aed', '#ed6c02', '#00897b', '#0284c7'];
                      const barColor = colors[i % colors.length];

                      return (
                        <div key={typeof sec === 'object' ? JSON.stringify(sec) : String(sec)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{typeof sec === 'object' ? JSON.stringify(sec) : String(sec)}</span>
                            <span style={{ fontWeight: 600, color: '#64748b' }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748b' }}>
                    <span>Total Sectors: <strong>{sectorsList.length}</strong></span>
                    <span>Contacts represented: <strong>{totalClients}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Dispatched Campaigns + Sales Handoff Queue ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
              {/* Widget 3: Dispatched Campaigns */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Recent Campaigns & Cadences</div>
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    style={{ background: 'none', border: 'none', color: '#0066cc', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    View All →
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>CAMPAIGN</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>TYPE</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>SECTOR</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(campaigns) ? campaigns.filter(Boolean) : []).slice(0, 6).map((cmp, idx) => (
                        <tr key={cmp?.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{typeof cmp?.name === 'object' ? JSON.stringify(cmp.name) : String(cmp?.name || 'Unnamed Campaign')}</span>
                              {cmp?.image_url && <Image size={12} color="#2563eb" title="Includes poster banner" />}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b' }}>{String(cmp?.sent_date || cmp?.created_date || 'Recent')} · {cmp?.recipients ?? cmp?.metrics?.total_recipients ?? 0} targeted contact(s)</div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{typeof cmp?.type === 'object' ? JSON.stringify(cmp.type) : String(cmp?.type || 'Newsletter')}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#334155' }}>
                              {typeof cmp?.sector === 'object' ? JSON.stringify(cmp.sector) : String(cmp?.sector || cmp?.target_audience || 'Unspecified')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              background: cmp?.status === 'Sent' ? '#e8f5e9' : cmp?.status === 'Scheduled' ? '#e0f2fe' : '#f1f5f9',
                              color: cmp?.status === 'Sent' ? '#2e7d32' : cmp?.status === 'Scheduled' ? '#0369a1' : '#475569',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600
                            }}>
                              {typeof cmp?.status === 'object' ? JSON.stringify(cmp.status) : String(cmp?.status || 'Not reported')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Widget 4: Engaged Client Interactions */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Engaged Client Status</div>
                  <button
                    onClick={() => setActiveTab('leads')}
                    style={{ background: 'none', border: 'none', color: '#0066cc', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    View Directory →
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>CLIENT NAME</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>COMPANY</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>INTENT</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const engagedList = safeContacts.filter(c => 
                          (c.response_intent && c.response_intent !== 'Awaiting Response') || 
                          (Array.isArray(c.client_engagements) && c.client_engagements.length > 0) || 
                          c.engagement_state === 'Delivered & Engaged' ||
                          c.engagement_state === 'Replied'
                        );
                        if (engagedList.length === 0) {
                          return (
                            <tr>
                              <td colSpan="4" style={{ padding: '20px 12px', textAlign: 'center', color: '#94a3b8' }}>
                                No client responses recorded yet. Active campaigns awaiting response.
                              </td>
                            </tr>
                          );
                        }
                        return engagedList.map((c, i) => (
                          <tr key={c.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{typeof c.name === 'object' ? JSON.stringify(c.name) : String(c.name || 'Client')}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{typeof c.company === 'object' ? JSON.stringify(c.company) : String(c.company || '—')}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                {typeof c.response_intent === 'object' ? JSON.stringify(c.response_intent) : String(c.response_intent || 'Not recorded')}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#2e7d32', fontWeight: 600 }}>
                              {typeof c.sales_handoff_status === 'object' ? JSON.stringify(c.sales_handoff_status) : String(c.sales_handoff_status || 'Not recorded')}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Row 3: Zoho CRM Activity Audit Log ── */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Recent Activity & Telemetry Audit Log</div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Live Engine Sync</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 14px', fontWeight: 600, width: '120px' }}>TIMESTAMP</th>
                      <th style={{ padding: '8px 14px', fontWeight: 600 }}>EVENT TYPE</th>
                      <th style={{ padding: '8px 14px', fontWeight: 600 }}>CONTACT / ACCOUNT</th>
                      <th style={{ padding: '8px 14px', fontWeight: 600 }}>DETAILS</th>
                      <th style={{ padding: '8px 14px', fontWeight: 600, width: '100px' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(auditLogs) && auditLogs.length > 0 ? (
                      auditLogs.filter(Boolean).slice(0, 8).map((log, idx) => (
                        <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11.5 }}>{typeof log.formattedTime === 'object' ? JSON.stringify(log.formattedTime) : String(log.formattedTime || 'Just now')}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{typeof log.event_type === 'object' ? JSON.stringify(log.event_type) : String(log.event_type || 'Event')}</td>
                          <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 500 }}>{typeof log.contact_name === 'object' ? JSON.stringify(log.contact_name) : String(log.contact_name || '—')}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              background: log.status === 'Delivered' ? '#e8f5e9' : log.status === 'Qualified' ? '#f3e8ff' : log.status === 'Hot Lead' ? '#fff7ed' : '#e0f2fe',
                              color: log.status === 'Delivered' ? '#2e7d32' : log.status === 'Qualified' ? '#7c3aed' : log.status === 'Hot Lead' ? '#c2410c' : '#0369a1',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600
                            }}>
                              {typeof log.status === 'object' ? JSON.stringify(log.status) : String(log.status || 'Not recorded')}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '20px 14px', textAlign: 'center', color: '#94a3b8' }}>No activity logged yet. Dispatched campaigns will appear here.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3: INDUSTRY SECTORS
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'sectors' && (
          <div className="dn-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              Industry Sectors & Tailored Cadence Strategies
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              The Digital Nurturing Agent customizes value propositions, festival greetings, and case studies based on client domain.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {sectorsList.map(sector => {
                const sectorLeads = contacts.filter(c => (c.sector || c.industry) === sector);
                return (
                  <div key={sector} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{sector} Sector</h4>
                      <span className="dn-badge dn-badge-blue">{sectorLeads.length} Clients</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                      Focus: Domain modernization, AI integration workflows, quarterly benchmark studies.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sectorLeads.map(l => (
                        <div key={l.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #f1f5f9' }}>
                          <span style={{ fontWeight: 600 }}>{l.name}</span>
                          <span style={{ color: '#64748b' }}>{l.company}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="dn-btn dn-btn-primary dn-btn-sm"
                      style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        setSectorFilter(sector);
                        setActiveTab('leads');
                      }}
                    >
                      View {sector} Leads ({sectorLeads.length})
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 4: STEP-BY-STEP CREATE CAMPAIGN WIZARD
            ══════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'create_campaign' || activeTab === 'generator') && (
          <div className="dn-panel" style={{ padding: 24 }}>
            {/* Stepper Progress Bar */}
            <div className="dn-wizard-stepper">
              <div className={`dn-wizard-step ${wizardStep === 1 ? 'active' : (wizardStep > 1 ? 'completed' : '')}`} onClick={() => setWizardStep(1)}>
                <div className="dn-wizard-step-circle">{wizardStep > 1 ? <Check size={14} /> : '1'}</div>
                <div className="dn-wizard-step-label">Step 1 — Campaign Type</div>
              </div>
              <div className="dn-wizard-step-divider" />

              <div className={`dn-wizard-step ${wizardStep === 2 ? 'active' : (wizardStep > 2 ? 'completed' : '')}`} onClick={() => setWizardStep(2)}>
                <div className="dn-wizard-step-circle">{wizardStep > 2 ? <Check size={14} /> : '2'}</div>
                <div className="dn-wizard-step-label">Step 2 — Audience</div>
              </div>
              <div className="dn-wizard-step-divider" />

              <div className={`dn-wizard-step ${wizardStep === 3 ? 'active' : (wizardStep > 3 ? 'completed' : '')}`} onClick={() => setWizardStep(3)}>
                <div className="dn-wizard-step-circle">{wizardStep > 3 ? <Check size={14} /> : '3'}</div>
                <div className="dn-wizard-step-label">Step 3 — Content</div>
              </div>
              <div className="dn-wizard-step-divider" />

              <div className={`dn-wizard-step ${wizardStep === 4 ? 'active' : (wizardStep > 4 ? 'completed' : '')}`} onClick={() => {
                if (!wizardBrief || !wizardBrief.trim()) {
                  setWizardBriefError(true);
                  showNotification('Please enter a campaign brief in Step 3.', true);
                  setWizardStep(3);
                  return;
                }
                setWizardStep(4);
              }}>
                <div className="dn-wizard-step-circle">{wizardStep > 4 ? <Check size={14} /> : '4'}</div>
                <div className="dn-wizard-step-label">Step 4 — AI Personalization</div>
              </div>
              <div className="dn-wizard-step-divider" />

              <div className={`dn-wizard-step ${wizardStep === 5 ? 'active' : ''}`} onClick={() => { if (wizardGeneratedContent) setWizardStep(5); }}>
                <div className="dn-wizard-step-circle">5</div>
                <div className="dn-wizard-step-label">Step 5 — Preview</div>
              </div>
            </div>

            {/* ── STEP 1: CAMPAIGN TYPE ── */}
            {wizardStep === 1 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Step 1 — Campaign Type</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>What do you want to send?</p>
                </div>

                <div className="dn-radio-grid">
                  <div
                    className={`dn-radio-card ${wizardCampaignType === 'Newsletter' ? 'selected' : ''}`}
                    onClick={() => handleSelectWizardType('Newsletter')}
                  >
                    <div className="dn-radio-card-header">
                      <div className="dn-radio-card-title">
                        <Mail size={16} color="#2563eb" /> Newsletter
                      </div>
                      <input
                        type="radio"
                        checked={wizardCampaignType === 'Newsletter'}
                        onChange={() => handleSelectWizardType('Newsletter')}
                      />
                    </div>
                    <div className="dn-radio-card-desc">
                      Sector intelligence newsletters, operational benchmarks, and strategic industry analysis.
                    </div>
                  </div>

                  <div
                    className={`dn-radio-card ${wizardCampaignType === 'Welcome Message' ? 'selected' : ''}`}
                    onClick={() => handleSelectWizardType('Welcome Message')}
                  >
                    <div className="dn-radio-card-header">
                      <div className="dn-radio-card-title">
                        <Sparkles size={16} color="#16a34a" /> Welcome Message
                      </div>
                      <input
                        type="radio"
                        checked={wizardCampaignType === 'Welcome Message'}
                        onChange={() => handleSelectWizardType('Welcome Message')}
                      />
                    </div>
                    <div className="dn-radio-card-desc">
                      Executive onboarding sequence welcoming newly ingested client accounts to the partnership.
                    </div>
                  </div>

                  <div
                    className={`dn-radio-card ${wizardCampaignType === 'Festival / Occasion Wish' ? 'selected' : ''}`}
                    onClick={() => handleSelectWizardType('Festival / Occasion Wish')}
                  >
                    <div className="dn-radio-card-header">
                      <div className="dn-radio-card-title">
                        <Sparkles size={16} color="#d97706" /> Festival Greeting / Corporate Milestone
                      </div>
                      <input
                        type="radio"
                        checked={wizardCampaignType === 'Festival / Occasion Wish'}
                        onChange={() => handleSelectWizardType('Festival / Occasion Wish')}
                      />
                    </div>
                    <div className="dn-radio-card-desc">
                      Seasonal festival greetings (Diwali, New Year) or company milestones (Anniversary, Annual Day) thanking clients.
                    </div>
                  </div>

                  <div
                    className={`dn-radio-card ${wizardCampaignType === 'Promotional / Strategic Update' ? 'selected' : ''}`}
                    onClick={() => handleSelectWizardType('Promotional / Strategic Update')}
                  >
                    <div className="dn-radio-card-header">
                      <div className="dn-radio-card-title">
                        <Layers size={16} color="#7c3aed" /> Promotional / Strategic Update
                      </div>
                      <input
                        type="radio"
                        checked={wizardCampaignType === 'Promotional / Strategic Update'}
                        onChange={() => handleSelectWizardType('Promotional / Strategic Update')}
                      />
                    </div>
                    <div className="dn-radio-card-desc">
                      Product feature updates, autonomous agent capabilities, and enterprise customer success stories.
                    </div>
                  </div>
                </div>

                {/* ── Step 1 Action Bar ── */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Selected Campaign Type: <strong style={{ color: '#0f172a' }}>{wizardCampaignType}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="dn-btn dn-btn-primary"
                      onClick={() => {
                        setWizardStep(2);
                      }}
                    >
                      Next: Audience <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: AUDIENCE ── */}
            {wizardStep === 2 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Step 2 — Audience</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    Select opted-in past clients from your directory to receive this campaign. Only opted-in contacts will be queued for delivery.
                  </p>
                </div>

                {/* Audience controls: Select All Opted-In / Deselect All / Counter */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="dn-btn dn-btn-secondary"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={handleSelectAllOptedIn}
                    >
                      <CheckSquare size={14} /> Select All Opted-In
                    </button>
                    <button
                      type="button"
                      className="dn-btn dn-btn-secondary"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={handleDeselectAll}
                    >
                      <Square size={14} /> Deselect All
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 16,
                      background: getWizardTargetRecipients().length > 0 ? '#dcfce7' : '#fee2e2',
                      color: getWizardTargetRecipients().length > 0 ? '#166534' : '#991b1b',
                      border: getWizardTargetRecipients().length > 0 ? '1px solid #bbf7d0' : '1px solid #fecaca'
                    }}>
                      {getWizardTargetRecipients().length} of {contacts.filter(c => c.opt_in === true).length} Opted-In Client(s) Selected
                    </span>
                  </div>
                </div>

                {/* Past Clients Audience Table */}
                <div className="dn-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="dn-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={contacts.filter(c => c.opt_in === true).length > 0 && contacts.filter(c => c.opt_in === true).every(c => wizardSelectedCustomContacts.has(c.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleSelectAllOptedIn();
                              } else {
                                handleDeselectAll();
                              }
                            }}
                            title="Toggle all opted-in clients"
                          />
                        </th>
                        <th>Contact</th>
                        <th>Company</th>
                        <th>Designation</th>
                        <th>Industry</th>
                        <th>Opt-in Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                            No contacts available. Synchronize contacts from Google Sheets.
                          </td>
                        </tr>
                      ) : (
                        contacts.map(c => {
                          const isOptedIn = c.opt_in === true;
                          const isChecked = wizardSelectedCustomContacts.has(c.id) && isOptedIn;
                          const initials = c.name
                            ? c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                            : 'CL';

                          return (
                            <tr
                              key={c.id}
                              style={{
                                cursor: isOptedIn ? 'pointer' : 'not-allowed',
                                background: isChecked ? '#f0fdf4' : (isOptedIn ? '#ffffff' : '#f8fafc'),
                                opacity: isOptedIn ? 1 : 0.6
                              }}
                              onClick={() => {
                                if (isOptedIn) handleToggleContactSelection(c.id);
                              }}
                            >
                              <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!isOptedIn}
                                  onChange={() => handleToggleContactSelection(c.id)}
                                />
                              </td>
                              <td>
                                <div className="dn-client-cell">
                                  <div className="dn-avatar">{initials}</div>
                                  <div>
                                    <div className="dn-client-name">{c.name}</div>
                                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="dn-company-name">{c.company || '—'}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: 12.5, color: '#334155' }}>
                                  {c.designation || c.role || 'Executive'}
                                </div>
                              </td>
                              <td>
                                <span className="dn-badge dn-badge-gray">
                                  {c.sector || c.industry || 'Technology'}
                                </span>
                              </td>
                              <td>
                                {isOptedIn ? (
                                  <span className="dn-badge dn-badge-green">
                                    <CheckCircle2 size={12} /> Opted In
                                  </span>
                                ) : (
                                  <span className="dn-badge dn-badge-red">
                                    <XCircle size={12} /> Opted Out
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {getWizardTargetRecipients().length === 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff1f2', borderRadius: 6, border: '1px solid #fecdd3', color: '#be123c', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} />
                    <span>Please select at least one opted-in contact to proceed.</span>
                  </div>
                )}

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                  <button className="dn-btn dn-btn-secondary" onClick={() => setWizardStep(1)}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button
                    className="dn-btn dn-btn-primary"
                    disabled={getWizardTargetRecipients().length === 0}
                    onClick={() => {
                      if (getWizardTargetRecipients().length === 0) {
                        showNotification('Select at least one opted-in audience contact before proceeding.', true);
                        return;
                      }
                      setWizardStep(3);
                    }}
                  >
                    Next: Content <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: CONTENT ── */}
            {wizardStep === 3 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Step 3 — Content</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Specify campaign details, announcement brief, and delivery channels</p>
                </div>

                <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Campaign Name */}
                  <div className="dn-form-group">
                    <label className="dn-form-label">Campaign Name:</label>
                    <input
                      type="text"
                      className="dn-form-input"
                      value={wizardCampaignName}
                      onChange={(e) => setWizardCampaignName(e.target.value)}
                      placeholder="e.g. Q4 Technology Intelligence Briefing"
                    />
                  </div>

                  {/* Reusable Template Quick-Loaders */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} color="#2563eb" /> Reusable Template Quick-Loaders
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Click any template to auto-populate brief & type</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplateInStep3('Newsletter')}
                        className={`dn-btn ${wizardCampaignType === 'Newsletter' ? 'dn-btn-primary' : 'dn-btn-secondary'}`}
                        style={{ fontSize: 12, padding: '5px 10px', height: 'auto' }}
                      >
                        <Mail size={13} /> 📰 Newsletter Briefing
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplateInStep3('Welcome')}
                        className={`dn-btn ${wizardCampaignType === 'Welcome Message' ? 'dn-btn-primary' : 'dn-btn-secondary'}`}
                        style={{ fontSize: 12, padding: '5px 10px', height: 'auto' }}
                      >
                        <UserCheck size={13} /> 👋 Welcome Sequence
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplateInStep3('Festival')}
                        className={`dn-btn ${wizardCampaignType === 'Festival / Occasion Wish' ? 'dn-btn-primary' : 'dn-btn-secondary'}`}
                        style={{ fontSize: 12, padding: '5px 10px', height: 'auto' }}
                      >
                        <Sparkles size={13} /> 🪔 Festival / Milestone
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplateInStep3('Promotional')}
                        className={`dn-btn ${wizardCampaignType === 'Promotional / Strategic Update' ? 'dn-btn-primary' : 'dn-btn-secondary'}`}
                        style={{ fontSize: 12, padding: '5px 10px', height: 'auto' }}
                      >
                        <Layers size={13} /> 🚀 Promotional Update
                      </button>
                    </div>
                  </div>

                  {/* Campaign Brief (Required) */}
                  <div className="dn-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="dn-form-label" style={{ marginBottom: 0 }}>
                        Campaign Brief <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                        {wizardBrief.length} characters
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                      Describe what you want to communicate to the selected client(s). This is synthesized by the SNS Workbench AI agent.
                    </div>
                    <textarea
                      className="dn-form-textarea"
                      rows={4}
                      value={wizardBrief}
                      onChange={(e) => {
                        setWizardBrief(e.target.value);
                        if (e.target.value.trim()) setWizardBriefError(false);
                      }}
                      placeholder="Example: Share our latest AI automation capabilities and relevant enterprise software trends."
                      style={wizardBriefError ? { borderColor: '#ef4444', backgroundColor: '#fff5f5' } : {}}
                      required
                    />
                    {wizardBriefError && (
                      <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontWeight: 500 }}>
                        Please enter a campaign brief.
                      </div>
                    )}
                  </div>

                  {/* Occasion for Festival / Milestone */}
                  {wizardCampaignType === 'Festival / Occasion Wish' && (
                    <div className="dn-form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label className="dn-form-label" style={{ marginBottom: 0 }}>
                          Occasion or Corporate Milestone:
                          <span style={{ color: '#2563eb', fontWeight: 600, marginLeft: 6 }}>[Festival or Company Milestone]</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        className="dn-form-input"
                        value={wizardOccasion}
                        onChange={(e) => setWizardOccasion(e.target.value)}
                        placeholder="e.g. Diwali 2026, New Year, Company Anniversary, Platform Milestone"
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ fontSize: 11.5, color: '#64748b', alignSelf: 'center', marginRight: 2 }}>Quick Presets:</span>
                        {[
                          { label: '🏆 Company Anniversary', val: 'Company Anniversary', brief: 'Celebrating our company anniversary milestone and thanking client leadership for their strategic partnership.' },
                          { label: '🪔 Diwali 2026', val: 'Diwali 2026', brief: 'Warm Diwali greetings celebrating partnership milestones and wishing prosperity.' },
                          { label: '✨ New Year 2026', val: 'New Year 2026', brief: 'Warm New Year greetings and wishing growth and prosperity.' },
                          { label: '🚀 Platform Milestone', val: 'Platform Milestone', brief: 'Celebrating our next-generation autonomous AI milestone and thanking client partners.' }
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => {
                              setWizardOccasion(preset.val);
                              setWizardBrief(preset.brief);
                              setWizardBriefError(false);
                              if (preset.val.includes('Anniversary')) {
                                setWizardCampaignName(`SNS Square Anniversary Milestone`);
                              } else {
                                setWizardCampaignName(`${preset.val} Executive Greetings`);
                              }
                            }}
                            style={{
                              fontSize: 11.5,
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: wizardOccasion === preset.val ? '1px solid #2563eb' : '1px solid #cbd5e1',
                              background: wizardOccasion === preset.val ? '#eff6ff' : '#f8fafc',
                              color: wizardOccasion === preset.val ? '#1d4ed8' : '#475569',
                              cursor: 'pointer',
                              fontWeight: wizardOccasion === preset.val ? 600 : 500
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 6, background: '#f1f5f9', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #2563eb' }}>
                        💡 <strong>Logic Guidance:</strong> For company milestones like <strong>Anniversaries</strong> or <strong>Platform Milestones</strong>, the message celebrates SNS Square's milestone and thanks the client for their partnership. For holidays like <strong>Diwali</strong>, it sends festive greetings.
                      </div>
                    </div>
                  )}

                  {/* Channel Selection */}
                  <div className="dn-form-group">
                    <label className="dn-form-label">Channel:</label>
                    <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={wizardChannels.email}
                          onChange={(e) => setWizardChannels(prev => ({ ...prev, email: e.target.checked }))}
                        />
                        <span>Email (SMTP Dispatch)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={wizardChannels.whatsapp}
                          onChange={(e) => setWizardChannels(prev => ({ ...prev, whatsapp: e.target.checked }))}
                        />
                        <span>WhatsApp (Direct Client Channel)</span>
                      </label>
                    </div>
                  </div>

                  {/* Poster Image Upload */}
                  <div className="dn-form-group">
                    <label className="dn-form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Image size={14} color="#2563eb" />
                        Attach Picture / Banner / Post Image:
                      </span>
                      {wizardImage && (
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => { setWizardImage(null); setWizardImageName(''); }}
                        >
                          Remove Image
                        </button>
                      )}
                    </label>

                    {wizardImage ? (
                      <div style={{ position: 'relative', marginTop: 6, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        <img
                          src={wizardImage}
                          alt="Campaign Post Attachment"
                          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{ padding: '6px 12px', background: '#f8fafc', fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
                          <span>{wizardImageName || 'Attached image'}</span>
                          <label style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
                            Change Image
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleImageUpload}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '16px',
                          border: '2px dashed #cbd5e1',
                          borderRadius: 8,
                          background: '#f8fafc',
                          cursor: 'pointer',
                          marginTop: 6,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <UploadCloud size={24} color="#64748b" style={{ marginBottom: 6 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                          Upload picture or post banner (Optional)
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          PNG, JPG, WebP, GIF or SVG
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleImageUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                  <button className="dn-btn dn-btn-secondary" onClick={() => setWizardStep(2)}>
                    <ChevronLeft size={14} /> Back
                  </button>
                  <button className="dn-btn dn-btn-primary" onClick={() => {
                    if (!wizardBrief || !wizardBrief.trim()) {
                      setWizardBriefError(true);
                      showNotification('Please enter a campaign brief.', true);
                      return;
                    }
                    setWizardBriefError(false);
                    setWizardStep(4);
                  }}>
                    Next: AI Personalization <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: AI PERSONALIZATION ── */}
            {wizardStep === 4 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Step 4 — AI Personalization</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    The agent synthesizes recipient context and campaign brief to generate personalized content.
                  </p>
                </div>

                {(() => {
                  const recipients = getWizardTargetRecipients();
                  const targetClient =
                    contacts.find(c => c.id === wizardSelectedContactId) ||
                    recipients[0] ||
                    contacts[0] || null;

                  if (!targetClient) {
                    return <div className="dn-empty-state">Sync or import a contact with recorded consent before generating campaign content.</div>;
                  }

                  return (
                    <div>
                      {/* ── Client Switcher Bar in Step 4 ── */}
                      <div style={{ marginBottom: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                            Previewing Personalization For: <strong style={{ color: '#2563eb' }}>{targetClient.name}</strong> ({targetClient.company})
                          </span>
                          <span style={{ fontSize: 11.5, color: '#64748b' }}>Click any client to switch preview context</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {contacts.map(c => {
                            const isSelected = targetClient.id === c.id;
                            const isOptedOut = c.opt_in !== true;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                disabled={isOptedOut}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '5px 12px',
                                  fontSize: 12,
                                  fontWeight: isSelected ? 700 : 500,
                                  background: isSelected ? '#2563eb' : (isOptedOut ? '#f1f5f9' : '#ffffff'),
                                  color: isSelected ? '#ffffff' : (isOptedOut ? '#94a3b8' : '#334155'),
                                  border: isSelected ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                                  borderRadius: 6,
                                  cursor: isOptedOut ? 'not-allowed' : 'pointer',
                                  opacity: isOptedOut ? 0.6 : 1
                                }}
                                onClick={() => {
                                  setWizardSelectedContactId(c.id);
                                  setWizardSelectedCompany(c.company || '');
                                  setWizardSelectedIndustry(c.sector || '');
                                }}
                                title={isOptedOut ? `${c.name} has opted out` : `Select ${c.name} (${c.company})`}
                              >
                                <span>{c.name}</span>
                                <span style={{ fontSize: 11, opacity: 0.85 }}>({c.company})</span>
                                {isSelected && <Check size={12} color="#fff" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 480px) 1fr', gap: 24 }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                            The agent uses:
                          </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Client Name:</span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{targetClient.name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Company:</span>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{targetClient.company}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Designation:</span>
                            <span style={{ color: '#334155' }}>{targetClient.designation}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Industry:</span>
                            <span style={{ background: '#eff6ff', color: '#0066cc', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {targetClient.sector || targetClient.industry}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Previous client context:</span>
                            <span style={{ color: '#334155', fontStyle: 'italic' }}>
                              "{targetClient.previous_interaction || 'Active enterprise partnership'}"
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Campaign brief:</span>
                            <span style={{ color: wizardBrief.trim() ? '#334155' : '#dc2626', fontStyle: wizardBrief.trim() ? 'normal' : 'italic' }}>
                              {wizardBrief.trim() || 'Missing brief — please return to Step 3 and enter a Campaign Brief.'}
                            </span>
                          </div>
                        </div>

                        <button
                          className="dn-btn dn-btn-primary"
                          style={{
                            width: '100%',
                            marginTop: 20,
                            justifyContent: 'center',
                            opacity: (!wizardBrief || !wizardBrief.trim()) ? 0.6 : 1,
                            cursor: (!wizardBrief || !wizardBrief.trim()) ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => {
                            if (!wizardBrief || !wizardBrief.trim()) {
                              setWizardBriefError(true);
                              showNotification('Please enter a campaign brief.', true);
                              setWizardStep(3);
                              return;
                            }
                            handleWizardGenerate(targetClient);
                          }}
                          disabled={wizardIsGenerating || !wizardBrief || !wizardBrief.trim()}
                          title={(!wizardBrief || !wizardBrief.trim()) ? 'Please enter a campaign brief before generating' : ''}
                        >
                          <Sparkles size={14} />
                          {wizardIsGenerating ? 'Synthesizing with Groq LLM / Workbench...' : (wizardCampaignType === 'Newsletter' ? 'Generate Newsletter & Preview' : `Generate ${wizardCampaignType} & Preview`)}
                        </button>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#64748b' }}>
                        <Sparkles size={36} color="#3b82f6" style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Ready to Personalize for {targetClient.name}</div>
                        <div style={{ fontSize: 12.5, maxWidth: 360, marginTop: 4 }}>
                          Clicking <strong>Generate for {targetClient.name} with AI</strong> triggers the SNS Square Agent Workbench pipeline to craft tailored messaging for {targetClient.company}.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                  <button className="dn-btn dn-btn-secondary" onClick={() => setWizardStep(3)}>
                    <ChevronLeft size={14} /> Back
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 5: PREVIEW ── */}
            {wizardStep === 5 && (wizardGeneratedContent || wizardEditedBody) && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Step 5 — Preview</h3>
                    {wizardGeneratedContent?.content_source === 'workbench' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: 12, fontWeight: 600 }}>
                        <CheckCircle2 size={13} /> AI Personalization via SNS Workbench
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: 12, fontWeight: 600 }}>
                        <AlertCircle size={13} /> Manual Draft (Not AI-Generated)
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    Review generated email copy and channels before final dispatch.
                  </p>
                </div>

                <div style={{ maxWidth: 750 }}>
                  {/* Mode switcher and photo upload */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
                      <button
                        type="button"
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: !wizardIsEditing ? 700 : 500,
                          background: !wizardIsEditing ? '#ffffff' : 'transparent',
                          color: !wizardIsEditing ? '#2563eb' : '#64748b',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          boxShadow: !wizardIsEditing ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                        }}
                        onClick={() => setWizardIsEditing(false)}
                      >
                        👁 Formatted Preview
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: wizardIsEditing ? 700 : 500,
                          background: wizardIsEditing ? '#ffffff' : 'transparent',
                          color: wizardIsEditing ? '#2563eb' : '#64748b',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          boxShadow: wizardIsEditing ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                        }}
                        onClick={() => setWizardIsEditing(true)}
                      >
                        <Edit3 size={12} style={{ display: 'inline', marginRight: 4 }} />
                        ✏ Edit Copy (LLM Output)
                      </button>
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2563eb', cursor: 'pointer', padding: '5px 12px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', fontWeight: 600 }}>
                      <UploadCloud size={14} />
                      <span>{wizardImage ? 'Change Image / Banner' : '+ Attach Picture / Banner'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>

                  {/* Attached Image / Picture Banner Preview */}
                  {wizardImage && (
                    <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                      <img
                        src={wizardImage}
                        alt="Attached Campaign Banner"
                        style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{ padding: '6px 12px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
                        <span>Attached Image: <strong>{wizardImageName || 'Campaign banner'}</strong></span>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}
                          onClick={() => { setWizardImage(null); setWizardImageName(''); }}
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="dn-preview-box">
                    <div className="dn-preview-header">
                      <div className="dn-preview-row">
                        <span className="dn-preview-label">SUBJECT:</span>
                        {wizardIsEditing ? (
                          <input
                            type="text"
                            className="dn-form-input"
                            value={wizardEditedSubject}
                            onChange={(e) => setWizardEditedSubject(e.target.value)}
                            placeholder="Enter email subject line..."
                            style={{ flex: 1, padding: '6px 10px', fontSize: 13, fontWeight: 600 }}
                          />
                        ) : (
                          <span className="dn-preview-value" style={{ color: '#1e40af' }}>{wizardEditedSubject || wizardGeneratedContent.subject}</span>
                        )}
                      </div>
                      <div className="dn-preview-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8, padding: '10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="dn-preview-label" style={{ marginBottom: 0 }}>AUDIENCE:</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                              {wizardAudienceType} — <span style={{ color: '#16a34a' }}>{getWizardTargetRecipients().length} of {contacts.filter(c => c.opt_in === true).length} Opted-In Client(s)</span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className={`dn-btn ${wizardAudienceType === 'All Past Clients' ? 'dn-btn-primary' : 'dn-btn-secondary'}`}
                              style={{ fontSize: 11.5, padding: '4px 10px', height: 'auto' }}
                              onClick={() => {
                                setWizardAudienceType('All Past Clients');
                                setWizardSelectedCustomContacts(new Set(contacts.filter(c => c.opt_in === true).map(c => c.id)));
                              }}
                            >
                              <Users size={12} /> All {contacts.filter(c => c.opt_in === true).length} Opted-In
                            </button>
                            <button
                              type="button"
                              className={`dn-btn ${wizardAudienceType === 'Specific Client' ? 'dn-btn-primary' : 'dn-btn-secondary'}`}
                              style={{ fontSize: 11.5, padding: '4px 10px', height: 'auto' }}
                              onClick={() => {
                                setWizardAudienceType('Specific Client');
                              }}
                            >
                              <User size={12} /> Only {contacts.find(c => c.id === wizardSelectedContactId)?.name || 'Primary Client'}
                            </button>
                            <button
                              type="button"
                              className="dn-btn dn-btn-secondary"
                              style={{ fontSize: 11.5, padding: '4px 10px', height: 'auto' }}
                              onClick={() => setWizardStep(2)}
                            >
                              Adjust in Step 2 →
                            </button>
                          </div>
                        </div>

                        {/* Recipient summary pills */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          {getWizardTargetRecipients().map(rec => (
                            <span
                              key={rec.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11.5,
                                padding: '3px 9px',
                                borderRadius: 12,
                                background: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0'
                              }}
                            >
                              <CheckCircle2 size={11} color="#16a34a" />
                              <strong>{rec.name}</strong> ({rec.company})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="dn-preview-body">
                      {/* Embedded Email Poster / Banner inside the Letter Card */}
                      {wizardImage && (
                        <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                          <img
                            src={wizardImage}
                            alt="Campaign Poster"
                            style={{
                              maxWidth: '100%',
                              maxHeight: 380,
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              display: 'inline-block'
                            }}
                          />
                          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>
                            ✓ Poster attached & will appear at top of outgoing email
                          </div>
                        </div>
                      )}

                      {wizardIsEditing ? (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                            Customize or refine the generated email body:
                          </div>
                          <textarea
                            className="dn-form-textarea"
                            rows={14}
                            value={wizardEditedBody}
                            onChange={(e) => setWizardEditedBody(e.target.value)}
                            placeholder="Write or edit the email content..."
                            style={{ width: '100%', fontSize: 13, lineHeight: 1.6, padding: '10px 12px' }}
                          />
                        </div>
                      ) : (
                        <EmailBodyPreview content={wizardEditedBody || wizardGeneratedContent.email_body} />
                      )}
                    </div>

                    <div className="dn-preview-footer">
                      <div>
                        <a
                          href={`${APP_ORIGIN}/unsubscribe?id=${encodeURIComponent(wizardSelectedContactId || getWizardTargetRecipients()[0]?.id || 'CNT-001')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'underline', marginRight: 12 }}
                        >
                          Unsubscribe
                        </a>
                        <a
                          href={`${APP_ORIGIN}/preferences?id=${encodeURIComponent(wizardSelectedContactId || getWizardTargetRecipients()[0]?.id || 'CNT-001')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#64748b', textDecoration: 'none' }}
                        >
                          Manage Preferences
                        </a>
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Preview prepared for SNS Square Agent Workbench</span>
                    </div>
                  </div>

                  {wizardChannels.whatsapp && (
                    <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 6 }}>
                        WhatsApp Channel Preview
                      </div>
                      {wizardIsEditing ? (
                        <textarea
                          className="dn-form-textarea"
                          rows={3}
                          value={wizardGeneratedContent.whatsapp_message || ''}
                          onChange={(e) => setWizardGeneratedContent(prev => ({ ...prev, whatsapp_message: e.target.value }))}
                          style={{ width: '100%', fontSize: 12.5, color: '#14532d', background: '#ffffff' }}
                        />
                      ) : (
                        <div style={{ fontSize: 12.5, color: '#14532d', whiteSpace: 'pre-wrap' }}>
                          {wizardGeneratedContent.whatsapp_message}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="dn-btn dn-btn-secondary" onClick={() => setWizardStep(4)}>
                      <ChevronLeft size={14} /> Back
                    </button>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="dn-btn dn-btn-secondary"
                        onClick={handleSaveDraft}
                        disabled={wizardIsDispatching}
                        title="Save as Draft so you can review or dispatch later"
                      >
                        <FileText size={14} /> Save as Draft
                      </button>

                      <button
                        className="dn-btn dn-btn-success"
                        onClick={handleWizardDispatch}
                        disabled={wizardIsDispatching || getWizardTargetRecipients().length === 0}
                      >
                        <Send size={14} />
                        {wizardIsDispatching 
                          ? `Dispatching to ${getWizardTargetRecipients().length} Client Channels...` 
                          : `Approve & Send to ${getWizardTargetRecipients().length} Client${getWizardTargetRecipients().length === 1 ? '' : 's'}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 5: CAMPAIGNS & CADENCES (ZOHO CRM TABLE)
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'campaigns' && (
          <div className="dn-panel">
            <div className="dn-panel-header">
              <div className="dn-panel-title-wrap">
                <div className="dn-panel-title">
                  <Calendar size={17} color="#2563eb" /> Dispatched Campaigns & Cadences
                  <span className="dn-badge dn-badge-blue">{campaigns.length} Campaigns</span>
                </div>
                <div className="dn-panel-subtitle">
                  Autonomous multichannel nurturing cadences dispatched via SNS Workbench Webhook.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="dn-btn dn-btn-primary dn-btn-sm"
                  onClick={() => handleOpenCreateCampaign('All Past Clients')}
                >
                  <Plus size={13} /> Create Campaign
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="dn-filter-bar">
              <div className="dn-filter-group">
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 4 }}>Type:</span>
                {['All', 'Newsletter', 'Welcome', 'Festival', 'Promotional'].map(t => (
                  <button
                    key={t}
                    className={`dn-filter-pill ${campaignTypeFilter === t ? 'active' : ''}`}
                    onClick={() => setCampaignTypeFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="dn-filter-group">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginRight: 4 }}>Status:</span>
                  {['All', 'Sent', 'Scheduled', 'Draft'].map(s => (
                    <button
                      key={s}
                      className={`dn-filter-pill ${campaignStatusFilter === s ? 'active' : ''}`}
                      onClick={() => setCampaignStatusFilter(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="dn-search-input-wrap">
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    className="dn-search-input"
                    placeholder="Search campaign name..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Zoho CRM Campaigns Table */}
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', margin: 20 }}>
                <Calendar size={36} color="#94a3b8" style={{ marginBottom: 12, display: 'inline-block' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  No campaigns yet. Create a campaign to begin nurturing clients.
                </div>
                <p style={{ fontSize: 13, color: '#64748b', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.5 }}>
                  Launch an autonomous sector newsletter or tailored update using the Campaign Wizard in Step 1.
                </p>
                <button
                  className="dn-btn dn-btn-primary"
                  onClick={() => handleOpenCreateCampaign('All Past Clients')}
                >
                  <Plus size={14} /> Create Campaign
                </button>
              </div>
            ) : (
              <div className="dn-table-wrap">
                <table className="dn-table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Campaign Type</th>
                      <th>Campaign Brief</th>
                      <th>Recipient(s)</th>
                      <th>Status</th>
                      <th>Delivery Status</th>
                      <th>Content Source</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(campaigns) ? campaigns.filter(Boolean) : [])
                      .filter(c => {
                        if (!c) return false;
                        const matchesType = campaignTypeFilter === 'All' || c.type === campaignTypeFilter || (c.type || '').includes(campaignTypeFilter);
                        const matchesStatus = campaignStatusFilter === 'All' || c.status === campaignStatusFilter;
                        const matchesSearch = !campaignSearch || String(c.name || '').toLowerCase().includes(String(campaignSearch || '').toLowerCase());
                        return matchesType && matchesStatus && matchesSearch;
                      })
                      .map((cmp) => {
                        const typeBadge =
                          cmp.type === 'Welcome' || cmp.type === 'Welcome Mail' ? 'dn-badge-green' :
                          cmp.type === 'Newsletter' || cmp.type === 'Sector Newsletter' ? 'dn-badge-blue' :
                          cmp.type === 'Festival' || cmp.type === 'Festival Greeting' ? 'dn-badge-amber' : 'dn-badge-purple';

                        const statusBadge =
                          cmp.status === 'Sent' ? 'dn-badge-green' :
                          cmp.status === 'Scheduled' ? 'dn-badge-blue' :
                          cmp.status === 'Draft' ? 'dn-badge-amber' : 'dn-badge-gray';

                        const briefText = typeof cmp.brief === 'object' ? JSON.stringify(cmp.brief) : String(cmp.brief || cmp.developer_input || cmp.occasion || '—');

                        return (
                          <tr key={cmp.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{typeof cmp.name === 'object' ? JSON.stringify(cmp.name) : String(cmp.name || 'Unnamed Campaign')}</span>
                                {cmp.image_url && (
                                  <span title="Contains attached picture / banner" style={{ display: 'inline-flex' }}>
                                    <Image size={13} color="#2563eb" />
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>ID: {cmp.id}</div>
                            </td>
                            <td>
                              <span className={`dn-badge ${typeBadge}`}>
                                {typeof cmp.type === 'object' ? JSON.stringify(cmp.type) : String(cmp.type || 'Newsletter')}
                              </span>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#334155',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={briefText}
                              >
                                {briefText}
                              </div>
                            </td>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{cmp.recipients || cmp.recipients_count || cmp.metrics?.sent || (cmp.status === 'Draft' ? 0 : 1)}</strong>
                            </td>
                            <td>
                              <span className={`dn-badge ${statusBadge}`}>
                                {cmp.status}
                              </span>
                            </td>
                            <td>
                              <span className={`dn-badge ${cmp.status === 'Sent' ? 'dn-badge-green' : 'dn-badge-gray'}`} style={{ fontWeight: 600 }}>
                                {cmp.delivery_status || (cmp.status === 'Sent' ? 'Workbench confirmed dispatch' : '—')}
                              </span>
                            </td>
                            <td>
                              <span className={`dn-badge ${cmp.content_source === 'workbench' ? 'dn-badge-blue' : 'dn-badge-amber'}`} style={{ fontSize: 11 }}>
                                {cmp.content_source === 'workbench' ? 'SNS Workbench' : 'Not AI-generated'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: '#475569' }}>
                              {cmp.sent_date || cmp.created_date || '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                {cmp.status === 'Draft' && (
                                  <button
                                    className="dn-btn dn-btn-primary dn-btn-sm"
                                    onClick={() => handleResumeDraft(cmp)}
                                    title="Edit and dispatch this draft"
                                  >
                                    <Edit3 size={11} /> Edit Draft
                                  </button>
                                )}
                                <button
                                  className="dn-btn dn-btn-secondary dn-btn-sm"
                                  onClick={() => setSelectedCampaignForPreview(cmp)}
                                >
                                  View Copy
                                </button>
                                <button
                                  className="dn-btn dn-btn-secondary dn-btn-sm"
                                  onClick={() => handleDeleteCampaign(cmp)}
                                  disabled={deletingCampaignId === cmp.id}
                                  title="Delete this campaign and its stored history"
                                >
                                  {deletingCampaignId === cmp.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 6: REUSABLE TEMPLATES
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'templates' && (
          <div className="dn-panel" style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Templates</h3>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>This makes the agent reusable.</p>
                </div>
                <button
                  className="dn-btn dn-btn-primary dn-btn-sm"
                  onClick={() => handleUseTemplate(selectedTemplateTab)}
                >
                  <Plus size={13} /> Use Template in Campaign Wizard
                </button>
              </div>
            </div>

            {/* Template Category Tabs */}
            <div className="dn-template-tab-bar">
              {['Newsletter', 'Welcome', 'Festival', 'Promotional'].map((cat) => (
                <button
                  key={cat}
                  className={`dn-template-tab-btn ${selectedTemplateTab === cat ? 'active' : ''}`}
                  onClick={() => setSelectedTemplateTab(cat)}
                >
                  {`${cat} Template`}
                </button>
              ))}
            </div>

            {(() => {
              const tmpl = NURTURE_TEMPLATES[selectedTemplateTab];
              if (!tmpl) return null;
              const templateContact = contacts.find(c => c.id === templateSelectedContactId) || contacts[0];
              const personalizedSubject = (tmpl.sample.subject || '')
                .replace(/\[Client Name\]/g, templateContact?.name || 'Client')
                .replace(/\[Company\]/g, templateContact?.company || 'Enterprise')
                .replace(/\[Industry\]/g, templateContact?.sector || 'Technology')
                .replace(/\[Festival Name\]/g, 'Diwali 2026');
              const personalizedBody = (tmpl.sample.email_body || '')
                .replace(/\[Client Name\]/g, templateContact?.name || 'Client')
                .replace(/\[Company\]/g, templateContact?.company || 'Enterprise')
                .replace(/\[Industry\]/g, templateContact?.sector || 'Technology')
                .replace(/\[Festival Name\]/g, 'Diwali 2026');

              return (
                <div>
                  {/* ── Client Picker in Templates Tab ── */}
                  <div style={{ marginBottom: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                        Personalize Template Preview For: <strong style={{ color: '#2563eb' }}>{templateContact?.name}</strong> ({templateContact?.company})
                      </span>
                      <span style={{ fontSize: 11.5, color: '#64748b' }}>Click any client to see template rendered for them</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {contacts.map(c => {
                        const isSelected = templateSelectedContactId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 500,
                              background: isSelected ? '#2563eb' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#334155',
                              border: isSelected ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                            onClick={() => setTemplateSelectedContactId(c.id)}
                            title={`Select ${c.name} (${c.company})`}
                          >
                            <span>{c.name}</span>
                            <span style={{ fontSize: 11, opacity: 0.85 }}>({c.company})</span>
                            {isSelected && <Check size={12} color="#fff" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: 24 }}>
                    {/* Structure & Sections */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                        {tmpl.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                        {tmpl.description}
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                          Subject Structure:
                        </div>
                        <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: '#1e40af', border: '1px solid #e2e8f0' }}>
                          {tmpl.subject_structure}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                          Template Sections:
                        </div>
                        {tmpl.sections.map((sec, idx) => (
                          <div key={idx} className="dn-template-section-item">
                            <span style={{ background: '#2563eb', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {idx + 1}
                            </span>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{sec.name}</div>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>{sec.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        className="dn-btn dn-btn-primary"
                        style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
                        onClick={() => handleInstantGenerateTemplate(selectedTemplateTab, templateContact?.id)}
                        disabled={wizardIsGenerating}
                      >
                        <Sparkles size={14} /> ⚡ Generate for {templateContact?.name} & Preview
                      </button>

                      <button
                        className="dn-btn dn-btn-secondary"
                        style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                        onClick={() => handleUseTemplate(selectedTemplateTab, templateContact?.id)}
                      >
                        <Plus size={14} /> Customize in Campaign Wizard →
                      </button>
                    </div>

                    {/* Rendered Live Email Preview */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                        Rendered Email Preview (Personalized for {templateContact?.name})
                      </div>
                      <div className="dn-preview-box">
                        <div className="dn-preview-header">
                          <div className="dn-preview-row">
                            <span className="dn-preview-label">SUBJECT:</span>
                            <span className="dn-preview-value" style={{ color: '#1e40af' }}>{personalizedSubject}</span>
                          </div>
                          <div className="dn-preview-row">
                            <span className="dn-preview-label">TARGET:</span>
                            <span style={{ fontSize: 12, color: '#475569' }}>{templateContact?.name} ({templateContact?.company} • {templateContact?.sector})</span>
                          </div>
                        </div>

                        <div className="dn-preview-body" style={{ whiteSpace: 'pre-wrap' }}>
                          {personalizedBody}
                        </div>

                        <div className="dn-preview-footer">
                          <div>
                            <span style={{ color: '#2563eb', textDecoration: 'underline', marginRight: 12 }}>Unsubscribe</span>
                            <span style={{ color: '#64748b' }}>Manage Preferences</span>
                          </div>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>SNS Square Multi-Agent Platform</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 7: ENGAGEMENT
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'engagement' && (
          <div className="dn-panel" style={{ padding: 24 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Live Campaign & Delivery Engagement Telemetry</h3>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  Active delivery verification, recipient interactions, and live per-client dispatch telemetry.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16a34a', fontWeight: 600, background: '#f0fdf4', padding: '4px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
                  <span className="dn-consent-live-indicator" style={{ width: 8, height: 8 }} /> Active Sync
                </span>
                <button
                  className="dn-btn dn-btn-secondary dn-btn-sm"
                  onClick={loadData}
                  disabled={isSyncing}
                  title="Force refresh delivery and engagement telemetry"
                >
                  <RefreshCw size={12} className={isSyncing ? 'dn-spin' : ''} /> Sync Telemetry
                </button>
              </div>
            </div>

            {(() => {
              const sentCampaigns = campaigns.filter(c => 
                c && (
                  c.status === 'Sent' || 
                  c.status === 'Completed' ||
                  String(c.delivery_status || '').toLowerCase().includes('confirmed') ||
                  String(c.delivery_status || '').toLowerCase().includes('deliver') ||
                  (c.metrics && (Number(c.metrics.sent) > 0 || Number(c.metrics.delivered) > 0))
                )
              );
              const totalWorkbenchReportedSends = sentCampaigns.reduce((acc, c) => {
                const count = Number(c.metrics?.sent ?? c.metrics?.delivered ?? c.recipients ?? c.recipients_count ?? (Array.isArray(c.contact_ids) ? c.contact_ids.length : 0));
                return acc + (Number.isFinite(count) && count > 0 ? count : 1);
              }, 0);

              const totalOpened = sentCampaigns.reduce((acc, c) => acc + (Number(c.metrics?.opened) || 0), 0);
              const openRate = totalWorkbenchReportedSends > 0 ? Math.round((totalOpened / totalWorkbenchReportedSends) * 100) : 0;

              const totalClicked = sentCampaigns.reduce((acc, c) => acc + (Number(c.metrics?.clicked) || 0), 0);
              const clickRate = totalWorkbenchReportedSends > 0 ? Math.round((totalClicked / totalWorkbenchReportedSends) * 100) : 0;

              const totalReplied = sentCampaigns.reduce((acc, c) => acc + (Number(c.metrics?.replied) || 0), 0);
              const replyRate = totalWorkbenchReportedSends > 0 ? Math.round((totalReplied / totalWorkbenchReportedSends) * 100) : 0;

              const realOptOutCount = optNotifications.filter(e => e.type === 'opt_out').length || contacts.filter(c => c.opt_in === false).length;

              return (
                <div>
                  {/* High-Level Engagement Metrics Strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #0066cc', borderRadius: 6, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>WORKBENCH REPORTED SENDS</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{totalWorkbenchReportedSends}</div>
                      <div style={{ fontSize: 11.5, color: '#0066cc', marginTop: 4, fontWeight: 500 }}>
                        {sentCampaigns.length} Confirmed Campaign{sentCampaigns.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #1e40af', borderRadius: 6, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>OPENED</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: totalOpened > 0 ? '#1e40af' : '#64748b', marginTop: 4 }}>
                        {totalOpened}
                      </div>
                      <div style={{ fontSize: 11.5, color: totalOpened > 0 ? '#1e40af' : '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                        {openRate}% Open Rate ({totalOpened} read of {totalWorkbenchReportedSends} delivered)
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #047857', borderRadius: 6, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CLICKED</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: totalClicked > 0 ? '#047857' : '#64748b', marginTop: 4 }}>
                        {totalClicked}
                      </div>
                      <div style={{ fontSize: 11.5, color: totalClicked > 0 ? '#047857' : '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                        {clickRate}% CTR ({totalClicked} CTA interaction{totalClicked === 1 ? '' : 's'})
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #7c3aed', borderRadius: 6, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>REPLIED</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: totalReplied > 0 ? '#6d28d9' : '#64748b', marginTop: 4 }}>
                        {totalReplied}
                      </div>
                      <div style={{ fontSize: 11.5, color: totalReplied > 0 ? '#6d28d9' : '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                        {replyRate}% Response Rate ({totalReplied} active inbound lead{totalReplied === 1 ? '' : 's'})
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderTop: '3px solid #ef4444', borderRadius: 6, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>UNSUBSCRIBED</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: realOptOutCount > 0 ? '#dc2626' : '#0f172a', marginTop: 4 }}>
                        {realOptOutCount}
                      </div>
                      <div style={{ fontSize: 11.5, color: realOptOutCount > 0 ? '#dc2626' : '#64748b', marginTop: 4, fontWeight: 500 }}>
                        {realOptOutCount} Recorded Opt-Out Event{realOptOutCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  {/* Per-Client Engagement Section */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Per-Client Telemetry</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Inspect Workbench-confirmed dispatches and recorded engagement metrics per contact</div>
                      </div>

                      {/* Client Selector Pills */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {contacts.map(c => (
                          <button
                            key={c.id}
                            className={`dn-filter-pill ${selectedEngagementClientId === c.id ? 'active' : ''}`}
                            onClick={() => setSelectedEngagementClientId(c.id)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const targetClient = contacts.find(c => c.id === selectedEngagementClientId) || contacts[0];
                      if (!targetClient) return null;

                      // Dynamically sync all sent campaigns that reached targetClient
                      const clientCampaigns = campaigns.filter(c => {
                        if (!c) return false;
                        if (c.status !== 'Sent' && c.status !== 'Completed' && !String(c.delivery_status || '').toLowerCase().includes('deliver') && !String(c.delivery_status || '').toLowerCase().includes('confirmed')) return false;
                        const isDirectId = Array.isArray(c.contact_ids) && c.contact_ids.includes(targetClient.id);
                        const isRecipientObj = Array.isArray(c.recipient_contacts) && c.recipient_contacts.some(rc => 
                          rc.id === targetClient.id || (rc.email && targetClient.email && rc.email.toLowerCase() === targetClient.email.toLowerCase())
                        );
                        const isAudienceMatch = c.audience === 'All Past Clients' || 
                          (c.audience === 'Specific Industry' && (c.sector === targetClient.sector || c.sector === targetClient.industry)) ||
                          (c.audience === 'Specific Company' && c.company === targetClient.company);
                        return isDirectId || isRecipientObj || isAudienceMatch;
                      });

                      const mergedEngagements = [];
                      const seenCampaignNames = new Set();

                      (targetClient.client_engagements || []).forEach(eng => {
                        const normName = (eng.campaign_name || '').trim().toLowerCase();
                        if (normName) seenCampaignNames.add(normName);
                        mergedEngagements.push(eng);
                      });

                      clientCampaigns.forEach(c => {
                        const normName = (c.name || '').trim().toLowerCase();
                        if (!seenCampaignNames.has(normName)) {
                          seenCampaignNames.add(normName);
                          const isClientReplied = targetClient.engagement_state === 'Replied' || c.metrics?.replied > 0;
                          const isClientOpened = c.metrics?.opened > 0;
                          mergedEngagements.push({
                            campaign_name: c.name,
                            type: c.type || 'Newsletter',
                            channel: (Array.isArray(c.channels) ? c.channels.join(' + ') : c.channel) || 'Email',
                            status: 'Delivered (Workbench Confirmed)',
                            delivery_status: 'Delivered',
                            engagement: isClientReplied ? (targetClient.response_intent || 'Replied') : (isClientOpened ? 'Opened' : 'Delivered & Active'),
                            date: c.sent_date || c.created_date || 'Recent',
                            subject: c.subject || ''
                          });
                        }
                      });

                      return (
                        <div>
                          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 6, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                Client: <strong>{targetClient.name}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {targetClient.designation} · {targetClient.company} ({targetClient.sector || targetClient.industry}) · {targetClient.email}
                              </div>
                            </div>
                            <span className={`dn-badge ${targetClient.opt_in === true ? 'dn-badge-green' : 'dn-badge-amber'}`}>
                              {targetClient.opt_in === true ? <CheckCircle2 size={12} /> : null}
                              {targetClient.opt_in === true ? 'Opted In' : targetClient.opt_in === false ? 'Opted Out' : 'Pending Consent'}
                            </span>
                          </div>

                          {mergedEngagements.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', background: '#fafafa', borderRadius: 6, border: '1px dashed #e2e8f0' }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#475569' }}>
                                No campaigns dispatched to this client yet.
                              </p>
                              <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                                Workbench-confirmed dispatches and returned engagement metrics will appear here.
                              </span>
                            </div>
                          ) : (
                            <div className="dn-table-wrap">
                              <table className="dn-table">
                                <thead>
                                  <tr>
                                    <th>Campaign</th>
                                    <th>Channel</th>
                                    <th>Delivery Status</th>
                                    <th>Engagement Telemetry</th>
                                    <th>Dispatch Date / Details</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mergedEngagements.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.campaign_name}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>
                                          {item.type || 'Newsletter'}{item.subject ? ` • ${item.subject.slice(0, 45)}...` : ''}
                                        </div>
                                      </td>
                                      <td>
                                        <span className="dn-badge dn-badge-blue">
                                          {item.channel || 'Email'}
                                        </span>
                                      </td>
                                      <td>
                                        <span className="dn-badge dn-badge-green">
                                          <CheckCircle2 size={11} /> {item.status || 'Delivered'}
                                        </span>
                                      </td>
                                      <td>
                                        {String(item.engagement || '').toLowerCase().includes('repli') || targetClient.engagement_state === 'Replied' ? (
                                          <span className="dn-badge dn-badge-purple" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                                            <Flame size={11} /> Replied ({targetClient.response_intent || 'Interested'})
                                          </span>
                                        ) : String(item.engagement || '').toLowerCase().includes('open') ? (
                                          <span className="dn-badge dn-badge-blue" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                            <Eye size={11} /> Content Opened
                                          </span>
                                        ) : (
                                          <span className="dn-badge dn-badge-green" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                                            <CheckCircle2 size={11} /> Delivered & Active
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: 12, color: '#475569' }}>
                                        <div>{item.date || 'Recent'}</div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        )}



        {/* ══════════════════════════════════════════════════════════════════
            TAB 7: SNS WORKBENCH WORKFLOW
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'workflow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="dn-workflow-banner">
              <div className="dn-workflow-banner-info">
                <h3>
                  <Sliders size={18} color="#60a5fa" />
                  SNS Square Agent Workbench — Digital Client Nurturing Pipeline
                </h3>
                <p>
                  13-node end-to-end autonomous workflow configured in SNS Square Workbench. Ingests client context, enriches by sector, executes Groq LLM personalization, dispatches multi-channel cadences, tracks real-time telemetry, and automates sales handoff.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <span className={`dn-badge ${webhookTestResult?.success ? 'dn-badge-green' : webhookTestResult ? 'dn-badge-amber' : 'dn-badge-blue'}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                  {webhookTestResult?.success ? <CheckCircle2 size={13} /> : <Activity size={13} />}
                  {webhookTestResult?.success ? 'Workbench Responded' : webhookTestResult ? 'Workbench Test Failed' : 'Workbench Not Tested'}
                </span>
              </div>
            </div>

            {/* Live Webhook Connectivity & Test Panel */}
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={17} color="#16a34a" /> Live Webhook Health & Execution Status
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Trigger and verify live communication with the SNS Square Agent Workbench webhook endpoint.
                  </div>
                </div>

                <button
                  className="dn-btn dn-btn-primary"
                  onClick={handleTestWorkbenchWebhook}
                  disabled={isTestingWebhook}
                >
                  <RefreshCw size={13} className={isTestingWebhook ? 'spin-icon' : ''} />
                  {isTestingWebhook ? 'Pinging Workbench Webhook...' : 'Test Webhook Execution'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Nurturing Workbench Webhook</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginTop: 4, wordBreak: 'break-all' }}>
                    Configured server-side with NURTURE_WORKBENCH_WEBHOOK_URL
                  </div>
                  <span className={`dn-badge ${webhookTestResult?.success ? 'dn-badge-green' : 'dn-badge-amber'}`} style={{ marginTop: 6 }}>
                    {webhookTestResult?.success ? 'Verified by generated content response' : 'Not verified in this session'}
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Workbench Callback Endpoint</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginTop: 4, wordBreak: 'break-all' }}>
                    /api/webhook/callback
                  </div>
                  <span className="dn-badge dn-badge-blue" style={{ marginTop: 6 }}>
                    Receives configured Workbench callbacks
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Same-Origin Application API</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                    /api/campaigns/generate
                  </div>
                  <span className="dn-badge dn-badge-blue" style={{ marginTop: 6 }}>
                    Served by this application
                  </span>
                </div>
              </div>

              {webhookTestResult && (
                <div style={{ background: webhookTestResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${webhookTestResult.success ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: webhookTestResult.success ? '#166534' : '#991b1b' }}>
                      {webhookTestResult.success ? 'Webhook Execution Succeeded' : 'Webhook Error'}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Latency: {webhookTestResult.elapsed}ms</span>
                  </div>
                  <div style={{ fontSize: 12, color: webhookTestResult.success ? '#14532d' : '#7f1d1d' }}>
                    {webhookTestResult.success
                      ? `SNS Workbench returned generated content with status: "${webhookTestResult.status}".`
                      : webhookTestResult.error}
                  </div>
                </div>
              )}
            </div>

            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>
                Pipeline Execution Nodes (Configured in Workbench JSON)
              </div>

              <div className="dn-workflow-nodes-grid">
                {WORKBENCH_PIPELINE_NODES.map(node => (
                  <div key={node.id} className="dn-wf-node-card">
                    <span className="dn-wf-node-badge">{node.number}</span>
                    <div style={{ flex: 1 }}>
                      <div className="dn-wf-node-title">{node.name}</div>
                      <div style={{ fontSize: 10.5, color: '#2563eb', fontWeight: 600, marginTop: 2 }}>{node.type}</div>
                      <div className="dn-wf-node-desc">{node.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Lead Profile Modal ── */}
      {selectedLead && (
        <div className="dn-modal-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="dn-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="dn-modal-header">
              <div className="dn-modal-title">
                Client Profile & Nurturing History: {selectedLead.name}
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setSelectedLead(null)}
              >
                &times;
              </button>
            </div>

            <div className="dn-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Designation</div>
                  <div style={{ fontWeight: 600 }}>{selectedLead.designation}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Company</div>
                  <div style={{ fontWeight: 600 }}>{selectedLead.company}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Sector / Industry</div>
                  <div style={{ fontWeight: 600 }}>{selectedLead.sector || selectedLead.industry}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Location</div>
                  <div style={{ fontWeight: 600 }}>{selectedLead.location || `${selectedLead.city}, ${selectedLead.state}`}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Email</div>
                  <div style={{ fontWeight: 600 }}>{selectedLead.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Phone</div>
                  <div style={{ fontWeight: 600 }}>{selectedLead.phone}</div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Touchpoint Timeline & Telemetry</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(selectedLead.timeline || []).map((t, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>{t.title}</span>
                        <span>{t.date}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#334155', marginTop: 3 }}>{t.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="dn-modal-footer">
              <button
                className="dn-btn dn-btn-secondary"
                onClick={() => setSelectedLead(null)}
              >
                Close
              </button>
              <button
                className="dn-btn dn-btn-primary"
                onClick={() => {
                  const target = selectedLead;
                  setSelectedLead(null);
                  handleGenerateContent(target);
                }}
              >
                <Sparkles size={13} /> Generate Newsletter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import from Extraction Agent Modal ── */}
      {isImportFromExtractionOpen && (
        <div className="dn-modal-backdrop" onClick={() => setIsImportFromExtractionOpen(false)}>
          <div className="dn-modal-container" style={{ maxWidth: 750 }} onClick={(e) => e.stopPropagation()}>
            <div className="dn-modal-header">
              <div className="dn-modal-title">
                <UserPlus size={16} color="#2563eb" style={{ display: 'inline', marginRight: 6 }} />
                Import Extracted Leads into Digital Nurturing
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setIsImportFromExtractionOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="dn-modal-body">
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
                Select contacts extracted by the <strong>Contact Data Extraction & Structuring Agent</strong> to enroll into automated nurturing cadences:
              </p>

              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <table className="dn-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedExtractedIds.size === extractedLeads.length && extractedLeads.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExtractedIds(new Set(extractedLeads.map(l => l.id || l.name || l.full_name)));
                            } else {
                              setSelectedExtractedIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th>Lead Name</th>
                      <th>Company</th>
                      <th>Industry / Sector</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedLeads.slice(0, 50).map(lead => {
                      const id = lead.id || lead.name || lead.full_name;
                      const isSelected = selectedExtractedIds.has(id);
                      return (
                        <tr key={id} onClick={() => {
                          const next = new Set(selectedExtractedIds);
                          if (isSelected) next.delete(id);
                          else next.add(id);
                          setSelectedExtractedIds(next);
                        }} style={{ cursor: 'pointer' }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                            />
                          </td>
                          <td>
                            <strong>{lead.full_name || lead.name}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{lead.designation}</div>
                          </td>
                          <td>{lead.company}</td>
                          <td>
                            <span className="dn-badge dn-badge-blue">
                              {lead.sector || lead.industry || 'Technology'}
                            </span>
                          </td>
                          <td>
                            <span className="dn-badge dn-badge-green">
                              {lead.ai_score || 85}/100
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="dn-modal-footer">
              <button
                className="dn-btn dn-btn-secondary"
                onClick={() => setIsImportFromExtractionOpen(false)}
              >
                Cancel
              </button>
              <button
                className="dn-btn dn-btn-primary"
                onClick={handleImportExtractedLeads}
                disabled={selectedExtractedIds.size === 0}
              >
                Enroll {selectedExtractedIds.size} Leads into Nurturing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dispatched Campaign Message Copy Preview Modal ── */}
      {selectedCampaignForPreview && (
        <div className="dn-modal-backdrop" onClick={() => setSelectedCampaignForPreview(null)}>
          <div className="dn-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="dn-modal-header">
              <div className="dn-modal-title">
                Campaign Message Copy: {selectedCampaignForPreview.name}
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setSelectedCampaignForPreview(null)}
              >
                &times;
              </button>
            </div>

            <div className="dn-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Category</div>
                  <div style={{ fontWeight: 600 }}>{selectedCampaignForPreview.type}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Target Audience</div>
                  <div style={{ fontWeight: 600 }}>{selectedCampaignForPreview.audience || selectedCampaignForPreview.sector}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Dispatched Via</div>
                  <div style={{ fontWeight: 600 }}>{selectedCampaignForPreview.channel || 'Email + WhatsApp'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Sent Timestamp</div>
                  <div style={{ fontWeight: 600 }}>{selectedCampaignForPreview.sent_at || 'Recent'}</div>
                </div>
              </div>

              {selectedCampaignForPreview.image_url && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Attached Picture / Banner
                  </div>
                  <img
                    src={selectedCampaignForPreview.image_url}
                    alt="Campaign Attachment Preview"
                    style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Subject Line</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e40af', marginTop: 4, padding: '8px 12px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  {selectedCampaignForPreview.subject || selectedCampaignForPreview.name}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Email Body</div>
                <div style={{ fontSize: 12.5, color: '#334155', background: '#ffffff', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0', marginTop: 4, maxHeight: 320, overflowY: 'auto' }}>
                  {selectedCampaignForPreview.email_body
                    ? <EmailBodyPreview content={selectedCampaignForPreview.email_body} />
                    : 'No email copy recorded.'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>WhatsApp Multi-Channel Copy</div>
                <div style={{ fontSize: 12, color: '#065f46', background: '#ecfdf5', padding: 12, borderRadius: 6, border: '1px solid #a7f3d0', marginTop: 4 }}>
                  {selectedCampaignForPreview.whatsapp_message || 'No WhatsApp copy recorded.'}
                </div>
              </div>
            </div>

            <div className="dn-modal-footer">
              <button
                className="dn-btn dn-btn-secondary"
                onClick={() => setSelectedCampaignForPreview(null)}
              >
                Close
              </button>
              {selectedCampaignForPreview.status === 'Draft' && (
                <button
                  className="dn-btn dn-btn-primary"
                  onClick={() => {
                    const draft = selectedCampaignForPreview;
                    setSelectedCampaignForPreview(null);
                    handleResumeDraft(draft);
                  }}
                >
                  <Edit3 size={13} /> Resume & Edit Draft
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Toast ── */}
      {notification && (
        <div
          className={`dn-toast ${
            notification.type === 'opt_in'
              ? 'toast-opt-in'
              : notification.type === 'opt_out'
              ? 'toast-opt-out'
              : notification.isError
              ? 'error'
              : ''
          }`}
        >
          {notification.type === 'opt_in' ? (
            <div className="dn-toast-icon-badge opt-in">
              <UserCheck size={16} />
            </div>
          ) : notification.type === 'opt_out' ? (
            <div className="dn-toast-icon-badge opt-out">
              <UserX size={16} />
            </div>
          ) : notification.isError ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}

          <div className="dn-toast-content">
            {notification.title && (
              <div className="dn-toast-title">
                {notification.title}
                {notification.type === 'opt_in' && <span className="dn-toast-tag green">OPT-IN</span>}
                {notification.type === 'opt_out' && <span className="dn-toast-tag red">OPT-OUT</span>}
              </div>
            )}
            <div className="dn-toast-msg">{notification.text}</div>
          </div>

          <button
            className="dn-toast-dismiss"
            onClick={() => setNotification(null)}
            title="Dismiss notification"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
