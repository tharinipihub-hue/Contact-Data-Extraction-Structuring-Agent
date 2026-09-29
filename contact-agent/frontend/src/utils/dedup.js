/**
 * Frontend Contact Deduplication & Merging Engine.
 * Ensures no duplicate leads appear in UI tables, kanban boards, or card views.
 */

export function normalizeName(name) {
  if (!name || name === 'Missing') return '';
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeCompany(company) {
  if (!company || company === 'Missing') return '';
  return String(company).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizePhone(phone) {
  if (!phone || phone === 'Missing') return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizeEmail(email) {
  if (!email || email === 'Missing') return '';
  const isGeneric = /^(support|info|contact|sales|investor\.relations|help|customercare|admin)@/i.test(email);
  return isGeneric ? '' : String(email).toLowerCase().trim();
}

export function namesAreCompatible(nameA, nameB) {
  if (!nameA || !nameB || nameA === 'missing' || nameB === 'missing') return true;
  if (nameA === nameB) return true;
  if (nameA.includes(nameB) || nameB.includes(nameA)) return true;
  return false;
}

export function areDuplicates(a, b) {
  const nameA = normalizeName(a.full_name || `${a.first_name || ''} ${a.last_name || ''}`);
  const nameB = normalizeName(b.full_name || `${b.first_name || ''} ${b.last_name || ''}`);

  // Disjoint different names are different people even if sharing an office phone
  if (nameA && nameB && nameA !== nameB && !nameA.includes(nameB) && !nameB.includes(nameA)) {
    return false;
  }

  // 1. Name match + compatible company
  if (nameA && nameB && namesAreCompatible(nameA, nameB)) {
    const compA = normalizeCompany(a.company);
    const compB = normalizeCompany(b.company);
    if (!compA || !compB || compA === compB || compA.includes(compB) || compB.includes(compA)) {
      return true;
    }
  }

  // 2. Personal email match
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  if (emailA && emailB && emailA === emailB && namesAreCompatible(nameA, nameB)) {
    return true;
  }

  // 3. Phone match
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  if (phoneA && phoneB && phoneA === phoneB && namesAreCompatible(nameA, nameB)) {
    return true;
  }

  return false;
}

export function mergeContacts(primary, secondary) {
  const merged = { ...primary };
  const fields = [
    'first_name', 'last_name', 'designation', 'company', 'email', 'phone',
    'address', 'city', 'state', 'country', 'sector_industry', 'linkedin_url', 'website'
  ];

  for (const f of fields) {
    const pVal = merged[f];
    const sVal = secondary[f];
    if ((!pVal || pVal === 'Missing' || pVal === '') && sVal && sVal !== 'Missing' && sVal !== '') {
      merged[f] = sVal;
    } else if (pVal && sVal && sVal !== 'Missing' && sVal.length > pVal.length) {
      if (f === 'company' && sVal.toLowerCase().includes(pVal.toLowerCase())) {
        merged[f] = sVal;
      }
    }
  }

  if ((merged.source === 'Google Sheets' || !merged.source) && secondary.source && secondary.source !== 'Google Sheets') {
    merged.source = secondary.source;
  }

  merged.duplicate_status = 'UNIQUE';
  return merged;
}

export function deduplicateContactList(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return [];
  const result = [];
  const mergedIds = new Set();

  for (let i = 0; i < contacts.length; i++) {
    const current = contacts[i];
    const currId = current.id || `${current.full_name}_${i}`;
    if (mergedIds.has(currId)) continue;

    let mergedContact = { ...current };

    for (let j = i + 1; j < contacts.length; j++) {
      const candidate = contacts[j];
      const candId = candidate.id || `${candidate.full_name}_${j}`;
      if (mergedIds.has(candId)) continue;

      if (areDuplicates(mergedContact, candidate)) {
        mergedContact = mergeContacts(mergedContact, candidate);
        mergedIds.add(candId);
      }
    }

    result.push(mergedContact);
  }

  return result;
}
