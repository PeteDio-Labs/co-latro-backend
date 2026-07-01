import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "delayed_gratification",
    name: "Delayed Gratification",
    description: "Earn $2 at end of each hand played",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "economy_per_hand_played",
      dollars: 2
    }
  };

export default def;
