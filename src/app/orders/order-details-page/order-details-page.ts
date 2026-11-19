import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BoxDimensions, Order, OrderItem } from '../models/order.model';
import { OrderService } from '../services/order.service';

@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './order-details-page.html',
  styleUrl: './order-details-page.css'
})
export class OrderDetailsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);

  // ---------- Page data ----------
  order = signal<Order | null>(null);
  orderIds = signal<string[]>([]); // all order ids, used by < and > buttons
  isLoading = signal(true);
  errorMessage = signal('');
  isSaving = signal(false);
  toastMessage = signal('');

  // ---------- Select Box dropdown ----------
  boxOptions = [
    'Custom Box',
    'Poly Bag - Small',
    'Poly Bag - Extra Large',
    'Poly Bag - Large',
    'Poly Bag - Medium',
    'Large Feed Box'
  ];
  selectedBox = signal('Custom Box');
  isBoxDropdownOpen = signal(false);

  // ---------- Box dimension inputs ----------
  boxLength = signal<number | null>(null);
  boxWidth = signal<number | null>(null);
  boxHeight = signal<number | null>(null);
  boxWeight = signal<number | null>(null);

  // true after the user leaves a field (so we can show its error)
  lengthTouched = signal(false);
  widthTouched = signal(false);
  heightTouched = signal(false);
  weightTouched = signal(false);

  // true after the user clicks SHIP (show all errors)
  submitted = signal(false);

  ngOnInit(): void {
    // Load all order ids for the Previous / Next buttons
    this.orderService.getOrders().subscribe((orders) => {
      const ids: string[] = [];
      for (const o of orders) {
        ids.push(o.id);
      }
      this.orderIds.set(ids);
    });

    // Load the order whose id is in the URL (runs again when the id changes)
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
        // Qty Shipping always starts empty
        for (const item of order.items) {
          item.qtyShipping = undefined;
        }
        this.order.set(order);

        // Select Box value
        const box = order.selectedBox ? order.selectedBox : 'Custom Box';
        this.selectedBox.set(box);

        // Custom Box starts with empty fields, other boxes use the saved size
        if (box !== 'Custom Box' && order.boxDimensions) {
          this.setDimensions(
            order.boxDimensions.length,
            order.boxDimensions.width,
            order.boxDimensions.height,
            order.boxDimensions.weight
          );
        } else {
          this.setDimensions(null, null, null, null);
        }

        this.resetErrors();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load order.');
        this.isLoading.set(false);
      }
    });
  }

  // ---------- Status pill color ----------
  // 'Shipped' -> 'status-shipped'
  statusClass(status: string): string {
    if (!status) {
      return '';
    }
    return 'status-' + status.toLowerCase();
  }

  // ---------- Select Box dropdown ----------
  toggleBoxDropdown(): void {
    this.isBoxDropdownOpen.set(!this.isBoxDropdownOpen());
  }

  closeBoxDropdown(): void {
    this.isBoxDropdownOpen.set(false);
  }

  selectBoxOption(option: string): void {
    this.selectedBox.set(option);
    this.closeBoxDropdown();

    // Fill the size for standard boxes, clear it for Custom Box
    if (option === 'Poly Bag - Small') {
      this.setDimensions(10, 8, 2, 1.5);
    } else if (option === 'Poly Bag - Medium') {
      this.setDimensions(12, 10, 3, 2.5);
    } else if (option === 'Poly Bag - Large') {
      this.setDimensions(15, 12, 4, 4);
    } else if (option === 'Poly Bag - Extra Large') {
      this.setDimensions(20, 16, 5, 6);
    } else if (option === 'Large Feed Box') {
      this.setDimensions(36, 24, 18, 50);
    } else {
      // Custom Box
      this.setDimensions(null, null, null, null);
      this.resetErrors();
    }
  }

  setDimensions(
    length: number | null,
    width: number | null,
    height: number | null,
    weight: number | null
  ): void {
    this.boxLength.set(length);
    this.boxWidth.set(width);
    this.boxHeight.set(height);
    this.boxWeight.set(weight);
  }

  resetErrors(): void {
    this.lengthTouched.set(false);
    this.widthTouched.set(false);
    this.heightTouched.set(false);
    this.weightTouched.set(false);
    this.submitted.set(false);
  }

  // ---------- Validation ----------
  // A dimension is invalid when it is empty or not greater than 0
  isInvalid(value: number | null): boolean {
    return value === null || value <= 0;
  }

  // Show the error only after the user left the field or clicked SHIP
  showError(value: number | null, touched: boolean): boolean {
    return (touched || this.submitted()) && this.isInvalid(value);
  }

  hasDimErrors(): boolean {
    return (
      this.isInvalid(this.boxLength()) ||
      this.isInvalid(this.boxWidth()) ||
      this.isInvalid(this.boxHeight()) ||
      this.isInvalid(this.boxWeight())
    );
  }

  showValidationErrors(): boolean {
    return this.submitted() && this.hasDimErrors();
  }

  // ---------- Items table ----------
  toggleItemSelection(item: OrderItem): void {
    if (item.selected === false) {
      item.selected = true;
    } else {
      item.selected = false;
    }
  }

  qtyPicked(item: OrderItem): number {
    return item.qtyPicked ?? 0;
  }

  qtyShipped(item: OrderItem): number {
    return item.qtyShipped ?? 0;
  }

  // Max that can still ship = picked - already shipped
  maxQtyShipping(item: OrderItem): number {
    const max = this.qtyPicked(item) - this.qtyShipped(item);
    if (max < 0) {
      return 0;
    }
    return max;
  }

  // Save what the user typed in Qty Shipping (never more than the max)
  setQtyShipping(item: OrderItem, input: HTMLInputElement): void {
    if (input.value === '') {
      item.qtyShipping = undefined;
      return;
    }

    let value = Number(input.value);
    const max = this.maxQtyShipping(item);
    if (value > max) {
      value = max;
      input.value = String(max); // show the max in the box
    }
    item.qtyShipping = value;
  }

  isQtyShippingValid(item: OrderItem): boolean {
    const qty = item.qtyShipping;
    if (qty === undefined) {
      return false;
    }
    return Number.isInteger(qty) && qty > 0 && qty <= this.maxQtyShipping(item);
  }

  // SHIP is enabled when:
  // 1. all 4 box dimensions are filled, and
  // 2. at least one ticked item has a Qty Shipping, and every filled one is valid
  canShip(): boolean {
    if (this.hasDimErrors()) {
      return false;
    }

    const order = this.order();
    if (!order) {
      return false;
    }

    let filledCount = 0;
    for (const item of order.items) {
      if (item.selected !== false && item.qtyShipping !== undefined) {
        if (!this.isQtyShippingValid(item)) {
          return false;
        }
        filledCount++;
      }
    }
    return filledCount > 0;
  }

  // ---------- SHIP button ----------
  onShip(): void {
    this.submitted.set(true);

    const order = this.order();
    if (!order || this.isSaving() || !this.canShip()) {
      return;
    }

    // Add Qty Shipping to Qty Shipped for each ticked item
    let totalShipped = 0;
    const newItems: OrderItem[] = [];

    for (const item of order.items) {
      const newItem: OrderItem = { ...item };

      if (item.selected !== false && item.qtyShipping) {
        newItem.qtyShipped = this.qtyShipped(item) + item.qtyShipping;
        totalShipped = totalShipped + item.qtyShipping;
      }

      delete newItem.qtyShipping; // only used on the screen, not saved
      newItems.push(newItem);
    }

    const boxDimensions: BoxDimensions = {
      length: this.boxLength(),
      width: this.boxWidth(),
      height: this.boxHeight(),
      weight: this.boxWeight()
    };

    const dataToSave = {
      items: newItems,
      selectedBox: this.selectedBox(),
      boxDimensions: boxDimensions
    };

    // Save to json-server
    this.isSaving.set(true);
    this.orderService.updateOrder(order.id, dataToSave).subscribe({
      next: (savedOrder) => {
        this.order.set(savedOrder);
        this.isSaving.set(false);
        this.showToast('Shipped ' + totalShipped + ' item(s) successfully!');
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

  // ---------- Previous / Next / Back ----------
  // Position of this order in the list (-1 if not found yet)
  currentIndex(): number {
    const order = this.order();
    if (!order) {
      return -1;
    }
    return this.orderIds().indexOf(order.id);
  }

  hasPrev(): boolean {
    return this.currentIndex() > 0;
  }

  hasNext(): boolean {
    const index = this.currentIndex();
    return index !== -1 && index < this.orderIds().length - 1;
  }

  prevOrder(): void {
    if (this.hasPrev()) {
      const prevId = this.orderIds()[this.currentIndex() - 1];
      this.router.navigate(['/orders', prevId]);
    }
  }

  nextOrder(): void {
    if (this.hasNext()) {
      const nextId = this.orderIds()[this.currentIndex() + 1];
      this.router.navigate(['/orders', nextId]);
    }
  }

  backToOrders(): void {
    this.router.navigate(['/orders']);
  }

  // ---------- Toast message ----------
  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3000);
  }
}
