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
        abandonedCartsThisWeek: 0,
        abandonedCartsLastWeek: 0,
        conversionRateThisWeek: 'N/A',
        conversionRateLastWeek: 'N/A'
      },
      monthData: {
        ordersThisMonth: 0,
        ordersLastMonth: 0,
        orderChangePercent: 0,
        abandonedCartsThisMonth: 0,
        abandonedCartsLastMonth: 0,
        conversionRateThisMonth: 'N/A',
        conversionRateLastMonth: 'N/A'
      },
      topProductsThisWeek: [],
      topProductsThisMonth: []
    };
    fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
  }
};

// Format date for Ecwid API (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get date ranges
const getDateRanges = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  
  // This week (last 7 days)
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  
  // Last week (7-14 days ago)
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  twoWeeksAgo.setHours(0, 0, 0, 0);
  
  // This month (last 30 days)
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  monthAgo.setHours(0, 0, 0, 0);
  
  // Last month (30-60 days ago)
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
  twoMonthsAgo.setHours(0, 0, 0, 0);
  
  return {
    today: startOfToday,
    weekAgo,
    twoWeeksAgo,
    monthAgo,
    twoMonthsAgo
  };
};

// Fetch all orders from Ecwid API
const fetchAllOrders = async () => {
  try {
    const headers = {
      'Authorization': `Bearer ${ECWID_API_TOKEN}`
    };

    let allOrders = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log('📡 Fetching orders from Ecwid API...');

    while (hasMore) {
      const response = await axios.get(
        `https://api.ecwid.com/v3/${ECWID_STORE_ID}/orders`,
        {
          headers,
          params: {
            limit: limit,
            offset: offset
          }
        }
      );

      if (response.data && response.data.items) {
        allOrders = allOrders.concat(response.data.items);
        offset += limit;
        hasMore = response.data.items.length === limit;
        console.log(`  📦 Fetched ${allOrders.length} orders so far...`);
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Total orders fetched: ${allOrders.length}`);
    return allOrders;
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    return [];
  }
};

// Fetch abandoned carts from Ecwid API
const fetchAbandonedCarts = async () => {
  try {
    const headers = {
      'Authorization': `Bearer ${ECWID_API_TOKEN}`
    };

    let allCarts = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log('🛒 Fetching abandoned carts from Ecwid API...');

    while (hasMore) {
      const response = await axios.get(
        `https://api.ecwid.com/v3/${ECWID_STORE_ID}/abandoned_carts`,
        {
          headers,
          params: {
            limit: limit,
            offset: offset
          }
        }
      );

      if (response.data && response.data.items) {
        allCarts = allCarts.concat(response.data.items);
        offset += limit;
        hasMore = response.data.items.length === limit;
        console.log(`  🛒 Fetched ${allCarts.length} carts so far...`);
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Total abandoned carts fetched: ${allCarts.length}`);
    return allCarts;
  } catch (error) {
    console.error('❌ Error fetching abandoned carts:', error.message);
    return [];
  }
};

// Fetch all products from Ecwid API
const fetchAllProducts = async () => {
  try {
    const headers = {
      'Authorization': `Bearer ${ECWID_API_TOKEN}`
    };

    let allProducts = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log('📦 Fetching products from Ecwid API...');

    while (hasMore) {
      const response = await axios.get(
        `https://api.ecwid.com/v3/${ECWID_STORE_ID}/products`,
        {
          headers,
          params: {
            limit: limit,
            offset: offset
          }
        }
      );

      if (response.data && response.data.items) {
        allProducts = allProducts.concat(response.data.items);
        offset += limit;
        hasMore = response.data.items.length === limit;
        console.log(`  🛍️  Fetched ${allProducts.length} products so far...`);
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Total products fetched: ${allProducts.length}`);
    return allProducts;
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    return [];
  }
};

// Filter items by date range
const filterByDateRange = (items, startDate, endDate, dateField = 'createDate') => {
  return items.filter(item => {
    if (!item[dateField]) return false;
    const itemDate = new Date(item[dateField]);
    return itemDate >= startDate && itemDate <= endDate;
  });
};

// Get top products
const getTopProducts = (products, limit = 10) => {
  return products
    .slice(0, limit)
    .map(product => ({
      id: product.id,
      name: product.name,
      price: product.price || 0,
      sku: product.sku || 'N/A',
      quantity: product.quantity || 0,
      url: product.url || '#'
    }));
};

// Main data fetch function
const fetchAllData = async () => {
  try {
    console.log('\n🔄 Starting data fetch...');
    console.log('⏰ Started at:', new Date().toLocaleString());

    const dateRanges = getDateRanges();

    // Fetch all data from Ecwid
    const allOrders = await fetchAllOrders();
    const abandonedCarts = await fetchAbandonedCarts();
    const allProducts = await fetchAllProducts();

    // ========== WEEK DATA ==========
    const ordersThisWeek = filterByDateRange(
      allOrders,
      dateRanges.weekAgo,
      dateRanges.today
    );

    const ordersLastWeek = filterByDateRange(
      allOrders,
      dateRanges.twoWeeksAgo,
      dateRanges.weekAgo
    );

    const cartsThisWeek = filterByDateRange(
      abandonedCarts,
      dateRanges.weekAgo,
      dateRanges.today
    );

    const cartsLastWeek = filterByDateRange(
      abandonedCarts,
      dateRanges.twoWeeksAgo,
      dateRanges.weekAgo
    );

    // ========== MONTH DATA ==========
    const ordersThisMonth = filterByDateRange(
      allOrders,
      dateRanges.monthAgo,
      dateRanges.today
    );

    const ordersLastMonth = filterByDateRange(
      allOrders,
      dateRanges.twoMonthsAgo,
      dateRanges.monthAgo
    );

    const cartsThisMonth = filterByDateRange(
      abandonedCarts,
      dateRanges.monthAgo,
      dateRanges.today
    );

    const cartsLastMonth = filterByDateRange(
      abandonedCarts,
      dateRanges.twoMonthsAgo,
      dateRanges.monthAgo
    );

    // Calculate week changes
    const weekOrderChange = ordersLastWeek.length > 0
      ? (((ordersThisWeek.length - ordersLastWeek.length) / ordersLastWeek.length) * 100).toFixed(1)
      : 0;

    const weekCartChange = cartsLastWeek.length > 0
      ? (((cartsThisWeek.length - cartsLastWeek.length) / cartsLastWeek.length) * 100).toFixed(1)
      : 0;

    // Calculate month changes
    const monthOrderChange = ordersLastMonth.length > 0
      ? (((ordersThisMonth.length - ordersLastMonth.length) / ordersLastMonth.length) * 100).toFixed(1)
      : 0;

    const monthCartChange = cartsLastMonth.length > 0
      ? (((cartsThisMonth.length - cartsLastMonth.length) / cartsLastMonth.length) * 100).toFixed(1)
      : 0;

    // Get top products
    const topProductsThisWeek = getTopProducts(allProducts, 10);
    const topProductsThisMonth = getTopProducts(allProducts, 10);

    // Compile data
    const data = {
      lastUpdated: new Date().toISOString(),
      fetchedAt: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      weekData: {
        ordersThisWeek: ordersThisWeek.length,
        ordersLastWeek: ordersLastWeek.length,
        orderChangePercent: parseFloat(weekOrderChange),
        abandonedCartsThisWeek: cartsThisWeek.length,
        abandonedCartsLastWeek: cartsLastWeek.length,
        cartChangePercent: parseFloat(weekCartChange),
        conversionRateThisWeek: 'N/A - Add Google Analytics',
        conversionRateLastWeek: 'N/A - Add Google Analytics',
        dateRange: {
          from: formatDateForAPI(dateRanges.weekAgo),
          to: formatDateForAPI(dateRanges.today)
        }
      },
      monthData: {
        ordersThisMonth: ordersThisMonth.length,
        ordersLastMonth: ordersLastMonth.length,
        orderChangePercent: parseFloat(monthOrderChange),
        abandonedCartsThisMonth: cartsThisMonth.length,
        abandonedCartsLastMonth: cartsLastMonth.length,
        cartChangePercent: parseFloat(monthCartChange),
        conversionRateThisMonth: 'N/A - Add Google Analytics',
        conversionRateLastMonth: 'N/A - Add Google Analytics',
        dateRange: {
          from: formatDateForAPI(dateRanges.monthAgo),
          to: formatDateForAPI(dateRanges.today)
        }
      },
      topProductsThisWeek,
      topProductsThisMonth,
      summary: {
        totalOrders: allOrders.length,
        totalAbandonedCarts: abandonedCarts.length,
        totalProducts: allProducts.length
      },
      note: 'Visitor data and conversion rate require Google Analytics integration'
    };

    // Save to file
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    
    console.log('✅ Data updated successfully!');
    console.log('\n📊 WEEK SUMMARY:');
    console.log(`   Orders This Week: ${ordersThisWeek.length} (${weekOrderChange > 0 ? '+' : ''}${weekOrderChange}%)`);
    console.log(`   Abandoned Carts This Week: ${cartsThisWeek.length} (${weekCartChange > 0 ? '+' : ''}${weekCartChange}%)`);
    console.log('\n📊 MONTH SUMMARY:');
    console.log(`   Orders This Month: ${ordersThisMonth.length} (${monthOrderChange > 0 ? '+' : ''}${monthOrderChange}%)`);
    console.log(`   Abandoned Carts This Month: ${cartsThisMonth.length} (${monthCartChange > 0 ? '+' : ''}${monthCartChange}%)`);
    console.log(`   🛍️  Total Products: ${allProducts.length}`);
    
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

// Schedule to run at 2 AM UTC daily
cron.schedule('0 2 * * *', () => {
  console.log('⏰ Scheduled fetch triggered at 2 AM UTC');
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
