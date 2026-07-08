const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

// Manual CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Configuration
const STORE_ID = process.env.STORE_ID || '111281497';
const API_TOKEN = process.env.ECWID_API_TOKEN;
const API_BASE_URL = `https://app.ecwid.com/api/v3/${STORE_ID}`;

// Cache for product names
let productCache = {};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to make API requests
async function fetchFromEcwid(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    
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

// Build product name cache
async function buildProductCache() {
    console.log('📦 Building product name cache...');
    productCache = {};
    
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        const products = await fetchFromEcwid('/products', {
            limit: limit,
            offset: offset
        });

        if (!products || !products.items || products.items.length === 0) {
            hasMore = false;
            break;
        }

        products.items.forEach(product => {
            productCache[product.id] = product.name;
        });

        offset += limit;
        hasMore = products.items.length === limit;
    }

    console.log(`✅ Cached ${Object.keys(productCache).length} products`);
}

// Get product name from cache
function getProductName(productId) {
    return productCache[productId] || 'Unknown';
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

    // Build product cache if empty
    if (Object.keys(productCache).length === 0) {
        await buildProductCache();
    }

    const dashboard = {
        thisWeek: { 
            totalOrders: 0, 
            totalRevenue: 0, 
            abandonedCarts: 0,
            abandonedCartValue: 0,
            orderStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, other: 0 }
        },
        lastWeek: { 
            totalOrders: 0, 
            totalRevenue: 0, 
            abandonedCarts: 0 
        },
        thisMonth: { 
            totalOrders: 0, 
            totalRevenue: 0, 
            abandonedCarts: 0,
            abandonedCartValue: 0,
            orderStatus: { pending: 0, processing: 0, shipped: 0, delivered: 0, other: 0 }
        },
        lastMonth: { 
            totalOrders: 0, 
            totalRevenue: 0, 
            abandonedCarts: 0 
        },
        topProducts: [],
        lastUpdated: new Date().toISOString()
    };

    console.log('📡 Fetching orders for this week...');
    const { startDate: thisWeekStart } = getDateRange('week');
    const thisWeekOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0
    });

    if (thisWeekOrders && thisWeekOrders.items) {
        const thisWeekFiltered = thisWeekOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= thisWeekStart;
        });
        dashboard.thisWeek.totalOrders = thisWeekFiltered.length;
        dashboard.thisWeek.totalRevenue = thisWeekFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
        
        // Count order statuses
        thisWeekFiltered.forEach(order => {
            const status = (order.status || 'other').toLowerCase();
            if (status === 'pending') dashboard.thisWeek.orderStatus.pending++;
            else if (status === 'processing') dashboard.thisWeek.orderStatus.processing++;
            else if (status === 'shipped') dashboard.thisWeek.orderStatus.shipped++;
            else if (status === 'delivered') dashboard.thisWeek.orderStatus.delivered++;
            else dashboard.thisWeek.orderStatus.other++;
        });
    }

    console.log('📡 Fetching orders for last week...');
    const { startDate: lastWeekStart, endDate: lastWeekEnd } = getDateRange('lastWeek');
    const lastWeekOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0
    });

    if (lastWeekOrders && lastWeekOrders.items) {
        const lastWeekFiltered = lastWeekOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= lastWeekStart && orderDate < lastWeekEnd;
        });
        dashboard.lastWeek.totalOrders = lastWeekFiltered.length;
        dashboard.lastWeek.totalRevenue = lastWeekFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    console.log('📡 Fetching orders for this month...');
    const { startDate: thisMonthStart } = getDateRange('month');
    const thisMonthOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0
    });

    if (thisMonthOrders && thisMonthOrders.items) {
        const thisMonthFiltered = thisMonthOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= thisMonthStart;
        });
        dashboard.thisMonth.totalOrders = thisMonthFiltered.length;
        dashboard.thisMonth.totalRevenue = thisMonthFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
        
        // Count order statuses for month
        thisMonthFiltered.forEach(order => {
            const status = (order.status || 'other').toLowerCase();
            if (status === 'pending') dashboard.thisMonth.orderStatus.pending++;
            else if (status === 'processing') dashboard.thisMonth.orderStatus.processing++;
            else if (status === 'shipped') dashboard.thisMonth.orderStatus.shipped++;
            else if (status === 'delivered') dashboard.thisMonth.orderStatus.delivered++;
            else dashboard.thisMonth.orderStatus.other++;
        });
    }

    console.log('📡 Fetching orders for last month...');
    const { startDate: lastMonthStart, endDate: lastMonthEnd } = getDateRange('lastMonth');
    const lastMonthOrders = await fetchFromEcwid('/orders', {
        limit: 100,
        offset: 0
    });

    if (lastMonthOrders && lastMonthOrders.items) {
        const lastMonthFiltered = lastMonthOrders.items.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= lastMonthStart && orderDate < lastMonthEnd;
        });
        dashboard.lastMonth.totalOrders = lastMonthFiltered.length;
        dashboard.lastMonth.totalRevenue = lastMonthFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

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
        dashboard.thisWeek.abandonedCartValue = thisWeekCartsFiltered.reduce((sum, cart) => sum + (cart.cartValue || 0), 0);
    }

    console.log('🛒 Fetching abandoned carts for this month...');
    const thisMonthCarts = await fetchFromEcwid('/abandoned_sales', {
        limit: 100,
        offset: 0
    });

    if (thisMonthCarts && thisMonthCarts.items) {
        const thisMonthCartsFiltered = thisMonthCarts.items.filter(cart => {
            const cartDate = new Date(cart.createDate);
            return cartDate >= thisMonthStart;
        });
        dashboard.thisMonth.abandonedCarts = thisMonthCartsFiltered.length;
        dashboard.thisMonth.abandonedCartValue = thisMonthCartsFiltered.reduce((sum, cart) => sum + (cart.cartValue || 0), 0);
    }

    // Build product sales from orders
    if (thisWeekOrders && thisWeekOrders.items) {
        const productSales = {};

        thisWeekOrders.items.forEach(order => {
            const orderDate = new Date(order.createDate);
            if (orderDate >= thisWeekStart) {
                if (order.items) {
                    order.items.forEach(item => {
                        const productId = item.productId;
                        const productName = getProductName(productId);
                        
                        if (!productSales[productId]) {
                            productSales[productId] = {
                                productId: productId,
                                name: productName,
                                quantity: 0,
                                revenue: 0
                            };
                        }
                        productSales[productId].quantity += item.quantity;
                        productSales[productId].revenue += (item.price * item.quantity);
                    });
                }
            }
        });

        dashboard.topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    console.log('\n📊 WEEK SUMMARY:');
    console.log(`   Orders This Week: ${dashboard.thisWeek.totalOrders}`);
    console.log(`   Revenue This Week: $${dashboard.thisWeek.totalRevenue.toFixed(2)}`);
    console.log(`   Abandoned Cart Value: $${dashboard.thisWeek.abandonedCartValue.toFixed(2)}`);
    console.log(`   Order Status - Pending: ${dashboard.thisWeek.orderStatus.pending}, Shipped: ${dashboard.thisWeek.orderStatus.shipped}, Delivered: ${dashboard.thisWeek.orderStatus.delivered}`);

    console.log('\n📊 MONTH SUMMARY:');
    console.log(`   Orders This Month: ${dashboard.thisMonth.totalOrders}`);
    console.log(`   Revenue This Month: $${dashboard.thisMonth.totalRevenue.toFixed(2)}`);
    console.log(`   Abandoned Cart Value: $${dashboard.thisMonth.abandonedCartValue.toFixed(2)}`);
    console.log(`   Top Products: ${dashboard.topProducts.length}`);

    res.json(dashboard);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Ecwid Dashboard Server running on port ${PORT}`);
    console.log(`📊 API available at https://schmidtdash.onrender.com/api/dashboard`);
    console.log(`🔐 Using Store ID: ${STORE_ID}`);
    console.log(`🔑 API Token configured: ${API_TOKEN ? 'Yes' : 'No'}\n`);

    if (!API_TOKEN) {
        console.error('⚠️  WARNING: ECWID_API_TOKEN environment variable is not set!');
    }

    // Build product cache on startup
    buildProductCache();
});
