const selectorInput = document.getElementById('selectorInput');
const addBtn = document.getElementById('addBtn');
const pickBtn = document.getElementById('pickBtn');
const selectorsList = document.getElementById('selectorsList');
const countDisplay = document.getElementById('count');
const clearAllBtn = document.getElementById('clearAllBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const backupStatus = document.getElementById('backupStatus');
const fieldStatus = document.getElementById('fieldStatus');
const rulesNote = document.getElementById('rulesNote');
const domainDisplay = document.getElementById('domain');

let currentDomain = '';

function normalizeSelectors(rawSelectors) {
  return (rawSelectors || []).map((entry) => {
    if (typeof entry === 'string') {
      return { selector: entry, enabled: true };
    }
    return {
      selector: entry.selector,
      enabled: entry.enabled !== false,
    };
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  try {
    const url = new URL(tabs[0]?.url);
    if (!/^https?:$/.test(url.protocol)) throw new Error('Unsupported page');
    currentDomain = url.hostname;
    domainDisplay.textContent = currentDomain;
    domainDisplay.title = currentDomain;
    loadSelectors(currentDomain);
  } catch {
    domainDisplay.textContent = 'Unavailable on this page';
    selectorInput.disabled = true;
    addBtn.disabled = true;
    pickBtn.disabled = true;
    clearAllBtn.disabled = true;
    rulesNote.textContent = 'No website';
    selectorsList.innerHTML = '<div class="empty-state">Open a website to manage its rules.</div>';
  }
});

// Load selectors for current domain
function loadSelectors(domain) {
  chrome.storage.local.get([domain], function (result) {
    const selectors = normalizeSelectors(result[domain] || []);
    renderSelectors(selectors, domain);
  });
}

// Render the list of selectors
function renderSelectors(selectors, domain) {
  selectorsList.innerHTML = '';
  countDisplay.textContent = selectors.filter((item) => item.enabled).length;
  rulesNote.textContent = `${selectors.length} total`;
  clearAllBtn.disabled = selectors.length === 0;

  if (selectors.length === 0) {
    selectorsList.innerHTML =
      '<div class="empty-state"><strong>No rules for this website</strong>Add a selector above to hide matching elements.</div>';
    return;
  }

  selectors
    .map((entry, index) => ({ entry, index }))
    .reverse()
    .forEach(({ entry, index }) => {
      const item = document.createElement('div');
      item.className = 'selector-item';
      const selectorText = document.createElement('span');
      selectorText.className = `selector-text${entry.enabled ? '' : ' selector-disabled'}`;
      selectorText.textContent = entry.selector;

      const actions = document.createElement('div');
      actions.className = 'selector-actions';
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch';
      toggleLabel.title = 'Enable/disable selector';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'selector-toggle';
      toggle.setAttribute('aria-label', `${entry.enabled ? 'Disable' : 'Enable'} ${entry.selector}`);
      toggle.dataset.index = index;
      toggle.checked = entry.enabled;
      const slider = document.createElement('span');
      slider.className = 'toggle-slider';
      toggleLabel.append(toggle, slider);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.dataset.index = index;
      deleteBtn.textContent = 'Remove';
      deleteBtn.setAttribute('aria-label', `Remove ${entry.selector}`);
      actions.append(toggleLabel, deleteBtn);
      item.append(selectorText, actions);
      selectorsList.appendChild(item);
    });

  // Add event delegation for delete buttons
  document.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', function () {
      const index = parseInt(this.getAttribute('data-index'));
      deleteSelector(domain, index);
    });
  });

  document.querySelectorAll('.selector-toggle').forEach((toggle) => {
    toggle.addEventListener('change', function () {
      const index = parseInt(this.getAttribute('data-index'));
      toggleSelector(domain, index, this.checked);
    });
  });
}

// Add new selector
addBtn.addEventListener('click', function () {
  addSelector();
});

pickBtn.addEventListener('click', async () => {
  fieldStatus.textContent = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || new URL(tab.url).hostname !== currentDomain)
      throw new Error('Open a website to pick an element.');
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['picker.js', 'content.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
    }
    window.close();
  } catch (error) {
    fieldStatus.textContent = error.message || 'Could not start the picker on this page.';
  }
});

selectorInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    addSelector();
  }
});

function addSelector() {
  const selector = selectorInput.value.trim();
  fieldStatus.textContent = '';

  if (!selector) {
    fieldStatus.textContent = 'Enter a CSS selector first.';
    selectorInput.focus();
    return;
  }

  // Validate CSS selector (basic check)
  try {
    document.querySelectorAll(selector);
  } catch (e) {
    fieldStatus.textContent = 'That CSS selector is not valid.';
    selectorInput.focus();
    return;
  }

  chrome.storage.local.get([currentDomain], function (result) {
    let selectors = normalizeSelectors(result[currentDomain] || []);

    if (selectors.some((item) => item.selector === selector)) {
      fieldStatus.textContent = 'This selector is already in the list.';
      selectorInput.focus();
      return;
    }

    selectors.push({ selector, enabled: true });
    chrome.storage.local.set({ [currentDomain]: selectors }, function () {
      selectorInput.value = '';
      renderSelectors(selectors, currentDomain);

      // Apply to current tab
      applySelectorsToTab(selectors);
    });
  });
}

function deleteSelector(domain, index) {
  chrome.storage.local.get([domain], function (result) {
    let selectors = normalizeSelectors(result[domain] || []);
    selectors.splice(index, 1);
    chrome.storage.local.set({ [domain]: selectors }, function () {
      renderSelectors(selectors, domain);

      // Reapply selectors to current tab
      applySelectorsToTab(selectors);
    });
  });
}

function toggleSelector(domain, index, enabled) {
  chrome.storage.local.get([domain], function (result) {
    let selectors = normalizeSelectors(result[domain] || []);
    if (!selectors[index]) {
      return;
    }

    selectors[index].enabled = enabled;
    chrome.storage.local.set({ [domain]: selectors }, function () {
      renderSelectors(selectors, domain);
      applySelectorsToTab(selectors);
    });
  });
}

// Apply selectors to the current active tab
function applySelectorsToTab(selectors) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0]?.id) {
      return;
    }

    // Try message passing first (content script already injected)
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: 'applyHiding', selectors: selectors },
      () => {
        if (chrome.runtime.lastError) {
          // Content script not available — apply CSS directly via scripting API
          chrome.scripting
            .executeScript({
              target: { tabId: tabs[0].id },
              func: (selectorsToApply) => {
                const existing = document.getElementById('website-cleaner-suite-style');
                if (existing) existing.remove();

                const active = selectorsToApply.filter(
                  (s) => s.enabled && s.selector,
                );
                if (active.length === 0) return;

                const style = document.createElement('style');
                style.id = 'website-cleaner-suite-style';
                style.textContent = active
                  .map((s) => `${s.selector} { display: none !important; }`)
                  .join('\n');
                (document.head || document.documentElement).appendChild(style);
              },
              args: [selectors],
            })
            .catch(() => {
              void chrome.runtime.lastError;
            });
        }
      },
    );
  });
}

// Clear all
clearAllBtn.addEventListener('click', function () {
  if (
    confirm(
      'Are you sure you want to clear all hidden elements for this website?',
    )
  ) {
    chrome.storage.local.set({ [currentDomain]: [] }, function () {
      renderSelectors([], currentDomain);
      applySelectorsToTab([]);
    });
  }
});

function isWebsiteKey(domain) {
  try {
    return new URL(`https://${domain}/`).hostname === domain;
  } catch {
    return false;
  }
}

function validateBackup(data) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    data.version !== 1 ||
    (data.type !== undefined && data.type !== 'selectorsBySite')
  ) {
    throw new Error('This is not a Website Cleaner Suite Chrome backup file.');
  }

  // Older Site Cleaner Suite backups used selectorsBySite instead of sites.
  const backupSites = data.sites ?? data.selectorsBySite;
  if (!backupSites || typeof backupSites !== 'object' || Array.isArray(backupSites)) {
    throw new Error('This is not a Website Cleaner Suite Chrome backup file.');
  }

  const sites = Object.create(null);
  let skipped = 0;
  for (const [domain, entries] of Object.entries(backupSites)) {
    if (!isWebsiteKey(domain) || !Array.isArray(entries)) {
      throw new Error(`Invalid rules for website: ${domain}`);
    }
    const seen = new Set();
    const validRules = [];
    for (const entry of entries) {
      const selector = typeof entry === 'string' ? entry : entry?.selector;
      if (typeof selector !== 'string' || !selector.trim()) {
        throw new Error(`Invalid selector for website: ${domain}`);
      }
      try {
        document.querySelectorAll(selector);
      } catch {
        skipped++;
        continue;
      }
      if (seen.has(selector)) continue;
      seen.add(selector);
      validRules.push({ selector, enabled: entry?.enabled !== false });
    }
    if (validRules.length) sites[domain] = validRules;
  }
  return { sites, skipped };
}

exportBtn.addEventListener('click', async () => {
  try {
    const stored = await chrome.storage.local.get(null);
    const sites = Object.create(null);
    for (const [domain, entries] of Object.entries(stored)) {
      if (isWebsiteKey(domain) && Array.isArray(entries)) {
        sites[domain] = normalizeSelectors(entries);
      }
    }
    const backup = new Blob([JSON.stringify({ version: 1, sites }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(backup);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'website-cleaner-suite-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupStatus.textContent = 'Exported rules for all websites.';
  } catch (error) {
    backupStatus.textContent = `Export failed: ${error.message}`;
  }
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const { sites: imported, skipped } = validateBackup(
      JSON.parse(await file.text()),
    );
    const stored = await chrome.storage.local.get(null);
    const merged = Object.create(null);
    let added = 0;
    for (const [domain, entries] of Object.entries(imported)) {
      const existing = Array.isArray(stored[domain])
        ? normalizeSelectors(stored[domain])
        : [];
      const seen = new Set(existing.map((entry) => entry.selector));
      merged[domain] = [...existing];
      for (const entry of entries) {
        if (!seen.has(entry.selector)) {
          merged[domain].push(entry);
          seen.add(entry.selector);
          added++;
        }
      }
    }
    await chrome.storage.local.set(merged);
    if (Object.hasOwn(merged, currentDomain)) {
      renderSelectors(merged[currentDomain], currentDomain);
      applySelectorsToTab(merged[currentDomain]);
    }
    backupStatus.textContent = `Imported ${added} new rule${added === 1 ? '' : 's'} across ${Object.keys(imported).length} website${Object.keys(imported).length === 1 ? '' : 's'}.${skipped ? ` Skipped ${skipped} invalid CSS rule${skipped === 1 ? '' : 's'}.` : ''}`;
  } catch (error) {
    backupStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    importFile.value = '';
  }
});
