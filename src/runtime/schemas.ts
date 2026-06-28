import { z } from "zod";

export const RoleTypeSchema = z.enum(["superadmin", "admin", "writer", "reader", "user"]);
export type RoleType = z.infer<typeof RoleTypeSchema>;

export const AuthProviderTypeSchema = z.enum(["password", "google"]);
export type AuthProviderType = z.infer<typeof AuthProviderTypeSchema>;

const isoDate = z.string();
const nullableIsoDate = isoDate.nullable();

export const TokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().default("bearer")
}).strict();
export type Token = z.infer<typeof TokenSchema>;

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  provider: AuthProviderTypeSchema.default("password"),
  email: z.string().email(),
  full_name: z.string().max(100).nullable().default(null),
  avatar: z.string().max(512).url().nullable().default(null),
  is_active: z.boolean().default(true),
  email_verified: z.boolean().default(false),
  is_superuser: z.boolean().default(false),
  role: RoleTypeSchema.default("user"),
  created_at: isoDate.optional(),
  updated_at: isoDate.optional()
}).strict();
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const ApiKeyPublicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(100),
  expires_at: nullableIsoDate,
  revoked: z.boolean().default(false),
  last_used_at: nullableIsoDate.default(null),
  created_at: isoDate.optional(),
  updated_at: isoDate.optional()
}).strict();
export type ApiKeyPublic = z.infer<typeof ApiKeyPublicSchema>;

export const GoogleLoginUrlResponseSchema = z.object({
  url: z.string().url()
}).strict();
export type GoogleLoginUrlResponse = z.infer<typeof GoogleLoginUrlResponseSchema>;

export const GoogleExchangeUserSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email(),
  avatar: z.string().url().nullable().optional()
}).strict();
export type GoogleExchangeUser = z.infer<typeof GoogleExchangeUserSchema>;

export const GoogleExchangeResponseSchema = z.object({
  version: z.union([z.string(), z.number()]),
  auth_provider: z.literal("google"),
  access_token: z.string(),
  expires_at: z.number(),
  user: GoogleExchangeUserSchema
}).strict();
export type GoogleExchangeResponse = z.infer<typeof GoogleExchangeResponseSchema>;

export const UserProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  avatar: z.string()
}).strict();
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const AuthStateSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
  sessionId: z.string(),
  tokenType: z.enum(["bearer", "apikey"]),
  loginTimestamp: z.number()
}).strict();
export type AuthState = z.infer<typeof AuthStateSchema>;

export const AuthStorageSchema = z.object({
  auth: AuthStateSchema,
  user: UserProfileSchema
}).strict();
export type AuthStorage = z.infer<typeof AuthStorageSchema>;

export function parseAuthStorage(value: unknown): AuthStorage | null {
  const parsed = AuthStorageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
