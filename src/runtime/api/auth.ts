import { request } from "../request.js";
import { TokenSchema, type Token } from "../schemas.js";
import { storeBearerToken } from "../tokenStore.js";

export async function loginWithPassword(username: string, password: string): Promise<Token> {
  const token = await request({
    method: "POST",
    path: "/login/access-token",
    form: { username, password },
    schema: TokenSchema
  });
  await storeBearerToken(token.access_token);
  return token;
}
