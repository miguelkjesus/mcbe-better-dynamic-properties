import { world } from "@minecraft/server";
import { DynamicProperty } from "@mhesus/better-dynamic-properties";

DynamicProperty.namespace = "test";
DynamicProperty.set(world, "number", 0);

world.sendMessage(world.getDynamicPropertyIds());
