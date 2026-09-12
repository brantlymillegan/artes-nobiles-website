# Publish artesnobiles.com with GitHub Pages

Repository: [brantlymillegan/artes-nobiles-website](https://github.com/brantlymillegan/artes-nobiles-website). The site uses GitHub Actions to publish the selected website files to GitHub Pages. The production domain is `artesnobiles.com`.

## Repository setup

1. Use the existing repository, **brantlymillegan/artes-nobiles-website**.
2. Upload the prepared repository package, including the hidden `.github/` folder. It contains `dist/`, `scripts/build_pages.py`, `.github/workflows/pages.yml`, `.gitignore`, and these instructions. Keep the directory structure intact. The local `output/` and `.openai/` folders are not needed.
3. In the repository, open **Settings → Pages → Build and deployment** and choose **GitHub Actions** as the source.
4. In **Actions → Deploy website to GitHub Pages**, choose **Run workflow** on the default branch. Later pushes to the default branch deploy automatically. Pushes to other branches do not publish.
5. In **Settings → Pages → Custom domain**, enter **artesnobiles.com** and save it **before changing DNS**.

Public repositories can use GitHub Pages on GitHub Free. Private repositories require a plan that supports Pages for private repositories. A private repository does not automatically make the resulting website private. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The workflow validates the site, stages only the files listed in `PUBLIC_FILES` in `scripts/build_pages.py`, and publishes `_site/`. It uses the official GitHub Pages actions and the repository's built-in token. No hosting API key or separate server is required. The book PDF, design files, archived images, and unused fonts are excluded from the release.

`dist/CNAME` records the intended domain, but GitHub Actions deployments do not use that file to configure the domain. The **Custom domain** setting in step 5 is still required. [GitHub custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## DNS records

At the DNS provider for `artesnobiles.com`, use these records after setting the custom domain in GitHub:

The authoritative DNS provider is GoDaddy (`ns55.domaincontrol.com` and `ns56.domaincontrol.com`). On September 12, 2026, the domain's existing `@` A records were `76.223.105.230` and `13.248.243.5`, and `www` pointed to `artesnobiles.com`. Replace those web records with the following; no nameserver change is needed.

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
python3 scripts/build_pages.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory _site
```

If the existing local preview is already running on port 4173, keep using it for design work and use a different port to preview `_site/`.

Commit and push to the repository's default branch when ready to publish an update. If you need to restore an earlier version, revert the relevant commit and push; the same workflow redeploys that version.
