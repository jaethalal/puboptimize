// PubOptimize - Background Service Worker
// This script runs in the background to handle ads.txt fetching

console.log('PubOptimize background service worker loaded');

// Function to fetch and parse ads.txt file
async function fetchAdsTxt(domain) {
  const result = {
    exists: false,
    entries: [],
    error: null,
    duplicates: []
  };

  try {
    // Construct ads.txt URL
    const adsTxtUrl = `https://${domain}/ads.txt`;
    console.log('PubOptimize: Fetching ads.txt from', adsTxtUrl);

    // Fetch ads.txt file
    const response = await fetch(adsTxtUrl);

    if (!response.ok) {
      if (response.status === 404) {
        result.error = 'ads.txt not found (404)';
      } else {
        result.error = `HTTP error: ${response.status}`;
      }
      console.log('PubOptimize: ads.txt fetch failed', result.error);
      return result;
    }

    // Parse the file
    const content = await response.text();
    result.exists = true;

    // Split by lines and process
    const lines = content.split('\n');
    const seenLines = new Set();
    const duplicateLines = new Set();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      // Check for duplicates
      if (seenLines.has(trimmedLine)) {
        duplicateLines.add(trimmedLine);
      } else {
        seenLines.add(trimmedLine);
      }

      // Parse ads.txt entry
      // Format: domain, publisherAccountID, accountType, certificateAuthorityID
      const parts = trimmedLine.split(',').map(p => p.trim());

      if (parts.length >= 3) {
        result.entries.push({
          domain: parts[0],
          publisherId: parts[1],
          accountType: parts[2],
          certAuthId: parts[3] || null,
          lineNumber: index + 1
        });
      }
    });

    result.duplicates = Array.from(duplicateLines);
    console.log('PubOptimize: ads.txt parsed successfully', {
      entryCount: result.entries.length,
      duplicateCount: result.duplicates.length
    });

  } catch (error) {
    console.error('PubOptimize: Error fetching ads.txt', error);
    result.error = `Fetch error: ${error.message}`;
  }

  return result;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchAdsTxt') {
    console.log('PubOptimize: Received request to fetch ads.txt for', request.domain);

    // Handle async fetch
    fetchAdsTxt(request.domain)
      .then(adsTxtData => {
        console.log('PubOptimize: ads.txt data collected', adsTxtData);
        sendResponse(adsTxtData);
      })
      .catch(error => {
        console.error('PubOptimize: Unexpected error in fetchAdsTxt', error);
        sendResponse({
          exists: false,
          entries: [],
          error: `Unexpected error: ${error.message}`,
          duplicates: []
        });
      });

    return true; // Keep message channel open for async response
  }
});
