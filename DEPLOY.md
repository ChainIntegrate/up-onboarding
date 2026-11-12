# Publishing account.chainintegrate.it

The client's page (`https://account.chainintegrate.it/`) and the operator's (`/operator.html`) are static
files: the `web/` folder of this repository, served by nginx. The creation service (`/api/`, `tools/creator`)
runs next to them, from the same clone.

## Once

1. **DNS**: an `A` record (and `AAAA` if the server has IPv6) for `account.chainintegrate.it` pointing to the
   server, the same as `crosschain-lukso.chainintegrate.it`.
2. **The files**, as the web server's user can read them:

   ```bash
   sudo git clone https://github.com/ChainIntegrate/up-onboarding /var/www/up-onboarding
   ```

3. **The certificate**, before the site: nginx refuses an `ssl` server without its certificate, so first
   only the port 80 block, which serves certbot's check from the web root:

   ```bash
   sudo sed -n '/^server {/,/^}/p;/^}/q' /var/www/up-onboarding/tools/nginx/account.chainintegrate.it.conf | sudo tee /etc/nginx/sites-available/account.chainintegrate.it
   sudo ln -sf /etc/nginx/sites-available/account.chainintegrate.it /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot certonly --webroot -w /var/www/up-onboarding/web -d account.chainintegrate.it
   ```

4. **The site**: the headers snippet and the whole site file, both from `tools/nginx/`:

   ```bash
   sudo cp /var/www/up-onboarding/tools/nginx/account-security-headers.conf /etc/nginx/snippets/
   sudo cp /var/www/up-onboarding/tools/nginx/account.chainintegrate.it.conf /etc/nginx/sites-available/account.chainintegrate.it
   sudo nginx -t && sudo systemctl reload nginx
   ```

   The certificate renews by itself (certbot's timer) through the same port 80 path; after a renewal nginx
   needs a reload: `sudo certbot renew --dry-run` checks it, and a deploy hook
   (`--deploy-hook "systemctl reload nginx"`) can be added to the renewal.

## The creation service (once)

The service (`tools/creator`) runs from the same clone, as its own system user, on this machine only
(127.0.0.1:8787); nginx passes `/api/` to it. It needs Node.js 20 or later (`node -v`).

1. **User, folders, dependencies**:

   ```bash
   sudo useradd --system --home /var/lib/up-onboarding --shell /usr/sbin/nologin up-onboarding
   sudo install -d -m 700 -o up-onboarding -g up-onboarding /var/lib/up-onboarding
   sudo install -d -m 750 -o root -g up-onboarding /etc/up-onboarding
   cd /var/www/up-onboarding/tools/creator && sudo npm ci --omit=dev
   ```

2. **The gas wallet**: a new key, used only by the service, created on the server and never copied elsewhere:

   ```bash
   sudo sh -c 'cd /var/www/up-onboarding/tools/creator && node -e "console.log(require(\"ethers\").Wallet.createRandom().privateKey)" > /etc/up-onboarding/gas-key'
   sudo chown up-onboarding:up-onboarding /etc/up-onboarding/gas-key && sudo chmod 600 /etc/up-onboarding/gas-key
   ```

3. **The IPFS node**: the service adds and pins the images and profiles on ChainIntegrate's own node, through
   its API (Kubo, `/api/v0/add`). In the configuration, `ipfsApi`: `http://127.0.0.1:5001` if the node runs on
   this server, otherwise the node's API address, with this server among the node's allowed addresses. If the
   API is behind a proxy that asks for a header, put its value in a file and name it in `ipfsAuthFile`:

   ```bash
   curl -s -X POST http://127.0.0.1:5001/api/v0/version      # on this server: the node answers with its version
   ```

4. **The configuration**: start on LUKSO Testnet (`"network": "lukso-testnet"`, `"rpc": "https://rpc.testnet.lukso.network"`,
   `"chainId": 4201`), move to LUKSO when the test is good. The extension follows the service's network by itself.

   ```bash
   sudo cp /var/www/up-onboarding/tools/creator/config.example.json /etc/up-onboarding/config.json
   sudo nano /etc/up-onboarding/config.json
   sudo chown root:up-onboarding /etc/up-onboarding/config.json && sudo chmod 640 /etc/up-onboarding/config.json
   ```

5. **systemd**:

   ```bash
   sudo cp /var/www/up-onboarding/tools/creator/up-onboarding-creator.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now up-onboarding-creator
   sudo journalctl -u up-onboarding-creator -n 5
   ```

   The log names the gas wallet's address: send it a few LYX (LYXt on the testnet, from LUKSO's faucet).

6. **nginx**: the site file has the `/api/` location; copy it again and reload:

   ```bash
   sudo cp /var/www/up-onboarding/tools/nginx/account.chainintegrate.it.conf /etc/nginx/sites-available/account.chainintegrate.it
   sudo nginx -t && sudo systemctl reload nginx
   curl -s --resolve account.chainintegrate.it:443:127.0.0.1 https://account.chainintegrate.it/api/health   # {"ok":true,"network":...}
   ```

7. **An invitation code**, and the status:

   ```bash
   cd /var/www/up-onboarding/tools/creator
   sudo -u up-onboarding env CREATOR_CONFIG=/etc/up-onboarding/config.json node creator.js invite --note "Test"
   sudo -u up-onboarding env CREATOR_CONFIG=/etc/up-onboarding/config.json node creator.js status
   ```

## Every update

```bash
cd /var/www/up-onboarding && sudo git pull --ff-only
cd tools/creator && sudo npm ci --omit=dev && sudo systemctl restart up-onboarding-creator   # when tools/creator or shared/ changed
```

Pages and scripts are sent with `Cache-Control: no-cache`, so clients get the new version at once. A change
to the headers snippet or the site file needs them copied again and `sudo nginx -t && sudo systemctl reload nginx`.

## Check after every deploy

The server may not reach itself through its public address (no "hairpin"): from the server, point curl at
nginx on the machine itself with `--resolve`; from any other computer, drop `$R`.

```bash
R="--resolve account.chainintegrate.it:443:127.0.0.1 --resolve account.chainintegrate.it:80:127.0.0.1"
curl -sI $R https://account.chainintegrate.it/ | grep -i -E "^HTTP|content-security-policy|strict-transport|x-frame"   # 200, connect-src 'none'
curl -sI $R https://account.chainintegrate.it/operator.html | grep -i -E "^HTTP|connect-src|x-robots-tag"           # 200, LUKSO and the IPFS node only, noindex
for u in /.git/config /README.md; do curl -s $R -o /dev/null -w "$u %{http_code}\n" https://account.chainintegrate.it$u; done   # 404, 404
curl -s $R -o /dev/null -w "%{http_code} %{redirect_url}\n" http://account.chainintegrate.it/                       # 301 to https
sudo certbot renew --dry-run --cert-name account.chainintegrate.it
```

TLS versions, on the server. nginx picks the version before it knows which site is asked for, so what counts
is the default server of port 443 (or `nginx.conf`), not the line in this site alone. The check looks at the
negotiated cipher: s_client prints a "Protocol" line even when the server refuses.

```bash
for v in tls1 tls1_1 tls1_2 tls1_3; do printf "%-7s " $v; echo | openssl s_client -connect 127.0.0.1:443 -servername account.chainintegrate.it -$v -cipher 'DEFAULT@SECLEVEL=0' 2>/dev/null | grep -qE "^New, .*Cipher is [A-Za-z0-9_-]+$" && echo accepted || echo refused; done
# tls1 refused, tls1_1 refused, tls1_2 accepted, tls1_3 accepted
```

First deploy, 2026-11-12: every check as expected.

## What the headers do

- Every response: never framed (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), declared types kept
  (`nosniff`), no referrer, HSTS for one year (without `includeSubDomains`: the other subdomains are not
  affected), no camera, microphone, location or payment.
- Content-Security-Policy: scripts only from the site and ethers 6.13.4 from cdnjs (the pages load it with its
  integrity hash). The client's page connects to nothing (`connect-src 'none'`): what the client types stays in
  the browser until they download the request. The operator's page may connect only to LUKSO's two RPCs and to
  ChainIntegrate's IPFS node, and is not indexed (`X-Robots-Tag: noindex`, and `robots.txt`).
- The web root is `web/`: the rest of the repository (tests, tools, the extension, `.git`) is never served.

Written for the server's nginx 1.18 (no directive newer than it) and tested on nginx 1.24 with a local
certificate: the pages work under these headers with no policy violation, the
operator's page reaches the RPC and nothing else, `.git` and the files outside `web/` answer 404.
