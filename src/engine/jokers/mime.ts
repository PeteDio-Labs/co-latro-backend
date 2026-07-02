import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
  id: "mime",
  name: "Mime",
  description: "Retrigger all card held in hand abilities",
  cost: 5,
  rarity: "uncommon",
  effect: {
    kind: "retrigger_held",
  },
};

export default def;
