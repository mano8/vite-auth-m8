function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function hostPermissionFromOrigin(origin: string): string {
  return `${origin}/*`;
}

export function cspAllowsOrigin(csp: string | undefined, origin: string): boolean {
  if (!csp) {
    return false;
  }
  const connectSrc = csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("connect-src "));
  return connectSrc?.split(/\s+/).includes(origin) ?? false;
}

export function buildExtensionCsp(backendOrigins: string[], existing?: string): string {
  const directives = existing
    ? existing.split(";").map((directive) => directive.trim()).filter(Boolean)
    : ["script-src 'self'", "object-src 'self'"];
  const connectIndex = directives.findIndex((directive) => directive.startsWith("connect-src "));
  const connectSources = unique(["'self'", ...backendOrigins]);
  const connectDirective = `connect-src ${connectSources.join(" ")}`;
  if (connectIndex >= 0) {
    const existingSources = directives[connectIndex]
      .split(/\s+/)
      .slice(1);
    directives[connectIndex] = `connect-src ${unique([...existingSources, ...connectSources]).join(" ")}`;
  } else {
    directives.push(connectDirective);
  }
  return `${directives.join("; ")};`;
}

export function mergeHostPermissions(generated: string[], configured?: string[]): string[] {
  return unique([...(configured ?? []), ...generated]);
}
