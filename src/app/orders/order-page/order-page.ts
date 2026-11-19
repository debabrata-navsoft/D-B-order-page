import { Component, OnInit, AfterViewInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Order } from '../models/order.model';
import { OrderService } from '../services/order.service';

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './order-page.html',
  styleUrl: './order-page.css'
})
export class OrderPage implements OnInit, AfterViewInit {
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  // Columns shown in the table (same names as matColumnDef in the HTML)
  displayedColumns = [
    'orderNumber',
    'customer',
    'email',
    'date',
    'items',
    'total',
    'status',
    'paymentStatus',
    'actions'
  ];

  // Table data (MatTableDataSource handles paging and sorting for us)
  dataSource = new MatTableDataSource<Order>([]);

  allOrders: Order[] = []; // every order from the server
  isLoading = signal(true);

  // Search + status filter
  searchQuery = signal('');
  selectedStatus = signal('ALL');
  isStatusOpen = signal(false);

  statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'Packing', label: 'Packing' },
    { value: 'Processing', label: 'Processing' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadOrders();
  }

  ngAfterViewInit(): void {
    // Connect the paginator and sort header to the table
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadOrders(): void {
    this.isLoading.set(true);

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.allOrders = orders;
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  // ---------- Search + filter ----------
  // Build the list of orders that match the search text and status
  applyFilters(): void {
    const search = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();
    const result: Order[] = [];

    for (const order of this.allOrders) {
      const city = order.shippingAddress?.city || order.cityStateZip || '';

      const matchesSearch =
        search === '' ||
        order.orderNumber.toLowerCase().includes(search) ||
        order.customerName.toLowerCase().includes(search) ||
        order.customerEmail.toLowerCase().includes(search) ||
        city.toLowerCase().includes(search);

      const matchesStatus = status === 'ALL' || order.status === status;

      if (matchesSearch && matchesStatus) {
        result.push(order);
      }
    }

    this.dataSource.data = result;

    // Go back to page 1 after filtering
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.applyFilters();
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value);
    this.applyFilters();
  }

  // ---------- Status dropdown ----------
  toggleStatusDropdown(): void {
    this.isStatusOpen.set(!this.isStatusOpen());
  }

  closeStatusDropdown(): void {
    this.isStatusOpen.set(false);
  }

  selectStatus(value: string): void {
    this.closeStatusDropdown();
    this.onStatusChange(value);
  }

  // Text shown in the dropdown box, e.g. 'All Statuses'
  selectedStatusLabel(): string {
    for (const option of this.statusOptions) {
      if (option.value === this.selectedStatus()) {
        return option.label;
      }
    }
    return 'All Statuses';
  }

  // ---------- Navigation ----------
  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/orders', orderId]);
  }

  // ---------- Badge colors ----------
  // 'Shipped' -> 'status-shipped'
  getStatusClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  // 'Paid' -> 'payment-paid'
  getPaymentClass(status: string): string {
    return 'payment-' + status.toLowerCase();
  }
}
