import {
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    signInWithCredential
} from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Returns the current extension origin (e.g. chrome-extension://<id>)
 * which is needed in Firebase Console > Authentication > Settings > Authorized Domains
 */
export const getExtensionOrigin = () => {
    if (typeof window !== 'undefined' && window.location?.origin?.startsWith('chrome-extension://')) {
        return window.location.origin;
    }
    const id = typeof window !== 'undefined' ? window.chrome?.runtime?.id : null;
    return id ? `chrome-extension://${id}` : 'chrome-extension://<your-extension-id>';
};

/**
 * Sign in with Google using chrome.identity.launchWebAuthFlow.
 * This is the ONLY approach that works in Manifest V3 extensions —
 * signInWithPopup is permanently broken because it tries to inject
 * https://apis.google.com/js/api.js which MV3 script-src blocks.
 * 
 * SETUP REQUIRED (one-time):
 * 1. Go to https://console.cloud.google.com/apis/credentials?project=landing-page-efde6
 * 2. Find the OAuth 2.0 Web Client used by Firebase (name contains "Web client")
 * 3. Under "Authorized redirect URIs", add:
 *    https://agpepcpffpohajgcdofgmiegnmdffhmk.chromiumapp.org/
 * 4. Save
 */
export const signInWithGoogle = async () => {
    // ⚠️ Replace this with the OAuth 2.0 Web Client ID you created in Google Cloud Console
    // Go to: https://console.cloud.google.com/apis/credentials?project=landing-page-efde6
    // Create a new OAuth 2.0 Web Application client, add this redirect URI:
    //   https://agpepcpffpohajgcdofgmiegnmdffhmk.chromiumapp.org/
    // Then paste the new Client ID here:
    const CLIENT_ID = '69395256863-2bpuunju7jb9s030nng7dn069lj2edso.apps.googleusercontent.com';

    const redirectUrl = chrome.identity.getRedirectURL();
    console.log('[Auth] Redirect URL being used:', redirectUrl); // Open DevTools to verify this matches Google Cloud Console

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('prompt', 'select_account');

    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { url: authUrl.toString(), interactive: true },
            async (responseUrl) => {
                if (chrome.runtime.lastError) {
                    const err = new Error(chrome.runtime.lastError.message || 'Sign-in was cancelled.');
                    err.code = 'auth/popup-closed-by-user';
                    return reject(err);
                }
                if (!responseUrl) {
                    const err = new Error('Sign-in was cancelled or failed to open.');
                    err.code = 'auth/popup-closed-by-user';
                    return reject(err);
                }

                try {
                    // Extract access_token from URL hash fragment
                    const hash = new URL(responseUrl).hash.substring(1);
                    const params = new URLSearchParams(hash);
                    const accessToken = params.get('access_token');

                    if (!accessToken) {
                        throw new Error('No access token returned from Google. Make sure the redirect URI is registered in Google Cloud Console.');
                    }

                    // Exchange the OAuth access token for a Firebase credential
                    const credential = GoogleAuthProvider.credential(null, accessToken);
                    const result = await signInWithCredential(auth, credential);
                    resolve(result.user);
                } catch (error) {
                    console.error('Firebase credential exchange failed:', error);
                    let msg = error.message;
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-action-code') {
                        msg = 'Google token was rejected by Firebase. The access token may have expired — try signing in again.';
                    }
                    const customError = new Error(msg);
                    customError.code = error.code || 'auth/internal-error';
                    reject(customError);
                }
            }
        );
    });
};

export const signInWithEmail = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        console.error('Error signing in with Email:', error);
        let msg = error.message;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = 'Invalid email or password.';
        } else if (error.code === 'auth/operation-not-allowed') {
            msg = 'Email/Password sign-in is disabled in your Firebase Console. Go to Authentication > Sign-in method and enable Email/Password.';
        }
        const customError = new Error(msg);
        customError.code = error.code;
        throw customError;
    }
};

export const registerWithEmail = async (email, password, displayName) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && result.user) {
            await updateProfile(result.user, { displayName });
        }
        return result.user;
    } catch (error) {
        console.error('Error registering with Email:', error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') {
            msg = 'This email is already registered. Please sign in instead.';
        } else if (error.code === 'auth/weak-password') {
            msg = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/operation-not-allowed') {
            msg = 'Email/Password provider is disabled in Firebase Console. Go to Authentication > Sign-in method and enable Email/Password.';
        }
        const customError = new Error(msg);
        customError.code = error.code;
        throw customError;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};
