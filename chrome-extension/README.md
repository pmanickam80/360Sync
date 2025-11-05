# 360 Claim Fetcher Chrome Extension

This Chrome extension automatically fetches claim details from the 360 application and displays them in the Advance Exchange Dashboard.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension should now be installed and active

## Required Icons

The extension requires icon files. You can create simple icons or use placeholders:

- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

For now, you can use any small PNG images with these names, or create them online at: https://www.favicon-generator.org/

## How It Works

1. User clicks "Fetch 360 Details" button in the dashboard
2. Extension opens/focuses 360 application tab
3. Automatically searches for the claim ID
4. Scrapes claim details from the page
5. Sends data back to the dashboard
6. Dashboard displays the fetched information

## Permissions

- `tabs` - To open and manage 360 tabs
- `scripting` - To inject content scripts
- `storage` - To store extension settings
- `host_permissions` - To access 360 and localhost

## Development

The extension consists of:

- `manifest.json` - Extension configuration
- `background.js` - Service worker (coordinates messages)
- `content-script.js` - Runs on 360 pages (scrapes data)
- `popup.html` - Extension popup UI

## Troubleshooting

If the extension doesn't work:

1. Check Chrome DevTools Console for errors
2. Verify you're logged into 360 application
3. Reload the extension from `chrome://extensions/`
4. Check that the portal is running on `localhost:3000`
