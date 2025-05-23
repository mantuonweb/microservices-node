import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentsService } from '../../app/services/payments.service';


@Component({
  selector: 'app-payment-details',
  templateUrl: './payment-details.component.html',
  styleUrls: ['./payment-details.component.scss']
})
export class PaymentDetailsComponent implements OnInit {
  payment: any = null;
  loading = true;
  error = false;
  paymentMethods:any = {
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
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentsService: PaymentsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const paymentId = params.get('paymentId');
      if (paymentId) {
        this.loadPaymentDetails(paymentId);
      } else {
        this.error = true;
        this.loading = false;
      }
    });
  }

  loadPaymentDetails(paymentId: string): void {
    this.paymentsService.getPaymentDetails(paymentId).subscribe(
      (data:any) => {
        this.payment = data;
        this.loading = false;
      },
      (error:any) => {
        console.error('Error fetching payment details:', error);
        this.error = true;
        this.loading = false;
      }
    );
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }
}