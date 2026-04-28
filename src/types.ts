/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = 'Pending' | 'Processing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  latitude?: number;
  longitude?: number;
  orderDetails: string;
  deliveryCharge: number;
  timestamp: number;
  userId: string;
  status: OrderStatus;
  restaurantId?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  latitude?: number;
  longitude?: number;
  userId: string;
  timestamp: number;
}

export interface DailySummary {
  date: string;
  count: number;
  totalCharge: number;
}
