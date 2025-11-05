// Content script that runs on 360 application pages
console.log('360 Claim Fetcher: Content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('360 Claim Fetcher: Received message', request);

    // Respond to ping messages (used to check if content script is ready)
    if (request.action === 'ping') {
        console.log('360 Claim Fetcher: Ping received, responding with ready status');
        sendResponse({ success: true, ready: true });
        return true;
    }

    if (request.action === 'searchClaim') {
        searchAndFetchClaim(request.claimId)
            .then(data => {
                console.log('360 Claim Fetcher: Search complete', data);
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error('360 Claim Fetcher: Error fetching claim', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'scrapeDetails') {
        scrapeClaimDetails()
            .then(claimData => {
                console.log('360 Claim Fetcher: Details scraped', claimData);
                sendResponse({ success: true, data: claimData });
            })
            .catch(error => {
                console.error('360 Claim Fetcher: Error scraping details', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// Search for claim ID and fetch details
async function searchAndFetchClaim(claimId) {
    console.log('360 Claim Fetcher: Searching for claim', claimId);

    // Check if we're already on a claim details page
    if (window.location.href.includes('/view?csrid=')) {
        console.log('360 Claim Fetcher: Already on claim details page, navigating back to search...');
        window.location.href = 'https://360-us.servify.tech/servicerequests';
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Check if we're on the service requests page
    if (!window.location.href.includes('servicerequests')) {
        // Navigate to service requests page
        window.location.href = 'https://360-us.servify.tech/servicerequests';

        // Wait for page load and retry
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                performSearch(claimId)
                    .then(data => resolve(data))
                    .catch(err => reject(err));
            }, 2000);
        });
    }

    // Perform search
    return performSearch(claimId);
}

// Perform the actual search
async function performSearch(claimId) {
    console.log('360 Claim Fetcher: Starting search for claim:', claimId);

    // Find the Reference ID input field by finding the label first
    let refIdInput = null;

    // Method 1: Find label with text "Reference ID" and get associated input
    const labels = Array.from(document.querySelectorAll('label.input__label'));
    const refIdLabel = labels.find(label => label.textContent.trim() === 'Reference ID');

    if (refIdLabel) {
        console.log('360 Claim Fetcher: Found Reference ID label');
        // Try to find input by label's 'for' attribute
        if (refIdLabel.htmlFor) {
            refIdInput = document.getElementById(refIdLabel.htmlFor);
        }

        // If not found, look for input near the label (sibling or parent's sibling)
        if (!refIdInput) {
            refIdInput = refIdLabel.nextElementSibling?.querySelector('input') ||
                        refIdLabel.parentElement?.querySelector('input') ||
                        refIdLabel.closest('div')?.querySelector('input');
        }
    }

    // Fallback to other methods
    if (!refIdInput) {
        refIdInput = document.querySelector('input[placeholder*="Reference ID"]') ||
                    document.querySelector('input[placeholder*="reference"]') ||
                    document.querySelector('input[name*="reference"]');
    }

    console.log('360 Claim Fetcher: Reference ID input found?', !!refIdInput);
    if (!refIdInput) {
        console.error('360 Claim Fetcher: Available inputs:', document.querySelectorAll('input'));
        console.error('360 Claim Fetcher: Available labels:', document.querySelectorAll('label'));
        throw new Error('Reference ID input field not found');
    }

    console.log('360 Claim Fetcher: Input element:', refIdInput);

    // Clear existing value and enter claim ID
    console.log('360 Claim Fetcher: Entering claim ID into input field');

    // Clear the field first
    refIdInput.focus();
    refIdInput.select();
    document.execCommand('delete', false);

    // Get the native setter to bypass React's control
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

    // Type each character to simulate real user input
    for (let i = 0; i < claimId.length; i++) {
        const char = claimId[i];
        const currentValue = refIdInput.value + char;

        // Set the value using native setter
        nativeInputValueSetter.call(refIdInput, currentValue);

        // Trigger input event for each character
        refIdInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Final change event
    refIdInput.dispatchEvent(new Event('change', { bubbles: true }));
    refIdInput.blur();

    console.log('360 Claim Fetcher: Input value set to:', refIdInput.value);

    // Find and click search button
    await new Promise(resolve => setTimeout(resolve, 500));

    const searchButton = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.textContent.trim().toLowerCase().includes('search')
    );

    console.log('360 Claim Fetcher: Search button found?', !!searchButton);
    if (searchButton) {
        console.log('360 Claim Fetcher: Clicking search button');
        searchButton.click();
    } else {
        console.error('360 Claim Fetcher: Available buttons:',
            Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
        );
    }

    // Wait for results to load - increased timeout
    console.log('360 Claim Fetcher: Waiting for search results...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if claim row exists
    const allRows = Array.from(document.querySelectorAll('tr'));
    console.log('360 Claim Fetcher: Found', allRows.length, 'table rows');

    const claimRow = allRows.find(row => row.textContent.includes(claimId));
    console.log('360 Claim Fetcher: Claim row found?', !!claimRow);

    if (!claimRow) {
        console.error('360 Claim Fetcher: Search results:',
            allRows.slice(0, 5).map(r => r.textContent.substring(0, 100))
        );
        throw new Error(`Claim ${claimId} not found in search results. The claim may not exist in 360.`);
    }

    // Click on the claim row to open details
    const claimLink = claimRow.querySelector('a') || claimRow;
    claimLink.click();
    console.log('360 Claim Fetcher: Claim row clicked');

    // Return a special response indicating the page will navigate
    // The background script will wait for navigation and then scrape
    return { willNavigate: true };
}

// Scrape claim details from the current page
async function scrapeClaimDetails() {
    console.log('360 Claim Fetcher: Scraping claim details');

    const data = {
        referenceId: '',
        deviceInfo: {},
        actionStatus: '',
        actionDate: '',
        serviceCenter: '',
        schedule: {},
        deliveryAddress: {},
        returnAddress: {},
        shippingDetails: {},
        scrapedAt: new Date().toISOString()
    };

    // Extract Reference ID from top header (e.g., #TNJF9NHSL0DS)
    const pageText = document.body.textContent;
    const refIdMatch = pageText.match(/#([A-Z0-9]{12})/);
    if (refIdMatch) {
        data.referenceId = refIdMatch[1];
        console.log('360 Claim Fetcher: Found Reference ID:', data.referenceId);
    }

    // Extract Service Center from top header - be more specific to avoid garbage
    const serviceCenterMatch = pageText.match(/Service Center\s*:\s*([A-Za-z0-9\s\-]+?)(?:Request Scheduled|Action Status|\n)/);
    if (serviceCenterMatch) {
        data.serviceCenter = serviceCenterMatch[1].trim();
        console.log('360 Claim Fetcher: Found Service Center:', data.serviceCenter);
    }

    // Extract Action Status - only capture until the next keyword
    const actionStatusMatch = pageText.match(/Action Status\s*:\s*([A-Za-z\s]+?)(?:Action taken|Next Steps|\n)/);
    if (actionStatusMatch) {
        data.actionStatus = actionStatusMatch[1].trim();
        console.log('360 Claim Fetcher: Found Action Status:', data.actionStatus);
    }

    // Extract Action Date - only capture the date portion
    const actionDateMatch = pageText.match(/Action taken\s*:\s*On\s+([\d\-]+\s+[\d:]+\s+\([A-Z]+\))/);
    if (actionDateMatch) {
        data.actionDate = actionDateMatch[1].trim();
        console.log('360 Claim Fetcher: Found Action Date:', data.actionDate);
    }

    // Extract Schedule from top left area
    const scheduleMatch = pageText.match(/Request Scheduled for\s+([\d\-]+\s+\([A-Z]+\))/);
    if (scheduleMatch) {
        data.schedule.date = scheduleMatch[1];
        console.log('360 Claim Fetcher: Found Schedule Date:', data.schedule.date);
    }

    // Extract Slot - be more specific
    const slotMatch = pageText.match(/Slot\s*[-:]\s*([\d:]+\s+[ap]m\s+\([A-Z]+\)\s*-\s*[\d:]+\s+[ap]m\s+\([A-Z]+\))/i);
    if (slotMatch && slotMatch[1].trim() !== '-') {
        data.schedule.slot = slotMatch[1].trim();
        console.log('360 Claim Fetcher: Found Slot:', data.schedule.slot);
    }

    // Click on Replacement Details tab to get NEW device info (what we're shipping)
    const replacementTabClicked = await clickTab('Replacement Details');
    if (replacementTabClicked) {
        console.log('360 Claim Fetcher: Waiting 3 seconds for Replacement Details content to load...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for tab content to load

        // Extract NEW device info (the replacement device we're shipping)
        const pageContent = document.body.textContent;

        // Debug: Show a snippet of what we're trying to match
        const replacementSection = pageContent.substring(pageContent.indexOf('Replacement Details'), pageContent.indexOf('Replacement Details') + 500);
        console.log('360 Claim Fetcher: Replacement Details section:', replacementSection);

        // Extract New Device Name (no space between label and value!)
        const nameMatch = pageContent.match(/New Device Name([^N]+?)(?=New Device Brand|Old Device Brand|Replacement Price)/);
        data.deviceInfo.name = nameMatch ? nameMatch[1].trim() : 'N/A';
        console.log('360 Claim Fetcher: Name match result:', nameMatch);

        // Extract New Device Brand
        const brandMatch = pageContent.match(/New Device Brand([^N]+?)(?=New Device IMEI|Old Device IMEI)/);
        data.deviceInfo.brand = brandMatch ? brandMatch[1].trim() : 'N/A';
        console.log('360 Claim Fetcher: Brand match result:', brandMatch);

        // Extract New Device IMEI
        const imeiMatch = pageContent.match(/New Device IMEI \/ Serial Number([^R]+?)(?=Replacement Price|Model Number)/);
        data.deviceInfo.imei = imeiMatch ? imeiMatch[1].trim() : 'N/A';
        console.log('360 Claim Fetcher: IMEI match result:', imeiMatch);

        console.log('360 Claim Fetcher: Device Info (Replacement):', data.deviceInfo);
    } else {
        console.log('360 Claim Fetcher: Could not find Replacement Details tab, skipping device info');
    }

    // Click on Add Shipment Details tab to get delivery address and AWB info
    const shipmentTabClicked = await clickTab('Add Shipment Details');
    if (shipmentTabClicked) {
        console.log('360 Claim Fetcher: Waiting 3 seconds for Shipment Details content to load...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for tab content to load
    } else {
        console.log('360 Claim Fetcher: Could not find Add Shipment Details tab, skipping shipping info');
    }

    // Extract Delivery Address and Shipping Details from the Shipment Details tab
    if (shipmentTabClicked) {
        const pageContent = document.body.textContent;

        // Debug: Show a snippet of the shipment section
        const shipmentSection = pageContent.substring(pageContent.indexOf('Delivery Address'), pageContent.indexOf('Delivery Address') + 800);
        console.log('360 Claim Fetcher: Shipment section:', shipmentSection);

        // Extract Delivery Address (may have optional spaces between labels and values)
        // Use .+? instead of [^X]+? to allow any character including letters that might be in the field name
        const deliveryNameMatch = pageContent.match(/Delivery Address\s*\(Customer\/Enterprise\)\s*Name\s*(.+?)(?=Contact Number)/);
        const deliveryContactMatch = pageContent.match(/Contact Number\s*(.+?)(?=Address.*Return Address)/);
        const deliveryAddressMatch = pageContent.match(/Delivery Address[^)]*\)[^A]*Address\s*(.+?)(?=Return Address)/);


        console.log('360 Claim Fetcher: Delivery name match:', deliveryNameMatch);
        console.log('360 Claim Fetcher: Delivery contact match:', deliveryContactMatch);
        console.log('360 Claim Fetcher: Delivery address match:', deliveryAddressMatch);

        if (deliveryNameMatch || deliveryContactMatch || deliveryAddressMatch) {
            data.deliveryAddress = {
                name: deliveryNameMatch ? deliveryNameMatch[1].trim() : 'N/A',
                contact: deliveryContactMatch ? deliveryContactMatch[1].trim() : 'N/A',
                address: deliveryAddressMatch ? deliveryAddressMatch[1].trim() : 'N/A'
            };
            console.log('360 Claim Fetcher: Delivery Address:', data.deliveryAddress);
        }

        // Extract Return Address (may have optional spaces)
        // Use .+? to allow any character in the values
        const returnNameMatch = pageContent.match(/Return Address[^N]*Name\s*(.+?)(?=Contact Number)/);
        const returnContactMatch = pageContent.match(/Return Address.*Contact Number\s*(.+?)(?=Address.*Shipping Details)/);
        const returnAddressMatch = pageContent.match(/Return Address.*Address\s*(.+?)(?=Shipping Details)/);

        if (returnNameMatch || returnContactMatch || returnAddressMatch) {
            data.returnAddress = {
                name: returnNameMatch ? returnNameMatch[1].trim() : 'N/A',
                contact: returnContactMatch ? returnContactMatch[1].trim() : 'N/A',
                address: returnAddressMatch ? returnAddressMatch[1].trim() : 'N/A'
            };
            console.log('360 Claim Fetcher: Return Address:', data.returnAddress);
        }

        // Extract Shipping Details (AWB numbers)
        data.shippingDetails = extractShippingDetails();
    } else {
        console.log('360 Claim Fetcher: Shipment tab not clicked, no shipping data available');
    }

    console.log('360 Claim Fetcher: Final scraped data', data);
    return data;
}

// Helper function to click on a tab
async function clickTab(tabName) {
    console.log('360 Claim Fetcher: Looking for tab:', tabName);

    // Only look for actual tab elements (a, button, or elements with tab classes)
    const tabs = Array.from(document.querySelectorAll('a.tab-buttons, button.tab-buttons, a[id*="_tab"], button[id*="_tab"], a.btn, button.btn'));

    console.log('360 Claim Fetcher: Found', tabs.length, 'potential tab elements');

    // Find tab by exact text match
    let tab = tabs.find(el => el.textContent.trim() === tabName);

    // If not found, try partial match but ensure it's short text (not the whole page)
    if (!tab) {
        tab = tabs.find(el => {
            const text = el.textContent.trim();
            return text.includes(tabName) && text.length < 100; // Avoid matching giant containers
        });
    }

    if (tab) {
        console.log('360 Claim Fetcher: Found tab element:', tab);
        console.log('360 Claim Fetcher: Tab text:', tab.textContent);
        console.log('360 Claim Fetcher: Clicking tab:', tabName);

        // Try clicking the element or its parent if it's not directly clickable
        tab.click();

        // If it's nested in a link/button, try clicking that too
        const clickableParent = tab.closest('a, button');
        if (clickableParent && clickableParent !== tab) {
            clickableParent.click();
        }

        return true;
    } else {
        console.log('360 Claim Fetcher: Tab not found:', tabName);
        console.log('360 Claim Fetcher: Available tabs:',
            Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => a.textContent.trim())
        );
        return false;
    }
}

// Extract shipping details including AWB numbers
function extractShippingDetails() {
    const shippingDetails = {
        replacementShipment: {
            logisticsPartner: 'NA',
            awbNumber: 'NA'
        },
        returnShipment: {
            logisticsPartner: 'NA',
            awbNumber: 'NA'
        }
    };

    console.log('360 Claim Fetcher: Extracting shipping details...');

    const pageText = document.body.textContent;

    // Extract replacement shipment (no spaces between labels and values!)
    const replacementLogisticsMatch = pageText.match(/For Sending Replacement[^N]*Name of Logistics Partner([^A]+?)(?=AWB Number)/);
    const replacementAWBMatch = pageText.match(/For Sending Replacement[^A]*AWB Number([^F]+?)(?=For Customer|Request History)/);

    if (replacementLogisticsMatch) {
        shippingDetails.replacementShipment.logisticsPartner = replacementLogisticsMatch[1].trim();
        console.log('360 Claim Fetcher: Found Replacement Logistics:', replacementLogisticsMatch[1].trim());
    }

    if (replacementAWBMatch) {
        shippingDetails.replacementShipment.awbNumber = replacementAWBMatch[1].trim();
        console.log('360 Claim Fetcher: Found Replacement AWB:', replacementAWBMatch[1].trim());
    }

    // Extract return shipment (no spaces!)
    const returnLogisticsMatch = pageText.match(/For Customer'?s? Device[^N]*Name of Logistics Partner([^A]+?)(?=AWB Number)/);
    const returnAWBMatch = pageText.match(/For Customer'?s? Device[^A]*AWB Number([^R]+?)(?=Request History)/);

    if (returnLogisticsMatch) {
        shippingDetails.returnShipment.logisticsPartner = returnLogisticsMatch[1].trim();
        console.log('360 Claim Fetcher: Found Return Logistics:', returnLogisticsMatch[1].trim());
    }

    if (returnAWBMatch) {
        shippingDetails.returnShipment.awbNumber = returnAWBMatch[1].trim();
        console.log('360 Claim Fetcher: Found Return AWB:', returnAWBMatch[1].trim());
    }

    console.log('360 Claim Fetcher: Final Shipping Details:', shippingDetails);
    return shippingDetails;
}

// Helper function to get text by label
function getTextByLabel(...labels) {
    for (const label of labels) {
        const elements = Array.from(document.querySelectorAll('*'));
        const labelElement = elements.find(el =>
            el.textContent.trim() === label || el.textContent.includes(label)
        );

        if (labelElement) {
            // Look for value in next sibling or parent's next element
            let valueElement = labelElement.nextElementSibling;
            if (!valueElement) {
                valueElement = labelElement.parentElement?.nextElementSibling;
            }
            if (valueElement) {
                return valueElement.textContent.trim();
            }
        }
    }
    return '';
}

// Helper function to extract address information
function extractAddress(sectionName) {
    const address = {
        name: '',
        contact: '',
        address: ''
    };

    // Find the section
    const sectionElement = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent.includes(sectionName)
    );

    if (sectionElement) {
        const container = sectionElement.closest('div') || sectionElement.parentElement;
        if (container) {
            address.name = getTextByLabel('Name') || '';
            address.contact = getTextByLabel('Contact Number') || '';
            address.address = getTextByLabel('Address') || '';
        }
    }

    return address;
}
