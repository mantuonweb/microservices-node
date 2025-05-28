export interface Product {
  _id: string;
  name: string;
  price: number;
  description: string;
  quantity?: number;
  originalQuantity?: number;
  addedToCart?: boolean;
  __v: number;
}