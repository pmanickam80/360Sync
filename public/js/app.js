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
        'mapping': 'mappingSection',
        'status': 'statusSection',
        'analysis': 'analysisSection'
    };

    const section = document.getElementById(sectionMap[sectionName]);
    if (section) {
        section.classList.add('active');
    }

    // Set active nav item
    if (event && event.target) {
        const navItem = event.target.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
        }
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
            // Status: "Service Completed" - Security deposit released, claim closed
            'service completed': [
                'delivered',  // Replacement delivered successfully
                'delivered',
                'delivered'
            ],

            'security deposit released': [
                'delivered',  // Released after defective received and accepted
                'delivered',
                'delivered'
            ],

            'security deposit charged': [
                'delivered',  // Charged when customer didn't return defective
                'delivered',
                'delivered'
            ],

            // ========== REFURB PHASE ==========
            // Defective device goes through reverse logistics
            'refurb request created': [
                'delivered',  // Original exchange completed
                'delivered',
                'delivered'
            ],

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
                            const workbook = XLSX.read(data, { type: 'array' });
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
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
            const processBtn = document.getElementById('processBtn');
            processBtn.disabled = true;
            processBtn.textContent = 'Loading files...';

            try {
                // Parse all advance exchange files
                advanceExchangeData = [];
                for (const file of advanceExchangeFiles) {
                    const data = await parseFile(file);
                    advanceExchangeData = advanceExchangeData.concat(data);
                }

                // Parse all sales order files
                salesOrderData = [];
                for (const file of salesOrderFiles) {
                    const data = await parseFile(file);
                    salesOrderData = salesOrderData.concat(data);
                }

                // Show column mapping UI
                populateColumnSelectors();
                const columnMapping = document.getElementById('columnMapping');
                if (columnMapping) {
                    columnMapping.classList.add('show');
                }

                processBtn.disabled = false;
                processBtn.textContent = 'Process All Reports';
                processBtn.onclick = processReports;

            } catch (error) {
                alert(`Error loading files: ${error.message}`);
                processBtn.disabled = false;
                processBtn.textContent = 'Process All Reports';
            }
        }

        function populateColumnSelectors() {
            const advanceColumns = Object.keys(advanceExchangeData[0] || {});
            const salesColumns = Object.keys(salesOrderData[0] || {});

            // Auto-detect columns
            const advClaimIdCol = findColumn(advanceColumns, [
                ['claim', 'id'], 'claim number', 'reference', 'referenceid', 'claim#', 'claimnumber', 'claim', 'id', 'ref'
            ]);
            const advStatusCol = findColumn(advanceColumns, ['status', 'state', 'claim status', 'csr status']);
            const advProgramCol = findColumn(advanceColumns, ['program', 'programme', 'plan', 'program name']);

            const salesClaimIdCol = findColumn(salesColumns, [
                'customerpo', 'customer po', ['customer', 'po'],
                ['claim', 'id'], 'claim number', 'reference', 'referenceid', 'claim#', 'claimnumber',
                'order no', 'order number', 'invoice', 'project number', 'claim', 'id', 'ref'
            ]);
            const salesStatusCol = findColumn(salesColumns, ['status', 'state', 'fulfillment', 'delivery status', 'order status']);
            const salesProgramCol = findColumn(salesColumns, ['program', 'programme', 'plan', 'program name', 'project']);

            // Populate 360 dropdowns
            populateDropdown('advance360ClaimId', advanceColumns, advClaimIdCol);
            populateDropdown('advance360Status', advanceColumns, advStatusCol);
            populateDropdown('advance360Program', advanceColumns, advProgramCol);

            // Populate Sales Order dropdowns
            populateDropdown('salesOrderClaimId', salesColumns, salesClaimIdCol);
            populateDropdown('salesOrderStatus', salesColumns, salesStatusCol);
            populateDropdown('salesOrderProgram', salesColumns, salesProgramCol);

            // Show unique statuses
            showUniqueStatuses(advStatusCol, salesStatusCol);
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

        function showUniqueStatuses(advStatusCol, salesStatusCol) {
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

            const sorted360 = Array.from(statuses360).sort();
            const sortedGoldie = Array.from(statusesGoldie).sort();

            // Display in results section
            const resultsSection = document.getElementById('resultsSection');
            if (!resultsSection) return; // Exit if element doesn't exist

            resultsSection.classList.add('show');
            resultsSection.innerHTML = `
                <h2 style="margin-bottom: 20px; color: #333;">Status Mapping & Business Rules</h2>

                <div class="debug-section">
                    <h3>All Unique Statuses Found</h3>

                    <div class="status-columns">
                        <div class="status-column">
                            <h4>360 Statuses (${statuses360.size} unique)</h4>
                            ${sorted360.map(s => `<div class="status-item">${s}</div>`).join('')}
                        </div>
                        <div class="status-column">
                            <h4>Goldie Statuses (${statusesGoldie.size} unique)</h4>
                            ${sortedGoldie.map(s => `<div class="status-item goldie">${s}</div>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="debug-section" style="margin-top: 20px;">
                    <h3>Business Rule Mapping Table</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 10px;">
                        Define which Goldie statuses are valid for each 360 status. Enter comma-separated Goldie status values.
                    </p>

                    <table class="status-mapping-table">
                        <thead>
                            <tr>
                                <th style="width: 30%;">360 Status</th>
                                <th style="width: 70%;">Valid Goldie Statuses (comma-separated)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sorted360.map((status360, idx) => {
                                const normalized = status360.toLowerCase().trim();
                                const existing = STATUS_MAPPINGS[normalized] || [];
                                return `
                                    <tr>
                                        <td><strong>${status360}</strong></td>
                                        <td>
                                            <textarea
                                                class="mapping-input"
                                                id="mapping_${idx}"
                                                placeholder="Enter valid Goldie statuses (e.g., Delivered, DELIVERED, On the way)"
                                            >${existing.join(', ')}</textarea>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>

                    <button
                        class="process-btn"
                        style="margin-top: 20px; width: auto; padding: 12px 30px;"
                        onclick="updateMappingsFromTable()"
                    >
                        Update Business Rules & Analyze
                    </button>
                </div>

                <div class="debug-section" style="margin-top: 20px;">
                    <h3>Current Business Rules (JSON)</h3>
                    <div class="sample-data" id="currentRulesJSON">
${JSON.stringify(STATUS_MAPPINGS, null, 2)}
                    </div>
                    <p style="margin-top: 10px; font-size: 12px; color: #666;">
                        This shows the current mapping rules. Update the table above and click "Update Business Rules & Analyze" to apply changes.
                    </p>
                </div>
            `;

            // Store statuses for later use
            window.sorted360Statuses = sorted360;
            window.sortedGoldieStatuses = sortedGoldie;
        }

        function updateMappingsFromTable() {
            const sorted360 = window.sorted360Statuses;

            // Read mappings from table
            sorted360.forEach((status360, idx) => {
                const input = document.getElementById(`mapping_${idx}`);
                if (input) {
                    const value = input.value.trim();
                    const normalized360 = status360.toLowerCase().trim();

                    if (value) {
                        // Parse comma-separated values
                        const goldieStatuses = value.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
                        STATUS_MAPPINGS[normalized360] = goldieStatuses;
                    } else {
                        // Remove mapping if empty
                        delete STATUS_MAPPINGS[normalized360];
                    }
                }
            });

            // Update the JSON display
            const currentRulesJSON = document.getElementById('currentRulesJSON');
            if (currentRulesJSON) {
                currentRulesJSON.textContent = JSON.stringify(STATUS_MAPPINGS, null, 2);
            }

            // Show success message and process
            alert('Business rules updated! Now analyzing data...');
            processReports();
        }

        async function processReports() {
            const resultsSection = document.getElementById('resultsSection');
            if (!resultsSection) return; // Exit if element doesn't exist

            resultsSection.classList.add('show');
            resultsSection.innerHTML = '<div class="loading">Processing reports...</div>';

            try {
                // Now process the combined data with user-selected columns
                analyzeData();

            } catch (error) {
                resultsSection.innerHTML = `
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
                        return pattern.every(p => lowerCol.includes(p));
                    }
                    return lowerCol.includes(pattern);
                });
                if (found) return found;
            }
            return columns[0]; // fallback to first column
        }

        function analyzeData() {
            try {
                // Get selected columns from dropdowns
                const advClaimIdCol = document.getElementById('advance360ClaimId').value;
                const advStatusCol = document.getElementById('advance360Status').value;
                const advProgramCol = document.getElementById('advance360Program').value;

                const claimIdCol = document.getElementById('salesOrderClaimId').value;
                const statusCol = document.getElementById('salesOrderStatus').value;
                const programCol = document.getElementById('salesOrderProgram').value;

                // Create debug info
                const debugInfo = {
                    advance360: {
                        totalRecords: advanceExchangeData.length,
                        detectedColumns: {
                            claimId: advClaimIdCol,
                            status: advStatusCol,
                            program: advProgramCol
                        },
                        sampleClaimId: advanceExchangeData[0][advClaimIdCol]
                    },
                    salesOrder: {
                        totalRecords: salesOrderData.length,
                        detectedColumns: {
                            claimId: claimIdCol,
                            status: statusCol,
                            program: programCol
                        },
                        sampleClaimId: salesOrderData[0][claimIdCol]
                    }
                };

                // Create a map of sales order data by claim ID
                const salesOrderMap = new Map();
                salesOrderData.forEach(row => {
                    const claimId = normalizeClaimId(row[claimIdCol]);
                    if (claimId) {
                        salesOrderMap.set(claimId, {
                            program: row[programCol] || 'Unknown',
                            status: row[statusCol] || '',
                            data: row
                        });
                    }
                });

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

                displayResults(interfaceFailures, statusMismatches, totalRecords, totalMatched,
                              totalInterfaceFailures, totalStatusMismatches, debugInfo);

            } catch (error) {
                const resultsSection = document.getElementById('resultsSection');
                if (resultsSection) {
                    resultsSection.innerHTML = `
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
            const resultsSection = document.getElementById('resultsSection');
            if (!resultsSection) return; // Exit if element doesn't exist

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

            resultsSection.innerHTML = `
                <h2 style="margin-bottom: 20px; color: #333;">Analysis Results</h2>
                ${tabsHTML}
                ${overviewHTML}
                ${programTabsHTML}
                ${businessRulesHTML}
            `;
        }

// Adapt functions to new dashboard structure
const originalLoadFilesAndShowMapping = loadFilesAndShowMapping;
loadFilesAndShowMapping = async function() {
    await originalLoadFilesAndShowMapping();
    // Auto-navigate to mapping section after loading files
    setTimeout(() => {
        const mappingNav = document.querySelector('[onclick="showSection(\'mapping\')"]');
        if (mappingNav) {
            mappingNav.click();
        }
    }, 500);
};

// Override results display to show in analysis section
const originalProcessReports = processReports;
processReports = async function() {
    // Navigate to analysis section
    const analysisNav = document.querySelector('[onclick="showSection(\'analysis\')"]');
    if (analysisNav) {
        analysisNav.click();
    }

    // Update results content target
    const resultsSection = document.getElementById('resultsContent');
    const originalResultsSection = document.getElementById('resultsSection');

    if (resultsSection && originalResultsSection) {
        originalResultsSection.id = 'resultsContent-original';
        resultsSection.id = 'resultsSection';
    }

    await originalProcessReports();

    // Restore IDs
    const currentResultsSection = document.getElementById('resultsSection');
    const renamedSection = document.getElementById('resultsContent-original');

    if (currentResultsSection && renamedSection) {
        currentResultsSection.id = 'resultsContent';
        renamedSection.id = 'resultsSection';
    }
};

// Override column mapping display
const originalPopulateColumnSelectors = populateColumnSelectors;
populateColumnSelectors = function() {
    // Move column mapping content to mapping section
    const mappingContent = document.getElementById('columnMappingContent');
    if (mappingContent && document.getElementById('columnMapping')) {
        mappingContent.innerHTML = document.getElementById('columnMapping').outerHTML;
        document.getElementById('columnMapping').style.display = 'block';
    }

    originalPopulateColumnSelectors();
};

// Override status mapping display
const originalShowUniqueStatuses = showUniqueStatuses;
showUniqueStatuses = function(advStatusCol, salesStatusCol) {
    // Store original results section
    const originalResultsSection = document.getElementById('resultsSection');
    const statusMappingContent = document.getElementById('statusMappingContent');

    if (statusMappingContent && originalResultsSection) {
        // Temporarily redirect resultsSection
        originalResultsSection.id = 'resultsSection-temp';
        statusMappingContent.id = 'resultsSection';
    }

    originalShowUniqueStatuses(advStatusCol, salesStatusCol);

    const tempSection = document.getElementById('resultsSection-temp');
    const currentStatusSection = document.getElementById('resultsSection');

    if (tempSection && currentStatusSection) {
        // Restore IDs
        currentStatusSection.id = 'statusMappingContent';
        tempSection.id = 'resultsSection';
    }
};

