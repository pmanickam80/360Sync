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

// Render the business rules table
function renderBusinessRulesTable() {
    const container = document.getElementById('businessRulesTable');
    if (!container) return;

    const rules = Object.entries(STATUS_MAPPINGS).sort((a, b) => a[0].localeCompare(b[0]));

    let html = `
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
            <thead style="background: #667eea; color: white;">
                <tr>
                    <th style="padding: 12px; text-align: left; font-weight: 600; width: 35%;">360 Advance Exchange Status</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; width: 50%;">Valid Goldie Statuses (comma-separated)</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; width: 15%;">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    rules.forEach(([status360, goldieStatuses], index) => {
        const goldieValue = Array.isArray(goldieStatuses) ? goldieStatuses.join(', ') : '';
        const rowColor = index % 2 === 0 ? '#f9fafb' : 'white';

        html += `
            <tr style="background: ${rowColor}; border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px;">
                    <input type="text"
                           value="${status360}"
                           onchange="updateRuleStatus(this, '${status360}')"
                           style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px;"
                           placeholder="360 Status">
                </td>
                <td style="padding: 12px;">
                    <input type="text"
                           value="${goldieValue}"
                           onchange="updateRuleGoldieStatuses('${status360}', this.value)"
                           style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px;"
                           placeholder="Goldie statuses (comma-separated) or leave empty for no match expected">
                </td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="deleteRule('${status360}')"
                            style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;"
                            onmouseover="this.style.background='#dc2626'"
                            onmouseout="this.style.background='#ef4444'">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <div style="margin-top: 15px; color: #6b7280; font-size: 13px;">
            <strong>Total Rules:</strong> ${rules.length} |
            <strong>Tip:</strong> Leave Goldie statuses empty if no match is expected (e.g., for pre-order statuses)
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
