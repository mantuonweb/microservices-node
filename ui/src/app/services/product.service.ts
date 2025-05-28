import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../components/models/product.model';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = `${environment.apiUrl}/products`;
  private apiUrlFetch = `${environment.apiUrl}/query/products`;
  private apiInventoryUrl = `${environment.apiUrl}/inventories`;
  constructor(private http: HttpClient) { }

  /**
   * Get all products from the backend
   */
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrlFetch);
  }

  /**
 * Get all products from the backend
 */
  getAllProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  /**
* Get all products from the backend
*/
  getInventories(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiInventoryUrl);
  }


  /**
   * Get a single product by ID
   */
  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new product
   */
  createProduct(product: Omit<Product, '_id' | '__v'>): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  /**
   * Update an existing product
   */
  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  updateProductInventory(id: string, quantity:number): Observable<Product> {
    return this.http.put<Product>(`${this.apiInventoryUrl}/${id}`, {
      quantity: quantity
    });
  }

  /**
   * Delete a product
   */
  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}