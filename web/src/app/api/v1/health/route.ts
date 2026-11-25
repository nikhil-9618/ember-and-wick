import { getDb } from "@/lib/db";
import { apiRoute, json } from "@/lib/http";
import { getPaymentConfig } from "@/lib/config";

export const GET = apiRoute(async () => {
  const started = Date.now();
  let database = "ok";
  try {
    const db = await getDb();
    await db.users.findOne({});
  } catch {
    database = "unavailable";
  }
  const payments = await getPaymentConfig();
  const healthy = database === "ok";
  return json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      payments: payments.mode,
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
});