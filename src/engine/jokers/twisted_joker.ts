import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "twisted_joker",
    name: "Twisted Joker",
    description: "+5 Mult",
    cost: 3,
    rarity: "common",
    effect: {
      kind: "flat_mult",
      mult: 5
    }
  };

export default def;
