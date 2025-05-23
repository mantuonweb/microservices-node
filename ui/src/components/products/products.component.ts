import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../app/services/product.service';
import { Product } from '../models/product.model';
import { CartItem, CartService } from '../../services/cart.service';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  loading = true;
  error: string | null = null;
  showAddedToast = false;
  toastMessage = '';
  constructor(private productService: ProductService, private cartService: CartService) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data;

        // Sync with cart items
        this.cartService.getCartItems().subscribe(cartItems => {
          // Update product quantities and addedToCart flags based on cart contents
          this.products.forEach(product => {
            const cartItem = cartItems.find(item => item.productId === product._id);
            if (cartItem) {
              product.quantity = cartItem.quantity;
              product.addedToCart = true;
            } else {
              product.quantity = 1; // Default quantity
              product.addedToCart = false;
            }
          });
        });

        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load products. Please try again later.';
        console.error('Error fetching products:', err);
        this.loading = false;
      }
    });
  }
  /**
   * Increases the quantity of a product
   */
  increaseQuantity(product: any): void {
    if (!product.quantity) {
      product.quantity = 1;
    }
    product.quantity++;
  }

  /**
   * Decreases the quantity of a product (minimum 1)
   */
  decreaseQuantity(product: any): void {
    if (!product.quantity) {
      product.quantity = 1;
    }
    if (product.quantity > 1) {
      product.quantity--;
    }
  }

  /**
   * Adds the product to cart with the selected quantity
   */
  addToCart(product: any): void {
    const quantity = product.quantity || 1;
    const cartItem: CartItem = {
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      description: product.description
    };
    this.cartService.addToCart(cartItem);
    product.addedToCart = true;
    this.toastMessage = `Added ${quantity} ${quantity > 1 ? 'items' : 'item'} of ${product.name} to cart`;
    this.showAddedToast = true;
    setTimeout(() => {
      this.hideToast();
    }, 3000);
  }

  hideToast(): void {
    this.showAddedToast = false;
  }
}
