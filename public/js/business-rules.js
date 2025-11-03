// Business Rules Management System
// Manages status mappings, validation, import/export, and audit logging

// Initialize audit log
let auditLog = [];

// Load rules from localStorage on startup
function loadRulesFromStorage() {
    const saved = localStorage.getItem('businessRules');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Error loading rules from storage:', e);
            return null;
        }
    }
    return null;
}

// Load default rules based on SOP-002
function loadDefaultRules() {
    const defaultRules = {
        // PRE-ORDER PHASE (No Goldie Activity Expected)
        'cancelled': [],
        'denied - no claim number': [],
        'duplicate claim': [],
        'not entitled': [],
        'not verified': [],
        'payment pending': [],
        'pending': [],
        'pending verification': [],
        'under review': [],
        'verification failed': [],
        'verification pending': [],

        // AUTHORIZATION PHASE
        'replacement authorized': ['shipment information sent to fedex', 'picked up', 'on the way'],
        'authorized': ['shipment information sent to fedex', 'picked up', 'on the way'],
        'approved': ['shipment information sent to fedex', 'picked up', 'on the way'],

        // SHIPMENT PHASE
        'device dispatched': ['on the way', 'departed fedex location', 'on fedex vehicle for delivery', 'in transit'],
        'in transit': ['on the way', 'departed fedex location', 'on fedex vehicle for delivery'],
        'shipped': ['on the way', 'departed fedex location', 'on fedex vehicle for delivery'],

        // DELIVERY PHASE
        'out for delivery': ['on fedex vehicle for delivery', 'delivery updated'],
        'device delivered': ['delivered'],
        'delivered': ['delivered'],

        // COMPLETION PHASE
        'service completed': ['delivered'],
        'closed': ['delivered'],
        'completed': ['delivered'],

        // EXCEPTION HANDLING
        'delivery exception': ['delivery exception', 'delivery updated', 'the package was refused by the receiver and will be returned to the sender'],
        'failed delivery': ['delivery exception', 'delivery updated'],
        'return to sender': ['the package was refused by the receiver and will be returned to the sender']
    };

    // Update STATUS_MAPPINGS
    Object.assign(STATUS_MAPPINGS, defaultRules);

    // Render the table
    renderBusinessRulesTable();

    // Add audit log entry
    addAuditLog('Loaded default business rules (SOP-002 based)', null, null);

    alert('Default business rules loaded successfully! Total rules: ' + Object.keys(defaultRules).length);
}

// Categorize status by phase for color coding
function getStatusPhase(status360, goldieStatuses) {
    const statusLower = status360.toLowerCase();

    // Pre-order phase (no Goldie expected)
    if (goldieStatuses.length === 0) {
        return { phase: 'pre-order', color: '#f3f4f6', label: 'Pre-Order', icon: '⏳' };
    }

    // Authorization phase
    if (statusLower.includes('authorized') || statusLower.includes('approved')) {
        return { phase: 'authorization', color: '#dbeafe', label: 'Authorization', icon: '✅' };
    }

    // Shipment phase
    if (statusLower.includes('dispatch') || statusLower.includes('transit') || statusLower.includes('shipped')) {
        return { phase: 'shipment', color: '#fef3c7', label: 'Shipment', icon: '📦' };
    }

    // Delivery phase
    if (statusLower.includes('delivery') || statusLower.includes('delivered')) {
        return { phase: 'delivery', color: '#d1fae5', label: 'Delivery', icon: '🚚' };
    }

    // Completion phase
    if (statusLower.includes('completed') || statusLower.includes('closed') || statusLower.includes('service completed')) {
        return { phase: 'completion', color: '#dcfce7', label: 'Completed', icon: '✔️' };
    }

    // Exception handling
    if (statusLower.includes('exception') || statusLower.includes('failed') || statusLower.includes('return')) {
        return { phase: 'exception', color: '#fee2e2', label: 'Exception', icon: '⚠️' };
    }

    // Default
    return { phase: 'other', color: '#f9fafb', label: 'Other', icon: '📋' };
}

// Get phase sort order (0 = first, 5 = last)
function getPhaseSortOrder(status360, goldieStatuses) {
    const phaseInfo = getStatusPhase(status360, goldieStatuses);
    const phaseOrder = {
        'pre-order': 0,
        'authorization': 1,
        'shipment': 2,
        'delivery': 3,
        'completion': 4,
        'exception': 5,
        'other': 6
    };
    return phaseOrder[phaseInfo.phase] || 999;
}

// Filter rules based on search and phase
function filterBusinessRules() {
    const searchText = document.getElementById('ruleSearchInput')?.value.toLowerCase() || '';
    const selectedPhases = Array.from(document.querySelectorAll('.phase-filter-btn.active')).map(btn => btn.dataset.phase);

    const allRows = document.querySelectorAll('#businessRulesTableBody tr');
    let visibleCount = 0;

    allRows.forEach(row => {
        if (row.classList.contains('phase-header')) {
            // Phase headers are always visible
            row.style.display = '';
            return;
        }

        const status360 = row.dataset.status360 || '';
        const goldieStatuses = row.dataset.goldieStatuses || '';
        const phase = row.dataset.phase || '';

        const matchesSearch = !searchText ||
            status360.toLowerCase().includes(searchText) ||
            goldieStatuses.toLowerCase().includes(searchText);

        const matchesPhase = selectedPhases.length === 0 || selectedPhases.includes(phase);

        if (matchesSearch && matchesPhase) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update visible count
    const countElement = document.getElementById('visibleRulesCount');
    if (countElement) {
        countElement.textContent = visibleCount;
    }

    // Hide/show phase headers based on whether they have visible rules
    document.querySelectorAll('.phase-header').forEach(header => {
        const phase = header.dataset.phase;
        const hasVisibleRules = Array.from(allRows).some(row =>
            !row.classList.contains('phase-header') &&
            row.dataset.phase === phase &&
            row.style.display !== 'none'
        );
        header.style.display = hasVisibleRules ? '' : 'none';
    });
}

// Toggle phase filter
function togglePhaseFilter(phase) {
    const button = document.querySelector(`.phase-filter-btn[data-phase="${phase}"]`);
    if (button) {
        button.classList.toggle('active');
        filterBusinessRules();
    }
}

// Clear all filters
function clearAllFilters() {
    document.getElementById('ruleSearchInput').value = '';
    document.querySelectorAll('.phase-filter-btn').forEach(btn => btn.classList.remove('active'));
    filterBusinessRules();
}

// Render the business rules table with improved UI
function renderBusinessRulesTable() {
    const container = document.getElementById('businessRulesTable');
    if (!container) return;

    // Sort by phase order first, then alphabetically within each phase
    const rules = Object.entries(STATUS_MAPPINGS).sort((a, b) => {
        const phaseOrderA = getPhaseSortOrder(a[0], a[1]);
        const phaseOrderB = getPhaseSortOrder(b[0], b[1]);

        if (phaseOrderA !== phaseOrderB) {
            return phaseOrderA - phaseOrderB;
        }

        // Same phase, sort alphabetically
        return a[0].localeCompare(b[0]);
    });

    // Add help/explanation section at the top
    let html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px;">📚 What are Business Rules?</h3>
            <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.6; opacity: 0.95;">
                Business rules define the <strong>expected synchronization behavior</strong> between 360 Advance Exchange and Goldie Sales Order systems.
                Each rule maps a <strong>360 status</strong> to the <strong>valid Goldie statuses</strong> that should exist when claims are synchronized.
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
                    <div style="font-weight: 600; margin-bottom: 5px;">✅ Match Found</div>
                    <div style="font-size: 13px; opacity: 0.9;">The Goldie status matches one of the expected statuses → <strong>Normal operation</strong></div>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
                    <div style="font-weight: 600; margin-bottom: 5px;">❌ Mismatch Detected</div>
                    <div style="font-size: 13px; opacity: 0.9;">The Goldie status doesn't match any expected status → <strong>Synchronization failure</strong></div>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 6px;">
                    <div style="font-weight: 600; margin-bottom: 5px;">⏳ No Match Expected</div>
                    <div style="font-size: 13px; opacity: 0.9;">Empty Goldie statuses = Pre-order phase → <strong>No sync required</strong></div>
                </div>
            </div>
        </div>

        <!-- Quick Start Guide -->
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0; color: #065f46; font-size: 15px;">🚀 Quick Start Guide</h4>
            <ol style="margin: 0; padding-left: 20px; color: #064e3b; font-size: 13px; line-height: 1.8;">
                <li><strong>Click "Load Default Rules"</strong> to load pre-configured rules based on SOP-002 Advance Exchange Process</li>
                <li><strong>Review the rules</strong> in the table below - each row shows a 360 status and its valid Goldie statuses</li>
                <li><strong>Edit as needed</strong> - Click any cell to modify, or use Add/Delete buttons for custom rules</li>
                <li><strong>Save your changes</strong> - Click "Save Rules" to store rules in browser or "Export Rules" for backup</li>
                <li><strong>Validate rules</strong> - Click "Validate Rules" to check for conflicts or formatting issues</li>
            </ol>
        </div>

        <!-- Example Rule -->
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 15px;">💡 Example Rule</h4>
            <div style="font-family: monospace; background: white; padding: 12px; border-radius: 6px; margin: 10px 0; border: 1px solid #fcd34d;">
                <div style="color: #065f46; margin-bottom: 5px;"><strong>360 Status:</strong> "replacement authorized"</div>
                <div style="color: #1e40af;"><strong>Valid Goldie Statuses:</strong> "shipment information sent to fedex", "picked up", "on the way"</div>
            </div>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #78350f; line-height: 1.6;">
                <strong>Meaning:</strong> When a claim in 360 has status "replacement authorized", the Goldie system should show
                one of these three statuses. If Goldie shows something else (like "delivered" or "cancelled"), it's flagged as a synchronization error.
            </p>
        </div>

        <!-- Phase Legend -->
        <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
            <h4 style="margin: 0 0 10px 0; color: #374151; font-size: 15px;">🎨 Phase Color Coding</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 13px;">
                <span style="background: #f3f4f6; padding: 6px 12px; border-radius: 4px; border: 1px solid #d1d5db;">⏳ Pre-Order</span>
                <span style="background: #dbeafe; padding: 6px 12px; border-radius: 4px; border: 1px solid #93c5fd;">✅ Authorization</span>
                <span style="background: #fef3c7; padding: 6px 12px; border-radius: 4px; border: 1px solid #fde047;">📦 Shipment</span>
                <span style="background: #d1fae5; padding: 6px 12px; border-radius: 4px; border: 1px solid #6ee7b7;">🚚 Delivery</span>
                <span style="background: #dcfce7; padding: 6px 12px; border-radius: 4px; border: 1px solid #86efac;">✔️ Completed</span>
                <span style="background: #fee2e2; padding: 6px 12px; border-radius: 4px; border: 1px solid #fca5a5;">⚠️ Exception</span>
            </div>
        </div>

        <!-- Search and Filter Section -->
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
            <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 15px;">🔍 Search & Filter Rules</h4>

            <!-- Search Input -->
            <div style="margin-bottom: 15px;">
                <input type="text"
                       id="ruleSearchInput"
                       placeholder="Search by 360 status or Goldie status..."
                       oninput="filterBusinessRules()"
                       style="width: 100%; padding: 10px 15px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: border 0.2s;"
                       onfocus="this.style.borderColor='#667eea'"
                       onblur="this.style.borderColor='#d1d5db'">
            </div>

            <!-- Phase Filter Buttons -->
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 13px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">Filter by Phase:</label>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <button class="phase-filter-btn" data-phase="pre-order" onclick="togglePhaseFilter('pre-order')"
                            style="background: #f3f4f6; color: #374151; border: 2px solid #d1d5db; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#e5e7eb'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#f3f4f6'">
                        ⏳ Pre-Order
                    </button>
                    <button class="phase-filter-btn" data-phase="authorization" onclick="togglePhaseFilter('authorization')"
                            style="background: #dbeafe; color: #1e40af; border: 2px solid #93c5fd; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#bfdbfe'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#dbeafe'">
                        ✅ Authorization
                    </button>
                    <button class="phase-filter-btn" data-phase="shipment" onclick="togglePhaseFilter('shipment')"
                            style="background: #fef3c7; color: #92400e; border: 2px solid #fde047; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#fde68a'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#fef3c7'">
                        📦 Shipment
                    </button>
                    <button class="phase-filter-btn" data-phase="delivery" onclick="togglePhaseFilter('delivery')"
                            style="background: #d1fae5; color: #065f46; border: 2px solid #6ee7b7; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#a7f3d0'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#d1fae5'">
                        🚚 Delivery
                    </button>
                    <button class="phase-filter-btn" data-phase="completion" onclick="togglePhaseFilter('completion')"
                            style="background: #dcfce7; color: #065f46; border: 2px solid #86efac; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#bbf7d0'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#dcfce7'">
                        ✔️ Completed
                    </button>
                    <button class="phase-filter-btn" data-phase="exception" onclick="togglePhaseFilter('exception')"
                            style="background: #fee2e2; color: #991b1b; border: 2px solid #fca5a5; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#fecaca'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#fee2e2'">
                        ⚠️ Exception
                    </button>
                    <button onclick="clearAllFilters()"
                            style="background: white; color: #6b7280; border: 2px solid #d1d5db; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; font-weight: 500;"
                            onmouseover="this.style.background='#f9fafb'"
                            onmouseout="this.style.background='white'">
                        🔄 Clear Filters
                    </button>
                </div>
            </div>

            <!-- Results Count -->
            <div style="margin-top: 10px; font-size: 13px; color: #6b7280;">
                Showing <strong id="visibleRulesCount">${rules.length}</strong> of ${rules.length} rules
            </div>
        </div>

        <!-- Rules Table -->
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
            <thead style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <tr>
                    <th style="padding: 14px 12px; text-align: left; font-weight: 600; width: 5%;">Phase</th>
                    <th style="padding: 14px 12px; text-align: left; font-weight: 600; width: 35%;">360 Advance Exchange Status</th>
                    <th style="padding: 14px 12px; text-align: left; font-weight: 600; width: 45%;">
                        Valid Goldie Statuses
                        <span style="font-size: 11px; font-weight: 400; opacity: 0.9;">(comma-separated, leave empty for pre-order)</span>
                    </th>
                    <th style="padding: 14px 12px; text-align: center; font-weight: 600; width: 15%;">Actions</th>
                </tr>
            </thead>
            <tbody id="businessRulesTableBody">
    `;

    let currentPhase = null;
    rules.forEach(([status360, goldieStatuses], index) => {
        const goldieValue = Array.isArray(goldieStatuses) ? goldieStatuses.join(', ') : '';
        const phaseInfo = getStatusPhase(status360, goldieStatuses);
        const rowColor = phaseInfo.color;

        // Add phase header if this is a new phase
        if (currentPhase !== phaseInfo.phase) {
            currentPhase = phaseInfo.phase;
            html += `
                <tr class="phase-header" data-phase="${phaseInfo.phase}" style="background: linear-gradient(135deg, ${phaseInfo.color} 0%, ${phaseInfo.color} 100%); border-top: 3px solid #374151;">
                    <td colspan="4" style="padding: 12px 15px; font-weight: 700; font-size: 14px; color: #1f2937; letter-spacing: 0.5px;">
                        ${phaseInfo.icon} ${phaseInfo.label.toUpperCase()} PHASE
                    </td>
                </tr>
            `;
        }

        html += `
            <tr data-status360="${status360.toLowerCase()}"
                data-goldie-statuses="${goldieValue.toLowerCase()}"
                data-phase="${phaseInfo.phase}"
                style="background: ${rowColor}; border-bottom: 1px solid #e5e7eb; transition: all 0.2s;"
                onmouseover="this.style.transform='scale(1.01)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';"
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
                <td style="padding: 12px; text-align: center; font-size: 18px;" title="${phaseInfo.label}">
                    ${phaseInfo.icon}
                </td>
                <td style="padding: 12px;">
                    <input type="text"
                           value="${status360}"
                           onchange="updateRuleStatus(this, '${status360}')"
                           style="width: 100%; padding: 10px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; font-weight: 500; transition: border 0.2s;"
                           onfocus="this.style.borderColor='#667eea'"
                           onblur="this.style.borderColor='#d1d5db'"
                           placeholder="360 Status">
                </td>
                <td style="padding: 12px;">
                    <input type="text"
                           value="${goldieValue}"
                           onchange="updateRuleGoldieStatuses('${status360}', this.value)"
                           style="width: 100%; padding: 10px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px; transition: border 0.2s;"
                           onfocus="this.style.borderColor='#667eea'"
                           onblur="this.style.borderColor='#d1d5db'"
                           placeholder="${goldieStatuses.length === 0 ? '(Leave empty = No Goldie expected)' : 'Enter comma-separated statuses'}">
                </td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="deleteRule('${status360}')"
                            style="background: #ef4444; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s;"
                            onmouseover="this.style.background='#dc2626'; this.style.transform='scale(1.05)'"
                            onmouseout="this.style.background='#ef4444'; this.style.transform='scale(1)'">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="color: #374151; font-size: 14px;">
                <strong>📊 Total Rules:</strong> ${rules.length} |
                <strong>⏳ Pre-Order:</strong> ${rules.filter(([_, statuses]) => statuses.length === 0).length} |
                <strong>✅ Active Rules:</strong> ${rules.filter(([_, statuses]) => statuses.length > 0).length}
            </div>
            <div style="color: #6b7280; font-size: 12px; font-style: italic;">
                💡 Tip: Use "Export Rules" to backup your configuration before making major changes
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Update rule status (rename)
function updateRuleStatus(input, oldStatus) {
    const newStatus = input.value.trim().toLowerCase();

    if (!newStatus) {
        alert('Status cannot be empty!');
        input.value = oldStatus;
        return;
    }

    if (newStatus !== oldStatus && STATUS_MAPPINGS[newStatus]) {
        alert('This status already exists!');
        input.value = oldStatus;
        return;
    }

    // Rename the key
    const value = STATUS_MAPPINGS[oldStatus];
    delete STATUS_MAPPINGS[oldStatus];
    STATUS_MAPPINGS[newStatus] = value;

    addAuditLog('Renamed status', oldStatus, newStatus);
    renderBusinessRulesTable();
}

// Update Goldie statuses for a rule
function updateRuleGoldieStatuses(status360, goldieStatusesStr) {
    const goldieStatuses = goldieStatusesStr
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s);

    STATUS_MAPPINGS[status360] = goldieStatuses;

    addAuditLog('Updated Goldie statuses', status360, goldieStatusesStr);
}

// Delete a rule
function deleteRule(status360) {
    if (confirm(`Are you sure you want to delete the rule for "${status360}"?`)) {
        delete STATUS_MAPPINGS[status360];
        addAuditLog('Deleted rule', status360, null);
        renderBusinessRulesTable();
    }
}

// Add a new rule
function addNewRule() {
    const status360 = prompt('Enter 360 Advance Exchange Status:');
    if (!status360) return;

    const normalized = status360.trim().toLowerCase();

    if (STATUS_MAPPINGS[normalized]) {
        alert('This status already exists! Edit the existing rule instead.');
        return;
    }

    const goldieStatuses = prompt('Enter Goldie statuses (comma-separated) or leave empty for no match expected:');
    const goldieArray = goldieStatuses
        ? goldieStatuses.split(',').map(s => s.trim().toLowerCase()).filter(s => s)
        : [];

    STATUS_MAPPINGS[normalized] = goldieArray;

    addAuditLog('Added new rule', null, normalized);
    renderBusinessRulesTable();
}

// Export rules to JSON file
function exportRules() {
    const dataStr = JSON.stringify(STATUS_MAPPINGS, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `business-rules-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    addAuditLog('Exported rules', null, `${Object.keys(STATUS_MAPPINGS).length} rules exported`);
    alert('Business rules exported successfully!');
}

// Import rules from JSON file
function importRules(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);

            if (typeof imported !== 'object') {
                throw new Error('Invalid format');
            }

            if (confirm(`Import ${Object.keys(imported).length} rules? This will replace existing rules.`)) {
                Object.assign(STATUS_MAPPINGS, imported);
                renderBusinessRulesTable();
                addAuditLog('Imported rules from file', null, `${Object.keys(imported).length} rules imported`);
                alert('Business rules imported successfully!');
            }
        } catch (error) {
            alert('Error importing rules: ' + error.message);
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

// Save rules to localStorage
function saveRulesToStorage() {
    localStorage.setItem('businessRules', JSON.stringify(STATUS_MAPPINGS));
    localStorage.setItem('businessRulesAuditLog', JSON.stringify(auditLog));
    addAuditLog('Saved rules to browser storage', null, null);
    alert('Business rules saved successfully to browser storage!');
}

// Validate rules for conflicts and issues
function validateRules() {
    const issues = [];
    const statuses = Object.keys(STATUS_MAPPINGS);

    // Check for duplicate case-insensitive statuses
    const seen = new Set();
    statuses.forEach(status => {
        const lower = status.toLowerCase();
        if (seen.has(lower)) {
            issues.push(`Duplicate status (case difference): "${status}"`);
        }
        seen.add(lower);
    });

    // Check for empty status keys
    statuses.forEach(status => {
        if (!status || status.trim() === '') {
            issues.push('Found empty status key');
        }
    });

    // Check for invalid Goldie status formats
    Object.entries(STATUS_MAPPINGS).forEach(([status360, goldieStatuses]) => {
        if (!Array.isArray(goldieStatuses)) {
            issues.push(`Invalid format for "${status360}": Must be an array`);
        }
    });

    // Display results
    if (issues.length === 0) {
        alert('✅ Validation passed! No issues found.\n\nTotal rules: ' + statuses.length);
    } else {
        alert('⚠️ Validation found issues:\n\n' + issues.join('\n'));
    }

    addAuditLog('Validated rules', null, `${issues.length} issues found`);
}

// Add entry to audit log
function addAuditLog(action, oldValue, newValue) {
    const entry = {
        timestamp: new Date().toISOString(),
        action: action,
        oldValue: oldValue,
        newValue: newValue
    };

    auditLog.unshift(entry);

    // Keep only last 100 entries
    if (auditLog.length > 100) {
        auditLog = auditLog.slice(0, 100);
    }

    // Render audit log
    renderAuditLog();
}

// Render audit log
function renderAuditLog() {
    const container = document.getElementById('auditLog');
    const section = document.getElementById('auditLogSection');
    if (!container || !section) return;

    if (auditLog.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    let html = '<table style="width: 100%; font-size: 12px;">';
    html += '<thead><tr style="text-align: left; border-bottom: 1px solid #e5e7eb;"><th style="padding: 5px;">Time</th><th style="padding: 5px;">Action</th><th style="padding: 5px;">Details</th></tr></thead><tbody>';

    auditLog.slice(0, 20).forEach(entry => {
        const time = new Date(entry.timestamp).toLocaleString();
        const details = entry.oldValue || entry.newValue
            ? `${entry.oldValue || ''} ${entry.oldValue && entry.newValue ? '→' : ''} ${entry.newValue || ''}`
            : '';

        html += `<tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 5px; color: #6b7280;">${time}</td>
            <td style="padding: 5px; font-weight: 500;">${entry.action}</td>
            <td style="padding: 5px; color: #6b7280; max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${details}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Initialize business rules on page load
document.addEventListener('DOMContentLoaded', function() {
    // Try to load from localStorage
    const savedRules = loadRulesFromStorage();
    if (savedRules) {
        Object.assign(STATUS_MAPPINGS, savedRules);
        console.log('✅ Loaded saved business rules from storage');
    }

    // Load saved audit log
    const savedAuditLog = localStorage.getItem('businessRulesAuditLog');
    if (savedAuditLog) {
        try {
            auditLog = JSON.parse(savedAuditLog);
            renderAuditLog();
        } catch (e) {
            console.error('Error loading audit log:', e);
        }
    }
});
