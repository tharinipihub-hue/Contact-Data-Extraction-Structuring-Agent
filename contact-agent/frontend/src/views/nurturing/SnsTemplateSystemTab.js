import React, { useState, useMemo } from 'react';
import axios from 'axios';
import {
  Layers,
  Sparkles,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  Edit3,
  Send,
  Users,
  ShieldCheck,
  Mail,
  ArrowRight,
  Plus,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  Calendar,
  RefreshCw,
  X,
  AlertTriangle,
  FileText,
  Globe,
  Sliders,
  Gift,
  Building,
  Bookmark
} from 'lucide-react';
import ClientEmailPreview from './ClientEmailPreview';
import { buildSnsTemplateEmailHtml, interpolateEmailHtmlVars, interpolateTemplateVars } from './templateEmailBuilder';
import { normalizeWorkbenchTemplateContent } from './workbenchTemplateContent';
import './SnsTemplateSystemTab.css';

// Preset High Quality Tech & Enterprise Imagery matching the visual reference
const IMAGE_PRESETS = [
  {
    id: 'cloud_infra',
    title: 'FedRAMP Cloud Modernisation',
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'mobility_ai',
    title: 'Intelligent Mobility & Logistics',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'data_center',
    title: 'AI Decision Engines & Compute',
    url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'cyber_security',
    title: 'Enterprise Cyber Resilience',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80'
  },
  {
    id: 'festive_diwali',
    title: 'Executive Festive Lights',
    url: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=800&auto=format&fit=crop&q=80'
  }
];

// 5 Core SNS Square Campaign Templates
const SNS_TEMPLATES_CATALOG = [
  {
    id: 'editorial_newsletter',
    name: 'SNS Editorial Newsletter',
    category: 'Newsletter',
    tag: 'Official Framework',
    purpose: 'Weekly industry/GCC/AI newsletter with multi-perspective editorial analysis, curated article cards, and GCC execution banner.',
    headerTitle: 'Your Weekly GCC & AI Scoop',
    headerSubtitle: 'Core Perspective | Wednesday Edition',
    defaultSubject: 'Enterprise AI & Cloud Transformation | SNS Square Weekly GCC & AI Scoop',
    greetingType: 'editorial', // 'editorial' = 'Hello Readers,' | 'personal' = 'Dear {{first_name}},'
    heroHeadline: 'Navigating Sustainable Enterprise Transformation',
    heroBody: 'Enterprise transformation is entering a new phase, one where success is no longer measured by the number of digital initiatives launched, but by the resilience and intelligence of the systems that support them.\n\nWhether modernising government infrastructure, optimising transportation networks, accelerating public services, or preparing the workforce for AI, organisations are recognising a common reality: technology alone does not create value. Sustainable transformation requires secure foundations, intelligent automation, and a workforce prepared to evolve alongside AI.',
    blocks: [
      {
        id: 'b1',
        headline: 'FedRAMP Cloud Modernisation: Building a Secure Digital Foundation',
        image: IMAGE_PRESETS[0].url,
        body: 'Cloud modernisation has become a strategic priority for government agencies, but success depends on more than migration. FedRAMP provides the security and compliance framework required to modernise mission-critical systems while maintaining trust, resilience, and operational continuity. As cloud adoption accelerates, security-by-design is becoming the cornerstone of digital government.',
        ctaText: 'Build secure digital foundations',
        ctaUrl: 'https://www.snssquare.com/insights'
      },
      {
        id: 'b2',
        headline: 'Intelligent Mobility: Reimagining Transportation Through AI',
        image: IMAGE_PRESETS[1].url,
        body: 'Transportation is evolving from a connected ecosystem to an intelligent one. AI-powered mobility solutions are enabling logistics providers, fleet operators, and supply chain leaders to anticipate disruptions, optimise routes, improve asset utilisation, and make real-time operational decisions. The result is a transportation ecosystem that is more agile, efficient, and responsive to changing business demands.',
        ctaText: 'Reimagine intelligent mobility',
        ctaUrl: 'https://www.snssquare.com/insights'
      }
    ],
    foundationsTitle: 'Every transformation initiative ultimately depends on four foundations:',
    foundations: [
      'Secure digital infrastructure that enables innovation.',
      'Intelligent systems that improve operational performance.',
      'Modern public and enterprise services designed for speed and resilience.',
      'A workforce equipped to thrive alongside AI.'
    ],
    closingText: 'Together, these capabilities form the foundation of resilient, intelligent organisations that are ready to adapt, compete, and grow in an AI-driven world.',
    promoBanner: {
      headline: 'Data & Agentic AI Services. Built for Execution.',
      body: 'Design, build, and operate production-grade data and Agentic AI systems that move workflows from insight to autonomous action.',
      partnerBadge: 'Trusted Build and Operational Partner for Global Capability Center (GCCs) in India',
      ctaText: 'Explore GCC Services',
      ctaUrl: 'https://www.snssquare.com/gcc-services'
    }
  },
  {
    id: 'festival_greeting',
    name: 'SNS Festival & Seasonal Greeting',
    category: 'Occasion',
    tag: 'Cultural Intelligence',
    purpose: 'Culturally aligned, warm seasonal client greetings celebrating shared milestones, gratitude, and future prosperity.',
    headerTitle: 'Warm Executive Festive Wishes',
    headerSubtitle: 'Celebrating Shared Milestones & Prosperity',
    defaultSubject: 'Warm Festive Wishes to {{company}} from SNS Square',
    greetingType: 'personal',
    heroHeadline: 'Celebrating Shared Milestones and Enduring Partnership',
    heroBody: 'As we celebrate this joyous festive season, all of us at SNS Square extend our warmest greetings to you and the entire team at {{company}}.\n\nPartnerships built on mutual trust, shared innovation, and relentless execution are the cornerstone of sustainable success. We value the milestones we have achieved together and look forward to scaling new heights in the season ahead.',
    blocks: [
      {
        id: 'b1',
        headline: 'A Season of Renewal, Growth, and Shared Prosperity',
        image: IMAGE_PRESETS[4].url,
        body: 'May this festive season illuminate new avenues of growth, health, and prosperity for you, your colleagues, and your families. Thank you for your continued confidence in our team.',
        ctaText: 'Connect with Executive Leadership',
        ctaUrl: 'https://www.snssquare.com/leadership'
      }
    ],
    foundationsTitle: 'Reflecting on the foundations of our collaboration:',
    foundations: [
      'Unyielding commitment to technical and delivery excellence.',
      'Collaborative alignment across strategic objectives.',
      'Transparent partnership grounded in mutual respect.'
    ],
    closingText: 'Wishing you, your family, and your entire organisation a joyous, safe, and prosperous celebration.\n\nWarm regards,\nThe Team at SNS Square\nEnterprise Client Partnerships',
    promoBanner: {
      headline: 'Empowering Enterprise Excellence Together',
      body: 'We are proud to serve as your strategic technology and Agentic AI partner across global centers.',
      partnerBadge: 'Executive Partnership Desk',
      ctaText: 'Visit SNS Square',
      ctaUrl: 'https://www.snssquare.com'
    }
  },
  {
    id: 'promotional_campaign',
    name: 'SNS Enterprise Promotional Campaign',
    category: 'Campaign',
    tag: 'Executive Solutions',
    purpose: 'Enterprise AI, Cloud & Data Capability showcase with executive positioning and direct client engagement call-to-action.',
    headerTitle: 'Enterprise Agentic AI & Data Capabilities',
    headerSubtitle: 'Strategic Advisory & Production Execution',
    defaultSubject: 'Data & Agentic AI Capabilities for {{company}} | SNS Square Strategic Update',
    greetingType: 'personal',
    heroHeadline: 'Moving From Experimental AI to Autonomous Production Systems',
    heroBody: 'Modern enterprises require data architectures and AI agents engineered for deterministic, secure production execution.\n\nSNS Square partners with forward-thinking enterprises and Global Capability Centers (GCCs) to design, build, and operate resilient systems that automate complex workflows and unlock measurable ROI.',
    blocks: [
      {
        id: 'b1',
        headline: 'Agentic Workflow Automation: Autonomous Decision Workflows',
        image: IMAGE_PRESETS[2].url,
        body: 'Our Agentic AI systems combine real-time domain grounding with multi-agent orchestration. By integrating strict governance and human-in-the-loop validation, teams accelerate throughput without sacrificing regulatory control.',
        ctaText: 'Schedule Technical Demonstration',
        ctaUrl: 'https://www.snssquare.com/demo'
      },
      {
        id: 'b2',
        headline: 'Global Capability Center (GCC) Incubation & Acceleration',
        image: IMAGE_PRESETS[3].url,
        body: 'From talent deployment to secure cloud landing zones, SNS Square acts as a trusted operational build-partner for multinationals scaling high-impact engineering centers in India.',
        ctaText: 'Explore GCC Acceleration Framework',
        ctaUrl: 'https://www.snssquare.com/gcc-services'
      }
    ],
    foundationsTitle: 'Key delivery tenets powering our enterprise client engagements:',
    foundations: [
      'Zero-compromise security posture and regulatory compliance.',
      'Production-tested agentic architectures with measurable SLA guarantees.',
      'End-to-end telemetry and continuous model performance monitoring.',
      'Dedicated GCC leadership and engineering excellence.'
    ],
    closingText: 'Ready to elevate your data and AI roadmap? Our enterprise architecture practice is available for a confidential briefing.',
    promoBanner: {
      headline: 'Data & Agentic AI Services. Built for Execution.',
      body: 'Design, build, and operate production-grade data and Agentic AI systems that move workflows from insight to autonomous action.',
      partnerBadge: 'Trusted Build & Operational Partner for GCCs in India',
      ctaText: 'Explore GCC Services',
      ctaUrl: 'https://www.snssquare.com/gcc-services'
    }
  },
  {
    id: 'event_invitation',
    name: 'SNS Executive Event & Webinar Invitation',
    category: 'Event',
    tag: 'Executive Roundtables',
    purpose: 'Exclusive invitations for leadership roundtables, AI innovation symposiums, and CXO technical briefings.',
    headerTitle: 'Executive Leadership Roundtable',
    headerSubtitle: 'Exclusive CXO & Engineering Leadership Forum',
    defaultSubject: 'Invitation: Enterprise Agentic AI Roundtable 2026 for {{company}}',
    greetingType: 'personal',
    heroHeadline: 'You Are Invited: The 2026 GCC & AI Transformation Summit',
    heroBody: 'We are pleased to invite you to an exclusive closed-door executive roundtable bringing together engineering heads, CDOs, and GCC directors to discuss pragmatic agentic AI deployment, sovereign data architectures, and delivery resilience.\n\nDate: Thursday, November 12, 2026\nFormat: Hybrid (Executive Lounge, Embassy TechVillage, Bengaluru & Private Virtual Stream)',
    blocks: [
      {
        id: 'b1',
        headline: 'Keynote & Panel: Scaling Autonomous Agent Swarms Under Regulatory Governance',
        image: IMAGE_PRESETS[0].url,
        body: 'Industry leaders will present verified case studies on deploying autonomous AI workflows in banking, healthcare, and supply chain operations, followed by an interactive Q&A session.',
        ctaText: 'Reserve Your Executive Seat',
        ctaUrl: 'https://www.snssquare.com/events/roundtable-2026'
      }
    ],
    foundationsTitle: 'Roundtable Agenda & Strategic Focus:',
    foundations: [
      'Architectural blueprints for enterprise agentic integration.',
      'Evaluating compliance, SOC 2, and data boundary safety in agent swarms.',
      'GCC talent transformation and engineering readiness.',
      'Peer executive networking and collaborative lunch.'
    ],
    closingText: 'Seats are strictly limited to ensure meaningful discussion. Please confirm your attendance at your earliest convenience.',
    promoBanner: {
      headline: 'SNS Square Executive Thought Leadership',
      body: 'Curating actionable insights and peer dialogue for enterprise digital leaders worldwide.',
      partnerBadge: 'SNS Executive Network',
      ctaText: 'View Full Agenda',
      ctaUrl: 'https://www.snssquare.com/events'
    }
  },
  {
    id: 'client_update',
    name: 'SNS Strategic Client & Partnership Update',
    category: 'Client Update',
    tag: 'Client Advisory',
    purpose: 'Periodic partnership milestone reviews, SLA performance updates, and technology roadmap alignment.',
    headerTitle: 'Executive Client Briefing & Roadmap',
    headerSubtitle: 'SNS Square Strategic Partnership Services',
    defaultSubject: 'Partnership Milestone & Platform Update for {{company}}',
    greetingType: 'personal',
    heroHeadline: 'Quarterly Partnership Milestones & Capabilities Update',
    heroBody: 'We are pleased to share our periodic executive briefing highlighting recent platform enhancements, security enhancements, and upcoming delivery capabilities tailored for {{company}}.\n\nOur joint initiatives continue to deliver measurable efficiencies, and we remain dedicated to supporting your operational objectives with the highest standards of reliability.',
    blocks: [
      {
        id: 'b1',
        headline: 'Platform Performance & Operational Milestones Delivered',
        image: IMAGE_PRESETS[3].url,
        body: 'Over the past quarter, our teams successfully completed system optimization passes, reducing extraction latencies by 38% and achieving 99.98% uptime across all production pipeline nodes.',
        ctaText: 'Review Full Milestone Report',
        ctaUrl: 'https://www.snssquare.com/portal'
      }
    ],
    foundationsTitle: 'Key operational metrics across our partnership:',
    foundations: [
      'Sub-second API response times across core extraction workflows.',
      'Zero reported compliance or opt-in governance infractions.',
      'Continuous feature delivery aligned with client engineering priorities.'
    ],
    closingText: 'We welcome your feedback and look forward to our upcoming quarterly review meeting.',
    promoBanner: {
      headline: 'Dedicated Enterprise Support & Advisory',
      body: 'Your dedicated Client Partner is available for technical escalations, architecture guidance, and roadmapping.',
      partnerBadge: 'Enterprise Client Advisory',
      ctaText: 'Contact Client Partner',
      ctaUrl: 'mailto:partnerships@snssquare.com'
    }
  }
];

export default function SnsTemplateSystemTab({
  contacts = [],
  apiBase = '/api',
  showNotification,
  onUseTemplateInCampaign
}) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [activeTemplate, setActiveTemplate] = useState(null); // When customizing/previewing
  const [wizardStep, setWizardStep] = useState(1); // 1: Customize, 2: Preview, 3: Audience, 4: Review & Send

  // Customization Form State
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerSubtitle, setHeaderSubtitle] = useState('');
  const [greetingType, setGreetingType] = useState('editorial');
  const [heroHeadline, setHeroHeadline] = useState('');
  const [heroBody, setHeroBody] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [foundationsTitle, setFoundationsTitle] = useState('');
  const [foundations, setFoundations] = useState([]);
  const [closingText, setClosingText] = useState('');
  const [promoBanner, setPromoBanner] = useState({
    headline: '',
    body: '',
    partnerBadge: '',
    ctaText: '',
    ctaUrl: ''
  });

  // Preview & Audience State
  const [previewContactId, setPreviewContactId] = useState(contacts.find(contact => contact.opt_in === true)?.id || '');
  const [audienceScope, setAudienceScope] = useState('all'); // 'all' | 'segment' | 'industry' | 'region' | 'selected'
  const [audienceFilterValue, setAudienceFilterValue] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState(contacts.filter(c => c.opt_in).map(c => c.id));
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessModal, setSendSuccessModal] = useState(null);

  // Workbench AI Synthesis Assist State
  const [aiTopic, setAiTopic] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuccess, setAiSuccess] = useState(null);
  const [workbenchResponseStatus, setWorkbenchResponseStatus] = useState('not_requested');
  const [customizeError, setCustomizeError] = useState('');
  const [isCheckingWorkbench, setIsCheckingWorkbench] = useState(false);

  const previewContact = useMemo(() => {
    return contacts.find(c => c.id === previewContactId && c.opt_in === true) || contacts.find(c => c.opt_in === true) || null;
  }, [contacts, previewContactId]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    if (selectedFilter === 'all') return SNS_TEMPLATES_CATALOG;
    return SNS_TEMPLATES_CATALOG.filter(t => t.category.toLowerCase().includes(selectedFilter.toLowerCase()));
  }, [selectedFilter]);

  // Open Customizer for a template
  const handleSelectTemplate = (template, stepToOpen = 1) => {
    setActiveTemplate(template);
    setCampaignName(`${template.name} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    setSubjectLine(template.defaultSubject);
    setHeaderTitle(template.headerTitle);
    setHeaderSubtitle(template.headerSubtitle);
    setGreetingType(template.greetingType);
    setHeroHeadline(template.heroHeadline);
    setHeroBody(template.heroBody);
    setBlocks(JSON.parse(JSON.stringify(template.blocks || [])));
    setFoundationsTitle(template.foundationsTitle || '');
    setFoundations(JSON.parse(JSON.stringify(template.foundations || [])));
    setClosingText(template.closingText || '');
    setPromoBanner(JSON.parse(JSON.stringify(template.promoBanner || {})));
    setAiTopic(template.heroHeadline || template.name);
    setAiError(null);
    setAiSuccess(null);
    setCustomizeError('');
    setWizardStep(stepToOpen === 2 ? 1 : stepToOpen);
  };

  const validateCustomize = () => {
    if (!campaignName.trim()) return 'Campaign name is required.';
    if (!subjectLine.trim()) return 'Email subject line is required.';
    const validOptionalUrl = (value, protocols) => {
      if (!String(value || '').trim()) return true;
      try {
        const parsed = new URL(value);
        return protocols.includes(parsed.protocol) && (parsed.protocol === 'mailto:' || Boolean(parsed.hostname));
      } catch (_error) { return false; }
    };
    if (blocks.some(block => !validOptionalUrl(block.image, ['https:']) || !validOptionalUrl(block.ctaUrl, ['https:', 'http:', 'mailto:'])) ||
      !validOptionalUrl(promoBanner.ctaUrl, ['https:', 'http:', 'mailto:'])) {
      return 'Use a valid HTTPS image URL and a valid HTTP, HTTPS, or mailto CTA URL, or leave optional URL fields empty.';
    }
    return '';
  };

  const proceedToPreview = () => {
    const issue = validateCustomize();
    setCustomizeError(issue);
    if (!issue) setWizardStep(2);
  };

  const checkWorkbenchDeployment = async () => {
    setIsCheckingWorkbench(true);
    try {
      const status = await axios.get(`${apiBase.replace(/\/$/, '')}/nurture/workbench-status`, { timeout: 10000 });
      const detail = status.data?.mode === 'test_webhook'
        ? 'The TEST webhook responded. Template generation still uses the production webhook.'
        : status.data?.message || 'Deployment status refreshed.';
      setAiError(current => ({ ...current, message: `${current?.message || 'Production generation is unavailable.'} ${detail}` }));
    } catch (error) {
      setAiError(current => ({ ...current, message: `${current?.message || 'Production generation is unavailable.'} Deployment status check failed: ${error.response?.data?.message || error.message}` }));
    } finally {
      setIsCheckingWorkbench(false);
    }
  };

  // Synthesize content via SNS Workbench AI without replacing brand visual structure
  const handleGenerateWithWorkbench = async () => {
    if (!activeTemplate) return;
    if (!aiTopic.trim()) {
      setAiError({ message: 'Enter a campaign focus or topic before requesting SNS Workbench synthesis.', errorType: 'validation_error' });
      return;
    }
    if (!previewContact || previewContact.opt_in !== true) {
      setAiError({ message: 'Select an opted-in preview recipient before requesting SNS Workbench synthesis.', errorType: 'validation_error' });
      return;
    }
    setIsAiGenerating(true);
    setAiError(null);
    setAiSuccess(null);

    const topicToUse = aiTopic.trim();

    try {
      const payload = {
        campaign_type: activeTemplate.category.toLowerCase().replace(/\s+/g, '_'),
        campaign_name: campaignName || `${activeTemplate.name} AI Synthesis`,
        topic: topicToUse,
        developer_input: topicToUse,
        brief: topicToUse,
        contact_id: previewContact.id,
        contacts: [previewContact],
        sector: previewContact.sector || previewContact.industry || 'Technology'
      };

      const res = await axios.post(`${apiBase}/campaigns/generate`, payload, { timeout: 35000 });
      if (!res.data?.success || res.data?.content_source !== 'workbench') {
        throw { response: { status: res.status, data: res.data } };
      }
      const preview = normalizeWorkbenchTemplateContent(res.data);
      if (!preview || !Object.values(preview).some(value => value && (typeof value !== 'object' || Object.keys(value).length))) {
        setWorkbenchResponseStatus('no_usable_content');
        setAiError({ message: 'Workbench responded, but no usable campaign content was returned.', errorType: 'no_usable_content', httpStatus: res.data?.workbench_http_status, response: res.data?.workbench_response });
        return;
      }
      {
        if (preview.subjectLine) setSubjectLine(preview.subjectLine);
        if (preview.heroHeadline) setHeroHeadline(preview.heroHeadline);
        if (preview.heroBody) setHeroBody(preview.heroBody);
        if (preview.articles) setBlocks(current => preview.articles.map((article, index) => ({
          ...(current[index] || {}), ...article, id: current[index]?.id || `workbench-${index + 1}`
        })));
        if (preview.synthesisPoints) setFoundations(preview.synthesisPoints);
        setWorkbenchResponseStatus(res.data?.workbench_http_status || 'success');
        setAiSuccess(`Synthesized editorial copy for "${topicToUse}" via SNS Workbench.`);
        if (showNotification) {
          showNotification(`Synthesized content via SNS Workbench.`);
        }
      }
    } catch (err) {
      const errData = err.response?.data;
      const errMsg = errData?.error || err.message;
      const workbenchStatus = errData?.workbench_http_status;
      setWorkbenchResponseStatus(workbenchStatus || errData?.error_type || 'generation_failed');
      setAiError({
        message: workbenchStatus === 404 || errData?.error_type === 'workflow_not_deployed'
          ? `Workbench generation unavailable. The SNS Workbench Client Nurturing workflow is not active/deployed. Workbench response: ${errMsg}`
          : workbenchStatus === 401 || workbenchStatus === 403 || errData?.error_type === 'auth_error'
            ? 'SNS Workbench authentication/configuration error. Check the production webhook credentials.'
            : errData?.error_type === 'timeout' || errData?.error_type === 'network_error'
              ? `SNS Workbench connection/timeout error: ${errMsg}`
              : errData?.error_type === 'no_usable_content'
                ? 'Workbench responded, but no usable campaign content was returned.'
                : errData?.message || errMsg,
        actionLabel: errData?.action_label,
        actionHint: errData?.action_hint,
        errorType: errData?.error_type,
        httpStatus: workbenchStatus || err.response?.status,
        response: errData?.workbench_response,
        development: process.env.NODE_ENV !== 'production'
      });
      if (showNotification) {
        showNotification(`Workbench generation: ${errMsg}`, true);
      }
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Compile final canonical HTML email using buildSnsTemplateEmailHtml
  const compiledEmailHtml = useMemo(() => {
    if (!activeTemplate) return '';
    const customization = {
      headerTitle, headerSubtitle, greetingType, heroHeadline, heroBody,
      blocks, foundationsTitle, foundations, closingText, promoBanner
    };
    return buildSnsTemplateEmailHtml({
      template: activeTemplate,
      customization,
      recipient: null
    });
  }, [
    activeTemplate,
    headerTitle,
    headerSubtitle,
    greetingType,
    heroHeadline,
    heroBody,
    blocks,
    foundationsTitle,
    foundations,
    closingText,
    promoBanner
  ]);
  const previewEmailHtml = useMemo(() => {
    return interpolateEmailHtmlVars(compiledEmailHtml, previewContact);
  }, [compiledEmailHtml, previewContact]);

  // Target audience resolved list
  const targetAudienceContacts = useMemo(() => {
    let list = contacts.filter(c => c.opt_in === true);
    if (audienceScope === 'selected') {
      const idSet = new Set(selectedContactIds);
      return list.filter(c => idSet.has(c.id));
    }
    if (audienceScope === 'industry' && audienceFilterValue) {
      const val = audienceFilterValue.toLowerCase();
      return list.filter(c => (c.sector || c.industry || '').toLowerCase().includes(val));
    }
    if (audienceScope === 'region' && audienceFilterValue) {
      const val = audienceFilterValue.toLowerCase();
      return list.filter(c => [c.country, c.state, c.city, c.location].filter(Boolean).join(' ').toLowerCase().includes(val));
    }
    if (audienceScope === 'segment' && audienceFilterValue) {
      return list.filter(c => (c.client_type || c.segment || 'Past Clients').toLowerCase() === audienceFilterValue.toLowerCase());
    }
    return list;
  }, [contacts, audienceScope, audienceFilterValue, selectedContactIds]);

  // Dispatch campaign
  const handleDispatchCampaign = async () => {
    if (targetAudienceContacts.length === 0) {
      if (showNotification) showNotification('No opted-in contacts selected for dispatch.', true);
      return;
    }
    setIsSending(true);
    try {
      const campaignId = `CMP-TMPL-${Date.now()}`;
      const payload = {
        campaign_id: campaignId,
        campaign_name: campaignName || `${activeTemplate.name} Dispatch`,
        campaign_type: activeTemplate.category.toLowerCase().replace(/\s+/g, '_'),
        topic: headerTitle || activeTemplate.name,
        contacts: targetAudienceContacts,
        content: {
          subject: subjectLine,
          email_body: compiledEmailHtml,
          content_version: 'v1'
        }
      };

      const res = await axios.post(`${apiBase}/campaigns/dispatch`, payload, { timeout: 30000 });
      if (res.data?.success) {
        setSendSuccessModal({
          campaign: res.data.campaign || payload,
          count: targetAudienceContacts.length,
          subject: interpolateTemplateVars(subjectLine, previewContact)
        });
        if (showNotification) {
          showNotification(`Dispatched ${activeTemplate.name} to ${targetAudienceContacts.length} verified client(s).`);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (showNotification) showNotification(`Dispatch error: ${msg}`, true);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="sns-template-system">
      {/* ── Top Header / Intro Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #090e17 0%, #1e293b 60%, #1e3a8a 100%)', border: '1px solid #334155' }}>
        <div className="dn-workflow-banner-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 18, height: 18, border: '2.5px solid #ef4444', borderTopColor: '#f59e0b', borderRightColor: '#10b981', borderBottomColor: '#06b6d4', borderRadius: 3 }}></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              SNS SQUARE CAMPAIGN TEMPLATE SYSTEM
            </span>
          </div>
          <h3 style={{ color: '#ffffff', margin: 0, fontSize: 18 }}>
            Brand-Governed Campaign Templates & Multi-Perspective Editorial Families
          </h3>
          <p style={{ color: '#cbd5e1', margin: '6px 0 0 0', fontSize: 13, lineHeight: 1.5 }}>
            Enterprise-grade, client-facing templates modeled on official SNS Square publications. Supports rich hero sections, analytical blocks, execution banners, and automated consent governance.
          </p>
        </div>
      </div>

      {/* ── Mode 1: Template Gallery (When no template is currently in active editor) ── */}
      {!activeTemplate && (
        <>
          {/* Filter Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['all', 'newsletter', 'occasion', 'campaign', 'event', 'client update'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: selectedFilter === filter ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: selectedFilter === filter ? '#eff6ff' : '#ffffff',
                    color: selectedFilter === filter ? '#1d4ed8' : '#475569',
                    fontSize: 12.5,
                    fontWeight: selectedFilter === filter ? 700 : 500,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {filter === 'all' ? `All Templates (${SNS_TEMPLATES_CATALOG.length})` : filter}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: '#64748b' }}>
              Select a template to customize content and preview in real time
            </div>
          </div>

          {/* Templates Grid Cards */}
          <div className="sns-template-catalog-grid">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="dn-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Miniature Visual Mockup Header */}
                <div
                  style={{
                    background: template.category === 'Occasion'
                      ? 'linear-gradient(135deg, #701a75 0%, #a21caf 100%)'
                      : template.category === 'Event'
                        ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                    padding: '16px 20px',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 14, border: '2px solid #ef4444', borderTopColor: '#f59e0b', borderRightColor: '#10b981', borderBottomColor: '#06b6d4', borderRadius: 2 }}></div>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}>SNS SQUARE</span>
                    </div>
                    <span style={{ background: 'rgba(255,255,255,0.2)', fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                      {template.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                    {template.headerTitle}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                    {template.headerSubtitle}
                  </div>
                </div>

                {/* Card Content Area */}
                <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {template.name}
                    </h4>
                    <p style={{ margin: '6px 0 0 0', fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>
                      {template.purpose}
                    </p>
                  </div>

                  {/* Highlights */}
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: 11.5, color: '#475569' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Template Highlights:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div>&bull; {template.blocks?.length || 0} Curated Editorial Article Block(s)</div>
                      <div>&bull; GCC Execution & Agentic AI Promotional Banner</div>
                      <div>&bull; Embedded Opt-Out & Compliance Footer</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', gap: 8 }}>
                    <button
                      className="dn-btn dn-btn-secondary"
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => handleSelectTemplate(template, 2)}
                    >
                      <Eye size={13} /> Preview
                    </button>
                    <button
                      className="dn-btn dn-btn-primary"
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => handleSelectTemplate(template, 1)}
                    >
                      <Sparkles size={13} /> Use Template
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Mode 2: Interactive Template Customizer & Dispatch Flow ── */}
      {activeTemplate && (
          <div className="sns-template-wizard" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Flow Stepper Bar */}
          <div className="dn-panel" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="dn-btn dn-btn-secondary dn-btn-xs"
                onClick={() => setActiveTemplate(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                &larr; Back to Catalog
              </button>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                {activeTemplate.name}
              </span>
            </div>

            {/* Stepper Buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { step: 1, label: '1. Customize', icon: Edit3 },
                { step: 2, label: '2. Live Preview', icon: Eye },
                { step: 3, label: '3. Audience', icon: Users },
                { step: 4, label: '4. Review & Send', icon: Send }
              ].map(({ step, label, icon: StepIcon }) => (
                <button
                  key={step}
          onClick={() => {
            if (step > 1) {
              const issue = validateCustomize();
              setCustomizeError(issue);
              if (issue) return;
            }
            if (step === 4 && targetAudienceContacts.length === 0) {
              setCustomizeError('Choose at least one opted-in recipient in the Audience step before reviewing.');
              return;
            }
            setWizardStep(step);
          }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: wizardStep === step ? 700 : 500,
                    background: wizardStep === step ? '#2563eb' : '#f1f5f9',
                    color: wizardStep === step ? '#ffffff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <StepIcon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── STEP 1: CUSTOMIZE ── */}
          {wizardStep === 1 && (
            <div className="dn-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Customize Template Content
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
                    Modify headlines, copy, imagery, and call-to-actions without touching raw HTML.
                  </p>
                </div>

                {/* Variable helper pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Safe Tags:</span>
                  {['{{first_name}}', '{{company}}', '{{industry}}'].map(tag => (
                    <span key={tag} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'monospace' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Optional Workbench AI Content Synthesis Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="#2563eb" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      Synthesize Editorial Copy via SNS Workbench AI
                    </span>
                    <span style={{ fontSize: 10.5, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                      Production Webhook
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#64748b' }}>
                    Preserves SNS brand layout, multi-color square logo, and enterprise footer
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="dn-input sns-template-control"
                    placeholder="Enter editorial focus or topic (e.g., Sovereign AI, GCC Expansion, Cloud Modernization)"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    style={{ flex: 1, minWidth: 260 }}
                  />
                  <button
                    className="dn-btn dn-btn-primary"
                    onClick={handleGenerateWithWorkbench}
                    disabled={isAiGenerating}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                  >
                    {isAiGenerating ? (
                      <>
                        <RefreshCw size={13} className="spin-icon" /> Synthesizing via Workbench...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} /> Synthesize Content
                      </>
                    )}
                  </button>
                </div>

                {/* AI Status / Error Notice */}
                {aiError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertTriangle size={15} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.45 }}>
                      <strong>{aiError.errorType === 'workflow_not_deployed' ? 'Workbench generation unavailable' : 'Workbench Generation Notice'}:</strong> {aiError.message}
                      {aiError.actionHint && (
                        <div style={{ marginTop: 4, color: '#7f1d1d', fontSize: 11.5 }}>
                          <em>Guidance: {aiError.actionHint}</em>
                        </div>
                      )}
                      {aiError.errorType === 'workflow_not_deployed' && (
                        <button type="button" className="dn-btn dn-btn-secondary dn-btn-xs" onClick={checkWorkbenchDeployment} disabled={isCheckingWorkbench} style={{ marginTop: 8 }}>
                          {isCheckingWorkbench ? 'Checking deployment...' : (aiError.actionLabel || 'Check Workbench Deployment')}
                        </button>
                      )}
                      {aiError.development && (
                        <details style={{ marginTop: 8 }}>
                          <summary>Development diagnostics</summary>
                          <div>Template: {activeTemplate?.name || 'none'}; usable generated content received: no; Workbench HTTP status: {aiError.httpStatus || workbenchResponseStatus}</div>
                          {aiError.response && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'auto' }}>{JSON.stringify(aiError.response, null, 2)}</pre>}
                        </details>
                      )}
                    </div>
                  </div>
                )}

                {aiSuccess && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} color="#16a34a" />
                    <span style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>
                      {aiSuccess}
                    </span>
                  </div>
                )}
              </div>

              {/* Form Fields Grid */}
              <div className="sns-template-form-grid">
                <div className="sns-template-field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    className="dn-input sns-template-control"
                    required
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="sns-template-field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    className="dn-input sns-template-control"
                    required
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                  />
                </div>

                <div className="sns-template-field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Header Title (Banner)
                  </label>
                  <input
                    type="text"
                    className="dn-input sns-template-control"
                    value={headerTitle}
                    onChange={(e) => setHeaderTitle(e.target.value)}
                  />
                </div>

                <div className="sns-template-field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Header Subtitle / Edition
                  </label>
                  <input
                    type="text"
                    className="dn-input sns-template-control"
                    value={headerSubtitle}
                    onChange={(e) => setHeaderSubtitle(e.target.value)}
                  />
                </div>
              </div>

              {/* Greeting & Hero Intro */}
              <div style={{ background: '#f8fafc', padding: 18, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Hero & Greeting Section</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="greetingType"
                        checked={greetingType === 'editorial'}
                        onChange={() => setGreetingType('editorial')}
                      />
                      Editorial ("Hello Readers,")
                    </label>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="greetingType"
                        checked={greetingType === 'personal'}
                        onChange={() => setGreetingType('personal')}
                      />
                      Personalized ("Dear {`{first_name}`},")
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Opening Section Headline (Optional)
                  </label>
                  <input
                    type="text"
                    className="dn-input sns-template-control"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Opening Editorial Paragraph(s)
                  </label>
                  <textarea
                    className="dn-input sns-template-control"
                    rows={4}
                    value={heroBody}
                    onChange={(e) => setHeroBody(e.target.value)}
                  />
                </div>
              </div>

              {/* Content Blocks (Articles) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Editorial Content Blocks</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>({blocks.length} block(s))</span>
                  </div>
                  <button
                    className="dn-btn dn-btn-secondary dn-btn-xs"
                    onClick={() => {
                      setBlocks([
                        ...blocks,
                        {
                          id: `b-${Date.now()}`,
                          headline: '',
                          image: '',
                          body: '',
                          ctaText: '',
                          ctaUrl: ''
                        }
                      ]);
                    }}
                  >
                    <Plus size={12} /> Add Content Block
                  </button>
                </div>

                {blocks.map((block, bIdx) => (
                  <div key={block.id || bIdx} className="sns-template-block-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>Block {bIdx + 1}</span>
                      {blocks.length > 1 && (
                        <button
                          onClick={() => setBlocks(blocks.filter((_, idx) => idx !== bIdx))}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="sns-template-block-fields-grid">
                      <div className="sns-template-field">
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Headline</label>
                        <input
                          type="text"
                          className="dn-input sns-template-control"
                          value={block.headline}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            newBlocks[bIdx].headline = e.target.value;
                            setBlocks(newBlocks);
                          }}
                        />
                      </div>

                      <div className="sns-template-field">
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Header Image URL</label>
                        <input
                          type="text"
                          className="dn-input sns-template-control"
                          value={block.image}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            newBlocks[bIdx].image = e.target.value;
                            setBlocks(newBlocks);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Analytical Paragraph</label>
                      <textarea
                        className="dn-input sns-template-control"
                        rows={3}
                        value={block.body}
                        onChange={(e) => {
                          const newBlocks = [...blocks];
                          newBlocks[bIdx].body = e.target.value;
                          setBlocks(newBlocks);
                        }}
                      />
                    </div>

                    <div className="sns-template-block-cta-grid">
                      <div className="sns-template-field">
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>CTA Button Label</label>
                        <input
                          type="text"
                          className="dn-input sns-template-control"
                          value={block.ctaText}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            newBlocks[bIdx].ctaText = e.target.value;
                            setBlocks(newBlocks);
                          }}
                        />
                      </div>
                      <div className="sns-template-field">
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>CTA Target URL</label>
                        <input
                          type="text"
                          className="dn-input sns-template-control"
                          value={block.ctaUrl}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            newBlocks[bIdx].ctaUrl = e.target.value;
                            setBlocks(newBlocks);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <button
                  className="dn-btn dn-btn-primary"
                  onClick={proceedToPreview}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Proceed to Live Preview <ChevronRight size={14} />
                </button>
              </div>
              {customizeError && <p className="sns-template-validation-error" role="alert">{customizeError}</p>}
            </div>
          )}

          {/* ── STEP 2: LIVE EMAIL PREVIEW ── */}
          {wizardStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Recipient Picker Bar */}
              <div className="dn-panel" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                    Render Preview As Client:
                  </span>
                  <select
                    className="dn-input sns-template-control"
                    style={{ width: 'auto', minWidth: 220 }}
                    value={previewContactId}
                    onChange={(e) => setPreviewContactId(e.target.value)}
                  >
                    {contacts.filter(c => c.opt_in === true).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.company} ({c.sector || 'Technology'}) {c.opt_in ? '✓' : '(Opted Out)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="dn-btn dn-btn-secondary dn-btn-sm"
                    onClick={() => setWizardStep(1)}
                  >
                    <Edit3 size={12} /> Edit Content
                  </button>
                  <button
                    className="dn-btn dn-btn-primary dn-btn-sm"
                    onClick={() => setWizardStep(3)}
                  >
                    Select Audience <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              {/* Official Client Email Preview Frame */}
              <ClientEmailPreview
                subject={interpolateTemplateVars(subjectLine, previewContact)}
                bodyHtml={previewEmailHtml}
                recipient={previewContact}
                campaignName={campaignName}
                campaignType={activeTemplate.category}
                contentVersion="v1"
              />
            </div>
          )}

          {/* ── STEP 3: AUDIENCE SELECTION ── */}
          {wizardStep === 3 && (
            <div className="dn-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Select Campaign Audience
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Target opted-in contacts by database segment, industry, or specific clients.
                </p>
              </div>

              {/* Radio Scope Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  { id: 'all', title: 'Entire Opted-In Database', desc: 'All clients with active consent' },
                  { id: 'industry', title: 'By Sector / Industry', desc: 'Filter by Technology, Finance, etc.' },
                  { id: 'region', title: 'By Geographic Region', desc: 'Filter by India, USA, etc.' },
                  { id: 'selected', title: 'Specific Selected Contacts', desc: 'Pick individual recipients' }
                ].map((sc) => (
                  <div
                    key={sc.id}
                    onClick={() => {
                      setAudienceScope(sc.id);
                      if (sc.id === 'industry') setAudienceFilterValue('Technology');
                      if (sc.id === 'region') setAudienceFilterValue('USA');
                    }}
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      border: audienceScope === sc.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: audienceScope === sc.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: audienceScope === sc.id ? '#1d4ed8' : '#0f172a' }}>
                      {sc.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                      {sc.desc}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sub-Filter Controls */}
              {audienceScope === 'industry' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Select Industry Filter
                  </label>
                  <select
                    className="dn-input sns-template-control"
                    value={audienceFilterValue}
                    onChange={(e) => setAudienceFilterValue(e.target.value)}
                  >
                    <option value="Technology">Technology & Software</option>
                    <option value="Finance">Banking & Financial Services</option>
                    <option value="Healthcare">Healthcare & Life Sciences</option>
                    <option value="Manufacturing">Manufacturing & Supply Chain</option>
                    <option value="Retail">Retail & E-Commerce</option>
                  </select>
                </div>
              )}

              {audienceScope === 'region' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 5 }}>
                    Select Region Filter
                  </label>
                  <select
                    className="dn-input sns-template-control"
                    value={audienceFilterValue}
                    onChange={(e) => setAudienceFilterValue(e.target.value)}
                  >
                    <option value="USA">United States / North America</option>
                    <option value="India">India</option>
                    <option value="UK">United Kingdom / Europe</option>
                  </select>
                </div>
              )}

              {/* Audience Summary Box */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color="#16a34a" /> Audience Verification Confirmed
                  </div>
                  <div style={{ fontSize: 12, color: '#15803d', marginTop: 3 }}>
                    {targetAudienceContacts.length} recipient(s) selected &bull; 100% active opt-in consent &bull; 0 non-consenting contacts
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="dn-btn dn-btn-secondary dn-btn-sm"
                    onClick={() => setWizardStep(2)}
                  >
                    &larr; Back to Preview
                  </button>
                  <button
                    className="dn-btn dn-btn-primary dn-btn-sm"
                    onClick={() => setWizardStep(4)}
                    disabled={targetAudienceContacts.length === 0}
                  >
                    Proceed to Review & Send <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: REVIEW & SEND ── */}
          {wizardStep === 4 && (
            <div className="dn-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Campaign Pre-Flight Review & Dispatch Confirmation
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Verify campaign parameters before authorizing multi-channel delivery.
                </p>
              </div>

              {/* Review Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, fontSize: 12.5 }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Template</span>
                    <strong style={{ color: '#0f172a' }}>{activeTemplate.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Campaign Category</span>
                    <strong style={{ color: '#0f172a' }}>{activeTemplate.category}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Recipient Count</span>
                    <strong style={{ color: '#16a34a' }}>{targetAudienceContacts.length} verified client(s)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Content Version</span>
                    <strong style={{ color: '#2563eb' }}>v1 (Locked / Identical to Preview)</strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                  <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>Final Subject Line</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{subjectLine}</span>
                </div>
              </div>

              {/* Safety notice */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
                <strong>Zero Content Divergence Guarantee:</strong> The content dispatched to clients will strictly mirror the preview rendered in Step 2. No second AI generation will occur upon clicking dispatch.
              </div>

              <div>
                <h5 style={{ margin: '0 0 8px', color: '#0f172a' }}>Approved email content — v1</h5>
                <ClientEmailPreview
                  subject={interpolateTemplateVars(subjectLine, previewContact)}
                  bodyHtml={previewEmailHtml}
                  recipient={previewContact}
                  campaignName={campaignName}
                  contentVersion="v1"
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <button
                  className="dn-btn dn-btn-secondary"
                  onClick={() => setWizardStep(3)}
                  disabled={isSending}
                >
                  &larr; Change Audience
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  {onUseTemplateInCampaign && (
                    <button
                      className="dn-btn dn-btn-secondary"
                      onClick={() => onUseTemplateInCampaign({
                        templateId: activeTemplate.id,
                        templateName: activeTemplate.name,
                        category: activeTemplate.category,
                        campaignName,
                        subjectLine,
        content: { customization: { headerTitle, headerSubtitle, greetingType, heroHeadline, heroBody, blocks, foundationsTitle, foundations, closingText, promoBanner } },
                        html: compiledEmailHtml,
                        contentVersion: 'v1'
                      })}
                      disabled={isSending}
                    >
                      Use in Standard Campaign Wizard
                    </button>
                  )}
                  <button
                    className="dn-btn dn-btn-primary"
                    onClick={handleDispatchCampaign}
                    disabled={isSending || targetAudienceContacts.length === 0}
                    style={{ background: '#16a34a', border: 'none', padding: '10px 24px', fontSize: 13.5 }}
                  >
                    {isSending ? (
                      <>
                        <RefreshCw size={14} className="spin-icon" /> Authorizing Dispatch...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Confirm & Dispatch Campaign
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dispatch Success Confirmation Dialog ── */}
      {sendSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 12, padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <CheckCircle2 size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                Campaign Successfully Dispatched
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#64748b' }}>
                {activeTemplate?.name} has been processed and queued for delivery.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: 12.5, color: '#334155', marginBottom: 20 }}>
              <div><strong>Recipients:</strong> {sendSuccessModal.count} client(s)</div>
              <div style={{ marginTop: 4 }}><strong>Subject:</strong> {sendSuccessModal.subject}</div>
              <div style={{ marginTop: 4 }}><strong>Content Version:</strong> v1 (Verified match)</div>
            </div>

            <button
              className="dn-btn dn-btn-primary"
              style={{ width: '100%', padding: '10px 0' }}
              onClick={() => {
                setSendSuccessModal(null);
                setActiveTemplate(null);
                setWizardStep(1);
              }}
            >
              Done & Return to Catalog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
