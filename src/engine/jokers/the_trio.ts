import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "the_trio",
    name: "The Trio",
    description: "×3 Mult if hand has Three of a Kind",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "x_mult_contains",
      feature: "three_of_a_kind",
      xMult: 3
    }
  };

export default def;
