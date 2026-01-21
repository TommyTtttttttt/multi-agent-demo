/**
 * Design Tokens
 * 自动从 Figma 提取生成
 * 生成时间: 2026-01-21T12:34:51.356Z
 */

export const colors = {
  "primary": "#3B82F6",
  "primary-dark": "#2563EB",
  "primary-light": "#60A5FA",
  "secondary": "#10B981",
  "secondary-dark": "#059669",
  "background": "#FFFFFF",
  "background-alt": "#F9FAFB",
  "surface": "#F3F4F6",
  "text-primary": "#111827",
  "text-secondary": "#6B7280",
  "text-muted": "#9CA3AF",
  "border": "#E5E7EB",
  "border-light": "#F3F4F6",
  "error": "#EF4444",
  "warning": "#F59E0B",
  "success": "#10B981",
  "info": "#3B82F6"
} as const;

export const spacing = {
  "xs": "4px",
  "sm": "8px",
  "md": "16px",
  "lg": "24px",
  "xl": "32px",
  "2xl": "48px",
  "3xl": "64px"
} as const;

export const typography = {
  "font-family": "Inter, system-ui, sans-serif",
  "font-size-xs": "12px",
  "font-size-sm": "14px",
  "font-size-base": "16px",
  "font-size-lg": "18px",
  "font-size-xl": "20px",
  "font-size-2xl": "24px",
  "font-size-3xl": "30px",
  "font-weight-normal": "400",
  "font-weight-medium": "500",
  "font-weight-semibold": "600",
  "font-weight-bold": "700",
  "line-height-tight": "1.25",
  "line-height-normal": "1.5",
  "line-height-relaxed": "1.75"
} as const;

export const borderRadius = {
  "none": "0",
  "sm": "4px",
  "md": "8px",
  "lg": "12px",
  "xl": "16px",
  "full": "9999px"
} as const;

export const shadows = {
  "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
} as const;

// Tailwind 配置扩展
export const tailwindExtend = {
  colors: {
  "primary": "#3B82F6",
  "primary-dark": "#2563EB",
  "primary-light": "#60A5FA",
  "secondary": "#10B981",
  "secondary-dark": "#059669",
  "background": "#FFFFFF",
  "background-alt": "#F9FAFB",
  "surface": "#F3F4F6",
  "text-primary": "#111827",
  "text-secondary": "#6B7280",
  "text-muted": "#9CA3AF",
  "border": "#E5E7EB",
  "border-light": "#F3F4F6",
  "error": "#EF4444",
  "warning": "#F59E0B",
  "success": "#10B981",
  "info": "#3B82F6"
},
  spacing: {
  "xs": "4px",
  "sm": "8px",
  "md": "16px",
  "lg": "24px",
  "xl": "32px",
  "2xl": "48px",
  "3xl": "64px"
},
  borderRadius: {
  "none": "0",
  "sm": "4px",
  "md": "8px",
  "lg": "12px",
  "xl": "16px",
  "full": "9999px"
},
  boxShadow: {
  "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
},
};
