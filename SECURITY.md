# Security Policy

## Reporting a vulnerability

Please report security issues privately to **potuswatchdaily@gmail.com**, or
open a [private security advisory](https://github.com/ubaldo28/potuswatch/security/advisories/new).

Please do not open a public issue for a security problem.

Include what you found, how to reproduce it, and what an attacker could do with
it. Expect an acknowledgement within 72 hours.

## Scope

In scope: this repository, https://www.potuswatchdaily.com, and the article
generator Worker.

Out of scope: findings against third-party services the site embeds (ad
networks, analytics), and volumetric denial of service.

## Handling of credentials

No secret is committed to this repository. The generator and the site read
every credential from Cloudflare Worker secrets, Cloudflare Pages environment
variables, or GitHub Actions secrets. `.env` and `.dev.vars` are gitignored.
