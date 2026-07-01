import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "droll_joker",
    name: "Droll Joker",
    description: "+10 Mult if hand has a Flush",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_mult",
      feature: "flush",
      mult: 10
    }
  };

export default def;
