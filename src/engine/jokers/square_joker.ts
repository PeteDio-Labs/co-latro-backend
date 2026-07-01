import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "square_joker",
    name: "Square Joker",
    description: "+4 Chips per blind cleared",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "scaling_per_blind_chips",
      chips: 4
    }
  };

export default def;
