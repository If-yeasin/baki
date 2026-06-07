export class PaymentInputError extends Error {
  public readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "PaymentInputError";
    this.code = code;
    // Maintain proper prototype chain for `instanceof` across transpilation targets.
    Object.setPrototypeOf(this, PaymentInputError.prototype);
  }
}
