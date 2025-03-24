# Cyberpunk Crystal Theme Documentation

## Color Palette

### Primary Colors

```css
--theme-primary: #ff61d8; /* Neon Pink - Used for primary actions and highlights */
--theme-secondary: #4df4ff; /* Cyan - Used for secondary elements and accents */
--theme-accent: #b6f7ff; /* Light Cyan - Used for subtle accents and text */
--theme-warning: #ff9b3d; /* Orange - Used for warnings and cautions */
--theme-danger: #ff5757; /* Red - Used for errors and critical states */
--theme-success: #7bffa0; /* Green - Used for success states and positive indicators */
```

### Background Colors

```css
--theme-background: #1a1040; /* Deep Purple - Main background color */
--theme-surface: #2a1b50; /* Lighter Purple - Surface/card background color */
```

### Text Colors

```css
--theme-text: #ffffff; /* White - Primary text color */
```

### Glow Effects

```css
--theme-glow-primary: rgba(255, 97, 216, 0.5); /* Pink glow */
--theme-glow-secondary: rgba(77, 244, 255, 0.5); /* Cyan glow */
```

### Gradients

```css
--crystal-gradient: linear-gradient(
  45deg,
  rgba(255, 97, 216, 0.2),
  rgba(77, 244, 255, 0.2)
);
```

## Typography

### Font Family

```css
font-family: "Roboto Mono", monospace; /* Primary font for the entire application */
```

### Font Sizes

- Extra Small: 0.7rem
- Small: 0.8rem
- Base: 0.9rem
- Medium: 1rem
- Large: 1.1rem
- Extra Large: 1.2rem
- Header: 1.5rem

## Component Styling

### Cards/Panels

```css
.crystal-panel {
  background: var(--theme-surface);
  border: 1px solid rgba(77, 244, 255, 0.3);
  border-radius: 8px;
  padding: 15px;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(5px);
}

/* Crystal effect overlay */
.crystal-panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--crystal-gradient);
  opacity: 0.1;
  pointer-events: none;
}

/* Shine animation */
.crystal-panel::after {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  transform: rotate(45deg);
  animation: crystalShine 6s linear infinite;
}
```

### Buttons

```css
.crystal-button {
  color: var(--theme-text);
  border: none;
  padding: 4px 8px;
  font-size: 12px;
  font-family: "Roboto Mono", monospace;
  background: var(--theme-surface);
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.crystal-button:hover {
  background: rgba(77, 244, 255, 0.1);
}

.crystal-button.active {
  background: linear-gradient(
    135deg,
    var(--theme-secondary),
    var(--theme-primary)
  );
  color: var(--theme-background);
  text-shadow: 0 0 3px rgba(77, 244, 255, 0.3);
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.2), 0 0 10px var(--theme-glow-secondary);
}
```

### Data Displays

```css
.data-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  border: 1px solid rgba(77, 244, 255, 0.1);
  transition: all 0.3s ease;
}

.data-item:hover {
  border-color: rgba(77, 244, 255, 0.3);
  box-shadow: 0 0 10px rgba(77, 244, 255, 0.2);
  transform: translateY(-1px);
}
```

### Status Indicators

```css
.status-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--theme-success);
  position: relative;
  animation: pulse-glow 2s infinite;
}

.status-light::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background-color: var(--theme-success);
  opacity: 0.3;
  animation: pulse-glow 2s infinite;
}

.status-light.disconnected {
  background-color: var(--theme-danger);
}
```

## Animations

### Crystal Shine

```css
@keyframes crystalShine {
  0% {
    transform: rotate(45deg) translateY(-100%);
  }
  100% {
    transform: rotate(45deg) translateY(100%);
  }
}
```

### Pulse Glow

```css
@keyframes pulse-glow {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.1;
  }
}
```

### Status Pulse

```css
@keyframes statusPulse {
  0%,
  100% {
    opacity: 0.8;
    filter: brightness(1);
  }
  50% {
    opacity: 1;
    filter: brightness(1.2);
  }
}
```

## Layout Guidelines

### Grid System

- Use CSS Grid for main layout
- Recommended grid gap: 10px
- Padding for containers: 15px
- Border radius for components: 8px

### Spacing Scale

- Extra Small: 4px
- Small: 8px
- Medium: 12px
- Large: 15px
- Extra Large: 20px

### Z-Index Scale

1. Base content: 1
2. Overlays: 10
3. Dropdowns: 100
4. Tooltips: 1000
5. Modals: 10000

## Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 480px) {
  /* Mobile-specific styles */
}

/* Tablet */
@media (max-width: 768px) {
  /* Tablet-specific styles */
}

/* Desktop */
@media (min-width: 769px) {
  /* Desktop-specific styles */
}
```

## Best Practices

1. Always use CSS variables for colors and theme values
2. Include hover states for interactive elements
3. Add transition animations for state changes (recommended duration: 0.3s)
4. Use backdrop-filter: blur() for overlay effects
5. Implement glow effects using box-shadow and text-shadow
6. Use rgba colors for transparency instead of opacity where possible
7. Include fallback styles for older browsers
8. Maintain consistent spacing using the spacing scale
9. Use the crystal gradient effect for panel backgrounds
10. Implement pulse animations for status indicators

## Accessibility

1. Maintain a minimum contrast ratio of 4.5:1 for text
2. Ensure interactive elements have :focus states
3. Provide visual feedback for all interactive elements
4. Use semantic HTML elements
5. Include aria-labels for interactive elements
6. Ensure animations can be disabled via prefers-reduced-motion
7. Maintain readable font sizes (minimum 12px)

## Performance Tips

1. Use transform and opacity for animations
2. Implement will-change for heavy animations
3. Use backdrop-filter sparingly
4. Optimize gradient overlays
5. Minimize shadow complexity for better rendering
6. Use CSS variables for dynamic theme changes
7. Implement content-visibility: auto for off-screen content
