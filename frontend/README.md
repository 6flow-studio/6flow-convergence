# 6flow Studio — Frontend

Visual workflow editor for building Chainlink CRE workflows. Built with Next.js 16, React Flow, Zustand, and Tailwind CSS v4.

## Prerequisites

- Node.js 20+
- npm

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the editor at `/editor`.

## Convex Setup (Database)

Workflows are persisted to **localStorage** by default. To enable cloud persistence with Convex:

1. Create a Convex account at [convex.dev](https://www.convex.dev/)

2. Initialize and deploy your Convex project:
   ```bash
   npx convex dev --once --configure=new
   ```
   This generates `.env.local` with your `CONVEX_URL`.

3. Wire `ConvexClientProvider` into the app layout (`src/app/layout.tsx`):
   ```tsx
   import { ConvexClientProvider } from "@/components/ConvexClientProvider";

   // Wrap children with:
   <ConvexClientProvider>
     {children}
   </ConvexClientProvider>
   ```

4. Update `src/lib/use-workflow-persistence.ts` to use Convex mutations/queries instead of localStorage.

5. Start Convex dev server alongside Next.js:
   ```bash
   npx convex dev
   ```

The Convex schema (`convex/schema.ts`) and server functions (`convex/workflows.ts`) are already defined.

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start dev server         |
| `npm run build` | Production build         |
| `npm run start` | Start production server  |
| `npm run lint`  | Run ESLint               |

## Tech Stack

| Library              | Purpose                    |
| -------------------- | -------------------------- |
| Next.js 16           | App framework (App Router) |
| React 19             | UI library                 |
| React Compiler       | Auto-memoization           |
| @xyflow/react v12    | Node-edge canvas           |
| Zustand              | Editor state management    |
| Convex               | Database + server functions|
| Tailwind CSS v4      | Styling                    |
| shadcn/ui            | UI components              |
| Lucide React         | Icons                      |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, dark theme
│   ├── page.tsx                # Redirects to /editor
│   └── editor/
│       └── page.tsx            # Editor page
├── components/
│   ├── editor/
│   │   ├── WorkflowEditor.tsx  # Main 3-panel layout
│   │   ├── Canvas.tsx          # React Flow wrapper
│   │   ├── NodePalette.tsx     # Left sidebar — drag nodes
│   │   ├── ConfigPanel.tsx     # Right sidebar — node config
│   │   ├── Toolbar.tsx         # Top bar — name, save
│   │   ├── StatusBar.tsx       # Bottom bar — stats
│   │   └── nodes/             # Custom node renderers (8 categories)
│   ├── ConvexClientProvider.tsx # Convex provider (not wired yet)
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── node-registry.ts        # 23 node types mapped to categories
│   ├── editor-store.ts         # Zustand store
│   └── use-workflow-persistence.ts # Save/load (localStorage)
convex/
├── schema.ts                   # Workflows table schema
└── workflows.ts                # save/load/list functions
```
