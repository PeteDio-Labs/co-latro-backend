import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "grabber",
    name: "Grabber",
    description: "+1 hand per blind",
    cost: 10,
    effect: {
      kind: "extra_hand",
      n: 1
    }
  };

export default def;
