/**
 * Firebase Auth client-side handler.
 * Handles sign-in, cookie management, and token refresh.
 */

// Initialize Firebase (config is set globally by the template)
if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);
}

async function onSignInSuccess(user) {
    const token = await user.getIdToken();
    document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
    window.location.href = '/dashboard';
}

function showLoginError(message) {
    const el = document.getElementById('loginError');
    if (el) {
        el.textContent = message;
        el.classList.remove('d-none');
    }
}

// Email/password sign-in
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            await onSignInSuccess(result.user);
        } catch (error) {
            showLoginError(error.message);
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });
}

// Google sign-in
const googleBtn = document.getElementById('googleSignIn');
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await firebase.auth().signInWithPopup(provider);
            await onSignInSuccess(result.user);
        } catch (error) {
            showLoginError(error.message);
        }
    });
}

// Sign out
async function signOut() {
    try {
        await firebase.auth().signOut();
    } catch (e) {
        // ignore
    }
    document.cookie = '__session=; path=/; max-age=0';
    window.location.href = '/login';
}

// Token refresh every 50 minutes
setInterval(async () => {
    const user = firebase.auth().currentUser;
    if (user) {
        try {
            const token = await user.getIdToken(true);
            document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
        } catch (e) {
            console.warn('Token refresh failed:', e);
        }
    }
}, 50 * 60 * 1000);
