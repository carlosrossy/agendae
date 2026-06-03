export abstract class Result<TError, TValue> {
  abstract isSuccess(): this is Success<TError, TValue>;
  abstract isFailure(): this is Failure<TError, TValue>;
  abstract readonly value: TError | TValue;
}

export class Success<TError, TValue> extends Result<TError, TValue> {
  constructor(public readonly value: TValue) {
    super();
  }

  isSuccess(): this is Success<TError, TValue> {
    return true;
  }

  isFailure(): this is Failure<TError, TValue> {
    return false;
  }
}

export class Failure<TError, TValue> extends Result<TError, TValue> {
  constructor(public readonly value: TError) {
    super();
  }

  isSuccess(): this is Success<TError, TValue> {
    return false;
  }

  isFailure(): this is Failure<TError, TValue> {
    return true;
  }
}

export const success = <TError = never, TValue = unknown>(
  value: TValue,
): Success<TError, TValue> => new Success(value);

export const failure = <TError = unknown, TValue = never>(
  error: TError,
): Failure<TError, TValue> => new Failure(error);