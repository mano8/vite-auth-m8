import {
  createFrameworkAuthAdapter,
  type FrameworkAuthAdapter,
  type FrameworkRuntime
} from "../framework.js";

export type ReactAuthRuntime = FrameworkRuntime;
export type ReactAuthAdapter = FrameworkAuthAdapter;

export function createReactAuthAdapter(react: ReactAuthRuntime): ReactAuthAdapter {
  return createFrameworkAuthAdapter(react);
}
