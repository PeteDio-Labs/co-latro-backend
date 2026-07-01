import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "crystal_ball",
    name: "Crystal Ball",
    description: "+1 consumable slot",
    cost: 10,
    effect: {
      kind: "extra_consumable_slot"
    }
  };

export default def;
