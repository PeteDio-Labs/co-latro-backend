import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "jolly_joker",
    name: "Jolly Joker",
    description: "+8 Mult if hand has a Pair",
    cost: 3,
    rarity: "common",
    effect: {
      kind: "contains_mult",
      feature: "pair",
      mult: 8
    }
  };

export default def;
