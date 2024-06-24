import { SerializedValue, isSerializedValue } from "./SerializedValue";
import { SupportsDynamicProperties } from "./SupportsDynamicProperty";
import { regex } from "./regex";

export type Serializer<T = any> = (value: T, id: string) => SerializedValue;
export type Deserializer<T = any> = (value: SerializedValue, id: string) => T;

export type IdGetOptions = { namespace?: string };
export type GetOptions<T> = { deserialize?: Deserializer<T> };
export type SetOptions<T> = { serialize?: Serializer<T> };

export class DynamicProperty {
  static readonly MAX_CHUNK_SIZE = 32767; // dynamic property max size
  static readonly CHUNK_ID_PREFIX = "_";

  static serialize: Serializer = (value) => JSON.stringify(value);
  static deserialize: Deserializer = (value) => {
    if (typeof value === "string") return JSON.parse(value);
    else return value;
  };

  /**
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @returns Returns the value for the property, or undefined if the property has not been set.
   * @example
   * ```ts
   * let value = DynamicProperty.get(world, "example:id");
   * ```
   */
  static get<T = any>(
    owner: SupportsDynamicProperties,
    id: string,
    options?: GetOptions<T>
  ): T | undefined {
    const propIds = this._getChunkPropertyIds(owner, id);
    if (propIds.length === 0) return undefined;

    let value;
    if (propIds.length === 1) {
      value = owner.getDynamicProperty(propIds[0]);
    } else {
      // collect chunks
      value = "";
      for (const propId of propIds) {
        const chunk = owner.getDynamicProperty(propId) as string;
        value += chunk;
      }
    }

    // convert from ascii back to utf8 if string
    if (typeof value === "string") {
      value = decodeURI(value);
    }

    return (options?.deserialize ?? this.deserialize)(value, id);
  }

  /**
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @returns Returns whether the dynamic property exists on its owner.
   * @example
   * ```ts
   * DynamicProperty.exists(world, "example:doesnt_exist");
   * // >> false
   *
   * DynamicProperty.exists(world, "example:does_exist");
   * // >> true
   * ```
   */
  static exists(owner: SupportsDynamicProperties, id: string): boolean {
    return this._getChunkPropertyIds(owner, id).length !== 0;
  }

  /**
   * Deletes the dynamic property from the owner.
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @example
   * ```ts
   * DynamicProperty.delete(world, "example:id");
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
    if (!isSerializedValue(serialized))
      throw new Error(
        `The serializer must return a valid dynamic property value. Received:\n${serialized}.`
      );

    const prevChunkPropertyIds = this._getChunkPropertyIds(owner, id);

    if (typeof serialized === "string") {
      // size limits on strings so set data in chunks
      let chunkId = 0;
      for (const chunk of this._chunkString(serialized)) {
        this._setChunk(owner, id, chunkId, chunk);
        chunkId++;
      }

      // delete non overwritten chunks
      for (let i = chunkId; i < prevChunkPropertyIds.length; i++) {
        owner.setDynamicProperty(prevChunkPropertyIds[i], undefined);
      }
    } else {
      // anything else (e.g. other data types) can always fit in a single chunk
      this._setChunk(owner, id, 0, serialized);

      // delete all chunks apart from first in case it was a string
      for (let i = 1; i < prevChunkPropertyIds.length; i++) {
        owner.setDynamicProperty(prevChunkPropertyIds[i], undefined);
      }
    }
  }

  static *_chunkString(str: string) {
    // encodes utf8 to ascii
    // every character is guaranteed to be a single byte
    // much faster than calculating byte lengths
    let encoded = encodeURI(str);

    let chunkStart = 0;
    while (chunkStart < encoded.length) {
      const chunkEnd = Math.min(
        chunkStart + this.MAX_CHUNK_SIZE,
        encoded.length
      );
      yield encoded.slice(chunkStart, chunkEnd);
      chunkStart = chunkEnd;
    }
  }

  /**
   * Adjusts the value of a dynamic property.
   * @param owner The owner of the property.
   * @param id The property identifier.
   * @param updater A function that takes the current value and returns a new value.
   * @returns Returns the adjusted value.
   * @example
   * ```ts
   * let newValue = DynamicProperty.update(world, "example:increment", (old) => old + 1);
   * ```
   */
  static update<TOld = any, TNew = any>(
    owner: SupportsDynamicProperties,
    id: string,
    updater: (old: TOld | undefined) => TNew,
    options?: GetOptions<TOld> & SetOptions<TNew>
  ) {
    const oldValue = this.get(owner, id, options);
    const newValue = updater(oldValue);
    this.set(owner, id, newValue, options);
    return newValue;
  }

  /**
   * @param owner The owner of the property.
   * @param namespace If included, specifies the namespace of the properties to get (the text before the colon e.g. example_namespace:id)
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
    options?: IdGetOptions
  ): IterableIterator<string> {
    let ids = new Set<string>();

    for (const propId of owner.getDynamicPropertyIds()) {
      const chunkIdPrefixIdx = propId.lastIndexOf(this.CHUNK_ID_PREFIX);
      if (chunkIdPrefixIdx === -1) continue;

      const id = propId.slice(0, chunkIdPrefixIdx);
      if (
        options?.namespace !== undefined &&
        !id.startsWith(options?.namespace + ":")
      )
        continue;
      if (ids.has(id)) continue;

      ids.add(id);
      yield id;
    }
  }

  /**
   * @param owner The owner of the property.
   * @param namespace If included, specifies the namespace of the properties to get (the text before the colon e.g. example_namespace:id)
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
    options?: IdGetOptions & GetOptions<T>
  ): IterableIterator<T> {
    for (const id of this.ids(owner, options))
      yield this.get(owner, id, options)!;
  }

  /**
   * @param owner The owner of the property.
   * @param namespace If included, specifies the namespace of the properties to get (the text before the colon e.g. example_namespace:id)
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
    options?: IdGetOptions & GetOptions<T>
  ): IterableIterator<[string, T]> {
    for (const id of this.ids(owner, options))
      yield [id, this.get(owner, id, options)!];
  }

  private static _setChunk(
    owner: SupportsDynamicProperties,
    id: string,
    chunkId: number,
    chunk: SerializedValue | undefined
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
