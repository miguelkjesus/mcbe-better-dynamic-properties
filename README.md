# @mhesus/better-dynamic-properties

A library just like dynamic properties, but a little better.

If you use a bundler, you can install this via npm:

```plaintext
npm i @mhesus/better-dynamic-properties
```

## Features

- No type restrictions on values (options for custom encoding/decoding)
- Unlimited value size
- `.delete()` method (no more `.set(PROP, undefined)`)
- `.adjust()` method (get and set in one method)
- Lots of iterators: `.ids()`, `.values()`, `.entries()`

## Examples

### DynamicProperty.set()

A wide variety of types can be set, since under the hood, everything is encoded into JSON strings.

```ts
import { DynamicProperty } from "@mhesus/better-dynamic-properties";

DynamicProperty.set(thing, "example:number", 9001);
DynamicProperty.set(thing, "example:string", "Hello world!");
DynamicProperty.set(thing, "example:boolean", true);
DynamicProperty.set(thing, "example:object", { foo: "bar" });
```

### DynamicProperty.get()

Getting properties back is just as simple.

```ts
DynamicProperty.get(thing, "example:string");
// >> Hello world!

DynamicProperty.get(thing, "example:object");
// >> { foo: "bar" }
```

### DynamicProperty.delete()

Deleting properties is now more intuitive, however you can still do it the old way if you like.

```ts
DynamicProperty.delete(thing, "example:id");

// calls DynamicProperty.delete internally
DynamicProperty.set(thing, "example:id", undefined);
```

### DynamicProperty.adjust()

You can also adjust a property all in one method. Just pass in a function that performs and returns the modification you want.

```ts
DynamicProperty.adjust(thing, "example:increment", (old) => old + 1);

// the same as this
const old = DynamicProperty.get(thing, "example:increment");
DynamicProperty.set(thing, "example:increment", old + 1);
```

### DynamicProperty Iterators

Iterating over the ids, values, or both of a property is now easy.

```ts
for (const id of DynamicProperty.ids(thing))

for (const value of DynamicProperty.values(thing))

for (const [id, value] of DynamicProperty.entries(thing))
```

However, since these are iterators, you cannot use methods like `.forEach` or `.map` like usual. To do this use `Array.from`.

```ts
Array.from(DynamicProperty.entries(thing)).map(([id, value]) => {
  // do something...
});
```

### DynamicProperty.serialize() & DynamicProperty.deserialize()

You can override the underlying encoding/decoding system if you like.

```ts
// global override
DynamicProperty.serialize = (value, id) => /* ... */;
DynamicProperty.deserialize = (value, id) => /* ... */;

// local override
DynamicProperty.set(thing, "example:id", 4000, {
    serialize: (value, id) => /* ... */;
})
DynamicProperty.get(thing, "example:id", {
    deserialize: (value, id) => /* ... */;
})
```

## Unresolved Issues

- What should happen when trying to get a property that hasnt been created using this library? (doesnt have the format _PROPID_CHUNKID_)

  **Explanation:** The library currently doesn't acknowledge properties without the chunked property id format. This needs to change since the ability to fetch properties with simply the id _PROPID_ is intuitive, however what should happen if chunked properties e.g. (_PROPID_CHUNKID_) and a property (_PROPID_) with the same property id co-exist? Which should property should be favored? The behaviour for this situation seems undefined so an error could be raised, but this doesn't feel right since nothing has really gone wrong.

  **Potential solutions:**

  - Raise an error. The expected behaviour is undefined currently, however nothing has really gone wrong so I'm unsatisfied with this solution.
  - Change the chunk naming scheme.
    - One option would be to remove the suffix from the 1st chunk. However, this now brings potential for naming collisions between properties. For example, a property called _example_1_ and the 2nd chunk of a property called _example_: _example_1_. I could prevent you from naming properties matching `/.+_\d+/`, however this is also an unsatisfying solution.
