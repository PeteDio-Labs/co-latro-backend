import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "ruby_chips",
    name: "Ruby Chips",
    description: "+30 Chips per heart scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_chips",
      suit: "hearts",
      chips: 30
    }
};

export default def;
