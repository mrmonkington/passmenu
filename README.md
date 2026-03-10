# Passmenu GNOME Extension

A GNOME Shell extension that provide a `dmenu` like search prompt for `pass` (the standard Unix password manager). It adds a fuzzy-searchable, type-ahead dialog directly into the center of your screen then launches `pass` in a subprocess in order to decrypt and place the password in the clipboard.

Also supports the `pass otp` extension and auto detects when a key contains an OTP URI.

Tested on Gnome 49 through 50+.

Written using Gemini 3.1 Pro :grimace:

## Features

- **Global Shortcut:** Press `<Super>p` to bring up the search interface anywhere.
- **Fuzzy Search:** Type multiple words (e.g. `github mark`) to match paths like `web/github.com/mark@example.com`.
- **Keyboard Navigation:** Navigate seamlessly with `Up`, `Down`, `Escape` and `Enter`.
- **Automatic OTP:** Upon copying a password, it detects if a `pass otp uri` exists. If so, it arms a 15-second window where pressing `<Super>o` will instantly retrieve the OTP token for that same entry.
- **Configurable:** Uses GNOME extension preferences to let you customize the shortcuts, the password store path, and the OTP timeout window.

---

## Installation 

### Pack the extension

```bash
gnome-extensions pack passmenu-extension/ \
    --extra-source=schemas/ \
    --force
```

### Install

```bash
gnome-extensions install -f passmenu@verynoisy.com.shell-extension.zip
```

> **Note for Wayland users:** GNOME Shell cannot restart on-the-fly under Wayland. You will need to **Log Out** and **Log In** again for the extension to be recognized by the compositor.

Once logged in, enable it via the GNOME Extensions GUI app, or via CLI:
```bash
gnome-extensions enable passmenu@verynoisy.com
```

---

## Usage
1. Press `<Super>p` to trigger the menu.
2. Type to fuzzy-search your passwords.
3. Press `Enter` to copy the password to your clipboard.
4. If an OTP URI exists for that password, a notification will tell you "You have 15s to press OTP shortcut."
5. Press `<Super>o` within the timeout window to automatically fetch and copy the OTP.

---

## Developer Guide & Hacking

If you want to modify this behavior or fix a bug, here is how the extension is structured.

### Architecture

- `metadata.json`: Defines the extension UUID (`passmenu@verynoisy.com`) and supported GNOME versions.
- `schemas/org.gnome.shell.extensions.passmenu.gschema.xml`: GSettings schema defining preference defaults (like shortcuts and `~/.pers-pass`).
- `extension.js`: Main ESM module.
  - Core logic revolves around mapping global Keybindings with `Main.wm.addKeybinding`.
  - Spawns a `ModalDialog` overlaying the desktop, adding an `St.Entry` for search and `St.ScrollView` for the list.
  - Scans `~/.password-store` (or custom path) asynchronously by piping output from the core unix utility `find`.
  - Interfaces natively with the `pass` binary utilizing `Gio.SubprocessLauncher` to inject Custom environments (`PASSWORD_STORE_DIR`).
- `prefs.js`: The settings panel utilizing newer GTK4 / Libadwaita (`Adw`) components.
- `stylesheet.css`: Custom styling providing the visual cues (like `.selected` keyboard selection states).

### Getting Started (Hack on it!)

1. **Clone/Symlink into your Extensions Directory:**
   ```bash
   # Remove any installed zip version
   rm -rf ~/.local/share/gnome-shell/extensions/passmenu@verynoisy.com
   
   # Symlink your dev directory
   ln -s /path/to/your/repo/passmenu-extension ~/.local/share/gnome-shell/extensions/passmenu@verynoisy.com
   ```

2. **Re-compile Schemas (Important!):**
   If you change the `gschema.xml`, you must compile it:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/passmenu@verynoisy.com/schemas/
   ```

3. **Applying Changes:**
   Under Wayland, the compositor locks the JS context. The best thing to do is run a nested shell using `dbus-run-session gnome-shell --devkit --wayland`, and restart that window with each change.

4. **Debugging Logs:**
   To see any `console.log()` or `console.error()` outputs, tail the journal for `gnome-shell`:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell
   ```

### Re-building the Release Zip

Once your changes are done:
```bash
gnome-extensions pack passmenu-extension/ \
    --extra-source=schemas/ \
    --force
```
