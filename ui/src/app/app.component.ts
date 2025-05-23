import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private authService = inject(AuthService);
  public isLoggedIn = toSignal(this.authService?.currentUser?.pipe(map(item => !!item)));
  public cartService = inject(CartService);
  cartItemsCount = toSignal(this.cartService.getCartItemsCount());
  constructor() {
  }

  logout() {
    this.authService.logout();
  }
}
