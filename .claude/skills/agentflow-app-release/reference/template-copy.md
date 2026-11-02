# Starting from a copy of the template instead, and changing a project `init` made

A clone of the template repository (reflexify/agentflow-app-template on GitHub) is the case desk, named `acme/case-desk`,
with the standalone site. `init` is what renames it and what drops the site, so let `init` do both and
rename nothing by hand. Make the project `init` would make, then put your work in it:

1. In a scratch folder beside the copy, run `init` with your names and flags, as in the `init` section of `SKILL.md`: with the site by default,
   with `--no-site` if you do not want it.
2. Copy your own `config/`, `agentflow.app.mjs` and, if you have a module, `src/module/` and `test/module/` over
   the scratch project's. Run `pnpm install`, `pnpm build` and `pnpm test` there. That folder is your project;
   throw the copy away.

**If the copy is still the untouched template** (nothing of yours in it yet), replace its files with the scratch
project's in one step, then rebuild:

```bash
rsync -a --delete --exclude node_modules --exclude .git --exclude .env --exclude keys --exclude dist-app ../scratch/ ./
pnpm install && pnpm build && pnpm test
```

`--delete` removes every file of the copy that the scratch project lacks, other than those excluded: the site's
files after `init --no-site` (`RUNBOOK.md` among them: it sets up the standalone site against a real AgentFlow), the
old lockfile, and any file you added, such as notes. Move a file you want to keep out first, or add an
`--exclude` for it. Then, if the folder has no commits yet, `git init` if needed and commit the project as it
stands, before you change anything: it is your baseline.

To keep the copy instead, compare it with the scratch project:

```bash
diff -rq ../scratch . --exclude node_modules --exclude .git --exclude package --exclude keys --exclude dist-app
```

What the diff lists falls in three groups.

- **Renamed files.** Differing only by the name (the starter's "Case desk" is your app's name) are `README.md`, `AGENTS.md`,
  `module.html` (its title), `vite.module.config.ts` and `src/module/module.tsx` (a comment), `src/module/text.ts` (the
  not-installed sentence) and, in the manifest, `config/package-manifest.json`'s `id`, `name`, `changelog` and the
  `app_users` parameter's `label` (the rest of the diff there is the scratch project's JSON layout). Take
  the scratch project's version of each, except a file you changed: merge it by hand, never overwrite it. A differing file under `config/`
  or `src/module/` other than these is your own work: keep it. `README.md` and `AGENTS.md` describe the starter, not your app:
  rewrite them for your app afterwards (step 12 of "From requirements to `config/`" in the `agentflow-app-authoring` skill).
- **`package.json`.** Merge, do not copy: take its `name`, keep the dependencies and scripts you added.
- **`tsconfig.json` and `tsconfig.node.json`.** Take the scratch project's. `tsconfig.node.json`'s `include` is the part
  that depends on the flags: with the site it lists `server`, `scripts` and `vite.config.ts`; `init --no-site` leaves them out.
  If you keep your own, delete those three from `include` once the site's files are gone (a path with no file in it is harmless, but
  it names a site you do not have).

**With the site** (the default), that is all: a file the diff lists as only in the copy is yours or the template's, and is
kept. The site: the `agentflow-app-authoring` skill's page on it.

**Without the site** (`--no-site`), also delete what the diff lists as only in the copy and belongs to the
site: `server/`, `static/`, `scripts/`, `index.html`, `vite.config.ts`, `.env.example`, `RUNBOOK.md`,
`src/App.tsx`, `src/StartCase.tsx`, `src/main.tsx`, `src/route.ts`, `src/styles.css`, `src/text.ts`, `src/vite-env.d.ts` and the
site's tests under `test/` (every file except `test/module/`). In `package.json` remove the site's `hono`, `jose`,
Hono's Node server and `tsx`, and its scripts (`setup-keys`, `check-setup`, `dev`, `build:site`, `start`). Take the scratch project's
`pnpm-workspace.yaml`. Then delete `pnpm-lock.yaml` or just re-run `pnpm install`: the lockfile still names the site's dependencies until
`pnpm install` rewrites it, and a frozen install (CI's default) refuses an old one. (If your tools refuse to delete a folder, move the site's files out of the project instead.)

Then `pnpm install`, `pnpm build`, `pnpm test`.

## A project `init` already made: another package id or name, or no site

The recipe above works on any project, not only a copy of the template: `init` is the only thing that knows every
file that carries the names or belongs to the site, so run it again, with the names and flags you now want, in a
scratch folder, and compare (the `diff -rq` above, with that scratch project as the new shape). Do not search and replace by hand.

- **Another package id** (`--prefix`, `--key`) **or name** (`init` writes the name from `--key`: `loan-desk` is "Loan desk"; edit `name` in the manifest for any other). The diff lists the
  same renamed files as above: `config/package-manifest.json` (`id`, `name`, the `app_users` parameter's `label`),
  `package.json` (`name`), `README.md`, `AGENTS.md`, `module.html`, `vite.module.config.ts`,
  `src/module/module.tsx`, `src/module/text.ts`, and, in a project with the site, its `<KEY>_` environment variables (`CASE_DESK_` in the starter). Take the scratch project's
  version of each and merge by hand anything you changed. Then `pnpm build` rewrites `package/`; a file already in
  `dist-app/` keeps the old name, so delete it (`seal` names its file from the new id and version).
- **Do it before the first `deploy` or `publish`.** An installation and a catalog entry belong to one package id: a
  package with another id is another app, installed beside the first, not an upgrade of it, and the first `publish`
  under a prefix claims that prefix for your organization (`publishing.md`). To rename an app that is installed, an
  admin installs the new one and then detaches or undoes the old (Admin → Apps); the CLI cannot.
- **No site** (the project has the standalone site and the app does not use it). Follow "Without the site" above: delete
  the listed files, take the scratch project's `package.json` dependencies and scripts, `pnpm-workspace.yaml`,
  `tsconfig.json` and `tsconfig.node.json`, and delete `pnpm-lock.yaml` or re-run `pnpm install`. Check
  first that nothing of yours imports from the site (`src/App.tsx`, `src/text.ts`, `src/route.ts`); the starter's module under
  `src/module/` does not.
