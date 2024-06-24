import { SerializedValue } from "./SerializedValue";

export interface SupportsDynamicProperties {
  getDynamicProperty(identifier: string): SerializedValue;
  getDynamicPropertyIds(): string[];
  getDynamicPropertyTotalByteCount(): number;
  setDynamicProperty(identifier: string, value?: SerializedValue): void;
  clearDynamicProperties(): void;
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

function hasFunction(obj: any, name: string): boolean {
  return typeof obj[name] === "function";
}
