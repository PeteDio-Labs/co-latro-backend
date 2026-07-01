import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "egg",
    name: "Egg",
    description: "Earn $1 at end of each hand played",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "economy_per_hand_played",
      dollars: 1
    }
  };

export default def;
