import { getDb } from "../db";

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
  const db = await getDb();

  const [revenueAgg, orderCounts, customerCount, lowStock, topProducts, recentOrders, daily] = await Promise.all([
    db.orders
      .aggregate<{ paid_revenue: number; paid_orders: number; refunded: number }>([
        {
          $group: {
            _id: null,
            paid_revenue: { $sum: { $cond: [{ $eq: ["$payment_status", "paid"] }, "$total", 0] } },
            paid_orders: { $sum: { $cond: [{ $eq: ["$payment_status", "paid"] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    db.orders.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
    db.users.countDocuments({ role: "customer" }),
    db.product_variants
      .aggregate<any>([
        { $match: { is_active: 1 } },
        { $lookup: { from: "products", localField: "product_id", foreignField: "_id", as: "product" } },
        { $unwind: "$product" },
        { $match: { $expr: { $and: [{ $ne: ["$product.status", "archived"] }, { $lte: ["$stock", "$low_stock_threshold"] }] } } },
        { $sort: { stock: 1 } },
        { $limit: 20 },
      ])
      .toArray(),
    db.order_items
      .aggregate<any>([
        { $lookup: { from: "orders", localField: "order_id", foreignField: "_id", as: "order" } },
        { $unwind: "$order" },
        { $match: { "order.payment_status": "paid" } },
        { $group: { _id: "$product_name", units: { $sum: "$quantity" }, revenue: { $sum: "$line_total" } } },
        { $sort: { units: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
    db.orders.find({}).sort({ created_at: -1 }).limit(8).toArray(),
    db.orders
      .aggregate<any>([
        { $match: { created_at: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() } } },
        {
          $group: {
            _id: { $substr: [{ $ifNull: ["$paid_at", "$created_at"] }, 0, 10] },
            revenue: { $sum: { $cond: [{ $eq: ["$payment_status", "paid"] }, "$total", 0] } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
  ]);

  // refunded total
  const refundedAgg = await db.refunds
    .aggregate<{ total: number }>([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();

  const revenueRow = (revenueAgg as any[])[0] ?? { paid_revenue: 0, paid_orders: 0 };

  return {
    revenue: {
      paid: revenueRow.paid_revenue ?? 0,
      paidOrders: revenueRow.paid_orders ?? 0,
      refunded: (refundedAgg as any[])[0]?.total ?? 0,
    },
    customers: customerCount,
    orderCounts: (orderCounts as any[]).map((r) => ({ status: r._id, count: r.count })),
    lowStock: (lowStock as any[]).map((row) => ({
      variantId: row._id,
      sku: row.sku,
      variantName: row.name,
      productName: row.product.name,
      slug: row.product.slug,
      stock: row.stock,
      threshold: row.low_stock_threshold,
    })),
    topProducts: (topProducts as any[]).map((r) => ({
      product_name: r._id,
      units: r.units,
      revenue: r.revenue,
    })),
    recentOrders: (recentOrders as any[]).map((row) => ({
      number: row.number,
      email: row.email,
      total: row.total,
      status: row.status,
      createdAt: row.created_at,
    })),
    daily: (daily as any[]).map((r) => ({
      day: r._id,
      revenue: r.revenue,
      orders: r.orders,
    })),
  };
}
