import { SUPABASE_CONFIG } from './config.js?v=20261018-2';
import { connectSupabase, friendlyError } from './cloud.js?v=20261018-2';

export const PASSWORD_MIN_LENGTH = 9;
export function validateNewPassword(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) return `Your password must have at least ${PASSWORD_MIN_LENGTH} characters. Special characters are optional.`;
    if (password.length > 128) return 'Your password can have up to 128 characters.';
    return '';
}

const authError = error => ({
    invalid_credentials: 'Invalid email or password.',
    email_not_confirmed: 'Confirm your email using the link from GameLogs.',
    user_already_exists: 'Check your inbox or log in to your existing account.',
    over_email_send_rate_limit: 'Email limit reached. Please try again later.',
    weak_password: 'Choose a password that meets the service requirements.',
    signup_disabled: 'New account registration is temporarily disabled.',
    email_address_not_authorized: 'Email registration is not yet available for this address. The administrator needs to configure email delivery.'
}[error?.code] || friendlyError(error));

export async function mountAccount({ onUserChange, onMigrate, onRefresh, canMigrate, isBusy }) {
    const button = document.getElementById('accountButton');
    const status = document.getElementById('accountStatus');
    const dialog = document.createElement('dialog');
    dialog.className = 'game-dialog account-dialog';
    dialog.id = 'accountDialog';
    dialog.setAttribute('aria-labelledby', 'accountTitle');
    dialog.innerHTML = `<div class="detail-content">
        <div class="dialog-heading"><div><p class="eyebrow">Your space</p><h2 id="accountTitle">Log in</h2></div><button class="close-button" id="closeAccount" type="button" aria-label="Close account">×</button></div>
        <p id="accountDescription">Your games and notes, on every device.</p>
        <div class="account-tabs" id="accountTabs"><button type="button" class="filter-button" data-auth-mode="login">Log in</button><button type="button" class="filter-button" data-auth-mode="signup">Sign up</button></div>
        <form id="authForm" class="auth-form">
            <label id="emailLabel">Email<input id="authEmail" name="email" type="email" autocomplete="email" required maxlength="254"></label>
            <label id="passwordLabel">Password<input id="authPassword" name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
            <label id="repeatPasswordLabel" hidden>Confirm password<input id="authRepeatPassword" name="repeatPassword" type="password" autocomplete="new-password" maxlength="128"></label>
            <p class="journal-meta" id="passwordHint" hidden>At least ${PASSWORD_MIN_LENGTH} characters. Special characters are optional. Use a unique password.</p>
            <button class="button button-primary" id="authSubmit" type="submit">Log in</button>
        </form>
        <button class="text-button" id="forgotPassword" type="button">Forgot password?</button>
        <div id="accountProfile" hidden><p id="accountEmail"></p><p>Your account library is private. Games and journal entries are saved to the server.</p>
            <button class="button button-secondary" id="refreshCloud" type="button">Refresh library</button>
            <div class="migration-panel" id="migrationPanel" hidden><h3>Bring your local collection</h3><p>Add games saved in this browser to your account, including covers and journals. Games already on your account will be skipped.</p><button class="button button-secondary" id="migrateLibrary" type="button">Add local games to account</button></div>
            <button class="text-button signout-button" id="signOut" type="button">Log out</button>
        </div>
        <p id="authMessage" role="status" hidden></p>
    </div>`;
    document.body.append(dialog);
    const el = id => document.getElementById(id);
    let client = null;
    let user = null;
    let configured = false;
    let mode = 'login';
    let authPending = false;
    let lastOwner;
    let identityQueue = Promise.resolve();
    let recoveryHandled = false;
    const recoveryLink = /(?:^|[&#])type=recovery(?:&|$)/.test(location.hash);

    function message(text = '', error = false) {
        el('authMessage').textContent = text;
        el('authMessage').hidden = !text;
        el('authMessage').className = error ? 'form-error' : 'account-message';
        el('authMessage').setAttribute('role', error ? 'alert' : 'status');
    }

    function render() {
        const profile = Boolean(user) && mode !== 'recover';
        const reset = mode === 'reset';
        const recover = mode === 'recover';
        const signup = mode === 'signup';
        el('accountTitle').textContent = profile ? 'My account' : reset ? 'Reset password' : recover ? 'Set a new password' : signup ? 'Create account' : 'Log in';
        el('accountDescription').textContent = !configured ? 'Accounts are not available yet. You can still use your local library in this browser.' : profile ? 'Your library is saved to your account.' : 'Your games and notes, on every device.';
        el('accountTabs').hidden = !configured || profile || recover || reset;
        el('authForm').hidden = !configured || profile;
        el('accountProfile').hidden = !profile;
        el('forgotPassword').hidden = !configured || profile || recover;
        el('forgotPassword').textContent = reset ? 'Back to log in' : 'Forgot password?';
        el('emailLabel').hidden = recover;
        el('authEmail').required = !recover;
        el('authEmail').disabled = recover;
        el('passwordLabel').hidden = reset;
        el('authPassword').required = !reset;
        el('authPassword').disabled = reset;
        el('authPassword').minLength = signup || recover ? PASSWORD_MIN_LENGTH : 1;
        el('authPassword').autocomplete = signup || recover ? 'new-password' : 'current-password';
        el('repeatPasswordLabel').hidden = !(signup || recover);
        el('authRepeatPassword').required = signup || recover;
        el('authRepeatPassword').disabled = !(signup || recover);
        el('passwordHint').hidden = !(signup || recover);
        el('authSubmit').textContent = reset ? 'Send reset link' : recover ? 'Save new password' : signup ? 'Create account' : 'Log in';
        el('accountEmail').textContent = user?.email || '';
        el('migrationPanel').hidden = !profile || !canMigrate();
        button.textContent = user ? 'My account' : 'Log in';
        dialog.querySelectorAll('[data-auth-mode]').forEach(item => {
            item.classList.toggle('is-selected', item.dataset.authMode === mode);
            item.setAttribute('aria-pressed', String(item.dataset.authMode === mode));
        });
    }

    const setMode = next => {
        mode = next;
        el('authPassword').value = '';
        el('authRepeatPassword').value = '';
        message();
        render();
    };
    const queueIdentity = (session, event) => {
        identityQueue = identityQueue.catch(() => {}).then(async () => {
            const nextUser = session?.user || null;
            if ((event === 'PASSWORD_RECOVERY' || (recoveryLink && !recoveryHandled)) && nextUser) {
                recoveryHandled = true;
                setMode('recover');
                if (!dialog.open) dialog.showModal();
            }
            const nextOwner = nextUser?.id || null;
            if (nextOwner === lastOwner) return;
            lastOwner = nextOwner;
            user = nextUser;
            render();
            status.textContent = user ? 'Loading your private library…' : 'Local mode · saved in this browser';
            try {
                await onUserChange(user, client);
                status.textContent = user ? 'Account library · changes are saved to the server' : 'Local mode · log in to save to your account';
            } catch (error) {
                status.textContent = 'Unable to load your account library. Open My account and try refreshing it.';
                message(friendlyError(error), true);
            }
            render();
        });
        return identityQueue;
    };

    button.addEventListener('click', () => { if (mode !== 'recover') setMode(user ? 'profile' : 'login'); render(); dialog.showModal(); });
    el('closeAccount').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { el('authPassword').value = ''; el('authRepeatPassword').value = ''; });
    dialog.querySelectorAll('[data-auth-mode]').forEach(item => item.addEventListener('click', () => { if (!authPending) setMode(item.dataset.authMode); }));
    el('forgotPassword').addEventListener('click', () => { if (!authPending) setMode(mode === 'reset' ? 'login' : 'reset'); });
    el('authForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!client || authPending || !event.target.reportValidity()) return;
        const email = el('authEmail').value.trim();
        const password = el('authPassword').value;
        if (mode === 'signup' || mode === 'recover') {
            const passwordError = validateNewPassword(password);
            if (passwordError) { message(passwordError, true); return; }
        }
        if ((mode === 'signup' || mode === 'recover') && password !== el('authRepeatPassword').value) { message('Passwords do not match.', true); return; }
        if (mode === 'recover' && !user) { message('Open a valid password reset link from your email.', true); return; }
        authPending = true;
        el('authSubmit').disabled = true;
        message();
        // Keep the existing allow-listed callback at the site root, even from nested pages.
        const redirectTo = new URL('index.html', import.meta.url).href;
        try {
            if (mode === 'reset') {
                const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
                if (error) throw error;
                message('If an account exists, you will receive a password reset link. Check your spam folder too.');
            } else if (mode === 'recover') {
                const { error } = await client.auth.updateUser({ password });
                if (error) throw error;
                setMode('profile');
                message('Your password has been updated.');
            } else if (mode === 'signup') {
                const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
                if (error) throw error;
                if (data.session) { await queueIdentity(data.session, 'SIGNED_IN'); setMode('profile'); message('Your account is ready. Add your first game.'); }
                else message('Check your inbox and confirm your email. If you already have an account, log in or reset your password.');
            } else {
                const { data, error } = await client.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await queueIdentity(data.session, 'SIGNED_IN');
                setMode('profile');
                dialog.close();
            }
        } catch (error) { message(authError(error), true); }
        finally { authPending = false; el('authSubmit').disabled = false; el('authPassword').value = ''; el('authRepeatPassword').value = ''; }
    });

    async function runAccountAction(buttonId, action, success) {
        if (authPending || isBusy()) { message('Please wait for the current save to finish.', true); return; }
        authPending = true;
        el(buttonId).disabled = true;
        message();
        try { await action(); message(success); }
        catch (error) { message(authError(error), true); }
        finally { authPending = false; el(buttonId).disabled = false; render(); }
    }
    el('refreshCloud').addEventListener('click', () => runAccountAction('refreshCloud', async () => { await onRefresh(); status.textContent = 'Your account library is up to date'; }, 'Loaded the latest library.'));
    el('migrateLibrary').addEventListener('click', () => runAccountAction('migrateLibrary', onMigrate, 'Local games added to your account. The local copy is still available in this browser.'));
    el('signOut').addEventListener('click', () => runAccountAction('signOut', async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        await queueIdentity(null, 'SIGNED_OUT');
        setMode('login');
    }, 'You are logged out. Your local library is now displayed.'));

    render();
    try {
        client = await connectSupabase(SUPABASE_CONFIG);
        configured = Boolean(client);
        if (!client) { await onUserChange(null, null); render(); return; }
        status.textContent = 'Checking your session…';
        client.auth.onAuthStateChange((event, session) => {
            // No awaited Supabase calls inside its auth lock.
            setTimeout(() => { queueIdentity(session, event).catch(error => message(friendlyError(error), true)); }, 0);
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        await queueIdentity(data.session, 'INITIAL_SESSION');
        render();
    } catch (error) {
        status.textContent = 'Unable to connect to accounts. Please refresh the page and try again.';
        message(authError(error), true);
        render();
        await onUserChange(null, null, error);
    }
}
