import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "odd_todd",
    name: "Odd Todd",
    description: "+31 Chips per odd card scored",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "per_parity_chips",
      parity: "odd",
      chips: 31
    }
  };

export default def;
