import { allRows } from "../db";

export interface AddressView {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export async function listAddresses(userId: string): Promise<AddressView[]> {
  const rows = await allRows<{
    id: string;
    label: string | null;
    full_name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_default: number;
  }>(
    `SELECT id, label, full_name, phone, line1, line2, city, state, postal_code, country, is_default
       FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default === 1,
  }));
}
