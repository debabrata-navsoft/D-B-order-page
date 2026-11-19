import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, OrderStatus } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly http = inject(HttpClient);

  // json-server URL (backend/db.json)
  private readonly apiUrl = 'http://localhost:3000/orders';

  // Get all orders
  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  // Get one order by its id
  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(this.apiUrl + '/' + id);
  }

  // Update some fields of an order (PATCH only changes the fields we send)
  updateOrder(id: string, data: Partial<Order>): Observable<Order> {
    return this.http.patch<Order>(this.apiUrl + '/' + id, data);
  }

  // Change only the status of an order
  updateOrderStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(this.apiUrl + '/' + id, { status: status });
  }

  // Delete an order
  deleteOrder(id: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl + '/' + id);
  }
}
