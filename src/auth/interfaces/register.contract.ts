export interface RegisterInput {
  email: string;
  password: string;
}

export interface RegisterOutput {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
