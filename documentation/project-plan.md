# AuthCore - План проекта

## Общая информация

**Проект:** AuthCore - Authentication microservice  
**Разработчик:** Solo developer (учебный проект)  
**Цель:** Production-ready auth сервис для портфолио и переиспользования в других проектах  
**Репозиторий:** https://github.com/[username]/authcore  
**Лицензия:** MIT

## Технологический стек

**Backend:**

- Node.js 20+
- Nest.js (TypeScript-first framework)
- TypeScript (strict mode)

**База данных:**

- PostgreSQL 17 (основное хранилище)
- Redis 7 (кэширование токенов)
- TypeORM (ORM)

**Инфраструктура:**

- Docker & Docker Compose
- Swagger/OpenAPI (документация API)

**Тестирование:**

- Jest (test runner)
- Supertest (E2E HTTP тесты)

**Линтинг и форматирование:**

- ESLint
- Prettier

## Архитектурные решения

### База данных

**PostgreSQL - основное хранилище:**

- Таблица `users` - данные пользователей
- Таблица `refresh_tokens` - refresh токены для аудита

**Redis - кэширование:**

- Активные refresh токены (быстрая валидация)
- TTL для автоматической очистки

**Миграции:**

- TypeORM CLI
- Все миграции в git
- Версионирование схемы БД

### Модели данных (MVP)

**Users:**

```typescript
{
  id: UUID (primary key)
  email: string (unique, not null)
  password_hash: string (not null)
  created_at: timestamp
  updated_at: timestamp
}
```

**Refresh Tokens:**

```typescript
{
  id: UUID (primary key)
  user_id: UUID (foreign key → users.id)
  token_hash: string (unique, not null)
  expires_at: timestamp
  created_at: timestamp
}
```

**Что НЕ включено в MVP:**

- `email_verified` (добавится в v1.1.0)
- `is_active` (добавится в v1.1.0)
- `role` (добавится в v2.1.0)
- `device_info`, `ip_address` (добавится в v2.0.0)

### API Endpoints

**MVP (v1.0.0):**

```
POST   /auth/register       - Регистрация нового пользователя
POST   /auth/login          - Вход (получение токенов)
POST   /auth/refresh        - Обновление access token
POST   /auth/logout         - Выход (инвалидация токенов)
GET    /auth/me             - Получение данных текущего пользователя (требует auth)
```

**Будущие версии:**

```
POST   /auth/verify-email       (v1.1.0)
POST   /auth/forgot-password    (v1.1.0)
POST   /auth/reset-password     (v1.1.0)
GET    /auth/sessions           (v2.0.0)
DELETE /auth/sessions/:id       (v2.0.0)
```

### Формат API

**Success Response:**

```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

**Error Response:**

```json
{
  "message": "Invalid credentials",
  "statusCode": 401
}
```

**HTTP Status Codes:**

- `200 OK` - успешные операции (login, refresh, logout, /me)
- `201 Created` - регистрация
- `400 Bad Request` - невалидные данные
- `401 Unauthorized` - неверные credentials, истёкший токен
- `404 Not Found` - пользователь не найден
- `409 Conflict` - email уже существует
- `500 Internal Server Error` - ошибка сервера

### Аутентификация и безопасность

**Токены (MVP):**

- **Access token:** JWT, 15 минут, HS256
- **Refresh token:** JWT, 7 дней, хранится в БД
- **Передача:** Access в `Authorization: Bearer`, Refresh в request body
- **Фиксированная модель auth для проекта:** только JWT + Refresh (cookie-session ветка не используется в текущем плане)

**Password hashing:**

- Argon2id (параметры через env)
- Никогда не логировать пароли

**Как используем Argon2id в проекте:**

- Используем пакет `argon2` (npm) как текущую стабильную реализацию
- В MVP поддерживается только Argon2id (fallback на bcrypt не используется)
- Хеширование идёт только через абстракцию `PasswordHasher` (не вызывать `argon2` напрямую по коду)
- Контракт `PasswordHasher`: `hash(password)`, `verify(password, storedHash)`, `needsRehash(storedHash)`
- Храним стандартный encoded hash (`$argon2id$...`) с параметрами внутри строки
- Миграция на встроенный Node Argon2 (когда станет stable/LTS) планируется через замену реализации в одном месте + rehash-on-login, без миграции БД и без сброса паролей

**Validation:**

- class-validator для DTOs
- Email формат проверка
- Минимум 12 символов для пароля
- Максимум 128+ символов
- Не применять trim к паролю (пробелы разрешены)

**Безопасность (что добавится позже):**

- HTTP-only cookies для refresh (v2.0.0)
- CSRF protection (v2.0.0)
- Расширенный rate limiting (v2.0.0)
- Email verification (v1.1.0)
- RS256 для JWT (v2.1.0)

### Примерная структура проекта

```
authcore/
├── src/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── register.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   └── refresh.dto.ts
│   │   ├── entities/
│   │   │   └── refresh-token.entity.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── database/
│   │   └── migrations/
│   ├── app.module.ts
│   └── main.ts
├── test/
│   └── auth.e2e-spec.ts
├── documentation/
│   ├── project-plan.md (этот файл)
│   └── context.md
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

### Окружение разработки

**Docker Compose:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: 5432:5432

  redis:
    image: redis:7-alpine
    ports: 6379:6379
```

**App запуск:**

- Локально: `npm run start:dev` (hot reload)
- Production: Docker контейнер

**Argon2 установка и деплой:**

- `argon2` является нативным модулем Node.js (использует prebuilt binaries на популярных платформах)
- Основной путь для OSS-пользователей: Docker-first
- Базовый production/dev образ: `node:<LTS>-slim` (Debian/Ubuntu)
- Если prebuilt binary недоступен, возможна сборка из исходников (node-gyp + toolchain)
- В README обязателен раздел Troubleshooting для установки `argon2`

**Environment Variables:**

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=authcore

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=another-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Argon2id
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1

# App
PORT=3000
NODE_ENV=development
```

**Валидация env:**

- `@nestjs/config` + Joi schema
- Приложение не запустится без обязательных переменных

### Тестирование

**MVP (v1.0.0):**

- E2E тесты основных flow (4-5 сценариев)
- Тестовая PostgreSQL в Docker
- Jest + Supertest

**E2E тесты:**

```typescript
- should register a new user (201)
- should login with valid credentials (200)
- should refresh access token (200)
- should logout and invalidate token (200)
- should reject invalid credentials (401)
```

**Unit тесты:**

- Добавятся в v1.1.0+
- Фокус на сервисах и сложной логике

**Подход:**

- Код сначала, тесты потом (для MVP)
- TDD для критичных фич (в следующих итерациях)

### Логирование

**MVP:**

- Встроенный Nest.js Logger
- Вывод в stdout (консоль)
- Уровни: error, warn, log, debug

**Что логируем:**

```typescript
✅ User registered (email, userId)
✅ User logged in (email, userId)
✅ Token refreshed (userId)
✅ User logged out (userId)
⚠️  Failed login attempt (email, reason)
⚠️  Invalid token (reason)
❌ Unhandled errors (stack trace)
```

**Production (v1.1.0+):**

- Winston или Pino
- Структурированные логи (JSON)
- Log rotation
- Возможно: external logging service

### Документация

**Swagger UI:**

- Автогенерация из декораторов
- Доступно на `/api`
- Try-it-out функциональность
- Bearer auth support

**README.md:**

- Getting Started
- Prerequisites
- Installation
- Running the app
- API documentation link
- Environment variables
- Testing
- Architecture overview
- Troubleshooting (включая установку `argon2`)
- License

**.env.example:**

- Все необходимые переменные
- Комментарии с описанием
- Примеры значений (не реальные секреты)

### Интеграция с другими сервисами

**Notes Service (и будущие микросервисы):**

**Метод:** JWT верификация на стороне клиента

**Как работает:**

1. AuthCore выдаёт JWT access token
2. Notes Service проверяет подпись самостоятельно
3. Shared `JWT_ACCESS_SECRET` между сервисами
4. Guard извлекает `userId` из токена

**Payload токена:**

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**В Notes Service:**

```typescript
// JwtAuthGuard проверяет токен
// Request.user = { sub: userId, email }
```

**Альтернативы (для будущего):**

- Verify endpoint в AuthCore (v1.1.0+)
- RS256 с public/private keys (v2.1.0)
- API Gateway (отдельный проект на Rust?)

### Git Workflow

**Branching:**

- Вся работа в `main`
- Частые коммиты и push

**Versioning:**

- Git tags для релизов: `v1.0.0`, `v1.1.0`, `v2.0.0`
- Semantic versioning
- GitHub Releases с описанием изменений

**Commit Convention:**

```
feat: add user registration endpoint
fix: resolve token expiration bug
refactor: extract JWT service
docs: update API documentation
test: add e2e tests for login
chore: update dependencies
```

**Коммиты:**

- Осмысленные сообщения
- Описание что и почему (для больших изменений)
- Частые коммиты (по фиче/фиксу)

## Roadmap

### MVP - v1.0.0 (3-4 недели)

**Цель:** Минимальный рабочий auth сервис

**Неделя 1: Setup + Nest.js основы**

- [ ] Инициализация Nest.js проекта
- [ ] Docker Compose (PostgreSQL + Redis)
- [ ] TypeORM setup и конфигурация
- [ ] Первые миграции (users, refresh_tokens)
- [ ] Модульная структура (auth, users)
- [ ] Env variables + валидация

**Неделя 2: Core функциональность**

- [ ] Users module (entity, service)
- [ ] Registration endpoint + DTO
- [ ] Password hashing (Argon2id)
- [ ] Password policy (min 12, no trim, spaces allowed)
- [ ] JWT генерация (access + refresh)
- [ ] Login endpoint
- [ ] Базовый rate limiting на login/register
- [ ] Базовый error handling

**Неделя 3: Токены и Guards**

- [ ] Refresh tokens в PostgreSQL
- [ ] Redis интеграция для кэша
- [ ] Refresh endpoint
- [ ] JWT Strategy + Guard
- [ ] Logout (инвалидация токенов)
- [ ] GET /auth/me endpoint

**Неделя 4: Polish и релиз**

- [ ] Validation pipes для всех DTOs
- [ ] Улучшенный error handling
- [ ] Swagger setup и аннотации
- [ ] E2E тесты (4-5 сценариев)
- [ ] Логирование основных событий
- [ ] README с инструкциями
- [ ] .env.example
- [ ] Git tag `v1.0.0`

**Deliverables:**

- Рабочий auth API
- Swagger документация
- Docker Compose для запуска
- E2E тесты
- README

---

### Итерация 2 - v1.1.0 (2-3 недели)

**Цель:** Email verification и password reset

**Фичи:**

- [ ] Email verification flow
  - Таблица `email_verification_tokens`
  - POST /auth/verify-email
  - Email отправка (SMTP setup)
  - `email_verified` поле в users
- [ ] Password reset flow
  - Таблица `password_reset_tokens`
  - POST /auth/forgot-password
  - POST /auth/reset-password
  - Email с reset link
- [ ] Улучшенное логирование
  - Winston или Pino
  - Structured logs (JSON)
  - Log levels для prod
- [ ] Больше тестов
  - Unit тесты для сервисов
  - E2E для новых endpoints
  - Покрытие ~60%+

**Deliverables:**

- Email verification работает
- Password reset работает
- Лучшее логирование
- Git tag `v1.1.0`

---

### Итерация 3 - v2.0.0 (2-3 недели)

**Цель:** Production-ready безопасность

**Фичи:**

- [ ] Multiple sessions support
  - `device_info` в refresh_tokens
  - `ip_address` в refresh_tokens
  - GET /auth/sessions (список активных)
  - DELETE /auth/sessions/:id (удалить сессию)
- [ ] HTTP-only cookies
  - Refresh token в cookie
  - CSRF protection
  - Secure flag для production
- [ ] Rate limiting
  - На login (защита от brute force)
  - На registration/reset (защита от спама)
  - Redis для хранения счётчиков
- [ ] Observability и аудит
  - Correlation/request ID
  - Audit events (login success/fail, reset requested/used, password changed, refresh rotated/revoked)
  - Базовые security-метрики
- [ ] Улучшенная безопасность
  - Helmet.js
  - CORS configuration
  - Request ID для трейсинга

**Deliverables:**

- Multiple sessions
- Cookies вместо body для refresh
- Rate limiting работает
- Git tag `v2.0.0`

---

### Итерация 4 - v2.1.0 (1-2 недели)

**Цель:** Advanced features

**Фичи:**

- [ ] Роли и permissions
  - `role` enum в users (user, admin)
  - Role-based guards
  - Admin endpoints (GET /users, DELETE /users/:id)
- [ ] RS256 для JWT
  - Private/Public key pair
  - Безопаснее для микросервисов
  - Public key endpoint для проверки
- [ ] Деплой
  - Railway/Render/Fly.io
  - CI/CD (GitHub Actions?)
  - Production env setup
  - Docker-first setup для стабильной установки `argon2`
  - Troubleshooting docs для fallback сборки `argon2`
  - Мониторинг (опционально)

**Deliverables:**

- Роли работают
- Audit logs
- RS256 JWT
- Задеплоено
- Git tag `v2.1.0`

---

### Будущие возможности (опционально)

**v3.0.0+:**

- [ ] OAuth providers (Google, GitHub)
- [ ] Two-factor authentication (TOTP)
- [ ] Provider-ready интеграция
  - Client/Application сущность
  - client_id / (опционально) client_secret
  - scopes / permissions
- [ ] API keys для machine-to-machine auth
- [ ] Session management UI
- [ ] Metrics и мониторинг (Prometheus?)
- [ ] GraphQL API (в дополнение к REST)

## Best Practices

### Code Style

**TypeScript:**

- Strict mode включён
- Explicit types (избегать `any`)
- Interfaces для contracts
- Types для данных

**Naming:**

- PascalCase для классов
- camelCase для переменных/функций
- UPPER_CASE для констант
- Descriptive names (не `a`, `b`, `temp`)

**Комментарии:**

- JSDoc для public API
- Inline комментарии для сложной логики
- Не комментировать очевидное

### Security

**Обязательно:**

- ❌ Никогда не логировать пароли
- ❌ Никогда не возвращать пароли в API
- ✅ Всегда валидировать user input
- ✅ Использовать prepared statements (TypeORM автоматически)
- ✅ Environment variables для секретов
- ✅ HTTPS в production (деплой платформа обеспечивает)

**Пароли:**

- Argon2id (не md5, не sha1)
- Параметры через env (memory/time/parallelism)
- Минимум 12 символов
- Никогда не хранить plain text

**Токены:**

- Короткоживущие access (15 мин)
- Refresh токены инвалидируются
- Секреты в environment variables

### Database

**Миграции:**

- Всегда через TypeORM CLI
- Никогда не редактировать вручную базу в production
- Проверять сгенерированный SQL
- Тестировать миграции на dev окружении

**Индексы:**

- На `email` (unique + часто ищем)
- На `user_id` в refresh_tokens
- Не переусердствовать (замедляют INSERT)

**Транзакции:**

- Для операций изменяющих несколько таблиц
- TypeORM QueryRunner для сложных случаев

### Error Handling

**Never:**

- ❌ Swallow errors (пустой catch)
- ❌ Возвращать stack traces пользователю
- ❌ Generic error messages без контекста

**Always:**

- ✅ Логировать с контекстом
- ✅ Использовать Nest.js Exception Filters
- ✅ Возвращать понятные сообщения
- ✅ HTTP статусы правильные

**Пример:**

```typescript
try {
  await this.userService.create(dto);
} catch (error) {
  this.logger.error('Failed to create user', {
    email: dto.email,
    error: error.message,
  });

  if (error.code === '23505') {
    // PostgreSQL unique violation
    throw new ConflictException('Email already exists');
  }

  throw new InternalServerErrorException('Registration failed');
}
```

### Testing

**Принципы:**

- E2E тесты для happy paths
- Unit тесты для сложной логики
- Не тестировать framework код
- Не тестировать простые getters/setters

**Что тестировать:**

- ✅ API endpoints (E2E)
- ✅ Бизнес логика (Unit)
- ✅ Edge cases
- ✅ Error handling

**Что не тестировать:**

- ❌ TypeORM queries (доверяем библиотеке)
- ❌ Nest.js DI (доверяем фреймворку)
- ❌ Тривиальный код

## Ограничения и Non-Goals

### Что НЕ входит в проект

**OAuth/Social Login:**

- Сложно для MVP
- Требует настройки apps у провайдеров
- Можно добавить в v3.0.0+

**Frontend:**

- Это backend проект
- Swagger UI достаточно для демо
- Фронт можно сделать отдельно позже

**Микросервисная оркестрация:**

- Нет API Gateway в этом проекте
- Нет service mesh
- Простая интеграция через shared JWT secret

**Scalability features:**

- Нет горизонтального масштабирования (пока)
- Нет load balancing
- Нет distributed caching
- Одна инстанция для учебного проекта

**Advanced monitoring:**

- Нет Prometheus metrics (пока)
- Нет distributed tracing
- Базовое логирование достаточно

## Связанные проекты

**Текущие:**

- `notes-service` - Express.js сервис для заметок (интегрируется с authcore)

**Планируемые:**

- API Gateway (возможно на Rust/Axum)
- Background worker (возможно на Rust)
- CLI tools (возможно на Rust)

**Интеграция:**

- Все микросервисы используют AuthCore для аутентификации
- Shared JWT secret или RS256 public key
- Независимые deployment

## Ресурсы для изучения

**Документация:**

- Nest.js Official Docs: https://docs.nestjs.com
- TypeORM Docs: https://typeorm.io
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

**Security:**

- OWASP Authentication Cheat Sheet
- OWASP Top 10

**Туториалы:**

- Nest.js Authentication (official)
- JWT Deep Dive

## Поддержка и коммуникация

**Git:**

- Repository: https://github.com/[username]/authcore
- Issues: для отслеживания багов
- Discussions: для вопросов

**Разработка:**

- Solo developer
- Claude AI как mentor и code review assistant

## Лицензия и использование

**Лицензия:** MIT

**Разрешено:**

- Использовать в коммерческих проектах
- Модифицировать
- Распространять
- Private use

**Требования:**

- Указать автора в копиях
- Включить копию лицензии

**Disclaimer:**

- Без гарантий
- Автор не несёт ответственности

---

**Последнее обновление:** 2025-02-03  
**Версия плана:** 1.0
