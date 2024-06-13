import { SupportsDynamicProperties } from "./SupportsDynamicProperty";
import { regex } from "./regex";

export class DynamicProperty {
  static readonly MAX_DYNAMIC_PROPERTY_SIZE = 32767;

  static chunkSep = "_";
  static encode: (value: any) => string = JSON.stringify;
  static decode: (value: string) => any = JSON.parse;

  /**
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @returns Returns the value for the property, or undefined if the property has not been set.
   * @example
   * ```ts
   * DynamicProperty.get(world, "example:id");
   * ```
   */
  static get<T = any>(owner: SupportsDynamicProperties, id: string): T {
    const propIds = this.getChunkPropertyIds(owner, id);
    if (propIds.length === 0) return undefined;

    let value = "";
    for (const propId of propIds) {
      value += owner.getDynamicProperty(propId);
    }

    return this.decode(value);
  }

  /**
   * Deletes the dynamic property from the owner.
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @example
   * ```ts
   * DynamicProperty.delete(world, "example:goodbye");
   * ```
   */
  static delete(owner: SupportsDynamicProperties, id: string) {
    for (const propId of this.getChunkPropertyIds(owner, id)) {
      owner.setDynamicProperty(propId, undefined);
    }
  }

  /**
   * Sets the value of a dynamic property.
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @param value The value of the property to set. Passing undefined will delete the property.
   * @example
   * ```ts
   * DynamicProperty.set(world, "example:number", 9001);
   *
   * DynamicProperty.set(world, "example:object", { a: 1, b: true });
   * ```
   */
  static set<T = any>(owner: SupportsDynamicProperties, id: string, value: T) {
    if (value === undefined) this.delete(owner, id);

    const encoded = this.encode(value);
    if (typeof encoded !== "string")
      throw new Error(
        `DynamicProperty.encode must return a string. Recieved type '${typeof encoded}'`
      );

    const prevChunkPropIds = this.getChunkPropertyIds(owner, id);

    // set data in chunks
    let chunkStart = 0;
    let chunkId = 0;
    while (chunkStart < encoded.length) {
      const chunkEnd = Math.min(
        encoded.length,
        chunkStart + this.MAX_DYNAMIC_PROPERTY_SIZE
      );
      const chunk = encoded.slice(chunkStart, chunkEnd);
      this.setChunk(owner, id, chunkId, chunk);
      chunkStart = chunkEnd;
      chunkId++;
    }

    // delete left over chunks
    for (let i = chunkId; i < prevChunkPropIds.length; i++) {
      this.setChunk(owner, id, chunkId, undefined);
    }
  }

  /**
   * Adjusts the value of a dynamic property.
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @param adjuster A function that takes the current value and returns a new value.
   * @example
   * ```ts
   * DynamicProperty.adjust(world, "example:increment", (old) => old + 1);
   * ```
   */
  static adjust<TOld = any, TNew = any>(
    owner: SupportsDynamicProperties,
    id: string,
    adjuster: (old: TOld) => TNew
  ) {
    const old = this.get(owner, id);
    this.set(owner, id, adjuster(old));
  }

  /**
   * @param owner The owner of the property.
   * @returns An iterator of the owner's dynamic property ids
   * @example
   * ```ts
   * for (const id of DynamicProperty.ids(owner)) {
   *  // Do something...
   * }
   * ```
   */
  static *ids(owner: SupportsDynamicProperties): IterableIterator<string> {
    let ids = new Set<string>();

    for (const propId of owner.getDynamicPropertyIds()) {
      const idSeperatorIdx = propId.lastIndexOf(this.chunkSep);
      if (idSeperatorIdx === -1) continue;

      const id = propId.slice(0, idSeperatorIdx);
      if (ids.has(id)) continue;

      ids.add(id);
      yield id;
    }
  }

  /**
   * @param owner The owner of the property.
   * @returns An iterator of the owner's dynamic property ids
   * @example
   * ```ts
   * for (const value of DynamicProperty.values(owner)) {
   *  // Do something...
   * }
   * ```
   */
  static *values(owner: SupportsDynamicProperties): IterableIterator<string> {
    for (const id of this.ids(owner)) yield this.get(owner, id);
  }

  /**
   * @param owner The owner of the property.
   * @returns An iterator of the owner's dynamic property ids
   * @example
   * ```ts
   * for (const [id, value] of DynamicProperty.entries(owner)) {
   *  // Do something...
   * }
   * ```
   */
  static *entries(
    owner: SupportsDynamicProperties
  ): IterableIterator<[string, any]> {
    for (const id of this.ids(owner)) yield [id, this.get(owner, id)];
  }

  private static setChunk(
    owner: SupportsDynamicProperties,
    id: string,
    chunkId: number,
    chunk: string
  ) {
    owner.setDynamicProperty(`${id}${this.chunkSep}${chunkId}`, chunk);
  }

  private static getChunkPropertyIds(
    owner: SupportsDynamicProperties,
    id: string
  ): string[] {
    const baseIdPattern = regex`^${id}${this.chunkSep}\\d+$`;
    return owner
      .getDynamicPropertyIds()
      .filter((propId) => baseIdPattern.test(propId));
  }
}
