import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AuthScreen } from './AuthScreen';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
}));

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders sign in view by default', () => {
    render(<AuthScreen />);

    expect(screen.getByRole('heading', { level: 2, name: 'Welcome Back' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  });

  it('shows error if submitting empty credentials on sign in', async () => {
    render(<AuthScreen />);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter both email and password.')).toBeInTheDocument();
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('calls signInWithEmailAndPassword with trimmed email and password', async () => {
    (signInWithEmailAndPassword as any).mockResolvedValueOnce({ user: { uid: 'user-1' } });

    render(<AuthScreen />);

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: '  hop@example.com  ' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secretpass' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'hop@example.com',
        'secretpass'
      );
    });
  });

  it('switches between sign in and register modes', () => {
    render(<AuthScreen />);

    const toggleBtn = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByRole('heading', { level: 2, name: 'Create an Account' })).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();

    const switchBackBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(switchBackBtn);

    expect(screen.getByRole('heading', { level: 2, name: 'Welcome Back' })).toBeInTheDocument();
  });

  it('validates required fields and password matching in registration mode', async () => {
    render(<AuthScreen />);

    // Switch to register mode
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    const submitBtn = screen.getByRole('button', { name: /register/i });

    // 1. Missing first / last name
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'abcdef' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter both your first and last name.')).toBeInTheDocument();

    // 2. Passwords mismatch
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();

    // 3. Password too short (< 6 chars)
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '123' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Password must be at least 6 characters.')).toBeInTheDocument();
  });

  it('creates user and updates profile on valid registration submission', async () => {
    const mockCreatedUser = { uid: 'new-user-1' };
    (createUserWithEmailAndPassword as any).mockResolvedValueOnce({ user: mockCreatedUser });
    (updateProfile as any).mockResolvedValueOnce(undefined);

    render(<AuthScreen />);

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Brewer' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'john@craft.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'securePass123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'securePass123' } });

    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'john@craft.com',
        'securePass123'
      );
      expect(updateProfile).toHaveBeenCalledWith(mockCreatedUser, {
        displayName: 'John Brewer',
      });
    });
  });

  describe('Firebase error code mapping', () => {
    const testCases = [
      { code: 'auth/email-already-in-use', message: 'This email address is already in use by another account.' },
      { code: 'auth/invalid-email', message: 'The email address is invalid.' },
      { code: 'auth/operation-not-allowed', message: 'Email/password accounts are not enabled. Contact admin.' },
      { code: 'auth/weak-password', message: 'The password is too weak. Please use a stronger password.' },
      { code: 'auth/user-disabled', message: 'This user account has been disabled.' },
      { code: 'auth/invalid-credential', message: 'Invalid email or password. Please try again.' },
      { code: 'auth/user-not-found', message: 'Invalid email or password. Please try again.' },
      { code: 'auth/wrong-password', message: 'Invalid email or password. Please try again.' },
    ];

    testCases.forEach(({ code, message }) => {
      it(`translates ${code} to "${message}"`, async () => {
        (signInWithEmailAndPassword as any).mockRejectedValueOnce({ code });

        render(<AuthScreen />);

        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@keg.com' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        expect(await screen.findByText(message)).toBeInTheDocument();
      });
    });

    it('falls back to error message if code is unknown', async () => {
      (signInWithEmailAndPassword as any).mockRejectedValueOnce({
        code: 'auth/network-request-failed',
        message: 'Network connection lost.',
      });

      render(<AuthScreen />);

      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@keg.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Network connection lost.')).toBeInTheDocument();
    });
  });
});
