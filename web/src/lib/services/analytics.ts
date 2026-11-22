import { allRows, firstRow } from "../db";

export interface DashboardData {
  revenue: { paid: number; paidOrders: number; refunded: number };
  customers: number;
  orderCounts: { status: string; count: number }[];
  lowStock: {
    variantId: string;
    sku: string;
    variantName: string;
    productName: string;
    slug: string;
    stock: number;
    threshold: number;
  }[];
  topProducts: { product_name: string; units: number; revenue: number }[];
  recentOrders: { number: string; email: string; total: number; status: string; createdAt: string }[];
  daily: { day: string; revenue: number; orders: number }[];
}

export async function getDashboard(): Promise<DashboardData> {
  const [revenue, orderCounts, customerCount, lowStock, topProducts, recentOrders, daily] = await Promise.all([
    firstRow<{ paid_revenue: number; paid_orders: number; refunded: number }>(
      `SELECT COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS paid_revenue,
              SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
              COALESCE(SUM((SELECT COALESCE(SUM(amount), 0) FROM refunds r WHERE r.order_id = o.id AND r.status = 'completed')), 0) AS refunded
         FROM orders o`,
    ),
    allRows<{ status: string; count: number }>("SELECT status, COUNT(*) AS count FROM orders GROUP BY status"),
    firstRow<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role = 'customer'"),
    allRows<{
      id: string;
      sku: string;
      variant_name: string;
      product_name: string;
      stock: number;
      low_stock_threshold: number;
      slug: string;
    }>(
      `SELECT v.id, v.sku, v.name AS variant_name, p.name AS product_name, v.stock, v.low_stock_threshold, p.slug
         FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE v.is_active = 1 AND p.status != 'archived' AND v.stock <= v.low_stock_threshold
        ORDER BY v.stock ASC LIMIT 20`,
    ),
    allRows<{ product_name: string; units: number; revenue: number }>(
      `SELECT oi.product_name, SUM(oi.quantity) AS units, SUM(oi.line_total) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'paid'
        GROUP BY oi.product_name ORDER BY units DESC LIMIT 5`,
    ),
    allRows<{ number: string; email: string; total: number; status: string; created_at: string }>(
      "SELECT number, email, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 8",
    ),
    allRows<{ day: string; revenue: number; orders: number }>(
      `SELECT substr(COALESCE(paid_at, created_at), 1, 10) AS day,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS revenue,
              COUNT(*) AS orders
         FROM orders
        WHERE created_at >= datetime('now', '-14 days')
        GROUP BY day ORDER BY day ASC`,
    ),
  ]);

  return {
    revenue: {
      paid: revenue?.paid_revenue ?? 0,
      paidOrders: revenue?.paid_orders ?? 0,
      refunded: revenue?.refunded ?? 0,
    },
    customers: customerCount?.total ?? 0,
    orderCounts,
    lowStock: lowStock.map((row) => ({
      variantId: row.id,
      sku: row.sku,
      variantName: row.variant_name,
      productName: row.product_name,
      slug: row.slug,
      stock: row.stock,
      threshold: row.low_stock_threshold,
    })),
    topProducts,
    recentOrders: recentOrders.map((row) => ({
      number: row.number,
      email: row.email,
      total: row.total,
      status: row.status,
      createdAt: row.created_at,
    })),
    daily,
  };
}
