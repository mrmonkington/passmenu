import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const PassmenuDialog = GObject.registerClass(
    class PassmenuDialog extends ModalDialog.ModalDialog {
        _init(settings, onSelected) {
            super._init({ styleClass: 'passmenu-dialog' });
            this._settings = settings;
            this._onSelected = onSelected;

            // Search entry
            this._entry = new St.Entry({
                style_class: 'passmenu-entry',
                hint_text: 'Search passwords...',
                can_focus: true,
                track_hover: true,
                x_expand: true,
            });
            this._entry.clutter_text.connect('text-changed', this._onTextChanged.bind(this));
            this._entry.clutter_text.connect('key-press-event', this._onKeyPress.bind(this));

            this.contentLayout.add_child(this._entry);

            // Results list
            this._scrollView = new St.ScrollView({
                style_class: 'passmenu-scroll-view',
                hscrollbar_policy: St.PolicyType.NEVER,
                vscrollbar_policy: St.PolicyType.AUTOMATIC,
                x_expand: true,
                y_expand: true,
            });

            this._list = new St.BoxLayout({
                vertical: true,
                style_class: 'passmenu-list',
                x_expand: true,
            });

            this._scrollView.set_child(this._list);
            this.contentLayout.add_child(this._scrollView);

            this._passwords = [];
            this._filteredPasswords = [];
            this._selectedIndex = -1;
            this._items = [];

            this._loadPasswordsAsync();
        }

        _loadPasswordsAsync() {
            let storeDirStr = this._settings.get_string('password-store-dir');
            if (storeDirStr.startsWith('~/')) {
                storeDirStr = GLib.get_home_dir() + storeDirStr.slice(1);
            }

            let storeDir = Gio.File.new_for_path(storeDirStr);
            let prefixStr = storeDir.get_path();

            let proc = Gio.Subprocess.new(['find', prefixStr, '-type', 'f', '-name', '*.gpg'], Gio.SubprocessFlags.STDOUT_PIPE);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout] = proc.communicate_utf8_finish(res);
                    if (stdout) {
                        let files = stdout.split('\n').filter(s => s.length > 0);
                        this._passwords = files.map(f => {
                            let relPath = f.substring(prefixStr.length + 1);
                            return relPath.substring(0, relPath.length - 4); // remove .gpg
                        });
                        this._updateList();
                    }
                } catch (e) {
                    console.error(`Error finding passwords: ${e.message}`);
                }
            });
        }

        _updateList() {
            this._list.destroy_all_children();
            this._items = [];

            let searchText = this._entry.get_text().toLowerCase();
            let searchTerms = searchText.split(/\s+/).filter(t => t.length > 0);

            this._filteredPasswords = this._passwords.filter(p => {
                let pLower = p.toLowerCase();
                return searchTerms.every(term => pLower.includes(term));
            });

            // Limit to 50 results to prevent UI freeze
            let displayPasswords = this._filteredPasswords.slice(0, 50);

            for (let i = 0; i < displayPasswords.length; i++) {
                let p = displayPasswords[i];
                let item = new St.Button({
                    style_class: 'passmenu-item',
                    label: p,
                    x_expand: true,
                    x_align: Clutter.ActorAlign.START,
                    can_focus: true,
                });

                item.connect('clicked', () => {
                    this._selectItem(p);
                });

                this._list.add_child(item);
                this._items.push(item);
            }

            if (this._items.length > 0) {
                this._setSelectedIndex(0);
            } else {
                this._setSelectedIndex(-1);
            }
        }

        _onTextChanged() {
            this._updateList();
        }

        _setSelectedIndex(index) {
            if (this._selectedIndex >= 0 && this._selectedIndex < this._items.length) {
                this._items[this._selectedIndex].remove_style_pseudo_class('selected');
                this._items[this._selectedIndex].remove_style_class_name('selected');
            }

            this._selectedIndex = index;

            if (this._selectedIndex >= 0 && this._selectedIndex < this._items.length) {
                let item = this._items[this._selectedIndex];
                item.add_style_pseudo_class('selected');

                // Also give it key focus so arrow keys work naturally if St translates them, 
                // but we might want to keep focus on entry. Actually, setting hover state might be better
                // for visual feedback if 'selected' pseudo class isn't defined in the theme.
                item.add_style_class_name('selected'); // Add actual CSS class just in case pseudo class doesn't render

                // Ensure visible in scrollview (simple approximation)
                let box = item.get_allocation_box();
                let y = box.y1;
                let themeNode = this._scrollView.get_theme_node();
                let yOffset = themeNode.get_padding(St.Side.TOP);

                // Use set_value on adjustment to scroll
                let vscroll = this._scrollView.vscroll;
                if (vscroll && vscroll.adjustment) {
                    vscroll.adjustment.set_value(Math.max(0, y - yOffset - 100)); // Try to keep it somewhat centered
                }
            }
        }

        _onKeyPress(actor, event) {
            let key = event.get_key_symbol();

            if (key === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            } else if (key === Clutter.KEY_Down) {
                if (this._selectedIndex < this._items.length - 1) {
                    this._setSelectedIndex(this._selectedIndex + 1);
                }
                return Clutter.EVENT_STOP;
            } else if (key === Clutter.KEY_Up) {
                if (this._selectedIndex > 0) {
                    this._setSelectedIndex(this._selectedIndex - 1);
                }
                return Clutter.EVENT_STOP;
            } else if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
                if (this._selectedIndex >= 0 && this._selectedIndex < this._filteredPasswords.length) {
                    this._selectItem(this._filteredPasswords[this._selectedIndex]);
                }
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        }

        _selectItem(passwordObj) {
            this.close();
            if (this._onSelected) {
                this._onSelected(passwordObj);
            }
        }

        open() {
            super.open();
            this._entry.grab_key_focus();
        }
    });

export default class PassmenuExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._dialog = null;
        this._otpTimeoutId = null;
        this._lastPassword = null;

        Main.wm.addKeybinding(
            'pass-shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            this._showDialog.bind(this)
        );

        // We do not map otp-shortcut via Main.wm.addKeybinding globally initially, 
        // to avoid conflicts. Or we can just map it normally and only act if armed.
        // Let's map it normally and only act when armed.
        Main.wm.addKeybinding(
            'otp-shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            this._onOtpShortcut.bind(this)
        );
    }

    disable() {
        Main.wm.removeKeybinding('pass-shortcut');
        Main.wm.removeKeybinding('otp-shortcut');

        if (this._dialog) {
            this._dialog.destroy();
            this._dialog = null;
        }

        if (this._otpTimeoutId) {
            GLib.source_remove(this._otpTimeoutId);
            this._otpTimeoutId = null;
        }

        this._settings = null;
        this._lastPassword = null;
    }

    _showDialog() {
        if (this._dialog) {
            this._dialog.destroy();
        }

        this._dialog = new PassmenuDialog(this._settings, this._onPasswordSelected.bind(this));
        this._dialog.open();
    }

    _onPasswordSelected(password) {
        // Run pass -c
        let storeDirStr = this._settings.get_string('password-store-dir');
        if (storeDirStr.startsWith('~/')) {
            storeDirStr = GLib.get_home_dir() + storeDirStr.slice(1);
        }

        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.NONE
            });
            let env = GLib.get_environ();
            env = GLib.environ_setenv(env, 'PASSWORD_STORE_DIR', storeDirStr, true);
            launcher.set_environ(env);

            let proc = launcher.spawnv(['pass', '-c', password]);
            proc.wait_async(null, (proc, res) => {
                proc.wait_finish(res);
                this._checkAndArmOtp(password, storeDirStr);
            });
        } catch (e) {
            Main.notify("Passmenu Error", `Failed to run pass: ${e.message}`);
        }
    }

    _checkAndArmOtp(password, storeDirStr) {
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            let env = GLib.get_environ();
            env = GLib.environ_setenv(env, 'PASSWORD_STORE_DIR', storeDirStr, true);
            launcher.set_environ(env);

            let proc = launcher.spawnv(['pass', 'otp', 'uri', password]);
            proc.wait_async(null, (proc, res) => {
                proc.wait_finish(res);
                if (proc.get_successful()) {
                    this._armOtp(password);
                } else {
                    Main.notify("Passmenu", "Copied password.");
                }
            });
        } catch (e) {
            Main.notify("Passmenu", "Copied password.");
        }
    }

    _armOtp(password) {
        this._lastPassword = password;

        let seconds = this._settings.get_int('otp-window-seconds');

        Main.notify("Passmenu", `Copied password. You have ${seconds}s to press OTP shortcut.`);

        if (this._otpTimeoutId) {
            GLib.source_remove(this._otpTimeoutId);
        }

        this._otpTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._lastPassword = null;
            this._otpTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onOtpShortcut() {
        if (!this._lastPassword) return; // not armed

        let password = this._lastPassword;
        this._lastPassword = null; // disarm

        if (this._otpTimeoutId) {
            GLib.source_remove(this._otpTimeoutId);
            this._otpTimeoutId = null;
        }

        let storeDirStr = this._settings.get_string('password-store-dir');
        if (storeDirStr.startsWith('~/')) {
            storeDirStr = GLib.get_home_dir() + storeDirStr.slice(1);
        }

        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.NONE
            });
            let env = GLib.get_environ();
            env = GLib.environ_setenv(env, 'PASSWORD_STORE_DIR', storeDirStr, true);
            launcher.set_environ(env);

            let proc = launcher.spawnv(['pass', 'otp', '-c', password]);
            proc.wait_async(null, (proc, res) => {
                proc.wait_finish(res);
                Main.notify("Passmenu", "Copied OTP.");
            });
        } catch (e) {
            Main.notify("Passmenu Error", `Failed to run pass otp: ${e.message}`);
        }
    }
}
