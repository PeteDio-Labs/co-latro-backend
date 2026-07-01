import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "photograph",
    name: "Photograph",
    description: "+10 Mult if hand has a Flush",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "contains_mult",
      feature: "flush",
      mult: 10
    }
  };

export default def;
