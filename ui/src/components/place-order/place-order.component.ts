import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../app/services/cart.service';
import { AuthService } from '../../app/services/auth.service';
import { OrderService } from '../../app/services/order.service';

@Component({
    selector: 'app-place-order',
    templateUrl: './place-order.component.html',
    styleUrls: ['./place-order.component.scss'],
    imports: [ReactiveFormsModule]
})
export class PlaceOrderComponent implements OnInit {
    cartItems: CartItem[] = [];
    cartTotal: number = 0;
    orderForm: FormGroup;
    isSubmitting: boolean = false;
    showOrderSuccess: boolean = false;
    orderNumber: string = '';

    constructor(
        private cartService: CartService,
        private fb: FormBuilder,
        private router: Router,
        private authService: AuthService,
        private orderService: OrderService
    ) {
        this.orderForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            address: ['', Validators.required],
            paymentMethod: ['', Validators.required]
        });
    }

    ngOnInit(): void {
        // Get cart items
        this.cartService.getCartItems().subscribe(items => {
            this.cartItems = items;
        });

        // Get cart total
        this.cartService.getCartTotal().subscribe(total => {
            this.cartTotal = total;
        });
        this.authService.profile().subscribe((user: any) => {
            this.orderForm.patchValue({
                name: user.name,
                email: user.email,
                address: user.address
            });
        });
    }

    removeItem(productId: string): void {
        this.cartService.removeFromCart(productId);
    }

    placeOrder(): void {
        if (this.orderForm.invalid || this.cartItems.length === 0) {
            return;
        }

        this.isSubmitting = true;

        // Create order object with the new structure
        const order = {
            customer: {
                name: this.orderForm.value.name,
                email: this.orderForm.value.email,
                address: this.orderForm.value.address
            },
            mode: this.orderForm.value.paymentMethod,
            products: this.cartItems.map(item => ({
                id: item.productId,
                quantity: item.quantity
            }))
        };
        this.orderService.placeOrder(order as any).subscribe(
            (response:any) => {
                console.log('Order placed successfully:');
                // Generate random order number
                this.orderNumber = response._id;

                // Clear cart after successful order
                this.cartService.clearCart();

                // Show success modal
                this.showOrderSuccess = true;
                this.isSubmitting = false;

                // Reset form
                this.orderForm.reset();

                console.log('Order placed:', order);
            },
            (error) => {
                console.error('Error placing order:', error);
            }
        );
    }

    closeSuccessModal(): void {
        this.showOrderSuccess = false;
        this.router.navigate(['/products']);
    }
}