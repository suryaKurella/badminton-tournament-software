# Badminton Tournament App - Design System

## Table of Contents
1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Component Library](#component-library)
4. [Folder Structure](#folder-structure)
5. [UX Flow](#ux-flow)
6. [Accessibility](#accessibility)
7. [Micro-Interactions](#micro-interactions)

---

## Color Palette

### Brand Colors
```css
Primary Blue: #1E40AF
Accent Green: #22C55E
```

### Light Mode
```css
Background: #F9FAFB (light-bg)
Cards: #FFFFFF (light-card)
Surface-2: #F3F4F6 (light-surface)
Border: #E5E7EB (light-border)
Text Primary: #0F172A (light-text-primary)
Text Muted: #64748B (light-text-muted)
```

### Dark Mode
```css
Background: #0B1220 (dark-bg)
Cards: #0F1A2B (dark-card)
Surface-2: #12213A (dark-surface)
Border: #20314F (dark-border)
Text Primary: #E5E7EB (dark-text-primary)
Text Muted: #94A3B8 (dark-text-muted)
```

### Semantic States
```css
Success: #22C55E
Warning: #F59E0B
Error: #EF4444
Info: #38BDF8
```

---

## Typography

### Font Stack
System font stack for optimal performance:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

### Type Scale
- **Heading 1**: text-4xl (36px) font-bold
- **Heading 2**: text-3xl (30px) font-bold
- **Heading 3**: text-2xl (24px) font-semibold
- **Heading 4**: text-xl (20px) font-semibold
- **Body Large**: text-lg (18px)
- **Body**: text-base (16px)
- **Body Small**: text-sm (14px)
- **Caption**: text-xs (12px)

---

## Component Library

### Buttons
```jsx
// Primary Button
<button className="btn-primary">Action</button>

// Success Button
<button className="btn-success">Complete</button>

// Secondary Button
<button className="btn-secondary">Cancel</button>
```

### Cards
```jsx
// Basic Card
<div className="card p-6">Content</div>

// Hoverable Card
<div className="card card-hover p-6">Content</div>
```

### Badges
```jsx
// Status Badges
<span className="badge badge-success">Active</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-error">Cancelled</span>
<span className="badge badge-info">Info</span>
```

### Input Fields
```jsx
<input type="text" className="input" placeholder="Enter text..." />
```

---

## Folder Structure

```
src/
├── assets/              # Images, icons, fonts
├── components/
│   ├── common/          # Shared components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   └── ProtectedRoute.jsx
│   ├── layout/          # Layout components
│   │   ├── Navbar.jsx
│   │   ├── Layout.jsx
│   │   └── Footer.jsx
│   ├── leaderboard/     # Leaderboard components
│   │   ├── LeaderboardTable.jsx
│   │   ├── LeaderboardRow.jsx
│   │   └── LeaderboardFilters.jsx
│   ├── player/          # Player components
│   │   ├── PlayerCard.jsx
│   │   ├── PlayerProfile.jsx
│   │   └── PlayerStats.jsx
│   ├── tournament/      # Tournament components
│   │   └── ...
│   └── match/           # Match components
│       └── ...
├── context/             # React Context
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
├── hooks/               # Custom hooks
│   ├── useAuth.js
│   ├── useTheme.js
│   └── useLeaderboard.js
├── pages/               # Page components
│   ├── auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── dashboard/
│   │   └── Dashboard.jsx
│   ├── leaderboard/
│   │   └── Leaderboard.jsx
│   ├── tournaments/
│   │   ├── TournamentList.jsx
│   │   ├── TournamentDetails.jsx
│   │   └── TournamentCreate.jsx
│   └── matches/
│       └── ...
├── services/            # API services
│   ├── api.js
│   ├── socket.js
│   └── supabase.js
├── utils/               # Utility functions
│   ├── formatters.js
│   └── validators.js
├── App.jsx
├── App.css
└── main.jsx
```

---

## UX Flow

### 1. Login Flow
```
Landing → Login Page → Dashboard
              ↓
         Google Auth → Success → Dashboard
              ↓
         Email Auth → Success → Dashboard
```

### 2. Dashboard → Leaderboard Flow
```
Dashboard
    ↓
[View Leaderboard] Button
    ↓
Leaderboard Page
    ├── Filter by Category
    ├── Search Players
    ├── Highlight Current User
    └── Click Player → Player Profile
```

### 3. Match Scheduling Flow
```
Dashboard → [Schedule Match] → Select Players → Set Date/Time → Confirm
```

---

## Accessibility

### ARIA Labels
- All interactive elements have `aria-label` or `aria-labelledby`
- Form inputs have associated `<label>` tags
- Buttons describe their action

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Custom focus styles: `ring-2 ring-brand-blue`
- Skip navigation links for screen readers
- Modal focus trapping

### Color Contrast
- Text meets WCAG AA standards (4.5:1 for normal text)
- Interactive elements have sufficient contrast
- Dark mode maintains accessibility ratios

### Screen Reader Support
- Semantic HTML5 elements
- `role` attributes where needed
- Live regions for dynamic content (`aria-live`)

---

## Micro-Interactions

### Hover States
```css
/* Buttons */
hover:bg-blue-700 hover:shadow-md

/* Cards */
hover:shadow-card-hover hover:-translate-y-0.5

/* Table Rows */
hover:bg-light-surface dark:hover:bg-dark-surface
```

### Active States
```css
/* Buttons */
active:bg-blue-800 active:scale-95

/* Interactive Elements */
active:scale-95 transition-transform duration-100
```

### Loading States
```jsx
// Button Loading
<button className="btn-primary" disabled>
  <span className="animate-spin">⏳</span> Loading...
</button>

// Skeleton Loader
<div className="skeleton h-20 w-full rounded-lg"></div>
```

### Animations
```css
/* Fade In */
animate-fade-in

/* Slide Up */
animate-slide-up

/* Scale In */
animate-scale-in

/* Shimmer (for loading) */
animate-shimmer
```

### Success Feedback
- Green checkmark animation on successful actions
- Toast notifications for important updates
- Confetti effect for wins/achievements

---

## Responsive Breakpoints

```css
sm:  640px   /* Mobile landscape, small tablets */
md:  768px   /* Tablets */
lg:  1024px  /* Desktop */
xl:  1280px  /* Large desktop */
2xl: 1536px  /* Extra large desktop */
```

---

## Usage Examples

### Dark Mode Toggle
```jsx
import { useTheme } from '../context/ThemeContext';

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="btn-secondary">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Highlighted Table Row (Current User)
```jsx
<tr className={`table-row ${isCurrentUser ? 'table-row-highlight' : ''}`}>
  <td>{rank}</td>
  <td>{player.name}</td>
  <td>{player.points}</td>
</tr>
```

---

## Performance Optimizations

1. **Lazy Loading**: Route-based code splitting
2. **Image Optimization**: Use WebP format, lazy load images
3. **Memoization**: React.memo for expensive components
4. **Debouncing**: Search inputs, filters
5. **Virtual Scrolling**: For long leaderboard lists

---

## Testing

- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: Cypress
- **Accessibility Tests**: axe-core, jest-axe
- **Visual Regression**: Percy or Chromatic

---

## Resources

- Tailwind CSS Docs: https://tailwindcss.com/docs
- React Docs: https://react.dev
- Accessibility Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
