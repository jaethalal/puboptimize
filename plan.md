# PubOptimize POC - Development Plan

## Project Overview
Chrome extension to audit publisher websites for ad optimization opportunities by analyzing ads.txt files and Prebid.js configurations.

---

## Phase 1: Foundation & Smoke Test
**Goal:** Get basic extension structure working and loadable in Chrome

### Tasks
- [ ] Create manifest.json (Manifest V3)
  - Define extension metadata (name, version, description)
  - Set up permissions (activeTab, scripting)
  - Configure popup, content scripts, background service worker
- [ ] Create popup.html
  - Simple HTML structure
  - Display "Hello World" message
  - Link to popup.js
- [ ] Create popup.js (minimal)
  - Basic script to confirm JS execution
  - Console log for debugging
- [ ] Create placeholder files
  - content.js (empty/minimal)
  - background.js (empty/minimal)

### Deliverables
- Complete extension file structure
- Extension loads in Chrome without errors
- Popup opens and displays content

### Pass Criteria
✅ Extension loads successfully in chrome://extensions/
✅ No errors in extension console
✅ Clicking extension icon opens popup
✅ "Hello World" message displays in popup

### Fail Criteria
❌ Manifest errors prevent loading
❌ Popup doesn't open when clicked
❌ Console shows JavaScript errors

**Commit checkpoint:** After successful smoke test

---

## Phase 2: Data Collection
**Goal:** Implement core data gathering from both sources (ads.txt + Prebid)

### Tasks
- [ ] Implement content.js (Prebid inspector)
  - Check if `window.pbjs` exists
  - Extract active bidders list
  - Get timeout setting
  - Capture Prebid version
  - Detect Prebid-related console errors
  - Send data to popup via message passing
- [ ] Implement background.js (ads.txt fetcher)
  - Listen for messages from popup
  - Fetch ads.txt from current domain
  - Parse ads.txt content
  - Handle 404/network errors gracefully
  - Return parsed data to popup
- [ ] Create rules.json
  - Define `requiredBidders` array
  - Set `timeoutRange` (min/max)
  - List `requiredAdsTxtEntries`
  - Set `minimumBidders` and `maximumBidders`
  - Add inline comments for clarity
- [ ] Update popup.js
  - Request data from content.js
  - Request ads.txt from background.js
  - Log collected data to console
  - Display raw data in popup (temporary, for testing)

### Deliverables
- Functional content script that inspects Prebid
- Background worker that fetches ads.txt
- Configurable rules.json
- Data successfully flows to popup

### Pass Criteria
✅ Content script detects Prebid.js on test publisher site
✅ Background script fetches ads.txt successfully
✅ Both data sources logged to browser console
✅ Rules.json loads without errors
✅ Popup displays raw collected data

### Fail Criteria
❌ Content script doesn't detect Prebid when present
❌ Ads.txt fetch fails on valid domains
❌ Message passing between scripts fails
❌ Rules.json has syntax errors

**Commit checkpoint:** After successful data collection

---

## Phase 3: Analysis & UI
**Goal:** Analyze collected data against rules and present audit report

### Tasks
- [ ] Implement analysis logic in popup.js
  - **Ads.txt analysis:**
    - Check file exists and is accessible
    - Verify required SSP entries present
    - Detect duplicate lines
    - Generate pass/warning/fail status
  - **Prebid analysis:**
    - Verify Prebid.js detected
    - Check bidder count within range (min-max)
    - Validate timeout within acceptable range
    - Check for console errors
    - Generate pass/warning/fail status
  - Calculate overall status (PASS/WARNING/FAIL)
  - Generate top 3 action items
- [ ] Build audit report UI (popup.html + popup.js)
  - Overall status banner (color-coded: green/yellow/red)
  - Ads.txt section with status icon and findings
  - Prebid section with status icon, bidder count, timeout
  - Top 3 action items list (prioritized recommendations)
  - Collapsible details section (optional, for debugging)
- [ ] Add CSS styling (popup.css or inline)
  - Color coding: green (✅ pass), yellow (⚠️ warning), red (❌ fail)
  - Clean, readable layout
  - Icons/emojis for status indicators
- [ ] Create README.md
  - Installation instructions (load unpacked extension)
  - Usage instructions (visit publisher site, click icon)
  - How to edit rules.json
  - Troubleshooting tips
- [ ] Testing & refinement
  - Test on 2-3 real publisher sites
  - Verify edge cases (no Prebid, missing ads.txt)
  - Ensure graceful error handling
  - Confirm action items are helpful

### Deliverables
- Complete analysis engine
- Polished popup UI with color-coded results
- README with clear instructions
- Tested on real publisher sites

### Pass Criteria
✅ Extension analyzes both ads.txt and Prebid correctly
✅ Overall status accurately reflects findings (PASS/WARNING/FAIL)
✅ UI is readable and color-coded appropriately
✅ Top 3 action items are relevant and prioritized
✅ Works on at least 2 different publisher sites
✅ Handles missing ads.txt gracefully (doesn't crash)
✅ Handles missing Prebid gracefully (doesn't crash)
✅ README instructions are clear and complete

### Fail Criteria
❌ Analysis logic produces incorrect results
❌ UI doesn't update with analysis results
❌ Extension crashes on edge cases
❌ Action items are generic or unhelpful
❌ README missing critical installation steps

**Commit checkpoint:** After successful end-to-end testing

---

## Success Metrics (Overall POC)
- Extension loads and runs without crashes
- Correctly identifies ads.txt issues on test sites
- Correctly identifies Prebid configuration issues
- Provides at least 3 actionable recommendations
- 70% accuracy on known test cases (POC quality acceptable)
- Can be loaded and used by non-technical stakeholder for demo

---

## Out of Scope (Future Iterations)
- Production-grade error handling
- Performance optimization
- Cross-browser support (Firefox, Safari)
- Automated testing suite
- Security hardening
- Analytics/telemetry
- Multi-language support
- Advanced Prebid checks (bid adapter versions, price floors, etc.)
- Historical tracking of audit results
- Export/sharing audit reports
