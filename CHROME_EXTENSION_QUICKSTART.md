# 🚀 Chrome Extension Quick Setup (Production)

## Step 1: Install/Update the Extension

1. **Open Chrome Extensions Page:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

2. **If Already Installed:**
   - Find "360 Claim Fetcher" in the list
   - Click the **Reload** button (🔄) to pick up the new manifest
   - Skip to Step 2

3. **If Not Installed:**
   - Click "Load unpacked"
   - Navigate to: `/Users/prakash/Downloads/360Sync/chrome-extension/`
   - Click "Select"

## Step 2: Get Your Extension ID

After loading/reloading the extension:

1. You'll see the extension card with details
2. **Copy the Extension ID** - it looks like:
   ```
   abcdefghijklmnopqrstuvwxyz123456
   ```
3. This is displayed under the extension name

Example:
```
360 Claim Fetcher
ID: nflcnflijbghkjojnglpkgejjobihomf
```

## Step 3: Update Dashboard Configuration

You have two options:

### Option A: Update Through Dashboard (Easy)
1. Go to your production dashboard
2. Open browser console (F12)
3. Run this command with your actual extension ID:
   ```javascript
   localStorage.setItem('EXTENSION_ID', 'your-extension-id-here');
   ```
4. Reload the page

### Option B: Update Code and Redeploy
1. Open `/Users/prakash/Downloads/360Sync/public/js/app.js`
2. Find line ~1650: `const EXTENSION_ID = 'nflcnflijbghkjojnglpkgejjobihomf';`
3. Replace with your actual extension ID:
   ```javascript
   const EXTENSION_ID = 'your-actual-extension-id-here';
   ```
4. Commit and deploy:
   ```bash
   git add public/js/app.js
   git commit -m "Update Chrome extension ID for production"
   git push origin main
   ./deploy.sh
   ```

## Step 4: Test It!

1. Go to your dashboard: https://sync360-dashboard-815407754077.us-central1.run.app
2. Upload reports and navigate to Live Monitor
3. Click "📋 Fetch 360" button on any claim
4. The extension should now work! ✅

## Troubleshooting

### "Extension not installed" error
- Make sure you reloaded the extension after updating manifest.json
- Check that the extension is enabled (toggle switch is ON)
- Verify you're using Chrome (not another browser)

### Extension doesn't communicate with dashboard
- Make sure you updated the Extension ID in the dashboard
- Check browser console (F12) for error messages
- Verify the extension ID is correct (no typos)

### Extension loads but doesn't fetch data
- Make sure you're logged into https://360-us.servify.tech/
- Check that the claim ID exists in 360
- Look for errors in the extension console:
  - Go to `chrome://extensions/`
  - Click "Service Worker" under your extension
  - Check the console for errors

## Current Configuration

- **Production URL**: https://sync360-dashboard-815407754077.us-central1.run.app
- **Extension Manifest**: Updated to support production URL ✅
- **Next Step**: Get extension ID and update dashboard configuration

---

**That's it!** Once you have the extension ID configured, the "Fetch 360" feature will work perfectly! 🎉
