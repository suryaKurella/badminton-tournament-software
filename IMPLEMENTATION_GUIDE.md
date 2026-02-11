# Implementation Guide - Sports Dashboard Design System

This guide shows you how to implement the new design system in your badminton tournament app.

## ✅ What's Been Completed

### 1. **Tailwind Configuration** ✓
- Custom color palette configured
- Animations and keyframes added
- Custom shadows defined
- Located at: `frontend/tailwind.config.js`

### 2. **Global CSS** ✓
- Semantic CSS classes defined
- Component utilities created
- Accessibility focus styles added
- Located at: `frontend/src/App.css`

### 3. **Updated Components** ✓
- **Navbar**: Glass morphism effect, professional styling
- **Layout**: Responsive padding system

### 4. **New Components Created** ✓
- **LeaderboardTable**: Professional sports leaderboard with search, filters, and current user highlighting
- **PlayerCard**: Beautiful player cards with stats and gradients
- **Button**: Reusable button component with variants
- **Badge**: Status badge component

### 5. **Documentation** ✓
- DESIGN_SYSTEM.md: Complete design system reference
- This file: Implementation guide

---

## 🚀 Quick Start - Using the New Design System

### Using Semantic Color Classes

Instead of hardcoded colors, use semantic tokens:

```jsx
// ❌ OLD WAY
<div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white">

// ✅ NEW WAY
<div className="bg-light-card dark:bg-dark-card text-primary">
```

### Color Class Reference

```jsx
// Backgrounds
bg-light-bg dark:bg-dark-bg           // Page background
bg-light-card dark:bg-dark-card       // Card background
bg-light-surface dark:bg-dark-surface // Secondary surface

// Borders
border-light-border dark:border-dark-border

// Text
text-primary  // Adapts to light/dark automatically
text-muted    // Muted text that adapts

// Brand Colors
text-brand-blue
bg-brand-green

// Semantic States
text-success / bg-success
text-warning / bg-warning
text-error / bg-error
text-info / bg-info
```

---

## 📦 Component Usage Examples

### 1. Button Component

```jsx
import Button from './components/common/Button';

// Primary button
<Button onClick={handleClick}>
  Click me
</Button>

// Success button
<Button variant="success" size="lg">
  Save Changes
</Button>

// Loading state
<Button loading disabled>
  Saving...
</Button>

// Error button
<Button variant="error">
  Delete
</Button>

// All variants
primary | success | secondary | error | warning | ghost
```

### 2. Badge Component

```jsx
import Badge from './components/common/Badge';

// Status badges
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Cancelled</Badge>
<Badge variant="info">New</Badge>
```

### 3. Card Component

```jsx
// Basic card
<div className="card p-6">
  Content here
</div>

// Hoverable card (for clickable items)
<div className="card card-hover p-6">
  Hover me!
</div>
```

### 4. Input Field

```jsx
// Standard input
<input
  type="text"
  className="input"
  placeholder="Enter text..."
/>

// With label
<label className="block mb-2 text-sm font-semibold text-primary">
  Name
</label>
<input type="text" className="input" />
```

### 5. Leaderboard Table

```jsx
import LeaderboardTable from './components/leaderboard/LeaderboardTable';

const players = [
  {
    id: 1,
    fullName: 'John Doe',
    username: 'johndoe',
    category: 'Singles',
    points: 1500,
    matchesPlayed: 25,
    wins: 20,
    userId: '123'
  },
  // ... more players
];

<LeaderboardTable
  players={players}
  loading={false}
/>
```

### 6. Player Card

```jsx
import PlayerCard from './components/player/PlayerCard';

<PlayerCard
  player={{
    id: 1,
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    category: 'Doubles',
    points: 1200,
    matchesPlayed: 30,
    wins: 22
  }}
  showStats={true}
/>
```

---

## 🎨 Updating Existing Pages

### Example: Updating Tournament List

```jsx
// Before
<div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
    Tournaments
  </h2>
  <button className="bg-blue-600 text-white px-4 py-2 rounded-md">
    Create Tournament
  </button>
</div>

// After
<div className="card p-6">
  <h2 className="text-2xl font-bold text-primary">
    Tournaments
  </h2>
  <Button variant="primary">
    Create Tournament
  </Button>
</div>
```

### Example: Tournament Card with Badges

```jsx
<div className="card card-hover p-6">
  <div className="flex justify-between items-start mb-3">
    <h3 className="text-xl font-bold text-primary">
      Summer Championship 2024
    </h3>
    <Badge variant="success">OPEN</Badge>
  </div>

  <div className="flex gap-2 mb-4">
    <Badge variant="info">Singles</Badge>
    <Badge variant="secondary">Single Elimination</Badge>
  </div>

  <div className="space-y-2 text-sm text-muted">
    <div className="flex items-center gap-2">
      <span>📍</span>
      <span>Sports Arena</span>
    </div>
    <div className="flex items-center gap-2">
      <span>📅</span>
      <span>June 15, 2024</span>
    </div>
  </div>
</div>
```

---

## ⚡ Animations & Micro-Interactions

### Fade In Animation

```jsx
<div className="animate-fade-in">
  Content fades in
</div>
```

### Slide Up Animation

```jsx
<div className="animate-slide-up">
  Content slides up
</div>
```

### Interactive Elements

```jsx
<button className="interactive">
  // Scales down on click
  Click me
</button>
```

### Loading Skeleton

```jsx
<div className="skeleton h-20 w-full rounded-lg"></div>
```

---

## 🎯 Table Row Highlighting

For leaderboards or data tables where you want to highlight the current user:

```jsx
{players.map(player => {
  const isCurrentUser = user && player.userId === user.id;

  return (
    <tr
      key={player.id}
      className={`table-row ${isCurrentUser ? 'table-row-highlight' : ''}`}
    >
      <td>{player.name}</td>
      <td>{player.points}</td>
    </tr>
  );
})}
```

---

## 🌗 Dark Mode Toggle (Already Implemented)

The dark mode is already working! The toggle button in the navbar switches between light and dark themes.

### How it works:
1. ThemeContext manages the theme state
2. Tailwind's `dark:` prefix applies dark mode styles
3. The `class` strategy is used (adds `dark` class to `<html>`)

---

## ♿ Accessibility Features

All components include:
- **Proper ARIA labels** for screen readers
- **Keyboard navigation** support
- **Focus visible states** with brand blue ring
- **Color contrast** meets WCAG AA standards

Example focus state:
```jsx
<button className="...">
  // Automatically gets:
  // focus:outline-none focus:ring-2 focus:ring-brand-blue
</button>
```

---

## 📱 Responsive Design

All components are mobile-first and responsive:

```jsx
// Stack on mobile, row on desktop
<div className="flex flex-col sm:flex-row gap-4">

// 1 column mobile, 2 tablet, 3 desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// Hide on mobile, show on tablet+
<div className="hidden md:block">
```

---

## 🎬 Step-by-Step Migration

### Step 1: Update Your Page Wrapper
```jsx
// Before
<div className="max-w-7xl mx-auto px-8 py-10">

// After
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
```

### Step 2: Replace Buttons
```jsx
// Before
<button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">

// After
<Button variant="primary">Save</Button>
```

### Step 3: Replace Cards
```jsx
// Before
<div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border">

// After
<div className="card p-6">
```

### Step 4: Replace Text Colors
```jsx
// Before
<h1 className="text-gray-900 dark:text-white">

// After
<h1 className="text-primary">
```

---

## 🧪 Testing Your Changes

1. **Test Light Mode**: Default mode, check all pages
2. **Test Dark Mode**: Click moon icon, verify colors
3. **Test Mobile**: Resize browser to 375px width
4. **Test Keyboard Nav**: Tab through interactive elements
5. **Test Screen Reader**: Use voiceover/NVDA to verify labels

---

## 📊 Example: Creating a Dashboard Page

```jsx
import { useState, useEffect } from 'react';
import LeaderboardTable from '../components/leaderboard/LeaderboardTable';
import PlayerCard from '../components/player/PlayerCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

const Dashboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data
    fetchPlayers();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="card p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-primary mb-2">
              Dashboard
            </h1>
            <p className="text-muted">Welcome back!</p>
          </div>
          <Badge variant="success">Active</Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="text-3xl font-bold text-brand-blue">24</div>
          <div className="text-sm text-muted mt-1">Active Tournaments</div>
        </div>
        {/* More stat cards... */}
      </div>

      {/* Leaderboard */}
      <LeaderboardTable players={players} loading={loading} />
    </div>
  );
};

export default Dashboard;
```

---

## 🎨 Color Usage Guidelines

### When to use each color:

**Brand Blue** (`brand-blue`):
- Primary CTAs
- Links
- Active states
- Important highlights

**Brand Green** (`brand-green`):
- Success states
- Win indicators
- Positive metrics
- Completion states

**Semantic Colors**:
- `success`: Wins, achievements, confirmations
- `warning`: Pending states, caution
- `error`: Errors, losses, deletions
- `info`: Informational badges, neutral states

---

## 🔥 Pro Tips

1. **Use semantic classes** instead of hardcoded colors
2. **Leverage card-hover** for clickable cards
3. **Add animate-fade-in** to page wrappers for smooth transitions
4. **Use the interactive class** for buttons and clickable elements
5. **Test in both light and dark mode** as you build

---

## 🐛 Common Issues & Fixes

### Issue: Colors not applying

**Fix**: Make sure you've imported the updated `App.css` in your `main.jsx`:

```jsx
import './App.css';
```

### Issue: Dark mode not working

**Fix**: Verify `<html>` element has the `dark` class in dark mode. The ThemeContext should handle this.

### Issue: Animations not working

**Fix**: Ensure Tailwind config has the animations defined. Run `npm run dev` to restart the dev server.

---

## 📚 Next Steps

1. ✅ Review the DESIGN_SYSTEM.md for complete reference
2. 🎨 Update remaining pages using the patterns above
3. 🧪 Test thoroughly in light/dark mode
4. ♿ Run accessibility audit
5. 📱 Test on real mobile devices

---

## 💡 Need Help?

- Check `DESIGN_SYSTEM.md` for complete color palette and components
- Review existing components in `src/components/` for examples
- All components use semantic colors for automatic dark mode support

**Happy coding! 🚀**
