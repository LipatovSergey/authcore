  1. Создаёшь Issue

  Issue фиксирует задачу до кода. Например:

  Add profile navigation link for authenticated users

  Внутри:

  ## Goal
  Authenticated users should have a visible way to navigate back to their profile page.

  ## Context
  Currently `/me` is reachable only after successful login redirect or by typing the URL manually.

  ## Acceptance criteria
  - Header shows a profile/account link when a user has an active local session.
  - Header does not show the profile link for unauthenticated users.
  - `/me` remains protected even if opened manually.
  - Logout still clears the session and updates navigation.
  - Frontend lint/build pass.

  2. Создаёшь feature branch

  От main:

  git checkout main
  git pull
  git checkout -b feature/profile-navigation-link

  3. Делаешь изменения локально

  Работаешь только в этой ветке. Коммиты небольшие и по смыслу:

  git commit -m "feat: show profile link for active sessions"

  Если будет отдельный рефакторинг auth state:

  git commit -m "refactor: centralize frontend session state"

  4. Проверяешь локально

  Минимум:

  pnpm --filter demo-frontend lint
  pnpm --filter demo-frontend build

  Если затрагиваешь backend:

  pnpm lint:check
  pnpm test
  pnpm build

  5. Пушишь ветку

  git push -u origin feature/profile-navigation-link

  6. Открываешь Pull Request

  PR title:

  Add profile navigation link for authenticated users

  PR body:

  ## Summary
  - Adds a visible profile link for users with a stored session.
  - Keeps `/me` protected through the existing session validation flow.

  ## Verification
  - pnpm --filter demo-frontend lint
  - pnpm --filter demo-frontend build

  Closes #<issue-number>

  7. Делаешь self-review

  Перед merge сам проходишься по diff и оставляешь короткий комментарий:

  Self-review:
  - Checked unauthenticated header state.
  - Checked authenticated header state after login.
  - Checked logout removes profile navigation.
  - `/me` still redirects unauthenticated users.

  8. Ждёшь CI

  GitHub Actions должны пройти. Если настроишь ruleset, GitHub не даст смержить, пока checks не зелёные.

  9. Merge в main

  Для solo-проекта я бы использовал Squash and merge, чтобы main был чистым:

  feat: add profile navigation link

  10. После merge

  Локально:

  git checkout main
  git pull
  git branch -d feature/profile-navigation-link

  Если это production-worthy изменение, можно потом деплоить с Raspberry Pi:

  ./scripts/deploy-prod.sh

  Главная привычка: issue описывает намерение, branch изолирует работу, PR показывает diff и проверку, CI защищает main, merge
  фиксирует готовое состояние.
