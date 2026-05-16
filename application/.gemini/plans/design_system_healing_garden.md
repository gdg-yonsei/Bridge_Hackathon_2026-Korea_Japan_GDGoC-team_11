# Design System Plan: "Healing Garden"

## Objective
Establish a cohesive design system for the emotional diary app that evokes a sense of nature, healing, and safety. This system will be integrated into the existing `react-native-paper` setup.

## Key Files & Context
- `src/theme/index.ts`: Core theme definitions (Colors, Fonts).
- `src/components/`: New common components (Buttons, Cards).
- `src/theme/tokens.ts`: (New) Design tokens for spacing, radius, and shadows.

## Implementation Steps

### Phase 1: Foundation (Tokens)
1.  **Colors**: Define the "Healing Garden" palette in `src/theme/index.ts`.
    - Primary: #88A085 (Sage Green)
    - Secondary: #51624D (Moss Green)
    - Background: #FAF9F6 (Off-white)
    - Surface: #FFFFFF
    - Emotion colors: Happy(#F4D35E), Sad(#A2B9BC), Angry(#B6452C), Calm(#C6D8D3), Anxious(#9B97B2).
2.  **Typography**: Set up font configurations for MD3. Use a mix of Serif (Titles) and Sans-serif (Body).
3.  **Spacing & Shapes**: Define standard spacing (4px base) and border radii (16px/24px).

### Phase 2: Components
1.  **Themed Wrapper**: Ensure `PaperProvider` uses the new theme.
2.  **Base Components**:
    - `HealingCard`: Card with organic radius and soft shadows.
    - `HealingButton`: Pill-shaped buttons with sage/moss colors.
    - `MoodPicker`: Specialized selector for emotional state.

### Phase 3: Integration
1.  Update existing screens (`app/index.tsx`, `(app)/write.tsx`) to use the new tokens.
2.  Implement "Privacy Indicators" to distinguish local-only content.

## Verification & Testing
- Visual smoke test on all main screens.
- Verify Light/Dark mode transitions (Nature-based dark mode uses deep forest greens).
- Check accessibility (Contrast ratios for text on beige/sage backgrounds).
