export interface RegisterInput {
  email: string;
  password: string;
}

export interface RegisterOutput {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}
