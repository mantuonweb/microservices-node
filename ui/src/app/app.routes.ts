import { Routes } from '@angular/router';

export const routes: Routes = [
    {
      path: 'login',
      loadComponent: () => import('../components/login/login.component').then(m => m.LoginComponent)
    },
    {
      path: 'products',
      loadComponent: () => import('../components/products/products.component').then(m => m.ProductsComponent)
    },
    {
      path: '',
      redirectTo: 'login',
      pathMatch: 'full'
    }
];
