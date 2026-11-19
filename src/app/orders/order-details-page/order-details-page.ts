import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Order, OrderItem } from '../models/order.model';
import { OrderService } from '../services/order.service';

type DimKey = 'length' | 'width' | 'height' | 'weight';

interface DimensionField {
  key: DimKey;
  label: string;
  placeholder: string;
  error: string;
}

const emptyDims = (): Record<DimKey, number | null> => ({
  length: null,
  width: null,
  height: null,
  weight: null
});

const untouchedDims = (): Record<DimKey, boolean> => ({
  length: false,
  width: false,
  height: false,
  weight: false
});

const BOX_PRESETS: Record<string, Record<DimKey, number>> = {
  'Poly Bag - Small': { length: 10, width: 8, height: 2, weight: 1.5 },
  'Poly Bag - Large': { length: 15, width: 12, height: 4, weight: 4 },
  'Large Feed Box': { length: 36, width: 24, height: 18, weight: 50 }
};

@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './order-details-page.html',
  styleUrl: './order-details-page.css'
})
export class OrderDetailsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);

  readonly order = signal<Order | undefined>(undefined);
  readonly allOrderIds = signal<string[]>([]);
  readonly currentOrderIndex = signal<number>(0);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string>('');

  // Box Selection & Dimensions
  readonly boxOptions: string[] = [
    'Custom Box',
    'Poly Bag - Small',
    'Poly Bag - Extra Large',
    'Poly Bag - Large',
    'Poly Bag - Medium',
    'Large Feed Box'
  ];
  readonly selectedBox = signal<string>('Custom Box');
  readonly isBoxDropdownOpen = signal<boolean>(false);

  // Box dimension fields (all mandatory, must be > 0)
  readonly dimensionFields: DimensionField[] = [
    { key: 'length', label: 'Length (in)', placeholder: 'Enter length', error: 'Length must be greater than 0' },
    { key: 'width', label: 'Width (in)', placeholder: 'Enter width', error: 'Width must be greater than 0' },
    { key: 'height', label: 'Height (in)', placeholder: 'Enter height', error: 'Height must be greater than 0' },
    { key: 'weight', label: 'Weight (lbs)', placeholder: 'Enter weight', error: 'Weight must be greater than 0' }
  ];

  readonly dims = signal<Record<DimKey, number | null>>(emptyDims());
  readonly touched = signal<Record<DimKey, boolean>>(untouchedDims());

  // Set after a SHIP attempt so every invalid field shows its error
  readonly submitted = signal<boolean>(false);

  readonly hasDimErrors = computed(() =>
    this.dimensionFields.some((f) => this.isDimInvalid(f.key))
  );

  // True when errors are visible and shipping actions should look disabled
  readonly showValidationErrors = computed(() => this.submitted() && this.hasDimErrors());

  // Active Toast / Feedback
  readonly toastMessage = signal<string>('');

  ngOnInit(): void {
    // Load all orders list to support Prev / Next navigation
    this.orderService.getOrders().subscribe({
      next: (orders) => {
        const ids = orders.map((o) => o.id || o.orderNumber);
        this.allOrderIds.set(ids);
      }
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadOrder(id);
      }
    });
  }

  loadOrder(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        if (order) {
          // Qty Shipping starts empty — the user enters it
          order.items?.forEach((item) => (item.qtyShipping = undefined));
          this.order.set(order);
          const box = order.selectedBox || 'Custom Box';
          this.selectedBox.set(box);
          this.touched.set(untouchedDims());

          // Custom Box starts empty — the user must enter dimensions
          if (box !== 'Custom Box' && order.boxDimensions) {
            this.dims.set({ ...order.boxDimensions });
          } else {
            this.dims.set(emptyDims());
          }

          // Fresh load: no errors until the user leaves a field or clicks SHIP
          this.submitted.set(false);

          // Update index for pagination
          const ids = this.allOrderIds();
          const idx = ids.findIndex((item) => item === order.id || item === order.orderNumber);
          if (idx !== -1) {
            this.currentOrderIndex.set(idx);
          }
        } else {
          this.errorMessage.set(`Order #${id} not found.`);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load order.');
        this.isLoading.set(false);
      }
    });
  }

  toggleBoxDropdown(): void {
    this.isBoxDropdownOpen.update((v) => !v);
  }

  /** Close the box dropdown when clicking anywhere outside it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isBoxDropdownOpen()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.box-select-container')) {
      this.isBoxDropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isBoxDropdownOpen.set(false);
  }

  selectBoxOption(option: string): void {
    this.selectedBox.set(option);
    this.isBoxDropdownOpen.set(false);

    // Custom Box: clear the fields so the user enters their own values
    if (option === 'Custom Box') {
      this.dims.set(emptyDims());
      this.touched.set(untouchedDims());
      this.submitted.set(false);
      return;
    }

    // Auto set dimensions based on standard packaging
    const preset = BOX_PRESETS[option];
    if (preset) {
      this.dims.set({ ...preset });
    }
  }

  setDim(key: DimKey, value: number | null): void {
    this.dims.update((d) => ({ ...d, [key]: value }));
  }
  markTouched(key: DimKey): void {
    this.touched.update((t) => ({ ...t, [key]: true }));
  }

  isDimInvalid(key: DimKey): boolean {
    const v = this.dims()[key];
    return v === null || v === undefined || !(Number(v) > 0);
  }

  showDimError(key: DimKey): boolean {
    return (this.touched()[key] || this.submitted()) && this.isDimInvalid(key);
  }

  toggleItemSelection(item: OrderItem): void {
    item.selected = item.selected === false;
  }

  setQtyShipping(item: OrderItem, raw: string): void {
    item.qtyShipping = raw === '' ? undefined : Number(raw);
  }

  qtyPicked(item: OrderItem): number {
    return item.qtyPicked || item.quantity || 5;
  }

  qtyShipped(item: OrderItem): number {
    return item.qtyShipped || 0;
  }

  /** Max that can still ship = picked − already shipped. */
  maxQtyShipping(item: OrderItem): number {
    return Math.max(this.qtyPicked(item) - this.qtyShipped(item), 0);
  }

  isQtyShippingOver(item: OrderItem): boolean {
    return item.qtyShipping !== undefined && item.qtyShipping > this.maxQtyShipping(item);
  }

  private isQtyShippingValid(item: OrderItem): boolean {
    const q = item.qtyShipping;
    return q !== undefined && Number.isInteger(q) && q > 0 && q <= this.maxQtyShipping(item);
  }

  /** SHIP is enabled only when all box dimensions and qty shipping are filled. */
  canShip(): boolean {
    if (this.hasDimErrors()) {
      return false;
    }
    const selected = (this.order()?.items ?? []).filter((i) => i.selected !== false);
    return selected.length > 0 && selected.every((i) => this.isQtyShippingValid(i));
  }

  onShip(): void {
    this.submitted.set(true);
    if (this.hasDimErrors()) {
      this.showToast('Please correct box dimensions before shipping.');
      return;
    }
    if (!this.canShip()) {
      this.showToast('Please enter a valid Qty Shipping for the selected items.');
      return;
    }

    // Add shipped quantity to Qty Shipped, then clear the input
    let total = 0;
    for (const item of this.order()?.items ?? []) {
      if (item.selected !== false && item.qtyShipping) {
        item.qtyShipped = this.qtyShipped(item) + item.qtyShipping;
        total += item.qtyShipping;
        item.qtyShipping = undefined;
      }
    }
    this.order.update((o) => (o ? { ...o, items: [...o.items] } : o));

    this.showToast(`Shipped ${total} item${total === 1 ? '' : 's'} successfully!`);
  }

  onPackingSlip(): void {
    this.showToast('Generating Packing Slip...');
    window.print();
  }

  onVoidShipping(): void {
    this.showToast('Voiding shipping label...');
  }

  onReprintLabel(): void {
    this.showToast('Reprinting shipping label...');
  }

  onVoidOrder(): void {
    if (confirm('Are you sure you want to void this order?')) {
      this.showToast('Order voided.');
    }
  }

  onRefundOrder(): void {
    if (confirm('Initiate refund for this order?')) {
      this.showToast('Refund processed.');
    }
  }

  prevOrder(): void {
    const ids = this.allOrderIds();
    const curr = this.currentOrderIndex();
    if (curr > 0) {
      this.router.navigate(['/orders', ids[curr - 1]]);
    }
  }

  nextOrder(): void {
    const ids = this.allOrderIds();
    const curr = this.currentOrderIndex();
    if (curr < ids.length - 1) {
      this.router.navigate(['/orders', ids[curr + 1]]);
    }
  }

  backToOrders(): void {
    this.router.navigate(['/orders']);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3000);
  }
}
