import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "palette",
    name: "Palette",
    description: "+2 hand size",
    cost: 10,
    requires: "paint_brush",
    effect: {
      kind: "extra_hand_size",
      n: 2
    }
  };

export default def;
