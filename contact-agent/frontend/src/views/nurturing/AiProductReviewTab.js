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
  Info
} from 'lucide-react';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', border: '1px solid #047857' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff' }}>
            <Cpu size={20} color="#a7f3d0" />
            AI Product Review & Continuous Improvement Engine
          </h3>
          <p style={{ color: '#d1fae5' }}>
            Autonomous meta-evaluation of the Digital Client Nurturing Agent workflow, templates, consent management, data quality, and Workbench integration. Generates prioritized, actionable enhancements for engineering review.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="dn-btn dn-btn-secondary"
            onClick={fetchReview}
            disabled={isRunningReview}
            style={{ background: '#ffffff', color: '#065f46', fontWeight: 600, border: 'none' }}
          >
            <RefreshCw size={13} className={isRunningReview ? 'spin-icon' : ''} />
            {isRunningReview ? 'Analyzing System...' : 'Re-run Review'}
          </button>
        </div>
      </div>

      {reviewData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="dn-stat-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>SYSTEM HEALTH ASSESSMENT</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#065f46', marginTop: 4 }}>
                  {reviewData.health_label || 'Operational'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Evaluated at: {new Date(reviewData.reviewed_at).toLocaleTimeString()}
                </div>
              </div>
              <ShieldCheck size={28} color="#10b981" />
            </div>

            <div className="dn-stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>HIGH PRIORITY ITEMS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
                  {reviewData.priority_summary?.high || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Requires engineering focus
                </div>
              </div>
              <AlertTriangle size={28} color="#dc2626" />
            </div>

            <div className="dn-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>MEDIUM PRIORITY ITEMS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                  {reviewData.priority_summary?.medium || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Feature and UX enhancements
                </div>
              </div>
              <TrendingUp size={28} color="#f59e0b" />
            </div>

            <div className="dn-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>CONFIRMED STRENGTHS</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6', marginTop: 2 }}>
                  {reviewData.strengths?.length || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Core working capabilities
                </div>
              </div>
              <CheckCircle2 size={28} color="#3b82f6" />
            </div>
          </div>

          {/* ── Current Strengths ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} color="#16a34a" /> Current System Strengths
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              {(reviewData.strengths || []).map((s, idx) => (
                <div key={idx} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', marginBottom: 4 }}>
                    {s.area}
                  </div>
                  <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.5, marginBottom: 8 }}>
                    {s.description}
                  </div>
                  <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>
                    Evidence: {s.evidence}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Issues Identified ── */}
          {reviewData.issues?.length > 0 && (
            <div className="dn-panel" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#dc2626" /> Issues & Gaps Found
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reviewData.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: issue.severity === 'high' ? '#fef2f2' : '#fefce8',
                      border: `1px solid ${issue.severity === 'high' ? '#fecaca' : '#fef08a'}`,
                      borderRadius: 8,
                      padding: 14
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: issue.severity === 'high' ? '#991b1b' : '#854d0e' }}>
                        {issue.area}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: issue.severity === 'high' ? '#dc2626' : '#ca8a04',
                          color: '#ffffff'
                        }}
                      >
                        {issue.severity.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>
                      {issue.issue}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      <strong>Impact:</strong> {issue.impact} &bull; <strong>Recommended Fix:</strong> {issue.fix}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Missing Capabilities ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#4f46e5" /> Missing Capabilities & Roadmap Opportunities
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              {(reviewData.missing_capabilities || []).map((m, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
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
                  {m.depends_on && (
                    <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 4 }}>
                      Dependency: {m.depends_on}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Recommended Improvements with Priorities ── */}
          <div className="dn-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={16} color="#d97706" /> Recommended Engineering Improvements
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(reviewData.recommended_improvements || []).map((rec, idx) => (
                <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: rec.priority === 'HIGH' ? '#fee2e2' : rec.priority === 'MEDIUM' ? '#fef3c7' : '#f1f5f9',
                      color: rec.priority === 'HIGH' ? '#b91c1c' : rec.priority === 'MEDIUM' ? '#92400e' : '#475569'
                    }}
                  >
                    {rec.priority}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{rec.area}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>{rec.description}</div>
                    <div style={{ fontSize: 11.5, color: '#059669', marginTop: 4 }}>
                      <strong>Action:</strong> {rec.action} &bull; <em>{rec.status}</em>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer Note */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="#64748b" />
            <span>{reviewData.disclaimer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
