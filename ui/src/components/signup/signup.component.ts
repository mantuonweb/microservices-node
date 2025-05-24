import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink]
})
export class SignupComponent implements OnInit {
  signupForm!: FormGroup;
  successMessage: string = '';
  errorMessage: string = '';
  isSubmitting: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.signupForm = this.formBuilder.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      userRole: [true],
      adminRole: [false]
    });
  }

  get f() {
    return this.signupForm.controls;
  }

  onSubmit(): void {
    // Reset messages
    this.successMessage = '';
    this.errorMessage = '';
    
    if (this.signupForm.invalid) {
      this.errorMessage = 'Please fill all required fields correctly.';
      return;
    }

    // Prepare the roles array based on checkbox selections
    const roles: string[] = [];
    if (this.signupForm.value.userRole) {
      roles.push('user');
    }
    if (this.signupForm.value.adminRole) {
      roles.push('admin');
    }

    // Create the signup data object
    const signupData = {
      username: this.signupForm.value.username,
      email: this.signupForm.value.email,
      password: this.signupForm.value.password,
      roles: roles
    };

    this.isSubmitting = true;
    
    this.authService.register(signupData).subscribe(
      (response) => {
        console.log('Signup successful:', response);
        this.successMessage = 'Registration successful! Redirecting to login...';
        this.isSubmitting = false;
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      (error) => {
        console.error('Signup error:', error);
        this.isSubmitting = false;
        
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Registration failed. Please try again later.';
        }
      }
    );
  }
}