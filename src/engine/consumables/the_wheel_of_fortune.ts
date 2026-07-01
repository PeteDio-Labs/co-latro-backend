import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_wheel_of_fortune",
    name: "The Wheel of Fortune",
    description: "1 in 4 chance to add Foil, Holographic, or Polychrome edition to a random Joker.",
    kind: "tarot",
    cost: 3,
    effect: {
      kind: "wheel_of_fortune_chance",
      pool: ["foil", "holo", "poly"],
      chance: 0.25
    }
  };

export default def;
