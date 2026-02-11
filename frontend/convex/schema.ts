import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  workflows: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    nodes: v.string(),
    edges: v.string(),
    globalConfig: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
