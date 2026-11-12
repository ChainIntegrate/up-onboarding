# Publishing account.chainintegrate.it

The client's page (`https://account.chainintegrate.it/`) and the operator's (`/operator.html`) are static
files: the `web/` folder of this repository, served by nginx. Nothing runs on the server.

## Once

1. **DNS**: an `A` record (and `AAAA` if the server has IPv6) for `account.chainintegrate.it` pointing to the
   server, the same as `crosschain-lukso.chainintegrate.it`.
2. **The files**, as the web server's user can read them:

   ```bash
   sudo git clone https://github.com/ChainIntegrate/up-onboarding /var/www/up-onboarding
   ```

3. **nginx**: the headers snippet and the site, both from `tools/nginx/`:

   ```bash
   sudo cp /var/www/up-onboarding/tools/nginx/account-security-headers.conf /etc/nginx/snippets/
   sudo cp /var/www/up-onboarding/tools/nginx/account.chainintegrate.it.conf /etc/nginx/sites-available/account.chainintegrate.it
   sudo ln -s /etc/nginx/sites-available/account.chainintegrate.it /etc/nginx/sites-enabled/
   ```

   The two `ssl_certificate` lines are commented until the certificate exists: certbot writes them.
4. **The certificate**:

   ```bash
   sudo certbot --nginx -d account.chainintegrate.it
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Every update

```bash
cd /var/www/up-onboarding && sudo git pull --ff-only
```

Pages and scripts are sent with `Cache-Control: no-cache`, so clients get the new version at once. A change
to the headers snippet or the site file needs them copied again and `sudo nginx -t && sudo systemctl reload nginx`.

## Check after every deploy

```bash
curl -sI https://account.chainintegrate.it/ | grep -i content-security-policy        # connect-src 'none'
curl -sI https://account.chainintegrate.it/operator.html | grep -i -E "connect-src|x-robots-tag"
curl -s -o /dev/null -w "%{http_code}\n" https://account.chainintegrate.it/.git/config    # 404
curl -s -o /dev/null -w "%{http_code}\n" https://account.chainintegrate.it/README.md      # 404 (not in web/)
```

## What the headers do

- Every response: never framed (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), declared types kept
  (`nosniff`), no referrer, HSTS for one year (without `includeSubDomains`: the other subdomains are not
  affected), no camera, microphone, location or payment.
- Content-Security-Policy: scripts only from the site and ethers 6.13.4 from cdnjs (the pages load it with its
  integrity hash). The client's page connects to nothing (`connect-src 'none'`): what the client types stays in
  the browser until they download the request. The operator's page may connect only to LUKSO's two RPCs and to
  Pinata, and is not indexed (`X-Robots-Tag: noindex`, and `robots.txt`).
- The web root is `web/`: the rest of the repository (tests, tools, the extension, `.git`) is never served.

Tested on nginx 1.24 with a local certificate: the pages work under these headers with no policy violation, the
operator's page reaches the RPC and nothing else, `.git` and the files outside `web/` answer 404.
