import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "reroll_surplus",
    name: "Reroll Surplus",
    description: "Rerolls cost $2 less",
    cost: 10,
    effect: {
      kind: "reroll_discount",
      amt: 2
    }
  };

export default def;
