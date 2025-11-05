# 🚀 360 Claim Fetcher Chrome Extension - Installation & Usage Guide

This guide will help you install and use the Chrome extension to automatically fetch claim details from the 360 application.

---

## 📦 Installation Steps

### Step 1: Open Chrome Extensions Page

1. Open Google Chrome
2. Go to `chrome://extensions/`
   - Or click menu (⋮) → More Tools → Extensions

### Step 2: Enable Developer Mode

1. Toggle **"Developer mode"** ON (switch in top-right corner)
2. You'll see new buttons appear: "Load unpacked", "Pack extension", etc.

### Step 3: Load the Extension

1. Click **"Load unpacked"** button
2. Navigate to: `/Users/prakash/Downloads/360Sync/chrome-extension/`
3. Select the `chrome-extension` folder and click "Select"
4. The extension should now appear in your extensions list

### Step 4: Get the Extension ID

1. After loading, you'll see the extension card with details
2. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)
3. It's displayed under the extension name

### Step 5: Configure the Portal

1. Open `/Users/prakash/Downloads/360Sync/public/js/app.js`
2. Find line ~1542: `const EXTENSION_ID = 'YOUR_EXTENSION_ID_HERE';`
3. Replace `'YOUR_EXTENSION_ID_HERE'` with your actual extension ID (in quotes)
4. Save the file
5. Restart your server if running

### Step 6: Pin the Extension (Optional but Recommended)

1. Click the puzzle piece icon (🧩) in Chrome toolbar
2. Find "360 Claim Fetcher"
3. Click the pin icon to keep it visible

---

## ✅ Verify Installation

1. Go to your dashboard: `http://localhost:3000`
2. Upload reports and navigate to Live Monitor
3. You should see **"📋 Fetch 360"** buttons next to each claim
4. If you click one before configuring the extension ID, you'll get an installation prompt

---

## 🎯 How to Use

### Fetching Claim Details

1. **Login to 360**: Make sure you're logged into https://360-us.servify.tech/
2. **Go to Dashboard**: Open your Advance Exchange Dashboard
3. **Navigate to Live Monitor**: Click on "Live Monitor" in the sidebar
4. **Click Fetch 360**: Click the "📋 Fetch 360" button next to any claim
5. **Wait**: The extension will:
   - Open/focus the 360 tab
   - Search for the claim ID automatically
   - Extract all claim details
   - Display them in an expandable row

### What Information is Fetched

The extension automatically extracts:

- ✅ **Device Information**: Name, Brand, IMEI/Serial Number
- ✅ **Action Status**: Current status and action date
- ✅ **Service Center**: Which service center is handling the claim
- ✅ **Schedule**: Scheduled date and time slot
- ✅ **Delivery Address**: Customer name, contact, address
- ✅ **Return Address**: Service center details
- ✅ **Shipping Details**:
  - Replacement device logistics partner and AWB number
  - Return device logistics partner and AWB number
  - **Shows "⚠️ Not shipped yet" if AWB is "NA"**

### Viewing Fetched Details

1. After clicking "Fetch 360", wait for the extension to fetch data (5-10 seconds)
2. An expandable row will appear below the claim
3. Click anywhere on the row or the "Close Details" button to hide it
4. Click "Fetch 360" again to toggle the display

---

## 🔧 Troubleshooting

### Extension Not Working?

**Error: "Extension not installed"**
- Make sure you loaded the extension in `chrome://extensions/`
- Check that the extension is enabled (toggle switch is ON)
- Verify you updated `EXTENSION_ID` in `app.js`

**Error: "Failed to fetch claim details"**
- Ensure you're logged into the 360 application
- Check that the claim ID exists in 360
- Try refreshing the 360 tab and try again
- Check the Chrome DevTools Console (F12) for detailed errors

**Extension loads but doesn't search**
- Make sure you're on the correct 360 domain: `https://360-us.servify.tech/`
- The content script only runs on this domain
- Check that no pop-up blockers are preventing the tab from opening

**No data is scraped**
- The 360 UI might have changed - check the console for errors
- Verify you can manually search for the claim in 360
- The content script may need updates if the UI structure changed

### Checking Extension Logs

1. Right-click the extension icon (🧩)
2. Select "Inspect popup" (if popup is open) or go to `chrome://extensions/`
3. Click "background page" or "service worker" under your extension
4. Check the Console for error messages
5. Look for logs starting with "360 Claim Fetcher:"

### Updating the Extension

If you make changes to the extension code:

1. Go to `chrome://extensions/`
2. Find "360 Claim Fetcher"
3. Click the refresh icon (🔄) on the extension card
4. Reload your dashboard page

---

## 🛡️ Security & Permissions

### Required Permissions

- **tabs**: To open and manage 360 application tabs
- **scripting**: To inject the content script into 360 pages
- **storage**: To store extension settings (future use)
- **host_permissions**: Access to:
  - `https://360-us.servify.tech/*` (to scrape claim data)
  - `http://localhost:3000/*` (to communicate with your dashboard)

### Privacy

- The extension **only runs on 360 and localhost**
- **No data is sent to external servers**
- All data flows directly between 360 → Extension → Your Dashboard
- No tracking or analytics

---

## 📝 Advanced Configuration

### Changing the Dashboard URL

If your dashboard runs on a different port:

1. Edit `chrome-extension/manifest.json`
2. Update `host_permissions` and `externally_connectable` URLs
3. Reload the extension

### Customizing the Scraper

If the 360 UI changes:

1. Edit `chrome-extension/content-script.js`
2. Update the selectors in `scrapeClaimDetails()` function
3. Test on actual 360 pages
4. Reload the extension

---

## 🆘 Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Review the extension console logs
3. Check the browser console on your dashboard (F12)
4. Verify all installation steps were completed

---

## 🎉 You're All Set!

The 360 Claim Fetcher extension is now ready to save your operations team hours of manual work!

**Quick Test:**
1. Go to Live Monitor → Goldie Interface Failures tab
2. Click "📋 Fetch 360" on any claim
3. Watch the magic happen! ✨

