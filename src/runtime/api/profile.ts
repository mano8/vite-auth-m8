import { authFetch } from "../authFetch.js";
import { buildApiUrl } from "../config.js";
import { UserPublicSchema, type UserPublic } from "../schemas.js";

export async function getCurrentProfile(): Promise<UserPublic> {
  const response = await authFetch(buildApiUrl("/profile/get/me/"));
  const payload: unknown = await response.json();
  return UserPublicSchema.parse(payload);
}
