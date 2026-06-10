export type CouponType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  loja_id: string;
  code: string;
  type: CouponType;
  value: number;
  min_order_value: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  description: string;
  active: boolean;
  created_at?: string;
}

export interface AppliedCoupon {
  coupon: Coupon;
  discount_amount: number;
}