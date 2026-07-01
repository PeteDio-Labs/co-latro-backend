import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "money_tree",
    name: "Money Tree",
    description: "Interest cap raised by $10",
    cost: 10,
    effect: {
      kind: "interest_cap_increase",
      extra: 10
    },
    requires: "seed_money"
  };

export default def;
