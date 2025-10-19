// PubOptimize - Content Script (runs in ISOLATED world)
// This script has access to Chrome APIs and dynamically injects script into MAIN world

console.log('PubOptimize content script loaded in ISOLATED world');

// Inject script into MAIN world (page context)
function injectScriptIntoPage() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-script.js');
  script.onload = function() {
    console.log('PubOptimize: Injected script loaded into page context');
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject immediately
injectScriptIntoPage();

// Unique identifier for our messages
const MESSAGE_ID = 'PUBOPTIMIZE_PREBID_DATA';

// Cache for Prebid data
let cachedPrebidData = null;

// Listen for messages from injected script (MAIN world)
window.addEventListener('message', function(event) {
  // Security: Validate message origin
  if (event.source !== window) {
    return;
  }

  // Check if this is Prebid data from our injected script
  if (event.data && event.data.type === MESSAGE_ID + '_RESPONSE') {
    console.log('PubOptimize: Received Prebid data from MAIN world', event.data.data);
    cachedPrebidData = event.data.data;
  }
});

// Function to request Prebid data from injected script
function requestPrebidData() {
  return new Promise((resolve) => {
    // Set up one-time listener for response
    const responseHandler = function(event) {
      if (event.source !== window) {
        return;
      }

      if (event.data && event.data.type === MESSAGE_ID + '_RESPONSE') {
        window.removeEventListener('message', responseHandler);
        resolve(event.data.data);
      }
    };

    window.addEventListener('message', responseHandler);

    // Send request to injected script
    window.postMessage({
      type: MESSAGE_ID + '_REQUEST'
    }, '*');

    // Timeout after 2 seconds
    setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      if (cachedPrebidData) {
        resolve(cachedPrebidData);
      } else {
        resolve({
          detected: false,
          bidders: [],
          timeout: null,
          version: null,
          errors: ['Timeout waiting for Prebid data']
        });
      }
    }, 2000);
  });
}

// Listen for messages from popup (via Chrome API)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'inspectPrebid') {
    console.log('PubOptimize: Received request from popup to inspect Prebid');

    // Request data from injected script
    requestPrebidData()
      .then(prebidData => {
        console.log('PubOptimize: Sending Prebid data to popup', prebidData);
        sendResponse(prebidData);
      })
      .catch(error => {
        console.error('PubOptimize: Error getting Prebid data', error);
        sendResponse({
          detected: false,
          bidders: [],
          timeout: null,
          version: null,
          errors: [error.message]
        });
      });

    return true; // Keep message channel open for async response
  }
});

console.log('PubOptimize: Content script ready');
