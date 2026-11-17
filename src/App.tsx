/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AuthPages } from './components/AuthPages';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MezoneWorkspace } from './components/MezoneWorkspace';
import { CompleteProfilePage, ThankYouPage } from './components/OnboardingPages';
import { WelcomePage } from './components/WelcomePage';
import { BannerAdsProvider } from './lib/bannerAds';
import { auth } from './lib/firebase';
import { sanitizeInviteCode, setPendingInviteCode } from './lib/mezoneDb';
import { ThemeProvider } from './lib/theme';
import { RouteView, WorkspaceTab } from './types/mezone';

type OnboardingStep = 'none' | 'complete-profile' | 'thank-you';

function readInitialRoute(): RouteView {
  const path = window.location.pathname.toLowerCase();
  if (path === '/register') return 'register';
  if (path === '/login') return 'login';
  return 'welcome';
}

function readInviteFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const code = sanitizeInviteCode(params.get('invite') || params.get('ref') || '');
  if (code) {
    setPendingInviteCode(code);
  }
  return code;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [route, setRoute] = useState<RouteView>(readInitialRoute);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('none');
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<WorkspaceTab>('product');
  const [initialInviteCode] = useState<string>(readInviteFromUrl);

  const navigate = (nextRoute: RouteView) => {
    setRoute(nextRoute);
    const targetPath =
      nextRoute === 'register'
        ? '/register'
        : nextRoute === 'login'
          ? '/login'
          : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', `${targetPath}${window.location.search}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setOnboardingStep('none');
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthenticated = (origin: 'register' | 'login') => {
    if (origin === 'register') {
      setOnboardingStep('complete-profile');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setOnboardingStep('none');
      setWorkspaceInitialTab('product');
      navigate('workspace');
    }
  };

  const handleGoToProducts = () => {
    setWorkspaceInitialTab('product');
    setOnboardingStep('none');
    navigate('workspace');
  };

  if (!authReady) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-[#FAF9F6] text-[#111113] flex items-center justify-center px-6">
          <div className="text-center space-y-2">
            <p className="font-display text-2xl font-bold tracking-tight">Mezone</p>
            <p className="text-xs text-[#57534E]">Loading Mezone Auth...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <BannerAdsProvider>
        <ErrorBoundary>
          {user ? (
            onboardingStep === 'complete-profile' ? (
              <CompleteProfilePage
                user={user}
                onProfileCompleted={() => {
                  setOnboardingStep('thank-you');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onSkipToThankYou={() => {
                  setOnboardingStep('thank-you');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            ) : onboardingStep === 'thank-you' ? (
              <ThankYouPage user={user} onGoToProducts={handleGoToProducts} />
            ) : (
              <MezoneWorkspace
                user={user}
                initialTab={workspaceInitialTab}
                onSignedOut={() => {
                  setOnboardingStep('none');
                  navigate('welcome');
                }}
              />
            )
          ) : route === 'register' ? (
            <AuthPages
              mode="register"
              initialInviteCode={initialInviteCode}
              onSwitchMode={(next) => navigate(next)}
              onBackHome={() => navigate('welcome')}
              onAuthenticated={handleAuthenticated}
            />
          ) : route === 'login' ? (
            <AuthPages
              mode="login"
              onSwitchMode={(next) => navigate(next)}
              onBackHome={() => navigate('welcome')}
              onAuthenticated={handleAuthenticated}
            />
          ) : (
            <WelcomePage
              onGetStarted={() => navigate('register')}
              onLogin={() => navigate('login')}
            />
          )}
        </ErrorBoundary>
      </BannerAdsProvider>
    </ThemeProvider>
  );
}
