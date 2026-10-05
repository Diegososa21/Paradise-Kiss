export interface Resource {
  id: number;
  name: string;
  amount: number;
  desc: string;
  size: string;
  material: string;
  category: number;
  category_name: string;
  manufacturer: number;
  manufacturer_name: string;
  gender: number;
  gender_name: string;
  created_at: string;
}

export type CreateResource = Omit<
  Resource,
  'id' | 'created_at' | 'category_name' | 'manufacturer_name' | 'gender_name'
>;

export interface Category {
  id: number;
  name: string;
}

export interface Gender {
  id: number;
  name: string;
}

export interface Manufacturer {
  id: number;
  name: string;
  location: string;
}

export interface SalesData {
  id: number;
  year: number;
  quarter: number;
  category: number;
  category_name: string;
  units_sold: number;
  revenue: string;
}

export interface InventorySale {
  id: number;
  resource: number | null;
  resource_name: string;
  category_name: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  sold_by: number | null;
  sold_by_username: string;
  sold_at: string;
}

export interface SellResourceResponse {
  resource: Resource;
  sale: InventorySale;
}
