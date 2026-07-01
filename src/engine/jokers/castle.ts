import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "castle",
    name: "Castle",
    description: "+3 Chips per blind cleared",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "scaling_per_blind_chips",
      chips: 3
    }
  };

export default def;
