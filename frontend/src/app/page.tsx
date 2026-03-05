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
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
} as const;

const cardReveal = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
} as const;

/* ── Feature cards data ── */
const features = [
  {
    icon: Workflow,
    title: "Visual Workflow Builder",
    description:
      "Drag, connect, and configure nodes like a game.",
  },
  {
    icon: Cpu,
    title: "Provided Templates",
    description:
      "We have templates for various use-cases, such as prediction market, RWA tokenization, and more.",
  },
  {
    icon: Code2,
    title: "Developer Experience",
    description:
      "We provide programmable node, so that you can inject custom TypeScript code into it.",
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
          src="/logo/6flow_white.png"
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
            low-code IDE for Smart Contract Engineers
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            Like n8n, <span className="text-accent-blue">for CRE</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed"
          >
            6Flow Studio is Tokenization Workflow Platform. We provide a
            programmable, low-code orchestration layer for the Chainlink Runtime
            Environment (CRE). We abstract the complexity so that developers can
            focus on their use cases.
          </motion.p>
        </motion.div>
      </section>

      {/* ── Visual Showcase ── */}
      <section className="relative py-24 px-6">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="relative rounded-2xl border border-edge-dim bg-surface-1/50 p-2 sm:p-4 backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Corner glow accents */}
            <div className="absolute -top-px -left-px w-32 h-32 bg-accent-blue/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-px -right-px w-32 h-32 bg-accent-yellow/10 blur-3xl rounded-full" />

            <Image
              src="/screenshot_6flow.png"
              alt="6Flow Designer Screenshot"
              width={1600}
              height={1000}
              className="rounded-xl relative z-10 w-full h-auto"
            />
          </div>
          <p className="text-center mt-8 text-zinc-500 text-sm font-mono tracking-wide uppercase">
            The workflow that everyone can feel
          </p>
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
            <span className="text-accent-blue">complex smart contracts</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-zinc-400 text-center max-w-lg mx-auto mb-16"
          >
            From prediction market to RWA tokenization. Now anyone can design logics on Chainlink Runtime Environment.
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

      {/* ── TUI Showcase ── */}
      <section className="relative py-24 px-6">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="relative rounded-2xl border border-edge-dim bg-surface-1/50 p-2 sm:p-4 backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Corner glow accents */}
            <div className="absolute -top-px -left-px w-32 h-32 bg-accent-blue/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-px -right-px w-32 h-32 bg-accent-yellow/10 blur-3xl rounded-full" />

            <Image
              src="/screenshot_tui.png"
              alt="6Flow TUI Screenshot"
              width={1600}
              height={1000}
              className="rounded-xl relative z-10 w-full h-auto"
            />
          </div>
          <p className="text-center mt-8 text-zinc-500 text-sm font-mono tracking-wide uppercase">
            Your secrets belong to you. Manage secrets, simulate, deploy in your terminal.
          </p>
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
