import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "rocket",
    name: "Rocket",
    description: "Earn $2 at end of each hand played",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "economy_per_hand_played",
      dollars: 2
    }
  };

export default def;
