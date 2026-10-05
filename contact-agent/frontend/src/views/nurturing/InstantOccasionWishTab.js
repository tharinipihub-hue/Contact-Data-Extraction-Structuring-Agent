import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Gift,
  Calendar,
  Sparkles,
  Send,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  MapPin,
  Clock,
  ShieldCheck,
  Check,
  ArrowRight,
  Info,
  Edit3,
  CheckSquare,
  Globe,
  XCircle,
  HelpCircle,
  Sliders,
  ExternalLink
} from 'lucide-react';
import ClientEmailPreview from './ClientEmailPreview';

/**
 * Enterprise 4-Step Instant Occasion Wish Workflow
 * 
 * Step 1: Choose Occasion (cards/selector with dates, regions, tone & rules)
 * Step 2: Choose Audience (Region-matched, All opted-in, Custom) with live counts & exclusion transparency
 * Step 3: Generate & Preview (Gmail/Outlook style email preview via ClientEmailPreview)
 * Step 4: Review & Send with strict confirmation modal
 */
export default function InstantOccasionWishTab({
  contacts = [],
  apiBase = '/api',
  showNotification,
  onCampaignDispatched,
  onOpenWorkflowTab
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [occasions, setOccasions] = useState([]);
  const [selectedOccasionName, setSelectedOccasionName] = useState('Diwali');
  const [audienceFilterMode, setAudienceFilterMode] = useState('region_matched'); // 'region_matched' | 'all_opted_in' | 'specific_client'
  const [selectedContactId, setSelectedContactId] = useState('');
  const [deploymentError, setDeploymentError] = useState(null);
  const [selectedRegionOverride, setSelectedRegionOverride] = useState('auto');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWish, setGeneratedWish] = useState(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccessData, setDispatchSuccessData] = useState(null);

  const optedInContacts = contacts.filter(c => c.opt_in === true);
  const optOutContacts = contacts.filter(c => c.opt_in === false);

  // Fetch occasions list from backend calendar
  useEffect(() => {
    loadOccasions();
  }, []);

  const loadOccasions = async () => {
    try {
      const res = await axios.get(`${apiBase}/nurture/occasions`, { timeout: 10000 });
      if (Array.isArray(res.data?.occasions) && res.data.occasions.length > 0) {
        setOccasions(res.data.occasions);
      } else {
        // Fallback default enterprise occasions
        setOccasions([
          { name: 'Diwali', description: 'Festival of Lights', regions: ['india', 'south asia'], tone: 'Warm, respectful, prosperity-focused', avoid: 'Generic cut-and-paste or religious preaching' },
          { name: 'Pongal / Makar Sankranti', description: 'Harvest Festival', regions: ['india', 'tamil nadu'], tone: 'Respectful, abundance & gratitude', avoid: 'Generic North-centric tropes' },
          { name: 'New Year', description: 'Global Calendar Turn', regions: ['global'], tone: 'Forward-looking, strategic ambition, partnership', avoid: 'Cliches, empty resolutions' },
          { name: 'Thanksgiving', description: 'Harvest & Gratitude', regions: ['united states', 'north america'], tone: 'Appreciation for collaboration, warmth', avoid: 'Presumptive intimacy' },
          { name: 'Christmas', description: 'Holiday Season', regions: ['global', 'europe', 'americas'], tone: 'Joyful, warm, restful year-end reflection', avoid: 'Overly theological messaging' },
          { name: 'Eid al-Fitr', description: 'Celebration of Gratitude', regions: ['middle east', 'southeast asia', 'global'], tone: 'Peace, blessings, togetherness', avoid: 'Informal colloquialisms' },
          { name: 'Client Work Anniversary', description: 'Corporate Milestone', regions: ['global'], tone: 'Professional celebration of mutual growth', avoid: 'Exaggerated compliments' }
        ]);
      }
    } catch (err) {
      console.warn('Could not load occasions:', err.message);
    }
  };

  const selectedOccasionObj = occasions.find(o => o.name === selectedOccasionName) || occasions[0] || null;

  // Resolve matching recipients based on audienceFilterMode & selectedOccasionObj
  const getResolvedAudience = () => {
    if (audienceFilterMode === 'specific_client') {
      const found = optedInContacts.find(c => c.id === selectedContactId) || optedInContacts[0];
      return found ? [found] : [];
    }

    if (audienceFilterMode === 'all_opted_in') {
      return optedInContacts;
    }

    // region_matched: Match contact location against occasion regions
    if (!selectedOccasionObj) return optedInContacts;
    const occRegions = (selectedOccasionObj.regions || ['global']).map(r => r.toLowerCase());
    if (occRegions.includes('global')) {
      return optedInContacts;
    }

    const matched = optedInContacts.filter(c => {
      const loc = [c.country, c.state, c.city, c.location, c.region].filter(Boolean).join(' ').toLowerCase();
      if (!loc) return false;
      return occRegions.some(r => loc.includes(r) || r.includes(loc.split(' ')[0]));
    });

    return matched;
  };

  const resolvedAudience = getResolvedAudience();
  const unknownRegionContacts = optedInContacts.filter(c => {
    const loc = [c.country, c.state, c.city, c.location].filter(Boolean).join(' ').trim();
    return !loc;
  });

  // Step navigation helper
  const handleSelectOccasion = (occName) => {
    setSelectedOccasionName(occName);
    setGeneratedWish(null);
    setDispatchSuccessData(null);
  };

  // Step 3: Generate Wish via Workbench
  const handleGenerateWish = async () => {
    if (!selectedOccasionName) {
      if (showNotification) showNotification('Please select an occasion.', true);
      return;
    }
    if (resolvedAudience.length === 0) {
      if (showNotification) showNotification('No eligible contacts match the selected audience criteria.', true);
      return;
    }

    setIsGenerating(true);
    setGeneratedWish(null);
    setDispatchSuccessData(null);
    setDeploymentError(null);
    try {
      const primaryContact = resolvedAudience[0];
      const res = await axios.post(`${apiBase}/nurture/instant-wish`, {
        occasion: selectedOccasionName,
        contact_id: primaryContact.id,
        contacts: resolvedAudience,
        region_override: selectedRegionOverride !== 'auto' ? selectedRegionOverride : undefined,
        preview_only: true
      }, { timeout: 60000 });

      if (res.data?.success && res.data.content) {
        setGeneratedWish(res.data);
        setEditedSubject(res.data.content.subject || '');
        setEditedBody(res.data.content.email_body || '');
        setIsEditing(false);
        setDeploymentError(null);
        setCurrentStep(3); // Advance to preview step
        if (showNotification) {
          showNotification(`Occasion Greeting generated via SNS Workbench for ${selectedOccasionName}!`);
        }
      } else {
        const errorMsg = res.data?.error || 'AI generation failed. Please check Workbench connection.';
        setDeploymentError({
          error_type: res.data?.error_type || 'generation_failed',
          message: res.data?.message || errorMsg,
          action_label: res.data?.action_label || 'Check Workbench Deployment',
          action_hint: res.data?.action_hint || 'Verify the workflow is active and deployed in SNS Agent Workbench.',
          target_url: res.data?.target_url || null
        });
        if (showNotification) {
          showNotification(errorMsg, true);
        }
      }
    } catch (err) {
      const errData = err.response?.data;
      const errorMsg = errData?.message || errData?.error || err.message;
      setDeploymentError({
        error_type: errData?.error_type || (err.response?.status === 404 || err.response?.status === 502 ? 'workflow_not_deployed' : 'generation_failed'),
        message: errorMsg,
        action_label: errData?.action_label || 'Check Workbench Deployment',
        action_hint: errData?.action_hint || 'Verify the workflow is active and deployed in SNS Agent Workbench.',
        target_url: errData?.target_url || null
      });
      if (showNotification) {
        showNotification('Generation error: ' + errorMsg, true);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 4: Dispatch Wish via Workbench
  const handleConfirmDispatch = async () => {
    if (!generatedWish?.content) {
      if (showNotification) showNotification('Please generate and preview the greeting first before dispatching.', true);
      return;
    }

    setIsDispatching(true);
    try {
      const activeSubject = isEditing ? editedSubject : (generatedWish.content.subject || editedSubject);
      const activeBody = isEditing ? editedBody : (generatedWish.content.email_body || editedBody);
      const primary = resolvedAudience[0];

      const res = await axios.post(`${apiBase}/campaigns/dispatch`, {
        campaign_name: `${selectedOccasionName} Executive Greetings`,
        campaign_type: 'Festival / Occasion Wish',
        topic: `${selectedOccasionName} Festive Greetings`,
        occasion: selectedOccasionName,
        audience: audienceFilterMode === 'region_matched' ? `${selectedOccasionName} Targeted Region Audience` : 'All Past Clients',
        sector: primary?.sector || primary?.industry || 'Technology',
        contact_id: primary?.id,
        contacts: resolvedAudience,
        channels: ['Email'],
        content: {
          subject: activeSubject,
          email_body: activeBody
        }
      }, { timeout: 90000 });

      if (res.data?.success) {
        setShowConfirmModal(false);
        setDispatchSuccessData({
          occasion: selectedOccasionName,
          recipientsCount: resolvedAudience.length,
          dispatchedAt: new Date().toLocaleTimeString(),
          campaignName: `${selectedOccasionName} Executive Greetings`
        });
        setCurrentStep(4);
        if (showNotification) {
          showNotification(`Successfully dispatched ${selectedOccasionName} wishes to ${resolvedAudience.length} client recipient(s) via SNS Workbench!`);
        }
        if (onCampaignDispatched) onCampaignDispatched();
      } else {
        if (showNotification) {
          showNotification(res.data?.error || 'Workbench did not confirm delivery.', true);
        }
      }
    } catch (err) {
      if (showNotification) {
        showNotification('Dispatch error: ' + (err.response?.data?.error || err.message), true);
      }
    } finally {
      setIsDispatching(false);
    }
  };

  const primaryRecipient = resolvedAudience[0] || {
    name: 'Suresh Narayanan',
    first_name: 'Suresh',
    company: 'Tata Consultancy Services',
    email: 'suresh.n@tcs.com',
    country: 'India'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Enterprise Header & Step Indicator ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #701a75 0%, #86198f 100%)', border: '1px solid #a21caf' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gift size={22} color="#f5d0fe" />
            Client Occasion & Festival Greetings System
          </h3>
          <p style={{ color: '#fae8ff', fontSize: 13 }}>
            Culturally grounded, regionally verified executive greetings. Filter by confirmed geographic presence to prevent presuming nationality, and preview in real email client view before dispatch.
          </p>
        </div>
      </div>

      {/* ── 4-Step Progress Indicator ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        backgroundColor: '#ffffff',
        padding: '14px 18px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {[
          { step: 1, label: '1. Select Occasion', icon: Calendar, desc: selectedOccasionName },
          { step: 2, label: '2. Target Audience', icon: Users, desc: `${resolvedAudience.length} Recipient(s)` },
          { step: 3, label: '3. Generate & Preview', icon: Eye, desc: generatedWish ? 'Ready for Review' : 'Pending' },
          { step: 4, label: '4. Review & Dispatch', icon: Send, desc: dispatchSuccessData ? 'Dispatched' : 'Confirmation' }
        ].map((s) => {
          const isActive = currentStep === s.step;
          const isDone = currentStep > s.step || (s.step === 4 && dispatchSuccessData);
          return (
            <div
              key={s.step}
              onClick={() => {
                // Allow jumping backwards anytime, or forwards if wish is generated
                if (s.step <= currentStep || (s.step === 3 && generatedWish)) {
                  setCurrentStep(s.step);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                backgroundColor: isActive ? '#fdf4ff' : isDone ? '#f8fafc' : 'transparent',
                border: isActive ? '1px solid #d946ef' : '1px solid transparent',
                cursor: (s.step <= currentStep || (s.step === 3 && generatedWish)) ? 'pointer' : 'default',
                opacity: (s.step <= currentStep || (s.step === 3 && generatedWish)) ? 1 : 0.6,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: isDone ? '#16a34a' : isActive ? '#a21caf' : '#cbd5e1',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700
              }}>
                {isDone ? <Check size={14} /> : s.step}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#701a75' : '#1e293b', whiteSpace: 'nowrap' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {s.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Select Occasion ── */}
      <div className="dn-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="#a21caf" /> Step 1: Choose Occasion or Festival
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {occasions.length} occasion templates available
          </span>
        </div>

        {/* Occasion Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
          {occasions.map(occ => {
            const isSelected = occ.name === selectedOccasionName;
            return (
              <div
                key={occ.name}
                onClick={() => handleSelectOccasion(occ.name)}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: isSelected ? '2px solid #a21caf' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#fdf4ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 6px -1px rgba(162, 28, 175, 0.1)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? '#86198f' : '#0f172a' }}>
                    {occ.name}
                  </div>
                  {isSelected && (
                    <span style={{ background: '#a21caf', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                      <Check size={11} />
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8 }}>
                  {occ.description}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(occ.regions || ['Global']).map((r, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: isSelected ? '#fae8ff' : '#f1f5f9', color: isSelected ? '#701a75' : '#475569', fontWeight: 600 }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Occasion Protocol Guide */}
        {selectedOccasionObj && (
          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={16} color="#9333ea" />
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#6b21a8' }}>
                  {selectedOccasionObj.name} Cultural Protocol:
                </span>{' '}
                <span style={{ fontSize: 12, color: '#581c87' }}>
                  {selectedOccasionObj.tone}
                </span>
              </div>
            </div>
            {selectedOccasionObj.avoid && (
              <div style={{ fontSize: 11.5, color: '#991b1b', backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: 4, fontWeight: 500 }}>
                Strictly Avoid: {selectedOccasionObj.avoid}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 2: Choose Audience ── */}
      <div className="dn-panel" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color="#a21caf" /> Step 2: Target Audience & Geographic Verification
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
          {/* Audience Filter Mode */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Audience Targeting Rule
            </label>
            <select
              className="dn-input"
              value={audienceFilterMode}
              onChange={(e) => {
                setAudienceFilterMode(e.target.value);
                setGeneratedWish(null);
              }}
              disabled={isGenerating}
            >
              <option value="region_matched">Region-Matched Clients Only (Recommended)</option>
              <option value="all_opted_in">All Opted-In Clients (Global Outreach)</option>
              <option value="specific_client">Specific Client Only</option>
            </select>
          </div>

          {/* Specific Client selector if mode is specific_client */}
          {audienceFilterMode === 'specific_client' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                Target Recipient
              </label>
              <select
                className="dn-input"
                value={selectedContactId}
                onChange={(e) => {
                  setSelectedContactId(e.target.value);
                  setGeneratedWish(null);
                }}
                disabled={isGenerating}
              >
                {optedInContacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company} &bull; {c.country || c.location || 'Location unconfirmed'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Region Override */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Region Verification
            </label>
            <select
              className="dn-input"
              value={selectedRegionOverride}
              onChange={(e) => setSelectedRegionOverride(e.target.value)}
              disabled={isGenerating}
            >
              <option value="auto">Auto-Detect from Contact Profile</option>
              <option value="India">India (Indian Celebrations)</option>
              <option value="United States">United States (US Celebrations)</option>
              <option value="Global">Global / International</option>
            </select>
          </div>
        </div>

        {/* Live Audience Breakdown Card */}
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Eligible Recipients</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: resolvedAudience.length > 0 ? '#16a34a' : '#dc2626' }}>
                {resolvedAudience.length} client{resolvedAudience.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ height: 32, width: 1, backgroundColor: '#cbd5e1' }} />

            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Consent Status</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={14} color="#16a34a" /> 100% Opted-In
              </div>
            </div>

            {unknownRegionContacts.length > 0 && audienceFilterMode === 'region_matched' && (
              <>
                <div style={{ height: 32, width: 1, backgroundColor: '#cbd5e1' }} />
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Excluded For Safety</span>
                  <div style={{ fontSize: 12, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={13} /> {unknownRegionContacts.length} contacts with unconfirmed location
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            className="dn-btn dn-btn-primary"
            onClick={handleGenerateWish}
            disabled={isGenerating || resolvedAudience.length === 0}
            style={{ background: '#a21caf', border: 'none', padding: '9px 20px', fontSize: 13 }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="spin-icon" /> Generating AI Greeting...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Generate & Preview Greeting <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

        {/* SNS Workbench Deployment / Status Alert Banner */}
        {deploymentError && (
          <div style={{
            marginTop: 16,
            padding: '14px 18px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontWeight: 700, fontSize: 13.5 }}>
                <AlertTriangle size={18} color="#d97706" />
                <span>
                  {deploymentError.error_type === 'workflow_not_deployed'
                    ? 'SNS Workbench Workflow Inactive or Not Deployed (HTTP 404)'
                    : 'SNS Workbench Generation Failed'}
                </span>
              </div>
              {onOpenWorkflowTab && (
                <button
                  type="button"
                  onClick={onOpenWorkflowTab}
                  className="dn-btn dn-btn-secondary dn-btn-sm"
                  style={{ borderColor: '#d97706', color: '#92400e', fontWeight: 600, backgroundColor: '#fef3c7' }}
                >
                  <Sliders size={13} /> {deploymentError.action_label || 'Check Workbench Deployment'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}>
              {deploymentError.message}
            </div>
            {deploymentError.action_hint && (
              <div style={{ fontSize: 11.5, color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: 4 }}>
                💡 <strong>Required Action:</strong> {deploymentError.action_hint}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 3: Preview & Edit Greeting ── */}
      {generatedWish && (
        <div className="dn-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={18} color="#a21caf" /> Step 3: Verified Client Email Preview (Gmail / Outlook Standard)
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="dn-btn dn-btn-secondary dn-btn-sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 size={13} /> {isEditing ? 'Done Editing' : 'Customize Email Content'}
              </button>
              
              <button
                type="button"
                className="dn-btn dn-btn-secondary dn-btn-sm"
                onClick={handleGenerateWish}
                disabled={isGenerating}
                title="Regenerate greeting copy"
              >
                <RefreshCw size={13} /> Regenerate
              </button>
            </div>
          </div>

          {/* Edit Form if editing mode is toggled */}
          {isEditing && (
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Subject Line
                </label>
                <input
                  type="text"
                  className="dn-input"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="Greeting email subject..."
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Email Body (HTML / Formatted Text)
                </label>
                <textarea
                  className="dn-input"
                  rows={8}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  placeholder="Email body content..."
                  style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}
                />
              </div>
            </div>
          )}

          {/* Client-Facing Email Preview (DOMPurify Sanitized, Zero Raw HTML tags displayed) */}
          <div style={{ marginBottom: 20 }}>
            <ClientEmailPreview
              subject={isEditing ? editedSubject : (generatedWish.content?.subject || editedSubject)}
              bodyHtml={isEditing ? editedBody : (generatedWish.content?.email_body || editedBody)}
              recipient={primaryRecipient}
              senderName="SNS Square Enterprise Client Partnerships"
              senderEmail="nurture@snssquare.com"
              contentVersion="v1"
              allowRawView={true}
            />
          </div>

          {/* Step 4 Action Bar */}
          <div style={{
            backgroundColor: '#fdf4ff',
            border: '1px solid #f0abfc',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#701a75' }}>
                Ready to review and dispatch {selectedOccasionName} wishes?
              </div>
              <div style={{ fontSize: 12, color: '#86198f' }}>
                Target: <strong>{resolvedAudience.length} verified recipient{resolvedAudience.length !== 1 ? 's' : ''}</strong> &bull; Zero prompt instruction leakage &bull; Branded SNS Square enterprise template
              </div>
            </div>

            <button
              className="dn-btn dn-btn-primary"
              onClick={() => setShowConfirmModal(true)}
              style={{ background: '#16a34a', border: 'none', padding: '10px 24px', fontSize: 13.5, fontWeight: 600 }}
            >
              <Send size={15} /> Review & Dispatch Wishes <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 Confirmation Modal ── */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            maxWidth: 540,
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ backgroundColor: '#701a75', color: '#ffffff', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Gift size={20} color="#f5d0fe" />
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                Confirm Campaign Dispatch: {selectedOccasionName}
              </div>
            </div>

            <div style={{ padding: '24px 24px' }}>
              <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                You are about to dispatch this personalized occasion greeting through the <strong>SNS Square Agent Workbench</strong> to verified corporate clients.
              </p>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12.5, color: '#475569' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px' }}>
                  <span style={{ fontWeight: 600, color: '#64748b' }}>Occasion:</span>
                  <strong style={{ color: '#0f172a' }}>{selectedOccasionName}</strong>

                  <span style={{ fontWeight: 600, color: '#64748b' }}>Recipients:</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{resolvedAudience.length} Opted-In Contact(s)</span>

                  <span style={{ fontWeight: 600, color: '#64748b' }}>Subject:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{isEditing ? editedSubject : (generatedWish?.content?.subject || editedSubject)}</span>

                  <span style={{ fontWeight: 600, color: '#64748b' }}>Dispatch Channel:</span>
                  <span>Corporate Email (SMTP + Workbench Telemetry)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#b45309', backgroundColor: '#fef3c7', padding: '10px 12px', borderRadius: 6 }}>
                <AlertTriangle size={15} />
                <span>Once dispatched, live delivery begins immediately. All client touchpoints are recorded to Google Sheets Master.</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f1f5f9', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="dn-btn dn-btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={isDispatching}
              >
                Cancel
              </button>

              <button
                type="button"
                className="dn-btn dn-btn-primary"
                onClick={handleConfirmDispatch}
                disabled={isDispatching}
                style={{ backgroundColor: '#16a34a', border: 'none', padding: '8px 20px' }}
              >
                {isDispatching ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" /> Dispatched via Workbench...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Confirm & Dispatch Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Banner after Dispatch ── */}
      {dispatchSuccessData && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 8,
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#14532d' }}>
                Campaign Successfully Dispatched!
              </div>
              <div style={{ fontSize: 12.5, color: '#166534', marginTop: 2 }}>
                {dispatchSuccessData.occasion} greeting sent to {dispatchSuccessData.recipientsCount} recipient(s) at {dispatchSuccessData.dispatchedAt}.
              </div>
            </div>
          </div>

          <button
            className="dn-btn dn-btn-secondary"
            onClick={() => {
              setDispatchSuccessData(null);
              setGeneratedWish(null);
              setCurrentStep(1);
            }}
          >
            Send Another Greeting
          </button>
        </div>
      )}
    </div>
  );
}
