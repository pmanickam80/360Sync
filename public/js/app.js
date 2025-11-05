// Dashboard Navigation and Utilities
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    const sectionMap = {
        'upload': 'uploadSection',
        'live': 'liveSection',
        'mapping': 'mappingSection',
        'status': 'statusSection',
        'analysis': 'analysisSection',
        'sla': 'slaSection'
    };

    const section = document.getElementById(sectionMap[sectionName]);
    if (section) {
        section.classList.add('active');
    }

    // Set active nav item (only if called from a click event)
    if (typeof event !== 'undefined' && event && event.target && typeof event.target.closest === 'function') {
        const navItem = event.target.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
        }
    } else {
        // Programmatic navigation - find and activate the corresponding nav item
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const onclick = item.getAttribute('onclick');
            if (onclick && onclick.includes(`'${sectionName}'`)) {
                item.classList.add('active');
            }
        });
    }
}

// Update clock in header
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const clockElement = document.getElementById('currentTime');
    if (clockElement) {
        clockElement.textContent = timeString;
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    updateClock();
    setInterval(updateClock, 1000);
});

        // Status mapping configuration based on SOP-002 Advance Exchange Process
        // Format: '360 status': ['valid goldie status 1', 'valid goldie status 2', ...]
        // Empty array [] means no Goldie order expected (Interface failure is normal)

        const STATUS_MAPPINGS = {
            // ========== PRE-ORDER PHASE (No Goldie Activity Expected) ==========
            'claim withdrawn': [],  // Customer withdrew claim before order creation
            'service cancel': [],  // Claim cancelled before fulfillment
            'payment pending': [],  // Waiting for customer payment - no order yet
            'replacement unavailable': [],  // Back order - waiting for inventory

            // ========== ORDER CREATION PHASE ==========
            // After payment success, Goldie order is created via API
            'payment received': [
                'shipment information sent to fedex',  // Order created, label generated
                'picked up',  // May be picked up quickly
                'on the way'  // Already in transit
            ],

            'replacement request raised': [
                'shipment information sent to fedex'  // Order being created
            ],

            // ========== REPLACEMENT AUTHORIZATION PHASE ==========
            // Status: "Replacement Approved" - Order created in Goldie
            'replacement authorized': [
                'shipment information sent to fedex',  // Order created
                'picked up',  // Package picked up by carrier
                'on the way',  // In transit
                'departed fedex location'  // Started journey
            ],

            // ========== INVENTORY ALLOCATION PHASE ==========
            // Status: "Replacement Allocated" - Knox Guard activated, ready to ship
            'replacement allocated': [
                'shipment information sent to fedex',  // Ready to pick up
                'picked up',  // Carrier picked up
                'on the way',  // In transit
                'departed fedex location',  // Left origin facility
                'at destination sort facility'  // Reached destination area
            ],

            // ========== SHIPMENT CREATED PHASE ==========
            'replacement shipment created': [
                'picked up',  // Package collected
                'on the way',  // In transit
                'departed fedex location',  // Left facility
                'at destination sort facility',  // At sort center
                'at fedex destination facility',  // At destination hub
                'at local fedex facility'  // Near final destination
            ],

            // ========== DEVICE DISPATCHED PHASE (In Transit) ==========
            // Status: "Device Dispatched" - Outbound tracking active
            'device dispatched': [
                'on the way',  // In transit
                'departed fedex location',  // Left facility
                'at destination sort facility',  // At sorting facility
                'at fedex destination facility',  // At destination hub
                'at local fedex facility',  // At local facility
                'on fedex vehicle for delivery'  // Out for delivery
            ],

            // ========== DELIVERY PHASE ==========
            'ready for collection': [
                'ready for pickup',  // Available at pickup location
                'available for pickup'  // Ready to collect
            ],

            'collection order created': [
                'delivered',  // All DELIVERED variants (case sensitive in data)
                'delivered',
                'delivered'
            ],

            // ========== POST-DELIVERY PHASE (Replacement Received) ==========
            // Status: "Defective Awaited" - Customer has replacement, must return defective
            'defective awaited': [
                'delivered',  // Replacement was delivered
                'delivered',  // (handling case variants)
                'delivered'
            ],

            // ========== DEFECTIVE RETURN PHASE ==========
            // Status: "Defective Received" - Service Partner received defective device
            'defective received': [
                'delivered',  // Replacement was delivered (this is outbound tracking)
                'delivered',
                'delivered'
            ],

            // ========== COMPLETION PHASE ==========
            // NOTE: These statuses are COMPLETED claims - no active monitoring needed
            // Setting to empty array [] = no Goldie order expected = not an interface failure
            'service completed': [],  // Claim is closed, no action needed
            'security deposit released': [],  // Claim is closed
            'security deposit charged': [],  // Claim is closed

            // ========== REFURB PHASE ==========
            // NOTE: Refurb is post-claim completion - no active monitoring needed
            'refurb request created': [],  // Post-completion, no action needed

            // ========== EXCEPTION HANDLING ==========
            'delivery exception': [
                'delivery exception',  // FedEx delivery issue
                'delivery updated',  // Status updated after exception
                'the package was refused by the receiver and will be returned to the sender'  // Customer refused
            ]
        };

        let advanceExchangeFiles = [];
        let salesOrderFiles = [];
        let advanceExchangeData = [];
        let salesOrderData = [];

        // Program grouping logic for business units
        function getProgramGroup(programName) {
            if (!programName) return 'Unknown';
            const programUpper = String(programName).toUpperCase();

            if (programUpper.includes('SAMSUNG_B2C')) {
                return 'Samsung B2C';
            } else if (programUpper.includes('SERVIFY_SC_B2B') ||
                      (programUpper.includes('SAMSUNG') && programUpper.includes('B2B'))) {
                return 'Samsung B2B';
            } else if (['APPALACHIAN', 'THUMBCELLULAR', 'INLAND'].includes(programUpper)) {
                return 'RNO';
            } else if (programUpper.includes('BUSINESS') && programUpper.includes('PROTECT')) {
                return 'AT&T';
            } else {
                return 'Other';
            }
        }

        // Get claim type based on Service Type (3 types)
        // Service Type "Advance Exchange w/o Defective" = Theft & Loss
        // Service Type "Device Exchange" = Regular AE
        // Service Type "Same-Day Replacement" = Same-Day Replacement
        function getClaimType(serviceType) {
            if (!serviceType) return 'Unknown';
            const normalized = String(serviceType).toLowerCase().trim();

            if (normalized.includes('advance exchange w/o defective') || normalized.includes('w/o defective')) {
                return 'Theft & Loss';
            } else if (normalized.includes('same-day replacement') || normalized.includes('same day')) {
                return 'Same-Day Replacement';
            } else if (normalized.includes('device exchange')) {
                return 'Regular AE';
            } else {
                return 'Unknown';
            }
        }

        // File input handlers - Initialize only if elements exist
        window.initializeFileHandlers = function() {
            const advanceInput = document.getElementById('advanceExchangeFiles');
            const salesInput = document.getElementById('salesOrderFiles');
            const processBtn = document.getElementById('processBtn');

            if (advanceInput && !advanceInput.hasAttribute('data-initialized')) {
                advanceInput.setAttribute('data-initialized', 'true');
                advanceInput.addEventListener('change', function(e) {
                    handleMultipleFiles(Array.from(e.target.files), 'advance');
                });
            }

            if (salesInput && !salesInput.hasAttribute('data-initialized')) {
                salesInput.setAttribute('data-initialized', 'true');
                salesInput.addEventListener('change', function(e) {
                    handleMultipleFiles(Array.from(e.target.files), 'sales');
                });
            }

            if (processBtn && !processBtn.hasAttribute('data-initialized')) {
                processBtn.setAttribute('data-initialized', 'true');
                processBtn.addEventListener('click', loadFilesAndShowMapping);
            }
        }

        // Initialize when DOM is ready and elements exist
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(window.initializeFileHandlers, 200));
        } else {
            // DOM already loaded, initialize immediately if elements exist
            setTimeout(window.initializeFileHandlers, 200);
        }

        function handleMultipleFiles(files, type) {
            if (type === 'advance') {
                advanceExchangeFiles = advanceExchangeFiles.concat(files);
                displayFileList(advanceExchangeFiles, 'advanceFileList', 'advance');
                const advanceCount = document.getElementById('advanceCount');
                if (advanceCount) {
                    advanceCount.textContent = `${advanceExchangeFiles.length} file${advanceExchangeFiles.length !== 1 ? 's' : ''}`;
                }
            } else {
                salesOrderFiles = salesOrderFiles.concat(files);
                displayFileList(salesOrderFiles, 'salesFileList', 'sales');
                const salesCount = document.getElementById('salesCount');
                if (salesCount) {
                    salesCount.textContent = `${salesOrderFiles.length} file${salesOrderFiles.length !== 1 ? 's' : ''}`;
                }
            }

            checkEnableProcess();
        }

        function displayFileList(files, containerId, type) {
            const container = document.getElementById(containerId);
            if (!container) return; // Exit if element doesn't exist

            container.innerHTML = '';

            files.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span class="file-item-name">${file.name}</span>
                    <span class="file-item-size">${formatFileSize(file.size)}</span>
                    <button class="remove-file-btn" onclick="removeFile(${index}, '${type}')">Remove</button>
                `;
                container.appendChild(fileItem);
            });
        }

        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        function removeFile(index, type) {
            if (type === 'advance') {
                advanceExchangeFiles.splice(index, 1);
                displayFileList(advanceExchangeFiles, 'advanceFileList', 'advance');
                const advanceCount = document.getElementById('advanceCount');
                if (advanceCount) {
                    advanceCount.textContent = `${advanceExchangeFiles.length} file${advanceExchangeFiles.length !== 1 ? 's' : ''}`;
                }
            } else {
                salesOrderFiles.splice(index, 1);
                displayFileList(salesOrderFiles, 'salesFileList', 'sales');
                const salesCount = document.getElementById('salesCount');
                if (salesCount) {
                    salesCount.textContent = `${salesOrderFiles.length} file${salesOrderFiles.length !== 1 ? 's' : ''}`;
                }
            }

            checkEnableProcess();
        }

        function checkEnableProcess() {
            const btn = document.getElementById('processBtn');
            if (btn) {
                btn.disabled = !(advanceExchangeFiles.length > 0 && salesOrderFiles.length > 0);
            }
        }

        function parseFile(file) {
            return new Promise((resolve, reject) => {
                const extension = file.name.split('.').pop().toLowerCase();

                if (extension === 'csv') {
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: function(results) {
                            resolve(results.data);
                        },
                        error: function(error) {
                            reject(error);
                        }
                    });
                } else if (extension === 'xlsx' || extension === 'xls') {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });
                            resolve(jsonData);
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = function(error) {
                        reject(error);
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    reject(new Error('Unsupported file format'));
                }
            });
        }

        async function loadFilesAndShowMapping() {
            console.log('🚀 loadFilesAndShowMapping started');
            console.log('Files to process:', {
                advanceFiles: advanceExchangeFiles.length,
                salesFiles: salesOrderFiles.length
            });

            const processBtn = document.getElementById('processBtn');
            processBtn.disabled = true;
            processBtn.textContent = 'Loading files...';

            try {
                // Parse all advance exchange files
                advanceExchangeData = [];
                for (const file of advanceExchangeFiles) {
                    console.log('Parsing advance file:', file.name);
                    const data = await parseFile(file);
                    console.log('Parsed rows:', data.length);
                    advanceExchangeData = advanceExchangeData.concat(data);
                }
                console.log('Total advance exchange records:', advanceExchangeData.length);

                // Parse all sales order files
                salesOrderData = [];
                for (const file of salesOrderFiles) {
                    console.log('Parsing sales file:', file.name);
                    const data = await parseFile(file);
                    console.log('Parsed rows:', data.length);
                    salesOrderData = salesOrderData.concat(data);
                }
                console.log('Total sales order records:', salesOrderData.length);

                // Populate column mapping dropdowns
                console.log('Populating column selectors...');
                populateColumnSelectors();

                // Automatically process reports and navigate to Live Monitor
                processBtn.textContent = 'Processing reports...';
                console.log('Auto-processing reports after file load...');

                // Process the data
                analyzeData();
                refreshLiveMonitor();

                // Navigate to Live Monitor to show results
                showSection('live');

                processBtn.disabled = false;
                processBtn.textContent = 'Process Reports';

            } catch (error) {
                alert(`Error loading files: ${error.message}`);
                processBtn.disabled = false;
                processBtn.textContent = 'Process Reports';
            }
        }

        function populateColumnSelectors() {
            console.log('📋 populateColumnSelectors started');
            const advanceColumns = Object.keys(advanceExchangeData[0] || {});
            const salesColumns = Object.keys(salesOrderData[0] || {});

            console.log('Available columns:', {
                advance: advanceColumns,
                sales: salesColumns
            });

            // Auto-detect columns
            const advClaimIdCol = findColumn(advanceColumns, [
                'ReferenceID', 'referenceid', 'reference id',  // Exact match first
                ['claim', 'id'], 'claim number', 'reference', 'claim#', 'claimnumber', 'claim', 'id', 'ref'
            ]);
            const advStatusCol = findColumn(advanceColumns, [
                'CSR Status', 'csr status',  // Exact match first
                'status', 'state', 'claim status'
            ]);
            const advProgramCol = findColumn(advanceColumns, [
                'Program Name', 'program name',  // Exact match first
                'program', 'programme', 'plan'
            ]);

            const salesClaimIdCol = findColumn(salesColumns, [
                'CustomerPO', 'customerpo', 'customer po', ['customer', 'po'],  // Exact match first
                ['claim', 'id'], 'claim number', 'reference', 'referenceid', 'claim#', 'claimnumber',
                'order no', 'order number', 'invoice', 'project number', 'claim', 'id', 'ref'
            ]);
            const salesStatusCol = findColumn(salesColumns, [
                'Delivery Status', 'delivery status',  // Exact match first
                'status', 'state', 'fulfillment', 'order status'
            ]);
            const salesProgramCol = findColumn(salesColumns, [
                'Project Number', 'project number',  // Exact match first
                'program', 'programme', 'plan', 'program name', 'project'
            ]);

            console.log('Auto-detected columns:', {
                advance: { claimId: advClaimIdCol, status: advStatusCol, program: advProgramCol },
                sales: { claimId: salesClaimIdCol, status: salesStatusCol, program: salesProgramCol }
            });

            // Populate 360 dropdowns
            populateDropdown('advance360ClaimId', advanceColumns, advClaimIdCol);
            populateDropdown('advance360Status', advanceColumns, advStatusCol);
            populateDropdown('advance360Program', advanceColumns, advProgramCol);

            // Populate Sales Order dropdowns
            populateDropdown('salesOrderClaimId', salesColumns, salesClaimIdCol);
            populateDropdown('salesOrderStatus', salesColumns, salesStatusCol);
            populateDropdown('salesOrderProgram', salesColumns, salesProgramCol);

            // Auto-detect and add new statuses to business rules if they don't exist
            autoDetectStatuses(advStatusCol, salesStatusCol);
        }

        function populateDropdown(selectId, columns, selectedColumn) {
            const select = document.getElementById(selectId);
            if (!select) return; // Exit if element doesn't exist

            select.innerHTML = '';

            columns.forEach(col => {
                const option = document.createElement('option');
                option.value = col;
                option.textContent = col;
                if (col === selectedColumn) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }

        function autoDetectStatuses(advStatusCol, salesStatusCol) {
            // Get unique statuses from both files
            const statuses360 = new Set();
            const statusesGoldie = new Set();

            advanceExchangeData.forEach(row => {
                const status = row[advStatusCol];
                if (status) statuses360.add(status);
            });

            salesOrderData.forEach(row => {
                const status = row[salesStatusCol];
                if (status) statusesGoldie.add(status);
            });

            console.log(`📊 Auto-detected ${statuses360.size} unique 360 statuses and ${statusesGoldie.size} unique Goldie statuses`);

            // Auto-add 360 statuses to STATUS_MAPPINGS if they don't exist
            let newStatusCount = 0;
            statuses360.forEach(status => {
                const normalized = status.toLowerCase().trim();
                if (!STATUS_MAPPINGS[normalized]) {
                    STATUS_MAPPINGS[normalized] = []; // Empty array = no Goldie expected by default
                    newStatusCount++;
                }
            });

            if (newStatusCount > 0) {
                console.log(`✅ Added ${newStatusCount} new statuses to business rules`);
                // Refresh the business rules table if it's currently displayed
                if (typeof renderBusinessRulesTable === 'function') {
                    renderBusinessRulesTable();
                }
            }

            // Store statuses for reference
            window.detected360Statuses = Array.from(statuses360).sort();
            window.detectedGoldieStatuses = Array.from(statusesGoldie).sort();
        }


        async function processReports() {
            console.log('🔄 processReports started');

            // Navigate to live monitor section
            showSection('live');

            const liveContent = document.getElementById('liveMonitorContent');
            if (!liveContent) {
                console.error('❌ liveMonitorContent element not found!');
                return; // Exit if element doesn't exist
            }

            console.log('✅ liveMonitorContent found:', liveContent);
            liveContent.innerHTML = '<div class="loading">Processing reports...</div>';

            try {
                // Now process the combined data with user-selected columns
                console.log('Calling analyzeData...');
                analyzeData();

                // Refresh Live Monitor
                console.log('Refreshing Live Monitor...');
                refreshLiveMonitor();

            } catch (error) {
                liveContent.innerHTML = `
                    <div class="error-message">
                        <strong>Error processing reports:</strong> ${error.message}
                        <br><br>
                        Please ensure your files have the correct format.
                    </div>
                `;
            }
        }

        function normalizeStatus(status) {
            if (!status) return '';
            return status.toString().toLowerCase().trim();
        }

        function normalizeClaimId(id) {
            if (!id) return '';
            return id.toString().trim();
        }

        function isStatusMismatch(status360, statusSales) {
            const normalized360 = normalizeStatus(status360);
            const normalizedSales = normalizeStatus(statusSales);

            // Check if there's a mapping defined
            if (STATUS_MAPPINGS[normalized360]) {
                return !STATUS_MAPPINGS[normalized360].includes(normalizedSales);
            }

            // If no mapping defined, consider different statuses as mismatch
            return normalized360 !== normalizedSales;
        }

        function findColumn(columns, patterns) {
            for (const pattern of patterns) {
                const found = columns.find(col => {
                    const lowerCol = col.toLowerCase();
                    if (Array.isArray(pattern)) {
                        return pattern.every(p => lowerCol.includes(p.toLowerCase()));
                    }
                    return lowerCol.includes(pattern.toLowerCase());
                });
                if (found) {
                    console.log(`✅ Found column match: "${found}" for pattern: ${JSON.stringify(pattern)}`);
                    return found;
                }
            }
            console.warn(`⚠️ No match found for patterns: ${JSON.stringify(patterns)}, falling back to first column`);
            return columns[0]; // fallback to first column
        }

        function analyzeData() {
            console.log('📊 analyzeData started');
            try {
                // Get selected columns from dropdowns
                const advClaimIdCol = document.getElementById('advance360ClaimId')?.value;
                const advStatusCol = document.getElementById('advance360Status')?.value;
                const advProgramCol = document.getElementById('advance360Program')?.value;

                const claimIdCol = document.getElementById('salesOrderClaimId')?.value;
                const statusCol = document.getElementById('salesOrderStatus')?.value;
                const programCol = document.getElementById('salesOrderProgram')?.value;

                console.log('Selected columns:', {
                    advance: { claimId: advClaimIdCol, status: advStatusCol, program: advProgramCol },
                    sales: { claimId: claimIdCol, status: statusCol, program: programCol }
                });

                // Validate columns are not undefined
                if (!advClaimIdCol || !advStatusCol || !advProgramCol) {
                    throw new Error(`Missing advance exchange columns: claimId=${advClaimIdCol}, status=${advStatusCol}, program=${advProgramCol}`);
                }
                if (!claimIdCol || !statusCol || !programCol) {
                    throw new Error(`Missing sales order columns: claimId=${claimIdCol}, status=${statusCol}, program=${programCol}`);
                }

                // Create debug info
                const debugInfo = {
                    advance360: {
                        totalRecords: advanceExchangeData.length,
                        detectedColumns: {
                            claimId: advClaimIdCol,
                            status: advStatusCol,
                            program: advProgramCol
                        },
                        sampleClaimId: advanceExchangeData[0]?.[advClaimIdCol]
                    },
                    salesOrder: {
                        totalRecords: salesOrderData.length,
                        uniqueRecords: 0,  // Will be updated after deduplication
                        duplicateRecords: 0,  // Will be updated after deduplication
                        detectedColumns: {
                            claimId: claimIdCol,
                            status: statusCol,
                            program: programCol
                        },
                        sampleClaimId: salesOrderData[0]?.[claimIdCol]
                    }
                };

                // Create a map of sales order data by claim ID (with deduplication)
                const salesOrderMap = new Map();
                let duplicateCount = 0;
                const duplicateClaimIds = new Set();

                salesOrderData.forEach(row => {
                    const claimId = normalizeClaimId(row[claimIdCol]);
                    if (claimId) {
                        if (salesOrderMap.has(claimId)) {
                            duplicateCount++;
                            duplicateClaimIds.add(claimId);
                        }
                        // Latest entry will overwrite - keeping most recent
                        salesOrderMap.set(claimId, {
                            program: row[programCol] || 'Unknown',
                            status: row[statusCol] || '',
                            data: row
                        });
                    }
                });

                console.log(`📊 Deduplication: Found ${duplicateCount} duplicate records across ${duplicateClaimIds.size} unique claim IDs`);
                console.log(`✅ Unique sales orders after deduplication: ${salesOrderMap.size}`);

                // Update debug info with deduplication stats
                debugInfo.salesOrder.uniqueRecords = salesOrderMap.size;
                debugInfo.salesOrder.duplicateRecords = duplicateCount;

                // Track failures by category
                const interfaceFailures = {}; // 360 claims not in Goldie
                const statusMismatches = {}; // Status differences
                let totalRecords = 0;
                let totalMatched = 0;

                advanceExchangeData.forEach(row => {
                    const claimId = normalizeClaimId(row[advClaimIdCol]);
                    const status360 = row[advStatusCol] || '';
                    const program = row[advProgramCol] || 'Unknown';

                    totalRecords++;

                    if (salesOrderMap.has(claimId)) {
                        totalMatched++;
                        const salesOrder = salesOrderMap.get(claimId);

                        // Check for status mismatch (Goldie to 360 failure)
                        if (isStatusMismatch(status360, salesOrder.status)) {
                            if (!statusMismatches[program]) {
                                statusMismatches[program] = [];
                            }

                            statusMismatches[program].push({
                                claimId: claimId,
                                status360: status360,
                                statusGoldie: salesOrder.status,
                                failureType: 'Goldie to 360 failure',
                                advanceData: row,
                                salesData: salesOrder.data
                            });
                        }
                    } else {
                        // Claim not found in Goldie - check if this is expected based on 360 status
                        const normalized360 = normalizeStatus(status360);
                        const expectedStatuses = STATUS_MAPPINGS[normalized360];

                        // Only flag as interface failure if we EXPECT a Goldie order (non-empty mapping)
                        if (expectedStatuses && expectedStatuses.length > 0) {
                            // Interface failure to Goldie - claim exists in 360 but not in sales order
                            if (!interfaceFailures[program]) {
                                interfaceFailures[program] = [];
                            }

                            interfaceFailures[program].push({
                                claimId: claimId,
                                status360: status360,
                                statusGoldie: 'Not Found',
                                failureType: 'Interface failure to Goldie',
                                advanceData: row
                            });
                        }
                        // If expectedStatuses is empty [], no Goldie order is expected - not an error
                    }
                });

                // Combine both types of failures
                const totalInterfaceFailures = Object.values(interfaceFailures).flat().length;
                const totalStatusMismatches = Object.values(statusMismatches).flat().length;
                const totalIssues = totalInterfaceFailures + totalStatusMismatches;

                console.log('📈 Analysis complete. Calling displayResults...');
                console.log('Results:', {
                    totalRecords,
                    totalMatched,
                    totalInterfaceFailures,
                    totalStatusMismatches,
                    programs: Object.keys(interfaceFailures)
                });

                displayResults(interfaceFailures, statusMismatches, totalRecords, totalMatched,
                              totalInterfaceFailures, totalStatusMismatches, debugInfo);

                console.log('✅ displayResults called');

            } catch (error) {
                const resultsContent = document.getElementById('resultsContent');
                if (resultsContent) {
                    resultsContent.innerHTML = `
                        <div class="error-message">
                            <strong>Error analyzing data:</strong> ${error.message}
                            <br><br>
                            Please ensure your files have the correct format.
                        </div>
                    `;
                }
                console.error('Error analyzing data:', error);
            }
        }

        function switchTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab content
            const tabContent = document.getElementById(tabName);
            if (tabContent) {
                tabContent.classList.add('active');
            }

            const tabButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
            if (tabButton) {
                tabButton.classList.add('active');
            }
        }

        function displayResults(interfaceFailures, statusMismatches, totalRecords, totalMatched,
                               totalInterfaceFailures, totalStatusMismatches, debugInfo) {
            console.log('🎨 displayResults started');
            const resultsContent = document.getElementById('resultsContent');
            if (!resultsContent) {
                console.error('❌ resultsContent not found in displayResults!');
                return; // Exit if element doesn't exist
            }

            console.log('✅ resultsContent found, generating HTML...');
            const totalIssues = totalInterfaceFailures + totalStatusMismatches;

            // Combine all programs from both failure types
            const allPrograms = Array.from(new Set([
                ...Object.keys(interfaceFailures),
                ...Object.keys(statusMismatches)
            ])).sort();

            // Calculate program-level statistics
            const programStats = {};
            allPrograms.forEach(program => {
                const interfaceCount = (interfaceFailures[program] || []).length;
                const statusCount = (statusMismatches[program] || []).length;
                programStats[program] = {
                    interface: interfaceCount,
                    status: statusCount,
                    total: interfaceCount + statusCount
                };
            });

            // Create tabs
            const tabsHTML = `
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('overview')">Overview</button>
                    ${allPrograms.map(program =>
                        `<button class="tab" onclick="switchTab('${program.replace(/\s+/g, '_')}')">${program} (${programStats[program].total})</button>`
                    ).join('')}
                    <button class="tab" onclick="switchTab('businessRules')">Business Rules</button>
                </div>
            `;

            // Overview tab content
            const overviewHTML = `
                <div class="tab-content active" id="overview">
                    <h3 style="margin-bottom: 20px; color: #333;">Summary Statistics</h3>

                    <div class="summary">
                        <div class="summary-card success">
                            <h3>Total 360 Records</h3>
                            <div class="value">${totalRecords}</div>
                        </div>
                        <div class="summary-card success">
                            <h3>Matched Claims</h3>
                            <div class="value">${totalMatched}</div>
                        </div>
                        <div class="summary-card ${totalInterfaceFailures > 0 ? 'error' : 'success'}">
                            <h3>Interface Failures</h3>
                            <div class="value">${totalInterfaceFailures}</div>
                        </div>
                        <div class="summary-card ${totalStatusMismatches > 0 ? 'error' : 'success'}">
                            <h3>Status Mismatches</h3>
                            <div class="value">${totalStatusMismatches}</div>
                        </div>
                        <div class="summary-card ${totalIssues > 0 ? 'error' : 'success'}">
                            <h3>Total Issues</h3>
                            <div class="value">${totalIssues}</div>
                        </div>
                        <div class="summary-card success">
                            <h3>In Sync</h3>
                            <div class="value">${totalMatched - totalStatusMismatches}</div>
                        </div>
                    </div>

                    <div class="debug-section">
                        <h3>Column Mapping Used</h3>
                        <div class="debug-info">
                            <strong>360 Advance Exchange Report:</strong><br>
                            Total Records: ${debugInfo.advance360.totalRecords}<br>
                            Claim ID Column: <code>${debugInfo.advance360.detectedColumns.claimId}</code><br>
                            Status Column: <code>${debugInfo.advance360.detectedColumns.status}</code><br>
                            Program Column: <code>${debugInfo.advance360.detectedColumns.program}</code>
                            <div class="sample-data">Sample Claim ID: ${debugInfo.advance360.sampleClaimId}</div>
                        </div>
                        <div class="debug-info">
                            <strong>Sales Order Report (Goldie):</strong><br>
                            Total Records: ${debugInfo.salesOrder.totalRecords}<br>
                            Claim ID Column: <code>${debugInfo.salesOrder.detectedColumns.claimId}</code><br>
                            Status Column: <code>${debugInfo.salesOrder.detectedColumns.status}</code><br>
                            Program Column: <code>${debugInfo.salesOrder.detectedColumns.program}</code>
                            <div class="sample-data">Sample Claim ID: ${debugInfo.salesOrder.sampleClaimId}</div>
                        </div>
                    </div>

                    <h3 style="margin-top: 30px; margin-bottom: 15px; color: #333;">Program Breakdown</h3>
                    ${allPrograms.map(program => `
                        <div class="program-section" style="margin-bottom: 15px;">
                            <div class="program-header" style="cursor: pointer;" onclick="switchTab('${program.replace(/\s+/g, '_')}')">
                                ${program} - ${programStats[program].total} Issue${programStats[program].total !== 1 ? 's' : ''}
                                (${programStats[program].interface} Interface, ${programStats[program].status} Status) →
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Program tabs content
            let programTabsHTML = '';
            allPrograms.forEach(program => {
                const programInterfaceFailures = interfaceFailures[program] || [];
                const programStatusMismatches = statusMismatches[program] || [];
                const allIssues = [...programInterfaceFailures, ...programStatusMismatches];

                programTabsHTML += `
                    <div class="tab-content" id="${program.replace(/\s+/g, '_')}">
                        <div class="program-summary">
                            <div class="program-summary-item">
                                <h4>Program</h4>
                                <div class="value">${program}</div>
                            </div>
                            <div class="program-summary-item">
                                <h4>Total Issues</h4>
                                <div class="value">${allIssues.length}</div>
                            </div>
                            <div class="program-summary-item">
                                <h4>Interface Failures</h4>
                                <div class="value">${programInterfaceFailures.length}</div>
                            </div>
                            <div class="program-summary-item">
                                <h4>Status Mismatches</h4>
                                <div class="value">${programStatusMismatches.length}</div>
                            </div>
                        </div>

                        ${allIssues.length === 0 ?
                            '<div class="no-mismatches">No issues found for this program!</div>' :
                            `<table class="mismatch-table">
                                <thead>
                                    <tr>
                                        <th>Claim ID</th>
                                        <th>360 Status</th>
                                        <th>Goldie Status</th>
                                        <th>Failure Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allIssues.map(issue => `
                                        <tr>
                                            <td><strong>${issue.claimId}</strong></td>
                                            <td><span class="status-badge status-360">${issue.status360}</span></td>
                                            <td><span class="status-badge status-sales">${issue.statusGoldie}</span></td>
                                            <td><span class="failure-category ${issue.failureType.includes('Interface') ? 'interface' : 'status-mismatch'}">
                                                ${issue.failureType}
                                            </span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>`
                        }
                    </div>
                `;
            });

            // Business Rules tab content
            const businessRulesHTML = `
                <div class="tab-content" id="businessRules">
                    <h3 style="margin-bottom: 15px; color: #333;">Current Business Rules</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 20px;">
                        These are the active business rules based on SOP-002 Advance Exchange Process.
                        Edit them in the Status Mapping & Business Rules section after loading files.
                    </p>
                    <div class="debug-info">
                        <strong>Active Mappings:</strong>
                        <div class="sample-data">
${JSON.stringify(STATUS_MAPPINGS, null, 2)}
                        </div>
                    </div>
                </div>
            `;

            console.log('Setting resultsContent.innerHTML...');
            resultsContent.innerHTML = `
                <h2 style="margin-bottom: 20px; color: #333;">Analysis Results</h2>
                ${tabsHTML}
                ${overviewHTML}
                ${programTabsHTML}
                ${businessRulesHTML}
            `;
            console.log('✅ Results HTML set successfully!');
        }

        // Status categorization for Live Monitor tabs
        const STATUS_CATEGORIES = {
            // Tab 1: Pre-Processing (Not Ready for Shipment Order Creation)
            preProcessing: [
                'payment pending',
                'payment received',
                'replacement unavailable'
            ],

            // Tab 2: Goldie Replacement Interface Failures (Should have Goldie order)
            interfaceFailure: [
                'replacement allocated',
                'replacement shipment created',
                'device dispatched',
                'ready for collection'
            ],

            // Tab 3: Shipment Exceptions (includes replacement shipment exceptions and delivery exceptions)
            shipmentException: [
                'replacement request raised',  // Replacement created - verify Goldie
                'replacement authorized',      // Replacement authorized - verify Goldie
                'replacement approved',         // Replacement approved - verify Goldie
                'replacement allocated',        // Replacement allocated - verify Goldie
                'replacement shipment created', // Shipment created - verify Goldie
                'delivery exception',
                'collection order created'
            ],

            // Early stage statuses that should NOT have "Delivered" in Goldie
            earlyStageStatuses: [
                'replacement request raised',
                'replacement authorized',
                'replacement approved',
                'replacement allocated',
                'replacement shipment created'
            ],

            // Tab 4: Return Device Exceptions
            returnException: [
                'defective awaited'
            ],

            // Completed/Cancelled - not monitored (excluded from all counts)
            completed: [
                'service completed',
                'refurb request created',
                'security deposit charged',
                'security deposit released',
                'defective received',
                'claim withdrawn',      // User requested: don't count cancelled claims
                'service cancel'        // User requested: don't count cancelled claims
            ]
        };

        function getStatusCategory(status) {
            const normalized = normalizeStatus(status);
            for (const [category, statuses] of Object.entries(STATUS_CATEGORIES)) {
                if (statuses.includes(normalized)) {
                    return category;
                }
            }
            return 'unknown';
        }

        // Store claims data globally for email notifications
        let currentClaimsData = null;

        // Live Monitor Functions
        function refreshLiveMonitor() {
            console.log('🔄 Refreshing Live Monitor...');

            if (!advanceExchangeData.length || !salesOrderData.length) {
                const liveContent = document.getElementById('liveMonitorContent');
                if (liveContent) {
                    liveContent.innerHTML = '<div class="info-message">Upload and process reports to view live interface failure monitoring</div>';
                }
                return;
            }

            // Get filter values
            const dateFilter = document.getElementById('liveDateFilter')?.value || '7days';
            const businessUnitFilter = document.getElementById('liveBusinessUnit')?.value || 'all';
            const claimTypeFilter = document.getElementById('liveClaimType')?.value || 'all';

            // Get selected columns from dropdowns
            const advClaimIdCol = document.getElementById('advance360ClaimId')?.value;
            const advStatusCol = document.getElementById('advance360Status')?.value;
            const advProgramCol = document.getElementById('advance360Program')?.value;

            // Check available columns in the data
            const availableColumns = advanceExchangeData.length > 0 ? Object.keys(advanceExchangeData[0]) : [];
            const advServiceTypeCol = availableColumns.find(col => col.toLowerCase().includes('service') && col.toLowerCase().includes('type')) || 'Service Type';
            const advCreatedCol = availableColumns.find(col => col.toLowerCase().includes('creation') && col.toLowerCase().includes('date')) || 'Request Creation Date-time';
            const advUpdatedCol = availableColumns.find(col => col.toLowerCase().includes('update') && col.toLowerCase().includes('date')) || 'Request Update Date-Time';

            console.log('📋 Live Monitor using columns:', {
                serviceType: advServiceTypeCol,
                created: advCreatedCol,
                updated: advUpdatedCol
            });

            // Debug: Check first row's values
            if (advanceExchangeData.length > 0) {
                const firstRow = advanceExchangeData[0];
                console.log('📊 First row values:', {
                    serviceType: firstRow[advServiceTypeCol],
                    claimType: getClaimType(firstRow[advServiceTypeCol]),
                    createdDate: firstRow[advCreatedCol],
                    createdDateType: typeof firstRow[advCreatedCol]
                });
            }

            const claimIdCol = document.getElementById('salesOrderClaimId')?.value;
            const statusCol = document.getElementById('salesOrderStatus')?.value;
            const programCol = document.getElementById('salesOrderProgram')?.value;

            if (!advClaimIdCol || !claimIdCol) {
                console.error('Column mappings not set');
                return;
            }

            // Create sales order map for quick lookup
            const salesOrderMap = new Map();
            salesOrderData.forEach(row => {
                const claimId = normalizeClaimId(row[claimIdCol]);
                if (claimId) {
                    // Extract order number from common column names
                    let orderNumber = '';
                    const orderNumberKeys = ['Order No', 'order no', 'OrderNo', 'Order Number', 'order number'];
                    for (const key of orderNumberKeys) {
                        if (row[key] && row[key].toString().trim() !== '') {
                            orderNumber = row[key].toString().trim();
                            break;
                        }
                    }

                    salesOrderMap.set(claimId, {
                        program: row[programCol] || 'Unknown',
                        status: row[statusCol] || '',
                        orderNumber: orderNumber,
                        data: row
                    });
                }
            });

            // Calculate date range
            const now = new Date();
            let dateThreshold = null;
            if (dateFilter === 'today') {
                dateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (dateFilter === '7days') {
                dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (dateFilter === '30days') {
                dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            }

            // Analyze claims by category with filters
            const claimsByCategory = {
                preProcessing: {},         // Tab 1
                interfaceFailure: {},      // Tab 2
                shipmentException: {},     // Tab 3
                returnException: {}        // Tab 4
            };
            const businessUnitStats = {};

            let debugRowCount = 0;
            advanceExchangeData.forEach(row => {
                const claimId = normalizeClaimId(row[advClaimIdCol]);
                const status360 = row[advStatusCol] || '';
                const program = row[advProgramCol] || 'Unknown';
                const serviceType = row[advServiceTypeCol] || '';
                const createdDate = row[advCreatedCol];
                const updatedDate = row[advUpdatedCol];

                // Get claim type from Service Type column
                const claimType = getClaimType(serviceType);

                // Debug first few rows
                if (debugRowCount < 3 && createdDate) {
                    console.log(`📅 Row ${debugRowCount + 1} - Claim: ${claimId}, Type: ${claimType}, Status: ${status360}`);
                    debugRowCount++;
                }

                // Get business unit
                const businessUnit = getProgramGroup(program);

                // Apply business unit filter
                if (businessUnitFilter !== 'all' && businessUnit !== businessUnitFilter) {
                    return;
                }

                // Apply claim type filter
                if (claimTypeFilter === 'tl' && claimType !== 'Theft & Loss') return;
                if (claimTypeFilter === 'regular' && claimType !== 'Regular AE') return;
                if (claimTypeFilter === 'sameday' && claimType !== 'Same-Day Replacement') return;

                // Apply date filter (check both created and updated dates)
                if (dateThreshold) {
                    let rowDate = null;
                    if (updatedDate) {
                        rowDate = new Date(updatedDate);
                    } else if (createdDate) {
                        rowDate = new Date(createdDate);
                    }

                    if (!rowDate || rowDate < dateThreshold) {
                        return;
                    }
                }

                // Initialize business unit stats
                if (!businessUnitStats[businessUnit]) {
                    businessUnitStats[businessUnit] = {
                        total: 0,
                        matched: 0,
                        interfaceFailures: 0,
                        theftAndLoss: 0,
                        regularAE: 0,
                        sameDay: 0
                    };
                }

                // Update business unit stats by claim type
                businessUnitStats[businessUnit].total++;
                if (claimType === 'Theft & Loss') businessUnitStats[businessUnit].theftAndLoss++;
                else if (claimType === 'Same-Day Replacement') businessUnitStats[businessUnit].sameDay++;
                else businessUnitStats[businessUnit].regularAE++;

                // Determine claim category
                const category = getStatusCategory(status360);

                // Skip completed claims
                if (category === 'completed' || category === 'unknown') {
                    if (!salesOrderMap.has(claimId)) {
                        // Even completed claims count towards stats
                    } else {
                        businessUnitStats[businessUnit].matched++;
                    }
                    return;
                }

                // Calculate days since created with proper date parsing
                let daysSinceCreated = null;
                if (createdDate) {
                    const createdDateObj = createdDate instanceof Date ? createdDate : new Date(createdDate);
                    if (!isNaN(createdDateObj.getTime())) {
                        daysSinceCreated = Math.floor((now - createdDateObj) / (1000 * 60 * 60 * 24));
                    }
                }

                // Get Goldie delivery status
                const goldieOrderData = salesOrderMap.get(claimId);
                let goldieDeliveryStatus = 'Not Found';

                if (goldieOrderData) {
                    // Goldie order exists - start with empty status
                    goldieDeliveryStatus = '';

                    // First try the status field (mapped from user-selected column)
                    if (goldieOrderData.status && goldieOrderData.status.trim() !== '') {
                        goldieDeliveryStatus = goldieOrderData.status;
                    } else if (goldieOrderData.data) {
                        // Fall back to checking common delivery status column names in raw data
                        // Priority: "Delivery Status" first, then other variations
                        // NOTE: Do NOT include "State" as it refers to US state (KY, MI, etc.)
                        const rawRow = goldieOrderData.data;
                        const deliveryStatusKeys = [
                            'Delivery Status',        // Exact match - highest priority
                            'delivery status',
                            'DELIVERY STATUS',
                            'DeliveryStatus',
                            'deliverystatus',
                            'Fulfillment Status',
                            'fulfillment status',
                            'Order Status',
                            'order status',
                            'Status',
                            'status'
                        ];

                        for (const key of deliveryStatusKeys) {
                            if (rawRow[key] && rawRow[key].toString().trim() !== '') {
                                goldieDeliveryStatus = rawRow[key].toString();
                                break;
                            }
                        }
                    }

                    // If still empty after checking all columns, show as pending
                    if (!goldieDeliveryStatus || goldieDeliveryStatus.trim() === '') {
                        goldieDeliveryStatus = 'Pending Shipment';
                    }
                }

                const claimInfo = {
                    claimId: claimId,
                    program: program,
                    businessUnit: businessUnit,
                    serviceType: serviceType,
                    claimType: claimType,
                    status360: status360,
                    createdDate: createdDate,
                    updatedDate: updatedDate,
                    daysSinceCreated: daysSinceCreated,
                    hasGoldieOrder: salesOrderMap.has(claimId),
                    goldieStatus: salesOrderMap.has(claimId) ? salesOrderMap.get(claimId).status : 'Not Found',
                    goldieOrderNumber: goldieOrderData ? (goldieOrderData.orderNumber || '') : '',
                    goldieDeliveryStatus: goldieDeliveryStatus,
                    advanceData: row
                };

                // Check for delivery status mismatch exception
                const normalized360Status = normalizeStatus(status360);
                const isEarlyStage = STATUS_CATEGORIES.earlyStageStatuses.includes(normalized360Status);
                const isGoldieDelivered = goldieDeliveryStatus && goldieDeliveryStatus.toLowerCase().includes('delivered');
                claimInfo.isDeliveryMismatch = isEarlyStage && isGoldieDelivered;

                // Categorize claim
                if (category === 'preProcessing') {
                    // Tab 1: Pre-Processing (not ready for Goldie order)
                    if (!claimsByCategory.preProcessing[businessUnit]) {
                        claimsByCategory.preProcessing[businessUnit] = [];
                    }
                    claimsByCategory.preProcessing[businessUnit].push(claimInfo);

                } else if (category === 'interfaceFailure') {
                    // Tab 2: Should have Goldie order - check if missing
                    if (!salesOrderMap.has(claimId)) {
                        if (!claimsByCategory.interfaceFailure[businessUnit]) {
                            claimsByCategory.interfaceFailure[businessUnit] = [];
                        }
                        claimsByCategory.interfaceFailure[businessUnit].push(claimInfo);
                    } else {
                        businessUnitStats[businessUnit].matched++;
                    }

                } else if (category === 'shipmentException') {
                    // Tab 3: Shipment exceptions
                    if (!claimsByCategory.shipmentException[businessUnit]) {
                        claimsByCategory.shipmentException[businessUnit] = [];
                    }
                    claimsByCategory.shipmentException[businessUnit].push(claimInfo);

                } else if (category === 'returnException') {
                    // Tab 5: Return device exceptions
                    if (!claimsByCategory.returnException[businessUnit]) {
                        claimsByCategory.returnException[businessUnit] = [];
                    }
                    claimsByCategory.returnException[businessUnit].push(claimInfo);
                }
            });

            // Store claims data globally for email notifications
            currentClaimsData = claimsByCategory;

            // Display results
            displayLiveMonitor(claimsByCategory, businessUnitStats, dateFilter);
        }

        function displayLiveMonitor(claimsByCategory, businessUnitStats, dateFilter) {
            const liveContent = document.getElementById('liveMonitorContent');
            if (!liveContent) return;

            // Calculate totals for each tab
            const tabCounts = {
                preProcessing: Object.values(claimsByCategory.preProcessing).flat().length,
                interfaceFailure: Object.values(claimsByCategory.interfaceFailure).flat().length,
                shipmentException: Object.values(claimsByCategory.shipmentException).flat().length,
                returnException: Object.values(claimsByCategory.returnException).flat().length
            };

            const businessUnits = Object.keys(businessUnitStats).sort();

            // Date filter description
            const filterDesc = {
                'today': "Today's",
                '7days': 'Past 7 Days',
                '30days': 'Past 30 Days',
                'all': 'All Time'
            }[dateFilter] || dateFilter;

            // Create main tabs HTML
            const tabsHTML = `
                <div class="tabs" style="margin-bottom: 20px;">
                    <button class="tab active" onclick="switchLiveTab('preProcessing')">
                        📋 Pre-Processing (${tabCounts.preProcessing})
                    </button>
                    <button class="tab" onclick="switchLiveTab('interfaceFailure')">
                        🚨 Goldie Interface Failures (${tabCounts.interfaceFailure})
                    </button>
                    <button class="tab" onclick="switchLiveTab('shipmentException')">
                        📦 Shipment Exceptions (${tabCounts.shipmentException})
                    </button>
                    <button class="tab" onclick="switchLiveTab('returnException')">
                        🔙 Return Exceptions (${tabCounts.returnException})
                    </button>
                </div>
            `;

            // Helper to create program sub-tabs
            function createProgramSubTabs(category, categoryData) {
                const programs = Object.keys(categoryData).sort();
                if (programs.length === 0) return '';

                const subTabsHTML = programs.map((prog, idx) => {
                    const count = categoryData[prog].length;
                    const activeClass = idx === 0 ? 'active' : '';
                    return `<button class="tab ${activeClass}" onclick="switchProgramTab('${category}', '${prog}')" style="font-size: 13px; padding: 8px 16px;">
                        ${prog} (${count})
                    </button>`;
                }).join('');

                return `<div class="tabs" style="margin: 15px 0; background: #f9fafb; padding: 10px; border-radius: 6px;">${subTabsHTML}</div>`;
            }

            // Helper to create program sub-tab content
            function createProgramTabContent(category, program, claims, isFirst) {
                const activeClass = isFirst ? 'active' : '';
                return `
                    <div class="tab-content ${activeClass}" id="programTab_${category}_${program.replace(/\s+/g, '_')}">
                        ${renderClaimsTable(claims, `${program} Claims`)}
                    </div>
                `;
            }

            // Helper function to render claims table
            function renderClaimsTable(claims, title) {
                if (claims.length === 0) {
                    return `<div class="no-mismatches">✅ No ${title.toLowerCase()} found for the selected filters!</div>`;
                }

                return `
                    <table class="mismatch-table">
                        <thead>
                            <tr>
                                <th>Claim ID</th>
                                <th>Business Unit</th>
                                <th>Program</th>
                                <th>Claim Type</th>
                                <th>CSR Status</th>
                                <th>Goldie Order</th>
                                <th>Goldie Order #</th>
                                <th>Goldie Delivery Status</th>
                                <th>Created Date</th>
                                <th>Days Old</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${claims.map(c => {
                                // Properly format the date
                                let formattedDate = 'N/A';
                                if (c.createdDate) {
                                    const dateObj = c.createdDate instanceof Date ? c.createdDate : new Date(c.createdDate);
                                    if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2000) {
                                        formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                    }
                                }

                                // Color coding for claim types
                                let claimTypeBadgeClass = '';
                                if (c.claimType === 'Theft & Loss') {
                                    claimTypeBadgeClass = 'status-360'; // Red/orange
                                } else if (c.claimType === 'Same-Day Replacement') {
                                    claimTypeBadgeClass = 'status-mismatch'; // Purple
                                } else {
                                    claimTypeBadgeClass = ''; // Default
                                }

                                // Highlight row if there's a delivery status mismatch
                                const rowStyle = c.isDeliveryMismatch ? 'background-color: #fef3c7; border-left: 4px solid #f59e0b;' : '';

                                // Format Goldie delivery status
                                const deliveryStatus = c.goldieDeliveryStatus || 'N/A';
                                const deliveryStatusBadge = c.isDeliveryMismatch ?
                                    `<span class="status-badge" style="background: #dc2626; color: white;">⚠️ ${deliveryStatus}</span>` :
                                    deliveryStatus;

                                return `
                                <tr style="${rowStyle}">
                                    <td><strong>${c.claimId}</strong></td>
                                    <td>${c.businessUnit}</td>
                                    <td>${c.program}</td>
                                    <td><span class="status-badge ${claimTypeBadgeClass}">${c.claimType}</span></td>
                                    <td><span class="status-badge status-sales">${c.status360}</span></td>
                                    <td style="text-align: center;">${c.hasGoldieOrder ? '✅ Yes' : '❌ No'}</td>
                                    <td style="text-align: center;">${c.goldieOrderNumber || '-'}</td>
                                    <td style="text-align: center;">${deliveryStatusBadge}</td>
                                    <td>${formattedDate}</td>
                                    <td style="text-align: center;">${c.daysSinceCreated !== null ? c.daysSinceCreated : '-'}</td>
                                    <td style="text-align: center;">
                                        <button onclick="fetch360ClaimDetails('${c.claimId}')"
                                                style="padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                                            📋 Fetch 360
                                        </button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            }

            // Tab 1: Pre-Processing with program sub-tabs
            let tab1ProgramContent = '';
            Object.keys(claimsByCategory.preProcessing).sort().forEach((prog, idx) => {
                tab1ProgramContent += createProgramTabContent('preProcessing', prog, claimsByCategory.preProcessing[prog], idx === 0);
            });

            const tab1HTML = `
                <div class="tab-content active" id="liveTab_preProcessing">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div>
                            <h3 style="margin: 0 0 5px 0; color: #333;">Claims Not Ready for Shipment Order Creation</h3>
                            <p style="font-size: 13px; color: #666; margin: 0;">
                                These claims are in early stages and don't require Goldie orders yet (payment pending, etc.)
                            </p>
                        </div>
                        ${tabCounts.preProcessing > 0 ? `
                            <button onclick="sendPreProcessingNotification()" id="notifyPreProcessingBtn"
                                    style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                📧 Notify Team
                            </button>
                        ` : ''}
                    </div>
                    ${createProgramSubTabs('preProcessing', claimsByCategory.preProcessing)}
                    ${tab1ProgramContent || '<div class="no-mismatches">✅ No pre-processing claims found</div>'}
                </div>
            `;

            // Tab 2: Interface Failures with program sub-tabs
            let tab2ProgramContent = '';
            Object.keys(claimsByCategory.interfaceFailure).sort().forEach((prog, idx) => {
                tab2ProgramContent += createProgramTabContent('interfaceFailure', prog, claimsByCategory.interfaceFailure[prog], idx === 0);
            });

            const tab2HTML = `
                <div class="tab-content" id="liveTab_interfaceFailure">
                    <h3 style="margin-bottom: 15px; color: #333;">Missing Goldie Replacement Orders</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 10px;">
                        These claims should have Goldie orders but don't - <strong>action required!</strong>
                    </p>
                    ${createProgramSubTabs('interfaceFailure', claimsByCategory.interfaceFailure)}
                    ${tab2ProgramContent || '<div class="no-mismatches">✅ No interface failures found</div>'}
                </div>
            `;

            // Tab 3: Shipment Exceptions - Split into Replacement and Other exceptions
            // Separate replacement shipment exceptions from other shipment exceptions
            const replacementShipmentStatuses = ['replacement request raised', 'replacement authorized'];
            const replacementShipmentExceptions = {};
            const otherShipmentExceptions = {};

            Object.keys(claimsByCategory.shipmentException).forEach(program => {
                claimsByCategory.shipmentException[program].forEach(claim => {
                    const status = claim.status360.toLowerCase();
                    if (replacementShipmentStatuses.includes(status)) {
                        if (!replacementShipmentExceptions[program]) {
                            replacementShipmentExceptions[program] = [];
                        }
                        replacementShipmentExceptions[program].push(claim);
                    } else {
                        if (!otherShipmentExceptions[program]) {
                            otherShipmentExceptions[program] = [];
                        }
                        otherShipmentExceptions[program].push(claim);
                    }
                });
            });

            const replacementShipmentCount = Object.values(replacementShipmentExceptions).flat().length;
            const otherShipmentCount = Object.values(otherShipmentExceptions).flat().length;

            // Store in window for export functionality
            window.replacementShipmentExceptions = replacementShipmentExceptions;
            window.otherShipmentExceptions = otherShipmentExceptions;

            const tab3HTML = `
                <div class="tab-content" id="liveTab_shipmentException">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; color: #333;">Shipment Exceptions</h3>
                        ${(replacementShipmentCount + otherShipmentCount) > 0 ? `
                            <button onclick="exportShipmentExceptions('all')"
                                    style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                📊 Export All Shipment Exceptions
                            </button>
                        ` : ''}
                    </div>

                    <!-- Replacement Shipment Exceptions Section -->
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <h4 style="margin: 0 0 5px 0; color: #92400e;">⚠️ Replacement Shipment Exceptions (${replacementShipmentCount})</h4>
                                <p style="font-size: 13px; color: #78350f; margin: 0;">
                                    Replacements created/authorized but not yet shipped - Verify Goldie portal for orders
                                </p>
                            </div>
                            ${replacementShipmentCount > 0 ? `
                                <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <label style="font-size: 12px; color: #78350f;">Recipients:</label>
                                        <input type="text" id="replacementShipmentRecipients"
                                               value="prakash.m@servify.com, parikshit.h@servify.com"
                                               style="padding: 6px 10px; border: 1px solid #d97706; border-radius: 4px; font-size: 12px; width: 300px;"
                                               placeholder="Enter email addresses (comma-separated)">
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="exportShipmentExceptions('replacement')"
                                                style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                            📊 Export to Excel
                                        </button>
                                        <button onclick="sendReplacementShipmentNotification()" id="notifyReplacementShipmentBtn"
                                                style="padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                            📧 Notify Team
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        ${replacementShipmentCount > 0 ? `
                            <div class="program-tabs-container">
                                ${createProgramSubTabs('replacementShipment', replacementShipmentExceptions)}
                                <div class="program-contents">
                                    ${Object.keys(replacementShipmentExceptions).sort().map((prog, idx) =>
                                        createProgramTabContent('replacementShipment', prog, replacementShipmentExceptions[prog], idx === 0)
                                    ).join('')}
                                </div>
                            </div>
                        ` : '<div class="no-mismatches">✅ No replacement shipment exceptions found</div>'}
                    </div>

                    <!-- Other Shipment Exceptions Section -->
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #6b7280;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <h4 style="margin: 0 0 5px 0; color: #374151;">📦 Other Shipment Exceptions (${otherShipmentCount})</h4>
                                <p style="font-size: 13px; color: #6b7280; margin: 0;">
                                    Delivery exceptions, collection issues, and other shipment problems
                                </p>
                            </div>
                            ${otherShipmentCount > 0 ? `
                                <button onclick="exportShipmentExceptions('other')"
                                        style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                    📊 Export to Excel
                                </button>
                            ` : ''}
                        </div>
                        ${otherShipmentCount > 0 ? `
                            <div class="program-tabs-container">
                                ${createProgramSubTabs('otherShipment', otherShipmentExceptions)}
                                <div class="program-contents">
                                    ${Object.keys(otherShipmentExceptions).sort().map((prog, idx) =>
                                        createProgramTabContent('otherShipment', prog, otherShipmentExceptions[prog], idx === 0)
                                    ).join('')}
                                </div>
                            </div>
                        ` : '<div class="no-mismatches">✅ No other shipment exceptions found</div>'}
                    </div>
                </div>
            `;

            // Tab 4: Return Exceptions with program sub-tabs
            let tab4ProgramContent = '';
            Object.keys(claimsByCategory.returnException).sort().forEach((prog, idx) => {
                tab4ProgramContent += createProgramTabContent('returnException', prog, claimsByCategory.returnException[prog], idx === 0);
            });

            const tab4HTML = `
                <div class="tab-content" id="liveTab_returnException">
                    <h3 style="margin-bottom: 15px; color: #333;">Return Device Exceptions</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 10px;">
                        Customers have received replacements but haven't returned defective devices
                    </p>
                    ${createProgramSubTabs('returnException', claimsByCategory.returnException)}
                    ${tab4ProgramContent || '<div class="no-mismatches">✅ No return exceptions found</div>'}
                </div>
            `;

            liveContent.innerHTML = `
                <h2 style="margin-bottom: 20px; color: #333;">${filterDesc} Operational Dashboard</h2>
                ${tabsHTML}
                ${tab1HTML}
                ${tab2HTML}
                ${tab3HTML}
                ${tab4HTML}
            `;
        }

        // Tab switching for Live Monitor (main tabs)
        function switchLiveTab(tabName) {
            // Hide all main tab contents
            document.querySelectorAll('[id^="liveTab_"]').forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all main tabs
            document.querySelectorAll('#liveMonitorContent > .tabs > .tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab content
            const tabContent = document.getElementById('liveTab_' + tabName);
            if (tabContent) {
                tabContent.classList.add('active');
            }

            // Set active tab button
            const tabButton = document.querySelector(`[onclick="switchLiveTab('${tabName}')"]`);
            if (tabButton) {
                tabButton.classList.add('active');
            }
        }

        // Tab switching for program sub-tabs within each category
        function switchProgramTab(category, program) {
            // For sub-categories within shipmentException, we need to handle them specially
            let parentTab;

            if (category === 'replacementShipment' || category === 'otherShipment') {
                // Both are within the shipmentException tab
                parentTab = document.getElementById('liveTab_shipmentException');
            } else {
                parentTab = document.getElementById('liveTab_' + category);
            }

            if (!parentTab) return;

            // Find the specific container for this category's program tabs
            const programTabPrefix = 'programTab_' + category + '_';

            // Hide all program tab contents for this specific category only
            parentTab.querySelectorAll(`[id^="${programTabPrefix}"]`).forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all program tabs for this specific category only
            // Find buttons that call switchProgramTab with this exact category
            parentTab.querySelectorAll(`.tab[onclick*="switchProgramTab('${category}'"]`).forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected program tab content
            const programTabId = programTabPrefix + program.replace(/\s+/g, '_');
            const programTabContent = document.getElementById(programTabId);
            if (programTabContent) {
                programTabContent.classList.add('active');
            }

            // Set active program tab button
            const programTabButton = parentTab.querySelector(`[onclick="switchProgramTab('${category}', '${program}')"]`);
            if (programTabButton) {
                programTabButton.classList.add('active');
            }
        }

        function scrollToBusinessUnit(businessUnit) {
            const element = document.getElementById('bu_' + businessUnit.replace(/\s+/g, '_'));
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function exportInterfaceFailures() {
            // TODO: Implement Excel export functionality
            alert('Excel export functionality will be implemented in the next update');
        }

        // Export shipment exceptions to Excel
        function exportShipmentExceptions(exceptionType) {
            try {
                let claims = [];
                let fileName = '';

                if (exceptionType === 'replacement') {
                    // Get all replacement shipment exceptions
                    Object.values(window.replacementShipmentExceptions || {}).forEach(programClaims => {
                        claims = claims.concat(programClaims);
                    });
                    fileName = 'Replacement_Shipment_Exceptions';
                } else if (exceptionType === 'other') {
                    // Get all other shipment exceptions
                    Object.values(window.otherShipmentExceptions || {}).forEach(programClaims => {
                        claims = claims.concat(programClaims);
                    });
                    fileName = 'Other_Shipment_Exceptions';
                } else if (exceptionType === 'all') {
                    // Get all shipment exceptions
                    Object.values(window.replacementShipmentExceptions || {}).forEach(programClaims => {
                        claims = claims.concat(programClaims);
                    });
                    Object.values(window.otherShipmentExceptions || {}).forEach(programClaims => {
                        claims = claims.concat(programClaims);
                    });
                    fileName = 'All_Shipment_Exceptions';
                }

                if (claims.length === 0) {
                    alert('No shipment exceptions to export');
                    return;
                }

                // Prepare data for export
                const exportData = claims.map(claim => ({
                    'Claim ID': claim.claimId,
                    'Business Unit': claim.businessUnit,
                    'Program': claim.program,
                    'Claim Type': claim.claimType,
                    '360 Status': claim.status360,
                    'Has Goldie Order': claim.hasGoldieOrder ? 'Yes' : 'No',
                    'Goldie Order Number': claim.goldieOrderNumber || '',
                    'Goldie Status': claim.goldieStatus || 'N/A',
                    'Goldie Delivery Status': claim.goldieDeliveryStatus || 'N/A',
                    'Delivery Mismatch': claim.isDeliveryMismatch ? 'YES - CRITICAL' : 'No',
                    'Created Date': claim.createdDate instanceof Date ?
                        claim.createdDate.toLocaleDateString('en-US') :
                        (claim.createdDate || 'N/A'),
                    'Days Old': claim.daysSinceCreated !== null ? claim.daysSinceCreated : 'N/A'
                }));

                // Create workbook and worksheet
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipment Exceptions');

                // Auto-size columns
                const maxWidth = 50;
                const colWidths = Object.keys(exportData[0]).map(key => {
                    const maxLength = Math.max(
                        key.length,
                        ...exportData.map(row => String(row[key] || '').length)
                    );
                    return { wch: Math.min(maxLength + 2, maxWidth) };
                });
                worksheet['!cols'] = colWidths;

                // Generate file name with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const fullFileName = `${fileName}_${timestamp}.xlsx`;

                // Download file
                XLSX.writeFile(workbook, fullFileName);

                alert(`Exported ${claims.length} shipment exception(s) to ${fullFileName}`);
            } catch (error) {
                console.error('Export error:', error);
                alert('Error exporting data: ' + error.message);
            }
        }

        // Chrome Extension Communication
        // Get extension ID from localStorage (configured in Settings page)
        function getExtensionId() {
            return localStorage.getItem('CHROME_EXTENSION_ID') || 'nflcnflijbghkjojnglpkgejjobihomf';
        }

        async function fetch360ClaimDetails(claimId) {
            console.log('Fetching 360 details for claim:', claimId);

            const EXTENSION_ID = getExtensionId();

            // Find the button and show loading state
            const button = event?.target;
            if (button) {
                button.disabled = true;
                button.textContent = '⏳ Fetching...';
                button.style.background = '#9ca3af';
            }

            try {
                // Try to communicate with Chrome extension
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    const response = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(
                            EXTENSION_ID,
                            { action: 'fetchClaim', claimId: claimId },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                } else {
                                    resolve(response);
                                }
                            }
                        );
                    });

                    if (response && response.success) {
                        // Reset button state
                        if (button) {
                            button.disabled = false;
                            button.textContent = '✅ Fetched';
                            button.style.background = '#10b981';
                            setTimeout(() => {
                                button.textContent = '📋 Fetch 360';
                                button.style.background = '#4f46e5';
                            }, 2000);
                        }
                        displayClaimDetails(claimId, response.data);
                        return response.data;
                    } else {
                        throw new Error(response?.error || 'Failed to fetch claim details');
                    }
                } else {
                    // Extension not available
                    if (confirm('360 Claim Fetcher Extension not detected!\n\n' +
                          '1. Make sure the extension is installed and enabled\n' +
                          '2. Configure your extension ID in Settings\n\n' +
                          'Click OK to open Settings page, or Cancel to dismiss.')) {
                        window.open('/settings.html', '_blank');
                    }
                    return null;
                }
            } catch (error) {
                console.error('Error fetching 360 details:', error);

                // Reset button state on error
                if (button) {
                    button.disabled = false;
                    button.textContent = '❌ Failed';
                    button.style.background = '#ef4444';
                    setTimeout(() => {
                        button.textContent = '📋 Fetch 360';
                        button.style.background = '#4f46e5';
                    }, 2000);
                }

                if (confirm(`Error fetching claim details: ${error.message}\n\n` +
                      'Make sure:\n' +
                      '1. Chrome extension is installed and enabled\n' +
                      '2. Extension ID is configured in Settings\n' +
                      '3. You are logged into 360 application\n\n' +
                      'Click OK to open Settings, or Cancel to dismiss.')) {
                    window.open('/settings.html', '_blank');
                }
                return null;
            }
        }

        function displayClaimDetails(claimId, claimData) {
            console.log('=== displayClaimDetails called ===');
            console.log('Claim ID:', claimId);
            console.log('Claim Data:', JSON.stringify(claimData, null, 2));

            // Find the claim row
            const claimRow = Array.from(document.querySelectorAll('tr')).find(row =>
                row.textContent.includes(claimId)
            );

            if (!claimRow) {
                console.error('❌ Claim row not found for:', claimId);
                console.error('Available rows:', Array.from(document.querySelectorAll('tr')).map(r => r.textContent.substring(0, 100)));
                return;
            }

            console.log('✅ Found claim row:', claimRow);

            // Check if details row already exists
            let detailsRow = claimRow.nextElementSibling;
            if (detailsRow && detailsRow.classList.contains('claim-details-row')) {
                // Toggle visibility
                if (detailsRow.style.display === 'none') {
                    detailsRow.style.display = '';
                } else {
                    detailsRow.style.display = 'none';
                }
                return;
            }

            // Create new details row
            detailsRow = document.createElement('tr');
            detailsRow.classList.add('claim-details-row');
            detailsRow.innerHTML = `
                <td colspan="9" style="padding: 0; background: #f9fafb; border-top: 2px solid #e5e7eb;">
                    <div style="padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h4 style="margin: 0; color: #111827; font-size: 14px;">
                                📋 360 Claim Details - ${claimData.referenceId || claimId}
                            </h4>
                            <span style="font-size: 11px; color: #6b7280;">
                                Fetched: ${new Date(claimData.scrapedAt).toLocaleString()}
                            </span>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                            <!-- Device Info -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">📱 Device Information</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Device:</strong> ${claimData.deviceInfo?.name || 'N/A'}</div>
                                    <div><strong>Brand:</strong> ${claimData.deviceInfo?.brand || 'N/A'}</div>
                                    <div><strong>IMEI:</strong> ${claimData.deviceInfo?.imei || 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Action Status -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">✅ Action Status</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Status:</strong> ${claimData.actionStatus || 'N/A'}</div>
                                    <div><strong>Date:</strong> ${claimData.actionDate || 'N/A'}</div>
                                    <div><strong>Service Center:</strong> ${claimData.serviceCenter || 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Schedule -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">📅 Schedule</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Date:</strong> ${claimData.schedule?.date || 'N/A'}</div>
                                    <div><strong>Slot:</strong> ${claimData.schedule?.slot || 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Delivery Address -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">📦 Delivery Address</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Name:</strong> ${claimData.deliveryAddress?.name || 'N/A'}</div>
                                    <div><strong>Contact:</strong> ${claimData.deliveryAddress?.contact || 'N/A'}</div>
                                    <div><strong>Address:</strong> ${claimData.deliveryAddress?.address || 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Return Address -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">🔄 Return Address (Service Center)</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Name:</strong> ${claimData.returnAddress?.name || 'N/A'}</div>
                                    <div><strong>Contact:</strong> ${claimData.returnAddress?.contact || 'N/A'}</div>
                                    <div><strong>Address:</strong> ${claimData.returnAddress?.address || 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Shipping Details -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">🚚 Replacement Shipment</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Logistics:</strong> ${claimData.shippingDetails?.replacementShipment?.logisticsPartner || 'NA'}</div>
                                    <div><strong>AWB:</strong> ${claimData.shippingDetails?.replacementShipment?.awbNumber || 'NA'}</div>
                                    ${claimData.shippingDetails?.replacementShipment?.awbNumber === 'NA' || !claimData.shippingDetails?.replacementShipment?.awbNumber ?
                                        '<div style="color: #dc2626; font-weight: 500; margin-top: 5px;">⚠️ Not shipped yet</div>' :
                                        `<button onclick="trackShipment('${claimData.shippingDetails.replacementShipment.logisticsPartner}', '${claimData.shippingDetails.replacementShipment.awbNumber}')"
                                                style="margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%;">
                                            🔍 Track Shipment
                                        </button>`
                                    }
                                </div>
                            </div>

                            <!-- Return Shipment -->
                            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                <h5 style="margin: 0 0 10px 0; color: #374151; font-size: 13px; font-weight: 600;">🔙 Return Shipment</h5>
                                <div style="font-size: 12px; color: #4b5563; line-height: 1.8;">
                                    <div><strong>Logistics:</strong> ${claimData.shippingDetails?.returnShipment?.logisticsPartner || 'NA'}</div>
                                    <div><strong>AWB:</strong> ${claimData.shippingDetails?.returnShipment?.awbNumber || 'NA'}</div>
                                    ${claimData.shippingDetails?.returnShipment?.awbNumber === 'NA' || !claimData.shippingDetails?.returnShipment?.awbNumber ?
                                        '' :
                                        `<button onclick="trackShipment('${claimData.shippingDetails.returnShipment.logisticsPartner}', '${claimData.shippingDetails.returnShipment.awbNumber}')"
                                                style="margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; width: 100%;">
                                            🔍 Track Shipment
                                        </button>`
                                    }
                                </div>
                            </div>
                        </div>

                        <button onclick="this.closest('.claim-details-row').style.display='none'"
                                style="margin-top: 15px; padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                            Close Details
                        </button>
                    </div>
                </td>
            `;

            claimRow.parentNode.insertBefore(detailsRow, claimRow.nextSibling);
            console.log('✅ Details row inserted successfully');
        }

        // Send pre-processing claims notification email
        async function sendPreProcessingNotification() {
            console.log('Sending pre-processing notification...');

            const button = document.getElementById('notifyPreProcessingBtn');
            if (!button) return;

            // Check if claims data is available
            if (!currentClaimsData || !currentClaimsData.preProcessing) {
                alert('No claims data available. Please refresh the Live Monitor.');
                return;
            }

            // Get pre-processing claims
            const preProcessingClaims = currentClaimsData.preProcessing;
            if (Object.keys(preProcessingClaims).length === 0) {
                alert('No pre-processing claims to notify about.');
                return;
            }

            // Show loading state
            button.disabled = true;
            button.innerHTML = '⏳ Sending...';
            button.style.background = '#9ca3af';

            try {
                // Format claims data for email with customer info
                const formattedClaims = {};
                Object.keys(preProcessingClaims).forEach(program => {
                    formattedClaims[program] = preProcessingClaims[program].map(claim => {
                        // Format date
                        let formattedDate = 'N/A';
                        if (claim.createdDate) {
                            const dateObj = claim.createdDate instanceof Date ? claim.createdDate : new Date(claim.createdDate);
                            if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2000) {
                                formattedDate = dateObj.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                });
                            }
                        }

                        // Try to get customer name from advance data
                        let customerName = 'N/A';
                        if (claim.advanceData) {
                            // Try to build full name from first and last name
                            const firstName = claim.advanceData['Customer First Name'] || '';
                            const lastName = claim.advanceData['Customer Last Name'] || '';

                            if (firstName || lastName) {
                                customerName = [firstName, lastName].filter(n => n).join(' ').trim();
                            } else {
                                // Fallback to other fields
                                customerName = claim.advanceData['Customer Name'] ||
                                             claim.advanceData['Consumer Name'] ||
                                             claim.advanceData['Name'] ||
                                             claim.advanceData['Customer Email']?.split('@')[0] ||
                                             claim.advanceData['Contact Name'] ||
                                             'N/A';
                            }
                        }

                        return {
                            claimId: claim.claimId,
                            program: claim.program || program,
                            customer: customerName,
                            claimType: claim.claimType,
                            status360: claim.status360,
                            createdDate: formattedDate,
                            daysSinceCreated: claim.daysSinceCreated
                        };
                    });
                });

                console.log('Sending notification for claims:', formattedClaims);

                // Send to API
                const response = await fetch('/api/notify/preprocessing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        claimsData: formattedClaims
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Success state
                    button.innerHTML = '✅ Sent!';
                    button.style.background = '#10b981';

                    // Show success message
                    alert(`Email notification sent successfully!\n\nRecipients: ${result.recipients || 'Default recipients'}\nMessage ID: ${result.messageId}`);

                    // Reset button after 3 seconds
                    setTimeout(() => {
                        button.innerHTML = '📧 Notify Team';
                        button.disabled = false;
                    }, 3000);
                } else {
                    throw new Error(result.error || 'Failed to send notification');
                }

            } catch (error) {
                console.error('Error sending notification:', error);

                // Error state
                button.innerHTML = '❌ Failed';
                button.style.background = '#ef4444';

                alert(`Failed to send notification: ${error.message}\n\nPlease check:\n• Server is running\n• Email credentials are configured\n• Network connection is active`);

                // Reset button after 3 seconds
                setTimeout(() => {
                    button.innerHTML = '📧 Notify Team';
                    button.style.background = '#10b981';
                    button.disabled = false;
                }, 3000);
            }
        }

        // Generic function to send notification for any category
        async function sendCategoryNotification(category) {
            console.log(`Sending ${category} notification...`);

            const buttonId = `notify${category.charAt(0).toUpperCase() + category.slice(1)}Btn`;
            const button = document.getElementById(buttonId);
            if (!button) return;

            // Check if claims data is available
            if (!currentClaimsData || !currentClaimsData[category]) {
                alert('No claims data available. Please refresh the Live Monitor.');
                return;
            }

            // Get claims for this category
            const categoryClaims = currentClaimsData[category];
            if (Object.keys(categoryClaims).length === 0) {
                alert(`No ${category} claims to notify about.`);
                return;
            }

            // Get custom recipients if available (for replacementCreated, etc.)
            let recipients = null;
            const recipientsInput = document.getElementById(`${category}Recipients`);
            if (recipientsInput) {
                recipients = recipientsInput.value.trim();
                if (!recipients) {
                    alert('Please enter at least one email address.');
                    return;
                }
            }

            // Show loading state
            button.disabled = true;
            button.innerHTML = '⏳ Sending...';
            button.style.background = '#9ca3af';

            try {
                // Format claims data for email with customer info
                const formattedClaims = {};
                Object.keys(categoryClaims).forEach(program => {
                    formattedClaims[program] = categoryClaims[program].map(claim => {
                        // Format date
                        let formattedDate = 'N/A';
                        if (claim.createdDate) {
                            const dateObj = claim.createdDate instanceof Date ? claim.createdDate : new Date(claim.createdDate);
                            if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2000) {
                                formattedDate = dateObj.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                });
                            }
                        }

                        // Try to get customer name from advance data
                        let customerName = 'N/A';
                        if (claim.advanceData) {
                            // Try to build full name from first and last name
                            const firstName = claim.advanceData['Customer First Name'] || '';
                            const lastName = claim.advanceData['Customer Last Name'] || '';

                            if (firstName || lastName) {
                                customerName = [firstName, lastName].filter(n => n).join(' ').trim();
                            } else {
                                // Fallback to other fields
                                customerName = claim.advanceData['Customer Name'] ||
                                             claim.advanceData['Consumer Name'] ||
                                             claim.advanceData['Name'] ||
                                             claim.advanceData['Customer Email']?.split('@')[0] ||
                                             claim.advanceData['Contact Name'] ||
                                             'N/A';
                            }
                        }

                        return {
                            claimId: claim.claimId,
                            program: claim.program || program,
                            customer: customerName,
                            claimType: claim.claimType,
                            status360: claim.status360,
                            createdDate: formattedDate,
                            daysSinceCreated: claim.daysSinceCreated
                        };
                    });
                });

                console.log(`Sending ${category} notification for claims:`, formattedClaims);

                // Prepare request body
                const requestBody = {
                    claimsData: formattedClaims,
                    category: category
                };

                // Add custom recipients if provided
                if (recipients) {
                    requestBody.recipients = recipients;
                }

                // Send to API
                const response = await fetch('/api/notify/preprocessing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                const result = await response.json();

                if (result.success) {
                    // Success state
                    button.innerHTML = '✅ Sent!';
                    button.style.background = '#10b981';

                    // Show success message
                    alert(`Email notification sent successfully!\n\nRecipients: ${result.recipients || 'Default recipients'}\nMessage ID: ${result.messageId}`);

                    // Reset button after 3 seconds
                    setTimeout(() => {
                        button.innerHTML = '📧 Notify Team';
                        button.disabled = false;
                    }, 3000);
                } else {
                    throw new Error(result.error || 'Failed to send notification');
                }

            } catch (error) {
                console.error('Error sending notification:', error);

                // Error state
                button.innerHTML = '❌ Failed';
                button.style.background = '#ef4444';

                alert(`Failed to send notification: ${error.message}\n\nPlease check:\n• Server is running\n• Email credentials are configured\n• Network connection is active`);

                // Reset button after 3 seconds
                setTimeout(() => {
                    button.innerHTML = '📧 Notify Team';
                    button.style.background = '#10b981';
                    button.disabled = false;
                }, 3000);
            }
        }

        // Send replacement shipment exception notification (for sub-category)
        async function sendReplacementShipmentNotification() {
            console.log('Sending replacement shipment exception notification...');

            const button = document.getElementById('notifyReplacementShipmentBtn');
            if (!button) return;

            // Check if claims data is available
            if (!currentClaimsData || !currentClaimsData.shipmentException) {
                alert('No claims data available. Please refresh the Live Monitor.');
                return;
            }

            // Filter only replacement shipment exceptions
            const replacementShipmentStatuses = ['replacement request raised', 'replacement authorized'];
            const replacementShipmentClaims = {};

            Object.keys(currentClaimsData.shipmentException).forEach(program => {
                const filteredClaims = currentClaimsData.shipmentException[program].filter(claim =>
                    replacementShipmentStatuses.includes(claim.status360.toLowerCase())
                );
                if (filteredClaims.length > 0) {
                    replacementShipmentClaims[program] = filteredClaims;
                }
            });

            if (Object.keys(replacementShipmentClaims).length === 0) {
                alert('No replacement shipment exceptions to notify about.');
                return;
            }

            // Get custom recipients
            const recipientsInput = document.getElementById('replacementShipmentRecipients');
            if (!recipientsInput) return;

            const recipients = recipientsInput.value.trim();
            if (!recipients) {
                alert('Please enter at least one email address.');
                return;
            }

            // Show loading state
            button.disabled = true;
            button.innerHTML = '⏳ Sending...';
            button.style.background = '#9ca3af';

            try {
                // Format claims data for email with customer info
                const formattedClaims = {};
                Object.keys(replacementShipmentClaims).forEach(program => {
                    formattedClaims[program] = replacementShipmentClaims[program].map(claim => {
                        // Format date
                        let formattedDate = 'N/A';
                        if (claim.createdDate) {
                            const dateObj = claim.createdDate instanceof Date ? claim.createdDate : new Date(claim.createdDate);
                            if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 2000) {
                                formattedDate = dateObj.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                });
                            }
                        }

                        // Try to get customer name from advance data
                        let customerName = 'N/A';
                        if (claim.advanceData) {
                            const firstName = claim.advanceData['Customer First Name'] || '';
                            const lastName = claim.advanceData['Customer Last Name'] || '';

                            if (firstName || lastName) {
                                customerName = [firstName, lastName].filter(n => n).join(' ').trim();
                            } else {
                                customerName = claim.advanceData['Customer Name'] ||
                                             claim.advanceData['Consumer Name'] ||
                                             claim.advanceData['Name'] ||
                                             claim.advanceData['Customer Email']?.split('@')[0] ||
                                             claim.advanceData['Contact Name'] ||
                                             'N/A';
                            }
                        }

                        return {
                            claimId: claim.claimId,
                            program: claim.program || program,
                            customer: customerName,
                            claimType: claim.claimType,
                            status360: claim.status360,
                            createdDate: formattedDate,
                            daysSinceCreated: claim.daysSinceCreated
                        };
                    });
                });

                console.log('Sending replacement shipment notification for claims:', formattedClaims);

                // Send to API
                const response = await fetch('/api/notify/preprocessing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        claimsData: formattedClaims,
                        category: 'replacementShipment',
                        recipients: recipients
                    })
                });

                const result = await response.json();

                if (result.success) {
                    // Success state
                    button.innerHTML = '✅ Sent!';
                    button.style.background = '#f59e0b';

                    // Show success message
                    alert(`Email notification sent successfully!\n\nRecipients: ${result.recipients || recipients}\nMessage ID: ${result.messageId}`);

                    // Reset button after 3 seconds
                    setTimeout(() => {
                        button.innerHTML = '📧 Notify Team';
                        button.disabled = false;
                    }, 3000);
                } else {
                    throw new Error(result.error || 'Failed to send notification');
                }

            } catch (error) {
                console.error('Error sending notification:', error);

                // Error state
                button.innerHTML = '❌ Failed';
                button.style.background = '#ef4444';

                alert(`Failed to send notification: ${error.message}\n\nPlease check:\n• Server is running\n• Email credentials are configured\n• Network connection is active`);

                // Reset button after 3 seconds
                setTimeout(() => {
                    button.innerHTML = '📧 Notify Team';
                    button.style.background = '#f59e0b';
                    button.disabled = false;
                }, 3000);
            }
        }

        // Track shipment by opening carrier's tracking page
        function trackShipment(carrier, awbNumber) {
            console.log('Tracking shipment:', carrier, awbNumber);

            if (!awbNumber || awbNumber === 'NA') {
                alert('No tracking number available for this shipment');
                return;
            }

            // Remove any whitespace from tracking number
            const trackingNumber = awbNumber.trim();
            let trackingUrl = '';

            // Normalize carrier name to lowercase for comparison
            const carrierLower = carrier.toLowerCase().trim();

            // Build tracking URL based on carrier
            if (carrierLower.includes('fedex')) {
                trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
            } else if (carrierLower.includes('usps')) {
                trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
            } else if (carrierLower.includes('ups')) {
                trackingUrl = `https://www.ups.com/track?tracknum=${trackingNumber}`;
            } else if (carrierLower.includes('dhl')) {
                trackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
            } else if (carrierLower.includes('amazon')) {
                trackingUrl = `https://track.amazon.com/tracking/${trackingNumber}`;
            } else {
                // Generic Google search as fallback
                trackingUrl = `https://www.google.com/search?q=${encodeURIComponent(carrier + ' tracking ' + trackingNumber)}`;
            }

            console.log('Opening tracking URL:', trackingUrl);
            window.open(trackingUrl, '_blank');
        }

        // Make functions globally accessible for onclick handlers
        window.switchLiveTab = switchLiveTab;
        window.switchProgramTab = switchProgramTab;
        window.refreshLiveMonitor = refreshLiveMonitor;
        window.exportInterfaceFailures = exportInterfaceFailures;
        window.fetch360ClaimDetails = fetch360ClaimDetails;
        window.trackShipment = trackShipment;
        window.sendPreProcessingNotification = sendPreProcessingNotification;
        window.sendCategoryNotification = sendCategoryNotification;
        window.sendReplacementShipmentNotification = sendReplacementShipmentNotification;

// Adapt functions to new dashboard structure
// (Removed auto-navigation to mapping - now goes to Live Monitor instead)

// No need to override processReports or populateColumnSelectors - navigation handled in loadFilesAndShowMapping

