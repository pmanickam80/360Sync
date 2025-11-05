// Background service worker for 360 Claim Fetcher extension
console.log('360 Claim Fetcher: Background script loaded');

// Ensure service worker stays active
chrome.runtime.onStartup.addListener(() => {
    console.log('360 Claim Fetcher: Extension started');
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('360 Claim Fetcher: Extension installed/updated');
});

// Listen for messages from the portal (web page)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log('360 Claim Fetcher: External message received from', sender.url);
    console.log('360 Claim Fetcher: Request:', request);

    if (request.action === 'fetchClaim') {
        console.log('360 Claim Fetcher: Starting fetch for claim', request.claimId);

        fetchClaimFrom360(request.claimId)
            .then(data => {
                console.log('360 Claim Fetcher: Successfully fetched claim data');
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error('360 Claim Fetcher: Error fetching claim', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }

    // Unknown action
    sendResponse({ success: false, error: 'Unknown action: ' + request.action });
    return true;
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('360 Claim Fetcher: Internal message received', request);

    if (request.action === 'claimDataFetched') {
        // Forward to portal if needed
        sendResponse({ success: true });
    }
});

// Helper function to wait for tab to finish loading
async function waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
        const checkTab = async () => {
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.status === 'complete') {
                    console.log('360 Claim Fetcher: Tab finished loading');
                    resolve();
                } else {
                    console.log('360 Claim Fetcher: Tab still loading, status:', tab.status);
                    setTimeout(checkTab, 500);
                }
            } catch (error) {
                reject(error);
            }
        };
        checkTab();
    });
}

// Helper function to wait for details page to open (in any tab)
async function waitForDetailsPage(claimId, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkForDetailsPage = async () => {
            try {
                // Query for any 360 tabs
                const tabs = await chrome.tabs.query({ url: 'https://360-us.servify.tech/*' });

                console.log('360 Claim Fetcher: Checking', tabs.length, '360 tabs for details page');

                // Look for a tab with the details page URL
                for (const tab of tabs) {
                    console.log('360 Claim Fetcher: Tab', tab.id, 'URL:', tab.url);

                    if (tab.url && tab.url.includes('/view?csrid=')) {
                        console.log('360 Claim Fetcher: Found details page in tab', tab.id);
                        // Make this tab active
                        await chrome.tabs.update(tab.id, { active: true });
                        resolve(tab);
                        return;
                    }
                }

                // Not found yet, check timeout
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout waiting for details page to open'));
                } else {
                    setTimeout(checkForDetailsPage, 500);
                }
            } catch (error) {
                reject(error);
            }
        };

        checkForDetailsPage();
    });
}

// Helper function to wait for content script to be ready
async function waitForContentScript(tabId, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // Try to ping the content script
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (response && response.ready) {
                console.log('360 Claim Fetcher: Content script is ready');
                return true;
            }
        } catch (error) {
            console.log(`360 Claim Fetcher: Content script not ready yet (attempt ${i + 1}/${maxAttempts})`);

            // If we've tried a few times, try to inject the content script manually
            if (i === 5) {
                console.log('360 Claim Fetcher: Attempting to inject content script manually...');
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content-script.js']
                    });
                    console.log('360 Claim Fetcher: Content script injected manually');
                } catch (injectError) {
                    console.error('360 Claim Fetcher: Failed to inject content script:', injectError);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    throw new Error('Content script failed to load after ' + maxAttempts + ' attempts. Please refresh the 360 page.');
}

// Fetch claim data from 360 application
async function fetchClaimFrom360(claimId) {
    console.log('360 Claim Fetcher: Fetching claim', claimId);

    try {
        // Remember the current tab (portal) to return focus later
        const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const portalTab = currentTabs[0];
        console.log('360 Claim Fetcher: Portal tab ID:', portalTab.id);

        // Check if 360 tab is already open
        const tabs = await chrome.tabs.query({ url: 'https://360-us.servify.tech/*' });

        let targetTab;
        let shouldCloseTab = false;

        if (tabs.length > 0) {
            // Use existing 360 tab
            targetTab = tabs[0];
            await chrome.tabs.update(targetTab.id, { active: true });
            console.log('360 Claim Fetcher: Using existing 360 tab');
        } else {
            // Open new 360 tab
            targetTab = await chrome.tabs.create({
                url: 'https://360-us.servify.tech/servicerequests',
                active: true
            });
            shouldCloseTab = true; // Close tab we created
            console.log('360 Claim Fetcher: Created new 360 tab');
        }

        // Wait for tab to finish loading
        console.log('360 Claim Fetcher: Waiting for tab to finish loading...');
        await waitForTabLoad(targetTab.id);

        // Give the content script a moment to initialize after page load
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Wait for content script to be ready
        console.log('360 Claim Fetcher: Waiting for content script to load...');
        await waitForContentScript(targetTab.id);

        // Step 1: Send message to search for claim and click on it
        console.log('360 Claim Fetcher: Sending search message to content script...');

        try {
            const searchResponse = await chrome.tabs.sendMessage(targetTab.id, {
                action: 'searchClaim',
                claimId: claimId
            });

            console.log('360 Claim Fetcher: Search response:', searchResponse);

            if (searchResponse && searchResponse.success && searchResponse.data.willNavigate) {
                // Page will navigate, wait for it
                console.log('360 Claim Fetcher: Page will navigate, waiting for details page to open...');

                // Wait for details page to open (might be same tab or new tab)
                const detailsTab = await waitForDetailsPage(claimId);

                console.log('360 Claim Fetcher: Details page opened in tab:', detailsTab.id);

                // Update target tab to the details tab
                targetTab = detailsTab;

                // Wait a bit for page to load
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Wait for content script to be ready on new page
                await waitForContentScript(targetTab.id);

                // Step 2: Send message to scrape details from the new page
                console.log('360 Claim Fetcher: Sending scrape message to content script...');

                const scrapeResponse = await chrome.tabs.sendMessage(targetTab.id, {
                    action: 'scrapeDetails'
                });

                console.log('360 Claim Fetcher: Scrape response:', scrapeResponse);

                if (scrapeResponse && scrapeResponse.success) {
                    console.log('360 Claim Fetcher: Claim data received successfully');

                    // Return focus to the portal tab
                    console.log('360 Claim Fetcher: Returning focus to portal tab', portalTab.id);
                    await chrome.tabs.update(portalTab.id, { active: true });

                    // Close the 360 tab if we created it
                    if (shouldCloseTab) {
                        console.log('360 Claim Fetcher: Closing 360 tab', targetTab.id);
                        // Wait a moment before closing so user sees the data was fetched
                        setTimeout(() => {
                            chrome.tabs.remove(targetTab.id).catch(err => {
                                console.log('360 Claim Fetcher: Could not close tab (may already be closed):', err);
                            });
                        }, 500);
                    }

                    return scrapeResponse.data;
                } else {
                    throw new Error(scrapeResponse?.error || 'Failed to scrape claim details');
                }
            } else {
                throw new Error(searchResponse?.error || 'Failed to search for claim');
            }
        } catch (error) {
            console.error('360 Claim Fetcher: Error communicating with content script:', error);
            // Return focus to portal even on error
            try {
                await chrome.tabs.update(portalTab.id, { active: true });
            } catch (e) {
                console.error('360 Claim Fetcher: Could not return focus to portal:', e);
            }
            throw new Error(`Could not communicate with 360 page: ${error.message}. Make sure you're logged into 360.`);
        }
    } catch (error) {
        console.error('360 Claim Fetcher: Error', error);
        throw error;
    }
}

// Handle toolbar icon click
chrome.action.onClicked.addListener((tab) => {
    console.log('360 Claim Fetcher: Extension icon clicked');
    // Open popup or perform action
});
