import React, { useState } from 'react';
import axios from 'axios';
import {
  Search,
  Building,
  User,
  Globe,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Info,
  Layers
} from 'lucide-react';

export default function ContactResearchTab({
  contacts = [],
  apiBase = '/api',
  showNotification,
  onUseInCampaign
}) {
  const [selectedContactId, setSelectedContactId] = useState(contacts[0]?.id || '');
  const [isResearching, setIsResearching] = useState(false);
  const [researchData, setResearchData] = useState(null);

  const selectedContact = contacts.find(c => c.id === selectedContactId) || contacts[0] || null;

  const handleResearch = async (contactToUse = null) => {
    const target = contactToUse || selectedContact;
    if (!target) {
      if (showNotification) showNotification('Please select a contact to research.', true);
      return;
    }
    setSelectedContactId(target.id);
    setIsResearching(true);
    setResearchData(null);
    try {
      const res = await axios.post(`${apiBase}/nurture/research-contact`, {
        contact_id: target.id,
        contact: target
      }, { timeout: 40000 });

      setResearchData(res.data);
      if (res.data?.available) {
        if (showNotification) {
          showNotification(`Intelligence research retrieved ${res.data.findings?.length || 0} topic area(s) for ${target.company || target.name}.`);
        }
      } else if (res.data?.blocked) {
        if (showNotification) {
          showNotification(`Research blocked: ${res.data.reason}`, true);
        }
      }
    } catch (err) {
      if (showNotification) {
        showNotification('Research error: ' + (err.response?.data?.error || err.message), true);
      }
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Banner ── */}
      <div className="dn-workflow-banner" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid #334155' }}>
        <div className="dn-workflow-banner-info">
          <h3 style={{ color: '#ffffff' }}>
            <Search size={20} color="#60a5fa" />
            Contact & Company Intelligence Research (Verified Public Web Search)
          </h3>
          <p style={{ color: '#cbd5e1' }}>
            Gathers verified public company developments, industry topics, and organizational focus via Tavily search. Grounded with source citations and confidence metrics — never fabricated.
          </p>
        </div>
      </div>

      {/* ── Selection & Action Panel ── */}
      <div className="dn-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Select Client Contact to Research
            </label>
            <select
              className="dn-input"
              value={selectedContactId}
              onChange={(e) => {
                setSelectedContactId(e.target.value);
                setResearchData(null);
              }}
              disabled={isResearching}
            >
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.company} ({c.sector || c.industry || 'Technology'}) &bull; {c.opt_in ? 'Opted In' : 'Opted Out'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="dn-btn dn-btn-primary"
              onClick={() => handleResearch()}
              disabled={isResearching || !selectedContact}
              style={{ padding: '9px 20px', fontSize: 13 }}
            >
              {isResearching ? (
                <>
                  <RefreshCw size={14} className="spin-icon" /> Researching Public Web...
                </>
              ) : (
                <>
                  <Search size={14} /> AI Enrich Contact
                </>
              )}
            </button>
          </div>
        </div>

        {selectedContact && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#475569' }}>
            <div>
              <span style={{ color: '#64748b' }}>Name:</span> <strong>{selectedContact.name}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Company:</span> <strong>{selectedContact.company}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Designation:</span> <strong>{selectedContact.designation}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Sector:</span> <strong>{selectedContact.sector || selectedContact.industry || 'Technology'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Location:</span> <strong>{selectedContact.location || `${selectedContact.city || ''}, ${selectedContact.country || ''}`.trim() || 'India'}</strong>
            </div>
          </div>
        )}
      </div>

      {/* ── Research Results Display ── */}
      {researchData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Blocked State Notice (when Tavily API key is not present) */}
          {researchData.blocked && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef08a', borderRadius: 8, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <ShieldAlert size={18} color="#b45309" />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
                  {researchData.reason}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6, marginBottom: 12 }}>
                {researchData.setup_instructions}
              </div>
              <div style={{ fontSize: 11.5, color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 6 }}>
                <strong>Verified Integration Point:</strong> To enable real-time web research, configure <code>TAVILY_API_KEY</code> on your Render dashboard and local <code>.env</code> file. No application code changes required.
              </div>
            </div>
          )}

          {/* Successful Research Results */}
          {researchData.available && (
            <>
              {/* Header with Apply Button */}
              <div className="dn-panel" style={{ padding: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} color="#16a34a" /> Research Completed: {researchData.company || researchData.contact_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 2 }}>
                    Retrieved at: {new Date(researchData.retrieved_at).toLocaleString()} &bull; Provider: {researchData.source}
                  </div>
                </div>

                {onUseInCampaign && (
                  <button
                    className="dn-btn dn-btn-primary"
                    onClick={() => onUseInCampaign(researchData, selectedContact)}
                    style={{ background: '#16a34a', border: 'none' }}
                  >
                    <Sparkles size={13} /> Use in Campaign Generator
                  </button>
                )}
              </div>

              {/* Research Findings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(researchData.findings || []).map((finding, idx) => (
                  <div key={idx} className="dn-panel" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {finding.category}
                      </div>
                      <span
                        className={`dn-badge ${finding.confidence === 'verified' ? 'dn-badge-green' : 'dn-badge-amber'}`}
                        style={{ fontSize: 11 }}
                      >
                        {finding.confidence === 'verified' ? 'Verified Search' : 'Partial Match'}
                      </span>
                    </div>

                    {finding.answer && (
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#1e293b', lineHeight: 1.6, marginBottom: 12 }}>
                        {finding.answer}
                      </div>
                    )}

                    {/* Sources List */}
                    {finding.sources?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                          VERIFIED SOURCES ({finding.sources.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {finding.sources.map((src, sIdx) => (
                            <div key={sIdx} style={{ fontSize: 11.5, padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>{src.title}</span>
                                <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {src.snippet}
                                </div>
                              </div>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 11, flexShrink: 0 }}
                              >
                                View Source <ExternalLink size={11} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Info size={14} color="#64748b" />
                <span>{researchData.disclaimer}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
