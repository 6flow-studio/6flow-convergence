import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("workflows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const load = query({
  args: { id: v.id("workflows") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const workflow = await ctx.db.get(args.id);
    if (!workflow || workflow.userId !== userId) return null;
    return workflow;
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("workflows")),
    name: v.string(),
    description: v.optional(v.string()),
    nodes: v.string(),
    edges: v.string(),
    globalConfig: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...data } = args;
    const record = { ...data, userId, updatedAt: Date.now() };

    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("Workflow not found");
      }
      await ctx.db.patch(id, record);
      return id;
    }
    return await ctx.db.insert("workflows", record);
  },
});

export const remove = mutation({
  args: { id: v.id("workflows") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const workflow = await ctx.db.get(args.id);
    if (!workflow || workflow.userId !== userId) {
      throw new Error("Workflow not found");
    }
    await ctx.db.delete(args.id);
  },
});
