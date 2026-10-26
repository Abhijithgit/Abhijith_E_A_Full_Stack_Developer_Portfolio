# Owner-Protected Angular Portfolio

Owner user ID: **Abhijithea**

Visitors can view your CV and projects. Only the signed-in owner can open the editor and save changes. Saved updates are stored on the server and appear for visitors without rebuilding the website. There is no public registration page and no default password.

## Start using the included built version

1. Install Node.js 24 LTS.
2. Extract this ZIP and open the `angular-portfolio` folder.
3. Run `SET_OWNER_PASSWORD.cmd` once. Choose a private password or passphrase of 12–128 characters; your typing stays hidden. The user ID is already set to Abhijithea.
4. Run `START_PORTFOLIO.cmd`.
5. Open http://127.0.0.1:4300 and choose **Owner login** at the bottom of the page.

The `dist/` folder is already built and included. Running this built version needs Node.js only; there are no server packages to install. Keep the server terminal running while using the portfolio.

Equivalent terminal commands:

```sh
node server/setup-owner.mjs
node server/index.mjs
```

To change your password later, run `CHANGE_OWNER_PASSWORD.cmd` or `node server/setup-owner.mjs --change-password`. It asks for your current password before allowing a change. Existing owner sessions are invalidated after a password change. The real owner password has intentionally not been set or included in this package.

## Edit your portfolio

After signing in, select **Edit portfolio**. Update your details, portrait, project list, skills, experience, education, certifications, languages, page text and colour. Add, remove and reorder projects; attach images or GIFs and optional live/source links. Choose **Save changes** to publish the update on this running server. Use **Sign out** when finished.

Uploads support PNG, JPG, WebP and GIF, up to 1.5 MB each. Uploaded media is embedded in your saved content. Large images can instead use HTTPS image links. Replace the PDF in `public/` and `dist/` or point the CV field to a new HTTPS URL when updating the downloadable CV; the editor does not edit the PDF itself.

**Export changes** downloads a content backup. **Import backup** loads a backup into the owner editor; Save changes applies it. **Discard unsaved edits** returns the draft to the currently saved content.

The motion effects, decorative GIF and reduced-motion support are preserved. Personal location is omitted.

## How access is restricted

- The Node server checks the owner session for every update, independently of the Angular interface.
- The owner password is salted and hashed using Node's scrypt implementation; plaintext passwords are not saved.
- Sessions use HttpOnly, SameSite Strict cookies. Production cookies also require HTTPS.
- Writes require a same-origin request and a session-specific CSRF token.
- Login attempts are limited; sessions expire after one hour, and logout revokes them.
- Server-side validation rejects invalid content. Concurrent edits are checked so a stale tab cannot overwrite newer changes silently.
- Owner credentials are stored in `.data/owner.json`; saved content is in `.data/portfolio.json`. This private directory is never served as web content and is excluded from Git and the supplied ZIP.
- Browser storage from the earlier portfolio version is no longer used to authorize editing or override public content.

## Host online

Run the Node server on a Node-capable host with persistent storage and HTTPS. A static-only host cannot provide protected editing. This custom user-ID/password version is a standalone Angular + Node application; the earlier static Sites configuration is not used by this package.

Configure your host's environment:

- `NODE_ENV=production`
- `PUBLIC_ORIGIN=https://your-portfolio-domain` (exact origin, no trailing slash)
- `HOST=0.0.0.0` if required by the host
- `PORT` set to the host's assigned port
- `PORTFOLIO_DATA_DIR` set to a persistent private folder or mounted volume

Run owner setup on that server, then start `node server/index.mjs` behind your host's HTTPS proxy. Use one Node process/instance with this file-based data store. Back up the private data directory securely; it contains the owner password hash. Do not upload it as public static content. Server restarts sign out active sessions but retain the saved profile and owner credentials. Behind a proxy, the login rate limit uses the proxy's address; no untrusted forwarding headers are used.

No live deployment was made as part of this delivery.

## Develop and rebuild

```sh
npm install
npm run build
npm run test:server
npm run check:logic
npm run serve
```

Or use the pinned pnpm version with `pnpm install`, `pnpm build` and `pnpm serve`. For live development, run `npm run api:dev` and `npm run dev` in separate terminals, then open http://127.0.0.1:4200.

Source files: `src/main.ts` handles owner sessions and protected saving, `src/editor.ts` provides the forms, `src/motion.ts` provides effects, and `server/` contains authentication, setup, serving, persistence and API tests. `public/portfolio.json` is the initial published content; saved server data takes precedence.

## Verification

Angular template/type compilation and a linked production bundle passed. The normal Angular CLI bundler could not enumerate an ancestor folder under this environment's filesystem restrictions, so the included compiled bundle was produced using the Angular AOT compiler, Angular's library linker and esbuild with explicit project-file resolution. It was tested in the browser with an isolated test account: signed-out view-only mode, owner login, editing, saving, refresh persistence and logout all passed. Test credentials and test data are not included.

Backend tests verify rejection of unauthenticated and forged writes, wrong-user/password handling, CSRF/origin checks, logout, password-change revocation, session expiry, production cookie flags, rate limits and persistent saves. The existing project/media/motion logic checks also pass. These are implementation checks, not an external security audit.
