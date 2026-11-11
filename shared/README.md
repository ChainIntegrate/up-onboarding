# Shared code (design)

What the extension and the Android app have in common, written and reviewed once:
- the request file format (`kind: "chainintegrate-up-create"`, version 1, as written by `web/up-create.js`);
- key creation, encrypted storage and the backup export;
- what each signature request means, computed from the request itself and shown to the client.
