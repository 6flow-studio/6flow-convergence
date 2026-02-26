type CompilerPackageManifest = {
  version?: unknown;
};

let compilerVersionPromise: Promise<string> | null = null;

export function getCompilerVersion(): Promise<string> {
  if (compilerVersionPromise) {
    return compilerVersionPromise;
  }

  compilerVersionPromise = (async () => {
    try {
      const response = await fetch("/compiler/package.json", {
        cache: "no-store",
      });
      if (!response.ok) {
        return "unknown";
      }

      const payload = (await response.json()) as CompilerPackageManifest;
      if (typeof payload.version !== "string") {
        return "unknown";
      }

      const version = payload.version.trim();
      return version === "" ? "unknown" : version;
    } catch {
      return "unknown";
    }
  })();

  return compilerVersionPromise;
}
