import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, OrderStatus } from '../models/order.model';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/orders';

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  updateOrderStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/${id}`, { status });
  }

  /** Partially update an order (e.g. items after shipping) in the JSON DB. */
  updateOrder(id: string, changes: Partial<Order>): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/${id}`, changes);
  }

  deleteOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
