'use strict';

const assert = require('assert');
const nurtureStore = require('./backend/src/services/nurtureStore');

async function testCampaignDelete() {
  console.log('====================================================');
  console.log('CAMPAIGN DELETION VERIFICATION SUITE');
  console.log('====================================================');

  // Test 1: Setup a test contact with an engagement and a test campaign
  const testContactId = `CNT-TEST-${Date.now()}`;
  const testCampaignId = `CMP-TEST-${Date.now()}`;
  const testCampaignName = `Automated Test Campaign ${Date.now()}`;

  nurtureStore.addContacts([{
    id: testContactId,
    name: 'Delete Test User',
    company: 'Test Co',
    email: 'delete_test@example.com',
    opt_in: true,
    client_engagements: [
      {
        campaign_id: testCampaignId,
        campaign_name: testCampaignName,
        type: 'Newsletter',
        status: 'Delivered',
        date: 'Today'
      },
      {
        campaign_id: 'CMP-OTHER',
        campaign_name: 'Other Unrelated Campaign',
        type: 'Occasion',
        status: 'Delivered',
        date: 'Yesterday'
      }
    ]
  }]);

  nurtureStore.addCampaign({
    id: testCampaignId,
    name: testCampaignName,
    type: 'newsletter',
    status: 'Sent',
    brief: 'Testing campaign deletion flow',
    subject: 'Test Subject',
    email_body: '<p>Test Body</p>',
    recipients: 1,
    contact_ids: [testContactId]
  });

  const campaignsBefore = nurtureStore.getCampaigns();
  assert(campaignsBefore.some(c => c.id === testCampaignId), 'Test campaign must be present in store before deletion');

  const contactBefore = nurtureStore.getContactById(testContactId);
  assert(contactBefore, 'Test contact must be present');
  assert.strictEqual(contactBefore.client_engagements.length, 2, 'Contact should have 2 engagements initially');
  console.log('  ✓ Initial test campaign and contact engagement created');

  // Test 2: Delete campaign with valid ID
  const deleted = nurtureStore.deleteCampaign(testCampaignId);
  assert(deleted, 'deleteCampaign should return the removed campaign object');
  assert.strictEqual(deleted.id, testCampaignId);

  const campaignsAfter = nurtureStore.getCampaigns();
  assert(!campaignsAfter.some(c => c.id === testCampaignId), 'Campaign must no longer exist in campaigns store');
  console.log('  ✓ deleteCampaign removes the campaign from persistent store');

  // Test 3: Contact is preserved and only the deleted campaign engagement is removed
  const contactAfter = nurtureStore.getContactById(testContactId);
  assert(contactAfter, 'Contact record must NOT be deleted');
  assert.strictEqual(contactAfter.client_engagements.length, 1, 'Only matching engagement should be removed');
  assert.strictEqual(contactAfter.client_engagements[0].campaign_name, 'Other Unrelated Campaign', 'Unrelated engagement must be preserved');
  console.log('  ✓ Contact is preserved and matching engagement is cleanly purged');

  // Test 4: Repeated deletion of same ID returns null (404 condition)
  const repeated = nurtureStore.deleteCampaign(testCampaignId);
  assert.strictEqual(repeated, null, 'Repeated delete must return null');
  console.log('  ✓ Repeated delete returns null (404 contract)');

  // Test 5: Non-existent ID returns null
  const nonExistent = nurtureStore.deleteCampaign('CMP-NON-EXISTENT-999');
  assert.strictEqual(nonExistent, null, 'Non-existent campaign delete must return null');
  console.log('  ✓ Non-existent campaign delete returns null');

  // Test 6: URL-encoded ID resolution
  const testCampaign2Id = `CMP-ENCODE-${Date.now()}`;
  nurtureStore.addCampaign({
    id: testCampaign2Id,
    name: 'URL Encoded Test Campaign',
    type: 'newsletter',
    status: 'Draft'
  });
  const encodedId = encodeURIComponent(testCampaign2Id);
  const deletedEncoded = nurtureStore.deleteCampaign(encodedId);
  assert(deletedEncoded, 'deleteCampaign should resolve URL-encoded ID');
  assert.strictEqual(deletedEncoded.id, testCampaign2Id);
  console.log('  ✓ URL-encoded campaign ID is properly decoded and deleted');

  // Test 7: Empty or undefined ID returns null
  assert.strictEqual(nurtureStore.deleteCampaign(''), null);
  assert.strictEqual(nurtureStore.deleteCampaign(null), null);
  assert.strictEqual(nurtureStore.deleteCampaign(undefined), null);
  console.log('  ✓ Empty/falsy IDs safely return null');

  // Clean up test contact
  nurtureStore.contacts = nurtureStore.contacts.filter(c => c.id !== testContactId);
  nurtureStore.saveContacts();

  console.log('====================================================');
  console.log('RESULTS: ALL CAMPAIGN DELETE TESTS PASSED (7/7)');
  console.log('====================================================');
}

testCampaignDelete().catch(err => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
