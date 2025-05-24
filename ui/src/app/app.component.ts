import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './services/auth.service';
import { CartService } from './services/cart.service';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  public isLoggedIn = toSignal(this.authService?.currentUser?.pipe(map(item => !!item)));
  public cartService = inject(CartService);
  cartItemsCount = toSignal(this.cartService.getCartItemsCount());
  noticationCount: any = toSignal(this.notification.list().pipe(map(item => item.length)));
  constructor() {
    this.authService?.currentUser?.pipe(map(item => !!item)).subscribe((item) => {
      if (item) {
        this.notification.init();
        this.cartService.init();
      }
    })
  }

  logout() {
    this.authService.logout();
  }
  clearNotification() {
    this.notification.clear();
  }
}
