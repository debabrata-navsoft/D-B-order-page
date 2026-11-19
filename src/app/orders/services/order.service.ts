import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/orders';

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(this.orderUrl(id));
  }

  updateOrder(id: string, changes: Partial<Order>): Observable<Order> {
    return this.http.patch<Order>(this.orderUrl(id), changes);
  }

  private orderUrl(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}`;
  }
}
