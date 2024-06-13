import { SupportsDynamicProperties } from "./SupportsDynamicProperty";
import { regex } from "./regex";

export type Encoder<T = any> = (value: T) => string;
export type Decoder<T = any> = (value: string) => T;

export class DynamicProperty {
  static readonly MAX_DYNAMIC_PROPERTY_SIZE = 32767;

  static chunkSep = "_";
  static encode: Encoder = JSON.stringify;
  static decode: Decoder = JSON.parse;

  /**
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @returns Returns the value for the property, or undefined if the property has not been set.
   * @example
   * ```ts
   * DynamicProperty.get(world, "example:id");
   * ```
   */
  static get<T = any>(
    owner: SupportsDynamicProperties,
    id: string,
    options?: { chunkSep: string; decode: Decoder<T> }
  ): T {
    const propIds = this._getChunkPropertyIds(owner, id, options);
    if (propIds.length === 0) return undefined;

    let value = "";
    for (const propId of propIds) {
      value += owner.getDynamicProperty(propId);
    }

    return (options?.decode ?? this.decode)(value);
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
  static delete(
    owner: SupportsDynamicProperties,
    id: string,
    options?: { chunkSep: string }
  ) {
    for (const propId of this._getChunkPropertyIds(owner, id, options)) {
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
  static set<T = any>(
    owner: SupportsDynamicProperties,
    id: string,
    value: T,
    options?: { chunkSep: string; encode: Encoder<T> }
  ) {
    if (value === undefined) this.delete(owner, id, options);

    const encoded = (options?.encode ?? this.encode)(value);
    if (typeof encoded !== "string")
      throw new Error(
        `DynamicProperty.encode must return a string. Recieved type '${typeof encoded}'`
      );

    const prevChunkPropIds = this._getChunkPropertyIds(owner, id, options);

    // set data in chunks
    let chunkStart = 0;
    let chunkId = 0;
    while (chunkStart < encoded.length) {
      const chunkEnd = Math.min(
        encoded.length,
        chunkStart + this.MAX_DYNAMIC_PROPERTY_SIZE
      );
      const chunk = encoded.slice(chunkStart, chunkEnd);
      this._setChunk(owner, id, chunkId, chunk, options);
      chunkStart = chunkEnd;
      chunkId++;
    }

    // delete left over chunks
    for (let i = chunkId; i < prevChunkPropIds.length; i++) {
      this._setChunk(owner, id, chunkId, undefined);
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
    adjuster: (old: TOld) => TNew,
    options?: { chunkSep: string; decode: Decoder<TOld>; encode: Encoder<TNew> }
  ) {
    const old = this.get(owner, id, options);
    this.set(owner, id, adjuster(old), options);
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
  static *ids(
    owner: SupportsDynamicProperties,
    options?: { chunkSep: string }
  ): IterableIterator<string> {
    let ids = new Set<string>();

    for (const propId of owner.getDynamicPropertyIds()) {
      const idSeperatorIdx = propId.lastIndexOf(
        options?.chunkSep ?? this.chunkSep
      );
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
  static *values(
    owner: SupportsDynamicProperties,
    options?: { chunkSep: string; decode: Decoder }
  ): IterableIterator<string> {
    for (const id of this.ids(owner, options))
      yield this.get(owner, id, options);
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
    owner: SupportsDynamicProperties,
    options?: { chunkSep: string; decode: Decoder }
  ): IterableIterator<[string, any]> {
    for (const id of this.ids(owner, options))
      yield [id, this.get(owner, id, options)];
  }

  private static _setChunk(
    owner: SupportsDynamicProperties,
    id: string,
    chunkId: number,
    chunk: string,
    options?: { chunkSep: string }
  ) {
    owner.setDynamicProperty(
      `${id}${options?.chunkSep ?? this.chunkSep}${chunkId}`,
      chunk
    );
  }

  private static _getChunkPropertyIds(
    owner: SupportsDynamicProperties,
    id: string,
    options?: { chunkSep: string }
  ): string[] {
    const baseIdPattern = regex`^${id}${
      options?.chunkSep ?? this.chunkSep
    }\\d+$`;
    return owner
      .getDynamicPropertyIds()
      .filter((propId) => baseIdPattern.test(propId));
  }
}
