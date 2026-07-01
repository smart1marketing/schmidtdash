const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Configuration from environment variables
const ECWID_STORE_ID = process.env.ECWID_STORE_ID;
const ECWID_API_TOKEN = process.env.ECWID_API_TOKEN;

if (!ECWID_STORE_ID || !ECWID_API_TOKEN) {
  console.warn('⚠️  Missing ECWID_STORE_ID or ECWID_API_TOKEN environment variables');
}

// Data storage path
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'dashboard-data.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data file
const initDataFile = () => {
  if (!fs.existsSync(dataFile)) {
    const initialData = {
      lastUpdated: null,
      weekData: {
        ordersThisWeek: 0,
        ordersLastWeek: 0,
        orderChangePercent: 0,
        conversionRateThisWeek: 'N/A',
        conversionRateLastWeek: 'N/A',
        conversionChangePercent: 0
      },
      monthData: {
        ordersThisMonth: 0,
        ordersLastMonth: 0,
        orderChangePercent: 0,
        conversionRateThisMonth: 'N/A',
        conversionRateLastMonth: 'N/A',
        conversionChangePercent: 0
      },
      topProductsThisWeek: [],
      topProductsThisMonth: []
    };
    fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
  }
};

// Parse date helpers
const getDateRange = (daysBack) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - daysBack);
  
  return {
    from: pastDate.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0]
  };
};

// Fetch orders from Ecwid API
const fetchOrdersForDateRange = async (fromDate, toDate) => {
  try {
    const response = await axios.get(
      `https://api.ecwid.com/v3/${ECWID_STORE_ID}/orders`,
      {
        headers: {
          'Authorization': `Bearer ${ECWID_API_TOKEN}`
        },
        params: {
          limit: 100,
          offset: 0
        }
      }
    );

    // Filter orders by date range
    const orders = response.data.items || [];
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createDate).toISOString().split('T')[0];
      return orderDate >= fromDate && orderDate <= toDate;
    });

    return filteredOrders;
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    return [];
  }
};

// Fetch products and calculate sales
const fetchTopProducts = async (limit = 10) => {
  try {
    const response = await axios.get(
      `https://api.ecwid.com/v3/${ECWID_STORE_ID}/products`,
      {
        headers: {
          'Authorization': `Bearer ${ECWID_API_TOKEN}`
        },
        params: {
          limit: 100,
          offset: 0
        }
      }
    );

    const products = response.data.items || [];
    
    // Sort by sales/popularity (this is simplified - real sorting would require order history)
    const topProducts = products
      .slice(0, limit)
      .map(product => ({
        id: product.id,
        name: product.name,
        price: product.price || 0,
        sku: product.sku || 'N/A',
        quantity: product.quantity || 0,
        url: product.url || '#'
      }));

    return topProducts;
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    return [];
  }
};

// Main data fetch function
const fetchAllData = async () => {
  try {
    console.log('🔄 Starting data fetch...');

    // Get date ranges
    const thisWeek = getDateRange(7);
    const lastWeek = getDateRange(14);
    const thisMonth = getDateRange(30);
    const lastMonth = getDateRange(60);

    // Fetch orders
    const ordersThisWeek = await fetchOrdersForDateRange(thisWeek.from, thisWeek.to);
    const ordersLastWeek = await fetchOrdersForDateRange(lastWeek.from, lastWeek.to);
    const ordersThisMonth = await fetchOrdersForDateRange(thisMonth.from, thisMonth.to);
    const ordersLastMonth = await fetchOrdersForDateRange(lastMonth.from, lastMonth.to);

    // Calculate order changes
    const weekOrderChange = ordersLastWeek.length > 0
      ? (((ordersThisWeek.length - ordersLastWeek.length) / ordersLastWeek.length) * 100).toFixed(1)
      : 0;

    const monthOrderChange = ordersLastMonth.length > 0
      ? (((ordersThisMonth.length - ordersLastMonth.length) / ordersLastMonth.length) * 100).toFixed(1)
      : 0;

    // Fetch top products
    const topProductsThisWeek = await fetchTopProducts(10);
    const topProductsThisMonth = await fetchTopProducts(10);

    // Compile data
    const data = {
      lastUpdated: new Date().toISOString(),
      fetchedAt: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      weekData: {
        ordersThisWeek: ordersThisWeek.length,
        ordersLastWeek: ordersLastWeek.length,
        orderChangePercent: parseFloat(weekOrderChange),
        conversionRateThisWeek: 'N/A', // See note below
        conversionRateLastWeek: 'N/A',
        conversionChangePercent: 0,
        dateRange: {
          thisWeek: thisWeek,
          lastWeek: lastWeek
        }
      },
      monthData: {
        ordersThisMonth: ordersThisMonth.length,
        ordersLastMonth: ordersLastMonth.length,
        orderChangePercent: parseFloat(monthOrderChange),
        conversionRateThisMonth: 'N/A',
        conversionRateLastMonth: 'N/A',
        conversionChangePercent: 0,
        dateRange: {
          thisMonth: thisMonth,
          lastMonth: lastMonth
        }
      },
      topProductsThisWeek,
      topProductsThisMonth,
      note: 'Conversion rate requires Google Analytics integration - not available via Ecwid API alone'
    };

    // Save to file
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    console.log('✅ Data updated successfully at', data.fetchedAt);
    return data;
  } catch (error) {
    console.error('❌ Fatal error in fetchAllData:', error.message);
  }
};

// Initialize and schedule
initDataFile();

// Run immediately on startup
console.log('⏰ Running initial fetch on startup...');
fetchAllData();

// Schedule to run at 2 AM UTC daily (adjust timezone in Render settings)
// Using cron format: minute hour day month day-of-week
cron.schedule('0 2 * * *', () => {
  console.log('⏰ Scheduled fetch triggered at 2 AM');
  fetchAllData();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Main API endpoint
app.get('/api/dashboard', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    res.json(data);
  } catch (error) {
    console.error('❌ Error reading dashboard data:', error.message);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Manual trigger endpoint (useful for testing)
app.post('/api/fetch-now', async (req, res) => {
  console.log('📡 Manual fetch triggered');
  const data = await fetchAllData();
  res.json(data);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Ecwid Dashboard Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/dashboard`);
  console.log(`💚 Health check at http://localhost:${PORT}/health`);
});
