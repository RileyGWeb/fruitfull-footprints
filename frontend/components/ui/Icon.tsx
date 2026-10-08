import type { CSSProperties } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, Footprints, Heart, House, Leaf, Lock, Pencil, Plus, Search, Settings, Users, WifiOff, X,
} from 'lucide-react';

export {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, Footprints, Heart, House, Leaf, Lock, Pencil, Plus, Search, Settings, Users, WifiOff, X,
};

/** The prototype's icon table: [component, size, strokeWidth]. Strokes are 2.75 unless noted. */
export const ICONS = {
  home: [House, 20, 2.75], users: [Users, 20, 2.75], heart: [Heart, 20, 2.75], book: [BookOpen, 20, 2.75],
  feet: [Footprints, 20, 2.25], feetSm: [Footprints, 17, 2.25], feetLg: [Footprints, 28, 2.25],
  leaf: [Leaf, 24, 2.75], leafSm: [Leaf, 16, 2.75],
  plus: [Plus, 18, 2.75], plusSm: [Plus, 15, 2.75],
  back: [ArrowLeft, 17, 2.75], search: [Search, 16, 2.75],
  edit: [Pencil, 14, 2.5], editSm: [Pencil, 14, 2.5],
  lock: [Lock, 17, 2.5], settings: [Settings, 17, 2.5],
  x: [X, 16, 2.75], up: [ArrowUp, 15, 2.75], down: [ArrowDown, 15, 2.75], offline: [WifiOff, 15, 2.5],
} satisfies Record<string, [LucideIcon, number, number]>;

export type IconName = keyof typeof ICONS;

type Props = Omit<LucideProps, 'ref'> & { name: IconName; size?: number; strokeWidth?: number; style?: CSSProperties };

/** `<Icon name="leafSm" />` renders the lucide icon at the prototype's size/stroke (display:block, flex:none). */
export function Icon({ name, size, strokeWidth, style, ...rest }: Props) {
  const [C, s, sw] = ICONS[name];
  return <C size={size ?? s} strokeWidth={strokeWidth ?? sw} aria-hidden style={{ display: 'block', flex: 'none', ...style }} {...rest} />;
}
