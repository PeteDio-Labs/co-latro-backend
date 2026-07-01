import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "vagabond",
    name: "Vagabond",
    description: "Face cards score twice",
    cost: 8,
    rarity: "rare",
    effect: {
      kind: "retrigger_face"
    }
  };

export default def;
