export interface GuardInput { authenticated: boolean; to: string; isLoginRoute: boolean; }
export type GuardResult = { allow: true } | { redirect: string; query?: Record<string, string> };

export function resolveGuard(input: GuardInput): GuardResult {
  if (input.isLoginRoute) {
    return input.authenticated ? { redirect: "/" } : { allow: true };
  }
  if (!input.authenticated) {
    return { redirect: "/login", query: { next: input.to } };
  }
  return { allow: true };
}
