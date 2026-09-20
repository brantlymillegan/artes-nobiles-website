# Publish artesnobiles.com with GitHub Pages

Repository: [brantlymillegan/artes-nobiles-website](https://github.com/brantlymillegan/artes-nobiles-website). The site uses GitHub Actions to publish the selected website files to GitHub Pages. The production domain is `artesnobiles.com`.

## Deployment status

- Public repository created; local `origin` points to it.
- Default branch: `master`.
- Pages source: **GitHub Actions**.
- Initial [deployment succeeded](https://github.com/brantlymillegan/artes-nobiles-website/actions/runs/34707198525). The published HTML matched the local source exactly, and all 13 supporting website files returned HTTP 200.
- Custom domain **artesnobiles.com** is saved in [Settings → Pages](https://github.com/brantlymillegan/artes-nobiles-website/settings/pages).
- The apex and `www` DNS records were verified on both authoritative GoDaddy nameservers on September 12, 2026; GitHub also validates both domains as eligible for HTTPS.
- **HTTPS enabled:** GitHub issued the certificate for `artesnobiles.com` and `www.artesnobiles.com` on September 12, 2026. **Enforce HTTPS** is on. Valid TLS and all four HTTP/HTTPS apex/www entry points were verified to serve or redirect to `https://artesnobiles.com/`, with HTML matching the deployed source.
- Certificate provisioning required removing and immediately re-adding the same custom domain after DNS became valid. Some local DNS caches continued to return the old GoDaddy server after public resolvers updated; no further DNS-record edits are needed.

Changes pushed to `master` deploy automatically. To redeploy manually, use **Actions → Deploy website to GitHub Pages → Run workflow** on `master`. Pushes to other branches do not publish.

The workflow validates the site, stages only the files listed in `PUBLIC_FILES` in `scripts/build_pages.py`, and publishes `_site/`. It uses the official GitHub Pages actions and the repository's built-in token. No hosting API key or separate server is required. The book PDF, design files, archived images, and unused fonts are excluded from the release.

## Flappy Pope

[Flappy Pope](https://artesnobiles.com/flappypope/) is maintained separately in [brantlymillegan/flappypope](https://github.com/brantlymillegan/flappypope). After assembling the main website, the workflow validates the game and copies only its `dist/` directory to `_site/flappypope/`. Game source files are not duplicated in this repository. The homepage showcase and both navigation menus link to that route; the site builder allows this exact route because the workflow adds and validates it separately. The domain and existing Pages settings stay on this website repository.

Each website deployment fetches the game's `main` branch. After pushing game changes, run this website's deployment workflow on `master` to publish them:

```sh
gh workflow run pages.yml --repo brantlymillegan/artes-nobiles-website --ref master
```

The game repository's validation workflow does not automatically trigger this website's deployment; the manual dispatch avoids adding cross-repository write credentials.

`dist/CNAME` records the intended domain, but GitHub Actions deployments do not use that file to configure the domain. The **Custom domain** setting is already saved on GitHub. [GitHub custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## DNS records

At the DNS provider for `artesnobiles.com`, use these records after setting the custom domain in GitHub:

The authoritative DNS provider is GoDaddy (`ns55.domaincontrol.com` and `ns56.domaincontrol.com`). On September 12, 2026, the user replaced the old WebsiteBuilder records with the following records, verified on both authoritative nameservers. No nameserver change is needed.

| Type | Name / Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | brantlymillegan.github.io |

The four `A` records point the root domain at GitHub Pages. The `www` value is the repository owner's GitHub Pages hostname, without a repository path. If you use an organization or a different account, replace `brantlymillegan.github.io` with that owner's hostname. With `artesnobiles.com` saved as the custom domain, GitHub redirects `www.artesnobiles.com` to it. [GitHub DNS records](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#dns-records-for-your-custom-domain).

For IPv6 support, also use these records:

| Type | Name / Host | Value |
| --- | --- | --- |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |

Replace conflicting web-hosting records for `@` and `www`; preserve email records such as MX and unrelated TXT records. If using Cloudflare DNS, start these web records as **DNS only** while GitHub validates the domain and issues its certificate.

Once GitHub's DNS check passes, enable **Enforce HTTPS** in **Settings → Pages**. DNS propagation and certificate availability can take up to 24 hours. [GitHub HTTPS guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Updating the site

Edit the authored files in `dist/`. If you add an asset, include it in `PUBLIC_FILES` in `scripts/build_pages.py`; a missing asset entry will stop deployment rather than produce a broken site. Check the release locally with:

```sh
node --check dist/theme.js
node --check dist/logo.js
node --check dist/navigation.js
node --check dist/product-logos.js
node --check dist/assets/logo-motion.js
python3 scripts/build_pages.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory _site
```

If the existing local preview is already running on port 4173, keep using it for design work and use a different port to preview `_site/`.

Commit and push to the repository's default branch when ready to publish an update. If you need to restore an earlier version, revert the relevant commit and push; the same workflow redeploys that version.
