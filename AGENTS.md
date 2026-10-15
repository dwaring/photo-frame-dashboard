# Personal dashboard project

Read PROJECT.md first. Target is an Android tablet running the web dashboard
independently in kiosk mode, without an always-on Mac or home server. The Mac
is the development environment. Device flashing remains outside scope.
Use localhost binding for local development. Do not invoke native browser automation to launch the app;
provide its URL and the standalone launcher. Keep personal data and credentials
out of commits. Browser configuration must never contain service secrets.
Clearly distinguish demo data, configured channels, and working integrations.
Build the dashboard after source changes. Keep upstream separate from the fork.
