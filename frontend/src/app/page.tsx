"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Workflow, Cpu, Code2 } from "lucide-react";
import { useEffect, useState } from "react";

/* ── Motion variants ── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
} as const;

const cardReveal = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
} as const;

/* ── Workflow SVG visualization ── */
function WorkflowDiagram() {
  const nodes = [
    { id: 1, x: 80, y: 80, label: "Trigger" },
    { id: 2, x: 280, y: 40, label: "Check KYC" },
    { id: 3, x: 280, y: 140, label: "Fetch Price" },
    { id: 4, x: 480, y: 80, label: "Mint Token" },
    { id: 5, x: 640, y: 80, label: "Settle" },
  ];

  const edges = [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 4 },
    { from: 4, to: 5 },
  ];

  return (
    <svg
      viewBox="0 0 740 200"
      className="w-full max-w-2xl mx-auto"
      fill="none"
    >
      {/* Glow filter */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-strong">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {edges.map((e, i) => {
        const from = nodes.find((n) => n.id === e.from)!;
        const to = nodes.find((n) => n.id === e.to)!;
        return (
          <g key={i}>
            {/* Base dim edge */}
            <line
              x1={from.x + 50}
              y1={from.y + 16}
              x2={to.x - 10}
              y2={to.y + 16}
              stroke="#2a2a2e"
              strokeWidth="2"
            />
            {/* Animated glowing edge */}
            <line
              x1={from.x + 50}
              y1={from.y + 16}
              x2={to.x - 10}
              y2={to.y + 16}
              stroke="#3A9AFF"
              strokeWidth="2"
              strokeDasharray="8 12"
              className="animate-dash-flow"
              filter="url(#glow)"
              opacity="0.7"
            />
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        <g key={node.id} className="animate-node-pulse" style={{ animationDelay: `${node.id * 0.4}s` }}>
          <rect
            x={node.x - 10}
            y={node.y}
            width={100}
            height={32}
            rx="8"
            fill="#111113"
            stroke="#3A9AFF"
            strokeWidth="1"
            filter="url(#glow)"
          />
          <text
            x={node.x + 40}
            y={node.y + 20}
            textAnchor="middle"
            fill="#e4e4e7"
            fontSize="11"
            fontFamily="var(--font-geist-mono)"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Feature cards data ── */
const features = [
  {
    icon: Workflow,
    title: "Visual Workflow Builder",
    description:
      "Drag, connect, and configure nodes in a React Flow-powered editor. Design non-linear workflows with conditionals and loops — no boilerplate.",
  },
  {
    icon: Cpu,
    title: "Rust Compiler",
    description:
      "Your visual graph compiles into a full CRE project bundle — main.ts, config, secrets, and all — ready for deployment on Chainlink.",
  },
  {
    icon: Code2,
    title: "Code-First Extensibility",
    description:
      "Inject custom JavaScript or TypeScript logic into any node. Full CodeMirror editor with autocomplete, right inside the workflow.",
  },
];

/* ── Main page ── */
export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-surface-0 text-white overflow-x-hidden">
      {/* ── Nav Bar ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 ${
          scrolled
            ? "bg-surface-0/80 backdrop-blur-xl border-b border-edge-dim"
            : "bg-transparent"
        }`}
      >
        <Image
          src="/logo/6flow_logo.svg"
          alt="6Flow Logo"
          width={120}
          height={32}
          priority
        />
        <Link
          href="/login"
          className="rounded-md bg-accent-yellow px-5 py-2 text-sm font-semibold text-surface-0 hover:brightness-110 transition-all"
        >
          Get Started
        </Link>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div
            className="absolute inset-[-40px] animate-grid-scroll"
            style={{
              backgroundImage:
                "linear-gradient(#3A9AFF 1px, transparent 1px), linear-gradient(90deg, #3A9AFF 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-blue/5 blur-[120px] animate-float-orb" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent-yellow/5 blur-[100px] animate-float-orb-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-blue/3 blur-[150px] animate-float-orb-slow" />

        <motion.div
          className="relative z-10 text-center max-w-3xl mx-auto"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="font-mono text-sm tracking-widest text-accent-blue uppercase mb-6"
          >
            Visual IDE for Smart Contracts
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            Design Workflows.{" "}
            <span className="text-accent-blue">Compile to Chain.</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Build tokenization workflows visually, compile them to deployable
            Chainlink CRE bundles with a single click. No runtime servers — just
            native on-chain execution.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-8 py-3.5 text-base font-semibold text-white hover:brightness-110 transition-all shadow-[0_0_24px_rgba(58,154,255,0.3)] hover:shadow-[0_0_40px_rgba(58,154,255,0.5)]"
            >
              Start Building
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="ml-1"
              >
                <path
                  d="M3 8h10m0 0L9 4m4 4L9 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Visual Showcase ── */}
      <section className="relative py-24 px-6">
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="relative rounded-2xl border border-edge-dim bg-surface-1/50 p-8 sm:p-12 backdrop-blur-sm">
            {/* Corner glow accents */}
            <div className="absolute -top-px -left-px w-24 h-24 bg-accent-blue/20 blur-2xl rounded-full" />
            <div className="absolute -bottom-px -right-px w-24 h-24 bg-accent-yellow/10 blur-2xl rounded-full" />

            <WorkflowDiagram />

            <p className="text-center mt-8 text-zinc-500 text-sm font-mono tracking-wide uppercase">
              Visual-first. Compiler-powered.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── Features Grid ── */}
      <section className="relative py-24 px-6">
        <motion.div
          className="max-w-5xl mx-auto"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.h2
            variants={fadeUp}
            className="font-display text-3xl sm:text-4xl font-bold text-center mb-4"
          >
            Built for{" "}
            <span className="text-accent-blue">serious engineers</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-zinc-400 text-center max-w-lg mx-auto mb-16"
          >
            Everything you need to design, compile, and deploy tokenization
            workflows on the Chainlink Runtime Environment.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={cardReveal}
                className="group relative rounded-xl border border-edge-dim bg-surface-1 p-6 transition-all duration-300 hover:border-accent-blue/40 hover:shadow-[0_0_24px_rgba(58,154,255,0.08)]"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center mb-4 group-hover:bg-accent-blue/10 transition-colors">
                  <f.icon className="w-5 h-5 text-accent-blue" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="relative py-32 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-accent-blue/5 blur-[120px]" />
        </div>
        <motion.div
          className="relative z-10 text-center max-w-xl mx-auto"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Ready to build?
          </h2>
          <p className="text-zinc-400 mb-8">
            Go from visual design to on-chain deployment in minutes.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-yellow px-8 py-3.5 text-base font-semibold text-surface-0 hover:brightness-110 transition-all"
          >
            Get Started
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-edge-dim py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <span>&copy; {new Date().getFullYear()} 6Flow Studio</span>
          <span className="font-mono">v0.1</span>
        </div>
      </footer>
    </div>
  );
}
