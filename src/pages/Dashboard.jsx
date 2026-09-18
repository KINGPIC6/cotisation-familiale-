import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toSafeMessage } from '../utils/errors';
import AppShell from '../components/AppShell';
import { InlineLoading, InlineError, EmptyState } from '../components/StateViews';

function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(n);
}

function translateAction(action) {
  const map = {
    family_created: 'a créé la famille',
    contribution_added: 'a ajouté une contribution',
    expense_added: 'a ajouté une dépense',
    member_deactivated: 'a désactivé un membre',
    member_reactivated: 'a réactivé un membre',
    join_request_approved: "a accepté une demande d'adhésion",
    join_request_rejected: "a refusé une demande d'adhésion",
    role_changed: 'a modifié un rôle',
  };
  return map[action] || action;
}

function actionMeta(action) {
  if (action === 'contribution_added') return { icon: '↗', tone: 'green', label: 'Contribution' };
  if (action === 'expense_added') return { icon: '↘', tone: 'orange', label: 'Dépense' };
  if (action?.includes('member')) return { icon: '◉', tone: 'blue', label: 'Membre' };
  if (action?.includes('join_request')) return { icon: '✓', tone: 'purple', label: 'Adhésion' };
  if (action === 'role_changed') return { icon: '◆', tone: 'pink', label: 'Rôle' };
  return { icon: '•', tone: 'neutral', label: 'Activité' };
}

function GlassOrb({ balance }) {
  const positive = balance >= 0;

  return (
    <div className="fh-orb-wrap" aria-hidden="true">
      <div className="fh-orb-shadow" />
      <div className="fh-orb">
        <div className="fh-orb-core">
          <span className="fh-orb-dot" />
        </div>
        <div className="fh-orbit fh-orbit-a" />
        <div className="fh-orbit fh-orbit-b" />
        <div className="fh-orbit fh-orbit-c" />
        <div className="fh-orb-glow" />
      </div>
      <span className={`fh-orb-status ${positive ? 'positive' : 'negative'}`}>
        {positive ? 'Équilibre positif' : 'Solde négatif'}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    data: null,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [
          { data: contributions, error: e1 },
          { data: expenses, error: e2 },
          { data: members, error: e3 },
          { data: activity, error: e4 },
        ] = await Promise.all([
          supabase.from('contributions').select('amount'),
          supabase.from('expenses').select('amount'),
          supabase.from('members').select('id, status').eq('status', 'active'),
          supabase
            .from('activity_logs')
            .select('id, action, details, created_at, actor:profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(8),
        ]);

        if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;

        const totalContributions = (contributions || []).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );
        const totalExpenses = (expenses || []).reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        if (mounted) {
          setState({
            loading: false,
            error: '',
            data: {
              totalContributions,
              totalExpenses,
              balance: totalContributions - totalExpenses,
              memberCount: (members || []).length,
              recentActivity: activity || [],
            },
          });
        }
      } catch (err) {
        if (mounted) {
          setState({
            loading: false,
            error: toSafeMessage(err),
            data: null,
          });
        }
      }
    }

    load();

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const data = state.data;

  const balanceRatio = useMemo(() => {
    if (!data || data.totalContributions <= 0) return 0;
    return Math.min(100, Math.max(0, (data.balance / data.totalContributions) * 100));
  }, [data]);

  return (
    <AppShell>
      <style>{`
        .fh-dashboard {
          --fh-ink: #18202b;
          --fh-muted: #718092;
          --fh-line: rgba(24, 32, 43, .09);
          --fh-surface: rgba(255,255,255,.78);
          --fh-primary: #7257ff;
          --fh-cyan: #20c7d9;
          --fh-green: #18a875;
          --fh-orange: #f39a4a;
          --fh-pink: #e85b9c;
          color: var(--fh-ink);
          min-height: 100%;
          padding: clamp(8px, 1.5vw, 22px);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .fh-topbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .fh-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: var(--fh-primary);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .fh-kicker::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--fh-cyan);
          box-shadow: 0 0 0 5px rgba(32,199,217,.10);
        }

        .fh-title {
          margin: 0;
          font-size: clamp(28px, 4vw, 46px);
          line-height: .98;
          letter-spacing: -.055em;
          font-weight: 850;
        }

        .fh-subtitle {
          margin: 10px 0 0;
          color: var(--fh-muted);
          font-size: 14px;
        }

        .fh-live {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border: 1px solid var(--fh-line);
          border-radius: 999px;
          background: rgba(255,255,255,.64);
          box-shadow: 0 10px 30px rgba(28,37,50,.05);
          font-size: 12px;
          font-weight: 750;
          white-space: nowrap;
        }

        .fh-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--fh-green);
          box-shadow: 0 0 0 5px rgba(24,168,117,.10);
          animation: fh-pulse 2s ease-in-out infinite;
        }

        .fh-hero {
          position: relative;
          overflow: hidden;
          min-height: 330px;
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, .65fr);
          align-items: center;
          gap: 20px;
          padding: clamp(24px, 4vw, 42px);
          border: 1px solid rgba(255,255,255,.8);
          border-radius: 32px;
          background:
            radial-gradient(circle at 12% 15%, rgba(32,199,217,.22), transparent 29%),
            radial-gradient(circle at 85% 18%, rgba(232,91,156,.18), transparent 25%),
            linear-gradient(135deg, #18202b 0%, #272345 50%, #172b3a 100%);
          color: white;
          box-shadow: 0 30px 70px rgba(30,36,55,.18);
        }

        .fh-hero::before,
        .fh-hero::after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 40% 60% 55% 45%;
          pointer-events: none;
        }

        .fh-hero::before {
          right: -90px;
          top: -110px;
          transform: rotate(25deg);
        }

        .fh-hero::after {
          left: 30%;
          bottom: -190px;
          transform: rotate(-20deg);
        }

        .fh-hero-content { position: relative; z-index: 2; }

        .fh-eyebrow {
          margin: 0 0 12px;
          color: rgba(255,255,255,.66);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .fh-balance {
          margin: 0;
          font-size: clamp(38px, 6vw, 68px);
          line-height: .96;
          letter-spacing: -.065em;
          font-weight: 900;
        }

        .fh-balance-label {
          margin: 13px 0 0;
          color: rgba(255,255,255,.72);
          font-size: 14px;
        }

        .fh-progress {
          width: min(520px, 100%);
          height: 7px;
          margin-top: 28px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
        }

        .fh-progress > span {
          display: block;
          height: 100%;
          width: ${balanceRatio}%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--fh-cyan), #8a72ff, var(--fh-pink));
          box-shadow: 0 0 18px rgba(114,87,255,.65);
          transition: width .8s cubic-bezier(.2,.8,.2,1);
        }

        .fh-orb-wrap {
          position: relative;
          min-height: 270px;
          display: grid;
          place-items: center;
          z-index: 2;
        }

        .fh-orb {
          position: relative;
          width: 190px;
          height: 190px;
          transform-style: preserve-3d;
          animation: fh-float 5s ease-in-out infinite;
        }

        .fh-orb-core {
          position: absolute;
          inset: 32px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 25%, rgba(255,255,255,.9), rgba(255,255,255,.18) 16%, transparent 30%),
            radial-gradient(circle at 55% 60%, #7160ff, #354d9d 52%, #1c2b46 78%);
          box-shadow:
            inset -20px -25px 35px rgba(0,0,0,.25),
            inset 12px 10px 25px rgba(255,255,255,.22),
            0 0 55px rgba(82,103,255,.38);
        }

        .fh-orb-dot {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: rgba(255,255,255,.85);
          box-shadow: 0 0 25px white;
        }

        .fh-orbit {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255,255,255,.42);
          border-radius: 50%;
          transform: rotateX(66deg) rotateZ(18deg);
        }

        .fh-orbit::after {
          content: "";
          position: absolute;
          left: 50%;
          top: -5px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #20c7d9;
          box-shadow: 0 0 16px #20c7d9;
        }

        .fh-orbit-a { transform: rotateX(66deg) rotateZ(18deg); animation: fh-spin 8s linear infinite; }
        .fh-orbit-b { transform: rotateY(67deg) rotateZ(-26deg); animation: fh-spin-reverse 10s linear infinite; }
        .fh-orbit-c { transform: rotateX(70deg) rotateY(25deg) rotateZ(72deg); animation: fh-spin 13s linear infinite; opacity: .55; }

        .fh-orb-glow {
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          background: rgba(86,107,255,.12);
          filter: blur(25px);
          transform: translateZ(-20px);
        }

        .fh-orb-shadow {
          position: absolute;
          bottom: 28px;
          width: 150px;
          height: 25px;
          border-radius: 50%;
          background: rgba(0,0,0,.25);
          filter: blur(13px);
          animation: fh-shadow 5s ease-in-out infinite;
        }

        .fh-orb-status {
          position: absolute;
          bottom: 0;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          color: rgba(255,255,255,.78);
          font-size: 11px;
          font-weight: 750;
          backdrop-filter: blur(12px);
        }

        .fh-orb-status.positive::before,
        .fh-orb-status.negative::before {
          content: "";
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .fh-orb-status.positive { color: #76e4bd; }
        .fh-orb-status.negative { color: #ff9b9b; }

        .fh-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .fh-stat {
          position: relative;
          overflow: hidden;
          padding: 22px;
          border: 1px solid var(--fh-line);
          border-radius: 24px;
          background: var(--fh-surface);
          box-shadow: 0 16px 45px rgba(32,40,54,.06);
          backdrop-filter: blur(18px);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }

        .fh-stat:hover {
          transform: translateY(-4px);
          box-shadow: 0 22px 55px rgba(32,40,54,.10);
          border-color: rgba(114,87,255,.20);
        }

        .fh-stat::after {
          content: "";
          position: absolute;
          width: 110px;
          height: 110px;
          right: -55px;
          top: -55px;
          border-radius: 50%;
          background: var(--fh-stat-glow, rgba(114,87,255,.10));
        }

        .fh-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .fh-stat-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: var(--fh-icon-bg, rgba(114,87,255,.10));
          color: var(--fh-icon, var(--fh-primary));
          font-weight: 900;
        }

        .fh-stat-label {
          margin: 0;
          color: var(--fh-muted);
          font-size: 12px;
          font-weight: 750;
        }

        .fh-stat-value {
          margin: 18px 0 0;
          font-size: clamp(21px, 2.5vw, 30px);
          font-weight: 850;
          letter-spacing: -.04em;
        }

        .fh-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, .7fr);
          gap: 14px;
          margin-top: 14px;
        }

        .fh-panel {
          border: 1px solid var(--fh-line);
          border-radius: 26px;
          background: var(--fh-surface);
          box-shadow: 0 16px 45px rgba(32,40,54,.055);
          backdrop-filter: blur(18px);
        }

        .fh-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 22px 14px;
        }

        .fh-panel-title {
          margin: 0;
          font-size: 17px;
          letter-spacing: -.02em;
        }

        .fh-panel-caption {
          margin: 5px 0 0;
          color: var(--fh-muted);
          font-size: 12px;
        }

        .fh-activity {
          list-style: none;
          padding: 0 12px 12px;
          margin: 0;
        }

        .fh-activity-item {
          display: grid;
          grid-template-columns: 42px minmax(0,1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 13px 10px;
          border-radius: 18px;
          transition: background .2s ease, transform .2s ease;
        }

        .fh-activity-item:hover {
          background: rgba(114,87,255,.055);
          transform: translateX(3px);
        }

        .fh-avatar {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 850;
        }

        .fh-avatar.green { background: rgba(24,168,117,.12); color: var(--fh-green); }
        .fh-avatar.orange { background: rgba(243,154,74,.13); color: #d87922; }
        .fh-avatar.blue { background: rgba(56,132,214,.12); color: #3884d6; }
        .fh-avatar.purple { background: rgba(114,87,255,.12); color: var(--fh-primary); }
        .fh-avatar.pink { background: rgba(232,91,156,.12); color: var(--fh-pink); }
        .fh-avatar.neutral { background: rgba(24,32,43,.07); color: var(--fh-muted); }

        .fh-activity-main {
          min-width: 0;
        }

        .fh-activity-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
        }

        .fh-activity-text strong { font-weight: 800; }

        .fh-activity-tag {
          display: inline-block;
          margin-left: 7px;
          padding: 3px 7px;
          border-radius: 999px;
          background: rgba(24,32,43,.055);
          color: var(--fh-muted);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .fh-activity-date {
          color: var(--fh-muted);
          font-size: 10px;
          white-space: nowrap;
        }

        .fh-mini {
          padding: 22px;
        }

        .fh-mini-value {
          margin: 8px 0 0;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -.045em;
        }

        .fh-mini-line {
          height: 1px;
          margin: 19px 0;
          background: var(--fh-line);
        }

        .fh-breakdown {
          display: grid;
          gap: 12px;
        }

        .fh-breakdown-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          font-size: 12px;
        }

        .fh-breakdown-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--fh-muted);
        }

        .fh-breakdown-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--fh-dot, var(--fh-primary));
        }

        .fh-breakdown-value { font-weight: 800; }

        .fh-loading {
          padding: 30px 0;
        }

        @keyframes fh-float {
          0%,100% { transform: translateY(0) rotateZ(-1deg); }
          50% { transform: translateY(-10px) rotateZ(2deg); }
        }

        @keyframes fh-shadow {
          0%,100% { transform: scaleX(1); opacity: .6; }
          50% { transform: scaleX(.82); opacity: .35; }
        }

        @keyframes fh-spin {
          to { transform: rotateX(66deg) rotateZ(378deg); }
        }

        @keyframes fh-spin-reverse {
          to { transform: rotateY(67deg) rotateZ(-386deg); }
        }

        @keyframes fh-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(.8); }
        }

        @media (max-width: 900px) {
          .fh-hero { grid-template-columns: 1fr; }
          .fh-orb-wrap { min-height: 230px; }
          .fh-stat-grid { grid-template-columns: 1fr; }
          .fh-main-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 620px) {
          .fh-dashboard { padding: 4px; }
          .fh-topbar { align-items: flex-start; flex-direction: column; }
          .fh-hero { border-radius: 24px; padding: 24px 20px; }
          .fh-orb { width: 155px; height: 155px; }
          .fh-orb-core { inset: 28px; }
          .fh-orb-wrap { min-height: 205px; }
          .fh-panel { border-radius: 22px; }
          .fh-activity-item { grid-template-columns: 38px minmax(0,1fr); }
          .fh-activity-date { grid-column: 2; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fh-dashboard *,
          .fh-dashboard *::before,
          .fh-dashboard *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <div className="fh-dashboard">
        <header className="fh-topbar">
          <div>
            <div className="fh-kicker">Espace familial</div>
            <h1 className="fh-title">Tableau de bord</h1>
            <p className="fh-subtitle">
              Une vue claire et vivante de la caisse de votre famille.
            </p>
          </div>

          <div className="fh-live">
            <span className="fh-live-dot" />
            Données synchronisées
          </div>
        </header>

        {state.loading && (
          <div className="fh-loading">
            <InlineLoading label="Chargement du tableau de bord…" />
          </div>
        )}

        {state.error && <InlineError message={state.error} />}

        {data && (
          <>
            <section className="fh-hero">
              <div className="fh-hero-content">
                <p className="fh-eyebrow">Solde familial</p>
                <p className="fh-balance">{formatAmount(data.balance)}</p>
                <p className="fh-balance-label">
                  Contributions disponibles après les dépenses enregistrées.
                </p>

                <div
                  className="fh-progress"
                  role="progressbar"
                  aria-valuenow={Math.round(balanceRatio)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label="Part du solde par rapport aux contributions"
                >
                  <span />
                </div>
              </div>

              <GlassOrb balance={data.balance} />
            </section>

            <section className="fh-stat-grid" aria-label="Indicateurs financiers">
              <article
                className="fh-stat"
                style={{
                  '--fh-icon-bg': 'rgba(24,168,117,.11)',
                  '--fh-icon': '#18a875',
                  '--fh-stat-glow': 'rgba(24,168,117,.08)',
                }}
              >
                <div className="fh-stat-top">
                  <p className="fh-stat-label">Total des contributions</p>
                  <span className="fh-stat-icon">↗</span>
                </div>
                <p className="fh-stat-value">{formatAmount(data.totalContributions)}</p>
              </article>

              <article
                className="fh-stat"
                style={{
                  '--fh-icon-bg': 'rgba(243,154,74,.12)',
                  '--fh-icon': '#d87922',
                  '--fh-stat-glow': 'rgba(243,154,74,.09)',
                }}
              >
                <div className="fh-stat-top">
                  <p className="fh-stat-label">Total des dépenses</p>
                  <span className="fh-stat-icon">↘</span>
                </div>
                <p className="fh-stat-value">{formatAmount(data.totalExpenses)}</p>
              </article>

              <article
                className="fh-stat"
                style={{
                  '--fh-icon-bg': 'rgba(56,132,214,.12)',
                  '--fh-icon': '#3884d6',
                  '--fh-stat-glow': 'rgba(56,132,214,.08)',
                }}
              >
                <div className="fh-stat-top">
                  <p className="fh-stat-label">Membres actifs</p>
                  <span className="fh-stat-icon">◉</span>
                </div>
                <p className="fh-stat-value">{data.memberCount}</p>
              </article>
            </section>

            <section className="fh-main-grid">
              <div className="fh-panel">
                <div className="fh-panel-head">
                  <div>
                    <h2 className="fh-panel-title">Activité récente</h2>
                    <p className="fh-panel-caption">
                      Les dernières actions enregistrées dans votre espace.
                    </p>
                  </div>
                </div>

                {data.recentActivity.length === 0 ? (
                  <div style={{ padding: '0 22px 22px' }}>
                    <EmptyState
                      title="Aucune activité pour l'instant"
                      description="Les actions de la famille apparaîtront ici."
                    />
                  </div>
                ) : (
                  <ul className="fh-activity">
                    {data.recentActivity.map((item) => {
                      const meta = actionMeta(item.action);
                      const actor = item.actor?.full_name || 'Un membre';

                      return (
                        <li key={item.id} className="fh-activity-item">
                          <div className={`fh-avatar ${meta.tone}`}>{meta.icon}</div>

                          <div className="fh-activity-main">
                            <p className="fh-activity-text">
                              <strong>{actor}</strong>{' '}
                              {translateAction(item.action)}
                              <span className="fh-activity-tag">{meta.label}</span>
                            </p>
                          </div>

                          <time
                            className="fh-activity-date"
                            dateTime={item.created_at}
                          >
                            {new Date(item.created_at).toLocaleDateString('fr-FR')}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <aside className="fh-panel fh-mini">
                <p className="fh-stat-label">Vue financière</p>
                <p className="fh-mini-value">{formatAmount(data.balance)}</p>

                <div className="fh-mini-line" />

                <div className="fh-breakdown">
                  <div className="fh-breakdown-row">
                    <span className="fh-breakdown-label">
                      <i
                        className="fh-breakdown-dot"
                        style={{ '--fh-dot': '#18a875' }}
                      />
                      Contributions
                    </span>
                    <span className="fh-breakdown-value">
                      {formatAmount(data.totalContributions)}
                    </span>
                  </div>

                  <div className="fh-breakdown-row">
                    <span className="fh-breakdown-label">
                      <i
                        className="fh-breakdown-dot"
                        style={{ '--fh-dot': '#f39a4a' }}
                      />
                      Dépenses
                    </span>
                    <span className="fh-breakdown-value">
                      {formatAmount(data.totalExpenses)}
                    </span>
                  </div>

                  <div className="fh-breakdown-row">
                    <span className="fh-breakdown-label">
                      <i
                        className="fh-breakdown-dot"
                        style={{ '--fh-dot': '#3884d6' }}
                      />
                      Membres actifs
                    </span>
                    <span className="fh-breakdown-value">
                      {data.memberCount}
                    </span>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/authService';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tableau de bord', icon: 'home' },
  { to: '/contributions', label: 'Cotisations', icon: 'coins' },
  { to: '/expenses', label: 'Dépenses', icon: 'receipt' },
  { to: '/members', label: 'Membres', icon: 'users' },
  { to: '/join-requests', label: 'Demandes', icon: 'inbox' },
  { to: '/activity', label: 'Activité', icon: 'clock' },
];

const ADMIN_ITEMS = [
  { to: '/admin', label: 'Administration', icon: 'shield' },
];

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  coins: 'M8 8a5 3 0 1 0 10 0 5 3 0 1 0-10 0zm0 0v4a5 3 0 0 0 10 0V8M6 12a5 3 0 0 0 8.5 3.2M6 12v4a5 3 0 0 0 8.5 3.2',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  users: 'M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  clock: 'M12 8v4l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

function Icon({ name, size = 18 }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ShellStyles = () => (
  <style>{`
    .lc-shell {
      display: flex;
      min-height: 100vh;
      background: #F6F3EC;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .lc-sidebar {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 260px;
      flex-shrink: 0;
      background: #0F2A22;
      color: #EDE7DC;
      padding: 20px 16px;
    }

    .lc-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px 20px;
    }

    .lc-brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #E8B24A, #C98A2A);
      display: grid;
      place-items: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .lc-brand-title {
      margin: 0;
      font-weight: 700;
      font-size: 17px;
      line-height: 1.1;
    }

    .lc-brand-subtitle {
      margin: 2px 0 0;
      font-size: 11px;
      color: #C9A24B;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .lc-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 8px;
    }

    .lc-nav__link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      color: rgba(237,231,220,.75);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: background .15s ease, color .15s ease;
    }

    .lc-nav__link:hover {
      background: rgba(237,231,220,.06);
      color: #EDE7DC;
    }

    .lc-nav__link--active {
      background: #E8B24A;
      color: #0F2A22;
      font-weight: 700;
    }

    .lc-sidebar-footer {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      margin-top: 24px;
      min-height: 220px;
      display: flex;
      align-items: flex-end;
      background-image:
        linear-gradient(to top, rgba(10,20,15,.92), rgba(10,20,15,.35) 55%, rgba(10,20,15,.15)),
        url('https://images.unsplash.com/photo-1661025208052-f4f54db8d743?fm=jpg&q=80&w=800&auto=format&fit=crop');
      background-size: cover;
      background-position: center;
    }

    .lc-sidebar-quote {
      padding: 18px;
      font-size: 13px;
      font-style: italic;
      line-height: 1.5;
      color: #F3EFE4;
    }

    .lc-nav-toggle {
      display: none;
    }

    .lc-topbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 28px;
      background: #F6F3EC;
      border-bottom: 1px solid rgba(15,42,34,.08);
    }

    .lc-search {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1px solid rgba(15,42,34,.1);
      border-radius: 10px;
      padding: 9px 14px;
      color: #6B7268;
      font-size: 14px;
    }

    .lc-topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .lc-bell {
      position: relative;
      color: #0F2A22;
    }

    .lc-bell-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: #C0392B;
      color: white;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      padding: 1px 5px;
    }

    .lc-user {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .lc-user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #0F2A22;
      color: #EDE7DC;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
    }

    .lc-user-name {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #18211D;
    }

    .lc-user-role {
      margin: 0;
      font-size: 11px;
      color: #7A8177;
    }

    .lc-signout {
      background: none;
      border: 1px solid rgba(15,42,34,.15);
      color: #18211D;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .lc-signout:hover { background: rgba(15,42,34,.05); }

    .lc-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .lc-content {
      flex: 1;
      padding: 24px 28px 40px;
    }

    @media (max-width: 880px) {
      .lc-sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 40;
        transform: translateX(-100%);
        transition: transform .2s ease;
      }
      .lc-sidebar.lc-sidebar--open { transform: translateX(0); }
      .lc-nav-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        border: 1px solid rgba(15,42,34,.15);
        background: #fff;
        color: #18211D;
        cursor: pointer;
      }
      .lc-topbar { padding: 12px 16px; }
      .lc-content { padding: 16px; }
      .lc-user-name, .lc-user-role { display: none; }
    }
  `}</style>
);

export default function AppShell({ children }) {
  const { profile, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;
  const fullName = profile?.full_name || 'Profil';
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="lc-shell">
      <ShellStyles />

      <aside className={`lc-sidebar ${menuOpen ? 'lc-sidebar--open' : ''}`}>
        <div>
          <div className="lc-brand">
            <span className="lc-brand-mark" aria-hidden="true">⌂</span>
            <div>
              <p className="lc-brand-title">La Caisse</p>
              <p className="lc-brand-subtitle">Gestion Familiale</p>
            </div>
          </div>

          <nav id="primary-nav" className="lc-nav">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `lc-nav__link ${isActive ? 'lc-nav__link--active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="lc-sidebar-footer" aria-hidden="true">
          <p className="lc-sidebar-quote">
            « Ensemble,<br />construisons un avenir<br />plus solide. »
          </p>
        </div>
      </aside>

      <div className="lc-main">
        <header className="lc-topbar">
          <button
            className="lc-nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="sr-only">Ouvrir le menu</span>
            ☰
          </button>

          <div className="lc-search">
            <Icon name="clock" size={0} />
            🔍 <span>Rechercher…</span>
          </div>

          <div className="lc-topbar-right">
            <div className="lc-bell" aria-hidden="true">
              🔔
            </div>

            <NavLink to="/profile" className="lc-user" style={{ textDecoration: 'none' }}>
              <div className="lc-user-avatar">{initials || '?'}</div>
              <div>
                <p className="lc-user-name">{fullName}</p>
                <p className="lc-user-role">{isAdmin ? 'Administrateur' : 'Membre'}</p>
              </div>
            </NavLink>

            <button className="lc-signout" onClick={handleSignOut}>
              Se déconnecter
            </button>
          </div>
        </header>

        <main className="lc-content">{children}</main>
      </div>
    </div>
  );
}
