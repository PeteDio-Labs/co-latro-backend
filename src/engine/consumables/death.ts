import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "death",
    name: "Death",
    description: "Copies the second selected card onto the first",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 2,
      max: 2,
      from: "hand"
    },
    effect: {
      kind: "copy_card"
    }
  };

export default def;
