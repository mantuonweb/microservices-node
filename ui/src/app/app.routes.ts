import { Routes } from '@angular/router';
import { AuthGuard } from '../services/auth.guard';

export const routes: Routes = [
    {
      path: 'login',
      loadComponent: () => import('../components/login/login.component').then(m => m.LoginComponent)
    },
    {
      path: 'products',
      canActivate: [AuthGuard],
      loadComponent: () => import('../components/products/products.component').then(m => m.ProductsComponent)
    },
    {
      path: 'place-order',
      canActivate: [AuthGuard],
      loadComponent: () => import('../components/place-order/place-order.component').then(m => m.PlaceOrderComponent)
    },
     {
      path: 'orders',
      canActivate: [AuthGuard],
      loadComponent: () => import('../components/orders/orders.component').then(m => m.OrdersComponent)
    },
    
    {
      path: '',
      redirectTo: 'login',
      pathMatch: 'full'
    }
];
