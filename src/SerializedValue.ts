import type { Vector3 } from "@minecraft/server";

export type SerializedValue = boolean | number | string | Vector3 | undefined;

export function isSerializedValue(x: any): x is SerializedValue {
  return (
    typeof x === "boolean" ||
    typeof x === "number" ||
    typeof x === "string" ||
    typeof x === "undefined" ||
    (typeof x === "object" &&
      typeof x.x === "number" &&
      typeof x.y === "number" &&
      typeof x.z === "number")
  );
}
