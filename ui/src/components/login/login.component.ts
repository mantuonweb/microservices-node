import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;

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
    // Stop here if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    // TODO: Implement login logic
    console.log('Login form submitted', this.loginForm.value);

    // Example of how you might call an auth service
    this.authService.login(this.loginForm.value)
      .subscribe({
        next: (user: any) => {
          console.log('Login successful', user);
          this.router.navigate(['/products']);
        },
        error: (error:any) => {
          console.error('Login failed', error);
        }
      });
  }
}
