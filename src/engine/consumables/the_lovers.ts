import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_lovers",
    name: "The Lovers",
    description: "Enhances 1 selected card to Wild",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "wild",
      count: 1
    }
  };

export default def;
