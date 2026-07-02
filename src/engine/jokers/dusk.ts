import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
  id: "dusk",
  name: "Dusk",
  description: "Retrigger all played cards on the final hand of the round",
  cost: 5,
  rarity: "uncommon",
  effect: {
    kind: "retrigger_final_hand",
  },
};

export default def;
