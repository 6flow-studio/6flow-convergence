import JSZip from "jszip";
import type { CompiledFile } from "./compiler-types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workflow";
}

export function getCompiledZipFileName(workflowName: string): string {
  return `${slugify(workflowName)}-cre-bundle.zip`;
}

export async function buildCompiledZipBlob(files: CompiledFile[]): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  return zip.generateAsync({ type: "blob" });
}
