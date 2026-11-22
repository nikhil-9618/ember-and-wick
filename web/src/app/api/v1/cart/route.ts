import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { cartItemSchema, cartUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { addToCart, getCart, removeFromCart, setCartQuantity } from "@/lib/services/cart";

function shape(cart: Awaited<ReturnType<typeof getCart>>) {
  return {
    cartId: cart.cartId,
    items: cart.items,
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    totals: cart.totals,
  };
}

export const GET = apiRoute(async (request) => {
  const { user } = await requireUser(request);
  return json(shape(await getCart(user.id)));
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, cartItemSchema);
  return json(shape(await addToCart(user.id, input.variantId, input.quantity)));
});

export const PATCH = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, cartUpdateSchema);
  return json(shape(await setCartQuantity(user.id, input.variantId, input.quantity)));
});

export const DELETE = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variantId")?.trim();
  if (!variantId) return json({ error: { code: "validation_error", message: "variantId is required." } }, { status: 422 });
  return json(shape(await removeFromCart(user.id, variantId)));
});
