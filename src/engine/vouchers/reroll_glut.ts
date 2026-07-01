import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "reroll_glut",
    name: "Reroll Glut",
    description: "Rerolls cost $3 less (stacks with Reroll Surplus)",
    cost: 10,
    effect: {
      kind: "reroll_discount",
      amt: 3
    },
    requires: "reroll_surplus"
  };

export default def;
