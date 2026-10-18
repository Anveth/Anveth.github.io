import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSWORD_MIN_LENGTH, validateNewPassword } from '../account.js';

test('new passwords require 9 characters, not 10, without mandatory special characters', () => {
    assert.equal(PASSWORD_MIN_LENGTH, 9);
    assert.equal(validateNewPassword('abcdefghi'), '');
    assert.equal(validateNewPassword('Abc123def'), '');
    assert.equal(validateNewPassword('Haslo123!'), '');
    assert.match(validateNewPassword('abcdefgh'), /at least 9/);
    assert.match(validateNewPassword('x'.repeat(129)), /128/);
});
