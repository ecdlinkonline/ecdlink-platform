export type ClerkIdentityInput = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export function clerkIdentityUpdate(input: ClerkIdentityInput, lastLoginAt = new Date()) {
  return {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    lastLoginAt
  };
}
