import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export default function AnimatedCounter({ value, decimals = 1 }) {
  const springValue = useSpring(0, { stiffness: 100, damping: 20 });
  
  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  const displayValue = useTransform(springValue, (current) => {
    return Number(current).toFixed(decimals);
  });

  return <motion.span>{displayValue}</motion.span>;
}
