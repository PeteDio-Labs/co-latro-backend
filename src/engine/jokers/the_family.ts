import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "the_family",
    name: "The Family",
    description: "×4 Mult if played hand contains a Four of a Kind",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "x_mult_contains",
      feature: "four_of_a_kind",
      xMult: 4
    }
};

export default def;
