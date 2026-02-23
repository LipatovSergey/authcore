export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput {
  access_token: string;
  refresh_token: string;
}
