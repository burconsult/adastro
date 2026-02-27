import React from 'react';
import { getFooterNewsletterSignupComponent } from '@/lib/features/ui';
import type { FooterSignupProps } from '@/lib/features/types';

export default function FooterNewsletterSlot(props: FooterSignupProps) {
  const SignupComponent = getFooterNewsletterSignupComponent();
  if (!SignupComponent) return null;
  return <SignupComponent {...props} />;
}
