import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

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
  orders: any[] = []
  constructor(private orderServicee: OrderService, private authService: AuthService) {
    this.authService.profile().subscribe((user: any) => {
      this.orderServicee.getOrders(user.email).subscribe((orders: Order[]) => {
        this.orders = orders;
      });
    });
  }


  ngOnInit(): void {
    // In a real application, you would fetch orders from a service
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}