# Google Apps Script Integration Notes

## Official implementation findings

Google Apps Script web applications require a `doGet(e)` or `doPost(e)` entry point and return an HTML or text output. For a programmatic booking integration, HTTP POST calls reach `doPost(e)` and the request body is available through `e.postData.contents`. Deployment is performed in the Apps Script project through **Deploy → New deployment → Web app**. The execution identity matters: an app deployed to execute as the owner runs with that owner’s authorization, so the endpoint must validate a private shared secret server-side and never expose OAuth tokens to the browser.

Google’s Apps Script reference documents `Sheet.appendRow(rowContents)` for appending structured records to a spreadsheet. The booking integration should use an idempotency key (the salon booking reference) before writing any row, then create/update the corresponding calendar event. The endpoint should return structured JSON identifying successful spreadsheet and calendar operations; the salon backend should record remote IDs and surface a non-sensitive synchronization error to the administrator when either operation fails.

Google’s trigger guidance confirms that `doPost(e)` handles HTTP POST to a web app and is not subject to the authorization restrictions applied to simple triggers. Calendar checks and event changes must execute under an account authorized for the target calendar.

## Sources

1. [Google Apps Script: Web Apps](https://developers.google.com/apps-script/guides/web), accessed 13 August 2026.
2. [Google Apps Script: Simple Triggers](https://developers.google.com/apps-script/guides/triggers), accessed 13 August 2026.
3. [Google Apps Script: `Sheet` reference](https://developers.google.com/apps-script/reference/spreadsheet/sheet), accessed 13 August 2026.
