export const colors = {
  ivory: "#faf7f2",
  sand: "#f1e8da",
  sandDeep: "#e4d6c2",
  ink: "#1b1917",
  inkSoft: "#554d44",
  clay: "#a45c2b",
  clayDark: "#82461c",
  sage: "#6b7a62",
  line: "#e6ddd0",
  danger: "#8f2c1e",
  white: "#ffffff",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { sm: 2, md: 4, lg: 8 };

export const type = {
  display: { fontSize: 30, lineHeight: 34, color: colors.ink },
  title: { fontSize: 22, lineHeight: 27, color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" as const, color: colors.inkSoft },
};
