import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "deja_vu",
    name: "Déjà Vu",
    description: "Adds a Red Seal to 1 selected card",
    kind: "spectral",
    cost: 4,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "seal_selected",
      seal: "red",
      count: 1
    }
  };

export default def;
