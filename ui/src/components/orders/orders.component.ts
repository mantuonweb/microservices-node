import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService } from '../../services/order.service';

interface Product {
  id: string;
  name: string;
  quantity: number;
  _id: string;
}

interface Customer {
  name: string;
  email: string;
  address: string;
}

interface Order {
  _id: string;
  customer: Customer;
  products: Product[];
  totalAmount: number;
  mode: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  paymentId: string;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  orders:any[] = []
  constructor(private orderServicee: OrderService) { 
    this.orderServicee.getOrders().subscribe((orders: Order[]) => {
      this.orders = orders;
    });
  }
  // orders: Order[] = [
  //   {
  //     "customer": {
  //       "name": "Mantu Nigam",
  //       "email": "mantuonweb@gmail.com.com",
  //       "address": "123 Main Street, Anytown, USA"
  //     },
  //     "_id": "6828ba7c6192a26c8df8bb3a",
  //     "products": [
  //       {
  //         "id": "6828b9e07eb810346d97340a",
  //         "name": "iPhone 16",
  //         "quantity": 2,
  //         "_id": "6828ba7d6192a26c8df8bb3b"
  //       }
  //     ],
  //     "totalAmount": 3001.984,
  //     "mode": "CREDIT_CARD",
  //     "createdAt": "2025-05-17T16:34:05.016Z",
  //     "updatedAt": "2025-05-17T16:34:05.158Z",
  //     "__v": 0,
  //     "paymentId": "6828ba7d5e262f0466aac01b"
  //   }
  // ];


  ngOnInit(): void {
    // In a real application, you would fetch orders from a service
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}