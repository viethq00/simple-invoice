export interface AuthenticatedUser {
  id: string;
  email: string;
  fullname: string;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
