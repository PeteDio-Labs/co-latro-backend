import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
  id: "hack",
  name: "Hack",
  description: "Retrigger each played 2, 3, 4, and 5",
  cost: 6,
  rarity: "uncommon",
  effect: {
    kind: "retrigger_rank",
    ranks: [2, 3, 4, 5],
  },
};

export default def;
