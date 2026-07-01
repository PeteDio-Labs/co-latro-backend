import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "aura",
    name: "Aura",
    description: "Add Foil, Holographic, or Polychrome effect to a random Joker.",
    kind: "spectral",
    cost: 4,
    effect: {
      kind: "apply_joker_edition_random",
      pool: ["foil", "holo", "poly"]
    }
  };

export default def;
