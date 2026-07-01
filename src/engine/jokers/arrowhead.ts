import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "arrowhead",
    name: "Arrowhead",
    description: "+50 Chips per ♠ scored",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "per_suit_chips",
      suit: "spades",
      chips: 50
    }
  };

export default def;
