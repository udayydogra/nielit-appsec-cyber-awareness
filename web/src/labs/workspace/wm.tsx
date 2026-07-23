// Lab-scoped window manager (adapted from the Gemini prototype's zustand store,
// reimplemented as a React context+reducer so window state is local to the lab and
// resets when the workspace unmounts — no global store, no new dependency).
import { createContext, useContext, useReducer, type ReactNode } from 'react';

export interface Win {
  id: string;
  title: string;
  x: number; y: number; width: number; height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

interface State { windows: Win[]; activeId: string | null; topZ: number; }

type Action =
  | { t: 'open'; id: string; title: string; w?: number; h?: number }
  | { t: 'close'; id: string }
  | { t: 'focus'; id: string }
  | { t: 'min'; id: string }
  | { t: 'max'; id: string }
  | { t: 'move'; id: string; x: number; y: number }
  | { t: 'size'; id: string; width: number; height: number };

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'open': {
      const existing = s.windows.find((w) => w.id === a.id);
      const z = s.topZ + 1;
      if (existing) {
        return { ...s, topZ: z, activeId: a.id,
          windows: s.windows.map((w) => (w.id === a.id ? { ...w, title: a.title, minimized: false, z } : w)) };
      }
      const n = s.windows.length;
      const win: Win = {
        id: a.id, title: a.title,
        x: 80 + n * 34, y: 64 + n * 30,
        width: a.w ?? 720, height: a.h ?? 480,
        z, minimized: false, maximized: false,
      };
      return { windows: [...s.windows, win], activeId: a.id, topZ: z };
    }
    case 'close':
      return { ...s, windows: s.windows.filter((w) => w.id !== a.id),
        activeId: s.activeId === a.id ? null : s.activeId };
    case 'focus': {
      if (s.activeId === a.id) return s;
      const z = s.topZ + 1;
      return { ...s, topZ: z, activeId: a.id,
        windows: s.windows.map((w) => (w.id === a.id ? { ...w, z, minimized: false } : w)) };
    }
    case 'min':
      return { ...s, activeId: null,
        windows: s.windows.map((w) => (w.id === a.id ? { ...w, minimized: !w.minimized } : w)) };
    case 'max':
      return { ...s, windows: s.windows.map((w) => (w.id === a.id ? { ...w, maximized: !w.maximized } : w)) };
    case 'move':
      return { ...s, windows: s.windows.map((w) => (w.id === a.id ? { ...w, x: a.x, y: a.y } : w)) };
    case 'size':
      return { ...s, windows: s.windows.map((w) => (w.id === a.id ? { ...w, width: a.width, height: a.height } : w)) };
    default:
      return s;
  }
}

interface Ctx extends State { dispatch: React.Dispatch<Action>; }
const WMContext = createContext<Ctx | null>(null);

export function WindowManager({ children, initial }: { children: ReactNode; initial?: Action[] }) {
  const [state, dispatch] = useReducer(
    reducer,
    { windows: [], activeId: null, topZ: 100 },
    (s) => (initial ?? []).reduce(reducer, s),
  );
  return <WMContext.Provider value={{ ...state, dispatch }}>{children}</WMContext.Provider>;
}

export function useWM(): Ctx {
  const c = useContext(WMContext);
  if (!c) throw new Error('useWM outside WindowManager');
  return c;
}
