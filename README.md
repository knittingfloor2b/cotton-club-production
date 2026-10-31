# Cotton Club BD Limited — Extended Part

## Project layout
- `Code.gs` — Apps Script backend, database creation, login, permissions, roll entry, reports and administration.
- `Index.html` — responsive web app.
- `appsscript.json` — Apps Script manifest.

## Important
This is a Google Apps Script + Google Sheets application with GitHub used for private source-code version control. It is **not** a GitHub Pages app: the frontend uses `google.script.run`, which is provided by Apps Script.

Keep the GitHub repository **Private**. Do not publish the first-admin password or Apps Script OAuth credentials. The app stores salted SHA-256 password hashes; it does not display or return saved passwords.

## Setup
1. Create a new **private** GitHub repository.
2. Download/extract this project and open its folder in VS Code.
3. Install Node.js LTS and Git.
4. In a terminal run:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
5. Enable Apps Script API at https://script.google.com/home/usersettings
6. Create a new Apps Script project:
   ```bash
   clasp create --type webapp --title "Cotton Club Extended Part"
   ```
   If clasp asks for a script file, create/select the project folder.
7. Copy the generated `.clasp.json` into this project folder. Keep it local; do not commit it to a public repo.
8. Put `Code.gs`, `Index.html`, and `appsscript.json` in the Apps Script project folder. Then:
   ```bash
   clasp push
   ```
9. Open the Apps Script project at https://script.google.com, select `setupSystem` in the function dropdown, and click **Run**. Approve the Google permissions.
10. The execution result returns the database spreadsheet URL. Use the initial Admin password supplied separately with this handover.
11. Open the created Google Sheet. Add your actual machine numbers in the `Machines` sheet under `MachineNo` and set `Status` to `Active`. Or add machines later from the app's **Machines** menu.
12. In Apps Script, click **Deploy → New deployment → Web app**. Set **Execute as: Me**. Choose the access level appropriate for your organization. Deploy and open the web-app URL.

## GitHub
From the project folder:
```bash
git init
git add Code.gs Index.html appsscript.json README.md .gitignore .claspignore
git commit -m "Initial Cotton Club production app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-PRIVATE-REPO.git
git push -u origin main
```
Do not add `.clasp.json` or `.clasprc.json` to GitHub. `.clasp.json` contains the Apps Script project ID and `.clasprc.json` contains OAuth credentials.

## First login
- Username: `admin`
- Password: supplied separately with this handover.
- Immediately create a new Admin password from **User Management** after first login (edit the `admin` row and set a new password).

## Notes / current assumptions
- The supplied source was an HTML frontend only; no original `Code.gs` or spreadsheet schema was supplied. This package recreates the backend and data structure.
- The supplied frontend's production model is retained: date, machine, shift A/B/C, program number, roll slots R1–R10, weight (Kg), condition (OK / Hold up / Reject), update/delete, daily report, search, themes removed in this clean rebuild, user signup approval and user management.
- Machine numbers were not specified in the supplied Cotton Club file, so the `Machines` sheet starts empty. Add the real machine numbers before production entry.
- Staff signups are Pending until an Admin activates them.
- ViewOnly users cannot save or edit. FullAccess users can add/edit; Admin can delete.
- For a public-facing or large multi-user deployment, use Google Workspace access restrictions and review the security model with your administrator.
