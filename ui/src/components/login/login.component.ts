import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(private formBuilder: FormBuilder, private authService: AuthService, private router: Router) {
  }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.router.navigate(['/products']);
      }
    });
  }

  // Convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.errorMessage = ''; // Clear previous errors
    
    // Stop here if form is invalid
    if (this.loginForm.invalid) {
      // Set error messages for invalid form
      if (this.f['username'].errors?.['required']) {
        this.errorMessage = 'Username is required';
      } else if (this.f['password'].errors?.['required']) {
        this.errorMessage = 'Password is required';
      } else if (this.f['password'].errors?.['minlength']) {
        this.errorMessage = 'Password must be at least 6 characters';
      }
      return;
    }

    this.isLoading = true;
    
    // Example of how you might call an auth service
    this.authService.login(this.loginForm.value)
      .subscribe({
        next: (user: any) => {
          console.log('Login successful', user);
          this.isLoading = false;
          this.router.navigate(['/products']);
        },
        error: (error: any) => {
          console.error('Login failed', error);
          this.isLoading = false;
          
          // Set appropriate error message based on the error
          if (error.status === 401) {
            this.errorMessage = 'Invalid username or password';
          } else if (error.status === 0) {
            this.errorMessage = 'Server is unreachable. Please try again later.';
          } else {
            this.errorMessage = error.message || 'An error occurred during login. Please try again.';
          }
        }
      });
  }
}
