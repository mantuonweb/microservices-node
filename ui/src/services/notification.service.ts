import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { BehaviorSubject, Observable, Subject, catchError, takeUntil, throwError } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';

// In the class definition, update the type

export interface NotificationEvent {
    id: string;
    type: string;
    data: any;
    timestamp: Date;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService implements OnDestroy {
    private readonly MAX_EVENTS = 100;
    private readonly RECONNECT_DELAY = 5000;

    private eventSource: EventSource | EventSourcePolyfill | null = null;
    private eventsSubject = new BehaviorSubject<NotificationEvent[]>([]);
    private events: NotificationEvent[] = [];
    private isConnected = false;
    private connectionStatus = new BehaviorSubject<boolean>(false);
    private destroy$ = new Subject<void>();
    private reconnectTimer: any;

    private readonly apiUrl = `${environment.apiUrl}/notifications`;

    constructor(private http: HttpClient, private authService: AuthService) {
    }

    /**
     * Initialize the SSE connection
     * @param endpoint The SSE endpoint to connect to
     * @returns Observable of connection status
     */
    init(endpoint: string = '/init'): Observable<boolean> {
        // Clear any existing reconnect timer
        this.clearReconnectTimer();

        if (this.isConnected) {
            console.log('SSE connection already established');
            return this.connectionStatus.asObservable();
        }

        this.http.post(`${this.apiUrl}${endpoint}`, {})
            .pipe(
                catchError(error => {
                    console.error('Failed to initialize SSE connection:', error);
                    this.scheduleReconnect(endpoint);
                    return throwError(() => error);
                }),
                takeUntil(this.destroy$)
            )
            .subscribe(() => this.establishEventSource(endpoint));

        return this.connectionStatus.asObservable();
    }

    /**
     * Get the list of received events
     * @returns Observable of notification events
     */
    list(): Observable<NotificationEvent[]> {
        return this.eventsSubject.asObservable();
    }

    /**
     * Get the current connection status
     * @returns Observable of connection status
     */
    connectionState(): Observable<boolean> {
        return this.connectionStatus.asObservable();
    }

    /**
     * Close the SSE connection
     */
    disconnect(): void {
        this.clearReconnectTimer();

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.isConnected = false;
            this.connectionStatus.next(false);
        }
    }

    /**
     * Clear all stored events
     */
    clearEvents(): void {
        this.events = [];
        this.eventsSubject.next([]);
    }

    /**
     * Clean up resources when service is destroyed
     */
    ngOnDestroy(): void {
        this.clearReconnectTimer();
        this.disconnect();
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Establish the EventSource connection
     */
    private establishEventSource(endpoint: string): void {
        try {
            // Get auth token from wherever it's stored in your application
            const authToken = this.authService.getToken(); // or from your auth service

            const url = `${this.apiUrl}/events?events=order.created,order.updated`;

            const options = {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            };

            this.eventSource = new EventSourcePolyfill(url, options);

            this.eventSource.onopen = () => {
                this.isConnected = true;
                this.connectionStatus.next(true);
                this.clearReconnectTimer();
            };

            this.eventSource.onerror = (error: any) => {
                this.handleConnectionError(endpoint);
            };

            this.eventSource.onmessage = this.handleEventMessage.bind(this);
        } catch (error) {
            console.error('Error creating EventSource:', error);
            this.handleConnectionError(endpoint);
        }

    }    
    /**
     * Handle incoming SSE messages
     */
    private handleEventMessage(event: MessageEvent): void {
        try {
            const data = JSON.parse(event.data);
            if (!(data.event == 'order.created' || data.event == 'order.updated')) {
                return;
            }
            const notification: NotificationEvent = {
                id: data.id || crypto.randomUUID(),
                type: data.event || 'info',
                data: data,
                timestamp: new Date()
            };

            // Add to beginning of array (newest first)
            this.events.unshift(notification);

            // Keep only the latest MAX_EVENTS
            if (this.events.length > this.MAX_EVENTS) {
                this.events = this.events.slice(0, this.MAX_EVENTS);
            }

            this.eventsSubject.next([...this.events]);
        } catch (error) {
            console.error('Error parsing SSE event:', error);
        }
    }

    /**
     * Handle connection errors and schedule reconnection
     */
    private handleConnectionError(endpoint: string): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.isConnected = false;
        this.connectionStatus.next(false);
        this.scheduleReconnect(endpoint);
    }

    /**
     * Schedule a reconnection attempt
     */
    private scheduleReconnect(endpoint: string): void {
        this.clearReconnectTimer();

        this.reconnectTimer = setTimeout(() => {
            if (!this.isConnected) {
                console.log('Attempting to reconnect to SSE...');
                this.init(endpoint);
            }
        }, this.RECONNECT_DELAY);
    }

    /**
     * Clear any pending reconnection timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    clear() {
        this.events = [];
        this.eventsSubject.next([]);
    }
}