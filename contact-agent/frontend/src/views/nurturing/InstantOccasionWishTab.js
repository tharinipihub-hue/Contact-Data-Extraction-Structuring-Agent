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
  Info
} from 'lucide-react';

export default function InstantOccasionWishTab({
  contacts = [],
  apiBase = '/api',
  showNotification,
  onCampaignDispatched
}) {
  const [occasions, setOccasions] = useState([]);
  const [selectedOccasionName, setSelectedOccasionName] = useState('Diwali');
  const [audienceFilterMode, setAudienceFilterMode] = useState('region_matched'); // 'region_matched' | 'all_opted_in' | 'specific_client'
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedRegionOverride, setSelectedRegionOverride] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWish, setGeneratedWish] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  const optedInContacts = contacts.filter(c => c.opt_in === true);

  // Fetch occasions list from backend calendar
  useEffect(() => {
    loadOccasions();
  }, []);

  const loadOccasions = async () => {
    try {
      const res = await axios.get(`${apiBase}/nurture/occasions`, { timeout: 10000 });
      if (Array.isArray(res.data?.occasions)) {
        setOccasions(res.data.occasions);
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
    const occRegions = selectedOccasionObj.regions || ['global'];
    if (occRegions.includes('global')) {
      return optedInContacts;
    }

    const matched = optedInContacts.filter(c => {
      const loc = [c.country, c.state, c.city, c.location, c.region].filter(Boolean).join(' ').toLowerCase();
      if (!loc) return false; // Unknown region -> don't assume
      return occRegions.some(r => loc.includes(r) || r.includes(loc.split(' ')[0]));
    });

    return matched;
  };

  const resolvedAudience = getResolvedAudience();
  const unknownRegionContacts = optedInContacts.filter(c => {
    const loc = [c.country, c.state, c.city, c.location].filter(Boolean).join(' ').trim();
    return !loc;
  });

  // Generate Wish via Workbench
  const handleGenerateWish = async () => {
    if (!selectedOccasionName) {
      if (showNotification) showNotification('Please select an occasion.', true);
      return;
    }
    if (resolvedAudience.length === 0) {
      if (showNotification) showNotification('No contacts match the selected occasion audience criteria.', true);
      return;
    }

    setIsGenerating(true);
    setGeneratedWish(null);
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
        if (showNotification) {
          showNotification(`Occasion Greeting generated via SNS Workbench for ${selectedOccasionName}!`);
        }
      } else {
        if (showNotification) {
          showNotification(res.data?.error || 'AI generation failed. Please check Workbench connection.', true);
        }
      }
    } catch (err) {
      if (showNotification) {
        showNotification('Generation error: ' + (err.response?.data?.error || err.message), true);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Dispatch Wish via Workbench
  const handleDispatchWish = async () => {
    if (!generatedWish?.content) {
      if (showNotification) showNotification('Please preview the greeting first before dispatching.', true);
      return;
    }

    setIsDispatching(true);
    try {
      const activeSubject = isEditing ? editedSubject : generatedWish.content.subject;
      const activeBody = isEditing ? editedBody : generatedWish.content.email_body;
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
        if (showNotification) {
          showNotification(`Dispatched ${selectedOccasionName} wishes to ${resolvedAudience.length} client recipient(s) via SNS Workbench!`);
        }
        setGeneratedWish(null);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #701a75 0%, #86198f 100%)', border: '1px solid #a21caf' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff' }}>
            <Gift size={20} color="#f5d0fe" />
            Instant Occasion Wishes & Regional Personalization
          </h3>
          <p style={{ color: '#fae8ff' }}>
            Calendar-aware festival and corporate occasion greetings. Automatically filters audiences by verified geographic region (e.g. Diwali for Indian contacts, Thanksgiving for US, New Year for Global) — never assumes nationality blindly.
          </p>
        </div>
      </div>

      {/* ── Selection Panel ── */}
      <div className="dn-panel" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={17} color="#a21caf" /> 1. Select Occasion & Target Audience
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 16 }}>
          {/* Occasion Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Select Occasion
            </label>
            <select
              className="dn-input"
              value={selectedOccasionName}
              onChange={(e) => {
                setSelectedOccasionName(e.target.value);
                setGeneratedWish(null);
              }}
              disabled={isGenerating}
            >
              {occasions.map(occ => (
                <option key={occ.name} value={occ.name}>
                  {occ.name} ({occ.description})
                </option>
              ))}
            </select>
          </div>

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
              <option value="all_opted_in">All Opted-In Clients (Global / International)</option>
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
              Region Filter
            </label>
            <select
              className="dn-input"
              value={selectedRegionOverride}
              onChange={(e) => setSelectedRegionOverride(e.target.value)}
              disabled={isGenerating}
            >
              <option value="auto">Auto-Detect from Contact Profile</option>
              <option value="India">India (Indian Occasions)</option>
              <option value="United States">United States (US Occasions)</option>
              <option value="Global">Global / International</option>
            </select>
          </div>
        </div>

        {/* Occasion Metadata Banner */}
        {selectedOccasionObj && (
          <div style={{ background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#86198f' }}>
                  {selectedOccasionObj.name}
                </span>
                <span style={{ fontSize: 11.5, color: '#701a75', marginLeft: 8 }}>
                  &bull; {selectedOccasionObj.description}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#a21caf', fontWeight: 600 }}>
                Tone Rule: {selectedOccasionObj.tone} &bull; Avoid: {selectedOccasionObj.avoid}
              </div>
            </div>
          </div>
        )}

        {/* Audience Count Summary & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} color="#a21caf" />
            <span>
              Target Audience: <strong>{resolvedAudience.length} client(s)</strong> selected
              {unknownRegionContacts.length > 0 && audienceFilterMode === 'region_matched' && (
                <span style={{ color: '#b45309', marginLeft: 8 }}>
                  ({unknownRegionContacts.length} contacts excluded due to unconfirmed region)
                </span>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="dn-btn dn-btn-primary"
              onClick={handleGenerateWish}
              disabled={isGenerating || resolvedAudience.length === 0}
              style={{ background: '#a21caf', border: 'none' }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={14} className="spin-icon" /> Generating AI Greeting...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Preview Greeting First
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Generated Greeting Preview & Dispatch ── */}
      {generatedWish && (
        <div className="dn-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} color="#a21caf" /> 2. Review Culturally Appropriate Greeting
            </div>
            <button
              className="dn-btn dn-btn-secondary dn-btn-sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Done Editing' : 'Edit Content'}
            </button>
          </div>

          {/* Subject Field */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
              EMAIL SUBJECT
            </label>
            {isEditing ? (
              <input
                type="text"
                className="dn-input"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                {editedSubject || generatedWish.content?.subject}
              </div>
            )}
          </div>

          {/* Body Field */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
              EMAIL BODY (SNS SQUARE TEMPLATE WRAPPER)
            </label>
            {isEditing ? (
              <textarea
                className="dn-input"
                rows={8}
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
              />
            ) : (
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, padding: '14px 16px', background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                {editedBody || generatedWish.content?.email_body}
              </div>
            )}
          </div>

          {/* Dispatch Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              Dispatching to: <strong>{resolvedAudience.length} recipient(s)</strong> via SNS Square Workbench
            </div>

            <button
              className="dn-btn dn-btn-primary"
              onClick={handleDispatchWish}
              disabled={isDispatching}
              style={{ background: '#16a34a', border: 'none', padding: '9px 24px', fontSize: 13 }}
            >
              {isDispatching ? (
                <>
                  <RefreshCw size={14} className="spin-icon" /> Dispatched via Workbench...
                </>
              ) : (
                <>
                  <Send size={14} /> Approve & Dispatch Greeting Now
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
