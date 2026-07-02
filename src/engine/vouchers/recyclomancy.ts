import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "recyclomancy",
    name: "Recyclomancy",
    description: "+1 discard per round",
    cost: 10,
    effect: {
      kind: "extra_discard",
      n: 1
    },
    requires: "wasteful"
};

export default def;
