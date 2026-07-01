import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "wasteful",
    name: "Wasteful",
    description: "+1 discard per blind",
    cost: 10,
    effect: {
      kind: "extra_discard",
      n: 1
    }
  };

export default def;
