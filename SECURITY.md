# Security Policy

## Supported versions

Nodpeak is pre-1.0 and moves as a single rolling release. Security fixes land on `main`; run
`git pull` and redeploy to stay current. There is no separate LTS branch yet.

## Reporting a vulnerability

**Please do not open a public issue for a security report.**

Use GitHub's private reporting instead:

1. Go to the [Security tab](../../security) of this repository.
2. Click **Report a vulnerability**.
3. Describe the issue, the impact, and — if you have one — a reproduction.

This opens a private advisory visible only to you and the maintainers, with its own discussion
thread, until a fix ships.

If you'd rather not use GitHub, email **noumansadiq.co@gmail.com** with the same information.

### What to include

- The affected version or commit.
- Whether it applies to a self-hosted install, the managed cloud instance, or both.
- Steps to reproduce, or a proof of concept.
- What you think the impact is (data exposure, privilege escalation, SSRF, etc.).

### What to expect

- Acknowledgement within a few days.
- An honest assessment of severity and a rough timeline — this is a small, mostly solo project,
  not a security team with an SLA.
- Credit in the fix's release notes, if you'd like it.

## Already-documented hardening

The README's [Security notes](README.md#security-notes) section documents the mitigations already
in place — SSRF guarding on the audit endpoint, default-deny review moderation, hashed IPs,
timing-safe auth, and the single-process rate limiter's known limits. Read it before reporting
something covered there; it may already be a documented, deliberate trade-off rather than a bug.
