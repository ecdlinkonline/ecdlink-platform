const publicApiPatterns = [/^\/api\/auth(?:\/|$)/, /^\/api\/clerk\/webhook\/?$/, /^\/api\/health(?:\/|$)/];
const protectedPagePatterns = [/^\/dashboard(?:\/|$)/, /^\/ecdlink(?:\/|$)/, /^\/admin(?:\/|$)/, /^\/supplier(?:\/|$)/, /^\/donor(?:\/|$)/, /^\/funding(?:\/|$)/];

export function isPublicApiPath(pathname: string) {
  return publicApiPatterns.some((pattern) => pattern.test(pathname));
}

export function requiresAuthentication(pathname: string) {
  return pathname.startsWith("/api/") ? !isPublicApiPath(pathname) : protectedPagePatterns.some((pattern) => pattern.test(pathname));
}
