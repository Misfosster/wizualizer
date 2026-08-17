export interface SimcDefaultVariant {
  label: string;
  file: string;
}

export interface SimcDefaultSpec {
  slug: string;
  label: string;
  variants: SimcDefaultVariant[];
}

export interface SimcDefaultClass {
  slug: string;
  label: string;
  specs: SimcDefaultSpec[];
}

export interface SimcDefaultsManifest {
  source: string;
  ref: string;
  directory: string;
  classes: SimcDefaultClass[];
}

export type SimcDefaultFetchErrorCode = "offline" | "not_found" | "http_error";

export class SimcDefaultFetchError extends Error {
  readonly code: SimcDefaultFetchErrorCode;

  constructor(code: SimcDefaultFetchErrorCode, message: string) {
    super(message);
    this.name = "SimcDefaultFetchError";
    this.code = code;
  }
}
