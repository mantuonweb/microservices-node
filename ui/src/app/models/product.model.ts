export interface Product {
  _id: string;
  name: string;
  price: number;
  description: string;
  quantity?: number;
  addedToCart?: boolean;
  __v: number;
}