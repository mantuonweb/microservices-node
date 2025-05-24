import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  keyName = 'cart';
  constructor(private authService: AuthService) {

  }
  init() {
    this.keyName = this.keyName + this.authService.currentUserValue?.email;
    // Load cart from localStorage if available
    const savedCart = localStorage.getItem(this.keyName);

    if (savedCart) {
      this.cartItems = JSON.parse(savedCart);
      this.cartSubject.next(this.cartItems);
    }
  }

  getCartItems(): Observable<CartItem[]> {
    return this.cartSubject.asObservable();
  }

  getCartItemsCount(): Observable<number> {
    return new Observable<number>(observer => {
      this.cartSubject.subscribe(items => {
        const count = items.reduce((total, item) => total + item.quantity, 0);
        observer.next(count);
      });
    });
  }

  getCartTotal(): Observable<number> {
    return new Observable<number>(observer => {
      this.cartSubject.subscribe(items => {
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        observer.next(total);
      });
    });
  }

  addToCart(item: CartItem): void {
    const existingItemIndex = this.cartItems.findIndex(i => i.productId === item.productId);

    if (existingItemIndex > -1) {
      // Item exists, update quantity
      this.cartItems[existingItemIndex].quantity += item.quantity;
    } else {
      // New item, add to cart
      this.cartItems.push(item);
    }

    this.updateCart();
  }

  updateQuantity(productId: string, quantity: number): void {
    const index = this.cartItems.findIndex(item => item.productId === productId);
    if (index > -1) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        this.cartItems[index].quantity = quantity;
        this.updateCart();
      }
    }
  }

  removeFromCart(productId: string): void {
    this.cartItems = this.cartItems.filter(item => item.productId !== productId);
    this.updateCart();
  }

  clearCart(): void {
    this.cartItems = [];
    this.updateCart();
  }

  private updateCart(): void {
    // Update the BehaviorSubject
    this.cartSubject.next([...this.cartItems]);

    // Save to localStorage
    localStorage.setItem(this.keyName, JSON.stringify(this.cartItems));
  }
}