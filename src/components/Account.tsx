import { useEffect, useState, type FormEvent } from 'react';
import { libraryStore, useLibrary } from '../state/library';
import { authError, authRedirectURL, PASSWORD_MIN_LENGTH, validateNewPassword } from '../services/auth';
import { LIBRARY_KEY } from '../services/storage';
import { CloseButton, Modal } from './Modal';

export function Account({ onClose }: { onClose: () => void }) {
    const { client, user, busy, loading, recovery, readError } = useLibrary();
    const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'recover'>(
        recovery ? 'recover' : 'login'
    );
    const [pending, setPending] = useState(false),
        [message, setMessage] = useState(''),
        [failure, setFailure] = useState(false);
    useEffect(() => {
        if (recovery) setMode('recover');
    }, [recovery]);
    const profile = Boolean(user) && mode !== 'recover',
        signup = mode === 'signup',
        recover = mode === 'recover',
        reset = mode === 'reset';
    let canMigrate = false;
    try {
        canMigrate = Boolean(user && localStorage.getItem(LIBRARY_KEY));
    } catch {
        /* Storage may be disabled. */
    }
    const title = profile
        ? 'My account'
        : recover
          ? 'Set a new password'
          : reset
            ? 'Reset password'
            : signup
              ? 'Create account'
              : 'Log in';
    const notice = (text = '', error = false) => {
        setMessage(text);
        setFailure(error);
    };
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!client || pending || busy || loading) return;
        const form = event.currentTarget,
            fields = new FormData(form),
            email = String(fields.get('email') || '').trim(),
            password = String(fields.get('password') || '');
        if (signup || recover) {
            const error = validateNewPassword(password);
            if (error) {
                notice(error, true);
                return;
            }
            if (password !== fields.get('repeatPassword')) {
                notice('Passwords do not match.', true);
                return;
            }
        }
        if (recover && !user) {
            notice('Open a valid password reset link from your email.', true);
            return;
        }
        setPending(true);
        notice();
        try {
            const redirectTo = authRedirectURL();
            if (reset) {
                const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
                if (error) throw error;
                notice(
                    'If an account exists, you will receive a password reset link. Check your spam folder too.'
                );
            } else if (recover) {
                const { error } = await client.auth.updateUser({ password });
                if (error) throw error;
                libraryStore.finishRecovery();
                setMode('login');
                notice('Your password has been updated.');
            } else if (signup) {
                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: redirectTo }
                });
                if (error) throw error;
                if (data.session) {
                    await libraryStore.syncSession(data.session.user);
                    notice('Your account is ready. Add your first game.');
                } else
                    notice(
                        'Check your inbox and confirm your email. If you already have an account, log in or reset your password.'
                    );
            } else {
                const { data, error } = await client.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await libraryStore.syncSession(data.user);
                onClose();
            }
        } catch (error) {
            notice(authError(error), true);
        } finally {
            const password = form.elements.namedItem('password');
            if (password instanceof HTMLInputElement) password.value = '';
            const repeat = form.elements.namedItem('repeatPassword');
            if (repeat instanceof HTMLInputElement) repeat.value = '';
            setPending(false);
        }
    }
    async function action(task: () => Promise<void>, success: string) {
        if (pending || busy || loading) {
            notice('Please wait for the current save to finish.', true);
            return;
        }
        setPending(true);
        notice();
        try {
            await task();
            notice(success);
        } catch (error) {
            notice(authError(error), true);
        } finally {
            setPending(false);
        }
    }
    return (
        <Modal label="accountTitle" className="game-dialog account-dialog" busy={pending} onClose={onClose}>
            <div className="detail-content">
                <div className="dialog-heading">
                    <div>
                        <h2 id="accountTitle">{title}</h2>
                        <p className="dialog-caption">Your space</p>
                    </div>
                    <CloseButton label="Close account" onClick={onClose} disabled={pending} />
                </div>
                <p id="accountDescription">
                    {!client
                        ? 'Accounts are not available yet. You can still use your local library in this browser.'
                        : profile
                          ? 'Your library is saved to your account.'
                          : 'Your games and notes, on every device.'}
                </p>
                <p className="account-save-status" id="accountStatus" role="status">
                    {loading
                        ? 'Checking your session…'
                        : readError
                          ? 'Unable to load your library. Try refreshing it.'
                          : user
                            ? 'Account library · changes are saved to the server'
                            : 'Your library is saved in this browser.'}
                </p>
                {client && !profile && !recover && !reset && (
                    <div className="account-tabs">
                        <button
                            className={`filter-button${!signup ? ' is-selected' : ''}`}
                            disabled={pending}
                            aria-pressed={!signup}
                            onClick={() => {
                                setMode('login');
                                notice();
                            }}
                        >
                            Log in
                        </button>
                        <button
                            className={`filter-button${signup ? ' is-selected' : ''}`}
                            disabled={pending}
                            aria-pressed={signup}
                            onClick={() => {
                                setMode('signup');
                                notice();
                            }}
                        >
                            Sign up
                        </button>
                    </div>
                )}
                {client && !profile && (
                    <form key={mode} className="auth-form" onSubmit={submit}>
                        {!recover && (
                            <label>
                                Email
                                <input
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    maxLength={254}
                                    disabled={pending || loading}
                                />
                            </label>
                        )}
                        {!reset && (
                            <label>
                                Password
                                <input
                                    name="password"
                                    type="password"
                                    autoComplete={signup || recover ? 'new-password' : 'current-password'}
                                    minLength={signup || recover ? PASSWORD_MIN_LENGTH : 1}
                                    maxLength={128}
                                    required
                                    disabled={pending || loading}
                                />
                            </label>
                        )}
                        {(signup || recover) && (
                            <>
                                <label>
                                    Confirm password
                                    <input
                                        name="repeatPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        maxLength={128}
                                        required
                                        disabled={pending || loading}
                                    />
                                </label>
                                <p className="journal-meta">
                                    At least 9 characters. Special characters are optional. Use a unique
                                    password.
                                </p>
                            </>
                        )}
                        <button className="button button-primary" disabled={pending || loading}>
                            {pending
                                ? 'Please wait…'
                                : reset
                                  ? 'Send reset link'
                                  : recover
                                    ? 'Save new password'
                                    : signup
                                      ? 'Create account'
                                      : 'Log in'}
                        </button>
                    </form>
                )}
                {client && !profile && !recover && (
                    <button
                        className="text-button"
                        disabled={pending}
                        onClick={() => {
                            setMode(reset ? 'login' : 'reset');
                            notice();
                        }}
                    >
                        {reset ? 'Back to log in' : 'Forgot password?'}
                    </button>
                )}
                {profile && (
                    <div id="accountProfile">
                        <p>{user?.email}</p>
                        <p>
                            Your account library is private. Games and journal entries are saved to the
                            server.
                        </p>
                        <button
                            className="button button-secondary"
                            disabled={pending || busy || loading}
                            onClick={() => void action(libraryStore.refresh, 'Loaded the latest library.')}
                        >
                            Refresh library
                        </button>
                        {canMigrate && (
                            <div className="migration-panel">
                                <h3>Bring your local collection</h3>
                                <p>
                                    Add games saved in this browser to your account, including covers and
                                    journals. Games already on your account will be skipped.
                                </p>
                                <button
                                    className="button button-secondary"
                                    disabled={pending || busy || loading}
                                    onClick={() =>
                                        void action(
                                            libraryStore.migrateLocal,
                                            'Local games added to your account. The local copy is still available in this browser.'
                                        )
                                    }
                                >
                                    Add local games to account
                                </button>
                            </div>
                        )}
                        <button
                            className="text-button signout-button"
                            disabled={pending || busy || loading}
                            onClick={() =>
                                void action(async () => {
                                    const { error } = await client!.auth.signOut({ scope: 'local' });
                                    if (error) throw error;
                                    await libraryStore.syncSession(null);
                                    setMode('login');
                                }, 'You are logged out. Your local library is now displayed.')
                            }
                        >
                            Log out
                        </button>
                    </div>
                )}
                {message && (
                    <p
                        className={failure ? 'form-error' : 'account-message'}
                        role={failure ? 'alert' : 'status'}
                    >
                        {message}
                    </p>
                )}
            </div>
        </Modal>
    );
}
