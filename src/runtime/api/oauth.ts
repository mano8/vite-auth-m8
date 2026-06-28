import { request } from "../request.js";
import { GoogleExchangeResponseSchema, GoogleLoginUrlResponseSchema, type GoogleExchangeResponse, type GoogleLoginUrlResponse } from "../schemas.js";

export function getGoogleLoginUrl(params: { redirect_target: string; code_challenge: string }): Promise<GoogleLoginUrlResponse> {
  return request({
    method: "GET",
    path: "/google-api/login-url/",
    query: params,
    schema: GoogleLoginUrlResponseSchema
  });
}

export function exchangeGoogleCode(body: { code: string; code_verifier: string; client_hint?: string }): Promise<GoogleExchangeResponse> {
  return request({
    method: "POST",
    path: "/google-api/exchange/",
    body,
    schema: GoogleExchangeResponseSchema
  });
}
