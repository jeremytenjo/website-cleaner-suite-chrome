// Get current domain from active tab
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const url = new URL(tabs[0].url);
  const domain = url.hostname;
  document.getElementById('domain').textContent = `Website: ${domain}`;
  loadSelectors(domain);
});

const selectorInput = document.getElementById('selectorInput');
const addBtn = document.getElementById('addBtn');
const selectorsList = document.getElementById('selectorsList');
const countDisplay = document.getElementById('count');
const clearAllBtn = document.getElementById('clearAllBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const backupStatus = document.getElementById('backupStatus');

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

// Get current domain
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const url = new URL(tabs[0].url);
  currentDomain = url.hostname;
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

  if (selectors.length === 0) {
    selectorsList.innerHTML =
      '<div class="empty-state">No selectors yet. Add one to get started!</div>';
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
      toggle.dataset.index = index;
      toggle.checked = entry.enabled;
      const slider = document.createElement('span');
      slider.className = 'toggle-slider';
      toggleLabel.append(toggle, slider);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.dataset.index = index;
      deleteBtn.textContent = 'Delete';
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

selectorInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    addSelector();
  }
});

function addSelector() {
  const selector = selectorInput.value.trim();

  if (!selector) {
    alert('Please enter a CSS selector');
    selectorInput.focus();
    return;
  }

  // Validate CSS selector (basic check)
  try {
    document.querySelectorAll(selector);
  } catch (e) {
    alert('Invalid CSS selector: ' + e.message);
    return;
  }

  chrome.storage.local.get([currentDomain], function (result) {
    let selectors = normalizeSelectors(result[currentDomain] || []);

    if (selectors.some((item) => item.selector === selector)) {
      alert('This selector is already added');
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
                const existing = document.getElementById('hide-elements-style');
                if (existing) existing.remove();

                const active = selectorsToApply.filter(
                  (s) => s.enabled && s.selector,
                );
                if (active.length === 0) return;

                const style = document.createElement('style');
                style.id = 'hide-elements-style';
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
    throw new Error('This is not a Hide Elements backup file.');
  }

  // Older Site Cleaner Suite backups used selectorsBySite instead of sites.
  const backupSites = data.sites ?? data.selectorsBySite;
  if (!backupSites || typeof backupSites !== 'object' || Array.isArray(backupSites)) {
    throw new Error('This is not a Hide Elements backup file.');
  }

  const sites = Object.create(null);
  for (const [domain, entries] of Object.entries(backupSites)) {
    if (!isWebsiteKey(domain) || !Array.isArray(entries)) {
      throw new Error(`Invalid rules for website: ${domain}`);
    }
    const seen = new Set();
    sites[domain] = entries.map((entry) => {
      const selector = typeof entry === 'string' ? entry : entry?.selector;
      if (typeof selector !== 'string' || !selector.trim()) {
        throw new Error(`Invalid selector for website: ${domain}`);
      }
      try {
        document.querySelectorAll(selector);
      } catch {
        throw new Error(`Invalid CSS selector for website: ${domain}`);
      }
      if (seen.has(selector)) {
        throw new Error(`Duplicate selector for website: ${domain}`);
      }
      seen.add(selector);
      return { selector, enabled: entry?.enabled !== false };
    });
  }
  return sites;
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
    link.download = 'hide-elements-backup.json';
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
    const imported = validateBackup(JSON.parse(await file.text()));
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
    backupStatus.textContent = `Imported ${added} new rule${added === 1 ? '' : 's'} across ${Object.keys(imported).length} website${Object.keys(imported).length === 1 ? '' : 's'}.`;
  } catch (error) {
    backupStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    importFile.value = '';
  }
});
