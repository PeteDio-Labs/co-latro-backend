import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "nacho_tong",
    name: "Nacho Tong",
    description: "+1 hand per round",
    cost: 20,
    effect: {
      kind: "extra_hand"
    },
    requires: "grabber"
};

export default def;
