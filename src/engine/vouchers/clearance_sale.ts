import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "clearance_sale",
    name: "Clearance Sale",
    description: "All shop items 25% off",
    cost: 10,
    effect: {
      kind: "shop_discount_pct",
      pct: 25
    }
  };

export default def;
