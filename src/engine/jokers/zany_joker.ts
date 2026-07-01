import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "zany_joker",
    name: "Zany Joker",
    description: "+12 Mult if hand has Three of a Kind",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_mult",
      feature: "three_of_a_kind",
      mult: 12
    }
  };

export default def;
