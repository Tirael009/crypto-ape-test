"use client";

import { motion, type MotionProps } from "framer-motion";
import React from "react";
import styles from "./ButtonMotion.module.scss";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
  MotionProps & {
    variant?: "primary" | "secondary";
  };

export default function ButtonMotion({
  className = "",
  variant = "primary",
  whileHover,
  whileTap,
  whileDrag,
  transition,
  ...props
}: Props) {
  return (
    <motion.button
      whileHover={whileHover ?? { scale: 1.02, y: -1, boxShadow: "0 16px 26px rgba(32,20,8,0.14)" }}
      whileTap={whileTap ?? { scale: 0.98 }}
      drag
      dragElastic={0.12}
      whileDrag={whileDrag ?? { scale: 1.01 }}
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      transition={transition ?? { type: "spring", stiffness: 420, damping: 24, mass: 0.55 }}
      className={`${styles.button} ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
