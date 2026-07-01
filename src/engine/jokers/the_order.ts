import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "the_order",
    name: "The Order",
    description: "×3 Mult if hand has a Straight",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "x_mult_contains",
      feature: "straight",
      xMult: 3
    }
  };

export default def;
