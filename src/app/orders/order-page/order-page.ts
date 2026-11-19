import {
  AfterViewInit,
  Component,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Order } from '../models/order.model';
import { OrderService } from '../services/order.service';

const ALL = 'ALL';

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [
    CommonModule,
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

  readonly displayedColumns = [
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

  readonly dataSource = new MatTableDataSource<Order>([]);
  readonly isLoading = signal(true);
  private allOrders: Order[] = [];

  // ---------- Search + status filter ----------
  readonly searchQuery = signal('');
  readonly selectedStatus = signal(ALL);
  readonly isStatusOpen = signal(false);

  readonly statusOptions = [
    { value: ALL, label: 'All Statuses' },
    { value: 'Packing', label: 'Packing' },
    { value: 'Processing', label: 'Processing' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  readonly selectedStatusLabel = computed(
    () => this.statusOptions.find((o) => o.value === this.selectedStatus())?.label ?? 'All Statuses'
  );

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadOrders();
  }

  ngAfterViewInit(): void {
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
      error: () => this.isLoading.set(false)
    });
  }

  /** Show only the orders that match the search text and the status. */
  private applyFilters(): void {
    const search = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();

    this.dataSource.data = this.allOrders.filter((order) => {
      const matchesStatus = status === ALL || order.status === status;
      const searchText = [
        order.orderNumber,
        order.customerName,
        order.customerEmail,
        order.shippingAddress?.city,
        order.cityStateZip
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && searchText.includes(search);
    });

    this.paginator?.firstPage(); // back to page 1 after filtering
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.applyFilters();
  }

  clearSearch(): void {
    this.onSearchChange('');
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value);
    this.applyFilters();
  }

  // ---------- Status dropdown ----------
  toggleStatusDropdown(): void {
    this.isStatusOpen.update((open) => !open);
  }

  selectStatus(value: string): void {
    this.isStatusOpen.set(false);
    this.onStatusChange(value);
  }

  /** Close the dropdown on a click outside it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isStatusOpen() && !(event.target as HTMLElement).closest('.status-dropdown')) {
      this.isStatusOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isStatusOpen.set(false);
  }

  // ---------- Row actions ----------
  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/orders', orderId]);
  }

  // ---------- Badge colors ('Shipped' -> 'status-shipped', 'Paid' -> 'payment-paid') ----------
  getStatusClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  getPaymentClass(status: string): string {
    return 'payment-' + status.toLowerCase();
  }
}
