import { describe, expect, it } from "vitest";
import { getShadcnRegistryItem, listShadcnRegistryItems, shadcnRegistry } from "../src/shadcn/index.js";

describe("shadcn registry", () => {
  it("lists React and Preact auth panel blocks that import package auth UI", () => {
    expect(listShadcnRegistryItems()).toHaveLength(2);
    expect(listShadcnRegistryItems("react").map((item) => item.name)).toEqual(["fa-auth-m8-react-auth-panel"]);
    expect(listShadcnRegistryItems("preact").map((item) => item.name)).toEqual(["fa-auth-m8-preact-auth-panel"]);
    for (const item of shadcnRegistry) {
      expect(item.files[0].content).toContain("@fa-m8/vite-auth-m8");
      expect(item.files[0].content).toContain("LoginView");
      expect(item.files[0].content).toContain("AccountView");
    }
  });

  it("gets registry items by name and rejects unknown names", () => {
    expect(getShadcnRegistryItem("fa-auth-m8-react-auth-panel").framework).toBe("react");
    expect(() => getShadcnRegistryItem("missing")).toThrow('Unknown shadcn registry item "missing"');
  });
});
