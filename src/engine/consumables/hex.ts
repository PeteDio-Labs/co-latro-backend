import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "hex",
    name: "Hex",
    description: "Add Polychrome edition to a random Joker; destroy all other Jokers.",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "apply_joker_edition_polychrome_destroy_others",
      lose_all_money: false
    }
  };

export default def;
