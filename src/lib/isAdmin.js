import { ADMIN_EMAIL } from "./featureFlags";

export function isAdminEmail(email) {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function isAdminUser(user) {
  return isAdminEmail(user?.email);
}
