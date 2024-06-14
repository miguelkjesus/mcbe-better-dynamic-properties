import type { Vector3 } from "@minecraft/server";

export type SerializedValue = boolean | number | string | Vector3 | undefined;

export interface SupportsDynamicProperties {
  getDynamicProperty(identifier: string): SerializedValue;
  getDynamicPropertyIds(): string[];
  getDynamicPropertyTotalByteCount(): number;
  setDynamicProperty(identifier: string, value?: SerializedValue): void;
  clearDynamicProperties(): void;
}

function hasFunction(obj: any, name: string): boolean {
  return typeof obj[name] === "function";
}

export function supportsDynamicProperties(
  x: any
): x is SupportsDynamicProperties {
  return (
    typeof x === "object" &&
    x !== null &&
    hasFunction(x, "getDynamicProperty") &&
    hasFunction(x, "getDynamicPropertyIds") &&
    hasFunction(x, "getDynamicPropertyTotalByteCount") &&
    hasFunction(x, "setDynamicProperty") &&
    hasFunction(x, "clearDynamicProperties")
  );
}
