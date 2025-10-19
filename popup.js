// PubOptimize - Popup Script
// This script runs when the extension popup is opened

console.log('PubOptimize popup loaded successfully');
console.log('Popup opened at:', new Date().toISOString());

// State to hold collected data
let collectedData = {
  prebid: null,
  adsTxt: null,
  rules: null,
  currentDomain: null
};

// Function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('PubOptimize: Error extracting domain', error);
    return null;
  }
}

// Function to load rules from rules.json
async function loadRules() {
  try {
    const rulesUrl = chrome.runtime.getURL('rules.json');
    const response = await fetch(rulesUrl);
    const rules = await response.json();
    console.log('PubOptimize: Rules loaded', rules);
    return rules;
  } catch (error) {
    console.error('PubOptimize: Error loading rules', error);
    return null;
  }
}

// Function to get Prebid data from content script
async function getPrebidData(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: 'inspectPrebid' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('PubOptimize: Error getting Prebid data', chrome.runtime.lastError);
          resolve({ detected: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      }
    );
  });
}

// Function to get ads.txt data from background script
async function getAdsTxtData(domain) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'fetchAdsTxt', domain: domain },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('PubOptimize: Error getting ads.txt data', chrome.runtime.lastError);
          resolve({ exists: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      }
    );
  });
}

// Function to display collected data
function displayData() {
  const messageDiv = document.querySelector('.message');

  if (!messageDiv) {
    console.error('PubOptimize: Message div not found');
    return;
  }

  // Create formatted output
  let html = `<strong>Domain:</strong> ${collectedData.currentDomain}<br><br>`;

  // Prebid section
  html += `<strong>Prebid.js:</strong><br>`;
  if (collectedData.prebid) {
    if (collectedData.prebid.detected) {
      html += `✅ Detected<br>`;
      html += `Version: ${collectedData.prebid.version || 'Unknown'}<br>`;
      html += `Bidders: ${collectedData.prebid.bidders.length} (${collectedData.prebid.bidders.join(', ')})<br>`;
      html += `Timeout: ${collectedData.prebid.timeout || 'Not set'}ms<br>`;
      if (collectedData.prebid.errors.length > 0) {
        html += `⚠️ Errors: ${collectedData.prebid.errors.length}<br>`;
      }
    } else {
      html += `❌ Not detected<br>`;
    }
  } else {
    html += `⏳ Loading...<br>`;
  }

  html += `<br>`;

  // ads.txt section
  html += `<strong>ads.txt:</strong><br>`;
  if (collectedData.adsTxt) {
    if (collectedData.adsTxt.exists) {
      html += `✅ Found<br>`;
      html += `Entries: ${collectedData.adsTxt.entries.length}<br>`;
      if (collectedData.adsTxt.duplicates.length > 0) {
        html += `⚠️ Duplicates: ${collectedData.adsTxt.duplicates.length}<br>`;
      }
      // Show first few domains
      const domains = collectedData.adsTxt.entries.map(e => e.domain).slice(0, 5);
      html += `Domains: ${domains.join(', ')}${collectedData.adsTxt.entries.length > 5 ? '...' : ''}<br>`;
    } else {
      html += `❌ Not found<br>`;
      if (collectedData.adsTxt.error) {
        html += `Error: ${collectedData.adsTxt.error}<br>`;
      }
    }
  } else {
    html += `⏳ Loading...<br>`;
  }

  html += `<br>`;

  // Rules section
  html += `<strong>Rules:</strong><br>`;
  if (collectedData.rules) {
    html += `✅ Loaded<br>`;
    html += `Required bidders: ${collectedData.rules.requiredBidders.length}<br>`;
    html += `Bidder range: ${collectedData.rules.minimumBidders}-${collectedData.rules.maximumBidders}<br>`;
    html += `Timeout range: ${collectedData.rules.timeoutRange.min}-${collectedData.rules.timeoutRange.max}ms<br>`;
  } else {
    html += `⏳ Loading...<br>`;
  }

  messageDiv.innerHTML = html;

  // Log full data to console for debugging
  console.log('PubOptimize: Full collected data', collectedData);
}

// Main initialization function
async function initialize() {
  console.log('PubOptimize: Initializing data collection');

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      console.error('PubOptimize: Could not get current tab');
      document.querySelector('.message').innerHTML = '❌ Could not access current tab';
      return;
    }

    // Extract domain
    collectedData.currentDomain = extractDomain(tab.url);

    // Handle local files and special URLs
    const isLocalFile = tab.url.startsWith('file://');
    const isSpecialPage = tab.url.startsWith('chrome://') || tab.url.startsWith('about:');

    if (isSpecialPage) {
      document.querySelector('.message').innerHTML = '❌ Cannot run on browser internal pages';
      return;
    }

    if (!collectedData.currentDomain || collectedData.currentDomain === '') {
      collectedData.currentDomain = isLocalFile ? 'localhost (file://)' : 'unknown';
    }

    console.log('PubOptimize: Current domain', collectedData.currentDomain);

    // Show loading state
    document.querySelector('.message').innerHTML = '⏳ Collecting data...';

    // Load all data in parallel, but skip ads.txt for local files
    const [rulesData, prebidData, adsTxtData] = await Promise.all([
      loadRules(),
      getPrebidData(tab.id),
      isLocalFile ? Promise.resolve({ exists: false, entries: [], error: 'Skipped for local file', duplicates: [] }) : getAdsTxtData(collectedData.currentDomain)
    ]);

    collectedData.rules = rulesData;
    collectedData.prebid = prebidData;
    collectedData.adsTxt = adsTxtData;

    // Display collected data
    displayData();

  } catch (error) {
    console.error('PubOptimize: Error during initialization', error);
    document.querySelector('.message').innerHTML = `❌ Error: ${error.message}`;
  }
}

// Run initialization when popup loads
document.addEventListener('DOMContentLoaded', initialize);
