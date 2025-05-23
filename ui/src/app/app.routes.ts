import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';
import { ProfileComponent } from '../components/profile/profile.component';

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
      path: 'orders',
      canActivate: [AuthGuard],
      loadComponent: () => import('../components/profile/profile.component').then(m => m.ProfileComponent)
    },
    {
      path: 'profile',
      component: ProfileComponent,
      canActivate: [AuthGuard]
    },
    {
      path: '',
      redirectTo: 'login',
      pathMatch: 'full'
    }
];
