import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "hanging_chad",
    name: "Hanging Chad",
    description: "Face cards score twice",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "retrigger_face"
    }
  };

export default def;
