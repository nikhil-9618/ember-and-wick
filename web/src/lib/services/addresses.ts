import { getDb } from "../db";

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
  const db = await getDb();
  const rows = await db.addresses.find({ user_id: userId }).sort({ is_default: -1, created_at: -1 }).toArray();
  return (rows as any[]).map((row) => ({
    id: row._id,
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
