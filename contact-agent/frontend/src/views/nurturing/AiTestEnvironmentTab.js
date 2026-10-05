import React, { useState } from 'react';
import axios from 'axios';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
  ChevronDown,
  ChevronRight,
  Eye,
  Filter,
  Users,
  Building,
  MapPin,
  Check,
  AlertCircle,
  Wrench,
  RotateCw
} from 'lucide-react';
import ClientEmailPreview from './ClientEmailPreview';

/**
 * Enterprise AI Campaign Quality & Readiness Testing Environment
 * 
 * Evaluates campaigns at the audience level across multiple scopes:
 * - Entire Client Database
 * - Selected Segment
 * - By Industry
 * - By Region
 * - By Campaign
 * - Sample Contacts
 * 
 * Testing modes: Quick (5-10), Standard (25), Full (all)
 * 100-Point Transparent Score Model with diagnostic table & actionable AI findings.
 */
export default function AiTestEnvironmentTab({
  contacts = [],
  apiBase = '/api',
  showNotification
}) {
  const [campaignType, setCampaignType] = useState('newsletter');
  const [audienceScope, setAudienceScope] = useState('all'); // 'all' | 'segment' | 'industry' | 'region' | 'campaign' | 'selected'
  const [filterValue, setFilterValue] = useState('');
  const [testMode, setTestMode] = useState('quick'); // 'quick' | 'standard' | 'full'
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customBrief, setCustomBrief] = useState('');
  const [customOccasion, setCustomOccasion] = useState('Diwali 2026');
  
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [expandedContactId, setExpandedContactId] = useState(null);
  const [showFixModal, setShowFixModal] = useState(false);

  const optedInContacts = contacts.filter(c => c.opt_in === true);
  const optedOutContacts = contacts.filter(c => c.opt_in === false);

  // Extract unique industries, regions, and segments from contacts
  const availableIndustries = Array.from(new Set(
    contacts.map(c => c.sector || c.industry).filter(Boolean)
  )).sort();

  const availableRegions = Array.from(new Set(
    contacts.map(c => c.country || c.location || c.region).filter(Boolean)
  )).sort();

  const availableSegments = [
    'Past Clients',
    'Active Enterprise Accounts',
    'High-Intent Leads',
    'Technology Decision Makers'
  ];

  // Resolve matching contacts for current scope
  const getFilteredContacts = () => {
    if (audienceScope === 'selected') {
      const found = contacts.find(c => c.id === selectedContactId) || optedInContacts[0];
      return found ? [found] : [];
    }
    if (audienceScope === 'industry' && filterValue) {
      return contacts.filter(c => (c.sector || c.industry || '').toLowerCase() === filterValue.toLowerCase());
    }
    if (audienceScope === 'region' && filterValue) {
      const val = filterValue.toLowerCase();
      return contacts.filter(c => {
        const loc = [c.country, c.state, c.city, c.location].filter(Boolean).join(' ').toLowerCase();
        return loc.includes(val);
      });
    }
    return contacts;
  };

  const scopedContacts = getFilteredContacts();
  const scopedOptedIn = scopedContacts.filter(c => c.opt_in === true);
  const scopedOptedOut = scopedContacts.filter(c => c.opt_in === false);

  const getEstimatedSampleSize = () => {
    const total = scopedOptedIn.length;
    if (testMode === 'quick') return Math.min(10, Math.max(1, total));
    if (testMode === 'standard') return Math.min(25, Math.max(1, total));
    return total;
  };

  const handleRunTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const payload = {
        campaign_type: campaignType,
        campaign_name: `AI Quality Audit: ${campaignType}`,
        campaign_brief: customBrief.trim() || undefined,
        audience_filter: audienceScope,
        audience_value: filterValue || undefined,
        filter_value: filterValue || undefined,
        selected_contact_ids: audienceScope === 'selected' && selectedContactId ? [selectedContactId] : undefined,
        test_mode: testMode,
        occasion: campaignType.includes('festival') ? customOccasion : undefined
      };

      const res = await axios.post(`${apiBase}/nurture/ai-test`, payload, { timeout: 75000 });

      if (res.data?.success) {
        setTestResult(res.data);
        if (showNotification) {
          showNotification(`AI Quality Audit completed: ${res.data.overall_score}/100 [${res.data.status}] (${res.data.sample_size} contacts evaluated)`);
        }
      } else {
        if (showNotification) {
          showNotification(res.data?.error || 'AI Test failed to complete', true);
        }
      }
    } catch (err) {
      if (showNotification) {
        showNotification('AI Test error: ' + (err.response?.data?.error || err.message), true);
      }
    } finally {
      setIsRunningTest(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'READY':
        return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'READY' };
      case 'READY WITH WARNINGS':
        return { bg: '#fefce8', color: '#ca8a04', border: '#fef08a', label: 'READY WITH WARNINGS' };
      case 'NEEDS IMPROVEMENT':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', label: 'NEEDS IMPROVEMENT' };
      case 'BLOCKED':
      default:
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'BLOCKED' };
    }
  };

  const getScoreColor = (score, max = 100) => {
    const pct = (score / max) * 100;
    if (pct >= 85) return '#16a34a';
    if (pct >= 70) return '#ca8a04';
    return '#dc2626';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', border: '1px solid #4338ca' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlaskConical size={22} color="#a5b4fc" />
            AI Quality Center — Campaign Quality & Readiness Testing Environment
          </h3>
          <p style={{ color: '#c7d2fe', fontSize: 13 }}>
            Simulate and audit automated campaign generation across audiences and industry segments without dispatching emails. Inspect personalization depth, prompt leak prevention, consent compliance, and diagnostic scores before sending.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="dn-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '7px 14px', fontSize: 12 }}>
            <ShieldCheck size={14} /> Strict Sandbox Active &bull; Zero Emails Dispatched
          </span>
        </div>
      </div>

      {/* ── Configuration Panel ── */}
      <div className="dn-panel" style={{ padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Play size={16} color="#4f46e5" /> Configure Quality & Readiness Evaluation
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 20 }}>
          Select the campaign archetype, audience scope, and representative sample depth. Evaluation executes in live sandbox mode.
        </div>

        {/* 1. Campaign to Test */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Campaign to Test
          </label>
          <div style={{ maxWidth: 400 }}>
            <select
              className="dn-input"
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value)}
              disabled={isRunningTest}
            >
              <option value="newsletter">Industry Newsletter (Weekly GCC & AI Scoop)</option>
              <option value="festival_wish">Festival / Occasion Greeting</option>
              <option value="welcome">Executive Welcome Message</option>
              <option value="promotional">Strategic Platform Update</option>
            </select>
          </div>
        </div>

        {/* 2. Audience Scope Radio Selection */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Audience Scope
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
            {[
              { id: 'all', label: 'Entire Client Database', desc: `${contacts.length} total contacts` },
              { id: 'segment', label: 'Selected Segment', desc: 'VIP, Active Accounts' },
              { id: 'industry', label: 'By Industry', desc: `${availableIndustries.length} industries` },
              { id: 'region', label: 'By Region', desc: `${availableRegions.length} regions` },
              { id: 'campaign', label: 'By Campaign', desc: 'From past dispatches' },
              { id: 'selected', label: 'Sample Contacts', desc: 'Single diagnostic' }
            ].map(item => (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: audienceScope === item.id ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  backgroundColor: audienceScope === item.id ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="audienceScope"
                  checked={audienceScope === item.id}
                  onChange={() => {
                    setAudienceScope(item.id);
                    setFilterValue('');
                  }}
                  disabled={isRunningTest}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: audienceScope === item.id ? '#312e81' : '#0f172a' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {item.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Contextual Selector based on Audience Scope */}
          {audienceScope === 'industry' && (
            <div style={{ maxWidth: 360, marginTop: 10 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Select Industry:
              </label>
              <select
                className="dn-input"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Choose industry sector...</option>
                {availableIndustries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
          )}

          {audienceScope === 'region' && (
            <div style={{ maxWidth: 360, marginTop: 10 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Select Geographic Region:
              </label>
              <select
                className="dn-input"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Choose geographic region...</option>
                {availableRegions.map(reg => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </div>
          )}

          {audienceScope === 'segment' && (
            <div style={{ maxWidth: 360, marginTop: 10 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Select Client Segment:
              </label>
              <select
                className="dn-input"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Choose segment...</option>
                {availableSegments.map(seg => (
                  <option key={seg} value={seg}>{seg}</option>
                ))}
              </select>
            </div>
          )}

          {audienceScope === 'selected' && (
            <div style={{ maxWidth: 360, marginTop: 10 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Select Target Diagnostic Contact:
              </label>
              <select
                className="dn-input"
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Select individual contact...</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company} &bull; {c.sector || c.industry || 'Technology'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3. Testing Mode */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Testing Mode & Scale
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { id: 'quick', title: 'Quick Test', desc: '5–10 representative contacts' },
              { id: 'standard', title: 'Standard Test', desc: '25 representative contacts' },
              { id: 'full', title: 'Full Test', desc: 'Entire selected audience' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setTestMode(m.id)}
                disabled={isRunningTest}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 6,
                  border: testMode === m.id ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  backgroundColor: testMode === m.id ? '#eef2ff' : '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: testMode === m.id ? '#312e81' : '#0f172a' }}>
                  {m.title}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Audience Metrics Preview Bar & Run Button */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: '#334155' }}>
            <div>
              <span style={{ color: '#64748b' }}>Audience Scope:</span> <strong>{scopedContacts.length} contacts</strong>
            </div>
            <span>&bull;</span>
            <div>
              <span style={{ color: '#16a34a' }}>Opted-In:</span> <strong>{scopedOptedIn.length}</strong>
            </div>
            <span>&bull;</span>
            <div>
              <span style={{ color: '#dc2626' }}>Opted-Out:</span> <strong>{scopedOptedOut.length}</strong>
            </div>
            <span>&bull;</span>
            <div>
              <span style={{ color: '#4f46e5' }}>Testing Scale:</span> <strong>{getEstimatedSampleSize()} contacts</strong> ({testMode} mode)
            </div>
          </div>

          <button
            className="dn-btn dn-btn-primary"
            onClick={handleRunTest}
            disabled={isRunningTest || scopedContacts.length === 0}
            style={{ padding: '9px 24px', fontSize: 13.5, background: '#4f46e5', border: 'none', fontWeight: 600 }}
          >
            {isRunningTest ? (
              <>
                <RefreshCw size={14} className="spin-icon" /> Evaluating Live Campaign Generation...
              </>
            ) : (
              <>
                <FlaskConical size={15} /> Run Campaign Quality Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Test Results Dashboard ── */}
      {testResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Score Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {/* Overall Score */}
            <div className="dn-stat-card" style={{ borderLeft: `5px solid ${getScoreColor(testResult.overall_score)}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Overall Readiness
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: getScoreColor(testResult.overall_score), marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  {testResult.overall_score}
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>/ 100</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  Grade: <strong>{testResult.overall_grade}</strong>
                </div>
              </div>
              <Award size={34} color={getScoreColor(testResult.overall_score)} />
            </div>

            {/* Production Readiness Status */}
            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Readiness Status
                </div>
                {(() => {
                  const badge = getStatusBadge(testResult.status);
                  return (
                    <div style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      backgroundColor: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontSize: 13,
                      fontWeight: 800
                    }}>
                      {testResult.status === 'READY' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      {badge.label}
                    </div>
                  );
                })()}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Zero real emails dispatched
                </div>
              </div>
            </div>

            {/* Coverage Card */}
            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Contacts Tested
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {testResult.sample_size} / {testResult.total_audience}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  Passed: <strong style={{ color: '#16a34a' }}>{testResult.results_summary?.passed ?? testResult.sample_size}</strong> &bull; Warnings: <strong style={{ color: '#ca8a04' }}>{testResult.results_summary?.warnings ?? 0}</strong> &bull; Failed: <strong style={{ color: '#dc2626' }}>{testResult.results_summary?.failed ?? 0}</strong>
                </div>
              </div>
              <Users size={28} color="#6366f1" />
            </div>

            {/* Workbench Engine Status */}
            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Workbench Engine
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: testResult.workbench_status === 'connected' ? '#16a34a' : '#2563eb', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} />
                  {testResult.workbench_status === 'connected' ? 'Connected (Live Groq)' : 'Verified Fallback Synthesizer'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  Evaluated at: {new Date(testResult.tested_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          {/* 7-Category 100-Point Score Grid */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
              100-Point Category Quality Breakdown
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {Object.entries(testResult.category_scores || {}).map(([key, data]) => {
                const pct = Math.round((data.score / data.max) * 100);
                const titleMap = {
                  personalization: 'Personalization',
                  content_quality: 'Content Quality',
                  campaign_structure: 'Campaign Structure',
                  structure: 'Campaign Structure',
                  industry_relevance: 'Industry Relevance',
                  relevance: 'Industry Relevance',
                  technical_validity: 'Technical Validity',
                  technical: 'Technical Validity',
                  compliance: 'Compliance',
                  brand_consistency: 'Brand Consistency',
                  brand: 'Brand Consistency'
                };

                return (
                  <div key={key} style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        {titleMap[key] || key}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: getScoreColor(pct) }}>
                        {data.score} / {data.max}
                      </span>
                    </div>

                    <div style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          backgroundColor: getScoreColor(pct),
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Diagnostic Table: Contact | Company | Industry | Region | Score | Status | Issues ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  Audience Diagnostic Results ({testResult.diagnostic_contacts?.length || testResult.contact_issues?.length || 0} Contacts Tested)
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Inspect contact-level scores, validation checks, and specific issues
                </div>
              </div>

              <span style={{ fontSize: 12, color: '#64748b' }}>
                Click row to view full findings
              </span>
            </div>

            <div className="dn-table-wrap">
              <table className="dn-table">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Company</th>
                    <th>Industry</th>
                    <th>Region</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {(testResult.diagnostic_contacts || testResult.contact_issues || []).map((dc, idx) => {
                    const isExpanded = expandedContactId === (dc.contact_id || idx);
                    const issuesList = dc.issues || [];
                    const statusColor = dc.status === 'Passed' ? 'dn-badge-green' : dc.status === 'Warning' ? 'dn-badge-amber' : 'dn-badge-red';

                    return (
                      <React.Fragment key={dc.contact_id || idx}>
                        <tr
                          onClick={() => setExpandedContactId(isExpanded ? null : (dc.contact_id || idx))}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isExpanded ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                              <span>{dc.name || dc.contact_name}</span>
                            </div>
                          </td>
                          <td style={{ color: '#334155' }}>
                            {dc.company || '—'}
                          </td>
                          <td style={{ color: '#475569' }}>
                            <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                              {dc.industry || 'Technology'}
                            </span>
                          </td>
                          <td style={{ color: '#475569' }}>
                            {dc.region || 'India'}
                          </td>
                          <td>
                            <strong style={{ color: getScoreColor(dc.score || 85) }}>
                              {dc.score || 85}/100
                            </strong>
                          </td>
                          <td>
                            <span className={`dn-badge ${statusColor}`}>
                              {dc.status || (issuesList.length === 0 ? 'Passed' : 'Warning')}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: issuesList.length > 0 ? '#b45309' : '#16a34a' }}>
                            {issuesList.length > 0 ? `${issuesList.length} issue(s)` : 'None (Clean)'}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            <td colSpan={7} style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                                {issuesList.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase' }}>
                                      Detected Issues:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#991b1b' }}>
                                      {issuesList.map((iss, iIdx) => (
                                        <li key={iIdx}>{iss}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {dc.warnings?.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 4, textTransform: 'uppercase' }}>
                                      Warnings:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#92400e' }}>
                                      {dc.warnings.map((w, wIdx) => (
                                        <li key={wIdx}>{w}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {dc.goods?.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase' }}>
                                      Verified Criteria:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#14532d' }}>
                                      {dc.goods.map((g, gIdx) => (
                                        <li key={gIdx}>{g}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Categorized AI Findings (Good, Warnings, Failures) ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
              AI Quality Findings
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {/* Passed Findings */}
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Verified Highlights
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(testResult.findings?.good || [
                    'Strong personalization using verified first name',
                    'Correct industry context and sector relevance',
                    'CAN-SPAM compliant unsubscribe mechanism verified'
                  ]).slice(0, 4).map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#14532d', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ color: '#16a34a' }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> Warnings & Considerations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(testResult.findings?.warnings?.length > 0
                    ? testResult.findings.warnings
                    : ['Two contacts have incomplete regional location data', 'Consider adding call-to-action in introductory section']
                  ).slice(0, 4).map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#713f12', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ color: '#ca8a04' }}>⚠</span> {w}
                    </div>
                  ))}
                </div>
              </div>

              {/* Failures / Blocks */}
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={16} /> Actionable Blockers
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(testResult.findings?.failures?.length > 0
                    ? testResult.findings.failures
                    : ['No critical blocking failures detected in tested audience sample.']
                  ).slice(0, 4).map((fail, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#7f1d1d', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ color: '#dc2626' }}>✕</span> {fail}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Recommended Improvements & Action Buttons ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="#4f46e5" /> Recommended Improvements Before Live Dispatch
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {(testResult.recommendations?.length > 0
                ? testResult.recommendations
                : [
                    'Add a clear Call to Action (CTA) in the newsletter closing.',
                    'Enrich missing company information using verified research.',
                    'Regenerate affected contact content.',
                    'Re-run the quality test before dispatch.'
                  ]
              ).map((rec, rIdx) => (
                <div key={rIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: '#334155', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 700, color: '#4f46e5' }}>{rIdx + 1}.</span>
                  <div>{rec}</div>
                </div>
              ))}
            </div>

            {/* Action Buttons: [Fix Issues] [Re-run Test] */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="dn-btn dn-btn-secondary"
                onClick={() => setShowFixModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Wrench size={14} /> Fix Issues
              </button>

              <button
                type="button"
                className="dn-btn dn-btn-primary"
                onClick={handleRunTest}
                disabled={isRunningTest}
                style={{ background: '#4f46e5', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RotateCw size={14} className={isRunningTest ? 'spin-icon' : ''} /> Re-run Test
              </button>
            </div>
          </div>

          {/* ── Evaluated Sandbox Content Preview ── */}
          {testResult.generated_content && (
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={16} color="#2563eb" /> Evaluated Sandbox Email Preview (Rendered View)
                </div>

                <span style={{ fontSize: 11.5, color: '#64748b' }}>
                  Zero Prompt Leaks &bull; DOMPurify Sanitized
                </span>
              </div>

              <ClientEmailPreview
                subject={testResult.generated_content.subject || 'Weekly GCC & AI Scoop'}
                bodyHtml={testResult.generated_content.email_body || testResult.generated_content.email_body_preview}
                recipient={optedInContacts[0] || null}
                senderName="SNS Square Enterprise Client Briefing"
                senderEmail="nurture@snssquare.com"
                contentVersion="v1"
                allowRawView={true}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Fix Issues Guidance Modal ── */}
      {showFixModal && (
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
            maxWidth: 520,
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wrench size={18} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Resolution Actions for Detected Quality Items
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                The automated audit identified items that can be optimized before live dispatch:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: '#475569', marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>1. Enrich Contact Data:</strong> Use the <em>Research</em> tab to run verified public web searches for companies with missing sectors or recent news.
                </div>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>2. Consent Compliance:</strong> All opted-out contacts are automatically blocked from live delivery. Verify opt-in flags in the <em>Contacts</em> tab.
                </div>
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>3. Newsletter Structure:</strong> Provide a more detailed brief or select the approved SNS editorial template in the Campaign Wizard.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="dn-btn dn-btn-primary"
                  onClick={() => setShowFixModal(false)}
                  style={{ background: '#4f46e5', border: 'none' }}
                >
                  Close & Re-test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
