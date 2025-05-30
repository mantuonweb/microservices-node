import { Routes } from '@angular/router';
import { ProfileComponent } from './components/profile/profile.component';
import { AuthGuard } from './services/auth.guard';
import { AdminAuthGuard } from './services/auth.guard.admin';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'products',
    canActivate: [AuthGuard],
    loadComponent: () => import('./components/products/products.component').then(m => m.ProductsComponent)
  },
  {
    path: 'product-manager',
    canActivate: [AdminAuthGuard],
    loadComponent: () => import('./components/products-manager/products.component').then(m => m.ProductsComponent)
  },
  {
    path: 'place-order',
    canActivate: [AuthGuard],
    loadComponent: () => import('./components/place-order/place-order.component').then(m => m.PlaceOrderComponent)
  },
  {
    path: 'orders',
    canActivate: [AuthGuard],
    loadComponent: () => import('./components/orders/orders.component').then(m => m.OrdersComponent)
  },
  {
    path: 'orders',
    canActivate: [AuthGuard],
    loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'payment-details/:paymentId',
    canActivate: [AuthGuard],
    loadComponent: () => import('./components/payment-details/payment-details.component').then(m => m.PaymentDetailsComponent)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
