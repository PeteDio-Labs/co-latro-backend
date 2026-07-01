import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "sock_and_buskin",
    name: "Sock and Buskin",
    description: "Face cards score twice",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "retrigger_face"
    }
  };

export default def;
