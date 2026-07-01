# Ecwid Dashboard Widget

A lightweight Node.js backend that fetches ecommerce analytics from Ecwid and serves them via an embeddable HTML widget. Designed to be embedded in HighLevel websites.

## Features

- ✅ Weekly and monthly order counts with percentage change
- ✅ Top 10 selling products for the week and month
- ✅ Automatic daily refresh at 2 AM
- ✅ CORS-enabled for cross-origin embedding
- ✅ Simple embeddable HTML widget
- ✅ Zero-cost hosting on Render's free tier

## Prerequisites

- Ecwid Store account with API access
- GitHub account
- Render account (free tier available)

---

## Step 1: Get Your Ecwid Credentials

1. Log in to your Ecwid dashboard: https://my.ecwid.com
2. Go to **Settings → API Tokens**
3. Create a new API token with these scopes:
   - `read_orders`
   - `read_products`
4. Copy your **Store ID** (visible in the dashboard URL or settings)
5. Copy your **API Token**

Keep these secure! You'll need them for environment variables.

---

## Step 2: Create GitHub Repository

### Option A: Using Git CLI

```bash
# Clone this repo or create new one
git init ecwid-dashboard
cd ecwid-dashboard

# Copy files into the directory
# (server.js, package.json, .gitignore, README.md, embed-widget.html)

# Initialize git and push
git add .
git commit -m "Initial commit: Ecwid dashboard widget"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ecwid-dashboard.git
git push -u origin main
```

### Option B: Using GitHub Web Interface

1. Go to github.com → **New Repository**
2. Name it `ecwid-dashboard`
3. Make it **Public** (so Render can access it)
4. Click **Create repository**
5. Upload files directly:
   - Click **Add file → Upload files**
   - Select: `server.js`, `package.json`, `.gitignore`, `README.md`, `embed-widget.html`
   - Commit

---

## Step 3: Deploy to Render

### Create Web Service

1. Go to **render.com** → Sign up or log in
2. Click **New +** → **Web Service**
3. Connect your GitHub account (if prompted)
4. Select the `ecwid-dashboard` repository
5. Configure:
   - **Name:** `ecwid-dashboard` (or your choice)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (sufficient for this use case)

### Add Environment Variables

1. On the Render dashboard, go to your service
2. Click **Environment** (left sidebar)
3. Add these variables:
   ```
   ECWID_STORE_ID=YOUR_STORE_ID_HERE
   ECWID_API_TOKEN=YOUR_API_TOKEN_HERE
   NODE_ENV=production
   ```
4. Click **Save Changes**

The service will auto-deploy and start. You'll see a URL like:
```
https://ecwid-dashboard.onrender.com
```

### Verify It's Working

Test the API endpoints:

```
https://ecwid-dashboard.onrender.com/health
→ Should return: { "status": "ok", "timestamp": "..." }

https://ecwid-dashboard.onrender.com/api/dashboard
→ Should return your dashboard data
```

---

## Step 4: Embed in HighLevel

### Option A: Direct HTML Code Block

1. In HighLevel, add an **HTML Code Block** to your page
2. Paste this code:

```html
<div id="ecwid-dashboard"></div>

<script>
  const DASHBOARD_API = 'https://ecwid-dashboard.onrender.com/api/dashboard';

  fetch(DASHBOARD_API)
    .then(r => r.json())
    .then(data => {
      let html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px;">
          <h2 style="margin-top: 0;">Ecommerce Dashboard</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background: #f0f4ff; padding: 15px; border-radius: 6px;">
              <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase;">Orders This Week</p>
              <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold;">${data.weekData.ordersThisWeek}</p>
              <p style="margin: 5px 0 0; font-size: 13px; color: ${data.weekData.orderChangePercent >= 0 ? '#10b981' : '#ef4444'};">
                ${data.weekData.orderChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.weekData.orderChangePercent)}% vs last week
              </p>
            </div>
            
            <div style="background: #fff4e6; padding: 15px; border-radius: 6px;">
              <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase;">Orders This Month</p>
              <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold;">${data.monthData.ordersThisMonth}</p>
              <p style="margin: 5px 0 0; font-size: 13px; color: ${data.monthData.orderChangePercent >= 0 ? '#10b981' : '#ef4444'};">
                ${data.monthData.orderChangePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.monthData.orderChangePercent)}% vs last month
              </p>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Top 10 Products This Week</h3>
            ${data.topProductsThisWeek.map((p, i) => `
              <div style="background: white; padding: 10px; margin-bottom: 8px; border-left: 3px solid #3b82f6; border-radius: 4px;">
                <strong>${i + 1}. ${p.name}</strong> - $${p.price}
              </div>
            `).join('')}
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Top 10 Products This Month</h3>
            ${data.topProductsThisMonth.map((p, i) => `
              <div style="background: white; padding: 10px; margin-bottom: 8px; border-left: 3px solid #8b5cf6; border-radius: 4px;">
                <strong>${i + 1}. ${p.name}</strong> - $${p.price}
              </div>
            `).join('')}
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            📊 Last updated: ${new Date(data.lastUpdated).toLocaleString()}
          </p>
        </div>
      `;
      document.getElementById('ecwid-dashboard').innerHTML = html;
    })
    .catch(e => {
      document.getElementById('ecwid-dashboard').innerHTML = 
        '<p style="color: red;">Error loading dashboard. Please check your API URL.</p>';
      console.error('Dashboard error:', e);
    });
</script>
```

3. **Replace** `https://ecwid-dashboard.onrender.com` with your actual Render URL
4. Save and preview

### Option B: Iframe Approach (Alternative)

Use this for better isolation:

```html
<iframe 
  src="https://ecwid-dashboard.onrender.com/widget.html"
  style="width: 100%; height: 800px; border: none; border-radius: 6px;"
  title="Ecwid Dashboard">
</iframe>
```

*(You'd need to add a `widget.html` file to Render for this)*

---

## Troubleshooting

### "Cannot GET /api/dashboard"
- Check Render deployment succeeded (green status)
- Verify `server.js` is in the root directory
- Check `ECWID_STORE_ID` and `ECWID_API_TOKEN` are set in Render environment variables

### "Failed to fetch" error in widget
- Verify CORS: Render should be CORS-enabled
- Check the API URL matches your Render domain exactly
- Use browser DevTools (F12 → Network tab) to see actual error

### "No orders found"
- Verify Ecwid API token has `read_orders` scope
- Ensure you actually have orders in Ecwid
- Check date ranges in `server.js` are correct

### Data not updating at 2 AM
- Render may restart the container, clearing cron schedule
- Click **Restart service** manually in Render dashboard to test
- Check Render logs (Events tab) for errors

---

## Manual Testing

Once deployed, trigger a data fetch manually:

```bash
curl -X POST https://ecwid-dashboard.onrender.com/api/fetch-now
```

This fetches fresh data without waiting for 2 AM.

---

## Conversion Rate (Important Note)

**Limitation:** Ecwid's API doesn't expose visitor count, so conversion rate cannot be calculated without additional data sources.

### To add conversion rates:

**Option 1: Google Analytics Integration**
- Connect GA4 API and fetch visitor metrics
- Calculate: (Orders / Visitors) × 100

**Option 2: Manual Input**
- Add a conversion rate input field to `server.js`
- Store in `dashboard-data.json`
- Update manually or via admin dashboard

**Option 3: Use a CDP**
- Segment, Mixpanel, or Heap can track visitors
- Query their API for metrics

*(I can help with any of these if needed)*

---

## File Structure

```
ecwid-dashboard/
├── server.js              # Main Express app
├── package.json           # Dependencies
├── .gitignore             # Git exclusions
├── README.md              # This file
├── embed-widget.html      # Optional standalone widget
└── data/
    └── dashboard-data.json # Auto-generated data file
```

---

## API Endpoints

### GET /health
Returns service status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /api/dashboard
Returns all dashboard data.

**Response:**
```json
{
  "lastUpdated": "2024-01-15T10:30:00Z",
  "weekData": {
    "ordersThisWeek": 42,
    "ordersLastWeek": 38,
    "orderChangePercent": 10.5,
    "conversionRateThisWeek": "N/A"
  },
  "monthData": { ... },
  "topProductsThisWeek": [
    { "id": 123, "name": "Product A", "price": 29.99 }
  ],
  "topProductsThisMonth": [ ... ]
}
```

### POST /api/fetch-now
Manually trigger data refresh (useful for testing).

---

## Updating Your Code

To make changes:

1. **Edit locally** (server.js, etc.)
2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Update: Description of change"
   git push origin main
   ```
3. **Render auto-deploys** within 1-2 minutes

---

## Costs

- **Render:** Free tier (sufficient for daily queries)
- **GitHub:** Free (public repo)
- **Total:** $0/month

Note: Render's free tier may spin down during inactivity. Render will restart automatically when accessed. If you need guaranteed uptime, upgrade to a paid Render plan.

---

## Next Steps

- [ ] Create GitHub repo and push files
- [ ] Deploy to Render
- [ ] Add environment variables to Render
- [ ] Test API endpoints
- [ ] Embed in HighLevel
- [ ] Set up conversion rate tracking (optional)

---

## Support

Check Render logs for errors:
1. Go to your Render service dashboard
2. Click **Logs** to see real-time output
3. Search for error messages or "❌" symbols

---

## License

MIT - Feel free to use, modify, and distribute.
