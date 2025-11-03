# Advance Exchange Dashboard

A comprehensive operations dashboard for monitoring and analyzing synchronization between 360 Advance Exchange and Goldie Sales Order systems.

## Features

- 📊 **Real-time Analysis** - Process multiple reports and identify sync issues
- 🔄 **Multi-file Support** - Upload multiple 360 and Goldie reports simultaneously
- 📋 **Smart Column Detection** - Automatically detects claim ID, status, and program columns
- 🎯 **Business Rule Mapping** - Configure status mappings based on SOP-002 Advance Exchange Process
- 📈 **Program-level Reports** - Individual tabs for each program with detailed breakdowns
- ⚠️ **Failure Detection** - Identifies interface failures and status mismatches
- 🎨 **Modern Dashboard UI** - Clean, professional interface with sidebar navigation

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup Steps

1. **Navigate to the project directory:**
   ```bash
   cd /Users/prakash/Downloads/360Sync
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the dashboard:**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Development Mode

For development with auto-restart on file changes:

```bash
npm run dev
```

## How to Use

### 1. Upload Files
- Navigate to "Upload Files" in the sidebar
- Upload one or more 360 Advance Exchange reports (CSV or Excel)
- Upload one or more Goldie Sales Order reports (CSV or Excel)
- Click "Process Reports"

### 2. Column Mapping
- Review auto-detected columns
- Adjust mappings if needed:
  - **360 Claim ID** → ReferenceID
  - **Goldie Claim ID** → CustomerPO
  - **Status columns** → Auto-detected
  - **Program columns** → Auto-detected

### 3. Status Mapping
- View unique statuses from both systems
- Edit business rules in the mapping table
- Define valid Goldie statuses for each 360 status
- Click "Update Business Rules & Analyze"

### 4. Analysis Results
- **Overview Tab** - Summary statistics across all programs
- **Program Tabs** - Individual analysis per program
- **Business Rules Tab** - View active mappings

## Failure Types

### Interface Failure to Goldie
Claims exist in 360 but NOT in Goldie Sales Order report (missing CustomerPO). Indicates order creation failure.

### Goldie to 360 Failure
Claims exist in both systems but have status mismatches based on business rules. Indicates sync issues.

## Business Rules

Based on **SOP-002 Advance Exchange Process**:

- **Pre-Order Phase** - No Goldie order expected (Payment Pending, Claim withdrawn, etc.)
- **Order Creation** - After payment, Goldie order created
- **Fulfillment** - Shipment tracking statuses
- **Delivery** - Delivered statuses
- **Completion** - Service completed, security deposit released

## File Structure

```
360Sync/
├── server.js                 # Express server
├── package.json              # Node.js dependencies
├── README.md                 # This file
├── public/
│   ├── index.html            # Main dashboard HTML
│   ├── css/
│   │   └── styles.css        # Dashboard styles
│   └── js/
│       └── app.js            # Application logic
└── SOP-002*.pdf              # Reference documentation
```

## API Endpoints

- `GET /` - Dashboard homepage
- `GET /api/health` - Health check endpoint

## Configuration

### Port Configuration
Default port is 3000. To change:

```bash
PORT=8080 npm start
```

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Troubleshooting

### Port Already in Use
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=8080 npm start
```

### Dependencies Not Installing
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

### Browser Compatibility
- Chrome/Edge (recommended)
- Firefox
- Safari

## Support

For issues or questions:
1. Check the console for errors (F12 in browser)
2. Review server logs in terminal
3. Verify file formats (CSV or Excel)

## Version

**Version:** 1.0.0
**Last Updated:** January 2025
**Based on:** SOP-002 Advance Exchange Process
