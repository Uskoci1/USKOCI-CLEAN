/** Availability is a public configuration projection, never Auth authority. */
export type AuthAvailability = {
  emailPassword: boolean;
  emailSignup: boolean;
  phoneOtp: boolean;
  emailConfirmationRequired: boolean;
  // No complete recovery callback/password-update client exists yet.
  passwordRecovery: false;
};

export type AuthAvailabilityPort = {
  read(signal?: AbortSignal): Promise<AuthAvailability>;
};
