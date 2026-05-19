"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

function StatNumber({ end, decimals = 0 }: { end: number, decimals?: number }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 2500;
    
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4); 
      setCount(easeProgress * end);
      if (progress < 1) animationFrameId = window.requestAnimationFrame(step);
      else setCount(end);
    };
    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, [end, isVisible]);

  return <span ref={ref}>{count.toFixed(decimals)}</span>;
}

const S = {
  root: { minHeight: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#f8fafc", color: "#172554", position: "relative" as const, overflowX: "hidden" as const, paddingTop: 72 },

  // Subtle SaaS Grid Background with Blue Tint
  gridBg: { position: "absolute" as const, inset: 0, backgroundImage: "linear-gradient(to right, rgba(37,99,235,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" as const, zIndex: 0, maskImage: "linear-gradient(to bottom, black 30%, transparent 80%)", WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent 80%)" },

  // NAV
  nav: { position: "fixed" as const, top: 0, left: 0, right: 0, width: "100%", zIndex: 100, background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(37,99,235,0.1)", WebkitBackdropFilter: "blur(12px)" },
  navInner: { maxWidth: 1200, margin: "0 auto", padding: "0 2rem", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoIcon: { width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" },
  logoText: { fontSize: "1.35rem", fontWeight: 900, color: "#1e3a8a", letterSpacing: "-0.02em" },
  navLinks: { display: "flex", alignItems: "center", gap: 12 },
  navLink: { padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.95rem", fontWeight: 600, color: "#475569", textDecoration: "none", transition: "all 0.2s" },
  navCta: { padding: "0.5rem 1.2rem", borderRadius: 8, fontSize: "0.95rem", fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", textDecoration: "none", transition: "all 0.3s", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" },

  // HERO
  heroWrap: { paddingBottom: "6rem", position: "relative" as const, zIndex: 10 },
  hero: { maxWidth: 1000, margin: "0 auto", padding: "7rem 2rem 3rem", display: "flex", flexDirection: "column" as const, alignItems: "center", textAlign: "center" as const },
  heroEyebrow: { display: "inline-flex", alignItems: "center", gap: 10, padding: "0.4rem 1.25rem", borderRadius: 999, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "2rem", animation: "fadeInUp 0.8s ease-out", boxShadow: "0 4px 15px rgba(37,99,235,0.1)" },
  heroEyebrowBadge: { background: "#2563eb", color: "#fff", padding: "0.15rem 0.5rem", borderRadius: 6, fontSize: "0.75rem", fontWeight: 800 },
  heroTitle: { fontSize: "clamp(3.5rem, 7vw, 5.5rem)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, color: "#172554", marginBottom: "1.5rem", animation: "fadeInUp 0.8s ease-out 0.1s both" },
  heroAccent: { color: "#2563eb", background: "linear-gradient(to right, #1d4ed8, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroSub: { fontSize: "1.25rem", color: "#475569", lineHeight: 1.6, maxWidth: 650, marginBottom: "3rem", fontWeight: 500, animation: "fadeInUp 0.8s ease-out 0.2s both" },
  heroBtns: { display: "flex", alignItems: "center", gap: 16, animation: "fadeInUp 0.8s ease-out 0.3s both", marginBottom: "4rem" },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 8, padding: "1.1rem 2.5rem", borderRadius: 12, fontSize: "1.05rem", fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #2563eb, #1e40af)", boxShadow: "0 10px 25px -5px rgba(37,99,235,0.4)", transition: "all 0.3s", textDecoration: "none", border: "1px solid transparent" },
  btnSecondary: { display: "inline-flex", alignItems: "center", gap: 8, padding: "1.1rem 2.5rem", borderRadius: 12, fontSize: "1.05rem", fontWeight: 700, color: "#1e3a8a", background: "#fff", border: "1px solid #bfdbfe", transition: "all 0.3s", textDecoration: "none", boxShadow: "0 4px 10px rgba(37,99,235,0.05)" },

  // MOCKUP TABS
  mockupTabsWrap: { display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" as const, animation: "fadeInUp 1s ease-out 0.35s both", position: "relative" as const, zIndex: 20 },
  mockupTab: { padding: "0.6rem 1.5rem", borderRadius: 999, fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", transition: "all 0.3s", border: "1px solid transparent", outline: "none" },
  mockupTabActive: { background: "#1e3a8a", color: "#ffffff", boxShadow: "0 10px 20px rgba(30,58,138,0.25)" },
  mockupTabInactive: { background: "#ffffff", color: "#64748b", border: "1px solid #e2e8f0", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" },

  // MOCKUP BASE
  mockupContainer: { position: "relative" as const, maxWidth: 1000, margin: "0 auto", animation: "fadeInUp 1s ease-out 0.4s both", zIndex: 15, padding: "0 2rem" },
  mockupBase: { width: "100%", height: 480, background: "#ffffff", borderRadius: 24, border: "1px solid #e2e8f0", boxShadow: "0 30px 60px -12px rgba(37,99,235,0.15)", overflow: "hidden", display: "flex", flexDirection: "column" as const, position: "relative" as const },
  mockupHeader: { height: 50, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", padding: "0 1.5rem", gap: 8, background: "#fafafa", zIndex: 10 },
  mockupDot: { width: 10, height: 10, borderRadius: "50%", background: "#cbd5e1" },
  mockupBody: { display: "flex", flex: 1, position: "relative" as const, overflow: "hidden" as const },
  mockupSidebar: { width: 220, background: "#f8fafc", borderRight: "1px solid #f1f5f9", padding: "2rem", display: "flex", flexDirection: "column" as const },
  mockupMain: { flex: 1, padding: "2rem", display: "flex", flexDirection: "column" as const, gap: "1.5rem" },
  
  // Floating Cards
  floatCard1: { position: "absolute" as const, right: "-1rem", top: "4rem", width: 260, background: "#ffffff", borderRadius: 16, padding: "1.5rem", boxShadow: "0 25px 50px rgba(37,99,235,0.1)", border: "1px solid #e2e8f0", animation: "float 6s ease-in-out infinite", zIndex: 20 },
  floatCard2: { position: "absolute" as const, left: "-1rem", bottom: "3rem", width: 280, background: "#ffffff", borderRadius: 16, padding: "1.5rem", boxShadow: "0 25px 50px rgba(37,99,235,0.1)", border: "1px solid #e2e8f0", animation: "float 8s ease-in-out infinite reverse", zIndex: 20 },

  // Pulse Indicator
  pulseContainer: { position: "relative" as const, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" },
  pulseDot: { width: 8, height: 8, background: "#10b981", borderRadius: "50%", zIndex: 2 },
  pulseRing: { position: "absolute" as const, width: "100%", height: "100%", borderRadius: "50%", border: "2px solid", zIndex: 1 },

  // STATS
  statsBar: { display: "flex", alignItems: "center", gap: 0, background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", position: "relative" as const, zIndex: 20, width: "100%", margin: "0 auto 5rem auto", boxShadow: "0 10px 30px rgba(37,99,235,0.03)" },
  statsInner: { maxWidth: 1000, margin: "0 auto", display: "flex", width: "100%" },
  statItem: { padding: "3rem 2rem", display: "flex", flexDirection: "column" as const, alignItems: "flex-start", gap: 4, flex: 1 },
  statDivider: { width: 1, alignSelf: "stretch", background: "#f1f5f9" },
  statVal: { fontSize: "3rem", fontWeight: 900, color: "#1e3a8a", letterSpacing: "-0.03em" },
  statLabel: { fontSize: "0.9rem", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase" as const, letterSpacing: "0.05em" },

  // SECTIONS
  section: { maxWidth: 1200, margin: "0 auto", padding: "6rem 2rem", position: "relative" as const, zIndex: 10 },
  sectionHead: { textAlign: "center" as const, marginBottom: "4rem", maxWidth: 700, margin: "0 auto 4rem auto" },
  sectionTitle: { fontSize: "clamp(2.5rem,4vw,3.5rem)", fontWeight: 900, color: "#172554", letterSpacing: "-0.03em", marginBottom: "1.25rem", lineHeight: 1.1 },
  sectionSub: { fontSize: "1.2rem", color: "#475569", lineHeight: 1.7 },

  // FEATURE CARDS
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" },
  featureCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 24, padding: "2.5rem", display: "flex", flexDirection: "column" as const, alignItems: "flex-start", transition: "all 0.3s", boxShadow: "0 10px 30px rgba(37,99,235,0.03)" },
  featureIconWrap: { width: 56, height: 56, borderRadius: 16, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", color: "#2563eb", transition: "all 0.3s" },
  featureTitle: { fontSize: "1.35rem", fontWeight: 800, color: "#1e3a8a", marginBottom: "0.75rem", letterSpacing: "-0.01em" },
  featureDesc: { fontSize: "1.05rem", color: "#475569", lineHeight: 1.6 },

  // PORTALS HEADER STRIP
  strip: { padding: "6rem 2rem 0", position: "relative" as const, zIndex: 10 },

  // TESTIMONIALS
  testimCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 24, padding: "2.5rem", display: "flex", flexDirection: "column" as const, gap: "1.5rem", transition: "all 0.4s", minWidth: "400px", maxWidth: "450px", boxShadow: "0 10px 30px rgba(37,99,235,0.03)" },
  testimStars: { display: "flex", gap: "0.25rem", color: "#f59e0b" },
  testimQuote: { fontSize: "1.1rem", color: "#1e3a8a", fontStyle: "italic" as const, lineHeight: 1.7, flex: 1 },
  testimAuthorWrap: { display: "flex", alignItems: "center", gap: "1rem" },
  testimAvatar: { width: 50, height: 50, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "1.2rem" },
  testimAuthorName: { fontSize: "1.05rem", fontWeight: 800, color: "#172554" },
  testimAuthorRole: { fontSize: "0.9rem", color: "#64748b" },

  // FOOTER
  footer: { padding: "5rem 2rem 3rem", background: "#0f172a", color: "#ffffff" },
  footerInner: { maxWidth: 1200, margin: "0 auto" },
  footerTop: { display: "flex", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "4rem", marginBottom: "4rem" },
  footerBrand: { maxWidth: 300 },
  footerDesc: { fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.6, marginTop: "1rem" },
  footerLinksWrap: { display: "flex", gap: "5rem", flexWrap: "wrap" as const },
  footerCol: { display: "flex", flexDirection: "column" as const, gap: "1rem" },
  footerColTitle: { fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  footerLink: { fontSize: "0.95rem", color: "#cbd5e1", textDecoration: "none", transition: "color 0.2s" },
  footerBottom: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)" },
  footerCopy: { fontSize: "0.9rem", color: "#64748b" },
};

const portals = [
  { title: "Student Portal", desc: "Track assignments, view grades, monitor progress, and manage your academic journey.", href: "/student/login", iconColor: "#2563eb", bgHover: "rgba(37,99,235,0.03)" },
  { title: "Teacher Portal", desc: "Manage classes, record attendance instantly, create robust assessments, and publish feedback.", href: "/teacher/login", iconColor: "#10b981", bgHover: "rgba(16,185,129,0.03)" },
  { title: "Administrator", desc: "Oversee operations, manage user registrations, configure system settings, and reporting.", href: "/admin/login", iconColor: "#8b5cf6", bgHover: "rgba(139,92,246,0.03)" },
];

const features = [
  { title: "Role-Based Access Control", desc: "Enterprise-grade security ensures data isolation. Users only see what they are explicitly authorized to access.",
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { title: "Real-Time Synchronization", desc: "No more refreshing. Grades, attendance, and communications propagate across all portals instantly.",
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { title: "Unified Data Ecosystem", desc: "Eliminate data silos. A single source of truth powers the student, teacher, parent, and admin experiences.",
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg> },
];

const testimonials = [
  { quote: "TriLink completely transformed our administrative workflow. The unified approach means less time managing software and more time focusing on student success.", author: "Dr. Sarah Jenkins", role: "School Principal", initials: "SJ", color: "#3b82f6" },
  { quote: "As a parent, the real-time updates are invaluable. I no longer wait for report cards to know how my child is doing; the insights are instantaneous and clear.", author: "Michael Chen", role: "Parent Association", initials: "MC", color: "#f59e0b" },
  { quote: "The intuitive design means I spend zero time training staff. Teachers picked up the gradebook and attendance modules on day one without any friction.", author: "Elena Rodriguez", role: "IT Director", initials: "ER", color: "#10b981" },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeRole, setActiveRole] = useState("admin");

  useEffect(() => {
    setMounted(true);
    
    // Auto-rotate the mockups every 7 seconds
    const interval = setInterval(() => {
      setActiveRole(prev => {
        if (prev === "admin") return "teacher";
        if (prev === "teacher") return "student";
        if (prev === "student") return "parent";
        return "admin";
      });
    }, 7000);
    
    return () => clearInterval(interval);
  }, []);

  const smoothScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!mounted) return null;

  const roles = [
    { id: "admin", label: "Admin Console" },
    { id: "teacher", label: "Teacher Portal" },
    { id: "student", label: "Student Portal" },
    { id: "parent", label: "Parent Portal" },
  ];

  return (
    <div style={S.root}>
      <div style={S.gridBg} />

      {/* GLOBAL CSS FOR SAAS ANIMATIONS AND RESPONSIVENESS */}
      <style dangerouslySetInnerHTML={{__html: `
        html { scroll-behavior: smooth; background: #f8fafc; }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-50% - 1rem)); }
        }

        .mockup-content-enter {
          animation: slideFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          display: flex;
          flex: 1;
        }

        /* Responsive 3-Column Portals Grid */
        .portals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 900px) {
          .portals-grid { grid-template-columns: 1fr; gap: 1.5rem; }
        }

        .btn-primary-anim:hover { background: #1e3a8a !important; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(37,99,235,0.3) !important; }
        .btn-secondary-anim:hover { background: #eff6ff !important; border-color: #93c5fd !important; transform: translateY(-2px); }
        
        .nav-link:hover { color: #1e3a8a !important; background: #eff6ff; }
        .dropdown:hover .dropdown-content { opacity: 1 !important; visibility: visible !important; transform: translateY(0) !important; pointer-events: auto !important; }
        .dropdown-item:hover { background: #eff6ff !important; color: #1d4ed8 !important; }

        /* Feature Cards */
        .feature-card:hover { border-color: #bfdbfe !important; box-shadow: 0 15px 40px rgba(37,99,235,0.08) !important; transform: translateY(-5px); }
        .feature-card:hover .feature-icon { background: #2563eb !important; color: #fff !important; transform: scale(1.1); box-shadow: 0 10px 20px rgba(37,99,235,0.2); }
        
        /* Shimmer line on float cards */
        .shimmer-box { position: relative; overflow: hidden; }
        .shimmer-box::after {
          content: ''; position: absolute; top: 0; left: 0; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
          transform: skewX(-20deg); animation: shimmerLine 3s infinite;
        }

        /* Portal Cards - Clean interaction */
        .portal-card {
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 2rem; text-decoration: none;
          display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(37,99,235,0.03);
        }
        .portal-card:hover { border-color: #bfdbfe; box-shadow: 0 25px 50px -10px rgba(37,99,235,0.12); transform: translateY(-5px); }
        .portal-card .p-icon { width: 48px; height: 48px; border-radius: 14px; background: #f8fafc; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; transition: all 0.3s; border: 1px solid #e2e8f0; }
        .portal-card:hover .p-icon { background: #fff; box-shadow: 0 10px 25px rgba(37,99,235,0.1); transform: scale(1.1) rotate(5deg); }
        .portal-card:hover .arrow-icon { transform: translateX(5px); }

        /* Testimonials Marquee */
        .marquee-wrap { display: flex; overflow: hidden; position: relative; width: 100%; padding: 2rem 0; }
        .marquee-wrap::before, .marquee-wrap::after { content: ""; position: absolute; top: 0; bottom: 0; width: 150px; z-index: 10; pointer-events: none; }
        .marquee-wrap::before { left: 0; background: linear-gradient(to right, #f8fafc, transparent); }
        .marquee-wrap::after { right: 0; background: linear-gradient(to left, #f8fafc, transparent); }
        .marquee-content { display: flex; flex-shrink: 0; gap: 2rem; animation: marquee 35s linear infinite; }
        .marquee-content:hover { animation-play-state: paused; }
        .testim-card:hover { transform: translateY(-8px); border-color: #bfdbfe !important; box-shadow: 0 20px 40px rgba(37,99,235,0.08) !important; }
        
        .footer-link { display: inline-flex; align-items: center; width: fit-content; transition: color 0.2s; }
        .footer-link::after { content: '→'; opacity: 0; transform: translateX(-8px); transition: all 0.2s ease; margin-left: 6px; font-weight: bold; }
        .footer-link:hover { color: #ffffff !important; }
        .footer-link:hover::after { opacity: 1; transform: translateX(0); color: #3b82f6; }

        /* Modern Landing Page Responsiveness Queries */
        @media (max-width: 1024px) {
          .float-card-responsive { display: none !important; }
        }
        @media (max-width: 768px) {
          .mockup-base-responsive { height: auto !important; min-height: 380px; border-radius: 16px !important; }
          .mockup-body-responsive { flex-direction: column !important; overflow-y: auto !important; }
          .mockup-sidebar-responsive { width: 100% !important; border-right: none !important; border-bottom: 1px solid #f1f5f9; padding: 1.25rem !important; }
          .stats-container { flex-direction: column !important; align-items: center; }
          .stat-divider-line { display: none !important; }
          .stat-item-box { width: 100%; align-items: center !important; padding: 2rem 1.5rem !important; border-bottom: 1px solid #f1f5f9; }
          .stat-item-box:last-child { border-bottom: none; }
          .footer-top-responsive { flex-direction: column !important; gap: 2.5rem !important; }
          .footer-links-wrap-responsive { gap: 3rem !important; }
        }
        @media (max-width: 640px) {
          .nav-links-responsive { gap: 0.25rem !important; }
          .nav-link-item { padding: 0.4rem 0.6rem !important; font-size: 0.825rem !important; }
          .nav-cta-item { padding: 0.4rem 0.8rem !important; font-size: 0.825rem !important; margin-left: 0.25rem !important; }
          .hero-buttons { flex-direction: column; width: 100%; gap: 0.75rem !important; }
          .hero-buttons a { width: 100%; justify-content: center; }
        }
        @media (max-width: 480px) {
          .testim-card-responsive { min-width: 280px !important; max-width: 310px !important; padding: 1.5rem !important; }
        }
      `}} />

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          <Link href="/" style={S.logoWrap}>
            <div style={S.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>
              </svg>
            </div>
            <span style={S.logoText}>TriLink</span>
          </Link>
          <div style={S.navLinks} className="nav-links-responsive">
            <a href="#features" onClick={(e) => smoothScroll(e, 'features')} className="nav-link nav-link-item" style={S.navLink}>Platform</a>
            <a href="#portals" onClick={(e) => smoothScroll(e, 'portals')} className="nav-link nav-link-item" style={S.navLink}>Solutions</a>
            
            <div className="dropdown" style={{ position: "relative", display: "inline-block", marginLeft: 16, padding: "10px 0" }}>
              <button className="btn-primary-anim nav-cta-item" style={{...S.navCta, marginLeft: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6}}>
                Login
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              
              <div className="dropdown-content" style={{ position: "absolute", top: "100%", right: 0, marginTop: "4px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 20px 40px -10px rgba(37,99,235,0.15)", minWidth: 240, opacity: 0, visibility: "hidden", transform: "translateY(-10px)", transition: "all 0.2s", display: "flex", flexDirection: "column", padding: "0.5rem", zIndex: 200 }}>
                <Link href="/admin/login" className="dropdown-item" style={{ padding: "0.85rem 1rem", color: "#1e3a8a", textDecoration: "none", borderRadius: 10, fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  Admin Console
                </Link>
                <div style={{ height: 1, background: "#f1f5f9", margin: "4px 8px" }} />
                <Link href="/teacher/login" className="dropdown-item" style={{ padding: "0.85rem 1rem", color: "#475569", textDecoration: "none", borderRadius: 10, fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  Teacher Portal
                </Link>
                <Link href="/student/login" className="dropdown-item" style={{ padding: "0.85rem 1rem", color: "#475569", textDecoration: "none", borderRadius: 10, fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
                  Student Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div style={S.heroWrap}>
        <div style={S.hero}>
          <div style={S.heroEyebrow}>
            <span style={S.heroEyebrowBadge}>New</span>
            TriLink Platform 2.0 is now live
          </div>
          <h1 style={S.heroTitle}>
            The infrastructure for <br />
            <span style={S.heroAccent}>modern education.</span>
          </h1>
          <p style={S.heroSub}>
            A beautifully engineered ecosystem that unifies administrators, teachers, parents, and students on a single, high-performance platform.
          </p>
          <div style={S.heroBtns} className="hero-buttons">
            <a href="#portals" onClick={(e) => smoothScroll(e, 'portals')} className="btn-primary-anim" style={S.btnPrimary}>
              Start Building
            </a>
            <a href="#features" onClick={(e) => smoothScroll(e, 'features')} className="btn-secondary-anim" style={S.btnSecondary}>
              Read the Documentation
            </a>
          </div>
        </div>

        {/* TABS FOR CAROUSEL */}
        <div style={S.mockupTabsWrap}>
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveRole(r.id)}
              style={{
                ...S.mockupTab,
                ...(activeRole === r.id ? S.mockupTabActive : S.mockupTabInactive)
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        
        {/* PREMIUM MOCKUP WITH ANIMATIONS */}
        <div style={S.mockupContainer}>
          <div style={S.mockupBase} className="mockup-base-responsive">
            <div style={S.mockupHeader}>
              <div style={{ ...S.mockupDot }} />
              <div style={{ ...S.mockupDot }} />
              <div style={{ ...S.mockupDot }} />
              <div style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, background: "#f1f5f9", padding: "0.25rem 0.85rem", borderRadius: 6 }}>
                trilink.edu/{activeRole}
              </div>
            </div>
            
            <div style={S.mockupBody} className="mockup-body-responsive">
              {/* ADMIN MOCKUP */}
              {activeRole === "admin" && (
                <div key="admin" className="mockup-content-enter">
                  <div style={S.mockupSidebar} className="mockup-sidebar-responsive">
                    <div style={{ height: 8, borderRadius: 4, background: "#cbd5e1", width: "80%", marginBottom: "1rem" }} />
                    <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", width: "60%" }} />
                    <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", width: "70%" }} />
                    <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", width: "50%" }} />
                  </div>
                  <div style={S.mockupMain}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ height: 16, borderRadius: 8, background: "#e2e8f0", width: 140 }} />
                      <div style={{ height: 28, borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe", width: 90 }} />
                    </div>
                    <div style={{ display: "flex", gap: "1.5rem" }}>
                      <div style={{ flex: 1, height: 90, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }} />
                      <div style={{ flex: 1, height: 90, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }} />
                      <div style={{ flex: 1, height: 90, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }} />
                    </div>
                    <div style={{ flex: 1, borderRadius: 16, border: "1px dashed #cbd5e1", background: "#f8fafc", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "60%", background: "linear-gradient(to top, #eff6ff, transparent)" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* TEACHER MOCKUP */}
              {activeRole === "teacher" && (
                <div key="teacher" className="mockup-content-enter">
                  <div style={{ width: 220, background: "#ffffff", borderRight: "1px solid #f1f5f9", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }} className="mockup-sidebar-responsive">
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "0.5rem" }}>My Classes</div>
                    <div style={{ height: 32, borderRadius: 8, background: "#eff6ff", borderLeft: "3px solid #2563eb", padding: "0 10px", display: "flex", alignItems: "center", fontSize: "0.85rem", fontWeight: 700, color: "#1e3a8a" }}>AP Calculus</div>
                    <div style={{ height: 32, borderRadius: 8, background: "#f8fafc", padding: "0 10px", display: "flex", alignItems: "center", fontSize: "0.85rem", fontWeight: 500, color: "#64748b" }}>Physics 101</div>
                    <div style={{ height: 32, borderRadius: 8, background: "#f8fafc", padding: "0 10px", display: "flex", alignItems: "center", fontSize: "0.85rem", fontWeight: 500, color: "#64748b" }}>Chemistry Lab</div>
                  </div>
                  <div style={{ flex: 1, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#172554" }}>Gradebook: AP Calculus</div>
                      <div style={{ height: 28, borderRadius: 14, background: "#10b981", color: "#fff", padding: "0 1rem", display: "flex", alignItems: "center", fontSize: "0.8rem", fontWeight: 700 }}>Publish Grades</div>
                    </div>
                    <div style={{ flex: 1, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ height: 40, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex" }}>
                        <div style={{ flex: 2, borderRight: "1px solid #e2e8f0" }}></div>
                        <div style={{ flex: 1, borderRight: "1px solid #e2e8f0" }}></div>
                        <div style={{ flex: 1 }}></div>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem" }}>
                        <div style={{ height: 16, borderRadius: 4, background: "#f1f5f9", width: "100%" }}></div>
                        <div style={{ height: 16, borderRadius: 4, background: "#f1f5f9", width: "100%" }}></div>
                        <div style={{ height: 16, borderRadius: 4, background: "#f1f5f9", width: "100%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STUDENT MOCKUP */}
              {activeRole === "student" && (
                <div key="student" className="mockup-content-enter">
                  <div style={{ flex: 2, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", borderRight: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#172554" }}>Weekly Schedule</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", flex: 1 }}>
                      {['MON','TUE','WED','THU','FRI'].map((day, i) => (
                        <div key={day} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ height: 24, background: "#f8fafc", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8" }}>{day}</div>
                          {i === 1 || i === 3 ? <div style={{ height: 60, borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}></div> : <div style={{ height: 40, borderRadius: 8, background: "#f1f5f9" }}></div>}
                          {i === 2 && <div style={{ height: 80, borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0" }}></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: "#ffffff", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a" }}>Pending Tasks</div>
                    <div style={{ padding: "1rem", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: "2px solid #cbd5e1", marginTop: 2 }}></div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#172554" }}>History Essay</div>
                        <div style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600, marginTop: 4 }}>Due Tomorrow</div>
                      </div>
                    </div>
                    <div style={{ padding: "1rem", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: "2px solid #cbd5e1", marginTop: 2 }}></div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#172554" }}>Math Problem Set</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500, marginTop: 4 }}>Due Friday</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PARENT MOCKUP */}
              {activeRole === "parent" && (
                <div key="parent" className="mockup-content-enter" style={{ display: "flex", padding: "2rem", gap: "2rem", background: "#f8fafc", flex: 1 }}>
                  <div style={{ flex: 1, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>A</div>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#172554" }}>Alex Chen</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>10th Grade</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Recent Grades</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "0.75rem", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e3a8a" }}>Biology Midterm</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#10b981" }}>A-</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "0.75rem", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e3a8a" }}>World History</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#2563eb" }}>B+</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fdf4ff", color: "#c026d3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>M</div>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#172554" }}>Maya Chen</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>7th Grade</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Attendance</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#f8fafc", padding: "1rem", borderRadius: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }}></div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e3a8a" }}>Present Today</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>Checked in at 8:15 AM</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FLOATING CARDS - DYNAMIC BASED ON ROLE */}
          {activeRole === "admin" && (
            <>
              <div key="fc-a1" className="shimmer-box float-card-responsive" style={S.floatCard1}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
                  <div style={S.pulseContainer}>
                    <div style={S.pulseDot} />
                    <div style={{ ...S.pulseRing, borderColor: "#10b981" }} />
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>System Status</div>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", width: "100%", marginBottom: "0.5rem" }} />
                <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", width: "70%" }} />
              </div>
              <div key="fc-a2" className="shimmer-box float-card-responsive" style={S.floatCard2}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>Real-time Sync</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#172554", marginBottom: "0.25rem" }}><StatNumber end={142} />ms</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Average latency across all nodes</div>
              </div>
            </>
          )}

          {activeRole === "teacher" && (
            <>
              <div key="fc-t1" className="shimmer-box float-card-responsive" style={S.floatCard1}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.75rem" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>Grading Progress</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Midterm Exam</span>
                  <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 800 }}><StatNumber end={85} />%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", width: "100%", overflow: "hidden" }}>
                  <div style={{ width: "85%", height: "100%", background: "#10b981", borderRadius: 3 }}></div>
                </div>
              </div>
              <div key="fc-t2" className="shimmer-box float-card-responsive" style={S.floatCard2}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.5rem" }}>
                  <div style={S.pulseContainer}>
                    <div style={{...S.pulseDot, background: "#f59e0b"}} />
                    <div style={{ ...S.pulseRing, borderColor: "#f59e0b" }} />
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>Upcoming Class</div>
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#172554" }}>Physics 101</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>Starting in 15 mins • Room 302</div>
              </div>
            </>
          )}

          {activeRole === "student" && (
            <>
              <div key="fc-s1" className="shimmer-box float-card-responsive" style={S.floatCard1}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.75rem" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>Academic Standing</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#172554", marginBottom: "0.25rem" }}><StatNumber end={3.84} decimals={2} /> <span style={{fontSize: "1rem", color: "#94a3b8", fontWeight: 600}}>GPA</span></div>
                <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>↑ Top 10% of class</div>
              </div>
              <div key="fc-s2" className="shimmer-box float-card-responsive" style={S.floatCard2}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.5rem" }}>
                  <div style={S.pulseContainer}>
                    <div style={{...S.pulseDot, background: "#ef4444"}} />
                    <div style={{ ...S.pulseRing, borderColor: "#ef4444" }} />
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>Upcoming Deadline</div>
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#172554" }}>History Essay</div>
                <div style={{ fontSize: "0.8rem", color: "#ef4444", fontWeight: 600, marginTop: 4 }}>Closes in 12 hours</div>
              </div>
            </>
          )}

          {activeRole === "parent" && (
            <>
              <div key="fc-p1" className="shimmer-box float-card-responsive" style={S.floatCard1}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.75rem" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>School Notice</div>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#172554", marginBottom: "0.25rem" }}>Early Dismissal</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Friday, Oct 24th at 12:30 PM</div>
              </div>
              <div key="fc-p2" className="shimmer-box float-card-responsive" style={S.floatCard2}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.5rem" }}>
                  <div style={S.pulseContainer}>
                    <div style={{...S.pulseDot, background: "#10b981"}} />
                    <div style={{ ...S.pulseRing, borderColor: "#10b981" }} />
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e3a8a" }}>Live Attendance</div>
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#172554" }}>Safely on Campus</div>
                <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600, marginTop: 4 }}>Both children accounted for</div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* STATS BAR */}
      <div id="stats-bar" style={S.statsBar}>
        <div style={S.statsInner} className="stats-container">
          <div style={S.statItem} className="stat-item-box">
            <span style={S.statVal}><StatNumber end={3} /></span>
            <span style={S.statLabel}>Dedicated Portals</span>
          </div>
          <div style={S.statDivider} className="stat-divider-line" />
          <div style={S.statItem} className="stat-item-box">
            <span style={S.statVal}><StatNumber end={99.9} decimals={1} />%</span>
            <span style={S.statLabel}>Uptime SLA</span>
          </div>
          <div style={S.statDivider} className="stat-divider-line" />
          <div style={S.statItem} className="stat-item-box">
            <span style={S.statVal}><StatNumber end={100} />%</span>
            <span style={S.statLabel}>Role Isolation</span>
          </div>
        </div>
      </div>

      {/* PORTALS CARDS */}
      <div id="portals" style={S.strip}>
        <div style={S.sectionHead}>
          <h2 style={S.sectionTitle}>Three portals.<br/>One unified platform.</h2>
          <p style={S.sectionSub}>Deliver tailored, high-performance experiences with uncompromising security across your entire institution.</p>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: "6rem" }}>
          <div className="portals-grid">
            {portals.map((p) => (
              <Link key={p.title} href={p.href} className="portal-card" onMouseEnter={(e) => { e.currentTarget.style.background = p.bgHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}>
                <div className="p-icon" style={{ color: p.iconColor }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1e3a8a", marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>{p.title}</div>
                <div style={{ fontSize: "1.05rem", color: "#475569", lineHeight: 1.6, flex: 1 }}>{p.desc}</div>
                <div style={{ marginTop: "2.5rem", fontSize: "0.95rem", fontWeight: 700, color: p.iconColor, display: "flex", alignItems: "center", gap: 6 }}>
                  Access Portal <span style={{ transition: "transform 0.2s" }} className="arrow-icon">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ position: "relative", background: "#f8fafc", borderTop: "1px solid #f1f5f9", paddingBottom: "6rem" }}>
        <div style={S.section}>
          <div style={S.sectionHead}>
            <h2 style={S.sectionTitle}>Built for operational excellence</h2>
            <p style={S.sectionSub}>Designed to eliminate friction, ensuring data flows securely and instantly.</p>
          </div>
          <div style={S.featureGrid}>
            {features.map((f, i) => (
              <div key={f.title} className="feature-card" style={S.featureCard}>
                <div className="feature-icon" style={S.featureIconWrap}>{f.icon}</div>
                <div style={S.featureTitle}>{f.title}</div>
                <div style={S.featureDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: "6rem", background: "#f8fafc" }}>
        <div style={{ ...S.section, paddingLeft: 0, paddingRight: 0, paddingBottom: 0, paddingTop: 0 }}>
           <div style={{ ...S.sectionHead, padding: "0 2rem", marginBottom: "3rem" }}>
            <h2 style={S.sectionTitle}>Loved by education leaders</h2>
            <p style={S.sectionSub}>See why institutions are switching to TriLink to modernize their infrastructure.</p>
          </div>
          
          <div className="marquee-wrap">
            <div className="marquee-content">
              {[...testimonials, ...testimonials].map((t, i) => (
                <div key={i} className="testim-card testim-card-responsive" style={S.testimCard}>
                  <div style={S.testimStars}>
                    {[...Array(5)].map((_, idx) => (
                      <svg key={idx} width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ))}
                  </div>
                  <div style={S.testimQuote}>&quot;{t.quote}&quot;</div>
                  <div style={S.testimAuthorWrap}>
                    <div className="testim-avatar" style={{...S.testimAvatar, background: t.color }}>{t.initials}</div>
                    <div>
                      <div style={S.testimAuthorName}>{t.author}</div>
                      <div style={S.testimAuthorRole}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <div style={S.footerTop} className="footer-top-responsive">
            <div style={S.footerBrand}>
              <Link href="/" style={S.logoWrap}>
                <div style={{ ...S.logoIcon, width: 36, height: 36, borderRadius: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>
                  </svg>
                </div>
                <span style={{ ...S.logoText, color: "#ffffff" }}>TriLink</span>
              </Link>
              <p style={S.footerDesc}>The infrastructure for modern educational institutions. Secure, scalable, and beautifully engineered.</p>
            </div>
            
            <div style={S.footerLinksWrap} className="footer-links-wrap-responsive">
              <div style={S.footerCol}>
                <div style={S.footerColTitle}>Platform</div>
                <a href="#features" onClick={(e) => smoothScroll(e, 'features')} className="footer-link" style={S.footerLink}>Features</a>
                <a href="#portals" onClick={(e) => smoothScroll(e, 'portals')} className="footer-link" style={S.footerLink}>Solutions</a>
                <Link href="/admin/login" className="footer-link" style={S.footerLink}>Admin Console</Link>
              </div>
              <div style={S.footerCol}>
                <div style={S.footerColTitle}>Portals</div>
                <Link href="/student/login" className="footer-link" style={S.footerLink}>Student Portal</Link>
                <Link href="/teacher/login" className="footer-link" style={S.footerLink}>Teacher Portal</Link>
              </div>
              <div style={S.footerCol}>
                <div style={S.footerColTitle}>Company</div>
                <a href="#" className="footer-link" style={S.footerLink}>About Us</a>
                <a href="#" className="footer-link" style={S.footerLink}>Contact</a>
                <a href="#" className="footer-link" style={S.footerLink}>Privacy Policy</a>
              </div>
            </div>
          </div>
          
          <div style={S.footerBottom}>
            <div style={S.footerCopy}>© {new Date().getFullYear()} TriLink Systems Inc. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
