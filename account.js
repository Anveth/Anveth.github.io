import { SUPABASE_CONFIG } from './config.js?v=20261016-6';
import { connectSupabase, friendlyError } from './cloud.js?v=20261016-6';

const authError = error => ({
    invalid_credentials: 'Nieprawidłowy e-mail lub hasło.',
    email_not_confirmed: 'Potwierdź adres e-mail, klikając link w wiadomości od GameLogs.',
    user_already_exists: 'Sprawdź skrzynkę pocztową lub zaloguj się do istniejącego konta.',
    over_email_send_rate_limit: 'Limit wiadomości został osiągnięty. Spróbuj później.',
    weak_password: 'Wybierz silniejsze hasło, zgodne z wymaganiami usługi.',
    signup_disabled: 'Rejestracja nowych kont jest chwilowo wyłączona.',
    email_address_not_authorized: 'Rejestracja e-mail nie jest jeszcze gotowa dla tego adresu. Administrator musi skonfigurować wysyłkę wiadomości.'
}[error?.code] || friendlyError(error));

export async function mountAccount({ onUserChange, onMigrate, onRefresh, canMigrate, isBusy }) {
    const button = document.getElementById('accountButton');
    const status = document.getElementById('accountStatus');
    const dialog = document.createElement('dialog');
    dialog.className = 'game-dialog account-dialog';
    dialog.id = 'accountDialog';
    dialog.setAttribute('aria-labelledby', 'accountTitle');
    dialog.innerHTML = `<div class="detail-content">
        <div class="dialog-heading"><div><p class="eyebrow">Twoja przestrzeń</p><h2 id="accountTitle">Zaloguj się</h2></div><button class="close-button" id="closeAccount" type="button" aria-label="Zamknij konto">×</button></div>
        <p id="accountDescription">Twoje gry i notatki, dostępne na każdym urządzeniu.</p>
        <div class="account-tabs" id="accountTabs"><button type="button" class="filter-button" data-auth-mode="login">Logowanie</button><button type="button" class="filter-button" data-auth-mode="signup">Rejestracja</button></div>
        <form id="authForm" class="auth-form">
            <label id="emailLabel">E-mail<input id="authEmail" name="email" type="email" autocomplete="email" required maxlength="254"></label>
            <label id="passwordLabel">Hasło<input id="authPassword" name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
            <label id="repeatPasswordLabel" hidden>Powtórz hasło<input id="authRepeatPassword" name="repeatPassword" type="password" autocomplete="new-password" maxlength="128"></label>
            <p class="journal-meta" id="passwordHint" hidden>Co najmniej 10 znaków. Użyj unikalnego hasła.</p>
            <button class="button button-primary" id="authSubmit" type="submit">Zaloguj się</button>
        </form>
        <button class="text-button" id="forgotPassword" type="button">Nie pamiętam hasła</button>
        <div id="accountProfile" hidden><p id="accountEmail"></p><p>Biblioteka tego konta jest prywatna. Gry i sesje zapisują się na serwerze.</p>
            <button class="button button-secondary" id="refreshCloud" type="button">Odśwież bibliotekę</button>
            <div class="migration-panel" id="migrationPanel" hidden><h3>Przenieś lokalną kolekcję</h3><p>Dodaj do konta gry zapisane wcześniej w tej przeglądarce, razem z okładkami i dziennikami. Gry o identyfikatorach już istniejących na koncie zostaną pominięte.</p><button class="button button-secondary" id="migrateLibrary" type="button">Dodaj lokalne gry do konta</button></div>
            <button class="text-button signout-button" id="signOut" type="button">Wyloguj się</button>
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
        el('accountTitle').textContent = profile ? 'Moje konto' : reset ? 'Odzyskaj dostęp' : recover ? 'Ustaw nowe hasło' : signup ? 'Utwórz konto' : 'Zaloguj się';
        el('accountDescription').textContent = !configured ? 'Konta nie są jeszcze uruchomione. Możesz nadal korzystać z lokalnej biblioteki w tej przeglądarce.' : profile ? 'Twoja biblioteka zapisuje się na Twoim koncie.' : 'Twoje gry i notatki, dostępne na każdym urządzeniu.';
        el('accountTabs').hidden = !configured || profile || recover || reset;
        el('authForm').hidden = !configured || profile;
        el('accountProfile').hidden = !profile;
        el('forgotPassword').hidden = !configured || profile || recover;
        el('forgotPassword').textContent = reset ? 'Wróć do logowania' : 'Nie pamiętam hasła';
        el('emailLabel').hidden = recover;
        el('authEmail').required = !recover;
        el('authEmail').disabled = recover;
        el('passwordLabel').hidden = reset;
        el('authPassword').required = !reset;
        el('authPassword').disabled = reset;
        el('authPassword').minLength = signup || recover ? 10 : 1;
        el('authPassword').autocomplete = signup || recover ? 'new-password' : 'current-password';
        el('repeatPasswordLabel').hidden = !(signup || recover);
        el('authRepeatPassword').required = signup || recover;
        el('authRepeatPassword').disabled = !(signup || recover);
        el('passwordHint').hidden = !(signup || recover);
        el('authSubmit').textContent = reset ? 'Wyślij link do zmiany hasła' : recover ? 'Zapisz nowe hasło' : signup ? 'Utwórz konto' : 'Zaloguj się';
        el('accountEmail').textContent = user?.email || '';
        el('migrationPanel').hidden = !profile || !canMigrate();
        button.textContent = user ? 'Moje konto' : 'Zaloguj się';
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
            status.textContent = user ? 'Wczytywanie prywatnej biblioteki…' : 'Tryb lokalny · dane zapisane w tej przeglądarce';
            try {
                await onUserChange(user, client);
                status.textContent = user ? 'Biblioteka na Twoim koncie · zmiany zapisują się na serwerze' : 'Tryb lokalny · zaloguj się, aby zapisywać na koncie';
            } catch (error) {
                status.textContent = 'Nie udało się wczytać biblioteki konta. Otwórz Moje konto i spróbuj odświeżyć.';
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
        if ((mode === 'signup' || mode === 'recover') && password !== el('authRepeatPassword').value) { message('Hasła nie są identyczne.', true); return; }
        if (mode === 'recover' && !user) { message('Otwórz ważny link do odzyskiwania hasła z wiadomości e-mail.', true); return; }
        authPending = true;
        el('authSubmit').disabled = true;
        message();
        const redirectTo = new URL('index.html', location.href).href;
        try {
            if (mode === 'reset') {
                const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
                if (error) throw error;
                message('Jeżeli konto istnieje, otrzymasz wiadomość z linkiem do zmiany hasła. Sprawdź też spam.');
            } else if (mode === 'recover') {
                const { error } = await client.auth.updateUser({ password });
                if (error) throw error;
                setMode('profile');
                message('Hasło zostało zmienione.');
            } else if (mode === 'signup') {
                const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
                if (error) throw error;
                if (data.session) { await queueIdentity(data.session, 'SIGNED_IN'); setMode('profile'); message('Konto jest gotowe. Dodaj pierwszą grę.'); }
                else message('Sprawdź skrzynkę pocztową i potwierdź adres e-mail. Jeżeli konto już istnieje, zaloguj się lub odzyskaj hasło.');
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
        if (authPending || isBusy()) { message('Poczekaj na zakończenie bieżącego zapisu.', true); return; }
        authPending = true;
        el(buttonId).disabled = true;
        message();
        try { await action(); message(success); }
        catch (error) { message(authError(error), true); }
        finally { authPending = false; el(buttonId).disabled = false; render(); }
    }
    el('refreshCloud').addEventListener('click', () => runAccountAction('refreshCloud', async () => { await onRefresh(); status.textContent = 'Biblioteka konta jest aktualna'; }, 'Wczytano aktualną bibliotekę.'));
    el('migrateLibrary').addEventListener('click', () => runAccountAction('migrateLibrary', onMigrate, 'Dodano lokalne gry do konta. Lokalna kopia pozostała w tej przeglądarce.'));
    el('signOut').addEventListener('click', () => runAccountAction('signOut', async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        await queueIdentity(null, 'SIGNED_OUT');
        setMode('login');
    }, 'Wylogowano. Wyświetlana jest teraz lokalna biblioteka.'));

    render();
    try {
        client = await connectSupabase(SUPABASE_CONFIG);
        configured = Boolean(client);
        if (!client) { await onUserChange(null, null); render(); return; }
        status.textContent = 'Sprawdzanie sesji konta…';
        client.auth.onAuthStateChange((event, session) => {
            // No awaited Supabase calls inside its auth lock.
            setTimeout(() => { queueIdentity(session, event).catch(error => message(friendlyError(error), true)); }, 0);
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        await queueIdentity(data.session, 'INITIAL_SESSION');
        render();
    } catch (error) {
        status.textContent = 'Połączenie z kontami jest niedostępne. Spróbuj odświeżyć stronę.';
        message(authError(error), true);
        render();
        await onUserChange(null, null, error);
    }
}
