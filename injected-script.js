// PubOptimize - Injected Script (runs in MAIN world)
// This script runs in the same context as the page and can access window.pbjs

(function() {
  'use strict';

  console.log('PubOptimize: Injected script loaded in MAIN world');

  // Unique identifier for our messages
  const MESSAGE_ID = 'PUBOPTIMIZE_PREBID_DATA';

  // Function to inspect Prebid.js configuration
  function inspectPrebid() {
    const result = {
      detected: false,
      bidders: [],
      timeout: null,
      version: null,
      errors: []
    };

    try {
      // Check if Prebid.js exists on the page
      if (typeof window.pbjs !== 'undefined' && window.pbjs) {
        result.detected = true;
        console.log('PubOptimize: Prebid.js detected in MAIN world');

        // Get Prebid version
        if (window.pbjs.version) {
          result.version = window.pbjs.version;
        }

        // Get bidders from adUnits configuration
        if (window.pbjs.adUnits && Array.isArray(window.pbjs.adUnits)) {
          const bidderSet = new Set();
          window.pbjs.adUnits.forEach(adUnit => {
            if (adUnit.bids && Array.isArray(adUnit.bids)) {
              adUnit.bids.forEach(bid => {
                if (bid.bidder) {
                  bidderSet.add(bid.bidder);
                }
              });
            }
          });
          result.bidders = Array.from(bidderSet);
        }

        // Get timeout setting
        if (window.pbjs.getConfig) {
          const config = window.pbjs.getConfig();
          if (config && config.bidderTimeout) {
            result.timeout = config.bidderTimeout;
          }
        }

        // Note: Error tracking simplified for POC
        // In production, would need more sophisticated error capture
        result.errors = [];

      } else {
        console.log('PubOptimize: Prebid.js not detected in MAIN world');
      }
    } catch (error) {
      console.error('PubOptimize: Error inspecting Prebid in MAIN world', error);
      result.errors.push(`Inspection error: ${error.message}`);
    }

    return result;
  }

  // Listen for requests from content script
  window.addEventListener('message', function(event) {
    // Security: Only respond to messages from same origin
    if (event.source !== window) {
      return;
    }

    // Check if this is a request for Prebid data
    if (event.data && event.data.type === MESSAGE_ID + '_REQUEST') {
      console.log('PubOptimize: Received request for Prebid data in MAIN world');

      // Add a small delay to allow page scripts to initialize
      // This handles cases where Prebid.js loads asynchronously
      setTimeout(() => {
        const prebidData = inspectPrebid();

        // Send response back to content script
        window.postMessage({
          type: MESSAGE_ID + '_RESPONSE',
          data: prebidData
        }, '*');

        console.log('PubOptimize: Sent Prebid data from MAIN world', prebidData);
      }, 100); // 100ms delay
    }
  });

  // Also inspect on page load and cache result
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => {
        const data = inspectPrebid();
        console.log('PubOptimize: Initial Prebid inspection in MAIN world', data);
      }, 2000);
    });
  } else {
    // Document already loaded
    setTimeout(() => {
      const data = inspectPrebid();
      console.log('PubOptimize: Initial Prebid inspection in MAIN world', data);
    }, 2000);
  }

  console.log('PubOptimize: Injected script ready to receive requests');
})();
