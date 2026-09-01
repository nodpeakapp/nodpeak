# Contributing to Nodpeak

Thanks for taking the time — this is a small, opinionated codebase and it stays useful by
staying small. Read this before opening a PR; it'll save you a review round-trip.

## Before you write code

For anything beyond a typo or a small bug fix, **open an issue first**. Describe the problem
you're solving, not just the change. That's the point where scope gets agreed on, before either
of us spends time on an implementation the maintainer would ask to change direction on.

## Local setup

```bash
git clone https://github.com/nodpeakapp/nodpeak.git
cd nodpeak
npm install
cp apps/web/.env.example apps/web/.env   # DATABASE_URL=file:./dev.db is fine locally
npm run db:push --workspace=@nodpeak/web
npm run dev
```

Dashboard at `http://localhost:3000`. The widget rebuilds automatically as part of `npm run dev`.

## Before opening a PR

```bash
npm run typecheck
npm run build
```

Both must pass. `npm run build` also enforces the widget's 15KB gzip budget — the build **fails**
if `packages/widget` grows past it, on purpose. If your change needs the extra bytes, that's a
conversation to have in the issue, not something to work around.

## Scope this project keeps to

Nodpeak does three things: collects reviews, routes them by sentiment, and publishes schema
markup for the ones you approve. Good contributions sharpen those three things — a bug fix, a
new self-host deployment target, an integration snippet for a platform not yet in the README, a
security hardening.

Things that are probably a fork, not a PR here: a second review-collection *mechanism* (this
already has one, deliberately), a UI framework swap, a database swap (SQLite + Litestream is a
load-tested, deliberate choice — see [`GO-LIVE.md`](GO-LIVE.md) if you're curious why), or
anything that meaningfully grows the widget's footprint.

## Commit and PR style

- Keep commits scoped — one logical change per commit reads faster than one giant diff.
- Reference the issue you opened (`Fixes #12`).
- Describe *why*, not just *what*, in the PR description. The diff already shows what changed.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). A minimal reproduction
(a URL, a widget config, a request/response pair) is worth more than a description of the
symptom — the fastest bugs to fix are the ones we can see fail locally.

## Reporting a security issue

**Do not open a public issue.** See [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree your contribution is licensed under the project's
[AGPL-3.0](LICENSE), the same as the rest of the codebase.
