"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  MessageSquare,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";

interface NoTeamMembersProps {
  onInviteTeammates: () => void;
  isPaidTier?: boolean;
  className?: string;
}

export function NoTeamMembers({
  onInviteTeammates,
  isPaidTier = true,
  className,
}: NoTeamMembersProps) {
  if (!isPaidTier) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-16 px-4",
          className,
        )}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-full bg-zinc-800/50 mb-6"
        >
          <Users className="h-10 w-10 text-zinc-500" />
        </motion.div>

        <h2 className="text-xl font-semibold text-zinc-100 mb-2 text-center">
          Team features available on Pro+
        </h2>
        <p className="text-zinc-400 text-center max-w-md mb-6">
          Upgrade to Pro or higher to invite team members and collaborate on
          security together.
        </p>
        <Button variant="outline" className="border-zinc-700">
          View Plans
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4",
        className,
      )}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative mb-8"
      >
        <TeamIllustration />
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-2xl font-bold text-zinc-100 mb-3 text-center"
      >
        Collaborate with your team
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-zinc-400 text-center max-w-md mb-8"
      >
        Invite your team members to share security insights, assign issues, and
        maintain a secure codebase together.
      </motion.p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mb-8"
      >
        <BenefitItem icon={Shield} label="Shared security dashboard" />
        <BenefitItem icon={MessageSquare} label="Issue assignment" />
        <BenefitItem icon={BarChart3} label="Team analytics" />
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <Button
          onClick={onInviteTeammates}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Invite teammates
        </Button>
      </motion.div>
    </div>
  );
}

function BenefitItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <Icon className="h-4 w-4 text-blue-400" />
      <span>{label}</span>
    </div>
  );
}

function TeamIllustration() {
  return (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl" />
      <div className="relative w-full h-full flex items-center justify-center">
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="absolute left-0 w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
        </motion.div>
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute top-0 w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center z-10"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600" />
        </motion.div>
        <motion.div
          initial={{ x: 10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute right-0 w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600" />
        </motion.div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
          className="absolute bottom-0 p-2 rounded-full bg-blue-500/20 border border-blue-500/30"
        >
          <UserPlus className="h-5 w-5 text-blue-400" />
        </motion.div>
      </div>
    </div>
  );
}
