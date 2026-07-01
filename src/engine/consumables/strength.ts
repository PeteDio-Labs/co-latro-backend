import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "strength",
    name: "Strength",
    description: "Increases the rank of up to 2 selected cards by 1",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 2,
      from: "hand"
    },
    effect: {
      kind: "increase_rank_selected",
      max: 2
    }
  };

export default def;
