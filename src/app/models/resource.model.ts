export interface Resource {
  id: number;
  gtin: string | null;
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
  shelf_number: string;
  bin_number: string;
  reorder_threshold: number;
  purchase_date: string | null;
  /** WHS-Preis (Wholesale/Einkauf) in Euro, as sent by the API, e.g. "24.50". */
  wholesale_price: string;
  /** RT-Preis (Retail/Verkauf) in Euro, as sent by the API, e.g. "79.99". */
  retail_price: string;
  created_at: string;
}

export type CreateResource = Omit<
  Resource,
  | 'id'
  | 'gtin'
  | 'created_at'
  | 'category_name'
  | 'manufacturer_name'
  | 'gender_name'
  | 'wholesale_price'
  | 'retail_price'
> & {
  wholesale_price: number;
  retail_price: number;
};

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

export type CreateCategory = Omit<Category, 'id'>;

export type CreateManufacturer = Omit<Manufacturer, 'id'>;

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
  /** RT price per unit when the sale was booked, e.g. "34.99"; null for very old sales. */
  unit_price: string | null;
  revenue: string | null;
  stock_before: number;
  stock_after: number;
  sold_by: number | null;
  sold_by_username: string;
  sold_at: string;
}

/** historical = quarterly figures 2023–2025, live = sales registered in the app. */
export type SalesSource = 'historical' | 'live' | 'mixed';

export interface SalesReportQuarter {
  year: number;
  quarter: number;
  units: number;
  revenue: string;
  source: SalesSource;
}

export interface SalesReportYear {
  year: number;
  units: number;
  revenue: string;
  source: SalesSource;
}

export interface SalesReport {
  quarters: SalesReportQuarter[];
  years: SalesReportYear[];
  total_units: number;
  total_revenue: string;
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantAnswer {
  answer: string;
  /** gemini = answered by Google Gemini, basic = built-in rule-based analysis. */
  mode: 'gemini' | 'basic';
  model: string;
  notice: string;
}

export interface SellResourceResponse {
  resource: Resource;
  sale: InventorySale;
  movement: StockMovement;
}

export interface StockMovement {
  id: number;
  resource: number | null;
  resource_name: string;
  movement_type: 'sale' | 'restock' | 'cancellation';
  movement_type_label: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  purchase_date: string | null;
  performed_by: number | null;
  performed_by_username: string;
  occurred_at: string;
}

export interface CancelSaleResponse {
  /** The product with its restored stock, or null when the product was already deleted. */
  resource: Resource | null;
  movement: StockMovement | null;
}

export interface RestockResource {
  quantity: number;
  purchase_date?: string;
  shelf_number?: string;
  bin_number?: string;
}

export interface RestockResourceResponse {
  resource: Resource;
  movement: StockMovement;
}

export type ResourceDetails = Pick<
  CreateResource,
  'name' | 'desc' | 'size' | 'material' | 'category' | 'manufacturer' | 'gender'
>;

export interface InventorySettings {
  shelf_number?: string;
  bin_number?: string;
  reorder_threshold?: number;
  wholesale_price?: number;
  retail_price?: number;
}
