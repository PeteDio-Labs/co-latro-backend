import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "palette",
    name: "Palette",
    description: "+2 hand size",
    amount: 2,
    effect: {
      kind: "extra_hand_size",
      amt: 2
    },
    requires: "paint_brush"
};

export default def;
