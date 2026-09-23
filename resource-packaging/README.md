# Panel-owned resource packaging

These build inputs belong to `fiveiso-panel`; they are not part of the FiveM source resource or a public download directory.

`npm run build:release` builds the panel, bundles the resource NUI through Vite, obfuscates JavaScript, encodes Lua, and writes the private `dist/resource-template.json`. Server-side package creation encrypts the runtime with AES-256-GCM and adds the server-specific license configuration before producing the authenticated ZIP download.

Customers download using **FiveISO indir** in their panel. Updating a package preserves its license identity, encryption key, agent token and machine binding. The new runtime takes effect after installation and resource restart. Existing configuration is preserved by the installer.

The ZIP includes the `fiveiso` resource, installation scripts and instructions. It never includes this directory, the source repository, source maps or the private template. `database-config.lua` and the generated `license.json` stay readable. `fxmanifest.lua` is runtime metadata. The runtime key is not included in the archive; the licensed server obtains it from the panel.
