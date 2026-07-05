import { createContext, useContext } from 'react';

export const OnboardingContext = createContext<{ completeOnboarding: () => void }>({
  completeOnboarding: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}
