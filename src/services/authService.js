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
    return id ? `chrome-extension://${id}` : 'chrome-extension://agpepcpffpohajgcdofgmiegnmdffhmk';
};

/**
 * Returns the exact OAuth redirect URL used by chrome.identity.launchWebAuthFlow
 * (e.g. https://<extension-id>.chromiumapp.org/)
 * Must be registered under Authorized redirect URIs in Google Cloud Console.
 */
export const getOAuthRedirectURL = () => {
    try {
        if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
            return chrome.identity.getRedirectURL();
        }
    } catch {
        // fallback
    }
    return 'https://agpepcpffpohajgcdofgmiegnmdffhmk.chromiumapp.org/';
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
 *    https://kcjeaiinohafmhkcnjkhpomplbfpkkgo.chromiumapp.org/
 * 4. Save
 */
export const signInWithGoogle = async () => {
    // OAuth 2.0 Web Client ID in Google Cloud Console
    const CLIENT_ID = '69395256863-2bpuunju7jb9s030nng7dn069lj2edso.apps.googleusercontent.com';

    const redirectUrl = getOAuthRedirectURL();
    console.log('[Auth] Google OAuth Redirect URL:', redirectUrl);

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
                    const rawMsg = chrome.runtime.lastError.message || '';
                    console.warn('[Auth] launchWebAuthFlow error:', rawMsg, 'Redirect URL:', redirectUrl);
                    const isClosed = rawMsg.toLowerCase().includes('cancel') || 
                                     rawMsg.toLowerCase().includes('did not approve') || 
                                     rawMsg.toLowerCase().includes('closed');
                    const err = new Error(
                        isClosed
                            ? 'Sign-in window was closed. Please try again or use Email.'
                            : 'Unable to connect to Google. Please check your internet connection.'
                    );
                    err.code = isClosed ? 'auth/popup-closed-by-user' : 'auth/network-request-failed';
                    return reject(err);
                }
                if (!responseUrl) {
                    const err = new Error('Sign-in window was closed. Please try again or use Email.');
                    err.code = 'auth/popup-closed-by-user';
                    return reject(err);
                }

                try {
                    // Extract access_token from URL hash fragment
                    const hash = new URL(responseUrl).hash.substring(1);
                    const params = new URLSearchParams(hash);
                    const accessToken = params.get('access_token');

                    if (!accessToken) {
                        throw new Error('Google sign-in could not be completed. Please try again or use Email.');
                    }

                    // Exchange the OAuth access token for a Firebase credential
                    const credential = GoogleAuthProvider.credential(null, accessToken);
                    const result = await signInWithCredential(auth, credential);
                    resolve(result.user);
                } catch (error) {
                    console.error('Firebase credential exchange failed:', error);
                    let msg = 'Unable to sign in with Google. Please try again or use Email.';
                    if (error.code === 'auth/network-request-failed') {
                        msg = 'Network connection issue. Please check your internet connection.';
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
        let msg = 'Unable to sign in. Please check your email and password.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = 'Incorrect email or password.';
        } else if (error.code === 'auth/invalid-email') {
            msg = 'Please enter a valid email address.';
        } else if (error.code === 'auth/network-request-failed') {
            msg = 'Network connection issue. Please check your internet connection.';
        } else if (error.code === 'auth/too-many-requests') {
            msg = 'Too many attempts. Please wait a moment and try again.';
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
        let msg = 'Unable to create account. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            msg = 'An account with this email already exists. Please sign in instead.';
        } else if (error.code === 'auth/weak-password') {
            msg = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            msg = 'Please enter a valid email address.';
        } else if (error.code === 'auth/network-request-failed') {
            msg = 'Network connection issue. Please check your internet connection.';
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
