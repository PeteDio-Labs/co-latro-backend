import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "antimatter",
    name: "Antimatter",
    description: "+1 joker slot",
    cost: 10,
    effect: {
      kind: "extra_joker_slot"
    }
  };

export default def;
