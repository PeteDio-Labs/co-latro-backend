import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "justice",
    name: "Justice",
    description: "Enhances 1 selected card to Glass",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "glass",
      count: 1
    }
  };

export default def;
