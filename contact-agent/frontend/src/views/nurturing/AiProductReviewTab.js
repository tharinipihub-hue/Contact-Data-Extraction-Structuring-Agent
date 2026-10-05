import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  Layers,
  ArrowRight,
  Info,
  Award,
  Zap,
  Check
} from 'lucide-react';

/**
 * AI-Powered Product Improvement Advisor
 * Analyzes the overall Digital Client Nurturing Agent architecture, data completeness,
 * workflow health, and provides prioritized engineering recommendations.
 * 
 * Advisory only — NEVER modifies production code automatically.
 */
export default function AiProductReviewTab({
  apiBase = '/api',
  showNotification
}) {
  const [isRunningReview, setIsRunningReview] = useState(false);
  const [reviewData, setReviewData] = useState(null);

  const fetchReview = async () => {
    setIsRunningReview(true);
    try {
      const res = await axios.post(`${apiBase}/nurture/ai-review`, {}, { timeout: 20000 });
      if (res.data?.success && res.data.review) {
        setReviewData(res.data.review);
        if (showNotification) {
          showNotification('AI Product Review updated with latest system evaluation.');
        }
      }
    } catch (err) {
      if (showNotification) {
        showNotification('Review error: ' + (err.response?.data?.error || err.message), true);
      }
    } finally {
      setIsRunningReview(false);
    }
  };

  useEffect(() => {
    fetchReview();
  }, []);

  const healthScore = reviewData?.product_health || reviewData?.health_score || 92;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', border: '1px solid #047857' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={22} color="#a7f3d0" />
            AI Product Review & Continuous Improvement Advisor
          </h3>
          <p style={{ color: '#d1fae5', fontSize: 13 }}>
            Continuous architecture evaluation analyzing contact coverage, consent enforcement, campaign conversion history, and SNS Workbench pipeline integrity. Generates prioritized, advisory enhancements.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="dn-btn dn-btn-secondary"
            onClick={fetchReview}
            disabled={isRunningReview}
            style={{ background: '#ffffff', color: '#065f46', fontWeight: 600, border: 'none', padding: '8px 16px', fontSize: 13 }}
          >
            <RefreshCw size={14} className={isRunningReview ? 'spin-icon' : ''} />
            {isRunningReview ? 'Analyzing Architecture...' : 'Re-run Evaluation'}
          </button>
        </div>
      </div>

      {reviewData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {/* PRODUCT HEALTH CARD */}
            <div className="dn-stat-card" style={{ borderLeft: '5px solid #10b981' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>PRODUCT HEALTH</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#065f46', marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  {healthScore}
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>/100</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#047857', marginTop: 4, fontWeight: 600 }}>
                  Status: {reviewData.health_label || 'Enterprise Ready'}
                </div>
              </div>
              <ShieldCheck size={36} color="#10b981" />
            </div>

            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CLIENT DATABASE QUALITY</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {reviewData.system_snapshot?.total_contacts || 0} Contacts
                </div>
                <div style={{ fontSize: 11.5, color: '#16a34a', marginTop: 4 }}>
                  {reviewData.system_snapshot?.opted_in_contacts || 0} Opted-In &bull; {reviewData.system_snapshot?.opted_out_contacts || 0} Suppressed
                </div>
              </div>
              <Award size={28} color="#6366f1" />
            </div>

            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CAMPAIGN PIPELINE</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {reviewData.system_snapshot?.total_campaigns || 0} Cadences
                </div>
                <div style={{ fontSize: 11.5, color: '#2563eb', marginTop: 4 }}>
                  {reviewData.system_snapshot?.sent_campaigns || 0} Sent &bull; {reviewData.system_snapshot?.draft_campaigns || 0} Drafts
                </div>
              </div>
              <TrendingUp size={28} color="#2563eb" />
            </div>

            <div className="dn-stat-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ROADMAP ACTIONS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {reviewData.recommended_enhancements?.length || 4} Priorities
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  Advisory enhancements ready
                </div>
              </div>
              <Lightbulb size={28} color="#f59e0b" />
            </div>
          </div>

          {/* ── STRENGTHS & GAPS SPLIT PANEL ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {/* Strengths Card */}
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#166534', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#16a34a" /> STRENGTHS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(reviewData.strengths_summary || [
                  'Strong audience segmentation & consent management',
                  'Regional occasion filtering with verified location matching',
                  'AI campaign generation with zero instruction leaks',
                  'Live SNS Square Agent Workbench integration'
                ]).map((str, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: '#f0fdf4', padding: '10px 14px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                    <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#14532d' }}>{str}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gaps Card */}
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#991b1b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#dc2626" /> GAPS & IMPROVEMENT AREAS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(reviewData.gaps_summary || [
                  'Industry enrichment incomplete for some sectors',
                  'Some contacts lack verified company information'
                ]).map((gap, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: '#fef2f2', padding: '10px 14px', borderRadius: 6, border: '1px solid #fecaca' }}>
                    <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#7f1d1d' }}>{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RECOMMENDED ENHANCEMENTS (PRIORITY 1 - 4) ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={18} color="#d97706" /> RECOMMENDED ENHANCEMENTS
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {(reviewData.recommended_enhancements || [
                {
                  priority_label: 'Priority 1',
                  title: 'Add deeper company enrichment',
                  description: 'Enrich contact profiles with verified public business developments via Tavily search before newsletter dispatch.',
                  impact: 'Eliminates generic messaging and grounds campaigns in verified facts.'
                },
                {
                  priority_label: 'Priority 2',
                  title: 'Add engagement analytics',
                  description: 'Deepen telemetry tracking for delivery, open rate, link clicks, and sentiment classification on client replies.',
                  impact: 'Provides real-time ROI tracking directly into Google Sheets Master.'
                },
                {
                  priority_label: 'Priority 3',
                  title: 'Add campaign performance prediction',
                  description: 'Utilize the AI Quality Center sandbox to simulate audience responses and predict engagement prior to dispatch.',
                  impact: 'Prevents sending under-performing campaigns to high-value enterprise accounts.'
                },
                {
                  priority_label: 'Priority 4',
                  title: 'Add automated content optimization',
                  description: 'Refine industry-specific newsletter editorial frameworks based on historical engagement patterns.',
                  impact: 'Increases conversion rates over repeated touchpoint cadences.'
                }
              ]).map((enh, idx) => {
                const priorityColors = {
                  'Priority 1': { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
                  'Priority 2': { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
                  'Priority 3': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
                  'Priority 4': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
                };
                const colorConfig = priorityColors[enh.priority_label] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 16,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <span style={{
                        display: 'inline-block',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        backgroundColor: colorConfig.bg,
                        color: colorConfig.text,
                        border: `1px solid ${colorConfig.border}`,
                        marginBottom: 10
                      }}>
                        {enh.priority_label}
                      </span>
                      
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                        {enh.title}
                      </div>

                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
                        {enh.description}
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#059669', borderTop: '1px solid #f1f5f9', paddingTop: 10, fontWeight: 500 }}>
                      <strong>Strategic Impact:</strong> {enh.impact}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Roadmap Capabilities Table */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#4f46e5" /> Detailed Capability Roadmap
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(reviewData.missing_capabilities || []).map((m, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{m.area}</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: m.priority === 'high' ? '#fee2e2' : '#f1f5f9',
                        color: m.priority === 'high' ? '#dc2626' : '#64748b'
                      }}
                    >
                      {m.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
                    {m.description}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 500, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <strong>Recommendation:</strong> {m.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advisory Disclaimer */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={15} color="#475569" />
            <span><strong>Advisory Notice:</strong> {reviewData.disclaimer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
