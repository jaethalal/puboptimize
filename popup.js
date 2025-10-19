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

// Function to analyze collected data against rules
function analyzeData() {
  if (!collectedData.prebid || !collectedData.adsTxt || !collectedData.rules) {
    return null; // Not ready yet
  }

  const analysis = {
    overallStatus: 'PASS', // PASS, WARNING, or FAIL
    prebid: {
      status: 'PASS',
      issues: [],
      checks: {
        detected: false,
        bidderCount: { pass: false, actual: 0, expected: '' },
        requiredBidders: { pass: false, missing: [] },
        timeout: { pass: false, actual: 0, expected: '' }
      }
    },
    adsTxt: {
      status: 'PASS',
      issues: [],
      checks: {
        exists: false,
        requiredEntries: { pass: false, missing: [] },
        duplicates: { pass: true, count: 0 }
      }
    },
    actionItems: []
  };

  // === PREBID ANALYSIS ===
  if (!collectedData.prebid.detected) {
    analysis.prebid.status = 'FAIL';
    analysis.prebid.issues.push('Prebid.js not detected on this page');
    analysis.actionItems.push({
      priority: 1,
      type: 'CRITICAL',
      message: 'Install Prebid.js to enable header bidding'
    });
  } else {
    analysis.prebid.checks.detected = true;
    const bidderCount = collectedData.prebid.bidders.length;
    const rules = collectedData.rules;

    // Check bidder count
    analysis.prebid.checks.bidderCount.actual = bidderCount;
    analysis.prebid.checks.bidderCount.expected = `${rules.minimumBidders}-${rules.maximumBidders}`;

    if (bidderCount < rules.minimumBidders) {
      analysis.prebid.status = 'FAIL';
      analysis.prebid.checks.bidderCount.pass = false;
      analysis.prebid.issues.push(`Only ${bidderCount} bidders (minimum: ${rules.minimumBidders})`);
      analysis.actionItems.push({
        priority: 1,
        type: 'CRITICAL',
        message: `Add ${rules.minimumBidders - bidderCount} more bidder${rules.minimumBidders - bidderCount > 1 ? 's' : ''} for healthy competition`
      });
    } else if (bidderCount > rules.maximumBidders) {
      analysis.prebid.status = 'WARNING';
      analysis.prebid.checks.bidderCount.pass = false;
      analysis.prebid.issues.push(`Too many bidders (${bidderCount}, maximum: ${rules.maximumBidders})`);
      analysis.actionItems.push({
        priority: 2,
        type: 'WARNING',
        message: `Remove ${bidderCount - rules.maximumBidders} bidder${bidderCount - rules.maximumBidders > 1 ? 's' : ''} to improve page performance`
      });
    } else {
      analysis.prebid.checks.bidderCount.pass = true;
    }

    // Check required bidders
    const detectedBidders = collectedData.prebid.bidders;
    const missingBidders = rules.requiredBidders.filter(
      required => !detectedBidders.includes(required)
    );

    analysis.prebid.checks.requiredBidders.missing = missingBidders;

    if (missingBidders.length > 0) {
      if (analysis.prebid.status === 'PASS') {
        analysis.prebid.status = 'WARNING';
      }
      analysis.prebid.checks.requiredBidders.pass = false;
      analysis.prebid.issues.push(`Missing recommended bidders: ${missingBidders.join(', ')}`);
      analysis.actionItems.push({
        priority: 2,
        type: 'WARNING',
        message: `Add recommended bidders: ${missingBidders.join(', ')}`
      });
    } else {
      analysis.prebid.checks.requiredBidders.pass = true;
    }

    // Check timeout
    const timeout = collectedData.prebid.timeout;
    analysis.prebid.checks.timeout.actual = timeout || 0;
    analysis.prebid.checks.timeout.expected = `${rules.timeoutRange.min}-${rules.timeoutRange.max}ms`;

    if (timeout && (timeout < rules.timeoutRange.min || timeout > rules.timeoutRange.max)) {
      if (analysis.prebid.status === 'PASS') {
        analysis.prebid.status = 'WARNING';
      }
      analysis.prebid.checks.timeout.pass = false;
      const recommendation = timeout < rules.timeoutRange.min
        ? `increase to ${rules.timeoutRange.min}ms`
        : `reduce to ${rules.timeoutRange.max}ms`;
      analysis.prebid.issues.push(`Timeout ${timeout}ms is outside recommended range`);
      analysis.actionItems.push({
        priority: 3,
        type: 'WARNING',
        message: `Adjust bidder timeout to ${rules.timeoutRange.min}-${rules.timeoutRange.max}ms (currently ${timeout}ms)`
      });
    } else if (timeout) {
      analysis.prebid.checks.timeout.pass = true;
    }
  }

  // === ADS.TXT ANALYSIS ===
  if (!collectedData.adsTxt.exists) {
    analysis.adsTxt.status = 'FAIL';
    analysis.adsTxt.issues.push('ads.txt file not found');
    analysis.actionItems.push({
      priority: 1,
      type: 'CRITICAL',
      message: 'Create ads.txt file to prevent unauthorized ad inventory sales'
    });
  } else {
    analysis.adsTxt.checks.exists = true;
    const adsTxtDomains = collectedData.adsTxt.entries.map(e => e.domain.toLowerCase());
    const missingEntries = collectedData.rules.requiredAdsTxtEntries.filter(
      required => !adsTxtDomains.includes(required.toLowerCase())
    );

    analysis.adsTxt.checks.requiredEntries.missing = missingEntries;

    if (missingEntries.length > 0) {
      if (analysis.adsTxt.status === 'PASS') {
        analysis.adsTxt.status = 'WARNING';
      }
      analysis.adsTxt.checks.requiredEntries.pass = false;
      analysis.adsTxt.issues.push(`Missing critical SSP entries: ${missingEntries.join(', ')}`);
      analysis.actionItems.push({
        priority: 2,
        type: 'WARNING',
        message: `Add to ads.txt: ${missingEntries.join(', ')}`
      });
    } else {
      analysis.adsTxt.checks.requiredEntries.pass = true;
    }

    // Check duplicates
    if (collectedData.adsTxt.duplicates.length > 0) {
      analysis.adsTxt.checks.duplicates.pass = false;
      analysis.adsTxt.checks.duplicates.count = collectedData.adsTxt.duplicates.length;
      if (analysis.adsTxt.status === 'PASS') {
        analysis.adsTxt.status = 'WARNING';
      }
      analysis.adsTxt.issues.push(`${collectedData.adsTxt.duplicates.length} duplicate entries found`);
      analysis.actionItems.push({
        priority: 3,
        type: 'WARNING',
        message: `Remove ${collectedData.adsTxt.duplicates.length} duplicate ads.txt entries`
      });
    }
  }

  // Calculate overall status
  if (analysis.prebid.status === 'FAIL' || analysis.adsTxt.status === 'FAIL') {
    analysis.overallStatus = 'FAIL';
  } else if (analysis.prebid.status === 'WARNING' || analysis.adsTxt.status === 'WARNING') {
    analysis.overallStatus = 'WARNING';
  }

  // Sort and limit action items to top 3
  analysis.actionItems.sort((a, b) => a.priority - b.priority);
  analysis.actionItems = analysis.actionItems.slice(0, 3);

  return analysis;
}

// Function to display collected data with analysis
function displayData() {
  const messageDiv = document.querySelector('.message');

  if (!messageDiv) {
    console.error('PubOptimize: Message div not found');
    return;
  }

  // Perform analysis
  const analysis = analyzeData();

  if (!analysis) {
    // Data still loading
    messageDiv.innerHTML = '⏳ Collecting data...';
    return;
  }

  // Create formatted output with analysis
  let html = '';

  // Overall status banner
  const statusEmoji = {
    'PASS': '✅',
    'WARNING': '⚠️',
    'FAIL': '❌'
  };
  const statusColor = {
    'PASS': '#28a745',
    'WARNING': '#ffc107',
    'FAIL': '#dc3545'
  };

  html += `<div style="padding: 15px; background: ${statusColor[analysis.overallStatus]}; color: white; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; font-size: 16px;">`;
  html += `${statusEmoji[analysis.overallStatus]} ${analysis.overallStatus}`;
  html += `</div>`;

  // Domain
  html += `<strong>Domain:</strong> ${collectedData.currentDomain}<br><br>`;

  // === TOP 3 ACTION ITEMS ===
  if (analysis.actionItems.length > 0) {
    html += `<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-bottom: 20px; border-radius: 4px;">`;
    html += `<strong style="color: #856404;">Top Priority Actions:</strong><br>`;
    analysis.actionItems.forEach((item, index) => {
      const icon = item.type === 'CRITICAL' ? '🔴' : '⚠️';
      html += `${index + 1}. ${icon} ${item.message}<br>`;
    });
    html += `</div>`;
  }

  // === PREBID SECTION ===
  const prebidStatusColor = statusColor[analysis.prebid.status];
  html += `<div style="border-left: 4px solid ${prebidStatusColor}; padding-left: 12px; margin-bottom: 15px;">`;
  html += `<strong>Prebid.js:</strong> ${statusEmoji[analysis.prebid.status]}<br>`;

  if (collectedData.prebid.detected) {
    html += `Version: ${collectedData.prebid.version || 'Unknown'}<br>`;
    html += `Bidders: ${collectedData.prebid.bidders.length} `;
    html += `${analysis.prebid.checks.bidderCount.pass ? '✅' : '❌'}<br>`;
    html += `Timeout: ${collectedData.prebid.timeout || 'Not set'}ms `;
    html += `${analysis.prebid.checks.timeout.pass ? '✅' : '⚠️'}<br>`;

    if (analysis.prebid.issues.length > 0) {
      html += `<br><span style="color: #856404;">Issues:</span><br>`;
      analysis.prebid.issues.forEach(issue => {
        html += `• ${issue}<br>`;
      });
    }
  } else {
    html += `❌ Not detected<br>`;
  }
  html += `</div>`;

  // === ADS.TXT SECTION ===
  const adsTxtStatusColor = statusColor[analysis.adsTxt.status];
  html += `<div style="border-left: 4px solid ${adsTxtStatusColor}; padding-left: 12px; margin-bottom: 15px;">`;
  html += `<strong>ads.txt:</strong> ${statusEmoji[analysis.adsTxt.status]}<br>`;

  if (collectedData.adsTxt.exists) {
    html += `Entries: ${collectedData.adsTxt.entries.length}<br>`;
    html += `Required SSPs: ${analysis.adsTxt.checks.requiredEntries.pass ? '✅' : '⚠️'}<br>`;

    if (collectedData.adsTxt.duplicates.length > 0) {
      html += `Duplicates: ${collectedData.adsTxt.duplicates.length} ⚠️<br>`;
    }

    if (analysis.adsTxt.issues.length > 0) {
      html += `<br><span style="color: #856404;">Issues:</span><br>`;
      analysis.adsTxt.issues.forEach(issue => {
        html += `• ${issue}<br>`;
      });
    }
  } else {
    html += `❌ Not found<br>`;
    if (collectedData.adsTxt.error && !collectedData.adsTxt.error.includes('Skipped')) {
      html += `Error: ${collectedData.adsTxt.error}<br>`;
    }
  }
  html += `</div>`;

  messageDiv.innerHTML = html;

  // Log full data to console for debugging
  console.log('PubOptimize: Full collected data', collectedData);
  console.log('PubOptimize: Analysis results', analysis);
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
