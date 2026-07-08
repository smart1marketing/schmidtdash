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

// Fetch ALL orders with pagination
async function fetchAllOrders() {
    console.log('📡 Fetching ALL orders with pagination...');
    let allOrders = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        const response = await fetchFromEcwid('/orders', {
            limit: limit,
            offset: offset
        });

        if (!response || !response.items || response.items.length === 0) {
            hasMore = false;
            break;
        }

        allOrders = allOrders.concat(response.items);
        console.log(`   Fetched ${allOrders.length} orders so far...`);

        offset += limit;
        hasMore = response.items.length === limit;
    }

    console.log(`✅ Total orders fetched: ${allOrders.length}`);
    return allOrders;
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
    } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
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

// Get 12-month date ranges
function getLast12Months() {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        months.push({
            name: monthStart.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
            start: monthStart,
            end: monthEnd
        });
    }
    
    return months;
}

// Calculate discount metrics
function calculateDiscountMetrics(orders, startDate, endDate = null) {
    if (!endDate) {
        endDate = new Date();
    }

    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createDate);
        return orderDate >= startDate && orderDate < endDate;
    });

    const totalOrders = filteredOrders.length;
    const ordersWithDiscount = filteredOrders.filter(order => {
        const totalDiscount = (order.couponDiscount || 0) + (order.discount || 0);
        return totalDiscount > 0;
    });

    const totalDiscountAmount = filteredOrders.reduce((sum, order) => {
        return sum + ((order.couponDiscount || 0) + (order.discount || 0));
    }, 0);

    const discountPercentage = totalOrders > 0 ? ((ordersWithDiscount.length / totalOrders) * 100).toFixed(1) : 0;

    return {
        totalOrders: totalOrders,
        ordersWithDiscounts: ordersWithDiscount.length,
        totalDiscountAmount: totalDiscountAmount,
        discountPercentage: discountPercentage
    };
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
        discountMetrics: {
            week: { totalOrders: 0, ordersWithDiscounts: 0, totalDiscountAmount: 0, discountPercentage: 0 },
            month: { totalOrders: 0, ordersWithDiscounts: 0, totalDiscountAmount: 0, discountPercentage: 0 },
            year: { totalOrders: 0, ordersWithDiscounts: 0, totalDiscountAmount: 0, discountPercentage: 0 }
        },
        topProductsWeek: [],
        topProductsYear: [],
        monthlySales: [],
        lastUpdated: new Date().toISOString()
    };

    // Fetch ALL orders with pagination
    const allOrders = await fetchAllOrders();

    // Calculate discount metrics
    console.log('💰 Calculating discount metrics...');
    const { startDate: thisWeekStart } = getDateRange('week');
    const { startDate: thisMonthStart } = getDateRange('month');
    const { startDate: thisYearStart } = getDateRange('year');

    if (allOrders && allOrders.length > 0) {
        dashboard.discountMetrics.week = calculateDiscountMetrics(allOrders, thisWeekStart);
        dashboard.discountMetrics.month = calculateDiscountMetrics(allOrders, thisMonthStart);
        dashboard.discountMetrics.year = calculateDiscountMetrics(allOrders, thisYearStart);
    }

    // Calculate this week metrics
    if (allOrders && allOrders.length > 0) {
        const thisWeekFiltered = allOrders.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= thisWeekStart;
        });
        dashboard.thisWeek.totalOrders = thisWeekFiltered.length;
        dashboard.thisWeek.totalRevenue = thisWeekFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
        
        thisWeekFiltered.forEach(order => {
            const status = (order.status || 'other').toLowerCase();
            if (status === 'pending') dashboard.thisWeek.orderStatus.pending++;
            else if (status === 'processing') dashboard.thisWeek.orderStatus.processing++;
            else if (status === 'shipped') dashboard.thisWeek.orderStatus.shipped++;
            else if (status === 'delivered') dashboard.thisWeek.orderStatus.delivered++;
            else dashboard.thisWeek.orderStatus.other++;
        });
    }

    // Calculate last week metrics
    console.log('📡 Calculating last week metrics...');
    const { startDate: lastWeekStart, endDate: lastWeekEnd } = getDateRange('lastWeek');
    if (allOrders && allOrders.length > 0) {
        const lastWeekFiltered = allOrders.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= lastWeekStart && orderDate < lastWeekEnd;
        });
        dashboard.lastWeek.totalOrders = lastWeekFiltered.length;
        dashboard.lastWeek.totalRevenue = lastWeekFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    // Calculate this month metrics
    console.log('📡 Calculating this month metrics...');
    if (allOrders && allOrders.length > 0) {
        const thisMonthFiltered = allOrders.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= thisMonthStart;
        });
        dashboard.thisMonth.totalOrders = thisMonthFiltered.length;
        dashboard.thisMonth.totalRevenue = thisMonthFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
        
        thisMonthFiltered.forEach(order => {
            const status = (order.status || 'other').toLowerCase();
            if (status === 'pending') dashboard.thisMonth.orderStatus.pending++;
            else if (status === 'processing') dashboard.thisMonth.orderStatus.processing++;
            else if (status === 'shipped') dashboard.thisMonth.orderStatus.shipped++;
            else if (status === 'delivered') dashboard.thisMonth.orderStatus.delivered++;
            else dashboard.thisMonth.orderStatus.other++;
        });
    }

    // Calculate last month metrics
    console.log('📡 Calculating last month metrics...');
    const { startDate: lastMonthStart, endDate: lastMonthEnd } = getDateRange('lastMonth');
    if (allOrders && allOrders.length > 0) {
        const lastMonthFiltered = allOrders.filter(order => {
            const orderDate = new Date(order.createDate);
            return orderDate >= lastMonthStart && orderDate < lastMonthEnd;
        });
        dashboard.lastMonth.totalOrders = lastMonthFiltered.length;
        dashboard.lastMonth.totalRevenue = lastMonthFiltered.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    // Calculate 12-month sales
    console.log('📊 Calculating 12-month sales...');
    const last12Months = getLast12Months();
    if (allOrders && allOrders.length > 0) {
        dashboard.monthlySales = last12Months.map(month => {
            const monthOrders = allOrders.filter(order => {
                const orderDate = new Date(order.createDate);
                return orderDate >= month.start && orderDate < month.end;
            });
            return {
                month: month.name,
                revenue: monthOrders.reduce((sum, order) => sum + (order.total || 0), 0),
                orders: monthOrders.length
            };
        });
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
        dashboard.thisWeek.abandonedCartValue = thisWeekCartsFiltered.reduce((sum, cart) => sum + (cart.cartValue || 0), 0);
    }

    // Fetch abandoned carts for this month
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

    // Build product sales for THIS WEEK
    console.log('📦 Calculating top products this week...');
    if (allOrders && allOrders.length > 0) {
        const productSalesWeek = {};

        allOrders.forEach(order => {
            const orderDate = new Date(order.createDate);
            if (orderDate >= thisWeekStart) {
                if (order.items) {
                    order.items.forEach(item => {
                        const productId = item.productId;
                        const productName = getProductName(productId);
                        
                        if (!productSalesWeek[productId]) {
                            productSalesWeek[productId] = {
                                productId: productId,
                                name: productName,
                                quantity: 0,
                                revenue: 0
                            };
                        }
                        productSalesWeek[productId].quantity += item.quantity;
                        productSalesWeek[productId].revenue += (item.price * item.quantity);
                    });
                }
            }
        });

        dashboard.topProductsWeek = Object.values(productSalesWeek)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    // Build product sales for THIS YEAR
    console.log('📦 Calculating top products this year...');
    if (allOrders && allOrders.length > 0) {
        const productSalesYear = {};

        allOrders.forEach(order => {
            const orderDate = new Date(order.createDate);
            if (orderDate >= thisYearStart) {
                if (order.items) {
                    order.items.forEach(item => {
                        const productId = item.productId;
                        const productName = getProductName(productId);
                        
                        if (!productSalesYear[productId]) {
                            productSalesYear[productId] = {
                                productId: productId,
                                name: productName,
                                quantity: 0,
                                revenue: 0
                            };
                        }
                        productSalesYear[productId].quantity += item.quantity;
                        productSalesYear[productId].revenue += (item.price * item.quantity);
                    });
                }
            }
        });

        dashboard.topProductsYear = Object.values(productSalesYear)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   Total Orders Fetched: ${allOrders.length}`);
    console.log(`   Date Range: ${allOrders.length > 0 ? new Date(allOrders[allOrders.length - 1].createDate).toLocaleDateString() : 'N/A'} to ${allOrders.length > 0 ? new Date(allOrders[0].createDate).toLocaleDateString() : 'N/A'}`);
    console.log(`   This Week Orders: ${dashboard.thisWeek.totalOrders}`);
    console.log(`   This Month Orders: ${dashboard.thisMonth.totalOrders}`);
    console.log(`   Abandoned Carts (Week): ${dashboard.thisWeek.abandonedCarts} ($${dashboard.thisWeek.abandonedCartValue.toFixed(2)})`);
    console.log(`   Abandoned Carts (Month): ${dashboard.thisMonth.abandonedCarts} ($${dashboard.thisMonth.abandonedCartValue.toFixed(2)})`);

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
