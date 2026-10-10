export class AuthError extends Error {
  constructor(message, status = 400, code = "AUTH_ERROR") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}
