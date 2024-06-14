import { SupportsDynamicProperties } from "./SupportsDynamicProperty";
import { regex } from "./regex";

export type Serializer<T = any> = (value: T, id: string) => string;
export type Deserializer<T = any> = (value: string, id: string) => T;

export type GetOptions<T> = { deserialize?: Deserializer<T> };
export type SetOptions<T> = { serialize?: Serializer<T> };

export class DynamicProperty {
  static readonly MAX_CHUNK_SIZE = 32767; // dynamic property max size
  static readonly CHUNK_ID_PREFIX = "_";

  static serialize: Serializer = (value) => JSON.stringify(value);
  static deserialize: Deserializer = (value) => JSON.parse(value);

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
    options?: GetOptions<T>
  ): T | undefined {
    const propIds = this._getChunkPropertyIds(owner, id);
    if (propIds.length === 0) return undefined;

    let value = "";
    for (const propId of propIds) {
      const chunk = owner.getDynamicProperty(propId) as string;
      value += chunk;
    }

    return (options?.deserialize ?? this.deserialize)(value, id);
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
    for (const propId of this._getChunkPropertyIds(owner, id)) {
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
    options?: SetOptions<T>
  ) {
    if (value === undefined) return this.delete(owner, id);

    const serialized = (options?.serialize ?? this.serialize)(value, id);
    if (typeof serialized !== "string")
      throw new Error(
        `DynamicProperty.serialize must return a string. Recieved type '${typeof serialized}'`
      );

    const prevChunkPropIds = this._getChunkPropertyIds(owner, id);

    // set data in chunks
    let chunkStart = 0;
    let chunkId = 0;
    while (chunkStart < serialized.length) {
      const chunkEnd = Math.min(
        serialized.length,
        chunkStart + this.MAX_CHUNK_SIZE
      );
      const chunk = serialized.slice(chunkStart, chunkEnd);
      this._setChunk(owner, id, chunkId, chunk);
      chunkStart = chunkEnd;
      chunkId++;
    }

    // delete left over chunks
    for (let i = chunkId; i < prevChunkPropIds.length; i++) {
      this._setChunk(owner, id, i, undefined);
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
    adjuster: (old: TOld | undefined) => TNew,
    options?: GetOptions<TOld> & SetOptions<TNew>
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
  static *ids(owner: SupportsDynamicProperties): IterableIterator<string> {
    let ids = new Set<string>();

    for (const propId of owner.getDynamicPropertyIds()) {
      const chunkIdPrefixIdx = propId.lastIndexOf(this.CHUNK_ID_PREFIX);
      if (chunkIdPrefixIdx === -1) continue;

      const id = propId.slice(0, chunkIdPrefixIdx);
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
  static *values<T>(
    owner: SupportsDynamicProperties,
    options?: GetOptions<T>
  ): IterableIterator<T> {
    for (const id of this.ids(owner)) yield this.get(owner, id, options)!;
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
  static *entries<T>(
    owner: SupportsDynamicProperties,
    options?: GetOptions<T>
  ): IterableIterator<[string, T]> {
    for (const id of this.ids(owner)) yield [id, this.get(owner, id, options)!];
  }

  private static _setChunk(
    owner: SupportsDynamicProperties,
    id: string,
    chunkId: number,
    chunk: string | undefined
  ) {
    owner.setDynamicProperty(this._getChunkPropertyId(id, chunkId), chunk);
  }

  private static _getChunkPropertyIds(
    owner: SupportsDynamicProperties,
    id: string
  ): string[] {
    const isPropertyChunk = regex`^${id}${this.CHUNK_ID_PREFIX}\\d+$`;
    return owner
      .getDynamicPropertyIds()
      .filter((propId) => isPropertyChunk.test(propId))
      .sort((a, b) => this._getChunkId(a)! - this._getChunkId(b)!);
    // sorting fixes ids from ordering like this by default:
    // test_1, test_10, test_2, ...
  }

  private static _getChunkId(chunkPropertyId: string) {
    const chunkIdPrefixIdx = chunkPropertyId.lastIndexOf(this.CHUNK_ID_PREFIX);
    if (chunkIdPrefixIdx === -1) return undefined;
    return parseInt(
      chunkPropertyId.slice(
        chunkPropertyId.lastIndexOf(this.CHUNK_ID_PREFIX) + 1
      )
    );
  }

  private static _getChunkPropertyId(propertyId: string, chunkId: number) {
    return `${propertyId}${this.CHUNK_ID_PREFIX}${chunkId}`;
  }
}
