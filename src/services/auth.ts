import { friendlyError } from './cloud';
export const PASSWORD_MIN_LENGTH = 9;
export function validateNewPassword(password: string): string {
    if (password.length < PASSWORD_MIN_LENGTH)
        return `Your password must have at least ${PASSWORD_MIN_LENGTH} characters. Special characters are optional.`;
    return password.length > 128 ? 'Your password can have up to 128 characters.' : '';
}
export function authError(error: unknown): string {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const messages: Record<string, string> = {
        invalid_credentials: 'Invalid email or password.',
        email_not_confirmed: 'Confirm your email using the link from GameLogs.',
        user_already_exists: 'Check your inbox or log in to your existing account.',
        over_email_send_rate_limit: 'Email limit reached. Please try again later.',
        weak_password: 'Choose a password that meets the service requirements.',
        signup_disabled: 'New account registration is temporarily disabled.',
        email_address_not_authorized:
            'Email registration is not yet available for this address. The administrator needs to configure email delivery.'
    };
    return messages[code] || friendlyError(error);
}
export const authRedirectURL = (): string => new URL('/index.html', location.origin).href;
