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

export const generateCompileUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveCompiledArtifact = mutation({
  args: {
    id: v.id("workflows"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileCount: v.number(),
    compiledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const workflow = await ctx.db.get(args.id);
    if (!workflow || workflow.userId !== userId) {
      throw new Error("Workflow not found");
    }

    if (workflow.compiledArtifactStorageId) {
      await ctx.storage.delete(workflow.compiledArtifactStorageId);
    }

    await ctx.db.patch(args.id, {
      compiledArtifactStorageId: args.storageId,
      compiledArtifactFileName: args.fileName,
      compiledArtifactFileSize: args.fileSize,
      compiledArtifactFileCount: args.fileCount,
      compiledArtifactUpdatedAt: args.compiledAt,
      updatedAt: Date.now(),
    });

    return args.storageId;
  },
});

export const getCompiledArtifactForTui = query({
  args: {
    id: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const workflow = await ctx.db.get(args.id);
    if (!workflow || workflow.userId !== userId) {
      throw new Error("Workflow not found");
    }

    if (!workflow.compiledArtifactStorageId) {
      return null;
    }

    const downloadUrl = await ctx.storage.getUrl(workflow.compiledArtifactStorageId);
    if (!downloadUrl) {
      return null;
    }

    return {
      downloadUrl,
      fileName:
        workflow.compiledArtifactFileName ??
        `${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workflow"}-cre-bundle.zip`,
      workflowName: workflow.name,
      updatedAt: workflow.updatedAt,
    };
  },
});
