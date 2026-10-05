'use strict';

let axios;
try {
  axios = require('axios');
} catch (e) {}

class WorkbenchService {
  constructor() {
    this.webhookUrl = process.env.NURTURE_WORKBENCH_WEBHOOK_URL || 'https://api.agents.snsihub.ai/webhook/client-nurturing';
    this.testWebhookUrl = process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL || 'https://api.agents.snsihub.ai/webhook-test/client-nurturing';
  }

  getWebhookUrl(payload = {}) {
    // Read at call time so tests and managed runtimes can update env before requests.
    const isTestMode = payload.is_test_mode === true || payload.test_mode === true;
    const isTestEnv = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test' || process.env.USE_WORKBENCH_TEST_WEBHOOK === 'true';

    if ((isTestMode || isTestEnv) && (process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL || this.testWebhookUrl)) {
      return process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL || this.testWebhookUrl;
    }
    return process.env.NURTURE_WORKBENCH_WEBHOOK_URL || this.webhookUrl;
  }

  /**
   * Safe status check: queries the actual configured SNS Workbench webhook URL
   * to determine real-time connectivity and deployment status without fabricating.
   */
  async getWorkbenchStatus() {
    const prodUrl = process.env.NURTURE_WORKBENCH_WEBHOOK_URL || this.webhookUrl;
    const testUrl = process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL || this.testWebhookUrl;

    if (!prodUrl) {
      return {
        status: 'webhook_unavailable',
        label: 'Webhook Not Configured',
        connected: false,
        http_status: null,
        endpoint: null,
        message: 'NURTURE_WORKBENCH_WEBHOOK_URL is not configured in environment variables.',
        action_label: 'Configure Webhook URL',
        action_hint: 'Add NURTURE_WORKBENCH_WEBHOOK_URL to your environment variables.'
      };
    }

    try {
      const startedAt = Date.now();
      const res = await fetch(prodUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Digital-Client-Nurturing-Backend/1.0' },
        body: JSON.stringify({ action: 'ping', test: true }),
        signal: AbortSignal.timeout(6000)
      });
      const durationMs = Date.now() - startedAt;

      if (res.status >= 200 && res.status < 300) {
        return {
          status: 'connected',
          label: 'Connected',
          connected: true,
          http_status: res.status,
          duration_ms: durationMs,
          endpoint: prodUrl,
          message: 'SNS Workbench production webhook is live and responsive.',
          action_label: 'Workbench Active'
        };
      }

      if (res.status === 404) {
        return {
          status: 'workflow_not_deployed',
          label: 'Workflow Not Deployed',
          connected: false,
          http_status: 404,
          duration_ms: durationMs,
          endpoint: prodUrl,
          message: 'The SNS Workbench Client Nurturing workflow is currently saved but not deployed live.',
          action_label: 'Check Workbench Deployment',
          action_hint: 'In SNS Workbench, open the Client Nurturing workflow and click "Deploy Live" (or toggle Active to ON).'
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          status: 'auth_required',
          label: 'Authentication Required',
          connected: false,
          http_status: res.status,
          duration_ms: durationMs,
          endpoint: prodUrl,
          message: 'SNS Workbench rejected the request due to missing or invalid authentication credentials.',
          action_label: 'Check Credentials'
        };
      }

      return {
        status: 'webhook_unavailable',
        label: `Webhook Unavailable (HTTP ${res.status})`,
        connected: false,
        http_status: res.status,
        duration_ms: durationMs,
        endpoint: prodUrl,
        message: `SNS Workbench returned HTTP ${res.status}.`,
        action_label: 'Inspect Webhook'
      };
    } catch (err) {
      return {
        status: 'connection_error',
        label: 'Connection Error',
        connected: false,
        http_status: null,
        endpoint: prodUrl,
        message: `Unable to reach SNS Workbench (${err.message}). Check network connectivity.`,
        action_label: 'Check Network'
      };
    }
  }

  async testNurturingWebhook(contact) {
    const targetUrl = this.getWebhookUrl({ test_mode: true });
    if (!targetUrl) {
      const error = new Error('NURTURE_WORKBENCH_WEBHOOK_URL is not configured');
      error.status = 503;
      error.errorType = 'webhook_unavailable';
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
      active_contact: testContact,
      is_test_mode: true,
      test_mode: true
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
      requestError.errorType = 'network_error';
      throw requestError;
    }

    const responseText = await response.text();
    let responseData;
    try { responseData = JSON.parse(responseText); }
    catch (_err) { responseData = responseText.slice(0, 1000); }

    const durationMs = Date.now() - startedAt;
    const is404 = response.status === 404;
    const isAuth = response.status === 401 || response.status === 403;
    const success = response.status >= 200 && response.status < 300 && responseData?.success !== false;

    console.info(`[NurturingWebhookTest] POST ${parsedTarget.host}${parsedTarget.pathname} status=${response.status} durationMs=${durationMs} success=${success}`);
    return {
      success,
      status: response.status,
      durationMs,
      target: `${parsedTarget.origin}${parsedTarget.pathname}`,
      error_type: is404 ? 'workflow_not_deployed' : isAuth ? 'auth_required' : !success ? 'webhook_unavailable' : null,
      message: is404
        ? 'SNS Workbench Client Nurturing workflow is not deployed or active (HTTP 404).'
        : isAuth
        ? 'SNS Workbench authentication required (HTTP 401/403).'
        : success
        ? 'SNS Workbench responded successfully.'
        : `SNS Workbench returned HTTP ${response.status}.`,
      action_label: is404 ? 'Check Workbench Deployment' : 'Retry Verification',
      response: responseData
    };
  }

  /**
   * Dispatches nurturing campaign payload directly to the SNS Workbench Webhook.
   * Strictly dependent on SNS Workbench workflow nodes for LLM synthesis,
   * intent classification, Google Sheets syncing, and sales handoff.
   */
  async triggerNurturingWorkflow(payload) {
    const targetUrl = this.getWebhookUrl(payload);
    if (!targetUrl) {
      const err = new Error('NURTURE_WORKBENCH_WEBHOOK_URL is not configured');
      err.status = 503;
      err.errorType = 'webhook_unavailable';
      throw err;
    }

    async function doRequest(url) {
      if (typeof fetch === 'function') {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Digital-Client-Nurturing-Backend/1.0'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(35000)
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
            timeout: 35000
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
      const err = new Error(`Unable to connect to SNS Workbench at ${targetUrl}: ${reqErr.message}`);
      err.status = 502;
      err.errorType = 'network_error';
      err.actionLabel = 'Check Network Connection';
      throw err;
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
      const err = new Error(`SNS Workbench workflow is not active or deployed at ${targetUrl} (HTTP 404). In SNS Workbench, click "Deploy Live" (or "▶ Run Workflow") to enable webhook execution.`);
      err.status = 404;
      err.errorType = 'workflow_not_deployed';
      err.actionLabel = 'Check Workbench Deployment';
      err.actionHint = 'In SNS Workbench, open the Client Nurturing workflow and click "Deploy Live" (or turn the workflow toggle Active to ON).';
      err.targetUrl = targetUrl;
      throw err;
    }

    if (status === 401 || status === 403) {
      const err = new Error(`SNS Workbench authentication required (HTTP ${status}).`);
      err.status = status;
      err.errorType = 'auth_error';
      err.actionLabel = 'Check Workbench Credentials';
      err.targetUrl = targetUrl;
      throw err;
    }

    const detail = (data && (data.message || data.error)) ? (data.message || data.error) : JSON.stringify(data);
    const err = new Error(`SNS Workbench returned HTTP ${status}: ${detail}`);
    err.status = status;
    err.errorType = 'generation_failed';
    err.actionLabel = 'Review Workflow Execution';
    err.targetUrl = targetUrl;
    throw err;
  }
}

module.exports = new WorkbenchService();
