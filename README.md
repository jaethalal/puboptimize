# PubOptimize

A Chrome extension that audits publisher websites for ad optimization opportunities by analyzing ads.txt files and Prebid.js header bidding configurations.

## Features

- **Prebid.js Detection**: Automatically detects and analyzes Prebid.js implementations on any website
- **Bidder Analysis**: Extracts configured bidders and validates against best practices
- **ads.txt Validation**: Fetches and analyzes ads.txt files for required SSP entries
- **Color-Coded Status**: Visual indicators (PASS/WARNING/FAIL) for quick assessment
- **Actionable Recommendations**: Top 3 prioritized action items for optimization
- **Real-time Analysis**: Works on live publisher sites (Forbes, Business Insider, The Guardian, etc.)

## Installation

### Install from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/jaethalal/puboptimize.git
   cd puboptimize
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked**

5. Select the `puboptimize` directory

6. The PubOptimize icon should now appear in your Chrome toolbar

## Usage

1. Navigate to any publisher website (e.g., forbes.com, businessinsider.com)

2. Click the PubOptimize extension icon in your Chrome toolbar

3. The extension will automatically:
   - Detect Prebid.js if present
   - Extract bidder configurations
   - Fetch the site's ads.txt file
   - Analyze everything against validation rules
   - Display results with color-coded status

### Understanding the Results

**Status Indicators:**
- 🟢 **PASS** (Green): All checks pass - site is well optimized
- 🟡 **WARNING** (Yellow): Minor issues found - site functional but could be improved
- 🔴 **FAIL** (Red): Critical issues detected - blocks monetization or competition

**Validation Checks:**
- **Bidder Count**: Should have 5-12 bidders for optimal competition
- **Required Bidders**: Checks for key SSPs (AppNexus, Rubicon, PubMatic, OpenX)
- **Timeout**: Should be between 1000-3000ms
- **ads.txt**: Must exist and contain required SSP entries
- **Duplicates**: Detects duplicate ads.txt entries

**Action Items:**
- Listed by priority (🔴 critical, ⚠️ warning)
- Top 3 most important actions displayed
- Specific, actionable recommendations

## Testing

### Test Page Included

The repository includes `test-page.html` with a mock Prebid.js implementation for testing:

```bash
open test-page.html
```

Expected result: WARNING status (has 7 bidders but missing ads.txt)

### Real Publisher Sites

Test on live sites with known Prebid implementations:
- **forbes.com** - Typically shows 12+ bidders
- **businessinsider.com** - Typically shows 5+ bidders
- **theguardian.com** - Major publisher with complex setup

## Configuration

### Customizing Validation Rules

Edit `rules.json` to customize validation criteria:

```json
{
  "requiredBidders": ["appnexus", "rubicon", "pubmatic", "openx"],
  "timeoutRange": { "min": 1000, "max": 3000 },
  "requiredAdsTxtEntries": ["google.com", "rubiconproject.com", "appnexus.com", "pubmatic.com"],
  "minimumBidders": 5,
  "maximumBidders": 12
}
```

After editing, reload the extension in `chrome://extensions/` for changes to take effect.

## Architecture

PubOptimize uses a multi-world script injection pattern to access page-level JavaScript:

- **content.js** (Isolated World): Has Chrome API access, bridges communication
- **injected-script.js** (Main World): Accesses `window.pbjs` directly
- **background.js** (Service Worker): Fetches ads.txt files
- **popup.js** (Extension UI): Analyzes data and displays results

This architecture overcomes Chrome's security restrictions to inspect Prebid.js configurations while maintaining extension security.

## Development

### Debugging

**Popup Console:**
```
Right-click extension icon → Inspect popup
```

**Content Script Logs:**
```
Open DevTools on any page → Console → Filter by "PubOptimize"
```

**Background Script Logs:**
```
chrome://extensions/ → PubOptimize details → Inspect service worker
```

### Making Changes

1. Edit source files
2. Go to `chrome://extensions/`
3. Click reload icon on PubOptimize card
4. Test changes on a publisher site

## How It Works

### Multi-Method Bidder Detection

PubOptimize uses three methods to extract bidders, ensuring compatibility with different Prebid implementations:

1. **PRIMARY**: `pbjs.getBidResponses()` - Real auction data (works on production sites)
2. **FALLBACK**: `pbjs.adUnits` - Static configuration (works on test pages)
3. **SUPPLEMENTAL**: `pbjs.bidderSettings` - Additional bidder info

### ads.txt Analysis

- Fetches ads.txt from `https://domain.com/ads.txt`
- Parses entries and validates format
- Checks for required SSP domains
- Detects duplicate entries
- Case-insensitive matching

## Limitations

- Cannot run on Chrome internal pages (`chrome://`, `about:`)
- Requires page to have already loaded Prebid.js
- ads.txt must be accessible at standard location
- Some sites may block extension access to their resources

## Project Status

All 3 development phases complete:
- ✅ **Phase 1**: Foundation & smoke test
- ✅ **Phase 2**: Data collection (Prebid.js + ads.txt)
- ✅ **Phase 3**: Analysis & UI with recommendations

## Contributing

This is a weekend project/POC. Contributions welcome! See `CLAUDE.md` for technical architecture details.

## License

MIT License - see LICENSE file for details

## Author

Built with Claude Code

## Repository

https://github.com/jaethalal/puboptimize
