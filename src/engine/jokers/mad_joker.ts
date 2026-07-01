import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "mad_joker",
    name: "Mad Joker",
    description: "+10 Mult if hand has Two Pair",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_mult",
      feature: "two_pair",
      mult: 10
    }
  };

export default def;
