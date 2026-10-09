# Hide Elements Chrome Extension

A simple yet powerful Chrome extension that allows you to hide unwanted elements from any website persistently.

## Features

✨ **Easy to Use**

- Clean, intuitive interface for managing hidden elements
- Add CSS selectors with a single click
- Works on any website

🎯 **Persistent Hiding**

- Your hidden elements settings are saved per website
- Automatically applied when you revisit the site
- Never lose your configurations

📋 **Manage Multiple Selectors**

- Add multiple CSS selectors for a single website
- View all active selectors at a glance
- Delete individual rules anytime
- Clear all hidden elements with one click
- Export all websites' rules to a JSON backup and import them later

💾 **Local Storage**

- All data stored locally on your device
- No data sent to external servers
- Your privacy is protected

## How to Use

### Installation

1. **Load the Extension**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right corner)
   - Click "Load unpacked"
   - Select the `hide-elements-chrome-extension` folder

2. **Start Using**
   - Click the extension icon in your Chrome toolbar
   - The popup will show the current website domain
   - Start adding CSS selectors to hide elements

### Backing Up Rules

Click **Export** below **Clear All Hidden Elements** to download a JSON backup of rules for every website, including disabled rules. Click **Import** and choose that file to restore rules. Import adds missing selectors to each website and keeps existing selectors and their enabled settings. The same backup works with Site Cleaner Suite for Safari; older Site Cleaner Suite selector backups can also be imported.

### Adding Selectors

#### Method 1: Simple Class/ID

```
.advertisement      // Hide all elements with class "advertisement"
#popup-ad          // Hide element with ID "popup-ad"
```

#### Method 2: Complex Selectors

```
div.ads            // Hide divs with class "ads"
article > .header  // Hide headers inside articles
.video-player, .video-ad  // Multiple selectors (comma-separated)
```

#### Method 3: Attribute Selectors

```
[data-ad-slot]     // Hide elements with data-ad-slot attribute
a[href*="tracking"] // Hide links containing "tracking" in href
```

### Examples

**Hide YouTube Recommendations:**

```
.yt-spec-shelf-item
ytd-rich-item-renderer
```

**Hide Twitter/X Ads:**

```
[data-testid="tweet"][data-has-birdwatch]
.r-1adg3q6 // Promoted tweets
```

**Hide Blog Sidebars:**

```
.sidebar
.related-posts
.ad-section
```

## CSS Selector Cheat Sheet

| Selector   | Example        | Matches                           |
| ---------- | -------------- | --------------------------------- |
| Class      | `.banner`      | Elements with class "banner"      |
| ID         | `#modal`       | Element with ID "modal"           |
| Type       | `div`          | All div elements                  |
| Attribute  | `[data-ad]`    | Elements with data-ad attribute   |
| Descendant | `div .ad`      | .ad inside div                    |
| Child      | `div > .ad`    | .ad directly inside div           |
| Multiple   | `.ad, .banner` | Elements matching either selector |

## How It Works

1. **Storage**: Your selectors are stored per domain using Chrome's `storage.local` API
2. **Content Script**: When you visit a website, the extension injects CSS rules to hide specified elements
3. **Persistent**: Settings are automatically loaded when you revisit the site
4. **Real-time Updates**: Changes in the popup are immediately applied to the current page

## Files Structure

```
hide-elements-chrome-extension/
├── manifest.json       # Extension configuration
├── popup.html         # Popup UI
├── popup.js           # Popup logic and interaction
├── content.js         # Script that runs on websites
├── background.js      # Background service worker
└── icons/             # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Technical Details

- **Manifest Version**: 3 (Latest Chrome extension standard)
- **Permissions**:
  - `storage` - To persist your settings
  - `activeTab` - To get current website
  - `scripting` - For content script execution
  - `<all_urls>` - To work on all websites

## Tips & Tricks

💡 **Use Chrome DevTools to Find Selectors**

1. Right-click on an element → "Inspect"
2. Look at the HTML to find class names or IDs
3. Copy the selector and paste it in the extension

💡 **Test Selectors Before Adding**

1. Open DevTools Console (F12)
2. Run `document.querySelectorAll('.your-selector')`
3. If elements appear in the selection, it will work!

💡 **Be Specific**

- Use more specific selectors to avoid hiding unintended elements
- Test your selectors in DevTools first

## Privacy & Security

- ✅ No data is sent to external servers
- ✅ All settings stored locally on your device
- ✅ No tracking or analytics
- ✅ Open source and transparent

## Troubleshooting

**Selector not working?**

- Ensure the selector is valid CSS syntax
- The element might be dynamically loaded - try refreshing the page
- Use DevTools to inspect and verify the element exists

**Changes not applied?**

- Refresh the webpage
- Close and reopen the extension popup
- Check that the selector is active in the list

**Extension not showing?**

- Ensure it's loaded in `chrome://extensions/`
- The icon should appear in your toolbar

## Version History

### 1.0.0 - Initial Release

- Add and manage CSS selectors per website
- Persistent hiding across page reloads
- Clean, intuitive UI
- Local storage of settings

## Support

For issues or suggestions, check the code and make sure selectors are valid CSS.

---

Enjoy a cleaner web browsing experience! 🎉
