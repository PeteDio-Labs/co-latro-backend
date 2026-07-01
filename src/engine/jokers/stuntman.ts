import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "stuntman",
    name: "Stuntman",
    description: "+250 Chips",
    cost: 7,
    rarity: "rare",
    effect: {
      kind: "flat_chips",
      chips: 250
    }
  };

export default def;
