// Content script that runs on all websites
// This script injects CSS to hide elements based on saved selectors

const domain = new URL(window.location.href).hostname;
let styleElement = null;

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

// Initialize hiding on page load
function initializeHiding() {
  chrome.storage.local.get([domain], function (result) {
    const selectors = normalizeSelectors(result[domain] || []);
    applyHiding(selectors);
  });
}

// Apply hiding based on selectors
function applyHiding(selectors) {
  // Remove old style element if it exists
  if (styleElement) {
    styleElement.remove();
  }

  const activeSelectors = selectors
    .filter((entry) => entry.enabled && entry.selector)
    .map((entry) => entry.selector);

  if (activeSelectors.length === 0) {
    return;
  }

  // Create style element with all selectors
  styleElement = document.createElement('style');
  styleElement.id = 'website-cleaner-suite-style';
  styleElement.type = 'text/css';

  const css = activeSelectors
    .map((selector) => {
      return `${selector} { display: none !important; }`;
    })
    .join('\n');

  styleElement.textContent = css;

  // Insert into document head or html
  if (document.head) {
    document.head.appendChild(styleElement);
  } else if (document.documentElement) {
    document.documentElement.appendChild(styleElement);
  } else {
    // Fallback: try again after a short delay
    setTimeout(() => {
      if (document.head) {
        document.head.appendChild(styleElement);
      }
    }, 100);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'applyHiding') {
    applyHiding(normalizeSelectors(request.selectors || []));
    sendResponse({ status: 'applied' });
  } else if (request.action === 'startPicker') {
    globalThis.startElementPicker({
      save: async (selector) => {
        const result = await chrome.storage.local.get([domain]);
        const rules = normalizeSelectors(result[domain] || []);
        if (rules.some((rule) => rule.selector === selector)) return false;
        rules.push({ selector, enabled: true });
        await chrome.storage.local.set({ [domain]: rules });
        return true;
      },
      undo: async (selector) => {
        const result = await chrome.storage.local.get([domain]);
        const rules = normalizeSelectors(result[domain] || []);
        await chrome.storage.local.set({
          [domain]: rules.filter((rule) => rule.selector !== selector),
        });
      },
    });
    sendResponse({ status: 'started' });
  }
});

// Keep page in sync when storage changes (works even if popup messaging fails).
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[domain]) {
    return;
  }
  applyHiding(normalizeSelectors(changes[domain].newValue || []));
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeHiding);
} else {
  initializeHiding();
}

// Also apply when body is available (for document_start)
if (!document.body && !document.head) {
  const observer = new MutationObserver(() => {
    if (document.body || document.head) {
      initializeHiding();
      observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true });
}
