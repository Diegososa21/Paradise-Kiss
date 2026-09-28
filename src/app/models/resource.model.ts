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
