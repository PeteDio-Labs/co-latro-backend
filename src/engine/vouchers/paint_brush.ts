import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "paint_brush",
    name: "Paint Brush",
    description: "+1 hand size",
    amount: 1,
    effect: {
      kind: "extra_hand_size",
      n: 1
    }
};

export default def;
