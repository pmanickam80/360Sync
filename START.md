# Quick Start Guide

## Start the Dashboard

### First Time Setup

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Install Dependencies**
   ```bash
   cd /Users/prakash/Downloads/360Sync
   npm install
     ```

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Open Dashboard**
   - Automatic: Browser should open automatically
   - Manual: Visit http://localhost:3000

## Daily Usage

```bash
cd /Users/prakash/Downloads/360Sync
npm start
```

Then open http://localhost:3000 in your browser.

## Stopping the Server

Press `Ctrl + C` in the terminal

## Port Already in Use?

```bash
# Option 1: Kill the process
lsof -ti:3000 | xargs kill -9
npm start

# Option 2: Use different port
PORT=8080 npm start
```

## Need Help?

Check README.md for detailed documentation.
