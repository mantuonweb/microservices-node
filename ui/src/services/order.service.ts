import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CartItem } from './cart.service';
import { environment } from '../environments/environment';

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
  private apiUrl = environment.apiUrl + '/orders';
  constructor(private http: HttpClient) { }

  placeOrder(order: Order): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiUrl}`, order);
  }

  getOrders(email: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/by-email/${email}`);
  }
}