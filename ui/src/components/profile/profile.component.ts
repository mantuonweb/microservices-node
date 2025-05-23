import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../app/services/user.service';
import { User } from '../models/user.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  user!: User;
  isEditing = false;
  submitMessage = '';
  submitSuccess = false;
  userProfle: any;
  isNewUser = false;
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.authService.profile().subscribe((user: any) => {
      console.log('ProfileComponent initialized', user);
      this.userProfle = user;
      this.loadUserProfile(user.email);
    });
  }

  initForm(): void {
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: [{ value: '', disabled: true }],
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      address: this.fb.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        zipCode: ['', Validators.required],
        country: ['', Validators.required]
      })
    });
  }

  loadUserProfile(email: string): void {
    this.userService.getUserProfile(email).subscribe({
      next: (user) => {
        this.user = user;
        this.profileForm.patchValue(user);
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
        this.isNewUser = true;
        this.profileForm.patchValue({
          email: this.userProfle.email,
          username: this.userProfle.username
        });
      }
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.profileForm.patchValue(this.user);
    }
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      const updatedUser = {
        ...this.user,
        ...this.profileForm.value,
        username: this.user?.username || this.userProfle.username
      };

      // In a real app, you would call updateUserProfile instead
      const req = !this.isNewUser ? this.userService.updateUserProfile(updatedUser) : this.userService.createUserProfile(updatedUser)
      req.subscribe({
        next: (updatedUser) => {
          this.user = updatedUser;
          this.submitMessage = 'Profile updated successfully!';
          this.submitSuccess = true;
          this.isEditing = false;
          this.isNewUser = false;
          setTimeout(() => {
            this.submitMessage = '';
          }, 3000);
        },
        error: (error) => {
          console.error('Error updating user profile:', error);
          this.submitMessage = 'Failed to update profile. Please try again.';
          this.submitSuccess = false;
        }
      });
    }
  }
}