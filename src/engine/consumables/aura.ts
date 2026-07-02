import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "aura",
    name: "Aura",
    description: "Add Foil, Holographic, or Polychrome effect to 1 selected card in hand.",
    kind: "spectral",
    cost: 4,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "edition_selected_random",
      pool: ["foil", "holo", "poly"]
    }
  };

export default def;
