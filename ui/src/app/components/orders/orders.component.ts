import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';

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
  orders: any[] = [];
  paymentMethods: any = {
    "CREDIT_CARD": {
      label: "Credit Card",
      value: "CREDIT_CARD"
    },
    "GPAY": {
      label: "Google Pay",
      value: "GPAY"
    },
    "UPI": {
      label: "UPI",
      value: "UPI"
    }
  };

  constructor(private orderService: OrderService, private authService: AuthService, private router: Router) {
    this.authService.profile().pipe(takeUntilDestroyed()).subscribe((user: any) => {
      this.orderService.getOrders(user.email).subscribe((orders: Order[]) => {
        this.orders = orders.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    });
  }


  ngOnInit(): void {
    // In a real application, you would fetch orders from a service
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
  showPaymentDetails(order: any) {
    this.router.navigate(['/payment-details', order.paymentId]);
  }
  exportOrders() {
    this.authService.profile().pipe(take(1)).subscribe((user: any) => {
      this.orderService.getFullOrders(user.email).subscribe((orders: Order[]) => {
        const ordersSorted = orders.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.downloadOrdersJSON(ordersSorted);
      });
    });
  }
  exportSingleOrder(order: any) {
    this.authService.profile().pipe(take(1)).subscribe((user: any) => {
      this.orderService.getFullOrders(user.email).subscribe((orders: Order[]) => {
        const ordersSorted = orders.find((o: any) => o._id == order._id);
        this.downloadOrderAsText(ordersSorted);
      });
    });
  }
  downloadOrdersJSON(orders: any[]): void {
    const jsonContent = JSON.stringify(orders, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orders-data.json';
    // Append to the document, trigger the download, and remove the link
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Clean up the URL object
    URL.revokeObjectURL(url);
  }
  downloadOrderAsText(order: any): void {

    // Format the date
    const orderDate = new Date(order?.createdAt).toLocaleDateString();
    const orderTime = new Date(order?.createdAt).toLocaleTimeString();

    // Create a formatted text receipt
    let textContent = '';

    // Add header with border
    textContent += '='.repeat(60) + '\n';
    textContent += ' '.repeat(20) + 'ORDER RECEIPT' + ' '.repeat(20) + '\n';
    textContent += '='.repeat(60) + '\n\n';

    // Order details
    textContent += `Order ID: ${order._id}\n`;
    textContent += `Date: ${orderDate} ${orderTime}\n\n`;

    // Customer information
    textContent += 'CUSTOMER INFORMATION\n';
    textContent += '-'.repeat(60) + '\n';
    textContent += `Name: ${order.customer.name}\n`;
    textContent += `Email: ${order.customer.email}\n`;
    textContent += `Address: ${order.customer.address}\n\n`;

    // Payment information
    textContent += 'PAYMENT INFORMATION\n';
    textContent += '-'.repeat(60) + '\n';
    textContent += `Payment Method: ${order.mode}\n`;
    textContent += `Payment ID: ${order.paymentId}\n`;
    textContent += `Transaction ID: ${order.payment?.transactionId || 'N/A'}\n`;
    textContent += `Status: ${order.payment?.status || 'N/A'}\n\n`;

    // Product details
    textContent += 'PRODUCTS\n';
    textContent += '-'.repeat(60) + '\n';
    textContent += 'ID'.padEnd(12) + 'Name'.padEnd(20) + 'Qty'.padEnd(5) + 'Price'.padEnd(12) + 'Total\n';
    textContent += '-'.repeat(60) + '\n';

    // Add each product
    order.products.forEach((product: any) => {
      const productId = product.id.substring(product.id.length - 6);
      const productTotal = (product.price * product.quantity).toFixed(2);

      textContent += productId.padEnd(12);
      textContent += product.name.padEnd(20);
      textContent += product.quantity.toString().padEnd(5);
      textContent += (`₹${product.price.toFixed(2)}`).padEnd(12);
      textContent += `₹${productTotal}\n`;
    });

    // Add total
    textContent += '-'.repeat(60) + '\n';
    textContent += ' '.repeat(37) + 'Total: '.padEnd(12) + `₹${order.totalAmount.toFixed(2)}\n`;
    textContent += '='.repeat(60) + '\n\n';

    // Add footer
    textContent += ' '.repeat(15) + 'Thank you for your purchase!' + ' '.repeat(15) + '\n';
    textContent += '='.repeat(60) + '\n';

    // Create and download the text file
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `order-receipt-${order._id.substring(order._id.length - 8)}.txt`;

    // Append to the document, trigger the download, and remove the link
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  }

}