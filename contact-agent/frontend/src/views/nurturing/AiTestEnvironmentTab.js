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
  Send,
  Eye,
  FileText
} from 'lucide-react';

export default function AiTestEnvironmentTab({
  contacts = [],
  apiBase = '/api',
  showNotification
}) {
  const [campaignType, setCampaignType] = useState('newsletter');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customBrief, setCustomBrief] = useState('');
  const [customOccasion, setCustomOccasion] = useState('Diwali 2026');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [expandedTest, setExpandedTest] = useState(null);

  const optedInContacts = contacts.filter(c => c.opt_in === true);
  const activeContact = contacts.find(c => c.id === selectedContactId) || optedInContacts[0] || null;

  const handleRunTest = async () => {
    setIsRunningTest(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${apiBase}/nurture/ai-test`, {
        campaign_type: campaignType,
        campaign_name: `AI Quality Audit: ${campaignType}`,
        campaign_brief: customBrief.trim() || undefined,
        contact_id: activeContact?.id || undefined,
        occasion: campaignType.includes('festival') ? customOccasion : undefined
      }, { timeout: 60000 });

      if (res.data?.success) {
        setTestResult(res.data);
        if (showNotification) {
          showNotification(`AI Quality Test completed. Overall Score: ${res.data.overall_score}/100 (${res.data.status})`);
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

  const getScoreColor = (score, max = 100) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return '#16a34a';
    if (pct >= 60) return '#ca8a04';
    return '#dc2626';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', border: '1px solid #4338ca' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff' }}>
            <FlaskConical size={20} color="#a5b4fc" />
            AI Test Environment — Digital Client Nurturing Quality Assurance
          </h3>
          <p style={{ color: '#c7d2fe' }}>
            Comprehensive automated evaluation of campaign generation quality, personalization depth, newsletter structure, festival tone, regional relevance, and CAN-SPAM/GDPR compliance.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="dn-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '6px 12px' }}>
            <ShieldCheck size={13} /> Sandbox Mode Active — Dispatches Blocked
          </span>
        </div>
      </div>

      {/* ── Configuration & Execution Panel ── */}
      <div className="dn-panel" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Play size={16} color="#4f46e5" /> Configure & Run Quality Evaluation
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Select the campaign type, recipient profile, and test brief to evaluate. The AI tester executes live Workbench generation in sandbox mode and evaluates the resulting content against production criteria.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Campaign Type to Test
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

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Test Contact Profile
            </label>
            <select
              className="dn-input"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              disabled={isRunningTest}
            >
              {optedInContacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.company} ({c.sector || c.industry || 'Technology'}, {c.country || c.location || 'India'})
                </option>
              ))}
            </select>
          </div>

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
                placeholder="e.g., Diwali 2026, Pongal, Christmas"
                disabled={isRunningTest}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Custom Brief (Optional override)
            </label>
            <input
              type="text"
              className="dn-input"
              value={customBrief}
              onChange={(e) => setCustomBrief(e.target.value)}
              placeholder="Leave blank to use standard criteria"
              disabled={isRunningTest}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} color="#6366f1" />
            <span>A test evaluates actual AI synthesis but <strong>NEVER</strong> sends an email to clients.</span>
          </div>

          <button
            className="dn-btn dn-btn-primary"
            onClick={handleRunTest}
            disabled={isRunningTest}
            style={{ padding: '9px 20px', fontSize: 13, background: '#4f46e5' }}
          >
            {isRunningTest ? (
              <>
                <RefreshCw size={14} className="spin-icon" /> Running Quality Evaluation...
              </>
            ) : (
              <>
                <FlaskConical size={14} /> Run AI Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Test Results Panel ── */}
      {testResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Score Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div className="dn-stat-card" style={{ borderLeft: `4px solid ${getScoreColor(testResult.overall_score)}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>OVERALL QUALITY SCORE</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: getScoreColor(testResult.overall_score), marginTop: 2 }}>
                  {testResult.overall_score}<span style={{ fontSize: 16, fontWeight: 500, color: '#94a3b8' }}>/100</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Grade: <strong>{testResult.overall_grade}</strong> &bull; Status: <strong>{testResult.status}</strong>
                </div>
              </div>
              <Award size={32} color={getScoreColor(testResult.overall_score)} />
            </div>

            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>TEST SUITE OUTCOME</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 700, fontSize: 18 }}>
                    <CheckCircle2 size={16} /> {testResult.summary?.passed || 0} Pass
                  </div>
                  {testResult.summary?.warned > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ca8a04', fontWeight: 700, fontSize: 18 }}>
                      <AlertTriangle size={16} /> {testResult.summary.warned} Warn
                    </div>
                  )}
                  {testResult.summary?.failed > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 700, fontSize: 18 }}>
                      <XCircle size={16} /> {testResult.summary.failed} Fail
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  Total tests evaluated: {testResult.summary?.total || 0}
                </div>
              </div>
            </div>

            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>SAFETY & DISPATCH GUARANTEE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                  <ShieldCheck size={18} /> Zero Dispatches Sent
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  Recipient email: <span style={{ fontFamily: 'monospace' }}>{testResult.contact_used?.company}</span>
                </div>
              </div>
            </div>

            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>WORKBENCH STATUS</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: testResult.workbench_status === 'connected' ? '#16a34a' : '#dc2626', marginTop: 4 }}>
                  {testResult.workbench_status === 'connected' ? 'Connected (Live Groq)' : 'Unavailable'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  Tested at: {new Date(testResult.tested_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          {/* Category Score Breakdown Bars */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
              Evaluation Category Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {Object.entries(testResult.category_scores || {}).map(([catKey, catData]) => {
                const pct = Math.round((catData.score / catData.max) * 100);
                const labelMap = {
                  personalization: 'Personalization Quality',
                  content_quality: 'Content Quality & Integrity',
                  campaign_type_compliance: 'Campaign-Type Compliance',
                  tone: 'Tone & Style Appropriateness',
                  technical_validity: 'Technical & Link Validity',
                  compliance: 'CAN-SPAM / Consent Compliance'
                };
                return (
                  <div key={catKey} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      <span>{labelMap[catKey] || catKey}</span>
                      <span style={{ color: getScoreColor(pct) }}>{catData.score}/{catData.max} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: getScoreColor(pct),
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Test Results List */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
              Detailed Test Findings & Recommendations
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(testResult.test_results || []).map((t, idx) => {
                const isExpanded = expandedTest === idx;
                const statusColor = t.status === 'PASS' ? '#16a34a' : t.status === 'WARN' ? '#ca8a04' : '#dc2626';
                const statusBg = t.status === 'PASS' ? '#f0fdf4' : t.status === 'WARN' ? '#fefce8' : '#fef2f2';
                const statusBorder = t.status === 'PASS' ? '#bbf7d0' : t.status === 'WARN' ? '#fef08a' : '#fecaca';

                return (
                  <div
                    key={idx}
                    style={{
                      border: `1px solid ${statusBorder}`,
                      borderRadius: 8,
                      background: statusBg,
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
                      onClick={() => setExpandedTest(isExpanded ? null : idx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {t.status === 'PASS' ? (
                          <CheckCircle2 size={16} color="#16a34a" />
                        ) : t.status === 'WARN' ? (
                          <AlertTriangle size={16} color="#ca8a04" />
                        ) : (
                          <XCircle size={16} color="#dc2626" />
                        )}
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{t.test_name}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#ffffff', border: `1px solid ${statusBorder}`, color: statusColor, fontWeight: 600 }}>
                          {t.status} ({t.score}/{t.max_score})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {t.issues?.length > 0 ? `${t.issues.length} issue(s)` : 'All checks passed'}
                        </span>
                        {isExpanded ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '12px 16px 16px 16px', borderTop: `1px solid ${statusBorder}`, background: '#ffffff' }}>
                        {/* What Is Good */}
                        {t.good?.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>
                              WHAT IS GOOD
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
                              {t.good.map((g, gIdx) => (
                                <li key={gIdx} style={{ marginBottom: 2 }}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Issues Found */}
                        {t.issues?.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                              ISSUES FOUND
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#7f1d1d' }}>
                              {t.issues.map((issue, iIdx) => (
                                <li key={iIdx} style={{ marginBottom: 2 }}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations */}
                        {t.recommendations?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>
                              RECOMMENDED ENHANCEMENT
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#312e81' }}>
                              {t.recommendations.map((rec, rIdx) => (
                                <li key={rIdx} style={{ marginBottom: 2 }}>{rec}</li>
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

          {/* Generated Sandbox Content Preview */}
          {testResult.generated_content?.email_body_preview && (
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={15} color="#2563eb" /> Evaluated AI Content Preview (Sandbox)
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Subject: <strong>{testResult.generated_content.subject || '—'}</strong>
              </div>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12.5, lineHeight: 1.6, color: '#334155', maxHeight: 250, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {testResult.generated_content.email_body_preview}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
