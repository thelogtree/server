export enum ErrorMessages {
  ApiCredentialsIncorrect = "The API credentials on this request are either missing or invalid.",
  NoPermission = "You do not have permission to make this request.",
  Suspended = "Your organization has been suspended. Please contact support.",
  ReachedLimit = "Your organization has reached its limit for the number of logs it can have. Please contact support to increase the limit.",
}

export class ApiError {
  message: string;
  code: number;
  constructor(message: string = "", code: number = 400) {
    this.message = message;
    this.code = code;
  }
}

export class AuthError {
  message: string;
  code: number;
  constructor(
    message: string = ErrorMessages.NoPermission,
    code: number = 403
  ) {
    this.message = message;
    this.code = code;
  }
}
