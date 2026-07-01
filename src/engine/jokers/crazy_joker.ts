import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "crazy_joker",
    name: "Crazy Joker",
    description: "+12 Mult if hand has a Straight",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_mult",
      feature: "straight",
      mult: 12
    }
  };

export default def;
