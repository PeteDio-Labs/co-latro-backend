import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "half_joker",
    name: "Half Joker",
    description: "+20 Mult if 3 or fewer cards played",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "hand_size_mult",
      maxCards: 3,
      mult: 20
    }
  };

export default def;
