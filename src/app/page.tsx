'use client';

import { ArrowRight, Network, Shield, Upload, GitBranch, ScrollText, Cpu, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const features = [
  {
    icon: Upload,
    title: 'Parse Configs',
    desc: 'Drag & drop or paste RouterOS export or Linux netplan — auto-detects vendor & version.',
  },
  {
    icon: Network,
    title: 'Topology Map',
    desc: 'Interactive React Flow canvas. Subnets auto-discovered, devices placed & connected.',
  },
  {
    icon: Shield,
    title: 'Validation Engine',
    desc: 'IP conflicts, subnet overlaps, gateway unreachable, MTU mismatches, VLAN gaps, BGP/OSPF checks.',
  },
  {
    icon: GitBranch,
    title: 'Multi-Device',
    desc: 'Paste configs from many devices at once. Splitter detects boundaries automatically.',
  },
  {
    icon: ScrollText,
    title: 'Export Reports',
    desc: 'Download Markdown or text summary of all issues, device inventory & topology data.',
  },
  {
    icon: Cpu,
    title: 'Vendor-Neutral',
    desc: 'RouterOS, Linux (iproute2, netplan, ifupdown) — same internal model, one UI.',
  },
];

const stats = [
  { label: 'Vendors', value: '2' },
  { label: 'Rules', value: '4+' },
  { label: 'Node Types', value: '5' },
  { label: 'Protocols', value: '5' },
];

const protocols = [
  { name: 'OSPF', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { name: 'BGP', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { name: 'MPLS', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { name: 'RIP', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { name: 'VLAN', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
];

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-500/10 via-transparent to-transparent blur-3xl" />
    </div>
  );
}

function FloatingPaths() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const paths: { x: number; y: number; dx: number; dy: number; hue: number }[] = [];
    for (let i = 0; i < 24; i++) {
      paths.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        hue: 190 + Math.random() * 60,
      });
    }

    let frame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      for (const p of paths) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.strokeStyle = `hsla(${p.hue}, 70%, 60%, 0.12)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, 0.2)`;
        ctx.fill();
      }
      for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
          const dx = paths[i].x - paths[j].x;
          const dy = paths[i].y - paths[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx.strokeStyle = `hsla(${(paths[i].hue + paths[j].hue) / 2}, 60%, 55%, ${0.08 * (1 - dist / 200)})`;
            ctx.beginPath();
            ctx.moveTo(paths[i].x, paths[i].y);
            ctx.lineTo(paths[j].x, paths[j].y);
            ctx.stroke();
          }
        }
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 -z-10 pointer-events-none" />;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-slate-950 text-slate-200">
      <AnimatedGrid />
      <FloatingPaths />

      {/* Nav */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-slate-800/50 bg-slate-950/70 px-6 py-3 backdrop-blur-xl sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sm font-bold text-sky-400">
            N
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Net<span className="text-sky-400">Thir</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/editor"
            className="hidden rounded-lg border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300 sm:inline-flex"
          >
            Editor
          </Link>
          <Link
            href="/editor"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-24 pb-20 text-center sm:px-10">
        <div
          className={cn(
            'mb-6 inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 transition-all duration-700',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
          </span>
          v1.0 — Network Config Visualizer
        </div>

        <h1
          className={cn(
            'max-w-4xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl lg:text-8xl transition-all duration-700 delay-100',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
          )}
        >
          Visualize your{' '}
          <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Network Config
          </span>
          <br />
          in seconds.
        </h1>

        <p
          className={cn(
            'mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg transition-all duration-700 delay-200',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          No GNS3. No Packet Tracer. No lab setup. Paste your RouterOS or Linux configs, get an
          interactive topology map + validation reports instantly.
        </p>

        <div
          className={cn(
            'mt-10 flex flex-col items-center gap-4 sm:flex-row transition-all duration-700 delay-300',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          <Link
            href="/editor"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-8 text-base font-semibold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400 hover:shadow-sky-400/40 active:scale-[0.98] sm:w-auto"
          >
            Open Editor
            <ChevronRight className="h-5 w-5" />
          </Link>
          <a
            href="#features"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-8 text-base font-medium text-slate-300 transition-all hover:border-slate-600 hover:text-slate-200 active:scale-[0.98] sm:w-auto"
          >
            Learn More
          </a>
        </div>

        {/* Stats */}
        <div
          className={cn(
            'mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4 transition-all duration-700 delay-500',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-sky-400 sm:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Protocol Badges */}
        <div
          className={cn(
            'mt-8 flex flex-wrap items-center justify-center gap-2 transition-all duration-700 delay-[600ms]',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          {protocols.map((p) => (
            <span
              key={p.name}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.color}`}
            >
              {p.name}
            </span>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-12">
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-100 sm:text-3xl">
          How It <span className="text-sky-400">Works</span>
        </h2>
        <p className="mb-12 text-center text-sm text-slate-500">
          Three steps from config to topology.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { step: '1', title: 'Paste Config', desc: 'Copy-paste RouterOS export or Linux ifupdown/netplan configs — or use the sample.' },
            { step: '2', title: 'Parse & Build', desc: 'Auto-detect vendor, extract interfaces/IPs/routes, discover subnets, build graph.' },
            { step: '3', title: 'Visualize', desc: 'Interactive topology map with role badges, edge labels, validation reports & export.' },
          ].map((item) => (
            <div key={item.step} className="group relative rounded-2xl border border-slate-800 bg-slate-900/30 p-6 text-center transition hover:border-sky-500/30">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-lg font-bold text-sky-400 transition group-hover:bg-sky-500/20">
                {item.step}
              </div>
              <h3 className="mb-2 font-semibold text-slate-200">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <span className="text-xs font-medium uppercase tracking-widest text-slate-600" id="features">
          Features
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      </div>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pt-14 pb-28 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm transition-all duration-500 hover:border-sky-500/30 hover:bg-slate-900/70 hover:shadow-lg hover:shadow-sky-500/5',
              mounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0',
            )}
            style={{ transitionDelay: `${600 + i * 100}ms` }}
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 transition-colors group-hover:bg-sky-500/20">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-slate-200">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>

            {/* Shine effect on hover */}
            <div className="absolute -inset-x-full -top-1/2 h-64 w-1/2 -translate-x-full rotate-45 bg-gradient-to-r from-transparent via-white/5 to-transparent transition-all duration-700 group-hover:translate-x-[400%]" />
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 px-6 py-6 text-center text-xs text-slate-600">
        NetThir — Network Config Visualizer. Built with Next.js + React Flow.
      </footer>
    </div>
  );
}
