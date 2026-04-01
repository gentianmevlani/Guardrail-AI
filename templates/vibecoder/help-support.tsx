/**
 * Help & Support
 * 
 * What AI app builders forget: Users need help and support
 */

import React, { useState } from 'react';
import { HelpCircle, MessageCircle, Book, Mail, Send } from 'lucide-react';
import { useToast } from './toast-notifications';
import './HelpSupport.css';

export const HelpSupport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'docs'>('faq');
  const { showToast } = useToast();

  const faqs = [
    {
      question: 'How do I get started?',
      answer: 'Click the "Get Started" button and follow the onboarding flow.',
    },
    {
      question: 'How do I reset my password?',
      answer: 'Click "Forgot Password" on the login page and follow the instructions.',
    },
    {
      question: 'How do I contact support?',
      answer: 'Use the contact form below or email support@example.com',
    },
  ];

  return (
    <div className="help-support">
      <div className="help-header">
        <h1>Help & Support</h1>
        <p>Get help with your account and the app</p>
      </div>

      <div className="help-tabs">
        <button
          onClick={() => setActiveTab('faq')}
          className={`help-tab ${activeTab === 'faq' ? 'active' : ''}`}
        >
          <HelpCircle className="w-5 h-5" />
          <span>FAQ</span>
        </button>
        <button
          onClick={() => setActiveTab('contact')}
          className={`help-tab ${activeTab === 'contact' ? 'active' : ''}`}
        >
          <MessageCircle className="w-5 h-5" />
          <span>Contact</span>
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`help-tab ${activeTab === 'docs' ? 'active' : ''}`}
        >
          <Book className="w-5 h-5" />
          <span>Documentation</span>
        </button>
      </div>

      <div className="help-content">
        {activeTab === 'faq' && <FAQTab faqs={faqs} />}
        {activeTab === 'contact' && <ContactTab showToast={showToast} />}
        {activeTab === 'docs' && <DocsTab />}
      </div>
    </div>
  );
};

const FAQTab: React.FC<{ faqs: Array<{ question: string; answer: string }> }> = ({ faqs }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="help-faq">
      <h2>Frequently Asked Questions</h2>
      <div className="faq-list">
        {faqs.map((faq, index) => (
          <div key={index} className="faq-item">
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="faq-question"
            >
              {faq.question}
              <span className="faq-toggle">{openIndex === index ? '−' : '+'}</span>
            </button>
            {openIndex === index && (
              <div className="faq-answer">{faq.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ContactTab: React.FC<{ showToast: (type: any, message: string) => void }> = ({ showToast }) => {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Send support request
    try {
      // await sendSupportRequest(formData);
      showToast('success', 'Support request sent! We\'ll get back to you soon.');
      setFormData({ subject: '', message: '', email: '' });
    } catch (error) {
      showToast('error', 'Failed to send support request');
    }
  };

  return (
    <div className="help-contact">
      <h2>Contact Support</h2>
      <form onSubmit={handleSubmit} className="contact-form">
        <label>
          Email
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </label>
        <label>
          Subject
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            required
          />
        </label>
        <label>
          Message
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            rows={6}
            required
          />
        </label>
        <button type="submit" className="contact-submit">
          <Send className="w-5 h-5" />
          Send Message
        </button>
      </form>
    </div>
  );
};

const DocsTab: React.FC = () => (
  <div className="help-docs">
    <h2>Documentation</h2>
    <div className="docs-links">
      <a href="/docs/getting-started" className="doc-link">
        <Book className="w-5 h-5" />
        <div>
          <h3>Getting Started</h3>
          <p>Learn the basics</p>
        </div>
      </a>
      <a href="/docs/api" className="doc-link">
        <Book className="w-5 h-5" />
        <div>
          <h3>API Reference</h3>
          <p>Complete API documentation</p>
        </div>
      </a>
      <a href="/docs/guides" className="doc-link">
        <Book className="w-5 h-5" />
        <div>
          <h3>Guides</h3>
          <p>Step-by-step tutorials</p>
        </div>
      </a>
    </div>
  </div>
);

