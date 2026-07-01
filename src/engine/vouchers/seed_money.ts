import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "seed_money",
    name: "Seed Money",
    description: "Interest cap raised by $5",
    cost: 10,
    effect: {
      kind: "interest_cap_increase",
      extra: 5
    }
  };

export default def;
