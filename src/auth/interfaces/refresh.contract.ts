export interface RefreshInput {
  refresh_token: string;
}

export interface RefreshOutput {
  access_token: string;
  refresh_token: string;
}
