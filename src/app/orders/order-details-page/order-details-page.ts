import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BoxDimensions, Order, OrderItem } from '../models/order.model';
import { OrderService } from '../services/order.service';

type DimKey = keyof BoxDimensions;

const CUSTOM_BOX = 'Custom Box';

const EMPTY_DIMS: BoxDimensions = { length: null, width: null, height: null, weight: null };

/** Standard box sizes (Custom Box has none — the user types them). */
const BOX_PRESETS: Record<string, BoxDimensions> = {
  'Poly Bag - Small': { length: 10, width: 8, height: 2, weight: 1.5 },
  'Poly Bag - Medium': { length: 12, width: 10, height: 3, weight: 2.5 },
  'Poly Bag - Large': { length: 15, width: 12, height: 4, weight: 4 },
  'Poly Bag - Extra Large': { length: 20, width: 16, height: 5, weight: 6 },
  'Large Feed Box': { length: 36, width: 24, height: 18, weight: 50 }
};

/** Same value for all four dimension keys, e.g. all touched / untouched. */
const allDims = (value: boolean): Record<DimKey, boolean> => ({
  length: value,
  width: value,
  height: value,
  weight: value
});

@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './order-details-page.html',
  styleUrl: './order-details-page.css'
})
export class OrderDetailsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- Page state ----------
  readonly order = signal<Order | null>(null);
  readonly orderIds = signal<string[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly isSaving = signal(false);
  readonly toastMessage = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  // ---------- Previous / Next ----------
  readonly currentIndex = computed(() => {
    const o = this.order();
    return o ? this.orderIds().indexOf(o.id) : -1;
  });
  readonly hasPrev = computed(() => this.currentIndex() > 0);
  readonly hasNext = computed(() => {
    const i = this.currentIndex();
    return i !== -1 && i < this.orderIds().length - 1;
  });

  // ---------- Select Box + dimensions ----------
  readonly boxOptions = [CUSTOM_BOX, ...Object.keys(BOX_PRESETS)];
  readonly selectedBox = signal(CUSTOM_BOX);
  readonly isBoxDropdownOpen = signal(false);

  // Placeholder = "Enter <key>", error = "<Name> must be greater than 0"
  readonly dimensionFields: { key: DimKey; name: string; unit: string }[] = [
    { key: 'length', name: 'Length', unit: 'in' },
    { key: 'width', name: 'Width', unit: 'in' },
    { key: 'height', name: 'Height', unit: 'in' },
    { key: 'weight', name: 'Weight', unit: 'lbs' }
  ];

  readonly dims = signal<BoxDimensions>({ ...EMPTY_DIMS });
  readonly touched = signal(allDims(false));
  readonly submitted = signal(false); // true after a SHIP attempt

  readonly hasDimErrors = computed(() =>
    this.dimensionFields.some((f) => this.isDimInvalid(f.key))
  );
  readonly showValidationErrors = computed(() => this.submitted() && this.hasDimErrors());

  ngOnInit(): void {
    // All order ids, for the < and > buttons
    this.orderService.getOrders().subscribe((orders) => {
      this.orderIds.set(orders.map((o) => o.id));
    });

    // Reload whenever the :id in the URL changes (unsubscribes on destroy)
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
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
        this.order.set(this.resetItemState(order));
        this.applyBox(order.selectedBox || CUSTOM_BOX, order.boxDimensions);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load order.');
        this.isLoading.set(false);
      }
    });
  }

  /** Items start unticked with an empty Qty Shipping (both are screen-only). */
  private resetItemState(order: Order): Order {
    for (const item of order.items) {
      item.selected = false;
      item.qtyShipping = undefined;
    }
    return order;
  }

  // ---------- Status pill ----------
  statusClass(status: string): string {
    return 'status-' + status.toLowerCase();
  }

  // ---------- Select Box dropdown ----------
  toggleBoxDropdown(): void {
    this.isBoxDropdownOpen.update((open) => !open);
  }

  /** Close the dropdown on a click outside it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isBoxDropdownOpen() && !(event.target as HTMLElement).closest('.box-select-container')) {
      this.isBoxDropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isBoxDropdownOpen.set(false);
  }

  selectBoxOption(option: string): void {
    this.isBoxDropdownOpen.set(false);
    this.applyBox(option);
  }

  /**
   * Set the box and its dimensions.
   * - Standard box: use the saved size, or the preset size.
   * - Custom Box: empty fields with the red "required" errors shown.
   */
  private applyBox(box: string, saved?: BoxDimensions): void {
    this.selectedBox.set(box);
    this.submitted.set(false);

    const size = box === CUSTOM_BOX ? null : saved ?? BOX_PRESETS[box];
    this.dims.set(size ? { ...size } : { ...EMPTY_DIMS });
    this.touched.set(allDims(!size));
  }

  // ---------- Dimension inputs ----------
  setDim(key: DimKey, value: number | null): void {
    this.dims.update((d) => ({ ...d, [key]: value }));
  }

  markTouched(key: DimKey): void {
    this.touched.update((t) => ({ ...t, [key]: true }));
  }

  isDimInvalid(key: DimKey): boolean {
    const value = this.dims()[key];
    return value === null || !(value > 0);
  }

  showDimError(key: DimKey): boolean {
    return (this.touched()[key] || this.submitted()) && this.isDimInvalid(key);
  }

  // ---------- Items table ----------
  toggleItemSelection(item: OrderItem): void {
    item.selected = !item.selected;
    if (!item.selected) {
      item.qtyShipping = undefined; // unticked items don't ship
    }
  }

  qtyPicked(item: OrderItem): number {
    return item.qtyPicked ?? item.quantity ?? 0;
  }

  qtyShipped(item: OrderItem): number {
    return item.qtyShipped ?? 0;
  }

  /** Max that can still ship = picked − already shipped. */
  maxQtyShipping(item: OrderItem): number {
    return Math.max(this.qtyPicked(item) - this.qtyShipped(item), 0);
  }

  /** Store Qty Shipping, capped at the max. */
  setQtyShipping(item: OrderItem, input: HTMLInputElement): void {
    if (input.value === '') {
      item.qtyShipping = undefined;
      return;
    }
    const max = this.maxQtyShipping(item);
    const value = Math.min(Number(input.value), max);
    if (value === max) {
      input.value = String(max);
    }
    item.qtyShipping = value;
  }

  private isQtyShippingValid(item: OrderItem): boolean {
    const qty = item.qtyShipping ?? 0;
    return Number.isInteger(qty) && qty > 0 && qty <= this.maxQtyShipping(item);
  }

  /** Ticked items that have a Qty Shipping entered. */
  private itemsToShip(): OrderItem[] {
    return (this.order()?.items ?? []).filter(
      (item) => item.selected && item.qtyShipping !== undefined
    );
  }

  /** SHIP needs valid dimensions and at least one valid item quantity. */
  canShip(): boolean {
    const items = this.itemsToShip();
    return (
      !this.hasDimErrors() &&
      items.length > 0 &&
      items.every((item) => this.isQtyShippingValid(item))
    );
  }

  // ---------- SHIP ----------
  onShip(): void {
    const order = this.order();
    this.submitted.set(true);
    if (!order || this.isSaving() || !this.canShip()) {
      return;
    }

    const totalShipped = this.itemsToShip().reduce((sum, item) => sum + (item.qtyShipping ?? 0), 0);

    // Add Qty Shipping to Qty Shipped; don't store the screen-only fields
    const items = order.items.map(({ selected, qtyShipping, ...item }) => ({
      ...item,
      qtyShipped: this.qtyShipped(item) + (selected ? qtyShipping ?? 0 : 0)
    }));

    this.isSaving.set(true);
    this.orderService
      .updateOrder(order.id, { items, selectedBox: this.selectedBox(), boxDimensions: this.dims() })
      .subscribe({
        next: (saved) => {
          this.order.set(this.resetItemState(saved));
          this.isSaving.set(false);
          this.showToast(`Shipped ${totalShipped} item(s) successfully!`);
        },
        error: () => {
          this.isSaving.set(false);
          this.showToast('Failed to save shipment. Please try again.');
        }
      });
  }

  // ---------- Other buttons ----------
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

  // ---------- Navigation ----------
  prevOrder(): void {
    if (this.hasPrev()) {
      this.router.navigate(['/orders', this.orderIds()[this.currentIndex() - 1]]);
    }
  }

  nextOrder(): void {
    if (this.hasNext()) {
      this.router.navigate(['/orders', this.orderIds()[this.currentIndex() + 1]]);
    }
  }

  backToOrders(): void {
    this.router.navigate(['/orders']);
  }

  // ---------- Toast ----------
  showToast(message: string): void {
    clearTimeout(this.toastTimer); // a new message restarts the 3s timer
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3000);  }
}
