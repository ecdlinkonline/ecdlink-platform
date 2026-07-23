export type FieldErrors<T extends string> = Partial<Record<T, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  if (!email.trim()) {
    return "Email address is required.";
  }

  if (!emailPattern.test(email)) {
    return "Enter a valid email address.";
  }

  return "";
}

export function validatePassword(password: string) {
  if (!password) {
    return "Password is required.";
  }

  if (password.length < 8) {
    return "Use at least 8 characters.";
  }

  return "";
}

export function validateRequired(value: string, label: string) {
  if (!value.trim()) {
    return `${label} is required.`;
  }

  return "";
}
