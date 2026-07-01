import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "wily_joker",
    name: "Wily Joker",
    description: "+100 Chips if hand has Three of a Kind",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_chips",
      feature: "three_of_a_kind",
      chips: 100
    }
  };

export default def;
