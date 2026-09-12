# DESIGN.md — dsh-moa

## Product / Purpose
- Назначение: Плагин для DeepSeek Harness, реализующий архитектуру Mixture of Agents (MoA) через команду `/moa <prompt>`. Позволяет параллельно генерировать варианты решения задачи несколькими моделями-кандидатами (proposers / reference models), после чего ведущая модель-агрегатор (judge / aggregator) оценивает ответы, отбирает лучшее, устраняет ошибки, продвигает созданные файлы в корень проекта и синтезирует итоговый результат. После завершения команды агент автоматически возвращается к основной модели текущей сессии.
- Аудитория: Пользователи DeepSeek Harness, решающие сложные инженерные, исследовательские, математические и архитектурные задачи, требующие ансамбля моделей и перекрёстной валидации.
- Статус: Active Development / Production Ready (quality-audit batch 2026-09-11: честная аналитика, English-canonical UI, безопасность сбора контекста)

## User Surfaces
- Web/UI: Выпадающее меню composer при вводе `/moa` с подсказкой и описанием; отображение стриминга MoA-хода в чате в реальном времени с индикаторами кандидатов; карточка настроек плагина в DSH Settings Card (слот `settings.plugin.item`, ключ `dsh-moa`).
- DSH UI / settings / slots: слот `settings.plugin.item` ядра DSH. Сворачиваемая карточка настроек пресетов, советников, агрегатора, опросника и параметров генерации, оформленная в едином стиле с `dsh-clinebot`.
- API: HTTP endpoints хоста: `GET /dsh-moa/status`, `GET /dsh-moa/presets`, `POST /dsh-moa/presets` (payload валидируется схемой; принимает `enabled`), `GET /dsh-moa/models`, `GET /dsh-moa/history`, `GET /dsh-moa/leaderboard`, `GET /dsh-moa/runs/<id>`, `POST /dsh-moa/run` (400 при `enabled: false`).
- CLI / Slash Commands: Команда `/moa <prompt>` и `/moa [preset] <prompt>` в строке ввода DSH.
- Документация: `docs/design/DESIGN.md`, `README.md`, `README.ru.md`.

## Visual Direction & ClineBot Alignment
- Атмосфера: Строгий нативный UI ядра DeepSeek Harness, гармонично встроенный в существующий интерфейс без визуального шума.
- Утверждённый эталонный стиль: `dsh-clinebot` — чистые карточки секций `.moa-section-card`, информативная шапка `.moa-header` со статусными бейджами реального времени (`.moa-badge-ok`, `.moa-badge-brand`), сегментированные группы переключателей `.moa-seg-group`, ползунки температуры с числовыми бейджами `.moa-slider-badge`, сетка статистики `.moa-stat-box`.
- Не копировать: Сторонние UI-библиотеки, неродные шрифты, кастомные акцентные цвета.

## Foundations
- Цвета и роли: Исключительно переменные темы DSH (`--dsw-alias-border-l2`, `--dsw-alias-bg-layer-2`, `--dsw-alias-bg-layer-3`, `--dsw-alias-label-primary`, `--dsw-alias-label-secondary`, `--dsw-alias-label-tertiary`, `--dsw-alias-state-brand-primary`, `--dsw-alias-state-success-primary`, `--dsw-alias-state-warning-primary`, `--dsw-alias-state-error-primary`).
- Типографика: Системный стек шрифтов DSH, заголовок карточки 20px/700, заголовки секций 15px/600, пояснения 13px, поля 13px.
- Сетка, отступы, responsive: Карточка 12px border-radius, шапка padding 14px 18px, секции padding 18px 20px, адаптивная сетка `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`.
- Accessibility: `aria-expanded` для раскрытия карточки, семантические кнопки, клавиатурный фокус, контрастные лейблы полей, встроенный `MoAErrorBoundary`.

## Components And States
- Компоненты:
  1. `MoACard` / `MoAEditor` — панель настройки плагина со статусной строкой, секциями пресетов, советников, судьи, телеметрией и переключателем `enabled`.
  2. `SearchableModelPicker` — быстрый выпадающий поиск моделей по провайдеру/названию с фильтрацией и поддержкой произвольных моделей.
  3. `MoAErrorBoundary` — изоляция UI-ошибок с кнопкой повторной попытки.
- Loading / empty / error / success:
  - `loading` — состояние инициализации настроек и загрузки списка доступных моделей.
  - `ready` — активная конфигурация с валидным списком моделей; статусный бейдж отражает фактический ответ `GET /dsh-moa/status` (online / offline / disabled), а не рисуется безусловно.
  - `unavailable` — хост недоступен с кнопкой повторного подключения.
  - `error` — индикация ошибки валидации или сохранения в `moa-alert-err`; невалидный payload `POST /dsh-moa/presets` отклоняется с 400.
- Телеметрия: сетка статистики показывает Total Runs, Avg Run Cost (из `GET /dsh-moa/history`), Configured Models и Total Presets; при отсутствии данных — «—».
- Формы, валидация и действия: Валидация наличия хотя бы одного советника и одного агрегатора.

## User Flows
- Критические сценарии:
  1. Пользователь вводит `/moa <вопрос>` в composer:
     - При вводе `/` отображается пункт `moa` в списке слэш-команд.
     - После отправки запускается parallel fan-out на советников с живым отображением прогресса в чате.
     - Агрегатор оценивает варианты, отбирает лучший код и синтезирует результат.
     - Следующее сообщение автоматически выполняется на основной модели сессии.
  2. Пользователь настраивает пресет в «Настройки -> Плагины -> Настройки плагинов -> Mixture of Agents»:
     - Выбор кандидатов из доступных в `ctx.llm`.
     - Выбор агрегатора и настройка температуры.
     - Включение/отключение опросника уточняющих вопросов.
     - Сохранение настроек через `settingsScope` / REST без перезапуска сервера.

## Locked Design Decisions
- 2026-09-03 — Реализация команды `/moa` как one-shot модификатора сессии с автовозвратом к базовой модели в `finally`.
- 2026-09-03 — Использование `settings.plugin.item` со сворачиваемой карточкой вместо отдельной вкладки настроек.
- 2026-09-03 — Поддержка именованных пресетов (`default`, `fast`, `deep-reasoning`).
- 2026-09-07 — Маршрутизация на реальные модели провайдеров (`targetPreset.aggregator`) без фиктивных сущностей.
- 2026-09-08 — Опциональный опросник (`ask_clarifying_questions`), zero-latency live delta queue streaming.
- 2026-09-10 — Унификация UI с дизайн-стандартом `dsh-clinebot` (статусные чипы в header, секционные карточки, дизайн-токены `--dsw-alias-*`, глубокий аудит устойчивости).
- 2026-09-11 — English-canonical пользовательские строки (сервер и клиент); ru-перевод предоставляет translation-плагин, собственный ru-дубль из пакета удалён. Причина: стандарт DSH (dsh-plugin-authoring); пересмотр — только по явному решению владельца.
- 2026-09-11 — Заглушка Live Canvas удалена (фабрикация `http://localhost:3000/preview/...`); заявления README сняты. Реальная интеграция с `dsh-live-canvas` — отдельная задача (Gitea #46). Changed: прежний пункт про автопревью больше не действует.
- 2026-09-11 — Статусный бейдж карточки отражает фактический `GET /dsh-moa/status` (online / offline / disabled); телеметрия Total Runs / Avg Run Cost берётся из `GET /dsh-moa/history`. Причина: карточка не должна показывать состояния, которые она не проверяла.
- 2026-09-11 — Переключатель `enabled` в карточке сохраняется через `settingsScope`/REST и влияет на `/moa`-turn и `POST /dsh-moa/run`.
- 2026-09-11 (вечер) — Интеграция с Live Canvas реализована через собственный REST-контракт `@goodandready/dsh-live-canvas` (`POST /dsh-live-canvas/api/preview`, self-call на порт хоста `ctx.webServer.port`) с тихой деградацией при отсутствии плагина (любая ошибка → ответ без preview-ссылки). Заменяет прежнее решение об удалении фабрикованной заглушки: ссылка `/dsh-live-canvas/sandbox/<id>` теперь создаётся реальной песочницей.


- 2026-09-12 — Реализация кураторского синтеза (`curator_synthesis`), строгой рубрики антипаттернов (`ANTIPATTERNS_RUBRIC`), живого потокового стриминга куратора (`stream_aggregator`), кворума кандидатов с льготным периодом (`quorum_enabled`, `grace_period_sec`), авторетрая транзиентных ошибок (`callWithTransientRetry`) и цепочки запасных судей (`aggregator_fallbacks`). Все опции конфигурируются в пресетах с сохранением 100% обратной совместимости.
