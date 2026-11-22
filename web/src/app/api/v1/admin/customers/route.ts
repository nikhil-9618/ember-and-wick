import { allRows } from "@/lib/db";
import { apiRoute, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const rows = await allRows<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
    order_count: number;
    lifetime_value: number;
    last_order_at: string | null;
  }>(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'paid') AS lifetime_value,
            (SELECT MAX(created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
       FROM users u WHERE u.role = 'customer'
      ORDER BY u.created_at DESC LIMIT 200`,
  );
  return json({ customers: rows });
});
