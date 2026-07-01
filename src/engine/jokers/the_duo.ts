import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "the_duo",
    name: "The Duo",
    description: "×2 Mult if hand has a Pair",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "x_mult_contains",
      feature: "pair",
      xMult: 2
    }
  };

export default def;
