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

        const bidderSet = new Set();

        // METHOD 1: Extract bidders from getBidResponses() (PRIMARY - Real auction data)
        // This works best for production sites that have run auctions
        try {
          if (window.pbjs.getBidResponses && typeof window.pbjs.getBidResponses === 'function') {
            const bidResponses = window.pbjs.getBidResponses();
            if (bidResponses && typeof bidResponses === 'object') {
              Object.keys(bidResponses).forEach(adUnitCode => {
                const response = bidResponses[adUnitCode];
                if (response && response.bids && Array.isArray(response.bids)) {
                  response.bids.forEach(bid => {
                    if (bid.bidder) {
                      bidderSet.add(bid.bidder);
                    }
                    // Also try bidderCode as fallback
                    if (bid.bidderCode) {
                      bidderSet.add(bid.bidderCode);
                    }
                  });
                }
              });
              console.log('PubOptimize: Extracted bidders from getBidResponses()', Array.from(bidderSet));
            }
          }
        } catch (error) {
          console.warn('PubOptimize: Error extracting from getBidResponses()', error);
          result.errors.push(`getBidResponses error: ${error.message}`);
        }

        // METHOD 2: Extract bidders from adUnits configuration (FALLBACK - Static config)
        // This works for test pages and sites with accessible adUnits
        try {
          if (window.pbjs.adUnits && Array.isArray(window.pbjs.adUnits)) {
            window.pbjs.adUnits.forEach(adUnit => {
              if (adUnit.bids && Array.isArray(adUnit.bids)) {
                adUnit.bids.forEach(bid => {
                  if (bid.bidder) {
                    bidderSet.add(bid.bidder);
                  }
                });
              }
            });
            console.log('PubOptimize: Extracted bidders from adUnits', Array.from(bidderSet));
          }
        } catch (error) {
          console.warn('PubOptimize: Error extracting from adUnits', error);
          result.errors.push(`adUnits error: ${error.message}`);
        }

        // METHOD 3: Check bidderSettings for additional bidder info (SUPPLEMENTAL)
        try {
          if (window.pbjs.bidderSettings && typeof window.pbjs.bidderSettings === 'object') {
            Object.keys(window.pbjs.bidderSettings).forEach(bidderCode => {
              // Skip special keys like 'standard'
              if (bidderCode !== 'standard') {
                bidderSet.add(bidderCode);
              }
            });
          }
        } catch (error) {
          console.warn('PubOptimize: Error extracting from bidderSettings', error);
        }

        // Set final bidders array
        result.bidders = Array.from(bidderSet);

        // Get timeout setting
        if (window.pbjs.getConfig) {
          const config = window.pbjs.getConfig();
          if (config && config.bidderTimeout) {
            result.timeout = config.bidderTimeout;
          }
        }

        // Clear errors if we successfully extracted bidders
        if (result.bidders.length > 0 && result.errors.length > 0) {
          result.errors = [];
        }

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
