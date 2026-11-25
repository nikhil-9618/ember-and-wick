import {
  MongoClient,
  type AggregateOptions,
  type ClientSession,
  type Collection,
  type Db,
  type Document,
  type Filter,
  type FindOptions,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
} from "mongodb";
import { ensureDatabaseReady } from "./bootstrap";
import type {
  AddressDoc,
  AuditLogDoc,
  CartDoc,
  CartItemDoc,
  CategoryDoc,
  ContactMessageDoc,
  CouponDoc,
  DeviceTokenDoc,
  IdempotencyKeyDoc,
  InventoryMovementDoc,
  NotificationDoc,
  OrderDoc,
  OrderItemDoc,
  OrderStatusHistoryDoc,
  PasswordResetChallengeDoc,
  PaymentDoc,
  ProductDoc,
  ProductImageDoc,
  ProductVariantDoc,
  RateLimitDoc,
  RefundDoc,
  ReviewDoc,
  SessionDoc,
  SettingDoc,
  SignupOtpChallengeDoc,
  UserDoc,
  WebhookEventDoc,
  WishlistItemDoc,
} from "./documents";

/**
 * MongoDB is the only data store.
 *
 * The storefront, admin dashboard and mobile API all read and write the same
 * collections. Amounts are integer paise, timestamps are ISO-8601 strings (so
 * they sort lexicographically, exactly as the previous SQL layer relied on) and
 * ids are application-generated strings stored in `_id`.
 *
 * Multi-document invariants (order + stock + ledger + history, payment capture,
 * refunds) run inside a transaction. MongoDB transactions need a replica set;
 * Atlas always provides one, and the local development instructions start one.
 */

const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/emberandwick";

let clientPromise: Promise<MongoClient> | null = null;
let storePromise: Promise<Store> | null = null;

export function mongoUri(): string {
  const configured = (process.env.MONGODB_URI ?? "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return DEFAULT_LOCAL_URI;
  throw new Error(
    "MONGODB_URI is not set, so the store has no database. Add the connection string of a MongoDB " +
      "Atlas cluster (or any MongoDB replica set) to the environment and redeploy.",
  );
}

export function databaseName(): string {
  const explicit = (process.env.MONGODB_DB ?? "").trim();
  if (explicit) return explicit;
  try {
    const path = new URL(mongoUri()).pathname.replace(/^\//, "").trim();
    if (path) return path;
  } catch {
    // A malformed URI is reported by the driver with a better message.
  }
  return "emberandwick";
}

async function connect(): Promise<MongoClient> {
  if (!clientPromise) {
    const client = new MongoClient(mongoUri(), {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

type Options = Record<string, unknown>;

/** A collection where every call is automatically joined to the transaction. */
function scoped<T extends Document>(collection: Collection<T>, session?: ClientSession) {
  const withSession = (options?: Options): Options => ({
    ...(options ?? {}),
    ...(session ? { session } : {}),
  });

  return {
    findOne: (filter: Filter<T>, options?: FindOptions) =>
      collection.findOne(filter, withSession(options as any) as any),
    find: (filter: Filter<T> = {}, options?: FindOptions) =>
      collection.find(filter, withSession(options as any) as any),
    insertOne: (doc: OptionalUnlessRequiredId<T>, options?: Options) =>
      collection.insertOne(doc, withSession(options)),
    insertMany: (docs: OptionalUnlessRequiredId<T>[], options?: Options) =>
      collection.insertMany(docs, withSession(options)),
    updateOne: (filter: Filter<T>, update: UpdateFilter<T> | Document[], options?: Options) =>
      collection.updateOne(filter, update, withSession(options)),
    updateMany: (filter: Filter<T>, update: UpdateFilter<T> | Document[], options?: Options) =>
      collection.updateMany(filter, update, withSession(options)),
    deleteOne: (filter: Filter<T>, options?: Options) => collection.deleteOne(filter, withSession(options)),
    deleteMany: (filter: Filter<T> = {}, options?: Options) => collection.deleteMany(filter, withSession(options)),
    countDocuments: (filter: Filter<T> = {}, options?: Options) =>
      collection.countDocuments(filter, withSession(options)),
    aggregate: <R extends Document = Document>(pipeline: Document[], options?: AggregateOptions) =>
      collection.aggregate<R>(pipeline, withSession(options as any) as any),
    findOneAndUpdate: (filter: Filter<T>, update: UpdateFilter<T> | Document[], options?: Options) =>
      collection.findOneAndUpdate(filter, update, {
        ...withSession(options),
        returnDocument: "after",
      } as never),
    createIndex: (indexSpec: Document, options?: Document) => collection.createIndex(indexSpec, options),
  };
}

export type Scoped<T extends Document> = ReturnType<typeof scoped<T>>;

export class Store {
  readonly users: Scoped<UserDoc>;
  readonly sessions: Scoped<SessionDoc>;
  readonly addresses: Scoped<AddressDoc>;
  readonly categories: Scoped<CategoryDoc>;
  readonly products: Scoped<ProductDoc>;
  readonly product_images: Scoped<ProductImageDoc>;
  readonly product_variants: Scoped<ProductVariantDoc>;
  readonly carts: Scoped<CartDoc>;
  readonly cart_items: Scoped<CartItemDoc>;
  readonly wishlist_items: Scoped<WishlistItemDoc>;
  readonly coupons: Scoped<CouponDoc>;
  readonly orders: Scoped<OrderDoc>;
  readonly order_items: Scoped<OrderItemDoc>;
  readonly payments: Scoped<PaymentDoc>;
  readonly refunds: Scoped<RefundDoc>;
  readonly reviews: Scoped<ReviewDoc>;
  readonly notifications: Scoped<NotificationDoc>;
  readonly contact_messages: Scoped<ContactMessageDoc>;
  readonly webhook_events: Scoped<WebhookEventDoc>;
  readonly idempotency_keys: Scoped<IdempotencyKeyDoc>;
  readonly rate_limits: Scoped<RateLimitDoc>;
  readonly settings: Scoped<SettingDoc>;
  readonly device_tokens: Scoped<DeviceTokenDoc>;
  readonly order_status_history: Scoped<OrderStatusHistoryDoc>;
  readonly admin_audit_log: Scoped<AuditLogDoc>;
  readonly inventory_movements: Scoped<InventoryMovementDoc>;
  readonly signup_otp_challenges: Scoped<SignupOtpChallengeDoc>;
  readonly password_reset_challenges: Scoped<PasswordResetChallengeDoc>;

  constructor(
    readonly db: Db,
    readonly session?: ClientSession,
  ) {
    this.users = scoped(db.collection<UserDoc>("users"), session);
    this.sessions = scoped(db.collection<SessionDoc>("sessions"), session);
    this.addresses = scoped(db.collection<AddressDoc>("addresses"), session);
    this.categories = scoped(db.collection<CategoryDoc>("categories"), session);
    this.products = scoped(db.collection<ProductDoc>("products"), session);
    this.product_images = scoped(db.collection<ProductImageDoc>("product_images"), session);
    this.product_variants = scoped(db.collection<ProductVariantDoc>("product_variants"), session);
    this.carts = scoped(db.collection<CartDoc>("carts"), session);
    this.cart_items = scoped(db.collection<CartItemDoc>("cart_items"), session);
    this.wishlist_items = scoped(db.collection<WishlistItemDoc>("wishlist_items"), session);
    this.coupons = scoped(db.collection<CouponDoc>("coupons"), session);
    this.orders = scoped(db.collection<OrderDoc>("orders"), session);
    this.order_items = scoped(db.collection<OrderItemDoc>("order_items"), session);
    this.payments = scoped(db.collection<PaymentDoc>("payments"), session);
    this.refunds = scoped(db.collection<RefundDoc>("refunds"), session);
    this.reviews = scoped(db.collection<ReviewDoc>("reviews"), session);
    this.notifications = scoped(db.collection<NotificationDoc>("notifications"), session);
    this.contact_messages = scoped(db.collection<ContactMessageDoc>("contact_messages"), session);
    this.webhook_events = scoped(db.collection<WebhookEventDoc>("webhook_events"), session);
    this.idempotency_keys = scoped(db.collection<IdempotencyKeyDoc>("idempotency_keys"), session);
    this.rate_limits = scoped(db.collection<RateLimitDoc>("rate_limits"), session);
    this.settings = scoped(db.collection<SettingDoc>("settings"), session);
    this.device_tokens = scoped(db.collection<DeviceTokenDoc>("device_tokens"), session);
    this.order_status_history = scoped(db.collection<OrderStatusHistoryDoc>("order_status_history"), session);
    this.admin_audit_log = scoped(db.collection<AuditLogDoc>("admin_audit_log"), session);
    this.inventory_movements = scoped(db.collection<InventoryMovementDoc>("inventory_movements"), session);
    this.signup_otp_challenges = scoped(db.collection<SignupOtpChallengeDoc>("signup_otp_challenges"), session);
    this.password_reset_challenges = scoped(db.collection<PasswordResetChallengeDoc>("password_reset_challenges"), session);
  }
}

/** The shared store, with collections created, indexed and (optionally) seeded. */
export async function getDb(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async () => {
      const client = await connect();
      const store = new Store(client.db(databaseName()));
      await ensureDatabaseReady(store);
      return store;
    })().catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
}

/**
 * Runs `work` in a single MongoDB transaction, handing it a store that is bound
 * to the session. Every write inside is committed together or not at all.
 */
export async function withTransaction<T>(work: (tx: Store) => Promise<T>): Promise<T> {
  const store = await getDb();
  const client = await connect();
  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await work(new Store(store.db, session));
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
    return result as T;
  } finally {
    await session.endSession();
  }
}

/** Environment variables (Vercel process env, or the Workers binding when present). */
export async function getEnv(): Promise<Record<string, string | undefined>> {
  return { ...process.env } as Record<string, string | undefined>;
}

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * Case-insensitive "contains" match, the MongoDB equivalent of `LIKE '%value%'`
 * with the user's input escaped so a `%` or `(` cannot break the query.
 */
export function contains(value: string): RegExp {
  return new RegExp(value.replace(REGEX_SPECIALS, "\\$&"), "i");
}

/** MongoDB duplicate-key error, used where a unique index is the guard. */
export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000);
}
