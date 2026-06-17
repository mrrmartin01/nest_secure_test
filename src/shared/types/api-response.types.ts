export interface ApiMeta {
  timestamp: string;
  correlationId?: string;
  version: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  correlationId?: string;
  timestamp: string;
  path: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  id: string;
  email: string;
  role: string;
}
