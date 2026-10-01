'use strict';

let axios;
try {
  axios = require('axios');
} catch (e) {}

class WorkbenchService {
  constructor() {
    this.webhookUrl = process.env.NURTURE_WORKBENCH_WEBHOOK_URL || '';
  }

  getWebhookUrl() {
    // Read at call time so tests and managed runtimes can update env before requests.
    return process.env.NURTURE_WORKBENCH_WEBHOOK_URL || this.webhookUrl;
  }

  async testNurturingWebhook(contact) {
    const targetUrl = this.getWebhookUrl();
    if (!targetUrl) {
      const error = new Error('NURTURE_WORKBENCH_WEBHOOK_URL is not configured');
      error.status = 503;
      throw error;
    }

    const parsedTarget = new URL(targetUrl);
    let testContact = contact;
    if (!testContact || testContact.opt_in !== true) {
      try {
        const store = require('./nurtureStore');
        testContact = store.getContacts().find(c => c.opt_in === true);
      } catch (_) {}
    }
    if (!testContact) {
      testContact = {
        id: 'CNT-001',
        name: 'Arjun Mehta',
        company: 'BrightEdge Solutions',
        designation: 'Marketing Manager',
        email: 'thariniparthasarathy1804@gmail.com',
        sector: 'Technology',
        industry: 'Technology',
        opt_in: true
      };
    }

    const payload = {
      action: 'generate_preview',
      campaign_name: 'SNS Workbench Webhook Health Verification',
      campaign_type: 'newsletter',
      developer_input: 'Live connectivity and AI campaign generation test via SNS Workbench.',
      campaign_brief: 'Live connectivity and AI campaign generation test via SNS Workbench.',
      sector: testContact.sector || testContact.industry || 'Technology',
      target_segment: `${testContact.sector || 'Technology'} Sector Clients`,
      channel: 'email',
      contacts: [testContact],
      active_contact: testContact
    };
    const startedAt = Date.now();
    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Digital-Client-Nurturing-Backend/1.0' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      console.warn(`[NurturingWebhookTest] POST ${parsedTarget.host}${parsedTarget.pathname} network_error durationMs=${durationMs}`);
      const requestError = new Error(`Unable to reach SNS Workbench (${err.message})`);
      requestError.status = 502;
      throw requestError;
    }

    const responseText = await response.text();
    let responseData;
    try { responseData = JSON.parse(responseText); }
    catch (_err) { responseData = responseText.slice(0, 1000); }

    const durationMs = Date.now() - startedAt;
    const success = response.status >= 200 && response.status < 300 && responseData?.success !== false;
    console.info(`[NurturingWebhookTest] POST ${parsedTarget.host}${parsedTarget.pathname} status=${response.status} durationMs=${durationMs} success=${success}`);
    return {
      success,
      status: response.status,
      durationMs,
      target: `${parsedTarget.origin}${parsedTarget.pathname}`,
      response: responseData
    };
  }

  /**
   * Dispatches nurturing campaign payload directly to the SNS Workbench Webhook.
   * Strictly dependent on SNS Workbench workflow nodes for LLM synthesis,
   * intent classification, Google Sheets syncing, and sales handoff.
   */
  async triggerNurturingWorkflow(payload) {
    const targetUrl = this.getWebhookUrl();
    if (!targetUrl) throw new Error('NURTURE_WORKBENCH_WEBHOOK_URL is not configured');

    async function doRequest(url) {
      if (typeof fetch === 'function') {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Digital-Client-Nurturing-Backend/1.0'
          },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch (e) { json = { text }; }
        return { status: res.status, data: json };
      } else if (axios) {
        try {
          const response = await axios.post(url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Digital-Client-Nurturing-Backend/1.0'
            },
            timeout: 20000
          });
          return { status: response.status, data: response.data };
        } catch (axiosErr) {
          return {
            status: axiosErr.response?.status || 500,
            data: axiosErr.response?.data || { error: axiosErr.message }
          };
        }
      }
      throw new Error('No HTTP client available in runtime environment');
    }

    let resp;
    try {
      resp = await doRequest(targetUrl);
    } catch (reqErr) {
      throw new Error(`Failed to connect to SNS Workbench at ${targetUrl}: ${reqErr.message}. Ensure SNS Workbench is reachable.`);
    }

    const { status, data } = resp;
    try {
      const parsedUrl = new URL(targetUrl);
      console.info(`[NurturingWebhook] POST ${parsedUrl.host}${parsedUrl.pathname} status=${status} success=${status >= 200 && status < 300}`);
    } catch (_err) {
      console.info(`[NurturingWebhook] POST invalid-target status=${status} success=${status >= 200 && status < 300}`);
    }

    if (status >= 200 && status < 300) {
      // Normalize data returned by SNS Workbench nodes
      let outputData = data;
      if (Array.isArray(data) && data[0]) {
        outputData = data[0].json || data[0];
      } else if (data && data.json) {
        outputData = data.json;
      }
      if (outputData && outputData.data && !outputData.nurtured_contact && outputData.data.nurtured_contact) {
        outputData = outputData.data;
      }

      return {
        success: true,
        source: 'workbench_webhook',
        targetUrl,
        data: outputData
      };
    }

    // Workbench returned an error or inactive status
    if (status === 404) {
      throw new Error(`SNS Workbench workflow is not active or deployed at ${targetUrl} (HTTP 404). In SNS Workbench, click "Deploy Live" (or "▶ Run Workflow") to enable webhook execution.`);
    }

    const detail = (data && (data.message || data.error)) ? (data.message || data.error) : JSON.stringify(data);
    throw new Error(`SNS Workbench returned HTTP ${status}: ${detail}`);
  }
}

module.exports = new WorkbenchService();
