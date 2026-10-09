// Background service worker for the Website Cleaner Suite Chrome extension
// Handles storage and communication between popup and content scripts

chrome.runtime.onInstalled.addListener(() => {
  console.log('Website Cleaner Suite Chrome extension installed');
});

// Clean up storage for removed sites (optional)
chrome.tabs.onRemoved.addListener(() => {
  // Extension cleanup if needed
});
