import React from "react";
import useScrollReveal from "../hooks/useScrollReveal";

/**
 * Reusable wrapper that triggers animated entrances when scrolled into view.
 * 
 * Available animations:
 * - 'fade-up' (default)
 * - 'fade-down'
 * - 'fade-in'
 * - 'slide-left'
 * - 'slide-right'
 * - 'scale-up'
 * - 'stagger' (applies to immediate children)
 */
export default function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  duration = 0.65,
  className = "",
  style = {},
  threshold = 0.12,
  as: Component = "div",
  ...props
}) {
  const [ref, isVisible] = useScrollReveal({ threshold });

  const animStyle = {
    ...style,
    "--reveal-delay": `${delay}ms`,
    "--reveal-duration": `${duration}s`,
  };

  return (
    <Component
      ref={ref}
      className={`scroll-reveal-container ${animation} ${
        isVisible ? "is-revealed" : ""
      } ${className}`}
      style={animStyle}
      {...props}
    >
      {children}
    </Component>
  );
}
