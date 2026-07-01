import type { VoucherDef } from "../vouchers.ts";

const def: VoucherDef = {
    id: "fortune_scale",
    name: "Fortune Scale",
    description: "Raises the max interest earned per round by $5",
    cost: 10,
    effect: {
      kind: "interest_cap_increase",
      extra: 5
    }
  };

export default def;
