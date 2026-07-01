import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "crafty_joker",
    name: "Crafty Joker",
    description: "+80 Chips if hand has a Flush",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_chips",
      feature: "flush",
      chips: 80
    }
  };

export default def;
