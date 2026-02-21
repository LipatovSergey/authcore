import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app.helper';

describe('/auth/register (POST)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let httpServer: App;

  beforeAll(async () => {
    ({ app, dataSource, httpServer } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  it('returns 201 and new user object', async () => {
    const res = await request(httpServer).post('/auth/register').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toStrictEqual({
      id: expect.any(String),
      email: 'tester@gmail.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('returns 409 when email is already exists', async () => {
    await request(httpServer)
      .post('/auth/register')
      .send({
        email: 'tester@gmail.com',
        password: 'some spaced text',
      })
      .expect(201);

    const res = await request(httpServer).post('/auth/register').send({
      email: 'tester@gmail.com',
      password: 'some spaced text',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Email already exists');
  });

  it('returns 400 if password is too short', async () => {
    const res = await request(httpServer).post('/auth/register').send({
      email: 'tester1@gmail.com',
      password: '12',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain(
      'password must be longer than or equal to 12 characters',
    );
  });
});
