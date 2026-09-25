import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';

export default function HeroSection() {
  const { t } = useTranslation();

  const scrollToFeatures = () => {
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      className="relative w-full min-h-[700px] h-screen flex flex-col justify-between overflow-hidden"
      style={{
        backgroundImage: `url('/images/meghalaya_hero_mountain.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark green & black translucent cinematic overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-emerald-950/60 z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 z-10" />

      {/* ── TOP AREA (Pushed down by fixed navbar) ──────────────── */}
      <div className="relative z-20 pt-28 sm:pt-32 px-4 sm:px-8 max-w-7xl mx-auto w-full flex justify-end">
        {/* Upper-right Glowing Status Pill */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-lg shadow-emerald-950/40">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
          </span>
          <span>{t('landing.hero.system_online', { defaultValue: 'System Online • Real-time Monitoring' })}</span>
        </div>
      </div>

      {/* ── MIDDLE / HERO CORE CONTENT ──────────────────────────── */}
      <div className="relative z-20 px-4 sm:px-8 max-w-7xl mx-auto w-full my-auto py-6">
        <div className="max-w-3xl space-y-6">
          {/* Small uppercase kicker */}
          <div className="inline-block">
            <span className="text-xs sm:text-sm font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-950/50 backdrop-blur-xs px-3 py-1 rounded-full border border-emerald-500/30">
              {t('landing.hero.kicker', { defaultValue: 'SAFER COMMUNITIES | RESILIENT NORTHEAST' })}
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.1]">
            <span>{t('landing.hero.heading_white', { defaultValue: 'Predict. Prepare. ' })}</span>
            <span className="text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.4)]">
              {t('landing.hero.heading_green', { defaultValue: 'Protect.' })}
            </span>
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg md:text-xl text-slate-200 font-normal leading-relaxed max-w-2xl drop-shadow-sm">
            {t('landing.hero.description', {
              defaultValue:
                'Real-time landslide early warning system for North Eastern Region — leveraging geospatial data, weather intelligence and community participation for a safer tomorrow.',
            })}
          </p>

          {/* Action Buttons */}


          {/* Feature Checkmarks */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-2 text-xs sm:text-sm font-medium text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
              <span>{t('landing.hero.badge_early_warnings', { defaultValue: 'Early Warnings' })}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
              <span>{t('landing.hero.badge_stronger_communities', { defaultValue: 'Stronger Communities' })}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
              <span>{t('landing.hero.badge_safer_meghalaya', { defaultValue: 'A Safer North Eastern Region' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Scroll indicator + Lower-right quote ─────── */}
      <div className="relative z-20 px-4 sm:px-8 max-w-7xl mx-auto w-full pb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Placeholder spacer for left balance */}
        <div className="hidden md:block w-48" />

        {/* Center: Circular Bouncing Scroll Indicator */}
        <button
          onClick={scrollToFeatures}
          className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white transition-colors group cursor-pointer"
          aria-label="Scroll to explore"
        >
          <div className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center backdrop-blur-xs bg-white/5 group-hover:border-emerald-400 animate-bounce">
            <ChevronDown className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[11px] font-medium tracking-wide uppercase text-slate-300">
            {t('landing.hero.scroll_explore', { defaultValue: 'Scroll to explore' })}
          </span>
        </button>

        {/* Lower-Right: Mountain Quote */}
        <div className="text-center md:text-right text-xs sm:text-sm text-slate-300 backdrop-blur-xs bg-black/30 p-3 rounded-xl border border-white/10">
          <p className="font-semibold text-white">
            “{t('landing.hero.quote_line1', { defaultValue: 'Mountains are beautiful.' })}”
          </p>
          <p className="text-emerald-300 font-medium">
            {t('landing.hero.quote_line2', { defaultValue: 'Let’s keep them safe.' })}
          </p>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1 font-mono">
            {t('landing.hero.quote_location1', { defaultValue: 'East Khasi Hills' })} • {t('landing.hero.quote_location2', { defaultValue: 'Meghalaya, India' })}
          </div>
        </div>
      </div>
    </section>
  );
}
