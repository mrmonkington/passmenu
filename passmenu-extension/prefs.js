import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PassmenuPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let settings = this.getSettings();

        // Create a preferences page
        let page = new Adw.PreferencesPage();
        window.add(page);

        // Create a basic preferences group
        let group = new Adw.PreferencesGroup({ title: 'Passmenu Settings' });
        page.add(group);

        // 1. Password store directory
        let storeDirRow = new Adw.EntryRow({
            title: 'Password Store Directory',
            text: settings.get_string('password-store-dir'),
            show_apply_button: true,
        });

        storeDirRow.connect('apply', () => {
            settings.set_string('password-store-dir', storeDirRow.get_text());
        });
        group.add(storeDirRow);

        // 2. Pass shortcut
        let passShortcutRow = new Adw.EntryRow({
            title: 'Pass Shortcut',
            text: settings.get_strv('pass-shortcut')[0] || '<Super>p',
            show_apply_button: true,
        });

        passShortcutRow.connect('apply', () => {
            settings.set_strv('pass-shortcut', [passShortcutRow.get_text()]);
        });
        group.add(passShortcutRow);

        // 3. OTP shortcut
        let otpShortcutRow = new Adw.EntryRow({
            title: 'OTP Shortcut',
            text: settings.get_strv('otp-shortcut')[0] || '<Super>o',
            show_apply_button: true,
        });

        otpShortcutRow.connect('apply', () => {
            settings.set_strv('otp-shortcut', [otpShortcutRow.get_text()]);
        });
        group.add(otpShortcutRow);

        // 4. OTP duration
        let otpTimeoutRow = new Adw.SpinRow({
            title: 'OTP Window (seconds)',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 300,
                step_increment: 1,
                value: settings.get_int('otp-window-seconds')
            })
        });

        otpTimeoutRow.connect('notify::value', () => {
            settings.set_int('otp-window-seconds', otpTimeoutRow.get_value());
        });
        group.add(otpTimeoutRow);
    }
}
