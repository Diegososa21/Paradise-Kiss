export interface Resource {
  id: number;
  name: string;
  desc: string;
  size: string;
  category: string;
  manufacurer: string;
  material: string;
  gender: string;
  created_at: string;
}

export type CreateResource = Omit<Resource, 'id' | 'created_at'>;
