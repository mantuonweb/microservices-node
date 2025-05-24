import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Product } from '../models/product.model';
import { CartItem, CartService } from '../../services/cart.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],

  imports:[ FormsModule]
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  loading = true;
  error: string | null = null;
  showAddedToast = false;
  toastMessage = '';
  searchTerm: string = '';
  filteredProducts: any[] = [];
  allProducts: any[] = [];
  constructor(private productService: ProductService, private cartService: CartService) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (data:any) => {
        this.allProducts = data;
        this.products = [...this.allProducts];

        // Sync with cart items
        this.cartService.getCartItems().subscribe((cartItems:any) => {
          // Update product quantities and addedToCart flags based on cart contents
          this.products.forEach(product => {
            const cartItem = cartItems.find((item:any) => item.productId === product._id);
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
      error: (err:any) => {
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
  deleteProduct(product: any) {
    this.cartService.removeFromCart(product._id);
  }
  // Add these methods to handle search
searchProducts() {
  if (!this.searchTerm.trim()) {
    this.products = [...this.allProducts];
    return;
  }
  
  const term = this.searchTerm.toLowerCase().trim();
  this.products = this.allProducts.filter(product => 
    product.name.toLowerCase().includes(term) || 
    product.description.toLowerCase().includes(term)
  );
}

clearSearch() {
  this.searchTerm = '';
  this.products = [...this.allProducts];
}
}
