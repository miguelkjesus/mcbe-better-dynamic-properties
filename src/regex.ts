export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function regex(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = "";

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += escapeRegExp(`${values[i]}`);
    }
  }

  return new RegExp(result);
}
