import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "liquidation",
    name: "Liquidation",
    description: "All shop items 50% off",
    cost: 10,
    effect: {
      kind: "shop_discount_pct",
      pct: 50
    },
    requires: "clearance_sale"
  };

export default def;
