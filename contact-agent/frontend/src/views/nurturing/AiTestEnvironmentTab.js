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
  AlertCircle
} from 'lucide-react';
import ClientEmailPreview from './ClientEmailPreview';

export default function AiTestEnvironmentTab({
  contacts = [],
  apiBase = '/api',
  showNotification
}) {
  const [campaignType, setCampaignType] = useState('newsletter');
  const [audienceFilter, setAudienceFilter] = useState('all'); // 'all' | 'industry' | 'region' | 'segment' | 'selected'
  const [filterValue, setFilterValue] = useState('');
  const [testMode, setTestMode] = useState('quick'); // 'quick' | 'standard' | 'full'
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customBrief, setCustomBrief] = useState('');
  const [customOccasion, setCustomOccasion] = useState('Diwali 2026');
  
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [expandedContactIssue, setExpandedContactIssue] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const optedInContacts = contacts.filter(c => c.opt_in === true);

  // Extract unique industries and regions from contacts
  const availableIndustries = Array.from(new Set(
    contacts.map(c => c.sector || c.industry).filter(Boolean)
  )).sort();

  const availableRegions = Array.from(new Set(
    contacts.map(c => c.country || c.location || c.region).filter(Boolean)
  )).sort();

  // Calculate estimated test audience count
  const getAudienceCount = () => {
    if (audienceFilter === 'selected') return selectedContactId ? 1 : Math.min(1, optedInContacts.length);
    if (audienceFilter === 'industry' && filterValue) {
      return optedInContacts.filter(c => (c.sector || c.industry) === filterValue).length;
    }
    if (audienceFilter === 'region' && filterValue) {
      return optedInContacts.filter(c => (c.country || c.location || c.region) === filterValue).length;
    }
    return optedInContacts.length;
  };

  const getEstimatedSampleSize = () => {
    const total = getAudienceCount();
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
        audience_filter: audienceFilter,
        filter_value: filterValue || undefined,
        selected_contact_ids: audienceFilter === 'selected' && selectedContactId ? [selectedContactId] : undefined,
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
        return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'READY FOR PRODUCTION' };
      case 'READY WITH WARNINGS':
        return { bg: '#fefce8', color: '#ca8a04', border: '#fef08a', label: 'READY WITH WARNINGS' };
      case 'NEEDS IMPROVEMENT':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', label: 'NEEDS IMPROVEMENT' };
      case 'BLOCKED':
      default:
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'BLOCKED — DO NOT SEND' };
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
            AI Test Environment — Audience-Level Quality & Compliance Assurance
          </h3>
          <p style={{ color: '#c7d2fe', fontSize: 13 }}>
            Run pre-dispatch test simulations against real client segments without sending emails. Evaluates personalization depth, verified sector trends, CAN-SPAM opt-out compliance, and detects prompt instruction leaks before release.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="dn-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '7px 14px', fontSize: 12 }}>
            <ShieldCheck size={14} /> Strict Sandbox Active &bull; 0 Real Emails Dispatched
          </span>
        </div>
      </div>

      {/* ── Configuration Panel ── */}
      <div className="dn-panel" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Play size={16} color="#4f46e5" /> Configure Quality Audit Run
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Choose your target audience segment, test scale mode, and campaign archetype. The engine executes live Workbench AI synthesis and scores the result against enterprise criteria.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          {/* Campaign Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Campaign Archetype
            </label>
            <select
              className="dn-input"
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value)}
              disabled={isRunningTest}
            >
              <option value="newsletter">Weekly GCC & AI Scoop Newsletter</option>
              <option value="festival_wish">Festival / Occasion Greeting</option>
              <option value="welcome">Executive Welcome Message</option>
              <option value="promotional">Strategic Platform Update</option>
            </select>
          </div>

          {/* Audience Filter */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Audience Scope
            </label>
            <select
              className="dn-input"
              value={audienceFilter}
              onChange={(e) => {
                setAudienceFilter(e.target.value);
                setFilterValue('');
              }}
              disabled={isRunningTest}
            >
              <option value="all">Entire Opted-In Audience ({optedInContacts.length})</option>
              <option value="industry">By Industry / Sector</option>
              <option value="region">By Geographic Region</option>
              <option value="selected">Single Selected Contact</option>
            </select>
          </div>

          {/* Industry or Region specific dropdown */}
          {audienceFilter === 'industry' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                Select Industry
              </label>
              <select
                className="dn-input"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Choose industry...</option>
                {availableIndustries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
          )}

          {audienceFilter === 'region' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                Select Region / Country
              </label>
              <select
                className="dn-input"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Choose region...</option>
                {availableRegions.map(reg => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </div>
          )}

          {audienceFilter === 'selected' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                Select Contact
              </label>
              <select
                className="dn-input"
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                disabled={isRunningTest}
              >
                <option value="">Select contact...</option>
                {optedInContacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company} &bull; {c.sector || c.industry})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Test Scale Mode */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Test Mode & Scale
            </label>
            <select
              className="dn-input"
              value={testMode}
              onChange={(e) => setTestMode(e.target.value)}
              disabled={isRunningTest}
            >
              <option value="quick">Quick Test (5–10 sample contacts)</option>
              <option value="standard">Standard Test (25 sample contacts)</option>
              <option value="full">Full Audience Test (All contacts)</option>
            </select>
          </div>

          {/* Occasion field if festival */}
          {campaignType.includes('festival') && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                Occasion Name
              </label>
              <input
                type="text"
                className="dn-input"
                value={customOccasion}
                onChange={(e) => setCustomOccasion(e.target.value)}
                placeholder="e.g., Diwali 2026, Thanksgiving"
                disabled={isRunningTest}
              />
            </div>
          )}
        </div>

        {/* Action & Run Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>
              Target Audience: <strong>{getAudienceCount()} contact(s)</strong>
            </span>
            <span>&bull;</span>
            <span>
              Sample Size to Test: <strong>{getEstimatedSampleSize()} contact(s)</strong> ({testMode} mode)
            </span>
          </div>

          <button
            className="dn-btn dn-btn-primary"
            onClick={handleRunTest}
            disabled={isRunningTest}
            style={{ padding: '9px 24px', fontSize: 13, background: '#4f46e5', border: 'none' }}
          >
            {isRunningTest ? (
              <>
                <RefreshCw size={14} className="spin-icon" /> Evaluating Live Campaign Generation...
              </>
            ) : (
              <>
                <FlaskConical size={14} /> Run Audience AI Quality Audit
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
                  AI Quality Score
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: getScoreColor(testResult.overall_score), marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  {testResult.overall_score}
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>/100</span>
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
                  Production Readiness
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
                      fontSize: 12.5,
                      fontWeight: 700
                    }}>
                      {testResult.status === 'READY' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      {badge.label}
                    </div>
                  );
                })()}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Safety Guarantee: Zero real emails dispatched
                </div>
              </div>
            </div>

            {/* Coverage Card */}
            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Audit Sample Coverage
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {testResult.sample_size} / {testResult.total_audience} contacts
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  Mode: <strong style={{ textTransform: 'capitalize' }}>{testResult.test_mode}</strong> test
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
                <div style={{ fontSize: 15, fontWeight: 700, color: testResult.workbench_status === 'connected' ? '#16a34a' : '#2563eb', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
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
              100-Point Quality Category Scorecard
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {Object.entries(testResult.category_scores || {}).map(([key, data]) => {
                const pct = Math.round((data.score / data.max) * 100);
                const titleMap = {
                  personalization: '1. Personalization Depth',
                  content_quality: '2. Content Quality & Integrity',
                  structure: '3. Newsletter / Copy Structure',
                  relevance: '4. Relevance & Grounding',
                  technical: '5. Technical Validity & Links',
                  compliance: '6. CAN-SPAM / Consent Compliance',
                  brand: '7. SNS Square Brand Alignment'
                };

                return (
                  <div key={key} style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        {titleMap[key] || key}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: getScoreColor(pct) }}>
                        {data.score} / {data.max} pts
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

          {/* Contact-Level Issues & Recommendations */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>
                Contact-Level Evaluation Findings ({testResult.contact_issues?.length || 0} Contacts Sampled)
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Click a contact row to inspect individual diagnostic details
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(testResult.contact_issues || []).map((ci, idx) => {
                const isExpanded = expandedContactIssue === idx;
                const hasIssues = ci.issues?.length > 0;

                return (
                  <div
                    key={ci.contact_id || idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      backgroundColor: hasIssues ? '#fffbeb' : '#f8fafc',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedContactIssue(isExpanded ? null : idx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {hasIssues ? (
                          <AlertTriangle size={16} color="#d97706" />
                        ) : (
                          <CheckCircle2 size={16} color="#16a34a" />
                        )}
                        <div>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{ci.name}</strong>{' '}
                          <span style={{ fontSize: 12, color: '#64748b' }}>({ci.company} &bull; {ci.email})</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor: hasIssues ? '#fef3c7' : '#dcfce7',
                          color: hasIssues ? '#b45309' : '#15803d'
                        }}>
                          {ci.score}/100 pts
                        </span>

                        <span style={{ fontSize: 11.5, color: '#64748b' }}>
                          {hasIssues ? `${ci.issues.length} issue(s)` : 'Clean profile'}
                        </span>

                        {isExpanded ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '12px 16px 16px 16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                        {ci.issues?.length > 0 ? (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 4, textTransform: 'uppercase' }}>
                              Detected Issues
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#92400e' }}>
                              {ci.issues.map((issue, i) => (
                                <li key={i} style={{ marginBottom: 2 }}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={14} /> Full personalization criteria satisfied. No title fabrication or missing data detected.
                          </div>
                        )}

                        {ci.recommendations?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', marginBottom: 4, textTransform: 'uppercase' }}>
                              Actionable Recommendation
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#312e81' }}>
                              {ci.recommendations.map((rec, r) => (
                                <li key={r} style={{ marginBottom: 2 }}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actionable Recommendations Global List */}
          {testResult.recommendations?.length > 0 && (
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#4f46e5" /> System-Wide Recommendations for Production Readiness
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {testResult.recommendations.map((rec, rIdx) => (
                  <div key={rIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4f46e5', marginTop: 6 }} />
                    <div>{rec}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Sandbox Content Preview Button & Container */}
          {testResult.generated_content && (
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                senderName="SNS Square Executive Briefing"
                senderEmail="nurture@snssquare.com"
                contentVersion="v1"
                allowRawView={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
