import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "hieroglyph",
    name: "Hieroglyph",
    description: "+1 hand size",
    cost: 10,
    effect: {
      kind: "extra_hand_size",
      n: 1
    }
  };

export default def;
