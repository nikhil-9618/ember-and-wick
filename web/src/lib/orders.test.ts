import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses, orderNumber, releasesInventory } from "./orders";

describe("order state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "processing")).toBe(true);
    expect(canTransition("processing", "packed")).toBe(true);
    expect(canTransition("packed", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("refuses to skip steps", () => {
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("paid", "delivered")).toBe(false);
    expect(canTransition("shipped", "packed")).toBe(false);
  });

  it("treats cancelled and refunded as terminal", () => {
    expect(nextStatuses("cancelled")).toEqual([]);
    expect(nextStatuses("refunded")).toEqual([]);
  });

  it("does not allow cancelling a delivered order online", () => {
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("allows a failed payment to be retried", () => {
    expect(canTransition("payment_failed", "pending_payment")).toBe(true);
    expect(canTransition("payment_failed", "paid")).toBe(false);
  });

  it("marks only cancelled and failed states as inventory-releasing", () => {
    expect(releasesInventory("cancelled")).toBe(true);
    expect(releasesInventory("payment_failed")).toBe(true);
    expect(releasesInventory("paid")).toBe(false);
    expect(releasesInventory("shipped")).toBe(false);
  });
});

describe("orderNumber", () => {
  it("uses the EW- prefix and a date stamp", () => {
    const number = orderNumber();
    expect(number).toMatch(/^EW-\d{6}-[A-Z0-9]{3,6}$/);
  });

  it("is not trivially repeated", () => {
    const numbers = new Set(Array.from({ length: 50 }, () => orderNumber()));
    expect(numbers.size).toBeGreaterThan(45);
  });
});
