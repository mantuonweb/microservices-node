import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { User } from '../components/models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private apiUrl = environment.apiUrl + '/customers';

    constructor(private http: HttpClient) { }

    getUserProfile(email: string): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}/email/${email}`);
    }

    updateUserProfile(user: any): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/${user._id}`, user);
    }
    createUserProfile(user: any): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}`, user);
    }
}