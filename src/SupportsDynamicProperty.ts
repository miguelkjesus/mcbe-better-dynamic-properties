import type { Vector3 } from "@minecraft/server";

export type ValidDynamicPropertyValue =
  | boolean
  | number
  | string
  | Vector3
  | undefined;

export interface SupportsDynamicProperties {
  getDynamicProperty(identifier: string): ValidDynamicPropertyValue;
  getDynamicPropertyIds(): string[];
  getDynamicPropertyTotalByteCount(): number;
  setDynamicProperty(
    identifier: string,
    value?: ValidDynamicPropertyValue
  ): void;
  clearDynamicProperties(): void;
}

function hasProperty(x: object, name: string, type: string): boolean {
  return name in x && typeof x[name] === type;
}

export function supportsDynamicProperties(
  x: unknown
): x is SupportsDynamicProperties {
  return (
    typeof x === "object" &&
    hasProperty(x, "getDynamicProperty", "function") &&
    hasProperty(x, "getDynamicPropertyIds", "function") &&
    hasProperty(x, "getDynamicPropertyTotalByteCount", "function") &&
    hasProperty(x, "setDynamicProperty", "function") &&
    hasProperty(x, "clearDynamicProperties", "function")
  );
}
