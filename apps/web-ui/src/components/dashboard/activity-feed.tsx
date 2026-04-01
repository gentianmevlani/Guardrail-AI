"use client";

import { fetchActivities, type Activity } from "@/lib/api";
import { logger } from "@/lib/logger";
import { AnimatePresence, motion } from "framer-motion";
import { useHaptic } from "@/hooks/useHaptic";
import { listContainerVariants, listItemVariants } from "@/lib/animations";
import {
  Info,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";

const iconMap = {
  fix: { icon: ShieldCheck, color: "text-success" },
  alert: { icon: ShieldAlert, color: "text-destructive" },
  scan: { icon: Terminal, color: "text-primary" },
  lock: { icon: Lock, color: "text-warning" },
  info: { icon: Info, color: "text-muted-foreground" },
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hours ago`;
  return date.toLocaleDateString();
};

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const haptic = useHaptic();

  useEffect(() => {
    async function loadActivities() {
      try {
        const data = await fetchActivities(10);
        if (data.length > 0) {
          const hasNewActivities = data.length !== activities.length;
          setActivities(data);
          // Trigger haptic feedback for new activities
          if (hasNewActivities && activities.length > 0) {
            haptic.trigger('light');
          }
        }
      } catch (error) {
        logger.error("Failed to load activities", error);
      } finally {
        setLoading(false);
      }
    }

    loadActivities();

    // Poll for new activities every 10 seconds
    const interval = setInterval(loadActivities, 10000);
    return () => clearInterval(interval);
  }, [activities.length, haptic]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-0 max-h-[400px] overflow-y-auto no-scrollbar"
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout">
        {activities.map((item, index) => {
          const { icon: Icon, color } = iconMap[item.type] || iconMap.info;
          return (
            <motion.div
              key={item.id}
              variants={listItemVariants}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.4, 0.0, 0.2, 1],
              }}
              whileHover={{
                x: 4,
                scale: 1.02,
                backgroundColor: 'rgba(20, 184, 166, 0.05)',
                transition: { duration: 0.2 },
              }}
              className="activity-item cursor-pointer group"
              onClick={() => haptic.trigger('light')}
            >
              <motion.div
                className={`activity-icon ${color}`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <div className="activity-content">
                <motion.p
                  className="activity-message"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.2 }}
                >
                  {item.message}
                </motion.p>
                <motion.p
                  className="activity-time"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {formatTime(item.timestamp)}
                </motion.p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
