'use strict';

const fs = require('fs');
const path = require('path');
const NURTURE_DATA_DIR = path.resolve(process.env.NURTURE_DATA_DIR || path.join(__dirname, '../../nurture-data'));
const OPT_OVERRIDES_FILE = path.join(NURTURE_DATA_DIR, 'opt_overrides.json');
const CAMPAIGNS_FILE = path.join(NURTURE_DATA_DIR, 'campaigns.json');
const CONTACTS_FILE = path.join(NURTURE_DATA_DIR, 'contacts.json');
const SALES_FILE = path.join(NURTURE_DATA_DIR, 'sales_handoffs.json');
const AUDIT_LOGS_FILE = path.join(NURTURE_DATA_DIR, 'audit_logs.json');

/**
 * In-memory & Persistent store for Digital Client Nurturing Agent
 * Tracks Contacts, Campaigns, Engagement Logs, and Sales Handoffs.
 */

// Real nurturing contacts enter through Google Sheets sync or the Workbench callback.
const INITIAL_CONTACTS = [];

const INITIAL_CAMPAIGNS = [];

class NurtureStore {
  loadOptOverrides() {
    try {
      if (fs.existsSync(OPT_OVERRIDES_FILE)) {
        const raw = fs.readFileSync(OPT_OVERRIDES_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return {};
  }

  saveOptOverrides() {
    try {
      fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true });
      fs.writeFileSync(OPT_OVERRIDES_FILE, JSON.stringify(this.optOverrides, null, 2), 'utf8');
    } catch (e) {}
  }

  loadCampaigns() {
    try {
      if (fs.existsSync(CAMPAIGNS_FILE)) {
        const raw = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [...INITIAL_CAMPAIGNS];
  }

  saveCampaigns() {
    try {
      fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true });
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(this.campaigns, null, 2), 'utf8');
    } catch (e) {}
  }

  loadSalesHandoffs() {
    try {
      if (fs.existsSync(SALES_FILE)) {
        const raw = fs.readFileSync(SALES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  saveSalesHandoffs() {
    try {
      fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true });
      fs.writeFileSync(SALES_FILE, JSON.stringify(this.salesHandoffs, null, 2), 'utf8');
    } catch (e) {}
  }

  loadAuditLogs() {
    try {
      if (fs.existsSync(AUDIT_LOGS_FILE)) {
        const raw = fs.readFileSync(AUDIT_LOGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  saveAuditLogs() {
    try {
      fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true });
      fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(this.auditLogs, null, 2), 'utf8');
    } catch (e) {}
  }

  constructor() {
    this.optOverrides = this.loadOptOverrides();
    this.contacts = this.loadContacts();
    this.campaigns = this.loadCampaigns();
    this.salesHandoffs = this.loadSalesHandoffs();
    this.auditLogs = this.loadAuditLogs();
    try {
      const savedEvents = JSON.parse(fs.readFileSync(path.join(NURTURE_DATA_DIR, 'opt_events.json'), 'utf8'));
      this.optEvents = Array.isArray(savedEvents) ? savedEvents : [];
    } catch (_) {
      this.optEvents = [];
    }
  }

  loadContacts() {
    try {
      const parsed = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return INITIAL_CONTACTS.map(c => {
      const override = this.optOverrides[c.id] ?? this.optOverrides[c.name];
      return {
        ...c,
        opt_in: override !== undefined ? override : c.opt_in,
        status: (override !== undefined ? override : c.opt_in) ? 'Active' : 'Opted Out'
      };
    });
  }

  calculateAudienceCount(audience) {
    if (!this.contacts || this.contacts.length === 0) return 0;
    const optedIn = this.contacts.filter(c => c.opt_in === true);
    if (!audience || audience === 'All Existing Clients' || audience === 'All Contacts') {
      return optedIn.length;
    }
    const aud = audience.toLowerCase();
    const match = optedIn.filter(c => {
      const ind = (c.industry || c.sector || '').toLowerCase();
      const type = (c.client_type || '').toLowerCase();
      return aud.includes(ind) || aud.includes(type) || ind.includes(aud);
    });
    return match.length > 0 ? match.length : optedIn.length;
  }

  recalculateCampaignMetrics() {
    this.campaigns.forEach(cmp => {
      cmp.current_audience_size = this.calculateAudienceCount(cmp.audience);
    });
  }

  updateContact(id, updater) {
    const contact = this.contacts.find(c => c.id === id);
    if (!contact) return null;
    updater(contact);
    try { fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true }); fs.writeFileSync(CONTACTS_FILE, JSON.stringify(this.contacts, null, 2)); } catch (_) {}
    return contact;
  }

  saveContacts() {
    try { fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true }); fs.writeFileSync(CONTACTS_FILE, JSON.stringify(this.contacts, null, 2)); } catch (_) {}
  }

  getContacts() {
    return this.contacts;
  }

  getContactById(id) {
    return this.contacts.find(c => c.id === id);
  }

  getOptEvents() {
    return this.optEvents || [];
  }

  addOptEvent(event) {
    if (!this.optEvents) this.optEvents = [];
    this.optEvents.unshift(event);
    if (this.optEvents.length > 50) {
      this.optEvents = this.optEvents.slice(0, 50);
    }
    try { fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true }); fs.writeFileSync(path.join(NURTURE_DATA_DIR, 'opt_events.json'), JSON.stringify(this.optEvents, null, 2)); } catch (_) {}
  }

  toggleContactOptIn(id, explicitOptIn, extraInfo = {}) {
    let contact = this.contacts.find(c => c.id === id);
    if (!contact && extraInfo.id) {
      contact = this.contacts.find(c => c.id === extraInfo.id);
    }
    if (!contact && extraInfo.name) {
      contact = this.contacts.find(c => c.name && c.name.trim().toLowerCase() === extraInfo.name.trim().toLowerCase());
    }
    if (!contact && id) {
      contact = this.contacts.find(c => (c.name && c.name.toLowerCase() === id.toLowerCase()));
    }

    let targetState;
    if (explicitOptIn !== undefined && explicitOptIn !== null) {
      targetState = Boolean(explicitOptIn);
    } else if (contact) {
      targetState = !contact.opt_in;
    } else if (this.optOverrides[id] !== undefined) {
      targetState = !this.optOverrides[id];
    } else {
      targetState = false;
    }

    if (contact) {
      contact.opt_in = targetState;
      contact.status = targetState ? 'Active' : 'Opted Out';
      const action = targetState ? 'Opted In' : 'Opted Out';
      contact.timeline = contact.timeline || [];
      contact.timeline.unshift({
        date: 'Just now',
        title: `Communication Preference Updated: ${action}`,
        detail: `Client status changed to ${action} for automated newsletters.`
      });

      if (contact.id) this.optOverrides[contact.id] = targetState;
      if (contact.name) this.optOverrides[contact.name] = targetState;
      this.saveOptOverrides();
      this.saveContacts();

      const event = {
        id: `EVT-OPT-${Date.now()}`,
        type: targetState ? 'opt_in' : 'opt_out',
        contactId: contact.id,
        name: contact.name,
        company: contact.company || 'Client Organization',
        email: contact.email,
        channel: 'Workspace Dashboard Toggle',
        timestamp: new Date().toISOString(),
        formattedTime: 'Just now',
        detail: targetState
          ? `Client resumed subscription and opted in to automated campaigns.`
          : `Client opted out from automated campaigns.`
      };
      this.addOptEvent(event);

      this.recalculateCampaignMetrics();
      this.saveContacts();
      return { contact, event };
    }
    return null;
  }

  resetToInitialContacts() {
    this.contacts = INITIAL_CONTACTS.map(c => ({ ...c }));
    this.recalculateCampaignMetrics();
    this.saveContacts();
    return this.contacts;
  }

  addContacts(newContacts) {
    let inserted = 0;
    for (const contact of newContacts) {
      const exists = this.contacts.some(c => c.id === contact.id || (contact.email && c.email === contact.email));
      if (!exists) {
        this.contacts.push({ ...contact });
        inserted += 1;
      }
    }
    this.saveContacts();
    return inserted;
  }

  setContactOptIn(id, optInStatus) {
    const contact = this.contacts.find(c => c.id === id);
    if (contact) {
      contact.opt_in = Boolean(optInStatus);
      contact.status = contact.opt_in ? 'Active' : 'Opted Out';
      if (contact.id) this.optOverrides[contact.id] = contact.opt_in;
      if (contact.name) this.optOverrides[contact.name] = contact.opt_in;
      this.saveOptOverrides();
      try { fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true }); fs.writeFileSync(CONTACTS_FILE, JSON.stringify(this.contacts, null, 2)); } catch (_) {}
      return contact;
    }
    return null;
  }

  updateContactPreferences(id, preferences = {}) {
    let contact = this.contacts.find(c => c.id === id || c.email === id);
    if (!contact && preferences.name) {
      contact = this.contacts.find(c => c.name && c.name.toLowerCase() === preferences.name.toLowerCase());
    }
    if (contact) {
      if (preferences.opt_in !== undefined) {
        contact.opt_in = Boolean(preferences.opt_in);
        contact.status = contact.opt_in ? 'Active' : 'Opted Out';
        if (contact.id) this.optOverrides[contact.id] = contact.opt_in;
        if (contact.name) this.optOverrides[contact.name] = contact.opt_in;
        this.saveOptOverrides();
      }
      contact.preferences = {
        ...(contact.preferences || {
          email_newsletters: true,
          executive_briefings: true,
          case_studies: true,
          frequency: 'bi-weekly',
          channels: ['Email']
        }),
        ...preferences
      };

      const action = contact.opt_in ? 'Preferences Updated (Opted In)' : 'Unsubscribed (Opted Out)';
      contact.timeline = contact.timeline || [];
      contact.timeline.unshift({
        date: 'Just now',
        title: `Self-Service Preference Portal: ${action}`,
        detail: contact.opt_in
          ? `Client confirmed preferences (Frequency: ${contact.preferences.frequency || 'Bi-Weekly'})`
          : 'Client opted out via direct email unsubscribe link.'
      });

      const event = {
        id: `EVT-OPT-${Date.now()}`,
        type: contact.opt_in ? 'opt_in' : 'opt_out',
        contactId: contact.id,
        name: contact.name,
        company: contact.company || 'Client Organization',
        email: contact.email,
        channel: 'Preference Center Portal',
        timestamp: new Date().toISOString(),
        formattedTime: 'Just now',
        detail: contact.opt_in
          ? `Client updated preferences and opted in for communications.`
          : `Client unsubscribed via email preference center.`
      };
      this.addOptEvent(event);

      this.recalculateCampaignMetrics();
      this.saveContacts();
      return { contact, event };
    }
    return null;
  }

  setContacts(newContacts) {
    this.optOverrides = this.loadOptOverrides();
    this.contacts = newContacts.map((c, idx) => {
      // Prioritize matching by ID, then by Name. Do NOT match by email alone because multiple contacts share an email.
      const matchInitial = INITIAL_CONTACTS.find(init => (c.id && init.id === c.id) || (c.name && init.name && init.name.trim().toLowerCase() === c.name.trim().toLowerCase()));
      const existing = this.contacts.find(ex => (c.id && ex.id === c.id) || (c.name && ex.name && ex.name.trim().toLowerCase() === c.name.trim().toLowerCase()));

      const cid = c.id || existing?.id || matchInitial?.id || `CNT-${String(idx + 1).padStart(3, '0')}`;
      const cname = c.name || existing?.name || matchInitial?.name;

      // Check persistent opt-out overrides first
      let optIn = false;
      if (this.optOverrides[cid] !== undefined) {
        optIn = Boolean(this.optOverrides[cid]);
      } else if (cname && this.optOverrides[cname] !== undefined) {
        optIn = Boolean(this.optOverrides[cname]);
      } else if (existing && existing.opt_in !== undefined) {
        optIn = Boolean(existing.opt_in);
      } else if (c.opt_in !== undefined) {
        optIn = Boolean(c.opt_in);
      }

      return {
        ...c,
        id: cid,
        opt_in: optIn,
        status: optIn ? 'Active' : (c.status === 'Opted Out' ? 'Opted Out' : 'Pending Consent'),
        sector: c.sector || c['Sector / Industry'] || c.industry || matchInitial?.sector || '',
        industry: c.sector || c['Sector / Industry'] || c.industry || matchInitial?.industry || '',
        location: c.location || matchInitial?.location || [c.city, c.state, c.country].filter(Boolean).join(', '),
        known_interests: c.known_interests || matchInitial?.known_interests || '',
        timeline: c.timeline || existing?.timeline || matchInitial?.timeline || [
          { date: 'Today', title: 'Imported from Google Sheet', detail: 'Contact record active for automated nurturing campaigns' }
        ],
        client_engagements: c.client_engagements || existing?.client_engagements || matchInitial?.client_engagements || []
      };
    });
    this.recalculateCampaignMetrics();
    this.saveContacts();
    return this.contacts;
  }

  getCampaigns() {
    return this.campaigns;
  }

  saveCampaigns() {
    try { fs.mkdirSync(NURTURE_DATA_DIR, { recursive: true }); fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(this.campaigns, null, 2)); } catch (_) {}
  }

  addCampaign(campaign) {
    this.campaigns.unshift(campaign);
    this.saveCampaigns();
    return campaign;
  }

  deleteCampaign(id) {
    const idx = this.campaigns.findIndex(c => c.id === id);
    if (idx !== -1) {
      const removed = this.campaigns.splice(idx, 1);
      this.saveCampaigns();
      return removed[0];
    }
    return null;
  }

  getSalesHandoffs() {
    return this.salesHandoffs;
  }

  addSalesHandoff(handoff) {
    this.salesHandoffs.unshift(handoff);
    this.saveSalesHandoffs();
    return handoff;
  }

  updateSalesHandoff(leadId, updates = {}) {
    const lead = this.salesHandoffs.find(item => item.id === leadId || item.lead_id === leadId);
    if (!lead) return null;
    Object.assign(lead, updates);
    this.saveSalesHandoffs();
    return lead;
  }

  getAuditLogs() {
    return this.auditLogs || [];
  }

  addAuditLog(entry) {
    if (!this.auditLogs) this.auditLogs = [];
    const log = {
      id: entry.id || `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      formattedTime: entry.formattedTime || 'Just now',
      event_type: entry.event_type || 'System Event',
      contact_name: entry.contact_name || 'Enterprise Client',
      details: entry.details || '',
      status: entry.status || 'Success'
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 50) this.auditLogs = this.auditLogs.slice(0, 50);
    this.saveAuditLogs();
    return log;
  }

  getStats() {
    const totalSent = this.campaigns.reduce((acc, c) => acc + (c.metrics?.sent || 0), 0);
    const totalInterested = this.salesHandoffs.length;
    const optedInCount = this.contacts.filter(c => c.opt_in === true).length;

    return {
      total_clients: this.contacts.length,
      opted_in_clients: optedInCount,
      active_campaigns: this.campaigns.length,
      messages_sent: totalSent,
      interested_clients: totalInterested
    };
  }

  updateCampaign(id, updates = {}) {
    const campaign = this.campaigns.find(item => item.id === id);
    if (!campaign) return null;
    Object.assign(campaign, updates);
    this.saveCampaigns();
    return campaign;
  }
}

module.exports = new NurtureStore();
