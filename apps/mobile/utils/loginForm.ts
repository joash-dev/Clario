/**
 * Prepared for a future Login screen: trim email, block empty submits, and a suggested state shape.
 */
export type LoginFormState = {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
};

export const loginFormInitialState: LoginFormState = {
  email: "",
  password: "",
  loading: false,
  error: null,
};

export function normalizeLoginEmail(email: string): string {
  return email.trim();
}

export function canSubmitLogin(email: string, password: string): boolean {
  return normalizeLoginEmail(email).length > 0 && password.length > 0;
}
