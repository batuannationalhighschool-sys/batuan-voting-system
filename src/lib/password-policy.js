export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export function getAdminPasswordPolicyErrors(password = '') {
  const errors = [];

  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    errors.push(`at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) errors.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('an uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('a special character');

  return errors;
}

export function isStrongAdminPassword(password = '') {
  return getAdminPasswordPolicyErrors(password).length === 0;
}
