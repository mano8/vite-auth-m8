import { request } from "../request.js";
import { ApiKeyPublicSchema, type ApiKeyPublic } from "../schemas.js";

export function verifyApiKey(apiKey: string): Promise<ApiKeyPublic> {
  return request({
    method: "GET",
    path: "/profile/api-keys/verify",
    headers: { "X-API-Key": apiKey },
    schema: ApiKeyPublicSchema
  });
}
