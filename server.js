const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS
app.use(cors());

// Configuration
const STORE_ID = process.env.STORE_ID || '111281497';
const API_TOKEN = process.env.ECWID_API_TOKEN;
const API_BASE_URL = `https://app.ecwid.com/api/v3/${STORE_ID}`;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to make API requests
async function fetchFromEcwid(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Accept': 'application/json'
        }
    };

    try {
        const response = await fetch(url.toString(), options);
        
        if (!response.ok) {
            console.error(`❌ Ecwid API error [${endpoint}]: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`❌ Error fetching ${endpoint}:`, error.message);
        return null;
    }
}

// Helper function to get date range
function getDateRange(period = 'week') {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate;

    if (period === 'week') {
        const dayOfWeek = startOfToday.getDay();
        startDate = new Date(startOfToday);
        startDate.setDate(startDate.getDate() - dayOfWeek);
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'lastWeek') {
        const dayOfWeek = startOfToday.getDay();
        startDate = new Date(startOfToday);
        startDate.setDate(startDate.getDate() - dayOfWeek - 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        return { startDate, endDate };
    } else if (period === 'lastMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate, endDate };
    }

    return { startDate, endDate: new Date() };
}

// Main dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    console.log(`\n🔄 Starting data fetch at ${new Date().toLocaleString()}...`);

    if (!API_TOKEN) {
        console.error('❌ ECWID_API_TOKEN environment variable is not set');
        return res.status(500).json({ error: 'API token not configured' });
    }

    // Initialize response object
    const dashboard = {
        thisWeek: { totalOrders: 0, totalRevenue: 0, abandonedCarts: 0 },
        lastWeek: { totalOrders: 0, totalRevenue: 0, abandonedCarts: 0 },
        thisMonth: { totalOrders: 0, totalRevenue: 0, abandonedCarts: 0 },
        lastMonth: { totalOrders: 0, totalRevenue: 0, abandonedCarts: 0 },
        topProducts: [],
        lastUpdated: new Date().toISOString()
    };

    // Fetch orders for this week
    console.log('📡 Fetching orders for this week...');
    const { startDate: thisWeekStart } = getDateRange('week');
    const thisWeekOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0,
        orderBy: 'createdate'
    });

    if (thisWeekOrders && thisWeekOrders.items) {
        const thisWeekFiltered = thisWeekOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= thisWeekStart;
        });
        dashboard.thisWeek.totalOrders = thisWeekFiltered.length;
        dashboard.thisWeek.totalRevenue = thisWeekFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    // Fetch orders for last week
    console.log('📡 Fetching orders for last week...');
    const { startDate: lastWeekStart, endDate: lastWeekEnd } = getDateRange('lastWeek');
    const lastWeekOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0,
        orderBy: 'createdate'
    });

    if (lastWeekOrders && lastWeekOrders.items) {
        const lastWeekFiltered = lastWeekOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= lastWeekStart && orderDate < lastWeekEnd;
        });
        dashboard.lastWeek.totalOrders = lastWeekFiltered.length;
        dashboard.lastWeek.totalRevenue = lastWeekFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    // Fetch orders for this month
    console.log('📡 Fetching orders for this month...');
    const { startDate: thisMonthStart } = getDateRange('month');
    const thisMonthOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0,
        orderBy: 'createdate'
    });

    if (thisMonthOrders && thisMonthOrders.items) {
        const thisMonthFiltered = thisMonthOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= thisMonthStart;
        });
        dashboard.thisMonth.totalOrders = thisMonthFiltered.length;
        dashboard.thisMonth.totalRevenue = thisMonthFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    // Fetch orders for last month
    console.log('📡 Fetching orders for last month...');
    const { startDate: lastMonthStart, endDate: lastMonthEnd } = getDateRange('lastMonth');
    const lastMonthOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0,
        orderBy: 'createdate'
    });

    if (lastMonthOrders && lastMonthOrders.items) {
        const lastMonthFiltered = lastMonthOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= lastMonthStart && orderDate < lastMonthEnd;
        });
        dashboard.lastMonth.totalOrders = lastMonthFiltered.length;
        dashboard.lastMonth.totalRevenue = lastMonthFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    // Fetch abandoned carts for this week
    console.log('🛒 Fetching abandoned carts for this week...');
    const thisWeekCarts = await fetchFromEcwid('/abandoned_sales', {
        limit: 100,
        offset: 0
    });

    if (thisWeekCarts && thisWeekCarts.items) {
        const thisWeekCartsFiltered = thisWeekCarts.items.filter(cart => {
            const cartDate = new Date(cart.createDate);
            return cartDate >= thisWeekStart;
        });
        dashboard.thisWeek.abandonedCarts = thisWeekCartsFiltered.length;
    }

    // Fetch products
    console.log('📦 Fetching top products for this week...');
    const allProducts = await fetchFromEcwid('/products', {
        limit: 100,
        offset: 0
    });

    if (thisWeekOrders && thisWeekOrders.items && allProducts && allProducts.items) {
        // Build product sales map from orders
        const productSales = {};

        thisWeekOrders.items.forEach(order => {
            const orderDate = new Date(order.createDate);
            if (orderDate >= thisWeekStart) {
                if (order.items) {
                    order.items.forEach(item => {
                        if (!productSales[item.productId]) {
                            productSales[item.productId] = {
                                productId: item.productId,
                                name: item.productName,
                                quantity: 0,
                                revenue: 0
                            };
                        }
                        productSales[item.productId].quantity += item.quantity;
                        productSales[item.productId].revenue += (item.price * item.quantity);
                    });
                }
            }
        });

        // Convert to array and sort by revenue
        dashboard.topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    // Log summary
    console.log('\n📊 WEEK SUMMARY:');
    console.log(`   Orders This Week: ${dashboard.thisWeek.totalOrders}`);
    console.log(`   Revenue This Week: $${dashboard.thisWeek.totalRevenue.toFixed(2)}`);
    console.log(`   Abandoned Carts This Week: ${dashboard.thisWeek.abandonedCarts}`);

    console.log('\n📊 MONTH SUMMARY:');
    console.log(`   Orders This Month: ${dashboard.thisMonth.totalOrders}`);
    console.log(`   Revenue This Month: $${dashboard.thisMonth.totalRevenue.toFixed(2)}`);
    console.log(`   Top Products: ${dashboard.topProducts.length}`);

    res.json(dashboard);
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Ecwid Dashboard Server running on port ${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api/dashboard`);
    console.log(`💚 Health check at http://localhost:${PORT}/health`);
    console.log(`🔐 Using Store ID: ${STORE_ID}`);
    console.log(`🔑 API Token configured: ${API_TOKEN ? 'Yes' : 'No'}\n`);

    if (!API_TOKEN) {
        console.error('⚠️  WARNING: ECWID_API_TOKEN environment variable is not set!');
    }
});
