/**
 * User Onboarding Flow
 * 
 * What AI app builders forget: Getting users started
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, X } from 'lucide-react';
import './UserOnboarding.css';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

export const UserOnboarding: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome!',
      description: 'Let\'s get you started',
      component: <WelcomeStep />,
    },
    {
      id: 'features',
      title: 'Key Features',
      description: 'Here\'s what you can do',
      component: <FeaturesStep />,
    },
    {
      id: 'setup',
      title: 'Quick Setup',
      description: 'Configure your preferences',
      component: <SetupStep />,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setCompletedSteps(new Set([...completedSteps, steps[currentStep].id]));
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setCompletedSteps(new Set([...completedSteps, steps[currentStep].id]));
    // Save onboarding completion
    localStorage.setItem('onboarding_completed', 'true');
    onComplete();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="onboarding-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="onboarding-modal"
      >
        {/* Progress bar */}
        <div className="onboarding-progress">
          <div
            className="onboarding-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="onboarding-skip"
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="onboarding-content"
          >
            <h2 className="onboarding-title">
              {steps[currentStep].title}
            </h2>
            <p className="onboarding-description">
              {steps[currentStep].description}
            </p>
            {steps[currentStep].component}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="onboarding-actions">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="onboarding-button onboarding-button--secondary"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="onboarding-button onboarding-button--primary"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="onboarding-steps">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`onboarding-step-indicator ${
                index === currentStep ? 'active' : ''
              } ${completedSteps.has(step.id) ? 'completed' : ''}`}
            >
              {completedSteps.has(step.id) ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const WelcomeStep: React.FC = () => (
  <div className="onboarding-step-content">
    <div className="onboarding-icon">👋</div>
    <p>Welcome to the app! We're excited to have you here.</p>
    <p>This quick tour will help you get started.</p>
  </div>
);

const FeaturesStep: React.FC = () => (
  <div className="onboarding-step-content">
    <ul className="onboarding-features">
      <li>
        <Check className="w-5 h-5 text-green-500" />
        <span>Feature 1 - Do amazing things</span>
      </li>
      <li>
        <Check className="w-5 h-5 text-green-500" />
        <span>Feature 2 - Build faster</span>
      </li>
      <li>
        <Check className="w-5 h-5 text-green-500" />
        <span>Feature 3 - Stay organized</span>
      </li>
    </ul>
  </div>
);

const SetupStep: React.FC = () => {
  const [preferences, setPreferences] = useState({
    notifications: true,
    theme: 'light',
  });

  return (
    <div className="onboarding-step-content">
      <div className="onboarding-form">
        <label>
          <input
            type="checkbox"
            checked={preferences.notifications}
            onChange={(e) =>
              setPreferences({ ...preferences, notifications: e.target.checked })
            }
          />
          Enable notifications
        </label>
        <label>
          Theme:
          <select
            value={preferences.theme}
            onChange={(e) =>
              setPreferences({ ...preferences, theme: e.target.value })
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </label>
      </div>
    </div>
  );
};

export default UserOnboarding;

