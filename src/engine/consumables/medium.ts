import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "medium",
    name: "Medium",
    description: "Adds a Purple Seal to 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "seal_selected",
      seal: "purple",
      count: 1
    }
  };

export default def;
