import { world } from "@minecraft/server";
import { SupportsDynamicProperties } from "./SupportsDynamicProperty";
import { regex } from "./regex";

export class DynamicProperty {
  static readonly MAX_DYNAMIC_PROPERTY_SIZE = 32767;

  static chunkSep = "_";
  static encode: (value: any) => string = JSON.stringify;
  static decode: (value: string) => any = JSON.parse;

  static get<T = any>(owner: SupportsDynamicProperties, id: string): T {
    const propIds = this.getChunkPropertyIds(owner, id);
    if (propIds.length === 0) return undefined;

    let value = "";
    for (const propId of propIds) {
      value += owner.getDynamicProperty(propId);
    }

    return this.decode(value);
  }

  static delete(owner: SupportsDynamicProperties, id: string) {
    for (const propId of this.getChunkPropertyIds(owner, id)) {
      owner.setDynamicProperty(propId, undefined);
    }
  }

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

  static adjust<TOld = any, TNew = any>(
    owner: SupportsDynamicProperties,
    id: string,
    adjuster: (old: TOld) => TNew
  ) {
    const old = this.get(owner, id);
    this.set(owner, id, adjuster(old));
  }

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

  static *values(owner: SupportsDynamicProperties): IterableIterator<string> {
    for (const id of this.ids(owner)) yield this.get(owner, id);
  }

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
