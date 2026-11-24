#!/usr/bin/env node
/**
 * API integration tests against a running server and its real D1 database.
 *
 *   BASE_URL=http://127.0.0.1:3000 node scripts/api-test.mjs
 *
 * Requires PAYMENT_PROVIDER=test so the test-only payment confirmation route is
 * enabled; the suite refuses to run against a production payment mode.
 */
import { createHmac, randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@emberandwick.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "AdminPass123!";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function req(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.origin) headers.Origin = options.origin;

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body, headers: response.headers };
}

function cookieFrom(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

/**
 * Signs in through the two-step flow. With demo delivery the API returns the code
 * to the caller, so the suite never needs access to an inbox.
 */
async function signIn(emailAddress, password) {
  const started = await req("/api/v1/auth/login", {
    method: "POST",
    origin: ORIGIN,
    body: { email: emailAddress, password },
  });
  if (started.status !== 200 || !started.body?.demoCode) return started;
  return req("/api/v1/auth/otp/verify", {
    method: "POST",
    origin: ORIGIN,
    body: { challengeId: started.body.challengeId, code: started.body.demoCode },
  });
}

const email = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
const password = "TestPass123!";
const ORIGIN = BASE;

console.log(`\nAPI integration tests → ${BASE}\n`);
console.log("Catalogue & health");

const health = await req("/api/v1/health");
check("health endpoint reports ok", health.status === 200 && health.body?.status === "ok", JSON.stringify(health.body));
check("payment provider is test mode", health.body?.payments === "test", `got ${health.body?.payments}`);
if (health.body?.payments !== "test") {
  console.error("\nRefusing to run: PAYMENT_PROVIDER is not 'test'.\n");
  process.exit(2);
}

const products = await req("/api/v1/products?perPage=24");
check("product list returns items", products.status === 200 && products.body.items.length >= 6, `count ${products.body?.items?.length}`);
const cedar = products.body.items.find((item) => item.slug === "cedar-smoked-vanilla");
check("seeded product is present and active", Boolean(cedar));

const detail = await req("/api/v1/products/cedar-smoked-vanilla");
check("product detail exposes variants", detail.status === 200 && detail.body.product.variants.length >= 2);
check("product detail includes reviews", Array.isArray(detail.body.reviews));

const search = await req("/api/v1/products?q=lavender");
check("search filters catalogue", search.body.items.every((item) => /lavender/i.test(`${item.name} ${item.scentNotes ?? ""}`)));

const missing = await req("/api/v1/products/does-not-exist");
check("unknown product returns 404", missing.status === 404);

console.log("\nAuthentication");

const register = await req("/api/v1/auth/register", {
  method: "POST",
  body: { name: "Test Buyer", email, password },
  origin: ORIGIN,
});
check("registration returns 201", register.status === 201, JSON.stringify(register.body));
const token = register.body?.token;
const cookie = cookieFrom(register.headers);
check("registration returns a session token", typeof token === "string" && token.length > 20);
check("registration sets an HttpOnly cookie", Boolean(cookie) && /ew_session=/.test(cookie));
check("password is never echoed back", !JSON.stringify(register.body).includes(password));

const duplicate = await req("/api/v1/auth/register", {
  method: "POST",
  body: { name: "Test Buyer", email, password },
  origin: ORIGIN,
});
check("duplicate email is rejected with 409", duplicate.status === 409, `got ${duplicate.status}`);

const weakPassword = await req("/api/v1/auth/register", {
  method: "POST",
  body: { name: "Weak", email: `weak-${Date.now()}@example.com`, password: "short" },
  origin: ORIGIN,
});
check("weak password is rejected", weakPassword.status === 422);

const badLogin = await req("/api/v1/auth/login", {
  method: "POST",
  body: { email, password: "WrongPass123!" },
  origin: ORIGIN,
});
check("wrong password returns 401", badLogin.status === 401);

console.log("\nSign-in codes");

const otpStart = await req("/api/v1/auth/login", {
  method: "POST",
  body: { email, password },
  origin: ORIGIN,
});
check(
  "login asks for a 6-digit code instead of returning a session",
  otpStart.status === 200 && otpStart.body?.otpRequired === true && typeof otpStart.body?.challengeId === "string",
  JSON.stringify(otpStart.body),
);
check("no session is issued before the code is verified", !otpStart.body?.token && !cookieFrom(otpStart.headers));
check("demo delivery returns a six digit code", /^[0-9]{6}$/.test(otpStart.body?.demoCode ?? ""));

const wrongCode = otpStart.body?.demoCode === "111111" ? "222222" : "111111";
const badOtp = await req("/api/v1/auth/otp/verify", {
  method: "POST",
  origin: ORIGIN,
  body: { challengeId: otpStart.body.challengeId, code: wrongCode },
});
check("an incorrect code is rejected", badOtp.status === 401 && !badOtp.body?.token, JSON.stringify(badOtp.body));

const login = await req("/api/v1/auth/otp/verify", {
  method: "POST",
  origin: ORIGIN,
  body: { challengeId: otpStart.body.challengeId, code: otpStart.body.demoCode },
});
check("the correct code issues a session", login.status === 200 && typeof login.body.token === "string", JSON.stringify(login.body));
check("verifying the code sets an HttpOnly cookie", /ew_session=/.test(cookieFrom(login.headers) ?? ""));

const replayed = await req("/api/v1/auth/otp/verify", {
  method: "POST",
  origin: ORIGIN,
  body: { challengeId: otpStart.body.challengeId, code: otpStart.body.demoCode },
});
check("a used code cannot be replayed", replayed.status === 401);

const me = await req("/api/v1/auth/me", { token });
check("bearer token authenticates", me.status === 200 && me.body.user.email === email);

const meCookie = await req("/api/v1/auth/me", { cookie });
check("cookie authenticates the web client", meCookie.status === 200 && meCookie.body.user.email === email);

const crossOrigin = await req("/api/v1/auth/me", { method: "PATCH", cookie, body: { name: "Hacked" }, origin: "https://evil.example" });
check("cross-origin cookie mutation is blocked", crossOrigin.status === 403, `got ${crossOrigin.status}`);

console.log("\nCart");

const emptyCart = await req("/api/v1/cart", { token });
check("new cart is empty", emptyCart.status === 200 && emptyCart.body.items.length === 0);

const variantId = detail.body.product.variants[0].id;
const otherVariant = detail.body.product.variants[1].id;

const add = await req("/api/v1/cart", {
  method: "POST",
  token,
  body: { variantId, quantity: 2 },
  origin: ORIGIN,
});
check("add to cart works", add.status === 200 && add.body.itemCount === 2, JSON.stringify(add.body));
check("cart subtotal is computed server-side", add.body.subtotal === 2 * detail.body.product.variants[0].price);
check("free shipping applies above the threshold", add.body.totals.shippingFee === 0);

const overflow = await req("/api/v1/cart", { method: "POST", token, body: { variantId, quantity: 99 }, origin: ORIGIN });
check("quantity above 10 is rejected", overflow.status === 422);

const stockGuard = await req("/api/v1/cart", {
  method: "POST",
  token,
  body: { variantId: "var_cit_200", quantity: 10 },
  origin: ORIGIN,
});
check("adding more than available stock is rejected", [409, 422].includes(stockGuard.status), `got ${stockGuard.status}`);

const unauthCart = await req("/api/v1/cart");
check("cart requires authentication", unauthCart.status === 401);

console.log("\nCoupons & checkout quote");

const badCoupon = await req("/api/v1/checkout/quote", { method: "POST", token, body: { couponCode: "NOPE" }, origin: ORIGIN });
check("invalid coupon is rejected", badCoupon.status === 422);

const quote = await req("/api/v1/checkout/quote", { method: "POST", token, body: { couponCode: "WELCOME10" }, origin: ORIGIN });
const expectedDiscount = Math.min(Math.round((2 * detail.body.product.variants[0].price * 10) / 100), 20000);
check("coupon discount is computed server-side", quote.status === 200 && quote.body.totals.discount === expectedDiscount, JSON.stringify(quote.body?.totals));
check("quote total matches subtotal minus discount", quote.body.totals.total === quote.body.totals.subtotal - quote.body.totals.discount + quote.body.totals.shippingFee);

console.log("\nOrders & payment");

const address = {
  fullName: "Test Buyer",
  phone: "+91 98450 11223",
  line1: "12 Test Lane",
  line2: "Indiranagar",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560038",
  country: "IN",
};

const idempotencyKey = `it-${Date.now()}`;
const order = await req("/api/v1/orders", {
  method: "POST",
  token,
  origin: ORIGIN,
  body: { address, couponCode: "WELCOME10", notes: "Test order", idempotencyKey },
});
check("order creation returns 201", order.status === 201, JSON.stringify(order.body));
check("order returns a payment intent", order.body?.payment?.provider === "test");
check("order is awaiting payment", order.body?.order?.status === "pending_payment");
check("order total matches the quote", order.body?.order?.total === quote.body.totals.total, `${order.body?.order?.total} vs ${quote.body.totals.total}`);
const orderNumber = order.body.order.number;

const repeat = await req("/api/v1/orders", {
  method: "POST",
  token,
  origin: ORIGIN,
  body: { address, couponCode: "WELCOME10", notes: "Test order", idempotencyKey },
});
check("idempotency key prevents a duplicate order", repeat.status === 201 && repeat.body.order.number === orderNumber);

const afterOrderCart = await req("/api/v1/cart", { token });
check("cart is cleared after ordering", afterOrderCart.body.items.length === 0);

const afterOrderProduct = await req("/api/v1/products/cedar-smoked-vanilla");
const variantAfter = afterOrderProduct.body.product.variants.find((variant) => variant.id === variantId);
check("stock was reserved atomically", variantAfter.stock === detail.body.product.variants[0].stock - 2, `stock ${variantAfter.stock}`);

const unpaidOrder = await req(`/api/v1/orders/${orderNumber}`, { token });
check("unpaid order is visible to its owner", unpaidOrder.status === 200 && unpaidOrder.body.order.paymentStatus === "unpaid");
check("unpaid order offers payment retry", unpaidOrder.body.order.canRetryPayment === true);

const confirm = await req("/api/v1/payments/test-confirm", { method: "POST", token, origin: ORIGIN, body: { orderNumber } });
check("test payment confirms", confirm.status === 200, JSON.stringify(confirm.body));

const paidOrder = await req(`/api/v1/orders/${orderNumber}`, { token });
check("order is marked paid", paidOrder.body.order.status === "paid" && paidOrder.body.order.paymentStatus === "paid");
check("paid order cannot be cancelled by the customer", paidOrder.body.order.canCancel === false);

const confirmAgain = await req("/api/v1/payments/test-confirm", { method: "POST", token, origin: ORIGIN, body: { orderNumber } });
check("repeat confirmation is idempotent", confirmAgain.status === 200);

// A retried payment leaves two payment rows for one order; confirming must still
// settle it instead of colliding on the unique provider payment id.
await req("/api/v1/cart", { method: "POST", token, origin: ORIGIN, body: { variantId, quantity: 1 } });
const retryOrder = await req("/api/v1/orders", {
  method: "POST",
  token,
  origin: ORIGIN,
  body: { address, idempotencyKey: `${idempotencyKey}-retry` },
});
const retryNumber = retryOrder.body?.order?.number;
const retryIntent = await req(`/api/v1/orders/${retryNumber}/retry-payment`, { method: "POST", token, origin: ORIGIN });
check(
  "a pending order can start a second payment attempt",
  retryIntent.status === 200 && retryIntent.body?.payment?.provider === "test",
  JSON.stringify(retryIntent.body),
);
const retryConfirm = await req("/api/v1/payments/test-confirm", {
  method: "POST",
  token,
  origin: ORIGIN,
  body: { orderNumber: retryNumber },
});
check("confirming after a retry settles the order", retryConfirm.status === 200, JSON.stringify(retryConfirm.body));
const retryPaid = await req(`/api/v1/orders/${retryNumber}`, { token });
check("the retried order is paid once", retryPaid.body?.order?.paymentStatus === "paid");

const notifications = await req("/api/v1/notifications", { token });
check("payment creates a customer notification", notifications.body.items.some((item) => item.type === "order_paid"));

const history = paidOrder.body.order.statusHistory ?? [];
check("order records who changed its status and why", history.length >= 2, `entries ${history.length}`);
check(
  "history starts at pending_payment and ends at paid",
  history[0]?.fromStatus === null && history[0]?.toStatus === "pending_payment" && history.at(-1)?.toStatus === "paid",
  JSON.stringify(history.map((entry) => entry.toStatus)),
);
check(
  "history names the customer as the actor",
  history.every((entry) => entry.actorType === "customer" && entry.reason),
  JSON.stringify(history.map((entry) => [entry.actorType, entry.reason])),
);

const otherUser = await req("/api/v1/auth/register", {
  method: "POST",
  origin: ORIGIN,
  body: { name: "Other Buyer", email: `other-${Date.now()}@example.com`, password },
});
const crossUserOrder = await req(`/api/v1/orders/${orderNumber}`, { token: otherUser.body.token });
check("customers cannot read another customer's order", crossUserOrder.status === 404);

const cancelledPaid = await req(`/api/v1/orders/${orderNumber}/cancel`, { method: "POST", token, origin: ORIGIN });
check("paid order cancellation is refused", cancelledPaid.status === 409);

console.log("\nAuthorization & webhooks");

const adminLogin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
check("admin can sign in with a code", adminLogin.status === 200, JSON.stringify(adminLogin.body));
const adminToken = adminLogin.body?.token;

const forbiddenStats = await req("/api/v1/admin/stats", { token });
check("customer cannot read admin stats", forbiddenStats.status === 403);

const stats = await req("/api/v1/admin/stats", { token: adminToken });
check("admin can read stats", stats.status === 200 && stats.body.revenue.paid >= order.body.order.total);
check("stats include low-stock alerts", Array.isArray(stats.body.lowStock));

const adminOrders = await req("/api/v1/admin/orders?status=paid", { token: adminToken });
check("admin sees paid orders", adminOrders.status === 200 && adminOrders.body.orders.some((item) => item.number === orderNumber));

const adminRefundNoPayment = await req("/api/v1/admin/refunds", {
  method: "POST",
  token: adminToken,
  origin: ORIGIN,
  body: { orderId: "EW-DOES-NOT-EXIST", amount: 100, reason: "test refund attempt" },
});
check("refund on unknown order is rejected", adminRefundNoPayment.status === 404);

const ledger = await req(`/api/v1/admin/variants/${variantId}/movements`, { token: adminToken });
check(
  "stock ledger records the order reservation",
  ledger.status === 200 && ledger.body.movements.some((m) => m.reason === "order_reserved" && m.delta === -2),
  JSON.stringify(ledger.body?.movements?.slice(0, 2)),
);
const customerLedger = await req(`/api/v1/admin/variants/${variantId}/movements`, { token });
check("customer cannot read the stock ledger", customerLedger.status === 403);

console.log("\nAdmin order changes");

const advance = await req(`/api/v1/admin/orders/${orderNumber}`, {
  method: "PATCH",
  token: adminToken,
  origin: ORIGIN,
  body: { status: "processing", note: "Moved to the packing bench" },
});
check("admin can advance an order", advance.status === 200 && advance.body.order.status === "processing", JSON.stringify(advance.body));
const adminEntry = (advance.body.order.statusHistory ?? []).at(-1);
check(
  "admin status change records the actor and the reason",
  adminEntry?.toStatus === "processing" && adminEntry?.actorType === "admin" && adminEntry?.actorLabel === ADMIN_EMAIL && adminEntry?.reason === "Moved to the packing bench",
  JSON.stringify(adminEntry),
);

const badTransition = await req(`/api/v1/admin/orders/${orderNumber}`, {
  method: "PATCH",
  token: adminToken,
  origin: ORIGIN,
  body: { status: "delivered" },
});
check("an invalid status transition is refused", badTransition.status === 409, `got ${badTransition.status}`);

const orderAudit = await req("/api/v1/admin/audit?entityType=order&action=order.status_changed", { token: adminToken });
check(
  "admin status change is written to the audit log",
  (orderAudit.body?.entries ?? []).some((entry) => entry.summary.startsWith(orderNumber)),
  JSON.stringify(orderAudit.body?.entries?.slice(0, 1)),
);

const orderStatusBeforeRefund = advance.body.order.status;

console.log("\nRefund approval");

const MANAGER_EMAIL = process.env.MANAGER_EMAIL ?? "manager@emberandwick.in";
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "ManagerPass123!";
const managerLogin = await signIn(MANAGER_EMAIL, MANAGER_PASSWORD);
const managerToken = managerLogin.body?.token;
check("second admin can sign in", managerLogin.status === 200 && Boolean(managerToken), JSON.stringify(managerLogin.body));

const refundList = await req("/api/v1/admin/refunds", { token: adminToken });
const threshold = refundList.body?.refundPolicy?.approvalThresholdPaise;
check("refund list exposes the approval threshold", typeof threshold === "number" && threshold >= 0, String(threshold));

const orderTotal = order.body.order.total;
if (typeof threshold === "number" && threshold > 100) {
  const smallRefund = await req("/api/v1/admin/refunds", {
    method: "POST",
    token: adminToken,
    origin: ORIGIN,
    body: { orderId: orderNumber, amount: 100, reason: "Goodwill adjustment for a scuffed lid" },
  });
  check("refund below the threshold is issued immediately", smallRefund.status === 201, JSON.stringify(smallRefund.body));
  check("small refund completes without a second approval", smallRefund.body?.requiresApproval === false);

  const partiallyRefunded = await req(`/api/v1/orders/${orderNumber}`, { token });
  check(
    "partial refund keeps the order lifecycle intact",
    partiallyRefunded.body.order.paymentStatus === "partially_refunded" &&
      partiallyRefunded.body.order.status === orderStatusBeforeRefund,
    `${partiallyRefunded.body.order.status}/${partiallyRefunded.body.order.paymentStatus}`,
  );
} else {
  console.log("  skip low-refund test — the approval threshold is at or below ₹1");
}

const remaining = orderTotal - 100;
if (typeof threshold === "number" && remaining >= threshold && threshold > 0) {
  const requestKey = `refund-${Date.now()}`;
  const heldRefund = await req("/api/v1/admin/refunds", {
    method: "POST",
    token: adminToken,
    origin: ORIGIN,
    body: { orderId: orderNumber, amount: remaining, reason: "Customer returned the full order", requestKey },
  });
  check("refund at the threshold is held for approval", heldRefund.status === 202, JSON.stringify(heldRefund.body));
  check("held refund reports requiresApproval", heldRefund.body?.requiresApproval === true && heldRefund.body?.status === "requested");
  const heldId = heldRefund.body?.id;

  const duplicateRequest = await req("/api/v1/admin/refunds", {
    method: "POST",
    token: adminToken,
    origin: ORIGIN,
    body: { orderId: orderNumber, amount: remaining, reason: "Customer returned the full order", requestKey },
  });
  check(
    "a repeated request key returns the same refund instead of a second one",
    duplicateRequest.status === 200 && duplicateRequest.body?.duplicate === true && duplicateRequest.body?.id === heldId,
    JSON.stringify(duplicateRequest.body),
  );

  const selfApproval = await req(`/api/v1/admin/refunds/${heldId}/approve`, {
    method: "POST",
    token: adminToken,
    origin: ORIGIN,
  });
  check("the requesting admin cannot approve their own refund", selfApproval.status === 403, `got ${selfApproval.status}`);

  const approval = await req(`/api/v1/admin/refunds/${heldId}/approve`, {
    method: "POST",
    token: managerToken,
    origin: ORIGIN,
  });
  check("a different admin can approve the refund", approval.status === 200, JSON.stringify(approval.body));
  check("approved refund completes in test mode", approval.body?.status === "completed", JSON.stringify(approval.body));

  const secondApproval = await req(`/api/v1/admin/refunds/${heldId}/approve`, {
    method: "POST",
    token: managerToken,
    origin: ORIGIN,
  });
  check("approving twice is refused, so money cannot move twice", secondApproval.status === 409, `got ${secondApproval.status}`);

  const fullyRefundedOrder = await req(`/api/v1/orders/${orderNumber}`, { token });
  check(
    "full refund marks the order refunded",
    fullyRefundedOrder.body.order.status === "refunded" && fullyRefundedOrder.body.order.paymentStatus === "refunded",
    `${fullyRefundedOrder.body.order.status}/${fullyRefundedOrder.body.order.paymentStatus}`,
  );
  const refundHistory = fullyRefundedOrder.body.order.statusHistory ?? [];
  check(
    "refund is recorded in the order history by the approving admin",
    refundHistory.some((entry) => entry.toStatus === "refunded" && entry.actorType === "admin" && entry.actorLabel === MANAGER_EMAIL),
    JSON.stringify(refundHistory.at(-1)),
  );

  const audit = await req("/api/v1/admin/audit?entityType=refund", { token: adminToken });
  const auditActions = (audit.body?.entries ?? []).map((entry) => entry.action);
  check("admin audit log records the refund request", auditActions.includes("refund.requested"), JSON.stringify(auditActions));
  check("admin audit log records the approval", auditActions.includes("refund.approved"), JSON.stringify(auditActions));
  check("admin audit log records the completion", auditActions.includes("refund.completed"), JSON.stringify(auditActions));
  const customerAudit = await req("/api/v1/admin/audit", { token });
  check("customer cannot read the audit log", customerAudit.status === 403);
} else {
  console.log("  skip approval tests — the order total is below the approval threshold");
}

if (!WEBHOOK_SECRET) {
  console.log("  skip webhook signature tests — RAZORPAY_WEBHOOK_SECRET is not set");
} else {
  const unsigned = await req("/api/v1/payments/webhook", { method: "POST", body: { event: "payment.captured" } });
  check("unsigned webhook is rejected", unsigned.status === 401, `got ${unsigned.status}`);

  const badSignature = await req("/api/v1/payments/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": "deadbeef" },
    body: { event: "payment.captured" },
  });
  check("webhook with an invalid signature is rejected", badSignature.status === 401, `got ${badSignature.status}`);

  // A real pending order, so the webhook has something genuine to settle.
  await req("/api/v1/cart", {
    method: "POST",
    token,
    origin: ORIGIN,
    body: { variantId: otherVariant, quantity: 1 },
  });
  const webhookOrder = await req("/api/v1/orders", {
    method: "POST",
    token,
    origin: ORIGIN,
    body: { address, idempotencyKey: `wh-${Date.now()}` },
  });
  const providerOrderId = webhookOrder.body.payment.providerOrderId;
  const eventId = randomUUID();
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: `pay_wh_${Date.now()}`, order_id: providerOrderId, method: "upi" } } },
  });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  const webhookHeaders = {
    "Content-Type": "application/json",
    "x-razorpay-signature": signature,
    "x-razorpay-event-id": eventId,
  };

  const webhookResponse = await fetch(`${BASE}/api/v1/payments/webhook`, {
    method: "POST",
    headers: webhookHeaders,
    body: payload,
  });
  const webhookBody = await webhookResponse.json();
  check("signed webhook is accepted", webhookResponse.status === 200, JSON.stringify(webhookBody));
  check("signed webhook settles the order", webhookBody.outcome === "order_marked_paid", JSON.stringify(webhookBody));

  const settled = await req(`/api/v1/orders/${webhookOrder.body.order.number}`, { token });
  check("webhook marked the order paid", settled.body.order.paymentStatus === "paid");

  const replay = await fetch(`${BASE}/api/v1/payments/webhook`, {
    method: "POST",
    headers: webhookHeaders,
    body: payload,
  });
  const replayBody = await replay.json();
  check("replayed webhook is deduplicated", replayBody.outcome === "duplicate_ignored", JSON.stringify(replayBody));
}

console.log("\nLogout");

const logout = await req("/api/v1/auth/logout", { method: "POST", cookie, origin: ORIGIN });
check("logout succeeds", logout.status === 200);
const afterLogout = await req("/api/v1/auth/me", { cookie });
check("revoked session no longer authenticates", afterLogout.status === 401);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(` - ${failure}`);
  process.exit(1);
}
