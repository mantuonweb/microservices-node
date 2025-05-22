import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CartItem } from './cart.service';

export interface OrderInfo {
  name: string;
  email: string;
  address: string;
  paymentMethod: string;
}

export interface Order {
  customerInfo: OrderInfo;
  items: CartItem[];
  total: number;
  orderDate: Date;
}

export interface OrderResponse {
  success: boolean;
  orderNumber: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:9000/api';
  constructor(private http: HttpClient) { }

  placeOrder(order: Order): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiUrl}/orders`, order);
  }

  getOrders(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/orders`);
  }
}