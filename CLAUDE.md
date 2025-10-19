# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PubOptimize is a Chrome extension (Manifest V3) that audits publisher websites for ad optimization opportunities by analyzing ads.txt files and Prebid.js header bidding configurations.

**Current Status:** Phase 2 complete. Extension collects data but does not yet analyze it or provide recommendations.

## Architecture: Multi-World Script Injection Pattern

This extension uses a **critical three-script architecture** to overcome Chrome's isolated world restrictions:

### 1. content.js (ISOLATED world)
- Runs in Chrome's isolated world with access to Chrome extension APIs
- **Dynamically injects** injected-script.js into page context using `createElement('script')`
- Communicates with injected-script.js via `window.postMessage()`
- Listens for messages from popup.js via `chrome.runtime.onMessage`
- Acts as bridge between MAIN world and Chrome APIs

### 2. injected-script.js (MAIN world)
- Runs in page's JavaScript context with access to `window.pbjs`
- Inspects Prebid.js configuration using **multi-method extraction**:
  - PRIMARY: `pbjs.getBidResponses()` - real auction data (works on production sites)
  - FALLBACK: `pbjs.adUnits` - static config (works on test pages)
  - SUPPLEMENTAL: `pbjs.bidderSettings` - additional bidder info
- Responds to requests via `window.postMessage()`
- Cannot access Chrome APIs

### 3. background.js (Service worker)
- Fetches ads.txt files from publisher domains
- Parses content and detects duplicates
- Responds to requests from popup.js via `chrome.runtime.onMessage`

**Critical:** Never add injected-script.js to manifest.json content_scripts array. It must be dynamically injected to run in MAIN world. Adding it to manifest causes it to run in ISOLATED world where `window.pbjs` is inaccessible.

## Development Workflow

### Loading Extension
```bash
# 1. Open Chrome and navigate to chrome://extensions/
# 2. Enable "Developer mode" (toggle in top-right)
# 3. Click "Load unpacked"
# 4. Select the puboptimize directory
# 5. After code changes, click reload icon on extension card
```

### Testing
```bash
# Test on local page with mock Prebid.js
open test-page.html

# Test on real publisher sites (verified working):
# - forbes.com (12 bidders detected)
# - businessinsider.com (5 bidders detected)
# - theguardian.com
```

### Debugging
```bash
# View popup console
# Right-click extension icon → "Inspect popup"

# View content script logs
# Open DevTools on any page → Console tab
# Filter by "PubOptimize"

# View background script logs
# chrome://extensions/ → Extension details → "Inspect service worker"

# Check message passing
# All message types use consistent naming: PUBOPTIMIZE_PREBID_DATA_REQUEST/RESPONSE
```

## Configuration

### rules.json
Defines validation criteria for audits (Phase 3 will implement comparison logic):
- `requiredBidders`: Array of bidder codes that should be present
- `timeoutRange`: {min, max} acceptable bidder timeout in ms
- `requiredAdsTxtEntries`: Array of domains that should be in ads.txt
- `minimumBidders`/`maximumBidders`: Acceptable bidder count range

Edit this file to customize audit rules without code changes.

## Message Passing Patterns

```javascript
// Popup → Content Script (inspect Prebid)
chrome.tabs.sendMessage(tabId, { action: 'inspectPrebid' }, callback)

// Content Script → Injected Script (via window.postMessage)
window.postMessage({ type: 'PUBOPTIMIZE_PREBID_DATA_REQUEST' }, '*')

// Injected Script → Content Script (via window.postMessage)
window.postMessage({ type: 'PUBOPTIMIZE_PREBID_DATA_RESPONSE', data: {...} }, '*')

// Popup → Background Script (fetch ads.txt)
chrome.runtime.sendMessage({ action: 'fetchAdsTxt', domain: 'example.com' }, callback)
```

## Phase 3 Roadmap (Not Yet Implemented)

Phase 3 will add analysis logic to popup.js:
- Compare collected Prebid bidders vs rules.json required bidders
- Validate bidder count and timeout are in acceptable ranges
- Check ads.txt contains required SSP entries
- Generate color-coded status (green/yellow/red)
- Display top 3 prioritized action items
- Update popup.html UI with findings

Current popup.js only displays raw data without analysis.

## Git Workflow

```bash
git status                    # Check uncommitted changes
git add <files>              # Stage changes
git commit -m "message"      # Commit locally
git push -u origin main      # Push to GitHub
```

Repository: https://github.com/jaethalal/puboptimize

## Common Issues

**Prebid not detected on real sites:** Fixed in latest commit using multi-method extraction. If bidders show as 0, check that page has actually run auctions (reload page and wait 2-3 seconds before opening popup).

**chrome.runtime undefined:** Means script is running in MAIN world instead of ISOLATED. Check that injected-script.js is NOT in manifest.json content_scripts array.

**Message passing timeout:** Content script waits 2 seconds for injected script response. If Prebid loads slowly, may need to increase timeout in content.js line 76.
