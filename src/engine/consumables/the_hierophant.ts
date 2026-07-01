import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_hierophant",
    name: "The Hierophant",
    description: "Enhances 2 selected cards to Bonus",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 2,
      max: 2,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "bonus",
      count: 2
    }
  };

export default def;
