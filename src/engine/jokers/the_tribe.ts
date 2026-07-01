import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "the_tribe",
    name: "The Tribe",
    description: "×2 Mult if hand has a Flush",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "x_mult_contains",
      feature: "flush",
      xMult: 2
    }
  };

export default def;
