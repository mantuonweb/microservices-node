import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Product } from '../models/product.model';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-products-manager',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],

  imports: [FormsModule]
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
  constructor(private productService: ProductService) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;

    // Using forkJoin to execute both requests in parallel and wait for both to complete
    forkJoin({
      inventories: this.productService.getInventories(),
      products: this.productService.getAllProducts()
    }).subscribe({
      next: (result) => {
        // Here you can access both responses
        const inventories = result.inventories;
        this.allProducts = result.products;

        // You can merge or process the data as needed
        // For example, you might want to enrich products with inventory data
        this.products = this.allProducts.map(product => {
          const inventory = inventories.find((inv: any) => inv.productId === product._id);
          return {
            ...product,
            quantity: inventory ? (inventory as any)?.quantity : 0,
            originalQuantity: inventory ? (inventory as any)?.quantity : 0
          };
        });

        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Failed to load products. Please try again later.';
        console.error('Error fetching data:', err);
        this.loading = false;
      }
    });
  }

  increaseQuantity(product: any): void {
    // Initialize quantity if it doesn't exist
    if (!product.quantity) {
      product.quantity = 1;
    }

    // Increment quantity
    product.quantity++;
  }

  addProduct(product: any): void {
    // Use the quantity value (default to 1 if not set)
    const quantityToAdd = product.quantity || 1;
    this.productService.updateProductInventory(product._id, quantityToAdd).subscribe(
      (updatedProduct: any) => {
        // Update the product's quantity in the UI

        this.showAddedToast = true;
        const quantity = product.quantity - product.originalQuantity;
        this.toastMessage = `Added ${quantity} ${quantity > 1 ? 'items' : 'item'} of ${product.name} to Inventory`;
        product.quantity = updatedProduct.quantity;
        product.originalQuantity = updatedProduct.quantity;
        setTimeout(() => {
          this.hideToast();
        }, 3000);
      },
      (error: any) => {
        console.error('Error updating product quantity:', error);
      }
    );
  }
  hideToast(): void {
    this.showAddedToast = false;
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
  checkQuantity(product: any): boolean {
    console.log(product?.originalQuantity > product?.quantity);
    return (product?.originalQuantity > product?.quantity)
  }
}
