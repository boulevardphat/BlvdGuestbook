/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import GuestbookEditor from './components/GuestbookEditor';
import MobileGuestbookEditor from './components/MobileGuestbookEditor';
import ThankYouScreen from './components/ThankYouScreen';
import Gallery from './components/Gallery';
import BackgroundMusic from './components/BackgroundMusic';
import IntroScreen from './components/IntroScreen';
import { GuestData } from './types';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2>Đã có lỗi xảy ra!</h2>
          <p>Please check the console or the error below:</p>
          <pre style={{ background: '#ffcdd2', padding: '10px', overflowX: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ background: '#ffcdd2', padding: '10px', overflowX: 'auto', marginTop: '10px' }}>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '10px 20px' }}>
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type Step = 'intro' | 'welcome' | 'editor' | 'thankyou' | 'gallery';

export default function App() {
  const [step, setStep] = useState<Step>('intro');
  const [guestData, setGuestData] = useState<GuestData | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleWelcomeComplete = (data: GuestData) => {
    setGuestData(data);
    setStep('editor');
  };

  const handleEditorComplete = () => {
    setStep('thankyou');
  };

  if (step === 'gallery') {
    return (
      <ErrorBoundary>
        <Gallery onBack={() => setStep('welcome')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <main className="w-full min-h-screen overflow-hidden">
        {step === 'intro' && <IntroScreen onNext={() => setStep('welcome')} />}
        {step === 'welcome' && <WelcomeScreen onComplete={handleWelcomeComplete} onOpenGallery={() => setStep('gallery')} />}
        {step === 'editor' && guestData && (isMobile ? <MobileGuestbookEditor guestData={guestData} onComplete={handleEditorComplete} /> : <GuestbookEditor guestData={guestData} onComplete={handleEditorComplete} />)}
        {step === 'thankyou' && guestData && <ThankYouScreen guestData={guestData} onHome={() => setStep('welcome')} onGallery={() => setStep('gallery')} />}
        <BackgroundMusic />
      </main>
    </ErrorBoundary>
  );
}
