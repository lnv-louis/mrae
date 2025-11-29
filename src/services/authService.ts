import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, AuthRequestPromptOptions } from 'expo-auth-session';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // TODO: Replace with env var

interface GoogleAuthResponse {
  accessToken: string | null;
  request: any;
  promptAsync: (options?: AuthRequestPromptOptions) => Promise<any>;
  logout: () => Promise<void>;
}

export const useGoogleAuth = (): GoogleAuthResponse => {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
      redirectUri: makeRedirectUri({
        scheme: 'mrae'
      }),
    },
    discovery
  );

  useEffect(() => {
    const checkStoredToken = async () => {
      const token = await AsyncStorage.getItem('google_access_token');
      if (token) setAccessToken(token);
    };
    checkStoredToken();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        setAccessToken(authentication.accessToken);
        AsyncStorage.setItem('google_access_token', authentication.accessToken);
      }
    }
  }, [response]);

  const logout = async () => {
    await AsyncStorage.removeItem('google_access_token');
    setAccessToken(null);
  };

  return { accessToken, request, promptAsync, logout };
};

