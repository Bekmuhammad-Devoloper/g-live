// Kuch-yo'naltirilgan graf simulyatsiyasi (Obsidian'dagi Graph View kabi).
//
// d3-force o'rnatilmagan, shuning uchun kerakli uchta kuch qo'lda yozilgan:
//   • repel  — tugunlar bir-birini itaradi (Coulomb qonuniga o'xshash, 1/d²)
//   • link   — bog'langan tugunlar prujina bilan tortiladi
//   • center — butun graf markazga sekin tortiladi
//
// Simulyatsiya "alpha" (harorat) bilan soviydi: boshida tugunlar tez
// joylashadi, keyin to'xtaydi. Foydalanuvchi tugunni sudrasa yoki sozlamani
// o'zgartirsa — qayta "qizdiriladi" (reheat).

export interface SimNode {
  id: string;
  label: string;
  group: string;       // rang guruhi kaliti
  deg: number;         // bog'lanishlar soni — radius shundan
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;      // sudralayotgan tugun simulyatsiyaga bo'ysunmaydi
  payload?: unknown;   // bosilganda kerak bo'ladigan asl ma'lumot
}

export interface SimLink {
  source: string;
  target: string;
  color: string;
}

export interface Forces {
  center: number;      // 0..1
  repel: number;       // 0..30
  link: number;        // 0..2
  distance: number;    // 30..300
}

export const DEFAULT_FORCES: Forces = { center: 0.35, repel: 10, link: 1, distance: 110 };

const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 0.0228;   // ≈ 300 qadamda soviydi (d3 bilan bir xil)
const FRICTION = 0.6;

export class GraphSim {
  nodes: SimNode[] = [];
  links: SimLink[] = [];
  alpha = 1;
  forces: Forces = { ...DEFAULT_FORCES };
  center = { x: 0, y: 0 };

  private index = new Map<string, SimNode>();

  setData(nodes: SimNode[], links: SimLink[]) {
    // Mavjud tugunlarning joyini saqlaymiz — ma'lumot yangilanganda
    // graf sakrab ketmasin (Obsidian ham shunday qiladi).
    const prev = this.index;
    this.nodes = nodes.map((n) => {
      const old = prev.get(n.id);
      return old ? { ...n, x: old.x, y: old.y, vx: old.vx, vy: old.vy, fixed: false } : n;
    });
    this.links = links;
    this.index = new Map(this.nodes.map((n) => [n.id, n]));
    this.reheat(prev.size ? 0.4 : 1);
  }

  get(id: string) { return this.index.get(id); }

  reheat(a = 0.5) { this.alpha = Math.max(this.alpha, a); }

  /** Bitta qadam. `false` qaytsa — graf tinchlangan, chizishni davom ettirish shart emas. */
  tick(): boolean {
    if (this.alpha < ALPHA_MIN) return false;
    this.alpha += (0 - this.alpha) * ALPHA_DECAY;

    const { repel, link, center, distance } = this.forces;
    const ns = this.nodes;
    const n = ns.length;

    // ── Itarish (har juftlik) ──
    // n ~ birnecha yuz bo'lgani uchun O(n²) yetarli va aniqroq.
    const rep = repel * 60;
    for (let i = 0; i < n; i++) {
      const a = ns[i];
      for (let j = i + 1; j < n; j++) {
        const b = ns[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-6) {                       // ustma-ust tushgan — biroz surib yuboramiz
          dx = (i % 7) - 3; dy = (j % 7) - 3; d2 = dx * dx + dy * dy || 1;
        }
        if (d2 > 640_000) continue;            // 800px dan uzoqda ta'sir sezilmaydi
        const f = (rep * this.alpha) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // ── Bog'lanish prujinasi ──
    for (const l of this.links) {
      const a = this.index.get(l.source);
      const b = this.index.get(l.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      // Ko'p bog'langan tugun kamroq siljiydi (d3 dagi bias kabi)
      const bias = a.deg / (a.deg + b.deg || 1);
      const f = ((d - distance) / d) * link * this.alpha * 0.5;
      const fx = dx * f;
      const fy = dy * f;
      a.vx += fx * (1 - bias); a.vy += fy * (1 - bias);
      b.vx -= fx * bias;       b.vy -= fy * bias;
    }

    // ── Markazga tortish + harakatni qo'llash ──
    const c = center * 0.06 * this.alpha;
    for (const nd of ns) {
      if (nd.fixed) { nd.vx = 0; nd.vy = 0; continue; }
      nd.vx += (this.center.x - nd.x) * c;
      nd.vy += (this.center.y - nd.y) * c;
      nd.vx *= FRICTION;
      nd.vy *= FRICTION;
      nd.x += nd.vx;
      nd.y += nd.vy;
    }
    return true;
  }

  /** Ekranda ko'rinadigan barcha tugunlarni qamrab oluvchi to'rtburchak */
  bounds() {
    if (!this.nodes.length) return { x1: -100, y1: -100, x2: 100, y2: 100 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of this.nodes) {
      if (n.x < x1) x1 = n.x;
      if (n.y < y1) y1 = n.y;
      if (n.x > x2) x2 = n.x;
      if (n.y > y2) y2 = n.y;
    }
    return { x1, y1, x2, y2 };
  }
}
