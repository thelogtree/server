export enum ErrorMessages {
  ApiCredentialsIncorrect = "The API credentials on this request are either missing or invalid.",
  NoPermission = "You do not have permission to make this request.",
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
