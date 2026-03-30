/**
 * Custom 404 Not Found Page
 * 
 * Beautiful 404 page that AI agents often miss
 * Automatically included in templates
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import './NotFound.css';

export const NotFound: React.FC = () => {
  return (
    <div className="not-found">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="not-found__container"
      >
        {/* Animated 404 */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5, delay: 0.2 }}
          className="not-found__number"
        >
          404
        </motion.div>

        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, rotate: -180 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="not-found__icon"
        >
          <AlertCircle className="w-20 h-20 text-blue-500" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="not-found__title"
        >
          Page Not Found
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="not-found__message"
        >
          The page you're looking for doesn't exist or has been moved.
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="not-found__actions"
        >
          <Link to="/" className="not-found__button not-found__button--primary">
            <Home className="w-5 h-5" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="not-found__button not-found__button--secondary"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <Link to="/search" className="not-found__button not-found__button--secondary">
            <Search className="w-5 h-5" />
            Search
          </Link>
        </motion.div>

        {/* Helpful Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="not-found__links"
        >
          <p className="not-found__links-title">Popular Pages:</p>
          <div className="not-found__links-list">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/docs">Documentation</Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Background decoration */}
      <div className="not-found__bg-decoration">
        <div className="not-found__bg-circle not-found__bg-circle--1" />
        <div className="not-found__bg-circle not-found__bg-circle--2" />
        <div className="not-found__bg-circle not-found__bg-circle--3" />
      </div>
    </div>
  );
};

export default NotFound;

