"use client";

import React from "react";
import { motion } from "framer-motion";
import type { RangeKey } from "@/actions/wallet.actions";
import styles from "./RangeTabs.module.scss";

const RANGES: RangeKey[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

type Props = {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  disabled?: boolean;
  className?: string;
};

export default function RangeTabs({ value, onChange, disabled = false, className = "" }: Props) {
  return (
    <div className={`${styles.root} ${className}`}>
      {RANGES.map((range) => {
        const isActive = range === value;

        return (
          <motion.button
            key={range}
            type="button"
            onClick={() => onChange(range)}
            disabled={disabled}
            className={styles.tabButton}
            whileHover={{
              scale: 1.03,
              y: -1,
              boxShadow: "0 10px 18px rgba(30, 20, 9, 0.12)",
            }}
            whileTap={{ scale: 0.98 }}
            drag
            dragElastic={0.12}
            whileDrag={{ scale: 1.01 }}
            dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 24, mass: 0.5 }}
          >
            {isActive ? (
              <motion.span
                layoutId="profit-range-pill"
                className={styles.activePill}
                transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.6 }}
              />
            ) : null}
            <span className={`${styles.label} ${isActive ? styles.labelActive : ""}`}>{range}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
